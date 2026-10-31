"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { useDailyTargetState } from "@/lib/daily-target";
import { AppLink } from "@/components/AppLink";
import {
  ArrowRightIcon,
  CheckIcon,
  FlameIcon,
  GearIcon,
  TargetIcon,
} from "@/components/icons";
import { DailyTargetSetup } from "./DailyTargetSetup";

export function DailyTargetHero({ className = "" }: { className?: string }) {
  const { activeConfig, session, streak } = useDailyTargetState();
  const [setupOpen, setSetupOpen] = useState(false);

  // If no target is configured yet
  if (!activeConfig) {
    return (
      <>
        <div
          className={`rounded-2xl border border-separator/80 bg-surface p-4.5 sm:p-5 shadow-xs transition-colors ${className}`}
        >
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tint/10 text-tint">
              <TargetIcon className="size-5 stroke-[2.2]" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] sm:text-[17px] font-bold text-label">
                প্রতিদিনের পড়ার লক্ষ্য নির্ধারণ করুন
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-secondary">
                নিয়মিত অল্প অল্প পড়াই দীর্ঘমেয়াদে সবচেয়ে ভালো প্রস্তুতি দেয়। আপনার পছন্দের বিষয় ও প্রশ্নসংখ্যা বেছে নিয়ে প্রতিদিনের পড়াশোনা গুছিয়ে রাখুন।
              </p>
              <div className="mt-3.5">
                <button
                  type="button"
                  onClick={() => setSetupOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-tint px-4 text-[13px] font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-95"
                >
                  লক্ষ্য সেট করুন
                  <ArrowRightIcon className="size-3.5" />
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
  const remaining = Math.max(0, total - studied);
  const percent = total > 0 ? Math.round((studied / total) * 100) : 0;

  return (
    <>
      <section
        aria-label="দৈনিক পড়ার লক্ষ্য"
        className={`rounded-2xl border border-separator/80 bg-surface p-4.5 sm:p-5 shadow-xs transition-colors ${className}`}
      >
        {/* Top Meta Line: Label, Streak & Settings */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-secondary">
            <TargetIcon className="size-3.5 text-tint stroke-[2.4]" />
            <span>আজকের পড়ার লক্ষ্য</span>
          </div>

          <div className="flex items-center gap-1.5">
            {streak.current > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                <FlameIcon className="size-3 text-orange-500" />
                {formatNumber(streak.current)} দিন
              </span>
            )}

            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              aria-label="টার্গেট পরিবর্তন বা রিসেট করুন"
              className="grid size-7 place-items-center rounded-lg text-tertiary hover:bg-fill hover:text-label transition-colors"
            >
              <GearIcon className="size-3.5 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* Subject & Topic Details */}
        <div className="mt-2.5">
          <h3 className="text-[17px] sm:text-[18px] font-bold text-label leading-snug">
            {activeConfig.subjectName}
          </h3>
          {activeConfig.topicName && (
            <p className="mt-0.5 text-[13px] text-secondary">
              টপিক: {activeConfig.topicName}
            </p>
          )}
        </div>

        {/* Sleek Horizontal Progress Bar */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-[12px] text-secondary">
            <span>
              {isDoneStudying ? (
                <span className="font-semibold text-ios-green flex items-center gap-1">
                  <CheckIcon className="size-3.5 stroke-[2.5]" />
                  সবগুলো প্রশ্ন পড়া শেষ
                </span>
              ) : studied > 0 ? (
                <span>
                  <strong className="font-bold text-label tabular-nums">
                    {formatNumber(studied)}
                  </strong>{" "}
                  / {formatNumber(total)}টি পড়া হয়েছে
                </span>
              ) : (
                <span>{formatNumber(total)}টি প্রশ্নের লক্ষ্য</span>
              )}
            </span>
            <span className="font-semibold tabular-nums text-label">
              {formatNumber(percent)}%
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-fill">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isDoneStudying ? "bg-ios-green" : "bg-tint"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Gentle Context / Motivational Note */}
        <div className="mt-2.5 text-[12.5px] leading-relaxed text-secondary">
          {hasTakenExam ? (
            <p className="font-medium text-ios-green">
              পরীক্ষায় স্কোর: {formatNumber(session?.examScore ?? 0)} / {formatNumber(total)}
            </p>
          ) : isDoneStudying ? (
            <p>
              সব প্রশ্ন পড়া হয়ে গেছে। প্রস্তুতি ঝালাই করতে টার্গেট পেজে গিয়ে একটি মূল্যায়ন পরীক্ষা দিতে পারেন।
            </p>
          ) : studied > 0 ? (
            <p>
              আর মাত্র {formatNumber(remaining)}টি প্রশ্ন বাকি আছে। একটু সময় দিলেই আজকের লক্ষ্য পূরণ হয়ে যাবে।
            </p>
          ) : (
            <p>
              আজকে এখনও পড়া শুরু করেননি। প্রতিদিনের ধারাবাহিকতা বজায় রাখতে এখনই পড়া শুরু করুন।
            </p>
          )}
        </div>

        {/* Single Clear Action Link */}
        <div className="mt-3.5 pt-3 border-t border-separator/40 flex items-center justify-between">
          <AppLink
            href="/target"
            className="flex items-center gap-1.5 text-[13px] font-bold text-tint hover:underline active:opacity-75"
          >
            <span>
              {hasTakenExam
                ? "টার্গেট দেখুন ও রিভিশন দিন"
                : isDoneStudying
                  ? "টার্গেট দেখুন ও পরীক্ষা দিন"
                  : studied > 0
                    ? "পড়া চালিয়ে যান"
                    : "পড়া শুরু করুন"}
            </span>
            <ArrowRightIcon className="size-3.5 stroke-[2.5]" />
          </AppLink>

          <span className="text-[11px] text-tertiary">
            প্রতিদিন নতুন প্রশ্ন
          </span>
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
