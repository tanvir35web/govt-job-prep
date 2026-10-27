// Validates pasted subject JSON. Shared by the admin UI (instant feedback) and the
// admin upload API (authoritative check), so it must stay free of server-only imports.
import { shortHash, slugify } from "./exam-validation";
import type { SubjectInfo, SubjectQuestion, TopicSummary } from "./types";

export type SubjectPayload = { subject_info: SubjectInfo; questions: SubjectQuestion[] };

export type SubjectValidationResult =
  | { ok: true; data: SubjectPayload; warnings: string[] }
  | { ok: false; errors: string[] };

const MAX_ERRORS = 20;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isPositiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

export function validateSubjectPayload(input: unknown): SubjectValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(input)) return { ok: false, errors: ["The JSON must be an object ({ ... })."] };

  const info = input.subject_info;
  if (!isObject(info)) {
    errors.push("`subject_info` is missing or is not an object.");
  } else {
    if (!isNonEmptyString(info.name)) errors.push("subject_info.name is empty or not text.");
    if (info.description !== undefined && typeof info.description !== "string") errors.push("subject_info.description must be text.");
  }

  const questions = input.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push("`questions` must be a non-empty array.");
  } else {
    // Each lecture sheet numbers its questions from 1, so numbers only need to be unique within a topic.
    const seen = new Set<string>();
    questions.forEach((q, i) => {
      if (errors.length >= MAX_ERRORS) return;
      const at = `questions[${i}]`;
      if (!isObject(q)) {
        errors.push(`${at} is not an object.`);
        return;
      }
      const label = isPositiveInt(q.question_no) ? `Question ${q.question_no}` : at;
      // The topic list is built from this field, so every question needs one.
      if (!isNonEmptyString(q.topic)) errors.push(`${label}: topic is empty.`);
      if (!isPositiveInt(q.question_no)) errors.push(`${at}.question_no must be a positive integer.`);
      else if (isNonEmptyString(q.topic)) {
        const key = subjectQuestionKey({ topic: cleanTopic(q.topic), question_no: q.question_no });
        if (seen.has(key)) errors.push(`${label}: question_no is duplicated in topic "${cleanTopic(q.topic)}".`);
        else seen.add(key);
      }

      if (!isNonEmptyString(q.question)) errors.push(`${label}: question is empty.`);
      if (q.explanation !== undefined && typeof q.explanation !== "string") errors.push(`${label}: explanation must be text.`);

      if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(isNonEmptyString)) {
        errors.push(`${label}: options must contain at least 2 non-empty text values.`);
      } else {
        if (!isNonEmptyString(q.correct_answer)) errors.push(`${label}: correct_answer is empty.`);
        else if (!q.options.includes(q.correct_answer)) errors.push(`${label}: correct_answer does not exactly match any of the options.`);
      }
    });
  }

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, MAX_ERRORS) };

  // Re-build the objects so only known fields are stored.
  const i = info as Record<string, unknown>;
  const data: SubjectPayload = {
    subject_info: {
      name: String(i.name).trim(),
      description: typeof i.description === "string" ? i.description.trim() : "",
    },
    questions: groupByTopic(
      (questions as Record<string, unknown>[]).map((q) => ({
        question_no: q.question_no as number,
        topic: cleanTopic(String(q.topic)),
        question: String(q.question).trim(),
        options: q.options as string[],
        correct_answer: q.correct_answer as string,
        explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
      })),
    ),
  };

  return { ok: true, data, warnings };
}

// "বাস্তব সংখ্যা  - ২" and "বাস্তব সংখ্যা - ২" are the same topic.
function cleanTopic(topic: string) {
  return topic.trim().replace(/\s+/g, " ");
}

/** Identifies a question within a subject: numbers restart in every topic. Also the key for saved answers. */
export function subjectQuestionKey(q: Pick<SubjectQuestion, "topic" | "question_no">) {
  return `${q.topic}#${q.question_no}`;
}

/** Topics in first-seen order, questions by number within each topic. */
function groupByTopic(questions: SubjectQuestion[]): SubjectQuestion[] {
  const order = new Map<string, number>();
  for (const q of questions) if (!order.has(q.topic)) order.set(q.topic, order.size);
  return [...questions].sort((a, b) => order.get(a.topic)! - order.get(b.topic)! || a.question_no - b.question_no);
}

/**
 * Adds an uploaded file to a subject: every topic in the upload replaces that topic's questions,
 * other topics stay as they are. Replaced topics keep their place in the list; new ones go at the end.
 */
export function mergeSubjectQuestions(existing: SubjectQuestion[], incoming: SubjectQuestion[]): SubjectQuestion[] {
  const incomingTopics = new Set(incoming.map((q) => q.topic));
  const order = [...new Set([...existing.map((q) => q.topic), ...incoming.map((q) => q.topic)])];
  const rank = new Map(order.map((t, i) => [t, i]));
  const kept = existing.filter((q) => !incomingTopics.has(q.topic));
  return [...kept, ...incoming].sort((a, b) => rank.get(a.topic)! - rank.get(b.topic)! || a.question_no - b.question_no);
}

