import Link from "next/link";
import { GraduationCapIcon } from "./icons";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] border-b border-stone-200/70 bg-stone-50/80 backdrop-blur-md dark:border-stone-800/70 dark:bg-stone-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-sm shadow-emerald-900/20 transition group-hover:scale-105">
            <GraduationCapIcon className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold sm:text-lg">সরকারি চাকরি প্রস্তুতি</span>
            <span className="hidden text-xs text-stone-500 sm:block dark:text-stone-400">বিগত প্রশ্ন · সমাধান · অনুশীলন</span>
          </span>
        </Link>
        <Link
          href="/"
          className="rounded-full px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white"
        >
          পরীক্ষাসমূহ
        </Link>
      </div>
    </header>
  );
}
