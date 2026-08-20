<script>
  // Rotatable 3D view of the AWSC intersection: the slab outline follows the
  // present legs (an approach with zero lanes removes its leg), stop bars on
  // every present approach, movement paths solid in the approach colors.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers, qSample } from '$lib/proj3d.js';

  let { approaches = {} } = $props();

  let hovered = $state(null);

  const VIEW_W = 520,
    VIEW_H = 320,
    PAD = 24,
    THICK = 9;
  const LANE = 1,
    RUN = 5.2;

  function build(nEB, nWB, nNB, nSB) {
    const legW = nEB > 0,
      legE = nWB > 0,
      legS = nNB > 0,
      legN = nSB > 0;
    const hEB = Math.max(1, nEB) * LANE,
      hWB = Math.max(1, nWB) * LANE;
    const hNB = Math.max(1, nNB) * LANE,
      hSB = Math.max(1, nSB) * LANE;
    const XW = -(hSB + RUN),
      XE = hNB + RUN,
      YS = -(hEB + RUN),
      YN = hWB + RUN;

    // Outline counterclockwise; absent legs flatten into a straight edge.
    const pts = [];
    pts.push([legW ? XW : -hSB, -hEB]);
    if (legS) pts.push([-hSB, -hEB], [-hSB, YS], [hNB, YS], [hNB, -hEB]);
    pts.push([legE ? XE : hNB, -hEB]);
    pts.push([legE ? XE : hNB, hWB]);
    if (legN) pts.push([hNB, hWB], [hNB, YN], [-hSB, YN], [-hSB, hWB]);
    pts.push([legW ? XW : -hSB, hWB]);

    const centers = [];
    if (legW)
      centers.push([
        [XW, 0],
        [-hSB, 0],
      ]);
    if (legE)
      centers.push([
        [hNB, 0],
        [XE, 0],
      ]);
    if (legS)
      centers.push([
        [0, YS],
        [0, -hEB],
      ]);
    if (legN)
      centers.push([
        [0, hWB],
        [0, YN],
      ]);

    const laneLines = [];
    for (let i = 1; i < nEB; i++)
      laneLines.push([
        [XW, -i],
        [-hSB, -i],
      ]);
    for (let i = 1; i < nWB; i++)
      laneLines.push([
        [hNB, i],
        [XE, i],
      ]);
    for (let i = 1; i < nNB; i++)
      laneLines.push([
        [i, YS],
        [i, -hEB],
      ]);
    for (let i = 1; i < nSB; i++)
      laneLines.push([
        [-i, hWB],
        [-i, YN],
      ]);

    const stops = [];
    if (legW)
      stops.push([
        [-hSB - 0.12, 0],
        [-hSB - 0.12, -hEB],
      ]);
    if (legE)
      stops.push([
        [hNB + 0.12, hWB],
        [hNB + 0.12, 0],
      ]);
    if (legS)
      stops.push([
        [0, -hEB - 0.12],
        [hNB, -hEB - 0.12],
      ]);
    if (legN)
      stops.push([
        [-hSB, hWB + 0.12],
        [0, hWB + 0.12],
      ]);

    const xNB = (i) => (i + 0.5) * LANE,
      xSB = (i) => -(i + 0.5) * LANE;
    const yEB = (i) => -(i + 0.5) * LANE,
      yWB = (i) => (i + 0.5) * LANE;
    const mid = (n) => Math.floor((Math.max(1, n) - 1) / 2);
    const moves = {
      EB: !legW
        ? {}
        : {
            L: legN
              ? [
                  [XW, yEB(0)],
                  [-hSB, yEB(0)],
                  ...qSample([-hSB, yEB(0)], [LANE / 2, yEB(0)], [LANE / 2, hWB]),
                  [LANE / 2, YN],
                ]
              : null,
            T: legE
              ? [
                  [XW, yEB(mid(nEB))],
                  [XE, yEB(mid(nEB))],
                ]
              : null,
            R: legS
              ? [
                  [XW, yEB(nEB - 1)],
                  [-hSB, yEB(nEB - 1)],
                  ...qSample([-hSB, yEB(nEB - 1)], [-hSB + LANE / 2, yEB(nEB - 1)], [-hSB + LANE / 2, -hEB]),
                  [-hSB + LANE / 2, YS],
                ]
              : null,
          },
      WB: !legE
        ? {}
        : {
            L: legS
              ? [
                  [XE, yWB(0)],
                  [hNB, yWB(0)],
                  ...qSample([hNB, yWB(0)], [-LANE / 2, yWB(0)], [-LANE / 2, -hEB]),
                  [-LANE / 2, YS],
                ]
              : null,
            T: legW
              ? [
                  [XE, yWB(mid(nWB))],
                  [XW, yWB(mid(nWB))],
                ]
              : null,
            R: legN
              ? [
                  [XE, yWB(nWB - 1)],
                  [hNB, yWB(nWB - 1)],
                  ...qSample([hNB, yWB(nWB - 1)], [hNB - LANE / 2, yWB(nWB - 1)], [hNB - LANE / 2, hWB]),
                  [hNB - LANE / 2, YN],
                ]
              : null,
          },
      NB: !legS
        ? {}
        : {
            L: legW
              ? [
                  [xNB(0), YS],
                  [xNB(0), -hEB],
                  ...qSample([xNB(0), -hEB], [xNB(0), LANE / 2], [-hSB, LANE / 2]),
                  [XW, LANE / 2],
                ]
              : null,
            T: legN
              ? [
                  [xNB(mid(nNB)), YS],
                  [xNB(mid(nNB)), YN],
                ]
              : null,
            R: legE
              ? [
                  [xNB(nNB - 1), YS],
                  [xNB(nNB - 1), -hEB],
                  ...qSample([xNB(nNB - 1), -hEB], [xNB(nNB - 1), -hEB + LANE / 2], [hNB, -hEB + LANE / 2]),
                  [XE, -hEB + LANE / 2],
                ]
              : null,
          },
      SB: !legN
        ? {}
        : {
            L: legE
              ? [
                  [xSB(0), YN],
                  [xSB(0), hWB],
                  ...qSample([xSB(0), hWB], [xSB(0), -LANE / 2], [hNB, -LANE / 2]),
                  [XE, -LANE / 2],
                ]
              : null,
            T: legS
              ? [
                  [xSB(mid(nSB)), YN],
                  [xSB(mid(nSB)), YS],
                ]
              : null,
            R: legW
              ? [
                  [xSB(nSB - 1), YN],
                  [xSB(nSB - 1), hWB],
                  ...qSample([xSB(nSB - 1), hWB], [xSB(nSB - 1), hWB - LANE / 2], [-hSB, hWB - LANE / 2]),
                  [XW, hWB - LANE / 2],
                ]
              : null,
          },
    };

    const present = { EB: legW, WB: legE, NB: legS, SB: legN };
    return { outline: pts, centers, laneLines, stops, moves, present };
  }

  function cls(h, key) {
    if (h == null) return 'aw3-move';
    return h === key ? 'aw3-move active' : 'aw3-move dim';
  }
  let nEB = $derived(Math.max(0, Number(approaches?.eb?.laneCount) || 0));
  let nWB = $derived(Math.max(0, Number(approaches?.wb?.laneCount) || 0));
  let nNB = $derived(Math.max(0, Number(approaches?.nb?.laneCount) || 0));
  let nSB = $derived(Math.max(0, Number(approaches?.sb?.laneCount) || 0));
  let model = $derived(build(nEB, nWB, nNB, nSB));
  let order = $derived(
    [
      { key: 'EB', label: 'Eastbound' },
      { key: 'WB', label: 'Westbound' },
      { key: 'NB', label: 'Northbound' },
      { key: 'SB', label: 'Southbound' },
    ].filter((o) => model.present[o.key]),
  );
