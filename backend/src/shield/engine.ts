/**
 * Family Shield v2 risk engine — runs entirely on the parent's phone.
 *
 * Differences from v1's single rule:
 *  - scores the ACTION IN CONTEXT: is the unknown call still going on, how long
 *    has it lasted, is the number international/flagged, is it a WhatsApp call;
 *  - treats "short call then OTP/UPI" (the delivery pattern) as normal;
 *  - never needs OTP text (works with Android 15+/17 redaction);
 *  - tiered response: nothing / quiet banner / full pause with "add my child to this call";
 *  - nothing leaves the phone unless the parent taps (default), so it is not
 *    adult-to-adult monitoring;
 *  - delivery window: when a delivery app shows "out for delivery", a short
 *    unknown call in the next 90 minutes is treated as the rider (founder's idea);
 *  - after a pause, the family can file a pre-filled report to the government's
 *    Chakshu service (suspected fraud) or 1930 (money already lost).
 * Pure TypeScript so it can move into a React Native/Kotlin bridge unchanged.
 */
import type { Ev } from "./events.js";

export type Tier = "none" | "banner" | "pause";

export interface Decision {
  t: number;
  tier: Tier;
  score: number;
  reasons: string[];
  callId?: string;
}

export const WEIGHTS = {
  action: { remote_install: 80, remote_open: 80, bank_open: 35, upi_open: 30, otp_sms: 35 },
  duringUnknownCall: 30,
  elapsedOver3: 20,
  elapsedOver15: 15,
  international: 10,
  flagged: 15,
  whatsappUnknown: 10,
  afterShortCallOnly: -40, // call already ended and lasted < 2 minutes (delivery agent pattern)
  likelyRider: -35, // unknown call started inside an active delivery window and is still short
  deliveryWindowMin: 90,
  riderMaxMin: 5, // a "rider" call that runs longer than this loses the discount
  bannerAt: 50,
  pauseAt: 80,
  cooldownMin: 10,
};

export interface EngineOptions {
  useDeliveryWindow?: boolean; // default true
  otpVisible: boolean; // false on Android 15+ when OTP notifications are redacted
  whatsappCallVisible: (callId: string) => boolean; // ongoing-call notification seen?
}

interface CallState { callId: string; start: number; end?: number; channel: "phone" | "whatsapp"; international: boolean; flagged: boolean; number?: string; inDeliveryWindow: boolean }

export class Engine {
  private calls = new Map<string, CallState>();
  private lastPause = -Infinity;
  private lastBanner = -Infinity;
  private deliveryUntil = -Infinity;
  constructor(private opts: EngineOptions) {}

  callInfo(callId: string) {
    return this.calls.get(callId);
  }

  /** Feed one event; returns a decision when an action is risky enough to act on. */
  push(e: Ev): Decision | null {
    if (e.kind === "delivery_notice") {
      if (this.opts.useDeliveryWindow !== false) this.deliveryUntil = Math.max(this.deliveryUntil, e.t + WEIGHTS.deliveryWindowMin);
      return null;
    }
    if (e.kind === "call_start") {
      if (e.known) return null;
      if (e.channel === "whatsapp" && !this.opts.whatsappCallVisible(e.callId)) return null;
      this.calls.set(e.callId, { callId: e.callId, start: e.t, channel: e.channel, international: e.international, flagged: e.flagged,
        number: e.number, inDeliveryWindow: e.channel === "phone" && e.t <= this.deliveryUntil });
      return null;
    }
    if (e.kind === "call_end") {
      const c = this.calls.get(e.callId);
      if (c) c.end = e.t;
      return null;
    }
    const action =
      e.kind === "app_install" && e.cat === "remote" ? "remote_install" :
      e.kind === "app_open" && e.cat === "remote" ? "remote_open" :
      e.kind === "app_open" && e.cat === "bank" ? "bank_open" :
      e.kind === "app_open" && e.cat === "upi" ? "upi_open" :
      e.kind === "sms" && e.otp && this.opts.otpVisible ? "otp_sms" : null;
    if (!action) return null;

    // the most relevant unknown call: ongoing first, else most recent within 30 min
    const recent = [...this.calls.values()].filter((c) => c.start <= e.t && (c.end === undefined || e.t - c.end <= 30));
    if (!recent.length) return null;
    const ongoing = recent.filter((c) => c.end === undefined || c.end >= e.t);
    const c = (ongoing.length ? ongoing : recent).sort((a, b) => b.start - a.start)[0];
    const reasons = [action.replace("_", " ")];
    let score = WEIGHTS.action[action];
    const isOngoing = c.end === undefined || c.end >= e.t;
    const elapsed = e.t - c.start;
    if (isOngoing) { score += WEIGHTS.duringUnknownCall; reasons.push("during a call from an unknown number"); }
    if (isOngoing && elapsed > 3) { score += WEIGHTS.elapsedOver3; reasons.push(`call has lasted ${Math.round(elapsed)} min`); }
    if (isOngoing && elapsed > 15) score += WEIGHTS.elapsedOver15;
    if (c.international) { score += WEIGHTS.international; reasons.push("international number"); }
    if (c.flagged) { score += WEIGHTS.flagged; reasons.push("number reported as fraud"); }
    if (c.channel === "whatsapp") { score += WEIGHTS.whatsappUnknown; reasons.push("WhatsApp call from an unsaved number"); }
    if (!isOngoing && c.end !== undefined && c.end - c.start < 2) { score += WEIGHTS.afterShortCallOnly; reasons.push("after a short call (delivery pattern)"); }
    const callLength = (c.end ?? e.t) - c.start;
    if (c.inDeliveryWindow && callLength <= WEIGHTS.riderMaxMin && action !== "remote_install" && action !== "remote_open") {
      score += WEIGHTS.likelyRider;
      reasons.push("call came while an order was out for delivery (likely the rider)");
    }

    let tier: Tier = score >= WEIGHTS.pauseAt ? "pause" : score >= WEIGHTS.bannerAt ? "banner" : "none";
    if (tier === "pause" && e.t - this.lastPause < WEIGHTS.cooldownMin) tier = "none";
    if (tier === "banner" && e.t - this.lastBanner < WEIGHTS.cooldownMin) tier = "none";
    if (tier === "pause") this.lastPause = e.t;
    if (tier === "banner") this.lastBanner = e.t;
    return tier === "none" ? null : { t: e.t, tier, score, reasons, callId: c.callId };
  }
}

