
/* =========================================================
   VETRI Namma Kural ? front-end prototype
   Three roles (resident, department staff, administrator)
   share one ledger of reported problems, persisted to
   localStorage so the full flow can be demoed in one browser.
   ========================================================= */

const DB_KEY = "civic_register_db_v1";   // unchanged: existing data keeps working
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
const COIN_RATE = 10;   // coins per rating star
const CASH_RATE = 10;   // coins per unit of currency
const MAX_TITLE = 120;
const MAX_DESC = 800;

/* Target response time per category, in days. Used for the
   overdue / due-soon signals; purely advisory, nothing is stored. */
const SLA_DAYS = {
  "Sanitation & Waste": 2,
  "Roads & Infrastructure": 7,
  "Water Supply": 2,
  "Electricity": 3,
  "Public Safety": 1,
  "Parks & Environment": 5,
  "Other": 5,
};

const DAY_MS = 86400000;
const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

/* ---------------- Storage (with graceful fallback) ----------------
   Browsers block Web Storage in sandboxed frames and some private
   modes, and touching it throws. Falling back to memory keeps the
   prototype usable instead of crashing before the login screen. */
const memoryStore = new Map();
function makeStore(kind) {
  try {
    const store = window[kind];
    const probe = "__sc_probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return { store, persistent: true };
  } catch (error) {
    console.warn(`[VETRI Namma Kural] ${kind} is unavailable ? falling back to in-memory storage.`);
    return {
      persistent: false,
      store: {
        getItem: key => (memoryStore.has(`${kind}:${key}`) ? memoryStore.get(`${kind}:${key}`) : null),
        setItem: (key, value) => memoryStore.set(`${kind}:${key}`, String(value)),
        removeItem: key => memoryStore.delete(`${kind}:${key}`),
      },
    };
  }
}
const localStore = makeStore("localStorage");
const sessionStore = makeStore("sessionStorage");
/* Always use relative /api — works locally on port 5000 and in production on Render. */
const API_BASE = "/api";

async function api(path, options = {}) {
  const session = getSession();
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
async function uploadPhoto(dataUrl) {
  if (!dataUrl) return null;
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append("image", blob, "report-image.jpg");
  const { url } = await api("/uploads", { method: "POST", body: form });
  return url;
}

function mapReport(report) {
  return {
    apiId: report._id,
    id: `PR-${String(report._id).slice(-6).toUpperCase()}`,
    title: report.title, description: report.description, category: report.category,
    photo: report.photoUrl || null, status: report.status, priority: report.priority,
    citizen: report.citizen?.username, citizenName: report.citizen?.name,
    assignedTo: report.assignedTo?.username || null, assignedToName: report.assignedTo?.name || null,
    department: report.assignedTo?.department || null,
    createdAt: new Date(report.createdAt).getTime(),
    assignedAt: report.assignedAt ? new Date(report.assignedAt).getTime() : null,
    completedAt: report.completedAt ? new Date(report.completedAt).getTime() : null,
    completionPhoto: report.completionPhotoUrl || null,
    updates: (report.updates || []).map(u => ({ id: String(u._id), text: u.note, percent: u.percent, photo: u.photoUrl || null, timestamp: new Date(u.createdAt).getTime(), author: u.author?.name || "Staff" })),
    rating: report.rating?.score || null, feedback: report.rating?.feedback || null,
    ratedAt: report.rating?.createdAt ? new Date(report.rating.createdAt).getTime() : null,
  };
}
async function refreshFromApi() {
  const { user: me } = await api("/auth/me");
  const meIndex = db.users.findIndex(user => user.username === me.username);
  const mappedMe = { ...me, apiId: me.id, password: "" };
  if (meIndex >= 0) db.users[meIndex] = { ...db.users[meIndex], ...mappedMe };
  else db.users.push(mappedMe);
  const { reports } = await api("/reports");
  db.problems = reports.map(mapReport);
  if (getSession()?.role === "admin") {
    const { users } = await api("/users");
    db.users = users.map(user => ({ ...user, apiId: user.id, password: "" }));
  }
}

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
      createdAt: now - 6 * DAY_MS,
      assignedAt: now - 5 * DAY_MS,
      completedAt: now - 3 * DAY_MS,
      updates: [
        { id: "U1", text: "Assigned to sanitation crew for collection.", percent: 20, photo: null, timestamp: now - 5 * DAY_MS, author: "Amara Okoye" },
        { id: "U2", text: "Bin cleared and area swept.", percent: 100, photo: null, timestamp: now - 3 * DAY_MS, author: "Amara Okoye" },
      ],
      completionPhoto: null,
      rating: 4,
      feedback: "Handled quickly once assigned. Would be good to fix the collection schedule so this doesn't recur.",
      coinsAwarded: 40,
      ratedAt: now - 2 * DAY_MS,
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
      createdAt: now - 4 * DAY_MS,
      assignedAt: now - 3 * DAY_MS,
      completedAt: null,
      updates: [
        { id: "U3", text: "Site inspected, marked for patching. Materials ordered.", percent: 30, photo: null, timestamp: now - 2 * DAY_MS, author: "Kofi Boateng" },
        { id: "U4", text: "Patching started, one lane open.", percent: 65, photo: null, timestamp: now - 1 * DAY_MS, author: "Kofi Boateng" },
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
      createdAt: now - 1 * DAY_MS,
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
      createdAt: now - 2 * DAY_MS,
      assignedAt: now - DAY_MS,
      completedAt: null,
      updates: [],
      completionPhoto: null,
      rating: null,
      feedback: null,
      coinsAwarded: null,
      ratedAt: null,
    },
    {
      /* Deliberately past its category SLA so the overdue signal is visible. */
      id: "PR-1005",
      title: "Burst pipe flooding the footpath on MG Road",
      description: "A pipe joint outside the bakery has been leaking continuously; water is pooling across the footpath and into the gutter.",
      category: "Water Supply",
      photo: null,
      citizen: "citizen_maya",
      citizenName: "Maya Iyer",
      status: "in-progress",
      priority: "high",
      assignedTo: "staff_priya",
      assignedToName: "Priya Nair",
      department: "Water Supply",
      createdAt: now - 5 * DAY_MS,
      assignedAt: now - 4 * DAY_MS,
      completedAt: null,
      updates: [
        { id: "U5", text: "Valve partially closed to reduce flow. Replacement joint ordered.", percent: 40, photo: null, timestamp: now - 3 * DAY_MS, author: "Priya Nair" },
      ],
      completionPhoto: null,
      rating: null,
      feedback: null,
      coinsAwarded: null,
      ratedAt: null,
    },
  ];

  const conversions = [
    { id: "CV-1", staff: "staff_kofi", staffName: "Kofi Boateng", coins: 30, amount: 3, timestamp: now - 4 * DAY_MS },
  ];

  return { users, problems, conversions, seq: 1006 };
}

