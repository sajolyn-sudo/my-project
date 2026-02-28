import { create } from "zustand";
import type { AuthUser, Role } from "../types/auth";
import { postJSON } from "../lib/api";

type ApiUser = {
  users_id: number;
  fname: string;
  mname: string | null;
  lname: string;
  email: string;
  role: string; // "ADMIN" | "COUNSELOR" | "STUDENT"
  created_at?: string;
  updated_at?: string;
};

type AuthState = {
  user: AuthUser | null;
  loginWithApi: (
    email: string,
  ) => Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }>;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
};

const AUTH_KEY = "gcms_auth_user_v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export const useAuthStore = create<AuthState>((set) => ({
  user: load<AuthUser | null>(AUTH_KEY, null),

  setUser: (user) => {
    if (user) save(AUTH_KEY, user);
    else localStorage.removeItem(AUTH_KEY);
    set({ user });
  },

  loginWithApi: async (email) => {
    const clean = String(email || "").trim();
    if (!clean) return { ok: false, message: "Please enter your email." };

    try {
      const data = await postJSON<{ ok: boolean; user: ApiUser }>("/login", {
        email: clean,
      });

      const role = String(data.user?.role || "").toUpperCase() as Role;

      const authUser: AuthUser = {
        id: data.user.users_id,
        fname: data.user.fname,
        lname: data.user.lname,
        email: data.user.email,
        role,
      };

      save(AUTH_KEY, authUser);
      set({ user: authUser });

      return { ok: true, user: authUser };
    } catch (e: any) {
      return { ok: false, message: e?.message || "Login failed" };
    }
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
    set({ user: null });
  },
}));
