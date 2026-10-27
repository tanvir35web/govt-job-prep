import type { SubjectAnswers } from "@/lib/settings";

// Study URLs. The Study tab holds the subject list (/study) and one subject's topics (/study?subject=slug);
// questions open on their own page outside the tabs, like an exam: /study/topic?subject=slug&topic=Name.
// An empty topic there means every question in the subject.

export const studyHref = (subject?: string) => (subject ? `/study?subject=${encodeURIComponent(subject)}` : "/study");

export const topicHref = (subject: string, topic: string) => `/study/topic?${new URLSearchParams({ subject, topic })}`;

/** Answered questions per topic, counted from the saved answers' keys ("topic#number"; a topic may contain "#"). */
export function answeredByTopic(answers: SubjectAnswers): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of Object.keys(answers)) {
    const topic = key.slice(0, key.lastIndexOf("#"));
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return counts;
}
