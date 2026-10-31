"use client";

import { useState } from "react";
import { formatNumber, OPTION_LABELS } from "@/lib/format";
import {
  type DailyTargetQuestion,
  type DailyTargetSession,
  markQuestionsAsCompleted,
  saveTodaySession,
  updateStreakOnDayComplete,
} from "@/lib/daily-target";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FlameIcon, LightbulbIcon, PlayIcon, ResetIcon, TargetIcon, TimerIcon, XIcon } from "@/components/icons";
import { Ring } from "@/components/Ring";

export function DailyTargetStudy({
  session,
  onGoToExam,
  onStartNextTarget,
}: {
  session: DailyTargetSession;
  onGoToExam: () => void;
  onStartNextTarget: () => void;
}) {
  const [mode, setMode] = useState<"practice" | "study">("practice");
  const [viewStyle, setViewStyle] = useState<"single" | "list">("single");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({}));

  const questions = session.questions;
  const total = questions.length;
  const currentQ = questions[currentIndex] ?? questions[0];

  const studiedSet = new Set(session.studiedKeys);
  const studiedCount = studiedSet.size;
  const isAllStudied = total > 0 && studiedCount >= total;

  const markStudied = (key: string, selectedOption?: string) => {
    if (selectedOption) {
      setAnswers((prev) => ({ ...prev, [key]: selectedOption }));
    }

    if (!studiedSet.has(key)) {
      const nextStudied = [...session.studiedKeys, key];
      const completed = nextStudied.length >= total;
      const updated: DailyTargetSession = {
        ...session,
        studiedKeys: nextStudied,
        isCompleted: completed,
        completedAt: completed ? Date.now() : session.completedAt,
      };
      saveTodaySession(updated);
      markQuestionsAsCompleted([key]);

      if (completed) {
        updateStreakOnDayComplete();
      }
    }
  };

  const markAllAsStudied = () => {
    const allKeys = questions.map((q) => q.key);
    const updated: DailyTargetSession = {
      ...session,
      studiedKeys: allKeys,
      isCompleted: true,
      completedAt: Date.now(),
    };
    saveTodaySession(updated);
    markQuestionsAsCompleted(allKeys);
    updateStreakOnDayComplete();
  };

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

  return (
    <div className="space-y-6">
      {/* Target Progress Bar & Header */}
      <section className="rounded-2xl border border-separator/80 bg-surface/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-tint uppercase tracking-wide">
                আজকের লক্ষ্য
              </span>
              <span className="text-[12px] text-tertiary">·</span>
              <span className="text-[12px] font-medium text-secondary">
                {session.targetSubject} {session.targetTopic && `(${session.targetTopic})`}
              </span>
            </div>
            <h2 className="mt-1 text-[18px] font-bold text-label">
              {formatNumber(studiedCount)} / {formatNumber(total)}টি পড়া হয়েছে
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-fill p-1">
              <button
                type="button"
                onClick={() => setMode("practice")}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all ${
                  mode === "practice" ? "bg-surface text-label shadow-xs" : "text-secondary hover:text-label"
                }`}
              >
                অনুশীলন
              </button>
              <button
                type="button"
                onClick={() => setMode("study")}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all ${
                  mode === "study" ? "bg-surface text-label shadow-xs" : "text-secondary hover:text-label"
                }`}
              >
                শিখন (উত্তর সহ)
              </button>
            </div>

            {/* View Style Switcher */}
            <div className="flex rounded-xl bg-fill p-1">
              <button
                type="button"
                onClick={() => setViewStyle("single")}
                className={`rounded-lg px-2 py-1 text-[12px] font-semibold transition-all ${
                  viewStyle === "single" ? "bg-surface text-label shadow-xs" : "text-secondary"
                }`}
                title="একক প্রশ্ন ভিউ"
              >
                একক
              </button>
              <button
                type="button"
                onClick={() => setViewStyle("list")}
                className={`rounded-lg px-2 py-1 text-[12px] font-semibold transition-all ${
                  viewStyle === "list" ? "bg-surface text-label shadow-xs" : "text-secondary"
                }`}
                title="সব প্রশ্ন একসাথে"
              >
                তালিকা
              </button>
            </div>
          </div>
        </div>

        {/* Progress Tracker Bar */}
        <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-fill">
          <div
            className="h-full rounded-full bg-tint transition-all duration-300"
            style={{ width: `${total ? (studiedCount / total) * 100 : 0}%` }}
          />
        </div>
      </section>

      {/* Completion Banner if all studied */}
      {isAllStudied && (
        <div className="animate-fade-in overflow-hidden rounded-2xl border border-ios-green/40 bg-ios-green/10 p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ios-green text-white shadow-md">
              <CheckIcon className="size-6 stroke-[2.5]" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] font-bold text-label">
                🎉 অভিনন্দন! আজকের পড়া সম্পন্ন হয়েছে!
              </h3>
              <p className="mt-1 text-[14px] leading-relaxed text-secondary">
                আপনি আজকের নির্ধারিত {formatNumber(total)}টি প্রশ্ন সফলভাবে পড়া শেষ করেছেন। এবার প্রস্তুতি যাচাই করার জন্য একটি পরীক্ষা দিন!
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onGoToExam}
                  className="flex h-10 items-center gap-1.5 rounded-xl bg-ios-green px-4 text-[14px] font-semibold text-white shadow transition-all hover:opacity-90 active:scale-95"
                >
                  <TimerIcon className="size-4 stroke-[2.2]" />
                  আজকের টার্গেটের ওপর পরীক্ষা দিন
                </button>

                <button
                  type="button"
                  onClick={onStartNextTarget}
                  className="flex h-10 items-center gap-1.5 rounded-xl border border-separator bg-surface px-4 text-[13px] font-semibold text-label shadow-xs transition-all hover:bg-fill active:scale-95"
                >
                  🚀 পরবর্তী দিনের টার্গেট শুরু করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Question View */}
      {viewStyle === "single" && currentQ && (
        <div className="rounded-2xl border border-separator/80 bg-surface/90 p-5 shadow-sm backdrop-blur-md">
          {/* Header of single question */}
          <div className="flex items-center justify-between border-b border-separator/50 pb-3">
            <span className="text-[13px] font-bold text-tint">
              প্রশ্ন {formatNumber(currentIndex + 1)} / {formatNumber(total)}
            </span>
            <div className="flex items-center gap-2">
              {studiedSet.has(currentQ.key) && (
                <span className="flex items-center gap-1 text-[12px] font-semibold text-ios-green">
                  <CheckIcon className="size-3.5 stroke-[2.5]" />
                  পড়া সম্পন্ন
                </span>
              )}
              {currentQ.topic && (
                <span className="rounded-md bg-fill px-2 py-0.5 text-[11px] font-medium text-secondary">
                  {currentQ.topic}
                </span>
              )}
            </div>
          </div>

          {/* Question Text */}
          <h3 className="mt-4 text-[18px] font-semibold leading-relaxed text-label">
            {currentQ.question}
          </h3>

          {/* Options Grid */}
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {currentQ.options.map((option, i) => {
              const selected = answers[currentQ.key];
              const revealed = mode === "study" || selected !== undefined;
              const isCorrect = option === currentQ.correct_answer;
              const isSelected = option === selected;

              let tone = "border-separator bg-surface hover:bg-fill";
              let labelTone = "text-secondary";

              if (revealed && isCorrect) {
                tone = "border-ios-green/60 bg-ios-green/10 text-ios-green font-medium";
                labelTone = "text-ios-green font-bold";
              } else if (revealed && isSelected && !isCorrect) {
                tone = "border-ios-red/60 bg-ios-red/10 text-ios-red";
                labelTone = "text-ios-red font-bold";
              } else if (revealed) {
                tone = "border-separator/50 opacity-75";
              }

              return (
                <button
                  key={i}
                  type="button"
                  disabled={revealed}
                  onClick={() => markStudied(currentQ.key, option)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[15px] transition-all ${tone} ${
                    revealed ? "cursor-default" : "cursor-pointer active:scale-[0.99]"
                  }`}
                >
                  <span className={`w-5 shrink-0 text-[14px] font-bold ${labelTone}`}>
                    {OPTION_LABELS[i] ?? formatNumber(i + 1)}
                  </span>
                  <span className="flex-1">{option}</span>
                  {revealed && isCorrect && <CheckIcon className="size-4.5 shrink-0 stroke-[2.5]" />}
                  {revealed && isSelected && !isCorrect && <XIcon className="size-4.5 shrink-0 stroke-[2.5]" />}
                </button>
              );
            })}
          </div>

          {/* Feedback & Explanation */}
          {(mode === "study" || answers[currentQ.key] !== undefined) && (
            <div className="mt-5 space-y-3 pt-3 border-t border-separator/40">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-ios-green">
                  সঠিক উত্তর: {currentQ.correct_answer}
                </span>
              </div>

              {currentQ.explanation && (
                <div className="rounded-xl border-l-3 border-amber-500 bg-amber-500/8 p-3 text-[14px] text-label/90">
                  <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-[12px] uppercase tracking-wide">
                    <LightbulbIcon className="size-3.5" />
                    ব্যাখ্যা
                  </div>
                  <p className="mt-1 leading-relaxed">{currentQ.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* Single Question Footer Navigation */}
          <div className="mt-6 flex items-center justify-between border-t border-separator/50 pt-4">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex h-9 items-center gap-1 rounded-xl border border-separator bg-surface px-3 text-[13px] font-semibold text-secondary hover:text-label disabled:opacity-30"
            >
              <ChevronLeftIcon className="size-4 stroke-[2.5]" />
              পূর্ববর্তী
            </button>

            {!studiedSet.has(currentQ.key) && (
              <button
                type="button"
                onClick={() => markStudied(currentQ.key)}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-tint/12 px-3 text-[13px] font-semibold text-tint hover:bg-tint/20"
              >
                <CheckIcon className="size-3.5 stroke-[2.5]" />
                পড়া হয়েছে চিহ্নিত করুন
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex === total - 1}
              className="flex h-9 items-center gap-1 rounded-xl bg-tint px-3.5 text-[13px] font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-30"
            >
              পরবর্তী
              <ChevronRightIcon className="size-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Quick Question Selector Pills */}
          <div className="mt-5 flex flex-wrap gap-1.5 pt-2">
            {questions.map((q, idx) => {
              const active = idx === currentIndex;
              const done = studiedSet.has(q.key);
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`size-7 rounded-lg text-[12px] font-bold transition-all ${
                    active
                      ? "ring-2 ring-tint bg-tint text-white"
                      : done
                      ? "bg-ios-green/15 text-ios-green hover:bg-ios-green/25"
                      : "bg-fill text-secondary hover:text-label"
                  }`}
                >
                  {formatNumber(idx + 1)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewStyle === "list" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[13px] text-secondary">
              তালিকা থেকে সরাসরি অনুশীলন ও পড়ুন
            </span>
            <button
              type="button"
              onClick={markAllAsStudied}
              className="text-[13px] font-semibold text-tint hover:underline"
            >
              সব পড়া সম্পন্ন চিহ্নিত করুন
            </button>
          </div>

          {questions.map((q, idx) => {
            const selected = answers[q.key];
            const revealed = mode === "study" || selected !== undefined;
            const isStudied = studiedSet.has(q.key);

            return (
              <article
                key={q.key}
                className="rounded-2xl border border-separator/80 bg-surface/80 p-4 shadow-xs backdrop-blur-md"
              >
                <div className="flex items-center justify-between text-[12px] text-secondary pb-2 border-b border-separator/40">
                  <span className="font-bold text-tint">প্রশ্ন {formatNumber(idx + 1)}</span>
                  {isStudied && (
                    <span className="flex items-center gap-1 font-semibold text-ios-green">
                      <CheckIcon className="size-3.5 stroke-[2.5]" /> পড়া সম্পন্ন
                    </span>
                  )}
                </div>

                <h4 className="mt-2 text-[16px] font-semibold leading-relaxed text-label">
                  {q.question}
                </h4>

                <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, i) => {
                    const isCorrect = opt === q.correct_answer;
                    const isSelected = opt === selected;

                    let tone = "border-separator bg-surface";
                    let labelTone = "text-secondary";

                    if (revealed && isCorrect) {
                      tone = "border-ios-green/60 bg-ios-green/10 text-ios-green font-medium";
                      labelTone = "text-ios-green font-bold";
                    } else if (revealed && isSelected && !isCorrect) {
                      tone = "border-ios-red/60 bg-ios-red/10 text-ios-red";
                      labelTone = "text-ios-red font-bold";
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={revealed}
                        onClick={() => markStudied(q.key, opt)}
                        className={`flex min-h-10 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[14px] transition-all ${tone} ${
                          revealed ? "cursor-default" : "cursor-pointer active:bg-fill"
                        }`}
                      >
                        <span className={`w-4 text-[13px] font-bold ${labelTone}`}>
                          {OPTION_LABELS[i] ?? formatNumber(i + 1)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {revealed && isCorrect && <CheckIcon className="size-4 shrink-0 stroke-[2.5]" />}
                        {revealed && isSelected && !isCorrect && <XIcon className="size-4 shrink-0 stroke-[2.5]" />}
                      </button>
                    );
                  })}
                </div>

                {revealed && q.explanation && (
                  <div className="mt-3 rounded-lg border-l-2 border-amber-500 bg-amber-500/8 p-2.5 text-[13px] text-label/90">
                    <p className="font-semibold text-amber-700 dark:text-amber-400 text-[11px] uppercase">
                      ব্যাখ্যা
                    </p>
                    <p className="mt-0.5">{q.explanation}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
