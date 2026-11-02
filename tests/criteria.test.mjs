import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { digest, now } from "../server/security.js";
const origin = "https://example.test";
const catalog = JSON.parse(
  await readFile("data/criteria-2568.json", "utf8"),
).competitions;

test("catalog covers the agreed primary divisions with separate eligibility, sources and raw maxima", () => {
  assert.equal(new Set(catalog.map((c) => c.id)).size, catalog.length);
  assert.deepEqual(
    ["general", "inclusive", "disability", "special"].map(
      (d) => catalog.filter((c) => c.policy.division === d).length,
    ),
    [50, 27, 82, 38],
  );
  for (const c of catalog) {
    assert(c.rules_source_url.startsWith("https://drive.google.com/file/d/"));
    assert(Number.isInteger(c.source_page) && c.source_page > 0);
    assert(c.min_students > 0 && c.min_students <= c.max_students);
    assert((c.policy.min_coaches || 1) <= c.max_coaches, c.id);
    assert.equal(
      c.score_rules.reduce((s, r) => s + r.max, 0),
      c.policy.score_total,
      c.id,
    );
    assert(c.score_rules.every((r) => r.label && r.max > 0));
    if (c.policy.division === "special")
      assert.deepEqual(
        [c.policy.age_min, c.policy.age_max, c.policy.allowed_grades.length],
        [7, 12, 0],
      );
    else assert(c.policy.allowed_grades.every((g) => /^ป\.[1-6]$/.test(g)));
  }
  assert.equal(
    catalog.find((c) => c.id === "trial73-disability-8-HI-1").policy
      .score_total,
    20,
  );
  assert(
    !catalog.some((c) =>
      /^trial73-disability-(10|11|12|14|27|34|41|42|43|44)-/.test(c.id),
    ),
  );
  assert(!catalog.some((c) => /^trial73-special-(1|8|10)-/.test(c.id)));
  assert(catalog.some((c) => c.id === "trial73-special-3-MU"));
});

