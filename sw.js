const CACHE_NAME = "sautilink-router-v2";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/brand/system.css",
  "/assets/fonts/lora/Lora-Variable.woff2",
  "/assets/fonts/lora/Lora-VariableItalic.woff2",
  "/assets/fonts/zalando-sans-semiexpanded/ZalandoSansSemiExpanded-Variable.woff2",
  "/assets/fonts/zalando-sans-semiexpanded/ZalandoSansSemiExpanded-VariableItalic.woff2"
];

// Install event
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch event (offline support)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
