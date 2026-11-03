import { now } from "./security.js";

export const MEDALS = [
  { min: 80, label: "เหรียญทอง" },
  { min: 70, label: "เหรียญเงิน" },
  { min: 60, label: "เหรียญทองแดง" },
  { min: 0, label: "เข้าร่วม" },
];
export const RANK_LABELS = ["ชนะเลิศ", "รองชนะเลิศอันดับ 1", "รองชนะเลิศอันดับ 2"];
export const DEFAULT_CERTIFICATE = {
  organization: "ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง",
  event_line:
    "งานศิลปหัตถกรรมนักเรียน ครั้งที่ 73 ปีการศึกษา 2568 ระดับศูนย์เครือข่าย",
  issued_text: "",
  signers: [{ name: "", position: "ประธานศูนย์เครือข่าย" }],
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
        "SELECT j.judge_id,u.name FROM event_judges j JOIN account_users u ON u.id=j.judge_id WHERE j.competition_id=? ORDER BY u.name",
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
    judges: judges.map((j) => ({ id: j.judge_id, name: j.name })),
    complete,
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
    const b = await body(r);
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
          "INSERT INTO event_scores(registration_id,judge_id,revision,scores_json,total,updated_at) SELECT r.id,?,r.revision,?,?,? FROM event_registrations r WHERE r.id=? AND r.competition_id=? AND r.status='approved' AND r.revision=? AND r.owner_id<>? AND EXISTS(SELECT 1 FROM event_judges WHERE competition_id=r.competition_id AND judge_id=?) ON CONFLICT(registration_id,judge_id) DO UPDATE SET revision=excluded.revision,scores_json=excluded.scores_json,total=excluded.total,updated_at=excluded.updated_at",
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
      if (!res.complete && !reviewer) continue;
      list.push({
        ...res.competition,
        complete: res.complete,
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
    if (!res.complete && !reviewer) fail(404, "ยังไม่ประกาศผลรายการนี้");
    return json({ ...res, teams: res.teams.map(strip) });
  }

  // --- Certificates ---
  if (path === "/api/certificate-settings" && method === "GET")
    return json({ settings: await certificateSettings(db) });
  if (path === "/api/certificate-settings" && method === "POST") {
    if (!superadmin) fail(403, "เฉพาะ superadmin เท่านั้น");
    const b = await body(r);
    const s = (v, m) => (typeof v === "string" ? v.trim().slice(0, m) : "");
    const signers = Array.isArray(b.signers) ? b.signers.slice(0, 3) : [];
    const value = {
      organization: s(b.organization, 150) || DEFAULT_CERTIFICATE.organization,
      event_line: s(b.event_line, 200) || DEFAULT_CERTIFICATE.event_line,
      issued_text: s(b.issued_text, 100),
      signers: signers
        .map((x) => ({ name: s(x?.name, 100), position: s(x?.position, 120) }))
        .filter((x) => x.name || x.position),
    };
    await db
      .prepare(
        "INSERT INTO app_settings(key,value,updated_by,updated_at) VALUES('certificate',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
      )
      .bind(JSON.stringify(value), user.id, now())
      .run();
    return json({ settings: value });
  }
  if (path === "/api/certificates" && method === "GET") {
    const comps = (
      await db
        .prepare(
          "SELECT DISTINCT c.id,c.title,c.category,c.grade_label,c.rules_json FROM event_competitions c JOIN event_registrations r ON r.competition_id=c.id WHERE r.status='approved' AND (?=1 OR r.owner_id=?) ORDER BY c.category,c.title",
        )
        .bind(superadmin ? 1 : 0, user.id)
        .all()
    ).results;
    const certificates = [],
      pending = [];
    for (const c of comps) {
      const res = await computeResults(db, c);
      const mine = res.teams.filter((t) => superadmin || t.owner_id === user.id);
      if (!res.complete) {
        pending.push({ ...res.competition, teams: mine.length });
        continue;
      }
      for (const t of mine)
        certificates.push({ competition: res.competition, ...strip(t) });
    }
    return json({
      certificates,
      pending,
      settings: await certificateSettings(db),
    });
  }
  fail(404, "ไม่พบรายการที่ร้องขอ");
}
