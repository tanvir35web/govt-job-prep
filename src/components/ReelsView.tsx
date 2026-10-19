"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { coverFor } from "@/lib/covers";
import { OPTION_LABELS, toBn } from "@/lib/format";
import { saveExamOffline } from "@/lib/offline";
import { type Answers, defaultModeSetting, loadAnswers, loadReelsPosition, saveAnswers, saveLastReel, saveReelsPosition } from "@/lib/settings";
import type { ExamDetailResponse, ExamInfo, Question } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  LightbulbIcon,
  ResetIcon,
  ShareIcon,
  TargetIcon,
  XIcon,
} from "./icons";
import type { Mode } from "./QuestionCard";
import { ErrorState } from "./StatusViews";

// Reels: one question per screen in a vertical feed that snaps to each question, like short videos.
// Each slide is full-bleed and coloured by subject, with white text, so the page looks the same in light and dark themes.
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

// Equal side padding keeps the card centred. The top clears the top bar; on phones the bottom clears the action bar.
const SLIDE_PADDING = "px-safe pt-[calc(5.5rem+env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-[calc(2rem+env(safe-area-inset-bottom))]";

function ReelsFeed({ slug, info, questions }: { slug: string; info: ExamInfo; questions: Question[] }) {
  const [mode, setMode] = useState<Mode>(defaultModeSetting.get);
  // Only rendered on the client after the fetch resolves, so reading localStorage here is safe.
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(slug));
  const [current, setCurrent] = useState(() => Math.min(loadReelsPosition(slug), questions.length - 1));
  const [toast, setToast] = useState<string | null>(null);
  const feedRef = useRef<HTMLElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  // The slide count includes the summary slide after the last question.
  const slideCount = questions.length + 1;

  useEffect(() => saveAnswers(slug, answers), [slug, answers]);
  useEffect(() => saveLastReel(slug), [slug]);
  useEffect(() => saveReelsPosition(slug, Math.min(current, questions.length - 1)), [slug, current, questions.length]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

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
  const onSummary = current >= questions.length;

  const select = (questionNo: number, option: string) => setAnswers((prev) => ({ ...prev, [questionNo]: option }));

  const reset = () => {
    if (answered === 0) return goTo(0);
    if (window.confirm("আপনার দেওয়া সব উত্তর মুছে ফেলা হবে। নিশ্চিত?")) {
      setAnswers({});
      goTo(0);
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: info.exam_title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast("লিংক কপি হয়েছে");
    } catch (err) {
      // Closing the share sheet rejects with AbortError; that is not a failure.
      if (!(err instanceof DOMException && err.name === "AbortError")) setToast("শেয়ার করা যায়নি");
    }
  };

  const toggleMode = () => {
    const next = mode === "practice" ? "study" : "practice";
    setMode(next);
    setToast(next === "practice" ? "অনুশীলন মোড: উত্তর দিয়ে যাচাই করুন" : "পড়ার মোড: সব উত্তর দেখানো হচ্ছে");
  };

  return (
    <>
      <title>{`${info.exam_title} · রিলস | সরকারি চাকরি প্রস্তুতি`}</title>

      <main ref={feedRef} className="no-scrollbar fixed inset-0 snap-y snap-mandatory overflow-y-auto overscroll-contain bg-black text-white" aria-label="প্রশ্ন রিলস">
        {questions.map((q, i) => (
          <ReelSlide
            key={q.question_no}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            index={i}
            total={questions.length}
            question={q}
            mode={mode}
            selected={answers[q.question_no]}
            onSelect={(option) => select(q.question_no, option)}
            onNext={() => goTo(i + 1)}
          />
        ))}

        <section
          ref={(el) => {
            slideRefs.current[questions.length] = el;
          }}
          data-index={questions.length}
          aria-label="ফলাফল"
          className={`relative flex min-h-full snap-start snap-always flex-col justify-center bg-linear-to-br ${coverFor(info.organization)} ${SLIDE_PADDING}`}
        >
          <span aria-hidden="true" className="absolute inset-0 bg-black/30" />
          <SummaryCard mode={mode} total={questions.length} answered={answered} correct={correct} onReset={reset} onRestart={() => goTo(0)} />
        </section>
      </main>

      <ReelsTopBar
        title={info.exam_title}
        organization={info.organization}
        position={onSummary ? questions.length : current + 1}
        total={questions.length}
        mode={mode}
        correct={correct}
        wrong={answered - correct}
      />

      <ActionRail
        mode={mode}
        canReset={answered > 0}
        atStart={current === 0}
        atEnd={current >= slideCount - 1}
        onToggleMode={toggleMode}
        onShare={share}
        onReset={reset}
        onPrev={() => goTo(current - 1)}
        onNext={() => goTo(current + 1)}
      />

      {toast && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center px-4">
          <p className="animate-fade-in rounded-full bg-black/75 px-4 py-2 text-[14px] font-medium text-white backdrop-blur-md">{toast}</p>
        </div>
      )}
    </>
  );
}

