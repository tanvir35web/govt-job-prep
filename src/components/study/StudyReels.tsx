"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { type SubjectAnswers, loadSubjectAnswers, saveSubjectAnswers } from "@/lib/settings";
import { subjectQuestionKey } from "@/lib/subject-validation";
import type { Question, SubjectDetailResponse } from "@/lib/types";
import { enterFullscreenOnTouch } from "@/lib/fullscreen";
import { useApi } from "@/lib/use-api";
import { AppLink } from "../AppLink";
import { ReelsIcon } from "../icons";
import { ReelsFeed, ReelsSkeleton } from "../ReelsView";
import { ErrorState } from "../StatusViews";
import { studyHref, topicHref, topicReelsHref } from "./links";

/** A pill that opens the questions in Reels: one topic's, or the whole subject's when the topic is empty. */
export function ReelsLink({ slug, topic, className = "" }: { slug: string; topic: string; className?: string }) {
  return (
    <AppLink
      href={topicReelsHref(slug, topic)}
      onClick={enterFullscreenOnTouch}
      aria-label={topic === "" ? "Open every question in Reels" : "Open this topic in Reels"}
      className={`pressable inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-tint/12 px-3 text-[14px] font-semibold text-tint ${className}`}
    >
      <ReelsIcon className="size-4" />
      Reels
    </AppLink>
  );
}

// A topic's questions in the Reels feed (/study/reels?subject=slug&topic=Name), or the whole subject's when
// the topic is empty. Answers are the subject's saved answers, shared with the topic page.

export function StudyReels() {
  const params = useSearchParams();
  const slug = params.get("subject") ?? "";
  const topic = params.get("topic") ?? "";
  // Keyed so answers loaded for one subject are never carried into another.
  return <StudyReelsLoader key={`${slug}#${topic}`} slug={slug} topic={topic} />;
}

function StudyReelsLoader({ slug, topic }: { slug: string; topic: string }) {
  const { state, retry } = useApi<SubjectDetailResponse>(`/api/subjects/${encodeURIComponent(slug)}`);

  if (state.status === "loading") return <ReelsSkeleton />;

  const back = { showHomeLink: true, homeHref: slug ? studyHref(slug) : "/study", homeLabel: "Back to topics" };
  const fail = (body: React.ReactNode) => <main className="px-safe flex-1 pt-[max(0.75rem,env(safe-area-inset-top))]">{body}</main>;

  if (state.status === "error") {
    return fail(
      state.code === 404 ? (
        <ErrorState title="Subject not found" message="Check that the link is correct, or choose a subject on the Study tab." showHomeLink homeHref="/study" homeLabel="All subjects" />
      ) : state.code === 0 ? (
        <ErrorState offline title="No internet connection" message="This subject hasn't been opened before, so it isn't available offline." onRetry={retry} {...back} />
      ) : (
        <ErrorState title="Couldn't load questions" message="Something went wrong on the server. Try again in a moment." onRetry={retry} {...back} />
      ),
    );
  }

  if (topic !== "" && !state.data.topics.some((t) => t.name === topic)) {
    return fail(<ErrorState title="Topic not found" message="It may have been renamed or removed. Choose a topic from the list." {...back} />);
  }

  const source = state.data.questions.filter((q) => topic === "" || q.topic === topic);
  if (source.length === 0) return fail(<ErrorState title="No questions" message="No questions have been added here yet." {...back} />);

  return <StudyReelsFeed slug={slug} topic={topic} name={state.data.subject_info.name} source={source} />;
}

function StudyReelsFeed({ slug, topic, name, source }: { slug: string; topic: string; name: string; source: SubjectDetailResponse["questions"] }) {
  // Only rendered on the client after the fetch resolves, so reading localStorage here is safe.
  const [answers, setAnswers] = useState<SubjectAnswers>(() => loadSubjectAnswers(slug));
  useEffect(() => saveSubjectAnswers(slug, answers), [slug, answers]);

  // Every slide is in the subject's hue (the feed colours slides by their subject); the topic shows beside it.
  const questions: Question[] = source.map((q) => ({ ...q, subject: name }));
  const keys = source.map(subjectQuestionKey);
  const back = topic === "" ? studyHref(slug) : topicHref(slug, topic);

  return (
    <ReelsFeed
      title={topic === "" ? name : topic}
      context={name}
      questions={questions}
      selected={keys.map((k) => answers[k])}
      onSelect={(i, option) => setAnswers((prev) => ({ ...prev, [keys[i]]: option }))}
      onClear={() => setAnswers((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !keys.includes(k))))}
      positionKey={`study:${slug}#${topic}`}
      groupBy="topic"
      backHref={back}
      backLabel={topic === "" ? `Back to ${name}` : `Back to ${topic}`}
      exitLabel={topic === "" ? `Back to ${name}` : "Back to the topic"}
    />
  );
}
