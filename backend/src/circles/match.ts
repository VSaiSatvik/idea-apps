/**
 * Matching rules ported from AskOnce Ledger (askonce/build-v2/ledger.py):
 *  - personal questions ("my emails", "my meetings") are never shared or reused
 *  - slot guard: questions only match when quarter/region/city/leave type/
 *    object/dialect/year/course code/week agree
 *  - facts: numbers with units and yes/no, used to flag disagreement
 */

const PERSONAL = [
  /\bmy (unread )?e-?mails?\b/, /\bmy inbox\b/, /\bmy calendar\b/, /\bmy meetings?\b/,
  /\bmeetings? (do i|for) .*tomorrow\b/, /\btomorrow's meetings\b/, /\blist my\b/,
  /\bmy (files|tasks|tickets|grades?|marks|gpa|results?|password|account|bank|salary)\b/,
  /\bunread emails\b/, /\bsummar\w+ (my|the emails)\b/, /\bmy (health|diagnosis|medication|symptoms?)\b/,
];

export function isPersonal(q: string) {
  const t = q.toLowerCase();
  return PERSONAL.some((re) => re.test(t));
}

const SLOT_FAMILIES: Record<string, [RegExp, string][]> = {
  quarter: [[/\bq1\b|\bfirst quarter\b/, "Q1"], [/\bq2\b|\bsecond quarter\b/, "Q2"], [/\bq3\b|\bthird quarter\b/, "Q3"], [/\bq4\b|\bfourth quarter\b/, "Q4"]],
  region: [[/\bemea\b/, "EMEA"], [/\bapac\b/, "APAC"], [/\bamericas\b/, "AMER"], [/\bmena\b|\bmiddle east\b/, "MENA"]],
  city: [[/\blondon\b/, "London"], [/\bparis\b/, "Paris"], [/\bdubai\b/, "Dubai"], [/\bsharjah\b/, "Sharjah"], [/\babu dhabi\b/, "Abu Dhabi"], [/\bnew york\b/, "New York"]],
  leave_type: [[/\bparental\b|\bmaternity\b|\bpaternity\b/, "parental"], [/\bsick\b/, "sick"], [/\bannual\b|\bvacation\b/, "annual"]],
  object: [[/\bsubscription\b/, "subscription"], [/\bpurchase order\b/, "purchase_order"]],
  dialect: [[/\bpostgres\w*\b/, "postgres"], [/\bmysql\b/, "mysql"], [/\bt-?sql\b|\bsql server\b/, "tsql"], [/\bpython\b/, "python"], [/\bjava\b(?!script)/, "java"], [/\bjavascript\b|\btypescript\b/, "js"], [/\bc\+\+/, "cpp"]],
  semester: [[/\bfall\b/, "fall"], [/\bspring\b/, "spring"], [/\bsummer\b/, "summer"]],
};

export function slots(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  for (const [fam, alts] of Object.entries(SLOT_FAMILIES)) {
    const hit = alts.find(([re]) => re.test(t));
    if (hit) out.push(`${fam}:${hit[1]}`);
  }
  for (const y of t.match(/\b(19|20)\d{2}\b/g) ?? []) out.push(`year:${y}`);
  for (const c of t.match(/\b[a-z]{2,4}\s?\d{3}\b/g) ?? []) out.push(`course:${c.replace(/\s/g, "")}`); // e.g. CMP 333
  for (const w of t.match(/\b(week|chapter|lecture|lab|assignment|hw|homework|question|q)\s?#?\d+\b/g) ?? []) out.push(`part:${w.replace(/\s|#/g, "")}`);
  return [...new Set(out)].sort();
}

const NUM_RE = /\b(?:(?:usd|eur|gbp|aed|inr|rs)\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|m\b|k\b|million|days?\b|weeks?\b|hours?\b|marks?\b|points?\b))?/gi;

export function facts(answer: string): string[] {
  const out = new Set<string>();
  // ignore numbers that appear in the question-like preamble of very long answers: take the first 600 chars
  const head = answer.slice(0, 600);
  for (const m of head.match(NUM_RE) ?? []) out.add(m.toLowerCase().replace(/[\s,]/g, ""));
  const a = head.trim().toLowerCase();
  if (/^(yes|you can|it is allowed|allowed)\b/.test(a)) out.add("polarity:yes");
  if (/^(no|you cannot|you can't|not allowed)\b/.test(a)) out.add("polarity:no");
  return [...out].sort();
}

const STOP = new Set("a an the is are was were be been of to in on for and or with what how do does did i we you it this that can could should would will my our your me at by from as about which who when where why there their they them please explain tell".split(" "));

export function tokens(text: string): Map<string, number> {
  const m = new Map<string, number>();
  const words = text.toLowerCase().replace(/[^a-z0-9+#\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
  const add = (k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  words.forEach((w, i) => {
    add(w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w);
    if (i) add(`${words[i - 1]}_${w}`);
  });
  return m;
}

export function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; const w = b.get(k); if (w) dot += v * w; }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Same question? Similarity above the bar AND identical slots. Agreeing on slots lowers the bar slightly. */
export function sameQuestion(q1: string, q2: string, bar = 0.45) {
  const s1 = slots(q1), s2 = slots(q2);
  if (s1.join("|") !== s2.join("|")) return { same: false, sim: 0 };
  const sim = cosine(tokens(q1), tokens(q2));
  return { same: sim >= (s1.length ? bar - 0.15 : bar), sim };
}