function ReelSlide({
  ref,
  index,
  total,
  question: q,
  mode,
  selected,
  onSelect,
  onNext,
}: {
  ref: React.Ref<HTMLElement>;
  index: number;
  total: number;
  question: Question;
  mode: Mode;
  selected: string | undefined;
  onSelect: (option: string) => void;
  onNext: () => void;
}) {
  const revealed = mode === "study" || selected !== undefined;
  const isLast = index === total - 1;
  const long = q.question.length > 140;

  return (
    <section
      ref={ref}
      data-index={index}
      aria-label={`প্রশ্ন ${toBn(index + 1)} / ${toBn(total)}`}
      className={`relative flex min-h-full snap-start snap-always flex-col justify-center bg-linear-to-br ${coverFor(q.subject)} ${SLIDE_PADDING}`}
    >
      {/* Darkens the top and bottom so the bars and white text stay readable on any gradient. */}
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-black/45 via-black/15 to-black/55" />

      <article className="relative mx-auto w-full max-w-xl rounded-3xl bg-black/25 p-4 ring-1 ring-white/15 backdrop-blur-md sm:p-6">
        <header className="flex items-center justify-between gap-3 text-[12px] font-semibold">
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-black">প্রশ্ন {toBn(q.question_no)}</span>
          <span className="min-w-0 truncate text-right text-white/80">
            {q.subject}
            {q.topic && <span className="font-medium text-white/60"> · {q.topic}</span>}
          </span>
        </header>

        <h2 className={`mt-4 leading-snug font-bold text-balance ${long ? "text-[18px]" : "text-[21px] sm:text-[24px]"}`}>{q.question}</h2>

        <div className="mt-5 grid gap-2.5">
          {q.options.map((option, i) => (
            <ReelOption
              key={i}
              label={OPTION_LABELS[i] ?? toBn(i + 1)}
              option={option}
              revealed={revealed}
              correct={option === q.correct_answer}
              chosen={option === selected}
              onSelect={() => onSelect(option)}
            />
          ))}
        </div>

        {revealed && q.explanation && (
          <div className="mt-4 animate-fade-in rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-amber-200">
              <LightbulbIcon className="size-4" /> ব্যাখ্যা
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-white/90">{q.explanation}</p>
          </div>
        )}

        {/* Footer: status on the left, the step forward on the right. */}
        <footer className="mt-5 flex min-h-10 items-center justify-between gap-3 border-t border-white/15 pt-4">
          <SlideStatus mode={mode} selected={selected} correctAnswer={q.correct_answer} first={index === 0} />
          <button
            type="button"
            onClick={onNext}
            className={`pressable inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-2 text-[14px] font-bold ${
              revealed ? "bg-white text-black shadow-lg" : "bg-white/15 text-white ring-1 ring-white/20"
            }`}
          >
            {isLast ? "ফলাফল" : revealed ? "পরের প্রশ্ন" : "এড়িয়ে যান"} <ChevronDownIcon className="size-4 stroke-3" />
          </button>
        </footer>
      </article>
    </section>
  );
}

