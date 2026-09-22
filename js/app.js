/* =========================================================
   Civic Register — a front-end prototype
   Three roles (resident, department staff, administrator)
   sharing one ledger of reported problems, stored in
   localStorage so the whole flow can be demoed from one
   browser without a backend.
   ========================================================= */

const DB_KEY = "civic_register_db_v1";
const SESSION_KEY = "civic_register_session_v1";

const CATEGORIES = [
  "Sanitation & Waste",
  "Roads & Infrastructure",
  "Water Supply",
  "Electricity",
  "Public Safety",
  "Parks & Environment",
  "Other",
];

const PRIORITIES = ["low", "medium", "high", "critical"];
const COIN_RATE = 10; // coins per rating star, on completion + feedback
const CASH_RATE = 10; // coins per unit of currency on conversion

/* ---------------- Seed data ---------------- */

function seedDB() {
  const users = [
    { username: "citizen_raj", password: "citizen123", role: "citizen", name: "Raj Menon" },
    { username: "citizen_maya", password: "citizen123", role: "citizen", name: "Maya Iyer" },
    { username: "admin", password: "admin123", role: "admin", name: "S. Fernandes", title: "Municipal Administrator" },
    { username: "staff_amara", password: "staff123", role: "staff", name: "Amara Okoye", department: "Sanitation & Waste", workTypes: ["Waste collection", "Street cleaning"], coins: 40 },
    { username: "staff_kofi", password: "staff123", role: "staff", name: "Kofi Boateng", department: "Roads & Infrastructure", workTypes: ["Pothole repair", "Streetlight maintenance"], coins: 70 },
    { username: "staff_priya", password: "staff123", role: "staff", name: "Priya Nair", department: "Water Supply", workTypes: ["Leak repair", "Water pressure"], coins: 0 },
  ];

  const now = Date.now();
  const day = 86400000;

  const problems = [
    {
      id: "PR-1001",
      title: "Overflowing bin at Lakeview Junction",
      description: "The community bin near the bus stop has not been cleared in over a week and is overflowing onto the footpath.",
      category: "Sanitation & Waste",
      photo: null,
      citizen: "citizen_raj",
      citizenName: "Raj Menon",
      status: "completed",
      priority: "medium",
      assignedTo: "staff_amara",
      assignedToName: "Amara Okoye",
      department: "Sanitation & Waste",
      createdAt: now - 6 * day,
      assignedAt: now - 5 * day,
      completedAt: now - 3 * day,
      updates: [
        { id: "U1", text: "Assigned to sanitation crew for collection.", percent: 20, photo: null, timestamp: now - 5 * day, author: "Amara Okoye" },
        { id: "U2", text: "Bin cleared and area swept.", percent: 100, photo: null, timestamp: now - 3 * day, author: "Amara Okoye" },
      ],
      completionPhoto: null,
      rating: 4,
      feedback: "Handled quickly once assigned. Would be good to fix the collection schedule so this doesn't recur.",
      coinsAwarded: 40,
      ratedAt: now - 2 * day,
    },
    {
      id: "PR-1002",
      title: "Pothole on Church Street",
      description: "Deep pothole near the school gate is a hazard for two-wheelers, especially after rain.",
      category: "Roads & Infrastructure",
      photo: null,
      citizen: "citizen_maya",
      citizenName: "Maya Iyer",
      status: "in-progress",
      priority: "high",
      assignedTo: "staff_kofi",
      assignedToName: "Kofi Boateng",
      department: "Roads & Infrastructure",
      createdAt: now - 4 * day,
      assignedAt: now - 3 * day,
      completedAt: null,
      updates: [
        { id: "U3", text: "Site inspected, marked for patching. Materials ordered.", percent: 30, photo: null, timestamp: now - 2 * day, author: "Kofi Boateng" },
        { id: "U4", text: "Patching started, one lane open.", percent: 65, photo: null, timestamp: now - 1 * day, author: "Kofi Boateng" },
      ],
      completionPhoto: null,
      rating: null,
      feedback: null,
      coinsAwarded: null,
      ratedAt: null,
    },
    {
      id: "PR-1003",
      title: "Low water pressure, 3rd Cross Street",
      description: "Water pressure has dropped sharply for the whole street over the last three days.",
      category: "Water Supply",
      photo: null,
      citizen: "citizen_raj",
      citizenName: "Raj Menon",
      status: "submitted",
      priority: null,
      assignedTo: null,
      assignedToName: null,
      department: null,
      createdAt: now - 1 * day,
      assignedAt: null,
      completedAt: null,
      updates: [],
      completionPhoto: null,
      rating: null,
      feedback: null,
      coinsAwarded: null,
      ratedAt: null,
    },
    {
      id: "PR-1004",
      title: "Streetlight out near park entrance",
      description: "Two streetlights at the north park entrance have been dark for about a week, area feels unsafe at night.",
      category: "Public Safety",
      photo: null,
      citizen: "citizen_maya",
      citizenName: "Maya Iyer",
      status: "assigned",
      priority: "medium",
      assignedTo: "staff_kofi",
      assignedToName: "Kofi Boateng",
      department: "Roads & Infrastructure",
      createdAt: now - 2 * day,
      assignedAt: now - 1 * day,
      completedAt: null,
      updates: [],
      completionPhoto: null,
      rating: null,
      feedback: null,
      coinsAwarded: null,
      ratedAt: null,
    },
  ];

  const conversions = [
    { id: "CV-1", staff: "staff_kofi", staffName: "Kofi Boateng", coins: 30, amount: 3, timestamp: now - 4 * day },
  ];

  return { users, problems, conversions, seq: 1005 };
}

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try { return normalizeDB(JSON.parse(raw)); } catch (e) { /* fall through to reseed */ }
  }
  const db = seedDB();
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}

function normalizeDB(database) {
  database.users = Array.isArray(database.users) ? database.users : [];
  database.users.forEach(user => {
    if (user.role === "staff") {
      user.workTypes = Array.isArray(user.workTypes) ? user.workTypes : [];
      user.coins = Number(user.coins) || 0;
    }
  });
  database.problems = (Array.isArray(database.problems) ? database.problems : []).map(problem => ({
    description: "",
    photo: null,
    priority: null,
    assignedTo: null,
    assignedToName: null,
    department: null,
    assignedAt: null,
    completedAt: null,
    completionPhoto: null,
    rating: null,
    feedback: null,
    coinsAwarded: null,
    ratedAt: null,
    updates: [],
    ...problem,
    updates: Array.isArray(problem.updates) ? problem.updates : [],
  }));
  database.conversions = Array.isArray(database.conversions) ? database.conversions : [];
  database.seq = Number.isFinite(database.seq) ? database.seq : 1005;
  return database;
}

function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  if (liveSync) liveSync.postMessage(db);
}

let db = loadDB();

/* --- Live sync across tabs --- */
const liveSync = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("civic-register-live") : null;
if (liveSync) {
  liveSync.onmessage = (event) => {
    db = normalizeDB(event.data);
    pulseLiveIndicator();
    render();
  };
}
window.addEventListener("storage", (event) => {
  if (event.key === DB_KEY && event.newValue) {
    try {
      db = normalizeDB(JSON.parse(event.newValue));
      pulseLiveIndicator();
      render();
    } catch (error) { console.warn("Unable to sync saved reports.", error); }
  }
});

