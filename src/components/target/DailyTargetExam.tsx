"use client";

import { useEffect, useState } from "react";
import { formatNumber, OPTION_LABELS } from "@/lib/format";
import {
  type DailyTargetSession,
  recordHistoryItem,
  saveTodaySession,
} from "@/lib/daily-target";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ResetIcon,
  TimerIcon,
} from "@/components/icons";

export function DailyTargetExam({
  session,
  secondsPerQuestion = 45,
  onBackToStudy,
  onStartNextTarget,
}: {
  session: DailyTargetSession;
  secondsPerQuestion?: number;
  onBackToStudy: () => void;
  onStartNextTarget: () => void;
}) {
  const questions = session.questions;
  const total = questions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => session.examAnswers ?? {});
  const [isFinished, setIsFinished] = useState<boolean>(() => session.examScore !== null);

  // Per-question timer
  const hasTimer = secondsPerQuestion > 0;
  const [timeLeft, setTimeLeft] = useState(secondsPerQuestion);

  const goToIndex = (idx: number) => {
    setCurrentIndex(idx);
    if (hasTimer) setTimeLeft(secondsPerQuestion);
  };

  useEffect(() => {
    if (!hasTimer || isFinished) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // Time expired for this question, advance to next
          setCurrentIndex((idx) => (idx < total - 1 ? idx + 1 : idx));
          return secondsPerQuestion;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasTimer, secondsPerQuestion, total, isFinished]);

  const selectOption = (questionKey: string, option: string) => {
    if (isFinished) return;
    setAnswers((prev) => ({ ...prev, [questionKey]: option }));
  };

  const handleFinish = () => {
    let correctCount = 0;
    for (const q of questions) {
      if (answers[q.key] === q.correct_answer) {
        correctCount++;
      }
    }

    const updated: DailyTargetSession = {
      ...session,
      examAnswers: answers,
      examScore: correctCount,
      examFinishedAt: Date.now(),
    };

    saveTodaySession(updated);
    setIsFinished(true);

    recordHistoryItem({
      date: session.date,
      targetSubject: session.targetSubject,
      targetTopic: session.targetTopic,
      totalQuestions: total,
      studiedCount: session.studiedKeys.length,
      examScore: correctCount,
      completedAt: Date.now(),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRetake = () => {
    setAnswers({});
    setIsFinished(false);
    setCurrentIndex(0);
    setTimeLeft(secondsPerQuestion);
    const updated: DailyTargetSession = {
      ...session,
      examAnswers: {},
      examScore: null,
      examFinishedAt: null,
    };
    saveTodaySession(updated);
  };

  // Current question in exam mode
  const currentQ = questions[currentIndex] ?? questions[0];

  // ------------------ RESULTS SCREEN ------------------
  if (isFinished) {
    let correct = 0;
    const wrongQuestions: typeof questions = [];

    for (const q of questions) {
      if (answers[q.key] === q.correct_answer) {
        correct++;
      } else {
        wrongQuestions.push(q);
      }
    }

    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return (
      <div className="space-y-6">
        {/* Simple Score Card */}
        <div className="rounded-2xl border border-separator/80 bg-surface/80 p-6 text-center shadow-sm">
          <p className="text-[13px] font-semibold text-secondary">পরীক্ষার ফলাফল</p>
          <p className="mt-2 text-[32px] font-extrabold text-label tabular-nums">
            {formatNumber(correct)} / {formatNumber(total)}
          </p>
          <p className="mt-1 text-[14px] font-medium text-tint">
            {formatNumber(percentage)}% সঠিক হয়েছে
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={handleRetake}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-separator bg-surface px-4 text-[13px] font-semibold text-label shadow-xs hover:bg-fill active:scale-95"
            >
              <ResetIcon className="size-3.5" />
              আবার দিন
            </button>

            <button
              type="button"
              onClick={onBackToStudy}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-separator bg-surface px-4 text-[13px] font-semibold text-secondary hover:text-label shadow-xs hover:bg-fill active:scale-95"
            >
              পড়া
            </button>

            <button
              type="button"
              onClick={onStartNextTarget}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-tint px-4 text-[13px] font-semibold text-white shadow-xs hover:opacity-90 active:scale-95"
            >
              পরের দিন
            </button>
          </div>
        </div>

        {/* Review Mistakes if any */}
        {wrongQuestions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[14px] font-bold text-secondary">
              ভুল হওয়া প্রশ্ন ({formatNumber(wrongQuestions.length)}টি)
            </h3>
            <div className="space-y-2.5">
              {wrongQuestions.map((q) => {
                const userChoice = answers[q.key];
                return (
                  <div
                    key={q.key}
                    className="rounded-2xl border border-separator/80 bg-surface/80 p-4 text-[14px]"
                  >
                    <p className="font-semibold text-label">{q.question}</p>
                    <div className="mt-2.5 space-y-1 text-[13px]">
                      {userChoice && (
                        <p className="text-ios-red font-medium">
                          আপনার উত্তর: {userChoice}
                        </p>
                      )}
                      <p className="text-ios-green font-medium">
                        সঠিক উত্তর: {q.correct_answer}
                      </p>
                      {q.explanation && (
                        <p className="mt-1 text-[12px] text-secondary">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ------------------ EXAM RUNNER SCREEN ------------------
  if (!currentQ) return null;

  const currentSelection = answers[currentQ.key];

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between text-[13px]">
        <button
          type="button"
          onClick={onBackToStudy}
          className="flex items-center gap-1 font-semibold text-secondary hover:text-label"
        >
          <ChevronLeftIcon className="size-4 stroke-[2.5]" />
          পড়া
        </button>

        <span className="font-semibold text-secondary tabular-nums">
          প্রশ্ন{" "}
          <strong className="font-bold text-label">
            {formatNumber(currentIndex + 1)}
          </strong>{" "}
          / {formatNumber(total)}
        </span>

        {hasTimer && (
          <span className="flex items-center gap-1 font-bold text-tint tabular-nums">
            <TimerIcon className="size-3.5" />
            {formatNumber(timeLeft)}s
          </span>
        )}
      </div>

      {/* Question */}
      <div className="pt-2">
        <h2 className="text-[18px] sm:text-[20px] font-semibold leading-relaxed text-label">
          {currentQ.question}
        </h2>
      </div>

      {/* Options */}
      <div className="space-y-2.5">
        {currentQ.options.map((option, i) => {
          const isSelected = option === currentSelection;
          return (
            <button
              key={i}
              type="button"
              onClick={() => selectOption(currentQ.key, option)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] sm:text-[16px] transition-all active:scale-[0.99] ${
                isSelected
                  ? "border-tint bg-tint/10 font-medium text-tint shadow-xs"
                  : "border-separator bg-surface text-label hover:bg-fill/60"
              }`}
            >
              <span
                className={`w-5 shrink-0 text-[14px] font-bold ${
                  isSelected ? "text-tint" : "text-secondary"
                }`}
              >
                {OPTION_LABELS[i] ?? formatNumber(i + 1)}
              </span>
              <span className="flex-1 leading-snug">{option}</span>
              {isSelected && <CheckIcon className="size-5 shrink-0 stroke-[2.5]" />}
            </button>
          );
        })}
      </div>

      {/* Footer Navigation - Fixed at bottom */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-separator/70 bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => goToIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-separator bg-surface px-4 text-[14px] font-semibold text-secondary transition-all hover:text-label active:scale-95 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeftIcon className="size-4 stroke-[2.5]" />
            আগের
          </button>

          <span className="text-[13px] font-bold text-secondary tabular-nums">
            {formatNumber(currentIndex + 1)} / {formatNumber(total)}
          </span>

          {currentIndex === total - 1 ? (
            <button
              type="button"
              onClick={handleFinish}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-tint px-5 text-[14px] font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-95"
            >
              জমা দিন
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goToIndex(Math.min(total - 1, currentIndex + 1))}
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
