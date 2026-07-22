<svelte:head>
  <title>HCM Calculator — Two-Way STOP-Controlled Intersections</title>
</svelte:head>

<script>
  import init, { WasmTwsc } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Inputs (defaults follow HCM Chapter 32 TWSC Example Problem 1, a
  // three-leg intersection with the minor stem northbound)
  let intersection_type = 'three_leg';
  let major_lanes = 1;
  let rt_eb = 'shared';
  let rt_wb = 'shared';
  let minor_nb = 'single_shared';
  let minor_sb = 'single_shared';
  let grade_nb = 0;
  let grade_sb = 0;

  let v1 = 0, v1u = 0, v2 = 240, v3 = 40;
  let v4 = 160, v4u = 0, v5 = 300, v6 = 0;
  let v7 = 40, v8 = 0, v9 = 120;
  let v10 = 0, v11 = 0, v12 = 0;

  let phf = '';
  let phv = 10;
  let analysis_period = 0.25;

  const movementNames = {
    '1': 'Major EB left', '1U': 'Major EB U-turn',
    '4': 'Major WB left', '4U': 'Major WB U-turn',
    '7': 'Minor NB left', '8': 'Minor NB through', '9': 'Minor NB right',
    '10': 'Minor SB left', '11': 'Minor SB through', '12': 'Minor SB right'
  };

  let results = null;
  let hasError = false;
  let errMessage = '';

  function fmt(v, digits = 1) {
    return v === null || v === undefined ? '' : Number(v).toFixed(digits);
  }

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const t = new WasmTwsc(
        Number(v1), Number(v1u), Number(v2), Number(v3),
        Number(v4), Number(v4u), Number(v5), Number(v6),
        Number(v7), Number(v8), Number(v9),
        Number(v10), Number(v11), Number(v12),
        undefined, undefined, undefined, undefined,  // pedestrian movements 13-16, p/h
        intersection_type === 'three_leg',
        Number(major_lanes),
        rt_eb,
        rt_wb,
        undefined,                                   // U-turn median width (wide)
        Number(grade_nb),
        Number(grade_sb),
        minor_nb,
        minor_sb,
        undefined, undefined,                        // median storage NB/SB
        undefined, undefined,                        // flare storage NB/SB
        undefined,                                   // lane width (12 ft)
        phf === '' || phf === null ? undefined : Number(phf),
        Number(analysis_period),
        Number(phv)
      );

      t.analyze();
      const res = t.results_to_js_value();

      const movementRows = res.movements
        .filter((m) => m.movement_capacity !== null)
        .map((m) => ({ ...m, name: movementNames[m.movement] || m.movement }));

      const laneRows = res.lanes_nb
        .map((l, i) => ({ approach: 'NB', lane: i + 1, ...l }))
        .concat(res.lanes_sb.map((l, i) => ({ approach: 'SB', lane: i + 1, ...l })));

      const approachRows = res.approach_delays
        ? ['EB', 'WB', 'NB', 'SB'].map((label, i) => ({ label, delay: res.approach_delays[i] }))
        : [];

      results = {
        movementRows,
        laneRows,
        approachRows,
        intersectionDelay: res.intersection_delay
      };
    } catch (err) {
      console.error('Chapter 20 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    intersection_type = 'three_leg';
    major_lanes = 1;
    rt_eb = 'shared';
    rt_wb = 'shared';
    minor_nb = 'single_shared';
    minor_sb = 'single_shared';
    grade_nb = 0;
    grade_sb = 0;
    v1 = 0; v1u = 0; v2 = 240; v3 = 40;
    v4 = 160; v4u = 0; v5 = 300; v6 = 0;
    v7 = 40; v8 = 0; v9 = 120;
    v10 = 0; v11 = 0; v12 = 0;
    phf = '';
    phv = 10;
    analysis_period = 0.25;
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Chapter 20 · Two-Way STOP-Controlled Intersections <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Two-Way STOP-Controlled Intersections</h1>
    <p class="page-sub">
      Estimate movement capacities, control delay, queues, and level of service
      for the controlled movements at a two-way STOP-controlled intersection.
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

  <form id="hcm20" on:submit|preventDefault={runAnalysis}>
    <!-- Geometry -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Geometry</h2>
          <p class="panel-sub">Legs, major-street cross section, and minor-approach lane allocation. The major street runs east-west and the minor stem of a three-leg intersection is northbound.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="TYPE_input">Intersection Type</label>
          <select id="TYPE_input" class="select select-bordered select-sm" bind:value={intersection_type}>
            <option value="four_leg">Four-leg</option>
            <option value="three_leg">Three-leg (T)</option>
          </select>
        </div>

        <div class="param-field">
          <label for="MLD_input">Major Lanes per Direction</label>
          <div class="cell-field">
            <input id="MLD_input" type="number" min="1" max="3" class="input input-bordered input-sm" bind:value={major_lanes} required />
          </div>
        </div>

        <div class="param-field">
          <label for="RTEB_input">Major Right Turn (EB)</label>
          <select id="RTEB_input" class="select select-bordered select-sm" bind:value={rt_eb}>
            <option value="shared">Shared with through</option>
            <option value="exclusive">Exclusive lane</option>
            <option value="channelized">Channelized</option>
          </select>
        </div>

        <div class="param-field">
          <label for="RTWB_input">Major Right Turn (WB)</label>
          <select id="RTWB_input" class="select select-bordered select-sm" bind:value={rt_wb}>
            <option value="shared">Shared with through</option>
            <option value="exclusive">Exclusive lane</option>
            <option value="channelized">Channelized</option>
          </select>
        </div>

        <div class="param-field">
          <label for="MNNB_input">Minor Lanes (NB)</label>
          <select id="MNNB_input" class="select select-bordered select-sm" bind:value={minor_nb}>
            <option value="single_shared">Single shared lane</option>
            <option value="shared_lt_exclusive_r">Shared left-through plus right lane</option>
            <option value="exclusive_l_shared_tr">Left lane plus shared through-right</option>
            <option value="separate">Separate lane per movement</option>
          </select>
        </div>

        <div class="param-field">
          <label for="MNSB_input">Minor Lanes (SB)</label>
          <select id="MNSB_input" class="select select-bordered select-sm" bind:value={minor_sb}>
            <option value="single_shared">Single shared lane</option>
            <option value="shared_lt_exclusive_r">Shared left-through plus right lane</option>
            <option value="exclusive_l_shared_tr">Left lane plus shared through-right</option>
            <option value="separate">Separate lane per movement</option>
          </select>
          <p class="param-hint">Ignored for a three-leg intersection.</p>
        </div>

        <div class="param-field">
          <label for="GRNB_input">Minor Approach Grade (NB)</label>
          <div class="cell-field">
            <input id="GRNB_input" type="number" step="0.1" class="input input-bordered input-sm" bind:value={grade_nb} placeholder="0" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="GRSB_input">Minor Approach Grade (SB)</label>
          <div class="cell-field">
            <input id="GRSB_input" type="number" step="0.1" class="input input-bordered input-sm" bind:value={grade_sb} placeholder="0" required />
            <span class="unit">%</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Demand -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Demand</h2>
          <p class="panel-sub">Turning-movement volumes numbered per HCM Exhibit 20-1. Movements 10 to 12 apply to four-leg intersections only.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="V1_input">Mv 1 · Major EB Left</label>
          <div class="cell-field">
            <input id="V1_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v1} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V1U_input">Mv 1U · Major EB U-Turn</label>
          <div class="cell-field">
            <input id="V1U_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v1u} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V2_input">Mv 2 · Major EB Through</label>
          <div class="cell-field">
            <input id="V2_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v2} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V3_input">Mv 3 · Major EB Right</label>
          <div class="cell-field">
            <input id="V3_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v3} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V4_input">Mv 4 · Major WB Left</label>
          <div class="cell-field">
            <input id="V4_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v4} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V4U_input">Mv 4U · Major WB U-Turn</label>
          <div class="cell-field">
            <input id="V4U_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v4u} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V5_input">Mv 5 · Major WB Through</label>
          <div class="cell-field">
            <input id="V5_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v5} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V6_input">Mv 6 · Major WB Right</label>
          <div class="cell-field">
            <input id="V6_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v6} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V7_input">Mv 7 · Minor NB Left</label>
          <div class="cell-field">
            <input id="V7_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v7} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V8_input">Mv 8 · Minor NB Through</label>
          <div class="cell-field">
            <input id="V8_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v8} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V9_input">Mv 9 · Minor NB Right</label>
          <div class="cell-field">
            <input id="V9_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v9} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V10_input">Mv 10 · Minor SB Left</label>
          <div class="cell-field">
            <input id="V10_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v10} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V11_input">Mv 11 · Minor SB Through</label>
          <div class="cell-field">
            <input id="V11_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v11} required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="V12_input">Mv 12 · Minor SB Right</label>
          <div class="cell-field">
            <input id="V12_input" type="number" min="0" class="input input-bordered input-sm" bind:value={v12} required />
            <span class="unit">veh/h</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Traffic -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Traffic</h2>
          <p class="panel-sub">Peaking and traffic-stream characteristics.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="0.95" />
          </div>
          <p class="param-hint">Leave blank if the demand values are already peak 15-min flow rates.</p>
        </div>

        <div class="param-field">
          <label for="PHV_input">Heavy Vehicles</label>
          <div class="cell-field">
            <input id="PHV_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="10" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="T_input">Analysis Period</label>
          <div class="cell-field">
            <input id="T_input" type="number" step="0.05" min="0.05" max="1" class="input input-bordered input-sm" bind:value={analysis_period} placeholder="0.25" required />
            <span class="unit">h</span>
          </div>
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
        <thead>
          <tr>
            <th>Movement</th>
            <th>Flow Rate (veh/h)</th>
            <th>Capacity (veh/h)</th>
            <th>Delay (s/veh)</th>
            <th>LOS</th>
            <th>95% Queue (veh)</th>
          </tr>
        </thead>
        <tbody>
          {#if results}
            {#each results.movementRows as m}
              <tr>
                <td>{m.movement} · {m.name}</td>
                <td>{fmt(m.flow_rate, 0)}</td>
                <td>{fmt(m.movement_capacity, 0)}</td>
                <td>{fmt(m.control_delay)}</td>
                <td>{m.los ?? ''}</td>
                <td>{fmt(m.queue_95)}</td>
              </tr>
            {/each}
            {#each results.laneRows as l}
              <tr>
                <td>{l.approach} lane {l.lane} (Mv {l.movements})</td>
                <td>{fmt(l.flow_rate, 0)}</td>
                <td>{fmt(l.capacity, 0)}</td>
                <td>{fmt(l.control_delay)}</td>
                <td>{l.los}</td>
                <td>{fmt(l.queue_95)}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
      <table class="table w-full">
        <tbody>
          {#if results}
            {#each results.approachRows as a}
              <tr>
                <th>{a.label} Approach Delay (s/veh):</th>
                <td>{fmt(a.delay)}</td>
              </tr>
            {/each}
          {/if}
          <tr>
            <th>Intersection Delay (s/veh):</th>
            <td>{results ? fmt(results.intersectionDelay) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>LOS is reported per movement and per lane. The HCM does not define a LOS letter for a TWSC intersection as a whole.</p>
      </div>
    </div>
  </section>
</div>
