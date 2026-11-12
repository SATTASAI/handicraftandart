"use strict";

const page = document.body.dataset.page;
const hash = location.hash.slice(1);
const tabs = new Set(["admin", "scoring", "competitions", "mine", "review", "judging", "results", "certificates", "manage", "judges", "users", "portal", "trash", "logins", "account"]);
const workspace = (tab) => tabs.has(tab) ? `/workspace#${tab}` : "/";
const format = (value) => Number(value).toLocaleString("th-TH");

function readSetting(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function saveSetting(key, value) {
  try { localStorage.setItem(key, value); } catch { /* The browser may block local preferences. */ }
}

async function request(path, data) {
  const response = await fetch(`/api${path}`, data === undefined ? undefined : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const value = await response.json();
  if (!response.ok) {
    const error = new Error(value.error || "ไม่สามารถดำเนินการได้ กรุณาลองใหม่");
    error.status = response.status;
    throw error;
  }
  return value;
}

function applyTheme(dark) {
  document.body.classList.toggle("dark-mode", dark);
  const toggle = document.querySelector('[data-action="theme"]');
  if (!toggle) return;
  toggle.setAttribute("aria-label", dark ? "โหมดกลางวัน" : "โหมดกลางคืน");
  toggle.querySelector("i").className = dark ? "bi bi-sun" : "bi bi-moon";
}

const cookies = document.querySelector("#cookie-consent-banner");
const settings = document.querySelector("#cookieSettingsModal");
if (cookies && !readSetting("arts-network-portal-cookies")) cookies.classList.add("show-consent");
applyTheme(readSetting("arts-network-portal-dark") === "true");

document.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]");
  if (action) {
    event.preventDefault();
    switch (action.dataset.action) {
      case "theme": {
        const dark = !document.body.classList.contains("dark-mode");
        applyTheme(dark);
        saveSetting("arts-network-portal-dark", String(dark));
        break;
      }
      case "fullscreen":
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch { /* Fullscreen is optional. */ }
        break;
      case "cookie-settings":
        if (settings) bootstrap.Modal.getOrCreateInstance(settings).show();
        break;
      case "cookie-save":
      case "cookie-accept": {
        const all = action.dataset.action === "cookie-accept";
        saveSetting("arts-network-portal-cookies", JSON.stringify({ functional: all || !!document.querySelector("#cookieFunctional")?.checked, performance: all || !!document.querySelector("#cookiePerformance")?.checked }));
        cookies?.classList.remove("show-consent");
        if (settings) bootstrap.Modal.getInstance(settings)?.hide();
        break;
      }
    }
  }
  const role = event.target.closest(".type-btn[data-type]");
  if (role) {
    document.querySelectorAll(".type-btn").forEach((button) => {
      button.classList.toggle("active", button === role);
      button.setAttribute("aria-pressed", String(button === role));
    });
    document.querySelectorAll(".login-form").forEach((form) => form.classList.toggle("active", form.id === `form-${role.dataset.type}`));
  }
});

document.addEventListener("keydown", (event) => {
  if (["Enter", " "].includes(event.key) && event.target.matches(".menu-group-header[role=button]")) {
    event.preventDefault();
    event.target.click();
  }
});

// Phone tab bar shared by every portal page.
(function appTabs() {
  if (page === "login") return;
  // Instagram-style: icons only, the current page shows the filled icon.
  const items = [
    ["/", "bi-house-door", "bi-house-door-fill", "หน้าหลัก", page === "home"],
    ["/portal/reportannounce.html", "bi-trophy", "bi-trophy-fill", "ผลการแข่งขัน", page === "reportannounce"],
    ["/portal/competition_criteria.html", "bi-journal-bookmark", "bi-journal-bookmark-fill", "เกณฑ์การแข่งขัน", page === "competition_criteria"],
    [page === "home" ? "#portalMenu" : "/#portalMenu", "bi-grid", "bi-grid-fill", "เมนูทั้งหมด", false],
    ["/login", "bi-person-circle", "bi-person-circle", "เข้าสู่ระบบ", false],
  ];
  const nav = document.createElement("nav");
  nav.className = "app-tabs";
  nav.setAttribute("aria-label", "เมนูลัด");
  for (const [href, icon, filled, label, active] of items) {
    const link = document.createElement("a");
    link.href = href;
    link.setAttribute("aria-label", label);
    link.title = label;
    if (active) link.setAttribute("aria-current", "page");
    const i = document.createElement("i");
    i.className = "bi " + (active ? filled : icon);
    i.setAttribute("aria-hidden", "true");
    link.append(i);
    nav.append(link);
  }
  // Show the tapped tab as selected straight away, before the next page loads.
  nav.addEventListener("pointerdown", (event) => {
    const link = event.target.closest("a");
    if (!link || link.hash === "#portalMenu") return;
    nav.querySelectorAll("a").forEach((other, index) => {
      const selected = other === link;
      other.toggleAttribute("aria-current", selected);
      if (selected) other.setAttribute("aria-current", "page");
      const icon = other.querySelector("i.bi");
      if (icon && items[index]) icon.className = "bi " + (selected ? items[index][2] : items[index][1]);
    });
  });
  document.body.append(nav);
})();

