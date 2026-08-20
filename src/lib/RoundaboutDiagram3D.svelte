<script>
  // Rotatable 3D view of the roundabout: circulating disc and four leg slabs
  // with thickness, the central island cut out on top, yield lines, and the
  // counterclockwise movement arcs in the approach colors.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers, qSample } from '$lib/proj3d.js';

  // Per-approach LOS letters from the last run; the animation slows and

  /**
   * @typedef {Object} Props
   * @property {any} [entries]
   * @property {any} [approachLos] - thickens with worse LOS, same response as the 2D view.
   */

  /** @type {Props} */
  let { entries = {}, approachLos = {} } = $props();

  let hovered = $state(null);
  let animating = $state(false);
  const LOS_SPEED = { A: 1, B: 0.85, C: 0.7, D: 0.5, E: 0.32, F: 0.16 };
  const LOS_FLEET = { A: 1, B: 1, C: 1.1, D: 1.3, E: 1.7, F: 2.3 };
  const dirOf = { NB: 'nb', SB: 'sb', EB: 'eb', WB: 'wb' };
  const spanOf = { R: 90, T: 180, L: 270 };

  const VIEW_W = 520,
    VIEW_H = 340,
    PAD = 24,
    THICK = 9;
  const LANE = 1,
    RUN = 4.6,
    RI = 1.7;

  function build(circLanes, bNB, bSB, bEB, bWB) {
    const RO = RI + circLanes * LANE + 0.35;
    const RC = (RI + RO) / 2;
    const EXT = RO + RUN;

    const ring = (r, n = 48) =>
      Array.from({ length: n }, (_, k) => {
        const a = (2 * Math.PI * k) / n;
        return [r * Math.cos(a), r * Math.sin(a)];
      });

    // Leg slabs at the compass points, world coords (x east, y north).
    const legRect = (deg) => {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a),
        uy = Math.sin(a);
      const px = -uy,
        py = ux;
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
      const ux = Math.cos(a),
        uy = Math.sin(a);
      const px = -uy * side,
        py = ux * side;
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
          stubPt(leg.entry, +1, LANE * 0.55, EXT),
          stubPt(leg.entry, +1, LANE * 0.55, RO - 0.1),
          ...arcPts(leg.entry + 12, exitAngle - 12, RC),
          stubPt(exitAngle, -1, LANE * 0.55, RO - 0.1),
          stubPt(exitAngle, -1, LANE * 0.55, EXT),
        ];
      }
    }

    const yields = [270, 90, 180, 0].map((deg) => {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a),
        uy = Math.sin(a);
      const px = -uy,
        py = ux;
      const r = RO + 0.15;
      return [
        [ux * r + px * 0.1, uy * r + py * 0.1],
        [ux * r + px * (LANE * 1.6), uy * r + py * (LANE * 1.6)],
      ];
    });

    // Right-turn bypass slip lanes: sampled centerline (straight along the
    // entry leg, one curve across the corner, straight out the exit leg) and
    // an offset polygon for the pavement slab. Right turns reroute onto it.
    const modes = { NB: bNB, SB: bSB, EB: bEB, WB: bWB };
    const bypassSlabs = [];
    for (const key of Object.keys(LEG)) {
      if (modes[key] === 'none') continue;
      const leg = LEG[key];
      const A = leg.entry,
        B = leg.exits.R;
      const o = LANE * 2.15,
        kneeR = RO + LANE * 2.0;
      const pIn0 = stubPt(A, +1, o, EXT),
        pIn1 = stubPt(A, +1, o, kneeR);
      const pOut1 = stubPt(B, -1, o, kneeR),
        pOut0 = stubPt(B, -1, o, EXT);
      const ca = ((A + 45) * Math.PI) / 180;
      const cr = kneeR + LANE * 1.7;
      const corner = [cr * Math.cos(ca), cr * Math.sin(ca)];
      const center = [pIn0, pIn1, ...qSample(pIn1, corner, pOut1, 12), pOut0];
      const w = LANE * 0.55;
      const left = [],
        right = [];
      for (let i = 0; i < center.length; i++) {
        const a2 = center[Math.max(0, i - 1)],
          b2 = center[Math.min(center.length - 1, i + 1)];
        const dx = b2[0] - a2[0],
          dy = b2[1] - a2[1];
        const len = Math.hypot(dx, dy) || 1;
        left.push([center[i][0] - (dy / len) * w, center[i][1] + (dx / len) * w]);
        right.push([center[i][0] + (dy / len) * w, center[i][1] - (dx / len) * w]);
      }
      bypassSlabs.push({ key, mode: modes[key], center, slab: [...left, ...right.reverse()] });
      moves[key].R = center;
    }

    return {
      outer: ring(RO),
      island: ring(RI),
      circLine: circLanes > 1 ? ring(RI + LANE) : null,
      legs,
      moves,
      yields,
      bypassSlabs,
      fit: ring(EXT, 8),
    };
  }

  function cls(h, key) {
    if (h == null) return 'rb3-move';
    return h === key ? 'rb3-move active' : 'rb3-move dim';
  }
  // Volume-weighted fleet per movement; paths get projected in the template
  // so vehicles ride the same polylines the movement strokes use.
  let vehiclePlan = $derived(
    (() => {
      if (!animating) return [];
      const items = [];
      for (const key of ['NB', 'SB', 'EB', 'WB']) {
        const e = entries?.[dirOf[key]] || {};
        const slow = LOS_SPEED[approachLos?.[key]] ?? 1;
        const crowd = LOS_FLEET[approachLos?.[key]] ?? 1;
        for (const mv of ['R', 'T', 'L']) {
          const vol = Number(e[{ R: 'r', T: 't', L: 'l' }[mv]]) || 0;
          if (vol <= 0) continue;
          const freeFlow = mv === 'R' && e.bypass === 'nonyielding';
          items.push({
            key,
            mv,
            vol,
            dur: (4 + spanOf[mv] / 55) / (freeFlow ? 1 : slow),
            crowd: freeFlow ? 1 : crowd,
          });
        }
      }
      const total = items.reduce((s, it) => s + it.vol, 0) || 1;
      for (const it of items) {
        it.n = Math.max(1, Math.min(8, Math.round((26 * it.vol * it.crowd) / total)));
      }
      return items;
    })(),
  );
  let circLanes = $derived(
    Math.max(
      1,
      Math.min(
        2,
        Math.max(
          Number(entries?.nb?.circLanes) || 1,
          Number(entries?.sb?.circLanes) || 1,
          Number(entries?.eb?.circLanes) || 1,
          Number(entries?.wb?.circLanes) || 1,
        ),
      ),
    ),
  );
  // Bypass modes read directly so Svelte tracks them.
  let bNB = $derived(entries?.nb?.bypass || 'none');
  let bSB = $derived(entries?.sb?.bypass || 'none');
  let bEB = $derived(entries?.eb?.bypass || 'none');
  let bWB = $derived(entries?.wb?.bypass || 'none');
  let model = $derived(build(circLanes, bNB, bSB, bEB, bWB));
  let order = $derived([
    { key: 'NB', label: 'Northbound' },
    { key: 'SB', label: 'Southbound' },
    { key: 'EB', label: 'Eastbound' },
    { key: 'WB', label: 'Westbound' },
  ]);
