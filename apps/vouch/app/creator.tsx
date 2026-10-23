import { useEffect, useState } from "react";
import { api } from "../src/lib/api";
import type { CreatorView, Me } from "../src/lib/types";
import { Button, Card, ErrorText, Field, P, Pill, Screen, Small } from "../src/ui/kit";

export default function CreatorProfile() {
  const [handle, setHandle] = useState("");
  const [followers, setFollowers] = useState("");
  const [permit, setPermit] = useState("");
  const [saved, setSaved] = useState<CreatorView | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void api<Me>("GET", "/vouch/me").then((m) => {
      if (m.creator) { setSaved(m.creator); setHandle(m.creator.handle); setFollowers(String(m.creator.followers)); setPermit(m.creator.permitNumber ?? ""); }
    });
  }, []);

  const save = async () => {
    setBusy(true); setErr(null);
    try { setSaved(await api<CreatorView>("PUT", "/vouch/creator", { handle, followers: Number(followers.replace(/,/g, "")), permitNumber: permit || undefined })); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <P muted>Crawls pay AED 1,000 per video plus a bonus for every customer who uses your venues' codes.</P>
      <Field label="Instagram or TikTok handle" value={handle} onChangeText={setHandle} autoCapitalize="none" placeholder="@yourhandle" />
      <Field label="Followers" value={followers} onChangeText={setFollowers} keyboardType="number-pad" />
      <Field label="UAE advertiser permit number" value={permit} onChangeText={setPermit} autoCapitalize="characters"
        hint="Since February 2026, paid or gifted promotion in the UAE needs a UAE Media Council advertiser permit. Show the number on your profile; our team checks it before booking you." />
      <ErrorText message={err} />
      <Button title={saved ? "Save changes" : "Create creator profile"} onPress={() => { void save(); }} busy={busy} />
      {saved ? (
        <Card>
          <Pill text={saved.permit.ok ? "Permit verified" : "Waiting for permit check"} tone={saved.permit.ok ? "good" : "warn"} />
          <Small>{saved.permit.reason}</Small>
        </Card>
      ) : null}
    </Screen>
  );
}
