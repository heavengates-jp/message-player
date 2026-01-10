import { create } from "zustand";

export type AuthState = {
  accessToken: string | null;
  expiresAt: number | null;
  userSub: string | null;
  userName: string | null;
  setToken: (token: string, expiresIn: number) => void;
  clear: () => void;
  setUser: (sub: string, name: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  expiresAt: null,
  userSub: null,
  userName: null,
  setToken: (token, expiresIn) =>
    set({ accessToken: token, expiresAt: Date.now() + expiresIn * 1000 }),
  setUser: (sub, name) => set({ userSub: sub, userName: name }),
  clear: () => set({ accessToken: null, expiresAt: null, userSub: null, userName: null })
}));