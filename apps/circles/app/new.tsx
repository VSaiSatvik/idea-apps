import { router } from "expo-router";
import { useState } from "react";
import { api } from "../src/lib/api";
import { Button, ErrorText, Field, P, Screen } from "../src/ui/kit";

export default function NewCircle() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const c = await api<{ id: string }>("POST", "/circles", { name });
      router.replace(`/circle/${c.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <P muted>A circle is a group that shares AI answers: a study group for one course, a project team, or your family.</P>
      <Field label="Circle name" placeholder="CMP 333 study group" value={name} onChangeText={setName} maxLength={60} autoFocus />
      <ErrorText message={err} />
      <Button title="Create" onPress={create} busy={busy} disabled={name.trim().length < 2} />
    </Screen>
  );
}
