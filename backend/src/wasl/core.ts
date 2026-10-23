/**
 * Wasl core: acknowledgment capture, evidence scoring, WhatsApp admission
 * detection, compliance lint, reminder ladder and escalation triage.
 * Pure functions + a small in-memory store, so it is easy to test.
 */
import { createHash, randomBytes } from "node:crypto";

export interface Invoice {
  id: string;
  number: string;
  creditor: { name: string; phone?: string; email?: string };
  debtor: { name: string; phone?: string; email?: string };
  amountAED: number;
  description: string;
  issuedOn: string; // YYYY-MM-DD
  dueOn: string; // YYYY-MM-DD
  hasSignedContract: boolean;
  ackToken: string;
  acknowledgments: Acknowledgment[];
  admissions: Admission[];
  status: "sent" | "acknowledged" | "overdue" | "paid";
}

export interface Acknowledgment {
  kind: "invoice" | "new_due_date";
  at: string; // ISO timestamp
  byName: string;
  byPhone?: string;
  ip?: string;
  invoiceHash: string;
  statementEn: string;
  statementAr: string;
  dueOn: string;
}

export interface Admission {
  at: string;
  sender: string;
  text: string;
  pattern: string;
}

// ---------------------------------------------------------------- hashing
export function invoiceHash(inv: Pick<Invoice, "number" | "creditor" | "debtor" | "amountAED" | "description" | "issuedOn" | "dueOn">): string {
  const canonical = JSON.stringify([inv.number, inv.creditor.name, inv.debtor.name, inv.amountAED, inv.description, inv.issuedOn, inv.dueOn]);
  return createHash("sha256").update(canonical).digest("hex");
}

export const fmtAED = (n: number) => `AED ${n.toLocaleString("en-US")}`;

export function ackStatements(inv: Invoice, dueOn = inv.dueOn) {
  return {
    en: `I, ${inv.debtor.name}, confirm that I received invoice ${inv.number} from ${inv.creditor.name} for ${fmtAED(inv.amountAED)} for "${inv.description}", and that this amount is due for payment on ${dueOn}.`,
    ar: `أؤكد أنا، ${inv.debtor.name}، أنني استلمت الفاتورة رقم ${inv.number} من ${inv.creditor.name} بمبلغ ${inv.amountAED.toLocaleString("en-US")} درهم إماراتي مقابل "${inv.description}"، وأن هذا المبلغ مستحق السداد بتاريخ ${dueOn}.`,
  };
}

// ---------------------------------------------------------------- store
export class Store {
  invoices = new Map<string, Invoice>();
  byToken = new Map<string, string>();

  create(input: Omit<Invoice, "id" | "ackToken" | "acknowledgments" | "admissions" | "status">): Invoice {
    const id = randomBytes(6).toString("hex");
    const ackToken = randomBytes(16).toString("base64url");
    const inv: Invoice = { ...input, id, ackToken, acknowledgments: [], admissions: [], status: "sent" };
    this.invoices.set(id, inv);
    this.byToken.set(ackToken, id);
    return inv;
  }

  acknowledge(token: string, byName: string, meta: { phone?: string; ip?: string; at?: string; newDueOn?: string } = {}): Acknowledgment {
    const id = this.byToken.get(token);
    if (!id) throw new Error("unknown link");
    const inv = this.invoices.get(id)!;
    if (byName.trim().length < 2) throw new Error("name required");
    const dueOn = meta.newDueOn ?? inv.dueOn;
    const s = ackStatements(inv, dueOn);
    const ack: Acknowledgment = {
      kind: meta.newDueOn ? "new_due_date" : "invoice",
      at: meta.at ?? new Date().toISOString(),
      byName: byName.trim(),
      byPhone: meta.phone,
      ip: meta.ip,
      invoiceHash: invoiceHash(inv),
      statementEn: s.en,
      statementAr: s.ar,
      dueOn,
    };
    inv.acknowledgments.push(ack);
    if (meta.newDueOn) inv.dueOn = meta.newDueOn;
    if (inv.status === "sent") inv.status = "acknowledged";
    return ack;
  }
}

