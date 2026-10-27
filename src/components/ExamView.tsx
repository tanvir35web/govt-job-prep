"use client";

import { useEffect, useMemo, useState } from "react";
import { formatExamDate, formatNumber, pluralize } from "@/lib/format";
import { saveExamOffline } from "@/lib/offline";
import { type Answers, defaultModeSetting, loadAnswers, saveAnswers, touchRecentExam } from "@/lib/settings";
import type { ExamDetailResponse, ExamInfo, Question } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import { CheckIcon, ChevronLeftIcon, ChevronUpIcon, ExternalLinkIcon, ResetIcon } from "./icons";
import { OfflineBadge } from "./OfflineBadge";
import { type Mode, QuestionCard } from "./QuestionCard";
import { Ring } from "./Ring";
import { Sheet } from "./Sheet";
import { ErrorState, Skeleton } from "./StatusViews";

const ALL = "__all__";
const WIDTH = "max-w-3xl lg:max-w-6xl";

export function ExamView({ slug }: { slug: string }) {
  const { state, retry } = useApi<ExamDetailResponse>(`/api/exams/${encodeURIComponent(slug)}`);
  const loaded = state.status === "success";

  // Once an exam has loaded, keep it (questions, page and assets) on the device for offline use.
  useEffect(() => {
    if (loaded && navigator.onLine) void saveExamOffline(slug);
  }, [loaded, slug]);

  if (state.status === "loading") return <ExamSkeleton />;

  if (state.status === "error") {
    return (
      <>
        <main className="px-safe flex-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {state.code === 404 ? (
            <ErrorState title="Exam not found" message="Check that the link is correct, or choose an exam from the list." showHomeLink />
          ) : state.code === 0 ? (
            <ErrorState
              offline
              title="No internet connection"
              message="This exam hasn't been opened before, so it isn't available offline."
              onRetry={retry}
              showHomeLink
            />
          ) : (
            <ErrorState title="Couldn't load questions" message="Something went wrong on the server. Try again in a moment." onRetry={retry} showHomeLink />
          )}
        </main>
      </>
    );
  }

  return <ExamContent slug={slug} info={state.data.exam_info} questions={state.data.questions} />;
}

