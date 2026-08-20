// NOTE: Tailwind v4 does not read this file (configuration lives in CSS via
// @import "tailwindcss" / @plugin "daisyui" in src/app.css). Kept only as a
// reference of the pre-v4 setup; do not add configuration here expecting it
// to take effect.
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,mjs,jsx,ts,tsx,svelte}', './public/index.html'],
  safelist: [],
  // whitelistPatterns: [/svelte-/],
  theme: {
    extend: {},
  },
  daisyui: {
    styled: true,
    base: false,
    utils: true,
    logs: false,
    rtl: false,
    prefix: '',
  },
  plugins: [require('daisyui')],
};
