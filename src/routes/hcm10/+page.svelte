<svelte:head>
  <title>HCM Calculator — Freeway Facilities Core Methodology</title>
</svelte:head>

<script>
  import init, { WasmFacilitySegment, WasmFreewayFacility } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Facility-wide inputs (defaults follow the HCM Chapter 10 base conditions)
  let ffs = 60;
  let hv_pct = 5;
  let terrain = 'level';
  let city_type = 'urban';
  let phf = 1.0;
  let jam_density = 190;
  let queue_discharge_drop = 7;
  let total_ramp_density = 1.0;

  // Mainline entry demand, one value per 15-min analysis period
  let mainline_demand = '4000, 4400, 4800, 4400';

  function defaultSegments() {
    return [
      { seg_num: 1, seg_type: 'Basic',  length_ft: '5280', lanes: '3', on_ramp: '', off_ramp: '', ramp_to_ramp: '', ramp_ffs: '40', accel: '500', decel: '500', short_length: '', weaving_lanes: '2', lc_rf: '1', lc_fr: '1' },
      { seg_num: 2, seg_type: 'Merge',  length_ft: '1500', lanes: '3', on_ramp: '450, 540, 630, 360', off_ramp: '', ramp_to_ramp: '', ramp_ffs: '40', accel: '500', decel: '500', short_length: '', weaving_lanes: '2', lc_rf: '1', lc_fr: '1' },
      { seg_num: 3, seg_type: 'Basic',  length_ft: '5280', lanes: '3', on_ramp: '', off_ramp: '', ramp_to_ramp: '', ramp_ffs: '40', accel: '500', decel: '500', short_length: '', weaving_lanes: '2', lc_rf: '1', lc_fr: '1' }
    ];
  }

  let segments = defaultSegments();

  function addSegment() {
    segments = [
      ...segments,
      { seg_num: segments.length + 1, seg_type: 'Basic', length_ft: '5280', lanes: '3', on_ramp: '', off_ramp: '', ramp_to_ramp: '', ramp_ffs: '40', accel: '500', decel: '500', short_length: '', weaving_lanes: '2', lc_rf: '1', lc_fr: '1' }
    ];
  }

  function removeSegment() {
    if (segments.length > 1) {
      segments = segments.slice(0, segments.length - 1);
    }
  }

  function parseList(text) {
    return String(text)
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map(Number)
      .filter((v) => Number.isFinite(v));
  }

  let results = null;
  let hasError = false;
  let errMessage = '';

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const demand = parseList(mainline_demand);
      if (demand.length === 0) {
        throw new Error('Enter at least one mainline demand value.');
      }

      const wasmSegments = segments.map((s) => new WasmFacilitySegment(
        s.seg_type,
        Number(s.length_ft),
        Number(s.lanes),
        parseList(s.on_ramp),
        parseList(s.off_ramp),
        parseList(s.ramp_to_ramp),
        Number(s.ramp_ffs),
        Number(s.accel),
        Number(s.decel),
        s.short_length !== '' ? Number(s.short_length) : undefined,
        Number(s.weaving_lanes),
        Number(s.lc_rf),
        Number(s.lc_fr),
        undefined,             // segment FFS override, mi/h
        undefined,             // calibration CAF
        undefined,             // calibration SAF
        undefined              // calibration DAF
      ));

      const fac = new WasmFreewayFacility(
        wasmSegments,
        demand,
        Number(ffs),
        Number(hv_pct) / 100.0,           // UI takes percent, the engine takes a decimal
        terrain,
        city_type,
        Number(phf),
        Number(jam_density),
        Number(queue_discharge_drop) / 100.0,
        Number(total_ramp_density),
        undefined                          // interchange density defaults to total ramp density
      );

      fac.run_analysis();

      const periods = fac.num_periods();
      const perPeriod = [];
      for (let p = 0; p < periods; p++) {
        perPeriod.push({
          speed: fac.get_facility_speed(p),
          density: fac.get_facility_density_veh(p),
          los: fac.get_facility_los(p)
        });
      }

      results = {
        perPeriod,
        losMatrix: fac.los_matrix(),
        densityMatrix: fac.density_matrix(),
        overall_speed: fac.get_overall_speed(),
        overall_density: fac.get_overall_density_veh(),
        oversaturated: fac.is_oversaturated(),
        total_length: fac.total_length_mi()
      };
    } catch (err) {
      console.error('Chapter 10 analysis failed:', err);
      hasError = true;
      errMessage = typeof err === 'string'
        ? err
        : (err && err.message) || 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    ffs = 60;
    hv_pct = 5;
    terrain = 'level';
    city_type = 'urban';
    phf = 1.0;
    jam_density = 190;
    queue_discharge_drop = 7;
    total_ramp_density = 1.0;
    mainline_demand = '4000, 4400, 4800, 4400';
    segments = defaultSegments();
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Chapter 10 · Freeway Facilities <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Freeway Facilities Core Methodology</h1>
    <p class="page-sub">
      Evaluate a directional freeway facility of basic, merge, diverge, weaving, and
      overlapping ramp segments over consecutive 15-min analysis periods. This beta
      covers the mixed-flow core methodology. Managed lanes and work zones are not included.
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

  <form id="hcm10" on:submit|preventDefault={runAnalysis}>
    <!-- Facility -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Facility</h2>
          <p class="panel-sub">Values that apply to the whole facility in the analysis direction.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="FFS_input">Free-Flow Speed</label>
          <div class="cell-field">
            <input id="FFS_input" type="number" min="55" max="75" class="input input-bordered input-sm" bind:value={ffs} placeholder="60" required />
            <span class="unit">mi/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="HV_input">Heavy Vehicles</label>
          <div class="cell-field">
            <input id="HV_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={hv_pct} placeholder="5" required />
            <span class="unit">%</span>
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

        <div class="param-field">
          <label for="CITY_input">Area Type</label>
          <select id="CITY_input" class="select select-bordered select-sm" bind:value={city_type}>
            <option value="urban">Urban</option>
            <option value="rural">Rural</option>
          </select>
        </div>

        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="1.00" required />
          </div>
          <p class="param-hint">Use 1.00 when the demand values are true 15-min flow rates.</p>
        </div>

        <div class="param-field">
          <label for="JAM_input">Jam Density</label>
          <div class="cell-field">
            <input id="JAM_input" type="number" min="100" class="input input-bordered input-sm" bind:value={jam_density} placeholder="190" required />
            <span class="unit">pc/mi/ln</span>
          </div>
        </div>

        <div class="param-field">
          <label for="QDROP_input">Queue Discharge Capacity Drop</label>
          <div class="cell-field">
            <input id="QDROP_input" type="number" step="0.5" min="0" max="30" class="input input-bordered input-sm" bind:value={queue_discharge_drop} placeholder="7" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="TRD_input">Total Ramp Density</label>
          <div class="cell-field">
            <input id="TRD_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={total_ramp_density} placeholder="1.0" required />
            <span class="unit">/mi</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Demand -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Demand</h2>
          <p class="panel-sub">Mainline demand entering the facility, one value per 15-min analysis period.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="DEMAND_input">Mainline Entry Demand</label>
          <div class="cell-field">
            <input id="DEMAND_input" type="text" class="input input-bordered input-sm" bind:value={mainline_demand} placeholder="4000, 4400, 4800, 4400" required />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">Comma-separated list. The number of values sets the number of analysis periods.</p>
        </div>
      </div>
    </section>

    <!-- Segments -->
    <section class="panel">
      <div class="panel-head with-actions">
        <div>
          <h2 class="panel-title">Segments</h2>
          <p class="panel-sub">Ordered upstream to downstream. The facility must begin and end with a basic segment. Ramp demand lists carry one value per analysis period and missing values count as zero.</p>
        </div>
        <div class="panel-actions">
          <button class="btn btn-outline btn-sm" on:click={addSegment} type="button">+ Add Segment</button>
          <button class="btn btn-ghost btn-sm" on:click={removeSegment} type="button">Remove</button>
        </div>
      </div>
      <div class="w-full overflow-x-auto">
        <table class="table seg-table w-full">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Length (ft)</th>
              <th>Lanes</th>
              <th>On-Ramp Demand (veh/h)</th>
              <th>Off-Ramp Demand (veh/h)</th>
              <th>Ramp FFS (mi/h)</th>
              <th>Accel Lane (ft)</th>
              <th>Decel Lane (ft)</th>
            </tr>
          </thead>
          <tbody>
            {#each segments as row, i (row.seg_num)}
              <tr>
                <td>{row.seg_num}</td>
                <td>
                  <select class="select select-bordered select-sm" bind:value={segments[i].seg_type}>
                    <option>Basic</option>
                    <option>Merge</option>
                    <option>Diverge</option>
                    <option>Weaving</option>
                    <option value="OverlappingRamp">Overlapping Ramp</option>
                  </select>
                </td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].length_ft} placeholder="5280" autocomplete="off" /></td>
                <td><input class="input input-bordered input-sm" type="number" min="1" max="8" bind:value={segments[i].lanes} placeholder="3" autocomplete="off" /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].on_ramp} placeholder="450, 540" autocomplete="off" disabled={row.seg_type !== 'Merge' && row.seg_type !== 'Weaving'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].off_ramp} placeholder="270, 360" autocomplete="off" disabled={row.seg_type !== 'Diverge' && row.seg_type !== 'Weaving'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].ramp_ffs} placeholder="40" autocomplete="off" disabled={row.seg_type === 'Basic'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].accel} placeholder="500" autocomplete="off" disabled={row.seg_type !== 'Merge' && row.seg_type !== 'OverlappingRamp'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].decel} placeholder="500" autocomplete="off" disabled={row.seg_type !== 'Diverge' && row.seg_type !== 'OverlappingRamp'} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Weaving details -->
      <div class="hc-subtables">
        {#each segments as row, i (row.seg_num)}
          {#if row.seg_type === 'Weaving'}
            <div class="hc-card">
              <div class="hc-card-head">
                <h3>Segment {row.seg_num} · Weaving Details</h3>
              </div>
              <div class="param-grid">
                <div class="param-field">
                  <label for="SL_input{row.seg_num}">Short Length</label>
                  <div class="cell-field">
                    <input id="SL_input{row.seg_num}" class="input input-bordered input-sm" bind:value={segments[i].short_length} placeholder="Segment length" autocomplete="off" />
                    <span class="unit">ft</span>
                  </div>
                </div>
                <div class="param-field">
                  <label for="NWL_input{row.seg_num}">Weaving Lanes</label>
                  <div class="cell-field">
                    <input id="NWL_input{row.seg_num}" type="number" min="2" max="3" class="input input-bordered input-sm" bind:value={segments[i].weaving_lanes} placeholder="2" autocomplete="off" />
                  </div>
                </div>
                <div class="param-field">
                  <label for="LCRF_input{row.seg_num}">Ramp-to-Freeway Lane Changes</label>
                  <div class="cell-field">
                    <input id="LCRF_input{row.seg_num}" type="number" min="0" class="input input-bordered input-sm" bind:value={segments[i].lc_rf} placeholder="1" autocomplete="off" />
                  </div>
                </div>
                <div class="param-field">
                  <label for="LCFR_input{row.seg_num}">Freeway-to-Ramp Lane Changes</label>
                  <div class="cell-field">
                    <input id="LCFR_input{row.seg_num}" type="number" min="0" class="input input-bordered input-sm" bind:value={segments[i].lc_fr} placeholder="1" autocomplete="off" />
                  </div>
                </div>
                <div class="param-field">
                  <label for="RR_input{row.seg_num}">Ramp-to-Ramp Demand</label>
                  <div class="cell-field">
                    <input id="RR_input{row.seg_num}" class="input input-bordered input-sm" bind:value={segments[i].ramp_to_ramp} placeholder="50, 100" autocomplete="off" />
                    <span class="unit">veh/h</span>
                  </div>
                  <p class="param-hint">One value per analysis period.</p>
                </div>
              </div>
            </div>
          {/if}
        {/each}
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
        <thead>
          <tr>
            <th>Facility Performance</th>
            {#if results}
              {#each results.perPeriod as _, p}
                <th>Period {p + 1}</th>
              {/each}
            {/if}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Space Mean Speed (mi/hr):</th>
            {#if results}
              {#each results.perPeriod as period}
                <td>{period.speed.toFixed(1)}</td>
              {/each}
            {/if}
          </tr>
          <tr>
            <th>Average Density (veh/mi/ln):</th>
            {#if results}
              {#each results.perPeriod as period}
                <td>{period.density.toFixed(1)}</td>
              {/each}
            {/if}
          </tr>
          <tr>
            <th>Facility LOS:</th>
            {#if results}
              {#each results.perPeriod as period}
                <td>{period.los}</td>
              {/each}
            {/if}
          </tr>
        </tbody>
      </table>

      {#if results}
        <table class="table w-full">
          <thead>
            <tr>
              <th>Segment LOS</th>
              {#each results.perPeriod as _, p}
                <th>Period {p + 1}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each results.losMatrix as segRow, s}
              <tr>
                <th>Segment {s + 1} ({segments[s] ? segments[s].seg_type : ''}):</th>
                {#each segRow as los, p}
                  <td>{los} ({results.densityMatrix[s][p].toFixed(1)} veh/mi/ln)</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}

      <div class="facility-summary">
        <p>Facility Length: {results ? results.total_length.toFixed(2) + ' mi' : ''}</p>
        <p>Overall Space Mean Speed: {results ? results.overall_speed.toFixed(1) + ' mi/hr' : ''}</p>
        <p>Overall Density: {results ? results.overall_density.toFixed(1) + ' veh/mi/ln' : ''}</p>
        <p>Oversaturated: {results ? (results.oversaturated ? 'Yes, demand exceeds capacity somewhere in the time-space domain' : 'No') : ''}</p>
      </div>
    </div>
  </section>
</div>
