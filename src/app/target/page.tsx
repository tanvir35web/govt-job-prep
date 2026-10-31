import type { Metadata } from "next";
import { Suspense } from "react";
import { DailyTargetView } from "@/components/target/DailyTargetView";
import { Skeleton } from "@/components/StatusViews";

export const metadata: Metadata = {
  title: "দৈনিক টার্গেট",
  description: "প্রতিদিনের নির্দিষ্ট বিষয় ও টপিকের পড়ার লক্ষ্য নির্ধারণ ও মূল্যায়ন পরীক্ষা।",
};

export default function DailyTargetPage() {
  return (
    <Suspense
      fallback={
        <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-12">
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="mt-6 h-48 rounded-2xl" />
          <Skeleton className="mt-4 h-64 rounded-2xl" />
        </main>
      }
    >
      <DailyTargetView />
    </Suspense>
  );
}

