/**
 * Synthetic phone-event streams for elderly parents in India.
 * Shared by poc-v1 and build-v2 so both are judged on identical data.
 *
 * Every rate below is an ASSUMPTION (no public dataset of elderly users' phone
 * events exists). The point is the SHAPE of legitimate traffic: in India, calls
 * from unknown numbers are routinely followed by an OTP (delivery OTPs given to
 * the delivery agent) or a UPI payment (cash-on-delivery, shops) — the same
 * pattern a scam produces.
 */

export type AppCat = "bank" | "upi" | "remote" | "other";
export type Channel = "phone" | "whatsapp";

export type DeliveryApp = "amazon" | "flipkart" | "swiggy" | "zomato" | "blinkit";

export type Ev =
  | { t: number; kind: "call_start"; callId: string; channel: Channel; known: boolean; international: boolean; flagged: boolean; number?: string }
  | { t: number; kind: "delivery_notice"; app: DeliveryApp } // "out for delivery" / "rider on the way" notification
  | { t: number; kind: "call_end"; callId: string }
  | { t: number; kind: "sms"; otp: boolean }
  | { t: number; kind: "app_open"; cat: AppCat }
  | { t: number; kind: "app_install"; cat: AppCat };

export interface Scam {
  id: string;
  parent: number;
  type: "otp_theft" | "upi_payment" | "remote_access" | "digital_arrest";
  channel: Channel;
  start: number;
  harmAt: number; // minute when money/OTP is lost if nobody intervenes
}

export const RATES = {
  unknownCallsPerDay: 1.2,
  callMix: { delivery: 0.45, spam: 0.35, genuineBank: 0.1, relativeNewNumber: 0.1 },
  deliveryNoticeBefore: 0.85, // delivery app shows "out for delivery" before the rider calls
  backgroundDeliveryNoticesPerDay: 0.15, // deliveries with no rider call
  deliveryOtpAfter: 0.6, // delivery OTP SMS shortly after the agent's call
  deliveryUpiAfter: 0.3, // pays cash-on-delivery by UPI
  bankCallAppAfter: 0.3,
  bankCallOtpAfter: 0.2,
  backgroundUpiPerDay: 1.0,
  backgroundOtpPerDay: 0.3,
  knownCallsPerDay: 3,
  engagedScamsPerParentPerDay: 0.008, // ~3 a year reach the action stage
  scamMix: { otp_theft: 0.4, upi_payment: 0.3, remote_access: 0.15, digital_arrest: 0.15 },
  whatsappShare: { otp_theft: 0.2, upi_payment: 0.3, remote_access: 0.3, digital_arrest: 0.6 },
  scamCallerFlaggedByReputation: 0.35, // number already reported (Truecaller-style)
};

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function poisson(r: () => number, lambda: number) {
  let k = 0, p = 1;
  const L = Math.exp(-lambda);
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}

const pickW = <K extends string>(r: () => number, w: Record<K, number>): K => {
  let x = r();
  for (const [k, v] of Object.entries(w) as [K, number][]) { if ((x -= v) < 0) return k; }
  return Object.keys(w)[0] as K;
};