function setAccountLinks(user) {
  if (!user) return;
  document.querySelectorAll('a[href="/login"]').forEach((link) => {
    link.href = workspace("account");
    const icon = link.querySelector("i");
    link.replaceChildren();
    if (link.closest(".app-tabs")) {
      // Profile tab shows the account's initial in a circle, like a profile photo.
      link.setAttribute("aria-label", "บัญชีของฉัน");
      link.title = "บัญชีของฉัน";
      link.append(element("span", (user.name || "?").trim().charAt(0), "tab-avatar"));
      return;
    }
    if (icon) link.append(icon, " ");
    link.append("บัญชีของฉัน");
  });
}

if (page === "home" && tabs.has(hash)) location.replace(workspace(hash));

if (page === "login") {
  if (hash === "judging") document.querySelector('[data-type="report"]')?.click();
  if (["admin", "scoring", "manage", "users", "judges", "portal", "trash", "logins"].includes(hash)) document.querySelector('[data-type="admin"]')?.click();
  const afterLogin = (target) => location.assign(workspace(tabs.has(hash) ? hash : target === "competitions" ? "" : target));
  const encode = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const decode = (value) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const extras = document.createElement("div");
  document.querySelector(".login-form")?.parentElement.append(extras);

  // Bot check, shown only when the server has Turnstile keys configured.
  let humanToken = "";
  let humanWidget = null;
  const resetHuman = () => {
    humanToken = "";
    if (humanWidget !== null) window.turnstile?.reset(humanWidget);
  };
  request("/setup").then(({ turnstile_site_key: sitekey }) => {
    if (!sitekey) return;
    const box = element("div", "", "d-flex justify-content-center mt-3");
    extras.prepend(box);
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.onload = () => {
      humanWidget = window.turnstile.render(box, { sitekey, callback: (value) => { humanToken = value; }, "expired-callback": () => { humanToken = ""; } });
    };
    document.head.append(script);
  }).catch(() => {});

  // Face ID / fingerprint sign-in for accounts that enabled it on this device.
  if (typeof window.PublicKeyCredential === "function") {
    const button = element("button", " เข้าสู่ระบบด้วย Face ID / ลายนิ้วมือ", "btn btn-outline-primary w-100 mt-3");
    button.type = "button";
    button.prepend(element("i", "", "bi bi-person-bounding-box"));
    const alert = element("p", "", "text-danger small mt-2 mb-0");
    alert.setAttribute("role", "alert");
    alert.hidden = true;
    extras.append(button, alert);
    button.addEventListener("click", async () => {
      button.disabled = true;
      alert.hidden = true;
      try {
        const options = await request("/passkey/login/options", {});
        const credential = await navigator.credentials.get({ publicKey: { challenge: decode(options.challenge), rpId: options.rpId, userVerification: "required", timeout: options.timeout } });
        await request("/passkey/login", {
          id: credential.id,
          client_data: encode(credential.response.clientDataJSON),
          authenticator_data: encode(credential.response.authenticatorData),
          signature: encode(credential.response.signature),
        });
        afterLogin(document.querySelector(".login-form.active form")?.dataset.login || "competitions");
      } catch (error) {
        alert.textContent = error.name === "NotAllowedError" ? "ยกเลิกหรือหมดเวลา หากยังไม่เคยเปิดใช้ Face ID ให้เข้าด้วยรหัสผ่านแล้วเปิดใช้ที่หน้า “บัญชีของฉัน”" : error.message;
        alert.hidden = false;
      }
      button.disabled = false;
    });
  }

  document.querySelectorAll("[data-login]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const alert = form.querySelector('[role="alert"]');
    if (submit.disabled) return;
    submit.disabled = true;
    alert.hidden = true;
    try {
      await request("/login", { ...Object.fromEntries(new FormData(form)), turnstile: humanToken });
      afterLogin(form.dataset.login);
    } catch (error) {
      resetHuman();
      alert.textContent = error.message;
      alert.hidden = false;
      submit.disabled = false;
    }
  }));
  request("/me").then(({ user, system_closed }) => {
    if (user && (!system_closed || user.is_superadmin)) location.replace(workspace(hash));
  }).catch(() => {});
} else {
  request("/me").then(({ user }) => setAccountLinks(user)).catch(() => {});
}

