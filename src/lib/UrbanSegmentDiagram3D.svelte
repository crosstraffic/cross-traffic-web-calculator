<script>
  // Rotatable 3D view of the urban street segment, built on the shared
  // Camera3DSvg shell and proj3d helpers. Same scene as the plan view: the
  // street ribbon between two cross-street boundary intersections, with the
  // access-point driveways extruded off each curb. After a run the subject
  // travel lanes carry the segment LOS colour.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers } from '$lib/proj3d.js';
  import { LOS_COLORS } from './los.js';

  let {
    nThroughLanes = 2,
    accessSubject = 4,
    accessOpposing = 4,
    control = 'signalized',
    los = null
  } = $props();

  const VIEW_W = 520, VIEW_H = 340, PAD = 22, THICK = 7;
  const XL = 17;        // half the drawn street length
  const XC = 11.5;      // boundary intersection centers
  const CH = 2.2;       // cross-street half width
  const CROSS_OUT = 5;  // how far the cross-street stubs run past the curb
  const DW = 2.4;       // driveway stub length
  const LANE = 1;

  let nLanes = $derived(Math.max(1, Math.min(4, Number(nThroughLanes) || 1)));
  let half = $derived(nLanes * LANE);
  let nSub = $derived(Math.max(0, Math.round(Number(accessSubject) || 0)));
  let nOpp = $derived(Math.max(0, Math.round(Number(accessOpposing) || 0)));

  // Plan coordinates are x east / y north. The subject direction of travel is
  // the southern half (negative y), matching the plan view.
  let model = $derived((() => {
    const yS = -half, yN = half;
    const yCS = -(half + CROSS_OUT), yCN = half + CROSS_OUT;

    const outline = [
      [-XL, yS], [-XC - CH, yS], [-XC - CH, yCS], [-XC + CH, yCS], [-XC + CH, yS],
      [XC - CH, yS], [XC - CH, yCS], [XC + CH, yCS], [XC + CH, yS],
      [XL, yS], [XL, yN],
      [XC + CH, yN], [XC + CH, yCN], [XC - CH, yCN], [XC - CH, yN],
      [-XC + CH, yN], [-XC + CH, yCN], [-XC - CH, yCN], [-XC - CH, yN],
      [-XL, yN]
    ];

    const spans = [[-XL, -XC - CH], [-XC + CH, XC - CH], [XC + CH, XL]];
    const centers = spans.map(([a, b]) => [[a, 0], [b, 0]]);
    const laneLines = [];
    for (const [a, b] of spans) {
      for (let i = 1; i < nLanes; i++) {
        laneLines.push([[a, -i * LANE], [b, -i * LANE]]);
        laneLines.push([[a, i * LANE], [b, i * LANE]]);
      }
    }
    // Cross-street centerlines, clear of the arterial.
    for (const xc of [-XC, XC]) {
      laneLines.push([[xc, yS], [xc, yCS]], [[xc, yN], [xc, yCN]]);
    }

    const linkA = -XC + CH, linkB = XC - CH;
    const drives = [];
    for (let k = 0; k < nSub; k++) {
      const dx = linkA + ((linkB - linkA) * (k + 1)) / (nSub + 1);
      drives.push([[dx - 0.45, yS], [dx + 0.45, yS], [dx + 0.45, yS - DW], [dx - 0.45, yS - DW]]);
    }
    for (let k = 0; k < nOpp; k++) {
      const dx = linkA + ((linkB - linkA) * (k + 1)) / (nOpp + 1);
      drives.push([[dx - 0.45, yN], [dx + 0.45, yN], [dx + 0.45, yN + DW], [dx - 0.45, yN + DW]]);
    }

    const subjectDeck = [[-XL, yS], [XL, yS], [XL, 0], [-XL, 0]];
    const stopBars = control === 'uncontrolled' ? [] : [
      [[XC - CH - 0.25, yS], [XC - CH - 0.25, 0]],
      [[-XC + CH + 0.25, 0], [-XC + CH + 0.25, yN]]
    ];

    return { outline, centers, laneLines, drives, subjectDeck, stopBars };
  })());

  let losFill = $derived(los ? LOS_COLORS[los] : null);
  let ariaLabel = $derived(`urban street segment, 3D view${los ? `, segment LOS ${los}` : ''}`);
</script>

<div class="us-diagram-3d">
  <Camera3DSvg viewW={VIEW_W} viewH={VIEW_H} defYaw={22} defPitch={44} {ariaLabel}>
    {#snippet children({ yaw, pitch, zoom, panX, panY })}
      {@const project = planProjector(yaw, pitch)}
      {@const tf = fitTransform(project, model.outline, VIEW_W, VIEW_H, PAD, zoom, panX, panY, THICK)}
      {@const d = makeDrawers(tf, THICK)}

      <path d={d.shadow(model.outline)} class="us3-shadow" />
      {#each model.drives as dv}
        {#each d.walls(dv) as w}
          <path d={w} class="us3-wall" />
        {/each}
        <path d={d.polygon(dv)} class="us3-drive" />
      {/each}
      {#each d.walls(model.outline) as w}
        <path d={w} class="us3-wall" />
      {/each}
      <path d={d.polygon(model.outline)} class="us3-top" />

      {#if losFill}
        <path d={d.polygon(model.subjectDeck)} fill={losFill} class="us3-los" />
      {/if}

      {#each model.centers as c}
        <path d={d.polyline(c)} class="us3-center" />
      {/each}
      {#each model.laneLines as l}
        <path d={d.polyline(l)} class="us3-lane-line" />
      {/each}
      {#each model.stopBars as s}
        <path d={d.polyline(s)} class="us3-stop" />
      {/each}
    {/snippet}
  </Camera3DSvg>

  {#if los}
    <div class="us3-legend">
      <span class="us3-chip"><span class="swatch" style="background: {losFill}"></span>Subject direction, LOS {los}</span>
    </div>
  {/if}
</div>

<style>
  .us3-shadow { fill: var(--text); opacity: 0.08; }
  .us3-wall { fill: var(--diag-wall); stroke: var(--diag-wall-edge); stroke-width: 0.5; }
  .us3-top { fill: var(--diag-pavement); stroke: var(--diag-edge); stroke-width: 1.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .us3-drive { fill: var(--diag-pavement-alt); stroke: var(--diag-edge); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .us3-los { opacity: 0.42; }
  .us3-center { stroke: var(--diag-center); stroke-width: 1.5; fill: none; vector-effect: non-scaling-stroke; }
  .us3-lane-line { stroke: var(--diag-lane-line); stroke-width: 1.25; stroke-dasharray: 7 5; fill: none; vector-effect: non-scaling-stroke; }
  .us3-stop { stroke: var(--diag-lane-line); stroke-width: 3; fill: none; vector-effect: non-scaling-stroke; }

  .us3-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.35rem; }
  .us3-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
  }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
</style>
