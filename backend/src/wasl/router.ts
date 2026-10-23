/**
 * Wasl — evidence-first invoicing. Wraps the tested engine from
 * invoice-recovery/build-v2 with accounts, ownership and persistence.
 * Public:   GET/POST /wasl/a/:token   (the client's bilingual confirmation page)
 * Private:  /wasl/invoices…            (the freelancer's app)
 */
import express from "express";
import { HttpError, onAccountDeleted, requireUser } from "../lib/auth.js";
import { persisted } from "../lib/persist.js";
import { Store, ackStatements, evidence, findAdmissions, ladder, lint, triage, type Invoice } from "./core.js";
import { demandLetter, packHtml } from "./pack.js";

class WaslDb {
  store = new Store();
  owner = new Map<string, string>(); // invoiceId -> userId
}

const db = persisted("wasl", () => new WaslDb());
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const base = () => (process.env.PUBLIC_URL ?? "http://localhost:8080").replace(/\/$/, "");
export const ackUrl = (inv: Invoice) => `${base()}/wasl/a/${inv.ackToken}`;

onAccountDeleted((uid) => {
  for (const [iid, owner] of [...db.value.owner]) {
    if (owner !== uid) continue;
    const inv = db.value.store.invoices.get(iid);
    if (inv) db.value.store.byToken.delete(inv.ackToken);
    db.value.store.invoices.delete(iid);
    db.value.owner.delete(iid);
  }
  db.save();
});

function mine(req: express.Request) {
  const id = String(req.params.id);
  if (db.value.owner.get(id) !== req.user!.id) throw new HttpError(404, "Invoice not found");
  return db.value.store.invoices.get(id)!;
}

function view(inv: Invoice) {
  return { ...inv, ackUrl: ackUrl(inv), evidence: evidence(inv), triage: triage(inv), overdue: inv.status !== "paid" && inv.dueOn < new Date().toISOString().slice(0, 10) };
}

