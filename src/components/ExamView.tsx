"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatExamDate, toBn } from "@/lib/format";
import type { ExamDetailResponse, ExamInfo, Question } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import {
  ArrowLeftIcon,
  AwardIcon,
  BookOpenIcon,
  BuildingIcon,
  CalendarIcon,
  ExternalLinkIcon,
  GridIcon,
  ListIcon,
  ResetIcon,
  TargetIcon,
  XIcon,
} from "./icons";
import { type Mode, QuestionCard } from "./QuestionCard";
import { ErrorState, Skeleton } from "./StatusViews";

type Answers = Record<number, string>;

const ALL = "__all__";

export function ExamView({ slug }: { slug: string }) {
  const { state, retry } = useApi<ExamDetailResponse>(`/api/exams/${encodeURIComponent(slug)}`);

  if (state.status === "loading") return <ExamSkeleton />;

  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        {state.code === 404 ? (
          <ErrorState title="পরীক্ষাটি পাওয়া যায়নি" message="লিংকটি সঠিক কিনা দেখুন, অথবা তালিকা থেকে পরীক্ষা বেছে নিন।" showHomeLink />
        ) : (
          <ErrorState title="প্রশ্ন লোড করা যায়নি" message="সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" onRetry={retry} showHomeLink />
        )}
      </main>
    );
  }

  return <ExamContent slug={slug} info={state.data.exam_info} questions={state.data.questions} />;
}

function storageKey(slug: string) {
  return `exam-answers:${slug}`;
}

function loadAnswers(slug: string): Answers {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(slug)) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Answers) : {};
  } catch {
    return {};
  }
}

function ExamContent({ slug, info, questions }: { slug: string; info: ExamInfo; questions: Question[] }) {
  const [mode, setMode] = useState<Mode>("practice");
  const [subject, setSubject] = useState(ALL);
  // Only rendered on the client after the fetch resolves, so reading localStorage here is safe.
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(slug));
  const [navigatorOpen, setNavigatorOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify(answers));
    } catch {
      // Storage unavailable (private mode etc.); progress just won't persist.
    }
  }, [slug, answers]);

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
    if (answered === 0 || window.confirm("আপনার দেওয়া সব উত্তর মুছে ফেলা হবে। নিশ্চিত?")) {
      setAnswers({});
      window.scrollTo({ top: 0 });
    }
  };

  const jumpTo = (questionNo: number) => {
    setNavigatorOpen(false);
    document.getElementById(`q-${questionNo}`)?.scrollIntoView({ block: "start" });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-32 sm:px-6 lg:px-8 lg:pb-16">
      <title>{`${info.exam_title} | সরকারি চাকরি প্রস্তুতি`}</title>

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-full py-1 text-sm font-medium text-stone-500 transition hover:text-emerald-700 dark:text-stone-400 dark:hover:text-emerald-400"
      >
        <ArrowLeftIcon className="size-4" /> সব পরীক্ষা
      </Link>

      <ExamHeader info={info} available={questions.length} subjectCount={subjects.length} />

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
        <div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <ModeToggle mode={mode} onChange={setMode} />
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {mode === "practice" ? "একটি অপশন বেছে নিন, সাথে সাথে উত্তর ও ব্যাখ্যা দেখুন।" : "সব প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা দেখানো হচ্ছে।"}
            </p>
          </div>

          {subjects.length > 1 && (
            <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              <SubjectChip active={subject === ALL} onClick={() => setSubject(ALL)} label="সব বিষয়" count={questions.length} />
              {subjects.map(([name, count]) => (
                <SubjectChip key={name} active={subject === name} onClick={() => setSubject(name)} label={name} count={count} />
              ))}
            </div>
          )}

          <div className="mt-6 space-y-4 sm:space-y-5">
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

        <aside className="hidden lg:sticky lg:top-24 lg:block lg:space-y-5">
          <ProgressCard mode={mode} progress={progress} onReset={reset} />
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <h2 className="text-sm font-semibold">প্রশ্নে যান</h2>
            <QuestionNavigator questions={visible} mode={mode} answers={answers} onJump={jumpTo} className="mt-4 grid-cols-5" />
          </div>
        </aside>
      </div>

      <MobileProgressBar mode={mode} progress={progress} onOpenNavigator={() => setNavigatorOpen(true)} onReset={reset} />

      {navigatorOpen && (
        <NavigatorSheet onClose={() => setNavigatorOpen(false)}>
          <QuestionNavigator questions={visible} mode={mode} answers={answers} onJump={jumpTo} className="grid-cols-6 sm:grid-cols-10" />
        </NavigatorSheet>
      )}
    </main>
  );
}

type Progress = { total: number; answered: number; correct: number; wrong: number };

