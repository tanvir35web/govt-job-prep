"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatNumber } from "@/lib/format";
import {
  type DailyTargetConfig,
  type DailyTargetQuestion,
  type DailyTargetSession,
  generateDailySession,
  loadTodaySession,
  resetSubjectOrTopicProgress,
  saveTodaySession,
  setActiveConfigId,
  useDailyTargetState,
} from "@/lib/daily-target";
import { type DailyTargetQuestionItem } from "@/app/api/daily-target/questions/route";
import { useApi } from "@/lib/use-api";
import { AppLink } from "@/components/AppLink";
import {
  CheckIcon,
  ChevronLeftIcon,
  FlameIcon,
  GearIcon,
  ResetIcon,
  TargetIcon,
} from "@/components/icons";
import { ErrorState, Skeleton } from "@/components/StatusViews";
import { DailyTargetSetup } from "./DailyTargetSetup";
import { DailyTargetStudy } from "./DailyTargetStudy";
import { DailyTargetExam } from "./DailyTargetExam";

type QuestionsApiResponse = {
  status: "success";
  code: number;
  message: string;
  subject: string;
  topic: string;
  total_questions: number;
  questions: DailyTargetQuestionItem[];
};

export function DailyTargetView() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [mode, setMode] = useState<"study" | "exam">(tabParam === "exam" ? "exam" : "study");
  const [setupOpen, setSetupOpen] = useState(searchParams.get("setup") === "true");

  const { activeConfig, session, streak, configs, completedKeys } = useDailyTargetState();

  // If no target is set yet
  if (!activeConfig) {
    return (
      <main className="px-safe mx-auto w-full max-w-xl flex-1 pt-[max(1rem,env(safe-area-inset-top))] pb-12">
        <header className="flex items-center gap-3 pb-4">
          <AppLink
            href="/"
            aria-label="হোমে ফিরে যান"
            className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-tint"
          >
            <ChevronLeftIcon className="size-6 stroke-[2.5]" />
          </AppLink>
          <h1 className="text-[24px] font-bold tracking-tight text-label">দৈনিক টার্গেট</h1>
        </header>

        <div className="mt-8 rounded-3xl border border-separator/80 bg-surface/80 p-8 text-center shadow-sm">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-tint/12 text-tint">
            <TargetIcon className="size-7 stroke-[2.2]" />
          </div>

          <h2 className="mt-4 text-[20px] font-bold text-label">
            দৈনিক টার্গেট সেট করুন
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-secondary">
            প্রতিদিন নির্দিষ্ট বিষয়ের প্রশ্ন পড়ুন। পড়া প্রশ্ন আর আসবে না, প্রতিদিন পাবেন নতুন প্রশ্ন!
          </p>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="flex h-11 items-center gap-2 rounded-2xl bg-tint px-5 text-[14px] font-semibold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
            >
              <TargetIcon className="size-4.5" />
              টার্গেট সেট করুন
            </button>
          </div>
        </div>

        <DailyTargetSetup open={setupOpen} onClose={() => setSetupOpen(false)} />
      </main>
    );
  }

  return (
    <TargetLoadedContent
      config={activeConfig}
      session={session}
      streak={streak}
      configs={configs}
      completedKeys={completedKeys}
      mode={mode}
      onModeChange={setMode}
      onOpenSetup={() => setSetupOpen(true)}
      setupOpen={setupOpen}
      onCloseSetup={() => setSetupOpen(false)}
    />
  );
}

