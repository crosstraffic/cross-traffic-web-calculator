<svelte:head>
  <title>Guide · HCM Calculator</title>
</svelte:head>

<div class="guide-page">
  <header class="page-header">
    <p class="eyebrow">How to use the HCM Calculator</p>
    <h1 class="page-title">Guide</h1>
    <p class="page-sub">
      A quick walkthrough of the HCM Chapter 15 (Two-Lane Highways) and Chapter 12
      (Basic Freeway Segments) analyses — from defining inputs to reading the results.
    </p>
  </header>

  <div class="guide-layout">
    <aside class="guide-sidenav">
      <nav aria-label="Guide sections">
        <p class="guide-sidenav-title">On this page</p>
        <a href="#getting-started">Getting started</a>
        <a href="#two-lane-inputs">Inputs · Two-Lane</a>
        <a href="#facility-layout">Facility layout</a>
        <a href="#outputs">Outputs &amp; LOS</a>
        <a href="#basic-freeway">Basic Freeway Segments</a>
        <a href="#open-source">Open source</a>
      </nav>
    </aside>
    <div class="guide-body">

  <!-- Getting started -->
  <section id="getting-started" class="guide-section">
    <h2>Getting started</h2>
    <ol class="guide-steps">
      <li>Open <a href="/hcm15">Two-Lane Highways</a> from the navigation.</li>
      <li>
        <strong>Define your segments</strong> in the Segments table. For each segment set its
        passing type, length, grade, posted speed, demand volumes, vertical class, PHF, and
        heavy-vehicle&nbsp;%.
      </li>
      <li>
        Set the <strong>General Parameters</strong> that apply to the whole facility
        (lane width, shoulder width, access point density, and the passing-lane heavy-vehicle
        multiplier).
      </li>
      <li>
        Enable <strong>Horizontal curves</strong> on a segment to add curved subsegments with
        their design radius and superelevation.
      </li>
      <li>Press <strong>Calculate</strong>. Results appear in the Outputs table.</li>
      <li>
        Use <strong>Export as JSON</strong> to save your inputs and the JSON importer to reload
        them later.
      </li>
    </ol>
    <a href="/hcm15" class="guide-cta">Open Two-Lane Highways <span aria-hidden="true">→</span></a>
  </section>

  <!-- Inputs -->
  <section id="two-lane-inputs" class="guide-section">
    <h2>Inputs</h2>

    <h3>Per segment</h3>
    <table class="guide-table">
      <thead><tr><th>Field</th><th>Meaning</th><th>Unit</th></tr></thead>
      <tbody>
        <tr><td>Passing Type</td><td>Passing Constrained, Passing Zone, or Passing Lane</td><td>—</td></tr>
        <tr><td>Length</td><td>Segment length</td><td>mi</td></tr>
        <tr><td>Grade</td><td>Longitudinal grade (signed)</td><td>%</td></tr>
        <tr><td>Posted Speed</td><td>Posted speed limit</td><td>mph</td></tr>
        <tr><td>Demand Vol.</td><td>Demand flow rate, analysis direction</td><td>veh/h</td></tr>
        <tr><td>Opposing Vol.</td><td>Demand flow rate, opposing direction</td><td>veh/h</td></tr>
        <tr><td>Vertical Class</td><td>Vertical alignment class (1–5)</td><td>—</td></tr>
        <tr><td>PHF</td><td>Peak hour factor</td><td>—</td></tr>
        <tr><td>% Heavy Veh.</td><td>Percentage of heavy vehicles</td><td>%</td></tr>
      </tbody>
    </table>
    <p>Horizontal-curve subsegments add <strong>Length (ft)</strong>,
      <strong>Design Radius (ft)</strong>, and <strong>Superelevation (%)</strong>.</p>

    <h3>Facility-wide</h3>
    <table class="guide-table">
      <thead><tr><th>Field</th><th>Meaning</th><th>Unit</th></tr></thead>
      <tbody>
        <tr><td>Lane Width</td><td>Travel lane width</td><td>ft</td></tr>
        <tr><td>Shoulder Width</td><td>Shoulder width</td><td>ft</td></tr>
        <tr><td>Access Point Density</td><td>Access points per mile</td><td>/mi</td></tr>
        <tr><td>Heavy Vehicles in Passing Lane</td><td>Multiplier, used only when a Passing Lane segment is present</td><td>%</td></tr>
      </tbody>
    </table>
  </section>

  <!-- Facility layout -->
  <section id="facility-layout" class="guide-section">
    <h2>Facility layout (2D &amp; 3D)</h2>
    <p>The Facility Layout panel visualizes the whole facility as one connected road.</p>
    <ul class="guide-list">
      <li><strong>2D</strong> — a flat segment-by-segment schematic strip (solid centerline =
        Passing Constrained, dashed = Passing Zone, widening = Passing Lane).</li>
      <li><strong>3D</strong> — a connected ribbon where <em>bends</em> reflect horizontal curves,
        <em>slope</em> reflects grade, <em>banking</em> reflects superelevation, and the road
        <em>widens</em> for passing lanes. Drag to rotate, <strong>Alt-drag</strong> to pan,
        scroll / pinch to zoom.</li>
      <li><strong>Expand &amp; Edit</strong> — turns the layout into an editable pane so you can
        enter and modify each segment directly there (in sync with the Segments table).</li>
    </ul>
  </section>

  <!-- Outputs -->
  <section id="outputs" class="guide-section">
    <h2>Outputs &amp; Level of Service</h2>
    <p>After <strong>Calculate</strong>, each segment reports:</p>
    <table class="guide-table">
      <thead><tr><th>Output</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td>Free-flow Speed (mi/hr)</td><td>Estimated free-flow speed (FFS)</td></tr>
        <tr><td>Average Speed (mi/hr)</td><td>Estimated average travel speed</td></tr>
        <tr><td>Percent followers (%)</td><td>Percent of vehicles following, analysis direction</td></tr>
        <tr><td>Followers Density (followers/mi)</td><td>Follower density — the LOS service measure</td></tr>
        <tr><td>Segment LOS</td><td>Level of service A–F for the segment</td></tr>
      </tbody>
    </table>
    <p>
      The summary reports the <strong>Facility LOS</strong> and <strong>Facility Follower
      Density</strong> (length-weighted across segments). For two-lane highways, LOS is keyed to
      <strong>follower density</strong> per HCM 7th Edition Chapter 15 (lower is better, A → F);
      exact breakpoints depend on posted speed — see the
      <a href="https://nap.nationalacademies.org/catalog/26432/highway-capacity-manual-7th-edition-a-guide-for-multimodal-mobility" target="_blank" rel="noreferrer">HCM</a>
      for the authoritative thresholds. LOS <strong>F</strong> means demand exceeds capacity.
    </p>
  </section>

  <!-- Basic Freeway Segments -->
  <section id="basic-freeway" class="guide-section">
    <h2>Basic Freeway Segments (Chapter 12)</h2>
    <p>
      <a href="/hcm12">Basic Freeway Segments</a> analyzes a single directional freeway
      segment — the HCM Chapter 12 method. A basic freeway segment is one unit of analysis;
      for a multi-segment freeway <em>facility</em> (basic, merge, diverge, and weaving
      segments together), use <a href="/hcm10">Freeway Facilities</a> instead.
    </p>
    <ol class="guide-steps">
      <li>Open <a href="/hcm12">Basic Freeway Segments</a>, or press <strong>Load example</strong> to start from a sample segment.</li>
      <li>Set the <strong>Geometry</strong>: lanes in the analysis direction, lane width,
        right-side lateral clearance, ramp density, length, grade, terrain, and area type.</li>
      <li>Set the <strong>Traffic</strong>: directional demand, PHF, heavy-vehicle&nbsp;%,
        posted speed, and base free-flow speed.</li>
      <li>Choose the <strong>Heavy-Vehicle Mix</strong> — see the note below.</li>
      <li>Press <strong>Calculate</strong>. The Outputs panel walks the operational chain step by step.</li>
      <li>Use <strong>Export JSON</strong> to save your inputs and the importer to reload them later.</li>
    </ol>

    <h3>Heavy-Vehicle Mix (the key Chapter 12 choice)</h3>
    <p>This selects how the passenger-car equivalent E<sub>T</sub> is read:</p>
    <ul class="guide-list">
      <li><strong>General terrain (mix unknown)</strong> — HCM Exhibit 12-25, keyed on terrain
        (level / rolling / mountainous). Grade and length do <em>not</em> enter the result.</li>
      <li><strong>30 / 50 / 70% single-unit trucks</strong> — the specific-upgrade exhibits
        (12-26 / 12-27 / 12-28), keyed on grade and length. Choose one of these when the truck
        composition is known and you are analyzing a specific upgrade.</li>
    </ul>

    <h3>Outputs</h3>
    <p>The operational chain is reported step by step:</p>
    <table class="guide-table">
      <thead><tr><th>Step</th><th>Output</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Free-flow speed (FFS)</td></tr>
        <tr><td>2</td><td>Base and adjusted capacity</td></tr>
        <tr><td>3</td><td>Passenger-car equivalent E<sub>T</sub> and heavy-vehicle factor f<sub>HV</sub></td></tr>
        <tr><td>4</td><td>Demand flow rate v<sub>p</sub></td></tr>
        <tr><td>5</td><td>Space mean speed and volume-to-capacity ratio</td></tr>
        <tr><td>6</td><td>Density</td></tr>
        <tr><td>7</td><td>Level of service (A–F, per HCM Exhibit 12-15, keyed on density)</td></tr>
      </tbody>
    </table>
    <p>
      The <strong>Plan / 3D</strong> toggle shows the segment as a flat cross-section, or a
      drag-to-rotate 3D deck where the lanes recede into the distance and the grade lifts the
      far end. Drag to rotate, <strong>Alt-drag</strong> to pan, scroll / pinch to zoom.
    </p>
    <a href="/hcm12" class="guide-cta">Open Basic Freeway Segments <span aria-hidden="true">→</span></a>
  </section>

  <!-- Source -->
  <section id="open-source" class="guide-section">
    <h2>Open source</h2>
    <p>
      Calculations run locally in a Rust compute core compiled to WebAssembly. The project is
      open source — issues and contributions are welcome.
    </p>
    <p>
      This is an independent, personally built tool and is not affiliated with any organization
      or corporation.
    </p>
    <a
      class="guide-cta guide-cta-ghost"
      href="https://github.com/crosstraffic/cross-traffic-web-calculator"
      target="_blank"
      rel="noreferrer"
    >
      <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      View on GitHub
    </a>
  </section>
    </div>
  </div>
</div>

<style>
  .guide-layout {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 2.5rem;
    align-items: start;
  }
  .guide-sidenav {
    position: sticky;
    top: 5.5rem;
  }
  .guide-sidenav nav { display: flex; flex-direction: column; gap: 0.15rem; }
  .guide-sidenav-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #94a3b8;
    margin: 0 0 0.4rem 0.6rem;
  }
  .guide-sidenav a {
    font-size: 0.85rem;
    color: #475569;
    padding: 0.3rem 0.6rem;
    border-left: 2px solid transparent;
    border-radius: 0 6px 6px 0;
    text-decoration: none;
    transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  }
  .guide-sidenav a:hover {
    color: #ea7317;
    background: #fff5ec;
    border-left-color: #f4c08a;
  }
  .guide-body { min-width: 0; }

  @media (max-width: 820px) {
    .guide-layout { grid-template-columns: 1fr; gap: 1rem; }
    .guide-sidenav { position: static; }
    .guide-sidenav nav {
      flex-flow: row wrap;
      gap: 0.3rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #f1f5f9;
    }
    .guide-sidenav-title { display: none; }
    .guide-sidenav a { border-left: none; border: 1px solid #e2e8f0; border-radius: 999px; }
  }
</style>
