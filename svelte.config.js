import adapter from '@sveltejs/adapter-auto';
import preprocess from 'svelte-preprocess';

const production = process.env.NODE_ENV === 'production'

const baseCsp = [
	'self',
	'https://www.gstatic.com/recaptcha/', // recaptcha
	'https://accounts.google.com/gsi/', // sign-in w/google
	'https://www.google.com/recaptcha/', // recapatcha
	'https://fonts.gstatic.com/' // recaptcha fonts
]

if (!production) baseCsp.push('ws://localhost:3001')

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: preprocess(),

  kit: {
    adapter: adapter({
      out: 'build'
    }),
    csp: {
      mode: 'auto',
      directives: {
        'default-src': [...baseCsp],
        'script-src': ['unsafe-inline', ...baseCsp],
        'img-src': ['data:', 'blob:', ...baseCsp],
        'style-src': ['unsafe-inline', ...baseCsp],
        'object-src': ['none'],
        'base-uri': ['self']
      }
    },
    files: {
      serviceWorker: 'src/service-worker.js'
    }
  },
};

export default config;
