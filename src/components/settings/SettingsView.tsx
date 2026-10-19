"use client";

import { useCallback, useEffect, useState } from "react";
import { formatNumber, pluralize } from "@/lib/format";
import {
  clearSavedExams,
  getSavedSlugs,
  getStorageUsage,
  isOfflineReady,
  saveExamOffline,
  useIsIOS,
  useOnline,
  useStandalone,
} from "@/lib/offline";
import { type Theme, clearAllAnswers, defaultModeSetting, themeSetting } from "@/lib/settings";
import type { ExamListResponse } from "@/lib/types";
import { CURRENT_BUILD, type UpdateCheck, applyUpdate, checkForUpdate } from "@/lib/update";
import { useApi } from "@/lib/use-api";
import { BookOpenIcon, CircleCheckIcon, MonitorIcon, ResetIcon, ShareIcon, SquarePlusIcon, SunIcon, SunMoonIcon } from "../icons";
import { PageTitle } from "../PageTitle";
import { ButtonRow, CustomRow, Section, SwitchRow, ValueRow } from "./SettingsList";

const THEMES: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: SunMoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

export function SettingsView() {
  return (
    <main className="px-safe mx-auto w-full max-w-2xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
      <PageTitle title="Settings" />
      <AppearanceSection />
      <PracticeSection />
      <OfflineSection />
      <UpdateSection />
      <InstallSection />
      <AboutFooter />
    </main>
  );
}

// ---- Appearance

