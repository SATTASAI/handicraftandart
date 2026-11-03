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
const student = (document_id) => ({
  first_name: "นักเรียน",
  last_name: "ทดสอบ",
  grade: "ป.4",
  school: "โรงเรียนทดสอบ",
  document_id,
});
async function createCompetition(request, admin) {
  const r = await request(
    "/admin/competitions",
    {
      title: "รายการทดสอบในเครื่อง",
      grade_label: "ป.4–6",
      min_students: 1,
      max_students: 2,
      description: "ข้อมูลทดสอบเท่านั้น",
    },
    admin.cookie,
  );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.id;
}

test("coach registration, private student ID, organizer delegation, correction and final approval", async (t) => {
  const { db, request, signup, raw, upload } = await runtime(t);
  const admin = await signup("admin"),
    coach = await signup("coach"),
    other = await signup("other"),
    organizer = await signup("organizer", ["judge"]);
  assert.equal((await signup("spoof", ["organizer"])).status, 400);
  const competition_id = await createCompetition(request, admin);
  assert.equal(
    (
      await request(
        "/admin/competitions",
        { title: "Bad", min_students: 1, max_students: 1 },
        coach.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/registrations", { competition_id }, organizer.cookie))
      .status,
    403,
  );
  assert.equal((await raw("/registration-documents", "")).status, 401);
  assert.equal(
    (await raw("/registration-documents", organizer.cookie)).status,
    403,
  );
  const doc = await upload(coach.cookie),
    wrongDoc = await upload(other.cookie);
  assert.equal(
    (await raw("/registration-documents/" + doc, "", png, "image/png", "GET"))
      .status,
    401,
  );
  assert.equal(
    (
      await raw(
        "/registration-documents/" + doc,
        other.cookie,
        png,
        "image/png",
        "GET",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        "/admin/organizers",
        { user_id: organizer.body.user.id, enabled: true },
        coach.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/admin/organizers",
        { user_id: organizer.body.user.id, enabled: true },
        admin.cookie,
      )
    ).status,
    200,
  );
  assert(
    (
      await request("/me", undefined, organizer.cookie)
    ).body.user.roles.includes("organizer"),
  );
  assert.equal(
    (
      await raw(
        "/registration-documents/" + doc,
        organizer.cookie,
        png,
        "image/png",
        "GET",
      )
    ).status,
    404,
  );
  assert.equal(
    (await request("/admin/users", undefined, organizer.cookie)).status,
    403,
  );
  const payload = {
    competition_id,
    request_id: crypto.randomUUID(),
    students: [student(doc)],
    status: "approved",
    owner_id: other.body.user.id,
  };
  assert.equal(
    (
      await request(
        "/registrations",
        { ...payload, students: [student(wrongDoc)] },
        coach.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/registrations",
        { ...payload, students: [{ ...student(doc), document_id: "" }] },
        coach.cookie,
      )
    ).status,
    400,
  );
  const saved = await request("/registrations", payload, coach.cookie);
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  let row = saved.body.registration;
  assert.equal(row.status, "pending");
  assert.equal(row.owner_id, coach.body.user.id);
  assert.equal(row.students[0].school, "โรงเรียนทดสอบ");
  assert.equal(row.students[0].last_name, "ทดสอบ");
  assert.equal(
    (await request("/registrations", payload, coach.cookie)).status,
    200,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM event_registrations").first()).n,
    1,
  );
  assert.equal(
    (await request("/registrations/" + row.id, undefined, other.cookie)).status,
    404,
  );
  assert.equal(
    (await request("/registrations", undefined, other.cookie)).body
      .registrations.length,
    0,
  );
  const privateImage = await raw(
    "/registration-documents/" + doc,
    organizer.cookie,
    png,
    "image/png",
    "GET",
  );
  assert.equal(privateImage.status, 200);
  assert.match(privateImage.headers.get("cache-control"), /no-store/);
  assert.equal(privateImage.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await privateImage.arrayBuffer()), png);
  assert.equal(
    (
      await raw(
        "/registration-documents/" + doc,
        coach.cookie,
        png,
        "image/png",
        "DELETE",
      )
    ).status,
    409,
  );
  assert.equal(
    (await request("/admin/registrations", undefined, organizer.cookie)).body
      .registrations.length,
    1,
  );
  assert.equal(
    (
      await request(
        "/admin/registrations/" + row.id + "/review",
        { revision: 1, status: "approved" },
        other.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/admin/registrations/" + row.id + "/review",
        { revision: 1, status: "changes_requested" },
        organizer.cookie,
      )
    ).status,
    400,
  );
  let reviewed = await request(
    "/admin/registrations/" + row.id + "/review",
    {
      revision: 1,
      status: "changes_requested",
      note: "กรุณาแก้นามสกุลให้ตรงบัตร",
    },
    organizer.cookie,
  );
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
  assert.equal(reviewed.body.registration.status, "changes_requested");
  let edited = await request(
    "/registrations/" + row.id,
    { revision: 1, students: [{ ...student(doc), last_name: "แก้ไขแล้ว" }] },
    coach.cookie,
  );
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(edited.body.registration.revision, 2);
  assert.equal(edited.body.registration.status, "pending");
  assert.equal(edited.body.registration.reviewed_by, null);
  assert.equal(
    (
      await request(
        "/admin/registrations/" + row.id + "/review",
        { revision: 1, status: "approved" },
        organizer.cookie,
      )
    ).status,
    409,
  );
  reviewed = await request(
    "/admin/registrations/" + row.id + "/review",
    { revision: 2, status: "approved", note: "ข้อมูลและบัตรถูกต้อง" },
    organizer.cookie,
  );
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
  assert.equal(reviewed.body.registration.status, "approved");
  assert.equal(
    (
      await request(
        "/registrations/" + row.id,
        { revision: 2, students: [student(doc)] },
        coach.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM event_registration_reviews")
        .first()
    ).n,
    2,
  );
  assert.equal(
    (
      await request(
        "/admin/organizers",
        { user_id: organizer.body.user.id, enabled: false },
        admin.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/admin/registrations", undefined, organizer.cookie)).status,
    403,
  );
  assert.equal(
    (
      await raw(
        "/registration-documents/" + doc,
        organizer.cookie,
        png,
        "image/png",
        "GET",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await raw(
        "/registration-documents/" + doc,
        admin.cookie,
        png,
        "image/png",
        "GET",
      )
    ).status,
    200,
  );
});

test("document format/size, duplicate students, closed competition and reviewer cannot approve own team", async (t) => {
  const { request, signup, raw, upload } = await runtime(t);
  const admin = await signup("admin"),
    coach = await signup("coach");
  const competition_id = await createCompetition(request, admin);
  assert.equal(
    (
      await raw(
        "/registration-documents",
        coach.cookie,
        Buffer.from("<svg></svg>"),
        "image/png",
      )
    ).status,
    415,
  );
  assert.equal(
    (await raw("/registration-documents", coach.cookie, png, "image/jpeg"))
      .status,
    415,
  );
  assert.equal(
    (
      await raw(
        "/registration-documents",
        coach.cookie,
        Buffer.alloc(1048577),
        "image/png",
      )
    ).status,
    413,
  );
  const doc = await upload(coach.cookie);
  const payload = {
    competition_id,
    request_id: crypto.randomUUID(),
    students: [student(doc)],
  };
  assert.equal(
    (
      await request(
        "/registrations",
        { ...payload, students: [] },
        coach.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/registrations",
        { ...payload, students: [student(doc), student(doc)] },
        coach.cookie,
      )
    ).status,
    400,
  );
  const saved = await request("/registrations", payload, coach.cookie);
  assert.equal(saved.status, 201);
  await request(
    "/admin/organizers",
    { user_id: coach.body.user.id, enabled: true },
    admin.cookie,
  );
  assert.equal(
    (
      await request(
        "/admin/registrations/" + saved.body.registration.id + "/review",
        { revision: 1, status: "approved" },
        coach.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/admin/competitions/" + competition_id,
        { registration_open: false },
        admin.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/registrations/" + saved.body.registration.id,
        { revision: 1, students: [student(doc)] },
        coach.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/registrations",
        { ...payload, request_id: crypto.randomUUID() },
        coach.cookie,
      )
    ).status,
    409,
  );
  const orphan = await upload(coach.cookie);
  assert.equal(
    (
      await raw(
        "/registration-documents/" + orphan,
        coach.cookie,
        png,
        "image/png",
        "DELETE",
      )
    ).status,
    200,
  );
});

test("duplicate-submit race creates one team and review/edit race never approves stale data", async (t) => {
  const { db, request, signup, upload } = await runtime(t);
  const admin = await signup("admin"),
    coach = await signup("coach");
  const competition_id = await createCompetition(request, admin),
    doc = await upload(coach.cookie);
  const payload = {
    competition_id,
    request_id: crypto.randomUUID(),
    students: [student(doc)],
  };
  const submitted = await Promise.all([
    request("/registrations", payload, coach.cookie),
    request("/registrations", payload, coach.cookie),
  ]);
  assert(
    submitted.every((r) => [200, 201].includes(r.status)),
    JSON.stringify(submitted),
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM event_registrations").first()).n,
    1,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM event_students").first()).n,
    1,
  );
  const id = submitted[0].body.registration.id;
  const [edit, review] = await Promise.all([
    request(
      "/registrations/" + id,
      {
        revision: 1,
        students: [{ ...student(doc), first_name: "ข้อมูลใหม่" }],
      },
      coach.cookie,
    ),
    request(
      "/admin/registrations/" + id + "/review",
      { revision: 1, status: "approved" },
      admin.cookie,
    ),
  ]);
  assert.deepEqual(
    [edit.status, review.status].sort(),
    [200, 409],
    JSON.stringify({ edit, review }),
  );
  const final = (await request("/registrations/" + id, undefined, coach.cookie))
    .body.registration;
  if (final.status === "approved") {
    assert.equal(final.revision, 1);
    assert.equal(final.students[0].first_name, "นักเรียน");
  } else {
    assert.equal(final.revision, 2);
    assert.equal(final.status, "pending");
    assert.equal(final.students[0].first_name, "ข้อมูลใหม่");
  }
  assert.equal(
    (await db.prepare("PRAGMA foreign_key_check").all()).results.length,
    0,
  );
});

test("additive migration preserves existing account, session, password and first-superadmin marker", async (t) => {
  const id = crypto.randomUUID(),
    token = "a".repeat(64),
    hash = await hashPassword("test-existing-passphrase");
  const { db, request } = await runtime(t, async (db) => {
    await db.batch([
      db
        .prepare(
          "INSERT INTO account_users(id,name,school,email,password_hash,is_coach,is_judge,is_superadmin,created_at) VALUES(?,?,?,?,?,1,1,1,?)",
        )
        .bind(
          id,
          "บัญชีเดิม",
          "โรงเรียนเดิม",
          "existing@example.test",
          hash,
          now(),
        ),
      db.prepare("INSERT INTO account_bootstrap VALUES(1,?,?)").bind(id, now()),
      db
        .prepare("INSERT INTO account_sessions VALUES(?,?,?)")
        .bind(await digest(token), id, now() + 3600),
    ]);
  });
  const me = await request("/me", undefined, "__Host-ha_session=" + token);
  assert.equal(me.body.user.id, id);
  assert.equal(me.body.user.is_superadmin, true);
  assert.equal(me.body.user.is_organizer, false);
  assert.equal((await request("/setup")).body.firstAccountAvailable, false);
  assert.equal(
    (
      await db
        .prepare("SELECT password_hash FROM account_users WHERE id=?")
        .bind(id)
        .first()
    ).password_hash,
    hash,
  );
  assert.equal(
    (
      await request("/login", {
        email: "existing@example.test",
        password: "test-existing-passphrase",
      })
    ).status,
    200,
  );
});
