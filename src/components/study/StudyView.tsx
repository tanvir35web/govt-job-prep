"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { softToneFor } from "@/lib/covers";
import { firstLetter, formatNumber, pluralize } from "@/lib/format";
import { loadSubjectAnswers } from "@/lib/settings";
import { subjectQuestionKey } from "@/lib/subject-validation";
import type { SubjectDetailResponse, SubjectListResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "../AppLink";
import { SearchField } from "../ExamList";
import { BookOpenIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "../icons";
import { OfflineBadge } from "../OfflineBadge";
import { PageTitle } from "../PageTitle";
import { Ring } from "../Ring";
import { ErrorState, Skeleton } from "../StatusViews";
import { answeredByTopic, studyHref, topicHref } from "./links";

// The Study tab, from the subject files uploaded in the admin panel (/api/subjects). Two plain lists,
// chosen by the query string so the browser's back button walks them:
//   /study               subjects
//   /study?subject=slug  the subject's topics
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
  if (!subject) return <SubjectList />;
  return <SubjectDetail key={subject} slug={subject} />;
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

function SubjectList() {
  const { state, retry } = useApi<SubjectListResponse>("/api/subjects");
  const [query, setQuery] = useState("");
  const subjects = useMemo(() => (state.status === "success" ? state.data.subjects : []), [state]);

  // Subjects only arrive from a client-side fetch, so localStorage is available whenever this has entries.
  const answered = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subjects) {
      const counts = answeredByTopic(loadSubjectAnswers(s.slug));
      map.set(s.slug, s.topics.reduce((n, t) => n + Math.min(counts.get(t.name) ?? 0, t.total_questions), 0));
    }
    return map;
  }, [subjects]);

  // A subject matches by its name or by any of its topics.
  const q = query.trim().toLowerCase();
  const visible = q ? subjects.filter((s) => [s.subject_info.name, ...s.topics.map((t) => t.name)].some((n) => n.toLowerCase().includes(q))) : subjects;

  return (
    <main className={MAIN_CLASS}>
      <title>Study | Govt Job Prep</title>
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

// ---- One subject: its topics

function SubjectDetail({ slug }: { slug: string }) {
  const { state, retry } = useApi<SubjectDetailResponse>(`/api/subjects/${encodeURIComponent(slug)}`);
  // Rendered only on the client (StudyView reads the query string), so reading localStorage here is safe.
  const [answers] = useState(() => loadSubjectAnswers(slug));

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

  const { subject_info: info, topics, questions } = state.data;
  const tone = softToneFor(info.name);
  const answeredIn = (topic: string | null) =>
    questions.filter((q) => (topic === null || q.topic === topic) && answers[subjectQuestionKey(q)] !== undefined).length;

  return (
    <main className={MAIN_CLASS}>
      <title>{`${info.name} | Govt Job Prep`}</title>
      <header className="flex items-center gap-3 pb-3">
        <AppLink href="/study" aria-label="Back to all subjects" className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-tint">
          <ChevronLeftIcon className="size-6 stroke-[2.5]" />
        </AppLink>
        <h1 className="line-clamp-2 min-w-0 flex-1 text-[28px] leading-tight font-bold tracking-tight sm:text-[34px]">{info.name}</h1>
        <OfflineBadge className="shrink-0" />
      </header>

      <section className="mt-3">
        <h2 className="mb-2 px-1 text-[13px] font-semibold text-secondary">{pluralize(topics.length, "topic")}</h2>
        <ul className={LIST_CLASS}>
          {topics.map((t, i) => (
            <li key={t.name}>
              <Row
                href={topicHref(slug, t.name)}
                tone={tone}
                marker={formatNumber(i + 1)}
                name={t.name}
                detail={pluralize(t.total_questions, "question")}
                answered={answeredIn(t.name)}
                total={t.total_questions}
                last={i === topics.length - 1}
              />
            </li>
          ))}
        </ul>
      </section>

      <ul className={`mt-6 ${LIST_CLASS}`}>
        <li>
          <Row
            href={topicHref(slug, "")}
            tone={tone}
            marker={firstLetter(info.name)}
            name="All questions"
            detail={pluralize(questions.length, "question")}
            answered={answeredIn(null)}
            total={questions.length}
            last
          />
        </li>
      </ul>
    </main>
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
