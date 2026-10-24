/* leave.js - leave rules.
   - Types: casual, sick; both use the same yearly quota. Only WORKING days count (weekends/non-working days excluded).
   - A request must stay inside one calendar year (simplest way to apply a yearly quota; split longer requests).
   - Balance is DERIVED: quota - sum(days of APPROVED requests in that year). Nothing is stored/decremented, so approvals can
     never deduct twice and rejected requests never consume balance.
   - Pending requests are reserved when applying (approved + pending + new <= quota) so employees cannot over-request. */
const LEAVE_TYPES = { casual: "Casual", sick: "Sick" };
const LEAVE_BADGE = { pending: "warn", approved: "ok", rejected: "bad" };
const Leaves = {
  days(start, end) {
    const c = Store.company();
    return eachDay(start, end).filter((d) => isWorkingDay(parseYmd(d), c))
      .length;
  },
  usedApproved(uid_, year) {
    return Store.leaves()
      .filter(
        (l) =>
          l.userId === uid_ &&
          l.status === "approved" &&
          l.start.slice(0, 4) === String(year),
      )
      .reduce((s, l) => s + l.days, 0);
  },
  balance(userId, year = new Date().getFullYear()) {
    Auth.assertSelfOrAdmin(userId);
    return Store.company().leaveQuota - Leaves.usedApproved(userId, year);
  },
  forUser(userId) {
    Auth.assertSelfOrAdmin(userId);
    return Store.leaves()
      .filter((l) => l.userId === userId)
      .sort((a, b) => b.start.localeCompare(a.start));
  },
  onLeave(date) {
    Auth.assertAdmin();
    const c = Store.company();
    if (!isWorkingDay(parseYmd(date), c)) return [];
    const ids = new Set(
      Store.leaves()
        .filter(
          (l) => l.status === "approved" && l.start <= date && date <= l.end,
        )
        .map((l) => l.userId),
    );
    return Store.users().filter((u) => ids.has(u.id));
  },
  apply(d) {
    const u = Auth.current();
    if (!u || u.role !== "employee")
      throw new Error("Only employees can apply for leave");
    const e = {};
    if (!LEAVE_TYPES[d.type]) e.type = "Choose a leave type";
    if (!d.start) e.start = "Start date is required";
    if (!d.end) e.end = "End date is required";
    if (!d.reason.trim()) e.reason = "Reason is required";
    if (!e.start && !e.end) {
      if (d.end < d.start) e.end = "End date cannot be before the start date";
      else if (d.start.slice(0, 4) !== d.end.slice(0, 4))
        e.end =
          "Keep each request inside one calendar year (split it into two)";
    }
    if (Object.keys(e).length) return e;
    const days = Leaves.days(d.start, d.end);
    if (!days) {
      e.start = "The selected dates contain no working days";
      return e;
    }
    const mine = Leaves.forUser(u.id).filter((l) => l.status !== "rejected");
    if (mine.some((l) => l.start <= d.end && d.start <= l.end)) {
      e.start = "These dates overlap another pending or approved request";
      return e;
    }
    const year = d.start.slice(0, 4),
      quota = Store.company().leaveQuota;
    const reserved = mine
      .filter((l) => l.start.slice(0, 4) === year)
      .reduce((s, l) => s + l.days, 0);
    if (reserved + days > quota) {
      e.end = `Quota exceeded: ${Math.max(0, quota - reserved)} day(s) available for ${year} (pending requests included), you asked for ${days}`;
      return e;
    }
    const all = Store.leaves();
    all.push({
      id: uid(),
      userId: u.id,
      type: d.type,
      start: d.start,
      end: d.end,
      days,
      reason: d.reason.trim(),
      status: "pending",
      comment: "",
      createdAt: new Date().toISOString(),
      decidedAt: null,
    });
    Store.set(KEYS.leaves, all);
    return e;
  },
  decide(id, status, comment) {
    Auth.assertAdmin();
    const all = Store.leaves(),
      l = all.find((x) => x.id === id);
    if (!l) throw new Error("Request not found");
    if (l.status !== "pending")
      throw new Error("This request was already decided"); // blocks double approval/deduction
    if (status === "rejected" && !comment.trim())
      throw new Error("Add a comment when rejecting");
    if (
      status === "approved" &&
      Leaves.usedApproved(l.userId, l.start.slice(0, 4)) + l.days >
        Store.company().leaveQuota
    )
      throw new Error("Approving would exceed the yearly quota");
    l.status = status;
    l.comment = comment.trim();
    l.decidedAt = new Date().toISOString();
    Store.set(KEYS.leaves, all);
  },
};

if (document.body.dataset.page === "leaves") {
  Auth.require("admin");
  Auth.shell("leaves.html");
  function render() {
    const users = Object.fromEntries(Store.users().map((u) => [u.id, u])),
      f = $("#statusFilter").value;
    const rows = Store.leaves()
      .filter((l) => users[l.userId] && (!f || l.status === f))
      .sort(
        (a, b) =>
          (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    $("#leaveBody").innerHTML = rows
      .map(
        (
          l,
        ) => `<tr><td>${esc(users[l.userId].name)}</td><td>${LEAVE_TYPES[l.type]}</td><td>${l.start} to ${l.end}</td><td>${l.days}</td><td class="wrap">${esc(l.reason)}</td>
      <td>${badge(l.status, LEAVE_BADGE[l.status])}</td><td class="wrap">${
        l.status === "pending"
          ? `<input placeholder="Comment" id="c-${l.id}"><div style="margin-top:6px"><button class="btn sm" data-act="approved" data-id="${l.id}">Approve</button> <button class="btn bad sm" data-act="rejected" data-id="${l.id}">Reject</button></div>`
          : esc(l.comment) || "-"
      }</td></tr>`,
      )
      .join("");
    $("#leaveWrap").hidden = !rows.length;
    $("#empty").hidden = !!rows.length;
    $("#empty").textContent = Store.leaves().length
      ? "No requests match this filter."
      : "No leave requests yet. Requests from employees will appear here.";
  }
  $("#statusFilter").onchange = render;
  $("#leaveBody").onclick = (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    try {
      Leaves.decide(b.dataset.id, b.dataset.act, $("#c-" + b.dataset.id).value);
      toast("Request " + b.dataset.act);
      render();
    } catch (err) {
      toast(err.message, true);
      render();
    }
  };
  render();
}
