const CACHE_NAME = "sautilink-router-v5";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/brand/system.css",
  "/assets/app.css",
  "/assets/app.js",
  "/assets/router-catalog.json",
  "/assets/icons/router-logo.png",
  "/assets/icons/router-icon-192.png",
  "/assets/icons/router-icon-512.png",
  "/assets/icons/router-icon-maskable-512.png",
  "/assets/icons/apple-touch-icon.png",
  "/assets/icons/favicon.ico",
  "/assets/fonts/inter/InterVariable.woff2",
  "/assets/fonts/inter/InterVariable-Italic.woff2"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== "GET" || requestUrl.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/index.html")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fresh = fetch(event.request)
        .then((response) => {
          if (response.ok && requestUrl.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
