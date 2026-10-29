// The question bank behind the mock exam: every exam's questions with duplicates removed. Built on the
// server for /api/questions, and on the client from saved exams when offline, so it must stay free of
// server-only and client-only code.
import type { Question } from "./types";

export type BankQuestion = Question & { slug: string; examTitle: string; key: string };

/** Subjects with their question counts, largest first. */
export type BankSummary = { total: number; subjects: { name: string; count: number }[] };

/** The most questions one mock exam can ask (the largest marks option). */
export const MAX_DRAW = 100;

export function bankKey(slug: string, questionNo: number) {
  return `${slug}#${questionNo}`;
}

// The same question often appears in several papers; compare text without spacing or punctuation differences.
function fingerprint(q: Question) {
  return q.question.toLowerCase().replace(/[\s\p{P}]+/gu, "");
}

/** Exams in list order (newest first); a repeated question keeps its newest copy. */
export function buildBank(exams: { slug: string; title: string; questions: Question[] }[]): BankQuestion[] {
  const seen = new Set<string>();
  const bank: BankQuestion[] = [];
  for (const exam of exams) {
    for (const q of exam.questions) {
      const fp = fingerprint(q);
      if (seen.has(fp)) continue;
      seen.add(fp);
      bank.push({ ...q, slug: exam.slug, examTitle: exam.title, key: bankKey(exam.slug, q.question_no) });
    }
  }
  return bank;
}

export function summarise(bank: BankQuestion[]): BankSummary {
  const counts = new Map<string, number>();
  for (const q of bank) counts.set(q.subject, (counts.get(q.subject) ?? 0) + 1);
  const subjects = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { total: bank.length, subjects };
}

/** Up to count random questions from the given subjects (all when empty), in random order. */
export function draw(bank: BankQuestion[], count: number, subjects: string[]): BankQuestion[] {
  const wanted = new Set(subjects);
  const pool = wanted.size ? bank.filter((q) => wanted.has(q.subject)) : [...bank];
  const n = Math.min(count, pool.length);
  // Partial Fisher–Yates: only the first n places are shuffled.
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
