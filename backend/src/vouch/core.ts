/**
 * Vouch Crawls core: crawl planner, creator roster with permit records,
 * held-payment ledger (provider mocked), per-venue codes, till verification,
 * settlement and reports. In-memory store; pure logic for testing.
 */
import { randomBytes } from "node:crypto";

export type Category = "coffee" | "brunch" | "bakery" | "dessert" | "juice" | "burger" | "asian" | "arabic" | "pizza";

export interface Venue {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  category: Category;
  opens: number; // hour, 24h
  closes: number;
}

export interface Creator {
  id: string;
  handle: string;
  followers: number;
  permitNumber?: string;
  permitCheckedOn?: string; // date the permit number was seen on the profile
  permitEvidence?: string; // e.g. screenshot reference
}

export const PRICING = {
  venueSlotBaseAED: 350,
  venuePerVisitAED: 12,
  venueVisitCap: 60, // max billable visits per venue per crawl
  creatorBaseAED: 1000,
  creatorPerVisitAED: 6,
};

// ---------------------------------------------------------------- geo
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------- planner
/**
 * Greedy planner: seeds from the venue with most neighbours, adds the nearest
 * venue that (a) is within maxKm of every member, (b) has a new category,
 * (c) shares at least `minOverlapHours` of opening time with all members.
 * Returns crawls of size >= minSize; leftovers are reported.
 */
export function planCrawls(venues: Venue[], opts = { maxKm: 1.2, size: 4, minSize: 3, minOverlapHours: 3 }) {
  const free = new Set(venues.map((v) => v.id));
  const byId = new Map(venues.map((v) => [v.id, v]));
  const compatible = (group: Venue[], v: Venue) =>
    group.every((g) => km(g, v) <= opts.maxKm && g.category !== v.category) &&
    Math.min(...group.map((g) => g.closes), v.closes) - Math.max(...group.map((g) => g.opens), v.opens) >= opts.minOverlapHours;
  const crawls: Venue[][] = [];
  while (true) {
    const pool = [...free].map((id) => byId.get(id)!);
    if (pool.length < opts.minSize) break;
    const seed = pool
      .map((v) => ({ v, n: pool.filter((o) => o !== v && compatible([v], o)).length }))
      .sort((a, b) => b.n - a.n)[0];
    if (!seed || seed.n < opts.minSize - 1) break;
    const group = [seed.v];
    while (group.length < opts.size) {
      const next = pool
        .filter((o) => !group.includes(o) && compatible(group, o))
        .sort((a, b) => km(group[0], a) - km(group[0], b))[0];
      if (!next) break;
      group.push(next);
    }
    if (group.length >= opts.minSize) {
      crawls.push(orderRoute(group));
      group.forEach((g) => free.delete(g.id));
    } else {
      free.delete(seed.v.id); // can't anchor a crawl; leave it out
    }
  }
  return { crawls, unplaced: venues.filter((v) => free.has(v.id) && !crawls.flat().includes(v)) };
}

/** Order stops so the walk is short, starting with coffee/bakery if present. */
export function orderRoute(group: Venue[]): Venue[] {
  const morning: Category[] = ["coffee", "bakery", "juice", "brunch"];
  const rank = (v: Venue) => (morning.includes(v.category) ? morning.indexOf(v.category) : morning.length);
  const start = [...group].sort((a, b) => rank(a) - rank(b))[0];
  const route = [start];
  const rest = group.filter((g) => g !== start);
  while (rest.length) {
    rest.sort((a, b) => km(route.at(-1)!, a) - km(route.at(-1)!, b));
    route.push(rest.shift()!);
  }
  return route;
}

export function walkKm(route: Venue[]) {
  return route.slice(1).reduce((s, v, i) => s + km(route[i], v), 0);
}

