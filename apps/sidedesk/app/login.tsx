import { useState } from "react";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../src/lib/auth";
import { PRIVACY_URL } from "../src/lib/config";
import { BRAND } from "../src/ui/brand";
import { Button, Card, ErrorText, Field, H1, P, Screen, Small } from "../src/ui/kit";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (mode === "up") await signUp(name, email, password);
      else await signIn(email, password);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <H1>{BRAND.name}</H1>
      <P muted>{BRAND.tagline}</P>
      <Card>
        {mode === "up" ? <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" /> : null}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "up" ? "new-password" : "current-password"}
          textContentType={mode === "up" ? "newPassword" : "password"} hint={mode === "up" ? "At least 8 characters" : undefined} />
        <ErrorText message={err} />
        <Button title={mode === "up" ? "Create account" : "Sign in"} onPress={go} busy={busy} />
        <Button kind="ghost" title={mode === "up" ? "I already have an account" : "Create a new account"} onPress={() => { setMode(mode === "up" ? "in" : "up"); setErr(null); }} />
      </Card>
      <Small>By continuing you agree to the privacy policy.</Small>
      <Button kind="ghost" small title="Read the privacy policy" onPress={() => { void WebBrowser.openBrowserAsync(PRIVACY_URL); }} />
    </Screen>
  );
}
