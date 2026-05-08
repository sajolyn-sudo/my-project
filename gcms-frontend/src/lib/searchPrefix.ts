function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9@._-]+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function matchesSearchPrefix(
  query: string,
  ...fields: Array<string | number | null | undefined>
): boolean {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;

  return fields.some((field) => {
    const raw = String(field ?? "").trim().toLowerCase();
    if (!raw) return false;
    if (raw.startsWith(needle)) return true;
    return tokenize(raw).some((token) => token.startsWith(needle));
  });
}
