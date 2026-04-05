// Dosekit Service Worker — offline-first with background sync
const CACHE_VERSION = "v1";
const STATIC_CACHE = `dosekit-static-${CACHE_VERSION}`;
const API_CACHE = `dosekit-api-${CACHE_VERSION}`;
// Shell files cached on install (app skeleton)
const SHELL_URLS = ["/", "/manifest.json", "/icon-192.png", "/icon.svg"];

// ── Install: cache app shell ───────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

// ── Activate: clean old caches ─────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE && k !== API_CACHE).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ───

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin && !url.pathname.startsWith("/api")) return;

  // API requests: network-first, fall back to cache
  if (isApiRequest(url)) {
    event.respondWith(networkFirstApi(event.request));
    return;
  }

  // Static assets: cache-first, fall back to network
  event.respondWith(cacheFirstStatic(event.request));
});

const API_PREFIXES = [
  "/today",
  "/supplements",
  "/types",
  "/brands",
  "/selections",
  "/cycles",
  "/schedule",
  "/history",
  "/health",
  "/compare",
  "/log",
];

function isApiRequest(url) {
  return API_PREFIXES.some((p) => url.pathname.startsWith(p));
}

async function networkFirstApi(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // SPA fallback — serve index.html for navigation requests
    if (request.mode === "navigate") {
      const fallback = await caches.match("/");
      if (fallback) return fallback;
    }
    return new Response("Offline", { status: 503 });
  }
}

// ── Background sync: replay queued mutations ───────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "QUEUE_MUTATION") {
    enqueue(event.data.mutation);
  }
  if (event.data?.type === "FLUSH_QUEUE") {
    flushQueue();
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "dosekit-sync") {
    event.waitUntil(flushQueue());
  }
});

async function getQueue() {
  // Use Cache API to persist queue (IndexedDB not available in all SW contexts)
  const cache = await caches.open(API_CACHE);
  const resp = await cache.match("/_sync-queue");
  if (!resp) return [];
  try {
    return await resp.json();
  } catch {
    return [];
  }
}

async function saveQueue(queue) {
  const cache = await caches.open(API_CACHE);
  await cache.put(
    "/_sync-queue",
    new Response(JSON.stringify(queue), {
      headers: { "Content-Type": "application/json" },
    })
  );
}

async function enqueue(mutation) {
  const queue = await getQueue();
  queue.push({ ...mutation, timestamp: Date.now() });
  await saveQueue(queue);
}

async function flushQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const m of queue) {
    try {
      const opts = {
        method: m.method,
        headers: m.headers || {},
      };
      if (m.body) {
        opts.body = JSON.stringify(m.body);
        opts.headers["Content-Type"] = "application/json";
      }
      const resp = await fetch(m.url, opts);
      if (!resp.ok && resp.status >= 500) {
        // Server error — keep in queue for retry
        remaining.push(m);
      }
      // 4xx errors are dropped (stale/invalid)
    } catch {
      // Network still down — keep in queue
      remaining.push(m);
    }
  }
  await saveQueue(remaining);

  // Notify clients that sync is done
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: "SYNC_COMPLETE", remaining: remaining.length });
  }
}
