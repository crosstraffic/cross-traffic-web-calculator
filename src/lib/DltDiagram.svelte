<script>
  // Interactive plan view of a partial displaced left-turn intersection (HCM
  // Chapter 23 Part C, Exhibit 23-53). Three signals in a row on the major
  // street: the main intersection in the middle and a supplemental
  // intersection either side of it. A major-street left turner crosses the
  // opposing through lanes at its supplemental intersection, runs the rest of
  // the way on a separated roadway on the far side, and turns left at the main
  // intersection without ever conflicting with the opposing through movement.
  // The signals carry the same 1/2/3 numbering the form's delay table uses.
  //
  // Only the six movements the DLT geometry actually reshapes are drawn: the
  // two displaced lefts, the two major-street throughs, and the two
  // minor-street throughs that establish the crossing street. Isolating all
  // twelve was tried and dropped, because at this scale the minor-street turns
  // sit on top of the displaced-left roadways, which is the one relationship
  // the picture exists to show.
  import { LOS_COLORS } from './los.js';

  /**
   * @typedef {Object} Props
   * @property {number} [td] - Displaced left-turn roadway travel distance TD_DLT (ft).
   * @property {boolean} [full] - Full DLT (all four lefts displaced) rather than partial.
   * @property {any} [offset] - dlt_offset() result from the last run, for the annotation.
   * @property {string} [los] - Intersection LOS letter from the last run.
   */

  /** @type {Props} */
  let { td = 350, full = false, offset = null, los = '' } = $props();

  let hovered = $state(null);

  const W = 580,
    H = 340;
  const LANE = 16;
  const cy = 160,
    cxM = 290; // major-street crown, main intersection
  const MINOR = 2 * LANE; // two lanes each way on the minor street

  const medN = cy - 8,
    medS = cy + 8; // raised median
  const coreN = cy - 40,
    coreS = cy + 40;
  const sepN = cy - 46,
    sepS = cy + 46; // separator between DLT roadway and through lanes
  const bandN = cy - 62,
    bandS = cy + 62;
  const minW = cxM - MINOR,
    minE = cxM + MINOR;

  // Lane centerlines. Left turners approach in the inner lane and the through
  // movement is drawn one lane out so the two never share a line.
  const wbL = cy - 16,
    wbT = cy - 32;
  const ebL = cy + 16,
    ebT = cy + 32;
  const dltN = cy - 54,
    dltS = cy + 54; // the two displaced left-turn roadways
  const nbT = cxM + 22,
    sbT = cxM - 22; // minor-street through lanes
  const nbOut = cxM + 8,
    sbOut = cxM - 8; // departure lanes the displaced lefts land in

  // The supplemental intersections move with the dimensioned roadway distance,
  // clamped to what the canvas can show at either extreme.
  let sep = $derived(Math.min(190, Math.max(115, 105 + (Math.max(0, Number(td) || 0) - 100) * 0.2)));
  let xW = $derived(cxM - sep),
    xE = $derived(cxM + sep);

  let tdLabel = $derived(`${Math.round(Number(td) || 0).toLocaleString('en-US')} ft`);

  // Movement paths. The crossover is a single S-curve from the inner through
  // lane to the far-side roadway, drawn where the median and the separator are
  // both open, and the left turn at the main intersection is a quarter curve
  // whose control point sits on the departure lane centerline.
  let P = $derived({
    ebt: `M 0,${ebT} L ${W},${ebT}`,
    wbt: `M ${W},${wbT} L 0,${wbT}`,
    ebl:
      `M 0,${ebL} L ${xW - 36},${ebL}` +
      ` C ${xW - 4},${ebL} ${xW + 4},${dltN} ${xW + 36},${dltN}` +
      ` L ${cxM - 8},${dltN} Q ${nbOut},${dltN} ${nbOut},${bandN - 12} L ${nbOut},0`,
    wbl:
      `M ${W},${wbL} L ${xE + 36},${wbL}` +
      ` C ${xE + 4},${wbL} ${xE - 4},${dltS} ${xE - 36},${dltS}` +
      ` L ${cxM + 8},${dltS} Q ${sbOut},${dltS} ${sbOut},${bandS + 12} L ${sbOut},${H}`,
    nbt: `M ${nbT},${H} L ${nbT},0`,
    sbt: `M ${sbT},0 L ${sbT},${H}`,
  });

  const MOVES = [
    { key: 'ebl', label: 'EB left (displaced)' },
    { key: 'ebt', label: 'EB through' },
    { key: 'wbl', label: 'WB left (displaced)' },
    { key: 'wbt', label: 'WB through' },
    { key: 'nbt', label: 'NB through' },
    { key: 'sbt', label: 'SB through' },
  ];
  const BASE_COLOR = {
    ebl: '#2563eb',
    ebt: '#0891b2',
    wbl: '#dc2626',
    wbt: '#ea7317',
    nbt: '#16a34a',
    sbt: '#7c3aed',
  };

  // A DLT reports one intersection LOS rather than a LOS per movement
  // (Equation 23-69 is a single weighted average). Recolouring every path with
  // that one letter was tried and reverted: it turned the whole picture a
  // single colour and destroyed the movement distinctions without conveying
  // anything the badge does not already say. The paths keep their identity
  // colours, carry the LOS as a class, and the badge shows the letter.
  const colorOf = (k) => BASE_COLOR[k];
  let losColor = $derived(LOS_COLORS[los] ?? 'transparent');

  let ariaLabel = $derived(
    `${full ? 'full' : 'partial'} displaced left-turn intersection, plan view. ` +
      'Major street east-west through three signals: the main intersection with a ' +
      `supplemental intersection ${tdLabel} either side. ` +
      'The major-street left turns cross the opposing through lanes at the supplemental ' +
      'intersections and reach the main intersection on separated roadways on the far side',
  );

  function cls(key) {
    const losCls = los ? ` los-${String(los).toLowerCase()}` : '';
    if (hovered == null) return `dl-move mv-${key}${losCls}`;
    return `dl-move mv-${key}${losCls} ${hovered === key ? 'active' : 'dim'}`;
  }

  // ── illustrative traffic ──
  let animating = $state(false);
  const LOS_SPEED = { A: 1, B: 0.85, C: 0.7, D: 0.5, E: 0.32, F: 0.16 };
  let vehiclePlan = $derived(
    (() => {
      if (!animating) return [];
      const dur = 9 / (LOS_SPEED[los] ?? 1);
      const items = [];
      for (const m of MOVES) {
        for (let j = 0; j < 3; j++) {
          items.push({ id: m.key + j, key: m.key, d: P[m.key], dur, begin: (-j / 3) * dur });
        }
      }
      return items;
    })(),
  );
