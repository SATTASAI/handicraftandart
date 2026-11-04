import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { hashPassword } from "../server/security.js";
const catalog = JSON.parse(
  await readFile("data/criteria-73-2568.json", "utf8"),
);
const origin = "https://catalog.example.test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKD0AAAAASUVORK5CYII=",
  "base64",
);
const norm = (s) =>
  s.normalize("NFKD").replace(/[^\p{Letter}\p{Number}]/gu, "");
async function runtime(t, beforeCatalog) {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        "index.js",
        "security.js",
        "registrations.js",
        "catalog.js",
        "judging.js",
        "mail.js",
        "drive.js",
      ].map((f) => ({
        type: "ESModule",
        path: "server/" + f,
      })),
      compatibilityDate: "2026-11-02",
      d1Databases: ["DB"],
      serviceBindings: {
        ASSETS: () =>
          new Response("%PDF-1.7 test route", {
            headers: { "Content-Type": "application/pdf" },
          }),
      },
    }),
  );
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  for (const f of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (f.startsWith("0013") && beforeCatalog) await beforeCatalog(db);
    await db.exec(await readFile("migrations/" + f, "utf8"));
  }
  async function call(path, data, cookie = "") {
    const r = await mf.dispatchFetch(origin + path, {
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
  const signup = (name) =>
    call("/api/signup", {
      name,
      school: "โรงเรียนทดสอบ",
      email: name + "@example.test",
      password: "test-only-passphrase-2026",
      roles: ["coach"],
    });
  const upload = async (cookie) => {
    const r = await mf.dispatchFetch(origin + "/api/registration-documents", {
      method: "POST",
      headers: { Cookie: cookie, Origin: origin, "Content-Type": "image/png" },
      body: png,
    });
    const b = await r.json();
    assert.equal(r.status, 201, JSON.stringify(b));
    return b.id;
  };
  return { mf, db, call, signup, upload };
}
const student = (id) => ({
  first_name: "นักเรียน " + String(id).slice(0, 8),
  last_name: "ทดสอบ",
  grade: "ป.4",
  school: "โรงเรียนทดสอบ",
  document_id: id,
});

test("uploaded PDFs match hashes; primary-only catalog has 49 general entries and no inclusive entries with traceable score criteria", async () => {
  assert.equal(catalog.sources.length, 10);
  assert.equal(
    catalog.sources.reduce((n, s) => n + s.pages, 0),
    158,
  );
  assert.equal(catalog.sources.filter((s) => s.included).length, 8);
  assert.equal(
    catalog.sources.find((s) => s.key_name === "kindergarten").included,
    false,
  );
  for (const source of catalog.sources.filter((s) => s.included)) {
    const bytes = await readFile("public" + source.url);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      source.sha256,
    );
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  }
  assert.equal(catalog.competitions.length, 49);
  assert.equal(
    catalog.competitions.filter((c) => c.category === "นาฏศิลป์").length,
    4,
  );
  assert.equal(
    catalog.competitions.find((c) => c.id.startsWith("c73-dance-conserve-"))
      .rules.policy.team_variants[1].min_students,
    7,
  );
  assert.equal(new Set(catalog.competitions.map((c) => c.id)).size, 49);
  assert.equal(
    catalog.competitions.filter((c) => c.rules.policy.division === "general")
      .length,
    49,
  );
  assert.equal(
    catalog.competitions.filter((c) => c.rules.policy.division === "inclusive")
      .length,
    0,
  );
  const sections = new Map(catalog.sections.map((s) => [s.key, s]));
  for (const c of catalog.competitions) {
    assert(c.rules.policy.allowed_grades.length > 0);
    assert(c.rules.policy.allowed_grades.every((g) => /^ป\.[1-6]$/.test(g)));
    assert.equal(c.rules.source_year, 2568);
    assert.equal(c.rules.score_total, 100);
    assert.equal(
      c.rules.score_rules.reduce((sum, s) => sum + s.max, 0),
      100,
      c.id,
    );
    const section = sections.get(c.section_key);
    assert(section);
    assert.equal(section.start_page, c.source_page);
    assert.equal(section.end_page, c.source_end_page);
    for (const score of c.rules.score_rules) {
      assert(score.max > 0);
      assert.equal(
        (score.label.match(/\(/g) || []).length,
        (score.label.match(/\)/g) || []).length,
      );
      assert(
        norm(section.text).includes(norm(score.label)),
        c.id + ": " + score.label,
      );
    }
  }
  const winds = catalog.competitions.find((c) =>
    c.id.startsWith("c73-music-winds-"),
  );
  assert.equal(winds.min_students, 17);
  assert.equal(winds.max_students, null);
  assert.equal(
    catalog.competitions.find((c) => c.id.startsWith("c73-art-sketch4-"))
      .source_end_page,
    10,
  );
});

test("catalog migration preserves populated competitions, registrations, ID documents, accounts and first-admin marker; seeding is idempotent", async (t) => {
  const user = crypto.randomUUID(),
    competition = crypto.randomUUID(),
    registration = crypto.randomUUID(),
    document = crypto.randomUUID(),
    stu = crypto.randomUUID(),
    review = crypto.randomUUID();
  const password = await hashPassword("existing-test-passphrase");
  const { db, call } = await runtime(t, async (db) => {
    await db.batch([
      db
        .prepare(
          "INSERT INTO account_users(id,name,school,email,password_hash,is_coach,is_judge,is_superadmin,created_at) VALUES(?,?,?,?,?,1,1,1,1)",
        )
        .bind(
          user,
          "ครูเดิม",
          "โรงเรียนเดิม",
          "existing@example.test",
          password,
        ),
      db.prepare("INSERT INTO account_bootstrap VALUES(1,?,1)").bind(user),
      db
        .prepare(
          "INSERT INTO event_competitions VALUES(?,'รายการเดิม','เกณฑ์เดิม','ป.4–6','ห้องเดิม','',1,1,0,?,1)",
        )
        .bind(competition, user),
      db
        .prepare(
          "INSERT INTO registration_documents VALUES(?,?,'image/png',?,?,1)",
        )
        .bind(document, user, png.length, png),
      db
        .prepare(
          "INSERT INTO event_registrations(id,competition_id,owner_id,request_id,payload_hash,status,write_token,reviewed_by,reviewed_at,created_at,updated_at) VALUES(?,?,?,?,?,'approved',?,?,1,1,1)",
        )
        .bind(
          registration,
          competition,
          user,
          crypto.randomUUID(),
          "existing-hash",
          "old-write-token",
          user,
        ),
      db
        .prepare(
          "INSERT INTO event_students VALUES(?,?,0,'นักเรียน','เดิม','ป.4','โรงเรียนเดิม',?)",
        )
        .bind(stu, registration, document),
      db
        .prepare(
          "INSERT INTO event_registration_reviews VALUES(?,?,1,?,'approved','ตรวจแล้ว',1)",
        )
        .bind(review, registration, user),
    ]);
  });
  const old = await db
    .prepare("SELECT * FROM event_competitions WHERE id=?")
    .bind(competition)
    .first();
  assert.equal(old.title, "รายการเดิม");
  assert.equal(old.registration_open, 0);
  assert.equal(old.created_by, user);
  assert.equal(old.catalog_key, null);
  assert.equal(
    (
      await db
        .prepare("SELECT status FROM event_registrations WHERE id=?")
        .bind(registration)
        .first()
    ).status,
    "approved",
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM event_students WHERE id=?")
        .bind(stu)
        .first()
    ).n,
    1,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT size FROM registration_documents WHERE id=?")
        .bind(document)
        .first()
    ).size,
    png.length,
  );
  assert.equal(
    (await db.prepare("SELECT user_id FROM account_bootstrap").first()).user_id,
    user,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT password_hash FROM account_users WHERE id=?")
        .bind(user)
        .first()
    ).password_hash,
    password,
  );
  const imported = (
    await db
      .prepare("SELECT * FROM event_competitions WHERE catalog_key IS NOT NULL")
      .all()
  ).results;
  assert.equal(imported.length, 49);
  assert(imported.every((c) => c.registration_open === 1));
  assert.equal(
    (
      await call("/api/login", {
        email: "existing@example.test",
        password: "existing-test-passphrase",
      })
    ).status,
    200,
  );
  const id = imported[0].id;
  await db
    .prepare("UPDATE event_competitions SET registration_open=0 WHERE id=?")
    .bind(id)
    .run();
  const seed = (
    await readFile("migrations/0013_primary_criteria_73.sql", "utf8")
  )
    .split("\n")
    .filter((s) => s.startsWith("INSERT OR IGNORE"))
    .join("\n");
  await db.exec(seed);
  await db.exec(
    await readFile("migrations/0017_remove_inclusive.sql", "utf8"),
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM event_competitions").first()).n,
    50,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT registration_open FROM event_competitions WHERE id=?")
        .bind(id)
        .first()
    ).registration_open,
    0,
  );
  assert.equal(
    (await db.prepare("PRAGMA foreign_key_check").all()).results.length,
    0,
  );
});

