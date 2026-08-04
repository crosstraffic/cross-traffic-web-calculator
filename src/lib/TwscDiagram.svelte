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
  
  
  // Minor-approach LOS letters from the last run ({ NB: 'B', SB: ... });
  
  /**
   * @typedef {Object} Props
   * @property {boolean} [threeLeg] - SB approach do not exist.
   * @property {number} [majorLanes]
   * @property {string} [rtEB]
   * @property {string} [rtWB]
   * @property {string} [minorNB]
   * @property {string} [minorSB]
   * @property {number} [v1]
   * @property {number} [v2]
   * @property {number} [v3]
   * @property {number} [v4]
   * @property {number} [v5]
   * @property {number} [v6]
   * @property {number} [v7]
   * @property {number} [v8]
   * @property {number} [v9]
   * @property {number} [v10]
   * @property {number} [v11]
   * @property {number} [v12]
   * @property {boolean} [editable] - False renders a read-only picture, used by the printable report.
   * @property {any} [approachLos] - minor traffic crawls and bunches with worse LOS, major flows free.
   */

  /** @type {Props} */
  let {
    threeLeg = false,
    majorLanes = 1,
    rtEB = 'shared',
    rtWB = 'shared',
    minorNB = 'single_shared',
    minorSB = 'single_shared',
    v1 = $bindable(0),
    v2 = $bindable(0),
    v3 = $bindable(0),
    v4 = $bindable(0),
    v5 = $bindable(0),
    v6 = $bindable(0),
    v7 = $bindable(0),
    v8 = $bindable(0),
    v9 = $bindable(0),
    v10 = $bindable(0),
    v11 = $bindable(0),
    v12 = $bindable(0),
    editable = true,
    approachLos = {}
  } = $props();

  let hovered = $state(null); // 'EB' | 'WB' | 'NB' | 'SB' | null

  const LANE = 18;
  const RUN = 110;

  const minorCount = (cfg) => ({ single_shared: 1, shared_lt_exclusive_r: 2, exclusive_l_shared_tr: 2, separate: 3 }[cfg] || 1);

  let nEB = $derived(Math.max(1, Number(majorLanes) || 1) + (rtEB !== 'shared' ? 1 : 0));
  let nWB = $derived(Math.max(1, Number(majorLanes) || 1) + (rtWB !== 'shared' ? 1 : 0));
  let nNB = $derived(minorCount(minorNB));
  // On a T the west half of the stem only receives turning traffic.
  let nSB = $derived(threeLeg ? 1 : minorCount(minorSB));

  let wEB = $derived(nEB * LANE);
  let wWB = $derived(nWB * LANE);
  let wNB = $derived(nNB * LANE);
  let wSB = $derived(nSB * LANE);

  let cx = $derived(RUN + wSB);
  let cy = $derived(RUN + wWB);
  let W = $derived(RUN + wSB + wNB + RUN);
  let H = $derived(RUN + wWB + wEB + RUN);

  let boxW = $derived(cx - wSB);
  let boxE = $derived(cx + wNB);
  let boxN = $derived(cy - wWB);
  let boxS = $derived(cy + wEB);

  // Lane centers i lanes out from the centerline.
  let xNB = $derived((i) => cx + (i + 0.5) * LANE);
  let xSB = $derived((i) => cx - (i + 0.5) * LANE);
  let yEB = $derived((i) => cy + (i + 0.5) * LANE);
  let yWB = $derived((i) => cy - (i + 0.5) * LANE);

  // Movement paths, keyed by approach then L/T/R. Lefts start at the
  // centerline lane, rights at the curb lane, throughs in the middle.
  let dEB = $derived({
    L: threeLeg ? null : `M 0,${yEB(0)} H ${boxW} Q ${cx + LANE / 2},${yEB(0)} ${cx + LANE / 2},${boxN} V 0`,
    T: `M 0,${yEB(Math.floor((nEB - 1) / 2))} H ${W}`,
    R: `M 0,${yEB(nEB - 1)} H ${boxW} Q ${boxW + LANE / 2},${yEB(nEB - 1)} ${boxW + LANE / 2},${boxS} V ${H}`,
  });
  let dWB = $derived({
    L: `M ${W},${yWB(0)} H ${boxE} Q ${cx - LANE / 2},${yWB(0)} ${cx - LANE / 2},${boxS} V ${H}`,
    T: `M ${W},${yWB(Math.floor((nWB - 1) / 2))} H 0`,
    R: threeLeg ? null : `M ${W},${yWB(nWB - 1)} H ${boxE} Q ${boxE - LANE / 2},${yWB(nWB - 1)} ${boxE - LANE / 2},${boxN} V 0`,
  });
  let dNB = $derived({
    L: `M ${xNB(0)},${H} V ${boxS} Q ${xNB(0)},${cy - LANE / 2} ${boxW},${cy - LANE / 2} H 0`,
    T: threeLeg ? null : `M ${xNB(Math.floor((nNB - 1) / 2))},${H} V 0`,
    R: `M ${xNB(nNB - 1)},${H} V ${boxS} Q ${xNB(nNB - 1)},${boxS - LANE / 2} ${boxE},${boxS - LANE / 2} H ${W}`,
  });
  let dSB = $derived(threeLeg ? { L: null, T: null, R: null } : {
    L: `M ${xSB(0)},0 V ${boxN} Q ${xSB(0)},${cy + LANE / 2} ${boxE},${cy + LANE / 2} H ${W}`,
    T: `M ${xSB(Math.floor((nSB - 1) / 2))},0 V ${H}`,
    R: `M ${xSB(nSB - 1)},0 V ${boxN} Q ${xSB(nSB - 1)},${boxN + LANE / 2} ${boxW},${boxN + LANE / 2} H 0`,
  });

  // HCM Chapter 20 ranks (Exhibit 20-3). Three-leg: minor left is rank 3.
  let rank = $derived({
    EB: { L: 2, T: 1, R: 1 },
    WB: { L: 2, T: 1, R: 1 },
    NB: { L: threeLeg ? 3 : 4, T: 3, R: 2 },
    SB: { L: 4, T: 3, R: 2 },
  });
  const DASH = { 1: null, 2: '10 6', 3: '6 5', 4: '2 5' };

  let paths = $derived({ EB: dEB, WB: dWB, NB: dNB, SB: dSB });
  let vols = $derived({
    EB: { L: v1, T: v2, R: v3 },
    WB: { L: v4, T: v5, R: v6 },
    NB: { L: v7, T: v8, R: v9 },
    SB: { L: v10, T: v11, R: v12 },
  });

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

  let order = $derived([
    { key: 'EB', label: 'Eastbound (major)' },
    { key: 'WB', label: 'Westbound (major)' },
    { key: 'NB', label: 'Northbound (minor, STOP)' },
    ...(threeLeg ? [] : [{ key: 'SB', label: 'Southbound (minor, STOP)' }]),
  ]);

  const CW = 104;
  const CH = 24;
  let clusterPos = $derived({
    NB: { x: boxE + 6, y: H - CH - 6 },
    SB: { x: boxW - CW - 6, y: 6 },
    EB: { x: 6, y: boxS + 6 },
    WB: { x: W - CW - 6, y: boxN - CH - 6 },
  });

  // ── illustrative traffic ── major streams run free (rank 1 yields to
  // nothing); minor streams slow and bunch with their computed LOS.
  let animating = $state(false);
  const LOS_SPEED = { A: 1, B: 0.85, C: 0.7, D: 0.5, E: 0.32, F: 0.16 };
  const LOS_FLEET = { A: 1, B: 1, C: 1.1, D: 1.3, E: 1.7, F: 2.3 };
  let vehiclePlan = $derived((() => {
    if (!animating) return [];
    const volsOf = { EB: [v1, v2, v3], WB: [v4, v5, v6], NB: [v7, v8, v9], SB: [v10, v11, v12] };
    const items = [];
    let total = 0;
    const raw = [];
    for (const o of order) {
      const minor = o.key === 'NB' || o.key === 'SB';
      const slow = minor ? (LOS_SPEED[approachLos?.[o.key]] ?? 0.8) : 1;
      const crowd = minor ? (LOS_FLEET[approachLos?.[o.key]] ?? 1) : 1;
      ['L', 'T', 'R'].forEach((mv, i) => {
        const vol = Number(volsOf[o.key][i]) || 0;
        const d = paths[o.key][mv];
        if (vol <= 0 || !d) return;
        raw.push({ key: o.key, d, vol, dur: (mv === 'T' ? 6 : 5) / slow, crowd });
        total += vol;
      });
    }
    for (const it of raw) {
      const n = Math.max(1, Math.min(7, Math.round((24 * it.vol * it.crowd) / (total || 1))));
      for (let k = 0; k < n; k++) {
        items.push({ id: it.key + it.d.length + k, key: it.key, d: it.d, dur: it.dur, begin: (-(k + 0.4 * (k % 2)) / n) * it.dur });
      }
    }
    return items;
  })());

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

    <!-- ══ illustrative vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class="tw-veh veh-{v.key.toLowerCase()}" class:dim={hovered != null && hovered !== v.key}>
          <rect x="-5" y="-2.6" width="10" height="5.2" rx="1.5" />
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s" path={v.d} />
        </g>
      {/each}
    {/if}

    <!-- ══ on-diagram volume editors ══ -->
    {#each editable ? order : [] as o (o.key)}
      {#if clusterPos[o.key]}
        <foreignObject x={clusterPos[o.key].x} y={clusterPos[o.key].y} width={CW} height={CH}>
          <div class="tw-cluster" xmlns="http://www.w3.org/1999/xhtml"
               onmouseenter={() => (hovered = o.key)} onmouseleave={() => (hovered = null)}>
            <span class="tw-cluster-title"><span class="swatch {o.key.toLowerCase()}"></span>{o.key}</span>
            {#each ['L', 'T', 'R'] as mv}
              <input type="number" min="0" title="{o.key} {mv} volume (veh/h)"
                     aria-label="{o.key} {mv === 'L' ? 'left-turn' : mv === 'T' ? 'through' : 'right-turn'} volume"
                     value={vols[o.key][mv]}
                     disabled={!paths[o.key][mv]}
                     oninput={(e) => setVol(o.key, mv, e.currentTarget.value)} />
            {/each}
          </div>
        </foreignObject>
      {/if}
    {/each}
  </svg>

  <div class="tw-legend" role="list">
    <button type="button" class="tw-chip tw-animate" class:active={animating}
            aria-pressed={animating} onclick={() => (animating = !animating)}>
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="tw-chip {o.key.toLowerCase()}"
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
  <p class="tw-note">The dash pattern shows the HCM rank: solid rank 1 (major through and right), long dashes rank 2 (major left, minor right), short dashes rank 3, dotted rank 4. Lower rank yields to everything above it. Animated traffic runs the major street free and, after a run, crawls the minor approaches by their LOS. An illustration, not a simulation.</p>
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
  .tw-veh rect { stroke: rgba(15, 23, 42, 0.35); stroke-width: 0.6; }
  .tw-veh { transition: opacity 120ms ease; }
  .tw-veh.dim { opacity: 0.08; }
  .veh-eb rect { fill: #ea7317; }
  .veh-wb rect { fill: #dc2626; }
  .veh-nb rect { fill: #2563eb; }
  .veh-sb rect { fill: #16a34a; }
  .tw-animate { cursor: pointer; font-weight: 600; }

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