// ---------------------------------------------------------------- permits
export function permitStatus(c: Creator, today: string, maxAgeDays = 30) {
  if (!c.permitNumber || !/^[A-Z0-9-]{5,}$/i.test(c.permitNumber)) return { ok: false, reason: "no permit number recorded" };
  if (!c.permitCheckedOn) return { ok: false, reason: "permit never checked" };
  const age = (Date.parse(today) - Date.parse(c.permitCheckedOn)) / 86400000;
  if (age > maxAgeDays) return { ok: false, reason: `permit last checked ${Math.round(age)} days ago; re-check` };
  return { ok: true, reason: `permit ${c.permitNumber} checked on ${c.permitCheckedOn}` };
}

// ---------------------------------------------------------------- ledger (payment provider mocked)
export type Entry = { at: string; who: string; kind: "hold" | "release" | "charge" | "refund"; amountAED: number; memo: string };

export class Ledger {
  entries: Entry[] = [];
  held = new Map<string, number>(); // venueId|crawlId -> held amount
  add(e: Entry) {
    this.entries.push(e);
  }
  balanceOf(who: string) {
    return this.entries.filter((e) => e.who === who).reduce((s, e) => s + (e.kind === "release" || e.kind === "refund" ? e.amountAED : -e.amountAED), 0);
  }
}

// ---------------------------------------------------------------- crawl lifecycle
export type CrawlState = "booking" | "booked" | "live" | "settled" | "cancelled";

export interface Visit {
  at: string;
  venueId: string;
  code?: string;
  phoneLast3?: string;
  untracked: boolean;
}

export interface Crawl {
  id: string;
  venues: Venue[];
  codes: Record<string, string>; // venueId -> code
  paid: Set<string>;
  creatorId?: string;
  postUrl?: string;
  state: CrawlState;
  visits: Visit[];
  liveOn?: string;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeCode(prefix: string) {
  const b = randomBytes(5);
  return `${prefix.replace(/[^A-Z]/gi, "").slice(0, 4).toUpperCase()}-${[...b].map((x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join("")}`;
}

export class Store {
  venues = new Map<string, Venue>();
  creators = new Map<string, Creator>();
  crawls = new Map<string, Crawl>();
  ledger = new Ledger();

  addVenue(v: Omit<Venue, "id">) {
    const id = "v_" + randomBytes(4).toString("hex");
    const venue = { ...v, id };
    this.venues.set(id, venue);
    return venue;
  }
  addCreator(c: Omit<Creator, "id">) {
    const id = "c_" + randomBytes(4).toString("hex");
    const creator = { ...c, id };
    this.creators.set(id, creator);
    return creator;
  }

  createCrawl(venueIds: string[]) {
    const venues = venueIds.map((id) => {
      const v = this.venues.get(id);
      if (!v) throw new Error(`unknown venue ${id}`);
      return v;
    });
    const id = "k_" + randomBytes(4).toString("hex");
    const codes = Object.fromEntries(venues.map((v) => [v.id, makeCode(v.name)]));
    const crawl: Crawl = { id, venues: orderRoute(venues), codes, paid: new Set(), state: "booking", visits: [] };
    this.crawls.set(id, crawl);
    return crawl;
  }

  payBase(crawlId: string, venueId: string, at: string) {
    const c = this.get(crawlId);
    if (c.state !== "booking") throw new Error("crawl not taking bookings");
    if (!c.codes[venueId]) throw new Error("venue not in crawl");
    if (c.paid.has(venueId)) return;
    this.ledger.add({ at, who: venueId, kind: "hold", amountAED: PRICING.venueSlotBaseAED, memo: `base slot ${crawlId}` });
    c.paid.add(venueId);
  }

  assignCreator(crawlId: string, creatorId: string, today: string) {
    const c = this.get(crawlId);
    const cr = this.creators.get(creatorId);
    if (!cr) throw new Error("unknown creator");
    const p = permitStatus(cr, today);
    if (!p.ok) throw new Error(`creator not eligible: ${p.reason}`);
    if (c.paid.size !== c.venues.length) throw new Error("all venues must pay their base slot first");
    c.creatorId = creatorId;
    c.state = "booked";
  }

