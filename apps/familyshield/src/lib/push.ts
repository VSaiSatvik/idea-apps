/** Push notifications for the family member's phone ("Mom may need a call now"). */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function registerForPush(): Promise<{ token: string | null; reason?: string }> {
  if (Platform.OS === "web") return { token: null, reason: "Notifications work in the phone app, not the web preview." };
  if (!Device.isDevice) return { token: null, reason: "Use a real phone to receive notifications." };
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("checkin", { name: "Family check-ins", importance: Notifications.AndroidImportance.MAX, sound: "default" });
  }
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return { token: null, reason: "Notifications are off for Family Shield. Turn them on in Settings to get check-ins." };
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return { token: null, reason: "This build has no EAS project ID yet (run `eas init`)." };
  const t = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: t.data };
}
