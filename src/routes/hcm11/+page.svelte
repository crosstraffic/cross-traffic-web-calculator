<svelte:head>
  <title>HCM Calculator — Freeway Reliability Analysis</title>
</svelte:head>

<script>
  import init, { WasmFacilitySegment, WasmFreewayReliability } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Facility inputs (Chapter 10 seed dataset for the reliability run)
  let ffs = 60;
  let hv_pct = 5;
  let terrain = 'level';
  let city_type = 'urban';
  let mainline_demand = '4000, 4400, 4800, 4400';

  function defaultSegments() {
    return [
      { seg_num: 1, seg_type: 'Basic', length_ft: '5280', lanes: '3', on_ramp: '', off_ramp: '', ramp_ffs: '40', accel: '500', decel: '500' },
      { seg_num: 2, seg_type: 'Merge', length_ft: '1500', lanes: '3', on_ramp: '450, 540, 630, 360', off_ramp: '', ramp_ffs: '40', accel: '500', decel: '500' },
      { seg_num: 3, seg_type: 'Basic', length_ft: '5280', lanes: '3', on_ramp: '', off_ramp: '', ramp_ffs: '40', accel: '500', decel: '500' }
    ];
  }

  let segments = defaultSegments();

  // Reliability inputs (Chapter 11 scenario generation)
  let replications = 4;
  let seed_month = 1;
  let seed_weekday = 'monday';
  let include_incidents = true;
  let crash_rate = 150;
  let incident_crash_ratio = 4.9;
  let rng_seed = 1;
  let target_speed = 45;

  function addSegment() {
    segments = [
      ...segments,
      { seg_num: segments.length + 1, seg_type: 'Basic', length_ft: '5280', lanes: '3', on_ramp: '', off_ramp: '', ramp_ffs: '40', accel: '500', decel: '500' }
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
  let running = false;

  function runAnalysis() {
    hasError = false;
    results = null;
    running = true;

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
        [],                    // ramp-to-ramp demand (weaving), veh/h
        Number(s.ramp_ffs),
        Number(s.accel),
        Number(s.decel),
        undefined,             // weaving short length, ft
        undefined,             // weaving lanes
        undefined,             // ramp-to-freeway lane changes
        undefined,             // freeway-to-ramp lane changes
        undefined,             // segment FFS override, mi/h
        undefined,             // calibration CAF
        undefined,             // calibration SAF
        undefined              // calibration DAF
      ));

      const rel = new WasmFreewayReliability(
        wasmSegments,
        demand,
        Number(ffs),
        Number(hv_pct) / 100.0,             // UI takes percent, the engine takes a decimal
        terrain,
        city_type,
        1.0,                                 // PHF, 15-min flow rates assumed
        [],                                  // months, empty means the whole year
        Number(replications),
        Number(seed_month),
        seed_weekday,
        include_incidents ? Number(crash_rate) : undefined,
        include_incidents ? Number(incident_crash_ratio) : undefined,
        Number(rng_seed),
        true                                 // VMT-weighted TTI distribution
      );

      rel.run();

      results = {
        num_scenarios: rel.num_scenarios(),
        num_observations: rel.num_observations(),
        fftt: rel.free_flow_travel_time_min(),
        tti_mean: rel.tti_mean(),
        tti_50: rel.tti_percentile(50.0),
        tti_80: rel.tti_percentile(80.0),
        tti_95: rel.tti_percentile(95.0),
        misery_index: rel.misery_index(),
        reliability_rating: rel.reliability_rating(),
        semi_std_dev: rel.semi_std_dev(),
        expected_vhd: rel.expected_vhd(),
        pct_below_target: rel.failure_pct_below_speed(Number(target_speed))
      };
    } catch (err) {
      console.error('Chapter 11 analysis failed:', err);
      hasError = true;
      errMessage = typeof err === 'string'
        ? err
        : (err && err.message) || 'The analysis could not be completed with the given inputs. Check the values and try again.';
    } finally {
      running = false;
    }
  }

  function resetParams() {
    ffs = 60;
    hv_pct = 5;
    terrain = 'level';
    city_type = 'urban';
    mainline_demand = '4000, 4400, 4800, 4400';
    segments = defaultSegments();
    replications = 4;
    seed_month = 1;
    seed_weekday = 'monday';
    include_incidents = true;
    crash_rate = 150;
    incident_crash_ratio = 4.9;
    rng_seed = 1;
    target_speed = 45;
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Chapter 11 · Freeway Reliability Analysis <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Freeway Reliability Analysis</h1>
    <p class="page-sub">
      Estimate the travel time reliability of a freeway facility across a whole-year
      reporting period on Monday through Friday. This beta models demand variability
      by month and weekday plus randomly generated incidents. Weather events, work
      zones, and special events are not included.
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

  <form id="hcm11" on:submit|preventDefault={runAnalysis}>
    <!-- Facility -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Facility</h2>
          <p class="panel-sub">The Chapter 10 seed dataset that every scenario is built from.</p>
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
          <label for="DEMAND_input">Mainline Entry Demand</label>
          <div class="cell-field">
            <input id="DEMAND_input" type="text" class="input input-bordered input-sm" bind:value={mainline_demand} placeholder="4000, 4400, 4800, 4400" required />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">Comma-separated list, one value per 15-min analysis period. The list length sets the study period.</p>
        </div>
      </div>
    </section>

    <!-- Segments -->
    <section class="panel">
      <div class="panel-head with-actions">
        <div>
          <h2 class="panel-title">Segments</h2>
          <p class="panel-sub">Ordered upstream to downstream. The facility must begin and end with a basic segment. Weaving details are not exposed on this page, use the Chapter 10 page to study a weaving-heavy facility first.</p>
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
                    <option value="OverlappingRamp">Overlapping Ramp</option>
                  </select>
                </td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].length_ft} placeholder="5280" autocomplete="off" /></td>
                <td><input class="input input-bordered input-sm" type="number" min="1" max="8" bind:value={segments[i].lanes} placeholder="3" autocomplete="off" /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].on_ramp} placeholder="450, 540" autocomplete="off" disabled={row.seg_type !== 'Merge'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].off_ramp} placeholder="270, 360" autocomplete="off" disabled={row.seg_type !== 'Diverge'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].ramp_ffs} placeholder="40" autocomplete="off" disabled={row.seg_type === 'Basic'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].accel} placeholder="500" autocomplete="off" disabled={row.seg_type !== 'Merge' && row.seg_type !== 'OverlappingRamp'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].decel} placeholder="500" autocomplete="off" disabled={row.seg_type !== 'Diverge' && row.seg_type !== 'OverlappingRamp'} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Scenario generation -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Scenario Generation</h2>
          <p class="panel-sub">The reliability reporting period covers all 12 months on weekdays with HCM default demand ratios.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="REP_input">Replications per Demand Combination</label>
          <div class="cell-field">
            <input id="REP_input" type="number" min="1" max="20" class="input input-bordered input-sm" bind:value={replications} placeholder="4" required />
          </div>
          <p class="param-hint">4 replications across 12 months and 5 weekdays yields 240 scenarios.</p>
        </div>

        <div class="param-field">
          <label for="SEEDM_input">Seed Dataset Month</label>
          <select id="SEEDM_input" class="select select-bordered select-sm" bind:value={seed_month}>
            {#each ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as name, m}
              <option value={m + 1}>{name}</option>
            {/each}
          </select>
        </div>

        <div class="param-field">
          <label for="SEEDW_input">Seed Dataset Weekday</label>
          <select id="SEEDW_input" class="select select-bordered select-sm" bind:value={seed_weekday}>
            <option value="monday">Monday</option>
            <option value="tuesday">Tuesday</option>
            <option value="wednesday">Wednesday</option>
            <option value="thursday">Thursday</option>
            <option value="friday">Friday</option>
          </select>
        </div>

        <div class="param-field">
          <label for="SEED_input">Random Seed</label>
          <div class="cell-field">
            <input id="SEED_input" type="number" min="0" class="input input-bordered input-sm" bind:value={rng_seed} placeholder="1" required />
          </div>
          <p class="param-hint">Keep the same seed to reproduce a scenario set.</p>
        </div>

        <div class="param-field">
          <label for="INC_input">
            <input id="INC_input" type="checkbox" class="checkbox checkbox-sm" bind:checked={include_incidents} />
            Include Incidents
          </label>
        </div>

        <div class="param-field">
          <label for="CR_input">Crash Rate</label>
          <div class="cell-field">
            <input id="CR_input" type="number" min="0" class="input input-bordered input-sm" bind:value={crash_rate} placeholder="150" disabled={!include_incidents} />
            <span class="unit">per 100M VMT</span>
          </div>
        </div>

        <div class="param-field">
          <label for="ICR_input">Incident-to-Crash Ratio</label>
          <div class="cell-field">
            <input id="ICR_input" type="number" step="0.1" min="1" class="input input-bordered input-sm" bind:value={incident_crash_ratio} placeholder="4.9" disabled={!include_incidents} />
          </div>
          <p class="param-hint">The HCM national default is 4.9.</p>
        </div>

        <div class="param-field">
          <label for="TS_input">Target Speed for On-Time Measure</label>
          <div class="cell-field">
            <input id="TS_input" type="number" min="1" class="input input-bordered input-sm" bind:value={target_speed} placeholder="45" required />
            <span class="unit">mi/h</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Form Actions -->
    <div class="action-bar">
      <button class="btn btn-ghost" on:click={resetParams} type="button">Reset Params</button>
      <button class="btn btn-primary" type="submit" disabled={!ready || running}>{running ? 'Running…' : 'Calculate'}</button>
    </div>
  </form>

  <section class="panel results-panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Outputs</h2>
        <p class="panel-sub">Results populate after pressing Calculate. Every scenario is evaluated with the Chapter 10 core methodology, so the run can take a few seconds.</p>
      </div>
    </div>
    <div class="los overflow-x-auto">
      <table class="table w-full">
        <tbody>
          <tr>
            <th>Scenarios Evaluated:</th>
            <td>{results ? results.num_scenarios : ''}</td>
          </tr>
          <tr>
            <th>Travel Time Observations:</th>
            <td>{results ? results.num_observations : ''}</td>
          </tr>
          <tr>
            <th>Free-Flow Travel Time (min):</th>
            <td>{results ? results.fftt.toFixed(2) : ''}</td>
          </tr>
          <tr>
            <th>Mean TTI:</th>
            <td>{results ? results.tti_mean.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>50th Percentile TTI:</th>
            <td>{results ? results.tti_50.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>80th Percentile TTI:</th>
            <td>{results ? results.tti_80.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>95th Percentile TTI (PTI):</th>
            <td>{results ? results.tti_95.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>Misery Index:</th>
            <td>{results ? results.misery_index.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>Semi-Standard Deviation:</th>
            <td>{results ? results.semi_std_dev.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>Expected Vehicle Hours of Delay (veh-h):</th>
            <td>{results ? results.expected_vhd.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Share of Travel Below {target_speed} mi/h (%):</th>
            <td>{results ? results.pct_below_target.toFixed(1) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Reliability Rating: {results ? results.reliability_rating.toFixed(1) + ' % of travel at TTI below 1.33' : ''}</p>
      </div>
    </div>
  </section>
</div>
