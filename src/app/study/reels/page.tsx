import type { Metadata } from "next";
import { Suspense } from "react";
import { ReelsSkeleton } from "@/components/ReelsView";
import { StudyReels } from "@/components/study/StudyReels";

export const metadata: Metadata = { title: "Study reels" };

// Outside the (tabs) group: the feed fills the screen, with its own top bar instead of the tab bar.
// StudyReels reads the query string, so it sits in a Suspense boundary for prerendering.
export default function StudyReelsPage() {
  return (
    <Suspense fallback={<ReelsSkeleton />}>
      <StudyReels />
    </Suspense>
  );
}
