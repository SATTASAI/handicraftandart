import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";

const encode = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const decode = (value) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const when = (seconds) => (seconds ? new Date(seconds * 1000).toLocaleString("th-TH") : "—");

export function deviceName(agent = "") {
  const device = /iPhone/.test(agent)
    ? "iPhone"
    : /iPad/.test(agent)
      ? "iPad"
      : /Android/.test(agent)
        ? "Android"
        : /Macintosh|Mac OS X/.test(agent)
          ? "Mac"
          : /Windows/.test(agent)
            ? "Windows"
            : /Linux/.test(agent)
              ? "Linux"
              : "";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /CriOS|Chrome\//.test(agent)
      ? "Chrome"
      : /FxiOS|Firefox\//.test(agent)
        ? "Firefox"
        : /Safari\//.test(agent)
          ? "Safari"
          : "";
  return [device, browser].filter(Boolean).join(" · ") || "ไม่ทราบอุปกรณ์";
}

let turnstileScript;
function loadTurnstile() {
  turnstileScript ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  return turnstileScript;
}

// Bot check shown only when the server has Turnstile keys configured.
export function useTurnstile() {
  const box = useRef(null),
    token = useRef(""),
    widget = useRef(null);
  useEffect(() => {
    let active = true;
    api("/setup")
      .then(async ({ turnstile_site_key: sitekey }) => {
        if (!sitekey) return;
        await loadTurnstile();
        if (!active || !box.current) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey,
          callback: (value) => (token.current = value),
          "expired-callback": () => (token.current = ""),
        });
      })
      .catch(() => {});
    return () => {
      active = false;
      if (widget.current != null) window.turnstile?.remove(widget.current);
    };
  }, []);
  return {
    element: <div ref={box} className="turnstile-box" />,
    token: () => token.current,
    reset: () => {
      token.current = "";
      if (widget.current != null) window.turnstile?.reset(widget.current);
    },
  };
}

const methods = { password: "รหัสผ่าน", passkey: "Face ID", signup: "สมัครบัญชี" };

