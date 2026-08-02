<script>
  // Interactive plan view of a ramp-freeway junction. Geometry follows the
  // form inputs; hovering the legend highlights the ramp or the two-lane
  // ramp influence area the Chapter 14 method evaluates.
  //
  // The speed-change lane is drawn as a parallel lane: an on-ramp joins at
  // the gore, runs alongside, and tapers out downstream; an off-ramp mirrors
  // that upstream. Left-side ramps mirror the whole junction vertically.
  export let rampType = 'on_ramp';
  export let rampSide = 'right';
  export let rampLanes = 1;
  export let freewayLanes = 3;
  export let accelLen = 800;
  export let decelLen = 400;

  let hovered = null; // 'ramp' | 'influence' | null

  const LANE = 16;   // lane height, px
  const RAMP = 74;   // horizontal run of the ramp band
  const DROP = 42;   // vertical drop of the ramp band over that run
  const TAPER = 32;  // length of the speed-change lane end taper

  $: lanes = Math.max(2, Math.min(5, Number(freewayLanes) || 3));
  $: isOn = rampType === 'on_ramp' || rampType === 'major_merge';
  $: isMajor = rampType === 'major_merge' || rampType === 'major_diverge';
  $: onRight = rampSide !== 'left';
  $: nRamp = Math.max(1, Math.min(2, Number(rampLanes) || 1));

  // Speed-change lane length: 300..1,500 ft maps to 70..170 px.
  $: scl = Math.max(300, Math.min(1500, Number(isOn ? accelLen : decelLen) || 500));
  $: sclPx = 70 + ((scl - 300) / 1200) * 100;

  // Gore x: where the ramp band meets the parallel lane.
  $: gore = isOn ? 84 : 236;

  $: mainTop = onRight ? 20 : DROP + LANE + 30;
  $: mainH = LANE * lanes;
  $: mainBot = mainTop + mainH;
  $: viewH = mainBot + (onRight ? DROP + LANE + 30 : 20);

  // Vertical mirror for left-side ramps: offsets grow away from `edgeY`.
  $: dir = onRight ? 1 : -1;
  $: edgeY = onRight ? mainBot : mainTop;
  $: ry = (offset) => edgeY + dir * offset;

  // Parallel-lane span along the mainline edge.
  $: laneX0 = isOn ? gore : gore - sclPx;
  $: laneX1 = isOn ? gore + sclPx : gore;
  $: taperTip = isOn ? laneX1 + TAPER : laneX0 - TAPER;

  // Influence area: the two lanes nearest the ramp, 1,500 ft from the gore
  // (downstream of a merge, upstream of a diverge).
  $: inflLanes = Math.min(2, lanes);
  $: inflY = onRight ? mainBot - LANE * inflLanes : mainTop;
  $: inflX = isOn ? gore : Math.max(0, gore - 170);
  $: inflW = 170;

  $: dimY = ry(LANE + 18);
  $: labelY = ry(LANE + 30) + (onRight ? 0 : 4);

  // Speed-change lane outline: gore-side end is full width, the other end
  // tapers back to the mainline edge.
  $: sclPoints = isOn
    ? `${laneX0},${ry(0)} ${taperTip},${ry(0)} ${laneX1},${ry(LANE * nRamp)} ${laneX0},${ry(LANE * nRamp)}`
    : `${taperTip},${ry(0)} ${laneX1},${ry(0)} ${laneX1},${ry(LANE * nRamp)} ${laneX0},${ry(LANE * nRamp)}`;
</script>

