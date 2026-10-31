"use client";

import type { MockQuestion } from "./types";

// Timed mock exams built from random questions sampled directly on the backend. Everything stays on the device:
// the last settings, an exam in progress (so it survives the app being closed), and recent results.

export const MARK_OPTIONS = [10, 20, 30, 50, 100] as const;
export const SECOND_OPTIONS = [30, 40, 50, 60, 90] as const;

export type MockConfig = {
  /** Number of questions; each is worth one mark. */
  count: number;
  /** Seconds allowed per question. */
  seconds: number;
  /** Subjects to draw from; empty means all. */
  subjects: string[];
};

export const DEFAULT_CONFIG: MockConfig = { count: 20, seconds: 40, subjects: [] };

/** Points at a question in the bank: the exam it came from and its number there. */
export type MockItem = { slug: string; questionNo: number };

export type MockSession = {
  config: MockConfig;
  questions: MockQuestion[];
  /** Chosen option per item; null when skipped or timed out. */
  answers: (string | null)[];
  index: number;
  /** When the current question's time runs out (ms since epoch). */
  deadline: number;
  startedAt: number;
};

export type MockResult = {
  finishedAt: number;
  durationMs: number;
  config: MockConfig;
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
};

const CONFIG_KEY = "mock-config";
const SESSION_KEY = "mock-session";
const HISTORY_KEY = "mock-history";
const HISTORY_LIMIT = 10;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode etc.); the exam still works, it just is not remembered.
  }
}

export function loadConfig(): MockConfig {
  const saved = readJson<Partial<MockConfig>>(CONFIG_KEY);
  return {
    count: MARK_OPTIONS.includes(saved?.count as never) ? (saved!.count as number) : DEFAULT_CONFIG.count,
    seconds: SECOND_OPTIONS.includes(saved?.seconds as never) ? (saved!.seconds as number) : DEFAULT_CONFIG.seconds,
    subjects: Array.isArray(saved?.subjects) ? saved.subjects.filter((s): s is string => typeof s === "string") : [],
  };
}

export const saveConfig = (config: MockConfig) => writeJson(CONFIG_KEY, config);

export function loadSession(): MockSession | null {
  const s = readJson<MockSession>(SESSION_KEY);
  const valid =
    s &&
    Array.isArray(s.questions) &&
    s.questions.length > 0 &&
    Array.isArray(s.answers) &&
    s.questions.length === s.answers.length &&
    s.index >= 0 &&
    s.index < s.questions.length;
  return valid ? s : null;
}

export const saveSession = (session: MockSession | null) => writeJson(SESSION_KEY, session);

export function loadHistory(): MockResult[] {
  const h = readJson<MockResult[]>(HISTORY_KEY);
  return Array.isArray(h) ? h : [];
}

export function addToHistory(result: MockResult) {
  writeJson(HISTORY_KEY, [result, ...loadHistory()].slice(0, HISTORY_LIMIT));
}

export const clearHistory = () => writeJson(HISTORY_KEY, null);

export function buildMockExamApiUrl(config: MockConfig): string {
  const params = new URLSearchParams();
  params.set("marks", String(config.count));
  if (config.subjects.length > 0) {
    params.set("subjects", config.subjects.join(","));
  }
  return `/api/mock-exam?${params.toString()}`;
}

/** Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}
