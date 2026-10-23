/**
 * SideDesk core — paid micro-tasks done by university students, with the
 * platform as the employer of record.
 *
 *  - Students are the platform's part-time employees: ONE yearly part-time
 *    permit per student (filed by the platform) covers every task they do.
 *  - Permits are filed only when queued work justifies another student
 *    (demand-led activation), so nobody waits on an idle roster.
 *  - Businesses buy fixed-price remote tasks from a menu; the platform delivers
 *    them as a service. AI drafts first where it can; students check and finish.
 *  - Student hour limits are enforced by the scheduler (6 h/day, 4 h in a row).
 *  - A share of every task is re-checked by a second student before delivery.
 */
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------- task menu
export const MENU = {
  data_entry_100: { title: "Data entry (100 rows)", priceAED: 120, minutes: 90, aiDraft: true, skill: "data" },
  lead_list_50: { title: "Lead list research (50 contacts)", priceAED: 220, minutes: 150, aiDraft: true, skill: "research" },
  transcribe_30: { title: "Transcription (30 min audio, EN/AR/HI)", priceAED: 140, minutes: 90, aiDraft: true, skill: "language" },
  format_doc: { title: "Format a document or deck (up to 20 pages)", priceAED: 110, minutes: 75, aiDraft: false, skill: "office" },
  social_week: { title: "Schedule a week of social posts (from your content)", priceAED: 150, minutes: 90, aiDraft: true, skill: "social" },
  proofread_3k: { title: "Proofread 3,000 words (EN/AR)", priceAED: 130, minutes: 80, aiDraft: true, skill: "language" },
  inbox_tidy: { title: "Tidy a shared inbox / spreadsheet (2 hours)", priceAED: 140, minutes: 120, aiDraft: false, skill: "office" },
} as const;
export type TaskType = keyof typeof MENU;
export type Skill = (typeof MENU)[TaskType]["skill"];

export const ECON = {
  wageAEDPerHour: 45, // paid to the student
  permitAEDPerYear: 600, // part-time permit, filed once per student (tlz.ae, Mar 2026)
  qaSampleRate: 0.15, // share of tasks re-checked by a second student
  qaMinutes: 15,
  aiDraftSavesPct: 0.35, // time saved when AI drafts first (assumption)
  paymentFeePct: 0.03,
};

export const LIMITS = { maxHoursPerDay: 6, maxConsecutiveHours: 4, minRestMinutes: 60 };

// ---------------------------------------------------------------- model
export interface Student {
  id: string;
  name: string;
  university: string;
  skills: Skill[];
  sponsorApproval: boolean; // university / visa sponsor approval on file
  age: number;
  permit?: { filedOn: string; expiresOn: string };
  blackoutDates: string[]; // exams
  shifts: { date: string; start: number; end: number }[]; // minutes of day
  earnedAED: number;
}

export interface Task {
  id: string;
  business: string;
  type: TaskType;
  brief: string;
  status: "queued" | "claimed" | "submitted" | "qa" | "delivered" | "approved" | "rejected";
  studentId?: string;
  qaStudentId?: string;
  workMinutes: number;
  createdOn: string;
}

export function taskMinutes(type: TaskType) {
  const m = MENU[type];
  return Math.round(m.minutes * (m.aiDraft ? 1 - ECON.aiDraftSavesPct : 1));
}

/** Margin per task after wage, QA expectation and payment fee (permit amortised separately). */
export function taskMargin(type: TaskType) {
  const price = MENU[type].priceAED;
  const wage = (taskMinutes(type) / 60) * ECON.wageAEDPerHour;
  const qa = ECON.qaSampleRate * (ECON.qaMinutes / 60) * ECON.wageAEDPerHour;
  return Math.round((price - wage - qa - price * ECON.paymentFeePct) * 100) / 100;
}

// ---------------------------------------------------------------- hour limits
/** Can this student work `minutes` starting at `start` (minute of day) on `date`? */
export function canWork(s: Student, date: string, start: number, minutes: number): { ok: boolean; reason?: string } {
  if (s.blackoutDates.includes(date)) return { ok: false, reason: "exam blackout" };
  const today = s.shifts.filter((x) => x.date === date).sort((a, b) => a.start - b.start);
  const used = today.reduce((t, x) => t + (x.end - x.start), 0);
  if (used + minutes > LIMITS.maxHoursPerDay * 60) return { ok: false, reason: "daily limit (6 h)" };
  const end = start + minutes;
  if (today.some((x) => start < x.end && end > x.start)) return { ok: false, reason: "overlaps another shift" };
  // the continuous block this shift joins (gaps shorter than the rest break merge blocks)
  let blockStart = start, blockEnd = end;
  for (const x of today) {
    if (x.end <= blockStart && blockStart - x.end < LIMITS.minRestMinutes) blockStart = Math.min(blockStart, x.start);
    if (x.start >= blockEnd && x.start - blockEnd < LIMITS.minRestMinutes) blockEnd = Math.max(blockEnd, x.end);
  }
  if (blockEnd - blockStart > LIMITS.maxConsecutiveHours * 60) return { ok: false, reason: "more than 4 h in a row without a 1 h break" };
  return { ok: true };
}

// ---------------------------------------------------------------- store
export class Store {
  students = new Map<string, Student>();
  tasks = new Map<string, Task>();
  permitsFiled = 0;
  ledger: { at: string; kind: "client_charge" | "wage" | "permit" | "refund"; amountAED: number; ref: string }[] = [];

