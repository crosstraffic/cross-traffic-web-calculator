<script>
  // Rotatable 3D view of the four-leg signalized intersection, built on the
  // shared Camera3DSvg shell and proj3d helpers. Road half-widths follow the
  // per-approach lane inputs; the twelve movement paths draw in the approach
  // colors, lefts dashed while permitted.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers, qSample } from '$lib/proj3d.js';

  let { approaches = [] } = $props();

  let hovered = $state(null);

  const VIEW_W = 520,
    VIEW_H = 340,
    PAD = 24,
    THICK = 9;
  const LANE = 1,
    RUN = 5.2;

  const fallback = { ln_left: 1, ln_thru: 1, ln_right: 0, left_phase: 0 };

  function build(lNB, lSB, lEB, lWB, tNB, tSB, tEB, tWB) {
    const wNB = lNB * LANE,
      wSB = lSB * LANE,
      wEB = lEB * LANE,
      wWB = lWB * LANE;
    const XW = -(wSB + RUN),
      XE = wNB + RUN,
      YS = -(wEB + RUN),
      YN = wWB + RUN;

    // Cross outline, counterclockwise from the west leg's south edge.
    const cross = [
      [XW, -wEB],
      [-wSB, -wEB],
      [-wSB, YS],
      [wNB, YS],
      [wNB, -wEB],
      [XE, -wEB],
      [XE, wWB],
      [wNB, wWB],
      [wNB, YN],
      [-wSB, YN],
      [-wSB, wWB],
      [XW, wWB],
    ];

    const centers = [
      [
        [0, YS],
        [0, -wEB],
      ],
      [
        [0, wWB],
        [0, YN],
      ],
      [
        [XW, 0],
        [-wSB, 0],
      ],
      [
        [wNB, 0],
        [XE, 0],
      ],
    ];
    const laneLines = [];
    for (let i = 1; i < lNB; i++)
      laneLines.push(
        [
          [i, YS],
          [i, -wEB],
        ],
        [
          [i, wWB],
          [i, YN],
        ],
      );
    for (let i = 1; i < lSB; i++)
      laneLines.push(
        [
          [-i, YS],
          [-i, -wEB],
        ],
        [
          [-i, wWB],
          [-i, YN],
        ],
      );
    for (let i = 1; i < lEB; i++)
      laneLines.push(
        [
          [XW, -i],
          [-wSB, -i],
        ],
        [
          [wNB, -i],
          [XE, -i],
        ],
      );
    for (let i = 1; i < lWB; i++)
      laneLines.push(
        [
          [XW, i],
          [-wSB, i],
        ],
        [
          [wNB, i],
          [XE, i],
        ],
      );
    const stops = [
      [
        [0, -wEB - 0.12],
        [wNB, -wEB - 0.12],
      ],
      [
        [-wSB, wWB + 0.12],
        [0, wWB + 0.12],
      ],
      [
        [-wSB - 0.12, 0],
        [-wSB - 0.12, -wEB],
      ],
      [
        [wNB + 0.12, wWB],
        [wNB + 0.12, 0],
      ],
    ];

    const xNB = (i) => (i + 0.5) * LANE,
      xSB = (i) => -(i + 0.5) * LANE;
    const yEB = (i) => -(i + 0.5) * LANE,
      yWB = (i) => (i + 0.5) * LANE;
    const moves = {
      NB: {
        thru: [
          [xNB(tNB), YS],
          [xNB(tNB), YN],
        ],
        left: [
          [xNB(0), YS],
          [xNB(0), -wEB],
          ...qSample([xNB(0), -wEB], [xNB(0), LANE / 2], [-wSB, LANE / 2]),
          [XW, LANE / 2],
        ],
        right: [
          [xNB(lNB - 1), YS],
          [xNB(lNB - 1), -wEB],
          ...qSample([xNB(lNB - 1), -wEB], [xNB(lNB - 1), -wEB + LANE / 2], [wNB, -wEB + LANE / 2]),
          [XE, -wEB + LANE / 2],
        ],
      },
      SB: {
        thru: [
          [xSB(tSB), YN],
          [xSB(tSB), YS],
        ],
        left: [
          [xSB(0), YN],
          [xSB(0), wWB],
          ...qSample([xSB(0), wWB], [xSB(0), -LANE / 2], [wNB, -LANE / 2]),
          [XE, -LANE / 2],
        ],
        right: [
          [xSB(lSB - 1), YN],
          [xSB(lSB - 1), wWB],
          ...qSample([xSB(lSB - 1), wWB], [xSB(lSB - 1), wWB - LANE / 2], [-wSB, wWB - LANE / 2]),
          [XW, wWB - LANE / 2],
        ],
      },
      EB: {
        thru: [
          [XW, yEB(tEB)],
          [XE, yEB(tEB)],
        ],
        left: [
          [XW, yEB(0)],
          [-wSB, yEB(0)],
          ...qSample([-wSB, yEB(0)], [LANE / 2, yEB(0)], [LANE / 2, wWB]),
          [LANE / 2, YN],
        ],
        right: [
          [XW, yEB(lEB - 1)],
          [-wSB, yEB(lEB - 1)],
          ...qSample([-wSB, yEB(lEB - 1)], [-wSB + LANE / 2, yEB(lEB - 1)], [-wSB + LANE / 2, -wEB]),
          [-wSB + LANE / 2, YS],
        ],
      },
      WB: {
        thru: [
          [XE, yWB(tWB)],
          [XW, yWB(tWB)],
        ],
        left: [
          [XE, yWB(0)],
          [wNB, yWB(0)],
          ...qSample([wNB, yWB(0)], [-LANE / 2, yWB(0)], [-LANE / 2, -wEB]),
          [-LANE / 2, YS],
        ],
        right: [
          [XE, yWB(lWB - 1)],
          [wNB, yWB(lWB - 1)],
          ...qSample([wNB, yWB(lWB - 1)], [wNB - LANE / 2, yWB(lWB - 1)], [wNB - LANE / 2, wWB]),
          [wNB - LANE / 2, YN],
        ],
      },
    };

    return { cross, centers, laneLines, stops, moves };
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
  let byKey = $derived(Object.fromEntries((approaches || []).map((a) => [a.key, a])));
  let ap = $derived((key) => byKey[key] ?? fallback);
  let nL = $derived((key) => Math.max(0, Number(ap(key).ln_left) || 0));
  let nT = $derived((key) => Math.max(1, Number(ap(key).ln_thru) || 1));
  let nR = $derived((key) => Math.max(0, Number(ap(key).ln_right) || 0));
  let lanes = $derived((key) => nL(key) + nT(key) + nR(key));
  let protectedLeft = $derived((key) => (Number(ap(key).left_phase) || 0) > 0 && nL(key) > 0);
  let model = $derived(
    build(
      lanes('NB'),
      lanes('SB'),
      lanes('EB'),
      lanes('WB'),
      nL('NB') + Math.floor((nT('NB') - 1) / 2),
      nL('SB') + Math.floor((nT('SB') - 1) / 2),
      nL('EB') + Math.floor((nT('EB') - 1) / 2),
      nL('WB') + Math.floor((nT('WB') - 1) / 2),
    ),
  );
</script>

<div class="signal-diagram-3d">
  <Camera3DSvg
    viewW={VIEW_W}
    viewH={VIEW_H}
    defYaw={24}
    defPitch={42}
    ariaLabel="four-leg signalized intersection, 3D view"
  >
    {#snippet children({ yaw, pitch, zoom, panX, panY })}
      {@const project = planProjector(yaw, pitch)}
      {@const tf = fitTransform(project, model.cross, VIEW_W, VIEW_H, PAD, zoom, panX, panY, THICK)}
      {@const d = makeDrawers(tf, THICK)}

      <path d={d.shadow(model.cross)} class="sd3-shadow" />
      {#each d.walls(model.cross) as w}
        <path d={w} class="sd3-wall" />
      {/each}
      <path d={d.polygon(model.cross)} class="sd3-top" />

      {#each model.centers as c}
        <path d={d.polyline(c)} class="sd3-center" />
      {/each}
      {#each model.laneLines as l}
        <path d={d.polyline(l)} class="sd3-lane-line" />
      {/each}
      {#each model.stops as s}
        <path d={d.polyline(s)} class="sd3-stop" />
      {/each}

      {#each order as o}
        <path d={d.polyline(model.moves[o.key].thru)} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`} />
        <path
          d={d.polyline(model.moves[o.key].left)}
          class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`}
          stroke-dasharray={protectedLeft(o.key) ? null : '6 5'}
        />
        <path d={d.polyline(model.moves[o.key].right)} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`} />
      {/each}
    {/snippet}
  </Camera3DSvg>

  <div class="sd3-legend" role="list">
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="sd3-chip {o.key.toLowerCase()}"
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
  .sd3-shadow {
    fill: var(--text);
    opacity: 0.08;
  }
  .sd3-wall {
    fill: var(--diag-wall);
    stroke: var(--diag-wall-edge);
    stroke-width: 0.5;
  }
  .sd3-top {
    fill: var(--diag-pavement);
    stroke: var(--diag-edge);
    stroke-width: 1.5;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .sd3-center {
    stroke: var(--diag-center);
    stroke-width: 1.25;
    fill: none;
    vector-effect: non-scaling-stroke;
  }
  .sd3-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1.25;
    stroke-dasharray: 7 5;
    fill: none;
    vector-effect: non-scaling-stroke;
  }
  .sd3-stop {
    stroke: var(--diag-lane-line);
    stroke-width: 3;
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .sd3-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition:
      opacity 120ms ease,
      stroke-width 120ms ease;
    opacity: 0.7;
  }
  .sd3-move.dim {
    opacity: 0.1;
  }
  .sd3-move.active {
    stroke-width: 4;
    opacity: 1;
  }
  .mv-nb {
    stroke: #2563eb;
  }
  .mv-sb {
    stroke: #16a34a;
  }
  .mv-eb {
    stroke: #ea7317;
  }
  .mv-wb {
    stroke: #dc2626;
  }
  .swatch.nb {
    background: #2563eb;
  }
  .swatch.sb {
    background: #16a34a;
  }
  .swatch.eb {
    background: #ea7317;
  }
  .swatch.wb {
    background: #dc2626;
  }

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
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: transparent;
    cursor: default;
  }
  .sd3-chip.active {
    border-color: var(--diag-edge);
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
</style>