// ---------------------------------------------------------------- WhatsApp admissions
/** Phrases where a debtor admits the debt or promises payment (English + Arabic). */
const ADMISSION_PATTERNS: [string, RegExp][] = [
  ["promise_to_pay", /\b(will|i'll|we'll|going to|gonna) (pay|transfer|send (the|your) (money|payment))\b/i],
  ["apology_for_delay", /\b(sorry|apologi[sz]e)\b.*\b(delay|late|payment)\b/i],
  ["acknowledges_amount", /\b(i|we) (owe|know we owe|haven't paid)\b/i],
  ["payment_processing", /\b(payment|invoice) (is )?(being processed|in process|approved|with finance)\b/i],
  ["promise_to_pay_ar", /(سأدفع|سوف أدفع|سنحول|سأحول|سيتم التحويل|سندفع)/],
  ["apology_ar", /(آسف|اعتذر|أعتذر).*(التأخير|الدفع)/],
];

/** Parse a WhatsApp "export chat" text file. Supports the common iOS and Android line formats. */
export function parseWhatsApp(txt: string): { at: string; sender: string; text: string }[] {
  const lines = txt.split(/\r?\n/);
  const re = /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),? (\d{1,2}:\d{2})(?::\d{2})?\s?(AM|PM|am|pm)?\]?\s?(?:-\s)?([^:]+): (.*)$/;
  const out: { at: string; sender: string; text: string }[] = [];
  for (const line of lines) {
    const m = line.replace(/‎/g, "").match(re);
    if (m) {
      const [, d, mo, y] = m;
      const yr = y.length === 2 ? `20${y}` : y;
      out.push({ at: `${yr}-${mo.padStart(2, "0")}-${d.padStart(2, "0")} ${m[4]}${m[5] ? " " + m[5].toUpperCase() : ""}`, sender: m[6].trim(), text: m[7] });
    } else if (out.length && line.trim()) {
      out[out.length - 1].text += "\n" + line;
    }
  }
  return out;
}

export function findAdmissions(chat: string, debtorName: string): Admission[] {
  const debtorKey = debtorName.toLowerCase().split(/\s+/)[0];
  return parseWhatsApp(chat)
    .filter((m) => m.sender.toLowerCase().includes(debtorKey))
    .flatMap((m) => {
      const hit = ADMISSION_PATTERNS.find(([, re]) => re.test(m.text));
      return hit ? [{ at: m.at, sender: m.sender, text: m.text, pattern: hit[0] }] : [];
    });
}

// ---------------------------------------------------------------- evidence score
export type Strength = "strong" | "moderate" | "weak";

export function evidence(inv: Invoice): { strength: Strength; score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (inv.hasSignedContract) { score += 50; reasons.push("signed contract"); }
  const acks = inv.acknowledgments.length;
  if (acks) { score += 45; reasons.push(`client acknowledged the invoice electronically (${acks}x)`); }
  if (inv.admissions.length) {
    score += Math.min(35, 15 * inv.admissions.length);
    reasons.push(`${inv.admissions.length} WhatsApp message(s) where the client admitted the debt or promised payment`);
  }
  if (!reasons.length) reasons.push("no written acknowledgment by the client yet");
  const strength: Strength = score >= 45 ? "strong" : score >= 15 ? "moderate" : "weak";
  return { strength, score: Math.min(score, 100), reasons };
}

