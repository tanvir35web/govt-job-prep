"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type ExamPayload, validateExamPayload } from "@/lib/exam-validation";
import { formatNumber, pluralize } from "@/lib/format";
import type { Question } from "@/lib/types";
import { AlertIcon, ArrowLeftIcon, CheckIcon, ExternalLinkIcon, SearchIcon, XIcon } from "../icons";
import { Skeleton } from "../StatusViews";

// Edits one saved question at a time through a form, then saves just that question.
// "Edit JSON" hands the whole exam to the upload editor instead, for changes to exam_info.

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; exam: ExamPayload };

// The form's copy of a question. The correct answer is held as an option index, so editing that option's text keeps it marked.
type Draft = Omit<Question, "correct_answer"> & { correct: number };

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 sm:text-sm dark:border-stone-700 dark:bg-stone-950";

function toDraft(q: Question): Draft {
  const { correct_answer, ...rest } = q;
  return { ...rest, options: [...q.options], correct: q.options.indexOf(correct_answer) };
}

function fromDraft({ correct, ...rest }: Draft): Question {
  return { ...rest, correct_answer: rest.options[correct] ?? "" };
}

export function ExamQuestionEditor({
  slug,
  onClose,
  onEditJson,
  onUnauthorised,
}: {
  slug: string;
  onClose: () => void;
  onEditJson: (exam: ExamPayload) => void;
  onUnauthorised: (res: Response) => boolean;
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const [serverErrors, setServerErrors] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/exams/${encodeURIComponent(slug)}`);
        if (onUnauthorised(res) || cancelled) return;
        const body = (await res.json().catch(() => null)) as { exam?: ExamPayload; message?: string } | null;
        if (cancelled) return;
        if (!res.ok || !body?.exam) setLoad({ status: "error", message: body?.message ?? "Couldn't load the exam." });
        else setLoad({ status: "ready", exam: body.exam });
      } catch {
        if (!cancelled) setLoad({ status: "error", message: "Couldn't reach the server." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, onUnauthorised]);

  const exam = load.status === "ready" ? load.exam : null;
  const original = draft && exam ? exam.questions.find((q) => q.question_no === draft.question_no) : undefined;
  const dirty = draft !== null && original !== undefined && JSON.stringify(fromDraft(draft)) !== JSON.stringify(original);

  // The same check the server runs, on the exam with this question swapped in, so problems show while typing.
  const errors = useMemo(() => {
    if (!draft || !exam) return [];
    const questions = exam.questions.map((q) => (q.question_no === draft.question_no ? fromDraft(draft) : q));
    const result = validateExamPayload({ exam_info: exam.exam_info, questions });
    return result.ok ? [] : result.errors;
  }, [draft, exam]);

  const filtered = useMemo(() => {
    if (!exam) return [];
    const q = query.trim().toLowerCase();
    if (!q) return exam.questions;
    if (/^\d+$/.test(q)) return exam.questions.filter((x) => String(x.question_no).startsWith(q));
    return exam.questions.filter((x) => [x.question, x.subject, x.topic, ...x.options].some((s) => s.toLowerCase().includes(q)));
  }, [exam, query]);

  function open(q: Question) {
    setDraft(toDraft(q));
    setSaved(null);
    setServerErrors(null);
  }

  function back() {
    if (dirty && !window.confirm("Discard your changes to this question?")) return;
    setDraft(null);
  }

  function close() {
    if (dirty && !window.confirm("Discard your changes to this question?")) return;
    onClose();
  }

  function update(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setSaved(null);
    setServerErrors(null);
  }

  function setOption(i: number, value: string) {
    if (!draft) return;
    update({ options: draft.options.map((o, j) => (j === i ? value : o)) });
  }

  function addOption() {
    if (!draft) return;
    update({ options: [...draft.options, ""] });
  }

  function removeOption(i: number) {
    if (!draft || draft.options.length <= 2) return;
    const correct = i === draft.correct ? -1 : i < draft.correct ? draft.correct - 1 : draft.correct;
    update({ options: draft.options.filter((_, j) => j !== i), correct });
  }

  async function save() {
    if (!draft || !exam || errors.length > 0) return;
    setBusy(true);
    setServerErrors(null);
    try {
      const { question_no, ...question } = fromDraft(draft);
      const res = await fetch(`/api/admin/exams/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_no, question }),
      });
      if (onUnauthorised(res)) return;
      const body = (await res.json().catch(() => null)) as { question?: Question; message?: string; errors?: string[] } | null;
      if (!res.ok || !body?.question) {
        setServerErrors(body?.errors ?? [body?.message ?? `Save failed (${res.status})`]);
        return;
      }
      const next = body.question;
      setLoad({ status: "ready", exam: { ...exam, questions: exam.questions.map((q) => (q.question_no === next.question_no ? next : q)) } });
      setDraft(toDraft(next));
      setSaved(next.question_no);
    } catch {
      setServerErrors(["Couldn't reach the server."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Edit Questions</h2>
          <p className="mt-0.5 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{exam?.exam_info.exam_title ?? slug}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {exam && (
            <button
              type="button"
              onClick={() => {
                if (dirty && !window.confirm("Discard your changes to this question?")) return;
                onEditJson(exam);
              }}
              title="Edit the whole exam, including exam_info, as JSON"
              className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm font-medium transition hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
            >
              Edit JSON
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <XIcon className="size-4" /> Close
          </button>
        </div>
      </div>

      {load.status === "loading" && (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      )}

      {load.status === "error" && (
        <p role="alert" className="mt-5 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertIcon className="size-4 shrink-0" /> {load.message}
        </p>
      )}

      {exam && !draft && (
        <>
          <div className="relative mt-5">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by number or text"
              className={`${inputClass} h-11 pl-9`}
            />
          </div>
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            {query.trim() ? `${formatNumber(filtered.length)} of ${pluralize(exam.questions.length, "question")}` : pluralize(exam.questions.length, "question")}
          </p>
          <ul className="mt-2 max-h-[60svh] divide-y divide-stone-200 overflow-y-auto rounded-2xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
            {filtered.map((q) => (
              <li key={q.question_no}>
                <button
                  type="button"
                  onClick={() => open(q)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-stone-50 dark:hover:bg-stone-800/60"
                >
                  <span className="w-8 shrink-0 pt-px text-right font-mono text-xs text-stone-400 tabular-nums">{q.question_no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm">{q.question}</span>
                    <span className="mt-0.5 block truncate text-xs text-stone-500 dark:text-stone-400">
                      {q.subject}
                      {q.topic && ` · ${q.topic}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-stone-500 dark:text-stone-400">No matching questions.</li>}
          </ul>
        </>
      )}

      {exam && draft && (
        <div className="mt-5">
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <ArrowLeftIcon className="size-4" /> All questions
          </button>

          <h3 className="mt-3 font-semibold">Question {formatNumber(draft.question_no)}</h3>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Subject
              <input value={draft.subject} onChange={(e) => update({ subject: e.target.value })} className={`${inputClass} mt-1.5 h-11`} />
            </label>
            <label className="block text-sm font-medium">
              Topic <span className="font-normal text-stone-400">(optional)</span>
              <input value={draft.topic} onChange={(e) => update({ topic: e.target.value })} className={`${inputClass} mt-1.5 h-11`} />
            </label>
          </div>

          <label className="mt-3 block text-sm font-medium">
            Question
            <textarea value={draft.question} onChange={(e) => update({ question: e.target.value })} rows={3} className={`${inputClass} mt-1.5 py-2.5`} />
          </label>

          <fieldset className="mt-3">
            <legend className="text-sm font-medium">Options — select the correct answer</legend>
            <div className="mt-1.5 space-y-2">
              {draft.options.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-answer"
                    checked={draft.correct === i}
                    onChange={() => update({ correct: i })}
                    aria-label={`Option ${i + 1} is correct`}
                    className="size-4 shrink-0 accent-emerald-600"
                  />
                  <input
                    value={option}
                    onChange={(e) => setOption(i, e.target.value)}
                    aria-label={`Option ${i + 1}`}
                    className={`${inputClass} h-11 ${draft.correct === i ? "border-emerald-500 dark:border-emerald-500" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={draft.options.length <= 2}
                    aria-label={`Remove option ${i + 1}`}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-stone-800"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOption}
              className="mt-2 rounded-lg px-2 py-1 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
            >
              + Add option
            </button>
          </fieldset>

          <label className="mt-3 block text-sm font-medium">
            Explanation <span className="font-normal text-stone-400">(optional)</span>
            <textarea value={draft.explanation} onChange={(e) => update({ explanation: e.target.value })} rows={4} className={`${inputClass} mt-1.5 py-2.5`} />
          </label>

          {(serverErrors ?? errors).length > 0 && (
            <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <p className="flex items-center gap-2 font-semibold">
                <AlertIcon className="size-4" /> {serverErrors ? "Couldn't save" : "Fix before saving"}
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-6 break-words">
                {(serverErrors ?? errors).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty || errors.length > 0}
              className="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {busy ? "Saving..." : "Save Question"}
            </button>
            {saved === draft.question_no && !dirty && (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckIcon className="size-4" /> Saved
                <Link href={`/exams/${slug}`} target="_blank" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                  View on Site <ExternalLinkIcon className="size-3.5" />
                </Link>
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
