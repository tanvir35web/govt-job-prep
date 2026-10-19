import type { Metadata } from "next";
import { ExamList } from "@/components/ExamList";

export const metadata: Metadata = { title: "রিলস" };

export default function ReelsPage() {
  return <ExamList title="রিলস" intro="একটি পরীক্ষা বেছে নিন, প্রশ্নগুলো একটি একটি করে সোয়াইপ করে পড়ুন" basePath="/reels" />;
}
