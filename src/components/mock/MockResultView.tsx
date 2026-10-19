"use client";

import { useMemo, useState } from "react";
import { OPTION_LABELS, formatNumber, pluralize } from "@/lib/format";
import { type MockResult, type MockSession, formatDuration } from "@/lib/mock-exam";
import type { BankQuestion } from "@/lib/question-bank";
import { CheckIcon, LightbulbIcon, ResetIcon, XIcon } from "../icons";
import { PageTitle } from "../PageTitle";
import { Ring } from "../Ring";
import { Segmented } from "../Segmented";

type Filter = "All" | "Wrong" | "Skipped";
type Reviewed = { question: BankQuestion; answer: string | null; status: "correct" | "wrong" | "skipped" };

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
  questions: BankQuestion[];
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
          <button type="button" onClick={onDone} className="pressable h-[50px] rounded-[14px] bg-fill text-[17px] font-semibold text-tint">
            Done
          </button>
        </div>
        <p className="mt-3 text-[13px] text-secondary">
          New exam uses the same settings: {pluralize(result.config.count, "mark")}, {result.config.seconds}s each.
        </p>
      </section>

      {bySubject.length > 1 && (
        <section className="mt-7">
          <h2 className="mb-1.5 px-4 text-[13px] text-secondary">By subject</h2>
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {bySubject.map(([subject, s]) => (
              <li key={subject} className="pl-4">
                <div className="py-3 pr-4 [li:not(:last-child)>&]:hairline-b">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[17px]">{subject}</span>
                    <span className="shrink-0 text-[15px] text-secondary tabular-nums">
                      {formatNumber(s.correct)}/{formatNumber(s.total)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-fill">
                    <div className="h-full rounded-full bg-ios-green" style={{ width: `${(s.correct / s.total) * 100}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-7">
        <h2 className="mb-2 px-4 text-[13px] text-secondary">Review</h2>
        <Segmented label="Show questions" options={["All", "Wrong", "Skipped"] as const} value={filter} onChange={setFilter} />
        {shown.length === 0 ? (
          <p className="mt-6 text-center text-[15px] text-secondary">Nothing here.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {shown.map((r) => (
              <ReviewCard key={r.question.key} number={reviewed.indexOf(r) + 1} item={r} />
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, className = "", divider = false }: { label: string; value: string; className?: string; divider?: boolean }) {
  return (
    <div className={`flex flex-col-reverse ${divider ? "border-l-[0.5px] border-separator" : ""}`}>
      <dt className="text-[12px] text-secondary">{label}</dt>
      <dd className={`text-[17px] font-semibold tabular-nums ${className}`}>{value}</dd>
    </div>
  );
}

function ReviewCard({ number, item }: { number: number; item: Reviewed }) {
  const { question: q, answer, status } = item;
  const badge = {
    correct: { text: "Correct", tone: "bg-ios-green/15 text-ios-green" },
    wrong: { text: "Wrong", tone: "bg-ios-red/15 text-ios-red" },
    skipped: { text: "Skipped", tone: "bg-fill text-secondary" },
  }[status];

  return (
    <li className="rounded-2xl bg-surface p-4">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="min-w-0 truncate text-secondary">
          <span className="font-semibold text-label">Q{formatNumber(number)}</span> · {q.subject}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${badge.tone}`}>{badge.text}</span>
      </div>
      <h3 className="mt-2 text-[16px] leading-snug font-semibold">{q.question}</h3>
      <ul className="mt-3 grid gap-1.5">
        {q.options.map((option, i) => {
          const correct = option === q.correct_answer;
          const picked = option === answer;
          const tone = correct ? "bg-ios-green/12" : picked ? "bg-ios-red/12" : "";
          return (
            <li key={i} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[15px] ${tone} ${!correct && !picked ? "text-secondary" : ""}`}>
              <span className="w-4 shrink-0 text-[13px] font-semibold">{OPTION_LABELS[i] ?? i + 1}</span>
              <span className="flex-1">{option}</span>
              {correct && <CheckIcon className="size-4 shrink-0 stroke-3 text-ios-green" />}
              {picked && !correct && <XIcon className="size-4 shrink-0 stroke-3 text-ios-red" />}
            </li>
          );
        })}
      </ul>
      {q.explanation && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-ios-yellow [&::-webkit-details-marker]:hidden">
            <LightbulbIcon className="size-4" /> Explanation
          </summary>
          <p className="mt-1.5 text-[15px] leading-relaxed text-label/85">{q.explanation}</p>
        </details>
      )}
    </li>
  );
}
