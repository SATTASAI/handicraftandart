import { useEffect, useState } from "react";
import { api } from "../api";
export default function JudgeHome({ navigate }) {
  const [competitions, setCompetitions] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("/judge/competitions")
      .then((r) => setCompetitions(r.competitions))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <h1>รายการที่ได้รับมอบหมายให้ตัดสิน</h1>
      <p>แสดงเฉพาะรายการที่ไม่มีโรงเรียนของท่านเข้าแข่งขัน</p>
      {error && <p role="alert">{error}</p>}
      {!competitions.length && <p>ยังไม่มีรายการที่แอดมินมอบหมาย</p>}
      <div className="competition-grid">
        {competitions.map((c) => (
          <button
            className="competition-card"
            key={c.id}
            onClick={() =>
              navigate("/judge?competition=" + encodeURIComponent(c.id))
            }
          >
            <div className="card-body">
              <h2>{c.title}</h2>
              <p>{c.grade}</p>
              <p>{c.published ? "สรุปผลแล้ว" : "เปิดหน้าลงคะแนนตามเกณฑ์"}</p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
