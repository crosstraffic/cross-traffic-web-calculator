<script>
  // Interactive plan view of a three-legged RCUT with STOP signs (HCM Chapter
  // 23 Part C, Exhibit 34-126). The major street runs north-south with two
  // through lanes each way and a raised median; the minor street tees in from
  // the west as an eastbound stem. The minor-street left is not made at the
  // main junction: it turns right onto the southbound carriageway, runs to the
  // U-turn crossover downstream, turns through the median opening and the loon
  // that gives it turning room, and comes back northbound. Each of the six
  // movements draws as a path, hover a chip to isolate one, edit its demand on
  // the picture, and after a run each path takes its movement LOS colour.
  import { LOS_COLORS } from './los.js';

  /**
   * @typedef {Object} Props
   * @property {any} [demands] - The six movement demands keyed ebl/ebr/nbl/nbt/sbt/sbr (veh/h).
   * @property {number} [dist] - Distance from the main junction to the U-turn crossover (ft).
   * @property {any} [losByMovement] - Per-movement LOS letters from the last run ({ ebl: 'E', ... }).
   * @property {boolean} [editable]
   */

  /** @type {Props} */
  let {
    demands = $bindable({ ebl: 0, ebr: 0, nbl: 0, nbt: 0, sbt: 0, sbr: 0 }),
    dist = 700,
    losByMovement = {},
    editable = true,
  } = $props();

  let hovered = $state(null);

  const W = 400,
    H = 330;
  const LANE = 14;
  const GAP = 12; // raised median width
  const cx = 200; // major-street centreline
  const jy = 88; // main junction centreline
  const STEM = LANE; // one lane each way on the minor stem

  // Carriageway edges. Southbound runs on the west half and northbound on the
  // east half, which is what puts the southbound lanes next to the stem and
  // makes the minor-street right turn the short one.
  const sbW = cx - GAP / 2 - 2 * LANE;
  const sbE = cx - GAP / 2;
  const nbW = cx + GAP / 2;
  const nbE = cx + GAP / 2 + 2 * LANE;

  const stemN = jy - STEM,
    stemS = jy + STEM;

  // Movement centerlines. Where two movements share a lane the paths are drawn
  // a few feet either side of the lane centre so neither disappears under the
  // other; the lane assignment itself is the operational one.
  const sbThru = cx - 30,
    sbRight = cx - 23,
    sbMedian = cx - 14;
  const nbLeft = cx + 13,
    nbThru = cx + 23,
    nbReturn = cx + 30;
  const stemL = jy + 4,
    stemR = jy + 10; // eastbound stem lane
  const outN = jy - 10,
    outS = jy - 4; // westbound stem lane
  const DIM_X = cx + 86; // clear of the loon

  // The crossover moves with the dimensioned distance so the picture responds
  // to the input, clamped to what the canvas can show at either extreme.
  let sep = $derived(Math.min(170, Math.max(100, 90 + (Math.max(0, Number(dist) || 0) - 100) * 0.11)));
  let xy = $derived(jy + sep);
  let openN = $derived(xy - 16),
    openS = $derived(xy + 16); // crossover median opening
  let loonN = $derived(xy - 26),
    loonS = $derived(xy + 26);

  let distLabel = $derived(`${Math.round(Number(dist) || 0).toLocaleString('en-US')} ft`);

  // Loon: a semicircular bulb on the far side of the northbound lanes, wide
  // enough for the U-turn swept path. Drawn as a fill and an open edge so the
  // mouth stays continuous with the carriageway.
  let loonFill = $derived(
    `M ${nbE},${loonN} L ${cx + 37},${loonN} A 26 26 0 0 1 ${cx + 37},${loonS} L ${nbE},${loonS} Z`,
  );
  let loonEdge = $derived(
    `M ${nbE},${loonN} L ${cx + 37},${loonN} A 26 26 0 0 1 ${cx + 37},${loonS} L ${nbE},${loonS}`,
  );

  // Movement paths. Turns are quarter curves whose corner control point sits
  // at the intersection of the two lane centerlines, which keeps every curve
  // inside the pavement it is turning across.
  let P = $derived({
    // Minor-street left: right onto southbound, out to the crossover, U-turn
    // through the median opening and the loon, back northbound.
    // Right onto the southbound median lane, left into the crossover, around
    // the loon far enough to swing back, then north. The loop is drawn as a
    // half turn to heading west inside the loon plus a quarter turn into the
    // northbound lane, which is the sequence the pavement is shaped for.
    ebl:
      `M 0,${stemL} L ${cx - 36},${stemL} Q ${sbMedian},${stemL} ${sbMedian},${jy + 26} L ${sbMedian},${xy - 26}` +
      ` Q ${sbMedian},${xy + 12} ${cx + 8},${xy + 12} L ${cx + 40},${xy + 12}` +
      ` C ${cx + 68},${xy + 12} ${cx + 68},${xy - 12} ${cx + 40},${xy - 12}` +
      ` Q ${nbReturn},${xy - 12} ${nbReturn},${xy - 34} L ${nbReturn},0`,
    ebr: `M 0,${stemR} L ${cx - 45},${stemR} Q ${sbRight},${stemR} ${sbRight},${jy + 32} L ${sbRight},${H}`,
    nbl: `M ${nbLeft},${H} L ${nbLeft},${jy + 28} C ${nbLeft},${jy + 8} ${cx + 5},${outN} ${cx - 17},${outN} L 0,${outN}`,
    nbt: `M ${nbThru},${H} L ${nbThru},0`,
    sbt: `M ${sbThru},0 L ${sbThru},${H}`,
    sbr: `M ${sbRight},0 L ${sbRight},${jy - 26} Q ${sbRight},${outS} ${cx - 45},${outS} L 0,${outS}`,
  });

  const MOVES = [
    { key: 'ebl', label: 'EB L (via crossover)', cls: 'ebl' },
    { key: 'ebr', label: 'EB R', cls: 'ebr' },
    { key: 'nbl', label: 'NB L', cls: 'nbl' },
    { key: 'nbt', label: 'NB T', cls: 'nbt' },
    { key: 'sbt', label: 'SB T', cls: 'sbt' },
    { key: 'sbr', label: 'SB R', cls: 'sbr' },
  ];
  const BASE_COLOR = {
    ebl: '#2563eb',
    ebr: '#0891b2',
    nbl: '#16a34a',
    nbt: '#65a30d',
    sbt: '#ea7317',
    sbr: '#dc2626',
  };

  let volOf = $derived(Object.fromEntries(MOVES.map((m) => [m.key, Number(demands?.[m.key]) || 0])));
  let losOf = $derived(losByMovement || {});
  // After a run the movement colour carries LOS instead of identity, and the
  // chip swatch follows so the legend never disagrees with the picture.
  let colorOf = $derived((k) => LOS_COLORS[losOf[k]] ?? BASE_COLOR[k]);

  let ariaLabel = $derived(
    'restricted crossing U-turn intersection, three-legged with STOP signs, plan view. ' +
      `Major street north-south with two through lanes each way, minor street eastbound stem from the west, ` +
      `U-turn crossover ${distLabel} south of the main junction`,
  );

  function setDemand(key, raw) {
    demands[key] = raw === '' ? '' : Number(raw);
  }

  function cls(key) {
    const los = losOf[key] ? ` los-${String(losOf[key]).toLowerCase()}` : '';
    if (hovered == null) return `rc-move mv-${key}${los}`;
    return `rc-move mv-${key}${los} ${hovered === key ? 'active' : 'dim'}`;
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
      for (const m of MOVES) {
        const vol = volOf[m.key];
        if (vol <= 0) continue;
        const slow = LOS_SPEED[losOf[m.key]] ?? 1;
        const crowd = LOS_FLEET[losOf[m.key]] ?? 1;
        raw.push({ key: m.key, d: P[m.key], vol, dur: 8 / slow, crowd });
        total += vol;
      }
      const items = [];
      for (const it of raw) {
        const n = Math.max(1, Math.min(7, Math.round((24 * it.vol * it.crowd) / (total || 1))));
        for (let j = 0; j < n; j++) {
          items.push({ id: it.key + j, key: it.key, d: it.d, dur: it.dur, begin: (-(j + 0.4 * (j % 2)) / n) * it.dur });
        }
      }
      return items;
    })(),
  );

  const CW = 104,
    CH = 24;
  const clusterPos = {
    EB: { x: 6, y: stemS + 18 },
    SB: { x: sbW - CW - 10, y: 6 },
    NB: { x: W - CW - 6, y: H - CH - 6 },
  };
  const CLUSTERS = [
    { key: 'EB', title: 'EB', moves: ['ebl', 'ebr'] },
    { key: 'SB', title: 'SB', moves: ['sbt', 'sbr'] },
    { key: 'NB', title: 'NB', moves: ['nbl', 'nbt'] },
  ];
