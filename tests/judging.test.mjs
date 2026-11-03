import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { hashPassword, digest, now } from "../server/security.js";
const origin = "https://registration.example.test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKD0AAAAASUVORK5CYII=",
  "base64",
);
async function runtime(t, beforeUpgrade) {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        "index.js",
        "security.js",
        "registrations.js",
        "catalog.js",
        "judging.js",
      ].map((f) => ({
        type: "ESModule",
        path: "server/" + f,
      })),
      compatibilityDate: "2026-11-02",
      d1Databases: ["DB"],
    }),
  );
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  for (const f of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (f.startsWith("0012") && beforeUpgrade) await beforeUpgrade(db);
    await db.exec(await readFile("migrations/" + f, "utf8"));
  }
  async function request(path, data, cookie = "", method) {
    const r = await mf.dispatchFetch(origin + "/api" + path, {
      method: method || (data === undefined ? "GET" : "POST"),
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
  const signup = (id, roles = ["coach"]) =>
    request("/signup", {
      name: "ครู " + id,
      school: "โรงเรียน " + id,
      email: id + "@example.test",
      password: "test-only-passphrase-2026",
      roles,
    });
  const raw = (
    path,
    cookie,
    bytes = png,
    type = "image/png",
    method = "POST",
  ) =>
    mf.dispatchFetch(origin + "/api" + path, {
      method,
      headers: { Cookie: cookie, Origin: origin, "Content-Type": type },
      ...(method === "POST" ? { body: bytes } : {}),
    });
  const upload = async (cookie) => {
    const r = await raw("/registration-documents", cookie);
    const b = await r.json();
    assert.equal(r.status, 201, JSON.stringify(b));
    return b.id;
  };
  return { db, request, signup, raw, upload };
}
const student = (document_id, first_name = "นักเรียน") => ({
  first_name,
  last_name: "ทดสอบ",
  grade: "ป.4",
  school: "โรงเรียนทดสอบ",
  document_id,
});

test("judge assignment, scoring, ranking, medals, results and certificates", async (t) => {
  const { request, signup, upload } = await runtime(t);
  const admin = await signup("admin"),
    coachA = await signup("coacha"),
    coachB = await signup("coachb", ["coach", "judge"]),
    judge = await signup("judge1", ["judge"]),
    plain = await signup("plain");
  const c = await request(
    "/admin/competitions",
    { title: "รายการทดสอบ", grade_label: "ป.4–6", min_students: 1, max_students: 1, description: "ทดสอบ" },
    admin.cookie,
  );
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const competition_id = c.body.id;
  const team = async (coach, name) => {
    const s = await request(
      "/registrations",
      { competition_id, request_id: crypto.randomUUID(), students: [student(await upload(coach.cookie), name)] },
      coach.cookie,
    );
    assert.equal(s.status, 201, JSON.stringify(s.body));
    const a = await request("/admin/registrations/" + s.body.registration.id + "/review", { revision: 1, status: "approved" }, admin.cookie);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    return s.body.registration.id;
  };
  const teamA = await team(coachA, "เอ"), teamB = await team(coachB, "บี");
  // Same student cannot be entered twice in one competition, even by another coach.
  const dupe = await request(
    "/registrations",
    { competition_id, request_id: crypto.randomUUID(), students: [student(await upload(coachB.cookie), "เอ")] },
    coachB.cookie,
  );
  assert.equal(dupe.status, 409, JSON.stringify(dupe.body));
  const late = await request(
    "/registrations",
    { competition_id, request_id: crypto.randomUUID(), students: [student(await upload(coachA.cookie), "ซี")] },
    coachA.cookie,
  );
  assert.equal(late.status, 201);
  // Only superadmin assigns; only judge-role accounts may be assigned.
  assert.equal((await request("/admin/judges", { competition_id, judge_id: judge.body.user.id, assigned: true }, coachB.cookie)).status, 403);
  assert.equal((await request("/admin/judges", { competition_id, judge_id: plain.body.user.id, assigned: true }, admin.cookie)).status, 400);
  for (const j of [judge, coachB])
    assert.equal((await request("/admin/judges", { competition_id, judge_id: j.body.user.id, assigned: true }, admin.cookie)).status, 200);
  const list = await request("/admin/judges?competition_id=" + competition_id, undefined, admin.cookie);
  assert.equal(list.body.judges.filter((x) => x.assigned).length, 2);
  // Unassigned account cannot score.
  assert.equal((await request("/judging/" + competition_id, undefined, coachA.cookie)).status, 403);
  const view = await request("/judging/" + competition_id, undefined, coachB.cookie);
  assert.equal(view.status, 200);
  assert.equal(view.body.criteria[0].max, 100);
  assert.equal(view.body.teams.find((x) => x.id === teamB).own, true);
  const score = (j, id, v) => request("/judging/" + competition_id + "/scores", { registration_id: id, revision: 1, scores: [v] }, j.cookie);
  assert.equal((await score(coachB, teamB, 99)).status, 409, "no self-judging");
  assert.equal((await score(judge, teamA, 101)).status, 400);
  assert.equal((await score(judge, teamA, 70)).status, 200);
  // Once scoring starts, no new teams or approvals (published results must not shift).
  assert.equal((await request("/admin/registrations/" + late.body.registration.id + "/review", { revision: 1, status: "approved" }, admin.cookie)).status, 409);
  assert.equal((await request("/registrations", { competition_id, request_id: crypto.randomUUID(), students: [student(await upload(coachA.cookie), "ดี")] }, coachA.cookie)).status, 409);
  // Partial results hidden from non-reviewers.
  assert.equal((await request("/results/" + competition_id, undefined, coachA.cookie)).status, 404);
  assert.equal((await request("/results", undefined, coachA.cookie)).body.competitions.length, 0);
  assert.equal((await request("/results", undefined, admin.cookie)).body.competitions[0].complete, false);
  assert.equal((await score(coachB, teamA, 90)).status, 200);
  assert.equal((await score(judge, teamB, 65.5)).status, 200);
  const res = await request("/results/" + competition_id, undefined, coachA.cookie);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.complete, true);
  const [first, second] = res.body.teams;
  assert.equal(first.registration_id, teamA);
  assert.equal(first.score, 80);
  assert.equal(first.medal, "เหรียญทอง");
  assert.equal(first.rank_label, "ชนะเลิศ");
  assert.equal(second.score, 65.5, "own-team judge excluded from average");
  assert.equal(second.medal, "เหรียญทองแดง");
  assert.equal(second.rank_label, "รองชนะเลิศอันดับ 1");
  assert.equal(first.owner_id, undefined);
  // Certificates: coaches only see own teams.
  const certA = await request("/certificates", undefined, coachA.cookie);
  assert.deepEqual(certA.body.certificates.map((x) => x.registration_id), [teamA]);
  assert.equal(certA.body.certificates[0].students[0].first_name, "เอ");
  assert.equal((await request("/certificates", undefined, admin.cookie)).body.certificates.length, 2);
  assert.equal((await request("/certificate-settings", { organization: "x" }, coachA.cookie)).status, 403);
  const saved = await request("/certificate-settings", { organization: "ศูนย์ทดสอบ", signers: [{ name: "ผู้ลงนาม", position: "ประธาน" }] }, admin.cookie);
  assert.equal(saved.status, 200);
  assert.equal((await request("/certificates", undefined, coachA.cookie)).body.settings.organization, "ศูนย์ทดสอบ");
  // Unassigning a judge drops their scores from the result.
  await request("/admin/judges", { competition_id, judge_id: coachB.body.user.id, assigned: false }, admin.cookie);
  assert.equal((await request("/results/" + competition_id, undefined, coachA.cookie)).body.teams[0].score, 70);
});
