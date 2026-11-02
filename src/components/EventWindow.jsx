import { useEffect, useState } from "react";
import { api } from "../api";
// The form always displays Bangkok time regardless of the browser timezone.
const input = (t) =>
  t ? new Date((t + 7 * 3600) * 1000).toISOString().slice(0, 16) : "";
const timestamp = (value) =>
  Math.floor(
    new Date(
      (value.length === 16 ? value + ":00" : value) + "+07:00",
    ).getTime() / 1000,
  );
export default function EventWindow() {
  const [window, setWindow] = useState(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/window")
      .then((r) =>
        setWindow(
          Object.fromEntries(
            ["opens_at", "closes_at", "edits_until"].map((k) => [
              k,
              input(r.window[k]),
            ]),
          ),
        ),
      )
      .catch((e) => setMessage(e.message));
  }, []);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(
        "/admin/window",
        Object.fromEntries(
          Object.entries(window).map(([k, v]) => [k, timestamp(v)]),
        ),
      );
      setMessage("บันทึกกำหนดเวลาแล้ว");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="score-panel">
      <h2>กำหนดเวลาลงทะเบียนทั้งงาน</h2>
      <p>
        ใช้เวลาไทย (UTC+7) ปิดรับทีมใหม่เมื่อถึงเวลาปิดสมัคร
        ทีมเดิมแก้ไขได้ถึงเวลาปิดแก้ไข และต้องให้แอดมินตรวจใหม่
        กรรมการเริ่มให้คะแนนได้หลังปิดแก้ไข
      </p>
      {message && <p role="status">{message}</p>}
      {window && (
        <form onSubmit={save}>
          {[
            ["opens_at", "เปิดรับสมัคร"],
            ["closes_at", "ปิดรับสมัคร"],
            ["edits_until", "ปิดแก้ไขข้อมูล"],
          ].map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                required
                type="datetime-local"
                aria-label={label + " (เวลาไทย)"}
                value={window[k]}
                onChange={(e) => {const value=e.target.value;setWindow(previous=>({...previous,[k]:value}));}}
              />
            </label>
          ))}
          <button className="btn primary" disabled={busy}>
            บันทึกกำหนดเวลา
          </button>
        </form>
      )}
    </section>
  );
}