test("primary trial: eligibility, school conflicts, full panels, deductions, normalized scores, immutable rules, disqualification and version copies", async (t) => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        { type: "ESModule", path: "server/index.js" },
        { type: "ESModule", path: "server/security.js" },
      ],
      compatibilityDate: "2026-11-02",
      d1Databases: ["DB"],
      bindings: {
        AUTH_SECRET: "criteria-tests-only-secret-32-characters-minimum",
        DEMO_MODE: "true",
      },
    }),
  );
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (file === "0008_primary_catalog_2568.sql") {
      await db.batch([
        db.prepare(
          "INSERT INTO users(id,email,name,school,password_hash,role,created_at) VALUES('legacy-owner','legacy-owner@example.test','บัญชีเดิม','โรงเรียนเดิม','unchanged','participant',1)",
        ),
        db.prepare(
          "INSERT INTO users(id,email,name,school,password_hash,role,created_at) VALUES('legacy-judge','legacy-judge@example.test','กรรมการเดิม','โรงเรียนอื่น','unchanged','judge',1)",
        ),
        db.prepare(
          `INSERT INTO registrations(id,user_id,competition_id,school,students,coaches,status,created_at) VALUES('legacy-registration','legacy-owner','painting','โรงเรียนเดิม','[{"name":"นักเรียนเดิม","grade":"ป.5"}]','[{"name":"ครูเดิม"}]','submitted',1)`,
        ),
        db.prepare(
          `INSERT INTO scores VALUES('legacy-registration','legacy-judge','[35,27,18,9]',89,'เดิม',1)`,
        ),
        db.prepare(
          "UPDATE competitions SET published=1,registration_open=0 WHERE id='painting'",
        ),
      ]);
    }
    const statements = (await readFile("migrations/" + file, "utf8"))
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = 0; i < statements.length; i += 25)
      await db.batch(statements.slice(i, i + 25).map((s) => db.prepare(s)));
  }
  assert.equal(
    (
      await db
        .prepare(
          "SELECT total FROM scores WHERE registration_id='legacy-registration'",
        )
        .first()
    ).total,
    89,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT published FROM competitions WHERE id='painting'")
        .first()
    ).published,
    1,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT password_hash FROM users WHERE id='legacy-owner'")
        .first()
    ).password_hash,
    "unchanged",
  );
  assert.equal(
    (
      await db
        .prepare(
          "SELECT school_key FROM registrations WHERE id='legacy-registration'",
        )
        .first()
    ).school_key,
    "โรงเรียนเดิม",
  );
  // This fixture verifies compatibility for pre-finalization trial competitions; v1 workflow is exercised separately.
  await db.prepare("UPDATE competitions SET workflow_version=0").run();
  async function account(id, role, school) {
    const token = "test-session-" + id;
    await db
      .prepare(
        "INSERT INTO users(id,email,name,school,password_hash,role,created_at,school_key) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        id + "@example.test",
        "ชื่อ " + id,
        school,
        "unused-test-hash",
        role,
        now(),
        school.normalize("NFKC").toLowerCase().replace(/\s+/gu, ""),
      )
      .run();
    await db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .bind(await digest(token), id, now() + 3600)
      .run();
    await db
      .prepare("UPDATE users SET approval_status='approved' WHERE id=?")
      .bind(id)
      .run();
    return "handicraft_session=" + token;
  }
  const admin = await account("admin", "admin", "โรงเรียนผู้จัด");
  const coach = await account("coach", "participant", "โรงเรียนทดสอบ");
  const coach2 = await account("coach2", "participant", "โรงเรียน ทดสอบ");
  const conflicted = await account("conflicted", "judge", "โรงเรียน ทดสอบ");
  const judges = [];
  for (let i = 0; i < 5; i++)
    judges.push(await account("judge" + i, "judge", "โรงเรียนกรรมการ" + i));
  async function call(path, data, cookie = admin) {
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
    return { status: r.status, body: await r.json() };
  }
  function payload(c, changes = {}) {
    return {
      competition_id: c.id,
      eligibility_confirmed: true,
      students: Array.from({ length: c.min_students }, (_, i) => ({
        name: "นักเรียน " + i,
        grade: c.policy.allowed_grades[0] || "",
        ...(c.policy.age_min ? { age: 8 } : {}),
        ...(c.policy.gender ? { gender: c.policy.gender } : {}),
        ...(c.policy.mixed_gender_pair
          ? { gender: i === 0 ? "ชาย" : "หญิง" }
          : {}),
      })),
      coaches: Array.from({ length: c.policy.min_coaches || 1 }, (_, i) => ({
        name: "ครู " + i,
      })),
      ...changes,
    };
  }
  const lower = catalog.find((c) => c.id === "trial73-art-painting1");
  assert.equal(
    (
      await call(
        "/registrations",
        payload(lower, { eligibility_confirmed: false }),
        coach,
      )
    ).status,
    400,
  );
  const wrongGrade = payload(lower);
  wrongGrade.students[0].grade = "ป.6";
  assert.equal((await call("/registrations", wrongGrade, coach)).status, 400);
  const reg = await call("/registrations", payload(lower), coach);
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  assert.equal(
    (await call("/registrations", payload(lower), coach2)).status,
    409,
    "one team per normalized school",
  );
  assert.equal(
    (
      await call("/admin/competition", {
        ...lower,
        venue: "ทดสอบ",
        schedule: "ทดสอบ",
        score_rules: lower.score_rules.map((x, i) => ({
          ...x,
          max: i === 0 ? 19 : i === 1 ? 21 : x.max,
        })),
      })
    ).status,
    409,
  );
  for (const id of ["judge0", "judge1", "judge2"])
    assert.equal(
      (
        await call("/admin/assignment", {
          competition_id: lower.id,
          judge_id: id,
        })
      ).status,
      200,
    );
  assert.equal(
    (await call("/judge/registrations", undefined, conflicted)).body
      .registrations.length,
    0,
  );
  assert.equal(
    (
      await call(
        "/judge/score",
        { registration_id: reg.body.id, criteria: [20, 20, 20, 20, 20] },
        conflicted,
      )
    ).status,
    403,
  );
  for (const cookie of judges.slice(0, 3)) {
    assert.equal(
      (
        await call(
          "/judge/score",
          {
            registration_id: reg.body.id,
            criteria: [20, 20, 20, 20, 20],
            deduction: 1,
          },
          cookie,
        )
      ).status,
      400,
      "deductions require reason",
    );
    assert.equal(
      (
        await call(
          "/judge/score",
          {
            registration_id: reg.body.id,
            criteria: [20, 20, 20, 20, 20],
            deduction: 1,
            deduction_reason: "หักตามข้อกำหนดเวลาต้นฉบับ",
          },
          cookie,
        )
      ).body.total,
      99,
    );
  }
  assert.equal(
    (await call("/admin/publish", { competition_id: lower.id })).status,
    409,
    "manual eligibility review required",
  );
  assert.equal(
    (
      await call("/admin/decision", {
        registration_id: reg.body.id,
        decision: "eligible",
        note: "ตรวจตามต้นฉบับแล้ว",
      })
    ).status,
    200,
  );
  const overview = await call("/admin/overview");
  const progress = overview.body.competitions.find((c) => c.id === lower.id);
  assert.deepEqual(
    [progress.required, progress.scored, progress.ready],
    [3, 3, true],
  );
  assert.equal(
    (await call("/admin/publish", { competition_id: lower.id })).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/judge/score",
        { registration_id: reg.body.id, criteria: [10, 10, 10, 10, 10] },
        judges[0],
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/admin/decision", {
        registration_id: reg.body.id,
        decision: "disqualified",
        note: "test",
      })
    ).status,
    409,
  );
  assert.equal(
    (await call("/certificates/" + reg.body.id, undefined, coach)).body
      .certificate.score,
    99,
  );
  const copy = await call("/admin/competition-copy", { id: lower.id });
  assert.equal(copy.status, 201);
  const copied = (await call("/competitions")).body.competitions.find(
    (c) => c.id === copy.body.id,
  );
  assert.deepEqual([copied.published, copied.registration_open], [0, 0]);
  assert.equal(copied.policy.score_total, 100);
  const edited = await call("/admin/competition", {
    ...copied,
    venue: "รอประกาศ",
    schedule: "รอประกาศ",
    policy: { ...copied.policy, score_total: 20 },
    score_rules: [{ label: "คะแนนทดสอบ", max: 20 }],
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(
    (
      await db
        .prepare("SELECT total FROM scores WHERE registration_id=? LIMIT 1")
        .bind(reg.body.id)
        .first()
    ).total,
    99,
  );

  const special = catalog.find((c) => c.id === "trial73-special-2-HI");
  const age = payload(special);
  age.students[0].age = 6;
  assert.equal((await call("/registrations", age, coach)).status, 400);
  age.students[0].age = 13;
  assert.equal((await call("/registrations", age, coach)).status, 400);
  age.students[0].age = 8;
  assert.equal((await call("/registrations", age, coach)).status, 201);
  const male = catalog.find((c) => c.id === "trial73-music-country-male");
  const female = payload(male);
  female.students[0].gender = "หญิง";
  assert.equal((await call("/registrations", female, coach)).status, 400);
  const mixed = catalog.find((c) => c.id === "trial73-special-7-all");
  const pair = payload(mixed);
  pair.students[1].gender = "ชาย";
  assert.equal((await call("/registrations", pair, coach)).status, 400);

  const math = catalog.find((c) => c.id === "trial73-disability-8-HI-1");
  const mathReg = await call("/registrations", payload(math), coach);
  assert.equal(mathReg.status, 201);
  for (const id of ["judge0", "judge1", "judge2"])
    await call("/admin/assignment", { competition_id: math.id, judge_id: id });
  for (const cookie of judges.slice(0, 3))
    assert.equal(
      (
        await call(
          "/judge/score",
          { registration_id: mathReg.body.id, criteria: [10] },
          cookie,
        )
      ).body.total,
      50,
      "20 raw points normalize to percentages",
    );
  await call("/admin/decision", {
    registration_id: mathReg.body.id,
    decision: "eligible",
  });
  await call("/admin/assignment", {
    competition_id: math.id,
    judge_id: "judge3",
  });
  assert.equal(
    (await call("/admin/publish", { competition_id: math.id })).status,
    409,
    "four eligible judges do not meet a three-person panel",
  );
  await call("/admin/assignment", {
    competition_id: math.id,
    judge_id: "judge3",
    remove: true,
  });
  assert.equal(
    (await call("/admin/publish", { competition_id: math.id })).status,
    200,
  );
  assert.equal(
    (await call("/certificates/" + mathReg.body.id, undefined, coach)).body
      .certificate.score,
    50,
  );
  const denied = catalog.find((c) => c.id === "trial73-inclusive-9-HI");
  const deniedReg = await call("/registrations", payload(denied), coach);
  assert.equal(deniedReg.status, 201);
  assert.equal(
    (
      await call("/admin/decision", {
        registration_id: deniedReg.body.id,
        decision: "disqualified",
        note: "",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/admin/decision", {
        registration_id: deniedReg.body.id,
        decision: "disqualified",
        note: "คุณสมบัติไม่ตรงตามต้นฉบับ",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/admin/publish", { competition_id: denied.id })).status,
    200,
  );
  assert.equal(
    (await call("/certificates/" + deniedReg.body.id, undefined, coach)).status,
    409,
  );
  const result = (await call("/results", undefined, coach)).body.results.find(
    (r) => r.id === deniedReg.body.id,
  );
  assert.equal(result.medal, "ไม่มีสิทธิ์รับรางวัล");
  assert.equal(result.score, null);
});
