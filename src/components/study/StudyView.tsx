"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { softToneFor } from "@/lib/covers";
import { firstLetter, formatNumber, pluralize } from "@/lib/format";
import { loadLastStudy, loadSubjectAnswers } from "@/lib/settings";
import { subjectQuestionKey } from "@/lib/subject-validation";
import type { SubjectDetailResponse, SubjectListItem, SubjectListResponse, SubjectQuestion } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "../AppLink";
import { SearchField } from "../ExamList";
import { BookOpenIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon, PlayIcon, SearchIcon } from "../icons";
import { OfflineBadge } from "../OfflineBadge";
import { PageTitle } from "../PageTitle";
import { Ring } from "../Ring";
import { ErrorState, Skeleton } from "../StatusViews";
import { answeredByTopic, studyHref, topicHref } from "./links";

// The Study tab, from the subject files uploaded in the admin panel (/api/subjects). Two levels, chosen by
// the query string so the browser's back button walks them:
//   /study               subjects: overall progress, continue where you left off, a tile per subject
//   /study?subject=slug  one subject: its progress and its topics (lecture sheets) in order
// Questions open on /study/topic (TopicView), outside the tabs.

export function StudyView() {
  const params = useSearchParams();
  const router = useRouter();
  const subject = params.get("subject");
  const topic = params.get("topic");

  // Links from before the topic page existed (/study?subject=slug&topic=Name) go straight to it.
  useEffect(() => {
    if (subject && topic !== null) router.replace(topicHref(subject, topic));
  }, [router, subject, topic]);

  if (subject && topic !== null) return <StudySkeleton />;
  if (!subject) return <StudyHome />;
  return <SubjectDetail key={subject} slug={subject} />;
}

const MAIN_CLASS = "px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4";
const CARD_CLASS = "rounded-2xl bg-surface/60 ring-[0.5px] ring-black/5 dark:ring-white/10";

type TopicProgress = { name: string; total: number; answered: number };

function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <h2 className="text-[20px] font-bold">{title}</h2>
      {detail && <span className="text-[13px] text-secondary">{detail}</span>}
    </div>
  );
}