function ExamContent({ slug, info, questions }: { slug: string; info: ExamInfo; questions: Question[] }) {
  const [mode, setMode] = useState<Mode>(defaultModeSetting.get);
  const [subject, setSubject] = useState(ALL);
  // Only rendered on the client after the fetch resolves, so reading localStorage here is safe.
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(slug));
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => saveAnswers(slug, answers), [slug, answers]);
  useEffect(() => touchRecentExam(slug), [slug]);

  const subjects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) counts.set(q.subject, (counts.get(q.subject) ?? 0) + 1);
    return [...counts.entries()];
  }, [questions]);

  const visible = subject === ALL ? questions : questions.filter((q) => q.subject === subject);
  const answered = questions.filter((q) => answers[q.question_no] !== undefined).length;
  const correct = questions.filter((q) => answers[q.question_no] === q.correct_answer).length;
  const progress = { total: questions.length, answered, correct, wrong: answered - correct };

  const select = (questionNo: number, option: string) => setAnswers((prev) => ({ ...prev, [questionNo]: option }));

  const reset = () => {
    if (answered === 0 || window.confirm("This will clear all your answers. Continue?")) {
      setAnswers({});
      window.scrollTo({ top: 0 });
    }
  };

  const chooseSubject = (name: string) => {
    setSubject(name);
    setDetailsOpen(false);
    document.getElementById("questions")?.scrollIntoView({ block: "start" });
  };

  const jumpTo = (id: string) => {
    setDetailsOpen(false);
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  const navItems = visible.map((q) => ({ id: `q-${q.question_no}`, number: q.question_no, answer: answers[q.question_no], correct: q.correct_answer }));

  return (
    <>
      <title>{`${info.exam_title} | Govt Job Prep`}</title>
      <main className={`px-safe mx-auto w-full ${WIDTH} flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12`}>
        {/* Phones go back from the bottom toolbar; wider screens have no toolbar, so they get this link. */}
        <AppLink href="/" className="pressable mb-4 hidden items-center text-[15px] text-tint lg:inline-flex">
          <ChevronLeftIcon className="-ml-1.5 size-5 stroke-[2.5]" /> All exams
        </AppLink>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-12">
          <div className="min-w-0">
            <ExamHeader info={info} available={questions.length} subjectCount={subjects.length} />

            {/* Desktop only; on phones the mode switch and subject choice are in the bottom bar. */}
            <div className="mt-6 hidden items-end justify-between gap-4 border-b border-separator lg:flex">
              <ModeTabs mode={mode} onChange={setMode} />
              <p className="hidden pb-2.5 text-[13px] text-secondary sm:block">
                {mode === "practice" ? "Choose an option to check your answer" : "Showing all answers and explanations"}
              </p>
            </div>

            {subjects.length > 1 && (
              <div className="mt-4 hidden flex-wrap gap-1 lg:flex">
                <SubjectChip active={subject === ALL} onClick={() => setSubject(ALL)} label="All subjects" count={questions.length} />
                {subjects.map(([name, count]) => (
                  <SubjectChip key={name} active={subject === name} onClick={() => setSubject(name)} label={name} count={count} />
                ))}
              </div>
            )}

            <div id="questions" className="mt-2 scroll-mt-[max(1rem,env(safe-area-inset-top))] divide-y divide-separator">
              {visible.map((q) => (
                <QuestionCard
                  key={q.question_no}
                  question={q}
                  mode={mode}
                  selected={answers[q.question_no]}
                  onSelect={(option) => select(q.question_no, option)}
                />
              ))}
            </div>

            {mode === "practice" && progress.answered === progress.total && progress.total > 0 && (
              <CompletionCard progress={progress} onReset={reset} />
            )}
          </div>

          <aside className="hidden lg:sticky lg:top-[max(1.25rem,env(safe-area-inset-top))] lg:block">
            <ProgressCard mode={mode} progress={progress} onReset={reset} />
            <div className="mt-8">
              <h2 className="text-[13px] font-semibold text-secondary">Go to question</h2>
              <QuestionNavigator items={navItems} mode={mode} onJump={jumpTo} className="mt-3 grid-cols-6" />
            </div>
          </aside>
        </div>
      </main>

      <BottomBar
        backHref="/"
        backLabel="Back to all exams"
        mode={mode}
        subjectLabel={subject === ALL ? "All subjects" : subject}
        progress={progress}
        onOpenDetails={() => setDetailsOpen(true)}
      />

      {/* Phones: the same details as the desktop sidebar, one tap away. */}
      {detailsOpen && (
        <Sheet title="Details" onClose={() => setDetailsOpen(false)}>
          <div className="mb-6 border-b border-separator pb-5">
            <h2 className="text-[13px] font-semibold text-secondary">Mode</h2>
            <ModeSwitch mode={mode} onChange={setMode} className="mt-2 w-full" />
            <p className="mt-2 text-[13px] text-secondary">
              {mode === "practice" ? "Choose an option to check your answer." : "All answers and explanations are shown."}
            </p>
          </div>
          {subjects.length > 1 && (
            <div className="mb-6 border-b border-separator pb-5">
              <h2 className="text-[13px] font-semibold text-secondary">Subject</h2>
              <div role="radiogroup" aria-label="Subject" className="mt-1 divide-y divide-separator">
                <SubjectOption active={subject === ALL} onClick={() => chooseSubject(ALL)} label="All subjects" count={questions.length} />
                {subjects.map(([name, count]) => (
                  <SubjectOption key={name} active={subject === name} onClick={() => chooseSubject(name)} label={name} count={count} />
                ))}
              </div>
            </div>
          )}
          <ProgressCard
            mode={mode}
            progress={progress}
            onReset={() => {
              setDetailsOpen(false);
              reset();
            }}
          />
          <div className="mt-6 border-t border-separator pt-5">
            <h2 className="text-[13px] font-semibold text-secondary">Go to question</h2>
            <QuestionNavigator items={navItems} mode={mode} onJump={jumpTo} className="mt-3 grid-cols-7 sm:grid-cols-10" />
          </div>
        </Sheet>
      )}
    </>
  );
}

// The pieces below are shared with the Study topic page (components/study/TopicView.tsx).

export type Progress = { total: number; answered: number; correct: number; wrong: number };

function ExamHeader({ info, available, subjectCount }: { info: ExamInfo; available: number; subjectCount: number }) {
  const hasSafeSource = /^https?:\/\//i.test(info.source_url);
  const meta = [
    formatExamDate(info.exam_date),
    info.exam_type,
    pluralize(info.total_questions, "question"),
    pluralize(info.total_marks, "mark"),
    pluralize(subjectCount, "subject"),
  ];

  return (
    <header>
      <p className="flex items-center gap-2 text-[13px] font-medium text-tint">
        <span className="min-w-0 truncate">{info.organization}</span>
        <OfflineBadge className="shrink-0" />
      </p>
      <h1 className="mt-1 text-[26px] leading-tight font-bold tracking-tight sm:text-[32px]">{info.exam_title}</h1>

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-secondary">
        {meta.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden="true" className="text-tertiary">
                ·
              </span>
            )}
            {item}
          </span>
        ))}
        {hasSafeSource && (
          <a
            href={info.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable ml-1 inline-flex items-center gap-1 font-medium text-tint"
          >
            Source <ExternalLinkIcon className="size-3.5" />
          </a>
        )}
      </p>

      {available < info.total_questions && (
        <p className="mt-2 text-[13px] text-tertiary">
          {formatNumber(available)} of {pluralize(info.total_questions, "question")} added here.
        </p>
      )}
    </header>
  );
}

