<script>
  // 3D ribbon view of the urban street facility: one extruded slab per segment
  // in a continuous deck, cross-street slabs at each boundary intersection, and
  // slab tops coloured by segment LOS after a run. Same scene and the same
  // selection contract as UrbanFacilityDiagram, on the shared Camera3DSvg shell.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers } from '$lib/proj3d.js';
  import { LOS_COLORS } from './los.js';

  let { segments = [], selected = -1, onselect = null } = $props();

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

  const VIEW_W = 560;
  const VIEW_H = 330;
  // The 3D plan compresses segment lengths and widens lanes relative to the 2D
  // strip, otherwise a mile of arterial projects as a thin stick.
  const LW = 13;         // plan lane width
  const CWP = 15;        // cross-street width
  const CROSS_OUT = 17;  // how far the cross streets run past the deck
  const THICK = 9;

  let lanesOf = (s) => Math.max(1, Math.min(6, Math.round(Number(s.lanes) || 2)));

  let plan = $derived.by(() => {
    let x = 0;
    const segs = [];
    const crosses = [x];
    for (const s of segments) {
      x += CWP;
      const len = Math.max(200, Number(s.length_ft) || 1000);
      const w = Math.max(34, Math.min(110, 20 + len / 26));
      segs.push({ x0: x, x1: x + w, lanes: lanesOf(s), los: s.los || null });
      x += w;
      crosses.push(x);
    }
    return { segs, crosses };
  });

  let maxLanes = $derived(Math.max(2, ...plan.segs.map((p) => p.lanes)));

  // Decks share their top edge at y = maxLanes * LW and grow toward the far
  // side, so segments of unequal lane count line up on one curb.
  function slab(p) {
    const yTop = maxLanes * LW;
    const yBot = yTop - p.lanes * LW;
    return [[p.x0, yBot], [p.x1, yBot], [p.x1, yTop], [p.x0, yTop]];
  }

  function crossSlab(x0) {
    const yTop = maxLanes * LW + CROSS_OUT;
    const yBot = -CROSS_OUT;
    return [[x0, yBot], [x0 + CWP, yBot], [x0 + CWP, yTop], [x0, yTop]];
  }

  function topFill(p) {
    return p.los ? LOS_COLORS[p.los] : 'var(--diag-pavement)';
  }

  let planPts = $derived.by(() => {
    const pts = [];
    for (const p of plan.segs) pts.push(...slab(p));
    for (const c of plan.crosses) pts.push(...crossSlab(c));
    return pts.length ? pts : [[0, 0], [1, 1]];
  });

  let anyLos = $derived(plan.segs.some((p) => p.los));
  let ariaLabel = $derived(
    `urban street facility 3D view, ${plan.segs.length} segment${plan.segs.length === 1 ? '' : 's'}` +
    (anyLos ? ', coloured by segment level of service' : '')
  );
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="uf3-wrap" onpointerup={release} onpointercancel={() => (pendingTap = null)}>
  <Camera3DSvg viewW={VIEW_W} viewH={VIEW_H} defYaw={20} defPitch={44} {ariaLabel}>
    {#snippet children({ yaw, pitch, zoom, panX, panY })}
      {@const project = planProjector(yaw, pitch)}
      {@const tf = fitTransform(project, planPts, VIEW_W, VIEW_H, 26, zoom, panX, panY, THICK)}
      {@const d = makeDrawers(tf, THICK)}

      <!-- shadows first -->
      {#each plan.crosses as c}
        <path d={d.shadow(crossSlab(c))} class="uf3-shadow" />
      {/each}
      {#each plan.segs as p}
        <path d={d.shadow(slab(p))} class="uf3-shadow" />
      {/each}

      <!-- cross streets: walls then tops -->
      {#each plan.crosses as c}
        {#each d.walls(crossSlab(c)) as w}
          <path d={w} class="uf3-wall" />
        {/each}
      {/each}
      {#each plan.crosses as c}
        <path d={d.polygon(crossSlab(c))} class="uf3-cross" />
      {/each}

      <!-- segment decks: all walls first so interior seams hide under the tops -->
      {#each plan.segs as p}
        {#each d.walls(slab(p)) as w}
          <path d={w} class="uf3-wall" />
        {/each}
      {/each}
      {#each plan.segs as p, i}
        <path d={d.polygon(slab(p))} fill={topFill(p)} class="uf3-top" class:scored={p.los != null}
              class:selected={selected === i} onpointerdown={(e) => pressTop(e, i)} />
        {#each Array.from({ length: p.lanes - 1 }) as _, li}
          <path d={d.seg([p.x0, maxLanes * LW - LW * (li + 1)], [p.x1, maxLanes * LW - LW * (li + 1)])} class="uf3-lane-line" />
        {/each}
        {#if p.los}
          {@const c = tf((p.x0 + p.x1) / 2, maxLanes * LW - (p.lanes * LW) / 2)}
          <text x={c.x} y={c.y + 3} class="uf3-los" text-anchor="middle">{p.los}</text>
        {/if}
        {@const n = tf((p.x0 + p.x1) / 2, maxLanes * LW + 8)}
        <text x={n.x} y={n.y} class="uf3-num" text-anchor="middle">{i + 1}</text>
      {/each}
    {/snippet}
  </Camera3DSvg>
</div>

<style>
  .uf3-shadow { fill: var(--text); opacity: 0.08; }
  .uf3-wall { fill: var(--diag-wall, #94a3b8); stroke: var(--diag-edge); stroke-width: 0.5; }
  .uf3-cross { fill: var(--diag-pavement-alt); stroke: var(--diag-edge); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .uf3-top { stroke: var(--diag-edge); stroke-width: 1; vector-effect: non-scaling-stroke; transition: fill 150ms ease; }
  .uf3-top.scored { stroke: rgba(15, 23, 42, 0.4); }
  .uf3-top.selected { stroke: var(--accent); stroke-width: 2.5; }
  .uf3-lane-line { stroke: var(--diag-lane-line); stroke-width: 1; stroke-dasharray: 5 4; fill: none; vector-effect: non-scaling-stroke; opacity: 0.8; }
  /* Labels and markings must not swallow slab taps. */
  .uf3-los, .uf3-num, .uf3-lane-line { pointer-events: none; }
  .uf3-los { font-size: 10px; fill: #fff; font-weight: 700; paint-order: stroke; stroke: rgba(15, 23, 42, 0.45); stroke-width: 2px; }
  .uf3-num { font-size: 7.5px; fill: var(--text-muted); font-weight: 600; }
</style>
