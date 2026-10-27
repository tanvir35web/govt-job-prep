// Validates pasted exam JSON. Shared by the admin UI (instant feedback) and the
// admin upload API (authoritative check), so it must stay free of server-only imports.
import type { ExamInfo, Question } from "./types";

export type ExamPayload = { exam_info: ExamInfo; questions: Question[] };

export type ValidationResult =
  | { ok: true; data: ExamPayload; warnings: string[] }
  | { ok: false; errors: string[] };

const MAX_ERRORS = 20;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isPositiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

export function validateExamPayload(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(input)) return { ok: false, errors: ["The JSON must be an object ({ ... })."] };

  const info = input.exam_info;
  if (!isObject(info)) {
    errors.push("`exam_info` is missing or is not an object.");
  } else {
    for (const key of ["exam_title", "organization", "exam_type", "exam_date"] as const) {
      if (!isNonEmptyString(info[key])) errors.push(`exam_info.${key} is empty or not text.`);
    }
    for (const key of ["total_marks", "total_questions"] as const) {
      if (!isPositiveInt(info[key])) errors.push(`exam_info.${key} must be a positive integer.`);
    }
    if (info.source_url !== undefined && info.source_url !== "" && !/^https?:\/\/\S+$/i.test(String(info.source_url))) {
      errors.push("exam_info.source_url must be an http/https link.");
    }
    if (isNonEmptyString(info.exam_date) && parseExamDate(info.exam_date) === null) {
      warnings.push(`exam_info.exam_date "${info.exam_date}" could not be read as a date; it will be sorted to the end of the list.`);
    }
  }

  const questions = input.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push("`questions` must be a non-empty array.");
  } else {
    const seen = new Set<number>();
    questions.forEach((q, i) => {
      if (errors.length >= MAX_ERRORS) return;
      const at = `questions[${i}]`;
      if (!isObject(q)) {
        errors.push(`${at} is not an object.`);
        return;
      }
      const label = isPositiveInt(q.question_no) ? `Question ${q.question_no}` : at;
      if (!isPositiveInt(q.question_no)) errors.push(`${at}.question_no must be a positive integer.`);
      else if (seen.has(q.question_no)) errors.push(`${label}: question_no is duplicated.`);
      else seen.add(q.question_no);

      if (!isNonEmptyString(q.subject)) errors.push(`${label}: subject is empty.`);
      if (!isNonEmptyString(q.question)) errors.push(`${label}: question is empty.`);
      if (q.topic !== undefined && typeof q.topic !== "string") errors.push(`${label}: topic must be text.`);
      if (q.explanation !== undefined && typeof q.explanation !== "string") errors.push(`${label}: explanation must be text.`);

      if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(isNonEmptyString)) {
        errors.push(`${label}: options must contain at least 2 non-empty text values.`);
      } else {
        // Duplicate options are allowed: some source papers genuinely repeat an option.
        if (!isNonEmptyString(q.correct_answer)) errors.push(`${label}: correct_answer is empty.`);
        else if (!q.options.includes(q.correct_answer)) errors.push(`${label}: correct_answer does not exactly match any of the options.`);
      }
    });

    if (isObject(info) && isPositiveInt(info.total_questions) && info.total_questions !== questions.length) {
      warnings.push(`exam_info.total_questions is ${info.total_questions}, but questions has ${questions.length}.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, MAX_ERRORS) };

  // Re-build the objects so only known fields are stored.
  const i = info as Record<string, unknown>;
  const data: ExamPayload = {
    exam_info: {
      exam_title: String(i.exam_title).trim(),
      organization: String(i.organization).trim(),
      exam_type: String(i.exam_type).trim(),
      exam_date: String(i.exam_date).trim(),
      total_marks: i.total_marks as number,
      total_questions: i.total_questions as number,
      source_url: typeof i.source_url === "string" ? i.source_url.trim() : "",
    },
    questions: (questions as Record<string, unknown>[])
      .map((q) => ({
        question_no: q.question_no as number,
        subject: String(q.subject).trim(),
        topic: typeof q.topic === "string" ? q.topic.trim() : "",
        question: String(q.question).trim(),
        options: q.options as string[],
        correct_answer: q.correct_answer as string,
        explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
      }))
      .sort((a, b) => a.question_no - b.question_no),
  };

  return { ok: true, data, warnings };
}

// "15 October, 2026" -> Date (UTC midnight). Returns null when unparseable.
export function parseExamDate(value: string): Date | null {
  const parsed = new Date(`${value.replace(",", "")} UTC`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// https://bdniyog.com/moca/sub-assistant-engineer-15-10-2026 -> "moca-sub-assistant-engineer-15-10-2026"
export function deriveSlug(info: Pick<ExamInfo, "source_url" | "exam_title" | "exam_date">): string {
  try {
    const fromUrl = slugify(new URL(info.source_url).pathname);
    if (fromUrl) return fromUrl;
  } catch {
    // No usable source_url; fall through.
  }
  const date = parseExamDate(info.exam_date)?.toISOString().slice(0, 10) ?? "undated";
  return `exam-${date}-${shortHash(info.exam_title)}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function shortHash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Fields written to MongoDB for an exam (used by the admin upload API).
export function toExamDocument(slug: string, payload: ExamPayload) {
  return {
    slug,
    exam_info: payload.exam_info,
    questions: payload.questions,
    exam_date_sort: parseExamDate(payload.exam_info.exam_date),
  };
}