// Styled like the app's tab bar: a translucent capsule with icon-over-label items and a highlight that
// slides to the selected one. It sits straight under the heading, without a list card around it.
function AppearanceSection() {
  const theme = themeSetting.use();
  const index = THEMES.findIndex((t) => t.value === theme);

  return (
    <section className="mt-8 first:mt-3">
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-secondary">Appearance</h2>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="ios-material relative grid h-16 grid-cols-3 rounded-full p-1 shadow-[0_8px_32px_rgb(0_0_0/0.08),0_2px_6px_rgb(0_0_0/0.04)] ring-[0.5px] ring-separator dark:shadow-[0_8px_32px_rgb(0_0_0/0.5)] dark:ring-white/10"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-fill transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {THEMES.map(({ value, label, Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => themeSetting.set(value)}
              className={`relative flex h-full flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${
                selected ? "text-tint" : "text-secondary active:text-label"
              }`}
            >
              <Icon className={`size-6 ${selected ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---- Practice

function PracticeSection() {
  const mode = defaultModeSetting.use();
  const [cleared, setCleared] = useState<number | null>(null);

  const clear = () => {
    if (window.confirm("This will clear your answers and progress in all exams. Continue?")) setCleared(clearAllAnswers());
  };

  return (
    <Section
      title="Practice"
      footer={
        cleared === null ? undefined : cleared > 0 ? `Progress cleared for ${pluralize(cleared, "exam")}.` : "There was no progress to clear."
      }
    >
      <SwitchRow
        icon={<BookOpenIcon className="size-5" />}
        label="Open in study mode"
        detail="Show all answers and explanations when an exam opens"
        checked={mode === "study"}
        onChange={(on) => defaultModeSetting.set(on ? "study" : "practice")}
      />
      <ButtonRow icon={<ResetIcon className="size-5" />} label="Clear all answers" destructive onClick={clear} />
    </Section>
  );
}

// ---- Offline

function OfflineSection() {
  const online = useOnline();
  const { state } = useApi<ExamListResponse>("/api/exams?limit=100");
  const exams = state.status === "success" ? state.data.exams : null;

  const [ready, setReady] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [usage, setUsage] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);

  const apply = useCallback(({ isReady, slugs, bytes }: OfflineStatus) => {
    setReady(isReady);
    setSaved(slugs);
    setUsage(bytes);
  }, []);
  const refresh = async () => apply(await loadOfflineStatus(exams));

  useEffect(() => {
    // Values come from browser storage, so they can only be read after mount.
    let cancelled = false;
    loadOfflineStatus(exams).then((status) => !cancelled && apply(status));
    return () => {
      cancelled = true;
    };
  }, [exams, apply]);

  const pending = exams?.filter((e) => !saved.has(e.slug)) ?? [];
  const running = progress !== null && progress.done < progress.total;
  const total = exams?.length ?? 0;
  const savedCount = running ? saved.size + progress.done : saved.size;
  const pct = total ? Math.min(100, (savedCount / total) * 100) : 0;
  const allSaved = exams !== null && pending.length === 0;

  const saveAll = async () => {
    let failed = 0;
    setProgress({ done: 0, total: pending.length, failed });
    for (const [i, exam] of pending.entries()) {
      if (!(await saveExamOffline(exam.slug))) failed++;
      setProgress({ done: i + 1, total: pending.length, failed });
    }
    await refresh();
  };

  const clear = async () => {
    if (!window.confirm("All saved exams will be removed from this device. You can open them again later when online. Continue?")) return;
    await clearSavedExams();
    setProgress(null);
    await refresh();
  };

  let footer: string;
  if (ready === false) footer = "Offline access isn't ready in this browser yet. Try reloading the page.";
  else if (progress && !running && progress.failed > 0) footer = `Couldn't save ${pluralize(progress.failed, "exam")}. Try again.`;
  else footer = "Exams you open are saved automatically, so you can read them later without internet.";

  return (
    <Section title="Offline" footer={footer}>
      <CustomRow>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[16px]">
            <span className="font-semibold tabular-nums">{exams ? formatNumber(savedCount) : "—"}</span>
            <span className="text-secondary"> of {exams ? pluralize(total, "exam") : "— exams"} saved</span>
          </p>
          <span className="shrink-0 text-[13px] text-secondary tabular-nums">{usage === null ? "" : formatBytes(usage)}</span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-fill" role="progressbar" aria-label="Saved exams" aria-valuemin={0} aria-valuemax={total} aria-valuenow={savedCount}>
          <div className="h-full rounded-full bg-tint transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={saveAll}
            disabled={!ready || !online || !exams || running || allSaved}
            className="pressable inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-label text-[14px] font-semibold text-canvas disabled:bg-fill disabled:text-secondary"
          >
            {allSaved && !running && <CircleCheckIcon className="size-4" />}
            {running ? `Saving ${formatNumber(progress.done)}/${formatNumber(progress.total)}…` : allSaved ? "All saved" : "Save all"}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!ready || running || saved.size === 0}
            className="pressable inline-flex h-10 items-center justify-center rounded-full px-4 text-[14px] font-semibold text-ios-red disabled:text-tertiary"
          >
            Clear
          </button>
        </div>
      </CustomRow>
    </Section>
  );
}

type OfflineStatus = { isReady: boolean; slugs: Set<string>; bytes: number | null };

async function loadOfflineStatus(exams: ExamListResponse["exams"] | null): Promise<OfflineStatus> {
  const [isReady, slugs, bytes] = await Promise.all([
    isOfflineReady(),
    exams ? getSavedSlugs(exams.map((e) => e.slug)) : Promise.resolve(new Set<string>()),
    getStorageUsage(),
  ]);
  return { isReady, slugs, bytes };
}

// ---- Update

const UPDATE_TEXT: Record<UpdateCheck["status"] | "checking", string> = {
  checking: "Checking…",
  latest: "You're up to date",
  available: "A new version is available",
  offline: "No internet connection",
  error: "Couldn't check for updates",
};

function UpdateSection() {
  const [result, setResult] = useState<UpdateCheck | { status: "checking" }>({ status: "checking" });
  const [updating, setUpdating] = useState(false);

  const check = useCallback(async () => {
    setResult({ status: "checking" });
    setResult(await checkForUpdate());
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkForUpdate().then((r) => !cancelled && setResult(r));
    return () => {
      cancelled = true;
    };
  }, []);

  const available = result.status === "available";

  return (
    <Section title="Updates" footer={available ? "The app reloads to update. Your answers and saved exams are kept." : undefined}>
      <CustomRow>
        <div className="flex items-center gap-3">
          <span className={`size-2 shrink-0 rounded-full ${available ? "bg-tint" : result.status === "latest" ? "bg-ios-green" : "bg-tertiary"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[16px]">{UPDATE_TEXT[result.status]}</p>
            {available && (
              <p className="mt-0.5 text-[13px] text-secondary">{result.version ? `Version ${formatNumber(result.version)} · ${result.buildId}` : result.buildId}</p>
            )}
          </div>
          {available ? (
            <button
              type="button"
              onClick={() => {
                setUpdating(true);
                void applyUpdate();
              }}
              disabled={updating}
              className="pressable inline-flex h-9 shrink-0 items-center rounded-full bg-tint px-4 text-[14px] font-semibold text-white disabled:opacity-60 dark:text-black"
            >
              {updating ? "Updating…" : "Update"}
            </button>
          ) : (
            <button
              type="button"
              onClick={check}
              disabled={result.status === "checking"}
              className="pressable inline-flex h-9 shrink-0 items-center rounded-full bg-fill px-4 text-[14px] font-semibold text-label disabled:text-tertiary"
            >
              Check
            </button>
          )}
        </div>
      </CustomRow>
    </Section>
  );
}

// ---- Install

function InstallSection() {
  const standalone = useStandalone();
  const isIOS = useIsIOS();

  if (standalone) {
    return (
      <Section title="App">
        <ValueRow icon={<SquarePlusIcon className="size-5" />} label="Home screen" value="Installed" />
      </Section>
    );
  }

  return (
    <Section title="App">
      <ValueRow
        icon={<SquarePlusIcon className="size-5" />}
        label="Add to home screen"
        detail={
          isIOS ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              In Safari, tap <ShareIcon className="size-3.5 text-tint" /> Share, then Add to Home Screen.
            </span>
          ) : (
            "From your browser menu, choose Install app or Add to Home Screen."
          )
        }
        value="Not installed"
      />
    </Section>
  );
}

// ---- About

function AboutFooter() {
  return (
    <footer className="mt-10 text-center text-[12px] leading-relaxed text-tertiary">
      <p>
        Version {formatNumber(CURRENT_BUILD.version)} · <span className="font-mono">{CURRENT_BUILD.buildId}</span>
        {CURRENT_BUILD.buildTime && <> · {formatDate(CURRENT_BUILD.buildTime)}</>}
      </p>
      <p className="mt-1">Questions are compiled for educational purposes only.</p>
    </footer>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${formatNumber((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

// Fixed time zone so the server-rendered and client-rendered text match.
function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}
