"use client";

import { useEffect, useMemo, useState } from "react";
import { coverFor } from "@/lib/covers";
import { formatExamDate, toBn } from "@/lib/format";
import { getSavedSlugs, useOnline } from "@/lib/offline";
import { loadAnswers, loadLastReel, loadReelsPosition } from "@/lib/settings";
import type { ExamListItem, ExamListResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import { FilterChip, SearchField } from "./ExamList";
import { CircleCheckIcon, PlayIcon, ReelsIcon, SearchIcon, WifiOffIcon } from "./icons";
import { OfflineBadge } from "./OfflineBadge";
import { PageTitle } from "./PageTitle";
import { ErrorState, Skeleton } from "./StatusViews";

const ALL = "__all__";

type Progress = { answered: number; position: number };

// The Reels tab: a grid of portrait covers, one per exam, with a "continue" card for the last one opened.
export function ReelsList() {
  const { state, retry } = useApi<ExamListResponse>("/api/exams?limit=100");
  const online = useOnline();
  const [query, setQuery] = useState("");
  const [organization, setOrganization] = useState(ALL);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());

  const exams = useMemo(() => (state.status === "success" ? state.data.exams : []), [state]);
  const organizations = useMemo(() => [...new Set(exams.map((e) => e.exam_info.organization))], [exams]);

  // Exams only arrive from a client-side fetch, so localStorage is available whenever this has entries.
  const progress = useMemo(() => {
    const map = new Map<string, Progress>();
    for (const { slug } of exams) {
      map.set(slug, { answered: Object.keys(loadAnswers(slug)).length, position: loadReelsPosition(slug) });
    }
    return map;
  }, [exams]);
  const lastSlug = useMemo(() => (exams.length ? loadLastReel() : null), [exams]);
  const lastExam = exams.find((e) => e.slug === lastSlug);

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

  const filtering = query !== "" || organization !== ALL;

  return (
    <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 lg:max-w-5xl">
      <PageTitle title="রিলস" trailing={<OfflineBadge />} subtitle="একটি করে প্রশ্ন, সোয়াইপ করে পরেরটিতে" />

      <SearchField value={query} onChange={setQuery} placeholder="রিলস খুঁজুন" />

      {state.status === "loading" && <ReelsListSkeleton />}

      {state.status === "error" &&
        (state.code === 0 ? (
          <ErrorState
            offline
            title="ইন্টারনেট সংযোগ নেই"
            message="পরীক্ষার তালিকা এখনো এই ডিভাইসে সংরক্ষিত হয়নি। ইন্টারনেট চালু করে আবার চেষ্টা করুন।"
            onRetry={retry}
          />
        ) : (
          <ErrorState title="রিলস লোড করা যায়নি" message="সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" onRetry={retry} />
        ))}

      {state.status === "success" && (
        <>
          {lastExam && !filtering && (
            <ContinueCard
              exam={lastExam}
              progress={progress.get(lastExam.slug)}
              unavailable={!online && !saved.has(lastExam.slug)}
            />
          )}

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

          <h2 className="mt-6 mb-2 px-1 text-[13px] text-secondary">
            {filtering ? `${toBn(filtered.length)}টি ফলাফল` : `সব রিলস · ${toBn(exams.length)}টি পরীক্ষা`}
          </h2>

          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-surface px-6 py-12 text-center">
              <SearchIcon className="mx-auto size-8 text-tertiary" />
              <p className="mt-3 text-[17px] font-semibold">কোনো রিলস পাওয়া যায়নি</p>
              <p className="mt-1 text-[15px] text-secondary">অন্য কোনো শব্দ দিয়ে খুঁজে দেখুন।</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((exam) => (
                <li key={exam.slug}>
                  <ReelCover
                    exam={exam}
                    progress={progress.get(exam.slug)}
                    saved={saved.has(exam.slug)}
                    unavailable={!online && !saved.has(exam.slug)}
                  />
                </li>
              ))}
            </ul>
          )}

          {!online && (
            <p className="mt-3 px-1 text-[13px] text-secondary">অফলাইনে শুধু আগে খোলা বা সংরক্ষণ করা পরীক্ষাগুলো খোলা যাবে।</p>
          )}
        </>
      )}
    </main>
  );
}

