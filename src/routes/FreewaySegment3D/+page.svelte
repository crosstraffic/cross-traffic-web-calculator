<script>
  // Interactive 3D view of a single basic-freeway segment (HCM Ch.12).
  // Same camera/projection/interaction as the two-lane FacilityView, but the
  // ribbon is a straight multilane deck:
  //   length -> longitudinal extent, grade -> elevation (lifts the far end),
  //   lane count -> number of dashed lane lines, lane width -> deck width,
  //   right-side clearance -> shoulder strip.
  export let laneCount = 3;
  export let laneWidth = 12;
  export let length = 0.625;
  export let grade = 0;
  export let lcR = 6;

  const VIEW_W = 720, VIEW_H = 230, PAD = 28;
  const STEPS = 60;
  const Z_EXAG = 7;   // grade elevation exaggeration
  const THICK = 11;   // slab thickness (screen px)

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
  const P = (a) => a.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Camera: drag = rotate (yaw/pitch), Alt-drag = pan, scroll/pinch = zoom.
  const DEF_YAW = 35, DEF_PITCH = 30;
  let yaw = DEF_YAW, pitch = DEF_PITCH;
  let zoom = 1, panX = 0, panY = 0;
  let dragging = false;
  let svgEl;

  const vbPerPx = () => (svgEl && svgEl.clientWidth ? VIEW_W / svgEl.clientWidth : 1);
  const pointers = new Map();
  let mode = null;   // 'rotate' | 'pan' | 'pinch'
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
      pitch = clamp(start.pitch - (e.clientY - start.y) * 0.35, 8, 82);
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
    const px = (e.clientX - rect.left) * (VIEW_W / rect.width);
    const py = (e.clientY - rect.top) * (VIEW_H / rect.height);
    const newZoom = clamp(zoom * Math.exp(-e.deltaY * 0.0015), 0.3, 6);
    const r = newZoom / zoom;
    panX = (px - VIEW_W / 2) * (1 - r) + r * panX;
    panY = (py - VIEW_H / 2) * (1 - r) + r * panY;
    zoom = newZoom;
  }

  function resetView() { yaw = DEF_YAW; pitch = DEF_PITCH; zoom = 1; panX = 0; panY = 0; }

  $: model = build(laneCount, laneWidth, length, grade, lcR, yaw, pitch, zoom, panX, panY);

  function build(N, lw, len, grade, lcR, yaw, pitch, zoom, panX, panY) {
    const ay = (yaw * Math.PI) / 180, ap = (pitch * Math.PI) / 180;
    const cay = Math.cos(ay), say = Math.sin(ay), cap = Math.cos(ap), sap = Math.sin(ap);
    const project = (x, y, z) => {
      const x1 = x * cay - y * say;
      const y1 = x * say + y * cay;
      return { x: x1, y: -(y1 * cap + z * sap) };
    };

    N = clamp(Math.round(num(N, 3)), 1, 6);
    const elen = Math.max(num(len, 0), 0.05);
    const lwF = lw > 0 ? lw / 12 : 1;
    const laneUnit = elen * 0.05 * lwF;               // one lane plan width (exaggerated for visibility)
    const halfW = (N * laneUnit) / 2;
    const shW = laneUnit * 0.5 * clamp(num(lcR, 6) / 6, 0.3, 1.4);
    const g = num(grade, 0) / 100;

    // straight stations along +y, rising by grade
    const st = [];
    for (let k = 0; k <= STEPS; k++) { const s = (k / STEPS) * elen; st.push({ y: s, z: s * g }); }
    const wp = (i, x) => ({ x, y: st[i].y, z: st[i].z });

    const Lw = st.map((_, i) => wp(i, halfW));         // left edge
    const Rw = st.map((_, i) => wp(i, -halfW));        // right edge
    const Shw = st.map((_, i) => wp(i, -halfW - shW)); // shoulder outer
    const dividersW = [];
    for (let d = 1; d < N; d++) { const x = halfW - d * laneUnit; dividersW.push(st.map((_, i) => wp(i, x))); }
    const Lg = st.map((_, i) => ({ x: halfW, y: st[i].y, z: 0 }));
    const Rg = st.map((_, i) => ({ x: -halfW - shW, y: st[i].y, z: 0 }));

    const projZ = (p) => project(p.x, p.y, p.z * Z_EXAG);
    const proj0 = (p) => project(p.x, p.y, 0);
    const L = Lw.map(projZ), R = Rw.map(projZ), Sh = Shw.map(projZ);
    const Dv = dividersW.map((arr) => arr.map(projZ));
    const Gl = Lg.map(proj0), Gr = Rg.map(proj0);

    // rotation-invariant scale + centre on the projected bounding box
    const xs = [...Lw, ...Shw].map((p) => p.x), ys = st.map((s) => s.y), zs = st.map((s) => s.z);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const spanZ = (Math.max(...zs) - Math.min(...zs)) * Z_EXAG;
    const RAD = Math.hypot(spanX, spanY) || 1;
    const base0 = 1.25 * Math.min((VIEW_W - 2 * PAD) / RAD, (VIEW_H - 2 * PAD) / (RAD + spanZ));
    const sc = base0 * zoom;
    const allP = [...L, ...R, ...Sh, ...Gl, ...Gr];
    const axs = allP.map((p) => p.x), ays = allP.map((p) => p.y);
    const cxp = (Math.min(...axs) + Math.max(...axs)) / 2;
    const cyp = (Math.min(...ays) + Math.max(...ays)) / 2;
    const ox = VIEW_W / 2 - cxp * sc + panX;
    const oy = VIEW_H / 2 - cyp * sc + panY;
    const tf = (gArr) => gArr.map((p) => ({ x: p.x * sc + ox, y: p.y * sc + oy }));
    const Lf = tf(L), Rf = tf(R), Shf = tf(Sh), Glf = tf(Gl), Grf = tf(Gr);
    const Dvf = Dv.map(tf);

    const poly = (a, b, dy = 0) =>
      'M' + a.map((p) => `${p.x.toFixed(1)},${(p.y + dy).toFixed(1)}`).join(' L') +
      ' L' + [...b].reverse().map((p) => `${p.x.toFixed(1)},${(p.y + dy).toFixed(1)}`).join(' L') + ' Z';
    const wall = (edge) =>
      'M' + edge.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') +
      ' L' + [...edge].reverse().map((p) => `${p.x.toFixed(1)},${(p.y + THICK).toFixed(1)}`).join(' L') + ' Z';
    const endFace = (m, n) =>
      `M${m.x.toFixed(1)},${m.y.toFixed(1)} L${n.x.toFixed(1)},${n.y.toFixed(1)} ` +
      `L${n.x.toFixed(1)},${(n.y + THICK).toFixed(1)} L${m.x.toFixed(1)},${(m.y + THICK).toFixed(1)} Z`;

    const cMidA = { x: (Lf[Lf.length - 2].x + Rf[Rf.length - 2].x) / 2, y: (Lf[Lf.length - 2].y + Rf[Rf.length - 2].y) / 2 };
    const cMidB = { x: (Lf[Lf.length - 1].x + Rf[Rf.length - 1].x) / 2, y: (Lf[Lf.length - 1].y + Rf[Rf.length - 1].y) / 2 };
    const ang = (Math.atan2(cMidB.y - cMidA.y, cMidB.x - cMidA.x) * 180) / Math.PI;

    return {
      shadow: poly(Glf, Grf),
      bottom: poly(Lf, Shf, THICK),
      wallL: wall(Lf),
      wallR: wall(Shf),
      capA: endFace(Lf[0], Shf[0]),
      capB: endFace(Lf[Lf.length - 1], Shf[Shf.length - 1]),
      surface: poly(Lf, Rf),
      shoulder: poly(Rf, Shf),
      edgeL: P(Lf), edgeR: P(Rf),
      dividers: Dvf.map(P),
      arrow: { x: cMidB.x, y: cMidB.y, ang },
    };
  }
