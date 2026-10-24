/* settings.js - company settings (Admin only). Changes apply to all dates (settings are not versioned). */
if (document.body.dataset.page === "settings") {
  Auth.require("admin");
  Auth.shell("settings.html");
  const f = $("#setForm"),
    c = Store.company();
  f.name.value = c.name;
  f.startTime.value = c.startTime;
  f.grace.value = c.graceMinutes;
  f.quota.value = c.leaveQuota;
  f.querySelectorAll("input[name=wd]").forEach(
    (cb) => (cb.checked = c.workingDays.includes(Number(cb.value))),
  );
  f.onsubmit = (ev) => {
    ev.preventDefault();
    Auth.assertAdmin();
    const e = {},
      wd = [...f.querySelectorAll("input[name=wd]:checked")].map((x) =>
        Number(x.value),
      );
    if (!f.name.value.trim()) e.name = "Company name is required";
    if (!/^\d{2}:\d{2}$/.test(f.startTime.value))
      e.startTime = "Choose a valid time";
    const g = Number(f.grace.value);
    if (f.grace.value === "" || !Number.isInteger(g) || g < 0 || g > 240)
      e.grace = "Enter whole minutes from 0 to 240";
    const q = Number(f.quota.value);
    if (f.quota.value === "" || !Number.isInteger(q) || q < 0 || q > 365)
      e.quota = "Enter whole days from 0 to 365";
    if (!wd.length) e.wd = "Select at least one working day";
    if (showErrors(f, e)) {
      Store.set(KEYS.company, {
        ...Store.company(),
        name: f.name.value.trim(),
        startTime: f.startTime.value,
        graceMinutes: g,
        leaveQuota: q,
        workingDays: wd,
      });
      Auth.shell("settings.html");
      toast("Settings saved");
    }
  };
}
