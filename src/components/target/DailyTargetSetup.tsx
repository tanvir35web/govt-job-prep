"use client";

import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";
import {
  type DailyTargetConfig,
  upsertTargetConfig,
} from "@/lib/daily-target";
import type { DailyTargetMetaSubject } from "@/app/api/daily-target/meta/route";
import { useApi } from "@/lib/use-api";
import { Sheet } from "@/components/Sheet";
import { CheckIcon, ResetIcon } from "@/components/icons";

const QUESTION_COUNTS = [15, 20, 30, 50] as const;

const TIMERS = [
  { value: 0, label: "বন্ধ" },
  { value: 30, label: "৩০ সে." },
  { value: 45, label: "৪৫ সে." },
  { value: 60, label: "৬০ সে." },
] as const;

type MetaResponse = {
  status: "success";
  code: number;
  message: string;
  subjects: DailyTargetMetaSubject[];
};

export function DailyTargetSetup({
  open,
  onClose,
  editingConfig,
  onSaved,
  onResetTopic,
  completedInTopic,
  totalInTopic,
}: {
  open: boolean;
  onClose: () => void;
  editingConfig?: DailyTargetConfig | null;
  onSaved?: (saved: DailyTargetConfig) => void;
  onResetTopic?: () => void;
  completedInTopic?: number;
  totalInTopic?: number;
}) {
  if (!open) return null;

  return (
    <DailyTargetSetupInner
      key={editingConfig?.id ?? "new"}
      onClose={onClose}
      editingConfig={editingConfig}
      onSaved={onSaved}
      onResetTopic={onResetTopic}
      completedInTopic={completedInTopic}
      totalInTopic={totalInTopic}
    />
  );
}

function DailyTargetSetupInner({
  onClose,
  editingConfig,
  onSaved,
  onResetTopic,
  completedInTopic,
  totalInTopic,
}: {
  onClose: () => void;
  editingConfig?: DailyTargetConfig | null;
  onSaved?: (saved: DailyTargetConfig) => void;
  onResetTopic?: () => void;
  completedInTopic?: number;
  totalInTopic?: number;
}) {
  const { state: metaState } = useApi<MetaResponse>("/api/daily-target/meta");
  const subjects = useMemo(
    () => (metaState.status === "success" ? metaState.data.subjects : []),
    [metaState],
  );

  const [selectedSubjectId, setSelectedSubjectId] = useState(
    () => editingConfig?.subjectId ?? ""
  );
  const [selectedTopic, setSelectedTopic] = useState(
    () => editingConfig?.topicName ?? ""
  );
  const [dailyCount, setDailyCount] = useState(
    () => editingConfig?.dailyCount ?? 20
  );
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(
    () => editingConfig?.secondsPerQuestion ?? 45
  );

  // Active subject resolution
  const activeSubjectId = selectedSubjectId || (subjects[0]?.id ?? "");
  const currentSubject = subjects.find((s) => s.id === activeSubjectId) ?? subjects[0];
  const topicsList = currentSubject?.topics ?? [];

  const handleSubjectChange = (newSubjId: string) => {
    setSelectedSubjectId(newSubjId);
    setSelectedTopic("");
  };

  const handleSave = () => {
    if (!currentSubject) return;

    const saved = upsertTargetConfig({
      id: editingConfig?.id,
      subjectId: currentSubject.id,
      subjectName: currentSubject.name,
      topicName: selectedTopic,
      dailyCount,
      secondsPerQuestion,
    });

    onSaved?.(saved);
    onClose();
  };

  return (
    <Sheet onClose={onClose} title="টার্গেট কনফিগার">
      <div className="space-y-4 pt-1 pb-4">
        {/* Subject Selection */}
        <div>
          <label className="block text-[13px] font-semibold text-secondary">
            বিষয়
          </label>
          <div className="mt-1.5">
            {metaState.status === "loading" ? (
              <div className="h-11 rounded-xl bg-fill animate-pulse" />
            ) : subjects.length === 0 ? (
              <p className="text-[13px] text-tertiary">কোনো বিষয় পাওয়া যায়নি।</p>
            ) : (
              <select
                value={activeSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full rounded-xl border border-separator bg-surface px-3.5 py-2.5 text-[15px] font-medium text-label focus:border-tint focus:outline-none"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatNumber(s.total_questions)}টি প্রশ্ন)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Topic Selection - only show if subject has topics */}
        {topicsList.length > 0 && (
          <div>
            <label className="block text-[13px] font-semibold text-secondary">
              টপিক
            </label>
            <div className="mt-1.5">
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full rounded-xl border border-separator bg-surface px-3.5 py-2.5 text-[15px] font-medium text-label focus:border-tint focus:outline-none"
              >
                <option value="">
                  সব টপিক ({currentSubject ? formatNumber(currentSubject.total_questions) : 0}টি প্রশ্ন)
                </option>
                {topicsList.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({formatNumber(t.total_questions)}টি প্রশ্ন)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Daily Questions Count - Clean single row of 4 */}
        <div>
          <label className="block text-[13px] font-semibold text-secondary">
            প্রতিদিনের প্রশ্ন
          </label>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {QUESTION_COUNTS.map((count) => {
              const active = dailyCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setDailyCount(count)}
                  className={`flex h-10 items-center justify-center rounded-xl border text-[14px] font-semibold transition-all ${
                    active
                      ? "border-tint bg-tint text-white shadow-xs"
                      : "border-separator bg-surface text-label hover:bg-fill active:scale-95"
                  }`}
                >
                  {formatNumber(count)}টি
                </button>
              );
            })}
          </div>
        </div>

        {/* Timer Setting - Clean single row of 4 */}
        <div>
          <label className="block text-[13px] font-semibold text-secondary">
            টাইমার (প্রতি প্রশ্ন)
          </label>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {TIMERS.map((t) => {
              const active = secondsPerQuestion === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSecondsPerQuestion(t.value)}
                  className={`flex h-10 items-center justify-center rounded-xl border text-[13px] font-medium transition-all ${
                    active
                      ? "border-tint bg-tint/10 font-bold text-tint shadow-xs"
                      : "border-separator bg-surface text-secondary hover:bg-fill active:scale-95"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Topic Reset Option */}
        {onResetTopic && totalInTopic !== undefined && completedInTopic !== undefined && (
          <div className="flex items-center justify-between rounded-xl border border-separator/60 bg-fill/40 px-3.5 py-2.5 text-[12.5px]">
            <span className="text-secondary">
              পড়া সম্পন্ন: <strong className="font-semibold text-label">{formatNumber(completedInTopic)}</strong> / {formatNumber(totalInTopic)}টি
            </span>
            <button
              type="button"
              onClick={() => {
                onResetTopic();
                onClose();
              }}
              className="inline-flex items-center gap-1 font-semibold text-ios-red hover:underline"
            >
              <ResetIcon className="size-3" />
              রিসেট
            </button>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!currentSubject}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-tint text-[15px] font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <CheckIcon className="size-4.5 stroke-[2.5]" />
            সংরক্ষণ করুন
          </button>
        </div>
      </div>
    </Sheet>
  );
}
