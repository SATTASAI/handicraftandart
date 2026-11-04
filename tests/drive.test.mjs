import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
const origin = "https://drive.example.test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKD0AAAAASUVORK5CYII=",
  "base64",
);
const drive = {
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  GOOGLE_REFRESH_TOKEN: "test-refresh",
};

// In-memory stand-in for the Google OAuth + Drive v3 endpoints the Worker uses.
function fakeGoogle() {
  const files = new Map(),
    sessions = new Map(),
    calls = [];
  let n = 0;
  async function handler(req) {
    const url = new URL(req.url);
    calls.push(req.method + " " + url.host + url.pathname);
    if (url.host === "oauth2.googleapis.com")
      return Response.json({ access_token: "ya29.test", expires_in: 3600 });
    if (req.headers.get("authorization") !== "Bearer ya29.test" && url.host !== "upload.fake")
      return new Response("unauthorized", { status: 401 });
    if (url.host === "upload.fake") {
      const meta = sessions.get(url.pathname);
      const id = "file" + ++n;
      files.set(id, { ...meta, bytes: new Uint8Array(await req.arrayBuffer()) });
      return Response.json({ id });
    }
    if (url.pathname.startsWith("/upload/drive/v3/files") && req.method === "POST") {
      const session = "/s" + ++n;
      sessions.set(session, await req.json());
      return new Response("", { headers: { Location: "https://upload.fake" + session } });
    }
    if (url.pathname === "/drive/v3/files" && req.method === "POST") {
      const id = "folder" + ++n;
      files.set(id, { ...(await req.json()), folder: true });
      return Response.json({ id });
    }
    const m = url.pathname.match(/^\/drive\/v3\/files\/(.+)$/);
    if (m && req.method === "GET") {
      const f = files.get(decodeURIComponent(m[1]));
      return f ? new Response(f.bytes) : new Response("nf", { status: 404 });
    }
    if (m && req.method === "DELETE") {
      files.delete(decodeURIComponent(m[1]));
      return new Response(null, { status: 204 });
    }
    return new Response("unexpected", { status: 500 });
  }
  return { files, calls, handler, stored: () => [...files.values()].filter((f) => !f.folder) };
}

async function runtime(t, google) {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: ["index.js", "security.js", "registrations.js", "catalog.js", "judging.js", "mail.js", "drive.js"].map(
        (f) => ({ type: "ESModule", path: "server/" + f }),
      ),
      compatibilityDate: "2026-11-02",
      d1Databases: ["DB"],
      ...(google ? { bindings: drive, outboundService: google.handler } : {}),
    }),
  );
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  for (const f of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(await readFile("migrations/" + f, "utf8"));
  const raw = (path, cookie, init = {}) =>
    mf.dispatchFetch(origin + "/api" + path, {
      ...init,
      headers: { Cookie: cookie, ...(init.method && init.method !== "GET" ? { Origin: origin } : {}), ...(init.headers || {}) },
    });
  async function request(path, data, cookie = "", method) {
    const r = await raw(path, cookie, {
      method: method || (data === undefined ? "GET" : "POST"),
      ...(data === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    });
    return { status: r.status, body: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  }
  const signup = (id, roles = ["coach"]) =>
    request("/signup", {
      name: "ครู " + id,
      school: "โรงเรียน " + id,
      email: id + "@example.test",
      password: "test-only-passphrase-2026",
      roles,
    });
  const upload = async (cookie) => {
    const r = await raw("/registration-documents", cookie, { method: "POST", headers: { "Content-Type": "image/png" }, body: png });
    const b = await r.json();
    assert.equal(r.status, 201, JSON.stringify(b));
    return b.id;
  };
  const student = (document_id, first_name) => ({ first_name, last_name: "ทดสอบ", grade: "ป.4", school: "โรงเรียนทดสอบ", document_id });
  return { db, raw, request, signup, upload, student };
}

test("without Google secrets ID images stay in D1 and certificate files are unavailable", async (t) => {
  const { db, raw, request, signup, upload } = await runtime(t);
  const admin = await signup("admin");
  const id = await upload(admin.cookie);
  const row = await db.prepare("SELECT drive_file_id,length(data) AS n FROM registration_documents WHERE id=?").bind(id).first();
  assert.equal(row.drive_file_id, null);
  assert.equal(row.n, png.length);
  const img = await raw("/registration-documents/" + id, admin.cookie);
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), png);
  const storage = await request("/admin/storage", undefined, admin.cookie);
  assert.equal(storage.body.drive, false);
  assert.equal(storage.body.documents_in_d1, 1);
  assert.equal((await request("/admin/storage/migrate", {}, admin.cookie)).status, 503);
});

