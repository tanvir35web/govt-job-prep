import type { Metadata } from "next";
import { Suspense } from "react";
import { StudySkeleton, StudyView } from "@/components/study/StudyView";

export const metadata: Metadata = { title: "Study" };

// The Study tab: subjects, and one subject's topics (?subject=slug). Questions open on /study/topic.
// StudyView reads the query string, so it sits in a Suspense boundary for prerendering.
export default function StudyPage() {
  return (
    <Suspense fallback={<StudySkeleton />}>
      <StudyView />
    </Suspense>
  );
}
