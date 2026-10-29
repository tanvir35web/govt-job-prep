"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { type ExamPayload, SLUG_PATTERN, type ValidationResult, deriveSlug, validateExamPayload } from "@/lib/exam-validation";
import { formatExamDate, formatNumber, pluralize } from "@/lib/format";
import type { ExamListResponse } from "@/lib/types";
import { EXAM_LIST_URL, useApi } from "@/lib/use-api";
import { AlertIcon, CheckIcon, ExternalLinkIcon, ResetIcon, XIcon } from "../icons";
import { Skeleton } from "../StatusViews";
import { ExamQuestionEditor } from "./ExamQuestionEditor";
import { JsonEditor, jsonErrorLine } from "./JsonEditor";
import { SubjectsAdmin } from "./SubjectsAdmin";

type Parsed = { kind: "empty" } | { kind: "json-error"; message: string } | { kind: "parsed"; raw: unknown; result: ValidationResult };

type Notice =
  | { kind: "success"; slug: string; created: boolean; questions: number; warnings: string[] }
  | { kind: "error"; message: string; errors?: string[] };

const SAMPLE = `{
  "exam_info": {
    "exam_title": "...",
    "organization": "...",
    "exam_type": "MCQ",
    "exam_date": "15 October, 2026",
    "total_marks": 100,
    "total_questions": 67,
    "source_url": "https://..."
  },
  "questions": [
    {
      "question_no": 1,
      "subject": "বাংলা",
      "topic": "...",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct_answer": "...",
      "explanation": "..."
    }
  ]
}`;

