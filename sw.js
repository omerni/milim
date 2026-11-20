/* Service worker: offline-first for the app shell, so the app works with no internet. */
const CACHE = 'milim-v3';
const SHELL = [
  './', './index.html', './words.js', './manifest.webmanifest',
  './lib/preact.umd.js', './lib/hooks.umd.js', './lib/htm.umd.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache on first use (stale-while-revalidate) so fonts work offline afterward.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const cached = await c.match(req);
      const net = fetch(req).then((r) => { if (r && r.status === 200) c.put(req, r.clone()); return r; }).catch(() => cached);
      return cached || net;
    }));
    return;
  }

  // Same-origin app files: cache-first, fall back to network, then to the cached app shell for navigations.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((r) => {
        if (r && r.status === 200) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return r;
      }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    );
  }
});
