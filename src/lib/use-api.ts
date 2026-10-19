"use client";

import { useCallback, useEffect, useState } from "react";

type ApiState<T> =
  | { status: "loading" }
  | { status: "error"; code: number; message: string }
  | { status: "success"; data: T };

export function useApi<T>(url: string) {
  const [state, setState] = useState<ApiState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || body?.status !== "success") {
          setState({ status: "error", code: res.status, message: body?.message ?? `Request failed (${res.status})` });
          return;
        }
        setState({ status: "success", data: body as T });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", code: 0, message: err instanceof Error ? err.message : "Network error" });
      });

    return () => controller.abort();
  }, [url, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
