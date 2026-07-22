<svelte:head>
  <title>HCM Calculator — Signalized Intersections</title>
</svelte:head>

<script>
  import init, { WasmSignalizedIntersection } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Inputs (defaults describe a four-leg pretimed signal with permitted lefts)
  let cycle_length = 100;
  let phf = 0.92;
  let base_sat_flow = 1900;
  let area_type = 'other';
  let yellow = 4;
  let red_clearance = 0;
  let phv = 3;
  let speed_limit = 35;
  let lane_width = 12;
  let ped_flow = 0;

  const defaultApproaches = () => ([
    { key: 'NB', label: 'Northbound', v_left: 50, v_thru: 400, v_right: 50, ln_left: 1, ln_thru: 1, ln_right: 0, thru_phase: 50, left_phase: 0 },
    { key: 'SB', label: 'Southbound', v_left: 50, v_thru: 400, v_right: 50, ln_left: 1, ln_thru: 1, ln_right: 0, thru_phase: 50, left_phase: 0 },
    { key: 'EB', label: 'Eastbound', v_left: 50, v_thru: 300, v_right: 50, ln_left: 1, ln_thru: 1, ln_right: 0, thru_phase: 50, left_phase: 0 },
    { key: 'WB', label: 'Westbound', v_left: 50, v_thru: 300, v_right: 50, ln_left: 1, ln_thru: 1, ln_right: 0, thru_phase: 50, left_phase: 0 }
  ]);

  let approaches = defaultApproaches();

  let results = null;
  let hasError = false;
  let errMessage = '';

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const volumes = [];
      const lanes = [];
      const thruPhases = [];
      const leftPhases = [];
      for (const ap of approaches) {
        volumes.push(Number(ap.v_left), Number(ap.v_thru), Number(ap.v_right));
        lanes.push(Number(ap.ln_left), Number(ap.ln_thru), Number(ap.ln_right));
        thruPhases.push(Number(ap.thru_phase));
        leftPhases.push(Number(ap.left_phase));
      }

      const ix = new WasmSignalizedIntersection(
        Number(cycle_length),
        0.25,                     // analysis period, h (15-min period)
        Number(base_sat_flow),
        area_type === 'cbd',
        Number(phf),
        volumes,
        lanes,
        thruPhases,
        leftPhases,
        Number(yellow),
        Number(red_clearance),
        Number(phv),
        Number(speed_limit),
        Number(lane_width),
        Number(ped_flow)
      );

      ix.analyze();
      const r = ix.results_to_js_value();
      results = {
        delay: r.intersection_delay_s,
        los: r.intersection_los,
        critical_vc: r.critical_vc_ratio,
        approaches: r.approaches
      };
    } catch (err) {
      console.error('Chapter 19 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    cycle_length = 100;
    phf = 0.92;
    base_sat_flow = 1900;
    area_type = 'other';
    yellow = 4;
    red_clearance = 0;
    phv = 3;
    speed_limit = 35;
    lane_width = 12;
    ped_flow = 0;
    approaches = defaultApproaches();
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Signalized Intersections <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Signalized Intersections</h1>
    <p class="page-sub">
      Estimate control delay and level of service for a four-leg pretimed
      signalized intersection, by approach and for the intersection as a whole.
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

  <form id="hcm19" on:submit|preventDefault={runAnalysis}>
    <!-- Signal Timing -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Signal and Site</h2>
          <p class="panel-sub">Cycle timing and intersection-wide characteristics. Phase durations include the change period (G + Y + Rc), and the northbound and southbound approaches share one street phase pair with the eastbound and westbound approaches on the other.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="CYCLE_input">Cycle Length</label>
          <div class="cell-field">
            <input id="CYCLE_input" type="number" min="30" max="300" class="input input-bordered input-sm" bind:value={cycle_length} placeholder="100" required />
            <span class="unit">s</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="0.92" required />
          </div>
        </div>

        <div class="param-field">
          <label for="SAT_input">Base Saturation Flow</label>
          <div class="cell-field">
            <input id="SAT_input" type="number" min="1000" max="2200" class="input input-bordered input-sm" bind:value={base_sat_flow} placeholder="1900" required />
            <span class="unit">pc/h/ln</span>
          </div>
        </div>

        <div class="param-field">
          <label for="AREA_input">Area Type</label>
          <select id="AREA_input" class="select select-bordered select-sm" bind:value={area_type}>
            <option value="other">Non-CBD</option>
            <option value="cbd">Central Business District</option>
          </select>
        </div>

        <div class="param-field">
          <label for="Y_input">Yellow Change Interval</label>
          <div class="cell-field">
            <input id="Y_input" type="number" step="0.1" min="3" max="6" class="input input-bordered input-sm" bind:value={yellow} placeholder="4" required />
            <span class="unit">s</span>
          </div>
        </div>

        <div class="param-field">
          <label for="RC_input">Red Clearance Interval</label>
          <div class="cell-field">
            <input id="RC_input" type="number" step="0.1" min="0" max="5" class="input input-bordered input-sm" bind:value={red_clearance} placeholder="0" required />
            <span class="unit">s</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PHV_input">Heavy Vehicles</label>
          <div class="cell-field">
            <input id="PHV_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="3" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="SPL_input">Posted Speed Limit</label>
          <div class="cell-field">
            <input id="SPL_input" type="number" min="0" class="input input-bordered input-sm" bind:value={speed_limit} placeholder="35" required />
            <span class="unit">mph</span>
          </div>
        </div>

        <div class="param-field">
          <label for="LW_input">Average Lane Width</label>
          <div class="cell-field">
            <input id="LW_input" type="number" step="0.5" min="8" max="16" class="input input-bordered input-sm" bind:value={lane_width} placeholder="12" required />
            <span class="unit">ft</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PED_input">Conflicting Pedestrians</label>
          <div class="cell-field">
            <input id="PED_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ped_flow} placeholder="0" required />
            <span class="unit">p/h</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Approaches -->
    {#each approaches as ap (ap.key)}
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">{ap.label} Approach</h2>
            <p class="panel-sub">Demand volumes, lanes, and phase durations for the {ap.key} approach. Set the left phase to 0 for a permitted left turn.</p>
          </div>
        </div>
        <div class="param-grid">
          <div class="param-field">
            <label for="{ap.key}_VL_input">Left-Turn Volume</label>
            <div class="cell-field">
              <input id="{ap.key}_VL_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ap.v_left} placeholder="50" required />
              <span class="unit">veh/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="{ap.key}_VT_input">Through Volume</label>
            <div class="cell-field">
              <input id="{ap.key}_VT_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ap.v_thru} placeholder="400" required />
              <span class="unit">veh/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="{ap.key}_VR_input">Right-Turn Volume</label>
            <div class="cell-field">
              <input id="{ap.key}_VR_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ap.v_right} placeholder="50" required />
              <span class="unit">veh/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="{ap.key}_LL_input">Exclusive Left Lanes</label>
            <div class="cell-field">
              <input id="{ap.key}_LL_input" type="number" min="0" max="3" class="input input-bordered input-sm" bind:value={ap.ln_left} placeholder="1" required />
            </div>
          </div>

          <div class="param-field">
            <label for="{ap.key}_LT_input">Through Lanes</label>
            <div class="cell-field">
              <input id="{ap.key}_LT_input" type="number" min="1" max="5" class="input input-bordered input-sm" bind:value={ap.ln_thru} placeholder="1" required />
            </div>
          </div>

          <div class="param-field">
            <label for="{ap.key}_LR_input">Exclusive Right Lanes</label>
            <div class="cell-field">
              <input id="{ap.key}_LR_input" type="number" min="0" max="3" class="input input-bordered input-sm" bind:value={ap.ln_right} placeholder="0" required />
            </div>
            <p class="param-hint">A right turn without an exclusive lane shares the rightmost through lane.</p>
          </div>

          <div class="param-field">
            <label for="{ap.key}_TP_input">Through Phase Duration</label>
            <div class="cell-field">
              <input id="{ap.key}_TP_input" type="number" step="0.1" min="5" class="input input-bordered input-sm" bind:value={ap.thru_phase} placeholder="50" required />
              <span class="unit">s</span>
            </div>
          </div>

          <div class="param-field">
            <label for="{ap.key}_LP_input">Protected Left Phase Duration</label>
            <div class="cell-field">
              <input id="{ap.key}_LP_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={ap.left_phase} placeholder="0" required />
              <span class="unit">s</span>
            </div>
            <p class="param-hint">Requires an exclusive left lane. Use 0 for a permitted left turn.</p>
          </div>
        </div>
      </section>
    {/each}

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
            <th>Approach</th>
            <th>Flow Rate (veh/h)</th>
            <th>Control Delay (s/veh)</th>
            <th>LOS</th>
          </tr>
        </thead>
        <tbody>
          {#if results}
            {#each results.approaches as ar}
              <tr>
                <th>{ar.direction}</th>
                <td>{ar.flow_rate.toFixed(0)}</td>
                <td>{ar.control_delay_s.toFixed(1)}</td>
                <td>{ar.los}</td>
              </tr>
            {/each}
          {:else}
            <tr>
              <th>NB</th><td></td><td></td><td></td>
            </tr>
            <tr>
              <th>SB</th><td></td><td></td><td></td>
            </tr>
            <tr>
              <th>EB</th><td></td><td></td><td></td>
            </tr>
            <tr>
              <th>WB</th><td></td><td></td><td></td>
            </tr>
          {/if}
        </tbody>
      </table>
      <table class="table w-full">
        <tbody>
          <tr>
            <th>Intersection Control Delay (s/veh):</th>
            <td>{results && Number.isFinite(results.delay) ? results.delay.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Critical Volume-to-Capacity Ratio Xc:</th>
            <td>{results && Number.isFinite(results.critical_vc) ? results.critical_vc.toFixed(2) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Intersection LOS: {results ? results.los : ''}</p>
      </div>
    </div>
  </section>
</div>
