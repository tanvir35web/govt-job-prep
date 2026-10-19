"use client";

import { useEffect, useMemo, useState } from "react";
import { formatExamDate, toBn } from "@/lib/format";
import { getSavedSlugs, useOnline } from "@/lib/offline";
import type { ExamListItem, ExamListResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import { BuildingIcon, ChevronRightIcon, CircleCheckIcon, SearchIcon, XIcon } from "./icons";
import { OfflineBadge } from "./OfflineBadge";
import { PageTitle } from "./PageTitle";
import { ErrorState, Skeleton } from "./StatusViews";

const ALL = "__all__";

// The exam picker. Home opens an exam as a scrolling page; Reels reuses it with basePath "/reels".
export function ExamList({
  title = "পরীক্ষাসমূহ",
  intro = "বিগত সরকারি চাকরি পরীক্ষার প্রশ্ন ও সমাধান",
  basePath = "/exams",
}: {
  title?: string;
  intro?: string;
  basePath?: string;
}) {
  const { state, retry } = useApi<ExamListResponse>("/api/exams?limit=100");
  const online = useOnline();
  const [query, setQuery] = useState("");
  const [organization, setOrganization] = useState(ALL);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());

  const exams = useMemo(() => (state.status === "success" ? state.data.exams : []), [state]);
  const organizations = useMemo(() => [...new Set(exams.map((e) => e.exam_info.organization))], [exams]);
  const totalQuestions = exams.reduce((sum, e) => sum + e.exam_info.total_questions, 0);

  useEffect(() => {
    if (exams.length === 0) return;
    let cancelled = false;
    getSavedSlugs(exams.map((e) => e.slug)).then((slugs) => !cancelled && setSaved(slugs));
    return () => {
      cancelled = true;
    };
  }, [exams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exams.filter(({ exam_info: info }) => {
      if (organization !== ALL && info.organization !== organization) return false;
      if (!q) return true;
      return [info.exam_title, info.organization, info.exam_date].some((field) => field.toLowerCase().includes(q));
    });
  }, [exams, query, organization]);

  return (
    <>
      <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        <PageTitle
          title={title}
          trailing={<OfflineBadge />}
          subtitle={
            state.status === "success"
              ? `${toBn(exams.length)}টি পরীক্ষা · ${toBn(totalQuestions)}টি প্রশ্ন ও সমাধান`
              : intro
          }
        />

        <SearchField value={query} onChange={setQuery} />

        {state.status === "loading" && <ExamListSkeleton />}

        {state.status === "error" &&
          (state.code === 0 ? (
            <ErrorState
              offline
              title="ইন্টারনেট সংযোগ নেই"
              message="পরীক্ষার তালিকা এখনো এই ডিভাইসে সংরক্ষিত হয়নি। ইন্টারনেট চালু করে আবার চেষ্টা করুন।"
              onRetry={retry}
            />
          ) : (
            <ErrorState title="পরীক্ষার তালিকা লোড করা যায়নি" message="সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" onRetry={retry} />
          ))}

        {state.status === "success" && (
          <>
            {organizations.length > 1 && (
              <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4">
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

            <h2 className="mt-6 px-4 text-[13px] text-secondary">
              {query || organization !== ALL ? `${toBn(filtered.length)}টি ফলাফল` : "সব পরীক্ষা"}
            </h2>

            {filtered.length === 0 ? (
              <div className="mt-2 rounded-2xl bg-surface px-6 py-12 text-center">
                <SearchIcon className="mx-auto size-8 text-tertiary" />
                <p className="mt-3 text-[17px] font-semibold">কোনো পরীক্ষা পাওয়া যায়নি</p>
                <p className="mt-1 text-[15px] text-secondary">অন্য কোনো শব্দ দিয়ে খুঁজে দেখুন।</p>
              </div>
            ) : (
              <ul className="mt-2 overflow-hidden rounded-2xl bg-surface">
                {filtered.map((exam, i) => (
                  <li key={exam.slug}>
                    <ExamRow
                      exam={exam}
                      href={`${basePath}/${exam.slug}`}
                      saved={saved.has(exam.slug)}
                      unavailable={!online && !saved.has(exam.slug)}
                      last={i === filtered.length - 1}
                    />
                  </li>
                ))}
              </ul>
            )}

            {!online && (
              <p className="mt-2 px-4 text-[13px] text-secondary">অফলাইনে শুধু আগে খোলা বা সংরক্ষণ করা পরীক্ষাগুলো খোলা যাবে। সব একসাথে সংরক্ষণ করতে সেটিংসে যান।</p>
            )}
          </>
        )}
      </main>
    </>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex h-10 items-center gap-1.5 rounded-[10px] bg-fill px-2">
      <SearchIcon className="size-4.5 shrink-0 text-secondary" />
      {/* 17px keeps iOS Safari from zooming in when the field is focused. */}
      <input
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="পরীক্ষা বা প্রতিষ্ঠান খুঁজুন"
        aria-label="পরীক্ষা খুঁজুন"
        className="h-full min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-secondary [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="মুছে ফেলুন"
          className="pressable grid size-5 shrink-0 place-items-center rounded-full bg-tertiary text-surface"
        >
          <XIcon className="size-3 stroke-3" />
        </button>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pressable shrink-0 rounded-full px-3.5 py-1.5 text-[15px] font-medium whitespace-nowrap ${
        active ? "bg-label text-canvas" : "bg-surface text-label"
      }`}
    >
      {children}
    </button>
  );
}

function ExamRow({
  exam,
  href,
  saved,
  unavailable,
  last,
}: {
  exam: ExamListItem;
  href: string;
  saved: boolean;
  unavailable: boolean;
  last: boolean;
}) {
  const info = exam.exam_info;
  return (
    <AppLink
      href={href}
      className={`flex items-center gap-3 pl-4 transition-colors active:bg-fill-strong ${unavailable ? "opacity-40" : ""}`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-linear-to-br from-emerald-500 to-teal-700 text-white">
        <BuildingIcon className="size-5" />
      </span>
      <div className={`flex min-w-0 flex-1 items-center gap-2 py-3 pr-3 ${last ? "" : "hairline-b"}`}>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[17px] leading-snug font-semibold">{info.exam_title}</p>
          <p className="mt-0.5 truncate text-[13px] text-secondary">
            {info.organization} · {formatExamDate(info.exam_date)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-secondary">
            <span>{toBn(info.total_questions)}টি প্রশ্ন</span>
            <span aria-hidden="true">·</span>
            <span>{toBn(info.total_marks)} নম্বর</span>
            <span aria-hidden="true">·</span>
            <span>{info.exam_type}</span>
            {saved && (
              <span className="inline-flex items-center gap-0.5 text-ios-green">
                <CircleCheckIcon className="size-3.5" /> অফলাইন
              </span>
            )}
          </p>
        </div>
        <ChevronRightIcon className="size-5 shrink-0 text-tertiary stroke-[2.5]" />
      </div>
    </AppLink>
  );
}

function ExamListSkeleton() {
  return (
    <div aria-busy="true" aria-label="লোড হচ্ছে" className="mt-6">
      <Skeleton className="ml-4 h-3.5 w-24" />
      <div className="mt-2 overflow-hidden rounded-2xl bg-surface">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 pl-4">
            <Skeleton className="size-10 shrink-0 rounded-[10px]" />
            <div className={`flex-1 py-3.5 pr-4 ${i < 5 ? "hairline-b" : ""}`}>
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
