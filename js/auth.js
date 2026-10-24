/* auth.js - setup, login, session, role checks, shared navigation.
   EDUCATIONAL DEMO ONLY: localStorage data can be read/edited by anyone using the browser, and the hash below is
   weak. This is NOT secure for real HR data. Real apps need a server, salted slow hashes (bcrypt/argon2), HTTPS. */
const Auth = {
  hash(p) {
    let h = 5381;
    const s = "hcm-demo:" + p;
    for (let i = 0; i < s.length; i++)
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  },
  validEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  },
  // The role ALWAYS comes from hcm_users, never from the session object (a tampered session role is ignored).
  current() {
    const s = Store.get(KEYS.session, null);
    if (!s || !s.userId) return null;
    return Store.users().find((u) => u.id === s.userId) || null;
  },
  home(u) {
    return u.role === "admin" ? "admin.html" : "employee.html";
  },
  // Page guard: redirects and stops the page script (throws) when not allowed.
  require(role) {
    const u = Auth.current();
    if (!u || !Store.company()) {
      location.replace("index.html");
      throw new Error("Not signed in");
    }
    if (role && u.role !== role) {
      location.replace(Auth.home(u));
      throw new Error("Wrong role");
    }
    return u;
  },
  // Service-level checks: every data function re-verifies the CURRENT user, ignoring any IDs/UI the user controls.
  assertAdmin() {
    const u = Auth.current();
    if (!u || u.role !== "admin") throw new Error("Admin access required");
    return u;
  },
  assertSelfOrAdmin(userId) {
    const u = Auth.current();
    if (!u || (u.role !== "admin" && u.id !== userId))
      throw new Error("Access denied");
    return u;
  },

  setup(d) {
    const e = {};
    if (Store.company())
      e.company = "Company is already set up. Please log in.";
    if (!d.company.trim()) e.company = "Company name is required";
    if (!d.name.trim()) e.name = "Your name is required";
    if (!d.email.trim()) e.email = "Email is required";
    else if (!Auth.validEmail(d.email.trim())) e.email = "Enter a valid email";
    if (d.password.length < 6)
      e.password = "Password must be at least 6 characters";
    if (Object.keys(e).length) return e;
    Store.set(KEYS.company, {
      name: d.company.trim(),
      startTime: "09:00",
      graceMinutes: 15,
      leaveQuota: 20,
      workingDays: [1, 2, 3, 4, 5],
      createdAt: todayStr(),
    });
    const admin = {
      id: uid(),
      name: d.name.trim(),
      email: d.email.trim().toLowerCase(),
      passHash: Auth.hash(d.password),
      role: "admin",
      department: "Administration",
      salary: 0,
      joinDate: todayStr(),
    };
    Store.set(KEYS.users, [admin]);
    Store.set(KEYS.session, { userId: admin.id, at: Date.now() });
    return e;
  },
  login(email, password) {
    const u = Store.users().find((x) => x.email === email.trim().toLowerCase());
    if (!u || u.passHash !== Auth.hash(password)) return null;
    Store.set(KEYS.session, { userId: u.id, at: Date.now() });
    return u;
  },
  logout() {
    Store.remove(KEYS.session);
    location.replace("index.html");
  },
  changePassword(oldP, newP, confirmP) {
    const u = Auth.current(),
      e = {};
    if (!u) throw new Error("Not signed in");
    if (u.passHash !== Auth.hash(oldP))
      e.oldp = "Current password is incorrect";
    if (newP.length < 6) e.newp = "At least 6 characters";
    if (newP !== confirmP) e.conf = "Passwords do not match";
    if (Object.keys(e).length) return e;
    const users = Store.users();
    users.find((x) => x.id === u.id).passHash = Auth.hash(newP);
    Store.set(KEYS.users, users);
    return e;
  },
  // Renders the navigation bar + password dialog on every protected page.
  shell(active) {
    const u = Auth.current(),
      c = Store.company();
    const links =
      u.role === "admin"
        ? [
            ["admin.html", "Dashboard"],
            ["employees.html", "Employees"],
            ["leaves.html", "Leaves"],
            ["payslip.html", "Payslips"],
            ["settings.html", "Settings"],
          ]
        : [
            ["employee.html", "Dashboard"],
            ["payslip.html", "Payslip"],
          ];
    $("#nav").innerHTML =
      `<nav><b>${esc(c.name)}</b>${links.map((l) => `<a href="${l[0]}" class="${l[0] === active ? "on" : ""}">${l[1]}</a>`).join("")}
      <span class="sp"></span><span class="who">${esc(u.name)} (${u.role})</span><button id="pwBtn">Change password</button><button id="outBtn">Log out</button></nav>
      <dialog id="pwDlg"><form id="pwForm" novalidate><h2>Change password</h2>
      <label>Current password<input type="password" name="oldp"><span class="err" data-for="oldp"></span></label>
      <label>New password<input type="password" name="newp"><span class="err" data-for="newp"></span></label>
      <label>Confirm new password<input type="password" name="conf"><span class="err" data-for="conf"></span></label>
      <button class="btn" type="submit">Save password</button> <button class="btn alt" type="button" id="pwCancel">Cancel</button></form></dialog>`;
    $("#outBtn").onclick = Auth.logout;
    $("#pwBtn").onclick = () => $("#pwDlg").showModal();
    $("#pwCancel").onclick = () => $("#pwDlg").close();
    $("#pwForm").onsubmit = (ev) => {
      ev.preventDefault();
      const f = ev.target;
      if (
        showErrors(
          f,
          Auth.changePassword(f.oldp.value, f.newp.value, f.conf.value),
        )
      ) {
        f.reset();
        $("#pwDlg").close();
        toast("Password changed");
      }
    };
  },
};

/* ---- index.html: first-run setup or login ---- */
if (document.body.dataset.page === "index") {
  const cur = Auth.current();
  if (cur && Store.company()) location.replace(Auth.home(cur));
  const setup = !Store.company();
  $("#setupCard").hidden = !setup;
  $("#loginCard").hidden = setup;
  $("#setupForm").onsubmit = (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const errs = Auth.setup({
      company: f.company.value,
      name: f.name.value,
      email: f.email.value,
      password: f.password.value,
    });
    if (showErrors(f, errs)) location.replace("admin.html");
  };
  $("#loginForm").onsubmit = (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const u = Auth.login(f.email.value, f.password.value);
    if (!u) return showErrors(f, { password: "Invalid email or password" });
    location.replace(Auth.home(u));
  };
}
