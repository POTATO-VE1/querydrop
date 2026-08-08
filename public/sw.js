/**
 * QueryDrop — Service Worker
 * Hand-rolled (no Workbox / no @vite-pwa/astro peer-dep conflict with Astro 6).
 *
 * Caching strategy:
 *   - /duckdb/*, /sql-wasm/*  → cache-first, count-capped (WASM is large; ~5 files)
 *   - /samples/*              → cache-first, count-capped (~6 files)
 *   - /assets/*, /_astro/*, fonts, images → cache-first, count-capped at 200
 *   - navigations             → network-first, fall back to /tool/index.html
 *
 * Privacy: requests carrying ?q= or ?r= (share links) bypass the SW entirely
 * so shared SQL/results never sit in the SW cache.
 *
 * Activation: clean all caches whose name doesn't start with the current
 * CACHE_VERSION prefix, so upgrading the SW auto-evicts old assets.
 */

const CACHE_VERSION = 'qd-v2';
const WASM_CACHE = `${CACHE_VERSION}-wasm`;
const SAMPLE_CACHE = `${CACHE_VERSION}-samples`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Same-origin: sql.js wasm. Cross-origin: DuckDB engine binaries on the
// jsdelivr CDN (36-41MB; cached so the tool works offline after first load).
const WASM_PATH = /^\/sql-wasm\//;
const CDN_DUCKDB = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@duckdb\/duckdb-wasm@[^/]+\/dist\//;
const SAMPLE_PATH = /^\/samples\//;
const STATIC_PATH = /^\/(?:assets|_astro)\/|(?:\.(?:js|mjs|css|woff2?|png|jpg|jpeg|webp|svg|ico))$/;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => !n.startsWith(CACHE_VERSION))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (CDN_DUCKDB.test(url.href)) {
    event.respondWith(staleWhileRevalidate(event, req, WASM_CACHE, 5));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.searchParams.has('q') || url.searchParams.has('r')) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNavigate(req));
    return;
  }

  if (WASM_PATH.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, req, WASM_CACHE, 5));
    return;
  }
  if (SAMPLE_PATH.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, req, SAMPLE_CACHE, 20));
    return;
  }
  if (STATIC_PATH.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, req, STATIC_CACHE, 200));
    return;
  }
});

async function staleWhileRevalidate(event, request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    const bgFetch = fetch(request)
      .then((res) => {
        if (res && res.ok) return cache.put(request, res.clone());
      })
      .catch(() => {});
    event.waitUntil(bgFetch);
    return cached;
  }
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      cache.put(request, res.clone());
      trimCache(cache, maxEntries);
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirstNavigate(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const fallback = (await cache.match('/tool/index.html')) || (await cache.match('/index.html'));
    if (fallback) return fallback;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const overflow = keys.length - maxEntries;
  for (let i = 0; i < overflow; i++) {
    await cache.delete(keys[i]);
  }
}
