import { API_URL } from "./config";

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(t: string | null) {
  token = t;
}
export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = any>(method: string, path: string, body?: unknown, opts: { raw?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        "content-type": opts.raw ? "text/plain" : "application/json",
      },
      body: body === undefined ? undefined : opts.raw ? String(body) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let data: any = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* plain text */ }
  if (res.status === 401 && token) onUnauthorized?.();
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `Something went wrong (${res.status})`);
  return data as T;
}
