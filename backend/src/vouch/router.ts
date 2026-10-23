/**
 * Vouch Crawls — wraps vouch/build-v2's engine.
 * Roles: venue owner (registers venues, confirms slots, uses the till, sees results),
 * creator (profile + permit, posts crawls they're booked on), organiser (admin: plans
 * crawls, books creators, settles).
 */
import express from "express";
import { HttpError, isAdmin, onAccountDeleted, requireAdmin, requireUser } from "../lib/auth.js";
import { persisted } from "../lib/persist.js";
import { PRICING, Store, permitStatus, planCrawls, walkKm, type Category, type Crawl } from "./core.js";
import { SEED_VENUES } from "./seed.js";

class VouchDb {
  store = new Store();
  venueOwner = new Map<string, string>(); // venueId -> userId
  creatorUser = new Map<string, string>(); // creatorId -> userId
}

const db = persisted("vouch", () => new VouchDb());
const today = () => new Date().toISOString().slice(0, 10);
const CATEGORIES: Category[] = ["coffee", "brunch", "bakery", "dessert", "juice", "burger", "asian", "arabic", "pizza"];

onAccountDeleted((uid) => {
  for (const [cid, u] of [...db.value.creatorUser]) if (u === uid) { db.value.store.creators.delete(cid); db.value.creatorUser.delete(cid); }
  for (const [vid, u] of [...db.value.venueOwner]) {
    if (u !== uid) continue;
    db.value.venueOwner.delete(vid);
    const inCrawl = [...db.value.store.crawls.values()].some((c) => c.state !== "settled" && c.venues.some((v) => v.id === vid));
    if (!inCrawl) db.value.store.venues.delete(vid); // venues in live crawls stay until settlement, unowned
  }
  db.save();
});

const myVenueIds = (uid: string) => [...db.value.venueOwner].filter(([, u]) => u === uid).map(([v]) => v);
const myCreatorId = (uid: string) => [...db.value.creatorUser].find(([, u]) => u === uid)?.[0];

function crawlView(c: Crawl, uid: string, admin: boolean) {
  const mineV = new Set(myVenueIds(uid));
  const creator = c.creatorId ? db.value.store.creators.get(c.creatorId) : undefined;
  return {
    id: c.id, state: c.state, postUrl: c.postUrl, liveOn: c.liveOn,
    walkKm: Math.round(walkKm(c.venues) * 100) / 100,
    creator: creator ? { handle: creator.handle, followers: creator.followers } : null,
    stops: c.venues.map((v) => ({
      id: v.id, name: v.name, category: v.category, area: v.area, paid: c.paid.has(v.id), mine: mineV.has(v.id),
      code: admin || mineV.has(v.id) || (creator && db.value.creatorUser.get(creator.id) === uid) ? c.codes[v.id] : undefined,
      verifiedVisits: admin || mineV.has(v.id) ? c.visits.filter((x) => x.venueId === v.id && !x.untracked).length : undefined,
    })),
    pricing: PRICING,
  };
}

