"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatNumber } from "@/lib/format";
import {
  type DailyTargetConfig,
  type DailyTargetQuestion,
  type DailyTargetSession,
  generateDailySession,
  loadHistory,
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
  AwardIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronLeftIcon,
  FlameIcon,
  GearIcon,
  ResetIcon,
  TargetIcon,
  TimerIcon,
} from "@/components/icons";
import { Ring } from "@/components/Ring";
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
  const [tabOverride, setTabOverride] = useState<"study" | "exam" | "history" | null>(null);
  const activeTab = tabOverride ?? (tabParam === "exam" ? "exam" : tabParam === "history" ? "history" : "study");
  const [setupOpen, setSetupOpen] = useState(searchParams.get("setup") === "true");

  const { activeConfig, session, streak, configs, completedKeys } = useDailyTargetState();

  // If no target is set
  if (!activeConfig) {
    return (
      <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-12">
        <header className="flex items-center gap-3 pb-4">
          <AppLink href="/" aria-label="হোমে ফিরে যান" className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-tint">
            <ChevronLeftIcon className="size-6 stroke-[2.5]" />
          </AppLink>
          <h1 className="text-[28px] font-bold tracking-tight text-label">দৈনিক টার্গেট</h1>
        </header>

        <div className="mt-8 overflow-hidden rounded-3xl border border-separator/80 bg-surface/80 p-8 text-center shadow-sm backdrop-blur-md">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-tint/12 text-tint">
            <TargetIcon className="size-8 stroke-[2.2]" />
          </div>

          <h2 className="mt-5 text-[22px] font-bold text-label">
            আপনার কোনো দৈনিক টার্গেট সেট করা নেই
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-secondary">
            প্রতিদিন নিয়মিত নির্দিষ্ট বিষয়ের প্রশ্ন পড়ে সরকারি চাকরির প্রস্তুতি মজবুত করুন। পড়া প্রশ্ন আর আসবে না, প্রতিদিন পাবেন নতুন নতুন প্রশ্ন!
          </p>

          <div className="mt-7 flex justify-center">
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="flex h-11 items-center gap-2 rounded-2xl bg-tint px-5 text-[14px] font-semibold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
            >
              <TargetIcon className="size-4.5" />
              টার্গেট সেট
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
      activeTab={activeTab}
      onTabChange={setTabOverride}
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
  activeTab,
  onTabChange,
  onOpenSetup,
  setupOpen,
  onCloseSetup,
}: {
  config: DailyTargetConfig;
  session: DailyTargetSession | null;
  streak: { current: number; best: number };
  configs: DailyTargetConfig[];
  completedKeys: Set<string>;
  activeTab: "study" | "exam" | "history";
  onTabChange: (tab: "study" | "exam" | "history") => void;
  onOpenSetup: () => void;
  setupOpen: boolean;
  onCloseSetup: () => void;
}) {
  // Fetch questions for this subject & topic
  const questionsUrl = `/api/daily-target/questions?subject=${encodeURIComponent(
    config.subjectId,
  )}${config.topicName ? `&topic=${encodeURIComponent(config.topicName)}` : ""}`;

  const { state: qState, retry } = useApi<QuestionsApiResponse>(questionsUrl);
  const allAvailableQuestions = useMemo(
    () => (qState.status === "success" ? (qState.data.questions as DailyTargetQuestion[]) : []),
    [qState],
  );

  // Generate or load today's session
  useEffect(() => {
    if (allAvailableQuestions.length === 0) return;

    const existingSession = loadTodaySession();
    // If we have an existing session matching this target and it has questions, use it
    if (
      existingSession &&
      existingSession.targetId === config.id &&
      existingSession.questions.length > 0
    ) {
      return;
    }

    // Otherwise generate a new daily batch of unstudied questions
    generateDailySession(config, allAvailableQuestions);
  }, [config.id, config.dailyCount, config.topicName, allAvailableQuestions]);

  // Handler to start next target (either next day or force new batch)
  const handleStartNextTarget = () => {
    if (allAvailableQuestions.length === 0) return;

    if (
      session &&
      !session.isCompleted &&
      !window.confirm("বর্তমান টার্গেটের সব প্রশ্ন এখনও পড়া শেষ হয়নি। আপনি কি নতুন টার্গেট শুরু করতে চান?")
    ) {
      return;
    }

    const res = generateDailySession(config, allAvailableQuestions, true);
    if (!res.session) {
      alert("এই টপিকের সব প্রশ্ন ইতিমধ্যে পড়া হয়ে গেছে! আপনি রিভিশন দিতে অগ্রগতি রিসেট করতে পারেন।");
    } else {
      onTabChange("study");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleResetTopic = () => {
    if (
      window.confirm(
        `আপনি কি "${config.subjectName} ${config.topicName ? `(${config.topicName})` : ""
        }" এর পড়া সকল প্রশ্নের অগ্রগতি রিসেট করে পুনরায় প্রথম থেকে শুরু করতে চান?`,
      )
    ) {
      resetSubjectOrTopicProgress(config.subjectId, config.topicName);
      generateDailySession(config, allAvailableQuestions, true);
      alert("অগ্রগতি রিসেট করা হয়েছে! প্রশ্নগুলো আবার প্রথম থেকে শুরু হচ্ছে।");
    }
  };

  // Calculations for stats tab
  const totalQuestionsInTopic = allAvailableQuestions.length;
  const filteredCompleted = useMemo(() => {
    return allAvailableQuestions.filter((q) => completedKeys.has(q.key)).length;
  }, [allAvailableQuestions, completedKeys]);

  const history = useMemo(() => loadHistory(), [session]);

  const allCompletedInTopic = totalQuestionsInTopic > 0 && filteredCompleted >= totalQuestionsInTopic && (!session || session.questions.length === 0);

  return (
    <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-16">
      {/* Top Header */}
      <header className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          <AppLink
            href="/"
            aria-label="হোমে ফিরে যান"
            className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-tint"
          >
            <ChevronLeftIcon className="size-6 stroke-[2.5]" />
          </AppLink>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-label sm:text-[30px]">
              দৈনিক টার্গেট
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {streak.current > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-[13px] font-bold text-orange-600 dark:text-orange-400">
              <FlameIcon className="size-4 text-orange-500" />
              <span>{formatNumber(streak.current)} দিনের স্ট্রিক</span>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenSetup}
            aria-label="টার্গেট কনফিগার"
            className="grid size-10 place-items-center rounded-full bg-fill text-secondary hover:text-label"
          >
            <GearIcon className="size-5" />
          </button>
        </div>
      </header>

      {/* Target Selector Pills if multiple configs exist */}
      {configs.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {configs.map((c) => {
            const active = c.id === config.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveConfigId(c.id);
                  saveTodaySession(null); // Will trigger generation for new target
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${active
                    ? "bg-tint text-white shadow-xs"
                    : "border border-separator bg-surface text-secondary hover:text-label"
                  }`}
              >
                <TargetIcon className="size-3.5" />
                {c.subjectName} {c.topicName && `· ${c.topicName}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Segmented Control Tabs */}
      <div className="mb-6 grid grid-cols-3 rounded-2xl bg-fill p-1 text-center font-semibold text-[13px] shadow-xs sm:text-[14px]">
        <button
          type="button"
          onClick={() => onTabChange("study")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${activeTab === "study"
              ? "bg-surface text-label shadow-sm"
              : "text-secondary hover:text-label"
            }`}
        >
          পড়া
        </button>

        <button
          type="button"
          onClick={() => onTabChange("exam")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${activeTab === "exam"
              ? "bg-surface text-label shadow-sm"
              : "text-secondary hover:text-label"
            }`}
        >
          পরীক্ষা
          {session?.examScore !== null && session?.examScore !== undefined && (
            <span className="size-2 rounded-full bg-ios-green" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange("history")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${activeTab === "history"
              ? "bg-surface text-label shadow-sm"
              : "text-secondary hover:text-label"
            }`}
        >
          ইতিহাস
        </button>
      </div>

      {/* Loading state */}
      {qState.status === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
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

      {/* All Completed in Topic Banner */}
      {allCompletedInTopic && (
        <div className="overflow-hidden rounded-3xl border border-ios-green/40 bg-gradient-to-b from-ios-green/10 to-surface p-7 text-center shadow-sm">
          <span className="grid size-14 mx-auto place-items-center rounded-2xl bg-ios-green text-white shadow-md">
            <CheckIcon className="size-8 stroke-[2.5]" />
          </span>
          <h2 className="mt-4 text-[22px] font-bold text-label">
            🎉 অভিনন্দন! এই টপিকের সব প্রশ্ন পড়া সম্পন্ন হয়েছে!
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-secondary">
            আপনি {config.subjectName} {config.topicName ? `(${config.topicName})` : ""} এর সকল {formatNumber(totalQuestionsInTopic)}টি প্রশ্ন পড়ে ফেলেছেন।
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleResetTopic}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-tint px-4 text-[13px] font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-95"
            >
              <ResetIcon className="size-3.5" />
              রিভিশন দিন
            </button>

            <button
              type="button"
              onClick={onOpenSetup}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-separator bg-surface px-4 text-[13px] font-semibold text-label shadow-xs transition-all hover:bg-fill active:scale-95"
            >
              টপিক পরিবর্তন
            </button>
          </div>
        </div>
      )}

      {/* Tab 1: Study & Practice */}
      {activeTab === "study" && session && session.questions.length > 0 && !allCompletedInTopic && (
        <DailyTargetStudy
          session={session}
          onGoToExam={() => onTabChange("exam")}
          onStartNextTarget={handleStartNextTarget}
        />
      )}

      {/* Tab 2: Exam */}
      {activeTab === "exam" && session && session.questions.length > 0 && !allCompletedInTopic && (
        <DailyTargetExam
          session={session}
          secondsPerQuestion={config.secondsPerQuestion}
          onBackToStudy={() => onTabChange("study")}
          onStartNextTarget={handleStartNextTarget}
        />
      )}

      {/* Tab 3: Progress & History */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Overall Topic Progress Card */}
          <section className="rounded-2xl border border-separator/80 bg-surface/80 p-5 shadow-sm backdrop-blur-md">
            <h3 className="text-[17px] font-bold text-label">
              টপিক অগ্রগতি ({config.subjectName})
            </h3>
            <p className="mt-0.5 text-[13px] text-secondary">
              {config.topicName ? `টপিক: ${config.topicName}` : "সব টপিক অন্তর্ভুক্ত"}
            </p>

            <div className="mt-4 flex items-center gap-4">
              <Ring
                value={filteredCompleted}
                total={totalQuestionsInTopic || 1}
                size={70}
                stroke={6}
                className="text-tint"
              >
                <span className="text-[14px] font-bold tabular-nums">
                  {totalQuestionsInTopic ? Math.round((filteredCompleted / totalQuestionsInTopic) * 100) : 0}%
                </span>
              </Ring>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[15px] font-semibold text-label">
                  {formatNumber(filteredCompleted)} / {formatNumber(totalQuestionsInTopic)}টি প্রশ্ন পড়া হয়েছে
                </p>
                <p className="text-[13px] text-secondary">
                  বাকি রয়েছে: {formatNumber(Math.max(0, totalQuestionsInTopic - filteredCompleted))}টি প্রশ্ন
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-separator/40 pt-3 flex items-center justify-between">
              <span className="text-[12px] text-tertiary">
                পড়া প্রশ্নগুলো আর দৈনিক টার্গেটে আসবে না।
              </span>
              <button
                type="button"
                onClick={handleResetTopic}
                className="flex items-center gap-1 text-[13px] font-semibold text-ios-red hover:underline"
              >
                <ResetIcon className="size-3.5" />
                রিসেট
              </button>
            </div>
          </section>

          {/* Streak Card */}
          <section className="rounded-2xl border border-separator/80 bg-surface/80 p-5 shadow-sm backdrop-blur-md">
            <h3 className="text-[17px] font-bold text-label flex items-center gap-2">
              <FlameIcon className="size-5 text-orange-500" />
              স্ট্রিক ও ধারাবাহিকতা
            </h3>

            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                <p className="text-[12px] font-semibold text-orange-600 dark:text-orange-400">
                  বর্তমান স্ট্রিক
                </p>
                <p className="mt-1 text-[26px] font-extrabold text-label">
                  🔥 {formatNumber(streak.current)} দিন
                </p>
              </div>

              <div className="rounded-xl border border-separator bg-surface p-4">
                <p className="text-[12px] font-semibold text-secondary">
                  সর্বোচ্চ স্ট্রিক
                </p>
                <p className="mt-1 text-[26px] font-extrabold text-label">
                  ⭐ {formatNumber(streak.best)} দিন
                </p>
              </div>
            </div>
          </section>

          {/* Past History Log */}
          <section className="rounded-2xl border border-separator/80 bg-surface/80 p-5 shadow-sm backdrop-blur-md">
            <h3 className="text-[17px] font-bold text-label">
              সাম্প্রতিক টার্গেট ইতিহাস
            </h3>

            {history.length === 0 ? (
              <p className="mt-3 text-[14px] text-tertiary text-center py-6">
                এখনও কোনো ইতিহাস সংরক্ষিত হয়নি। আজকের টার্গেট শেষ করলে এখানে যুক্ত হবে।
              </p>
            ) : (
              <div className="mt-3 divide-y divide-separator/40">
                {history.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-bold text-label">
                        {item.targetSubject} {item.targetTopic && `(${item.targetTopic})`}
                      </p>
                      <p className="text-[12px] text-secondary mt-0.5">
                        তারিখ: {item.date} · পড়া হয়েছে: {formatNumber(item.studiedCount)}/{formatNumber(item.totalQuestions)}টি
                      </p>
                    </div>

                    {item.examScore !== null && item.examScore !== undefined ? (
                      <span className="rounded-lg bg-ios-green/12 px-2.5 py-1 text-[13px] font-bold text-ios-green">
                        স্কোর: {formatNumber(item.examScore)}/{formatNumber(item.totalQuestions)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-tertiary">পরীক্ষা দেননি</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <DailyTargetSetup
        open={setupOpen}
        onClose={onCloseSetup}
        editingConfig={config}
      />
    </main>
  );
}
