<svelte:head>
  <title>Ramp Terminals and Alternative Intersections · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmInterchange } from "HCM-middleware";
  import DiamondDiagram from '$lib/DiamondDiagram.svelte';
  import DiamondDiagram3D from '$lib/DiamondDiagram3D.svelte';
  import ViewToggle from '$lib/ViewToggle.svelte';
  import PartCAlternative from '$lib/PartCAlternative.svelte';

  let diagramMode = $state('2d');

  // Which half of Chapter 23 the page analyzes: Part B signalized interchanges
  // or Part C alternative intersections (RCUT, MUT, DLT).
  let part = $state('B');
  import { setReport } from '$lib/report';
  import { onMount } from "svelte";

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Interchange form. Diamond defaults follow HCM Chapter 34 Example
  // Problem 1; switching to the DDI loads Example Problem 5 (Exhibits 34-58
  // through 34-65).
  let form = $state('Diamond');
  let ddi_eb_config = $state('ThreeLaneExclusive');
  let ddi_wb_config = $state('TwoLaneShared');

  let cycle_length = $state(160);
  let phf = $state(0.90);
  let base_sat_flow = $state(1900);
  let area_type = $state('other');
  let distance = $state(500);
  let yellow_all_red = $state(5);
  let phv = $state(6.1);
  let ramp_grade = $state(2);
  let extra_dist = $state(100);
  let design_speed = $state(35);

  const defaultOd = () => ([
    { key: 'a', label: 'A · NB off-ramp left (to WB)', value: 210 },
    { key: 'b', label: 'B · NB off-ramp right (to EB)', value: 204 },
    { key: 'c', label: 'C · SB off-ramp right (to WB)', value: 156 },
    { key: 'd', label: 'D · SB off-ramp left (to EB)', value: 185 },
    { key: 'e', label: 'E · EB left to NB on-ramp', value: 96 },
    { key: 'f', label: 'F · EB right to SB on-ramp', value: 80 },
    { key: 'g', label: 'G · WB right to NB on-ramp', value: 135 },
    { key: 'h', label: 'H · WB left to SB on-ramp', value: 212 },
    { key: 'i', label: 'I · EB arterial through', value: 685 },
    { key: 'j', label: 'J · WB arterial through', value: 585 },
    { key: 'k', label: 'K · NB frontage through', value: 0 },
    { key: 'l', label: 'L · SB frontage through', value: 0 },
    { key: 'm', label: 'M · NB freeway U-turn', value: 0 },
    { key: 'n', label: 'N · SB freeway U-turn', value: 0 }
  ]);

  const defaultLaneGroups = () => ([
    { movement: 'EbExtThrough', label: 'EB external through + right', lanes: 2, begin: 0, green: 63, is_ramp: false, turn_radius: null, shared_right_radius: 50, arrival: 3, storage: 600 },
    { movement: 'EbIntThrough', label: 'EB internal through', lanes: 2, begin: 116, green: 97, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 4, storage: 500 },
    { movement: 'EbIntLeft', label: 'EB internal left (to NB on-ramp)', lanes: 1, begin: 116, green: 29, is_ramp: false, turn_radius: 75, shared_right_radius: null, arrival: 4, storage: 200 },
    { movement: 'WbExtThrough', label: 'WB external through + right', lanes: 2, begin: 150, green: 63, is_ramp: false, turn_radius: null, shared_right_radius: 50, arrival: 4, storage: 600 },
    { movement: 'WbIntThrough', label: 'WB internal through', lanes: 2, begin: 0, green: 111, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 4, storage: 500 },
    { movement: 'WbIntLeft', label: 'WB internal left (to SB on-ramp)', lanes: 1, begin: 68, green: 43, is_ramp: false, turn_radius: 75, shared_right_radius: null, arrival: 4, storage: 200 },
    { movement: 'NbRampLeft', label: 'NB off-ramp left', lanes: 1, begin: 58, green: 53, is_ramp: true, turn_radius: 75, shared_right_radius: null, arrival: 3, storage: 400 },
    { movement: 'NbRampRight', label: 'NB off-ramp right', lanes: 1, begin: 58, green: 53, is_ramp: true, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 400 },
    { movement: 'SbRampLeft', label: 'SB off-ramp left', lanes: 1, begin: 116, green: 39, is_ramp: true, turn_radius: 75, shared_right_radius: null, arrival: 3, storage: 400 },
    { movement: 'SbRampRight', label: 'SB off-ramp right', lanes: 1, begin: 116, green: 39, is_ramp: true, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 400 }
  ]);

  const ddiOd = () => ([
    { key: 'a', label: 'A · NB off-ramp left (to WB)', value: 350 },
    { key: 'b', label: 'B · NB off-ramp right (to EB)', value: 200 },
    { key: 'c', label: 'C · SB off-ramp right (to WB)', value: 200 },
    { key: 'd', label: 'D · SB off-ramp left (to EB)', value: 300 },
    { key: 'e', label: 'E · EB left to NB on-ramp', value: 600 },
    { key: 'f', label: 'F · EB right to SB on-ramp', value: 200 },
    { key: 'g', label: 'G · WB right to NB on-ramp', value: 300 },
    { key: 'h', label: 'H · WB left to SB on-ramp', value: 300 },
    { key: 'i', label: 'I · EB arterial through', value: 700 },
    { key: 'j', label: 'J · WB arterial through', value: 150 },
    { key: 'k', label: 'K · NB frontage through', value: 0 },
    { key: 'l', label: 'L · SB frontage through', value: 0 },
    { key: 'm', label: 'M · NB freeway U-turn', value: 0 },
    { key: 'n', label: 'N · SB freeway U-turn', value: 0 }
  ]);

  // Chapter 34 Example Problem 5 lane groups. hv/grade/overlap/dq are carried
  // per row because the DDI example sets them per lane group.
  const ddiLaneGroups = () => ([
    { movement: 'EbExtThrough', label: 'EB external crossover', lanes: 3, begin: 0, green: 35, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 0, dq: 4, speed: 35 },
    { movement: 'EbIntThrough', label: 'EB internal crossover', lanes: 2, begin: 0, green: 35, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 0, dq: null, speed: 35, lu: 1 },
    { movement: 'WbExtThrough', label: 'WB external crossover', lanes: 2, begin: 35, green: 25, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 0, dq: 4, speed: 35 },
    { movement: 'WbIntThrough', label: 'WB internal crossover', lanes: 2, begin: 35, green: 25, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 0, dq: null, speed: 35, lu: 1 },
    { movement: 'NbRampLeft', label: 'NB off-ramp left', lanes: 1, begin: 35, green: 35, is_ramp: true, turn_radius: 150, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 6.5, dq: 4, speed: 35 },
    { movement: 'NbRampRight', label: 'NB off-ramp right', lanes: 1, begin: 0, green: 25, is_ramp: true, turn_radius: 75, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 4.9, dq: null, speed: 35 },
    { movement: 'SbRampLeft', label: 'SB off-ramp left', lanes: 1, begin: 0, green: 25, is_ramp: true, turn_radius: 150, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 6.5, dq: 4, speed: 35 },
    { movement: 'SbRampRight', label: 'SB off-ramp right', lanes: 1, begin: 35, green: 35, is_ramp: true, turn_radius: 75, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 4.9, dq: null, speed: 35 }
  ]);

  let odDemands = $state(defaultOd());
  let laneGroups = $state(defaultLaneGroups());

  // Switching forms loads that form's published example as the new defaults.
  function applyForm(next) {
    form = next;
    if (form === 'Ddi') {
      odDemands = ddiOd();
      laneGroups = ddiLaneGroups();
      cycle_length = 70;
      phf = 1.0;
      distance = 500;
    } else {
      odDemands = defaultOd();
      laneGroups = defaultLaneGroups();
      cycle_length = 160;
      phf = 0.90;
      distance = 500;
    }
    results = null;
  }

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  // Per-O-D LOS map for the diagram animation.
  let losByOd = $derived(results
    ? Object.fromEntries(results.od_results.filter((o) => o.los).map((o) => [o.movement, o.los]))
    : {});

  function buildConfig() {
    const od = {};
    for (const d of odDemands) {
      od[d.key] = Number(d.value);
    }
    // Extra travel distances per O-D letter A..N (Exhibit 23-8 sign
    // convention: positive for left turns, negative for right turns).
    const dt = Number(extra_dist);
    const signed = form === 'Ddi'
      ? [dt, -dt, -dt, dt, dt, 0, 0, dt, 40, 40, 0, 0, 0, 0]
      : [dt, -dt, -dt, dt, dt, -dt, -dt, dt, 0, 0, 0, 0, 0, 0];

    return {
      form,
      cycle_length_s: Number(cycle_length),
      analysis_period_h: 0.25,
      base_saturation_flow: Number(base_sat_flow),
      area_type_cbd: area_type === 'cbd',
      peak_hour_factor: Number(phf),
      distance_between_intersections_ft: Number(distance),
      queue_spacing_ft: 25.0,
      od,
      eb_external_right_shared: form !== 'Ddi',
      wb_external_right_shared: form !== 'Ddi',
      ddi_eb_lane_config: form === 'Ddi' ? ddi_eb_config : null,
      ddi_wb_lane_config: form === 'Ddi' ? ddi_wb_config : null,
      extra_distances: signed.map((d) => ({ distance_ft: d, accel_decel_s: 0.0 })),
      extra_distance_speed_mph: Number(design_speed),
      lane_groups: laneGroups.map((g) => ({
        movement: g.movement,
        lanes: Number(g.lanes),
        greens: [{ begin_s: Number(g.begin), duration_s: Number(g.green) }],
        yellow_all_red_s: Number(yellow_all_red),
        control: 'Signalized',
        turn_radius_ft: g.turn_radius,
        shared_right_turn_radius_ft: g.shared_right_radius,
        pct_heavy_vehicles: g.hv ?? (g.is_ramp ? 0.0 : Number(phv)),
        grade_pct: g.grade ?? (g.is_ramp ? Number(ramp_grade) : 0.0),
        lane_width_ft: 12.0,
        parking_maneuvers_h: null,
        bus_stops_h: 0.0,
        arrival_type: g.arrival,
        storage_ft: g.storage,
        lane_utilization_override: g.lu ?? null,
        downstream_queue_lost_time_s: g.dq ?? null,
        overlap_lost_time_s: g.overlap ?? 0.0,
        start_up_lost_time_s: 2.0,
        extension_of_green_s: 2.0,
        upstream_filtering_override: null,
        speed_limit_mph: g.speed ?? 40.0,
        initial_queue_veh: 0.0,
        demand_override_veh_h: null
      }))
    };
  }

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const ix = new WasmInterchange(buildConfig());
      ix.analyze();
      results = {
        ett: ix.get_interchange_ett_s(),
        los: ix.get_interchange_los(),
        od_results: ix.od_results_to_js_value()
      };

      setReport({
        chapter: 'Ramp Terminals and Alternative Intersections',
        chapterRef: 'HCM Chapter 23',
        href: '/hcm23',
        generatedAt: new Date().toLocaleString(),
        headline: { label: 'Interchange LOS', value: results.los },
        inputs: [
          { label: 'Interchange form', value: form === 'Ddi' ? 'Diverging diamond (DDI), pretimed signals' : 'Conventional diamond, pretimed signals' },
          { label: 'Cycle length', value: `${cycle_length} s` },
          { label: 'Distance between terminals', value: `${distance} ft` },
          { label: 'Peak hour factor', value: phf },
          { label: 'Heavy vehicles (arterial)', value: `${phv} %` },
          { label: 'Ramp grade', value: `${ramp_grade} %` },
          { label: 'O-D demands (A-N)', value: odDemands.map((d) => `${d.key.toUpperCase()} ${d.value}`).join(', ') + ' veh/h' },
        ],
        resultTable: {
          columns: ['O-D', 'Demand (veh/h)', 'Control delay (s/veh)', 'EDTT (s/veh)', 'ETT (s/veh)', 'LOS'],
          rows: results.od_results.map((o) => [
            o.movement, o.demand.toFixed(0), o.control_delay_s.toFixed(1), o.edtt_s.toFixed(1), o.ett_s.toFixed(1), o.los ?? '',
          ]),
        },
        summary: [
          { label: 'Interchange ETT (demand-weighted)', value: `${results.ett.toFixed(1)} s/veh` },
          { label: 'Interchange LOS (Exhibit 23-10)', value: results.los },
        ],
        methodology: [
          'HCM Chapter 23 Part B interchange methodology: lane-group analysis per Chapter 19 at both ramp terminals, extra distance travel time by O-D (Exhibit 23-8 sign convention), experienced travel time per O-D (Equation 23-1), and interchange LOS from the demand-weighted ETT (Exhibit 23-10).',
        ],
      });
    } catch (err) {
      console.error('Chapter 23 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    // Reload the current form's published-example defaults plus the shared
    // site parameters.
    base_sat_flow = 1900;
    area_type = 'other';
    yellow_all_red = 5;
    phv = 6.1;
    ramp_grade = 2;
    extra_dist = 100;
    design_speed = 35;
    hasError = false;
    applyForm(form);
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 23</span>
    <h1 class="page-title">Ramp Terminals and Alternative Intersections</h1>
    <p class="page-sub">
      Estimate experienced travel time and level of service by origin-destination
      movement and for the facility as a whole, for signalized diamond
      interchanges (Part B) and for RCUT, MUT, and DLT alternative
      intersections (Part C).
    </p>
  </header>

  <div class="alert alert-info shadow-sm mb-6 beta-note" role="note">
    <span>
      The compute engine reproduces the published HCM Chapter 34 example
      problems within the library's documented tolerances: the conventional
      diamond and diverging diamond with pretimed signals under Part B, and the
      STOP-controlled RCUT, the MUT, and the DLT evaluations under Part C.
      Verify results
      independently before relying on them in engineering work, and please <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Analysis Part</h2>
        <p class="panel-sub">Part B evaluates signalized interchange ramp terminals. Part C evaluates alternative intersections: the restricted crossing U-turn, median U-turn, and displaced left-turn.</p>
      </div>
    </div>
    <div class="param-grid">
      <div class="param-field">
        <label for="PART_input">Chapter 23 Part</label>
        <select id="PART_input" class="select select-bordered select-sm" bind:value={part}>
          <option value="B">Part B · Interchange ramp terminals</option>
          <option value="C">Part C · Alternative intersections</option>
        </select>
      </div>
    </div>
  </section>

  {#if part === 'C'}
    <PartCAlternative {ready} />
  {:else}

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm23" onsubmit={preventDefault(runAnalysis)}>
    <!-- Configuration -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Interchange Configuration</h2>
          <p class="panel-sub">Signal timing and geometry shared by both ramp terminal intersections. The arterial runs east-west, with the southbound ramps at the west intersection and the northbound ramps at the east intersection.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="FORM_input">Interchange Form</label>
          <select id="FORM_input" class="select select-bordered select-sm" value={form} onchange={(e) => applyForm(e.target.value)}>
            <option value="Diamond">Conventional diamond</option>
            <option value="Ddi">Diverging diamond (DDI)</option>
          </select>
          <p class="param-hint">Switching loads that form's published example as defaults.</p>
        </div>

        {#if form === 'Ddi'}
          <div class="param-field">
            <label for="DDIEB_input">EB Crossover Lane Configuration</label>
            <select id="DDIEB_input" class="select select-bordered select-sm" bind:value={ddi_eb_config}>
              <option value="TwoLaneShared">2 lanes, shared left</option>
              <option value="ThreeLaneShared">3 lanes, shared left</option>
              <option value="ThreeLaneExclusive">3 lanes, exclusive left</option>
              <option value="ThreeLaneExclusiveMiddleShared">3 lanes, exclusive left + middle shared</option>
            </select>
          </div>
          <div class="param-field">
            <label for="DDIWB_input">WB Crossover Lane Configuration</label>
            <select id="DDIWB_input" class="select select-bordered select-sm" bind:value={ddi_wb_config}>
              <option value="TwoLaneShared">2 lanes, shared left</option>
              <option value="ThreeLaneShared">3 lanes, shared left</option>
              <option value="ThreeLaneExclusive">3 lanes, exclusive left</option>
              <option value="ThreeLaneExclusiveMiddleShared">3 lanes, exclusive left + middle shared</option>
            </select>
          </div>
        {/if}

        <div class="param-field">
          <label for="CYCLE_input">Cycle Length</label>
          <div class="cell-field">
            <input id="CYCLE_input" type="number" min="40" max="300" class="input input-bordered input-sm" bind:value={cycle_length} placeholder="160" required />
            <span class="unit">s</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="0.90" required />
          </div>
        </div>

        <div class="param-field">
          <label for="DIST_input">Intersection Spacing</label>
          <div class="cell-field">
            <input id="DIST_input" type="number" min="100" class="input input-bordered input-sm" bind:value={distance} placeholder="500" required />
            <span class="unit">ft</span>
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
          <label for="YAR_input">Yellow + All-Red Interval</label>
          <div class="cell-field">
            <input id="YAR_input" type="number" step="0.1" min="3" max="8" class="input input-bordered input-sm" bind:value={yellow_all_red} placeholder="5" required />
            <span class="unit">s</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PHV_input">Heavy Vehicles (arterial)</label>
          <div class="cell-field">
            <input id="PHV_input" type="number" step="0.01" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="6.1" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="GRADE_input">Ramp Grade</label>
          <div class="cell-field">
            <input id="GRADE_input" type="number" step="0.1" class="input input-bordered input-sm" bind:value={ramp_grade} placeholder="2" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="XDIST_input">Extra Ramp Travel Distance</label>
          <div class="cell-field">
            <input id="XDIST_input" type="number" min="0" class="input input-bordered input-sm" bind:value={extra_dist} placeholder="100" required />
            <span class="unit">ft</span>
          </div>
          <p class="param-hint">Applied with a positive sign to left turns and a negative sign to right turns.</p>
        </div>

        <div class="param-field">
          <label for="SPEED_input">Diverted-Path Design Speed</label>
          <div class="cell-field">
            <input id="SPEED_input" type="number" min="10" class="input input-bordered input-sm" bind:value={design_speed} placeholder="35" required />
            <span class="unit">mph</span>
          </div>
        </div>
      </div>
    </section>

    <!-- O-D Demands -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Interchange</h2>
          <p class="panel-sub">O-D movements per Exhibit 23-8. Hover the legend to isolate a group; demands are editable on the 2D picture, and the traffic animation slows per O-D LOS after a run.</p>
        </div>
        <div class="panel-actions">
          <ViewToggle bind:mode={diagramMode} label="Interchange view mode" />
        </div>
      </div>
      {#if diagramMode === '3d'}
        <DiamondDiagram3D {odDemands} odLos={losByOd} {form} ddiEb={ddi_eb_config} ddiWb={ddi_wb_config} />
      {:else}
        <DiamondDiagram bind:odDemands odLos={losByOd} {form} ddiEb={ddi_eb_config} ddiWb={ddi_wb_config} />
      {/if}
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Origin-Destination Demands</h2>
          <p class="panel-sub">Hourly demand volumes for the fourteen O-D movements of HCM Exhibit 23-20. Frontage-road and U-turn movements are usually 0.</p>
        </div>
      </div>
      <div class="param-grid">
        {#each odDemands as od (od.key)}
          <div class="param-field">
            <label for="OD_{od.key}_input">{od.label}</label>
            <div class="cell-field">
              <input id="OD_{od.key}_input" type="number" min="0" class="input input-bordered input-sm" bind:value={od.value} required />
              <span class="unit">veh/h</span>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <!-- Lane Groups -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Lane Groups and Green Times</h2>
          <p class="panel-sub">Lanes and displayed green interval for each interchange lane group. Green begin times are measured from the start of the common cycle and may wrap past the end of the cycle.</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Lane Group</th>
              <th>Lanes</th>
              <th>Green Begin (s)</th>
              <th>Green Duration (s)</th>
            </tr>
          </thead>
          <tbody>
            {#each laneGroups as g (g.movement)}
              <tr>
                <th>{g.label}</th>
                <td>
                  <input id="LG_{g.movement}_lanes" aria-label="{g.label} lanes" type="number" min="1" max="4" class="input input-bordered input-sm" bind:value={g.lanes} required />
                </td>
                <td>
                  <input id="LG_{g.movement}_begin" aria-label="{g.label} green begin" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={g.begin} required />
                </td>
                <td>
                  <input id="LG_{g.movement}_green" aria-label="{g.label} green duration" type="number" step="0.1" min="1" class="input input-bordered input-sm" bind:value={g.green} required />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
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
            <th>O-D Movement</th>
            <th>Demand (veh/h)</th>
            <th>Control Delay (s/veh)</th>
            <th>EDTT (s/veh)</th>
            <th>ETT (s/veh)</th>
            <th>LOS</th>
          </tr>
        </thead>
        <tbody>
          {#if results}
            {#each results.od_results as od}
              <tr>
                <th>{od.movement}</th>
                <td>{od.demand.toFixed(0)}</td>
                <td>{od.control_delay_s.toFixed(1)}</td>
                <td>{od.edtt_s.toFixed(1)}</td>
                <td>{od.ett_s.toFixed(1)}</td>
                <td>{od.los}</td>
              </tr>
            {/each}
          {:else}
            <tr>
              <th></th><td></td><td></td><td></td><td></td><td></td>
            </tr>
          {/if}
        </tbody>
      </table>
      <table class="table w-full">
        <tbody>
          <tr>
            <th>Interchange Experienced Travel Time (s/veh):</th>
            <td>{results && Number.isFinite(results.ett) ? results.ett.toFixed(1) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Interchange LOS: {results ? results.los : ''}</p>
      </div>
    </div>
  </section>

  {/if}
</div>
