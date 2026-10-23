import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { Loading } from "../src/ui/kit";
import { useTheme } from "../src/ui/theme";

function Gate() {
  const { ready, user } = useAuth();
  const t = useTheme();
  if (!ready) return <Loading />;
  return (
    <>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerStyle: { backgroundColor: t.card }, headerTintColor: t.ink, contentStyle: { backgroundColor: t.bg }, headerBackTitle: "Back" }}>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* index decides for itself (redirects to login when signed out) so "/" never falls back to another screen */}
        <Stack.Screen name="index" options={{ title: "Family Shield" }} />
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="parent" options={{ title: "Protect this phone" }} />
          <Stack.Screen name="guardian" options={{ title: "Family check-ins" }} />
          <Stack.Screen name="account" options={{ title: "Account" }} />
        </Stack.Protected>
        {/* listed last so signed-out users start at login; these open without an account
            (the pause screen must work even if the parent is signed out) */}
        <Stack.Screen name="pause" options={{ headerShown: false, presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="report" options={{ title: "Report fraud" }} />
        <Stack.Screen name="tour" options={{ title: "See how it works" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
