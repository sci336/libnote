const CACHE_PREFIX = 'libnote-app-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const INDEX_URL = `${SCOPE_PATH}index.html`;
// Cache only the app shell and same-origin build assets. User notes live in
// IndexedDB, not the service worker cache, so clearing caches should not remove
// the library itself.
const APP_SHELL = [
  SCOPE_PATH,
  INDEX_URL,
  `${SCOPE_PATH}manifest.webmanifest`,
  `${SCOPE_PATH}icon.svg`,
  `${SCOPE_PATH}icon-192.png`,
  `${SCOPE_PATH}icon-512.png`,
  `${SCOPE_PATH}apple-touch-icon.png`
];

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          // Keep one app-shell cache version so updates do not keep serving old
          // bundled assets after a new service worker activates.
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
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

  if (!url.pathname.startsWith(SCOPE_PATH)) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            // Refresh cached index on successful navigations so the next offline
            // launch uses the newest shell the browser has seen.
            void caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, clone));
          }

          return response;
        })
        .catch(() => caches.match(INDEX_URL))
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
            // Development-only Vite modules should not be cached into the
            // production app shell cache.
            !url.pathname.startsWith(`${SCOPE_PATH}@vite`) &&
            !url.pathname.startsWith(`${SCOPE_PATH}src/`) &&
            url.pathname !== SCOPE_PATH &&
            url.pathname !== INDEX_URL
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
    const indexResponse = await fetch(INDEX_URL, { cache: 'no-store' });

    if (!indexResponse.ok) {
      return;
    }

    const indexClone = indexResponse.clone();
    const indexHtml = await indexResponse.text();
    const assetUrls = getSameOriginAssetUrls(indexHtml);

    await cache.put(INDEX_URL, indexClone);

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
    const assetUrl = new URL(match[1], self.registration.scope);

    if (assetUrl.origin === self.location.origin && assetUrl.pathname.startsWith(`${SCOPE_PATH}assets/`)) {
      urls.add(assetUrl.pathname);
    }

    match = assetPattern.exec(indexHtml);
  }

  return Array.from(urls);
}
