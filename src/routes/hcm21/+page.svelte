<svelte:head>
  <title>HCM Calculator — All-Way STOP-Controlled Intersections</title>
</svelte:head>

<script>
  import init, { WasmAwsc } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  const dirs = [
    { key: 'eb', label: 'Eastbound (EB)' },
    { key: 'wb', label: 'Westbound (WB)' },
    { key: 'nb', label: 'Northbound (NB)' },
    { key: 'sb', label: 'Southbound (SB)' }
  ];

  // Defaults follow HCM Chapter 32 AWSC Example Problem 1, a single-lane
  // three-leg intersection with the minor stem on the north leg (no NB
  // approach).
  function defaultApproaches() {
    return {
      eb: { laneCount: 1, lanes: [{ left: 50, through: 300, right: 0 }], hv: 2 },
      wb: { laneCount: 1, lanes: [{ left: 0, through: 300, right: 100 }], hv: 2 },
      nb: { laneCount: 0, lanes: [], hv: 0 },
      sb: { laneCount: 1, lanes: [{ left: 100, through: 0, right: 50 }], hv: 2 }
    };
  }

  let approaches = defaultApproaches();
  let phf = 0.95;
  let analysis_period = 0.25;

  let results = null;
  let hasError = false;
  let errMessage = '';

  function setLaneCount(key, n) {
    const a = approaches[key];
    const lanes = a.lanes.slice(0, n);
    while (lanes.length < n) lanes.push({ left: 0, through: 0, right: 0 });
    approaches = { ...approaches, [key]: { ...a, laneCount: n, lanes } };
  }

  function fmt(v, digits = 1) {
    return v === null || v === undefined ? '' : Number(v).toFixed(digits);
  }

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const flat = (key) => approaches[key].lanes.flatMap((l) => [Number(l.left), Number(l.through), Number(l.right)]);

      const a = new WasmAwsc(
        new Float64Array(flat('eb')),
        new Float64Array(flat('wb')),
        new Float64Array(flat('nb')),
        new Float64Array(flat('sb')),
        Number(approaches.eb.hv),
        Number(approaches.wb.hv),
        Number(approaches.nb.hv),
        Number(approaches.sb.hv),
        phf === '' || phf === null ? undefined : Number(phf),
        Number(analysis_period)
      );

      a.analyze();
      const res = a.results_to_js_value();

      const laneRows = [];
      const approachRows = [];
      for (const d of dirs) {
        const ap = res[d.key];
        ap.lanes.forEach((l, i) => {
          laneRows.push({ approach: d.key.toUpperCase(), lane: i + 1, ...l });
        });
        if (ap.lanes.length > 0) {
          approachRows.push({ label: d.key.toUpperCase(), delay: ap.control_delay, los: ap.los });
        }
      }

      results = {
        laneRows,
        approachRows,
        intersectionDelay: res.intersection_delay,
        intersectionLos: res.intersection_los,
        iterations: res.iterations
      };
    } catch (err) {
      console.error('Chapter 21 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    approaches = defaultApproaches();
    phf = 0.95;
    analysis_period = 0.25;
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">All-Way STOP-Controlled Intersections <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — All-Way STOP-Controlled Intersections</h1>
    <p class="page-sub">
      Estimate departure headways, control delay, queues, and level of service
      for each lane and approach at an all-way STOP-controlled intersection.
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

  <form id="hcm21" on:submit|preventDefault={runAnalysis}>
    {#each dirs as d}
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">{d.label} Approach</h2>
            <p class="panel-sub">Lanes in left-to-right order with the demand volume assigned to each. Set lanes to 0 for a leg with no approach.</p>
          </div>
        </div>
        <div class="param-grid">
          <div class="param-field">
            <label for="LC_{d.key}_input">Lanes</label>
            <select id="LC_{d.key}_input" class="select select-bordered select-sm" value={approaches[d.key].laneCount} on:change={(e) => setLaneCount(d.key, Number(e.target.value))}>
              <option value={0}>0 (no approach)</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>

          <div class="param-field">
            <label for="HV_{d.key}_input">Heavy Vehicles</label>
            <div class="cell-field">
              <input id="HV_{d.key}_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={approaches[d.key].hv} placeholder="2" required />
              <span class="unit">%</span>
            </div>
          </div>

          {#each approaches[d.key].lanes as lane, i}
            <div class="param-field">
              <label for="L_{d.key}_{i}_input">Lane {i + 1} Left</label>
              <div class="cell-field">
                <input id="L_{d.key}_{i}_input" type="number" min="0" class="input input-bordered input-sm" bind:value={lane.left} required />
                <span class="unit">veh/h</span>
              </div>
            </div>
            <div class="param-field">
              <label for="T_{d.key}_{i}_input">Lane {i + 1} Through</label>
              <div class="cell-field">
                <input id="T_{d.key}_{i}_input" type="number" min="0" class="input input-bordered input-sm" bind:value={lane.through} required />
                <span class="unit">veh/h</span>
              </div>
            </div>
            <div class="param-field">
              <label for="R_{d.key}_{i}_input">Lane {i + 1} Right</label>
              <div class="cell-field">
                <input id="R_{d.key}_{i}_input" type="number" min="0" class="input input-bordered input-sm" bind:value={lane.right} required />
                <span class="unit">veh/h</span>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}

    <!-- Traffic -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Traffic</h2>
          <p class="panel-sub">Peaking characteristics shared by all approaches.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="0.95" />
          </div>
          <p class="param-hint">Leave blank if the lane volumes are already peak 15-min flow rates.</p>
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
            <th>Lane</th>
            <th>Flow Rate (veh/h)</th>
            <th>Departure Headway (s)</th>
            <th>Utilization x</th>
            <th>Delay (s/veh)</th>
            <th>LOS</th>
            <th>95% Queue (veh)</th>
          </tr>
        </thead>
        <tbody>
          {#if results}
            {#each results.laneRows as l}
              <tr>
                <td>{l.approach} lane {l.lane}</td>
                <td>{fmt(l.flow_rate, 0)}</td>
                <td>{fmt(l.departure_headway, 2)}</td>
                <td>{fmt(l.degree_of_utilization, 3)}</td>
                <td>{fmt(l.control_delay)}</td>
                <td>{l.los ?? ''}</td>
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