test("ID images go to Drive, are served from Drive and removed from Drive with their rows", async (t) => {
  const google = fakeGoogle();
  const { db, raw, request, signup, upload, student } = await runtime(t, google);
  const admin = await signup("admin"),
    coach = await signup("coach"),
    other = await signup("other");
  const id = await upload(coach.cookie);
  const row = await db.prepare("SELECT drive_file_id,length(data) AS n FROM registration_documents WHERE id=?").bind(id).first();
  assert.ok(row.drive_file_id);
  assert.equal(row.n, 0);
  assert.deepEqual(Buffer.from(google.files.get(row.drive_file_id).bytes), png);
  // Root folder + ID folder are created once and reused.
  const second = await upload(coach.cookie);
  assert.equal([...google.files.values()].filter((f) => f.folder).length, 2);
  const img = await raw("/registration-documents/" + id, coach.cookie);
  assert.equal(img.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), png);
  assert.equal((await raw("/registration-documents/" + id, other.cookie)).status, 404);
  // Unused upload deleted by owner -> Drive file deleted too.
  const secondDrive = (await db.prepare("SELECT drive_file_id FROM registration_documents WHERE id=?").bind(second).first()).drive_file_id;
  assert.equal((await raw("/registration-documents/" + second, coach.cookie, { method: "DELETE" })).status, 200);
  assert.equal(google.files.has(secondDrive), false);
  // Replacing an image while editing a team deletes the replaced Drive file.
  const c = await request("/admin/competitions", { title: "รายการ", min_students: 1, max_students: 1 }, admin.cookie);
  const s = await request("/registrations", { competition_id: c.body.id, request_id: crypto.randomUUID(), students: [student(id, "เอ")] }, coach.cookie);
  assert.equal(s.status, 201, JSON.stringify(s.body));
  const replacement = await upload(coach.cookie);
  const e = await request("/registrations/" + s.body.registration.id, { revision: 1, students: [student(replacement, "เอ")] }, coach.cookie);
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.equal(google.files.has(row.drive_file_id), false);
  assert.equal(google.stored().length, 1);
  // Organizer-visible submitted document still served from Drive.
  const doc = await raw("/registration-documents/" + replacement, admin.cookie);
  assert.equal(doc.status, 200);
});

test("superadmin moves old D1 ID images into Drive in batches", async (t) => {
  const google = fakeGoogle();
  const { db, raw, request, signup } = await runtime(t, google);
  const admin = await signup("admin"),
    coach = await signup("coach");
  const owner = (await db.prepare("SELECT id FROM account_users WHERE email='coach@example.test'").first()).id;
  for (let i = 0; i < 13; i++)
    await db
      .prepare("INSERT INTO registration_documents(id,owner_id,content_type,size,data,created_at) VALUES(?,?,'image/png',?,?,?)")
      .bind(crypto.randomUUID(), owner, png.length, png, Math.floor(Date.now() / 1000))
      .run();
  assert.equal((await request("/admin/storage/migrate", {}, coach.cookie)).status, 403);
  const first = await request("/admin/storage/migrate", {}, admin.cookie);
  assert.deepEqual(first.body, { moved: 10, remaining: 3 });
  const second = await request("/admin/storage/migrate", {}, admin.cookie);
  assert.deepEqual(second.body, { moved: 3, remaining: 0 });
  const status = await request("/admin/storage", undefined, admin.cookie);
  assert.equal(status.body.documents_in_drive, 13);
  assert.equal(status.body.d1_document_bytes, 0);
  const left = await db.prepare("SELECT SUM(length(data)) AS n FROM registration_documents").first();
  assert.equal(left.n, 0);
  const one = (await db.prepare("SELECT id FROM registration_documents LIMIT 1").first()).id;
  assert.deepEqual(Buffer.from(await (await raw("/registration-documents/" + one, coach.cookie)).arrayBuffer()), png);
});

