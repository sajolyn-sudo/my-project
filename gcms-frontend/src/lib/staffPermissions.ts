import type { AuthUser } from "../types/auth";

type PermissionUser =
  | Pick<AuthUser, "id" | "email" | "fname" | "lname" | "role">
  | null
  | undefined;

const CARISSA_STAFF_ID = 5;
const CARISSA_STAFF_EMAIL = "carissa.e@bisu.edu.ph";

function normalizeText(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function isCarissaEstapiaStaff(user: PermissionUser): boolean {
  if (!user || user.role !== "STAFF") return false;

  const email = normalizeText(user.email);
  const fname = normalizeText(user.fname);
  const lname = normalizeText(user.lname);

  return (
    Number(user.id) === CARISSA_STAFF_ID ||
    email === CARISSA_STAFF_EMAIL ||
    (fname === "carissa" && lname === "estapia")
  );
}

export function canViewReports(user: PermissionUser): boolean {
  return user?.role === "ADMIN" || isCarissaEstapiaStaff(user);
}

export function canUseGroupCounselling(user: PermissionUser): boolean {
  return user?.role === "ADMIN" || user?.role === "STAFF";
}

export function canCreateGroupCounselling(user: PermissionUser): boolean {
  return user?.role === "ADMIN" || isCarissaEstapiaStaff(user);
}
