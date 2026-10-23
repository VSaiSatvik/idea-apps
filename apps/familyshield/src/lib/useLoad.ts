import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

/** Load data when the screen is focused; exposes reload + error for pull-to-refresh. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  const first = useRef(true);
  // reload when inputs change (the focus effect below covers the first load)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  return { data, error, loading, reload, setData };
}
