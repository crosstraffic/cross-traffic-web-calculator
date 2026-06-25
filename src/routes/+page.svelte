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
        <span class="badge badge-outline hero-badge">Highway Capacity Manual · 7th Edition</span>
        <h1 class="hero-title">
          HCM <span class="hero-accent">Calculator</span>
        </h1>
        <p class="hero-lead">
          A third-party web tool that delivers quick, reliable solutions for
          Highway Capacity Manual (HCM) calculations — paired with simple figures
          that make every result easy to understand.
        </p>
        <div class="hero-actions">
          <a href="/hcm15" class="btn btn-primary">Open Chapter 15 Calculator</a>
          <a
            href="https://nap.nationalacademies.org/catalog/26432/highway-capacity-manual-7th-edition-a-guide-for-multimodal-mobility"
            target="_blank"
            rel="noreferrer"
            class="btn btn-ghost"
          >
            About the HCM →
          </a>
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

  <!-- Feature cards -->
  <section class="feature-section">
    <div class="feature-card">
      <div class="feature-icon">⚡</div>
      <h3>Quick Solutions</h3>
      <p>Run full HCM calculations in the browser — powered by a fast WebAssembly compute core.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">📊</div>
      <h3>Visual Figures</h3>
      <p>Clear diagrams accompany the numbers so methodology and results are easy to follow.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🛣️</div>
      <h3>Chapter Coverage</h3>
      <p>Starting with Chapter 15 (Two-Lane Highways), with more chapters on the way.</p>
    </div>
  </section>

  <!-- About / credits -->
  <section class="about-section">
    <p>
      Launched in November 2022 by
      <a href="https://reis-portfolio.vercel.app" target="_blank" rel="noreferrer">Rei Tamaru</a>,
      a PhD student at the University of Wisconsin–Madison.
    </p>
    <p>
      You can find the latest HCM (7th Edition) at the
      <a
        href="https://nap.nationalacademies.org/catalog/26432/highway-capacity-manual-7th-edition-a-guide-for-multimodal-mobility"
        target="_blank"
        rel="noreferrer"
      >National Academies</a>
      or on
      <a href="https://amzn.to/3ipmRXN" target="_blank" rel="noreferrer">Amazon</a>.
    </p>
    <p>
      For website inquiries, please
      <a href="mailto:tamaru@wisc.edu">email me</a>.
    </p>
  </section>
</div>
