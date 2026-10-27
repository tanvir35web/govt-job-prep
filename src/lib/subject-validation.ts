// Validates pasted subject JSON. Shared by the admin UI (instant feedback) and the
// admin upload API (authoritative check), so it must stay free of server-only imports.
//
// Upload format: one lecture sheet per object, its topic given once in subject_info. Each is stored as is,
// one database document per topic (src/models/Subject.ts):
//   { "subject_info": { "name": "সাধারণ জ্ঞান", "topic": "Parts of Speech" }, "questions": [{ "question_no": 1, ... }] }
// An array of these uploads several topics of one subject at once (the whole-subject edit uses it).
import { shortHash, slugify } from "./exam-validation";
import type { SubjectInfo, SubjectQuestion, SubjectTopic, TopicSummary } from "./types";

export type SubjectPayload = { subject_info: SubjectInfo; topics: SubjectTopic[] };

/** One lecture sheet in the upload format. */
export type TopicFile = {
  subject_info: { name: string; topic: string; description?: string };
  questions: SubjectTopic["questions"];
};

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

  const blocks = Array.isArray(input) ? input : [input];
  if (blocks.length === 0) return { ok: false, errors: ["The JSON array is empty."] };
  if (!blocks.every(isObject)) return { ok: false, errors: ["The JSON must be an object ({ ... }) or an array of them."] };

  // Each lecture sheet numbers its questions from 1, so numbers only need to be unique within a topic.
  const seen = new Set<string>();
  // Topics in first-seen order; the same topic in two objects is one topic.
  const topicsOut = new Map<string, SubjectTopic["questions"]>();
  let name = "";
  let description = "";

  blocks.forEach((block, b) => {
    if (errors.length >= MAX_ERRORS) return;
    // In an array, every message says which object it is about.
    const where = blocks.length > 1 ? `[${b}] ` : "";

    const info = block.subject_info;
    if (!isObject(info)) {
      errors.push(`${where}\`subject_info\` is missing or is not an object.`);
      return;
    }
    if (!isNonEmptyString(info.name)) errors.push(`${where}subject_info.name is empty or not text.`);
    else if (!name) name = info.name.trim();
    else if (info.name.trim() !== name) errors.push(`${where}subject_info.name "${info.name.trim()}" differs from "${name}". Upload one subject at a time.`);
    if (info.description !== undefined && typeof info.description !== "string") errors.push(`${where}subject_info.description must be text.`);
    else if (!description && typeof info.description === "string") description = info.description.trim();

    // The topic list is built from this field, so every lecture sheet needs one.
    if (!isNonEmptyString(info.topic)) {
      errors.push(`${where}subject_info.topic is empty or not text.`);
      return;
    }
    const topic = cleanTopic(info.topic);

    const questions = block.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      errors.push(`${where}\`questions\` must be a non-empty array.`);
      return;
    }
    questions.forEach((q, i) => {
      if (errors.length >= MAX_ERRORS) return;
      const at = `${where}questions[${i}]`;
      if (!isObject(q)) {
        errors.push(`${at} is not an object.`);
        return;
      }
      const label = isPositiveInt(q.question_no) ? `${where}Question ${q.question_no}` : at;

      if (q.topic !== undefined && (!isNonEmptyString(q.topic) || cleanTopic(q.topic) !== topic)) {
        errors.push(`${label}: topic differs from subject_info.topic. Remove it from the question.`);
      }

      if (!isPositiveInt(q.question_no)) errors.push(`${at}.question_no must be a positive integer.`);
      else {
        const key = subjectQuestionKey({ topic, question_no: q.question_no });
        if (seen.has(key)) errors.push(`${label}: question_no is duplicated in topic "${topic}".`);
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

      // Re-build the object so only known fields are stored. Discarded if anything above failed.
      if (!topicsOut.has(topic)) topicsOut.set(topic, []);
      topicsOut.get(topic)!.push({
        question_no: q.question_no as number,
        question: String(q.question).trim(),
        options: q.options as string[],
        correct_answer: q.correct_answer as string,
        explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
      });
    });
  });

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, MAX_ERRORS) };

  const topics = [...topicsOut].map(([topic, qs]) => ({ name: topic, questions: qs.sort((a, b) => a.question_no - b.question_no) }));
  return { ok: true, data: { subject_info: { name, description }, topics }, warnings };
}

/** A subject's name and description from its topic documents (in topic order): the first description given wins. */
export function subjectInfoOf(files: { subject_info: { name: string; description?: string | null } }[]): SubjectInfo {
  return {
    name: files[0]?.subject_info.name ?? "",
    description: files.find((f) => f.subject_info.description)?.subject_info.description ?? "",
  };
}

/** Every question with its topic beside it, in topic order: the shape the public subject API returns. */
export function flattenTopics(topics: SubjectTopic[]): SubjectQuestion[] {
  return topics.flatMap((t) =>
    t.questions.map((q) => ({
      question_no: q.question_no,
      topic: t.name,
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
    })),
  );
}

export function countQuestions(topics: { questions: readonly unknown[] }[]) {
  return topics.reduce((n, t) => n + t.questions.length, 0);
}

// "বাস্তব সংখ্যা  - ২" and "বাস্তব সংখ্যা - ২" are the same topic.
function cleanTopic(topic: string) {
  return topic.trim().replace(/\s+/g, " ");
}

/** Identifies a question within a subject: numbers restart in every topic. Also the key for saved answers. */
export function subjectQuestionKey(q: Pick<SubjectQuestion, "topic" | "question_no">) {
  return `${q.topic}#${q.question_no}`;
}

/** The topic list with a question count each. */
export function buildTopics(topics: { name: string; questions: readonly unknown[] }[]): TopicSummary[] {
  return topics.map((t) => ({ name: t.name, total_questions: t.questions.length }));
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
