<script>
    export let subseg_num;

</script>
<tr class={subseg_num}>
    <th>
        <p>{subseg_num}</p> <!-- Increment -->
    </th>
    <td>
        <input type="text" id="design_radius{subseg_num}" placeholder="Type here" class="input input-label w-2/3 max-w-xs" />
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">mi.</span>
        </label>
    </td>
    <td>
        <input type="text" id="superelevation{subseg_num}" placeholder="Type here" class="input input-label w-2/3 max-w-xs" />
        <label for="label">
        <span class="label-text-alt"></span>
        <span class="label-text-alt">%</span>
        </label>
    </td>
</tr>