function pulseLiveIndicator() {
  const ind = document.querySelector(".live-indicator");
  if (!ind) return;
  ind.classList.remove("is-syncing");
  void ind.offsetWidth; // force reflow to restart animation
  ind.classList.add("is-syncing");
  setTimeout(() => ind.classList.remove("is-syncing"), 1900);
}

/* ---------------- Session ---------------- */

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}
function setSession(username) { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username })); }
function clearSession() { sessionStorage.removeItem(SESSION_KEY); }
function currentUser() {
  const s = getSession();
  if (!s) return null;
  return db.users.find(u => u.username === s.username) || null;
}

/* ---------------- UI state ---------------- */

const ui = {
  loginRoleTab: "citizen",
  view: "overview",
  detailId: null,
  reportPhoto: null,
  updatePhoto: null,
  completionPhoto: null,
  sidebarOpen: false,
};

/* ---------------- Helpers ---------------- */

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ── Dynamic #7: Relative timestamps ── */
function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return fmtDateShort(ts);
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function fmtDateShort(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toast(msg) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const t = el(`<div class="toast">${escapeHtml(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
function nextId() {
  db.seq += 1;
  return "PR-" + db.seq;
}
function statusLabel(s) {
  return { submitted: "Submitted", assigned: "Assigned", "in-progress": "In progress", completed: "Completed" }[s] || s;
}
function priorityLabel(p) {
  return p ? p[0].toUpperCase() + p.slice(1) : "Not set";
}
function resizeImageFile(file, maxDim, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height *= maxDim / width; width = maxDim; }
      else if (height > maxDim) { width *= maxDim / height; height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      cb(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function wireDropZone(zoneEl, onData) {
  zoneEl.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = () => { if (input.files[0]) resizeImageFile(input.files[0], 640, onData); };
    input.click();
  });
}

/* ── Dynamic #3 & #6: Animated counter ── */
function animateCount(el, target, duration = 900) {
  const start = performance.now();
  const from = 0;
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Dynamic #1: Progress bar builder ── */
function buildProgressBar(percent, isDone) {
  const wrap = el(`<div></div>`);
  wrap.innerHTML = `
    <div class="progress-bar-wrap">
      <div class="progress-bar-fill${isDone ? " is-done" : ""}" data-target="${percent}"></div>
    </div>
    <div class="progress-bar-label">${percent}% complete</div>
  `;
  // Animate after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = wrap.querySelector(".progress-bar-fill");
      if (fill) fill.style.width = percent + "%";
    });
  });
  return wrap;
}

/* ── Dynamic #7: Start a minute-tick to refresh relative times ── */
let _relTimerActive = false;
function startRelativeTimeRefresh() {
  if (_relTimerActive) return;
  _relTimerActive = true;
  setInterval(() => {
    document.querySelectorAll(".rel-time").forEach(el => {
      const ts = Number(el.dataset.ts);
      if (ts) el.textContent = timeAgo(ts);
    });
  }, 30000); // every 30 seconds
}

/* ---------------- Auth ---------------- */

function attemptLogin(username, password) {
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return false;
  setSession(username);
  ui.view = "overview";
  ui.detailId = null;
  return true;
}
function logout() {
  clearSession();
  ui.view = "overview";
  ui.sidebarOpen = false;
  render();
}

/* ---------------- Root render ---------------- */

function render() {
  const app = document.getElementById("app");
  const user = currentUser();
  if (!user) { app.innerHTML = ""; app.appendChild(renderLogin()); return; }
  app.innerHTML = "";
  try {
    app.appendChild(renderShell(user));
  } catch (error) {
    console.error("Smart Civic render error:", error);
    ui.detailId = null;
    app.innerHTML = `<div class="render-recovery"><h2>We couldn't open that report.</h2><p>Your workspace is still available. Please return to your assignments and try again.</p><button class="btn btn--primary" type="button">Back to assignments</button></div>`;
    app.querySelector("button").addEventListener("click", render);
  }
  startRelativeTimeRefresh();
}

/* ---------------- Login screen ---------------- */

const DEMO_ACCOUNTS = {
  citizen: [
    { u: "citizen_raj", p: "citizen123", label: "Raj Menon" },
    { u: "citizen_maya", p: "citizen123", label: "Maya Iyer" },
  ],
  staff: [
    { u: "staff_amara", p: "staff123", label: "Amara Okoye · Sanitation" },
    { u: "staff_kofi", p: "staff123", label: "Kofi Boateng · Roads" },
    { u: "staff_priya", p: "staff123", label: "Priya Nair · Water" },
  ],
  admin: [
    { u: "admin", p: "admin123", label: "S. Fernandes" },
  ],
};

