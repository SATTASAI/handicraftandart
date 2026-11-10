import { now, digest } from "./security.js";
import { driveEnabled, uploadFile, downloadFile, deleteFiles } from "./drive.js";

// Bump when src/components/certificatePdf.js drawing changes so PDFs saved in
// Google Drive are regenerated instead of served with the old design.
export const CERTIFICATE_DESIGN = "2026-11-04";
const MAX_CERTIFICATE_PDF = 40 * 1048576;

export const MEDALS = [
  { min: 80, label: "เหรียญทอง" },
  { min: 70, label: "เหรียญเงิน" },
  { min: 60, label: "เหรียญทองแดง" },
  { min: 0, label: "เข้าร่วม" },
];
export const RANK_LABELS = ["ชนะเลิศ", "รองชนะเลิศอันดับ 1", "รองชนะเลิศอันดับ 2"];
export const DEFAULT_CERTIFICATE = {
  organization: "ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง",
  event_line: "การแข่งขันศิลปหัตถกรรมนักเรียน ประจำปีการศึกษา 2569",
  issued_text: "",
  logo: "",
  signers: [
    { name: "", position: "ประธานศูนย์เครือข่าย" },
    { name: "", position: "ประธานกรรมการดำเนินงาน" },
  ],
};

export const medalFor = (percent) =>
  MEDALS.find((m) => percent >= m.min).label;

export function criteriaOf(rulesJson) {
  let rules = {};
  try {
    rules = JSON.parse(rulesJson || "{}");
  } catch {}
  const list = Array.isArray(rules.score_rules)
    ? rules.score_rules.filter(
        (x) => x && typeof x.label === "string" && Number(x.max) > 0,
      )
    : [];
  return list.length
    ? list.map((x) => ({ label: x.label, max: Number(x.max) }))
    : [{ label: "คะแนนรวม", max: 100 }];
}

const round2 = (n) => Math.round(n * 100) / 100;

async function studentsOf(db, ids) {
  const map = new Map(ids.map((id) => [id, []]));
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const rows = (
      await db
        .prepare(
          `SELECT registration_id,first_name,last_name,grade,school FROM event_students WHERE registration_id IN (${part.map(() => "?").join(",")}) ORDER BY registration_id,position`,
        )
        .bind(...part)
        .all()
    ).results;
    for (const s of rows) map.get(s.registration_id).push(s);
  }
  return map;
}

