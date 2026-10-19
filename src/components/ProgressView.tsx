"use client";

import { useEffect, useMemo, useState } from "react";
import { softToneFor } from "@/lib/covers";
import { formatExamDate, formatNumber, pluralize } from "@/lib/format";
import { type Answers, loadAnswers } from "@/lib/settings";
import type { ExamDetailResponse, ExamListItem, ExamListResponse, Question } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { Ring } from "./Ring";
import { ErrorState, Skeleton } from "./StatusViews";

// Progress in detail: an overview, how answers split into correct and wrong, accuracy by subject and a
// row per exam. Answers live on this device; telling right from wrong needs each exam's questions, so
// those are fetched for the exams that have answers (the service worker serves saved ones offline).

type ExamStat = {
  exam: ExamListItem;
  total: number;
  answered: number;
  /** null when the exam's questions could not be loaded, so right and wrong are unknown. */
  correct: number | null;
};

type SubjectStat = { name: string; answered: number; correct: number; total: number };

export function ProgressView() {
  const { state, retry } = useApi<ExamListResponse>("/api/exams?limit=100");
  const exams = useMemo(() => (state.status === "success" ? state.data.exams : []), [state]);
  const [details, setDetails] = useState<Map<string, Question[] | null> | null>(null);

  // Exams only arrive from a client-side fetch, so localStorage is available whenever this has entries.
  const answers = useMemo(() => new Map<string, Answers>(exams.map((e) => [e.slug, loadAnswers(e.slug)])), [exams]);

  useEffect(() => {
    if (state.status !== "success") return;
    const started = exams.filter((e) => Object.keys(answers.get(e.slug) ?? {}).length > 0);
    let cancelled = false;
    Promise.all(
      started.map(async (e): Promise<[string, Question[] | null]> => {
        try {
          const res = await fetch(`/api/exams/${encodeURIComponent(e.slug)}`);
          if (!res.ok) return [e.slug, null];
          const body = (await res.json()) as ExamDetailResponse;
          return [e.slug, body.questions];
        } catch {
          return [e.slug, null];
        }
      }),
    ).then((entries) => !cancelled && setDetails(new Map(entries)));
    return () => {
      cancelled = true;
    };
  }, [state.status, exams, answers]);

  const stats = useMemo(() => {
    if (!details) return null;
    const perExam: ExamStat[] = exams.map((exam) => {
      const given = answers.get(exam.slug) ?? {};
      const questions = details.get(exam.slug);
      const total = exam.exam_info.total_questions;
      const answered = Math.min(Object.keys(given).length, total);
      const correct = questions ? questions.filter((q) => given[q.question_no] === q.correct_answer).length : answered === 0 ? 0 : null;
      return { exam, total, answered, correct };
    });

    const subjects = new Map<string, SubjectStat>();
    for (const [slug, questions] of details) {
      const given = answers.get(slug) ?? {};
      for (const q of questions ?? []) {
        const s = subjects.get(q.subject) ?? { name: q.subject, answered: 0, correct: 0, total: 0 };
        s.total++;
        if (given[q.question_no] !== undefined) s.answered++;
        if (given[q.question_no] === q.correct_answer) s.correct++;
        subjects.set(q.subject, s);
      }
    }

    return {
      perExam,
      subjects: [...subjects.values()].filter((s) => s.answered > 0).sort((a, b) => b.answered - a.answered),
    };
  }, [details, exams, answers]);

  return (
    <main className="px-safe mx-auto w-full max-w-2xl flex-1 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <title>Progress | Govt Job Prep</title>
      <AppLink href="/" className="pressable -ml-1.5 inline-flex h-11 items-center text-[17px] text-tint">
        <ChevronLeftIcon className="size-6 stroke-[2.5]" /> Home
      </AppLink>
      <h1 className="mt-1 text-[34px] leading-tight font-bold tracking-tight">Progress</h1>

      {state.status === "error" &&
        (state.code === 0 ? (
          <ErrorState offline title="No internet connection" message="The exam list isn't saved on this device yet. Connect to the internet and try again." onRetry={retry} />
        ) : (
          <ErrorState title="Couldn't load your progress" message="Something went wrong on the server. Try again in a moment." onRetry={retry} />
        ))}

      {state.status !== "error" && !stats && <ProgressSkeleton />}

      {stats && (
        <div className="animate-fade-in">
          <Overview stats={stats.perExam} />
          <AnswerSplit stats={stats.perExam} />
          {stats.subjects.length > 0 && <BySubject subjects={stats.subjects} />}
          <ByExam stats={stats.perExam} />
        </div>
      )}
    </main>
  );
}