function TargetLoadedContent({
  config,
  session,
  streak,
  configs,
  completedKeys,
  mode,
  onModeChange,
  onOpenSetup,
  setupOpen,
  onCloseSetup,
}: {
  config: DailyTargetConfig;
  session: DailyTargetSession | null;
  streak: { current: number; best: number };
  configs: DailyTargetConfig[];
  completedKeys: Set<string>;
  mode: "study" | "exam";
  onModeChange: (m: "study" | "exam") => void;
  onOpenSetup: () => void;
  setupOpen: boolean;
  onCloseSetup: () => void;
}) {
  const questionsUrl = `/api/daily-target/questions?subject=${encodeURIComponent(
    config.subjectId,
  )}${config.topicName ? `&topic=${encodeURIComponent(config.topicName)}` : ""}`;

  const { state: qState, retry } = useApi<QuestionsApiResponse>(questionsUrl);
  const allAvailableQuestions = useMemo(
    () => (qState.status === "success" ? (qState.data.questions as DailyTargetQuestion[]) : []),
    [qState],
  );

  useEffect(() => {
    if (allAvailableQuestions.length === 0) return;

    const existingSession = loadTodaySession();
    if (
      existingSession &&
      existingSession.targetId === config.id &&
      existingSession.questions.length > 0
    ) {
      return;
    }

    generateDailySession(config, allAvailableQuestions);
  }, [config, allAvailableQuestions]);

  const handleStartNextTarget = () => {
    if (allAvailableQuestions.length === 0) return;

    const res = generateDailySession(config, allAvailableQuestions, true);
    if (!res.session) {
      alert("এই টপিকের সব প্রশ্ন পড়া সম্পন্ন হয়েছে!");
    } else {
      onModeChange("study");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleResetTopic = () => {
    if (
      window.confirm(
        `আপনি কি "${config.subjectName} ${config.topicName ? `(${config.topicName})` : ""}" এর অগ্রগতি রিসেট করতে চান?`,
      )
    ) {
      resetSubjectOrTopicProgress(config.subjectId, config.topicName);
      generateDailySession(config, allAvailableQuestions, true);
    }
  };

  const totalQuestionsInTopic = allAvailableQuestions.length;
  const filteredCompleted = useMemo(() => {
    return allAvailableQuestions.filter((q) => completedKeys.has(q.key)).length;
  }, [allAvailableQuestions, completedKeys]);

  const allCompletedInTopic =
    totalQuestionsInTopic > 0 &&
    filteredCompleted >= totalQuestionsInTopic &&
    (!session || session.questions.length === 0);

  return (
    <main className="px-safe mx-auto w-full max-w-xl flex-1 pt-[max(0.75rem,env(safe-area-inset-top))] pb-16">
      {/* Top Header */}
      <header className="flex items-center justify-between gap-3 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {mode === "exam" ? (
            <button
              type="button"
              onClick={() => onModeChange("study")}
              aria-label="পড়ায় ফিরে যান"
              className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-tint"
            >
              <ChevronLeftIcon className="size-6 stroke-[2.5]" />
            </button>
          ) : (
            <AppLink
              href="/"
              aria-label="হোমে ফিরে যান"
              className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-tint"
            >
              <ChevronLeftIcon className="size-6 stroke-[2.5]" />
            </AppLink>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-bold text-label sm:text-[20px]">
              {mode === "exam" ? "টার্গেট পরীক্ষা" : config.subjectName}
            </h1>
            <p className="truncate text-[12px] text-secondary">
              {mode === "exam"
                ? `${config.subjectName}${config.topicName ? ` · ${config.topicName}` : ""}`
                : (config.topicName ? config.topicName : "দৈনিক টার্গেট")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {streak.current > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-[12px] font-bold text-orange-600 dark:text-orange-400">
              <FlameIcon className="size-3.5 text-orange-500" />
              {formatNumber(streak.current)}
            </span>
          )}

          <button
            type="button"
            onClick={onOpenSetup}
            aria-label="টার্গেট কনফিগার"
            className="grid size-9 place-items-center rounded-full bg-fill text-secondary hover:text-label"
          >
            <GearIcon className="size-4.5" />
          </button>
        </div>
      </header>

      {/* Target Selector Pills if multiple targets exist */}
      {configs.length > 1 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {configs.map((c) => {
            const active = c.id === config.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveConfigId(c.id);
                  saveTodaySession(null);
                }}
                className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold transition-all ${
                  active
                    ? "bg-tint text-white shadow-xs"
                    : "border border-separator bg-surface text-secondary hover:text-label"
                }`}
              >
                {c.subjectName}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {qState.status === "loading" && (
        <div className="space-y-3 pt-4">
          <Skeleton className="h-4 w-1/3 rounded-lg" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      )}

      {/* Error state */}
      {qState.status === "error" && (
        <ErrorState
          title="প্রশ্ন লোড করা সম্ভব হয়নি"
          message="সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।"
          onRetry={retry}
        />
      )}

      {/* All Completed in Topic */}
      {allCompletedInTopic && (
        <div className="mt-4 rounded-3xl border border-ios-green/40 bg-ios-green/10 p-6 text-center shadow-sm">
          <span className="grid size-12 mx-auto place-items-center rounded-2xl bg-ios-green text-white shadow-md">
            <CheckIcon className="size-6 stroke-[2.5]" />
          </span>
          <h2 className="mt-3 text-[19px] font-bold text-label">
            এই টপিকের সব প্রশ্ন পড়া শেষ!
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-secondary">
            আপনি {config.subjectName} এর {formatNumber(totalQuestionsInTopic)}টি প্রশ্ন সম্পন্ন করেছেন।
          </p>

          <div className="mt-5 flex justify-center gap-2.5">
            <button
              type="button"
              onClick={handleResetTopic}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-tint px-4 text-[13px] font-semibold text-white shadow-xs hover:opacity-90 active:scale-95"
            >
              <ResetIcon className="size-3.5" />
              রিভিশন দিন
            </button>
            <button
              type="button"
              onClick={onOpenSetup}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-separator bg-surface px-4 text-[13px] font-semibold text-label shadow-xs hover:bg-fill active:scale-95"
            >
              টপিক পরিবর্তন
            </button>
          </div>
        </div>
      )}

      {/* Study View */}
      {mode === "study" && session && session.questions.length > 0 && !allCompletedInTopic && (
        <DailyTargetStudy
          session={session}
          onGoToExam={() => onModeChange("exam")}
          onStartNextTarget={handleStartNextTarget}
        />
      )}

      {/* Exam View */}
      {mode === "exam" && session && session.questions.length > 0 && !allCompletedInTopic && (
        <DailyTargetExam
          session={session}
          secondsPerQuestion={config.secondsPerQuestion}
          onBackToStudy={() => onModeChange("study")}
          onStartNextTarget={handleStartNextTarget}
        />
      )}

      {/* Settings & Info Sheet */}
      <DailyTargetSetup
        open={setupOpen}
        onClose={onCloseSetup}
        editingConfig={config}
        completedInTopic={filteredCompleted}
        totalInTopic={totalQuestionsInTopic}
        onResetTopic={handleResetTopic}
      />
    </main>
  );
}