function normalizeDB(database) {
  if (!database || typeof database !== "object") database = {};
  database.users = Array.isArray(database.users) ? database.users : [];
  database.users.forEach(user => {
    user.name = typeof user.name === "string" && user.name.trim() ? user.name : "Unnamed user";
    if (user.role === "staff") {
      user.workTypes = Array.isArray(user.workTypes) ? user.workTypes : [];
      user.coins = Number(user.coins) || 0;
    }
  });
  database.problems = (Array.isArray(database.problems) ? database.problems : []).map(problem => ({
    title: "Untitled report",
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
    ...problem,
    updates: Array.isArray(problem.updates) ? problem.updates : [],
  }));
  database.conversions = Array.isArray(database.conversions) ? database.conversions : [];

  /* Derive the id counter from real data so externally edited stores
     can never hand out a duplicate report id. */
  const highest = database.problems.reduce((max, problem) => {
    const n = Number(String(problem.id || "").replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 1000);
  database.seq = Math.max(Number(database.seq) || 0, highest + 1);
  return database;
}

function loadDB() {
  let raw = null;
  try { raw = localStore.store.getItem(DB_KEY); } catch (error) { console.warn("Unable to read saved reports.", error); }
  if (raw) {
    try { return normalizeDB(JSON.parse(raw)); } catch (error) { console.warn("Saved reports were unreadable ? reseeding.", error); }
  }
  const fresh = seedDB();
  persist(fresh);
  return fresh;
}

function persist(database) {
  try {
    localStore.store.setItem(DB_KEY, JSON.stringify(database));
  } catch (error) {
    console.warn("Unable to save reports (storage full or blocked).", error);
  }
}

function saveDB() {
  persist(db);
  if (liveSync) {
    try { liveSync.postMessage(db); } catch (error) { /* channel closed */ }
  }
}

let db = loadDB();

/* --- Live sync across tabs --- */
let liveSync = null;
try {
  liveSync = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("civic-register-live") : null;
} catch (error) {
  liveSync = null;
}
if (liveSync) {
  liveSync.onmessage = (event) => {
    db = normalizeDB(event.data);
    pulseLiveIndicator();
    renderFromSync();
  };
}
window.addEventListener("storage", (event) => {
  if (event.key !== DB_KEY || !event.newValue) return;
  try {
    db = normalizeDB(JSON.parse(event.newValue));
    pulseLiveIndicator();
    renderFromSync();
  } catch (error) {
    console.warn("Unable to sync saved reports.", error);
  }
});

/* A change arriving from another tab must not wipe what the person
   is typing ? defer the repaint until the field loses focus. */
let pendingSyncRender = false;
function renderFromSync() {
  const active = document.activeElement;
  const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA") && active.closest("#app");
  if (typing) {
    if (pendingSyncRender) return;
    pendingSyncRender = true;
    active.addEventListener("blur", () => {
      if (!pendingSyncRender) return;
      pendingSyncRender = false;
      render();
    }, { once: true });
    return;
  }
  render();
}

function pulseLiveIndicator() {
  const ind = document.querySelector(".live-indicator");
  if (!ind) return;
  ind.classList.remove("is-syncing");
  void ind.offsetWidth; // restart the animation
  ind.classList.add("is-syncing");
  setTimeout(() => ind.classList.remove("is-syncing"), 1900);
}

/* ---------------- Session ---------------- */

function getSession() {
  try {
    const raw = sessionStore.store.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) { return null; }
}
function setSession(session) {
  try { sessionStore.store.setItem(SESSION_KEY, JSON.stringify(session)); } catch (error) { /* ignore */ }
}
function clearSession() {
  try { sessionStore.store.removeItem(SESSION_KEY); } catch (error) { /* ignore */ }
}
function currentUser() {
  const session = getSession();
  if (!session) return null;
  return db.users.find(u => u.username === session.username) || null;
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

/* Live handles to the shell chrome, so Escape and the overlay can act
   on whatever is on screen without relying on closure hoisting. */
let shellRefs = { sidebar: null, hamburger: null, overlay: null };
let lastFocus = null;

/* ---------------- Helpers ---------------- */

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function timeAgo(ts) {
  if (!ts) return "?";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / DAY_MS);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return fmtDateShort(ts);
}
function fmtDate(ts) {
  if (!ts) return "?";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " ? " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function fmtDateShort(ts) {
  if (!ts) return "?";
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function toast(message) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const node = el(`<div class="toast" role="status"></div>`);
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}
function nextId() {
  let candidate;
  do {
    db.seq += 1;
    candidate = "PR-" + db.seq;
  } while (db.problems.some(p => p.id === candidate));
  return candidate;
}
function statusLabel(s) {
  return { submitted: "Submitted", assigned: "Assigned", "in-progress": "In progress", completed: "Completed" }[s] || s;
}
function priorityLabel(p) {
  return p ? p[0].toUpperCase() + p.slice(1) : "Not set";
}
function latestPercent(p) {
  if (p.status === "completed") return 100;
  if (!p.updates || !p.updates.length) return 0;
  return p.updates[p.updates.length - 1].percent || 0;
}
function avgRating(staffUsername) {
  const rated = db.problems.filter(p => p.assignedTo === staffUsername && p.rating);
  if (!rated.length) return null;
  return (rated.reduce((sum, p) => sum + p.rating, 0) / rated.length).toFixed(1);
}

/* SLA signal derived from category target + report age. */
function dueMeta(p) {
  if (!p || p.status === "completed") return null;
  const limitMs = (SLA_DAYS[p.category] ?? 5) * DAY_MS;
  const age = Date.now() - p.createdAt;
  if (age > limitMs) {
    const late = Math.max(1, Math.ceil((age - limitMs) / DAY_MS));
    return { level: "over", label: `Overdue ${late}d` };
  }
  if (age > limitMs * 0.7) return { level: "soon", label: "Due soon" };
  return null;
}
function dueTag(p) {
  const due = dueMeta(p);
  if (!due) return "";
  return `<span class="tag tag--due-${due.level}">${esc(due.label)}</span>`;
}
/* Overdue first, then by priority, then oldest first. */
function sortByUrgency(list) {
  return [...list].sort((a, b) => {
    const dueA = dueMeta(a) ? (dueMeta(a).level === "over" ? 0 : 1) : 2;
    const dueB = dueMeta(b) ? (dueMeta(b).level === "over" ? 0 : 1) : 2;
    if (dueA !== dueB) return dueA - dueB;
    const rankA = PRIORITY_RANK[a.priority] ?? 4;
    const rankB = PRIORITY_RANK[b.priority] ?? 4;
    if (rankA !== rankB) return rankA - rankB;
    return a.createdAt - b.createdAt;
  });
}

/* Guard against double-submits without leaving a dead button behind. */
function withBusy(button, busyLabel, work) {
  if (!button || button.dataset.busy === "1") return;
  button.dataset.busy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  const original = button.textContent;
  button.textContent = busyLabel;
  Promise.resolve(work()).catch(error => {
    console.error(error);
    toast(error.message || "Could not save your change.");
  }).finally(() => {
    if (button.isConnected) {
      button.dataset.busy = "";
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = original;
    }
  });
}

function resizeImageFile(file, maxDim, onData, onError) {
  const reader = new FileReader();
  reader.onerror = () => onError && onError();
  reader.onload = (event) => {
    const img = new Image();
    img.onerror = () => onError && onError();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height *= maxDim / width; width = maxDim; }
      else if (height > maxDim) { width *= maxDim / height; height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      onData(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

/* Click, keyboard, and drag-and-drop all feed the same handler. */
function wireDropZone(zoneEl, onData) {
  const acceptFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Please choose an image file."); return; }
    if (file.size > 12 * 1024 * 1024) { toast("That image is larger than 12 MB ? please pick a smaller one."); return; }
    resizeImageFile(file, 720, onData, () => toast("We couldn't read that image. Try another file."));
  };
  const openPicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      if (input.files && input.files[0]) acceptFile(input.files[0]);
    });
    input.click();
  };

  zoneEl.setAttribute("role", "button");
  zoneEl.tabIndex = 0;
  zoneEl.addEventListener("click", openPicker);
  zoneEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPicker();
  });
  zoneEl.addEventListener("dragover", (event) => { event.preventDefault(); zoneEl.classList.add("is-dragging"); });
  zoneEl.addEventListener("dragleave", () => zoneEl.classList.remove("is-dragging"));
  zoneEl.addEventListener("drop", (event) => {
    event.preventDefault();
    zoneEl.classList.remove("is-dragging");
    const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
    acceptFile(file);
  });
}

const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animateCount(node, target, duration = 900) {
  if (!node) return;
  if (reduceMotion || !Number.isFinite(target)) { node.textContent = String(target); return; }
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    node.textContent = String(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function progressBar(percent, isDone) {
  const wrap = el(`<div>
    <div class="progress-bar-wrap"><div class="progress-bar-fill${isDone ? " is-done" : ""}"></div></div>
    <div class="progress-bar-label">${percent}% complete</div>
  </div>`);
  const fill = wrap.querySelector(".progress-bar-fill");
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = percent + "%"; }));
  return wrap;
}

/* One shared ticker keeps every relative timestamp fresh. */
function startRelativeTimeTicker() {
  setInterval(() => {
    document.querySelectorAll(".rel-time").forEach(node => {
      const ts = Number(node.dataset.ts);
      if (ts) node.textContent = timeAgo(ts);
    });
  }, 30000);
}

/* ---------------- Auth ---------------- */

