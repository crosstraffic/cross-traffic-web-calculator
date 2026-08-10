<script>
  // Interactive plan view of one urban street segment (HCM Chapter 18) between
  // its two boundary intersections. The subject direction of travel runs left
  // to right below the centerline, the opposing direction above it, and the
  // cross streets at either end are the boundary intersections; the downstream
  // one carries signal heads when its control is signalized. Access-point
  // driveways are placed from the per-side counts, and the curb and on-street
  // parking bands cover the share of the link length their proportions give.
  // The through demand and the access-point counts are editable on the
  // picture, and after a run the through traffic animates at a speed that
  // falls with segment LOS.
  import { LOS_COLORS } from './los.js';

  let {
    segmentLength = 1800,
    nThroughLanes = 2,
    accessSubject = $bindable(4),
    accessOpposing = $bindable(4),
    throughDemand = $bindable(968),
    pctCurb = 70,
    pctParking = 0,
    control = 'signalized',
    los = null,
    editable = true
  } = $props();

  const W = 520, H = 320;
  const LANE = 13;
  const cy = 137;                      // arterial centerline
  const xW = 74, xE = 446;             // boundary intersection centers
  const CROSS = 24;                    // cross-street half width
  const CROSS_N = 28, CROSS_S = 246;   // cross-street stub extent
  const DW = 16;                       // driveway stub length beyond the curb
  const DIM_Y = 262;

  let nLanes = $derived(Math.max(1, Math.min(4, Number(nThroughLanes) || 1)));
  let half = $derived(nLanes * LANE);
  let edgeS = $derived(cy + half);
  let edgeN = $derived(cy - half);

  // Parking sits outside the travel way and the curb outside the parking, so
  // the driveways have to reach across both to meet the street.
  let parkDepth = $derived(Number(pctParking) > 0 ? 6 : 0);
  let curbOff = $derived(parkDepth + 4);

  let subLane = $derived((i) => cy + (i + 0.5) * LANE);
  let oppLane = $derived((i) => cy - (i + 0.5) * LANE);

  // The three spans of arterial that are not under a cross street. Edges,
  // lane lines, and the centerline are drawn per span so nothing is painted
  // across an intersection.
  let spans = $derived([
    [0, xW - CROSS],
    [xW + CROSS, xE - CROSS],
    [xE + CROSS, W]
  ]);
  let linkA = $derived(xW + CROSS);
  let linkB = $derived(xE - CROSS);

  let nSub = $derived(Math.max(0, Math.round(Number(accessSubject) || 0)));
  let nOpp = $derived(Math.max(0, Math.round(Number(accessOpposing) || 0)));
  let subDriveways = $derived(Array.from({ length: nSub }, (_, k) => linkA + ((linkB - linkA) * (k + 1)) / (nSub + 1)));
  let oppDriveways = $derived(Array.from({ length: nOpp }, (_, k) => linkA + ((linkB - linkA) * (k + 1)) / (nOpp + 1)));

  let curbLen = $derived(((linkB - linkA) * Math.max(0, Math.min(100, Number(pctCurb) || 0))) / 100);
  let parkLen = $derived(((linkB - linkA) * Math.max(0, Math.min(100, Number(pctParking) || 0))) / 100);
  // Parking stall ticks every 14 units, so an 80% band reads as longer than a 20% one.
  let parkTicks = $derived(Array.from({ length: Math.floor(parkLen / 14) }, (_, k) => linkA + (k + 1) * 14));

  let signalized = $derived(control === 'signalized');
  let stopControlled = $derived(control !== 'uncontrolled');

  let losFill = $derived(los ? LOS_COLORS[los] : null);
  let lengthLabel = $derived(`${Math.round(Number(segmentLength) || 0).toLocaleString('en-US')} ft`);

  let ariaLabel = $derived(
    `urban street segment, ${nLanes} through lane${nLanes === 1 ? '' : 's'} each direction, ` +
    `${nSub} subject and ${nOpp} opposing access points, ${signalized ? 'signalized' : control} downstream boundary` +
    (los ? `, segment LOS ${los}` : '')
  );

  // ── illustrative traffic on the subject through movement ──
  let animating = $state(false);
  const LOS_SPEED = { A: 1, B: 0.85, C: 0.7, D: 0.5, E: 0.32, F: 0.16 };
  const LOS_FLEET = { A: 1, B: 1, C: 1.15, D: 1.35, E: 1.7, F: 2.2 };
  let vehiclePlan = $derived((() => {
    if (!animating) return [];
    const demand = Math.max(0, Number(throughDemand) || 0);
    const slow = LOS_SPEED[los] ?? 1;
    const crowd = LOS_FLEET[los] ?? 1;
    const perLane = Math.max(2, Math.min(9, Math.round((demand * crowd) / (220 * nLanes))));
    const dur = 6 / slow;
    const items = [];
    for (let i = 0; i < nLanes; i++) {
      const y = subLane(i);
      for (let j = 0; j < perLane; j++) {
        items.push({
          id: `${i}-${j}`,
          d: `M -14,${y.toFixed(1)} L ${W + 14},${y.toFixed(1)}`,
          dur,
          begin: (-(j + 0.45 * (i % 2)) / perLane) * dur
        });
      }
    }
    return items;
  })());

  function bump(which, delta) {
    if (which === 'sub') accessSubject = Math.max(0, nSub + delta);
    else accessOpposing = Math.max(0, nOpp + delta);
  }
