"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coverFor } from "@/lib/covers";
import { OPTION_LABELS, firstLetter, formatNumber, pluralize } from "@/lib/format";
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
  ListIcon,
  ResetIcon,
  TargetIcon,
  XIcon,
} from "./icons";
import type { Mode } from "./QuestionCard";
import { Sheet } from "./Sheet";
import { ErrorState, Skeleton } from "./StatusViews";

// Reels: one question per screen in a vertical feed that snaps to each question, like short videos.
// Each slide is full-bleed with a soft wash of its subject's colour over the theme background; text uses the theme colours.
// Answers are shared with the exam page, so progress made in either place shows in both.

export function ReelsView({ slug }: { slug: string }) {
  const { state, retry } = useApi<ExamDetailResponse>(`/api/exams/${encodeURIComponent(slug)}`);
  const loaded = state.status === "success";

  useEffect(() => {
    if (loaded && navigator.onLine) void saveExamOffline(slug);
  }, [loaded, slug]);

  if (state.status === "loading") return <ReelsSkeleton />;

  if (state.status === "error") {
    const back = { showHomeLink: true, homeHref: "/reels", homeLabel: "All reels" };
    return (
      <main className="px-safe flex-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {state.code === 404 ? (
          <ErrorState title="Exam not found" message="Check the link, or choose an exam from the list." {...back} />
        ) : state.code === 0 ? (
          <ErrorState
            offline
            title="No internet connection"
            message="This exam hasn't been opened before, so it isn't available offline."
            onRetry={retry}
            {...back}
          />
        ) : (
          <ErrorState title="Couldn't load questions" message="Something went wrong on the server. Try again in a moment." onRetry={retry} {...back} />
        )}
      </main>
    );
  }

  if (state.data.questions.length === 0) {
    return (
      <main className="px-safe flex-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <ErrorState title="No questions" message="No questions have been added to this exam yet." showHomeLink homeHref="/reels" homeLabel="All reels" />
      </main>
    );
  }

  return <ReelsFeed slug={slug} info={state.data.exam_info} questions={state.data.questions} />;
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

// Equal side padding keeps the card centred. The top clears the top bar; on phones the bottom clears the action bar.
const SLIDE_PADDING = "px-safe pt-[calc(6rem+env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-[calc(2rem+env(safe-area-inset-bottom))]";

function ReelsFeed({ slug, info, questions }: { slug: string; info: ExamInfo; questions: Question[] }) {
  const [mode, setMode] = useState<Mode>(defaultModeSetting.get);
  // Only rendered on the client after the fetch resolves, so reading localStorage here is safe.
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(slug));
  const [current, setCurrent] = useState(() => Math.min(loadReelsPosition(slug), questions.length - 1));
  const [toast, setToast] = useState<string | null>(null);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
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

  // The page itself scrolls (not an inner box), so mobile browsers hide their address bar while
  // swiping and each slide gets the whole screen. Snapping is switched on for this page only.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollSnapType;
    root.style.scrollSnapType = "y mandatory";
    return () => {
      root.style.scrollSnapType = previous;
    };
  }, []);

  // Reopen on the question that was showing last time. Runs once; later changes come from scrolling.
  const initial = useRef(current);
  useEffect(() => {
    slideRefs.current[initial.current]?.scrollIntoView({ block: "start", behavior: "instant" });
  }, []);

  // The slide crossing the middle of the screen is the current one; works for slides taller than the screen too.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
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
    if (window.confirm("This will clear all your answers. Continue?")) {
      setAnswers({});
      goTo(0);
    }
  };

  // Subjects in the order they first appear, with the slide index of each of their questions.
  const subjects = useMemo(() => {
    const map = new Map<string, number[]>();
    questions.forEach((q, i) => map.set(q.subject, [...(map.get(q.subject) ?? []), i]));
    return [...map.entries()].map(([name, indices]) => ({ name, indices }));
  }, [questions]);
  const currentSubject = onSummary ? null : questions[current].subject;

  // Lands on the subject's first unanswered question, or its first question once all are answered.
  const jumpToSubject = (indices: number[]) => {
    const target = indices.find((i) => answers[questions[i].question_no] === undefined) ?? indices[0];
    setSubjectsOpen(false);
    goTo(target);
  };

  const toggleMode = () => {
    const next = mode === "practice" ? "study" : "practice";
    setMode(next);
    setToast(next === "practice" ? "Practice mode: answer to check" : "Study mode: showing all answers");
  };

  return (
    <>
      <title>{`${info.exam_title} · Reels | Govt Job Prep`}</title>

      <main className="bg-canvas text-label" aria-label="Question reels">
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
          aria-label="Results"
          className={`relative flex min-h-dvh snap-start snap-always flex-col justify-center bg-canvas ${SLIDE_PADDING}`}
        >
          <SoftWash cover={coverFor(info.organization)} />
          <SummaryCard mode={mode} total={questions.length} answered={answered} correct={correct} onReset={reset} onRestart={() => goTo(0)} />
        </section>
      </main>

      <ReelsTopBar
        title={info.exam_title}
        context={currentSubject ?? info.organization}
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
        onSubjects={() => setSubjectsOpen(true)}
        hasSubjects={subjects.length > 1}
        onReset={reset}
        onPrev={() => goTo(current - 1)}
        onNext={() => goTo(current + 1)}
      />

      {subjectsOpen && (
        <Sheet title="Choose a subject" onClose={() => setSubjectsOpen(false)}>
          <SubjectList subjects={subjects} questions={questions} answers={answers} mode={mode} current={currentSubject} onPick={jumpToSubject} />
        </Sheet>
      )}

      {toast && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <p className="animate-fade-in rounded-full bg-label/85 px-4 py-2 text-[14px] font-medium text-canvas">{toast}</p>
        </div>
      )}
    </>
  );
}

