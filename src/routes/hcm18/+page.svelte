<svelte:head>
  <title>HCM Calculator — Urban Street Segments</title>
</svelte:head>

<script>
  import init, { WasmUrbanSegment } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Inputs (defaults describe a signalized 0.25-mi arterial segment)
  let segment_length = 1320;
  let n_through_lanes = 2;
  let speed_limit = 35;
  let upstream_width = 0;
  let restrictive_median_length = 0;
  let pct_curb = 100;
  let pct_parking = 0;
  let access_points_subject = 2;
  let access_points_opposing = 2;
  let pct_opposing_left_accessible = 100;
  let signal_spacing = '';
  let ffs_override = '';

  let through_demand = 800;
  let midsegment_flow = '';

  let control = 'signalized';
  let through_delay = 20;
  let through_capacity = 1600;
  let cycle_length = 100;
  let effective_green = 45;
  let platoon_ratio = 1.333;
  let sat_flow = 1800;
  let stop_rate_override = 0.5;

  let pct_left_turn_lanes = 100;

  let results = null;
  let hasError = false;
  let errMessage = '';

  // Blank optional inputs become undefined so the engine applies its defaults.
  function opt(v) {
    return v === '' || v === null || v === undefined ? undefined : Number(v);
  }

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const seg = new WasmUrbanSegment(
        Number(segment_length),
        Number(n_through_lanes),
        Number(speed_limit),
        Number(through_demand),
        control,
        Number(upstream_width),
        Number(restrictive_median_length),
        Number(pct_curb) / 100.0,              // UI takes percent, the engine takes a decimal
        Number(pct_parking) / 100.0,
        Number(access_points_subject),
        Number(access_points_opposing),
        Number(pct_opposing_left_accessible) / 100.0,
        opt(signal_spacing),
        opt(ffs_override),
        opt(midsegment_flow),
        opt(through_capacity),
        control === 'uncontrolled' ? undefined : opt(through_delay),
        control === 'signalized' ? opt(cycle_length) : undefined,
        control === 'signalized' ? opt(effective_green) : undefined,
        undefined,                             // arrival type (platoon ratio is used instead)
        control === 'signalized' ? opt(platoon_ratio) : undefined,
        control === 'signalized' ? opt(sat_flow) : undefined,
        undefined,                             // stopped vehicles N_f (Chapter 31 output)
        undefined,                             // back-of-queue Q2 (Chapter 31 output)
        undefined,                             // back-of-queue Q3 (Chapter 31 output)
        opt(stop_rate_override),
        undefined,                             // stop rate from other midsegment sources
        Number(pct_left_turn_lanes) / 100.0
      );

      const los = seg.analyze();
      results = {
        los,
        base_ffs: seg.get_base_ffs(),
        free_flow_speed: seg.get_free_flow_speed(),
        running_time: seg.get_running_time(),
        travel_speed: seg.get_travel_speed(),
        through_delay: seg.get_through_delay(),
        full_stop_rate: seg.get_full_stop_rate(),
        spatial_stop_rate: seg.get_spatial_stop_rate(),
        vc_ratio: seg.get_vc_ratio(),
        perception_score: seg.get_perception_score()
      };
    } catch (err) {
      console.error('Chapter 18 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    segment_length = 1320;
    n_through_lanes = 2;
    speed_limit = 35;
    upstream_width = 0;
    restrictive_median_length = 0;
    pct_curb = 100;
    pct_parking = 0;
    access_points_subject = 2;
    access_points_opposing = 2;
    pct_opposing_left_accessible = 100;
    signal_spacing = '';
    ffs_override = '';
    through_demand = 800;
    midsegment_flow = '';
    control = 'signalized';
    through_delay = 20;
    through_capacity = 1600;
    cycle_length = 100;
    effective_green = 45;
    platoon_ratio = 1.333;
    sat_flow = 1800;
    stop_rate_override = 0.5;
    pct_left_turn_lanes = 100;
    results = null;
    hasError = false;
  }

  function fmt(v, digits) {
    return v === null || v === undefined ? '' : v.toFixed(digits);
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Chapter 18 · Urban Street Segments <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Urban Street Segments</h1>
    <p class="page-sub">
      Estimate free-flow speed, travel speed, stop rate, and level of service
      for one direction of travel on an urban street segment.
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

  <form id="hcm18" on:submit|preventDefault={runAnalysis}>
    <!-- Geometry -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Geometry</h2>
          <p class="panel-sub">Cross-section and access characteristics of the segment in the subject direction.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="LEN_input">Segment Length</label>
          <div class="cell-field">
            <input id="LEN_input" type="number" min="1" class="input input-bordered input-sm" bind:value={segment_length} placeholder="1320" required />
            <span class="unit">ft</span>
          </div>
          <p class="param-hint">Stop line to stop line.</p>
        </div>

        <div class="param-field">
          <label for="NTH_input">Through Lanes (subject direction)</label>
          <div class="cell-field">
            <input id="NTH_input" type="number" min="1" max="6" class="input input-bordered input-sm" bind:value={n_through_lanes} required />
            <span class="unit">ln</span>
          </div>
        </div>

        <div class="param-field">
          <label for="SPL_input">Posted Speed Limit</label>
          <div class="cell-field">
            <input id="SPL_input" type="number" min="1" class="input input-bordered input-sm" bind:value={speed_limit} placeholder="35" required />
            <span class="unit">mph</span>
          </div>
        </div>

        <div class="param-field">
          <label for="UPW_input">Upstream Intersection Width</label>
          <div class="cell-field">
            <input id="UPW_input" type="number" min="0" class="input input-bordered input-sm" bind:value={upstream_width} placeholder="0" required />
            <span class="unit">ft</span>
          </div>
        </div>

        <div class="param-field">
          <label for="RML_input">Restrictive Median Length</label>
          <div class="cell-field">
            <input id="RML_input" type="number" min="0" class="input input-bordered input-sm" bind:value={restrictive_median_length} placeholder="0" required />
            <span class="unit">ft</span>
          </div>
        </div>

        <div class="param-field">
          <label for="CURB_input">Link Length with Curb</label>
          <div class="cell-field">
            <input id="CURB_input" type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={pct_curb} placeholder="100" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PARK_input">Link Length with On-Street Parking</label>
          <div class="cell-field">
            <input id="PARK_input" type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={pct_parking} placeholder="0" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="APS_input">Access Points (subject side)</label>
          <div class="cell-field">
            <input id="APS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={access_points_subject} placeholder="2" required />
            <span class="unit">pts</span>
          </div>
        </div>

        <div class="param-field">
          <label for="APO_input">Access Points (opposing side)</label>
          <div class="cell-field">
            <input id="APO_input" type="number" min="0" class="input input-bordered input-sm" bind:value={access_points_opposing} placeholder="2" required />
            <span class="unit">pts</span>
          </div>
        </div>

        <div class="param-field">
          <label for="POL_input">Opposing Points Reachable by Left Turn</label>
          <div class="cell-field">
            <input id="POL_input" type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={pct_opposing_left_accessible} placeholder="100" required />
            <span class="unit">%</span>
          </div>
          <p class="param-hint">Use 0 for a full restrictive median with no openings.</p>
        </div>

        <div class="param-field">
          <label for="SSP_input">Signal Spacing (optional)</label>
          <div class="cell-field">
            <input id="SSP_input" type="number" min="0" class="input input-bordered input-sm" bind:value={signal_spacing} placeholder="segment length" />
            <span class="unit">ft</span>
          </div>
        </div>

        <div class="param-field">
          <label for="FFO_input">Measured Free-Flow Speed (optional)</label>
          <div class="cell-field">
            <input id="FFO_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ffs_override} placeholder="predicted" />
            <span class="unit">mph</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Traffic -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Traffic</h2>
          <p class="panel-sub">Demand flow rates in the subject direction of travel.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="DEM_input">Through Demand Flow Rate</label>
          <div class="cell-field">
            <input id="DEM_input" type="number" min="0" class="input input-bordered input-sm" bind:value={through_demand} placeholder="800" required />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">At the downstream boundary intersection.</p>
        </div>

        <div class="param-field">
          <label for="MID_input">Midsegment Flow Rate (optional)</label>
          <div class="cell-field">
            <input id="MID_input" type="number" min="0" class="input input-bordered input-sm" bind:value={midsegment_flow} placeholder="through demand" />
            <span class="unit">veh/h</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Downstream boundary intersection -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Downstream Boundary Intersection</h2>
          <p class="panel-sub">Control type and the through-movement performance inputs from the intersection analysis.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="CTRL_input">Control Type</label>
          <select id="CTRL_input" class="select select-bordered select-sm" bind:value={control}>
            <option value="signalized">Signalized</option>
            <option value="allwaystop">All-Way STOP</option>
            <option value="yield">YIELD Controlled</option>
            <option value="roundabout">Roundabout</option>
            <option value="uncontrolled">Uncontrolled</option>
          </select>
        </div>

        {#if control !== 'uncontrolled'}
          <div class="param-field">
            <label for="DEL_input">Through Control Delay</label>
            <div class="cell-field">
              <input id="DEL_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={through_delay} placeholder="20" required />
              <span class="unit">s/veh</span>
            </div>
            <p class="param-hint">From the Chapter 19, 21, or 22 analysis of the intersection.</p>
          </div>
        {/if}

        <div class="param-field">
          <label for="CAP_input">Through Capacity (optional)</label>
          <div class="cell-field">
            <input id="CAP_input" type="number" min="0" class="input input-bordered input-sm" bind:value={through_capacity} placeholder="1600" />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">Needed for the volume-to-capacity ratio and the LOS F check.</p>
        </div>

        {#if control === 'signalized'}
          <div class="param-field">
            <label for="CYC_input">Cycle Length</label>
            <div class="cell-field">
              <input id="CYC_input" type="number" min="0" class="input input-bordered input-sm" bind:value={cycle_length} placeholder="100" />
              <span class="unit">s</span>
            </div>
          </div>

          <div class="param-field">
            <label for="GRN_input">Effective Green Time</label>
            <div class="cell-field">
              <input id="GRN_input" type="number" min="0" class="input input-bordered input-sm" bind:value={effective_green} placeholder="45" />
              <span class="unit">s</span>
            </div>
          </div>

          <div class="param-field">
            <label for="PR_input">Platoon Ratio (optional)</label>
            <div class="cell-field">
              <input id="PR_input" type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={platoon_ratio} placeholder="1.000" />
            </div>
            <p class="param-hint">Leave 1.0 for uncoordinated arrivals. 1.333 reflects favorable progression.</p>
          </div>

          <div class="param-field">
            <label for="SAT_input">Adjusted Saturation Flow Rate</label>
            <div class="cell-field">
              <input id="SAT_input" type="number" min="0" class="input input-bordered input-sm" bind:value={sat_flow} placeholder="1800" />
              <span class="unit">veh/h/ln</span>
            </div>
          </div>
        {/if}

        <div class="param-field">
          <label for="STP_input">Full Stop Rate (optional)</label>
          <div class="cell-field">
            <input id="STP_input" type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={stop_rate_override} placeholder="0.5" />
            <span class="unit">stops/veh</span>
          </div>
          <p class="param-hint">Supply a value from an HCM computational engine. Unsignalized boundaries use the HCM defaults when blank.</p>
        </div>

        <div class="param-field">
          <label for="PLTL_input">Intersections with Left-Turn Lanes</label>
          <div class="cell-field">
            <input id="PLTL_input" type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={pct_left_turn_lanes} placeholder="100" required />
            <span class="unit">%</span>
          </div>
          <p class="param-hint">Used by the traveler perception score.</p>
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
            <th>Base Free-Flow Speed (mi/hr):</th>
            <td>{results ? fmt(results.base_ffs, 1) : ''}</td>
          </tr>
          <tr>
            <th>Free-Flow Speed (mi/hr):</th>
            <td>{results ? fmt(results.free_flow_speed, 1) : ''}</td>
          </tr>
          <tr>
            <th>Segment Running Time (s):</th>
            <td>{results ? fmt(results.running_time, 1) : ''}</td>
          </tr>
          <tr>
            <th>Through Delay (s/veh):</th>
            <td>{results ? fmt(results.through_delay, 1) : ''}</td>
          </tr>
          <tr>
            <th>Travel Speed (mi/hr):</th>
            <td>{results ? fmt(results.travel_speed, 1) : ''}</td>
          </tr>
          <tr>
            <th>Full Stop Rate (stops/veh):</th>
            <td>{results ? fmt(results.full_stop_rate, 2) : ''}</td>
          </tr>
          <tr>
            <th>Spatial Stop Rate (stops/mi):</th>
            <td>{results ? fmt(results.spatial_stop_rate, 2) : ''}</td>
          </tr>
          <tr>
            <th>Volume-to-Capacity Ratio:</th>
            <td>{results ? fmt(results.vc_ratio, 2) : ''}</td>
          </tr>
          <tr>
            <th>Traveler Perception Score:</th>
            <td>{results ? fmt(results.perception_score, 2) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Segment LOS: {results ? results.los : ''}</p>
      </div>
    </div>
  </section>
</div>
