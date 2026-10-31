"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { type SoftTone, softToneFor } from "@/lib/covers";
import { firstLetter, formatNumber, pluralize } from "@/lib/format";
import { loadSubjectAnswers } from "@/lib/settings";
import { subjectQuestionKey } from "@/lib/subject-validation";
import type { SubjectDetailResponse, SubjectListResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "../AppLink";
import { SearchField } from "../ExamList";
import { BookOpenIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlayIcon, SearchIcon } from "../icons";
import { OfflineBadge } from "../OfflineBadge";
import { PageTitle } from "../PageTitle";
import { Ring } from "../Ring";
import { ErrorState, Skeleton } from "../StatusViews";
import { answeredByTopic, studyHref, topicHref } from "./links";
import { ReelsLink } from "./StudyReels";

// The Study tab, from the subject files uploaded in the admin panel (/api/subjects). Two plain lists,
// chosen by the query string so the browser's back button walks them:
//   /study               subjects
//   /study?subject=slug  the subject: an overview, what to study next, and its topics
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
  return (
    <>
      <div hidden={Boolean(subject)} className={subject ? "hidden" : "contents"}>
        <SubjectList active={!subject} />
      </div>
      {subject && <SubjectDetail key={subject} slug={subject} />}
    </>
  );
}

const MAIN_CLASS = "px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4";
const LIST_CLASS = "overflow-hidden rounded-2xl bg-surface/60 ring-[0.5px] ring-black/5 dark:ring-white/10";

