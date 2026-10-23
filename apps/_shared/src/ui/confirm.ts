import { Alert, Platform } from "react-native";

/** Cross-platform confirm (Alert on phones, window.confirm in the web preview). */
export function confirm(title: string, message: string, ok = "OK", destructive = false): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? true);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: ok, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]),
  );
}

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") globalThis.alert?.(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
