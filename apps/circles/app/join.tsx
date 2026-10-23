import { router } from "expo-router";
import { useState } from "react";
import { api } from "../src/lib/api";
import { Button, ErrorText, Field, P, Screen } from "../src/ui/kit";

export default function Join() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const join = async () => {
    setBusy(true);
    setErr(null);
    try {
      const c = await api<{ id: string }>("POST", "/circles/join", { code });
      router.replace(`/circle/${c.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <P muted>Ask a member for the circle's 6-character invite code.</P>
      <Field label="Invite code" placeholder="AB3K9Q" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={6} autoFocus />
      <ErrorText message={err} />
      <Button title="Join" onPress={join} busy={busy} disabled={code.trim().length !== 6} />
    </Screen>
  );
}
