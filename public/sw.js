// Service worker: keeps the app shell and every exam the user has opened available offline.
//
// Caches
//   static-v1  hashed build assets (/_next/static), icons, fonts. Cache-first; never change once built.
//   pages-v1   HTML documents ("/", "/exams/{slug}"). Network-first, cached copy when offline.
//   api-v1     /api/exams responses. Exam detail: stale-while-revalidate. Exam list: network-first.
//
// Bump a cache's version only when its format changes: a bump throws away saved questions.
// /admin and /api/admin are never cached.

const STATIC_CACHE = "static-v1";
const PAGES_CACHE = "pages-v1";
const API_CACHE = "api-v1";
const KNOWN_CACHES = [STATIC_CACHE, PAGES_CACHE, API_CACHE];
const STATIC_LIMIT = 400;

const OFFLINE_URL = "/offline.html";
const PRECACHE = ["/", OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES_CACHE);
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cacheDocument(url, pages);
          } catch {
            // A failed precache must not block installation; it is retried on the next visit.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !KNOWN_CACHES.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/admin")) return;
  // RSC payloads for client-side navigation are left to Next.js; when they fail it falls back to a full page load.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith("/api/exams/")) {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  if (url.pathname === "/api/exams") {
    event.respondWith(networkFirst(request, API_CACHE));
  }
});

// Page asks for an exam to be saved (its API data, its HTML and the assets the HTML needs).
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "SAVE_EXAM" || typeof data.slug !== "string") return;
  const port = event.ports[0];

  event.waitUntil(
    saveExam(data.slug).then(
      () => port?.postMessage({ ok: true }),
      (err) => port?.postMessage({ ok: false, error: String(err) }),
    ),
  );
});

// Skips whatever is already stored; viewing the exam online refreshes both copies anyway.
async function saveExam(slug) {
  const encoded = encodeURIComponent(slug);
  const apiUrl = `/api/exams/${encoded}`;
  const pageUrl = `/exams/${encoded}`;

  const api = await caches.open(API_CACHE);
  if (!(await api.match(apiUrl))) {
    const apiRes = await fetch(apiUrl, { cache: "no-cache" });
    if (!apiRes.ok) throw new Error(`API ${apiRes.status}`);
    await api.put(apiUrl, apiRes);
  }

  const pages = await caches.open(PAGES_CACHE);
  if (!(await pages.match(pageUrl))) await cacheDocument(pageUrl, pages);
}

// Fetches an HTML document, stores it, and stores the build assets it references so the page can boot offline.
async function cacheDocument(url, cache) {
  const res = await fetch(url, { cache: "no-cache", credentials: "same-origin" });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  await cache.put(url, res.clone());

  if ((res.headers.get("Content-Type") || "").includes("text/html")) {
    await cacheAssetsFrom(await res.text());
  }
}

async function cacheAssetsFrom(html) {
  const urls = new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) || []);
  if (urls.size === 0) return;

  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...urls].map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const res = await fetch(url);
        if (res.ok) await cache.put(url, res);
      } catch {
        // Skipped; picked up at runtime when the page requests it online.
      }
    }),
  );
  await trimCache(STATIC_CACHE, STATIC_LIMIT);
}

async function handleNavigation(event) {
  const { request } = event;
  const url = new URL(request.url);
  const key = url.pathname;

  try {
    const res = await fetch(request);
    if (res.ok && (res.headers.get("Content-Type") || "").includes("text/html")) {
      const copy = res.clone();
      event.waitUntil(
        (async () => {
          await (await caches.open(PAGES_CACHE)).put(key, copy.clone());
          await cacheAssetsFrom(await copy.text());
        })(),
      );
    }
    return res;
  } catch {
    const pages = await caches.open(PAGES_CACHE);
    return (await pages.match(key)) || (await pages.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

// Saved questions open instantly; a fresh copy is fetched in the background for next time.
async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request).then(async (res) => {
    if (res.ok) await cache.put(request, res.clone());
    else if (res.status === 404) await cache.delete(request); // exam was removed
    return res;
  });

  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network.catch(() => Response.error());
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
