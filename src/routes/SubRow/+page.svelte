<script>
  export let subrow;
  export let subseg_num;
</script>

<tr class={subseg_num}>
    <td>
        <span class="seg-no">{subseg_num}</span>
    </td>
    <td>
        <div class="cell-field">
            <input
                type="text"
                placeholder="0"
                id="subseg_len{subseg_num}"
                name="subseg_len"
                class="subseg_len{subseg_num} input input-bordered input-sm"
                pattern="[+]?([0-9]*([.][0-9]*)|[1-9]|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
                bind:value={subrow.subseg_length}
                autocomplete="off" />
            <span class="unit">ft</span>
        </div>
    </td>
    <td>
        <div class="cell-field">
            <input
                type="text"
                placeholder="0"
                id="design_radius{subseg_num}"
                class="design_radius{subseg_num} input input-bordered input-sm"
                pattern="[+]?([0-9]*([.][0-9]*)|[0-9]|[1-9][0-9]|[1-9][0-9][0-9]|[1-9][0-9][0-9][0-9])$"
                bind:value={subrow.design_radius}
                autocomplete="off" />
            <span class="unit">ft</span>
        </div>
    </td>
    <td>
        <div class="cell-field">
            <input
                type="text"
                placeholder="0"
                id="superelevation{subseg_num}"
                class="superelevation{subseg_num} input input-bordered input-sm"
                pattern="[+\-]?([0-9]*([.][0-9]*)|[0-9]|[1-9][0-9])$"
                bind:value={subrow.superelevation}
                autocomplete="off" />
            <span class="unit">%</span>
        </div>
    </td>
</tr>