function renderLogin() {
  const tpl = document.getElementById("tpl-login").content.cloneNode(true);
  const wrap = el("<div></div>");
  wrap.appendChild(tpl);

  const tabs = wrap.querySelectorAll(".role-tab");
  const demoBox = wrap.querySelector("#login-demo");
  const form = wrap.querySelector("#login-form");
  const errorEl = wrap.querySelector("#login-error");

  function renderDemo() {
    const list = DEMO_ACCOUNTS[ui.loginRoleTab];
    demoBox.innerHTML = `<h4>Demo accounts — ${ui.loginRoleTab === "citizen" ? "resident" : ui.loginRoleTab}</h4>
      <table>${list.map(a => `
        <tr>
          <td class="role">${escapeHtml(a.label)}</td>
          <td><button type="button" class="fill" data-u="${a.u}" data-p="${a.p}">${a.u} / ${a.p}</button></td>
        </tr>`).join("")}</table>`;
    demoBox.querySelectorAll("button.fill").forEach(b => {
      b.addEventListener("click", () => {
        wrap.querySelector("#login-username").value = b.dataset.u;
        wrap.querySelector("#login-password").value = b.dataset.p;
      });
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      ui.loginRoleTab = tab.dataset.role;
      renderDemo();
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = wrap.querySelector("#login-username").value.trim();
    const p = wrap.querySelector("#login-password").value;
    if (attemptLogin(u, p)) { render(); }
    else { errorEl.hidden = false; errorEl.textContent = "Username or password not recognized."; }
  });

  renderDemo();
  return wrap;
}

/* ---------------- Shared shell (topbar + sidebar) ---------------- */

const NAV = {
  citizen: [
    { id: "overview", label: "My reports" },
    { id: "new", label: "Report a problem" },
    { id: "profile", label: "My profile" },
  ],
  staff: [
    { id: "overview", label: "My assignments" },
    { id: "history", label: "Completed by me" },
    { id: "wallet", label: "My coin wallet" },
    { id: "profile", label: "My profile" },
  ],
  admin: [
    { id: "overview", label: "Overview" },
    { id: "triage", label: "Triage inbox" },
    { id: "assigned", label: "Assigned work" },
    { id: "staff", label: "Staff directory" },
    { id: "rewards", label: "Rewards & payouts" },
    { id: "profile", label: "My profile" },
  ],
};

const ROLE_TITLE = { citizen: "Resident", staff: "Department staff", admin: "Administrator" };

function navCounts(user) {
  if (user.role === "citizen") {
    return {
      overview: db.problems.filter(p => p.citizen === user.username).length,
      new: null,
      profile: null,
    };
  }
  if (user.role === "staff") {
    return {
      overview: db.problems.filter(p => p.assignedTo === user.username && p.status !== "completed").length,
      history: db.problems.filter(p => p.assignedTo === user.username && p.status === "completed").length,
      wallet: null,
      profile: null,
    };
  }
  return {
    overview: null,
    triage: db.problems.filter(p => p.status === "submitted").length,
    assigned: db.problems.filter(p => p.status === "assigned" || p.status === "in-progress").length,
    staff: db.users.filter(u => u.role === "staff").length,
    rewards: null,
    profile: null,
  };
}

function renderShell(user) {
  const wrap = el(`<div class="shell"></div>`);
  const counts = navCounts(user);

  /* ── Dynamic #9: Hamburger + sidebar overlay ── */
  document.querySelectorAll(".sidebar-overlay").forEach(o => o.remove());
  const overlay = el(`<div class="sidebar-overlay" id="sidebar-overlay"></div>`);
  document.body.appendChild(overlay);


  const topbar = el(`
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="hamburger-btn" id="hamburger-btn" aria-label="Toggle navigation">
          <span></span><span></span><span></span>
        </button>
        <div class="topbar__brand"><span class="glyph">SC</span> Smart Civic</div>
      </div>
      <div class="topbar__right">
        <div class="live-indicator" title="Report changes sync across open tabs"><span></span>Live</div>
        <div style="text-align:right">
          <div class="topbar__user">${escapeHtml(user.name)}</div>
          <div class="topbar__role">${ROLE_TITLE[user.role].toUpperCase()}${user.department ? " · " + escapeHtml(user.department) : ""}</div>
        </div>
        <button class="btn btn--ghost btn--sm" id="logout-btn">Sign out</button>
      </div>
    </div>
  `);
  topbar.querySelector("#logout-btn").addEventListener("click", logout);

  const hamburger = topbar.querySelector("#hamburger-btn");
  function toggleSidebar() {
    ui.sidebarOpen = !ui.sidebarOpen;
    hamburger.classList.toggle("is-open", ui.sidebarOpen);
    sidebar.classList.toggle("is-open", ui.sidebarOpen);
    overlay.classList.toggle("is-open", ui.sidebarOpen);
  }
  hamburger.addEventListener("click", toggleSidebar);
  overlay.addEventListener("click", () => {
    ui.sidebarOpen = false;
    hamburger.classList.remove("is-open");
    sidebar.classList.remove("is-open");
    overlay.classList.remove("is-open");
  });

  wrap.appendChild(topbar);

  const sidebar = el(`<div class="sidebar"></div>`);
  if (ui.sidebarOpen) sidebar.classList.add("is-open");

  NAV[user.role].forEach(item => {
    const count = counts[item.id];
    const btn = el(`
      <button class="nav-item ${ui.view === item.id ? "is-active" : ""}" data-view="${item.id}">
        <span>${item.label}</span>
        ${count !== null && count !== undefined ? `<span class="count">${count}</span>` : ""}
      </button>
    `);
    btn.addEventListener("click", () => {
      ui.view = item.id;
      ui.detailId = null;
      ui.sidebarOpen = false;
      overlay.classList.remove("is-open");
      render();
    });
    sidebar.appendChild(btn);
  });
  sidebar.appendChild(el(`<div class="sidebar__foot">Smart Civic is a demo prototype. All data lives only in this browser's local storage.</div>`));
  wrap.appendChild(sidebar);

  const main = el(`<div class="main"></div>`);
  if (user.role === "citizen") renderCitizen(main, user);
  if (user.role === "staff") renderStaff(main, user);
  if (user.role === "admin") renderAdmin(main, user);
  wrap.appendChild(main);

  if (ui.detailId) {
    const problem = db.problems.find(p => p.id === ui.detailId);
    if (problem) {
      try {
        wrap.appendChild(renderDrawer(problem, user));
      } catch (error) {
        console.error("Unable to open report details:", error);
        ui.detailId = null;
        setTimeout(() => toast("This report has incomplete saved data. Please refresh and try again."), 0);
      }
    }
  }

  /* ── Dynamic #5: Escape key closes drawer or sidebar ── */
  if (window._escHandler) document.removeEventListener("keydown", window._escHandler);
  window._escHandler = (e) => {
    if (e.key === "Escape") {
      if (ui.detailId) {
        closeDrawer(document.querySelector(".shell"));
      } else if (ui.sidebarOpen) {
        ui.sidebarOpen = false;
        hamburger.classList.remove("is-open");
        sidebar.classList.remove("is-open");
        overlay.classList.remove("is-open");
      }
    }
  };
  document.addEventListener("keydown", window._escHandler);

  return wrap;

}

/* ── Dynamic #5: Smooth drawer slide-out ── */
function closeDrawer(shellEl) {
  const drawerEl = shellEl ? shellEl.querySelector(".drawer") : document.querySelector(".drawer");
  if (!drawerEl) {
    ui.detailId = null;
    ui.updatePhoto = null;
    ui.completionPhoto = null;
    render();
    return;
  }
  drawerEl.classList.add("is-closing");
  drawerEl.addEventListener("animationend", () => {
    ui.detailId = null;
    ui.updatePhoto = null;
    ui.completionPhoto = null;
    render();
  }, { once: true });
}

/* ---------------- Ledger row + tag helpers ---------------- */

function tagStatus(status) {
  const cls = { submitted: "submitted", assigned: "assigned", "in-progress": "progress", completed: "completed" }[status];
  return `<span class="tag tag--status-${cls}">${statusLabel(status)}</span>`;
}
function tagPriority(priority) {
  if (!priority) return `<span class="tag tag--priority-low">Not triaged</span>`;
  return `<span class="tag tag--priority-${priority}">${priorityLabel(priority)} priority</span>`;
}

/* ── Dynamic #1: Progress bar on ledger row ── */
function latestPercent(p) {
  if (p.status === "completed") return 100;
  if (!p.updates || !p.updates.length) return 0;
  return p.updates[p.updates.length - 1].percent || 0;
}

function ledgerRow(p, opts = {}) {
  const pct = latestPercent(p);
  const isDone = p.status === "completed";
  const row = el(`
    <div class="ledger-row" data-id="${p.id}">
      <div class="ledger-row__id">${p.id}</div>
      <div class="ledger-row__body">
        <div class="ledger-row__title"></div>
        <div class="ledger-row__meta">
          <span>${escapeHtml(p.category)}</span>
          <span>·</span>
          <span class="rel-time" data-ts="${opts.showCitizen ? "" : p.createdAt}" title="${fmtDate(p.createdAt)}">
            ${opts.showCitizen ? "Reported by " + escapeHtml(p.citizenName) : timeAgo(p.createdAt)}
          </span>
          ${opts.showAssignee ? `<span>·</span><span>${p.assignedToName ? "Assigned to " + escapeHtml(p.assignedToName) : "Unassigned"}</span>` : ""}
        </div>
        ${(pct > 0 || isDone) ? `<div class="progress-bar-wrap" style="margin-top:6px;"><div class="progress-bar-fill${isDone ? " is-done" : ""}" data-target="${pct}"></div></div>` : ""}
      </div>
      <div class="ledger-row__side">
        ${tagStatus(p.status)}
        ${tagPriority(p.priority)}
      </div>
    </div>
  `);

  // Animate progress bar
  if (pct > 0 || isDone) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fill = row.querySelector(".progress-bar-fill");
      if (fill) fill.style.width = pct + "%";
    }));
  }

  row.addEventListener("click", () => { ui.detailId = p.id; render(); });
  return row;
}