export function vouchRouter() {
  const r = express.Router();
  r.use(requireUser);

  r.get("/me", (req, res) => {
    const uid = req.user!.id;
    const admin = isAdmin(req.user!);
    const cid = myCreatorId(uid);
    const creator = cid ? db.value.store.creators.get(cid) : undefined;
    const vids = new Set(myVenueIds(uid));
    const crawls = [...db.value.store.crawls.values()].filter((c) => admin || c.venues.some((v) => vids.has(v.id)) || (cid && c.creatorId === cid));
    res.json({
      admin,
      venues: [...vids].map((v) => db.value.store.venues.get(v)).filter(Boolean),
      creator: creator ? { ...creator, permit: permitStatus(creator, today()) } : null,
      crawls: crawls.map((c) => crawlView(c, uid, admin)),
      categories: CATEGORIES,
      pricing: PRICING,
    });
  });

  r.post("/venues", (req, res) => {
    const b = req.body;
    if (!b.name || !b.area || !CATEGORIES.includes(b.category)) throw new HttpError(400, "Name, area and a category are required");
    const lat = Number(b.lat), lng = Number(b.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new HttpError(400, "Set the venue location");
    const opens = Number(b.opens ?? 8), closes = Number(b.closes ?? 22);
    if (!(opens >= 0 && closes <= 24 && closes > opens)) throw new HttpError(400, "Opening hours look wrong");
    const v = db.value.store.addVenue({ name: String(b.name), area: String(b.area), lat, lng, category: b.category, opens, closes });
    db.value.venueOwner.set(v.id, req.user!.id);
    db.save();
    res.status(201).json(v);
  });

  r.put("/creator", (req, res) => {
    const b = req.body;
    const handle = String(b.handle ?? "").trim();
    if (!/^@?[A-Za-z0-9._]{2,30}$/.test(handle)) throw new HttpError(400, "Enter your Instagram or TikTok handle");
    const followers = Number(b.followers);
    if (!(followers > 0)) throw new HttpError(400, "Enter your follower count");
    const fields = { handle: handle.startsWith("@") ? handle : "@" + handle, followers, permitNumber: b.permitNumber ? String(b.permitNumber).trim() : undefined };
    let cid = myCreatorId(req.user!.id);
    if (cid) Object.assign(db.value.store.creators.get(cid)!, fields, fields.permitNumber ? {} : { permitCheckedOn: undefined });
    else {
      cid = db.value.store.addCreator(fields).id;
      db.value.creatorUser.set(cid, req.user!.id);
    }
    db.save();
    const c = db.value.store.creators.get(cid)!;
    res.json({ ...c, permit: permitStatus(c, today()) });
  });

  // venue confirms its slot (payment collected via payment provider — not in this build)
  r.post("/crawls/:id/confirm", (req, res) => {
    const vid = String(req.body.venueId);
    if (!myVenueIds(req.user!.id).includes(vid)) throw new HttpError(403, "Not your venue");
    db.value.store.payBase(String(req.params.id), vid, new Date().toISOString());
    db.save();
    res.json(crawlView(db.value.store.get(String(req.params.id)), req.user!.id, false));
  });

  // creator posts the crawl
  r.post("/crawls/:id/live", (req, res) => {
    const c = db.value.store.get(String(req.params.id));
    const cid = myCreatorId(req.user!.id);
    if (!cid || c.creatorId !== cid) throw new HttpError(403, "You're not booked on this crawl");
    db.value.store.markLive(c.id, String(req.body.postUrl ?? ""), String(req.body.text ?? ""), new Date().toISOString());
    db.save();
    res.json(crawlView(c, req.user!.id, false));
  });

  // till: venue staff (signed in as the venue) check a code
  r.post("/redeem", (req, res) => {
    const code = String(req.body.code ?? "").trim().toUpperCase();
    const crawl = [...db.value.store.crawls.values()].find((c) => Object.values(c.codes).includes(code));
    const vid = crawl && Object.entries(crawl.codes).find(([, c]) => c === code)?.[0];
    if (!crawl || !vid) return res.json({ ok: false, reason: "unknown code" });
    if (!myVenueIds(req.user!.id).includes(vid) && !isAdmin(req.user!)) return res.json({ ok: false, reason: "This code belongs to another venue" });
    const out = db.value.store.redeem(code, String(req.body.phoneLast3 ?? ""), new Date().toISOString());
    db.save();
    res.json(out);
  });

  r.post("/crawls/:id/untracked", (req, res) => {
    const vid = String(req.body.venueId);
    if (!myVenueIds(req.user!.id).includes(vid)) throw new HttpError(403, "Not your venue");
    db.value.store.logUntracked(String(req.params.id), vid, new Date().toISOString());
    db.save();
    res.json({ ok: true });
  });

  // ---------------- organiser (admin)
  r.get("/admin/plan", requireAdmin, (_req, res) => {
    const busy = new Set([...db.value.store.crawls.values()].filter((c) => c.state !== "settled" && c.state !== "cancelled").flatMap((c) => c.venues.map((v) => v.id)));
    const { crawls, unplaced } = planCrawls([...db.value.store.venues.values()].filter((v) => !busy.has(v.id)));
    res.json({ crawls: crawls.map((c) => ({ venueIds: c.map((v) => v.id), stops: c.map((v) => `${v.name} (${v.category})`), walkKm: Math.round(walkKm(c) * 100) / 100 })), unplaced: unplaced.map((v) => v.name) });
  });
  r.post("/admin/crawls", requireAdmin, (req, res) => {
    const c = db.value.store.createCrawl(req.body.venueIds ?? []);
    db.save();
    res.status(201).json(crawlView(c, req.user!.id, true));
  });
  r.get("/admin/creators", requireAdmin, (_req, res) => {
    res.json([...db.value.store.creators.values()].map((c) => ({ ...c, permit: permitStatus(c, today()) })));
  });
  r.post("/admin/creators/:id/verify-permit", requireAdmin, (req, res) => {
    const c = db.value.store.creators.get(String(req.params.id));
    if (!c || !c.permitNumber) throw new HttpError(400, "Creator has no permit number");
    c.permitCheckedOn = today();
    c.permitEvidence = String(req.body.evidence ?? "checked on profile");
    db.save();
    res.json({ ...c, permit: permitStatus(c, today()) });
  });
  r.post("/admin/crawls/:id/assign", requireAdmin, (req, res) => {
    db.value.store.assignCreator(String(req.params.id), String(req.body.creatorId), today());
    db.save();
    res.json(crawlView(db.value.store.get(String(req.params.id)), req.user!.id, true));
  });
  r.post("/admin/crawls/:id/settle", requireAdmin, (req, res) => {
    const out = db.value.store.settle(String(req.params.id), new Date().toISOString());
    db.save();
    res.json(out);
  });

  return r;
}

/** Demo data for reviewers: a live crawl the demo venue and demo creator are part of. */
export function seedVouchDemo(venueUserId: string, creatorUserId: string) {
  if ([...db.value.venueOwner.values()].includes(venueUserId)) return;
  const s = db.value.store;
  const al = SEED_VENUES.filter((v) => v.area === "Al Quoz").map((v) => s.addVenue(v));
  db.value.venueOwner.set(al[0].id, venueUserId);
  const cr = s.addCreator({ handle: "@demo.creator", followers: 14000, permitNumber: "UMC-000000", permitCheckedOn: today() });
  db.value.creatorUser.set(cr.id, creatorUserId);
  const { crawls } = planCrawls(al);
  const crawl = s.createCrawl(crawls[0].map((v) => v.id));
  crawl.venues.forEach((v) => s.payBase(crawl.id, v.id, new Date().toISOString()));
  s.assignCreator(crawl.id, cr.id, today());
  s.markLive(crawl.id, "https://www.instagram.com/reel/demo/", Object.values(crawl.codes).join(" "), new Date().toISOString());
  for (let i = 0; i < 7; i++) s.redeem(crawl.codes[al[0].id], String(300 + i), new Date().toISOString());
  SEED_VENUES.filter((v) => v.area === "JLT").forEach((v) => s.addVenue(v));
  db.save();
}
