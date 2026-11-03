import { useState } from "react";
import { api } from "../api";

function People({
  title,
  people,
  setPeople,
  min,
  max,
  student,
  policy,
  grade,
}) {
  const update = (i, key, value) =>
    setPeople(people.map((p, j) => (i === j ? { ...p, [key]: value } : p)));
  const grades =
    policy.allowed_grades ||
    (grade === "ป.4–6"
      ? ["ป.4", "ป.5", "ป.6"]
      : ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"]);
  return (
    <section>
      <div className="section-title">
        <h2>
          {title} · {people.length} คน
        </h2>
        <button
          className="btn"
          type="button"
          disabled={people.length >= max}
          onClick={() => setPeople([...people, { name: "", grade: "" }])}
        >
          เพิ่ม{student ? "นักเรียน" : "ครู"}
        </button>
      </div>
      <p className="helper">
        จำนวน {min}–{max} คน ตามเกณฑ์รายการ
      </p>
      {people.map((p, i) => (
        <div className="team-person" key={i}>
          <label className="field">
            ชื่อ–นามสกุล{student ? "นักเรียน" : "ครู"} {i + 1}
            <input
              required
              minLength={2}
              maxLength={100}
              value={p.name}
              onChange={(e) => update(i, "name", e.target.value)}
            />
          </label>
          {student &&
            (policy.age_min ? (
              <label className="field">
                อายุ (ปี)
                <input
                  type="number"
                  required
                  min={policy.age_min}
                  max={policy.age_max}
                  value={p.age ?? ""}
                  onChange={(e) => update(i, "age", Number(e.target.value))}
                />
              </label>
            ) : (
              <label className="field">
                ระดับชั้น
                <select
                  required
                  value={p.grade || ""}
                  onChange={(e) => update(i, "grade", e.target.value)}
                >
                  <option value="">เลือกชั้น</option>
                  {grades.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
            ))}
          {student && (policy.gender || policy.mixed_gender_pair) && (
            <label className="field">
              ประเภทชาย/หญิง
              <select
                required
                value={p.gender || ""}
                onChange={(e) => update(i, "gender", e.target.value)}
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
          <button
            className="btn"
            type="button"
            aria-label={`ลบ${student ? "นักเรียน" : "ครู"} ${i + 1}`}
            disabled={people.length <= min}
            onClick={() => setPeople(people.filter((_, j) => i !== j))}
          >
            ลบ
          </button>
        </div>
      ))}
    </section>
  );
}

export default function TeamRegistration({ c, user, existing, onSaved }) {
  const policy = c.policy || {};
  const [students, setStudents] = useState(
    existing?.students ||
      Array.from({ length: c.min_students || 1 }, () => ({
        name: "",
        grade: "",
      })),
  );
  const [coaches, setCoaches] = useState(
    existing?.coaches ||
      Array.from({ length: policy.min_coaches || 1 }, (_, i) => ({
        name: i === 0 ? user.name : "",
      })),
  );
  const [work, setWork] = useState(existing?.work_url || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const navigate = (path) => {
    history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  async function save(status) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api("/registrations", {
        competition_id: c.id,
        students,
        coaches,
        work_url: work,
        status,
      });
      onSaved(r.message);
      navigate("/registrations");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="text-button back"
        onClick={() => navigate("/competitions/" + c.id)}
      >
        ← กลับรายละเอียดการแข่งขัน
      </button>
      <h1>
        {existing?.status === "submitted"
          ? "แก้ไขรายชื่อทีม"
          : "ลงทะเบียนแข่งขัน"}
      </h1>
      <p className="muted">
        {c.title} · {c.grade} · {user.school}
      </p>
      <div className="registration-layout">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save("submitted");
          }}
        >
          <div className="selected-competition">
            <div>
              <h2>{c.title}</h2>
              <p>
                วันเวลา: {c.schedule || "รอประกาศ"}
                <br />
                สถานที่: {c.venue || "รอประกาศ"}
              </p>
            </div>
          </div>
          <label className="field">
            โรงเรียน
            <input readOnly value={user.school} />
          </label>
          {error && (
            <p className="message error" role="alert">
              {error}
            </p>
          )}
          <fieldset disabled={busy} className="team-fields">
            <People
              title="นักเรียน"
              student
              people={students}
              setPeople={setStudents}
              min={c.min_students || 1}
              max={c.max_students}
              policy={policy}
              grade={c.grade}
            />
            <People
              title="ครูผู้ฝึกซ้อม"
              people={coaches}
              setPeople={setCoaches}
              min={policy.min_coaches || 1}
              max={c.max_coaches}
              policy={policy}
            />
            <label className="field">
              ลิงก์ผลงาน ({policy.work_required ? "จำเป็น" : "ถ้ามี"})
              <input
                type="url"
                required={!!policy.work_required}
                maxLength={1000}
                placeholder="https://…"
                value={work}
                onChange={(e) => setWork(e.target.value)}
              />
            </label>
            <p className="helper">
              ตรวจการสะกดชื่อก่อนส่ง ข้อมูลนี้ใช้ในผลการแข่งขันและประกาศนียบัตร
            </p>
            <div className="form-actions">
              {existing?.status !== "submitted" && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => save("draft")}
                >
                  เก็บเป็นฉบับร่าง
                </button>
              )}
              <button className="btn primary" type="submit">
                {busy
                  ? "กำลังบันทึก…"
                  : existing?.status === "submitted"
                    ? "บันทึกการแก้ไข"
                    : "ลงทะเบียนแข่งขัน"}
              </button>
            </div>
          </fieldset>
        </form>
        <aside className="helper-panel">
          <h3>ลงทะเบียนแล้ว รอแข่งขันได้เลย</h3>
          <p>
            ไม่ต้องอัปโหลดบัตร ไม่ต้องรอผู้จัดอนุมัติ
            แก้ไขรายชื่อได้ในช่วงที่เปิดให้แก้ไข
          </p>
          <hr />
          <h3>เป็นกรรมการด้วยได้</h3>
          <p>
            ใช้บัญชีนี้รับงานที่ผู้จัดมอบหมายได้
            แต่ห้ามตัดสินรายการที่มีโรงเรียนตัวเองเข้าแข่งขัน
          </p>
        </aside>
      </div>
    </>
  );
}
