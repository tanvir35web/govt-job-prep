"use client";

import { useSyncExternalStore } from "react";
import type { Mode } from "@/components/QuestionCard";
import { THEME_KEY } from "./theme-script";

// Per-device preferences kept in localStorage. Each setting is a tiny external store so every
// component reading it re-renders when Settings changes it, without a context provider.

const CHANGE_EVENT = "app-settings-change";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode etc.); the choice applies until the page is closed.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function setting<T extends string>(key: string, values: readonly T[], fallback: T) {
  const get = (): T => {
    const raw = read(key);
    return values.includes(raw as T) ? (raw as T) : fallback;
  };
  return {
    get,
    set: (value: T) => write(key, value),
    use: () => useSyncExternalStore(subscribe, get, () => fallback),
  };
}

// ---- Theme

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COLORS = { light: "#f2f2f7", dark: "#000000" };

export const themeSetting = setting<Theme>(THEME_KEY, THEMES, "system");

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Same resolution as THEME_INIT_SCRIPT, at runtime. Sets data-theme on <html> and points every theme-color tag (status bar colour) at the chosen theme. */
export function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = THEME_COLORS[resolved];
  }
}

// ---- Practice

export const defaultModeSetting = setting<Mode>("default-mode", ["practice", "study"] as const, "practice");

const ANSWERS_PREFIX = "exam-answers:";
const REELS_POSITION_PREFIX = "reels-position:";
const LAST_REEL_KEY = "reels-last";
const RECENT_EXAMS_KEY = "exams-recent";
const RECENT_LIMIT = 10;

/** Chosen option per question number. Shared by the exam page and Reels, so progress carries over. */
export type Answers = Record<number, string>;

export function loadAnswers(slug: string): Answers {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`${ANSWERS_PREFIX}${slug}`) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Answers) : {};
  } catch {
    return {};
  }
}

export function saveAnswers(slug: string, answers: Answers) {
  try {
    localStorage.setItem(`${ANSWERS_PREFIX}${slug}`, JSON.stringify(answers));
  } catch {
    // Storage unavailable (private mode etc.); progress just won't persist.
  }
}

/** Index of the question last shown in Reels, so the feed reopens where it was left. */
export function loadReelsPosition(slug: string): number {
  const value = Number(read(`${REELS_POSITION_PREFIX}${slug}`));
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export function saveReelsPosition(slug: string, index: number) {
  try {
    localStorage.setItem(`${REELS_POSITION_PREFIX}${slug}`, String(index));
  } catch {
    // Not persisted; the feed starts from the first question next time.
  }
}

/** Slug of the exam last opened in Reels, offered as "continue" on the Reels tab. */
export function loadLastReel(): string | null {
  return read(LAST_REEL_KEY);
}

export function saveLastReel(slug: string) {
  try {
    localStorage.setItem(LAST_REEL_KEY, slug);
  } catch {
    // Not persisted; the Reels tab just won't offer to continue.
  }
}

/** Slugs of exams opened on the exam page, most recent first. Orders "continue" on Home. */
export function loadRecentExams(): string[] {
  try {
    const parsed: unknown = JSON.parse(read(RECENT_EXAMS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function touchRecentExam(slug: string) {
  try {
    const next = [slug, ...loadRecentExams().filter((s) => s !== slug)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_EXAMS_KEY, JSON.stringify(next));
  } catch {
    // Not persisted; Home just orders "continue" by exam date.
  }
}

/** Removes saved answers (and Reels positions) for every exam. Returns how many exams had progress. */
export function clearAllAnswers(): number {
  try {
    const all = Object.keys(localStorage);
    const keys = all.filter((k) => k.startsWith(ANSWERS_PREFIX));
    const reels = all.filter((k) => k.startsWith(REELS_POSITION_PREFIX) || k === LAST_REEL_KEY || k === RECENT_EXAMS_KEY);
    for (const k of [...keys, ...reels]) localStorage.removeItem(k);
    return keys.length;
  } catch {
    return 0;
  }
}
