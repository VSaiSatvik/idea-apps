/**
 * Tiny JSON persistence for the in-memory engines.
 * Snapshots Maps/Sets/class instances to DATA_DIR/<name>.json (debounced) and
 * restores them into a freshly constructed object of the same class.
 * Good enough for a pilot on one server; move to Postgres before scale.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data");

function replacer(_k: string, v: unknown) {
  if (v instanceof Map) return { __map: [...v.entries()] };
  if (v instanceof Set) return { __set: [...v.values()] };
  return v;
}
function reviver(_k: string, v: any) {
  if (v && typeof v === "object" && "__map" in v) return new Map(v.__map);
  if (v && typeof v === "object" && "__set" in v) return new Set(v.__set);
  return v;
}

/** Copy saved fields onto a live object, keeping class instances (e.g. a Ledger inside a Store). */
function assignDeep(target: any, data: any) {
  for (const [k, v] of Object.entries(data)) {
    const cur = target[k];
    const isPlainClass = cur && typeof cur === "object" && !(cur instanceof Map) && !(cur instanceof Set) && !Array.isArray(cur) && Object.getPrototypeOf(cur) !== Object.prototype;
    if (isPlainClass && v && typeof v === "object") assignDeep(cur, v);
    else target[k] = v;
  }
}

export interface Persisted<T> {
  value: T;
  save: () => void;
  flush: () => void;
}

export function persisted<T extends object>(name: string, make: () => T, opts: { disabled?: boolean } = {}): Persisted<T> {
  const value = make();
  const file = join(DATA_DIR, `${name}.json`);
  const off = opts.disabled || process.env.PERSIST === "off";
  if (!off && existsSync(file)) {
    try {
      assignDeep(value, JSON.parse(readFileSync(file, "utf8"), reviver));
    } catch (e) {
      console.error(`could not load ${file}:`, (e as Error).message);
    }
  }
  let timer: NodeJS.Timeout | null = null;
  const flush = () => {
    if (off) return;
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(file + ".tmp", JSON.stringify(value, replacer));
    renameSync(file + ".tmp", file);
  };
  const save = () => {
    if (off) return;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, 250);
  };
  return { value, save, flush };
}
