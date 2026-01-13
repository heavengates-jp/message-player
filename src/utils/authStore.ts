import { create } from "zustand";

const STORAGE_KEY = "mp_auth";

const loadStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { accessToken?: string; expiresAt?: number };
    if (!parsed.accessToken || !parsed.expiresAt) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export type AuthState = {
  accessToken: string | null;
  expiresAt: number | null;
  userSub: string | null;
  userName: string | null;
  setToken: (token: string, expiresIn: number) => void;
  clear: () => void;
  setUser: (sub: string, name: string | null) => void;
};

const stored = loadStoredToken();

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: stored?.accessToken ?? null,
  expiresAt: stored?.expiresAt ?? null,
  userSub: null,
  userName: null,
  setToken: (token, expiresIn) => {
    const expiresAt = Date.now() + expiresIn * 1000;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: token, expiresAt }));
    }
    set({ accessToken: token, expiresAt });
  },
  setUser: (sub, name) => set({ userSub: sub, userName: name }),
  clear: () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    set({ accessToken: null, expiresAt: null, userSub: null, userName: null });
  }
}));