import { criteriaOf, computeResults } from "./judging.js";
import { deleteFiles, driveEnabled } from "./drive.js";
import { hashPassword, now, publicUser } from "./security.js";

const idPattern = "[a-zA-Z0-9-]{1,80}";
const uuidPattern = "[a-f0-9-]{36}";
const text = (value) => (typeof value === "string" ? value.trim() : "");

export const queueFile = (select) => `INSERT OR IGNORE INTO app_settings(key,value,updated_at)
  SELECT 'admin_delete_file:' || id,json_quote(id),unixepoch() FROM (${select}) WHERE id IS NOT NULL`;

export const holdResultsFor = (select) => `INSERT OR IGNORE INTO app_settings(key,value,updated_at)
  SELECT 'results_hold:' || competition_id,'true',unixepoch() FROM (${select}) affected
  WHERE EXISTS(SELECT 1 FROM event_registrations r JOIN event_scores s ON s.registration_id=r.id
    WHERE r.competition_id=affected.competition_id)`;

export async function cleanAdminFiles(env) {
  const db = env.DB;
  const pending = "key GLOB 'admin_delete_file:*'";
  if (driveEnabled(env)) {
    const rows = (
      await db
        .prepare(`SELECT key,value FROM app_settings WHERE ${pending} ORDER BY updated_at,key LIMIT 20`)
        .all()
    ).results;
    const failed = new Set(
      await deleteFiles(
        env,
        rows.map((row) => JSON.parse(row.value)),
      ),
    );
    const removed = rows.filter((row) => !failed.has(JSON.parse(row.value)));
    if (removed.length) {
      await db.batch(removed.map((row) => db.prepare("DELETE FROM app_settings WHERE key=?").bind(row.key)));
    }
  }
  return (await db.prepare(`SELECT COUNT(*) AS count FROM app_settings WHERE ${pending}`).first()).count;
}

