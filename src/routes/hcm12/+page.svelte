<svelte:head>
  <title>HCM Calculator — Basic Freeway Segments</title>
</svelte:head>

<script>
  import init, { WasmBasicFreeways } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Inputs (defaults follow the HCM Chapter 12 base conditions)
  let bffs = 65;
  let speed_limit = 65;
  let lane_count = 2;
  let lane_width = 12;
  let lc_r = 6;
  let trd = 0;
  let grade = 0;
  let terrain_type = 'level';
  let length = 0.625;
  let demand_flow_i = 1000;
  let phf = 0.95;
  let phv = 5;
  let sut_percentage = 0;   // 0 = general terrain; 30/50/70 select the specific-upgrade exhibits
  let city_type = 'urban';

  let results = null;
  let hasError = false;
  let errMessage = '';

  // The specific-upgrade exhibits (12-26/27/28) are keyed on grade + length; the
  // general-terrain exhibit (12-25) is keyed on terrain and ignores them. Surface
  // that in the UI so the grade/length inputs don't look silently inert.
  $: usesGrade = Number(sut_percentage) !== 0;

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const fw = new WasmBasicFreeways(
        Number(bffs),
        Number(lane_width),
        Number(lane_count),
        Number(lc_r),
        6,                     // lc_l, left-side lateral clearance (base condition)
        Number(trd),
        0,                     // apd, access points per mile (multilane only)
        Number(grade),
        terrain_type,
        Number(speed_limit),
        Number(phf),
        Number(phv) / 100.0,   // UI takes percent, the engine takes a decimal
        Number(demand_flow_i),
        Number(length),
        'basic',
        city_type,
        Number(sut_percentage) // 0 -> Exhibit 12-25; 30/50/70 -> Exhibits 12-26/27/28
      );

      const los = fw.run_operational_analysis();
      const p_t = Number(phv) / 100.0;
      const e_t = fw.get_e_t();
      const speed = fw.get_speed();
      const density = fw.get_density();
      results = {
        los,
        ffs: fw.get_ffs(),
        capacity: fw.get_capacity(),
        adjusted_capacity: fw.get_adjusted_capacity(),
        speed,
        density,
        vc_ratio: fw.get_vc_ratio(),
        e_t,
        // f_HV = 1 / (1 + P_T (E_T - 1)); v_p = D x S (identity D = v_p / S).
        f_hv: e_t > 0 ? 1.0 / (1.0 + p_t * (e_t - 1.0)) : null,
        v_p: density * speed
      };
    } catch (err) {
      console.error('Chapter 12 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    bffs = 65;
    speed_limit = 65;
    lane_count = 2;
    lane_width = 12;
    lc_r = 6;
    trd = 0;
    grade = 0;
    terrain_type = 'level';
    length = 0.625;
    demand_flow_i = 1000;
    phf = 0.95;
    phv = 5;
    sut_percentage = 0;
    city_type = 'urban';
    results = null;
    hasError = false;
  }

  // LOS letter -> colour band for the results badge.
  function losClass(los) {
    switch (los) {
      case 'A':
      case 'B': return 'los-badge los-good';
      case 'C':
      case 'D': return 'los-badge los-warn';
      default:  return 'los-badge los-bad';   // E, F
    }
  }

  // Clamp the drawn lane count so the diagram stays readable.
  $: drawnLanes = Math.max(1, Math.min(6, Number(lane_count) || 1));
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Chapter 12 · Basic Freeway Segments <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Basic Freeway Segments</h1>
    <p class="page-sub">
      Estimate free-flow speed, capacity, density, and level of service for a
      basic freeway segment in the analysis direction.
    </p>
  </header>

  <div class="alert alert-warning shadow-sm mb-6 beta-note" role="note">
    <span>
      <strong>Beta.</strong> This chapter is newly implemented and its results have
      not yet been validated against the full set of published HCM worked examples.
      Verify results independently before relying on them in engineering work, and
      please <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm12" on:submit|preventDefault={runAnalysis}>
    <!-- Geometry -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Geometry</h2>
          <p class="panel-sub">Cross-section and alignment of the analysis segment.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="LC_input">Lanes (analysis direction)</label>
          <div class="cell-field">
            <input id="LC_input" type="number" min="1" max="6" class="input input-bordered input-sm" bind:value={lane_count} required />
          </div>
        </div>

        <div class="param-field">
          <label for="LW_input">Lane Width</label>
          <div class="cell-field">
            <input id="LW_input" type="number" step="0.5" class="input input-bordered input-sm" bind:value={lane_width} placeholder="12" required />
            <span class="unit">ft</span>
          </div>
        </div>

        <div class="param-field">
          <label for="LCR_input">Right-Side Lateral Clearance</label>
          <div class="cell-field">
            <input id="LCR_input" type="number" min="0" class="input input-bordered input-sm" bind:value={lc_r} placeholder="6" required />
            <span class="unit">ft</span>
          </div>
        </div>

        <div class="param-field">
          <label for="TRD_input">Total Ramp Density</label>
          <div class="cell-field">
            <input id="TRD_input" type="number" min="0" class="input input-bordered input-sm" bind:value={trd} placeholder="0" required />
            <span class="unit">/mi</span>
          </div>
        </div>

        <div class="param-field">
          <label for="LEN_input">Segment Length</label>
          <div class="cell-field">
            <input id="LEN_input" type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={length} placeholder="0.625" required class:input-inert={!usesGrade} />
            <span class="unit">mi</span>
          </div>
        </div>

        <div class="param-field">
          <label for="GRADE_input">Grade</label>
          <div class="cell-field">
            <input id="GRADE_input" type="number" step="0.1" class="input input-bordered input-sm" bind:value={grade} placeholder="0" required class:input-inert={!usesGrade} />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="TERRAIN_input">Terrain</label>
          <select id="TERRAIN_input" class="select select-bordered select-sm" bind:value={terrain_type} disabled={usesGrade}>
            <option value="level">Level</option>
            <option value="rolling">Rolling</option>
            <option value="mountainous">Mountainous</option>
          </select>
        </div>

        <div class="param-field">
          <label for="CITY_input">Area Type</label>
          <select id="CITY_input" class="select select-bordered select-sm" bind:value={city_type}>
            <option value="urban">Urban</option>
            <option value="rural">Rural</option>
          </select>
        </div>
      </div>

      <!-- Reactive plan view of the analysis direction. -->
      <div class="freeway-diagram" role="img" aria-label={`${drawnLanes}-lane basic freeway segment, analysis direction`}>
        <svg viewBox="0 0 240 {18 * drawnLanes + 26}" preserveAspectRatio="xMidYMid meet">
          <!-- pavement -->
          <rect x="0" y="8" width="240" height={18 * drawnLanes} class="fw-pavement" />
          <!-- solid edge lines -->
          <line x1="0" y1="8" x2="240" y2="8" class="fw-edge" />
          <line x1="0" y1={8 + 18 * drawnLanes} x2="240" y2={8 + 18 * drawnLanes} class="fw-edge" />
          <!-- dashed lane lines between lanes -->
          {#each Array.from({ length: Math.max(0, drawnLanes - 1) }) as _, i}
            <line x1="0" y1={8 + 18 * (i + 1)} x2="240" y2={8 + 18 * (i + 1)} class="fw-lane-line" />
          {/each}
          <!-- direction arrow -->
          <polygon points="188,{8 + 9 * drawnLanes} 208,{8 + 9 * drawnLanes} 208,{8 + 9 * drawnLanes - 4} 220,{8 + 9 * drawnLanes} 208,{8 + 9 * drawnLanes + 4} 208,{8 + 9 * drawnLanes} " class="fw-arrow" />
          <!-- right shoulder band -->
          <rect x="0" y={8 + 18 * drawnLanes} width="240" height="10" class="fw-shoulder" />
          <text x="4" y={8 + 18 * drawnLanes + 8} class="fw-label">shoulder · {lc_r} ft clearance</text>
        </svg>
        <p class="diagram-caption">{drawnLanes} lane{drawnLanes === 1 ? '' : 's'} @ {lane_width} ft · analysis direction →</p>
      </div>
    </section>

    <!-- Traffic -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Traffic</h2>
          <p class="panel-sub">Demand and traffic-stream characteristics.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="DEMAND_input">Directional Demand</label>
          <div class="cell-field">
            <input id="DEMAND_input" type="number" min="0" class="input input-bordered input-sm" bind:value={demand_flow_i} placeholder="1000" required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="0.95" required />
          </div>
        </div>

        <div class="param-field">
          <label for="PHV_input">Heavy Vehicles</label>
          <div class="cell-field">
            <input id="PHV_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="5" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="SUT_input">Heavy-Vehicle Mix</label>
          <select id="SUT_input" class="select select-bordered select-sm" bind:value={sut_percentage}>
            <option value={0}>General terrain (mix unknown)</option>
            <option value={30}>30% single-unit trucks</option>
            <option value={50}>50% single-unit trucks</option>
            <option value={70}>70% single-unit trucks</option>
          </select>
          <p class="param-hint">
            {#if usesGrade}
              Uses the specific-upgrade exhibits (12-26/27/28), keyed on grade and length.
            {:else}
              Uses the general-terrain exhibit (12-25); grade and length do not enter.
            {/if}
          </p>
        </div>

        <div class="param-field">
          <label for="SPL_input">Posted Speed Limit</label>
          <div class="cell-field">
            <input id="SPL_input" type="number" min="0" class="input input-bordered input-sm" bind:value={speed_limit} placeholder="65" required />
            <span class="unit">mph</span>
          </div>
        </div>

        <div class="param-field">
          <label for="BFFS_input">Base Free-Flow Speed</label>
          <div class="cell-field">
            <input id="BFFS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={bffs} placeholder="65" required />
            <span class="unit">mph</span>
          </div>
          <p class="param-hint">Use 65 mph when a measured value is not available.</p>
        </div>
      </div>
    </section>

    <!-- Form Actions -->
    <div class="action-bar">
      <button class="btn btn-ghost" on:click={resetParams} type="button">Reset Params</button>
      <button class="btn btn-primary" type="submit" disabled={!ready}>Calculate</button>
    </div>
  </form>

  <section class="panel results-panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Outputs</h2>
        <p class="panel-sub">The HCM Chapter 12 operational chain, step by step. Results populate after pressing Calculate.</p>
      </div>
      {#if results}
        <div class="los-summary">
          <span class="los-summary-label">Segment LOS</span>
          <span class={losClass(results.los)}>{results.los}</span>
        </div>
      {/if}
    </div>

    <div class="los overflow-x-auto">
      <table class="table w-full step-table">
        <thead>
          <tr><th>Step</th><th>Quantity</th><th class="num">Value</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="step-num">1</td>
            <th>Free-flow speed, FFS</th>
            <td class="num">{results ? results.ffs.toFixed(1) + ' mi/h' : '—'}</td>
          </tr>
          <tr>
            <td class="step-num">2</td>
            <th>Base capacity</th>
            <td class="num">{results ? results.capacity.toFixed(0) + ' pc/h/ln' : '—'}</td>
          </tr>
          <tr>
            <td class="step-num"></td>
            <th>Adjusted capacity</th>
            <td class="num">{results ? results.adjusted_capacity.toFixed(0) + ' pc/h/ln' : '—'}</td>
          </tr>
          <tr>
            <td class="step-num">3</td>
            <th>Passenger-car equivalent, E<sub>T</sub></th>
            <td class="num">{results ? results.e_t.toFixed(2) : '—'}</td>
          </tr>
          <tr>
            <td class="step-num"></td>
            <th>Heavy-vehicle factor, f<sub>HV</sub></th>
            <td class="num">{results && results.f_hv != null ? results.f_hv.toFixed(3) : '—'}</td>
          </tr>
          <tr>
            <td class="step-num">4</td>
            <th>Demand flow rate, v<sub>p</sub></th>
            <td class="num">{results ? results.v_p.toFixed(0) + ' pc/h/ln' : '—'}</td>
          </tr>
          <tr>
            <td class="step-num">5</td>
            <th>Space mean speed, S</th>
            <td class="num">{results ? results.speed.toFixed(1) + ' mi/h' : '—'}</td>
          </tr>
          <tr>
            <td class="step-num"></td>
            <th>Volume-to-capacity ratio, v/c</th>
            <td class="num">{results ? results.vc_ratio.toFixed(2) : '—'}</td>
          </tr>
          <tr>
            <td class="step-num">6</td>
            <th>Density, D</th>
            <td class="num">{results ? results.density.toFixed(1) + ' pc/mi/ln' : '—'}</td>
          </tr>
          <tr class="step-los">
            <td class="step-num">7</td>
            <th>Level of service</th>
            <td class="num">{results ? results.los : '—'}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Density and LOS follow HCM Exhibit 12-15. E<sub>T</sub> is read from {usesGrade ? `the ${sut_percentage}% specific-upgrade exhibit` : 'the general-terrain exhibit (12-25)'}.</p>
      </div>
    </div>
  </section>
</div>

<style>
  .freeway-diagram {
    margin-top: 1rem;
    max-width: 420px;
  }
  .freeway-diagram svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .fw-pavement { fill: color-mix(in srgb, currentColor 8%, transparent); }
  .fw-shoulder { fill: color-mix(in srgb, currentColor 4%, transparent); }
  .fw-edge { stroke: currentColor; stroke-width: 1.5; opacity: 0.85; }
  .fw-lane-line { stroke: currentColor; stroke-width: 1; stroke-dasharray: 8 7; opacity: 0.5; }
  .fw-arrow { fill: currentColor; opacity: 0.6; }
  .fw-label { font-size: 7px; fill: currentColor; opacity: 0.55; }
  .diagram-caption {
    font-size: 0.75rem;
    opacity: 0.65;
    margin-top: 0.35rem;
  }
  .los-summary {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }
  .los-summary-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.6;
  }
  .los-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.5rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: #fff;
  }
  .los-good { background: #16a34a; }
  .los-warn { background: #d97706; }
  .los-bad  { background: #dc2626; }
  .step-table .step-num {
    width: 3rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
    opacity: 0.6;
  }
  .step-table td.num, .step-table th.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .step-table tr.step-los th, .step-table tr.step-los td { font-weight: 700; }
  .input-inert { opacity: 0.5; }
</style>
