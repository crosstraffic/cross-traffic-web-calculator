<script>
  // Interactive plan view of a single-point urban interchange (HCM Chapter 23
  // Part B, Exhibit 23-18; the configuration drawn here is Chapter 34 Example
  // Problem 7, Exhibit 34-72, I-95 at University Drive). The freeway runs
  // north-south with separate carriageways and passes underneath, the arterial
  // runs east-west on structure, and every ramp meets it at ONE signalized
  // junction rather than at two ramp terminals. That is the whole form: there
  // is no internal link, so no O-D leaves the arterial and rejoins it, which is
  // why Exhibit 34-82's ETT column equals its control delay column exactly.
  //
  // What crosses inside the junction is read off the published NEMA phasing of
  // Exhibit 34-73, not off the exhibit's hand-drawn arrows. Phase 1 runs the
  // two arterial lefts together (1+5) and phase 3 runs the two ramp approaches
  // together (3+8), so neither pair conflicts with itself and the two paths in
  // each pair pass left side to left side without crossing. What each left turn
  // does cross is the opposing THROUGH movement, which is why phase 2 (2+6)
  // makes the arterial lefts permitted and why they need the Equation 31-95
  // unblocked green g_u at all. The paths below are laid out so that reading
  // them off the picture gives the same answer as reading the phase table.
  import { LOS_COLORS } from './los.js';

  /**
   * @typedef {Object} Props
   * @property {any} [odDemands] - The fourteen O-D rows ({ key, label, value }); A through J are drawn.
   * @property {boolean} [editable]
   * @property {any} [odLos] - Per-O-D LOS letters from the last run ({ A: 'C', ... }).
   * @property {any} [laneGroups] - The page's lane group rows, read for the protected-plus-permitted left turns.
   * @property {number} [cycleLength] - Common cycle length C, s.
   */

  /** @type {Props} */
  let { odDemands = $bindable([]), editable = true, odLos = {}, laneGroups = [], cycleLength = 110 } = $props();

  let hovered = $state(null); // 'NBOFF' | 'SBOFF' | 'EB' | 'WB' | null

  const W = 640,
    H = 440;
  const cx = 320,
    cy = 215;

  // Four lanes each way on both arterial approaches (Exhibit 34-72: an
  // exclusive left bay, two through lanes, and an exclusive right).
  const LANE = 13,
    nLanes = 4;
  const half = nLanes * LANE; // 52
  const edgeN = cy - half,
    edgeS = cy + half; // 163 / 267
  // i = 0 is the lane against the centreline, which is the left-turn bay.
  const ebLane = (i) => cy + (i + 0.5) * LANE;
  const wbLane = (i) => cy - (i + 0.5) * LANE;
  const ebL = ebLane(0),
    ebR = ebLane(3);
  const wbL = wbLane(0),
    wbR = wbLane(3);
  // A through movement occupies both middle lanes; its path is drawn in the
  // inner one so that it sits in a lane rather than on a lane line.
  const ebT = ebLane(1);
  const wbT = wbLane(1);

  // Freeway carriageways, southbound west and northbound east, passing under
  // the arterial. Which is which is what puts each ramp in its own quadrant.
  // They run directly beneath the junction, which is what a single point is:
  // the whole signal sits on the structure over the mainline, so the two
  // carriageways emerge either side of the leg rather than outside the ramps.
  const FWY = 30;
  const sbW = cx - 56,
    sbE = sbW + FWY;
  const nbW = cx + 26,
    nbE = nbW + FWY;

  // The two ramp legs of the junction, north and south. Each is two-way with
  // two lanes per direction: the arriving off-ramp keeps right, which puts it
  // on the west half of the north leg and the east half of the south leg, and
  // the departing on-ramp takes the other half. Inside each half the
  // left-turn lane is the inner one, next to the leg centreline.
  const RLANE = 16,
    legHalf = 2 * RLANE; // 32
  const legW = cx - legHalf,
    legE = cx + legHalf;
  const nOffL = cx - RLANE / 2,
    nOffR = cx - (3 * RLANE) / 2; // SB off-ramp, arriving
  const nOnL = cx + RLANE / 2,
    nOnR = cx + (3 * RLANE) / 2; // NB on-ramp, departing
  const sOffL = cx + RLANE / 2,
    sOffR = cx + (3 * RLANE) / 2; // NB off-ramp, arriving
  const sOnL = cx - RLANE / 2,
    sOnR = cx - (3 * RLANE) / 2; // SB on-ramp, departing

  // ── centrelines, offset exactly ─────────────────────────────────────────
  // Same construction as ParcloDiagram: a ramp centreline is a list of
  // straight runs and circular arcs and nothing else, because both offset
  // exactly, so one list generates the pavement fill and its two edge lines
  // and they cannot disagree. Angles are degrees with y pointing down, so
  // increasing angle sweeps clockwise on screen.
  const L = (x0, y0, x1, y1) => ({ k: 'l', x0, y0, x1, y1 });
  const A = (acx, acy, r, a0, a1) => ({ k: 'a', acx, acy, r, a0, a1 });
  const rad = (d) => (d * Math.PI) / 180;

  function offsetSeg(s, h) {
    if (s.k === 'l') {
      const dx = s.x1 - s.x0,
        dy = s.y1 - s.y0;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * h,
        ny = (dx / len) * h;
      return L(s.x0 + nx, s.y0 + ny, s.x1 + nx, s.y1 + ny);
    }
    return A(s.acx, s.acy, s.r + (s.a1 > s.a0 ? -h : h), s.a0, s.a1);
  }
  const offsetAll = (segs, h) => segs.map((s) => offsetSeg(s, h));

  function reverseSegs(segs) {
    return segs
      .slice()
      .reverse()
      .map((s) => (s.k === 'l' ? L(s.x1, s.y1, s.x0, s.y0) : A(s.acx, s.acy, s.r, s.a1, s.a0)));
  }

  const startOf = (s) =>
    s.k === 'l' ? [s.x0, s.y0] : [s.acx + s.r * Math.cos(rad(s.a0)), s.acy + s.r * Math.sin(rad(s.a0))];
  const endOf = (s) =>
    s.k === 'l' ? [s.x1, s.y1] : [s.acx + s.r * Math.cos(rad(s.a1)), s.acy + s.r * Math.sin(rad(s.a1))];

  function pathOf(segs, moveTo = true) {
    const [sx, sy] = startOf(segs[0]);
    let d = `${moveTo ? 'M' : 'L'} ${sx.toFixed(1)},${sy.toFixed(1)}`;
    for (const s of segs) {
      const [ex, ey] = endOf(s);
      if (s.k === 'l') d += ` L ${ex.toFixed(1)},${ey.toFixed(1)}`;
      else {
        const large = Math.abs(s.a1 - s.a0) > 180 ? 1 : 0;
        const sweep = s.a1 > s.a0 ? 1 : 0;
        d += ` A ${s.r.toFixed(1)},${s.r.toFixed(1)} 0 ${large} ${sweep} ${ex.toFixed(1)},${ey.toFixed(1)}`;
      }
    }
    return d;
  }

  const bandFill = (segs, h) => `${pathOf(offsetAll(segs, h))} ${pathOf(offsetAll(reverseSegs(segs), h), false)} Z`;
  const bandEdges = (segs, h) => [pathOf(offsetAll(segs, h)), pathOf(offsetAll(segs, -h))];

  // The four quadrants are one shape reflected, so the ramp that reaches the
  // west half of the north leg and the one that reaches the east half of the
  // south leg are the same curve seen twice. Reflecting the angles rather than
  // redrawing keeps the four ramps identical by construction.
  const mirrorX = (segs) =>
    segs.map((s) =>
      s.k === 'l' ? L(2 * cx - s.x0, s.y0, 2 * cx - s.x1, s.y1) : A(2 * cx - s.acx, s.acy, s.r, 180 - s.a0, 180 - s.a1),
    );
  const mirrorY = (segs) =>
    segs.map((s) => (s.k === 'l' ? L(s.x0, H - s.y0, s.x1, H - s.y1) : A(s.acx, H - s.acy, s.r, -s.a0, -s.a1)));

  // Southbound off-ramp, northwest quadrant: down the west side of the
  // interchange, then an S across the southbound carriageway on the arterial
  // structure into the west half of the north leg.
  // Half the leg, so the arriving and departing ramps together fill it.
  const RAMP_H = legHalf / 2; // 16
  const rampIn = cx - RAMP_H; // 304, centre of the west half
  const R1 = 52,
    rampOut = rampIn - 2 * R1; // 200
  const nwOff = [
    L(rampOut, 0, rampOut, 16),
    A(rampOut + R1, 16, R1, 180, 90),
    A(rampOut + R1, 16 + 2 * R1, R1, 270, 360),
    L(rampIn, 16 + 2 * R1, rampIn, edgeN),
  ];
  const neOn = mirrorX(nwOff); // NB on-ramp, departing to the northeast
  const swOn = mirrorY(nwOff); // SB on-ramp, departing to the southwest
  const seOff = mirrorY(neOn); // NB off-ramp, arriving from the southeast
  const RAMPS = [nwOff, neOn, swOn, seOff];

  // ── O-D paths ───────────────────────────────────────────────────────────
  // Each is one continuous path so the animation can run a vehicle along it.
  // The quadratic control point of every turn is the corner where the two
  // straight runs would meet, so the curve is the turn and not a guess.
  // How far outside the junction each turn starts bending. A left turn is given
  // the full sweep and a right turn a short one, so a left visibly traverses the
  // junction and crosses the movement it has to yield to, while a right hugs
  // the corner it actually takes.
  const SWEEP = 58,
    TIP = 13;
  const nIn = edgeN - TIP,
    sIn = edgeS + TIP;
  const P = {
    // A: NB off-ramp left, north across the eastbound through lanes and out west.
    A: `M ${sOffL},${H} L ${sOffL},${sIn} Q ${sOffL},${wbL} ${sOffL - SWEEP},${wbL} L 0,${wbL}`,
    // B: NB off-ramp right, the curb turn out east.
    B: `M ${sOffR},${H} L ${sOffR},${sIn} Q ${sOffR},${ebR} ${sOffR + SWEEP},${ebR} L ${W},${ebR}`,
    // C: SB off-ramp right, the curb turn out west.
    C: `M ${nOffR},0 L ${nOffR},${nIn} Q ${nOffR},${wbR} ${nOffR - SWEEP},${wbR} L 0,${wbR}`,
    // D: SB off-ramp left, south across the westbound through lanes and out east.
    D: `M ${nOffL},0 L ${nOffL},${nIn} Q ${nOffL},${ebL} ${nOffL + SWEEP},${ebL} L ${W},${ebL}`,
    // E: EB arterial left, across the westbound through lanes onto the NB on-ramp.
    E: `M 0,${ebL} L ${nOnL - SWEEP},${ebL} Q ${nOnL},${ebL} ${nOnL},${nIn} L ${nOnL},0`,
    // F: EB arterial right, onto the SB on-ramp.
    F: `M 0,${ebR} L ${sOnR - SWEEP},${ebR} Q ${sOnR},${ebR} ${sOnR},${sIn} L ${sOnR},${H}`,
    // G: WB arterial right, onto the NB on-ramp.
    G: `M ${W},${wbR} L ${nOnR + SWEEP},${wbR} Q ${nOnR},${wbR} ${nOnR},${nIn} L ${nOnR},0`,
    // H: WB arterial left, across the eastbound through lanes onto the SB on-ramp.
    H: `M ${W},${wbL} L ${sOnL + SWEEP},${wbL} Q ${sOnL},${wbL} ${sOnL},${sIn} L ${sOnL},${H}`,
    I: `M 0,${ebT} L ${W},${ebT}`,
    J: `M ${W},${wbT} L 0,${wbT}`,
  };

  const GROUPS = [
    { key: 'SBOFF', label: 'SB off-ramp (C, D)', ods: ['c', 'd'], cls: 'sboff' },
    { key: 'NBOFF', label: 'NB off-ramp (A, B)', ods: ['a', 'b'], cls: 'nboff' },
    { key: 'EB', label: 'EB arterial (E, F, I)', ods: ['e', 'f', 'i'], cls: 'ebg' },
    { key: 'WB', label: 'WB arterial (G, H, J)', ods: ['g', 'h', 'j'], cls: 'wbg' },
  ];
  const groupOf = {
    a: 'NBOFF',
    b: 'NBOFF',
    c: 'SBOFF',
    d: 'SBOFF',
    e: 'EB',
    f: 'EB',
    i: 'EB',
    g: 'WB',
    h: 'WB',
    j: 'WB',
  };
  const BASE_COLOR = { NBOFF: '#2563eb', SBOFF: '#16a34a', EB: '#ea7317', WB: '#dc2626' };

  let volOf = $derived(Object.fromEntries((odDemands || []).map((d) => [d.key, Number(d.value) || 0])));
  let losOf = $derived(odLos || {});
  let colorOf = $derived((letter) => LOS_COLORS[losOf[letter]] ?? BASE_COLOR[groupOf[letter.toLowerCase()]]);
  const WORST = (a, b) => (a && b ? (a > b ? a : b) : a || b);
  let groupLos = $derived((g) => g.ods.map((k) => losOf[k.toUpperCase()]).reduce((acc, x) => WORST(acc, x), null));
  let groupColorOf = $derived((g) => LOS_COLORS[groupLos(g)] ?? BASE_COLOR[g.key]);
  // Built here rather than inline, because a leading space inside a template
  // block is trimmed away and the separator goes with it.
  let chipLabel = $derived((g) => (groupLos(g) ? `${g.label} — worst LOS ${groupLos(g)}` : g.label));
  let clusterTitle = $derived((g) => (g.key === 'NBOFF' ? 'NB' : g.key === 'SBOFF' ? 'SB' : g.key));

  function setOd(key, raw) {
    const d = odDemands.find((x) => x.key === key);
    if (d) {
      d.value = raw === '' ? '' : Number(raw);
      odDemands = odDemands;
    }
  }

  function cls(group) {
    if (hovered == null) return 'sp-move';
    return hovered === group ? 'sp-move active' : 'sp-move dim';
  }

  // The permitted phase, read from the lane groups the page is about to send,
  // so the caption cannot drift from the analysis. Both arterial lefts share
  // the phase, and g_u is what differs between them.
  let perms = $derived((laneGroups || []).filter((g) => g.perm));
  let permGreen = $derived(perms.length ? Number(perms[0].perm.green) : 0);
  let protGreen = $derived(perms.length ? Number(perms[0].green) : 0);
  let guLabel = $derived(
    perms.map((g) => `${g.movement.startsWith('Eb') ? 'EB' : 'WB'} ${Number(g.perm.gu).toFixed(2)}`).join(' · '),
  );
  let phaseLabel = $derived(
    perms.length ? `Arterial lefts: ${protGreen} s protected, then ${permGreen} s permitted` : 'One signalized point',
  );
  let cycleLabel = $derived(`C = ${Math.round(Number(cycleLength))} s`);

  let ariaLabel = $derived(
    'Single-point urban interchange, plan view. The freeway runs north-south on separate ' +
      'carriageways underneath an east-west arterial carried on structure. All four ramp ' +
      'approaches and both arterial approaches meet at one signalized junction, where each ' +
      'left turn crosses the opposing through movement. ' +
      `${phaseLabel}, ${cycleLabel}.`,
  );

  // ── illustrative traffic, per-O-D LOS ──
  let animating = $state(false);
  const LOS_SPEED = { A: 1, B: 0.85, C: 0.7, D: 0.5, E: 0.32, F: 0.16 };
  const LOS_FLEET = { A: 1, B: 1, C: 1.1, D: 1.3, E: 1.7, F: 2.3 };
  let vehiclePlan = $derived(
    (() => {
      if (!animating) return [];
      const raw = [];
      let total = 0;
      for (const [k, group] of Object.entries(groupOf)) {
        const vol = volOf[k] || 0;
        if (vol <= 0) continue;
        const letter = k.toUpperCase();
        const slow = LOS_SPEED[losOf[letter]] ?? 1;
        const crowd = LOS_FLEET[losOf[letter]] ?? 1;
        raw.push({ k, letter, group, d: P[letter], vol, dur: 9 / slow, crowd });
        total += vol;
      }
      const items = [];
      for (const it of raw) {
        const n = Math.max(1, Math.min(7, Math.round((26 * it.vol * it.crowd) / (total || 1))));
        for (let j = 0; j < n; j++) {
          items.push({
            id: it.k + j,
            letter: it.letter,
            group: it.group,
            d: it.d,
            dur: it.dur,
            begin: (-(j + 0.4 * (j % 2)) / n) * it.dur,
          });
        }
      }
      return items;
    })(),
  );

  const CW = 118,
    CH = 24;
  const clusterPos = {
    SBOFF: { x: 4, y: 4 },
    WB: { x: W - CW - 4, y: 4 },
    EB: { x: 4, y: H - CH - 4 },
    NBOFF: { x: W - CW - 4, y: H - CH - 4 },
  };
