export const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export function formatNumber(value: number | string): string {
  return typeof value === "number" ? value.toLocaleString("en-AU") : value;
}

/** "1 question", "12 questions". Pass the plural when it is not just singular + "s". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

// "15 October, 2026" -> "15 October 2026"
export function formatExamDate(date: string): string {
  return date.replace(",", "");
}

// First letter of a name, keeping Bengali vowel signs attached (so "যুব" gives "যু", not a bare consonant).
export function firstLetter(text: string): string {
  const trimmed = text.trim();
  if (typeof Intl.Segmenter === "function") {
    const first = new Intl.Segmenter("bn", { granularity: "grapheme" }).segment(trimmed)[Symbol.iterator]().next().value;
    if (first) return first.segment;
  }
  return Array.from(trimmed)[0] ?? "";
}
