import {
  adminApi,
  cleanAdminFiles,
  queueFile,
  TRASH,
  PORTAL_KEY,
  dropTrashOf,
  trashAfterReset,
  trashEntry,
  userSnapshot,
} from "./admin.js";
import { registrationsApi } from "./registrations.js";
import { judgingApi } from "./judging.js";
import { driveEnabled, deleteFiles } from "./drive.js";
import { activationSql } from "./catalog.js";
import { sendEmail, passwordResetEmail } from "./mail.js";
import {
  now,
  random,
  digest,
  hashPassword,
  verifyPassword,
  publicUser,
  toBase64Url,
  passkeyKey,
  passkeyResponse,
  passkeySignatureValid,
} from "./security.js";
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new ApiError(status, message);
};
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
const cookieName = (r) =>
  new URL(r.url).protocol === "https:" ? "__Host-ha_session" : "ha_session";
const sessionCookie = (r, token, age = 604800) =>
  `${cookieName(r)}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${age}${new URL(r.url).protocol === "https:" ? "; Secure" : ""}`;
// Browser caching for public static files so moving between pages does not
// re-check every stylesheet, script and font. Pages, the API and PDFs are untouched.
export function staticCache(pathname) {
  if (pathname.startsWith("/api/") || /\.(pdf|html?)\/?$/i.test(pathname)) return null;
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (/^\/portal\/(assets\/vendor\/|media\/fonts\/)/.test(pathname) || /\.woff2?$/i.test(pathname))
    return "public, max-age=2592000";
  if (/^\/(portal|icons)\/.+\.(css|js|webp|png|jpe?g|svg|ico)$/i.test(pathname))
    return "public, max-age=600, stale-while-revalidate=86400";
  return null;
}
export function portalAssetPath(pathname) {
  if (pathname === "/" || pathname === "/index.php") return "/portal/home.html";
  if (pathname === "/login" || pathname === "/login.html") return "/portal/login.html";
  return null;
}
async function body(r, maximum = 16384) {
  if (
    !(r.headers.get("content-type") || "")
      .toLowerCase()
      .startsWith("application/json")
  )
    fail(415, "กรุณาส่งข้อมูลแบบ JSON");
  const reader = r.body?.getReader();
  if (!reader) fail(400, "ไม่พบข้อมูล");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximum) {
      await reader.cancel();
      fail(413, "ข้อมูลมีขนาดใหญ่เกินกำหนด");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error();
    return value;
  } catch {
    fail(400, "ข้อมูลไม่ถูกต้อง");
  }
}
async function sessionHash(r) {
  const token = (r.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName(r) + "="))
    ?.slice(cookieName(r).length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? digest(token) : null;
}
async function currentUser(r, db) {
  const hash = await sessionHash(r);
  if (!hash) return null;
  return db
    .prepare(
      "SELECT u.* FROM account_sessions s JOIN account_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    )
    .bind(hash, now())
    .first();
}
const clientIp = (r) => (r.headers.get("CF-Connecting-IP") || "").slice(0, 60);
const clientAgent = (r) => (r.headers.get("user-agent") || "").slice(0, 300);
// The session row plus where and how it was opened, for the "signed-in devices" list.
const sessionStatements = (r, db, hash, userId, method) => [
  db
    .prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)")
    .bind(hash, userId, now() + 604800),
  db
    .prepare("INSERT INTO account_session_info(token_hash,created_at,ip,user_agent,method) VALUES(?,?,?,?,?)")
    .bind(hash, now(), clientIp(r), clientAgent(r), method),
];
async function logLogin(db, r, entry) {
  await db.batch([
    db
      .prepare(
        "INSERT INTO account_login_log(user_id,email,ok,method,reason,ip,user_agent,created_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        entry.user_id || null,
        String(entry.email || "").slice(0, 254),
        entry.ok ? 1 : 0,
        entry.method,
        entry.reason || "",
        clientIp(r),
        clientAgent(r),
        now(),
      ),
    db.prepare("DELETE FROM account_login_log WHERE created_at<?").bind(now() - 90 * 86400),
  ]);
}
// Cloudflare Turnstile is enforced only when both keys are configured.
const turnstileOn = (env) => Boolean(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY);
async function requireHuman(r, env, token) {
  if (!turnstileOn(env)) return;
  if (typeof token !== "string" || !token || token.length > 4096)
    fail(400, "กรุณายืนยันว่าไม่ใช่บอทก่อนดำเนินการ");
  const data = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (clientIp(r)) data.set("remoteip", clientIp(r));
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: data,
  })
    .then((response) => response.json())
    .catch(() => ({}));
  if (!result.success) fail(400, "ยืนยันว่าไม่ใช่บอทไม่สำเร็จ กรุณาลองใหม่");
}
const LOCK_AFTER = 8,
  LOCK_SECONDS = 900;
