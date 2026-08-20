<script>
  import { WasmPedestrianCrossing } from 'HCM-middleware';
  import PedCrossingDiagram from '$lib/PedCrossingDiagram.svelte';
  import LosBadge from '$lib/LosBadge.svelte';
  import Discussion from '$lib/Discussion.svelte';
  import { setReport } from '$lib/report';
  import { discussion } from '$lib/PedestrianCrossingMode.discussion.js';

  let { ready = false } = $props();

  // HCM Chapter 32, TWSC Example Problem 2. The three scenarios share a four-lane major street
  // at 1,700 veh/h with a K-factor of 0.08, a 4.0 ft/s walking speed, and 1.0 s of start-up and
  // end clearance. They differ only in staging, countermeasures, and motorist yield rate, which
  // is what makes the example a countermeasure progression rather than three separate problems.
  const SCENARIOS = {
    A: {
      label: 'A · Unmarked, one stage, no yielding',
      note: 'A 46-ft crossing of all four lanes at once, no marking, and a 0% motorist yield rate. Published d_p = 761 s, LOS F.',
      stages: [{ crossing_length_ft: 46, conflicting_flow_veh_h: 1700, through_lanes: 4 }],
      motorist_yield_rate: 0,
      has_rrfb: false,
      has_marked_crosswalk: false,
      has_median_refuge: false,
    },
    B: {
      label: 'B · Marked crosswalk and median refuge',
      note: 'The same street crossed in two stages of 20 ft and two lanes behind a median refuge, marked, at a 50% yield rate. Published d_p = 6.0 s, LOS C.',
      stages: [
        { crossing_length_ft: 20, conflicting_flow_veh_h: 850, through_lanes: 2 },
        { crossing_length_ft: 20, conflicting_flow_veh_h: 850, through_lanes: 2 },
      ],
      motorist_yield_rate: 0.5,
      has_rrfb: false,
      has_marked_crosswalk: true,
      has_median_refuge: true,
    },
    C: {
      label: 'C · Scenario B plus RRFBs',
      note: 'Scenario B with rectangular rapid-flashing beacons, which raise the observed yield rate to 80%. Published d_p = 3.0 s, LOS A.',
      stages: [
        { crossing_length_ft: 20, conflicting_flow_veh_h: 850, through_lanes: 2 },
        { crossing_length_ft: 20, conflicting_flow_veh_h: 850, through_lanes: 2 },
      ],
      motorist_yield_rate: 0.8,
      has_rrfb: true,
      has_marked_crosswalk: true,
      has_median_refuge: true,
    },
  };

  // Facts every scenario shares, kept out of the scenario table so switching scenarios changes
  // only what the example changes.
  const COMMON = {
    walk_speed_fps: 4.0,
    startup_clearance_s: 1.0,
    pedestrian_platooning: false,
    crosswalk_width_ft: 10,
    pedestrian_flow_p_h: 0,
    peak_hour_volume_veh_h: 1700,
    k_factor: 0.08,
    aadt_mode: 'k_factor',
    aadt_veh: 21250,
  };

  const fromScenario = (key) => ({
    ...COMMON,
    ...structuredClone(SCENARIOS[key]),
    // Percent at the input, decimal in the schema. Exhibit 20-28 gives observed yield rates by
    // treatment as percentages, which is how a practitioner reads them off.
    yield_pct: SCENARIOS[key].motorist_yield_rate * 100,
  });

  let scenario = $state('B');
  let p = $state(fromScenario('B'));

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  function applyScenario(key) {
    scenario = key;
    p = fromScenario(key);
    results = null;
    hasError = false;
  }

  function addStage() {
    p.stages = [...p.stages, { crossing_length_ft: 20, conflicting_flow_veh_h: 850, through_lanes: 2 }];
    results = null;
  }

  function removeStage(i) {
    if (p.stages.length <= 1) return;
    p.stages = p.stages.filter((_, j) => j !== i);
    results = null;
  }

  function fmt(v, digits = 1) {
    return v === null || v === undefined ? '' : Number(v).toFixed(digits);
  }

  // The config sent to the binding, in the serde schema of the library's PedestrianCrossing.
  // AADT is either given directly or estimated from the peak hour volume and the K-factor, and
  // the schema treats a present aadt_veh as the override, so the unused branch is dropped here
  // rather than sent alongside.
  let config = $derived({
    stages: p.stages.map((s) => ({
      crossing_length_ft: Number(s.crossing_length_ft),
      conflicting_flow_veh_h: Number(s.conflicting_flow_veh_h),
      through_lanes: Math.round(Number(s.through_lanes)),
    })),
    walk_speed_fps: Number(p.walk_speed_fps),
    startup_clearance_s: Number(p.startup_clearance_s),
    motorist_yield_rate: Number(p.yield_pct) / 100,
    pedestrian_platooning: p.pedestrian_platooning,
    crosswalk_width_ft: Number(p.crosswalk_width_ft),
    pedestrian_flow_p_h: Number(p.pedestrian_flow_p_h),
    peak_hour_volume_veh_h: Number(p.peak_hour_volume_veh_h),
    k_factor: Number(p.k_factor),
    ...(p.aadt_mode === 'direct' ? { aadt_veh: Number(p.aadt_veh) } : {}),
    has_rrfb: p.has_rrfb,
    has_marked_crosswalk: p.has_marked_crosswalk,
    has_median_refuge: p.has_median_refuge,
  });

  let aadtUsed = $derived(
    p.aadt_mode === 'direct'
      ? Number(p.aadt_veh)
      : Number(p.k_factor) > 0
        ? Number(p.peak_hour_volume_veh_h) / Number(p.k_factor)
        : 0,
  );

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const crossing = new WasmPedestrianCrossing(config);
      const r = crossing.results_to_js_value();

      // The stage count is read back rather than assumed. A dropped stage is a valid crossing,
      // so it produces a plausible answer at half the delay instead of an error.
      results = { ...r, stageCount: crossing.get_stage_count() };
      // Generated once, off the run that produced these numbers, and carried on the result so the
      // page and the printable report can never drift apart or restate a since-edited input.
      results.discussion = discussion(results, {
        yieldPct: Number(p.yield_pct),
        countermeasures:
          [
            config.has_marked_crosswalk ? 'a marked crosswalk' : null,
            config.has_median_refuge ? 'a median refuge' : null,
            config.has_rrfb ? 'RRFBs' : null,
          ]
            .filter(Boolean)
            .join(' and ') || 'no countermeasures',
      });

      setReport({
        chapter: 'Pedestrian Crossing at a Two-Way STOP-Controlled Intersection',
        chapterRef: 'HCM Chapter 20, Section 5',
        href: '/hcm20',
        generatedAt: new Date().toLocaleString(),
        headline: { label: 'Pedestrian LOS', value: r.los },
        discussion: results.discussion,
        inputs: [
          {
            label: 'Crossing stages',
            value: `${results.stageCount}${results.stageCount > 1 ? ' (median refuge)' : ' (no refuge)'}`,
          },
          ...config.stages.map((s, i) => ({
            label: `Stage ${i + 1} length / lanes / conflicting flow`,
            value: `${s.crossing_length_ft} ft / ${s.through_lanes} / ${s.conflicting_flow_veh_h} veh/h`,
          })),
          { label: 'Walking speed', value: `${fmt(config.walk_speed_fps)} ft/s` },
          { label: 'Start-up and end clearance', value: `${fmt(config.startup_clearance_s)} s` },
          { label: 'Motorist yield rate', value: `${fmt(p.yield_pct)} %` },
          {
            label: 'Pedestrian platooning',
            value: config.pedestrian_platooning
              ? `yes, ${config.crosswalk_width_ft} ft crosswalk at ${config.pedestrian_flow_p_h} p/h`
              : 'no',
          },
          {
            label: 'AADT of the crossed street',
            value:
              p.aadt_mode === 'direct'
                ? `${fmt(aadtUsed, 0)} veh/day (entered)`
                : `${fmt(aadtUsed, 0)} veh/day (from ${config.peak_hour_volume_veh_h} veh/h at K = ${config.k_factor})`,
          },
          {
            label: 'Countermeasures',
            value:
              [
                config.has_marked_crosswalk ? 'marked crosswalk' : null,
                config.has_median_refuge ? 'median refuge' : null,
                config.has_rrfb ? 'RRFB' : null,
              ]
                .filter(Boolean)
                .join(', ') || 'none',
          },
        ],
        resultTable: {
          columns: [
            'Stage',
            't_c (s)',
            't_c,G (s)',
            'P_b',
            'P_d',
            'd_g (s)',
            'd_gd (s)',
            'h (s)',
            'n',
            'P(Y_1)',
            'Delay (s)',
          ],
          rows: r.stages.map((s, i) => [
            String(i + 1),
            fmt(s.critical_headway),
            fmt(s.group_critical_headway),
            fmt(s.prob_blocked_lane, 3),
            fmt(s.prob_delayed_crossing, 3),
            fmt(s.gap_delay),
            fmt(s.gap_delay_when_delayed),
            fmt(s.average_short_headway),
            String(s.yield_events),
            fmt(s.prob_yield[1] ?? 0, 3),
            fmt(s.delay),
          ]),
        },
        summary: [
          { label: 'Average pedestrian delay (Equation 20-94)', value: `${fmt(r.delay)} s` },
          { label: 'Delay interpretation (Exhibit 20-29)', value: r.delay_interpretation },
          {
            label: 'O(S/D) no delay / delay (Equation 20-95)',
            value: `${fmt(r.odds_satisfied_no_delay, 2)} / ${fmt(r.odds_satisfied_delay, 2)}`,
          },
          {
            label: 'P(D) no delay / delay (Equation 20-97)',
            value: `${fmt(r.prob_dissatisfied_no_delay * 100)} % / ${fmt(r.prob_dissatisfied_delay * 100)} %`,
          },
          { label: 'Probability of a non-delayed crossing P_nd (Equation 20-98)', value: fmt(r.prob_non_delayed, 3) },
          { label: 'Average proportion dissatisfied P_D (Equation 20-99)', value: fmt(r.proportion_dissatisfied, 3) },
          { label: 'Pedestrian LOS (Exhibit 20-3)', value: r.los },
        ],
        methodology: [
          'HCM Chapter 20, Section 5 pedestrian mode (Exhibit 20-27, Steps 1 through 7): critical headway (Equations 20-76 through 20-79), blocked-lane and delayed-crossing probabilities (Equations 20-80 and 20-81), gap delay (Equations 20-82 and 20-83), the motorist-yield reduction (Equations 20-84 through 20-93), the delay over all stages (Equation 20-94), and the satisfaction model (Equations 20-95 through 20-99).',
          'LOS comes from the average proportion of pedestrians who would rate the crossing "dissatisfied" or worse (Exhibit 20-3), not from delay. The Exhibit 20-29 delay interpretation above is commentary on the delay and does not set the letter.',
          'This is a different procedure from the Chapter 20 Section 4 pedestrian impedance on the vehicular page, where pedestrian volumes reduce vehicular movement capacity and the answer is a vehicle delay.',
          'The Equation 20-95 coefficients on the median-refuge and non-yielding indicators are clipped out of the HCM 7th Edition text by its typesetting. The library recovers them by fitting the six published O(S/D) values of Chapter 32 Example Problem 2, which over-determine the two unknowns, so results that depend on those two terms carry that provenance.',
        ],
        diagram: {
          kind: 'ped-crossing',
          props: { stages: config.stages, walkSpeed: config.walk_speed_fps, los: r.los, totalDelay: r.delay },
        },
      });
    } catch (err) {
      console.error('Chapter 20 pedestrian analysis failed:', err);
      hasError = true;
      errMessage = String(err?.message ?? err);
    }
  }
