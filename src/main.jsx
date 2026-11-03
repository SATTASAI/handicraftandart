import CompetitionRegistration from "./components/CompetitionRegistration";
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
    <div className="auth-layout">
      <aside className="welcome">
        <span className="eyebrow">ศิลปหัตถกรรมนักเรียน</span>
        <h1>
          เวทีแห่งความสามารถ
          <br />
          <span>เริ่มต้นที่นี่</span>
        </h1>
        <p>
          ศูนย์เครือข่ายสองพี่น้อง
          <br />
          ห้วยแม่เพรียง · ป่าเด็ง
        </p>
        <div className="welcome-note">
          <span className="note-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>หนึ่งบัญชี สองหน้าที่</strong>
            <p>
              เป็นผู้ฝึกซ้อมและกรรมการได้
              <br />
              โดยใช้บัญชีเดียวกัน
            </p>
          </div>
        </div>
        <span className="welcome-bottom">
          เรียนรู้ · สร้างสรรค์ · เติบโตไปด้วยกัน
        </span>
      </aside>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-heading-icon" aria-hidden="true">
          {signup ? "＋" : "↪"}
        </div>
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
              {busy ? "กำลังดำเนินการ…" : signup ? "สร้างบัญชี" : "เข้าสู่ระบบ"}{" "}
              <span aria-hidden="true">→</span>
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
function Dashboard({ user, onLogout }) {
  const [users, setUsers] = useState([]),
    [error, setError] = useState("");
  const [organizerBusy, setOrganizerBusy] = useState(false);
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
    if (!user.is_superadmin) return;
    let active = true;
    api("/admin/users")
      .then((r) => {
        if (active) setUsers(r.users);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [user.id]);
  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">บัญชีของฉัน</span>
          <h1>สวัสดี คุณ{user.name}</h1>
          <p>เข้าสู่ระบบเรียบร้อยแล้ว</p>
        </div>
        {user.is_superadmin && (
          <a href="#user-management" className="secondary">
            มอบสิทธิ์ผู้จัด
          </a>
        )}
        <button className="secondary" onClick={onLogout}>
          ออกจากระบบ
        </button>
      </div>
      <CompetitionRegistration user={user} />
      <div className="dashboard-grid">
        <section className="panel">
          <h2>ข้อมูลบัญชี</h2>
          <dl>
            <dt>ชื่อ–นามสกุล</dt>
            <dd>{user.name}</dd>
            <dt>โรงเรียนที่สังกัด</dt>
            <dd>{user.school}</dd>
            <dt>อีเมล</dt>
            <dd>{user.email}</dd>
          </dl>
        </section>
        <section className="panel">
          <h2>บทบาทและสิทธิ์</h2>
          <div className="badges">
            {user.is_superadmin && (
              <span className="badge super">superadmin</span>
            )}
            {user.roles.map((role) => (
              <span className="badge" key={role}>
                {labels[role]}
              </span>
            ))}
          </div>
          <p>
            {user.is_superadmin
              ? "คุณเป็น superadmin มีสิทธิ์ทุกอย่างในระบบ"
              : "บัญชีของคุณพร้อมใช้งานตามบทบาทที่เลือก"}
          </p>
          <p className="muted">
            ผู้ฝึกซ้อมลงทะเบียนนักเรียนได้ ผู้จัดตรวจเอกสารและยืนยันรายการสมัคร
          </p>
        </section>
      </div>
      {user.is_superadmin && (
        <section id="user-management" className="panel user-panel">
          <div className="section-heading">
            <h2>ผู้ใช้งานในระบบ</h2>
            <span className="badge">{users.length} บัญชี</span>
          </div>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ชื่อ–นามสกุล</th>
                    <th>โรงเรียน</th>
                    <th>อีเมล</th>
                    <th>บทบาท</th>
                    <th>สิทธิ์</th>
                    <th>สิทธิ์ผู้จัดตรวจเอกสาร</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.school}</td>
                      <td>{u.email}</td>
                      <td>{u.roles.map((r) => labels[r]).join(" / ")}</td>
                      <td>{u.is_superadmin ? "superadmin" : "ผู้ใช้งาน"}</td>
                      <td>
                        {u.is_superadmin ? (
                          "มีสิทธิ์ทั้งหมด"
                        ) : (
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(u.is_organizer)}
                              disabled={organizerBusy}
                              onChange={(e) =>
                                setOrganizer(u.id, e.target.checked)
                              }
                              aria-label={"ให้สิทธิ์ผู้จัดแก่ " + u.name}
                            />{" "}
                            ผู้จัดตรวจเอกสาร
                          </label>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
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
    document.title =
      (user
        ? "บัญชีของฉัน"
        : path === "/signup"
          ? "สมัครบัญชี"
          : "เข้าสู่ระบบ") + " · ศิลปหัตถกรรม";
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
  return (
    <>
      <a className="skip" href="#main">
        ข้ามไปเนื้อหา
      </a>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          ศ
        </div>
        <div className="brand">
          <strong>ศิลปหัตถกรรม</strong>
          <small>ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง</small>
        </div>
        <span className="header-note">ระบบลงทะเบียนแข่งขัน</span>
      </header>
      <main id="main">
        {!ready ? (
          <p className="loading" role="status">
            กำลังตรวจสอบบัญชี…
          </p>
        ) : error ? (
          <div className="panel connection-error">
            <p role="alert">{error}</p>
            <button className="secondary" onClick={load}>
              ลองใหม่
            </button>
          </div>
        ) : user ? (
          <Dashboard user={user} onLogout={logout} />
        ) : (
          <Auth key={path} signup={path === "/signup"} onUser={setUser} />
        )}
      </main>
      <footer className="site-footer">
        ศิลปหัตถกรรมนักเรียน · ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