/** Generate one parent's event stream over `days` (minutes since start). */
export function parentStream(parent: number, days: number, r: () => number) {
  const r2 = rng(parent * 7919 + 13); // draws for delivery notices only (keeps the original stream identical)
  const apps: DeliveryApp[] = ["amazon", "flipkart", "swiggy", "zomato", "blinkit"];
  const evs: Ev[] = [];
  const scams: Scam[] = [];
  let n = 0;
  const call = (t: number, dur: number, o: Partial<Extract<Ev, { kind: "call_start" }>> = {}) => {
    const callId = `p${parent}c${n++}`;
    evs.push({ t, kind: "call_start", callId, channel: "phone", known: false, international: false, flagged: false,
      number: `+91 9${String((parent * 100003 + n * 7907) % 1e9).padStart(9, "0")}`, ...o });
    evs.push({ t: t + dur, kind: "call_end", callId });
    return callId;
  };
  for (let d = 0; d < days; d++) {
    const day = d * 1440;
    const awake = () => day + 8 * 60 + r() * 13 * 60; // 08:00–21:00
    for (let i = 0; i < poisson(r, RATES.knownCallsPerDay); i++) call(awake(), 1 + r() * 10, { known: true });
    for (let i = 0; i < poisson(r, RATES.unknownCallsPerDay); i++) {
      const t = awake();
      const kind = pickW(r, RATES.callMix);
      if (kind === "delivery") {
        const dur = 0.3 + r() * 1.2; // 20–90 s
        if (r2() < RATES.deliveryNoticeBefore) evs.push({ t: t - (5 + r2() * 55), kind: "delivery_notice", app: apps[Math.floor(r2() * apps.length)] });
        call(t, dur);
        if (r() < RATES.deliveryOtpAfter) evs.push({ t: t + dur + r() * 20, kind: "sms", otp: true });
        if (r() < RATES.deliveryUpiAfter) evs.push({ t: t + dur + r() * 10, kind: "app_open", cat: "upi" });
      } else if (kind === "spam") {
        call(t, 0.1 + r() * 0.9, { flagged: r() < 0.5 });
      } else if (kind === "genuineBank") {
        const dur = 2 + r() * 6;
        call(t, dur);
        if (r() < RATES.bankCallAppAfter) evs.push({ t: t + r() * dur, kind: "app_open", cat: "bank" });
        if (r() < RATES.bankCallOtpAfter) evs.push({ t: t + r() * dur, kind: "sms", otp: true });
      } else {
        call(t, 3 + r() * 17);
      }
    }
    for (let i = 0; i < poisson(r, RATES.backgroundUpiPerDay); i++) evs.push({ t: awake(), kind: "app_open", cat: "upi" });
    for (let i = 0; i < poisson(r, RATES.backgroundOtpPerDay); i++) evs.push({ t: awake(), kind: "sms", otp: true });
    for (let i = 0; i < poisson(r, 4); i++) evs.push({ t: awake(), kind: "app_open", cat: "other" });
    if (r2() < RATES.backgroundDeliveryNoticesPerDay) evs.push({ t: day + 8 * 60 + r2() * 13 * 60, kind: "delivery_notice", app: apps[Math.floor(r2() * apps.length)] });

    if (r() < RATES.engagedScamsPerParentPerDay) {
      const type = pickW(r, RATES.scamMix);
      const channel: Channel = r() < RATES.whatsappShare[type] ? "whatsapp" : "phone";
      const t = awake();
      const o = { channel, international: r() < 0.25, flagged: channel === "phone" && r() < RATES.scamCallerFlaggedByReputation };
      let harmAt: number;
      if (type === "otp_theft") {
        const dur = 4 + r() * 11;
        call(t, dur, o);
        harmAt = t + 2 + r() * (dur - 2);
        evs.push({ t: harmAt - 0.5, kind: "sms", otp: true }); // OTP arrives, read out 30 s later
      } else if (type === "upi_payment") {
        const dur = 5 + r() * 15;
        call(t, dur, o);
        const open = t + 3 + r() * (dur - 3);
        evs.push({ t: open, kind: "app_open", cat: "upi" });
        harmAt = open + 1.5;
      } else if (type === "remote_access") {
        const dur = 10 + r() * 30;
        call(t, dur, o);
        const inst = t + 3 + r() * 5;
        evs.push({ t: inst, kind: "app_install", cat: "remote" });
        evs.push({ t: inst + 1, kind: "app_open", cat: "remote" });
        evs.push({ t: inst + 4, kind: "app_open", cat: "bank" });
        harmAt = inst + 6;
      } else {
        const dur = 30 + r() * 150;
        call(t, dur, o);
        const open = t + 20 + r() * (dur - 25);
        evs.push({ t: open, kind: "app_open", cat: "bank" });
        harmAt = open + 3;
      }
      scams.push({ id: `p${parent}s${scams.length}`, parent, type, channel, start: t, harmAt });
    }
  }
  evs.sort((a, b) => a.t - b.t);
  return { evs, scams };
}

export function population(parents = 1000, days = 90, seed = 21) {
  const r = rng(seed);
  return Array.from({ length: parents }, (_, p) => ({ parent: p, ...parentStream(p, days, r), androidOtpVisible: r() < 0.5 }));
}
