"use client";

import { useCallback, useState } from "react";
import { formatNumber } from "@/lib/format";
import {
  type MockConfig,
  type MockResult,
  type MockSession,
  addToHistory,
  clearHistory,
  loadConfig,
  loadHistory,
  loadSession,
  saveSession,
} from "@/lib/mock-exam";
import { useQuestionPool } from "@/lib/question-bank";
import { PageTitle } from "../PageTitle";
import { ErrorState, Skeleton } from "../StatusViews";
import { MockResultView } from "./MockResultView";
import { MockRunner } from "./MockRunner";
import { MockSetup } from "./MockSetup";

type Finished = { result: MockResult; session: MockSession };

// The Exam tab: set up → run → result. An exam in progress is saved after every step, so closing
// the app or locking the phone does not lose it; it resumes on the question it was on.
export function MockExam() {
  const { state, retry } = useQuestionPool();

  const [session, setSession] = useState<MockSession | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [history, setHistory] = useState<MockResult[]>([]);
  const [starting, setStarting] = useState(false);

  // Once the pool has loaded or failed, pick up remembered history and any exam left in progress (adjusting
  // state during render). A saved exam carries its own questions, so it resumes even when the pool failed.
  const [restored, setRestored] = useState(false);
  if (!restored && state.status !== "loading") {
    setRestored(true);
    setHistory(loadHistory());
    // If the question showing when the app closed ran out of time, the runner sees the expired timer
    // straight away and moves on (or finishes) the usual way.
    const saved = loadSession();
    if (saved) setSession(saved);
    else saveSession(null);
  }

  const finish = useCallback((s: MockSession) => {
    let correct = 0;
    let skipped = 0;
    s.answers.forEach((a, i) => {
      if (a === null) skipped++;
      else if (a === s.questions[i].correct_answer) correct++;
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
    if (state.status !== "ready" || starting) return;
    setStarting(true);
    const questions = await state.draw({ count: config.count, subjects: config.subjects });
    setStarting(false);
    if (!questions?.length) {
      window.alert("Couldn't load questions for the exam. Check your connection and try again.");
      return;
    }
    // The clock starts once the questions have arrived.
    const now = Date.now();
    const next: MockSession = {
      config,
      questions,
      answers: questions.map(() => null),
      index: 0,
      deadline: now + config.seconds * 1000,
      startedAt: now,
    };
    saveSession(next);
    setFinished(null);
    setSession(next);
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

  // ---- Views

  // Before the pool checks: an exam in progress runs from its own saved questions.
  if (session) {
    return <MockRunner session={session} question={session.questions[session.index]} onSelect={select} onNext={next} onQuit={quit} />;
  }

  if (finished) {
    return (
      <MockResultView
        result={finished.result}
        session={finished.session}
        questions={finished.session.questions}
        onRetry={() => void start(finished.session.config)}
        onDone={() => setFinished(null)}
      />
    );
  }

  if (state.status === "loading") {
    return (
      <main className="px-safe mx-auto w-full max-w-3xl flex-1 pt-[max(1.25rem,env(safe-area-inset-top))]" aria-busy="true">
        <PageTitle
          title="Exam"
          subtitle={state.total ? `Gathering questions… ${formatNumber(state.loaded)} of ${formatNumber(state.total)} exams` : "Gathering questions…"}
        />
        <Skeleton className="mt-2 h-40 rounded-2xl" />
        <Skeleton className="mt-7 h-14 rounded-2xl" />
        <Skeleton className="mt-7 h-14 rounded-2xl" />
        <Skeleton className="mt-7 h-64 rounded-2xl" />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="px-safe flex-1 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {state.offline ? (
          <ErrorState
            offline
            title="No internet connection"
            message="No exams are saved on this device yet. Connect once, or save exams for offline use in Settings."
            onRetry={retry}
          />
        ) : (
          <ErrorState title="Couldn't load questions" message="Something went wrong on the server. Please try again shortly." onRetry={retry} />
        )}
      </main>
    );
  }

  return (
    <MockSetup
      summary={state.summary}
      initial={loadConfig()}
      history={history}
      partial={state.partial}
      starting={starting}
      onStart={(config) => void start(config)}
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
