<script>
  // 3D ribbon view of the freeway facility: one extruded slab per segment in
  // a continuous deck, ramp wedges dropping off the right side of travel, and
  // slab tops colored by the segment's LOS for the selected analysis period.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers } from '$lib/proj3d.js';

  let { segments = [], losMatrix = null, selected = -1, onselect = null } = $props();

  // Tap-to-select without stealing the camera drag: the camera captures the
  // pointer on drag, so pointerup retargets to the svg and no click fires on
  // the slab. Record where a slab was pressed and treat a pointerup within a
  // few pixels as a tap on it.
  let pendingTap = null;
  function pressTop(e, i) {
    pendingTap = { i, x: e.clientX, y: e.clientY };
  }
  function release(e) {
    if (pendingTap && Math.hypot(e.clientX - pendingTap.x, e.clientY - pendingTap.y) < 6) {
      onselect?.(pendingTap.i);
    }
    pendingTap = null;
  }

  let period = $state(0);
  let periods = $derived(losMatrix && losMatrix[0] ? losMatrix[0].length : 0);
  $effect(() => {
    if (period >= periods) period = 0;
  });

  const VIEW_W = 560;
  const VIEW_H = 330;
  // The 3D plan compresses segment lengths and widens lanes relative to the
  // 2D strip, otherwise a several-mile facility projects as a thin stick.
  const LW = 14; // plan lane width
  const RAMP_D = 24; // how far ramps drop below the deck edge
  const THICK = 10;

  const LOS_COLOR = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444', F: '#b91c1c' };

  const clampLanes = (n) => Math.max(1, Math.min(8, n));

  let plan = $derived.by(() => {
    let x = 0;
    return (segments || []).map((s) => {
      const len = Math.max(200, Number(s.length_ft) || 1000);
      const w = Math.max(30, Math.min(86, 16 + len / 85));
      const lanes = clampLanes(Number(s.lanes) || 3);
      // Work zone read off the same segment state the page hands to
      // set_work_zone, on the same reading as the 2D strip: the closure takes
      // its closed lanes out of the declared cross section rather than adding
      // pavement beside it.
      const wz = s.work_zone;
      const wzOpen = wz ? clampLanes(Number(wz.open_lanes) || 1) : 0;
      const total = wz ? Math.max(wzOpen, clampLanes(Number(wz.total_lanes) || wzOpen)) : 0;
      const closed = wz ? total - wzOpen : 0;
      const pav = wz ? Math.max(lanes, total) : lanes;
      const item = {
        x0: x,
        x1: x + w,
        lanes,
        open: pav - closed,
        pav,
        closed,
        soft: wz ? !!wz.soft_barrier : false,
        type: s.seg_type,
        num: s.seg_num,
      };
      x += w;
      return item;
    });
  });

  let maxLanes = $derived(Math.max(3, ...plan.map((p) => p.pav)));

  function losFor(i) {
    return losMatrix && losMatrix[i] ? losMatrix[i][period] : null;
  }
  function topFill(i) {
    const los = losFor(i);
    return los ? LOS_COLOR[los] : 'var(--diag-pavement)';
  }

  // The travelled deck occupies y in [0, open*LW] with the shared top edge at
  // y = maxLanes*LW so segments of different lane counts align on the median
  // side and grow toward the ramp side, matching the 2D strip.
  function slab(p) {
    const yTop = maxLanes * LW;
    const yBot = yTop - p.open * LW;
    return [
      [p.x0, yBot],
      [p.x1, yBot],
      [p.x1, yTop],
      [p.x0, yTop],
    ];
  }

  // Closed lanes extrude as their own slab between the travelled deck and the
  // ramp-side pavement edge, at the deck's own thickness because the pavement
  // is the same pavement. Null with no work zone, which keeps every other slab
  // byte-identical.
  function wzSlab(p) {
    if (!p.closed) return null;
    const yTop = maxLanes * LW;
    const yBot = yTop - p.open * LW;
    return [
      [p.x0, yBot - p.closed * LW],
      [p.x1, yBot - p.closed * LW],
      [p.x1, yBot],
      [p.x0, yBot],
    ];
  }

  // Ramp geometry mirrors the 2D strip: an angled stub feeding an
  // acceleration/deceleration lane that tapers into the pavement edge, which
  // is the outside of the closure where there is one (`p.pav` is the coded
  // lane count without a work zone).
  function ramps(p) {
    const yTop = maxLanes * LW;
    const yBot = yTop - p.pav * LW;
    const w = p.x1 - p.x0;
    const RL = LW * 0.75;
    const out = [];
    if (p.type === 'Merge') {
      out.push([
        [p.x0 - 18, yBot - RAMP_D],
        [p.x0 - 6, yBot - RAMP_D],
        [p.x0 + 12, yBot - RL],
        [p.x0, yBot - RL],
      ]);
      out.push([
        [p.x0, yBot],
        [p.x0 + w * 0.78, yBot],
        [p.x0 + w * 0.55, yBot - RL],
        [p.x0, yBot - RL],
      ]);
    } else if (p.type === 'Diverge') {
      out.push([
        [p.x0 + w * 0.22, yBot],
        [p.x1, yBot],
        [p.x1, yBot - RL],
        [p.x0 + w * 0.45, yBot - RL],
      ]);
      out.push([
        [p.x1, yBot - RL],
        [p.x1 + 12, yBot - RL],
        [p.x1 + 18, yBot - RAMP_D],
        [p.x1 + 6, yBot - RAMP_D],
      ]);
    } else if (p.type === 'Weaving') {
      out.push([
        [p.x0, yBot - RL],
        [p.x1, yBot - RL],
        [p.x1, yBot],
        [p.x0, yBot],
      ]);
      out.push([
        [p.x0 - 18, yBot - RAMP_D],
        [p.x0 - 6, yBot - RAMP_D],
        [p.x0 + 12, yBot - RL],
        [p.x0, yBot - RL],
      ]);
      out.push([
        [p.x1, yBot - RL],
        [p.x1 + 12, yBot - RL],
        [p.x1 + 18, yBot - RAMP_D],
        [p.x1 + 6, yBot - RAMP_D],
      ]);
    } else if (p.type === 'OverlappingRamp') {
      out.push([
        [p.x0 - 15, yBot - RAMP_D],
        [p.x0 - 3, yBot - RAMP_D],
        [p.x0 + 10, yBot - RL],
        [p.x0, yBot - RL],
      ]);
      out.push([
        [p.x0, yBot],
        [p.x0 + w * 0.62, yBot],
        [p.x0 + w * 0.62, yBot - RL],
        [p.x0, yBot - RL],
      ]);
      out.push([
        [p.x0 + w * 0.38, yBot],
        [p.x1, yBot],
        [p.x1, yBot - RL],
        [p.x0 + w * 0.38, yBot - RL],
      ]);
      out.push([
        [p.x1, yBot - RL],
        [p.x1 + 10, yBot - RL],
        [p.x1 + 15, yBot - RAMP_D],
        [p.x1 + 3, yBot - RAMP_D],
      ]);
    }
    return out;
  }

  let planPts = $derived.by(() => {
    const pts = [];
    for (const p of plan) {
      pts.push(...slab(p));
      const wz = wzSlab(p);
      if (wz) pts.push(...wz);
      for (const r of ramps(p)) pts.push(...r);
    }
    return pts.length
      ? pts
      : [
          [0, 0],
          [1, 1],
        ];
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fd3-wrap" onpointerup={release} onpointercancel={() => (pendingTap = null)}>
  <Camera3DSvg
    viewW={VIEW_W}
    viewH={VIEW_H}
    defYaw={18}
    defPitch={44}
    ariaLabel="freeway facility 3D view, {segments.length} segments"
  >
    {#snippet children({ yaw, pitch, zoom, panX, panY })}
      {@const project = planProjector(yaw, pitch)}
      {@const tf = fitTransform(project, planPts, VIEW_W, VIEW_H, 26, zoom, panX, panY, THICK)}
      {@const d = makeDrawers(tf, THICK)}

      <defs>
        <!-- Same barrier reading as the 2D strip: continuous diagonal for a
             hard barrier, interrupted for cones and drums. -->
        <pattern id="fd3WzHard" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" class="fd3-wz-stripe" />
        </pattern>
        <pattern id="fd3WzSoft" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" class="fd3-wz-stripe soft" />
        </pattern>
      </defs>

      <!-- shadows first -->
      {#each plan as p}
        <path d={d.shadow(slab(p))} class="fd3-shadow" />
        {#if wzSlab(p)}
          <path d={d.shadow(wzSlab(p))} class="fd3-shadow" />
        {/if}
        {#each ramps(p) as r}
          <path d={d.shadow(r)} class="fd3-shadow" />
        {/each}
      {/each}

      <!-- ramp slabs: walls then tops -->
      {#each plan as p, i}
        {#each ramps(p) as r}
          {#each d.walls(r) as w}
            <path d={w} class="fd3-wall" />
          {/each}
        {/each}
        {#each ramps(p) as r}
          <path
            d={d.polygon(r)}
            fill={topFill(i)}
            class="fd3-top"
            class:scored={losFor(i) != null}
            class:selected={selected === i}
            onpointerdown={(e) => pressTop(e, i)}
          />
        {/each}
      {/each}

      <!-- mainline deck: all walls first so interior seams hide under tops -->
      {#each plan as p}
        {#each d.walls(slab(p)) as w}
          <path d={w} class="fd3-wall" />
        {/each}
        {#if wzSlab(p)}
          {#each d.walls(wzSlab(p)) as w}
            <path d={w} class="fd3-wall" />
          {/each}
        {/if}
      {/each}
      {#each plan as p, i}
        <path
          d={d.polygon(slab(p))}
          fill={topFill(i)}
          class="fd3-top fd3-deck"
          class:scored={losFor(i) != null}
          class:selected={selected === i}
          onpointerdown={(e) => pressTop(e, i)}
        />
        {#each Array.from({ length: p.open - 1 }) as _, li}
          <path
            d={d.seg([p.x0, maxLanes * LW - LW * (li + 1)], [p.x1, maxLanes * LW - LW * (li + 1)])}
            class="fd3-lane-line"
          />
        {/each}
        {#if wzSlab(p)}
          {@const wz = wzSlab(p)}
          {@const wc = tf((p.x0 + p.x1) / 2, maxLanes * LW - (p.open + p.closed / 2) * LW)}
          <path d={d.polygon(wz)} class="fd3-wz" />
          <path d={d.polygon(wz)} class="fd3-wz-hatch" fill="url(#{p.soft ? 'fd3WzSoft' : 'fd3WzHard'})" />
          <text x={wc.x} y={wc.y + 2.5} class="fd3-wz-label" text-anchor="middle">WZ</text>
        {/if}
        {#if losFor(i)}
          {@const c = tf((p.x0 + p.x1) / 2, maxLanes * LW - (p.open * LW) / 2)}
          <text x={c.x} y={c.y + 3} class="fd3-los" text-anchor="middle">{losFor(i)}</text>
        {/if}
        {@const n = tf((p.x0 + p.x1) / 2, maxLanes * LW + 6)}
        <text x={n.x} y={n.y} class="fd3-num" text-anchor="middle">{p.num}</text>
      {/each}

      <!-- travel direction arrow off the downstream end -->
      {#if plan.length}
        {@const last = plan.at(-1)}
        {@const a0 = tf(last.x1 + 6, maxLanes * LW - (last.open * LW) / 2)}
        {@const a1 = tf(last.x1 + 20, maxLanes * LW - (last.open * LW) / 2)}
        <line x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} class="fd3-arrow" marker-end="url(#fd3ArrowHead)" />
        <defs>
          <marker id="fd3ArrowHead" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" class="fd3-arrow-head" />
          </marker>
        </defs>
      {/if}
    {/snippet}
  </Camera3DSvg>

  {#if periods > 0}
    <div class="fd3-periods" role="group" aria-label="Analysis period">
      {#each Array.from({ length: periods }) as _, p}
        <button type="button" class="fd3-chip" class:active={period === p} onclick={() => (period = p)}>P{p + 1}</button
        >
      {/each}
    </div>
  {/if}
</div>

<style>
  .fd3-shadow {
    fill: var(--text);
    opacity: 0.08;
  }
  .fd3-wall {
    fill: var(--diag-wall, #94a3b8);
    stroke: var(--diag-edge);
    stroke-width: 0.5;
  }
  .fd3-top {
    stroke: var(--diag-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    transition: fill 150ms ease;
  }
  .fd3-top.scored {
    stroke: rgba(15, 23, 42, 0.4);
  }
  .fd3-top.selected {
    stroke: var(--accent);
    stroke-width: 2.5;
  }
  .fd3-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1;
    stroke-dasharray: 5 4;
    fill: none;
    vector-effect: non-scaling-stroke;
    opacity: 0.8;
  }
  /* Closure deck, on the warning tokens rather than the LOS colours. */
  .fd3-wz {
    fill: var(--warn-bg);
    stroke: var(--diag-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .fd3-wz-hatch {
    stroke: none;
  }
  .fd3-wz-stripe {
    stroke: var(--warn-text);
    stroke-width: 1.4;
    opacity: 0.85;
  }
  .fd3-wz-stripe.soft {
    stroke-dasharray: 2 2.2;
  }
  .fd3-wz-label {
    font-size: 6.5px;
    font-weight: 700;
    fill: var(--warn-text);
    paint-order: stroke;
    stroke: var(--warn-bg);
    stroke-width: 2px;
  }
  /* Labels and markings must not swallow slab taps. */
  .fd3-los,
  .fd3-num,
  .fd3-lane-line,
  .fd3-arrow,
  .fd3-wz-hatch,
  .fd3-wz-label {
    pointer-events: none;
  }
  .fd3-los {
    font-size: 9px;
    fill: #fff;
    font-weight: 700;
    paint-order: stroke;
    stroke: rgba(15, 23, 42, 0.45);
    stroke-width: 2px;
  }
  .fd3-num {
    font-size: 7.5px;
    fill: var(--text-muted);
    font-weight: 600;
  }
  .fd3-arrow {
    stroke: var(--diag-dim);
    stroke-width: 2;
  }
  .fd3-arrow-head {
    fill: var(--diag-dim);
  }

  .fd3-periods {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 0.3rem;
  }
  .fd3-chip {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.12rem 0.5rem;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .fd3-chip.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
</style>
