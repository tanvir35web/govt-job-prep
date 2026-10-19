"use client";

import { useEffect, useState } from "react";
import { OPTION_LABELS, formatNumber } from "@/lib/format";
import type { MockSession } from "@/lib/mock-exam";
import type { BankQuestion } from "@/lib/question-bank";
import { XIcon } from "../icons";
import { Ring } from "../Ring";

const WARN_SECONDS = 10;

// The exam itself: full screen over the tab bar, one question at a time, each with its own countdown.
// No feedback until the end. When time runs out the exam moves on and the question counts as skipped.
export function MockRunner({
  session,
  question,
  onSelect,
  onNext,
  onQuit,
}: {
  session: MockSession;
  question: BankQuestion;
  onSelect: (option: string) => void;
  onNext: () => void;
  onQuit: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const total = session.items.length;
  const last = session.index === total - 1;
  const chosen = session.answers[session.index];
  const limitMs = session.config.seconds * 1000;
  const remainingMs = Math.max(0, session.deadline - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const expired = remainingMs === 0;
  const warn = seconds <= WARN_SECONDS;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  // Time's up: move on once per question.
  useEffect(() => {
    if (expired) onNext();
  }, [expired, session.index, onNext]);

  // Keep the page from scrolling behind the overlay, and the screen awake during the exam where supported.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let lock: WakeLockSentinel | null = null;
    const requestLock = () => {
      if (document.visibilityState === "visible") {
        navigator.wakeLock
          ?.request("screen")
          .then((l) => (lock = l))
          .catch(() => {});
      }
    };
    requestLock();
    document.addEventListener("visibilitychange", requestLock);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("visibilitychange", requestLock);
      void lock?.release().catch(() => {});
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-canvas" role="dialog" aria-modal="true" aria-label="Exam in progress">
      <header className="px-safe pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button
            type="button"
            onClick={onQuit}
            aria-label="Quit exam"
            className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-secondary"
          >
            <XIcon className="size-5 stroke-[2.5]" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tabular-nums">
              Question {formatNumber(session.index + 1)} of {formatNumber(total)}
            </p>
            <div
              className="mt-1.5 h-1 overflow-hidden rounded-full bg-fill"
              role="progressbar"
              aria-label="Exam progress"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={session.index}
            >
              <div className="h-full rounded-full bg-tint transition-[width] duration-300" style={{ width: `${(session.index / total) * 100}%` }} />
            </div>
          </div>
          <Ring
            value={remainingMs}
            total={limitMs}
            size={48}
            stroke={4}
            animate={false}
            className={warn ? "animate-pulse text-ios-red" : "text-tint"}
          >
            <span className={`text-[15px] font-bold tabular-nums ${warn ? "text-ios-red" : ""}`} aria-label={`${seconds} seconds left`}>
              {seconds}
            </span>
          </Ring>
        </div>
      </header>

      <main className="px-safe flex-1 overflow-y-auto overscroll-contain py-4">
        <article key={session.index} className="mx-auto max-w-xl animate-fade-in">
          <p className="truncate text-[13px] text-secondary">
            <span className="font-semibold text-tint">{question.subject}</span>
            {question.topic && ` · ${question.topic}`}
          </p>
          <h2 className={`mt-2 leading-snug font-bold ${question.question.length > 140 ? "text-[18px]" : "text-[21px]"}`}>{question.question}</h2>

          <div className="mt-5 grid gap-2.5">
            {question.options.map((option, i) => {
              const selected = option === chosen;
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(option)}
                  className={`flex min-h-13 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[16px] font-medium ring-1 transition-all duration-150 active:scale-[0.98] ${
                    selected ? "bg-tint/10 ring-2 ring-tint" : "bg-surface ring-separator"
                  }`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-bold ${
                      selected ? "bg-tint text-white dark:text-black" : "bg-fill text-secondary"
                    }`}
                  >
                    {OPTION_LABELS[i] ?? i + 1}
                  </span>
                  <span className="flex-1">{option}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 truncate text-[12px] text-tertiary">From: {question.examTitle}</p>
        </article>
      </main>

      <footer className="ios-material hairline-t px-safe pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={onNext}
            className={`pressable h-[50px] w-full rounded-[14px] text-[17px] font-semibold ${
              chosen ? "bg-tint text-white dark:text-black" : "bg-fill text-label"
            }`}
          >
            {last ? "Finish" : chosen ? "Next question" : "Skip"}
          </button>
        </div>
      </footer>
    </div>
  );
}
