import React, { useEffect, useState } from "react";
import { api } from "../api";

const root = "/admin/console/";

export function confirmDelete(impact) {
  return window.prompt(impact + "\nพิมพ์ ลบถาวร เพื่อยืนยัน")?.trim();
}

function useAdminAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  async function run(action, success) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (success)
        setMessage({
          text: result?.remaining ? `${success} · มีไฟล์ Drive รอลบอีก ${result.remaining} ไฟล์` : success,
        });
      return result;
    } catch (error) {
      setMessage({ error: true, text: error.message });
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, run };
}

function Feedback({ message }) {
  if (!message) return null;
  return (
    <p role={message.error ? "alert" : "status"} className={message.error ? "error" : "success-message"}>
      {message.text}
    </p>
  );
}

const groups = [
  [
    "manage",
    "รายการแข่งขัน เกณฑ์ และตารางแข่ง",
    "กำหนดเกณฑ์คะแนน จำนวนนักเรียน วันเวลา สถานที่ และเปิด–ปิดรับสมัคร",
  ],
  ["review", "ใบสมัคร นักเรียน และเอกสาร", "ตรวจ ยืนยัน ส่งกลับ แก้ไขข้อมูลและภาพบัตร หรือลบใบสมัคร"],
  ["judges", "มอบหมายกรรมการ", "เพิ่มหรือถอนกรรมการรายรายการแข่งขัน"],
  [
    "scoring",
    "คะแนน ผลการแข่งขัน และไฟล์เกียรติบัตร",
    "แก้คะแนน ระงับหรือประกาศผล และล้างไฟล์ PDF ที่จัดเก็บ",
  ],
  ["certificates", "แบบเกียรติบัตร", "ตั้งค่าข้อความ โลโก้ ลายเซ็น และดาวน์โหลดเกียรติบัตร"],
  [
    "users",
    "บัญชี สิทธิ์ และการตั้งค่าระบบ",
    "แก้ข้อมูลผู้ใช้ กำหนดสิทธิ์ จัดการเอกสารใน Drive เปิด–ปิดระบบ และเริ่มรอบใหม่",
  ],
];

