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
  let city_type = 'urban';

  let results = null;
  let hasError = false;
  let errMessage = '';

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
        city_type
      );

      const los = fw.run_operational_analysis();
      results = {
        los,
        ffs: fw.get_ffs(),
        capacity: fw.get_capacity(),
        adjusted_capacity: fw.get_adjusted_capacity(),
        speed: fw.get_speed(),
        density: fw.get_density(),
        vc_ratio: fw.get_vc_ratio()
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
    city_type = 'urban';
    results = null;
    hasError = false;
  }
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
            <input id="LEN_input" type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={length} placeholder="0.625" required />
            <span class="unit">mi</span>
          </div>
        </div>

        <div class="param-field">
          <label for="GRADE_input">Grade</label>
          <div class="cell-field">
            <input id="GRADE_input" type="number" step="0.1" class="input input-bordered input-sm" bind:value={grade} placeholder="0" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="TERRAIN_input">Terrain</label>
          <select id="TERRAIN_input" class="select select-bordered select-sm" bind:value={terrain_type}>
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
        <p class="panel-sub">Results populate after pressing Calculate.</p>
      </div>
    </div>
    <div class="los overflow-x-auto">
      <table class="table w-full">
        <tbody>
          <tr>
            <th>Free-flow Speed (mi/hr):</th>
            <td>{results ? results.ffs.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Base Capacity (pc/hr/ln):</th>
            <td>{results ? results.capacity.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Adjusted Capacity (pc/hr/ln):</th>
            <td>{results ? results.adjusted_capacity.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Space Mean Speed (mi/hr):</th>
            <td>{results ? results.speed.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Density (pc/mi/ln):</th>
            <td>{results ? results.density.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Volume-to-Capacity Ratio:</th>
            <td>{results ? results.vc_ratio.toFixed(2) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Segment LOS: {results ? results.los : ''}</p>
      </div>
    </div>
  </section>
</div>
