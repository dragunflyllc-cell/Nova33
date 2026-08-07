// Dragunfly — minimal offline cache so the app shell installs cleanly.
const CACHE = "dragunfly-v1";
const ASSETS = [
  "/play.html",
  "/css/style.css",
  "/js/creatures.js",
  "/js/geo.js",
  "/js/game.js",
  "/icons/icon.svg",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