function ExamHeader({ info, available, subjectCount }: { info: ExamInfo; available: number; subjectCount: number }) {
  const hasSafeSource = /^https?:\/\//i.test(info.source_url);

  return (
    <section className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 p-6 text-white shadow-xl shadow-emerald-900/10 sm:p-8 lg:p-10">
      <div aria-hidden="true" className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-teal-400/20 blur-3xl" />

      <div className="relative">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-100">
          <BuildingIcon className="size-4" /> {info.organization}
        </p>
        <h1 className="mt-3 max-w-3xl text-2xl leading-snug font-bold sm:text-3xl lg:text-4xl lg:leading-tight">{info.exam_title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
            <CalendarIcon className="size-4" /> {formatExamDate(info.exam_date)}
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 font-semibold backdrop-blur">{info.exam_type}</span>
          {hasSafeSource && (
            <a
              href={info.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-emerald-100 underline-offset-4 transition hover:bg-white/10 hover:text-white hover:underline"
            >
              মূল উৎস <ExternalLinkIcon className="size-3.5" />
            </a>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-2 sm:max-w-lg sm:gap-3">
          <HeaderStat icon={<ListIcon className="size-4" />} label="মোট প্রশ্ন" value={toBn(info.total_questions)} />
          <HeaderStat icon={<AwardIcon className="size-4" />} label="পূর্ণমান" value={toBn(info.total_marks)} />
          <HeaderStat icon={<BookOpenIcon className="size-4" />} label="বিষয়" value={toBn(subjectCount)} />
        </dl>

        {available < info.total_questions && (
          <p className="mt-4 text-sm text-emerald-100/90">
            এখানে {toBn(info.total_questions)}টির মধ্যে {toBn(available)}টি প্রশ্ন যুক্ত করা হয়েছে।
          </p>
        )}
      </div>
    </section>
  );
}

function HeaderStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3 ring-1 ring-white/15 backdrop-blur sm:px-4">
      <dt className="flex items-center gap-1.5 text-xs text-emerald-100">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-xl font-bold sm:text-2xl">{value}</dd>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const options: { value: Mode; label: string; icon: React.ReactNode }[] = [
    { value: "practice", label: "অনুশীলন", icon: <TargetIcon className="size-4" /> },
    { value: "study", label: "পড়ার মোড", icon: <BookOpenIcon className="size-4" /> },
  ];

  return (
    <div role="radiogroup" aria-label="মোড নির্বাচন" className="grid grid-cols-2 rounded-2xl bg-stone-200/70 p-1 md:inline-grid dark:bg-stone-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition ${
            mode === o.value
              ? "bg-white text-emerald-700 shadow-sm dark:bg-stone-950 dark:text-emerald-400"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
          }`}
        >
          {o.icon}
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
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap transition ${
        active
          ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
          : "border-stone-300 bg-white text-stone-700 hover:border-emerald-400 hover:text-emerald-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-emerald-500"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-xs ${
          active ? "bg-white/20" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
        }`}
      >
        {toBn(count)}
      </span>
    </button>
  );
}

