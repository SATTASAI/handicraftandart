import { test } from "node:test";
import assert from "node:assert/strict";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile } from "node:fs/promises";
const origin = "https://example.test";
test("real Workers/D1 flow: signup school, authorization, scores, publication, certificates, Resend reset and revocation", async (t) => {
  let emailPayload = null;
  let mailFailure = false;
  let mailCalls = 0;
  const idempotencyKeys = [];
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        { type: "ESModule", path: "server/index.js" },
        { type: "ESModule", path: "server/security.js" },
      ],
      compatibilityDate: "2026-11-02",
      d1Databases: ["DB"],
      bindings: {
        AUTH_SECRET: "local-test-secret-32-characters-minimum",
        SITE_URL: origin,
        MAIL_FROM: "test@example.test",
        RESEND_API_KEY: "test-only-key",
        DEMO_MODE: "true",
      },
      outboundService: async (request) => {
        assert.equal(new URL(request.url).hostname, "api.resend.com");
        emailPayload = await request.json();
        mailCalls++;
        idempotencyKeys.push(request.headers.get("Idempotency-Key"));
        if (mailFailure) return new Response("Unavailable", { status: 503 });
        return new Response(JSON.stringify({ id: "mock-email-id" }), {
          status: 200,
        });
      },
    }),
  );
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  for (const name of [
    "0001_initial.sql",
    "0002_competitions.sql",
    "0003_work_link.sql",
    "0005_applicant_roles.sql",
    "0006_certificate_deliveries.sql",
  ])
    for (const sql of (await readFile("migrations/" + name, "utf8"))
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  async function call(path, data, cookie = "", headers = {}) {
    const r = await mf.dispatchFetch(origin + "/api" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(data === undefined
          ? {}
          : { "Content-Type": "application/json", Origin: origin }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  for (const path of [
    "/competitions",
    "/results",
    "/registrations",
    "/admin/users",
    "/judge/registrations",
  ]) {
    const denied = await call(path);
    assert.equal(denied.status, 401);
    assert(!denied.body.competitions && !denied.body.results);
  }
  assert.equal(
    (await call("/competitions", undefined, "handicraft_session=invalid"))
      .status,
    401,
  );
  assert.equal((await call("/registrations")).status, 401);
  assert.equal(
    (
      await call("/auth/register", {
        email: "bad",
        name: "x",
        school: "x",
        password: "short",
      })
    ).status,
    400,
  );
  for (const applicant_role of [undefined, "admin", ["judge", "coach"]]) {
    const invalid = await call("/auth/register", {
      email: "invalid-role@example.test",
      name: "ครูทดสอบ",
      school: "โรงเรียนทดสอบ",
      password: "valid-test-passphrase",
      applicant_role,
    });
    assert.equal(invalid.status, 400);
  }
  const teacher = await call("/auth/register", {
    email: "teacher@example.test",
    applicant_role: "coach",
    role: "admin",
    name: "ครูตัวอย่าง",
    school: "โรงเรียนทดสอบ",
    password: "teacher-passphrase-123",
  });
  assert.equal(teacher.status, 201);
  assert.equal(teacher.body.user.school, "โรงเรียนทดสอบ");
  assert.equal(teacher.body.user.role, "participant");
  assert.equal(teacher.body.user.applicant_role, "coach");
  assert.equal(
    (
      await db
        .prepare("SELECT applicant_role FROM users WHERE id=?")
        .bind(teacher.body.user.id)
        .first()
    ).applicant_role,
    "coach",
  );
  assert(teacher.cookie);
  const list = await call("/competitions", undefined, teacher.cookie);
  assert.equal(list.status, 200);
  assert.equal(list.body.competitions.length, 6);
  assert.equal(
    (await call("/auth/me", undefined, teacher.cookie)).body.user.school,
    "โรงเรียนทดสอบ",
  );
  assert.equal(
    (await call("/admin/users", undefined, teacher.cookie)).status,
    403,
  );
  assert.equal(
    (
      await call("/auth/login", {
        email: "teacher@example.test",
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call(
        "/registrations",
        {
          competition_id: "painting",
          students: [{ name: "นักเรียนทดสอบ", grade: "ป.1" }],
          coaches: [{ name: "ครูทดสอบ" }],
        },
        teacher.cookie,
      )
    ).status,
    400,
  );
  const reg = await call(
    "/registrations",
    {
      competition_id: "painting",
      school: "โรงเรียนปลอม",
      students: [{ name: "นักเรียนทดสอบ", grade: "ป.5" }],
      coaches: [{ name: "ครูทดสอบ" }],
    },
    teacher.cookie,
  );
  assert.equal(reg.status, 201);
  assert.equal(
    (await call("/registrations", undefined, teacher.cookie)).body
      .registrations[0].school,
    "โรงเรียนทดสอบ",
  );
  assert.equal(
    (await call("/certificates/" + reg.body.id, undefined, teacher.cookie))
      .status,
    409,
  );
  const judge = await call("/auth/register", {
    email: "judge@example.test",
    applicant_role: "judge",
    role: "judge",
    name: "กรรมการทดสอบ",
    school: "โรงเรียนกรรมการ",
    password: "judge-passphrase-123",
  });
  const admin = await call("/auth/register", {
    email: "admin@example.test",
    applicant_role: "coach",
    name: "ผู้จัดทดสอบ",
    school: "โรงเรียนผู้จัด",
    password: "admin-passphrase-123",
  });
  assert.equal(judge.body.user.applicant_role, "judge");
  assert.equal(judge.body.user.role, "participant");
  await db
    .prepare("UPDATE users SET role='admin' WHERE id=?")
    .bind(admin.body.user.id)
    .run();
  const applicantList = await call("/admin/users", undefined, admin.cookie);
  assert.equal(applicantList.status, 200);
  const applicant = applicantList.body.users.find(
    (u) => u.id === judge.body.user.id,
  );
  assert.equal(applicant.applicant_role, "judge");
  assert.equal(applicant.school, "โรงเรียนกรรมการ");
  assert.equal(applicant.email, "judge@example.test");
  assert.equal(typeof applicant.created_at, "number");
  assert(!("password_hash" in applicant));
  assert.equal(
    (
      await call(
        "/admin/role",
        { user_id: judge.body.user.id, role: "judge" },
        admin.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/admin/publish", { competition_id: "painting" }, admin.cookie))
      .status,
    409,
  );
  assert.equal(
    (
      await call(
        "/judge/score",
        { registration_id: reg.body.id, criteria: [40, 30, 20, 10] },
        judge.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/admin/assignment",
        { competition_id: "painting", judge_id: judge.body.user.id },
        admin.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/admin/publish", { competition_id: "painting" }, admin.cookie))
      .status,
    409,
  );
  assert.equal(
    (
      await call(
        "/judge/score",
        { registration_id: reg.body.id, criteria: [41, 30, 20, 10] },
        judge.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/judge/score",
        { registration_id: reg.body.id, criteria: [35, 27, 18, 9] },
        judge.cookie,
      )
    ).body.total,
    89,
  );
  assert.equal(
    (await call("/results", undefined, teacher.cookie)).body.results.length,
    0,
  );
  const progress = await call("/admin/overview", undefined, admin.cookie);
  assert.equal(progress.status, 200);
  const painting = progress.body.competitions.find((c) => c.id === "painting");
  assert.deepEqual(
    [painting.teams, painting.judges, painting.scored],
    [1, 1, 1],
  );
  assert.equal(progress.body.registrations[0].email, "teacher@example.test");
  assert.equal(progress.body.readiness.email, true);
  assert.equal(
    (await call("/admin/overview", undefined, teacher.cookie)).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/admin/certificate-email",
        { registration_id: reg.body.id },
        admin.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (await call("/admin/publish", { competition_id: "painting" }, admin.cookie))
      .status,
    200,
  );
  assert.equal(
    (await call("/admin/publish", { competition_id: "painting" }, admin.cookie))
      .status,
    409,
  );
  assert.equal(
    (
      await call(
        "/admin/certificate-email",
        { registration_id: reg.body.id },
        teacher.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/admin/certificate-email",
        { registration_id: "missing" },
        admin.cookie,
      )
    ).status,
    404,
  );
  mailFailure = true;
  assert.equal(
    (
      await call(
        "/admin/certificate-email",
        { registration_id: reg.body.id },
        admin.cookie,
      )
    ).status,
    502,
  );
  assert.equal(
    (await db.prepare("SELECT status FROM certificate_deliveries").first())
      .status,
    "failed",
  );
  mailFailure = false;
  const emails = await Promise.all(
    [1, 2].map(() =>
      call(
        "/admin/certificate-email",
        { registration_id: reg.body.id },
        admin.cookie,
      ),
    ),
  );
  assert(emails.some((r) => r.status === 200));
  assert(emails.every((r) => [200, 409].includes(r.status)));
  assert.equal(mailCalls, 2); // one failed attempt, one accepted attempt, no duplicate concurrent send
  assert.equal(idempotencyKeys[0], idempotencyKeys[1]);
  assert.equal(emailPayload.to[0], "teacher@example.test");
  assert.match(emailPayload.text, /https:\/\/example.test\/certificates/);
  assert.match(emailPayload.text, /2569/);
  assert.match(emailPayload.text, /ข้อมูลตัวอย่าง/);
  assert.equal(
    (
      await call(
        "/admin/certificate-email",
        { registration_id: reg.body.id },
        admin.cookie,
      )
    ).body.alreadySent,
    true,
  );
  assert.equal(mailCalls, 2);
  assert.equal(
    (await call("/admin/overview", undefined, admin.cookie)).body
      .registrations[0].email_status,
    "sent",
  );
  await db
    .prepare(
      "UPDATE certificate_deliveries SET status='sending',updated_at=?,first_attempt_at=?",
    )
    .bind(1, 1)
    .run();
  assert.equal(
    (
      await call(
        "/admin/certificate-email",
        { registration_id: reg.body.id },
        admin.cookie,
      )
    ).status,
    409,
  );
  assert.equal(mailCalls, 2);
  emailPayload = null;
  assert.equal(
    (await call("/results", undefined, teacher.cookie)).body.results[0].score,
    89,
  );
  const cert = await call(
    "/certificates/" + reg.body.id,
    undefined,
    teacher.cookie,
  );
  assert.equal(cert.status, 200);
  assert.equal(cert.body.certificate.medal, "เหรียญทอง");
  assert.equal(cert.body.certificate.demo, true);
  assert.equal(
    (await call("/certificates/" + reg.body.id, undefined, judge.cookie))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        "/judge/score",
        { registration_id: reg.body.id, criteria: [40, 30, 20, 10] },
        judge.cookie,
      )
    ).status,
    409,
  );
  const missing = await call("/auth/forgot-password", {
    email: "missing@example.test",
  });
  assert.equal(missing.status, 200);
  assert.equal(emailPayload, null);
  const forgot = await call("/auth/forgot-password", {
    email: "teacher@example.test",
  });
  assert.deepEqual(forgot.body, missing.body);
  assert.equal(emailPayload.to[0], "teacher@example.test");
  assert.match(emailPayload.text, /30 นาที/);
  const token = emailPayload.text.match(/#token=([a-f0-9]+)/)[1];
  const stored = await db.prepare("SELECT token_hash FROM resets").first();
  assert.notEqual(stored.token_hash, token);
  const reset = await call("/auth/reset-password", {
    token,
    password: "new-teacher-passphrase",
  });
  assert.equal(reset.status, 200);
  assert.equal(
    (await call("/auth/me", undefined, teacher.cookie)).body.user,
    null,
  );
  assert.equal(
    (
      await call("/auth/reset-password", {
        token,
        password: "another-passphrase",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/auth/login", {
        email: "teacher@example.test",
        password: "teacher-passphrase-123",
      })
    ).status,
    401,
  );
  const newSession = await call("/auth/login", {
    email: "teacher@example.test",
    password: "new-teacher-passphrase",
  });
  assert.equal(newSession.status, 200);
  assert.equal(
    (
      await call("/auth/logout", {}, newSession.cookie, {
        Origin: "https://evil.test",
      })
    ).status,
    403,
  );
  assert.equal((await call("/auth/logout", {}, newSession.cookie)).status, 200);
  assert.equal(
    (await call("/auth/me", undefined, newSession.cookie)).body.user,
    null,
  );
  assert.equal(
    (await call("/competitions", undefined, judge.cookie)).status,
    200,
  );
  await db.prepare("UPDATE sessions SET expires_at=0").run();
  assert.equal(
    (await call("/competitions", undefined, judge.cookie)).status,
    401,
  );
  assert.equal((await call("/results", undefined, judge.cookie)).status, 401);
});
