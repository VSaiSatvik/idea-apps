import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { getConnection, listModels, pickDefault, PROVIDERS, saveConnection, type ProviderId } from "../src/lib/providers";
import { notify } from "../src/ui/confirm";
import { Button, Card, Choice, ErrorText, Field, H2, P, Pill, Row, Screen, Small } from "../src/ui/kit";

function ProviderCard({ p }: { p: ProviderId }) {
  const info = PROVIDERS[p];
  const [saved, setSaved] = useState<{ key: string; model: string } | null>(null);
  const [key, setKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void getConnection(p).then((c) => { if (c) { setSaved(c); setModel(c.model); } }); }, [p]);

  const connect = async (k: string) => {
    setBusy(true); setErr(null);
    try {
      const list = await listModels(p, k.trim());
      if (!list.length) throw new Error("This key works but no chat models are available to it.");
      setModels(list);
      const m = model && list.includes(model) ? model : pickDefault(p, list);
      setModel(m);
      await saveConnection(p, k.trim(), m);
      setSaved({ key: k.trim(), model: m });
      setKey("");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const chooseModel = async (m: string) => {
    setModel(m);
    if (saved) { await saveConnection(p, saved.key, m); setSaved({ ...saved, model: m }); }
  };

  return (
    <Card>
      <Row>
        <P>{info.label}</P>
        {saved ? <Pill text="Connected" tone="good" /> : null}
      </Row>
      {saved ? (
        <>
          <Small>Key ending …{saved.key.slice(-4)} · model {saved.model || "not chosen"}</Small>
          {models.length ? null : <Button small kind="secondary" title="Change model" onPress={() => { void connect(saved.key); }} busy={busy} />}
          {models.length ? <Choice options={models.slice(0, 12).map((m) => ({ value: m, label: m }))} value={model} onChange={(m) => { void chooseModel(m); }} /> : null}
          <Button small kind="ghost" title="Disconnect" onPress={() => { void saveConnection(p, null).then(() => { setSaved(null); setModels([]); notify("Disconnected", "The key was removed from this phone."); }); }} />
        </>
      ) : (
        <>
          <Field label="API key" value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" autoCorrect={false} hint={info.keyHint} />
          <Row wrap>
            <Button small title="Connect" onPress={() => { void connect(key); }} busy={busy} disabled={key.trim().length < 10} />
            <Button small kind="ghost" title="Where do I get a key?" onPress={() => { void WebBrowser.openBrowserAsync(info.keyUrl); }} />
          </Row>
        </>
      )}
      <ErrorText message={err} />
    </Card>
  );
}

export default function Settings() {
  return (
    <Screen>
      <P>Connect the AI you already use. Your questions go straight from this phone to that provider, and you pay them for usage.</P>
      <Small>Keys are stored in this phone's secure storage and never sent to AskOnce Circles. Monthly chat subscriptions (Claude Pro, ChatGPT Plus) can't be connected; providers only allow API keys for other apps.</Small>
      <H2>Your AI connections</H2>
      {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => <ProviderCard key={p} p={p} />)}
      <H2>No key?</H2>
      <Small>You can still use Demo answers (a few a day) and read everything your circles share.</Small>
    </Screen>
  );
}
