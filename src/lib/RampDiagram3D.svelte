<script>
  // Rotatable 3D view of the ramp-freeway junction: the same plan geometry as
  // RampDiagram projected through the shared camera. The ramp band and the
  // two-lane influence area highlight from the legend exactly like the 2D view.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers } from '$lib/proj3d.js';

  export let rampType = 'on_ramp';
  export let rampSide = 'right';
  export let rampLanes = 1;
  export let freewayLanes = 3;
  export let accelLen = 800;
  export let decelLen = 400;

  let hovered = null; // 'ramp' | 'influence' | null

  const VIEW_W = 560, VIEW_H = 280, PAD = 24, THICK = 8;
  const LANE = 16, RAMP = 74, DROP = 42, TAPER = 32, X1 = 320;

  $: lanes = Math.max(2, Math.min(5, Number(freewayLanes) || 3));
  $: isOn = rampType === 'on_ramp' || rampType === 'major_merge';
  $: onRight = rampSide !== 'left';
  $: nRamp = Math.max(1, Math.min(2, Number(rampLanes) || 1));
  $: scl = Math.max(300, Math.min(1500, Number(isOn ? accelLen : decelLen) || 500));
  $: sclPx = 70 + ((scl - 300) / 1200) * 100;

  $: model = build(lanes, isOn, onRight, nRamp, sclPx);

  function build(lanes, isOn, onRight, nRamp, sclPx) {
    const gore = isOn ? 84 : 236;
    const mainTop = onRight ? 20 : DROP + LANE + 30;
    const mainH = LANE * lanes;
    const mainBot = mainTop + mainH;
    const dir = onRight ? 1 : -1;
    const edgeY = onRight ? mainBot : mainTop;
    const ry = (offset) => edgeY + dir * offset;

    const laneX0 = isOn ? gore : gore - sclPx;
    const laneX1 = isOn ? gore + sclPx : gore;
    const taperTip = isOn ? laneX1 + TAPER : laneX0 - TAPER;

    const main = [[0, mainTop], [X1, mainTop], [X1, mainBot], [0, mainBot]];
    const sclSlab = isOn
      ? [[laneX0, ry(0)], [taperTip, ry(0)], [laneX1, ry(LANE * nRamp)], [laneX0, ry(LANE * nRamp)]]
      : [[taperTip, ry(0)], [laneX1, ry(0)], [laneX1, ry(LANE * nRamp)], [laneX0, ry(LANE * nRamp)]];
    const rampSlab = isOn
      ? [[gore - RAMP, ry(DROP)], [gore, ry(0)], [gore, ry(LANE * nRamp)], [gore - RAMP, ry(DROP + LANE * nRamp)]]
      : [[gore, ry(0)], [gore + RAMP, ry(DROP)], [gore + RAMP, ry(DROP + LANE * nRamp)], [gore, ry(LANE * nRamp)]];

    // Influence area: the two lanes nearest the ramp, downstream of a merge,
    // upstream of a diverge.
    const inflLanes = Math.min(2, lanes);
    const inflY = onRight ? mainBot - LANE * inflLanes : mainTop;
    const inflX = isOn ? gore : Math.max(0, gore - 170);
    const infl = [[inflX, inflY], [inflX + 170, inflY], [inflX + 170, inflY + LANE * inflLanes], [inflX, inflY + LANE * inflLanes]];

    const laneLines = [];
    for (let i = 1; i < lanes; i++) laneLines.push([[0, mainTop + LANE * i], [X1, mainTop + LANE * i]]);
    laneLines.push([[Math.min(laneX0, taperTip), edgeY], [Math.max(laneX1, taperTip), edgeY]]);
    if (nRamp === 2) {
      laneLines.push([[laneX0, ry(LANE)], [laneX1, ry(LANE)]]);
      laneLines.push(isOn
        ? [[gore - RAMP, ry(DROP + LANE)], [gore, ry(LANE)]]
        : [[gore, ry(LANE)], [gore + RAMP, ry(DROP + LANE)]]);
    }

    return { slabs: [rampSlab, sclSlab, main], rampSlabs: [rampSlab, sclSlab], infl, laneLines };
  }

  const flip = (pts) => pts.map(([x, y]) => [x, -y]);

  const items = [
    { key: 'ramp', label: 'ramp and speed-change lane' },
    { key: 'influence', label: 'ramp influence area (lanes 1-2, 1,500 ft)' },
  ];
</script>

<div class="ramp-diagram-3d">
  <Camera3DSvg viewW={VIEW_W} viewH={VIEW_H} defYaw={16} defPitch={48}
      ariaLabel={`${lanes}-lane freeway with a ${nRamp}-lane ${onRight ? 'right' : 'left'}-side ${rampType.replace('_', ' ')}, 3D view`}
      let:yaw let:pitch let:zoom let:panX let:panY>
    {@const project = planProjector(yaw, pitch)}
    {@const tf = fitTransform(project, flip(model.slabs.flat()), VIEW_W, VIEW_H, PAD, zoom, panX, panY, THICK)}
    {@const d = makeDrawers(tf, THICK)}

    {#each model.slabs as s}
      <path d={d.shadow(flip(s))} class="r3-shadow" />
    {/each}
    {#each model.slabs as s}
      {#each d.walls(flip(s)) as w}
        <path d={w} class="r3-wall" />
      {/each}
    {/each}
    {#each model.rampSlabs as s}
      <path d={d.polygon(flip(s))} class="r3-scl" class:active={hovered === 'ramp'} />
    {/each}
    <path d={d.polygon(flip(model.slabs[2]))} class="r3-top" />
    <path d={d.polygon(flip(model.infl))} class="r3-influence" class:active={hovered === 'influence'} />
    {#each model.laneLines as l}
      <path d={d.polyline(flip(l))} class="r3-lane-line" />
    {/each}
  </Camera3DSvg>

  <div class="r3-legend" role="list">
    {#each items as it}
      <button
        type="button"
        role="listitem"
        class="r3-chip {it.key}"
        class:active={hovered === it.key}
        on:mouseenter={() => (hovered = it.key)}
        on:mouseleave={() => (hovered = null)}
        on:focus={() => (hovered = it.key)}
        on:blur={() => (hovered = null)}
      >
        <span class="swatch {it.key}"></span>
        {it.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .r3-shadow { fill: var(--text); opacity: 0.08; }
  .r3-wall { fill: var(--diag-wall); stroke: var(--diag-wall-edge); stroke-width: 0.5; }
  .r3-top { fill: var(--diag-pavement); stroke: var(--diag-edge); stroke-width: 1.25; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .r3-scl {
    fill: var(--border-strong);
    stroke: var(--diag-edge);
    stroke-width: 1.25;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
    transition: fill 120ms ease;
  }
  .r3-scl.active { fill: var(--diag-scl-active-3d); }
  .r3-influence {
    fill: var(--diag-infl-soft);
    opacity: 0.45;
    stroke: var(--diag-infl-edge);
    stroke-width: 1;
    stroke-dasharray: 5 4;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease;
  }
  .r3-influence.active { opacity: 0.85; }
  .r3-lane-line { stroke: var(--diag-lane-line); stroke-width: 1.25; stroke-dasharray: 7 5; fill: none; vector-effect: non-scaling-stroke; }

  .r3-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.35rem; }
  .r3-chip {
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
  .r3-chip.active { border-color: var(--diag-edge); }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
  .swatch.ramp { background: var(--diag-scl-active-3d); }
  .swatch.influence { background: var(--diag-infl-soft); border: 1px solid var(--diag-infl-edge); }
</style>
