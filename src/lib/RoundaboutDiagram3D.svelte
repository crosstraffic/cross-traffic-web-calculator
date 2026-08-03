<script>
  // Rotatable 3D view of the roundabout: circulating disc and four leg slabs
  // with thickness, the central island cut out on top, yield lines, and the
  // counterclockwise movement arcs in the approach colors.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers } from '$lib/proj3d.js';

  export let entries = {};

  let hovered = null;

  const VIEW_W = 520, VIEW_H = 340, PAD = 24, THICK = 9;
  const LANE = 1, RUN = 4.6, RI = 1.7;

  $: circLanes = Math.max(1, Math.min(2,
    Math.max(Number(entries?.nb?.circLanes) || 1, Number(entries?.sb?.circLanes) || 1,
             Number(entries?.eb?.circLanes) || 1, Number(entries?.wb?.circLanes) || 1)));

  $: model = build(circLanes);

  function build(circLanes) {
    const RO = RI + circLanes * LANE + 0.35;
    const RC = (RI + RO) / 2;
    const EXT = RO + RUN;

    const ring = (r, n = 48) => Array.from({ length: n }, (_, k) => {
      const a = (2 * Math.PI * k) / n;
      return [r * Math.cos(a), r * Math.sin(a)];
    });

    // Leg slabs at the compass points, world coords (x east, y north).
    const legRect = (deg) => {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a), uy = Math.sin(a);
      const px = -uy, py = ux;
      const w = LANE * 1.6;
      return [
        [ux * (RO - 0.3) + px * w, uy * (RO - 0.3) + py * w],
        [ux * EXT + px * w, uy * EXT + py * w],
        [ux * EXT - px * w, uy * EXT - py * w],
        [ux * (RO - 0.3) - px * w, uy * (RO - 0.3) - py * w],
      ];
    };
    const legs = [270, 90, 180, 0].map(legRect);

    // Movement arcs, CCW from entry to exit angle.
    const LEG = {
      NB: { entry: 270, exits: { R: 0, T: 90, L: 180 } },
      EB: { entry: 180, exits: { R: 270, T: 0, L: 90 } },
      SB: { entry: 90, exits: { R: 180, T: 270, L: 0 } },
      WB: { entry: 0, exits: { R: 90, T: 180, L: 270 } },
    };
    const stubPt = (deg, side, off, rr) => {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a), uy = Math.sin(a);
      const px = -uy * side, py = ux * side;
      return [ux * rr + px * off, uy * rr + py * off];
    };
    const arcPts = (a1, a2, r) => {
      let span = a2 - a1;
      while (span <= 0) span += 360;
      return Array.from({ length: 21 }, (_, k) => {
        const a = ((a1 + (span * k) / 20) * Math.PI) / 180;
        return [r * Math.cos(a), r * Math.sin(a)];
      });
    };
    // Approaching drivers keep right: world-side sign differs from the 2D svg
    // because y points north here.
    const moves = {};
    for (const key of Object.keys(LEG)) {
      const leg = LEG[key];
      moves[key] = {};
      for (const mv of ['R', 'T', 'L']) {
        const exitAngle = leg.exits[mv];
        moves[key][mv] = [
          stubPt(leg.entry, -1, LANE * 0.55, EXT),
          stubPt(leg.entry, -1, LANE * 0.55, RO - 0.1),
          ...arcPts(leg.entry + 12, exitAngle - 12, RC),
          stubPt(exitAngle, +1, LANE * 0.55, RO - 0.1),
          stubPt(exitAngle, +1, LANE * 0.55, EXT),
        ];
      }
    }

    const yields = [270, 90, 180, 0].map((deg) => {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a), uy = Math.sin(a);
      const px = -uy, py = ux;
      const r = RO + 0.15;
      return [[ux * r - px * 0.1, uy * r - py * 0.1], [ux * r - px * (LANE * 1.6), uy * r - py * (LANE * 1.6)]];
    });

    return {
      outer: ring(RO), island: ring(RI), circLine: circLanes > 1 ? ring(RI + LANE) : null,
      legs, moves, yields, fit: ring(EXT, 8),
    };
  }

  $: order = [
    { key: 'NB', label: 'Northbound' },
    { key: 'SB', label: 'Southbound' },
    { key: 'EB', label: 'Eastbound' },
    { key: 'WB', label: 'Westbound' },
  ];

  function cls(h, key) {
    if (h == null) return 'rb3-move';
    return h === key ? 'rb3-move active' : 'rb3-move dim';
  }
