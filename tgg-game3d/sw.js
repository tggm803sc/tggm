// Offline shell for TGG World.
//
// The game is static files, so a service worker is the whole "backend": it keeps
// one versioned cache of the shell and serves it when the network is gone.
// __TGG_VERSION__ is replaced at build time, so every build publishes a new
// worker, which installs a new cache and deletes the previous one. That is what
// stops a stale bundle from being served after an update.

const VERSION = '__TGG_VERSION__';
const CACHE = `tgg-world-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './game.js',
  './style.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'tgg-skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // A launch must work with no network: prefer the network for freshness, fall
  // back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html').then((hit) => hit ?? caches.match('./'))),
    );
    return;
  }

  // Assets: cache first, then fill the cache on the way through.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
