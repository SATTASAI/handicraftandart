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
const schoolKey = (value) =>
  String(value).normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
const EVENT_TITLE =
  "งานศิลปหัตถกรรม ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง ประจำปีการศึกษา 2569";
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
const DEFAULT_RULES = [
  { label: "คุณภาพผลงาน", max: 40 },
  { label: "ความคิดสร้างสรรค์", max: 30 },
  { label: "กระบวนการทำงาน", max: 20 },
  { label: "การนำเสนอ", max: 10 },
];
function competitionRules(c) {
  return {
    ...c,
    score_rules: c.score_rules ? JSON.parse(c.score_rules) : DEFAULT_RULES,
    policy: c.policy_json ? JSON.parse(c.policy_json) : {},
  };
}
function validateRules(value, total = 100) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 20 ||
    value.some(
      (x) =>
        !x ||
        !safeText(x.label, 150) ||
        typeof x.max !== "number" ||
        !Number.isFinite(x.max) ||
        x.max <= 0 ||
        x.max > 100,
    ) ||
    Math.abs(value.reduce((sum, x) => sum + x.max, 0) - total) > 0.001
  )
    fail(
      400,
      "เกณฑ์ต้องมีชื่อและคะแนนบวก รวมตรงกับคะแนนเต็ม (ไม่เกิน 20 หัวข้อ)",
    );
  return value.map((x) => ({ label: safeText(x.label, 150), max: x.max }));
}
function validatePolicy(value, fallback) {
  if (value === undefined) return fallback;
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(400, "คุณสมบัติรายการไม่ถูกต้อง");
  const p = {
    score_total: 100,
    allowed_judge_counts: [1, 2, 3, 4, 5],
    allowed_grades: ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"],
    ...fallback,
    ...value,
  };
  if (
    !Number.isFinite(p.score_total) ||
    p.score_total <= 0 ||
    p.score_total > 1000
  )
    fail(400, "คะแนนเต็มไม่ถูกต้อง");
  if (
    !Array.isArray(p.allowed_judge_counts) ||
    !p.allowed_judge_counts.length ||
    p.allowed_judge_counts.some((n) => !Number.isInteger(n) || n < 1 || n > 9)
  )
    fail(400, "จำนวนกรรมการต้องอยู่ระหว่าง 1–9 คน");
  p.allowed_judge_counts = [...new Set(p.allowed_judge_counts)].sort(
    (a, b) => a - b,
  );
  if (p.age_min) {
    if (
      !Number.isInteger(p.age_min) ||
      !Number.isInteger(p.age_max) ||
      p.age_min < 7 ||
      p.age_max > 12 ||
      p.age_min > p.age_max
    )
      fail(400, "ช่วงอายุทดสอบต้องอยู่ระหว่าง 7–12 ปี");
    p.allowed_grades = [];
  } else if (
    !Array.isArray(p.allowed_grades) ||
    !p.allowed_grades.length ||
    p.allowed_grades.some((g) => !/^ป\.[1-6]$/.test(g))
  )
    fail(400, "เลือกระดับประถมที่รับสมัคร");
  if (p.gender && !["ชาย", "หญิง"].includes(p.gender))
    fail(400, "ประเภทชาย/หญิงไม่ถูกต้อง");
  if (
    p.division &&
    !["general", "inclusive", "disability", "special"].includes(p.division)
  )
    fail(400, "หมวดสถานศึกษาไม่ถูกต้อง");
  return p;
}
async function results(env, competitionId) {
  let q = `SELECT r.id,r.school,r.students,r.coaches,r.competition_id,AVG(s.total) AS score,c.title,c.grade,c.published,r.work_url,r.decision,c.rules_version FROM registrations r JOIN competitions c ON c.id=r.competition_id LEFT JOIN scores s ON s.registration_id=r.id WHERE c.published=1 AND r.status='submitted'`;
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
    score:
      x.decision === "disqualified" ? null : Math.round(x.score * 100) / 100,
    medal:
      x.decision === "disqualified"
        ? "ไม่มีสิทธิ์รับรางวัล"
        : medal(Math.round(x.score * 100) / 100),
  }));
}
function emailReady(env) {
  try {
    const url = new URL(env.SITE_URL);
    return Boolean(
      env.RESEND_API_KEY &&
      env.MAIL_FROM &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password,
    );
  } catch {
    return false;
  }
}
const eligibleJudges = `SELECT j.id FROM assignments a JOIN users j ON j.id=a.judge_id WHERE a.competition_id=r.competition_id AND j.id<>r.user_id AND j.school_key<>r.school_key`;
const publicationBlocker = `SELECT 1 FROM registrations r WHERE r.competition_id=competitions.id AND r.status='submitted' AND (
  (json_extract(competitions.policy_json,'$.eligibility_confirmation')=1 AND r.eligibility_reviewed=0)
  OR (r.decision='eligible' AND (
    (SELECT COUNT(*) FROM (${eligibleJudges}))=0
    OR (json_type(competitions.policy_json,'$.allowed_judge_counts')='array' AND NOT EXISTS(SELECT 1 FROM json_each(competitions.policy_json,'$.allowed_judge_counts') WHERE value=(SELECT COUNT(*) FROM (${eligibleJudges}))))
    OR EXISTS(SELECT 1 FROM (${eligibleJudges}) j WHERE NOT EXISTS(SELECT 1 FROM scores s WHERE s.registration_id=r.id AND s.judge_id=j.id))
  ))
)`;
async function progressRows(env, id) {
  const query = `SELECT r.id,r.competition_id,r.decision,r.eligibility_reviewed,c.policy_json,
    COUNT(j.id) AS required,COUNT(s.judge_id) AS scored FROM registrations r JOIN competitions c ON c.id=r.competition_id
    LEFT JOIN assignments a ON a.competition_id=r.competition_id
    LEFT JOIN users j ON j.id=a.judge_id AND j.id<>r.user_id AND j.school_key<>r.school_key AND r.decision='eligible'
    LEFT JOIN scores s ON s.registration_id=r.id AND s.judge_id=j.id
    WHERE r.status='submitted' ${id ? "AND r.competition_id=?" : ""} GROUP BY r.id`;
  const stmt = env.DB.prepare(query);
  const rows = (await (id ? stmt.bind(id) : stmt).all()).results;
  return rows.map((r) => {
    const policy = JSON.parse(r.policy_json);
    const reviewed =
      !policy.eligibility_confirmation || !!r.eligibility_reviewed;
    const validJudges =
      r.decision === "disqualified" ||
      (r.required > 0 &&
        (!policy.allowed_judge_counts ||
          policy.allowed_judge_counts.includes(r.required)));
    return {
      ...r,
      ready:
        reviewed &&
        validJudges &&
        (r.decision === "disqualified" || r.scored === r.required),
      reviewed,
      validJudges,
    };
  });
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
  if (path === "/api/health" && method === "GET") {
    await env.DB.prepare("SELECT 1 FROM competitions LIMIT 1").first();
    await env.DB.prepare("SELECT applicant_role FROM users LIMIT 1").first();
    await env.DB.prepare(
      "SELECT policy_json FROM competitions LIMIT 1",
    ).first();
    await env.DB.prepare(
      "SELECT eligibility_reviewed FROM registrations LIMIT 1",
    ).first();
    await env.DB.prepare("SELECT deduction FROM scores LIMIT 1").first();
    const setup = await env.DB.prepare(
      "SELECT 1 AS ready FROM system_setup s JOIN users u ON u.id = s.user_id WHERE s.key = 'initial_admin' AND u.role = 'admin' LIMIT 1",
    ).first();
    return json({
      ok: true,
      adminSetupComplete: Boolean(setup),
      release: "primary-criteria-2568-trial",
    });
  }
  if (path === "/api/competitions" && method === "GET") {
    auth(await sessionUser(r, env));
    return json({
      competitions: (
        await env.DB.prepare("SELECT * FROM competitions ORDER BY rowid").all()
      ).results.map(competitionRules),
      demo: env.DEMO_MODE !== "false",
    });
  }
  if (path === "/api/auth/me" && method === "GET")
    return json({ user: publicUser(await sessionUser(r, env)) });
  if (path === "/api/results" && method === "GET") {
    auth(await sessionUser(r, env));
    return json({
      results: await results(env, url.searchParams.get("competition")),
    });
  }
  const ip = r.headers.get("CF-Connecting-IP") || "local";
  if (path === "/api/auth/register" && method === "POST") {
    requireSecret(env);
    await throttle(env, "signup:" + ip, 10, 3600);
    const b = await body(r),
      email = emailOf(b.email),
      name = safeText(b.name, 100),
      school = safeText(b.school, 150),
      applicantRole = b.applicant_role;
    if (
      !validEmail(email) ||
      name.length < 2 ||
      school.length < 2 ||
      !validPassword(b.password)
    )
      fail(400, "กรอกชื่อ โรงเรียน อีเมลให้ครบ และใช้รหัสผ่าน 12–128 ตัวอักษร");
    if (!["judge", "coach"].includes(applicantRole))
      fail(400, "กรุณาเลือกสมัครเป็นกรรมการหรือผู้ฝึกซ้อมอย่างใดอย่างหนึ่ง");
    const id = crypto.randomUUID(),
      hash = await passwordHash(b.password, env.AUTH_SECRET);
    try {
      await env.DB.prepare(
        "INSERT INTO users(id,email,name,school,password_hash,applicant_role,created_at,school_key) VALUES(?,?,?,?,?,?,?,?)",
      )
        .bind(
          id,
          email,
          name,
          school,
          hash,
          applicantRole,
          now(),
          schoolKey(school),
        )
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
      {
        user: publicUser({
          id,
          email,
          name,
          school,
          applicant_role: applicantRole,
          role: "participant",
        }),
      },
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
    const policy = competitionRules(c).policy;
    const students = Array.isArray(b.students)
      ? b.students.map((s) => ({
          name: safeText(s?.name, 100),
          grade: safeText(s?.grade, 10),
          ...(policy.age_min ? { age: Number(s?.age) } : {}),
          ...(policy.gender || policy.mixed_gender_pair
            ? { gender: safeText(s?.gender, 10) }
            : {}),
        }))
      : [];
    const coaches = Array.isArray(b.coaches)
      ? b.coaches.map((s) => ({ name: safeText(s?.name, 100) }))
      : [];
    const draft = b.status === "draft";
    if (students.length > c.max_students || coaches.length > c.max_coaches)
      fail(400, "จำนวนผู้เข้าแข่งขันหรือครูเกินกำหนด");
    if (
      !draft &&
      (students.length < (c.min_students || 1) ||
        coaches.length < (policy.min_coaches || 1) ||
        students.some(
          (s) =>
            s.name.length < 2 ||
            (policy.age_min
              ? !Number.isInteger(s.age) ||
                s.age < policy.age_min ||
                s.age > policy.age_max
              : !(
                  policy.allowed_grades ||
                  (c.grade === "ป.4–6"
                    ? ["ป.4", "ป.5", "ป.6"]
                    : ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"])
                ).includes(s.grade)) ||
            (policy.gender && s.gender !== policy.gender) ||
            (policy.mixed_gender_pair && !["ชาย", "หญิง"].includes(s.gender)),
        ) ||
        coaches.some((s) => s.name.length < 2))
    )
      fail(400, "กรอกรายชื่อนักเรียน ระดับชั้น และครูผู้ฝึกซ้อมให้ครบตามเกณฑ์");
    if (
      !draft &&
      policy.mixed_gender_pair &&
      (students.filter((x) => x.gender === "ชาย").length !== 1 ||
        students.filter((x) => x.gender === "หญิง").length !== 1)
    )
      fail(400, "รายการนี้ต้องเป็นคู่ชาย–หญิง");
    if (
      !draft &&
      policy.eligibility_confirmation &&
      b.eligibility_confirmed !== true
    )
      fail(400, "กรุณายืนยันคุณสมบัติและเตรียมเอกสารตามเกณฑ์");
    const work = safeText(b.work_url, 1000);
    if (!draft && policy.work_required && !work)
      fail(400, "รายการนี้ต้องแนบลิงก์ผลงาน");
    if (work && (!work.startsWith("https://") || !URL.canParse(work)))
      fail(400, "ลิงก์ผลงานต้องเป็น HTTPS");
    const id = existing?.id || crypto.randomUUID();
    const saved = await env.DB.prepare(
      "INSERT INTO registrations(id,user_id,competition_id,school,students,coaches,status,created_at,work_url,school_key,eligibility_confirmed) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM competitions WHERE id=? AND registration_open=1 AND published=0 AND COALESCE(score_rules,'')=? AND policy_json=? AND min_students=? AND max_students=? AND max_coaches=?) AND NOT EXISTS(SELECT 1 FROM registrations WHERE competition_id=? AND school_key=? AND status='submitted' AND id<>?) ON CONFLICT(user_id,competition_id) DO UPDATE SET students=excluded.students,coaches=excluded.coaches,status=excluded.status,work_url=excluded.work_url,eligibility_confirmed=excluded.eligibility_confirmed WHERE registrations.status='draft'",
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
        schoolKey(user.school),
        b.eligibility_confirmed === true ? 1 : 0,
        c.id,
        c.score_rules || "",
        c.policy_json,
        c.min_students,
        c.max_students,
        c.max_coaches,
        c.id,
        schoolKey(user.school),
        id,
      )
      .run();
    if (!saved.meta.changes)
      fail(
        409,
        "รายการนี้ถูกส่งแล้ว โรงเรียนสมัครซ้ำ หรือเกณฑ์เปลี่ยน กรุณาตรวจสอบใหม่",
      );
    return json(
      { id, message: draft ? "บันทึกฉบับร่างแล้ว" : "ลงทะเบียนสำเร็จ" },
      201,
    );
  }
  if (path === "/api/judge/registrations" && method === "GET") {
    if (!["judge", "admin"].includes(user.role)) fail(403, "เฉพาะกรรมการ");
    const rows = await env.DB.prepare(
      `SELECT r.*,c.title,c.published,c.score_rules,c.policy_json,c.rules_version,c.rules_source_url,s.criteria,s.total,s.comment,s.deduction,s.deduction_reason FROM registrations r JOIN competitions c ON c.id=r.competition_id LEFT JOIN scores s ON s.registration_id=r.id AND s.judge_id=? WHERE r.status='submitted' AND r.decision='eligible' AND r.user_id<>? AND r.school_key<>? AND EXISTS(SELECT 1 FROM assignments a WHERE a.competition_id=c.id AND a.judge_id=?) ORDER BY c.title,r.created_at`,
    )
      .bind(user.id, user.id, schoolKey(user.school), user.id)
      .all();
    return json({
      registrations: rows.results.map((x) => ({
        ...x,
        students: JSON.parse(x.students),
        coaches: JSON.parse(x.coaches),
        criteria: x.criteria ? JSON.parse(x.criteria) : null,
        score_rules: competitionRules(x).score_rules,
        policy: competitionRules(x).policy,
      })),
    });
  }
  if (path === "/api/judge/score" && method === "POST") {
    const b = await body(r);
    const reg = await env.DB.prepare(
      `SELECT r.*,c.published,c.score_rules,c.policy_json FROM registrations r JOIN competitions c ON c.id=r.competition_id WHERE r.id=? AND r.status='submitted' AND r.decision='eligible' AND r.user_id<>? AND r.school_key<>? AND EXISTS(SELECT 1 FROM assignments WHERE competition_id=r.competition_id AND judge_id=?)`,
    )
      .bind(
        safeText(b.registration_id),
        user.id,
        schoolKey(user.school),
        user.id,
      )
      .first();
    if (!["judge", "admin"].includes(user.role) || !reg)
      fail(403, "คุณไม่ได้รับมอบหมายรายการนี้");
    if (reg.published) fail(409, "ประกาศผลแล้ว ไม่สามารถแก้คะแนนได้");
    const values = b.criteria,
      max = competitionRules(reg).score_rules.map((x) => x.max);
    if (
      !Array.isArray(values) ||
      values.length !== max.length ||
      values.some(
        (v, i) =>
          typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max[i],
      )
    )
      fail(400, "คะแนนต้องอยู่ในช่วงที่กำหนด");
    const rawMax = max.reduce((a, b) => a + b, 0),
      deduction = b.deduction === undefined ? 0 : b.deduction;
    const deductionReason = safeText(b.deduction_reason, 1000);
    if (
      typeof deduction !== "number" ||
      !Number.isFinite(deduction) ||
      deduction < 0 ||
      deduction > rawMax ||
      (deduction > 0 && !deductionReason)
    )
      fail(400, "คะแนนหักต้องอยู่ในช่วงคะแนนเต็มและระบุเหตุผลตามข้อกำหนด");
    const total =
      Math.round(
        (Math.max(0, values.reduce((a, b) => a + b, 0) - deduction) / rawMax) *
          10000,
      ) / 100;
    const scored = await env.DB.prepare(
      `INSERT INTO scores(registration_id,judge_id,criteria,total,comment,created_at,deduction,deduction_reason) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM registrations r JOIN competitions c ON c.id=r.competition_id JOIN assignments a ON a.competition_id=c.id WHERE r.id=? AND a.judge_id=? AND c.published=0 AND r.status='submitted' AND r.decision='eligible' AND r.user_id<>a.judge_id AND r.school_key<>(SELECT school_key FROM users WHERE id=a.judge_id)) ON CONFLICT(registration_id,judge_id) DO UPDATE SET criteria=excluded.criteria,total=excluded.total,comment=excluded.comment,created_at=excluded.created_at,deduction=excluded.deduction,deduction_reason=excluded.deduction_reason`,
    )
      .bind(
        reg.id,
        user.id,
        JSON.stringify(values),
        total,
        safeText(b.comment, 1000),
        now(),
        deduction,
        deductionReason,
        reg.id,
        user.id,
      )
      .run();
    if (!scored.meta.changes)
      fail(409, "ประกาศผลแล้วหรือการมอบหมายเปลี่ยน กรุณาตรวจสอบใหม่");
    return json({ message: "บันทึกคะแนนแล้ว", total });
  }
  if (path === "/api/admin/users" && method === "GET") {
    auth(user, "admin");
    return json({
      users: (
        await env.DB.prepare(
          "SELECT id,email,name,school,applicant_role,role,created_at FROM users ORDER BY created_at DESC",
        ).all()
      ).results,
      assignments: (await env.DB.prepare("SELECT * FROM assignments").all())
        .results,
    });
  }
  if (path === "/api/admin/overview" && method === "GET") {
    auth(user, "admin");
    const competitions = (
      await env.DB.prepare(
        `SELECT c.*,
      (SELECT COUNT(*) FROM registrations r WHERE r.competition_id=c.id AND r.status='submitted') AS teams,
      (SELECT COUNT(*) FROM assignments a WHERE a.competition_id=c.id) AS judges,
      (SELECT COUNT(*) FROM scores s JOIN registrations r ON r.id=s.registration_id JOIN assignments a ON a.judge_id=s.judge_id AND a.competition_id=r.competition_id WHERE r.competition_id=c.id AND r.status='submitted') AS scored
      FROM competitions c ORDER BY c.rowid`,
      ).all()
    ).results;
    const registrations = (
      await env.DB.prepare(
        `SELECT r.id,r.competition_id,r.school,r.students,r.coaches,r.status,r.created_at,r.decision,r.decision_note,r.eligibility_reviewed,
      u.name AS contact_name,u.email,c.title,c.published,
      d.status AS email_status,d.sent_at,d.last_error
      FROM registrations r JOIN users u ON u.id=r.user_id JOIN competitions c ON c.id=r.competition_id
      LEFT JOIN certificate_deliveries d ON d.registration_id=r.id ORDER BY r.created_at DESC`,
      ).all()
    ).results;
    const progress = await progressRows(env);
    return json({
      competitions: competitions.map((c) => {
        const rows = progress.filter((r) => r.competition_id === c.id);
        return {
          ...competitionRules(c),
          required: rows.reduce((n, r) => n + r.required, 0),
          scored: rows.reduce((n, r) => n + r.scored, 0),
          ready: rows.length > 0 && rows.every((r) => r.ready),
          unreviewed: rows.filter((r) => !r.reviewed).length,
          invalid_judges: rows.filter((r) => !r.validJudges).length,
        };
      }),
      registrations: registrations.map((r) => ({
        ...r,
        students: JSON.parse(r.students),
        coaches: JSON.parse(r.coaches),
      })),
      readiness: {
        demo: env.DEMO_MODE !== "false",
        auth: Boolean(env.AUTH_SECRET?.length >= 32),
        email: emailReady(env),
      },
    });
  }
  if (path === "/api/admin/certificate-email" && method === "POST") {
    auth(user, "admin");
    if (!emailReady(env))
      fail(
        503,
        "กรุณาตั้งค่า Resend, MAIL_FROM และ SITE_URL แบบ HTTPS ก่อนส่งอีเมล",
      );
    const b = await body(r);
    const reg = await env.DB.prepare(
      `SELECT r.id,r.competition_id,u.email,u.name,c.title,c.published
      FROM registrations r JOIN users u ON u.id=r.user_id JOIN competitions c ON c.id=r.competition_id
      WHERE r.id=? AND r.status='submitted'`,
    )
      .bind(safeText(b.registration_id))
      .first();
    if (!reg) fail(404, "ไม่พบรายการลงทะเบียนที่ยืนยันแล้ว");
    if (!reg.published) fail(409, "ต้องประกาศผลก่อนส่งประกาศนียบัตร");
    const decision = await env.DB.prepare(
      "SELECT decision FROM registrations WHERE id=?",
    )
      .bind(reg.id)
      .first();
    if (decision.decision === "disqualified")
      fail(409, "รายการนี้ไม่มีสิทธิ์รับประกาศนียบัตร");
    const t = now();
    // A stable provider key and a short lease prevent duplicate concurrent sends.
    await env.DB.prepare(
      `INSERT OR IGNORE INTO certificate_deliveries(registration_id,status,first_attempt_at,updated_at) VALUES(?,'pending',?,?)`,
    )
      .bind(reg.id, t, t)
      .run();
    const delivery = await env.DB.prepare(
      "SELECT * FROM certificate_deliveries WHERE registration_id=?",
    )
      .bind(reg.id)
      .first();
    if (delivery.status === "sent")
      return json({ message: "ส่งอีเมลรายการนี้แล้ว", alreadySent: true });
    // Resend retains idempotency keys for 24h. Never retry an ambiguous request outside that window.
    if (t - delivery.first_attempt_at >= 82800)
      fail(
        409,
        "เกินช่วงส่งซ้ำอย่างปลอดภัย กรุณาตรวจประวัติใน Resend และติดต่อผู้รับโดยตรง",
      );
    const lock = await env.DB.prepare(
      `UPDATE certificate_deliveries SET status='sending',updated_at=?,last_error='' WHERE registration_id=? AND (status IN ('pending','failed') OR (status='sending' AND updated_at<?))`,
    )
      .bind(t, reg.id, t - 90)
      .run();
    if (!lock.meta.changes) fail(409, "กำลังส่งอีเมลรายการนี้ กรุณารอสักครู่");
    const link = new URL("/certificates", env.SITE_URL).href;
    let sent;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `certificate-${reg.id}`,
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [reg.email],
          subject: "ประกาศนียบัตรการแข่งขันศิลปหัตถกรรม",
          text: `เรียน ${reg.name}\n\n${EVENT_TITLE}\nประกาศผลรายการ ${reg.title} แล้ว\nดาวน์โหลดประกาศนียบัตร PDF ของนักเรียนและครูผู้ฝึกซ้อมได้ที่\n${link}\n\nกรุณาเข้าสู่ระบบด้วยบัญชีที่ใช้ลงทะเบียน เพื่อปกป้องข้อมูลผู้เข้าแข่งขัน${env.DEMO_MODE !== "false" ? "\nข้อมูลตัวอย่าง — ยังไม่ใช่ประกาศนียบัตรทางการ" : ""}`,
        }),
      });
      if (response.ok) sent = await response.json();
    } catch {}
    if (!sent?.id) {
      await env.DB.prepare(
        "UPDATE certificate_deliveries SET status='failed',last_error=?,updated_at=? WHERE registration_id=?",
      )
        .bind(
          "ยังยืนยันการส่งไม่ได้ ตรวจ Resend หรือกดลองใหม่ภายใน 23 ชั่วโมง",
          now(),
          reg.id,
        )
        .run();
      fail(
        502,
        "ยังยืนยันการส่งอีเมลไม่ได้ สามารถลองใหม่โดยไม่ส่งซ้ำภายใน 23 ชั่วโมง",
      );
    }
    await env.DB.prepare(
      "UPDATE certificate_deliveries SET status='sent',provider_id=?,sent_at=?,updated_at=?,last_error='' WHERE registration_id=?",
    )
      .bind(sent.id, now(), now(), reg.id)
      .run();
    return json({ message: "ส่งลิงก์ดาวน์โหลดประกาศนียบัตรทางอีเมลแล้ว" });
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
          "DELETE FROM assignments WHERE competition_id=? AND judge_id=? AND EXISTS(SELECT 1 FROM competitions WHERE id=assignments.competition_id AND published=0)",
        ).bind(c.id, judge.id),
        env.DB.prepare(
          "DELETE FROM scores WHERE judge_id=? AND registration_id IN(SELECT r.id FROM registrations r JOIN competitions c ON c.id=r.competition_id WHERE c.id=? AND c.published=0)",
        ).bind(judge.id, c.id),
      ]);
    } else
      await env.DB.prepare(
        "INSERT OR IGNORE INTO assignments SELECT ?,? WHERE EXISTS(SELECT 1 FROM competitions WHERE id=? AND published=0)",
      )
        .bind(c.id, judge.id, c.id)
        .run();
    return json({ ok: true });
  }
  if (path === "/api/admin/competition-copy" && method === "POST") {
    auth(user, "admin");
    const b = await body(r);
    const source = await env.DB.prepare("SELECT * FROM competitions WHERE id=?")
      .bind(safeText(b.id))
      .first();
    if (!source) fail(404, "ไม่พบรายการต้นฉบับ");
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO competitions(id,title,category,grade,cover,description,venue,schedule,max_students,max_coaches,registration_open,published,min_students,score_rules,rules_source_url,rules_version,policy_json) VALUES(?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?)`,
    )
      .bind(
        id,
        source.title + " (ฉบับใหม่)",
        source.category,
        source.grade,
        source.cover,
        source.description,
        "รอประกาศ",
        "รอประกาศ",
        source.max_students,
        source.max_coaches,
        source.min_students,
        source.score_rules,
        source.rules_source_url,
        source.rules_version,
        source.policy_json,
      )
      .run();
    return json(
      {
        id,
        message: "สร้างรายการฉบับใหม่แล้ว ยังปิดรับสมัครจนกว่าผู้จัดตรวจเกณฑ์",
      },
      201,
    );
  }
  if (path === "/api/admin/decision" && method === "POST") {
    auth(user, "admin");
    const b = await body(r),
      note = safeText(b.note, 1000);
    if (
      !["eligible", "disqualified"].includes(b.decision) ||
      (b.decision === "disqualified" && note.length < 2)
    )
      fail(400, "กรุณาระบุผลตรวจและเหตุผล");
    const changed = await env.DB.prepare(
      `UPDATE registrations SET decision=?,decision_note=?,eligibility_reviewed=1 WHERE id=? AND status='submitted' AND EXISTS(SELECT 1 FROM competitions WHERE id=registrations.competition_id AND published=0)`,
    )
      .bind(b.decision, note, safeText(b.registration_id))
      .run();
    if (!changed.meta.changes) fail(409, "รายการไม่พบหรือประกาศผลแล้ว");
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
    const policy = validatePolicy(b.policy, competitionRules(c).policy);
    const rules = validateRules(
      b.score_rules === undefined
        ? competitionRules(c).score_rules
        : b.score_rules,
      policy.score_total || 100,
    );
    const source =
      b.rules_source_url === undefined
        ? c.rules_source_url
        : safeText(b.rules_source_url, 1000);
    if (
      source &&
      (!URL.canParse(source) ||
        new URL(source).protocol !== "https:" ||
        new URL(source).username ||
        new URL(source).password)
    )
      fail(400, "ลิงก์เกณฑ์ต้องเป็น HTTPS");
    const version =
      b.rules_version === undefined
        ? c.rules_version
        : safeText(b.rules_version, 200);
    const min =
      b.min_students === undefined ? c.min_students : Number(b.min_students);
    const maxStudents =
      b.max_students === undefined ? c.max_students : Number(b.max_students);
    const maxCoaches =
      b.max_coaches === undefined ? c.max_coaches : Number(b.max_coaches);
    if (
      ![min, maxStudents, maxCoaches].every(
        (x) => Number.isInteger(x) && x >= 1 && x <= 100,
      ) ||
      min > maxStudents ||
      !Number.isInteger(policy.min_coaches || 1) ||
      (policy.min_coaches || 1) < 1 ||
      (policy.min_coaches || 1) > maxCoaches ||
      !version
    )
      fail(400, "ตรวจสอบจำนวนคนและชื่อรุ่นเกณฑ์");
    const changed =
      JSON.stringify(policy) !== JSON.stringify(competitionRules(c).policy) ||
      JSON.stringify(rules) !==
        JSON.stringify(competitionRules(c).score_rules) ||
      min !== c.min_students ||
      maxStudents !== c.max_students ||
      maxCoaches !== c.max_coaches ||
      source !== c.rules_source_url ||
      version !== c.rules_version;
    const updated = await env.DB.prepare(
      `UPDATE competitions SET title=?,description=?,venue=?,schedule=?,registration_open=?,score_rules=?,rules_source_url=?,rules_version=?,min_students=?,max_students=?,max_coaches=?,policy_json=?,grade=? WHERE id=? AND published=0 AND (?=0 OR NOT EXISTS(SELECT 1 FROM registrations WHERE competition_id=? AND status='submitted'))`,
    )
      .bind(
        title,
        description,
        venue,
        schedule,
        b.registration_open ? 1 : 0,
        JSON.stringify(rules),
        source,
        version,
        min,
        maxStudents,
        maxCoaches,
        JSON.stringify(policy),
        b.policy
          ? policy.age_min
            ? `อายุ ${policy.age_min}–${policy.age_max} ปี`
            : policy.allowed_grades.join(", ")
          : c.grade,
        c.id,
        changed ? 1 : 0,
        c.id,
      )
      .run();
    if (!updated.meta.changes)
      fail(
        409,
        "มีการยืนยันสมัครแล้วหรือประกาศผลแล้ว ไม่สามารถเปลี่ยนเกณฑ์และจำนวนคน ให้สร้างรายการแยกสำหรับเกณฑ์ใหม่",
      );
    return json({ ok: true });
  }
  if (path === "/api/admin/publish" && method === "POST") {
    auth(user, "admin");
    const b = await body(r),
      id = safeText(b.competition_id);
    const progress = await progressRows(env, id);
    if (!progress.length) fail(409, "ต้องมีทีมที่ยืนยันสมัครก่อนประกาศผล");
    if (progress.some((r) => !r.reviewed))
      fail(409, "ผู้จัดยังตรวจคุณสมบัติไม่ครบทุกทีม");
    if (progress.some((r) => !r.validJudges))
      fail(
        409,
        "จำนวนกรรมการที่ไม่มีส่วนได้เสียไม่ตรงเกณฑ์ กรุณาตรวจการมอบหมายและโรงเรียน",
      );
    if (progress.some((r) => !r.ready))
      fail(409, "กรรมการยังให้คะแนนไม่ครบทุกทีม");
    const published = await env.DB.prepare(
      `UPDATE competitions SET published=1,registration_open=0 WHERE id=? AND published=0 AND EXISTS(SELECT 1 FROM registrations WHERE competition_id=competitions.id AND status='submitted') AND NOT EXISTS(${publicationBlocker})`,
    )
      .bind(id)
      .run();
    if (!published.meta.changes)
      fail(409, "ประกาศผลแล้ว หรือข้อมูลเปลี่ยน กรุณาตรวจสอบใหม่");
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
    if (reg.decision === "disqualified")
      fail(409, "รายการนี้ไม่มีสิทธิ์รับประกาศนียบัตร");
    return json({
      certificate: {
        ...result,
        event_title: EVENT_TITLE,
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
