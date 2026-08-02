<script>
  // Interactive plan view of a four-leg signalized intersection. The road
  // widths follow the lane inputs per approach and each approach's three
  // movements can be highlighted from the legend, so the volume, lane, and
  // phasing inputs have a picture.
  //
  // Right-hand traffic: the northbound approach occupies the east half of the
  // north-south street, southbound the west half, eastbound the south half of
  // the east-west street, westbound the north half. A left-turn path is drawn
  // dashed when the left runs permitted (no protected phase) and solid when a
  // protected phase is set.
  export let approaches = [];
  // False renders a read-only picture (no on-diagram volume editors), used by
  // the printable report.
  export let editable = true;

  let hovered = null; // 'NB' | 'SB' | 'EB' | 'WB' | null

  const LANE = 18;   // lane width, px
  const RUN = 110;   // approach leg length outside the intersection box, px

  const fallback = { ln_left: 1, ln_thru: 1, ln_right: 0, v_left: 0, v_thru: 0, v_right: 0, left_phase: 0 };
  $: byKey = Object.fromEntries((approaches || []).map((a) => [a.key, a]));
  $: ap = (key) => byKey[key] ?? fallback;
  $: nL = (key) => Math.max(0, Number(ap(key).ln_left) || 0);
  $: nT = (key) => Math.max(1, Number(ap(key).ln_thru) || 1);
  $: nR = (key) => Math.max(0, Number(ap(key).ln_right) || 0);
  $: lanes = (key) => nL(key) + nT(key) + nR(key);
  $: protectedLeft = (key) => (Number(ap(key).left_phase) || 0) > 0 && nL(key) > 0;

  // Half widths of each street, one per travel direction.
  $: wNB = lanes('NB') * LANE;
  $: wSB = lanes('SB') * LANE;
  $: wEB = lanes('EB') * LANE;
  $: wWB = lanes('WB') * LANE;

  $: cx = RUN + wSB;
  $: cy = RUN + wWB;
  $: W = RUN + wSB + wNB + RUN;
  $: H = RUN + wWB + wEB + RUN;

  // Box edges (where the legs meet the intersection).
  $: boxW = cx - wSB;
  $: boxE = cx + wNB;
  $: boxN = cy - wWB;
  $: boxS = cy + wEB;

  // Lane-center coordinate i lanes out from the centerline, per approach.
  $: xNB = (i) => cx + (i + 0.5) * LANE;
  $: xSB = (i) => cx - (i + 0.5) * LANE;
  $: yEB = (i) => cy + (i + 0.5) * LANE;
  $: yWB = (i) => cy - (i + 0.5) * LANE;

  // Source lane index per movement: lefts hug the centerline, rights the curb.
  // Without an exclusive lane the turn shares the nearest through lane, which
  // is the same index either way.
  $: iLeft = () => 0;
  $: iThru = (key) => nL(key) + Math.floor((nT(key) - 1) / 2);
  $: iRight = (key) => lanes(key) - 1;

  // Movement paths. Straight to the stop bar, then a quarter curve into the
  // innermost receiving lane (lefts) or the outermost one (rights).
  $: dThru = {
    NB: `M ${xNB(iThru('NB'))},${H} V 0`,
    SB: `M ${xSB(iThru('SB'))},0 V ${H}`,
    EB: `M 0,${yEB(iThru('EB'))} H ${W}`,
    WB: `M ${W},${yWB(iThru('WB'))} H 0`,
  };
  $: dLeft = {
    NB: `M ${xNB(iLeft('NB'))},${H} V ${boxS} Q ${xNB(iLeft('NB'))},${cy - LANE / 2} ${boxW},${cy - LANE / 2} H 0`,
    SB: `M ${xSB(iLeft('SB'))},0 V ${boxN} Q ${xSB(iLeft('SB'))},${cy + LANE / 2} ${boxE},${cy + LANE / 2} H ${W}`,
    EB: `M 0,${yEB(iLeft('EB'))} H ${boxW} Q ${cx + LANE / 2},${yEB(iLeft('EB'))} ${cx + LANE / 2},${boxN} V 0`,
    WB: `M ${W},${yWB(iLeft('WB'))} H ${boxE} Q ${cx - LANE / 2},${yWB(iLeft('WB'))} ${cx - LANE / 2},${boxS} V ${H}`,
  };
  $: dRight = {
    NB: `M ${xNB(iRight('NB'))},${H} V ${boxS} Q ${xNB(iRight('NB'))},${boxS - LANE / 2} ${boxE},${boxS - LANE / 2} H ${W}`,
    SB: `M ${xSB(iRight('SB'))},0 V ${boxN} Q ${xSB(iRight('SB'))},${boxN + LANE / 2} ${boxW},${boxN + LANE / 2} H 0`,
    EB: `M 0,${yEB(iRight('EB'))} H ${boxW} Q ${boxW + LANE / 2},${yEB(iRight('EB'))} ${boxW + LANE / 2},${boxS} V ${H}`,
    WB: `M ${W},${yWB(iRight('WB'))} H ${boxE} Q ${boxE - LANE / 2},${yWB(iRight('WB'))} ${boxE - LANE / 2},${boxN} V 0`,
  };

  const order = [
    { key: 'NB', label: 'Northbound' },
    { key: 'SB', label: 'Southbound' },
    { key: 'EB', label: 'Eastbound' },
    { key: 'WB', label: 'Westbound' },
  ];

  // On-diagram volume editors, one cluster per approach, placed in the free
  // corner beside that approach's leg.
  const CW = 104;
  const CH = 24;
  $: clusterPos = {
    NB: { x: boxE + 6, y: H - CH - 6 },
    SB: { x: boxW - CW - 6, y: 6 },
    EB: { x: 6, y: boxS + 6 },
    WB: { x: W - CW - 6, y: boxN - CH - 6 },
  };

  // Reassigning the array pushes the edit back through the two-way prop
  // binding so the form inputs follow the diagram.
  function touch() {
    approaches = approaches;
  }

  function cls(h, key) {
    if (h == null) return 'sd-move';
    return h === key ? 'sd-move active' : 'sd-move dim';
  }