test("imported rules enforce primary grade, gender pair, film coaches/work and large/unbounded ensembles; originals require login", async (t) => {
  const { mf, db, call, signup, upload } = await runtime(t);
  const admin = await signup("admin"),
    coach = await signup("coach");
  const response = await call("/api/competitions", undefined, coach.cookie);
  assert.equal(response.status, 200);
  assert.equal(response.body.competitions.length, 49);
  const find = (prefix) =>
    response.body.competitions.find((c) => c.id.startsWith(prefix));
  const mixed = find("c73-art-mixed1-"),
    film = find("c73-film-short-film-"),
    country = find("c73-music-country-male-"),
    chorus = find("c73-music-chorus-"),
    winds = find("c73-music-winds-");
  const doc = await upload(coach.cookie);
  const send = (c, students, extra = {}) =>
    call(
      "/api/registrations",
      {
        competition_id: c.id,
        request_id: crypto.randomUUID(),
        students,
        ...extra,
      },
      coach.cookie,
    );
  assert.equal((await send(mixed, [student(doc)])).status, 400);
  const valid = await send(mixed, [{ ...student(doc), grade: "ป. ๓" }]);
  assert.equal(valid.status, 201, JSON.stringify(valid.body));
  assert.equal(valid.body.registration.students[0].grade, "ป.3");
  const docs = await Promise.all([upload(coach.cookie), upload(coach.cookie)]);
  assert.equal(
    (
      await send(
        country,
        docs.slice(0, 1).map((id) => ({ ...student(id), gender: "หญิง" })),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await send(
        country,
        docs.slice(0, 1).map((id) => ({ ...student(id), gender: "ชาย" })),
      )
    ).status,
    201,
  );
  const filmDocs = [];
  for (let i = 0; i < 5; i++) filmDocs.push(await upload(coach.cookie));
  const filmStudents = filmDocs.map(student);
  assert.equal((await send(film, filmStudents)).status, 400);
  assert.equal(
    (
      await send(film, filmStudents, {
        coaches: [{ name: "ครูหนึ่ง" }, { name: "ครูสอง" }],
      })
    ).status,
    400,
  );
  const movie = await send(film, filmStudents, {
    coaches: [{ name: "ครูหนึ่ง" }, { name: "ครูสอง" }],
    work_url: "https://example.test/film",
  });
  assert.equal(movie.status, 201, JSON.stringify(movie.body));
  assert.equal(movie.body.registration.coaches.length, 2);
  assert.equal(movie.body.registration.work_url, "https://example.test/film");
  const chorusDocs = [];
  for (let i = 0; i < 25; i++) chorusDocs.push(await upload(coach.cookie));
  const choir = await send(chorus, chorusDocs.map(student));
  assert.equal(choir.status, 201, JSON.stringify(choir.body));
  assert.equal(choir.body.registration.students.length, 25);
  const windsDocs = [];
  for (let i = 0; i < 17; i++) windsDocs.push(await upload(coach.cookie));
  assert.equal(
    (await send(winds, windsDocs.slice(0, 16).map(student))).status,
    400,
  );
  const wind = await send(winds, windsDocs.map(student));
  assert.equal(wind.status, 201, JSON.stringify(wind.body));
  const largeWinds = [];
  for (let i = 0; i < 51; i++) largeWinds.push(await upload(coach.cookie));
  const large = await send(winds, largeWinds.map(student));
  assert.equal(large.status, 201, JSON.stringify(large.body));
  assert.equal(large.body.registration.students.length, 51);
  const dance = find("c73-dance-conserve-");
  const danceDocs = [];
  for (let i = 0; i < 7; i++) danceDocs.push(await upload(coach.cookie));
  assert.equal(
    (await send(dance, danceDocs.map(student), { variant: "standard" })).status,
    400,
  );
  assert.equal(
    (await send(dance, danceDocs.map(student), { variant: "sawasdi" })).status,
    201,
  );
  const detail = await call(
    "/api/competitions/" + mixed.id,
    undefined,
    coach.cookie,
  );
  assert.equal(detail.status, 200);
  assert(detail.body.competition.rules_text.includes("100"));
  assert.match(
    detail.body.competition.source_url,
    /art-73-2568-[a-f0-9]+\.pdf$/,
  );
  for (const path of ["/rules/art-73-2568.pdf", "/%72ules/art-73-2568.pdf"]) {
    const r = await mf.dispatchFetch(origin + path);
    assert.equal(r.status, 401);
  }
  const pdf = await mf.dispatchFetch(origin + "/rules/art-73-2568.pdf", {
    headers: { Cookie: coach.cookie },
  });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get("cache-control"), /private, no-store/);
  assert.equal(
    (await db.prepare("PRAGMA foreign_key_check").all()).results.length,
    0,
  );
});
