import { readdirSync } from 'node:fs';
import { sveltekit } from '@sveltejs/kit/vite';
import wasmPack from "vite-plugin-wasm-pack";

const WASM_CRATE = "./HCM-middleware";

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
    __WASM_ASSET__: JSON.stringify(wasmAssetUrl())
  },
};
