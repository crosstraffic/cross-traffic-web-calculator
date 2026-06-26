<script>
  import Row from '../Row/+page.svelte';
  import SubRow from '../SubRow/+page.svelte';
  import Calc from '../Calc/+page.svelte';
  import RoadDiagram from '../RoadDiagram/+page.svelte';
  import FacilityView from '../FacilityView/+page.svelte';
  import init, { WasmSegment, WasmSubSegment, WasmTwoLaneHighways } from "HCM-middleware";
  import { onMount } from "svelte";

  let lane_width = 12;
  let shoulder_width = 6;
  let apd = 2;
  let pmhvfl = 0;
  let localRows = [];

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    localRows = [{
      seg_num: 1,
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
      subrows: [{
        subseg_num: 1,
        subseg_length: '0',
        design_radius: '0',
        superelevation: '0'
      }]
    }];
  });

  let toggle_seg = -1;
  let facilityExpanded = false;
  let facilityMode = '2d';

  // Show microsimulation
  // function simResults() {

  //   var wasmSubSegment = [WasmSubSegment.new(0.0, 0.0, 0, 0.0, 0.0)];
  //   console.log(wasmSubSegment);
  //   console.log(wasmSubSegment[0].get_avg_speed());
  //   var wasmSegment = [WasmSegment.new(0, 0.75, 0.0, 50.0, false, 752.0, 0.0, 0.0, 0.0, 0, 0.0, 0.0, 1, wasmSubSegment, 0.94, 5.0, 0.0, 0.0, 0)];
  //   console.log(wasmSegment);
  //   console.log(wasmSegment[0].get_length());
  //   var wasmTwoLaneHighways = WasmTwoLaneHighways.new(wasmSegment, 12.0, 6.0, 0.0, 0.4, 0.0, 0.0);
  //   console.log(wasmTwoLaneHighways)
  //   console.log(wasmTwoLaneHighways.identify_vertical_class(0));
  //   console.log(wasmTwoLaneHighways.determine_demand_flow(0));

  // }


  function addSegment() {
    const newSubrows = [{
        subseg_num: 1,
        subseg_length: '0',
        design_radius: '0',
        superelevation: '0'
    }];
    const newSegNum = localRows.length + 1;

    localRows = [
      ...localRows,
      {
        seg_num: newSegNum,
        subrows: newSubrows,
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
      }
    ];
  }

  function removeSegment() {
    if (localRows.length > 1) {
      localRows = localRows.slice(0, localRows.length - 1);
    }
  }

  function changeSegment(seg_num) {
    localRows = localRows.map(row => {
      if (row.seg_num !== seg_num) return row;

      // default demand volumes based on passing type
      let vi = '1000';
      let vo = '0';

      if (row.passing_type === 'Passing Constrained') {
        vo = '1500';
      }

      return {
        ...row,
        vi,
        vo
      };
    });
  }

  // Toggle HC param slider
  function toggleHCParams(seg_num, checked) {
    
    if (checked) {
      if (toggle_seg == -1 || toggle_seg == seg_num) {
        toggle_seg = seg_num;
      } else {
        console.log('Cannot toggle more than one');
      }
    } else {
      if (toggle_seg == seg_num) {
        toggle_seg = -1;
      }
    }
  }

  // If check horizontal curves button
  function changeHC(seg_num, checked){
    if (checked) {
      toggle_seg = seg_num;
      toggleHCParams(seg_num, checked);
    }

    if (!checked && (toggle_seg === seg_num)) {
      toggle_seg = -1;
    }
  }

  function addSubSegment(_seg_num) {
    localRows = localRows.map(row => {
      if (row.seg_num !== _seg_num) return row;

      const newSubrows = [
        ...row.subrows,
        {
          subseg_num: row.subrows.length + 1,
          subseg_length: '0',
          design_radius: '0',
          superelevation: '0'
        }
      ];

      return { ...row, subrows: newSubrows };
    });
  }

  function removeSubSegment(_seg_num) {
      localRows = localRows.map(row => {
      if (row.seg_num !== _seg_num) return row;

      if (row.subrows.length > 1) {
        return {
          ...row,
          subrows: row.subrows.slice(0, row.subrows.length - 1)
        };
      }
      return row;
    });
  }

  let hasError = false;
  let isSuccessVisible = false;
  let submitted = false;
  let errMessage = "Here is the error";

  function handleSubmit(){
    submitted = true;
    isSuccessVisible = true;

    setTimeout(function(){
        isSuccessVisible = false;
    }, 4000);
  }

  let json;
	
	async function jsonInputHandler(e) {
		const file = e.target.files?.[0];
		if (!file) {
			json = null;
			return;
		}
		
    try {

      const result = await readJsonFile(file);
      json = result;
      fillInJsonValue(json);
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
          const parsed = JSON.parse(reader.result);
          resolve(parsed);
        } catch (err) {
          reject(new Error("Invalid JSON structure."));
        }
      };

      reader.onerror = () => reject(new Error("File reading error."));
      reader.readAsText(file);
    });
	}

  async function fillInJsonValue(json) {

    lane_width = json.lane_width;
    shoulder_width = json.shoulder_width;
    apd = json.apd;
    pmhvfl = json.pmhvfl;
    const passTypes = ["Passing Constrained", "Passing Zone", "Passing Lane"];

    localRows = json.segments.map((segment, index) => {

      const passTypeText = passTypes[segment.passing_type] ?? "";

      return {
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
        passing_type: passTypeText,
        subrows: segment.subsegments.map((subseg, j) => ({
          subseg_num: j + 1,
          subseg_length: subseg.length,
          design_radius: subseg.design_radius,
          superelevation: subseg.superelevation
        }))
      };
    });
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
          hor_class: 0
        }))
      }))
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

    localRows = [{
      seg_num: 1,
      passing_type: "",
      seg_length: "",
      seg_grade: "0",
      seg_spl: "",
      is_hc: false,
      vi: "0",
      vo: "0",
      vertical_class: "1",
      phf: "0.95",
      phv: "5",
      subrows: [{
        subseg_num: 1,
        subseg_length: 0,
        design_radius: 0,
        superelevation: 0
      }]
    }];


    // Reset result fields
    const resultKeys = ["ffs", "avgspd", "pf", "fd", "seglos"];
    resultKeys.forEach((key) => {
      for (let i = 1; i <= localRows.length; i++) {
        const el = document.getElementById(`${key}${i}`);
        if (el) el.innerText = "";
      }
    });
    const los = document.getElementById("los");
    const fdF = document.getElementById("fdF");
    if (los) los.innerHTML = "Facility LOS: ";
    if (fdF) fdF.innerHTML = "Facility Follower Density: ";
  }


