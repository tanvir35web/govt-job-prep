"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExamDetailResponse, ExamListResponse, Question } from "./types";

// Every question from every exam, gathered on the client from the existing exam endpoints.
// The service worker caches those responses, so exams opened or saved before still load offline.

export type BankQuestion = Question & { slug: string; examTitle: string; key: string };

export type BankState =
  | { status: "loading"; loaded: number; total: number }
  | { status: "error"; offline: boolean }
  | { status: "ready"; questions: BankQuestion[]; examsLoaded: number; examsTotal: number };

const CONCURRENCY = 4;

export function bankKey(slug: string, questionNo: number) {
  return `${slug}#${questionNo}`;
}

// The same question often appears in several papers; compare text without spacing or punctuation differences.
function fingerprint(q: Question) {
  return q.question.toLowerCase().replace(/[\s\p{P}]+/gu, "");
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useQuestionBank() {
  const [state, setState] = useState<BankState>({ status: "loading", loaded: 0, total: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const list = await fetchJson<ExamListResponse>("/api/exams?limit=100");
      if (cancelled) return;
      if (!list) {
        setState({ status: "error", offline: !navigator.onLine });
        return;
      }

      const exams = list.exams;
      const details: (ExamDetailResponse | null)[] = new Array(exams.length).fill(null);
      let next = 0;
      let loaded = 0;
      setState({ status: "loading", loaded: 0, total: exams.length });

      const worker = async () => {
        while (next < exams.length && !cancelled) {
          const i = next++;
          details[i] = await fetchJson<ExamDetailResponse>(`/api/exams/${encodeURIComponent(exams[i].slug)}`);
          loaded++;
          if (!cancelled) setState({ status: "loading", loaded, total: exams.length });
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, exams.length) }, worker));
      if (cancelled) return;

      const seen = new Set<string>();
      const questions: BankQuestion[] = [];
      details.forEach((detail, i) => {
        if (!detail) return;
        for (const q of detail.questions) {
          const fp = fingerprint(q);
          if (seen.has(fp)) continue;
          seen.add(fp);
          questions.push({ ...q, slug: exams[i].slug, examTitle: detail.exam_info.exam_title, key: bankKey(exams[i].slug, q.question_no) });
        }
      });

      const examsLoaded = details.filter(Boolean).length;
      setState(
        examsLoaded === 0
          ? { status: "error", offline: !navigator.onLine }
          : { status: "ready", questions, examsLoaded, examsTotal: exams.length },
      );
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
