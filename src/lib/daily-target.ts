"use client";

import { useSyncExternalStore } from "react";

export type DailyTargetConfig = {
  id: string;
  subjectId: string; // e.g. "general-knowledge" or "bangla"
  subjectName: string; // display name e.g. "সাধারণ জ্ঞান"
  topicName: string; // specific topic, or "" for all topics
  dailyCount: number; // e.g. 30
  secondsPerQuestion: number; // 0 for untimed, or 30, 40, 60
  createdAt: number;
};

export type DailyTargetQuestion = {
  key: string;
  question_no: number;
  subject: string;
  topic: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

export type DailyTargetSession = {
  id: string;
  date: string; // "YYYY-MM-DD"
  targetId: string;
  targetSubject: string;
  targetTopic: string;
  totalQuestions: number;
  questions: DailyTargetQuestion[];
  // Keys of questions marked as studied/answered in study mode
  studiedKeys: string[];
  // Answers given in the target exam (question key -> chosen option)
  examAnswers: Record<string, string>;
  examScore: number | null; // null if exam not yet completed
  examFinishedAt: number | null;
  isCompleted: boolean; // true if all questions studied
  completedAt: number | null;
};

export type DailyStreak = {
  current: number;
  best: number;
  lastCompletedDate: string | null; // "YYYY-MM-DD"
};

export type DailyTargetHistoryItem = {
  id: string;
  date: string;
  targetSubject: string;
  targetTopic: string;
  totalQuestions: number;
  studiedCount: number;
  examScore: number | null;
  completedAt: number;
};

export const COUNT_PRESETS = [15, 20, 25, 30, 40, 50] as const;
export const TIMER_PRESETS = [
  { value: 0, label: "টাইমার ছাড়া (Untimed)" },
  { value: 30, label: "৩০ সেকেন্ড / প্রশ্ন" },
  { value: 45, label: "৪৫ সেকেন্ড / প্রশ্ন" },
  { value: 60, label: "৬০ সেকেন্ড / প্রশ্ন" },
] as const;

const CONFIGS_KEY = "daily-target-configs";
const ACTIVE_CONFIG_ID_KEY = "daily-target-active-id";
const COMPLETED_KEYS_KEY = "daily-target-completed-keys";
const SESSION_KEY = "daily-target-session";
const STREAK_KEY = "daily-target-streak";
const HISTORY_KEY = "daily-target-history";

const CHANGE_EVENT = "daily-target-change";

export function dispatchTargetChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Storage quota or private mode
  }
  dispatchTargetChange();
}

/** Local date string "YYYY-MM-DD" */
export function getTodayDateString(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isYesterday(dateStr: string): boolean {
  return dateStr === getTodayDateString(-1);
}

// ---- Configs Management

export function loadTargetConfigs(): DailyTargetConfig[] {
  return readJson<DailyTargetConfig[]>(CONFIGS_KEY, []);
}

export function saveTargetConfigs(configs: DailyTargetConfig[]) {
  writeJson(CONFIGS_KEY, configs);
}

export function loadActiveConfigId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_CONFIG_ID_KEY);
}

export function setActiveConfigId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_CONFIG_ID_KEY, id);
  dispatchTargetChange();
}

export function getActiveTargetConfig(): DailyTargetConfig | null {
  const configs = loadTargetConfigs();
  if (configs.length === 0) return null;
  const activeId = loadActiveConfigId();
  return configs.find((c) => c.id === activeId) ?? configs[0];
}

