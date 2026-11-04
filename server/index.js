import { registrationsApi } from "./registrations.js";
import { judgingApi } from "./judging.js";
import { sendEmail, passwordResetEmail } from "./mail.js";
import {
  now,
  random,
  digest,
  hashPassword,
  verifyPassword,
  publicUser,
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
async function currentUser(r, db) {
  const token = (r.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName(r) + "="))
    ?.slice(cookieName(r).length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db
    .prepare(
      "SELECT u.* FROM account_sessions s JOIN account_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    )
    .bind(await digest(token), now())
    .first();
}
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
    });
  if (path === "/api/me" && r.method === "GET")
    return json({ user: publicUser(await currentUser(r, db)) });
  if (path === "/api/signup" && r.method === "POST") {
    // Schools share one public IP on network Wi-Fi; keep per-IP limits generous.
    await limit(db, r, "signup", 60, 3600);
    const b = await body(r);
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
      token = random();
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
        db
          .prepare(
            "INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
          )
          .bind(await digest(token), id, t + 604800),
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
    const user = await db
      .prepare("SELECT * FROM account_users WHERE email=?")
      .bind(email)
      .first();
    const valid = await verifyPassword(
      b.password,
      user?.password_hash ||
        "pbkdf2-sha256$100000$" + "0".repeat(64) + "$" + "0".repeat(64),
    );
    if (!user || !valid) fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    const token = random();
    await db
      .prepare("INSERT INTO account_sessions VALUES(?,?,?)")
      .bind(await digest(token), user.id, now() + 604800)
      .run();
    return json({ user: publicUser(user) }, 200, {
      "Set-Cookie": sessionCookie(r, token),
    });
  }
  if (path === "/api/password/forgot" && r.method === "POST") {
    await limit(db, r, "password-forgot", 30, 3600);
    const b = await body(r),
      email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, "กรุณากรอกอีเมลให้ถูกต้อง");
    if (!env.RESEND_API_KEY) fail(503, "ระบบส่งอีเมลยังไม่พร้อมใช้งาน");
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
    const token = (r.headers.get("cookie") || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName(r) + "="))
      ?.slice(cookieName(r).length + 1);
    if (token)
      await db
        .prepare("DELETE FROM account_sessions WHERE token_hash=?")
        .bind(await digest(token))
        .run();
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(r, "", 0) });
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
  if (path === "/api/admin/reset-competition-data" && r.method === "POST") {
    const user = await currentUser(r, db);
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ");
    if (!user.is_superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const b = await body(r);
    if (b.confirm !== "ล้างข้อมูล") fail(400, "กรุณาพิมพ์คำยืนยันให้ถูกต้อง");
    await db.batch(
      [
        "DELETE FROM event_scores",
        "DELETE FROM event_registration_reviews",
        "DELETE FROM event_students",
        "DELETE FROM event_registrations",
        "DELETE FROM registration_documents",
      ].map((sql) => db.prepare(sql)),
    );
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
    const own = "SELECT id FROM event_registrations WHERE owner_id=?1";
    await db.batch(
      [
        `DELETE FROM event_scores WHERE judge_id=?1 OR registration_id IN (${own})`,
        `DELETE FROM event_registration_reviews WHERE registration_id IN (${own})`,
        "UPDATE event_registration_reviews SET reviewer_id=?2 WHERE reviewer_id=?1",
        `DELETE FROM event_students WHERE registration_id IN (${own})`,
        "DELETE FROM event_registrations WHERE owner_id=?1",
        "UPDATE event_registrations SET reviewed_by=?2 WHERE reviewed_by=?1",
        "DELETE FROM registration_documents WHERE owner_id=?1",
        "DELETE FROM event_judges WHERE judge_id=?1",
        "UPDATE event_judges SET assigned_by=?2 WHERE assigned_by=?1",
        "UPDATE event_competitions SET created_by=?2 WHERE created_by=?1",
        "UPDATE app_settings SET updated_by=NULL WHERE updated_by=?1",
        "DELETE FROM account_sessions WHERE user_id=?1",
        "DELETE FROM account_password_resets WHERE user_id=?1",
        "DELETE FROM account_users WHERE id=?1 AND is_superadmin=0",
      ].map((sql) =>
        db.prepare(sql).bind(...(sql.includes("?2") ? [id, user.id] : [id])),
      ),
    );
    return json({ ok: true });
  }
  fail(404, "ไม่พบรายการที่ร้องขอ");
}
export default {
  async fetch(r, env, ctx) {
    let response;
    try {
      let decodedPath = new URL(r.url).pathname;
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
        response = new URL(r.url).pathname.startsWith("/api/")
          ? await api(r, env)
          : await env.ASSETS.fetch(r);
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
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "same-origin");
    headers.set("X-Frame-Options", "DENY");
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    return new Response(response.body, { status: response.status, headers });
  },
};
