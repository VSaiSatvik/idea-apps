import { useState } from "react";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useAuth } from "../src/lib/auth";
import { PRIVACY_URL, SUPPORT_EMAIL } from "../src/lib/config";
import { confirm, notify } from "../src/ui/confirm";
import { Button, Card, H2, P, Screen, Small } from "../src/ui/kit";

export default function Account() {
  const { user, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  const del = async () => {
    const ok = await confirm("Delete your account?", "This permanently deletes your account and everything you created in this app. It can't be undone.", "Delete", true);
    if (!ok) return;
    setBusy(true);
    try {
      await deleteAccount();
    } catch (e) {
      notify("Couldn't delete the account", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Account" }} />
      <Card>
        <P>{user?.name}</P>
        <Small>{user?.email}</Small>
      </Card>
      <Button kind="secondary" title="Sign out" onPress={() => { void signOut(); }} />
      <H2>Help and privacy</H2>
      <Button kind="secondary" title="Privacy policy" onPress={() => { void WebBrowser.openBrowserAsync(PRIVACY_URL); }} />
      <Button kind="secondary" title="Contact support" onPress={() => { void Linking.openURL(`mailto:${SUPPORT_EMAIL}`); }} />
      <H2>Delete account</H2>
      <P muted>Deletes your account and your data from our servers.</P>
      <Button kind="danger" title="Delete my account" onPress={del} busy={busy} />
      <Small>Version {Constants.expoConfig?.version ?? "1.0.0"}</Small>
    </Screen>
  );
}