function renderLedger(list, opts) {
  if (!list.length) {
    return el(`<div class="ledger"><div class="ledger-empty">Nothing here yet.</div></div>`);
  }
  const wrap = el(`<div class="ledger"></div>`);
  list.forEach(p => wrap.appendChild(ledgerRow(p, opts)));
  return wrap;
}

/* ---------------- Personal profiles ---------------- */
function renderProfile(main, user) {
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const roleSummary = user.role === "citizen"
    ? `${db.problems.filter(problem => problem.citizen === user.username).length} reports submitted`
    : user.role === "staff"
      ? `${db.problems.filter(problem => problem.assignedTo === user.username && problem.status === "completed").length} jobs completed`
      : `${db.problems.length} city reports managed`;
  const roleDetail = user.role === "staff"
    ? `<div class="profile-readonly"><span>Department</span><strong>${escapeHtml(user.department)}</strong></div><div class="profile-readonly"><span>Work specialties</span><strong>${(user.workTypes || []).length ? user.workTypes.map(escapeHtml).join(", ") : "Not recorded"}</strong></div>`
    : user.role === "admin"
      ? `<div class="profile-readonly"><span>Access level</span><strong>${escapeHtml(user.title || "Municipal Administrator")}</strong></div><div class="profile-readonly"><span>Scope</span><strong>All departments</strong></div>`
      : `<div class="profile-readonly"><span>Account type</span><strong>Resident account</strong></div><div class="profile-readonly"><span>Report visibility</span><strong>Only your submitted reports</strong></div>`;

  main.appendChild(el(`<div class="page-head"><div><h2>My profile</h2><p class="sub">Your personal account and role information.</p></div></div>`));
  const layout = el(`<div class="profile-layout"></div>`);
  layout.appendChild(el(`<aside class="profile-identity"><div class="profile-avatar">${escapeHtml(initials || "SC")}</div><h3>${escapeHtml(user.name)}</h3><p>${ROLE_TITLE[user.role]}</p><div class="profile-summary">${roleSummary}</div><div class="profile-username">@${escapeHtml(user.username)}</div></aside>`));

  const panel = el(`<section class="panel profile-details"><h3>Account details</h3></section>`);
  panel.insertAdjacentHTML("beforeend", `
    <div class="grid-2">
      <div class="field"><span class="label">Display name</span><input type="text" id="profile-name" value="${escapeHtml(user.name)}" /></div>
      <div class="field"><span class="label">Username</span><input type="text" value="${escapeHtml(user.username)}" disabled /></div>
    </div>
    <div class="grid-2">
      <div class="field"><span class="label">Email <small>(optional)</small></span><input type="text" id="profile-email" value="${escapeHtml(user.email || "")}" placeholder="name@example.com" /></div>
      <div class="field"><span class="label">Phone <small>(optional)</small></span><input type="text" id="profile-phone" value="${escapeHtml(user.phone || "")}" placeholder="+91 ..." /></div>
    </div>
    <div class="profile-role-details">${roleDetail}</div>
    <hr class="divider" />
    <div class="field"><span class="label">New password <small>(leave empty to keep current password)</small></span><input type="password" id="profile-password" placeholder="New password" autocomplete="new-password" /></div>
    <button class="btn btn--primary" type="button" id="save-profile-btn">Save profile</button>
  `);
  panel.querySelector("#save-profile-btn").addEventListener("click", () => {
    const name = panel.querySelector("#profile-name").value.trim();
    const email = panel.querySelector("#profile-email").value.trim();
    const phone = panel.querySelector("#profile-phone").value.trim();
    const password = panel.querySelector("#profile-password").value;
    if (!name) { toast("Enter a display name."); return; }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { toast("Enter a valid email address."); return; }
    user.name = name; user.email = email; user.phone = phone;
    if (password) user.password = password;
    saveDB(); toast("Your profile was updated."); render();
  });
  layout.appendChild(panel);
  main.appendChild(layout);
}

/* ============================================================
   CITIZEN
   ============================================================ */

function renderCitizen(main, user) {
  if (ui.view === "profile") return renderProfile(main, user);
  if (ui.view === "new") return renderCitizenNew(main, user);
  renderCitizenOverview(main, user);
}

function renderCitizenOverview(main, user) {
  const mine = db.problems.filter(p => p.citizen === user.username).sort((a, b) => b.createdAt - a.createdAt);
  main.appendChild(el(`
    <div class="page-head">
      <div><h2>My reports</h2><p class="sub">Every problem you've submitted, and where it stands.</p></div>
      <button class="btn btn--ochre" id="new-report-btn">Report a problem</button>
    </div>
  `));
  main.querySelector("#new-report-btn").addEventListener("click", () => { ui.view = "new"; render(); });

  const awaitingRating = mine.filter(p => p.status === "completed" && p.rating === null);
  if (awaitingRating.length) {
    main.appendChild(el(`<div class="panel" style="border-color:var(--amber); background: var(--amber-soft); margin-bottom:20px;">
      <strong>${awaitingRating.length} completed report${awaitingRating.length > 1 ? "s" : ""} waiting on your feedback.</strong>
      <div style="margin-top:4px; font-size:13px; color:var(--ink-soft);">Open a completed report below to rate the service and leave feedback.</div>
    </div>`));
  }

  main.appendChild(renderFilteredLedger(mine, { label: "My reports" }));
}

