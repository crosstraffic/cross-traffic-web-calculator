<script>
  // Interactive plan view of a ramp-freeway junction. Geometry follows the
  // form inputs; hovering the legend highlights the ramp or the two-lane
  // ramp influence area the Chapter 14 method evaluates.
  export let rampType = 'on_ramp';
  export let rampSide = 'right';
  export let rampLanes = 1;
  export let freewayLanes = 3;
  export let accelLen = 800;
  export let decelLen = 400;

  let hovered = null; // 'ramp' | 'influence' | null

  $: lanes = Math.max(2, Math.min(5, Number(freewayLanes) || 3));
  $: isOn = rampType === 'on_ramp' || rampType === 'major_merge';
  $: isMajor = rampType === 'major_merge' || rampType === 'major_diverge';
  $: onRight = rampSide !== 'left';
  $: nRamp = Math.max(1, Math.min(2, Number(rampLanes) || 1));

  // Leave room for the ramp on whichever side it joins (it extends up to
  // 36 + 12 * nRamp px beyond the mainline edge).
  $: mainTop = onRight ? 24 : 48 + 12 * nRamp;
  $: mainH = 16 * lanes;
  $: mainBot = mainTop + mainH;
  $: viewH = mainBot + (onRight ? 48 + 12 * nRamp : 24);

  // Speed-change lane length, drawn proportionally and clamped so the taper
  // stays readable: 300 ft .. 1,500 ft maps to 60 .. 200 px.
  $: scl = Math.max(300, Math.min(1500, Number(isOn ? accelLen : decelLen) || 500));
  $: sclPx = 60 + ((scl - 300) / 1200) * 140;

  // Gore position: merges join on the left half, diverges leave on the right.
  $: gore = isOn ? 70 : 250 - sclPx;

  // The influence area covers the two lanes adjacent to the ramp for 1,500 ft
  // from the gore, in the direction of travel.
  $: inflLanes = Math.min(2, lanes);
  $: inflY = onRight ? mainBot - 16 * inflLanes : mainTop;
  $: rampBandY = onRight ? mainBot : mainTop - 16 * nRamp;
</script>

<div class="ramp-diagram">
  <svg viewBox="0 0 320 {viewH}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label={`${lanes}-lane freeway with a ${nRamp}-lane ${onRight ? 'right' : 'left'}-side ${rampType.replace('_', ' ')}`}>
    <!-- mainline -->
    <rect x="0" y={mainTop} width="320" height={mainH} class="rd-pavement" />
    <line x1="0" y1={mainTop} x2="320" y2={mainTop} class="rd-edge" />
    <line x1="0" y1={mainBot} x2="320" y2={mainBot} class="rd-edge" />
    {#each Array.from({ length: lanes - 1 }) as _, i}
      <line x1="0" y1={mainTop + 16 * (i + 1)} x2="320" y2={mainTop + 16 * (i + 1)} class="rd-lane-line" />
    {/each}

    <!-- influence area (lanes 1-2 nearest the ramp) -->
    <rect
      x={isOn ? gore : Math.max(0, gore - 150)}
      y={inflY}
      width="150"
      height={16 * inflLanes}
      class="rd-influence"
      class:active={hovered === 'influence'}
    />

    <!-- ramp + speed-change lane -->
    {#if onRight}
      {#if isOn}
        <polygon points="0,{mainBot + 36} {gore},{mainBot} {gore},{mainBot + 16 * nRamp} 0,{mainBot + 36 + 12 * nRamp}"
                 class="rd-ramp" class:active={hovered === 'ramp'} />
        <polygon points="{gore},{mainBot} {gore + sclPx},{mainBot} {gore},{mainBot + 16 * nRamp}"
                 class="rd-ramp" class:active={hovered === 'ramp'} />
        <text x={gore + 8} y={mainBot + 13} class="rd-label">L_A = {isMajor ? '—' : `${accelLen} ft`}</text>
      {:else}
        <polygon points="{gore},{mainBot} {gore + sclPx},{mainBot} {gore + sclPx},{mainBot + 16 * nRamp} 320,{mainBot + 36 + 12 * nRamp} 320,{mainBot + 36}"
                 class="rd-ramp" class:active={hovered === 'ramp'} />
        <text x={gore + 8} y={mainBot + 13} class="rd-label">L_D = {isMajor ? '—' : `${decelLen} ft`}</text>
      {/if}
    {:else}
      {#if isOn}
        <polygon points="0,{mainTop - 36} {gore},{mainTop} {gore},{mainTop - 16 * nRamp} 0,{mainTop - 36 - 12 * nRamp}"
                 class="rd-ramp" class:active={hovered === 'ramp'} />
        <polygon points="{gore},{mainTop} {gore + sclPx},{mainTop} {gore},{mainTop - 16 * nRamp}"
                 class="rd-ramp" class:active={hovered === 'ramp'} />
      {:else}
        <polygon points="{gore},{mainTop} {gore + sclPx},{mainTop} {gore + sclPx},{mainTop - 16 * nRamp} 320,{mainTop - 36 - 12 * nRamp} 320,{mainTop - 36}"
                 class="rd-ramp" class:active={hovered === 'ramp'} />
      {/if}
    {/if}

    <!-- direction arrow -->
    <polygon points="288,{mainTop + mainH / 2 - 4} 300,{mainTop + mainH / 2} 288,{mainTop + mainH / 2 + 4}" class="rd-arrow" />
  </svg>

  <div class="rd-legend">
    <button type="button" class="rd-chip" class:active={hovered === 'ramp'}
      on:mouseenter={() => (hovered = 'ramp')} on:mouseleave={() => (hovered = null)}
      on:focus={() => (hovered = 'ramp')} on:blur={() => (hovered = null)}>
      <span class="swatch ramp"></span>
      {isOn ? 'On-ramp and acceleration lane' : 'Deceleration lane and off-ramp'} ({nRamp} lane{nRamp === 1 ? '' : 's'}, {onRight ? 'right' : 'left'} side)
    </button>
    <button type="button" class="rd-chip" class:active={hovered === 'influence'}
      on:mouseenter={() => (hovered = 'influence')} on:mouseleave={() => (hovered = null)}
      on:focus={() => (hovered = 'influence')} on:blur={() => (hovered = null)}>
      <span class="swatch influence"></span>
      Ramp influence area (lanes 1–2, 1,500 ft {isOn ? 'downstream' : 'upstream'} of the gore)
    </button>
  </div>
</div>

<style>
  .ramp-diagram svg {
    width: 100%;
    display: block;
  }
  .rd-pavement { fill: #e2e8f0; }
  .rd-ramp {
    fill: #e2e8f0;
    stroke: #334155;
    stroke-width: 1.5;
    transition: fill 120ms ease;
  }
  .rd-ramp.active { fill: #fed7aa; }
  .rd-influence {
    fill: #2563eb;
    opacity: 0.10;
    transition: opacity 120ms ease;
  }
  .rd-influence.active { opacity: 0.30; }
  .rd-edge { stroke: #334155; stroke-width: 2; vector-effect: non-scaling-stroke; }
  .rd-lane-line { stroke: #ffffff; stroke-width: 1.5; stroke-dasharray: 8 6; vector-effect: non-scaling-stroke; }
  .rd-label { font-size: 9px; fill: #64748b; }
  .rd-arrow { fill: #334155; }

  .rd-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
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
