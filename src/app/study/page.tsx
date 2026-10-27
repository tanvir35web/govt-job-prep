import type { Metadata } from "next";
import { Suspense } from "react";
import { StudySkeleton, StudyView } from "@/components/StudyView";

export const metadata: Metadata = { title: "Study by subject" };

// Outside the (tabs) group: a detail page reached from the "Study by subject" card on Home, with its own back link.
// StudyView reads the query string, so it sits in a Suspense boundary for prerendering.
export default function StudyPage() {
  return (
    <Suspense fallback={<StudySkeleton />}>
      <StudyView />
    </Suspense>
  );
}
