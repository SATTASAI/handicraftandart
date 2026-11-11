import { AccountEditor, AdminOverview, PortalEditor, TrashPanel, confirmTrash } from "./components/AdminConsole";
import CompetitionRegistration from "./components/CompetitionRegistration";
import Icon from "./components/Icon";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import "./styles.css";
const labels = { coach: "ผู้ฝึกซ้อม", judge: "กรรมการ", organizer: "ผู้จัด" };
function go(path) {
  if (path === "/" || path.startsWith("/login")) {
    location.assign(path);
    return;
  }
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function signInPath() {
  const hash = location.hash;
  return sectionList.some((section) => `#${section.key}` === hash)
    ? `/login${hash}` : "/login";
}
function Link({ to, children, ...props }) {
  return (
    <a
      href={to}
      {...props}
      onClick={(e) => {
        if (
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          e.preventDefault();
          go(to);
        }
      }}
    >
      {children}
    </a>
  );
}
function Password({ signup }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      รหัสผ่าน
      <div className="password-input">
        <input
          name="password"
          type={visible ? "text" : "password"}
          required
          minLength={signup ? 12 : undefined}
          maxLength={128}
          autoComplete={signup ? "new-password" : "current-password"}
          aria-describedby={signup ? "password-help" : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-pressed={visible}
        >
          {visible ? "ซ่อน" : "แสดง"}
        </button>
      </div>
      {signup && <small id="password-help">ใช้รหัสผ่าน 12–128 ตัวอักษร</small>}
    </label>
  );
}
function Auth({ signup, onUser }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [first, setFirst] = useState(null);
  const errorRef = useRef(null);
  useEffect(() => {
    let active = true;
    api("/setup")
      .then((r) => {
        if (active) setFirst(r.firstAccountAvailable);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget),
      data = Object.fromEntries(form);
    if (signup) data.roles = form.getAll("roles");
    if (signup && !data.roles.length) {
      setError("กรุณาเลือกอย่างน้อยหนึ่งบทบาท");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await api(signup ? "/signup" : "/login", data);
      onUser(result.user);
      go("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <aside className="welcome">
        <div className="welcome-brand">
          <span className="brand-mark" aria-hidden="true">
            ศ
          </span>
          <span>
            <strong>ศิลปหัตถกรรมนักเรียน</strong>
            <small>ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง</small>
          </span>
        </div>
        <h1>เวทีแห่งความสามารถ เริ่มต้นที่นี่</h1>
        <p>ลงทะเบียนนักเรียน ตัดสิน และรับเกียรติบัตร ในแอพเดียว</p>
        <div className="welcome-note">
          <span className="note-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>หนึ่งบัญชี สองหน้าที่</strong>
            <p>เป็นผู้ฝึกซ้อมและกรรมการได้โดยใช้บัญชีเดียวกัน</p>
          </div>
        </div>
      </aside>
      <section className="auth-card" aria-labelledby="auth-title">
        <nav className="auth-switch" aria-label="เลือกหน้า">
          <Link
            to="/login"
            aria-current={!signup ? "page" : undefined}
            className={!signup ? "active" : ""}
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            to="/signup"
            aria-current={signup ? "page" : undefined}
            className={signup ? "active" : ""}
          >
            สมัครบัญชี
          </Link>
        </nav>
        <h2 id="auth-title">{signup ? "สมัครบัญชี" : "เข้าสู่ระบบ"}</h2>
        <p className="subtitle">
          {signup
            ? "กรอกข้อมูลครู แล้วเลือกหน้าที่ของคุณ"
            : "ยินดีต้อนรับกลับ เข้าสู่บัญชีของคุณเพื่อเริ่มใช้งาน"}
        </p>
        {signup && first === true && (
          <div className="notice">
            <strong>เริ่มต้นระบบใหม่</strong>
            <p>
              บัญชีแรกที่สมัครสำเร็จจะเป็น superadmin และมีสิทธิ์ทุกอย่างในระบบ
            </p>
          </div>
        )}
        {error && (
          <p className="error" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </p>
        )}
        <form
          onSubmit={submit}
          aria-busy={busy}
          onChange={() => error && setError("")}
        >
          <fieldset disabled={busy}>
            {signup && (
              <>
                <label className="field">
                  ชื่อ–นามสกุล
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="ชื่อและนามสกุลของคุณ"
                  />
                </label>
                <label className="field">
                  โรงเรียนที่สังกัด
                  <input
                    name="school"
                    autoComplete="organization"
                    required
                    minLength={2}
                    maxLength={150}
                    placeholder="เช่น โรงเรียนบ้านป่าเด็ง"
                  />
                </label>
              </>
            )}
            <label className="field">
              อีเมล
              <input
                name="email"
                type="email"
                autoComplete={signup ? "email" : "username"}
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
                placeholder="name@example.com"
              />
            </label>
            <Password signup={signup} />
            {!signup && (
              <p className="forgot-link">
                <Link to="/forgot-password">ลืมรหัสผ่าน?</Link>
              </p>
            )}
            {signup && (
              <fieldset className="role-group">
                <legend>
                  บทบาท <span>เลือกได้ทั้งสองอย่าง</span>
                </legend>
                <label className="role-option">
                  <input type="checkbox" name="roles" value="coach" />
                  <span>
                    <strong>ผู้ฝึกซ้อม</strong>
                    <small>ดูแลและพานักเรียนเข้าร่วมแข่งขัน</small>
                  </span>
                </label>
                <label className="role-option">
                  <input type="checkbox" name="roles" value="judge" />
                  <span>
                    <strong>กรรมการ</strong>
                    <small>รับหน้าที่ตัดสินการแข่งขัน</small>
                  </span>
                </label>
              </fieldset>
            )}
            <button className="primary submit" type="submit">
              {busy ? "กำลังดำเนินการ…" : signup ? "สร้างบัญชี" : "เข้าสู่ระบบ"}
            </button>
          </fieldset>
        </form>
        <p className="auth-footer">
          {signup ? "มีบัญชีอยู่แล้ว?" : "ยังไม่มีบัญชี?"}{" "}
          <Link to={signup ? "/login" : "/signup"}>
            {signup ? "เข้าสู่ระบบ" : "สมัครบัญชี"}
          </Link>
        </p>
        <p className="privacy-note">ใช้บัญชีเดียวสำหรับบทบาทที่คุณเลือก</p>
      </section>
    </div>
  );
}
function AuthCard({ title, subtitle, children }) {
  return (
    <div className="auth-screen single">
      <section className="auth-card" aria-labelledby="auth-title">
        <h2 id="auth-title">{title}</h2>
        <p className="subtitle">{subtitle}</p>
        {children}
        <p className="auth-footer">
          <Link to="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
        </p>
      </section>
    </div>
  );
}
function ForgotPassword() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await api(
        "/password/forgot",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthCard
      title="ลืมรหัสผ่าน"
      subtitle="กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้"
    >
      {sent ? (
        <div className="notice" role="status">
          <strong>ตรวจสอบอีเมลของคุณ</strong>
          <p>
            หากอีเมลนี้มีบัญชีในระบบ
            จะได้รับลิงก์ตั้งรหัสผ่านใหม่ภายในไม่กี่นาที (ลิงก์ใช้ได้ 30 นาที)
            อย่าลืมดูในโฟลเดอร์จดหมายขยะ
          </p>
        </div>
      ) : (
        <>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy}>
              <label className="field">
                อีเมล
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={254}
                  placeholder="name@example.com"
                />
              </label>
              <button className="primary submit" type="submit">
                {busy ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
              </button>
            </fieldset>
          </form>
        </>
      )}
    </AuthCard>
  );
}
function ResetPassword() {
  const [token] = useState(
      () => new URLSearchParams(location.hash.slice(1)).get("token") || "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  useEffect(() => {
    // Remove the token from the address bar and history.
    if (location.hash) history.replaceState({}, "", location.pathname);
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    if (form.get("password") !== form.get("confirm")) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api("/password/reset", { token, password: form.get("password") });
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthCard
      title="ตั้งรหัสผ่านใหม่"
      subtitle="ตั้งรหัสผ่านใหม่แล้วเข้าสู่ระบบอีกครั้ง ทุกอุปกรณ์จะถูกออกจากระบบ"
    >
      {done ? (
        <div className="notice" role="status">
          <strong>เปลี่ยนรหัสผ่านเรียบร้อย</strong>
          <p>
            <Link to="/login">เข้าสู่ระบบด้วยรหัสผ่านใหม่</Link>
          </p>
        </div>
      ) : !token ? (
        <p className="error" role="alert">
          ลิงก์ไม่ถูกต้อง กรุณา <Link to="/forgot-password">ขอลิงก์ใหม่</Link>
        </p>
      ) : (
        <>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <form
            onSubmit={submit}
            aria-busy={busy}
            onChange={() => error && setError("")}
          >
            <fieldset disabled={busy}>
              <Password signup />
              <label className="field">
                ยืนยันรหัสผ่านใหม่
                <input
                  name="confirm"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
              <button className="primary submit" type="submit">
                {busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
              </button>
            </fieldset>
          </form>
        </>
      )}
    </AuthCard>
  );
}
const sectionList = [
  {
    key: "home",
    label: "หน้าแรก",
    short: "หน้าแรก",
    icon: "home",
    can: () => true,
  },
  {
    key: "competitions",
    label: "รายการแข่งขัน",
    short: "แข่งขัน",
    icon: "grid",
    hint: "ดูเกณฑ์และเปิดใบสมัคร",
    can: () => true,
  },
  {
    key: "mine",
    label: "รายการสมัครของฉัน",
    short: "ใบสมัคร",
    icon: "clipboard",
    hint: "ติดตามสถานะการตรวจเอกสาร",
    can: (r) => r.coach,
  },
  {
    key: "review",
    label: "ตรวจเอกสาร / ยืนยัน",
    short: "ตรวจเอกสาร",
    icon: "check",
    hint: "อนุมัติหรือส่งกลับให้แก้ไข",
    can: (r) => r.reviewer,
  },
  {
    key: "judging",
    label: "ให้คะแนน (กรรมการ)",
    short: "ให้คะแนน",
    icon: "star",
    hint: "รายการที่ได้รับมอบหมาย",
    can: (r) => r.judge,
  },
  {
    key: "results",
    label: "ผลการแข่งขัน",
    short: "ผลแข่งขัน",
    icon: "trophy",
    hint: "อันดับและเหรียญรางวัล",
    can: () => true,
  },
  {
    key: "certificates",
    label: "ประกาศนียบัตร",
    short: "เกียรติบัตร",
    icon: "award",
    hint: "ดาวน์โหลดเป็น PDF",
    can: (r) => r.coach || r.judge,
  },
  {
    key: "admin",
    label: "ศูนย์จัดการหลังบ้าน",
    short: "หลังบ้าน",
    icon: "settings",
    hint: "ภาพรวมและเครื่องมือของ superadmin",
    can: (r) => r.admin,
    admin: true,
  },
  {
    key: "scoring",
    label: "จัดการคะแนนและผล",
    short: "จัดการคะแนน",
    icon: "star",
    hint: "แก้คะแนนและควบคุมการประกาศผล",
    can: (r) => r.admin,
    admin: true,
  },
  {
    key: "manage",
    label: "จัดการรายการแข่งขัน",
    short: "จัดการรายการ",
    icon: "settings",
    hint: "เพิ่ม เปิด หรือปิดรับสมัคร",
    can: (r) => r.admin,
    admin: true,
  },
  {
    key: "judges",
    label: "มอบหมายกรรมการ",
    short: "มอบหมาย",
    icon: "users",
    hint: "เลือกกรรมการรายรายการ",
    can: (r) => r.admin,
    admin: true,
  },
  {
    key: "users",
    label: "ผู้ใช้งานและสิทธิ์",
    short: "ผู้ใช้งาน",
    icon: "shield",
    hint: "มอบสิทธิ์ผู้จัดตรวจเอกสาร",
    can: (r) => r.admin,
    admin: true,
  },
  {
    key: "portal",
    label: "เนื้อหาหน้าเว็บ",
    short: "หน้าเว็บ",
    icon: "grid",
    hint: "แก้ประกาศและข่าวบนหน้าแรก",
    can: (r) => r.admin,
    admin: true,
  },
  {
    key: "trash",
    label: "ถังขยะ",
    short: "ถังขยะ",
    icon: "clipboard",
    hint: "กู้คืนหรือลบถาวร",
    can: (r) => r.admin,
    admin: true,
  },
  {
    key: "account",
    label: "บัญชีของฉัน",
    short: "บัญชี",
    icon: "user",
    can: () => true,
  },
];
const workspaceTabs = new Set([
  "scoring",
  "competitions",
  "mine",
  "review",
  "judging",
  "results",
  "certificates",
  "manage",
  "judges",
]);
function rolesOf(user) {
  return {
    admin: Boolean(user.is_superadmin),
    coach: user.is_superadmin || user.roles.includes("coach"),
    judge: user.is_superadmin || user.roles.includes("judge"),
    reviewer: Boolean(user.is_superadmin || user.is_organizer),
  };
}
// Superadmin: where ID images / certificates are stored, and moving old
// ID images out of D1 into Google Drive in small batches.
function StoragePanel() {
  const [info, setInfo] = useState(null),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/admin/storage")
      .then(setInfo)
      .catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
  }, []);
  async function migrate() {
    setBusy(true);
    setMsg("");
    try {
      let total = 0;
      for (let round = 0; round < 500; round++) {
        const r = await api("/admin/storage/migrate", {});
        total += r.moved;
        setMsg(`ย้ายแล้ว ${total} ภาพ เหลือ ${r.remaining} ภาพ`);
        if (!r.remaining || !r.moved) break;
      }
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
      load();
    }
  }
  return (
    <section className="panel">
      <h2>ที่เก็บไฟล์ (Google Drive)</h2>
      {!info ? (
        <p className="muted">{msg || "กำลังโหลด…"}</p>
      ) : (
        <>
          <p>
            {info.drive
              ? "เชื่อมต่อ Google Drive แล้ว ภาพบัตรใหม่และประกาศนียบัตรจะเก็บใน Drive"
              : "ยังไม่ได้ตั้งค่า Google Drive ภาพบัตรใหม่ยังเก็บในฐานข้อมูล D1"}
          </p>
          <p className="muted">
            ภาพบัตรใน Drive {info.documents_in_drive} · ใน D1 {info.documents_in_d1} (
            {(info.d1_document_bytes / 1048576).toFixed(1)} MB) · ประกาศนียบัตรใน Drive{" "}
            {info.certificates_in_drive} ไฟล์
          </p>
          {info.drive && info.documents_in_d1 > 0 && (
            <button className="primary" disabled={busy} onClick={migrate}>
              {busy ? "กำลังย้าย…" : "ย้ายภาพบัตรจาก D1 ไป Drive"}
            </button>
          )}
          {msg && <p role="status">{msg}</p>}
        </>
      )}
    </section>
  );
}
function UsersPanel() {
  const [editing, setEditing] = useState(null);
  const [users, setUsers] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [organizerBusy, setOrganizerBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [systemClosed, setSystemClosed] = useState(null);
  async function toggleSystem() {
    const next = !systemClosed;
    if (
      next &&
      !window.confirm(
        "ปิดใช้งานระบบ? ผู้ใช้ทุกคนยกเว้น superadmin จะใช้งานไม่ได้จนกว่าจะเปิดอีกครั้ง",
      )
    )
      return;
    setOrganizerBusy(true);
    setError("");
    try {
      const r = await api("/admin/system", { enabled: !next });
      setSystemClosed(r.system_closed);
    } catch (e) {
      setError(e.message);
    } finally {
      setOrganizerBusy(false);
    }
  }
  async function setOrganizer(id, enabled) {
    const previousUser = users.find((u) => u.id === id);
    setUsers((previous) =>
      previous.map((u) =>
        u.id === id
          ? {
              ...u,
              is_organizer: enabled,
              roles: [
                ...u.roles.filter((r) => r !== "organizer"),
                ...(enabled ? ["organizer"] : []),
              ],
            }
          : u,
      ),
    );
    setOrganizerBusy(true);
    setError("");
    try {
      const r = await api("/admin/organizers", { user_id: id, enabled });
      setUsers((previous) => previous.map((u) => (u.id === id ? r.user : u)));
    } catch (e) {
      setUsers((previous) =>
        previous.map((u) => (u.id === id ? previousUser : u)),
      );
      setError(e.message);
    } finally {
      setOrganizerBusy(false);
    }
  }
  async function deleteUser(u) {
    const confirm = confirmTrash(
      "ลบบัญชี " + u.name + " พร้อมทีมที่บัญชีนี้สมัครและคะแนนที่บัญชีนี้ให้",
    );
    if (confirm === undefined) return;
    setOrganizerBusy(true);
    setError("");
    try {
      const result = await api("/admin/users/" + u.id + "/delete", { confirm });
      setNotice(result.remaining ? `ย้ายบัญชีไปถังขยะแล้ว มีไฟล์ Drive รอลบอีก ${result.remaining} ไฟล์` : "ย้ายบัญชีไปถังขยะแล้ว");
      setUsers((previous) => previous.filter((x) => x.id !== u.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setOrganizerBusy(false);
    }
  }
  async function resetData() {
    const typed = window.prompt(
      "เริ่มการแข่งขันรอบใหม่: ลบข้อมูลรอบเดิมถาวรและสร้างรายการใหม่จากเกณฑ์ที่เก็บไว้ บัญชีผู้ใช้และเกณฑ์การแข่งขันยังอยู่\nพิมพ์คำว่า เริ่มรอบใหม่ เพื่อยืนยัน",
    );
    if (typed === null) return;
    setOrganizerBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/admin/start-new-round", { confirm: typed.trim() });
      setNotice(result.remaining
        ? `เหลือไฟล์ใน Google Drive ${result.remaining} ไฟล์ กดเริ่มรอบใหม่อีกครั้งเพื่อดำเนินการต่อ`
        : "เริ่มรอบใหม่แล้ว บัญชีและเกณฑ์การแข่งขันยังคงอยู่");
    } catch (e) {
      setError(e.message);
    } finally {
      setOrganizerBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    api("/me")
      .then((r) => active && setSystemClosed(Boolean(r.system_closed)))
      .catch(() => {});
    api("/admin/users")
      .then((r) => active && setUsers(r.users))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="user-panel" aria-labelledby="users-title">
      <div className="section-heading">
        <h2 id="users-title">ผู้ใช้งานในระบบ</h2>
        <span className="badge">{users.length} บัญชี</span>
      </div>
      <p className="muted">
        เปิดสิทธิ์ผู้จัดเพื่อให้ตรวจเอกสารและยืนยันรายการสมัครได้
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={() => setEditing("new")}>เพิ่มบัญชี</button>
      </div>
      {editing && <AccountEditor key={editing.id || "new"} account={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={(account) => {
          setUsers(rows => editing === "new" ? [...rows, account] :
            rows.map(row => row.id === account.id ? account : row));
          setEditing(null);
          setNotice("บันทึกบัญชีแล้ว");
        }} />}
      {loading ? (
        <p role="status">กำลังโหลด…</p>
      ) : (
        <ul className="list-group">
          {users.map((u) => (
            <li className="list-row" key={u.id}>
              <span className="avatar" aria-hidden="true">
                {u.name.trim().charAt(0)}
              </span>
              <span className="list-main">
                <strong>{u.name}</strong>
                <small>
                  {u.school} · {u.email}
                </small>
                <small>
                  {u.is_superadmin ? "superadmin · " : ""}
                  {u.roles.map((r) => labels[r]).join(" / ")}
                </small>
              </span>
              <button type="button" className="secondary row-action" disabled={organizerBusy}
                onClick={() => setEditing(u)} aria-label={"แก้ไขบัญชี " + u.name}>แก้ไข</button>
              {u.is_superadmin ? (
                <span className="badge super">ทุกสิทธิ์</span>
              ) : (
                <>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={Boolean(u.is_organizer)}
                      disabled={organizerBusy}
                      onChange={(e) => setOrganizer(u.id, e.target.checked)}
                      aria-label={"ให้สิทธิ์ผู้จัดตรวจเอกสารแก่ " + u.name}
                    />
                    <span aria-hidden="true">ผู้จัด</span>
                  </label>
                  <button
                    type="button"
                    className="danger-button row-action"
                    disabled={organizerBusy}
                    onClick={() => deleteUser(u)}
                    aria-label={"ลบบัญชี " + u.name}
                  >
                    ลบบัญชี
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="section-heading">
        <h2>สถานะระบบ</h2>
        {systemClosed !== null && (
          <span className="badge">{systemClosed ? "ปิดใช้งาน" : "เปิดใช้งาน"}</span>
        )}
      </div>
      <p className="muted">
        เมื่อปิดระบบ ผู้ใช้ทุกคนยกเว้น superadmin จะเข้าสู่ระบบและใช้งานไม่ได้
      </p>
      <button
        type="button"
        className={systemClosed ? "primary" : "danger-button"}
        disabled={organizerBusy || systemClosed === null}
        onClick={toggleSystem}
      >
        {systemClosed ? "เปิดใช้งานระบบ" : "ปิดใช้งานระบบ"}
      </button>
      <div className="section-heading">
        <h2>เริ่มการแข่งขันรอบใหม่</h2>
      </div>
      <p className="muted">
        ปิดระบบก่อนเริ่มรอบใหม่ ระบบจะลบทีม เอกสาร คะแนน ผลตัดสิน การมอบหมายกรรมการ
        การตั้งค่าเกียรติบัตร และรายการแข่งขันเดิม แล้วสร้างรายการใหม่จากเกณฑ์เดิม บัญชีผู้ใช้และเกณฑ์การแข่งขันยังอยู่
      </p>
      {notice && <p role="status">{notice}</p>}
      <button
        type="button"
        className="danger-button"
        disabled={organizerBusy || systemClosed !== true}
        onClick={resetData}
      >
        เริ่มรอบใหม่
      </button>
    </section>
  );
}
function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null),
    [installed, setInstalled] = useState(
      () =>
        matchMedia("(display-mode: standalone)").matches ||
        navigator.standalone === true,
    );
  useEffect(() => {
    const ready = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  return { prompt, installed, clear: () => setPrompt(null) };
}
function InstallCard() {
  const { prompt, installed, clear } = useInstallPrompt();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (installed) return null;
  if (!prompt && !ios) return null;
  return (
    <div className="install-card">
      <span className="tile-icon" aria-hidden="true">
        <Icon name="download" />
      </span>
      <div>
        <strong>ติดตั้งเป็นแอพบนมือถือ</strong>
        {prompt ? (
          <p>เปิดได้จากหน้าจอโฮม แบบเต็มจอ</p>
        ) : (
          <p>ใน Safari แตะปุ่มแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”</p>
        )}
      </div>
      {prompt && (
        <button
          className="primary"
          onClick={async () => {
            prompt.prompt();
            await prompt.userChoice.catch(() => {});
            clear();
          }}
        >
          ติดตั้ง
        </button>
      )}
    </div>
  );
}
function Home({ user, sections, onTab }) {
  const r = rolesOf(user);
  const tiles = sections.filter((s) => s.hint);
  return (
    <div className="home">
      <section className="hello-card">
        <p className="hello-school">{user.school}</p>
        <h1>สวัสดี คุณ{user.name}</h1>
        <div className="badges">
          {r.admin && <span className="badge super">superadmin</span>}
          {user.roles.map((role) => (
            <span className="badge" key={role}>
              {labels[role]}
            </span>
          ))}
        </div>
        {r.coach && (
          <button className="primary" onClick={() => onTab("competitions")}>
            ลงทะเบียนนักเรียน
          </button>
        )}
      </section>
      <InstallCard />
      <h2 className="group-title">เมนูของคุณ</h2>
      <div className="tile-grid">
        {tiles
          .filter((s) => !s.admin)
          .map((s) => (
            <button className="tile" key={s.key} onClick={() => onTab(s.key)}>
              <span className="tile-icon" aria-hidden="true">
                <Icon name={s.icon} />
              </span>
              <strong>{s.label}</strong>
              <small>{s.hint}</small>
            </button>
          ))}
      </div>
      {r.admin && (
        <>
          <h2 className="group-title">ผู้ดูแลระบบ</h2>
          <ul className="list-group">
            {tiles
              .filter((s) => s.admin)
              .map((s) => (
                <li key={s.key}>
                  <button className="list-row" onClick={() => onTab(s.key)}>
                    <span className="tile-icon" aria-hidden="true">
                      <Icon name={s.icon} />
                    </span>
                    <span className="list-main">
                      <strong>{s.label}</strong>
                      <small>{s.hint}</small>
                    </span>
                    <Icon name="chevron" size={18} />
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}
function Account({ user, onLogout, busy }) {
  const r = rolesOf(user);
  return (
    <div className="account">
      <section className="profile-card">
        <span className="avatar large" aria-hidden="true">
          {user.name.trim().charAt(0)}
        </span>
        <h2>{user.name}</h2>
        <p className="muted">{user.email}</p>
        <div className="badges">
          {r.admin && <span className="badge super">superadmin</span>}
          {user.roles.map((role) => (
            <span className="badge" key={role}>
              {labels[role]}
            </span>
          ))}
        </div>
      </section>
      <dl className="list-group detail-list">
        <div className="list-row">
          <dt>ชื่อ–นามสกุล</dt>
          <dd>{user.name}</dd>
        </div>
        <div className="list-row">
          <dt>โรงเรียนที่สังกัด</dt>
          <dd>{user.school}</dd>
        </div>
        <div className="list-row">
          <dt>อีเมล</dt>
          <dd>{user.email}</dd>
        </div>
      </dl>
      <p className="muted account-note">
        {r.admin
          ? "คุณเป็น superadmin มีสิทธิ์ทุกอย่างในระบบ"
          : "ผู้ฝึกซ้อมลงทะเบียนนักเรียนได้ ผู้จัดตรวจเอกสารและยืนยันรายการสมัคร"}
      </p>
      <InstallCard />
      <button className="danger-button" onClick={onLogout} disabled={busy}>
        <Icon name="logout" size={20} />
        {busy ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
      </button>
    </div>
  );
}
function readTab(sections) {
  const key = location.hash.slice(1);
  return sections.some((s) => s.key === key) ? key : "home";
}
function Shell({ user, onLogout, busy }) {
  const r = rolesOf(user);
  const sections = sectionList.filter((s) => s.can(r));
  const [tab, setTab] = useState(() => readTab(sections));
  const sheet = useRef(null);
  useEffect(() => {
    const sync = () => setTab(readTab(sections));
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [user.id]);
  const current = sections.find((s) => s.key === tab) || sections[0];
  useEffect(() => {
    document.title = current.label + " · ศิลปหัตถกรรม";
  }, [current.key]);
  function navigate(key) {
    sheet.current?.close();
    if (key === "home") {
      go("/");
      return;
    }
    if (key !== tab) {
        history.pushState({}, "", `/workspace#${key}`);
      setTab(key);
    }
    window.scrollTo({ top: 0 });
    document.getElementById("main")?.focus({ preventScroll: true });
  }
  const primary = ["mine", "judging", "review"].find((k) =>
    sections.some((s) => s.key === k),
  );
  const dock = ["home", "competitions", primary, "results"]
    .filter(Boolean)
    .map((k) => sections.find((s) => s.key === k));
  const inDock = dock.some((s) => s.key === tab);
  const navItem = (s, compact) => (
    <a
      key={s.key}
      href={"#" + s.key}
      className={"nav-item" + (s.key === tab ? " active" : "")}
      aria-current={s.key === tab ? "page" : undefined}
      onClick={(e) => {
        e.preventDefault();
        navigate(s.key);
      }}
    >
      <Icon name={s.icon} />
      <span>{compact ? s.short : s.label}</span>
    </a>
  );
  const userSections = sections.filter((s) => !s.admin && s.key !== "account");
  const adminSections = sections.filter((s) => s.admin);
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="เมนูหลัก">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            ศ
          </span>
          <span>
            <strong>ศิลปหัตถกรรม</strong>
            <small>ศูนย์เครือข่ายสองพี่น้อง</small>
          </span>
        </div>
        <nav className="sidebar-nav">
          {userSections.map((s) => navItem(s))}
          {adminSections.length > 0 && <p className="nav-group">ผู้ดูแลระบบ</p>}
          {adminSections.map((s) => navItem(s))}
        </nav>
        <a
          href="#account"
          className={"sidebar-user" + (tab === "account" ? " active" : "")}
          aria-current={tab === "account" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate("account");
          }}
        >
          <span className="avatar" aria-hidden="true">
            {user.name.trim().charAt(0)}
          </span>
          <span>
            <strong>{user.name}</strong>
            <small>บัญชีของฉัน</small>
          </span>
        </a>
      </aside>
      <div className="app-main">
        <header className="app-bar">
          <span className="brand-mark" aria-hidden="true">
            ศ
          </span>
          <span className="app-bar-title">
            <strong>{tab === "home" ? "ศิลปหัตถกรรม" : current.label}</strong>
            <small>ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง</small>
          </span>
          <button
            className="avatar-button"
            onClick={() => navigate("account")}
            aria-label="บัญชีของฉัน"
          >
            <span className="avatar" aria-hidden="true">
              {user.name.trim().charAt(0)}
            </span>
          </button>
        </header>
        <main id="main" tabIndex={-1} className="screen">
          {current.key === "home" ? (
            <Home user={user} sections={sections} onTab={navigate} />
          ) : current.key === "account" ? (
            <Account user={user} onLogout={onLogout} busy={busy} />
          ) : current.key === "admin" ? (
            <AdminOverview onTab={navigate} />
          ) : current.key === "portal" ? (
            <PortalEditor />
          ) : current.key === "trash" ? (
            <TrashPanel />
          ) : current.key === "users" ? (
            <>
              <UsersPanel />
              <StoragePanel />
            </>
          ) : workspaceTabs.has(current.key) ? (
            <CompetitionRegistration
              user={user}
              tab={current.key}
              onTab={navigate}
            />
          ) : null}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="เมนูหลัก">
        {dock.map((s) => navItem(s, true))}
        <button
          className={"nav-item" + (!inDock ? " active" : "")}
          onClick={() => sheet.current?.showModal()}
          aria-haspopup="dialog"
        >
          <Icon name="menu" />
          <span>เมนู</span>
        </button>
      </nav>
      <dialog
        ref={sheet}
        className="sheet"
        aria-label="เมนูทั้งหมด"
        onClick={(e) => e.target === e.currentTarget && sheet.current.close()}
      >
        <div className="sheet-body">
          <div className="sheet-handle" aria-hidden="true" />
          <div className="sheet-head">
            <strong>เมนูทั้งหมด</strong>
            <button
              className="icon-button"
              onClick={() => sheet.current.close()}
              aria-label="ปิดเมนู"
            >
              <Icon name="close" />
            </button>
          </div>
          <nav className="sheet-grid">
            {sections
              .filter((s) => s.key !== "home")
              .map((s) => navItem(s, true))}
          </nav>
          <button className="danger-button" onClick={onLogout} disabled={busy}>
            <Icon name="logout" size={20} />
            ออกจากระบบ
          </button>
        </div>
      </dialog>
    </div>
  );
}
function App() {
  const [path, setPath] = useState(location.pathname),
    [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [systemClosed, setSystemClosed] = useState(false);
  async function load() {
    setReady(false);
    setError("");
    try {
      const me = await api("/me");
      setUser(me.user);
      setSystemClosed(Boolean(me.system_closed));
    } catch (e) {
      setError(e.message);
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    load();
    const route = () => setPath(location.pathname),
      expired = () => {
        setUser(null);
        go(signInPath());
      };
    window.addEventListener("popstate", route);
    window.addEventListener("auth-expired", expired);
    return () => {
      window.removeEventListener("popstate", route);
      window.removeEventListener("auth-expired", expired);
    };
  }, []);
  useEffect(() => {
    if (!ready || error) return;
    const publicPaths = [
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
    ];
    if (user && publicPaths.includes(path)) go("/");
    if (!user && !publicPaths.includes(path)) go(signInPath());
    if (!user)
      document.title =
        (path === "/signup" ? "สมัครบัญชี" : "เข้าสู่ระบบ") + " · ศิลปหัตถกรรม";
  }, [path, user, ready, error]);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await api("/logout", {});
      setUser(null);
      go("/login");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (ready && !error && user && systemClosed && !user.is_superadmin)
    return (
      <main id="main" className="public-screen">
        <div className="panel connection-error">
          <p role="alert">ระบบปิดใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ</p>
          <button className="secondary" onClick={logout} disabled={busy}>
            ออกจากระบบ
          </button>
        </div>
      </main>
    );
  if (ready && !error && user)
    return (
      <>
        <a className="skip" href="#main">
          ข้ามไปเนื้อหา
        </a>
        <Shell user={user} onLogout={logout} busy={busy} />
      </>
    );
  return (
    <main id="main" className="public-screen">
      {!ready ? (
        <div className="splash" role="status">
          <span className="brand-mark" aria-hidden="true">
            ศ
          </span>
          <p>กำลังตรวจสอบบัญชี…</p>
        </div>
      ) : error ? (
        <div className="panel connection-error">
          <p role="alert">{error}</p>
          <button className="secondary" onClick={load}>
            ลองใหม่
          </button>
        </div>
      ) : path === "/forgot-password" ? (
        <ForgotPassword />
      ) : path === "/reset-password" ? (
        <ResetPassword />
      ) : (
        <Auth key={path} signup={path === "/signup"} onUser={setUser} />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