async function attemptLogin(username, password) {
  const result = await api("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  const user = { ...result.user, apiId: result.user.id, password: "" };
  const index = db.users.findIndex(member => member.username === user.username);
  if (index >= 0) db.users[index] = { ...db.users[index], ...user };
  else db.users.push(user);
  setSession({ username: user.username, role: user.role, token: result.token });
  await refreshFromApi();
  ui.view = "overview";
  ui.detailId = null;
  ui.sidebarOpen = false;
  return true;
}
function logout() {
  clearSession();
  ui.view = "overview";
  ui.detailId = null;
  ui.sidebarOpen = false;
  ui.reportPhoto = ui.updatePhoto = ui.completionPhoto = null;
  render();
}

/* ---------------- Root render ---------------- */

function render() {
  const app = document.getElementById("app");

  /* Never leave a stale overlay behind: a leftover sidebar scrim used
     to sit on top of the login screen after signing out. */
  document.querySelectorAll(".sidebar-overlay").forEach(node => node.remove());
  shellRefs = { sidebar: null, hamburger: null, overlay: null };

  const user = currentUser();
  if (!user) {
    app.innerHTML = "";
    app.appendChild(renderLogin());
    return;
  }
  app.innerHTML = "";
  try {
    app.appendChild(renderShell(user));
  } catch (error) {
    console.error("VETRI Namma Kural render error:", error);
    ui.detailId = null;
    app.innerHTML = "";
    const recovery = el(`<div class="render-recovery">
      <h2>We couldn't open that report.</h2>
      <p>Your workspace is still available. Please return to your assignments and try again.</p>
      <button class="btn btn--primary" type="button">Back to assignments</button>
    </div>`);
    recovery.querySelector("button").addEventListener("click", () => { ui.view = "overview"; render(); });
    app.appendChild(recovery);
  }
}

/* ---------------- Login screen ---------------- */

const DEMO_ACCOUNTS = {
  citizen: [
    { u: "citizen_raj", p: "citizen123", label: "Raj Menon" },
    { u: "citizen_maya", p: "citizen123", label: "Maya Iyer" },
  ],
  staff: [
    { u: "staff_amara", p: "staff123", label: "Amara Okoye ? Sanitation" },
    { u: "staff_kofi", p: "staff123", label: "Kofi Boateng ? Roads" },
    { u: "staff_priya", p: "staff123", label: "Priya Nair ? Water" },
  ],
  admin: [
    { u: "admin", p: "admin123", label: "S. Fernandes" },
  ],
};

function renderLogin() {
  const fragment = document.getElementById("tpl-login").content.cloneNode(true);
  const wrap = el("<div></div>");
  wrap.appendChild(fragment);
  const shell = wrap.firstElementChild;

  const tabs = shell.querySelectorAll(".role-tab");
  const roleTabs = shell.querySelector("#login-role-tabs");
  const demoBox = shell.querySelector("#login-demo");
  const form = shell.querySelector("#login-form");
  const errorEl = shell.querySelector("#login-error");
  const usernameInput = shell.querySelector("#login-username");
  const passwordInput = shell.querySelector("#login-password");
  const registerForm = shell.querySelector("#register-form");
  const registerError = shell.querySelector("#register-error");

  shell.querySelector("#show-register").addEventListener("click", () => {
    shell.classList.add("is-registering");
    form.hidden = true;
    registerForm.hidden = false;
    roleTabs.hidden = true;
    demoBox.hidden = true;
    shell.querySelector(".login-divider").hidden = true;
    shell.querySelector(".login-google").hidden = true;
    shell.querySelector("#show-register").hidden = true;
    shell.querySelector("#register-name").focus();
  });
  shell.querySelector("#show-login").addEventListener("click", () => {
    shell.classList.remove("is-registering");
    registerForm.hidden = true;
    form.hidden = false;
    roleTabs.hidden = false;
    demoBox.hidden = false;
    shell.querySelector(".login-divider").hidden = false;
    shell.querySelector(".login-google").hidden = false;
    shell.querySelector("#show-register").hidden = false;
  });

  function renderDemo() {
    const list = DEMO_ACCOUNTS[ui.loginRoleTab];
    const heading = ui.loginRoleTab === "citizen" ? "resident" : ui.loginRoleTab;
    demoBox.innerHTML = `<h4>Demo accounts ? ${esc(heading)}</h4>
      <table>${list.map(a => `
        <tr>
          <td class="role">${esc(a.label)}</td>
          <td><button type="button" class="fill" data-u="${esc(a.u)}" data-p="${esc(a.p)}">${esc(a.u)} / ${esc(a.p)}</button></td>
        </tr>`).join("")}</table>`;
    demoBox.querySelectorAll("button.fill").forEach(button => {
      button.addEventListener("click", () => {
        usernameInput.value = button.dataset.u;
        passwordInput.value = button.dataset.p;
        passwordInput.focus();
      });
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => {
        const on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-pressed", String(on));
      });
      ui.loginRoleTab = tab.dataset.role;
      renderDemo();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) {
      errorEl.hidden = false;
      errorEl.textContent = "Enter both a username and a password.";
      return;
    }
    try {
      await attemptLogin(username, password);
      errorEl.hidden = true;
      render();
    } catch (error) {
      errorEl.hidden = false;
      errorEl.textContent = error.message || "Username or password not recognized.";
      passwordInput.select();
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: shell.querySelector("#register-name").value.trim(),
          username: shell.querySelector("#register-username").value.trim(),
          password: shell.querySelector("#register-password").value,
        }),
      });
      registerForm.reset();
      shell.classList.remove("is-registering");
      registerForm.hidden = true;
      form.hidden = false;
      roleTabs.hidden = false;
      demoBox.hidden = false;
      shell.querySelector(".login-divider").hidden = false;
      shell.querySelector(".login-google").hidden = false;
      shell.querySelector("#show-register").hidden = false;
      usernameInput.value = result.user.username;
      passwordInput.value = "";
      errorEl.hidden = false;
      errorEl.textContent = "Account created. Sign in with your new password.";
      passwordInput.focus();
    } catch (error) {
      registerError.hidden = false;
      registerError.textContent = error.message || "Could not create your account.";
    }
  });

  renderDemo();
  return wrap;
}

/* ---------------- Shared shell ---------------- */

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
    return { overview: db.problems.filter(p => p.citizen === user.username).length, new: null, profile: null };
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

function setSidebar(open) {
  ui.sidebarOpen = open;
  const { sidebar, hamburger, overlay } = shellRefs;
  if (sidebar) sidebar.classList.toggle("is-open", open);
  if (hamburger) {
    hamburger.classList.toggle("is-open", open);
    hamburger.setAttribute("aria-expanded", String(open));
  }
  if (overlay) overlay.classList.toggle("is-open", open);
}

function renderShell(user) {
  const wrap = el(`<div class="shell"></div>`);
  const counts = navCounts(user);

  const overlay = el(`<div class="sidebar-overlay"></div>`);
  overlay.addEventListener("click", () => setSidebar(false));
  document.body.appendChild(overlay);

  const topbar = el(`
    <div class="topbar">
      <div class="topbar__left">
        <button class="hamburger-btn" id="hamburger-btn" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="app-sidebar">
          <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
        </button>
        <div class="topbar__brand"><span class="glyph" aria-hidden="true">VK</span><span>VETRI <small>Namma Kural</small></span></div>
      </div>
      <div class="topbar__right">
        <div class="live-indicator" title="Report changes sync across open tabs"><span aria-hidden="true"></span>Live</div>
        <div style="text-align:right">
          <div class="topbar__user">${esc(user.name)}</div>
          <div class="topbar__role">${ROLE_TITLE[user.role].toUpperCase()}${user.department ? " ? " + esc(user.department) : ""}</div>
        </div>
        <button class="btn btn--ghost btn--sm" id="logout-btn" type="button">Sign out</button>
      </div>
    </div>
  `);
  topbar.querySelector("#logout-btn").addEventListener("click", logout);
  const hamburger = topbar.querySelector("#hamburger-btn");
  hamburger.addEventListener("click", () => setSidebar(!ui.sidebarOpen));
  wrap.appendChild(topbar);

  const sidebar = el(`<aside class="sidebar" id="app-sidebar" aria-label="Main navigation"></aside>`);
  NAV[user.role].forEach(item => {
    const count = counts[item.id];
    const button = el(`
      <button class="nav-item ${ui.view === item.id ? "is-active" : ""}" type="button" data-view="${item.id}"${ui.view === item.id ? ' aria-current="page"' : ""}>
        <span>${esc(item.label)}</span>
        ${count !== null && count !== undefined ? `<span class="count">${count}</span>` : ""}
      </button>
    `);
    button.addEventListener("click", () => {
      ui.view = item.id;
      ui.detailId = null;
      setSidebar(false);
      render();
    });
    sidebar.appendChild(button);
  });
  sidebar.appendChild(el(`<div class="sidebar__foot">VETRI Namma Kural · community service portal${localStore.persistent ? "" : " (preview mode: not saved)"}.</div>`));
  wrap.appendChild(sidebar);

  shellRefs.sidebar = sidebar;
  shellRefs.hamburger = hamburger;
  shellRefs.overlay = overlay;
  if (ui.sidebarOpen) setSidebar(true);

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
  return wrap;
}

/* Drawer close lives outside the drawer so a re-render of the shell
   can still finish the animation cleanly. */
function closeDrawer() {
  ui.updatePhoto = null;
  ui.completionPhoto = null;
  const drawerEl = document.querySelector(".drawer");
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    ui.detailId = null;
    render();
    if (lastFocus && document.contains(lastFocus) && typeof lastFocus.focus === "function") lastFocus.focus();
  };
  if (!drawerEl) { finish(); return; }
  drawerEl.classList.add("is-closing");
  drawerEl.addEventListener("animationend", finish, { once: true });
  setTimeout(finish, 320); // safety net if the animation never fires
}

