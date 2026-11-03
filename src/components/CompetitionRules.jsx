import React, { useState } from "react";
import { api } from "../api";
export const studentCount = (c) =>
  c.rules?.policy?.team_variants
    ? c.rules.policy.team_variants
        .map(
          (v) =>
            v.label +
            " " +
            v.min_students +
            (v.max_students !== v.min_students ? "–" + v.max_students : "") +
            " คน",
        )
        .join(" / ")
    : c.max_students == null
      ? `อย่างน้อย ${c.min_students} คน (ต้นฉบับไม่ระบุสูงสุด)`
      : c.min_students === c.max_students
        ? `${c.min_students} คน`
        : `${c.min_students}–${c.max_students} คน`;
export default function CompetitionRules({ competition }) {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function load() {
    if (data || loading) return;
    setLoading(true);
    setError("");
    try {
      setData((await api("/competitions/" + competition.id)).competition);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  const c = data || competition,
    rules = c.rules || {},
    policy = rules.policy || {};
  return (
    <details
      className="competition-rules"
      onToggle={(e) => {
        if (e.currentTarget.open) load();
      }}
    >
      <summary>เกณฑ์การตัดสินและเอกสารต้นฉบับ</summary>
      {loading && <p role="status">กำลังโหลดเกณฑ์…</p>}
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <button type="button" className="text-link" onClick={load}>
            ลองใหม่
          </button>
        </p>
      )}
      {rules.source_year && (
        <p className="muted">
          เอกสารครั้งที่ {rules.edition} ปีการศึกษา {rules.source_year} ·{" "}
          {policy.division === "inclusive" ? "เรียนรวม" : "ทั่วไป"}
        </p>
      )}
      <p>จำนวนนักเรียน: {studentCount(c)}</p>
      {policy.allowed_grades && (
        <p>รับระดับชั้น: {policy.allowed_grades.join(", ")}</p>
      )}
      {policy.disability && <p>ประเภทตามเอกสาร: {policy.disability}</p>}
      {policy.gender && <p>ประเภทผู้แข่งขัน: {policy.gender}</p>}
      {policy.mixed_gender_pair && <p>ต้องเป็นคู่ชาย 1 คน / หญิง 1 คน</p>}
      {rules.coach_limits?.max && (
        <p>
          ครูผู้ฝึกซ้อม
          {rules.coach_limits.min === rules.coach_limits.max
            ? ` ${rules.coach_limits.max} คน`
            : ` ไม่เกิน ${rules.coach_limits.max} คน`}
        </p>
      )}
      {(rules.notes || []).map((note, i) => (
        <p className="notice" key={i}>
          {note}
        </p>
      ))}
      {rules.score_rules?.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>เกณฑ์การให้คะแนน</th>
                <th>คะแนนเต็ม</th>
              </tr>
            </thead>
            <tbody>
              {rules.score_rules.map((score, i) => (
                <tr key={i}>
                  <td>{score.label}</td>
                  <td>{score.max}</td>
                </tr>
              ))}
              <tr>
                <th>รวม</th>
                <th>{rules.score_total}</th>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        data && <p className="muted">ยังไม่มีตารางคะแนนย่อยสำหรับรายการนี้</p>
      )}
      {c.source_url && (
        <p>
          <a
            href={c.source_url + "#page=" + c.source_page}
            target="_blank"
            rel="noreferrer"
          >
            เปิด PDF ต้นฉบับ: {c.source_name} หน้า {c.source_page}–
            {c.source_end_page}
          </a>
        </p>
      )}
      {c.rules_text && (
        <details>
          <summary>วิธีแข่งขัน ข้อหักคะแนน และการตัดสินจากต้นฉบับ</summary>
          <p className="muted">
            PDF บางหัวข้อรวมหลายระดับ ให้ใช้เฉพาะช่วงชั้นของรายการที่สมัคร
          </p>
          <pre className="rules-text">{c.rules_text}</pre>
        </details>
      )}
      {c.general_rules_text && (
        <details>
          <summary>หลักฐานคุณสมบัติเรียนรวมที่ผู้จัดต้องตรวจ</summary>
          <pre className="rules-text">{c.general_rules_text}</pre>
        </details>
      )}
    </details>
  );
}
