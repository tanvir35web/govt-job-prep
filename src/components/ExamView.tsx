"use client";

import { useEffect, useMemo, useState } from "react";
import { formatExamDate, toBn } from "@/lib/format";
import { saveExamOffline } from "@/lib/offline";
import { type Answers, defaultModeSetting, loadAnswers, saveAnswers, touchRecentExam } from "@/lib/settings";
import type { ExamDetailResponse, ExamInfo, Question } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import { ChevronLeftIcon, ExternalLinkIcon, GridIcon, ResetIcon } from "./icons";
import { OfflineBadge } from "./OfflineBadge";
import { type Mode, QuestionCard } from "./QuestionCard";
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
            <ErrorState title="পরীক্ষাটি পাওয়া যায়নি" message="লিংকটি সঠিক কিনা দেখুন, অথবা তালিকা থেকে পরীক্ষা বেছে নিন।" showHomeLink />
          ) : state.code === 0 ? (
            <ErrorState
              offline
              title="ইন্টারনেট সংযোগ নেই"
              message="এই পরীক্ষাটি আগে খোলা হয়নি, তাই অফলাইনে পাওয়া যাচ্ছে না।"
              onRetry={retry}
              showHomeLink
            />
          ) : (
            <ErrorState title="প্রশ্ন লোড করা যায়নি" message="সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" onRetry={retry} showHomeLink />
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
  const [navigatorOpen, setNavigatorOpen] = useState(false);

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
    <>
      <title>{`${info.exam_title} | সরকারি চাকরি প্রস্তুতি`}</title>
      <main className={`px-safe mx-auto w-full ${WIDTH} flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12`}>
        {/* Phones go back from the bottom toolbar; wider screens have no toolbar, so they get this link. */}
        <AppLink href="/" className="pressable mb-4 hidden items-center text-[15px] text-tint lg:inline-flex">
          <ChevronLeftIcon className="-ml-1.5 size-5 stroke-[2.5]" /> সব পরীক্ষা
        </AppLink>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-12">
          <div className="min-w-0">
            <ExamHeader info={info} available={questions.length} subjectCount={subjects.length} />

            <div className="mt-6 flex items-end justify-between gap-4 border-b border-separator">
              <ModeTabs mode={mode} onChange={setMode} />
              <p className="hidden pb-2.5 text-[13px] text-secondary sm:block">
                {mode === "practice" ? "অপশন বেছে নিয়ে যাচাই করুন" : "সব উত্তর ও ব্যাখ্যা দেখানো হচ্ছে"}
              </p>
            </div>

            {subjects.length > 1 && (
              <div className="no-scrollbar -mx-4 mt-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <SubjectChip active={subject === ALL} onClick={() => setSubject(ALL)} label="সব বিষয়" count={questions.length} />
                {subjects.map(([name, count]) => (
                  <SubjectChip key={name} active={subject === name} onClick={() => setSubject(name)} label={name} count={count} />
                ))}
              </div>
            )}

            <div className="mt-2 divide-y divide-separator">
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
              <h2 className="text-[13px] font-semibold text-secondary">প্রশ্নে যান</h2>
              <QuestionNavigator questions={visible} mode={mode} answers={answers} onJump={jumpTo} className="mt-3 grid-cols-6" />
            </div>
          </aside>
        </div>
      </main>

      <BottomToolbar mode={mode} progress={progress} onOpenNavigator={() => setNavigatorOpen(true)} onReset={reset} />

      {navigatorOpen && (
        <Sheet title="প্রশ্নে যান" onClose={() => setNavigatorOpen(false)}>
          <QuestionNavigator questions={visible} mode={mode} answers={answers} onJump={jumpTo} className="grid-cols-6 sm:grid-cols-10" />
        </Sheet>
      )}
    </>
  );
}

type Progress = { total: number; answered: number; correct: number; wrong: number };

function ExamHeader({ info, available, subjectCount }: { info: ExamInfo; available: number; subjectCount: number }) {
  const hasSafeSource = /^https?:\/\//i.test(info.source_url);
  const meta = [
    formatExamDate(info.exam_date),
    info.exam_type,
    `${toBn(info.total_questions)}টি প্রশ্ন`,
    `${toBn(info.total_marks)} নম্বর`,
    `${toBn(subjectCount)}টি বিষয়`,
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
            মূল উৎস <ExternalLinkIcon className="size-3.5" />
          </a>
        )}
      </p>

      {available < info.total_questions && (
        <p className="mt-2 text-[13px] text-tertiary">
          এখানে {toBn(info.total_questions)}টির মধ্যে {toBn(available)}টি প্রশ্ন যুক্ত করা হয়েছে।
        </p>
      )}
    </header>
  );
}

// Two text tabs with an underline under the selected one; the row's bottom border is the track.
function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const options: { value: Mode; label: string }[] = [
    { value: "practice", label: "অনুশীলন" },
    { value: "study", label: "পড়ার মোড" },
  ];

  return (
    <div role="radiogroup" aria-label="মোড নির্বাচন" className="-mb-px flex gap-6">
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
      <span className="text-[12px] text-tertiary tabular-nums">{toBn(count)}</span>
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
      aria-label="অগ্রগতি"
    >
      <div className="bg-ios-green transition-all duration-500" style={{ width: `${pct(progress.correct)}%` }} />
      <div className="bg-ios-red transition-all duration-500" style={{ width: `${pct(progress.wrong)}%` }} />
    </div>
  );
}

