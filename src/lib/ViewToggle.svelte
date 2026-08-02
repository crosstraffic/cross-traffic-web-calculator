<script>
  // The house 2D/3D segmented control, shared by every chapter page that has
  // a diagram with both views. Bind `mode` ('2d' | '3d'). Styling comes from
  // the global .view-toggle/.vt-btn rules in app.css.
  export let mode = '2d';
  export let label = 'Diagram view mode';
</script>

<div class="view-toggle" role="group" aria-label={label}>
  <button type="button" class="vt-btn" class:active={mode === '2d'} on:click={() => (mode = '2d')}>2D</button>
  <button type="button" class="vt-btn" class:active={mode === '3d'} on:click={() => (mode = '3d')}>3D</button>
</div>
