<script>
  // Rotatable 3D view of the weaving segment: the same plan geometry as
  // WeavingDiagram projected through the shared camera. Slabs with thickness,
  // dashed lane lines, and the four movement paths in the same colors.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers, qSample, cSample } from '$lib/proj3d.js';

  export let weavingType = 'one_sided';
  export let numLanes = 4;
  export let vFF = 0;
  export let vFR = 0;
  export let vRF = 0;
  export let vRR = 0;

  let hovered = null;

  const VIEW_W = 560, VIEW_H = 300, PAD = 24, THICK = 8;
  const LANE = 16, gIn = 78, gOut = 246, RAMP = 84, DROP = 46, X1 = 332;

  $: twoSided = weavingType === 'two_sided';
  $: mainLanes = Math.max(2, Math.min(6, (Number(numLanes) || 4) - (twoSided ? 0 : 1)));

  $: model = build(twoSided, mainLanes);

  function build(twoSided, mainLanes) {
    const mainTop = twoSided ? DROP + LANE + 14 : 16;
    const mainBot = mainTop + LANE * mainLanes;
    const auxBot = mainBot + LANE;
    const yLane = (i) => mainTop + LANE * i + LANE / 2;
    const yTop = yLane(0), yBottom = yLane(mainLanes - 1);
    const yAux = mainBot + LANE / 2;

    const main = [[0, mainTop], [X1, mainTop], [X1, mainBot], [0, mainBot]];
    let slabs, moves;
    if (twoSided) {
      const onr = [[gIn - RAMP, mainBot + DROP], [gIn, mainBot], [gIn + 70, mainBot], [gIn - RAMP, mainBot + DROP + LANE]];
      const offr = [[gOut - 70, mainTop], [gOut + RAMP, mainTop - DROP - LANE], [gOut + RAMP, mainTop - DROP], [gOut, mainTop]];
      slabs = [onr, offr, main];
      const ri = { x: gIn - RAMP + 14, y: mainBot + DROP + LANE / 2 - (DROP * 14) / RAMP };
      const ro = { x: gOut + RAMP - 14, y: mainTop - DROP - LANE / 2 + (DROP * 14) / RAMP };
      moves = {
        ff: [[0, yLane(Math.floor((mainLanes - 1) / 2))], [X1 - 8, yLane(Math.floor((mainLanes - 1) / 2))]],
        rr: [[ri.x, ri.y], [gIn + 2, mainBot + 9], ...cSample([gIn + 2, mainBot + 9], [gIn + 100, yBottom + 6], [gOut - 110, yTop - 4], [gOut - 2, mainTop - 13]), [ro.x, ro.y - 2]],
        rf: [[ri.x, ri.y + 4], [gIn + 4, mainBot + 12], ...qSample([gIn + 4, mainBot + 12], [gIn + 56, mainBot], [gIn + 96, yBottom]), [X1 - 8, yBottom]],
        fr: [[0, yTop], [gOut - 70, yTop], ...qSample([gOut - 70, yTop], [gOut - 16, yTop - 6], [gOut + 2, mainTop - 7]), [ro.x, ro.y + 4]],
      };
    } else {
      const aux = [[gIn, mainBot], [gOut, mainBot], [gOut, auxBot], [gIn, auxBot]];
      const onr = [[gIn - RAMP, auxBot + DROP - LANE], [gIn, mainBot], [gIn, auxBot], [gIn - RAMP, auxBot + DROP]];
      const offr = [[gOut, mainBot], [gOut + RAMP, auxBot + DROP - LANE], [gOut + RAMP, auxBot + DROP], [gOut, auxBot]];
      slabs = [onr, offr, aux, main];
      const ri = { x: gIn - RAMP + 14, y: auxBot + DROP - LANE / 2 - (DROP * 14) / RAMP };
      const ro = { x: gOut + RAMP - 14, y: auxBot - LANE / 2 + (DROP * (RAMP - 14)) / RAMP };
      moves = {
        ff: [[0, yLane(Math.floor((mainLanes - 1) / 2))], [X1 - 8, yLane(Math.floor((mainLanes - 1) / 2))]],
        rf: [[ri.x, ri.y - 3], [gIn, yAux - 3], ...cSample([gIn, yAux - 3], [gIn + 52, yAux - 2], [gIn + 84, yBottom], [gIn + 128, yBottom]), [X1 - 8, yBottom]],
        fr: [[0, yBottom], [gIn + 24, yBottom], ...cSample([gIn + 24, yBottom], [gIn + 60, yBottom], [gIn + 72, yAux - 2], [gIn + 108, yAux - 2]), [gOut, yAux - 2], [ro.x, ro.y - 3]],
        rr: [[ri.x, ri.y + 4], [gIn, yAux + 4], [gOut, yAux + 4], [ro.x, ro.y + 4]],
      };
    }

    const laneLines = [];
    for (let i = 1; i < mainLanes; i++) laneLines.push([[0, mainTop + LANE * i], [X1, mainTop + LANE * i]]);
    if (!twoSided) laneLines.push([[gIn, mainBot], [gOut, mainBot]]);

    return { slabs, moves, laneLines };
  }

  // Plan y grows downward in the 2D layout; flip it so north is up.
  const flip = (pts) => pts.map(([x, y]) => [x, -y]);

  const movements = [
    { key: 'ff', label: 'v_FF freeway → freeway' },
    { key: 'rf', label: 'v_RF ramp → freeway' },
    { key: 'fr', label: 'v_FR freeway → ramp' },
    { key: 'rr', label: 'v_RR ramp → ramp' },
  ];
  $: volumes = { ff: vFF, rf: vRF, fr: vFR, rr: vRR };

  function cls(h, key) {
    if (h == null) return 'w3-move';
    return h === key ? 'w3-move active' : 'w3-move dim';
  }
