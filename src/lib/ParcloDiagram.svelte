<script>
  // Interactive plan view of a Parclo A-2Q interchange (HCM Chapter 23 Part B,
  // Exhibit 23-17; the configuration drawn here is Chapter 34 Example Problem
  // 2, Exhibit 34-17). The freeway runs north-south with separate
  // carriageways, the arterial east-west through two signalized ramp
  // terminals, and the ramps occupy two diagonally opposite quadrants, which
  // is what the "2Q" names. Each quadrant carries an outer off-ramp and a loop
  // on-ramp, which is what the "A" names: in a parclo A the loops serve
  // arterial-to-freeway movements rather than freeway-to-arterial ones.
  //
  // The routing this draws is the engine's, read off the Example Problem 2 O-D
  // decomposition rather than guessed from the exhibit's arrow glyphs: O-Ds F
  // and G leave on an external left at the near terminal, O-Ds E and H run the
  // whole arterial and leave on the internal shared through-and-right at the
  // far terminal onto a loop, and O-Ds A and D turn at one terminal and use
  // the internal link to reach the other.
  import { LOS_COLORS } from './los.js';

  /**
   * @typedef {Object} Props
   * @property {any} [odDemands] - The fourteen O-D rows ({ key, label, value }); A through J are drawn.
   * @property {boolean} [editable]
   * @property {any} [odLos] - Per-O-D LOS letters from the last run ({ A: 'C', ... }).
   * @property {number} [spacingFt] - Distance between the two ramp terminals D, ft.
   * @property {number} [loopDist] - Extra distance traveled along a loop ramp, ft.
   * @property {number} [loopSpeed] - Loop ramp design speed, mi/h.
   */

  /** @type {Props} */
  let {
    odDemands = $bindable([]),
    editable = true,
    odLos = {},
    spacingFt = 800,
    loopDist = 1200,
    loopSpeed = 25
  } = $props();

  let hovered = $state(null); // 'NBOFF' | 'SBOFF' | 'EB' | 'WB' | null

  const W = 620, H = 460;
  const cx = 310, cy = 230;          // freeway centre / arterial centre
  const xW = 165, xE = 455;          // signalized terminal nodes
  const LANE = 13;
  const FWY = 36, GAP = 10;          // carriageway width and median
  const sbW = cx - GAP / 2 - FWY, sbE = cx - GAP / 2;   // SB carriageway (west)
  const nbW = cx + GAP / 2, nbE = cx + GAP / 2 + FWY;   // NB carriageway (east)

  // Three through lanes each way on every arterial approach (Exhibit 34-17).
  const nLanes = 3;
  const half = nLanes * LANE;
  const edgeN = cy - half, edgeS = cy + half;
  const ebLane = (i) => cy + half - (i + 0.5) * LANE;   // i = 0 at the south curb
  const wbLane = (i) => cy - half + (i + 0.5) * LANE;   // i = 0 at the north curb
  const ebOut = ebLane(0), ebMid = ebLane(1), ebIn = ebLane(2);
  const wbOut = wbLane(0), wbMid = wbLane(1), wbIn = wbLane(2);

  // ── centrelines, offset exactly ─────────────────────────────────────────
  // A ramp centreline is a list of straight runs and circular arcs, and only
  // those two, because both offset exactly. One list per ramp then generates
  // the pavement fill, its two edge lines, and the movement paths that run
  // inside it, so the three can never disagree the way three hand-drawn
  // Beziers would. Angles are degrees, measured with y pointing down, so
  // increasing angle sweeps clockwise on screen.
  const L = (x0, y0, x1, y1) => ({ k: 'l', x0, y0, x1, y1 });
  const A = (acx, acy, r, a0, a1) => ({ k: 'a', acx, acy, r, a0, a1 });
  const rad = (d) => (d * Math.PI) / 180;

  function offsetSeg(s, h) {
    if (s.k === 'l') {
      const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * h, ny = (dx / len) * h;
      return L(s.x0 + nx, s.y0 + ny, s.x1 + nx, s.y1 + ny);
    }
    // Travelling with increasing angle puts the left-hand normal on the inside
    // of the circle, so a left offset shrinks the radius; travelling the other
    // way it grows.
    return A(s.acx, s.acy, s.r + (s.a1 > s.a0 ? -h : h), s.a0, s.a1);
  }
  const offsetAll = (segs, h) => segs.map((s) => offsetSeg(s, h));

  function reverseSegs(segs) {
    return segs
      .slice()
      .reverse()
      .map((s) => (s.k === 'l' ? L(s.x1, s.y1, s.x0, s.y0) : A(s.acx, s.acy, s.r, s.a1, s.a0)));
  }

  const startOf = (s) => (s.k === 'l'
    ? [s.x0, s.y0]
    : [s.acx + s.r * Math.cos(rad(s.a0)), s.acy + s.r * Math.sin(rad(s.a0))]);
  const endOf = (s) => (s.k === 'l'
    ? [s.x1, s.y1]
    : [s.acx + s.r * Math.cos(rad(s.a1)), s.acy + s.r * Math.sin(rad(s.a1))]);

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

  // Reversing travel flips the normal, so offsetting the reversed list by the
  // same amount traces the opposite edge backwards, which closes the band.
  const bandFill = (segs, h) =>
    `${pathOf(offsetAll(segs, h))} ${pathOf(offsetAll(reverseSegs(segs), h), false)} Z`;
  const bandEdges = (segs, h) => [pathOf(offsetAll(segs, h)), pathOf(offsetAll(segs, -h))];
  // A lane inside a band, as a path a movement can follow.
  const lane = (segs, h) => pathOf(offsetAll(segs, h));

  const mirror = (segs) =>
    segs.map((s) => (s.k === 'l'
      ? L(W - s.x0, H - s.y0, W - s.x1, H - s.y1)
      : A(W - s.acx, H - s.acy, s.r, s.a0 + 180, s.a1 + 180)));

  // ── the northwest quadrant ──────────────────────────────────────────────
  // Loop on-ramp to the southbound carriageway. Entered heading north out of
  // the terminal's north leg, 180 degrees around, merging southbound north of
  // the arterial and crossing it on the freeway structure.
  const LOOP_H = 9;
  const nwLoop = [
    L(182, edgeN, 182, 120),
    A(230.5, 120, 48.5, 180, 360),
    L(279, 120, 279, 168),
  ];
  // Outer off-ramp from the southbound carriageway. It passes above the loop
  // rather than through it, which is the whole geometry of a parclo A: the
  // outer ramp and the loop share a quadrant without crossing.
  const OFF_H = 13;
  const nwOff = [
    L(287, 8, 287, 22),
    A(269, 22, 18, 0, 90),
    L(269, 40, 170, 40),
    A(170, 58, 18, 270, 180),
    L(152, 58, 152, edgeN),
  ];
  // The two-way ramp roadway between the quadrant and the terminal.
  const legN = { x: 139, y: 110, w: 52, h: edgeN - 110 };

  const seLoop = mirror(nwLoop);
  const seOff = mirror(nwOff);
  const legS = { x: W - legN.x - legN.w, y: edgeS, w: legN.w, h: legN.h };

  // Ramp lane centres, as offsets from each centreline. On a two-way ramp the
  // off-ramp keeps right, so its two lanes sit on the same side throughout and
  // the left-turn lane is the inner one.
  const OFF_LEFT = -6, OFF_RIGHT = 6, LOOP_A = -4, LOOP_B = 4;

  // ── O-D paths ───────────────────────────────────────────────────────────
  // Each is one continuous path so the animation can run a vehicle along it.
  const P = {
    // A: NB off-ramp left, then west along the internal link and out.
    A: `${lane(seOff, OFF_LEFT)} Q ${W - 158},${wbIn} ${xE - 30},${wbIn} L 0,${wbIn}`,
    // B: NB off-ramp right, straight out to the east.
    B: `${lane(seOff, OFF_RIGHT)} Q ${W - 146},${ebOut} ${xE + 30},${ebOut} L ${W},${ebOut}`,
    // C: SB off-ramp right, straight out to the west.
    C: `${lane(nwOff, OFF_RIGHT)} Q 146,${wbOut} ${xW - 30},${wbOut} L 0,${wbOut}`,
    // D: SB off-ramp left, then east along the internal link and out.
    D: `${lane(nwOff, OFF_LEFT)} Q 158,${ebIn} ${xW + 30},${ebIn} L ${W},${ebIn}`,
    // E: EB the whole way, then the internal shared through-and-right at the
    // east terminal onto the southeast loop, which returns it northbound.
    E: `M 0,${ebOut} L ${xE - 30},${ebOut} Q ${xE + 4},${ebOut} ${W - 182},${edgeS} ${lane(seLoop, LOOP_A).replace(/^M[^ ]* /, 'L ')}`,
    // F: EB external left at the west terminal onto the northwest loop.
    F: `M 0,${ebIn} L ${xW - 34},${ebIn} Q ${xW - 4},${ebIn} 182,${edgeN} ${lane(nwLoop, LOOP_B).replace(/^M[^ ]* /, 'L ')}`,
    // G: WB external left at the east terminal onto the southeast loop.
    G: `M ${W},${wbIn} L ${xE + 34},${wbIn} Q ${xE + 4},${wbIn} ${W - 182},${edgeS} ${lane(seLoop, LOOP_B).replace(/^M[^ ]* /, 'L ')}`,
    // H: WB the whole way, then the internal shared through-and-right at the
    // west terminal onto the northwest loop, which returns it southbound.
    H: `M ${W},${wbOut} L ${xW + 30},${wbOut} Q ${xW - 4},${wbOut} 182,${edgeN} ${lane(nwLoop, LOOP_A).replace(/^M[^ ]* /, 'L ')}`,
    I: `M 0,${ebMid} L ${W},${ebMid}`,
    J: `M ${W},${wbMid} L 0,${wbMid}`,
  };

  const GROUPS = [
    { key: 'SBOFF', label: 'SB off-ramp (C, D)', ods: ['c', 'd'], cls: 'sboff' },
    { key: 'NBOFF', label: 'NB off-ramp (A, B)', ods: ['a', 'b'], cls: 'nboff' },
    { key: 'EB', label: 'EB arterial (E, F, I)', ods: ['e', 'f', 'i'], cls: 'ebg' },
    { key: 'WB', label: 'WB arterial (G, H, J)', ods: ['g', 'h', 'j'], cls: 'wbg' },
  ];
  const groupOf = { a: 'NBOFF', b: 'NBOFF', c: 'SBOFF', d: 'SBOFF', e: 'EB', f: 'EB', i: 'EB', g: 'WB', h: 'WB', j: 'WB' };
  const BASE_COLOR = { NBOFF: '#2563eb', SBOFF: '#16a34a', EB: '#ea7317', WB: '#dc2626' };
  const clsOf = { NBOFF: 'nboff', SBOFF: 'sboff', EB: 'ebg', WB: 'wbg' };

  let volOf = $derived(Object.fromEntries((odDemands || []).map((d) => [d.key, Number(d.value) || 0])));
  let losOf = $derived(odLos || {});
  // After a run the movement colour carries LOS instead of identity, and the
  // chip swatch follows it so the legend never disagrees with the picture.
  let colorOf = $derived((letter) => LOS_COLORS[losOf[letter]] ?? BASE_COLOR[groupOf[letter.toLowerCase()]]);
  // A chip stands for two or three O-Ds, so after a run it takes the colour and
  // the letter of the poorest of them rather than picking one arbitrarily.
  const WORST = (a, b) => (a && b ? (a > b ? a : b) : a || b);
  let groupLos = $derived((g) => g.ods
    .map((k) => losOf[k.toUpperCase()])
    .reduce((acc, x) => WORST(acc, x), null));
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
    if (hovered == null) return 'pc-move';
    return hovered === group ? 'pc-move active' : 'pc-move dim';
  }

  // Equation 23-50 on the loop ramp, with the 5 s deceleration/acceleration
  // term a loop movement always carries.
  let loopEdtt = $derived(Number(loopSpeed) > 0
    ? Number(loopDist) / (1.47 * Number(loopSpeed)) + 5
    : 0);
  // Split across short lines because the only column of the drawing with no
  // pavement in it is narrower than one run of this text.
  let loopNote = $derived((dir) => `${dir} loop on-ramp`);
  let loopGeom = $derived(`${Math.round(Number(loopDist)).toLocaleString()} ft · ${loopSpeed} mi/h`);
  let loopEdttNote = $derived(`EDTT ${loopEdtt.toFixed(1)} s`);

  let ariaLabel = $derived(
    'Parclo A-2Q interchange, plan view. Freeway north-south with separate carriageways crossing '
    + 'the east-west arterial between two signalized ramp terminals '
    + `${Math.round(Number(spacingFt)).toLocaleString()} feet apart. `
    + 'Ramps occupy the northwest and southeast quadrants, each with an outer off-ramp and a loop on-ramp.'
  );

  // ── illustrative traffic, per-O-D LOS ──
  let animating = $state(false);
  const LOS_SPEED = { A: 1, B: 0.85, C: 0.7, D: 0.5, E: 0.32, F: 0.16 };
  const LOS_FLEET = { A: 1, B: 1, C: 1.1, D: 1.3, E: 1.7, F: 2.3 };
  let vehiclePlan = $derived((() => {
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
          id: it.k + j, letter: it.letter, group: it.group, d: it.d,
          dur: it.dur, begin: (-(j + 0.4 * (j % 2)) / n) * it.dur,
        });
      }
    }
    return items;
  })());

  const CW = 118, CH = 24;
  const clusterPos = {
    SBOFF: { x: 4, y: 4 },
    WB: { x: W - CW - 4, y: 4 },
    EB: { x: 4, y: H - CH - 4 },
    NBOFF: { x: W - CW - 4, y: H - CH - 4 },
  };
