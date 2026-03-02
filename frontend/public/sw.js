/**
 * Gymie Service Worker — cache-first para assets estáticos
 * Habilita funcionamento offline e instalação como PWA
 */
const CACHE_NAME = 'gymie-v1';

// App shell — arquivos críticos para funcionar offline
const APP_SHELL = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Não interceptar requisições de API
  if (e.request.url.includes('/api/')) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        // Cache assets estáticos (JS, CSS, imagens, GIFs)
        if (response.ok && (
          e.request.url.includes('/static/') ||
          e.request.url.includes('/exercicios/') ||
          e.request.url.includes('/icons/')
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});