</script>

<div class="sp-diagram">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>
    <!-- ══ the freeway, underneath ══ -->
    <!-- Drawn first and covered by the arterial, because here the street is on
         structure over the freeway, which is the reverse of the parclo. -->
    <rect x={sbW} y="0" width={FWY} height={H} class="sp-freeway" />
    <rect x={nbW} y="0" width={FWY} height={H} class="sp-freeway" />

    <!-- ══ pavement (fills only) ══ -->
    <rect x="0" y={edgeN} width={W} height={half * 2} class="sp-pavement" />
    {#each RAMPS as segs}
      <path d={bandFill(segs, RAMP_H)} class="sp-pavement" />
    {/each}
    <!-- The junction itself: the two ramp legs meet the arterial across their
         full width, so the four approaches share one signalized area. -->
    <rect x={legW} y={edgeN - 1} width={legE - legW} height={half * 2 + 2} class="sp-pavement" />

    <!-- ══ edges (separate from every fill above) ══ -->
    {#each RAMPS as segs}
      {#each bandEdges(segs, RAMP_H) as d}
        <path {d} class="sp-edge" fill="none" />
      {/each}
    {/each}
    <!-- Arterial edges, interrupted where a ramp leg joins. -->
    {#each [edgeN, edgeS] as y}
      <line x1="0" y1={y} x2={legW} y2={y} class="sp-edge" />
      <line x1={legE} y1={y} x2={W} y2={y} class="sp-edge" />
    {/each}
    <!-- The freeway's own edges go on last and dashed, so its two carriageways
         stay traceable underneath the structure they pass below. -->
    {#each [sbW, sbE, nbW, nbE] as x}
      <line x1={x} y1="0" x2={x} y2={H} class="sp-edge under" />
    {/each}

    <!-- ══ lane lines and centrelines ══ -->
    {#each Array.from({ length: nLanes - 1 }) as _, i}
      <line x1="0" y1={cy + LANE * (i + 1)} x2={legW} y2={cy + LANE * (i + 1)} class="sp-lane-line" />
      <line x1={legE} y1={cy + LANE * (i + 1)} x2={W} y2={cy + LANE * (i + 1)} class="sp-lane-line" />
      <line x1="0" y1={cy - LANE * (i + 1)} x2={legW} y2={cy - LANE * (i + 1)} class="sp-lane-line" />
      <line x1={legE} y1={cy - LANE * (i + 1)} x2={W} y2={cy - LANE * (i + 1)} class="sp-lane-line" />
    {/each}
    <line x1="0" y1={cy} x2={legW} y2={cy} class="sp-center" />
    <line x1={legE} y1={cy} x2={W} y2={cy} class="sp-center" />
    <!-- Each ramp leg is two-way and divided, arriving on one half and
         departing on the other. -->
    <line x1={cx} y1={edgeN - 45} x2={cx} y2={edgeN} class="sp-center" />
    <line x1={cx} y1={edgeS} x2={cx} y2={edgeS + 45} class="sp-center" />
    <!-- Two lanes each way on each leg, which is what makes the exclusive ramp
         left and the exclusive ramp right separate lane groups. -->
    {#each [cx - RLANE, cx + RLANE] as x}
      <line x1={x} y1={edgeN - 45} x2={x} y2={edgeN} class="sp-lane-line" />
      <line x1={x} y1={edgeS} x2={x} y2={edgeS + 45} class="sp-lane-line" />
    {/each}

    <!-- Freeway direction. Which carriageway is which is what puts the
         southbound ramps in the two western quadrants and the northbound ramps
         in the two eastern ones. -->
    <path d="M {(sbW + sbE) / 2},{H - 20} l -5,-10 h 10 Z" class="sp-arrow" />
    <text x={sbW - 6} y={H - 22} class="sp-label end">I-95 SB</text>
    <path d="M {(nbW + nbE) / 2},20 l -5,10 h 10 Z" class="sp-arrow" />
    <text x={nbE + 6} y="32" class="sp-label">I-95 NB</text>

    <!-- The single signalized point. One node, not two, is the form. -->
    <circle {cx} {cy} r="6" class="sp-signal" />

    <!-- ══ O-D movement paths ══ -->
    {#each Object.entries(P) as [letter, d]}
      {@const group = groupOf[letter.toLowerCase()]}
      {#if (volOf[letter.toLowerCase()] || 0) > 0}
        <path
          {d}
          class={cls(group)}
          data-od={letter}
          data-los={losOf[letter] ?? ''}
          style="stroke: {colorOf(letter)}"
        />
      {/if}
    {/each}

    <!-- ══ vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class="sp-veh" class:dim={hovered != null && hovered !== v.group}>
          <rect x="-4.5" y="-2.4" width="9" height="4.8" rx="1.4" fill={colorOf(v.letter)} />
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s" path={v.d} />
        </g>
      {/each}
    {/if}

    <!-- ══ labels ══ -->
    <text x="6" y={edgeN - 8} class="sp-label">University Drive (arterial, on structure)</text>
    <text x="6" y={edgeS + 14} class="sp-label">{cycleLabel} · {phaseLabel}</text>
    {#if guLabel}
      <text x="6" y={edgeS + 26} class="sp-label">Unblocked permitted green g_u (s): {guLabel}</text>
    {/if}
    <text x={W - 6} y={edgeN - 8} class="sp-label end">One signalized point, no internal link</text>

    <!-- ══ grouped O-D editors ══ -->
    {#each editable ? GROUPS : [] as g (g.key)}
      <foreignObject x={clusterPos[g.key].x} y={clusterPos[g.key].y} width={CW} height={CH}>
        <div class="sp-cluster" xmlns="http://www.w3.org/1999/xhtml">
          <span class="sp-cluster-title"
            ><span class="swatch" style="background: {groupColorOf(g)}"></span>{clusterTitle(g)}</span
          >
          {#each g.ods as k}
            <input
              type="number"
              min="0"
              title="O-D {k.toUpperCase()} demand (veh/h)"
              aria-label="O-D {k.toUpperCase()} demand"
              value={volOf[k] ?? 0}
              onmouseenter={() => (hovered = g.key)}
              onmouseleave={() => (hovered = null)}
              onfocus={() => (hovered = g.key)}
              onblur={() => (hovered = null)}
              oninput={(e) => setOd(k, e.currentTarget.value)}
            />
          {/each}
        </div>
      </foreignObject>
    {/each}
  </svg>

  <div class="sp-legend">
    <button
      type="button"
      class="sp-chip sp-animate"
      class:active={animating}
      aria-pressed={animating}
      onclick={() => (animating = !animating)}
    >
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each GROUPS as g (g.key)}
      <button
        type="button"
        class="sp-chip chip-{g.cls}"
        class:active={hovered === g.key}
        onmouseenter={() => (hovered = g.key)}
        onmouseleave={() => (hovered = null)}
        onfocus={() => (hovered = g.key)}
        onblur={() => (hovered = null)}
      >
        <span class="swatch" style="background: {groupColorOf(g)}"></span>
        {chipLabel(g)}
      </button>
    {/each}
  </div>
  <p class="sp-note">
    All six approaches meet at one signal, so no O-D leaves the arterial and rejoins it and every experienced travel
    time is its movement's control delay. The two arterial left turns (E and H) run protected together in phase 1 and
    permitted in phase 2, and the two ramp left turns (A and D) run together in phase 3, so neither pair crosses itself;
    what each left turn crosses is the opposing through movement, which is what the permitted phase has to yield to.
    Demands are editable on the picture, movement colour carries O-D LOS after a run, and animated traffic slows with
    it. An illustration, not a simulation.
  </p>
</div>

<style>
  .sp-diagram svg {
    width: 100%;
    max-width: 660px;
    display: block;
    margin: 0 auto;
  }
  .sp-pavement {
    fill: var(--diag-pavement);
  }
  .sp-freeway {
    fill: var(--diag-pavement-alt);
  }
  .sp-edge {
    stroke: var(--diag-edge);
    stroke-width: 1.5;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .sp-edge.under {
    stroke: var(--diag-dim);
    stroke-dasharray: 4 4;
  }
  .sp-center {
    stroke: var(--diag-center);
    stroke-width: 1.25;
    vector-effect: non-scaling-stroke;
  }
  .sp-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1.25;
    stroke-dasharray: 8 6;
    vector-effect: non-scaling-stroke;
  }
  .sp-arrow {
    fill: var(--diag-center);
  }
  .sp-signal {
    fill: var(--diag-center);
    stroke: var(--diag-edge);
    stroke-width: 1.5;
  }

  .sp-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition:
      opacity 120ms ease,
      stroke-width 120ms ease;
    opacity: 0.78;
  }
  .sp-move.dim {
    opacity: 0.08;
  }
  .sp-move.active {
    stroke-width: 4;
    opacity: 1;
  }

  .sp-veh rect {
    stroke: rgba(15, 23, 42, 0.35);
    stroke-width: 0.6;
  }
  .sp-veh {
    transition: opacity 120ms ease;
  }
  .sp-veh.dim {
    opacity: 0.08;
  }

  .sp-label {
    font-size: 9px;
    fill: var(--text-muted);
  }
  .sp-label.mid {
    text-anchor: middle;
  }
  .sp-label.end {
    text-anchor: end;
  }

  .sp-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .sp-chip {
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
  .sp-chip.active {
    border-color: var(--diag-edge);
  }
  .sp-animate {
    cursor: pointer;
    font-weight: 600;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
  .sp-note {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 0.35rem;
  }

  .sp-cluster {
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
  .sp-cluster-title {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 7px;
    font-weight: 600;
    flex: none;
  }
  .sp-cluster input {
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
  .sp-cluster input::-webkit-outer-spin-button,
  .sp-cluster input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .sp-cluster input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .sp-cluster .swatch {
    width: 6px;
    height: 6px;
  }
</style>
