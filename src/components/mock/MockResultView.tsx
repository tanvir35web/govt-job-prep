"use client";

import { useMemo, useState } from "react";
import { OPTION_LABELS, formatNumber, pluralize } from "@/lib/format";
import { type MockResult, type MockSession, formatDuration } from "@/lib/mock-exam";
import type { MockQuestion } from "@/lib/types";
import { CheckIcon, LightbulbIcon, ResetIcon, XIcon } from "../icons";
import { PageTitle } from "../PageTitle";
import { Ring } from "../Ring";
import { Segmented } from "../Segmented";

type Filter = "All" | "Wrong" | "Skipped";
type Reviewed = { question: MockQuestion; answer: string | null; status: "correct" | "wrong" | "skipped" };

export function MockResultView({
  result,
  session,
  questions,
  onRetry,
  onDone,
}: {
  result: MockResult;
  session: MockSession;
  /** The exam's questions, in the order they were asked. */
  questions: MockQuestion[];
  onRetry: () => void;
  onDone: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  const message = pct >= 80 ? "Excellent preparation." : pct >= 50 ? "Good work. A little more practice." : "Keep going. Try another round.";

  const reviewed = useMemo<Reviewed[]>(
    () =>
      questions.map((question, i) => {
        const answer = session.answers[i];
        return { question, answer, status: answer === null ? "skipped" : answer === question.correct_answer ? "correct" : "wrong" };
      }),
    [questions, session],
  );

  const bySubject = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    for (const r of reviewed) {
      const s = map.get(r.question.subject) ?? { correct: 0, total: 0 };
      s.total++;
      if (r.status === "correct") s.correct++;
      map.set(r.question.subject, s);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [reviewed]);

  const shown = reviewed.filter((r) => filter === "All" || r.status === filter.toLowerCase());

  return (
    <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
      <PageTitle title="Result" />

      <section className="mt-2 rounded-2xl bg-surface p-5 text-center" aria-label="Score">
        <div className="flex justify-center">
          <Ring value={result.correct} total={result.total} size={136} stroke={11}>
            <span className="block text-[40px] leading-none font-bold tabular-nums">{formatNumber(result.correct)}</span>
            <span className="text-[15px] text-secondary tabular-nums">of {formatNumber(result.total)}</span>
          </Ring>
        </div>
        <p className="mt-4 text-[20px] font-bold">{message}</p>
        <dl className="mt-4 grid grid-cols-4 rounded-xl bg-fill py-2.5">
          <Stat label="Correct" value={formatNumber(result.correct)} className="text-ios-green" />
          <Stat label="Wrong" value={formatNumber(result.wrong)} className="text-ios-red" divider />
          <Stat label="Skipped" value={formatNumber(result.skipped)} divider />
          <Stat label="Time" value={formatDuration(result.durationMs)} divider />
        </dl>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="pressable inline-flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-tint text-[17px] font-semibold text-white dark:text-black"
          >
            <ResetIcon className="size-5" /> New exam
          </button>
          <button
            type="button"
            onClick={onDone}
            className="pressable inline-flex h-[50px] items-center justify-center rounded-[14px] bg-fill text-[17px] font-semibold text-tint"
          >
            Done
          </button>
        </div>
      </section>

      {/* Breakdown per subject */}
      {bySubject.length > 1 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-secondary">By subject</h2>
          <ul className="overflow-hidden rounded-2xl bg-surface/60 ring-[0.5px] ring-black/5 dark:ring-white/10">
            {bySubject.map(([name, { correct, total }]) => {
              const spct = total ? Math.round((correct / total) * 100) : 0;
              return (
                <li key={name} className="flex items-center gap-3 py-2.5 pr-4 pl-4 [li:not(:last-child)_&]:hairline-b">
                  <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{name}</span>
                  <span className="shrink-0 text-[14px] text-secondary tabular-nums">
                    {formatNumber(correct)}/{formatNumber(total)}
                  </span>
                  <span className="w-12 shrink-0 text-right text-[14px] font-semibold tabular-nums text-secondary">{formatNumber(spct)}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Question review */}
      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-semibold text-secondary">{pluralize(shown.length, "question")}</h2>
          <Segmented label="Filter questions" options={["All", "Wrong", "Skipped"] as const} value={filter} onChange={setFilter} />
        </div>
        <ol className="flex flex-col gap-3">
          {shown.map(({ question, answer, status }, i) => (
            <li key={question.key ?? i} className="overflow-hidden rounded-2xl bg-surface/60 p-4 ring-[0.5px] ring-black/5 dark:ring-white/10">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12px] font-semibold text-tint">{question.subject}</p>
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-white dark:text-black ${
                    status === "correct" ? "bg-ios-green" : status === "wrong" ? "bg-ios-red" : "bg-secondary"
                  }`}
                >
                  {status === "correct" && <CheckIcon className="size-3.5 stroke-3" />}
                  {status === "wrong" && <XIcon className="size-3.5 stroke-3" />}
                  {status === "skipped" && <span className="text-[11px] font-bold">—</span>}
                </span>
              </div>
              <p className="mt-1 text-[16px] font-semibold">{question.question}</p>

              {/* Options */}
              <ul className="mt-3 flex flex-col gap-1.5" aria-label="Answers">
                {question.options.map((opt, oi) => {
                  const isCorrect = opt === question.correct_answer;
                  const isChosen = opt === answer;
                  const tone = isCorrect
                    ? "bg-ios-green/15 text-ios-green ring-[0.5px] ring-ios-green"
                    : isChosen
                      ? "bg-ios-red/15 text-ios-red ring-[0.5px] ring-ios-red"
                      : "text-secondary";
                  return (
                    <li key={oi} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 text-[15px] ${tone}`}>
                      <span className="shrink-0 font-bold">{OPTION_LABELS[oi]}.</span>
                      <span className="min-w-0 flex-1">{opt}</span>
                      {isCorrect && <CheckIcon className="size-4 shrink-0 stroke-[2.5]" />}
                      {isChosen && !isCorrect && <XIcon className="size-4 shrink-0 stroke-[2.5]" />}
                    </li>
                  );
                })}
              </ul>

              {question.explanation && (
                <div className="mt-3 rounded-xl bg-fill p-3 text-[14px]">
                  <p className="flex items-center gap-1.5 font-semibold text-tint">
                    <LightbulbIcon className="size-4" /> Explanation
                  </p>
                  <p className="mt-1 text-secondary">{question.explanation}</p>
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Stat({ label, value, className = "", divider }: { label: string; value: string; className?: string; divider?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-1 ${divider ? "border-l border-separator" : ""}`}>
      <dt className="text-[11px] text-secondary">{label}</dt>
      <dd className={`mt-0.5 text-[20px] font-bold tabular-nums ${className}`}>{value}</dd>
    </div>
  );
}
