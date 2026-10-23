/**
 * Calls the member's own AI directly from the phone with the API key they saved.
 * Keys never go to our server. Model IDs come from each provider's model list,
 * so nothing here goes stale when providers release new models.
 */
import { Platform } from "react-native";
import { api } from "./api";
import { getSecret, setSecret } from "./storage";

export type ProviderId = "anthropic" | "openai" | "google";

export const PROVIDERS: Record<ProviderId, { label: string; keyHint: string; keyUrl: string }> = {
  anthropic: { label: "Claude (Anthropic)", keyHint: "Starts with sk-ant-", keyUrl: "https://platform.claude.com/" },
  openai: { label: "ChatGPT (OpenAI)", keyHint: "Starts with sk-", keyUrl: "https://platform.openai.com/api-keys" },
  google: { label: "Gemini (Google)", keyHint: "From Google AI Studio", keyUrl: "https://aistudio.google.com/apikey" },
};

export const SYSTEM_HINT = "Answer clearly and concisely. State key facts (numbers, dates, names) explicitly so classmates can check them.";

export type Connection = { provider: ProviderId; key: string; model: string };

const k = (p: ProviderId) => `circles.key.${p}`;
const m = (p: ProviderId) => `circles.model.${p}`;

export async function getConnection(p: ProviderId): Promise<Connection | null> {
  const key = await getSecret(k(p));
  if (!key) return null;
  return { provider: p, key, model: (await getSecret(m(p))) ?? "" };
}

export async function saveConnection(p: ProviderId, key: string | null, model?: string) {
  await setSecret(k(p), key);
  if (model !== undefined) await setSecret(m(p), model || null);
  if (key === null) await setSecret(m(p), null);
}

export async function connections(): Promise<Connection[]> {
  const all = await Promise.all((Object.keys(PROVIDERS) as ProviderId[]).map(getConnection));
  return all.filter((c): c is Connection => !!c);
}

async function json(r: Response) {
  const text = await r.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch { /* not json */ }
  if (!r.ok) throw new Error(j?.error?.message ?? j?.message ?? `The provider returned an error (${r.status})`);
  return j;
}

const anthropicHeaders = (key: string) => ({
  "x-api-key": key,
  "anthropic-version": "2023-06-01",
  "content-type": "application/json",
  ...(Platform.OS === "web" ? { "anthropic-dangerous-direct-browser-access": "true" } : {}),
});

/** Models the key can use, newest first where the provider says so. */
export async function listModels(p: ProviderId, key: string): Promise<string[]> {
  if (p === "anthropic") {
    const j = await json(await fetch("https://api.anthropic.com/v1/models?limit=50", { headers: anthropicHeaders(key) }));
    return (j.data ?? []).map((x: any) => x.id as string);
  }
  if (p === "openai") {
    const j = await json(await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${key}` } }));
    return (j.data ?? []).map((x: any) => x.id as string)
      .filter((id: string) => /^(gpt|o\d|chatgpt)/.test(id) && !/(audio|realtime|tts|transcribe|image|embedding|search|instruct)/.test(id))
      .sort((a: string, b: string) => b.localeCompare(a));
  }
  const j = await json(await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`));
  return (j.models ?? [])
    .filter((x: any) => (x.supportedGenerationMethods ?? []).includes("generateContent") && /gemini/.test(x.name))
    .map((x: any) => String(x.name).replace(/^models\//, ""))
    .sort((a: string, b: string) => b.localeCompare(a));
}

/** A sensible default from the provider's own list (a balanced, mid-sized model where one is recognisable). */
export function pickDefault(p: ProviderId, models: string[]): string {
  const prefer = p === "anthropic" ? /sonnet/ : p === "openai" ? /mini/ : /flash(?!.*lite)/;
  return models.find((x) => prefer.test(x)) ?? models[0] ?? "";
}

export async function ask(c: Connection, question: string): Promise<{ answer: string; model: string }> {
  if (!c.model) throw new Error("Pick a model for this AI in Settings");
  if (c.provider === "anthropic") {
    const j = await json(await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: anthropicHeaders(c.key),
      body: JSON.stringify({ model: c.model, max_tokens: 1200, system: SYSTEM_HINT, messages: [{ role: "user", content: question }] }),
    }));
    return { model: j.model ?? c.model, answer: (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim() };
  }
  if (c.provider === "openai") {
    const j = await json(await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { authorization: `Bearer ${c.key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: c.model, messages: [{ role: "system", content: SYSTEM_HINT }, { role: "user", content: question }] }),
    }));
    return { model: j.model ?? c.model, answer: String(j.choices?.[0]?.message?.content ?? "").trim() };
  }
  const j = await json(await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent?key=${encodeURIComponent(c.key)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_HINT }] }, contents: [{ role: "user", parts: [{ text: question }] }] }),
  }));
  return { model: c.model, answer: (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join("").trim() };
}

/** Demo answers from our server (limited per day) for people without a key — and for app reviewers. */
export async function askDemo(question: string) {
  return api<{ answer: string; model: string }>("POST", "/circles/demo-answer", { question });
}
