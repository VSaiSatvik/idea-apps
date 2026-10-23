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
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="index" options={{ title: "Invoices" }} />
          <Stack.Screen name="new" options={{ title: "New invoice", presentation: "modal" }} />
          <Stack.Screen name="invoice/[id]/index" options={{ title: "Invoice" }} />
          <Stack.Screen name="invoice/[id]/remind" options={{ title: "Reminders" }} />
          <Stack.Screen name="invoice/[id]/evidence" options={{ title: "Evidence" }} />
          <Stack.Screen name="account" options={{ title: "Account" }} />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
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
