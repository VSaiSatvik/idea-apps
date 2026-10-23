import { Redirect, router, Stack, useFocusEffect } from "expo-router";
import { useAuth } from "../src/lib/auth";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { loadPrefs, savePrefs, type Prefs } from "../src/lib/prefs";
import { shieldAvailable } from "../src/native/shield";
import { Button, Card, H1, Loading, P, Screen, Small } from "../src/ui/kit";

export default function Home() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useFocusEffect(useCallback(() => { void loadPrefs().then(setPrefs); }, []));

  const choose = async (mode: "parent" | "guardian") => {
    await savePrefs({ mode });
    router.push(mode === "parent" ? "/parent" : "/guardian");
  };

  if (!user) return <Redirect href="/login" />;
  if (!prefs) return <Screen><Loading /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <Button small kind="ghost" title="Account" onPress={() => router.push("/account")} /> }} />
      <H1>Family Shield</H1>
      <P muted>Scammers keep people on the phone and push them to pay, read out an OTP or install an app. Family Shield notices that moment on the parent's phone and gives them a calm pause — with one tap to bring you in.</P>
      <Card onPress={() => { void choose("parent"); }}>
        <P>This is my parent's phone</P>
        <Small>{shieldAvailable ? "Set up protection on this Android phone." : Platform.OS === "android" ? "Protection needs the full Android build of this app." : "Protection works on Android phones. On iPhone you can be the family member who gets check-ins."}</Small>
      </Card>
      <Card onPress={() => { void choose("guardian"); }}>
        <P>I'm the family member</P>
        <Small>Link to your parent's phone and get a notification when they tap "Let my family know".</Small>
      </Card>
      {prefs.mode ? <Button kind="secondary" title={prefs.mode === "parent" ? "Open protection settings" : "Open family check-ins"} onPress={() => router.push(prefs.mode === "parent" ? "/parent" : "/guardian")} /> : null}
      <Button kind="ghost" title="See how it works (demo)" onPress={() => router.push("/tour")} />
    </Screen>
  );
}
