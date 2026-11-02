import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { now, digest } from "../server/security.js";
const origin = "https://example.test";
test("verified workflow: private identity, approval, separate deadlines, whole-competition conflict, immutable final scores, automatic ranking and certificates", async (t) => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        { type: "ESModule", path: "server/index.js" },
        { type: "ESModule", path: "server/security.js" },
      ],
      compatibilityDate: "2026-11-02",
      d1Databases: ["DB"],
      bindings: {
        AUTH_SECRET: "test-only-workflow-secret-more-than-32",
        DEMO_MODE: "true",
      },
    }),
  );
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  for (const f of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const statements = (await readFile("migrations/" + f, "utf8"))
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = 0; i < statements.length; i += 25)
      await db.batch(statements.slice(i, i + 25).map((s) => db.prepare(s)));
  }
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKD0AAAAASUVORK5CYII=",
    "base64",
  );
  async function call(path, data, cookie = "") {
    const r = await mf.dispatchFetch(origin + "/api" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        ...(data === undefined
          ? {}
          : { Origin: origin, "Content-Type": "application/json" }),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function signup(id, school, role) {
    return call("/auth/register", {
      email: id + "@example.test",
      name: "ชื่อ " + id,
      school,
      applicant_role: role,
      password: "valid-test-passphrase",
    });
  }
  async function upload(cookie, purpose = "account") {
    const r = await mf.dispatchFetch(
      origin + "/api/documents?purpose=" + purpose,
      {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: cookie,
          "Content-Type": "image/png",
        },
        body: png,
      },
    );
    const d = await r.json();
    assert.equal(r.status, 201, JSON.stringify(d));
    return d.id;
  }
  const admin = await signup("admin", "โรงเรียนผู้จัด", "coach");
  await db
    .prepare(
      "UPDATE users SET role='admin',approval_status='approved' WHERE id=?",
    )
    .bind(admin.body.user.id)
    .run();
  const school = await signup("school", "โรงเรียนเอ", "coach"),
    other = await signup("other", "โรงเรียนบี", "coach");
  const competition = "trial73-art-painting1";
  let payload = {
    competition_id: competition,
    eligibility_confirmed: true,
    students: [{ name: "นักเรียน เอ", grade: "ป.1" }],
    coaches: [{ name: school.body.user.name }],
  };
  assert.equal(
    (await call("/registrations", payload, school.cookie)).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/admin/approve-user",
        { user_id: school.body.user.id, status: "approved" },
        admin.cookie,
      )
    ).status,
    409,
  );
  const accountPhoto = await upload(school.cookie);
  payload.coaches[0].evidence_id = accountPhoto;
  payload.students[0].evidence_id = await upload(school.cookie, "student");
  assert.equal(
    (
      await mf.dispatchFetch(origin + "/api/documents/" + accountPhoto, {
        headers: { Cookie: other.cookie },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await mf.dispatchFetch(origin + "/api/documents/" + accountPhoto, {
        headers: { Cookie: school.cookie },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await mf.dispatchFetch(origin + "/api/documents/" + accountPhoto, {
        headers: { Cookie: admin.cookie },
      })
    ).headers.get("cache-control"),
    "private, no-store",
  );
  assert.equal(
    (
      await call(
        "/admin/approve-user",
        { user_id: school.body.user.id, status: "approved" },
        admin.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/registrations", payload, school.cookie)).status,
    409,
    "closed until schedule configured",
  );
  const clock = now();
  assert.equal(
    (
      await call(
        "/admin/window",
        {
          opens_at: clock - 100,
          closes_at: clock + 100,
          edits_until: clock + 200,
        },
        admin.cookie,
      )
    ).status,
    200,
  );
  const badPhoto = {
    ...payload,
    students: [{ ...payload.students[0], evidence_id: "not-owned" }],
  };
  assert.equal(
    (await call("/registrations", badPhoto, school.cookie)).status,
    400,
  );
  const reg = await call("/registrations", payload, school.cookie);
  assert.equal(reg.status, 201, JSON.stringify(reg));
  assert.equal(
    (
      await call(
        "/admin/decision",
        { registration_id: reg.body.id, decision: "eligible" },
        admin.cookie,
      )
    ).status,
    200,
  );
  await call(
    "/admin/window",
    { opens_at: clock - 100, closes_at: clock - 10, edits_until: clock + 100 },
    admin.cookie,
  );
  payload.students[0].name = "นักเรียน แก้ไข";
  assert.equal(
    (await call("/registrations", payload, school.cookie)).status,
    201,
  );
  assert.equal(
    (await call("/registrations", undefined, school.cookie)).body
      .registrations[0].eligibility_reviewed,
    0,
  );
  await call(
    "/admin/decision",
    { registration_id: reg.body.id, decision: "eligible" },
    admin.cookie,
  );
  const conflicting = await signup("conflict", "โรงเรียนเอ", "judge");
  await upload(conflicting.cookie);
  await call(
    "/admin/approve-user",
    { user_id: conflicting.body.user.id, status: "approved" },
    admin.cookie,
  );
  assert.equal(
    (
      await call(
        "/admin/assignment",
        { competition_id: competition, judge_id: conflicting.body.user.id },
        admin.cookie,
      )
    ).status,
    409,
  );
  assert(
    !(
      await call(
        "/admin/judge-candidates?competition=" + competition,
        undefined,
        admin.cookie,
      )
    ).body.candidates.some((j) => j.id === conflicting.body.user.id),
  );
  const judges = [];
  for (let i = 0; i < 3; i++) {
    const j = await signup("judge" + i, "โรงเรียนกรรมการ " + i, "judge");
    await upload(j.cookie);
    await call(
      "/admin/approve-user",
      { user_id: j.body.user.id, status: "approved" },
      admin.cookie,
    );
    judges.push(j);
  }
  // Manual assignment excludes the organizer so this test has a predictable three-person panel.
  for (const j of judges)
    assert.equal(
      (
        await call(
          "/admin/assignment",
          { competition_id: competition, judge_id: j.body.user.id },
          admin.cookie,
        )
      ).status,
      200,
    );
  assert.equal(
    (await call("/judge/competitions", undefined, judges[0].cookie)).body
      .competitions[0].id,
    competition,
  );
  const visible = (
    await call("/judge/registrations", undefined, judges[0].cookie)
  ).body.registrations;
  assert(
    !visible[0].students[0].evidence_id && !visible[0].coaches[0].evidence_id,
  );
  const score = {
    registration_id: reg.body.id,
    criteria: [20, 20, 20, 20, 20],
  };
  assert.equal(
    (await call("/judge/score", score, judges[0].cookie)).status,
    409,
    "edit window still open",
  );
  await call(
    "/admin/window",
    { opens_at: clock - 100, closes_at: clock - 10, edits_until: clock - 5 },
    admin.cookie,
  );
  assert.equal(
    (await call("/registrations", payload, school.cookie)).status,
    409,
  );
  assert.equal(
    (await call("/judge/score", score, judges[0].cookie)).status,
    200,
  );
  assert.equal(
    (await call("/certificates/" + reg.body.id, undefined, school.cookie))
      .status,
    409,
  );
  assert.equal(
    (
      await call(
        "/admin/publish",
        { competition_id: competition },
        admin.cookie,
      )
    ).status,
    409,
    "drafts cannot publish",
  );
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      call("/judge/score", { ...score, finalize: true }, judges[0].cookie),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await call("/judge/score", score, judges[0].cookie)).status,
    409,
    "final score cannot be changed before publication",
  );
  assert.equal(
    (
      await call(
        "/admin/assignment",
        {
          competition_id: competition,
          judge_id: judges[0].body.user.id,
          remove: true,
        },
        admin.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (await call("/judge/score", { ...score, finalize: true }, judges[1].cookie))
      .body.published,
    false,
  );
  const last = await call(
    "/judge/score",
    { ...score, finalize: true },
    judges[2].cookie,
  );
  assert.equal(last.status, 200, JSON.stringify(last));
  assert.equal(last.body.published, true);
  const cert = await call(
    "/certificates/" + reg.body.id,
    undefined,
    school.cookie,
  );
  assert.equal(cert.status, 200);
  assert.equal(cert.body.certificate.rank, 1);
  assert.equal(cert.body.certificate.award, "ชนะเลิศ");
  assert(!cert.body.certificate.students[0].evidence_id);
  assert.equal(
    (await call("/judge/competitions", undefined, conflicting.cookie)).body
      .competitions.length,
    0,
  );
  // Test shared ranks without modifying the finalized team's scores.
  await db
    .prepare(
      "INSERT INTO registrations(id,user_id,competition_id,school,students,coaches,status,created_at,work_url,school_key) SELECT 'tie-team',?,competition_id,'โรงเรียนอีกแห่ง',students,coaches,status,created_at,work_url,'tie' FROM registrations WHERE id=?",
    )
    .bind(other.body.user.id, reg.body.id)
    .run();
  await db
    .prepare(
      "INSERT INTO scores(registration_id,judge_id,criteria,total,comment,created_at,finalized_at) SELECT 'tie-team',judge_id,criteria,total,comment,created_at,finalized_at FROM scores WHERE registration_id=?",
    )
    .bind(reg.body.id)
    .run();
  const ranks = (await call("/results", undefined, school.cookie)).body.results
    .filter((r) => r.competition_id === competition)
    .map((r) => r.rank);
  assert.deepEqual(ranks, [1, 1]);
  const scope = "trial73-art-mixed1";
  for (const [id, uid, schoolName, key] of [
    ["conflict-team-a", school.body.user.id, "โรงเรียนเอ", "โรงเรียนเอ"],
    ["conflict-team-b", other.body.user.id, "โรงเรียนบี", "โรงเรียนบี"],
  ]) {
    await db
      .prepare(
        `INSERT INTO registrations(id,user_id,competition_id,school,school_key,students,coaches,status,created_at) VALUES(?,?,?,?,?,'[]','[]','submitted',?)`,
      )
      .bind(id, uid, scope, schoolName, key, now())
      .run();
  }
  await db
    .prepare("INSERT INTO assignments VALUES(?,?)")
    .bind(scope, conflicting.body.user.id)
    .run();
  assert.equal(
    (await call("/judge/registrations", undefined, conflicting.cookie)).body
      .registrations.length,
    0,
    "a conflicting judge cannot see even the other school in the same competition",
  );
  assert(
    !(
      await call("/judge/competitions", undefined, conflicting.cookie)
    ).body.competitions.some((c) => c.id === scope),
  );
  await call(
    "/admin/assignment",
    { competition_id: scope, judge_id: conflicting.body.user.id, remove: true },
    admin.cookie,
  );
  assert.equal(
    (await call("/admin/auto-assign", { competition_id: scope }, admin.cookie))
      .status,
    200,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM assignments WHERE competition_id=?")
        .bind(scope)
        .first()
    ).n,
    3,
  );
  assert(
    !(await db
      .prepare(
        "SELECT 1 FROM assignments WHERE competition_id=? AND judge_id=?",
      )
      .bind(scope, conflicting.body.user.id)
      .first()),
  );
  const privateImage = await mf.dispatchFetch(
    origin + "/api/documents/" + accountPhoto,
    { headers: { Cookie: school.cookie } },
  );
  assert.deepEqual(Buffer.from(await privateImage.arrayBuffer()), png);
});
