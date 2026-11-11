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
        "mail.js",
        "drive.js", "admin.js",
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
  assert.equal(certA.body.certificates[0].coach_certificate, true);
  assert.equal(certA.body.judge_certificates.length, 0, "coach not assigned as judge");
  // Assigned judge sees every team's students (no coach certificate) plus own judge certificate.
  const certJ = await request("/certificates", undefined, judge.cookie);
  assert.equal(certJ.body.certificates.length, 2);
  assert.ok(certJ.body.certificates.every((x) => !x.coach_certificate && !x.own));
  assert.deepEqual(certJ.body.judge_certificates.map((x) => x.judges.map((j) => j.name)), [["ครู judge1"]]);
  // Coach who is also a judge: own team gets coach certificate, others do not.
  const certB = await request("/certificates", undefined, coachB.cookie);
  assert.deepEqual(certB.body.certificates.filter((x) => x.coach_certificate).map((x) => x.registration_id), [teamB]);
  assert.equal(certB.body.judge_certificates.length, 1);
  assert.equal((await request("/certificates", undefined, plain.cookie)).body.certificates.length, 0);
  assert.equal((await request("/certificates", undefined, admin.cookie)).body.judge_certificates[0].judges.length, 2);
  assert.equal((await request("/certificates", undefined, admin.cookie)).body.certificates.length, 2);
  assert.equal((await request("/certificate-settings", { organization: "x" }, coachA.cookie)).status, 403);
  const saved = await request("/certificate-settings", { organization: "ศูนย์ทดสอบ", signers: [{ name: "ผู้ลงนาม", position: "ประธาน" }] }, admin.cookie);
  assert.equal(saved.status, 200);
  assert.equal((await request("/certificates", undefined, coachA.cookie)).body.settings.organization, "ศูนย์ทดสอบ");
  // Unassigning a judge drops their scores from the result.
  await request("/admin/judges", { competition_id, judge_id: coachB.body.user.id, assigned: false }, admin.cookie);
  assert.equal((await request("/results/" + competition_id, undefined, coachA.cookie)).body.teams[0].score, 70);
});

test("superadmin deletes accounts and resets competition data", async (t) => {
  const { db, request, signup, upload } = await runtime(t);
  const admin = await signup("admin"),
    coach = await signup("coachx", ["coach", "judge"]),
    other = await signup("coachy");
  const c = await request(
    "/admin/competitions",
    { title: "รายการลบ", grade_label: "ป.4–6", min_students: 1, max_students: 1, description: "ทดสอบ" },
    admin.cookie,
  );
  const competition_id = c.body.id;
  const reg = async (who, name) => {
    const s = await request("/registrations", { competition_id, request_id: crypto.randomUUID(), students: [student(await upload(who.cookie), name)] }, who.cookie);
    assert.equal(s.status, 201, JSON.stringify(s.body));
    await request("/admin/registrations/" + s.body.registration.id + "/review", { revision: 1, status: "approved" }, admin.cookie);
    return s.body.registration.id;
  };
  await reg(coach, "หนึ่ง");
  const otherTeam = await reg(other, "สอง");
  await request("/admin/judges", { competition_id, judge_id: coach.body.user.id, assigned: true }, admin.cookie);
  assert.equal((await request("/judging/" + competition_id + "/scores", { registration_id: otherTeam, revision: 1, scores: [75] }, coach.cookie)).status, 200);
  const del = (id, who) => request("/admin/users/" + id + "/delete", { confirm: "ลบถาวร" }, who.cookie);
  assert.equal((await del(other.body.user.id, coach)).status, 403);
  assert.equal((await del(admin.body.user.id, admin)).status, 400);
  const ok = await del(coach.body.user.id, admin);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM account_users WHERE id=?").bind(coach.body.user.id).first()).n, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM event_scores").first()).n, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM event_registrations").first()).n, 1);
  assert.equal((await request("/me", undefined, coach.cookie)).body.user, null);
  assert.equal((await request("/admin/reset-competition-data", { confirm: "x" }, admin.cookie)).status, 400);
  assert.equal((await request("/admin/reset-competition-data", { confirm: "ล้างข้อมูล" }, other.cookie)).status, 403);
  assert.equal((await request("/admin/reset-competition-data", { confirm: "ล้างข้อมูล" }, admin.cookie)).status, 200);
  for (const table of ["event_registrations", "event_students", "registration_documents", "event_scores"])
    assert.equal((await db.prepare("SELECT COUNT(*) n FROM " + table).first()).n, 0, table);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM account_users").first()).n, 2);
  assert.equal((await db.prepare("PRAGMA foreign_key_check").all()).results.length, 0);
});

