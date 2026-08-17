import { existsSync, readdirSync } from 'node:fs';
import { sveltekit } from '@sveltejs/kit/vite';
import wasmPack from "vite-plugin-wasm-pack";

const WASM_CRATE = "./HCM-middleware";
const ROUTES_DIR = "./src/routes";

// vite-plugin-wasm-pack copies the crate's pkg/*.wasm to a fixed, unhashed
// `assets/` path and rewrites the wasm-bindgen glue to fetch exactly that
// relative URL. The file is emitted outside SvelteKit's build manifest, so
// `$service-worker`'s `build` and `files` never mention it and the service
// worker cannot precache it by name. Read the name off the pkg directory the
// plugin copies from rather than hardcoding it, so a crate rename or a
// wasm-pack output change moves the precache entry with it instead of leaving
// a stale path that only fails offline.
function wasmAssetUrl() {
  const pkg = `${WASM_CRATE}/pkg`;
  const wasm = readdirSync(pkg).filter((name) => name.endsWith('.wasm'));
  if (wasm.length !== 1) {
    throw new Error(`expected exactly one .wasm in ${pkg}, found ${wasm.length ? wasm.join(', ') : 'none'}`);
  }
  // Relative, matching the URL the glue resolves against the document.
  return `assets/${wasm[0]}`;
}

// Nothing in this app is prerendered — every page is a Vercel function — so no
// page HTML exists as a build artifact and `$service-worker`'s `build`/`files`
// cannot supply the app shell. The worker has to fetch the pages itself at
// install time, which means it needs the route list. Enumerate it from the
// route tree rather than hardcoding it, so adding a chapter page ships its
// offline copy with it.
//
// This reads the flat, literal route tree the app actually has: one directory
// per page under src/routes. Directory names that are not literal URL segments
// (parameter matchers `[slug]`, layout groups `(group)`) are skipped, because
// there is no single URL to fetch for them; a nested or parameterized route
// would need this to walk deeper.
function pageRoutes() {
  const dirs = readdirSync(ROUTES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !/^[[(]/.test(entry.name))
    .filter((entry) => existsSync(`${ROUTES_DIR}/${entry.name}/+page.svelte`))
    .map((entry) => `/${entry.name}`)
    .sort();
  if (!dirs.length) {
    throw new Error(`found no page routes under ${ROUTES_DIR}`);
  }
  // The root route's +page.svelte sits in ROUTES_DIR itself, so it is not a
  // directory entry and has to be added by hand.
  return ['/', ...dirs];
}

/** @type {import('vite').UserConfig} */
export default {
  plugins: [
    sveltekit(),
    wasmPack(WASM_CRATE)
  ],
  // SvelteKit bundles the service worker in a separate Vite pass that ignores
  // this config file and every plugin in it, so `define` is the only channel
  // that reaches service-worker.js.
  define: {
    __WASM_ASSET__: JSON.stringify(wasmAssetUrl()),
    __ROUTES__: JSON.stringify(pageRoutes())
  },
};
