<script>
  // Interactive plan view of a roundabout (HCM Chapter 22). Circulating
  // roadway as an annulus around the central island, four legs at the compass
  // points with entries yielding at dashed yield lines, counterclockwise
  // movement arcs per approach (right = quarter, through = half, left =
  // three-quarter), and right-turn bypass bands drawn outside the ring,
  // dashed when the bypass yields at the exit leg and solid when it merges
  // nonyielding.
  //
  // `entries` is the page's object: { nb|sb|eb|wb: { u,l,t,r, hv, entryLanes,
  // circLanes, exitLanes, bypass, laneAssignment, nped } }.
  export let entries = {};
  export let editable = true;

  let hovered = null; // 'NB' | 'SB' | 'EB' | 'WB' | null

  const LANE = 16;
  const RUN = 92;      // leg length outside the ring
  const RI = 34;       // central island radius

  $: eNB = Math.max(1, Number(entries?.nb?.entryLanes) || 1);
  $: eSB = Math.max(1, Number(entries?.sb?.entryLanes) || 1);
  $: eEB = Math.max(1, Number(entries?.eb?.entryLanes) || 1);
  $: eWB = Math.max(1, Number(entries?.wb?.entryLanes) || 1);
  $: circLanes = Math.max(1, Math.min(2,
    Math.max(Number(entries?.nb?.circLanes) || 1, Number(entries?.sb?.circLanes) || 1,
             Number(entries?.eb?.circLanes) || 1, Number(entries?.wb?.circLanes) || 1)));

  $: RO = RI + circLanes * LANE + 6;      // outer edge of the circulating roadway
  $: RC = (RI + RO) / 2;                  // circulating centerline
  $: maxLeg = Math.max(eNB, eSB, eEB, eWB);
  $: EXT = RO + RUN;
  $: cx = EXT;
  $: cy = EXT;
  $: W = 2 * EXT;
  $: H = 2 * EXT;

  // World angle -> svg point (x east, y south; world y is north).
  const pt = (cx, cy, r, deg) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy - r * Math.sin(a)).toFixed(1)}`;
  };

  // Counterclockwise arc on the circulating centerline from a1 to a2
  // (world degrees, increasing = CCW), sampled so it always draws the CCW way.
  function ccwArc(cx, cy, r, a1, a2, steps = 24) {
    let span = a2 - a1;
    while (span <= 0) span += 360;
    const out = [];
    for (let k = 0; k <= steps; k++) {
      out.push(pt(cx, cy, r, a1 + (span * k) / steps));
    }
    return out.join(' ');
  }

  // Leg geometry per approach: entry angle on the ring, entry-half offset
  // direction, and stub coordinates. Right-hand traffic: entries take the
  // right half of their leg, exits the right half of theirs.
  // Approach -> {ring angle of entry point, exit leg angles for R/T/L}.
  const LEG = {
    NB: { entry: 270, exits: { R: 0, T: 90, L: 180 } },
    EB: { entry: 180, exits: { R: 270, T: 0, L: 90 } },
    SB: { entry: 90, exits: { R: 180, T: 270, L: 0 } },
    WB: { entry: 0, exits: { R: 90, T: 180, L: 270 } },
  };

  // Stub endpoints at the canvas edge for a leg at world angle `deg`
  // (the leg lies along that compass direction from the center).
  // In svg coordinates the entry half (right of an approaching driver) is side -1, the exit half +1.
  function stub(deg, side, off, nearR = RO - 2) {
    // Perpendicular offset direction: rotate the leg direction -90° (driver's
    // right side approaching the ring).
    const a = (deg * Math.PI) / 180;
    const ux = Math.cos(a), uy = -Math.sin(a);          // svg unit toward the leg
    const px = -uy * side, py = ux * side;              // perpendicular
    const x0 = cx + ux * EXT + px * off, y0 = cy + uy * EXT + py * off;
    const x1 = cx + ux * nearR + px * off, y1 = cy + uy * nearR + py * off;
    return { far: `${x0.toFixed(1)},${y0.toFixed(1)}`, near: `${x1.toFixed(1)},${y1.toFixed(1)}` };
  }

  // Movement path for approach `key` and movement mv in {R,T,L}: entry stub,
  // CCW arc from just past the entry point to just before the exit point,
  // exit stub on the destination leg's exit half.
  function movePath(key, mv) {
    const leg = LEG[key];
    const exitAngle = leg.exits[mv];
    const enter = stub(leg.entry, -1, LANE * 0.55);
    const exit = stub(exitAngle, +1, LANE * 0.55);
    const arc = ccwArc(cx, cy, RC, leg.entry + 12, exitAngle - 12);
    return `M ${enter.far} L ${enter.near} L ${arc} L ${exit.near} L ${exit.far}`;
  }

  // Right-turn bypass: runs straight along the outside of its entry leg, cuts
  // the corner with one tight curve, and continues straight out the exit leg.
  // It stays clear of the circulating roadway entirely, which is the point of
  // a bypass lane.
  function bypassPath(key) {
    const leg = LEG[key];
    const exitAngle = leg.exits.R;
    const off = LANE * 2.15;
    const kneeR = RO + LANE * 2.0;
    const enter = stub(leg.entry, -1, off, kneeR);
    const exit = stub(exitAngle, +1, off, kneeR);
    // Corner control point on the diagonal between the two legs.
    const corner = pt(cx, cy, kneeR + LANE * 1.7, leg.entry + 45);
    return `M ${enter.far} L ${enter.near} Q ${corner} ${exit.near} L ${exit.far}`;
  }

  $: order = [
    { key: 'NB', label: 'Northbound entry' },
    { key: 'SB', label: 'Southbound entry' },
    { key: 'EB', label: 'Eastbound entry' },
    { key: 'WB', label: 'Westbound entry' },
  ];
  const dirOf = { NB: 'nb', SB: 'sb', EB: 'eb', WB: 'wb' };

  function setVol(key, field, raw) {
    entries[dirOf[key]][field] = raw === '' ? '' : Number(raw);
    entries = entries;
  }

  const CW = 128;
  const CH = 24;
  $: clusterPos = {
    NB: { x: W - CW - 4, y: H - CH - 4 },
    SB: { x: 4, y: 4 },
    EB: { x: 4, y: H - CH - 4 },
    WB: { x: W - CW - 4, y: 4 },
  };

  function cls(h, key) {
    if (h == null) return 'rb-move';
    return h === key ? 'rb-move active' : 'rb-move dim';
  }

  // Leg slab rectangles (as polygons) for the four compass legs.
  function legRect(deg) {
    const a = (deg * Math.PI) / 180;
    const ux = Math.cos(a), uy = -Math.sin(a);
    const px = -uy, py = ux;
    const wHalf = LANE * 1.6;
    const x0 = cx + ux * (RO - 6), y0 = cy + uy * (RO - 6);
    const x1 = cx + ux * EXT, y1 = cy + uy * EXT;
    return `${(x0 + px * wHalf).toFixed(1)},${(y0 + py * wHalf).toFixed(1)} ${(x1 + px * wHalf).toFixed(1)},${(y1 + py * wHalf).toFixed(1)} ${(x1 - px * wHalf).toFixed(1)},${(y1 - py * wHalf).toFixed(1)} ${(x0 - px * wHalf).toFixed(1)},${(y0 - py * wHalf).toFixed(1)}`;
  }

  $: bypasses = order
    .map((o) => ({ key: o.key, mode: entries?.[dirOf[o.key]]?.bypass || 'none' }))
    .filter((b) => b.mode !== 'none');

  // ── illustrative traffic animation ──
  // Small vehicles flow along the movement paths, count weighted by the
  // entered volumes, right turns using the bypass where one exists. This is a
  // schematic illustration at constant speed, not a simulation: no gap
  // acceptance, no queuing. A microsimulation bridge (SUMO or similar) would
  // be the real thing.
  let animating = false;
  const spanOf = { R: 90, T: 180, L: 270 };
  $: vehiclePlan = (() => {
    if (!animating) return [];
    const items = [];
    for (const o of order) {
      const e = entries?.[dirOf[o.key]] || {};
      for (const mv of ['R', 'T', 'L']) {
        const vol = Number(e[{ R: 'r', T: 't', L: 'l' }[mv]]) || 0;
        if (vol <= 0) continue;
        const useBypass = mv === 'R' && e.bypass && e.bypass !== 'none';
        items.push({
          key: o.key,
          d: useBypass ? bypassPath(o.key) : movePath(o.key, mv),
          vol,
          dur: useBypass ? 5 : 4 + spanOf[mv] / 55,
        });
      }
    }
    const total = items.reduce((s, it) => s + it.vol, 0) || 1;
    const BUDGET = 26;
    for (const it of items) {
      it.n = Math.max(1, Math.min(6, Math.round((BUDGET * it.vol) / total)));
    }
    return items;
  })();
</script>

<div class="rb-diagram">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label={`four-leg roundabout, ${circLanes} circulating lane${circLanes === 1 ? '' : 's'}`}>

    <!-- ══ pavement: legs, circulating annulus, central island ══ -->
    {#each [270, 90, 180, 0] as deg}
      <polygon points={legRect(deg)} class="rb-pavement" />
    {/each}
    <circle {cx} {cy} r={RO} class="rb-pavement" />
    <circle {cx} {cy} r={RI} class="rb-island" />

    <!-- ══ edges ══ -->
    <circle {cx} {cy} r={RI} class="rb-edge-circle" />
    {#each [270, 90, 180, 0] as deg}
      {@const a = (deg * Math.PI) / 180}
      {@const ux = Math.cos(a)}
      {@const uy = -Math.sin(a)}
      {@const px = -uy}
      {@const py = ux}
      {@const wHalf = LANE * 1.6}
      <line x1={cx + ux * (RO - 6) + px * wHalf} y1={cy + uy * (RO - 6) + py * wHalf}
            x2={cx + ux * EXT + px * wHalf} y2={cy + uy * EXT + py * wHalf} class="rb-edge" />
      <line x1={cx + ux * (RO - 6) - px * wHalf} y1={cy + uy * (RO - 6) - py * wHalf}
            x2={cx + ux * EXT - px * wHalf} y2={cy + uy * EXT - py * wHalf} class="rb-edge" />
      <!-- leg centerline between entry and exit halves -->
      <line x1={cx + ux * (RO + 2)} y1={cy + uy * (RO + 2)}
            x2={cx + ux * EXT} y2={cy + uy * EXT} class="rb-center" />
      <!-- yield line across the entry half where it meets the ring -->
      {@const yx0 = cx + ux * (RO + 3)}
      {@const yy0 = cy + uy * (RO + 3)}
      <line x1={yx0 - px * 2} y1={yy0 - py * 2} x2={yx0 - px * wHalf} y2={yy0 - py * wHalf} class="rb-yield" />
    {/each}
    {#if circLanes > 1}
      <circle {cx} {cy} r={RI + LANE} class="rb-lane-circle" />
    {/if}

    <!-- ══ bypass lane beds (pavement under the movement stroke) ══ -->
    {#each bypasses as b}
      <path d={bypassPath(b.key)} class="rb-bypass-bed-edge" />
      <path d={bypassPath(b.key)} class="rb-bypass-bed" />
    {/each}

    <!-- ══ bypass bands ══ -->
    {#each bypasses as b}
      <path d={bypassPath(b.key)} class={`rb-bypass mv-${b.key.toLowerCase()} ${cls(hovered, b.key)}`}
            stroke-dasharray={b.mode === 'yielding' ? '6 5' : null} />
    {/each}

    <!-- ══ movement arcs (right, through, left per entry) ══ -->
    {#each order as o}
      {#each ['R', 'T', 'L'] as mv}
        <path d={movePath(o.key, mv)} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`} />
      {/each}
    {/each}

    <!-- ══ illustrative vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.key + v.d)}
        {#each Array.from({ length: v.n }) as _, k}
          <g class="rb-veh veh-{v.key.toLowerCase()}" class:dim={hovered != null && hovered !== v.key}>
            <rect x="-4.5" y="-2.4" width="9" height="4.8" rx="1.4" />
            <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto"
                           begin="{(-(k + 0.37 * (k % 2)) / v.n) * v.dur}s" path={v.d} />
          </g>
        {/each}
      {/each}
    {/if}

    <!-- ══ on-diagram volume editors (U/L/T/R) ══ -->
    {#each editable ? order : [] as o (o.key)}
      <foreignObject x={clusterPos[o.key].x} y={clusterPos[o.key].y} width={CW} height={CH}>
        <div class="rb-cluster" xmlns="http://www.w3.org/1999/xhtml"
             on:mouseenter={() => (hovered = o.key)} on:mouseleave={() => (hovered = null)}>
          <span class="rb-cluster-title"><span class="swatch {o.key.toLowerCase()}"></span>{o.key}</span>
          {#each [['u', 'U-turn'], ['l', 'left-turn'], ['t', 'through'], ['r', 'right-turn']] as [f, name]}
            <input type="number" min="0" title="{o.key} {name} volume (veh/h)"
                   aria-label="{o.key} {name} volume"
                   value={entries?.[dirOf[o.key]]?.[f] ?? 0}
                   on:input={(e) => setVol(o.key, f, e.currentTarget.value)} />
          {/each}
        </div>
      </foreignObject>
    {/each}
  </svg>

  <div class="rb-legend" role="list">
    <button type="button" class="rb-chip rb-animate" class:active={animating}
            aria-pressed={animating} on:click={() => (animating = !animating)}>
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="rb-chip {o.key.toLowerCase()}"
        class:active={hovered === o.key}
        on:mouseenter={() => (hovered = o.key)}
        on:mouseleave={() => (hovered = null)}
        on:focus={() => (hovered = o.key)}
        on:blur={() => (hovered = null)}
      >
        <span class="swatch {o.key.toLowerCase()}"></span>
        {o.label}{entries?.[dirOf[o.key]]?.bypass && entries[dirOf[o.key]].bypass !== 'none' ? `, ${entries[dirOf[o.key]].bypass} bypass` : ''}
      </button>
    {/each}
  </div>
  <p class="rb-note">Circulation is counterclockwise and entries yield at the dashed line. Volume boxes are U-turn / left / through / right. A dashed bypass yields at its exit leg; a solid one merges without yielding. Animated vehicles are an illustration at constant speed, weighted by the entered volumes, not a simulation.</p>
</div>

<style>
  .rb-diagram svg {
    width: 100%;
    max-width: 460px;
    display: block;
    margin: 0 auto;
  }
  .rb-pavement { fill: var(--diag-pavement); }
  .rb-island { fill: var(--surface-page); }
  .rb-edge-circle { fill: none; stroke: var(--diag-edge); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .rb-lane-circle { fill: none; stroke: var(--diag-lane-line); stroke-width: 1.5; stroke-dasharray: 8 6; vector-effect: non-scaling-stroke; }
  .rb-edge { stroke: var(--diag-edge); stroke-width: 2; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .rb-center { stroke: var(--diag-center); stroke-width: 1.25; vector-effect: non-scaling-stroke; }
  .rb-yield { stroke: var(--diag-lane-line); stroke-width: 3; stroke-dasharray: 4 4; vector-effect: non-scaling-stroke; }

  .rb-move, .rb-bypass {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.7;
  }
  .rb-move.dim, .rb-bypass.dim { opacity: 0.08; }
  .rb-move.active, .rb-bypass.active { stroke-width: 4; opacity: 1; }
  .mv-nb { stroke: #2563eb; }
  .mv-sb { stroke: #16a34a; }
  .mv-eb { stroke: #ea7317; }
  .mv-wb { stroke: #dc2626; }
  .swatch.nb { background: #2563eb; }
  .swatch.sb { background: #16a34a; }
  .swatch.eb { background: #ea7317; }
  .swatch.wb { background: #dc2626; }

  .rb-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
  .rb-chip {
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
  .rb-chip.active { border-color: var(--diag-edge); }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
  .rb-note { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.35rem; }

  .rb-bypass-bed-edge { fill: none; stroke: var(--diag-edge); stroke-width: 19; stroke-linecap: butt; }
  .rb-bypass-bed { fill: none; stroke: var(--diag-pavement); stroke-width: 16; stroke-linecap: butt; }

  .rb-veh rect { stroke: rgba(15, 23, 42, 0.35); stroke-width: 0.6; }
  .rb-veh { transition: opacity 120ms ease; }
  .rb-veh.dim { opacity: 0.08; }
  .veh-nb rect { fill: #2563eb; }
  .veh-sb rect { fill: #16a34a; }
  .veh-eb rect { fill: #ea7317; }
  .veh-wb rect { fill: #dc2626; }
  .rb-animate { cursor: pointer; font-weight: 600; }

  .rb-cluster {
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 2px;
    width: 100%;
    height: 100%;
    font-size: 8px;
    line-height: 1;
    color: var(--text-secondary);
    background: color-mix(in srgb, var(--surface) 90%, transparent);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    padding: 2px 3px;
    overflow: hidden;
  }
  .rb-cluster-title { display: inline-flex; align-items: center; gap: 2px; font-size: 7px; font-weight: 600; flex: none; }
  .rb-cluster input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    flex: 1 1 0;
    font-size: 8px;
    line-height: 1;
    padding: 2px 1px;
    border: 1px solid var(--border-strong);
    border-radius: 3px;
    background: var(--surface);
    color: var(--text);
    text-align: center;
  }
  .rb-cluster input::-webkit-outer-spin-button,
  .rb-cluster input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .rb-cluster input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
  .rb-cluster .swatch { width: 6px; height: 6px; }
</style>
