"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { useDailyTargetState, type DailyTargetConfig } from "@/lib/daily-target";
import { AppLink } from "@/components/AppLink";
import { FlameIcon, GearIcon, PlayIcon, TargetIcon, TimerIcon } from "@/components/icons";
import { Ring } from "@/components/Ring";
import { DailyTargetSetup } from "./DailyTargetSetup";

export function DailyTargetHero({ className = "" }: { className?: string }) {
  const { activeConfig, session, streak } = useDailyTargetState();
  const [setupOpen, setSetupOpen] = useState(false);

  // If no target is configured yet
  if (!activeConfig) {
    return (
      <>
        <div
          className={`relative overflow-hidden rounded-2xl border border-tint/20 bg-gradient-to-br from-tint/10 via-surface to-surface p-4 shadow-sm transition-transform active:scale-[0.99] sm:p-5 ${className}`}
        >
          <div className="flex items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-tint text-white shadow-md shadow-tint/25">
              <TargetIcon className="size-6 stroke-[2.2]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-tint/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-tint uppercase">
                  নতুন ফিচার
                </span>
                <span className="text-[12px] font-semibold text-secondary">দৈনিক পড়ার লক্ষ্য</span>
              </div>
              <h2 className="mt-1 text-[17px] font-bold text-label">
                আপনার দৈনিক টার্গেট নির্ধারণ করুন
              </h2>
              <p className="mt-0.5 text-[13px] leading-relaxed text-secondary">
                প্রতিদিন নির্দিষ্ট বিষয় ও টপিকের প্রশ্ন পড়ুন। পড়া প্রশ্ন আর আসবে না, প্রতিদিন পাবেন নতুন নতুন প্রশ্ন!
              </p>
              <div className="mt-3.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSetupOpen(true)}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-tint px-3.5 text-[13px] font-semibold text-white shadow transition-all hover:opacity-90 active:scale-95"
                >
                  <TargetIcon className="size-4" />
                  সেট করুন
                </button>
              </div>
            </div>
          </div>
        </div>

        <DailyTargetSetup open={setupOpen} onClose={() => setSetupOpen(false)} />
      </>
    );
  }

  // Active target is configured
  const total = session?.totalQuestions ?? activeConfig.dailyCount;
  const studied = session?.studiedKeys?.length ?? 0;
  const isDoneStudying = total > 0 && studied >= total;
  const hasTakenExam = session?.examScore !== null && session?.examScore !== undefined;
  const percent = total > 0 ? Math.round((studied / total) * 100) : 0;

  return (
    <>
      <section
        aria-label="Daily Study Target"
        className={`relative overflow-hidden rounded-2xl border border-separator/80 bg-surface/80 p-4 shadow-sm backdrop-blur-md transition-all sm:p-5 dark:border-white/10 ${className}`}
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 border-b border-separator/40 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-tint/12 text-tint">
              <TargetIcon className="size-4 stroke-[2.4]" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[14px] font-bold text-label">
                  {activeConfig.subjectName}
                </p>
                {activeConfig.topicName && (
                  <span className="truncate text-[12px] text-secondary">
                    · {activeConfig.topicName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {streak.current > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                <FlameIcon className="size-3.5 text-orange-500" />
                {formatNumber(streak.current)} দিন
              </span>
            )}
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              aria-label="Configure Target"
              className="grid size-8 place-items-center rounded-full text-secondary hover:bg-fill active:bg-fill-strong"
            >
              <GearIcon className="size-4 stroke-2" />
            </button>
          </div>
        </div>

        {/* Middle Progress Row */}
        <div className="mt-3.5 flex items-center gap-3.5">
          <Ring value={studied} total={total} size={52} stroke={5} className="text-tint">
            <span className="text-[13px] font-bold tabular-nums">{formatNumber(percent)}%</span>
          </Ring>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13px] font-semibold text-secondary">
                আজকের লক্ষ্য
              </span>
              <span className="text-[13px] font-bold text-label tabular-nums">
                {formatNumber(studied)} / {formatNumber(total)}টি প্রশ্ন
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              {hasTakenExam ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-ios-green">
                  🏆 পরীক্ষায় স্কোর: {formatNumber(session?.examScore ?? 0)}/{formatNumber(total)}
                </span>
              ) : isDoneStudying ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-600 dark:text-amber-400">
                  🎉 পড়া সম্পন্ন · পরীক্ষা দিন
                </span>
              ) : (
                <span className="text-[12px] font-medium text-secondary">
                  বাকি {formatNumber(Math.max(0, total - studied))}টি প্রশ্ন
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-3.5 flex items-center gap-2 pt-1 border-t border-separator/40">
          <AppLink
            href="/target"
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-tint px-3 text-[13px] font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
          >
            <PlayIcon className="size-3.5 fill-current" />
            {isDoneStudying ? "রিভিশন" : "পড়ুন"}
          </AppLink>

          <AppLink
            href="/target?tab=exam"
            className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition-transform active:scale-[0.98] ${isDoneStudying
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-sm"
                : "border-separator bg-surface text-secondary hover:bg-fill"
              }`}
          >
            <TimerIcon className="size-3.5 stroke-[2.2]" />
            পরীক্ষা
          </AppLink>
        </div>
      </section>

      <DailyTargetSetup
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        editingConfig={activeConfig}
      />
    </>
  );
}

