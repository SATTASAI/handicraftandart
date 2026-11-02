import AdminOperations from "./components/AdminOperations";
import { ApplicantTable } from "./components/ApplicantTable";
import React, { useEffect, useRef, useState } from "react";
import {
  House,
  Trophy,
  ClipboardText,
  ChartBar,
  Certificate,
  Star,
  Users,
  MagnifyingGlass,
  BookOpen,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  Bell,
  UserCircle,
  Buildings,
  CaretDown,
  List,
  X,
  Plus,
  SignOut,
  CheckCircle,
  MapPin,
  CalendarBlank,
  DownloadSimple,
  FloppyDisk,
  PencilSimple,
  LockKey,
  Eye,
  EyeSlash,
  WarningCircle,
  Trash,
} from "@phosphor-icons/react";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import { api } from "./api";
import "./styles.css";
const BRAND = "ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง";
const nav = [
  ["/", "หน้าแรก", House],
  ["/competitions", "รายการแข่งขัน", Trophy],
  ["/registrations", "ลงทะเบียน", ClipboardText],
  ["/results", "ผลการแข่งขัน", ChartBar],
  ["/certificates", "ประกาศนียบัตร", Certificate],
];
function go(path, replace = false) {
  history[replace ? "replaceState" : "pushState"]({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
function Button({ children, variant = "", ...props }) {
  return (
    <button className={"btn " + variant} {...props}>
      {children}
    </button>
  );
}
function Empty({ icon: Icon = ClipboardText, title, children }) {
  return (
    <div className="empty">
      <Icon size={44} weight="light" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Message({ text, success = false }) {
  return text ? (
    <div
      role={success ? "status" : "alert"}
      className={"message " + (success ? "success" : "error")}
    >
      {success ? <CheckCircle size={20} /> : <WarningCircle size={20} />}
      <span>{text}</span>
    </div>
  ) : null;
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function AuthPage({ mode, setMode, onClose, onUser }) {
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    setError("");
    setSuccess("");
  }, [mode]);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === "register" && data.password !== data.confirm)
        throw new Error("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      const result = await api(
        "/auth/" + (mode === "forgot" ? "forgot-password" : mode),
        data,
      );
      if (result.user) {
        onUser(result.user);
        onClose();
      } else setSuccess(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-page" aria-label="บัญชีผู้ใช้งาน">
      <div className="auth-intro">
        <span className="badge blue">ศิลปหัตถกรรมนักเรียน</span>
        <h1 className="auth-welcome">
          ยินดีต้อนรับ
          <span className="auth-welcome-system">
            สู่ระบบการแข่งขันศิลปหัตถกรรม
          </span>
          <span className="auth-welcome-network">
            ศูนย์เครือข่ายสองพี่น้อง
            <br />
            ห้วยแม่เพรียง ป่าเด็ง
          </span>
        </h1>
        <p>
          ร่วมสร้างเวทีแห่งการเรียนรู้และความคิดสร้างสรรค์
          <br />
          สำหรับนักเรียน ครูผู้ฝึกซ้อม และกรรมการ
        </p>
      </div>
      <div className="auth-card dialog-inner">
        <div className="auth-mark">
          <LockKey size={27} />
        </div>
        <h2>
          {mode === "register"
            ? "สมัครสมาชิก"
            : mode === "forgot"
              ? "ลืมรหัสผ่าน"
              : "เข้าสู่ระบบ"}
        </h2>
        <p className="muted">
          {mode === "register"
            ? "สำหรับกรรมการและผู้ฝึกซ้อมของโรงเรียนที่เข้าร่วม"
            : mode === "forgot"
              ? "เราจะส่งลิงก์เปลี่ยนรหัสผ่านไปยังอีเมลที่สมัครไว้"
              : "เข้าสู่ระบบจัดการการแข่งขันศิลปหัตถกรรม"}
        </p>
        <Message text={error} />
        <Message text={success} success />
        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <Field label="ชื่อ–นามสกุล">
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="ระบุชื่อ–นามสกุล"
                />
              </Field>
              <Field label="สมัครเป็น">
                <select name="applicant_role" required defaultValue="">
                  <option value="" disabled>
                    เลือกบทบาท
                  </option>
                  <option value="judge">กรรมการ</option>
                  <option value="coach">ผู้ฝึกซ้อม</option>
                </select>
                <small>
                  สิทธิ์กรรมการจะเปิดใช้งานเมื่อผู้ดูแลกำหนดสิทธิ์ให้
                </small>
              </Field>
              <Field label="โรงเรียนที่สังกัด">
                <input
                  name="school"
                  required
                  minLength={2}
                  maxLength={150}
                  placeholder="เช่น โรงเรียนบ้านป่าเด็ง"
                />
                <small>ใช้ระบุโรงเรียนในรายการสมัครแข่งขันของคุณ</small>
              </Field>
            </>
          )}
          <Field label="อีเมล">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              placeholder="teacher@school.ac.th"
            />
          </Field>
          {mode !== "forgot" && (
            <>
              <Field label="รหัสผ่าน">
                <div className="password-field">
                  <input
                    name="password"
                    type={visible ? "text" : "password"}
                    required
                    minLength={mode === "register" ? 12 : 1}
                    maxLength={128}
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    placeholder={
                      mode === "register"
                        ? "อย่างน้อย 12 ตัวอักษร"
                        : "กรอกรหัสผ่าน"
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </Field>
              {mode === "register" && (
                <Field label="ยืนยันรหัสผ่าน">
                  <input
                    name="confirm"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </Field>
              )}
            </>
          )}
          {mode === "login" && (
            <button
              type="button"
              className="text-button forgot-link"
              onClick={() => setMode("forgot")}
            >
              ลืมรหัสผ่าน?
            </button>
          )}
          <Button disabled={busy} type="submit" variant="primary full">
            {busy
              ? "กำลังดำเนินการ…"
              : mode === "register"
                ? "สมัครสมาชิก"
                : mode === "forgot"
                  ? "ส่งลิงก์รีเซ็ตรหัสผ่าน"
                  : "เข้าสู่ระบบ"}
            <ArrowRight size={18} />
          </Button>
        </form>
        <div className="auth-footer">
          {mode === "login" ? (
            <>
              ยังไม่มีบัญชี?{" "}
              <button
                className="text-button"
                onClick={() => setMode("register")}
              >
                สมัครสมาชิก
              </button>
            </>
          ) : (
            <button className="text-button" onClick={() => setMode("login")}>
              กลับไปเข้าสู่ระบบ
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
function ResetPassword({ openLogin }) {
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const tokenRef = useRef(
    new URLSearchParams(location.hash.slice(1)).get("token") || "",
  );
  useEffect(() => {
    history.replaceState({}, "", "/reset-password");
  }, []);
  async function submit(e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    setError("");
    if (d.password !== d.confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setBusy(true);
    try {
      const r = await api("/auth/reset-password", {
        token: tokenRef.current,
        password: d.password,
      });
      setSuccess(r.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="narrow">
      <div className="eyebrow">บัญชีผู้ใช้งาน</div>
      <h1>ตั้งรหัสผ่านใหม่</h1>
      <p className="muted">รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร</p>
      <Message text={error} />
      <Message text={success} success />
      {success ? (
        <Button variant="primary" onClick={openLogin}>
          เข้าสู่ระบบ
        </Button>
      ) : (
        <form onSubmit={submit}>
          <Field label="รหัสผ่านใหม่">
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="ยืนยันรหัสผ่านใหม่">
            <input
              name="confirm"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </Field>
          <Button variant="primary" disabled={busy || !tokenRef.current}>
            เปลี่ยนรหัสผ่าน
          </Button>
          {!tokenRef.current && (
            <Message text="ไม่พบลิงก์รีเซ็ต กรุณาเปิดลิงก์จากอีเมล หรือขอลิงก์ใหม่" />
          )}
        </form>
      )}
    </section>
  );
}
function Directory({ competitions, loading, error }) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [grade, setGrade] = useState("");
  const filtered = competitions.filter(
    (c) =>
      (c.title + c.category).includes(search) &&
      (!category || c.category === category) &&
      (!grade || c.grade === grade),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>เลือกเวทีแห่งความสามารถ</h1>
          <p>ค้นหารายการแข่งขัน ดูรายละเอียด และลงทะเบียนเข้าร่วม</p>
        </div>
      </div>
      <div className="filters">
        <label className="search">
          <MagnifyingGlass size={23} />
          <input
            aria-label="ค้นหารายการแข่งขัน"
            placeholder="ค้นหารายการแข่งขัน"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="icon-button"
              aria-label="ล้างคำค้น"
              onClick={() => setSearch("")}
            >
              <X size={18} />
            </button>
          )}
        </label>
        <label className="select-field">
          <BookOpen size={22} />
          <select
            aria-label="กลุ่มสาระการเรียนรู้"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">ทุกกลุ่มสาระการเรียนรู้</option>
            {[...new Set(competitions.map((x) => x.category))].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <GraduationCap size={23} />
          <select
            aria-label="ระดับชั้น"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          >
            <option value="">ทุกระดับชั้น</option>
            {[...new Set(competitions.map((x) => x.grade))].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <Message text={error} />
      {loading ? (
        <div className="loading" role="status">
          กำลังโหลดรายการแข่งขัน…
        </div>
      ) : !filtered.length ? (
        <Empty title="ไม่พบรายการแข่งขัน">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</Empty>
      ) : (
        <div className="competition-grid">
          {filtered.map((c) => (
            <a
              key={c.id}
              className="competition-card"
              href={"/competitions/" + c.id}
              onClick={(e) => {
                e.preventDefault();
                go("/competitions/" + c.id);
              }}
            >
              <img
                src={"/covers/" + c.cover + ".webp"}
                alt={"ภาพประกอบ" + c.title}
                loading="lazy"
              />
              <div className="card-body">
                <div className="card-title">
                  <h2>
                    {c.title} {c.grade}
                  </h2>
                  <span
                    className={
                      "badge " + (c.registration_open ? "green" : "gray")
                    }
                  >
                    {c.published
                      ? "ประกาศผลแล้ว"
                      : c.registration_open
                        ? "เปิดรับสมัคร"
                        : "ปิดรับสมัคร"}
                  </span>
                </div>
                <div className="card-meta">
                  <BookOpen size={21} />
                  <span>กลุ่มสาระการเรียนรู้{c.category}</span>
                </div>
                <div className="card-meta">
                  <GraduationCap size={21} />
                  <span>
                    ระดับชั้น ประถมศึกษาปีที่ {c.grade.replace("ป.", "")}
                  </span>
                </div>
                <div className="card-link">
                  ดูรายละเอียด <ArrowRight size={20} />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
function CompetitionDetail({ c, onRegister }) {
  return (
    <>
      <button className="text-button back" onClick={() => go("/")}>
        <ArrowLeft size={18} /> รายการแข่งขัน
      </button>
      <div className="detail-layout">
        <div>
          <img
            className="detail-cover"
            src={"/covers/" + c.cover + ".webp"}
            alt={c.title}
          />
          <div className="eyebrow">กลุ่มสาระการเรียนรู้{c.category}</div>
          <h1>{c.title}</h1>
          <p className="detail-description">{c.description}</p>
          <h2>เกณฑ์และคุณสมบัติ</h2>
          <div className="spec-row">
            <span>ระดับชั้น</span>
            <strong>{c.grade}</strong>
          </div>
          <div className="spec-row">
            <span>นักเรียน</span>
            <strong>ไม่เกิน {c.max_students} คน</strong>
          </div>
          <div className="spec-row">
            <span>ครูผู้ฝึกซ้อม</span>
            <strong>ไม่เกิน {c.max_coaches} คน</strong>
          </div>
        </div>
        <aside className="detail-aside">
          <span className={"badge " + (c.registration_open ? "green" : "gray")}>
            {c.published
              ? "ประกาศผลแล้ว"
              : c.registration_open
                ? "เปิดรับสมัคร"
                : "ปิดรับสมัคร"}
          </span>
          <h2>เข้าร่วมการแข่งขัน</h2>
          <div className="info-line">
            <CalendarBlank size={23} />
            <div>
              <small>กำหนดการแข่งขัน</small>
              <p>{c.schedule}</p>
            </div>
          </div>
          <div className="info-line">
            <MapPin size={23} />
            <div>
              <small>สถานที่</small>
              <p>{c.venue}</p>
            </div>
          </div>
          <Button
            variant="primary full"
            disabled={!c.registration_open || c.published}
            onClick={() => onRegister(c)}
          >
            ลงทะเบียนแข่งขัน <ArrowRight size={19} />
          </Button>
          <p className="helper">
            กรอกข้อมูลนักเรียนและครูผู้ฝึกซ้อม ตรวจสอบให้ครบก่อนยืนยัน
          </p>
        </aside>
      </div>
    </>
  );
}
function RegistrationForm({ c, user, onSaved, existing }) {
  const [students, setStudents] = useState(
      existing?.students || [{ name: "", grade: "" }],
    ),
    [coaches, setCoaches] = useState(
      existing?.coaches || [{ name: user.name }],
    ),
    [work, setWork] = useState(existing?.work_url || ""),
    [review, setReview] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(status) {
    setBusy(true);
    setError("");
    try {
      const r = await api("/registrations", {
        competition_id: c.id,
        students,
        coaches,
        status,
        work_url: work,
      });
      onSaved(r.message);
      go("/registrations");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function next(e) {
    e.preventDefault();
    setReview(true);
    window.scrollTo(0, 0);
  }
  return (
    <>
      <button
        className="text-button back"
        onClick={() => go("/competitions/" + c.id)}
      >
        <ArrowLeft size={18} /> {c.title}
      </button>
      <h1>{review ? "ตรวจสอบก่อนยืนยัน" : "ลงทะเบียนแข่งขัน"}</h1>
      <p className="muted">
        {user.school} · {c.title} {c.grade}
      </p>
      <div className="registration-layout">
        <form onSubmit={next}>
          <div className="selected-competition">
            <BookOpen size={25} />
            <div>
              <h2>
                {c.title} {c.grade}
              </h2>
              <p>
                นักเรียนไม่เกิน {c.max_students} คน · ครูไม่เกิน {c.max_coaches}{" "}
                คน
              </p>
            </div>
          </div>
          <Message text={error} />
          <div className="section-title">
            <h2>รายชื่อนักเรียน ({students.length} คน)</h2>
            {!review && (
              <Button
                type="button"
                disabled={students.length >= c.max_students}
                onClick={() =>
                  setStudents([...students, { name: "", grade: "" }])
                }
              >
                <Plus size={17} /> เพิ่มนักเรียน
              </Button>
            )}
          </div>
          {students.map((s, i) => (
            <div className="person-row" key={i}>
              <span className="row-number">{i + 1}</span>
              <Field label="ชื่อ–นามสกุลนักเรียน">
                <input
                  aria-label={"ชื่อนักเรียน " + (i + 1)}
                  required
                  minLength={2}
                  maxLength={100}
                  readOnly={review}
                  value={s.name}
                  onChange={(e) =>
                    setStudents(
                      students.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="ระดับชั้น">
                <select
                  aria-label={"ระดับชั้น " + (i + 1)}
                  disabled={review}
                  value={s.grade}
                  required
                  onChange={(e) =>
                    setStudents(
                      students.map((x, j) =>
                        j === i ? { ...x, grade: e.target.value } : x,
                      ),
                    )
                  }
                >
                  <option value="">เลือกชั้น</option>
                  {(c.grade === "ป.4–6" ? [4, 5, 6] : [1, 2, 3, 4, 5, 6]).map(
                    (n) => (
                      <option key={n}>ป.{n}</option>
                    ),
                  )}
                </select>
              </Field>
              {!review && (
                <button
                  type="button"
                  className="icon-button danger"
                  disabled={students.length === 1}
                  aria-label={"ลบนักเรียน " + (i + 1)}
                  onClick={() =>
                    setStudents(students.filter((_, j) => i !== j))
                  }
                >
                  <Trash size={20} />
                </button>
              )}
            </div>
          ))}
          <div className="section-title">
            <h2>ครูผู้ฝึกซ้อม ({coaches.length} คน)</h2>
            {!review && (
              <Button
                type="button"
                disabled={coaches.length >= c.max_coaches}
                onClick={() => setCoaches([...coaches, { name: "" }])}
              >
                <Plus size={17} /> เพิ่มครู
              </Button>
            )}
          </div>
          {coaches.map((s, i) => (
            <div className="person-row coach" key={i}>
              <span className="row-number">{i + 1}</span>
              <Field label="ชื่อ–นามสกุลครู">
                <input
                  aria-label={"ชื่อครู " + (i + 1)}
                  required
                  minLength={2}
                  maxLength={100}
                  readOnly={review}
                  value={s.name}
                  onChange={(e) =>
                    setCoaches(
                      coaches.map((x, j) =>
                        j === i ? { name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              {!review && (
                <button
                  type="button"
                  className="icon-button danger"
                  disabled={coaches.length === 1}
                  aria-label={"ลบครู " + (i + 1)}
                  onClick={() => setCoaches(coaches.filter((_, j) => i !== j))}
                >
                  <Trash size={20} />
                </button>
              )}
            </div>
          ))}
          <Field label="ลิงก์ผลงาน (ถ้ามี)">
            <input
              type="url"
              value={work}
              placeholder="https://…"
              maxLength={1000}
              readOnly={review}
              onChange={(e) => setWork(e.target.value)}
            />
            <small>แนบลิงก์ไฟล์หรือแฟ้มผลงานที่ผู้จัดสามารถเปิดดูได้</small>
          </Field>
          <div className="form-actions">
            {review ? (
              <>
                <Button type="button" onClick={() => setReview(false)}>
                  กลับไปแก้ไข
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  variant="primary"
                  onClick={() => save("submitted")}
                >
                  ยืนยันลงทะเบียน <CheckCircle size={20} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => save("draft")}
                >
                  <FloppyDisk size={18} /> บันทึกฉบับร่าง
                </Button>
                <Button variant="primary" type="submit">
                  ตรวจสอบข้อมูล <ArrowRight size={20} />
                </Button>
              </>
            )}
          </div>
        </form>
        <aside className="helper-panel">
          <h3>ก่อนส่งรายการ</h3>
          <p>
            ตรวจสอบการสะกดชื่อและโรงเรียนให้ถูกต้อง
            ข้อมูลจะใช้ในผลการแข่งขันและประกาศนียบัตร
          </p>
          <hr />
          <h3>{user.school}</h3>
          <p>
            ผู้ประสานงาน
            <br />
            {user.name}
          </p>
          <p>
            ส่งรายการแล้วจะไม่สามารถแก้ไขเองได้ กรุณาติดต่อผู้จัดหากต้องการแก้ไข
          </p>
        </aside>
      </div>
    </>
  );
}
function Registrations({ rows, loading, error }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>รายการลงทะเบียนของฉัน</h1>
          <p>ติดตามรายการแข่งขัน นักเรียน และครูผู้ฝึกซ้อม</p>
        </div>
        <Button variant="primary" onClick={() => go("/")}>
          <Plus size={18} /> เพิ่มรายการ
        </Button>
      </div>
      <Message text={error} />
      {loading ? (
        <p>กำลังโหลด…</p>
      ) : !rows.length ? (
        <Empty title="ยังไม่มีรายการลงทะเบียน">
          เลือกการแข่งขันที่หน้าแรกเพื่อเริ่มสมัคร
        </Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>รายการแข่งขัน</th>
                <th>นักเรียน / ครู</th>
                <th>สถานะ</th>
                <th>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>
                      {r.title} {r.grade}
                    </strong>
                    <small>{r.school}</small>
                  </td>
                  <td>
                    {r.students.length} คน / {r.coaches.length} คน
                  </td>
                  <td>
                    <span
                      className={
                        "badge " + (r.status === "draft" ? "yellow" : "green")
                      }
                    >
                      {r.status === "draft" ? "ฉบับร่าง" : "ส่งแล้ว"}
                    </span>
                  </td>
                  <td>
                    {r.status === "draft" ? (
                      <button
                        className="text-button"
                        onClick={() => go("/register/" + r.competition_id)}
                      >
                        แก้ไขและส่ง <ArrowRight size={17} />
                      </button>
                    ) : (
                      <button
                        className="text-button"
                        onClick={() => go("/competitions/" + r.competition_id)}
                      >
                        ดูรายการ <ArrowRight size={17} />
                      </button>
                    )}
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
function Results({ rows, competitions }) {
  const [filter, setFilter] = useState("");
  const list = rows.filter((x) => !filter || x.competition_id === filter);
  return (
    <>
      <h1>ผลการแข่งขัน</h1>
      <p className="muted">แสดงเฉพาะรายการที่ผู้จัดยืนยันผลแล้ว</p>
      <div className="filters results-filter">
        <label className="select-field">
          <Trophy size={22} />
          <select
            aria-label="เลือกรายการผลการแข่งขัน"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">ทุกรายการแข่งขัน</option>
            {competitions.map((c) => (
              <option value={c.id} key={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!list.length ? (
        <Empty icon={Trophy} title="ยังไม่มีผลการแข่งขัน">
          เมื่อกรรมการให้คะแนนครบและผู้จัดยืนยันผล คะแนนและรางวัลจะแสดงที่นี่
        </Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>รายการ / โรงเรียน</th>
                <th>ผู้เข้าแข่งขัน</th>
                <th>คะแนน</th>
                <th>ผลรางวัล</th>
                <th>ผลงาน</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.title}</strong>
                    <small>{r.school}</small>
                  </td>
                  <td>
                    {r.students.map((s) => (
                      <div key={s.name}>{s.name}</div>
                    ))}
                  </td>
                  <td>
                    <strong className="score">
                      {Number(r.score).toFixed(2)}
                    </strong>
                  </td>
                  <td>{r.medal}</td>
                  <td>
                    {r.work_url ? (
                      <a
                        href={r.work_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-button"
                      >
                        เปิดผลงาน <ArrowRight size={16} />
                      </a>
                    ) : (
                      "—"
                    )}
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
function Certificates({ rows, notify }) {
  const [busy, setBusy] = useState("");
  async function download(r) {
    setBusy(r.id);
    try {
      const data = await api("/certificates/" + r.id);
      const { createCertificate } = await import("./certificate");
      await createCertificate(data.certificate);
      notify("ดาวน์โหลดประกาศนียบัตร PDF แล้ว");
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <h1>ประกาศนียบัตรของฉัน</h1>
      <p className="muted">
        ดาวน์โหลดสำหรับนักเรียนและครูผู้ฝึกซ้อม เมื่อผู้จัดยืนยันผลการแข่งขัน
      </p>
      {!rows.length ? (
        <Empty icon={Certificate} title="ยังไม่มีประกาศนียบัตร">
          รายการที่ลงทะเบียนจะแสดงที่นี่
        </Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>รายการแข่งขัน</th>
                <th>สถานะผล</th>
                <th>ดาวน์โหลด</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>
                      {r.title} {r.grade}
                    </strong>
                    <small>
                      นักเรียน {r.students.length} คน · ครู {r.coaches.length}{" "}
                      คน
                    </small>
                  </td>
                  <td>
                    <span
                      className={"badge " + (r.published ? "green" : "gray")}
                    >
                      {r.published ? "ยืนยันผลแล้ว" : "รอประกาศผล"}
                    </span>
                  </td>
                  <td>
                    <Button
                      disabled={!r.published || busy === r.id}
                      onClick={() => download(r)}
                    >
                      <DownloadSimple size={18} />
                      {busy === r.id ? "กำลังสร้าง PDF…" : "ดาวน์โหลด PDF"}
                    </Button>
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
function Judge({ notify }) {
  const [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(null),
    [values, setValues] = useState(["", "", "", ""]),
    [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/judge/registrations")
      .then((r) => setRows(r.registrations))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  function select(r) {
    setSelected(r);
    setValues(r.criteria || ["", "", "", ""]);
    setComment(r.comment || "");
    setError("");
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/judge/score", {
        registration_id: selected.id,
        criteria: values.map(Number),
        comment,
      });
      notify("บันทึกคะแนนแล้ว");
      setSelected(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>ให้คะแนนการแข่งขัน</h1>
      <p className="muted">
        เฉพาะรายการที่ผู้จัดมอบหมายให้คุณ · เกณฑ์ตัวอย่าง
        ต้องตรวจสอบกับผู้จัดก่อนใช้งานจริง
      </p>
      <Message text={error} />
      {!rows.length ? (
        <Empty icon={Star} title="ยังไม่มีทีมให้คะแนน">
          รอผู้จัดมอบหมายรายการแข่งขันและมีโรงเรียนส่งรายชื่อ
        </Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>รายการ / โรงเรียน</th>
                <th>ผู้เข้าแข่งขัน</th>
                <th>คะแนนของฉัน</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.title}</strong>
                    <small>{r.school}</small>
                  </td>
                  <td>
                    {r.students.map((s) => (
                      <div key={s.name}>{s.name}</div>
                    ))}
                    {r.work_url && (
                      <a
                        href={r.work_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ดูผลงาน
                      </a>
                    )}
                  </td>
                  <td>{r.total ?? "ยังไม่ให้คะแนน"}</td>
                  <td>
                    <Button disabled={r.published} onClick={() => select(r)}>
                      {r.published
                        ? "ประกาศผลแล้ว"
                        : r.total !== null
                          ? "แก้คะแนน"
                          : "ให้คะแนน"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <section className="score-panel">
          <h2>{selected.school}</h2>
          <p>{selected.title}</p>
          <form onSubmit={save}>
            {[
              "คุณภาพผลงาน",
              "ความคิดสร้างสรรค์",
              "กระบวนการทำงาน",
              "การนำเสนอ",
            ].map((title, i) => (
              <Field
                key={i}
                label={title + " (เต็ม " + [40, 30, 20, 10][i] + ")"}
              >
                <input
                  aria-label={title}
                  type="number"
                  step="0.01"
                  min="0"
                  max={[40, 30, 20, 10][i]}
                  required
                  value={values[i]}
                  onChange={(e) =>
                    setValues(
                      values.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                />
              </Field>
            ))}
            <Field label="ข้อเสนอแนะ">
              <textarea
                value={comment}
                maxLength={1000}
                onChange={(e) => setComment(e.target.value)}
              />
            </Field>
            <strong>
              รวม {values.reduce((a, b) => a + Number(b || 0), 0).toFixed(2)} /
              100
            </strong>
            <div className="form-actions">
              <Button type="button" onClick={() => setSelected(null)}>
                ยกเลิก
              </Button>
              <Button variant="primary" disabled={busy}>
                บันทึกคะแนน
              </Button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
function Admin({ competitions, reload, notify }) {
  const [users, setUsers] = useState([]),
    [assignments, setAssignments] = useState([]),
    [overview, setOverview] = useState(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("operations"),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false);
  const load = () =>
    Promise.all([api("/admin/users"), api("/admin/overview")])
      .then(([r, operations]) => {
        setUsers(r.users);
        setAssignments(r.assignments);
        setOverview(operations);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function action(path, data, message) {
    setBusy(true);
    setError("");
    try {
      await api(path, data);
      notify(message);
      await load();
      await reload();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>จัดการสิทธิ์และการแข่งขัน</h1>
      <p className="muted">
        กำหนดบทบาท มอบหมายกรรมการ และยืนยันผลก่อนออกประกาศนียบัตร
      </p>
      <div className="tabs">
        {[
          ["operations", "ภาพรวม / ผู้สมัคร / ส่งประกาศนียบัตร"],
          ["users", "สิทธิ์ผู้ใช้งาน"],
          ["assignments", "มอบหมายกรรมการ"],
          ["competitions", "จัดการรายการ / ประกาศผล"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <Message text={error} />
      {tab === "operations" && (
        <AdminOperations data={overview} refresh={load} notify={notify} />
      )}
      {tab === "users" && (
        <>
          <p className="helper">
            บทบาทที่สมัครแสดงตามข้อมูลผู้สมัคร
            ผู้ดูแลเป็นผู้กำหนดสิทธิ์ใช้งานจริง
          </p>
          <ApplicantTable
            users={users}
            busy={busy}
            onRoleChange={(userId, role) =>
              action(
                "/admin/role",
                { user_id: userId, role },
                "เปลี่ยนสิทธิ์แล้ว",
              )
            }
          />
        </>
      )}
      {tab === "assignments" && (
        <>
          <form
            className="assignment-form"
            onSubmit={(e) => {
              e.preventDefault();
              action(
                "/admin/assignment",
                Object.fromEntries(new FormData(e.currentTarget)),
                "มอบหมายกรรมการแล้ว",
              );
            }}
          >
            <Field label="รายการแข่งขัน">
              <select required name="competition_id">
                <option value="">เลือกรายการ</option>
                {competitions
                  .filter((c) => !c.published)
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.title}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="กรรมการ">
              <select required name="judge_id">
                <option value="">เลือกกรรมการ</option>
                {users
                  .filter((u) => ["judge", "admin"].includes(u.role))
                  .map((u) => (
                    <option value={u.id} key={u.id}>
                      {u.name} · {u.school}
                    </option>
                  ))}
              </select>
            </Field>
            <Button disabled={busy} variant="primary">
              มอบหมาย
            </Button>
          </form>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>รายการ</th>
                  <th>กรรมการ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.judge_id + a.competition_id}>
                    <td>
                      {
                        competitions.find((c) => c.id === a.competition_id)
                          ?.title
                      }
                    </td>
                    <td>{users.find((u) => u.id === a.judge_id)?.name}</td>
                    <td>
                      <Button
                        disabled={
                          busy ||
                          !!competitions.find((c) => c.id === a.competition_id)
                            ?.published
                        }
                        onClick={() => {
                          if (
                            confirm(
                              "ถอนการมอบหมายและลบคะแนนของกรรมการนี้ในรายการนี้?",
                            )
                          )
                            action(
                              "/admin/assignment",
                              { ...a, remove: true },
                              "ถอนการมอบหมายแล้ว",
                            );
                        }}
                      >
                        ถอนการมอบหมาย
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "competitions" && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>รายการแข่งขัน</th>
                  <th>สถานะ</th>
                  <th>ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {competitions.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.title} {c.grade}
                    </td>
                    <td>
                      {c.published
                        ? "ประกาศผลแล้ว"
                        : c.registration_open
                          ? "เปิดรับสมัคร"
                          : "ปิดรับสมัคร"}
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button
                          disabled={c.published || busy}
                          onClick={() => setEditing({ ...c })}
                        >
                          <PencilSimple size={16} /> แก้ไข
                        </Button>
                        <Button
                          disabled={c.published || busy}
                          variant="primary"
                          onClick={() => {
                            if (
                              confirm(
                                "ยืนยันประกาศผล " +
                                  c.title +
                                  "? เมื่อประกาศแล้วจะล็อกคะแนนและเปิดประกาศนียบัตร",
                              )
                            )
                              action(
                                "/admin/publish",
                                { competition_id: c.id },
                                "ประกาศผลแล้ว",
                              );
                          }}
                        >
                          ประกาศผล
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editing && (
            <form
              className="score-panel"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await action(
                    "/admin/competition",
                    editing,
                    "บันทึกรายละเอียดแล้ว",
                  )
                )
                  setEditing(null);
              }}
            >
              <h2>รายละเอียดรายการแข่งขัน</h2>
              {[
                ["title", "ชื่อรายการ"],
                ["venue", "สถานที่"],
                ["schedule", "วันและเวลา"],
              ].map(([k, label]) => (
                <Field key={k} label={label}>
                  <input
                    required
                    value={editing[k]}
                    onChange={(e) =>
                      setEditing({ ...editing, [k]: e.target.value })
                    }
                  />
                </Field>
              ))}
              <Field label="รายละเอียดและเกณฑ์">
                <textarea
                  required
                  rows={5}
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </Field>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!!editing.registration_open}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      registration_open: e.target.checked,
                    })
                  }
                />
                เปิดรับสมัคร
              </label>
              <div className="form-actions">
                <Button type="button" onClick={() => setEditing(null)}>
                  ยกเลิก
                </Button>
                <Button variant="primary" disabled={busy}>
                  บันทึก
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
}
export function App() {
  const [path, setPath] = useState(location.pathname),
    [competitions, setCompetitions] = useState([]),
    [user, setUser] = useState(null),
    [authReady, setAuthReady] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(false),
    [menu, setMenu] = useState(false),
    [toast, setToast] = useState(null),
    [registrations, setRegistrations] = useState([]),
    [dataLoading, setDataLoading] = useState(false),
    [dataError, setDataError] = useState(""),
    [results, setResults] = useState([]);
  const toastTimer = useRef();
  const authReturn = useRef("/");
  const authMode = {
    "/login": "login",
    "/signup": "register",
    "/forgot-password": "forgot",
  }[path];
  function setAuthMode(mode) {
    if (!authMode && path !== "/reset-password") authReturn.current = path;
    go(
      { login: "/login", register: "/signup", forgot: "/forgot-password" }[
        mode
      ],
    );
  }
  function notify(text, error = false) {
    setToast({ text, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }
  const reload = () =>
    api("/competitions")
      .then((r) => {
        setCompetitions(r.competitions);
        setDemo(r.demo);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    api("/auth/me")
      .then((r) => setUser(r.user))
      .catch((e) => setError(e.message))
      .finally(() => setAuthReady(true));
    const f = () => {
      setPath(location.pathname);
      setMenu(false);
      setDataError("");
    };
    const expired = () => setUser(null);
    window.addEventListener("auth-expired", expired);
    window.addEventListener("popstate", f);
    return () => {
      window.removeEventListener("auth-expired", expired);
      window.removeEventListener("popstate", f);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!authReady) return;
    if (!user && !authMode && path !== "/reset-password") {
      authReturn.current = path;
      go("/login", true);
    }
  }, [authReady, user, path, authMode]);
  useEffect(() => {
    if (user) {
      setLoading(true);
      reload();
    } else {
      setCompetitions([]);
      setResults([]);
      setDemo(false);
    }
  }, [user]);
  useEffect(() => {
    if (!user) {
      setRegistrations([]);
      return;
    }
    let active = true;
    setDataLoading(true);
    api("/registrations")
      .then((r) => {
        if (active) setRegistrations(r.registrations);
      })
      .catch((e) => {
        if (active) setDataError(e.message);
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, path]);
  useEffect(() => {
    if (user && path === "/results")
      api("/results")
        .then((r) => setResults(r.results))
        .catch((e) => setDataError(e.message));
  }, [path, user]);
  function register(c) {
    if (!user) {
      authReturn.current = "/register/" + c.id;
      go("/login");
      return;
    }
    go("/register/" + c.id);
  }
  const eventId = path.split("/")[2],
    c = competitions.find((x) => x.id === eventId);
  let content;
  if (!authReady) content = <p role="status">กำลังตรวจสอบบัญชี…</p>;
  else if (authMode)
    content = (
      <AuthPage
        key={authMode}
        mode={authMode}
        setMode={setAuthMode}
        onClose={() => go(authReturn.current)}
        onUser={setUser}
      />
    );
  else if (path === "/reset-password")
    content = <ResetPassword openLogin={() => setAuthMode("login")} />;
  else if (!user) content = null;
  else if (path === "/registrations")
    content = (
      <Registrations
        rows={registrations}
        loading={dataLoading}
        error={dataError}
      />
    );
  else if (path === "/certificates")
    content = (
      <>
        <Message text={dataError} />
        <Certificates rows={registrations} notify={notify} />
      </>
    );
  else if (path === "/results")
    content = (
      <>
        <Message text={dataError} />
        <Results rows={results} competitions={competitions} />
      </>
    );
  else if (path === "/judge")
    content = ["judge", "admin"].includes(user.role) ? (
      <Judge notify={notify} />
    ) : (
      <Empty title="ไม่มีสิทธิ์เข้าถึง">เฉพาะกรรมการที่ผู้จัดมอบหมาย</Empty>
    );
  else if (path === "/admin")
    content =
      user.role === "admin" ? (
        <Admin competitions={competitions} reload={reload} notify={notify} />
      ) : (
        <Empty title="ไม่มีสิทธิ์เข้าถึง">เฉพาะผู้ดูแลระบบ</Empty>
      );
  else if (path.startsWith("/register/"))
    content =
      loading || dataLoading ? (
        <p>กำลังโหลด…</p>
      ) : c ? (
        <RegistrationForm
          key={c.id}
          c={c}
          user={user}
          existing={registrations.find((x) => x.competition_id === c.id)}
          onSaved={notify}
        />
      ) : (
        <Empty title="ไม่พบรายการแข่งขัน" />
      );
  else if (path.startsWith("/competitions/"))
    content = loading ? (
      <p>กำลังโหลด…</p>
    ) : c ? (
      <CompetitionDetail c={c} onRegister={register} />
    ) : (
      <Empty title="ไม่พบรายการแข่งขัน" />
    );
  else if (path === "/" || path === "/competitions")
    content = (
      <Directory competitions={competitions} loading={loading} error={error} />
    );
  else
    content = (
      <Empty title="ไม่พบหน้านี้">
        <button className="text-button" onClick={() => go("/")}>
          กลับหน้าแรก
        </button>
      </Empty>
    );
  return (
    <div className={"app" + (!user ? " auth-shell" : "")}>
      <a className="skip-link" href="#main">
        ข้ามไปเนื้อหา
      </a>
      <header className="topbar">
        <div className="school-brand">
          <Buildings size={43} weight="light" />
          <div>
            <strong>โรงเรียนบ้านป่าเด็ง</strong>
            <small>สพป.เพชรบุรี เขต 2</small>
          </div>
        </div>
        <div className="event-brand">
          <strong>ศิลปหัตถกรรม · ปีการศึกษา 2569</strong>
          <span>{BRAND}</span>
        </div>
        <div className="account-area">
          {user && (
            <button
              className="mobile-menu icon-button"
              aria-expanded={menu}
              aria-controls="site-sidebar"
              aria-label="เปิดเมนู"
              onClick={() => setMenu(!menu)}
            >
              <List size={25} />
            </button>
          )}
          {user ? (
            <details className="account-menu">
              <summary>
                <UserCircle size={43} weight="fill" />
                <span>
                  <strong>{user.school}</strong>
                  <small>{user.name}</small>
                </span>
                <CaretDown size={17} />
              </summary>
              <div className="account-dropdown">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
                <small>{user.school}</small>
                <hr />
                <button
                  onClick={async () => {
                    try {
                      await api("/auth/logout", {});
                      setUser(null);
                      authReturn.current = "/";
                      go("/login", true);
                      notify("ออกจากระบบแล้ว");
                    } catch (e) {
                      notify(e.message, true);
                    }
                  }}
                >
                  <SignOut size={19} />
                  ออกจากระบบ
                </button>
              </div>
            </details>
          ) : null}
        </div>
      </header>
      {user && menu && (
        <button
          className="menu-overlay"
          aria-label="ปิดเมนู"
          onClick={() => setMenu(false)}
        />
      )}
      {user && (
        <aside id="site-sidebar" className={"sidebar " + (menu ? "open" : "")}>
          <button
            className="sidebar-close icon-button"
            aria-label="ปิดแถบเมนู"
            onClick={() => setMenu(false)}
          >
            <X size={24} />
          </button>
          <nav aria-label="เมนูหลัก">
            {nav.map(([url, label, Icon]) => (
              <a
                className={
                  path === url ||
                  (url === "/competitions" &&
                    path.startsWith("/competitions/")) ||
                  (url === "/registrations" && path.startsWith("/register/"))
                    ? "active"
                    : ""
                }
                key={url}
                href={url}
                onClick={(e) => {
                  e.preventDefault();
                  go(url);
                }}
              >
                <Icon size={25} weight="regular" />
                <span>{label}</span>
              </a>
            ))}
            {user && ["judge", "admin"].includes(user.role) && (
              <>
                <div className="nav-divider" />
                <p className="nav-label">สำหรับผู้ดูแล</p>
                <a
                  href="/judge"
                  className={path === "/judge" ? "active" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    go("/judge");
                  }}
                >
                  <Star size={26} />
                  ให้คะแนน
                </a>
                {user.role === "admin" && (
                  <a
                    href="/admin"
                    className={path === "/admin" ? "active" : ""}
                    onClick={(e) => {
                      e.preventDefault();
                      go("/admin");
                    }}
                  >
                    <Users size={26} />
                    จัดการสิทธิ์
                  </a>
                )}
              </>
            )}
          </nav>
          <div className="sidebar-footer">
            <span>ศิลปหัตถกรรมนักเรียน</span>
            <small>สองพี่น้อง · ห้วยแม่เพรียง · ป่าเด็ง</small>
          </div>
        </aside>
      )}
      <main id="main" className="main">
        {user && demo && !authMode && (
          <div className="demo-note">
            <span className="badge blue">ข้อมูลตัวอย่าง</span>
            <span>เกณฑ์และกำหนดการแข่งขันรอผู้จัดยืนยัน</span>
          </div>
        )}
        {content}
        <footer className="page-footer">ศิลปหัตถกรรม · {BRAND}</footer>
      </main>
      {toast && (
        <div className={"toast " + (toast.error ? "error" : "")} role="status">
          {toast.error ? (
            <WarningCircle size={22} />
          ) : (
            <CheckCircle size={22} />
          )}
          <span>{toast.text}</span>
          <button
            className="icon-button"
            aria-label="ปิดข้อความ"
            onClick={() => setToast(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
