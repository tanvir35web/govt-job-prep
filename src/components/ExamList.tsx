"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatExamDate, toBn } from "@/lib/format";
import type { ExamListItem, ExamListResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { ArrowRightIcon, AwardIcon, BuildingIcon, CalendarIcon, ListIcon, SearchIcon } from "./icons";
import { ErrorState, Skeleton } from "./StatusViews";

const ALL = "__all__";

export function ExamList() {
  const { state, retry } = useApi<ExamListResponse>("/api/exams?limit=100");
  const [query, setQuery] = useState("");
  const [organization, setOrganization] = useState(ALL);

  const exams = useMemo(() => (state.status === "success" ? state.data.exams : []), [state]);
  const organizations = useMemo(() => [...new Set(exams.map((e) => e.exam_info.organization))], [exams]);
  const totalQuestions = exams.reduce((sum, e) => sum + e.exam_info.total_questions, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exams.filter(({ exam_info: info }) => {
      if (organization !== ALL && info.organization !== organization) return false;
      if (!q) return true;
      return [info.exam_title, info.organization, info.exam_date].some((field) => field.toLowerCase().includes(q));
    });
  }, [exams, query, organization]);

  return (
    <main>
      <section className="relative overflow-hidden border-b border-stone-200 dark:border-stone-800">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/10" />
          <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-500/5" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            সমাধানসহ বিগত প্রশ্ন
          </span>
          <h1 className="mt-5 max-w-3xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl lg:leading-tight">
            বিগত সরকারি চাকরি পরীক্ষার{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300">
              প্রশ্ন ও সমাধান
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-stone-600 sm:text-lg dark:text-stone-300">
            একটি পরীক্ষা বেছে নিন। প্রতিটি প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা পড়ুন, অথবা নিজে উত্তর দিয়ে অনুশীলন করুন।
          </p>

          <div className="mt-8 flex max-w-xl items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 shadow-sm transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/15 dark:border-stone-700 dark:bg-stone-900">
            <SearchIcon className="size-5 shrink-0 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="পরীক্ষা বা প্রতিষ্ঠানের নাম লিখুন..."
              aria-label="পরীক্ষা খুঁজুন"
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-stone-400"
            />
          </div>

          {state.status === "success" && (
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <Stat label="পরীক্ষা" value={`${toBn(exams.length)}টি`} />
              <Stat label="মোট প্রশ্ন" value={`${toBn(totalQuestions)}টি`} />
              <Stat label="প্রতিষ্ঠান" value={`${toBn(organizations.length)}টি`} />
            </dl>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {state.status === "loading" && <ExamGridSkeleton />}

        {state.status === "error" && (
          <ErrorState title="পরীক্ষার তালিকা লোড করা যায়নি" message="সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" onRetry={retry} />
        )}

        {state.status === "success" && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold sm:text-2xl">সব পরীক্ষা</h2>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{toBn(filtered.length)}টি পরীক্ষা দেখানো হচ্ছে</p>
              </div>
            </div>

            {organizations.length > 1 && (
              <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <FilterChip active={organization === ALL} onClick={() => setOrganization(ALL)}>
                  সব
                </FilterChip>
                {organizations.map((org) => (
                  <FilterChip key={org} active={organization === org} onClick={() => setOrganization(org)}>
                    {org}
                  </FilterChip>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-dashed border-stone-300 px-6 py-16 text-center dark:border-stone-700">
                <SearchIcon className="mx-auto size-8 text-stone-400" />
                <p className="mt-3 font-medium">কোনো পরীক্ষা পাওয়া যায়নি</p>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">অন্য কোনো শব্দ দিয়ে খুঁজে দেখুন।</p>
              </div>
            ) : (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {filtered.map((exam) => (
                  <li key={exam.slug}>
                    <ExamCard exam={exam} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-stone-500 dark:text-stone-400">{label}</dt>
      <dd className="text-lg font-bold text-stone-900 dark:text-white">{value}</dd>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap transition ${
        active
          ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
          : "border-stone-300 bg-white text-stone-700 hover:border-emerald-400 hover:text-emerald-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
      }`}
    >
      {children}
    </button>
  );
}

function ExamCard({ exam }: { exam: ExamListItem }) {
  const info = exam.exam_info;
  return (
    <Link
      href={`/exams/${exam.slug}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:p-6 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-emerald-500/50"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 transition group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <BuildingIcon className="size-4 shrink-0" />
          <span className="line-clamp-1">{info.organization}</span>
        </span>
        <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
          {info.exam_type}
        </span>
      </div>

      <h3 className="mt-3 text-lg leading-snug font-semibold text-stone-900 dark:text-white">{info.exam_title}</h3>

      <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
        <CalendarIcon className="size-4" />
        {formatExamDate(info.exam_date)}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniStat icon={<ListIcon className="size-4" />} label="প্রশ্ন" value={toBn(info.total_questions)} />
        <MiniStat icon={<AwardIcon className="size-4" />} label="নম্বর" value={toBn(info.total_marks)} />
      </div>

      <span className="mt-auto flex items-center justify-between pt-6 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
        প্রশ্ন ও সমাধান দেখুন
        <span className="grid size-8 place-items-center rounded-full bg-emerald-50 transition group-hover:translate-x-1 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-500/10">
          <ArrowRightIcon className="size-4" />
        </span>
      </span>
    </Link>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 px-3 py-2.5 dark:bg-stone-800/60">
      <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  );
}

function ExamGridSkeleton() {
  return (
    <div aria-busy="true" aria-label="লোড হচ্ছে">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-28" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-4 h-6 w-full" />
            <Skeleton className="mt-2 h-6 w-2/3" />
            <Skeleton className="mt-4 h-4 w-1/3" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
