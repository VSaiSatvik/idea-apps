/**
 * SideDesk — wraps micro-internships/build-v2's engine.
 * Business: order fixed-price remote tasks, see deliverables, approve/reject.
 * Student: join the waitlist; once SideDesk files their permit (admin), claim
 *          tasks within hour limits, submit work, see earnings; do QA checks.
 * Admin:   activate students (file permit), see demand, P&L.
 */
import express from "express";
import { HttpError, isAdmin, onAccountDeleted, requireAdmin, requireUser } from "../lib/auth.js";
import { persisted } from "../lib/persist.js";
import { ECON, LIMITS, MENU, Store, canWork, taskMargin, taskMinutes, type Skill, type TaskType } from "./core.js";

class SideDb {
  store = new Store();
  taskOwner = new Map<string, string>(); // taskId -> userId
  studentUser = new Map<string, string>(); // studentId -> userId
  deliverable = new Map<string, string>(); // taskId -> text/link
}

const db = persisted("sidedesk", () => new SideDb());
const today = () => new Date().toISOString().slice(0, 10);
const SKILLS: Skill[] = [...new Set(Object.values(MENU).map((m) => m.skill))] as Skill[];

onAccountDeleted((uid) => {
  for (const [tid, u] of [...db.value.taskOwner]) if (u === uid) {
    const t = db.value.store.tasks.get(tid);
    if (t && (t.status === "queued" || t.status === "approved" || t.status === "rejected")) { db.value.store.tasks.delete(tid); db.value.deliverable.delete(tid); }
    db.value.taskOwner.delete(tid);
  }
  for (const [sid, u] of [...db.value.studentUser]) if (u === uid) {
    // wage ledger entries are kept (payroll records must be retained); the profile is removed
    db.value.store.students.delete(sid);
    db.value.studentUser.delete(sid);
  }
  db.save();
});

const studentOf = (uid: string) => {
  const sid = [...db.value.studentUser].find(([, u]) => u === uid)?.[0];
  return sid ? db.value.store.students.get(sid) : undefined;
};

function taskView(tid: string) {
  const t = db.value.store.tasks.get(tid)!;
  return { ...t, title: MENU[t.type].title, priceAED: MENU[t.type].priceAED, deliverable: db.value.deliverable.get(tid) };
}

