<script>
  import Row from './Row.svelte';
  import SubRow from './SubRow.svelte';
  import Calc from './Calc.svelte';

// Output should be LOS, speed or others
// 


  let values = {};
  let count = 0;
  let columns = [
    'Active',
    'Segment',
    'Passing Type',
    'Length',
    'Grade',
    'Horizontal Curves',
    'HC Params',
    'Demand Volums',
    'Demand Volumns (O)',
    'Vertical Class',
  ];

  let toggle_seg = -1;

  let subrows = [{ subseg_num: 1 }];
  let rows = [{ seg_num: 1, subrows }];

  function addSegment() {
    rows = [...rows, { seg_num: rows.length + 1, subrows }];

    // also add image and caption
    var table = document.getElementById('seg_imgs');
    var img_row = table.rows[0];
    var cap_row = table.rows[1];

    var img = document.createElement('img');
    img.src = 'segment.jpg';
    img.height = 100;
    img.width = 100;
    img.setAttribute('id', 'seg_img' + rows.length);

    if (document.getElementById('passing_type' + rows.length) != null) {
      var cap = document.getElementById('passing_type' + rows.length).value;
    }

    // document.getElementById("seg_imgs").appendChild(img);
    img_row.insertCell(-1).appendChild(img);
    cap_row.insertCell(-1).innerHTML = cap;
  }

  function removeSegment() {
    var table = document.getElementById('seg_imgs');
    var img = document.getElementById('seg_img' + rows.length);
    var img_row = table.rows[0];
    var cap_row = table.rows[1];

    if (rows.length > 1) {
      if (img != null) {
        // img.parentNode.removeChild(img);
        img_row.deleteCell(-1);
      }

      if (cap_row.length == img_row.length) {
        // cap_row.innerHTML = '';
        cap_row.deleteCell(-1);
      }

      rows = rows.slice(0, rows.length - 1);
    }
  }

  function changeSegment(seg_num) {
    var table = document.getElementById('seg_imgs');
    var cap_row = table.rows[1];
    var cap = 'undefined';
    var img = document.getElementById('seg_img' + seg_num);

    // console.log(values.vd);
    var Vi = document.getElementById('vi_input' + seg_num);
    var Vo = document.getElementById('vo_input' + seg_num);
    var PT = document.getElementById('passing_type' + seg_num).value;

    // if (document.getElementById('passing_type' + seg_num) != null) {
    //   cap = document.getElementById('passing_type' + seg_num).value;
    //   console.log(cap);
    // }


    if (PT == 'Passing Zone') {
      Vi.value = '1000';
      Vo.value = '0';
      img.src = 'PassingZone.png';
      img.height = 100;
      img.width = 100;
      img.parentNode.width = 100;
      cap = 'Passing Zone';
    } else if (PT == 'Passing Constrained') {
      img.src = 'PassingConstrained.png';
      Vi.value = '1000';
      Vo.value = '0';
      img.height = 100;
      img.width = 100;
      img.parentNode.width = 100;
      cap = 'Passing Constrained';
    } else if (PT == 'Passing Lane') {
      img.src = 'PassingLane.png';
      Vi.value = '1000';
      Vo.value = '0';
      img.height = 100;
      img.width = 150;
      img.parentNode.width = 150;
      cap = "Passing Lane";
    }

    cap_row.cells[seg_num - 1].innerHTML = cap;
  }

  // function toggleActive(seg_num) {
  //   var table = document.getElementById('seg_imgs');
  //   var img = document.getElementById('seg_img' + rows.length);
  //   var img_row = table.rows[0];
  //   var cap_row = table.rows[1];
  //   var active = document.getElementById('active' + seg_num);

  // }

  // Toggle HC param slider
  function toggleHCParams(seg_num) {
    var toggler = document.getElementById('hc_param' + seg_num);
    var hc_table = document.getElementById('hc_table' + seg_num);

    // Only shows one sub table
    if (toggler.checked) {
      if (toggle_seg == -1) {
        hc_table.style.display = 'block';
        toggle_seg = seg_num;
      } else {
        console.log('Cannot out more than one');
      }
    } else {
      if (toggle_seg == seg_num) {
        hc_table.style.display = 'none';
        toggle_seg = -1;
      }
    }
  }

  // If check horizontal curves button
  function changeHC(seg_num, subseg_num){
    var is_hc = document.getElementById("is_hc" + (seg_num));
    var toggler = document.getElementById("hc_param" + (seg_num));
    var hc_table = document.getElementById("hc_table" + (seg_num));

    var subdesign_radius = document.getElementsByClassName("design_radius" + (subseg_num));

    // Only shows one sub table
    if (is_hc.checked){
      // add required attribute to subsegment
      // subdesign_radius.required = true;
      // console.log(subdesign_radius.required);
    }
      // if (toggle_seg == -1){
      //   hc_table.style.display = 'block';
      //   toggle_seg = seg_num;
      // } else {
      //   console.log("Cannot out more than one");
      // }
    if (!is_hc.checked){
      if (toggle_seg == seg_num){
        hc_table.style.display = 'none';
        toggle_seg = -1;
        toggler.checked = false;
      }
    }
  }

  function addSubSegment(_seg_num) {
    var temp_subrows = [...rows[_seg_num - 1].subrows, { subseg_num: rows[_seg_num - 1].subrows.length + 1 }];
    rows[_seg_num - 1] = { seg_num: _seg_num, subrows: temp_subrows };
  }

  function removeSubSegment(_seg_num) {
    if (rows[_seg_num - 1].subrows.length > 1)
      //   subrows = subrows.slice(0, subrows.length-1);
      rows[_seg_num - 1].subrows = rows[_seg_num - 1].subrows.slice(0, rows[_seg_num - 1].subrows.length - 1);
  }

  let hasError = false;
  let isSuccessVisible = false;
  let submitted = false;
  const errMessage = "Here is the error";
  function handleSubmit(e){
      isSuccessVisible = true;

      setTimeout(function(){
          isSuccessVisible = false;
      }, 4000);
  }
