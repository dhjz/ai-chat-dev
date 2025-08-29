
const CACHE_NAME = 'chat-cache-v5';
const URLS_TO_PRECACHE = [
  '/',
  // '/favicon.ico',
  '/index.html',
  '/setting.html',
  '/run.html',
  '/index-ai.css',
  '/index-ai.js',
  '/dist.min.js',
];

self.addEventListener('install', event => {
  console.log(`[SW-CHAT] Event: install (version: ${CACHE_NAME})`);
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_PRECACHE))
    .then(() => self.skipWaiting()).catch(e => console.error('[SW-CHAT] Precaching failed:', e))
  );
});

self.addEventListener('activate', event => {
  console.log(`[SW-CHAT] Event: activate (version: ${CACHE_NAME})`);
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(cacheNames.map(cacheName => cacheName !== CACHE_NAME && caches.delete(cacheName))))
      .then(() => self.clients.claim())
  )
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || request.url.includes('cdn')) return;
  event.respondWith(
    caches.match(request).then(cachedResponse => cachedResponse || fetch(request)).catch(() => {})
  );
});