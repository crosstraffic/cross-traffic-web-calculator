<script>
  // Interactive plan view of a conventional diamond interchange (HCM Chapter
  // 23, Part B). The freeway runs north-south with separate carriageways, the
  // arterial east-west through two signalized ramp terminals, and the four
  // ramps lean toward the freeway in the diamond pattern. Each O-D movement
  // (Exhibit 23-8 letters A through J) draws as a path colored by its origin
  // group; hover the legend to isolate a group, edit the O-D demands directly
  // on the picture, and animate traffic that slows per O-D LOS after a run.
  export let odDemands = [];
  export let editable = true;
  // 'Diamond' or 'Ddi': the DDI crosses the arterial throughs to the left
  // side between the terminals, so its internal paths swap sides at both
  // crossovers.
  export let form = 'Diamond';
  // Per-O-D LOS letters from the last run ({ A: 'C', ... }).
  export let odLos = {};

  let hovered = null; // 'NBOFF' | 'SBOFF' | 'EB' | 'WB' | null

  const W = 520, H = 320;
  const LANE = 14;
  const cx = 260, cy = 160;
  const xW = 165, xE = 355;          // terminal nodes
  const FWY = 38;                    // carriageway width
  const GAP = 12;                    // median
  const LEAN = 46;                   // ramp lean toward the freeway

  // Arterial lane centers.
  const ebOut = cy + 21, ebIn = cy + 7, wbIn = cy - 7, wbOut = cy - 21;

  // Ramp stubs: [xAtTerminal, yAtArterial] to [xAtFreewayEnd, yEdge].
  const stubs = {
    sbOff: { x0: xW, y0: cy - 28, x1: xW + LEAN, y1: 16 },      // west terminal, north leg (down toward node)
    sbOn: { x0: xW, y0: cy + 28, x1: xW + LEAN, y1: H - 16 },   // west terminal, south leg
    nbOn: { x0: xE, y0: cy - 28, x1: xE - LEAN, y1: 16 },       // east terminal, north leg
    nbOff: { x0: xE, y0: cy + 28, x1: xE - LEAN, y1: H - 16 },  // east terminal, south leg
  };
  const stubBand = (s) => {
    const dx = 11;
    return `${s.x0 - dx},${s.y0} ${s.x0 + dx},${s.y0} ${s.x1 + dx},${s.y1} ${s.x1 - dx},${s.y1}`;
  };
  const along = (s, t) => `${(s.x0 + (s.x1 - s.x0) * t).toFixed(1)},${(s.y0 + (s.y1 - s.y0) * t).toFixed(1)}`;

  // Internal-side lane centers for the DDI crossovers.
  const ebN = cy - 10, wbS = cy + 10;

  // O-D paths. Straight legs with quarter curves at the nodes; the DDI set
  // crosses the throughs between the terminals.
  const P_DDI = {
    A: `M ${along(stubs.nbOff, 1)} L ${along(stubs.nbOff, 0.1)} Q ${xE - 2},${wbS} ${xE - 26},${wbS} L ${xW + 30},${wbS} C ${xW + 6},${wbS} ${xW + 18},${wbIn} ${xW - 26},${wbIn} L 0,${wbIn}`,
    B: `M ${along(stubs.nbOff, 1)} L ${along(stubs.nbOff, 0.15)} Q ${xE + 4},${ebOut} ${xE + 26},${ebOut} L ${W},${ebOut}`,
    C: `M ${along(stubs.sbOff, 1)} L ${along(stubs.sbOff, 0.15)} Q ${xW - 4},${wbOut} ${xW - 26},${wbOut} L 0,${wbOut}`,
    D: `M ${along(stubs.sbOff, 1)} L ${along(stubs.sbOff, 0.1)} Q ${xW + 2},${ebN} ${xW + 26},${ebN} L ${xE - 30},${ebN} C ${xE - 6},${ebN} ${xE - 18},${ebIn} ${xE + 26},${ebIn} L ${W},${ebIn}`,
    E: `M 0,${ebIn} L ${xW - 30},${ebIn} C ${xW - 6},${ebIn} ${xW - 18},${ebN} ${xW + 26},${ebN} L ${xE - 30},${ebN} Q ${xE - 4},${ebN} ${along(stubs.nbOn, 0.14)} L ${along(stubs.nbOn, 1)}`,
    F: `M 0,${ebOut} L ${xW - 26},${ebOut} Q ${xW + 2},${ebOut} ${along(stubs.sbOn, 0.15)} L ${along(stubs.sbOn, 1)}`,
    I: `M 0,${cy + 17} L ${xW - 30},${cy + 17} C ${xW - 6},${cy + 17} ${xW - 18},${ebN - 6} ${xW + 26},${ebN - 6} L ${xE - 30},${ebN - 6} C ${xE - 6},${ebN - 6} ${xE - 18},${cy + 17} ${xE + 26},${cy + 17} L ${W},${cy + 17}`,
    G: `M ${W},${wbOut} L ${xE + 26},${wbOut} Q ${xE - 2},${wbOut} ${along(stubs.nbOn, 0.15)} L ${along(stubs.nbOn, 1)}`,
    H: `M ${W},${wbIn} L ${xE + 30},${wbIn} C ${xE + 6},${wbIn} ${xE + 18},${wbS} ${xE - 26},${wbS} L ${xW + 30},${wbS} Q ${xW + 4},${wbS} ${along(stubs.sbOn, 0.13)} L ${along(stubs.sbOn, 1)}`,
    J: `M ${W},${cy - 17} L ${xE + 30},${cy - 17} C ${xE + 6},${cy - 17} ${xE + 18},${wbS + 6} ${xE - 26},${wbS + 6} L ${xW + 30},${wbS + 6} C ${xW + 6},${wbS + 6} ${xW + 18},${cy - 17} ${xW - 26},${cy - 17} L 0,${cy - 17}`,
  };

  const P_DIAMOND = {
    // NB off-ramp (east terminal, south leg)
    A: `M ${along(stubs.nbOff, 1)} L ${along(stubs.nbOff, 0.1)} Q ${xE},${wbIn} ${xE - 24},${wbIn} L 0,${wbIn}`,
    B: `M ${along(stubs.nbOff, 1)} L ${along(stubs.nbOff, 0.15)} Q ${xE + 4},${ebOut} ${xE + 26},${ebOut} L ${W},${ebOut}`,
    // SB off-ramp (west terminal, north leg)
    C: `M ${along(stubs.sbOff, 1)} L ${along(stubs.sbOff, 0.15)} Q ${xW - 4},${wbOut} ${xW - 26},${wbOut} L 0,${wbOut}`,
    D: `M ${along(stubs.sbOff, 1)} L ${along(stubs.sbOff, 0.1)} Q ${xW},${ebIn} ${xW + 24},${ebIn} L ${W},${ebIn}`,
    // EB arterial
    E: `M 0,${ebIn} L ${xE - 26},${ebIn} Q ${xE},${ebIn} ${along(stubs.nbOn, 0.12)} L ${along(stubs.nbOn, 1)}`,
    F: `M 0,${ebOut} L ${xW - 26},${ebOut} Q ${xW + 2},${ebOut} ${along(stubs.sbOn, 0.15)} L ${along(stubs.sbOn, 1)}`,
    I: `M 0,${cy + 14} L ${W},${cy + 14}`,
    // WB arterial
    G: `M ${W},${wbOut} L ${xE + 26},${wbOut} Q ${xE - 2},${wbOut} ${along(stubs.nbOn, 0.15)} L ${along(stubs.nbOn, 1)}`,
    H: `M ${W},${wbIn} L ${xW + 26},${wbIn} Q ${xW},${wbIn} ${along(stubs.sbOn, 0.12)} L ${along(stubs.sbOn, 1)}`,
    J: `M ${W},${cy - 14} L 0,${cy - 14}`,
  };
  $: P = form === 'Ddi' ? P_DDI : P_DIAMOND;

  const GROUPS = [
    { key: 'NBOFF', label: 'NB off-ramp (A, B)', ods: ['a', 'b'], cls: 'nboff' },
    { key: 'SBOFF', label: 'SB off-ramp (C, D)', ods: ['c', 'd'], cls: 'sboff' },
    { key: 'EB', label: 'EB arterial (E, F, I)', ods: ['e', 'f', 'i'], cls: 'ebg' },
    { key: 'WB', label: 'WB arterial (G, H, J)', ods: ['g', 'h', 'j'], cls: 'wbg' },
  ];
  const groupOf = { a: 'NBOFF', b: 'NBOFF', c: 'SBOFF', d: 'SBOFF', e: 'EB', f: 'EB', i: 'EB', g: 'WB', h: 'WB', j: 'WB' };
  const clsOf = { NBOFF: 'nboff', SBOFF: 'sboff', EB: 'ebg', WB: 'wbg' };

  $: volOf = Object.fromEntries((odDemands || []).map((d) => [d.key, Number(d.value) || 0]));

  function setOd(key, raw) {
    const d = odDemands.find((x) => x.key === key);
    if (d) {
      d.value = raw === '' ? '' : Number(raw);
      odDemands = odDemands;
    }
  }

  function cls(h, group) {
    if (h == null) return 'dd-move';
    return h === group ? 'dd-move active' : 'dd-move dim';
  }

  // ── illustrative traffic, per-O-D LOS ──
  let animating = false;
  const LOS_SPEED = { A: 1, B: 0.85, C: 0.7, D: 0.5, E: 0.32, F: 0.16 };
  const LOS_FLEET = { A: 1, B: 1, C: 1.1, D: 1.3, E: 1.7, F: 2.3 };
  $: vehiclePlan = (() => {
    if (!animating) return [];
    const raw = [];
    let total = 0;
    for (const [k, group] of Object.entries(groupOf)) {
      const vol = volOf[k] || 0;
      if (vol <= 0) continue;
      const letter = k.toUpperCase();
      const slow = LOS_SPEED[odLos?.[letter]] ?? 1;
      const crowd = LOS_FLEET[odLos?.[letter]] ?? 1;
      raw.push({ k, group, d: P[letter], vol, dur: 7 / slow, crowd });
      total += vol;
    }
    const items = [];
    for (const it of raw) {
      const n = Math.max(1, Math.min(7, Math.round((26 * it.vol * it.crowd) / (total || 1))));
      for (let j = 0; j < n; j++) {
        items.push({ id: it.k + j, group: it.group, d: it.d, dur: it.dur, begin: (-(j + 0.4 * (j % 2)) / n) * it.dur });
      }
    }
    return items;
  })();

  const CW = 118, CH = 24;
  const clusterPos = {
    NBOFF: { x: W - CW - 4, y: H - CH - 4 },
    SBOFF: { x: 4, y: 4 },
    EB: { x: 4, y: H - CH - 4 },
    WB: { x: W - CW - 4, y: 4 },
  };
