"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { coverFor } from "@/lib/covers";
import { parseExamDate } from "@/lib/exam-validation";
import { formatExamDate, toBn } from "@/lib/format";
import { getSavedSlugs, useOnline } from "@/lib/offline";
import { loadAnswers, loadRecentExams } from "@/lib/settings";
import type { ExamListItem, ExamListResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AppLink } from "./AppLink";
import { CheckIcon, ChevronRightIcon, CircleCheckIcon, SearchIcon, XIcon } from "./icons";
import { OfflineBadge } from "./OfflineBadge";
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
            title="ইন্টারনেট সংযোগ নেই"
            message="পরীক্ষার তালিকা এখনো এই ডিভাইসে সংরক্ষিত হয়নি। ইন্টারনেট চালু করে আবার চেষ্টা করুন।"
            onRetry={retry}
          />
        ) : (
          <ErrorState title="পরীক্ষার তালিকা লোড করা যায়নি" message="সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" onRetry={retry} />
        ))}

      {state.status === "success" && (
        <>
          {!filtering && (
            <>
              <SummaryCard exams={exams} progress={progress} savedCount={saved.size} />
              {inProgress.length > 0 && (
                <section className="mt-7" aria-label="চালিয়ে যান">
                  <SectionHeader title="চালিয়ে যান" />
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
            <div className="mt-6 rounded-2xl bg-surface px-6 py-12 text-center">
              <SearchIcon className="mx-auto size-8 text-tertiary" />
              <p className="mt-3 text-[17px] font-semibold">কোনো পরীক্ষা পাওয়া যায়নি</p>
              <p className="mt-1 text-[15px] text-secondary">অন্য কোনো শব্দ দিয়ে খুঁজে দেখুন।</p>
            </div>
          ) : filtering ? (
            <section className="mt-6">
              <SectionHeader title={`${toBn(filtered.length)}টি ফলাফল`} />
              <ExamGroup exams={filtered} rowProps={rowProps} />
            </section>
          ) : (
            groupByMonth(filtered).map(([label, group]) => (
              <section key={label} className="mt-6">
                <SectionHeader title={label} detail={`${toBn(group.length)}টি`} />
                <ExamGroup exams={group} rowProps={rowProps} />
              </section>
            ))
          )}

          {!online && (
            <p className="mt-3 px-4 text-[13px] text-secondary">অফলাইনে শুধু আগে খোলা বা সংরক্ষণ করা পরীক্ষাগুলো খোলা যাবে। সব একসাথে সংরক্ষণ করতে সেটিংসে যান।</p>
          )}
        </>
      )}
    </main>
  );
}

// ---- Header