export async function adminApi(request, env, user, { body, json, fail }) {
  const db = env.DB;
  const url = new URL(request.url);
  const route = url.pathname.slice("/api/admin/console/".length);
  const method = request.method;
  const match = (pattern) => route.match(new RegExp(`^${pattern}$`, "i"))?.[1];
  const competitionId = match(`competitions/(${idPattern})`);
  const scoringId = match(`scoring/(${idPattern})`);
  const resultsId = match(`results/(${idPattern})`);
  const registrationId = match(`registrations/(${uuidPattern})/delete`);
  const accountId = match(`users/(${uuidPattern})`);
  const certificatesId = match(`certificates/(${idPattern})/clear`);
  const getCompetition = async (id) => {
    const row = await db.prepare("SELECT * FROM event_competitions WHERE id=?").bind(id).first();
    if (!row) fail(404, "ไม่พบรายการแข่งขัน");
    return row;
  };
  const confirm = (data, value = "ลบถาวร") => {
    if (data.confirm !== value) fail(400, "กรุณาพิมพ์คำยืนยันให้ถูกต้อง");
  };
  if (route === "overview" && method === "GET") {
    return json(
      await db
        .prepare(
          `SELECT
      (SELECT COUNT(*) FROM account_users) AS accounts,
      (SELECT COUNT(*) FROM event_competitions) AS competitions,
      (SELECT COUNT(*) FROM event_competitions WHERE registration_open=1) AS open,
      (SELECT COUNT(*) FROM event_registrations) AS registrations,
      (SELECT COUNT(*) FROM event_registrations WHERE status='pending') AS pending,
      (SELECT COUNT(*) FROM event_scores) AS scores,
      (SELECT COUNT(*) FROM app_settings WHERE key GLOB 'admin_delete_file:*') AS files_pending,
      COALESCE((SELECT value='false' FROM app_settings WHERE key='system_enabled'),0) AS system_closed`,
        )
        .first(),
    );
  }
  if (route === "files/cleanup" && method === "POST") {
    return json({ remaining: await cleanAdminFiles(env) });
  }
  if ((accountId || route === "users") && method === "POST") {
    const b = await body(request);
    const name = text(b.name),
      school = text(b.school),
      email = text(b.email).toLowerCase();
    if (
      name.length < 2 ||
      name.length > 100 ||
      school.length < 2 ||
      school.length > 150 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof b.coach !== "boolean" ||
      typeof b.judge !== "boolean" ||
      (!b.coach && !b.judge)
    )
      fail(400, "กรอกชื่อ โรงเรียน อีเมล และเลือกบทบาทอย่างน้อยหนึ่งบทบาท");
    const password = b.password ?? "";
    if (
      typeof password !== "string" ||
      ((!accountId || password) && (password.length < 12 || password.length > 128))
    )
      fail(400, "รหัสผ่านต้องมี 12–128 ตัวอักษร");
    const duplicate = await db
      .prepare("SELECT 1 FROM account_users WHERE email=? AND id<>?")
      .bind(email, accountId || "")
      .first();
    if (duplicate) fail(409, "อีเมลนี้ถูกใช้แล้ว");
    const passwordHash = password ? await hashPassword(password) : null;
    if (!accountId) {
      const inserted = await db
        .prepare(
          `INSERT INTO account_users(id,name,school,email,password_hash,is_coach,is_judge,created_at)
        VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING RETURNING *`,
        )
        .bind(crypto.randomUUID(), name, school, email, passwordHash, Number(b.coach), Number(b.judge), now())
        .first();
      if (!inserted) fail(409, "อีเมลนี้ถูกใช้แล้ว");
      return json({ user: publicUser(inserted) }, 201);
    }
    const account = await db.prepare("SELECT * FROM account_users WHERE id=?").bind(accountId).first();
    if (!account) fail(404, "ไม่พบบัญชี");
    const changes = await db.batch([
      db
        .prepare(
          `UPDATE account_users SET name=?,school=?,email=?,is_coach=?,is_judge=?,password_hash=COALESCE(?,password_hash)
        WHERE id=? AND NOT EXISTS(SELECT 1 FROM account_users WHERE email=? AND id<>?)
        AND (?=1 OR is_superadmin=1 OR NOT EXISTS(SELECT 1 FROM event_judges WHERE judge_id=account_users.id))
        RETURNING *`,
        )
        .bind(
          name,
          school,
          email,
          Number(b.coach),
          Number(b.judge),
          passwordHash,
          accountId,
          email,
          accountId,
          Number(b.judge),
        ),
      ...["account_password_resets", "account_sessions"].map((table) =>
        db
          .prepare(
            `DELETE FROM ${table}
        WHERE user_id=? AND EXISTS(SELECT 1 FROM account_users WHERE id=? AND
        ((? IS NOT NULL AND password_hash=?) OR (?<>? AND email=?)))`,
          )
          .bind(accountId, accountId, passwordHash, passwordHash, account.email, email, email),
      ),
    ]);
    if (!changes[0].results.length) fail(409, "อีเมลถูกใช้แล้ว หรือบัญชียังได้รับมอบหมายเป็นกรรมการ");
    return json({ user: publicUser(changes[0].results[0]) });
  }
  if (competitionId && method === "POST") {
    const b = await body(request, 32768);
    const c = await getCompetition(competitionId);
    if (b.action === "delete") {
      confirm(b);
      const deleted = await db.batch([
        db
          .prepare(
            `DELETE FROM event_competitions WHERE id=?1
          AND NOT EXISTS(SELECT 1 FROM event_registrations WHERE competition_id=?1)
          AND NOT EXISTS(SELECT 1 FROM event_judges WHERE competition_id=?1)
          AND NOT EXISTS(SELECT 1 FROM certificate_files WHERE competition_id=?1)`,
          )
          .bind(c.id),
        db
          .prepare(
            `DELETE FROM competition_catalog WHERE catalog_key=? AND NOT EXISTS
          (SELECT 1 FROM event_competitions WHERE catalog_key=competition_catalog.catalog_key)`,
          )
          .bind(c.catalog_key),
        db
          .prepare(
            "DELETE FROM app_settings WHERE key=? AND NOT EXISTS(SELECT 1 FROM event_competitions WHERE id=?)",
          )
          .bind("results_hold:" + c.id, c.id),
      ]);
      if (!deleted[0].meta.changes) fail(409, "ลบใบสมัครและไฟล์เกียรติบัตร รวมถึงถอนกรรมการของรายการนี้ก่อน");
      return json({ ok: true });
    }
    const title = text(b.title),
      description = text(b.description),
      category = text(b.category);
    const grade = text(b.grade_label),
      venue = text(b.venue),
      starts = text(b.starts_at);
    const min = b.min_students,
      max = b.max_students;
    const rules = JSON.parse(c.rules_json || "{}");
    const eligibility = b.eligibility;
    if (eligibility !== undefined) {
      const { grades, gender, coach_min, coach_max, work_required } = eligibility || {};
      if (
        !Array.isArray(grades) ||
        grades.some((value) => !/^ป\.[1-6]$/.test(value)) ||
        !["", "ชาย", "หญิง", "คู่ผสม"].includes(gender) ||
        typeof work_required !== "boolean" ||
        !Number.isInteger(coach_min) ||
        coach_min < 1 ||
        coach_min > 100 ||
        (coach_max !== null && (!Number.isInteger(coach_max) || coach_max < coach_min || coach_max > 100))
      )
        fail(400, "ตรวจสอบชั้นเรียน ประเภทผู้แข่งขัน และจำนวนครูผู้ฝึกซ้อม");
      const policy = { ...rules.policy };
      delete policy.allowed_grades;
      delete policy.gender;
      delete policy.mixed_gender_pair;
      delete policy.work_required;
      if (grades.length) policy.allowed_grades = [...new Set(grades)];
      if (gender === "คู่ผสม") policy.mixed_gender_pair = true;
      else if (gender) policy.gender = gender;
      if (work_required) policy.work_required = true;
      rules.policy = policy;
      rules.coach_limits = { ...rules.coach_limits, min: coach_min, max: coach_max };
    }
    const criteria = b.criteria;
    if (
      title.length < 2 ||
      title.length > 200 ||
      description.length > 3000 ||
      category.length > 150 ||
      grade.length > 100 ||
      venue.length > 200 ||
      (starts && (starts.length > 100 || !Number.isFinite(Date.parse(starts)))) ||
      !Number.isInteger(min) ||
      min < 1 ||
      min > 1000 ||
      (max !== null && (!Number.isInteger(max) || max < min || max > 1000)) ||
      typeof b.registration_open !== "boolean" ||
      !Array.isArray(criteria) ||
      !criteria.length ||
      criteria.length > 50 ||
      criteria.some(
        (item) =>
          !text(item?.label) ||
          text(item.label).length > 200 ||
          !Number.isFinite(item.max) ||
          item.max <= 0 ||
          item.max > 10000,
      )
    )
      fail(400, "กรอกชื่อ จำนวนผู้แข่งขัน วันเวลา และเกณฑ์คะแนนให้ถูกต้อง");
    const newCriteria = criteria.map((item) => ({ label: text(item.label), max: item.max }));
    const criteriaChanged = JSON.stringify(newCriteria) !== JSON.stringify(criteriaOf(c.rules_json));
    if (criteriaChanged) rules.score_rules = newCriteria;
    const rulesJson = JSON.stringify(rules);
    const result = await db.batch([
      db
        .prepare(
          `UPDATE event_competitions SET title=?,description=?,category=?,grade_label=?,venue=?,starts_at=?,
        roster_min_students=?,roster_max_students=?,registration_open=?,rules_json=?
        WHERE id=? AND rules_json=? AND (?=0 OR NOT EXISTS(SELECT 1 FROM event_scores s
        JOIN event_registrations r ON r.id=s.registration_id WHERE r.competition_id=event_competitions.id))`,
        )
        .bind(
          title,
          description,
          category,
          grade,
          venue,
          starts,
          min,
          max,
          Number(b.registration_open),
          rulesJson,
          c.id,
          c.rules_json,
          Number(criteriaChanged),
        ),
      db
        .prepare(
          `UPDATE competition_catalog SET (title,description,category,grade_label,min_students,max_students,registration_open,rules_json)=
        (SELECT title,description,category,grade_label,roster_min_students,roster_max_students,registration_open,rules_json
          FROM event_competitions WHERE id=?) WHERE catalog_key=?`,
        )
        .bind(c.id, c.catalog_key),
    ]);
    if (!result[0].meta.changes)
      fail(409, "ข้อมูลเปลี่ยนแล้ว หรือมีคะแนนเดิมอยู่ กรุณาลบคะแนนเดิมก่อนแก้เกณฑ์คะแนน");
    return json({ ok: true });
  }
  if (registrationId && method === "POST") {
    const b = await body(request);
    confirm(b);
    if (!Number.isInteger(b.revision)) fail(400, "ข้อมูลฉบับที่ไม่ถูกต้อง");
    const reg = "SELECT id FROM event_registrations WHERE id=?1 AND revision=?2";
    const doc = `SELECT document_id FROM event_students WHERE registration_id IN (${reg})`;
    const removed = await db.batch([
      db
        .prepare(
          holdResultsFor(
            "SELECT competition_id FROM event_registrations WHERE id=? AND revision=? AND status='approved'",
          ),
        )
        .bind(registrationId, b.revision),
      db
        .prepare(
          queueFile(`SELECT drive_file_id AS id FROM registration_documents WHERE id IN (${doc})
        UNION SELECT drive_file_id FROM certificate_files WHERE unit_key IN (SELECT 'student.'||id FROM (${reg}) UNION SELECT 'coach.'||id FROM (${reg}))`),
        )
        .bind(registrationId, b.revision),
      ...[
        `DELETE FROM certificate_files WHERE unit_key IN (SELECT 'student.'||id FROM (${reg}) UNION SELECT 'coach.'||id FROM (${reg}))`,
        `DELETE FROM event_scores WHERE registration_id IN (${reg})`,
        `DELETE FROM event_registration_reviews WHERE registration_id IN (${reg})`,
        `DELETE FROM event_registrations WHERE id IN (${reg}) RETURNING id`,
      ].map((sql) => db.prepare(sql).bind(registrationId, b.revision)),
      db
        .prepare(
          `DELETE FROM registration_documents WHERE NOT EXISTS(SELECT 1 FROM event_students WHERE document_id=registration_documents.id)
        AND id IN (SELECT value FROM json_each(?))`,
        )
        .bind(
          JSON.stringify(
            (await db.prepare(doc).bind(registrationId, b.revision).all()).results.map(
              (row) => row.document_id,
            ),
          ),
        ),
    ]);
    if (!removed[5].results.length) fail(409, "รายการถูกลบหรือแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่");
    return json({ remaining: await cleanAdminFiles(env) });
  }
  if (scoringId && method === "GET") {
    const c = await getCompetition(scoringId);
    const scores = (
      await db
        .prepare(
          `SELECT s.registration_id,s.judge_id,s.scores_json,s.updated_at FROM event_scores s
      JOIN event_registrations r ON r.id=s.registration_id WHERE r.competition_id=?`,
        )
        .bind(c.id)
        .all()
    ).results;
    const teams = (
      await db
        .prepare(
          `SELECT r.id,r.revision,r.status,u.name,u.school,
      (SELECT group_concat(first_name||' '||last_name, ', ') FROM event_students WHERE registration_id=r.id) AS students
      FROM event_registrations r JOIN account_users u ON u.id=r.owner_id
      WHERE r.competition_id=? AND (r.status='approved' OR EXISTS(SELECT 1 FROM event_scores s WHERE s.registration_id=r.id))
      ORDER BY u.school,u.name,r.id`,
        )
        .bind(c.id)
        .all()
    ).results;
    const judges = (
      await db
        .prepare(
          `SELECT u.id,u.name,u.school,
      EXISTS(SELECT 1 FROM event_judges j WHERE j.competition_id=?1 AND j.judge_id=u.id) AS assigned
      FROM account_users u WHERE assigned OR EXISTS(SELECT 1 FROM event_scores s
        JOIN event_registrations r ON r.id=s.registration_id WHERE r.competition_id=?1 AND s.judge_id=u.id)
      ORDER BY assigned DESC,u.name`,
        )
        .bind(c.id)
        .all()
    ).results;
    const hold = Boolean(
      await db
        .prepare("SELECT 1 FROM app_settings WHERE key=?")
        .bind("results_hold:" + c.id)
        .first(),
    );
    return json({
      teams,
      judges,
      criteria: criteriaOf(c.rules_json),
      hold,
      scores: scores.map(({ scores_json, ...s }) => ({ ...s, values: JSON.parse(scores_json) })),
    });
  }
  if (scoringId && method === "POST") {
    const c = await getCompetition(scoringId);
    const b = await body(request);
    if (
      typeof b.registration_id !== "string" ||
      typeof b.judge_id !== "string" ||
      !Number.isInteger(b.revision)
    )
      fail(400, "ข้อมูลทีมและกรรมการไม่ถูกต้อง");
    if (b.action === "delete") {
      confirm(b);
      const result = await db
        .prepare(
          `DELETE FROM event_scores WHERE registration_id=? AND judge_id=?
        AND EXISTS(SELECT 1 FROM event_registrations WHERE id=registration_id AND competition_id=? AND revision=?)`,
        )
        .bind(b.registration_id, b.judge_id, c.id, b.revision)
        .run();
      if (!result.meta.changes) fail(409, "คะแนนถูกลบหรือข้อมูลทีมเปลี่ยนแล้ว");
      return json({ ok: true });
    }
    const criteria = criteriaOf(c.rules_json);
    if (
      !Array.isArray(b.scores) ||
      b.scores.length !== criteria.length ||
      b.scores.some((value, i) => !Number.isFinite(value) || value < 0 || value > criteria[i].max)
    )
      fail(400, "กรอกคะแนนทุกช่องให้ไม่เกินคะแนนเต็ม");
    const scores = b.scores.map((value) => Math.round(value * 100) / 100);
    const total = Math.round(scores.reduce((sum, value) => sum + value, 0) * 100) / 100;
    const result = await db
      .prepare(
        `INSERT INTO event_scores(registration_id,judge_id,revision,scores_json,total,updated_at)
      SELECT r.id,j.judge_id,r.revision,?,?,? FROM event_registrations r
      JOIN event_competitions c ON c.id=r.competition_id
      JOIN event_judges j ON j.competition_id=c.id AND j.judge_id=?
      WHERE r.id=? AND c.id=? AND r.revision=? AND r.status='approved' AND r.owner_id<>j.judge_id AND c.rules_json=?
      ON CONFLICT(registration_id,judge_id) DO UPDATE SET revision=excluded.revision,scores_json=excluded.scores_json,total=excluded.total,updated_at=excluded.updated_at`,
      )
      .bind(
        JSON.stringify(scores),
        total,
        now(),
        b.judge_id,
        b.registration_id,
        c.id,
        b.revision,
        c.rules_json,
      )
      .run();
    if (!result.meta.changes) fail(409, "ทีม เกณฑ์ หรือสิทธิ์กรรมการเปลี่ยนแล้ว หรือเป็นทีมที่กรรมการส่งเอง");
    return json({ ok: true });
  }
  if (resultsId && method === "POST") {
    const c = await getCompetition(resultsId);
    const b = await body(request);
    const key = "results_hold:" + c.id;
    if (b.action === "publish") {
      if (!(await computeResults(db, c)).complete) fail(409, "บันทึกคะแนนให้ครบก่อนประกาศผล");
      await db.prepare("DELETE FROM app_settings WHERE key=?").bind(key).run();
    } else if (b.action === "hold") {
      await db
        .prepare(
          `INSERT INTO app_settings(key,value,updated_by,updated_at) SELECT ?,'true',?,? FROM event_competitions WHERE id=?
        ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
        )
        .bind(key, user.id, now(), c.id)
        .run();
    } else fail(400, "สถานะผลการแข่งขันไม่ถูกต้อง");
    return json({ ok: true });
  }
  if (certificatesId && method === "POST") {
    const b = await body(request);
    confirm(b);
    const c = await getCompetition(certificatesId);
    await db.batch([
      db
        .prepare(queueFile("SELECT drive_file_id AS id FROM certificate_files WHERE competition_id=?"))
        .bind(c.id),
      db.prepare("DELETE FROM certificate_files WHERE competition_id=?").bind(c.id),
    ]);
    return json({ remaining: await cleanAdminFiles(env) });
  }
  fail(404, "ไม่พบรายการที่ร้องขอ");
}
