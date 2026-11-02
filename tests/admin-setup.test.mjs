import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

async function localRuntime(t) {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        { type: "ESModule", path: "server/index.js" },
        { type: "ESModule", path: "server/security.js" },
      ],
      compatibilityDate: "2026-11-02",
      d1Databases: ["DB"],
      bindings: {
        AUTH_SECRET: "local-testing-only-secret-32-characters-minimum",
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
    await migration(db, name);
  return { mf, db };
}
async function migration(db, name) {
  // Strip comment lines, then execute this project's semicolon-separated SQL statements.
  const sql = (await readFile("migrations/" + name, "utf8"))
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  for (const statement of sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
}
test("authorized migration promotes only the existing target and health verifies the assigned user without disclosing identity", async (t) => {
  const { mf, db } = await localRuntime(t);
  await db
    .prepare(
      "INSERT INTO users(id,email,name,school,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?)",
    )
    .bind(
      "owner",
      "sattawat.imc@gmail.com",
      "ครูทดสอบ",
      "โรงเรียนทดสอบ",
      "unchanged-hash",
      "participant",
      1,
    )
    .run();
  await db
    .prepare(
      "INSERT INTO users(id,email,name,school,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?)",
    )
    .bind(
      "other",
      "other@example.test",
      "ครูอื่น",
      "โรงเรียนอื่น",
      "other-hash",
      "participant",
      1,
    )
    .run();
  await migration(db, "0004_initial_admin.sql");
  await migration(db, "0004_initial_admin.sql");
  await migration(db, "0005_applicant_roles.sql");
  const owner = await db
    .prepare("SELECT * FROM users WHERE id=?")
    .bind("owner")
    .first();
  assert.equal(owner.role, "admin");
  assert.equal(owner.applicant_role, null);
  assert.equal(owner.password_hash, "unchanged-hash");
  assert.equal(owner.school, "โรงเรียนทดสอบ");
  assert.equal(
    (
      await db
        .prepare("SELECT role FROM users WHERE id=?")
        .bind("other")
        .first()
    ).role,
    "participant",
  );
  const response = await mf.dispatchFetch("https://example.test/api/health");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.adminSetupComplete, true);
  assert.equal(data.ok, true);
  assert(!JSON.stringify(data).includes("sattawat"));
  assert(!JSON.stringify(data).includes("hash"));
  await db
    .prepare("UPDATE users SET role='participant' WHERE id='owner'")
    .run();
  assert.equal(
    (await (await mf.dispatchFetch("https://example.test/api/health")).json())
      .adminSetupComplete,
    false,
  );
});
test("missing target is not fabricated and subsequent registration never gains automatic admin privileges", async (t) => {
  const { mf, db } = await localRuntime(t);
  await migration(db, "0004_initial_admin.sql");
  await migration(db, "0005_applicant_roles.sql");
  assert.equal(
    (await (await mf.dispatchFetch("https://example.test/api/health")).json())
      .adminSetupComplete,
    false,
  );
  const response = await mf.dispatchFetch(
    "https://example.test/api/auth/register",
    {
      method: "POST",
      headers: {
        Origin: "https://example.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "sattawat.imc@gmail.com",
        applicant_role: "coach",
        name: "ครูทดสอบ",
        school: "โรงเรียนทดสอบ",
        password: "local-test-passphrase-only",
      }),
    },
  );
  assert.equal(response.status, 201);
  assert.equal((await response.json()).user.role, "participant");
});