</script>

<div class="weave-diagram-3d">
  <Camera3DSvg viewW={VIEW_W} viewH={VIEW_H} defYaw={16} defPitch={48}
      ariaLabel={`${Number(numLanes) || 4}-lane ${twoSided ? 'two-sided' : 'one-sided'} weaving segment, 3D view`}
      let:yaw let:pitch let:zoom let:panX let:panY>
    {@const project = planProjector(yaw, pitch)}
    {@const fitPts = flip(model.slabs.flat())}
    {@const tf = fitTransform(project, fitPts, VIEW_W, VIEW_H, PAD, zoom, panX, panY, THICK)}
    {@const d = makeDrawers(tf, THICK)}

    {#each model.slabs as s}
      <path d={d.shadow(flip(s))} class="w3-shadow" />
    {/each}
    {#each model.slabs as s}
      {#each d.walls(flip(s)) as w}
        <path d={w} class="w3-wall" />
      {/each}
    {/each}
    {#each model.slabs as s}
      <path d={d.polygon(flip(s))} class="w3-top" />
    {/each}
    {#each model.laneLines as l}
      <path d={d.polyline(flip(l))} class="w3-lane-line" />
    {/each}

    {#each movements as m}
      {#if model.moves[m.key]}
        <path d={d.polyline(flip(model.moves[m.key]))} class={`mv-${m.key} ${cls(hovered, m.key)}`} />
      {/if}
    {/each}
  </Camera3DSvg>

  <div class="w3-legend" role="list">
    {#each movements as m}
      <button
        type="button"
        role="listitem"
        class="w3-chip {m.key}"
        class:active={hovered === m.key}
        on:mouseenter={() => (hovered = m.key)}
        on:mouseleave={() => (hovered = null)}
        on:focus={() => (hovered = m.key)}
        on:blur={() => (hovered = null)}
      >
        <span class="swatch {m.key}"></span>
        {m.label}: {Number(volumes[m.key]) || 0} veh/h
      </button>
    {/each}
  </div>
</div>

<style>
  .w3-shadow { fill: var(--text); opacity: 0.08; }
  .w3-wall { fill: var(--diag-wall); stroke: var(--diag-wall-edge); stroke-width: 0.5; }
  .w3-top { fill: var(--diag-pavement); stroke: var(--diag-edge); stroke-width: 1.25; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .w3-lane-line { stroke: var(--diag-lane-line); stroke-width: 1.25; stroke-dasharray: 7 5; fill: none; vector-effect: non-scaling-stroke; }

  .w3-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.8;
  }
  .w3-move.dim { opacity: 0.1; }
  .w3-move.active { stroke-width: 4; opacity: 1; }
  .mv-ff { stroke: #2563eb; }
  .mv-rf { stroke: #16a34a; }
  .mv-fr { stroke: #ea7317; }
  .mv-rr { stroke: #dc2626; }
  .swatch.ff { background: #2563eb; }
  .swatch.rf { background: #16a34a; }
  .swatch.fr { background: #ea7317; }
  .swatch.rr { background: #dc2626; }

  .w3-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.35rem; }
  .w3-chip {
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
  .w3-chip.active { border-color: var(--diag-edge); }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
</style>