</script>

<div class="rc-diagram">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>
    <!-- ══ pavement (fills only) ══ -->
    <rect x={sbW} y="0" width={nbE - sbW} height={H} class="rc-pavement" />
    <rect x="0" y={stemN} width={sbW} height={stemS - stemN} class="rc-pavement" />
    <path d={loonFill} class="rc-pavement" />

    <!-- raised median, broken at the main junction and the crossover -->
    <rect x={sbE} y="0" width={nbW - sbE} height={stemN} class="rc-island" />
    <rect x={sbE} y={stemS} width={nbW - sbE} height={openN - stemS} class="rc-island" />
    <rect x={sbE} y={openS} width={nbW - sbE} height={H - openS} class="rc-island" />

    <!-- ══ edges ══ -->
    <!-- major-street outer edges, opened for the stem and for the loon mouth -->
    <line x1={sbW} y1="0" x2={sbW} y2={stemN} class="rc-edge" />
    <line x1={sbW} y1={stemS} x2={sbW} y2={H} class="rc-edge" />
    <line x1={nbE} y1="0" x2={nbE} y2={loonN} class="rc-edge" />
    <line x1={nbE} y1={loonS} x2={nbE} y2={H} class="rc-edge" />
    <path d={loonEdge} class="rc-edge" fill="none" />

    <!-- minor stem edges, up to the major-street curb line -->
    <line x1="0" y1={stemN} x2={sbW} y2={stemN} class="rc-edge" />
    <line x1="0" y1={stemS} x2={sbW} y2={stemS} class="rc-edge" />

    <!-- median island edges and the two openings -->
    {#each [[0, stemN], [stemS, openN], [openS, H]] as [y0, y1]}
      <line x1={sbE} y1={y0} x2={sbE} y2={y1} class="rc-island-edge" />
      <line x1={nbW} y1={y0} x2={nbW} y2={y1} class="rc-island-edge" />
    {/each}
    {#each [stemN, stemS, openN, openS] as yc}
      <line x1={sbE} y1={yc} x2={nbW} y2={yc} class="rc-island-edge" />
    {/each}

    <!-- lane lines within each carriageway, broken across the junction -->
    {#each [[0, stemN], [stemS, H]] as [y0, y1]}
      <line x1={sbW + LANE} y1={y0} x2={sbW + LANE} y2={y1} class="rc-lane-line" />
      <line x1={nbW + LANE} y1={y0} x2={nbW + LANE} y2={y1} class="rc-lane-line" />
    {/each}
    <line x1="0" y1={jy} x2={cx - 46} y2={jy} class="rc-center" />

    <!-- ══ STOP control ══ -->
    <line x1={cx - 36} y1={jy} x2={cx - 36} y2={stemS} class="rc-stop" />
    <line x1={nbW - 2} y1={openN} x2={nbW - 2} y2={openS} class="rc-stop" />
    <text x={cx - 54} y={stemS + 12} class="rc-label end">STOP</text>

    <!-- ══ movement paths ══ -->
    {#each MOVES as m (m.key)}
      {#if volOf[m.key] > 0}
        <path d={P[m.key]} class={cls(m.key)} style="stroke: {colorOf(m.key)}" />
      {/if}
    {/each}

    <!-- ══ vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class="rc-veh" class:dim={hovered != null && hovered !== v.key}>
          <rect x="-4.5" y="-2.4" width="9" height="4.8" rx="1.4" fill={colorOf(v.key)} />
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s" path={v.d} />
        </g>
      {/each}
    {/if}

    <!-- ══ annotation ══ -->
    <text x="6" y={stemN - 6} class="rc-label">Minor street (eastbound stem)</text>
    <text x="6" y="158" class="rc-label">Major street north-south,</text>
    <text x="6" y="170" class="rc-label">two through lanes each way,</text>
    <text x="6" y="182" class="rc-label">raised median</text>
    <!-- Kept below the crossover so a short dimensioned distance cannot walk
         these lines up into the major-street annotation. -->
    <text x={sbW - 10} y={xy + 16} class="rc-label end">U-turn crossover</text>
    <text x={sbW - 10} y={xy + 28} class="rc-label end">STOP control, with loon</text>
    <g class="rc-compass">
      <line x1={W - 24} y1="42" x2={W - 24} y2="16" class="rc-dim" />
      <polygon points="{W - 28},22 {W - 24},12 {W - 20},22" />
      <text x={W - 24} y="54" class="rc-label mid">N</text>
    </g>

    <!-- crossover distance, dimensioned clear of the loon -->
    <line x1={nbE + 4} y1={jy} x2={DIM_X} y2={jy} class="rc-ext" />
    <line x1={cx + 66} y1={xy} x2={DIM_X} y2={xy} class="rc-ext" />
    <line x1={DIM_X} y1={jy} x2={DIM_X} y2={xy} class="rc-dim" />
    <line x1={DIM_X - 5} y1={jy} x2={DIM_X + 5} y2={jy} class="rc-dim" />
    <line x1={DIM_X - 5} y1={xy} x2={DIM_X + 5} y2={xy} class="rc-dim" />
    <text x={DIM_X + 8} y={(jy + xy) / 2 - 2} class="rc-label">{distLabel}</text>
    <text x={DIM_X + 8} y={(jy + xy) / 2 + 10} class="rc-label">to the crossover</text>

    <!-- ══ on-diagram demand editors ══ -->
    {#each editable ? CLUSTERS : [] as c (c.key)}
      <foreignObject x={clusterPos[c.key].x} y={clusterPos[c.key].y} width={CW} height={CH}>
        <div class="rc-cluster" xmlns="http://www.w3.org/1999/xhtml">
          <span class="rc-cluster-title">{c.title}</span>
          {#each c.moves as k}
            <input
              type="number"
              min="0"
              title="{k.toUpperCase()} demand (veh/h)"
              aria-label="{k.toUpperCase()} demand"
              value={volOf[k]}
              onmouseenter={() => (hovered = k)}
              onmouseleave={() => (hovered = null)}
              onfocus={() => (hovered = k)}
              onblur={() => (hovered = null)}
              oninput={(e) => setDemand(k, e.currentTarget.value)}
            />
          {/each}
        </div>
      </foreignObject>
    {/each}
  </svg>

  <div class="rc-legend">
    <button
      type="button"
      class="rc-chip rc-animate"
      class:active={animating}
      aria-pressed={animating}
      onclick={() => (animating = !animating)}
    >
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each MOVES as m (m.key)}
      <button
        type="button"
        class="rc-chip chip-{m.cls}"
        class:active={hovered === m.key}
        onmouseenter={() => (hovered = m.key)}
        onmouseleave={() => (hovered = null)}
        onfocus={() => (hovered = m.key)}
        onblur={() => (hovered = null)}
      >
        <span class="swatch" style="background: {colorOf(m.key)}"></span>
        {m.label}{losOf[m.key] ? ` — LOS ${losOf[m.key]}` : ''}
      </button>
    {/each}
  </div>
  <p class="rc-note">
    The minor-street left turn is served by the crossover rather than at the main junction, so it meets two
    STOP-controlled junctions and carries the extra distance travel time. Paths sharing a lane are drawn slightly apart
    to stay readable, and the crossover position tracks the dimensioned distance. Animated traffic slows per movement
    LOS after a run. An illustration, not a simulation.
  </p>
</div>

<style>
  .rc-diagram svg {
    width: 100%;
    max-width: 520px;
    display: block;
    margin: 0 auto;
  }
  .rc-pavement {
    fill: var(--diag-pavement);
  }
  .rc-island {
    fill: var(--diag-wall);
  }
  .rc-island-edge {
    stroke: var(--diag-wall-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .rc-edge {
    stroke: var(--diag-edge);
    stroke-width: 1.5;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .rc-center {
    stroke: var(--diag-center);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .rc-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1.25;
    stroke-dasharray: 8 6;
    vector-effect: non-scaling-stroke;
  }
  .rc-stop {
    stroke: var(--diag-lane-line);
    stroke-width: 3.5;
    vector-effect: non-scaling-stroke;
  }
  .rc-dim {
    stroke: var(--diag-dim);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .rc-ext {
    stroke: var(--diag-dim);
    stroke-width: 0.8;
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
  }
  .rc-compass polygon {
    fill: var(--diag-dim);
  }

  .rc-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition:
      opacity 120ms ease,
      stroke-width 120ms ease;
    opacity: 0.78;
  }
  .rc-move.dim {
    opacity: 0.08;
  }
  .rc-move.active {
    stroke-width: 4;
    opacity: 1;
  }

  .rc-veh rect {
    stroke: rgba(15, 23, 42, 0.35);
    stroke-width: 0.6;
  }
  .rc-veh {
    transition: opacity 120ms ease;
  }
  .rc-veh.dim {
    opacity: 0.08;
  }

  .rc-label {
    font-size: 9px;
    fill: var(--text-muted);
  }
  .rc-label.mid {
    text-anchor: middle;
  }
  .rc-label.end {
    text-anchor: end;
  }

  .rc-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .rc-chip {
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
  .rc-chip.active {
    border-color: var(--diag-edge);
  }
  .rc-animate {
    cursor: pointer;
    font-weight: 600;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
  .rc-note {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 0.35rem;
  }

  .rc-cluster {
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
  .rc-cluster-title {
    font-size: 7px;
    font-weight: 600;
    flex: none;
  }
  .rc-cluster input {
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
  .rc-cluster input::-webkit-outer-spin-button,
  .rc-cluster input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .rc-cluster input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