/* ---------------- Ledger rows ---------------- */

function tagStatus(status) {
  const cls = { submitted: "submitted", assigned: "assigned", "in-progress": "progress", completed: "completed" }[status] || "submitted";
  return `<span class="tag tag--status-${cls}">${esc(statusLabel(status))}</span>`;
}
function tagPriority(priority) {
  if (!priority) return `<span class="tag tag--priority-low">Not triaged</span>`;
  return `<span class="tag tag--priority-${esc(priority)}">${esc(priorityLabel(priority))} priority</span>`;
}

function ledgerRow(p, opts = {}) {
  const pct = latestPercent(p);
  const isDone = p.status === "completed";
  const row = el(`
    <button class="ledger-row" type="button" data-id="${esc(p.id)}"
      aria-label="${esc(`${p.id}: ${p.title}. Status ${statusLabel(p.status)}${p.priority ? ", " + priorityLabel(p.priority) + " priority" : ""}.`)}">
      <div class="ledger-row__id">${esc(p.id)}</div>
      <div class="ledger-row__body">
        <div class="ledger-row__title"></div>
        <div class="ledger-row__meta">
          <span>${esc(p.category)}</span>
          <span aria-hidden="true">?</span>
          ${opts.showCitizen
            ? `<span class="rel-time">Reported by ${esc(p.citizenName)}</span>`
            : `<span class="rel-time" data-ts="${p.createdAt}" title="${esc(fmtDate(p.createdAt))}">${esc(timeAgo(p.createdAt))}</span>`}
          ${opts.showAssignee ? `<span aria-hidden="true">?</span><span>${p.assignedToName ? "Assigned to " + esc(p.assignedToName) : "Unassigned"}</span>` : ""}
        </div>
        ${(pct > 0 || isDone) ? `<div class="progress-bar-wrap"><div class="progress-bar-fill${isDone ? " is-done" : ""}"></div></div>` : ""}
      </div>
      <div class="ledger-row__side">
        ${tagStatus(p.status)}
        ${dueTag(p)}
        ${tagPriority(p.priority)}
      </div>
    </button>
  `);

  /* The report title was previously never written into the row. */
  row.querySelector(".ledger-row__title").textContent = p.title;

  if (pct > 0 || isDone) {
    const fill = row.querySelector(".progress-bar-fill");
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = pct + "%"; }));
  }

  row.addEventListener("click", () => {
    lastFocus = row;
    ui.detailId = p.id;
    render();
  });
  return row;
}

function renderLedger(list, opts = {}) {
  if (!list.length) {
    return el(`<div class="ledger"><div class="ledger-empty">${esc(opts.emptyText || "Nothing here yet.")}</div></div>`);
  }
  const wrap = el(`<div class="ledger"></div>`);
  list.forEach(p => wrap.appendChild(ledgerRow(p, opts)));
  return wrap;
}

/* ---------------- Profile ---------------- */

