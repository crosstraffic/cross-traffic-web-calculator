<svelte:head>
  <title>HCM Calculator — Urban Street Reliability and ATDM</title>
</svelte:head>

<script>
  import init, { WasmUrbanReliability } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;
  let running = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Reliability reporting period and demand model
  let functional_class = 'principal';
  let study_start_hour = 7;
  let analysis_periods = 12;

  // Representative monthly weather statistics (applied to all 12 months)
  let precip_per_month = 2.5;
  let days_with_precip = 8;
  let mean_temp = 55;
  let precip_rate = 0.06;

  // Incident inputs
  let entry_intersection_crashes = 32;
  let minor_leg_volume = 400;
  let shoulder_present = 'yes';

  // Monte Carlo seeds (same seeds reproduce the same scenario streams)
  let weather_seed = 82;
  let demand_seed = 11;
  let incident_seed = 63;

  function defaultSegment() {
    return {
      segment_length: 1320,
      n_through_lanes: 2,
      speed_limit: 35,
      through_demand: 800,
      cycle_length: 100,
      effective_green: 45,
      sat_flow: 1800,
      platoon_ratio: 1.333,
      access_points_subject: 2,
      access_points_opposing: 2,
      stop_rate_override: 0.5,
      segment_crashes: 15,
      intersection_crashes: 33
    };
  }

  // Signalized segments ordered upstream to downstream
  let segments = [defaultSegment(), defaultSegment()];

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
    running = true;

    // Let the button state paint before the synchronous WASM run starts.
    setTimeout(() => {
      try {
        const rel = new WasmUrbanReliability(
          functional_class,
          Number(study_start_hour),
          Number(analysis_periods),
          [Number(precip_per_month)],
          [Number(days_with_precip)],
          [Number(mean_temp)],
          [Number(precip_rate)],
          Number(entry_intersection_crashes),
          Number(minor_leg_volume),
          shoulder_present === 'yes',
          true,                      // VMT-weighted travel time distribution
          Number(weather_seed),
          Number(demand_seed),
          Number(incident_seed)
        );

        for (const seg of segments) {
          rel.add_segment(
            Number(seg.segment_length),
            Number(seg.n_through_lanes),
            Number(seg.speed_limit),
            Number(seg.through_demand),
            Number(seg.cycle_length),
            Number(seg.effective_green),
            opt(seg.sat_flow),
            opt(seg.platoon_ratio),
            Number(seg.access_points_subject),
            Number(seg.access_points_opposing),
            opt(seg.stop_rate_override),
            Number(seg.segment_crashes),
            Number(seg.intersection_crashes)
          );
        }

        rel.run();
        results = rel.results_to_js_value();
      } catch (err) {
        console.error('Chapter 17 analysis failed:', err);
        hasError = true;
        errMessage = 'The reliability run could not be completed with the given inputs. Check the values and try again.';
      } finally {
        running = false;
      }
    }, 20);
  }

  function resetParams() {
    functional_class = 'principal';
    study_start_hour = 7;
    analysis_periods = 12;
    precip_per_month = 2.5;
    days_with_precip = 8;
    mean_temp = 55;
    precip_rate = 0.06;
    entry_intersection_crashes = 32;
    minor_leg_volume = 400;
    shoulder_present = 'yes';
    weather_seed = 82;
    demand_seed = 11;
    incident_seed = 63;
    segments = [defaultSegment(), defaultSegment()];
    results = null;
    hasError = false;
  }

  function fmt(v, digits) {
    return v === null || v === undefined ? '' : v.toFixed(digits);
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Chapter 17 · Urban Street Reliability and ATDM <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Urban Street Reliability and ATDM</h1>
    <p class="page-sub">
      Estimate the travel time distribution, travel time index, and reliability
      rating of a signalized urban street facility over a one-year weekday
      reporting period with generated weather, demand, and incident scenarios.
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

  <form id="hcm17" on:submit|preventDefault={runAnalysis}>
    <!-- Reporting period -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Reliability Reporting Period</h2>
          <p class="panel-sub">Weekdays of a full year. Demand ratios follow the HCM defaults for the selected functional class.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="FC_input">Functional Class</label>
          <select id="FC_input" class="select select-bordered select-sm" bind:value={functional_class}>
            <option value="principal">Urban Principal Arterial</option>
            <option value="minor">Urban Minor Arterial</option>
            <option value="expressway">Expressway</option>
          </select>
        </div>

        <div class="param-field">
          <label for="SSH_input">Study Period Start Hour</label>
          <div class="cell-field">
            <input id="SSH_input" type="number" min="0" max="23" class="input input-bordered input-sm" bind:value={study_start_hour} placeholder="7" required />
            <span class="unit">h</span>
          </div>
          <p class="param-hint">7 starts the study period at 7 a.m.</p>
        </div>

        <div class="param-field">
          <label for="APD_input">Analysis Periods per Day</label>
          <div class="cell-field">
            <input id="APD_input" type="number" min="1" max="96" class="input input-bordered input-sm" bind:value={analysis_periods} placeholder="12" required />
            <span class="unit">15-min</span>
          </div>
          <p class="param-hint">12 periods cover a 3-hour study period.</p>
        </div>
      </div>
    </section>

    <!-- Weather -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Weather</h2>
          <p class="panel-sub">Representative monthly statistics applied to all 12 months. Mean temperatures below 32 F generate snow events.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="PRC_input">Total Precipitation per Month</label>
          <div class="cell-field">
            <input id="PRC_input" type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={precip_per_month} placeholder="2.5" required />
            <span class="unit">in.</span>
          </div>
        </div>

        <div class="param-field">
          <label for="DWP_input">Days with Precipitation per Month</label>
          <div class="cell-field">
            <input id="DWP_input" type="number" step="0.1" min="0" max="31" class="input input-bordered input-sm" bind:value={days_with_precip} placeholder="8" required />
            <span class="unit">days</span>
          </div>
        </div>

        <div class="param-field">
          <label for="TMP_input">Normal Daily Mean Temperature</label>
          <div class="cell-field">
            <input id="TMP_input" type="number" step="0.1" class="input input-bordered input-sm" bind:value={mean_temp} placeholder="55" required />
            <span class="unit">F</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PRR_input">Precipitation Rate</label>
          <div class="cell-field">
            <input id="PRR_input" type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={precip_rate} placeholder="0.06" required />
            <span class="unit">in./h</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Incidents -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Incidents</h2>
          <p class="panel-sub">Crash frequencies drive the incident generator. Per-segment values are entered with each segment below.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="EIC_input">Entry Intersection Crash Frequency</label>
          <div class="cell-field">
            <input id="EIC_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={entry_intersection_crashes} placeholder="32" required />
            <span class="unit">crashes/yr</span>
          </div>
          <p class="param-hint">The intersection at the upstream end of the facility.</p>
        </div>

        <div class="param-field">
          <label for="MLV_input">Minor-Street Leg Volume</label>
          <div class="cell-field">
            <input id="MLV_input" type="number" min="0" class="input input-bordered input-sm" bind:value={minor_leg_volume} placeholder="400" required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="SHP_input">Outside Shoulders Present</label>
          <select id="SHP_input" class="select select-bordered select-sm" bind:value={shoulder_present}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div class="param-field">
          <label for="WSE_input">Weather Seed</label>
          <div class="cell-field">
            <input id="WSE_input" type="number" min="0" class="input input-bordered input-sm" bind:value={weather_seed} placeholder="82" required />
          </div>
        </div>

        <div class="param-field">
          <label for="DSE_input">Demand Seed</label>
          <div class="cell-field">
            <input id="DSE_input" type="number" min="0" class="input input-bordered input-sm" bind:value={demand_seed} placeholder="11" required />
          </div>
        </div>

        <div class="param-field">
          <label for="ISE_input">Incident Seed</label>
          <div class="cell-field">
            <input id="ISE_input" type="number" min="0" class="input input-bordered input-sm" bind:value={incident_seed} placeholder="63" required />
          </div>
        </div>
      </div>
    </section>

    <!-- Segments -->
    {#each segments as seg, i}
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Segment {i + 1}</h2>
            <p class="panel-sub">Signalized Chapter 18 segment, ordered upstream to downstream.</p>
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
            <p class="param-hint">Demand of the base traffic count. Scenario demands are scaled from it.</p>
          </div>

          <div class="param-field">
            <label for={"CYC_input_" + i}>Cycle Length</label>
            <div class="cell-field">
              <input id={"CYC_input_" + i} type="number" min="1" class="input input-bordered input-sm" bind:value={seg.cycle_length} placeholder="100" required />
              <span class="unit">s</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"GRN_input_" + i}>Effective Green Time</label>
            <div class="cell-field">
              <input id={"GRN_input_" + i} type="number" min="1" class="input input-bordered input-sm" bind:value={seg.effective_green} placeholder="45" required />
              <span class="unit">s</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"SAT_input_" + i}>Adjusted Saturation Flow Rate</label>
            <div class="cell-field">
              <input id={"SAT_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.sat_flow} placeholder="1800" />
              <span class="unit">veh/h/ln</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"PR_input_" + i}>Platoon Ratio (optional)</label>
            <div class="cell-field">
              <input id={"PR_input_" + i} type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={seg.platoon_ratio} placeholder="1.000" />
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
            <label for={"STP_input_" + i}>Full Stop Rate (optional)</label>
            <div class="cell-field">
              <input id={"STP_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={seg.stop_rate_override} placeholder="0.5" />
              <span class="unit">stops/veh</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"SCF_input_" + i}>Segment Crash Frequency</label>
            <div class="cell-field">
              <input id={"SCF_input_" + i} type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={seg.segment_crashes} placeholder="15" required />
              <span class="unit">crashes/yr</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"ICF_input_" + i}>Downstream Intersection Crash Frequency</label>
            <div class="cell-field">
              <input id={"ICF_input_" + i} type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={seg.intersection_crashes} placeholder="33" required />
              <span class="unit">crashes/yr</span>
            </div>
          </div>
        </div>
      </section>
    {/each}

    <!-- Form Actions -->
    <div class="action-bar">
      <button class="btn btn-ghost" on:click={addSegment} type="button">Add Segment</button>
      <button class="btn btn-ghost" on:click={resetParams} type="button">Reset Params</button>
      <button class="btn btn-primary" type="submit" disabled={!ready || running}>{running ? 'Running...' : 'Run Reliability Analysis'}</button>
    </div>
    <p class="param-hint">The run evaluates roughly three thousand scenarios and can take a few seconds.</p>
  </form>

  <section class="panel results-panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Outputs</h2>
        <p class="panel-sub">Results populate after the reliability run completes.</p>
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
            <th>Weather Events Generated:</th>
            <td>{results ? results.num_weather_events : ''}</td>
          </tr>
          <tr>
            <th>Incidents Generated:</th>
            <td>{results ? results.num_incidents : ''}</td>
          </tr>
          <tr>
            <th>Base Free-Flow Travel Time (s):</th>
            <td>{results ? fmt(results.base_free_flow_travel_time, 1) : ''}</td>
          </tr>
          <tr>
            <th>Mean Travel Time (s):</th>
            <td>{results ? fmt(results.mean_travel_time, 1) : ''}</td>
          </tr>
          <tr>
            <th>Mean Travel Time Index:</th>
            <td>{results ? fmt(results.tti_mean, 3) : ''}</td>
          </tr>
          <tr>
            <th>50th Percentile TTI:</th>
            <td>{results ? fmt(results.tti_50, 3) : ''}</td>
          </tr>
          <tr>
            <th>80th Percentile TTI:</th>
            <td>{results ? fmt(results.tti_80, 3) : ''}</td>
          </tr>
          <tr>
            <th>95th Percentile TTI (PTI):</th>
            <td>{results ? fmt(results.tti_95, 3) : ''}</td>
          </tr>
          <tr>
            <th>Total Vehicle Hours of Delay (veh-h):</th>
            <td>{results ? fmt(results.total_vhd, 0) : ''}</td>
          </tr>
          <tr>
            <th>Scenarios with Nondry Weather (%):</th>
            <td>{results ? fmt(results.pct_nondry_scenarios, 1) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Urban Street Reliability Rating: {results ? fmt(results.reliability_rating, 1) + ' %' : ''}</p>
      </div>
    </div>
  </section>
</div>