// Computes ranking for one competition from approved teams, assigned judges and
// scores matching each team's current revision. A judge never scores own team.
export async function computeResults(db, competition) {
  const criteria = criteriaOf(competition.rules_json);
  const maxTotal = criteria.reduce((a, c) => a + c.max, 0);
  const regs = (
    await db
      .prepare(
        "SELECT r.id,r.owner_id,r.revision,r.coaches_json,u.name AS coach_name,u.school AS coach_school FROM event_registrations r JOIN account_users u ON u.id=r.owner_id WHERE r.competition_id=? AND r.status='approved' ORDER BY r.created_at,r.id",
      )
      .bind(competition.id)
      .all()
  ).results;
  const judges = (
    await db
      .prepare(
        "SELECT j.judge_id,u.name,u.school FROM event_judges j JOIN account_users u ON u.id=j.judge_id WHERE j.competition_id=? ORDER BY u.name",
      )
      .bind(competition.id)
      .all()
  ).results;
  const scores = (
    await db
      .prepare(
        "SELECT s.registration_id,s.judge_id,s.total FROM event_scores s JOIN event_registrations r ON r.id=s.registration_id AND r.revision=s.revision JOIN event_judges j ON j.competition_id=r.competition_id AND j.judge_id=s.judge_id WHERE r.competition_id=? AND r.status='approved'",
      )
      .bind(competition.id)
      .all()
  ).results;
  const students = await studentsOf(
    db,
    regs.map((r) => r.id),
  );
  const teams = regs.map((r) => {
    const required = judges.filter((j) => j.judge_id !== r.owner_id);
    const mine = scores.filter(
      (s) =>
        s.registration_id === r.id &&
        required.some((j) => j.judge_id === s.judge_id),
    );
    const average = mine.length
      ? mine.reduce((a, s) => a + s.total, 0) / mine.length
      : null;
    const percent = average == null ? null : round2((average / maxTotal) * 100);
    return {
      registration_id: r.id,
      owner_id: r.owner_id,
      school: students.get(r.id)[0]?.school || r.coach_school,
      coach_name: r.coach_name,
      coaches: JSON.parse(r.coaches_json || "[]"),
      students: students.get(r.id),
      judges_required: required.length,
      judges_scored: mine.length,
      complete: required.length > 0 && mine.length === required.length,
      score: average == null ? null : round2(average),
      percent,
      medal: percent == null ? null : medalFor(percent),
    };
  });
  const complete = teams.length > 0 && teams.every((t) => t.complete);
  const published = complete && !(await db.prepare("SELECT 1 FROM app_settings WHERE key=?")
    .bind("results_hold:" + competition.id).first());
  const ranked = [...teams].sort(
    (a, b) => (b.percent ?? -1) - (a.percent ?? -1),
  );
  ranked.forEach((t, i) => {
    t.rank =
      t.percent == null
        ? null
        : i > 0 && ranked[i - 1].percent === t.percent
          ? ranked[i - 1].rank
          : i + 1;
    t.rank_label = t.rank && t.rank <= 3 ? RANK_LABELS[t.rank - 1] : "";
  });
  return {
    competition: {
      id: competition.id,
      title: competition.title,
      category: competition.category,
      grade_label: competition.grade_label,
    },
    max_total: maxTotal,
    judges: judges.map((j) => ({ id: j.judge_id, name: j.name, school: j.school })),
    complete,
    published,
    teams: ranked,
  };
}

const uuid = (v) =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const idOk = (v) => typeof v === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(v);
const strip = ({ owner_id, ...t }) => t;

async function certificateSettings(db) {
  const row = await db
    .prepare("SELECT value FROM app_settings WHERE key='certificate'")
    .first();
  return row ? { ...DEFAULT_CERTIFICATE, ...JSON.parse(row.value) } : DEFAULT_CERTIFICATE;
}