export function AdminOverview({ onTab }) {
  const [data, setData] = useState(null);
  const { busy, message, run } = useAdminAction();
  const load = async () => setData(await api(root + "overview"));
  useEffect(() => {
    run(load);
  }, []);
  return (
    <>
      <section className="panel admin-intro">
        <span className="eyebrow">SUPERADMIN</span>
        <h1>ศูนย์จัดการหลังบ้าน</h1>
        <p>ควบคุมข้อมูลการแข่งขันศิลปหัตถกรรมจากเมนูด้านล่าง</p>
        {data && (
          <>
            <p className={"badge " + (data.system_closed ? "status-pending" : "status-approved")}>
              {data.system_closed ? "ระบบปิดใช้งานชั่วคราว" : "ระบบเปิดใช้งาน"}
            </p>
            <dl className="admin-stats">
              {[
                ["competitions", "รายการแข่งขัน"],
                ["open", "เปิดรับสมัคร"],
                ["registrations", "ใบสมัคร"],
                ["pending", "รอตรวจ"],
                ["accounts", "บัญชีผู้ใช้"],
                ["scores", "รายการคะแนน"],
              ].map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{data[key].toLocaleString("th-TH")}</dd>
                </div>
              ))}
            </dl>
            {data.files_pending > 0 && (
              <div className="notice">
                มีไฟล์ Google Drive รอลบ {data.files_pending} ไฟล์{" "}
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result = await api(root + "files/cleanup", {});
                      await load();
                      return result;
                    }, "ดำเนินการลบไฟล์แล้ว")
                  }
                >
                  ลองลบไฟล์อีกครั้ง
                </button>
              </div>
            )}
          </>
        )}
        <Feedback message={message} />
        <button className="secondary" disabled={busy} onClick={() => run(load)}>
          อัปเดตสรุป
        </button>
      </section>
      <div className="competition-list">
        {groups.map(([key, label, description]) => (
          <button type="button" className="panel judge-item" key={key} onClick={() => onTab(key)}>
            <strong>{label}</strong>
            <span className="muted">{description}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function AccountEditor({ account, onSaved, onCancel }) {
  const { busy, message, run } = useAdminAction();
  function save(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(async () => {
      const result = await api(root + "users" + (account ? "/" + account.id : ""), {
        name: data.get("name"),
        school: data.get("school"),
        email: data.get("email"),
        coach: data.has("coach"),
        judge: data.has("judge"),
        password: data.get("password"),
      });
      onSaved(result.user);
    });
  }
  return (
    <form className="panel" onSubmit={save}>
      <h3>{account ? "แก้บัญชี " + account?.name : "เพิ่มบัญชีผู้ใช้"}</h3>
      <fieldset disabled={busy}>
        <div className="student-fields">
          <label className="field">
            ชื่อ–นามสกุล
            <input name="name" defaultValue={account?.name} minLength={2} maxLength={100} required />
          </label>
          <label className="field">
            โรงเรียน
            <input name="school" defaultValue={account?.school} minLength={2} maxLength={150} required />
          </label>
          <label className="field">
            อีเมล
            <input name="email" type="email" defaultValue={account?.email} maxLength={254} required />
          </label>
        </div>
        <div className="form-actions">
          <label>
            <input type="checkbox" name="coach" defaultChecked={account?.roles.includes("coach")} />{" "}
            ผู้ฝึกซ้อม
          </label>
          <label>
            <input type="checkbox" name="judge" defaultChecked={account?.roles.includes("judge")} /> กรรมการ
          </label>
        </div>
        <label className="field">
          {account ? "ตั้งรหัสผ่านใหม่ (เว้นว่างเพื่อใช้รหัสเดิม)" : "รหัสผ่านเริ่มต้น"}
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required={!account}
          />
        </label>
        <Feedback message={message} />
        <div className="form-actions">
          <button className="primary" type="submit">
            บันทึกบัญชี
          </button>
          <button className="secondary" type="button" onClick={onCancel}>
            ยกเลิก
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function thaiDateInput(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 7 * 3600000).toISOString().slice(0, 16) : "";
}

export function CompetitionEditor({ competition: c, onSaved, onCancel }) {
  const [criteria, setCriteria] = useState(() => {
    const rules = c.rules?.score_rules;
    return rules?.length
      ? rules.map(({ label, max }) => ({ label, max }))
      : [{ label: "คะแนนรวม", max: 100 }];
  });
  const { busy, message, run } = useAdminAction();
  function update(index, key, value) {
    setCriteria((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }
  function save(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const values = Object.fromEntries(fields);
    const data = {
      title: values.title,
      description: values.description,
      category: values.category,
      grade_label: values.grade_label,
      venue: values.venue,
      eligibility: {
        grades: fields.getAll("allowed_grade"),
        gender: values.gender,
        coach_min: Number(values.coach_min),
        coach_max: values.coach_max ? Number(values.coach_max) : null,
        work_required: fields.has("work_required"),
      },
      starts_at: values.starts_at ? new Date(values.starts_at + ":00+07:00").toISOString() : "",
      min_students: Number(values.min_students),
      max_students: values.max_students ? Number(values.max_students) : null,
      registration_open: values.registration_open === "open",
      criteria: criteria.map((row) => ({ ...row, max: Number(row.max) })),
    };
    run(async () => {
      await api(root + "competitions/" + c.id, data);
      onSaved("บันทึกรายการแข่งขันแล้ว");
    });
  }
  function remove() {
    const confirm = confirmDelete(
      `ลบรายการ “${c.title}”${c.catalog_key ? " และต้นแบบเกณฑ์ของรายการนี้" : ""} ถาวร`,
    );
    if (confirm === undefined) return;
    run(async () => {
      await api(root + "competitions/" + c.id, { action: "delete", confirm });
      onSaved("ลบรายการแข่งขันแล้ว");
    });
  }
  return (
    <section className="panel">
      <h2>แก้ไขรายการและเกณฑ์</h2>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <div className="student-fields">
            <label className="field">
              ชื่อรายการ
              <input name="title" defaultValue={c.title} minLength={2} maxLength={200} required />
            </label>
            <label className="field">
              หมวด
              <input name="category" defaultValue={c.category} maxLength={150} />
            </label>
            <label className="field">
              ระดับชั้นที่แสดง
              <input name="grade_label" defaultValue={c.grade_label} maxLength={100} />
            </label>
            <label className="field">
              สถานที่
              <input name="venue" defaultValue={c.venue} maxLength={200} />
            </label>
            <label className="field">
              วันเวลาแข่งขัน (เวลาไทย)
              <input name="starts_at" type="datetime-local" defaultValue={thaiDateInput(c.starts_at)} />
            </label>
            <label className="field">
              การรับสมัคร
              <select name="registration_open" defaultValue={c.registration_open ? "open" : "closed"}>
                <option value="open">เปิดรับสมัคร</option>
                <option value="closed">ปิดรับสมัคร</option>
              </select>
            </label>
            <label className="field">
              นักเรียนขั้นต่ำ
              <input
                name="min_students"
                type="number"
                defaultValue={c.min_students}
                min={1}
                max={1000}
                required
              />
            </label>
            <label className="field">
              นักเรียนสูงสุด (เว้นว่างได้)
              <input
                name="max_students"
                type="number"
                defaultValue={c.max_students ?? ""}
                min={1}
                max={1000}
              />
            </label>
          </div>
          <label className="field">
            รายละเอียดและเกณฑ์การแข่งขัน
            <textarea name="description" defaultValue={c.description} maxLength={3000} rows={4} />
          </label>
          <h3>คุณสมบัติผู้สมัคร</h3>
          <p className="muted">เลือกชั้นที่จะตรวจตอนรับสมัคร ถ้าไม่เลือก ระบบรับตามข้อมูลชั้นเรียนที่กรอก</p>
          <div className="form-actions">
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const grade = "ป." + n;
              return (
                <label key={grade}>
                  <input
                    name="allowed_grade"
                    type="checkbox"
                    value={grade}
                    defaultChecked={c.rules?.policy?.allowed_grades?.includes(grade)}
                  />{" "}
                  {grade}
                </label>
              );
            })}
          </div>
          <div className="student-fields">
            <label className="field">
              ประเภทผู้แข่งขัน
              <select
                name="gender"
                defaultValue={c.rules?.policy?.mixed_gender_pair ? "คู่ผสม" : c.rules?.policy?.gender || ""}
              >
                <option value="">ไม่จำกัด</option>
                <option>ชาย</option>
                <option>หญิง</option>
                <option>คู่ผสม</option>
              </select>
            </label>
            <label className="field">
              ครูผู้ฝึกซ้อมขั้นต่ำ
              <input
                name="coach_min"
                type="number"
                min={1}
                max={100}
                required
                defaultValue={c.rules?.coach_limits?.min ?? 1}
              />
            </label>
            <label className="field">
              ครูผู้ฝึกซ้อมสูงสุด
              <input
                name="coach_max"
                type="number"
                min={1}
                max={100}
                defaultValue={c.rules?.coach_limits?.max ?? ""}
              />
            </label>
          </div>
          <label>
            <input type="checkbox" name="work_required" defaultChecked={c.rules?.policy?.work_required} />{" "}
            บังคับแนบลิงก์ผลงาน HTTPS
          </label>
          <h3>เกณฑ์ให้คะแนน</h3>
          <p className="muted">ถ้าบันทึกคะแนนแล้ว ให้ลบคะแนนเดิมก่อนเปลี่ยนเกณฑ์คะแนน</p>
          {criteria.map((row, i) => (
            <div className="admin-criterion" key={i}>
              <label className="field">
                เกณฑ์ข้อ {i + 1}
                <input
                  value={row.label}
                  maxLength={200}
                  required
                  onChange={(e) => update(i, "label", e.target.value)}
                />
              </label>
              <label className="field">
                คะแนนเต็ม
                <input
                  type="number"
                  value={row.max}
                  min={0.01}
                  max={10000}
                  step={0.01}
                  required
                  onChange={(e) => update(i, "max", e.target.value)}
                />
              </label>
              <button
                type="button"
                className="secondary"
                disabled={criteria.length === 1}
                onClick={() => setCriteria((rows) => rows.filter((_, index) => index !== i))}
              >
                เอาข้อนี้ออก
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={criteria.length >= 50}
            onClick={() => setCriteria((rows) => [...rows, { label: "", max: 10 }])}
          >
            เพิ่มเกณฑ์คะแนน
          </button>
          <Feedback message={message} />
          <div className="form-actions">
            <button className="primary" type="submit">
              บันทึกรายการ
            </button>
            <button className="secondary" type="button" onClick={onCancel}>
              ยกเลิก
            </button>
            <button className="danger-button" type="button" onClick={remove}>
              ลบรายการ
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

export function ScoringAdmin({ competitions }) {
  const [id, setId] = useState("");
  return (
    <section className="panel">
      <h2>จัดการคะแนนและผลการแข่งขัน</h2>
      <label className="field">
        รายการแข่งขัน
        <select value={id} onChange={(event) => setId(event.target.value)}>
          <option value="">เลือกรายการแข่งขัน</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} · {c.grade_label}
            </option>
          ))}
        </select>
      </label>
      {id && <CompetitionScores key={id} id={id} />}
    </section>
  );
}

function CompetitionScores({ id }) {
  const [data, setData] = useState(null);
  const [teamId, setTeamId] = useState("");
  const [judgeId, setJudgeId] = useState("");
  const { busy, message, run } = useAdminAction();
  const load = async () => setData(await api(root + "scoring/" + id));
  useEffect(() => {
    run(load);
  }, []);
  const team = data?.teams.find((row) => row.id === teamId);
  const judge = data?.judges.find((row) => row.id === judgeId);
  const score = data?.scores.find((row) => row.registration_id === teamId && row.judge_id === judgeId);
  function scoreAction(values) {
    return async () => {
      await api(root + "scoring/" + id, {
        registration_id: team.id,
        judge_id: judgeId,
        revision: team.revision,
        ...values,
      });
      await load();
    };
  }
  function visibility(action) {
    run(
      async () => {
        await api(root + "results/" + id, { action });
        await load();
      },
      action === "hold" ? "ระงับผลและการดาวน์โหลดเกียรติบัตรแล้ว" : "ประกาศผลแล้ว",
    );
  }
  return (
    <>
      <Feedback message={message} />
      <button type="button" className="secondary" disabled={busy} onClick={() => run(load)}>
        โหลดคะแนนล่าสุด
      </button>
      {data && (
        <>
          <div className="notice">
            {data.hold ? "ระงับผลและเกียรติบัตรอยู่" : "ระบบประกาศผลเมื่อกรรมการให้คะแนนครบ"}
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy || data.hold}
                onClick={() => visibility("hold")}
              >
                ระงับผล
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy || !data.hold}
                onClick={() => visibility("publish")}
              >
                ประกาศผล
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={busy}
                onClick={() => {
                  const confirm = confirmDelete(
                    "ลบไฟล์เกียรติบัตรที่บันทึกไว้ของรายการนี้ ระบบจะสร้างไฟล์ใหม่เมื่อดาวน์โหลด",
                  );
                  if (confirm !== undefined)
                    run(
                      () => api(root + "certificates/" + id + "/clear", { confirm }),
                      "ล้างไฟล์เกียรติบัตรแล้ว",
                    );
                }}
              >
                ล้างไฟล์เกียรติบัตร
              </button>
            </div>
          </div>
          <div className="student-fields">
            <label className="field">
              ทีม
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">เลือกทีม</option>
                {data.teams.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.school} · {row.name} · {row.students}
                    {row.status !== "approved" && " (รอตรวจ)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              กรรมการ
              <select value={judgeId} onChange={(e) => setJudgeId(e.target.value)}>
                <option value="">เลือกกรรมการ</option>
                {data.judges.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.school}
                    {!row.assigned && " (ถอนมอบหมายแล้ว)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {team && judgeId && (
            <form
              key={teamId + ":" + judgeId + ":" + JSON.stringify(score?.values)}
              onSubmit={(event) => {
                event.preventDefault();
                const scores = Array.from(new FormData(event.currentTarget).getAll("score"), Number);
                run(scoreAction({ scores }), "บันทึกคะแนนแล้ว");
              }}
            >
              <fieldset disabled={busy}>
                <div className="student-fields">
                  {data.criteria.map((criterion, i) => (
                    <label className="field" key={i}>
                      {criterion.label} (เต็ม {criterion.max})
                      <input
                        name="score"
                        type="number"
                        step={0.01}
                        min={0}
                        max={criterion.max}
                        defaultValue={score?.values[i] ?? ""}
                        required
                      />
                    </label>
                  ))}
                </div>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="primary"
                    disabled={!judge?.assigned || team.status !== "approved"}
                  >
                    บันทึกคะแนน
                  </button>
                  {score && (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => {
                        const confirm = confirmDelete(
                          `ลบคะแนนของกรรมการ ${judge?.name} สำหรับทีม ${team.school} · ${team.name}`,
                        );
                        if (confirm !== undefined)
                          run(scoreAction({ action: "delete", confirm }), "ลบคะแนนแล้ว");
                      }}
                    >
                      ลบคะแนน
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
          )}
        </>
      )}
    </>
  );
}
