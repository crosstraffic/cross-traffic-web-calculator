<script>
  // Rotatable 3D view of the four-leg signalized intersection. Same camera,
  // projection, and slab styling as FreewaySegment3D (drag = rotate, Alt-drag
  // = pan, scroll/pinch = zoom), with the plan geometry of SignalizedDiagram:
  // road half-widths follow the per-approach lane inputs and the twelve
  // movement paths draw in the approach colors, lefts dashed while permitted.
  export let approaches = [];

  let hovered = null;

  const VIEW_W = 520, VIEW_H = 340, PAD = 24;
  const THICK = 9;    // slab thickness (screen px)
  const LANE = 1;     // one lane, plan units
  const RUN = 5.2;    // leg length outside the intersection box, plan units

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const fallback = { ln_left: 1, ln_thru: 1, ln_right: 0, left_phase: 0 };
  $: byKey = Object.fromEntries((approaches || []).map((a) => [a.key, a]));
  $: ap = (key) => byKey[key] ?? fallback;
  $: nL = (key) => Math.max(0, Number(ap(key).ln_left) || 0);
  $: nT = (key) => Math.max(1, Number(ap(key).ln_thru) || 1);
  $: nR = (key) => Math.max(0, Number(ap(key).ln_right) || 0);
  $: lanes = (key) => nL(key) + nT(key) + nR(key);
  $: protectedLeft = (key) => (Number(ap(key).left_phase) || 0) > 0 && nL(key) > 0;

  // ── camera ──
  const DEF_YAW = 24, DEF_PITCH = 42;
  let yaw = DEF_YAW, pitch = DEF_PITCH;
  let zoom = 1, panX = 0, panY = 0;
  let dragging = false;
  let svgEl;

  const vbPerPx = () => (svgEl && svgEl.clientWidth ? VIEW_W / svgEl.clientWidth : 1);
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
    const px = (e.clientX - rect.left) * (VIEW_W / rect.width);
    const py = (e.clientY - rect.top) * (VIEW_H / rect.height);
    const newZoom = clamp(zoom * Math.exp(-e.deltaY * 0.0015), 0.3, 6);
    const r = newZoom / zoom;
    panX = (px - VIEW_W / 2) * (1 - r) + r * panX;
    panY = (py - VIEW_H / 2) * (1 - r) + r * panY;
    zoom = newZoom;
  }

  function resetView() { yaw = DEF_YAW; pitch = DEF_PITCH; zoom = 1; panX = 0; panY = 0; }

  // ── model ──
  $: model = build(
    lanes('NB'), lanes('SB'), lanes('EB'), lanes('WB'),
    nL('NB'), nT('NB'), nL('SB'), nT('SB'), nL('EB'), nT('EB'), nL('WB'), nT('WB'),
    yaw, pitch, zoom, panX, panY
  );

  function build(lNB, lSB, lEB, lWB, lnlNB, lntNB, lnlSB, lntSB, lnlEB, lntEB, lnlWB, lntWB, yaw, pitch, zoom, panX, panY) {
    const ay = (yaw * Math.PI) / 180, apc = (pitch * Math.PI) / 180;
    const cay = Math.cos(ay), say = Math.sin(ay), cap = Math.cos(apc), sap = Math.sin(apc);
    // Plan coordinates: x east, y north, z up.
    const project = (x, y) => {
      const x1 = x * cay - y * say;
      const y1 = x * say + y * cay;
      return { x: x1, y: -(y1 * cap) };
    };

    const wNB = lNB * LANE, wSB = lSB * LANE, wEB = lEB * LANE, wWB = lWB * LANE;
    const XW = -(wSB + RUN), XE = wNB + RUN, YS = -(wEB + RUN), YN = wWB + RUN;

    // Cross outline, counterclockwise from the west leg's south edge.
    const cross = [
      [XW, -wEB], [-wSB, -wEB], [-wSB, YS], [wNB, YS], [wNB, -wEB], [XE, -wEB],
      [XE, wWB], [wNB, wWB], [wNB, YN], [-wSB, YN], [-wSB, wWB], [XW, wWB],
    ];

    // Fit: rotation-invariant scale from the plan bounding radius.
    const RAD = Math.hypot(XE - XW, YN - YS) || 1;
    const sc0 = Math.min((VIEW_W - 2 * PAD) / RAD, (VIEW_H - 2 * PAD) / RAD) * 1.28;
    const sc = sc0 * zoom;
    const pr = cross.map(([x, y]) => project(x, y));
    const cxs = pr.map((p) => p.x), cys = pr.map((p) => p.y);
    const cxp = (Math.min(...cxs) + Math.max(...cxs)) / 2;
    const cyp = (Math.min(...cys) + Math.max(...cys)) / 2;
    const ox = VIEW_W / 2 - cxp * sc + panX;
    const oy = VIEW_H / 2 - cyp * sc + panY - THICK / 2;
    const tf = (x, y) => {
      const p = project(x, y);
      return { x: p.x * sc + ox, y: p.y * sc + oy };
    };

    const ptsTop = cross.map(([x, y]) => tf(x, y));
    const topPath = 'M' + ptsTop.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') + ' Z';
    const shadowPath = 'M' + ptsTop.map((p) => `${p.x.toFixed(1)},${(p.y + THICK + 3).toFixed(1)}`).join(' L') + ' Z';

    // Exterior walls: each outline edge extruded downward by THICK screen px.
    const walls = [];
    for (let i = 0; i < ptsTop.length; i++) {
      const a = ptsTop[i], b = ptsTop[(i + 1) % ptsTop.length];
      walls.push(`M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)} L${b.x.toFixed(1)},${(b.y + THICK).toFixed(1)} L${a.x.toFixed(1)},${(a.y + THICK).toFixed(1)} Z`);
    }

    const seg = (x1, y1, x2, y2) => {
      const a = tf(x1, y1), b = tf(x2, y2);
      return `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
    };
    const polyline = (pts) => 'M' + pts.map(([x, y]) => { const p = tf(x, y); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' L');
    const qSample = (p0, pc, p1, n = 14) => {
      const out = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n, u = 1 - t;
        out.push([u * u * p0[0] + 2 * u * t * pc[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * pc[1] + t * t * p1[1]]);
      }
      return out;
    };

    // Markings: centerlines, lane lines, stop bars, per leg.
    const centers = [
      seg(0, YS, 0, -wEB), seg(0, wWB, 0, YN),
      seg(XW, 0, -wSB, 0), seg(wNB, 0, XE, 0),
    ];
    const laneLines = [];
    for (let i = 1; i < lNB; i++) { laneLines.push(seg(i * LANE, YS, i * LANE, -wEB), seg(i * LANE, wWB, i * LANE, YN)); }
    for (let i = 1; i < lSB; i++) { laneLines.push(seg(-i * LANE, YS, -i * LANE, -wEB), seg(-i * LANE, wWB, -i * LANE, YN)); }
    for (let i = 1; i < lEB; i++) { laneLines.push(seg(XW, -i * LANE, -wSB, -i * LANE), seg(wNB, -i * LANE, XE, -i * LANE)); }
    for (let i = 1; i < lWB; i++) { laneLines.push(seg(XW, i * LANE, -wSB, i * LANE), seg(wNB, i * LANE, XE, i * LANE)); }
    const stops = [
      seg(0, -wEB - 0.12, wNB, -wEB - 0.12),
      seg(-wSB, wWB + 0.12, 0, wWB + 0.12),
      seg(-wSB - 0.12, 0, -wSB - 0.12, -wEB),
      seg(wNB + 0.12, wWB, wNB + 0.12, 0),
    ];

    // Movement paths per approach; lane centers i lanes out from the centerline.
    const xNB = (i) => (i + 0.5) * LANE, xSB = (i) => -(i + 0.5) * LANE;
    const yEB = (i) => -(i + 0.5) * LANE, yWB = (i) => (i + 0.5) * LANE;
    const iT = (lnl, lnt) => lnl + Math.floor((lnt - 1) / 2);
    const moves = {
      NB: {
        thru: polyline([[xNB(iT(lnlNB, lntNB)), YS], [xNB(iT(lnlNB, lntNB)), YN]]),
        left: polyline([[xNB(0), YS], [xNB(0), -wEB], ...qSample([xNB(0), -wEB], [xNB(0), LANE / 2], [-wSB, LANE / 2]), [XW, LANE / 2]]),
        right: polyline([[xNB(lNB - 1), YS], [xNB(lNB - 1), -wEB], ...qSample([xNB(lNB - 1), -wEB], [xNB(lNB - 1), -wEB + LANE / 2], [wNB, -wEB + LANE / 2]), [XE, -wEB + LANE / 2]]),
      },
      SB: {
        thru: polyline([[xSB(iT(lnlSB, lntSB)), YN], [xSB(iT(lnlSB, lntSB)), YS]]),
        left: polyline([[xSB(0), YN], [xSB(0), wWB], ...qSample([xSB(0), wWB], [xSB(0), -LANE / 2], [wNB, -LANE / 2]), [XE, -LANE / 2]]),
        right: polyline([[xSB(lSB - 1), YN], [xSB(lSB - 1), wWB], ...qSample([xSB(lSB - 1), wWB], [xSB(lSB - 1), wWB - LANE / 2], [-wSB, wWB - LANE / 2]), [XW, wWB - LANE / 2]]),
      },
      EB: {
        thru: polyline([[XW, yEB(iT(lnlEB, lntEB))], [XE, yEB(iT(lnlEB, lntEB))]]),
        left: polyline([[XW, yEB(0)], [-wSB, yEB(0)], ...qSample([-wSB, yEB(0)], [LANE / 2, yEB(0)], [LANE / 2, wWB]), [LANE / 2, YN]]),
        right: polyline([[XW, yEB(lEB - 1)], [-wSB, yEB(lEB - 1)], ...qSample([-wSB, yEB(lEB - 1)], [-wSB + LANE / 2, yEB(lEB - 1)], [-wSB + LANE / 2, -wEB]), [-wSB + LANE / 2, YS]]),
      },
      WB: {
        thru: polyline([[XE, yWB(iT(lnlWB, lntWB))], [XW, yWB(iT(lnlWB, lntWB))]]),
        left: polyline([[XE, yWB(0)], [wNB, yWB(0)], ...qSample([wNB, yWB(0)], [-LANE / 2, yWB(0)], [-LANE / 2, -wEB]), [-LANE / 2, YS]]),
        right: polyline([[XE, yWB(lWB - 1)], [wNB, yWB(lWB - 1)], ...qSample([wNB, yWB(lWB - 1)], [wNB - LANE / 2, yWB(lWB - 1)], [wNB - LANE / 2, wWB]), [wNB - LANE / 2, YN]]),
      },
    };

    return { topPath, shadowPath, walls, centers, laneLines, stops, moves };
  }

  const order = [
    { key: 'NB', label: 'Northbound' },
    { key: 'SB', label: 'Southbound' },
    { key: 'EB', label: 'Eastbound' },
    { key: 'WB', label: 'Westbound' },
  ];

  function cls(h, key) {
    if (h == null) return 'sd3-move';
    return h === key ? 'sd3-move active' : 'sd3-move dim';
  }
</script>

<div class="signal-diagram-3d">
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <svg bind:this={svgEl} viewBox="0 0 {VIEW_W} {VIEW_H}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label="four-leg signalized intersection, 3D view"
       class:dragging
       on:pointerdown={onDown} on:pointermove={onMove} on:pointerup={onUp}
       on:pointercancel={onUp} on:wheel={onWheel} on:contextmenu|preventDefault>

    <path d={model.shadowPath} class="sd3-shadow" />
    {#each model.walls as w}
      <path d={w} class="sd3-wall" />
    {/each}
    <path d={model.topPath} class="sd3-top" />

    {#each model.centers as c}
      <path d={c} class="sd3-center" />
    {/each}
    {#each model.laneLines as l}
      <path d={l} class="sd3-lane-line" />
    {/each}
    {#each model.stops as s}
      <path d={s} class="sd3-stop" />
    {/each}

    {#each order as o}
      <path d={model.moves[o.key].thru} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`} />
      <path d={model.moves[o.key].left} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`}
            stroke-dasharray={protectedLeft(o.key) ? null : '6 5'} />
      <path d={model.moves[o.key].right} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`} />
    {/each}
  </svg>

  <div class="sd3-bar">
    <span class="sd3-hint">Drag to rotate, Alt-drag to pan, scroll to zoom.</span>
    <button type="button" class="btn btn-ghost btn-xs" on:click={resetView}>Reset view</button>
  </div>

  <div class="sd3-legend" role="list">
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="sd3-chip {o.key.toLowerCase()}"
        class:active={hovered === o.key}
        on:mouseenter={() => (hovered = o.key)}
        on:mouseleave={() => (hovered = null)}
        on:focus={() => (hovered = o.key)}
        on:blur={() => (hovered = null)}
      >
        <span class="swatch {o.key.toLowerCase()}"></span>
        {o.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .signal-diagram-3d svg {
    width: 100%;
    max-width: 560px;
    display: block;
    margin: 0 auto;
    touch-action: none;
    cursor: grab;
  }
  .signal-diagram-3d svg.dragging { cursor: grabbing; }

  .sd3-shadow { fill: #0f172a; opacity: 0.08; }
  .sd3-wall { fill: #94a3b8; stroke: #64748b; stroke-width: 0.5; }
  .sd3-top { fill: #e2e8f0; stroke: #334155; stroke-width: 1.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .sd3-center { stroke: #eab308; stroke-width: 1.25; fill: none; vector-effect: non-scaling-stroke; }
  .sd3-lane-line { stroke: #ffffff; stroke-width: 1.25; stroke-dasharray: 7 5; fill: none; vector-effect: non-scaling-stroke; }
  .sd3-stop { stroke: #ffffff; stroke-width: 3; fill: none; vector-effect: non-scaling-stroke; }

  .sd3-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.7;
  }
  .sd3-move.dim { opacity: 0.1; }
  .sd3-move.active { stroke-width: 4; opacity: 1; }
  .mv-nb { stroke: #2563eb; }
  .mv-sb { stroke: #16a34a; }
  .mv-eb { stroke: #ea7317; }
  .mv-wb { stroke: #dc2626; }
  .swatch.nb { background: #2563eb; }
  .swatch.sb { background: #16a34a; }
  .swatch.eb { background: #ea7317; }
  .swatch.wb { background: #dc2626; }

  .sd3-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.25rem;
  }
  .sd3-hint { font-size: 0.7rem; color: #64748b; }

  .sd3-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.35rem;
  }
  .sd3-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    padding: 0.15rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    background: transparent;
    cursor: default;
  }
  .sd3-chip.active { border-color: #334155; }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
</style>
