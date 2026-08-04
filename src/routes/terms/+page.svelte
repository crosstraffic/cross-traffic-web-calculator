<svelte:head>
  <title>Terms &amp; Privacy · HCM Calculator</title>
</svelte:head>

<div class="hcm-page terms-page">
  <header class="page-header">
    <p class="eyebrow">Terms of use and privacy</p>
    <h1 class="page-title">Terms &amp; Privacy</h1>
    <p class="page-sub">Last updated August 3, 2026. Using hcm-calculator.com means you accept these terms.</p>
  </header>

  <section class="terms-section">
    <h2>What this site is</h2>
    <p>
      HCM Calculator (https://hcm-calculator.com) is a browser-based implementation of analysis
      procedures from the Highway Capacity Manual, 7th Edition. All computation runs locally in
      your browser through a WebAssembly engine; your inputs are never sent to a server for
      processing.
    </p>
  </section>

  <section class="terms-section">
    <h2>A personal project, not a company product</h2>
    <p>
      This site is the independent, personal work of Rei Tamaru and Jonathan Riel. It is not
      affiliated with, endorsed by, or connected to any employer, company, or organization of
      its authors, and it does not represent the views or products of any such organization.
      It is likewise not affiliated with the Transportation Research Board or the National
      Academies, publishers of the Highway Capacity Manual. The HCM itself is a copyrighted
      publication; this tool implements published procedures but does not reproduce the manual,
      and you need your own copy of the HCM for the authoritative text, exhibits, and
      thresholds.
    </p>
  </section>

  <section class="terms-section">
    <h2>No revenue</h2>
    <p>
      This site is free. We collect no revenue from it in any form: no payments, no
      subscriptions, no advertising, no sponsored content, no affiliate links, and no sale or
      monetization of user data.
    </p>
  </section>

  <section class="terms-section">
    <h2>Engineering disclaimer</h2>
    <p>
      Results from this calculator are provided for informational and educational purposes.
      Although the compute engine is validated against the HCM's published example problems,
      software defects, methodology interpretation differences, and input errors are always
      possible. Results are not engineering advice, and no professional engineer reviews your
      analysis through this site. Verify all results independently before relying on them in
      design, operations, or any decision affecting public safety, and engage a licensed
      professional engineer where the law or the stakes require one.
    </p>
  </section>

  <section class="terms-section">
    <h2>No warranty and limitation of liability</h2>
    <p>
      The site and its results are provided as is, without warranty of any kind, express or
      implied, including fitness for a particular purpose. To the maximum extent permitted by
      law, the authors are not liable for any damages arising from use of this site or reliance
      on its results.
    </p>
  </section>

  <section class="terms-section">
    <h2>Privacy, cookies, and analytics</h2>
    <p>
      Your analysis inputs and results stay on your device. The site stores a small number of
      preferences in your browser: your theme choice, your analytics consent choice, and
      session-scoped run reports that clear when the tab closes. These are functional storage,
      not tracking.
    </p>
    <p>
      With your consent, the site uses Google Analytics to count visits and understand which
      chapters are used, which sets cookies from Google. Analytics loads only after you accept
      the consent prompt, and declining it disables analytics entirely with no effect on any
      feature. Google's processing of analytics data is described in Google's own privacy
      documentation. We do not use any other tracking, and we never see your analysis data.
    </p>
  </section>

  <section class="terms-section">
    <h2>Open source</h2>
    <p>
      The calculator's source code is public in the
      <a href="https://github.com/crosstraffic/cross-traffic-web-calculator" target="_blank" rel="noreferrer">crosstraffic GitHub organization</a>
      under its repository licenses. You are welcome to read it, file issues, and contribute.
      The site's name and logo are not licensed for use in a way that implies endorsement.
    </p>
  </section>

  <section class="terms-section">
    <h2>Changes and contact</h2>
    <p>
      These terms may be updated as the site evolves; the date above reflects the current
      version. Questions or concerns are welcome as
      <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">GitHub issues</a>.
    </p>
  </section>
</div>

<style>
  .terms-page {
    max-width: 46rem;
  }
  .terms-section {
    margin-bottom: 1.75rem;
  }
  .terms-section h2 {
    font-size: 1.15rem;
    margin-bottom: 0.5rem;
    color: var(--text);
  }
  .terms-section p {
    color: var(--text-secondary);
    line-height: 1.65;
    margin-bottom: 0.6rem;
  }
</style>
