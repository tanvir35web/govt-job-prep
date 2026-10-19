"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toBn } from "@/lib/format";
import { saveExamOffline } from "@/lib/offline";
import { type Answers, defaultModeSetting, loadAnswers, loadReelsPosition, saveAnswers, saveLastReel, saveReelsPosition } from "@/lib/settings";
import type { ExamDetailResponse, ExamInfo, Question } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import { BookOpenIcon, ChevronDownIcon, ChevronLeftIcon, ChevronUpIcon, ReelsIcon, ResetIcon, TargetIcon } from "./icons";
import { type Mode, QuestionCard } from "./QuestionCard";
import { ErrorState, Skeleton } from "./StatusViews";

// Reels: one question per screen in a vertical feed that snaps to each question, like short videos.
// Answers are shared with the exam page, so progress made in either place shows in both.

export function ReelsView({ slug }: { slug: string }) {
  const { state, retry } = useApi<ExamDetailResponse>(`/api/exams/${encodeURIComponent(slug)}`);
  const loaded = state.status === "success";

  useEffect(() => {
    if (loaded && navigator.onLine) void saveExamOffline(slug);
  }, [loaded, slug]);

  if (state.status === "loading") return <ReelsSkeleton />;

  if (state.status === "error") {
    const back = { showHomeLink: true, homeHref: "/reels", homeLabel: "রিলস তালিকা" };
    return (
      <main className="px-safe flex-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {state.code === 404 ? (
          <ErrorState title="পরীক্ষাটি পাওয়া যায়নি" message="লিংকটি সঠিক কিনা দেখুন, অথবা তালিকা থেকে পরীক্ষা বেছে নিন।" {...back} />
        ) : state.code === 0 ? (
          <ErrorState
            offline
            title="ইন্টারনেট সংযোগ নেই"
            message="এই পরীক্ষাটি আগে খোলা হয়নি, তাই অফলাইনে পাওয়া যাচ্ছে না।"
            onRetry={retry}
            {...back}
          />
        ) : (
          <ErrorState title="প্রশ্ন লোড করা যায়নি" message="সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" onRetry={retry} {...back} />
        )}
      </main>
    );
  }

  if (state.data.questions.length === 0) {
    return (
      <main className="px-safe flex-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <ErrorState title="কোনো প্রশ্ন নেই" message="এই পরীক্ষায় এখনো প্রশ্ন যুক্ত করা হয়নি।" showHomeLink homeHref="/reels" homeLabel="রিলস তালিকা" />
      </main>
    );
  }

  return <ReelsFeed slug={slug} info={state.data.exam_info} questions={state.data.questions} />;
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function ReelsFeed({ slug, info, questions }: { slug: string; info: ExamInfo; questions: Question[] }) {
  const [mode, setMode] = useState<Mode>(defaultModeSetting.get);
  // Only rendered on the client after the fetch resolves, so reading localStorage here is safe.
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(slug));
  const [current, setCurrent] = useState(() => Math.min(loadReelsPosition(slug), questions.length - 1));
  const feedRef = useRef<HTMLElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  // The slide count includes the summary slide after the last question.
  const slideCount = questions.length + 1;

  useEffect(() => saveAnswers(slug, answers), [slug, answers]);
  useEffect(() => saveLastReel(slug), [slug]);
  useEffect(() => saveReelsPosition(slug, Math.min(current, questions.length - 1)), [slug, current, questions.length]);

  // Reopen on the question that was showing last time. Runs once; later changes come from scrolling.
  const initial = useRef(current);
  useEffect(() => {
    slideRefs.current[initial.current]?.scrollIntoView({ block: "start" });
  }, []);

  // The slide crossing the middle of the screen is the current one; works for slides taller than the screen too.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root: feedRef.current, rootMargin: "-50% 0px -50% 0px" },
    );
    for (const slide of slideRefs.current) if (slide) observer.observe(slide);
    return () => observer.disconnect();
  }, [slideCount]);

  const goTo = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(slideCount - 1, index));
      slideRefs.current[target]?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
    },
    [slideCount],
  );

  // Keyboard on desktop: arrows, Page Up/Down and j/k step through the feed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowDown", "PageDown", "j"].includes(e.key)) {
        e.preventDefault();
        goTo(current + 1);
      } else if (["ArrowUp", "PageUp", "k"].includes(e.key)) {
        e.preventDefault();
        goTo(current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, goTo]);

  const answered = questions.filter((q) => answers[q.question_no] !== undefined).length;
  const correct = questions.filter((q) => answers[q.question_no] === q.correct_answer).length;

  const select = (questionNo: number, option: string) => setAnswers((prev) => ({ ...prev, [questionNo]: option }));

  const reset = () => {
    if (answered === 0 || window.confirm("আপনার দেওয়া সব উত্তর মুছে ফেলা হবে। নিশ্চিত?")) {
      setAnswers({});
      goTo(0);
    }
  };

  const onSummary = current >= questions.length;

  return (
    <>
      <title>{`${info.exam_title} · রিলস | সরকারি চাকরি প্রস্তুতি`}</title>

      <ReelsTopBar
        title={info.exam_title}
        position={onSummary ? null : current + 1}
        total={questions.length}
        mode={mode}
        correct={correct}
        wrong={answered - correct}
        onToggleMode={() => setMode((m) => (m === "practice" ? "study" : "practice"))}
      />

      <main ref={feedRef} className="no-scrollbar fixed inset-0 snap-y snap-mandatory overflow-y-auto overscroll-contain" aria-label="প্রশ্ন রিলস">
        {questions.map((q, i) => {
          const revealed = mode === "study" || answers[q.question_no] !== undefined;
          return (
            <section
              key={q.question_no}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              data-index={i}
              aria-label={`প্রশ্ন ${toBn(i + 1)} / ${toBn(questions.length)}`}
              className="px-safe flex min-h-full snap-start snap-always flex-col justify-center pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]"
            >
              <div className="mx-auto w-full max-w-xl">
                <QuestionCard question={q} mode={mode} selected={answers[q.question_no]} onSelect={(option) => select(q.question_no, option)} />

                {revealed ? (
                  <button
                    type="button"
                    onClick={() => goTo(i + 1)}
                    className="pressable mx-auto mt-5 flex animate-fade-in items-center gap-1 rounded-full bg-fill px-4 py-2 text-[15px] font-semibold text-tint"
                  >
                    {i === questions.length - 1 ? "ফলাফল দেখুন" : "পরের প্রশ্ন"} <ChevronDownIcon className="size-4.5 stroke-[2.5]" />
                  </button>
                ) : (
                  i === 0 && (
                    <p className="mt-6 flex flex-col items-center gap-1 text-[13px] text-secondary">
                      <ChevronUpIcon className="size-5 animate-bounce" />
                      উত্তর দিন, তারপর উপরে সোয়াইপ করে পরের প্রশ্নে যান
                    </p>
                  )
                )}
              </div>
            </section>
          );
        })}

        <section
          ref={(el) => {
            slideRefs.current[questions.length] = el;
          }}
          data-index={questions.length}
          aria-label="ফলাফল"
          className="px-safe flex min-h-full snap-start snap-always flex-col justify-center pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]"
        >
          <SummaryCard mode={mode} total={questions.length} answered={answered} correct={correct} onReset={reset} onRestart={() => goTo(0)} />
        </section>
      </main>

      {/* Mouse users have no swipe; these step through the feed on wider screens. */}
      <div className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-20 hidden flex-col gap-2 md:flex">
        <StepButton label="আগের প্রশ্ন" disabled={current === 0} onClick={() => goTo(current - 1)}>
          <ChevronUpIcon className="size-6 stroke-[2.5]" />
        </StepButton>
        <StepButton label="পরের প্রশ্ন" disabled={current >= slideCount - 1} onClick={() => goTo(current + 1)}>
          <ChevronDownIcon className="size-6 stroke-[2.5]" />
        </StepButton>
      </div>
    </>
  );
}

