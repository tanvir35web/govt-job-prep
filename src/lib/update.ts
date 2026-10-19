"use client";

import { useEffect, useState } from "react";

export const CURRENT_BUILD = {
  version: process.env.APP_VERSION ?? "0.0.0",
  buildId: process.env.APP_BUILD_ID ?? "dev",
  buildTime: process.env.APP_BUILD_TIME ?? "",
};

export type UpdateCheck =
  | { status: "latest" }
  | { status: "available"; version: string; buildId: string }
  | { status: "offline" }
  | { status: "error" };

/** Asks the server which build is deployed and compares it with the build this page is running. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  if (!navigator.onLine) return { status: "offline" };

  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    const body = (await res.json()) as { version?: string; build_id?: string };
    if (!res.ok || !body.build_id) return { status: "error" };

    // Also lets the browser fetch a changed service worker now rather than on its own schedule.
    void navigator.serviceWorker?.getRegistration().then((reg) => reg?.update().catch(() => {}));

    return body.build_id === CURRENT_BUILD.buildId
      ? { status: "latest" }
      : { status: "available", version: body.version ?? "", buildId: body.build_id };
  } catch {
    return navigator.onLine ? { status: "error" } : { status: "offline" };
  }
}

let sessionCheck: Promise<UpdateCheck> | null = null;

/** True when a newer build is deployed. Checks once per page load; used for the badge on the Settings tab. */
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (sessionCheck ??= checkForUpdate()).then((r) => !cancelled && setAvailable(r.status === "available"));
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
}

/** Loads the new build. Pages are network-first in the service worker, so a reload while online fetches fresh HTML and assets. */
export async function applyUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch {
    // The reload below still picks up the new pages.
  }
  window.location.reload();
}
