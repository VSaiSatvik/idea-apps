/**
 * AskOnce Circles — groups (study groups, families, small teams) where each
 * member connects their own AI (Claude, ChatGPT, Gemini…) on their phone.
 * The server never sees API keys: phones call the AI providers directly and
 * only answers a member chooses to share are uploaded here.
 *
 * The server keeps the circle's answer library, groups the same question
 * across members, flags disagreements between answers, lets members pin the
 * checked answer, and provides report/block (needed for user-generated content).
 */
import { randomBytes } from "node:crypto";
import express from "express";
import { HttpError, onAccountDeleted, requireUser, userById } from "../lib/auth.js";
import { persisted } from "../lib/persist.js";
import { facts, isPersonal, sameQuestion, slots } from "./match.js";

export interface Circle {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  members: string[];
  blocks: Record<string, string[]>; // userId -> userIds they blocked
  createdAt: string;
}

export interface Entry {
  id: string;
  circleId: string;
  authorId: string;
  question: string;
  answer: string;
  provider: string;
  model: string;
  slots: string[];
  facts: string[];
  createdAt: string;
  reports: { by: string; reason: string; at: string }[];
  hidden: boolean;
}

class CirclesDb {
  circles = new Map<string, Circle>();
  entries = new Map<string, Entry>();
  pins = new Map<string, string>(); // `${circleId}|${topicKey}` -> entryId
  demoUse = new Map<string, number>(); // `${userId}|${date}` -> count
}

const db = persisted("circles", () => new CirclesDb());
const id = (p: string) => `${p}_${randomBytes(5).toString("hex")}`;
const code = () => [...randomBytes(6)].map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
const REPORTS_TO_HIDE = 2;

onAccountDeleted((uid) => {
  for (const e of [...db.value.entries.values()]) if (e.authorId === uid) db.value.entries.delete(e.id);
  for (const c of [...db.value.circles.values()]) {
    c.members = c.members.filter((m) => m !== uid);
    delete c.blocks[uid];
    if (!c.members.length) db.value.circles.delete(c.id);
    else if (c.ownerId === uid) c.ownerId = c.members[0];
  }
  db.save();
});

function circleFor(req: express.Request) {
  const c = db.value.circles.get(String(req.params.id));
  if (!c || !c.members.includes(req.user!.id)) throw new HttpError(404, "Circle not found");
  return c;
}

const visible = (c: Circle, viewer: string) => (e: Entry) => e.circleId === c.id && !e.hidden && !(c.blocks[viewer] ?? []).includes(e.authorId);

