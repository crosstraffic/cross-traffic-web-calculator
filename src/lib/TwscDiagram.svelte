<script>
  // Interactive plan view of a two-way STOP-controlled intersection (HCM
  // Chapter 20). The major street runs east-west uncontrolled; the minor
  // street stops (stop bars drawn on the minor approaches only). Movement
  // paths carry the HCM rank in their dash pattern: rank 1 solid, rank 2
  // long dashes, rank 3 short dashes, rank 4 dotted, so the priority order
  // Chapter 20 computes from is visible on the picture.
  //
  // Movement numbering per Exhibit 20-1: v1/v2/v3 = EB L/T/R,
  // v4/v5/v6 = WB L/T/R, v7/v8/v9 = NB L/T/R, v10/v11/v12 = SB L/T/R.
  // On a three-leg (T) intersection the minor stem is the south leg (NB):
  // there is no north leg, so EB left, WB right, NB through, and the whole
  // SB approach do not exist.
  export let threeLeg = false;
  export let majorLanes = 1;
  export let rtEB = 'shared';
  export let rtWB = 'shared';
  export let minorNB = 'single_shared';
  export let minorSB = 'single_shared';
  export let v1 = 0, v2 = 0, v3 = 0;
  export let v4 = 0, v5 = 0, v6 = 0;
  export let v7 = 0, v8 = 0, v9 = 0;
  export let v10 = 0, v11 = 0, v12 = 0;
  // False renders a read-only picture, used by the printable report.
  export let editable = true;

  let hovered = null; // 'EB' | 'WB' | 'NB' | 'SB' | null

  const LANE = 18;
  const RUN = 110;

  const minorCount = (cfg) => ({ single_shared: 1, shared_lt_exclusive_r: 2, exclusive_l_shared_tr: 2, separate: 3 }[cfg] || 1);

  $: nEB = Math.max(1, Number(majorLanes) || 1) + (rtEB !== 'shared' ? 1 : 0);
  $: nWB = Math.max(1, Number(majorLanes) || 1) + (rtWB !== 'shared' ? 1 : 0);
  $: nNB = minorCount(minorNB);
  // On a T the west half of the stem only receives turning traffic.
  $: nSB = threeLeg ? 1 : minorCount(minorSB);

  $: wEB = nEB * LANE;
  $: wWB = nWB * LANE;
  $: wNB = nNB * LANE;
  $: wSB = nSB * LANE;

  $: cx = RUN + wSB;
  $: cy = RUN + wWB;
  $: W = RUN + wSB + wNB + RUN;
  $: H = RUN + wWB + wEB + RUN;

  $: boxW = cx - wSB;
  $: boxE = cx + wNB;
  $: boxN = cy - wWB;
  $: boxS = cy + wEB;

  // Lane centers i lanes out from the centerline.
  $: xNB = (i) => cx + (i + 0.5) * LANE;
  $: xSB = (i) => cx - (i + 0.5) * LANE;
  $: yEB = (i) => cy + (i + 0.5) * LANE;
  $: yWB = (i) => cy - (i + 0.5) * LANE;

  // Movement paths, keyed by approach then L/T/R. Lefts start at the
  // centerline lane, rights at the curb lane, throughs in the middle.
  $: dEB = {
    L: threeLeg ? null : `M 0,${yEB(0)} H ${boxW} Q ${cx + LANE / 2},${yEB(0)} ${cx + LANE / 2},${boxN} V 0`,
    T: `M 0,${yEB(Math.floor((nEB - 1) / 2))} H ${W}`,
    R: `M 0,${yEB(nEB - 1)} H ${boxW} Q ${boxW + LANE / 2},${yEB(nEB - 1)} ${boxW + LANE / 2},${boxS} V ${H}`,
  };
  $: dWB = {
    L: `M ${W},${yWB(0)} H ${boxE} Q ${cx - LANE / 2},${yWB(0)} ${cx - LANE / 2},${boxS} V ${H}`,
    T: `M ${W},${yWB(Math.floor((nWB - 1) / 2))} H 0`,
    R: threeLeg ? null : `M ${W},${yWB(nWB - 1)} H ${boxE} Q ${boxE - LANE / 2},${yWB(nWB - 1)} ${boxE - LANE / 2},${boxN} V 0`,
  };
  $: dNB = {
    L: `M ${xNB(0)},${H} V ${boxS} Q ${xNB(0)},${cy - LANE / 2} ${boxW},${cy - LANE / 2} H 0`,
    T: threeLeg ? null : `M ${xNB(Math.floor((nNB - 1) / 2))},${H} V 0`,
    R: `M ${xNB(nNB - 1)},${H} V ${boxS} Q ${xNB(nNB - 1)},${boxS - LANE / 2} ${boxE},${boxS - LANE / 2} H ${W}`,
  };
  $: dSB = threeLeg ? { L: null, T: null, R: null } : {
    L: `M ${xSB(0)},0 V ${boxN} Q ${xSB(0)},${cy + LANE / 2} ${boxE},${cy + LANE / 2} H ${W}`,
    T: `M ${xSB(Math.floor((nSB - 1) / 2))},0 V ${H}`,
    R: `M ${xSB(nSB - 1)},0 V ${boxN} Q ${xSB(nSB - 1)},${boxN + LANE / 2} ${boxW},${boxN + LANE / 2} H 0`,
  };

  // HCM Chapter 20 ranks (Exhibit 20-3). Three-leg: minor left is rank 3.
  $: rank = {
    EB: { L: 2, T: 1, R: 1 },
    WB: { L: 2, T: 1, R: 1 },
    NB: { L: threeLeg ? 3 : 4, T: 3, R: 2 },
    SB: { L: 4, T: 3, R: 2 },
  };
  const DASH = { 1: null, 2: '10 6', 3: '6 5', 4: '2 5' };

  $: paths = { EB: dEB, WB: dWB, NB: dNB, SB: dSB };
  $: vols = {
    EB: { L: v1, T: v2, R: v3 },
    WB: { L: v4, T: v5, R: v6 },
    NB: { L: v7, T: v8, R: v9 },
    SB: { L: v10, T: v11, R: v12 },
  };

  function setVol(ap, mv, raw) {
    const val = raw === '' ? '' : Number(raw);
    const assign = {
      EB: { L: () => (v1 = val), T: () => (v2 = val), R: () => (v3 = val) },
      WB: { L: () => (v4 = val), T: () => (v5 = val), R: () => (v6 = val) },
      NB: { L: () => (v7 = val), T: () => (v8 = val), R: () => (v9 = val) },
      SB: { L: () => (v10 = val), T: () => (v11 = val), R: () => (v12 = val) },
    };
    assign[ap][mv]();
  }

  $: order = [
    { key: 'EB', label: 'Eastbound (major)' },
    { key: 'WB', label: 'Westbound (major)' },
    { key: 'NB', label: 'Northbound (minor, STOP)' },
    ...(threeLeg ? [] : [{ key: 'SB', label: 'Southbound (minor, STOP)' }]),
  ];

  const CW = 104;
  const CH = 24;
  $: clusterPos = {
    NB: { x: boxE + 6, y: H - CH - 6 },
    SB: { x: boxW - CW - 6, y: 6 },
    EB: { x: 6, y: boxS + 6 },
    WB: { x: W - CW - 6, y: boxN - CH - 6 },
  };

  function cls(h, key) {
    if (h == null) return 'tw-move';
    return h === key ? 'tw-move active' : 'tw-move dim';
  }
