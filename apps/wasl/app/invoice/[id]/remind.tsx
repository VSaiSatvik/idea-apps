import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { api } from "../../../src/lib/api";
import type { Invoice, Step } from "../../../src/lib/types";
import { useLoad } from "../../../src/lib/useLoad";
import { sendWhatsApp } from "../../../src/lib/whatsapp";
import { notify } from "../../../src/ui/confirm";
import { Button, Card, Choice, ErrorText, Field, H2, Loading, P, Pill, Row, Screen, Small } from "../../../src/ui/kit";

const toneLabel = { friendly: "Friendly", options: "Offer options", firm: "Firm", final: "Final notice" } as const;

export default function Remind() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(async () => {
    const [inv, l] = await Promise.all([api<Invoice>("GET", `/wasl/invoices/${id}`), api<{ steps: Step[] }>("GET", `/wasl/invoices/${id}/ladder`)]);
    return { inv, steps: l.steps };
  }, [id]);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [custom, setCustom] = useState("");
  const [lintMsg, setLintMsg] = useState<string | null>(null);

  if (!data) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;

  const sendCustom = async () => {
    const r = await api<{ ok: boolean; problems: string[] }>("POST", "/wasl/lint", { message: custom });
    if (!r.ok) {
      setLintMsg(`Wasl won't send this: it looks like ${r.problems.join(", ").replace(/_/g, " ")}. Threats, insults, public shaming or contacting family/employers can be criminal offences in the UAE.`);
      return;
    }
    setLintMsg(null);
    await sendWhatsApp(custom, data.inv.debtor.phone);
  };

  const dueDate = new Date(data.inv.dueOn + "T00:00:00");
  return (
    <Screen>
      <P muted>Send these in order, from your own WhatsApp. Each one opens WhatsApp with the message ready; you press send.</P>
      <Choice options={[{ value: "en", label: "English" }, { value: "ar", label: "العربية" }]} value={lang} onChange={setLang} />
      {data.steps.map((s) => {
        const when = new Date(dueDate.getTime() + s.day * 86400e3).toISOString().slice(0, 10);
        const text = lang === "en" ? s.en : s.ar;
        return (
          <Card key={s.day}>
            <Row wrap><Pill text={toneLabel[s.tone]} tone={s.tone === "final" ? "bad" : s.tone === "firm" ? "warn" : "accent"} /><Small>{s.day < 0 ? `${-s.day} days before due` : `${s.day} days after due`} · {when}</Small></Row>
            <P selectable style={lang === "ar" ? { textAlign: "right", writingDirection: "rtl" } : undefined}>{text}</P>
            <Row wrap>
              <Button small title="Send on WhatsApp" onPress={() => { void sendWhatsApp(text, data.inv.debtor.phone); }} />
              <Button small kind="secondary" title="Copy" onPress={() => { void Clipboard.setStringAsync(text).then(() => notify("Copied")); }} />
            </Row>
          </Card>
        );
      })}
      {data.inv.evidence.strength === "weak" ? <Small>There's no final notice yet: without written proof of the debt, a legal threat would likely be empty. Get the client to confirm the invoice (or a new date) first.</Small> : null}
      <H2>Write your own</H2>
      <Field label="Message" value={custom} onChangeText={setCustom} multiline />
      <ErrorText message={lintMsg} />
      <Button kind="secondary" title="Check and send" onPress={() => { void sendCustom(); }} disabled={custom.trim().length < 5} />
    </Screen>
  );
}
