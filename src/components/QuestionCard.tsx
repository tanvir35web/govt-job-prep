import { OPTION_LABELS, toBn } from "@/lib/format";
import type { Question } from "@/lib/types";
import { CheckIcon, XIcon } from "./icons";

export type Mode = "practice" | "study";

// One question in the exam page's list. Flat: no card behind it; the list separates questions with hairlines.
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
    <article id={`q-${q.question_no}`} className="scroll-mt-[max(1rem,env(safe-area-inset-top))] py-6">
      <p className="text-[13px] text-secondary">
        <span className="font-semibold text-label tabular-nums">{toBn(q.question_no)}</span>
        <span aria-hidden="true" className="mx-1.5 text-tertiary">
          /
        </span>
        {q.subject}
        {q.topic && <span className="text-tertiary"> · {q.topic}</span>}
      </p>

      <h3 className="mt-2 text-[18px] leading-relaxed font-semibold">{q.question}</h3>

      <div className={`mt-4 grid gap-2 ${twoColumns ? "sm:grid-cols-2" : ""}`}>
        {q.options.map((option, i) => {
          const isCorrect = option === q.correct_answer;
          const isSelected = option === selected;

          let tone = "border-separator active:bg-fill";
          let labelTone = "text-tertiary";
          if (revealed && isCorrect) {
            tone = "border-ios-green/50 bg-ios-green/8 text-ios-green";
            labelTone = "text-ios-green";
          } else if (revealed && isSelected) {
            tone = "border-ios-red/50 bg-ios-red/8 text-ios-red";
            labelTone = "text-ios-red";
          } else if (revealed) {
            tone = "border-separator text-secondary";
          }

          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              aria-pressed={isSelected}
              onClick={() => onSelect(option)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[16px] transition-colors ${tone} ${
                revealed ? "cursor-default" : "cursor-pointer"
              } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tint`}
            >
              <span className={`w-4 shrink-0 text-[14px] font-semibold ${labelTone}`}>{OPTION_LABELS[i] ?? toBn(i + 1)}</span>
              <span className="flex-1">{option}</span>
              {revealed && isCorrect && <CheckIcon className="size-4.5 shrink-0 stroke-[2.5]" />}
              {revealed && isSelected && !isCorrect && <XIcon className="size-4.5 shrink-0 stroke-[2.5]" />}
            </button>
          );
        })}
      </div>

      {mode === "practice" && selected !== undefined && (
        <p className={`mt-3 animate-fade-in text-[14px] font-semibold ${answeredCorrectly ? "text-ios-green" : "text-ios-red"}`}>
          {answeredCorrectly ? "সঠিক উত্তর" : `ভুল উত্তর · সঠিক: ${q.correct_answer}`}
        </p>
      )}

      {revealed && q.explanation && (
        <div className="mt-4 animate-fade-in border-l-2 border-ios-yellow/60 pl-3.5">
          <p className="text-[12px] font-semibold tracking-wide text-ios-yellow">ব্যাখ্যা</p>
          <p className="mt-1 text-[15px] leading-relaxed text-label/80">{q.explanation}</p>
        </div>
      )}
    </article>
  );
}