function SlideStatus({ mode, selected, correctAnswer, first }: { mode: Mode; selected: string | undefined; correctAnswer: string; first: boolean }) {
  if (mode === "study") return <p className="text-[13px] font-medium text-white/70">পড়ার মোড</p>;
  if (selected === undefined) {
    return (
      <p className="flex min-w-0 items-center gap-1 text-[13px] font-medium text-white/70">
        {first && <ChevronUpIcon className="size-4 shrink-0 animate-bounce stroke-[2.5]" />}
        {first ? "উত্তর দিন, তারপর সোয়াইপ করুন" : "একটি উত্তর বেছে নিন"}
      </p>
    );
  }
  const right = selected === correctAnswer;
  return (
    <p className={`inline-flex min-w-0 animate-fade-in items-center gap-1.5 text-[15px] font-bold ${right ? "text-emerald-300" : "text-red-300"}`}>
      {right ? <CheckIcon className="size-4.5 shrink-0 stroke-3" /> : <XIcon className="size-4.5 shrink-0 stroke-3" />}
      {right ? "সঠিক উত্তর!" : "ভুল উত্তর"}
    </p>
  );
}

function ReelOption({
  label,
  option,
  revealed,
  correct,
  chosen,
  onSelect,
}: {
  label: string;
  option: string;
  revealed: boolean;
  correct: boolean;
  chosen: boolean;
  onSelect: () => void;
}) {
  let tone = "bg-white/15 ring-white/25 active:bg-white/25";
  let badge = "bg-white/25 text-white";
  if (revealed && correct) {
    tone = "bg-white text-emerald-800 ring-white";
    badge = "bg-emerald-600 text-white";
  } else if (revealed && chosen) {
    tone = "bg-red-500/90 ring-red-300/60";
    badge = "bg-white text-red-600";
  } else if (revealed) {
    tone = "bg-white/10 text-white/60 ring-white/10";
    badge = "bg-white/15 text-white/70";
  }

  return (
    <button
      type="button"
      disabled={revealed}
      aria-pressed={chosen}
      onClick={onSelect}
      className={`flex min-h-13 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[16px] font-medium ring-1 backdrop-blur-md transition-all duration-200 ${tone} ${
        revealed ? "cursor-default" : "cursor-pointer active:scale-[0.98]"
      } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-bold ${badge}`}>{label}</span>
      <span className="flex-1">{option}</span>
      {revealed && correct && <CheckIcon className="size-5 shrink-0 stroke-3 text-emerald-600" />}
      {revealed && chosen && !correct && <XIcon className="size-5 shrink-0 stroke-3" />}
    </button>
  );
}

