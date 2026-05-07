const CACHE_NAME = 'libnote-app-shell-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }

          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (
            response.ok &&
            !url.pathname.startsWith('/@vite') &&
            !url.pathname.startsWith('/src/') &&
            url.pathname !== '/' &&
            url.pathname !== '/index.html'
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }

          return response;
        })
        .catch(
          () =>
            new Response('LibNote is offline and this asset is not cached yet.', {
              status: 503,
              statusText: 'Offline'
            })
        );
    })
  );
});

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);

  try {
    const indexResponse = await fetch('/index.html', { cache: 'no-store' });

    if (!indexResponse.ok) {
      return;
    }

    const indexClone = indexResponse.clone();
    const indexHtml = await indexResponse.text();
    const assetUrls = getSameOriginAssetUrls(indexHtml);

    await cache.put('/index.html', indexClone);

    if (assetUrls.length > 0) {
      await cache.addAll(assetUrls);
    }
  } catch (error) {
    console.error('LibNote app shell caching failed', error);
  }
}

function getSameOriginAssetUrls(indexHtml) {
  const urls = new Set();
  const assetPattern = /\b(?:href|src)="([^"]+)"/g;
  let match = assetPattern.exec(indexHtml);

  while (match) {
    const assetUrl = new URL(match[1], self.location.origin);

    if (assetUrl.origin === self.location.origin && assetUrl.pathname.startsWith('/assets/')) {
      urls.add(assetUrl.pathname);
    }

    match = assetPattern.exec(indexHtml);
  }

  return Array.from(urls);
}