// A row in the subject or topic list: tinted marker, name, one line of detail, and a ring (or a tick) once started.
function Row({
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
  tone: SoftTone;
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
      <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl text-[16px] font-bold ${tone.wash} ${tone.accent}`}>
        {marker}
      </span>
      <div className={`flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 ${last ? "" : "hairline-b"}`}>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[16px] leading-snug font-semibold">{name}</p>
          <p className="mt-0.5 truncate text-[13px] text-secondary">
            {detail}
            {answered > 0 && !done && ` · ${formatNumber(answered)} answered`}
          </p>
        </div>
        {done ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ios-green text-white dark:text-black">
            <CheckIcon className="size-4 stroke-3" />
            <span className="sr-only">Completed</span>
          </span>
        ) : answered > 0 ? (
          <Ring value={answered} total={total} size={28} stroke={3.5}>
            <span className="sr-only">
              {formatNumber(answered)}/{formatNumber(total)} answered
            </span>
          </Ring>
        ) : (
          <ChevronRightIcon className="size-4.5 shrink-0 stroke-[2.5] text-tertiary" />
        )}
      </div>
    </AppLink>
  );
}

function EmptyCard({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <div className={`mt-6 px-6 py-12 text-center ${LIST_CLASS}`}>
      {icon}
      <p className="mt-3 text-[17px] font-semibold">{title}</p>
      <p className="mt-1 text-[15px] text-secondary">{message}</p>
    </div>
  );
}

// ---- Subjects

function SubjectList({ active = true }: { active?: boolean }) {
  const { state, retry } = useApi<SubjectListResponse>("/api/subjects");
  const [query, setQuery] = useState("");
  const subjects = useMemo(() => (state.status === "success" ? state.data.subjects : []), [state]);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (active) {
      setRev((r) => r + 1);
    }
  }, [active]);

  // Subjects only arrive from a client-side fetch, so localStorage is available whenever this has entries.
  const answered = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subjects) {
      const counts = answeredByTopic(loadSubjectAnswers(s.slug));
      map.set(s.slug, s.topics.reduce((n, t) => n + Math.min(counts.get(t.name) ?? 0, t.total_questions), 0));
    }
    return map;
  }, [subjects, rev]);

  // A subject matches by its name or by any of its topics.
  const q = query.trim().toLowerCase();
  const visible = q ? subjects.filter((s) => [s.subject_info.name, ...s.topics.map((t) => t.name)].some((n) => n.toLowerCase().includes(q))) : subjects;

  return (
    <main className={MAIN_CLASS}>
      {active && <title>Study | Govt Job Prep</title>}
      <PageTitle title="Study" trailing={<OfflineBadge />} />
      <SearchField value={query} onChange={setQuery} placeholder="Search subjects or topics" />

      {state.status === "loading" && <ListSkeleton rows={4} />}

      {state.status === "error" &&
        (state.code === 0 ? (
          <ErrorState offline title="No internet connection" message="The subject list isn't saved on this device yet. Connect to the internet and try again." onRetry={retry} />
        ) : (
          <ErrorState title="Couldn't load subjects" message="Something went wrong on the server. Try again in a moment." onRetry={retry} />
        ))}

      {state.status === "success" &&
        (subjects.length === 0 ? (
          <EmptyCard icon={<BookOpenIcon className="mx-auto size-8 text-tertiary" />} title="No subjects yet" message="Subjects appear here once they are added." />
        ) : visible.length === 0 ? (
          <EmptyCard icon={<SearchIcon className="mx-auto size-8 text-tertiary" />} title="Nothing found" message="Try a different search." />
        ) : (
          <section className="mt-6">
            <h2 className="mb-2 px-1 text-[13px] font-semibold text-secondary">{pluralize(visible.length, "subject")}</h2>
            <ul className={LIST_CLASS}>
              {visible.map((s, i) => (
                <li key={s.slug}>
                  <Row
                    href={studyHref(s.slug)}
                    tone={softToneFor(s.subject_info.name)}
                    marker={firstLetter(s.subject_info.name)}
                    name={s.subject_info.name}
                    detail={`${pluralize(s.topics.length, "topic")} · ${pluralize(s.total_questions, "question")}`}
                    answered={answered.get(s.slug) ?? 0}
                    total={s.total_questions}
                    last={i === visible.length - 1}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </main>
  );
}

// ---- One subject: an overview, what to study next, and its topics

type TopicStat = { name: string; total: number; answered: number; correct: number };

function SubjectDetail({ slug }: { slug: string }) {
  const { state, retry } = useApi<SubjectDetailResponse>(`/api/subjects/${encodeURIComponent(slug)}`);
  // Rendered only on the client (StudyView reads the query string), so reading localStorage here is safe.
  const [answers] = useState(() => loadSubjectAnswers(slug));

  if (state.status === "loading") return <SubjectSkeleton />;
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

  const { subject_info: info, topics, questions } = state.data;
  const tone = softToneFor(info.name);

  // One pass over the questions: answered and correct per topic, in the topic order the API gives.
  const byName = new Map<string, TopicStat>(topics.map((t) => [t.name, { name: t.name, total: t.total_questions, answered: 0, correct: 0 }]));
  for (const q of questions) {
    const given = answers[subjectQuestionKey(q)];
    const stat = byName.get(q.topic);
    if (given === undefined || !stat) continue;
    stat.answered++;
    if (given === q.correct_answer) stat.correct++;
  }
  const stats = [...byName.values()];
  const answered = stats.reduce((n, t) => n + t.answered, 0);
  const correct = stats.reduce((n, t) => n + t.correct, 0);
  const isDone = (t: TopicStat) => t.total > 0 && t.answered >= t.total;
  const completed = stats.filter(isDone).length;

  // Pick up where the learner left off: a topic in progress, else the first one not started.
  const next = stats.find((t) => t.answered > 0 && !isDone(t)) ?? stats.find((t) => t.answered === 0 && t.total > 0);

  return (
    <main className={MAIN_CLASS}>
      <title>{`${info.name} | Govt Job Prep`}</title>
      <header className="flex items-center justify-between gap-3 pb-3">
        <AppLink href="/study" aria-label="Back to all subjects" className="pressable -ml-1 flex h-10 items-center gap-0.5 pr-2 text-[17px] text-tint">
          <ChevronLeftIcon className="size-6 stroke-[2.5]" />
          Study
        </AppLink>
        <div className="flex items-center gap-2">
          <OfflineBadge className="shrink-0" />
          {questions.length > 0 && <ReelsLink slug={slug} topic="" />}
        </div>
      </header>

      <section aria-label="Overview" className={`animate-fade-in rounded-[20px] p-5 ${CARD_RING} ${tone.card}`}>
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className={`text-[12px] font-semibold ${tone.accent}`}>
              {pluralize(topics.length, "topic")} · {pluralize(questions.length, "question")}
            </p>
            <h1 className="mt-1 line-clamp-3 text-[26px] leading-tight font-bold tracking-tight sm:text-[32px]">{info.name}</h1>
            {info.description && <p className="mt-2 line-clamp-3 text-[14px] leading-snug text-secondary">{info.description}</p>}
          </div>
          <Ring value={answered} total={questions.length} size={76} stroke={7} className={tone.accent}>
            <span className="flex flex-col items-center leading-none">
              <span className="text-[18px] font-bold tabular-nums">{formatNumber(percent(answered, questions.length))}%</span>
              <span className="mt-0.5 text-[10px] text-secondary">answered</span>
            </span>
          </Ring>
        </div>

        <dl className="mt-5 grid grid-cols-3 border-t border-separator pt-4 text-center">
          <Stat label="Answered" value={`${formatNumber(answered)}/${formatNumber(questions.length)}`} />
          <Stat label="Topics done" value={`${formatNumber(completed)}/${formatNumber(topics.length)}`} />
          <Stat label="Accuracy" value={answered ? `${formatNumber(percent(correct, answered))}%` : "—"} />
        </dl>
      </section>

      {next ? (
        <ActionCard
          href={topicHref(slug, next.name)}
          tone={tone}
          label={next.answered > 0 ? "Continue" : answered > 0 ? "Next topic" : "Start with"}
          title={next.name}
          value={next.answered}
          total={next.total}
        />
      ) : (
        questions.length > 0 && (
          <ActionCard href={topicHref(slug, "")} tone={tone} label="All topics done" title="Review all questions" value={answered} total={questions.length} />
        )
      )}

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-semibold text-secondary">Topics</h2>
          <AppLink href={topicHref(slug, "")} className="pressable text-[13px] font-semibold text-tint">
            Practise all {formatNumber(questions.length)}
          </AppLink>
        </div>
        <ol className={LIST_CLASS}>
          {stats.map((t, i) => (
            <li key={t.name}>
              <TopicRow href={topicHref(slug, t.name)} tone={tone} number={i + 1} topic={t} done={isDone(t)} last={i === stats.length - 1} />
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

const CARD_RING = "ring-[0.5px] ring-black/5 dark:ring-white/10";

const percent = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[12px] text-secondary">{label}</dt>
      <dd className="text-[18px] leading-tight font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ProgressLine({ value, total, tone, className = "" }: { value: number; total: number; tone: SoftTone; className?: string }) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className={`h-1 overflow-hidden rounded-full ${tone.track} ${className}`}>
      <div className={`h-full rounded-full ${tone.solid}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// The one thing to do next: a topic to continue or start, or a review once every topic is done.
function ActionCard({ href, tone, label, title, value, total }: { href: string; tone: SoftTone; label: string; title: string; value: number; total: number }) {
  return (
    <AppLink href={href} className={`mt-3 flex items-center gap-3.5 rounded-[20px] bg-surface/60 p-4 transition-transform active:scale-[0.98] ${CARD_RING}`}>
      <div className="min-w-0 flex-1">
        <p className={`text-[12px] font-semibold ${tone.accent}`}>{label}</p>
        <p className="mt-0.5 truncate text-[16px] font-semibold">{title}</p>
        <div className="mt-2 flex items-center gap-2">
          <ProgressLine value={value} total={total} tone={tone} className="flex-1" />
          <span className="shrink-0 text-[12px] text-secondary tabular-nums">
            {formatNumber(value)}/{formatNumber(total)}
          </span>
        </div>
      </div>
      <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full text-white dark:text-black ${tone.solid}`}>
        <PlayIcon className="ml-0.5 size-4 fill-current stroke-none" />
      </span>
    </AppLink>
  );
}

// A topic: its number (a tick once every question is answered), name, and a progress bar with the count once started.
function TopicRow({ href, tone, number, topic, done, last }: { href: string; tone: SoftTone; number: number; topic: TopicStat; done: boolean; last: boolean }) {
  return (
    <AppLink href={href} className="flex items-center gap-3 pl-4 transition-colors active:bg-fill-strong">
      <span
        aria-hidden="true"
        className={`grid size-9 shrink-0 place-items-center rounded-full text-[14px] font-bold tabular-nums ${done ? "bg-ios-green text-white dark:text-black" : `${tone.wash} ${tone.accent}`}`}
      >
        {done ? <CheckIcon className="size-4 stroke-3" /> : formatNumber(number)}
      </span>
      <div className={`flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 ${last ? "" : "hairline-b"}`}>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[16px] leading-snug font-semibold">{topic.name}</p>
          {topic.answered > 0 ? (
            <div className="mt-1.5 flex items-center gap-2">
              <ProgressLine value={topic.answered} total={topic.total} tone={tone} className="max-w-40 flex-1" />
              <span className="shrink-0 text-[12px] text-secondary tabular-nums">
                {done ? `${formatNumber(percent(topic.correct, topic.answered))}% correct` : `${formatNumber(topic.answered)}/${formatNumber(topic.total)}`}
              </span>
            </div>
          ) : (
            <p className="mt-0.5 text-[13px] text-secondary">{pluralize(topic.total, "question")}</p>
          )}
          {done && <span className="sr-only">Completed</span>}
        </div>
        <ChevronRightIcon className="size-4.5 shrink-0 stroke-[2.5] text-tertiary" />
      </div>
    </AppLink>
  );
}

// ---- Loading

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="mt-6 animate-fade-in">
      <Skeleton className="mb-2 ml-1 h-3.5 w-20" />
      <div className={LIST_CLASS}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 pl-4">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className={`flex-1 py-3.5 pr-4 ${i < rows - 1 ? "hairline-b" : ""}`}>
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectSkeleton() {
  return (
    <main className={MAIN_CLASS} aria-busy="true" aria-label="Loading">
      <div className="flex h-10 items-center">
        <Skeleton className="h-5 w-16" />
      </div>
      <div className={`mt-3 rounded-[20px] p-5 ${CARD_RING}`}>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2.5 h-7 w-3/5" />
            <Skeleton className="mt-3 h-3.5 w-4/5" />
          </div>
          <Skeleton className="size-19 shrink-0 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-7px),#000_calc(100%-7px))]" />
        </div>
        <Skeleton className="mt-5 h-10 w-full" />
      </div>
      <Skeleton className="mt-3 h-21 w-full rounded-[20px]" />
      <ListSkeleton rows={5} />
    </main>
  );
}

export function StudySkeleton() {
  return (
    <main className={MAIN_CLASS} aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3 pb-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <Skeleton className="h-8 w-40" />
      </div>
      <ListSkeleton rows={5} />
    </main>
  );
}
