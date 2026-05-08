import type { AuthUser } from "../types/auth";

const CARISSA_APPROVER_ID = 5;
const CARISSA_APPROVER_EMAIL = "carissa.e@bisu.edu.ph";

function normalizeText(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function isCarissaReferralApprover(
  user?: Pick<AuthUser, "id" | "email" | "fname" | "lname" | "role"> | null,
): boolean {
  if (!user || user.role !== "STAFF") return false;

  const email = normalizeText(user.email);
  const fname = normalizeText(user.fname);
  const lname = normalizeText(user.lname);

  return (
    Number(user.id) === CARISSA_APPROVER_ID ||
    email === CARISSA_APPROVER_EMAIL ||
    (fname === "carissa" && lname === "estapia")
  );
}

export function canApproveSystemReferrals(
  user?: Pick<AuthUser, "id" | "email" | "fname" | "lname" | "role"> | null,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return isCarissaReferralApprover(user);
}