function setText(selector, value) {
  if (value) document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
}

// Text the admin edits in the back office; empty fields keep the page's own wording.
function applyContent(content) {
  setText(".logo-text", content.title);
  setText(".logo-subtitle", content.subtitle);
  if (page !== "home") return;
  setText(".scrolling-text span", content.marquee);
  const hero = document.querySelector(".hero-title");
  if (hero && content.hero) {
    hero.replaceChildren();
    content.hero.split("\n").forEach((line, index) => {
      if (index) hero.append(document.createElement("br"));
      hero.append(line);
    });
  }
  const timer = document.querySelector(".countdown-timer");
  const target = Date.parse(content.countdown_at || "");
  if (timer && Number.isFinite(target)) {
    const label = timer.closest(".countdown-card")?.querySelector(".countdown-header span");
    if (label && content.countdown_label) label.textContent = content.countdown_label;
    const tick = () => {
      const left = Math.max(0, Math.floor((target - Date.now()) / 1000));
      const parts = { days: Math.floor(left / 86400), hours: Math.floor(left / 3600) % 24, minutes: Math.floor(left / 60) % 60, seconds: left % 60 };
      for (const [name, value] of Object.entries(parts)) {
        const node = timer.querySelector(`.time-value.${name}`);
        if (node) node.textContent = format(value);
      }
    };
    tick();
    setInterval(tick, 1000);
  }
  const list = document.querySelector(".news-list");
  if (list && content.news?.length) {
    list.replaceChildren(...content.news.map((item) => {
      const row = element("div", "", "news-list-item d-flex align-items-center gap-3 py-2 px-2");
      const date = Date.parse(item.date || "");
      if (Number.isFinite(date)) row.append(element("span", new Date(date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }), "badge bg-light text-primary news-date-box"));
      const safe = typeof item.url === "string" && /^(https:\/\/|\/(?!\/))/.test(item.url);
      const title = element(safe ? "a" : "span", item.title, "title-link text-decoration-none text-dark");
      if (safe) title.href = item.url;
      row.append(title);
      return row;
    }));
  }
}

const portal = request("/portal");
portal.then(({ content }) => applyContent(content || {})).catch(() => {});

if (page === "home") {
  portal.then(({ stats, system_closed }) => {
    if (system_closed) {
      document.querySelector(".scrolling-text span").textContent = "ระบบปิดใช้งานชั่วคราว";
      return;
    }
    const values = { ...stats, network: 1, people: stats.students + stats.coaches + stats.judges };
    document.querySelectorAll("[data-stat]").forEach((node) => {
      node.textContent = format(values[node.dataset.stat]);
    });
    document.querySelector(".result-stat-box.total .stat-num").textContent = format(stats.activities);
  }).catch(() => {
    document.querySelector(".scrolling-text span").textContent = "ยังโหลดสถิติไม่ได้ กรุณาลองใหม่";
  });
}