  addStudent(s: Omit<Student, "id" | "shifts" | "earnedAED" | "permit">) {
    const st: Student = { ...s, id: "s_" + randomBytes(4).toString("hex"), shifts: [], earnedAED: 0 };
    this.students.set(st.id, st);
    return st;
  }

  /** File a part-time permit for a student (the platform is the employer). */
  filePermit(studentId: string, today: string) {
    const s = this.getStudent(studentId);
    if (s.age < 18) throw new Error("must be 18 or over");
    if (!s.sponsorApproval) throw new Error("university / visa sponsor approval needed first");
    if (s.permit && s.permit.expiresOn > today) return s.permit;
    const exp = new Date(today);
    exp.setFullYear(exp.getFullYear() + 1);
    s.permit = { filedOn: today, expiresOn: exp.toISOString().slice(0, 10) };
    this.permitsFiled++;
    this.ledger.push({ at: today, kind: "permit", amountAED: ECON.permitAEDPerYear, ref: s.id });
    return s.permit;
  }

  /** Demand-led activation: how many more permitted students the queue needs. */
  studentsNeeded(today: string, hoursPerStudentPerWeek = 8) {
    const queuedMin = [...this.tasks.values()].filter((t) => t.status === "queued").reduce((m, t) => m + t.workMinutes, 0);
    const active = [...this.students.values()].filter((s) => s.permit && s.permit.expiresOn > today).length;
    return Math.max(0, Math.ceil(queuedMin / 60 / hoursPerStudentPerWeek) - active);
  }

  postTask(business: string, type: TaskType, brief: string, today: string) {
    if (!MENU[type]) throw new Error("unknown task type");
    const t: Task = { id: "t_" + randomBytes(4).toString("hex"), business, type, brief, status: "queued", workMinutes: taskMinutes(type), createdOn: today };
    this.tasks.set(t.id, t);
    this.ledger.push({ at: today, kind: "client_charge", amountAED: MENU[type].priceAED, ref: t.id }); // prepaid via payment provider
    return t;
  }

  claim(taskId: string, studentId: string, date: string, start: number) {
    const t = this.getTask(taskId);
    const s = this.getStudent(studentId);
    if (t.status !== "queued") throw new Error("task not available");
    if (!s.permit || s.permit.expiresOn <= date) throw new Error("no valid work permit");
    if (!s.skills.includes(MENU[t.type].skill)) throw new Error("skill not verified for this task");
    const ok = canWork(s, date, start, t.workMinutes);
    if (!ok.ok) throw new Error(`hours rule: ${ok.reason}`);
    s.shifts.push({ date, start, end: start + t.workMinutes });
    t.status = "claimed";
    t.studentId = s.id;
    return t;
  }

  /** Submit work; a sample goes to QA by a different student, the rest is delivered. */
  submit(taskId: string, date: string, rnd = Math.random) {
    const t = this.getTask(taskId);
    if (t.status !== "claimed") throw new Error("not claimed");
    this.payWage(t.studentId!, t.workMinutes, date, t.id);
    t.status = rnd() < ECON.qaSampleRate ? "qa" : "delivered";
    return t;
  }

  qaPass(taskId: string, qaStudentId: string, date: string, start: number, pass: boolean) {
    const t = this.getTask(taskId);
    if (t.status !== "qa") throw new Error("not in QA");
    if (qaStudentId === t.studentId) throw new Error("QA must be done by a different student");
    const qs = this.getStudent(qaStudentId);
    const ok = canWork(qs, date, start, ECON.qaMinutes);
    if (!ok.ok) throw new Error(`hours rule: ${ok.reason}`);
    qs.shifts.push({ date, start, end: start + ECON.qaMinutes });
    this.payWage(qaStudentId, ECON.qaMinutes, date, t.id + ":qa");
    t.qaStudentId = qaStudentId;
    t.status = pass ? "delivered" : "queued"; // failed QA goes back to the queue for rework
    if (!pass) t.studentId = undefined;
    return t;
  }

  approve(taskId: string, approved: boolean, date: string) {
    const t = this.getTask(taskId);
    if (t.status !== "delivered") throw new Error("not delivered");
    t.status = approved ? "approved" : "rejected";
    if (!approved) this.ledger.push({ at: date, kind: "refund", amountAED: MENU[t.type].priceAED, ref: t.id });
    return t;
  }

  payWage(studentId: string, minutes: number, date: string, ref: string) {
    const amt = Math.round((minutes / 60) * ECON.wageAEDPerHour * 100) / 100;
    this.getStudent(studentId).earnedAED += amt;
    this.ledger.push({ at: date, kind: "wage", amountAED: amt, ref });
  }

  pnl() {
    const sum = (k: string) => this.ledger.filter((l) => l.kind === k).reduce((s, l) => s + l.amountAED, 0);
    const revenue = sum("client_charge") - sum("refund");
    const wages = sum("wage"), permits = sum("permit");
    return { revenueAED: revenue, wagesAED: Math.round(wages), permitsAED: permits, paymentFeesAED: Math.round(revenue * ECON.paymentFeePct),
      grossMarginAED: Math.round(revenue - wages - permits - revenue * ECON.paymentFeePct) };
  }

  getStudent(id: string) { const s = this.students.get(id); if (!s) throw new Error("unknown student"); return s; }
  getTask(id: string) { const t = this.tasks.get(id); if (!t) throw new Error("unknown task"); return t; }
}
