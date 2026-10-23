/** Small on-device settings (no secrets): mode, language, child's name and number. */
import { getSecret, setSecret } from "./storage";
import type { Lang } from "./i18n";

export type Prefs = { mode: "parent" | "guardian" | null; lang: Lang; parentName: string; childName: string; childPhone: string; pairId?: string };
const KEY = "familyshield.prefs";
const DEFAULTS: Prefs = { mode: null, lang: "hi", parentName: "", childName: "", childPhone: "" };

export async function loadPrefs(): Promise<Prefs> {
  try { return { ...DEFAULTS, ...JSON.parse((await getSecret(KEY)) ?? "{}") }; } catch { return DEFAULTS; }
}
export async function savePrefs(p: Partial<Prefs>) {
  const cur = await loadPrefs();
  const next = { ...cur, ...p };
  await setSecret(KEY, JSON.stringify(next));
  return next;
}
