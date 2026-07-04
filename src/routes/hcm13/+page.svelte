<svelte:head>
  <title>HCM Calculator — Freeway Weaving Segments</title>
</svelte:head>

<script>
  import init, { WasmWeavingSegment } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Inputs (defaults follow the HCM Chapter 13 base conditions)
  let weaving_type = 'one_sided';
  let facility_type = 'freeway';
  let length_short = 1500;
  let num_lanes = 4;
  let num_weaving_lanes = 2;
  let lc_rf = 1;
  let lc_fr = 1;
  let lc_rr = 0;
  let interchange_density = 0.8;
  let terrain = 'level';
  let ffs = 70;
  let v_ff = 3000;
  let v_fr = 500;
  let v_rf = 500;
  let v_rr = 100;
  let phf = 0.94;
  let phv = 5;
  let basic_freeway_capacity = 2400;
  let caf = 1.0;
  let saf = 1.0;

  let results = null;
  let hasError = false;
  let errMessage = '';

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const ws = new WasmWeavingSegment(
        weaving_type,
        facility_type,
        Number(length_short),
        Number(num_lanes),
        Number(num_weaving_lanes),
        Number(ffs),
        Number(v_ff),
        Number(v_fr),
        Number(v_rf),
        Number(v_rr),
        Number(phf),
        Number(phv) / 100.0,   // UI takes percent, the engine takes a decimal
        terrain,
        Number(lc_rf),
        Number(lc_fr),
        Number(lc_rr),
        Number(interchange_density),
        Number(basic_freeway_capacity),
        Number(caf),
        Number(saf)
      );

      const los = ws.run_analysis();
      results = {
        los,
        flow_weaving: ws.get_flow_weaving(),
        flow_nonweaving: ws.get_flow_nonweaving(),
        flow_total: ws.get_flow_total(),
        volume_ratio: ws.get_volume_ratio(),
        l_max: ws.get_l_max(),
        is_weaving: ws.is_weaving(),
        capacity: ws.get_capacity(),
        vc_ratio: ws.get_vc_ratio(),
        speed_weaving: ws.get_speed_weaving(),
        speed_nonweaving: ws.get_speed_nonweaving(),
        speed_avg: ws.get_speed_avg(),
        density: ws.get_density()
      };
    } catch (err) {
      console.error('Chapter 13 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    weaving_type = 'one_sided';
    facility_type = 'freeway';
    length_short = 1500;
    num_lanes = 4;
    num_weaving_lanes = 2;
    lc_rf = 1;
    lc_fr = 1;
    lc_rr = 0;
    interchange_density = 0.8;
    terrain = 'level';
    ffs = 70;
    v_ff = 3000;
    v_fr = 500;
    v_rf = 500;
    v_rr = 100;
    phf = 0.94;
    phv = 5;
    basic_freeway_capacity = 2400;
    caf = 1.0;
    saf = 1.0;
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Chapter 13 · Freeway Weaving Segments <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Freeway Weaving Segments</h1>
    <p class="page-sub">
      Estimate capacity, weaving and nonweaving speeds, density, and level of
      service for a freeway weaving segment.
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

  <form id="hcm13" on:submit|preventDefault={runAnalysis}>
    <!-- Geometry / Configuration -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Configuration</h2>
          <p class="panel-sub">Weaving segment geometry and lane-changing configuration.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="WT_input">Weaving Type</label>
          <select id="WT_input" class="select select-bordered select-sm" bind:value={weaving_type}>
            <option value="one_sided">One-Sided</option>
            <option value="two_sided">Two-Sided</option>
          </select>
        </div>

        <div class="param-field">
          <label for="FT_input">Facility Type</label>
          <select id="FT_input" class="select select-bordered select-sm" bind:value={facility_type}>
            <option value="freeway">Freeway</option>
            <option value="multilane">Multilane Highway or C-D Roadway</option>
          </select>
        </div>

        <div class="param-field">
          <label for="LS_input">Short Length (L_S)</label>
          <div class="cell-field">
            <input id="LS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={length_short} placeholder="1500" required />
            <span class="unit">ft</span>
          </div>
          <p class="param-hint">Distance between the barrier markings of the entry and exit gores.</p>
        </div>

        <div class="param-field">
          <label for="N_input">Lanes in Weaving Segment (N)</label>
          <div class="cell-field">
            <input id="N_input" type="number" min="2" max="6" class="input input-bordered input-sm" bind:value={num_lanes} required />
          </div>
        </div>

        <div class="param-field">
          <label for="NWL_input">Weaving Lanes (N_WL)</label>
          <div class="cell-field">
            <input id="NWL_input" type="number" min="0" max="3" class="input input-bordered input-sm" bind:value={num_weaving_lanes} required />
          </div>
          <p class="param-hint">2 or 3 for one-sided segments, 0 for two-sided segments.</p>
        </div>

        <div class="param-field">
          <label for="LCRF_input">Min. Lane Changes, Ramp to Freeway (LC_RF)</label>
          <div class="cell-field">
            <input id="LCRF_input" type="number" min="0" class="input input-bordered input-sm" bind:value={lc_rf} required />
            <span class="unit">lc/veh</span>
          </div>
        </div>

        <div class="param-field">
          <label for="LCFR_input">Min. Lane Changes, Freeway to Ramp (LC_FR)</label>
          <div class="cell-field">
            <input id="LCFR_input" type="number" min="0" class="input input-bordered input-sm" bind:value={lc_fr} required />
            <span class="unit">lc/veh</span>
          </div>
        </div>

        <div class="param-field">
          <label for="LCRR_input">Min. Lane Changes, Ramp to Ramp (two-sided only)</label>
          <div class="cell-field">
            <input id="LCRR_input" type="number" min="0" class="input input-bordered input-sm" bind:value={lc_rr} required />
            <span class="unit">lc/veh</span>
          </div>
        </div>

        <div class="param-field">
          <label for="ID_input">Interchange Density</label>
          <div class="cell-field">
            <input id="ID_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={interchange_density} placeholder="0.8" required />
            <span class="unit">int/mi</span>
          </div>
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
          <p class="panel-sub">Component demand volumes and traffic-stream characteristics.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="VFF_input">Freeway to Freeway Demand (v_FF)</label>
          <div class="cell-field">
            <input id="VFF_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v_ff} placeholder="3000" required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="VFR_input">Freeway to Ramp Demand (v_FR)</label>
          <div class="cell-field">
            <input id="VFR_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v_fr} placeholder="500" required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="VRF_input">Ramp to Freeway Demand (v_RF)</label>
          <div class="cell-field">
            <input id="VRF_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v_rf} placeholder="500" required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="VRR_input">Ramp to Ramp Demand (v_RR)</label>
          <div class="cell-field">
            <input id="VRR_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v_rr} placeholder="100" required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="FFS_input">Free-Flow Speed</label>
          <div class="cell-field">
            <input id="FFS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ffs} placeholder="70" required />
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
          <label for="PHV_input">Heavy Vehicles</label>
          <div class="cell-field">
            <input id="PHV_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="5" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="CIFL_input">Basic Freeway Capacity (c_IFL)</label>
          <div class="cell-field">
            <input id="CIFL_input" type="number" min="0" class="input input-bordered input-sm" bind:value={basic_freeway_capacity} placeholder="2400" required />
            <span class="unit">pc/h/ln</span>
          </div>
          <p class="param-hint">Capacity of an equivalent basic freeway segment at the same FFS.</p>
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
            <th>Weaving Flow Rate (pc/hr):</th>
            <td>{results ? results.flow_weaving.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Nonweaving Flow Rate (pc/hr):</th>
            <td>{results ? results.flow_nonweaving.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Total Flow Rate (pc/hr):</th>
            <td>{results ? results.flow_total.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Volume Ratio:</th>
            <td>{results ? results.volume_ratio.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>Maximum Weaving Length (ft):</th>
            <td>{results ? results.l_max.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Operates as Weaving Segment:</th>
            <td>{results ? (results.is_weaving ? 'Yes' : 'No, analyze as basic segment') : ''}</td>
          </tr>
          <tr>
            <th>Capacity (veh/hr):</th>
            <td>{results ? results.capacity.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Volume-to-Capacity Ratio:</th>
            <td>{results ? results.vc_ratio.toFixed(2) : ''}</td>
          </tr>
          <tr>
            <th>Weaving Speed (mi/hr):</th>
            <td>{results ? results.speed_weaving.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Nonweaving Speed (mi/hr):</th>
            <td>{results ? results.speed_nonweaving.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Average Speed (mi/hr):</th>
            <td>{results ? results.speed_avg.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Density (pc/mi/ln):</th>
            <td>{results ? results.density.toFixed(1) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Segment LOS: {results ? results.los : ''}</p>
      </div>
    </div>
  </section>
</div>
