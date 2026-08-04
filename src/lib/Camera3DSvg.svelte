<script>
  import { createBubbler, preventDefault } from 'svelte/legacy';

  const bubble = createBubbler();
  // Shared camera shell for the 3D diagram views: owns the yaw/pitch/zoom/pan
  // state and the pointer interactions (drag = rotate, Alt-drag = pan,
  // scroll/pinch = zoom), and hands the camera values to the slot so each
  // diagram only writes its own projection model. Same interaction contract
  
  /**
   * @typedef {Object} Props
   * @property {number} [viewW] - as FreewaySegment3D and FacilityView.
   * @property {number} [viewH]
   * @property {string} [ariaLabel]
   * @property {number} [defYaw]
   * @property {number} [defPitch]
   * @property {import('svelte').Snippet<[any]>} [children]
   */

  /** @type {Props} */
  let {
    viewW = 520,
    viewH = 340,
    ariaLabel = '3D view',
    defYaw = 24,
    defPitch = 42,
    children
  } = $props();

  let yaw = $state(defYaw), pitch = $state(defPitch);
  let zoom = $state(1), panX = $state(0), panY = $state(0);
  let dragging = $state(false);
  let svgEl = $state();

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const vbPerPx = () => (svgEl && svgEl.clientWidth ? viewW / svgEl.clientWidth : 1);
  const pointers = new Map();
  let mode = null;
  let start = {};
  let pinch0 = null;

  function onDown(e) {
    if (svgEl && svgEl.setPointerCapture) svgEl.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragging = true;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      mode = 'pinch';
      pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, zoom, panX, panY };
    } else {
      mode = e.altKey || e.button === 1 || e.button === 2 ? 'pan' : 'rotate';
      start = { x: e.clientX, y: e.clientY, yaw, pitch, panX, panY };
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = vbPerPx();
    if (mode === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      zoom = clamp(pinch0.zoom * (d / pinch0.d), 0.3, 6);
      panX = pinch0.panX + (mx - pinch0.mx) * s;
      panY = pinch0.panY + (my - pinch0.my) * s;
    } else if (mode === 'pan') {
      panX = start.panX + (e.clientX - start.x) * s;
      panY = start.panY + (e.clientY - start.y) * s;
    } else if (mode === 'rotate') {
      yaw = start.yaw + (e.clientX - start.x) * 0.5;
      pitch = clamp(start.pitch - (e.clientY - start.y) * 0.35, 12, 82);
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) { dragging = false; mode = null; pinch0 = null; }
    else if (pointers.size === 1) {
      const pt = [...pointers.values()][0];
      mode = 'rotate';
      start = { x: pt.x, y: pt.y, yaw, pitch, panX, panY };
      pinch0 = null;
    }
  }

  function onWheel(e) {
    e.preventDefault();
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (viewW / rect.width);
    const py = (e.clientY - rect.top) * (viewH / rect.height);
    const newZoom = clamp(zoom * Math.exp(-e.deltaY * 0.0015), 0.3, 6);
    const r = newZoom / zoom;
    panX = (px - viewW / 2) * (1 - r) + r * panX;
    panY = (py - viewH / 2) * (1 - r) + r * panY;
    zoom = newZoom;
  }

  function resetView() { yaw = defYaw; pitch = defPitch; zoom = 1; panX = 0; panY = 0; }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg bind:this={svgEl} viewBox="0 0 {viewW} {viewH}" preserveAspectRatio="xMidYMid meet" role="img"
     aria-label={ariaLabel}
     class="cam3d"
     class:dragging
     onpointerdown={onDown} onpointermove={onMove} onpointerup={onUp}
     onpointercancel={onUp} onwheel={onWheel} oncontextmenu={preventDefault(bubble('contextmenu'))}>
  {@render children?.({ yaw, pitch, zoom, panX, panY, })}
</svg>

<div class="cam3d-bar">
  <span class="cam3d-hint">Drag to rotate, Alt-drag to pan, scroll to zoom.</span>
  <button type="button" class="btn btn-ghost btn-xs" onclick={resetView}>Reset view</button>
</div>

<style>
  svg.cam3d {
    width: 100%;
    max-width: 560px;
    display: block;
    margin: 0 auto;
    touch-action: none;
    cursor: grab;
  }
  svg.cam3d.dragging { cursor: grabbing; }
  .cam3d-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.25rem;
  }
  .cam3d-hint { font-size: 0.7rem; color: #64748b; }
</style>
