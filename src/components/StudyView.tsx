"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { softToneFor } from "@/lib/covers";
import { firstLetter, formatNumber, pluralize } from "@/lib/format";
import { type SubjectAnswers, defaultModeSetting, loadSubjectAnswers, saveSubjectAnswers } from "@/lib/settings";
import { subjectQuestionKey } from "@/lib/subject-validation";
import type { Question, SubjectDetailResponse, SubjectListResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { type Mode, QuestionCard } from "./QuestionCard";
import { Ring } from "./Ring";
import { Segmented } from "./Segmented";
import { ErrorState, Skeleton } from "./StatusViews";

// Study by subject, from the subject files uploaded in the admin panel (/api/subjects).
// One page with three levels, chosen by the query string so the browser's back button walks them:
//   /study                         subjects
//   /study?subject=slug            topics in the subject
//   /study?subject=slug&topic=Y    questions in topic Y (an empty topic: every question in the subject)

const MODES = ["practice", "study"] as const;

const studyHref = (subject?: string, topic?: string) => {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (topic !== undefined) params.set("topic", topic);
  const query = params.toString();
  return query ? `/study?${query}` : "/study";
};

export function StudyView() {
  const params = useSearchParams();
  const subject = params.get("subject");
  if (!subject) return <SubjectList />;
  // Keyed so answers loaded for one subject are never carried into another.
  return <SubjectDetail key={subject} slug={subject} topic={params.get("topic")} />;
}

// ---- Shared pieces

const LIST_CLASS = "overflow-hidden rounded-2xl bg-surface/60 ring-[0.5px] ring-black/5 dark:ring-white/10";
const MAIN_CLASS = "px-safe mx-auto w-full max-w-2xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]";
const ERROR_MAIN_CLASS = "px-safe flex-1 pt-[max(1.25rem,env(safe-area-inset-top))]";

function Header({ backHref, backLabel, title, subtitle }: { backHref: string; backLabel: string; title: string; subtitle?: string }) {
  return (
    // A round back button beside the large title, like the Progress page.
    <header className="flex items-center gap-3">
      <AppLink href={backHref} aria-label={backLabel} className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-tint">
        <ChevronLeftIcon className="size-6 stroke-[2.5]" />
      </AppLink>
      <div className="min-w-0">
        {subtitle && <p className="truncate text-[13px] font-semibold text-secondary">{subtitle}</p>}
        <h1 className="line-clamp-2 text-[28px] leading-tight font-bold tracking-tight sm:text-[34px]">{title}</h1>
      </div>
    </header>
  );
}

// A row in the subject or topic list: tinted initial, name, counts and an answered ring.
function GroupRow({ href, name, detail, answered, total, last }: { href: string; name: string; detail: string; answered: number; total: number; last: boolean }) {
  const tone = softToneFor(name);
  return (
    <AppLink href={href} className="flex items-center gap-3 pl-4 transition-colors active:bg-fill-strong">
      <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl text-[17px] font-bold ${tone.wash} ${tone.accent}`}>
        {firstLetter(name)}
      </span>
      <div className={`flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 ${last ? "" : "hairline-b"}`}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{name}</p>
          <p className="mt-0.5 truncate text-[13px] text-secondary">
            {detail}
            {answered > 0 && ` · ${formatNumber(answered)} answered`}
          </p>
        </div>
        {answered > 0 && (
          <Ring value={answered} total={total} size={28} stroke={3.5}>
            <span className="sr-only">
              {formatNumber(answered)}/{formatNumber(total)} answered
            </span>
          </Ring>
        )}
        <ChevronRightIcon className="size-4.5 shrink-0 stroke-[2.5] text-tertiary" />
      </div>
    </AppLink>
  );
}

// ---- Level 1: subjects

function SubjectList() {
  const { state, retry } = useApi<SubjectListResponse>("/api/subjects");

  // Subjects only arrive from a client-side fetch, so localStorage is available whenever this has entries.
  const answered = useMemo(() => {
    const map = new Map<string, number>();
    if (state.status === "success") {
      for (const s of state.data.subjects) map.set(s.slug, Math.min(Object.keys(loadSubjectAnswers(s.slug)).length, s.total_questions));
    }
    return map;
  }, [state]);

  if (state.status === "loading") return <StudySkeleton />;
  if (state.status === "error") {
    return (
      <main className={ERROR_MAIN_CLASS}>
        {state.code === 0 ? (
          <ErrorState offline title="No internet connection" message="The subject list isn't saved on this device yet. Connect to the internet and try again." onRetry={retry} showHomeLink homeLabel="Home" />
        ) : (
          <ErrorState title="Couldn't load subjects" message="Something went wrong on the server. Try again in a moment." onRetry={retry} showHomeLink homeLabel="Home" />
        )}
      </main>
    );
  }

  const subjects = state.data.subjects;
  return (
    <main className={MAIN_CLASS}>
      <title>Study by subject | Govt Job Prep</title>
      <Header backHref="/" backLabel="Back to Home" title="Study by subject" />

      {subjects.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-surface/60 px-6 py-12 text-center ring-[0.5px] ring-black/5 dark:ring-white/10">
          <p className="text-[17px] font-semibold">No subjects yet</p>
          <p className="mt-1 text-[15px] text-secondary">Subjects appear here once they are added.</p>
        </div>
      ) : (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-secondary">{pluralize(subjects.length, "subject")}</h2>
          <ul className={LIST_CLASS}>
            {subjects.map((s, i) => (
              <li key={s.slug}>
                <GroupRow
                  href={studyHref(s.slug)}
                  name={s.subject_info.name}
                  detail={`${pluralize(s.total_questions, "question")} · ${pluralize(s.topics.length, "topic")}`}
                  answered={answered.get(s.slug) ?? 0}
                  total={s.total_questions}
                  last={i === subjects.length - 1}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

// ---- Levels 2 and 3: one subject

function SubjectDetail({ slug, topic }: { slug: string; topic: string | null }) {
  const { state, retry } = useApi<SubjectDetailResponse>(`/api/subjects/${encodeURIComponent(slug)}`);

  // Rendered only on the client after the fetch resolves, so reading localStorage here is safe.
  const [answers, setAnswers] = useState<SubjectAnswers | null>(null);
  if (state.status === "success" && answers === null) setAnswers(loadSubjectAnswers(slug));
  useEffect(() => {
    if (answers) saveSubjectAnswers(slug, answers);
  }, [slug, answers]);

  if (state.status === "loading") return <StudySkeleton />;
  if (state.status === "error") {
    return (
      <main className={ERROR_MAIN_CLASS}>
        {state.code === 404 ? (
          <ErrorState title="Subject not found" message="Check that the link is correct, or choose a subject from the list." showHomeLink homeHref="/study" homeLabel="All subjects" />
        ) : state.code === 0 ? (
          <ErrorState offline title="No internet connection" message="This subject hasn't been opened before, so it isn't available offline." onRetry={retry} showHomeLink homeHref="/study" homeLabel="All subjects" />
        ) : (
          <ErrorState title="Couldn't load questions" message="Something went wrong on the server. Try again in a moment." onRetry={retry} showHomeLink homeHref="/study" homeLabel="All subjects" />
        )}
      </main>
    );
  }

  const { subject_info: info, topics } = state.data;
  // QuestionCard shows the subject beside each question; subject files keep it once, in subject_info.
  const questions: Question[] = state.data.questions.map((q) => ({ ...q, subject: info.name }));
  const given = answers ?? {};
  const answeredIn = (qs: Question[]) => qs.filter((q) => given[subjectQuestionKey(q)] !== undefined).length;
  const select = (q: Question, option: string) => setAnswers((prev) => ({ ...prev, [subjectQuestionKey(q)]: option }));

  if (topic === null) {
    return (
      <main className={MAIN_CLASS}>
        <title>{`${info.name} | Govt Job Prep`}</title>
        <Header backHref="/study" backLabel="Back to all subjects" title={info.name} subtitle="Study by subject" />
        {info.description && <p className="mt-3 px-1 text-[14px] text-secondary">{info.description}</p>}

        <ul className={`mt-6 ${LIST_CLASS}`}>
          <li>
            <GroupRow
              href={studyHref(slug, "")}
              name="All topics"
              detail={pluralize(questions.length, "question")}
              answered={answeredIn(questions)}
              total={questions.length}
              last
            />
          </li>
        </ul>

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-secondary">{pluralize(topics.length, "topic")}</h2>
          <ul className={LIST_CLASS}>
            {topics.map((t, i) => (
              <li key={t.name}>
                <GroupRow
                  href={studyHref(slug, t.name)}
                  name={t.name}
                  detail={pluralize(t.total_questions, "question")}
                  answered={answeredIn(questions.filter((q) => q.topic === t.name))}
                  total={t.total_questions}
                  last={i === topics.length - 1}
                />
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  const visible = topic === "" ? questions : questions.filter((q) => q.topic === topic);
  if (visible.length === 0) {
    return (
      <main className={ERROR_MAIN_CLASS}>
        <ErrorState title="Topic not found" message="Check that the link is correct, or choose a topic from the list." showHomeLink homeHref={studyHref(slug)} homeLabel={info.name} />
      </main>
    );
  }

  return <QuestionList title={topic || "All topics"} subject={info.name} backHref={studyHref(slug)} questions={visible} answers={given} onSelect={select} />;
}

function QuestionList({
  title,
  subject,
  backHref,
  questions,
  answers,
  onSelect,
}: {
  title: string;
  subject: string;
  backHref: string;
  questions: Question[];
  answers: SubjectAnswers;
  onSelect: (q: Question, option: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(defaultModeSetting.get);
  const answered = questions.filter((q) => answers[subjectQuestionKey(q)] !== undefined).length;
  const correct = questions.filter((q) => answers[subjectQuestionKey(q)] === q.correct_answer).length;

  return (
    <main className={MAIN_CLASS}>
      <title>{`${title} · ${subject} | Govt Job Prep`}</title>
      <Header backHref={backHref} backLabel={`Back to ${subject}`} title={title} subtitle={subject} />

      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-surface/60 p-4 ring-[0.5px] ring-black/5 dark:ring-white/10">
        <Ring value={answered} total={questions.length} size={44} stroke={5} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tabular-nums">
            {formatNumber(answered)}/{formatNumber(questions.length)} answered
          </p>
          <p className="mt-0.5 text-[13px] tabular-nums">
            <span className="text-ios-green">{formatNumber(correct)} correct</span>
            <span className="text-tertiary"> · </span>
            <span className="text-ios-red">{formatNumber(answered - correct)} wrong</span>
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Segmented label="Mode" options={MODES} value={mode} onChange={setMode} format={(m) => (m === "practice" ? "Practice" : "Study")} />
        <p className="mt-2 px-1 text-[13px] text-secondary">
          {mode === "practice" ? "Choose an option to check your answer." : "All answers and explanations are shown."}
        </p>
      </div>

      <div className="mt-2 divide-y divide-separator">
        {questions.map((q) => (
          <QuestionCard key={subjectQuestionKey(q)} question={q} mode={mode} selected={answers[subjectQuestionKey(q)]} onSelect={(option) => onSelect(q, option)} />
        ))}
      </div>
    </main>
  );
}

// ---- Loading

export function StudySkeleton() {
  return (
    <main className={MAIN_CLASS} aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className={`mt-6 ${LIST_CLASS}`}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 pl-4">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className={`flex-1 py-3.5 pr-4 ${i < 5 ? "hairline-b" : ""}`}>
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
