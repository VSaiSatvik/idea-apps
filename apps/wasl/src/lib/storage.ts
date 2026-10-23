/** Secrets (session token, AI API keys) go in the OS keychain/keystore; web preview falls back to localStorage. */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const web = Platform.OS === "web";

export async function getSecret(key: string): Promise<string | null> {
  if (web) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecret(key: string, value: string | null): Promise<void> {
  if (web) {
    try {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } catch { /* storage unavailable */ }
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}
