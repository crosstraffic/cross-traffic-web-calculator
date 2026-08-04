<script>
  // 3D ribbon view of the freeway facility: one extruded slab per segment in
  // a continuous deck, ramp wedges dropping off the right side of travel, and
  // slab tops colored by the segment's LOS for the selected analysis period.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers } from '$lib/proj3d.js';

  let { segments = [], losMatrix = null } = $props();

  let period = $state(0);
  let periods = $derived(losMatrix && losMatrix[0] ? losMatrix[0].length : 0);
  $effect(() => {
    if (period >= periods) period = 0;
  });

  const VIEW_W = 560;
  const VIEW_H = 330;
  // The 3D plan compresses segment lengths and widens lanes relative to the
  // 2D strip, otherwise a several-mile facility projects as a thin stick.
  const LW = 14;        // plan lane width
  const RAMP_D = 24;    // how far ramps drop below the deck edge
  const THICK = 10;

  const LOS_COLOR = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444', F: '#b91c1c' };

  let plan = $derived.by(() => {
    let x = 0;
    return (segments || []).map((s) => {
      const len = Math.max(200, Number(s.length_ft) || 1000);
      const w = Math.max(30, Math.min(86, 16 + len / 85));
      const lanes = Math.max(1, Math.min(8, Number(s.lanes) || 3));
      const item = { x0: x, x1: x + w, lanes, type: s.seg_type, num: s.seg_num };
      x += w;
      return item;
    });
  });

  let maxLanes = $derived(Math.max(3, ...plan.map((p) => p.lanes)));

  function losFor(i) {
    return losMatrix && losMatrix[i] ? losMatrix[i][period] : null;
  }
  function topFill(i) {
    const los = losFor(i);
    return los ? LOS_COLOR[los] : 'var(--diag-pavement)';
  }

  // Mainline occupies y in [0, lanes*LW] with the shared top edge at
  // y = maxLanes*LW so segments of different lane counts align on the median
  // side and grow toward the ramp side, matching the 2D strip.
  function slab(p) {
    const yTop = maxLanes * LW;
    const yBot = yTop - p.lanes * LW;
    return [
      [p.x0, yBot],
      [p.x1, yBot],
      [p.x1, yTop],
      [p.x0, yTop],
    ];
  }

  function ramps(p) {
    const yTop = maxLanes * LW;
    const yBot = yTop - p.lanes * LW;
    const w = p.x1 - p.x0;
    const out = [];
    if (p.type === 'Merge') {
      out.push([[p.x0 - 14, yBot - RAMP_D], [p.x0 + w * 0.45, yBot], [p.x0 + 4, yBot]]);
    } else if (p.type === 'Diverge') {
      out.push([[p.x1 - 4, yBot], [p.x1 + 14, yBot - RAMP_D], [p.x1 - w * 0.45, yBot]]);
    } else if (p.type === 'Weaving') {
      out.push([[p.x0, yBot - LW * 0.8], [p.x1, yBot - LW * 0.8], [p.x1, yBot], [p.x0, yBot]]);
      out.push([[p.x0 - 14, yBot - RAMP_D], [p.x0, yBot], [p.x0, yBot - LW * 0.8]]);
      out.push([[p.x1, yBot - LW * 0.8], [p.x1, yBot], [p.x1 + 14, yBot - RAMP_D]]);
    } else if (p.type === 'OverlappingRamp') {
      out.push([[p.x0 - 12, yBot - RAMP_D], [p.x0 + w * 0.4, yBot], [p.x0 + 2, yBot]]);
      out.push([[p.x1 - 2, yBot], [p.x1 + 12, yBot - RAMP_D], [p.x1 - w * 0.4, yBot]]);
    }
    return out;
  }

  let planPts = $derived.by(() => {
    const pts = [];
    for (const p of plan) {
      pts.push(...slab(p));
      for (const r of ramps(p)) pts.push(...r);
    }
    return pts.length ? pts : [[0, 0], [1, 1]];
  });
</script>

<div class="fd3-wrap">
  <Camera3DSvg viewW={VIEW_W} viewH={VIEW_H} defYaw={18} defPitch={44}
               ariaLabel="freeway facility 3D view, {segments.length} segments">
    {#snippet children({ yaw, pitch, zoom, panX, panY })}
      {@const project = planProjector(yaw, pitch)}
      {@const tf = fitTransform(project, planPts, VIEW_W, VIEW_H, 26, zoom, panX, panY, THICK)}
      {@const d = makeDrawers(tf, THICK)}

      <!-- shadows first -->
      {#each plan as p}
        <path d={d.shadow(slab(p))} class="fd3-shadow" />
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
          <path d={d.polygon(r)} fill={topFill(i)} class="fd3-top" class:scored={losFor(i) != null} />
        {/each}
      {/each}

      <!-- mainline deck: all walls first so interior seams hide under tops -->
      {#each plan as p}
        {#each d.walls(slab(p)) as w}
          <path d={w} class="fd3-wall" />
        {/each}
      {/each}
      {#each plan as p, i}
        <path d={d.polygon(slab(p))} fill={topFill(i)} class="fd3-top" class:scored={losFor(i) != null} />
        {#each Array.from({ length: p.lanes - 1 }) as _, li}
          <path d={d.seg([p.x0, maxLanes * LW - LW * (li + 1)], [p.x1, maxLanes * LW - LW * (li + 1)])} class="fd3-lane-line" />
        {/each}
        {#if losFor(i)}
          {@const c = tf((p.x0 + p.x1) / 2, maxLanes * LW - (p.lanes * LW) / 2)}
          <text x={c.x} y={c.y + 3} class="fd3-los" text-anchor="middle">{losFor(i)}</text>
        {/if}
        {@const n = tf((p.x0 + p.x1) / 2, maxLanes * LW + 6)}
        <text x={n.x} y={n.y} class="fd3-num" text-anchor="middle">{p.num}</text>
      {/each}

      <!-- travel direction arrow off the downstream end -->
      {#if plan.length}
        {@const last = plan.at(-1)}
        {@const a0 = tf(last.x1 + 6, maxLanes * LW - (last.lanes * LW) / 2)}
        {@const a1 = tf(last.x1 + 20, maxLanes * LW - (last.lanes * LW) / 2)}
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
        <button type="button" class="fd3-chip" class:active={period === p} onclick={() => (period = p)}>P{p + 1}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .fd3-shadow { fill: var(--text); opacity: 0.08; }
  .fd3-wall { fill: var(--diag-wall, #94a3b8); stroke: var(--diag-edge); stroke-width: 0.5; }
  .fd3-top { stroke: var(--diag-edge); stroke-width: 1; vector-effect: non-scaling-stroke; transition: fill 150ms ease; }
  .fd3-top.scored { stroke: rgba(15, 23, 42, 0.4); }
  .fd3-lane-line { stroke: var(--diag-lane-line); stroke-width: 1; stroke-dasharray: 5 4; fill: none; vector-effect: non-scaling-stroke; opacity: 0.8; }
  .fd3-los { font-size: 9px; fill: #fff; font-weight: 700; paint-order: stroke; stroke: rgba(15, 23, 42, 0.45); stroke-width: 2px; }
  .fd3-num { font-size: 7.5px; fill: var(--text-muted); font-weight: 600; }
  .fd3-arrow { stroke: var(--diag-dim); stroke-width: 2; }
  .fd3-arrow-head { fill: var(--diag-dim); }

  .fd3-periods { display: flex; gap: 0.25rem; flex-wrap: wrap; justify-content: center; margin-top: 0.3rem; }
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
  .fd3-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>
