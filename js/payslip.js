/* payslip.js - monthly salary slip.
   perDay = salary / working days in the WHOLE month (per Admin's working-day settings)
   deduction = perDay * (absent + 0.5 * halfDays);  net = salary - deduction
   halfDays = half days + past days with no check-out (see attendance.js). Approved leave is paid. Future days, non-working
   days, today (until it ends) and days before the joining date are never deducted. Result is rounded to 2 decimals. */
const Payslip = {
  build(userId, month) {
    Auth.assertSelfOrAdmin(userId);
    const user = Store.users().find((u) => u.id === userId);
    if (!user || user.role !== "employee")
      throw new Error("Employee not found");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Choose a month");
    if (month > todayStr().slice(0, 7))
      throw new Error("Cannot create a payslip for a future month");
    const c = Store.company(),
      [y, m] = month.split("-").map(Number),
      last = new Date(y, m, 0).getDate();
    const days = Attendance.days(user, `${month}-01`, `${month}-${pad(last)}`);
    const workingDays = days.filter((d) =>
      isWorkingDay(parseYmd(d.date), c),
    ).length;
    if (!workingDays)
      throw new Error("No working days are configured for this month");
    const n = (code) => days.filter((d) => d.code === code).length;
    const absent = n("absent"),
      half = n("half") + n("incomplete");
    const perDay = user.salary / workingDays,
      deduction = Math.round(perDay * (absent + 0.5 * half) * 100) / 100;
    return {
      user,
      month,
      company: c,
      workingDays,
      present: n("present"),
      half,
      absent,
      leave: n("leave"),
      late: days.filter((d) => d.late).length,
      perDay,
      deduction,
      net: Math.round((user.salary - deduction) * 100) / 100,
    };
  },
};

if (document.body.dataset.page === "payslip") {
  const me = Auth.require();
  Auth.shell("payslip.html");
  const sel = $("#empSel"),
    month = $("#month");
  month.value = todayStr().slice(0, 7);
  month.max = month.value;
  const emps = me.role === "admin" ? Employees.list() : [me];
  sel.innerHTML = emps
    .map((u) => `<option value="${u.id}">${esc(u.name)}</option>`)
    .join("");
  if (me.role !== "admin") $("#empLabel").hidden = true; // UI convenience only; build() re-checks access
  if (!emps.length) {
    $("#controls").hidden = true;
    $("#slip").innerHTML =
      '<div class="empty">No employees yet. Add an employee first to generate payslips.</div>';
  }
  function generate() {
    try {
      const p = Payslip.build(
        me.role === "admin" ? sel.value : me.id,
        month.value,
      );
      const label = parseYmd(p.month + "-01").toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
      $("#slip").innerHTML =
        `<div class="card slip"><h2>${esc(p.company.name)}</h2><p class="sub">Salary slip for ${label}</p>
        <p><b>${esc(p.user.name)}</b><br>${esc(p.user.email)} | ${esc(p.user.department)}</p>
        <div class="tw"><table><tr><th>Attendance summary</th><th>Days</th></tr>
        <tr><td>Working days in month</td><td>${p.workingDays}</td></tr><tr><td>Present (full days)</td><td>${p.present}</td></tr>
        <tr><td>Half days (incl. missing check-out)</td><td>${p.half}</td></tr><tr><td>Absent</td><td>${p.absent}</td></tr>
        <tr><td>Approved leave (paid)</td><td>${p.leave}</td></tr><tr><td>Late arrivals (no deduction)</td><td>${p.late}</td></tr></table>
        <table style="margin-top:14px"><tr><th>Salary</th><th>Amount</th></tr>
        <tr><td>Monthly salary</td><td>${money(p.user.salary)}</td></tr><tr><td>Per-day salary</td><td>${money(p.perDay)}</td></tr>
        <tr><td>Deduction (${p.absent} absent + 0.5 x ${p.half} half)</td><td>- ${money(p.deduction)}</td></tr>
        <tr class="tot"><td>Net salary</td><td>${money(p.net)}</td></tr></table></div>
        <p class="note">Only attendance up to today is counted. Today is not counted absent until the day ends.</p></div>`;
      $("#printBtn").hidden = false;
    } catch (err) {
      $("#slip").innerHTML = `<div class="empty">${esc(err.message)}</div>`;
      $("#printBtn").hidden = true;
    }
  }
  $("#genBtn").onclick = generate;
  $("#printBtn").onclick = () => window.print();
  if (emps.length) generate();
}
