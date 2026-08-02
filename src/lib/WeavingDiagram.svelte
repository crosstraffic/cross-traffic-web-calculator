<script>
  // Interactive plan view of a weaving segment. The geometry follows the form
  // inputs and each of the four component movements can be highlighted from
  // the legend, so the v_FF/v_FR/v_RF/v_RR inputs have a picture.
  export let weavingType = 'one_sided';
  export let numLanes = 4;
  export let vFF = 0;
  export let vFR = 0;
  export let vRF = 0;
  export let vRR = 0;

  let hovered = null; // 'ff' | 'fr' | 'rf' | 'rr' | null

  // Mainline band: `lanes` mainline lanes drawn at 16 px each, plus the
  // auxiliary/ramp lane below (one-sided) or ramps on both sides (two-sided).
  $: lanes = Math.max(2, Math.min(6, Number(numLanes) || 4));
  $: mainTop = 26;
  $: mainH = 16 * lanes;
  $: mainBot = mainTop + mainH;
  $: viewH = mainBot + 56;
  // Gore x-positions: entry gore at 70, exit gore at 250; the span between
  // them reads as the short length L_S.
  const gIn = 70;
  const gOut = 250;

  $: twoSided = weavingType === 'two_sided';

  // Movement centerlines. One-sided: both ramps on the right (bottom).
  // Two-sided: on-ramp bottom-left, off-ramp top-right, so the ramp-to-ramp
  // movement crosses every mainline lane.
  $: yLaneMid = (i) => mainTop + 16 * i + 8;
  $: rampY = mainBot + 24;

  const movements = [
    { key: 'ff', label: 'v_FF freeway → freeway' },
    { key: 'rf', label: 'v_RF ramp → freeway' },
    { key: 'fr', label: 'v_FR freeway → ramp' },
    { key: 'rr', label: 'v_RR ramp → ramp' },
  ];
  $: volumes = { ff: vFF, rf: vRF, fr: vFR, rr: vRR };

  function cls(h, key) {
    if (h == null) return 'wv-move';
    return h === key ? 'wv-move active' : 'wv-move dim';
  }
</script>

