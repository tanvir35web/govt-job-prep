"use client";

import { useEffect, useMemo, useState } from "react";
import { formatNumber, OPTION_LABELS } from "@/lib/format";
import {
  type DailyTargetSession,
  markQuestionsAsCompleted,
  saveTodaySession,
  updateStreakOnDayComplete,
} from "@/lib/daily-target";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LightbulbIcon,
} from "@/components/icons";

export function DailyTargetStudy({
  session,
  onGoToExam,
  onStartNextTarget,
}: {
  session: DailyTargetSession;
  onGoToExam: () => void;
  onStartNextTarget: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const questions = session.questions;
  const total = questions.length;
  const currentQ = questions[currentIndex] ?? questions[0];

  const studiedSet = useMemo(() => new Set(session.studiedKeys), [session.studiedKeys]);
  const studiedCount = studiedSet.size;
  const hasTakenExam = session.examScore !== null && session.examScore !== undefined;

  // Auto-mark the current question as studied when viewed
  useEffect(() => {
    if (!currentQ) return;
    if (!studiedSet.has(currentQ.key)) {
      const nextStudied = [...session.studiedKeys, currentQ.key];
      const completed = nextStudied.length >= total;
      const updated: DailyTargetSession = {
        ...session,
        studiedKeys: nextStudied,
        isCompleted: completed,
        completedAt: completed ? (session.completedAt ?? Date.now()) : session.completedAt,
      };
      saveTodaySession(updated);
      markQuestionsAsCompleted([currentQ.key]);

      if (completed) {
        updateStreakOnDayComplete();
      }
    }
  }, [currentQ, session, total, studiedSet]);

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  if (!currentQ) return null;

  const isLastQuestion = currentIndex === total - 1;

  return (
    <div className="space-y-5">
      {/* Sleek Minimal Progress Tracker */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[13px] font-medium text-secondary">
          <span>
            প্রশ্ন{" "}
            <strong className="font-bold text-label tabular-nums">
              {formatNumber(currentIndex + 1)}
            </strong>{" "}
            / {formatNumber(total)}
          </span>
          <span className="text-[12px] tabular-nums">
            {formatNumber(studiedCount)}টি পড়া হয়েছে
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill">
          <div
            className="h-full rounded-full bg-tint transition-all duration-300"
            style={{ width: `${total ? (studiedCount / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Question Block */}
      <div className="pt-2">
        {currentQ.topic && (
          <p className="text-[12px] font-medium text-secondary">
            {currentQ.topic}
          </p>
        )}
        <h2 className="mt-1 text-[18px] sm:text-[20px] font-semibold leading-relaxed text-label">
          {currentQ.question}
        </h2>
      </div>

      {/* Options - Answer highlighted by default in study mode */}
      <div className="space-y-2.5">
        {currentQ.options.map((option, i) => {
          const isCorrect = option === currentQ.correct_answer;

          return (
            <div
              key={i}
              className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] sm:text-[16px] transition-all ${
                isCorrect
                  ? "border-ios-green/60 bg-ios-green/10 text-label font-medium dark:bg-ios-green/15"
                  : "border-separator/80 bg-surface/70 text-secondary"
              }`}
            >
              <span
                className={`w-5 shrink-0 text-[14px] font-bold ${
                  isCorrect ? "text-ios-green" : "text-tertiary"
                }`}
              >
                {OPTION_LABELS[i] ?? formatNumber(i + 1)}
              </span>
              <span className="flex-1 leading-snug">{option}</span>
              {isCorrect && (
                <CheckIcon className="size-5 shrink-0 stroke-[2.5] text-ios-green" />
              )}
            </div>
          );
        })}
      </div>

      {/* Explanation / Description - Shown by default */}
      {currentQ.explanation && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-3.5 text-[14px] leading-relaxed text-label">
          <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-[12px] uppercase tracking-wide">
            <LightbulbIcon className="size-3.5" />
            ব্যাখ্যা
          </div>
          <p className="mt-1 text-secondary leading-relaxed">{currentQ.explanation}</p>
        </div>
      )}

      {/* Subtle completion strip on the last question */}
      {isLastQuestion && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-separator/60 bg-surface/70 px-3.5 py-2.5 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-ios-green/10 text-ios-green">
              <CheckIcon className="size-3.5 stroke-[2.5]" />
            </span>
            <span className="text-secondary font-medium">
              {hasTakenExam
                ? `ফলাফল: ${formatNumber(session.examScore ?? 0)} / ${formatNumber(total)} সঠিক`
                : "পড়া শেষ, এবার পরীক্ষা দিন"}
            </span>
          </div>

          {hasTakenExam ? (
            <div className="flex items-center gap-2 text-[12.5px] font-semibold">
              <button
                type="button"
                onClick={onGoToExam}
                className="text-secondary hover:text-label"
              >
                আবার
              </button>
              <span className="text-tertiary">·</span>
              <button
                type="button"
                onClick={onStartNextTarget}
                className="text-tint hover:underline"
              >
                পরের দিন →
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGoToExam}
              className="font-bold text-tint hover:underline flex items-center gap-1"
            >
              পরীক্ষা শুরু
              <ChevronRightIcon className="size-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-separator/70 bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-separator bg-surface px-4 text-[14px] font-semibold text-secondary transition-all hover:text-label active:scale-95 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeftIcon className="size-4 stroke-[2.5]" />
            আগের
          </button>

          <span className="text-[13px] font-bold text-secondary tabular-nums">
            {formatNumber(currentIndex + 1)} / {formatNumber(total)}
          </span>

          {isLastQuestion ? (
            <button
              type="button"
              onClick={onGoToExam}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-tint px-4.5 text-[14px] font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-95"
            >
              পরীক্ষা
              <ChevronRightIcon className="size-4 stroke-[2.5]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-tint px-4.5 text-[14px] font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-95"
            >
              পরের
              <ChevronRightIcon className="size-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
