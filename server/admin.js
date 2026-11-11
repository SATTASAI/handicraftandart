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

export const TRASH = "ถังขยะ";
export const PORTAL_KEY = "portal_content";
// Documents of trashed teams stay stored until the trash entry is purged.
export const docNotInTrash =
  "NOT EXISTS(SELECT 1 FROM admin_trash t, json_each(t.payload,'$.documents') j WHERE j.value=registration_documents.id)";
// Round resets remove every team and ID image, so trashed teams and scores can no longer be restored.
export const trashAfterReset = (judges) => [
  "DELETE FROM admin_trash WHERE kind IN ('registration','score')",
  `UPDATE admin_trash SET payload=json_set(payload,'$.registrations',json('[]'),'$.students',json('[]'),'$.reviews',json('[]'),'$.scores',json('[]'),'$.documents',json('[]')${judges ? ",'$.judges',json('[]')" : ""}) WHERE kind='user'`,
];
export const dropTrashOf =
  "DELETE FROM admin_trash WHERE (kind='registration' AND json_extract(payload,'$.registrations[0].owner_id')=?1) OR (kind='score' AND json_extract(payload,'$.scores[0].judge_id')=?1)";

const all = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

export const trashEntry = (db, user, kind, label, payload, guard = "SELECT 1", ...args) =>
  db
    .prepare(
      `INSERT INTO admin_trash(id,kind,label,payload,deleted_by,deleted_at) SELECT ?,?,?,?,?,? WHERE EXISTS(${guard})`,
    )
    .bind(crypto.randomUUID(), kind, String(label).slice(0, 300), JSON.stringify(payload), user.id, now(), ...args);

export async function teamSnapshot(db, column, id) {
  const reg = `SELECT id FROM event_registrations WHERE ${column}=?`;
  const students = await all(db, `SELECT * FROM event_students WHERE registration_id IN (${reg})`, id);
  return {
    registrations: await all(db, `SELECT * FROM event_registrations WHERE ${column}=?`, id),
    students,
    reviews: await all(db, `SELECT * FROM event_registration_reviews WHERE registration_id IN (${reg})`, id),
    scores: await all(db, `SELECT * FROM event_scores WHERE registration_id IN (${reg})`, id),
    documents: students.map((row) => row.document_id),
  };
}

export async function userSnapshot(db, id) {
  const team = await teamSnapshot(db, "owner_id", id);
  return {
    ...team,
    user: await db.prepare("SELECT * FROM account_users WHERE id=?").bind(id).first(),
    scores: [...team.scores, ...(await all(db, "SELECT * FROM event_scores WHERE judge_id=?", id))],
    judges: await all(db, "SELECT * FROM event_judges WHERE judge_id=?", id),
    documents: (await all(db, "SELECT id FROM registration_documents WHERE owner_id=?", id)).map((row) => row.id),
  };
}

// One statement per table keeps restores inside the D1 per-request query limit.
const insertRows = (db, table, rows, or = "") => {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]).filter((key) => /^[a-z0-9_]+$/i.test(key));
  return [
    db
      .prepare(
        `INSERT ${or} INTO ${table}(${keys.join(",")}) SELECT ${keys
          .map((key) => `json_extract(j.value,'$.${key}')`)
          .join(",")} FROM json_each(?) j`,
      )
      .bind(JSON.stringify(rows)),
  ];
};

