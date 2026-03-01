import { create } from "zustand";
import type { AuthUser, Role } from "../types/auth";
import { postJSON } from "../lib/api";
import { useGCMS, type UserType } from "./gcmsStore";

type ApiUser = {
  id?: number;
  users_id?: number;
  fname: string;
  mname: string | null;
  lname: string;
  email: string;
  role: string; // "ADMIN" | "COUNSELOR" | "TEACHER" | "NON_TEACHING_PERSONNEL" | "STUDENT"
  profilePhoto?: string | null;
  profile_photo?: string | null;
  created_at?: string;
  updated_at?: string;
};

type AuthState = {
  user: AuthUser | null;
  loginWithApi: (
    identifier: string,
    password: string,
  ) => Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }>;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
};

const AUTH_KEY = "gcms_auth_user_v1";

function toLegacyUserType(role: Role): UserType {
  if (role === "ADMIN") return "admin";
  if (
    role === "COUNSELOR" ||
    role === "TEACHER" ||
    role === "NON_TEACHING_PERSONNEL"
  ) {
    return "counselor";
  }
  return "student";
}

function normalizeRole(raw: string): Role | null {
  const role = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (role === "NON_TEACHING" || role === "NON_TEACHING_STAFF") {
    return "NON_TEACHING_PERSONNEL";
  }
  if (
    role === "ADMIN" ||
    role === "COUNSELOR" ||
    role === "TEACHER" ||
    role === "NON_TEACHING_PERSONNEL" ||
    role === "STUDENT"
  ) {
    return role;
  }
  return null;
}

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

  loginWithApi: async (identifier, password) => {
    const clean = String(identifier || "").trim();
    const cleanPassword = String(password || "");
    if (!clean) return { ok: false, message: "Please enter your username." };
    if (!cleanPassword)
      return { ok: false, message: "Please enter your password." };

    try {
      const data = await postJSON<{ ok: boolean; user: ApiUser }>(
        "/login.php",
        {
          identifier: clean,
          username: clean,
          email: clean,
          password: cleanPassword,
        },
      );

      const role = normalizeRole(String(data.user?.role || ""));
      const id = Number(data.user.users_id ?? data.user.id ?? 0);

      if (!id || !role) {
        return { ok: false, message: "Invalid login response from API." };
      }

      const fname = String(data.user.fname || "").trim();
      const lname = String(data.user.lname || "").trim();
      const emailOut = String(data.user.email || "").trim();
      const profilePhoto = String(
        data.user.profilePhoto ?? data.user.profile_photo ?? "",
      ).trim();

      const authUser: AuthUser = {
        id,
        fname,
        lname,
        email: emailOut,
        role,
        profilePhoto: profilePhoto || undefined,
      };

      // Bridge auth data to legacy useGCMS store (student pages still consume it).
      const gcms = useGCMS.getState();
      const legacyUser = {
        users_id: authUser.id,
        user_type: toLegacyUserType(authUser.role),
        fname: authUser.fname,
        lname: authUser.lname,
        email: authUser.email,
      } as const;

      gcms.setUsers((prev) => {
        const idx = prev.findIndex((u) => u.users_id === legacyUser.users_id);
        if (idx === -1) return [legacyUser, ...prev];
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...legacyUser };
        return copy;
      });
      gcms.setCurrentUser(legacyUser);

      save(AUTH_KEY, authUser);
      set({ user: authUser });

      return { ok: true, user: authUser };
    } catch (e: any) {
      return { ok: false, message: e?.message || "Login failed" };
    }
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
    useGCMS.getState().logout();
    set({ user: null });
  },
}));
