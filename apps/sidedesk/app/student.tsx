import { router } from "expo-router";
import { useEffect, useState } from "react";
import { api } from "../src/lib/api";
import type { Me, Menu } from "../src/lib/types";
import { Button, Card, ErrorText, Field, H2, P, Pill, Row, Screen, Small, Toggle } from "../src/ui/kit";
import { useTheme } from "../src/ui/theme";
import { Pressable, Text } from "react-native";

const skillLabel: Record<string, string> = { data: "Data entry", research: "Research", language: "Languages (EN/AR/HI)", office: "Docs & spreadsheets", social: "Social media" };

export default function StudentJoin() {
  const t = useTheme();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [f, setF] = useState({ university: "", universityEmail: "", age: "", sponsorApproval: false });
  const [skills, setSkills] = useState<string[]>([]);
  const [status, setStatus] = useState<Me["student"]>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void api<Menu>("GET", "/sidedesk/menu").then(setMenu);
    void api<Me>("GET", "/sidedesk/me").then((m) => {
      if (m.student) { setStatus(m.student); setSkills(m.student.skills); setF({ university: m.student.university, universityEmail: m.student.universityEmail ?? "", age: String(m.student.age), sponsorApproval: m.student.sponsorApproval }); }
    });
  }, []);

  const save = async () => {
    setBusy(true); setErr(null);
    try { await api("PUT", "/sidedesk/student", { ...f, age: Number(f.age), skills }); router.back(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      {status ? <Pill text={status.active ? "Active" : "On the waitlist"} tone={status.active ? "good" : "warn"} /> : null}
      <P muted>SideDesk employs students part-time and pays AED {menu?.wageAEDPerHour ?? 45} an hour. We file your UAE part-time work permit when there's steady work for your skills — until then you're on the waitlist.</P>
      <Field label="University" value={f.university} onChangeText={(v) => setF({ ...f, university: v })} />
      <Field label="University email" value={f.universityEmail} onChangeText={(v) => setF({ ...f, universityEmail: v })} autoCapitalize="none" keyboardType="email-address" hint="Ending .ac.ae or .edu" />
      <Field label="Age" value={f.age} onChangeText={(v) => setF({ ...f, age: v })} keyboardType="number-pad" />
      <H2>Skills</H2>
      <Row wrap>
        {(menu?.skills ?? []).map((s) => {
          const on = skills.includes(s);
          return (
            <Pressable key={s} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setSkills(on ? skills.filter((x) => x !== s) : [...skills, s])}
              style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.card }}>
              <Text style={{ color: on ? t.onAccent : t.ink, fontSize: 15 }}>{skillLabel[s] ?? s}</Text>
            </Pressable>
          );
        })}
      </Row>
      <Card>
        <Toggle label="My university / visa sponsor allows me to work part-time" value={f.sponsorApproval} onChange={(v) => setF({ ...f, sponsorApproval: v })}
          hint="Some students need a no-objection letter from their sponsor. We'll ask for it before filing your permit." />
      </Card>
      <Small>Work limits: up to {menu?.limits.maxHoursPerDay ?? 6} hours a day and {menu?.limits.maxConsecutiveHours ?? 4} in a row, never during your exam dates.</Small>
      <ErrorText message={err} />
      <Button title={status ? "Save" : "Join the waitlist"} onPress={() => { void save(); }} busy={busy} disabled={skills.length === 0} />
    </Screen>
  );
}
