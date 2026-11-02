import { test } from "node:test";
import assert from "node:assert/strict";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile } from "node:fs/promises";
const origin = "https://example.test";
test("real Workers/D1 flow: signup school, authorization, scores, publication, certificates, Resend reset and revocation", async (t) => {
  let emailPayload = null;
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
  const list = await call("/competitions");
  assert.equal(list.body.competitions.length, 6);
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
  const teacher = await call("/auth/register", {
    email: "teacher@example.test",
    name: "ครูตัวอย่าง",
    school: "โรงเรียนทดสอบ",
    password: "teacher-passphrase-123",
  });
  assert.equal(teacher.status, 201);
  assert.equal(teacher.body.user.school, "โรงเรียนทดสอบ");
  assert.equal(teacher.body.user.role, "participant");
  assert(teacher.cookie);
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
    name: "กรรมการทดสอบ",
    school: "โรงเรียนกรรมการ",
    password: "judge-passphrase-123",
  });
  const admin = await call("/auth/register", {
    email: "admin@example.test",
    name: "ผู้จัดทดสอบ",
    school: "โรงเรียนผู้จัด",
    password: "admin-passphrase-123",
  });
  await db
    .prepare("UPDATE users SET role='admin' WHERE id=?")
    .bind(admin.body.user.id)
    .run();
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
  assert.equal((await call("/results")).body.results.length, 0);
  assert.equal(
    (await call("/admin/publish", { competition_id: "painting" }, admin.cookie))
      .status,
    200,
  );
  assert.equal((await call("/results")).body.results[0].score, 89);
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
});
