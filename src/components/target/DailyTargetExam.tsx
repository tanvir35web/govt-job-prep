"use client";

import { useEffect, useMemo, useState } from "react";
import { formatNumber, OPTION_LABELS } from "@/lib/format";
import {
  type DailyTargetQuestion,
  type DailyTargetSession,
  recordHistoryItem,
  saveTodaySession,
} from "@/lib/daily-target";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, LightbulbIcon, ResetIcon, TimerIcon, XIcon } from "@/components/icons";
import { Ring } from "@/components/Ring";

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
  const [showNavSheet, setShowNavSheet] = useState(false);

  // Per-question timer
  const hasTimer = secondsPerQuestion > 0;
  const [timeLeft, setTimeLeft] = useState(secondsPerQuestion);

  // Reset timer on question change
  useEffect(() => {
    if (!hasTimer || isFinished) return;
    setTimeLeft(secondsPerQuestion);
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
  }, [currentIndex, hasTimer, secondsPerQuestion, total, isFinished]);

  const selectOption = (questionKey: string, option: string) => {
    if (isFinished) return;
    setAnswers((prev) => ({ ...prev, [questionKey]: option }));
  };

  const handleFinish = () => {
    const answeredCount = Object.keys(answers).length;
    if (
      answeredCount < total &&
      !window.confirm(
        `আপনি ${formatNumber(total)}টির মধ্যে ${formatNumber(answeredCount)}টি প্রশ্নের উত্তর দিয়েছেন। বাকিগুলো উত্তর না দিয়েই পরীক্ষা শেষ করতে চান?`,
      )
    ) {
      return;
    }

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
    if (window.confirm("আপনি কি আজকের পরীক্ষাটি পুনরায় শুরু করতে চান?")) {
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
    }
  };

  // Result Calculation
  const resultStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    for (const q of questions) {
      const chosen = answers[q.key];
      if (!chosen) {
        skipped++;
      } else if (chosen === q.correct_answer) {
        correct++;
      } else {
        wrong++;
      }
    }

    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, wrong, skipped, percentage };
  }, [questions, answers, total]);

  // Current question in exam mode
  const currentQ = questions[currentIndex] ?? questions[0];

  // ------------------ RESULTS SCREEN ------------------
  if (isFinished) {
    const { correct, wrong, skipped, percentage } = resultStats;

    let evaluation = "খুব ভালো চেষ্টা!";
    if (percentage >= 90) evaluation = "🏆 অসাধারণ প্রস্তুতি! আজকের সবগুলো বিষয়ে আপনার দখল চমৎকার!";
    else if (percentage >= 75) evaluation = "👏 বেশ ভালো ফলাফল! কয়েকটি ভুল হয়েছে, নিচের ব্যাখ্যাগুলো দেখে নিন।";
    else if (percentage >= 50) evaluation = "👍 ভালো পরীক্ষা হয়েছে! ভুল হওয়া প্রশ্নগুলো আরেকবার পড়ে ঝালিয়ে নিন।";
    else evaluation = "💪 নিয়মিত অনুশীলনে আরও উন্নতি হবে। চলুন প্রশ্নগুলোর ব্যাখ্যা দেখে নিই।";

    return (
      <div className="space-y-6">
        {/* Scorecard Hero */}
        <section className="overflow-hidden rounded-3xl border border-separator/80 bg-gradient-to-b from-surface via-surface to-fill/30 p-6 text-center shadow-sm backdrop-blur-md dark:border-white/10 sm:p-8">
          <span className="inline-flex rounded-full bg-tint/12 px-3 py-1 text-[13px] font-bold text-tint">
            টার্গেট পরীক্ষা ফলাফল
          </span>

          <div className="my-5 flex justify-center">
            <Ring value={correct} total={total} size={110} stroke={9} className="text-ios-green">
              <span className="flex flex-col items-center">
                <span className="text-[28px] font-extrabold leading-none tabular-nums text-label">
                  {formatNumber(correct)}
                </span>
                <span className="text-[12px] font-medium text-secondary">
                  / {formatNumber(total)}
                </span>
              </span>
            </Ring>
          </div>

          <h2 className="text-[22px] font-bold text-label">
            {formatNumber(percentage)}% নম্বর পেয়েছেন
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-secondary">
            {evaluation}
          </p>

          {/* Stats Bar */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-separator/60 rounded-2xl border border-separator/60 bg-surface/80 p-3 text-center">
            <div>
              <p className="text-[12px] font-semibold text-secondary">সঠিক</p>
              <p className="mt-0.5 text-[18px] font-bold text-ios-green tabular-nums">
                {formatNumber(correct)}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-secondary">ভুল</p>
              <p className="mt-0.5 text-[18px] font-bold text-ios-red tabular-nums">
                {formatNumber(wrong)}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-secondary">অনুত্তর</p>
              <p className="mt-0.5 text-[18px] font-bold text-tertiary tabular-nums">
                {formatNumber(skipped)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRetake}
              className="flex h-11 items-center gap-2 rounded-xl border border-separator bg-surface px-4 text-[14px] font-semibold text-label shadow-xs transition-all hover:bg-fill active:scale-95"
            >
              <ResetIcon className="size-4" />
              পুনরায় পরীক্ষা দিন
            </button>

            <button
              type="button"
              onClick={onBackToStudy}
              className="flex h-11 items-center gap-2 rounded-xl bg-tint px-4 text-[14px] font-semibold text-white shadow transition-all hover:opacity-90 active:scale-95"
            >
              📖 পড়া রিভিশন দিন
            </button>

            <button
              type="button"
              onClick={onStartNextTarget}
              className="flex h-11 items-center gap-2 rounded-xl border border-tint/30 bg-tint/10 px-4 text-[14px] font-semibold text-tint transition-all hover:bg-tint/20 active:scale-95"
            >
              🚀 পরবর্তী দিনের টার্গেট
            </button>
          </div>
        </section>

        {/* Detailed Question by Question Review */}
        <section className="space-y-4">
          <h3 className="px-1 text-[18px] font-bold text-label">
            প্রশ্ন পর্যালোচনা ও সঠিক ব্যাখ্যা
          </h3>

          {questions.map((q, idx) => {
            const chosen = answers[q.key];
            const isCorrect = chosen === q.correct_answer;
            const isSkipped = !chosen;

            return (
              <article
                key={q.key}
                className={`overflow-hidden rounded-2xl border p-4 shadow-xs backdrop-blur-md transition-all ${
                  isSkipped
                    ? "border-separator/80 bg-surface/70"
                    : isCorrect
                    ? "border-ios-green/30 bg-ios-green/4"
                    : "border-ios-red/30 bg-ios-red/4"
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-separator/40 text-[12px]">
                  <span className="font-bold text-tint">প্রশ্ন {formatNumber(idx + 1)}</span>
                  {isSkipped ? (
                    <span className="font-semibold text-tertiary">উত্তর দেননি</span>
                  ) : isCorrect ? (
                    <span className="flex items-center gap-1 font-bold text-ios-green">
                      <CheckIcon className="size-3.5 stroke-[2.5]" /> সঠিক উত্তর (+১)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-bold text-ios-red">
                      <XIcon className="size-3.5 stroke-[2.5]" /> ভুল উত্তর
                    </span>
                  )}
                </div>

                <h4 className="mt-2.5 text-[16px] font-semibold leading-relaxed text-label">
                  {q.question}
                </h4>

                <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, i) => {
                    const isOptionCorrect = opt === q.correct_answer;
                    const isUserChoice = opt === chosen;

                    let optionTone = "border-separator bg-surface text-secondary";
                    let labelTone = "text-secondary";

                    if (isOptionCorrect) {
                      optionTone = "border-ios-green/60 bg-ios-green/12 text-ios-green font-semibold";
                      labelTone = "text-ios-green font-bold";
                    } else if (isUserChoice && !isCorrect) {
                      optionTone = "border-ios-red/60 bg-ios-red/12 text-ios-red font-medium";
                      labelTone = "text-ios-red font-bold";
                    }

                    return (
                      <div
                        key={i}
                        className={`flex min-h-10 items-center gap-2.5 rounded-xl border px-3 py-2 text-[14px] ${optionTone}`}
                      >
                        <span className={`w-4 text-[13px] font-bold ${labelTone}`}>
                          {OPTION_LABELS[i] ?? formatNumber(i + 1)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {isOptionCorrect && <CheckIcon className="size-4 shrink-0 stroke-[2.5]" />}
                        {isUserChoice && !isCorrect && <XIcon className="size-4 shrink-0 stroke-[2.5]" />}
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <div className="mt-3.5 rounded-xl border-l-3 border-amber-500 bg-amber-500/8 p-3 text-[13px] text-label/90">
                    <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-[11px] uppercase tracking-wide">
                      <LightbulbIcon className="size-3.5" />
                      ব্যাখ্যা
                    </div>
                    <p className="mt-1 leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    );
  }

  // ------------------ EXAM RUNNER SCREEN ------------------
  const answeredCount = Object.keys(answers).length;
  const isCurrentAnswered = answers[currentQ.key] !== undefined;

  return (
    <div className="space-y-6">
      {/* Header with Timer and Question Count */}
      <section className="rounded-2xl border border-separator/80 bg-surface/80 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold text-tint uppercase tracking-wide">
              টার্গেট পরীক্ষা
            </p>
            <h2 className="mt-0.5 text-[18px] font-bold text-label">
              প্রশ্ন {formatNumber(currentIndex + 1)} / {formatNumber(total)}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {hasTimer && (
              <div className="flex items-center gap-2">
                <Ring
                  value={timeLeft}
                  total={secondsPerQuestion}
                  size={42}
                  stroke={4}
                  className={timeLeft <= 10 ? "text-ios-red" : "text-tint"}
                >
                  <span className={`text-[13px] font-bold tabular-nums ${timeLeft <= 10 ? "text-ios-red animate-pulse" : "text-label"}`}>
                    {formatNumber(timeLeft)}
                  </span>
                </Ring>
              </div>
            )}

            <button
              type="button"
              onClick={handleFinish}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-tint px-3.5 text-[13px] font-semibold text-white shadow-sm hover:opacity-90 active:scale-95"
            >
              জমা দিন ({formatNumber(answeredCount)}/{formatNumber(total)})
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-fill">
          <div
            className="h-full rounded-full bg-tint transition-all duration-300"
            style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }}
          />
        </div>
      </section>

      {/* Main Question Card */}
      <div className="rounded-2xl border border-separator/80 bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between border-b border-separator/50 pb-2.5">
          <span className="text-[13px] font-semibold text-secondary">
            সঠিক উত্তরটি নির্বাচন করুন
          </span>
          {isCurrentAnswered && (
            <span className="rounded-md bg-tint/12 px-2 py-0.5 text-[11px] font-bold text-tint">
              উত্তর দেওয়া হয়েছে
            </span>
          )}
        </div>

        <h3 className="mt-4 text-[18px] font-semibold leading-relaxed text-label sm:text-[20px]">
          {currentQ.question}
        </h3>

        {/* Exam Options (No answer feedback shown during exam) */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {currentQ.options.map((option, i) => {
            const isSelected = answers[currentQ.key] === option;

            return (
              <button
                key={i}
                type="button"
                onClick={() => selectOption(currentQ.key, option)}
                className={`flex min-h-13 w-full items-center gap-3.5 rounded-xl border px-4 py-3 text-left text-[15px] transition-all cursor-pointer ${
                  isSelected
                    ? "border-tint bg-tint/12 font-semibold text-tint ring-1 ring-tint"
                    : "border-separator bg-surface text-label hover:bg-fill active:scale-[0.99]"
                }`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-lg text-[13px] font-bold ${
                    isSelected ? "bg-tint text-white" : "bg-fill text-secondary"
                  }`}
                >
                  {OPTION_LABELS[i] ?? formatNumber(i + 1)}
                </span>
                <span className="flex-1">{option}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-separator/50 pt-4">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-separator bg-surface px-4 text-[13px] font-semibold text-secondary hover:text-label disabled:opacity-30"
          >
            <ChevronLeftIcon className="size-4 stroke-[2.5]" />
            পূর্ববর্তী
          </button>

          {currentIndex === total - 1 ? (
            <button
              type="button"
              onClick={handleFinish}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-ios-green px-5 text-[14px] font-semibold text-white shadow-sm hover:opacity-90 active:scale-95"
            >
              <CheckIcon className="size-4 stroke-[2.5]" />
              পরীক্ষা সম্পন্ন করুন
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-tint px-4 text-[13px] font-semibold text-white shadow-sm hover:opacity-90 active:scale-95"
            >
              পরবর্তী
              <ChevronRightIcon className="size-4 stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* Question Navigator Grid */}
        <div className="mt-6 border-t border-separator/40 pt-4">
          <p className="text-[12px] font-medium text-secondary mb-2">প্রশ্ন তালিকা:</p>
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q, idx) => {
              const active = idx === currentIndex;
              const answered = answers[q.key] !== undefined;

              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`size-8 rounded-lg text-[13px] font-bold transition-all ${
                    active
                      ? "ring-2 ring-tint bg-tint text-white"
                      : answered
                      ? "bg-tint/20 text-tint"
                      : "bg-fill text-secondary hover:text-label"
                  }`}
                >
                  {formatNumber(idx + 1)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