function renderCitizenNew(main, user) {
  main.appendChild(el(`
    <div class="page-head">
      <div><h2>Report a problem</h2><p class="sub">Describe the issue clearly — this goes straight to the administrator's triage inbox.</p></div>
      <button class="btn btn--ghost" id="back-btn">← Back to my reports</button>
    </div>
  `));
  main.querySelector("#back-btn").addEventListener("click", () => { ui.view = "overview"; ui.reportPhoto = null; render(); });

  const panel = el(`<div class="panel"></div>`);
  panel.innerHTML = `
    <div class="field">
      <span class="label">Title</span>
      <input type="text" id="f-title" placeholder="Short summary of the problem" maxlength="120" />
      <div class="char-counter" id="title-counter">0 / 120</div>
    </div>
    <div class="field"><span class="label">Category</span>
      <select id="f-category">${CATEGORIES.map(c => `<option>${c}</option>`).join("")}</select>
    </div>
    <div class="field">
      <span class="label">Description</span>
      <textarea id="f-desc" placeholder="What's wrong, where exactly, and since when?" maxlength="800"></textarea>
      <div class="char-counter" id="desc-counter">0 / 800</div>
    </div>
    <div class="field">
      <span class="label">Photo (optional)</span>
      <div class="photo-drop" id="f-photo-drop">Click to attach a photo of the problem</div>
      <div class="photo-preview" id="f-photo-preview"></div>
    </div>
    <button class="btn btn--primary" id="f-submit">Submit report</button>
  `;
  main.appendChild(panel);

  /* ── Dynamic #4: Character counters ── */
  const titleInput = panel.querySelector("#f-title");
  const titleCounter = panel.querySelector("#title-counter");
  const descInput = panel.querySelector("#f-desc");
  const descCounter = panel.querySelector("#desc-counter");

  function updateCounter(input, counter, max) {
    const len = input.value.length;
    counter.textContent = `${len} / ${max}`;
    counter.className = "char-counter" + (len > max * 0.9 ? (len >= max ? " is-over" : " is-warn") : "");
  }
  titleInput.addEventListener("input", () => updateCounter(titleInput, titleCounter, 120));
  descInput.addEventListener("input", () => updateCounter(descInput, descCounter, 800));

  const preview = panel.querySelector("#f-photo-preview");
  function refreshPreview() {
    preview.innerHTML = ui.reportPhoto ? `<img src="${ui.reportPhoto}" alt="Attached photo" />` : "";
  }
  wireDropZone(panel.querySelector("#f-photo-drop"), (dataUrl) => { ui.reportPhoto = dataUrl; refreshPreview(); });
  refreshPreview();

  panel.querySelector("#f-submit").addEventListener("click", () => {
    const title = panel.querySelector("#f-title").value.trim();
    const desc = panel.querySelector("#f-desc").value.trim();
    const category = panel.querySelector("#f-category").value;
    if (!title || !desc) { toast("Add a title and description before submitting."); return; }
    const problem = {
      id: nextId(), title, description: desc, category, photo: ui.reportPhoto || null,
      citizen: user.username, citizenName: user.name,
      status: "submitted", priority: null,
      assignedTo: null, assignedToName: null, department: null,
      createdAt: Date.now(), assignedAt: null, completedAt: null,
      updates: [], completionPhoto: null,
      rating: null, feedback: null, coinsAwarded: null, ratedAt: null,
    };
    db.problems.unshift(problem);
    saveDB();
    ui.reportPhoto = null;
    ui.view = "overview";
    toast("Report submitted — the administrator will review it shortly.");
    render();
  });
}

/* ============================================================
   STAFF
   ============================================================ */

function renderStaff(main, user) {
  if (ui.view === "profile") return renderProfile(main, user);
  if (ui.view === "wallet") return renderStaffWallet(main, user);
  if (ui.view === "history") return renderStaffHistory(main, user);
  renderStaffOverview(main, user);
}

function renderStaffOverview(main, user) {
  const mine = db.problems.filter(p => p.assignedTo === user.username && p.status !== "completed")
    .sort((a, b) => (a.priority === "critical" ? -1 : 1) - (b.priority === "critical" ? -1 : 1) || a.createdAt - b.createdAt);
  main.appendChild(el(`
    <div class="page-head">
      <div><h2>My assignments</h2><p class="sub">Problems assigned to you in ${escapeHtml(user.department)} that still need work.</p></div>
    </div>
  `));
  main.appendChild(renderFilteredLedger(mine, { showCitizen: true, label: "My assignments" }));
}

function renderStaffHistory(main, user) {
  const done = db.problems.filter(p => p.assignedTo === user.username && p.status === "completed").sort((a, b) => b.completedAt - a.completedAt);
  main.appendChild(el(`
    <div class="page-head"><div><h2>Completed by me</h2><p class="sub">Your finished work and the ratings residents gave it.</p></div></div>
  `));
  main.appendChild(renderFilteredLedger(done, { showCitizen: true, label: "Completed work" }));
}

function renderStaffWallet(main, user) {
  main.appendChild(el(`
    <div class="page-head"><div><h2>My coin wallet</h2><p class="sub">Coins are awarded when a resident rates your completed work. The administrator converts coins to payout.</p></div></div>
  `));

  /* ── Dynamic #3: Animated coin counter ── */
  const completed = db.problems.filter(p => p.assignedTo === user.username && p.status === "completed").length;
  const avgVal = avgRating(user.username);
  const strip = el(`
    <div class="stat-strip">
      <div class="stat accent"><div class="n anim-counter" id="coin-count">0</div><div class="l">Coin balance</div></div>
      <div class="stat"><div class="n anim-counter" id="jobs-count">0</div><div class="l">Jobs completed</div></div>
      <div class="stat"><div class="n">${avgVal ?? "—"}</div><div class="l">Average rating</div></div>
    </div>
  `);
  main.appendChild(strip);
  requestAnimationFrame(() => {
    animateCount(strip.querySelector("#coin-count"), user.coins, 900);
    animateCount(strip.querySelector("#jobs-count"), completed, 700);
  });

  const earned = db.problems.filter(p => p.assignedTo === user.username && p.coinsAwarded).sort((a, b) => b.ratedAt - a.ratedAt);
  const spent = db.conversions.filter(c => c.staff === user.username).sort((a, b) => b.timestamp - a.timestamp);

  const panel = el(`<div class="panel"><h3>Coin history</h3></div>`);
  const rows = [
    ...earned.map(p => ({ ts: p.ratedAt, text: `Earned for "${p.title}" (${p.rating}★ rating)`, delta: `+${p.coinsAwarded}` })),
    ...spent.map(c => ({ ts: c.timestamp, text: `Converted to payout by administrator`, delta: `-${c.coins}` })),
  ].sort((a, b) => b.ts - a.ts);

  if (!rows.length) {
    panel.appendChild(el(`<p style="color:var(--ink-faint); font-size:13.5px;">No coin activity yet.</p>`));
  } else {
    const table = el(`<table class="table-mini"><thead><tr><th>Date</th><th>Activity</th><th style="text-align:right;">Coins</th></tr></thead><tbody></tbody></table>`);
    const body = table.querySelector("tbody");
    rows.forEach(r => body.appendChild(el(`<tr><td class="rel-time" data-ts="${r.ts}" title="${fmtDateShort(r.ts)}">${timeAgo(r.ts)}</td><td>${escapeHtml(r.text)}</td><td style="text-align:right;" class="coin">${r.delta}</td></tr>`)));
    panel.appendChild(table);
  }
  main.appendChild(panel);
}

function avgRating(staffUsername) {
  const rated = db.problems.filter(p => p.assignedTo === staffUsername && p.rating);
  if (!rated.length) return null;
  return (rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1);
}

/* ============================================================
   ADMIN
   ============================================================ */

function renderAdmin(main, user) {
  if (ui.view === "profile") return renderProfile(main, user);
  if (ui.view === "triage") return renderAdminTriage(main, user);
  if (ui.view === "assigned") return renderAdminAssigned(main, user);
  if (ui.view === "staff") return renderAdminStaff(main, user);
  if (ui.view === "rewards") return renderAdminRewards(main, user);
  renderAdminOverview(main, user);
}

