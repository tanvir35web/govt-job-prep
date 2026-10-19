import { Suspense } from "react";
import { ReelsSkeleton, ReelsView } from "@/components/ReelsView";

// Outside the (tabs) group: the feed fills the screen, with its own top bar instead of the tab bar.
export default function ReelsExamPage({ params }: PageProps<"/reels/[slug]">) {
  return (
    <Suspense fallback={<ReelsSkeleton />}>
      {params.then(({ slug }) => (
        <ReelsView slug={slug} />
      ))}
    </Suspense>
  );
}
