<script>
  // Connected, static isometric view of the whole facility.
  // Geometry is derived from the segment data:
  //   length      -> longitudinal extent
  //   grade       -> elevation (lifts the ribbon; posts/ground show height)
  //   horizontal  -> heading change from design radius (the road bends)
  //   superelev.  -> cross-slope banking on curves
  //   passing lane-> the road widens by an extra lane
  //   lane width  -> overall road width
  export let rows = [];
  export let laneWidth = 12;

  const VIEW_W = 720, VIEW_H = 320, PAD = 42;
  const STEPS = 190;
  const Z_EXAG = 7;     // grade elevation exaggeration
  const BANK_EXAG = 6;  // superelevation exaggeration
  const THICK = 6;      // road slab thickness (screen px)

  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const P = (a) => a.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const dashFor = (t) => (t === 'Passing Zone' ? '7 5' : '0');

  // Camera: drag = rotate (yaw/pitch), Alt-drag = pan, scroll/pinch = zoom.
  const DEF_YAW = 35, DEF_PITCH = 30;
  let yaw = DEF_YAW, pitch = DEF_PITCH;
  let zoom = 1, panX = 0, panY = 0;
  let dragging = false;
  let svgEl;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
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
    panX = (px - VIEW_W / 2) * (1 - r) + r * panX; // keep point under cursor fixed
    panY = (py - VIEW_H / 2) * (1 - r) + r * panY;
    zoom = newZoom;
  }

  function resetView() { yaw = DEF_YAW; pitch = DEF_PITCH; zoom = 1; panX = 0; panY = 0; }

  $: model = build(rows, laneWidth, yaw, pitch, zoom, panX, panY);

  function build(rows, laneWidth, yaw, pitch, zoom, panX, panY) {
    // yaw about the vertical axis, then tilt by pitch (orthographic)
    const ay = (yaw * Math.PI) / 180, ap = (pitch * Math.PI) / 180;
    const cay = Math.cos(ay), say = Math.sin(ay), cap = Math.cos(ap), sap = Math.sin(ap);
    const project = (x, y, z) => {
      const x1 = x * cay - y * say;
      const y1 = x * say + y * cay;
      return { x: x1, y: -(y1 * cap + z * sap) };
    };
    const segs = (rows || []).map((r) => ({
      type: r.passing_type || '',
      len: num(r.seg_length, 0),
      grade: num(r.seg_grade, 0),
      isHc: !!r.is_hc,
      subs: (r.subrows || []).map((s) => ({
        len: num(s.subseg_length, 0) / 5280,    // ft -> mi
        radius: num(s.design_radius, 0) / 5280,  // ft -> mi
        supere: num(s.superelevation, 0),        // %
      })),
      num: r.seg_num,
    }));
    if (!segs.length) return { empty: true };

    const totalReal = segs.reduce((a, s) => a + Math.max(s.len, 0), 0);
    const fb = totalReal <= 0;
    segs.forEach((s) => (s.elen = s.len > 0 ? s.len : fb ? 1 : 0.0015));
    const total = segs.reduce((a, s) => a + s.elen, 0) || 1;

    const lwF = laneWidth > 0 ? laneWidth / 12 : 1;   // lane-width scale
    const base = total * 0.013 * lwF;                  // one lane half-extent (plan)

    let hx = 0, hy = 0, heading = Math.PI / 2, elev = 0;
    const stn = [];
    const ranges = [];

    const sample = (segPos, s) => {
      // curvature + superelevation from the active horizontal-curve subsegment
      let kappa = 0, supere = 0;
      if (s.isHc) {
        let acc = 0;
        for (const sub of s.subs) {
          if (sub.len <= 0) continue;
          if (segPos >= acc && segPos < acc + sub.len) {
            if (sub.radius > 0) kappa = 1 / sub.radius;
            supere = sub.supere;
            break;
          }
          acc += sub.len;
        }
      }
      return { kappa, supere };
    };

    const push = (si, s) => {
      const f = s.elen > 0 ? segPos / s.elen : 0;
      // passing-lane taper (extra lane added on the analysis side)
      let t = 0;
      if (s.type === 'Passing Lane') {
        t = f < 0.18 ? smooth(f / 0.18) : f > 0.82 ? smooth((1 - f) / 0.18) : 1;
      }
      const lat = { x: -Math.sin(heading), y: Math.cos(heading) };
      const hwL = base;
      const hwR = base * (1 + t);                 // widen right side for passing lane
      const bankSign = kappa > 0 ? 1 : kappa < 0 ? -1 : 0;
      const bank = (supere / 100) * base * BANK_EXAG * bankSign;
      stn.push({
        cx: hx, cy: hy, cz: elev,
        lx: hx + lat.x * hwL, ly: hy + lat.y * hwL, lz: elev - bank,
        rx: hx - lat.x * hwR, ry: hy - lat.y * hwR, rz: elev + bank,
        dx: hx - lat.x * base, dy: hy - lat.y * base, // passing-lane divider line
        seg: si, type: s.type, pl: s.type === 'Passing Lane' && t > 0.05,
      });
    };

    let segPos = 0, kappa = 0, supere = 0;
    // initial station (use first segment context)
    ({ kappa, supere } = sample(0, segs[0]));
    push(0, segs[0]);
    segs.forEach((s, si) => {
      const start = stn.length - 1;
      const n = Math.max(2, Math.round((s.elen / total) * STEPS));
      const sds = s.elen / n;
      segPos = 0;
      for (let k = 0; k < n; k++) {
        ({ kappa, supere } = sample(segPos, s));
        heading += kappa * sds;
        hx += Math.cos(heading) * sds;
        hy += Math.sin(heading) * sds;
        elev += sds * (s.grade / 100);
        segPos += sds;
        push(si, s);
      }
      ranges.push([start, stn.length - 1]);
    });

    // project (iso) — road + ground (z=0)
    const C = stn.map((s) => project(s.cx, s.cy, s.cz * Z_EXAG));
    const L = stn.map((s) => project(s.lx, s.ly, s.lz * Z_EXAG));
    const R = stn.map((s) => project(s.rx, s.ry, s.rz * Z_EXAG));
    const D = stn.map((s) => project(s.dx, s.dy, s.cz * Z_EXAG));
    const Gc = stn.map((s) => project(s.cx, s.cy, 0));
    const Gl = stn.map((s) => project(s.lx, s.ly, 0));
    const Gr = stn.map((s) => project(s.rx, s.ry, 0));

    // rotation-invariant scale (derived from plan footprint + elevation),
    // so the facility keeps its size while you rotate; centre on the
    // projected bounding box.
    const pxs = stn.flatMap((s) => [s.cx, s.lx, s.rx]);
    const pys = stn.flatMap((s) => [s.cy, s.ly, s.ry]);
    const pzs = stn.flatMap((s) => [s.cz, s.lz, s.rz]);
    const spanX = Math.max(...pxs) - Math.min(...pxs);
    const spanY = Math.max(...pys) - Math.min(...pys);
    const spanZ = (Math.max(...pzs) - Math.min(...pzs)) * Z_EXAG;
    const RAD = Math.hypot(spanX, spanY) || 1;
    const base0 = Math.min((VIEW_W - 2 * PAD) / RAD, (VIEW_H - 2 * PAD) / (RAD + spanZ));
    const sc = base0 * zoom;
    const all = [...C, ...L, ...R, ...Gc, ...Gl, ...Gr];
    const axs = all.map((p) => p.x), ays = all.map((p) => p.y);
    const cxp = (Math.min(...axs) + Math.max(...axs)) / 2;
    const cyp = (Math.min(...ays) + Math.max(...ays)) / 2;
    const ox = VIEW_W / 2 - cxp * sc + panX;
    const oy = VIEW_H / 2 - cyp * sc + panY;
    const tf = (g) => g.map((p) => ({ x: p.x * sc + ox, y: p.y * sc + oy }));
    const [Cf, Lf, Rf, Df, Gcf, Glf, Grf] = [C, L, R, D, Gc, Gl, Gr].map(tf);

    const poly = (a, b, dy = 0) =>
      'M' + a.map((p) => `${p.x.toFixed(1)},${(p.y + dy).toFixed(1)}`).join(' L') +
      ' L' + [...b].reverse().map((p) => `${p.x.toFixed(1)},${(p.y + dy).toFixed(1)}`).join(' L') + ' Z';

    // grade posts + ground lines at intervals and boundaries
    const postIdx = new Set(ranges.flatMap((r) => [r[0], r[1]]));
    for (let i = 0; i < Cf.length; i += Math.max(6, Math.round(Cf.length / 18))) postIdx.add(i);
    const posts = [...postIdx]
      .map((i) => ({ x1: Gcf[i].x, y1: Gcf[i].y, x2: Cf[i].x, y2: Cf[i].y }))
      .filter((p) => Math.abs(p.y1 - p.y2) > 1.5);

    const segMarks = ranges.map((r, si) => ({
      pts: P(Cf.slice(r[0], r[1] + 1)),
      dash: dashFor(segs[si].type),
      num: segs[si].num,
      mid: Cf[Math.floor((r[0] + r[1]) / 2)],
    }));

    // passing-lane divider segments (dashed, offset to the analysis side)
    const plRanges = [];
    let run = null;
    stn.forEach((s, i) => {
      if (s.pl) { if (!run) run = [i, i]; else run[1] = i; }
      else if (run) { plRanges.push(run); run = null; }
    });
    if (run) plRanges.push(run);
    const plDividers = plRanges.map((r) => P(Df.slice(r[0], r[1] + 1)));

    const a = Cf[Cf.length - 2] || Cf[0], b = Cf[Cf.length - 1];
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

    return {
      empty: false,
      shadow: poly(Glf, Grf),
      extrude: poly(Lf, Rf, THICK),
      surface: poly(Lf, Rf),
      ground: P(Gcf),
      posts,
      edgeL: P(Lf), edgeR: P(Rf),
      segMarks, plDividers,
      arrow: { x: b.x, y: b.y, ang },
    };
  }