test("superadmin can close and reopen the system", async (t) => {
  const { request, signup } = await runtime(t);
  const admin = await signup("admin"),
    coach = await signup("coachz");
  assert.equal((await request("/admin/system", { enabled: false }, coach.cookie)).status, 403);
  assert.equal((await request("/admin/system", { enabled: false }, admin.cookie)).status, 200);
  assert.equal((await request("/me", undefined, coach.cookie)).body.system_closed, true);
  assert.equal((await request("/competitions", undefined, coach.cookie)).status, 503);
  assert.equal((await request("/competitions", undefined, admin.cookie)).status, 200);
  assert.equal((await signup("late")).status, 503);
  assert.equal((await request("/login", { email: "coachz@example.test", password: "test-only-passphrase-2026" })).status, 503);
  assert.equal((await request("/login", { email: "admin@example.test", password: "test-only-passphrase-2026" })).status, 200);
  assert.equal((await request("/admin/system", { enabled: true }, admin.cookie)).status, 200);
  assert.equal((await request("/competitions", undefined, coach.cookie)).status, 200);
});

test("a new round rebuilds competitions from the retained catalog and preserves accounts", async (t) => {
  const { db, request, signup, upload } = await runtime(t);
  const admin = await signup("roundadmin");
  const coach = await signup("roundcoach", ["coach", "judge"]);
  const { id: competition_id } = (await request("/admin/competitions", {
    title: "รายการรอบเดิม", grade_label: "ป.4–6", min_students: 1, max_students: 1,
  }, admin.cookie)).body;
  const registration = await request("/registrations", {
    competition_id, request_id: crypto.randomUUID(),
    students: [student(await upload(coach.cookie), "ทดสอบ")],
  }, coach.cookie);
  assert.equal(registration.status, 201, JSON.stringify(registration.body));
  await request(`/admin/registrations/${registration.body.registration.id}/review`, { revision: 1, status: "approved" }, admin.cookie);
  await request("/admin/judges", { competition_id, judge_id: coach.body.user.id, assigned: true }, admin.cookie);

  const portal = await request("/portal");
  assert.equal(portal.status, 200);
  assert.equal(portal.body.stats.students, 1);
  assert.equal(portal.body.stats.schools, 1);
  assert.equal(portal.body.stats.judges, 1);
  assert.deepEqual(Object.keys(portal.body.stats).sort(), ["activities", "coaches", "judges", "open_activities", "schools", "students", "teams"]);
  const catalog = (await db.prepare("SELECT id,title,rules_json FROM competition_catalog ORDER BY id").all()).results;
  assert.ok(catalog.length > 0);
  await db.prepare("UPDATE event_competitions SET venue='สนามเดิม',starts_at='2026-02-10',registration_open=0 WHERE catalog_key IS NOT NULL").run();
  await db.exec("INSERT INTO app_settings(key,value,updated_at) VALUES('certificate','{}',1),('drive_folder:root','\"root\"',1)");
  const newRound = (who, confirm = "เริ่มรอบใหม่") => request("/admin/start-new-round", { confirm }, who.cookie);
  assert.equal((await newRound(coach)).status, 403);
  assert.equal((await newRound(admin, "ไม่ถูกต้อง")).status, 400);
  assert.equal((await newRound(admin)).status, 409);
  await request("/admin/system", { enabled: false }, admin.cookie);
  assert.deepEqual((await request("/portal")).body, { system_closed: true, stats: null });

  const reset = await newRound(admin);
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.deepEqual(reset.body, { ok: true, remaining: 0 });
  for (const table of ["event_registrations", "event_students", "registration_documents", "event_scores", "event_judges", "event_registration_reviews", "certificate_files"])
    assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n, 0, table);
  assert.deepEqual((await db.prepare("SELECT id,title,rules_json FROM event_competitions ORDER BY id").all()).results, catalog);
  assert.deepEqual((await db.prepare("SELECT id,title,rules_json FROM competition_catalog ORDER BY id").all()).results, catalog);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM event_competitions WHERE venue<>'' OR starts_at<>''").first()).n, 0);
  assert.deepEqual((await db.prepare("SELECT key FROM app_settings ORDER BY key").all()).results.map(row => row.key), ["drive_folder:root", "system_enabled"]);
  assert.equal((await request("/me", undefined, coach.cookie)).body.user.id, coach.body.user.id);
  await request("/admin/system", { enabled: true }, admin.cookie);
  assert.equal((await request("/portal")).body.stats.students, 0);
  assert.equal((await db.prepare("PRAGMA foreign_key_check").all()).results.length, 0);
});