test("certificate PDFs are saved once in Drive per unit and refreshed when printed data changes", async (t) => {
  const google = fakeGoogle();
  const { raw, request, signup, upload, student } = await runtime(t, google);
  const admin = await signup("admin"),
    coachA = await signup("coacha"),
    coachB = await signup("coachb"),
    judge = await signup("judge1", ["judge"]);
  const c = await request("/admin/competitions", { title: "รายการ", min_students: 1, max_students: 1 }, admin.cookie);
  const competition_id = c.body.id;
  const team = async (coach, name) => {
    const s = await request("/registrations", { competition_id, request_id: crypto.randomUUID(), students: [student(await upload(coach.cookie), name)] }, coach.cookie);
    await request("/admin/registrations/" + s.body.registration.id + "/review", { revision: 1, status: "approved" }, admin.cookie);
    return s.body.registration.id;
  };
  const teamA = await team(coachA, "เอ"),
    teamB = await team(coachB, "บี");
  await request("/admin/judges", { competition_id, judge_id: judge.body.user.id, assigned: true }, admin.cookie);
  for (const [id, v] of [[teamA, 85], [teamB, 65]])
    await request("/judging/" + competition_id + "/scores", { registration_id: id, revision: 1, scores: [v] }, judge.cookie);

  const list = await request("/certificates", undefined, coachA.cookie);
  assert.equal(list.body.drive, true);
  const file = list.body.certificates[0].files.student;
  assert.equal(file.key, "student." + teamA);
  assert.equal(file.stored, false);
  assert.ok(list.body.certificates[0].files.coach);
  const pdf = Buffer.from("%PDF-1.4\n% test certificate\n%%EOF");
  const post = (key, cookie, fingerprint, body = pdf, type = "application/pdf") =>
    raw("/certificate-files/" + key, cookie, {
      method: "POST",
      headers: { "Content-Type": type, "X-Certificate-Fingerprint": fingerprint },
      body,
    });
  assert.equal((await raw("/certificate-files/" + file.key, coachA.cookie)).status, 404);
  assert.equal((await post(file.key, coachA.cookie, "0".repeat(64))).status, 409);
  assert.equal((await post(file.key, coachA.cookie, file.fingerprint, Buffer.from("not a pdf"))).status, 415);
  // Other coach cannot read or write team A's files.
  assert.equal((await post(file.key, coachB.cookie, file.fingerprint)).status, 404);
  assert.equal((await post(file.key, coachA.cookie, file.fingerprint)).status, 201);
  assert.equal((await post(file.key, coachA.cookie, file.fingerprint)).status, 200);
  assert.equal(google.stored().length, 3); // 2 ID images + 1 certificate
  const got = await raw("/certificate-files/" + file.key, coachA.cookie);
  assert.equal(got.headers.get("content-type"), "application/pdf");
  assert.deepEqual(Buffer.from(await got.arrayBuffer()), pdf);
  assert.equal((await raw("/certificate-files/" + file.key, coachB.cookie)).status, 404);
  // Assigned judge may read every team's student certificate, not coach ones.
  assert.equal((await raw("/certificate-files/" + file.key, judge.cookie)).status, 200);
  const coachKey = list.body.certificates[0].files.coach;
  assert.equal((await post(coachKey.key, judge.cookie, coachKey.fingerprint)).status, 404);
  const jl = await request("/certificates", undefined, judge.cookie);
  const jf = jl.body.judge_certificates[0].judges[0].file;
  assert.equal(jf.key, "judge." + competition_id + "." + judge.body.user.id);
  assert.equal((await post(jf.key, coachA.cookie, jf.fingerprint)).status, 404);
  assert.equal((await post(jf.key, judge.cookie, jf.fingerprint)).status, 201);
  assert.equal((await request("/certificates", undefined, coachA.cookie)).body.certificates[0].files.student.stored, true);

  // A score change after publication changes the fingerprint: old copy is not served.
  await request("/judging/" + competition_id + "/scores", { registration_id: teamA, revision: 1, scores: [72] }, judge.cookie);
  const after = (await request("/certificates", undefined, coachA.cookie)).body.certificates[0].files.student;
  assert.equal(after.stored, false);
  assert.notEqual(after.fingerprint, file.fingerprint);
  assert.equal((await raw("/certificate-files/" + file.key, coachA.cookie)).status, 404);
  const before = google.stored().length;
  assert.equal((await post(file.key, coachA.cookie, after.fingerprint)).status, 201);
  assert.equal(google.stored().length, before); // replaced, old Drive file deleted
  // Changing certificate settings also invalidates every saved file.
  await request("/certificate-settings", { organization: "ศูนย์ใหม่", signers: [] }, admin.cookie);
  assert.equal((await request("/certificates", undefined, coachA.cookie)).body.certificates[0].files.student.stored, false);
  const storage = await request("/admin/storage", undefined, admin.cookie);
  assert.equal(storage.body.certificates_in_drive, 2);
});

test("saved certificate PDFs round-trip back into the same JPEG pages", async () => {
  const { buildPdf, jpegPages } = await import("../src/components/certificatePdf.js");
  const pages = [
    new Uint8Array([0xff, 0xd8, 1, 2, 10, 101, 110, 100, 0xff, 0xd9]),
    new TextEncoder().encode("\xff\xd8 >>\nstream\n tricky \nendstream\n\xff\xd9"),
    new Uint8Array(70000).map((_, i) => i % 256),
  ];
  const pdf = new Uint8Array(await buildPdf(pages).arrayBuffer());
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
  assert.deepEqual(jpegPages(pdf), pages);
});