export function upsertTargetConfig(config: Omit<DailyTargetConfig, "id" | "createdAt"> & { id?: string }): DailyTargetConfig {
  const configs = loadTargetConfigs();
  const id = config.id ?? `target_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = Date.now();

  const existingIndex = configs.findIndex((c) => c.id === id);
  const updated: DailyTargetConfig = {
    ...config,
    id,
    createdAt: existingIndex >= 0 ? configs[existingIndex].createdAt : now,
  };

  if (existingIndex >= 0) {
    configs[existingIndex] = updated;
  } else {
    configs.push(updated);
  }

  saveTargetConfigs(configs);
  setActiveConfigId(id);
  return updated;
}

export function deleteTargetConfig(id: string) {
  const configs = loadTargetConfigs().filter((c) => c.id !== id);
  saveTargetConfigs(configs);
  const activeId = loadActiveConfigId();
  if (activeId === id) {
    setActiveConfigId(configs[0]?.id ?? "");
  }
  // If active session belongs to this target, clear it
  const session = loadTodaySession();
  if (session?.targetId === id) {
    saveTodaySession(null);
  }
}

// ---- Completed Questions Tracking ("পড়া হয়ে গেলে আর আসবে না")

export function loadCompletedQuestionKeys(): Set<string> {
  const arr = readJson<string[]>(COMPLETED_KEYS_KEY, []);
  return new Set(arr);
}

export function saveCompletedQuestionKeys(keys: Set<string> | string[]) {
  const arr = Array.isArray(keys) ? keys : Array.from(keys);
  writeJson(COMPLETED_KEYS_KEY, arr);
}

export function markQuestionsAsCompleted(keysToAdd: string[]) {
  const existing = loadCompletedQuestionKeys();
  let changed = false;
  for (const k of keysToAdd) {
    if (!existing.has(k)) {
      existing.add(k);
      changed = true;
    }
  }
  if (changed) {
    saveCompletedQuestionKeys(existing);
  }
}

export function resetSubjectOrTopicProgress(subjectId: string, topicName?: string) {
  const existing = loadCompletedQuestionKeys();
  const next = new Set<string>();
  const prefix = topicName ? `${subjectId}::${topicName}::` : `${subjectId}::`;

  for (const k of existing) {
    if (!k.startsWith(prefix)) {
      next.add(k);
    }
  }
  saveCompletedQuestionKeys(next);
  // Clear any current active session for this target
  saveTodaySession(null);
}

// ---- Today's Session

export function loadTodaySession(): DailyTargetSession | null {
  const session = readJson<DailyTargetSession | null>(SESSION_KEY, null);
  if (!session) return null;
  // If stored session is from a previous date, user can complete it or start fresh
  return session;
}

export function saveTodaySession(session: DailyTargetSession | null) {
  writeJson(SESSION_KEY, session);
}

export function generateDailySession(
  config: DailyTargetConfig,
  allQuestions: DailyTargetQuestion[],
  forceNewDate = false,
): { session: DailyTargetSession | null; totalAvailable: number; unstudiedCount: number } {
  const completedKeys = loadCompletedQuestionKeys();
  const filtered = config.topicName
    ? allQuestions.filter((q) => q.topic === config.topicName)
    : allQuestions;

  const totalAvailable = filtered.length;
  const unstudied = filtered.filter((q) => !completedKeys.has(q.key));
  const unstudiedCount = unstudied.length;

  if (unstudied.length === 0) {
    return { session: null, totalAvailable, unstudiedCount: 0 };
  }

  const selectedQuestions = unstudied.slice(0, config.dailyCount);
  const today = getTodayDateString();

  const session: DailyTargetSession = {
    id: `session_${Date.now()}`,
    date: forceNewDate ? today : today,
    targetId: config.id,
    targetSubject: config.subjectName,
    targetTopic: config.topicName || "সব টপিক",
    totalQuestions: selectedQuestions.length,
    questions: selectedQuestions,
    studiedKeys: [],
    examAnswers: {},
    examScore: null,
    examFinishedAt: null,
    isCompleted: false,
    completedAt: null,
  };

  saveTodaySession(session);
  return { session, totalAvailable, unstudiedCount };
}

// ---- Streak & History

export function loadStreak(): DailyStreak {
  return readJson<DailyStreak>(STREAK_KEY, { current: 0, best: 0, lastCompletedDate: null });
}

export function updateStreakOnDayComplete(dateStr = getTodayDateString()): DailyStreak {
  const streak = loadStreak();
  if (streak.lastCompletedDate === dateStr) {
    // Already counted for today
    return streak;
  }

  let nextCurrent = 1;
  if (streak.lastCompletedDate && isYesterday(streak.lastCompletedDate)) {
    nextCurrent = streak.current + 1;
  } else if (streak.lastCompletedDate === dateStr) {
    nextCurrent = streak.current;
  }

  const nextBest = Math.max(streak.best, nextCurrent);
  const updated: DailyStreak = {
    current: nextCurrent,
    best: nextBest,
    lastCompletedDate: dateStr,
  };

  writeJson(STREAK_KEY, updated);
  return updated;
}

export function loadHistory(): DailyTargetHistoryItem[] {
  return readJson<DailyTargetHistoryItem[]>(HISTORY_KEY, []);
}

export function recordHistoryItem(item: Omit<DailyTargetHistoryItem, "id">) {
  const history = loadHistory();
  const id = `hist_${Date.now()}`;
  // Keep last 30 items
  const next = [{ ...item, id }, ...history.filter((h) => h.date !== item.date || h.targetSubject !== item.targetSubject)].slice(0, 30);
  writeJson(HISTORY_KEY, next);
}

// ---- External Store Hook for Reactive Updates

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useDailyTargetState() {
  const activeConfig = useSyncExternalStore(subscribe, getActiveTargetConfig, () => null);
  const session = useSyncExternalStore(subscribe, loadTodaySession, () => null);
  const streak = useSyncExternalStore(subscribe, loadStreak, () => ({ current: 0, best: 0, lastCompletedDate: null }));
  const configs = useSyncExternalStore(subscribe, loadTargetConfigs, () => []);

  return { activeConfig, session, streak, configs };
}
