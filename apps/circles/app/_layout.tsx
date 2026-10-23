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
          <Stack.Screen name="index" options={{ title: "Circles" }} />
          <Stack.Screen name="new" options={{ title: "New circle", presentation: "modal" }} />
          <Stack.Screen name="join" options={{ title: "Join a circle", presentation: "modal" }} />
          <Stack.Screen name="settings" options={{ title: "Your AI" }} />
          <Stack.Screen name="account" options={{ title: "Account" }} />
          <Stack.Screen name="circle/[id]/index" options={{ title: "" }} />
          <Stack.Screen name="circle/[id]/ask" options={{ title: "Ask" }} />
          <Stack.Screen name="circle/[id]/topic/[key]" options={{ title: "Answers" }} />
          <Stack.Screen name="circle/[id]/members" options={{ title: "Members" }} />
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