// Two text tabs with an underline under the selected one; the row's bottom border is the track.
export function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const options: { value: Mode; label: string }[] = [
    { value: "practice", label: "Practice" },
    { value: "study", label: "Study" },
  ];

  return (
    <div role="radiogroup" aria-label="Mode" className="-mb-px flex gap-6">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          onClick={() => onChange(o.value)}
          className={`border-b-2 pb-2.5 text-[15px] transition-colors ${
            mode === o.value ? "border-label font-semibold text-label" : "border-transparent font-medium text-secondary active:text-label"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SubjectChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pressable inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium whitespace-nowrap ${
        active ? "bg-fill text-label" : "text-secondary"
      }`}
    >
      {label}
      <span className="text-[12px] text-tertiary tabular-nums">{formatNumber(count)}</span>
    </button>
  );
}

function SubjectOption({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className="pressable flex min-h-12 w-full items-center gap-3 py-2.5 text-left text-[16px]"
    >
      <span className={`min-w-0 flex-1 truncate ${active ? "font-semibold text-label" : "text-label"}`}>{label}</span>
      <span className="text-[13px] text-tertiary tabular-nums">{formatNumber(count)}</span>
      <span className="grid size-5 shrink-0 place-items-center text-tint">{active && <CheckIcon className="size-4.5 stroke-[2.5]" />}</span>
    </button>
  );
}

function ProgressBar({ progress }: { progress: Progress }) {
  const pct = (n: number) => (progress.total ? (n / progress.total) * 100 : 0);
  return (
    <div
      className="flex h-1 w-full overflow-hidden rounded-full bg-fill"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.answered}
      aria-label="Progress"
    >
      <div className="bg-ios-green transition-all duration-500" style={{ width: `${pct(progress.correct)}%` }} />
      <div className="bg-ios-red transition-all duration-500" style={{ width: `${pct(progress.wrong)}%` }} />
    </div>
  );
}

export function ProgressCard({ mode, progress, onReset }: { mode: Mode; progress: Progress; onReset: () => void }) {
  const accuracy = progress.answered ? Math.round((progress.correct / progress.answered) * 100) : 0;

  return (
    <div>
      <h2 className="text-[13px] font-semibold text-secondary">Progress</h2>
      <p className="mt-2 text-[34px] leading-none font-bold tabular-nums">
        {formatNumber(accuracy)}%<span className="ml-2 text-[13px] font-medium text-secondary">Accuracy</span>
      </p>
      <div className="mt-4">
        <ProgressBar progress={progress} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        <SmallStat label="Answered" value={progress.answered} className="text-label" />
        <SmallStat label="Correct" value={progress.correct} className="text-ios-green" />
        <SmallStat label="Wrong" value={progress.wrong} className="text-ios-red" />
      </dl>
      {mode === "study" && <p className="mt-3 text-[13px] text-secondary">Answer questions in Practice mode to see your progress here.</p>}
      <button
        type="button"
        onClick={onReset}
        disabled={progress.answered === 0}
        className="pressable mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-ios-red disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ResetIcon className="size-4" /> Start over
      </button>
    </div>
  );
}

function SmallStat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[12px] text-secondary">{label}</dt>
      <dd className={`text-[20px] font-semibold tabular-nums ${className}`}>{formatNumber(value)}</dd>
    </div>
  );
}

/** One numbered button in the question grid: the element id it scrolls to, the number shown, and how it was answered. */
export type NavItem = { id: string; number: number; answer: string | undefined; correct: string };

export function QuestionNavigator({ items, mode, onJump, className }: { items: NavItem[]; mode: Mode; onJump: (id: string) => void; className: string }) {
  return (
    <div className={`grid gap-1 ${className}`}>
      {items.map((item) => {
        let tone = "text-secondary active:bg-fill";
        if (mode === "practice" && item.answer !== undefined) {
          tone = item.answer === item.correct ? "bg-ios-green/12 text-ios-green" : "bg-ios-red/12 text-ios-red";
        }
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onJump(item.id)}
            aria-label={`Go to question ${formatNumber(item.number)}`}
            className={`pressable aspect-square rounded-full text-[14px] font-medium tabular-nums ${tone}`}
          >
            {formatNumber(item.number)}
          </button>
        );
      })}
    </div>
  );
}

