# HCM Lite (Saylani Hackathon, Beginner Track)

Pure HTML5 + CSS3 + Vanilla JS. No backend, no build step. Data lives in `localStorage`.
**Security note:** localStorage "authentication" is for this educational demo only. Anyone with the browser can read or edit the data; a real HR system needs a server, hashed passwords (bcrypt/argon2) and HTTPS.

## Run

Open `index.html` (or run `python -m http.server` in this folder and visit http://localhost:8000). First run shows company setup and creates the Admin.

## Structure

- `index.html` setup/login | `admin.html` | `employees.html` | `leaves.html` | `settings.html` | `employee.html` | `payslip.html`
- `js/storage.js` localStorage helpers + utilities | `auth.js` session, roles, nav | `employees.js` | `attendance.js` | `leave.js` | `helper.js` | `settings.js` | `payslip.js` | `dashboard.js` (both dashboards)

## Data model (keys exactly as required)

- `hcm_company` `{name,startTime,graceMinutes,leaveQuota,workingDays[0-6],createdAt}`
- `hcm_users` `[{id,name,email,passHash,role:'admin'|'employee',department,salary,joinDate}]` (login accounts and employees are one record)
- `hcm_attendance` `[{id,userId,date,checkIn,checkOut|null}]`
- `hcm_leaves` `[{id,userId,type,start,end,days,reason,status,comment,createdAt,decidedAt}]`
- `hcm_session` `{userId,at}`. The role is always re-read from `hcm_users`, never trusted from the session.

## Authorization

Each page calls `Auth.require(role)`. Every service function also re-checks (`assertAdmin`, `assertSelfOrAdmin`) using the logged-in user, so hidden buttons or edited IDs do not grant access. Check-in/out and leave apply take no user ID: they always act on the current user.

## Business rules and assumptions

- Late = check-in after start time + grace. Under 5 hours worked = half day.
- No check-out: today = "in progress"; a past day counts as a half day.
- Absent = past working day, on/after joining date, no record, no approved leave. Today is not absent until the day ends.
- Approved leave is paid. Non-working days, future days and pre-joining days are never absent.
- Leave: working days only; overlap blocked (pending/approved); each request inside one calendar year; casual and sick share one yearly quota; pending requests are reserved at apply time. Balance = quota minus approved days (derived, so no double deduction; rejected never counts). Only pending requests can be decided; rejection needs a comment.
- Payslip: per-day = salary / working days in month; deduction = per-day _ (absent + 0.5 _ half); net = salary - deduction. Future months blocked. Currency label: PKR.
- Settings changes apply to all dates. Deleting an employee deletes their attendance and leaves; editing keeps links (records use userId). The helper uses keyword matching on real data only.

## Manual test cases

1. Fresh browser opens index.html: setup form shows; empty/short fields show errors beside fields.
2. Create company: redirected to admin.html; dashboard shows zeros and empty states.
3. Add employee with bad email / duplicate email / salary 0: errors shown. Valid add: appears in table; log in with that email in a private window.
4. Employee opens admin.html, employees.html, leaves.html, settings.html: redirected to employee.html. Logged out user opening any page goes to index.html.
5. In DevTools set `hcm_session` to an employee id and change nothing else: still only employee access. Calling `Employees.remove('x')` as employee throws.
6. Check in twice: second blocked. Check out before check-in: blocked. Set office start to a time earlier than now (grace 0): check-in shows Late.
7. Set Joining date 10 days back: past working days show Absent; payslip for this month deducts per-day \* absent.
8. Apply leave with end before start, overlapping dates, weekend-only dates, and over-quota days: each rejected with a message. Valid request shows Pending.
9. Admin approves: balance drops once; approving again is blocked. Reject without comment is blocked; reject with comment keeps balance unchanged.
10. Helper: ask each suggested question as admin and employee; ask "weather": get a helpful unsupported message.
11. Payslip: print button opens print layout with nav hidden; employee can only see own slip; future month shows error.
12. Edit employee name: attendance/leaves still linked. Delete employee: their records vanish and login stops working.

## Deploy

GitHub Pages: push this folder to a repo, Settings > Pages > Deploy from branch (main, root). Netlify: drag the folder onto app.netlify.com/drop. No build command, publish directory is the root.