// A faint, see-through wash of the cover gradient over the theme background.
function SoftWash({ cover }: { cover: string }) {
  return <span aria-hidden="true" className={`absolute inset-0 bg-linear-to-br opacity-15 dark:opacity-25 ${cover}`} />;
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
      aria-label={`Question ${formatNumber(index + 1)} of ${formatNumber(total)}`}
      className={`relative flex min-h-dvh snap-start snap-always flex-col justify-center bg-canvas ${SLIDE_PADDING}`}
    >
      <SoftWash cover={coverFor(q.subject)} />

      <article className="relative mx-auto w-full max-w-xl">
        <header className="flex items-center justify-between gap-3 text-[12px] font-semibold">
          <span className="shrink-0 rounded-full bg-label px-2.5 py-1 text-canvas">Question {formatNumber(q.question_no)}</span>
          <span className="min-w-0 truncate text-right text-secondary">
            {q.subject}
            {q.topic && <span className="font-medium text-tertiary"> · {q.topic}</span>}
          </span>
        </header>

        <h2 className={`mt-4 leading-snug font-bold text-balance ${long ? "text-[18px]" : "text-[21px] sm:text-[24px]"}`}>{q.question}</h2>

        <div className="mt-5 grid gap-2.5">
          {q.options.map((option, i) => (
            <ReelOption
              key={i}
              label={OPTION_LABELS[i] ?? formatNumber(i + 1)}
              option={option}
              revealed={revealed}
              correct={option === q.correct_answer}
              chosen={option === selected}
              onSelect={() => onSelect(option)}
            />
          ))}
        </div>

        {revealed && q.explanation && (
          <div className="mt-4 animate-fade-in rounded-2xl bg-ios-yellow/10 p-3.5">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-ios-yellow">
              <LightbulbIcon className="size-4" /> Explanation
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-label/85">{q.explanation}</p>
          </div>
        )}

        {/* Footer: status on the left, the step forward on the right. */}
        <footer className="mt-5 flex min-h-10 items-center justify-between gap-3 border-t border-separator pt-4">
          <SlideStatus mode={mode} selected={selected} correctAnswer={q.correct_answer} first={index === 0} />
          <button
            type="button"
            onClick={onNext}
            className={`pressable inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-2 text-[14px] font-bold ${
              revealed ? "bg-tint text-white dark:text-black" : "bg-fill text-label"
            }`}
          >
            {isLast ? "Results" : revealed ? "Next" : "Skip"} <ChevronDownIcon className="size-4 stroke-3" />
          </button>
        </footer>
      </article>
    </section>
  );
}

