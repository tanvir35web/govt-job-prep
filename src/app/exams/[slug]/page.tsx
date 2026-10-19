import { Suspense } from "react";
import { ExamSkeleton, ExamView } from "@/components/ExamView";

export default function ExamPage({ params }: PageProps<"/exams/[slug]">) {
  return (
    <Suspense fallback={<ExamSkeleton />}>
      {params.then(({ slug }) => (
        <ExamView slug={slug} />
      ))}
    </Suspense>
  );
}
