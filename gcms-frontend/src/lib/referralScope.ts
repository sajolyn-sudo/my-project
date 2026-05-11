import type { AuthUser, Role } from "../types/auth";

const REFERRAL_CREATOR_ROLES: Role[] = [
  "TEACHER",
  "NON_TEACHING_PERSONNEL",
];

const REFERRAL_TARGET_ROLES: Role[] = [
  "STUDENT",
  "TEACHER",
  "NON_TEACHING_PERSONNEL",
];

function normalizeRole(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function canCreateSystemReferral(
  user?: Pick<AuthUser, "role"> | null,
): boolean {
  return !!user && REFERRAL_CREATOR_ROLES.includes(user.role);
}

export function isSupportedReferralTargetRole(role?: unknown): boolean {
  const normalized = normalizeRole(role);
  return REFERRAL_TARGET_ROLES.includes(normalized as Role);
}

export function isSupportedReferralTargetUser(
  user?: { role?: unknown } | null,
): boolean {
  return isSupportedReferralTargetRole(user?.role);
}
