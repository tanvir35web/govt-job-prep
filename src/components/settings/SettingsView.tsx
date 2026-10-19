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
import {
  ArrowUpCircleIcon,
  BookOpenIcon,
  CloudDownloadIcon,
  DatabaseIcon,
  InfoIcon,
  ResetIcon,
  ShareIcon,
  SquarePlusIcon,
} from "../icons";
import { PageTitle } from "../PageTitle";
import { ButtonRow, CheckRow, Section, SwitchRow, ValueRow } from "./SettingsList";

const THEME_LABELS: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function SettingsView() {
  return (
    <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
      <PageTitle title="Settings" />
      <AppearanceSection />
      <PracticeSection />
      <OfflineSection />
      <UpdateSection />
      <InstallSection />
      <Section title="About" footer="Questions are compiled for educational purposes only.">
        <ValueRow icon={<InfoIcon className="size-4.5" />} color="gray" label="Version" value={formatNumber(CURRENT_BUILD.version)} />
        <ValueRow label="Build" value={<span className="font-mono text-[15px]">{CURRENT_BUILD.buildId}</span>} />
        {CURRENT_BUILD.buildTime && <ValueRow label="Released" value={formatDate(CURRENT_BUILD.buildTime)} />}
      </Section>
    </main>
  );
}

function AppearanceSection() {
  const theme = themeSetting.use();
  return (
    <Section title="Appearance" footer={theme === "system" ? "Matches your device's Light or Dark setting." : undefined}>
      <div role="radiogroup" aria-label="Theme" className="contents">
        {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
          <CheckRow key={t} label={THEME_LABELS[t]} checked={theme === t} onSelect={() => themeSetting.set(t)} />
        ))}
      </div>
    </Section>
  );
}

function PracticeSection() {
  const mode = defaultModeSetting.use();
  const [cleared, setCleared] = useState<number | null>(null);

  const clear = () => {
    if (window.confirm("This will clear your answers and progress in all exams. Confirm?")) setCleared(clearAllAnswers());
  };

  return (
    <Section
      title="Practice"
      footer={
        cleared !== null
          ? cleared > 0
            ? `Progress cleared for ${pluralize(cleared, "exam")}.`
            : "There was no progress to clear."
          : "When on, exams open with all answers and explanations shown."
      }
    >
      <SwitchRow
        icon={<BookOpenIcon className="size-4.5" />}
        color="indigo"
        label="Open in Study Mode"
        checked={mode === "study"}
        onChange={(on) => defaultModeSetting.set(on ? "study" : "practice")}
      />
      <ButtonRow icon={<ResetIcon className="size-4.5" />} color="red" label="Clear All Answers" destructive onClick={clear} />
    </Section>
  );
}

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
    if (!window.confirm("All saved exams will be removed from this device. You can open them again later when online. Confirm?")) return;
    await clearSavedExams();
    setProgress(null);
    await refresh();
  };

  let footer: string;
  if (ready === false) footer = "Offline access is not ready in this browser yet. Try reloading the page.";
  else if (progress && !running && progress.failed > 0) footer = `Couldn't save ${pluralize(progress.failed, "exam")}. Try again.`;
  else footer = "Exams you open are saved automatically, so you can read them later without internet.";

  return (
    <Section title="Offline" footer={footer}>
      <ValueRow
        icon={<CloudDownloadIcon className="size-4.5" />}
        color="blue"
        label="Saved Exams"
        value={exams ? `${formatNumber(saved.size)}/${formatNumber(exams.length)}` : "—"}
      />
      <ValueRow icon={<DatabaseIcon className="size-4.5" />} color="gray" label="Storage Used" value={usage === null ? "—" : formatBytes(usage)} />
      <ButtonRow
        label={running ? "Saving…" : pending.length === 0 && exams ? "All Exams Saved" : "Save All Exams"}
        value={running ? `${formatNumber(progress.done)}/${formatNumber(progress.total)}` : undefined}
        onClick={saveAll}
        disabled={!ready || !online || !exams || running || pending.length === 0}
      />
      <ButtonRow label="Clear Saved Exams" destructive onClick={clear} disabled={!ready || running || saved.size === 0} />
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

const UPDATE_TEXT: Record<UpdateCheck["status"] | "checking", string> = {
  checking: "Checking…",
  latest: "Up to date",
  available: "Update available",
  offline: "No internet connection",
  error: "Couldn't check",
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
    <Section
      title="App Update"
      footer={available ? "The app will reload to update. Your answers and saved exams are kept." : "New questions and features will show up here."}
    >
      <ButtonRow
        icon={<ArrowUpCircleIcon className="size-4.5" />}
        color="green"
        label="Check for Update"
        value={UPDATE_TEXT[result.status]}
        onClick={check}
        disabled={result.status === "checking" || updating}
      />
      {available && (
        <ButtonRow
          label={updating ? "Updating…" : "Update Now"}
          detail={result.version ? `Version ${formatNumber(result.version)} (${result.buildId})` : result.buildId}
          onClick={() => {
            setUpdating(true);
            void applyUpdate();
          }}
          disabled={updating}
        />
      )}
    </Section>
  );
}

function InstallSection() {
  const standalone = useStandalone();
  const isIOS = useIsIOS();

  if (standalone) {
    return (
      <Section title="App">
        <ValueRow icon={<SquarePlusIcon className="size-4.5" />} color="teal" label="Home Screen" value="Installed" />
      </Section>
    );
  }

  return (
    <Section
      title="App"
      footer={
        isIOS ? (
          <span className="inline-flex flex-wrap items-center gap-1">
            In Safari, tap the <ShareIcon className="size-4 text-tint" /> Share button, then choose <span className="font-medium text-label">Add to Home Screen</span>.
          </span>
        ) : (
          "In your browser menu, choose \"Install app\" or \"Add to Home Screen\"."
        )
      }
    >
      <ValueRow icon={<SquarePlusIcon className="size-4.5" />} color="teal" label="Add to Home Screen" value="Not installed" />
    </Section>
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