async function limit(db, r, action, maximum, seconds, perIp = true) {
  const key = await digest(
    action +
      (perIp ? ":" + (r.headers.get("CF-Connecting-IP") || "local") : ""),
  );
  const t = now();
  const result = await db
    .prepare(
      "INSERT INTO account_limits(key,attempts,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN resets_at<=? THEN 1 ELSE attempts+1 END,resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END RETURNING attempts",
    )
    .bind(key, t + seconds, t, t)
    .first();
  if (result.attempts > maximum)
    fail(429, "ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่");
}
async function api(r, env, ctx) {
  if (!env.DB) fail(503, "ยังไม่ได้เชื่อมต่อฐานข้อมูล");
  const path = new URL(r.url).pathname,
    db = env.DB;
  if (
    !["GET", "HEAD"].includes(r.method) &&
    r.headers.get("origin") !== new URL(r.url).origin
  )
    fail(403, "คำขอไม่ได้มาจากเว็บไซต์นี้");
  if (path === "/api/health" && r.method === "GET") {
    await db.prepare("SELECT id FROM account_bootstrap LIMIT 1").first();
    await db.prepare("SELECT id FROM event_competitions LIMIT 1").first();
    await db.prepare("SELECT is_organizer FROM account_users LIMIT 1").first();
    await db.prepare("SELECT judge_id FROM event_scores LIMIT 1").first();
    return json({ ok: true, release: "judging-v1" });
  }
  if (path === "/api/setup" && r.method === "GET")
    return json({
      firstAccountAvailable: !(await db
        .prepare("SELECT id FROM account_bootstrap WHERE id=1")
        .first()),
      turnstile_site_key: turnstileOn(env) ? env.TURNSTILE_SITE_KEY : null,
    });
  const systemClosed =
    (
      await db
        .prepare("SELECT value FROM app_settings WHERE key='system_enabled'")
        .first()
    )?.value === "false";
  if (path === "/api/me" && r.method === "GET")
    return json({
      user: publicUser(await currentUser(r, db)),
      system_closed: systemClosed,
    });
  if (path === "/api/portal" && r.method === "GET") {
    if (systemClosed) return json({ system_closed: true, stats: null });
    const content = await db
      .prepare("SELECT value FROM app_settings WHERE key=?")
      .bind(PORTAL_KEY)
      .first();
    const stats = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM event_competitions) AS activities,
        (SELECT COUNT(*) FROM event_competitions WHERE registration_open=1) AS open_activities,
        (SELECT COUNT(*) FROM event_registrations WHERE status='approved') AS teams,
        (SELECT COUNT(DISTINCT owner_id) FROM event_registrations WHERE status='approved') AS coaches,
        (SELECT COUNT(*) FROM event_students s JOIN event_registrations r ON r.id=s.registration_id WHERE r.status='approved') AS students,
        (SELECT COUNT(DISTINCT s.school) FROM event_students s JOIN event_registrations r ON r.id=s.registration_id WHERE r.status='approved') AS schools,
        (SELECT COUNT(DISTINCT judge_id) FROM event_judges) AS judges
    `).first();
    return json({
      system_closed: false,
      stats,
      content: content ? JSON.parse(content.value) : {},
    });
  }
  if (
    systemClosed &&
    !["/api/login", "/api/logout"].includes(path) &&
    !path.startsWith("/api/password/") &&
    !path.startsWith("/api/passkey/login") &&
    !(await currentUser(r, db))?.is_superadmin
  )
    fail(503, "ระบบปิดใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ");
  if (path === "/api/admin/system" && r.method === "POST") {
    const user = await currentUser(r, db);
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ");
    if (!user.is_superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const b = await body(r);
    if (typeof b.enabled !== "boolean") fail(400, "ข้อมูลไม่ถูกต้อง");
    if (b.enabled && await db.prepare("SELECT 1 FROM app_settings WHERE key GLOB 'round_reset_file:*' LIMIT 1").first())
      fail(409, "กรุณาดำเนินการเริ่มรอบใหม่ให้เสร็จก่อนเปิดระบบ");
    await db
      .prepare(
        "INSERT INTO app_settings(key,value,updated_by,updated_at) VALUES('system_enabled',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
      )
      .bind(b.enabled ? "true" : "false", user.id, now())
      .run();
    return json({ system_closed: !b.enabled });
  }
  if (path === "/api/signup" && r.method === "POST") {
    // Schools share one public IP on network Wi-Fi; keep per-IP limits generous.
    await limit(db, r, "signup", 60, 3600);
    const b = await body(r);
    await requireHuman(r, env, b.turnstile);
    const name = typeof b.name === "string" ? b.name.trim() : "",
      school = typeof b.school === "string" ? b.school.trim() : "",
      email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (
      name.length < 2 ||
      name.length > 100 ||
      school.length < 2 ||
      school.length > 150
    )
      fail(400, "กรอกชื่อ–นามสกุลและโรงเรียนให้ครบ");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, "กรุณากรอกอีเมลให้ถูกต้อง");
    if (
      typeof b.password !== "string" ||
      b.password.length < 12 ||
      b.password.length > 128
    )
      fail(400, "รหัสผ่านต้องมี 12–128 ตัวอักษร");
    if (
      !Array.isArray(b.roles) ||
      !b.roles.length ||
      b.roles.length > 2 ||
      b.roles.some((x) => !["coach", "judge"].includes(x)) ||
      new Set(b.roles).size !== b.roles.length
    )
      fail(400, "เลือกผู้ฝึกซ้อม กรรมการ หรือทั้งสองอย่าง");
    const id = crypto.randomUUID(),
      t = now(),
      passwordHash = await hashPassword(b.password),
      token = random(),
      tokenHash = await digest(token);
    try {
      // D1 batch is atomic. The first serialized signup claims the permanent marker.
      await db.batch([
        db
          .prepare(
            "INSERT INTO account_users(id,name,school,email,password_hash,is_coach,is_judge,is_superadmin,created_at) SELECT ?,?,?,?,?,?,?,CASE WHEN EXISTS(SELECT 1 FROM account_bootstrap WHERE id=1) THEN 0 ELSE 1 END,?",
          )
          .bind(
            id,
            name,
            school,
            email,
            passwordHash,
            b.roles.includes("coach") ? 1 : 0,
            b.roles.includes("judge") ? 1 : 0,
            t,
          ),
        db
          .prepare(
            "INSERT INTO account_bootstrap(id,user_id,created_at) SELECT 1,id,? FROM account_users WHERE id=? AND is_superadmin=1 ON CONFLICT(id) DO NOTHING",
          )
          .bind(t, id),
        ...sessionStatements(r, db, tokenHash, id, "signup"),
      ]);
    } catch (error) {
      if (/UNIQUE constraint failed: account_users.email/i.test(String(error)))
        fail(409, "ไม่สามารถสมัครด้วยอีเมลนี้ได้ หากมีบัญชีแล้วให้เข้าสู่ระบบ");
      throw error;
    }
    const user = await db
      .prepare("SELECT * FROM account_users WHERE id=?")
      .bind(id)
      .first();
    return json({ user: publicUser(user) }, 201, {
      "Set-Cookie": sessionCookie(r, token),
    });
  }
  if (path === "/api/login" && r.method === "POST") {
    await limit(db, r, "login", 120, 900);
    const b = await body(r),
      email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    await limit(db, r, "login-email:" + email, 20, 900, false);
    await db.batch([
      db.prepare("DELETE FROM account_sessions WHERE expires_at<?").bind(now()),
      db.prepare("DELETE FROM account_limits WHERE resets_at<?").bind(now()),
    ]);
    if (
      typeof b.password !== "string" ||
      b.password.length > 128 ||
      email.length > 254
    )
      fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    await requireHuman(r, env, b.turnstile);
    const user = await db
      .prepare("SELECT * FROM account_users WHERE email=?")
      .bind(email)
      .first();
    // Too many wrong passwords pause this account for everyone, whatever network they come from.
    const lockKey = await digest("login-fail:" + email);
    const failures = await db
      .prepare("SELECT attempts FROM account_limits WHERE key=? AND resets_at>?")
      .bind(lockKey, now())
      .first();
    if (failures?.attempts >= LOCK_AFTER) {
      await logLogin(db, r, { user_id: user?.id, email, method: "password", reason: "locked" });
      fail(429, "บัญชีนี้ถูกพักการเข้าสู่ระบบ 15 นาที เพราะใส่รหัสผ่านผิดหลายครั้ง ใช้ Face ID หรือ “ลืมรหัสผ่าน” ได้");
    }
    const valid = await verifyPassword(
      b.password,
      user?.password_hash ||
        "pbkdf2-sha256$100000$" + "0".repeat(64) + "$" + "0".repeat(64),
    );
    if (!user || !valid) {
      await db
        .prepare(
          "INSERT INTO account_limits(key,attempts,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN resets_at<=? THEN 1 ELSE attempts+1 END,resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END",
        )
        .bind(lockKey, now() + LOCK_SECONDS, now(), now())
        .run();
      await logLogin(db, r, { user_id: user?.id, email, method: "password", reason: "wrong" });
      fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    if (systemClosed && !user.is_superadmin) fail(503, "ระบบปิดใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ");
    const token = random();
    await db.batch([
      ...sessionStatements(r, db, await digest(token), user.id, "password"),
      db.prepare("DELETE FROM account_limits WHERE key=?").bind(lockKey),
    ]);
    await logLogin(db, r, { user_id: user.id, email, ok: true, method: "password" });
    return json({ user: publicUser(user) }, 200, {
      "Set-Cookie": sessionCookie(r, token),
    });
  }
  if (path === "/api/passkey/login/options" && r.method === "POST") {
    await limit(db, r, "passkey-options", 120, 900);
    const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    await db.batch([
      db.prepare("DELETE FROM account_challenges WHERE expires_at<?").bind(now()),
      db
        .prepare("INSERT INTO account_challenges(challenge,kind,expires_at) VALUES(?,'login',?)")
        .bind(challenge, now() + 300),
    ]);
    return json({ challenge, rpId: new URL(r.url).hostname, userVerification: "required", timeout: 60000 });
  }
  if (path === "/api/passkey/login" && r.method === "POST") {
    await limit(db, r, "passkey-login", 120, 900);
    const b = await body(r);
    const denied = async (reason, userId) => {
      await logLogin(db, r, { user_id: userId, method: "passkey", reason });
      fail(401, "เข้าสู่ระบบด้วย Face ID ไม่สำเร็จ กรุณาลองใหม่หรือใช้รหัสผ่าน");
    };
    const response = await passkeyResponse(
      "webauthn.get",
      new URL(r.url).origin,
      b.client_data,
      b.authenticator_data,
    );
    if (!response || typeof b.id !== "string") await denied("invalid");
    // Each challenge works once and only for five minutes.
    const claimed = await db
      .prepare(
        "DELETE FROM account_challenges WHERE challenge=? AND kind='login' AND expires_at>? RETURNING challenge",
      )
      .bind(response.challenge, now())
      .all();
    if (!claimed.results.length) await denied("challenge");
    const passkey = await db.prepare("SELECT * FROM account_passkeys WHERE id=?").bind(b.id).first();
    if (!passkey) await denied("unknown");
    const key = await passkeyKey(passkey.public_key, passkey.alg);
    if (!key || !(await passkeySignatureValid(key, passkey.alg, response, b.signature)))
      await denied("signature", passkey.user_id);
    const user = await db.prepare("SELECT * FROM account_users WHERE id=?").bind(passkey.user_id).first();
    if (systemClosed && !user.is_superadmin) fail(503, "ระบบปิดใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ");
    const token = random();
    await db.batch([
      ...sessionStatements(r, db, await digest(token), user.id, "passkey"),
      db.prepare("UPDATE account_passkeys SET last_used_at=? WHERE id=?").bind(now(), passkey.id),
    ]);
    await logLogin(db, r, { user_id: user.id, email: user.email, ok: true, method: "passkey" });
    return json({ user: publicUser(user) }, 200, { "Set-Cookie": sessionCookie(r, token) });
  }
  if (path.startsWith("/api/passkey") || path.startsWith("/api/sessions")) {
    const user = await currentUser(r, db);
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ");
    const origin = new URL(r.url).origin;
    const passkeys = async () =>
      (
        await db
          .prepare("SELECT id,name,created_at,last_used_at FROM account_passkeys WHERE user_id=? ORDER BY created_at")
          .bind(user.id)
          .all()
      ).results;
    if (path === "/api/passkeys" && r.method === "GET") return json({ passkeys: await passkeys() });
    if (path === "/api/passkey/register/options" && r.method === "POST") {
      const existing = await passkeys();
      if (existing.length >= 10) fail(409, "บัญชีนี้ลงทะเบียน Face ID ครบ 10 อุปกรณ์แล้ว ลบอุปกรณ์เดิมก่อน");
      const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      await db.batch([
        db.prepare("DELETE FROM account_challenges WHERE expires_at<? OR (user_id=? AND kind='register')").bind(now(), user.id),
        db
          .prepare("INSERT INTO account_challenges(challenge,kind,user_id,expires_at) VALUES(?,'register',?,?)")
          .bind(challenge, user.id, now() + 300),
      ]);
      return json({
        challenge,
        rp: { name: "ศิลปหัตถกรรม", id: new URL(r.url).hostname },
        user: { id: toBase64Url(new TextEncoder().encode(user.id)), name: user.email, displayName: user.name },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        attestation: "none",
        timeout: 60000,
        excludeCredentials: existing.map((item) => ({ type: "public-key", id: item.id })),
      });
    }
    if (path === "/api/passkey/register" && r.method === "POST") {
      const b = await body(r);
      const response = await passkeyResponse("webauthn.create", origin, b.client_data, b.authenticator_data);
      const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
      if (
        !response ||
        typeof b.id !== "string" ||
        !b.id ||
        b.id.length > 1400 ||
        response.credentialId !== b.id ||
        !(await passkeyKey(b.public_key, b.alg))
      )
        fail(400, "ลงทะเบียน Face ID ไม่สำเร็จ กรุณาลองใหม่");
      // Each challenge works once and only for five minutes.
      const claimed = await db
        .prepare(
          "DELETE FROM account_challenges WHERE challenge=? AND kind='register' AND user_id=? AND expires_at>? RETURNING challenge",
        )
        .bind(response.challenge, user.id, now())
        .all();
      const saved = claimed.results.length
        ? await db
            .prepare(
              `INSERT INTO account_passkeys(id,user_id,public_key,alg,name,created_at)
              SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM account_passkeys WHERE user_id=?)<10
              ON CONFLICT(id) DO NOTHING`,
            )
            .bind(b.id, user.id, b.public_key, Number(b.alg), name || "อุปกรณ์ของฉัน", now(), user.id)
            .run()
        : null;
      if (!saved?.meta.changes) fail(400, "ลงทะเบียน Face ID ไม่สำเร็จ กรุณาลองใหม่");
      return json({ passkeys: await passkeys() }, 201);
    }
    if (path === "/api/passkey/delete" && r.method === "POST") {
      const b = await body(r);
      await db
        .prepare("DELETE FROM account_passkeys WHERE id=? AND user_id=?")
        .bind(typeof b.id === "string" ? b.id : "", user.id)
        .run();
      return json({ passkeys: await passkeys() });
    }
    const current = await sessionHash(r);
    if (path === "/api/sessions" && r.method === "GET")
      return json({
        sessions: (
          await db
            .prepare(
              `SELECT s.rowid AS id,i.created_at,COALESCE(i.ip,'') AS ip,COALESCE(i.user_agent,'') AS user_agent,
              COALESCE(i.method,'') AS method,s.token_hash=? AS is_current
              FROM account_sessions s LEFT JOIN account_session_info i ON i.token_hash=s.token_hash
              WHERE s.user_id=? AND s.expires_at>? ORDER BY is_current DESC,i.created_at DESC`,
            )
            .bind(current, user.id, now())
            .all()
        ).results.map(({ is_current, ...row }) => ({ ...row, current: Boolean(is_current) })),
      });
    if (path === "/api/sessions/revoke" && r.method === "POST") {
      const b = await body(r);
      // The device in use signs out with the normal logout button, never from this list.
      await db
        .prepare("DELETE FROM account_sessions WHERE user_id=? AND token_hash<>? AND (?=1 OR rowid=?)")
        .bind(user.id, current, b.others === true ? 1 : 0, Number.isInteger(b.id) ? b.id : -1)
        .run();
      return json({ ok: true });
    }
    fail(404, "ไม่พบรายการที่ร้องขอ");
  }
  if (path === "/api/password/forgot" && r.method === "POST") {
    await limit(db, r, "password-forgot", 30, 3600);
    const b = await body(r),
      email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, "กรุณากรอกอีเมลให้ถูกต้อง");
    if (!env.RESEND_API_KEY) fail(503, "ระบบส่งอีเมลยังไม่พร้อมใช้งาน");
    await requireHuman(r, env, b.turnstile);
    await limit(db, r, "password-forgot-email:" + email, 3, 3600, false);
    await db
      .prepare("DELETE FROM account_password_resets WHERE expires_at<?")
      .bind(now())
      .run();
    const user = await db
      .prepare("SELECT id,name,email FROM account_users WHERE email=?")
      .bind(email)
      .first();
    if (user) {
      const token = random(),
        minutes = 30;
      await db.batch([
        db
          .prepare("DELETE FROM account_password_resets WHERE user_id=?")
          .bind(user.id),
        db
          .prepare("INSERT INTO account_password_resets VALUES(?,?,?,?)")
          .bind(await digest(token), user.id, now() + minutes * 60, now()),
      ]);
      const link = new URL(r.url).origin + "/reset-password#token=" + token;
      const sending = sendEmail(
        env,
        user.email,
        passwordResetEmail(user.name, link, minutes),
      ).catch((error) => console.error("password reset email failed", error));
      // Send in the background so response time does not reveal whether the email exists.
      if (ctx?.waitUntil) ctx.waitUntil(sending);
      else await sending;
    }
    return json({ ok: true });
  }
  if (path === "/api/password/reset" && r.method === "POST") {
    await limit(db, r, "password-reset", 60, 3600);
    const b = await body(r);
    if (typeof b.token !== "string" || !/^[a-f0-9]{64}$/.test(b.token))
      fail(400, "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว");
    if (
      typeof b.password !== "string" ||
      b.password.length < 12 ||
      b.password.length > 128
    )
      fail(400, "รหัสผ่านต้องมี 12–128 ตัวอักษร");
    const tokenHash = await digest(b.token);
    const reset = await db
      .prepare(
        "SELECT user_id FROM account_password_resets WHERE token_hash=? AND expires_at>?",
      )
      .bind(tokenHash, now())
      .first();
    if (!reset) fail(400, "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว");
    const passwordHash = await hashPassword(b.password);
    // Claim the token atomically so it can only be used once.
    const claimed = await db
      .prepare(
        "DELETE FROM account_password_resets WHERE token_hash=? AND expires_at>? RETURNING user_id",
      )
      .bind(tokenHash, now())
      .all();
    if (!claimed.results.length) fail(400, "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว");
    await db.batch([
      db
        .prepare("UPDATE account_users SET password_hash=? WHERE id=?")
        .bind(passwordHash, reset.user_id),
      db
        .prepare("DELETE FROM account_password_resets WHERE user_id=?")
        .bind(reset.user_id),
      db
        .prepare("DELETE FROM account_sessions WHERE user_id=?")
        .bind(reset.user_id),
    ]);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(r, "", 0) });
  }
  if (path === "/api/logout" && r.method === "POST") {
    const hash = await sessionHash(r);
    if (hash)
      await db
        .prepare("DELETE FROM account_sessions WHERE token_hash=?")
        .bind(hash)
        .run();
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(r, "", 0) });
  }
  if (path.startsWith("/api/admin/console/")) {
    const user = await currentUser(r, db);
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ");
    if (!user.is_superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    return adminApi(r, env, user, { body, json, fail });
  }
  if (
    path === "/api/competitions" ||
    path.startsWith("/api/competitions/") ||
    path.startsWith("/api/registrations") ||
    path.startsWith("/api/registration-documents") ||
    path.startsWith("/api/admin/competitions") ||
    path.startsWith("/api/admin/registrations") ||
    path === "/api/admin/organizers" ||
    path.startsWith("/api/admin/storage")
  ) {
    const user = await currentUser(r, db);
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ");
    return registrationsApi(r, env, user, { body, json, fail, limit });
  }
  if (
    path === "/api/admin/judges" ||
    path === "/api/judging" ||
    path.startsWith("/api/judging/") ||
    path === "/api/results" ||
    path.startsWith("/api/results/") ||
    path === "/api/certificates" ||
    path.startsWith("/api/certificate-files/") ||
    path === "/api/certificate-settings"
  ) {
    const user = await currentUser(r, db);
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ");
    return judgingApi(r, env, user, { body, json, fail });
  }
  if (path === "/api/admin/users" && r.method === "GET") {
    const user = await currentUser(r, db);
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ");
    if (!user.is_superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    return json({
      users: (
        await db
          .prepare("SELECT * FROM account_users ORDER BY created_at,id")
          .all()
      ).results.map(publicUser),
    });
  }
  if (path === "/api/admin/start-new-round" && r.method === "POST") {
    const user = await currentUser(r, db);
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ");
    if (!user.is_superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const b = await body(r);
    if (b.confirm !== "เริ่มรอบใหม่") fail(400, "กรุณาพิมพ์คำยืนยันให้ถูกต้อง");
    if (!systemClosed) fail(409, "กรุณาปิดระบบก่อนเริ่มการแข่งขันรอบใหม่");
    const pending = "key GLOB 'round_reset_file:*'";
    const driveRefs = `SELECT drive_file_id AS id FROM registration_documents WHERE drive_file_id IS NOT NULL
      UNION SELECT drive_file_id FROM certificate_files`;
    if (!driveEnabled(env) && await db.prepare(`SELECT 1 FROM (${driveRefs}) UNION ALL SELECT 1 FROM app_settings WHERE ${pending} LIMIT 1`).first())
      fail(409, "ต้องเชื่อมต่อ Google Drive ก่อนจึงจะลบเอกสารเดิมได้");
    if (!(await db.prepare(`SELECT 1 FROM app_settings WHERE ${pending} LIMIT 1`).first())) {
      await db.batch([
        `INSERT OR IGNORE INTO app_settings(key,value,updated_at)
         SELECT 'round_reset_file:' || id,json_quote(id),unixepoch() FROM (${driveRefs})`,
        "DELETE FROM certificate_files",
        "DELETE FROM event_scores",
        "DELETE FROM event_registration_reviews",
        "DELETE FROM event_students",
        "DELETE FROM event_registrations",
        "DELETE FROM registration_documents",
        "DELETE FROM event_judges",
        "DELETE FROM event_competitions",
        ...trashAfterReset(true),
        `DELETE FROM app_settings WHERE key<>'system_enabled' AND key<>'${PORTAL_KEY}' AND key NOT GLOB 'drive_folder:*' AND key NOT GLOB 'admin_delete_file:*' AND NOT (${pending})`,
        activationSql,
      ].map(sql => db.prepare(sql)));
    }
    const files = (await db.prepare(`SELECT key,value FROM app_settings WHERE ${pending} ORDER BY updated_at,key LIMIT 20`).all()).results;
    if (files.length) {
      const failed = new Set(await deleteFiles(env, files.map(file => JSON.parse(file.value))));
      const deleted = files.filter(file => !failed.has(JSON.parse(file.value)));
      if (deleted.length) await db.batch(deleted.map(file => db.prepare("DELETE FROM app_settings WHERE key=?").bind(file.key)));
    }
    const { remaining } = await db.prepare(`SELECT COUNT(*) AS remaining FROM app_settings WHERE ${pending}`).first();
    return json({ ok: true, remaining });
  }
  if (path === "/api/admin/reset-competition-data" && r.method === "POST") {
    const user = await currentUser(r, db);
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ");
    if (!user.is_superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const b = await body(r);
    if (b.confirm !== "ล้างข้อมูล") fail(400, "กรุณาพิมพ์คำยืนยันให้ถูกต้อง");
    const driveIds = (
      await db
        .prepare(
          "SELECT drive_file_id AS id FROM registration_documents WHERE drive_file_id IS NOT NULL UNION ALL SELECT drive_file_id FROM certificate_files",
        )
        .all()
    ).results.map((x) => x.id);
    await db.batch(
      [
        "DELETE FROM certificate_files",
        "DELETE FROM event_scores",
        "DELETE FROM event_registration_reviews",
        "DELETE FROM event_students",
        "DELETE FROM event_registrations",
        "DELETE FROM registration_documents",
        ...trashAfterReset(false),
      ].map((sql) => db.prepare(sql)),
    );
    if (driveEnabled(env)) await deleteFiles(env, driveIds);
    return json({ ok: true });
  }
  const deleteUser = path.match(/^\/api\/admin\/users\/([a-f0-9-]{36})\/delete$/i);
  if (deleteUser && r.method === "POST") {
    const user = await currentUser(r, db);
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ");
    if (!user.is_superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const id = deleteUser[1].toLowerCase();
    if (id === user.id) fail(400, "ไม่สามารถลบบัญชีของตนเองได้");
    const target = await db
      .prepare("SELECT id,is_superadmin FROM account_users WHERE id=?")
      .bind(id)
      .first();
    if (!target) fail(404, "ไม่พบบัญชี");
    if (target.is_superadmin) fail(400, "ไม่สามารถลบบัญชี superadmin ได้");
    const confirm = (await body(r)).confirm;
    // "ถังขยะ" keeps a restorable copy and the ID images; "ลบถาวร" removes everything now.
    const trash = confirm === TRASH;
    if (!trash && confirm !== "ลบถาวร") fail(400, "กรุณาพิมพ์คำยืนยันให้ถูกต้อง");
    const own = "SELECT id FROM event_registrations WHERE owner_id=?1";
    const snapshot = trash ? await userSnapshot(db, id) : null;
    await db.batch([
      ...(trash
        ? [
            trashEntry(
              db,
              user,
              "user",
              `บัญชี ${snapshot.user.name} · ${snapshot.user.school}`,
              snapshot,
              "SELECT 1 FROM account_users WHERE id=? AND is_superadmin=0",
              id,
            ),
          ]
        : []),
      ...[
        queueFile(`SELECT drive_file_id AS id FROM registration_documents WHERE owner_id=?1 AND ${trash ? 0 : 1}=1
          UNION SELECT drive_file_id FROM certificate_files WHERE unit_key IN
          (SELECT 'student.'||id FROM (${own}) UNION SELECT 'coach.'||id FROM (${own}))
          OR unit_key='judge.'||competition_id||'.'||?1`),
        `DELETE FROM certificate_files WHERE unit_key IN
          (SELECT 'student.'||id FROM (${own}) UNION SELECT 'coach.'||id FROM (${own}))
          OR unit_key='judge.'||competition_id||'.'||?1`,
        `DELETE FROM event_scores WHERE judge_id=?1 OR registration_id IN (${own})`,
        `DELETE FROM event_registration_reviews WHERE registration_id IN (${own})`,
        "UPDATE event_registration_reviews SET reviewer_id=?2 WHERE reviewer_id=?1",
        `DELETE FROM event_students WHERE registration_id IN (${own})`,
        "DELETE FROM event_registrations WHERE owner_id=?1",
        "UPDATE event_registrations SET reviewed_by=?2 WHERE reviewed_by=?1",
        trash
          ? "UPDATE registration_documents SET owner_id=?2 WHERE owner_id=?1"
          : "DELETE FROM registration_documents WHERE owner_id=?1",
        ...(trash ? [] : [dropTrashOf]),
        "DELETE FROM event_judges WHERE judge_id=?1",
        "UPDATE event_judges SET assigned_by=?2 WHERE assigned_by=?1",
        "UPDATE event_competitions SET created_by=?2 WHERE created_by=?1",
        "UPDATE app_settings SET updated_by=NULL WHERE updated_by=?1",
        "UPDATE certificate_files SET created_by=NULL WHERE created_by=?1",
        "DELETE FROM account_sessions WHERE user_id=?1",
        "DELETE FROM account_password_resets WHERE user_id=?1",
        "DELETE FROM account_users WHERE id=?1 AND is_superadmin=0",
      ].map((sql) =>
        db.prepare(sql).bind(...(sql.includes("?2") ? [id, user.id] : [id])),
      ),
    ]);
    return json({ ok: true, remaining: await cleanAdminFiles(env) });
  }
  fail(404, "ไม่พบรายการที่ร้องขอ");
}
export default {
  async fetch(r, env, ctx) {
    let response;
    try {
      const url = new URL(r.url);
      const portal = portalAssetPath(url.pathname);
      let decodedPath = url.pathname;
      try {
        for (let i = 0; i < 3; i++) {
          const next = decodeURIComponent(decodedPath);
          if (next === decodedPath) break;
          decodedPath = next;
        }
      } catch {
        fail(400, "เส้นทางไม่ถูกต้อง");
      }
      const ruleDocument = /\.pdf\/?$/i.test(decodedPath);
      if (ruleDocument) {
        if (!env.DB || !(await currentUser(r, env.DB)))
          fail(401, "กรุณาเข้าสู่ระบบเพื่ออ่านเอกสารเกณฑ์");
        const asset = await env.ASSETS.fetch(r);
        const headers = new Headers(asset.headers);
        headers.set("Cache-Control", "private, no-store");
        headers.set("X-Robots-Tag", "noindex, noarchive");
        response = new Response(asset.body, { status: asset.status, headers });
      } else
        response = url.pathname.startsWith("/api/")
          ? await api(r, env)
          : await env.ASSETS.fetch(portal ? new Request(new URL(portal, url), r) : r);
    } catch (error) {
      response = json(
        {
          error:
            error instanceof ApiError
              ? error.message
              : "ระบบขัดข้อง กรุณาลองใหม่ภายหลัง",
        },
        error instanceof ApiError ? error.status : 500,
      );
    }
    const headers = new Headers(response.headers);
    const cache = response.status === 200 && r.method === "GET" ? staticCache(new URL(r.url).pathname) : null;
    if (cache) headers.set("Cache-Control", cache);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "same-origin");
    headers.set("X-Frame-Options", "DENY");
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    return new Response(response.body, { status: response.status, headers });
  },
};
