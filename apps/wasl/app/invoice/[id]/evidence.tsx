import { useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import { useState } from "react";
import { api } from "../../../src/lib/api";
import type { Admission, Invoice } from "../../../src/lib/types";
import { useLoad } from "../../../src/lib/useLoad";
import { Button, Card, ErrorText, H2, Loading, P, Pill, Row, Screen, Small, Toggle } from "../../../src/ui/kit";

export default function Evidence() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: inv, error, setData } = useLoad(() => api<Invoice>("GET", `/wasl/invoices/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const importChat = async () => {
    setErr(null); setMsg(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ["text/plain", "application/zip", "*/*"], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    if (!/\.txt$/i.test(a.name)) { setErr("Pick the .txt file inside the WhatsApp export (on iPhone, unzip it first in Files)."); return; }
    setBusy(true);
    try {
      const text = Platform.OS === "web" && a.file ? await a.file.text() : await new File(a.uri).text();
      const r = await api<{ found: Admission[]; invoice: Invoice }>("POST", `/wasl/invoices/${id}/whatsapp`, text, { raw: true });
      setData(r.invoice);
      setMsg(r.found.length ? `Found ${r.found.length} message(s) where ${r.invoice.debtor.name} admitted the debt or promised to pay.` : `No admissions found from "${r.invoice.debtor.name}". Check the client name matches how they appear in the chat.`);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const setContract = async (v: boolean) => {
    try { setData(await api<Invoice>("PATCH", `/wasl/invoices/${id}`, { hasSignedContract: v })); }
    catch (e) { setErr((e as Error).message); }
  };

  if (!inv) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;
  return (
    <Screen>
      <Row><H2>Evidence: {inv.evidence.strength}</H2><Pill text={`${inv.evidence.score}/100`} /></Row>
      {inv.evidence.reasons.map((r) => <Small key={r}>• {r}</Small>)}
      <Card>
        <Toggle label="We have a signed contract" value={inv.hasSignedContract} onChange={(v) => { void setContract(v); }} />
      </Card>
      <Card>
        <H2>WhatsApp chat</H2>
        <Small>In WhatsApp, open the chat with your client → More → Export chat → Without media, and save it to Files. Then pick the .txt file here. Wasl looks only for messages from your client that admit the debt or promise payment.</Small>
        <Button title="Import WhatsApp chat" onPress={() => { void importChat(); }} busy={busy} />
        {msg ? <P>{msg}</P> : null}
        <ErrorText message={err} />
      </Card>
      {inv.admissions.length ? <H2>Admissions found</H2> : null}
      {inv.admissions.map((a) => (
        <Card key={a.at + a.text}>
          <Small>{a.at} · {a.sender} · {a.pattern.replace(/_/g, " ")}</Small>
          <P selectable>“{a.text}”</P>
        </Card>
      ))}
      {inv.acknowledgments.map((a) => (
        <Card key={a.at}>
          <Pill text="Electronic confirmation" tone="good" />
          <Small>{a.byName}{a.byPhone ? ` · ${a.byPhone}` : ""} · {a.at.replace("T", " ").slice(0, 19)} UTC</Small>
          <Small>Invoice fingerprint {a.invoiceHash.slice(0, 16)}…</Small>
        </Card>
      ))}
    </Screen>
  );
}
