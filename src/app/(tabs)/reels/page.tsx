import type { Metadata } from "next";
import { ReelsIcon } from "@/components/icons";
import { PageTitle } from "@/components/PageTitle";

export const metadata: Metadata = { title: "রিলস" };

export default function ReelsPage() {
  return (
    <main className="px-safe mx-auto flex w-full max-w-3xl flex-1 flex-col pt-[max(1.25rem,env(safe-area-inset-top))]">
      <PageTitle title="রিলস" />
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-fill text-secondary">
          <ReelsIcon className="size-8" />
        </span>
        <h2 className="mt-5 text-[20px] font-semibold">শীঘ্রই আসছে</h2>
        <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-secondary">এই অংশটি তৈরি হচ্ছে।</p>
      </div>
    </main>
  );
}
