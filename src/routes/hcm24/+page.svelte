<svelte:head>
  <title>Off-Street Pedestrian and Bicycle Facilities · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import LosScale from '$lib/LosScale.svelte';
  import LosBadge from '$lib/LosBadge.svelte';
  import init, { WasmExclusivePedestrianFacility, WasmSharedUsePathPedestrian, WasmOffStreetBicycleFacility } from "HCM-middleware";
  import PathDiagram from '$lib/PathDiagram.svelte';
  import { setReport } from '$lib/report';
  import { onMount } from "svelte";

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Facility selector
  let facility_kind = $state('pedestrian');

  // Exclusive pedestrian facility inputs (defaults follow HCM Exhibit 24-6)
  let ped_total_width = $state(10);
  let ped_object_width = $state(0);
  let ped_demand = $state(1000);
  let ped_phf = $state(0.85);
  let ped_speed = $state(300);
  let ped_facility_type = $state('walkway');
  let ped_flow_type = $state('random');

  // Shared-use path pedestrian inputs
  let sup_bike_same = $state(100);
  let sup_bike_opposing = $state(100);
  let sup_phf = $state(0.85);
  let sup_ped_speed = $state(3.4);
  let sup_bike_speed = $state(12.8);
  let sup_one_way = $state('no');

  // Off-street bicycle facility inputs
  let bike_path_width = $state(10);
  let bike_segment_length = $state(1);
  let bike_centerline = $state('no');
  let bike_two_way_demand = $state(200);
  let bike_dir_split = $state(0.5);
  let bike_phf = $state(0.85);
  let bike_one_way = $state('no');
  let bike_exclusive = $state('no');

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  // LOS drives the diagram's delayed-passing effect once the run matches the
  // selected facility kind.
  let losForDiagram = $derived(results && results.kind === facility_kind ? results.los : null);

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      if (facility_kind === 'pedestrian') {
        const fac = new WasmExclusivePedestrianFacility(
          Number(ped_total_width),
          Number(ped_object_width),
          Number(ped_demand),
          null,                     // peak 15-min volume (field measurement)
          Number(ped_phf),
          Number(ped_speed),
          ped_facility_type,
          ped_flow_type
        );
        const los = fac.analyze();
        const r = fac.results_to_js_value();
        results = { kind: 'pedestrian', los, ...r };
      } else if (facility_kind === 'shared_path') {
        const path = new WasmSharedUsePathPedestrian(
          Number(sup_bike_same),
          Number(sup_bike_opposing),
          Number(sup_phf),
          Number(sup_ped_speed),
          Number(sup_bike_speed),
          sup_one_way === 'yes'
        );
        const los = path.analyze();
        const r = path.results_to_js_value();
        results = { kind: 'shared_path', los, ...r };
      } else {
        const fac = new WasmOffStreetBicycleFacility(
          Number(bike_path_width),
          Number(bike_segment_length),
          bike_centerline === 'yes',
          Number(bike_two_way_demand),
          Number(bike_dir_split),
          Number(bike_phf),
          bike_one_way === 'yes',
          bike_exclusive === 'yes',
          null,                     // mode splits (Exhibit 24-6 defaults)
          null,                     // mode speeds
          null                      // mode speed standard deviations
        );
        const los = fac.analyze();
        const r = fac.results_to_js_value();
        results = { kind: 'bicycle', los, ...r };
      }

      const kindLabel = { pedestrian: 'Exclusive pedestrian facility', shared_path: 'Shared-use path (pedestrian LOS)', bicycle: 'Off-street bicycle facility (BLOS)' }[results.kind];
      const inputs = results.kind === 'pedestrian' ? [
        { label: 'Facility', value: kindLabel },
        { label: 'Total width', value: `${ped_total_width} ft` },
        { label: 'Fixed-object width', value: `${ped_object_width} ft` },
        { label: 'Hourly demand', value: `${ped_demand} p/h` },
        { label: 'Peak hour factor', value: ped_phf },
        { label: 'Walking speed', value: `${ped_speed} ft/min` },
        { label: 'Facility type / flow', value: `${ped_facility_type}, ${ped_flow_type}` },
      ] : results.kind === 'shared_path' ? [
        { label: 'Facility', value: kindLabel },
        { label: 'Bicycles same direction / opposing', value: `${sup_bike_same} / ${sup_bike_opposing} bikes/h` },
        { label: 'Peak hour factor', value: sup_phf },
        { label: 'Pedestrian / bicycle speed', value: `${sup_ped_speed} / ${sup_bike_speed} mi/h` },
        { label: 'One-way', value: sup_one_way },
      ] : [
        { label: 'Facility', value: kindLabel },
        { label: 'Path width', value: `${bike_path_width} ft` },
        { label: 'Segment length', value: `${bike_segment_length} mi` },
        { label: 'Centerline', value: bike_centerline },
        { label: 'Two-way demand', value: `${bike_two_way_demand} users/h` },
        { label: 'Directional split', value: bike_dir_split },
        { label: 'Peak hour factor', value: bike_phf },
        { label: 'Mode split and speeds', value: 'Exhibit 24-6 defaults' },
      ];
      const rows = results.kind === 'pedestrian' ? [
        ['Effective width', `${results.effective_width?.toFixed(1)} ft`],
        ['Unit flow rate', `${results.unit_flow_rate?.toFixed(2)} p/ft/min`],
        ['Pedestrian space', `${results.pedestrian_space?.toFixed(0)} ft²/p`],
        ['LOS (Exhibit 24-1/24-2)', results.los],
      ] : results.kind === 'shared_path' ? [
        ['Passing events', `${results.passing_events?.toFixed(0)} events/h`],
        ['Meeting events', `${results.meeting_events?.toFixed(0)} events/h`],
        ['Total weighted events', `${results.total_events?.toFixed(0)} events/h`],
        ['LOS (Exhibit 24-4)', results.los],
      ] : [
        ['Active passings', `${results.active_passings_per_minute?.toFixed(2)} /min`],
        ['Meetings', `${results.meetings_per_minute?.toFixed(2)} /min`],
        ['Effective lanes', `${results.effective_lanes}`],
        ['Probability of delayed passing', `${(results.probability_delayed_passing * 100)?.toFixed(1)} %`],
        ['Delayed passings', `${results.delayed_passings_per_minute?.toFixed(2)} /min`],
        ['BLOS score', `${results.blos_score?.toFixed(2)}`],
        ['LOS (Exhibit 24-5)', results.los],
      ];
      setReport({
        chapter: 'Off-Street Pedestrian and Bicycle Facilities',
        chapterRef: 'HCM Chapter 24',
        href: '/hcm24',
        generatedAt: new Date().toLocaleString(),
        headline: { label: `${kindLabel} LOS`, value: results.los },
        inputs,
        resultTable: { columns: ['Quantity', 'Value'], rows },
        summary: [],
        methodology: [
          results.kind === 'pedestrian'
            ? 'Exclusive pedestrian facility: effective width after fixed objects, unit flow rate, pedestrian space, and LOS per Exhibits 24-1 and 24-2 with the platooned-flow adjustment where selected.'
            : results.kind === 'shared_path'
              ? 'Shared-use path pedestrian method: bicycle passing and meeting events against the average pedestrian (Equations 24-8 through 24-10), weighted total events, and LOS per Exhibit 24-4.'
              : 'Off-street bicycle BLOS: directional mode flows from the Exhibit 24-6 splits and speeds, active passings and meetings, effective lanes (Exhibit 24-14), delayed passing probability, and the BLOS score of Equation 24-35 with LOS per Exhibit 24-5.',
        ],
        diagram: { kind: 'path', props: { kind: results.kind, widthFt: results.kind === 'bicycle' ? bike_path_width : results.kind === 'pedestrian' ? ped_total_width : 10, objectWidthFt: results.kind === 'pedestrian' ? ped_object_width : 0, centerline: bike_centerline === 'yes', oneWay: false, demandA: results.kind === 'shared_path' ? sup_bike_same : results.kind === 'pedestrian' ? ped_demand : bike_two_way_demand, demandB: results.kind === 'shared_path' ? sup_bike_opposing : 0, losLetter: results.los } },
      });
    } catch (err) {
      console.error('Chapter 24 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    ped_total_width = 10;
    ped_object_width = 0;
    ped_demand = 1000;
    ped_phf = 0.85;
    ped_speed = 300;
    ped_facility_type = 'walkway';
    ped_flow_type = 'random';
    sup_bike_same = 100;
    sup_bike_opposing = 100;
    sup_phf = 0.85;
    sup_ped_speed = 3.4;
    sup_bike_speed = 12.8;
    sup_one_way = 'no';
    bike_path_width = 10;
    bike_segment_length = 1;
    bike_centerline = 'no';
    bike_two_way_demand = 200;
    bike_dir_split = 0.5;
    bike_phf = 0.85;
    bike_one_way = 'no';
    bike_exclusive = 'no';
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 24</span>
    <h1 class="page-title">Off-Street Pedestrian and Bicycle Facilities</h1>
    <p class="page-sub">
      Estimate level of service for exclusive pedestrian facilities, for
      pedestrians on shared-use paths, and for bicyclists on off-street paths.
    </p>
  </header>

  <div class="alert alert-info shadow-sm mb-6 beta-note" role="note">
    <span>
      The compute engine reproduces the published HCM worked examples for this
      chapter: the shared-use path pedestrian events, the exclusive-facility
      pedestrian space, and the bicycle BLOS score. Verify results
      independently before relying on them in engineering work, and please <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm24" onsubmit={preventDefault(runAnalysis)}>
    <!-- Facility Type -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Facility</h2>
          <p class="panel-sub">Pick the methodology that matches the facility being analyzed.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="KIND_input">Facility Type</label>
          <select id="KIND_input" class="select select-bordered select-sm" bind:value={facility_kind} onchange={() => { results = null; }}>
            <option value="pedestrian">Exclusive Pedestrian</option>
            <option value="shared_path">Shared-Use Path (pedestrian LOS)</option>
            <option value="bicycle">Off-Street Bicycle (BLOS)</option>
          </select>
        </div>
      </div>
    
      <div class="diagram-block">
        {#if facility_kind === 'pedestrian'}
          <PathDiagram kind="pedestrian" widthFt={ped_total_width} objectWidthFt={ped_object_width}
                       bind:demandA={ped_demand} losLetter={losForDiagram} />
        {:else if facility_kind === 'shared_path'}
          <PathDiagram kind="shared_path" widthFt={10} oneWay={sup_one_way === 'yes'}
                       bind:demandA={sup_bike_same} bind:demandB={sup_bike_opposing} losLetter={losForDiagram} />
        {:else}
          <PathDiagram kind="bicycle" widthFt={bike_path_width} centerline={bike_centerline === 'yes'}
                       oneWay={bike_one_way === 'yes'} bind:demandA={bike_two_way_demand} losLetter={losForDiagram} />
        {/if}
      </div>
    </section>

    {#if facility_kind === 'pedestrian'}
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Exclusive Pedestrian Facility</h2>
            <p class="panel-sub">Walkways, cross-flow areas, and stairways. The service measure is average pedestrian space. For stairways, supply the ascending flow.</p>
          </div>
        </div>
        <div class="param-grid">
          <div class="param-field">
            <label for="PWT_input">Total Walkway Width</label>
            <div class="cell-field">
              <input id="PWT_input" type="number" step="0.1" min="1" class="input input-bordered input-sm" bind:value={ped_total_width} placeholder="10" required />
              <span class="unit">ft</span>
            </div>
          </div>

          <div class="param-field">
            <label for="PWO_input">Fixed-Object Width</label>
            <div class="cell-field">
              <input id="PWO_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={ped_object_width} placeholder="0" required />
              <span class="unit">ft</span>
            </div>
            <p class="param-hint">Sum of fixed-object effective widths and shy distances.</p>
          </div>

          <div class="param-field">
            <label for="PD_input">Pedestrian Demand</label>
            <div class="cell-field">
              <input id="PD_input" type="number" min="0" class="input input-bordered input-sm" bind:value={ped_demand} placeholder="1000" required />
              <span class="unit">p/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="PPHF_input">Peak Hour Factor</label>
            <div class="cell-field">
              <input id="PPHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={ped_phf} placeholder="0.85" required />
            </div>
          </div>

          <div class="param-field">
            <label for="PS_input">Pedestrian Speed</label>
            <div class="cell-field">
              <input id="PS_input" type="number" min="50" class="input input-bordered input-sm" bind:value={ped_speed} placeholder="300" required />
              <span class="unit">ft/min</span>
            </div>
          </div>

          <div class="param-field">
            <label for="PFT_input">Facility Kind</label>
            <select id="PFT_input" class="select select-bordered select-sm" bind:value={ped_facility_type}>
              <option value="walkway">Walkway</option>
              <option value="cross_flow">Cross-Flow Area</option>
              <option value="stairway">Stairway</option>
            </select>
          </div>

          <div class="param-field">
            <label for="PFL_input">Flow Type</label>
            <select id="PFL_input" class="select select-bordered select-sm" bind:value={ped_flow_type}>
              <option value="random">Random</option>
              <option value="platooned">Platooned</option>
            </select>
          </div>
        </div>
      </section>
    {:else if facility_kind === 'shared_path'}
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Shared-Use Path (Pedestrian LOS)</h2>
            <p class="panel-sub">Pedestrian LOS is based on the weighted number of bicycle passing and meeting events per hour.</p>
          </div>
        </div>
        <div class="param-grid">
          <div class="param-field">
            <label for="SBS_input">Bicycle Demand, Same Direction</label>
            <div class="cell-field">
              <input id="SBS_input" type="number" min="0" class="input input-bordered input-sm" bind:value={sup_bike_same} placeholder="100" required />
              <span class="unit">bicycles/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="SBO_input">Bicycle Demand, Opposing</label>
            <div class="cell-field">
              <input id="SBO_input" type="number" min="0" class="input input-bordered input-sm" bind:value={sup_bike_opposing} placeholder="100" required />
              <span class="unit">bicycles/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="SPHF_input">Peak Hour Factor</label>
            <div class="cell-field">
              <input id="SPHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={sup_phf} placeholder="0.85" required />
            </div>
          </div>

          <div class="param-field">
            <label for="SPS_input">Pedestrian Speed</label>
            <div class="cell-field">
              <input id="SPS_input" type="number" step="0.1" min="0.5" class="input input-bordered input-sm" bind:value={sup_ped_speed} placeholder="3.4" required />
              <span class="unit">mph</span>
            </div>
          </div>

          <div class="param-field">
            <label for="SBSP_input">Bicycle Speed</label>
            <div class="cell-field">
              <input id="SBSP_input" type="number" step="0.1" min="1" class="input input-bordered input-sm" bind:value={sup_bike_speed} placeholder="12.8" required />
              <span class="unit">mph</span>
            </div>
          </div>

          <div class="param-field">
            <label for="SOW_input">One-Way Path</label>
            <select id="SOW_input" class="select select-bordered select-sm" bind:value={sup_one_way}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            <p class="param-hint">One-way paths have no meeting events.</p>
          </div>
        </div>
      </section>
    {:else}
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Off-Street Bicycle Facility (BLOS)</h2>
            <p class="panel-sub">Bicycle LOS on shared-use and exclusive paths up to 20 ft wide. Mode splits and speeds default to HCM Exhibit 24-6.</p>
          </div>
        </div>
        <div class="param-grid">
          <div class="param-field">
            <label for="BPW_input">Path Width</label>
            <div class="cell-field">
              <input id="BPW_input" type="number" step="0.5" min="4" max="20" class="input input-bordered input-sm" bind:value={bike_path_width} placeholder="10" required />
              <span class="unit">ft</span>
            </div>
          </div>

          <div class="param-field">
            <label for="BSL_input">Segment Length</label>
            <div class="cell-field">
              <input id="BSL_input" type="number" step="0.05" min="0.1" class="input input-bordered input-sm" bind:value={bike_segment_length} placeholder="1" required />
              <span class="unit">mi</span>
            </div>
          </div>

          <div class="param-field">
            <label for="BCL_input">Centerline Stripe</label>
            <select id="BCL_input" class="select select-bordered select-sm" bind:value={bike_centerline}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div class="param-field">
            <label for="BTD_input">Two-Way Path Demand</label>
            <div class="cell-field">
              <input id="BTD_input" type="number" min="0" class="input input-bordered input-sm" bind:value={bike_two_way_demand} placeholder="200" required />
              <span class="unit">users/h</span>
            </div>
          </div>

          <div class="param-field">
            <label for="BDS_input">Directional Split</label>
            <div class="cell-field">
              <input id="BDS_input" type="number" step="0.05" min="0" max="1" class="input input-bordered input-sm" bind:value={bike_dir_split} placeholder="0.5" required />
            </div>
            <p class="param-hint">Share of demand traveling in the analysis direction.</p>
          </div>

          <div class="param-field">
            <label for="BPHF_input">Peak Hour Factor</label>
            <div class="cell-field">
              <input id="BPHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={bike_phf} placeholder="0.85" required />
            </div>
          </div>

          <div class="param-field">
            <label for="BOW_input">One-Way Path</label>
            <select id="BOW_input" class="select select-bordered select-sm" bind:value={bike_one_way}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div class="param-field">
            <label for="BEX_input">Exclusive Bicycle Facility</label>
            <select id="BEX_input" class="select select-bordered select-sm" bind:value={bike_exclusive}>
              <option value="no">No (shared-use path)</option>
              <option value="yes">Yes (bicycles only)</option>
            </select>
          </div>
        </div>
      </section>
    {/if}

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
          {#if results && results.kind === 'pedestrian'}
            <tr>
              <th>Effective Walkway Width (ft):</th>
              <td>{results.effective_width.toFixed(1)}</td>
            </tr>
            <tr>
              <th>Peak 15-min Volume (p):</th>
              <td>{results.flow_rate_15min.toFixed(0)}</td>
            </tr>
            <tr>
              <th>Unit Flow Rate (p/ft/min):</th>
              <td>{results.unit_flow_rate.toFixed(2)}</td>
            </tr>
            <tr>
              <th>Average Pedestrian Space (ft²/p):</th>
              <td>{Number.isFinite(results.pedestrian_space) ? results.pedestrian_space.toFixed(1) : 'Unlimited'}</td>
            </tr>
            <tr>
              <th>Volume-to-Capacity Ratio:</th>
              <td>{results.vc_ratio.toFixed(2)}</td>
            </tr>
          {:else if results && results.kind === 'shared_path'}
            <tr>
              <th>Passing Events (events/h):</th>
              <td>{results.passing_events.toFixed(0)}</td>
            </tr>
            <tr>
              <th>Meeting Events (events/h):</th>
              <td>{results.meeting_events.toFixed(0)}</td>
            </tr>
            <tr>
              <th>Total Weighted Events (events/h):</th>
              <td>{results.total_events.toFixed(0)}</td>
            </tr>
          {:else if results && results.kind === 'bicycle'}
            <tr>
              <th>Active Passings per Minute:</th>
              <td>{results.active_passings_per_minute.toFixed(2)}</td>
            </tr>
            <tr>
              <th>Meetings per Minute:</th>
              <td>{results.meetings_per_minute.toFixed(2)}</td>
            </tr>
            <tr>
              <th>Effective Lanes:</th>
              <td>{results.effective_lanes}</td>
            </tr>
            <tr>
              <th>Probability of Delayed Passing:</th>
              <td>{results.probability_delayed_passing.toFixed(3)}</td>
            </tr>
            <tr>
              <th>Delayed Passings per Minute:</th>
              <td>{results.delayed_passings_per_minute.toFixed(2)}</td>
            </tr>
            <tr>
              <th>Weighted Events per Minute:</th>
              <td>{results.weighted_events_per_minute.toFixed(1)}</td>
            </tr>
            <tr>
              <th>BLOS Score:</th>
              <td>{results.blos_score.toFixed(2)}</td>
            </tr>
          {:else}
            <tr>
              <th>Results:</th>
              <td></td>
            </tr>
          {/if}
        </tbody>
      </table>
      {#if results}
        <div class="result-summary">
          <div class="result-summary-badge">
            <span class="result-summary-label">Facility LOS</span>
            <LosBadge los={results.los} size="lg" />
          </div>
          <div class="result-summary-scale">
            {#if results.kind === 'bicycle'}
              <LosScale
                measure="blos_score_path"
                value={results.blos_score}
                los={results.los}
                title="BLOS score against the Exhibit 24-5 thresholds"
              />
            {:else}
              <p class="result-summary-note">
                This mode is scored on average pedestrian space and event frequency rather than a
                single perception score, so the figures above are the service measures. See the
                table for the values the letter was read from.
              </p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>
