"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { formatNumber, pluralize } from "@/lib/format";
import { SLUG_PATTERN } from "@/lib/exam-validation";
import { type SubjectValidationResult, type TopicFile, buildTopics, countQuestions, deriveSubjectSlug, validateSubjectPayload } from "@/lib/subject-validation";
import type { SubjectListResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AlertIcon, CheckIcon, ExternalLinkIcon, ResetIcon, XIcon } from "../icons";
import { Skeleton } from "../StatusViews";
import { JsonEditor, jsonErrorLine } from "./JsonEditor";

// The Subjects tab of the admin panel: one JSON file per topic (lecture sheet), the topic given in subject_info,
// or an array of those for several topics. The Study page builds its topic list from the questions' topics.

type Parsed = { kind: "empty" } | { kind: "json-error"; message: string } | { kind: "parsed"; raw: unknown; result: SubjectValidationResult };

type Notice =
  | { kind: "success"; slug: string; created: boolean; uploaded: number; questions: number; warnings: string[] }
  | { kind: "error"; message: string; errors?: string[] };

const SAMPLE = `{
  "subject_info": {
    "name": "সাধারণ জ্ঞান",
    "topic": "Parts of Speech"
  },
  "questions": [
    {
      "question_no": 1,
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
    return { kind: "parsed", raw, result: validateSubjectPayload(raw) };
  } catch (err) {
    return { kind: "json-error", message: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

export function SubjectsAdmin({ onUnauthorised }: { onUnauthorised: (res: Response) => boolean }) {
  const { state: listState, retry: reloadList } = useApi<SubjectListResponse>("/api/subjects");
  const [text, setText] = useState("");
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [replaceAll, setReplaceAll] = useState(false);
  // Set while the editor holds an existing subject (topic null) or one of its topics, loaded with Edit.
  const [editing, setEditing] = useState<{ slug: string; name: string; topic: string | null } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parse(text), [text]);
  const valid = parsed.kind === "parsed" && parsed.result.ok ? parsed.result : null;
  const existing = listState.status === "success" ? listState.data.subjects : [];
  // Re-uploading a subject with the same name keeps its slug, so it updates instead of duplicating.
  const sameName = valid ? existing.find((s) => s.subject_info.name === valid.data.subject_info.name) : undefined;
  const slug = slugOverride ?? (valid ? (sameName?.slug ?? deriveSubjectSlug(valid.data.subject_info)) : "");
  const slugValid = SLUG_PATTERN.test(slug) && slug.length <= 120;
  const target = existing.find((s) => s.slug === slug);
  const willOverwrite = target !== undefined;
  const topics = useMemo(() => (valid ? buildTopics(valid.data.topics) : []), [valid]);
  // Questions already saved per topic in the target subject: an uploaded topic with a count here replaces them.
  const savedCounts = new Map(target?.topics.map((t) => [t.name, t.total_questions]) ?? []);
  // The topic being edited is expected to be overwritten, so it needs no extra warning.
  const replacedTopics = topics.filter((t) => savedCounts.has(t.name) && t.name !== editing?.topic);

  function resetEditor() {
    setText("");
    setSlugOverride(null);
    setReplaceAll(false);
    setEditing(null);
  }

  // Loads a saved subject, or one topic of it, into the editor as upload JSON.
  async function startEdit(subjectSlug: string, name: string, topic: string | null) {
    if (text.trim() && !window.confirm("The editor has unsaved JSON. Replace it?")) return;
    const res = await fetch(`/api/admin/subjects/${encodeURIComponent(subjectSlug)}`);
    if (onUnauthorised(res)) return;
    const body = (await res.json().catch(() => null)) as { files: TopicFile[] } | null;
    if (!res.ok || !body) {
      window.alert("Couldn't load the subject. Try again.");
      return;
    }
    // Topics are stored in the upload format, so they load into the editor as they are.
    const files = topic === null ? body.files : body.files.filter((f) => f.subject_info.topic === topic);
    setText(JSON.stringify(files.length === 1 ? files[0] : files, null, 2));
    setSlugOverride(subjectSlug);
    // Editing the whole subject saves it as-is, so a topic deleted from the JSON is deleted from the subject.
    setReplaceAll(topic === null);
    setEditing({ slug: subjectSlug, name, topic });
    setNotice(null);
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function upload() {
    if (!valid || parsed.kind !== "parsed" || !slugValid) return;
    if (willOverwrite && replaceAll) {
      if (!window.confirm(`Every topic in "${slug}" will be deleted and replaced with this file. Continue?`)) return;
    } else if (replacedTopics.length > 0) {
      const names = replacedTopics.map((t) => t.name).join(", ");
      if (!window.confirm(`These topics already exist and their questions will be replaced: ${names}. Continue?`)) return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          subject: parsed.raw,
          mode: replaceAll ? "replace" : "merge",
          // A renamed topic must not leave the old one behind.
          remove_topics: editing?.topic != null && editing.slug === slug ? [editing.topic] : [],
        }),
      });
      if (onUnauthorised(res)) return;
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "error", message: body?.message ?? `Upload failed (${res.status})`, errors: body?.errors });
      } else {
        setNotice({
          kind: "success",
          slug: body.slug,
          created: body.created,
          uploaded: body.uploaded,
          questions: body.questions,
          warnings: body.warnings ?? [],
        });
        resetEditor();
        reloadList();
        window.scrollTo({ top: 0 });
      }
    } catch {
      setNotice({ kind: "error", message: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(subjectSlug: string, name: string) {
    if (!window.confirm(`The subject "${name}" will be permanently deleted. Confirm?`)) return;
    const res = await fetch(`/api/admin/subjects/${encodeURIComponent(subjectSlug)}`, { method: "DELETE" });
    if (onUnauthorised(res)) return;
    if (!res.ok) window.alert("Couldn't delete. Try again.");
    reloadList();
  }

  async function removeTopic(subjectSlug: string, name: string, topic: string, last: boolean) {
    const message = last
      ? `"${topic}" is the only topic in "${name}", so the whole subject will be deleted. Confirm?`
      : `All questions in the topic "${topic}" will be permanently deleted from "${name}". Confirm?`;
    if (!window.confirm(message)) return;
    const res = await fetch(`/api/admin/subjects/${encodeURIComponent(subjectSlug)}?topic=${encodeURIComponent(topic)}`, { method: "DELETE" });
    if (onUnauthorised(res)) return;
    if (!res.ok) window.alert("Couldn't delete. Try again.");
    reloadList();
  }

  function beautify() {
    if (parsed.kind === "parsed") setText(JSON.stringify(parsed.raw, null, 2));
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    resetEditor();
    setText(await file.text());
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <>
      {notice?.kind === "success" && (
        <div className="mt-6 animate-fade-in rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckIcon className="size-5" />
              {notice.created
                ? `New subject added (${pluralize(notice.questions, "question")})`
                : `${pluralize(notice.uploaded, "question")} uploaded · subject now has ${pluralize(notice.questions, "question")}`}
            </p>
            <Link
              href={`/study?subject=${encodeURIComponent(notice.slug)}`}
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
        <section
          ref={editorRef}
          className="scroll-mt-6 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6 dark:border-stone-800 dark:bg-stone-900"
        >
          {editing && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
              <p className="min-w-0 flex-1">
                <span className="font-semibold">
                  Editing {editing.topic === null ? `the whole subject "${editing.name}"` : `topic "${editing.topic}" in "${editing.name}"`}.
                </span>{" "}
                {editing.topic === null
                  ? "Saving replaces the subject with this JSON, so a topic removed here is deleted."
                  : "Saving replaces this topic only. Renaming the topic in the JSON renames it on the site."}
              </p>
              <button type="button" onClick={resetEditor} className="shrink-0 rounded-lg px-2 py-0.5 font-medium hover:bg-sky-100 dark:hover:bg-sky-500/20">
                Cancel
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{editing ? "Edit Subject" : "Upload Subject"}</h2>
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
                  onClick={resetEditor}
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
              <h3 className="mt-2 text-lg leading-snug font-semibold break-words">{valid.data.subject_info.name}</h3>
              {valid.data.subject_info.description && <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{valid.data.subject_info.description}</p>}
              <p className="mt-3 text-sm">
                <span className="font-semibold">{pluralize(countQuestions(valid.data.topics), "question")}</span>
                <span className="text-stone-500 dark:text-stone-400"> in {pluralize(topics.length, "topic")}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {topics.map((t) => {
                  const saved = willOverwrite && !replaceAll ? savedCounts.get(t.name) : undefined;
                  return (
                    <span key={t.name} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
                      {t.name} {formatNumber(t.total_questions)}
                      {willOverwrite && !replaceAll && (
                        <span className={saved === undefined ? "ml-1.5 text-emerald-600 dark:text-emerald-400" : "ml-1.5 text-amber-600 dark:text-amber-400"}>
                          {saved === undefined ? "new" : `replaces ${formatNumber(saved)}`}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
              {valid.warnings.length > 0 && (
                <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-amber-700 dark:text-amber-300">
                  {valid.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}

              <label className="mt-4 block text-sm font-medium">
                Slug (used in the link, e.g. &quot;bangla&quot;)
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
                {slugValid ? `/study?subject=${slug}` : "Use only lowercase English letters, numbers and hyphens (-)."}
              </p>
              {willOverwrite && slugValid && (
                <div className="mt-3 rounded-xl bg-white/60 p-3 text-sm ring-1 ring-stone-200 dark:bg-stone-950/40 dark:ring-stone-700">
                  <p>
                    <span className="font-semibold">{target.subject_info.name}</span> already has {pluralize(target.total_questions, "question")} in{" "}
                    {pluralize(target.topics.length, "topic")}.{" "}
                    {replaceAll
                      ? "All of them will be deleted and replaced with this file."
                      : replacedTopics.length > 0
                        ? "Topics marked “replaces” are overwritten; every other topic stays."
                        : "These topics will be added; every existing topic stays."}
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-stone-600 dark:text-stone-300">
                    <input type="checkbox" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} className="size-4 accent-rose-600" />
                    Replace the whole subject instead
                  </label>
                </div>
              )}

              <button
                type="button"
                onClick={upload}
                disabled={busy || !slugValid}
                className="mt-5 h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-8"
              >
                {busy
                  ? "Uploading..."
                  : editing?.slug === slug
                    ? "Save Changes"
                    : !willOverwrite
                      ? "Upload"
                      : replaceAll
                        ? "Replace Subject"
                        : "Add to Subject"}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6 lg:sticky lg:top-24 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Uploaded Subjects</h2>
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
          {listState.status === "success" && existing.length === 0 && <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">No subjects yet.</p>}
          {existing.length > 0 && (
            <ul className="mt-4 divide-y divide-stone-200 dark:divide-stone-800">
              {existing.map((s) => (
                <li key={s.slug} className="py-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/study?subject=${encodeURIComponent(s.slug)}`}
                        target="_blank"
                        className="line-clamp-2 text-sm font-medium hover:text-emerald-700 dark:hover:text-emerald-400"
                      >
                        {s.subject_info.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                        {pluralize(s.total_questions, "question")} · {pluralize(s.topics.length, "topic")}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-stone-400">{s.slug}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(s.slug, s.subject_info.name, null)}
                      className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(s.slug, s.subject_info.name)}
                      className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    >
                      Delete
                    </button>
                  </div>

                  {/* One row per topic (lecture sheet), each deletable on its own. */}
                  <ul className="mt-2 space-y-0.5 border-l-2 border-stone-200 pl-3 dark:border-stone-700">
                    {s.topics.map((t) => (
                      <li key={t.name} className="flex items-center gap-2">
                        <Link
                          href={`/study/topic?subject=${encodeURIComponent(s.slug)}&topic=${encodeURIComponent(t.name)}`}
                          target="_blank"
                          className="min-w-0 flex-1 truncate text-xs hover:text-emerald-700 dark:hover:text-emerald-400"
                        >
                          {t.name} <span className="text-stone-400">· {formatNumber(t.total_questions)}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => startEdit(s.slug, s.subject_info.name, t.name)}
                          aria-label={`Edit topic ${t.name}`}
                          className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium text-sky-700 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTopic(s.slug, s.subject_info.name, t.name, s.topics.length === 1)}
                          aria-label={`Delete topic ${t.name}`}
                          className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