function renderAdminOverview(main, user) {
  const total = db.problems.length;
  const submitted = db.problems.filter(p => p.status === "submitted").length;
  const active = db.problems.filter(p => p.status === "assigned" || p.status === "in-progress").length;
  const completed = db.problems.filter(p => p.status === "completed").length;
  const rated = db.problems.filter(p => p.rating);
  const avg = rated.length ? (rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1) : "—";

  main.appendChild(el(`
    <div class="page-head"><div><h2>Overview</h2><p class="sub">City-wide status across all departments.</p></div></div>
  `));

  /* ── Dynamic #6: Animated stat counters ── */
  const strip = el(`
    <div class="stat-strip">
      <div class="stat"><div class="n anim-counter" id="s-total">0</div><div class="l">Total reports</div></div>
      <div class="stat accent"><div class="n anim-counter" id="s-submitted">0</div><div class="l">Awaiting triage</div></div>
      <div class="stat"><div class="n anim-counter" id="s-active">0</div><div class="l">In progress</div></div>
      <div class="stat"><div class="n anim-counter" id="s-done">0</div><div class="l">Completed</div></div>
      <div class="stat"><div class="n">${avg}</div><div class="l">Average rating</div></div>
    </div>
  `);
  main.appendChild(strip);
  requestAnimationFrame(() => {
    animateCount(strip.querySelector("#s-total"), total, 800);
    animateCount(strip.querySelector("#s-submitted"), submitted, 600);
    animateCount(strip.querySelector("#s-active"), active, 700);
    animateCount(strip.querySelector("#s-done"), completed, 750);
  });

  main.appendChild(el(`<h3 style="margin-bottom:12px;">Recent activity</h3>`));
  const recent = [...db.problems].sort((a, b) => (b.ratedAt || b.completedAt || b.assignedAt || b.createdAt) - (a.ratedAt || a.completedAt || a.assignedAt || a.createdAt)).slice(0, 8);
  main.appendChild(renderFilteredLedger(recent, { showCitizen: true, showAssignee: true, label: "Recent activity" }));
}

function renderAdminTriage(main, user) {
  const inbox = db.problems.filter(p => p.status === "submitted").sort((a, b) => a.createdAt - b.createdAt);
  main.appendChild(el(`
    <div class="page-head"><div><h2>Triage inbox</h2><p class="sub">New reports — set a priority and assign to a department staff member.</p></div></div>
  `));
  main.appendChild(renderFilteredLedger(inbox, { showCitizen: true, label: "Triage inbox" }));
}

function renderAdminAssigned(main, user) {
  const active = db.problems.filter(p => p.status === "assigned" || p.status === "in-progress").sort((a, b) => a.assignedAt - b.assignedAt);
  main.appendChild(el(`
    <div class="page-head"><div><h2>Assigned work</h2><p class="sub">Everything currently with a department, and its progress.</p></div></div>
  `));
  main.appendChild(renderFilteredLedger(active, { showCitizen: true, showAssignee: true, label: "Assigned work" }));
}

function renderAdminStaff(main, user) {
  const staff = db.users.filter(u => u.role === "staff").sort((a, b) => a.name.localeCompare(b.name));
  main.appendChild(el(`
    <div class="page-head"><div><h2>Staff directory</h2><p class="sub">Add department staff, record their specialties, and review the work they have completed.</p></div></div>
  `));

  const form = el(`<div class="panel staff-form"><h3>Add department staff</h3></div>`);
  form.insertAdjacentHTML("beforeend", `
    <div class="grid-2">
      <div class="field"><span class="label">Full name</span><input type="text" id="staff-name" placeholder="e.g. Arun Kumar" /></div>
      <div class="field"><span class="label">Department</span><select id="staff-department">${CATEGORIES.map(c => `<option>${escapeHtml(c)}</option>`).join("")}</select></div>
    </div>
    <div class="field"><span class="label">Work specialties</span><input type="text" id="staff-work-types" placeholder="e.g. Pothole repair, Drain cleaning" /><span class="hint">Separate multiple work types with commas.</span></div>
    <div class="grid-2">
      <div class="field"><span class="label">Username</span><input type="text" id="staff-username" placeholder="e.g. staff_arun" /></div>
      <div class="field"><span class="label">Temporary password</span><input type="text" id="staff-password" placeholder="Set a sign-in password" /></div>
    </div>
    <button class="btn btn--primary" type="button" id="add-staff-btn">Add staff member</button>
  `);
  form.querySelector("#add-staff-btn").addEventListener("click", () => {
    const name = form.querySelector("#staff-name").value.trim();
    const department = form.querySelector("#staff-department").value;
    const requestedUsername = form.querySelector("#staff-username").value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const password = form.querySelector("#staff-password").value;
    const workTypes = form.querySelector("#staff-work-types").value.split(",").map(type => type.trim()).filter(Boolean);
    if (!name || !requestedUsername || !password) { toast("Add the name, username, and temporary password."); return; }
    if (db.users.some(member => member.username === requestedUsername)) { toast("That username is already in use."); return; }
    db.users.push({ username: requestedUsername, password, role: "staff", name, department, workTypes, coins: 0, createdAt: Date.now() });
    saveDB();
    toast(`${name} was added to the ${department} team.`);
    render();
  });
  main.appendChild(form);

  const directory = el(`<section class="staff-directory"><div class="helper-row"><h3>Department staff <span class="directory-count">${staff.length}</span></h3><span class="sub">Live team roster</span></div><div class="staff-directory__grid"></div></section>`);
  const grid = directory.querySelector(".staff-directory__grid");
  staff.forEach(member => {
    const completed = db.problems.filter(problem => problem.assignedTo === member.username && problem.status === "completed");
    const workedCategories = [...new Set(completed.map(problem => problem.category))];
    const types = [...new Set([...(member.workTypes || []), ...workedCategories])];
    const card = el(`
      <article class="staff-card">
        <div class="staff-card__head"><div class="staff-avatar">${escapeHtml(member.name.charAt(0))}</div><div><h3>${escapeHtml(member.name)}</h3><p>${escapeHtml(member.department)}</p></div></div>
        <div class="staff-card__stats"><span><strong>${completed.length}</strong> completed</span><span><strong>${avgRating(member.username) ?? "—"}</strong> rating</span><span class="coin">${member.coins}</span></div>
        <div class="staff-card__label">Work types handled</div>
        <div class="staff-card__types">${types.length ? types.map(type => `<span>${escapeHtml(type)}</span>`).join("") : "<em>No work types recorded yet.</em>"}</div>
      </article>
    `);
    grid.appendChild(card);
  });
  main.appendChild(directory);
}

