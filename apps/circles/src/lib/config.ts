import Constants from "expo-constants";

type Extra = { apiUrl?: string; appId?: string; privacyUrl?: string; supportEmail?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "http://localhost:8080").replace(/\/$/, "");
export const APP_ID = extra.appId ?? "app";
export const PRIVACY_URL = extra.privacyUrl ?? "https://example.com/privacy";
export const SUPPORT_EMAIL = extra.supportEmail ?? "support@example.com";