// ---------------------------------------------------------------- what the parent sees
export const LANG = {
  hi: {
    pauseTitle: "रुकिए।",
    pauseBody: (child: string) => `कोई भी OTP बताने या पैसे भेजने से पहले ${child} से बात करें।`,
    addChild: (child: string) => `${child} को इस कॉल में जोड़ें`,
    callChild: (child: string) => `${child} को कॉल करें`,
    secrecy: "क्या आपसे कहा गया है कि किसी को न बताएं? यह धोखाधड़ी का संकेत है।",
    police: "पुलिस या कोई सरकारी विभाग फोन या वीडियो कॉल पर गिरफ्तार नहीं करता।",
    imOk: "मैं ठीक हूँ, यह कॉल सही है",
    banner: "याद रखें: बैंक कभी भी फोन पर OTP नहीं मांगता।",
  },
  en: {
    pauseTitle: "Stop.",
    pauseBody: (child: string) => `Talk to ${child} before you share any OTP or send any money.`,
    addChild: (child: string) => `Add ${child} to this call`,
    callChild: (child: string) => `Call ${child}`,
    secrecy: "Were you told not to tell anyone? That is a sign of fraud.",
    police: "Police and government departments do not arrest anyone over a phone or video call.",
    imOk: "I'm fine, this call is genuine",
    banner: "Remember: banks never ask for an OTP over the phone.",
  },
};

/** The message sent to the child ONLY if the parent taps (or opted into check-ins at setup). Contains no app names, numbers or OTPs. */
export function checkInMessage(parentName: string, mode: "parent_tapped" | "consented_auto") {
  return mode === "parent_tapped"
    ? `${parentName} tapped "Talk to you" on Family Shield and may need a call now.`
    : `${parentName} may need a call now (Family Shield check-in).`;
}

// ---------------------------------------------------------------- reporting
export type ScamMedium = "Call" | "WhatsApp" | "SMS";

export interface Debrief {
  askedFor: ("OTP" | "money" | "install an app" | "bank details" | "threatened arrest" | "other")[];
  claimedToBe?: string; // e.g. "CBI officer", "bank KYC team"
  moneyLost: boolean;
  amountINR?: number;
}

/**
 * Builds the report the family files themselves. It is never sent automatically:
 * Chakshu (Sanchar Saathi) needs the reporter's own mobile verified by OTP, and a
 * wrong automatic report would hit innocent callers (delivery riders, real banks).
 * No call audio exists to attach: Android apps can't record calls.
 */
export function buildReport(p: { number?: string; at: Date; medium: ScamMedium; debrief: Debrief; reasons: string[] }) {
  const when = p.at.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const asked = p.debrief.askedFor.join(", ") || "not recorded";
  const description =
    `${p.medium} from ${p.number ?? "an unknown number"} on ${when}. ` +
    (p.debrief.claimedToBe ? `Caller claimed to be: ${p.debrief.claimedToBe}. ` : "") +
    `Caller asked for: ${asked}. ` +
    `Family Shield paused the phone because: ${p.reasons.join("; ")}.`;
  if (p.debrief.moneyLost) {
    return {
      route: "1930" as const,
      why: "Money has already been lost: call the national cyber crime helpline 1930 immediately (faster freezing of funds), then file at cybercrime.gov.in.",
      callNumber: "1930",
      portal: "https://cybercrime.gov.in",
      description: description + (p.debrief.amountINR ? ` Amount lost: Rs ${p.debrief.amountINR.toLocaleString("en-IN")}.` : ""),
      fields: { suspectNumber: p.number, dateTime: when, medium: p.medium },
    };
  }
  return {
    route: "chakshu" as const,
    why: "No money lost: report the suspected fraud communication on Chakshu (Sanchar Saathi) so the number can be checked and disconnected.",
    portal: "https://sancharsaathi.gov.in/sfc/",
    description,
    fields: { suspectNumber: p.number, dateTime: when, medium: p.medium, category: categoryFor(p.debrief) },
    needsReporterOtp: true,
  };
}

function categoryFor(d: Debrief) {
  if (d.askedFor.includes("threatened arrest") || /cbi|police|customs|ed|trai|court/i.test(d.claimedToBe ?? "")) return "Impersonation of government official";
  if (d.askedFor.includes("OTP") || d.askedFor.includes("bank details") || /bank|kyc/i.test(d.claimedToBe ?? "")) return "Bank account / KYC related";
  if (d.askedFor.includes("install an app")) return "Remote access / app install";
  return "Other";
}
