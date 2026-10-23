/**
 * Family Shield — the server only does three things, by design:
 *  1. pairs a parent's phone with their children's phones (a 6-digit code),
 *  2. relays "Mom may need a call now" when the PARENT taps (Expo push),
 *  3. builds the pre-filled Chakshu / 1930 report text (also available on-device).
 * Call, app and notification events never leave the parent's phone.
 */
import { randomBytes, randomInt } from "node:crypto";
import express from "express";
import { HttpError, onAccountDeleted, requireUser } from "../lib/auth.js";
import { persisted } from "../lib/persist.js";
import { buildReport, checkInMessage, type Debrief } from "./engine.js";

interface Pair {
  id: string;
  parentUserId: string;
  parentName: string;
  code: string;
  codeExpires: string;
  guardians: { userId: string; name: string; pushToken?: string }[];
  autoCheckInConsent: boolean;
}

class ShieldDb {
  pairs = new Map<string, Pair>();
  sent: { pairId: string; at: string; mode: string; delivered: number }[] = [];
}

const db = persisted("shield", () => new ShieldDb());

onAccountDeleted((uid) => {
  for (const p of [...db.value.pairs.values()]) {
    if (p.parentUserId === uid) db.value.pairs.delete(p.id);
    else p.guardians = p.guardians.filter((g) => g.userId !== uid);
  }
  db.save();
});

export type PushSender = (messages: { to: string; title: string; body: string; data?: object }[]) => Promise<number>;

/** Expo push service (https://docs.expo.dev/push-notifications/sending-notifications/). */
export const expoPush: PushSender = async (messages) => {
  if (!messages.length) return 0;
  const r = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(messages.map((m) => ({ ...m, sound: "default", priority: "high", channelId: "checkin" }))),
  });
  if (!r.ok) throw new HttpError(502, "Push service unavailable");
  const j: any = await r.json();
  return (j.data ?? []).filter((x: any) => x.status === "ok").length;
};

export function shieldRouter(push: PushSender = expoPush) {
  const r = express.Router();
  r.use(requireUser);

  const myPairs = (uid: string) => [...db.value.pairs.values()].filter((p) => p.parentUserId === uid || p.guardians.some((g) => g.userId === uid));
  const view = (p: Pair, uid: string) => ({ id: p.id, parentName: p.parentName, role: p.parentUserId === uid ? "parent" : "guardian",
    code: p.parentUserId === uid ? p.code : undefined, codeExpires: p.parentUserId === uid ? p.codeExpires : undefined,
    guardians: p.guardians.map((g) => ({ name: g.name, notifications: !!g.pushToken })), autoCheckInConsent: p.autoCheckInConsent });

  r.get("/pairs", (req, res) => res.json(myPairs(req.user!.id).map((p) => view(p, req.user!.id))));

  // parent's phone: create or refresh a pairing code
  r.post("/pairs", (req, res) => {
    const name = String(req.body.parentName ?? "").trim() || req.user!.name;
    let p = [...db.value.pairs.values()].find((x) => x.parentUserId === req.user!.id);
    if (!p) {
      p = { id: `p_${randomBytes(5).toString("hex")}`, parentUserId: req.user!.id, parentName: name, code: "", codeExpires: "", guardians: [], autoCheckInConsent: false };
      db.value.pairs.set(p.id, p);
    }
    p.parentName = name;
    p.code = String(randomInt(100000, 999999));
    p.codeExpires = new Date(Date.now() + 24 * 3600e3).toISOString();
    if (typeof req.body.autoCheckInConsent === "boolean") p.autoCheckInConsent = req.body.autoCheckInConsent;
    db.save();
    res.json(view(p, req.user!.id));
  });

  // child's phone: join with the code
  r.post("/pairs/join", (req, res) => {
    const code = String(req.body.code ?? "").trim();
    const p = [...db.value.pairs.values()].find((x) => x.code === code && x.codeExpires > new Date().toISOString());
    if (!p) throw new HttpError(404, "Code not found or expired. Ask your parent's phone for a new code.");
    if (p.parentUserId === req.user!.id) throw new HttpError(400, "That's this phone's own code — enter it on your child's phone");
    const g = p.guardians.find((x) => x.userId === req.user!.id);
    if (g) { g.pushToken = req.body.pushToken || g.pushToken; g.name = req.user!.name; }
    else if (p.guardians.length >= 5) throw new HttpError(400, "Up to 5 family members can be linked");
    else p.guardians.push({ userId: req.user!.id, name: req.user!.name, pushToken: req.body.pushToken || undefined });
    db.save();
    res.json(view(p, req.user!.id));
  });

  r.post("/pairs/:id/push-token", (req, res) => {
    const p = db.value.pairs.get(String(req.params.id));
    const g = p?.guardians.find((x) => x.userId === req.user!.id);
    if (!p || !g) throw new HttpError(404, "Not linked");
    g.pushToken = String(req.body.pushToken ?? "") || undefined;
    db.save();
    res.json({ ok: true });
  });

  r.delete("/pairs/:id/guardians/me", (req, res) => {
    const p = db.value.pairs.get(String(req.params.id));
    if (p) p.guardians = p.guardians.filter((g) => g.userId !== req.user!.id);
    db.save();
    res.json({ ok: true });
  });

  // parent's phone: send "may need a call" — only on a tap, or automatically if the parent consented
  r.post("/checkin", async (req, res) => {
    const p = [...db.value.pairs.values()].find((x) => x.parentUserId === req.user!.id);
    if (!p) throw new HttpError(404, "No family linked yet");
    const mode = req.body.mode === "consented_auto" ? "consented_auto" : "parent_tapped";
    if (mode === "consented_auto" && !p.autoCheckInConsent) throw new HttpError(403, "Automatic check-ins are off");
    const body = checkInMessage(p.parentName, mode);
    const delivered = await push(p.guardians.filter((g) => g.pushToken).map((g) => ({ to: g.pushToken!, title: "Family Shield", body, data: { pairId: p.id, type: "checkin" } })));
    db.value.sent.push({ pairId: p.id, at: new Date().toISOString(), mode, delivered });
    if (db.value.sent.length > 5000) db.value.sent.splice(0, 1000);
    db.save();
    res.json({ sent: body, delivered, guardians: p.guardians.length });
  });

  r.post("/report", (req, res) => {
    const d: Debrief = { askedFor: Array.isArray(req.body.askedFor) ? req.body.askedFor : [], claimedToBe: req.body.claimedToBe, moneyLost: !!req.body.moneyLost, amountINR: req.body.amountINR ? Number(req.body.amountINR) : undefined };
    res.json(buildReport({ number: req.body.number, at: new Date(req.body.at ?? Date.now()), medium: req.body.medium ?? "Call", debrief: d, reasons: Array.isArray(req.body.reasons) ? req.body.reasons : [] }));
  });

  return r;
}
