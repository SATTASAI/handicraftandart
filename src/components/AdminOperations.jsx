import { useState } from "react";
import { api } from "../api";

const mailStatus = {
  sent: "ส่งให้บริการอีเมลแล้ว",
  sending: "กำลังส่ง",
  failed: "ส่งไม่สำเร็จ",
  pending: "รอส่ง",
};
function exportRegistrations(rows) {
  const cell = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const data = [
    [
      "รหัสสมัคร",
      "รายการ",
      "โรงเรียน",
      "สถานะ",
      "นักเรียน",
      "ครูผู้ฝึกซ้อม",
      "ผู้ติดต่อ",
      "อีเมล",
    ],
    ...rows.map((r) => [
      r.id,
      r.title,
      r.school,
      r.status,
      r.students
        .map((s) => `${s.name} (${s.age ? "อายุ " + s.age + " ปี" : s.grade})`)
        .join(" / "),
      r.coaches.map((s) => s.name).join(" / "),
      r.contact_name,
      r.email,
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + data.map((row) => row.map(cell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "registrations-2569.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function AdminOperations({ data, refresh, notify }) {
  const [competition, setCompetition] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!data) return <p role="status">กำลังโหลดข้อมูลการจัดงาน…</p>;
  const rows = data.registrations.filter(
    (r) => !competition || r.competition_id === competition,
  );
  async function send(row) {
    if (!confirm(`ส่งลิงก์ประกาศนียบัตรรายการ ${row.title} ให้ ${row.email}?`))
      return;
    setBusy(true);
    setError("");
    try {
      const response = await api("/admin/certificate-email", {
        registration_id: row.id,
      });
      notify(response.message);
    } catch (e) {
      setError(e.message);
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  async function decision(row, value) {
    const note =
      value === "disqualified"
        ? prompt("ระบุเหตุผลและข้อเกณฑ์ที่ใช้ตัดสิทธิ์")
        : "ผู้จัดตรวจเอกสาร คุณสมบัติ และคุณวุฒิกรรมการตามเกณฑ์แล้ว";
    if (
      !note ||
      !confirm(
        `ยืนยันผลตรวจคุณสมบัติ ${row.school}: ${value === "eligible" ? "ผ่าน" : "ตัดสิทธิ์"}?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api("/admin/decision", {
        registration_id: row.id,
        decision: value,
        note,
      });
      notify("บันทึกผลตรวจแล้ว");
    } catch (e) {
      setError(e.message);
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  return (
    <>
      <h2>ความพร้อมของระบบ</h2>
      <p className="helper">
        {data.readiness.demo
          ? "โหมดตัวอย่าง: ต้องยืนยันวัน สถานที่ และเกณฑ์จริงก่อนปิดโหมดตัวอย่าง"
          : "โหมดใช้งานจริง"}
      </p>
      <p>
        ระบบบัญชี: {data.readiness.auth ? "ตั้งค่าแล้ว" : "ยังไม่ตั้งค่า"} ·
        อีเมล:{" "}
        {data.readiness.email
          ? "ตั้งค่าแล้ว (ต้องทดสอบรับจริง)"
          : "ยังไม่ตั้งค่า Resend / โดเมนส่งอีเมล"}
      </p>
      <h2>ความคืบหน้าการตัดสิน</h2>
      <p className="helper">
        แสดงรายการที่มีทีมยืนยันแล้ว
        นับเฉพาะกรรมการที่ไม่มีส่วนได้เสียกับแต่ละทีม
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>รายการ</th>
              <th>ทีมยืนยัน</th>
              <th>กรรมการ</th>
              <th>คะแนนที่บันทึก / ต้องมี</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {data.competitions
              .filter((c) => c.teams > 0)
              .map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td>
                  <td>{c.teams}</td>
                  <td>{c.judges}</td>
                  <td>
                    {c.scored} / {c.required}
                  </td>
                  <td>
                    {c.published
                      ? "ประกาศผลแล้ว"
                      : c.ready
                        ? "พร้อมประกาศผล"
                        : `รอตรวจคุณสมบัติ ${c.unreviewed} ทีม / กรรมการไม่ครบเกณฑ์ ${c.invalid_judges} ทีม / คะแนนที่ขาด ${Math.max(0, c.required - c.scored)}`}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <h2>ผู้สมัครและการส่งประกาศนียบัตร</h2>
      <p className="muted">
        ส่งลิงก์ให้บัญชีผู้ลงทะเบียนดาวน์โหลด PDF นักเรียนและครู
        การส่งสำเร็จหมายถึงผู้ให้บริการรับอีเมลแล้ว โปรดตรวจสถานะการส่งถึงใน
        Resend
      </p>
      <div className="form-actions operations-toolbar">
        <label>
          กรองรายการ{" "}
          <select
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
          >
            <option value="">ทุกรายการ</option>
            {data.competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn"
          disabled={!rows.length}
          onClick={() => exportRegistrations(rows)}
        >
          ส่งออกรายชื่อ CSV
        </button>
        <button className="btn" disabled={busy} onClick={() => refresh()}>
          รีเฟรชสถานะ
        </button>
      </div>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {!rows.length ? (
        <p>ยังไม่มีรายการลงทะเบียน</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>รายการ / โรงเรียน</th>
                <th>รายชื่อ</th>
                <th>ผู้ติดต่อ</th>
                <th>สถานะ</th>
                <th>ประกาศนียบัตร</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.title}
                    <br />
                    {r.school}
                  </td>
                  <td>
                    นักเรียน:{" "}
                    {r.students
                      .map(
                        (s) =>
                          `${s.name} ${s.age ? "อายุ " + s.age + " ปี" : s.grade}`,
                      )
                      .join(", ") || "—"}
                    <br />
                    ครู: {r.coaches.map((s) => s.name).join(", ") || "—"}
                  </td>
                  <td>
                    {r.contact_name}
                    <br />
                    {r.email}
                  </td>
                  <td>
                    {r.status === "submitted"
                      ? r.eligibility_reviewed
                        ? r.decision === "disqualified"
                          ? "ตัดสิทธิ์"
                          : "ตรวจคุณสมบัติแล้ว"
                        : "รอผู้จัดตรวจคุณสมบัติ"
                      : "ฉบับร่าง"}
                    {r.decision_note && <p>{r.decision_note}</p>}
                    {r.status === "submitted" && !r.published && (
                      <div className="row-actions">
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => decision(r, "eligible")}
                        >
                          ยืนยันคุณสมบัติผ่าน
                        </button>
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => decision(r, "disqualified")}
                        >
                          ตัดสิทธิ์ตามเกณฑ์
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    {mailStatus[r.email_status] || "ยังไม่ส่ง"}
                    {r.sent_at && (
                      <small>
                        <br />
                        {new Date(r.sent_at * 1000).toLocaleString("th-TH", {
                          timeZone: "Asia/Bangkok",
                        })}
                      </small>
                    )}
                    {r.last_error && <p role="status">{r.last_error}</p>}
                    <br />
                    <button
                      className="btn"
                      disabled={
                        busy ||
                        !r.published ||
                        r.decision === "disqualified" ||
                        r.status !== "submitted" ||
                        r.email_status === "sent" ||
                        !data.readiness.email
                      }
                      onClick={() => send(r)}
                    >
                      {r.email_status === "failed" ||
                      r.email_status === "sending"
                        ? "ตรวจและลองส่งอีกครั้ง"
                        : "ส่งลิงก์ทางอีเมล"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