// ---- Shared pieces

function Card({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[13px] font-semibold text-secondary">{title}</h2>
        {detail && <span className="text-[12px] text-tertiary">{detail}</span>}
      </div>
      <div className="rounded-2xl bg-surface/60 p-4 ring-[0.5px] ring-black/5 dark:ring-white/10">{children}</div>
    </section>
  );
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

// Correct, wrong and unanswered as one bar. Segments are separated by a 2px gap and rounded only at the
// bar's ends; zero-width segments are left out so the gaps stay even.
function SplitBar({ correct, wrong, total, height = "h-2.5" }: { correct: number; wrong: number; total: number; height?: string }) {
  const segments = [
    { key: "correct", value: correct, className: "bg-ios-green" },
    { key: "wrong", value: wrong, className: "bg-ios-red" },
    { key: "rest", value: Math.max(0, total - correct - wrong), className: "bg-fill" },
  ].filter((s) => s.value > 0);

  return (
    <div className={`flex w-full gap-0.5 overflow-hidden rounded-full ${height}`} aria-hidden="true">
      {segments.length === 0 && <span className="flex-1 bg-fill" />}
      {segments.map((s) => (
        <span key={s.key} className={`${s.className} transition-[flex-grow] duration-500`} style={{ flexGrow: s.value, flexBasis: 0 }} />
      ))}
    </div>
  );
}

// ---- Overview

function Overview({ stats }: { stats: ExamStat[] }) {
  let total = 0;
  let answered = 0;
  let correct = 0;
  let checked = 0;
  let started = 0;
  let completed = 0;
  for (const s of stats) {
    total += s.total;
    answered += s.answered;
    if (s.correct !== null) {
      correct += s.correct;
      checked += s.answered;
    }
    if (s.answered > 0) started++;
    if (s.total > 0 && s.answered >= s.total) completed++;
  }

  return (
    <section className="mt-4 rounded-2xl bg-surface/60 p-5 ring-[0.5px] ring-black/5 dark:ring-white/10" aria-label="Overview">
      <div className="flex items-center gap-5">
        <Ring value={answered} total={total} size={104} stroke={10}>
          <span className="flex flex-col items-center leading-none">
            <span className="text-[24px] font-bold tabular-nums">{formatNumber(percent(answered, total))}%</span>
            <span className="mt-1 text-[11px] text-secondary">answered</span>
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-[28px] leading-none font-bold tabular-nums">
            {formatNumber(answered)}
            <span className="text-[17px] font-semibold text-tertiary"> / {formatNumber(total)}</span>
          </p>
          <p className="mt-1.5 text-[14px] text-secondary">questions answered</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 border-t border-separator pt-4 text-center">
        <Stat label="Accuracy" value={checked ? `${formatNumber(percent(correct, checked))}%` : "—"} />
        <Stat label="Started" value={formatNumber(started)} />
        <Stat label="Completed" value={formatNumber(completed)} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[12px] text-secondary">{label}</dt>
      <dd className="text-[20px] leading-tight font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

// ---- Answers: correct / wrong / not answered

function AnswerSplit({ stats }: { stats: ExamStat[] }) {
  let correct = 0;
  let wrong = 0;
  let total = 0;
  for (const s of stats) {
    total += s.total;
    if (s.correct !== null) {
      correct += s.correct;
      wrong += s.answered - s.correct;
    }
  }
  const rest = Math.max(0, total - correct - wrong);
  const legend = [
    { label: "Correct", value: correct, swatch: "bg-ios-green" },
    { label: "Wrong", value: wrong, swatch: "bg-ios-red" },
    { label: "Not answered", value: rest, swatch: "bg-fill-strong" },
  ];

  return (
    <Card title="Answers">
      <SplitBar correct={correct} wrong={wrong} total={total} height="h-3" />
      <ul className="mt-4 grid grid-cols-3 gap-2">
        {legend.map((item) => (
          <li key={item.label}>
            <span className="flex items-center gap-1.5 text-[12px] text-secondary">
              <span aria-hidden="true" className={`size-2 rounded-full ${item.swatch}`} />
              {item.label}
            </span>
            <span className="mt-0.5 block text-[17px] font-semibold tabular-nums">
              {formatNumber(item.value)}
              <span className="ml-1 text-[12px] font-medium text-tertiary">{formatNumber(percent(item.value, total))}%</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---- By subject: accuracy bars

function BySubject({ subjects }: { subjects: SubjectStat[] }) {
  return (
    <Card title="Accuracy by subject" detail="Answered questions only">
      <ul className="space-y-3.5">
        {subjects.map((s) => {
          const accuracy = percent(s.correct, s.answered);
          return (
            <li key={s.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] font-medium">{s.name}</span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatNumber(accuracy)}%</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill" aria-hidden="true">
                  <div className="h-full rounded-full bg-tint transition-[width] duration-500" style={{ width: `${accuracy}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-[12px] text-tertiary tabular-nums">
                  {formatNumber(s.correct)}/{formatNumber(s.answered)} correct
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---- By exam: one row each, linking to the exam

function ByExam({ stats }: { stats: ExamStat[] }) {
  const started = stats.filter((s) => s.answered > 0);
  const rest = stats.length - started.length;

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[13px] font-semibold text-secondary">By exam</h2>
        {rest > 0 && <span className="text-[12px] text-tertiary">{pluralize(rest, "exam")} not started</span>}
      </div>
      {started.length === 0 ? (
        <div className="rounded-2xl bg-surface/60 px-6 py-10 text-center ring-[0.5px] ring-black/5 dark:ring-white/10">
          <p className="text-[16px] font-semibold">No exams started yet</p>
          <p className="mt-1 text-[14px] text-secondary">Answer a question in any exam and it shows up here.</p>
          <AppLink href="/" className="pressable mt-4 inline-flex h-9 items-center rounded-full bg-fill px-4 text-[14px] font-semibold text-tint">
            Browse exams
          </AppLink>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface/60 ring-[0.5px] ring-black/5 dark:ring-white/10">
          {started.map((s, i) => (
            <li key={s.exam.slug}>
              <ExamRow stat={s} last={i === started.length - 1} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExamRow({ stat, last }: { stat: ExamStat; last: boolean }) {
  const info = stat.exam.exam_info;
  const tone = softToneFor(info.organization);
  const wrong = stat.correct === null ? 0 : stat.answered - stat.correct;

  return (
    <AppLink href={`/exams/${stat.exam.slug}`} className="flex items-center gap-3 pl-4 transition-colors active:bg-fill-strong">
      <div className={`flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-4 ${last ? "" : "hairline-b"}`}>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[12px] font-semibold ${tone.accent}`}>{info.organization}</p>
          <p className="mt-0.5 line-clamp-2 text-[15px] leading-snug font-semibold">{info.exam_title}</p>
          <div className="mt-2">
            {stat.correct === null ? (
              <div className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden="true">
                <div className="h-full rounded-full bg-tint" style={{ width: `${percent(stat.answered, stat.total)}%` }} />
              </div>
            ) : (
              <SplitBar correct={stat.correct} wrong={wrong} total={stat.total} height="h-2" />
            )}
          </div>
          <p className="mt-1.5 text-[12px] text-secondary tabular-nums">
            {formatNumber(stat.answered)}/{formatNumber(stat.total)} answered
            {stat.correct !== null && (
              <>
                {" · "}
                <span className="text-ios-green">{formatNumber(stat.correct)} correct</span>
                {" · "}
                <span className="text-ios-red">{formatNumber(wrong)} wrong</span>
              </>
            )}
            {" · "}
            {formatExamDate(info.exam_date)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-[17px] font-bold tabular-nums">{stat.correct === null ? "—" : `${formatNumber(percent(stat.correct, stat.answered))}%`}</span>
          <span className="text-[11px] text-tertiary">accuracy</span>
        </div>
        <ChevronRightIcon className="size-4.5 shrink-0 stroke-[2.5] text-tertiary" />
      </div>
    </AppLink>
  );
}

// ---- Loading

function ProgressSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mt-4 rounded-2xl bg-surface/60 p-5 ring-[0.5px] ring-black/5 dark:ring-white/10">
        <div className="flex items-center gap-5">
          <Skeleton className="size-26 shrink-0 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-10px),#000_calc(100%-10px))]" />
          <div className="flex-1">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-2.5 h-3.5 w-40" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-6 border-t border-separator pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="mt-6">
          <Skeleton className="mb-2 ml-1 h-3.5 w-24" />
          <div className="rounded-2xl bg-surface/60 p-4 ring-[0.5px] ring-black/5 dark:ring-white/10">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((j) => (
                <div key={j}>
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-1.5 h-4.5 w-10" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