</script>

<div class="rb-diagram-3d">
  <Camera3DSvg viewW={VIEW_W} viewH={VIEW_H} defYaw={18} defPitch={46} ariaLabel="four-leg roundabout, 3D view">
    {#snippet children({ yaw, pitch, zoom, panX, panY })}
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
      {#each model.bypassSlabs as b}
        <path d={d.shadow(b.slab)} class="rb3-shadow" />
        {#each d.walls(b.slab) as w}
          <path d={w} class="rb3-wall" />
        {/each}
        <path d={d.polygon(b.slab)} class="rb3-top" />
      {/each}
      <path d={d.polygon(model.island)} class="rb3-island" />
      {#if model.circLine}
        <path d={d.polygon(model.circLine)} class="rb3-lane-circle" />
      {/if}
      {#each model.yields as y}
        <path d={d.polyline(y)} class="rb3-yield" />
      {/each}

      {#each order as o}
        {#each ['R', 'T', 'L'] as mv}
          {@const byp = model.bypassSlabs.find((b) => b.key === o.key)}
          <path
            d={d.polyline(model.moves[o.key][mv])}
            class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`}
            stroke-dasharray={mv === 'R' && byp && byp.mode === 'yielding' ? '6 5' : null}
          />
        {/each}
      {/each}

      {#if animating}
        {#each vehiclePlan as v (v.key + v.mv)}
          {#each Array.from({ length: v.n }) as _, k}
            <g class="rb3-veh veh-{v.key.toLowerCase()}" class:dim={hovered != null && hovered !== v.key}>
              <rect x="-4" y="-2.1" width="8" height="4.2" rx="1.2" />
              <animateMotion
                dur="{v.dur}s"
                repeatCount="indefinite"
                rotate="auto"
                begin="{(-(k + 0.37 * (k % 2)) / v.n) * v.dur}s"
                path={d.polyline(model.moves[v.key][v.mv])}
              />
            </g>
          {/each}
        {/each}
      {/if}
    {/snippet}
  </Camera3DSvg>

  <div class="rb3-legend" role="list">
    <button
      type="button"
      class="rb3-chip rb3-animate"
      class:active={animating}
      aria-pressed={animating}
      onclick={() => (animating = !animating)}
    >
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="rb3-chip {o.key.toLowerCase()}"
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
  .rb3-shadow {
    fill: #0f172a;
    opacity: 0.08;
  }
  .rb3-wall {
    fill: var(--diag-wall);
    stroke: var(--diag-wall-edge);
    stroke-width: 0.5;
  }
  .rb3-top {
    fill: var(--diag-pavement);
    stroke: var(--diag-edge);
    stroke-width: 1.25;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .rb3-island {
    fill: var(--surface-page);
    stroke: var(--diag-edge);
    stroke-width: 1.25;
    vector-effect: non-scaling-stroke;
  }
  .rb3-lane-circle {
    fill: none;
    stroke: var(--diag-lane-line);
    stroke-width: 1.25;
    stroke-dasharray: 7 5;
    vector-effect: non-scaling-stroke;
  }
  .rb3-yield {
    stroke: var(--diag-lane-line);
    stroke-width: 3;
    stroke-dasharray: 4 4;
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .rb3-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition:
      opacity 120ms ease,
      stroke-width 120ms ease;
    opacity: 0.7;
  }
  .rb3-move.dim {
    opacity: 0.08;
  }
  .rb3-move.active {
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

  .rb3-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.35rem;
  }
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
  .rb3-chip.active {
    border-color: var(--diag-edge);
  }
  .rb3-animate {
    cursor: pointer;
    font-weight: 600;
  }
  .rb3-veh rect {
    stroke: rgba(15, 23, 42, 0.35);
    stroke-width: 0.6;
  }
  .rb3-veh {
    transition: opacity 120ms ease;
  }
  .rb3-veh.dim {
    opacity: 0.08;
  }
  .veh-nb rect {
    fill: #2563eb;
  }
  .veh-sb rect {
    fill: #16a34a;
  }
  .veh-eb rect {
    fill: #ea7317;
  }
  .veh-wb rect {
    fill: #dc2626;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
</style>
