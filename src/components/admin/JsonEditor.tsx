"use client";

import { useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 1-based line to mark in the gutter, such as where a JSON parse error was found. */
  errorLine?: number | null;
};

// A plain textarea with a line-number gutter. Lines don't wrap, so each number stays level with its line.
export function JsonEditor({ value, onChange, placeholder, errorLine }: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const lineCount = useMemo(() => (value ? value.split("\n").length : 1), [value]);

  return (
    <div className="mt-4 flex h-80 resize-y overflow-hidden rounded-2xl border border-stone-300 bg-stone-50 font-mono text-[13px] leading-relaxed transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/15 sm:h-96 dark:border-stone-700 dark:bg-stone-950">
      <div
        aria-hidden="true"
        onClick={() => textarea.current?.focus()}
        className="shrink-0 overflow-hidden border-r border-stone-200 bg-stone-100/70 py-4 text-right text-stone-400 select-none dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-600"
      >
        <div style={{ transform: `translateY(${-scrollTop}px)` }}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              className={`px-3 tabular-nums ${i + 1 === errorLine ? "bg-rose-100 font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" : ""}`}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      <textarea
        ref={textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        wrap="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label="Exam JSON"
        className="h-full min-w-0 flex-1 resize-none bg-transparent p-4 whitespace-pre outline-none placeholder:text-stone-400"
      />
    </div>
  );
}

/** The 1-based line a JSON.parse error points at, when the message says (by line or by character position). */
export function jsonErrorLine(text: string, message: string): number | null {
  const line = /line (\d+)/i.exec(message);
  if (line) return Number(line[1]);
  const position = /position (\d+)/i.exec(message);
  if (position) return text.slice(0, Number(position[1])).split("\n").length;
  return null;
}