function ReelsTopBar({
  title,
  organization,
  position,
  total,
  mode,
  correct,
  wrong,
}: {
  title: string;
  organization: string;
  position: number;
  total: number;
  mode: Mode;
  correct: number;
  wrong: number;
}) {
  return (
    <header className="px-safe pointer-events-none fixed inset-x-0 top-0 z-20 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
      <div
        className="mx-auto h-1 max-w-xl overflow-hidden rounded-full bg-white/25"
        role="progressbar"
        aria-label="অবস্থান"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={position}
      >
        <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${(position / total) * 100}%` }} />
      </div>

      <div className="mx-auto mt-2 flex max-w-xl items-center gap-2">
        <AppLink
          href="/reels"
          aria-label="রিলস তালিকায় ফিরে যান"
          className="pressable pointer-events-auto grid size-10 shrink-0 place-items-center rounded-full bg-black/25 backdrop-blur-md"
        >
          <ChevronLeftIcon className="size-6 stroke-[2.5]" />
        </AppLink>
        <div className="min-w-0 flex-1 drop-shadow">
          <p className="truncate text-[15px] leading-tight font-bold">{title}</p>
          <p className="truncate text-[12px] text-white/80">
            {organization} · {toBn(position)}/{toBn(total)}
          </p>
        </div>
        {mode === "practice" && (
          <div className="flex shrink-0 items-center gap-1 text-[12px] font-bold" aria-label={`সঠিক ${toBn(correct)}, ভুল ${toBn(wrong)}`}>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-black/25 px-2 py-1 backdrop-blur-md">
              <CheckIcon className="size-3.5 stroke-3 text-emerald-300" /> {toBn(correct)}
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-black/25 px-2 py-1 backdrop-blur-md">
              <XIcon className="size-3.5 stroke-3 text-red-300" /> {toBn(wrong)}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

// Phones: a centred capsule above the home indicator. From md up the card has room beside it, so the
// actions become a column on the right, as in short-video apps, with up/down steppers for the mouse.
function ActionRail({
  mode,
  canReset,
  atStart,
  atEnd,
  onToggleMode,
  onShare,
  onReset,
  onPrev,
  onNext,
}: {
  mode: Mode;
  canReset: boolean;
  atStart: boolean;
  atEnd: boolean;
  onToggleMode: () => void;
  onShare: () => void;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,calc(env(safe-area-inset-bottom)-0.5rem))] z-20 flex justify-center text-white md:inset-x-auto md:right-[max(1.5rem,env(safe-area-inset-right))] md:bottom-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto grid grid-cols-3 gap-1 rounded-full bg-black/35 p-1.5 ring-1 ring-white/15 backdrop-blur-md md:flex md:flex-col md:gap-4 md:rounded-none md:bg-transparent md:p-0 md:ring-0 md:backdrop-blur-none">
        <RailButton label={mode === "practice" ? "অনুশীলন" : "পড়া"} ariaLabel={mode === "practice" ? "পড়ার মোডে যান" : "অনুশীলন মোডে যান"} onClick={onToggleMode}>
          {mode === "practice" ? <TargetIcon className="size-5 md:size-6" /> : <BookOpenIcon className="size-5 md:size-6" />}
        </RailButton>
        <RailButton label="শেয়ার" ariaLabel="শেয়ার করুন" onClick={onShare}>
          <ShareIcon className="size-5 md:size-6" />
        </RailButton>
        <RailButton label="আবার" ariaLabel="আবার শুরু করুন" onClick={onReset} disabled={!canReset && atStart}>
          <ResetIcon className="size-5 md:size-6" />
        </RailButton>
        <div className="hidden flex-col gap-3 md:flex">
          <RailButton ariaLabel="আগের প্রশ্ন" onClick={onPrev} disabled={atStart}>
            <ChevronUpIcon className="size-6 stroke-[2.5]" />
          </RailButton>
          <RailButton ariaLabel="পরের প্রশ্ন" onClick={onNext} disabled={atEnd}>
            <ChevronDownIcon className="size-6 stroke-[2.5]" />
          </RailButton>
        </div>
      </div>
    </div>
  );
}

function RailButton({
  label,
  ariaLabel,
  onClick,
  disabled = false,
  children,
}: {
  label?: string;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="pressable flex h-11 min-w-22 items-center justify-center gap-1.5 rounded-full px-3 disabled:opacity-40 md:h-auto md:min-w-0 md:flex-col md:gap-1 md:px-0"
    >
      <span className="grid place-items-center md:size-12 md:rounded-full md:bg-black/30 md:ring-1 md:ring-white/15 md:backdrop-blur-md">{children}</span>
      {label && <span className="text-[13px] font-semibold md:text-[11px] md:drop-shadow">{label}</span>}
    </button>
  );
}

function ScoreRing({ value, total }: { value: number; total: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const fraction = total ? value / total : 0;
  return (
    <div className="relative mx-auto size-36">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgb(255 255 255 / 0.2)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <p className="text-[40px] leading-none font-bold">
          {toBn(value)}
          <span className="text-[20px] text-white/60">/{toBn(total)}</span>
        </p>
      </div>
    </div>
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
  const message =
    answered === 0
      ? "এখনো কোনো প্রশ্নের উত্তর দেননি।"
      : accuracy >= 80
        ? "অসাধারণ! চমৎকার প্রস্তুতি।"
        : accuracy >= 50
          ? "ভালো হয়েছে! আরেকটু অনুশীলন করুন।"
          : "হাল ছাড়বেন না, আবার চেষ্টা করুন।";

  return (
    <div className="relative mx-auto w-full max-w-md text-center">
      <p className="text-[13px] font-bold tracking-wide text-white/80">{practice ? "রিলস শেষ" : "সব প্রশ্ন পড়া শেষ"}</p>

      {practice ? (
        <>
          <div className="mt-5">
            <ScoreRing value={correct} total={total} />
          </div>
          <p className="mt-4 text-[20px] font-bold">{message}</p>
          <dl className="mt-5 grid grid-cols-3 rounded-2xl bg-black/25 py-3 ring-1 ring-white/15 backdrop-blur-md">
            <SummaryStat label="উত্তর" value={toBn(answered)} />
            <SummaryStat label="ভুল" value={toBn(answered - correct)} divider />
            <SummaryStat label="নির্ভুলতা" value={`${toBn(accuracy)}%`} divider />
          </dl>
        </>
      ) : (
        <>
          <p className="mt-3 text-[48px] leading-tight font-bold">{toBn(total)}</p>
          <p className="text-[17px] text-white/85">টি প্রশ্নের উত্তর ও ব্যাখ্যা দেখেছেন</p>
        </>
      )}

      <div className="mt-7 grid gap-2.5">
        <button
          type="button"
          onClick={practice ? onReset : onRestart}
          className="pressable inline-flex h-[50px] items-center justify-center gap-2 rounded-full bg-white text-[17px] font-bold text-black shadow-lg"
        >
          {practice ? (
            <>
              <ResetIcon className="size-5" /> আবার অনুশীলন করুন
            </>
          ) : (
            <>
              <ChevronUpIcon className="size-5 stroke-3" /> প্রথম প্রশ্নে যান
            </>
          )}
        </button>
        <AppLink
          href="/reels"
          className="pressable inline-flex h-[50px] items-center justify-center rounded-full bg-white/15 text-[17px] font-bold ring-1 ring-white/25 backdrop-blur-md"
        >
          অন্য পরীক্ষা বেছে নিন
        </AppLink>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, divider = false }: { label: string; value: string; divider?: boolean }) {
  return (
    <div className={`flex flex-col-reverse ${divider ? "border-l border-white/15" : ""}`}>
      <dt className="text-[12px] text-white/70">{label}</dt>
      <dd className="text-[20px] font-bold">{value}</dd>
    </div>
  );
}

export function ReelsSkeleton() {
  return (
    <main
      className={`fixed inset-0 flex flex-col justify-center bg-linear-to-br from-zinc-700 to-zinc-900 ${SLIDE_PADDING}`}
      aria-busy="true"
      aria-label="লোড হচ্ছে"
    >
      <div className="mx-auto w-full max-w-xl animate-pulse rounded-3xl bg-black/25 p-4 ring-1 ring-white/15 sm:p-6">
        <div className="flex justify-between">
          <div className="h-6 w-20 rounded-full bg-white/20" />
          <div className="h-4 w-24 rounded-full bg-white/15" />
        </div>
        <div className="mt-4 h-6 w-full rounded-lg bg-white/20" />
        <div className="mt-2 h-6 w-2/3 rounded-lg bg-white/20" />
        <div className="mt-5 grid gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-13 rounded-2xl bg-white/15" />
          ))}
        </div>
        <div className="mt-5 flex justify-between border-t border-white/15 pt-4">
          <div className="h-4 w-28 rounded-full bg-white/15" />
          <div className="h-9 w-24 rounded-full bg-white/20" />
        </div>
      </div>
    </main>
  );
}
