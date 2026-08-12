<svelte:head>
  <title>Freeway Facilities Core Methodology · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmFacilitySegment, WasmFreewayFacility, WasmManagedLaneFacility } from "HCM-middleware";
  import { setReport } from '$lib/report';
  import ViewToggle from '$lib/ViewToggle.svelte';
  import FacilityDiagram from '$lib/FacilityDiagram.svelte';
  import FacilityDiagram3D from '$lib/FacilityDiagram3D.svelte';
  import { onMount } from "svelte";

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Facility-wide inputs (defaults follow the HCM Chapter 10 base conditions)
  let ffs = $state(60);
  let hv_pct = $state(5);
  let terrain = $state('level');
  let city_type = $state('urban');
  let phf = $state(1.0);
  let jam_density = $state(190);
  let queue_discharge_drop = $state(7);
  let total_ramp_density = $state(1.0);
  let interchange_density = $state('');

  // Mainline entry demand, one value per 15-min analysis period
  let mainline_demand = $state('4000, 4400, 4800, 4400');

  // The work zone panel opens on these, the Segment 11 work zone of the
  // library fixture case4.json (HCM Chapter 25, Example Problem 4): a
  // three-to-two closure behind plastic drums, urban, daylight. The engine's
  // own WorkZone::default() differs (hard barrier, 6 ft lateral, 13.4% drop),
  // so these are shown in the panel rather than left implicit.
  function defaultWorkZone() {
    return {
      total_lanes: '3',
      open_lanes: '2',
      soft_barrier: true,
      rural: false,
      lateral_distance_ft: '0',
      night: false,
      speed_ratio: '1.0909',
      speed_limit_mi_h: '55',
      total_ramp_density: '1.0',
      queue_discharge_drop: '13.1'
    };
  }

  function blankSegment(num) {
    return { seg_num: num, seg_type: 'Basic', length_ft: '5280', lanes: '3', on_ramp: '', off_ramp: '', ramp_to_ramp: '', ramp_ffs: '40', accel: '500', decel: '500', short_length: '', weaving_lanes: '2', lc_rf: '1', lc_fr: '1', work_zone: null, ml_lane_type: 'ContinuousAccess', ml_lanes: '1' };
  }

  function defaultSegments() {
    return [
      { ...blankSegment(1) },
      { ...blankSegment(2), seg_type: 'Merge', length_ft: '1500', on_ramp: '450, 540, 630, 360' },
      { ...blankSegment(3) }
    ];
  }

  let segments = $state(defaultSegments());

  function addSegment() {
    segments = [...segments, blankSegment(segments.length + 1)];
  }

  // A work zone is opt-in per segment. `work_zone: null` means the page never
  // calls set_work_zone for that segment, which matters because the binding's
  // defaults describe a real three-to-two closure rather than a no-op.
  function toggleWorkZone(i) {
    segments[i].work_zone = segments[i].work_zone ? null : defaultWorkZone();
  }

  function removeSegment() {
    if (segments.length > 1) {
      segments = segments.slice(0, segments.length - 1);
    }
  }

  // Field names must match the library's WorkZone serde schema exactly:
  // unknown fields are ignored rather than rejected, so a typo would silently
  // fall back to the engine default.
  function workZoneConfig(wz) {
    return {
      total_lanes: Number(wz.total_lanes),
      open_lanes: Number(wz.open_lanes),
      soft_barrier: !!wz.soft_barrier,
      rural: !!wz.rural,
      lateral_distance_ft: Number(wz.lateral_distance_ft),
      night: !!wz.night,
      speed_ratio: Number(wz.speed_ratio),
      speed_limit_mi_h: Number(wz.speed_limit_mi_h),
      total_ramp_density: Number(wz.total_ramp_density),
      queue_discharge_drop: Number(wz.queue_discharge_drop) / 100.0   // UI takes percent, the engine takes a decimal
    };
  }

  function parseList(text) {
    return String(text)
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map(Number)
      .filter((v) => Number.isFinite(v));
  }

  // Adjacent managed lane (HCM Chapter 10 Steps A-9/A-13/A-14/A-17, Chapter 25
  // Section 2). Off by default; the defaults below are the ml_case1.json
  // fixture (Example Problem 5), a one-lane continuous-access ML the whole
  // length of the facility.
  let ml_enabled = $state(false);
  let ml_ffs = $state(60);
  let ml_entry_demand = $state('1000, 1100, 1160, 1040, 840');

  function mlDefaults() {
    ml_ffs = 60;
    ml_entry_demand = '1000, 1100, 1160, 1040, 840';
    for (const s of segments) {
      s.ml_lane_type = 'ContinuousAccess';
      s.ml_lanes = '1';
    }
  }

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  let diagramMode = $state('2d');
  let selectedSeg = $state(-1);

  // Drawn from the form rather than from the results, so the ML band appears
  // as soon as the section is enabled instead of only after a run.
  let mlLanesForDiagram = $derived(ml_enabled
    ? segments.map((s) => (s.ml_lane_type ? Number(s.ml_lanes) : 0))
    : null);

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const demand = parseList(mainline_demand);
      if (demand.length === 0) {
        throw new Error('Enter at least one mainline demand value.');
      }

      const wasmSegments = segments.map((s) => {
        const seg = new WasmFacilitySegment(
          s.seg_type,
          Number(s.length_ft),
          Number(s.lanes),
          parseList(s.on_ramp),
          parseList(s.off_ramp),
          parseList(s.ramp_to_ramp),
          Number(s.ramp_ffs),
          Number(s.accel),
          Number(s.decel),
          s.short_length !== '' ? Number(s.short_length) : undefined,
          Number(s.weaving_lanes),
          Number(s.lc_rf),
          Number(s.lc_fr),
          undefined,             // segment FFS override, mi/h
          undefined,             // calibration CAF
          undefined,             // calibration SAF
          undefined              // calibration DAF
        );
        // Only when the user opened the panel: set_work_zone({}) would place a
        // real three-to-two closure, so an unconditional call is not a no-op.
        if (s.work_zone) {
          seg.set_work_zone(workZoneConfig(s.work_zone));
        }
        return seg;
      });

      const fac = new WasmFreewayFacility(
        wasmSegments,
        demand,
        Number(ffs),
        Number(hv_pct) / 100.0,           // UI takes percent, the engine takes a decimal
        terrain,
        city_type,
        Number(phf),
        Number(jam_density),
        Number(queue_discharge_drop) / 100.0,
        Number(total_ramp_density),
        interchange_density !== '' ? Number(interchange_density) : undefined
      );

      // With a managed lane the facility is the two lane groups combined, so
      // the general-purpose matrices come from the ML wrapper's GP snapshot
      // (which carries the Step A-9 cross-weave CAF) rather than from `fac`.
      let mlFac = null;
      let gpFac = fac;
      if (ml_enabled) {
        mlFac = WasmManagedLaneFacility.from_gp(fac, {
          ml: segments.map((s) => (s.ml_lane_type
            ? { lane_type: s.ml_lane_type, lanes: Number(s.ml_lanes) }
            : null)),
          ml_entry_demand: parseList(ml_entry_demand),
          ml_ffs: Number(ml_ffs)
        });
        mlFac.run_analysis();
        gpFac = mlFac.gp_facility();
      } else {
        fac.run_analysis();
      }

      const periods = ml_enabled ? mlFac.num_periods() : fac.num_periods();
      const perPeriod = [];
      for (let p = 0; p < periods; p++) {
        const src = ml_enabled ? mlFac : fac;
        perPeriod.push({
          speed: src.get_facility_speed(p),
          density: src.get_facility_density_veh(p),
          los: src.get_facility_los(p)
        });
      }

      results = {
        perPeriod,
        losMatrix: gpFac.los_matrix(),
        densityMatrix: gpFac.density_matrix(),
        capacityMatrix: gpFac.capacity_matrix(),
        dcMatrix: gpFac.dc_matrix(),
        overall_speed: gpFac.get_overall_speed(),
        overall_density: gpFac.get_overall_density_veh(),
        oversaturated: gpFac.is_oversaturated(),
        total_length: gpFac.total_length_mi(),
        // Which segments carry a work zone, so the outputs can mark them
        // without the reader going back to the form.
        workZoneSegs: segments.map((s) => !!s.work_zone),
        ml: null
      };

      if (ml_enabled) {
        const lanes = segments.map((s) => (s.ml_lane_type ? Number(s.ml_lanes) : 0));
        const groups = [];
        for (let p = 0; p < periods; p++) {
          groups.push({
            gp: { speed: mlFac.get_gp_group_speed(p), density: mlFac.get_gp_group_density_veh(p), los: mlFac.get_gp_group_los(p) },
            ml: { speed: mlFac.get_ml_group_speed(p), density: mlFac.get_ml_group_density_veh(p), los: mlFac.get_ml_group_los(p) }
          });
        }
        results.ml = {
          lanes,
          groups,
          capacityMatrix: mlFac.ml_capacity_matrix(),
          dcMatrix: mlFac.ml_dc_matrix(),
          speedMatrix: mlFac.ml_speed_matrix(),
          densityMatrix: mlFac.ml_density_matrix(),
          losMatrix: mlFac.ml_los_matrix(),
          frictionMatrix: mlFac.ml_friction_matrix()
        };
      }

      const worstLos = perPeriod.reduce((w, p) => (p.los > w ? p.los : w), 'A');
      const wzNums = segments.filter((s) => s.work_zone).map((s) => s.seg_num);
      setReport({
        chapter: 'Freeway Facilities Core Methodology',
        chapterRef: 'HCM Chapter 10',
        href: '/hcm10',
        generatedAt: new Date().toLocaleString(),
        headline: { label: 'Facility LOS (worst period)', value: worstLos },
        inputs: [
          { label: 'Free-flow speed', value: `${ffs} mi/h` },
          { label: 'Heavy vehicles', value: `${hv_pct} %` },
          { label: 'Terrain', value: terrain },
          { label: 'Area type', value: city_type },
          { label: 'Peak hour factor', value: phf },
          { label: 'Jam density', value: `${jam_density} pc/mi/ln` },
          { label: 'Queue discharge capacity drop', value: `${queue_discharge_drop} %` },
          { label: 'Total ramp density', value: `${total_ramp_density} /mi` },
          { label: 'Interchange density', value: interchange_density !== '' ? `${interchange_density} /mi` : 'total ramp density' },
          { label: 'Mainline entry demand', value: `${mainline_demand} veh/h` },
          { label: 'Segments (upstream to downstream)', value: segments.map((s) => `${s.seg_type} ${s.length_ft} ft x${s.lanes}`).join(', ') },
          ...segments.flatMap((s) => (s.work_zone
            ? [{
                label: `Work zone, segment ${s.seg_num}`,
                value: `${s.work_zone.total_lanes} to ${s.work_zone.open_lanes} lanes, ${s.work_zone.soft_barrier ? 'soft barrier' : 'hard barrier'}, ${s.work_zone.rural ? 'rural' : 'urban'}, ${s.work_zone.night ? 'night' : 'daylight'}, ${s.work_zone.lateral_distance_ft} ft lateral, speed limit ${s.work_zone.speed_limit_mi_h} mi/h, speed ratio ${s.work_zone.speed_ratio}, queue discharge drop ${s.work_zone.queue_discharge_drop} %`
              }]
            : [])),
          ...(ml_enabled ? [
            { label: 'Managed lane free-flow speed', value: `${ml_ffs} mi/h` },
            { label: 'Managed lane entry demand', value: `${ml_entry_demand} veh/h` },
            { label: 'Managed lane cross section', value: segments.map((s) => `${s.seg_num}: ${s.ml_lane_type ? `${s.ml_lane_type} x${s.ml_lanes}` : 'none'}`).join(', ') },
          ] : []),
        ],
        resultTable: {
          columns: ['Period', 'Space mean speed (mi/h)', 'Average density (veh/mi/ln)', 'LOS'],
          rows: results.perPeriod.map((p, i) => [`${i + 1}`, p.speed.toFixed(1), p.density.toFixed(1), p.los]),
        },
        // Geometry copy of the strip. Deep-copied because the report is
        // JSON-persisted to sessionStorage while `segments` keeps mutating.
        diagram: {
          kind: 'freeway-facility',
          props: {
            segments: JSON.parse(JSON.stringify(segments)),
            mlLanes: mlLanesForDiagram ? [...mlLanesForDiagram] : null,
            note: `Segment chain, upstream to downstream. Widths follow segment length.${wzNums.length ? ` Hatched lanes are closed by the work zone on segment ${wzNums.join(', ')}.` : ''}`,
          },
        },
        summary: [
          { label: 'Facility length', value: `${results.total_length.toFixed(2)} mi` },
          { label: 'Overall space mean speed', value: `${results.overall_speed.toFixed(1)} mi/h` },
          { label: 'Overall density', value: `${results.overall_density.toFixed(1)} veh/mi/ln` },
          { label: 'Oversaturated', value: results.oversaturated ? 'Yes, demand exceeds capacity somewhere in the time-space domain' : 'No' },
          ...(results.ml ? results.ml.groups.map((g, p) => ({
            label: `Period ${p + 1} lane groups`,
            value: `GP ${g.gp.speed.toFixed(1)} mi/h, ${g.gp.density.toFixed(1)} veh/mi/ln, LOS ${g.gp.los}; ML ${g.ml.speed.toFixed(1)} mi/h, ${g.ml.density.toFixed(1)} veh/mi/ln, LOS ${g.ml.los}`
          })) : []),
        ],
        methodology: [
          'HCM Chapter 10 core methodology: each segment analyzed per its own chapter (12, 13, 14) per 15-min period, with oversaturated periods handled by the Chapter 25 queue-tracking procedure on a time-space domain.',
          'On an oversaturated facility the placement of a queue among upstream segments can differ from the published engine while the facility totals agree.',
          ...(segments.some((s) => s.work_zone)
            ? ['Work zone segments carry the Chapter 10 Section 4 adjustments (Equations 10-7 through 10-12): the lane closure severity index sets a work zone queue discharge rate and prebreakdown capacity, which enter the segment as CAF_wz and SAF_wz. The capacity reported for a work zone segment is the post-CAF value.']
            : []),
          ...(ml_enabled
            ? ['The managed lane is analyzed as a parallel lane group (Chapter 25, Section 2). The general-purpose side carries the Step A-9 cross-weave capacity adjustment and the managed lane carries the Step A-13 adjacent-friction speed reduction, which applies to continuous-access and Buffer 1 lanes where the adjacent general-purpose density exceeds 35 pc/mi/ln. Facility values combine the two groups by lane miles (Equation 10-1).']
            : []),
        ],
      });
    } catch (err) {
      console.error('Chapter 10 analysis failed:', err);
      hasError = true;
      errMessage = typeof err === 'string'
        ? err
        : (err && err.message) || 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    ffs = 60;
    hv_pct = 5;
    terrain = 'level';
    city_type = 'urban';
    phf = 1.0;
    jam_density = 190;
    queue_discharge_drop = 7;
    total_ramp_density = 1.0;
    interchange_density = '';
    mainline_demand = '4000, 4400, 4800, 4400';
    segments = defaultSegments();
    ml_enabled = false;
    ml_ffs = 60;
    ml_entry_demand = '1000, 1100, 1160, 1040, 840';
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 10</span>
    <h1 class="page-title">Freeway Facilities Core Methodology</h1>
    <p class="page-sub">
      Evaluate a directional freeway facility of basic, merge, diverge, weaving, and
      overlapping ramp segments over consecutive 15-min analysis periods. Covers the
      mixed-flow core methodology, optional per-segment work zones, and an optional
      adjacent managed lane analyzed as a parallel lane group.
    </p>
  </header>

  <div class="alert alert-info shadow-sm mb-6 beta-note" role="note">
    <span>
      The compute engine reproduces the published HCM worked examples for this
      chapter at the facility level. On an oversaturated facility the placement of
      a queue among upstream segments can differ from the published engine while
      the facility totals agree. Verify results independently before relying on
      them in engineering work, and please <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm10" onsubmit={preventDefault(runAnalysis)}>
    <!-- Facility -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Facility</h2>
          <p class="panel-sub">Values that apply to the whole facility in the analysis direction.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="FFS_input">Free-Flow Speed</label>
          <div class="cell-field">
            <input id="FFS_input" type="number" min="55" max="75" class="input input-bordered input-sm" bind:value={ffs} placeholder="60" required />
            <span class="unit">mi/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="HV_input">Heavy Vehicles</label>
          <div class="cell-field">
            <input id="HV_input" type="number" step="0.01" min="0" max="100" class="input input-bordered input-sm" bind:value={hv_pct} placeholder="5" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="TERRAIN_input">Terrain</label>
          <select id="TERRAIN_input" class="select select-bordered select-sm" bind:value={terrain}>
            <option value="level">Level</option>
            <option value="rolling">Rolling</option>
            <option value="mountainous">Mountainous</option>
          </select>
        </div>

        <div class="param-field">
          <label for="CITY_input">Area Type</label>
          <select id="CITY_input" class="select select-bordered select-sm" bind:value={city_type}>
            <option value="urban">Urban</option>
            <option value="rural">Rural</option>
          </select>
        </div>

        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="1.00" required />
          </div>
          <p class="param-hint">Use 1.00 when the demand values are true 15-min flow rates.</p>
        </div>

        <div class="param-field">
          <label for="JAM_input">Jam Density</label>
          <div class="cell-field">
            <input id="JAM_input" type="number" min="100" class="input input-bordered input-sm" bind:value={jam_density} placeholder="190" required />
            <span class="unit">pc/mi/ln</span>
          </div>
        </div>

        <div class="param-field">
          <label for="QDROP_input">Queue Discharge Capacity Drop</label>
          <div class="cell-field">
            <input id="QDROP_input" type="number" step="0.5" min="0" max="30" class="input input-bordered input-sm" bind:value={queue_discharge_drop} placeholder="7" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="TRD_input">Total Ramp Density</label>
          <div class="cell-field">
            <input id="TRD_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={total_ramp_density} placeholder="1.0" required />
            <span class="unit">/mi</span>
          </div>
        </div>

        <div class="param-field">
          <label for="ID_input">Interchange Density</label>
          <div class="cell-field">
            <input id="ID_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={interchange_density} placeholder="" />
            <span class="unit">/mi</span>
          </div>
          <p class="param-hint">Used by weaving segments. Blank uses the total ramp density.</p>
        </div>
      </div>
    </section>

    <!-- Demand -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Demand</h2>
          <p class="panel-sub">Mainline demand entering the facility, one value per 15-min analysis period.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="DEMAND_input">Mainline Entry Demand</label>
          <div class="cell-field">
            <input id="DEMAND_input" type="text" class="input input-bordered input-sm demand-wide" bind:value={mainline_demand} placeholder="4000, 4400, 4800, 4400" required />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">Comma-separated list. The number of values sets the number of analysis periods.</p>
        </div>
      </div>
    </section>

    <!-- Segments -->
    <section class="panel">
      <div class="panel-head with-actions">
        <div>
          <h2 class="panel-title">Segments</h2>
          <p class="panel-sub">Ordered upstream to downstream. The facility must begin and end with a basic segment. Ramp demand lists carry one value per analysis period and missing values count as zero.</p>
        </div>
        <div class="panel-actions">
          <button class="btn btn-outline btn-sm" onclick={addSegment} type="button">+ Add Segment</button>
          <button class="btn btn-ghost btn-sm" onclick={removeSegment} type="button">Remove</button>
        </div>
      </div>

      <!-- Facility builder view: the segment chain drawn upstream to downstream,
           colored per-segment LOS by analysis period after a run. -->
      <div class="diagram-block">
        <div class="diagram-toggle-row">
          <ViewToggle bind:mode={diagramMode} label="Facility view" />
        </div>
        {#if diagramMode === '2d'}
          <FacilityDiagram
            {segments}
            losMatrix={results ? results.losMatrix : null}
            densityMatrix={results ? results.densityMatrix : null}
            mlLanes={mlLanesForDiagram}
            mlLosMatrix={results && results.ml ? results.ml.losMatrix : null}
            mlDensityMatrix={results && results.ml ? results.ml.densityMatrix : null}
            selected={selectedSeg}
            onselect={(i) => (selectedSeg = selectedSeg === i ? -1 : i)}
          />
        {:else}
          <FacilityDiagram3D {segments} losMatrix={results ? results.losMatrix : null}
            selected={selectedSeg}
            onselect={(i) => (selectedSeg = selectedSeg === i ? -1 : i)} />
        {/if}
      </div>

      <div class="w-full overflow-x-auto">
        <table class="table seg-table w-full">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Length (ft)</th>
              <th>Lanes</th>
              <th>On-Ramp Demand (veh/h)</th>
              <th>Off-Ramp Demand (veh/h)</th>
              <th>Ramp FFS (mi/h)</th>
              <th>Accel Lane (ft)</th>
              <th>Decel Lane (ft)</th>
              <th>Work Zone</th>
            </tr>
          </thead>
          <tbody>
            {#each segments as row, i (row.seg_num)}
              <tr class:seg-selected={selectedSeg === i} onclick={() => (selectedSeg = i)}>
                <td>{row.seg_num}</td>
                <td>
                  <select class="select select-bordered select-sm" bind:value={segments[i].seg_type}>
                    <option>Basic</option>
                    <option>Merge</option>
                    <option>Diverge</option>
                    <option>Weaving</option>
                    <option value="OverlappingRamp">Overlapping Ramp</option>
                  </select>
                </td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].length_ft} placeholder="5280" autocomplete="off" /></td>
                <td><input class="input input-bordered input-sm" type="number" min="1" max="8" bind:value={segments[i].lanes} placeholder="3" autocomplete="off" /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].on_ramp} placeholder="450, 540" autocomplete="off" disabled={row.seg_type !== 'Merge' && row.seg_type !== 'Weaving'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].off_ramp} placeholder="270, 360" autocomplete="off" disabled={row.seg_type !== 'Diverge' && row.seg_type !== 'Weaving'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].ramp_ffs} placeholder="40" autocomplete="off" disabled={row.seg_type === 'Basic'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].accel} placeholder="500" autocomplete="off" disabled={row.seg_type !== 'Merge' && row.seg_type !== 'OverlappingRamp'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].decel} placeholder="500" autocomplete="off" disabled={row.seg_type !== 'Diverge' && row.seg_type !== 'OverlappingRamp'} /></td>
                <td>
                  <button type="button" class="btn btn-xs wz-toggle" class:btn-outline={!row.work_zone} class:btn-warning={!!row.work_zone}
                          aria-pressed={!!row.work_zone}
                          onclick={(e) => { e.stopPropagation(); toggleWorkZone(i); }}>
                    {row.work_zone ? 'Remove work zone' : '+ Add work zone'}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Weaving details -->
      <div class="hc-subtables">
        {#each segments as row, i (row.seg_num)}
          {#if row.seg_type === 'Weaving'}
            <div class="hc-card">
              <div class="hc-card-head">
                <h3>Segment {row.seg_num} · Weaving Details</h3>
              </div>
              <div class="param-grid">
                <div class="param-field">
                  <label for="SL_input{row.seg_num}">Short Length</label>
                  <div class="cell-field">
                    <input id="SL_input{row.seg_num}" class="input input-bordered input-sm" bind:value={segments[i].short_length} placeholder="Segment length" autocomplete="off" />
                    <span class="unit">ft</span>
                  </div>
                </div>
                <div class="param-field">
                  <label for="NWL_input{row.seg_num}">Weaving Lanes</label>
                  <div class="cell-field">
                    <input id="NWL_input{row.seg_num}" type="number" min="2" max="3" class="input input-bordered input-sm" bind:value={segments[i].weaving_lanes} placeholder="2" autocomplete="off" />
                  </div>
                </div>
                <div class="param-field">
                  <label for="LCRF_input{row.seg_num}">Ramp-to-Freeway Lane Changes</label>
                  <div class="cell-field">
                    <input id="LCRF_input{row.seg_num}" type="number" min="0" class="input input-bordered input-sm" bind:value={segments[i].lc_rf} placeholder="1" autocomplete="off" />
                  </div>
                </div>
                <div class="param-field">
                  <label for="LCFR_input{row.seg_num}">Freeway-to-Ramp Lane Changes</label>
                  <div class="cell-field">
                    <input id="LCFR_input{row.seg_num}" type="number" min="0" class="input input-bordered input-sm" bind:value={segments[i].lc_fr} placeholder="1" autocomplete="off" />
                  </div>
                </div>
                <div class="param-field">
                  <label for="RR_input{row.seg_num}">Ramp-to-Ramp Demand</label>
                  <div class="cell-field">
                    <input id="RR_input{row.seg_num}" class="input input-bordered input-sm" bind:value={segments[i].ramp_to_ramp} placeholder="50, 100" autocomplete="off" />
                    <span class="unit">veh/h</span>
                  </div>
                  <p class="param-hint">One value per analysis period.</p>
                </div>
              </div>
            </div>
          {/if}
        {/each}
      </div>

      <!-- Work zone details, one card per segment the user opted in for -->
      <div class="hc-subtables">
        {#each segments as row, i (row.seg_num)}
          {#if row.work_zone}
            <div class="hc-card wz-card">
              <div class="hc-card-head">
                <h3>Segment {row.seg_num} · Work Zone</h3>
              </div>
              <p class="param-hint wz-card-note">HCM Chapter 10, Section 4 (Equations 10-7 through 10-12). Opened on the Segment 11 work zone of Example Problem 4, a three-to-two urban daylight closure behind plastic drums. These values are what the analysis uses, so edit them to describe your own closure.</p>
              <div class="param-grid">
                <div class="param-field">
                  <label for="WZTL_input{row.seg_num}">Normal Lanes Upstream</label>
                  <div class="cell-field">
                    <input id="WZTL_input{row.seg_num}" type="number" min="1" max="8" class="input input-bordered input-sm" bind:value={segments[i].work_zone.total_lanes} autocomplete="off" />
                    <span class="unit">ln</span>
                  </div>
                </div>
                <div class="param-field">
                  <label for="WZOL_input{row.seg_num}">Open Lanes Through Work Zone</label>
                  <div class="cell-field">
                    <input id="WZOL_input{row.seg_num}" type="number" min="1" max="8" class="input input-bordered input-sm" bind:value={segments[i].work_zone.open_lanes} autocomplete="off" />
                    <span class="unit">ln</span>
                  </div>
                  <p class="param-hint">Sets the lane closure severity index (Exhibit 10-15). Give the segment itself this same lane count.</p>
                </div>
                <div class="param-field">
                  <label for="WZLAT_input{row.seg_num}">Lateral Distance to Barrier</label>
                  <div class="cell-field">
                    <input id="WZLAT_input{row.seg_num}" type="number" step="0.5" min="0" max="12" class="input input-bordered input-sm" bind:value={segments[i].work_zone.lateral_distance_ft} autocomplete="off" />
                    <span class="unit">ft</span>
                  </div>
                </div>
                <div class="param-field">
                  <label for="WZSL_input{row.seg_num}">Work Zone Speed Limit</label>
                  <div class="cell-field">
                    <input id="WZSL_input{row.seg_num}" type="number" min="25" max="75" class="input input-bordered input-sm" bind:value={segments[i].work_zone.speed_limit_mi_h} autocomplete="off" />
                    <span class="unit">mi/h</span>
                  </div>
                </div>
                <div class="param-field">
                  <label for="WZSR_input{row.seg_num}">Speed Limit Ratio</label>
                  <div class="cell-field">
                    <input id="WZSR_input{row.seg_num}" type="number" step="0.0001" min="1" max="1.2" class="input input-bordered input-sm" bind:value={segments[i].work_zone.speed_ratio} autocomplete="off" />
                  </div>
                  <p class="param-hint">Non-work-zone speed limit divided by the work zone speed limit, clamped to 1.00-1.20.</p>
                </div>
                <div class="param-field">
                  <label for="WZTRD_input{row.seg_num}">Total Ramp Density</label>
                  <div class="cell-field">
                    <input id="WZTRD_input{row.seg_num}" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={segments[i].work_zone.total_ramp_density} autocomplete="off" />
                    <span class="unit">/mi</span>
                  </div>
                </div>
                <div class="param-field">
                  <label for="WZQDD_input{row.seg_num}">Queue Discharge Capacity Drop</label>
                  <div class="cell-field">
                    <input id="WZQDD_input{row.seg_num}" type="number" step="0.1" min="0" max="30" class="input input-bordered input-sm" bind:value={segments[i].work_zone.queue_discharge_drop} autocomplete="off" />
                    <span class="unit">%</span>
                  </div>
                  <p class="param-hint">Work zone alpha_wz, separate from the facility-wide drop.</p>
                </div>
                <div class="param-field wz-flags">
                  <span class="wz-flags-label">Conditions</span>
                  <label class="wz-check"><input type="checkbox" class="checkbox checkbox-sm" bind:checked={segments[i].work_zone.soft_barrier} /> Soft barrier (cones or plastic drums)</label>
                  <label class="wz-check"><input type="checkbox" class="checkbox checkbox-sm" bind:checked={segments[i].work_zone.rural} /> Rural area</label>
                  <label class="wz-check"><input type="checkbox" class="checkbox checkbox-sm" bind:checked={segments[i].work_zone.night} /> Night work</label>
                </div>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </section>

    <!-- Managed lane -->
    <section class="panel">
      <div class="panel-head with-actions">
        <div>
          <h2 class="panel-title">Adjacent Managed Lane</h2>
          <p class="panel-sub">Optional. Analyzes a parallel managed lane group alongside the general-purpose lanes (HCM Chapter 10 Steps A-9 through A-17, Chapter 25 Section 2), reporting the two lane groups and their combination. Enabling loads the Example Problem 5 managed lane, a one-lane continuous-access facility.</p>
        </div>
        <div class="panel-actions">
          <label class="ml-enable">
            <input type="checkbox" class="checkbox checkbox-sm" bind:checked={ml_enabled} onchange={() => { if (ml_enabled) mlDefaults(); }} />
            Enable managed lane
          </label>
        </div>
      </div>

      {#if ml_enabled}
        <div class="param-grid">
          <div class="param-field">
            <label for="MLFFS_input">Managed Lane Free-Flow Speed</label>
            <div class="cell-field">
              <input id="MLFFS_input" type="number" min="45" max="75" class="input input-bordered input-sm" bind:value={ml_ffs} placeholder="60" />
              <span class="unit">mi/h</span>
            </div>
          </div>
          <div class="param-field">
            <label for="MLDEMAND_input">Managed Lane Entry Demand</label>
            <div class="cell-field">
              <input id="MLDEMAND_input" type="text" class="input input-bordered input-sm demand-wide" bind:value={ml_entry_demand} placeholder="1000, 1100, 1160, 1040, 840" />
              <span class="unit">veh/h</span>
            </div>
            <p class="param-hint">One value per analysis period, matching the mainline demand list.</p>
          </div>
        </div>

        <div class="w-full overflow-x-auto">
          <table class="table ml-table w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>GP Segment</th>
                <th>Managed Lane Separation</th>
                <th>ML Lanes</th>
              </tr>
            </thead>
            <tbody>
              {#each segments as row, i (row.seg_num)}
                <tr>
                  <td>{row.seg_num}</td>
                  <td>{row.seg_type}</td>
                  <td>
                    <select class="select select-bordered select-sm" bind:value={segments[i].ml_lane_type}>
                      <option value="">No managed lane</option>
                      <option value="ContinuousAccess">Continuous access</option>
                      <option value="Buffer1">Buffer 1</option>
                      <option value="Buffer2">Buffer 2</option>
                      <option value="Barrier1">Barrier 1</option>
                      <option value="Barrier2">Barrier 2</option>
                    </select>
                  </td>
                  <td><input class="input input-bordered input-sm" type="number" min="1" max="4" bind:value={segments[i].ml_lanes} placeholder="1" autocomplete="off" disabled={!row.ml_lane_type} /></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="param-hint ml-friction-note">Only continuous-access and Buffer 1 separations are subject to the Step A-13 adjacent friction, which drops the managed lane speed where the neighbouring general-purpose density exceeds 35 pc/mi/ln (Exhibit 12-9).</p>
      {/if}
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
            <th>Facility Performance</th>
            {#if results}
              {#each results.perPeriod as _, p}
                <th>Period {p + 1}</th>
              {/each}
            {/if}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Space Mean Speed (mi/hr):</th>
            {#if results}
              {#each results.perPeriod as period}
                <td>{period.speed.toFixed(1)}</td>
              {/each}
            {/if}
          </tr>
          <tr>
            <th>Average Density (veh/mi/ln):</th>
            {#if results}
              {#each results.perPeriod as period}
                <td>{period.density.toFixed(1)}</td>
              {/each}
            {/if}
          </tr>
          <tr>
            <th>Facility LOS:</th>
            {#if results}
              {#each results.perPeriod as period}
                <td>{period.los}</td>
              {/each}
            {/if}
          </tr>
          {#if results && results.ml}
            <!-- Lane group rows (Exhibit 25-86); the facility rows above are
                 the two groups combined by lane miles (Exhibit 25-87). -->
            <tr class="lg-row">
              <th>GP Lane Group (mi/h · veh/mi/ln · LOS):</th>
              {#each results.ml.groups as g}
                <td>{g.gp.speed.toFixed(1)} · {g.gp.density.toFixed(1)} · {g.gp.los}</td>
              {/each}
            </tr>
            <tr class="lg-row">
              <th>ML Lane Group (mi/h · veh/mi/ln · LOS):</th>
              {#each results.ml.groups as g}
                <td>{g.ml.speed.toFixed(1)} · {g.ml.density.toFixed(1)} · {g.ml.los}</td>
              {/each}
            </tr>
          {/if}
        </tbody>
      </table>

      {#if results}
        <table class="table w-full">
          <thead>
            <tr>
              <th>Segment LOS</th>
              {#each results.perPeriod as _, p}
                <th>Period {p + 1}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each results.losMatrix as segRow, s}
              <tr>
                <th>Segment {s + 1} ({segments[s] ? segments[s].seg_type : ''}):</th>
                {#each segRow as los, p}
                  <td>{los} ({results.densityMatrix[s][p].toFixed(1)} veh/mi/ln)</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>

        <!-- Segment capacity and demand-to-capacity ratio. On a work zone
             segment the capacity shown is the post-CAF_wz value the ratio is
             taken against, not the lane-closure-only value. -->
        <table class="table w-full cap-table">
          <thead>
            <tr>
              <th>Segment Capacity (veh/h) and v/c</th>
              {#each results.perPeriod as _, p}
                <th>Period {p + 1}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each results.capacityMatrix as capRow, s}
              <tr class:wz-seg={results.workZoneSegs[s]}>
                <th>Segment {s + 1}{results.workZoneSegs[s] ? ' (work zone)' : ''}:</th>
                {#each capRow as cap, p}
                  <td>{cap.toFixed(0)} (v/c {results.dcMatrix[s][p].toFixed(2)})</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>

        {#if results.ml}
          <table class="table w-full ml-out-table">
            <thead>
              <tr>
                <th>Managed Lane by Segment</th>
                {#each results.perPeriod as _, p}
                  <th>Period {p + 1}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each results.ml.losMatrix as segRow, s}
                <tr>
                  <th>Segment {s + 1}{results.ml.lanes[s] ? '' : ' (no managed lane)'}:</th>
                  {#each segRow as los, p}
                    {#if results.ml.lanes[s]}
                      <td>
                        {results.ml.capacityMatrix[s][p].toFixed(0)} veh/h (v/c {results.ml.dcMatrix[s][p].toFixed(2)})<br />
                        {results.ml.speedMatrix[s][p].toFixed(1)} mi/h · {results.ml.densityMatrix[s][p].toFixed(1)} veh/mi/ln · LOS {los}{results.ml.frictionMatrix[s][p] ? ' · friction' : ''}
                      </td>
                    {:else}
                      <td>-</td>
                    {/if}
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}

      <div class="facility-summary">
        <p>Facility Length: {results ? results.total_length.toFixed(2) + ' mi' : ''}</p>
        <p>Overall Space Mean Speed: {results ? results.overall_speed.toFixed(1) + ' mi/hr' : ''}</p>
        <p>Overall Density: {results ? results.overall_density.toFixed(1) + ' veh/mi/ln' : ''}</p>
        <p>Oversaturated: {results ? (results.oversaturated ? 'Yes, demand exceeds capacity somewhere in the time-space domain' : 'No') : ''}</p>
      </div>
    </div>
  </section>
</div>

<style>
  .diagram-block { margin: 1rem auto 0; max-width: 640px; }
  .diagram-toggle-row { margin-bottom: 0.75rem; text-align: center; }
  .seg-table tbody tr { cursor: pointer; }

  .wz-toggle { white-space: nowrap; }
  .wz-card { border-left: 3px solid var(--warning, #f59e0b); }
  .wz-card-note { margin: -0.3rem 0 0.7rem; max-width: 62ch; }
  .wz-flags { display: flex; flex-direction: column; gap: 0.3rem; }
  .wz-flags-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
  .wz-check { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--text-secondary); }
  .wz-seg th { font-weight: 700; }

  .ml-enable { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; }
  .ml-friction-note { margin-top: 0.5rem; }
  .ml-out-table td { font-size: 0.78rem; line-height: 1.35; }
  .lg-row th { font-weight: 600; }
</style>
