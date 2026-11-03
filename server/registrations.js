import { activationSql } from "./catalog.js";
import { now, digest, publicUser } from "./security.js";
const MAX_IMAGE = 1048576;
function effectiveCounts(row) {
  return row
    ? {
        ...row,
        min_students: row.roster_min_students ?? row.min_students,
        max_students:
          row.roster_min_students == null
            ? row.max_students
            : row.roster_max_students,
      }
    : null;
}
function competitionView(row) {
  row = effectiveCounts(row);
  if (!row) return null;
  const { rules_json, ...safe } = row;
  return { ...safe, rules: rules_json ? JSON.parse(rules_json) : {} };
}
const primaryGrade = (value) =>
  value
    .normalize("NFKC")
    .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 3664))
    .replace(/\s+/g, "")
    .replace(/^ประถมศึกษาปีที่/, "ป.")
    .replace(/^ป(?=[1-6]$)/, "ป.");
const text = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max + 1) : "";
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
async function details(db, id) {
  const registration = await db
    .prepare(
      "SELECT r.*,c.title,c.grade_label,c.venue,c.starts_at,c.registration_open,c.rules_json AS competition_rules_json,u.name AS coach_name,u.school AS coach_school,u.email AS coach_email,v.name AS reviewer_name FROM event_registrations r JOIN event_competitions c ON c.id=r.competition_id JOIN account_users u ON u.id=r.owner_id LEFT JOIN account_users v ON v.id=r.reviewed_by WHERE r.id=?",
    )
    .bind(id)
    .first();
  if (!registration) return null;
  const {
    write_token,
    payload_hash,
    request_id,
    coaches_json,
    competition_rules_json,
    ...safe
  } = registration;
  return {
    ...safe,
    coaches: JSON.parse(coaches_json || "[]"),
    competition_rules: JSON.parse(competition_rules_json || "{}"),
    students: (
      await db
        .prepare(
          "SELECT id,position,first_name,last_name,grade,school,document_id,gender FROM event_students WHERE registration_id=? ORDER BY position",
        )
        .bind(id)
        .all()
    ).results,
  };
}
async function imageBytes(r, fail) {
  const reader = r.body?.getReader();
  if (!reader) fail(400, "กรุณาเลือกภาพบัตรประชาชน");
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_IMAGE) {
      await reader.cancel();
      fail(413, "ภาพหลังปรับขนาดต้องไม่เกิน 1 MB");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const png =
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b) &&
    String.fromCharCode(...bytes.slice(12, 16)) === "IHDR";
  const jpeg =
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217;
  const type = png ? "image/png" : jpeg ? "image/jpeg" : null;
  if (!type || r.headers.get("content-type")?.split(";")[0] !== type)
    fail(415, "รองรับไฟล์ภาพ JPG หรือ PNG ที่ถูกต้องเท่านั้น");
  return { bytes, type };
}
export async function registrationsApi(
  r,
  env,
  user,
  { body, json, fail, limit },
) {
  const db = env.DB,
    url = new URL(r.url),
    path = url.pathname,
    method = r.method;
  const superadmin = Boolean(user.is_superadmin),
    reviewer = superadmin || Boolean(user.is_organizer),
    coach = superadmin || Boolean(user.is_coach);
  const requireCoach = () => {
    if (!coach) fail(403, "เฉพาะผู้ฝึกซ้อมเท่านั้น");
  };
  const requireReviewer = () => {
    if (!reviewer) fail(403, "เฉพาะผู้จัดหรือ superadmin เท่านั้น");
  };
  if (path === "/api/admin/organizers" && method === "POST") {
    if (!superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const b = await body(r);
    if (!uuid(b.user_id) || typeof b.enabled !== "boolean")
      fail(400, "ข้อมูลสิทธิ์ไม่ถูกต้อง");
    const result = await db
      .prepare("UPDATE account_users SET is_organizer=? WHERE id=?")
      .bind(b.enabled ? 1 : 0, b.user_id)
      .run();
    if (!result.meta.changes) fail(404, "ไม่พบบัญชี");
    return json({
      user: publicUser(
        await db
          .prepare("SELECT * FROM account_users WHERE id=?")
          .bind(b.user_id)
          .first(),
      ),
    });
  }
  if (path === "/api/competitions" && method === "GET") {
    if (
      await db
        .prepare(
          "SELECT 1 FROM competition_catalog c WHERE NOT EXISTS(SELECT 1 FROM event_competitions e WHERE e.catalog_key=c.catalog_key) LIMIT 1",
        )
        .first()
    )
      await db.prepare(activationSql).run();
    return json({
      competitions: (
        await db
          .prepare(
            "SELECT c.*,s.name AS source_name,s.url AS source_url FROM event_competitions c LEFT JOIN competition_rule_sources s ON s.key=c.source_key ORDER BY c.catalog_key IS NULL DESC,c.category,c.title,c.grade_label,c.id",
          )
          .all()
      ).results.map(competitionView),
    });
  }
  const rulesMatch = path.match(/^\/api\/competitions\/([a-zA-Z0-9-]+)$/);
  if (rulesMatch && method === "GET") {
    const row = await db
      .prepare(
        "SELECT c.*,s.name AS source_name,s.url AS source_url,rs.text_json AS section_text_json,gs.text_json AS general_text_json FROM event_competitions c LEFT JOIN competition_rule_sources s ON s.key=c.source_key LEFT JOIN competition_rule_sections rs ON rs.key=c.section_key LEFT JOIN competition_rule_sections gs ON gs.key=json_extract(c.rules_json,'$.general_section_key') WHERE c.id=?",
      )
      .bind(rulesMatch[1])
      .first();
    if (!row) fail(404, "ไม่พบรายการแข่งขัน");
    const { section_text_json, general_text_json, ...competition } = row;
    return json({
      competition: {
        ...competitionView(competition),
        rules_text: section_text_json ? JSON.parse(section_text_json) : "",
        general_rules_text: general_text_json
          ? JSON.parse(general_text_json)
          : "",
      },
    });
  }
  if (path === "/api/admin/competitions" && method === "POST") {
    if (!superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const b = await body(r),
      title = text(b.title, 200),
      description = text(b.description, 3000),
      grade = text(b.grade_label, 100),
      venue = text(b.venue, 200),
      starts = text(b.starts_at, 100);
    const min = Number(b.min_students),
      max = Number(b.max_students);
    if (
      title.length < 2 ||
      title.length > 200 ||
      description.length > 3000 ||
      grade.length > 100 ||
      venue.length > 200 ||
      starts.length > 100 ||
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      min < 1 ||
      min > 1000 ||
      max < min ||
      max > 1000
    )
      fail(400, "กรอกชื่อรายการและจำนวนผู้แข่งขัน 1–1000 คนให้ถูกต้อง");
    if (starts && !Number.isFinite(Date.parse(starts)))
      fail(400, "วันเวลาแข่งขันไม่ถูกต้อง");
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO event_competitions(id,title,description,grade_label,venue,starts_at,min_students,max_students,registration_open,created_by,created_at,roster_min_students,roster_max_students) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        title,
        description,
        grade,
        venue,
        starts,
        Math.min(min, 20),
        Math.min(max, 20),
        b.registration_open === false ? 0 : 1,
        user.id,
        now(),
        min,
        max,
      )
      .run();
    return json({ id }, 201);
  }
  const competitionMatch = path.match(
    /^\/api\/admin\/competitions\/([a-zA-Z0-9-]+)$/i,
  );
  if (competitionMatch && method === "POST") {
    if (!superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const b = await body(r);
    if (typeof b.registration_open !== "boolean")
      fail(400, "สถานะเปิดรับสมัครไม่ถูกต้อง");
    const result = await db
      .prepare("UPDATE event_competitions SET registration_open=? WHERE id=?")
      .bind(b.registration_open ? 1 : 0, competitionMatch[1])
      .run();
    if (!result.meta.changes) fail(404, "ไม่พบรายการ");
    return json({ ok: true });
  }
  if (path === "/api/registration-documents" && method === "POST") {
    requireCoach();
    await limit(db, r, "document-upload:" + user.id, 120, 3600);
    const { bytes, type } = await imageBytes(r, fail),
      id = crypto.randomUUID();
    await db
      .prepare(
        "DELETE FROM registration_documents WHERE owner_id=? AND created_at<? AND NOT EXISTS(SELECT 1 FROM event_students s WHERE s.document_id=registration_documents.id)",
      )
      .bind(user.id, now() - 86400)
      .run();
    await db
      .prepare("INSERT INTO registration_documents VALUES(?,?,?,?,?,?)")
      .bind(id, user.id, type, bytes.length, bytes.buffer, now())
      .run();
    return json({ id, content_type: type, size: bytes.length }, 201);
  }
  const documentMatch = path.match(
    /^\/api\/registration-documents\/([a-f0-9-]+)$/i,
  );
  if (documentMatch) {
    const id = documentMatch[1];
    // Organizers see only documents actually submitted for review, not orphan uploads.
    const doc = await db
      .prepare(
        "SELECT * FROM registration_documents d WHERE d.id=? AND (d.owner_id=? OR ?=1 OR (?=1 AND EXISTS(SELECT 1 FROM event_students s WHERE s.document_id=d.id)))",
      )
      .bind(id, user.id, superadmin ? 1 : 0, reviewer ? 1 : 0)
      .first();
    if (!doc) fail(404, "ไม่พบเอกสารหรือไม่มีสิทธิ์เข้าถึง");
    if (method === "GET")
      return new Response(new Uint8Array(doc.data), {
        headers: {
          "Content-Type": doc.content_type,
          "Cache-Control": "private, no-store",
          Pragma: "no-cache",
          "X-Robots-Tag": "noindex, noarchive",
          "Content-Disposition":
            'inline; filename="student-identity.' +
            (doc.content_type === "image/png" ? "png" : "jpg") +
            '"',
        },
      });
    if (method === "DELETE") {
      if (doc.owner_id !== user.id) fail(403, "เฉพาะเจ้าของเอกสารเท่านั้น");
      const result = await db
        .prepare(
          "DELETE FROM registration_documents WHERE id=? AND owner_id=? AND NOT EXISTS(SELECT 1 FROM event_students WHERE document_id=?)",
        )
        .bind(id, user.id, id)
        .run();
      if (!result.meta.changes) fail(409, "เอกสารถูกใช้ในรายการสมัครแล้ว");
      return json({ ok: true });
    }
  }
  if (
    (path === "/api/registrations" || path === "/api/admin/registrations") &&
    method === "GET"
  ) {
    const all = path.includes("/admin/");
    if (all) requireReviewer();
    else requireCoach();
    const page = Number(url.searchParams.get("page") || 1),
      status = url.searchParams.get("status") || "";
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000 ||
      !["", "pending", "approved", "changes_requested"].includes(status)
    )
      fail(400, "ตัวกรองไม่ถูกต้อง");
    const rows = (
      await db
        .prepare(
          "SELECT id FROM event_registrations WHERE (?=1 OR owner_id=?) AND (?='' OR status=?) ORDER BY created_at DESC,id LIMIT 26 OFFSET ?",
        )
        .bind(all ? 1 : 0, user.id, status, status, (page - 1) * 25)
        .all()
    ).results;
    return json({
      registrations: await Promise.all(
        rows.slice(0, 25).map((row) => details(db, row.id)),
      ),
      hasMore: rows.length > 25,
      page,
    });
  }
  const registrationMatch = path.match(/^\/api\/registrations\/([a-f0-9-]+)$/i);
  if (registrationMatch && method === "GET") {
    const row = await details(db, registrationMatch[1]);
    if (!row || (!reviewer && row.owner_id !== user.id))
      fail(404, "ไม่พบรายการสมัคร");
    return json({ registration: row });
  }
  if (
    (path === "/api/registrations" || registrationMatch) &&
    method === "POST"
  ) {
    requireCoach();
    const b = await body(r, 262144),
      editing = Boolean(registrationMatch);
    const existing = editing
      ? await db
          .prepare(
            "SELECT * FROM event_registrations WHERE id=? AND owner_id=?",
          )
          .bind(registrationMatch[1], user.id)
          .first()
      : null;
    if (editing && !existing) fail(404, "ไม่พบรายการสมัคร");
    if (existing?.status === "approved")
      fail(409, "ยืนยันการลงทะเบียนแล้ว ไม่สามารถแก้ไขข้อมูลได้");
    if (editing && b.revision !== existing.revision)
      fail(409, "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดรายการใหม่");
    const competitionId = existing?.competition_id || b.competition_id;
    const competition = effectiveCounts(
      await db
        .prepare("SELECT * FROM event_competitions WHERE id=?")
        .bind(typeof competitionId === "string" ? competitionId : "")
        .first(),
    );
    if (!competition) fail(404, "ไม่พบรายการแข่งขัน");
    if (!competition.registration_open) fail(409, "รายการนี้ปิดรับสมัครแล้ว");
    if (
      !Array.isArray(b.students) ||
      b.students.length < competition.min_students ||
      (competition.max_students != null &&
        b.students.length > competition.max_students)
    )
      fail(
        400,
        competition.max_students == null
          ? `รายการนี้ต้องมีนักเรียนอย่างน้อย ${competition.min_students} คน`
          : `รายการนี้ต้องมีนักเรียน ${competition.min_students}–${competition.max_students} คน`,
      );
    const rules = JSON.parse(competition.rules_json || "{}"),
      policy = rules.policy || {};
    const variant = policy.team_variants ? text(b.variant, 50) : "";
    if (policy.team_variants) {
      const selected = policy.team_variants.find((v) => v.key === variant);
      if (!selected) fail(400, "เลือกชุดการแสดงตามเกณฑ์รายการ");
      if (
        b.students.length < selected.min_students ||
        b.students.length > selected.max_students
      )
        fail(
          400,
          `${selected.label} ต้องมีนักเรียน ${selected.min_students}–${selected.max_students} คน`,
        );
    }
    const students = b.students.map((s) => ({
      first_name: text(s?.first_name, 100),
      last_name: text(s?.last_name, 100),
      grade: policy.allowed_grades
        ? primaryGrade(text(s?.grade, 20))
        : text(s?.grade, 20),
      gender: text(s?.gender, 10),
      school: text(s?.school, 150),
      document_id: s?.document_id,
    }));
    if (
      students.some(
        (s) =>
          !s.first_name ||
          s.first_name.length > 100 ||
          !s.last_name ||
          s.last_name.length > 100 ||
          !s.grade ||
          s.grade.length > 20 ||
          s.school.length < 2 ||
          s.school.length > 150 ||
          !uuid(s.document_id),
      )
    )
      fail(
        400,
        "กรอกชื่อ นามสกุล ชั้น โรงเรียน และภาพบัตรของนักเรียนทุกคนให้ครบ",
      );
    if (
      policy.allowed_grades &&
      students.some((s) => !policy.allowed_grades.includes(s.grade))
    )
      fail(400, "ระดับชั้นไม่ตรงตามเกณฑ์รายการนี้");
    if (policy.gender && students.some((s) => s.gender !== policy.gender))
      fail(400, "ประเภทชาย/หญิงไม่ตรงตามเกณฑ์รายการนี้");
    if (
      policy.mixed_gender_pair &&
      (students.filter((s) => s.gender === "ชาย").length !== 1 ||
        students.filter((s) => s.gender === "หญิง").length !== 1)
    )
      fail(400, "รายการนี้ต้องมีนักเรียนชาย 1 คนและนักเรียนหญิง 1 คน");
    const coaches = (
      Array.isArray(b.coaches) ? b.coaches : [{ name: user.name }]
    ).map((c) => ({ name: text(c?.name, 100) }));
    const work = text(b.work_url, 2000);
    if (
      !coaches.length ||
      coaches.some((c) => c.name.length < 2 || c.name.length > 100) ||
      (rules.coach_limits?.min && coaches.length < rules.coach_limits.min) ||
      (rules.coach_limits?.max && coaches.length > rules.coach_limits.max)
    )
      fail(400, "จำนวนหรือรายชื่อครูผู้ฝึกซ้อมไม่ตรงตามเกณฑ์");
    if (
      work.length > 2000 ||
      (work &&
        (() => {
          try {
            const u = new URL(work);
            return u.protocol !== "https:" || u.username || u.password;
          } catch {
            return true;
          }
        })())
    )
      fail(400, "ลิงก์ผลงานต้องเป็น HTTPS ที่ถูกต้อง");
    if (policy.work_required && !work)
      fail(400, "รายการนี้ต้องแนบลิงก์ผลงาน HTTPS");
    if (new Set(students.map((s) => s.document_id)).size !== students.length)
      fail(400, "นักเรียนแต่ละคนต้องมีภาพบัตรของตนเอง");
    const requestId = existing?.request_id || b.request_id;
    if (!uuid(requestId))
      fail(400, "คำขอลงทะเบียนไม่ถูกต้อง กรุณาเปิดฟอร์มใหม่");
    const payloadHash = await digest(
      JSON.stringify({
        competition_id: competitionId,
        students,
        variant,
        coaches,
        work_url: work,
      }),
    );
    if (!editing) {
      const duplicate = await db
        .prepare(
          "SELECT id,payload_hash FROM event_registrations WHERE owner_id=? AND request_id=?",
        )
        .bind(user.id, requestId)
        .first();
      if (duplicate) {
        if (duplicate.payload_hash !== payloadHash)
          fail(409, "คำขอนี้ถูกใช้แล้ว กรุณาเปิดฟอร์มใหม่");
        return json({ registration: await details(db, duplicate.id) }, 200);
      }
    }
    const personKey = (x) =>
      [x.first_name, x.last_name, x.school]
        .map((v) => String(v).normalize("NFC").replace(/\s+/g, " ").trim())
        .join("|");
    if (new Set(students.map(personKey)).size !== students.length)
      fail(400, "มีชื่อนักเรียนซ้ำกันในทีม");
    const taken = new Set(
      (
        await db
          .prepare(
            "SELECT s.first_name,s.last_name,s.school FROM event_students s JOIN event_registrations r ON r.id=s.registration_id WHERE r.competition_id=? AND r.id<>?",
          )
          .bind(competitionId, existing?.id || "")
          .all()
      ).results.map(personKey),
    );
    const dup = students.find((x) => taken.has(personKey(x)));
    if (dup)
      fail(
        409,
        `${dup.first_name} ${dup.last_name} ลงทะเบียนในรายการนี้แล้ว (อาจเป็นทีมอื่นหรือครูท่านอื่น)`,
      );
    if (
      await db
        .prepare(
          "SELECT 1 FROM event_scores s JOIN event_registrations r ON r.id=s.registration_id WHERE r.competition_id=? LIMIT 1",
        )
        .bind(competitionId)
        .first()
    )
      fail(409, "รายการนี้เริ่มตัดสินแล้ว ไม่รับสมัครหรือแก้ไขทีมเพิ่ม");
    const validDocuments = await db
      .prepare(
        "SELECT COUNT(*) AS total FROM json_each(?) j JOIN registration_documents d ON d.id=json_extract(j.value,'$.document_id') WHERE d.owner_id=? AND NOT EXISTS(SELECT 1 FROM event_students s WHERE s.document_id=d.id AND s.registration_id<>?)",
      )
      .bind(JSON.stringify(students), user.id, existing?.id || "")
      .first();
    if (validDocuments.total !== students.length)
      fail(400, "ภาพบัตรต้องเป็นของบัญชีนี้และไม่ถูกใช้ในทีมอื่น");
    const id = existing?.id || crypto.randomUUID(),
      writeToken = crypto.randomUUID(),
      t = now();
    const oldDocuments = editing
      ? (
          await db
            .prepare(
              "SELECT document_id FROM event_students WHERE registration_id=?",
            )
            .bind(id)
            .all()
        ).results.map((s) => s.document_id)
      : [];
    const statement = editing
      ? db
          .prepare(
            "UPDATE event_registrations SET payload_hash=?,work_url=?,coaches_json=?,variant=?,status='pending',revision=revision+1,write_token=?,review_note='',reviewed_by=NULL,reviewed_at=NULL,updated_at=? WHERE id=? AND owner_id=? AND revision=? AND status<>'approved' AND EXISTS(SELECT 1 FROM event_competitions WHERE id=event_registrations.competition_id AND registration_open=1 AND COALESCE(roster_min_students,min_students)=? AND (CASE WHEN roster_min_students IS NULL THEN max_students ELSE roster_max_students END) IS ?)",
          )
          .bind(
            payloadHash,
            work,
            JSON.stringify(coaches),
            variant,
            writeToken,
            t,
            id,
            user.id,
            existing.revision,
            competition.min_students,
            competition.max_students,
          )
      : db
          .prepare(
            "INSERT INTO event_registrations(id,competition_id,owner_id,request_id,payload_hash,write_token,created_at,updated_at,work_url,coaches_json,variant) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM event_competitions WHERE id=? AND registration_open=1 AND COALESCE(roster_min_students,min_students)=? AND (CASE WHEN roster_min_students IS NULL THEN max_students ELSE roster_max_students END) IS ?)",
          )
          .bind(
            id,
            competitionId,
            user.id,
            requestId,
            payloadHash,
            writeToken,
            t,
            t,
            work,
            JSON.stringify(coaches),
            variant,
            competitionId,
            competition.min_students,
            competition.max_students,
          );
    try {
      await db.batch([
        statement,
        db
          .prepare(
            "DELETE FROM event_students WHERE registration_id=? AND EXISTS(SELECT 1 FROM event_registrations WHERE id=? AND write_token=?)",
          )
          .bind(id, id, writeToken),
        db
          .prepare(
            "INSERT INTO event_students(id,registration_id,position,first_name,last_name,grade,school,document_id,gender) SELECT json_extract(j.value,'$.id'),(SELECT id FROM event_registrations WHERE id=? AND write_token=?),CAST(j.key AS INTEGER),json_extract(j.value,'$.first_name'),json_extract(j.value,'$.last_name'),json_extract(j.value,'$.grade'),json_extract(j.value,'$.school'),json_extract(j.value,'$.document_id'),json_extract(j.value,'$.gender') FROM json_each(?) j",
          )
          .bind(
            id,
            writeToken,
            JSON.stringify(
              students.map((s) => ({ ...s, id: crypto.randomUUID() })),
            ),
          ),
        db
          .prepare(
            "DELETE FROM registration_documents WHERE owner_id=? AND id IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM event_students WHERE document_id=registration_documents.id)",
          )
          .bind(user.id, JSON.stringify(oldDocuments)),
      ]);
    } catch (error) {
      if (!editing) {
        const duplicate = await db
          .prepare(
            "SELECT id,payload_hash FROM event_registrations WHERE owner_id=? AND request_id=?",
          )
          .bind(user.id, requestId)
          .first();
        if (duplicate?.payload_hash === payloadHash)
          return json({ registration: await details(db, duplicate.id) }, 200);
      }
      if (/constraint|FOREIGN KEY|UNIQUE|NOT NULL/i.test(String(error)))
        fail(
          409,
          "ข้อมูลหรือสถานะรายการเปลี่ยนแล้ว กรุณาโหลดรายการและตรวจภาพบัตรอีกครั้ง",
        );
      throw error;
    }
    return json({ registration: await details(db, id) }, editing ? 200 : 201);
  }
  const reviewMatch = path.match(
    /^\/api\/admin\/registrations\/([a-f0-9-]+)\/review$/i,
  );
  if (reviewMatch && method === "POST") {
    requireReviewer();
    const b = await body(r),
      note = text(b.note, 1000);
    if (
      !["approved", "changes_requested"].includes(b.status) ||
      !Number.isInteger(b.revision) ||
      b.revision < 1 ||
      note.length > 1000 ||
      (b.status === "changes_requested" && !note)
    )
      fail(400, "เลือกผลตรวจและระบุเหตุผลเมื่อขอแก้ไข");
    const id = reviewMatch[1],
      t = now();
    if (
      b.status === "approved" &&
      (await db
        .prepare(
          "SELECT 1 FROM event_scores s JOIN event_registrations r ON r.id=s.registration_id JOIN event_registrations x ON x.competition_id=r.competition_id WHERE x.id=? LIMIT 1",
        )
        .bind(id)
        .first())
    )
      fail(
        409,
        "รายการนี้เริ่มตัดสินแล้ว ยืนยันทีมเพิ่มไม่ได้ (ผลที่ประกาศแล้วจะเปลี่ยน)",
      );
    const results = await db.batch([
      db
        .prepare(
          "UPDATE event_registrations SET status=?,review_note=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=? AND status='pending' AND revision=? AND (?=1 OR owner_id<>?) AND EXISTS(SELECT 1 FROM account_users WHERE id=? AND (is_superadmin=1 OR is_organizer=1))",
        )
        .bind(
          b.status,
          note,
          user.id,
          t,
          t,
          id,
          b.revision,
          superadmin ? 1 : 0,
          user.id,
          user.id,
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO event_registration_reviews SELECT ?,id,revision,reviewed_by,status,review_note,reviewed_at FROM event_registrations WHERE id=? AND reviewed_by=? AND reviewed_at=? AND revision=?",
        )
        .bind(crypto.randomUUID(), id, user.id, t, b.revision),
    ]);
    if (!results[0].meta.changes)
      fail(
        409,
        "ข้อมูลเปลี่ยนแล้ว รายการไม่ได้รอตรวจ หรือเป็นทีมที่คุณส่งเอง กรุณาโหลดใหม่",
      );
    return json({ registration: await details(db, id) });
  }
  fail(404, "ไม่พบรายการที่ร้องขอ");
}
