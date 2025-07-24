import { sveltekit } from '@sveltejs/kit/vite';
import wasmPack from "vite-plugin-wasm-pack";

/** @type {import('vite').UserConfig} */
export default {
  plugins: [ sveltekit(),
            wasmPack("./HCM-middleware")
          ],
  server: {
    host: 'localhost',
    port: 3001,
    open: 'http://localhost:3001'
  }
};
