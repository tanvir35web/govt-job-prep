"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatExamDate, toBn } from "@/lib/format";
import { saveExamOffline } from "@/lib/offline";
import type { ExamDetailResponse, ExamInfo, Question } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { BookOpenIcon, BuildingIcon, CalendarIcon, ExternalLinkIcon, GridIcon, ResetIcon, TargetIcon } from "./icons";
import { NavBar } from "./NavBar";
import { type Mode, QuestionCard } from "./QuestionCard";
import { ErrorState, Skeleton } from "./StatusViews";

type Answers = Record<number, string>;

const ALL = "__all__";
const BACK = { href: "/", label: "পরীক্ষা" };
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
        <NavBar title="" back={BACK} />
        <main className="px-safe flex-1">
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
    <>
      <title>{`${info.exam_title} | সরকারি চাকরি প্রস্তুতি`}</title>
      <NavBar title={info.exam_title} back={BACK} width={WIDTH} />

      <main className={`px-safe mx-auto w-full ${WIDTH} flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12`}>
        <ExamHeader info={info} available={questions.length} subjectCount={subjects.length} />

        <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
          <div>
            <ModeToggle mode={mode} onChange={setMode} />
            <p className="mt-2 px-1 text-[13px] text-secondary">
              {mode === "practice" ? "একটি অপশন বেছে নিন, সাথে সাথে উত্তর ও ব্যাখ্যা দেখুন।" : "সব প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা দেখানো হচ্ছে।"}
            </p>

            {subjects.length > 1 && (
              <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <SubjectChip active={subject === ALL} onClick={() => setSubject(ALL)} label="সব বিষয়" count={questions.length} />
                {subjects.map(([name, count]) => (
                  <SubjectChip key={name} active={subject === name} onClick={() => setSubject(name)} label={name} count={count} />
                ))}
              </div>
            )}

            <div className="mt-4 space-y-3 sm:space-y-4">
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

          <aside className="hidden lg:sticky lg:top-[calc(env(safe-area-inset-top)+3.75rem)] lg:block lg:space-y-4">
            <ProgressCard mode={mode} progress={progress} onReset={reset} />
            <div className="rounded-2xl bg-surface p-4">
              <h2 className="text-[15px] font-semibold">প্রশ্নে যান</h2>
              <QuestionNavigator questions={visible} mode={mode} answers={answers} onJump={jumpTo} className="mt-3 grid-cols-5" />
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

  return (
    <section className="mt-2 rounded-2xl bg-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-700 text-white">
          <BuildingIcon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-secondary">{info.organization}</p>
          <h1 className="mt-0.5 text-[22px] leading-snug font-bold sm:text-[26px]">{info.exam_title}</h1>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2.5 py-1 text-secondary">
          <CalendarIcon className="size-3.5" /> {formatExamDate(info.exam_date)}
        </span>
        <span className="rounded-full bg-fill px-2.5 py-1 font-medium text-secondary">{info.exam_type}</span>
        {hasSafeSource && (
          <a
            href={info.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable inline-flex items-center gap-1 px-1 py-1 font-medium text-tint"
          >
            মূল উৎস <ExternalLinkIcon className="size-3.5" />
          </a>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 rounded-xl bg-fill py-2.5">
        <HeaderStat label="প্রশ্ন" value={toBn(info.total_questions)} />
        <HeaderStat label="পূর্ণমান" value={toBn(info.total_marks)} divider />
        <HeaderStat label="বিষয়" value={toBn(subjectCount)} divider />
      </dl>

      {available < info.total_questions && (
        <p className="mt-3 text-[13px] text-secondary">
          এখানে {toBn(info.total_questions)}টির মধ্যে {toBn(available)}টি প্রশ্ন যুক্ত করা হয়েছে।
        </p>
      )}
    </section>
  );
}

function HeaderStat({ label, value, divider = false }: { label: string; value: string; divider?: boolean }) {
  return (
    <div className={`flex flex-col-reverse items-center ${divider ? "border-l-[0.5px] border-separator" : ""}`}>
      <dt className="text-[13px] text-secondary">{label}</dt>
      <dd className="text-[22px] leading-tight font-semibold">{value}</dd>
    </div>
  );
}

// UISegmentedControl: a grey track with a raised, sliding thumb under the selected segment.
function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const options: { value: Mode; label: string; icon: React.ReactNode }[] = [
    { value: "practice", label: "অনুশীলন", icon: <TargetIcon className="size-4" /> },
    { value: "study", label: "পড়ার মোড", icon: <BookOpenIcon className="size-4" /> },
  ];

  return (
    <div role="radiogroup" aria-label="মোড নির্বাচন" className="relative grid grid-cols-2 rounded-[9px] bg-fill p-0.5 md:max-w-sm">
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[7px] bg-white shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] transition-transform duration-300 ease-out dark:bg-[#636366]"
        style={{ transform: mode === "study" ? "translateX(100%)" : "none" }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          onClick={() => onChange(o.value)}
          className={`relative inline-flex h-8 items-center justify-center gap-1.5 text-[15px] transition-colors ${
            mode === o.value ? "font-semibold text-label" : "font-medium text-secondary"
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
      className={`pressable inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[15px] font-medium whitespace-nowrap ${
        active ? "bg-label text-canvas" : "bg-surface text-label"
      }`}
    >
      {label}
      <span className={`text-[13px] ${active ? "opacity-70" : "text-secondary"}`}>{toBn(count)}</span>
    </button>
  );
}

function ProgressBar({ progress }: { progress: Progress }) {
  const pct = (n: number) => (progress.total ? (n / progress.total) * 100 : 0);
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-fill"
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
    <div className="rounded-2xl bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">আপনার অগ্রগতি</h2>
        <span className="text-[13px] text-secondary">
          {toBn(progress.answered)}/{toBn(progress.total)}
        </span>
      </div>
      <p className="mt-2 text-[34px] leading-tight font-bold">
        {toBn(accuracy)}%<span className="ml-2 text-[13px] font-medium text-secondary">নির্ভুলতা</span>
      </p>
      <div className="mt-3">
        <ProgressBar progress={progress} />
      </div>
      <dl className="mt-3 grid grid-cols-3 rounded-xl bg-fill py-2 text-center">
        <SmallStat label="উত্তর" value={progress.answered} className="text-label" />
        <SmallStat label="সঠিক" value={progress.correct} className="text-ios-green" divider />
        <SmallStat label="ভুল" value={progress.wrong} className="text-ios-red" divider />
      </dl>
      {mode === "study" && <p className="mt-3 text-[13px] text-secondary">অনুশীলন মোডে উত্তর দিলে অগ্রগতি এখানে দেখা যাবে।</p>}
      <button
        type="button"
        onClick={onReset}
        disabled={progress.answered === 0}
        className="pressable mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-fill text-[15px] font-semibold text-ios-red disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ResetIcon className="size-4" /> আবার শুরু করুন
      </button>
    </div>
  );
}

function SmallStat({ label, value, className, divider = false }: { label: string; value: number; className: string; divider?: boolean }) {
  return (
    <div className={`flex flex-col-reverse ${divider ? "border-l-[0.5px] border-separator" : ""}`}>
      <dt className="text-[13px] text-secondary">{label}</dt>
      <dd className={`text-[20px] font-semibold ${className}`}>{toBn(value)}</dd>
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
        let tone = "bg-fill text-label";
        if (mode === "practice" && answer !== undefined) {
          tone = answer === q.correct_answer ? "bg-ios-green text-white" : "bg-ios-red text-white";
        }
        return (
          <button
            key={q.question_no}
            type="button"
            onClick={() => onJump(q.question_no)}
            aria-label={`প্রশ্ন ${toBn(q.question_no)}-এ যান`}
            className={`pressable aspect-square rounded-full text-[15px] font-semibold ${tone}`}
          >
            {toBn(q.question_no)}
          </button>
        );
      })}
    </div>
  );
}

// UIToolbar: pinned above the home indicator, translucent, with plain tint-coloured glyph buttons.
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
        {mode === "practice" && (
          <button
            type="button"
            onClick={onReset}
            disabled={progress.answered === 0}
            aria-label="আবার শুরু করুন"
            className="pressable -ml-2 grid size-11 shrink-0 place-items-center text-tint disabled:text-tertiary"
          >
            <ResetIcon className="size-[22px]" />
          </button>
        )}
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
        <button
          type="button"
          onClick={onOpenNavigator}
          aria-label="প্রশ্ন তালিকা খুলুন"
          className="pressable -mr-2 grid size-11 shrink-0 place-items-center text-tint"
        >
          <GridIcon className="size-[22px]" />
        </button>
      </div>
    </div>
  );
}

// iOS sheet: slides up, dims the page, and closes on Done, backdrop tap, Escape or a downward drag.
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

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

  const onPointerDown = (e: React.PointerEvent) => {
    // Capturing the pointer would swallow the Done button's click.
    if ((e.target as HTMLElement).closest("button")) return;
    startY.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging) setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onPointerUp = () => {
    setDragging(false);
    if (dragY > 100) onClose();
    else setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="বন্ধ করুন" onClick={onClose} className="absolute inset-0 animate-backdrop-in bg-black/40" />
      <div
        className={`absolute inset-x-0 bottom-0 flex max-h-[85dvh] animate-sheet-up flex-col rounded-t-[14px] bg-canvas shadow-2xl dark:bg-surface ${
          !dragging ? "transition-transform duration-300 ease-out" : ""
        }`}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
      >
        <div className="touch-none select-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div className="mx-auto mt-1.5 h-[5px] w-9 rounded-full bg-tertiary" />
          <div className="px-safe grid grid-cols-[1fr_auto_1fr] items-center py-2.5">
            <span />
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="pressable justify-self-end text-[17px] font-semibold text-tint">
              সম্পন্ন
            </button>
          </div>
        </div>
        <div className="px-safe overflow-y-auto overscroll-contain pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

function CompletionCard({ progress, onReset }: { progress: Progress; onReset: () => void }) {
  const accuracy = Math.round((progress.correct / progress.total) * 100);
  const message = accuracy >= 80 ? "অসাধারণ! চমৎকার প্রস্তুতি।" : accuracy >= 50 ? "ভালো হয়েছে! আরেকটু অনুশীলন করুন।" : "হাল ছাড়বেন না, আবার চেষ্টা করুন।";

  return (
    <div className="mt-6 animate-fade-in rounded-2xl bg-surface p-6 text-center">
      <p className="text-[13px] font-semibold text-tint">অনুশীলন সম্পন্ন</p>
      <p className="mt-1 text-[48px] leading-tight font-bold">
        {toBn(progress.correct)}
        <span className="text-[28px] text-tertiary">/{toBn(progress.total)}</span>
      </p>
      <p className="mt-1 text-[15px] text-secondary">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="pressable mt-5 inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-tint text-[17px] font-semibold text-white sm:w-auto sm:px-8 dark:text-black"
      >
        <ResetIcon className="size-5" /> আবার অনুশীলন করুন
      </button>
    </div>
  );
}

export function ExamSkeleton() {
  return (
    <>
      <NavBar title="" back={BACK} width={WIDTH} />
      <main className={`px-safe mx-auto w-full ${WIDTH} flex-1 pb-16`} aria-busy="true" aria-label="লোড হচ্ছে">
        <div className="mt-2 rounded-2xl bg-surface p-4">
          <div className="flex gap-3">
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="mt-2 h-6 w-full" />
              <Skeleton className="mt-2 h-6 w-2/3" />
            </div>
          </div>
          <Skeleton className="mt-4 h-16 w-full rounded-xl" />
        </div>
        <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
          <div className="space-y-3">
            <Skeleton className="h-9 w-full rounded-[9px] md:max-w-sm" />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="rounded-2xl bg-surface p-4">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-3 h-5 w-3/4" />
                <div className="mt-4 grid gap-2">
                  {Array.from({ length: 4 }, (_, j) => (
                    <Skeleton key={j} className="h-12 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="hidden h-80 rounded-2xl lg:block" />
        </div>
      </main>
    </>
  );
}