</script>

<div class="fw3d">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {VIEW_W} {VIEW_H}"
    class="fw3d-svg"
    class:grabbing={dragging}
    role="img"
    aria-label="Basic freeway segment — drag to rotate, Alt-drag to move, scroll to zoom"
    on:pointerdown={onDown}
    on:pointermove={onMove}
    on:pointerup={onUp}
    on:pointercancel={onUp}
    on:wheel|nonpassive={onWheel}
  >
    <defs>
      <linearGradient id="fwRoadGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5d6f88" />
        <stop offset="50%" stop-color="#4b5b71" />
        <stop offset="100%" stop-color="#3e4b5e" />
      </linearGradient>
    </defs>
    <path d={model.shadow} class="r-shadow" />
    <path d={model.bottom} class="r-bottom" />
    <path d={model.wallL} class="r-wall" />
    <path d={model.wallR} class="r-wall" />
    <path d={model.capA} class="r-wall" />
    <path d={model.capB} class="r-wall" />
    <path d={model.surface} class="r-surface" />
    <path d={model.shoulder} class="r-shoulder" />
    <polyline points={model.edgeL} class="r-edge" />
    <polyline points={model.edgeR} class="r-edge" />
    {#each model.dividers as d}
      <polyline points={d} class="r-lane" stroke-dasharray="7 6" />
    {/each}
    <g transform="translate({model.arrow.x}, {model.arrow.y}) rotate({model.arrow.ang})">
      <path d="M0,0 L-11,-5 L-8,0 L-11,5 Z" class="r-arrow" />
    </g>
  </svg>
  <div class="fw3d-foot">
    <span class="fw3d-cap">Drag to rotate · Alt-drag to move · scroll / pinch to zoom.</span>
    <button type="button" class="fw3d-reset" on:click={resetView}>Reset view</button>
  </div>
</div>

<style>
  .fw3d { width: 100%; }
  .fw3d-svg {
    width: 100%;
    height: auto;
    display: block;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .fw3d-svg.grabbing { cursor: grabbing; }
  .fw3d-cap { font-size: 0.75rem; color: #94a3b8; }
  .fw3d-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.4rem;
  }
  .fw3d-reset {
    flex-shrink: 0;
    font-size: 0.72rem;
    font-weight: 600;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    background: #fff;
  }
  .fw3d-reset:hover { color: #ea7317; border-color: #f4c08a; }

  .r-shadow { fill: rgba(15, 23, 42, 0.07); stroke: none; }
  .r-bottom { fill: #0f172a; stroke: #0f172a; stroke-width: 1; stroke-linejoin: round; }
  .r-wall { fill: #1e293b; stroke: #1e293b; stroke-width: 0.75; stroke-linejoin: round; }
  .r-surface { fill: url(#fwRoadGrad); stroke: #334155; stroke-width: 1; stroke-linejoin: round; }
  .r-shoulder { fill: #6b7a90; stroke: #334155; stroke-width: 0.75; stroke-linejoin: round; opacity: 0.85; }
  .r-edge { fill: none; stroke: #f1f5f9; stroke-width: 1.6; opacity: 0.85; }
  /* Freeway lane lines are white (same-direction traffic), not the yellow/orange
     centerline of a two-lane highway. */
  .r-lane { fill: none; stroke: #f1f5f9; stroke-width: 1.4; stroke-linecap: round; opacity: 0.75; }
  .r-arrow { fill: #ea7317; }
</style>
