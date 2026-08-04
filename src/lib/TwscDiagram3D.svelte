<script>
  // Rotatable 3D view of the TWSC intersection: T or cross slab per the leg
  // configuration, stop bars on the minor approaches only, movement paths in
  // the approach colors with the HCM rank carried in the dash pattern.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers, qSample } from '$lib/proj3d.js';

  /**
   * @typedef {Object} Props
   * @property {boolean} [threeLeg]
   * @property {number} [majorLanes]
   * @property {string} [rtEB]
   * @property {string} [rtWB]
   * @property {string} [minorNB]
   * @property {string} [minorSB]
   */

  /** @type {Props} */
  let {
    threeLeg = false,
    majorLanes = 1,
    rtEB = 'shared',
    rtWB = 'shared',
    minorNB = 'single_shared',
    minorSB = 'single_shared'
  } = $props();

  let hovered = $state(null);

  const VIEW_W = 520, VIEW_H = 320, PAD = 24, THICK = 9;
  const LANE = 1, RUN = 5.2;

  const minorCount = (cfg) => ({ single_shared: 1, shared_lt_exclusive_r: 2, exclusive_l_shared_tr: 2, separate: 3 }[cfg] || 1);



  function build(threeLeg, nEB, nWB, nNB, nSB) {
    const wEB = nEB * LANE, wWB = nWB * LANE, wNB = nNB * LANE, wSB = nSB * LANE;
    const XW = -(wSB + RUN), XE = wNB + RUN, YS = -(wEB + RUN), YN = wWB + RUN;

    // Outline, counterclockwise from the west leg's south edge. Three-leg
    // omits the north leg, so the top edge runs straight across.
    const outline = threeLeg ? [
      [XW, -wEB], [-wSB, -wEB], [-wSB, YS], [wNB, YS], [wNB, -wEB], [XE, -wEB],
      [XE, wWB], [XW, wWB],
    ] : [
      [XW, -wEB], [-wSB, -wEB], [-wSB, YS], [wNB, YS], [wNB, -wEB], [XE, -wEB],
      [XE, wWB], [wNB, wWB], [wNB, YN], [-wSB, YN], [-wSB, wWB], [XW, wWB],
    ];

    const centers = [
      [[XW, 0], [-wSB, 0]], [[wNB, 0], [XE, 0]],
      [[0, YS], [0, -wEB]],
      ...(threeLeg ? [] : [[[0, wWB], [0, YN]]]),
    ];
    const laneLines = [];
    for (let i = 1; i < nEB; i++) laneLines.push([[XW, -i], [-wSB, -i]], [[wNB, -i], [XE, -i]]);
    for (let i = 1; i < nWB; i++) laneLines.push([[XW, i], [-wSB, i]], [[wNB, i], [XE, i]]);
    for (let i = 1; i < nNB; i++) laneLines.push([[i, YS], [i, -wEB]]);
    if (!threeLeg) for (let i = 1; i < nSB; i++) laneLines.push([[-i, YS], [-i, -wEB]], [[-i, wWB], [-i, YN]]);

    const stops = [
      [[0, -wEB - 0.12], [wNB, -wEB - 0.12]],
      ...(threeLeg ? [] : [[[-wSB, wWB + 0.12], [0, wWB + 0.12]]]),
    ];

    const xNB = (i) => (i + 0.5) * LANE, xSB = (i) => -(i + 0.5) * LANE;
    const yEB = (i) => -(i + 0.5) * LANE, yWB = (i) => (i + 0.5) * LANE;
    const mid = (n) => Math.floor((n - 1) / 2);
    const moves = {
      EB: {
        L: threeLeg ? null : [[XW, yEB(0)], [-wSB, yEB(0)], ...qSample([-wSB, yEB(0)], [LANE / 2, yEB(0)], [LANE / 2, wWB]), [LANE / 2, YN]],
        T: [[XW, yEB(mid(nEB))], [XE, yEB(mid(nEB))]],
        R: [[XW, yEB(nEB - 1)], [-wSB, yEB(nEB - 1)], ...qSample([-wSB, yEB(nEB - 1)], [-wSB + LANE / 2, yEB(nEB - 1)], [-wSB + LANE / 2, -wEB]), [-wSB + LANE / 2, YS]],
      },
      WB: {
        L: [[XE, yWB(0)], [wNB, yWB(0)], ...qSample([wNB, yWB(0)], [-LANE / 2, yWB(0)], [-LANE / 2, -wEB]), [-LANE / 2, YS]],
        T: [[XE, yWB(mid(nWB))], [XW, yWB(mid(nWB))]],
        R: threeLeg ? null : [[XE, yWB(nWB - 1)], [wNB, yWB(nWB - 1)], ...qSample([wNB, yWB(nWB - 1)], [wNB - LANE / 2, yWB(nWB - 1)], [wNB - LANE / 2, wWB]), [wNB - LANE / 2, YN]],
      },
      NB: {
        L: [[xNB(0), YS], [xNB(0), -wEB], ...qSample([xNB(0), -wEB], [xNB(0), LANE / 2], [-wSB, LANE / 2]), [XW, LANE / 2]],
        T: threeLeg ? null : [[xNB(mid(nNB)), YS], [xNB(mid(nNB)), YN]],
        R: [[xNB(nNB - 1), YS], [xNB(nNB - 1), -wEB], ...qSample([xNB(nNB - 1), -wEB], [xNB(nNB - 1), -wEB + LANE / 2], [wNB, -wEB + LANE / 2]), [XE, -wEB + LANE / 2]],
      },
      SB: threeLeg ? { L: null, T: null, R: null } : {
        L: [[xSB(0), YN], [xSB(0), wWB], ...qSample([xSB(0), wWB], [xSB(0), -LANE / 2], [wNB, -LANE / 2]), [XE, -LANE / 2]],
        T: [[xSB(mid(nSB)), YN], [xSB(mid(nSB)), YS]],
        R: [[xSB(nSB - 1), YN], [xSB(nSB - 1), wWB], ...qSample([xSB(nSB - 1), wWB], [xSB(nSB - 1), wWB - LANE / 2], [-wSB, wWB - LANE / 2]), [XW, wWB - LANE / 2]],
      },
    };

    return { outline, centers, laneLines, stops, moves };
  }

  const DASH = { 1: null, 2: '10 6', 3: '6 5', 4: '2 5' };


  function cls(h, key) {
    if (h == null) return 'tw3-move';
    return h === key ? 'tw3-move active' : 'tw3-move dim';
  }
  let nEB = $derived(Math.max(1, Number(majorLanes) || 1) + (rtEB !== 'shared' ? 1 : 0));
  let nWB = $derived(Math.max(1, Number(majorLanes) || 1) + (rtWB !== 'shared' ? 1 : 0));
  let nNB = $derived(minorCount(minorNB));
  let nSB = $derived(threeLeg ? 1 : minorCount(minorSB));
  let model = $derived(build(threeLeg, nEB, nWB, nNB, nSB));
  let rank = $derived({
    EB: { L: 2, T: 1, R: 1 },
    WB: { L: 2, T: 1, R: 1 },
    NB: { L: threeLeg ? 3 : 4, T: 3, R: 2 },
    SB: { L: 4, T: 3, R: 2 },
  });
  let order = $derived([
    { key: 'EB', label: 'Eastbound (major)' },
    { key: 'WB', label: 'Westbound (major)' },
    { key: 'NB', label: 'Northbound (minor)' },
    ...(threeLeg ? [] : [{ key: 'SB', label: 'Southbound (minor)' }]),
  ]);
