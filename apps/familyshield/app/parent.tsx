import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState, Platform, Share } from "react-native";
import { api } from "../src/lib/api";
import { LANGS, type Lang } from "../src/lib/i18n";
import { loadPrefs, savePrefs, type Prefs } from "../src/lib/prefs";
import { configure, getStatus, openSettings, recentDecisions, shieldAvailable, type ShieldStatus } from "../src/native/shield";
import { Button, Card, Choice, ErrorText, Field, H2, P, Pill, Row, Screen, Small, Toggle } from "../src/ui/kit";

type Pair = { id: string; parentName: string; code?: string; codeExpires?: string; guardians: { name: string; notifications: boolean }[] };

export default function ParentSetup() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [status, setStatus] = useState<ShieldStatus | null>(getStatus());
  const [pair, setPair] = useState<Pair | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setStatus(getStatus());
    void loadPrefs().then(setPrefs);
    void api<Pair[]>("GET", "/shield/pairs").then((p) => setPair(p.find((x) => x.code !== undefined) ?? null)).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => {
    refresh();
    // permissions are granted in system Settings; re-check when the parent comes back
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") refresh(); });
    return () => sub.remove();
  }, [refresh]));

  const update = async (p: Partial<Prefs>) => {
    const next = await savePrefs(p);
    setPrefs(next);
    configure({ lang: next.lang, childName: next.childName });
  };

  const makeCode = async () => {
    setErr(null);
    try { setPair(await api<Pair>("POST", "/shield/pairs", { parentName: prefs?.parentName || undefined })); }
    catch (e) { setErr((e as Error).message); }
  };

  if (!prefs) return <Screen><P>Loading…</P></Screen>;
  const ready = !!status && status.notificationAccess && status.usageAccess && status.overlay;

  return (
    <Screen>
      <H2>1. Language and family</H2>
      <Choice label="Language on this phone" options={LANGS} value={prefs.lang} onChange={(v: Lang) => { void update({ lang: v }); }} />
      <Field label="Parent's name (shown to family)" value={prefs.parentName} onChangeText={(v) => { void update({ parentName: v }); }} placeholder="Mom" />
      <Field label="Child's name" value={prefs.childName} onChangeText={(v) => { void update({ childName: v }); }} placeholder="Rahul" />
      <Field label="Child's phone number" value={prefs.childPhone} onChangeText={(v) => { void update({ childPhone: v }); }} keyboardType="phone-pad" placeholder="+971 50 123 4567" hint="The pause screen calls this number with one tap." />

      <H2>2. Link your family's phones</H2>
      <Card>
        {pair?.code ? (
          <>
            <P>Code: {pair.code}</P>
            <Small>Enter this in Family Shield on your child's phone (valid 24 hours). Linked: {pair.guardians.length ? pair.guardians.map((g) => g.name).join(", ") : "nobody yet"}</Small>
            <Row>
              <Button small kind="secondary" title="Share code" onPress={() => { void Share.share({ message: `Family Shield code: ${pair.code}` }); }} />
              <Button small kind="ghost" title="New code" onPress={() => { void makeCode(); }} />
            </Row>
          </>
        ) : <Button title="Create a linking code" onPress={() => { void makeCode(); }} />}
        <ErrorText message={err} />
      </Card>

      <H2>3. Allow protection</H2>
      {!shieldAvailable ? (
        <Card>
          <Pill text={Platform.OS === "ios" ? "iPhone" : "Preview"} tone="warn" />
          <Small>{Platform.OS === "ios"
            ? "iPhones don't let apps see calls or other apps, so protection runs only on Android. Use this iPhone as the family member's phone, or try the demo."
            : "This preview can't access the phone. Install the Android app to turn on protection."}</Small>
          <Button kind="secondary" title="Try the demo" onPress={() => router.push("/tour")} />
        </Card>
      ) : (
        <>
          <Small>Family Shield never records calls or reads your messages. It only notices that a call with an unsaved number is going on, and which app is opened during it — all on this phone.</Small>
          <Card>
            <Row wrap><P>Notification access</P><Pill text={status?.notificationAccess ? "On" : "Off"} tone={status?.notificationAccess ? "good" : "warn"} /></Row>
            <Small>To notice calls from unsaved numbers (phone and WhatsApp) and "out for delivery" updates.</Small>
            {!status?.notificationAccess ? <Button small title="Open settings" onPress={() => openSettings("notification")} /> : null}
          </Card>
          <Card>
            <Row wrap><P>Usage access</P><Pill text={status?.usageAccess ? "On" : "Off"} tone={status?.usageAccess ? "good" : "warn"} /></Row>
            <Small>To notice if a banking, UPI or screen-sharing app is opened during a call with a stranger.</Small>
            {!status?.usageAccess ? <Button small title="Open settings" onPress={() => openSettings("usage")} /> : null}
          </Card>
          <Card>
            <Row wrap><P>Display over other apps</P><Pill text={status?.overlay ? "On" : "Off"} tone={status?.overlay ? "good" : "warn"} /></Row>
            <Small>So the pause screen can appear on top of the app the caller told you to open.</Small>
            {!status?.overlay ? <Button small title="Open settings" onPress={() => openSettings("overlay")} /> : null}
          </Card>
          <Card>
            <Toggle label="Protection on" value={!!status?.enabled} onChange={(v) => { configure({ enabled: v, lang: prefs.lang, childName: prefs.childName }); setStatus(getStatus()); }}
              hint={ready ? "Ready." : "Allow the three settings above first."} />
          </Card>
          {recentDecisions().slice(0, 3).map((d) => (
            <Card key={d.at}><Small>{new Date(d.at).toLocaleString()} · {d.tier} · {d.reasons.join(", ")}</Small></Card>
          ))}
        </>
      )}
    </Screen>
  );
}
