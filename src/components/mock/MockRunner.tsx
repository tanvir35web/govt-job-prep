"use client";

import { useEffect, useState } from "react";
import { OPTION_LABELS, formatNumber } from "@/lib/format";
import type { MockSession } from "@/lib/mock-exam";
import type { MockQuestion } from "@/lib/types";
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
  question: MockQuestion;
  onSelect: (option: string) => void;
  onNext: () => void;
  onQuit: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const total = session.questions.length;
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
            size={40}
            stroke={3.5}
            animate={false}
            className={warn ? "text-ios-red" : "text-tint"}
          >
            <span className={`text-[13px] font-bold tabular-nums ${warn ? "text-ios-red" : ""}`}>{seconds}</span>
          </Ring>
        </div>
      </header>

      <main className="px-safe mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto pb-4">
        {/* Source paper and subject */}
        <p className="flex items-center gap-2 text-[13px] text-secondary">
          <span className="font-semibold text-tint">{question.subject}</span>
          {question.topic && <span>· {question.topic}</span>}
          <span className="truncate">· {question.examTitle}</span>
        </p>

        <h1 className="mt-3 text-[20px] leading-snug font-semibold">{question.question}</h1>

        <ol className="mt-6 flex flex-1 flex-col gap-2.5" aria-label="Options">
          {question.options.map((option, i) => {
            const selected = chosen === option;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelect(option)}
                  aria-pressed={selected}
                  className={`pressable flex w-full items-start gap-3 rounded-2xl p-4 text-left ring-[0.5px] transition-colors ${
                    selected
                      ? "bg-tint/15 ring-tint text-label"
                      : "bg-surface ring-black/5 dark:ring-white/10 active:bg-fill-strong"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${
                      selected ? "bg-tint text-white dark:text-black" : "bg-fill text-secondary"
                    }`}
                  >
                    {OPTION_LABELS[i]}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5 text-[16px] leading-snug">{option}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <footer className="mt-6 pt-2">
          <button
            type="button"
            onClick={onNext}
            className="pressable h-[50px] w-full rounded-[14px] bg-tint text-[17px] font-semibold text-white dark:text-black"
          >
            {last ? "Finish exam" : chosen === null ? "Skip question" : "Next question"}
          </button>
        </footer>
      </main>
    </div>
  );
}