export function waslPublicRouter() {
  const r = express.Router();
  r.use(express.urlencoded({ extended: false }));
  r.get("/a/:token", (req, res) => {
    const id = db.value.store.byToken.get(req.params.token);
    if (!id) return res.status(404).send("Link not found");
    const inv = db.value.store.invoices.get(id)!;
    const s = ackStatements(inv);
    const done = inv.acknowledgments.length > 0;
    res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirm invoice ${esc(inv.number)}</title>
<style>:root{--bg:#f6f4ef;--ink:#1d1b18;--muted:#6a645a;--card:#fff;--acc:#0f6b4f}
@media (prefers-color-scheme:dark){:root{--bg:#141311;--ink:#f1ede6;--muted:#a39d93;--card:#1f1d1a;--acc:#5fd3a5}}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.45 system-ui,sans-serif}main{max-width:520px;margin:0 auto;padding:20px 16px}
.card{background:var(--card);border-radius:14px;padding:18px;margin:12px 0}.ar{direction:rtl;text-align:right;font-family:"Noto Naskh Arabic",serif}
input,button{font:inherit;width:100%;padding:12px;margin:6px 0;border-radius:10px;border:1px solid var(--muted);box-sizing:border-box;background:var(--card);color:var(--ink)}
button{background:var(--acc);color:#fff;border:0;font-weight:600}small{color:var(--muted)}</style></head><body><main>
<h2>Confirm invoice · تأكيد الفاتورة</h2>
<div class="card"><p>${esc(s.en)}</p><p class="ar">${esc(s.ar)}</p></div>
${done ? `<div class="card">✓ Already confirmed on ${esc(inv.acknowledgments.at(-1)!.at.slice(0, 10))}. You can confirm a new date below if needed.</div>` : ""}
<form method="post" class="card"><input name="name" placeholder="Your full name / الاسم الكامل" required minlength="2">
<input name="phone" placeholder="Mobile (optional) / رقم الجوال" inputmode="tel">
<label><small>Need a different payment date? / تحتاج موعداً آخر؟</small><input name="newDueOn" type="date"></label>
<button>I confirm / أؤكد</button></form>
<p><small>Sent with Wasl on behalf of ${esc(inv.creditor.name)}. Wasl does not collect payments or contact you again.</small></p></main></body></html>`);
  });
  r.post("/a/:token", (req, res) => {
    try {
      const ack = db.value.store.acknowledge(req.params.token, String(req.body.name ?? ""), { phone: req.body.phone || undefined, ip: req.ip, newDueOn: req.body.newDueOn || undefined });
      db.save();
      res.type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:18px system-ui;padding:24px;max-width:520px;margin:auto"><h2>Thank you ✓</h2><p>Confirmed on ${esc(ack.at.slice(0, 16).replace("T", " "))} UTC.</p><p dir="rtl">شكراً لك — تم التأكيد.</p></body>`);
    } catch (e) {
      res.status(400).send(esc((e as Error).message));
    }
  });
  return r;
}

export function waslRouter() {
  const r = express.Router();
  r.use(requireUser);
  r.use("/invoices/:id/whatsapp", express.text({ type: "*/*", limit: "5mb" }));

  r.get("/invoices", (req, res) => {
    const list = [...db.value.owner].filter(([, u]) => u === req.user!.id).map(([iid]) => db.value.store.invoices.get(iid)!).filter(Boolean);
    res.json(list.map(view).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn)));
  });

  r.post("/invoices", (req, res) => {
    const b = req.body;
    for (const k of ["number", "debtorName", "amountAED", "description", "issuedOn", "dueOn"]) if (b[k] === undefined || b[k] === "") throw new HttpError(400, `Missing ${k}`);
    const amount = Number(b.amountAED);
    if (!(amount > 0)) throw new HttpError(400, "Amount must be a positive number");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.issuedOn) || !/^\d{4}-\d{2}-\d{2}$/.test(b.dueOn)) throw new HttpError(400, "Dates must be YYYY-MM-DD");
    const inv = db.value.store.create({
      number: String(b.number), creditor: { name: String(b.creditorName || req.user!.name) },
      debtor: { name: String(b.debtorName), phone: b.debtorPhone || undefined, email: b.debtorEmail || undefined },
      amountAED: amount, description: String(b.description), issuedOn: b.issuedOn, dueOn: b.dueOn, hasSignedContract: !!b.hasSignedContract,
    });
    db.value.owner.set(inv.id, req.user!.id);
    db.save();
    res.status(201).json(view(inv));
  });

  r.get("/invoices/:id", (req, res) => res.json(view(mine(req))));

  r.patch("/invoices/:id", (req, res) => {
    const inv = mine(req);
    if (req.body.status === "paid" || req.body.status === "sent") inv.status = req.body.status === "paid" ? "paid" : inv.acknowledgments.length ? "acknowledged" : "sent";
    if (typeof req.body.hasSignedContract === "boolean") inv.hasSignedContract = req.body.hasSignedContract;
    db.save();
    res.json(view(inv));
  });

  r.delete("/invoices/:id", (req, res) => {
    const inv = mine(req);
    db.value.store.byToken.delete(inv.ackToken);
    db.value.store.invoices.delete(inv.id);
    db.value.owner.delete(inv.id);
    db.save();
    res.json({ deleted: true });
  });

  r.post("/invoices/:id/whatsapp", (req, res) => {
    const inv = mine(req);
    const found = findAdmissions(String(req.body ?? ""), inv.debtor.name);
    const known = new Set(inv.admissions.map((a) => a.at + a.text));
    inv.admissions.push(...found.filter((f) => !known.has(f.at + f.text)));
    db.save();
    res.json({ found, invoice: view(inv) });
  });

  r.get("/invoices/:id/ladder", (req, res) => {
    const inv = mine(req);
    res.json({ steps: ladder(inv, ackUrl(inv)) });
  });

  r.post("/lint", (req, res) => res.json(lint(String(req.body.message ?? ""))));

  r.get("/invoices/:id/pack", (req, res) => {
    const inv = mine(req);
    res.json({ html: packHtml(inv, new Date().toISOString().slice(0, 10)), letter: demandLetter(inv, new Date().toISOString().slice(0, 10)) });
  });

  return r;
}

/** Gives the reviewer account one overdue sample invoice so every screen has something to show. */
export function seedWaslDemo(userId: string) {
  if ([...db.value.owner.values()].includes(userId)) return;
  const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
  const inv = db.value.store.create({
    number: "INV-1001", creditor: { name: "Demo Reviewer" },
    debtor: { name: "Sample Trading LLC", phone: "+971500000000" },
    amountAED: 4500, description: "Website design, phase 1", issuedOn: day(-45), dueOn: day(-15), hasSignedContract: true,
  });
  db.value.owner.set(inv.id, userId);
  db.save();
}
