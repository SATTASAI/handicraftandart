import { useEffect, useState } from "react";
import { api } from "../api";
export default function TeacherHome({
  user,
  registrations,
  competitions,
  loading,
  error,
  navigate,
}) {
  const [jobs, setJobs] = useState([]),
    [jobError, setJobError] = useState("");
  useEffect(() => {
    let active = true;
    api("/judge/competitions")
      .then((r) => {
        if (active) setJobs(r.competitions);
      })
      .catch((e) => {
        if (active) setJobError(e.message);
      });
    return () => {
      active = false;
    };
  }, [user.id]);
  const teams = registrations.filter((r) => r.status === "submitted");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="badge blue">{user.school}</span>
          <h1>สวัสดี คุณครู{user.name}</h1>
          <p>ลงทะเบียนทีมให้พร้อม แล้วพบกันวันแข่งขัน</p>
        </div>
        <button
          className="btn primary"
          onClick={() => navigate("/competitions")}
        >
          ลงทะเบียนทีมใหม่
        </button>
      </div>
      <div className="teacher-steps" aria-label="ขั้นตอนเข้าร่วม">
        <span>1 เลือกการแข่งขัน</span>
        <span>2 กรอกนักเรียนและครู</span>
        <span>3 รอวันแข่งขัน</span>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">กำลังโหลดรายการ…</p>
      ) : (
        <section className="score-panel">
          <div className="section-title">
            <h2>ทีมของฉัน · {teams.length} ทีม</h2>
            <button
              className="text-button"
              onClick={() => navigate("/registrations")}
            >
              ดูทั้งหมด / แก้ไขรายชื่อ
            </button>
          </div>
          {!teams.length && (
            <p>
              ยังไม่มีทีม เลือกรายการแข่งขันแล้วกรอกรายชื่อได้เลย
              ไม่ต้องรอผู้จัดอนุมัติ
            </p>
          )}
          {teams.map((r) => {
            const c = competitions.find((c) => c.id === r.competition_id);
            return (
              <article className="teacher-team" key={r.id}>
                <div>
                  <h3>
                    {r.title} {r.grade}
                  </h3>
                  <p>{r.students.map((s) => s.name).join(" · ")}</p>
                  <span className="badge green">
                    {r.published ? "ประกาศผลแล้ว" : "ลงทะเบียนแล้ว · รอแข่งขัน"}
                  </span>
                  <p>
                    วันเวลา: {c?.schedule || "รอผู้จัดประกาศ"}
                    <br />
                    สถานที่: {c?.venue || "รอผู้จัดประกาศ"}
                  </p>
                </div>
                <button
                  className="btn"
                  onClick={() =>
                    navigate(
                      r.published
                        ? "/results"
                        : "/competitions/" + r.competition_id,
                    )
                  }
                >
                  {r.published ? "ดูผลการแข่งขัน" : "ดูรายละเอียด"}
                </button>
              </article>
            );
          })}
        </section>
      )}
      <section className="score-panel">
        <h2>งานกรรมการของฉัน · {jobs.length} รายการ</h2>
        <p>
          เป็นผู้ฝึกซ้อมและกรรมการได้ในบัญชีเดียว
          ผู้จัดจะมอบหมายเฉพาะรายการที่ไม่มีโรงเรียนของคุณเข้าแข่งขัน
        </p>
        {jobError && <p role="alert">{jobError}</p>}
        {!jobs.length && !jobError && (
          <p>ยังไม่มีงานที่ได้รับมอบหมาย คุณยังลงทะเบียนทีมได้ตามปกติ</p>
        )}
        {jobs.map((c) => (
          <article className="teacher-team" key={c.id}>
            <div>
              <h3>
                {c.title} {c.grade}
              </h3>
              <p>
                {c.schedule} · {c.venue}
              </p>
            </div>
            <button
              className="btn"
              onClick={() =>
                navigate("/judge?competition=" + encodeURIComponent(c.id))
              }
            >
              เปิดงานกรรมการ
            </button>
          </article>
        ))}
      </section>
    </>
  );
}
