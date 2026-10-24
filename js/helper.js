/* helper.js - keyword-matching smart helper. Answers ONLY from stored data, role-aware (employees see only their own data). */
const Helper = {
  SUGGEST: {
    admin: [
      "How many employees do we have?",
      "Who is on leave today?",
      "Who was late today?",
      "How many leave requests are pending?",
    ],
    employee: [
      "How many leaves do I have left?",
      "Was I late today?",
      "How many hours did I work this week?",
    ],
  },
  answer(q) {
    const u = Auth.current();
    if (!u) return "Please log in again.";
    const t = q.toLowerCase(),
      has = (re) => re.test(t),
      today = todayStr(),
      c = Store.company();
    if (u.role === "admin") {
      if (has(/pending/)) {
        const n = Store.leaves().filter((l) => l.status === "pending").length;
        return `${n} leave request(s) are pending.`;
      }
      if (has(/late/)) {
        const names = Employees.list()
          .map((e) => ({
            e,
            r: Store.attendance().find(
              (a) => a.userId === e.id && a.date === today,
            ),
          }))
          .filter((x) => x.r && Attendance.isLate(x.r, c));
        return names.length
          ? `Late today (after ${c.startTime} + ${c.graceMinutes} min grace):\n` +
              names
                .map((x) => `- ${x.e.name} (checked in ${x.r.checkIn})`)
                .join("\n")
          : "Nobody has been late today so far.";
      }
      if (has(/leave/) && has(/today|now/)) {
        const p = Leaves.onLeave(today);
        return p.length
          ? "On approved leave today:\n" +
              p.map((x) => "- " + x.name).join("\n")
          : "Nobody is on approved leave today.";
      }
      if (has(/employee|staff|people/) && has(/how many|count|total|number/))
        return `You have ${Employees.list().length} employee(s).`;
    } else {
      if (has(/late/)) {
        const r = Store.attendance().find(
          (a) => a.userId === u.id && a.date === today,
        );
        if (!r)
          return "You have not checked in today, so there is no late record yet.";
        return Attendance.isLate(r, c)
          ? `Yes, you checked in at ${r.checkIn}, after the allowed time (${c.startTime} + ${c.graceMinutes} min grace).`
          : `No, you checked in at ${r.checkIn}, which is on time.`;
      }
      if (has(/hour|worked/) && has(/week/)) {
        const w = Attendance.weekMinutes(u.id);
        return (
          `This week (Mon to today) you worked ${fmtHours(w.minutes)} in completed days.` +
          (w.open
            ? ` ${w.open} day(s) have no check-out and are not counted.`
            : "")
        );
      }
      if (has(/leave/) && has(/left|remain|balance|have/)) {
        const y = new Date().getFullYear(),
          b = Leaves.balance(u.id);
        return `You have ${b} leave day(s) left for ${y} (quota ${c.leaveQuota}, approved ${Leaves.usedApproved(u.id, y)}).`;
      }
    }
    return (
      "Sorry, I can't answer that yet. Try:\n" +
      Helper.SUGGEST[u.role].map((s) => "- " + s).join("\n")
    );
  },
  mount(sel) {
    const u = Auth.current(),
      box = $(sel);
    box.innerHTML = `<h2>Smart helper</h2><div class="chat"><div class="log" id="hLog" aria-live="polite"></div>
      <form id="hForm"><input id="hIn" placeholder="Ask a question..." aria-label="Ask a question"><button class="btn" type="submit">Ask</button></form>
      <div class="chips">${Helper.SUGGEST[u.role].map((s) => `<button type="button" class="btn alt sm">${esc(s)}</button>`).join("")}</div></div>`;
    const log = $("#hLog");
    const add = (txt, who) => {
      const p = document.createElement("p");
      p.className = "msg " + who;
      p.textContent = txt;
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
    };
    const ask = (q) => {
      if (!q.trim()) return;
      add(q, "u");
      add(Helper.answer(q), "b");
    };
    add("Hi! Ask me about your HR data. Tap a suggestion below.", "b");
    $("#hForm").onsubmit = (ev) => {
      ev.preventDefault();
      ask($("#hIn").value);
      $("#hIn").value = "";
    };
    box.querySelector(".chips").onclick = (ev) => {
      if (ev.target.tagName === "BUTTON") ask(ev.target.textContent);
    };
  },
};
