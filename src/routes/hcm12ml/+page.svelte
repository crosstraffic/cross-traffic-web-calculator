<svelte:head>
  <title>HCM Calculator — Basic Freeway and Multilane Highway Segments · Managed Lanes</title>
</svelte:head>

<script>
  import init, { WasmManagedLanes } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Inputs (defaults follow the HCM Chapter 12, Section 4 base conditions)
  let lane_type = 'continuous_access';
  let ffs = 65;
  let demand = 1300;
  let gp_density = 30;
  let caf = 1.0;
  let saf = 1.0;

  let results = null;
  let hasError = false;
  let errMessage = '';

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const ml = new WasmManagedLanes(
        lane_type,
        Number(ffs),
        Number(demand),
        Number(gp_density),
        Number(caf),
        Number(saf)
      );

      const los = ml.run_analysis();
      results = {
        los,
        breakpoint: ml.get_breakpoint(),
        capacity: ml.get_capacity(),
        speed: ml.get_speed(),
        density: ml.get_density(),
        friction_active: ml.is_friction_active()
      };
    } catch (err) {
      console.error('Chapter 12 managed lane analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    lane_type = 'continuous_access';
    ffs = 65;
    demand = 1300;
    gp_density = 30;
    caf = 1.0;
    saf = 1.0;
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Managed Lanes <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Basic Freeway and Multilane Highway Segments · Managed Lanes</h1>
    <p class="page-sub">
      Estimate capacity, space mean speed, density, and level of service for a
      basic managed lane segment adjacent to general purpose freeway lanes.
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

  <form id="hcm12ml" on:submit|preventDefault={runAnalysis}>
    <!-- Segment -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Segment</h2>
          <p class="panel-sub">Managed lane separation type and free-flow speed.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="TYPE_input">Segment Type</label>
          <select id="TYPE_input" class="select select-bordered select-sm" bind:value={lane_type}>
            <option value="continuous_access">Continuous Access</option>
            <option value="buffer1">Buffer 1 (single lane, buffer separated)</option>
            <option value="buffer2">Buffer 2 (multilane, buffer separated)</option>
            <option value="barrier1">Barrier 1 (single lane, barrier separated)</option>
            <option value="barrier2">Barrier 2 (multilane, barrier separated)</option>
          </select>
        </div>

        <div class="param-field">
          <label for="FFS_input">Free-Flow Speed</label>
          <div class="cell-field">
            <input id="FFS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ffs} placeholder="65" required />
            <span class="unit">mph</span>
          </div>
        </div>

        <div class="param-field">
          <label for="CAF_input">Capacity Adjustment Factor</label>
          <div class="cell-field">
            <input id="CAF_input" type="number" step="0.01" min="0" max="1" class="input input-bordered input-sm" bind:value={caf} placeholder="1.00" required />
          </div>
          <p class="param-hint">Use 1.00 for base conditions.</p>
        </div>

        <div class="param-field">
          <label for="SAF_input">Speed Adjustment Factor</label>
          <div class="cell-field">
            <input id="SAF_input" type="number" step="0.01" min="0" max="1" class="input input-bordered input-sm" bind:value={saf} placeholder="1.00" required />
          </div>
          <p class="param-hint">Use 1.00 for base conditions.</p>
        </div>
      </div>
    </section>

    <!-- Traffic -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Traffic</h2>
          <p class="panel-sub">Managed lane demand and adjacent general purpose lane density.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="DEMAND_input">Demand Flow Rate</label>
          <div class="cell-field">
            <input id="DEMAND_input" type="number" min="0" class="input input-bordered input-sm" bind:value={demand} placeholder="1300" required />
            <span class="unit">pc/h/ln</span>
          </div>
          <p class="param-hint">15-min average flow rate in the managed lane.</p>
        </div>

        <div class="param-field">
          <label for="KGP_input">Adjacent GP Lane Density</label>
          <div class="cell-field">
            <input id="KGP_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={gp_density} placeholder="30" required />
            <span class="unit">pc/mi/ln</span>
          </div>
          <p class="param-hint">Friction applies above 35 pc/mi/ln for continuous access and Buffer 1 types.</p>
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
            <th>Speed-Flow Breakpoint (pc/hr/ln):</th>
            <td>{results ? results.breakpoint.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Adjusted Capacity (pc/hr/ln):</th>
            <td>{results ? results.capacity.toFixed(0) : ''}</td>
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
            <th>GP Lane Friction Active:</th>
            <td>{results ? (results.friction_active ? 'Yes' : 'No') : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Segment LOS: {results ? results.los : ''}</p>
      </div>
    </div>
  </section>
</div>
