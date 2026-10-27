import type { Metadata } from "next";
import { Suspense } from "react";
import { ExamSkeleton } from "@/components/ExamView";
import { TopicView } from "@/components/study/TopicView";

export const metadata: Metadata = { title: "Study" };

// Outside the (tabs) group: a topic's questions have their own bottom toolbar, like an exam.
// TopicView reads the query string, so it sits in a Suspense boundary for prerendering.
export default function TopicPage() {
  return (
    <Suspense fallback={<ExamSkeleton />}>
      <TopicView />
    </Suspense>
  );
}
