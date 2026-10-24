/* attendance.js - check-in/out and day classification.
   RULES / ASSUMPTIONS
   - One record per employee per date: {id,userId,date,checkIn:"HH:MM",checkOut:"HH:MM"|null}.
   - Late: checkIn > officeStart + graceMinutes. Work duration = checkOut - checkIn. Under 5 hours = half day.
   - Incomplete record (no check-out): today = "in progress" (not penalised yet). On a PAST date it counts as a HALF DAY
     (assumption: the employee came but forgot to check out, so we neither mark full present nor absent).
   - Absent: a past working day (on/after join date) with no record and no approved leave. Today with no record is "not
     checked in yet" (not absent until the day ends). Future days, non-working days and days before joining are never absent.
   - Approved-leave days are paid and never count as absent.  Settings are applied to all dates (not versioned). */
const HALF_DAY_MINUTES = 300;
const STATUS = {
  present: ["Present", "ok"],
  half: ["Half day", "warn"],
  incomplete: ["No check-out (half day)", "warn"],
  progress: ["In progress", "info"],
  leave: ["On leave", "info"],
  absent: ["Absent", "bad"],
  off: ["Non-working day", "mu"],
  pending: ["Not checked in yet", "mu"],
  future: ["-", "mu"],
  before: ["-", "mu"],
};
const Attendance = {
  isLate(rec, c) {
    return toMin(rec.checkIn) > toMin(c.startTime) + c.graceMinutes;
  },
  minutes(rec) {
    return rec.checkOut ? toMin(rec.checkOut) - toMin(rec.checkIn) : null;
  },
  checkIn() {
    const u = Auth.current();
    if (!u || u.role !== "employee")
      throw new Error("Only employees can check in"); // always the logged-in user, no ID parameter
    const c = Store.company(),
      now = new Date(),
      date = ymd(now);
    if (!isWorkingDay(now, c)) throw new Error("Today is not a working day");
    const all = Store.attendance();
    if (all.some((a) => a.userId === u.id && a.date === date))
      throw new Error("You have already checked in today");
    all.push({
      id: uid(),
      userId: u.id,
      date,
      checkIn: nowHM(),
      checkOut: null,
    });
    Store.set(KEYS.attendance, all);
  },
  checkOut() {
    const u = Auth.current();
    if (!u || u.role !== "employee")
      throw new Error("Only employees can check out");
    const all = Store.attendance(),
      r = all.find((a) => a.userId === u.id && a.date === todayStr());
    if (!r) throw new Error("Check in first");
    if (r.checkOut) throw new Error("You have already checked out today");
    r.checkOut = nowHM();
    Store.set(KEYS.attendance, all);
  },
  // Classifies every date in [from,to] for one user. Used by dashboards, payslip and helper.
  days(user, from, to) {
    Auth.assertSelfOrAdmin(user.id);
    const c = Store.company(),
      t = todayStr(),
      recs = {};
    Store.attendance()
      .filter((a) => a.userId === user.id)
      .forEach((a) => (recs[a.date] = a));
    const leaves = Store.leaves().filter(
      (l) => l.userId === user.id && l.status === "approved",
    );
    return eachDay(from, to).map((date) => {
      const r = recs[date] || null;
      let code;
      if (date > t) code = "future";
      else if (date < user.joinDate) code = "before";
      else if (r)
        code = !r.checkOut
          ? date === t
            ? "progress"
            : "incomplete"
          : Attendance.minutes(r) < HALF_DAY_MINUTES
            ? "half"
            : "present";
      else if (!isWorkingDay(parseYmd(date), c)) code = "off";
      else if (leaves.some((l) => l.start <= date && date <= l.end))
        code = "leave";
      else code = date === t ? "pending" : "absent";
      return { date, code, rec: r, late: !!r && Attendance.isLate(r, c) };
    });
  },
  // Completed minutes worked Monday..today (open records are skipped and reported).
  weekMinutes(userId) {
    Auth.assertSelfOrAdmin(userId);
    const d = new Date(),
      mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const recs = Store.attendance().filter(
      (a) => a.userId === userId && a.date >= ymd(mon) && a.date <= ymd(d),
    );
    return {
      minutes: recs
        .filter((r) => r.checkOut)
        .reduce((s, r) => s + Attendance.minutes(r), 0),
      open: recs.filter((r) => !r.checkOut).length,
    };
  },
};
