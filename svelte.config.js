import adapter from '@sveltejs/adapter-vercel';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: preprocess(),

  kit: {
    // Deploy to Vercel. Runs SvelteKit on Vercel's Node serverless runtime.
    adapter: adapter({
      runtime: 'nodejs20.x',
    }),
  },
};

export default config;
