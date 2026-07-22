<svelte:head>
  <title>HCM Calculator — Urban Street Facilities</title>
</svelte:head>

<script>
  import init, { WasmUrbanFacility } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Facility-level inputs
  let pct_left_turn_lanes = 100;

  function defaultSegment() {
    return {
      segment_length: 1320,
      n_through_lanes: 2,
      speed_limit: 35,
      through_demand: 800,
      control: 'signalized',
      access_points_subject: 2,
      access_points_opposing: 2,
      through_capacity: 1600,
      through_delay: 20,
      cycle_length: 100,
      effective_green: 45,
      platoon_ratio: 1.333,
      sat_flow: 1800,
      stop_rate_override: 0.5
    };
  }

  // Segments ordered upstream to downstream (subject direction of travel)
  let segments = [defaultSegment(), defaultSegment(), defaultSegment()];

  let results = null;
  let hasError = false;
  let errMessage = '';

  // Blank optional inputs become undefined so the engine applies its defaults.
  function opt(v) {
    return v === '' || v === null || v === undefined ? undefined : Number(v);
  }

  function addSegment() {
    segments = [...segments, defaultSegment()];
  }

  function removeSegment(index) {
    if (segments.length <= 1) return;
    segments = segments.filter((_, i) => i !== index);
  }

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const facility = new WasmUrbanFacility(Number(pct_left_turn_lanes) / 100.0);

      for (const seg of segments) {
        facility.add_segment(
          Number(seg.segment_length),
          Number(seg.n_through_lanes),
          Number(seg.speed_limit),
          Number(seg.through_demand),
          seg.control,
          Number(seg.access_points_subject),
          Number(seg.access_points_opposing),
          undefined,                     // midsegment flow, defaults to the through demand
          opt(seg.through_capacity),
          seg.control === 'uncontrolled' ? undefined : opt(seg.through_delay),
          seg.control === 'signalized' ? opt(seg.cycle_length) : undefined,
          seg.control === 'signalized' ? opt(seg.effective_green) : undefined,
          seg.control === 'signalized' ? opt(seg.platoon_ratio) : undefined,
          seg.control === 'signalized' ? opt(seg.sat_flow) : undefined,
          opt(seg.stop_rate_override)
        );
      }

      const los = facility.analyze();
      const summary = facility.results_to_js_value();
      results = { los, ...summary };
    } catch (err) {
      console.error('Chapter 16 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the segment values and try again.';
    }
  }

  function resetParams() {
    pct_left_turn_lanes = 100;
    segments = [defaultSegment(), defaultSegment(), defaultSegment()];
    results = null;
    hasError = false;
  }

  function fmt(v, digits) {
    return v === null || v === undefined ? '' : v.toFixed(digits);
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Urban Street Facilities <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Urban Street Facilities</h1>
    <p class="page-sub">
      Aggregate Chapter 18 urban street segments into facility travel speed,
      spatial stop rate, and level of service for one direction of travel.
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

  <form id="hcm16" on:submit|preventDefault={runAnalysis}>
    <!-- Facility -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Facility</h2>
          <p class="panel-sub">Facility-wide inputs for the subject direction of travel.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="PLTL_input">Intersections with Left-Turn Lanes</label>
          <div class="cell-field">
            <input id="PLTL_input" type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={pct_left_turn_lanes} placeholder="100" required />
            <span class="unit">%</span>
          </div>
          <p class="param-hint">Used by the facility traveler perception score.</p>
        </div>
      </div>
    </section>

    <!-- Segments -->
    {#each segments as seg, i}
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Segment {i + 1}</h2>
            <p class="panel-sub">Chapter 18 inputs, ordered upstream to downstream.</p>
          </div>
          <button class="btn btn-ghost btn-sm" type="button" on:click={() => removeSegment(i)} disabled={segments.length <= 1}>Remove</button>
        </div>
        <div class="param-grid">
          <div class="param-field">
            <label for={"LEN_input_" + i}>Segment Length</label>
            <div class="cell-field">
              <input id={"LEN_input_" + i} type="number" min="1" class="input input-bordered input-sm" bind:value={seg.segment_length} placeholder="1320" required />
              <span class="unit">ft</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"NTH_input_" + i}>Through Lanes</label>
            <div class="cell-field">
              <input id={"NTH_input_" + i} type="number" min="1" max="6" class="input input-bordered input-sm" bind:value={seg.n_through_lanes} required />
              <span class="unit">ln</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"SPL_input_" + i}>Posted Speed Limit</label>
            <div class="cell-field">
              <input id={"SPL_input_" + i} type="number" min="1" class="input input-bordered input-sm" bind:value={seg.speed_limit} placeholder="35" required />
              <span class="unit">mph</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"DEM_input_" + i}>Through Demand Flow Rate</label>
            <div class="cell-field">
              <input id={"DEM_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.through_demand} placeholder="800" required />
              <span class="unit">veh/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"APS_input_" + i}>Access Points (subject side)</label>
            <div class="cell-field">
              <input id={"APS_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.access_points_subject} placeholder="2" required />
              <span class="unit">pts</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"APO_input_" + i}>Access Points (opposing side)</label>
            <div class="cell-field">
              <input id={"APO_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.access_points_opposing} placeholder="2" required />
              <span class="unit">pts</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"CTRL_input_" + i}>Boundary Control Type</label>
            <select id={"CTRL_input_" + i} class="select select-bordered select-sm" bind:value={seg.control}>
              <option value="signalized">Signalized</option>
              <option value="allwaystop">All-Way STOP</option>
              <option value="yield">YIELD Controlled</option>
              <option value="roundabout">Roundabout</option>
              <option value="uncontrolled">Uncontrolled</option>
            </select>
          </div>

          {#if seg.control !== 'uncontrolled'}
            <div class="param-field">
              <label for={"DEL_input_" + i}>Through Control Delay</label>
              <div class="cell-field">
                <input id={"DEL_input_" + i} type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={seg.through_delay} placeholder="20" required />
                <span class="unit">s/veh</span>
              </div>
            </div>
          {/if}

          <div class="param-field">
            <label for={"CAP_input_" + i}>Through Capacity (optional)</label>
            <div class="cell-field">
              <input id={"CAP_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.through_capacity} placeholder="1600" />
              <span class="unit">veh/h</span>
            </div>
          </div>

          {#if seg.control === 'signalized'}
            <div class="param-field">
              <label for={"CYC_input_" + i}>Cycle Length</label>
              <div class="cell-field">
                <input id={"CYC_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.cycle_length} placeholder="100" />
                <span class="unit">s</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"GRN_input_" + i}>Effective Green Time</label>
              <div class="cell-field">
                <input id={"GRN_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.effective_green} placeholder="45" />
                <span class="unit">s</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"PR_input_" + i}>Platoon Ratio (optional)</label>
              <div class="cell-field">
                <input id={"PR_input_" + i} type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={seg.platoon_ratio} placeholder="1.000" />
              </div>
            </div>

            <div class="param-field">
              <label for={"SAT_input_" + i}>Adjusted Saturation Flow Rate</label>
              <div class="cell-field">
                <input id={"SAT_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.sat_flow} placeholder="1800" />
                <span class="unit">veh/h/ln</span>
              </div>
            </div>
          {/if}

          <div class="param-field">
            <label for={"STP_input_" + i}>Full Stop Rate (optional)</label>
            <div class="cell-field">
              <input id={"STP_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={seg.stop_rate_override} placeholder="0.5" />
              <span class="unit">stops/veh</span>
            </div>
            <p class="param-hint">Needed for the facility stop rate and perception score at signalized boundaries.</p>
          </div>
        </div>
      </section>
    {/each}

    <!-- Form Actions -->
    <div class="action-bar">
      <button class="btn btn-ghost" on:click={addSegment} type="button">Add Segment</button>
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
            <th>Facility Length (ft):</th>
            <td>{results ? fmt(results.length_ft, 0) : ''}</td>
          </tr>
          <tr>
            <th>Facility Base Free-Flow Speed (mi/hr):</th>
            <td>{results ? fmt(results.base_ffs, 1) : ''}</td>
          </tr>
          <tr>
            <th>Facility Travel Speed (mi/hr):</th>
            <td>{results ? fmt(results.travel_speed, 1) : ''}</td>
          </tr>
          <tr>
            <th>Facility Travel Time (s):</th>
            <td>{results ? fmt(results.travel_time, 1) : ''}</td>
          </tr>
          <tr>
            <th>Facility Spatial Stop Rate (stops/mi):</th>
            <td>{results ? fmt(results.spatial_stop_rate, 2) : ''}</td>
          </tr>
          <tr>
            <th>Critical Volume-to-Capacity Ratio:</th>
            <td>{results ? fmt(results.critical_vc_ratio, 2) : ''}</td>
          </tr>
          <tr>
            <th>Traveler Perception Score:</th>
            <td>{results ? fmt(results.perception_score, 2) : ''}</td>
          </tr>
          <tr>
            <th>Poorest Segment LOS:</th>
            <td>{results ? results.poorest_segment_los : ''}</td>
          </tr>
        </tbody>
      </table>

      {#if results && results.segments}
        <table class="table w-full">
          <thead>
            <tr>
              <th>Segment</th>
              <th>Length (ft)</th>
              <th>Travel Speed (mi/hr)</th>
              <th>v/c</th>
              <th>LOS</th>
            </tr>
          </thead>
          <tbody>
            {#each results.segments as segRes, i}
              <tr>
                <td>{i + 1}</td>
                <td>{fmt(segRes.length_ft, 0)}</td>
                <td>{fmt(segRes.travel_speed, 1)}</td>
                <td>{fmt(segRes.vc_ratio, 2)}</td>
                <td>{segRes.los}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}

      <div class="facility-summary">
        <p>Facility LOS: {results ? results.los : ''}</p>
      </div>
    </div>
  </section>
</div>
