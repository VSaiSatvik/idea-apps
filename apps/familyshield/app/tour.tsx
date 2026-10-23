import { router } from "expo-router";
import { useState } from "react";
import { Engine, type Decision } from "../src/lib/engine";
import type { Ev } from "../src/lib/events";
import { Button, Card, H2, P, Pill, Screen, Small } from "../src/ui/kit";

/** Scripted scenarios run through the same engine the Android service uses (for iPhone users, reviewers and families deciding). */
const SCENARIOS: { key: string; title: string; events: Ev[] }[] = [
  { key: "rider", title: "Swiggy order out for delivery; rider calls and she pays by UPI during the call", events: [
    { t: 0, kind: "delivery_notice", app: "swiggy" },
    { t: 20, kind: "call_start", callId: "rd", channel: "phone", known: false, international: false, flagged: false, number: "+91 98xxxx1234" },
    { t: 22, kind: "app_open", cat: "upi" }, { t: 23, kind: "call_end", callId: "rd" }] },
  { key: "upi", title: "Fake 'refund' caller keeps her on the line and asks her to open UPI", events: [
    { t: 0, kind: "call_start", callId: "s1", channel: "phone", known: false, international: false, flagged: false, number: "+91 7012345678" },
    { t: 7, kind: "app_open", cat: "upi" }] },
  { key: "remote", title: "'Bank KYC' caller asks him to install AnyDesk", events: [
    { t: 0, kind: "call_start", callId: "r1", channel: "phone", known: false, international: true, flagged: false, number: "+44 7700 900123" },
    { t: 4, kind: "app_install", cat: "remote" }] },
  { key: "arrest", title: "'CBI officer' on a WhatsApp video call for an hour, then the bank app opens", events: [
    { t: 0, kind: "call_start", callId: "w1", channel: "whatsapp", known: false, international: false, flagged: false },
    { t: 55, kind: "app_open", cat: "bank" }] },
];

export default function Demo() {
  const [out, setOut] = useState<Record<string, Decision | "none">>({});
  const run = (key: string) => {
    const s = SCENARIOS.find((x) => x.key === key)!;
    const eng = new Engine({ otpVisible: false, whatsappCallVisible: () => true });
    let d: Decision | null = null;
    for (const e of s.events) d = eng.push(e) ?? d;
    setOut({ ...out, [key]: d ?? "none" });
    if (d?.tier === "pause") {
      const call = s.events.find((e) => e.kind === "call_start") as Extract<Ev, { kind: "call_start" }> | undefined;
      router.push({ pathname: "/pause", params: { demo: "1", reasons: d.reasons.join("|"), number: call?.number ?? "", medium: call?.channel === "whatsapp" ? "WhatsApp" : "Call" } });
    }
  };
  return (
    <Screen>
      <P muted>Each scenario runs through the same decision engine as the Android app. Normal life (like a delivery) stays quiet; a stranger steering someone into paying gets a pause.</P>
      {SCENARIOS.map((s) => {
        const r = out[s.key];
        return (
          <Card key={s.key}>
            <P>{s.title}</P>
            <Button small title="Play" onPress={() => run(s.key)} />
            {r === "none" ? <Pill text="No pause — normal activity" tone="good" /> : r ? <Small>{r.tier === "pause" ? "Paused" : "Gentle tip"} · {r.reasons.join(", ")}</Small> : null}
          </Card>
        );
      })}
      <H2>Privacy</H2>
      <Small>No call is recorded. Messages aren't read. Nothing about calls or apps leaves the parent's phone; family members only get "may need a call" when the parent taps.</Small>
    </Screen>
  );
}
