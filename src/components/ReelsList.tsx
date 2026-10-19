"use client";

import { useEffect, useMemo, useState } from "react";
import { type SoftTone, softToneFor } from "@/lib/covers";
import { formatExamDate, formatNumber, pluralize } from "@/lib/format";
import { getSavedSlugs, useOnline } from "@/lib/offline";
import { loadAnswers, loadLastReel, loadReelsPosition } from "@/lib/settings";
import type { ExamListItem, ExamListResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import { FilterChip, SearchField } from "./ExamList";
import { CircleCheckIcon, PlayIcon, SearchIcon, WifiOffIcon } from "./icons";
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
      <PageTitle title="Reels" trailing={<OfflineBadge />} subtitle="One question at a time. Swipe for the next." />

      <SearchField value={query} onChange={setQuery} placeholder="Search reels" />

      {state.status === "loading" && <ReelsListSkeleton />}

      {state.status === "error" &&
        (state.code === 0 ? (
          <ErrorState
            offline
            title="No internet connection"
            message="The exam list hasn't been saved to this device yet. Connect to the internet and try again."
            onRetry={retry}
          />
        ) : (
          <ErrorState title="Couldn't load reels" message="Something went wrong on the server. Try again in a moment." onRetry={retry} />
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
                All
              </FilterChip>
              {organizations.map((org) => (
                <FilterChip key={org} active={organization === org} onClick={() => setOrganization(org)}>
                  {org}
                </FilterChip>
              ))}
            </div>
          )}

          <h2 className="mt-6 mb-2 px-1 text-[13px] text-secondary">
            {filtering ? pluralize(filtered.length, "result") : `All reels · ${pluralize(exams.length, "exam")}`}
          </h2>

          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-surface px-6 py-12 text-center">
              <SearchIcon className="mx-auto size-8 text-tertiary" />
              <p className="mt-3 text-[17px] font-semibold">No reels found</p>
              <p className="mt-1 text-[15px] text-secondary">Try a different search.</p>
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
            <p className="mt-3 px-1 text-[13px] text-secondary">While offline, only exams opened or saved earlier are available.</p>
          )}
        </>
      )}
    </main>
  );
}

function ProgressLine({ value, total, tone, className = "" }: { value: number; total: number; tone: SoftTone; className?: string }) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className={`h-1 overflow-hidden rounded-full ${tone.track} ${className}`}>
      <div className={`h-full rounded-full ${tone.solid}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function PlayBadge({ tone, size = "size-9" }: { tone: SoftTone; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full text-white dark:text-black ${tone.solid}`}>
      <PlayIcon className="ml-0.5 size-4 fill-current stroke-0" />
    </span>
  );
}

function ContinueCard({ exam, progress, unavailable }: { exam: ExamListItem; progress?: Progress; unavailable: boolean }) {
  const info = exam.exam_info;
  const tone = softToneFor(info.organization);
  const position = Math.min((progress?.position ?? 0) + 1, info.total_questions);

  return (
    <AppLink
      href={`/reels/${exam.slug}`}
      className={`mt-5 flex items-center gap-3.5 rounded-[20px] p-4 transition-transform active:scale-[0.98] ${tone.card} ${unavailable ? "opacity-40" : ""}`}
    >
      <PlayBadge tone={tone} size="size-12" />
      <div className="min-w-0 flex-1">
        <p className={`text-[12px] font-semibold ${tone.accent}`}>Continue</p>
        <p className="mt-0.5 truncate text-[16px] font-semibold">{info.exam_title}</p>
        <div className="mt-2 flex items-center gap-2">
          <ProgressLine value={position} total={info.total_questions} tone={tone} className="flex-1" />
          <span className="shrink-0 text-[12px] text-secondary">
            {formatNumber(position)}/{formatNumber(info.total_questions)}
          </span>
        </div>
      </div>
    </AppLink>
  );
}

// A calm, pale card in the organisation's hue: play button and status on top, title and progress at the bottom.
function ReelCover({ exam, progress, saved, unavailable }: { exam: ExamListItem; progress?: Progress; saved: boolean; unavailable: boolean }) {
  const info = exam.exam_info;
  const tone = softToneFor(info.organization);
  const answered = progress?.answered ?? 0;
  const done = info.total_questions > 0 && answered >= info.total_questions;

  return (
    <AppLink
      href={`/reels/${exam.slug}`}
      aria-label={`${info.exam_title}, ${pluralize(info.total_questions, "question")}${done ? ", done" : ""}`}
      className={`flex aspect-[4/5] flex-col rounded-[20px] p-3.5 transition-transform active:scale-[0.97] ${tone.card} ${unavailable ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <PlayBadge tone={tone} />
        {done ? (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${tone.accent}`}>
            <CircleCheckIcon className="size-4" /> Done
          </span>
        ) : saved ? (
          <span className="text-[11px] font-medium text-secondary">Offline</span>
        ) : unavailable ? (
          <WifiOffIcon className="size-4 shrink-0 text-secondary" />
        ) : null}
      </div>

      <div className="mt-auto min-w-0">
        <p className={`truncate text-[12px] font-semibold ${tone.accent}`}>{info.organization}</p>
        <p className="mt-1 line-clamp-3 text-[15px] leading-snug font-semibold">{info.exam_title}</p>
        <p className="mt-1.5 truncate text-[12px] text-secondary">
          {pluralize(info.total_questions, "question")} · {formatExamDate(info.exam_date)}
        </p>
        {answered > 0 && !done && <ProgressLine value={answered} total={info.total_questions} tone={tone} className="mt-2.5" />}
      </div>
    </AppLink>
  );
}

function ReelsListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mt-5 h-20 rounded-[20px]" />
      <Skeleton className="mt-6 mb-2 ml-1 h-3.5 w-28" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-[20px]" />
        ))}
      </div>
    </div>
  );
}
