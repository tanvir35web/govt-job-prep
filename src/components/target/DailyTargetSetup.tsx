"use client";

import { useEffect, useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";
import {
  COUNT_PRESETS,
  TIMER_PRESETS,
  type DailyTargetConfig,
  getActiveTargetConfig,
  loadTargetConfigs,
  upsertTargetConfig,
} from "@/lib/daily-target";
import type { DailyTargetMetaSubject } from "@/app/api/daily-target/meta/route";
import { useApi } from "@/lib/use-api";
import { CheckIcon, Sheet } from "@/components/Sheet";
import { TargetIcon, XIcon } from "@/components/icons";

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
}: {
  open: boolean;
  onClose: () => void;
  editingConfig?: DailyTargetConfig | null;
  onSaved?: (saved: DailyTargetConfig) => void;
}) {
  const { state: metaState } = useApi<MetaResponse>("/api/daily-target/meta");
  const subjects = useMemo(
    () => (metaState.status === "success" ? metaState.data.subjects : []),
    [metaState],
  );

  const initialSubject = editingConfig?.subjectId ?? (subjects[0]?.id ?? "");
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubject);
  const [selectedTopic, setSelectedTopic] = useState(editingConfig?.topicName ?? "");
  const [dailyCount, setDailyCount] = useState(editingConfig?.dailyCount ?? 30);
  const [customCount, setCustomCount] = useState(
    editingConfig && !COUNT_PRESETS.includes(editingConfig.dailyCount as never)
      ? String(editingConfig.dailyCount)
      : "",
  );
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(editingConfig?.secondsPerQuestion ?? 45);

  useEffect(() => {
    if (editingConfig) {
      setSelectedSubjectId(editingConfig.subjectId);
      setSelectedTopic(editingConfig.topicName);
      setDailyCount(editingConfig.dailyCount);
      setSecondsPerQuestion(editingConfig.secondsPerQuestion);
    } else if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [editingConfig, subjects, selectedSubjectId]);

  const currentSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) ?? subjects[0],
    [subjects, selectedSubjectId],
  );

  const topicsList = useMemo(() => currentSubject?.topics ?? [], [currentSubject]);

  const handleSubjectChange = (newSubjId: string) => {
    setSelectedSubjectId(newSubjId);
    setSelectedTopic(""); // reset topic when subject changes
  };

  const handleSave = () => {
    if (!currentSubject) return;

    const count = customCount ? Math.max(5, Math.min(100, Number.parseInt(customCount, 10) || 30)) : dailyCount;

    const saved = upsertTargetConfig({
      id: editingConfig?.id,
      subjectId: currentSubject.id,
      subjectName: currentSubject.name,
      topicName: selectedTopic,
      dailyCount: count,
      secondsPerQuestion,
    });

    onSaved?.(saved);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editingConfig ? "টার্গেট পরিবর্তন করুন" : "নতুন দৈনিক টার্গেট সেট করুন"}>
      <div className="space-y-6 pt-2 pb-6">
        {/* Subject Selection */}
        <div>
          <label className="block text-[14px] font-semibold text-label">
            ১. বিষয় নির্বাচন করুন (Subject)
          </label>
          <p className="mt-0.5 text-[12px] text-secondary">
            প্রতিদিন আপনি কোন বিষয়ে প্রশ্ন পড়তে চান?
          </p>
          <div className="mt-2.5">
            {metaState.status === "loading" ? (
              <div className="h-11 rounded-xl bg-fill animate-pulse" />
            ) : subjects.length === 0 ? (
              <p className="text-[13px] text-tertiary">কোনো বিষয় পাওয়া যায়নি।</p>
            ) : (
              <select
                value={selectedSubjectId}
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

        {/* Topic Selection */}
        <div>
          <label className="block text-[14px] font-semibold text-label">
            ২. টপিক নির্বাচন করুন (Topic)
          </label>
          <p className="mt-0.5 text-[12px] text-secondary">
            নির্দিষ্ট টপিক পড়তে পারেন অথবা সম্পূর্ণ বিষয়ের সব টপিক একসাথে।
          </p>
          <div className="mt-2.5">
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

        {/* Daily Questions Count */}
        <div>
          <label className="block text-[14px] font-semibold text-label">
            ৩. প্রতিদিন কয়টি করে প্রশ্ন পড়বেন?
          </label>
          <p className="mt-0.5 text-[12px] text-secondary">
            পড়া শেষ হলে প্রশ্নগুলো স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে এবং পরের দিন নতুন প্রশ্ন আসবে।
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {COUNT_PRESETS.map((count) => {
              const active = !customCount && dailyCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    setDailyCount(count);
                    setCustomCount("");
                  }}
                  className={`flex h-11 items-center justify-center rounded-xl border text-[15px] font-semibold transition-all ${
                    active
                      ? "border-tint bg-tint text-white shadow-sm"
                      : "border-separator bg-surface text-label hover:bg-fill"
                  }`}
                >
                  {formatNumber(count)}টি
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[13px] text-secondary">অথবা কাস্টম সংখ্যা:</span>
            <input
              type="number"
              min={5}
              max={100}
              placeholder="যেমন: ২৫"
              value={customCount}
              onChange={(e) => setCustomCount(e.target.value)}
              className="w-24 rounded-lg border border-separator bg-surface px-2.5 py-1 text-[14px] font-medium text-label focus:border-tint focus:outline-none"
            />
          </div>
        </div>

        {/* Exam Timer Setting */}
        <div>
          <label className="block text-[14px] font-semibold text-label">
            ৪. টার্গেট পরীক্ষার টাইমার
          </label>
          <p className="mt-0.5 text-[12px] text-secondary">
            পড়া শেষ করে যখন পরীক্ষা দেবেন, তখন প্রতি প্রশ্নের জন্য সময়:
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {TIMER_PRESETS.map((t) => {
              const active = secondsPerQuestion === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSecondsPerQuestion(t.value)}
                  className={`flex h-11 items-center justify-center rounded-xl border px-3 text-[13px] font-medium transition-all ${
                    active
                      ? "border-tint bg-tint/10 font-semibold text-tint"
                      : "border-separator bg-surface text-secondary hover:bg-fill"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!currentSubject}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-tint text-[16px] font-semibold text-white shadow-md transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <TargetIcon className="size-5" />
            {editingConfig ? "পরিবর্তন সংরক্ষণ করুন" : "টার্গেট চালু করুন"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
