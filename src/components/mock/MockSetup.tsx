"use client";

import { useEffect, useMemo, useState } from "react";
import { formatNumber, pluralize } from "@/lib/format";
import { MARK_OPTIONS, type MockConfig, type MockResult, SECOND_OPTIONS, formatDuration, saveConfig } from "@/lib/mock-exam";
import type { MockSubjectSummary } from "@/lib/types";
import { CheckIcon, TimerIcon } from "../icons";
import { PageTitle } from "../PageTitle";
import { Segmented } from "../Segmented";
import { Section } from "../settings/SettingsList";

// Before an exam: marks, seconds per question and subjects, with a live summary and the start button on top.
export function MockSetup({
  subjects,
  totalQuestions,
  initial,
  history,
  starting = false,
  error = null,
  onStart,
  onClearHistory,
}: {
  subjects: MockSubjectSummary[];
  totalQuestions: number;
  initial: MockConfig;
  history: MockResult[];
  starting?: boolean;
  error?: string | null;
  onStart: (config: MockConfig) => void;
  onClearHistory: () => void;
}) {
  const [config, setConfig] = useState<MockConfig>(() => ({
    ...initial,
    // Drop remembered subjects that no longer exist in the subject list.
    subjects: subjects.length ? initial.subjects.filter((s) => subjects.some((sub) => sub.name === s)) : initial.subjects,
  }));

  const update = (patch: Partial<MockConfig>) =>
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });

  const selected = new Set(config.subjects);
  const allSubjects = selected.size === 0;
  const available = allSubjects
    ? totalQuestions
    : subjects.filter((s) => selected.has(s.name)).reduce((sum, s) => sum + s.count, 0);
  const count = Math.min(config.count, available > 0 ? available : config.count);

  const toggleSubject = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    // Every subject ticked is the same as "all".
    update({ subjects: next.size === subjects.length ? [] : [...next] });
  };

  return (
    <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
      <PageTitle title="Exam" subtitle="Random questions from every past paper, against the clock" />

      {/* Summary and start */}
      <section className="mt-2 rounded-2xl bg-surface p-4" aria-label="Exam summary">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-tint/15 text-tint">
            <TimerIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold">
              {pluralize(count, "mark")} · {formatNumber(config.seconds)}s each
            </p>
            <p className="text-[13px] text-secondary">
              {formatDuration(count * config.seconds * 1000)} in total · {allSubjects ? "all subjects" : pluralize(selected.size, "subject")}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-ios-red/10 px-3 py-2 text-[14px] text-ios-red font-medium">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => onStart({ ...config, count })}
          disabled={starting || totalQuestions === 0 || count === 0}
          className="pressable mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-tint text-[17px] font-semibold text-white disabled:opacity-40 dark:text-black"
        >
          {starting ? "Preparing exam questions…" : "Start exam"}
        </button>
      </section>

      <Section
        title="Marks"
        footer={
          available < config.count
            ? `Only ${pluralize(available, "question")} in the chosen subjects, so the exam will have ${formatNumber(count)}.`
            : "One mark per question."
        }
      >
        <li className="p-3">
          <Segmented label="Marks" options={MARK_OPTIONS} value={config.count as (typeof MARK_OPTIONS)[number]} onChange={(n) => update({ count: n })} format={formatNumber} />
        </li>
      </Section>

      <Section title="Time per question" footer="When the time runs out, the exam moves on and the question counts as skipped.">
        <li className="p-3">
          <Segmented
            label="Seconds per question"
            options={SECOND_OPTIONS}
            value={config.seconds as (typeof SECOND_OPTIONS)[number]}
            onChange={(s) => update({ seconds: s })}
            format={(s) => `${s}s`}
          />
        </li>
      </Section>

      <Section title="Subjects" footer={`${pluralize(available, "question")} to draw from.`}>
        <SubjectRow label="All subjects" count={totalQuestions} checked={allSubjects} onToggle={() => update({ subjects: [] })} />
        {subjects.map((s) => (
          <SubjectRow key={s.name} label={s.name} count={s.count} checked={!allSubjects && selected.has(s.name)} onToggle={() => toggleSubject(s.name)} />
        ))}
      </Section>

      {history.length > 0 && (
        <Section
          title="Recent results"
          footer={
            <button type="button" onClick={onClearHistory} className="pressable font-medium text-ios-red">
              Clear results
            </button>
          }
        >
          {history.map((r) => (
            <HistoryRow key={r.finishedAt} result={r} />
          ))}
        </Section>
      )}
    </main>
  );
}

function SubjectRow({ label, count, checked, onToggle }: { label: string; count: number; checked: boolean; onToggle: () => void }) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className="flex w-full items-center pl-4 text-left transition-colors active:bg-fill-strong"
      >
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 [li:not(:last-child)_&]:hairline-b">
          <span className="min-w-0 flex-1 truncate text-[17px]">{label}</span>
          <span className="shrink-0 text-[15px] text-secondary tabular-nums">{formatNumber(count)}</span>
          <span className="grid size-5 shrink-0 place-items-center">{checked && <CheckIcon className="size-5 stroke-[2.5] text-tint" />}</span>
        </div>
      </button>
    </li>
  );
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function HistoryRow({ result }: { result: MockResult }) {
  const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  const tone = pct >= 80 ? "text-ios-green" : pct >= 50 ? "text-tint" : "text-ios-red";
  return (
    <li className="flex items-center gap-3 pl-4">
      <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 [li:not(:last-child)_&]:hairline-b">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold tabular-nums">
            {formatNumber(result.correct)}/{formatNumber(result.total)}
          </p>
          <p className="truncate text-[13px] text-secondary">
            {DATE_FORMAT.format(result.finishedAt)} · {result.config.seconds}s each · {formatDuration(result.durationMs)}
          </p>
        </div>
        <span className={`shrink-0 text-[17px] font-semibold tabular-nums ${tone}`}>{formatNumber(pct)}%</span>
      </div>
    </li>
  );
}