export function sidedeskRouter() {
  const r = express.Router();
  r.use(requireUser);

  r.get("/menu", (_req, res) => {
    res.json({ menu: Object.fromEntries((Object.keys(MENU) as TaskType[]).map((k) => [k, { ...MENU[k], studentMinutes: taskMinutes(k) }])), wageAEDPerHour: ECON.wageAEDPerHour, limits: LIMITS, skills: SKILLS });
  });

  r.get("/me", (req, res) => {
    const s = studentOf(req.user!.id);
    const myTasks = [...db.value.taskOwner].filter(([, u]) => u === req.user!.id).map(([tid]) => tid).filter((tid) => db.value.store.tasks.has(tid)).map(taskView);
    res.json({
      admin: isAdmin(req.user!),
      student: s ? { ...s, active: !!(s.permit && s.permit.expiresOn > today()) } : null,
      orders: myTasks.sort((a, b) => b.createdOn.localeCompare(a.createdOn)),
    });
  });

  // ---------------- business
  r.post("/tasks", (req, res) => {
    const type = String(req.body.type) as TaskType;
    if (!MENU[type]) throw new HttpError(400, "Pick a task from the menu");
    const brief = String(req.body.brief ?? "").trim();
    if (brief.length < 10) throw new HttpError(400, "Describe the task (at least 10 characters) and include links to any files");
    const t = db.value.store.postTask(String(req.body.businessName || req.user!.name), type, brief, today());
    db.value.taskOwner.set(t.id, req.user!.id);
    db.save();
    res.status(201).json(taskView(t.id));
  });

  r.post("/tasks/:id/approve", (req, res) => {
    const tid = String(req.params.id);
    if (db.value.taskOwner.get(tid) !== req.user!.id) throw new HttpError(404, "Order not found");
    db.value.store.approve(tid, !!req.body.approved, today());
    db.save();
    res.json(taskView(tid));
  });

  // ---------------- student
  r.put("/student", (req, res) => {
    const b = req.body;
    const email = String(b.universityEmail ?? "").trim().toLowerCase();
    if (!/@[^@\s]+\.(ac\.ae|edu|edu\.[a-z]{2}|ac\.[a-z]{2})$/.test(email)) throw new HttpError(400, "Use your university email (ending .ac.ae or .edu)");
    const skills = (Array.isArray(b.skills) ? b.skills : []).filter((x: string) => SKILLS.includes(x as Skill));
    if (!skills.length) throw new HttpError(400, "Pick at least one skill");
    const age = Number(b.age);
    if (!(age >= 18)) throw new HttpError(400, "You must be 18 or over to work through SideDesk");
    const existing = studentOf(req.user!.id);
    if (existing) {
      Object.assign(existing, { university: String(b.university ?? existing.university), skills, sponsorApproval: !!b.sponsorApproval, age, blackoutDates: Array.isArray(b.blackoutDates) ? b.blackoutDates : existing.blackoutDates });
      db.save();
      return res.json(existing);
    }
    const s = db.value.store.addStudent({ name: req.user!.name, university: String(b.university ?? ""), skills, sponsorApproval: !!b.sponsorApproval, age, blackoutDates: Array.isArray(b.blackoutDates) ? b.blackoutDates : [] });
    (s as any).universityEmail = email;
    db.value.studentUser.set(s.id, req.user!.id);
    db.save();
    res.status(201).json(s);
  });

  r.get("/board", (req, res) => {
    const s = studentOf(req.user!.id);
    if (!s?.permit) throw new HttpError(403, "You're on the waitlist. We'll activate you when there's enough work.");
    const tasks = [...db.value.store.tasks.values()];
    res.json({
      available: tasks.filter((t) => t.status === "queued" && s.skills.includes(MENU[t.type].skill)).map((t) => ({ ...taskView(t.id), earnAED: Math.round((t.workMinutes / 60) * ECON.wageAEDPerHour) })),
      mine: tasks.filter((t) => t.studentId === s.id && (t.status === "claimed" || t.status === "qa" || t.status === "delivered")).map((t) => taskView(t.id)),
      qa: tasks.filter((t) => t.status === "qa" && t.studentId !== s.id).map((t) => taskView(t.id)),
      earnedAED: Math.round(s.earnedAED),
      shiftsToday: s.shifts.filter((x) => x.date === (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date)) ? String(req.query.date) : today())),
    });
  });

  r.post("/tasks/:id/claim", (req, res) => {
    const s = studentOf(req.user!.id);
    if (!s) throw new HttpError(403, "Join as a student first");
    const date = String(req.body.date ?? today());
    const start = Number(req.body.start);
    if (!(start >= 0 && start < 1440)) throw new HttpError(400, "Pick a start time");
    db.value.store.claim(String(req.params.id), s.id, date, start);
    db.save();
    res.json(taskView(String(req.params.id)));
  });

  r.post("/tasks/:id/submit", (req, res) => {
    const s = studentOf(req.user!.id);
    const t = db.value.store.getTask(String(req.params.id));
    if (!s || t.studentId !== s.id) throw new HttpError(403, "Not your task");
    const d = String(req.body.deliverable ?? "").trim();
    if (d.length < 5) throw new HttpError(400, "Add the deliverable (a link or the text)");
    db.value.deliverable.set(t.id, d);
    db.value.store.submit(t.id, today());
    db.save();
    res.json(taskView(t.id));
  });

  r.post("/tasks/:id/qa", (req, res) => {
    const s = studentOf(req.user!.id);
    if (!s) throw new HttpError(403, "Join as a student first");
    db.value.store.qaPass(String(req.params.id), s.id, String(req.body.date ?? today()), Number(req.body.start), !!req.body.pass);
    if (!req.body.pass) db.value.deliverable.delete(String(req.params.id));
    db.save();
    res.json(taskView(String(req.params.id)));
  });

  r.post("/check-hours", (req, res) => {
    const s = studentOf(req.user!.id);
    if (!s) throw new HttpError(403, "Join as a student first");
    res.json(canWork(s, String(req.body.date ?? today()), Number(req.body.start), Number(req.body.minutes)));
  });

  // ---------------- admin
  r.get("/admin", requireAdmin, (_req, res) => {
    res.json({
      studentsNeeded: db.value.store.studentsNeeded(today()),
      waitlist: [...db.value.store.students.values()].filter((s) => !s.permit).map((s) => ({ ...s, universityEmail: (s as any).universityEmail })),
      active: [...db.value.store.students.values()].filter((s) => s.permit),
      queue: [...db.value.store.tasks.values()].filter((t) => t.status === "queued").length,
      pnl: db.value.store.pnl(),
      marginPerTask: Object.fromEntries((Object.keys(MENU) as TaskType[]).map((k) => [k, taskMargin(k)])),
    });
  });
  r.post("/admin/students/:id/permit", requireAdmin, (req, res) => {
    const p = db.value.store.filePermit(String(req.params.id), today());
    db.save();
    res.json(p);
  });

  return r;
}

export function seedSideDeskDemo(businessUserId: string, studentUserId: string) {
  if ([...db.value.studentUser.values()].includes(studentUserId)) return;
  const s = db.value.store.addStudent({ name: "Demo Student", university: "Demo University", skills: ["data", "office", "language", "research", "social"], sponsorApproval: true, age: 20, blackoutDates: [] });
  (s as any).universityEmail = "student@demo.ac.ae";
  db.value.studentUser.set(s.id, studentUserId);
  db.value.store.filePermit(s.id, today());
  for (const [type, brief] of [["data_entry_100", "Supplier invoices (PDF link) into our Google Sheet: https://example.com/invoices"], ["proofread_3k", "Proofread our website About and Menu pages: https://example.com/site"]] as const) {
    const t = db.value.store.postTask("Demo Café", type, brief, today());
    db.value.taskOwner.set(t.id, businessUserId);
  }
  db.save();
}
