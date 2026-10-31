"use client";

import { useCallback, useEffect, useState } from "react";

export type ApiState<T> =
  | { status: "loading" }
  | { status: "error"; code: number; message: string }
  | { status: "success"; data: T };

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

// In-memory cache across client-side navigation.
// Keeps endpoints like /api/subjects and /api/exams from constantly refetching and flashing skeleton screens.
const apiCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

// Default stale time: 5 minutes.
const CACHE_TTL_MS = 5 * 60 * 1000;

export function clearApiCache(urlPrefix?: string) {
  if (!urlPrefix) {
    apiCache.clear();
    inFlight.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.startsWith(urlPrefix)) {
      apiCache.delete(key);
    }
  }
  for (const key of inFlight.keys()) {
    if (key.startsWith(urlPrefix)) {
      inFlight.delete(key);
    }
  }
}

async function fetchFromApi<T>(url: string): Promise<T> {
  const existing = inFlight.get(url);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = (async () => {
    try {
      const res = await fetch(url);
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.status !== "success") {
        const error = new Error(body?.message ?? `Request failed (${res.status})`);
        (error as { code?: number }).code = res.status;
        throw error;
      }
      apiCache.set(url, { data: body, timestamp: Date.now() });
      return body as T;
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, promise);
  return promise;
}

export function useApi<T>(url: string) {
  const [attempt, setAttempt] = useState(0);
  const [prevUrl, setPrevUrl] = useState(url);

  const [state, setState] = useState<ApiState<T>>(() => {
    const cached = apiCache.get(url);
    if (cached) {
      return { status: "success", data: cached.data as T };
    }
    return { status: "loading" };
  });

  if (prevUrl !== url) {
    setPrevUrl(url);
    const cached = apiCache.get(url);
    if (cached) {
      setState({ status: "success", data: cached.data as T });
    } else {
      setState({ status: "loading" });
    }
  }

  useEffect(() => {
    let active = true;
    const cached = apiCache.get(url);
    const isFresh = cached && attempt === 0 && Date.now() - cached.timestamp < CACHE_TTL_MS;

    if (cached) {
      setState({ status: "success", data: cached.data as T });
    } else {
      setState({ status: "loading" });
    }

    if (isFresh) {
      return;
    }

    fetchFromApi<T>(url)
      .then((data) => {
        if (active) {
          setState({ status: "success", data });
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        // If we already had cached data and this was just a background refresh, keep showing cached data
        if (cached && attempt === 0) return;
        const code = (err as { code?: number })?.code ?? 0;
        const message = err instanceof Error ? err.message : "Network error";
        setState({ status: "error", code, message });
      });

    return () => {
      active = false;
    };
  }, [url, attempt]);

  const retry = useCallback(() => {
    apiCache.delete(url);
    inFlight.delete(url);
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, [url]);

  return { state, retry };
}
