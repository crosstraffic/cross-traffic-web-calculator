<script>
  // Interactive plan view of a four-legged median U-turn intersection (HCM
  // Chapter 23 Part C, Exhibit 23-44, drawn with the main street north-south
  // to match Example Problem 15). No left turn is made at the main junction.
  // A left turner goes straight or right through the main junction, U-turns
  // at the crossover beyond it, comes back, and leaves on the leg it wanted,
  // which is why the four left turns are the long paths here. Twelve
  // movements are too many for twelve chips, so the legend groups them by
  // approach the way the diamond interchange groups its O-D letters; hover a
  // group to isolate its three paths, edit its demands on the picture, and
  // after a run each path takes its own movement LOS colour.
  import { LOS_COLORS } from './los.js';

  /**
   * @typedef {Object} Props
   * @property {any} [demands] - The twelve movement demands keyed nbl/nbt/nbr/sbl/... (veh/h).
   * @property {number} [dist] - Distance from the main junction to each U-turn crossover (ft).
   * @property {any} [losByMovement] - Per-movement LOS letters from the last run ({ nbl: 'E', ... }).
   * @property {boolean} [editable]
   */

  /** @type {Props} */
  let { demands = $bindable({}), dist = 600, losByMovement = {}, editable = true } = $props();

  let hovered = $state(null);

  const W = 480,
    H = 440;
  const LANE = 16;
  const GAP = 14; // raised median width
  const cx = 240,
    jy = 220; // main-street centreline, main junction
  const MINOR = 2 * LANE; // two lanes each way on the minor street

  const sbW = cx - GAP / 2 - 2 * LANE; // 201
  const sbE = cx - GAP / 2; // 233
  const nbW = cx + GAP / 2; // 247
  const nbE = cx + GAP / 2 + 2 * LANE; // 279
  const minN = jy - MINOR,
    minS = jy + MINOR;

  // Movement centerlines. Several movements legitimately share a lane, so
  // each gets its own offset within the carriageway; where two offsets are
  // equal the movements never occupy the same side of the main junction (a
  // right turn onto the southbound lanes and a southbound right turn out of
  // them, for instance), so the paths do not overlap.
  const SB_R = 205; // southbound right turn, north of the junction; EB right, south of it
  const SB_W = 212; // WB left returning south after the north crossover
  const SB_T = 219; // southbound through
  const SB_N = 226; // NB left returning south, north of the junction; EB left running south, below it
  const SB_L = 231; // southbound left running down to the south crossover
  const NB_L = 249; // northbound left running up to the north crossover
  const NB_S = 254; // SB left returning north, below the junction; WB left running north, above it
  const NB_E = 261; // EB left returning north after the south crossover
  const NB_T = 268; // northbound through
  const NB_R = 275; // northbound right turn, south of the junction; WB right, north of it

  // Minor-street centerlines, mirrored either side of the crown line.
  const eT = jy + 15,
    eL = jy + 22,
    eR = jy + 28; // eastbound through / left / right
  const wT = jy - 15,
    wL = jy - 22,
    wR = jy - 28; // westbound through / left / right

  const DIM_X = 322; // dimension line, clear of the pavement

  // The crossovers move with the dimensioned distance so the picture responds
  // to the input, clamped to what the canvas can show at either extreme.
  let sep = $derived(Math.min(160, Math.max(95, 85 + (Math.max(0, Number(dist) || 0) - 100) * 0.11)));
  let xyN = $derived(jy - sep),
    xyS = $derived(jy + sep);
  const OPEN = 20; // half-height of a crossover median opening

  let distLabel = $derived(`${Math.round(Number(dist) || 0).toLocaleString('en-US')} ft`);

  // Movement paths. Turns are quarter curves whose control point sits at the
  // intersection of the two lane centerlines, which keeps each curve inside
  // the pavement it turns across; each U-turn is a cubic whose control points
  // sit inside its median opening so the loop never crosses the island edge.
  let P = $derived({
    sbt: `M ${SB_T},0 L ${SB_T},${H}`,
    nbt: `M ${NB_T},${H} L ${NB_T},0`,
    sbr: `M ${SB_R},0 L ${SB_R},${jy - 44} Q ${SB_R},${wL} ${sbW - 18},${wL} L 0,${wL}`,
    nbr: `M ${NB_R},${H} L ${NB_R},${jy + 44} Q ${NB_R},${eR} ${nbE + 18},${eR} L ${W},${eR}`,
    ebt: `M 0,${eT} L ${W},${eT}`,
    wbt: `M ${W},${wT} L 0,${wT}`,
    ebr: `M 0,${eR} L ${sbW - 18},${eR} Q ${SB_R},${eR} ${SB_R},${jy + 44} L ${SB_R},${H}`,
    wbr: `M ${W},${wR} L ${nbE + 18},${wR} Q ${NB_R},${wR} ${NB_R},${jy - 44} L ${NB_R},0`,
    // North-crossover U-turns.
    nbl:
      `M ${NB_L},${H} L ${NB_L},${xyN + 14} C ${NB_L},${xyN - 14} ${SB_N},${xyN - 14} ${SB_N},${xyN + 14}` +
      ` L ${SB_N},${jy - 44} Q ${SB_N},${wR} ${sbW - 18},${wR} L 0,${wR}`,
    wbl:
      `M ${W},${wL} L ${nbE + 18},${wL} Q ${NB_S},${wL} ${NB_S},${jy - 44} L ${NB_S},${xyN + 14}` +
      ` C ${NB_S},${xyN - 20} ${SB_W},${xyN - 20} ${SB_W},${xyN + 14} L ${SB_W},${H}`,
    // South-crossover U-turns.
    sbl:
      `M ${SB_L},0 L ${SB_L},${xyS - 14} C ${SB_L},${xyS + 14} ${NB_S},${xyS + 14} ${NB_S},${xyS - 14}` +
      ` L ${NB_S},${jy + 44} Q ${NB_S},${eL} ${nbE + 18},${eL} L ${W},${eL}`,
    ebl:
      `M 0,${eL} L ${sbW - 18},${eL} Q ${SB_N},${eL} ${SB_N},${jy + 44} L ${SB_N},${xyS - 14}` +
      ` C ${SB_N},${xyS + 20} ${NB_E},${xyS + 20} ${NB_E},${xyS - 14} L ${NB_E},0`,
  });

  const GROUPS = [
    { key: 'NB', label: 'NB (L, T, R)', moves: ['nbl', 'nbt', 'nbr'], cls: 'nb' },
    { key: 'SB', label: 'SB (L, T, R)', moves: ['sbl', 'sbt', 'sbr'], cls: 'sb' },
    { key: 'EB', label: 'EB (L, T, R)', moves: ['ebl', 'ebt', 'ebr'], cls: 'eb' },
    { key: 'WB', label: 'WB (L, T, R)', moves: ['wbl', 'wbt', 'wbr'], cls: 'wb' },
  ];
  const groupOf = {
    nbl: 'NB',
    nbt: 'NB',
    nbr: 'NB',
    sbl: 'SB',
    sbt: 'SB',
    sbr: 'SB',
    ebl: 'EB',
    ebt: 'EB',
    ebr: 'EB',
    wbl: 'WB',
    wbt: 'WB',
    wbr: 'WB',
  };
  const GROUP_COLOR = { NB: '#2563eb', SB: '#16a34a', EB: '#ea7317', WB: '#dc2626' };
  const KEYS = Object.keys(groupOf);

  let volOf = $derived(Object.fromEntries(KEYS.map((k) => [k, Number(demands?.[k]) || 0])));
  let losOf = $derived(losByMovement || {});
  // After a run the path colour carries LOS instead of approach identity; the
  // chip keeps its approach swatch and lists the three letters instead, since
  // one swatch cannot stand for three different movement LOS values.
  let colorOf = $derived((k) => LOS_COLORS[losOf[k]] ?? GROUP_COLOR[groupOf[k]]);
  let chipLos = $derived((g) => {
    const letters = g.moves.map((k) => losOf[k]);
    return letters.every((x) => x) ? ` — LOS ${letters.join('/')}` : '';
  });

  let ariaLabel = $derived(
    'median U-turn intersection, four-legged, plan view. ' +
      'Main street north-south with two through lanes each way and a raised median, ' +
      'minor street east-west with both approaches, ' +
      `U-turn crossovers ${distLabel} north and south of the main junction. ` +
      'Every left turn is served by a crossover rather than at the main junction',
  );

  function setDemand(key, raw) {
    demands[key] = raw === '' ? '' : Number(raw);
  }

  function cls(key) {
    const los = losOf[key] ? ` los-${String(losOf[key]).toLowerCase()}` : '';
    const g = groupOf[key];
    if (hovered == null) return `mu-move mv-${key}${los}`;
    return `mu-move mv-${key}${los} ${hovered === g ? 'active' : 'dim'}`;
  }

  // ── illustrative traffic, per-movement LOS ──
  let animating = $state(false);
  const LOS_SPEED = { A: 1, B: 0.85, C: 0.7, D: 0.5, E: 0.32, F: 0.16 };
  const LOS_FLEET = { A: 1, B: 1, C: 1.1, D: 1.3, E: 1.7, F: 2.3 };
  let vehiclePlan = $derived(
    (() => {
      if (!animating) return [];
      const raw = [];
      let total = 0;
      for (const k of KEYS) {
        const vol = volOf[k];
        if (vol <= 0) continue;
        const slow = LOS_SPEED[losOf[k]] ?? 1;
        const crowd = LOS_FLEET[losOf[k]] ?? 1;
        raw.push({ k, d: P[k], vol, dur: 9 / slow, crowd });
        total += vol;
      }
      const items = [];
      for (const it of raw) {
        const n = Math.max(1, Math.min(6, Math.round((26 * it.vol * it.crowd) / (total || 1))));
        for (let j = 0; j < n; j++) {
          items.push({ id: it.k + j, key: it.k, d: it.d, dur: it.dur, begin: (-(j + 0.4 * (j % 2)) / n) * it.dur });
        }
      }
      return items;
    })(),
  );

  const CW = 116,
    CH = 24;
  const clusterPos = {
    SB: { x: 6, y: 6 },
    WB: { x: W - CW - 6, y: 6 },
    EB: { x: 6, y: H - CH - 6 },
    NB: { x: W - CW - 6, y: H - CH - 6 },
  };
