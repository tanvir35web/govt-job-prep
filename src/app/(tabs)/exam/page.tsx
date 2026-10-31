import type { Metadata } from "next";
import { Suspense } from "react";
import { MockExam, MockExamSkeleton } from "@/components/mock/MockExam";

export const metadata: Metadata = { title: "Exam" };

export default function ExamTabPage() {
  return (
    <Suspense fallback={<MockExamSkeleton />}>
      <MockExam />
    </Suspense>
  );
}
