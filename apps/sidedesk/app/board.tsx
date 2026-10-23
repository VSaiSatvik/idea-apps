import { useState } from "react";
import { api } from "../src/lib/api";
import { minToTime, type Task } from "../src/lib/types";
import { useLoad } from "../src/lib/useLoad";
import { notify } from "../src/ui/confirm";
import { Button, Card, Empty, ErrorText, Field, H1, H2, Loading, P, Pill, Row, Screen, Small } from "../src/ui/kit";

type Board = { available: Task[]; mine: Task[]; qa: Task[]; earnedAED: number; shiftsToday: { start: number; end: number }[] };

const nowMin = () => { const d = new Date(); return Math.ceil((d.getHours() * 60 + d.getMinutes()) / 15) * 15; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function BoardScreen() {
  const { data, error, loading, reload } = useLoad(() => api<Board>("GET", `/sidedesk/board?date=${today()}`));
  const [deliver, setDeliver] = useState<Record<string, string>>({});

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) notify(ok); await reload(); } catch (e) { notify("Couldn't do that", (e as Error).message); }
  };

  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  // start after any shift already worked today, so new work never overlaps
  const start = Math.max(nowMin(), ...data.shiftsToday.map((x) => x.end));
  const lateToday = start >= 24 * 60 - 30;
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>AED {data.earnedAED} earned</H1>
      {data.shiftsToday.length ? <Small>Today: {data.shiftsToday.map((s) => `${minToTime(s.start)}–${minToTime(s.end)}`).join(", ")}</Small> : null}

      <H2>Your tasks</H2>
      {!data.mine.length ? <Small>Nothing in progress.</Small> : null}
      {data.mine.map((t) => (
        <Card key={t.id}>
          <Row wrap><Pill text={t.status === "claimed" ? "In progress" : t.status === "qa" ? "Being checked" : "Delivered"} tone="accent" /><Small>{t.workMinutes} min</Small></Row>
          <P>{t.title}</P>
          <P selectable>{t.brief}</P>
          {t.status === "claimed" ? (
            <>
              <Field label="Deliverable (link or text)" value={deliver[t.id] ?? ""} onChangeText={(v) => setDeliver({ ...deliver, [t.id]: v })} multiline />
              <Button small title="Submit" disabled={(deliver[t.id] ?? "").trim().length < 5} onPress={() => { void run(() => api("POST", `/sidedesk/tasks/${t.id}/submit`, { deliverable: deliver[t.id] }), "Submitted — you've been paid for this task's time"); }} />
            </>
          ) : null}
        </Card>
      ))}

      <H2>Available now</H2>
      {!data.available.length ? <Empty title="No tasks right now" body="New tasks appear here as businesses order them. Pull down to refresh." /> : null}
      {data.available.map((t) => (
        <Card key={t.id}>
          <Row wrap><Pill text={`Earn AED ${t.earnAED}`} tone="good" /><Small>{t.workMinutes} min</Small></Row>
          <P>{t.title}</P>
          <Small>{t.brief.slice(0, 120)}{t.brief.length > 120 ? "…" : ""}</Small>
          {lateToday ? <Small>Too late to start today — check back tomorrow.</Small> : (
            <Button small title={`Start at ${minToTime(start)}`} onPress={() => { void run(() => api("POST", `/sidedesk/tasks/${t.id}/claim`, { date: today(), start })); }} />
          )}
        </Card>
      ))}

      {data.qa.length ? <H2>Quality checks (15 min, paid)</H2> : null}
      {data.qa.map((t) => (
        <Card key={t.id}>
          <P>{t.title}</P>
          <Small>Check the deliverable against the brief.</Small>
          <P selectable>{t.deliverable}</P>
          <Row>
            <Button small title="Passes" onPress={() => { void run(() => api("POST", `/sidedesk/tasks/${t.id}/qa`, { date: today(), start, pass: true })); }} />
            <Button small kind="secondary" title="Needs rework" onPress={() => { void run(() => api("POST", `/sidedesk/tasks/${t.id}/qa`, { date: today(), start, pass: false })); }} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