</script>

<div class="mu-diagram">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>
    <!-- ══ pavement (fills only) ══ -->
    <rect x={sbW} y="0" width={nbE - sbW} height={H} class="mu-pavement" />
    <rect x="0" y={minN} width={W} height={minS - minN} class="mu-pavement" />

    <!-- raised median, broken at the main junction and at both crossovers -->
    {#each [[0, xyN - OPEN], [xyN + OPEN, minN], [minS, xyS - OPEN], [xyS + OPEN, H]] as [y0, y1]}
      <rect x={sbE} y={y0} width={nbW - sbE} height={Math.max(0, y1 - y0)} class="mu-island" />
      <line x1={sbE} y1={y0} x2={sbE} y2={y1} class="mu-island-edge" />
      <line x1={nbW} y1={y0} x2={nbW} y2={y1} class="mu-island-edge" />
    {/each}
    {#each [xyN - OPEN, xyN + OPEN, minN, minS, xyS - OPEN, xyS + OPEN] as yc}
      <line x1={sbE} y1={yc} x2={nbW} y2={yc} class="mu-island-edge" />
    {/each}

    <!-- ══ edges ══ -->
    <!-- main-street outer edges, opened where the minor street crosses -->
    {#each [[0, minN], [minS, H]] as [y0, y1]}
      <line x1={sbW} y1={y0} x2={sbW} y2={y1} class="mu-edge" />
      <line x1={nbE} y1={y0} x2={nbE} y2={y1} class="mu-edge" />
    {/each}
    <!-- minor-street edges, up to the main-street curb lines -->
    {#each [[0, sbW], [nbE, W]] as [x0, x1]}
      <line x1={x0} y1={minN} x2={x1} y2={minN} class="mu-edge" />
      <line x1={x0} y1={minS} x2={x1} y2={minS} class="mu-edge" />
    {/each}

    <!-- lane lines, broken across the junction and the crossover openings -->
    {#each [[0, xyN - OPEN], [xyN + OPEN, minN], [minS, xyS - OPEN], [xyS + OPEN, H]] as [y0, y1]}
      <line x1={sbW + LANE} y1={y0} x2={sbW + LANE} y2={y1} class="mu-lane-line" />
      <line x1={nbW + LANE} y1={y0} x2={nbW + LANE} y2={y1} class="mu-lane-line" />
    {/each}
    {#each [[0, sbW], [nbE, W]] as [x0, x1]}
      <line x1={x0} y1={minN + LANE} x2={x1} y2={minN + LANE} class="mu-lane-line" />
      <line x1={x0} y1={minS - LANE} x2={x1} y2={minS - LANE} class="mu-lane-line" />
      <line x1={x0} y1={jy} x2={x1} y2={jy} class="mu-center" />
    {/each}

    <!-- ══ control ══ -->
    <circle cx={sbE - 2} cy={jy} r="5" class="mu-signal" />
    <circle cx={nbW + 2} cy={jy} r="5" class="mu-signal" />
    {#each [xyN, xyS] as yc}
      <line x1={nbW - 1} y1={yc - OPEN} x2={nbW - 1} y2={yc + OPEN} class="mu-stop" />
    {/each}

    <!-- ══ movement paths ══ -->
    {#each KEYS as k (k)}
      {#if volOf[k] > 0}
        <path d={P[k]} class={cls(k)} style="stroke: {colorOf(k)}" />
      {/if}
    {/each}

    <!-- ══ vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class="mu-veh" class:dim={hovered != null && hovered !== groupOf[v.key]}>
          <rect x="-4.5" y="-2.4" width="9" height="4.8" rx="1.4" fill={colorOf(v.key)} />
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s" path={v.d} />
        </g>
      {/each}
    {/if}

    <!-- ══ annotation ══ -->
    <text x="6" y={minN - 14} class="mu-label">Minor street east-west, both approaches</text>
    <text x="6" y={minS + 16} class="mu-label">Main street north-south, two through lanes</text>
    <text x="6" y={minS + 28} class="mu-label">each way, raised median</text>
    <text x={sbW - 10} y={xyN - OPEN - 6} class="mu-label end">North U-turn crossover</text>
    <text x={sbW - 10} y={xyS + OPEN + 14} class="mu-label end">South U-turn crossover</text>
    <g class="mu-compass">
      <line x1={W - 26} y1={62} x2={W - 26} y2={38} class="mu-dim" />
      <polygon points="{W - 30},44 {W - 26},34 {W - 22},44" />
      <text x={W - 26} y="74" class="mu-label mid">N</text>
    </g>

    <!-- Crossover distances, dimensioned outside the main-street pavement.
         The extension lines are drawn only at the crossovers; the junction end
         is marked by a tick, which keeps a dashed line from running the width
         of the minor street. -->
    {#each [{ y0: xyN, y1: jy, ext: xyN }, { y0: jy, y1: xyS, ext: xyS }] as dm}
      <line x1={nbE + 4} y1={dm.ext} x2={DIM_X} y2={dm.ext} class="mu-ext" />
      <line x1={DIM_X} y1={dm.y0} x2={DIM_X} y2={dm.y1} class="mu-dim" />
      <line x1={DIM_X - 5} y1={dm.y0} x2={DIM_X + 5} y2={dm.y0} class="mu-dim" />
      <line x1={DIM_X - 5} y1={dm.y1} x2={DIM_X + 5} y2={dm.y1} class="mu-dim" />
      <text x={DIM_X + 7} y={(dm.y0 + dm.y1) / 2 + 3} class="mu-label">{distLabel}</text>
    {/each}

    <!-- ══ on-diagram demand editors ══ -->
    {#each editable ? GROUPS : [] as g (g.key)}
      <foreignObject x={clusterPos[g.key].x} y={clusterPos[g.key].y} width={CW} height={CH}>
        <div
          class="mu-cluster"
          xmlns="http://www.w3.org/1999/xhtml"
          onmouseenter={() => (hovered = g.key)}
          onmouseleave={() => (hovered = null)}
        >
          <span class="mu-cluster-title"><span class="swatch {g.cls}"></span>{g.key}</span>
          {#each g.moves as k}
            <input
              type="number"
              min="0"
              title="{k.toUpperCase()} demand (veh/h)"
              aria-label="{k.toUpperCase()} demand"
              value={volOf[k]}
              oninput={(e) => setDemand(k, e.currentTarget.value)}
            />
          {/each}
        </div>
      </foreignObject>
    {/each}
  </svg>

  <div class="mu-legend">
    <button
      type="button"
      class="mu-chip mu-animate"
      class:active={animating}
      aria-pressed={animating}
      onclick={() => (animating = !animating)}
    >
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each GROUPS as g (g.key)}
      <button
        type="button"
        class="mu-chip chip-{g.cls}"
        class:active={hovered === g.key}
        onmouseenter={() => (hovered = g.key)}
        onmouseleave={() => (hovered = null)}
        onfocus={() => (hovered = g.key)}
        onblur={() => (hovered = null)}
      >
        <span class="swatch {g.cls}"></span>
        {g.label}{chipLos(g)}
      </button>
    {/each}
  </div>
  <p class="mu-note">
    Left turns take the long way round: through or right at the main junction, U-turn at the crossover, then back to the
    leg they wanted, which is where their extra distance travel time comes from. Paths sharing a lane are drawn slightly
    apart to stay readable, and both crossovers track the dimensioned distance. Animated traffic slows per movement LOS
    after a run. An illustration, not a simulation.
  </p>
</div>

<style>
  .mu-diagram svg {
    width: 100%;
    max-width: 560px;
    display: block;
    margin: 0 auto;
  }
  .mu-pavement {
    fill: var(--diag-pavement);
  }
  .mu-island {
    fill: var(--diag-wall);
  }
  .mu-island-edge {
    stroke: var(--diag-wall-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .mu-edge {
    stroke: var(--diag-edge);
    stroke-width: 1.5;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .mu-center {
    stroke: var(--diag-center);
    stroke-width: 1.25;
    vector-effect: non-scaling-stroke;
  }
  .mu-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1.25;
    stroke-dasharray: 8 6;
    vector-effect: non-scaling-stroke;
  }
  .mu-stop {
    stroke: var(--diag-lane-line);
    stroke-width: 3.5;
    vector-effect: non-scaling-stroke;
  }
  .mu-signal {
    fill: var(--diag-center);
    stroke: var(--diag-edge);
    stroke-width: 1.25;
  }
  .mu-dim {
    stroke: var(--diag-dim);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .mu-ext {
    stroke: var(--diag-dim);
    stroke-width: 0.8;
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
  }
  .mu-compass polygon {
    fill: var(--diag-dim);
  }

  .mu-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition:
      opacity 120ms ease,
      stroke-width 120ms ease;
    opacity: 0.78;
  }
  .mu-move.dim {
    opacity: 0.07;
  }
  .mu-move.active {
    stroke-width: 3.5;
    opacity: 1;
  }

  .mu-veh rect {
    stroke: rgba(15, 23, 42, 0.35);
    stroke-width: 0.6;
  }
  .mu-veh {
    transition: opacity 120ms ease;
  }
  .mu-veh.dim {
    opacity: 0.07;
  }

  .mu-label {
    font-size: 9px;
    fill: var(--text-muted);
  }
  .mu-label.mid {
    text-anchor: middle;
  }
  .mu-label.end {
    text-anchor: end;
  }

  .mu-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .mu-chip {
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
  .mu-chip.active {
    border-color: var(--diag-edge);
  }
  .mu-animate {
    cursor: pointer;
    font-weight: 600;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
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
  .mu-note {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 0.35rem;
  }

  .mu-cluster {
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
  .mu-cluster-title {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 7px;
    font-weight: 600;
    flex: none;
  }
  .mu-cluster input {
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
  .mu-cluster input::-webkit-outer-spin-button,
  .mu-cluster input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .mu-cluster input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .mu-cluster .swatch {
    width: 6px;
    height: 6px;
  }
</style>