</script>

{#if hasError}
  <div class="alert alert-error shadow-sm mb-6">
    <span>{errMessage}</span>
  </div>
{/if}

<form
  id="hcm20ped"
  inert={!ready}
  onsubmit={(e) => {
    e.preventDefault();
    runAnalysis();
  }}
>
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Scenario</h2>
        <p class="panel-sub">
          The three scenarios of HCM Chapter 32, TWSC Example Problem 2, which evaluate the same four-lane crossing
          under progressively stronger countermeasures. Selecting one loads its published inputs; every field below
          stays editable.
        </p>
      </div>
    </div>
    <div class="param-grid">
      <div class="param-field">
        <label for="PEDSCEN_input">Example Problem 2 Scenario</label>
        <select
          id="PEDSCEN_input"
          class="select select-bordered select-sm"
          value={scenario}
          onchange={(e) => applyScenario(e.target.value)}
        >
          {#each Object.entries(SCENARIOS) as [key, s]}
            <option value={key}>{s.label}</option>
          {/each}
        </select>
        <p class="param-hint">{SCENARIOS[scenario].note}</p>
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Crossing Stages</h2>
        <p class="panel-sub">
          Step 1 of the method. A crossing without a median refuge is one stage spanning the street. A refuge splits it
          into one stage per side, each carrying only the lanes and the conflicting flow of its own side, so a 46-ft
          crossing of four lanes at 1,700 veh/h becomes two 20-ft crossings of two lanes at 850 veh/h.
        </p>
      </div>
    </div>

    {#each p.stages as stage, i}
      <div class="param-grid stage-row" data-testid={`ped-stage-row-${i + 1}`}>
        <div class="param-field">
          <label for={`PEDL${i}_input`}>Stage {i + 1} Crosswalk Length</label>
          <div class="cell-field">
            <input
              id={`PEDL${i}_input`}
              type="number"
              step="0.1"
              min="0"
              class="input input-bordered input-sm"
              bind:value={stage.crossing_length_ft}
              required
            />
            <span class="unit">ft</span>
          </div>
        </div>
        <div class="param-field">
          <label for={`PEDN${i}_input`}>Stage {i + 1} Through Lanes Crossed</label>
          <div class="cell-field">
            <input
              id={`PEDN${i}_input`}
              type="number"
              step="1"
              min="1"
              max="6"
              class="input input-bordered input-sm"
              bind:value={stage.through_lanes}
              required
            />
          </div>
        </div>
        <div class="param-field">
          <label for={`PEDV${i}_input`}>Stage {i + 1} Conflicting Flow</label>
          <div class="cell-field">
            <input
              id={`PEDV${i}_input`}
              type="number"
              step="1"
              min="0"
              class="input input-bordered input-sm"
              bind:value={stage.conflicting_flow_veh_h}
              required
            />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">
            Both directions for a one-stage crossing, the crossed side only for a stage of a two-stage crossing.
          </p>
        </div>
      </div>
      <div class="stage-action">
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          onclick={() => removeStage(i)}
          disabled={p.stages.length <= 1}>Remove stage {i + 1}</button
        >
      </div>
    {/each}

    <div class="param-grid">
      <div class="param-field">
        <button type="button" class="btn btn-outline btn-sm" onclick={addStage}>Add a stage</button>
        <p class="param-hint">
          The HCM works one- and two-stage crossings. More stages are summed by Equation 20-94 the same way but have no
          published example behind them.
        </p>
      </div>
    </div>

    <div class="diagram-block">
      <div class="diagram-head">
        <p class="panel-sub">
          Cross-section along the pedestrian's line of travel, showing the lanes crossed in each stage and the refuge
          between them. The conflicting stream is a flow rate in this method rather than located vehicles, so it is
          shown as a direction and not as traffic.
        </p>
      </div>
      <PedCrossingDiagram
        stages={config.stages}
        walkSpeed={config.walk_speed_fps}
        los={results ? results.los : null}
        totalDelay={results ? results.delay : null}
      />
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Pedestrians</h2>
        <p class="panel-sub">
          Walking speed and start-up time set the critical headway (Equation 20-76). The platoon adjustment of Equations
          20-77 through 20-79 applies only where pedestrians are observed to group.
        </p>
      </div>
    </div>
    <div class="param-grid">
      <div class="param-field">
        <label for="PEDSP_input">Average Walking Speed</label>
        <div class="cell-field">
          <input
            id="PEDSP_input"
            type="number"
            step="0.1"
            min="0.5"
            max="10"
            class="input input-bordered input-sm"
            bind:value={p.walk_speed_fps}
            required
          />
          <span class="unit">ft/s</span>
        </div>
        <p class="param-hint">
          3.5 ft/s is the 15th-percentile design value under Exhibit 20-26. The measured average at uncontrolled
          crossings is 4.7 ft/s, and Example Problem 2 uses 4.0.
        </p>
      </div>

      <div class="param-field">
        <label for="PEDTS_input">Start-Up and End Clearance</label>
        <div class="cell-field">
          <input
            id="PEDTS_input"
            type="number"
            step="0.1"
            min="0"
            max="20"
            class="input input-bordered input-sm"
            bind:value={p.startup_clearance_s}
            required
          />
          <span class="unit">s</span>
        </div>
        <p class="param-hint">3.0 s is the conservative design value; the observed average is 0 s.</p>
      </div>

      <div class="param-field">
        <label for="PEDPL_input">Pedestrian Platooning</label>
        <select id="PEDPL_input" class="select select-bordered select-sm" bind:value={p.pedestrian_platooning}>
          <option value={false}>Not observed</option>
          <option value={true}>Pedestrians cross in groups</option>
        </select>
        <p class="param-hint">
          With no platooning the spatial distribution is one row and Equations 20-77 and 20-78 are skipped.
        </p>
      </div>

      {#if p.pedestrian_platooning}
        <div class="param-field">
          <label for="PEDWC_input">Crosswalk Width</label>
          <div class="cell-field">
            <input
              id="PEDWC_input"
              type="number"
              step="0.5"
              min="1"
              class="input input-bordered input-sm"
              bind:value={p.crosswalk_width_ft}
              required
            />
            <span class="unit">ft</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PEDVP_input">Pedestrian Flow Rate</label>
          <div class="cell-field">
            <input
              id="PEDVP_input"
              type="number"
              step="1"
              min="0"
              class="input input-bordered input-sm"
              bind:value={p.pedestrian_flow_p_h}
              required
            />
            <span class="unit">p/h</span>
          </div>
        </div>
      {/if}
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Motorists and Countermeasures</h2>
        <p class="panel-sub">
          The yield rate drives Step 5, and the three indicators together with the AADT drive the Step 7 satisfaction
          model (Equation 20-95).
        </p>
      </div>
    </div>
    <div class="param-grid">
      <div class="param-field">
        <label for="PEDMY_input">Motorist Yield Rate</label>
        <div class="cell-field">
          <input
            id="PEDMY_input"
            type="number"
            step="1"
            min="0"
            max="100"
            class="input input-bordered input-sm"
            bind:value={p.yield_pct}
            required
          />
          <span class="unit">%</span>
        </div>
        <p class="param-hint">
          Exhibit 20-28 gives observed rates by crossing treatment. A 100% rate is entered as 99.99% by the engine,
          because the yield recursion is undefined at exactly 100%.
        </p>
      </div>

      <div class="param-field">
        <label for="PEDMC_input">Marked Crosswalk (I_MC)</label>
        <select id="PEDMC_input" class="select select-bordered select-sm" bind:value={p.has_marked_crosswalk}>
          <option value={false}>No</option>
          <option value={true}>Yes</option>
        </select>
      </div>

      <div class="param-field">
        <label for="PEDMR_input">Median Refuge (I_MR)</label>
        <select id="PEDMR_input" class="select select-bordered select-sm" bind:value={p.has_median_refuge}>
          <option value={false}>No</option>
          <option value={true}>Yes</option>
        </select>
        <p class="param-hint">
          This is the Equation 20-95 indicator. It is a separate input from the staging above, which is where the refuge
          changes the delay calculation.
        </p>
      </div>

      <div class="param-field">
        <label for="PEDRRFB_input">Rapid-Flashing Beacon (I_RRFB)</label>
        <select id="PEDRRFB_input" class="select select-bordered select-sm" bind:value={p.has_rrfb}>
          <option value={false}>No</option>
          <option value={true}>Yes</option>
        </select>
      </div>

      <div class="param-field">
        <label for="PEDAADTM_input">AADT Source</label>
        <select id="PEDAADTM_input" class="select select-bordered select-sm" bind:value={p.aadt_mode}>
          <option value="k_factor">Estimate from the peak hour volume and K</option>
          <option value="direct">Enter the AADT directly</option>
        </select>
      </div>

      {#if p.aadt_mode === 'direct'}
        <div class="param-field">
          <label for="PEDAADT_input">AADT of the Crossed Street</label>
          <div class="cell-field">
            <input
              id="PEDAADT_input"
              type="number"
              step="100"
              min="0"
              class="input input-bordered input-sm"
              bind:value={p.aadt_veh}
              required
            />
            <span class="unit">veh/day</span>
          </div>
        </div>
      {:else}
        <div class="param-field">
          <label for="PEDPHV_input">Peak Hour Volume, Both Directions</label>
          <div class="cell-field">
            <input
              id="PEDPHV_input"
              type="number"
              step="1"
              min="0"
              class="input input-bordered input-sm"
              bind:value={p.peak_hour_volume_veh_h}
              required
            />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PEDK_input">K-Factor</label>
          <div class="cell-field">
            <input
              id="PEDK_input"
              type="number"
              step="0.01"
              min="0.01"
              max="1"
              class="input input-bordered input-sm"
              bind:value={p.k_factor}
              required
            />
          </div>
          <p class="param-hint" data-testid="ped-aadt-used">Gives {fmt(aadtUsed, 0)} veh/day for Equation 20-95.</p>
        </div>
      {/if}
    </div>
  </section>

  <div class="action-bar">
    <button class="btn btn-ghost" onclick={() => applyScenario(scenario)} type="button"
      >Reset to Scenario {scenario}</button
    >
    <button class="btn btn-primary" type="submit" disabled={!ready}>Calculate</button>
  </div>
</form>

<section class="panel results-panel">
  <div class="panel-head with-actions">
    <div>
      <h2 class="panel-title">Outputs</h2>
      <p class="panel-sub">Results populate after pressing Calculate.</p>
    </div>
    {#if results}
      <div class="panel-actions">
        <a class="btn btn-outline btn-sm" href="/report">Open printable report</a>
      </div>
    {/if}
  </div>

  <div class="los overflow-x-auto">
    <table class="table w-full">
      <thead>
        <tr>
          <th>Stage</th>
          <th>t_c (s)</th>
          <th>N_p (rows)</th>
          <th>t_c,G (s)</th>
          <th>P_b</th>
          <th>P_d</th>
          <th>d_g (s)</th>
          <th>d_gd (s)</th>
          <th>h (s)</th>
          <th>n</th>
          <th>Delay (s)</th>
        </tr>
      </thead>
      <tbody>
        {#if results}
          {#each results.stages as s, i}
            <tr data-testid={`ped-result-stage-${i + 1}`}>
              <td>{i + 1}</td>
              <td>{fmt(s.critical_headway)}</td>
              <td>{fmt(s.spatial_distribution, 2)}</td>
              <td>{fmt(s.group_critical_headway)}</td>
              <td>{fmt(s.prob_blocked_lane, 3)}</td>
              <td>{fmt(s.prob_delayed_crossing, 3)}</td>
              <td>{fmt(s.gap_delay)}</td>
              <td>{fmt(s.gap_delay_when_delayed)}</td>
              <td>{fmt(s.average_short_headway)}</td>
              <td>{s.yield_events}</td>
              <td>{fmt(s.delay)}</td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>

    {#if results}
      <div class="yield-chain">
        <h3 class="subhead">Yield chain, per stage (Equations 20-86 through 20-93)</h3>
        <p class="panel-sub">
          Probability that every blocking vehicle yields on potential yielding event i. P(Y_0) is zero by definition,
          because there is nothing to yield to before the first event.
        </p>
        <table class="table w-full">
          <tbody>
            {#each results.stages as s, i}
              <tr data-testid={`ped-yield-stage-${i + 1}`}>
                <th>Stage {i + 1}</th>
                <td>{s.prob_yield.map((v, j) => `P(Y_${j}) ${fmt(v, 3)}`).join('  ·  ')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <table class="table w-full">
      <tbody>
        <tr>
          <th>Average Pedestrian Delay d_p (s), Equation 20-94:</th>
          <td data-testid="ped-total-delay">{results ? fmt(results.delay) : ''}</td>
        </tr>
        <tr>
          <th>Delay Interpretation (Exhibit 20-29):</th>
          <td data-testid="ped-delay-interpretation">{results ? results.delay_interpretation : ''}</td>
        </tr>
        <tr>
          <th>O(S/D), No Delay / Delay (Equation 20-95):</th>
          <td
            >{results ? `${fmt(results.odds_satisfied_no_delay, 2)} / ${fmt(results.odds_satisfied_delay, 2)}` : ''}</td
          >
        </tr>
        <tr>
          <th>P(Dissatisfied), No Delay / Delay (Equation 20-97):</th>
          <td
            >{results
              ? `${fmt(results.prob_dissatisfied_no_delay * 100)} % / ${fmt(results.prob_dissatisfied_delay * 100)} %`
              : ''}</td
          >
        </tr>
        <tr>
          <th>Non-Delayed Crossing P_nd (Equation 20-98):</th>
          <td data-testid="ped-p-nd">{results ? fmt(results.prob_non_delayed, 3) : ''}</td>
        </tr>
        <tr>
          <th>Average Proportion Dissatisfied P_D (Equation 20-99):</th>
          <td data-testid="ped-p-d">{results ? fmt(results.proportion_dissatisfied, 3) : ''}</td>
        </tr>
      </tbody>
    </table>
  </div>

  {#if results}
    <div class="facility-summary">
      <div class="ped-los" data-testid="ped-los">
        <LosBadge los={results.los} size="lg" />
        <p>
          Pedestrian LOS comes from the average proportion of pedestrians who would rate the crossing "dissatisfied" or
          worse (Exhibit 20-3), not from the delay. The bands are A below 0.05, B below 0.15, C below 0.25, D below
          0.33, E below 0.50, and F at or above 0.50. This crossing sits at {fmt(results.proportion_dissatisfied, 3)}.
        </p>
      </div>
      <p>
        The Equation 20-95 coefficients on the median-refuge and non-yielding indicators are clipped out of the HCM 7th
        Edition text by its typesetting and do not appear in the Chapter 20 prose. The engine recovers them by fitting
        the six published O(S/D) values of this example problem, which over-determine the two unknowns, so the
        satisfaction rows above carry that provenance rather than a published coefficient.
      </p>
      {#if results.stageCount > 1}
        <p>
          On a two-stage crossing the HCM does not say which stage's P_d and P(Y_1) feed Equations 20-98 and 20-99. The
          engine uses the first stage, which reproduces the published P_nd of 0.481 for Scenario B. Example Problem 2
          cannot settle the question, because its two stages are identical by construction.
        </p>
      {/if}
    </div>

    <Discussion sentences={results.discussion} />
  {/if}
</section>

<style>
  .stage-row {
    align-items: start;
  }
  .stage-action {
    display: flex;
    justify-content: flex-end;
    margin: -0.25rem 0 0.75rem;
  }
  .subhead {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 1rem 0 0.25rem;
  }
  .ped-los {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }
  .ped-los p {
    margin: 0;
  }
</style>