function renderAdminRewards(main, user) {
  const staff = db.users.filter(u => u.role === "staff");
  main.appendChild(el(`
    <div class="page-head"><div><h2>Rewards & payouts</h2><p class="sub">Coins are earned from resident ratings. Convert a staff member's balance to a cash payout at ${CASH_RATE} coins = 1 unit of currency.</p></div></div>
  `));

  const panel = el(`<div class="panel"></div>`);
  const table = el(`<table class="table-mini"><thead><tr><th>Staff</th><th>Department</th><th>Avg rating</th><th>Coin balance</th><th></th></tr></thead><tbody></tbody></table>`);
  const body = table.querySelector("tbody");
  staff.forEach(s => {
    const row = el(`
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.department)}</td>
        <td>${avgRating(s.username) ?? "—"}</td>
        <td class="coin">${s.coins}</td>
        <td style="text-align:right;">
          <button class="btn btn--sm btn--teal" ${s.coins <= 0 ? "disabled" : ""} data-user="${s.username}">Convert to payout</button>
        </td>
      </tr>
    `);
    row.querySelector("button").addEventListener("click", () => {
      const amount = (s.coins / CASH_RATE).toFixed(2);
      db.conversions.unshift({ id: "CV-" + Date.now(), staff: s.username, staffName: s.name, coins: s.coins, amount: Number(amount), timestamp: Date.now() });
      s.coins = 0;
      saveDB();
      toast(`Converted ${s.name}'s coins to a payout of ${amount}.`);
      render();
    });
    body.appendChild(row);
  });
  panel.appendChild(table);
  main.appendChild(panel);

  const history = el(`<div class="panel"><h3>Payout history</h3></div>`);
  if (!db.conversions.length) {
    history.appendChild(el(`<p style="color:var(--ink-faint); font-size:13.5px;">No payouts recorded yet.</p>`));
  } else {
    const t2 = el(`<table class="table-mini"><thead><tr><th>Date</th><th>Staff</th><th>Coins</th><th>Payout</th></tr></thead><tbody></tbody></table>`);
    const b2 = t2.querySelector("tbody");
    [...db.conversions].sort((a, b) => b.timestamp - a.timestamp).forEach(c => {
      b2.appendChild(el(`<tr><td class="rel-time" data-ts="${c.timestamp}" title="${fmtDateShort(c.timestamp)}">${timeAgo(c.timestamp)}</td><td>${escapeHtml(c.staffName)}</td><td class="coin">${c.coins}</td><td>${c.amount}</td></tr>`));
    });
    history.appendChild(t2);
  }
  main.appendChild(history);
}

/* ============================================================
   DETAIL DRAWER (role-aware actions)
   ============================================================ */

function renderDrawer(p, user) {
  p.updates = Array.isArray(p.updates) ? p.updates : [];
  const overlay = el(`<div class="overlay"></div>`);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDrawer(overlay.closest(".shell"));
  });

  const drawer = el(`<div class="drawer"></div>`);
  const head = el(`
    <div class="drawer__head">
      <div>
        <div class="drawer__id">${p.id}</div>
        <h3 style="margin-top:4px;">${escapeHtml(p.title)}</h3>
      </div>
      <button class="btn btn--ghost btn--sm" id="close-drawer">Close ✕</button>
    </div>
  `);
  head.querySelector("#close-drawer").addEventListener("click", () => closeDrawer(overlay.closest(".shell") || document.querySelector(".shell")));
  drawer.appendChild(head);

  const body = el(`<div class="drawer__body"></div>`);

  body.appendChild(el(`
    <div style="display:flex; gap:8px; margin-bottom:16px;">${tagStatus(p.status)}${tagPriority(p.priority)}</div>
  `));

  body.appendChild(el(`
    <div class="panel" style="margin-bottom:18px;">
      <div style="font-size:12px; color:var(--ink-faint); margin-bottom:10px;">
        ${escapeHtml(p.category)} · Reported by ${escapeHtml(p.citizenName)} on ${fmtDateShort(p.createdAt)}
        ${p.assignedToName ? " · Assigned to " + escapeHtml(p.assignedToName) : ""}
      </div>
      <p style="line-height:1.6; font-size:14px;">${escapeHtml(p.description)}</p>
      ${p.photo ? `<div class="photo-preview"><img src="${p.photo}" style="width:100%; max-width:260px; height:auto;" /></div>` : ""}
    </div>
  `));

  if (user.role === "admin" && p.status === "submitted") {
    body.appendChild(renderTriagePanel(p));
  }

  if (user.role === "admin" && (p.status === "assigned" || p.status === "in-progress")) {
    body.appendChild(el(`<div class="panel" style="margin-bottom:18px; font-size:12.5px; color:var(--ink-soft);">
      Assigned to <strong>${escapeHtml(p.assignedToName)}</strong> (${escapeHtml(p.department)}). Priority: <strong>${priorityLabel(p.priority)}</strong>.
    </div>`));
  }

  if (user.role === "staff" && p.assignedTo === user.username && p.status !== "completed") {
    body.appendChild(renderStaffActionPanel(p));
  }

  if (p.updates.length || p.status === "completed" || p.status === "assigned") {
    body.appendChild(renderTimeline(p));
  }

  if (user.role === "citizen" && p.status === "completed") {
    body.appendChild(renderRatingPanel(p));
  }

  drawer.appendChild(body);
  overlay.appendChild(drawer);
  return overlay;
}

function renderTriagePanel(p) {
  const panel = el(`<div class="panel" style="margin-bottom:18px;"><h3>Triage this report</h3></div>`);

  panel.appendChild(el(`<div class="field"><span class="label">Priority</span></div>`));
  const chips = el(`<div class="chip-select" style="margin-bottom:16px;"></div>`);
  let selectedPriority = "medium";
  PRIORITIES.forEach(pr => {
    const b = el(`<button type="button" data-p="${pr}" class="${pr === selectedPriority ? "is-active" : ""}">${priorityLabel(pr)}</button>`);
    b.addEventListener("click", () => { selectedPriority = pr; chips.querySelectorAll("button").forEach(x => x.classList.toggle("is-active", x === b)); });
    chips.appendChild(b);
  });
  panel.appendChild(chips);

  const staffOptions = db.users.filter(u => u.role === "staff");
  panel.appendChild(el(`
    <div class="field">
      <span class="label">Assign to</span>
      <select id="assign-select">
        ${staffOptions.map(s => `<option value="${s.username}" ${s.department === p.category ? "selected" : ""}>${s.name} — ${s.department}</option>`).join("")}
      </select>
    </div>
  `));

  const btn = el(`<button class="btn btn--primary">Set priority and assign</button>`);
  btn.addEventListener("click", () => {
    const staffUser = db.users.find(u => u.username === panel.querySelector("#assign-select").value);
    p.priority = selectedPriority;
    p.assignedTo = staffUser.username;
    p.assignedToName = staffUser.name;
    p.department = staffUser.department;
    p.status = "assigned";
    p.assignedAt = Date.now();
    saveDB();
    toast(`Assigned to ${staffUser.name}.`);
    render();
  });
  panel.appendChild(btn);
  return panel;
}

