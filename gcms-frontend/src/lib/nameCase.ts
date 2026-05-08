export function toSentenceCaseNameInput(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, prefix: string, letter: string) => {
      return `${prefix}${letter.toUpperCase()}`;
    });
}

export function normalizeSentenceCaseName(value: string): string {
  return toSentenceCaseNameInput(value).trim().replace(/\s+/g, " ");
}
