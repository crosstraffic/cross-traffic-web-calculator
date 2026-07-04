<svelte:head>
  <title>HCM Calculator — Roundabouts</title>
</svelte:head>

<script>
  import init, { WasmRoundabouts } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  const legs = [
    { key: 'nb', label: 'Northbound (NB)', note: 'south leg' },
    { key: 'sb', label: 'Southbound (SB)', note: 'north leg' },
    { key: 'eb', label: 'Eastbound (EB)', note: 'west leg' },
    { key: 'wb', label: 'Westbound (WB)', note: 'east leg' }
  ];

  // Defaults follow HCM Chapter 33 Roundabout Example Problem 1, a four-leg
  // single-lane roundabout with a yielding WB bypass and a nonyielding SB
  // bypass, plus 50 p/h crossing the NB entry.
  function defaultEntries() {
    return {
      nb: { u: 30, l: 105, t: 210, r: 50, hv: 2, entryLanes: 1, circLanes: 1, exitLanes: 1, bypass: 'none', laneAssignment: 'lt_tr', nped: 50 },
      sb: { u: 20, l: 175, t: 95, r: 580, hv: 2, entryLanes: 1, circLanes: 1, exitLanes: 1, bypass: 'nonyielding', laneAssignment: 'lt_tr', nped: 0 },
      eb: { u: 50, l: 190, t: 280, r: 85, hv: 2, entryLanes: 1, circLanes: 1, exitLanes: 1, bypass: 'none', laneAssignment: 'lt_tr', nped: 0 },
      wb: { u: 20, l: 110, t: 395, r: 610, hv: 2, entryLanes: 1, circLanes: 1, exitLanes: 1, bypass: 'yielding', laneAssignment: 'lt_tr', nped: 0 }
    };
  }

  let entries = defaultEntries();
  let phf = 0.94;
  let analysis_period = 0.25;

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
      // Entry array layout expected by the engine:
      // [v_u, v_l, v_t, v_r, heavy_vehicle_pct, entry_lanes,
      //  circulating_lanes, exiting_lanes, n_ped]
      const flat = (key) => {
        const e = entries[key];
        return new Float64Array([
          Number(e.u), Number(e.l), Number(e.t), Number(e.r),
          Number(e.hv), Number(e.entryLanes), Number(e.circLanes),
          Number(e.exitLanes), Number(e.nped)
        ]);
      };

      const r = new WasmRoundabouts(
        flat('nb'),
        flat('sb'),
        flat('eb'),
        flat('wb'),
        entries.nb.bypass,
        entries.sb.bypass,
        entries.eb.bypass,
        entries.wb.bypass,
        entries.nb.laneAssignment,
        entries.sb.laneAssignment,
        entries.eb.laneAssignment,
        entries.wb.laneAssignment,
        phf === '' || phf === null ? undefined : Number(phf),
        Number(analysis_period)
      );

      r.analyze();
      const res = r.results_to_js_value();

      const laneRows = [];
      const approachRows = [];
      for (const leg of legs) {
        const ap = res[leg.key];
        ap.lanes.forEach((l) => {
          laneRows.push({ entry: leg.key.toUpperCase(), ...l });
        });
        if (ap.bypass) {
          laneRows.push({ entry: leg.key.toUpperCase(), ...ap.bypass });
        }
        approachRows.push({ label: leg.key.toUpperCase(), delay: ap.control_delay, los: ap.los });
      }

      results = {
        laneRows,
        approachRows,
        intersectionDelay: res.intersection_delay,
        intersectionLos: res.intersection_los
      };
    } catch (err) {
      console.error('Chapter 22 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    entries = defaultEntries();
    phf = 0.94;
    analysis_period = 0.25;
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Chapter 22 · Roundabouts <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Roundabouts</h1>
    <p class="page-sub">
      Estimate entry capacities, control delay, queues, and level of service
      for each entry lane and for the roundabout as a whole.
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

  <form id="hcm22" on:submit|preventDefault={runAnalysis}>
    {#each legs as leg}
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">{leg.label} Entry</h2>
            <p class="panel-sub">Demand and geometry for the {leg.note} entry.</p>
          </div>
        </div>
        <div class="param-grid">
          <div class="param-field">
            <label for="U_{leg.key}_input">U-Turn Volume</label>
            <div class="cell-field">
              <input id="U_{leg.key}_input" type="number" min="0" class="input input-bordered input-sm" bind:value={entries[leg.key].u} required />
              <span class="unit">veh/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="L_{leg.key}_input">Left-Turn Volume</label>
            <div class="cell-field">
              <input id="L_{leg.key}_input" type="number" min="0" class="input input-bordered input-sm" bind:value={entries[leg.key].l} required />
              <span class="unit">veh/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="T_{leg.key}_input">Through Volume</label>
            <div class="cell-field">
              <input id="T_{leg.key}_input" type="number" min="0" class="input input-bordered input-sm" bind:value={entries[leg.key].t} required />
              <span class="unit">veh/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="R_{leg.key}_input">Right-Turn Volume</label>
            <div class="cell-field">
              <input id="R_{leg.key}_input" type="number" min="0" class="input input-bordered input-sm" bind:value={entries[leg.key].r} required />
              <span class="unit">veh/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="HV_{leg.key}_input">Heavy Vehicles</label>
            <div class="cell-field">
              <input id="HV_{leg.key}_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={entries[leg.key].hv} placeholder="2" required />
              <span class="unit">%</span>
            </div>
          </div>

          <div class="param-field">
            <label for="EL_{leg.key}_input">Entry Lanes</label>
            <select id="EL_{leg.key}_input" class="select select-bordered select-sm" bind:value={entries[leg.key].entryLanes}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>

          <div class="param-field">
            <label for="CL_{leg.key}_input">Circulating Lanes</label>
            <select id="CL_{leg.key}_input" class="select select-bordered select-sm" bind:value={entries[leg.key].circLanes}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>

          <div class="param-field">
            <label for="XL_{leg.key}_input">Exiting Lanes</label>
            <select id="XL_{leg.key}_input" class="select select-bordered select-sm" bind:value={entries[leg.key].exitLanes}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>

          <div class="param-field">
            <label for="BP_{leg.key}_input">Right-Turn Bypass</label>
            <select id="BP_{leg.key}_input" class="select select-bordered select-sm" bind:value={entries[leg.key].bypass}>
              <option value="none">None</option>
              <option value="yielding">Yielding</option>
              <option value="nonyielding">Nonyielding</option>
            </select>
          </div>

          <div class="param-field">
            <label for="LA_{leg.key}_input">Lane Assignment</label>
            <select id="LA_{leg.key}_input" class="select select-bordered select-sm" bind:value={entries[leg.key].laneAssignment}>
              <option value="lt_tr">LT, TR (shared)</option>
              <option value="l_tr">L, TR</option>
              <option value="lt_r">LT, R</option>
              <option value="l_ltr">L, LTR</option>
              <option value="ltr_r">LTR, R</option>
            </select>
            <p class="param-hint">Applies to two-lane entries only.</p>
          </div>

          <div class="param-field">
            <label for="PED_{leg.key}_input">Conflicting Pedestrians</label>
            <div class="cell-field">
              <input id="PED_{leg.key}_input" type="number" min="0" class="input input-bordered input-sm" bind:value={entries[leg.key].nped} placeholder="0" required />
              <span class="unit">p/h</span>
            </div>
          </div>
        </div>
      </section>
    {/each}

    <!-- Traffic -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Traffic</h2>
          <p class="panel-sub">Peaking characteristics shared by all entries.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="0.94" />
          </div>
          <p class="param-hint">Leave blank if the demand values are already peak 15-min flow rates.</p>
        </div>

        <div class="param-field">
          <label for="TP_input">Analysis Period</label>
          <div class="cell-field">
            <input id="TP_input" type="number" step="0.05" min="0.05" max="1" class="input input-bordered input-sm" bind:value={analysis_period} placeholder="0.25" required />
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
            <th>Entry Lane</th>
            <th>Flow Rate (veh/h)</th>
            <th>Capacity (veh/h)</th>
            <th>v/c</th>
            <th>Delay (s/veh)</th>
            <th>LOS</th>
            <th>95% Queue (veh)</th>
          </tr>
        </thead>
        <tbody>
          {#if results}
            {#each results.laneRows as l}
              <tr>
                <td>{l.entry} {l.label}</td>
                <td>{fmt(l.flow_veh, 0)}</td>
                <td>{fmt(l.capacity_veh, 0)}</td>
                <td>{fmt(l.v_c_ratio, 2)}</td>
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
                <th>{a.label} Approach Delay (s/veh), LOS:</th>
                <td>{fmt(a.delay)} {a.los ? `(${a.los})` : ''}</td>
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
        <p>Intersection LOS: {results ? (results.intersectionLos ?? '') : ''}</p>
      </div>
    </div>
  </section>
</div>