</script>

<div class="signal-diagram">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label="four-leg signalized intersection">

    <!-- ══ pavement (fills only, edges drawn as lines) ══ -->
    <rect x={boxW} y="0" width={wSB + wNB} height={H} class="sd-pavement" />
    <rect x="0" y={boxN} width={W} height={wWB + wEB} class="sd-pavement" />

    <!-- ══ outer edges, interrupted across the intersection ══ -->
    <line x1={boxW} y1="0" x2={boxW} y2={boxN} class="sd-edge" />
    <line x1={boxW} y1={boxS} x2={boxW} y2={H} class="sd-edge" />
    <line x1={boxE} y1="0" x2={boxE} y2={boxN} class="sd-edge" />
    <line x1={boxE} y1={boxS} x2={boxE} y2={H} class="sd-edge" />
    <line x1="0" y1={boxN} x2={boxW} y2={boxN} class="sd-edge" />
    <line x1={boxE} y1={boxN} x2={W} y2={boxN} class="sd-edge" />
    <line x1="0" y1={boxS} x2={boxW} y2={boxS} class="sd-edge" />
    <line x1={boxE} y1={boxS} x2={W} y2={boxS} class="sd-edge" />

    <!-- ══ centerlines on the four legs ══ -->
    <line x1={cx} y1="0" x2={cx} y2={boxN} class="sd-center" />
    <line x1={cx} y1={boxS} x2={cx} y2={H} class="sd-center" />
    <line x1="0" y1={cy} x2={boxW} y2={cy} class="sd-center" />
    <line x1={boxE} y1={cy} x2={W} y2={cy} class="sd-center" />

    <!-- ══ lane lines on each directional half, both legs ══ -->
    {#each Array.from({ length: lanes('NB') - 1 }) as _, i}
      <line x1={cx + LANE * (i + 1)} y1={boxS} x2={cx + LANE * (i + 1)} y2={H} class="sd-lane-line" />
      <line x1={cx + LANE * (i + 1)} y1="0" x2={cx + LANE * (i + 1)} y2={boxN} class="sd-lane-line" />
    {/each}
    {#each Array.from({ length: lanes('SB') - 1 }) as _, i}
      <line x1={cx - LANE * (i + 1)} y1="0" x2={cx - LANE * (i + 1)} y2={boxN} class="sd-lane-line" />
      <line x1={cx - LANE * (i + 1)} y1={boxS} x2={cx - LANE * (i + 1)} y2={H} class="sd-lane-line" />
    {/each}
    {#each Array.from({ length: lanes('EB') - 1 }) as _, i}
      <line x1="0" y1={cy + LANE * (i + 1)} x2={boxW} y2={cy + LANE * (i + 1)} class="sd-lane-line" />
      <line x1={boxE} y1={cy + LANE * (i + 1)} x2={W} y2={cy + LANE * (i + 1)} class="sd-lane-line" />
    {/each}
    {#each Array.from({ length: lanes('WB') - 1 }) as _, i}
      <line x1={boxE} y1={cy - LANE * (i + 1)} x2={W} y2={cy - LANE * (i + 1)} class="sd-lane-line" />
      <line x1="0" y1={cy - LANE * (i + 1)} x2={boxW} y2={cy - LANE * (i + 1)} class="sd-lane-line" />
    {/each}

    <!-- ══ stop bars at each approach ══ -->
    <line x1={cx} y1={boxS + 2} x2={boxE} y2={boxS + 2} class="sd-stop" />
    <line x1={boxW} y1={boxN - 2} x2={cx} y2={boxN - 2} class="sd-stop" />
    <line x1={boxW - 2} y1={cy} x2={boxW - 2} y2={boxS} class="sd-stop" />
    <line x1={boxE + 2} y1={boxN} x2={boxE + 2} y2={cy} class="sd-stop" />

    <!-- ══ movement paths, one bundle per approach ══ -->
    {#each order as o}
      <path d={dThru[o.key]} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`} />
      <path d={dLeft[o.key]} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`}
            stroke-dasharray={protectedLeft(o.key) ? null : '6 5'} />
      <path d={dRight[o.key]} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`} />
    {/each}

    <!-- ══ on-diagram volume editors ══ -->
    {#each editable ? approaches || [] : [] as a (a.key)}
      {#if clusterPos[a.key]}
        <foreignObject x={clusterPos[a.key].x} y={clusterPos[a.key].y} width={CW} height={CH}>
          <div class="sd-cluster {a.key.toLowerCase()}" xmlns="http://www.w3.org/1999/xhtml"
               on:mouseenter={() => (hovered = a.key)} on:mouseleave={() => (hovered = null)}>
            <span class="sd-cluster-title"><span class="swatch {a.key.toLowerCase()}"></span>{a.key}</span>
            <input type="number" min="0" title="{a.key} left-turn volume (veh/h)" aria-label="{a.key} left-turn volume" bind:value={a.v_left} on:input={touch} />
            <input type="number" min="0" title="{a.key} through volume (veh/h)" aria-label="{a.key} through volume" bind:value={a.v_thru} on:input={touch} />
            <input type="number" min="0" title="{a.key} right-turn volume (veh/h)" aria-label="{a.key} right-turn volume" bind:value={a.v_right} on:input={touch} />
          </div>
        </foreignObject>
      {/if}
    {/each}
  </svg>

  <div class="sd-legend" role="list">
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="sd-chip {o.key.toLowerCase()}"
        class:active={hovered === o.key}
        on:mouseenter={() => (hovered = o.key)}
        on:mouseleave={() => (hovered = null)}
        on:focus={() => (hovered = o.key)}
        on:blur={() => (hovered = null)}
      >
        <span class="swatch {o.key.toLowerCase()}"></span>
        {o.label}: {Number(ap(o.key).v_left) || 0} / {Number(ap(o.key).v_thru) || 0} / {Number(ap(o.key).v_right) || 0} veh/h,
        {protectedLeft(o.key) ? 'protected left' : 'permitted left'}
      </button>
    {/each}
  </div>
  <p class="sd-note">Movement volumes are left / through / right. A dashed left-turn path runs permitted; a solid one has a protected phase.</p>
</div>

<style>
  .signal-diagram svg {
    width: 100%;
    max-width: 480px;
    display: block;
    margin: 0 auto;
  }
  .sd-pavement { fill: var(--diag-pavement); }
  .sd-edge {
    stroke: var(--diag-edge);
    stroke-width: 2;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .sd-center { stroke: var(--diag-center); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .sd-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1.5;
    stroke-dasharray: 8 6;
    vector-effect: non-scaling-stroke;
  }
  .sd-stop { stroke: var(--diag-lane-line); stroke-width: 3; vector-effect: non-scaling-stroke; }

  .sd-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.7;
  }
  .sd-move.dim { opacity: 0.1; }
  .sd-move.active { stroke-width: 4; opacity: 1; }
  .mv-nb { stroke: #2563eb; }
  .mv-sb { stroke: #16a34a; }
  .mv-eb { stroke: #ea7317; }
  .mv-wb { stroke: #dc2626; }
  .swatch.nb { background: #2563eb; }
  .swatch.sb { background: #16a34a; }
  .swatch.eb { background: #ea7317; }
  .swatch.wb { background: #dc2626; }

  .sd-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .sd-chip {
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
  .sd-chip.active { border-color: var(--diag-edge); }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
  .sd-note {
    font-size: 0.72rem;
    color: var(--diag-wall-edge);
    margin-top: 0.35rem;
  }

  .sd-cluster {
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
  .sd-cluster-title {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 7px;
    font-weight: 600;
    flex: none;
  }
  .sd-cluster input {
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
  .sd-cluster input::-webkit-outer-spin-button,
  .sd-cluster input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .sd-cluster input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
  .sd-cluster .swatch { width: 6px; height: 6px; }
</style>
