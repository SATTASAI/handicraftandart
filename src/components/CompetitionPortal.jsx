import React, { useEffect, useState } from "react";
import { api } from "../api";
import Icon from "./Icon";
import "./competitionPortal.css";

export const networkName = "ศูนย์เครือข่ายสองพี่น้อง ห้วยแม่เพรียง ป่าเด็ง";

const publicSections = [
  { key: "competitions", label: "รายการและเกณฑ์การแข่งขัน", icon: "grid" },
  { key: "results", label: "ผลการแข่งขัน", icon: "trophy" },
  { key: "certificates", label: "ประกาศนียบัตร", icon: "award" },
];
const stats = [
  ["schools", "โรงเรียนเข้าร่วม", "home"],
  ["activities", "รายการแข่งขัน", "grid"],
  ["open_activities", "เปิดรับสมัคร", "clipboard"],
  ["teams", "ทีมที่ยืนยันแล้ว", "check"],
  ["students", "นักเรียนที่ยืนยันแล้ว", "users"],
  ["judges", "กรรมการที่ได้รับมอบหมาย", "star"],
];

export function PortalHeader({ user, onTab }) {
  return (
    <header className="portal-header">
      <a className="portal-brand" href="/">
        <img src="/icons/icon-192.png" width="36" height="36" alt="" />
        <span>
          <strong>การแข่งขันศิลปหัตถกรรมนักเรียน</strong>
          <small>{networkName}</small>
        </span>
      </a>
      <nav aria-label="เมนูด้านบน">
        <a href="/">
          <Icon name="home" size={18} /> หน้าแรก
        </a>
        <PortalLink section={publicSections[1]} onTab={onTab} />
        {user ? (
          <PortalLink
            section={{ key: "account", label: "บัญชีของฉัน", icon: "user" }}
            onTab={onTab}
            className="portal-login"
          />
        ) : (
          <a className="portal-login" href="/login">
            <Icon name="user" size={18} /> เข้าสู่ระบบ
          </a>
        )}
      </nav>
    </header>
  );
}

function PortalLink({ section, onTab, className }) {
  const content = (
    <>
      <Icon name={section.icon} size={19} />
      <span>{section.label}</span>
    </>
  );
  return onTab ? (
    <button
      className={className}
      type="button"
      onClick={() => onTab(section.key)}
    >
      {content}
    </button>
  ) : (
    <a className={className} href={`/login#${section.key}`}>
      {content}
    </a>
  );
}

export default function CompetitionPortal({ user, sections, onTab, children }) {
  const [summary, setSummary] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    api("/portal")
      .then((value) => {
        if (active) setSummary(value);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const links = sections?.filter((section) => section.hint) ?? publicSections;
  const schedule = summary?.system_closed
    ? "ระบบปิดใช้งานชั่วคราว"
    : summary?.stats?.open_activities > 0
      ? "มีรายการเปิดรับสมัคร"
      : "ตรวจสอบรายการและกำหนดการในระบบ";
  return (
    <div className="competition-portal">
      <div className="portal-content">
        <section className="portal-banner" aria-labelledby="portal-title">
          <img src="/icons/icon-192.png" width="76" height="76" alt="" />
          <h1 id="portal-title">การแข่งขันศิลปหัตถกรรมนักเรียน</h1>
          <p>{networkName}</p>
          <PortalLink
            section={publicSections[0]}
            onTab={onTab}
            className="portal-hero-link"
          />
        </section>
        <div className="portal-details">
          <section
            className="portal-card portal-statistics"
            aria-labelledby="portal-stats-title"
          >
            <h2 id="portal-stats-title">
              <Icon name="grid" size={18} /> สถิติการลงทะเบียน
            </h2>
            {unavailable && <p role="status">โหลดสถิติไม่สำเร็จ</p>}
            {summary?.system_closed && (
              <p role="status">ระบบปิดใช้งานชั่วคราว</p>
            )}
            {!unavailable && !summary?.system_closed && (
              <dl aria-busy={!summary}>
                {stats.map(([key, label, icon]) => (
                  <div key={key}>
                    <dt>
                      <Icon name={icon} size={16} /> {label}
                    </dt>
                    <dd>
                      {summary?.stats?.[key]?.toLocaleString("th-TH") ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
          <div className="portal-news">
            <section className="portal-card portal-announcement">
              <Icon name="clipboard" size={26} />
              <strong>{schedule}</strong>
            </section>
            <section className="portal-card portal-intro">
              <img src="/icons/icon-192.png" width="80" height="80" alt="" />
              <h2>{networkName}</h2>
              <p>
                {user
                  ? `สวัสดี คุณ${user.name}`
                  : "ติดตามรายการแข่งขัน ผลการแข่งขัน และประกาศนียบัตร"}
              </p>
              <PortalLink
                section={publicSections[1]}
                onTab={onTab}
                className="portal-result-link"
              />
            </section>
            {children}
          </div>
        </div>
      </div>
      <aside
        className="portal-card portal-menu"
        aria-labelledby="portal-menu-title"
      >
        <h2 id="portal-menu-title">
          <Icon name="grid" size={18} /> เมนูหลัก
        </h2>
        <nav aria-label="เมนูการแข่งขัน">
          <a className="portal-menu-home" href="/" aria-current="page">
            <Icon name="home" size={19} /> หน้าแรก
          </a>
          <details open>
            <summary>
              <Icon name="grid" size={18} /> ตรวจสอบข้อมูล
            </summary>
            {links
              .filter((section) =>
                ["competitions", "mine", "review"].includes(section.key),
              )
              .map((section) => (
                <PortalLink key={section.key} section={section} onTab={onTab} />
              ))}
          </details>
          <details>
            <summary>
              <Icon name="trophy" size={18} /> ผลการแข่งขัน
            </summary>
            {links
              .filter((section) =>
                ["judging", "results", "certificates"].includes(section.key),
              )
              .map((section) => (
                <PortalLink key={section.key} section={section} onTab={onTab} />
              ))}
          </details>
          {links.some((section) => section.admin) && (
            <details>
              <summary>
                <Icon name="settings" size={18} /> ผู้ดูแลระบบ
              </summary>
              {links
                .filter((section) => section.admin)
                .map((section) => (
                  <PortalLink
                    key={section.key}
                    section={section}
                    onTab={onTab}
                  />
                ))}
            </details>
          )}
          {!user && (
            <a href="/login">
              <Icon name="user" size={19} /> เข้าสู่ระบบ
            </a>
          )}
        </nav>
      </aside>
    </div>
  );
}