</script>

<div class="facility3d">
  {#if model.empty}
    <p class="facility3d-empty">Add a segment to see the connected facility.</p>
  {:else}
    <svg
      bind:this={svgEl}
      viewBox="0 0 {VIEW_W} {VIEW_H}"
      class="facility3d-svg"
      class:grabbing={dragging}
      role="img"
      aria-label="Connected facility view — drag to rotate, Alt-drag to move, scroll to zoom"
      on:pointerdown={onDown}
      on:pointermove={onMove}
      on:pointerup={onUp}
      on:pointercancel={onUp}
      on:wheel|nonpassive={onWheel}
    >
      <!-- ground footprint -->
      <path d={model.shadow} class="r-shadow" />
      <polyline points={model.ground} class="r-ground" />
      <!-- grade posts -->
      {#each model.posts as p}
        <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} class="r-post" />
      {/each}
      <!-- slab thickness -->
      <path d={model.extrude} class="r-extrude" />
      <!-- road surface -->
      <path d={model.surface} class="r-surface" />
      <polyline points={model.edgeL} class="r-edge" />
      <polyline points={model.edgeR} class="r-edge" />
      <!-- centerline markings -->
      {#each model.segMarks as s}
        <polyline points={s.pts} class="r-center" stroke-dasharray={s.dash} />
      {/each}
      <!-- passing-lane dividers -->
      {#each model.plDividers as d}
        <polyline points={d} class="r-center" stroke-dasharray="3 5" />
      {/each}
      <!-- segment badges -->
      {#each model.segMarks as s}
        <g transform="translate({s.mid.x}, {s.mid.y - 15})">
          <rect x="-8" y="-8" width="16" height="16" rx="4" class="r-badge-bg" />
          <text x="0" y="4" class="r-badge-tx">{s.num}</text>
        </g>
      {/each}
      <!-- direction arrow -->
      <g transform="translate({model.arrow.x}, {model.arrow.y}) rotate({model.arrow.ang})">
        <path d="M0,0 L-11,-5 L-8,0 L-11,5 Z" class="r-arrow" />
      </g>
    </svg>
    <div class="facility3d-foot">
      <span class="facility3d-cap">
        Drag to rotate · Alt-drag to move · scroll / pinch to zoom.
      </span>
      <button type="button" class="facility3d-reset" on:click={resetView}>Reset view</button>
    </div>
  {/if}
</div>

<style>
  .facility3d { width: 100%; }
  .facility3d-svg {
    width: 100%;
    height: auto;
    display: block;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .facility3d-svg.grabbing { cursor: grabbing; }
  .facility3d-empty,
  .facility3d-cap { font-size: 0.75rem; color: #94a3b8; }
  .facility3d-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.4rem;
  }
  .facility3d-reset {
    flex-shrink: 0;
    font-size: 0.72rem;
    font-weight: 600;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    background: #fff;
  }
  .facility3d-reset:hover { color: #ea7317; border-color: #f4c08a; }

  .r-shadow { fill: rgba(15, 23, 42, 0.07); stroke: none; }
  .r-ground { fill: none; stroke: rgba(148, 163, 184, 0.5); stroke-width: 1; stroke-dasharray: 2 4; }
  .r-post { stroke: rgba(100, 116, 139, 0.45); stroke-width: 1; stroke-dasharray: 2 3; }
  .r-extrude { fill: #1e293b; stroke: #1e293b; stroke-width: 1; stroke-linejoin: round; }
  .r-surface { fill: #475569; stroke: #334155; stroke-width: 1; stroke-linejoin: round; }
  .r-edge { fill: none; stroke: #cbd5e1; stroke-width: 1; opacity: 0.5; }
  .r-center { fill: none; stroke: #f8b24a; stroke-width: 1.6; stroke-linecap: round; }
  .r-badge-bg { fill: #fff; stroke: #ea7317; stroke-width: 1.2; }
  .r-badge-tx { fill: #ea7317; font-size: 9px; font-weight: 700; text-anchor: middle; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .r-arrow { fill: #ea7317; }
</style>
