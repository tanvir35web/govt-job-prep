import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };
const buildTime = new Date().toISOString();
// The commit on Vercel; a timestamp for local builds. Settings compares it with /api/version to detect updates.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? buildTime.replace(/\D/g, "").slice(0, 14);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Inlined into both the server and client bundles at build time, so they always agree within one build.
  env: {
    APP_VERSION: version,
    APP_BUILD_ID: buildId,
    APP_BUILD_TIME: buildTime,
  },
  async headers() {
    return [
      {
        // Browsers must always re-check the service worker so updates reach installed apps.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
