const CACHE = 'liftlog-v7';
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

// Install: pre-cache CDN libraries only (they never change)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CDN_ASSETS))
  );
  // Don't skipWaiting here — wait for the app to signal readiness
});

// Allow app to trigger SW activation immediately
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate: drop old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//   - CDN libraries  → cache-first (they're pinned versions, safe to cache forever)
//   - liftlog.html   → network-first so updates always show immediately
//   - everything else → network with offline fallback
self.addEventListener('fetch', e => {
  const url = e.request.url;
  const isCDN = CDN_ASSETS.some(a => url.startsWith(a.split('?')[0]));
  const isHTML = url.endsWith('liftlog.html') || url.endsWith('/');

  if (isCDN) {
    // Cache-first for CDN
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  if (isHTML) {
    // Network-first for the app shell so updates deploy instantly
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Default: network with cached fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