</script>

<div class="dd-diagram">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label={form === 'Ddi' ? 'diverging diamond interchange, two signalized crossovers' : 'conventional diamond interchange, two signalized ramp terminals'}>

    <!-- ══ pavement ══ -->
    <rect x="0" y={cy - 28} width={W} height="56" class="dd-pavement" />
    {#each Object.values(stubs) as s}
      <polygon points={stubBand(s)} class="dd-pavement" />
    {/each}
    <!-- freeway carriageways cross over the arterial -->
    <rect x={cx - FWY - GAP / 2} y="0" width={FWY} height={H} class="dd-freeway" />
    <rect x={cx + GAP / 2} y="0" width={FWY} height={H} class="dd-freeway" />
    <line x1={cx - FWY - GAP / 2} y1="0" x2={cx - FWY - GAP / 2} y2={H} class="dd-edge" />
    <line x1={cx - GAP / 2} y1="0" x2={cx - GAP / 2} y2={H} class="dd-edge" />
    <line x1={cx + GAP / 2} y1="0" x2={cx + GAP / 2} y2={H} class="dd-edge" />
    <line x1={cx + FWY + GAP / 2} y1="0" x2={cx + FWY + GAP / 2} y2={H} class="dd-edge" />

    <!-- arterial edges and centerline (outside the freeway shadow) -->
    <line x1="0" y1={cy - 28} x2={cx - FWY - GAP / 2} y2={cy - 28} class="dd-edge" />
    <line x1={cx + FWY + GAP / 2} y1={cy - 28} x2={W} y2={cy - 28} class="dd-edge" />
    <line x1="0" y1={cy + 28} x2={cx - FWY - GAP / 2} y2={cy + 28} class="dd-edge" />
    <line x1={cx + FWY + GAP / 2} y1={cy + 28} x2={W} y2={cy + 28} class="dd-edge" />
    <line x1="0" y1={cy} x2={xW - 10} y2={cy} class="dd-center" />
    <line x1={xW + 10} y1={cy} x2={xE - 10} y2={cy} class="dd-center" />
    <line x1={xE + 10} y1={cy} x2={W} y2={cy} class="dd-center" />

    <!-- signalized terminal nodes -->
    <circle cx={xW} cy={cy} r="5" class="dd-signal" />
    <circle cx={xE} cy={cy} r="5" class="dd-signal" />

    <!-- ══ O-D movement paths ══ -->
    {#each Object.entries(P) as [letter, d]}
      {@const group = groupOf[letter.toLowerCase()]}
      {#if (volOf[letter.toLowerCase()] || 0) > 0}
        <path {d} class={`mv-${clsOf[group]} ${cls(hovered, group)}`} />
      {/if}
    {/each}

    <!-- ══ vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class="dd-veh veh-{clsOf[v.group]}" class:dim={hovered != null && hovered !== v.group}>
          <rect x="-4.5" y="-2.4" width="9" height="4.8" rx="1.4" />
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s" path={v.d} />
        </g>
      {/each}
    {/if}

    <!-- ══ grouped O-D editors ══ -->
    {#each editable ? GROUPS : [] as g (g.key)}
      <foreignObject x={clusterPos[g.key].x} y={clusterPos[g.key].y} width={CW} height={CH}>
        <div class="dd-cluster" xmlns="http://www.w3.org/1999/xhtml"
             on:mouseenter={() => (hovered = g.key)} on:mouseleave={() => (hovered = null)}>
          <span class="dd-cluster-title"><span class="swatch {g.cls}"></span>{g.key === 'NBOFF' ? 'NB' : g.key === 'SBOFF' ? 'SB' : g.key}</span>
          {#each g.ods as k}
            <input type="number" min="0" title="O-D {k.toUpperCase()} demand (veh/h)"
                   aria-label="O-D {k.toUpperCase()} demand"
                   value={volOf[k] ?? 0}
                   on:input={(e) => setOd(k, e.currentTarget.value)} />
          {/each}
        </div>
      </foreignObject>
    {/each}
  </svg>

  <div class="dd-legend" role="list">
    <button type="button" class="dd-chip dd-animate" class:active={animating}
            aria-pressed={animating} on:click={() => (animating = !animating)}>
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each GROUPS as g}
      <button
        type="button"
        role="listitem"
        class="dd-chip {g.cls}"
        class:active={hovered === g.key}
        on:mouseenter={() => (hovered = g.key)}
        on:mouseleave={() => (hovered = null)}
        on:focus={() => (hovered = g.key)}
        on:blur={() => (hovered = null)}
      >
        <span class="swatch {g.cls}"></span>
        {g.label}
      </button>
    {/each}
  </div>
  <p class="dd-note">O-D letters follow Exhibit 23-8: off-ramp lefts and rights, arterial turns onto the on-ramps, and the arterial throughs. Editors hold each group's O-D demands in letter order. Animated traffic slows per O-D LOS after a run. An illustration, not a simulation.</p>
</div>

<style>
  .dd-diagram svg {
    width: 100%;
    max-width: 560px;
    display: block;
    margin: 0 auto;
  }
  .dd-pavement { fill: var(--diag-pavement); }
  .dd-freeway { fill: var(--diag-pavement-alt); }
  .dd-edge { stroke: var(--diag-edge); stroke-width: 2; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .dd-center { stroke: var(--diag-center); stroke-width: 1.25; vector-effect: non-scaling-stroke; }
  .dd-signal { fill: var(--diag-center); stroke: var(--diag-edge); stroke-width: 1.25; }

  .dd-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.75;
  }
  .dd-move.dim { opacity: 0.08; }
  .dd-move.active { stroke-width: 4; opacity: 1; }
  .mv-nboff { stroke: #2563eb; }
  .mv-sboff { stroke: #16a34a; }
  .mv-ebg { stroke: #ea7317; }
  .mv-wbg { stroke: #dc2626; }
  .swatch.nboff { background: #2563eb; }
  .swatch.sboff { background: #16a34a; }
  .swatch.ebg { background: #ea7317; }
  .swatch.wbg { background: #dc2626; }

  .dd-veh rect { stroke: rgba(15, 23, 42, 0.35); stroke-width: 0.6; }
  .dd-veh { transition: opacity 120ms ease; }
  .dd-veh.dim { opacity: 0.08; }
  .veh-nboff rect { fill: #2563eb; }
  .veh-sboff rect { fill: #16a34a; }
  .veh-ebg rect { fill: #ea7317; }
  .veh-wbg rect { fill: #dc2626; }

  .dd-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
  .dd-chip {
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
  .dd-chip.active { border-color: var(--diag-edge); }
  .dd-animate { cursor: pointer; font-weight: 600; }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
  .dd-note { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.35rem; }

  .dd-cluster {
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
  .dd-cluster-title { display: inline-flex; align-items: center; gap: 2px; font-size: 7px; font-weight: 600; flex: none; }
  .dd-cluster input {
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
  .dd-cluster input::-webkit-outer-spin-button,
  .dd-cluster input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .dd-cluster input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
  .dd-cluster .swatch { width: 6px; height: 6px; }
</style>
