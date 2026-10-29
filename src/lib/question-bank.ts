"use client";

import { useCallback, useEffect, useState } from "react";
import { type BankQuestion, type BankSummary, buildBank, draw, summarise } from "./bank";
import type { ExamDetailResponse, ExamListResponse } from "./types";
import { EXAM_LIST_URL, fetchApi } from "./use-api";

// Where the mock exam's questions come from. Online, the server holds the bank: setup loads only a summary
// (/api/questions) and starting an exam downloads just the questions drawn (/api/questions/random).
// When the server can't be reached, the bank is built here from the exams the service worker has saved,
// which is slower but works offline.

export type DrawRequest = { count: number; subjects: string[] };

export type PoolState =
  | { status: "loading"; loaded: number; total: number }
  | { status: "error"; offline: boolean }
  | {
      status: "ready";
      summary: BankSummary;
      /** Offline, some exams were not saved, so the pool is smaller than usual. */
      partial: { loaded: number; total: number } | null;
      /** Random questions for a new exam; null when none could be loaded. */
      draw: (request: DrawRequest) => Promise<BankQuestion[] | null>;
    };

type SummaryResponse = BankSummary & { status: "success" };
type LocalBank = { bank: BankQuestion[]; loaded: number; total: number };

const CONCURRENCY = 4;

/** Every exam through the shared API cache (and the service worker's saved copies), built into a bank here. */
async function loadLocalBank(onProgress?: (loaded: number, total: number) => void): Promise<LocalBank | null> {
  const list = await fetchApi<ExamListResponse>(EXAM_LIST_URL);
  if (!list.ok) return null;

  const exams = list.data.exams;
  const details: (ExamDetailResponse | null)[] = new Array(exams.length).fill(null);
  let next = 0;
  let loaded = 0;
  onProgress?.(0, exams.length);

  const worker = async () => {
    while (next < exams.length) {
      const i = next++;
      const result = await fetchApi<ExamDetailResponse>(`/api/exams/${encodeURIComponent(exams[i].slug)}`);
      details[i] = result.ok ? result.data : null;
      onProgress?.(++loaded, exams.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, exams.length) }, worker));

  const available = exams.flatMap((e, i) => {
    const d = details[i];
    return d ? [{ slug: e.slug, title: d.exam_info.exam_title, questions: d.questions }] : [];
  });
  if (available.length === 0) return null;
  return { bank: buildBank(available), loaded: available.length, total: exams.length };
}

async function drawFromServer({ count, subjects }: DrawRequest): Promise<BankQuestion[] | null> {
  const params = new URLSearchParams({ count: String(count) });
  for (const s of subjects) params.append("subject", s);
  try {
    const res = await fetch(`/api/questions/random?${params}`, { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { questions?: BankQuestion[] } | null;
    if (res.ok && body?.questions) return body.questions;
  } catch {
    // Offline since setup loaded; fall through to the saved exams.
  }
  const local = await loadLocalBank();
  return local ? draw(local.bank, count, subjects) : null;
}

export function useQuestionPool() {
  const [state, setState] = useState<PoolState>({ status: "loading", loaded: 0, total: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const summary = await fetchApi<SummaryResponse>("/api/questions", { force: attempt > 0 });
      if (cancelled) return;
      if (summary.ok) {
        const { total, subjects } = summary.data;
        setState({ status: "ready", summary: { total, subjects }, partial: null, draw: drawFromServer });
        return;
      }

      const local = await loadLocalBank((loaded, total) => {
        if (!cancelled) setState({ status: "loading", loaded, total });
      });
      if (cancelled) return;
      if (!local) {
        setState({ status: "error", offline: !navigator.onLine });
        return;
      }
      setState({
        status: "ready",
        summary: summarise(local.bank),
        partial: local.loaded < local.total ? { loaded: local.loaded, total: local.total } : null,
        draw: async ({ count, subjects }) => draw(local.bank, count, subjects),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading", loaded: 0, total: 0 });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
