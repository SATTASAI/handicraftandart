import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
const origin = "https://example.test";
test("teacher registers without evidence or approval and judges only assigned competitions without own school", async (t) => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        { type: "ESModule", path: "server/index.js" },
        { type: "ESModule", path: "server/security.js" },
      ],
      compatibilityDate: "2026-11-02",
      d1Databases: ["DB"],
      bindings: {
        AUTH_SECRET: "test-only-simple-workflow-secret-32-characters",
        DEMO_MODE: "true",
      },
    }),
  );
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  let legacySnapshot;
  const legacyRows = async () => ({
    competitions: (
      await db
        .prepare(
          "SELECT id,workflow_version,published FROM competitions WHERE id IN ('singing','storytelling') ORDER BY id",
        )
        .all()
    ).results,
    registrations: (
      await db
        .prepare("SELECT * FROM registrations WHERE id='legacy-team'")
        .all()
    ).results,
    scores: (
      await db
        .prepare("SELECT * FROM scores WHERE registration_id='legacy-team'")
        .all()
    ).results,
  });
  for (const f of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (f.startsWith("0010")) {
      await db
        .prepare(
          "INSERT INTO users(id,email,name,school,password_hash,school_key,created_at) VALUES('legacy-owner','legacy@example.test','Legacy','Legacy School','unused-test-hash','legacyschool',1)",
        )
        .run();
      await db
        .prepare(
          "INSERT INTO users(id,email,name,school,password_hash,school_key,approval_status,created_at) VALUES('legacy-rejected','rejected@example.test','Rejected','Other School','unused-test-hash','otherschool','rejected',1)",
        )
        .run();
      await db
        .prepare("UPDATE competitions SET published=1 WHERE id='singing'")
        .run();
      await db
        .prepare(
          "INSERT INTO registrations(id,user_id,competition_id,school,students,coaches,status,created_at,school_key) VALUES('legacy-team','legacy-owner','storytelling','Legacy School','[]','[]','submitted',1,'legacyschool')",
        )
        .run();
      await db
        .prepare(
          "INSERT INTO scores(registration_id,judge_id,criteria,total,created_at,finalized_at) VALUES('legacy-team','legacy-owner','[40,30,20,10]',100,1,1)",
        )
        .run();
      legacySnapshot = await legacyRows();
    }
    for (const sql of (await readFile("migrations/" + f, "utf8"))
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  }
  assert.deepEqual(
    await legacyRows(),
    legacySnapshot,
    "Migration must preserve published and finalized competitions and their registrations/scores",
  );
  assert.equal(
    (
      await db
        .prepare("SELECT approval_status FROM users WHERE id='legacy-owner'")
        .first()
    ).approval_status,
    "approved",
  );
  assert.equal(
    (
      await db
        .prepare("SELECT approval_status FROM users WHERE id='legacy-rejected'")
        .first()
    ).approval_status,
    "rejected",
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
  async function signup(name, school) {
    const r = await call("/auth/register", {
      name,
      school,
      email: name + "@example.test",
      password: "test-only-passphrase",
      role: "admin",
      approval_status: "approved",
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.user.role, "participant");
    assert.equal(r.body.user.approval_status, "approved");
    assert.equal(r.body.user.simple_workflow, true);
    return r;
  }
  const a = await signup("teacherA", "โรงเรียนเอ"),
    b = await signup("teacherB", "โรงเรียนบี"),
    c = await signup("teacherC", "โรงเรียนซี"),
    owner = await signup("organizer", "โรงเรียนผู้จัด");
  await db
    .prepare("UPDATE users SET role='admin' WHERE id=?")
    .bind(owner.body.user.id)
    .run();
  await db
    .prepare(
      "UPDATE competitions SET registration_open=1,policy_json='{}' WHERE id IN ('painting','weaving')",
    )
    .run();
  const payload = {
    competition_id: "painting",
    students: [{ name: "นักเรียน หนึ่ง", grade: "ป.4" }],
    coaches: [{ name: "ครู หนึ่ง" }],
  };
  assert.equal((await call("/registrations", payload)).status, 401);
  const registered = await call("/registrations", payload, a.cookie);
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  assert.match(registered.body.message, /รอเข้าร่วมแข่งขัน/);
  let row = await db
    .prepare("SELECT * FROM registrations WHERE id=?")
    .bind(registered.body.id)
    .first();
  assert.equal(row.eligibility_reviewed, 1);
  assert.equal(row.status, "submitted");
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM identity_documents").first()).n,
    0,
  );
  const bad = await call(
    "/registrations",
    { ...payload, students: [] },
    b.cookie,
  );
  assert.equal(bad.status, 400);
  const assignment = (competition_id, judge_id, cookie = owner.cookie) =>
    call("/admin/assignment", { competition_id, judge_id }, cookie);
  assert.equal(
    (await assignment("painting", b.body.user.id, a.cookie)).status,
    403,
  );
  assert.equal((await assignment("painting", a.body.user.id)).status, 409);
  const colleague = await signup("colleague", "โรงเรียนเอ");
  assert.equal(
    (await assignment("painting", colleague.body.user.id)).status,
    409,
  );
  // Even a stale or externally inserted conflicting assignment cannot grant access.
  await db
    .prepare("INSERT INTO assignments VALUES('painting',?)")
    .bind(colleague.body.user.id)
    .run();
  const blockedJobs = await call(
    "/judge/competitions",
    undefined,
    colleague.cookie,
  );
  assert(!blockedJobs.body.competitions.some((c) => c.id === "painting"));
  const blockedTeams = await call(
    "/judge/registrations",
    undefined,
    colleague.cookie,
  );
  assert.equal(blockedTeams.body.registrations.length, 0);
  assert.equal((await assignment("painting", b.body.user.id)).status, 200);
  // Teacher A remains a coach in painting and can judge weaving with the same account.
  assert.equal((await assignment("weaving", a.body.user.id)).status, 200);
  let jobs = await call("/judge/competitions", undefined, a.cookie);
  assert(jobs.body.competitions.some((c) => c.id === "weaving"));
  assert(!jobs.body.competitions.some((c) => c.id === "painting"));
  const otherTeam = await call(
    "/registrations",
    { ...payload, competition_id: "weaving" },
    c.cookie,
  );
  assert.equal(otherTeam.status, 201, JSON.stringify(otherTeam.body));
  const edit = await call(
    "/registrations",
    { ...payload, students: [{ name: "นักเรียน แก้ไข", grade: "ป.4" }] },
    a.cookie,
  );
  assert.equal(edit.status, 201);
  row = await db
    .prepare("SELECT * FROM registrations WHERE id=?")
    .bind(registered.body.id)
    .first();
  assert.equal(row.eligibility_reviewed, 1);
  assert.equal(row.revision, 2);
  const comps = await call("/competitions", undefined, b.cookie);
  const rules = comps.body.competitions.find(
    (c) => c.id === "painting",
  ).score_rules;
  const score = {
    registration_id: registered.body.id,
    criteria: rules.map((r) => r.max),
    finalize: true,
  };
  assert.equal((await call("/judge/score", score, a.cookie)).status, 403);
  assert.equal((await call("/judge/score", score, c.cookie)).status, 403);
  assert.equal((await call("/judge/score", score, b.cookie)).status, 409);
  await db
    .prepare("UPDATE competitions SET registration_open=0 WHERE id='painting'")
    .run();
  const scored = await call("/judge/score", score, b.cookie);
  assert.equal(scored.status, 200, JSON.stringify(scored.body));
  assert.equal(
    (
      await db
        .prepare("SELECT published FROM competitions WHERE id='painting'")
        .first()
    ).published,
    1,
  );
  assert.equal((await call("/judge/score", score, b.cookie)).status, 409);
  assert.equal((await call("/registrations", payload, a.cookie)).status, 409);
  const results = await call("/results", undefined, a.cookie);
  assert(
    results.body.results.some(
      (r) => r.id === registered.body.id && r.score === 100,
    ),
  );
  // A configured event deadline still applies, including to direct API calls.
  await db
    .prepare("UPDATE event_window SET opens_at=1,closes_at=2,edits_until=3")
    .run();
  assert.equal(
    (
      await call(
        "/registrations",
        { ...payload, competition_id: "weaving" },
        b.cookie,
      )
    ).status,
    409,
  );
});
