<svelte:head>
  <title>Basic Managed Lane Segments · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmManagedLanes } from "HCM-middleware";
  import { onMount } from "svelte";
  import LosBadge from '$lib/LosBadge.svelte';
  import LosScale from '$lib/LosScale.svelte';
  import ManagedLaneDiagram from '$lib/ManagedLaneDiagram.svelte';
  import { setReport } from '$lib/report';
  import { discussion } from './discussion.js';
  import Discussion from '$lib/Discussion.svelte';

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Defaults are HCM Chapter 26, Example Problem 7 (basic managed lane segment), Case 1: a
  // continuous-access managed lane at FFS 60 mi/h carrying 1,300 veh/h, alongside a two-lane
  // general purpose carriageway carrying 2,000 veh/h, both at PHF 0.92 with 7.5% trucks on
  // level terrain. Same fixture as tests/boundary/ch12ml_managed_lanes.mjs. Entering 3,800
  // veh/h for the GP demand reproduces the example's Case 2, where the GP lanes break down
  // and the friction term switches on. NOTE: EP7's Step 4 prose says 5% trucks, but its own
  // Equation 12-10 substitution and every printed flow rate in the example use 7.5%; the
  // published f_HV of 0.93 only follows from 7.5%, so the prose figure is a book typo. Case 1
  // reproduces exactly (56.3 mi/h, 27.0 pc/mi/ln, LOS D). In Case 2 the page prints a density
  // of 36.2 where the book prints 36.3, because the book divides its rounded flow rate by its
  // rounded speed (1,519 / 41.9) while the engine divides by the unrounded 41.9094.
  let lane_type = $state('continuous_access');
  let ffs = $state(60);
  let ml_lanes = $state(1);
  let caf = $state(1.0);
  let saf = $state(1.0);

  let ml_demand = $state(1300);
  let phf = $state(0.92);
  let phv = $state(7.5);
  let terrain_type = $state('level');

  let gp_demand = $state(2000);
  let gp_lanes = $state(2);
  let gp_ffs = $state(60);
  let gp_capacity = $state(2300);
  let gp_breakpoint = $state(1600);

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  // Exhibit 12-25, general terrain. Mountainous is deliberately absent: the exhibit defines no
  // PCE for it and the HCM sends the analyst to the Chapter 25/26 mixed-flow model instead.
  const E_T = { level: 2.0, rolling: 3.0 };

  const LANE_TYPE_LABEL = {
    continuous_access: 'Continuous access',
    buffer1: 'Buffer 1, single lane',
    buffer2: 'Buffer 2, multiple lanes',
    barrier1: 'Barrier 1, single lane',
    barrier2: 'Barrier 2, multiple lanes',
  };

  // The adjacent GP lanes are a basic freeway segment, so their density comes from the
  // Chapter 12 basic-segment chain rather than from the managed-lane engine. Equation 12-1
  // with the basic-segment exponent a = 2 and the speed at capacity c/45, matching the
  // arithmetic in tests/boundary/ch12ml_managed_lanes.mjs.
  function gpSpeed(v_p, ffsGp, c, bp) {
    if (v_p <= bp) return ffsGp;
    if (v_p >= c) return c / 45.0;   // at or past capacity the curve ends at the capacity speed
    return ffsGp - (ffsGp - c / 45.0) * (v_p - bp) ** 2 / (c - bp) ** 2;
  }

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const e_t = E_T[terrain_type];
      // Equation 12-10, shared by both carriageways since EP7 gives one traffic stream mix.
      const f_hv = 1.0 / (1.0 + (Number(phv) / 100.0) * (e_t - 1.0));

      // Equation 12-9, demand in veh/h to a per-lane flow rate in pc/h/ln.
      const v_p_ml = Number(ml_demand) / (Number(phf) * Number(ml_lanes) * f_hv);
      const v_p_gp = Number(gp_demand) / (Number(phf) * Number(gp_lanes) * f_hv);

      const s_gp = gpSpeed(v_p_gp, Number(gp_ffs), Number(gp_capacity), Number(gp_breakpoint));
      const k_gp = v_p_gp / s_gp;

      const ml = new WasmManagedLanes(
        lane_type,
        Number(ffs),
        v_p_ml,
        k_gp,
        Number(caf),
        Number(saf)
      );

      const los = ml.run_analysis();
      results = {
        los,
        e_t,
        f_hv,
        v_p_ml,
        v_p_gp,
        s_gp,
        k_gp,
        breakpoint: ml.get_breakpoint(),
        capacity: ml.get_capacity(),
        speed: ml.get_speed(),
        density: ml.get_density(),
        has_friction_effect: ml.has_friction_effect(),
        friction_active: ml.is_friction_active()
      };
      // Generated once, off the run that produced these numbers, and carried on the result so the
      // page and the printable report can never drift apart or restate a since-edited input.
      results.discussion = discussion(results, { laneTypeLabel: LANE_TYPE_LABEL[lane_type].toLowerCase() });
      publishReport();
    } catch (err) {
      console.error('Chapter 12 managed lane analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function publishReport() {
    if (!results) return;
    setReport({
      chapter: 'Basic Managed Lane Segments',
      chapterRef: 'HCM Chapter 12, Section 4',
      href: '/hcm12ml',
      generatedAt: new Date().toLocaleString(),
      headline: { label: 'Managed lane LOS', value: results.los },
      discussion: results.discussion,
      inputs: [
        { label: 'Separation type', value: LANE_TYPE_LABEL[lane_type] },
        { label: 'Managed lane free-flow speed', value: `${ffs} mi/h` },
        { label: 'Managed lanes', value: ml_lanes },
        { label: 'Capacity adjustment factor, CAF', value: caf },
        { label: 'Speed adjustment factor, SAF', value: saf },
        { label: 'Managed lane demand', value: `${ml_demand} veh/h` },
        { label: 'Peak hour factor', value: phf },
        { label: 'Heavy vehicles', value: `${phv} %` },
        { label: 'Terrain', value: terrain_type },
        { label: 'Adjacent GP demand', value: `${gp_demand} veh/h` },
        { label: 'Adjacent GP lanes', value: gp_lanes },
        { label: 'Adjacent GP free-flow speed', value: `${gp_ffs} mi/h` },
        { label: 'Adjacent GP capacity', value: `${gp_capacity} pc/h/ln` },
        { label: 'Adjacent GP breakpoint', value: `${gp_breakpoint} pc/h/ln` },
      ],
      resultTable: {
        columns: ['Quantity', 'Value'],
        rows: [
          ['Passenger-car equivalent, E_T (Exhibit 12-25)', results.e_t.toFixed(1)],
          ['Heavy-vehicle factor, f_HV (Equation 12-10)', results.f_hv.toFixed(3)],
          ['Managed lane flow rate, v_p (Equation 12-9)', `${results.v_p_ml.toFixed(0)} pc/h/ln`],
          ['GP flow rate, v_p (Equation 12-9)', `${results.v_p_gp.toFixed(0)} pc/h/ln`],
          ['GP speed (Equation 12-1)', `${results.s_gp.toFixed(1)} mi/h`],
          ['GP density, K_GP', `${results.k_gp.toFixed(1)} pc/mi/ln`],
          ['Breakpoint, BP (Equation 12-13)', `${results.breakpoint.toFixed(0)} pc/h/ln`],
          ['Adjusted capacity, c_adj (Equation 12-14)', `${results.capacity.toFixed(0)} pc/h/ln`],
          ['Friction indicator, I_c (Equation 12-18)', results.friction_active ? '1 (active)' : '0'],
          ['Space mean speed, S_ML (Equation 12-12)', `${results.speed.toFixed(1)} mi/h`],
          ['Density, D = v_p / S_ML', `${results.density.toFixed(1)} pc/mi/ln`],
          ['Level of service', results.los],
        ],
      },
      summary: [
        { label: 'Managed lane speed', value: `${results.speed.toFixed(1)} mi/h` },
        { label: 'Managed lane density', value: `${results.density.toFixed(1)} pc/mi/ln` },
        { label: 'Managed lane LOS (Exhibit 12-15)', value: results.los },
      ],
      methodology: [
        'HCM Chapter 12, Section 4 basic managed lane segment: breakpoint from Equation 12-13 and adjusted capacity from Equation 12-14 with the Exhibit 12-30 parameters for the separation type, then the two-part speed-flow curve of Equations 12-15 through 12-17 and the space mean speed of Equation 12-12.',
        'Demand flow rates for both carriageways come from Equation 12-9 with the heavy-vehicle factor of Equation 12-10, using the general-terrain passenger-car equivalent of Exhibit 12-25.',
        'The adjacent general purpose lanes are analyzed as a basic freeway segment, so their density comes from Equation 12-1 with the entered capacity and breakpoint. That density drives the friction indicator of Equation 12-18, which applies only to continuous access and Buffer 1 separations and only above 35 pc/mi/ln.',
        'Level of service is keyed on density per HCM Exhibit 12-15, the same criteria as a basic freeway segment.',
      ],
      diagram: {
        kind: 'managed-lane',
        props: {
          laneType: lane_type,
          mlLanes: Number(ml_lanes),
          gpLanes: Number(gp_lanes),
          mlLos: results.los,
          mlDensity: results.density,
          gpDensity: results.k_gp,
          frictionActive: results.friction_active,
        },
      },
    });
  }

  function resetParams() {
    lane_type = 'continuous_access';
    ffs = 60;
    ml_lanes = 1;
    caf = 1.0;
    saf = 1.0;
    ml_demand = 1300;
    phf = 0.92;
    phv = 7.5;
    terrain_type = 'level';
    gp_demand = 2000;
    gp_lanes = 2;
    gp_ffs = 60;
    gp_capacity = 2300;
    gp_breakpoint = 1600;
    results = null;
    hasError = false;
  }

  // Buffer 2 and Barrier 2 are the multiple-lane rows of Exhibit 12-30, so a single drawn lane
  // under those types would misrepresent the separation the parameters describe.
  let multilaneType = $derived(lane_type === 'buffer2' || lane_type === 'barrier2');
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 12</span>
    <h1 class="page-title">Basic Managed Lane Segments</h1>
    <p class="page-sub">
      Estimate capacity, space mean speed, density, and level of service for a
      basic managed lane segment adjacent to general purpose freeway lanes.
    </p>
  </header>

  <div class="alert alert-warning shadow-sm mb-6 beta-note" role="note">
    <span>
      <strong>Scope.</strong> The compute engine is boundary-validated against HCM
      Chapter 26, Example Problem 7 (both cases), which the page defaults reproduce,
      and against the Exhibit 12-30 separation parameters and the Exhibit 12-11
      capacities at every tabulated free-flow speed. The page itself is in beta
      pending final inspection. Verify results independently before relying on them
      in engineering work, and please
      <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm12ml" onsubmit={preventDefault(runAnalysis)} inert={!ready}>
    <!-- Managed lane -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Managed Lane</h2>
          <p class="panel-sub">Separation from the general purpose lanes, free-flow speed, and the two adjustment factors.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="TYPE_input">Separation Type</label>
          <select id="TYPE_input" class="select select-bordered select-sm" bind:value={lane_type}>
            <option value="continuous_access">Continuous Access</option>
            <option value="buffer1">Buffer 1 (single lane, buffer separated)</option>
            <option value="buffer2">Buffer 2 (multiple lanes, buffer separated)</option>
            <option value="barrier1">Barrier 1 (single lane, barrier separated)</option>
            <option value="barrier2">Barrier 2 (multiple lanes, barrier separated)</option>
          </select>
          <p class="param-hint">Exhibit 12-30 defines a separate speed-flow calibration for each of the five types.</p>
        </div>

        <div class="param-field">
          <label for="FFS_input">Free-Flow Speed</label>
          <div class="cell-field">
            <input id="FFS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ffs} placeholder="60" required />
            <span class="unit">mi/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="MLLANES_input">Managed Lanes</label>
          <div class="cell-field">
            <input id="MLLANES_input" type="number" min="1" max="3" class="input input-bordered input-sm" bind:value={ml_lanes} required />
          </div>
          <p class="param-hint">
            {#if multilaneType}
              The selected Exhibit 12-30 row describes a multiple-lane facility.
            {:else}
              The selected Exhibit 12-30 row describes a single-lane facility.
            {/if}
          </p>
        </div>

        <div class="param-field">
          <label for="CAF_input">Capacity Adjustment Factor</label>
          <div class="cell-field">
            <input id="CAF_input" type="number" step="0.01" min="0" max="1" class="input input-bordered input-sm" bind:value={caf} placeholder="1.00" required />
          </div>
          <p class="param-hint">Use 1.00 for base conditions. Equation 12-14 is linear in CAF, Equation 12-13 squares it.</p>
        </div>

        <div class="param-field">
          <label for="SAF_input">Speed Adjustment Factor</label>
          <div class="cell-field">
            <input id="SAF_input" type="number" step="0.01" min="0" max="1" class="input input-bordered input-sm" bind:value={saf} placeholder="1.00" required />
          </div>
          <p class="param-hint">Use 1.00 for base conditions. Applies to the free-flow speed before the breakpoint and capacity are computed.</p>
        </div>
      </div>

      <div class="diagram-block">
        <ManagedLaneDiagram
          laneType={lane_type}
          mlLanes={ml_lanes}
          gpLanes={gp_lanes}
          mlLos={results ? results.los : null}
          mlDensity={results ? results.density : null}
          gpDensity={results ? results.k_gp : null}
          frictionActive={results ? results.friction_active : false}
        />
        <p class="diagram-caption">
          Plan view. The managed lanes are the left-most lanes of the roadway, so they are drawn above the general purpose lanes. The managed lane is tinted by its level of service after a run.
        </p>
      </div>
    </section>

    <!-- Traffic -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Traffic</h2>
          <p class="panel-sub">Hourly demand in the analysis direction. Equation 12-9 converts it to a per-lane flow rate in passenger cars.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="DEMAND_input">Managed Lane Demand</label>
          <div class="cell-field">
            <input id="DEMAND_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ml_demand} placeholder="1300" required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="0.92" required />
          </div>
        </div>

        <div class="param-field">
          <label for="PHV_input">Heavy Vehicles</label>
          <div class="cell-field">
            <input id="PHV_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="7.5" required />
            <span class="unit">%</span>
          </div>
          <p class="param-hint">Applied to both carriageways, as in Example Problem 7.</p>
        </div>

        <div class="param-field">
          <label for="TERRAIN_input">Terrain</label>
          <select id="TERRAIN_input" class="select select-bordered select-sm" bind:value={terrain_type}>
            <option value="level">Level (E_T = 2.0)</option>
            <option value="rolling">Rolling (E_T = 3.0)</option>
          </select>
          <p class="param-hint">Exhibit 12-25 general terrain. Mountainous terrain requires the Chapter 25 mixed-flow model and is not offered here.</p>
        </div>
      </div>
    </section>

    <!-- Adjacent general purpose lanes -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Adjacent General Purpose Lanes</h2>
          <p class="panel-sub">The GP lanes are analyzed as a basic freeway segment. Their density drives the friction term of Equation 12-18, which applies to continuous access and Buffer 1 separations above 35 pc/mi/ln.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="GPDEMAND_input">GP Demand</label>
          <div class="cell-field">
            <input id="GPDEMAND_input" type="number" min="0" class="input input-bordered input-sm" bind:value={gp_demand} placeholder="2000" required />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">Example Problem 7 runs 2,000 veh/h as Case 1 and 3,800 veh/h as Case 2.</p>
        </div>

        <div class="param-field">
          <label for="GPLANES_input">GP Lanes</label>
          <div class="cell-field">
            <input id="GPLANES_input" type="number" min="1" max="6" class="input input-bordered input-sm" bind:value={gp_lanes} required />
          </div>
        </div>

        <div class="param-field">
          <label for="GPFFS_input">GP Free-Flow Speed</label>
          <div class="cell-field">
            <input id="GPFFS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={gp_ffs} placeholder="60" required />
            <span class="unit">mi/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="GPCAP_input">GP Capacity</label>
          <div class="cell-field">
            <input id="GPCAP_input" type="number" min="0" class="input input-bordered input-sm" bind:value={gp_capacity} placeholder="2300" required />
            <span class="unit">pc/h/ln</span>
          </div>
          <p class="param-hint">From the Chapter 12 basic-segment analysis of the adjacent lanes.</p>
        </div>

        <div class="param-field">
          <label for="GPBP_input">GP Breakpoint</label>
          <div class="cell-field">
            <input id="GPBP_input" type="number" min="0" class="input input-bordered input-sm" bind:value={gp_breakpoint} placeholder="1600" required />
            <span class="unit">pc/h/ln</span>
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
          <div class="los-summary">
            <span class="los-summary-label">Segment LOS</span>
            <LosBadge los={results.los} size="lg" />
          </div>
        </div>
      {/if}
    </div>

    {#if results}
      <div class="result-visuals">
        <LosScale
          measure="density_pc"
          value={results.density}
          los={results.los}
          title="Managed lane density against the Exhibit 12-15 thresholds"
        />
      </div>
    {/if}

    <div class="los overflow-x-auto">
      <table class="table w-full">
        <tbody>
          <tr>
            <th>Heavy-Vehicle Factor, f<sub>HV</sub>:</th>
            <td>{results ? results.f_hv.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>Managed Lane Flow Rate (pc/h/ln):</th>
            <td>{results ? results.v_p_ml.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>GP Flow Rate (pc/h/ln):</th>
            <td>{results ? results.v_p_gp.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>GP Speed (mi/h):</th>
            <td>{results ? results.s_gp.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>GP Density, K<sub>GP</sub> (pc/mi/ln):</th>
            <td>{results ? results.k_gp.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Speed-Flow Breakpoint (pc/h/ln):</th>
            <td>{results ? results.breakpoint.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Adjusted Capacity (pc/h/ln):</th>
            <td>{results ? results.capacity.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Space Mean Speed (mi/h):</th>
            <td>{results ? results.speed.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Density (pc/mi/ln):</th>
            <td>{results ? results.density.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>GP Lane Friction Active:</th>
            <td>
              {#if results}
                {results.friction_active ? 'Yes' : 'No'}
                {#if !results.has_friction_effect}(no friction effect for this separation type){/if}
              {/if}
            </td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Segment LOS: {results ? results.los : ''}</p>
      </div>
    </div>

    {#if results}
      <Discussion sentences={results.discussion} />
    {/if}
  </section>
</div>

<style>
  .diagram-block { margin: 1rem auto 0; max-width: 560px; text-align: center; }
  .diagram-caption { font-size: 0.75rem; opacity: 0.65; margin-top: 0.35rem; }
  .los-summary { display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; }
  .los-summary-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.6; }
</style>