</script>

<div class="twsc-diagram-3d">
  <Camera3DSvg viewW={VIEW_W} viewH={VIEW_H} defYaw={24} defPitch={42}
      ariaLabel={`${threeLeg ? 'three-leg' : 'four-leg'} two-way stop-controlled intersection, 3D view`}
          >
    {#snippet children({ yaw, pitch, zoom, panX, panY })}
        {@const project = planProjector(yaw, pitch)}
      {@const tf = fitTransform(project, model.outline, VIEW_W, VIEW_H, PAD, zoom, panX, panY, THICK)}
      {@const d = makeDrawers(tf, THICK)}

      <path d={d.shadow(model.outline)} class="tw3-shadow" />
      {#each d.walls(model.outline) as w}
        <path d={w} class="tw3-wall" />
      {/each}
      <path d={d.polygon(model.outline)} class="tw3-top" />

      {#each model.centers as c}
        <path d={d.polyline(c)} class="tw3-center" />
      {/each}
      {#each model.laneLines as l}
        <path d={d.polyline(l)} class="tw3-lane-line" />
      {/each}
      {#each model.stops as s}
        <path d={d.polyline(s)} class="tw3-stop" />
      {/each}

      {#each order as o}
        {#each ['T', 'L', 'R'] as mv}
          {#if model.moves[o.key][mv]}
            <path d={d.polyline(model.moves[o.key][mv])} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`}
                  stroke-dasharray={DASH[rank[o.key][mv]]} />
          {/if}
        {/each}
      {/each}
          {/snippet}
    </Camera3DSvg>

  <div class="tw3-legend" role="list">
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="tw3-chip {o.key.toLowerCase()}"
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
  .tw3-shadow { fill: #0f172a; opacity: 0.08; }
  .tw3-wall { fill: var(--diag-wall); stroke: var(--diag-wall-edge); stroke-width: 0.5; }
  .tw3-top { fill: var(--diag-pavement); stroke: var(--diag-edge); stroke-width: 1.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .tw3-center { stroke: var(--diag-center); stroke-width: 1.25; fill: none; vector-effect: non-scaling-stroke; }
  .tw3-lane-line { stroke: var(--diag-lane-line); stroke-width: 1.25; stroke-dasharray: 7 5; fill: none; vector-effect: non-scaling-stroke; }
  .tw3-stop { stroke: var(--diag-lane-line); stroke-width: 3; fill: none; vector-effect: non-scaling-stroke; }

  .tw3-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.75;
  }
  .tw3-move.dim { opacity: 0.1; }
  .tw3-move.active { stroke-width: 4; opacity: 1; }
  .mv-eb { stroke: #ea7317; }
  .mv-wb { stroke: #dc2626; }
  .mv-nb { stroke: #2563eb; }
  .mv-sb { stroke: #16a34a; }
  .swatch.eb { background: #ea7317; }
  .swatch.wb { background: #dc2626; }
  .swatch.nb { background: #2563eb; }
  .swatch.sb { background: #16a34a; }

  .tw3-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.35rem; }
  .tw3-chip {
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
  .tw3-chip.active { border-color: var(--diag-edge); }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
</style>
