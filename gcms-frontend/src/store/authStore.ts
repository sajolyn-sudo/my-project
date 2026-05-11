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
  role: string; // "ADMIN" | "STAFF" | "TEACHER" | "NON_TEACHING_PERSONNEL" | "STUDENT"
  profilePhoto?: string | null;
  profile_photo?: string | null;
  collegeId?: number | null;
  college_id?: number | null;
  yearLevelId?: number | null;
  year_level_id?: number | null;
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
    role === "STAFF" ||
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
  if (role === "COUNSELOR") return "STAFF";
  if (
    role === "ADMIN" ||
    role === "STAFF" ||
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getApiMessage(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const raw = payload.error ?? payload.message;
  if (typeof raw !== "string") return null;
  const msg = raw.trim();
  return msg || null;
}

function pickApiUser(payload: unknown): ApiUser | null {
  if (!isRecord(payload)) return null;

  if (isRecord(payload.user)) return payload.user as ApiUser;

  if (isRecord(payload.data)) {
    const nested = payload.data;
    if (isRecord(nested.user)) return nested.user as ApiUser;
    if ("users_id" in nested || "id" in nested) return nested as ApiUser;
  }

  if ("users_id" in payload || "id" in payload) return payload as ApiUser;
  return null;
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
      const data = await postJSON<unknown>(
        "/login.php",
        {
          identifier: clean,
          username: clean,
          email: clean,
          password: cleanPassword,
        },
      );

      if (isRecord(data) && data.ok === false) {
        return {
          ok: false,
          message: getApiMessage(data) || "Login failed",
        };
      }

      const apiUser = pickApiUser(data);
      if (!apiUser) {
        return {
          ok: false,
          message:
            getApiMessage(data) ||
            "Invalid login response from API. Please try again.",
        };
      }

      const role = normalizeRole(String(apiUser.role || ""));
      const id = Number(apiUser.users_id ?? apiUser.id ?? 0);

      if (!id || !role) {
        return { ok: false, message: "Invalid login response from API." };
      }

      const fname = String(apiUser.fname || "").trim();
      const lname = String(apiUser.lname || "").trim();
      const emailOut = String(apiUser.email || "").trim();
      const profilePhoto = String(
        apiUser.profilePhoto ?? apiUser.profile_photo ?? "",
      ).trim();

      const authUser: AuthUser = {
        id,
        fname,
        lname,
        email: emailOut,
        role,
        profilePhoto: profilePhoto || undefined,
        collegeId: Number(apiUser.collegeId ?? apiUser.college_id ?? 0) || undefined,
        yearLevelId:
          Number(apiUser.yearLevelId ?? apiUser.year_level_id ?? 0) || undefined,
      };

      // Bridge auth data to legacy useGCMS store (student pages still consume it).
      const gcms = useGCMS.getState();
      const legacyUser = {
        users_id: authUser.id,
        user_type: toLegacyUserType(authUser.role),
        fname: authUser.fname,
        lname: authUser.lname,
        email: authUser.email,
        collegeId: authUser.collegeId,
        yearLevelId: authUser.yearLevelId,
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
