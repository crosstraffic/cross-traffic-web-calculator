<script>
  import '../app.css';
  import { onMount } from 'svelte';
  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();

  // Theme: the inline script in app.html applies the saved or system theme
  // before first paint; this toggle just flips and persists it.
  let theme = $state('light');
  onMount(() => {
    theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('hcm-theme', theme); } catch (e) { /* private mode */ }
  }

  // Google Analytics, production hostname only: localhost runs (dev, tests,
  // screenshot automation) were inflating active-user counts, since every
  // fresh automation context looks like a new user to GA4.
  onMount(() => {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local') || h.endsWith('.vercel.app')) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-LMH583TV33';
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', 'G-LMH583TV33');
  });

  // Native <details> dropdowns don't close on an outside click. Close any open
  // nav dropdown when the click lands outside it, or on a link inside it (so the
  // menu doesn't stay open after navigating).
  function closeNavDropdowns(event) {
    const target = event.target;
    document.querySelectorAll('header details[open]').forEach((details) => {
      if (!details.contains(target) || target.closest('a')) {
        details.removeAttribute('open');
      }
    });
  }
</script>

<svelte:window onclick={closeNavDropdowns} />

<header>
  <div class="navbar bg-base-100 shadow-md">
    <div class="navbar-start">
      <div class="dropdown">
        <div tabindex="0" role="button" class="btn btn-ghost btn-circle md:hidden">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </div>
        <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[50] p-2 shadow bg-base-200 rounded-box w-52">
          <li><a href="/">Home</a></li>
          <li>
            <details>
              <summary class="justify-between">
                Analyses
                <!-- <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/></svg> -->
              </summary>
              <ul class="p-2 bg-base-200">
                <li><a href="/hcm10">Freeway Facilities</a></li>
                <li><a href="/hcm11">Freeway Reliability (Beta)</a></li>
                <li><a href="/hcm12">Basic Freeway Segments</a></li>
                <li><a href="/hcm13">Freeway Weaving Segments</a></li>
                <li><a href="/hcm14">Freeway Merge and Diverge Segments</a></li>
                <li><a href="/hcm15">Two-Lane Highways</a></li>
                <li><a href="/hcm19">Signalized Intersections</a></li>
                <li><a href="/hcm20">Two-Way STOP Control</a></li>
                <li><a href="/hcm21">All-Way STOP Control</a></li>
                <li><a href="/hcm22">Roundabouts</a></li>
                <li><a href="/hcm23">Interchange Ramp Terminals</a></li>
                <li><a href="/hcm24">Pedestrian and Bicycle Paths</a></li>
              </ul>
            </details>
          </li>
          <li><a href="/guide">Guide</a></li>
          <li><a href="/report">Report</a></li>
        </ul>
      </div>
      <!-- Gonna be LOGO -->
      <a href="/" class="normal-case text-xl logo"><img src="hcm_calculator_logo.png" alt="logo" style="max-width:110px;height:100%"/></a>
    </div>
    <div class="navbar-center hidden md:flex">
      <ul class="menu menu-horizontal p-0">
        <li><a class="home_button" href="/">Home</a></li>
        <!-- <li><a href="/about">About</a></li> -->
        <li>
          <details>
            <summary class="chap_button">
              Analyses
              <!-- <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg> -->
            </summary>
            <ul class="p-2 bg-base-200 chapters-menu">
              <li><a href="/hcm10">Freeway Facilities</a></li>
              <li><a href="/hcm11">Freeway Reliability (Beta)</a></li>
              <li><a href="/hcm12">Basic Freeway Segments</a></li>
              <li><a href="/hcm13">Freeway Weaving Segments</a></li>
                <li><a href="/hcm14">Freeway Merge and Diverge Segments</a></li>
              <li><a href="/hcm15">Two-Lane Highways</a></li>
              <li><a href="/hcm19">Signalized Intersections</a></li>
              <li><a href="/hcm20">Two-Way STOP Control</a></li>
              <li><a href="/hcm21">All-Way STOP Control</a></li>
              <li><a href="/hcm22">Roundabouts</a></li>
              <li><a href="/hcm23">Interchange Ramp Terminals</a></li>
              <li><a href="/hcm24">Pedestrian and Bicycle Paths</a></li>
            </ul>
          </details>
        </li>
        <li><a class="home_button" href="/guide">Guide</a></li>
        <li><a class="home_button" href="/report">Report</a></li>
      </ul>
    </div>

    <div class="navbar-end">
      <button
        type="button"
        class="nav-theme-toggle"
        onclick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {#if theme === 'dark'}
          <!-- sun -->
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        {:else}
          <!-- moon -->
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        {/if}
      </button>
      <a
        class="nav-github"
        href="https://github.com/crosstraffic/cross-traffic-web-calculator"
        target="_blank"
        rel="noreferrer"
        aria-label="View source on GitHub"
        title="View source on GitHub"
      >
        <svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      </a>
    </div>
  </div>
</header>

<main>
  {@render children?.()}
</main>

<footer class="site-footer">
  <div class="site-footer-inner">
    <nav class="site-footer-links">
      <a href="/">Home</a>
      <a href="/guide">Guide</a>
      <a href="terms">Terms &amp; Conditions</a>
    </nav>
    <p class="site-footer-copy">© 2022–2026 Rei Tamaru and Jonathan Riel. All rights reserved.</p>
  </div>
</footer>
