<script>
  export let subrow;
  export let subseg_num;
</script>

<tr class={subseg_num}>
    <th>
        <p>{subseg_num}</p> <!-- Increment -->
    </th>
    <td>
        <input 
            type="text" 
            placeholder="Type here" 
            id="subseg_len{subseg_num}"
            name="subseg_len"
            class="subseg_len{subseg_num} input input-label w-2/3 max-w-xs" 
            pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
            bind:value={subrow.subseg_length}
            autocomplete="off" />
        <label for="subseg_len">
            <span class="label-text-alt"></span>
            <span class="label-text-alt">ft.</span>
        </label>
    </td>
    <td>
        <input 
            type="text" 
            placeholder="Type here" 
            id="design_radius{subseg_num}"
            class="design_radius{subseg_num} input input-label w-2/3 max-w-xs" 
            pattern="[+]?([0-9]*([.][0-9]*)|[0-9]|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
            bind:value={subrow.design_radius}
            autocomplete="off" />
        <label for="design_radius">
            <span class="label-text-alt"></span>
            <span class="label-text-alt">ft.</span>
        </label>
    </td>
    <td>
        <input 
            type="text" 
            placeholder="Type here" 
            id="superelevation{subseg_num}"
            class="superelevation{subseg_num} input input-label w-2/3 max-w-xs" 
            pattern="[+\-]?([0-9]*([.][0-9]*)|[0-9]|[1-9][0-9])$"
            bind:value={subrow.superelevation}
            autocomplete="off" />
        <label for="superelevation">
            <span class="label-text-alt"></span>
            <span class="label-text-alt">%</span>
        </label>
    </td>
</tr>
