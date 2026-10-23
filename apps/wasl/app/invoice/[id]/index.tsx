import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { useState } from "react";
import { api } from "../../../src/lib/api";
import { aed, routeLabel, type Invoice } from "../../../src/lib/types";
import { useLoad } from "../../../src/lib/useLoad";
import { sendWhatsApp } from "../../../src/lib/whatsapp";
import { confirm, notify } from "../../../src/ui/confirm";
import { Button, Card, ErrorText, H1, H2, Loading, P, Pill, Row, Screen, Small } from "../../../src/ui/kit";
import { StatusPill } from "../../../src/ui/StatusPill";

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: inv, error, loading, reload, setData } = useLoad(() => api<Invoice>("GET", `/wasl/invoices/${id}`), [id]);
  const [busy, setBusy] = useState<string | null>(null);

  if (!inv) return <Screen>{error ? <ErrorText message={error} /> : <Loading />}</Screen>;

  const linkMessage =
    `Hi ${inv.debtor.name}, here is invoice ${inv.number} for ${aed(inv.amountAED)} (${inv.description}), due ${inv.dueOn}. ` +
    `Please tap to confirm you've received it: ${inv.ackUrl}`;

  const pack = async () => {
    setBusy("pack");
    try {
      const { html } = await api<{ html: string }>("GET", `/wasl/invoices/${id}/pack`);
      if (Platform.OS === "web") { await Print.printAsync({ html }); return; }
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Escalation pack ${inv.number}`, UTI: "com.adobe.pdf" });
      else notify("PDF saved", uri);
    } catch (e) { notify("Couldn't create the pack", (e as Error).message); }
    finally { setBusy(null); }
  };

  const setStatus = async (status: "paid" | "sent") => {
    try { setData(await api<Invoice>("PATCH", `/wasl/invoices/${id}`, { status })); }
    catch (e) { notify("Couldn't update", (e as Error).message); }
  };

  const remove = async () => {
    if (!(await confirm("Delete this invoice?", "The confirmation link will stop working and the evidence record is deleted.", "Delete", true))) return;
    try { await api("DELETE", `/wasl/invoices/${id}`); router.back(); }
    catch (e) { notify("Couldn't delete", (e as Error).message); }
  };

  const last = inv.acknowledgments.at(-1);
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Row wrap><StatusPill inv={inv} /><Small>#{inv.number}</Small></Row>
      <H1>{aed(inv.amountAED)}</H1>
      <P>{inv.debtor.name} · {inv.description}</P>
      <Small>Issued {inv.issuedOn} · due {inv.dueOn}</Small>

      <Card>
        <H2>Client confirmation</H2>
        {last ? (
          <>
            <Pill text="Confirmed" tone="good" />
            <Small>{last.byName} confirmed on {last.at.slice(0, 16).replace("T", " ")} UTC{last.kind === "new_due_date" ? ` and agreed a new date: ${last.dueOn}` : ""}.</Small>
          </>
        ) : (
          <Small>Send your client the link. One tap from them records a timestamped confirmation of the invoice in English and Arabic.</Small>
        )}
        <Button title={last ? "Send the link again" : "Send confirmation link on WhatsApp"} onPress={() => { void sendWhatsApp(linkMessage, inv.debtor.phone); }} />
        <Button kind="secondary" small title="Copy link" onPress={() => { void Clipboard.setStringAsync(inv.ackUrl).then(() => notify("Link copied")); }} />
      </Card>

      <Card onPress={() => router.push(`/invoice/${id}/evidence`)}>
        <Row><H2>Evidence</H2><Pill text={inv.evidence.strength} tone={inv.evidence.strength === "strong" ? "good" : inv.evidence.strength === "moderate" ? "warn" : "bad"} /></Row>
        {inv.evidence.reasons.map((r) => <Small key={r}>• {r}</Small>)}
        <Small>Tap to add WhatsApp chat evidence</Small>
      </Card>

      {inv.status !== "paid" ? (
        <>
          <Card>
            <H2>If they don't pay</H2>
            <Pill text={routeLabel[inv.triage.route]} tone="accent" />
            <Small>{inv.triage.why}</Small>
          </Card>
          <Button title="Reminders" onPress={() => router.push(`/invoice/${id}/remind`)} />
          {inv.evidence.strength !== "weak" ? <Button kind="secondary" title="Create escalation pack (PDF)" onPress={pack} busy={busy === "pack"} /> : null}
          <Button kind="secondary" title="Mark as paid" onPress={() => { void setStatus("paid"); }} />
        </>
      ) : (
        <Button kind="secondary" title="Mark as unpaid" onPress={() => { void setStatus("sent"); }} />
      )}
      <Button kind="ghost" title="Delete invoice" onPress={remove} />
      <Small>Wasl is a tool you use yourself: messages are sent from your own WhatsApp or email, and Wasl never contacts your clients or collects money. This is not legal advice.</Small>
    </Screen>
  );
}
