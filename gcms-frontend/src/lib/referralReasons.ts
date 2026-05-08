export const OTHER_REFERRAL_REASON_LABEL = "Others (Specify in Notes)";

export const DEFAULT_REFERRAL_REASON_OPTIONS = [
  "Academics",
  "Attendance and Tardiness",
  "Adjustment",
  "Behavioral Problems",
  "Bullying",
  "Career Choice",
  "Depression",
  "Discipline",
  "Drugs/Drug Abuse",
  "Early Pregnancy",
  "Family Conflicts",
  "Financial",
  "Health",
  "Loss/Death",
  "Love and Relationships",
  "Motivation",
  "Phobia, Panic and Anxiety",
  "Prejudice and Discrimination",
  "Premarital Sex/Sex",
  "Single Parenting/Early Parenthood",
  "Social Relations",
  "Stress",
  "Study Habits",
  "Time Management",
  OTHER_REFERRAL_REASON_LABEL,
] as const;

export function normalizeReferralReasonLabel(value: string): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeReferralReasonKey(value: string): string {
  return normalizeReferralReasonLabel(value).toLowerCase();
}

export function mergeReferralReasonOptions(values: string[]): string[] {
  const defaultWithoutOther = DEFAULT_REFERRAL_REASON_OPTIONS.filter(
    (value) => value !== OTHER_REFERRAL_REASON_LABEL,
  );
  const custom: string[] = [];
  const seen = new Set<string>();
  const input = values.map(normalizeReferralReasonLabel).filter(Boolean);

  for (const reason of input) {
    const key = normalizeReferralReasonKey(reason);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const defaultMatch = DEFAULT_REFERRAL_REASON_OPTIONS.find(
      (value) => normalizeReferralReasonKey(value) === key,
    );
    if (!defaultMatch) custom.push(reason);
  }

  const orderedDefaults = defaultWithoutOther.filter((value) =>
    seen.has(normalizeReferralReasonKey(value)),
  );

  custom.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return [...orderedDefaults, ...custom, OTHER_REFERRAL_REASON_LABEL];
}

export function extractCustomReferralReasonsFromNotes(notes: string): string[] {
  const parts = String(notes || "")
    .split(/[\r\n,;|]+/)
    .map(normalizeReferralReasonLabel)
    .filter(Boolean)
    .filter(
      (value) =>
        normalizeReferralReasonKey(value) !==
        normalizeReferralReasonKey(OTHER_REFERRAL_REASON_LABEL),
    );

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const reason of parts) {
    const key = normalizeReferralReasonKey(reason);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(reason);
  }
  return unique;
}

export function buildReferralReasonPayload(
  selectedReasons: string[],
  notes: string,
): {
  reasonText: string;
  storedReasons: string[];
  customReasons: string[];
  missingCustomReason: boolean;
} {
  const normalizedSelected = selectedReasons
    .map(normalizeReferralReasonLabel)
    .filter(Boolean);
  const hasOther = normalizedSelected.some(
    (value) =>
      normalizeReferralReasonKey(value) ===
      normalizeReferralReasonKey(OTHER_REFERRAL_REASON_LABEL),
  );
  const customReasons = hasOther
    ? extractCustomReferralReasonsFromNotes(notes)
    : [];
  const selectedWithoutOther = normalizedSelected.filter(
    (value) =>
      normalizeReferralReasonKey(value) !==
      normalizeReferralReasonKey(OTHER_REFERRAL_REASON_LABEL),
  );

  const storedReasons = mergeReferralReasonOptions([
    ...selectedWithoutOther,
    ...customReasons,
    ...(hasOther && customReasons.length === 0 ? [OTHER_REFERRAL_REASON_LABEL] : []),
  ]).filter((value) => {
    if (value !== OTHER_REFERRAL_REASON_LABEL) return true;
    return hasOther && customReasons.length === 0;
  });

  return {
    reasonText: storedReasons.join(", "),
    storedReasons,
    customReasons,
    missingCustomReason: hasOther && customReasons.length === 0,
  };
}
