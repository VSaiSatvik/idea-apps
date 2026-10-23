import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setOnUnauthorized, setToken } from "./api";
import { APP_ID } from "./config";
import { getSecret, setSecret } from "./storage";

export type User = { id: string; email: string; name: string; admin: boolean };

type AuthState = {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);
const KEY = `${APP_ID}.session`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const clear = useCallback(async () => {
    setToken(null);
    setUser(null);
    await setSecret(KEY, null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => { void clear(); });
    (async () => {
      const t = await getSecret(KEY);
      if (t) {
        setToken(t);
        try { setUser(await api<User>("GET", "/auth/me")); } catch { await clear(); }
      }
      setReady(true);
    })();
  }, [clear]);

  const finish = async (r: { token: string; user: User }) => {
    setToken(r.token);
    await setSecret(KEY, r.token);
    setUser(r.user);
  };

  const value = useMemo<AuthState>(() => ({
    ready,
    user,
    signIn: async (email, password) => finish(await api("POST", "/auth/login", { email, password, app: APP_ID })),
    signUp: async (name, email, password) => finish(await api("POST", "/auth/signup", { name, email, password, app: APP_ID })),
    signOut: clear,
    deleteAccount: async () => { await api("DELETE", "/auth/me"); await clear(); },
  }), [ready, user, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