<div class="ramp-diagram">
  <svg viewBox="0 0 320 {viewH}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label={`${lanes}-lane freeway with a ${nRamp}-lane ${onRight ? 'right' : 'left'}-side ${rampType.replace('_', ' ')}`}>

    <!-- ══ pavement fills (edges drawn separately) ══ -->
    <rect x="0" y={mainTop} width="320" height={mainH} class="rd-pavement" />
    <!-- parallel speed-change lane with its end taper -->
    <polygon points={sclPoints} class="rd-scl" class:active={hovered === 'ramp'} />
    <!-- ramp band joining the gore -->
    {#if isOn}
      <polygon points="{gore - RAMP},{ry(DROP)} {gore},{ry(0)} {gore},{ry(LANE * nRamp)} {gore - RAMP},{ry(DROP + LANE * nRamp)}" class="rd-scl" class:active={hovered === 'ramp'} />
    {:else}
      <polygon points="{gore},{ry(0)} {gore + RAMP},{ry(DROP)} {gore + RAMP},{ry(DROP + LANE * nRamp)} {gore},{ry(LANE * nRamp)}" class="rd-scl" class:active={hovered === 'ramp'} />
    {/if}

    <!-- influence area (lanes 1-2 nearest the ramp) -->
    <rect x={inflX} y={inflY} width={inflW} height={LANE * inflLanes} class="rd-influence" class:active={hovered === 'influence'} />

    <!-- ══ edges and lane lines ══ -->
    {#each Array.from({ length: lanes - 1 }) as _, i}
      <line x1="0" y1={mainTop + LANE * (i + 1)} x2="320" y2={mainTop + LANE * (i + 1)} class="rd-lane-line" />
    {/each}
    <!-- far mainline edge: always solid -->
    <line x1="0" y1={onRight ? mainTop : mainBot} x2="320" y2={onRight ? mainTop : mainBot} class="rd-edge" />
    <!-- ramp-side mainline edge: dashed along the speed-change lane, solid elsewhere -->
    <line x1="0" y1={edgeY} x2={Math.min(laneX0, taperTip)} y2={edgeY} class="rd-edge" />
    <line x1={Math.min(laneX0, taperTip)} y1={edgeY} x2={Math.max(laneX1, taperTip)} y2={edgeY} class="rd-lane-line-dark" />
    <line x1={Math.max(laneX1, taperTip)} y1={edgeY} x2="320" y2={edgeY} class="rd-edge" />
    <!-- lane divider inside a two-lane ramp and its speed-change lanes -->
    {#if nRamp === 2}
      <line x1={laneX0} y1={ry(LANE)} x2={laneX1} y2={ry(LANE)} class="rd-lane-line" />
      {#if isOn}
        <line x1={gore - RAMP} y1={ry(DROP + LANE)} x2={gore} y2={ry(LANE)} class="rd-lane-line" />
      {:else}
        <line x1={gore} y1={ry(LANE)} x2={gore + RAMP} y2={ry(DROP + LANE)} class="rd-lane-line" />
      {/if}
    {/if}
    <!-- outer edge: along the ramp band, the parallel lane, and the taper -->
    {#if isOn}
      <polyline points="{gore - RAMP},{ry(DROP + LANE * nRamp)} {gore},{ry(LANE * nRamp)} {laneX1},{ry(LANE * nRamp)} {taperTip},{ry(0)}" class="rd-edge-path" />
      <line x1={gore - RAMP} y1={ry(DROP)} x2={gore} y2={ry(0)} class="rd-edge" />
    {:else}
      <polyline points="{taperTip},{ry(0)} {laneX0},{ry(LANE * nRamp)} {gore},{ry(LANE * nRamp)} {gore + RAMP},{ry(DROP + LANE * nRamp)}" class="rd-edge-path" />
      <line x1={gore} y1={ry(0)} x2={gore + RAMP} y2={ry(DROP)} class="rd-edge" />
    {/if}

    <!-- direction arrow -->
    <polygon points="298,{mainTop + mainH / 2 - 5} 312,{mainTop + mainH / 2} 298,{mainTop + mainH / 2 + 5}" class="rd-arrow" />

    <!-- ══ speed-change lane dimension, outside the pavement ══ -->
    {#if !isMajor}
      <line x1={laneX0} y1={dimY} x2={laneX1} y2={dimY} class="rd-dim" />
      <line x1={laneX0} y1={ry(LANE * nRamp + 2)} x2={laneX0} y2={ry(LANE + 22)} class="rd-dim" />
      <line x1={laneX1} y1={ry(LANE * nRamp + 2)} x2={laneX1} y2={ry(LANE + 22)} class="rd-dim" />
      <text x={(laneX0 + laneX1) / 2} y={labelY} class="rd-label" text-anchor="middle">{isOn ? `L_A = ${accelLen} ft` : `L_D = ${decelLen} ft`}</text>
    {/if}
  </svg>

  <div class="rd-legend">
    <button type="button" class="rd-chip" class:active={hovered === 'ramp'}
      on:mouseenter={() => (hovered = 'ramp')} on:mouseleave={() => (hovered = null)}
      on:focus={() => (hovered = 'ramp')} on:blur={() => (hovered = null)}>
      <span class="swatch ramp"></span>
      {isOn ? (isMajor ? 'Major merge roadway' : 'On-ramp and acceleration lane') : (isMajor ? 'Major diverge roadway' : 'Deceleration lane and off-ramp')} ({nRamp} lane{nRamp === 1 ? '' : 's'}, {onRight ? 'right' : 'left'} side)
    </button>
    <button type="button" class="rd-chip" class:active={hovered === 'influence'}
      on:mouseenter={() => (hovered = 'influence')} on:mouseleave={() => (hovered = null)}
      on:focus={() => (hovered = 'influence')} on:blur={() => (hovered = null)}>
      <span class="swatch influence"></span>
      Ramp influence area (lanes 1–2, 1,500 ft {isOn ? 'downstream' : 'upstream'} of the gore)
    </button>
    {#if !isMajor}
      <!-- The dimensioned length is editable here; assigning back to the
           exported prop reaches a page that binds accelLen/decelLen. -->
      <label class="rd-chip rd-len">
        {isOn ? 'L_A' : 'L_D'}
        {#if isOn}
          <input type="number" min="0" step="10" aria-label="Acceleration lane length (ft)" bind:value={accelLen} />
        {:else}
          <input type="number" min="0" step="10" aria-label="Deceleration lane length (ft)" bind:value={decelLen} />
        {/if}
        ft
      </label>
    {/if}
  </div>
</div>

<style>
  .ramp-diagram svg {
    width: 100%;
    max-width: 720px;
    display: block;
    margin: 0 auto;
  }
  .rd-pavement { fill: #e2e8f0; }
  .rd-scl {
    fill: #e2e8f0;
    transition: fill 120ms ease;
  }
  .rd-scl.active { fill: #fed7aa; }
  .rd-influence {
    fill: #2563eb;
    opacity: 0.10;
    transition: opacity 120ms ease;
  }
  .rd-influence.active { opacity: 0.30; }
  .rd-edge {
    stroke: #334155;
    stroke-width: 2;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .rd-edge-path {
    fill: none;
    stroke: #334155;
    stroke-width: 2;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .rd-lane-line {
    stroke: #ffffff;
    stroke-width: 1.5;
    stroke-dasharray: 8 6;
    vector-effect: non-scaling-stroke;
  }
  .rd-lane-line-dark {
    stroke: #94a3b8;
    stroke-width: 1.5;
    stroke-dasharray: 8 6;
    vector-effect: non-scaling-stroke;
  }
  .rd-dim { stroke: #64748b; stroke-width: 1; }
  .rd-label { font-size: 9px; fill: #64748b; }
  .rd-arrow { fill: #334155; }

  .rd-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .rd-len input {
    width: 3.6rem;
    font-size: 0.72rem;
    padding: 0.05rem 0.25rem;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: #ffffff;
    color: #0f172a;
    text-align: right;
  }
  .rd-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    padding: 0.15rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    background: transparent;
    cursor: default;
  }
  .rd-chip.active { border-color: #334155; }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
  .swatch.ramp { background: #fed7aa; border: 1px solid #334155; }
  .swatch.influence { background: rgba(37, 99, 235, 0.3); }
</style>
