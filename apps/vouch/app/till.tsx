import { useState } from "react";
import { api } from "../src/lib/api";
import { Button, Card, Field, P, Screen, Small } from "../src/ui/kit";
import { useTheme } from "../src/ui/theme";

export default function Till() {
  const t = useTheme();
  const [code, setCode] = useState("");
  const [last3, setLast3] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const check = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await api<{ ok: boolean; venue?: string; reason?: string }>("POST", "/vouch/redeem", { code, phoneLast3: last3 });
      setResult(r.ok ? { ok: true, text: `✓ Valid at ${r.venue}. Apply the crawl discount.` } : { ok: false, text: `✗ ${r.reason}` });
      if (r.ok) { setCode(""); setLast3(""); }
    } catch (e) { setResult({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <P muted>When a customer shows a crawl code, enter it with the last 3 digits of their phone number. Each customer counts once per venue.</P>
      <Field label="Code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" placeholder="KILN-7KQ2M" style={{ fontSize: 22 }} />
      <Field label="Last 3 digits of customer's phone" value={last3} onChangeText={setLast3} keyboardType="number-pad" maxLength={3} style={{ fontSize: 22 }} />
      <Button title="Check code" onPress={() => { void check(); }} busy={busy} disabled={code.length < 5 || last3.length !== 3} />
      {result ? (
        <Card style={{ borderColor: result.ok ? t.good : t.bad, borderWidth: 2 }}>
          <P style={{ fontSize: 20, color: result.ok ? t.good : t.bad }}>{result.text}</P>
        </Card>
      ) : null}
      <Small>Customers who mention the crawl but have no code can be noted on the crawl screen; they're shown in your results but never charged.</Small>
    </Screen>
  );
}