/** Topics in the order they first appear in the questions, with a count each. */
export function buildTopics(questions: Pick<SubjectQuestion, "topic">[]): TopicSummary[] {
  const counts = new Map<string, number>();
  for (const q of questions) counts.set(q.topic, (counts.get(q.topic) ?? 0) + 1);
  return [...counts.entries()].map(([name, total_questions]) => ({ name, total_questions }));
}

// English slugs for the usual job-exam subjects. Keys are compared without spaces.
const KNOWN_SLUGS: Record<string, string> = {
  বাংলা: "bangla",
  বাংলাভাষাওসাহিত্য: "bangla",
  ইংরেজি: "english",
  ইংরেজিভাষাওসাহিত্য: "english",
  গণিত: "math",
  সাধারণগণিত: "math",
  গাণিতিকযুক্তি: "math",
  সাধারণজ্ঞান: "general",
  বাংলাদেশবিষয়াবলি: "bangladesh-affairs",
  বাংলাদেশবিষয়াবলী: "bangladesh-affairs",
  আন্তর্জাতিকবিষয়াবলি: "international-affairs",
  আন্তর্জাতিকবিষয়াবলী: "international-affairs",
  সাধারণবিজ্ঞান: "science",
  বিজ্ঞান: "science",
  ভূগোল: "geography",
  ভূগোলপরিবেশওদুর্যোগব্যবস্থাপনা: "geography",
  মানসিকদক্ষতা: "mental-ability",
  কম্পিউটার: "ict",
  কম্পিউটারওতথ্যপ্রযুক্তি: "ict",
  তথ্যওযোগাযোগপ্রযুক্তি: "ict",
  নৈতিকতামূল্যবোধওসুশাসন: "ethics",
};

/** Suggested slug: a known subject's English slug ("গণিত" -> "math"), otherwise the name transliterated. The admin can still edit it. */
export function deriveSubjectSlug(info: Pick<SubjectInfo, "name">): string {
  const key = info.name.normalize("NFC").replace(/[\s,]+/g, "");
  return KNOWN_SLUGS[key] ?? (slugify(transliterateBengali(info.name)) || `subject-${shortHash(info.name)}`);
}

// ---- Bengali to Latin, only for building slugs. Rough and readable, not a scholarly romanisation.

const CONSONANTS: Record<string, string> = {
  ক: "k", খ: "kh", গ: "g", ঘ: "gh", ঙ: "ng", চ: "c", ছ: "ch", জ: "j", ঝ: "jh", ঞ: "n",
  ট: "t", ঠ: "th", ড: "d", ঢ: "dh", ণ: "n", ত: "t", থ: "th", দ: "d", ধ: "dh", ন: "n",
  প: "p", ফ: "f", ব: "b", ভ: "bh", ম: "m", য: "j", র: "r", ল: "l", শ: "sh", ষ: "sh",
  স: "s", হ: "h", ৎ: "t",
};

// ড়, ঢ় and য় are always a letter plus a nukta after Unicode normalisation (they never compose).
const NUKTA = "়";
const NUKTA_CONSONANTS: Record<string, string> = { ড: "r", ঢ: "rh", য: "y" };

const VOWELS: Record<string, string> = {
  অ: "o", আ: "a", ই: "i", ঈ: "i", উ: "u", ঊ: "u", ঋ: "ri", এ: "e", ঐ: "oi", ও: "o", ঔ: "ou",
};

const VOWEL_SIGNS: Record<string, string> = {
  "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ৃ": "ri", "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou",
};

const MARKS: Record<string, string> = { "ং": "ng", "ঃ": "h", "ঁ": "" };
const HASANTA = "্";
const DIGITS = "০১২৩৪৫৬৭৮৯";

function transliterateBengali(text: string): string {
  // NFC splits ড়/ঢ়/য় into letter + nukta whichever way they were typed, so one lookup covers both.
  const chars = Array.from(text.normalize("NFC"));
  let out = "";
  chars.forEach((ch, i) => {
    const hasNukta = chars[i + 1] === NUKTA && NUKTA_CONSONANTS[ch] !== undefined;
    const next = chars[hasNukta ? i + 2 : i + 1];
    if (ch === NUKTA) return;
    if (CONSONANTS[ch] !== undefined) {
      out += hasNukta ? NUKTA_CONSONANTS[ch] : CONSONANTS[ch];
      // The inherent vowel, unless a vowel sign or hasanta follows, or the word ends here.
      const wordEnds = next === undefined || !/[ঀ-৿]/.test(next);
      if (!wordEnds && next !== HASANTA && VOWEL_SIGNS[next] === undefined && ch !== "ৎ") out += "o";
    } else if (VOWELS[ch] !== undefined) out += VOWELS[ch];
    else if (VOWEL_SIGNS[ch] !== undefined) out += VOWEL_SIGNS[ch];
    else if (MARKS[ch] !== undefined) out += MARKS[ch];
    else if (DIGITS.includes(ch)) out += String(DIGITS.indexOf(ch));
    else if (ch !== HASANTA) out += ch;
  });
  return out;
}
