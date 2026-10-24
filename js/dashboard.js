/* dashboard.js - Admin dashboard (admin.html) and Employee dashboard (employee.html). */
if (document.body.dataset.page === "admin") {
  Auth.require("admin");
  Auth.shell("admin.html");
  const c = Store.company(),
    t = todayStr(),
    emps = Employees.list();
  const recs = Store.attendance().filter(
    (a) => a.date === t && emps.some((e) => e.id === a.userId),
  );
  const stats = [
    ["Employees", emps.length],
    ["Checked in today", recs.length],
    ["Late today", recs.filter((r) => Attendance.isLate(r, c)).length],
    ["On leave today", Leaves.onLeave(t).length],
    [
      "Pending leave requests",
      Store.leaves().filter((l) => l.status === "pending").length,
    ],
  ];
  $("#stats").innerHTML = stats
    .map(
      (s) =>
        `<div class="card stat"><small>${s[0]}</small><b>${s[1]}</b></div>`,
    )
    .join("");
  $("#today").innerHTML = emps.length
    ? `<div class="tw"><table><tr><th>Employee</th><th>Department</th><th>Status</th><th>Check-in</th><th>Check-out</th></tr>${emps
        .map((e) => {
          const d = Attendance.days(e, t, t)[0],
            s = STATUS[d.code];
          return `<tr><td>${esc(e.name)}</td><td>${esc(e.department)}</td><td>${badge(s[0], s[1])} ${d.late ? badge("Late", "warn") : ""}</td><td>${d.rec ? d.rec.checkIn : "-"}</td><td>${d.rec && d.rec.checkOut ? d.rec.checkOut : "-"}</td></tr>`;
        })
        .join("")}</table></div>`
    : '<div class="empty">No employees yet. <a href="employees.html">Add your first employee</a> to start tracking attendance.</div>';
  Helper.mount("#helper");
}

if (document.body.dataset.page === "employee") {
  const me = Auth.require("employee");
  Auth.shell("employee.html");
  const c = Store.company(),
    form = $("#leaveForm");
  function render() {
    const t = todayStr(),
      td = Attendance.days(me, t, t)[0],
      s = STATUS[td.code],
      year = new Date().getFullYear();
    $("#todayInfo").innerHTML =
      `${badge(s[0], s[1])} ${td.late ? badge("Late", "warn") : ""}<p>Check-in: <b>${td.rec ? td.rec.checkIn : "-"}</b> &nbsp; Check-out: <b>${td.rec && td.rec.checkOut ? td.rec.checkOut : "-"}</b></p>
      <p class="note">Office starts ${c.startTime} (grace ${c.graceMinutes} min).</p>`;
    $("#inBtn").disabled = !!td.rec || td.code === "off";
    $("#outBtn2").disabled = !td.rec || !!td.rec.checkOut;
    const mStart = t.slice(0, 8) + "01",
      m = Attendance.days(me, mStart, t),
      cnt = (code) => m.filter((d) => d.code === code).length,
      w = Attendance.weekMinutes(me.id);
    $("#stats").innerHTML = [
      ["Leave days left (" + year + ")", Leaves.balance(me.id)],
      ["Hours this week", fmtHours(w.minutes)],
      ["Present this month", cnt("present")],
      ["Late this month", m.filter((d) => d.late).length],
      ["Absent this month", cnt("absent")],
    ]
      .map(
        (x) =>
          `<div class="card stat"><small>${x[0]}</small><b>${x[1]}</b></div>`,
      )
      .join("");
    const from = new Date();
    from.setDate(from.getDate() - 29);
    const rows = Attendance.days(me, ymd(from), t)
      .filter((d) => !["future", "before"].includes(d.code))
      .reverse();
    $("#attBody").innerHTML = rows
      .map((d) => {
        const s2 = STATUS[d.code],
          mins = d.rec ? Attendance.minutes(d.rec) : null;
        return `<tr><td>${d.date}</td><td>${badge(s2[0], s2[1])} ${d.late ? badge("Late", "warn") : ""}</td><td>${d.rec ? d.rec.checkIn : "-"}</td><td>${d.rec && d.rec.checkOut ? d.rec.checkOut : "-"}</td><td>${mins === null ? "-" : fmtHours(mins)}</td></tr>`;
      })
      .join("");
    $("#attNote").hidden = Store.attendance().some((a) => a.userId === me.id);
    const ls = Leaves.forUser(me.id);
    $("#myLeaves").innerHTML = ls
      .map(
        (l) =>
          `<tr><td>${LEAVE_TYPES[l.type]}</td><td>${l.start} to ${l.end}</td><td>${l.days}</td><td>${badge(l.status, LEAVE_BADGE[l.status])}</td><td class="wrap">${esc(l.comment) || "-"}</td></tr>`,
      )
      .join("");
    $("#leaveWrap").hidden = !ls.length;
    $("#leaveEmpty").hidden = !!ls.length;
  }
  $("#inBtn").onclick = () => {
    try {
      Attendance.checkIn();
      toast("Checked in");
    } catch (e) {
      toast(e.message, true);
    }
    render();
  };
  $("#outBtn2").onclick = () => {
    try {
      Attendance.checkOut();
      toast("Checked out");
    } catch (e) {
      toast(e.message, true);
    }
    render();
  };
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const errs = Leaves.apply({
      type: form.type.value,
      start: form.start.value,
      end: form.end.value,
      reason: form.reason.value,
    });
    if (showErrors(form, errs)) {
      form.reset();
      toast("Leave request submitted");
      render();
    }
  };
  render();
  Helper.mount("#helper");
}