function renderStaffActionPanel(p) {
  const panel = el(`<div class="panel" style="margin-bottom:18px;"><h3>Update progress</h3></div>`);

  panel.insertAdjacentHTML("beforeend", `
    <div class="field"><span class="label">Note</span><textarea id="update-note" placeholder="What did you do, and what's left?"></textarea></div>
    <div class="field">
      <span class="label">Percent complete</span>
      <div class="slider-wrap">
        <input type="range" id="update-percent" min="0" max="100" value="${nextSuggestedPercent(p)}" />
        <span class="slider-val" id="slider-display">${nextSuggestedPercent(p)}%</span>
      </div>
    </div>
    <div class="field">
      <span class="label">Photo (optional)</span>
      <div class="photo-drop" id="update-photo-drop">Click to attach a progress photo</div>
      <div class="photo-preview" id="update-photo-preview"></div>
    </div>
  `);

  /* ── Dynamic #10: Range slider live display ── */
  const slider = panel.querySelector("#update-percent");
  const sliderDisplay = panel.querySelector("#slider-display");
  slider.addEventListener("input", () => { sliderDisplay.textContent = slider.value + "%"; });

  const preview = panel.querySelector("#update-photo-preview");
  function refresh() { preview.innerHTML = ui.updatePhoto ? `<img src="${ui.updatePhoto}" />` : ""; }
  wireDropZone(panel.querySelector("#update-photo-drop"), (d) => { ui.updatePhoto = d; refresh(); });
  refresh();

  const addBtn = el(`<button class="btn btn--teal" style="margin-right:10px;">Add progress update</button>`);
  addBtn.addEventListener("click", () => {
    const text = panel.querySelector("#update-note").value.trim();
    const percent = Math.max(0, Math.min(100, Number(slider.value) || 0));
    if (!text) { toast("Add a short note describing the update."); return; }
    p.updates.push({ id: "U" + Date.now(), text, percent, photo: ui.updatePhoto || null, timestamp: Date.now(), author: p.assignedToName });
    p.status = "in-progress";
    ui.updatePhoto = null;
    saveDB();
    toast("Progress update added.");
    render();
  });
  panel.appendChild(addBtn);

  panel.appendChild(el(`<hr class="divider" />`));
  panel.appendChild(el(`<div class="field"><span class="label">Completion photo (recommended)</span>
    <div class="photo-drop" id="complete-photo-drop">Click to attach a photo of the finished work</div>
    <div class="photo-preview" id="complete-photo-preview"></div>
  </div>`));
  const cPreview = panel.querySelector("#complete-photo-preview");
  function refreshC() { cPreview.innerHTML = ui.completionPhoto ? `<img src="${ui.completionPhoto}" />` : ""; }
  wireDropZone(panel.querySelector("#complete-photo-drop"), (d) => { ui.completionPhoto = d; refreshC(); });
  refreshC();

  const completeBtn = el(`<button class="btn btn--ochre">Mark as completed</button>`);
  completeBtn.addEventListener("click", () => {
    p.status = "completed";
    p.completedAt = Date.now();
    p.completionPhoto = ui.completionPhoto || null;
    if (p.updates.length === 0 || p.updates[p.updates.length - 1].percent < 100) {
      p.updates.push({ id: "U" + Date.now(), text: "Marked as completed.", percent: 100, photo: ui.completionPhoto || null, timestamp: Date.now(), author: p.assignedToName });
    }
    ui.completionPhoto = null;
    saveDB();
    toast("Marked completed. The resident can now rate the work.");
    render();
  });
  panel.appendChild(completeBtn);

  return panel;
}

function nextSuggestedPercent(p) {
  if (!p.updates.length) return 25;
  return Math.min(90, (p.updates[p.updates.length - 1].percent || 0) + 25);
}

/* ── Dynamic #1: Timeline with animated progress bars ── */
function renderTimeline(p) {
  const panel = el(`<div class="panel" style="margin-bottom:18px;"><h3>Progress timeline</h3></div>`);
  const tl = el(`<div class="timeline"></div>`);
  tl.appendChild(el(`
    <div class="timeline-step">
      <div class="timeline-step__head">
        <span>Reported by ${escapeHtml(p.citizenName)}</span>
        <span class="timeline-step__time rel-time" data-ts="${p.createdAt}" title="${fmtDate(p.createdAt)}">${timeAgo(p.createdAt)}</span>
      </div>
    </div>
  `));
  if (p.assignedAt) {
    tl.appendChild(el(`
      <div class="timeline-step">
        <div class="timeline-step__head">
          <span>Assigned to ${escapeHtml(p.assignedToName)}</span>
          <span class="timeline-step__time rel-time" data-ts="${p.assignedAt}" title="${fmtDate(p.assignedAt)}">${timeAgo(p.assignedAt)}</span>
        </div>
      </div>
    `));
  }
  p.updates.forEach(u => {
    const step = el(`
      <div class="timeline-step">
        <div class="timeline-step__head">
          <span>${u.percent}% — ${escapeHtml(u.author)}</span>
          <span class="timeline-step__time rel-time" data-ts="${u.timestamp}" title="${fmtDate(u.timestamp)}">${timeAgo(u.timestamp)}</span>
        </div>
        <div class="timeline-step__note">${escapeHtml(u.text)}</div>
      </div>
    `);
    // Add animated progress bar inside each timeline step
    const barWrap = el(`<div style="margin-top:6px;"><div class="progress-bar-wrap"><div class="progress-bar-fill${u.percent >= 100 ? " is-done" : ""}" data-target="${u.percent}"></div></div></div>`);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fill = barWrap.querySelector(".progress-bar-fill");
      if (fill) fill.style.width = u.percent + "%";
    }));
    step.appendChild(barWrap);
    if (u.photo) step.appendChild(el(`<img src="${u.photo}" />`));
    tl.appendChild(step);
  });
  if (p.status === "completed" && p.rating) {
    tl.appendChild(el(`
      <div class="timeline-step">
        <div class="timeline-step__head">
          <span>Rated by ${escapeHtml(p.citizenName)}</span>
          <span class="timeline-step__time rel-time" data-ts="${p.ratedAt}" title="${fmtDate(p.ratedAt)}">${timeAgo(p.ratedAt)}</span>
        </div>
        <div class="timeline-step__note">${"★".repeat(p.rating)}${"☆".repeat(5 - p.rating)} ${p.feedback ? "— " + escapeHtml(p.feedback) : ""}</div>
      </div>
    `));
  }
  panel.appendChild(tl);
  return panel;
}

function renderRatingPanel(p) {
  if (p.rating) {
    return el(`
      <div class="panel">
        <h3>Your feedback</h3>
        <div class="stars readonly">${[1,2,3,4,5].map(n => `<button disabled class="${n <= p.rating ? "is-filled" : ""}">★</button>`).join("")}</div>
        <p style="margin-top:8px; font-size:13.5px; color:var(--ink-soft);">${escapeHtml(p.feedback || "")}</p>
      </div>
    `);
  }
  const panel = el(`<div class="panel"><h3>Rate this completed report</h3><p style="font-size:13px; color:var(--ink-soft); margin-bottom:12px;">Your rating awards coins to ${escapeHtml(p.assignedToName)} for this job.</p></div>`);
  let rating = 0;
  const stars = el(`<div class="stars"></div>`);
  for (let n = 1; n <= 5; n++) {
    const b = el(`<button type="button" data-n="${n}">★</button>`);
    b.addEventListener("click", () => { rating = n; stars.querySelectorAll("button").forEach((s, i) => s.classList.toggle("is-filled", i < rating)); });
    stars.appendChild(b);
  }
  panel.appendChild(stars);
  panel.appendChild(el(`<div class="field" style="margin-top:14px;"><span class="label">Feedback (optional)</span><textarea id="feedback-text" placeholder="How was the service?"></textarea></div>`));
  const submit = el(`<button class="btn btn--primary">Submit rating</button>`);
  submit.addEventListener("click", () => {
    if (!rating) { toast("Choose a star rating first."); return; }
    p.rating = rating;
    p.feedback = panel.querySelector("#feedback-text").value.trim();
    p.ratedAt = Date.now();
    p.coinsAwarded = rating * COIN_RATE;
    const staffUser = db.users.find(u => u.username === p.assignedTo);
    if (staffUser) staffUser.coins = (staffUser.coins || 0) + p.coinsAwarded;
    saveDB();
    toast(`Thanks! ${p.coinsAwarded} coins awarded to ${p.assignedToName}.`);
    render();
  });
  panel.appendChild(submit);
  return panel;
}

/* ---------------- Boot ---------------- */

render();