function parse(text: string): Parsed {
  if (!text.trim()) return { kind: "empty" };
  try {
    const raw: unknown = JSON.parse(text);
    return { kind: "parsed", raw, result: validateExamPayload(raw) };
  } catch (err) {
    return { kind: "json-error", message: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

export function AdminDashboard() {
  const router = useRouter();
  const { state: listState, retry: reloadList } = useApi<ExamListResponse>(EXAM_LIST_URL);
  const [text, setText] = useState("");
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [tab, setTab] = useState<"exams" | "subjects">("exams");
  // Slug of the exam open in the question editor, which takes the upload panel's place while set.
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parse(text), [text]);
  const valid = parsed.kind === "parsed" && parsed.result.ok ? parsed.result : null;
  const slug = slugOverride ?? (valid ? deriveSlug(valid.data.exam_info) : "");
  const slugValid = SLUG_PATTERN.test(slug) && slug.length <= 120;
  const existingExams = listState.status === "success" ? listState.data.exams : [];
  const willOverwrite = existingExams.some((e) => e.slug === slug);

  const subjects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of valid?.data.questions ?? []) counts.set(q.subject, (counts.get(q.subject) ?? 0) + 1);
    return [...counts.entries()];
  }, [valid]);

  // Stable, because the question editor's load effect depends on it.
  const handleUnauthorised = useCallback(
    (res: Response) => {
      if (res.status !== 401) return false;
      router.replace("/admin/login");
      router.refresh();
      return true;
    },
    [router],
  );

  function startEdit(examSlug: string) {
    setEditingSlug(examSlug);
    setNotice(null);
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Loads the whole exam into the upload editor, under its own slug, so saving replaces it.
  function editJson(examSlug: string, exam: ExamPayload) {
    if (text.trim() && !window.confirm("The editor has unsaved JSON. Replace it?")) return;
    setText(JSON.stringify(exam, null, 2));
    setSlugOverride(examSlug);
    setEditingSlug(null);
  }

  async function upload() {
    if (!valid || parsed.kind !== "parsed" || !slugValid) return;
    if (willOverwrite && !window.confirm(`"${slug}" already exists. It will be fully replaced with the new data. Continue?`)) return;

    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, exam: parsed.raw }),
      });
      if (handleUnauthorised(res)) return;
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "error", message: body?.message ?? `Upload failed (${res.status})`, errors: body?.errors });
      } else {
        setNotice({ kind: "success", slug: body.slug, created: body.created, questions: body.questions, warnings: body.warnings ?? [] });
        setText("");
        setSlugOverride(null);
        reloadList();
        window.scrollTo({ top: 0 });
      }
    } catch {
      setNotice({ kind: "error", message: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(examSlug: string, title: string) {
    if (!window.confirm(`The exam "${title}" will be permanently deleted. Confirm?`)) return;
    const res = await fetch(`/api/admin/exams/${encodeURIComponent(examSlug)}`, { method: "DELETE" });
    if (handleUnauthorised(res)) return;
    if (!res.ok) window.alert("Couldn't delete. Try again.");
    else if (editingSlug === examSlug) setEditingSlug(null);
    reloadList();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  function beautify() {
    if (parsed.kind === "parsed") setText(JSON.stringify(parsed.raw, null, 2));
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setText(await file.text());
    setSlugOverride(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <main className="px-safe mx-auto w-full min-w-0 max-w-6xl py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">Admin Panel</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Paste exam or subject JSON to upload. It appears on the site as soon as it is uploaded.
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="shrink-0 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Sign Out
        </button>
      </div>

      <div role="tablist" aria-label="Content type" className="mt-6 inline-flex rounded-full bg-stone-100 p-1 dark:bg-stone-800">
        {(
          [
            ["exams", "Exams"],
            ["subjects", "Subjects"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === value ? "bg-white shadow-sm dark:bg-stone-950" : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* The exam tab's state stays alive while the Subjects tab is open, so a pasted draft is not lost. */}
      {tab === "subjects" ? (
        <SubjectsAdmin onUnauthorised={handleUnauthorised} />
      ) : (
        <>
          {notice?.kind === "success" && (
            <div className="mt-6 animate-fade-in rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckIcon className="size-5" />
                  {notice.created ? "New exam added" : "Exam updated"} ({pluralize(notice.questions, "question")})
                </p>
                <Link
                  href={`/exams/${notice.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
                >
                  View on Site <ExternalLinkIcon className="size-3.5" />
                </Link>
              </div>
              {notice.warnings.length > 0 && (
                <ul className="mt-2 list-disc pl-6 text-sm text-amber-700 dark:text-amber-300">
                  {notice.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {notice?.kind === "error" && (
            <div role="alert" className="mt-6 animate-fade-in rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <p className="flex items-center gap-2 font-semibold">
                <AlertIcon className="size-5" /> {notice.message}
              </p>
              {notice.errors && (
                <ul className="mt-2 list-disc pl-6 text-sm">
                  {notice.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div ref={editorRef} className="min-w-0 scroll-mt-6">
              {/* The upload draft stays in state while the question editor is open, so it is not lost. */}
              {editingSlug ? (
                <ExamQuestionEditor
                  key={editingSlug}
                  slug={editingSlug}
                  onClose={() => {
                    setEditingSlug(null);
                    reloadList();
                  }}
                  onEditJson={(exam) => editJson(editingSlug, exam)}
                  onUnauthorised={handleUnauthorised}
                />
              ) : (
                <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6 dark:border-stone-800 dark:bg-stone-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Upload New Exam</h2>
                    <div className="flex flex-wrap gap-2">
                      <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm font-medium transition hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
                      >
                        Open .json File
                      </button>
                      {parsed.kind === "parsed" && (
                        <button
                          type="button"
                          onClick={beautify}
                          title="Format the JSON with 2-space indentation"
                          className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm font-medium transition hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
                        >
                          Beautify
                        </button>
                      )}
                      {text && (
                        <button
                          type="button"
                          onClick={() => {
                            setText("");
                            setSlugOverride(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                          <XIcon className="size-4" /> Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <JsonEditor
                    value={text}
                    onChange={(value) => {
                      setText(value);
                      setNotice(null);
                    }}
                    placeholder={SAMPLE}
                    errorLine={parsed.kind === "json-error" ? jsonErrorLine(text, parsed.message) : null}
                  />

                  {parsed.kind === "json-error" && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                      <AlertIcon className="mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 break-words">
                        Invalid JSON: <code className="font-mono text-xs break-all whitespace-pre-wrap">{parsed.message}</code>
                      </span>
                    </p>
                  )}

                  {parsed.kind === "parsed" && !parsed.result.ok && (
                    <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                      <p className="flex items-center gap-2 font-semibold">
                        <AlertIcon className="size-4" /> {pluralize(parsed.result.errors.length, "problem")} found
                      </p>
                      <ul className="mt-2 list-disc space-y-0.5 pl-6 break-words">
                        {parsed.result.errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {valid && (
                    <div className="mt-5 animate-fade-in rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckIcon className="size-4" /> Validation passed — Preview
                      </p>
                      <h3 className="mt-2 text-lg leading-snug font-semibold break-words">{valid.data.exam_info.exam_title}</h3>
                      <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                        {valid.data.exam_info.organization} · {formatExamDate(valid.data.exam_info.exam_date)} · {valid.data.exam_info.exam_type} ·
                        Total marks {formatNumber(valid.data.exam_info.total_marks)}
                      </p>
                      <p className="mt-3 text-sm">
                        <span className="font-semibold">{pluralize(valid.data.questions.length, "question")}</span>
                        <span className="text-stone-500 dark:text-stone-400"> ({formatNumber(valid.data.exam_info.total_questions)} declared)</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {subjects.map(([name, count]) => (
                          <span key={name} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
                            {name} {formatNumber(count)}
                          </span>
                        ))}
                      </div>
                      {valid.warnings.length > 0 && (
                        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-amber-700 dark:text-amber-300">
                          {valid.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      )}

                      <label className="mt-4 block text-sm font-medium">
                        Slug (last part of the link)
                        <input
                          value={slug}
                          onChange={(e) => setSlugOverride(e.target.value.toLowerCase())}
                          spellCheck={false}
                          className={`mt-1.5 h-11 w-full rounded-xl border bg-white px-3 font-mono text-base outline-none sm:text-sm focus:ring-4 dark:bg-stone-950 ${
                            slugValid
                              ? "border-stone-300 focus:border-emerald-500 focus:ring-emerald-500/15 dark:border-stone-700"
                              : "border-rose-400 focus:ring-rose-500/15"
                          }`}
                        />
                      </label>
                      <p className="mt-1.5 text-xs break-all text-stone-500 dark:text-stone-400">
                        {slugValid ? `/exams/${slug}` : "Use only lowercase English letters, numbers and hyphens (-)."}
                      </p>
                      {willOverwrite && slugValid && (
                        <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300">An exam with this slug already exists — uploading will update it.</p>
                      )}

                      <button
                        type="button"
                        onClick={upload}
                        disabled={busy || !slugValid}
                        className="mt-5 h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-8"
                      >
                        {busy ? "Uploading..." : willOverwrite ? "Update" : "Upload"}
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>

            <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6 lg:sticky lg:top-24 dark:border-stone-800 dark:bg-stone-900">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Uploaded Exams</h2>
                <button
                  type="button"
                  onClick={reloadList}
                  aria-label="Refresh list"
                  className="grid size-9 place-items-center rounded-full transition hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <ResetIcon className="size-4" />
                </button>
              </div>

              {listState.status === "loading" && (
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                </div>
              )}
              {listState.status === "error" && <p className="mt-4 text-sm text-rose-600">Couldn&apos;t load the list.</p>}
              {listState.status === "success" && existingExams.length === 0 && (
                <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">No exams yet.</p>
              )}
              {existingExams.length > 0 && (
                <ul className="mt-4 divide-y divide-stone-200 dark:divide-stone-800">
                  {existingExams.map((exam) => (
                    <li key={exam.slug} className={`flex items-start gap-3 py-3 ${editingSlug === exam.slug ? "-mx-2 rounded-xl bg-sky-50 px-2 dark:bg-sky-500/10" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <Link href={`/exams/${exam.slug}`} target="_blank" className="line-clamp-2 text-sm font-medium hover:text-emerald-700 dark:hover:text-emerald-400">
                          {exam.exam_info.exam_title}
                        </Link>
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                          {formatExamDate(exam.exam_info.exam_date)} · {pluralize(exam.exam_info.total_questions, "question")}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-stone-400">{exam.slug}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(exam.slug)}
                        className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(exam.slug, exam.exam_info.exam_title)}
                        className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
