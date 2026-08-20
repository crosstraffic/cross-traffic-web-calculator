<script>
  // Interactive plan view of a four-legged signalized RCUT (HCM Chapter 23 Part
  // C, Exhibit 34-131, drawn with the main street north-south to match Example
  // Problem 14). The main street is two separate carriageways either side of a
  // 40 ft median, so what reads as one intersection is four signalized
  // junctions: a U-turn crossover north of the minor street, the west main
  // intersection where the southbound carriageway meets it, the east main
  // intersection where the northbound carriageway meets it, and a second
  // U-turn crossover to the south. Major-street left turns are made at the
  // mains, crossing the median between the two signals. Minor-street left and
  // through movements are not: they turn right onto the near carriageway, run
  // to a crossover, U-turn through the loon, and come back, which is the
  // journey that earns them the extra distance travel time. Twelve movements
  // are too many for twelve chips, so the legend groups them by approach the
  // way the MUT does; hover a group to isolate its three paths, edit its
  // demands on the picture, and after a run each path takes its movement LOS
  // colour.
  import { LOS_COLORS } from './los.js';

  /**
   * @typedef {Object} Props
   * @property {any} [demands] - The twelve movement demands keyed nbl/nbt/nbr/sbl/... (veh/h).
   * @property {number} [dist] - Distance from the main intersections to each U-turn crossover (ft).
   * @property {any} [losByMovement] - Per-movement LOS letters from the last run ({ nbl: 'E', ... }).
   * @property {boolean} [editable]
   */

  /** @type {Props} */
  let { demands = $bindable({}), dist = 800, losByMovement = {}, editable = true } = $props();

  let hovered = $state(null);

  const W = 540,
    H = 560;
  const LANE = 16;
  const GAP = 40; // 40 ft median, wide enough to hold a left turn between the two mains
  const cx = 250,
    jy = 310; // median centreline, minor-street centreline

  const sbW = cx - GAP / 2 - 2 * LANE; // 198, west curb of the southbound carriageway
  const sbE = cx - GAP / 2; // 230
  const nbW = cx + GAP / 2; // 270
  const nbE = cx + GAP / 2 + 2 * LANE; // 302, east curb of the northbound carriageway
  const bayW = sbW - LANE; // 182, exclusive right-turn bay on the southbound approach
  const bayE = nbE + LANE; // 318, and on the northbound approach
  const MINOR = 2 * LANE; // two lanes each way on the minor street
  const minN = jy - MINOR,
    minS = jy + MINOR;

  const OPEN = 36; // half-length of a crossover median opening
  const LOON = 42; // loon radius, sized to wrap the swept U-turn path rather than to look decorative
  const BAY = 70; // right-turn bay, 40 of full width plus a 30 taper. Kept short so its
  // taper never runs into the crossover loon at the closest spacing the input allows.
  const DIM_X = 130; // both dimension lines run down the west side, clear of the north loon

  // The crossovers move with the dimensioned distance so the picture responds
  // to the input, clamped to what the canvas can show at either extreme.
  let sep = $derived(Math.min(200, Math.max(165, 138 + (Math.max(0, Number(dist) || 0) - 100) * 0.046)));
  let xyN = $derived(jy - sep),
    xyS = $derived(jy + sep);

  let distLabel = $derived(`${Math.round(Number(dist) || 0).toLocaleString('en-US')} ft`);

  // Loons: a bulb on the far side of the receiving carriageway. The north
  // crossover turns northbound traffic back southbound, so its loon sits west
  // of the southbound curb; the south crossover is the mirror. Drawn as a fill
  // and an open edge so the mouth stays continuous with the carriageway.
  let loonNFill = $derived(`M ${sbW},${xyN - LOON} A ${LOON} ${LOON} 0 0 0 ${sbW},${xyN + LOON} Z`);
  let loonNEdge = $derived(`M ${sbW},${xyN - LOON} A ${LOON} ${LOON} 0 0 0 ${sbW},${xyN + LOON}`);
  let loonSFill = $derived(`M ${nbE},${xyS - LOON} A ${LOON} ${LOON} 0 0 1 ${nbE},${xyS + LOON} Z`);
  let loonSEdge = $derived(`M ${nbE},${xyS - LOON} A ${LOON} ${LOON} 0 0 1 ${nbE},${xyS + LOON}`);

  // Movement centerlines. Several movements legitimately share a lane, so each
  // gets its own offset within the carriageway; where two offsets are equal the
  // movements never occupy the same side of a junction, so the paths do not
  // overlap. Southbound runs on the west carriageway and northbound on the east.
  // Southbound carriageway, curb side first. A movement about to turn right
  // sits curb side and one about to cross the median sits inner, which is what
  // decides these offsets; where two share a value they never share a segment.
  const SBR = 201,
    SBR_BAY = 187; // southbound right, moving into its bay before the west main
  const SBT = 208; // southbound through
  const WBT_S = 214,
    WBT_BAY = 193; // WB through, back from the crossover and out of the bay
  const WBL_S = 221; // WB left, back from the crossover and on south
  const SBL = 227; // southbound left, inner lane to the median
  const EBR_S = 201; // EB right, running south out of the west main
  const EBL_S = 214,
    EBT_S = 227; // EB left and through, running south to the crossover

  // Northbound carriageway, the mirror, curb side last.
  const NBL = 273; // northbound left, inner lane to the median
  const EBL_N = 279,
    EBT_N = 286; // EB left and through, back from the crossover
  const NBT = 292; // northbound through
  const NBR = 299,
    NBR_BAY = 308; // northbound right, moving into its bay before the east main
  const EBT_BAY = 314; // EB through, right out of the bay at the east main
  const WBL_N = 273,
    WBT_N = 286; // WB left and through, running north to the crossover
  const WBR_N = 299; // WB right, running north out of the east main

  // Minor-street centerlines, entering movements on the near half and exiting
  // movements on the far half of each leg.
  const ebl = jy + 9,
    ebt = jy + 17,
    ebr = jy + 25; // eastbound approach, from the west
  const wbl = jy - 9,
    wbt = jy - 17,
    wbr = jy - 25; // westbound approach, from the east
  const outW_sbr = jy - 9,
    outW_wbt = jy - 17,
    outW_nbl = jy - 23; // west leg departures
  const outE_sbl = jy + 8,
    outE_ebt = jy + 17,
    outE_nbr = jy + 25; // east leg departures

  // Movement paths. Turns are quarter curves whose control point sits at the
  // intersection of the two lane centerlines, which keeps each curve inside the
  // pavement it turns across. Each U-turn is a teardrop of two cubics rather
  // than a half-circle: the vehicle swings past the far curb into the loon and
  // comes back into the receiving lane, which is the swept path the loon exists
  // to provide. A half-circle between the two inner lanes would fit on the page
  // but would imply a turning radius the 40 ft median does not give a
  // single-lane crossover.
  let P = $derived({
    sbt: `M ${SBT},0 L ${SBT},${H}`,
    nbt: `M ${NBT},${H} L ${NBT},0`,

    // Southbound right: into the bay, then right out of the west main.
    sbr:
      `M ${SBR},0 L ${SBR},${minN - 58} C ${SBR},${minN - 46} ${SBR_BAY},${minN - 46} ${SBR_BAY},${minN - 30}` +
      ` L ${SBR_BAY},${minN - 7} Q ${SBR_BAY},${outW_sbr} ${sbW - 40},${outW_sbr} L 0,${outW_sbr}`,
    // Northbound right: the mirror, out of the east main.
    nbr:
      `M ${NBR},${H} L ${NBR},${minS + 58} C ${NBR},${minS + 46} ${NBR_BAY},${minS + 46} ${NBR_BAY},${minS + 30}` +
      ` L ${NBR_BAY},${minS + 7} Q ${NBR_BAY},${outE_nbr} ${nbE + 40},${outE_nbr} L ${W},${outE_nbr}`,

    // Major-street lefts are made at the mains. They turn at one signal, wait
    // in the median, and cross the other carriageway at the second signal,
    // which is why Exhibit 34-132 books their delay at the far main.
    sbl: `M ${SBL},0 L ${SBL},${minN + 10} Q ${SBL},${outE_sbl} ${SBL + 30},${outE_sbl} L ${W},${outE_sbl}`,
    nbl:
      `M ${NBL},${H} L ${NBL},${minS - 10} Q ${NBL},${outW_nbl + 14} ${NBL - 30},${outW_nbl + 14}` +
      ` L ${sbE - 4},${outW_nbl + 14} C ${sbE - 20},${outW_nbl + 14} ${sbW + 10},${outW_nbl} ${sbW - 4},${outW_nbl} L 0,${outW_nbl}`,

    // Minor-street rights are the only minor movement served at a main.
    ebr: `M 0,${ebr} L ${sbW - 18},${ebr} Q ${EBR_S},${ebr} ${EBR_S},${ebr + 30} L ${EBR_S},${H}`,
    wbr: `M ${W},${wbr} L ${nbE + 42},${wbr} Q ${WBR_N},${wbr} ${WBR_N},${wbr - 30} L ${WBR_N},0`,

    // Minor-street left and through: right onto the near carriageway, out to
    // the crossover, a teardrop through the loon, back up the far carriageway,
    // and off at the leg they wanted. The eastbound pair uses the south
    // crossover, the westbound pair the north one. Each teardrop nests inside
    // the other so the two swept paths at one crossover never cross.
    ebl:
      `M 0,${ebl} L ${sbW - 18},${ebl} Q ${EBL_S},${ebl} ${EBL_S},${ebl + 42} L ${EBL_S},${xyS}` +
      ` C ${EBL_S},${xyS + 40} 328,${xyS + 40} 328,${xyS}` +
      ` C 328,${xyS - 30} ${EBL_N},${xyS - 22} ${EBL_N},${xyS - 52} L ${EBL_N},0`,
    ebt:
      `M 0,${ebt} L ${sbW - 18},${ebt} Q ${EBT_S},${ebt} ${EBT_S},${ebt + 42} L ${EBT_S},${xyS - 8}` +
      ` C ${EBT_S},${xyS + 36} 332,${xyS + 36} 332,${xyS - 8}` +
      ` C 332,${xyS - 34} ${EBT_N},${xyS - 24} ${EBT_N},${xyS - 56} L ${EBT_N},${minS + 70}` +
      ` C ${EBT_N},${minS + 45} ${EBT_BAY},${minS + 45} ${EBT_BAY},${minS + 7}` +
      ` Q ${EBT_BAY},${outE_ebt} ${EBT_BAY + 20},${outE_ebt} L ${W},${outE_ebt}`,
    wbl:
      `M ${W},${wbl} L ${nbE + 42},${wbl} Q ${WBL_N},${wbl} ${WBL_N},${wbl - 30} L ${WBL_N},${xyN}` +
      ` C ${WBL_N},${xyN - 40} 172,${xyN - 40} 172,${xyN}` +
      ` C 172,${xyN + 30} ${WBL_S},${xyN + 22} ${WBL_S},${xyN + 52} L ${WBL_S},${H}`,
    wbt:
      `M ${W},${wbt} L ${nbE + 42},${wbt} Q ${WBT_N},${wbt} ${WBT_N},${wbt - 30} L ${WBT_N},${xyN + 8}` +
      ` C ${WBT_N},${xyN - 36} 168,${xyN - 36} 168,${xyN + 8}` +
      ` C 168,${xyN + 38} ${WBT_S},${xyN + 28} ${WBT_S},${xyN + 60} L ${WBT_S},${minN - 70}` +
      ` C ${WBT_S},${minN - 45} ${WBT_BAY},${minN - 45} ${WBT_BAY},${minN - 7}` +
      ` Q ${WBT_BAY},${outW_wbt} ${WBT_BAY - 20},${outW_wbt} L 0,${outW_wbt}`,
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
    'restricted crossing U-turn intersection, four-legged with signals, plan view. ' +
      'Main street north-south on two separate carriageways either side of a 40 foot median, ' +
      'minor street east-west with two lanes on each approach. ' +
      'Four signalized junctions: the west main intersection on the southbound carriageway, ' +
      'the east main intersection on the northbound carriageway, ' +
      `and U-turn crossovers with loons ${distLabel} north and south of them. ` +
      'Minor-street left and through movements are served by a crossover rather than at a main intersection',
  );

  function setDemand(key, raw) {
    demands[key] = raw === '' ? '' : Number(raw);
  }

  function cls(key) {
    const los = losOf[key] ? ` los-${String(losOf[key]).toLowerCase()}` : '';
    const g = groupOf[key];
    if (hovered == null) return `rs-move mv-${key}${los}`;
    return `rs-move mv-${key}${los} ${hovered === g ? 'active' : 'dim'}`;
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
        raw.push({ k, d: P[k], vol, dur: 10 / slow, crowd });
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

  // Signal heads. The two crossover signals stand on the median island between
  // the carriageways; the two main-intersection signals stand outside the curb
  // of the carriageway each one controls.
  let SIGNALS = $derived([
    { x: cx - 4, y: xyN - OPEN - 22, title: 'North U-turn crossover signal' },
    { x: cx - 4, y: Math.min(H - 21, xyS + OPEN + 6), title: 'South U-turn crossover signal' },
    { x: sbW - 34, y: minS + 8, title: 'West main intersection signal' },
    { x: nbE + 22, y: minN - 26, title: 'East main intersection signal' },
  ]);

  const CW = 116,
    CH = 24;
  const clusterPos = {
    SB: { x: 6, y: 6 },
    WB: { x: W - CW - 6, y: 6 },
    EB: { x: 6, y: H - CH - 6 },
    NB: { x: W - CW - 6, y: H - CH - 6 },
  };
</script>

<div class="rs-diagram">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>
    <!-- ══ pavement (fills only) ══ -->
    <rect x={sbW} y="0" width={nbE - sbW} height={H} class="rs-pavement" />
    <rect x="0" y={minN} width={W} height={minS - minN} class="rs-pavement" />
    <!-- exclusive right-turn bays at the main intersections, one each direction -->
    <path d="M {sbW},{minN} L {bayW},{minN} L {bayW},{minN - BAY + 30} L {sbW},{minN - BAY} Z" class="rs-pavement" />
    <path d="M {nbE},{minS} L {bayE},{minS} L {bayE},{minS + BAY - 30} L {nbE},{minS + BAY} Z" class="rs-pavement" />
    <path d={loonNFill} class="rs-pavement" />
    <path d={loonSFill} class="rs-pavement" />

    <!-- raised median, broken at the minor street and at both crossovers -->
    {#each [[0, xyN - OPEN], [xyN + OPEN, minN], [minS, xyS - OPEN], [xyS + OPEN, H]] as [y0, y1]}
      <rect x={sbE} y={y0} width={nbW - sbE} height={Math.max(0, y1 - y0)} class="rs-island" />
      <line x1={sbE} y1={y0} x2={sbE} y2={y1} class="rs-island-edge" />
      <line x1={nbW} y1={y0} x2={nbW} y2={y1} class="rs-island-edge" />
    {/each}
    {#each [xyN - OPEN, xyN + OPEN, minN, minS, xyS - OPEN, xyS + OPEN] as yc}
      <line x1={sbE} y1={yc} x2={nbW} y2={yc} class="rs-island-edge" />
    {/each}

    <!-- ══ edges ══ -->
    <!-- west curb of the southbound carriageway, opened for the loon and the bay -->
    <line x1={sbW} y1="0" x2={sbW} y2={xyN - LOON} class="rs-edge" />
    <path d={loonNEdge} class="rs-edge" fill="none" />
    <line x1={sbW} y1={xyN + LOON} x2={sbW} y2={minN - BAY} class="rs-edge" />
    <path d="M {sbW},{minN - BAY} L {bayW},{minN - BAY + 30} L {bayW},{minN}" class="rs-edge" fill="none" />
    <line x1={sbW} y1={minS} x2={sbW} y2={H} class="rs-edge" />
    <!-- east curb of the northbound carriageway, the mirror -->
    <line x1={nbE} y1="0" x2={nbE} y2={minN} class="rs-edge" />
    <line x1={nbE} y1={minS} x2={nbE} y2={minS + BAY} class="rs-edge" />
    <path d="M {nbE},{minS + BAY} L {bayE},{minS + BAY - 30} L {bayE},{minS}" class="rs-edge" fill="none" />
    <line x1={nbE} y1={minS + BAY} x2={nbE} y2={xyS - LOON} class="rs-edge" />
    <path d={loonSEdge} class="rs-edge" fill="none" />
    <line x1={nbE} y1={xyS + LOON} x2={nbE} y2={H} class="rs-edge" />

    <!-- minor-street edges, up to the carriageway curb lines -->
    {#each [[0, bayW], [bayE, W]] as [x0, x1]}
      <line x1={x0} y1={minN} x2={x1} y2={minN} class="rs-edge" />
      <line x1={x0} y1={minS} x2={x1} y2={minS} class="rs-edge" />
    {/each}

    <!-- lane lines, broken across the junctions and the crossover openings -->
    {#each [[0, xyN - OPEN], [xyN + OPEN, minN], [minS, xyS - OPEN], [xyS + OPEN, H]] as [y0, y1]}
      <line x1={sbW + LANE} y1={y0} x2={sbW + LANE} y2={y1} class="rs-lane-line" />
      <line x1={nbW + LANE} y1={y0} x2={nbW + LANE} y2={y1} class="rs-lane-line" />
    {/each}
    {#each [[0, sbW], [nbE, W]] as [x0, x1]}
      <line x1={x0} y1={minN + LANE} x2={x1} y2={minN + LANE} class="rs-lane-line" />
      <line x1={x0} y1={minS - LANE} x2={x1} y2={minS - LANE} class="rs-lane-line" />
      <line x1={x0} y1={jy} x2={x1} y2={jy} class="rs-center" />
    {/each}

    <!-- ══ stop bars at the four signals ══ -->
    <line x1={sbW} y1={minN - 1} x2={sbE} y2={minN - 1} class="rs-stop" />
    <line x1={bayW} y1={minN - 1} x2={sbW} y2={minN - 1} class="rs-stop" />
    <line x1={nbW} y1={minS + 1} x2={nbE} y2={minS + 1} class="rs-stop" />
    <line x1={nbE} y1={minS + 1} x2={bayE} y2={minS + 1} class="rs-stop" />
    <line x1={nbW} y1={xyN + OPEN - 1} x2={nbE} y2={xyN + OPEN - 1} class="rs-stop" />
    <line x1={sbW} y1={xyN - OPEN + 1} x2={sbE} y2={xyN - OPEN + 1} class="rs-stop" />
    <line x1={sbW} y1={xyS - OPEN + 1} x2={sbE} y2={xyS - OPEN + 1} class="rs-stop" />
    <line x1={nbW} y1={xyS + OPEN - 1} x2={nbE} y2={xyS + OPEN - 1} class="rs-stop" />

    <!-- ══ movement paths ══ -->
    {#each KEYS as k (k)}
      {#if volOf[k] > 0}
        <path d={P[k]} class={cls(k)} style="stroke: {colorOf(k)}" />
      {/if}
    {/each}

    <!-- ══ vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class="rs-veh" class:dim={hovered != null && hovered !== groupOf[v.key]}>
          <rect x="-4.5" y="-2.4" width="9" height="4.8" rx="1.4" fill={colorOf(v.key)} />
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s" path={v.d} />
        </g>
      {/each}
    {/if}

    <!-- ══ signal heads ══ -->
    {#each SIGNALS as s (s.title)}
      <g class="rs-signal">
        <title>{s.title}</title>
        <rect x={s.x} y={s.y} width="8" height="17" rx="2" />
        <circle cx={s.x + 4} cy={s.y + 4} r="1.5" class="rs-signal-r" />
        <circle cx={s.x + 4} cy={s.y + 8.5} r="1.5" class="rs-signal-y" />
        <circle cx={s.x + 4} cy={s.y + 13} r="1.5" class="rs-signal-g" />
      </g>
    {/each}

    <!-- ══ annotation ══ -->
    <text x="6" y="46" class="rs-label">Main street north-south,</text>
    <text x="6" y="58" class="rs-label">two carriageways either</text>
    <text x="6" y="70" class="rs-label">side of a 40 ft median</text>
    <text x="6" y={minN - 16} class="rs-label">Minor street east-west</text>
    <text x={nbE + 10} y={xyN - OPEN - 8} class="rs-label">North U-turn crossover, with loon</text>
    <text x={nbE + 10} y={xyS - OPEN - 10} class="rs-label">South U-turn crossover, with loon</text>
    <text x={bayE + 12} y={minS + 18} class="rs-label">West main intersection = southbound signal</text>
    <text x={bayE + 12} y={minS + 30} class="rs-label">East main intersection = northbound signal</text>
    <g class="rs-compass">
      <line x1={W - 26} y1={122} x2={W - 26} y2={98} class="rs-dim" />
      <polygon points="{W - 30},104 {W - 26},94 {W - 22},104" />
      <text x={W - 26} y="134" class="rs-label mid">N</text>
    </g>

    <!-- Crossover distances, dimensioned down the west side clear of the north
         loon. The extension lines are drawn only at the crossovers; the
         main-intersection end is marked by a tick, which keeps a dashed line
         from running the width of the minor street. -->
    {#each [{ y0: xyN, y1: jy, ext: xyN, stop: sbW - LOON - 4 }, { y0: jy, y1: xyS, ext: xyS, stop: sbW - 4 }] as dm}
      <line x1={DIM_X} y1={dm.ext} x2={dm.stop} y2={dm.ext} class="rs-ext" />
      <line x1={DIM_X} y1={dm.y0} x2={DIM_X} y2={dm.y1} class="rs-dim" />
      <line x1={DIM_X - 5} y1={dm.y0} x2={DIM_X + 5} y2={dm.y0} class="rs-dim" />
      <line x1={DIM_X - 5} y1={dm.y1} x2={DIM_X + 5} y2={dm.y1} class="rs-dim" />
      <text x={DIM_X - 7} y={(dm.y0 + dm.y1) / 2 + 3} class="rs-label end">{distLabel}</text>
    {/each}

    <!-- ══ on-diagram demand editors ══ -->
    {#each editable ? GROUPS : [] as g (g.key)}
      <foreignObject x={clusterPos[g.key].x} y={clusterPos[g.key].y} width={CW} height={CH}>
        <div
          class="rs-cluster"
          xmlns="http://www.w3.org/1999/xhtml"
          onmouseenter={() => (hovered = g.key)}
          onmouseleave={() => (hovered = null)}
        >
          <span class="rs-cluster-title"><span class="swatch {g.cls}"></span>{g.key}</span>
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

  <div class="rs-legend">
    <button
      type="button"
      class="rs-chip rs-animate"
      class:active={animating}
      aria-pressed={animating}
      onclick={() => (animating = !animating)}
    >
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each GROUPS as g (g.key)}
      <button
        type="button"
        class="rs-chip chip-{g.cls}"
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
  <p class="rs-note">
    Major-street left turns are made at the mains, but they cross the median between the two signals, so their delay is
    booked at the far one. Minor-street left and through movements take the long way round: right onto the near
    carriageway, U-turn at the crossover, then back to the leg they wanted, which is where their extra distance travel
    time comes from. Paths sharing a lane are drawn slightly apart to stay readable, and both crossovers track the
    dimensioned distance. Animated traffic slows per movement LOS after a run. An illustration, not a simulation.
  </p>
</div>

<style>
  .rs-diagram svg {
    width: 100%;
    max-width: 580px;
    display: block;
    margin: 0 auto;
  }
  .rs-pavement {
    fill: var(--diag-pavement);
  }
  .rs-island {
    fill: var(--diag-wall);
  }
  .rs-island-edge {
    stroke: var(--diag-wall-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .rs-edge {
    stroke: var(--diag-edge);
    stroke-width: 1.5;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .rs-center {
    stroke: var(--diag-center);
    stroke-width: 1.25;
    vector-effect: non-scaling-stroke;
  }
  .rs-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1.25;
    stroke-dasharray: 8 6;
    vector-effect: non-scaling-stroke;
  }
  .rs-stop {
    stroke: var(--diag-lane-line);
    stroke-width: 3;
    vector-effect: non-scaling-stroke;
  }
  .rs-signal rect {
    fill: var(--diag-wall);
    stroke: var(--diag-edge);
    stroke-width: 1;
  }
  .rs-signal-r {
    fill: #dc2626;
  }
  .rs-signal-y {
    fill: #eab308;
  }
  .rs-signal-g {
    fill: #16a34a;
  }
  .rs-dim {
    stroke: var(--diag-dim);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .rs-ext {
    stroke: var(--diag-dim);
    stroke-width: 0.8;
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
  }
  .rs-compass polygon {
    fill: var(--diag-dim);
  }

  .rs-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition:
      opacity 120ms ease,
      stroke-width 120ms ease;
    opacity: 0.78;
  }
  .rs-move.dim {
    opacity: 0.07;
  }
  .rs-move.active {
    stroke-width: 3.5;
    opacity: 1;
  }

  .rs-veh rect {
    stroke: rgba(15, 23, 42, 0.35);
    stroke-width: 0.6;
  }
  .rs-veh {
    transition: opacity 120ms ease;
  }
  .rs-veh.dim {
    opacity: 0.07;
  }

  .rs-label {
    font-size: 9px;
    fill: var(--text-muted);
  }
  .rs-label.mid {
    text-anchor: middle;
  }
  .rs-label.end {
    text-anchor: end;
  }

  .rs-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .rs-chip {
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
  .rs-chip.active {
    border-color: var(--diag-edge);
  }
  .rs-animate {
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
  .rs-note {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 0.35rem;
  }

  .rs-cluster {
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
  .rs-cluster-title {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 7px;
    font-weight: 600;
    flex: none;
  }
  .rs-cluster input {
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
  .rs-cluster input::-webkit-outer-spin-button,
  .rs-cluster input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .rs-cluster input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .rs-cluster .swatch {
    width: 6px;
    height: 6px;
  }
</style>
