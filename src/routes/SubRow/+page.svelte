<script>
//   throw new Error("@migration task: Add data prop (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292707)");

//   export let subseg_num;
  export let data;
</script>

<tr class={data.subseg_num}>
    <th>
        <p>{data.subseg_num}</p> <!-- Increment -->
    </th>
    <td>
        <input 
            type="text" 
            placeholder="Type here" 
            class="subseg_len{data.subseg_num} input input-label w-2/3 max-w-xs" 
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
            class="design_radius{data.subseg_num} input input-label w-2/3 max-w-xs" 
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
            class="superelevation{data.subseg_num} input input-label w-2/3 max-w-xs" 
            pattern="[+-]?([0-9]*([.][0-9]*)|[0-9]|[1-9][0-9])$"
            value=0
            autocomplete="off" />
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">%</span>
        </label>
    </td>
</tr>
