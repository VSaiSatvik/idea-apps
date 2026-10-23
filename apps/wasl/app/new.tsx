import { router } from "expo-router";
import { useState } from "react";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import type { Invoice } from "../src/lib/types";
import { Button, ErrorText, Field, Screen, Toggle } from "../src/ui/kit";

const day = (d: Date) => d.toISOString().slice(0, 10);

export default function NewInvoice() {
  const { user } = useAuth();
  const today = new Date();
  const [f, setF] = useState({
    number: "", creditorName: user?.name ?? "", debtorName: "", debtorPhone: "", debtorEmail: "",
    amountAED: "", description: "", issuedOn: day(today), dueOn: day(new Date(today.getTime() + 30 * 86400e3)), hasSignedContract: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string | boolean) => setF({ ...f, [k]: v });

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const inv = await api<Invoice>("POST", "/wasl/invoices", { ...f, amountAED: Number(f.amountAED.replace(/,/g, "")) });
      router.replace(`/invoice/${inv.id}`);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Field label="Invoice number" value={f.number} onChangeText={set("number")} placeholder="INV-012" />
      <Field label="Your name or business" value={f.creditorName} onChangeText={set("creditorName")} />
      <Field label="Client name" value={f.debtorName} onChangeText={set("debtorName")} hint="The person or company who should confirm and pay" />
      <Field label="Client WhatsApp number" value={f.debtorPhone} onChangeText={set("debtorPhone")} keyboardType="phone-pad" placeholder="+971 50 123 4567" />
      <Field label="Client email (optional)" value={f.debtorEmail} onChangeText={set("debtorEmail")} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Amount (AED)" value={f.amountAED} onChangeText={set("amountAED")} keyboardType="decimal-pad" placeholder="6500" />
      <Field label="What it's for" value={f.description} onChangeText={set("description")} placeholder="Brand identity design" />
      <Field label="Issued on" value={f.issuedOn} onChangeText={set("issuedOn")} hint="YYYY-MM-DD" />
      <Field label="Due on" value={f.dueOn} onChangeText={set("dueOn")} hint="YYYY-MM-DD" />
      <Toggle label="We have a signed contract" value={f.hasSignedContract} onChange={set("hasSignedContract")} />
      <ErrorText message={err} />
      <Button title="Create invoice" onPress={save} busy={busy} />
    </Screen>
  );
}
