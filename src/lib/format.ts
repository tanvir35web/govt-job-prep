const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

const BN_MONTHS: Record<string, string> = {
  january: "জানুয়ারি",
  february: "ফেব্রুয়ারি",
  march: "মার্চ",
  april: "এপ্রিল",
  may: "মে",
  june: "জুন",
  july: "জুলাই",
  august: "আগস্ট",
  september: "সেপ্টেম্বর",
  october: "অক্টোবর",
  november: "নভেম্বর",
  december: "ডিসেম্বর",
};

export const OPTION_LABELS = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];

export function toBn(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

// "15 October, 2026" -> "১৫ অক্টোবর ২০২৬"
export function formatExamDate(date: string): string {
  const translated = date.replace(/[A-Za-z]+/g, (word) => BN_MONTHS[word.toLowerCase()] ?? word).replace(",", "");
  return toBn(translated);
}
