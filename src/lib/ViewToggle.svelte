<script>
  // The house 2D/3D segmented control, shared by every chapter page that has
  // a diagram with both views. Bind `mode` ('2d' | '3d'). Styling comes from
  
  /**
   * @typedef {Object} Props
   * @property {string} [mode] - the global .view-toggle/.vt-btn rules in app.css.
   * @property {string} [label]
   */

  /** @type {Props} */
  let { mode = $bindable('2d'), label = 'Diagram view mode' } = $props();
</script>

<div class="view-toggle" role="group" aria-label={label}>
  <button type="button" class="vt-btn" class:active={mode === '2d'} onclick={() => (mode = '2d')}>2D</button>
  <button type="button" class="vt-btn" class:active={mode === '3d'} onclick={() => (mode = '3d')}>3D</button>
</div>
