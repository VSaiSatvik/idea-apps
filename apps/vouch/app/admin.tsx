import { router } from "expo-router";
import { useState } from "react";
import { api } from "../src/lib/api";
import { stateLabel, type CreatorView, type Me } from "../src/lib/types";
import { useLoad } from "../src/lib/useLoad";
import { notify } from "../src/ui/confirm";
import { Button, Card, Choice, ErrorText, H2, Loading, P, Pill, Row, Screen, Small } from "../src/ui/kit";

type Plan = { crawls: { venueIds: string[]; stops: string[]; walkKm: number }[]; unplaced: string[] };

export default function Admin() {
  const { data, error, loading, reload } = useLoad(async () => {
    const [plan, creators, me] = await Promise.all([api<Plan>("GET", "/vouch/admin/plan"), api<CreatorView[]>("GET", "/vouch/admin/creators"), api<Me>("GET", "/vouch/me")]);
    return { plan, creators, me };
  });
  const [assign, setAssign] = useState<Record<string, string>>({});

  const run = async (fn: () => Promise<unknown>, done: string) => {
    try { await fn(); notify(done); await reload(); } catch (e) { notify("Couldn't do that", (e as Error).message); }
  };

  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  const verified = data.creators.filter((c) => c.permit.ok);
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H2>Suggested crawls</H2>
      {!data.plan.crawls.length ? <Small>No new crawls possible: not enough free neighbouring venues.</Small> : null}
      {data.plan.crawls.map((c) => (
        <Card key={c.venueIds.join()}>
          <P>{c.stops.join(" → ")}</P>
          <Small>{c.walkKm} km walk</Small>
          <Button small title="Create this crawl" onPress={() => { void run(() => api("POST", "/vouch/admin/crawls", { venueIds: c.venueIds }), "Crawl created — venues can now confirm"); }} />
        </Card>
      ))}
      {data.plan.unplaced.length ? <Small>Not placed yet: {data.plan.unplaced.join(", ")}</Small> : null}

      <H2>Creators</H2>
      {data.creators.map((c) => (
        <Card key={c.id}>
          <Row wrap><P>{c.handle}</P><Pill text={c.permit.ok ? "Verified" : "Unverified"} tone={c.permit.ok ? "good" : "warn"} /></Row>
          <Small>{c.followers.toLocaleString()} followers · permit {c.permitNumber ?? "none"} · {c.permit.reason}</Small>
          {c.permitNumber && !c.permit.ok ? <Button small kind="secondary" title="I checked the permit on their profile" onPress={() => { void run(() => api("POST", `/vouch/admin/creators/${c.id}/verify-permit`, { evidence: "checked on profile in app" }), "Permit marked as checked"); }} /> : null}
        </Card>
      ))}

      <H2>Crawls</H2>
      {data.me.crawls.map((c) => (
        <Card key={c.id} onPress={() => router.push(`/crawl/${c.id}`)}>
          <Pill text={stateLabel[c.state]} />
          <P>{c.stops.map((s) => s.name).join(" → ")}</P>
          {c.state === "booking" && c.stops.every((s) => s.paid) && verified.length ? (
            <>
              <Choice label="Book a verified creator" options={verified.map((v) => ({ value: v.id, label: v.handle }))} value={assign[c.id] ?? null} onChange={(v) => setAssign({ ...assign, [c.id]: v })} />
              <Button small title="Book creator" disabled={!assign[c.id]} onPress={() => { void run(() => api("POST", `/vouch/admin/crawls/${c.id}/assign`, { creatorId: assign[c.id] }), "Creator booked"); }} />
            </>
          ) : null}
          {c.state === "booking" && !c.stops.every((s) => s.paid) ? <Small>Waiting for {c.stops.filter((s) => !s.paid).length} venue(s) to confirm</Small> : null}
          {c.state === "live" ? <Button small kind="secondary" title="Settle (day 14)" onPress={() => { void run(() => api("POST", `/vouch/admin/crawls/${c.id}/settle`), "Settled — venues can see their results"); }} /> : null}
        </Card>
      ))}
    </Screen>
  );
}
