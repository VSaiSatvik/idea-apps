/** Escalation pack: a printable bilingual demand letter + evidence bundle. DRAFT — needs review by a UAE lawyer and a legal translator before real use. */
import { Invoice, evidence, fmtAED, invoiceHash, triage } from "./core.js";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function demandLetter(inv: Invoice, today: string) {
  const ack = inv.acknowledgments.at(-1);
  const ackLineEn = ack ? ` You confirmed this invoice electronically on ${ack.at.slice(0, 10)}.` : "";
  const ackLineAr = ack ? ` وقد أقررتم بهذه الفاتورة إلكترونياً بتاريخ ${ack.at.slice(0, 10)}.` : "";
  return {
    en: `DEMAND FOR PAYMENT\n\nDate: ${today}\nTo: ${inv.debtor.name}\nFrom: ${inv.creditor.name}\n\nWe demand payment of ${fmtAED(inv.amountAED)} due under invoice ${inv.number} dated ${inv.issuedOn}, which fell due on ${inv.dueOn}.${ackLineEn}\n\nPlease pay within five (5) days of receiving this demand. If payment is not received, we intend to take legal action, including applying to the court for a payment order.`,
    ar: `إنذار بالسداد\n\nالتاريخ: ${today}\nإلى: ${inv.debtor.name}\nمن: ${inv.creditor.name}\n\nنطالبكم بسداد مبلغ ${inv.amountAED.toLocaleString("en-US")} درهم إماراتي المستحق بموجب الفاتورة رقم ${inv.number} المؤرخة ${inv.issuedOn}، والتي استحق سدادها بتاريخ ${inv.dueOn}.${ackLineAr}\n\nيرجى السداد خلال خمسة (5) أيام من تاريخ استلام هذا الإنذار، وفي حال عدم السداد فإننا نعتزم اتخاذ الإجراءات القانونية، بما في ذلك التقدم إلى المحكمة بطلب أمر أداء.`,
  };
}

export function packHtml(inv: Invoice, today: string): string {
  const ev = evidence(inv);
  const t = triage(inv);
  const letter = demandLetter(inv, today);
  const rows = [
    ...inv.acknowledgments.map((a) => `<tr><td>${esc(a.at)}</td><td>Electronic acknowledgment (${a.kind})</td><td>${esc(a.byName)}${a.byPhone ? " · " + esc(a.byPhone) : ""}</td><td><code>${a.invoiceHash.slice(0, 16)}…</code></td></tr>`),
    ...inv.admissions.map((a) => `<tr><td>${esc(a.at)}</td><td>WhatsApp: ${esc(a.pattern.replace(/_/g, " "))}</td><td>${esc(a.sender)}: “${esc(a.text)}”</td><td></td></tr>`),
  ].join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Escalation pack ${esc(inv.number)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:820px;margin:24px auto;padding:0 16px;color:#1d1d1f}
pre{white-space:pre-wrap;font-family:inherit;border:1px solid #ccc;padding:16px;border-radius:8px}
.ar{direction:rtl;text-align:right;font-family:"Noto Naskh Arabic",serif}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px;font-size:14px;vertical-align:top}
.note{background:#fff6e0;padding:10px;border-radius:6px}</style></head><body>
<h1>Escalation pack — invoice ${esc(inv.number)}</h1>
<p class="note"><strong>Draft for the creditor to send.</strong> Wasl does not contact the debtor. Have a UAE lawyer and a legal translator review the letter before use. Not legal advice.</p>
<h2>Recommended route: ${t.route.replace(/_/g, " ")}</h2><p>${esc(t.why)}</p>
<h2>Evidence (${ev.strength}, score ${ev.score}/100)</h2><ul>${ev.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
<p>Invoice fingerprint (SHA-256): <code>${invoiceHash(inv)}</code></p>
<table><tr><th>When</th><th>What</th><th>Who / text</th><th>Hash</th></tr>${rows || '<tr><td colspan="4">No acknowledgments recorded</td></tr>'}</table>
<h2>Demand letter (English)</h2><pre>${esc(letter.en)}</pre>
<h2>Demand letter (Arabic)</h2><pre class="ar">${esc(letter.ar)}</pre>
<h2>Next steps</h2><ol><li>Serve the demand by notary or registered post so the date of receipt can be proven.</li><li>Wait at least 5 days from receipt.</li><li>${t.route === "law_firm_referral" ? "Hand this pack to the partner law firm to file a payment order." : "If still unpaid, file through the small-claims track with this pack."}</li></ol>
</body></html>`;
}
