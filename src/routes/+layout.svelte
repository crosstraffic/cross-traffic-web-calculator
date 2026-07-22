<script>
  import '../app.css';

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

<svelte:window on:click={closeNavDropdowns} />

<header>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-LMH583TV33"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-LMH583TV33');
  </script>

  <div class="navbar bg-base-100 shadow-md">
    <div class="navbar-start">
      <div class="dropdown">
        <div tabindex="0" role="button" class="btn btn-ghost btn-circle lg:hidden">
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
                <li><a href="/hcm10">Freeway Facilities <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm11">Freeway Reliability <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm12">Basic Freeway Segments</a></li>
                <li><a href="/hcm12ml">Managed Lanes <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm13">Weaving Segments <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm14">Merge and Diverge Segments <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm15">Two-Lane Highways</a></li>
                <li><a href="/hcm16">Urban Street Facilities <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm17">Urban Street Reliability <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm18">Urban Street Segments <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm19">Signalized Intersections <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm20">Two-Way STOP Control <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm21">All-Way STOP Control <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm22">Roundabouts <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm23">Ramp Terminals <span class="badge badge-warning badge-xs">beta</span></a></li>
                <li><a href="/hcm24">Off-Street Ped and Bike <span class="badge badge-warning badge-xs">beta</span></a></li>
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
    <div class="navbar-center hidden lg:flex">
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
              <li><a href="/hcm10">Freeway Facilities <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm11">Freeway Reliability <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm12">Basic Freeway Segments</a></li>
              <li><a href="/hcm12ml">Managed Lanes <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm13">Weaving Segments <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm14">Merge and Diverge Segments <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm15">Two-Lane Highways</a></li>
              <li><a href="/hcm16">Urban Street Facilities <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm17">Urban Street Reliability <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm18">Urban Street Segments <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm19">Signalized Intersections <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm20">Two-Way STOP Control <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm21">All-Way STOP Control <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm22">Roundabouts <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm23">Ramp Terminals <span class="badge badge-warning badge-xs">beta</span></a></li>
              <li><a href="/hcm24">Off-Street Ped and Bike <span class="badge badge-warning badge-xs">beta</span></a></li>
            </ul>
          </details>
        </li>
        <li><a class="home_button" href="/guide">Guide</a></li>
        <li><a class="home_button" href="/report">Report</a></li>
      </ul>
    </div>

    <div class="navbar-end">
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
  <slot />
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