function element(tag, text, className = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function showStatus(container, error, tab) {
  const message = element("p", error.status === 401 ? "กรุณาเข้าสู่ระบบเพื่อดูข้อมูล" : error.message, "alert alert-light text-center");
  if (error.status === 401) {
    const link = element("a", "เข้าสู่ระบบ", "btn btn-primary btn-sm ms-2");
    link.href = `/login#${tab}`;
    message.append(link);
  }
  container.replaceChildren(message);
}

if (page === "reportannounce") {
  const container = document.querySelector("#live-results");
  const search = document.querySelector("#searchActivity");
  let competitions = [];
  let status = "all";
  function render() {
    const term = search.value.trim().toLowerCase();
    const groups = new Map();
    for (const entry of competitions) {
      if (status !== "all" && String(entry.published) !== status) continue;
      if (!`${entry.title} ${entry.category || ""} ${entry.grade_label || ""}`.toLowerCase().includes(term)) continue;
      const group = entry.category || "กิจกรรมอื่น ๆ";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(entry);
    }
    container.replaceChildren();
    if (!groups.size) container.append(element("p", "ยังไม่พบผลการแข่งขันตามเงื่อนไข", "alert alert-light text-center"));
    for (const [name, rows] of groups) {
      const header = element("h5", name, "category-header");
      const grid = element("div", "", "row");
      for (const entry of rows) {
        const column = element("div", "", "col-md-4 col-lg-3 mb-2 activity-card");
        const card = element("div", "", `card h-100 ${entry.published ? "announced-card" : "pending-card"}`);
        const body = element("div", "", "card-body p-2");
        body.append(element("span", entry.published ? "ประกาศผลแล้ว" : "รอประกาศ", `badge ${entry.published ? "badge-announced" : "bg-secondary"}`));
        body.append(element("p", `${entry.title} ${entry.grade_label || ""}`, "card-text mt-2 mb-2"));
        if (entry.published) {
          const link = element("a", "ดูผล", "btn btn-success btn-sm");
          link.href = `/workspace?competition=${encodeURIComponent(entry.id)}#results`;
          body.append(link);
        }
        card.append(body);
        column.append(card);
        grid.append(column);
      }
      container.append(header, grid);
    }
  }
  request("/results").then((value) => {
    competitions = value.competitions;
    render();
    search.addEventListener("input", render);
    document.querySelectorAll("[data-result-filter]").forEach((button) => button.addEventListener("click", () => {
      status = button.dataset.resultFilter;
      document.querySelectorAll("[data-result-filter]").forEach((filter) => {
        filter.classList.toggle("active", filter === button);
        filter.setAttribute("aria-pressed", String(filter === button));
      });
      render();
    }));
  }).catch((error) => showStatus(container, error, "results"));
}

if (page === "display_map_table") {
  const body = document.querySelector("#main tbody");
  const form = document.querySelector("[data-table-search]");
  const placeholder = body.firstElementChild;
  request("/competitions").then(({ competitions }) => {
    const scheduled = competitions.filter((item) => item.starts_at || item.venue);
    if (!scheduled.length) {
      placeholder.firstElementChild.textContent = "ยังไม่ประกาศกำหนดการแข่งขัน";
      return;
    }
    const rows = scheduled.map((item, index) => {
      const row = document.createElement("tr");
      for (const value of [index + 1, item.category, item.title, item.venue, item.starts_at, "—", "—"]) row.append(element("td", value || "—"));
      return row;
    });
    body.replaceChildren(...rows);
    form?.addEventListener("input", () => rows.forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(form.value.trim().toLowerCase()); }));
  }).catch((error) => showStatus(placeholder.firstElementChild, error, "competitions"));
}

if (page === "student" || page === "competition_criteria") {
  const body = document.querySelector("#main tbody");
  const placeholder = body.querySelector("td");
  request("/competitions").then(({ competitions }) => {
    if (!competitions.length) {
      placeholder.textContent = "ยังไม่มีรายการแข่งขัน";
      return;
    }
    const groups = new Map();
    for (const competition of competitions) {
      const category = competition.category || "กิจกรรมอื่น ๆ";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(competition);
    }
    const rows = page === "student"
      ? [...groups].map(([category, items], index) => [index + 1, category, items.length, items.filter((item) => item.registration_open).length])
      : competitions.map((item, index) => {
          const file = typeof item.source_url === "string" && /^\/rules\/[a-z0-9.-]+\.pdf$/i.test(item.source_url) ? item.source_url : null;
          const documentLink = element("a", file ? "ดู PDF ต้นฉบับ" : "เปิดรายการแข่งขัน", "btn btn-sm btn-outline-primary");
          documentLink.href = file || workspace("competitions");
          return [index + 1, item.category || "—", item.title, item.source_name || "—", item.source_page || "—", documentLink];
        });
    if (page === "student") {
      document.querySelector("#main thead th:last-child").textContent = "เปิดรับสมัคร";
      document.querySelector("#main .card-number").textContent = format(competitions.length);
    }
    body.replaceChildren(...rows.map((cells) => {
      const row = document.createElement("tr");
      for (const value of cells) {
        const cell = element("td", "");
        cell.append(value);
        row.append(cell);
      }
      return row;
    }));
  }).catch((error) => showStatus(placeholder, error, "competitions"));
}

// Cache the portal's static files for faster page changes (same worker the app uses).
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
