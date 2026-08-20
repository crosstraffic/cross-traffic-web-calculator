<script>
  // Two-lane highway facility strip (HCM Chapter 15): the segment chain in the
  // analysis direction, each tile as wide as its segment length and drawn with
  // the schematic of its passing type. After a run each tile carries its
  // segment LOS, and clicking one reports the index so the page can highlight
  // the matching table row and the same slab in the 3D view.
  import RoadDiagram from '$lib/RoadDiagram.svelte';
  import { LOS_COLORS } from '$lib/los.js';

  let { rows = [], results = null, selected = -1, onselect = null, interactive = true } = $props();

  // Segment lengths are miles here; subsegment lengths (not drawn) are feet.
  const lengthMi = (row) => {
    const n = Number(row.seg_length);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const losFor = (i) => (results && results.segs[i] ? results.segs[i].los : null);
</script>

<div class="facility-strip" id="seg_imgs">
  {#each rows as row, i}
    {@const los = losFor(i)}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="facility-seg"
      class:seg-selected={selected === i}
      class:seg-static={!interactive}
      style="flex: {lengthMi(row) || 1} 1 0;"
      role={interactive ? 'button' : 'group'}
      tabindex="-1"
      aria-label="segment {row.seg_num}, {row.passing_type || 'type not set'}{los ? `, LOS ${los}` : ''}"
      onclick={() => interactive && onselect?.(i)}
    >
      <div class="facility-seg-head">
        <span class="seg-no">{row.seg_num}</span>
        <span class="facility-seg-type">{row.passing_type || 'Not set'}</span>
        {#if los}
          <span class="tls-los" style="background: {LOS_COLORS[los]}">{los}</span>
        {/if}
      </div>
      <div class="facility-seg-img">
        <RoadDiagram type={row.passing_type} />
      </div>
      <div class="facility-seg-len">
        {lengthMi(row) > 0 ? row.seg_length + ' mi' : '—'}
      </div>
    </div>
  {/each}
</div>

<style>
  /* The strip frame, tiles, and selection outline are global (app.css) so the
     expanded editor cards can reuse them; only the LOS chip is local. */
  .tls-los {
    margin-left: auto;
    flex-shrink: 0;
    min-width: 1.15rem;
    padding: 0 0.25rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.15rem;
    text-align: center;
    color: #fff;
  }
  .seg-static {
    cursor: default;
  }
</style>