<div class="weave-diagram">
  <svg viewBox="0 0 320 {viewH}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label={`${lanes}-lane ${twoSided ? 'two-sided' : 'one-sided'} weaving segment`}>
    <!-- mainline -->
    <rect x="0" y={mainTop} width="320" height={mainH} class="wv-pavement" />
    <line x1="0" y1={mainTop} x2="320" y2={mainTop} class="wv-edge" />
    <line x1="0" y1={mainBot} x2="320" y2={mainBot} class="wv-edge" />
    {#each Array.from({ length: lanes - 1 }) as _, i}
      <line x1="0" y1={mainTop + 16 * (i + 1)} x2="320" y2={mainTop + 16 * (i + 1)} class="wv-lane-line" />
    {/each}

    <!-- ramps -->
    {#if twoSided}
      <!-- on-ramp joins bottom-left, off-ramp leaves top-right -->
      <polygon points="0,{mainBot + 34} {gIn},{mainBot} {gIn + 46},{mainBot} 0,{mainBot + 48}" class="wv-ramp" />
      <polygon points="{gOut - 46},{mainTop} {gOut},{mainTop} 320,{mainTop - 22} 320,{mainTop - 8}" class="wv-ramp" />
    {:else}
      <!-- both ramps on the right side; auxiliary lane between the gores -->
      <polygon points="0,{mainBot + 34} {gIn},{mainBot + 16} {gIn},{mainBot} 0,{mainBot + 48}" class="wv-ramp" />
      <rect x={gIn} y={mainBot} width={gOut - gIn} height="16" class="wv-ramp" />
      <polygon points="{gOut},{mainBot} {gOut},{mainBot + 16} 320,{mainBot + 34} 320,{mainBot + 48}" class="wv-ramp" />
    {/if}

    <!-- L_S dimension between gores -->
    <line x1={gIn} y1={mainBot + (twoSided ? 6 : 22)} x2={gOut} y2={mainBot + (twoSided ? 6 : 22)} class="wv-dim" />
    <text x={(gIn + gOut) / 2} y={mainBot + (twoSided ? 16 : 32)} class="wv-label" text-anchor="middle">L_S</text>

    <!-- movement paths -->
    <path d={`M0,${yLaneMid(Math.max(0, Math.floor(lanes / 2) - 1))} H320`} class={`mv-ff ${cls(hovered, 'ff')}`} />
    {#if twoSided}
      <path d={`M20,${mainBot + 36} C ${gIn + 30},${mainBot - 10} ${gOut - 60},${yLaneMid(0) + 10} ${gOut + 30},${yLaneMid(0)} C ${gOut + 40},${mainTop - 4} 300,${mainTop - 10} 318,${mainTop - 14}`} class={`mv-rr ${cls(hovered, 'rr')}`} />
      <path d={`M20,${mainBot + 38} C ${gIn + 40},${mainBot - 6} 180,${yLaneMid(lanes - 1)} 320,${yLaneMid(lanes - 1)}`} class={`mv-rf ${cls(hovered, 'rf')}`} />
      <path d={`M0,${yLaneMid(0)} C ${gOut - 80},${yLaneMid(0)} ${gOut - 20},${mainTop + 4} 316,${mainTop - 16}`} class={`mv-fr ${cls(hovered, 'fr')}`} />
    {:else}
      <path d={`M14,${mainBot + 38} C ${gIn + 30},${mainBot + 8} ${gIn + 60},${yLaneMid(lanes - 1)} 320,${yLaneMid(lanes - 1)}`} class={`mv-rf ${cls(hovered, 'rf')}`} />
      <path d={`M0,${yLaneMid(lanes - 1)} C ${gOut - 90},${yLaneMid(lanes - 1)} ${gOut - 30},${mainBot + 8} 306,${mainBot + 38}`} class={`mv-fr ${cls(hovered, 'fr')}`} />
      <path d={`M14,${mainBot + 40} C ${gIn + 20},${mainBot + 10} ${gOut - 20},${mainBot + 10} 306,${mainBot + 40}`} class={`mv-rr ${cls(hovered, 'rr')}`} />
    {/if}
    <polygon points="288,{yLaneMid(Math.max(0, Math.floor(lanes / 2) - 1)) - 4} 300,{yLaneMid(Math.max(0, Math.floor(lanes / 2) - 1))} 288,{yLaneMid(Math.max(0, Math.floor(lanes / 2) - 1)) + 4}" class="wv-arrow" />
  </svg>

  <div class="wv-legend" role="list">
    {#each movements as m}
      <button
        type="button"
        role="listitem"
        class="wv-chip {m.key}"
        class:active={hovered === m.key}
        on:mouseenter={() => (hovered = m.key)}
        on:mouseleave={() => (hovered = null)}
        on:focus={() => (hovered = m.key)}
        on:blur={() => (hovered = null)}
      >
        <span class="swatch {m.key}"></span>
        {m.label}: {Number(volumes[m.key]) || 0} veh/h
      </button>
    {/each}
  </div>
</div>

<style>
  .weave-diagram svg {
    width: 100%;
    display: block;
  }
  .wv-pavement { fill: #e2e8f0; }
  .wv-ramp { fill: #e2e8f0; stroke: #334155; stroke-width: 1.5; }
  .wv-edge { stroke: #334155; stroke-width: 2; vector-effect: non-scaling-stroke; }
  .wv-lane-line { stroke: #ffffff; stroke-width: 1.5; stroke-dasharray: 8 6; vector-effect: non-scaling-stroke; }
  .wv-dim { stroke: #64748b; stroke-width: 1; stroke-dasharray: 3 3; }
  .wv-label { font-size: 9px; fill: #64748b; }
  .wv-arrow { fill: #334155; }

  .wv-move {
    fill: none;
    stroke-width: 2.5;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.85;
  }
  .wv-move.dim { opacity: 0.15; }
  .wv-move.active { stroke-width: 4; opacity: 1; }
  .mv-ff { stroke: #2563eb; }
  .mv-rf { stroke: #16a34a; }
  .mv-fr { stroke: #ea7317; }
  .mv-rr { stroke: #dc2626; }
  .swatch.ff { background: #2563eb; }
  .swatch.rf { background: #16a34a; }
  .swatch.fr { background: #ea7317; }
  .swatch.rr { background: #dc2626; }

  .wv-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .wv-chip {
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
  .wv-chip.active { border-color: #334155; }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
</style>
