export function referralStatusLabel(status?: string): string {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === "pending" || normalized === "new") {
    return "Waiting for Approval";
  }

  return String(status || "");
}
