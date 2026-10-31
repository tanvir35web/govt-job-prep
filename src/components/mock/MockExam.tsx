"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  type MockConfig,
  type MockResult,
  type MockSession,
  addToHistory,
  buildMockExamApiUrl,
  clearHistory,
  loadConfig,
  loadHistory,
  loadSession,
  MARK_OPTIONS,
  saveSession,
  SECOND_OPTIONS,
} from "@/lib/mock-exam";
import type { MockExamResponse, MockMetaResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { PageTitle } from "../PageTitle";
import { ErrorState, Skeleton } from "../StatusViews";
import { MockResultView } from "./MockResultView";
import { MockRunner } from "./MockRunner";
import { MockSetup } from "./MockSetup";

type Finished = { result: MockResult; session: MockSession };

export function MockExamSkeleton() {
  return (
    <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))]" aria-busy="true">
      <PageTitle title="Exam" subtitle="Loading exam questions…" />
      <Skeleton className="mt-2 h-40 rounded-2xl" />
      <Skeleton className="mt-7 h-14 rounded-2xl" />
      <Skeleton className="mt-7 h-14 rounded-2xl" />
      <Skeleton className="mt-7 h-64 rounded-2xl" />
    </main>
  );
}

// The Exam tab: set up → run → result. An exam in progress is saved after every step, so closing
// the app or locking the phone does not lose it; it resumes on the question it was on.
export function MockExam() {
  const searchParams = useSearchParams();
  const { state: metaState, retry: retryMeta } = useApi<MockMetaResponse>("/api/mock-exam");

  const [session, setSession] = useState<MockSession | null>(loadSession);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [history, setHistory] = useState<MockResult[]>(loadHistory);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Parse any query params from the URL to initialize or prefill the config
  const initialConfig = useMemo(() => {
    const saved = loadConfig();
    const marksParam = searchParams.get("marks") ?? searchParams.get("count");
    const secondsParam = searchParams.get("seconds");
    const subjectsParam = searchParams.get("subjects") ?? searchParams.get("subject");

    const patch: Partial<MockConfig> = {};
    if (marksParam) {
      const num = Number.parseInt(marksParam, 10);
      if (MARK_OPTIONS.includes(num as never)) patch.count = num;
    }
    if (secondsParam) {
      const sec = Number.parseInt(secondsParam, 10);
      if (SECOND_OPTIONS.includes(sec as never)) patch.seconds = sec;
    }
    if (subjectsParam) {
      patch.subjects = subjectsParam.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return { ...saved, ...patch };
  }, [searchParams]);

  const finish = useCallback((s: MockSession) => {
    const questions = s.questions;
    let correct = 0;
    let skipped = 0;
    s.answers.forEach((a, i) => {
      if (a === null) skipped++;
      else if (a === questions[i].correct_answer) correct++;
    });
    const result: MockResult = {
      finishedAt: Date.now(),
      durationMs: Date.now() - s.startedAt,
      config: s.config,
      total: s.questions.length,
      correct,
      wrong: s.questions.length - correct - skipped,
      skipped,
    };
    addToHistory(result);
    setHistory(loadHistory());
    saveSession(null);
    setSession(null);
    setFinished({ result, session: s });
    window.scrollTo({ top: 0 });
  }, []);

  const start = async (config: MockConfig) => {
    setStarting(true);
    setStartError(null);

    try {
      const url = buildMockExamApiUrl(config);
      const res = await fetch(url);
      const body = (await res.json().catch(() => null)) as MockExamResponse | null;

      if (!res.ok || body?.status !== "success" || !body.questions || body.questions.length === 0) {
        setStartError(body?.message ?? "No questions available for the selected subjects.");
        setStarting(false);
        return;
      }

      const now = Date.now();
      const nextSession: MockSession = {
        config,
        questions: body.questions,
        answers: body.questions.map(() => null),
        index: 0,
        deadline: now + config.seconds * 1000,
        startedAt: now,
      };

      saveSession(nextSession);
      setFinished(null);
      setSession(nextSession);
    } catch {
      setStartError("Failed to reach server. Please check your internet connection.");
    } finally {
      setStarting(false);
    }
  };

  const select = useCallback((option: string) => {
    setSession((s) => {
      if (!s) return s;
      const next = { ...s, answers: s.answers.map((a, i) => (i === s.index ? option : a)) };
      saveSession(next);
      return next;
    });
  }, []);

  const next = useCallback(() => {
    if (!session) return;
    if (session.index === session.questions.length - 1) return finish(session);
    const advanced = stepForward(session);
    saveSession(advanced);
    setSession(advanced);
  }, [session, finish]);

  const quit = () => {
    if (!window.confirm("Quit this exam? Your answers so far will not be scored.")) return;
    saveSession(null);
    setSession(null);
  };

  // ---- Active session in progress (renders instantly without loading)
  if (session) {
    const question = session.questions[session.index];
    return <MockRunner session={session} question={question} onSelect={select} onNext={next} onQuit={quit} />;
  }

  // ---- Finished results view
  if (finished) {
    return (
      <MockResultView
        result={finished.result}
        session={finished.session}
        questions={finished.session.questions}
        onRetry={() => start(finished.session.config)}
        onDone={() => setFinished(null)}
      />
    );
  }

  // ---- Loading metadata from backend
  if (metaState.status === "loading") {
    return <MockExamSkeleton />;
  }

  // ---- Error loading metadata
  if (metaState.status === "error") {
    return (
      <main className="px-safe flex-1 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {metaState.code === 0 ? (
          <ErrorState
            offline
            title="No internet connection"
            message="No exams are available offline yet. Connect once to the internet to load exam topics."
            onRetry={retryMeta}
          />
        ) : (
          <ErrorState title="Couldn't load subjects" message="Something went wrong on the server. Please try again shortly." onRetry={retryMeta} />
        )}
      </main>
    );
  }

  // ---- Setup view
  return (
    <MockSetup
      subjects={metaState.data.subjects}
      totalQuestions={metaState.data.total_questions}
      initial={initialConfig}
      history={history}
      starting={starting}
      error={startError}
      onStart={start}
      onClearHistory={() => {
        clearHistory();
        setHistory([]);
      }}
    />
  );
}

/** Moves to the next question with a fresh timer. Callers check that this is not the last question. */
function stepForward(s: MockSession): MockSession {
  return { ...s, index: s.index + 1, deadline: Date.now() + s.config.seconds * 1000 };
}
