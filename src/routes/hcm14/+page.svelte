<svelte:head>
  <title>Freeway Merge and Diverge Segments · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmRampSegment } from "HCM-middleware";
  import RampDiagram from '$lib/RampDiagram.svelte';
  import RampDiagram3D from '$lib/RampDiagram3D.svelte';
  import ViewToggle from '$lib/ViewToggle.svelte';
  import { setReport } from '$lib/report';
  import { discussion, discussion71 } from './discussion.js';
  import Discussion from '$lib/Discussion.svelte';

  let diagramMode = $state('2d');
  import { onMount } from "svelte";

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Inputs (defaults follow the HCM Chapter 14 base conditions)
  let version = $state('7');
  let ramp_type = $state('on_ramp');
  let ramp_side = $state('right');
  let ramp_lanes = $state(1);
  let freeway_lanes = $state(3);
  let terrain = $state('level');
  let accel_lane_length = $state(800);
  let decel_lane_length = $state(400);
  let freeway_ffs = $state(70);
  let ramp_ffs = $state(35);
  let freeway_demand = $state(4000);
  let ramp_demand = $state(500);
  let phf = $state(0.94);
  let phv = $state(5);
  let ramp_phv = $state(5);
  let caf = $state(1.0);
  let saf = $state(1.0);

  let results = $state(null);
  let results71 = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  function runAnalysis() {
    hasError = false;
    results = null;
    results71 = null;

    try {
      const rs = new WasmRampSegment(
        ramp_type,
        ramp_side,
        Number(ramp_lanes),
        Number(freeway_lanes),
        Number(freeway_ffs),
        Number(ramp_ffs),
        Number(accel_lane_length),
        undefined,             // accel_lane_length2, second lane of a two-lane ramp
        Number(decel_lane_length),
        undefined,             // decel_lane_length2, second lane of a two-lane ramp
        Number(freeway_demand),
        Number(ramp_demand),
        Number(phf),
        Number(phv) / 100.0,   // UI takes percent, the engine takes a decimal
        Number(ramp_phv) / 100.0,
        terrain,
        undefined,             // adjacent_upstream ramp type
        undefined,             // upstream_distance
        undefined,             // upstream_ramp_flow
        undefined,             // adjacent_downstream ramp type
        undefined,             // downstream_distance
        undefined,             // downstream_ramp_flow
        Number(caf),
        Number(saf),
        version
      );

      // The HCM defines no level of service for a major merge operating under capacity: the
      // chapter checks its capacity and stops there. The binding returns undefined in that case
      // rather than inventing a letter, so the summary says so instead of rendering blank.
      const los = rs.run_analysis();

      if (version === '7.1') {
        // The Edition 7.1 methodology has its own step structure; read its full typed
        // result instead of the 7th Edition step getters.
        results71 = { ...rs.analysis_v7_1() };
      } else {
        results = {
          los,
          losUndefined: los === undefined || los === null,
          flow_freeway: rs.get_flow_freeway(),
          flow_ramp: rs.get_flow_ramp(),
          v12: rs.get_v12(),
          capacity_freeway: rs.get_capacity_freeway(),
          capacity_ramp: rs.get_capacity_ramp(),
          vc_ratio: rs.get_vc_ratio(),
          demand_exceeds_capacity: rs.get_demand_exceeds_capacity(),
          density: rs.get_density(),
          speed_ramp: rs.get_speed_ramp(),
          speed_avg: rs.get_speed_avg()
        };
      }

      const is71 = version === '7.1';
      const typeLabel = {
        on_ramp: 'On-ramp (merge)', off_ramp: 'Off-ramp (diverge)',
        major_merge: 'Major merge', major_diverge: 'Major diverge',
      }[ramp_type] || ramp_type;
      // Generated once, off the run that produced these numbers, and carried on the result so the
      // page and the printable report can never drift apart or restate a since-edited input.
      if (is71) {
        results71.discussion = discussion71(results71, { typeLabel });
      } else {
        results.discussion = discussion(results, {
          typeLabel,
          accelLen: accel_lane_length,
          decelLen: decel_lane_length,
          isOnRamp: ramp_type === 'on_ramp' || ramp_type === 'major_merge'
        });
      }
      setReport({
        chapter: 'Freeway Merge and Diverge Segments',
        chapterRef: 'HCM Chapter 14',
        href: '/hcm14',
        generatedAt: new Date().toLocaleString(),
        headline: is71
          ? { label: 'Segment LOS (Edition 7.1)', value: results71.los }
          : (results.losUndefined ? null : { label: 'Segment LOS', value: results.los }),
        discussion: is71 ? results71.discussion : results.discussion,
        inputs: [
          { label: 'HCM edition', value: is71 ? 'Edition 7.1 (2025)' : '7th Edition' },
          { label: 'Ramp type', value: typeLabel },
          { label: 'Ramp side', value: ramp_side === 'left' ? 'Left' : 'Right' },
          { label: 'Ramp lanes', value: ramp_lanes },
          { label: 'Freeway lanes (one direction)', value: freeway_lanes },
          { label: 'Acceleration lane length, L_A', value: `${accel_lane_length} ft` },
          { label: 'Deceleration lane length, L_D', value: `${decel_lane_length} ft` },
          { label: 'Terrain', value: terrain },
          { label: 'Freeway / ramp free-flow speed', value: `${freeway_ffs} / ${ramp_ffs} mph` },
          { label: 'Freeway / ramp demand', value: `${freeway_demand} / ${ramp_demand} veh/h` },
          { label: 'Peak hour factor', value: phf },
          { label: 'Heavy vehicles (freeway / ramp)', value: `${phv} / ${ramp_phv} %` },
          { label: 'CAF / SAF', value: `${caf} / ${saf}` },
        ],
        resultTable: {
          columns: ['Quantity', 'Value'],
          rows: is71 ? [
            ['Freeway flow rate', `${results71.flow_freeway.toFixed(0)} pc/h`],
            ['Ramp flow rate', `${results71.flow_ramp.toFixed(0)} pc/h`],
            ['Influence area flow per lane', `${results71.flow_per_lane.toFixed(0)} pc/h/ln`],
            ['Equivalent basic segment speed', `${results71.speed_basic.toFixed(1)} mi/h`],
            ['Speed impedance', `${results71.speed_impedance.toFixed(2)} mi/h`],
            ['Influence area speed', results71.speed_avg == null ? 'not defined (demand far past capacity)' : `${results71.speed_avg.toFixed(1)} mi/h`],
            ['Influence area capacity', results71.capacity_per_lane == null ? 'not defined for these inputs' : `${results71.capacity_per_lane.toFixed(0)} pc/h/ln`],
            ['Demand-to-capacity ratio', results71.dc_ratio == null ? 'not defined' : results71.dc_ratio.toFixed(2)],
            ['Neighboring freeway capacity', `${results71.capacity_neighboring_freeway.toFixed(0)} pc/h`],
            ['Ramp roadway capacity', `${results71.capacity_ramp_roadway.toFixed(0)} pc/h`],
            ['Demand exceeds capacity', results71.demand_exceeds_capacity ? 'Yes, LOS F' : 'No'],
            ['Influence area density', Number.isFinite(results71.density) ? `${results71.density.toFixed(1)} pc/mi/ln` : 'over capacity'],
            ['Level of service (Exhibit 14-2, Edition 7.1 bands)', results71.los],
          ] : [
            ['Freeway flow rate', `${results.flow_freeway.toFixed(0)} pc/h`],
            ['Ramp flow rate', `${results.flow_ramp.toFixed(0)} pc/h`],
            ['Flow in lanes 1 and 2, v_12', `${results.v12.toFixed(0)} pc/h`],
            ['Freeway capacity', `${results.capacity_freeway.toFixed(0)} pc/h`],
            ['Ramp capacity', `${results.capacity_ramp.toFixed(0)} pc/h`],
            ['Volume-to-capacity ratio', results.vc_ratio.toFixed(2)],
            ['Demand exceeds capacity', results.demand_exceeds_capacity ? 'Yes, LOS F' : 'No'],
            ['Ramp influence area density', `${results.density.toFixed(1)} pc/mi/ln`],
            ['Ramp influence area speed', `${results.speed_ramp.toFixed(1)} mi/h`],
            ['Average speed, all lanes', `${results.speed_avg.toFixed(1)} mi/h`],
            ['Level of service', results.losUndefined ? 'Not defined by the HCM for this configuration' : results.los],
          ],
        },
        summary: [],
        methodology: is71 ? [
          'Edition 7.1 methodology: influence area speed from an equivalent basic segment less a speed impedance (Equations 14-2 through 14-5), capacity from the 35 pc/mi/ln breakdown density, LOS from the Edition 7.1 Exhibit 14-2 bands.',
        ] : [
          '7th Edition methodology: lane distribution and v_12 (Equations 14-2 through 14-19), capacity checks (Exhibits 14-10 and 14-12), density (Equations 14-22, 14-23, 14-28), speeds (Exhibits 14-13 through 14-15), LOS (Exhibit 14-3).',
          results.losUndefined ? 'The HCM evaluates a major merge through its capacity checks only and defines no level of service under capacity.' : null,
        ].filter(Boolean),
        diagram: { kind: 'ramp', props: { rampType: ramp_type, rampSide: ramp_side, rampLanes: ramp_lanes, freewayLanes: freeway_lanes, accelLen: accel_lane_length, decelLen: decel_lane_length } },
      });
    } catch (err) {
      console.error('Chapter 14 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    version = '7';
    ramp_type = 'on_ramp';
    ramp_side = 'right';
    ramp_lanes = 1;
    freeway_lanes = 3;
    terrain = 'level';
    accel_lane_length = 800;
    decel_lane_length = 400;
    freeway_ffs = 70;
    ramp_ffs = 35;
    freeway_demand = 4000;
    ramp_demand = 500;
    phf = 0.94;
    phv = 5;
    ramp_phv = 5;
    caf = 1.0;
    saf = 1.0;
    results = null;
    results71 = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 14</span>
    <h1 class="page-title">Freeway Merge and Diverge Segments</h1>
    <p class="page-sub">
      Estimate ramp influence area density, speeds, and level of service for a
      ramp-freeway junction.
    </p>
  </header>

  <div class="alert alert-info shadow-sm mb-6 beta-note" role="note">
    <span>
      The compute engine reproduces the published HCM worked examples for this
      chapter. Verify results independently before relying on them in engineering
      work, and please <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm14" onsubmit={preventDefault(runAnalysis)} inert={!ready}>
    <!-- Configuration -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Configuration</h2>
          <p class="panel-sub">Junction type and geometry of the ramp-freeway junction.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="VER_input">HCM Edition</label>
          <select id="VER_input" class="select select-bordered select-sm" bind:value={version}>
            <option value="7">7th Edition</option>
            <option value="7.1">Edition 7.1 (2025)</option>
          </select>
          <p class="param-hint">Edition 7.1 replaces this chapter's methodology; the editions report different speeds, capacities, and LOS.</p>
        </div>

        <div class="param-field">
          <label for="RT_input">Ramp Type</label>
          <select id="RT_input" class="select select-bordered select-sm" bind:value={ramp_type}>
            <option value="on_ramp">On-Ramp (Merge)</option>
            <option value="off_ramp">Off-Ramp (Diverge)</option>
            <option value="major_merge">Major Merge</option>
            <option value="major_diverge">Major Diverge</option>
          </select>
        </div>

        <div class="param-field">
          <label for="RS_input">Ramp Side</label>
          <select id="RS_input" class="select select-bordered select-sm" bind:value={ramp_side}>
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </div>

        <div class="param-field">
          <label for="RL_input">Ramp Lanes</label>
          <select id="RL_input" class="select select-bordered select-sm" bind:value={ramp_lanes}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>

        <div class="param-field">
          <label for="FL_input">Freeway Lanes (one direction)</label>
          <div class="cell-field">
            <input id="FL_input" type="number" min="2" max="5" class="input input-bordered input-sm" bind:value={freeway_lanes} required />
          </div>
        </div>

        <div class="param-field">
          <label for="LA_input">Acceleration Lane Length (L_A)</label>
          <div class="cell-field">
            <input id="LA_input" type="number" min="0" class="input input-bordered input-sm" bind:value={accel_lane_length} placeholder="800" required />
            <span class="unit">ft</span>
          </div>
          <p class="param-hint">Used for on-ramps and major merges.</p>
        </div>

        <div class="param-field">
          <label for="LD_input">Deceleration Lane Length (L_D)</label>
          <div class="cell-field">
            <input id="LD_input" type="number" min="0" class="input input-bordered input-sm" bind:value={decel_lane_length} placeholder="400" required />
            <span class="unit">ft</span>
          </div>
          <p class="param-hint">Used for off-ramps and major diverges.</p>
        </div>

        <div class="param-field">
          <label for="TERRAIN_input">Terrain</label>
          <select id="TERRAIN_input" class="select select-bordered select-sm" bind:value={terrain}>
            <option value="level">Level</option>
            <option value="rolling">Rolling</option>
            <option value="mountainous">Mountainous</option>
          </select>
        </div>
      </div>

      <div class="diagram-block">
        <div class="diagram-head">
          <p class="panel-sub">Hover the legend to highlight the ramp or the influence area the method evaluates. The picture follows the inputs.</p>
          <ViewToggle bind:mode={diagramMode} label="Junction view mode" />
        </div>
        {#if diagramMode === '3d'}
          <RampDiagram3D
            rampType={ramp_type}
            rampSide={ramp_side}
            rampLanes={ramp_lanes}
            freewayLanes={freeway_lanes}
            accelLen={accel_lane_length}
            decelLen={decel_lane_length}
          />
        {:else}
          <RampDiagram
            rampType={ramp_type}
            rampSide={ramp_side}
            rampLanes={ramp_lanes}
            freewayLanes={freeway_lanes}
            bind:accelLen={accel_lane_length}
            bind:decelLen={decel_lane_length}
          />
        {/if}
      </div>
    </section>

    <!-- Traffic -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Traffic</h2>
          <p class="panel-sub">Freeway and ramp demand and traffic-stream characteristics.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="VF_input">Freeway Demand</label>
          <div class="cell-field">
            <input id="VF_input" type="number" min="0" class="input input-bordered input-sm" bind:value={freeway_demand} placeholder="4000" required />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">Demand immediately upstream of the junction.</p>
        </div>

        <div class="param-field">
          <label for="VR_input">Ramp Demand</label>
          <div class="cell-field">
            <input id="VR_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ramp_demand} placeholder="500" required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="FFS_input">Freeway Free-Flow Speed</label>
          <div class="cell-field">
            <input id="FFS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={freeway_ffs} placeholder="70" required />
            <span class="unit">mph</span>
          </div>
        </div>

        <div class="param-field">
          <label for="RFFS_input">Ramp Free-Flow Speed</label>
          <div class="cell-field">
            <input id="RFFS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ramp_ffs} placeholder="35" required />
            <span class="unit">mph</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="0.94" required />
          </div>
        </div>

        <div class="param-field">
          <label for="PHV_input">Heavy Vehicles (Freeway)</label>
          <div class="cell-field">
            <input id="PHV_input" type="number" step="0.01" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="5" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="RPHV_input">Heavy Vehicles (Ramp)</label>
          <div class="cell-field">
            <input id="RPHV_input" type="number" step="0.01" min="0" max="100" class="input input-bordered input-sm" bind:value={ramp_phv} placeholder="5" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="CAF_input">Capacity Adjustment Factor</label>
          <div class="cell-field">
            <input id="CAF_input" type="number" step="0.01" min="0" max="1" class="input input-bordered input-sm" bind:value={caf} placeholder="1.00" required />
          </div>
          <p class="param-hint">Use 1.00 for base conditions.</p>
        </div>

        <div class="param-field">
          <label for="SAF_input">Speed Adjustment Factor</label>
          <div class="cell-field">
            <input id="SAF_input" type="number" step="0.01" min="0" max="1" class="input input-bordered input-sm" bind:value={saf} placeholder="1.00" required />
          </div>
          <p class="param-hint">Use 1.00 for base conditions.</p>
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
      {#if results || results71}
        <div class="panel-actions">
          <a class="btn btn-outline btn-sm" href="/report">Open printable report</a>
        </div>
      {/if}
    </div>
    {#if results71}
      <div class="los overflow-x-auto">
        <p class="panel-sub">Edition 7.1 methodology: influence area speed from an equivalent basic segment less a speed impedance, capacity from the 35 pc/mi/ln breakdown density.</p>
        <table class="table w-full">
          <tbody>
            <tr>
              <th>Freeway Flow Rate (pc/hr):</th>
              <td>{results71.flow_freeway.toFixed(0)}</td>
            </tr>
            <tr>
              <th>Ramp Flow Rate (pc/hr):</th>
              <td>{results71.flow_ramp.toFixed(0)}</td>
            </tr>
            <tr>
              <th>Influence Area Flow per Lane (pc/hr/ln):</th>
              <td>{results71.flow_per_lane.toFixed(0)}</td>
            </tr>
            <tr>
              <th>Equivalent Basic Segment Speed (mi/hr):</th>
              <td>{results71.speed_basic.toFixed(1)}</td>
            </tr>
            <tr>
              <th>Speed Impedance (mi/hr):</th>
              <td>{results71.speed_impedance.toFixed(2)}</td>
            </tr>
            <tr>
              <th>Influence Area Speed (mi/hr):</th>
              <td>{results71.speed_avg == null ? 'not defined (demand far past capacity)' : results71.speed_avg.toFixed(1)}</td>
            </tr>
            <tr>
              <th>Influence Area Capacity (pc/hr/ln):</th>
              <td>{results71.capacity_per_lane == null ? 'not defined for these inputs' : results71.capacity_per_lane.toFixed(0)}</td>
            </tr>
            <tr>
              <th>Demand-to-Capacity Ratio:</th>
              <td>{results71.dc_ratio == null ? 'not defined for these inputs' : results71.dc_ratio.toFixed(2)}</td>
            </tr>
            <tr>
              <th>Neighboring Freeway Capacity (pc/hr):</th>
              <td>{results71.capacity_neighboring_freeway.toFixed(0)}</td>
            </tr>
            <tr>
              <th>Ramp Roadway Capacity (pc/hr):</th>
              <td>{results71.capacity_ramp_roadway.toFixed(0)}</td>
            </tr>
            <tr>
              <th>Demand Exceeds Capacity:</th>
              <td>{results71.demand_exceeds_capacity ? 'Yes, LOS F' : 'No'}</td>
            </tr>
            <tr>
              <th>Influence Area Density (pc/mi/ln):</th>
              <td>{Number.isFinite(results71.density) ? results71.density.toFixed(1) : 'over capacity'}</td>
            </tr>
          </tbody>
        </table>
        <div class="facility-summary">
          <p>Segment LOS (Exhibit 14-2, Edition 7.1 bands): {results71.los}</p>
        </div>
      </div>
    {/if}

    <div class="los overflow-x-auto" style={results71 ? 'display:none' : ''}>
      <table class="table w-full">
        <tbody>
          <tr>
            <th>Freeway Flow Rate (pc/hr):</th>
            <td>{results ? results.flow_freeway.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Ramp Flow Rate (pc/hr):</th>
            <td>{results ? results.flow_ramp.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Flow in Lanes 1 and 2 (pc/hr):</th>
            <td>{results ? results.v12.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Freeway Capacity (pc/hr):</th>
            <td>{results ? results.capacity_freeway.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Ramp Capacity (pc/hr):</th>
            <td>{results ? results.capacity_ramp.toFixed(0) : ''}</td>
          </tr>
          <tr>
            <th>Volume-to-Capacity Ratio:</th>
            <td>{results ? results.vc_ratio.toFixed(2) : ''}</td>
          </tr>
          <tr>
            <th>Demand Exceeds Capacity:</th>
            <td>{results ? (results.demand_exceeds_capacity ? 'Yes, LOS F' : 'No') : ''}</td>
          </tr>
          <tr>
            <th>Ramp Influence Area Density (pc/mi/ln):</th>
            <td>{results ? results.density.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Ramp Influence Area Speed (mi/hr):</th>
            <td>{results ? results.speed_ramp.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Average Speed, All Lanes (mi/hr):</th>
            <td>{results ? results.speed_avg.toFixed(1) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        {#if results && results.losUndefined}
          <p>
            Segment LOS: not defined by the HCM for this configuration. Chapter 14 evaluates a
            major merge through its capacity checks only; the demand and capacity figures above
            are the result.
          </p>
        {:else}
          <p>Segment LOS: {results ? results.los : ''}</p>
        {/if}
      </div>
    </div>

    {#if results || results71}
      <Discussion sentences={results71 ? results71.discussion : results.discussion} />
    {/if}
  </section>
</div>
