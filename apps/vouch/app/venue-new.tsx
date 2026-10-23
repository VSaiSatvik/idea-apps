import { router } from "expo-router";
import * as Location from "expo-location";
import { useState } from "react";
import { api } from "../src/lib/api";
import type { Category } from "../src/lib/types";
import { Button, Card, Choice, ErrorText, Field, P, Row, Screen, Small } from "../src/ui/kit";

const CATS: Category[] = ["coffee", "brunch", "bakery", "dessert", "juice", "burger", "asian", "arabic", "pizza"];

export default function NewVenue() {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [opens, setOpens] = useState("8");
  const [closes, setCloses] = useState("22");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState<"loc" | "save" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const locate = async () => {
    setBusy("loc"); setErr(null);
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted) throw new Error("Location permission was not given. You can allow it in Settings, or ask us to place your venue.");
      const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPos({ lat: l.coords.latitude, lng: l.coords.longitude });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const save = async () => {
    setBusy("save"); setErr(null);
    try {
      await api("POST", "/vouch/venues", { name, area, category, opens: Number(opens), closes: Number(closes), ...pos });
      router.back();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <Screen>
      <Field label="Venue name" value={name} onChangeText={setName} />
      <Field label="Area" value={area} onChangeText={setArea} placeholder="Al Quoz, JLT, Dubai Hills…" />
      <Choice label="What you serve" options={CATS.map((c) => ({ value: c, label: c }))} value={category} onChange={setCategory} />
      <Row>
        <Field label="Opens (hour)" value={opens} onChangeText={setOpens} keyboardType="number-pad" />
        <Field label="Closes (hour)" value={closes} onChangeText={setCloses} keyboardType="number-pad" />
      </Row>
      <Card>
        <P>Location</P>
        <Small>Stand inside your venue and tap below. We use it once to group you with neighbours within walking distance.</Small>
        <Button kind="secondary" title={pos ? `Set (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}) — update` : "Use my current location"} onPress={() => { void locate(); }} busy={busy === "loc"} />
      </Card>
      <ErrorText message={err} />
      <Button title="Register venue" onPress={() => { void save(); }} busy={busy === "save"} disabled={!name || !area || !category || !pos} />
    </Screen>
  );
}
