import {
  now,
  random,
  digest,
  passwordHash,
  verifyPassword,
  publicUser,
  medal,
  safeText,
  validPassword,
} from "./security.js";
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (s, m) => {
  throw new HttpError(s, m);
};
const json = (v, status = 200, extra = {}) =>
  new Response(JSON.stringify(v), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
async function body(r) {
  if (!r.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "ต้องส่งข้อมูลแบบ JSON");
  const s = await r.text();
  if (s.length > 32000) fail(413, "ข้อมูลมีขนาดใหญ่เกินไป");
  try {
    const parsed = JSON.parse(s);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      fail(400, "ข้อมูลไม่ถูกต้อง");
    return parsed;
  } catch {
    fail(400, "ข้อมูลไม่ถูกต้อง");
  }
}
const emailOf = (v) => safeText(v, 254).toLowerCase();
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
async function throttle(env, key, limit, seconds = 900) {
  const k = await digest(key);
  const t = now();
  const row = await env.DB.prepare(
    "INSERT INTO throttle(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count",
  )
    .bind(k, t + seconds, t, t)
    .first();
  if (row.count > limit) fail(429, "ทำรายการบ่อยเกินไป โปรดลองใหม่ภายหลัง");
}
async function sessionUser(r, env) {
  const token = r.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("handicraft_session="))
    ?.slice(19);
  if (!token) return null;
  return env.DB.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
  )
    .bind(await digest(token), now())
    .first();
}
function cookie(token, request, age = 604800) {
  return `handicraft_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function auth(u, role) {
  if (!u) fail(401, "กรุณาเข้าสู่ระบบ");
  if (role && u.role !== role) fail(403, "ไม่มีสิทธิ์ดำเนินการ");
}
function requireSecret(env) {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32)
    fail(503, "ผู้ดูแลต้องตั้งค่า AUTH_SECRET ก่อนใช้งานระบบบัญชี");
}
async function results(env, competitionId) {
  let q = `SELECT r.id,r.school,r.students,r.coaches,r.competition_id,AVG(s.total) AS score,c.title,c.grade,c.published,r.work_url FROM registrations r JOIN competitions c ON c.id=r.competition_id JOIN scores s ON s.registration_id=r.id WHERE c.published=1 AND r.status='submitted'`;
  const stmt = env.DB.prepare(
    q +
      (competitionId ? " AND c.id=?" : "") +
      " GROUP BY r.id ORDER BY c.title,score DESC",
  );
  const rows = await (competitionId ? stmt.bind(competitionId) : stmt).all();
  return rows.results.map((x) => ({
    ...x,
    students: JSON.parse(x.students),
    coaches: JSON.parse(x.coaches),
    score: Math.round(x.score * 100) / 100,
    medal: medal(Math.round(x.score * 100) / 100),
  }));
}
async function api(r, env) {
  const url = new URL(r.url),
    path = url.pathname,
    method = r.method;
  if (!env.DB) fail(503, "ยังไม่ได้เชื่อมต่อฐานข้อมูล D1");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const origin = r.headers.get("origin");
    if (!origin || origin !== url.origin)
      fail(403, "คำขอไม่ได้มาจากเว็บไซต์นี้");
  }
  if (path === "/api/competitions" && method === "GET")
    return json({
      competitions: (
        await env.DB.prepare("SELECT * FROM competitions ORDER BY rowid").all()
      ).results,
      demo: env.DEMO_MODE !== "false",
    });
  if (path === "/api/auth/me" && method === "GET")
    return json({ user: publicUser(await sessionUser(r, env)) });
  if (path === "/api/results" && method === "GET")
    return json({
      results: await results(env, url.searchParams.get("competition")),
    });
  const ip = r.headers.get("CF-Connecting-IP") || "local";
  if (path === "/api/auth/register" && method === "POST") {
    requireSecret(env);
    await throttle(env, "signup:" + ip, 10, 3600);
    const b = await body(r),
      email = emailOf(b.email),
      name = safeText(b.name, 100),
      school = safeText(b.school, 150);
    if (
      !validEmail(email) ||
      name.length < 2 ||
      school.length < 2 ||
      !validPassword(b.password)
    )
      fail(400, "กรอกชื่อ โรงเรียน อีเมลให้ครบ และใช้รหัสผ่าน 12–128 ตัวอักษร");
    const id = crypto.randomUUID(),
      hash = await passwordHash(b.password, env.AUTH_SECRET);
    try {
      await env.DB.prepare(
        "INSERT INTO users(id,email,name,school,password_hash,created_at) VALUES(?,?,?,?,?,?)",
      )
        .bind(id, email, name, school, hash, now())
        .run();
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        fail(
          409,
          "ไม่สามารถสมัครด้วยอีเมลนี้ได้ หากเคยสมัครแล้วให้ใช้ลืมรหัสผ่าน",
        );
      throw e;
    }
    const token = random();
    await env.DB.prepare("INSERT INTO sessions VALUES(?,?,?)")
      .bind(await digest(token), id, now() + 604800)
      .run();
    return json(
      { user: { id, email, name, school, role: "participant" } },
      201,
      { "Set-Cookie": cookie(token, r) },
    );
  }
  if (path === "/api/auth/login" && method === "POST") {
    requireSecret(env);
    const b = await body(r),
      email = emailOf(b.email);
    await throttle(env, "login:" + ip, 50);
    await throttle(env, "login:" + ip + email, 10);
    if (
      !validEmail(email) ||
      typeof b.password !== "string" ||
      b.password.length > 128
    )
      fail(400, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    const u = await env.DB.prepare("SELECT * FROM users WHERE email=?")
      .bind(email)
      .first();
    const valid = u
      ? await verifyPassword(b.password, u.password_hash, env.AUTH_SECRET)
      : (await passwordHash(b.password, env.AUTH_SECRET, "missing-user-salt"),
        false);
    if (!valid) fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    const token = random();
    await env.DB.prepare("INSERT INTO sessions VALUES(?,?,?)")
      .bind(await digest(token), u.id, now() + 604800)
      .run();
    return json({ user: publicUser(u) }, 200, {
      "Set-Cookie": cookie(token, r),
    });
  }
  if (path === "/api/auth/logout" && method === "POST") {
    const u = await sessionUser(r, env);
    if (u) {
      const token = r.headers
        .get("cookie")
        ?.match(/(?:^|;\s*)handicraft_session=([^;]+)/)?.[1];
      if (token)
        await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
          .bind(await digest(token))
          .run();
    }
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", r, 0) });
  }
  if (path === "/api/auth/forgot-password" && method === "POST") {
    requireSecret(env);
    const b = await body(r),
      email = emailOf(b.email);
    await throttle(env, "forgot:" + ip, 10, 3600);
    await throttle(env, "forgot:" + email, 3, 3600);
    if (!validEmail(email)) fail(400, "กรุณากรอกอีเมลให้ถูกต้อง");
    if (
      !env.RESEND_API_KEY ||
      !env.MAIL_FROM ||
      !env.SITE_URL?.startsWith("https://")
    )
      fail(503, "ผู้ดูแลยังไม่ได้ตั้งค่าอีเมลสำหรับส่งลิงก์รีเซ็ตรหัสผ่าน");
    const u = await env.DB.prepare("SELECT id FROM users WHERE email=?")
      .bind(email)
      .first();
    if (u) {
      const token = random(),
        tokenHash = await digest(token);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM resets WHERE user_id=?").bind(u.id),
        env.DB.prepare("INSERT INTO resets VALUES(?,?,?)").bind(
          tokenHash,
          u.id,
          now() + 1800,
        ),
      ]);
      const link = new URL("/reset-password", env.SITE_URL);
      link.hash = "token=" + token;
      const sent = await fetch("https://api.resend.com/emails", {
        signal: AbortSignal.timeout(10000),
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `reset-${tokenHash}`,
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [email],
          subject: "รีเซ็ตรหัสผ่าน — ศิลปหัตถกรรม",
          text: `เปลี่ยนรหัสผ่านระบบศิลปหัตถกรรมได้ที่\n${link.href}\n\nลิงก์ใช้ได้ครั้งเดียว ภายใน 30 นาที หากไม่ได้ขอเปลี่ยนรหัสผ่าน ให้ข้ามอีเมลนี้`,
        }),
      }).catch(() => null);
      if (!sent?.ok) {
        await env.DB.prepare("DELETE FROM resets WHERE token_hash=?")
          .bind(tokenHash)
          .run();
        console.error("Password reset email delivery failed");
      }
    }
    return json({
      message:
        "หากอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้ โปรดตรวจสอบกล่องจดหมายและสแปม",
    });
  }
  if (path === "/api/auth/reset-password" && method === "POST") {
    requireSecret(env);
    await throttle(env, "reset:" + ip, 10);
    const b = await body(r);
    if (!validPassword(b.password) || !/^[a-f0-9]{64}$/.test(b.token || ""))
      fail(400, "ลิงก์ไม่ถูกต้อง หรือรหัสผ่านต้องมี 12–128 ตัวอักษร");
    const h = await digest(b.token),
      t = now();
    const token = await env.DB.prepare(
      "SELECT user_id FROM resets WHERE token_hash=? AND expires_at>?",
    )
      .bind(h, t)
      .first();
    if (!token) fail(400, "ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่");
    const ph = await passwordHash(b.password, env.AUTH_SECRET);
    const changed = await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET password_hash=? WHERE id=? AND EXISTS(SELECT 1 FROM resets WHERE token_hash=? AND expires_at>?)",
      ).bind(ph, token.user_id, h, t),
      env.DB.prepare(
        "DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM resets WHERE token_hash=? AND expires_at>?)",
      ).bind(token.user_id, h, t),
      env.DB.prepare("DELETE FROM resets WHERE user_id=?").bind(token.user_id),
    ]);
    if (changed[0].meta.changes !== 1) fail(400, "ลิงก์หมดอายุหรือถูกใช้แล้ว");
    return json(
      { message: "เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง" },
      200,
      { "Set-Cookie": cookie("", r, 0) },
    );
  }
  const user = await sessionUser(r, env);
  auth(user);
  if (path === "/api/registrations" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT r.*,c.title,c.grade,c.published FROM registrations r JOIN competitions c ON c.id=r.competition_id WHERE r.user_id=? ORDER BY r.created_at DESC",
    )
      .bind(user.id)
      .all();
    return json({
      registrations: rows.results.map((x) => ({
        ...x,
        students: JSON.parse(x.students),
        coaches: JSON.parse(x.coaches),
      })),
    });
  }
  if (path === "/api/registrations" && method === "POST") {
    const b = await body(r),
      c = await env.DB.prepare("SELECT * FROM competitions WHERE id=?")
        .bind(safeText(b.competition_id))
        .first();
    if (!c) fail(404, "ไม่พบรายการแข่งขัน");
    if (!c.registration_open || c.published)
      fail(409, "ปิดรับสมัครรายการนี้แล้ว");
    const existing = await env.DB.prepare(
      "SELECT * FROM registrations WHERE user_id=? AND competition_id=?",
    )
      .bind(user.id, c.id)
      .first();
    if (existing?.status === "submitted")
      fail(409, "ส่งรายการแล้ว หากต้องการแก้ไขให้ติดต่อผู้จัดงาน");
    const students = Array.isArray(b.students)
      ? b.students.map((s) => ({
          name: safeText(s.name, 100),
          grade: safeText(s.grade, 10),
        }))
      : [];
    const coaches = Array.isArray(b.coaches)
      ? b.coaches.map((s) => ({ name: safeText(s.name, 100) }))
      : [];
    const draft = b.status === "draft";
    if (students.length > c.max_students || coaches.length > c.max_coaches)
      fail(400, "จำนวนผู้เข้าแข่งขันหรือครูเกินกำหนด");
    if (
      !draft &&
      (!students.length ||
        !coaches.length ||
        students.some(
          (s) =>
            s.name.length < 2 ||
            !/^ป\.[1-6]$/.test(s.grade) ||
            (c.grade === "ป.4–6" && Number(s.grade.slice(2)) < 4),
        ) ||
        coaches.some((s) => s.name.length < 2))
    )
      fail(400, "กรอกรายชื่อนักเรียน ระดับชั้น และครูผู้ฝึกซ้อมให้ครบตามเกณฑ์");
    const work = safeText(b.work_url, 1000);
    if (work && (!work.startsWith("https://") || !URL.canParse(work)))
      fail(400, "ลิงก์ผลงานต้องเป็น HTTPS");
    const id = existing?.id || crypto.randomUUID();
    const saved = await env.DB.prepare(
      "INSERT INTO registrations(id,user_id,competition_id,school,students,coaches,status,created_at,work_url) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,competition_id) DO UPDATE SET students=excluded.students,coaches=excluded.coaches,status=excluded.status,work_url=excluded.work_url WHERE registrations.status='draft'",
    )
      .bind(
        id,
        user.id,
        c.id,
        user.school,
        JSON.stringify(students),
        JSON.stringify(coaches),
        draft ? "draft" : "submitted",
        now(),
        work,
      )
      .run();
    if (!saved.meta.changes) fail(409, "รายการนี้ถูกส่งแล้ว ไม่สามารถแก้ไขได้");
    return json(
      { id, message: draft ? "บันทึกฉบับร่างแล้ว" : "ลงทะเบียนสำเร็จ" },
      201,
    );
  }
  if (path === "/api/judge/registrations" && method === "GET") {
    if (!["judge", "admin"].includes(user.role)) fail(403, "เฉพาะกรรมการ");
    const rows = await env.DB.prepare(
      `SELECT r.*,c.title,c.published,s.criteria,s.total,s.comment FROM registrations r JOIN competitions c ON c.id=r.competition_id LEFT JOIN scores s ON s.registration_id=r.id AND s.judge_id=? WHERE r.status='submitted' AND EXISTS(SELECT 1 FROM assignments a WHERE a.competition_id=c.id AND a.judge_id=?) ORDER BY c.title,r.created_at`,
    )
      .bind(user.id, user.id)
      .all();
    return json({
      registrations: rows.results.map((x) => ({
        ...x,
        students: JSON.parse(x.students),
        coaches: JSON.parse(x.coaches),
        criteria: x.criteria ? JSON.parse(x.criteria) : null,
      })),
    });
  }
  if (path === "/api/judge/score" && method === "POST") {
    const b = await body(r);
    const reg = await env.DB.prepare(
      `SELECT r.*,c.published FROM registrations r JOIN competitions c ON c.id=r.competition_id WHERE r.id=? AND r.status='submitted' AND EXISTS(SELECT 1 FROM assignments WHERE competition_id=r.competition_id AND judge_id=?)`,
    )
      .bind(safeText(b.registration_id), user.id)
      .first();
    if (!["judge", "admin"].includes(user.role) || !reg)
      fail(403, "คุณไม่ได้รับมอบหมายรายการนี้");
    if (reg.published) fail(409, "ประกาศผลแล้ว ไม่สามารถแก้คะแนนได้");
    const values = b.criteria,
      max = [40, 30, 20, 10];
    if (
      !Array.isArray(values) ||
      values.length !== 4 ||
      values.some(
        (v, i) =>
          typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max[i],
      )
    )
      fail(400, "คะแนนต้องอยู่ในช่วงที่กำหนด");
    const total = Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
    await env.DB.prepare(
      "INSERT INTO scores VALUES(?,?,?,?,?,?) ON CONFLICT(registration_id,judge_id) DO UPDATE SET criteria=excluded.criteria,total=excluded.total,comment=excluded.comment,created_at=excluded.created_at",
    )
      .bind(
        reg.id,
        user.id,
        JSON.stringify(values),
        total,
        safeText(b.comment, 1000),
        now(),
      )
      .run();
    return json({ message: "บันทึกคะแนนแล้ว", total });
  }
  if (path === "/api/admin/users" && method === "GET") {
    auth(user, "admin");
    return json({
      users: (
        await env.DB.prepare(
          "SELECT id,email,name,school,role FROM users ORDER BY created_at DESC",
        ).all()
      ).results,
      assignments: (await env.DB.prepare("SELECT * FROM assignments").all())
        .results,
    });
  }
  if (path === "/api/admin/role" && method === "POST") {
    auth(user, "admin");
    const b = await body(r);
    if (!["participant", "judge", "admin"].includes(b.role))
      fail(400, "สิทธิ์ไม่ถูกต้อง");
    if (b.user_id === user.id && b.role !== "admin")
      fail(409, "ไม่สามารถลดสิทธิ์ตัวเองได้");
    const target = await env.DB.prepare("SELECT id FROM users WHERE id=?")
      .bind(safeText(b.user_id))
      .first();
    if (!target) fail(404, "ไม่พบบัญชี");
    if (
      b.role === "participant" &&
      (await env.DB.prepare("SELECT 1 FROM assignments WHERE judge_id=?")
        .bind(target.id)
        .first())
    )
      fail(409, "กรุณาถอนการมอบหมายกรรมการก่อนเปลี่ยนสิทธิ์");
    await env.DB.prepare("UPDATE users SET role=? WHERE id=?")
      .bind(b.role, target.id)
      .run();
    return json({ ok: true });
  }
  if (path === "/api/admin/assignment" && method === "POST") {
    auth(user, "admin");
    const b = await body(r),
      c = await env.DB.prepare("SELECT * FROM competitions WHERE id=?")
        .bind(safeText(b.competition_id))
        .first();
    if (!c) fail(404, "ไม่พบรายการ");
    if (c.published) fail(409, "ประกาศผลแล้ว ไม่สามารถเปลี่ยนกรรมการได้");
    const judge = await env.DB.prepare(
      "SELECT id FROM users WHERE id=? AND role IN ('judge','admin')",
    )
      .bind(safeText(b.judge_id))
      .first();
    if (!judge) fail(400, "บัญชีนี้ยังไม่มีสิทธิ์กรรมการ");
    if (b.remove) {
      await env.DB.batch([
        env.DB.prepare(
          "DELETE FROM assignments WHERE competition_id=? AND judge_id=?",
        ).bind(c.id, judge.id),
        env.DB.prepare(
          "DELETE FROM scores WHERE judge_id=? AND registration_id IN(SELECT id FROM registrations WHERE competition_id=?)",
        ).bind(judge.id, c.id),
      ]);
    } else
      await env.DB.prepare("INSERT OR IGNORE INTO assignments VALUES(?,?)")
        .bind(c.id, judge.id)
        .run();
    return json({ ok: true });
  }
  if (path === "/api/admin/competition" && method === "POST") {
    auth(user, "admin");
    const b = await body(r);
    const c = await env.DB.prepare("SELECT * FROM competitions WHERE id=?")
      .bind(safeText(b.id))
      .first();
    if (!c) fail(404, "ไม่พบรายการ");
    if (c.published) fail(409, "ประกาศผลแล้ว ไม่สามารถแก้ไขรายการ");
    const title = safeText(b.title, 150),
      description = safeText(b.description, 5000),
      venue = safeText(b.venue, 200),
      schedule = safeText(b.schedule, 200);
    if (!title || !description || !venue || !schedule)
      fail(400, "กรอกรายละเอียดให้ครบ");
    await env.DB.prepare(
      "UPDATE competitions SET title=?,description=?,venue=?,schedule=?,registration_open=? WHERE id=?",
    )
      .bind(
        title,
        description,
        venue,
        schedule,
        b.registration_open ? 1 : 0,
        c.id,
      )
      .run();
    return json({ ok: true });
  }
  if (path === "/api/admin/publish" && method === "POST") {
    auth(user, "admin");
    const b = await body(r),
      id = safeText(b.competition_id);
    const judges = await env.DB.prepare(
      "SELECT COUNT(*) n FROM assignments WHERE competition_id=?",
    )
      .bind(id)
      .first();
    const regs = await env.DB.prepare(
      "SELECT COUNT(*) n FROM registrations WHERE competition_id=? AND status='submitted'",
    )
      .bind(id)
      .first();
    if (!judges.n || !regs.n) fail(409, "ต้องมีผู้สมัครและกรรมการก่อนประกาศผล");
    const incomplete = await env.DB.prepare(
      `SELECT COUNT(*) n FROM registrations r CROSS JOIN assignments a LEFT JOIN scores s ON s.registration_id=r.id AND s.judge_id=a.judge_id WHERE r.competition_id=? AND a.competition_id=r.competition_id AND r.status='submitted' AND s.registration_id IS NULL`,
    )
      .bind(id)
      .first();
    if (incomplete.n) fail(409, "กรรมการยังให้คะแนนไม่ครบทุกทีม");
    await env.DB.prepare(
      "UPDATE competitions SET published=1,registration_open=0 WHERE id=?",
    )
      .bind(id)
      .run();
    return json({ message: "ประกาศผลแล้ว เปิดดาวน์โหลดประกาศนียบัตร" });
  }
  if (path.startsWith("/api/certificates/") && method === "GET") {
    const id = path.split("/").at(-1);
    const reg = await env.DB.prepare(
      "SELECT r.*,u.name AS teacher_name FROM registrations r JOIN users u ON u.id=r.user_id WHERE r.id=?",
    )
      .bind(id)
      .first();
    if (!reg) fail(404, "ไม่พบรายการ");
    if (reg.user_id !== user.id && user.role !== "admin")
      fail(403, "ไม่มีสิทธิ์ดาวน์โหลด");
    const result = (await results(env, reg.competition_id)).find(
      (x) => x.id === id,
    );
    if (!result) fail(409, "ยังไม่ยืนยันผลการแข่งขัน");
    return json({
      certificate: {
        ...result,
        demo: env.DEMO_MODE !== "false",
        number: `HC-${id.slice(0, 8).toUpperCase()}`,
      },
    });
  }
  fail(404, "ไม่พบหน้าที่ร้องขอ");
}
export default {
  async fetch(request, env) {
    try {
      let response;
      if (new URL(request.url).pathname.startsWith("/api/"))
        response = await api(request, env);
      else response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "no-referrer");
      headers.set("X-Frame-Options", "DENY");
      headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
      );
      headers.set(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      );
      return new Response(response.body, { status: response.status, headers });
    } catch (e) {
      if (!(e instanceof HttpError)) console.error("API request failed");
      return json(
        {
          error:
            e instanceof HttpError
              ? e.message
              : "ระบบขัดข้อง โปรดลองใหม่ภายหลัง",
        },
        e.status || 500,
      );
    }
  },
};