  /** Post checked against the brief (manual for now): must be a post URL and mention every code. */
  markLive(crawlId: string, postUrl: string, captionOrOnScreenText: string, at: string) {
    const c = this.get(crawlId);
    if (c.state !== "booked") throw new Error("crawl not booked");
    if (!/^https:\/\/(www\.)?(instagram\.com|tiktok\.com)\//.test(postUrl)) throw new Error("not an Instagram or TikTok URL");
    const missing = Object.values(c.codes).filter((code) => !captionOrOnScreenText.includes(code));
    if (missing.length) throw new Error(`post is missing codes: ${missing.join(", ")}`);
    c.postUrl = postUrl;
    c.liveOn = at;
    c.state = "live";
    this.ledger.add({ at, who: c.creatorId!, kind: "release", amountAED: PRICING.creatorBaseAED, memo: `base fee ${crawlId}` });
  }

  /** Till page: staff enter a code and last 3 phone digits. */
  redeem(code: string, phoneLast3: string, at: string) {
    const crawl = [...this.crawls.values()].find((c) => Object.values(c.codes).includes(code.toUpperCase()));
    if (!crawl) return { ok: false, reason: "unknown code" };
    if (crawl.state !== "live") return { ok: false, reason: "crawl is not live" };
    if (!/^\d{3}$/.test(phoneLast3)) return { ok: false, reason: "enter the last 3 digits of the customer's phone" };
    const venueId = Object.entries(crawl.codes).find(([, c]) => c === code.toUpperCase())![0];
    if (crawl.visits.some((v) => v.venueId === venueId && v.phoneLast3 === phoneLast3 && !v.untracked))
      return { ok: false, reason: "already used by this customer at this venue" };
    crawl.visits.push({ at, venueId, code: code.toUpperCase(), phoneLast3, untracked: false });
    return { ok: true, venue: crawl.venues.find((v) => v.id === venueId)!.name };
  }

  /** One tap for customers who mention the crawl but have no code (reported, never billed). */
  logUntracked(crawlId: string, venueId: string, at: string) {
    const c = this.get(crawlId);
    c.visits.push({ at, venueId, untracked: true });
  }

  settle(crawlId: string, at: string) {
    const c = this.get(crawlId);
    if (c.state !== "live") throw new Error("crawl not live");
    const lines = c.venues.map((v) => {
      const verified = c.visits.filter((x) => x.venueId === v.id && !x.untracked).length;
      const untracked = c.visits.filter((x) => x.venueId === v.id && x.untracked).length;
      const billable = Math.min(verified, PRICING.venueVisitCap);
      const perVisit = billable * PRICING.venuePerVisitAED;
      this.ledger.add({ at, who: v.id, kind: "charge", amountAED: perVisit, memo: `${billable} verified visits ${crawlId}` });
      return { venue: v.name, verified, untracked, billable, baseAED: PRICING.venueSlotBaseAED, perVisitAED: perVisit, totalAED: PRICING.venueSlotBaseAED + perVisit,
        costPerVerifiedVisitAED: verified ? Math.round((PRICING.venueSlotBaseAED + perVisit) / verified) : null };
    });
    const totalVerified = lines.reduce((s, l) => s + l.billable, 0);
    const creatorBonus = totalVerified * PRICING.creatorPerVisitAED;
    this.ledger.add({ at, who: c.creatorId!, kind: "release", amountAED: creatorBonus, memo: `visit bonus ${crawlId}` });
    c.state = "settled";
    const venueRevenue = lines.reduce((s, l) => s + l.totalAED, 0);
    const creatorPay = PRICING.creatorBaseAED + creatorBonus;
    return { crawlId, lines, creatorPayAED: creatorPay, vouchGrossAED: venueRevenue - creatorPay };
  }

  get(id: string) {
    const c = this.crawls.get(id);
    if (!c) throw new Error("unknown crawl");
    return c;
  }
}
