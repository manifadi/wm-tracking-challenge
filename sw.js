/* Service Worker — App-Shell-Cache (offline) + smarte Strategie für API-Calls. */
const CACHE = 'wm-challenge-v6';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Live-/API-Daten: immer zuerst aus dem Netz (Network-first), Cache nur als Notfall-Fallback.
  const isApi = url.pathname.includes('/api/matches');
  if (isApi) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)); // letzten guten Stand sichern
          return res;
        })
        .catch(() => caches.match(request)) // offline → letzter bekannter Stand
    );
    return;
  }

  // App-Shell & Assets: Cache-first (schneller Start, offline-fähig), Netz als Fallback.
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).catch(() => caches.match('./index.html'))
    )
  );
});
