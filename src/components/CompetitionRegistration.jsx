import CompetitionRules, { studentCount } from "./CompetitionRules";
import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  CertificatesPanel,
  JudgeAssignment,
  JudgePanel,
  ResultsPanel,
} from "./Judging";
const statuses = {
  pending: "รอตรวจเอกสาร",
  approved: "ยืนยันการลงทะเบียนแล้ว",
  changes_requested: "ผู้จัดขอให้แก้ไข",
};
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      }).format(new Date(value))
    : "รอประกาศ";
async function imageForUpload(file) {
  if (!["image/jpeg", "image/png"].includes(file.type))
    throw Error("เลือกภาพ JPG หรือ PNG เท่านั้น");
  if (file.size > 10 * 1024 * 1024) throw Error("เลือกภาพขนาดไม่เกิน 10 MB");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw Error("เปิดภาพไม่ได้ กรุณาเลือกไฟล์ JPG หรือ PNG ใหม่");
  }
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("ไม่สามารถเตรียมภาพได้");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.76, 0.64, 0.5]) {
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= 1048576) return blob;
    }
    throw Error("ภาพมีขนาดใหญ่เกินไป กรุณาครอปให้เห็นเฉพาะบัตรแล้วลองใหม่");
  } finally {
    bitmap.close();
  }
}
async function upload(file) {
  const body = await imageForUpload(file),
    response = await fetch("/api/registration-documents", {
      method: "POST",
      body,
      headers: { "Content-Type": body.type },
      credentials: "same-origin",
    });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("auth-expired"));
    throw Error(result.error || "อัปโหลดภาพไม่สำเร็จ");
  }
  return result.id;
}
const discard = (id) =>
  fetch("/api/registration-documents/" + id, {
    method: "DELETE",
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {});
function StudentPhoto({ student, index, disabled, onChange, onUploading }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="student-photo">
      <label className="field">
        ภาพบัตรประชาชน นักเรียนคนที่ {index + 1}
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={disabled || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError("");
            setBusy(true);
            onUploading(1);
            try {
              onChange(await upload(file));
            } catch (error) {
              setError(error.message);
            } finally {
              setBusy(false);
              onUploading(-1);
              e.target.value = "";
            }
          }}
        />
      </label>
      {busy && <p role="status">กำลังเตรียมและอัปโหลดภาพ…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {student.document_id && (
        <a
          className="identity-preview"
          href={"/api/registration-documents/" + student.document_id}
          target="_blank"
          rel="noreferrer"
        >
          <img
            src={"/api/registration-documents/" + student.document_id}
            alt={"ภาพบัตรประชาชนนักเรียนคนที่ " + (index + 1)}
          />
          <span>ตรวจความชัดเจน / เปิดภาพเต็ม</span>
        </a>
      )}
      <p className="muted">
        JPG / PNG ไม่เกิน 10 MB ระบบจะปรับขนาดภาพก่อนจัดเก็บ
        ภาพเปิดดูได้เฉพาะผู้ส่ง ผู้จัด และ superadmin
      </p>
    </div>
  );
}
function RegistrationForm({ competition, user, existing, onDone, onCancel }) {
  const rules = competition.rules || {},
    policy = rules.policy || {};
  const [variant, setVariant] = useState(
    existing?.variant || policy.team_variants?.[0]?.key || "",
  );
  const selectedVariant = policy.team_variants?.find((v) => v.key === variant);
  const minStudents = selectedVariant?.min_students ?? competition.min_students;
  const maxStudents = selectedVariant?.max_students ?? competition.max_students;
  const [coaches, setCoaches] = useState(
    existing?.coaches?.length
      ? existing.coaches
      : Array.from({ length: rules.coach_limits?.min || 1 }, (_, i) => ({
          name: i === 0 ? user.name : "",
        })),
  );
  const [workUrl, setWorkUrl] = useState(existing?.work_url || "");
  const blank = () => ({
    key: crypto.randomUUID(),
    first_name: "",
    last_name: "",
    grade: "",
    gender: "",
    school: user.school,
    document_id: "",
  });
  const [students, setStudents] = useState(
    existing?.students.map((s) => ({ ...s, key: s.id })) ||
      Array.from({ length: minStudents }, blank),
  );
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(0),
    [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID()),
    uploaded = useRef(new Set()),
    saved = useRef(false);
  const blocked = busy || uploading > 0;
  useEffect(
    () => () => {
      if (!saved.current) for (const id of uploaded.current) discard(id);
    },
    [],
  );
  const update = (key, field, value) =>
    setStudents((previous) =>
      previous.map((s) => (s.key === key ? { ...s, [field]: value } : s)),
    );
  async function submit(e) {
    e.preventDefault();
    if (blocked) return;
    setError("");
    if (students.some((s) => !s.document_id)) {
      setError("แนบภาพบัตรประชาชนของนักเรียนทุกคนก่อนส่ง");
      return;
    }
    setBusy(true);
    try {
      await api(existing ? "/registrations/" + existing.id : "/registrations", {
        competition_id: competition.id,
        request_id: requestId.current,
        revision: existing?.revision,
        coaches,
        work_url: workUrl,
        variant,
        students: students.map(({ key, id, position, ...student }) => student),
      });
      saved.current = true;
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel registration-form">
      <button className="text-link" onClick={onCancel} disabled={blocked}>
        ← กลับรายการ
      </button>
      <h2>{existing ? "แก้ไขรายการสมัคร" : "ลงทะเบียนแข่งขัน"}</h2>
      <h3>{competition.title}</h3>
      <p>
        {competition.grade_label || "ตรวจระดับชั้นตามเกณฑ์รายการ"} · นักเรียน{" "}
        {studentCount(competition)}
      </p>
      <p className="muted">
        ผู้ฝึกซ้อม: {user.name} · {user.school}
      </p>
      {existing?.review_note && (
        <div className="notice">
          ข้อเสนอแนะจากผู้จัด: {existing.review_note}
        </div>
      )}
      <CompetitionRules competition={competition} />
      <form onSubmit={submit}>
        <fieldset disabled={blocked}>
          {policy.team_variants && (
            <label className="field">
              ชุดการแสดง
              <select
                required
                value={variant}
                onChange={(e) => {
                  const next = policy.team_variants.find(
                    (v) => v.key === e.target.value,
                  );
                  setVariant(next.key);
                  if (
                    students.every(
                      (s) => !s.first_name && !s.last_name && !s.document_id,
                    )
                  )
                    setStudents(
                      Array.from({ length: next.min_students }, blank),
                    );
                }}
              >
                {policy.team_variants.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.label}
                  </option>
                ))}
              </select>
              <small>
                ชุดที่เลือกต้องมีนักเรียน {minStudents}–{maxStudents} คน
                หากกรอกข้อมูลแล้ว ให้ปรับรายชื่อให้ครบตามชุด
              </small>
            </label>
          )}

          {students.map((student, i) => (
            <section className="student-card" key={student.key}>
              <div className="section-heading">
                <h3>นักเรียนคนที่ {i + 1}</h3>
                <button
                  className="secondary"
                  type="button"
                  disabled={students.length <= minStudents}
                  onClick={() => {
                    if (uploaded.current.has(student.document_id)) {
                      discard(student.document_id);
                      uploaded.current.delete(student.document_id);
                    }
                    setStudents(students.filter((s) => s.key !== student.key));
                  }}
                >
                  ลบนักเรียนคนที่ {i + 1}
                </button>
              </div>
              <div className="student-fields">
                <label className="field">
                  ชื่อ นักเรียนคนที่ {i + 1}
                  <input
                    value={student.first_name}
                    required
                    maxLength={100}
                    onChange={(e) =>
                      update(student.key, "first_name", e.target.value)
                    }
                  />
                </label>
                <label className="field">
                  นามสกุล นักเรียนคนที่ {i + 1}
                  <input
                    value={student.last_name}
                    required
                    maxLength={100}
                    onChange={(e) =>
                      update(student.key, "last_name", e.target.value)
                    }
                  />
                </label>
                <label className="field">
                  ชั้น นักเรียนคนที่ {i + 1}
                  {policy.allowed_grades ? (
                    <select
                      required
                      value={student.grade}
                      onChange={(e) =>
                        update(student.key, "grade", e.target.value)
                      }
                    >
                      <option value="">เลือกชั้น</option>
                      {policy.allowed_grades.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={student.grade}
                      required
                      maxLength={20}
                      placeholder="เช่น ป.4"
                      onChange={(e) =>
                        update(student.key, "grade", e.target.value)
                      }
                    />
                  )}
                </label>
                {(policy.gender || policy.mixed_gender_pair) && (
                  <label className="field">
                    ประเภทชาย/หญิง นักเรียนคนที่ {i + 1}
                    <select
                      required
                      value={student.gender || ""}
                      onChange={(e) =>
                        update(student.key, "gender", e.target.value)
                      }
                    >
                      <option value="">เลือกประเภท</option>
                      {(policy.gender ? [policy.gender] : ["ชาย", "หญิง"]).map(
                        (g) => (
                          <option key={g}>{g}</option>
                        ),
                      )}
                    </select>
                  </label>
                )}
                <label className="field">
                  โรงเรียน นักเรียนคนที่ {i + 1}
                  <input
                    value={student.school}
                    required
                    minLength={2}
                    maxLength={150}
                    onChange={(e) =>
                      update(student.key, "school", e.target.value)
                    }
                  />
                </label>
              </div>
              <StudentPhoto
                student={student}
                index={i}
                disabled={blocked}
                onUploading={(delta) =>
                  setUploading((n) => Math.max(0, n + delta))
                }
                onChange={(id) => {
                  uploaded.current.add(id);
                  if (uploaded.current.has(student.document_id)) {
                    discard(student.document_id);
                    uploaded.current.delete(student.document_id);
                  }
                  update(student.key, "document_id", id);
                }}
              />
            </section>
          ))}
          <div className="form-actions">
            <button
              className="secondary"
              type="button"
              disabled={maxStudents != null && students.length >= maxStudents}
              onClick={() => setStudents([...students, blank()])}
            >
              ＋ เพิ่มนักเรียน
            </button>
            <span className="muted">
              {students.length} คน
              {maxStudents != null
                ? " / " + maxStudents + " คน"
                : " (ต้นฉบับไม่ระบุสูงสุด)"}
            </span>
          </div>
          {competition.catalog_key && (
            <section className="student-card">
              <h3>ครูผู้ฝึกซ้อม / ที่ปรึกษา</h3>
              {coaches.map((c, i) => (
                <div className="coach-row" key={i}>
                  <label className="field">
                    ชื่อ–นามสกุลครูคนที่ {i + 1}
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={c.name}
                      onChange={(e) =>
                        setCoaches((previous) =>
                          previous.map((x, j) =>
                            j === i ? { name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    disabled={coaches.length <= (rules.coach_limits?.min || 1)}
                    onClick={() =>
                      setCoaches(coaches.filter((_, j) => j !== i))
                    }
                  >
                    ลบครูคนที่ {i + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="secondary"
                disabled={
                  Boolean(rules.coach_limits?.max) &&
                  coaches.length >= rules.coach_limits.max
                }
                onClick={() => setCoaches([...coaches, { name: "" }])}
              >
                ＋ เพิ่มครู
              </button>
            </section>
          )}
          {(policy.work_required || workUrl) && (
            <label className="field">
              ลิงก์ผลงาน HTTPS
              <input
                type="url"
                required={Boolean(policy.work_required)}
                maxLength={2000}
                value={workUrl}
                placeholder="https://…"
                onChange={(e) => setWorkUrl(e.target.value)}
              />
            </label>
          )}
          <div className="notice">
            ส่งข้อมูลแล้วจะมีสถานะ “รอตรวจเอกสาร” ผู้จัดหรือ superadmin
            จะตรวจสอบก่อนยืนยันการลงทะเบียน การแก้ไขข้อมูลจะส่งเข้าคิวตรวจใหม่
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button type="submit" className="primary">
            {busy
              ? "กำลังส่งรายการ…"
              : uploading
                ? "กำลังอัปโหลดภาพ…"
                : "ส่งให้ผู้จัดตรวจสอบ"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
function RegistrationCard({ row, review, user, onEdit, onReviewed }) {
  const [expanded, setExpanded] = useState(false),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selfReview = !user.is_superadmin && row.owner_id === user.id;
  async function decide(status) {
    if (busy) return;
    if (status === "changes_requested" && !note.trim()) {
      setError("ระบุข้อมูลที่ต้องแก้ไขก่อนส่งกลับ");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/admin/registrations/" + row.id + "/review", {
        revision: row.revision,
        status,
        note,
      });
      onReviewed();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel registration-card">
      <div className="section-heading">
        <div>
          <h3>{row.title}</h3>
          <p className="muted">
            ผู้ส่ง: {row.coach_name} · {row.coach_school} ·{" "}
            {row.students.length} คน
          </p>
        </div>
        <span className={"badge status-" + row.status}>
          {statuses[row.status]}
        </span>
      </div>
      <p className="muted">
        แข่งขัน: {date(row.starts_at)} · สถานที่: {row.venue || "รอประกาศ"} ·
        ฉบับที่ {row.revision}
      </p>
      {row.review_note && (
        <div className="notice">หมายเหตุจากผู้ตรวจ: {row.review_note}</div>
      )}
      {row.reviewer_name && (
        <p className="muted">ผู้ตรวจ: {row.reviewer_name}</p>
      )}
      <div className="form-actions">
        <button
          className="secondary"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? "ซ่อนรายละเอียด" : "ดูข้อมูลและเอกสาร"}
        </button>
        {!review &&
          row.status !== "approved" &&
          Boolean(row.registration_open) && (
            <button className="secondary" onClick={() => onEdit(row)}>
              แก้ไขรายการสมัคร
            </button>
          )}
      </div>
      {expanded && (
        <div className="registration-details">
          <CompetitionRules
            competition={{
              id: row.competition_id,
              rules: row.competition_rules,
            }}
          />
          {row.coaches?.length > 0 && (
            <p>ครูผู้ฝึกซ้อม: {row.coaches.map((c) => c.name).join(", ")}</p>
          )}
          {row.work_url && (
            <p>
              <a href={row.work_url} target="_blank" rel="noreferrer">
                เปิดลิงก์ผลงาน
              </a>
            </p>
          )}
          {row.students.map((s, i) => (
            <section className="student-card" key={s.id}>
              <h4>
                {i + 1}. {s.first_name} {s.last_name}
              </h4>
              <p>
                ชั้น {s.grade} · {s.school}
                {s.gender ? " · " + s.gender : ""}
              </p>
              <a
                className="identity-preview"
                href={"/api/registration-documents/" + s.document_id}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={"/api/registration-documents/" + s.document_id}
                  alt={"บัตรประชาชนของ " + s.first_name + " " + s.last_name}
                  loading="lazy"
                />
                <span>เปิดภาพเต็มเพื่อตรวจเอกสาร</span>
              </a>
            </section>
          ))}
          {review &&
            row.status === "pending" &&
            (selfReview ? (
              <p className="notice">
                เป็นรายการที่คุณส่งเอง กรุณาให้ผู้จัดคนอื่นหรือ superadmin
                ตรวจสอบ
              </p>
            ) : (
              <div className="review-controls">
                <label className="field">
                  หมายเหตุ / ข้อมูลที่ต้องแก้ไข
                  <textarea
                    maxLength={1000}
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={busy}
                  />
                </label>
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                <div className="form-actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => decide("approved")}
                  >
                    ยืนยันการลงทะเบียน
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => decide("changes_requested")}
                  >
                    ส่งกลับให้แก้ไข
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </article>
  );
}
function ManageCompetitions({ competitions, onChanged }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function create(e) {
    e.preventDefault();
    const form = e.currentTarget,
      b = Object.fromEntries(new FormData(form));
    b.min_students = Number(b.min_students);
    b.max_students = Number(b.max_students);
    b.starts_at = b.starts_at
      ? new Date(b.starts_at + ":00+07:00").toISOString()
      : "";
    setBusy(true);
    setError("");
    try {
      await api("/admin/competitions", b);
      form.reset();
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>เพิ่มรายการแข่งขัน</h2>
        <form onSubmit={create}>
          <fieldset disabled={busy}>
            <div className="student-fields">
              <label className="field">
                ชื่อรายการแข่งขัน
                <input name="title" required minLength={2} maxLength={200} />
              </label>
              <label className="field">
                ระดับชั้นที่รับสมัคร
                <input
                  name="grade_label"
                  maxLength={100}
                  placeholder="เช่น ป.4–6 ตามระเบียบรายการ"
                />
              </label>
              <label className="field">
                จำนวนนักเรียนขั้นต่ำ
                <input
                  name="min_students"
                  type="number"
                  min={1}
                  max={1000}
                  defaultValue={1}
                  required
                />
              </label>
              <label className="field">
                จำนวนนักเรียนสูงสุด
                <input
                  name="max_students"
                  type="number"
                  min={1}
                  max={1000}
                  defaultValue={1}
                  required
                />
              </label>
              <label className="field">
                วันเวลาแข่งขัน (เวลาไทย ถ้าทราบ)
                <input name="starts_at" type="datetime-local" />
              </label>
              <label className="field">
                สถานที่แข่งขัน
                <input name="venue" maxLength={200} />
              </label>
            </div>
            <label className="field">
              รายละเอียด / เกณฑ์การแข่งขัน
              <textarea name="description" rows={3} maxLength={3000} />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" type="submit">
              {busy ? "กำลังเพิ่มรายการ…" : "เพิ่มรายการและเปิดรับสมัคร"}
            </button>
          </fieldset>
        </form>
      </section>
      <div className="competition-list">
        {competitions.map((c) => (
          <article className="panel" key={c.id}>
            <h3>{c.title}</h3>
            <p>
              {c.grade_label} ·{" "}
              {c.registration_open ? "เปิดรับสมัคร" : "ปิดรับสมัคร"}
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api("/admin/competitions/" + c.id, {
                    registration_open: !c.registration_open,
                  });
                  onChanged();
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {c.registration_open ? "ปิดรับสมัคร" : "เปิดรับสมัคร"}
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
export default function CompetitionRegistration({ user, tab, onTab }) {
  const coach = user.is_superadmin || user.roles.includes("coach"),
    reviewer = user.is_superadmin || user.is_organizer;
  const setTab = onTab;
  const [competitions, setCompetitions] = useState([]),
    [rows, setRows] = useState([]),
    [hasMore, setHasMore] = useState(false),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState("pending"),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [form, setForm] = useState(null);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [division, setDivision] = useState(""),
    [gradeFilter, setGradeFilter] = useState(""),
    [catalogPage, setCatalogPage] = useState(1);
  const filtered = competitions.filter(
    (c) =>
      (!search ||
        (c.title + " " + c.category + " " + (c.rules?.policy?.disability || ""))
          .toLowerCase()
          .includes(search.trim().toLowerCase())) &&
      (!category || c.category === category) &&
      (!division || (c.rules?.policy?.division || "general") === division) &&
      (!gradeFilter ||
        !c.rules?.policy?.allowed_grades ||
        c.rules.policy.allowed_grades.includes(gradeFilter)),
  );
  const refresh = () => setVersion((n) => n + 1);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const list =
      tab === "mine"
        ? "/registrations?page=" + page
        : tab === "review"
          ? "/admin/registrations?page=" + page + "&status=" + filter
          : null;
    Promise.all([
      api("/competitions"),
      list ? api(list) : Promise.resolve({ registrations: [], hasMore: false }),
    ])
      .then(([c, r]) => {
        if (active) {
          setCompetitions(c.competitions);
          setRows(r.registrations);
          setHasMore(r.hasMore);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.id, tab, page, filter, version]);
  const keepSuccess = useRef(false);
  useEffect(() => {
    setPage(1);
    setForm(null);
    if (keepSuccess.current) keepSuccess.current = false;
    else setSuccess("");
  }, [tab]);
  return (
    <section className="competition-workspace" aria-label="ลงทะเบียนแข่งขัน">
      {!form && (
        <div className="workspace-refresh">
          <button className="secondary" disabled={loading} onClick={refresh}>
            อัปเดตข้อมูล
          </button>
        </div>
      )}
      {success && (
        <p className="success-message" role="status">
          {success}
        </p>
      )}
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          <button className="text-link" onClick={refresh}>
            ลองใหม่
          </button>
        </div>
      )}
      {tab === "judging" ? (
        <JudgePanel key={version} />
      ) : tab === "results" ? (
        <ResultsPanel key={version} reviewer={reviewer} />
      ) : tab === "certificates" ? (
        <CertificatesPanel key={version} user={user} />
      ) : tab === "judges" ? (
        loading ? (
          <p role="status">กำลังโหลด…</p>
        ) : (
          <JudgeAssignment competitions={competitions} />
        )
      ) : form ? (
        <RegistrationForm
          key={form.existing?.id || form.competition.id}
          user={user}
          competition={form.competition}
          existing={form.existing}
          onCancel={() => setForm(null)}
          onDone={() => {
            setForm(null);
            setTab("mine");
            setPage(1);
            refresh();
            keepSuccess.current = true;
            setSuccess("ส่งรายการแล้ว รอผู้จัดตรวจเอกสารและยืนยันการลงทะเบียน");
          }}
        />
      ) : loading ? (
        <p role="status">กำลังโหลดรายการแข่งขัน…</p>
      ) : tab === "competitions" ? (
        <>
          <div className="section-heading">
            <h2>รายการแข่งขันศิลปหัตถกรรม</h2>
          </div>
          <div className="catalog-filters">
            <label className="field">
              ค้นหารายการแข่งขัน
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCatalogPage(1);
                }}
                placeholder="ชื่อรายการ / ประเภทความพิการ"
              />
            </label>
            <label className="field">
              หมวดกิจกรรม
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setCatalogPage(1);
                }}
              >
                <option value="">ทุกหมวด</option>
                {[
                  ...new Set(
                    competitions.map((c) => c.category).filter(Boolean),
                  ),
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              ประเภท
              <select
                value={division}
                onChange={(e) => {
                  setDivision(e.target.value);
                  setCatalogPage(1);
                }}
              >
                <option value="">ทั้งหมด</option>
                <option value="general">ทั่วไป</option>
                <option value="inclusive">เรียนรวม</option>
              </select>
            </label>
            <label className="field">
              ชั้นเรียน
              <select
                value={gradeFilter}
                onChange={(e) => {
                  setGradeFilter(e.target.value);
                  setCatalogPage(1);
                }}
              >
                <option value="">ทุกชั้น</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n}>{"ป." + n}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            พบ {filtered.length} รายการ · แสดงครั้งละ 24 รายการ ·
            เกณฑ์จากเอกสารปีการศึกษา 2568
          </p>
          {!competitions.length ? (
            <section className="panel">
              <h3>ยังไม่มีรายการแข่งขัน</h3>
              <p>
                {user.is_superadmin
                  ? "เพิ่มรายการในเมนูจัดการรายการแข่งขันเพื่อเปิดให้ครูลงทะเบียน"
                  : "ผู้จัดจะแจ้งรายการแข่งขันเมื่อเปิดรับสมัคร"}
              </p>
            </section>
          ) : (
            <div className="competition-list">
              {filtered
                .slice((catalogPage - 1) * 24, catalogPage * 24)
                .map((c) => (
                  <article className="panel" key={c.id}>
                    <span
                      className={
                        "badge " +
                        (c.registration_open ? "status-approved" : "")
                      }
                    >
                      {c.registration_open ? "เปิดรับสมัคร" : "ปิดรับสมัคร"}
                    </span>
                    <h3>{c.title}</h3>
                    <p>
                      {c.grade_label || "ดูเกณฑ์รายการ"} · นักเรียน{" "}
                      {studentCount(c)}
                    </p>
                    {c.category && (
                      <span className="badge">
                        {c.category}
                        {c.rules?.policy?.division === "inclusive"
                          ? " · เรียนรวม"
                          : ""}
                      </span>
                    )}
                    <CompetitionRules competition={c} />
                    <p className="preserve-lines">
                      {c.description ||
                        "ผู้จัดยังไม่ได้ระบุรายละเอียดเพิ่มเติม"}
                    </p>
                    <p className="muted">
                      แข่งขัน: {date(c.starts_at)}
                      <br />
                      สถานที่: {c.venue || "รอประกาศ"}
                    </p>
                    {coach ? (
                      <button
                        className="primary"
                        disabled={!c.registration_open}
                        onClick={() => {
                          setSuccess("");
                          setForm({ competition: c });
                        }}
                      >
                        ลงทะเบียนนักเรียน
                      </button>
                    ) : (
                      <p className="muted">
                        ผู้ฝึกซ้อมเป็นผู้ลงทะเบียนให้นักเรียน
                      </p>
                    )}
                  </article>
                ))}
            </div>
          )}
          {!loading && filtered.length > 24 && (
            <div className="form-actions">
              <button
                className="secondary"
                disabled={catalogPage === 1}
                onClick={() => setCatalogPage((n) => n - 1)}
              >
                รายการก่อนหน้า
              </button>
              <span>
                หน้า {catalogPage} / {Math.ceil(filtered.length / 24)}
              </span>
              <button
                className="secondary"
                disabled={catalogPage * 24 >= filtered.length}
                onClick={() => setCatalogPage((n) => n + 1)}
              >
                รายการถัดไป
              </button>
            </div>
          )}
          {competitions.length > 0 && filtered.length === 0 && (
            <p>ไม่พบรายการตามตัวกรองที่เลือก</p>
          )}
        </>
      ) : tab === "manage" ? (
        <ManageCompetitions competitions={competitions} onChanged={refresh} />
      ) : (
        <>
          <div className="section-heading">
            <h2>
              {tab === "review"
                ? "ตรวจเอกสารและยืนยันการลงทะเบียน"
                : "รายการสมัครของฉัน"}
            </h2>
            {tab === "review" && (
              <label className="filter-label">
                สถานะ
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="pending">รอตรวจเอกสาร</option>
                  <option value="approved">ยืนยันแล้ว</option>
                  <option value="changes_requested">ขอให้แก้ไข</option>
                  <option value="">ทั้งหมด</option>
                </select>
              </label>
            )}
          </div>
          {!rows.length ? (
            <section className="panel">
              <p>
                {tab === "review"
                  ? "ไม่มีรายการในสถานะที่เลือก"
                  : "ยังไม่มีรายการสมัคร เลือกรายการแข่งขันเพื่อเริ่มลงทะเบียน"}
              </p>
            </section>
          ) : (
            rows.map((row) => (
              <RegistrationCard
                key={row.id + ":" + row.revision + ":" + row.status}
                row={row}
                review={tab === "review"}
                user={user}
                onReviewed={() => {
                  setSuccess("บันทึกผลตรวจแล้ว");
                  refresh();
                }}
                onEdit={(existing) => {
                  const competition = competitions.find(
                    (c) => c.id === existing.competition_id,
                  );
                  if (competition) setForm({ competition, existing });
                }}
              />
            ))
          )}
          <div className="form-actions">
            <button
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage((n) => n - 1)}
            >
              ก่อนหน้า
            </button>
            <span>หน้า {page}</span>
            <button
              className="secondary"
              disabled={!hasMore}
              onClick={() => setPage((n) => n + 1)}
            >
              ถัดไป
            </button>
          </div>
        </>
      )}
    </section>
  );
}
