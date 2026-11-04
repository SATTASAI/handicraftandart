import React, { useEffect, useState } from "react";
import { api } from "../api";
import { processLogo, processSignature } from "./signatureImage.js";
import { downloadCertificates } from "./certificatePdf";

function useLoad(path, deps) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return setState({ loading: false, error: "", data: null });
    let active = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    api(path)
      .then((data) => active && setState({ loading: false, error: "", data }))
      .catch((e) => active && setState({ loading: false, error: e.message, data: null }));
    return () => {
      active = false;
    };
  }, [path, n, ...deps]);
  return { ...state, reload: () => setN((x) => x + 1) };
}

const names = (students) =>
  students.map((s) => `${s.first_name} ${s.last_name}`).join(", ");
const medalClass = (m) =>
  ({ เหรียญทอง: "medal-gold", เหรียญเงิน: "medal-silver", เหรียญทองแดง: "medal-bronze" })[m] ||
  "medal-none";

function Status({ loading, error }) {
  if (loading) return <p role="status">กำลังโหลด…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  return null;
}

// ---------- มอบหมายกรรมการ (superadmin) ----------
export function JudgeAssignment({ competitions }) {
  const [id, setId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = useLoad(id ? "/admin/judges?competition_id=" + id : null, []);
  async function toggle(judge_id, assigned) {
    setBusy(true);
    setError("");
    try {
      await api("/admin/judges", { competition_id: id, judge_id, assigned });
      q.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>มอบหมายกรรมการตัดสิน</h2>
      </div>
      <section className="panel">
        <label className="field">
          รายการแข่งขัน
          <select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">— เลือกรายการ —</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.category ? c.category + " · " : "") + c.title + (c.grade_label ? " (" + c.grade_label + ")" : "")}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          แสดงเฉพาะบัญชีที่เลือกบทบาทกรรมการ กรรมการที่เป็นผู้ฝึกซ้อมจะไม่ได้ให้คะแนนทีมที่ตนส่งเอง
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {id && <Status {...q} />}
        {id && q.data && (
          q.data.judges.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>กรรมการ</th>
                    <th>โรงเรียน</th>
                    <th>มอบหมาย</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.judges.map((j) => (
                    <tr key={j.id}>
                      <td>{j.name}</td>
                      <td>{j.school}</td>
                      <td>
                        <label>
                          <input
                            type="checkbox"
                            checked={j.assigned}
                            disabled={busy}
                            onChange={(e) => toggle(j.id, e.target.checked)}
                            aria-label={"มอบหมาย " + j.name}
                          />{" "}
                          ตัดสินรายการนี้
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>ยังไม่มีบัญชีที่เลือกบทบาทกรรมการ</p>
          )
        )}
      </section>
    </>
  );
}

// ---------- สำหรับกรรมการ ----------
function ScoreCard({ team, criteria, competitionId, onSaved }) {
  const [values, setValues] = useState(
    criteria.map((_, i) => (team.scores ? String(team.scores[i]) : "")),
  );
  const [busy, setBusy] = useState(false),
    [msg, setMsg] = useState(""),
    [error, setError] = useState("");
  const nums = values.map((v) => (v === "" ? NaN : Number(v)));
  const valid = nums.every((v, i) => Number.isFinite(v) && v >= 0 && v <= criteria[i].max);
  const total = nums.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0);
  async function save(e) {
    e.preventDefault();
    if (!valid) return setError("กรอกคะแนนให้ครบและไม่เกินคะแนนเต็มของแต่ละเกณฑ์");
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await api("/judging/" + competitionId + "/scores", {
        registration_id: team.id,
        revision: team.revision,
        scores: nums,
      });
      setMsg("บันทึกคะแนนแล้ว");
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel score-card" onSubmit={save}>
      <div className="section-heading">
        <h3>ทีมที่ {team.number}</h3>
        {team.own ? (
          <span className="badge">ทีมของคุณ — ไม่ต้องให้คะแนน</span>
        ) : team.scores ? (
          <span className="badge status-approved">ให้คะแนนแล้ว</span>
        ) : (
          <span className="badge status-pending">ยังไม่ให้คะแนน</span>
        )}
      </div>
      <p>
        <strong>{names(team.students)}</strong>
        <br />
        <span className="muted">
          {team.students[0]?.school}
          {team.students[0]?.grade ? " · " + team.students[0].grade : ""}
        </span>
        {team.work_url && (
          <>
            <br />
            <a href={team.work_url} target="_blank" rel="noopener noreferrer">
              เปิดผลงาน
            </a>
          </>
        )}
      </p>
      {!team.own && (
        <>
          <div className="score-grid">
            {criteria.map((c, i) => (
              <label className="field" key={i}>
                <span>
                  {i + 1}. {c.label} <small className="muted">(เต็ม {c.max})</small>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={c.max}
                  step="0.5"
                  required
                  value={values[i]}
                  onChange={(e) =>
                    setValues((v) => v.map((x, k) => (k === i ? e.target.value : x)))
                  }
                />
              </label>
            ))}
          </div>
          <div className="form-actions">
            <strong>
              รวม {Math.round(total * 100) / 100} / {criteria.reduce((a, c) => a + c.max, 0)}
            </strong>
            <button className="primary" disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึกคะแนน"}
            </button>
          </div>
          {msg && <p className="success-message" role="status">{msg}</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </>
      )}
    </form>
  );
}

export function JudgePanel() {
  const [id, setId] = useState("");
  const list = useLoad("/judging", []);
  const detail = useLoad(id ? "/judging/" + id : null, []);
  if (id)
    return (
      <>
        <div className="section-heading">
          <h2>{detail.data?.competition.title || "ให้คะแนน"}</h2>
          <button className="secondary" onClick={() => { setId(""); list.reload(); }}>
            กลับไปรายการที่ได้รับมอบหมาย
          </button>
        </div>
        <Status {...detail} />
        {detail.data && (
          <>
            <p className="muted">
              {detail.data.competition.grade_label} · เกณฑ์ {detail.data.criteria.length} ข้อ
              · แสดงเฉพาะทีมที่ผู้จัดยืนยันการลงทะเบียนแล้ว
            </p>
            {!detail.data.teams.length && (
              <section className="panel">
                <p>ยังไม่มีทีมที่ยืนยันการลงทะเบียน</p>
              </section>
            )}
            {detail.data.teams.map((t) => (
              <ScoreCard
                key={t.id + ":" + t.revision}
                team={t}
                criteria={detail.data.criteria}
                competitionId={id}
                onSaved={detail.reload}
              />
            ))}
          </>
        )}
      </>
    );
  return (
    <>
      <div className="section-heading">
        <h2>รายการที่ได้รับมอบหมายให้ตัดสิน</h2>
      </div>
      <Status {...list} />
      {list.data &&
        (list.data.competitions.length ? (
          <div className="competition-list">
            {list.data.competitions.map((c) => (
              <button key={c.id} className="panel judge-item" onClick={() => setId(c.id)}>
                <span className="eyebrow">{c.category}</span>
                <strong>{c.title}</strong>
                <span className="muted">{c.grade_label}</span>
                <span className={"badge " + (c.teams && c.scored >= c.teams ? "status-approved" : "status-pending")}>
                  ให้คะแนนแล้ว {c.scored}/{c.teams} ทีม
                </span>
              </button>
            ))}
          </div>
        ) : (
          <section className="panel">
            <p>ยังไม่ได้รับมอบหมายให้ตัดสินรายการใด</p>
          </section>
        ))}
    </>
  );
}

// ---------- ผลการแข่งขัน ----------
export function ResultsPanel({ reviewer }) {
  const [id, setId] = useState("");
  const list = useLoad("/results", []);
  const detail = useLoad(id ? "/results/" + id : null, []);
  if (id)
    return (
      <>
        <div className="section-heading">
          <h2>{detail.data?.competition.title || "ผลการแข่งขัน"}</h2>
          <button className="secondary" onClick={() => setId("")}>
            กลับไปรายการผล
          </button>
        </div>
        <Status {...detail} />
        {detail.data && (
          <section className="panel">
            <p className="muted">
              {detail.data.competition.grade_label} · กรรมการ {detail.data.judges.length} ท่าน ·
              คะแนนเฉลี่ยจากกรรมการ (เต็ม {detail.data.max_total})
            </p>
            {!detail.data.complete && (
              <p className="notice">ยังให้คะแนนไม่ครบ ผลนี้เห็นเฉพาะผู้จัด/superadmin</p>
            )}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>อันดับ</th>
                    <th>ผู้เข้าแข่งขัน</th>
                    <th>โรงเรียน</th>
                    <th>คะแนน</th>
                    <th>รางวัล</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.teams.map((t) => (
                    <tr key={t.registration_id}>
                      <td>{t.rank ?? "–"}</td>
                      <td>{names(t.students)}</td>
                      <td>{t.school}</td>
                      <td>
                        {t.score ?? "–"}
                        {!t.complete && (
                          <small className="muted"> ({t.judges_scored}/{t.judges_required})</small>
                        )}
                      </td>
                      <td>
                        {t.medal && <span className={"badge " + medalClass(t.medal)}>{t.medal}</span>}
                        {t.rank_label && <div>{t.rank_label}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </>
    );
  return (
    <>
      <div className="section-heading">
        <h2>ผลการแข่งขัน</h2>
      </div>
      <p className="muted">
        เกณฑ์รางวัล: เหรียญทอง 80 ขึ้นไป · เหรียญเงิน 70–79 · เหรียญทองแดง 60–69 · ต่ำกว่า 60 เข้าร่วม
      </p>
      <Status {...list} />
      {list.data &&
        (list.data.competitions.length ? (
          <div className="competition-list">
            {list.data.competitions.map((c) => (
              <button key={c.id} className="panel judge-item" onClick={() => setId(c.id)}>
                <span className="eyebrow">{c.category}</span>
                <strong>{c.title}</strong>
                <span className="muted">{c.grade_label} · {c.teams} ทีม</span>
                <span className={"badge " + (c.complete ? "status-approved" : "status-pending")}>
                  {c.complete ? "ประกาศผลแล้ว" : `กำลังตัดสิน ${c.scored}/${c.teams}`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <section className="panel">
            <p>{reviewer ? "ยังไม่มีรายการที่มีทีมยืนยันแล้ว" : "ยังไม่มีรายการที่ประกาศผล"}</p>
          </section>
        ))}
    </>
  );
}

// ---------- ประกาศนียบัตร ----------
function CertificateSettings({ settings, onSaved }) {
  const [s, setS] = useState(() => ({
    ...settings,
    signers: [...settings.signers, { name: "", position: "", signature: "" }, { name: "", position: "", signature: "" }, { name: "", position: "", signature: "" }].slice(0, 3),
  }));
  const [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await api("/certificate-settings", s);
      setMsg("บันทึกแล้ว");
      onSaved();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="panel">
      <summary>ตั้งค่าประกาศนียบัตร (superadmin)</summary>
      <form onSubmit={save}>
        <label className="field">
          หน่วยงานผู้มอบ
          <input value={s.organization} maxLength={150} onChange={(e) => set("organization", e.target.value)} />
        </label>
        <label className="field">
          ชื่องาน
          <input value={s.event_line} maxLength={200} onChange={(e) => set("event_line", e.target.value)} />
        </label>
        <label className="field">
          ข้อความวันที่ (เช่น ให้ไว้ ณ วันที่ 20 พฤศจิกายน 2568)
          <input value={s.issued_text} maxLength={100} onChange={(e) => set("issued_text", e.target.value)} />
        </label>
        <div className="field">
          โลโก้ (PNG/JPEG ไม่เกิน 5 MB ระบบจะย่อให้อัตโนมัติ)
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                set("logo", await processLogo(f));
                setMsg("");
              } catch (err) {
                setMsg(err.message);
              }
            }}
          />
          {s.logo && (
            <span>
              <img src={s.logo} alt="โลโก้" style={{ height: 56, verticalAlign: "middle" }} />{" "}
              <button type="button" onClick={() => set("logo", "")}>ลบโลโก้</button>
            </span>
          )}
        </div>
        {s.signers.map((g, i) => (
          <div className="student-fields" key={i}>
            <label className="field">
              ผู้ลงนาม {i + 1}
              <input
                value={g.name}
                maxLength={100}
                onChange={(e) => set("signers", s.signers.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
              />
            </label>
            <label className="field">
              ตำแหน่ง
              <input
                value={g.position}
                maxLength={120}
                onChange={(e) => set("signers", s.signers.map((x, k) => (k === i ? { ...x, position: e.target.value } : x)))}
              />
            </label>
            <div className="field">
              ลายเซ็นอิเล็กทรอนิกส์ (ถ่ายรูปลายเซ็นบนกระดาษขาว ไม่เกิน 5 MB ระบบจะลบพื้นหลังให้)
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setMsg("กำลังประมวลผลลายเซ็น…");
                  try {
                    const signature = await processSignature(f);
                    setS((v) => ({ ...v, signers: v.signers.map((x, k) => (k === i ? { ...x, signature } : x)) }));
                    setMsg("ลบพื้นหลังลายเซ็นแล้ว กดบันทึกเพื่อใช้งาน");
                  } catch (err) {
                    setMsg(err.message);
                  }
                }}
              />
              {g.signature && (
                <span>
                  <img
                    src={g.signature}
                    alt={`ลายเซ็นผู้ลงนาม ${i + 1}`}
                    style={{ height: 64, maxWidth: 240, objectFit: "contain", background: "#fff", border: "1px dashed #c8d3e6", verticalAlign: "middle" }}
                  />{" "}
                  <button type="button" onClick={() => set("signers", s.signers.map((x, k) => (k === i ? { ...x, signature: "" } : x)))}>
                    ลบลายเซ็น
                  </button>
                </span>
              )}
            </div>
          </div>
        ))}
        <div className="form-actions">
          <button className="primary" disabled={busy}>บันทึกการตั้งค่า</button>
          {msg && <span role="status">{msg}</span>}
        </div>
      </form>
    </details>
  );
}

export function CertificatesPanel({ user }) {
  const q = useLoad("/certificates", []);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function download(certs, name) {
    setBusy(name);
    setError("");
    try {
      await downloadCertificates(certs, q.data.settings, name + ".pdf");
    } catch (e) {
      setError(e.message || "สร้าง PDF ไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>ประกาศนียบัตร</h2>
        {q.data?.certificates.length > 1 && (
          <button className="secondary" disabled={!!busy} onClick={() => download(q.data.certificates, "ประกาศนียบัตรทั้งหมด")}>
            ดาวน์โหลดทั้งหมด (PDF)
          </button>
        )}
      </div>
      <Status {...q} />
      {error && <p className="error" role="alert">{error}</p>}
      {q.data && user.is_superadmin && (
        <CertificateSettings key={JSON.stringify(q.data.settings)} settings={q.data.settings} onSaved={q.reload} />
      )}
      {q.data && (
        <>
          {!q.data.certificates.length && (
            <section className="panel">
              <p>ยังไม่มีประกาศนียบัตร ระบบจะสร้างให้เมื่อรายการที่ลงทะเบียนไว้ประกาศผลแล้ว</p>
            </section>
          )}
          {q.data.certificates.map((c) => (
            <section className="panel registration-card" key={c.registration_id}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{c.competition.category}</span>
                  <h3>{c.competition.title}</h3>
                  <span className="muted">{c.competition.grade_label}</span>
                </div>
                <span className={"badge " + medalClass(c.medal)}>
                  {c.medal}
                  {c.rank_label ? " · " + c.rank_label : ""}
                </span>
              </div>
              <p>
                {names(c.students)} <span className="muted">· คะแนน {c.score}</span>
              </p>
              <button
                className="primary"
                disabled={!!busy}
                onClick={() => download([c], "ประกาศนียบัตร-" + c.competition.title)}
              >
                {busy === "ประกาศนียบัตร-" + c.competition.title ? "กำลังสร้าง PDF…" : `ดาวน์โหลด PDF (${c.students.length} ใบ)`}
              </button>
            </section>
          ))}
          {q.data.pending.length > 0 && (
            <section className="panel">
              <h3>รอประกาศผล</h3>
              <ul>
                {q.data.pending.map((p) => (
                  <li key={p.id}>
                    {p.title} {p.grade_label && <span className="muted">({p.grade_label})</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
