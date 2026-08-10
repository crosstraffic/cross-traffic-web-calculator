<script>
  // Schematic cross-section of a two-lane highway segment, keyed on its
  // passing type. Used by the facility strip and by the expanded editor cards.

  /**
   * @typedef {Object} Props
   * @property {string} [type] - Driven directly by the Segments dropdown value.
   */

  /** @type {Props} */
  let { type = '' } = $props();
</script>

<svg
  class="road-svg"
  viewBox="0 0 200 100"
  preserveAspectRatio="none"
  role="img"
  aria-label={type || 'Segment (not set)'}
>
  <!-- Shared geometry so adjacent segments connect:
       top edge y=22, centerline y=50, bottom edge y=78 for every type.
       The passing lane bulges down internally but still meets its
       neighbours at y=78 on both ends. -->
  {#if type === 'Passing Lane'}
    <line x1="0" y1="22" x2="200" y2="22" class="road-line edge" />
    <!-- centerline (opposing | analysis direction) -->
    <line x1="0" y1="50" x2="200" y2="50" class="road-line center" />
    <!-- added passing-lane divider (inside the widened section) -->
    <line x1="48" y1="71" x2="152" y2="71" class="road-line center dashed" />
    <!-- bottom edge: enters/leaves at y=78, bulges to y=92 to add the lane -->
    <path d="M0,78 L30,78 L48,92 L152,92 L170,78 L200,78" class="road-line edge" />
  {:else if type === 'Passing Zone'}
    <line x1="0" y1="22" x2="200" y2="22" class="road-line edge" />
    <!-- dashed centerline: passing permitted -->
    <line x1="0" y1="50" x2="200" y2="50" class="road-line center dashed" />
    <line x1="0" y1="78" x2="200" y2="78" class="road-line edge" />
  {:else if type === 'Passing Constrained'}
    <line x1="0" y1="22" x2="200" y2="22" class="road-line edge" />
    <!-- solid centerline: no passing -->
    <line x1="0" y1="50" x2="200" y2="50" class="road-line center" />
    <line x1="0" y1="78" x2="200" y2="78" class="road-line edge" />
  {:else}
    <!-- not set yet: neutral placeholder road -->
    <line x1="0" y1="22" x2="200" y2="22" class="road-line muted" />
    <line x1="0" y1="50" x2="200" y2="50" class="road-line muted dashed" />
    <line x1="0" y1="78" x2="200" y2="78" class="road-line muted" />
  {/if}
</svg>

<style>
  .road-svg {
    width: 100%;
    height: 72px;
    display: block;
  }
  .road-line {
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .edge {
    stroke: var(--diag-edge);
  }
  .center {
    stroke: var(--accent);
  }
  .dashed {
    stroke-dasharray: 7 6;
  }
  .muted {
    stroke: var(--diag-pavement-alt);
  }
</style>
