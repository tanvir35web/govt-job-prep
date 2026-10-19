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
    <article id={`q-${q.question_no}`} className="scroll-mt-[calc(env(safe-area-inset-top)+3.5rem)] rounded-2xl bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
        <span className="font-semibold text-tint">প্রশ্ন {toBn(q.question_no)}</span>
        <span aria-hidden="true" className="text-tertiary">
          ·
        </span>
        <span className="font-medium text-secondary">{q.subject}</span>
        {q.topic && (
          <>
            <span aria-hidden="true" className="text-tertiary">
              ·
            </span>
            <span className="text-secondary">{q.topic}</span>
          </>
        )}
      </div>

      <h3 className="mt-2 text-[17px] leading-relaxed font-semibold">{q.question}</h3>

      <div className={`mt-3 grid gap-2 ${twoColumns ? "sm:grid-cols-2" : ""}`}>
        {q.options.map((option, i) => {
          const isCorrect = option === q.correct_answer;
          const isSelected = option === selected;

          let tone = "bg-fill active:bg-fill-strong";
          let labelTone = "bg-surface text-secondary";
          if (revealed && isCorrect) {
            tone = "bg-ios-green/15";
            labelTone = "bg-ios-green text-white dark:text-black";
          } else if (revealed && isSelected) {
            tone = "bg-ios-red/15";
            labelTone = "bg-ios-red text-white";
          } else if (revealed) {
            tone = "bg-fill text-secondary";
          }

          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              aria-pressed={isSelected}
              onClick={() => onSelect(option)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[16px] transition-colors ${tone} ${
                revealed ? "cursor-default" : "cursor-pointer"
              } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tint`}
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[14px] font-semibold ${labelTone}`}>
                {OPTION_LABELS[i] ?? toBn(i + 1)}
              </span>
              <span className="flex-1">{option}</span>
              {revealed && isCorrect && <CheckIcon className="size-5 shrink-0 stroke-[2.5] text-ios-green" />}
              {revealed && isSelected && !isCorrect && <XIcon className="size-5 shrink-0 stroke-[2.5] text-ios-red" />}
            </button>
          );
        })}
      </div>

      {mode === "practice" && selected !== undefined && (
        <p className={`mt-3 animate-fade-in text-[15px] font-semibold ${answeredCorrectly ? "text-ios-green" : "text-ios-red"}`}>
          {answeredCorrectly ? "সঠিক উত্তর!" : `ভুল উত্তর। সঠিক উত্তর: ${q.correct_answer}`}
        </p>
      )}

      {revealed && q.explanation && (
        <div className="mt-3 animate-fade-in rounded-xl bg-ios-yellow/10 p-3.5">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ios-yellow">
            <LightbulbIcon className="size-4" /> ব্যাখ্যা
          </div>
          <p className="mt-1 text-[15px] leading-relaxed text-label/85">{q.explanation}</p>
        </div>
      )}
    </article>
  );
}