// Phones only: a floating capsule above the home indicator, like the tab bar on the other pages. It holds
// the back button and a summary of the current view (subject and mode); tapping the summary opens the
// details sheet (mode, subject, progress, question list).
export function BottomBar({
  backHref,
  backLabel,
  mode,
  subjectLabel,
  progress,
  onOpenDetails,
}: {
  backHref: string;
  backLabel: string;
  mode: Mode;
  subjectLabel: string;
  progress: Progress;
  onOpenDetails: () => void;
}) {
  return (
    <div className="px-safe pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,calc(env(safe-area-inset-bottom)-0.5rem))] z-20 flex justify-center lg:hidden">
      <div className="ios-material pointer-events-auto flex w-full max-w-sm items-center gap-1 rounded-full p-1.5 shadow-[0_8px_32px_rgb(0_0_0/0.14),0_2px_6px_rgb(0_0_0/0.06)] ring-[0.5px] ring-separator dark:shadow-[0_8px_32px_rgb(0_0_0/0.6)] dark:ring-white/10">
        <AppLink href={backHref} aria-label={backLabel} className="pressable grid size-11 shrink-0 place-items-center rounded-full bg-fill text-tint">
          <ChevronLeftIcon className="size-6 stroke-[2.5]" />
        </AppLink>

        <button
          type="button"
          onClick={onOpenDetails}
          aria-haspopup="dialog"
          aria-label={`${subjectLabel}, ${mode === "practice" ? "Practice" : "Study"} mode. Show mode, subjects, progress and question list`}
          className="pressable flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full pr-3 pl-2 text-left"
        >
          {mode === "practice" && <Ring value={progress.answered} total={progress.total} size={24} stroke={3.5} />}
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
            {subjectLabel}
            <span className="font-medium text-secondary"> · {mode === "practice" ? "Practice" : "Study"}</span>
          </span>
          <ChevronUpIcon className="size-4 shrink-0 stroke-[2.5] text-tertiary" />
        </button>
      </div>
    </div>
  );
}

// Segmented control for the details sheet: a sliding thumb under the selected mode.
export function ModeSwitch({ mode, onChange, className = "" }: { mode: Mode; onChange: (mode: Mode) => void; className?: string }) {
  const options: { value: Mode; label: string }[] = [
    { value: "practice", label: "Practice" },
    { value: "study", label: "Study" },
  ];

  return (
    <div role="radiogroup" aria-label="Mode" className={`relative grid grid-cols-2 rounded-full bg-fill p-0.5 ${className}`}>
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-surface shadow-[0_2px_6px_rgb(0_0_0/0.12)] transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-fill-strong"
        style={{ transform: mode === "study" ? "translateX(100%)" : "none" }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          onClick={() => onChange(o.value)}
          className={`relative h-10 px-3 text-[15px] transition-colors ${mode === o.value ? "font-semibold text-label" : "font-medium text-secondary"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CompletionCard({ progress, onReset, children }: { progress: Progress; onReset: () => void; children?: React.ReactNode }) {
  const accuracy = Math.round((progress.correct / progress.total) * 100);
  const message = accuracy >= 80 ? "Excellent! You're well prepared." : accuracy >= 50 ? "Well done! A bit more practice will help." : "Don't give up. Try again.";

  return (
    <div className="mt-2 animate-fade-in border-t border-separator py-10 text-center">
      <p className="text-[13px] font-semibold text-secondary">Practice complete</p>
      <p className="mt-1 text-[48px] leading-tight font-bold tabular-nums">
        {formatNumber(progress.correct)}
        <span className="text-[28px] text-tertiary">/{formatNumber(progress.total)}</span>
      </p>
      <p className="mt-1 text-[15px] text-secondary">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="pressable mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-label px-6 text-[15px] font-semibold text-canvas"
      >
        <ResetIcon className="size-4.5" /> Practise again
      </button>
      {children}
    </div>
  );
}

export function ExamSkeleton() {
  return (
    <main className={`px-safe mx-auto w-full ${WIDTH} flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-16`} aria-busy="true" aria-label="Loading">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12">
        <div>
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="mt-3 h-7 w-full" />
          <Skeleton className="mt-2 h-7 w-2/3" />
          <Skeleton className="mt-4 h-4 w-3/4" />
          <Skeleton className="mt-7 h-6 w-48" />
          <div className="mt-2 divide-y divide-separator">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="py-6">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="mt-3 h-5 w-3/4" />
                <div className="mt-4 grid gap-2">
                  {Array.from({ length: 4 }, (_, j) => (
                    <Skeleton key={j} className="h-12 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="hidden h-64 rounded-xl lg:block" />
      </div>
    </main>
  );
}
