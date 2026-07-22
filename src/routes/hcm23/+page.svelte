<svelte:head>
  <title>HCM Calculator — Ramp Terminals and Alternative Intersections</title>
</svelte:head>

<script>
  import init, { WasmInterchange } from "HCM-middleware";
  import { onMount } from "svelte";

  let ready = false;

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Inputs (defaults follow HCM Chapter 34 Example Problem 1, a pretimed
  // three-phase conventional diamond interchange)
  let cycle_length = 160;
  let phf = 0.90;
  let base_sat_flow = 1900;
  let area_type = 'other';
  let distance = 500;
  let yellow_all_red = 5;
  let phv = 6.1;
  let ramp_grade = 2;
  let extra_dist = 100;
  let design_speed = 35;

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

  let odDemands = defaultOd();
  let laneGroups = defaultLaneGroups();

  let results = null;
  let hasError = false;
  let errMessage = '';

  function buildConfig() {
    const od = {};
    for (const d of odDemands) {
      od[d.key] = Number(d.value);
    }
    // Extra travel distances per O-D letter A..N (Exhibit 23-8 sign
    // convention: positive for left turns, negative for right turns).
    const dt = Number(extra_dist);
    const signed = [dt, -dt, -dt, dt, dt, -dt, -dt, dt, 0, 0, 0, 0, 0, 0];

    return {
      form: 'Diamond',
      cycle_length_s: Number(cycle_length),
      analysis_period_h: 0.25,
      base_saturation_flow: Number(base_sat_flow),
      area_type_cbd: area_type === 'cbd',
      peak_hour_factor: Number(phf),
      distance_between_intersections_ft: Number(distance),
      queue_spacing_ft: 25.0,
      od,
      eb_external_right_shared: true,
      wb_external_right_shared: true,
      ddi_eb_lane_config: null,
      ddi_wb_lane_config: null,
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
        pct_heavy_vehicles: g.is_ramp ? 0.0 : Number(phv),
        grade_pct: g.is_ramp ? Number(ramp_grade) : 0.0,
        lane_width_ft: 12.0,
        parking_maneuvers_h: null,
        bus_stops_h: 0.0,
        arrival_type: g.arrival,
        storage_ft: g.storage,
        lane_utilization_override: null,
        downstream_queue_lost_time_s: null,
        overlap_lost_time_s: 0.0,
        start_up_lost_time_s: 2.0,
        extension_of_green_s: 2.0,
        upstream_filtering_override: null,
        speed_limit_mph: 40.0,
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
    } catch (err) {
      console.error('Chapter 23 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    cycle_length = 160;
    phf = 0.90;
    base_sat_flow = 1900;
    area_type = 'other';
    distance = 500;
    yellow_all_red = 5;
    phv = 6.1;
    ramp_grade = 2;
    extra_dist = 100;
    design_speed = 35;
    odDemands = defaultOd();
    laneGroups = defaultLaneGroups();
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Ramp Terminals and Alternative Intersections <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">HCM Calculator — Ramp Terminals and Alternative Intersections</h1>
    <p class="page-sub">
      Estimate experienced travel time and level of service for a signalized
      conventional diamond interchange, by origin-destination movement and for
      the interchange as a whole.
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

  <form id="hcm23" on:submit|preventDefault={runAnalysis}>
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
            <input id="PHV_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="6.1" required />
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
</div>
