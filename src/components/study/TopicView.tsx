"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatNumber, pluralize } from "@/lib/format";
import { type SubjectAnswers, defaultModeSetting, loadSubjectAnswers, saveLastStudy, saveSubjectAnswers } from "@/lib/settings";
import { subjectQuestionKey } from "@/lib/subject-validation";
import type { Question, SubjectDetailResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "../AppLink";
import { BottomBar, CompletionCard, ExamSkeleton, ModeSwitch, ModeTabs, type NavItem, type Progress, ProgressCard, QuestionNavigator } from "../ExamView";
import { ArrowLeftIcon, ArrowRightIcon, ChevronLeftIcon } from "../icons";
import { OfflineBadge } from "../OfflineBadge";
import { type Mode, QuestionCard } from "../QuestionCard";
import { Sheet } from "../Sheet";
import { ErrorState } from "../StatusViews";
import { studyHref, topicHref } from "./links";
import { ReelsLink } from "./StudyReels";

// The questions of one topic (/study/topic?subject=slug&topic=Name), or of the whole subject when the topic
// is empty. Laid out like an exam page: questions in a list, a progress sidebar on wide screens, and on
// phones a bottom bar with the back button and a sheet for mode, progress and the question grid.
// Answers are saved per subject, so they show up on the Study tab and in every view of the subject.

const WIDTH = "max-w-3xl lg:max-w-6xl";

export function TopicView() {
  const params = useSearchParams();
  const slug = params.get("subject") ?? "";
  const topic = params.get("topic") ?? "";
  // Keyed so answers loaded for one subject are never carried into another.
  return <TopicLoader key={slug} slug={slug} topic={topic} />;
}

function TopicLoader({ slug, topic }: { slug: string; topic: string }) {
  const { state, retry } = useApi<SubjectDetailResponse>(`/api/subjects/${encodeURIComponent(slug)}`);

  if (state.status === "loading") return <ExamSkeleton />;

  const back = { homeHref: slug ? studyHref(slug) : "/study", homeLabel: "Back to topics" };
  if (state.status === "error") {
    return (
      <main className="px-safe flex-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {state.code === 404 ? (
          <ErrorState title="Subject not found" message="Check that the link is correct, or choose a subject on the Study tab." showHomeLink homeHref="/study" homeLabel="All subjects" />
        ) : state.code === 0 ? (
          <ErrorState offline title="No internet connection" message="This subject hasn't been opened before, so it isn't available offline." onRetry={retry} showHomeLink {...back} />
        ) : (
          <ErrorState title="Couldn't load questions" message="Something went wrong on the server. Try again in a moment." onRetry={retry} showHomeLink {...back} />
        )}
      </main>
    );
  }

  const { topics } = state.data;
  if (topic !== "" && !topics.some((t) => t.name === topic)) {
    return (
      <main className="px-safe flex-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <ErrorState title="Topic not found" message="It may have been renamed or removed. Choose a topic from the list." showHomeLink {...back} />
      </main>
    );
  }

  // Keyed so the mode and scroll start fresh when moving to the next topic.
  return <TopicContent key={topic} slug={slug} topic={topic} data={state.data} />;
}