function ProgressLine({ value, total, className = "" }: { value: number; total: number; className?: string }) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-white/25 ${className}`}>
      <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ContinueCard({ exam, progress, unavailable }: { exam: ExamListItem; progress?: Progress; unavailable: boolean }) {
  const info = exam.exam_info;
  const position = Math.min((progress?.position ?? 0) + 1, info.total_questions);

  return (
    <AppLink
      href={`/reels/${exam.slug}`}
      className={`pressable relative mt-5 flex items-center gap-4 overflow-hidden rounded-2xl bg-linear-to-br p-4 text-white ${coverFor(info.organization)} ${
        unavailable ? "opacity-40" : ""
      }`}
    >
      <ReelsIcon className="pointer-events-none absolute -right-4 -bottom-6 size-32 stroke-1 text-white/15" />
      <div className="relative min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-white/80">চালিয়ে যান</p>
        <p className="mt-0.5 line-clamp-2 text-[17px] leading-snug font-bold">{info.exam_title}</p>
        <p className="mt-1 text-[13px] text-white/80">
          প্রশ্ন {toBn(position)}/{toBn(info.total_questions)}
          {progress?.answered ? ` · ${toBn(progress.answered)}টির উত্তর দেওয়া` : ""}
        </p>
        <ProgressLine value={position} total={info.total_questions} className="mt-3" />
      </div>
      <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-white text-label shadow-lg">
        <PlayIcon className="ml-0.5 size-5 fill-current stroke-0" />
      </span>
    </AppLink>
  );
}

function ReelCover({ exam, progress, saved, unavailable }: { exam: ExamListItem; progress?: Progress; saved: boolean; unavailable: boolean }) {
  const info = exam.exam_info;
  const answered = progress?.answered ?? 0;
  const done = info.total_questions > 0 && answered >= info.total_questions;

  return (
    <AppLink
      href={`/reels/${exam.slug}`}
      aria-label={`${info.exam_title}, ${toBn(info.total_questions)}টি প্রশ্ন${done ? ", সম্পন্ন" : ""}`}
      className={`group relative flex aspect-[3/4] flex-col overflow-hidden rounded-2xl bg-linear-to-br p-3 text-white transition-transform active:scale-[0.97] ${coverFor(
        info.organization,
      )} ${unavailable ? "opacity-40" : ""}`}
    >
      {/* Faint glyph for texture, and a scrim so the title stays readable on the lighter end of the gradient. */}
      <ReelsIcon className="pointer-events-none absolute -top-3 -right-5 size-28 stroke-1 text-white/15" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/45 to-transparent" />

      <div className="relative flex items-center justify-between gap-2">
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[12px] font-semibold backdrop-blur-sm">
          {toBn(info.total_questions)}টি প্রশ্ন
        </span>
        {done ? (
          <CircleCheckIcon className="size-5 shrink-0" />
        ) : saved ? (
          <span className="text-[11px] font-medium text-white/85">অফলাইন</span>
        ) : unavailable ? (
          <WifiOffIcon className="size-4 shrink-0" />
        ) : null}
      </div>

      <span className="relative m-auto grid size-11 place-items-center rounded-full bg-white/25 backdrop-blur-sm transition-transform group-hover:scale-110">
        <PlayIcon className="ml-0.5 size-5 fill-current stroke-0" />
      </span>

      <div className="relative">
        <p className="truncate text-[12px] font-medium text-white/80">{info.organization}</p>
        <p className="mt-0.5 line-clamp-3 text-[15px] leading-snug font-bold">{info.exam_title}</p>
        <p className="mt-1 text-[12px] text-white/75">{formatExamDate(info.exam_date)}</p>
        {answered > 0 && !done && (
          <div className="mt-2 flex items-center gap-2">
            <ProgressLine value={answered} total={info.total_questions} className="flex-1" />
            <span className="text-[11px] font-semibold">
              {toBn(answered)}/{toBn(info.total_questions)}
            </span>
          </div>
        )}
      </div>
    </AppLink>
  );
}

function ReelsListSkeleton() {
  return (
    <div aria-busy="true" aria-label="লোড হচ্ছে">
      <Skeleton className="mt-5 h-[104px] rounded-2xl" />
      <Skeleton className="mt-6 mb-2 ml-1 h-3.5 w-28" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
