"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { softToneFor } from "@/lib/covers";
import { parseExamDate } from "@/lib/exam-validation";
import { firstLetter, formatExamDate, formatNumber, pluralize } from "@/lib/format";
import { getSavedSlugs, useOnline } from "@/lib/offline";
import { loadAnswers, loadRecentExams } from "@/lib/settings";
import type { ExamListItem, ExamListResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import { CheckIcon, ChevronRightIcon, CircleCheckIcon, SearchIcon, XIcon } from "./icons";
import { OfflineBadge } from "./OfflineBadge";
import { Ring } from "./Ring";
import { ErrorState, Skeleton } from "./StatusViews";

const ALL = "__all__";

type Progress = { answered: number; total: number };

// Home: today's date, an overall progress summary, "continue" for exams in progress, then every exam grouped by month.
export function ExamList() {
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
    for (const { slug, exam_info: info } of exams) {
      const total = info.total_questions;
      map.set(slug, { answered: Math.min(Object.keys(loadAnswers(slug)).length, total), total });
    }
    return map;
  }, [exams]);

  // In progress, most recently opened first; exams never opened on this device follow in list order.
  const inProgress = useMemo(() => {
    const recent = exams.length ? loadRecentExams() : [];
    const rank = (slug: string) => {
      const i = recent.indexOf(slug);
      return i === -1 ? recent.length : i;
    };
    return exams
      .filter((e) => {
        const p = progress.get(e.slug);
        return p && p.answered > 0 && p.answered < p.total;
      })
      .sort((a, b) => rank(a.slug) - rank(b.slug));
  }, [exams, progress]);

  useEffect(() => {
    if (exams.length === 0) return;
    let cancelled = false;
    getSavedSlugs(exams.map((e) => e.slug)).then((slugs) => !cancelled && setSaved(slugs));
    return () => {
      cancelled = true;
    };
  }, [exams]);

  const filtering = query.trim() !== "" || organization !== ALL;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exams.filter(({ exam_info: info }) => {
      if (organization !== ALL && info.organization !== organization) return false;
      if (!q) return true;
      return [info.exam_title, info.organization, info.exam_date].some((field) => field.toLowerCase().includes(q));
    });
  }, [exams, query, organization]);

  const rowProps = (exam: ExamListItem): RowProps => ({
    exam,
    progress: progress.get(exam.slug),
    saved: saved.has(exam.slug),
    unavailable: !online && !saved.has(exam.slug),
  });

  return (
    <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
      <HomeHeader />

      <SearchField value={query} onChange={setQuery} />

      {state.status === "loading" && <HomeSkeleton />}

      {state.status === "error" &&
        (state.code === 0 ? (
          <ErrorState
            offline
            title="No internet connection"
            message="The exam list isn't saved on this device yet. Connect to the internet and try again."
            onRetry={retry}
          />
        ) : (
          <ErrorState title="Couldn't load exams" message="Something went wrong on the server. Try again in a moment." onRetry={retry} />
        ))}

      {state.status === "success" && (
        <>
          {!filtering && (
            <>
              <SummaryCard exams={exams} progress={progress} savedCount={saved.size} />
              {inProgress.length > 0 && (
                <section className="mt-7" aria-label="Continue">
                  <SectionHeader title="Continue" />
                  <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
                    {inProgress.map((exam) => (
                      <li key={exam.slug} className="w-[78%] max-w-xs shrink-0 snap-start">
                        <ContinueCard {...rowProps(exam)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {organizations.length > 1 && (
            <div className="no-scrollbar -mx-4 mt-7 flex gap-2 overflow-x-auto px-4">
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

          {filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-surface/60 px-6 py-12 text-center ring-[0.5px] ring-black/5 dark:ring-white/10">
              <SearchIcon className="mx-auto size-8 text-tertiary" />
              <p className="mt-3 text-[17px] font-semibold">No exams found</p>
              <p className="mt-1 text-[15px] text-secondary">Try a different search.</p>
            </div>
          ) : filtering ? (
            <section className="mt-6">
              <SectionHeader title={pluralize(filtered.length, "result")} />
              <ExamGroup exams={filtered} rowProps={rowProps} />
            </section>
          ) : (
            groupByMonth(filtered).map(([label, group]) => (
              <section key={label} className="mt-6">
                <SectionHeader title={label} detail={pluralize(group.length, "exam")} />
                <ExamGroup exams={group} rowProps={rowProps} />
              </section>
            ))
          )}

          {!online && (
            <p className="mt-3 px-4 text-[13px] text-secondary">Offline, you can only open exams you have opened or saved before. To save them all at once, go to Settings.</p>
          )}
        </>
      )}
    </main>
  );
}

// ---- Header

const noopSubscribe = () => () => {};
const todayLabel = () => new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

// iOS "Today"-style header: the date above a large title. The date is read only on the client.
function HomeHeader() {
  const today = useSyncExternalStore(noopSubscribe, todayLabel, () => null);
  return (
    <header className="pb-3">
      <p className="h-5 text-[13px] font-semibold text-secondary">{today}</p>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[34px] leading-tight font-bold tracking-tight">Prep</h1>
        <OfflineBadge />
      </div>
    </header>
  );
}

function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <h2 className="text-[20px] font-bold">{title}</h2>
      {detail && <span className="text-[13px] text-secondary">{detail}</span>}
    </div>
  );
}

// ---- Summary

function SummaryCard({ exams, progress, savedCount }: { exams: ExamListItem[]; progress: Map<string, Progress>; savedCount: number }) {
  let answered = 0;
  let total = 0;
  let started = 0;
  let completed = 0;
  for (const p of progress.values()) {
    answered += p.answered;
    total += p.total;
    if (p.answered > 0) started++;
    if (p.total > 0 && p.answered >= p.total) completed++;
  }
  const pct = total ? Math.round((answered / total) * 100) : 0;

  return (
    <section className="mt-5 rounded-2xl bg-surface/60 p-4 ring-[0.5px] ring-black/5 dark:ring-white/10" aria-label="Your progress">
      <div className="flex items-center gap-4">
        <Ring value={answered} total={total} size={76} stroke={8}>
          <span className="text-[17px] font-bold">{formatNumber(pct)}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold">Your progress</h2>
          <p className="mt-0.5 text-[15px] leading-snug text-secondary">
            {answered > 0
              ? `${formatNumber(answered)} of ${pluralize(total, "question")} answered`
              : `${pluralize(total, "question")} across ${pluralize(exams.length, "exam")}. Pick one to start.`}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 rounded-xl bg-fill/60 py-2.5 text-center">
        <SummaryStat label="Started" value={started} />
        <SummaryStat label="Completed" value={completed} divider />
        <SummaryStat label="Offline" value={savedCount} divider />
      </dl>
    </section>
  );
}

function SummaryStat({ label, value, divider = false }: { label: string; value: number; divider?: boolean }) {
  return (
    <div className={`flex flex-col-reverse ${divider ? "border-l-[0.5px] border-separator" : ""}`}>
      <dt className="text-[13px] text-secondary">{label}</dt>
      <dd className="text-[20px] leading-tight font-semibold">{formatNumber(value)}</dd>
    </div>
  );
}

// ---- Continue

type RowProps = { exam: ExamListItem; progress?: Progress; saved: boolean; unavailable: boolean };

function ContinueCard({ exam, progress, unavailable }: RowProps) {
  const info = exam.exam_info;
  const tone = softToneFor(info.organization);
  const answered = progress?.answered ?? 0;
  const pct = info.total_questions ? Math.round((answered / info.total_questions) * 100) : 0;

  // Pale wash of the organisation's hue, theme-coloured text; the hue only marks the name and the progress.
  return (
    <AppLink
      href={`/exams/${exam.slug}`}
      className={`flex h-full min-h-36 flex-col rounded-[20px] p-4 ring-[0.5px] ring-black/5 dark:ring-white/10 transition-transform active:scale-[0.98] ${tone.wash} ${unavailable ? "opacity-40" : ""}`}
    >
      <p className={`truncate text-[12px] font-semibold ${tone.accent}`}>{info.organization}</p>
      <p className="mt-1 line-clamp-2 text-[17px] leading-snug font-semibold">{info.exam_title}</p>
      <div className="mt-auto pt-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-secondary">
            {formatNumber(answered)}/{formatNumber(info.total_questions)} answered
          </span>
          <span className={`font-semibold ${tone.accent}`}>{formatNumber(pct)}%</span>
        </div>
        <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${tone.track}`}>
          <div className={`h-full rounded-full ${tone.solid}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </AppLink>
  );
}

// ---- List

function ExamGroup({ exams, rowProps }: { exams: ExamListItem[]; rowProps: (exam: ExamListItem) => RowProps }) {
  return (
    <ul className="overflow-hidden rounded-2xl bg-surface/60 ring-[0.5px] ring-black/5 dark:ring-white/10">
      {exams.map((exam, i) => (
        <li key={exam.slug}>
          <ExamRow {...rowProps(exam)} last={i === exams.length - 1} />
        </li>
      ))}
    </ul>
  );
}

function ExamRow({ exam, progress, saved, unavailable, last }: RowProps & { last: boolean }) {
  const info = exam.exam_info;
  const tone = softToneFor(info.organization);
  const answered = progress?.answered ?? 0;
  const done = info.total_questions > 0 && answered >= info.total_questions;

  return (
    <AppLink
      href={`/exams/${exam.slug}`}
      className={`flex items-center gap-3 pl-4 transition-colors active:bg-fill-strong ${unavailable ? "opacity-40" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-11 shrink-0 place-items-center rounded-xl text-[17px] font-bold ${tone.wash} ${tone.accent}`}
      >
        {firstLetter(info.organization)}
      </span>
      <div className={`flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 ${last ? "" : "hairline-b"}`}>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[16px] leading-snug font-semibold">{info.exam_title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-secondary">
            <span className="truncate">
              {pluralize(info.total_questions, "question")} · {formatExamDate(info.exam_date)}
            </span>
            {saved && (
              <span className="inline-flex shrink-0 items-center text-ios-green">
                <CircleCheckIcon className="size-3.5" />
                <span className="sr-only">Available offline</span>
              </span>
            )}
          </p>
        </div>
        {done ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ios-green text-white dark:text-black">
            <CheckIcon className="size-4 stroke-3" />
            <span className="sr-only">Completed</span>
          </span>
        ) : answered > 0 ? (
          <Ring value={answered} total={info.total_questions} size={28} stroke={3.5}>
            <span className="sr-only">
              {formatNumber(answered)}/{formatNumber(info.total_questions)} answered
            </span>
          </Ring>
        ) : (
          <ChevronRightIcon className="size-5 shrink-0 stroke-[2.5] text-tertiary" />
        )}
      </div>
    </AppLink>
  );
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });

// The API already sorts newest first, so groups come out in date order.
function groupByMonth(exams: ExamListItem[]): [string, ExamListItem[]][] {
  const groups = new Map<string, ExamListItem[]>();
  for (const exam of exams) {
    const date = parseExamDate(exam.exam_info.exam_date);
    const label = date ? MONTH_FORMAT.format(date) : "Other";
    groups.set(label, [...(groups.get(label) ?? []), exam]);
  }
  return [...groups.entries()];
}

// ---- Shared with Reels

export function SearchField({
  value,
  onChange,
  placeholder = "Search exams or organisations",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex h-10 items-center gap-1.5 rounded-[10px] bg-fill/60 px-2">
      <SearchIcon className="size-4.5 shrink-0 text-secondary" />
      {/* 17px keeps iOS Safari from zooming in when the field is focused. */}
      <input
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search exams"
        className="h-full min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-secondary [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear"
          className="pressable grid size-5 shrink-0 place-items-center rounded-full bg-tertiary text-surface"
        >
          <XIcon className="size-3 stroke-3" />
        </button>
      )}
    </div>
  );
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pressable shrink-0 rounded-full px-3.5 py-1.5 text-[15px] font-medium whitespace-nowrap ${
        active ? "bg-label text-canvas" : "bg-surface/60 text-label ring-[0.5px] ring-black/5 dark:ring-white/10"
      }`}
    >
      {children}
    </button>
  );
}

// The loading view has the same shapes and spacing as the loaded page, so nothing jumps when the
// list arrives. "Continue" is sketched only when this device has opened exams before.
const hasRecentExams = () => loadRecentExams().length > 0;

const ROW_TITLES = ["w-4/5", "w-3/5", "w-11/12", "w-2/3", "w-3/4", "w-1/2"];
const ROW_DETAILS = ["w-1/2", "w-2/5", "w-1/3", "w-1/2", "w-2/5", "w-1/3"];

function HomeSkeleton() {
  const showContinue = useSyncExternalStore(noopSubscribe, hasRecentExams, () => false);

  return (
    <div aria-busy="true" aria-label="Loading" className="animate-fade-in">
      <div className="mt-5 rounded-2xl bg-surface/60 p-4 ring-[0.5px] ring-black/5 dark:ring-white/10">
        <div className="flex items-center gap-4">
          {/* Same size as the progress ring; the mask cuts out its centre. */}
          <Skeleton className="size-19 shrink-0 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-8px),#000_calc(100%-8px))]" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4.5 w-32" />
            <Skeleton className="mt-2.5 h-3.5 w-full max-w-60" />
            <Skeleton className="mt-1.5 h-3.5 w-2/3 max-w-40" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 rounded-xl bg-fill/60 py-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`flex flex-col items-center gap-1.5 ${i > 0 ? "border-l-[0.5px] border-separator" : ""}`}>
              <Skeleton className="h-5 w-7" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>

      {showContinue && (
        <div className="mt-7">
          <Skeleton className="mb-3 ml-1 h-5 w-24" />
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 pb-1">
            {[0, 1].map((i) => (
              <div key={i} className="flex min-h-36 w-[78%] max-w-xs shrink-0 flex-col rounded-[20px] bg-surface/60 p-4 ring-[0.5px] ring-black/5 dark:ring-white/10">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2.5 h-4 w-full" />
                <Skeleton className="mt-1.5 h-4 w-3/5" />
                <div className="mt-auto pt-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="-mx-4 mt-7 flex gap-2 overflow-hidden px-4">
        {["w-12", "w-28", "w-36", "w-24", "w-32"].map((width, i) => (
          <Skeleton key={i} className={`h-8.5 shrink-0 rounded-full ${width}`} />
        ))}
      </div>

      {[4, 2].map((rows, group) => (
        <div key={group} className="mt-6">
          <div className="mb-2 flex items-center justify-between px-1">
            <Skeleton className={`h-5 ${group === 0 ? "w-36" : "w-32"}`} />
            <Skeleton className="h-3.5 w-14" />
          </div>
          <div className="overflow-hidden rounded-2xl bg-surface/60 ring-[0.5px] ring-black/5 dark:ring-white/10">
            {Array.from({ length: rows }, (_, i) => {
              const n = group * 4 + i;
              return (
                <div key={i} className="flex items-center gap-3 pl-4">
                  <Skeleton className="size-11 shrink-0 rounded-xl" />
                  <div className={`flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-4 ${i < rows - 1 ? "hairline-b" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <Skeleton className={`h-4 ${ROW_TITLES[n % ROW_TITLES.length]}`} />
                      {n % 3 === 0 && <Skeleton className="mt-1.5 h-4 w-2/5" />}
                      <Skeleton className={`mt-2 h-3 ${ROW_DETAILS[n % ROW_DETAILS.length]}`} />
                    </div>
                    <Skeleton className="size-4 shrink-0 rounded" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
