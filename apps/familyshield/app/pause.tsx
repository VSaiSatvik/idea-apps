import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { T, type Lang } from "../src/lib/i18n";
import { loadPrefs, type Prefs } from "../src/lib/prefs";
import { useTheme } from "../src/ui/theme";

/** Full-screen pause. Opened by the Android service (familyshield://pause?...) or by the demo. */
export default function Pause() {
  const t = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ reasons?: string; number?: string; medium?: string; demo?: string }>();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [told, setTold] = useState(false);
  useEffect(() => { void loadPrefs().then(setPrefs); }, []);

  const lang: Lang = prefs?.lang ?? "hi";
  const s = T[lang];
  const en = T.en;
  const child = prefs?.childName || (lang === "en" ? "your family" : lang === "hi" ? "परिवार" : "కుటుంబం");
  const reasons = (params.reasons ?? "").split("|").filter(Boolean);

  const callChild = () => { if (prefs?.childPhone) void Linking.openURL(`tel:${prefs.childPhone.replace(/[^\d+]/g, "")}`); };
  const tell = async () => {
    if (params.demo) { setTold(true); return; }
    try { await api("POST", "/shield/checkin", {}); setTold(true); } catch { setTold(false); }
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const Big = ({ title, sub, onPress, kind = "primary" }: { title: string; sub?: string; onPress: () => void; kind?: "primary" | "secondary" | "ghost" }) => (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: kind === "primary" ? t.good : kind === "secondary" ? t.soft : "transparent", borderRadius: 16, padding: 18, opacity: pressed ? 0.85 : 1, borderWidth: kind === "ghost" ? 1 : 0, borderColor: t.line })}>
      <Text style={{ color: kind === "primary" ? "#fff" : t.ink, fontSize: 21, fontWeight: "700", textAlign: "center" }}>{title}</Text>
      {sub && lang !== "en" ? <Text style={{ color: kind === "primary" ? "#fff" : t.muted, fontSize: 15, textAlign: "center", marginTop: 2 }}>{sub}</Text> : null}
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.card }}>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 14, maxWidth: 560, width: "100%", alignSelf: "center" }}>
        {params.demo ? <Text style={{ color: t.muted, fontSize: 14 }}>DEMO</Text> : null}
        <Text accessibilityRole="header" style={{ color: t.bad, fontSize: 44, fontWeight: "800" }}>{s.stop}</Text>
        <Text style={{ color: t.ink, fontSize: 24, lineHeight: 33, fontWeight: "600" }}>{s.body(child)}</Text>
        {lang !== "en" ? <Text style={{ color: t.muted, fontSize: 16 }}>{en.body(prefs?.childName || "your family")}</Text> : null}
        {prefs?.childPhone ? <Big title={s.callChild(child)} sub={en.callChild(prefs.childName || "family")} onPress={callChild} /> : null}
        {user || params.demo ? <Big kind={prefs?.childPhone ? "secondary" : "primary"} title={told ? "✓ " + s.told : s.tellFamily} sub={told ? undefined : en.tellFamily} onPress={() => { void tell(); }} /> : null}
        <View style={{ backgroundColor: t.soft, borderRadius: 12, padding: 14, gap: 8 }}>
          <Text style={{ color: t.ink, fontSize: 18 }}>{s.secrecy}</Text>
          <Text style={{ color: t.ink, fontSize: 18 }}>{s.police}</Text>
        </View>
        <Big kind="ghost" title={s.report} sub={en.report} onPress={() => router.push({ pathname: "/report", params: { number: params.number ?? "", medium: params.medium ?? "Call", reasons: params.reasons ?? "" } })} />
        <Big kind="ghost" title={s.imOk} sub={en.imOk} onPress={close} />
        {reasons.length ? <Text style={{ color: t.muted, fontSize: 13 }}>{s.why}: {reasons.join(" · ")}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