</script>

<div class="rb-diagram-3d">
  <Camera3DSvg viewW={VIEW_W} viewH={VIEW_H} defYaw={18} defPitch={46}
      ariaLabel="four-leg roundabout, 3D view"
      let:yaw let:pitch let:zoom let:panX let:panY>
    {@const project = planProjector(yaw, pitch)}
    {@const tf = fitTransform(project, model.fit, VIEW_W, VIEW_H, PAD, zoom, panX, panY, THICK, 1.0)}
    {@const d = makeDrawers(tf, THICK)}

    {#each model.legs as leg}
      <path d={d.shadow(leg)} class="rb3-shadow" />
    {/each}
    <path d={d.shadow(model.outer)} class="rb3-shadow" />
    {#each model.legs as leg}
      {#each d.walls(leg) as w}
        <path d={w} class="rb3-wall" />
      {/each}
    {/each}
    {#each d.walls(model.outer) as w}
      <path d={w} class="rb3-wall" />
    {/each}
    {#each model.legs as leg}
      <path d={d.polygon(leg)} class="rb3-top" />
    {/each}
    <path d={d.polygon(model.outer)} class="rb3-top" />
    <path d={d.polygon(model.island)} class="rb3-island" />
    {#if model.circLine}
      <path d={d.polygon(model.circLine)} class="rb3-lane-circle" />
    {/if}
    {#each model.yields as y}
      <path d={d.polyline(y)} class="rb3-yield" />
    {/each}

    {#each order as o}
      {#each ['R', 'T', 'L'] as mv}
        <path d={d.polyline(model.moves[o.key][mv])} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`} />
      {/each}
    {/each}
  </Camera3DSvg>

  <div class="rb3-legend" role="list">
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="rb3-chip {o.key.toLowerCase()}"
        class:active={hovered === o.key}
        on:mouseenter={() => (hovered = o.key)}
        on:mouseleave={() => (hovered = null)}
        on:focus={() => (hovered = o.key)}
        on:blur={() => (hovered = null)}
      >
        <span class="swatch {o.key.toLowerCase()}"></span>
        {o.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .rb3-shadow { fill: #0f172a; opacity: 0.08; }
  .rb3-wall { fill: var(--diag-wall); stroke: var(--diag-wall-edge); stroke-width: 0.5; }
  .rb3-top { fill: var(--diag-pavement); stroke: var(--diag-edge); stroke-width: 1.25; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .rb3-island { fill: var(--surface-page); stroke: var(--diag-edge); stroke-width: 1.25; vector-effect: non-scaling-stroke; }
  .rb3-lane-circle { fill: none; stroke: var(--diag-lane-line); stroke-width: 1.25; stroke-dasharray: 7 5; vector-effect: non-scaling-stroke; }
  .rb3-yield { stroke: var(--diag-lane-line); stroke-width: 3; stroke-dasharray: 4 4; fill: none; vector-effect: non-scaling-stroke; }

  .rb3-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.7;
  }
  .rb3-move.dim { opacity: 0.08; }
  .rb3-move.active { stroke-width: 4; opacity: 1; }
  .mv-nb { stroke: #2563eb; }
  .mv-sb { stroke: #16a34a; }
  .mv-eb { stroke: #ea7317; }
  .mv-wb { stroke: #dc2626; }
  .swatch.nb { background: #2563eb; }
  .swatch.sb { background: #16a34a; }
  .swatch.eb { background: #ea7317; }
  .swatch.wb { background: #dc2626; }

  .rb3-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.35rem; }
  .rb3-chip {
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
  .rb3-chip.active { border-color: var(--diag-edge); }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
</style>