function ProgressCard({ mode, progress, onReset }: { mode: Mode; progress: Progress; onReset: () => void }) {
  const accuracy = progress.answered ? Math.round((progress.correct / progress.answered) * 100) : 0;

  return (
    <div>
      <h2 className="text-[13px] font-semibold text-secondary">অগ্রগতি</h2>
      <p className="mt-2 text-[34px] leading-none font-bold tabular-nums">
        {toBn(accuracy)}%<span className="ml-2 text-[13px] font-medium text-secondary">নির্ভুলতা</span>
      </p>
      <div className="mt-4">
        <ProgressBar progress={progress} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        <SmallStat label="উত্তর" value={progress.answered} className="text-label" />
        <SmallStat label="সঠিক" value={progress.correct} className="text-ios-green" />
        <SmallStat label="ভুল" value={progress.wrong} className="text-ios-red" />
      </dl>
      {mode === "study" && <p className="mt-3 text-[13px] text-secondary">অনুশীলন মোডে উত্তর দিলে অগ্রগতি এখানে দেখা যাবে।</p>}
      <button
        type="button"
        onClick={onReset}
        disabled={progress.answered === 0}
        className="pressable mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-ios-red disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ResetIcon className="size-4" /> আবার শুরু করুন
      </button>
    </div>
  );
}

function SmallStat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[12px] text-secondary">{label}</dt>
      <dd className={`text-[20px] font-semibold tabular-nums ${className}`}>{toBn(value)}</dd>
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
    <div className={`grid gap-1 ${className}`}>
      {questions.map((q) => {
        const answer = answers[q.question_no];
        let tone = "text-secondary active:bg-fill";
        if (mode === "practice" && answer !== undefined) {
          tone = answer === q.correct_answer ? "bg-ios-green/12 text-ios-green" : "bg-ios-red/12 text-ios-red";
        }
        return (
          <button
            key={q.question_no}
            type="button"
            onClick={() => onJump(q.question_no)}
            aria-label={`প্রশ্ন ${toBn(q.question_no)}-এ যান`}
            className={`pressable aspect-square rounded-full text-[14px] font-medium tabular-nums ${tone}`}
          >
            {toBn(q.question_no)}
          </button>
        );
      })}
    </div>
  );
}

// UIToolbar: pinned above the home indicator, translucent, with plain tint-coloured glyph buttons.
// It also carries the back button, since the page has no top bar.
function BottomToolbar({
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
    <div className="ios-material hairline-t px-safe fixed inset-x-0 bottom-0 z-20 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-1">
        <AppLink href="/" aria-label="সব পরীক্ষায় ফিরে যান" className="pressable -ml-2 grid size-11 shrink-0 place-items-center text-tint">
          <ChevronLeftIcon className="size-7 stroke-[2.5]" />
        </AppLink>
        <div className="min-w-0 flex-1 px-1">
          {mode === "practice" ? (
            <>
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="font-semibold">
                  উত্তর {toBn(progress.answered)}/{toBn(progress.total)}
                </span>
                <span className="text-secondary">
                  <span className="text-ios-green">সঠিক {toBn(progress.correct)}</span>
                  {" · "}
                  <span className="text-ios-red">ভুল {toBn(progress.wrong)}</span>
                </span>
              </div>
              <div className="mt-1.5">
                <ProgressBar progress={progress} />
              </div>
            </>
          ) : (
            <p className="text-center text-[13px] font-medium text-secondary">পড়ার মোড · {toBn(progress.total)}টি প্রশ্ন</p>
          )}
        </div>
        {mode === "practice" && (
          <button
            type="button"
            onClick={onReset}
            disabled={progress.answered === 0}
            aria-label="আবার শুরু করুন"
            className="pressable grid size-11 shrink-0 place-items-center text-tint disabled:text-tertiary"
          >
            <ResetIcon className="size-5.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenNavigator}
          aria-label="প্রশ্ন তালিকা খুলুন"
          className="pressable -mr-2 grid size-11 shrink-0 place-items-center text-tint"
        >
          <GridIcon className="size-5.5" />
        </button>
      </div>
    </div>
  );
}

function CompletionCard({ progress, onReset }: { progress: Progress; onReset: () => void }) {
  const accuracy = Math.round((progress.correct / progress.total) * 100);
  const message = accuracy >= 80 ? "অসাধারণ! চমৎকার প্রস্তুতি।" : accuracy >= 50 ? "ভালো হয়েছে! আরেকটু অনুশীলন করুন।" : "হাল ছাড়বেন না, আবার চেষ্টা করুন।";

  return (
    <div className="mt-2 animate-fade-in border-t border-separator py-10 text-center">
      <p className="text-[13px] font-semibold text-secondary">অনুশীলন সম্পন্ন</p>
      <p className="mt-1 text-[48px] leading-tight font-bold tabular-nums">
        {toBn(progress.correct)}
        <span className="text-[28px] text-tertiary">/{toBn(progress.total)}</span>
      </p>
      <p className="mt-1 text-[15px] text-secondary">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="pressable mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-label px-6 text-[15px] font-semibold text-canvas"
      >
        <ResetIcon className="size-4.5" /> আবার অনুশীলন করুন
      </button>
    </div>
  );
}

export function ExamSkeleton() {
  return (
    <main className={`px-safe mx-auto w-full ${WIDTH} flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-16`} aria-busy="true" aria-label="লোড হচ্ছে">
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
