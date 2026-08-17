// Offline support. The calculator computes everything locally in wasm, so a
// cached shell plus a cached page makes the whole site work with no network.
// Build assets (immutable, hashed filenames), the static directory and the wasm
// binary are cached on install and served cache-first. Page HTML is not a build
// artifact here (nothing is prerendered, every page is a server function), so
// the worker fetches every route itself on install; pages then stay
// network-first, which keeps the served HTML fresh whenever there is a network
// and falls back to the install-time copy when there is not.
/* global __WASM_ASSET__, __ROUTES__ */
import { build, files, version } from '$service-worker';

// `version` already changes on every build, so a deploy always lands in a fresh
// cache. The `v2` is a schema marker for what the cache holds: the entries
// changed shape when page HTML was added, and naming that here makes the change
// legible next to the code that caused it.
const CACHE = `hcm-calc-v2-${version}`;
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
// Every page route, enumerated from src/routes at build time (see
// vite.config.js). Resolved against the scope for the same reason as the wasm
// path, so a deploy under a base path caches the URLs the app requests.
const ROUTES = __ROUTES__.map((route) => new URL(route.slice(1), self.registration.scope).pathname);
// The home page, last-resort shell for a navigation to a route that is neither
// cached nor reachable. `__ROUTES__` puts the root first.
const SHELL = ROUTES[0];

// Pages are fetched one at a time rather than through `cache.addAll`, and a
// page that fails is logged and skipped instead of failing the install. These
// are live server responses, not build output: one cold-start timeout, one 5xx,
// or one route that answers with a redirect would reject the whole `addAll` and
// take the asset precache down with it, which is the offline-wasm failure this
// worker was written to fix. A redirected response is skipped outright, because
// serving one to a navigation throws in the fetch handler.
async function precacheRoutes(cache) {
  const failed = [];
  for (const route of ROUTES) {
    try {
      const response = await fetch(route);
      if (!response.ok || response.redirected || response.type !== 'basic') {
        failed.push(`${route} (${response.status}${response.redirected ? ' redirected' : ''})`);
        continue;
      }
      await cache.put(route, response);
    } catch (err) {
      failed.push(`${route} (${err})`);
    }
  }
  if (failed.length) console.warn(`[sw] page precache skipped: ${failed.join(', ')}`);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        // Assets first, and this one does fail the install: every entry is a
        // build artifact whose absence is a build bug, and a silent miss here
        // is exactly what left the engine uncached before.
        await cache.addAll(ASSETS);
        await precacheRoutes(cache);
      })
      .then(() => self.skipWaiting())
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

  // Pages (and anything else same-origin): network-first, so an online visitor
  // always gets the freshly rendered page and the cached copy is refreshed
  // behind it. Only a genuine network failure reaches the cache, and then the
  // order is the cached copy of this exact route, the install-time copy stored
  // under its pathname, and the home shell last.
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
        // ignoreVary because the install-time fetch and a navigation send
        // different Accept headers, and SvelteKit's responses carry a Vary.
        const hit =
          (await caches.match(request, { ignoreVary: true })) ||
          (await caches.match(url.pathname, { ignoreVary: true }));
        return hit || caches.match(SHELL, { ignoreVary: true });
      })
  );
});
