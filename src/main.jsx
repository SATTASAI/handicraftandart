import CompetitionRegistration from "./components/CompetitionRegistration";
import Icon from "./components/Icon";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import "./styles.css";
const labels = { coach: "ผู้ฝึกซ้อม", judge: "กรรมการ", organizer: "ผู้จัด" };
function go(path) {
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
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
    can: (r) => r.coach,
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
    key: "account",
    label: "บัญชีของฉัน",
    short: "บัญชี",
    icon: "user",
    can: () => true,
  },
];
const workspaceTabs = new Set([
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
function UsersPanel() {
  const [users, setUsers] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [organizerBusy, setOrganizerBusy] = useState(false);
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
  useEffect(() => {
    let active = true;
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
              {u.is_superadmin ? (
                <span className="badge super">ทุกสิทธิ์</span>
              ) : (
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
              )}
            </li>
          ))}
        </ul>
      )}
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
    if (key !== tab) {
      history.pushState({}, "", key === "home" ? location.pathname : "#" + key);
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
          ) : current.key === "users" ? (
            <UsersPanel />
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
    [busy, setBusy] = useState(false);
  async function load() {
    setReady(false);
    setError("");
    try {
      setUser((await api("/me")).user);
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
        go("/login");
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
    if (user && ["/login", "/signup"].includes(path)) go("/");
    if (!user && !["/login", "/signup"].includes(path)) go("/login");
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
