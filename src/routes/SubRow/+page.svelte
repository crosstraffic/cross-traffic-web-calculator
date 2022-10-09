<script>
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
            class="subseg_len{subseg_num} input input-label w-2/3 max-w-xs" 
            pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
            value=0
            autocomplete="off" />
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">ft.</span>
        </label>
    </td>
    <td>
        <input 
            type="text" 
            placeholder="Type here" 
            class="design_radius{subseg_num} input input-label w-2/3 max-w-xs" 
            pattern="[+]?([0-9]*([.][0-9]*)|[0-9]|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
            value=0
            autocomplete="off" />
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">ft.</span>
        </label>
    </td>
    <td>
        <input 
            type="text" 
            placeholder="Type here" 
            class="superelevation{subseg_num} input input-label w-2/3 max-w-xs" 
            pattern="[+-]?([0-9]*([.][0-9]*)|[0-9]|[1-9][0-9])$"
            value=0
            autocomplete="off" />
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">%</span>
        </label>
    </td>
</tr>
