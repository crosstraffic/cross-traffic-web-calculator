<script>
    export let seg_num;
    export let changeSegment;
    export let toggleHCParams;
</script>
<tr class={seg_num}>
    <th>
        <label>
        <input type="checkbox" class="checkbox" checked />
        </label>
    </th>
    <td>
        <p>{seg_num}</p> <!-- Increment -->
    </td>
    <td>
        <select class="select w-full max-w-xs" id="passing_type{seg_num}" on:change={changeSegment(seg_num)}>
        <option disabled selected>TYPE</option>
        <option>Passing Constrained</option>
        <option>Passing Zone</option>
        <option>Passing Lane</option>
        </select>
    </td>
    <td>
        <input type="text" id="seg_length{seg_num}" placeholder="Type here" class="input input-label w-full max-w-xs" />
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">mi.</span>
        </label>
    </td>
    <td>
        <input type="text" id="seg_grade{seg_num}" placeholder="Type here" class="input input-label w-full max-w-xs" />
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">%</span>
        </label>
    </td>
    <td>
        <label>
        <input type="checkbox" class="checkbox" id="is_hc{seg_num}"/>
        </label>
    </td>
    <td>
        <!-- Lookup table -->
        <label>
            <input type="checkbox" class="toggle" id="hc_param{seg_num}" on:change={toggleHCParams(seg_num)}/>
        </label>
    </td>
    <td>
        <input type="text" id="vi_input{seg_num}" placeholder="Type here" class="input input-label w-full max-w-xs" />
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">veh/hr</span>
        </label>
    </td>
    <td>
        <input type="text" id="vo_input{seg_num}" placeholder="Type here" class="input input-label w-full max-w-xs" />
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">veh/hr</span>
        </label>
    </td>
    <td>
        <select class="select w-full max-w-xs" id="vc_select{seg_num}">
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
            <option>5</option>
        </select>
    </td>
</tr>