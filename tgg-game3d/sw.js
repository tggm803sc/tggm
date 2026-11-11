// Offline app shell. The game must open with no connection once it has loaded
// once; /api/* is never cached, so the AI route keeps telling the truth.
const CACHE = 'tgg-shell-v1';
const SHELL = ['./', './index.html', './game.js', './style.css', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
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

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Cloud AI and anything else dynamic is network-only.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network.catch(() => undefined));
        return cached;
      }

      const fresh = await network;
      if (fresh) return fresh;
      // Offline navigation falls back to the shell so the game still boots.
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html', { ignoreSearch: true });
        if (shell) return shell;
      }
      return new Response('Offline and not cached yet', {
        status: 503,
        statusText: 'Offline',
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }),
  );
});
