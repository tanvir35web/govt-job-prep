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

const THEME_COLORS = { light: "#f2f2f7", dark: "#000000" };

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

export function answersKey(slug: string) {
  return `${ANSWERS_PREFIX}${slug}`;
}

/** Removes saved answers for every exam. Returns how many exams had progress. */
export function clearAllAnswers(): number {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(ANSWERS_PREFIX));
    for (const k of keys) localStorage.removeItem(k);
    return keys.length;
  } catch {
    return 0;
  }
}