</script>

<h1 class="text-3xl font-bold underline">HCM Calulator Chap15</h1>

{#if hasError == true}
  <p class="error-alert">{errMessage}</p>
<!-- {:else}
	{#if isSuccessVisible}	
		<p class="error-alert" transition:fade={{duration:150}}>Data updated successfully</p>
	{/if} -->
{/if}

<form id="hcm15" class="mt-4" class:submitted on:submit|preventDefault={handleSubmit}>
<div class="w-full overflow-x-auto">
  <table class="table w-full">
    <thead>
      <tr>
        <!-- <th>Active</th> -->
        <th>Segment</th>
        <th>Passing Type</th>
        <th>Length</th>
        <th>Grade</th>
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
      {#each rows as row}
        <Row seg_num={row.seg_num} subseg_num={row.subrows.length} changeSegment={changeSegment} changeHC={changeHC} toggleHCParams={toggleHCParams} values={values}/>
      {/each}
    </tbody>
  </table>
</div>
<div class="grid auto-cols-max grid-flow-col">
  <div class="parameters flex justify-start">
    <table>
      <tbody>
        <tr>
          <td>Posted Speed Limit (mi/hr): </td>
          <td>
            <input
              type="text"
              id="Spl_input"
              placeholder="Type here"
              class="input-label input w-full max-w-xs"
              value="50"
              pattern="[+]?([1-9]|[1-9][0-9]|[1-9][0-9][0-9])$"
            />
          </td>
        </tr>
        <tr>
          <td>Lane Width (ft): </td>
          <td>
            <input
              type="text"
              id="LW_input"
              placeholder="Type here"
              class="input-label input w-full max-w-xs"
              value="12"
              pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
              autocomplete="off"
              required
            />
          </td>
        </tr>
        <tr>
          <td>Shoulder Width (ft): </td>
          <td>
            <input
              type="text"
              id="SW_input"
              placeholder="Type here"
              class="input-label input w-full max-w-xs"
              value="6"
              pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
              autocomplete="off"
              required
            />
          </td>
        </tr>
        <tr>
          <td>Access Point Density (access points/mi): </td>
          <td>
            <input
              type="text"
              id="APD_input"
              placeholder="Type here"
              class="input-label input w-full max-w-xs"
              value="2"
              pattern="[+]?([0-9]|[0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
              autocomplete="off"
              required
            />
          </td>
        </tr>
        <tr>
          <td>Percentage Multiplier for Heavy Vehicles in the Faster / Passing Lane: </td>
          <td>
            <input
              type="text"
              id="PMHVFL_input"
              placeholder="Type here"
              class="input-label input w-full max-w-xs"
              value="0.4"
              pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
              autocomplete="off"
              required
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  {#each rows as row}
  <div class="overflow-x-auto card card-compact w-full bg-base-100 shadow-xl" id="hc_table{row.seg_num}" style="display:none">
    <div class="card-body">
    <table class="table table-compact">
      <thead>
        <caption class="flex justify-start"><b>Segment {row.seg_num}</b></caption>
        <tr>
          <th>Subsegment</th>
          <th>Length</th>
          <th>Design Radius</th>
          <th>Superelevation</th>
        </tr>
      </thead>
      <tbody>
        {#each row.subrows as subrow}
          <SubRow subseg_num={subrow.subseg_num}/>
        {/each}
      </tbody>
      <div class="flex justify-end">
        <button class="btn btn-outline btn-sm" on:click={addSubSegment(row.seg_num)}>Add</button>
        <button class="btn btn-outline btn-sm" on:click={removeSubSegment(row.seg_num)}>Remove</button>
      </div>
    </div>
    </div>
  {/each}
</div>
<table class="flex justify-start" id="seg_imgs">
  <tbody>
    <tr class="table_img"><td><img src="segment.jpg" alt="segment" id="seg_img1" height="100" width="100" /></td></tr>
    <tr class="table_p"><td>undefined</td></tr>
  </tbody>
</table>
<div class="flex justify-end">
  <Calc rows_len={rows.length} rows={rows}/>
  <button class="btn" on:click={addSegment}>Add Segment</button>
  <button class="btn" on:click={removeSegment}>Remove Segment</button>
</div>
</form>
<div class="los">
  <h3>Outputs</h3>
  {#each rows as row}
    <h3>Segment {row.seg_num}</h3>
    <p id="ffs{row.seg_num}">Free-flow Speed: </p>
    <p id="avgspd{row.seg_num}">Average Speed: </p>
    <p id="pf{row.seg_num}">Percent followers in the analysis direction: </p>
    <p id="fd{row.seg_num}">Followers Density: </p>
    <p id="seglos{row.seg_num}">LOS: </p>
  {/each}
  <p id="los">Entire LOS: </p>
  <p id="error">Error Message: </p>
</div>

<footer class="hcm15-footer footer footer-center p-10 bg-base-200 text-base-content rounded">
  <div class="grid grid-flow-col gap-4">
    <a class="link link-hover">About us</a> 
    <a class="link link-hover">Contact</a> 
  </div> 
  <div>
    <p>Copyright © 2022 - All right reserved by Rei Tamaru and Jonathan Riel</p>
  </div>
</footer>