function ProgressLine({ answered, total, track, solid }: { answered: number; total: number; track: string; solid: string }) {
  const pct = total ? Math.min(100, (answered / total) * 100) : 0;
  return (
    <div className={`h-1.5 overflow-hidden rounded-full ${track}`}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${solid}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const percent = (answered: number, total: number) => (total ? Math.round((answered / total) * 100) : 0);

// ---- Level 1: subjects

function StudyHome() {
  const { state, retry } = useApi<SubjectListResponse>("/api/subjects");
  const [query, setQuery] = useState("");
  const subjects = useMemo(() => (state.status === "success" ? state.data.subjects : []), [state]);

  // Subjects only arrive from a client-side fetch, so localStorage is available whenever this has entries.
  const progress = useMemo(() => {
    const map = new Map<string, TopicProgress[]>();
    for (const s of subjects) {
      const counts = answeredByTopic(loadSubjectAnswers(s.slug));
      map.set(
        s.slug,
        s.topics.map((t) => ({ name: t.name, total: t.total_questions, answered: Math.min(counts.get(t.name) ?? 0, t.total_questions) })),
      );
    }
    return map;
  }, [subjects]);
  const last = useMemo(() => (subjects.length > 0 ? loadLastStudy() : null), [subjects]);

  const q = query.trim().toLowerCase();
  const matchingSubjects = q ? subjects.filter((s) => s.subject_info.name.toLowerCase().includes(q)) : subjects;
  const matchingTopics = q
    ? subjects.flatMap((s) => (progress.get(s.slug) ?? []).filter((t) => t.name.toLowerCase().includes(q)).map((t) => ({ subject: s, topic: t })))
    : [];

  return (
    <main className={MAIN_CLASS}>
      <title>Study | Govt Job Prep</title>
      <PageTitle title="Study" subtitle="Subject by subject, topic by topic" trailing={<OfflineBadge />} />
      <SearchField value={query} onChange={setQuery} placeholder="Search subjects or topics" />

      {state.status === "loading" && <HomeSkeleton />}

      {state.status === "error" &&
        (state.code === 0 ? (
          <ErrorState offline title="No internet connection" message="The subject list isn't saved on this device yet. Connect to the internet and try again." onRetry={retry} />
        ) : (
          <ErrorState title="Couldn't load subjects" message="Something went wrong on the server. Try again in a moment." onRetry={retry} />
        ))}

      {state.status === "success" && subjects.length === 0 && (
        <div className={`mt-6 px-6 py-12 text-center ${CARD_CLASS}`}>
          <BookOpenIcon className="mx-auto size-8 text-tertiary" />
          <p className="mt-3 text-[17px] font-semibold">No subjects yet</p>
          <p className="mt-1 text-[15px] text-secondary">Subjects appear here once they are added.</p>
        </div>
      )}

      {state.status === "success" && subjects.length > 0 && q && (
        <SearchResults subjects={matchingSubjects} topics={matchingTopics} progress={progress} />
      )}

      {state.status === "success" && subjects.length > 0 && !q && (
        <>
          <OverviewCard subjects={subjects} progress={progress} />
          <ContinueCard subjects={subjects} progress={progress} last={last} />
          <section className="mt-7" aria-label="Subjects">
            <SectionHeader title="Subjects" detail={pluralize(subjects.length, "subject")} />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {subjects.map((s) => (
                <li key={s.slug}>
                  <SubjectTile subject={s} topics={progress.get(s.slug) ?? []} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function OverviewCard({ subjects, progress }: { subjects: SubjectListItem[]; progress: Map<string, TopicProgress[]> }) {
  let answered = 0;
  let total = 0;
  let topics = 0;
  let completed = 0;
  for (const list of progress.values()) {
    for (const t of list) {
      answered += t.answered;
      total += t.total;
      topics++;
      if (t.total > 0 && t.answered >= t.total) completed++;
    }
  }

  return (
    <div className={`mt-5 flex items-center gap-3.5 p-4 ${CARD_CLASS}`}>
      <Ring value={answered} total={total} size={56} stroke={6}>
        <span className="text-[14px] font-bold">{formatNumber(percent(answered, total))}%</span>
      </Ring>
      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] leading-tight font-semibold">Your study progress</h2>
        <p className="mt-0.5 truncate text-[14px] text-secondary">
          {answered > 0 ? `${formatNumber(answered)} of ${pluralize(total, "question")} answered` : `${pluralize(total, "question")} to practise`}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-tertiary tabular-nums">
          {pluralize(subjects.length, "subject")} · {pluralize(topics, "topic")} · {formatNumber(completed)} completed
        </p>
      </div>
    </div>
  );
}

// The topic last opened on this device, if it still exists and isn't finished.
function ContinueCard({ subjects, progress, last }: { subjects: SubjectListItem[]; progress: Map<string, TopicProgress[]>; last: ReturnType<typeof loadLastStudy> }) {
  if (!last) return null;
  const subject = subjects.find((s) => s.slug === last.subject);
  if (!subject) return null;
  const topics = progress.get(subject.slug) ?? [];
  const target =
    last.topic === ""
      ? { name: "All topics", total: topics.reduce((n, t) => n + t.total, 0), answered: topics.reduce((n, t) => n + t.answered, 0) }
      : topics.find((t) => t.name === last.topic);
  if (!target || target.answered >= target.total) return null;

  const tone = softToneFor(subject.subject_info.name);
  return (
    <section className="mt-7" aria-label="Continue">
      <SectionHeader title="Continue" />
      <AppLink
        href={topicHref(subject.slug, last.topic)}
        className={`flex items-center gap-3.5 rounded-[20px] p-4 ring-[0.5px] ring-black/5 transition-transform active:scale-[0.99] dark:ring-white/10 ${tone.wash}`}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[12px] font-semibold ${tone.accent}`}>{subject.subject_info.name}</p>
          <p className="mt-0.5 line-clamp-2 text-[17px] leading-snug font-semibold">{target.name}</p>
          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex-1">
              <ProgressLine answered={target.answered} total={target.total} track={tone.track} solid={tone.solid} />
            </div>
            <span className="text-[12px] text-secondary tabular-nums">
              {formatNumber(target.answered)}/{formatNumber(target.total)}
            </span>
          </div>
        </div>
        <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full bg-surface/80 ${tone.accent}`}>
          <PlayIcon className="size-5" />
        </span>
      </AppLink>
    </section>
  );
}

function SubjectTile({ subject, topics }: { subject: SubjectListItem; topics: TopicProgress[] }) {
  const name = subject.subject_info.name;
  const tone = softToneFor(name);
  const answered = topics.reduce((n, t) => n + t.answered, 0);
  const pct = percent(answered, subject.total_questions);

  return (
    <AppLink
      href={studyHref(subject.slug)}
      className={`flex h-full min-h-44 flex-col rounded-[20px] p-4 ring-[0.5px] ring-black/5 transition-transform active:scale-[0.98] dark:ring-white/10 ${tone.wash}`}
    >
      <span aria-hidden="true" className={`grid size-11 place-items-center rounded-2xl bg-surface/80 text-[20px] font-bold ${tone.accent}`}>
        {firstLetter(name)}
      </span>
      <p className="mt-3 line-clamp-2 text-[17px] leading-snug font-semibold">{name}</p>
      <p className="mt-0.5 truncate text-[13px] text-secondary">
        {pluralize(subject.topics.length, "topic")} · {pluralize(subject.total_questions, "question")}
      </p>
      <div className="mt-auto pt-3">
        <div className="mb-1.5 flex items-center justify-between text-[12px]">
          <span className="text-secondary tabular-nums">{answered > 0 ? `${formatNumber(answered)} answered` : "Not started"}</span>
          <span className={`font-semibold tabular-nums ${tone.accent}`}>{formatNumber(pct)}%</span>
        </div>
        <ProgressLine answered={answered} total={subject.total_questions} track={tone.track} solid={tone.solid} />
      </div>
    </AppLink>
  );
}

function SearchResults({
  subjects,
  topics,
  progress,
}: {
  subjects: SubjectListItem[];
  topics: { subject: SubjectListItem; topic: TopicProgress }[];
  progress: Map<string, TopicProgress[]>;
}) {
  if (subjects.length === 0 && topics.length === 0) {
    return (
      <div className={`mt-6 px-6 py-12 text-center ${CARD_CLASS}`}>
        <SearchIcon className="mx-auto size-8 text-tertiary" />
        <p className="mt-3 text-[17px] font-semibold">Nothing found</p>
        <p className="mt-1 text-[15px] text-secondary">Try a different search.</p>
      </div>
    );
  }

  return (
    <>
      {subjects.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="Subjects" detail={pluralize(subjects.length, "result")} />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {subjects.map((s) => (
              <li key={s.slug}>
                <SubjectTile subject={s} topics={progress.get(s.slug) ?? []} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {topics.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="Topics" detail={pluralize(topics.length, "result")} />
          <ul className={`overflow-hidden ${CARD_CLASS}`}>
            {topics.map(({ subject, topic }, i) => (
              <li key={`${subject.slug}#${topic.name}`}>
                <TopicRow
                  href={topicHref(subject.slug, topic.name)}
                  tone={softToneFor(subject.subject_info.name)}
                  marker={firstLetter(subject.subject_info.name)}
                  name={topic.name}
                  detail={subject.subject_info.name}
                  answered={topic.answered}
                  total={topic.total}
                  last={i === topics.length - 1}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ---- Level 2: one subject

function SubjectDetail({ slug }: { slug: string }) {
  const { state, retry } = useApi<SubjectDetailResponse>(`/api/subjects/${encodeURIComponent(slug)}`);

  if (state.status === "loading") return <StudySkeleton />;
  if (state.status === "error") {
    return (
      <main className={MAIN_CLASS}>
        {state.code === 404 ? (
          <ErrorState title="Subject not found" message="Check that the link is correct, or choose a subject from the list." showHomeLink homeHref="/study" homeLabel="All subjects" />
        ) : state.code === 0 ? (
          <ErrorState offline title="No internet connection" message="This subject hasn't been opened before, so it isn't available offline." onRetry={retry} showHomeLink homeHref="/study" homeLabel="All subjects" />
        ) : (
          <ErrorState title="Couldn't load topics" message="Something went wrong on the server. Try again in a moment." onRetry={retry} showHomeLink homeHref="/study" homeLabel="All subjects" />
        )}
      </main>
    );
  }

  return <SubjectContent slug={slug} data={state.data} />;
}

type TopicStats = TopicProgress & { correct: number };

function SubjectContent({ slug, data }: { slug: string; data: SubjectDetailResponse }) {
  const { subject_info: info, topics, questions } = data;
  // Rendered only on the client after the fetch resolves, so reading localStorage here is safe.
  const [answers] = useState(() => loadSubjectAnswers(slug));
  const tone = softToneFor(info.name);

  const stats = useMemo(() => {
    const byTopic = new Map<string, SubjectQuestion[]>();
    for (const q of questions) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q]);
    return topics.map((t): TopicStats => {
      const list = byTopic.get(t.name) ?? [];
      const given = list.filter((q) => answers[subjectQuestionKey(q)] !== undefined);
      return { name: t.name, total: list.length, answered: given.length, correct: given.filter((q) => answers[subjectQuestionKey(q)] === q.correct_answer).length };
    });
  }, [topics, questions, answers]);

  const total = questions.length;
  const answered = stats.reduce((n, t) => n + t.answered, 0);
  const correct = stats.reduce((n, t) => n + t.correct, 0);
  const completed = stats.filter((t) => t.total > 0 && t.answered >= t.total).length;
  // The next topic to work on: the first one started but not finished, else the first not started.
  const next = stats.find((t) => t.answered > 0 && t.answered < t.total) ?? stats.find((t) => t.answered < t.total);

  return (
    <main className={MAIN_CLASS}>
      <title>{`${info.name} | Govt Job Prep`}</title>

      <header className="flex items-center gap-3 pb-3">
        <AppLink href="/study" aria-label="Back to all subjects" className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-tint">
          <ChevronLeftIcon className="size-6 stroke-[2.5]" />
        </AppLink>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-secondary">Study</p>
          <h1 className="line-clamp-2 text-[28px] leading-tight font-bold tracking-tight sm:text-[34px]">{info.name}</h1>
        </div>
        <OfflineBadge className="shrink-0" />
      </header>
      {info.description && <p className="px-1 text-[15px] text-secondary">{info.description}</p>}

      <div className={`mt-4 rounded-[20px] p-4 ring-[0.5px] ring-black/5 dark:ring-white/10 ${tone.wash}`}>
        <div className="flex items-center gap-3.5">
          <Ring value={answered} total={total} size={60} stroke={6} className={tone.accent}>
            <span className="text-[15px] font-bold">{formatNumber(percent(answered, total))}%</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold tabular-nums">
              {formatNumber(answered)}/{formatNumber(total)} answered
            </p>
            <p className="mt-0.5 text-[13px] tabular-nums">
              <span className="text-ios-green">{formatNumber(correct)} correct</span>
              <span className="text-tertiary"> · </span>
              <span className="text-ios-red">{formatNumber(answered - correct)} wrong</span>
            </p>
            <p className="mt-0.5 text-[12px] text-secondary tabular-nums">
              {formatNumber(completed)} of {pluralize(stats.length, "topic")} completed
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          {next ? (
            <AppLink
              href={topicHref(slug, next.name)}
              className="pressable flex h-12 min-w-0 items-center justify-center gap-2 rounded-full bg-label px-4 text-[15px] font-semibold text-canvas"
            >
              <PlayIcon className="size-4.5 shrink-0" />
              <span className="truncate">
                {next.answered > 0 ? "Continue" : answered > 0 ? "Next" : "Start"}: {next.name}
              </span>
            </AppLink>
          ) : (
            <p className="flex h-12 items-center justify-center gap-2 rounded-full bg-surface/80 px-4 text-[15px] font-semibold text-ios-green">
              <CheckIcon className="size-4.5 stroke-[2.5]" /> All topics complete
            </p>
          )}
          <AppLink
            href={topicHref(slug, "")}
            aria-label={`All ${pluralize(total, "question")}`}
            className="pressable flex h-12 items-center justify-center gap-1.5 rounded-full bg-surface/80 px-4 text-[15px] font-semibold"
          >
            <ListIcon className="size-4.5" /> All
          </AppLink>
        </div>
      </div>

      <section className="mt-7" aria-label="Topics">
        <SectionHeader title="Topics" detail={pluralize(stats.length, "topic")} />
        <ul className={`overflow-hidden ${CARD_CLASS}`}>
          {stats.map((t, i) => (
            <li key={t.name}>
              <TopicRow
                href={topicHref(slug, t.name)}
                tone={tone}
                marker={String(i + 1).padStart(2, "0")}
                name={t.name}
                detail={pluralize(t.total, "question")}
                answered={t.answered}
                total={t.total}
                last={i === stats.length - 1}
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

// A topic in a list: numbered (or lettered) marker, name, a progress line, and a tick once finished.
function TopicRow({
  href,
  tone,
  marker,
  name,
  detail,
  answered,
  total,
  last,
}: {
  href: string;
  tone: ReturnType<typeof softToneFor>;
  marker: string;
  name: string;
  detail: string;
  answered: number;
  total: number;
  last: boolean;
}) {
  const done = total > 0 && answered >= total;
  return (
    <AppLink href={href} className="flex items-center gap-3 pl-4 transition-colors active:bg-fill-strong">
      <span
        aria-hidden="true"
        className={`grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-bold tabular-nums ${done ? "bg-ios-green text-white dark:text-black" : `${tone.wash} ${tone.accent}`}`}
      >
        {done ? <CheckIcon className="size-4.5 stroke-3" /> : marker}
      </span>
      <div className={`flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 ${last ? "" : "hairline-b"}`}>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[16px] leading-snug font-semibold">{name}</p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="truncate text-[13px] text-secondary">{detail}</span>
            {answered > 0 && (
              <>
                <div className="w-16 shrink-0 sm:w-24">
                  <ProgressLine answered={answered} total={total} track={tone.track} solid={done ? "bg-ios-green" : tone.solid} />
                </div>
                <span className="shrink-0 text-[12px] text-tertiary tabular-nums">
                  {formatNumber(answered)}/{formatNumber(total)}
                </span>
              </>
            )}
          </div>
        </div>
        <ChevronRightIcon className="size-4.5 shrink-0 stroke-[2.5] text-tertiary" />
        {done && <span className="sr-only">Completed</span>}
      </div>
    </AppLink>
  );
}

// ---- Loading

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-fade-in">
      <div className={`mt-5 flex items-center gap-3.5 p-4 ${CARD_CLASS}`}>
        <Skeleton className="size-14 shrink-0 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-6px),#000_calc(100%-6px))]" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-2 h-3.5 w-full max-w-56" />
          <Skeleton className="mt-1.5 h-3 w-2/3 max-w-44" />
        </div>
      </div>
      <Skeleton className="mt-7 mb-3 ml-1 h-5 w-24" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`flex min-h-44 flex-col p-4 ${CARD_CLASS} rounded-[20px]`}>
            <Skeleton className="size-11 rounded-2xl" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
            <Skeleton className="mt-auto h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudySkeleton() {
  return (
    <main className={MAIN_CLASS} aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3 pb-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="mt-2 h-7 w-48" />
        </div>
      </div>
      <Skeleton className="mt-4 h-40 rounded-[20px]" />
      <Skeleton className="mt-7 mb-3 ml-1 h-5 w-20" />
      <div className={`overflow-hidden ${CARD_CLASS}`}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 pl-4">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className={`flex-1 py-3.5 pr-4 ${i < 4 ? "hairline-b" : ""}`}>
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