/** Group a circle's entries into topics (same question), newest first, with disagreement flags. */
export function topicsFor(c: Circle, viewer: string) {
  const entries = [...db.value.entries.values()].filter(visible(c, viewer)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const topics: { key: string; question: string; entries: Entry[] }[] = [];
  for (const e of entries) {
    const t = topics.find((t) => sameQuestion(t.question, e.question).same);
    if (t) t.entries.push(e);
    else topics.push({ key: e.id, question: e.question, entries: [e] });
  }
  return topics
    .map((t) => {
      const variants = [...new Set(t.entries.filter((e) => e.facts.length).map((e) => e.facts.join(", ")))];
      const pinnedId = db.value.pins.get(`${c.id}|${t.key}`);
      return {
        key: t.key,
        question: t.question,
        disagreement: variants.length > 1 ? { variants, note: "Members' AIs gave different facts. Check a source and pin the right answer." } : null,
        pinned: pinnedId ? t.entries.find((e) => e.id === pinnedId) ?? null : null,
        answers: t.entries.map((e) => ({ ...e, authorName: userById(e.authorId)?.name ?? "Former member", reports: undefined, mine: e.authorId === viewer })),
        updatedAt: t.entries.at(-1)!.createdAt,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function circlesRouter() {
  const r = express.Router();
  r.use(requireUser);

  r.get("/", (req, res) => {
    const mine = [...db.value.circles.values()].filter((c) => c.members.includes(req.user!.id));
    res.json(mine.map((c) => ({ id: c.id, name: c.name, inviteCode: c.inviteCode, members: c.members.length, owner: c.ownerId === req.user!.id,
      answers: [...db.value.entries.values()].filter((e) => e.circleId === c.id && !e.hidden).length })));
  });

  r.post("/", (req, res) => {
    const name = String(req.body.name ?? "").trim();
    if (name.length < 2 || name.length > 60) throw new HttpError(400, "Name the circle (2–60 characters)");
    const c: Circle = { id: id("c"), name, inviteCode: code(), ownerId: req.user!.id, members: [req.user!.id], blocks: {}, createdAt: new Date().toISOString() };
    db.value.circles.set(c.id, c);
    db.save();
    res.status(201).json(c);
  });

  r.post("/join", (req, res) => {
    const c = [...db.value.circles.values()].find((x) => x.inviteCode === String(req.body.code ?? "").trim().toUpperCase());
    if (!c) throw new HttpError(404, "No circle with that invite code");
    if (c.members.length >= 50) throw new HttpError(400, "This circle is full (50 members)");
    if (!c.members.includes(req.user!.id)) c.members.push(req.user!.id);
    db.save();
    res.json({ id: c.id, name: c.name });
  });

  r.post("/:id/leave", (req, res) => {
    const c = circleFor(req);
    c.members = c.members.filter((m) => m !== req.user!.id);
    if (!c.members.length) db.value.circles.delete(c.id);
    else if (c.ownerId === req.user!.id) c.ownerId = c.members[0];
    db.save();
    res.json({ left: true });
  });

  r.get("/:id", (req, res) => {
    const c = circleFor(req);
    res.json({ id: c.id, name: c.name, inviteCode: c.inviteCode, owner: c.ownerId === req.user!.id,
      members: c.members.map((m) => ({ id: m, name: userById(m)?.name ?? "Member", blocked: (c.blocks[req.user!.id] ?? []).includes(m), me: m === req.user!.id })),
      topics: topicsFor(c, req.user!.id) });
  });

  /** Before asking an AI: has someone in the circle already got an answer? */
  r.post("/:id/search", (req, res) => {
    const c = circleFor(req);
    const q = String(req.body.question ?? "").trim();
    if (isPersonal(q)) return res.json({ personal: true, matches: [] });
    const matches = topicsFor(c, req.user!.id)
      .map((t) => ({ t, ...sameQuestion(t.question, q) }))
      .filter((x) => x.same)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 3)
      .map((x) => ({ ...x.t, similarity: Math.round(x.sim * 100) / 100 }));
    res.json({ personal: false, matches });
  });

  r.post("/:id/share", (req, res) => {
    const c = circleFor(req);
    const question = String(req.body.question ?? "").trim();
    const answer = String(req.body.answer ?? "").trim();
    if (!question || !answer) throw new HttpError(400, "Question and answer are required");
    if (isPersonal(question)) throw new HttpError(400, "Personal questions (your own email, calendar, grades…) can't be shared — the right answer is different for everyone.");
    if (answer.length > 20000) throw new HttpError(400, "Answer too long to share (20,000 characters max)");
    const e: Entry = { id: id("e"), circleId: c.id, authorId: req.user!.id, question, answer, provider: String(req.body.provider ?? "other"), model: String(req.body.model ?? ""),
      slots: slots(question), facts: facts(answer), createdAt: new Date().toISOString(), reports: [], hidden: false };
    db.value.entries.set(e.id, e);
    db.save();
    res.status(201).json(e);
  });

  r.delete("/:id/entries/:eid", (req, res) => {
    const c = circleFor(req);
    const e = db.value.entries.get(String(req.params.eid));
    if (!e || e.circleId !== c.id) throw new HttpError(404, "Not found");
    if (e.authorId !== req.user!.id && c.ownerId !== req.user!.id) throw new HttpError(403, "Only the author or circle owner can remove this");
    db.value.entries.delete(e.id);
    db.save();
    res.json({ deleted: true });
  });

  r.post("/:id/entries/:eid/report", (req, res) => {
    const c = circleFor(req);
    const e = db.value.entries.get(String(req.params.eid));
    if (!e || e.circleId !== c.id) throw new HttpError(404, "Not found");
    if (!e.reports.some((x) => x.by === req.user!.id)) e.reports.push({ by: req.user!.id, reason: String(req.body.reason ?? "inappropriate").slice(0, 200), at: new Date().toISOString() });
    if (e.reports.length >= REPORTS_TO_HIDE || c.ownerId === req.user!.id) e.hidden = true;
    db.save();
    console.log(`[moderation] entry ${e.id} reported (${e.reports.length})`);
    res.json({ reported: true, hidden: e.hidden });
  });

  r.post("/:id/block", (req, res) => {
    const c = circleFor(req);
    const target = String(req.body.userId ?? "");
    if (!c.members.includes(target) || target === req.user!.id) throw new HttpError(400, "Can't block that member");
    const list = (c.blocks[req.user!.id] ??= []);
    if (req.body.unblock) c.blocks[req.user!.id] = list.filter((x) => x !== target);
    else if (!list.includes(target)) list.push(target);
    db.save();
    res.json({ blocked: !req.body.unblock });
  });

  r.post("/:id/pin", (req, res) => {
    const c = circleFor(req);
    const t = topicsFor(c, req.user!.id).find((x) => x.key === String(req.body.topicKey));
    if (!t) throw new HttpError(404, "Topic not found");
    const e = t.answers.find((a) => a.id === String(req.body.entryId));
    if (!e) throw new HttpError(404, "Answer not in this topic");
    db.value.pins.set(`${c.id}|${t.key}`, e.id);
    db.save();
    res.json({ pinned: e.id });
  });

  /**
   * Demo answers so people without an API key (and app reviewers) can try the app.
   * Uses the server's own key if DEMO_ANTHROPIC_KEY is set; otherwise returns a canned reply.
   */
  r.post("/demo-answer", async (req, res) => {
    const q = String(req.body.question ?? "").trim().slice(0, 1000);
    const day = new Date().toISOString().slice(0, 10);
    const k = `${req.user!.id}|${day}`;
    const used = db.value.demoUse.get(k) ?? 0;
    if (used >= Number(process.env.DEMO_DAILY_LIMIT ?? 15)) throw new HttpError(429, "Demo limit reached for today. Connect your own AI in Settings to keep asking.");
    db.value.demoUse.set(k, used + 1);
    db.save();
    const key = process.env.DEMO_ANTHROPIC_KEY;
    if (!key) return res.json({ provider: "demo", model: "demo", answer: `Demo mode: this is where your AI's answer to "${q}" would appear. Connect Claude, ChatGPT or Gemini in Settings to get real answers.` });
    const r2 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.DEMO_MODEL ?? "claude-haiku-5-5", max_tokens: 600, messages: [{ role: "user", content: q }] }),
    });
    const j: any = await r2.json();
    if (!r2.ok) throw new HttpError(502, j?.error?.message ?? "Demo AI unavailable");
    res.json({ provider: "demo", model: j.model, answer: (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n") });
  });

  return r;
}

export function resetCirclesForTests() {
  db.value.circles.clear();
  db.value.entries.clear();
  db.value.pins.clear();
  db.value.demoUse.clear();
}
