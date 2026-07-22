<svelte:head>
  <title>HCM Calculator</title>
</svelte:head>

<script lang="ts">
  import { onMount } from "svelte";
  import init from "HCM-middleware";

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
  })

</script>

<div id="routes-container" class="home-page">
  <!-- Hero -->
  <section class="hero-section">
    <div class="hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Highway Capacity Manual · 7th Edition</p>
        <h1 class="hero-title">HCM Calculator</h1>
        <p class="hero-lead">
          A browser-based implementation of HCM analysis procedures. Compute
          level of service, follower density, and operating speeds segment by
          segment — backed by a WebAssembly engine for exact, reproducible results.
        </p>
        <div class="hero-actions">
          <a href="/hcm15" class="btn-cta">Open Two-Lane Highways <span aria-hidden="true">→</span></a>
          <a
            href="https://nap.nationalacademies.org/catalog/26432/highway-capacity-manual-7th-edition-a-guide-for-multimodal-mobility"
            target="_blank"
            rel="noreferrer"
            class="btn-link"
          >HCM 7th Edition reference</a>
        </div>
      </div>

      <div class="hero-media">
        <div class="hcmimg book-card">
          <img src="hcm7th.jpg" alt="HCM 7th edition" />
          <div class="middle">
            <div class="text">
              <a
                href="https://nap.nationalacademies.org/catalog/26432/highway-capacity-manual-7th-edition-a-guide-for-multimodal-mobility"
                target="_blank"
                rel="noreferrer"
              >+ See</a>
            </div>
          </div>
        </div>
        <p class="book-caption">Highway Capacity Manual, 7th Edition</p>
      </div>
    </div>
  </section>

  <!-- Capabilities -->
  <section class="capabilities">
    <div class="cap">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="1.5" />
        <path d="M9 1.5v3M15 1.5v3M9 19.5v3M15 19.5v3M1.5 9h3M1.5 15h3M19.5 9h3M19.5 15h3" />
      </svg>
      <h3>WebAssembly engine</h3>
      <p>Calculations run locally in a compiled Rust core — fast, offline, and identical on every run.</p>
    </div>
    <div class="cap">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 3h10l4 4v14H5z" />
        <path d="M14 3v5h5" />
        <path d="M8.5 14.5l2 2 4-4.5" />
      </svg>
      <h3>HCM-faithful methodology</h3>
      <p>Follows the manual step by step, including vertical and horizontal alignment effects on each segment.</p>
    </div>
    <div class="cap">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M8 4H6a2 2 0 0 0-2 2v3c0 1-.5 3-2 3 1.5 0 2 2 2 3v3a2 2 0 0 0 2 2h2" />
        <path d="M16 4h2a2 2 0 0 1 2 2v3c0 1 .5 3 2 3-1.5 0-2 2-2 3v3a2 2 0 0 1-2 2h-2" />
      </svg>
      <h3>Reproducible analyses</h3>
      <p>Import and export inputs as JSON to version, share, and re-run any study exactly as configured.</p>
    </div>
  </section>

  <!-- Available chapters -->
  <section class="chapters">
    <div class="chapters-head">
      <h2>Available chapters</h2>
      <span class="chapters-meta">Basic Freeway Segments and Two-Lane Highways</span>
    </div>

    <a class="chapter-row" href="/hcm12">
      <span class="chapter-no">12</span>
      <span class="chapter-body">
        <span class="chapter-name">Basic Freeway and Multilane Highway Segments</span>
        <span class="chapter-desc">Free-flow speed, capacity, density, and level of service for basic freeway segments</span>
      </span>
      <span class="chapter-status available">Available</span>
    </a>

    <a class="chapter-row" href="/hcm15">
      <span class="chapter-no">15</span>
      <span class="chapter-body">
        <span class="chapter-name">Two-Lane Highways</span>
        <span class="chapter-desc">Level of service, follower density, average speed, and passing analysis</span>
      </span>
      <span class="chapter-status available">Available</span>
    </a>
  </section>

  <!-- Credits -->
  <section class="about-section">
    <p>
      Built by
      <a href="https://reis-portfolio.vercel.app" target="_blank" rel="noreferrer">Rei Tamaru</a>,
      an ITS Engineer at HNTB. This is an independent, personally built tool and is
      not affiliated with any organization or corporation.
    </p>
    <p>
      Questions or issues? Feel free to
      <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">open an issue on GitHub</a>.
    </p>
  </section>
</div>
