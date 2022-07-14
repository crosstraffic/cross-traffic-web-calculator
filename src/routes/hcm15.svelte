<script>
  import Row from './Row.svelte';
  import SubRow from './SubRow.svelte';
  import Calc from './Calc.svelte';

  // Horizontal popup
  // Output should be LOS, speed or others
  //

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

    var Vi = document.getElementById('vi_input' + seg_num);
    var Vo = document.getElementById('vo_input' + seg_num);
    var PT = document.getElementById('passing_type' + seg_num).value;

    if (document.getElementById('passing_type' + seg_num) != null) {
      cap = document.getElementById('passing_type' + seg_num).value;
    }

    cap_row.cells[seg_num - 1].innerHTML = cap;

    if (PT == 'Passing Zone' || PT == 'Passing Constrained') {
      Vi.value = '1000';
      Vo.value = '0';
    } else if (PT == 'Passing Lane') {
      Vi.value = '1000';
      Vo.value = '0';
    }
  }

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

  function addSubSegment(_seg_num) {
    var temp_subrows = [...rows[_seg_num - 1].subrows, { subseg_num: rows[_seg_num - 1].subrows.length + 1 }];
    rows[_seg_num - 1] = { seg_num: _seg_num, subrows: temp_subrows };
  }

  function removeSubSegment(_seg_num) {
    if (rows[_seg_num - 1].subrows.length > 1)
      //   subrows = subrows.slice(0, subrows.length-1);
      rows[_seg_num - 1].subrows = rows[_seg_num - 1].subrows.slice(0, rows[_seg_num - 1].subrows.length - 1);
  }
</script>

<a href="/">Back to Home</a>
<h1 class="text-3xl font-bold underline">HCM Calulator Chap15</h1>

<div class="w-full overflow-x-auto">
  <table class="table w-full">
    <thead>
      <tr>
        <th>Active</th>
        <th>Segment</th>
        <th>Passing Type</th>
        <th>Length</th>
        <th>Grade</th>
        <th>Horizontal Curves</th>
        <th>Horizontal Params</th>
        <th>Demand Volume</th>
        <th>Demand Volume (O)</th>
        <th>Vertical Class</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        <Row seg_num={row.seg_num} {changeSegment} {toggleHCParams} />
      {/each}
    </tbody>
  </table>
</div>
<div class="grid auto-cols-max grid-flow-col">
  <div class="parameters flex justify-start">
    <table>
      <tbody>
        <tr>
          <td>Peak Hour Factor: </td>
          <td>
            <input
              type="text"
              id="PHF_input"
              placeholder="Type here"
              class="input-label input w-full max-w-xs"
              value="0.95"
            />
          </td>
        </tr>
        <tr>
          <td>Heavy Vehicle Percentage (%): </td>
          <td>
            <input
              type="text"
              id="PHV_input"
              placeholder="Type here"
              class="input-label input w-full max-w-xs"
              value="5"
            />
          </td>
        </tr>
        <tr>
          <td>Posted Speed Limit (mi/hr): </td>
          <td>
            <input
              type="text"
              id="Spl_input"
              placeholder="Type here"
              class="input-label input w-full max-w-xs"
              value="50"
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
              value="3.6"
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
              value="0.2"
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
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  {#each rows as row}
    <div
      class="card card-compact w-full overflow-x-auto bg-base-100 shadow-xl"
      id="hc_table{row.seg_num}"
      style="display:none"
    >
      <div class="card-body">
        <table class="table-compact table">
          <thead>
            <caption class="flex justify-start"><b>Segment {row.seg_num}</b></caption>
            <tr>
              <th>Subsegment</th>
              <th>Design Radius</th>
              <th>Superelevation</th>
            </tr>
          </thead>
          <tbody>
            {#each row.subrows as subrow}
              <SubRow subseg_num={subrow.subseg_num} />
            {/each}
          </tbody>
          <div class="flex justify-end">
            <button class="btn btn-outline btn-sm" on:click={addSubSegment(row.seg_num)}>Add</button>
            <button class="btn btn-outline btn-sm" on:click={removeSubSegment(row.seg_num)}>Remove</button>
          </div>
        </table>
      </div>
    </div>
  {/each}
</div>
<table class="flex justify-start" id="seg_imgs">
  <tbody>
    <tr><td><img src="segment.jpg" alt="segment" id="seg_img1" height="100" width="100" /></td></tr>
    <tr><td>undefined</td></tr>
  </tbody>
</table>
<div class="flex justify-end">
  <Calc rows_len={rows.length} subrows_len={subrows.length} />
  <button class="btn" on:click={addSegment}>Add Segment</button>
  <button class="btn" on:click={removeSegment}>Remove Segment</button>
</div>
<div class="los">
  <p id="los">LOS:</p>
</div>
