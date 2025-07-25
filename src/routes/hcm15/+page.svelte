<script>
  import Row from '../Row/+page.svelte';
  import SubRow from '../SubRow/+page.svelte';
  import Calc from '../Calc/+page.svelte';
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
      img_src: 'segment.jpg',
      subrows: [{
        subseg_num: 1,
        subseg_length: '0',
        design_radius: '0',
        superelevation: '0'
      }]
    }];
  });

  let toggle_seg = -1;

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
        img_src: 'segment.jpg',
        passing_type: '',
        seg_length: '',
        seg_grade: '0',
        seg_spl: '',
        is_hc: false,
        vi: '0',
        vo: '0',
        vertical_class: '1',
        is_hc: false,
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

      // logic based on passing type
      let img_src = 'segment.jpg';
      let vi = '1000';
      let vo = '0';
      let caption = 'Undefined';
      let img_width = 100;
      let img_height = 100;

      switch (row.passing_type) {
        case 'Passing Zone':
          img_src = 'PassingZone.png';
          img_height = 100;
          img_width = 100;
          caption = 'Passing Zone';
          break;
        case 'Passing Constrained':
          img_src = 'PassingConstrained.png';
          vo = '1500';
          img_height = 100;
          img_width = 100;
          caption = 'Passing Constrained';
          break;
        case 'Passing Lane':
          img_src = 'PassingLane.png';
          img_height = 100;
          img_width = 150;
          caption = 'Passing Lane';
          break;
      }

      return {
        ...row,
        vi,
        vo,
        img_src,
        img_caption: caption,
        img_height,
        img_width
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
        img_src:
          passTypeText === "Passing Constrained" ? "PassingConstrained.png" :
          passTypeText === "Passing Zone" ? "PassingZone.png" :
          passTypeText === "Passing Lane" ? "PassingLane.png" :
          "segment.jpg",
        img_caption: passTypeText || "Segment",
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
      img_src: "segment.jpg",
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


<div class="mb-6">
  <h1 class="text-3xl font-bold underline">HCM Calulator - Chapter 15</h1>
</div>

<div class="mb-4">

  <label for="jsonInput" class="block text-sm font-medium mb-1">JSON Input</label>
  <input 
    type="file"
    id="jsonInput"
    on:change={jsonInputHandler}
    class="file-input file-input-bordered w-full max-w-xs"
    accept=".json"
  />

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-4">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form
    id="hcm15" 
    class="submitted:opacity-50 transition-opacity duration-300"
    on:submit|preventDefault={handleSubmit}
  >
    <div class="w-full overflow-x-auto">
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <!-- <th>Active</th> -->
            <th>Segment</th>
            <th>Passing Type</th>
            <th>Length</th>
            <th>Grade</th>
            <th>Posted Speed Limit</th>
            <th>Horizontal Curves</th>
            <th>Horizontal Params</th>
            <th>Demand Volume</th>
            <th>Demand Volume (O)</th>
            <th>Vertical Class</th>
            <th>Peak Hour Factor</th>
            <th>Heavy Vehicle Per.</th>
          </tr>
        </thead>
        <tbody>
          {#each localRows as row, i (row.seg_num)}
            <Row bind:row={localRows[i]} seg_num={row.seg_num} changeSegment={changeSegment} changeHC={changeHC} toggleHCParams={toggleHCParams} />
          {/each}
        </tbody>
      </table>
    </div>

    <div class="grid md:grid-cols-2 sm:grid-cols-1 gap-6 mb-8">
      <!-- Parameter Inputs -->
      <div class="space-y-4">
        <div>
          <label for="LW_input" class="block text-sm font-medium mb-1">Lane Width (ft)</label>
          <input
            id="LW_input"
            type="text"
            class="input input-bordered w-full max-w-xs"
            bind:value={lane_width}
            placeholder="e.g. 12"
            pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
            required
          />
        </div>

        <div>
          <label for="SW_input" class="block text-sm font-medium mb-1">Shoulder Width (ft)</label>
          <input
            id="SW_input"
            type="text"
            class="input input-bordered w-full max-w-xs"
            placeholder="e.g. 6"
            bind:value={shoulder_width}
            pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
            required
          />
        </div>

        <div>
          <label for="APD_input" class="block text-sm font-medium mb-1">Access Point Density (per mi)</label>
          <input
            id="APD_input"
            type="text"
            class="input input-bordered w-full max-w-xs"
            placeholder="e.g. 2"
            bind:value={apd}
            pattern="[+]?([0-9]|[0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
            required
          />
        </div>

        <div>
          <label for="PMHVFL_input" class="block text-sm font-medium mb-1">
            % Multiplier for Heavy Vehicles in Passing Lane<br />
            <span class="text-xs text-gray-500">*Only used when Passing Lane is included</span>
          </label>
          <input
            id="PMHVFL_input"
            type="text"
            class="input input-bordered w-full max-w-xs"
            placeholder="e.g. 0"
            bind:value={pmhvfl}
            pattern="[+]?([0-9]|[0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
            required
          />
        </div>
      </div>

      <!-- Segment Subtables -->
      <div class="space-y-6">
        {#each localRows as row}
          {#if row.is_hc}
            <div class="card card-compact bg-base-100 shadow-xl overflow-x-auto" id="hc_table{row.seg_num}">
              <div class="card-body">
                <div class="flex justify-between items-center mb-2">
                  <h2 class="text-lg font-semibold">Segment {row.seg_num}</h2>
                  <div class="flex gap-2">
                    <button class="btn btn-outline btn-sm" on:click={() => addSubSegment(row.seg_num)} type="button">Add</button>
                    <button class="btn btn-outline btn-sm" on:click={() => removeSubSegment(row.seg_num)} type="button">Remove</button>
                  </div>
                </div>

                <table class="table table-compact w-full">
                  <thead>
                    <tr>
                      <th>Subsegment</th>
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
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Segment Image -->
    <div class="overflow-x-auto mt-6">
      <table class="table-auto w-fit" id="seg_imgs">
        <tbody>
          <tr>
            {#each localRows as row}
              <td style="width: {row.img_width || 100}px; padding: 0; vertical-align: top;">
                <img
                  src={row.img_src}
                  alt="segment"
                  id={"seg_img" + row.seg_num}
                  width={row.img_width || 100}
                  height={row.img_height || 100}
                />
              </td>
            {/each}
          </tr>
          <tr>
            {#each localRows as row}
              <td class="text-center text-sm text-gray-600">
                {row.img_caption || '-'}
              </td>
            {/each}
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Form Actions -->
    <div class="flex flex-wrap justify-end gap-2 mt-4">
      <button class="btn btn-outline" on:click={jsonOutputHandler} id="jsonOutput" type="button">Export as JSON</button>
      <button class="btn btn-outline" on:click={resetParams} type="button">Reset Params</button>
      <Calc {lane_width} {shoulder_width} {apd} {pmhvfl} rows_len={localRows.length} rows={localRows}/>
      <button class="btn btn-outline" on:click={addSegment} type="button">Add Segment</button>
      <button class="btn btn-outline" on:click={removeSegment} type="button">Remove Segment</button>
    </div>

  </form>

  <!-- <canvas id="simulation-canvas"></canvas> -->
  <pre id="simulation-canvas"></pre>

  <div class="los overflow-x-auto">
    <h3>Outputs</h3>
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
    <p id="los">Facility LOS: </p>
    <p id="fdF">Facility Follower Density: </p>
    <p id="error">Error Message: </p>
  </div>

</div>