const noopSubscribe = () => () => {};
const todayLabel = () => new Intl.DateTimeFormat("bn-BD", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

// iOS "Today"-style header: the date above a large title. The date is read only on the client.
function HomeHeader() {
  const today = useSyncExternalStore(noopSubscribe, todayLabel, () => null);
  return (
    <header className="pb-3">
      <p className="h-5 text-[13px] font-semibold text-secondary">{today}</p>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[34px] leading-tight font-bold tracking-tight">প্রস্তুতি</h1>
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
    <section className="mt-5 rounded-2xl bg-surface p-4" aria-label="আপনার অগ্রগতি">
      <div className="flex items-center gap-4">
        <Ring value={answered} total={total} size={76} stroke={8}>
          <span className="text-[17px] font-bold">{toBn(pct)}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold">আপনার অগ্রগতি</h2>
          <p className="mt-0.5 text-[15px] leading-snug text-secondary">
            {answered > 0
              ? `${toBn(total)}টি প্রশ্নের মধ্যে ${toBn(answered)}টির উত্তর দিয়েছেন`
              : `${toBn(exams.length)}টি পরীক্ষায় ${toBn(total)}টি প্রশ্ন। যেকোনো একটি দিয়ে শুরু করুন।`}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 rounded-xl bg-fill py-2.5 text-center">
        <SummaryStat label="শুরু করেছেন" value={started} />
        <SummaryStat label="সম্পন্ন" value={completed} divider />
        <SummaryStat label="অফলাইনে" value={savedCount} divider />
      </dl>
    </section>
  );
}

function SummaryStat({ label, value, divider = false }: { label: string; value: number; divider?: boolean }) {
  return (
    <div className={`flex flex-col-reverse ${divider ? "border-l-[0.5px] border-separator" : ""}`}>
      <dt className="text-[13px] text-secondary">{label}</dt>
      <dd className="text-[20px] leading-tight font-semibold">{toBn(value)}</dd>
    </div>
  );
}

// Activity-style progress ring: a fill-coloured track with a tint arc.
function Ring({ value, total, size, stroke, children }: { value: number; total: number; size: number; stroke: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? Math.min(1, value / total) : 0;
  return (
    <span className="relative grid shrink-0 place-items-center text-tint" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-fill" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="relative text-label">{children}</span>
    </span>
  );
}

// ---- Continue

type RowProps = { exam: ExamListItem; progress?: Progress; saved: boolean; unavailable: boolean };

function ContinueCard({ exam, progress, unavailable }: RowProps) {
  const info = exam.exam_info;
  const answered = progress?.answered ?? 0;
  const pct = info.total_questions ? Math.round((answered / info.total_questions) * 100) : 0;

  return (
    <AppLink
      href={`/exams/${exam.slug}`}
      className={`relative flex h-full min-h-36 flex-col overflow-hidden rounded-2xl bg-linear-to-br p-4 text-white transition-transform active:scale-[0.98] ${coverFor(
        info.organization,
      )} ${unavailable ? "opacity-40" : ""}`}
    >
      <span aria-hidden="true" className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-white/10" />
      <p className="relative truncate text-[12px] font-medium text-white/80">{info.organization}</p>
      <p className="relative mt-0.5 line-clamp-2 text-[17px] leading-snug font-bold">{info.exam_title}</p>
      <div className="relative mt-auto pt-3">
        <div className="flex items-center justify-between text-[12px] font-semibold">
          <span>
            {toBn(answered)}/{toBn(info.total_questions)} উত্তর
          </span>
          <span>{toBn(pct)}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </AppLink>
  );
}

// ---- List

function ExamGroup({ exams, rowProps }: { exams: ExamListItem[]; rowProps: (exam: ExamListItem) => RowProps }) {
  return (
    <ul className="overflow-hidden rounded-2xl bg-surface">
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
  const answered = progress?.answered ?? 0;
  const done = info.total_questions > 0 && answered >= info.total_questions;

  return (
    <AppLink
      href={`/exams/${exam.slug}`}
      className={`flex items-center gap-3 pl-4 transition-colors active:bg-fill-strong ${unavailable ? "opacity-40" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br text-[17px] font-bold text-white ${coverFor(info.organization)}`}
      >
        {initial(info.organization)}
      </span>
      <div className={`flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 ${last ? "" : "hairline-b"}`}>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[16px] leading-snug font-semibold">{info.exam_title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-secondary">
            <span className="truncate">
              {toBn(info.total_questions)}টি প্রশ্ন · {formatExamDate(info.exam_date)}
            </span>
            {saved && (
              <span className="inline-flex shrink-0 items-center text-ios-green">
                <CircleCheckIcon className="size-3.5" />
                <span className="sr-only">অফলাইনে আছে</span>
              </span>
            )}
          </p>
        </div>
        {done ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ios-green text-white dark:text-black">
            <CheckIcon className="size-4 stroke-3" />
            <span className="sr-only">সম্পন্ন</span>
          </span>
        ) : answered > 0 ? (
          <Ring value={answered} total={info.total_questions} size={28} stroke={3.5}>
            <span className="sr-only">
              {toBn(answered)}/{toBn(info.total_questions)} উত্তর দেওয়া
            </span>
          </Ring>
        ) : (
          <ChevronRightIcon className="size-5 shrink-0 stroke-[2.5] text-tertiary" />
        )}
      </div>
    </AppLink>
  );
}

// First letter of the organisation, keeping Bengali vowel signs attached ("যুব" -> "যু").
function initial(text: string) {
  const trimmed = text.trim();
  if (typeof Intl.Segmenter === "function") {
    const first = new Intl.Segmenter("bn", { granularity: "grapheme" }).segment(trimmed)[Symbol.iterator]().next().value;
    if (first) return first.segment;
  }
  return Array.from(trimmed)[0] ?? "";
}

const MONTH_FORMAT = new Intl.DateTimeFormat("bn-BD", { month: "long", year: "numeric", timeZone: "UTC" });

// The API already sorts newest first, so groups come out in date order.
function groupByMonth(exams: ExamListItem[]): [string, ExamListItem[]][] {
  const groups = new Map<string, ExamListItem[]>();
  for (const exam of exams) {
    const date = parseExamDate(exam.exam_info.exam_date);
    const label = date ? MONTH_FORMAT.format(date) : "অন্যান্য";
    groups.set(label, [...(groups.get(label) ?? []), exam]);
  }
  return [...groups.entries()];
}

// ---- Shared with Reels

export function SearchField({
  value,
  onChange,
  placeholder = "পরীক্ষা বা প্রতিষ্ঠান খুঁজুন",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex h-10 items-center gap-1.5 rounded-[10px] bg-fill px-2">
      <SearchIcon className="size-4.5 shrink-0 text-secondary" />
      {/* 17px keeps iOS Safari from zooming in when the field is focused. */}
      <input
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="লোড হচ্ছে">
      <Skeleton className="mt-5 h-43 rounded-2xl" />
      <Skeleton className="mt-7 mb-2 ml-1 h-5 w-28" />
      <div className="overflow-hidden rounded-2xl bg-surface">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 pl-4">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className={`flex-1 py-3.5 pr-4 ${i < 4 ? "hairline-b" : ""}`}>
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