function ReelsTopBar({
  title,
  position,
  total,
  mode,
  correct,
  wrong,
  onToggleMode,
}: {
  title: string;
  position: number | null;
  total: number;
  mode: Mode;
  correct: number;
  wrong: number;
  onToggleMode: () => void;
}) {
  const shown = position ?? total;
  return (
    <header className="ios-material hairline-b px-safe fixed inset-x-0 top-0 z-20 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-xl items-center gap-1 pb-2">
        <AppLink href="/reels" aria-label="রিলস তালিকায় ফিরে যান" className="pressable -ml-2 grid size-11 shrink-0 place-items-center text-tint">
          <ChevronLeftIcon className="size-7 stroke-[2.5]" />
        </AppLink>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{title}</p>
          <p className="text-[13px] text-secondary">
            {position === null ? "ফলাফল" : `প্রশ্ন ${toBn(position)}/${toBn(total)}`}
            {mode === "practice" && (
              <>
                {" · "}
                <span className="text-ios-green">সঠিক {toBn(correct)}</span>
                {" · "}
                <span className="text-ios-red">ভুল {toBn(wrong)}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleMode}
          aria-label={mode === "practice" ? "পড়ার মোডে যান" : "অনুশীলন মোডে যান"}
          className="pressable -mr-2 inline-flex h-11 shrink-0 items-center gap-1 px-2 text-[13px] font-semibold text-tint"
        >
          {mode === "practice" ? <TargetIcon className="size-4.5" /> : <BookOpenIcon className="size-4.5" />}
          {mode === "practice" ? "অনুশীলন" : "পড়া"}
        </button>
      </div>
      <div
        className="h-0.5 w-full bg-fill"
        role="progressbar"
        aria-label="অবস্থান"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={shown}
      >
        <div className="h-full bg-tint transition-[width] duration-300" style={{ width: `${(shown / total) * 100}%` }} />
      </div>
    </header>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="pressable ios-material grid size-12 place-items-center rounded-full text-tint shadow-[0_4px_16px_rgb(0_0_0/0.12)] ring-[0.5px] ring-separator disabled:text-tertiary dark:ring-white/10"
    >
      {children}
    </button>
  );
}

function SummaryCard({
  mode,
  total,
  answered,
  correct,
  onReset,
  onRestart,
}: {
  mode: Mode;
  total: number;
  answered: number;
  correct: number;
  onReset: () => void;
  onRestart: () => void;
}) {
  const practice = mode === "practice";
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl bg-surface p-6 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-fill text-tint">
        <ReelsIcon className="size-7" />
      </span>
      <p className="mt-4 text-[13px] font-semibold text-tint">{practice ? "রিলস শেষ" : "সব প্রশ্ন পড়া শেষ"}</p>
      {practice ? (
        <>
          <p className="mt-1 text-[48px] leading-tight font-bold">
            {toBn(correct)}
            <span className="text-[28px] text-tertiary">/{toBn(total)}</span>
          </p>
          <p className="mt-1 text-[15px] text-secondary">
            {toBn(answered)}টি প্রশ্নের উত্তর দিয়েছেন · নির্ভুলতা {toBn(accuracy)}%
          </p>
        </>
      ) : (
        <p className="mt-2 text-[15px] text-secondary">{toBn(total)}টি প্রশ্নের উত্তর ও ব্যাখ্যা দেখেছেন।</p>
      )}

      <div className="mt-6 grid gap-2.5">
        {practice ? (
          <button
            type="button"
            onClick={onReset}
            className="pressable inline-flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-tint text-[17px] font-semibold text-white dark:text-black"
          >
            <ResetIcon className="size-5" /> আবার অনুশীলন করুন
          </button>
        ) : (
          <button
            type="button"
            onClick={onRestart}
            className="pressable inline-flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-tint text-[17px] font-semibold text-white dark:text-black"
          >
            <ChevronUpIcon className="size-5 stroke-[2.5]" /> প্রথম প্রশ্নে যান
          </button>
        )}
        <AppLink href="/reels" className="pressable inline-flex h-[50px] items-center justify-center rounded-[14px] bg-fill text-[17px] font-semibold text-tint">
          অন্য পরীক্ষা বেছে নিন
        </AppLink>
      </div>
    </div>
  );
}

export function ReelsSkeleton() {
  return (
    <main className="px-safe fixed inset-0 flex flex-col justify-center" aria-busy="true" aria-label="লোড হচ্ছে">
      <div className="mx-auto w-full max-w-xl rounded-2xl bg-surface p-4">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="mt-3 h-5 w-full" />
        <Skeleton className="mt-2 h-5 w-2/3" />
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