</script>

<div class="us-diagram">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>

    <!-- ══ pavement (fills only) ══ -->
    <rect x="0" y={edgeN} width={W} height={half * 2} class="us-pavement" />
    <rect x={xW - CROSS} y={CROSS_N} width={CROSS * 2} height={CROSS_S - CROSS_N} class="us-cross" />
    <rect x={xE - CROSS} y={CROSS_N} width={CROSS * 2} height={CROSS_S - CROSS_N} class="us-cross" />

    <!-- on-street parking bands, both curbs -->
    {#if parkDepth > 0}
      <rect x={linkA} y={edgeS} width={parkLen} height={parkDepth} class="us-parking" />
      <rect x={linkA} y={edgeN - parkDepth} width={parkLen} height={parkDepth} class="us-parking" />
      {#each parkTicks as tx}
        <line x1={tx} y1={edgeS} x2={tx} y2={edgeS + parkDepth} class="us-park-tick" />
        <line x1={tx} y1={edgeN - parkDepth} x2={tx} y2={edgeN} class="us-park-tick" />
      {/each}
    {/if}

    <!-- LOS tint on the subject travel lanes, under the markings -->
    {#if losFill}
      <rect x="0" y={cy} width={W} height={half} fill={losFill} class="us-los-tint" />
    {/if}

    <!-- ══ markings ══ -->
    {#each spans as [x0, x1]}
      <line x1={x0} y1={edgeN} x2={x1} y2={edgeN} class="us-edge" />
      <line x1={x0} y1={edgeS} x2={x1} y2={edgeS} class="us-edge" />
      <line x1={x0} y1={cy} x2={x1} y2={cy} class="us-center" />
      {#each Array.from({ length: nLanes - 1 }) as _, i}
        <line x1={x0} y1={cy + LANE * (i + 1)} x2={x1} y2={cy + LANE * (i + 1)} class="us-lane-line" />
        <line x1={x0} y1={cy - LANE * (i + 1)} x2={x1} y2={cy - LANE * (i + 1)} class="us-lane-line" />
      {/each}
    {/each}

    <!-- cross-street edges, clear of the arterial -->
    {#each [xW, xE] as xc}
      <line x1={xc - CROSS} y1={CROSS_N} x2={xc - CROSS} y2={edgeN} class="us-edge" />
      <line x1={xc + CROSS} y1={CROSS_N} x2={xc + CROSS} y2={edgeN} class="us-edge" />
      <line x1={xc - CROSS} y1={edgeS} x2={xc - CROSS} y2={CROSS_S} class="us-edge" />
      <line x1={xc + CROSS} y1={edgeS} x2={xc + CROSS} y2={CROSS_S} class="us-edge" />
      <line x1={xc} y1={CROSS_N} x2={xc} y2={edgeN} class="us-center" />
      <line x1={xc} y1={edgeS} x2={xc} y2={CROSS_S} class="us-center" />
    {/each}

    <!-- curb, over the share of the link length that has one -->
    {#if curbLen > 0}
      <line x1={linkA} y1={edgeS + curbOff} x2={linkA + curbLen} y2={edgeS + curbOff} class="us-curb" />
      <line x1={linkA} y1={edgeN - curbOff} x2={linkA + curbLen} y2={edgeN - curbOff} class="us-curb" />
    {/if}

    <!-- access-point driveways, reaching across the parking and curb bands -->
    {#each subDriveways as dx}
      <rect x={dx - 5.5} y={edgeS} width="11" height={curbOff + DW} class="us-drive" />
      <line x1={dx - 5.5} y1={edgeS} x2={dx - 5.5} y2={edgeS + curbOff + DW} class="us-edge" />
      <line x1={dx + 5.5} y1={edgeS} x2={dx + 5.5} y2={edgeS + curbOff + DW} class="us-edge" />
    {/each}
    {#each oppDriveways as dx}
      <rect x={dx - 5.5} y={edgeN - curbOff - DW} width="11" height={curbOff + DW} class="us-drive" />
      <line x1={dx - 5.5} y1={edgeN - curbOff - DW} x2={dx - 5.5} y2={edgeN} class="us-edge" />
      <line x1={dx + 5.5} y1={edgeN - curbOff - DW} x2={dx + 5.5} y2={edgeN} class="us-edge" />
    {/each}

    <!-- stop lines at the boundary intersections -->
    {#if stopControlled}
      <line x1={xE - CROSS - 2} y1={cy} x2={xE - CROSS - 2} y2={edgeS} class="us-stop" />
      <line x1={xW + CROSS + 2} y1={edgeN} x2={xW + CROSS + 2} y2={cy} class="us-stop" />
    {/if}

    <!-- signal heads on the downstream boundary intersection -->
    {#if signalized}
      {#each [{ x: xE - CROSS + 8, y: edgeS + 10 }, { x: xE + CROSS - 8, y: edgeN - 32 }] as h}
        <rect x={h.x - 4.5} y={h.y} width="9" height="22" rx="2.5" class="us-signal" />
        <circle cx={h.x} cy={h.y + 5} r="2.1" class="us-signal-r" />
        <circle cx={h.x} cy={h.y + 11} r="2.1" class="us-signal-y" />
        <circle cx={h.x} cy={h.y + 17} r="2.1" class="us-signal-g" />
      {/each}
    {/if}

    <!-- ══ vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class="us-veh">
          <rect x="-5" y="-2.6" width="10" height="5.2" rx="1.5" />
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" begin="{v.begin}s" path={v.d} />
        </g>
      {/each}
    {/if}

    <!-- ══ annotation ══ -->
    <!-- Direction labels sit in the clear band between the arterial and the
         cross-street stub ends, so they never land on pavement or a driveway. -->
    <text x={(xW + xE) / 2} y={edgeN - curbOff - DW - 8} class="us-label mid">← Opposing direction of travel</text>
    <text x={(xW + xE) / 2} y={edgeS + curbOff + DW + 16} class="us-label mid">Subject direction of travel →</text>

    <line x1={xW} y1={DIM_Y} x2={xE} y2={DIM_Y} class="us-dim" />
    <line x1={xW} y1={DIM_Y - 5} x2={xW} y2={DIM_Y + 5} class="us-dim" />
    <line x1={xE} y1={DIM_Y - 5} x2={xE} y2={DIM_Y + 5} class="us-dim" />
    <text x={(xW + xE) / 2} y={DIM_Y - 8} class="us-label mid">{lengthLabel} between boundary intersections</text>
    <text x={xW} y={DIM_Y + 18} class="us-label mid">Upstream boundary</text>
    <text x={xE} y={DIM_Y + 18} class="us-label mid">{signalized ? 'Downstream (signalized)' : 'Downstream boundary'}</text>

    <!-- ══ on-diagram editors ══ -->
    {#if editable}
      <foreignObject x={W - 150} y="2" width="146" height="20">
        <div class="us-edit" xmlns="http://www.w3.org/1999/xhtml">
          <span class="us-edit-title">Opp. access pts</span>
          <button type="button" aria-label="One fewer opposing access point" onclick={() => bump('opp', -1)}>−</button>
          <input type="number" min="0" aria-label="Opposing access points" value={nOpp}
                 oninput={(e) => (accessOpposing = Math.max(0, Number(e.currentTarget.value) || 0))} />
          <button type="button" aria-label="One more opposing access point" onclick={() => bump('opp', 1)}>+</button>
        </div>
      </foreignObject>

      <foreignObject x="4" y={H - 32} width="146" height="20">
        <div class="us-edit" xmlns="http://www.w3.org/1999/xhtml">
          <span class="us-edit-title">Subj. access pts</span>
          <button type="button" aria-label="One fewer subject access point" onclick={() => bump('sub', -1)}>−</button>
          <input type="number" min="0" aria-label="Subject access points" value={nSub}
                 oninput={(e) => (accessSubject = Math.max(0, Number(e.currentTarget.value) || 0))} />
          <button type="button" aria-label="One more subject access point" onclick={() => bump('sub', 1)}>+</button>
        </div>
      </foreignObject>

      <foreignObject x={W - 168} y={H - 32} width="164" height="20">
        <div class="us-edit" xmlns="http://www.w3.org/1999/xhtml">
          <span class="us-edit-title">Through demand</span>
          <input type="number" min="0" class="wide" aria-label="Through demand" value={throughDemand}
                 oninput={(e) => (throughDemand = e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))} />
          <span class="us-edit-unit">veh/h</span>
        </div>
      </foreignObject>
    {/if}
  </svg>

  {#if editable}
    <div class="us-legend">
      <button type="button" class="us-chip us-animate" class:active={animating}
              aria-pressed={animating} onclick={() => (animating = !animating)}>
        {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
      </button>
      {#if los}
        <span class="us-chip"><span class="swatch" style="background: {losFill}"></span>Segment LOS {los}</span>
      {/if}
    </div>
    <p class="us-note">
      Plan view of the segment between its boundary intersections, drawn from the geometry inputs.
      Driveway positions are spaced evenly for legibility; the method uses only the counts. Animated
      traffic slows as segment LOS worsens. An illustration, not a simulation.
    </p>
  {/if}
</div>

<style>
  .us-diagram svg {
    width: 100%;
    max-width: 560px;
    display: block;
    margin: 0 auto;
  }
  .us-pavement { fill: var(--diag-pavement); }
  .us-cross { fill: var(--diag-pavement-alt); }
  .us-drive { fill: var(--diag-pavement-alt); }
  .us-parking { fill: var(--diag-pavement-alt); }
  .us-park-tick { stroke: var(--diag-edge); stroke-width: 0.8; vector-effect: non-scaling-stroke; }
  .us-los-tint { opacity: 0.32; }
  .us-edge { stroke: var(--diag-edge); stroke-width: 1.5; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .us-curb { stroke: var(--diag-wall-edge); stroke-width: 3.5; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .us-center { stroke: var(--diag-center); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .us-lane-line { stroke: var(--diag-lane-line); stroke-width: 1.25; stroke-dasharray: 8 6; vector-effect: non-scaling-stroke; }
  .us-stop { stroke: var(--diag-lane-line); stroke-width: 3.5; vector-effect: non-scaling-stroke; }
  .us-dim { stroke: var(--diag-dim); stroke-width: 1; vector-effect: non-scaling-stroke; }

  .us-signal { fill: var(--diag-edge); }
  .us-signal-r { fill: #dc2626; }
  .us-signal-y { fill: #eab308; }
  .us-signal-g { fill: #16a34a; }

  .us-veh rect { fill: #2563eb; stroke: rgba(15, 23, 42, 0.35); stroke-width: 0.6; }

  .us-label { font-size: 9px; fill: var(--text-muted); }
  .us-label.mid { text-anchor: middle; }

  .us-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
  .us-chip {
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
  .us-animate { cursor: pointer; font-weight: 600; }
  .us-animate.active { border-color: var(--diag-edge); }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
  .us-note { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.35rem; }

  .us-edit {
    box-sizing: border-box;
    display: flex;
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
  .us-edit-title { font-size: 7px; font-weight: 600; flex: none; }
  .us-edit-unit { font-size: 7px; flex: none; }
  .us-edit button {
    flex: none;
    width: 11px;
    height: 12px;
    font-size: 9px;
    line-height: 1;
    border: 1px solid var(--border-strong);
    border-radius: 3px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
  }
  .us-edit input {
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
  .us-edit input::-webkit-outer-spin-button,
  .us-edit input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .us-edit input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
</style>