</script>

<div class="pc-diagram">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>

    <!-- ══ pavement (fills only) ══ -->
    <rect x="0" y={edgeN} width={W} height={half * 2} class="pc-pavement" />
    <rect x={legN.x} y={legN.y} width={legN.w} height={legN.h} class="pc-pavement" />
    <rect x={legS.x} y={legS.y} width={legS.w} height={legS.h} class="pc-pavement" />
    <path d={bandFill(nwOff, OFF_H)} class="pc-pavement" />
    <path d={bandFill(seOff, OFF_H)} class="pc-pavement" />
    <path d={bandFill(nwLoop, LOOP_H)} class="pc-pavement" />
    <path d={bandFill(seLoop, LOOP_H)} class="pc-pavement" />
    <!-- the freeway crosses the arterial on structure, so it is drawn over it -->
    <rect x={sbW} y="0" width={FWY} height={H} class="pc-freeway" />
    <rect x={nbW} y="0" width={FWY} height={H} class="pc-freeway" />

    <!-- ══ edges (separate from every fill above) ══ -->
    {#each [...bandEdges(nwOff, OFF_H), ...bandEdges(seOff, OFF_H), ...bandEdges(nwLoop, LOOP_H), ...bandEdges(seLoop, LOOP_H)] as d}
      <path {d} class="pc-edge" fill="none" />
    {/each}
    {#each [sbW, sbE, nbW, nbE] as x}
      <line x1={x} y1="0" x2={x} y2={H} class="pc-edge" />
    {/each}
    <!-- arterial edges, interrupted where the freeway passes over -->
    {#each [edgeN, edgeS] as y}
      <line x1="0" y1={y} x2={sbW} y2={y} class="pc-edge" />
      <line x1={nbE} y1={y} x2={W} y2={y} class="pc-edge" />
    {/each}
    <line x1={sbW} y1={edgeN} x2={nbE} y2={edgeN} class="pc-edge under" />
    <line x1={sbW} y1={edgeS} x2={nbE} y2={edgeS} class="pc-edge under" />
    <!-- ramp leg edges -->
    <line x1={legN.x} y1={legN.y} x2={legN.x} y2={edgeN} class="pc-edge" />
    <line x1={legN.x + legN.w} y1={legN.y} x2={legN.x + legN.w} y2={edgeN} class="pc-edge" />
    <line x1={legS.x} y1={edgeS} x2={legS.x} y2={legS.y + legS.h} class="pc-edge" />
    <line x1={legS.x + legS.w} y1={edgeS} x2={legS.x + legS.w} y2={legS.y + legS.h} class="pc-edge" />

    <!-- ══ lane lines and centrelines ══ -->
    {#each Array.from({ length: nLanes - 1 }) as _, i}
      <line x1="0" y1={cy + half - LANE * (i + 1)} x2={xW - 34} y2={cy + half - LANE * (i + 1)} class="pc-lane-line" />
      <line x1={xE + 34} y1={cy + half - LANE * (i + 1)} x2={W} y2={cy + half - LANE * (i + 1)} class="pc-lane-line" />
      <line x1="0" y1={cy - half + LANE * (i + 1)} x2={xW - 34} y2={cy - half + LANE * (i + 1)} class="pc-lane-line" />
      <line x1={xE + 34} y1={cy - half + LANE * (i + 1)} x2={W} y2={cy - half + LANE * (i + 1)} class="pc-lane-line" />
    {/each}
    <line x1="0" y1={cy} x2={xW - 14} y2={cy} class="pc-center" />
    <line x1={xW + 14} y1={cy} x2={sbW} y2={cy} class="pc-center" />
    <line x1={nbE} y1={cy} x2={xE - 14} y2={cy} class="pc-center" />
    <line x1={xE + 14} y1={cy} x2={W} y2={cy} class="pc-center" />
    <!-- the two-way ramp roadways are divided, not lane-lined -->
    <line x1={legN.x + legN.w / 2} y1={legN.y} x2={legN.x + legN.w / 2} y2={edgeN - 12} class="pc-center" />
    <line x1={legS.x + legS.w / 2} y1={edgeS + 12} x2={legS.x + legS.w / 2} y2={legS.y + legS.h} class="pc-center" />

    <!-- Freeway direction. Which carriageway is which is not decoration here:
         it is what makes the northwest quadrant the one that serves
         southbound and the southeast quadrant the one that serves
         northbound. -->
    <path d="M {(sbW + sbE) / 2},{H - 26} l -5,-10 h 10 Z" class="pc-arrow" />
    <text x={(sbW + sbE) / 2} y={H - 40} class="pc-label mid">I-75 SB</text>
    <path d="M {(nbW + nbE) / 2},26 l -5,10 h 10 Z" class="pc-arrow" />
    <text x={(nbW + nbE) / 2} y="50" class="pc-label mid">I-75 NB</text>

    <!-- signalized terminal nodes -->
    <circle cx={xW} cy={cy} r="5" class="pc-signal" />
    <circle cx={xE} cy={cy} r="5" class="pc-signal" />

    <!-- terminal spacing D -->
    <line x1={xW} y1={edgeN - 18} x2={xE} y2={edgeN - 18} class="pc-dim" />
    <line x1={xW} y1={edgeN - 23} x2={xW} y2={edgeN - 13} class="pc-dim" />
    <line x1={xE} y1={edgeN - 23} x2={xE} y2={edgeN - 13} class="pc-dim" />
    <text x={cx} y={edgeN - 23} class="pc-label mid">D = {Math.round(Number(spacingFt)).toLocaleString()} ft</text>

    <!-- ══ O-D movement paths ══ -->
    {#each Object.entries(P) as [letter, d]}
      {@const group = groupOf[letter.toLowerCase()]}
      {#if (volOf[letter.toLowerCase()] || 0) > 0}
        <path {d} class={cls(group)} data-od={letter} data-los={losOf[letter] ?? ''} style="stroke: {colorOf(letter)}" />
      {/if}
    {/each}

    <!-- ══ vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class="pc-veh" class:dim={hovered != null && hovered !== v.group}>
          <rect x="-4.5" y="-2.4" width="9" height="4.8" rx="1.4" fill={colorOf(v.letter)} />
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s" path={v.d} />
        </g>
      {/each}
    {/if}

    <!-- ══ labels ══ -->
    <text x="6" y={edgeN - 8} class="pc-label">Newberry Avenue (arterial)</text>
    <!-- Kept clear of the quadrant pavement rather than laid over it, so the
         ramp outlines stay readable at the size this renders at. -->
    {#each ['NW quadrant', loopNote('SB'), loopGeom, loopEdttNote] as line, i}
      <text x="6" y={92 + i * 12} class="pc-label">{line}</text>
    {/each}
    {#each ['SE quadrant', loopNote('NB'), loopGeom, loopEdttNote] as line, i}
      <text x={W - 6} y={H - 128 + i * 12} class="pc-label end">{line}</text>
    {/each}

    <!-- ══ grouped O-D editors ══ -->
    {#each editable ? GROUPS : [] as g (g.key)}
      <foreignObject x={clusterPos[g.key].x} y={clusterPos[g.key].y} width={CW} height={CH}>
        <div class="pc-cluster" xmlns="http://www.w3.org/1999/xhtml">
          <span class="pc-cluster-title"><span class="swatch" style="background: {groupColorOf(g)}"></span>{clusterTitle(g)}</span>
          {#each g.ods as k}
            <input type="number" min="0" title="O-D {k.toUpperCase()} demand (veh/h)"
                   aria-label="O-D {k.toUpperCase()} demand"
                   value={volOf[k] ?? 0}
                   onmouseenter={() => (hovered = g.key)}
                   onmouseleave={() => (hovered = null)}
                   onfocus={() => (hovered = g.key)}
                   onblur={() => (hovered = null)}
                   oninput={(e) => setOd(k, e.currentTarget.value)} />
          {/each}
        </div>
      </foreignObject>
    {/each}
  </svg>

  <div class="pc-legend">
    <button type="button" class="pc-chip pc-animate" class:active={animating}
            aria-pressed={animating} onclick={() => (animating = !animating)}>
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each GROUPS as g (g.key)}
      <button
        type="button"
        class="pc-chip chip-{g.cls}"
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
  <p class="pc-note">Both loop on-ramps are entered from the arterial, which is what makes this a parclo A: O-Ds F and G turn left at the near terminal, and O-Ds E and H run the full arterial and turn right at the far terminal. Both pay the Equation 23-50 extra distance travel time shown on the quadrant. Demands are editable on the picture, movement colour carries O-D LOS after a run, and animated traffic slows with it. An illustration, not a simulation.</p>
</div>

<style>
  .pc-diagram svg {
    width: 100%;
    max-width: 640px;
    display: block;
    margin: 0 auto;
  }
  .pc-pavement { fill: var(--diag-pavement); }
  .pc-freeway { fill: var(--diag-pavement-alt); }
  .pc-edge { stroke: var(--diag-edge); stroke-width: 1.5; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .pc-edge.under { stroke: var(--diag-dim); stroke-dasharray: 4 4; }
  .pc-center { stroke: var(--diag-center); stroke-width: 1.25; vector-effect: non-scaling-stroke; }
  .pc-lane-line { stroke: var(--diag-lane-line); stroke-width: 1.25; stroke-dasharray: 8 6; vector-effect: non-scaling-stroke; }
  .pc-dim { stroke: var(--diag-dim); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .pc-arrow { fill: var(--diag-center); }
  .pc-signal { fill: var(--diag-center); stroke: var(--diag-edge); stroke-width: 1.25; }

  .pc-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.78;
  }
  .pc-move.dim { opacity: 0.08; }
  .pc-move.active { stroke-width: 4; opacity: 1; }

  .pc-veh rect { stroke: rgba(15, 23, 42, 0.35); stroke-width: 0.6; }
  .pc-veh { transition: opacity 120ms ease; }
  .pc-veh.dim { opacity: 0.08; }

  .pc-label { font-size: 9px; fill: var(--text-muted); }
  .pc-label.mid { text-anchor: middle; }
  .pc-label.end { text-anchor: end; }

  .pc-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
  .pc-chip {
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
  .pc-chip.active { border-color: var(--diag-edge); }
  .pc-animate { cursor: pointer; font-weight: 600; }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
  .pc-note { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.35rem; }

  .pc-cluster {
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
  .pc-cluster-title { display: inline-flex; align-items: center; gap: 2px; font-size: 7px; font-weight: 600; flex: none; }
  .pc-cluster input {
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
  .pc-cluster input::-webkit-outer-spin-button,
  .pc-cluster input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .pc-cluster input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
  .pc-cluster .swatch { width: 6px; height: 6px; }
</style>