export function SecurityPanel() {
  const [passkeys, setPasskeys] = useState([]),
    [sessions, setSessions] = useState([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(null);
  const supported = typeof window.PublicKeyCredential === "function";
  async function run(action, success) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (success) setMessage({ text: success });
    } catch (error) {
      setMessage({
        error: true,
        text: error.name === "NotAllowedError" ? "ยกเลิกหรือหมดเวลา กรุณาลองใหม่" : error.message,
      });
    } finally {
      setBusy(false);
    }
  }
  const loadSessions = async () => setSessions((await api("/sessions")).sessions);
  useEffect(() => {
    run(async () => {
      setPasskeys((await api("/passkeys")).passkeys);
      await loadSessions();
    });
  }, []);
  const add = () =>
    run(async () => {
      const options = await api("/passkey/register/options", {});
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: decode(options.challenge),
          user: { ...options.user, id: decode(options.user.id) },
          excludeCredentials: options.excludeCredentials.map((item) => ({ ...item, id: decode(item.id) })),
        },
      });
      const response = credential.response;
      const key = response.getPublicKey?.();
      if (!key || !response.getAuthenticatorData) throw new Error("เบราว์เซอร์นี้ยังไม่รองรับ กรุณาอัปเดตระบบ");
      const result = await api("/passkey/register", {
        id: credential.id,
        public_key: encode(key),
        alg: response.getPublicKeyAlgorithm(),
        client_data: encode(response.clientDataJSON),
        authenticator_data: encode(response.getAuthenticatorData()),
        name: deviceName(navigator.userAgent),
      });
      setPasskeys(result.passkeys);
    }, "เปิดใช้ Face ID บนอุปกรณ์นี้แล้ว");
  const remove = (item) => {
    if (!window.confirm(`ยกเลิก Face ID ของ “${item.name}”?`)) return;
    run(async () => setPasskeys((await api("/passkey/delete", { id: item.id })).passkeys), "ยกเลิกแล้ว");
  };
  const revoke = (data, success) =>
    run(async () => {
      await api("/sessions/revoke", data);
      await loadSessions();
    }, success);
  return (
    <>
      <section className="panel">
        <h2>เข้าสู่ระบบด้วย Face ID</h2>
        <p className="muted">
          ใช้ Face ID ลายนิ้วมือ หรือรหัสล็อกเครื่องแทนรหัสผ่าน เปิดใช้แยกทีละอุปกรณ์ รหัสผ่านเดิมยังใช้ได้
        </p>
        {message && (
          <p role={message.error ? "alert" : "status"} className={message.error ? "error" : "success-message"}>
            {message.text}
          </p>
        )}
        <ul className="list-group">
          {passkeys.map((item) => (
            <li className="list-row" key={item.id}>
              <span className="list-main">
                <strong>{item.name}</strong>
                <small>
                  เปิดใช้ {when(item.created_at)} · ใช้ล่าสุด {when(item.last_used_at)}
                </small>
              </span>
              <button type="button" className="danger-button row-action" disabled={busy} onClick={() => remove(item)}>
                ยกเลิก
              </button>
            </li>
          ))}
        </ul>
        {supported ? (
          <button type="button" className="primary" disabled={busy} onClick={add}>
            เปิดใช้ Face ID บนอุปกรณ์นี้
          </button>
        ) : (
          <p className="muted">เบราว์เซอร์นี้ไม่รองรับ Face ID</p>
        )}
      </section>
      <section className="panel">
        <h2>อุปกรณ์ที่เข้าสู่ระบบอยู่</h2>
        <ul className="list-group">
          {sessions.map((item) => (
            <li className="list-row" key={item.id}>
              <span className="list-main">
                <strong>
                  {deviceName(item.user_agent)}
                  {item.current ? " (เครื่องนี้)" : ""}
                </strong>
                <small>
                  เข้าเมื่อ {when(item.created_at)}
                  {methods[item.method] ? " · ด้วย" + methods[item.method] : ""}
                  {item.ip ? " · IP " + item.ip : ""}
                </small>
              </span>
              {!item.current && (
                <button
                  type="button"
                  className="secondary row-action"
                  disabled={busy}
                  onClick={() => revoke({ id: item.id }, "ออกจากระบบอุปกรณ์นั้นแล้ว")}
                >
                  ออกจากระบบ
                </button>
              )}
            </li>
          ))}
        </ul>
        {sessions.length > 1 && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => revoke({ others: true }, "ออกจากระบบอุปกรณ์อื่นทั้งหมดแล้ว")}
          >
            ออกจากระบบอุปกรณ์อื่นทั้งหมด
          </button>
        )}
      </section>
    </>
  );
}

const reasons = { wrong: "รหัสผ่านผิด", locked: "บัญชีถูกพักชั่วคราว" };

export function LoginLog() {
  const [rows, setRows] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/admin/console/logins")
      .then((result) => setRows(result.logins))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel">
      <h1>ประวัติการเข้าสู่ระบบ</h1>
      <p className="muted">แสดง 300 รายการล่าสุด ระบบเก็บประวัติไว้ 90 วัน</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rows && !rows.length && <p className="muted">ยังไม่มีประวัติ</p>}
      <ul className="list-group">
        {(rows || []).map((row) => (
          <li className="list-row" key={row.id}>
            <span className="list-main">
              <strong>{row.name || row.email || "ไม่ทราบบัญชี"}</strong>
              <small>
                {when(row.created_at)} · {methods[row.method] || row.method} · {deviceName(row.user_agent)}
                {row.ip ? " · IP " + row.ip : ""}
              </small>
            </span>
            <span className={"badge " + (row.ok ? "status-approved" : "status-pending")}>
              {row.ok ? "สำเร็จ" : reasons[row.reason] || "Face ID ไม่ผ่าน"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