function ProgressBar({ progress }: { progress: Progress }) {
  const pct = (n: number) => (progress.total ? (n / progress.total) * 100 : 0);
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.answered}
      aria-label="অগ্রগতি"
    >
      <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${pct(progress.correct)}%` }} />
      <div className="bg-rose-400 transition-all duration-500" style={{ width: `${pct(progress.wrong)}%` }} />
    </div>
  );
}

function ProgressCard({ mode, progress, onReset }: { mode: Mode; progress: Progress; onReset: () => void }) {
  const accuracy = progress.answered ? Math.round((progress.correct / progress.answered) * 100) : 0;

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">আপনার অগ্রগতি</h2>
        <span className="text-xs text-stone-500 dark:text-stone-400">
          {toBn(progress.answered)}/{toBn(progress.total)}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold">
        {toBn(accuracy)}%
        <span className="ml-2 text-sm font-medium text-stone-500 dark:text-stone-400">নির্ভুলতা</span>
      </p>
      <div className="mt-4">
        <ProgressBar progress={progress} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <SmallStat label="উত্তর" value={progress.answered} className="text-stone-900 dark:text-white" />
        <SmallStat label="সঠিক" value={progress.correct} className="text-emerald-600 dark:text-emerald-400" />
        <SmallStat label="ভুল" value={progress.wrong} className="text-rose-500" />
      </dl>
      {mode === "study" && <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">অনুশীলন মোডে উত্তর দিলে অগ্রগতি এখানে দেখা যাবে।</p>}
      <button
        type="button"
        onClick={onReset}
        disabled={progress.answered === 0}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:hover:bg-stone-800"
      >
        <ResetIcon className="size-4" /> আবার শুরু করুন
      </button>
    </div>
  );
}

function SmallStat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-xl bg-stone-50 py-2 dark:bg-stone-800/60">
      <dt className="text-xs text-stone-500 dark:text-stone-400">{label}</dt>
      <dd className={`text-lg font-bold ${className}`}>{toBn(value)}</dd>
    </div>
  );
}

function QuestionNavigator({
  questions,
  mode,
  answers,
  onJump,
  className,
}: {
  questions: Question[];
  mode: Mode;
  answers: Answers;
  onJump: (questionNo: number) => void;
  className: string;
}) {
  return (
    <div className={`grid gap-2 ${className}`}>
      {questions.map((q) => {
        const answer = answers[q.question_no];
        let tone = "border-stone-200 bg-white text-stone-700 hover:border-emerald-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300";
        if (mode === "practice" && answer !== undefined) {
          tone =
            answer === q.correct_answer
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-rose-400 bg-rose-400 text-white";
        }
        return (
          <button
            key={q.question_no}
            type="button"
            onClick={() => onJump(q.question_no)}
            aria-label={`প্রশ্ন ${toBn(q.question_no)}-এ যান`}
            className={`aspect-square rounded-xl border text-sm font-semibold transition ${tone}`}
          >
            {toBn(q.question_no)}
          </button>
        );
      })}
    </div>
  );
}

function MobileProgressBar({
  mode,
  progress,
  onOpenNavigator,
  onReset,
}: {
  mode: Mode;
  progress: Progress;
  onOpenNavigator: () => void;
  onReset: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden dark:border-stone-800 dark:bg-stone-950/90">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="min-w-0 flex-1">
          {mode === "practice" ? (
            <>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold">
                  উত্তর {toBn(progress.answered)}/{toBn(progress.total)}
                </span>
                <span className="text-stone-500 dark:text-stone-400">
                  <span className="text-emerald-600 dark:text-emerald-400">সঠিক {toBn(progress.correct)}</span>
                  {" · "}
                  <span className="text-rose-500">ভুল {toBn(progress.wrong)}</span>
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar progress={progress} />
              </div>
            </>
          ) : (
            <p className="text-sm font-medium text-stone-600 dark:text-stone-300">পড়ার মোড · {toBn(progress.total)}টি প্রশ্ন</p>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenNavigator}
          aria-label="প্রশ্ন তালিকা খুলুন"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm transition active:scale-95"
        >
          <GridIcon className="size-5" />
        </button>
        {mode === "practice" && (
          <button
            type="button"
            onClick={onReset}
            disabled={progress.answered === 0}
            aria-label="আবার শুরু করুন"
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-stone-300 transition active:scale-95 disabled:opacity-40 dark:border-stone-700"
          >
            <ResetIcon className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function NavigatorSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="প্রশ্ন তালিকা">
      <button type="button" aria-label="বন্ধ করুন" onClick={onClose} className="absolute inset-0 animate-fade-in bg-stone-950/50" />
      <div className="absolute inset-x-0 bottom-0 max-h-[75vh] animate-fade-in overflow-y-auto rounded-t-3xl bg-white px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-stone-900">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-stone-300 dark:bg-stone-700" />
        <div className="mt-4 mb-4 flex items-center justify-between">
          <h2 className="font-semibold">প্রশ্নে যান</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="grid size-9 place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <XIcon className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CompletionCard({ progress, onReset }: { progress: Progress; onReset: () => void }) {
  const accuracy = Math.round((progress.correct / progress.total) * 100);
  const message = accuracy >= 80 ? "অসাধারণ! চমৎকার প্রস্তুতি।" : accuracy >= 50 ? "ভালো হয়েছে! আরেকটু অনুশীলন করুন।" : "হাল ছাড়বেন না, আবার চেষ্টা করুন।";

  return (
    <div className="mt-8 animate-fade-in rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 text-center sm:p-8 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-teal-500/5">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">অনুশীলন সম্পন্ন</p>
      <p className="mt-2 text-4xl font-bold sm:text-5xl">
        {toBn(progress.correct)}
        <span className="text-2xl text-stone-400 sm:text-3xl">/{toBn(progress.total)}</span>
      </p>
      <p className="mt-2 text-stone-600 dark:text-stone-300">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        <ResetIcon className="size-4" /> আবার অনুশীলন করুন
      </button>
    </div>
  );
}

export function ExamSkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8" aria-busy="true" aria-label="লোড হচ্ছে">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-4 h-64 w-full rounded-3xl" />
      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
        <div className="space-y-5">
          <Skeleton className="h-11 w-full rounded-2xl md:w-72" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-4 h-6 w-3/4" />
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, j) => (
                  <Skeleton key={j} className="h-12 rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="hidden h-80 rounded-3xl lg:block" />
      </div>
    </main>
  );
}