function renderProfile(main, user) {
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const roleSummary = user.role === "citizen"
    ? `${db.problems.filter(p => p.citizen === user.username).length} reports submitted`
    : user.role === "staff"
      ? `${db.problems.filter(p => p.assignedTo === user.username && p.status === "completed").length} jobs completed`
      : `${db.problems.length} city reports managed`;

  const roleDetail = user.role === "staff"
    ? `<div class="profile-readonly"><span>Department</span><strong>${esc(user.department)}</strong></div>
       <div class="profile-readonly"><span>Work specialties</span><strong>${(user.workTypes || []).length ? user.workTypes.map(esc).join(", ") : "Not recorded"}</strong></div>`
    : user.role === "admin"
      ? `<div class="profile-readonly"><span>Access level</span><strong>${esc(user.title || "Municipal Administrator")}</strong></div>
         <div class="profile-readonly"><span>Scope</span><strong>All departments</strong></div>`
      : `<div class="profile-readonly"><span>Account type</span><strong>Resident account</strong></div>
         <div class="profile-readonly"><span>Report visibility</span><strong>Only your submitted reports</strong></div>`;

  main.appendChild(el(`<div class="profile-hero"><div><span class="profile-kicker">VETRI NAMMA KURAL</span><h2>My profile</h2><p>Manage your account, contact details and service access.</p></div><div class="profile-hero__badge"><strong>${esc(roleSummary.split(" ")[0])}</strong><span>${esc(roleSummary.replace(/^\S+\s*/, ""))}</span></div></div>`));

  const layout = el(`<div class="profile-layout"></div>`);
  layout.appendChild(el(`<aside class="profile-identity">
    <div class="profile-avatar" aria-hidden="true">${esc(initials || "VK")}</div>
    <h3>${esc(user.name)}</h3>
    <p>${ROLE_TITLE[user.role]}</p>
    <div class="profile-summary"><span class="profile-summary__dot"></span>${roleSummary}</div>
    <div class="profile-username">@${esc(user.username)} <span>Verified account</span></div>
  </aside>`));

  const panel = el(`<section class="panel profile-details"><h3>Account details</h3></section>`);
  panel.insertAdjacentHTML("beforeend", `
    <div class="grid-2">
      <div class="field"><label class="label" for="profile-name">Display name</label><input type="text" id="profile-name" value="${esc(user.name)}" /></div>
      <div class="field"><label class="label" for="profile-username">Username</label><input type="text" id="profile-username" value="${esc(user.username)}" disabled /></div>
    </div>
    <div class="grid-2">
      <div class="field"><label class="label" for="profile-email">Email <small>(optional)</small></label><input type="text" id="profile-email" value="${esc(user.email || "")}" placeholder="name@example.com" /></div>
      <div class="field"><label class="label" for="profile-phone">Phone <small>(optional)</small></label><input type="text" id="profile-phone" value="${esc(user.phone || "")}" placeholder="+91 ..." /></div>
    </div>
    <div class="profile-role-details">${roleDetail}</div>
    <hr class="divider" />
    <div class="field">
      <label class="label" for="profile-password">New password <small>(leave empty to keep the current one)</small></label>
      <input type="password" id="profile-password" placeholder="At least 6 characters" autocomplete="new-password" />
    </div>
    <button class="btn btn--primary" type="button" id="save-profile-btn">Save profile</button>
  `);
  panel.querySelector("#save-profile-btn").addEventListener("click", (event) => {
    withBusy(event.currentTarget, "Saving...", async () => {
      const name = panel.querySelector("#profile-name").value.trim();
      const email = panel.querySelector("#profile-email").value.trim();
      const phone = panel.querySelector("#profile-phone").value.trim();
      const password = panel.querySelector("#profile-password").value;
      if (!name) { toast("Enter a display name."); return; }
      if (email && !/^\S+@\S+\.\S+$/.test(email)) { toast("Enter a valid email address."); return; }
      if (password && password.length < 6) { toast("Use at least 6 characters for the new password."); return; }
      const result = await api("/auth/me", { method: "PATCH", body: JSON.stringify({ name, email, phone, password }) });
      Object.assign(user, result.user);
      user.email = email;
      user.phone = phone;
      if (password) user.password = password;
      saveDB();
      toast("Your profile was updated.");
      render();
    });
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
      <button class="btn btn--ochre" id="new-report-btn" type="button">Report a problem</button>
    </div>
  `));
  main.querySelector("#new-report-btn").addEventListener("click", () => { ui.view = "new"; render(); });

  const open = mine.filter(p => p.status !== "completed").length;
  const done = mine.filter(p => p.status === "completed").length;
  const awaiting = mine.filter(p => p.status === "completed" && p.rating === null).length;
  const overdue = mine.filter(p => { const d = dueMeta(p); return d && d.level === "over"; }).length;

  const strip = el(`<div class="stat-strip">
    <div class="stat"><div class="n anim-counter"></div><div class="l">Reports submitted</div></div>
    <div class="stat accent"><div class="n anim-counter"></div><div class="l">Still open</div></div>
    <div class="stat${overdue ? " warn" : ""}"><div class="n anim-counter"></div><div class="l">Past target date</div></div>
    <div class="stat"><div class="n anim-counter"></div><div class="l">Completed</div></div>
    <div class="stat"><div class="n">${awaiting}</div><div class="l">Waiting on your rating</div></div>
  </div>`);
  main.appendChild(strip);
  const numbers = strip.querySelectorAll(".anim-counter");
  requestAnimationFrame(() => {
    animateCount(numbers[0], mine.length, 700);
    animateCount(numbers[1], open, 650);
    animateCount(numbers[2], overdue, 600);
    animateCount(numbers[3], done, 700);
  });

  if (awaiting) {
    main.appendChild(el(`<div class="mark-notice">
      <strong>${awaiting} completed report${awaiting > 1 ? "s" : ""} waiting on your feedback.</strong>
      <p>Open a completed report below to rate the service and leave feedback ? your rating awards coins to the crew.</p>
    </div>`));
  }

  main.appendChild(renderFilteredLedger(mine, {
    label: "My reports",
    emptyText: "You haven't reported anything yet. Use ?Report a problem? to get started.",
  }));
}

function renderCitizenNew(main, user) {
  main.appendChild(el(`
    <div class="page-head">
      <div><h2>Report a problem</h2><p class="sub">Describe the issue clearly ? this goes straight to the administrator's triage inbox.</p></div>
      <button class="btn btn--ghost" id="back-btn" type="button">? Back to my reports</button>
    </div>
  `));
  main.querySelector("#back-btn").addEventListener("click", () => { ui.view = "overview"; ui.reportPhoto = null; render(); });

  const panel = el(`<div class="panel"></div>`);
  panel.innerHTML = `
    <div class="field">
      <label class="label" for="f-title">Title</label>
      <input type="text" id="f-title" placeholder="Short summary of the problem" maxlength="${MAX_TITLE}" />
      <div class="char-counter" id="title-counter">0 / ${MAX_TITLE}</div>
    </div>
    <div class="field">
      <label class="label" for="f-category">Category</label>
      <select id="f-category">${CATEGORIES.map(c => `<option>${esc(c)}</option>`).join("")}</select>
      <span class="hint" id="sla-hint"></span>
    </div>
    <div class="field">
      <label class="label" for="f-desc">Description</label>
      <textarea id="f-desc" placeholder="What's wrong, where exactly, and since when?" maxlength="${MAX_DESC}"></textarea>
      <div class="char-counter" id="desc-counter">0 / ${MAX_DESC}</div>
    </div>
    <div class="field">
      <span class="label">Photo (optional)</span>
      <div class="photo-drop" id="f-photo-drop">Click or drop a photo of the problem here</div>
      <div class="photo-preview" id="f-photo-preview"></div>
    </div>
    <button class="btn btn--primary" id="f-submit" type="button">Submit report</button>
  `;
  main.appendChild(panel);

  const titleInput = panel.querySelector("#f-title");
  const titleCounter = panel.querySelector("#title-counter");
  const descInput = panel.querySelector("#f-desc");
  const descCounter = panel.querySelector("#desc-counter");
  const categorySelect = panel.querySelector("#f-category");
  const slaHint = panel.querySelector("#sla-hint");

  function updateCounter(input, counter, max) {
    const len = input.value.length;
    counter.textContent = `${len} / ${max}`;
    counter.className = "char-counter" + (len >= max ? " is-over" : len > max * 0.9 ? " is-warn" : "");
  }
  function updateSlaHint() {
    const days = SLA_DAYS[categorySelect.value] ?? 5;
    slaHint.textContent = `Target response time for this category: ${days} day${days === 1 ? "" : "s"}.`;
  }
  titleInput.addEventListener("input", () => updateCounter(titleInput, titleCounter, MAX_TITLE));
  descInput.addEventListener("input", () => updateCounter(descInput, descCounter, MAX_DESC));
  categorySelect.addEventListener("change", updateSlaHint);
  updateSlaHint();

  const preview = panel.querySelector("#f-photo-preview");
  const refreshPreview = () => { preview.innerHTML = ui.reportPhoto ? `<img src="${ui.reportPhoto}" alt="Attached photo of the problem" />` : ""; };
  wireDropZone(panel.querySelector("#f-photo-drop"), (dataUrl) => { ui.reportPhoto = dataUrl; refreshPreview(); });
  refreshPreview();

  panel.querySelector("#f-submit").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    if (!title || !description) { toast("Add a title and description before submitting."); return; }
    withBusy(button, "Submitting...", async () => {
      const photoUrl = await uploadPhoto(ui.reportPhoto);
      await api("/reports", { method: "POST", body: JSON.stringify({ title, description, category: categorySelect.value, photoUrl }) });
      await refreshFromApi();
      ui.reportPhoto = null;
      ui.view = "overview";
      toast("Report submitted ? the administrator will review it shortly.");
      render();
    });
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
  const mine = sortByUrgency(db.problems.filter(p => p.assignedTo === user.username && p.status !== "completed"));
  main.appendChild(el(`
    <div class="page-head">
      <div><h2>My assignments</h2><p class="sub">Problems assigned to you in ${esc(user.department)} that still need work. Overdue jobs are listed first.</p></div>
    </div>
  `));
  main.appendChild(renderFilteredLedger(mine, {
    showCitizen: true,
    label: "My assignments",
    emptyText: "No open assignments right now ? everything you've been given is finished.",
  }));
}

function renderStaffHistory(main, user) {
  const done = db.problems.filter(p => p.assignedTo === user.username && p.status === "completed").sort((a, b) => b.completedAt - a.completedAt);
  main.appendChild(el(`
    <div class="page-head"><div><h2>Completed by me</h2><p class="sub">Your finished work and the ratings residents gave it.</p></div></div>
  `));
  main.appendChild(renderFilteredLedger(done, {
    showCitizen: true,
    label: "Completed work",
    emptyText: "You haven't completed any jobs yet.",
  }));
}

function renderStaffWallet(main, user) {
  main.appendChild(el(`
    <div class="page-head"><div><h2>My coin wallet</h2><p class="sub">Coins are awarded when a resident rates your completed work. The administrator converts coins to payout.</p></div></div>
  `));

  const completed = db.problems.filter(p => p.assignedTo === user.username && p.status === "completed");
  const unrated = completed.filter(p => p.rating === null);
  const potential = unrated.length * 5 * COIN_RATE; // best case: a 5-star rating each
  const strip = el(`
    <div class="stat-strip">
      <div class="stat accent"><div class="n anim-counter" id="coin-count">0</div><div class="l">Coin balance</div></div>
      <div class="stat"><div class="n anim-counter" id="jobs-count">0</div><div class="l">Jobs completed</div></div>
      <div class="stat"><div class="n">${avgRating(user.username) ?? "?"}</div><div class="l">Average rating</div></div>
      <div class="stat"><div class="n anim-counter" id="pending-count">0</div><div class="l">Coins awaiting rating</div></div>
    </div>
  `);
  main.appendChild(strip);
  requestAnimationFrame(() => {
    animateCount(strip.querySelector("#coin-count"), user.coins, 900);
    animateCount(strip.querySelector("#jobs-count"), completed.length, 700);
    animateCount(strip.querySelector("#pending-count"), potential, 800);
  });
  if (unrated.length) {
    main.appendChild(el(`<div class="mark-notice">
      <strong>${unrated.length} completed job${unrated.length > 1 ? "s" : ""} not rated yet.</strong>
      <p>Coins are released as soon as the resident rates the work ? up to ${potential} coins in total.</p>
    </div>`));
  }

  const earned = db.problems.filter(p => p.assignedTo === user.username && p.coinsAwarded).sort((a, b) => b.ratedAt - a.ratedAt);
  const spent = db.conversions.filter(c => c.staff === user.username).sort((a, b) => b.timestamp - a.timestamp);

  const panel = el(`<div class="panel"><h3>Coin history</h3></div>`);
  const rows = [
    ...earned.map(p => ({ ts: p.ratedAt, text: `Earned for ?${p.title}? (${p.rating}? rating)`, delta: `+${p.coinsAwarded}` })),
    ...spent.map(c => ({ ts: c.timestamp, text: "Converted to payout by administrator", delta: `-${c.coins}` })),
  ].sort((a, b) => b.ts - a.ts);

  if (!rows.length) {
    panel.appendChild(el(`<p class="sub" style="color:var(--ink-faint);font-size:13.5px;">No coin activity yet.</p>`));
  } else {
    const table = el(`<table class="table-mini"><thead><tr><th>Date</th><th>Activity</th><th style="text-align:right;">Coins</th></tr></thead><tbody></tbody></table>`);
    const body = table.querySelector("tbody");
    rows.forEach(r => body.appendChild(el(`<tr>
      <td class="rel-time" data-ts="${r.ts}" title="${esc(fmtDateShort(r.ts))}">${esc(timeAgo(r.ts))}</td>
      <td>${esc(r.text)}</td>
      <td class="coin" style="justify-content:flex-end;">${esc(r.delta)}</td>
    </tr>`)));
    panel.appendChild(table);
  }
  main.appendChild(panel);
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
  const overdue = db.problems.filter(p => { const d = dueMeta(p); return d && d.level === "over"; }).length;
  const rated = db.problems.filter(p => p.rating);
  const avg = rated.length ? (rated.reduce((sum, p) => sum + p.rating, 0) / rated.length).toFixed(1) : "?";

  main.appendChild(el(`<div class="page-head"><div><h2>Overview</h2><p class="sub">City-wide status across all departments.</p></div></div>`));

  const strip = el(`<div class="stat-strip">
    <div class="stat"><div class="n anim-counter" id="s-total">0</div><div class="l">Total reports</div></div>
    <div class="stat accent"><div class="n anim-counter" id="s-submitted">0</div><div class="l">Awaiting triage</div></div>
    <div class="stat"><div class="n anim-counter" id="s-active">0</div><div class="l">In progress</div></div>
    <div class="stat${overdue ? " warn" : ""}"><div class="n anim-counter" id="s-overdue">0</div><div class="l">Past target date</div></div>
    <div class="stat"><div class="n anim-counter" id="s-done">0</div><div class="l">Completed</div></div>
    <div class="stat"><div class="n">${avg}</div><div class="l">Average rating</div></div>
  </div>`);
  main.appendChild(strip);
  requestAnimationFrame(() => {
    animateCount(strip.querySelector("#s-total"), total, 800);
    animateCount(strip.querySelector("#s-submitted"), submitted, 600);
    animateCount(strip.querySelector("#s-active"), active, 700);
    animateCount(strip.querySelector("#s-overdue"), overdue, 650);
    animateCount(strip.querySelector("#s-done"), completed, 750);
  });

  main.appendChild(el(`<h3 style="margin-bottom:12px;">Recent activity</h3>`));
  const recent = [...db.problems]
    .sort((a, b) => (b.ratedAt || b.completedAt || b.assignedAt || b.createdAt) - (a.ratedAt || a.completedAt || a.assignedAt || a.createdAt))
    .slice(0, 8);
  main.appendChild(renderFilteredLedger(recent, { showCitizen: true, showAssignee: true, label: "Recent activity" }));
}

function renderAdminTriage(main, user) {
  const inbox = sortByUrgency(db.problems.filter(p => p.status === "submitted"));
  main.appendChild(el(`
    <div class="page-head"><div><h2>Triage inbox</h2><p class="sub">New reports ? set a priority and assign to a department staff member. Oldest and overdue first.</p></div></div>
  `));
  main.appendChild(renderFilteredLedger(inbox, {
    showCitizen: true,
    label: "Triage inbox",
    emptyText: "Nothing waiting ? every submitted report has been triaged.",
  }));
}

function renderAdminAssigned(main, user) {
  const active = sortByUrgency(db.problems.filter(p => p.status === "assigned" || p.status === "in-progress"));
  main.appendChild(el(`
    <div class="page-head"><div><h2>Assigned work</h2><p class="sub">Everything currently with a department, and its progress.</p></div></div>
  `));
  main.appendChild(renderFilteredLedger(active, {
    showCitizen: true,
    showAssignee: true,
    label: "Assigned work",
    emptyText: "No work is currently assigned.",
  }));
}

function renderAdminStaff(main, user) {
  const staff = db.users.filter(u => u.role === "staff").sort((a, b) => a.name.localeCompare(b.name));
  main.appendChild(el(`
    <div class="page-head"><div><h2>Staff directory</h2><p class="sub">Add department staff, record their specialties, and review the work they have completed.</p></div></div>
  `));

  const form = el(`<div class="panel staff-form"><h3>Add department staff</h3></div>`);
  form.insertAdjacentHTML("beforeend", `
    <div class="grid-2">
      <div class="field"><label class="label" for="staff-name">Full name</label><input type="text" id="staff-name" placeholder="e.g. Arun Kumar" /></div>
      <div class="field"><label class="label" for="staff-department">Department</label><select id="staff-department">${CATEGORIES.map(c => `<option>${esc(c)}</option>`).join("")}</select></div>
    </div>
    <div class="field">
      <label class="label" for="staff-work-types">Work specialties</label>
      <input type="text" id="staff-work-types" placeholder="e.g. Pothole repair, Drain cleaning" />
      <span class="hint">Separate multiple work types with commas.</span>
    </div>
    <div class="grid-2">
      <div class="field"><label class="label" for="staff-username">Username</label><input type="text" id="staff-username" placeholder="e.g. staff_arun" /></div>
      <div class="field"><label class="label" for="staff-password">Temporary password</label><input type="text" id="staff-password" placeholder="At least 6 characters" /></div>
    </div>
    <button class="btn btn--primary" type="button" id="add-staff-btn">Add staff member</button>
  `);
  form.querySelector("#add-staff-btn").addEventListener("click", (event) => {
    withBusy(event.currentTarget, "Adding...", async () => {
      const name = form.querySelector("#staff-name").value.trim();
      const department = form.querySelector("#staff-department").value;
      const requestedUsername = form.querySelector("#staff-username").value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      const password = form.querySelector("#staff-password").value;
      const workTypes = form.querySelector("#staff-work-types").value.split(",").map(type => type.trim()).filter(Boolean);
      if (!name || !requestedUsername || !password) { toast("Add the name, username, and temporary password."); return; }
      if (password.length < 6) { toast("Use at least 6 characters for the temporary password."); return; }
      if (db.users.some(member => member.username === requestedUsername)) { toast("That username is already in use."); return; }
      await api("/users", { method: "POST", body: JSON.stringify({ username: requestedUsername, password, name, department, workTypes }) });
      await refreshFromApi();
      saveDB();
      toast(`${name} was added to the ${department} team.`);
      render();
    });
  });
  main.appendChild(form);

  const directory = el(`<section class="staff-directory">
    <div class="helper-row"><h3>Department staff <span class="directory-count">${staff.length}</span></h3><span class="sub" style="color:var(--ink-faint);font-size:12.5px;">Live team roster</span></div>
    <div class="staff-directory__grid"></div>
  </section>`);
  const grid = directory.querySelector(".staff-directory__grid");

  if (!staff.length) {
    grid.appendChild(el(`<div class="panel"><p class="sub">No department staff yet. Add the first team member above.</p></div>`));
  }

  staff.forEach(member => {
    const completed = db.problems.filter(p => p.assignedTo === member.username && p.status === "completed");
    const open = db.problems.filter(p => p.assignedTo === member.username && p.status !== "completed").length;
    const workedCategories = [...new Set(completed.map(p => p.category))];
    const types = [...new Set([...(member.workTypes || []), ...workedCategories])];
    grid.appendChild(el(`<article class="staff-card">
      <div class="staff-card__head">
        <div class="staff-avatar" aria-hidden="true">${esc(member.name.charAt(0))}</div>
        <div><h3>${esc(member.name)}</h3><p>${esc(member.department)}</p></div>
      </div>
      <div class="staff-card__stats">
        <span><strong>${completed.length}</strong> completed</span>
        <span><strong>${open}</strong> open</span>
        <span><strong>${avgRating(member.username) ?? "?"}</strong> rating</span>
        <span class="coin">${member.coins}</span>
      </div>
      <div class="staff-card__label">Work types handled</div>
      <div class="staff-card__types">${types.length ? types.map(type => `<span>${esc(type)}</span>`).join("") : "<em>No work types recorded yet.</em>"}</div>
    </article>`));
  });

  main.appendChild(directory);
}

function renderAdminRewards(main, user) {
  const staff = db.users.filter(u => u.role === "staff");
  main.appendChild(el(`
    <div class="page-head"><div><h2>Rewards &amp; payouts</h2><p class="sub">Coins are earned from resident ratings. Convert a staff member's balance to a payout at ${CASH_RATE} coins = 1 unit of currency.</p></div></div>
  `));

  const panel = el(`<div class="panel"></div>`);
  const table = el(`<table class="table-mini"><thead><tr><th>Staff</th><th>Department</th><th>Avg rating</th><th>Coin balance</th><th></th></tr></thead><tbody></tbody></table>`);
  const body = table.querySelector("tbody");

  if (!staff.length) {
    panel.appendChild(el(`<p class="sub">No department staff to pay out yet.</p>`));
  }

  staff.forEach(member => {
    const row = el(`<tr>
      <td>${esc(member.name)}</td>
      <td>${esc(member.department)}</td>
      <td>${avgRating(member.username) ?? "?"}</td>
      <td class="coin">${member.coins}</td>
      <td style="text-align:right;">
        <button class="btn btn--sm btn--teal" ${member.coins <= 0 ? "disabled" : ""} data-user="${esc(member.username)}" type="button">Convert to payout</button>
      </td>
    </tr>`);
    row.querySelector("button").addEventListener("click", (event) => {
      withBusy(event.currentTarget, "Converting...", async () => {
        await api("/payouts", { method: "POST", body: JSON.stringify({ staffId: member.apiId || member.id }) });
        await refreshFromApi();
        const amount = (member.coins / CASH_RATE).toFixed(2);
        db.conversions.unshift({
          id: "CV-" + Date.now(),
          staff: member.username,
          staffName: member.name,
          coins: member.coins,
          amount: Number(amount),
          timestamp: Date.now(),
        });
        member.coins = 0;
        saveDB();
        toast(`Converted ${member.name}'s coins to a payout of ${amount}.`);
        render();
      });
    });
    body.appendChild(row);
  });
  panel.appendChild(table);
  main.appendChild(panel);

  const history = el(`<div class="panel"><h3>Payout history</h3></div>`);
  if (!db.conversions.length) {
    history.appendChild(el(`<p class="sub" style="color:var(--ink-faint);font-size:13.5px;">No payouts recorded yet.</p>`));
  } else {
    const t2 = el(`<table class="table-mini"><thead><tr><th>Date</th><th>Staff</th><th>Coins</th><th>Payout</th></tr></thead><tbody></tbody></table>`);
    const b2 = t2.querySelector("tbody");
    [...db.conversions].sort((a, b) => b.timestamp - a.timestamp).forEach(c => {
      b2.appendChild(el(`<tr>
        <td class="rel-time" data-ts="${c.timestamp}" title="${esc(fmtDateShort(c.timestamp))}">${esc(timeAgo(c.timestamp))}</td>
        <td>${esc(c.staffName)}</td>
        <td class="coin">${c.coins}</td>
        <td>${c.amount}</td>
      </tr>`));
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
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeDrawer(); });

  const drawer = el(`<div class="drawer"></div>`);
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", `${p.id}: ${p.title}`);
  drawer.tabIndex = -1;

  const head = el(`
    <div class="drawer__head">
      <div>
        <div class="drawer__id">${esc(p.id)}</div>
        <h3 style="margin-top:4px;">${esc(p.title)}</h3>
      </div>
      <button class="btn btn--ghost btn--sm" id="close-drawer" type="button">Close ?</button>
    </div>
  `);
  head.querySelector("#close-drawer").addEventListener("click", closeDrawer);
  drawer.appendChild(head);

  const body = el(`<div class="drawer__body"></div>`);
  body.appendChild(el(`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">${tagStatus(p.status)}${dueTag(p)}${tagPriority(p.priority)}</div>`));

  const resolvedIn = p.completedAt && p.createdAt
    ? Math.max(1, Math.round((p.completedAt - p.createdAt) / DAY_MS))
    : null;

  body.appendChild(el(`<div class="panel" style="margin-bottom:18px;">
    <div style="font-size:12px;color:var(--ink-faint);margin-bottom:10px;">
      ${esc(p.category)} ? Reported by ${esc(p.citizenName)} on ${esc(fmtDateShort(p.createdAt))}
      ${p.assignedToName ? " ? Assigned to " + esc(p.assignedToName) : ""}
      ${resolvedIn ? " ? Resolved in " + resolvedIn + " day" + (resolvedIn === 1 ? "" : "s") : ""}
    </div>
    <p style="line-height:1.6;font-size:14px;">${esc(p.description)}</p>
    ${p.photo ? `<div class="photo-preview"><img src="${p.photo}" alt="Photo attached to ${esc(p.id)}" style="width:100%;max-width:260px;height:auto;" /></div>` : ""}
  </div>`));

  if (user.role === "admin" && p.status === "submitted") {
    body.appendChild(renderAssignmentPanel(p, { reassign: false }));
  }

  if (user.role === "admin" && (p.status === "assigned" || p.status === "in-progress")) {
    body.appendChild(el(`<div class="panel" style="margin-bottom:18px;font-size:12.5px;color:var(--ink-soft);">
      Assigned to <strong>${esc(p.assignedToName)}</strong> (${esc(p.department || "?")}). Priority: <strong>${esc(priorityLabel(p.priority))}</strong>.
    </div>`));
    body.appendChild(renderAssignmentPanel(p, { reassign: true }));
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

  /* Keep focus inside the dialog while it is open. */
  overlay.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusables = drawer.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  requestAnimationFrame(() => { try { drawer.focus({ preventScroll: true }); } catch (e) { drawer.focus(); } });

  return overlay;
}

/* Shared by first-time triage and by re-assignment of work in flight. */
function renderAssignmentPanel(p, { reassign }) {
  const panel = el(`<div class="panel" style="margin-bottom:18px;"><h3>${reassign ? "Reassign or change priority" : "Triage this report"}</h3></div>`);

  panel.appendChild(el(`<span class="label" style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:var(--ink-soft);">Priority</span>`));
  const chips = el(`<div class="chip-select" style="margin-bottom:16px;"></div>`);
  let selectedPriority = p.priority || "medium";
  PRIORITIES.forEach(pr => {
    const active = pr === selectedPriority;
    const button = el(`<button type="button" data-p="${pr}" aria-pressed="${active}" class="${active ? "is-active" : ""}">${esc(priorityLabel(pr))}</button>`);
    button.addEventListener("click", () => {
      selectedPriority = pr;
      chips.querySelectorAll("button").forEach(x => {
        const on = x === button;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", String(on));
      });
    });
    chips.appendChild(button);
  });
  panel.appendChild(chips);

  const staffOptions = db.users.filter(u => u.role === "staff");
  if (!staffOptions.length) {
    panel.appendChild(el(`<p class="sub">No department staff exist yet ? add someone in the staff directory first.</p>`));
    return panel;
  }

  panel.appendChild(el(`<div class="field">
    <label class="label" for="assign-select">Assign to</label>
    <select id="assign-select">
      ${staffOptions.map(s => `<option value="${esc(s.username)}" ${s.username === p.assignedTo ? "selected" : s.department === p.category && !p.assignedTo ? "selected" : ""}>${esc(s.name)} ? ${esc(s.department)}</option>`).join("")}
    </select>
  </div>`));

  const button = el(`<button class="btn btn--primary" type="button">${reassign ? "Update assignment" : "Set priority and assign"}</button>`);
  button.addEventListener("click", () => {
    withBusy(button, "Saving...", async () => {
      const staffUser = db.users.find(u => u.username === panel.querySelector("#assign-select").value);
      if (!staffUser) { toast("Pick a staff member to assign this to."); return; }
      await api(`/reports/${p.apiId}/assignment`, { method: "PATCH", body: JSON.stringify({ staffId: staffUser.apiId || staffUser.id, priority: selectedPriority }) });
      await refreshFromApi();
      const changedOwner = p.assignedTo !== staffUser.username;
      p.priority = selectedPriority;
      p.assignedTo = staffUser.username;
      p.assignedToName = staffUser.name;
      p.department = staffUser.department;
      p.assignedAt = changedOwner || !p.assignedAt ? Date.now() : p.assignedAt;
      if (!reassign || p.status === "submitted") p.status = "assigned";

      /* Re-assignments are auditable, not silent. */
      if (reassign && changedOwner) {
        p.updates.push({
          id: "U" + Date.now(),
          text: `Reassigned to ${staffUser.name} (${staffUser.department}). Priority set to ${priorityLabel(selectedPriority).toLowerCase()}.`,
          percent: latestPercent({ ...p, status: "in-progress" }),
          photo: null,
          timestamp: Date.now(),
          author: "Administrator",
        });
      }
      saveDB();
      toast(`Assigned to ${staffUser.name}.`);
      render();
    });
  });
  panel.appendChild(button);
  return panel;
}

function nextSuggestedPercent(p) {
  if (!p.updates.length) return 25;
  return Math.min(90, (p.updates[p.updates.length - 1].percent || 0) + 25);
}

function renderStaffActionPanel(p) {
  const panel = el(`<div class="panel" style="margin-bottom:18px;"><h3>Update progress</h3></div>`);

  panel.insertAdjacentHTML("beforeend", `
    <div class="field">
      <label class="label" for="update-note">Note</label>
      <textarea id="update-note" placeholder="What did you do, and what's left?"></textarea>
    </div>
    <div class="field">
      <label class="label" for="update-percent">Percent complete</label>
      <div class="slider-wrap">
        <input type="range" id="update-percent" min="0" max="100" value="${nextSuggestedPercent(p)}" />
        <output class="slider-val" id="slider-display">${nextSuggestedPercent(p)}%</output>
      </div>
    </div>
    <div class="field">
      <span class="label">Photo (optional)</span>
      <div class="photo-drop" id="update-photo-drop">Click or drop a progress photo here</div>
      <div class="photo-preview" id="update-photo-preview"></div>
    </div>
  `);

  const slider = panel.querySelector("#update-percent");
  const sliderDisplay = panel.querySelector("#slider-display");
  slider.addEventListener("input", () => { sliderDisplay.textContent = slider.value + "%"; });

  const preview = panel.querySelector("#update-photo-preview");
  const refresh = () => { preview.innerHTML = ui.updatePhoto ? `<img src="${ui.updatePhoto}" alt="Progress photo" />` : ""; };
  wireDropZone(panel.querySelector("#update-photo-drop"), (dataUrl) => { ui.updatePhoto = dataUrl; refresh(); });
  refresh();

  const addBtn = el(`<button class="btn btn--teal" type="button" style="margin-right:10px;">Add progress update</button>`);
  addBtn.addEventListener("click", () => {
    const text = panel.querySelector("#update-note").value.trim();
    const percent = Math.max(0, Math.min(100, Number(slider.value) || 0));
    if (!text) { toast("Add a short note describing the update."); return; }
    withBusy(addBtn, "Saving...", async () => {
      const photoUrl = await uploadPhoto(ui.updatePhoto);
      await api(`/reports/${p.apiId}/updates`, { method: "POST", body: JSON.stringify({ note: text, percent, photoUrl }) });
      await refreshFromApi();
      p.updates.push({ id: "U" + Date.now(), text, percent, photo: ui.updatePhoto || null, timestamp: Date.now(), author: p.assignedToName });
      p.status = "in-progress";
      ui.updatePhoto = null;
      saveDB();
      toast("Progress update added.");
      render();
    });
  });
  panel.appendChild(addBtn);

  panel.appendChild(el(`<hr class="divider" />`));
  panel.appendChild(el(`<div class="field">
    <span class="label">Completion photo (recommended)</span>
    <div class="photo-drop" id="complete-photo-drop">Click or drop a photo of the finished work here</div>
    <div class="photo-preview" id="complete-photo-preview"></div>
  </div>`));
  const cPreview = panel.querySelector("#complete-photo-preview");
  const refreshC = () => { cPreview.innerHTML = ui.completionPhoto ? `<img src="${ui.completionPhoto}" alt="Completion photo" />` : ""; };
  wireDropZone(panel.querySelector("#complete-photo-drop"), (dataUrl) => { ui.completionPhoto = dataUrl; refreshC(); });
  refreshC();

  const completeBtn = el(`<button class="btn btn--ochre" type="button">Mark as completed</button>`);
  completeBtn.addEventListener("click", () => {
    withBusy(completeBtn, "Completing...", async () => {
      const photoUrl = await uploadPhoto(ui.completionPhoto);
      await api(`/reports/${p.apiId}/complete`, { method: "POST", body: JSON.stringify({ photoUrl }) });
      await refreshFromApi();
      p.status = "completed";
      p.completedAt = Date.now();
      p.completionPhoto = ui.completionPhoto || null;
      const last = p.updates[p.updates.length - 1];
      if (!last || (last.percent || 0) < 100) {
        p.updates.push({ id: "U" + Date.now(), text: "Marked as completed.", percent: 100, photo: ui.completionPhoto || null, timestamp: Date.now(), author: p.assignedToName });
      }
      ui.completionPhoto = null;
      saveDB();
      toast("Marked completed. The resident can now rate the work.");
      render();
    });
  });
  panel.appendChild(completeBtn);
  return panel;
}

function renderTimeline(p) {
  const panel = el(`<div class="panel" style="margin-bottom:18px;"><h3>Progress timeline</h3></div>`);
  const tl = el(`<div class="timeline"></div>`);

  tl.appendChild(el(`<div class="timeline-step">
    <div class="timeline-step__head">
      <span>Reported by ${esc(p.citizenName)}</span>
      <span class="timeline-step__time rel-time" data-ts="${p.createdAt}" title="${esc(fmtDate(p.createdAt))}">${esc(timeAgo(p.createdAt))}</span>
    </div>
  </div>`));

  if (p.assignedAt) {
    tl.appendChild(el(`<div class="timeline-step">
      <div class="timeline-step__head">
        <span>Assigned to ${esc(p.assignedToName || "?")}</span>
        <span class="timeline-step__time rel-time" data-ts="${p.assignedAt}" title="${esc(fmtDate(p.assignedAt))}">${esc(timeAgo(p.assignedAt))}</span>
      </div>
    </div>`));
  }

  p.updates.forEach(u => {
    const step = el(`<div class="timeline-step">
      <div class="timeline-step__head">
        <span>${u.percent}% ? ${esc(u.author)}</span>
        <span class="timeline-step__time rel-time" data-ts="${u.timestamp}" title="${esc(fmtDate(u.timestamp))}">${esc(timeAgo(u.timestamp))}</span>
      </div>
      <div class="timeline-step__note"></div>
    </div>`);
    step.querySelector(".timeline-step__note").textContent = u.text;
    step.appendChild(progressBar(u.percent, u.percent >= 100));
    if (u.photo) step.appendChild(el(`<img src="${u.photo}" alt="Progress photo attached to ${esc(p.id)}" />`));
    tl.appendChild(step);
  });

  if (p.status === "completed" && p.rating) {
    tl.appendChild(el(`<div class="timeline-step">
      <div class="timeline-step__head">
        <span>Rated by ${esc(p.citizenName)}</span>
        <span class="timeline-step__time rel-time" data-ts="${p.ratedAt}" title="${esc(fmtDate(p.ratedAt))}">${esc(timeAgo(p.ratedAt))}</span>
      </div>
      <div class="timeline-step__note">${"?".repeat(p.rating)}${"?".repeat(5 - p.rating)}${p.feedback ? " ? " + esc(p.feedback) : ""}</div>
    </div>`));
  }

  panel.appendChild(tl);
  return panel;
}

function renderRatingPanel(p) {
  if (p.rating) {
    return el(`<div class="panel">
      <h3>Your feedback</h3>
      <div class="stars readonly" role="img" aria-label="${p.rating} out of 5 stars">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" disabled class="${n <= p.rating ? "is-filled" : ""}" tabindex="-1" aria-hidden="true">?</button>`).join("")}
      </div>
      <p style="margin-top:8px;font-size:13.5px;color:var(--ink-soft);">${esc(p.feedback || "")}</p>
    </div>`);
  }

  const panel = el(`<div class="panel">
    <h3>Rate this completed report</h3>
    <p style="font-size:13px;color:var(--ink-soft);margin-bottom:12px;">
      Your rating awards coins to ${esc(p.assignedToName || "the crew")} at ${COIN_RATE} coins per star.
    </p>
  </div>`);

  let rating = 0;
  const stars = el(`<div class="stars" role="group" aria-label="Rating out of 5 stars"></div>`);
  const rewardLine = el(`<p style="margin-top:8px;font-size:12.5px;color:var(--ink-faint);"></p>`);
  for (let n = 1; n <= 5; n++) {
    const button = el(`<button type="button" data-n="${n}" aria-label="${n} star${n > 1 ? "s" : ""}" aria-pressed="false">?</button>`);
    button.addEventListener("click", () => {
      rating = n;
      stars.querySelectorAll("button").forEach((s, i) => {
        s.classList.toggle("is-filled", i < rating);
        s.setAttribute("aria-pressed", String(i < rating));
      });
      rewardLine.textContent = `${rating * COIN_RATE} coins will be awarded to ${p.assignedToName}.`;
    });
    stars.appendChild(button);
  }
  panel.appendChild(stars);
  panel.appendChild(rewardLine);
  panel.appendChild(el(`<div class="field" style="margin-top:14px;">
    <label class="label" for="feedback-text">Feedback (optional)</label>
    <textarea id="feedback-text" placeholder="How was the service?"></textarea>
  </div>`));

  const submit = el(`<button class="btn btn--primary" type="button">Submit rating</button>`);
  submit.addEventListener("click", () => {
    if (!rating) { toast("Choose a star rating first."); return; }
    withBusy(submit, "Saving...", async () => {
      await api(`/reports/${p.apiId}/rating`, { method: "POST", body: JSON.stringify({ score: rating, feedback: panel.querySelector("#feedback-text").value.trim() }) });
      await refreshFromApi();
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
  });
  panel.appendChild(submit);
  return panel;
}

/* ---------------- Boot ---------------- */

/* Installed exactly once: Escape closes the drawer, then the sidebar. */
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (ui.detailId) { closeDrawer(); return; }
  if (ui.sidebarOpen) setSidebar(false);
});

function showStorageNote() {
  if (document.querySelector(".storage-note")) return;
  const note = el(`<div class="storage-note" role="status"></div>`);
  note.textContent = "Preview mode ? reports stay in this tab and won't be saved.";
  document.body.appendChild(note);
}

startRelativeTimeTicker();
async function boot() {
  if (getSession()?.token) {
    try {
      await refreshFromApi();
    } catch (error) {
      console.warn("Could not restore the signed-in session.", error);
      clearSession();
    }
  }
  render();
  if (!localStore.persistent) showStorageNote();
}
boot();

