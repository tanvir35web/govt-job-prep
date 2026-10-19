"use client";

import { useCallback, useEffect, useState } from "react";
import { toBn } from "@/lib/format";
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
  system: "সিস্টেম অনুযায়ী",
  light: "লাইট",
  dark: "ডার্ক",
};

export function SettingsView() {
  return (
    <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
      <PageTitle title="সেটিংস" />
      <AppearanceSection />
      <PracticeSection />
      <OfflineSection />
      <UpdateSection />
      <InstallSection />
      <Section title="সম্পর্কে" footer="প্রশ্নগুলো শুধুমাত্র শিক্ষামূলক উদ্দেশ্যে সংকলিত।">
        <ValueRow icon={<InfoIcon className="size-4.5" />} color="gray" label="সংস্করণ" value={toBn(CURRENT_BUILD.version)} />
        <ValueRow label="বিল্ড" value={<span className="font-mono text-[15px]">{CURRENT_BUILD.buildId}</span>} />
        {CURRENT_BUILD.buildTime && <ValueRow label="প্রকাশ" value={formatDate(CURRENT_BUILD.buildTime)} />}
      </Section>
    </main>
  );
}

function AppearanceSection() {
  const theme = themeSetting.use();
  return (
    <Section title="চেহারা" footer={theme === "system" ? "ফোনের লাইট বা ডার্ক মোড অনুযায়ী নিজে বদলাবে।" : undefined}>
      <div role="radiogroup" aria-label="থিম" className="contents">
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
    if (window.confirm("সব পরীক্ষায় আপনার দেওয়া উত্তর ও অগ্রগতি মুছে ফেলা হবে। নিশ্চিত?")) setCleared(clearAllAnswers());
  };

  return (
    <Section
      title="অনুশীলন"
      footer={
        cleared !== null
          ? cleared > 0
            ? `${toBn(cleared)}টি পরীক্ষার অগ্রগতি মুছে ফেলা হয়েছে।`
            : "মুছে ফেলার মতো কোনো অগ্রগতি ছিল না।"
          : "চালু থাকলে পরীক্ষা খুললেই সব উত্তর ও ব্যাখ্যা দেখাবে।"
      }
    >
      <SwitchRow
        icon={<BookOpenIcon className="size-4.5" />}
        color="indigo"
        label="পড়ার মোডে খুলুন"
        checked={mode === "study"}
        onChange={(on) => defaultModeSetting.set(on ? "study" : "practice")}
      />
      <ButtonRow icon={<ResetIcon className="size-4.5" />} color="red" label="সব উত্তর মুছে ফেলুন" destructive onClick={clear} />
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
    if (!window.confirm("সংরক্ষিত সব পরীক্ষা এই ডিভাইস থেকে মুছে যাবে। পরে ইন্টারনেট থাকলে আবার খোলা যাবে। নিশ্চিত?")) return;
    await clearSavedExams();
    setProgress(null);
    await refresh();
  };

  let footer: string;
  if (ready === false) footer = "এই ব্রাউজারে অফলাইন সুবিধা এখনো চালু হয়নি। পাতাটি একবার রিলোড করে দেখুন।";
  else if (progress && !running && progress.failed > 0) footer = `${toBn(progress.failed)}টি পরীক্ষা সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।`;
  else footer = "যে পরীক্ষা একবার খোলেন সেটি নিজে থেকেই সংরক্ষিত হয়, পরে ইন্টারনেট ছাড়াও পড়া যায়।";

  return (
    <Section title="অফলাইন" footer={footer}>
      <ValueRow
        icon={<CloudDownloadIcon className="size-4.5" />}
        color="blue"
        label="সংরক্ষিত পরীক্ষা"
        value={exams ? `${toBn(saved.size)}/${toBn(exams.length)}` : "—"}
      />
      <ValueRow icon={<DatabaseIcon className="size-4.5" />} color="gray" label="ব্যবহৃত জায়গা" value={usage === null ? "—" : formatBytes(usage)} />
      <ButtonRow
        label={running ? "সংরক্ষণ হচ্ছে…" : pending.length === 0 && exams ? "সব পরীক্ষা সংরক্ষিত আছে" : "সব পরীক্ষা সংরক্ষণ করুন"}
        value={running ? `${toBn(progress.done)}/${toBn(progress.total)}` : undefined}
        onClick={saveAll}
        disabled={!ready || !online || !exams || running || pending.length === 0}
      />
      <ButtonRow label="সংরক্ষিত পরীক্ষা মুছুন" destructive onClick={clear} disabled={!ready || running || saved.size === 0} />
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
  checking: "চেক হচ্ছে…",
  latest: "সর্বশেষ সংস্করণ",
  available: "নতুন সংস্করণ আছে",
  offline: "ইন্টারনেট নেই",
  error: "চেক করা যায়নি",
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
      title="অ্যাপ আপডেট"
      footer={available ? "আপডেট করলে অ্যাপ রিলোড হবে। আপনার উত্তর ও সংরক্ষিত পরীক্ষা থেকে যাবে।" : "নতুন প্রশ্ন বা সুবিধা যোগ হলে এখানে জানা যাবে।"}
    >
      <ButtonRow
        icon={<ArrowUpCircleIcon className="size-4.5" />}
        color="green"
        label="আপডেট চেক করুন"
        value={UPDATE_TEXT[result.status]}
        onClick={check}
        disabled={result.status === "checking" || updating}
      />
      {available && (
        <ButtonRow
          label={updating ? "আপডেট হচ্ছে…" : "এখন আপডেট করুন"}
          detail={result.version ? `সংস্করণ ${toBn(result.version)} (${result.buildId})` : result.buildId}
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
      <Section title="অ্যাপ">
        <ValueRow icon={<SquarePlusIcon className="size-4.5" />} color="teal" label="হোম স্ক্রিনে" value="ইনস্টল করা আছে" />
      </Section>
    );
  }

  return (
    <Section
      title="অ্যাপ"
      footer={
        isIOS ? (
          <span className="inline-flex flex-wrap items-center gap-1">
            Safari-র নিচের <ShareIcon className="size-4 text-tint" /> শেয়ার বোতাম চাপুন, তারপর <span className="font-medium text-label">Add to Home Screen</span> বেছে নিন।
          </span>
        ) : (
          "ব্রাউজারের মেনু থেকে \"Install app\" বা \"Add to Home Screen\" বেছে নিন।"
        )
      }
    >
      <ValueRow icon={<SquarePlusIcon className="size-4.5" />} color="teal" label="হোম স্ক্রিনে যোগ করুন" value="ইনস্টল নেই" />
    </Section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${toBn(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${toBn((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

// Fixed time zone so the server-rendered and client-rendered text match.
function formatDate(iso: string) {
  return new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}
