<svelte:head>
  <title>Two-Way STOP-Controlled Intersections · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmTwsc } from "HCM-middleware";
  import TwscDiagram from '$lib/TwscDiagram.svelte';
  import TwscDiagram3D from '$lib/TwscDiagram3D.svelte';
  import PedestrianCrossingMode from '$lib/PedestrianCrossingMode.svelte';
  import ViewToggle from '$lib/ViewToggle.svelte';
  import { setReport } from '$lib/report';
  import { discussion } from './discussion.js';
  import Discussion from '$lib/Discussion.svelte';
  import { onMount } from "svelte";

  let diagramMode = $state('2d');

  // Which Chapter 20 mode the page analyzes. The vehicular mode is Section 4, where the answer
  // is a vehicle delay per movement and lane. The pedestrian mode is Section 5, a separate
  // procedure whose subject is the pedestrian and whose LOS comes from a satisfaction model.
  let mode = $state('vehicular');

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Inputs (defaults follow HCM Chapter 32 TWSC Example Problem 1, a
  // three-leg intersection with the minor stem northbound)
  let intersection_type = $state('three_leg');
  let major_lanes = $state(1);
  let rt_eb = $state('shared');
  let rt_wb = $state('shared');
  let minor_nb = $state('single_shared');
  let minor_sb = $state('single_shared');
  let grade_nb = $state(0);
  let grade_sb = $state(0);

  let v1 = $state(0), v1u = $state(0), v2 = $state(240), v3 = $state(40);
  let v4 = $state(160), v4u = $state(0), v5 = $state(300), v6 = $state(0);
  let v7 = $state(40), v8 = $state(0), v9 = $state(120);
  let v10 = $state(0), v11 = $state(0), v12 = $state(0);

  let phf = $state('');
  let phv = $state(10);
  let analysis_period = $state(0.25);

  const movementNames = {
    '1': 'Major EB left', '1U': 'Major EB U-turn',
    '4': 'Major WB left', '4U': 'Major WB U-turn',
    '7': 'Minor NB left', '8': 'Minor NB through', '9': 'Minor NB right',
    '10': 'Minor SB left', '11': 'Minor SB through', '12': 'Minor SB right'
  };

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  // Worst minor-lane LOS per approach, for the diagram's animation.
  let losByApproach = $derived(results
    ? results.laneRows.reduce((m, l) => {
        if (l.los && (!m[l.approach] || l.los > m[l.approach])) m[l.approach] = l.los;
        return m;
      }, {})
    : {});

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
      // Generated once, off the run that produced these numbers, and carried on the result so the
      // page and the printable report can never drift apart or restate a since-edited input.
      results.discussion = discussion(results, { threeLeg: intersection_type === 'three_leg' });

      // Worst minor-approach lane sets the headline, since the HCM assigns
      // TWSC LOS by lane/movement rather than for the whole intersection.
      const worst = results.laneRows.reduce((w, l) => (l.los > w ? l.los : w), 'A');
      setReport({
        chapter: 'Two-Way STOP-Controlled Intersections',
        chapterRef: 'HCM Chapter 20',
        href: '/hcm20',
        generatedAt: new Date().toLocaleString(),
        headline: { label: 'Worst minor-lane LOS', value: worst },
        discussion: results.discussion,
        inputs: [
          { label: 'Intersection type', value: intersection_type === 'three_leg' ? 'Three-leg (T), minor stem northbound' : 'Four-leg' },
          { label: 'Major lanes per direction', value: major_lanes },
          { label: 'Major right turns (EB / WB)', value: `${rt_eb} / ${rt_wb}` },
          { label: 'Minor lanes (NB)', value: minor_nb.replace(/_/g, ' ') },
          ...(intersection_type === 'three_leg' ? [] : [{ label: 'Minor lanes (SB)', value: minor_sb.replace(/_/g, ' ') }]),
          { label: 'Minor approach grades (NB / SB)', value: `${grade_nb} / ${grade_sb} %` },
          { label: 'Major EB volumes L/T/R', value: `${v1} / ${v2} / ${v3} veh/h` },
          { label: 'Major WB volumes L/T/R', value: `${v4} / ${v5} / ${v6} veh/h` },
          { label: 'Minor NB volumes L/T/R', value: `${v7} / ${v8} / ${v9} veh/h` },
          ...(intersection_type === 'three_leg' ? [] : [{ label: 'Minor SB volumes L/T/R', value: `${v10} / ${v11} / ${v12} veh/h` }]),
          { label: 'Peak hour factor', value: phf === '' ? 'volumes are flow rates' : phf },
          { label: 'Heavy vehicles', value: `${phv} %` },
        ],
        resultTable: {
          columns: ['Movement or lane', 'Capacity (veh/h)', 'v/c', 'Delay (s/veh)', 'LOS', '95% queue (veh)'],
          rows: [
            ...results.movementRows.map((m) => [m.name, fmt(m.movement_capacity, 0), fmt(m.vc_ratio, 2), fmt(m.control_delay), m.los ?? '', fmt(m.queue_95)]),
            ...results.laneRows.map((l) => [`${l.approach} minor lane ${l.lane}`, fmt(l.capacity, 0), fmt(l.vc_ratio, 2), fmt(l.control_delay), l.los ?? '', fmt(l.queue_95)]),
          ],
        },
        summary: [
          ...results.approachRows.filter((a) => a.delay != null).map((a) => ({ label: `Approach delay, ${a.label}`, value: `${fmt(a.delay)} s/veh` })),
          { label: 'Intersection delay (Equation 20-65)', value: `${fmt(results.intersectionDelay)} s/veh` },
        ],
        methodology: [
          'HCM Chapter 20 gap-acceptance methodology: conflicting flows per movement rank (Exhibits 20-4 through 20-8), potential and movement capacities (Equations 20-32 through 20-47), shared-lane capacity, delay (Equation 20-61), and LOS (Exhibit 20-2).',
          'Applies the December 2022 HCM corrections, including the corrected Stage II conflicting movements and the Exhibit 20-14 swap.',
          'The HCM defines TWSC LOS per movement and minor lane. Major through movements are unimpeded and carry no delay or LOS.',
        ],
        diagram: { kind: 'twsc', props: { threeLeg: intersection_type === 'three_leg', majorLanes: major_lanes, rtEB: rt_eb, rtWB: rt_wb, minorNB: minor_nb, minorSB: minor_sb, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12 } },
      });
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
    <span class="badge badge-outline page-badge">HCM Chapter 20</span>
    <h1 class="page-title">Two-Way STOP-Controlled Intersections</h1>
    <p class="page-sub">
      Estimate movement capacities, control delay, queues, and level of service
      for the controlled movements at a two-way STOP-controlled intersection,
      or evaluate a pedestrian crossing the major street.
    </p>
  </header>

  <div class="alert alert-info shadow-sm mb-6 beta-note" role="note">
    <span>
      The compute engine reproduces the published HCM worked examples for this
      chapter and applies the December 2022 HCM corrections, including the
      corrected Stage II conflicting movements and the Exhibit 20-14 swap. The
      pedestrian mode reproduces all three scenarios of Chapter 32 Example
      Problem 2, with the caveat noted there that two coefficients of Equation
      20-95 are clipped out of the published text and were recovered by fitting
      that example.
      Verify results independently before relying on them in engineering work,
      and please <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Analysis Mode</h2>
        <p class="panel-sub">Section 4 evaluates the vehicular movements at the intersection. Section 5 evaluates a pedestrian crossing the uncontrolled major-street traffic stream, which is a separate procedure with its own service measure. The same Section 5 method applies to a midblock crossing.</p>
      </div>
    </div>
    <div class="param-grid">
      <div class="param-field">
        <label for="MODE_input">Chapter 20 Mode</label>
        <select id="MODE_input" class="select select-bordered select-sm" bind:value={mode}>
          <option value="vehicular">Vehicular TWSC · Section 4</option>
          <option value="pedestrian">Pedestrian crossing · Section 5</option>
        </select>
      </div>
    </div>
  </section>

  {#if mode === 'pedestrian'}
    <PedestrianCrossingMode {ready} />
  {:else}

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm20" onsubmit={preventDefault(runAnalysis)} inert={!ready}>
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

      <div class="diagram-block">
        <div class="diagram-head">
          <p class="panel-sub">Hover the legend to highlight an approach. The dash pattern shows each movement's HCM rank, and in the 2D view the movement volumes can be edited directly on the diagram.</p>
          <ViewToggle bind:mode={diagramMode} label="Intersection view mode" />
        </div>
        {#if diagramMode === '3d'}
          <TwscDiagram3D
            threeLeg={intersection_type === 'three_leg'}
            majorLanes={major_lanes}
            rtEB={rt_eb}
            rtWB={rt_wb}
            minorNB={minor_nb}
            minorSB={minor_sb}
          />
        {:else}
          <TwscDiagram
            approachLos={losByApproach}
            threeLeg={intersection_type === 'three_leg'}
            majorLanes={major_lanes}
            rtEB={rt_eb}
            rtWB={rt_wb}
            minorNB={minor_nb}
            minorSB={minor_sb}
            bind:v1 bind:v2 bind:v3 bind:v4 bind:v5 bind:v6
            bind:v7 bind:v8 bind:v9 bind:v10 bind:v11 bind:v12
          />
        {/if}
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
            <input id="PHV_input" type="number" step="0.01" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="10" required />
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
      <button class="btn btn-ghost" onclick={resetParams} type="button">Reset Params</button>
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

    {#if results}
      <Discussion sentences={results.discussion} />
    {/if}
  </section>
  {/if}
</div>