</script>

<div class="dl-diagram">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>
    <!-- ══ pavement (fills only) ══ -->
    <!-- through lanes and median, full width -->
    <rect x="0" y={coreN} width={W} height={coreS - coreN} class="dl-pavement" />
    <!-- displaced left-turn roadways. Each runs full depth from its crossover
         to the main intersection so the S-curve is never off pavement; the
         separator island is drawn over it further along. -->
    <rect x={xW - 36} y={bandN} width={minW - (xW - 36)} height={coreN - bandN} class="dl-pavement" />
    <rect x={minE} y={coreS} width={xE + 36 - minE} height={bandS - coreS} class="dl-pavement" />
    <!-- minor street -->
    <rect x={minW} y="0" width={minE - minW} height={H} class="dl-pavement" />

    <!-- raised median, broken at all three signals -->
    {#each [[0, xW - 30], [xW + 30, minW], [minE, xE - 30], [xE + 30, W]] as [x0, x1]}
      <rect x={x0} y={medN} width={Math.max(0, x1 - x0)} height={medS - medN} class="dl-island" />
      <line x1={x0} y1={medN} x2={x1} y2={medN} class="dl-island-edge" />
      <line x1={x0} y1={medS} x2={x1} y2={medS} class="dl-island-edge" />
    {/each}

    <!-- separators between each displaced left-turn roadway and the through
         lanes, starting clear of the crossover and ending at the junction -->
    <rect x={xW + 30} y={sepN} width={Math.max(0, minW - (xW + 30))} height={coreN - sepN} class="dl-island" />
    <line x1={xW + 30} y1={sepN} x2={minW} y2={sepN} class="dl-island-edge" />
    <rect x={minE} y={coreS} width={Math.max(0, xE - 30 - minE)} height={sepS - coreS} class="dl-island" />
    <line x1={minE} y1={sepS} x2={xE - 30} y2={sepS} class="dl-island-edge" />

    <!-- ══ edges ══ -->
    <!-- major-street outer edges, stepped out where a DLT roadway runs -->
    <line x1="0" y1={coreN} x2={xW - 36} y2={coreN} class="dl-edge" />
    <line x1={xW - 36} y1={bandN} x2={minW} y2={bandN} class="dl-edge" />
    <line x1={xW - 36} y1={bandN} x2={xW - 36} y2={coreN} class="dl-edge" />
    <line x1={minE} y1={coreN} x2={W} y2={coreN} class="dl-edge" />
    <line x1="0" y1={coreS} x2={minW} y2={coreS} class="dl-edge" />
    <line x1={minE} y1={bandS} x2={xE + 36} y2={bandS} class="dl-edge" />
    <line x1={xE + 36} y1={coreS} x2={xE + 36} y2={bandS} class="dl-edge" />
    <line x1={xE + 36} y1={coreS} x2={W} y2={coreS} class="dl-edge" />
    <!-- minor-street edges, up to the major-street curb lines -->
    <line x1={minW} y1="0" x2={minW} y2={bandN} class="dl-edge" />
    <line x1={minE} y1="0" x2={minE} y2={coreN} class="dl-edge" />
    <line x1={minW} y1={coreS} x2={minW} y2={H} class="dl-edge" />
    <line x1={minE} y1={bandS} x2={minE} y2={H} class="dl-edge" />

    <!-- lane lines, broken at the signals -->
    {#each [[0, xW - 30], [xW + 30, minW], [minE, xE - 30], [xE + 30, W]] as [x0, x1]}
      <line x1={x0} y1={cy - 24} x2={x1} y2={cy - 24} class="dl-lane-line" />
      <line x1={x0} y1={cy + 24} x2={x1} y2={cy + 24} class="dl-lane-line" />
    {/each}
    {#each [[0, bandN], [bandS, H]] as [y0, y1]}
      <line x1={cxM} y1={y0} x2={cxM} y2={y1} class="dl-center" />
      <line x1={cxM - LANE} y1={y0} x2={cxM - LANE} y2={y1} class="dl-lane-line" />
      <line x1={cxM + LANE} y1={y0} x2={cxM + LANE} y2={y1} class="dl-lane-line" />
    {/each}

    <!-- ══ movement paths ══ -->
    {#each MOVES as m (m.key)}
      <path d={P[m.key]} class={cls(m.key)} style="stroke: {colorOf(m.key)}" />
    {/each}

    <!-- ══ vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class="dl-veh" class:dim={hovered != null && hovered !== v.key}>
          <rect x="-4.5" y="-2.4" width="9" height="4.8" rx="1.4" fill={colorOf(v.key)} />
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s" path={v.d} />
        </g>
      {/each}
    {/if}

    <!-- ══ signals, numbered as the delay table numbers them ══ -->
    {#each [xW, cxM, xE] as sx, i}
      <circle cx={sx} {cy} r="8" class="dl-signal" />
      <text x={sx} y={cy + 3} class="dl-signal-num">{i + 1}</text>
    {/each}

    <!-- ══ annotation ══ -->
    <text x={(xW + cxM) / 2} y={bandN - 8} class="dl-label mid">Displaced EB left-turn roadway</text>
    <text x={(cxM + xE) / 2} y={bandS + 16} class="dl-label mid">Displaced WB left-turn roadway</text>

    <!-- TD_DLT dimension, above the west roadway and below the east one. Only
         the supplemental end carries an extension line; at the main
         intersection a tick does the job, which keeps a dashed line from
         running down the middle of the minor street. -->
    {#each [{ a: xW, b: cxM, y: 41, ext0: bandN - 20, ext1: 47 }, { a: cxM, b: xE, y: H - 30, ext0: bandS + 22, ext1: H - 36 }] as dm}
      <line x1={dm.a === cxM ? dm.b : dm.a} y1={dm.ext0} x2={dm.a === cxM ? dm.b : dm.a} y2={dm.ext1} class="dl-ext" />
      <line x1={dm.a} y1={dm.y} x2={dm.b} y2={dm.y} class="dl-dim" />
      <line x1={dm.a} y1={dm.y - 5} x2={dm.a} y2={dm.y + 5} class="dl-dim" />
      <line x1={dm.b} y1={dm.y - 5} x2={dm.b} y2={dm.y + 5} class="dl-dim" />
      <text x={(dm.a + dm.b) / 2} y={dm.y - 5} class="dl-label mid">{tdLabel}</text>
    {/each}

    <!-- Parked top-left, which is the only corner no path or dimension reaches
         at any clamp of the roadway distance. -->
    {#if offset}
      <text x="6" y="20" class="dl-label">
        TT_DLT {offset.tt_dlt_s.toFixed(1)} s · O_SUPP {offset.offset_supp_s.toFixed(1)} s
      </text>
    {/if}

    <g class="dl-compass">
      <line x1="26" y1={H - 16} x2="26" y2={H - 40} class="dl-dim" />
      <polygon points="22,{H - 34} 26,{H - 44} 30,{H - 34}" />
      <text x="26" y={H - 6} class="dl-label mid">N</text>
    </g>
  </svg>

  <div class="dl-legend">
    <button
      type="button"
      class="dl-chip dl-animate"
      class:active={animating}
      aria-pressed={animating}
      onclick={() => (animating = !animating)}
    >
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each MOVES as m (m.key)}
      <button
        type="button"
        class="dl-chip chip-{m.key}"
        class:active={hovered === m.key}
        onmouseenter={() => (hovered = m.key)}
        onmouseleave={() => (hovered = null)}
        onfocus={() => (hovered = m.key)}
        onblur={() => (hovered = null)}
      >
        <span class="swatch" style="background: {colorOf(m.key)}"></span>
        {m.label}
      </button>
    {/each}
    {#if los}
      <span class="dl-chip dl-los"
        ><span class="swatch" style="background: {losColor}"></span>Intersection LOS {los}</span
      >
    {/if}
  </div>
  <p class="dl-note">
    Signals 1, 2, and 3 are the west supplemental, main, and east supplemental intersections of the delay table below.
    {#if full}
      A full DLT displaces all four left turns; the two additional minor-street crossovers are not drawn, so read this
      as the major-street half of that configuration.
    {:else}
      A partial DLT displaces the major-street left turns only, so the minor-street left turns are still made at the
      main intersection.
    {/if}
    Major-street left turns are shielded by the through movements at the main intersection and are not modelled there. Equation
    23-69 reports one experienced travel time for the whole intersection rather than one per movement, so a run reports its
    LOS on the badge and leaves the paths in their own colours. An illustration, not a simulation.
  </p>
</div>

<style>
  .dl-diagram svg {
    width: 100%;
    max-width: 640px;
    display: block;
    margin: 0 auto;
  }
  .dl-pavement {
    fill: var(--diag-pavement);
  }
  .dl-island {
    fill: var(--diag-wall);
  }
  .dl-island-edge {
    stroke: var(--diag-wall-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .dl-edge {
    stroke: var(--diag-edge);
    stroke-width: 1.5;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .dl-center {
    stroke: var(--diag-center);
    stroke-width: 1.25;
    vector-effect: non-scaling-stroke;
  }
  .dl-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1.25;
    stroke-dasharray: 8 6;
    vector-effect: non-scaling-stroke;
  }
  .dl-signal {
    fill: var(--diag-center);
    stroke: var(--diag-edge);
    stroke-width: 1.5;
  }
  .dl-signal-num {
    font-size: 9px;
    font-weight: 700;
    text-anchor: middle;
    fill: var(--surface);
  }
  .dl-dim {
    stroke: var(--diag-dim);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .dl-ext {
    stroke: var(--diag-dim);
    stroke-width: 0.8;
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
  }
  .dl-compass polygon {
    fill: var(--diag-dim);
  }

  .dl-move {
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition:
      opacity 120ms ease,
      stroke-width 120ms ease;
    opacity: 0.8;
  }
  .dl-move.dim {
    opacity: 0.08;
  }
  .dl-move.active {
    stroke-width: 4;
    opacity: 1;
  }

  .dl-veh rect {
    stroke: rgba(15, 23, 42, 0.35);
    stroke-width: 0.6;
  }
  .dl-veh {
    transition: opacity 120ms ease;
  }
  .dl-veh.dim {
    opacity: 0.08;
  }

  .dl-label {
    font-size: 9px;
    fill: var(--text-muted);
  }
  .dl-label.mid {
    text-anchor: middle;
  }

  .dl-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .dl-chip {
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
  .dl-chip.active {
    border-color: var(--diag-edge);
  }
  .dl-animate {
    cursor: pointer;
    font-weight: 600;
  }
  .dl-los {
    font-weight: 600;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
  .dl-note {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 0.35rem;
  }
</style>