function TopicContent({ slug, topic, data }: { slug: string; topic: string; data: SubjectDetailResponse }) {
  const { subject_info: info, topics } = data;
  const allTopics = topic === "";
  const [mode, setMode] = useState<Mode>(defaultModeSetting.get);
  // Only rendered on the client after the fetch resolves, so reading localStorage here is safe.
  const [answers, setAnswers] = useState<SubjectAnswers>(() => loadSubjectAnswers(slug));
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => saveSubjectAnswers(slug, answers), [slug, answers]);
  useEffect(() => saveLastStudy({ subject: slug, topic }), [slug, topic]);

  // QuestionCard shows the subject and topic above each question; within one topic the topic is the page title.
  const source = data.questions.filter((q) => allTopics || q.topic === topic);
  const questions: Question[] = source.map((q) => ({ ...q, subject: info.name, topic: allTopics ? q.topic : "" }));
  const keys = source.map(subjectQuestionKey);

  const answered = keys.filter((k) => answers[k] !== undefined).length;
  const correct = questions.filter((q, i) => answers[keys[i]] === q.correct_answer).length;
  const progress: Progress = { total: questions.length, answered, correct, wrong: answered - correct };

  // Numbers restart in every topic, so the anchors use the position in this list.
  const navItems: NavItem[] = questions.map((q, i) => ({ id: `q-${i}`, number: q.question_no, answer: answers[keys[i]], correct: q.correct_answer }));

  const index = topics.findIndex((t) => t.name === topic);
  const previous = index > 0 ? topics[index - 1] : undefined;
  const next = index >= 0 && index < topics.length - 1 ? topics[index + 1] : undefined;
  const title = allTopics ? "All topics" : topic;

  const reset = () => {
    if (answered > 0 && !window.confirm(`This will clear your answers ${allTopics ? "in every topic" : "in this topic"}. Continue?`)) return;
    setAnswers((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !keys.includes(k))));
    window.scrollTo({ top: 0 });
  };

  const jumpTo = (id: string) => {
    setDetailsOpen(false);
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  return (
    <>
      <title>{`${title} · ${info.name} | Govt Job Prep`}</title>
      <main className={`px-safe mx-auto w-full ${WIDTH} flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12`}>
        {/* Phones go back from the bottom toolbar; wider screens have no toolbar, so they get this link. */}
        <AppLink href={studyHref(slug)} className="pressable mb-4 hidden items-center text-[15px] text-tint lg:inline-flex">
          <ChevronLeftIcon className="-ml-1.5 size-5 stroke-[2.5]" /> {info.name}
        </AppLink>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-12">
          <div className="min-w-0">
            <header>
              <p className="flex items-center gap-2 text-[13px] font-medium text-tint">
                <span className="min-w-0 truncate">{info.name}</span>
                <OfflineBadge className="shrink-0" />
              </p>
              <h1 className="mt-1 text-[26px] leading-tight font-bold tracking-tight sm:text-[32px]">{title}</h1>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[14px] text-secondary">
                  {pluralize(questions.length, "question")}
                  {allTopics ? ` · ${pluralize(topics.length, "topic")}` : ` · Topic ${formatNumber(index + 1)} of ${formatNumber(topics.length)}`}
                </p>
                {questions.length > 0 && <ReelsLink slug={slug} topic={topic} />}
              </div>
            </header>

            {/* Desktop only; on phones the mode switch is in the details sheet. */}
            <div className="mt-6 hidden items-end justify-between gap-4 border-b border-separator lg:flex">
              <ModeTabs mode={mode} onChange={setMode} />
              <p className="pb-2.5 text-[13px] text-secondary">
                {mode === "practice" ? "Choose an option to check your answer" : "Showing all answers and explanations"}
              </p>
            </div>

            <div className="mt-2 divide-y divide-separator">
              {questions.map((q, i) => (
                <QuestionCard
                  key={keys[i]}
                  anchorId={`q-${i}`}
                  question={q}
                  mode={mode}
                  selected={answers[keys[i]]}
                  onSelect={(option) => setAnswers((prev) => ({ ...prev, [keys[i]]: option }))}
                />
              ))}
            </div>

            {mode === "practice" && progress.answered === progress.total && progress.total > 0 && (
              <CompletionCard progress={progress} onReset={reset}>
                {next && (
                  <AppLink href={topicHref(slug, next.name)} className="pressable mt-3 flex items-center justify-center gap-1.5 text-[15px] font-semibold text-tint">
                    Next topic: {next.name} <ArrowRightIcon className="size-4" />
                  </AppLink>
                )}
              </CompletionCard>
            )}

            {!allTopics && (previous || next) && (
              <nav aria-label="Topics" className="mt-4 grid grid-cols-2 gap-3 border-t border-separator pt-5">
                {previous ? <TopicStep href={topicHref(slug, previous.name)} direction="previous" name={previous.name} /> : <span />}
                {next && <TopicStep href={topicHref(slug, next.name)} direction="next" name={next.name} />}
              </nav>
            )}
          </div>

          <aside className="hidden lg:sticky lg:top-[max(1.25rem,env(safe-area-inset-top))] lg:block">
            <ProgressCard mode={mode} progress={progress} onReset={reset} />
            <div className="mt-8">
              <h2 className="text-[13px] font-semibold text-secondary">Go to question</h2>
              <QuestionNavigator items={navItems} mode={mode} onJump={jumpTo} className="mt-3 grid-cols-6" />
            </div>
          </aside>
        </div>
      </main>

      <BottomBar
        backHref={studyHref(slug)}
        backLabel={`Back to ${info.name}`}
        mode={mode}
        subjectLabel={title}
        progress={progress}
        onOpenDetails={() => setDetailsOpen(true)}
      />

      {detailsOpen && (
        <Sheet title="Details" onClose={() => setDetailsOpen(false)}>
          <div className="mb-6 border-b border-separator pb-5">
            <h2 className="text-[13px] font-semibold text-secondary">Mode</h2>
            <ModeSwitch mode={mode} onChange={setMode} className="mt-2 w-full" />
            <p className="mt-2 text-[13px] text-secondary">
              {mode === "practice" ? "Choose an option to check your answer." : "All answers and explanations are shown."}
            </p>
          </div>
          <ProgressCard
            mode={mode}
            progress={progress}
            onReset={() => {
              setDetailsOpen(false);
              reset();
            }}
          />
          <div className="mt-6 border-t border-separator pt-5">
            <h2 className="text-[13px] font-semibold text-secondary">Go to question</h2>
            <QuestionNavigator items={navItems} mode={mode} onJump={jumpTo} className="mt-3 grid-cols-7 sm:grid-cols-10" />
          </div>
        </Sheet>
      )}
    </>
  );
}

function TopicStep({ href, direction, name }: { href: string; direction: "previous" | "next"; name: string }) {
  const isNext = direction === "next";
  return (
    <AppLink
      href={href}
      className={`pressable flex min-w-0 flex-col rounded-2xl bg-surface/60 p-3.5 ring-[0.5px] ring-black/5 dark:ring-white/10 ${isNext ? "col-start-2 items-end text-right" : "items-start"}`}
    >
      <span className="flex items-center gap-1 text-[12px] font-semibold text-tint">
        {!isNext && <ArrowLeftIcon className="size-3.5" />}
        {isNext ? "Next topic" : "Previous topic"}
        {isNext && <ArrowRightIcon className="size-3.5" />}
      </span>
      <span className="mt-1 line-clamp-2 text-[15px] leading-snug font-semibold">{name}</span>
    </AppLink>
  );
}
