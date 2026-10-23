import "./setup.js";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp, seedDemo } from "../src/app.js";

let srv: Server;
let url = "";
const pushed: { to: string; body: string }[] = [];

before(() => {
  seedDemo();
  srv = createApp({ push: async (m) => { pushed.push(...m); return m.length; } }).listen(0);
  url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
after(() => srv.close());

async function call(method: string, path: string, token?: string, body?: unknown, raw = false) {
  const r = await fetch(url + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": raw ? "text/plain" : "application/json" }, body: body === undefined ? undefined : raw ? String(body) : JSON.stringify(body) });
  const ct = r.headers.get("content-type") ?? "";
  return { status: r.status, body: ct.includes("json") ? await r.json() : await r.text() };
}
const signup = async (email: string, name: string) => (await call("POST", "/auth/signup", undefined, { email, password: "password123", name })).body.token as string;
const login = async (email: string) => (await call("POST", "/auth/login", undefined, { email, password: "ReviewDemo2026!" })).body.token as string;

test("auth: signup, login, wrong password, me, validation", async () => {
  const t = await signup("sai@example.com", "Sai");
  assert.equal((await call("GET", "/auth/me", t)).body.email, "sai@example.com");
  assert.equal((await call("POST", "/auth/login", undefined, { email: "sai@example.com", password: "nope" })).status, 401);
  assert.equal((await call("POST", "/auth/signup", undefined, { email: "bad", password: "password123" })).status, 400);
  assert.equal((await call("POST", "/auth/signup", undefined, { email: "sai@example.com", password: "password123" })).status, 409);
  assert.equal((await call("GET", "/circles")).status, 401);
  assert.ok(await login("review@demo.app"), "demo reviewer account is seeded");
});

test("circles: create, join, share, search, disagreement, pin, personal blocked, report, block", async () => {
  const a = await signup("aisha@uni.ac.ae", "Aisha");
  const b = await signup("rohan@uni.ac.ae", "Rohan");
  const c = (await call("POST", "/circles", a, { name: "CMP 333 study group" })).body;
  assert.equal((await call("POST", "/circles/join", b, { code: c.inviteCode.toLowerCase() })).status, 200);
  await call("POST", `/circles/${c.id}/share`, a, { question: "When is the CMP 333 project milestone 2 due?", answer: "It is due in week 9.", provider: "anthropic", model: "claude-sonnet-5-5" });
  await call("POST", `/circles/${c.id}/share`, b, { question: "cmp333 project milestone 2 due date?", answer: "Milestone 2 is due in week 10.", provider: "openai", model: "gpt" });
  const other = await call("POST", `/circles/${c.id}/share`, b, { question: "What is the CMP 350 midterm format?", answer: "Two hours, 5 questions.", provider: "google" });
  assert.equal(other.status, 201);
  const s = (await call("POST", `/circles/${c.id}/search`, b, { question: "CMP 333 milestone 2 deadline" })).body;
  assert.equal(s.matches.length, 1, "matches the CMP 333 topic only, not CMP 350");
  assert.ok(s.matches[0].disagreement, "week 9 vs week 10 is flagged");
  const topic = s.matches[0];
  assert.equal((await call("POST", `/circles/${c.id}/pin`, a, { topicKey: topic.key, entryId: topic.answers[0].id })).status, 200);
  const feed = (await call("GET", `/circles/${c.id}`, a)).body;
  assert.equal(feed.topics.length, 2);
  assert.ok(feed.topics.find((t: any) => t.key === topic.key).pinned);
  assert.equal((await call("POST", `/circles/${c.id}/search`, a, { question: "summarise my unread emails" })).body.personal, true);
  assert.equal((await call("POST", `/circles/${c.id}/share`, a, { question: "what meetings do I have tomorrow", answer: "x" })).status, 400);
  // block hides the blocked member's answers for the blocker only
  const bId = feed.members.find((m: any) => !m.me).id;
  await call("POST", `/circles/${c.id}/block`, a, { userId: bId });
  assert.equal((await call("GET", `/circles/${c.id}`, a)).body.topics.flatMap((t: any) => t.answers).length, 1);
  assert.equal((await call("GET", `/circles/${c.id}`, b)).body.topics.flatMap((t: any) => t.answers).length, 3);
  // owner's report hides the entry
  const r = await call("POST", `/circles/${c.id}/entries/${other.body.id}/report`, a, { reason: "spam" });
  assert.equal(r.body.hidden, true);
  // outsiders can't read
  const x = await signup("x@x.com", "X");
  assert.equal((await call("GET", `/circles/${c.id}`, x)).status, 404);
  assert.match((await call("POST", "/circles/demo-answer", x, { question: "hi" })).body.answer, /Demo mode/);
});

test("wasl: invoice, public bilingual confirm page, evidence, WhatsApp import, ladder, lint, pack, ownership", async () => {
  const t = await signup("studio@example.com", "Sai Studio");
  const inv = (await call("POST", "/wasl/invoices", t, { number: "INV-012", debtorName: "Omar Haddad", amountAED: 6500, description: "Brand identity", issuedOn: "2026-10-01", dueOn: "2026-10-31" })).body;
  assert.ok(inv.ackUrl.startsWith("https://api.example.com/wasl/a/"));
  assert.equal(inv.evidence.strength, "weak");
  const path = new URL(inv.ackUrl).pathname;
  assert.match((await call("GET", path)).body, /تأكيد الفاتورة/);
  const conf = await fetch(url + path, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "name=Omar+Haddad" });
  assert.equal(conf.status, 200);
  assert.equal((await call("GET", `/wasl/invoices/${inv.id}`, t)).body.evidence.strength, "strong");
  const chat = "[13/10/2026, 6:02:11 PM] Omar Haddad: Sorry for the delay with the payment, will pay next week";
  const w = await call("POST", `/wasl/invoices/${inv.id}/whatsapp`, t, chat, true);
  assert.equal(w.body.found.length, 1);
  assert.equal((await call("GET", `/wasl/invoices/${inv.id}/ladder`, t)).body.steps.at(-1).tone, "final");
  assert.equal((await call("POST", "/wasl/lint", t, { message: "pay or else" })).body.ok, false);
  assert.match((await call("GET", `/wasl/invoices/${inv.id}/pack`, t)).body.html, /إنذار بالسداد/);
  const other = await signup("other@example.com", "Other");
  assert.equal((await call("GET", `/wasl/invoices/${inv.id}`, other)).status, 404);
  assert.equal((await call("PATCH", `/wasl/invoices/${inv.id}`, t, { status: "paid" })).body.status, "paid");
});

test("vouch: demo crawl visible to venue and creator; till redeem; admin plan, assign, settle", async () => {
  const venue = await login("venue@demo.app");
  const me = (await call("GET", "/vouch/me", venue)).body;
  assert.equal(me.crawls.length, 1);
  const stop = me.crawls[0].stops.find((s: any) => s.mine);
  assert.ok(stop.code && stop.verifiedVisits === 7);
  assert.equal(me.crawls[0].stops.filter((s: any) => s.code).length, 1, "venues only see their own code");
  const ok = (await call("POST", "/vouch/redeem", venue, { code: stop.code, phoneLast3: "999" })).body;
  assert.equal(ok.ok, true);
  const otherCode = (await call("GET", "/vouch/me", await login("admin@demo.app"))).body.crawls[0].stops.find((s: any) => !s.mine && s.id !== stop.id).code;
  assert.equal((await call("POST", "/vouch/redeem", venue, { code: otherCode, phoneLast3: "111" })).body.ok, false);
  const creator = (await call("GET", "/vouch/me", await login("creator@demo.app"))).body;
  assert.equal(creator.creator.permit.ok, true);
  const admin = await login("admin@demo.app");
  const plan = (await call("GET", "/vouch/admin/plan", admin)).body;
  assert.ok(plan.crawls.length >= 1, "JLT venues can be planned");
  const newCrawl = (await call("POST", "/vouch/admin/crawls", admin, { venueIds: plan.crawls[0].venueIds })).body;
  assert.equal(newCrawl.state, "booking");
  assert.equal((await call("GET", "/vouch/admin/plan", venue)).status, 403);
  const settled = (await call("POST", `/vouch/admin/crawls/${me.crawls[0].id}/settle`, admin)).body;
  assert.ok(settled.lines.length >= 3);
  const v = await signup("cafe@example.com", "Cafe");
  assert.equal((await call("POST", "/vouch/venues", v, { name: "New Cafe", area: "JLT", category: "coffee", lat: 25.07, lng: 55.14 })).status, 201);
  assert.equal((await call("PUT", "/vouch/creator", v, { handle: "@new.creator", followers: 9000, permitNumber: "UMC-123456" })).body.permit.ok, false, "permit not yet verified by organiser");
});

test("sidedesk: business order, student waitlist then activated, claim within hours, submit, approve", async () => {
  const biz = await signup("biz@example.com", "Kiln Coffee");
  const order = (await call("POST", "/sidedesk/tasks", biz, { type: "data_entry_100", brief: "Put supplier invoices into our sheet: https://example.com/x" })).body;
  assert.equal(order.status, "queued");
  const st = await signup("stud@example.com", "Aisha");
  assert.equal((await call("PUT", "/sidedesk/student", st, { universityEmail: "aisha@gmail.com", skills: ["data"], age: 20 })).status, 400);
  assert.equal((await call("PUT", "/sidedesk/student", st, { universityEmail: "b00012345@aus.edu", skills: ["data"], age: 20, sponsorApproval: true })).status, 201);
  assert.equal((await call("GET", "/sidedesk/board", st)).status, 403, "waitlisted until activated");
  const admin = await login("admin@demo.app");
  const wl = (await call("GET", "/sidedesk/admin", admin)).body.waitlist;
  const me = wl.find((s: any) => s.universityEmail === "b00012345@aus.edu");
  await call("POST", `/sidedesk/admin/students/${me.id}/permit`, admin);
  const board = (await call("GET", "/sidedesk/board", st)).body;
  assert.ok(board.available.some((t: any) => t.id === order.id));
  assert.match((await call("POST", `/sidedesk/tasks/${order.id}/claim`, st, { date: "2026-12-01", start: 600 })).body.status, /claimed/);
  const sub = (await call("POST", `/sidedesk/tasks/${order.id}/submit`, st, { deliverable: "https://example.com/sheet" })).body;
  if (sub.status === "delivered") {
    assert.equal((await call("POST", `/sidedesk/tasks/${order.id}/approve`, biz, { approved: true })).body.status, "approved");
  }
  assert.equal((await call("POST", "/sidedesk/tasks", biz, { type: "nope", brief: "xxxxxxxxxxxx" })).status, 400);
});

test("shield: pair parent and child, check-in push only to linked family, report routing", async () => {
  const mom = await signup("mom@example.com", "Mom");
  const son = await signup("rahul@example.com", "Rahul");
  const p = (await call("POST", "/shield/pairs", mom, { parentName: "Mom" })).body;
  assert.match(p.code, /^\d{6}$/);
  assert.equal((await call("POST", "/shield/pairs/join", son, { code: "000000" })).status, 404);
  assert.equal((await call("POST", "/shield/pairs/join", son, { code: p.code, pushToken: "ExponentPushToken[abc]" })).body.role, "guardian");
  const ci = (await call("POST", "/shield/checkin", mom, {})).body;
  assert.equal(ci.delivered, 1);
  assert.doesNotMatch(pushed.at(-1)!.body, /\d|OTP|UPI|bank/i);
  assert.equal((await call("POST", "/shield/checkin", mom, { mode: "consented_auto" })).status, 403);
  const rep = (await call("POST", "/shield/report", mom, { number: "+91 7012345678", askedFor: ["OTP"], claimedToBe: "bank KYC", moneyLost: false })).body;
  assert.equal(rep.route, "chakshu");
});

test("account deletion removes the user's data everywhere", async () => {
  const t = await signup("leaver@example.com", "Leaver");
  const c = (await call("POST", "/circles", t, { name: "Solo" })).body;
  await call("POST", "/wasl/invoices", t, { number: "1", debtorName: "D", amountAED: 10, description: "x", issuedOn: "2026-10-01", dueOn: "2026-10-02" });
  await call("POST", "/shield/pairs", t, {});
  assert.equal((await call("DELETE", "/auth/me", t)).body.deleted, true);
  assert.equal((await call("GET", "/auth/me", t)).status, 401);
  const t2 = await signup("leaver@example.com", "Leaver again");
  assert.deepEqual((await call("GET", "/wasl/invoices", t2)).body, []);
  assert.deepEqual((await call("GET", "/circles", t2)).body, []);
  assert.deepEqual((await call("GET", "/shield/pairs", t2)).body, []);
  assert.equal((await call("GET", `/circles/${c.id}`, t2)).status, 404);
});