async function restoreStatements(db, admin, kind, p, fail) {
  if (kind === "competition") {
    const creator = await db
      .prepare("SELECT id FROM account_users WHERE id=?")
      .bind(p.competition.created_by)
      .first();
    return [
      ...insertRows(db, "competition_catalog", p.catalog ? [p.catalog] : [], "OR IGNORE"),
      ...insertRows(db, "event_competitions", [{ ...p.competition, created_by: creator ? creator.id : admin.id }]),
    ];
  }
  const users = new Set((await all(db, "SELECT id FROM account_users")).map((row) => row.id));
  if (p.user) users.add(p.user.id);
  const known = (id) => (id && !users.has(id) ? admin.id : id);
  const competitions = new Set((await all(db, "SELECT id FROM event_competitions")).map((row) => row.id));
  const registrations = (p.registrations || []).filter(
    (row) => competitions.has(row.competition_id) && users.has(row.owner_id),
  );
  if (kind === "registration" && !registrations.length)
    fail(409, "กู้คืนบัญชีผู้ฝึกซ้อมและรายการแข่งขันของทีมนี้ก่อน");
  const revisions = new Map(
    (
      await all(
        db,
        "SELECT id,revision FROM event_registrations WHERE id IN (SELECT json_extract(value,'$.registration_id') FROM json_each(?))",
        JSON.stringify(p.scores || []),
      )
    ).map((row) => [row.id, row.revision]),
  );
  for (const row of registrations) revisions.set(row.id, row.revision);
  const kept = (row) => registrations.some((registration) => registration.id === row.registration_id);
  const scores = (p.scores || []).filter(
    (row) => users.has(row.judge_id) && revisions.get(row.registration_id) === row.revision,
  );
  if (kind === "score" && !scores.length) fail(409, "ทีมหรือกรรมการของคะแนนนี้เปลี่ยนไปแล้ว จึงกู้คืนไม่ได้");
  const owner = p.user?.id || registrations[0]?.owner_id;
  return [
    ...insertRows(db, "account_users", p.user ? [p.user] : []),
    ...(owner
      ? [
          db
            .prepare(
              "UPDATE registration_documents SET owner_id=? WHERE id IN (SELECT value FROM json_each(?))",
            )
            .bind(owner, JSON.stringify(p.documents || [])),
        ]
      : []),
    ...insertRows(
      db,
      "event_registrations",
      registrations.map((row) => ({ ...row, reviewed_by: known(row.reviewed_by) })),
    ),
    ...insertRows(db, "event_students", (p.students || []).filter(kept)),
    ...insertRows(
      db,
      "event_registration_reviews",
      (p.reviews || []).filter(kept).map((row) => ({ ...row, reviewer_id: known(row.reviewer_id) })),
    ),
    ...insertRows(
      db,
      "event_judges",
      (p.judges || [])
        .filter((row) => competitions.has(row.competition_id))
        .map((row) => ({ ...row, assigned_by: known(row.assigned_by) })),
    ),
    ...insertRows(db, "event_scores", scores),
  ];
}

