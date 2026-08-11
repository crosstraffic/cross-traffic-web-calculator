<svelte:head>
  <title>Two-Lane Highways · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmSegment, WasmSubSegment, WasmTwoLaneHighways } from "HCM-middleware";
  import RoadDiagram from '$lib/RoadDiagram.svelte';
  import TwoLaneStrip from '$lib/TwoLaneStrip.svelte';
  import TwoLaneFacility3D from '$lib/TwoLaneFacility3D.svelte';
  import ViewToggle from '$lib/ViewToggle.svelte';
  import { setReport } from '$lib/report';
  import { onMount } from "svelte";

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  function blankSegment(seg_num) {
    return {
      seg_num,
      passing_type: '',
      seg_length: '',
      seg_grade: '0',
      seg_spl: '',
      is_hc: false,
      vi: '0',
      vo: '0',
      vertical_class: '1',
      phf: '0.95',
      phv: '5',
      // Subsegment lengths are in FEET while the segment length above is in
      // miles. The unit labels in both tables say so; the engine expects it.
      subrows: [{ subseg_num: 1, subseg_length: '0', design_radius: '0', superelevation: '0' }],
    };
  }

  let lane_width = $state(12);
  let shoulder_width = $state(6);
  let apd = $state(2);
  let pmhvfl = $state(0);
  let localRows = $state([blankSegment(1)]);

  let facilityExpanded = $state(false);
  let facilityMode = $state('2d');
  let selectedSeg = $state(-1);

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  function addSegment() {
    localRows = [...localRows, blankSegment(localRows.length + 1)];
  }

  function removeSegment() {
    if (localRows.length > 1) {
      localRows = localRows.slice(0, localRows.length - 1);
      if (selectedSeg >= localRows.length) selectedSeg = -1;
    }
  }

  function changeSegment(seg_num) {
    localRows = localRows.map((row) => {
      if (row.seg_num !== seg_num) return row;
      // Demand volumes get a starting point that suits the new passing type.
      return { ...row, vi: '1000', vo: row.passing_type === 'Passing Constrained' ? '1500' : '0' };
    });
  }

  function addSubSegment(seg_num) {
    localRows = localRows.map((row) => {
      if (row.seg_num !== seg_num) return row;
      return {
        ...row,
        subrows: [
          ...row.subrows,
          { subseg_num: row.subrows.length + 1, subseg_length: '0', design_radius: '0', superelevation: '0' },
        ],
      };
    });
  }

  function removeSubSegment(seg_num) {
    localRows = localRows.map((row) => {
      if (row.seg_num !== seg_num || row.subrows.length <= 1) return row;
      return { ...row, subrows: row.subrows.slice(0, row.subrows.length - 1) };
    });
  }

  function selectSeg(i) {
    selectedSeg = selectedSeg === i ? -1 : i;
  }

  let json;

  async function jsonInputHandler(e) {
    const file = e.target.files?.[0];
    if (!file) {
      json = null;
      return;
    }

    try {
      json = await readJsonFile(file);
      fillInJsonValue(json);
      hasError = false;
    } catch (err) {
      console.error("Error reading JSON file:", err);
      json = null;
      hasError = true;
      errMessage = "Invalid JSON file. Please upload a valid file.";
    }
  }

  function readJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (err) {
          reject(new Error("Invalid JSON structure."));
        }
      };

      reader.onerror = () => reject(new Error("File reading error."));
      reader.readAsText(file);
    });
  }

  function fillInJsonValue(json) {
    lane_width = json.lane_width;
    shoulder_width = json.shoulder_width;
    apd = json.apd;
    pmhvfl = json.pmhvfl;
    const passTypes = ["Passing Constrained", "Passing Zone", "Passing Lane"];

    localRows = json.segments.map((segment, index) => ({
      seg_num: index + 1,
      seg_length: segment.length,
      seg_grade: segment.grade,
      seg_spl: segment.spl,
      is_hc: segment.is_hc,
      vi: segment.volume,
      vo: segment.volume_op,
      vertical_class: segment.vertical_class,
      phf: segment.phf,
      phv: segment.phv,
      passing_type: passTypes[segment.passing_type] ?? "",
      subrows: segment.subsegments.map((subseg, j) => ({
        subseg_num: j + 1,
        subseg_length: subseg.length,
        design_radius: subseg.design_radius,
        superelevation: subseg.superelevation,
      })),
    }));
    results = null;
    selectedSeg = -1;
  }

  function jsonOutputHandler() {
    const jsonData = {
      lane_width,
      shoulder_width,
      apd,
      pmhvfl,
      l_de: 0.0,
      segments: localRows.map((row) => ({
        passing_type: ["Passing Constrained", "Passing Zone", "Passing Lane"].indexOf(row.passing_type),
        length: row.seg_length,
        grade: row.seg_grade,
        spl: row.seg_spl,
        is_hc: row.is_hc,
        volume: row.vi,
        volume_op: row.vo,
        vertical_class: row.vertical_class,
        phf: row.phf,
        phv: row.phv,
        flow_rate: 0.0,
        flow_rate_o: 0.0,
        capacity: 0,
        ffs: 0.0,
        avg_speed: 0.0,
        pf: 0.0,
        fd: 0.0,
        fd_mid: 0.0,
        hor_class: 0,
        subsegments: row.subrows.map((subrow) => ({
          length: subrow.subseg_length,
          design_radius: subrow.design_radius,
          superelevation: subrow.superelevation,
          avg_speed: 0.0,
          hor_class: 0,
        })),
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(jsonData));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'hcm15_output.json';
    a.click();
  }

  function resetParams() {
    lane_width = 12;
    shoulder_width = 6;
    apd = 2;
    pmhvfl = 0;
    localRows = [blankSegment(1)];
    selectedSeg = -1;
    results = null;
    hasError = false;
  }

  const r3 = (v) => Math.round(v * 1000) / 1000;
  const r2 = (v) => Math.round(v * 100) / 100;

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const wasmSegment = localRows.map((row) => {
        // Left undefined when no type is picked, so an incomplete segment
        // reaches the engine the same way it always has rather than as a
        // plausible-looking index.
        let passing_type;
        if (row.passing_type === "Passing Constrained") passing_type = 0;
        else if (row.passing_type === "Passing Zone") passing_type = 1;
        else if (row.passing_type === "Passing Lane") passing_type = 2;

        // The subsegment constructor order is (length, avg_speed, design_rad,
        // central_angle, hor_class, sup_ele), which is NOT the core
        // SubSegment::new order. Lengths here are feet.
        const wasmSubSegment = (row.is_hc && row.subrows.length > 0)
          ? row.subrows.map((subrow) => new WasmSubSegment(
              parseFloat(String(subrow.subseg_length)),
              0,
              parseFloat(String(subrow.design_radius)),
              0,
              0,
              parseFloat(String(subrow.superelevation))
            ))
          : [new WasmSubSegment()];

        // spl is the POSTED speed limit, not the free-flow speed.
        return new WasmSegment(
          parseInt(passing_type), row.seg_length, row.seg_grade, row.seg_spl, row.is_hc,
          row.vi, row.vo, 0.0, 0.0, 0, 0.0, 0.0, row.vertical_class, wasmSubSegment,
          row.phf, row.phv, 0.0, 0.0, 0.0, 0
        );
      });

      const facility = new WasmTwoLaneHighways(wasmSegment, lane_width, shoulder_width, apd, pmhvfl);

      const segs = [];
      let s_tot = 0, tot_len = 0;

      for (let i = 0; i < localRows.length; i++) {
        facility.identify_vertical_class(i);
        const [, , capacity] = facility.determine_demand_flow(i);
        facility.determine_vertical_alignment(i);
        const ffs = facility.determine_free_flow_speed(i);
        const [s] = facility.estimate_average_speed(i);
        const pf = facility.estimate_percent_followers(i);

        // A passing lane reports its midpoint follower density; every other
        // segment reports the plain value, or the adjusted one when it falls
        // inside the effective length downstream of a passing lane.
        // determine_adjustment_to_follower_density runs for every segment,
        // passing lanes included, because it advances the engine's
        // passing-lane bookkeeping that later segments read.
        const isPl = facility.get_segments()[i].passing_type == 2;
        let fd_out, fd;
        if (isPl) {
          const [, fd_mid] = facility.determine_follower_density_pl(i);
          fd_out = fd_mid;
        } else {
          fd = facility.determine_follower_density_pc_pz(i);
        }
        const fd_adj = facility.determine_adjustment_to_follower_density(i);
        if (!isPl) {
          fd_out = fd_adj > 0.0 ? fd_adj : fd;
        }

        const seg_len = facility.get_segments()[i].length;
        s_tot += s * seg_len;
        tot_len += seg_len;

        segs.push({
          ffs: r3(ffs),
          avgspd: r3(s),
          pf: r3(pf),
          fd: r3(fd_out),
          los: facility.determine_segment_los(i, s, capacity),
        });
      }

      // Step 11 (Equation 15-39). The engine does the length weighting, and it
      // picks FD_i per segment the same way the column above does, since
      // Equation 15-39 reads "follower density, or adjusted follower density".
      // Weighting the column here instead would agree today and stop agreeing
      // the moment the equation is corrected again, which is what happened
      // when the library centralized this. Safe to call after the loop above:
      // the binding restores the passing-lane bookkeeping the loop advanced.
      const fd_f = facility.determine_facility_follower_density();
      const average_speed = s_tot / tot_len;
      const facilityLos = facility.determine_facility_los(fd_f, average_speed);

      results = { segs, facilityLos, facilityFd: r3(fd_f) };

      setReport({
        chapter: 'Two-Lane Highways',
        chapterRef: 'HCM Chapter 15',
        href: '/hcm15',
        generatedAt: new Date().toLocaleString(),
        headline: { label: 'Facility LOS', value: facilityLos },
        inputs: [
          { label: 'Lane width', value: `${lane_width} ft` },
          { label: 'Shoulder width', value: `${shoulder_width} ft` },
          { label: 'Access point density', value: `${apd} /mi` },
          { label: 'Heavy vehicles in passing lane', value: `${pmhvfl} %` },
          { label: 'Segments', value: localRows.length },
        ],
        resultTable: {
          columns: ['Quantity', ...segs.map((_, i) => `Segment ${i + 1}`)],
          rows: [
            ['Free-flow speed (mi/h)', ...segs.map((r) => r2(r.ffs))],
            ['Average speed (mi/h)', ...segs.map((r) => r2(r.avgspd))],
            ['Percent followers (%)', ...segs.map((r) => r2(r.pf))],
            ['Follower density (followers/mi)', ...segs.map((r) => r2(r.fd))],
            ['Segment LOS', ...segs.map((r) => r.los)],
          ],
        },
        summary: [
          { label: 'Facility LOS', value: facilityLos },
          { label: 'Facility follower density', value: `${r3(fd_f)} followers/mi` },
        ],
        methodology: [
          'HCM 7th Edition Chapter 15 (Two-Lane Highways).',
          'Service measure: follower density (followers/mi); the facility value is length-weighted across segments.',
          'Level of service is keyed on follower density; thresholds depend on posted speed (see the HCM).',
        ],
        diagram: {
          kind: 'twolane',
          props: {
            rows: JSON.parse(JSON.stringify(localRows)),
            laneWidth: Number(lane_width),
            results: JSON.parse(JSON.stringify(results)),
          },
        },
      });
    } catch (err) {
      console.error('Chapter 15 analysis failed:', err);
      hasError = true;
      errMessage = typeof err === 'string'
        ? err
        : (err && err.message) || 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 15</span>
    <h1 class="page-title">Two-Lane Highways</h1>
    <p class="page-sub">
      Estimate free-flow speed, follower density, average speed, and level of
      service for two-lane highway facilities, segment by segment.
    </p>
  </header>

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm15" onsubmit={preventDefault(runAnalysis)}>
    <!-- Import -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Import</h2>
          <p class="panel-sub">Optionally load a previously exported analysis.</p>
        </div>
      </div>
      <label for="jsonInput" class="block text-sm font-medium mb-1">JSON file</label>
      <input
        type="file"
        id="jsonInput"
        onchange={jsonInputHandler}
        class="file-input file-input-bordered w-full max-w-xs"
        accept=".json"
      />
    </section>

    <!-- Segments -->
    <section class="panel">
      <div class="panel-head with-actions">
        <div>
          <h2 class="panel-title">Segments</h2>
          <p class="panel-sub">Define the passing type and traffic characteristics of each segment.</p>
        </div>
        <div class="panel-actions">
          <button class="btn btn-outline btn-sm" onclick={addSegment} type="button">+ Add Segment</button>
          <button class="btn btn-ghost btn-sm" onclick={removeSegment} type="button">Remove</button>
        </div>
      </div>
      <div class="w-full overflow-x-auto">
        <table class="table seg-table w-full">
          <thead>
            <tr>
              <th>#</th>
              <th>Passing Type</th>
              <th>Length</th>
              <th>Grade</th>
              <th>Posted Speed</th>
              <th>Horiz. Curves</th>
              <th>Demand Vol.</th>
              <th>Opposing Vol.</th>
              <th>Vertical Class</th>
              <th>PHF</th>
              <th>% Heavy Veh.</th>
            </tr>
          </thead>
          <tbody>
            {#each localRows as row, i (row.seg_num)}
              <tr class="subseg{row.seg_num}" class:seg-selected={selectedSeg === i} onclick={() => (selectedSeg = i)}>
                <td><span class="seg-no">{row.seg_num}</span></td>
                <td>
                  <select
                    class="select select-bordered select-sm passing_type"
                    id="passing_type{row.seg_num}"
                    name="pass_type"
                    bind:value={localRows[i].passing_type}
                    onchange={() => changeSegment(row.seg_num)}
                    required
                  >
                    <option value="" disabled selected>Select type</option>
                    <option>Passing Constrained</option>
                    <option>Passing Zone</option>
                    <option>Passing Lane</option>
                  </select>
                </td>
                <td>
                  <div class="cell-field">
                    <input
                      type="text"
                      id="seg_length{row.seg_num}"
                      name="seg_len"
                      bind:value={localRows[i].seg_length}
                      placeholder="0.0"
                      class="input input-bordered input-sm seg_length"
                      pattern="[+]?([0-9]|[0-9]*([.][0-9][0-9]*)|[1-9]|[1-9][0-9])$"
                      autocomplete="off"
                      required />
                    <span class="unit">mi</span>
                  </div>
                </td>
                <td>
                  <div class="cell-field">
                    <input
                      type="text"
                      id="seg_grade{row.seg_num}"
                      name="grade"
                      bind:value={localRows[i].seg_grade}
                      placeholder="0"
                      class="input input-bordered input-sm seg_grade"
                      pattern="[+\-]?([0-9]|[0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
                      autocomplete="off"
                      required />
                    <span class="unit">%</span>
                  </div>
                </td>
                <td>
                  <div class="cell-field">
                    <input
                      type="text"
                      id="seg_Spl{row.seg_num}"
                      name="posted speed"
                      bind:value={localRows[i].seg_spl}
                      placeholder="0"
                      class="input input-bordered input-sm seg_spl"
                      pattern="[+]?([1-9]|[1-9][0-9]|[1-9][0-9][0-9])$"
                      autocomplete="off"
                      required />
                    <span class="unit">mph</span>
                  </div>
                </td>
                <td class="cell-center">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm is_hc"
                    id="is_hc{row.seg_num}"
                    name="hor_cur"
                    bind:checked={localRows[i].is_hc}
                  />
                </td>
                <td>
                  <div class="cell-field">
                    <input
                      type="text"
                      id="vi_input{row.seg_num}"
                      name="vd"
                      bind:value={localRows[i].vi}
                      placeholder="0"
                      class="input input-bordered input-sm vi_input"
                      pattern="[+]?([0-9]*|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
                      autocomplete="off"
                      required />
                    <span class="unit">veh/h</span>
                  </div>
                </td>
                <td>
                  <div class="cell-field">
                    <input
                      type="text"
                      id="vo_input{row.seg_num}"
                      name="vo"
                      bind:value={localRows[i].vo}
                      placeholder="0"
                      class="input input-bordered input-sm vo_input"
                      pattern="[+]?([0-9]*|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
                      autocomplete="off"
                      required />
                    <span class="unit">veh/h</span>
                  </div>
                </td>
                <td>
                  <select class="select select-bordered select-sm" id="vc_select{row.seg_num}" name="ver_cls" bind:value={localRows[i].vertical_class} required>
                    <option>1</option>
                    <option>2</option>
                    <option>3</option>
                    <option>4</option>
                    <option>5</option>
                  </select>
                </td>
                <td>
                  <div class="cell-field">
                    <input
                      type="text"
                      id="PHF_input{row.seg_num}"
                      placeholder="0.95"
                      class="input input-bordered input-sm PHF_input"
                      bind:value={localRows[i].phf}
                      pattern="[+]?([0-9]*([.][0-9]*))$"
                      autocomplete="off"
                      required />
                  </div>
                </td>
                <td>
                  <div class="cell-field">
                    <input
                      type="text"
                      id="PHV_input{row.seg_num}"
                      placeholder="5"
                      class="input input-bordered input-sm PHV_input"
                      bind:value={localRows[i].phv}
                      pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
                      autocomplete="off"
                      required />
                    <span class="unit">%</span>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Parameters & horizontal curves -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">General Parameters</h2>
          <p class="panel-sub">Facility-wide values and horizontal-curve subsegments.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="LW_input">Lane Width</label>
          <div class="cell-field">
            <input
              id="LW_input"
              type="text"
              class="input input-bordered input-sm"
              bind:value={lane_width}
              placeholder="12"
              pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
              required
            />
            <span class="unit">ft</span>
          </div>
        </div>

        <div class="param-field">
          <label for="SW_input">Shoulder Width</label>
          <div class="cell-field">
            <input
              id="SW_input"
              type="text"
              class="input input-bordered input-sm"
              placeholder="6"
              bind:value={shoulder_width}
              pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
              required
            />
            <span class="unit">ft</span>
          </div>
        </div>

        <div class="param-field">
          <label for="APD_input">Access Point Density</label>
          <div class="cell-field">
            <input
              id="APD_input"
              type="text"
              class="input input-bordered input-sm"
              placeholder="2"
              bind:value={apd}
              pattern="[+]?([0-9]|[0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
              required
            />
            <span class="unit">/mi</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PMHVFL_input">Heavy Vehicles in Passing Lane</label>
          <div class="cell-field">
            <input
              id="PMHVFL_input"
              type="text"
              class="input input-bordered input-sm"
              placeholder="0"
              bind:value={pmhvfl}
              pattern="[+]?([0-9]|[0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
              required
            />
            <span class="unit">%</span>
          </div>
          <p class="param-hint">Only applied when a Passing Lane segment is present.</p>
        </div>
      </div>

      <!-- Horizontal-curve subsegments, one card per segment that has them -->
      <div class="hc-subtables">
        {#each localRows as row, i (row.seg_num)}
          {#if row.is_hc}
            <div class="hc-card" id="hc_table{row.seg_num}">
              <div class="hc-card-head">
                <h3>Segment {row.seg_num} · Horizontal Curves</h3>
                <div class="flex gap-2">
                  <button class="btn btn-outline btn-sm" onclick={() => addSubSegment(row.seg_num)} type="button">Add</button>
                  <button class="btn btn-ghost btn-sm" onclick={() => removeSubSegment(row.seg_num)} type="button">Remove</button>
                </div>
              </div>

              <table class="table seg-table table-compact w-full">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Length</th>
                    <th>Design Radius</th>
                    <th>Superelevation</th>
                  </tr>
                </thead>
                <tbody>
                  {#each row.subrows as subrow, si}
                    <tr>
                      <td><span class="seg-no">{subrow.subseg_num}</span></td>
                      <td>
                        <div class="cell-field">
                          <input
                            type="text"
                            placeholder="0"
                            id="subseg_len{subrow.subseg_num}"
                            name="subseg_len"
                            class="subseg_len{subrow.subseg_num} input input-bordered input-sm"
                            pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
                            bind:value={localRows[i].subrows[si].subseg_length}
                            autocomplete="off" />
                          <!-- feet, unlike the segment length above -->
                          <span class="unit">ft</span>
                        </div>
                      </td>
                      <td>
                        <div class="cell-field">
                          <input
                            type="text"
                            placeholder="0"
                            id="design_radius{subrow.subseg_num}"
                            class="design_radius{subrow.subseg_num} input input-bordered input-sm"
                            pattern="[+]?([0-9]*([.][0-9]*)|[0-9]|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
                            bind:value={localRows[i].subrows[si].design_radius}
                            autocomplete="off" />
                          <span class="unit">ft</span>
                        </div>
                      </td>
                      <td>
                        <div class="cell-field">
                          <input
                            type="text"
                            placeholder="0"
                            id="superelevation{subrow.subseg_num}"
                            class="superelevation{subrow.subseg_num} input input-bordered input-sm"
                            pattern="[+\-]?([0-9]*([.][0-9]*)|[0-9]|[1-9][0-9])$"
                            bind:value={localRows[i].subrows[si].superelevation}
                            autocomplete="off" />
                          <span class="unit">%</span>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {/each}
      </div>
    </section>

    <!-- Facility Layout -->
    <section class="panel">
      <div class="panel-head with-actions">
        <div>
          <h2 class="panel-title">Facility Layout</h2>
          <p class="panel-sub">
            {facilityExpanded
              ? 'Edit each segment here. Changes stay in sync with the Segments table.'
              : 'Visual sequence of the configured segments. Select one in either view to highlight its row. Expand to edit them here.'}
          </p>
        </div>
        <div class="panel-actions">
          <ViewToggle bind:mode={facilityMode} label="Facility view mode" />
          {#if facilityExpanded}
            <button class="btn btn-outline btn-sm" onclick={addSegment} type="button">+ Add Segment</button>
            <button class="btn btn-ghost btn-sm" onclick={removeSegment} type="button">Remove</button>
          {/if}
          <button
            type="button"
            class="btn btn-outline btn-sm"
            aria-expanded={facilityExpanded}
            onclick={() => (facilityExpanded = !facilityExpanded)}
          >
            {facilityExpanded ? 'Collapse' : 'Expand & Edit'}
          </button>
        </div>
      </div>

      <div class="facility-overview" class:flat={facilityMode === '2d'}>
        {#if facilityMode === '3d'}
          <TwoLaneFacility3D rows={localRows} laneWidth={lane_width} {results}
                             selected={selectedSeg} onselect={selectSeg} />
        {:else}
          <TwoLaneStrip rows={localRows} {results} selected={selectedSeg} onselect={selectSeg} />
        {/if}
      </div>

      {#if facilityExpanded}
        <div class="facility-grid">
          {#each localRows as row, i (row.seg_num)}
            <div class="facility-card">
              <div class="facility-card-head">
                <span class="seg-no">{row.seg_num}</span>
                <select
                  class="select select-bordered select-sm"
                  bind:value={localRows[i].passing_type}
                  onchange={() => changeSegment(row.seg_num)}
                >
                  <option value="" disabled>Select type</option>
                  <option>Passing Constrained</option>
                  <option>Passing Zone</option>
                  <option>Passing Lane</option>
                </select>
              </div>

              <div class="facility-seg-img">
                <RoadDiagram type={row.passing_type} />
              </div>

              <div class="facility-fields">
                <label class="ff">
                  <span>Length</span>
                  <span class="cell-field">
                    <input class="input input-bordered input-sm" bind:value={localRows[i].seg_length} placeholder="0.0" autocomplete="off" />
                    <span class="unit">mi</span>
                  </span>
                </label>
                <label class="ff">
                  <span>Grade</span>
                  <span class="cell-field">
                    <input class="input input-bordered input-sm" bind:value={localRows[i].seg_grade} placeholder="0" autocomplete="off" />
                    <span class="unit">%</span>
                  </span>
                </label>
                <label class="ff">
                  <span>Posted Speed</span>
                  <span class="cell-field">
                    <input class="input input-bordered input-sm" bind:value={localRows[i].seg_spl} placeholder="0" autocomplete="off" />
                    <span class="unit">mph</span>
                  </span>
                </label>
                <label class="ff">
                  <span>Vertical Class</span>
                  <select class="select select-bordered select-sm" bind:value={localRows[i].vertical_class}>
                    <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
                  </select>
                </label>
                <label class="ff">
                  <span>Demand Vol.</span>
                  <span class="cell-field">
                    <input class="input input-bordered input-sm" bind:value={localRows[i].vi} placeholder="0" autocomplete="off" />
                    <span class="unit">veh/h</span>
                  </span>
                </label>
                <label class="ff">
                  <span>Opposing Vol.</span>
                  <span class="cell-field">
                    <input class="input input-bordered input-sm" bind:value={localRows[i].vo} placeholder="0" autocomplete="off" />
                    <span class="unit">veh/h</span>
                  </span>
                </label>
                <label class="ff">
                  <span>PHF</span>
                  <span class="cell-field">
                    <input class="input input-bordered input-sm" bind:value={localRows[i].phf} placeholder="0.95" autocomplete="off" />
                  </span>
                </label>
                <label class="ff">
                  <span>% Heavy Veh.</span>
                  <span class="cell-field">
                    <input class="input input-bordered input-sm" bind:value={localRows[i].phv} placeholder="5" autocomplete="off" />
                    <span class="unit">%</span>
                  </span>
                </label>
                <label class="ff ff-check">
                  <input type="checkbox" class="checkbox checkbox-sm" bind:checked={localRows[i].is_hc} />
                  <span>Horizontal curves</span>
                </label>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Form Actions -->
    <div class="action-bar">
      <button class="btn btn-ghost" onclick={resetParams} type="button">Reset Params</button>
      <button class="btn btn-outline" onclick={jsonOutputHandler} id="jsonOutput" type="button">Export as JSON</button>
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
            <th></th>
            {#each localRows as row}
              <th>Segment {row.seg_num}</th>
            {/each}
          </tr>
        </thead>

        <tbody>
          <tr>
            <th id="ffs">Free-flow Speed (mi/hr): </th>
            {#each localRows as row, i}
              <td id="ffs{row.seg_num}">{results && results.segs[i] ? results.segs[i].ffs : ''}</td>
            {/each}
          </tr>
          <tr>
            <th id="avgspd">Average Speed (mi/hr): </th>
            {#each localRows as row, i}
              <td id="avgspd{row.seg_num}">{results && results.segs[i] ? results.segs[i].avgspd : ''}</td>
            {/each}
          </tr>
          <tr>
            <th id="pf">Percent followers in the <br> analysis direction (%): </th>
            {#each localRows as row, i}
              <td id="pf{row.seg_num}">{results && results.segs[i] ? results.segs[i].pf : ''}</td>
            {/each}
          </tr>
          <tr>
            <th id="fd">Followers Density (followers/mi): </th>
            {#each localRows as row, i}
              <td id="fd{row.seg_num}">{results && results.segs[i] ? results.segs[i].fd : ''}</td>
            {/each}
          </tr>
          <tr>
            <th id="seglos">Segment LOS: </th>
            {#each localRows as row, i}
              <td id="seglos{row.seg_num}">{results && results.segs[i] ? results.segs[i].los : ''}</td>
            {/each}
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p id="los">Facility LOS: {results ? results.facilityLos : ''}</p>
        <p id="fdF">Facility Follower Density: {results ? results.facilityFd : ''}</p>
      </div>
    </div>
  </section>
</div>
