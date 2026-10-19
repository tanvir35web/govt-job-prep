import type { Metadata } from "next";
import { MockExam } from "@/components/mock/MockExam";

export const metadata: Metadata = { title: "Exam" };

export default function ExamTabPage() {
  return <MockExam />;
}
