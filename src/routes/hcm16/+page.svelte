<svelte:head>
  <title>Urban Street Facilities · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmUrbanFacility } from "HCM-middleware";
  import UrbanFacilityDiagram from '$lib/UrbanFacilityDiagram.svelte';
  import UrbanFacilityDiagram3D from '$lib/UrbanFacilityDiagram3D.svelte';
  import ViewToggle from '$lib/ViewToggle.svelte';
  import { setReport } from '$lib/report';
  import { onMount } from "svelte";

  let diagramMode = $state('2d');
  let selectedSeg = $state(-1);

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Chapter 16 takes its segments one of two ways, and the page follows that
  // split rather than papering over it.
  //
  // 'inputs'   — every segment described by its Chapter 18 inputs, run through
  //              the Chapter 18 engine and then aggregated (engine analyze()).
  // 'measures' — every segment described by its already-known performance
  //              measures, the Exhibit 16-7 "HCM method output" case, which is
  //              how the published example problems are stated (engine
  //              add_segment_summary + aggregate()).
  //
  // The two modes are exclusive within a run. The engine's aggregate() does
  // accept a facility mixing the two kinds of segment (middleware 0.3.4), but
  // a per-segment kind switch would double every segment card's state for a
  // case no published example exercises, so the page keeps one kind per run.
  let mode = $state('inputs');

  // ── inputs mode defaults ────────────────────────────────────────────────
  // HCM Chapter 30, Section 8, Example Problem 1 (Exhibits 30-26 through
  // 30-36), eastbound, replicated as three identical 1,800-ft segments. That
  // is the library fixture tests/ExampleCases/hcm/UrbanFacilities/case3.json:
  // Equations 16-2 and 16-3 are length-weighted harmonic means and Equation
  // 16-4 a length-weighted arithmetic mean, so a facility of identical
  // segments reproduces the published segment values at facility level (base
  // FFS 40.78 mi/h, travel speed 23.67 mi/h, stop rate 1.61 stops/mi, critical
  // v/c 0.52, LOS C). The per-point access-point delays 0.193 and 0.194 s/veh
  // are the published Exhibit 30-35 values, and without them the free-flow
  // speed chain falls back to the Exhibit 18-13 planning estimate and misses
  // the published travel speed. Same fixture as tests/boundary/ch16_urban_facilities.mjs.
  function defaultInputSegment() {
    return {
      segment_length: 1800,
      n_through_lanes: 2,
      speed_limit: 35,
      through_demand: 968,
      midsegment_flow: 1150,
      control: 'signalized',
      access_points_subject: 4,
      access_points_opposing: 4,
      upstream_width: 50,
      restrictive_median_length: 0,
      pct_curb: 70,
      pct_parking: 0,
      pct_opposing_left_accessible: '',
      signal_spacing: 1800,
      ffs_override: '',
      through_capacity: 1848,
      through_delay: 18.31,
      cycle_length: 100,
      effective_green: 48.63,
      platoon_ratio: '',
      sat_flow: '',
      stop_rate_override: 0.547,
      ap_delays: '0.193, 0.194'
    };
  }

  // ── measures mode defaults ──────────────────────────────────────────────
  // HCM Chapter 29, Section 5, Example Problem 1 (Exhibits 29-39 through
  // 29-49), eastbound: a 1-mi downtown facility of five segments given by
  // their published Chapter 18 outputs. Library fixture case1.json. Published
  // facility results are base free-flow speed 40.1 mi/h, LOS C, and a poorest
  // segment LOS of D, all of which this reproduces exactly. The published
  // facility travel speed of 22.6 mi/h does not, because the chapter publishes
  // only Segments 1 and 5 and the fixture copies them into the unpublished
  // Segments 2 through 4; see the note under the outputs.
  function defaultMeasureSegments() {
    return [
      { segment_length: 1320, base_ffs: 40.9, travel_speed: 24.2, stop_rate: 1.72, vc_ratio: 0.85, los: 'C' },
      { segment_length: 1320, base_ffs: 40.9, travel_speed: 24.2, stop_rate: 1.72, vc_ratio: 0.85, los: 'C' },
      { segment_length: 1320, base_ffs: 40.9, travel_speed: 24.2, stop_rate: 1.72, vc_ratio: 0.85, los: 'C' },
      { segment_length: 660, base_ffs: 37.9, travel_speed: 17.6, stop_rate: 2.63, vc_ratio: 0.9, los: 'D' },
      { segment_length: 660, base_ffs: 37.9, travel_speed: 17.6, stop_rate: 2.63, vc_ratio: 0.9, los: 'D' }
    ];
  }

  function defaultMeasureSegment() {
    return { segment_length: 1320, base_ffs: 40.9, travel_speed: 24.2, stop_rate: 1.72, vc_ratio: 0.85, los: 'C' };
  }

  // The two modes keep independent state, so switching back and forth never
  // silently rewrites the other mode's numbers. Each carries the facility-wide
  // P_LTL its own published example uses (0.33 for Chapter 30 EP1, 1.0 for
  // Chapter 29 EP1).
  let inputSegments = $state([defaultInputSegment(), defaultInputSegment(), defaultInputSegment()]);
  let measureSegments = $state(defaultMeasureSegments());
  let inputs_pct_left_turn_lanes = $state(33);
  let measures_pct_left_turn_lanes = $state(100);

  let results = $state(null);
  let resultMode = $state('inputs');   // the mode the displayed results came from
  let hasError = $state(false);
  let errMessage = $state('');

  const CONTROL_LABEL = {
    signalized: 'Signalized',
    allwaystop: 'All-Way STOP',
    yield: 'YIELD controlled',
    roundabout: 'Roundabout',
    uncontrolled: 'Uncontrolled'
  };

  // Blank optional inputs become undefined so the engine applies its defaults.
  function opt(v) {
    return v === '' || v === null || v === undefined ? undefined : Number(v);
  }

  // Comma- or space-separated per-point delays, one per active access point.
  function parseDelays(text) {
    const parts = String(text ?? '').split(/[,\s]+/).filter((s) => s !== '');
    if (!parts.length) return undefined;           // blank falls back to Exhibit 18-13
    const nums = parts.map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
    return Float64Array.from(nums);
  }

  function fmt(v, digits) {
    return v === null || v === undefined ? '' : Number(v).toFixed(digits);
  }

  function addSegment() {
    if (mode === 'inputs') inputSegments = [...inputSegments, defaultInputSegment()];
    else measureSegments = [...measureSegments, defaultMeasureSegment()];
  }

  function removeSegment(index) {
    if (mode === 'inputs') {
      if (inputSegments.length <= 1) return;
      inputSegments = inputSegments.filter((_, i) => i !== index);
    } else {
      if (measureSegments.length <= 1) return;
      measureSegments = measureSegments.filter((_, i) => i !== index);
    }
    if (selectedSeg >= index) selectedSeg = -1;
  }

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      if (mode === 'inputs') {
        const facility = new WasmUrbanFacility(Number(inputs_pct_left_turn_lanes) / 100.0);

        for (const seg of inputSegments) {
          const delays = parseDelays(seg.ap_delays);
          if (delays === null) {
            throw new Error('access point delays must be a list of nonnegative numbers');
          }
          facility.add_segment(
            Number(seg.segment_length),
            Number(seg.n_through_lanes),
            Number(seg.speed_limit),
            Number(seg.through_demand),
            seg.control,
            Number(seg.access_points_subject),
            Number(seg.access_points_opposing),
            opt(seg.midsegment_flow),
            opt(seg.through_capacity),
            seg.control === 'uncontrolled' ? undefined : opt(seg.through_delay),
            seg.control === 'signalized' ? opt(seg.cycle_length) : undefined,
            seg.control === 'signalized' ? opt(seg.effective_green) : undefined,
            seg.control === 'signalized' ? opt(seg.platoon_ratio) : undefined,
            seg.control === 'signalized' ? opt(seg.sat_flow) : undefined,
            opt(seg.stop_rate_override),
            opt(seg.upstream_width),
            opt(seg.restrictive_median_length),
            seg.pct_curb === '' ? undefined : Number(seg.pct_curb) / 100.0,       // UI takes percent, the engine takes a decimal
            seg.pct_parking === '' ? undefined : Number(seg.pct_parking) / 100.0,
            seg.pct_opposing_left_accessible === '' ? undefined : Number(seg.pct_opposing_left_accessible) / 100.0,
            opt(seg.signal_spacing),
            opt(seg.ffs_override),
            delays
          );
        }

        const los = facility.analyze();
        results = { los, ...facility.results_to_js_value() };
      } else {
        const facility = new WasmUrbanFacility(Number(measures_pct_left_turn_lanes) / 100.0);

        for (const seg of measureSegments) {
          facility.add_segment_summary(
            Number(seg.segment_length),
            Number(seg.base_ffs),
            Number(seg.travel_speed),
            opt(seg.stop_rate),
            opt(seg.vc_ratio),
            seg.los === '' ? undefined : seg.los
          );
        }

        // analyze() throws on a summary-built facility, by design: there are no
        // Chapter 18 inputs behind these measures to recompute from.
        const los = facility.aggregate();
        results = { los, ...facility.results_to_js_value() };
      }

      resultMode = mode;
      publishReport();
    } catch (err) {
      console.error('Chapter 16 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the segment values and try again.';
    }
  }

  function publishReport() {
    const perSegment = results.segments ?? [];
    const inputRows = mode === 'inputs'
      ? [
          { label: 'Segment source', value: 'Chapter 18 inputs, evaluated then aggregated' },
          { label: 'Segments', value: inputSegments.length },
          { label: 'Intersections with left-turn lanes', value: `${inputs_pct_left_turn_lanes}%` },
          ...inputSegments.flatMap((s, i) => [
            { label: `Segment ${i + 1} length`, value: `${s.segment_length} ft` },
            { label: `Segment ${i + 1} through lanes / speed limit`, value: `${s.n_through_lanes} ln / ${s.speed_limit} mi/h` },
            { label: `Segment ${i + 1} through demand / midsegment flow`, value: `${s.through_demand} / ${s.midsegment_flow === '' ? 'through demand' : s.midsegment_flow} veh/h` },
            { label: `Segment ${i + 1} boundary control`, value: CONTROL_LABEL[s.control] },
            { label: `Segment ${i + 1} through delay / capacity`, value: `${s.control === 'uncontrolled' ? 'not applicable' : `${s.through_delay} s/veh`} / ${s.through_capacity === '' ? 'not supplied' : `${s.through_capacity} veh/h`}` },
            { label: `Segment ${i + 1} access points, subject / opposing`, value: `${s.access_points_subject} / ${s.access_points_opposing}` },
            { label: `Segment ${i + 1} access-point delays`, value: s.ap_delays === '' ? 'Exhibit 18-13 planning estimate' : `${s.ap_delays} s/veh` },
          ]),
        ]
      : [
          { label: 'Segment source', value: 'Published Chapter 18 performance measures (Exhibit 16-7)' },
          { label: 'Segments', value: measureSegments.length },
          { label: 'Intersections with left-turn lanes', value: `${measures_pct_left_turn_lanes}%` },
          ...measureSegments.map((s, i) => ({
            label: `Segment ${i + 1}`,
            value: `${s.segment_length} ft · base FFS ${s.base_ffs} mi/h · travel speed ${s.travel_speed} mi/h · ${s.stop_rate === '' ? 'no stop rate' : `${s.stop_rate} stops/mi`} · v/c ${s.vc_ratio === '' ? 'not supplied' : s.vc_ratio} · LOS ${s.los || 'not supplied'}`
          })),
        ];

    setReport({
      chapter: 'Urban Street Facilities',
      chapterRef: 'HCM Chapter 16',
      href: '/hcm16',
      generatedAt: new Date().toLocaleString(),
      headline: { label: 'Facility LOS', value: results.los },
      inputs: inputRows,
      resultTable: {
        columns: ['Segment', 'Length (ft)', 'Base FFS (mi/h)', 'Travel speed (mi/h)', 'Stop rate (stops/mi)', 'v/c', 'LOS'],
        rows: perSegment.map((s, i) => [
          String(i + 1),
          fmt(s.length_ft, 0),
          fmt(s.base_ffs, 2),
          fmt(s.travel_speed, 2),
          fmt(s.spatial_stop_rate, 2),
          fmt(s.vc_ratio, 2),
          s.los || ''
        ]),
      },
      summary: [
        { label: 'Facility length', value: `${fmt(results.length_ft, 0)} ft` },
        { label: 'Facility base free-flow speed (Equation 16-2)', value: `${fmt(results.base_ffs, 2)} mi/h` },
        { label: 'Facility travel speed (Equation 16-3)', value: `${fmt(results.travel_speed, 2)} mi/h` },
        { label: 'Facility travel time', value: `${fmt(results.travel_time, 1)} s` },
        { label: 'Facility spatial stop rate (Equation 16-4)', value: `${fmt(results.spatial_stop_rate, 2)} stops/mi` },
        { label: 'Critical volume-to-capacity ratio', value: fmt(results.critical_vc_ratio, 2) },
        { label: 'Traveler perception score', value: fmt(results.perception_score, 2) },
        { label: 'Poorest-performing segment LOS', value: results.poorest_segment_los },
        { label: 'Facility LOS (Exhibit 16-3)', value: results.los },
      ],
      methodology: [
        'HCM Chapter 16 methodology for the motorized vehicle mode in one direction of travel: the length-weighted harmonic mean base free-flow speed (Equation 16-2) and travel speed (Equation 16-3), the length-weighted spatial stop rate (Equation 16-4), and the Exhibit 16-3 travel-speed-ratio thresholds for facility LOS. A through movement running over capacity at any boundary intersection forces LOS F regardless of the speed ratio, which is the Exhibit 16-3 footnote.',
        mode === 'inputs'
          ? 'Segments were supplied as Chapter 18 inputs, so each was evaluated with the Chapter 18 segment engine (free-flow speed, running time including the access-point turning delay of Equation 18-7, travel speed, and stop rate) before the Chapter 16 aggregation ran over the results.'
          : 'Segments were supplied as already-known Chapter 18 performance measures, the Exhibit 16-7 "HCM method output" case. No Chapter 18 engine ran; the Chapter 16 aggregation used the measures exactly as entered, which is how the published example problems of Chapter 29 are stated.',
        'Boundary-intersection through control delay, capacity, and stop rate are inputs to this chapter per Exhibit 18-5, produced by the Chapter 19, 20, 21, or 22 analysis of each intersection.',
      ],
      diagram: {
        kind: 'urban-facility',
        props: { segments: diagramSegments }
      },
    });
  }

  function resetParams() {
    inputSegments = [defaultInputSegment(), defaultInputSegment(), defaultInputSegment()];
    measureSegments = defaultMeasureSegments();
    inputs_pct_left_turn_lanes = 33;
    measures_pct_left_turn_lanes = 100;
    results = null;
    selectedSeg = -1;
    hasError = false;
  }

  // The diagram takes one shape from both modes. The summary path carries no
  // cross-section, so lane counts and driveways are left to the diagram's own
  // fallback there rather than invented here.
  let diagramSegments = $derived.by(() => {
    const scored = resultMode === mode && results && results.segments ? results.segments : null;
    if (mode === 'inputs') {
      return inputSegments.map((s, i) => ({
        length_ft: Number(s.segment_length) || 0,
        lanes: Number(s.n_through_lanes) || 2,
        accessPoints: Number(s.access_points_subject) || 0,
        control: s.control,
        los: scored && scored[i] ? scored[i].los : null
      }));
    }
    return measureSegments.map((s, i) => ({
      length_ft: Number(s.segment_length) || 0,
      control: 'signalized',
      los: scored && scored[i] ? scored[i].los : (s.los || null)
    }));
  });

  let diagramNote = $derived(
    mode === 'inputs'
      ? 'Segment chain, upstream to downstream, separated by its boundary intersections. Widths follow segment length, depth the through-lane count, and the ticks below each link are its subject-side access points. Click a segment to highlight its card.'
      : 'Segment chain, upstream to downstream. Widths follow segment length. The published-measures path carries no cross-section, so lane counts are drawn indicatively and no access points are shown. Click a segment to highlight its row.'
  );
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 16 <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">Urban Street Facilities</h1>
    <p class="page-sub">
      Aggregate urban street segments into facility travel speed, spatial stop
      rate, and level of service for one direction of travel.
    </p>
  </header>

  <div class="alert alert-warning shadow-sm mb-6 beta-note" role="note">
    <span>
      <strong>Beta.</strong> The compute engine is boundary-validated against HCM
      Chapter 30, Example Problem 1 aggregated to facility level and against
      Chapter 29, Example Problem 1 in both directions, which the two modes'
      defaults reproduce. The page itself is in beta pending final inspection.
      Verify results independently before relying on them in engineering work, and
      please <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm16" onsubmit={preventDefault(runAnalysis)}>
    <!-- Facility -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Facility</h2>
          <p class="panel-sub">How the segments are described, and the facility-wide inputs for the subject direction of travel.</p>
        </div>
        <div class="panel-actions">
          <ViewToggle bind:mode={diagramMode} label="Facility view mode" />
        </div>
      </div>

      {#if diagramMode === '3d'}
        <UrbanFacilityDiagram3D
          segments={diagramSegments}
          selected={selectedSeg}
          onselect={(i) => (selectedSeg = selectedSeg === i ? -1 : i)} />
      {:else}
        <UrbanFacilityDiagram
          segments={diagramSegments}
          selected={selectedSeg}
          onselect={(i) => (selectedSeg = selectedSeg === i ? -1 : i)}
          note={diagramNote} />
      {/if}

      <div class="param-grid">
        <div class="param-field">
          <label for="MODE_input">Analysis Mode</label>
          <select id="MODE_input" class="select select-bordered select-sm" bind:value={mode} onchange={() => (selectedSeg = -1)}>
            <option value="inputs">Chapter 18 inputs</option>
            <option value="measures">Published segment measures</option>
          </select>
          <p class="param-hint">
            {#if mode === 'inputs'}
              Each segment is described by its Chapter 18 inputs and evaluated before the facility aggregation runs.
            {:else}
              Each segment is described by its already-known Chapter 18 performance measures, the Exhibit 16-7 HCM method output case.
            {/if}
          </p>
        </div>

        {#if mode === 'inputs'}
          <div class="param-field">
            <label for="PLTL_input">Intersections with Left-Turn Lanes</label>
            <div class="cell-field">
              <input id="PLTL_input" type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={inputs_pct_left_turn_lanes} placeholder="33" required />
              <span class="unit">%</span>
            </div>
            <p class="param-hint">Used by the facility traveler perception score.</p>
          </div>
        {:else}
          <div class="param-field">
            <label for="PLTLM_input">Intersections with Left-Turn Lanes</label>
            <div class="cell-field">
              <input id="PLTLM_input" type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={measures_pct_left_turn_lanes} placeholder="100" required />
              <span class="unit">%</span>
            </div>
            <p class="param-hint">Used by the facility traveler perception score.</p>
          </div>
        {/if}
      </div>
    </section>

    {#if mode === 'inputs'}
      <!-- Segments, described by their Chapter 18 inputs -->
      {#each inputSegments as seg, i}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <section class="panel seg-panel" class:seg-selected={selectedSeg === i} onclick={() => (selectedSeg = i)}>
          <div class="panel-head">
            <div>
              <h2 class="panel-title">Segment {i + 1}</h2>
              <p class="panel-sub">Chapter 18 inputs, ordered upstream to downstream.</p>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" onclick={() => removeSegment(i)} disabled={inputSegments.length <= 1}>Remove</button>
          </div>
          <div class="param-grid">
            <div class="param-field">
              <label for={"LEN_input_" + i}>Segment Length</label>
              <div class="cell-field">
                <input id={"LEN_input_" + i} type="number" min="1" class="input input-bordered input-sm" bind:value={seg.segment_length} placeholder="1800" required />
                <span class="unit">ft</span>
              </div>
              <p class="param-hint">Stop line to stop line.</p>
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
                <input id={"DEM_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.through_demand} placeholder="968" required />
                <span class="unit">veh/h</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"MID_input_" + i}>Midsegment Flow Rate (optional)</label>
              <div class="cell-field">
                <input id={"MID_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.midsegment_flow} placeholder="through demand" />
                <span class="unit">veh/h</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"UPW_input_" + i}>Upstream Intersection Width</label>
              <div class="cell-field">
                <input id={"UPW_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.upstream_width} placeholder="50" required />
                <span class="unit">ft</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"RML_input_" + i}>Restrictive Median Length</label>
              <div class="cell-field">
                <input id={"RML_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.restrictive_median_length} placeholder="0" required />
                <span class="unit">ft</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"CURB_input_" + i}>Link Length with Curb</label>
              <div class="cell-field">
                <input id={"CURB_input_" + i} type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={seg.pct_curb} placeholder="70" required />
                <span class="unit">%</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"PARK_input_" + i}>Link Length with On-Street Parking</label>
              <div class="cell-field">
                <input id={"PARK_input_" + i} type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={seg.pct_parking} placeholder="0" required />
                <span class="unit">%</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"APS_input_" + i}>Access Points (subject side)</label>
              <div class="cell-field">
                <input id={"APS_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.access_points_subject} placeholder="4" required />
                <span class="unit">pts</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"APO_input_" + i}>Access Points (opposing side)</label>
              <div class="cell-field">
                <input id={"APO_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.access_points_opposing} placeholder="4" required />
                <span class="unit">pts</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"POL_input_" + i}>Opposing Points Reachable by Left Turn (optional)</label>
              <div class="cell-field">
                <input id={"POL_input_" + i} type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={seg.pct_opposing_left_accessible} placeholder="HCM default" />
                <span class="unit">%</span>
              </div>
              <p class="param-hint">Use 0 for a full restrictive median with no openings.</p>
            </div>

            <div class="param-field">
              <label for={"SSP_input_" + i}>Signal Spacing (optional)</label>
              <div class="cell-field">
                <input id={"SSP_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.signal_spacing} placeholder="segment length" />
                <span class="unit">ft</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"FFO_input_" + i}>Measured Free-Flow Speed (optional)</label>
              <div class="cell-field">
                <input id={"FFO_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.ffs_override} placeholder="predicted" />
                <span class="unit">mph</span>
              </div>
            </div>

            <div class="param-field">
              <label for={"APD_input_" + i}>Access-Point Delays (optional)</label>
              <div class="cell-field">
                <input id={"APD_input_" + i} type="text" class="input input-bordered input-sm" bind:value={seg.ap_delays} placeholder="Exhibit 18-13 estimate" />
                <span class="unit">s/veh</span>
              </div>
              <p class="param-hint">The Σ d_ap,i term of Equation 18-7, one measured or published value per active access point, comma separated. The defaults are the Exhibit 30-35 values for Example Problem 1. Blank falls back to the Exhibit 18-13 planning estimate. The third source, the Chapter 30 Section 4 computed procedure, takes per-approach geometry and turn volumes that this table has no room for; the <a href="/hcm18">Chapter 18 page</a> offers it for a single segment.</p>
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
              <p class="param-hint">The intersection at the downstream end of this segment.</p>
            </div>

            {#if seg.control !== 'uncontrolled'}
              <div class="param-field">
                <label for={"DEL_input_" + i}>Through Control Delay</label>
                <div class="cell-field">
                  <input id={"DEL_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={seg.through_delay} placeholder="18.31" required />
                  <span class="unit">s/veh</span>
                </div>
                <p class="param-hint">From the Chapter 19, 20, 21, or 22 analysis of the intersection.</p>
              </div>
            {/if}

            <div class="param-field">
              <label for={"CAP_input_" + i}>Through Capacity (optional)</label>
              <div class="cell-field">
                <input id={"CAP_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.through_capacity} placeholder="1848" />
                <span class="unit">veh/h</span>
              </div>
              <p class="param-hint">Needed for the critical v/c ratio and the Exhibit 16-3 LOS F check.</p>
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
                  <input id={"GRN_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={seg.effective_green} placeholder="48.63" />
                  <span class="unit">s</span>
                </div>
              </div>

              <div class="param-field">
                <label for={"PR_input_" + i}>Platoon Ratio (optional)</label>
                <div class="cell-field">
                  <input id={"PR_input_" + i} type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={seg.platoon_ratio} placeholder="uniform arrivals" />
                </div>
                <p class="param-hint">Blank gives uniform arrivals, P = g/C.</p>
              </div>

              <div class="param-field">
                <label for={"SAT_input_" + i}>Adjusted Saturation Flow Rate (optional)</label>
                <div class="cell-field">
                  <input id={"SAT_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.sat_flow} placeholder="HCM default" />
                  <span class="unit">veh/h/ln</span>
                </div>
              </div>
            {/if}

            <div class="param-field">
              <label for={"STP_input_" + i}>Full Stop Rate (optional)</label>
              <div class="cell-field">
                <input id={"STP_input_" + i} type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={seg.stop_rate_override} placeholder="0.547" />
                <span class="unit">stops/veh</span>
              </div>
              <p class="param-hint">Needed for the facility stop rate and perception score at signalized boundaries.</p>
            </div>
          </div>
        </section>
      {/each}
    {:else}
      <!-- Segments, described by their published Chapter 18 measures -->
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Published Segment Measures</h2>
            <p class="panel-sub">One row per segment, ordered upstream to downstream. These are the Chapter 18 outputs the facility aggregation consumes, not inputs it recomputes.</p>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="table w-full seg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Length (ft)</th>
                <th>Base FFS (mi/h)</th>
                <th>Travel Speed (mi/h)</th>
                <th>Stop Rate (stops/mi)</th>
                <th>v/c</th>
                <th>LOS</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each measureSegments as seg, i}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <tr class:seg-selected={selectedSeg === i} onclick={() => (selectedSeg = i)}>
                  <td>{i + 1}</td>
                  <td><input id={"MLEN_input_" + i} type="number" min="1" class="input input-bordered input-sm" aria-label={"Segment " + (i + 1) + " length"} bind:value={seg.segment_length} required /></td>
                  <td><input id={"MFFS_input_" + i} type="number" step="0.1" min="0" class="input input-bordered input-sm" aria-label={"Segment " + (i + 1) + " base free-flow speed"} bind:value={seg.base_ffs} required /></td>
                  <td><input id={"MTS_input_" + i} type="number" step="0.1" min="0" class="input input-bordered input-sm" aria-label={"Segment " + (i + 1) + " travel speed"} bind:value={seg.travel_speed} required /></td>
                  <td><input id={"MSR_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" aria-label={"Segment " + (i + 1) + " spatial stop rate"} bind:value={seg.stop_rate} /></td>
                  <td><input id={"MVC_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" aria-label={"Segment " + (i + 1) + " volume to capacity ratio"} bind:value={seg.vc_ratio} /></td>
                  <td>
                    <select id={"MLOS_input_" + i} class="select select-bordered select-sm" aria-label={"Segment " + (i + 1) + " level of service"} bind:value={seg.los}>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="E">E</option>
                      <option value="F">F</option>
                    </select>
                  </td>
                  <td><button class="btn btn-ghost btn-xs" type="button" onclick={() => removeSegment(i)} disabled={measureSegments.length <= 1}>Remove</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="param-hint">
          Omit the stop rate on any segment and the Equation 16-4 facility stop rate, and the perception score built on it, are reported as blank rather than aggregated from a partial set. The v/c ratio is the through movement's at the segment's downstream boundary intersection; the largest becomes the critical ratio of the Exhibit 16-3 footnote.
        </p>
      </section>
    {/if}

    <!-- Form Actions -->
    <div class="action-bar">
      <button class="btn btn-ghost" onclick={addSegment} type="button">Add Segment</button>
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
        <tbody>
          <tr>
            <th>Facility Length (ft):</th>
            <td>{results ? fmt(results.length_ft, 0) : ''}</td>
          </tr>
          <tr>
            <th>Facility Base Free-Flow Speed (mi/hr):</th>
            <td>{results ? fmt(results.base_ffs, 2) : ''}</td>
          </tr>
          <tr>
            <th>Facility Travel Speed (mi/hr):</th>
            <td>{results ? fmt(results.travel_speed, 2) : ''}</td>
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
              <th>Base FFS (mi/hr)</th>
              <th>Travel Speed (mi/hr)</th>
              <th>Stop Rate (stops/mi)</th>
              <th>v/c</th>
              <th>LOS</th>
            </tr>
          </thead>
          <tbody>
            {#each results.segments as segRes, i}
              <tr class:seg-selected={selectedSeg === i} onclick={() => (selectedSeg = i)}>
                <td>{i + 1}</td>
                <td>{fmt(segRes.length_ft, 0)}</td>
                <td>{fmt(segRes.base_ffs, 2)}</td>
                <td>{fmt(segRes.travel_speed, 2)}</td>
                <td>{fmt(segRes.spatial_stop_rate, 2)}</td>
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

      {#if results && resultMode === 'measures'}
        <p class="param-hint fixture-note">
          The Chapter 29 Example Problem 1 defaults reproduce the published facility base free-flow speed of 40.1 mi/h, facility LOS C, and poorest segment LOS D exactly. The facility travel speed lands on 22.13 mi/h against a published 22.6 mi/h, and the stop rate on 1.95 against a published 1.83, because Chapter 29 publishes per-segment measures only for Segments 1 and 5 and the library fixture copies those into the unpublished Segments 2 through 4. Those two gaps are a property of the fixture, not of the aggregation.
        </p>
      {/if}
    </div>
  </section>
</div>

<style>
  /* Selection sync with the facility diagram: the picked segment's card, and
     its row in either table, take the same accent as the diagram slab. */
  .seg-panel { cursor: pointer; }
  .seg-panel.seg-selected { outline: 2px solid var(--accent); outline-offset: 2px; }
  tr.seg-selected { background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .fixture-note { margin-top: 0.6rem; }
</style>