test("superadmin console manages accounts, rules, team evidence, scoring and publication", async (t) => {
  const { db, request, signup, raw, upload } = await runtime(t);
  const admin = await signup("console-admin");
  const coach = await signup("console-coach");
  const judge = await signup("console-judge", ["judge"]);
  const read = (path, who = admin) => request(path, undefined, who.cookie);
  const write = (path, data, who = admin) => request(path, data, who.cookie);
  const root = "/admin/console/";
  const userId = coach.body.user.id;
  assert.equal((await request(root + "overview")).status, 401);
  assert.equal((await read(root + "overview", coach)).status, 403);
  const created = await write(root + "users", {
    name: "ครูใหม่", school: "โรงเรียนทดสอบ", email: "created@example.test",
    coach: true, judge: false, password: "temporary-test-only-passphrase",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.user.is_superadmin, false);
  assert.equal((await write(root + "users/" + userId, {
    name: "ครูผู้ฝึกซ้อมใหม่", school: "โรงเรียนทดสอบ", email: coach.body.user.email,
    coach: true, judge: false,
  })).status, 200);
  assert.equal((await write("/admin/users/" + created.body.user.id + "/delete", {})).status, 400);
  assert.equal((await write("/admin/users/" + created.body.user.id + "/delete", { confirm: "ลบถาวร" })).status, 200);
  const competition = await write("/admin/competitions", {
    title: "รายการของแอดมิน", min_students: 1, max_students: 1,
  });
  const id = competition.body.id;
  const scoring = root + "scoring/" + id;
  const publish = root + "results/" + id;
  const edit = {
    title: "การแข่งขันใหม่", category: "ทดสอบ", grade_label: "ป.4",
    venue: "อาคารหนึ่ง", starts_at: "2026-11-15T02:00:00.000Z", min_students: 1, max_students: null,
    registration_open: false, criteria: [{ label: "ผลงาน", max: 80 }],
    eligibility: { grades: ["ป.4"], gender: "", coach_min: 1, coach_max: null, work_required: false },
  };
  const updated = await write(root + "competitions/" + id, edit);
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  const list = await read("/competitions");
  const info = list.body.competitions.find(c => c.id === id);
  assert.equal(info.venue, edit.venue);
  assert.equal(info.max_students, null);
  const image = await upload(admin.cookie);
  const entry = await write("/admin/registrations/create", {
    competition_id: id, owner_id: userId, request_id: crypto.randomUUID(), students: [student(image)],
  });
  assert.equal(entry.status, 201, JSON.stringify(entry.body));
  const team = entry.body.registration;
  assert.equal(team.owner_id, userId);
  assert.equal((await raw("/registration-documents/" + image, coach.cookie, undefined, undefined, "GET")).status, 200);
  const review = (revision) => write("/admin/registrations/" + team.id + "/review", { revision, status: "approved" });
  assert.equal((await review(1)).status, 200);
  const judgeId = judge.body.user.id;
  assert.equal((await write("/admin/judges", { competition_id: id, judge_id: judgeId, assigned: true })).status, 200);
  const score = { registration_id: team.id, judge_id: judgeId, revision: 1, scores: [75] };
  assert.equal((await write(scoring, score, judge)).status, 403);
  assert.equal((await write(scoring, { ...score, scores: [81] })).status, 400);
  assert.equal((await write(scoring, score)).status, 200);
  assert.equal((await read("/results/" + id, coach)).body.teams[0].score, 75);
  assert.equal((await write(root + "competitions/" + id, { ...edit, criteria: [{ label: "ผลงาน", max: 100 }] })).status, 409);
  assert.equal((await write(publish, { action: "hold" })).status, 200);
  assert.equal((await read("/results/" + id, coach)).status, 404);
  assert.equal((await read("/certificates", coach)).body.certificates.length, 0);
  assert.equal((await write(publish, { action: "publish" })).status, 200);
  assert.equal((await read("/results/" + id, coach)).status, 200);
  const replacement = await upload(admin.cookie);
  const update = await write("/admin/registrations/" + team.id + "/edit", {
    revision: 1, confirm: "ยืนยันแก้ไข", students: [student(replacement, "นักเรียนใหม่")],
  });
  assert.equal(update.status, 200, JSON.stringify(update.body));
  assert.equal(update.body.registration.status, "pending");
  assert.equal(update.body.registration.revision, 2);
  assert.equal((await raw("/registration-documents/" + image, admin.cookie, undefined, undefined, "GET")).status, 404);
  assert.equal((await read(scoring)).body.scores.length, 0);
  assert.equal((await review(2)).status, 200);
  assert.equal((await write(scoring, { ...score, revision: 2 })).status, 200);
  assert.equal((await read("/results/" + id, coach)).status, 404);
  assert.equal((await write(scoring, { ...score, revision: 2, action: "delete", confirm: "ลบถาวร" })).status, 200);
  const removeTeam = root + "registrations/" + team.id + "/delete";
  assert.equal((await write(removeTeam, { revision: 1, confirm: "ลบถาวร" })).status, 409);
  assert.equal((await write(removeTeam, { revision: 2, confirm: "ลบถาวร" })).status, 200);
  assert.equal((await raw("/registration-documents/" + replacement, admin.cookie, undefined, undefined, "GET")).status, 404);
  assert.equal((await write(root + "competitions/" + id, { action: "delete", confirm: "ลบถาวร" })).status, 409);
  assert.equal((await write("/admin/judges", { competition_id: id, judge_id: judgeId, assigned: false })).status, 200);
  assert.equal((await write(root + "competitions/" + id, { action: "delete", confirm: "ลบถาวร" })).status, 200);
  const imported = list.body.competitions.find(c => c.catalog_key);
  assert.equal((await write(root + "competitions/" + imported.id, { action: "delete", confirm: "ลบถาวร" })).status, 200);
  assert.equal((await read("/competitions")).body.competitions.some(c => c.id === imported.id), false);
  assert.equal((await read(root + "overview")).body.registrations, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM account_bootstrap").first()).n, 1);
});

test("trash restores deleted scores, teams, accounts and competitions; portal content is editable", async (t) => {
  const { db, request, signup, raw, upload } = await runtime(t);
  const admin = await signup("trash-admin");
  const coach = await signup("trash-coach");
  const judge = await signup("trash-judge", ["judge"]);
  const read = (path, who = admin) => request(path, undefined, who.cookie);
  const write = (path, data, who = admin) => request(path, data, who.cookie);
  const root = "/admin/console/";
  const count = async (table) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n;
  const { id } = (await write("/admin/competitions", { title: "รายการถังขยะ", min_students: 1, max_students: 1 })).body;
  const image = await upload(coach.cookie);
  const entry = await write("/registrations", {
    competition_id: id, request_id: crypto.randomUUID(), students: [student(image)],
  }, coach);
  assert.equal(entry.status, 201, JSON.stringify(entry.body));
  const team = entry.body.registration;
  assert.equal((await write(`/admin/registrations/${team.id}/review`, { revision: 1, status: "approved" })).status, 200);
  const judgeId = judge.body.user.id;
  assert.equal((await write("/admin/judges", { competition_id: id, judge_id: judgeId, assigned: true })).status, 200);
  const scoring = root + "scoring/" + id;
  const score = { registration_id: team.id, judge_id: judgeId, revision: 1, scores: [75] };
  assert.equal((await write(scoring, score)).status, 200);
  const trash = async () => (await read(root + "trash")).body.items;
  const restore = async (kind) => {
    const result = await write(root + "trash/" + (await trash()).find((item) => item.kind === kind).id, { action: "restore" });
    assert.equal(result.status, 200, kind + " " + JSON.stringify(result.body));
  };
  assert.equal((await read(root + "trash", coach)).status, 403);

  assert.equal((await write(scoring, { ...score, action: "delete", confirm: "ถังขยะ" })).status, 200);
  assert.equal(await count("event_scores"), 0);
  assert.equal((await read(root + "overview")).body.trash, 1);
  await restore("score");
  assert.equal((await read(scoring)).body.scores.length, 1);

  const removeTeam = root + "registrations/" + team.id + "/delete";
  assert.equal((await write(removeTeam, { revision: 1, confirm: "ถังขยะ" })).status, 200);
  assert.equal(await count("event_registrations"), 0);
  assert.equal(await count("event_students"), 0);
  assert.equal(await count("registration_documents"), 1);
  assert.equal((await raw("/registration-documents/" + image, coach.cookie, undefined, undefined, "DELETE")).status, 409);
  await restore("registration");
  assert.equal((await read("/registrations/" + team.id, coach)).body.registration.students.length, 1);
  assert.equal(await count("event_scores"), 1);

  const account = "/admin/users/" + coach.body.user.id + "/delete";
  assert.equal((await write(account, { confirm: "ถังขยะ" })).status, 200);
  assert.equal(await count("event_registrations"), 0);
  assert.equal(await count("registration_documents"), 1);
  assert.equal((await read("/me", coach)).body.user, null);
  await restore("user");
  const login = await request("/login", { email: coach.body.user.email, password: "test-only-passphrase-2026" });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal((await request("/registrations/" + team.id, undefined, login.cookie)).body.registration.owner_id, coach.body.user.id);
  assert.equal((await raw("/registration-documents/" + image, login.cookie, undefined, undefined, "GET")).status, 200);
  assert.equal((await read(scoring)).body.scores.length, 1);

  assert.equal((await write(removeTeam, { revision: 1, confirm: "ถังขยะ" })).status, 200);
  const purge = root + "trash/" + (await trash())[0].id;
  assert.equal((await write(purge, { action: "purge" })).status, 400);
  assert.equal((await write(purge, { action: "purge", confirm: "ลบถาวร" })).status, 200);
  assert.equal(await count("registration_documents"), 0);

  const competition = root + "competitions/" + id;
  assert.equal((await write(competition, { action: "delete", confirm: "ถังขยะ" })).status, 409);
  assert.equal((await write("/admin/judges", { competition_id: id, judge_id: judgeId, assigned: false })).status, 200);
  assert.equal((await write(competition, { action: "delete", confirm: "ถังขยะ" })).status, 200);
  assert.equal((await read("/competitions")).body.competitions.some((c) => c.id === id), false);
  await restore("competition");
  assert.equal((await read("/competitions")).body.competitions.some((c) => c.id === id), true);
  assert.equal((await trash()).length, 0);
  assert.equal((await db.prepare("PRAGMA foreign_key_check").all()).results.length, 0);

  const portal = root + "portal";
  assert.equal((await write(portal, { title: "x" }, judge)).status, 403);
  assert.equal((await write(portal, { news: [{ title: "ข่าว", url: "javascript:alert(1)" }] })).status, 400);
  const saved = await write(portal, {
    title: " งานใหม่ ", countdown_at: "2026-12-01T02:00:00.000Z",
    news: [{ title: "ข่าวแรก", date: "2026-11-11", url: "https://example.test/a" }],
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const page = (await request("/portal")).body;
  assert.equal(page.content.title, "งานใหม่");
  assert.equal(page.content.news[0].title, "ข่าวแรก");
});