// ---------------------------------------------------------------- compliance lint
/** Blocks wording that could be a threat, insult, shaming or impersonation (Penal Code / Cybercrime Law risk). */
const BLOCKED: [string, RegExp][] = [
  ["threat", /\b(or else|we will (ruin|destroy|expose)|you('ll| will) regret|watch your back)\b/i],
  ["shaming", /\b(post|share|tell)\b.*\b(everyone|social media|instagram|linkedin|your (boss|family|clients))\b/i],
  ["insult", /\b(liar|thief|cheat(er)?|scammer|fraudster|idiot|shameless)\b/i],
  ["false_authority", /\b(police|court) (has|have) (issued|ordered)\b|\bwarrant\b|\btravel ban\b/i],
  ["contact_third_party", /\b(contact|call|message) your (family|wife|husband|employer|manager)\b/i],
];

export function lint(message: string): { ok: boolean; problems: string[] } {
  const problems = BLOCKED.filter(([, re]) => re.test(message)).map(([k]) => k);
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------- reminder ladder
export interface Step {
  day: number; // days after due date
  tone: "friendly" | "firm" | "options" | "final";
  en: string;
  ar: string;
}

export function ladder(inv: Invoice, ackUrl: string): Step[] {
  const amt = fmtAED(inv.amountAED);
  const amtAr = `${inv.amountAED.toLocaleString("en-US")} درهم`;
  const steps: Step[] = [
    { day: -2, tone: "friendly",
      en: `Hi ${inv.debtor.name}, a quick reminder that invoice ${inv.number} (${amt}) is due on ${inv.dueOn}. Thank you!`,
      ar: `مرحباً ${inv.debtor.name}، تذكير بأن الفاتورة رقم ${inv.number} (${amtAr}) مستحقة بتاريخ ${inv.dueOn}. شكراً لك!` },
    { day: 3, tone: "friendly",
      en: `Hi ${inv.debtor.name}, invoice ${inv.number} (${amt}) was due on ${inv.dueOn}. Could you let me know when payment will be made?`,
      ar: `مرحباً ${inv.debtor.name}، كانت الفاتورة رقم ${inv.number} (${amtAr}) مستحقة بتاريخ ${inv.dueOn}. هل يمكنك إخباري بموعد السداد؟` },
    { day: 10, tone: "options",
      en: `Hi ${inv.debtor.name}, if paying ${amt} at once is difficult, I'm happy to agree a new date or split it into two payments. You can confirm a new date here: ${ackUrl}`,
      ar: `مرحباً ${inv.debtor.name}، إذا كان سداد ${amtAr} دفعة واحدة صعباً، يسعدني الاتفاق على موعد جديد أو تقسيمه على دفعتين. يمكنك تأكيد الموعد الجديد هنا: ${ackUrl}` },
    { day: 21, tone: "firm",
      en: `Hi ${inv.debtor.name}, invoice ${inv.number} (${amt}) is now 3 weeks overdue. Please arrange payment within 7 days.`,
      ar: `مرحباً ${inv.debtor.name}، مضى على استحقاق الفاتورة رقم ${inv.number} (${amtAr}) ثلاثة أسابيع. يرجى السداد خلال 7 أيام.` },
  ];
  const ev = evidence(inv);
  if (ev.strength !== "weak") {
    steps.push({ day: 30, tone: "final",
      en: `Hi ${inv.debtor.name}, invoice ${inv.number} (${amt}) remains unpaid. If it isn't settled within 5 days I will send a formal demand for payment, which is the first step towards a court payment order.`,
      ar: `مرحباً ${inv.debtor.name}، لا تزال الفاتورة رقم ${inv.number} (${amtAr}) غير مسددة. إذا لم يتم السداد خلال 5 أيام فسأرسل إنذاراً رسمياً بالسداد، وهو الخطوة الأولى للتقدم بطلب أمر أداء.` });
  }
  for (const s of steps) {
    const l = lint(s.en);
    if (!l.ok) throw new Error(`ladder template failed lint: ${l.problems}`);
  }
  return steps;
}

// ---------------------------------------------------------------- triage
export type Route = "law_firm_referral" | "self_serve_demand_and_small_claims" | "relationship_only";

export function triage(inv: Invoice, lawFirmMinAED = 15000): { route: Route; why: string } {
  const ev = evidence(inv);
  if (ev.strength === "weak") {
    return { route: "relationship_only", why: "There is no written acknowledgment of this debt, so a legal threat would likely be a bluff. Keep to the options step and ask the client to confirm a new date (which creates the acknowledgment)." };
  }
  if (inv.amountAED >= lawFirmMinAED && ev.strength === "strong") {
    return { route: "law_firm_referral", why: `Strong evidence (${ev.reasons.join("; ")}) and ${fmtAED(inv.amountAED)} justify a lawyer-led payment order.` };
  }
  return { route: "self_serve_demand_and_small_claims", why: `Evidence is ${ev.strength} but the amount is small: send the demand yourself by notary or registered post, wait 5 days, then use the small-claims track.` };
}
