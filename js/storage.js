/* storage.js - the ONLY file that touches localStorage, plus small shared utilities. */
const KEYS = {
  company: "hcm_company",
  users: "hcm_users",
  attendance: "hcm_attendance",
  leaves: "hcm_leaves",
  session: "hcm_session",
};
const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
  company() {
    return Store.get(KEYS.company, null);
  },
  users() {
    return Store.get(KEYS.users, []);
  },
  attendance() {
    return Store.get(KEYS.attendance, []);
  },
  leaves() {
    return Store.get(KEYS.leaves, []);
  },
  // Create EMPTY collections only (no sample data).
  init() {
    [KEYS.users, KEYS.attendance, KEYS.leaves].forEach((k) => {
      if (localStorage.getItem(k) === null) Store.set(k, []);
    });
  },
};
Store.init();

/* ---- utilities ---- */
const $ = (s, r = document) => r.querySelector(s);
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // local date -> "YYYY-MM-DD"
const parseYmd = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const todayStr = () => ymd(new Date());
const nowHM = () => {
  const d = new Date();
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
};
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmtHours = (m) => `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
const money = (n) =>
  "PKR " +
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const badge = (text, cls) => `<span class="badge b-${cls}">${esc(text)}</span>`;
const isWorkingDay = (date, company) =>
  company.workingDays.includes(date.getDay()); // date is a Date
function eachDay(start, end) {
  const out = [];
  const d = parseYmd(start),
    e = parseYmd(end);
  while (d <= e) {
    out.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
// Shows errors beside fields: <span class="err" data-for="fieldName">. Returns true when there are no errors.
function showErrors(form, errs) {
  form.querySelectorAll(".err").forEach((s) => {
    s.textContent = errs[s.dataset.for] || "";
  });
  const first = Object.keys(errs)[0];
  if (first && form.elements[first]) form.elements[first].focus();
  return Object.keys(errs).length === 0;
}
function toast(msg, bad) {
  const t = document.createElement("div");
  t.className = "toast" + (bad ? " bad" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
