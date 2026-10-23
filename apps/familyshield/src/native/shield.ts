/** JS side of modules/shield-native (Android only). Undefined on iOS/web — the app then offers demo mode only. */
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

export type ShieldStatus = { notificationAccess: boolean; usageAccess: boolean; overlay: boolean; enabled: boolean; sdk: number };
export type NativeDecision = { at: number; tier: "pause" | "banner"; score: number; reasons: string[]; number: string | null; medium: "Call" | "WhatsApp" };

type ShieldNativeModule = {
  getStatus(): ShieldStatus;
  openSettings(which: "notification" | "usage" | "overlay" | "app"): void;
  configure(enabled: boolean | null, lang: string | null, childName: string | null, homeCode: string | null): void;
  recentDecisions(): string;
};

const native = Platform.OS === "android" ? requireOptionalNativeModule<ShieldNativeModule>("ShieldNative") : null;

export const shieldAvailable = !!native;
export const getStatus = (): ShieldStatus | null => native?.getStatus() ?? null;
export const openSettings = (w: "notification" | "usage" | "overlay" | "app") => native?.openSettings(w);
export const configure = (o: { enabled?: boolean; lang?: string; childName?: string; homeCode?: string }) =>
  native?.configure(o.enabled ?? null, o.lang ?? null, o.childName ?? null, o.homeCode ?? null);
export const recentDecisions = (): NativeDecision[] => {
  try { return JSON.parse(native?.recentDecisions() ?? "[]"); } catch { return []; }
};
