// Offline support. The calculator computes everything locally in wasm, so a
// cached shell makes the whole site work with no network. Build assets
// (immutable, hashed filenames), the static directory and the wasm binary are
// cached on install and served cache-first; pages are network-first with a
// cache fallback so content stays fresh online and available offline.
/* global __WASM_ASSET__ */
import { build, files, version } from '$service-worker';

const CACHE = `hcm-calc-${version}`;
// The wasm binary is emitted by vite-plugin-wasm-pack at an unhashed `assets/`
// path outside SvelteKit's manifest, so it is absent from both `build` and
// `files` and has to be added by hand. `__WASM_ASSET__` is substituted at build
// time from the crate's pkg directory (see vite.config.js) and is relative, the
// same way the wasm-bindgen glue's own fetch is, so resolve it against the
// worker scope to get the pathname the app will actually request. Its name
// never changes across builds, but the cache is keyed on `version`, so a deploy
// still replaces the binary rather than serving a stale one.
const WASM = new URL(__WASM_ASSET__, self.registration.scope).pathname;
// Everything Vite emitted plus the static directory (icons, manifest, logo).
const ASSETS = [...build, ...files, WASM];

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
