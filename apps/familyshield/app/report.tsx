import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { buildReport, type Debrief, type ScamMedium } from "../src/lib/engine";
import { T, type Lang } from "../src/lib/i18n";
import { loadPrefs } from "../src/lib/prefs";
import { notify } from "../src/ui/confirm";
import { Button, Card, Field, H2, P, Pill, Row, Screen, Small, Toggle } from "../src/ui/kit";
import { useTheme } from "../src/ui/theme";

type Asked = Debrief["askedFor"][number];
const ASKED: Asked[] = ["OTP", "money", "install an app", "bank details", "threatened arrest", "other"];

export default function Report() {
  const t = useTheme();
  const p = useLocalSearchParams<{ number?: string; medium?: string; reasons?: string }>();
  const [lang, setLang] = useState<Lang>("hi");
  const [asked, setAsked] = useState<Asked[]>([]);
  const [claimed, setClaimed] = useState("");
  const [number, setNumber] = useState(p.number ?? "");
  const [lost, setLost] = useState(false);
  const [amount, setAmount] = useState("");
  const [report, setReport] = useState<ReturnType<typeof buildReport> | null>(null);
  useEffect(() => { void loadPrefs().then((x) => setLang(x.lang)); }, []);
  const s = T[lang];

  const make = () => setReport(buildReport({
    number: number || undefined, at: new Date(), medium: (p.medium as ScamMedium) || "Call",
    debrief: { askedFor: asked, claimedToBe: claimed || undefined, moneyLost: lost, amountINR: amount ? Number(amount) : undefined },
    reasons: (p.reasons ?? "").split("|").filter(Boolean),
  }));

  return (
    <Screen>
      <H2>{s.askedFor}</H2>
      <Row wrap>
        {ASKED.map((a) => {
          const on = asked.includes(a);
          return (
            <Pressable key={a} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setAsked(on ? asked.filter((x) => x !== a) : [...asked, a])}
              style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.card }}>
              <Text style={{ color: on ? t.onAccent : t.ink, fontSize: 17 }}>{s.opts[a]}</Text>
            </Pressable>
          );
        })}
      </Row>
      <Field label={s.claimed} value={claimed} onChangeText={setClaimed} placeholder="CBI, bank KYC, courier…" />
      <Field label="Caller's number" value={number} onChangeText={setNumber} keyboardType="phone-pad" />
      <Toggle label={s.moneyLost} value={lost} onChange={setLost} />
      {lost ? <Field label={s.amount} value={amount} onChangeText={setAmount} keyboardType="number-pad" /> : null}
      <Button title={s.makeReport} onPress={make} />

      {report ? (
        <Card>
          <Pill text={report.route === "1930" ? "Call 1930 now" : "Report on Chakshu"} tone={report.route === "1930" ? "bad" : "accent"} />
          <P>{report.why}</P>
          <Small>Report text (copied for you to paste):</Small>
          <P selectable>{report.description}</P>
          <Button kind="secondary" title="Copy report text" onPress={() => { void Clipboard.setStringAsync(report.description).then(() => notify("Copied")); }} />
          {report.route === "1930" ? (
            <>
              <Button title="Call 1930" onPress={() => { void Linking.openURL("tel:1930"); }} />
              <Button kind="secondary" title="Open cybercrime.gov.in" onPress={() => { void WebBrowser.openBrowserAsync(report.portal); }} />
            </>
          ) : (
            <Button title="Open Chakshu (Sanchar Saathi)" onPress={() => { void Clipboard.setStringAsync(report.description).then(() => WebBrowser.openBrowserAsync(report.portal)); }} />
          )}
          <Small>You submit the report yourself — Chakshu asks you to verify your own mobile number with an OTP. Family Shield never reports anyone automatically.</Small>
        </Card>
      ) : null}
    </Screen>
  );
}
