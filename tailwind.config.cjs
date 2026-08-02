module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,mjs,jsx,ts,tsx,svelte}', './public/index.html'],
  safelist: [],
  // whitelistPatterns: [/svelte-/],
  theme: {
    extend: {},
  },
  daisyui: {
    themes: ['light', 'dark'],
    darkTheme: 'dark',
    styled: true,
    base: false,
    utils: true,
    logs: false,
    rtl: false,
    prefix: "",
  },
  plugins: [require('daisyui')],
};
