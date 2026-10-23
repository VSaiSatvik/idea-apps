import { router } from "expo-router";
import { useState } from "react";
import { api } from "../src/lib/api";
import type { Menu, Task } from "../src/lib/types";
import { useLoad } from "../src/lib/useLoad";
import { Button, Card, ErrorText, Field, Loading, P, Pill, Row, Screen, Small } from "../src/ui/kit";
import { useTheme } from "../src/ui/theme";

export default function NewOrder() {
  const t = useTheme();
  const { data } = useLoad(() => api<Menu>("GET", "/sidedesk/menu"));
  const [type, setType] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [biz, setBiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const order = async () => {
    setBusy(true); setErr(null);
    try {
      const o = await api<Task>("POST", "/sidedesk/tasks", { type, brief, businessName: biz || undefined });
      router.replace(`/order/${o.id}`);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!data) return <Screen><Loading /></Screen>;
  return (
    <Screen>
      <P muted>Pick a task. Prices are fixed; you approve the result, or we refund it.</P>
      {Object.entries(data.menu).map(([k, m]) => (
        <Card key={k} onPress={() => setType(k)} style={type === k ? { borderColor: t.accent, borderWidth: 2 } : undefined}>
          <Row wrap><P>{m.title}</P>{type === k ? <Pill text="Selected" tone="accent" /> : null}</Row>
          <Small>AED {m.priceAED}{m.aiDraft ? " · AI drafts, a student checks and finishes" : ""}</Small>
        </Card>
      ))}
      <Field label="Your business name" value={biz} onChangeText={setBiz} />
      <Field label="Brief" value={brief} onChangeText={setBrief} multiline
        hint="What exactly should be done, and links to the files (Google Drive, Dropbox…). Don't include customers' personal data or passwords." />
      <ErrorText message={err} />
      <Button title={type ? `Order for AED ${data.menu[type].priceAED}` : "Pick a task"} onPress={() => { void order(); }} busy={busy} disabled={!type || brief.trim().length < 10} />
      <Small>You'll receive a payment link from our payment partner. Work starts once it's paid.</Small>
    </Screen>
  );
}
