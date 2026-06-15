/* Service Worker — App-Shell-Cache (offline) + smarte Strategie für API-Calls. */
const CACHE = 'wm-challenge-v32';
const ASSETS = [
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

/* iOS verweigert „redirected" Responses bei Navigationen → Redirect-Flag entfernen,
 * indem wir eine frische Response aus dem Body bauen. */
function clean(res) {
  if (!res || !res.redirected) return res;
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Live-/API-Daten: immer zuerst aus dem Netz (Network-first), Cache nur als Notfall-Fallback.
  if (url.pathname.includes('/api/')) {
    e.respondWith(
      fetch(request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return res; })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Seitenaufrufe (Navigationen): Netz zuerst, sonst gecachte index.html — immer redirect-bereinigt.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).then(clean).catch(() => caches.match('./index.html').then(clean))
    );
    return;
  }

  // App-Shell & Assets: Cache-first (schneller Start, offline-fähig), Netz als Fallback.
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ? clean(cached) : fetch(request).then(clean).catch(() => caches.match('./index.html').then(clean))
    )
  );
});
