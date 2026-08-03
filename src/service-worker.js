// Offline support. The calculator computes everything locally in wasm, so a
// cached shell makes the whole site work with no network: build assets
// (immutable, hashed filenames, including the wasm binary) are cached on
// install and served cache-first; pages are network-first with a cache
// fallback so content stays fresh online and available offline.
import { build, files, version } from '$service-worker';

const CACHE = `hcm-calc-${version}`;
// Everything Vite emitted plus the static directory (icons, manifest, logo).
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      for (const key of keys) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // never touch gtag etc.

  // Immutable build assets and static files: cache-first.
  if (ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(url.pathname).then((hit) => hit || fetch(request))
    );
    return;
  }

  // Pages (and anything else same-origin): network-first, fall back to the
  // cached copy, and as a last resort the cached home page shell.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        return hit || caches.match('/');
      })
  );
});