const line = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
function portalContent(b, fail) {
  const news = Array.isArray(b.news) ? b.news : [];
  const countdown = line(b.countdown_at, 40);
  const link = (value) => /^(https:\/\/|\/)[^\s]*$/.test(value) && !value.startsWith("//");
  const content = {
    title: line(b.title, 150),
    subtitle: line(b.subtitle, 200),
    hero: line(b.hero, 500),
    marquee: line(b.marquee, 500),
    countdown_label: line(b.countdown_label, 100),
    countdown_at: countdown,
    news: news.map((item) => ({
      title: line(item?.title, 300),
      date: line(item?.date, 10),
      url: line(item?.url, 500),
    })),
  };
  if (
    news.length > 50 ||
    (countdown && !Number.isFinite(Date.parse(countdown))) ||
    content.news.some(
      (item) =>
        !item.title || (item.date && !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) || (item.url && !link(item.url)),
    )
  )
    fail(400, "ตรวจสอบวันเวลา หัวข้อข่าว และลิงก์ (ต้องขึ้นต้นด้วย https:// หรือ /)");
  return content;
}

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
  const trashId = match(`trash/(${uuidPattern})`);
  const getCompetition = async (id) => {
    const row = await db.prepare("SELECT * FROM event_competitions WHERE id=?").bind(id).first();
    if (!row) fail(404, "ไม่พบรายการแข่งขัน");
    return row;
  };
  const confirm = (data, value = "ลบถาวร") => {
    if (data.confirm !== value) fail(400, "กรุณาพิมพ์คำยืนยันให้ถูกต้อง");
  };
  // "ถังขยะ" keeps a restorable copy; "ลบถาวร" removes the data immediately.
  const trashing = (data) => {
    if (data.confirm !== TRASH) confirm(data);
    return data.confirm === TRASH;
  };
  if (route === "trash" && method === "GET") {
    return json({
      items: await all(
        db,
        `SELECT t.id,t.kind,t.label,t.deleted_at,u.name AS deleted_by_name FROM admin_trash t
        LEFT JOIN account_users u ON u.id=t.deleted_by ORDER BY t.deleted_at DESC,t.id LIMIT 500`,
      ),
    });
  }
  if (trashId && method === "POST") {
    const b = await body(request);
    const entry = await db.prepare("SELECT * FROM admin_trash WHERE id=?").bind(trashId).first();
    if (!entry) fail(404, "ไม่พบรายการในถังขยะ");
    const p = JSON.parse(entry.payload);
    const drop = db.prepare("DELETE FROM admin_trash WHERE id=?").bind(entry.id);
    if (b.action === "purge") {
      confirm(b);
      const documents = JSON.stringify(p.documents || []);
      const unused = `id IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM event_students WHERE document_id=registration_documents.id)`;
      await db.batch([
        db.prepare(queueFile(`SELECT drive_file_id AS id FROM registration_documents WHERE ${unused}`)).bind(documents),
        db.prepare(`DELETE FROM registration_documents WHERE ${unused}`).bind(documents),
        db.prepare(dropTrashOf).bind(p.user?.id || ""),
        drop,
      ]);
      return json({ remaining: await cleanAdminFiles(env) });
    }
    if (b.action !== "restore") fail(400, "คำสั่งไม่ถูกต้อง");
    const statements = await restoreStatements(db, user, entry.kind, p, fail);
    try {
      await db.batch([...statements, drop]);
    } catch (error) {
      console.error("trash restore failed", entry.id, error);
      fail(409, "กู้คืนไม่ได้ เพราะมีข้อมูลซ้ำหรือข้อมูลที่เกี่ยวข้องถูกลบไปแล้ว");
    }
    return json({ ok: true });
  }
  if (route === "portal" && method === "GET") {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key=?").bind(PORTAL_KEY).first();
    return json({ content: row ? JSON.parse(row.value) : {} });
  }
  if (route === "portal" && method === "POST") {
    const content = portalContent(await body(request, 65536), fail);
    await db
      .prepare(
        `INSERT INTO app_settings(key,value,updated_by,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
      )
      .bind(PORTAL_KEY, JSON.stringify(content), user.id, now())
      .run();
    return json({ content });
  }
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
      (SELECT COUNT(*) FROM admin_trash) AS trash,
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
      const unused = `NOT EXISTS(SELECT 1 FROM event_registrations WHERE competition_id=?1)
          AND NOT EXISTS(SELECT 1 FROM event_judges WHERE competition_id=?1)
          AND NOT EXISTS(SELECT 1 FROM certificate_files WHERE competition_id=?1)`;
      const kept = trashing(b)
        ? [
            db
              .prepare(
                `INSERT INTO admin_trash(id,kind,label,payload,deleted_by,deleted_at)
              SELECT ?2,'competition',?3,?4,?5,?6 FROM event_competitions WHERE id=?1 AND ${unused}`,
              )
              .bind(
                c.id,
                crypto.randomUUID(),
                [c.title, c.grade_label].filter(Boolean).join(" ").slice(0, 300),
                JSON.stringify({
                  competition: c,
                  catalog: await db
                    .prepare("SELECT * FROM competition_catalog WHERE catalog_key=?")
                    .bind(c.catalog_key)
                    .first(),
                }),
                user.id,
                now(),
              ),
          ]
        : [];
      const deleted = (
        await db.batch([
          ...kept,
        db.prepare(`DELETE FROM event_competitions WHERE id=?1 AND ${unused}`).bind(c.id),
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
        ])
      ).slice(kept.length);
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
    const trash = trashing(b);
    if (!Number.isInteger(b.revision)) fail(400, "ข้อมูลฉบับที่ไม่ถูกต้อง");
    const reg = "SELECT id FROM event_registrations WHERE id=?1 AND revision=?2";
    const doc = `SELECT document_id FROM event_students WHERE registration_id IN (${reg})`;
    const certificates = `SELECT drive_file_id AS id FROM certificate_files WHERE unit_key IN (SELECT 'student.'||id FROM (${reg}) UNION SELECT 'coach.'||id FROM (${reg}))`;
    const bound = (sql) => db.prepare(sql).bind(registrationId, b.revision);
    const info = trash
      ? await db
          .prepare(
            `SELECT c.title,u.name,u.school FROM event_registrations r JOIN event_competitions c ON c.id=r.competition_id
          JOIN account_users u ON u.id=r.owner_id WHERE r.id=? AND r.revision=?`,
          )
          .bind(registrationId, b.revision)
          .first()
      : null;
    if (trash && !info) fail(409, "รายการถูกลบหรือแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่");
    const before = [
      db
        .prepare(
          holdResultsFor(
            "SELECT competition_id FROM event_registrations WHERE id=? AND revision=? AND status='approved'",
          ),
        )
        .bind(registrationId, b.revision),
      bound(
        queueFile(
          trash
            ? certificates
            : `SELECT drive_file_id AS id FROM registration_documents WHERE id IN (${doc}) UNION ${certificates}`,
        ),
      ),
      ...(trash
        ? [
            trashEntry(
              db,
              user,
              "registration",
              `ทีม ${info.school} · ${info.name} — ${info.title}`,
              await teamSnapshot(db, "id", registrationId),
              "SELECT 1 FROM event_registrations WHERE id=? AND revision=?",
              registrationId,
              b.revision,
            ),
          ]
        : []),
    ];
    const removed = (
      await db.batch([
        ...before,
        ...[
          `DELETE FROM certificate_files WHERE unit_key IN (SELECT 'student.'||id FROM (${reg}) UNION SELECT 'coach.'||id FROM (${reg}))`,
          `DELETE FROM event_scores WHERE registration_id IN (${reg})`,
          `DELETE FROM event_registration_reviews WHERE registration_id IN (${reg})`,
          `DELETE FROM event_registrations WHERE id IN (${reg}) RETURNING id`,
        ].map(bound),
        ...(trash
          ? []
          : [
              db
                .prepare(
                  `DELETE FROM registration_documents WHERE NOT EXISTS(SELECT 1 FROM event_students WHERE document_id=registration_documents.id)
        AND id IN (SELECT value FROM json_each(?))`,
                )
                .bind(JSON.stringify((await bound(doc).all()).results.map((row) => row.document_id))),
            ]),
      ])
    ).slice(before.length);
    if (!removed[3].results.length) fail(409, "รายการถูกลบหรือแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่");
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
      const trash = trashing(b);
      const current = `SELECT 1 FROM event_scores s JOIN event_registrations r ON r.id=s.registration_id
        WHERE s.registration_id=? AND s.judge_id=? AND r.competition_id=? AND r.revision=?`;
      const key = [b.registration_id, b.judge_id, c.id, b.revision];
      const score = trash
        ? await db
            .prepare(
              `SELECT s.*,j.name AS judge_name,u.school AS team_school FROM event_scores s
            JOIN event_registrations r ON r.id=s.registration_id JOIN account_users u ON u.id=r.owner_id
            LEFT JOIN account_users j ON j.id=s.judge_id WHERE s.registration_id=? AND s.judge_id=?`,
            )
            .bind(b.registration_id, b.judge_id)
            .first()
        : null;
      const { judge_name, team_school, ...row } = score || {};
      const results = await db.batch([
        ...(score
          ? [
              trashEntry(
                db,
                user,
                "score",
                `คะแนนของ ${judge_name || "กรรมการ"} ให้ทีม ${team_school} — ${c.title}`,
                { scores: [row] },
                current,
                ...key,
              ),
            ]
          : []),
        db
          .prepare(
            `DELETE FROM event_scores WHERE registration_id=? AND judge_id=?
        AND EXISTS(SELECT 1 FROM event_registrations WHERE id=registration_id AND competition_id=? AND revision=?)`,
          )
          .bind(...key),
      ]);
      if (!results.at(-1).meta.changes) fail(409, "คะแนนถูกลบหรือข้อมูลทีมเปลี่ยนแล้ว");
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
