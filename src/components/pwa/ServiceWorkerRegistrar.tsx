"use client";

import { useEffect } from "react";

// Registers /sw.js in production builds only; in `next dev` a caching worker would serve stale bundles.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err: unknown) => {
      console.error("Service worker registration failed:", err);
    });

    // Ask the browser not to evict saved questions under storage pressure. Best effort; Safari may decline.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  return null;
}