export async function judgingApi(r, env, user, { body, json, fail }) {
  const db = env.DB,
    url = new URL(r.url),
    path = url.pathname,
    method = r.method;
  const superadmin = Boolean(user.is_superadmin),
    reviewer = superadmin || Boolean(user.is_organizer);
  const competition = async (id) => {
    if (!idOk(id)) fail(404, "ไม่พบรายการแข่งขัน");
    const c = await db
      .prepare(
        "SELECT id,title,category,grade_label,rules_json FROM event_competitions WHERE id=?",
      )
      .bind(id)
      .first();
    if (!c) fail(404, "ไม่พบรายการแข่งขัน");
    return c;
  };

  // --- Judge assignment (superadmin) ---
  if (path === "/api/admin/judges" && method === "GET") {
    if (!superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const c = await competition(url.searchParams.get("competition_id"));
    const rows = (
      await db
        .prepare(
          "SELECT u.id,u.name,u.school,u.is_judge,u.is_superadmin,CASE WHEN j.judge_id IS NULL THEN 0 ELSE 1 END AS assigned FROM account_users u LEFT JOIN event_judges j ON j.judge_id=u.id AND j.competition_id=? WHERE u.is_judge=1 OR u.is_superadmin=1 ORDER BY assigned DESC,u.name",
        )
        .bind(c.id)
        .all()
    ).results;
    return json({
      judges: rows.map((u) => ({
        id: u.id,
        name: u.name,
        school: u.school,
        assigned: Boolean(u.assigned),
      })),
    });
  }
  if (path === "/api/admin/judges" && method === "POST") {
    if (!superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const b = await body(r, 1000000);
    const logo = typeof b.logo === "string" ? b.logo : "";
    if (logo && (logo.length > 300000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo)))
      fail(400, "ไฟล์โลโก้ไม่ถูกต้องหรือใหญ่เกินไป");
    const c = await competition(b.competition_id);
    if (!uuid(b.judge_id) || typeof b.assigned !== "boolean")
      fail(400, "ข้อมูลไม่ถูกต้อง");
    if (b.assigned) {
      const res = await db
        .prepare(
          "INSERT OR IGNORE INTO event_judges(competition_id,judge_id,assigned_by,created_at) SELECT ?,id,?,? FROM account_users WHERE id=? AND (is_judge=1 OR is_superadmin=1)",
        )
        .bind(c.id, user.id, now(), b.judge_id)
        .run();
      if (
        !res.meta.changes &&
        !(await db
          .prepare(
            "SELECT 1 FROM event_judges WHERE competition_id=? AND judge_id=?",
          )
          .bind(c.id, b.judge_id)
          .first())
      )
        fail(400, "บัญชีนี้ไม่ได้เลือกบทบาทกรรมการ");
    } else
      await db
        .prepare("DELETE FROM event_judges WHERE competition_id=? AND judge_id=?")
        .bind(c.id, b.judge_id)
        .run();
    return json({ ok: true });
  }

  // --- Judge scoring ---
  const isJudge = superadmin || Boolean(user.is_judge);
  if (path === "/api/judging" && method === "GET") {
    if (!isJudge) fail(403, "เฉพาะกรรมการเท่านั้น");
    const rows = (
      await db
        .prepare(
          "SELECT c.id,c.title,c.category,c.grade_label,c.rules_json,(SELECT COUNT(*) FROM event_registrations r WHERE r.competition_id=c.id AND r.status='approved' AND r.owner_id<>?) AS teams,(SELECT COUNT(*) FROM event_scores s JOIN event_registrations r ON r.id=s.registration_id AND r.revision=s.revision WHERE r.competition_id=c.id AND r.status='approved' AND s.judge_id=?) AS scored FROM event_judges j JOIN event_competitions c ON c.id=j.competition_id WHERE j.judge_id=? ORDER BY c.category,c.title",
        )
        .bind(user.id, user.id, user.id)
        .all()
    ).results;
    return json({
      competitions: rows.map(({ rules_json, ...c }) => c),
    });
  }
  const judgeMatch = path.match(/^\/api\/judging\/([a-zA-Z0-9-]+)(\/scores)?$/);
  if (judgeMatch) {
    if (!isJudge) fail(403, "เฉพาะกรรมการเท่านั้น");
    const c = await competition(judgeMatch[1]);
    if (
      !(await db
        .prepare(
          "SELECT 1 FROM event_judges WHERE competition_id=? AND judge_id=?",
        )
        .bind(c.id, user.id)
        .first())
    )
      fail(403, "คุณไม่ได้รับมอบหมายให้ตัดสินรายการนี้");
    const criteria = criteriaOf(c.rules_json);
    if (!judgeMatch[2] && method === "GET") {
      const regs = (
        await db
          .prepare(
            "SELECT r.id,r.revision,r.owner_id,r.work_url,s.scores_json,s.updated_at AS scored_at FROM event_registrations r LEFT JOIN event_scores s ON s.registration_id=r.id AND s.judge_id=? AND s.revision=r.revision WHERE r.competition_id=? AND r.status='approved' ORDER BY r.created_at,r.id",
          )
          .bind(user.id, c.id)
          .all()
      ).results;
      const students = await studentsOf(
        db,
        regs.map((x) => x.id),
      );
      return json({
        competition: { id: c.id, title: c.title, category: c.category, grade_label: c.grade_label },
        criteria,
        teams: regs.map((x, i) => ({
          id: x.id,
          number: i + 1,
          revision: x.revision,
          own: x.owner_id === user.id,
          work_url: x.work_url,
          students: students.get(x.id),
          scores: x.scores_json ? JSON.parse(x.scores_json) : null,
          scored_at: x.scored_at,
        })),
      });
    }
    if (judgeMatch[2] && method === "POST") {
      const b = await body(r);
      if (
        !uuid(b.registration_id) ||
        !Number.isInteger(b.revision) ||
        !Array.isArray(b.scores) ||
        b.scores.length !== criteria.length
      )
        fail(400, "กรอกคะแนนให้ครบทุกเกณฑ์");
      const scores = b.scores.map((v, i) => {
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > criteria[i].max)
          fail(400, `คะแนน “${criteria[i].label}” ต้องอยู่ระหว่าง 0–${criteria[i].max}`);
        return round2(v);
      });
      const total = round2(scores.reduce((a, v) => a + v, 0));
      const res = await db
        .prepare(
          "INSERT INTO event_scores(registration_id,judge_id,revision,scores_json,total,updated_at) SELECT r.id,?,r.revision,?,?,? FROM event_registrations r WHERE r.id=? AND r.competition_id=? AND r.status='approved' AND r.revision=? AND r.owner_id<>? AND EXISTS(SELECT 1 FROM event_judges WHERE competition_id=r.competition_id AND judge_id=?) AND EXISTS(SELECT 1 FROM event_competitions WHERE id=r.competition_id AND rules_json=?) ON CONFLICT(registration_id,judge_id) DO UPDATE SET revision=excluded.revision,scores_json=excluded.scores_json,total=excluded.total,updated_at=excluded.updated_at",
        )
        .bind(
          user.id,
          JSON.stringify(scores),
          total,
          now(),
          b.registration_id,
          c.id,
          b.revision,
          user.id,
          user.id,
          c.rules_json,
        )
        .run();
      if (!res.meta.changes)
        fail(409, "บันทึกไม่ได้ ทีมนี้ไม่ได้อยู่ในรายการที่ยืนยันแล้ว ข้อมูลเปลี่ยน หรือเป็นทีมที่คุณส่งเอง");
      return json({ ok: true, total });
    }
  }

  // --- Results ---
  if (path === "/api/results" && method === "GET") {
    const comps = (
      await db
        .prepare(
          "SELECT id,title,category,grade_label,rules_json FROM event_competitions c WHERE EXISTS(SELECT 1 FROM event_registrations r WHERE r.competition_id=c.id AND r.status='approved') ORDER BY category,title",
        )
        .all()
    ).results;
    const list = [];
    for (const c of comps) {
      const res = await computeResults(db, c);
      if (!res.published && !reviewer) continue;
      list.push({
        ...res.competition,
        complete: res.complete,
        published: res.published,
        teams: res.teams.length,
        judges: res.judges.length,
        scored: res.teams.filter((t) => t.complete).length,
      });
    }
    return json({ competitions: list });
  }
  const resultMatch = path.match(/^\/api\/results\/([a-zA-Z0-9-]+)$/);
  if (resultMatch && method === "GET") {
    const res = await computeResults(db, await competition(resultMatch[1]));
    if (!res.published && !reviewer) fail(404, "ยังไม่ประกาศผลรายการนี้");
    return json({ ...res, teams: res.teams.map(strip) });
  }

  // --- Certificates ---
  if (path === "/api/certificate-settings" && method === "GET")
    return json({ settings: await certificateSettings(db) });
  if (path === "/api/certificate-settings" && method === "POST") {
    if (!superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const b = await body(r, 1000000);
    const logo = typeof b.logo === "string" ? b.logo : "";
    if (logo && (logo.length > 300000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo)))
      fail(400, "ไฟล์โลโก้ไม่ถูกต้องหรือใหญ่เกินไป");
    const s = (v, m) => (typeof v === "string" ? v.trim().slice(0, m) : "");
    const signers = Array.isArray(b.signers) ? b.signers.slice(0, 3) : [];
    const value = {
      organization: s(b.organization, 150) || DEFAULT_CERTIFICATE.organization,
      event_line: s(b.event_line, 200) || DEFAULT_CERTIFICATE.event_line,
      issued_text: s(b.issued_text, 100),
      logo,
      signers: signers
        .map((x) => {
          const signature = typeof x?.signature === "string" ? x.signature : "";
          if (signature && (signature.length > 200000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature)))
            fail(400, "ไฟล์ลายเซ็นไม่ถูกต้องหรือใหญ่เกินไป");
          return { name: s(x?.name, 100), position: s(x?.position, 120), signature };
        })
        .filter((x) => x.name || x.position || x.signature),
    };
    await db
      .prepare(
        "INSERT INTO app_settings(key,value,updated_by,updated_at) VALUES('certificate',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
      )
      .bind(JSON.stringify(value), user.id, now())
      .run();
    return json({ settings: value });
  }
  // Each downloadable certificate file is a "unit": student pages or coach
  // pages of one team, or one judge's page. Its fingerprint changes whenever
  // anything printed on it (scores, names, settings, design) changes.
  const settings = await certificateSettings(db);
  const settingsKey = await digest(JSON.stringify(settings));
  const fingerprint = (key, payload) =>
    digest(JSON.stringify([CERTIFICATE_DESIGN, settingsKey, key, payload]));
  const teamPayload = (res, t) => ({ competition: res.competition, ...strip(t) });
  const judgePayload = (res, j) => ({ competition: res.competition, judge: j });

  if (path === "/api/certificates" && method === "GET") {
    // Visible after results publish: coach -> own teams (students + coach
    // certificates); assigned judge -> every team's students in that
    // competition + own judge certificate; superadmin -> everything.
    const comps = (
      await db
        .prepare(
          "SELECT c.id,c.title,c.category,c.grade_label,c.rules_json FROM event_competitions c WHERE ?=1 OR EXISTS(SELECT 1 FROM event_registrations r WHERE r.competition_id=c.id AND r.status='approved' AND r.owner_id=?) OR EXISTS(SELECT 1 FROM event_judges j WHERE j.competition_id=c.id AND j.judge_id=?) ORDER BY c.category,c.title",
        )
        .bind(superadmin ? 1 : 0, user.id, user.id)
        .all()
    ).results;
    const stored = new Map(
      (
        await db
          .prepare("SELECT unit_key,fingerprint FROM certificate_files")
          .all()
      ).results.map((x) => [x.unit_key, x.fingerprint]),
    );
    const file = async (key, payload) => {
      const f = await fingerprint(key, payload);
      return { key, fingerprint: f, stored: stored.get(key) === f };
    };
    const certificates = [],
      judge_certificates = [],
      pending = [];
    for (const c of comps) {
      const res = await computeResults(db, c);
      const judging = res.judges.some((j) => j.id === user.id);
      const mine = res.teams.filter(
        (t) => superadmin || judging || t.owner_id === user.id,
      );
      if (!res.teams.length) continue;
      if (!res.published) {
        pending.push({ ...res.competition, teams: mine.length });
        continue;
      }
      for (const t of mine) {
        const coachCert = superadmin || t.owner_id === user.id;
        certificates.push({
          competition: res.competition,
          ...strip(t),
          own: t.owner_id === user.id,
          coach_certificate: coachCert,
          files: {
            student: await file("student." + t.registration_id, teamPayload(res, t)),
            ...(coachCert
              ? { coach: await file("coach." + t.registration_id, teamPayload(res, t)) }
              : {}),
          },
        });
      }
      const judgesFor = superadmin
        ? res.judges
        : res.judges.filter((j) => j.id === user.id);
      if (judgesFor.length) {
        const judges = [];
        for (const j of judgesFor)
          judges.push({
            id: j.id,
            name: j.name,
            school: j.school,
            file: await file("judge." + c.id + "." + j.id, judgePayload(res, j)),
          });
        judge_certificates.push({ competition: res.competition, judges });
      }
    }
    return json({
      certificates,
      judge_certificates,
      pending,
      drive: driveEnabled(env),
      settings,
    });
  }

  const fileMatch = path.match(
    /^\/api\/certificate-files\/(?:(student|coach)\.([a-f0-9-]{36})|judge\.([a-zA-Z0-9-]{1,80})\.([a-f0-9-]{36}))$/i,
  );
  if (fileMatch && (method === "GET" || method === "POST")) {
    const key = path.slice("/api/certificate-files/".length);
    let competitionId = fileMatch[3];
    if (!competitionId) {
      const reg = await db
        .prepare("SELECT competition_id FROM event_registrations WHERE id=?")
        .bind(fileMatch[2])
        .first();
      if (!reg) fail(404, "ไม่พบประกาศนียบัตร");
      competitionId = reg.competition_id;
    }
    const c = await competition(competitionId);
    const res = await computeResults(db, c);
    if (!res.published) fail(404, "ยังไม่ประกาศผลรายการนี้");
    const judging = res.judges.some((j) => j.id === user.id);
    let payload = null;
    if (fileMatch[1]) {
      const t = res.teams.find((x) => x.registration_id === fileMatch[2]);
      const allowed =
        t &&
        (superadmin ||
          t.owner_id === user.id ||
          (fileMatch[1].toLowerCase() === "student" && judging));
      if (allowed) payload = teamPayload(res, t);
    } else {
      const j = res.judges.find((x) => x.id === fileMatch[4]);
      if (j && (superadmin || j.id === user.id)) payload = judgePayload(res, j);
    }
    if (!payload) fail(404, "ไม่พบประกาศนียบัตรหรือไม่มีสิทธิ์เข้าถึง");
    const current = await fingerprint(key, payload);
    if (!driveEnabled(env)) fail(503, "ยังไม่ได้ตั้งค่า Google Drive");
    const row = await db
      .prepare("SELECT * FROM certificate_files WHERE unit_key=?")
      .bind(key)
      .first();
    if (method === "GET") {
      if (!row || row.fingerprint !== current)
        fail(404, "ยังไม่มีไฟล์ประกาศนียบัตรฉบับล่าสุด");
      let data;
      try {
        data = await downloadFile(env, row.drive_file_id);
      } catch (error) {
        console.error("certificate drive download failed", error);
        fail(502, "โหลดไฟล์จาก Google Drive ไม่สำเร็จ");
      }
      return new Response(data, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, noarchive",
        },
      });
    }
    if (r.headers.get("x-certificate-fingerprint") !== current)
      fail(409, "ข้อมูลประกาศนียบัตรเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่");
    if (row?.fingerprint === current) return json({ ok: true, stored: true });
    if ((r.headers.get("content-type") || "").split(";")[0] !== "application/pdf")
      fail(415, "ต้องเป็นไฟล์ PDF");
    const reader = r.body?.getReader();
    if (!reader) fail(400, "ไม่พบไฟล์");
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_CERTIFICATE_PDF) {
        await reader.cancel();
        fail(413, "ไฟล์ PDF ใหญ่เกินกำหนด");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-")
      fail(415, "ต้องเป็นไฟล์ PDF");
    let driveId;
    try {
      driveId = await uploadFile(env, db, "certificates", key + ".pdf", "application/pdf", bytes);
    } catch (error) {
      console.error("certificate drive upload failed", error);
      fail(502, "บันทึกไฟล์ไปยัง Google Drive ไม่สำเร็จ");
    }
    await db
      .prepare(
        "INSERT INTO certificate_files(unit_key,competition_id,fingerprint,drive_file_id,size,created_by,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(unit_key) DO UPDATE SET fingerprint=excluded.fingerprint,drive_file_id=excluded.drive_file_id,size=excluded.size,created_by=excluded.created_by,created_at=excluded.created_at",
      )
      .bind(key, c.id, current, driveId, size, user.id, now())
      .run();
    if (row && row.drive_file_id !== driveId)
      await deleteFiles(env, [row.drive_file_id]);
    return json({ ok: true, stored: true }, 201);
  }
  fail(404, "ไม่พบรายการที่ร้องขอ");
}
