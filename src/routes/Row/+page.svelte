<script>
    export let row;
    export let seg_num;
    export let changeSegment;
    export let changeHC;
    export let toggleHCParams;

</script>
<tr class="subseg{seg_num}">
    <td>
        <p>{seg_num}</p>
    </td>
    <td>
        <select
            class="select w-full max-w-xs passing_type"
            id={"passing_type" + seg_num}
            name="pass_type"
            bind:value={row.passing_type}
            on:change={() => changeSegment(seg_num)}
            required
        >
            <option value="" disabled selected>TYPE</option>
            <option>Passing Constrained</option>
            <option>Passing Zone</option>
            <option>Passing Lane</option>
        </select>
    </td>
    <td>
        <input 
            type="text" 
            id="seg_length{seg_num}" 
            name="seg_len" 
            bind:value={row.seg_length}
            placeholder="Type here" 
            class="input input-label w-full max-w-xs seg_length" 
            pattern="[+]?([0-9]|[0-9]*([.][0-9][0-9]*)|[1-9]|[1-9][0-9])$"
            autocomplete="off"
            required/>
        <label for="label">
            <span class="label-text-alt"></span>
            <span class="label-text-alt">mi.</span>
        </label>
    </td>
    <td>
        <input 
            type="text"
            id="seg_grade{seg_num}" 
            name="grade" 
            bind:value={row.seg_grade}
            placeholder="Type here" 
            class="input input-label w-full max-w-xs seg_grade" 
            pattern="[+\-]?([0-9]|[0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
            autocomplete="off" 
            required/>
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">%</span>
        </label>
    </td>
    <td>
        <input 
            type="text"
            id="seg_Spl{seg_num}" 
            name="posted speed" 
            bind:value={row.seg_spl}
            placeholder="Type here" 
            class="input input-label w-full max-w-xs seg_spl" 
            pattern="[+]?([1-9]|[1-9][0-9]|[1-9][0-9][0-9])$"
            autocomplete="off" 
            required/>
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">mph.</span>
        </label>
    </td>
    <td>
        <label>
        <input
            type="checkbox"
            class="checkbox is_hc"
            id="is_hc{seg_num}"
            name="hor_cur"
            bind:checked={row.is_hc}
            on:change={(e) => changeHC(seg_num, e.target.checked)}
        />
        </label>
    </td>
    <td>
        <!-- Lookup table -->
        <label>
            <input
                type="checkbox"
                class="toggle hc_param"
                id="hc_param{seg_num}"
                name="hc_param"
                bind:checked={row.is_hc}
                on:change={(e) => toggleHCParams(seg_num, e.target.checked)}
            />
        </label>
    </td>
    <td>
        <input
            type="text"
            id="vi_input{seg_num}"
            name="vd"
            bind:value={row.vi}
            placeholder="Type here"
            class="input input-label w-full max-w-xs vi_input" 
            pattern="[+]?([0-9]*|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
            autocomplete="off" 
            required/>
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">veh/hr</span>
        </label>
    </td>
    <td>
        <input 
            type="text" 
            id="vo_input{seg_num}" 
            name="vo" 
            placeholder="Type here" 
            class="input input-label w-full max-w-xs vo_input" 
            bind:value={row.vo}
            pattern="[+]?([0-9]*|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
            autocomplete="off" 
            required/>
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">veh/hr</span>
        </label>
    </td>
    <td>
        <select class="select w-full max-w-xs" id="vc_select{seg_num}" name="ver_cls" bind:value={row.vertical_class} required>
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
            <option>5</option>
        </select>
    </td>
    <td>
        <input
            type="text"
            id="PHF_input{seg_num}"
            placeholder="Type here"
            class="input-label input w-full max-w-xs PHF_input"
            bind:value={row.phf}
            pattern="[+]?([0-9]*([.][0-9]*))$"
            autocomplete="off"
            required
        />
    </td>
    <td>
        <input
            type="text"
            id="PHV_input{seg_num}"
            placeholder="Type here"
            class="input-label input w-full max-w-xs PHV_input"
            bind:value={row.phv}
            pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9])$"
            autocomplete="off"
            required
        />
        <label for="label">
            <span class="label-text-alt"></span>
            <span class="label-text-alt">%</span>
        </label>
    </td>
</tr>