</script>

<div class="twsc-diagram">
  <!-- A T-intersection has no north leg; crop the empty band above the road. -->
  <svg viewBox="0 {threeLeg ? boxN - 40 : 0} {W} {threeLeg ? H - boxN + 40 : H}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label={`${threeLeg ? 'three-leg' : 'four-leg'} two-way stop-controlled intersection`}>

    <!-- ══ pavement ══ -->
    <rect x={boxW} y={threeLeg ? boxN : 0} width={wSB + wNB} height={threeLeg ? H - boxN : H} class="tw-pavement" />
    <rect x="0" y={boxN} width={W} height={wWB + wEB} class="tw-pavement" />

    <!-- ══ outer edges ══ -->
    {#if !threeLeg}
      <line x1={boxW} y1="0" x2={boxW} y2={boxN} class="tw-edge" />
      <line x1={boxE} y1="0" x2={boxE} y2={boxN} class="tw-edge" />
    {/if}
    <line x1={boxW} y1={boxS} x2={boxW} y2={H} class="tw-edge" />
    <line x1={boxE} y1={boxS} x2={boxE} y2={H} class="tw-edge" />
    <line x1="0" y1={boxN} x2={threeLeg ? W : boxW} y2={boxN} class="tw-edge" />
    {#if !threeLeg}
      <line x1={boxE} y1={boxN} x2={W} y2={boxN} class="tw-edge" />
    {/if}
    <line x1="0" y1={boxS} x2={boxW} y2={boxS} class="tw-edge" />
    <line x1={boxE} y1={boxS} x2={W} y2={boxS} class="tw-edge" />

    <!-- ══ centerlines ══ -->
    <line x1="0" y1={cy} x2={boxW} y2={cy} class="tw-center" />
    <line x1={boxE} y1={cy} x2={W} y2={cy} class="tw-center" />
    {#if !threeLeg}
      <line x1={cx} y1="0" x2={cx} y2={boxN} class="tw-center" />
    {/if}
    <line x1={cx} y1={boxS} x2={cx} y2={H} class="tw-center" />

    <!-- ══ lane lines ══ -->
    {#each Array.from({ length: nEB - 1 }) as _, i}
      <line x1="0" y1={cy + LANE * (i + 1)} x2={boxW} y2={cy + LANE * (i + 1)} class="tw-lane-line" />
      <line x1={boxE} y1={cy + LANE * (i + 1)} x2={W} y2={cy + LANE * (i + 1)} class="tw-lane-line" />
    {/each}
    {#each Array.from({ length: nWB - 1 }) as _, i}
      <line x1="0" y1={cy - LANE * (i + 1)} x2={boxW} y2={cy - LANE * (i + 1)} class="tw-lane-line" />
      <line x1={boxE} y1={cy - LANE * (i + 1)} x2={W} y2={cy - LANE * (i + 1)} class="tw-lane-line" />
    {/each}
    {#each Array.from({ length: nNB - 1 }) as _, i}
      <line x1={cx + LANE * (i + 1)} y1={boxS} x2={cx + LANE * (i + 1)} y2={H} class="tw-lane-line" />
    {/each}
    {#if !threeLeg}
      {#each Array.from({ length: nSB - 1 }) as _, i}
        <line x1={cx - LANE * (i + 1)} y1="0" x2={cx - LANE * (i + 1)} y2={boxN} class="tw-lane-line" />
      {/each}
    {/if}

    <!-- ══ STOP bars on the minor approaches only ══ -->
    <line x1={cx} y1={boxS + 2} x2={boxE} y2={boxS + 2} class="tw-stop" />
    <text x={xNB(nNB - 1) + 4} y={boxS + 16} class="tw-stop-label">STOP</text>
    {#if !threeLeg}
      <line x1={boxW} y1={boxN - 2} x2={cx} y2={boxN - 2} class="tw-stop" />
      <text x={xSB(nSB - 1) - 4} y={boxN - 8} class="tw-stop-label" text-anchor="end">STOP</text>
    {/if}

    <!-- ══ movement paths, dash pattern by HCM rank ══ -->
    {#each order as o}
      {#each ['T', 'L', 'R'] as mv}
        {#if paths[o.key][mv]}
          <path d={paths[o.key][mv]} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`}
                stroke-dasharray={DASH[rank[o.key][mv]]} />
        {/if}
      {/each}
    {/each}

    <!-- ══ on-diagram volume editors ══ -->
    {#each editable ? order : [] as o (o.key)}
      {#if clusterPos[o.key]}
        <foreignObject x={clusterPos[o.key].x} y={clusterPos[o.key].y} width={CW} height={CH}>
          <div class="tw-cluster" xmlns="http://www.w3.org/1999/xhtml"
               on:mouseenter={() => (hovered = o.key)} on:mouseleave={() => (hovered = null)}>
            <span class="tw-cluster-title"><span class="swatch {o.key.toLowerCase()}"></span>{o.key}</span>
            {#each ['L', 'T', 'R'] as mv}
              <input type="number" min="0" title="{o.key} {mv} volume (veh/h)"
                     aria-label="{o.key} {mv === 'L' ? 'left-turn' : mv === 'T' ? 'through' : 'right-turn'} volume"
                     value={vols[o.key][mv]}
                     disabled={!paths[o.key][mv]}
                     on:input={(e) => setVol(o.key, mv, e.currentTarget.value)} />
            {/each}
          </div>
        </foreignObject>
      {/if}
    {/each}
  </svg>

  <div class="tw-legend" role="list">
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="tw-chip {o.key.toLowerCase()}"
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
  <p class="tw-note">The dash pattern shows the HCM rank: solid rank 1 (major through and right), long dashes rank 2 (major left, minor right), short dashes rank 3, dotted rank 4. Lower rank yields to everything above it.</p>
</div>

<style>
  .twsc-diagram svg {
    width: 100%;
    max-width: 480px;
    display: block;
    margin: 0 auto;
  }
  .tw-pavement { fill: var(--diag-pavement); }
  .tw-edge { stroke: var(--diag-edge); stroke-width: 2; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .tw-center { stroke: var(--diag-center); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .tw-lane-line { stroke: var(--diag-lane-line); stroke-width: 1.5; stroke-dasharray: 8 6; vector-effect: non-scaling-stroke; }
  .tw-stop { stroke: var(--diag-lane-line); stroke-width: 3; vector-effect: non-scaling-stroke; }
  .tw-stop-label { font-size: 8px; font-weight: 700; fill: var(--diag-dim); letter-spacing: 0.08em; }

  .tw-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.75;
  }
  .tw-move.dim { opacity: 0.1; }
  .tw-move.active { stroke-width: 4; opacity: 1; }
  .mv-eb { stroke: #ea7317; }
  .mv-wb { stroke: #dc2626; }
  .mv-nb { stroke: #2563eb; }
  .mv-sb { stroke: #16a34a; }
  .swatch.eb { background: #ea7317; }
  .swatch.wb { background: #dc2626; }
  .swatch.nb { background: #2563eb; }
  .swatch.sb { background: #16a34a; }

  .tw-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
  .tw-chip {
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
  .tw-chip.active { border-color: var(--diag-edge); }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
  .tw-note { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.35rem; }

  .tw-cluster {
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
  .tw-cluster-title {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 7px;
    font-weight: 600;
    flex: none;
  }
  .tw-cluster input {
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
  .tw-cluster input:disabled { opacity: 0.35; }
  .tw-cluster input::-webkit-outer-spin-button,
  .tw-cluster input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .tw-cluster input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
  .tw-cluster .swatch { width: 6px; height: 6px; }
</style>
