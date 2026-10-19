"use client";

import { useSyncExternalStore } from "react";

// Must match API_CACHE in public/sw.js.
const API_CACHE = "api-v1";

function examApiUrl(slug: string) {
  return `/api/exams/${encodeURIComponent(slug)}`;
}

/** Asks the service worker to store an exam's questions, page and assets. Resolves false if that is not possible. */
export async function saveExamOffline(slug: string): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  // On the very first visit the worker is still installing; give it a few seconds to activate.
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>((resolve) => setTimeout(resolve, 10_000)),
  ]);
  const worker = registration?.active;
  if (!worker) return false;

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), 60_000);
    channel.port1.onmessage = (e: MessageEvent<{ ok: boolean }>) => {
      clearTimeout(timer);
      resolve(e.data.ok);
    };
    worker.postMessage({ type: "SAVE_EXAM", slug }, [channel.port2]);
  });
}

/** Returns the subset of slugs whose questions are already stored on this device. */
export async function getSavedSlugs(slugs: string[]): Promise<Set<string>> {
  if (typeof caches === "undefined") return new Set();
  try {
    const cache = await caches.open(API_CACHE);
    const hits = await Promise.all(slugs.map(async (slug) => ((await cache.match(examApiUrl(slug))) ? slug : null)));
    return new Set(hits.filter((s): s is string => s !== null));
  } catch {
    return new Set();
  }
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** navigator.onLine as React state. Always true during server rendering. */
export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

const noopSubscribe = () => () => {};

/** True when running as an installed home-screen app. */
export function useStandalone() {
  return useSyncExternalStore(
    noopSubscribe,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}

/** True on iPhone/iPad Safari, including iPadOS which reports itself as a Mac. */
export function useIsIOS() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    () => false,
  );
}