function SlideStatus({ mode, selected, correctAnswer, first }: { mode: Mode; selected: string | undefined; correctAnswer: string; first: boolean }) {
  if (mode === "study") return <p className="text-[13px] font-medium text-secondary">Study mode</p>;
  if (selected === undefined) {
    return (
      <p className="flex min-w-0 items-center gap-1 text-[13px] font-medium text-secondary">
        {first && <ChevronUpIcon className="size-4 shrink-0 animate-bounce stroke-[2.5]" />}
        {first ? "Answer, then swipe up" : "Choose an answer"}
      </p>
    );
  }
  const right = selected === correctAnswer;
  return (
    <p className={`inline-flex min-w-0 animate-fade-in items-center gap-1.5 text-[15px] font-bold ${right ? "text-ios-green" : "text-ios-red"}`}>
      {right ? <CheckIcon className="size-4.5 shrink-0 stroke-3" /> : <XIcon className="size-4.5 shrink-0 stroke-3" />}
      {right ? "Correct!" : "Wrong"}
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
  let tone = "bg-surface/80 ring-separator active:bg-surface";
  let badge = "bg-fill text-secondary";
  if (revealed && correct) {
    tone = "bg-ios-green/15 ring-ios-green/40";
    badge = "bg-ios-green text-white dark:text-black";
  } else if (revealed && chosen) {
    tone = "bg-ios-red/15 ring-ios-red/40";
    badge = "bg-ios-red text-white";
  } else if (revealed) {
    tone = "bg-surface/50 text-secondary ring-separator";
    badge = "bg-fill text-tertiary";
  }

  return (
    <button
      type="button"
      disabled={revealed}
      aria-pressed={chosen}
      onClick={onSelect}
      className={`flex min-h-13 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[16px] font-medium ring-1 transition-all duration-200 ${tone} ${
        revealed ? "cursor-default" : "cursor-pointer active:scale-[0.98]"
      } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tint`}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-bold ${badge}`}>{label}</span>
      <span className="flex-1">{option}</span>
      {revealed && correct && <CheckIcon className="size-5 shrink-0 stroke-3 text-ios-green" />}
      {revealed && chosen && !correct && <XIcon className="size-5 shrink-0 stroke-3 text-ios-red" />}
    </button>
  );
}

function ReelsTopBar({
  title,
  context,
  position,
  total,
  mode,
  correct,
  wrong,
}: {
  title: string;
  context: string;
  position: number;
  total: number;
  mode: Mode;
  correct: number;
  wrong: number;
}) {
  return (
    // A floating capsule, like the tab bar on the other pages: it hovers above the slide with a gap on every side.
    <header className="px-safe pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-20 text-label">
      <div className="ios-material pointer-events-auto relative mx-auto flex max-w-xl items-center gap-2.5 overflow-hidden rounded-full p-1.5 pr-2 shadow-[0_8px_32px_rgb(0_0_0/0.12),0_2px_6px_rgb(0_0_0/0.05)] ring-[0.5px] ring-separator dark:shadow-[0_8px_32px_rgb(0_0_0/0.5)] dark:ring-white/10">
        <AppLink
          href="/reels"
          aria-label="Back to all reels"
          className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-tint"
        >
          <ChevronLeftIcon className="size-6 stroke-[2.5]" />
        </AppLink>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-bold">{title}</p>
          <p className="truncate text-[12px] text-secondary">{context}</p>
        </div>

        {mode === "practice" && (
          <div className="flex shrink-0 items-center gap-2 text-[13px] font-bold" aria-label={`${formatNumber(correct)} correct, ${formatNumber(wrong)} wrong`}>
            <span className="inline-flex items-center gap-0.5 text-ios-green">
              <CheckIcon className="size-3.5 stroke-3" /> {formatNumber(correct)}
            </span>
            <span className="inline-flex items-center gap-0.5 text-ios-red">
              <XIcon className="size-3.5 stroke-3" /> {formatNumber(wrong)}
            </span>
          </div>
        )}

        <span className="shrink-0 rounded-full bg-label px-2.5 py-1 text-[12px] font-bold text-canvas tabular-nums">
          {formatNumber(position)}/{formatNumber(total)}
        </span>

        {/* Position in the feed, drawn as a hairline along the capsule's lower edge. */}
        <div
          className="absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full bg-fill"
          role="progressbar"
          aria-label="Position"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={position}
        >
          <div className="h-full rounded-full bg-tint transition-[width] duration-300" style={{ width: `${(position / total) * 100}%` }} />
        </div>
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
  onSubjects,
  hasSubjects,
  onReset,
  onPrev,
  onNext,
}: {
  mode: Mode;
  canReset: boolean;
  atStart: boolean;
  atEnd: boolean;
  onToggleMode: () => void;
  onSubjects: () => void;
  hasSubjects: boolean;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,calc(env(safe-area-inset-bottom)-0.5rem))] z-20 flex justify-center text-label md:inset-x-auto md:right-[max(1.5rem,env(safe-area-inset-right))] md:bottom-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto ios-material grid grid-cols-3 gap-1 rounded-full p-1.5 shadow-[0_8px_32px_rgb(0_0_0/0.12)] ring-[0.5px] ring-separator md:flex md:flex-col md:gap-4 md:rounded-none md:bg-transparent md:p-0 md:shadow-none md:ring-0 md:backdrop-blur-none">
        <RailButton label={mode === "practice" ? "Practice" : "Study"} ariaLabel={mode === "practice" ? "Switch to study mode" : "Switch to practice mode"} onClick={onToggleMode}>
          {mode === "practice" ? <TargetIcon className="size-5 md:size-6" /> : <BookOpenIcon className="size-5 md:size-6" />}
        </RailButton>
        <RailButton label="Subjects" ariaLabel="Jump to a subject" onClick={onSubjects} disabled={!hasSubjects}>
          <ListIcon className="size-5 md:size-6" />
        </RailButton>
        <RailButton label="Restart" ariaLabel="Start over" onClick={onReset} disabled={!canReset && atStart}>
          <ResetIcon className="size-5 md:size-6" />
        </RailButton>
        <div className="hidden flex-col gap-3 md:flex">
          <RailButton ariaLabel="Previous question" onClick={onPrev} disabled={atStart}>
            <ChevronUpIcon className="size-6 stroke-[2.5]" />
          </RailButton>
          <RailButton ariaLabel="Next question" onClick={onNext} disabled={atEnd}>
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
      <span className="grid place-items-center text-tint md:size-12 md:rounded-full md:bg-surface md:shadow-[0_4px_16px_rgb(0_0_0/0.1)] md:ring-[0.5px] md:ring-separator">{children}</span>
      {label && <span className="text-[13px] font-semibold md:text-[11px] md:text-secondary">{label}</span>}
    </button>
  );
}

function SubjectList({
  subjects,
  questions,
  answers,
  mode,
  current,
  onPick,
}: {
  subjects: { name: string; indices: number[] }[];
  questions: Question[];
  answers: Answers;
  mode: Mode;
  current: string | null;
  onPick: (indices: number[]) => void;
}) {
  return (
    <ul className="overflow-hidden rounded-2xl bg-surface dark:bg-fill">
      {subjects.map(({ name, indices }, i) => {
        const answered = indices.filter((idx) => answers[questions[idx].question_no] !== undefined).length;
        const done = answered === indices.length;
        const here = name === current;
        // Some papers interleave subjects; a number range would then wrongly include other subjects' questions.
        const contiguous = indices.every((idx, k) => k === 0 || idx === indices[k - 1] + 1);
        return (
          <li key={name}>
            <button
              type="button"
              onClick={() => onPick(indices)}
              aria-current={here ? "true" : undefined}
              className="flex w-full items-center gap-3 pl-4 text-left transition-colors active:bg-fill-strong"
            >
              <span
                aria-hidden="true"
                className={`grid size-10 shrink-0 place-items-center rounded-[10px] bg-linear-to-br text-[16px] font-bold text-white ${coverFor(name)}`}
              >
                {firstLetter(name)}
              </span>
              <div className={`min-w-0 flex-1 py-3 pr-4 ${i < subjects.length - 1 ? "hairline-b" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[17px] font-semibold">{name}</span>
                  {here ? (
                    <span className="shrink-0 rounded-full bg-tint/15 px-2 py-0.5 text-[12px] font-bold text-tint">Current</span>
                  ) : (
                    done && mode === "practice" && <CheckIcon className="size-4.5 shrink-0 stroke-3 text-ios-green" />
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-secondary">
                  {pluralize(indices.length, "question")}
                  {contiguous && indices.length > 1 && ` · Questions ${formatNumber(questions[indices[0]].question_no)}–${formatNumber(questions[indices.at(-1)!].question_no)}`}
                  {mode === "practice" && ` · ${formatNumber(answered)} answered`}
                </p>
                {mode === "practice" && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-fill">
                    <div className="h-full rounded-full bg-tint" style={{ width: `${(answered / indices.length) * 100}%` }} />
                  </div>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ScoreRing({ value, total }: { value: number; total: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const fraction = total ? value / total : 0;
  return (
    <div className="relative mx-auto size-36">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-fill" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="stroke-tint transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <p className="text-[40px] leading-none font-bold">
          {formatNumber(value)}
          <span className="text-[20px] text-tertiary">/{formatNumber(total)}</span>
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
      ? "You haven't answered any questions yet."
      : accuracy >= 80
        ? "Excellent! You're well prepared."
        : accuracy >= 50
          ? "Well done! A bit more practice will help."
          : "Don't give up. Try again.";

  return (
    <div className="relative mx-auto w-full max-w-md text-center">
      <p className="text-[13px] font-bold tracking-wide text-tint">{practice ? "Reels complete" : "All questions studied"}</p>

      {practice ? (
        <>
          <div className="mt-5">
            <ScoreRing value={correct} total={total} />
          </div>
          <p className="mt-4 text-[20px] font-bold">{message}</p>
          <dl className="mt-5 grid grid-cols-3 border-y border-separator py-3">
            <SummaryStat label="Answered" value={formatNumber(answered)} />
            <SummaryStat label="Wrong" value={formatNumber(answered - correct)} divider />
            <SummaryStat label="Accuracy" value={`${formatNumber(accuracy)}%`} divider />
          </dl>
        </>
      ) : (
        <>
          <p className="mt-3 text-[48px] leading-tight font-bold">{formatNumber(total)}</p>
          <p className="text-[17px] text-secondary">{total === 1 ? "question" : "questions"} reviewed with answers and explanations</p>
        </>
      )}

      <div className="mt-7 grid gap-2.5">
        <button
          type="button"
          onClick={practice ? onReset : onRestart}
          className="pressable inline-flex h-[50px] items-center justify-center gap-2 rounded-full bg-tint text-[17px] font-bold text-white dark:text-black"
        >
          {practice ? (
            <>
              <ResetIcon className="size-5" /> Practise again
            </>
          ) : (
            <>
              <ChevronUpIcon className="size-5 stroke-3" /> Back to first question
            </>
          )}
        </button>
        <AppLink
          href="/reels"
          className="pressable inline-flex h-[50px] items-center justify-center rounded-full bg-fill text-[17px] font-bold text-tint"
        >
          Choose another exam
        </AppLink>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, divider = false }: { label: string; value: string; divider?: boolean }) {
  return (
    <div className={`flex flex-col-reverse ${divider ? "border-l-[0.5px] border-separator" : ""}`}>
      <dt className="text-[12px] text-secondary">{label}</dt>
      <dd className="text-[20px] font-bold">{value}</dd>
    </div>
  );
}

export function ReelsSkeleton() {
  return (
    <main className={`fixed inset-0 flex flex-col justify-center bg-canvas ${SLIDE_PADDING}`} aria-busy="true" aria-label="Loading">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex justify-between">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-6 w-full" />
        <Skeleton className="mt-2 h-6 w-2/3" />
        <div className="mt-5 grid gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-13 rounded-2xl" />
          ))}
        </div>
        <div className="mt-5 flex justify-between border-t border-separator pt-4">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
    </main>
  );
}
