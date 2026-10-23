import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { api } from "../../src/lib/api";
import { stateLabel, stateTone, type Me } from "../../src/lib/types";
import { useLoad } from "../../src/lib/useLoad";
import { confirm, notify } from "../../src/ui/confirm";
import { Button, Card, ErrorText, Field, H2, Loading, P, Pill, Row, Screen, Small } from "../../src/ui/kit";

export default function CrawlScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useLoad(() => api<Me>("GET", "/vouch/me"), [id]);
  const [postUrl, setPostUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const crawl = data?.crawls.find((c) => c.id === id);
  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  if (!crawl) return <Screen><P>This crawl isn't available.</P></Screen>;
  const p = crawl.pricing;
  const isCreator = data.creator && crawl.creator?.handle === data.creator.handle;
  const codes = crawl.stops.filter((s) => s.code).map((s) => s.code!).join("  ");

  const confirmSlot = async (venueId: string) => {
    if (!(await confirm("Confirm your slot?", `AED ${p.venueSlotBaseAED} now, then AED ${p.venuePerVisitAED} per verified visit (max ${p.venueVisitCap}) after 14 days. Our payment partner sends the invoice.`, "Confirm"))) return;
    try { await api("POST", `/vouch/crawls/${id}/confirm`, { venueId }); await reload(); }
    catch (e) { notify("Couldn't confirm", (e as Error).message); }
  };

  const goLive = async () => {
    setBusy(true); setErr(null);
    try { await api("POST", `/vouch/crawls/${id}/live`, { postUrl, text: caption }); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Row wrap><Pill text={stateLabel[crawl.state]} tone={stateTone[crawl.state]} /><Small>{crawl.walkKm} km walking route</Small></Row>
      {crawl.creator ? <Small>Creator {crawl.creator.handle} · {crawl.creator.followers.toLocaleString()} followers</Small> : null}
      {crawl.postUrl ? <Small>Post: {crawl.postUrl}</Small> : null}
      <H2>Stops</H2>
      {crawl.stops.map((s, i) => (
        <Card key={s.id}>
          <Row wrap><P>{i + 1}. {s.name}</P>{s.mine ? <Pill text="You" tone="accent" /> : null}</Row>
          <Small>{s.category} · {s.area} · {s.paid ? "slot confirmed" : "slot not confirmed yet"}</Small>
          {s.code ? <Row><Pill text={`Code ${s.code}`} tone="good" /><Button small kind="ghost" title="Copy" onPress={() => { void Clipboard.setStringAsync(s.code!).then(() => notify("Copied")); }} /></Row> : null}
          {s.verifiedVisits !== undefined && crawl.state !== "booking" ? <Small>{s.verifiedVisits} verified {s.verifiedVisits === 1 ? "visit" : "visits"} so far</Small> : null}
          {s.mine && !s.paid && crawl.state === "booking" ? <Button small title="Confirm my slot" onPress={() => { void confirmSlot(s.id); }} /> : null}
          {s.mine && crawl.state === "live" ? (
            <Button small kind="secondary" title="Customer came from the crawl without a code" onPress={() => {
              void api("POST", `/vouch/crawls/${id}/untracked`, { venueId: s.id }).then(() => notify("Noted", "Shown in your results, never charged.")).catch((e: Error) => notify("Couldn't note it", e.message));
            }} />
          ) : null}
        </Card>
      ))}
      {isCreator && crawl.state === "booked" ? (
        <Card>
          <H2>Post the crawl</H2>
          <Small>Show every venue's code in the video or caption: {codes}</Small>
          <Field label="Post link" value={postUrl} onChangeText={setPostUrl} autoCapitalize="none" placeholder="https://www.instagram.com/reel/…" />
          <Field label="Caption (must include every code)" value={caption} onChangeText={setCaption} multiline />
          <ErrorText message={err} />
          <Button title="Mark as posted" onPress={() => { void goLive(); }} busy={busy} />
        </Card>
      ) : null}
    </Screen>
  );
}