</script>

<div class="awsc-diagram-3d">
  <Camera3DSvg
    viewW={VIEW_W}
    viewH={VIEW_H}
    defYaw={24}
    defPitch={42}
    ariaLabel={`${order.length}-leg all-way stop-controlled intersection, 3D view`}
  >
    {#snippet children({ yaw, pitch, zoom, panX, panY })}
      {@const project = planProjector(yaw, pitch)}
      {@const tf = fitTransform(project, model.outline, VIEW_W, VIEW_H, PAD, zoom, panX, panY, THICK)}
      {@const d = makeDrawers(tf, THICK)}

      <path d={d.shadow(model.outline)} class="aw3-shadow" />
      {#each d.walls(model.outline) as w}
        <path d={w} class="aw3-wall" />
      {/each}
      <path d={d.polygon(model.outline)} class="aw3-top" />

      {#each model.centers as c}
        <path d={d.polyline(c)} class="aw3-center" />
      {/each}
      {#each model.laneLines as l}
        <path d={d.polyline(l)} class="aw3-lane-line" />
      {/each}
      {#each model.stops as s}
        <path d={d.polyline(s)} class="aw3-stop" />
      {/each}

      {#each order as o}
        {#each ['T', 'L', 'R'] as mv}
          {#if model.moves[o.key][mv]}
            <path d={d.polyline(model.moves[o.key][mv])} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`} />
          {/if}
        {/each}
      {/each}
    {/snippet}
  </Camera3DSvg>

  <div class="aw3-legend" role="list">
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="aw3-chip {o.key.toLowerCase()}"
        class:active={hovered === o.key}
        onmouseenter={() => (hovered = o.key)}
        onmouseleave={() => (hovered = null)}
        onfocus={() => (hovered = o.key)}
        onblur={() => (hovered = null)}
      >
        <span class="swatch {o.key.toLowerCase()}"></span>
        {o.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .aw3-shadow {
    fill: #0f172a;
    opacity: 0.08;
  }
  .aw3-wall {
    fill: var(--diag-wall);
    stroke: var(--diag-wall-edge);
    stroke-width: 0.5;
  }
  .aw3-top {
    fill: var(--diag-pavement);
    stroke: var(--diag-edge);
    stroke-width: 1.5;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .aw3-center {
    stroke: var(--diag-center);
    stroke-width: 1.25;
    fill: none;
    vector-effect: non-scaling-stroke;
  }
  .aw3-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1.25;
    stroke-dasharray: 7 5;
    fill: none;
    vector-effect: non-scaling-stroke;
  }
  .aw3-stop {
    stroke: var(--diag-lane-line);
    stroke-width: 3;
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .aw3-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition:
      opacity 120ms ease,
      stroke-width 120ms ease;
    opacity: 0.75;
  }
  .aw3-move.dim {
    opacity: 0.1;
  }
  .aw3-move.active {
    stroke-width: 4;
    opacity: 1;
  }
  .mv-eb {
    stroke: #ea7317;
  }
  .mv-wb {
    stroke: #dc2626;
  }
  .mv-nb {
    stroke: #2563eb;
  }
  .mv-sb {
    stroke: #16a34a;
  }
  .swatch.eb {
    background: #ea7317;
  }
  .swatch.wb {
    background: #dc2626;
  }
  .swatch.nb {
    background: #2563eb;
  }
  .swatch.sb {
    background: #16a34a;
  }

  .aw3-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.35rem;
  }
  .aw3-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: transparent;
    cursor: default;
  }
  .aw3-chip.active {
    border-color: var(--diag-edge);
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
</style>
