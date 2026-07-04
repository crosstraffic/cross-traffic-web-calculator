<svelte:head>
  <title>HCM Calculator — Freeway Merge and Diverge Segments</title>
</svelte:head>

<script>
  import init, { WasmRampSegment } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Inputs (defaults follow the HCM Chapter 14 base conditions)
  let ramp_type = 'on_ramp';
  let ramp_side = 'right';
  let ramp_lanes = 1;
  let freeway_lanes = 3;
  let terrain = 'level';
  let accel_lane_length = 800;
  let decel_lane_length = 400;
  let freeway_ffs = 70;
  let ramp_ffs = 35;
  let freeway_demand = 4000;
  let ramp_demand = 500;
  let phf = 0.94;
  let phv = 5;
  let ramp_phv = 5;
  let caf = 1.0;
  let saf = 1.0;

  let results = null;
  let hasError = false;
  let errMessage = '';

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const rs = new WasmRampSegment(
        ramp_type,
        ramp_side,
        Number(ramp_lanes),
        Number(freeway_lanes),
        Number(freeway_ffs),
        Number(ramp_ffs),
        Number(accel_lane_length),
        undefined,             // accel_lane_length2, second lane of a two-lane ramp
        Number(decel_lane_length),
        undefined,             // decel_lane_length2, second lane of a two-lane ramp
        Number(freeway_demand),
        Number(ramp_demand),
        Number(phf),
        Number(phv) / 100.0,   // UI takes percent, the engine takes a decimal
        Number(ramp_phv) / 100.0,
        terrain,
        undefined,             // adjacent_upstream ramp type
        undefined,             // upstream_distance
        undefined,             // upstream_ramp_flow
        undefined,             // adjacent_downstream ramp type
        undefined,             // downstream_distance
        undefined,             // downstream_ramp_flow
        Number(caf),
        Number(saf)
      );

      const los = rs.run_analysis();
      results = {
        los,
        flow_freeway: rs.get_flow_freeway(),
        flow_ramp: rs.get_flow_ramp(),
        v12: rs.get_v12(),
        capacity_freeway: rs.get_capacity_freeway(),
        capacity_ramp: rs.get_capacity_ramp(),
        vc_ratio: rs.get_vc_ratio(),
        demand_exceeds_capacity: rs.get_demand_exceeds_capacity(),
        density: rs.get_density(),
        speed_ramp: rs.get_speed_ramp(),
        speed_avg: rs.get_speed_avg()
      };
    } catch (err) {
      console.error('Chapter 14 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    ramp_type = 'on_ramp';
    ramp_side = 'right';
    ramp_lanes = 1;
    freeway_lanes = 3;
    terrain = 'level';
    accel_lane_length = 800;
    decel_lane_length = 400;
    freeway_ffs = 70;
    ramp_ffs = 35;
    freeway_demand = 4000;
    ramp_demand = 500;
    phf = 0.94;
    phv = 5;
    ramp_phv = 5;
    caf = 1.0;
    saf = 1.0;
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Chapter 14 · Freeway Merge and Diverge Segments <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Freeway Merge and Diverge Segments</h1>
    <p class="page-sub">
      Estimate ramp influence area density, speeds, and level of service for a
      ramp-freeway junction.
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

  <form id="hcm14" on:submit|preventDefault={runAnalysis}>
    <!-- Configuration -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Configuration</h2>
          <p class="panel-sub">Junction type and geometry of the ramp-freeway junction.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="RT_input">Ramp Type</label>
          <select id="RT_input" class="select select-bordered select-sm" bind:value={ramp_type}>
            <option value="on_ramp">On-Ramp (Merge)</option>
            <option value="off_ramp">Off-Ramp (Diverge)</option>
            <option value="major_merge">Major Merge</option>
            <option value="major_diverge">Major Diverge</option>
          </select>
        </div>

        <div class="param-field">
          <label for="RS_input">Ramp Side</label>
          <select id="RS_input" class="select select-bordered select-sm" bind:value={ramp_side}>
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </div>

        <div class="param-field">
          <label for="RL_input">Ramp Lanes</label>
          <select id="RL_input" class="select select-bordered select-sm" bind:value={ramp_lanes}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>

        <div class="param-field">
          <label for="FL_input">Freeway Lanes (one direction)</label>
          <div class="cell-field">
            <input id="FL_input" type="number" min="2" max="5" class="input input-bordered input-sm" bind:value={freeway_lanes} required />
          </div>
        </div>

        <div class="param-field">
          <label for="LA_input">Acceleration Lane Length (L_A)</label>
          <div class="cell-field">
            <input id="LA_input" type="number" min="0" class="input input-bordered input-sm" bind:value={accel_lane_length} placeholder="800" required />
            <span class="unit">ft</span>
          </div>
          <p class="param-hint">Used for on-ramps and major merges.</p>
        </div>

        <div class="param-field">
          <label for="LD_input">Deceleration Lane Length (L_D)</label>
          <div class="cell-field">
            <input id="LD_input" type="number" min="0" class="input input-bordered input-sm" bind:value={decel_lane_length} placeholder="400" required />
            <span class="unit">ft</span>
          </div>
          <p class="param-hint">Used for off-ramps and major diverges.</p>
        </div>

        <div class="param-field">
          <label for="TERRAIN_input">Terrain</label>
          <select id="TERRAIN_input" class="select select-bordered select-sm" bind:value={terrain}>
            <option value="level">Level</option>
            <option value="rolling">Rolling</option>
            <option value="mountainous">Mountainous</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Traffic -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Traffic</h2>
          <p class="panel-sub">Freeway and ramp demand and traffic-stream characteristics.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="VF_input">Freeway Demand</label>
          <div class="cell-field">
            <input id="VF_input" type="number" min="0" class="input input-bordered input-sm" bind:value={freeway_demand} placeholder="4000" required />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">Demand immediately upstream of the junction.</p>
        </div>

        <div class="param-field">
          <label for="VR_input">Ramp Demand</label>
          <div class="cell-field">
            <input id="VR_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ramp_demand} placeholder="500" required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="FFS_input">Freeway Free-Flow Speed</label>
          <div class="cell-field">
            <input id="FFS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={freeway_ffs} placeholder="70" required />
            <span class="unit">mph</span>
          </div>
        </div>

        <div class="param-field">
          <label for="RFFS_input">Ramp Free-Flow Speed</label>
          <div class="cell-field">
            <input id="RFFS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ramp_ffs} placeholder="35" required />
            <span class="unit">mph</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="0.94" required />
          </div>
        </div>

        <div class="param-field">
          <label for="PHV_input">Heavy Vehicles (Freeway)</label>
          <div class="cell-field">
            <input id="PHV_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="5" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="RPHV_input">Heavy Vehicles (Ramp)</label>
          <div class="cell-field">
            <input id="RPHV_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={ramp_phv} placeholder="5" required />
            <span class="unit">%</span>
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
            <th>Freeway Flow Rate (pc/hr):</th>
            <td>{results ? results.flow_freeway.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Ramp Flow Rate (pc/hr):</th>
            <td>{results ? results.flow_ramp.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Flow in Lanes 1 and 2 (pc/hr):</th>
            <td>{results ? results.v12.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Freeway Capacity (pc/hr):</th>
            <td>{results ? results.capacity_freeway.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Ramp Capacity (pc/hr):</th>
            <td>{results ? results.capacity_ramp.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Volume-to-Capacity Ratio:</th>
            <td>{results ? results.vc_ratio.toFixed(2) : ''}</td>
          </tr>
          <tr>
            <th>Demand Exceeds Capacity:</th>
            <td>{results ? (results.demand_exceeds_capacity ? 'Yes, LOS F' : 'No') : ''}</td>
          </tr>
          <tr>
            <th>Ramp Influence Area Density (pc/mi/ln):</th>
            <td>{results ? results.density.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Ramp Influence Area Speed (mi/hr):</th>
            <td>{results ? results.speed_ramp.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Average Speed, All Lanes (mi/hr):</th>
            <td>{results ? results.speed_avg.toFixed(1) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Segment LOS: {results ? results.los : ''}</p>
      </div>
    </div>
  </section>
</div>
