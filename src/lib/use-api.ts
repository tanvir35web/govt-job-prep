"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

type ApiState<T> =
  | { status: "loading" }
  | { status: "error"; code: number; message: string }
  | { status: "success"; data: T };

type ApiResult<T> = { ok: true; data: T } | { ok: false; code: number; message: string };

/** The exam list, used by Home, Progress, Reels, Settings, the mock exam and the admin panel. One URL, so one shared cache entry. */
export const EXAM_LIST_URL = "/api/exams?limit=500";

// In-memory cache shared by every screen for the life of the tab, so moving between tabs shows data at once
// and the same URL is never requested twice at the same time. Responses younger than FRESH_MS are reused as
// they are; older ones are shown straight away and refreshed in the background. Errors are never cached.
// Offline copies are the service worker's job; this only saves repeat requests while the app is open.
const FRESH_MS = 60_000;
const MAX_ENTRIES = 40;

type Entry = { data: unknown; time: number };
const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<ApiResult<unknown>>>();

const listeners = new Set<() => void>();

function subscribeCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function remember(url: string, data: unknown) {
  cache.delete(url); // re-insert so the Map's order stays least recently used first
  cache.set(url, { data, time: Date.now() });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  for (const listener of listeners) listener();
}

/** The cached response for url, if any, however old. */
export function peekApi<T>(url: string): T | undefined {
  return cache.get(url)?.data as T | undefined;
}

/**
 * GETs an app API endpoint through the shared cache. Concurrent calls for one URL share a request.
 * force skips a fresh cached copy, for retries and after the admin panel changes data.
 */
export function fetchApi<T>(url: string, { force = false }: { force?: boolean } = {}): Promise<ApiResult<T>> {
  const hit = cache.get(url);
  if (!force && hit && Date.now() - hit.time < FRESH_MS) return Promise.resolve({ ok: true, data: hit.data as T });

  const pending = inFlight.get(url);
  if (pending) return pending as Promise<ApiResult<T>>;

  const request = (async (): Promise<ApiResult<unknown>> => {
    try {
      const res = await fetch(url);
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.status !== "success") {
        return { ok: false, code: res.status, message: body?.message ?? `Request failed (${res.status})` };
      }
      remember(url, body);
      return { ok: true, data: body };
    } catch (err) {
      return { ok: false, code: 0, message: err instanceof Error ? err.message : "Network error" };
    } finally {
      inFlight.delete(url);
    }
  })();
  inFlight.set(url, request);
  return request as Promise<ApiResult<T>>;
}

export function useApi<T>(url: string) {
  // The server snapshot is "nothing cached", so the server HTML and hydration agree; a cached copy shows right after.
  const cached = useSyncExternalStore(subscribeCache, () => peekApi<T>(url), () => undefined);
  const [failure, setFailure] = useState<{ url: string; code: number; message: string } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchApi<T>(url, { force: attempt > 0 }).then((result) => {
      if (cancelled) return;
      setFailure(result.ok ? null : { url, code: result.code, message: result.message });
      setRetrying(false);
    });
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  const retry = useCallback(() => {
    setFailure(null);
    setRetrying(true);
    setAttempt((n) => n + 1);
  }, []);

  // Memoised so screens that key effects or memos on state don't re-run them every render.
  // A failed background refresh keeps the copy already on screen.
  const state = useMemo<ApiState<T>>(() => {
    if (retrying) return { status: "loading" };
    if (cached !== undefined) return { status: "success", data: cached };
    if (failure?.url === url) return { status: "error", code: failure.code, message: failure.message };
    return { status: "loading" };
  }, [retrying, cached, failure, url]);

  return { state, retry };
}