</script>


<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">Chapter 15 · Two-Lane Highways</span>
    <h1 class="page-title">HCM Calculator — Chapter 15</h1>
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

  <form
    id="hcm15"
    class="submitted:opacity-50 transition-opacity duration-300"
    on:submit|preventDefault={handleSubmit}
  >
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
        on:change={jsonInputHandler}
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
          <button class="btn btn-outline btn-sm" on:click={addSegment} type="button">+ Add Segment</button>
          <button class="btn btn-ghost btn-sm" on:click={removeSegment} type="button">Remove</button>
        </div>
      </div>
      <div class="w-full overflow-x-auto">
      <table class="table seg-table w-full">
        <thead>
          <tr>
            <!-- <th>Active</th> -->
            <th>#</th>
            <th>Passing Type</th>
            <th>Length</th>
            <th>Grade</th>
            <th>Posted Speed</th>
            <th>Horiz. Curves</th>
            <th>Horiz. Params</th>
            <th>Demand Vol.</th>
            <th>Opposing Vol.</th>
            <th>Vertical Class</th>
            <th>PHF</th>
            <th>% Heavy Veh.</th>
          </tr>
        </thead>
        <tbody>
          {#each localRows as row, i (row.seg_num)}
            <Row bind:row={localRows[i]} seg_num={row.seg_num} changeSegment={changeSegment} changeHC={changeHC} toggleHCParams={toggleHCParams} />
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
      <!-- Parameter Inputs -->
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

      <!-- Segment Subtables -->
      <div class="hc-subtables">
        {#each localRows as row}
          {#if row.is_hc}
            <div class="hc-card" id="hc_table{row.seg_num}">
              <div class="hc-card-head">
                <h3>Segment {row.seg_num} · Horizontal Curves</h3>
                <div class="flex gap-2">
                  <button class="btn btn-outline btn-sm" on:click={() => addSubSegment(row.seg_num)} type="button">Add</button>
                  <button class="btn btn-ghost btn-sm" on:click={() => removeSubSegment(row.seg_num)} type="button">Remove</button>
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
                  {#each row.subrows as subrow}
                    <SubRow bind:subrow={subrow} subseg_num={subrow.subseg_num} />
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
              ? 'Edit each segment here — changes stay in sync with the Segments table.'
              : 'Visual sequence of the configured segments. Expand to edit them here.'}
          </p>
        </div>
        <div class="panel-actions">
          <div class="view-toggle" role="group" aria-label="Facility view mode">
            <button type="button" class="vt-btn" class:active={facilityMode === '2d'} on:click={() => (facilityMode = '2d')}>2D</button>
            <button type="button" class="vt-btn" class:active={facilityMode === '3d'} on:click={() => (facilityMode = '3d')}>3D</button>
          </div>
          {#if facilityExpanded}
            <button class="btn btn-outline btn-sm" on:click={addSegment} type="button">+ Add Segment</button>
            <button class="btn btn-ghost btn-sm" on:click={removeSegment} type="button">Remove</button>
          {/if}
          <button
            type="button"
            class="btn btn-outline btn-sm"
            aria-expanded={facilityExpanded}
            on:click={() => (facilityExpanded = !facilityExpanded)}
          >
            {facilityExpanded ? 'Collapse' : 'Expand & Edit'}
          </button>
        </div>
      </div>

      <div class="facility-overview" class:flat={facilityMode === '2d'}>
        {#if facilityMode === '3d'}
          <FacilityView rows={localRows} laneWidth={lane_width} />
        {:else}
          <div class="facility-strip" id="seg_imgs">
            {#each localRows as row}
              <div class="facility-seg" style="flex: {Number(row.seg_length) > 0 ? Number(row.seg_length) : 1} 1 0;">
                <div class="facility-seg-head">
                  <span class="seg-no">{row.seg_num}</span>
                  <span class="facility-seg-type">{row.passing_type || 'Not set'}</span>
                </div>
                <div class="facility-seg-img">
                  <RoadDiagram type={row.passing_type} />
                </div>
                <div class="facility-seg-len">
                  {Number(row.seg_length) > 0 ? row.seg_length + ' mi' : '—'}
                </div>
              </div>
            {/each}
          </div>
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
                  on:change={() => changeSegment(row.seg_num)}
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
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    bind:checked={localRows[i].is_hc}
                    on:change={(e) => changeHC(row.seg_num, e.target.checked)}
                  />
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
      <button class="btn btn-ghost" on:click={resetParams} type="button">Reset Params</button>
      <button class="btn btn-outline" on:click={jsonOutputHandler} id="jsonOutput" type="button">Export as JSON</button>
      <Calc {lane_width} {shoulder_width} {apd} {pmhvfl} rows_len={localRows.length} rows={localRows}/>
    </div>

  </form>

  <!-- <canvas id="simulation-canvas"></canvas> -->
  <pre id="simulation-canvas"></pre>

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
          <th></th>
          {#each localRows as row}
            <th>Segment {row.seg_num}</th>
          {/each}
        </tr>
      </thead>

      <tbody>
        <tr>
          <th id="ffs">Free-flow Speed (mi/hr): </th>
          {#each localRows as row}
            <td id="ffs{row.seg_num}"></td>
          {/each}
        </tr>
        <tr>
          <th id="avgspd">Average Speed (mi/hr): </th>
          {#each localRows as row}
            <td id="avgspd{row.seg_num}"></td>
          {/each}
        </tr>
        <tr>
          <th id="pf">Percent followers in the <br> analysis direction (%): </th>
          {#each localRows as row}
            <td id="pf{row.seg_num}"></td>
          {/each}
        </tr>
        <tr>
          <th id="fd">Followers Density (followers/mi): </th>
          {#each localRows as row}
            <td id="fd{row.seg_num}"></td>
          {/each}
        </tr>
        <tr>
          <th id="seglos">Segment LOS: </th>
          {#each localRows as row}
            <td id="seglos{row.seg_num}"></td>
          {/each}
        </tr>
      </tbody>
    </table>
    <div class="facility-summary">
      <p id="los">Facility LOS: </p>
      <p id="fdF">Facility Follower Density: </p>
      <p id="error">Error Message: </p>
    </div>
  </div>
  </section>

</div>