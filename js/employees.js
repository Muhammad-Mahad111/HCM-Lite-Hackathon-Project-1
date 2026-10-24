/* employees.js - employee CRUD. Adding an employee also creates their login (same record in hcm_users). */
const Employees = {
  list() {
    return Store.users().filter((u) => u.role === "employee");
  },
  validate(d, editId) {
    const e = {},
      email = d.email.trim().toLowerCase();
    if (!d.name.trim()) e.name = "Name is required";
    if (!email) e.email = "Email is required";
    else if (!Auth.validEmail(email)) e.email = "Enter a valid email address";
    else if (Store.users().some((u) => u.email === email && u.id !== editId))
      e.email = "This email is already in use";
    if (!d.department.trim()) e.department = "Department is required";
    if (!(Number(d.salary) > 0)) e.salary = "Salary must be greater than 0";
    if (!d.joinDate) e.joinDate = "Joining date is required";
    else if (d.joinDate > todayStr())
      e.joinDate = "Joining date cannot be in the future";
    if (!editId && !d.password) e.password = "Password is required";
    else if (d.password && d.password.length < 6)
      e.password = "At least 6 characters";
    return e;
  },
  save(d, editId) {
    Auth.assertAdmin();
    const e = Employees.validate(d, editId);
    if (Object.keys(e).length) return e;
    const users = Store.users();
    if (editId) {
      const u = users.find((x) => x.id === editId && x.role === "employee");
      if (!u) throw new Error("Employee not found");
      Object.assign(u, {
        name: d.name.trim(),
        email: d.email.trim().toLowerCase(),
        department: d.department.trim(),
        salary: Number(d.salary),
        joinDate: d.joinDate,
      });
      if (d.password) u.passHash = Auth.hash(d.password); // blank password = keep the old one
      // Records reference users by id, so attendance/leaves stay linked after edits.
    } else {
      users.push({
        id: uid(),
        name: d.name.trim(),
        email: d.email.trim().toLowerCase(),
        passHash: Auth.hash(d.password),
        role: "employee",
        department: d.department.trim(),
        salary: Number(d.salary),
        joinDate: d.joinDate,
      });
    }
    Store.set(KEYS.users, users);
    return e;
  },
  // Deleting removes the user AND all of their attendance + leave records (no orphans). Admin accounts cannot be deleted here.
  remove(id) {
    Auth.assertAdmin();
    const u = Store.users().find((x) => x.id === id);
    if (!u || u.role !== "employee") throw new Error("Employee not found");
    Store.set(
      KEYS.users,
      Store.users().filter((x) => x.id !== id),
    );
    Store.set(
      KEYS.attendance,
      Store.attendance().filter((a) => a.userId !== id),
    );
    Store.set(
      KEYS.leaves,
      Store.leaves().filter((l) => l.userId !== id),
    );
  },
};

if (document.body.dataset.page === "employees") {
  Auth.require("admin");
  Auth.shell("employees.html");
  const form = $("#empForm");
  let editId = null;
  function resetForm() {
    editId = null;
    form.reset();
    form.joinDate.value = todayStr();
    showErrors(form, {});
    $("#formTitle").textContent = "Add employee";
    $("#saveBtn").textContent = "Add employee";
    $("#cancelEdit").hidden = true;
    form.password.placeholder = "";
  }
  function render() {
    const all = Employees.list(),
      q = $("#q").value.trim().toLowerCase(),
      cur = $("#dep").value;
    const deps = [...new Set(all.map((u) => u.department))].sort();
    $("#dep").innerHTML =
      '<option value="">All departments</option>' +
      deps
        .map((d) => `<option ${d === cur ? "selected" : ""}>${esc(d)}</option>`)
        .join("");
    const rows = all.filter(
      (u) =>
        (!q || u.name.toLowerCase().includes(q) || u.email.includes(q)) &&
        (!$("#dep").value || u.department === $("#dep").value),
    );
    $("#empBody").innerHTML = rows
      .map(
        (
          u,
        ) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.department)}</td><td>${money(u.salary)}</td><td>${esc(u.joinDate)}</td>
      <td><button class="btn alt sm" data-act="edit" data-id="${u.id}">Edit</button> <button class="btn bad sm" data-act="del" data-id="${u.id}">Delete</button></td></tr>`,
      )
      .join("");
    $("#tableWrap").hidden = !rows.length;
    $("#empty").hidden = !!rows.length;
    $("#empty").textContent = all.length
      ? "No employees match your search or filter."
      : "No employees yet. Use the form to add your first employee and create their login.";
  }
  $("#q").oninput = render;
  $("#dep").onchange = render;
  $("#empBody").onclick = (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    const u = Employees.list().find((x) => x.id === b.dataset.id);
    if (!u) return;
    if (b.dataset.act === "edit") {
      editId = u.id;
      ["name", "email", "department", "salary", "joinDate"].forEach(
        (k) => (form[k].value = u[k]),
      );
      form.password.value = "";
      form.password.placeholder = "Leave blank to keep current";
      $("#formTitle").textContent = "Edit employee";
      $("#saveBtn").textContent = "Save changes";
      $("#cancelEdit").hidden = false;
      form.name.focus();
      window.scrollTo(0, 0);
    } else if (
      confirm(
        `Delete ${u.name}? Their login, attendance and leave records will also be deleted.`,
      )
    ) {
      Employees.remove(u.id);
      if (editId === u.id) resetForm();
      render();
      toast("Employee deleted");
    }
  };
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(
      ["name", "email", "department", "salary", "joinDate", "password"].map(
        (k) => [k, form[k].value],
      ),
    );
    if (showErrors(form, Employees.save(d, editId))) {
      toast(editId ? "Changes saved" : "Employee added");
      resetForm();
      render();
    }
  };
  $("#cancelEdit").onclick = resetForm;
  resetForm();
  render();
}
