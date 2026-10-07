/* HomeHunt service worker: app shell + visited pages work offline (PRD 10, Offline).
   API calls and anything signed-in data related are never cached here: app data
   lives in IndexedDB / localStorage, and listing import needs a connection anyway. */
const VERSION = "hh-v1";
const SHELL = ["/", "/schedule", "/add", "/compare", "/settings", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Static build assets are content-hashed: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })),
    );
    return;
  }
  // Pages: network first so updates arrive, falling back to the last copy when offline.
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/") || new Response("You're offline.", { status: 503 }))),
    );
  }
});
