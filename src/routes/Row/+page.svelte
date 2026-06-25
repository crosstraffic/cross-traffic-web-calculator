<script>
    export let row;
    export let seg_num;
    export let changeSegment;
    export let changeHC;
    export let toggleHCParams;

</script>
<tr class="subseg{seg_num}">
    <td>
        <span class="seg-no">{seg_num}</span>
    </td>
    <td>
        <select
            class="select select-bordered select-sm passing_type"
            id={"passing_type" + seg_num}
            name="pass_type"
            bind:value={row.passing_type}
            on:change={() => changeSegment(seg_num)}
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
                id="seg_length{seg_num}"
                name="seg_len"
                bind:value={row.seg_length}
                placeholder="0.0"
                class="input input-bordered input-sm seg_length"
                pattern="[+]?([0-9]|[0-9]*([.][0-9][0-9]*)|[1-9]|[1-9][0-9])$"
                autocomplete="off"
                required/>
            <span class="unit">mi</span>
        </div>
    </td>
    <td>
        <div class="cell-field">
            <input
                type="text"
                id="seg_grade{seg_num}"
                name="grade"
                bind:value={row.seg_grade}
                placeholder="0"
                class="input input-bordered input-sm seg_grade"
                pattern="[+\-]?([0-9]|[0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
                autocomplete="off"
                required/>
            <span class="unit">%</span>
        </div>
    </td>
    <td>
        <div class="cell-field">
            <input
                type="text"
                id="seg_Spl{seg_num}"
                name="posted speed"
                bind:value={row.seg_spl}
                placeholder="0"
                class="input input-bordered input-sm seg_spl"
                pattern="[+]?([1-9]|[1-9][0-9]|[1-9][0-9][0-9])$"
                autocomplete="off"
                required/>
            <span class="unit">mph</span>
        </div>
    </td>
    <td class="cell-center">
        <input
            type="checkbox"
            class="checkbox checkbox-sm is_hc"
            id="is_hc{seg_num}"
            name="hor_cur"
            bind:checked={row.is_hc}
            on:change={(e) => changeHC(seg_num, e.target.checked)}
        />
    </td>
    <td class="cell-center">
        <!-- Lookup table -->
        <input
            type="checkbox"
            class="toggle toggle-sm hc_param"
            id="hc_param{seg_num}"
            name="hc_param"
            bind:checked={row.is_hc}
            on:change={(e) => toggleHCParams(seg_num, e.target.checked)}
        />
    </td>
    <td>
        <div class="cell-field">
            <input
                type="text"
                id="vi_input{seg_num}"
                name="vd"
                bind:value={row.vi}
                placeholder="0"
                class="input input-bordered input-sm vi_input"
                pattern="[+]?([0-9]*|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
                autocomplete="off"
                required/>
            <span class="unit">veh/h</span>
        </div>
    </td>
    <td>
        <div class="cell-field">
            <input
                type="text"
                id="vo_input{seg_num}"
                name="vo"
                placeholder="0"
                class="input input-bordered input-sm vo_input"
                bind:value={row.vo}
                pattern="[+]?([0-9]*|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
                autocomplete="off"
                required/>
            <span class="unit">veh/h</span>
        </div>
    </td>
    <td>
        <select class="select select-bordered select-sm" id="vc_select{seg_num}" name="ver_cls" bind:value={row.vertical_class} required>
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
                id="PHF_input{seg_num}"
                placeholder="0.95"
                class="input input-bordered input-sm PHF_input"
                bind:value={row.phf}
                pattern="[+]?([0-9]*([.][0-9]*))$"
                autocomplete="off"
                required
            />
        </div>
    </td>
    <td>
        <div class="cell-field">
            <input
                type="text"
                id="PHV_input{seg_num}"
                placeholder="5"
                class="input input-bordered input-sm PHV_input"
                bind:value={row.phv}
                pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
                autocomplete="off"
                required
            />
            <span class="unit">%</span>
        </div>
    </td>
</tr>
