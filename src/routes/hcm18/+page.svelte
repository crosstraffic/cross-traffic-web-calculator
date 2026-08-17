<svelte:head>
  <title>Urban Street Segments · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmUrbanSegment } from "HCM-middleware";
  import UrbanSegmentDiagram from '$lib/UrbanSegmentDiagram.svelte';
  import UrbanSegmentDiagram3D from '$lib/UrbanSegmentDiagram3D.svelte';
  import ViewToggle from '$lib/ViewToggle.svelte';
  import { setReport } from '$lib/report';
  import { onMount } from "svelte";

  let diagramMode = $state('2d');

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Defaults are HCM Chapter 30, Section 8, Example Problem 1 (Exhibits 30-26
  // through 30-36), eastbound direction: an 1,800-ft undivided four-lane
  // segment with a 35 mi/h speed limit, 70% of the link with curb, four access
  // points per side, and signalized boundary intersections on a 100-s cycle.
  // The boundary-intersection values (through delay 18.310 s/veh, full stop
  // rate 0.547 stops/veh, capacity 1,848 veh/h, effective green 48.63 s) are
  // the published computational-engine outputs supplied as inputs per Exhibit
  // 18-5. Same fixture as tests/boundary/ch18_urban_segments.mjs.
  let segment_length = $state(1800);
  let n_through_lanes = $state(2);
  let speed_limit = $state(35);
  let upstream_width = $state(50);
  let restrictive_median_length = $state(0);
  let pct_curb = $state(70);
  let pct_parking = $state(0);
  let access_points_subject = $state(4);
  let access_points_opposing = $state(4);
  let pct_opposing_left_accessible = $state(100);
  let signal_spacing = $state(1800);
  let ffs_override = $state('');

  let through_demand = $state(968);
  let midsegment_flow = $state(1150);

  let control = $state('signalized');
  let through_delay = $state(18.31);
  let through_capacity = $state(1848);
  let cycle_length = $state(100);
  let effective_green = $state(48.63);
  let platoon_ratio = $state('');
  let sat_flow = $state('');
  let stop_rate_override = $state(0.547);

  let pct_left_turn_lanes = $state(33);

  // Equation 18-7's access-point turning-delay term. All three engine sources
  // are selectable: the published per-point delays, the Chapter 30 Section 4
  // procedure computed from approach geometry and turn volumes, and the
  // Exhibit 18-13 planning estimate. Leaving every planning field blank
  // reproduces the pre-0.3.3 default path exactly, which is what a bookmarked
  // run from before this selector existed used.
  let ap_source = $state('measured');
  let ap_delays = $state('0.193, 0.194');
  let n_influential_access_points = $state('');
  let pct_left_turns_access = $state('');
  let pct_right_turns_access = $state('');
  let access_left_bay_adequate = $state(false);
  let access_right_bay_adequate = $state(false);

  // Computed-mode defaults are the two access-point approaches the eastbound
  // through movement sees in Exhibit 30-35, adjusted volumes and all, from
  // library fixture UrbanSegments/case3.json. Both are undivided two-lane
  // approaches with no turn bays, which is why every lane and bay field below
  // is zero or false.
  function defaultApproaches() {
    return [
      { v_lt: 74.80, v_th: 981.71, v_rt: 93.50, n_sl: 0, n_t: 2, n_sr: 0, opposing_flow_veh_h: 1086.15, left_turn_bay: false, right_turn_bay: false, n_lt_lanes: 0, left_bay_storage_ft: 0, pct_heavy_veh: 0 },
      { v_lt: 75.56, v_th: 991.70, v_rt: 94.45, n_sl: 0, n_t: 2, n_sr: 0, opposing_flow_veh_h: 1075.21, left_turn_bay: false, right_turn_bay: false, n_lt_lanes: 0, left_bay_storage_ft: 0, pct_heavy_veh: 0 }
    ];
  }

  let ap_approaches = $state(defaultApproaches());
  // Analysis period T of Equations 30-48 and 30-51. Read only by the computed
  // branch, so it is left off the form in the other two modes.
  let analysis_period = $state(0.25);

  let results = $state(null);
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
    const parts = String(text).split(/[,\s]+/).filter((s) => s !== '');
    const nums = parts.map(Number);
    if (!nums.length || nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
    return Float64Array.from(nums);
  }

  function fmt(v, digits) {
    return v === null || v === undefined ? '' : Number(v).toFixed(digits);
  }

  function addApproach() {
    ap_approaches = [...ap_approaches, { v_lt: 0, v_th: 0, v_rt: 0, n_sl: 0, n_t: 2, n_sr: 0, opposing_flow_veh_h: 0, left_turn_bay: false, right_turn_bay: false, n_lt_lanes: 0, left_bay_storage_ft: 0, pct_heavy_veh: 0 }];
  }

  function removeApproach(index) {
    if (ap_approaches.length <= 1) return;
    ap_approaches = ap_approaches.filter((_, i) => i !== index);
  }

  // The serde struct behind add_access_point takes numbers and booleans, not
  // the strings an input element binds, so every field is coerced here rather
  // than relying on serde to be lenient.
  function approachRecord(a) {
    return {
      v_lt: Number(a.v_lt),
      v_th: Number(a.v_th),
      v_rt: Number(a.v_rt),
      n_sl: Number(a.n_sl),
      n_t: Number(a.n_t),
      n_sr: Number(a.n_sr),
      opposing_flow_veh_h: Number(a.opposing_flow_veh_h),
      left_turn_bay: Boolean(a.left_turn_bay),
      right_turn_bay: Boolean(a.right_turn_bay),
      n_lt_lanes: Number(a.n_lt_lanes),
      left_bay_storage_ft: Number(a.left_bay_storage_ft),
      pct_heavy_veh: Number(a.pct_heavy_veh)
    };
  }

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const delays = ap_source === 'measured' ? parseDelays(ap_delays) : null;
      if (ap_source === 'measured' && !delays) {
        throw new Error('access point delays must be a list of nonnegative numbers');
      }

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
        Number(pct_left_turn_lanes) / 100.0,
        delays ?? undefined,                   // Exhibit 30-35 per-point delays
        ap_source === 'planning' ? opt(n_influential_access_points) : undefined,
        ap_source === 'planning' ? opt(pct_left_turns_access) : undefined,
        ap_source === 'planning' ? opt(pct_right_turns_access) : undefined,
        ap_source === 'planning' ? access_left_bay_adequate : undefined,
        ap_source === 'planning' ? access_right_bay_adequate : undefined,
        undefined,                             // other midsegment delay (Equation 18-7)
        ap_source === 'computed' ? opt(analysis_period) : undefined
      );

      // The engine enters the Chapter 30, Section 4 branch only when at least
      // one approach has been registered, and registration has to happen
      // before analyze().
      if (ap_source === 'computed') {
        for (const a of ap_approaches) seg.add_access_point(approachRecord(a));
      }

      const los = seg.analyze();
      results = {
        los,
        ap_computed: ap_source === 'computed' ? seg.access_point_delays_computed() : null,
        base_ffs: seg.get_base_ffs(),
        free_flow_speed: seg.get_free_flow_speed(),
        running_time: seg.get_running_time(),
        running_speed: seg.get_running_speed(),
        access_point_delay: seg.get_access_point_delay(),
        travel_speed: seg.get_travel_speed(),
        through_delay: seg.get_through_delay(),
        full_stop_rate: seg.get_full_stop_rate(),
        spatial_stop_rate: seg.get_spatial_stop_rate(),
        vc_ratio: seg.get_vc_ratio(),
        perception_score: seg.get_perception_score()
      };

      const apSourceLabel = ap_source === 'measured'
        ? `measured or published per-point delays (${ap_delays})`
        : ap_source === 'computed'
          ? `Chapter 30, Section 4 procedure computed from ${ap_approaches.length} access-point approach${ap_approaches.length === 1 ? '' : 'es'}`
          : 'Exhibit 18-13 planning estimate';

      setReport({
        chapter: 'Urban Street Segments',
        chapterRef: 'HCM Chapter 18',
        href: '/hcm18',
        generatedAt: new Date().toLocaleString(),
        headline: { label: 'Segment LOS', value: results.los },
        inputs: [
          { label: 'Segment length', value: `${segment_length} ft` },
          { label: 'Through lanes, subject direction', value: n_through_lanes },
          { label: 'Posted speed limit', value: `${speed_limit} mi/h` },
          { label: 'Upstream intersection width', value: `${upstream_width} ft` },
          { label: 'Restrictive median length', value: `${restrictive_median_length} ft` },
          { label: 'Link length with curb', value: `${pct_curb}%` },
          { label: 'Link length with on-street parking', value: `${pct_parking}%` },
          { label: 'Access points, subject / opposing side', value: `${access_points_subject} / ${access_points_opposing}` },
          { label: 'Opposing points reachable by left turn', value: `${pct_opposing_left_accessible}%` },
          { label: 'Signal spacing', value: signal_spacing === '' ? 'segment length' : `${signal_spacing} ft` },
          { label: 'Measured free-flow speed', value: ffs_override === '' ? 'predicted' : `${ffs_override} mi/h` },
          { label: 'Through demand flow rate', value: `${through_demand} veh/h` },
          { label: 'Midsegment flow rate', value: midsegment_flow === '' ? 'through demand' : `${midsegment_flow} veh/h` },
          { label: 'Boundary intersection control', value: CONTROL_LABEL[control] },
          { label: 'Through control delay', value: control === 'uncontrolled' ? 'not applicable' : `${through_delay} s/veh` },
          { label: 'Through capacity', value: through_capacity === '' ? 'not supplied' : `${through_capacity} veh/h` },
          ...(control === 'signalized' ? [
            { label: 'Cycle length', value: `${cycle_length} s` },
            { label: 'Effective green time', value: `${effective_green} s` },
            { label: 'Platoon ratio', value: platoon_ratio === '' ? 'uniform arrivals, P = g/C' : platoon_ratio },
            { label: 'Adjusted saturation flow rate', value: sat_flow === '' ? 'HCM default' : `${sat_flow} veh/h/ln` },
          ] : []),
          { label: 'Full stop rate', value: stop_rate_override === '' ? 'HCM default' : `${stop_rate_override} stops/veh` },
          { label: 'Intersections with left-turn lanes', value: `${pct_left_turn_lanes}%` },
          { label: 'Access-point delay source', value: apSourceLabel },
          ...(ap_source === 'computed' ? [
            { label: 'Analysis period T', value: `${analysis_period} h` },
            ...ap_approaches.map((a, i) => ({
              label: `Access point ${i + 1} approach`,
              value: `${a.v_lt} L / ${a.v_th} T / ${a.v_rt} R veh/h, lanes ${a.n_sl}+${a.n_t}+${a.n_sr}, opposing ${a.opposing_flow_veh_h} veh/h, bays ${a.left_turn_bay ? 'L' : '-'}${a.right_turn_bay ? 'R' : '-'}, ${a.pct_heavy_veh}% heavy`
            })),
            ...(results.ap_computed ? results.ap_computed.map((d, i) => ({
              label: `Access point ${i + 1} computed delay`,
              value: `${fmt(d.delay_total_s, 4)} s/veh (left ${fmt(d.delay_left_s, 4)}, right ${fmt(d.delay_right_s, 4)}, p_ov ${fmt(d.prob_inside_lane_blocked, 3)})`
            })) : []),
          ] : []),
          ...(ap_source === 'planning' ? [
            { label: 'Influential access points N_ap', value: n_influential_access_points === '' ? 'N_ap,s + p_ap,lt × N_ap,o' : n_influential_access_points },
            { label: 'Access left / right turn percentages', value: `${pct_left_turns_access === '' ? '10' : pct_left_turns_access}% / ${pct_right_turns_access === '' ? '10' : pct_right_turns_access}%` },
            { label: 'Adequate left / right turn bays', value: `${access_left_bay_adequate ? 'yes' : 'no'} / ${access_right_bay_adequate ? 'yes' : 'no'}` },
          ] : []),
        ],
        resultTable: {
          columns: ['Measure', 'Value', 'Unit'],
          rows: [
            ['Base free-flow speed S_fo (Equation 18-3)', fmt(results.base_ffs, 2), 'mi/h'],
            ['Free-flow speed S_f (Equation 18-5)', fmt(results.free_flow_speed, 2), 'mi/h'],
            ['Access-point delay Σ d_ap,i (Equation 18-7)', fmt(results.access_point_delay, 3), 's/veh'],
            ['Segment running time (Equation 18-7)', fmt(results.running_time, 2), 's'],
            ['Segment running speed', fmt(results.running_speed, 2), 'mi/h'],
            ['Through control delay at the boundary', fmt(results.through_delay, 2), 's/veh'],
            ['Travel speed (Equation 18-8)', fmt(results.travel_speed, 2), 'mi/h'],
            ['Full stop rate', fmt(results.full_stop_rate, 3), 'stops/veh'],
            ['Spatial stop rate (Equation 18-16)', fmt(results.spatial_stop_rate, 2), 'stops/mi'],
            ['Volume-to-capacity ratio', fmt(results.vc_ratio, 2), ''],
            ['Traveler perception score (Equations 18-17 to 18-22)', fmt(results.perception_score, 2), ''],
          ],
        },
        summary: [
          { label: 'Travel speed', value: `${fmt(results.travel_speed, 2)} mi/h` },
          { label: 'Segment LOS (Exhibit 18-1)', value: results.los },
        ],
        methodology: [
          'HCM Chapter 18 methodology for the motorized vehicle mode: base free-flow speed from the cross-section, access-point, and on-street parking adjustments (Equation 18-3 and Exhibit 18-11), the signal-spacing adjustment to free-flow speed (Equations 18-4 and 18-5), segment running time including the access-point turning-delay term (Equations 18-6 and 18-7), travel speed from running time plus through control delay (Equation 18-8), stop rate (Equation 18-16), and the traveler perception score (Equations 18-17 through 18-22).',
          `Access-point delay term Σ d_ap,i taken from the ${ap_source === 'measured' ? 'measured or published per-point delays supplied on the form' : ap_source === 'computed' ? 'Chapter 30, Section 4 procedure (Equations 30-31 through 30-68), computed from the approach turn volumes, lane configuration, and opposing flow of each access point' : 'Exhibit 18-13 planning-level estimate, from the influential access-point count and the access turn percentages'}. The method allows all three sources and this page exposes all three.`,
          'Boundary-intersection through control delay, capacity, and stop rate are inputs to this chapter per Exhibit 18-5, produced by the Chapter 19, 20, 21, or 22 analysis of that intersection.',
        ],
        diagram: {
          kind: 'urban-segment',
          props: {
            segmentLength: Number(segment_length),
            nThroughLanes: Number(n_through_lanes),
            accessSubject: Number(access_points_subject),
            accessOpposing: Number(access_points_opposing),
            throughDemand: Number(through_demand),
            pctCurb: Number(pct_curb),
            pctParking: Number(pct_parking),
            control,
            los: results.los
          }
        },
      });
    } catch (err) {
      console.error('Chapter 18 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    segment_length = 1800;
    n_through_lanes = 2;
    speed_limit = 35;
    upstream_width = 50;
    restrictive_median_length = 0;
    pct_curb = 70;
    pct_parking = 0;
    access_points_subject = 4;
    access_points_opposing = 4;
    pct_opposing_left_accessible = 100;
    signal_spacing = 1800;
    ffs_override = '';
    through_demand = 968;
    midsegment_flow = 1150;
    control = 'signalized';
    through_delay = 18.31;
    through_capacity = 1848;
    cycle_length = 100;
    effective_green = 48.63;
    platoon_ratio = '';
    sat_flow = '';
    stop_rate_override = 0.547;
    pct_left_turn_lanes = 33;
    ap_source = 'measured';
    ap_delays = '0.193, 0.194';
    n_influential_access_points = '';
    pct_left_turns_access = '';
    pct_right_turns_access = '';
    access_left_bay_adequate = false;
    access_right_bay_adequate = false;
    ap_approaches = defaultApproaches();
    analysis_period = 0.25;
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 18</span>
    <h1 class="page-title">Urban Street Segments</h1>
    <p class="page-sub">
      Estimate free-flow speed, travel speed, stop rate, and level of service
      for one direction of travel on an urban street segment.
    </p>
  </header>

  <div class="alert alert-warning shadow-sm mb-6 beta-note" role="note">
    <span>
      <strong>Scope.</strong> The compute engine is boundary-validated against HCM
      Chapter 30, Example Problem 1 (Exhibits 30-26 through 30-36), which the page
      defaults reproduce, and against all three access-point delay sources the
      method allows. The page itself is in beta pending final inspection. Verify
      results independently before relying on them in engineering work, and please
      <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm18" onsubmit={preventDefault(runAnalysis)} inert={!ready}>
    <!-- Segment diagram -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Segment</h2>
          <p class="panel-sub">The subject direction of travel runs left to right between the two boundary intersections. In the 2D view the through demand and the access-point counts can be edited directly on the diagram.</p>
        </div>
        <div class="panel-actions">
          <ViewToggle bind:mode={diagramMode} label="Segment view mode" />
        </div>
      </div>
      {#if diagramMode === '3d'}
        <UrbanSegmentDiagram3D
          nThroughLanes={n_through_lanes}
          accessSubject={access_points_subject}
          accessOpposing={access_points_opposing}
          {control}
          los={results ? results.los : null} />
      {:else}
        <UrbanSegmentDiagram
          segmentLength={segment_length}
          nThroughLanes={n_through_lanes}
          bind:accessSubject={access_points_subject}
          bind:accessOpposing={access_points_opposing}
          bind:throughDemand={through_demand}
          pctCurb={pct_curb}
          pctParking={pct_parking}
          {control}
          los={results ? results.los : null} />
      {/if}
    </section>

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
            <input id="LEN_input" type="number" min="1" class="input input-bordered input-sm" bind:value={segment_length} placeholder="1800" required />
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
            <input id="UPW_input" type="number" min="0" class="input input-bordered input-sm" bind:value={upstream_width} placeholder="50" required />
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
            <input id="CURB_input" type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={pct_curb} placeholder="70" required />
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
            <input id="APS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={access_points_subject} placeholder="4" required />
            <span class="unit">pts</span>
          </div>
        </div>

        <div class="param-field">
          <label for="APO_input">Access Points (opposing side)</label>
          <div class="cell-field">
            <input id="APO_input" type="number" min="0" class="input input-bordered input-sm" bind:value={access_points_opposing} placeholder="4" required />
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
            <input id="DEM_input" type="number" min="0" class="input input-bordered input-sm" bind:value={through_demand} placeholder="968" required />
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

    <!-- Access-point delay -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Access-Point Turning Delay</h2>
          <p class="panel-sub">The Σ d_ap,i term of Equation 18-7, the delay through traffic suffers from vehicles turning at midsegment access points.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="APSRC_input">Delay Source</label>
          <select id="APSRC_input" class="select select-bordered select-sm" bind:value={ap_source}>
            <option value="measured">Measured / published delays</option>
            <option value="computed">Computed (Chapter 30 §4)</option>
            <option value="planning">Planning estimate (Exhibit 18-13)</option>
          </select>
          <p class="param-hint">The three sources the method allows. The computed procedure (Equations 30-31 through 30-68) derives each per-point delay from the approach turn volumes, lane configuration, and opposing flow.</p>
        </div>

        {#if ap_source === 'computed'}
          <div class="param-field">
            <label for="APT_input">Analysis Period T</label>
            <div class="cell-field">
              <!-- step="any": a fixed step rejects the 0.25 default as a step
                   mismatch, which blocks the form submit with no error. -->
              <input id="APT_input" type="number" step="any" min="0.01" class="input input-bordered input-sm" bind:value={analysis_period} placeholder="0.25" />
              <span class="unit">h</span>
            </div>
            <p class="param-hint">Equations 30-48 and 30-51. Read only by this source.</p>
          </div>
        {:else if ap_source === 'measured'}
          <div class="param-field">
            <label for="APD_input">Per-Point Delays</label>
            <div class="cell-field">
              <input id="APD_input" type="text" class="input input-bordered input-sm" bind:value={ap_delays} placeholder="0.193, 0.194" />
              <span class="unit">s/veh</span>
            </div>
            <p class="param-hint">One value per active access point, comma separated. The defaults are the Exhibit 30-35 published values for Example Problem 1.</p>
          </div>
        {:else}
          <div class="param-field">
            <label for="NAP_input">Influential Access Points N_ap</label>
            <div class="cell-field">
              <input id="NAP_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={n_influential_access_points} placeholder="N_ap,s + p_ap,lt × N_ap,o" />
              <span class="unit">pts</span>
            </div>
            <p class="param-hint">Fractional values are allowed. Blank uses the access-point counts above.</p>
          </div>

          <div class="param-field">
            <label for="APLT_input">Access Left Turns</label>
            <div class="cell-field">
              <input id="APLT_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={pct_left_turns_access} placeholder="10" />
              <span class="unit">%</span>
            </div>
            <p class="param-hint">Share of midsegment flow turning left at access points. Blank uses the Exhibit 18-13 baseline of 10%.</p>
          </div>

          <div class="param-field">
            <label for="APRT_input">Access Right Turns</label>
            <div class="cell-field">
              <input id="APRT_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={pct_right_turns_access} placeholder="10" />
              <span class="unit">%</span>
            </div>
          </div>

          <div class="param-field">
            <label for="APLB_input">
              <input id="APLB_input" type="checkbox" class="checkbox checkbox-sm" bind:checked={access_left_bay_adequate} />
              Adequate Left-Turn Bays
            </label>
            <p class="param-hint">An adequate bay keeps left-turning vehicles out of the through lane.</p>
          </div>

          <div class="param-field">
            <label for="APRB_input">
              <input id="APRB_input" type="checkbox" class="checkbox checkbox-sm" bind:checked={access_right_bay_adequate} />
              Adequate Right-Turn Bays
            </label>
          </div>
        {/if}
      </div>

      {#if ap_source === 'computed'}
        <div class="panel-head ap-head">
          <div>
            <h3 class="panel-title ap-title">Access-Point Approaches</h3>
            <p class="panel-sub">One row per major-street approach the through movement passes, in the subject direction. Volumes are the turn-in movements at the access point.</p>
          </div>
          <div class="panel-actions">
            <button class="btn btn-ghost btn-sm" type="button" onclick={addApproach}>Add Approach</button>
          </div>
        </div>
        <div class="w-full overflow-x-auto">
          <table class="table seg-table w-full">
            <thead>
              <tr>
                <th>#</th>
                <th title="Left-turn demand flow rate v_lt from the major street into the access point">v_lt (veh/h)</th>
                <th title="Through demand flow rate v_th on the major-street approach">v_th (veh/h)</th>
                <th title="Right-turn demand flow rate v_rt from the major street into the access point">v_rt (veh/h)</th>
                <th title="Lanes in the shared left-turn/through lane group">N_sl</th>
                <th title="Lanes in the exclusive-through lane group">N_t</th>
                <th title="Lanes in the shared right-turn/through lane group">N_sr</th>
                <th title="Opposing through plus opposing right turn, Equation 30-35">v_o (veh/h)</th>
                <th title="Left-turn bay provided on the major street">L Bay</th>
                <th title="Right-turn bay provided on the major street">R Bay</th>
                <th title="Lanes in the left-turn bay N_lt">N_lt</th>
                <th title="Available left-turn bay storage L_a,lt, Equation 30-54">Bay Storage (ft)</th>
                <th title="Percent heavy vehicles P_HV, Equation 30-15">P_HV (%)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each ap_approaches as a, i}
                <tr>
                  <td>{i + 1}</td>
                  <td><input id={"AVLT_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" aria-label={"Approach " + (i + 1) + " left-turn volume"} bind:value={ap_approaches[i].v_lt} required /></td>
                  <td><input id={"AVTH_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" aria-label={"Approach " + (i + 1) + " through volume"} bind:value={ap_approaches[i].v_th} required /></td>
                  <td><input id={"AVRT_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" aria-label={"Approach " + (i + 1) + " right-turn volume"} bind:value={ap_approaches[i].v_rt} required /></td>
                  <td><input id={"ANSL_input_" + i} type="number" min="0" max="6" class="input input-bordered input-sm" aria-label={"Approach " + (i + 1) + " shared left-through lanes"} bind:value={ap_approaches[i].n_sl} required /></td>
                  <td><input id={"ANT_input_" + i} type="number" min="0" max="6" class="input input-bordered input-sm" aria-label={"Approach " + (i + 1) + " exclusive through lanes"} bind:value={ap_approaches[i].n_t} required /></td>
                  <td><input id={"ANSR_input_" + i} type="number" min="0" max="6" class="input input-bordered input-sm" aria-label={"Approach " + (i + 1) + " shared right-through lanes"} bind:value={ap_approaches[i].n_sr} required /></td>
                  <td><input id={"AVO_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" aria-label={"Approach " + (i + 1) + " opposing flow"} bind:value={ap_approaches[i].opposing_flow_veh_h} required /></td>
                  <td><input id={"ALB_input_" + i} type="checkbox" class="checkbox checkbox-sm" aria-label={"Approach " + (i + 1) + " left-turn bay"} bind:checked={ap_approaches[i].left_turn_bay} /></td>
                  <td><input id={"ARB_input_" + i} type="checkbox" class="checkbox checkbox-sm" aria-label={"Approach " + (i + 1) + " right-turn bay"} bind:checked={ap_approaches[i].right_turn_bay} /></td>
                  <td><input id={"ANLT_input_" + i} type="number" min="0" max="4" class="input input-bordered input-sm" aria-label={"Approach " + (i + 1) + " left-turn bay lanes"} bind:value={ap_approaches[i].n_lt_lanes} required /></td>
                  <td><input id={"ABS_input_" + i} type="number" step="1" min="0" class="input input-bordered input-sm" aria-label={"Approach " + (i + 1) + " left bay storage"} bind:value={ap_approaches[i].left_bay_storage_ft} required /></td>
                  <td><input id={"APHV_input_" + i} type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" aria-label={"Approach " + (i + 1) + " percent heavy vehicles"} bind:value={ap_approaches[i].pct_heavy_veh} required /></td>
                  <td><button class="btn btn-ghost btn-sm" type="button" onclick={() => removeApproach(i)} disabled={ap_approaches.length <= 1}>Remove</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="param-hint panel-note">
          The defaults are the two approaches the eastbound through movement sees in
          Exhibit 30-35 of Example Problem 1, both undivided with two through lanes and
          no turn bays. Their computed delays reproduce the published 0.193 and 0.194
          s/veh, and with them the published travel speed of 23.67 mi/h. The right-turn
          branch is evaluated at the posted speed limit, which is what reproduces those
          published values. The access-point counts entered under Geometry still drive
          the free-flow speed adjustment f_A; the rows here drive only the Σ d_ap,i term.
        </p>

        {#if results && results.ap_computed}
          <div class="w-full overflow-x-auto ap-out">
            <table class="table seg-table w-full">
              <thead>
                <tr>
                  <th>Access Point</th>
                  <th>d_ap,l (s/veh)</th>
                  <th>d_ap,r (s/veh)</th>
                  <th>d_ap (s/veh)</th>
                  <th title="Probability of the inside through lane being blocked, Equation 30-53">p_ov</th>
                </tr>
              </thead>
              <tbody>
                {#each results.ap_computed as d, i}
                  <tr>
                    <td>{i + 1}</td>
                    <!-- Four decimals: the published Exhibit 30-35 pair is
                         0.193 and 0.194, and rounding 0.1947 to three would
                         print 0.195 and read as a disagreement. -->
                    <td>{fmt(d.delay_left_s, 4)}</td>
                    <td>{fmt(d.delay_right_s, 4)}</td>
                    <td>{fmt(d.delay_total_s, 4)}</td>
                    <td>{fmt(d.prob_inside_lane_blocked, 3)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
            <p class="param-hint panel-note">Computed per access point by Equations 30-31 through 30-68. Their sum is the Σ d_ap,i reported under Outputs, which is why it reads 0.388 against the 0.387 of the published pair.</p>
          </div>
        {/if}
      {/if}
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
              <input id="DEL_input" type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={through_delay} placeholder="18.31" required />
              <span class="unit">s/veh</span>
            </div>
            <p class="param-hint">From the Chapter 19, 21, or 22 analysis of the intersection.</p>
          </div>
        {/if}

        <div class="param-field">
          <label for="CAP_input">Through Capacity (optional)</label>
          <div class="cell-field">
            <input id="CAP_input" type="number" min="0" class="input input-bordered input-sm" bind:value={through_capacity} placeholder="1848" />
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
              <input id="GRN_input" type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={effective_green} placeholder="48.63" />
              <span class="unit">s</span>
            </div>
          </div>

          <div class="param-field">
            <label for="PR_input">Platoon Ratio (optional)</label>
            <div class="cell-field">
              <input id="PR_input" type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={platoon_ratio} placeholder="uniform arrivals" />
            </div>
            <p class="param-hint">Blank gives uniform arrivals, P = g/C. Use 1.333 for favorable progression.</p>
          </div>

          <div class="param-field">
            <label for="SAT_input">Adjusted Saturation Flow Rate (optional)</label>
            <div class="cell-field">
              <input id="SAT_input" type="number" min="0" class="input input-bordered input-sm" bind:value={sat_flow} placeholder="HCM default" />
              <span class="unit">veh/h/ln</span>
            </div>
          </div>
        {/if}

        <div class="param-field">
          <label for="STP_input">Full Stop Rate (optional)</label>
          <div class="cell-field">
            <input id="STP_input" type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={stop_rate_override} placeholder="0.547" />
            <span class="unit">stops/veh</span>
          </div>
          <p class="param-hint">Supply a value from an HCM computational engine. Unsignalized boundaries use the HCM defaults when blank.</p>
        </div>

        <div class="param-field">
          <label for="PLTL_input">Intersections with Left-Turn Lanes</label>
          <div class="cell-field">
            <input id="PLTL_input" type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={pct_left_turn_lanes} placeholder="33" required />
            <span class="unit">%</span>
          </div>
          <p class="param-hint">Used by the traveler perception score.</p>
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
        <tbody>
          <tr>
            <th>Base Free-Flow Speed (mi/hr):</th>
            <td>{results ? fmt(results.base_ffs, 2) : ''}</td>
          </tr>
          <tr>
            <th>Free-Flow Speed (mi/hr):</th>
            <td>{results ? fmt(results.free_flow_speed, 2) : ''}</td>
          </tr>
          <tr>
            <th>Access-Point Delay (s/veh):</th>
            <td>{results ? fmt(results.access_point_delay, 3) : ''}</td>
          </tr>
          <tr>
            <th>Segment Running Time (s):</th>
            <td>{results ? fmt(results.running_time, 2) : ''}</td>
          </tr>
          <tr>
            <th>Segment Running Speed (mi/hr):</th>
            <td>{results ? fmt(results.running_speed, 2) : ''}</td>
          </tr>
          <tr>
            <th>Through Delay (s/veh):</th>
            <td>{results ? fmt(results.through_delay, 2) : ''}</td>
          </tr>
          <tr>
            <th>Travel Speed (mi/hr):</th>
            <td>{results ? fmt(results.travel_speed, 2) : ''}</td>
          </tr>
          <tr>
            <th>Full Stop Rate (stops/veh):</th>
            <td>{results ? fmt(results.full_stop_rate, 3) : ''}</td>
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

<style>
  /* The approach table and its readout sit inside the access-point panel, so
     they need the separation a sibling panel would have given them. */
  .ap-head { margin-top: 1.25rem; }
  .ap-title { font-size: 1rem; }
  .ap-out { margin-top: 1rem; }
  /* .param-hint is sized for the 16rem column of a single field; a note that
     runs the width of a table needs the room. */
  .panel-note { max-width: 46rem; }
</style>
