/* TGG World — service worker for the /play slice only.
 * Registered with scope "/play" by ServiceWorkerRegister, so it never sees
 * navigations to /leaderboards, /clans or any other route. As a second guard
 * the fetch handler ignores navigation requests outside /play regardless of
 * how it was registered.
 *
 * Navigations are network-first so a running dev server is never served stale;
 * hashed Next assets and icons are cache-first, with a background fill.
 */
const VERSION = 'tgg-play-v2';
const PLAY_ROUTE = '/play';
const SHELL = [
  PLAY_ROUTE,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Only the playable route is ours. Anything else is left to the network
    // and to the browser's own error page.
    if (url.pathname !== PLAY_ROUTE && !url.pathname.startsWith(`${PLAY_ROUTE}/`)) return;

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(VERSION)
              .then((cache) => cache.put(PLAY_ROUTE, copy))
              .catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(PLAY_ROUTE))),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((response) => {
              const copy = response.clone();
              caches
                .open(VERSION)
                .then((cache) => cache.put(request, copy))
                .catch(() => undefined);
              return response;
            })
            .catch(() => cached),
      ),
    );
  }
});
