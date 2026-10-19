import { OPTION_LABELS, toBn } from "@/lib/format";
import type { Question } from "@/lib/types";
import { CheckIcon, LightbulbIcon, XIcon } from "./icons";

export type Mode = "practice" | "study";

export function QuestionCard({
  question: q,
  mode,
  selected,
  onSelect,
}: {
  question: Question;
  mode: Mode;
  selected: string | undefined;
  onSelect: (option: string) => void;
}) {
  const revealed = mode === "study" || selected !== undefined;
  const answeredCorrectly = selected === q.correct_answer;
  // Long sentence options read better stacked; short ones fit two per row on tablet and up.
  const twoColumns = q.options.every((o) => o.length <= 32);

  return (
    <article
      id={`q-${q.question_no}`}
      className="scroll-mt-24 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6 dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-lg bg-stone-900 px-2.5 py-1 font-semibold text-white dark:bg-white dark:text-stone-900">
          প্রশ্ন {toBn(q.question_no)}
        </span>
        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          {q.subject}
        </span>
        {q.topic && <span className="text-stone-500 dark:text-stone-400">{q.topic}</span>}
      </div>

      <h3 className="mt-3 text-base leading-relaxed font-semibold sm:text-lg">{q.question}</h3>

      <div className={`mt-4 grid gap-2.5 ${twoColumns ? "sm:grid-cols-2" : ""}`}>
        {q.options.map((option, i) => {
          const isCorrect = option === q.correct_answer;
          const isSelected = option === selected;

          let tone =
            "border-stone-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/50 active:scale-[0.99] dark:border-stone-700 dark:bg-stone-900 dark:hover:border-emerald-500 dark:hover:bg-emerald-500/5";
          let labelTone = "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300";
          if (revealed && isCorrect) {
            tone = "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-100";
            labelTone = "bg-emerald-600 text-white";
          } else if (revealed && isSelected) {
            tone = "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-500/10 dark:text-rose-100";
            labelTone = "bg-rose-500 text-white";
          } else if (revealed) {
            tone = "border-stone-200 bg-white text-stone-500 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400";
          }

          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              aria-pressed={isSelected}
              onClick={() => onSelect(option)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition sm:text-base ${tone} ${
                revealed ? "cursor-default" : "cursor-pointer"
              } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-xl text-sm font-semibold ${labelTone}`}>
                {OPTION_LABELS[i] ?? toBn(i + 1)}
              </span>
              <span className="flex-1">{option}</span>
              {revealed && isCorrect && <CheckIcon className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
              {revealed && isSelected && !isCorrect && <XIcon className="size-5 shrink-0 text-rose-500" />}
            </button>
          );
        })}
      </div>

      {mode === "practice" && selected !== undefined && (
        <p
          className={`mt-4 animate-fade-in text-sm font-semibold ${
            answeredCorrectly ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {answeredCorrectly ? "সঠিক উত্তর!" : `ভুল উত্তর। সঠিক উত্তর: ${q.correct_answer}`}
        </p>
      )}

      {revealed && q.explanation && (
        <div className="mt-4 animate-fade-in rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <LightbulbIcon className="size-4" /> ব্যাখ্যা
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-700 sm:text-[15px] dark:text-stone-300">{q.explanation}</p>
        </div>
      )}
    </article>
  );
}
