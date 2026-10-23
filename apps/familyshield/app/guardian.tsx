import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { api } from "../src/lib/api";
import { registerForPush } from "../src/lib/push";
import { Button, Card, ErrorText, Field, H2, P, Pill, Row, Screen, Small } from "../src/ui/kit";

type Pair = { id: string; parentName: string; role: "parent" | "guardian"; guardians: { name: string; notifications: boolean }[] };

export default function Guardian() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => { void api<Pair[]>("GET", "/shield/pairs").then((p) => setPairs(p.filter((x) => x.role === "guardian"))).catch(() => {}); }, []);
  useFocusEffect(load);

  const join = async () => {
    setBusy(true); setErr(null);
    try {
      const push = await registerForPush();
      setNote(push.token ? null : push.reason ?? null);
      await api("POST", "/shield/pairs/join", { code, pushToken: push.token ?? undefined });
      setCode("");
      load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const enablePush = async (pairId: string) => {
    const push = await registerForPush();
    if (!push.token) { setNote(push.reason ?? "Couldn't turn on notifications."); return; }
    await api("POST", `/shield/pairs/${pairId}/push-token`, { pushToken: push.token });
    load();
  };

  return (
    <Screen>
      <P muted>You'll get a notification only when your parent taps "Let my family know" on their pause screen. You never see their calls, messages or apps.</P>
      {pairs.map((p) => (
        <Card key={p.id}>
          <Row wrap><P>{p.parentName}</P><Pill text="Linked" tone="good" /></Row>
          <Small>Family members linked: {p.guardians.map((g) => `${g.name}${g.notifications ? "" : " (notifications off)"}`).join(", ")}</Small>
          <Button small kind="secondary" title="Turn on notifications on this phone" onPress={() => { void enablePush(p.id); }} />
        </Card>
      ))}
      <H2>{pairs.length ? "Link another parent" : "Link to your parent's phone"}</H2>
      <Field label="6-digit code from their phone" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
      <ErrorText message={err} />
      {note ? <Small>{note}</Small> : null}
      <Button title="Link" onPress={() => { void join(); }} busy={busy} disabled={code.length !== 6} />
    </Screen>
  );
}
