<script>
  // Interactive plan view of a weaving segment. The geometry follows the form
  // inputs and each of the four component movements can be highlighted from
  // the legend, so the v_FF/v_FR/v_RF/v_RR inputs have a picture.
  //
  // One-sided: on-ramp joins at the entry gore, an auxiliary lane runs the
  // short length, the off-ramp leaves at the exit gore, all on the right.
  // Two-sided: on-ramp on the right, off-ramp on the left, so the
  // ramp-to-ramp movement crosses every mainline lane.
  export let weavingType = 'one_sided';
  export let numLanes = 4;
  export let vFF = 0;
  export let vFR = 0;
  export let vRF = 0;
  export let vRR = 0;

  let hovered = null; // 'ff' | 'fr' | 'rf' | 'rr' | null

  $: twoSided = weavingType === 'two_sided';
  // One-sided: N includes the auxiliary lane, so draw N-1 mainline lanes.
  $: mainLanes = Math.max(2, Math.min(6, (Number(numLanes) || 4) - (twoSided ? 0 : 1)));

  const LANE = 16;      // lane height, px
  const gIn = 78;       // entry gore x
  const gOut = 246;     // exit gore x
  const RAMP = 84;      // horizontal run of a ramp band
  const DROP = 46;      // vertical drop of a ramp band over that run

  $: mainTop = twoSided ? DROP + LANE + 14 : 16;
  $: mainBot = mainTop + LANE * mainLanes;
  $: auxBot = mainBot + LANE;
  $: viewH = (twoSided ? mainBot : auxBot) + DROP + LANE + 20;

  $: yLane = (i) => mainTop + LANE * i + LANE / 2;
  $: yBottom = yLane(mainLanes - 1);
  $: yTop = yLane(0);
  $: yAux = mainBot + LANE / 2;

  // Ramp-band centerline points 14 px in from the band ends, so movement
  // paths enter and leave inside the pavement instead of overshooting it.
  $: rampInlet = { x: gIn - RAMP + 14, y: auxBot + DROP - LANE / 2 - (DROP * 14) / RAMP };
  $: rampOutlet = { x: gOut + RAMP - 14, y: auxBot - LANE / 2 + (DROP * (RAMP - 14)) / RAMP };
  $: rampInlet2 = { x: gIn - RAMP + 14, y: mainBot + DROP + LANE / 2 - (DROP * 14) / RAMP };
  $: rampOutlet2 = { x: gOut + RAMP - 14, y: mainTop - DROP - LANE / 2 + (DROP * 14) / RAMP };

  const movements = [
    { key: 'ff', label: 'v_FF freeway → freeway' },
    { key: 'rf', label: 'v_RF ramp → freeway' },
    { key: 'fr', label: 'v_FR freeway → ramp' },
    { key: 'rr', label: 'v_RR ramp → ramp' },
  ];
  $: volumes = { ff: vFF, rf: vRF, fr: vFR, rr: vRR };

  // The legend inputs assign back to the exported props, so a page that
  // binds vFF/vFR/vRF/vRR sees edits made on the diagram.
  function setVol(key, raw) {
    const v = raw === '' ? '' : Number(raw);
    if (key === 'ff') vFF = v;
    else if (key === 'rf') vRF = v;
    else if (key === 'fr') vFR = v;
    else if (key === 'rr') vRR = v;
  }

  function cls(h, key) {
    if (h == null) return 'wv-move';
    return h === key ? 'wv-move active' : 'wv-move dim';
  }
</script>

<div class="weave-diagram">
  <svg viewBox="0 0 320 {viewH}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label={`${Number(numLanes) || 4}-lane ${twoSided ? 'two-sided' : 'one-sided'} weaving segment`}>

    <!-- ══ pavement (fills only, no strokes: edges are drawn as lines) ══ -->
    <rect x="0" y={mainTop} width="320" height={LANE * mainLanes} class="wv-pavement" />

    {#if twoSided}
      <!-- on-ramp band merging from lower left; taper ends at gIn + 70 -->
      <polygon points="{gIn - RAMP},{mainBot + DROP} {gIn},{mainBot} {gIn + 70},{mainBot} {gIn - RAMP},{mainBot + DROP + LANE}" class="wv-pavement" />
      <!-- off-ramp band diverging to upper right; taper begins at gOut - 70 -->
      <polygon points="{gOut - 70},{mainTop} {gOut + RAMP},{mainTop - DROP - LANE} {gOut + RAMP},{mainTop - DROP} {gOut},{mainTop}" class="wv-pavement" />
    {:else}
      <!-- auxiliary lane between the gores -->
      <rect x={gIn} y={mainBot} width={gOut - gIn} height={LANE} class="wv-pavement" />
      <!-- on-ramp band into the entry gore -->
      <polygon points="{gIn - RAMP},{auxBot + DROP - LANE} {gIn},{mainBot} {gIn},{auxBot} {gIn - RAMP},{auxBot + DROP}" class="wv-pavement" />
      <!-- off-ramp band out of the exit gore -->
      <polygon points="{gOut},{mainBot} {gOut + RAMP},{auxBot + DROP - LANE} {gOut + RAMP},{auxBot + DROP} {gOut},{auxBot}" class="wv-pavement" />
    {/if}

    <!-- ══ edges and lane lines ══ -->
    <!-- mainline lane lines -->
    {#each Array.from({ length: mainLanes - 1 }) as _, i}
      <line x1="0" y1={mainTop + LANE * (i + 1)} x2="320" y2={mainTop + LANE * (i + 1)} class="wv-lane-line" />
    {/each}

    {#if twoSided}
      <!-- top edge: solid outside the diverge taper, lane line across it -->
      <line x1="0" y1={mainTop} x2={gOut - 70} y2={mainTop} class="wv-edge" />
      <line x1={gOut - 70} y1={mainTop} x2={gOut} y2={mainTop} class="wv-lane-line" />
      <!-- off-ramp edges: outer edge above, gore edge below -->
      <line x1={gOut - 70} y1={mainTop} x2={gOut + RAMP} y2={mainTop - DROP - LANE} class="wv-edge" />
      <line x1={gOut} y1={mainTop} x2={gOut + RAMP} y2={mainTop - DROP} class="wv-edge" />
      <!-- bottom edge: solid outside the merge taper, lane line across it -->
      <line x1="0" y1={mainBot} x2={gIn} y2={mainBot} class="wv-edge" />
      <line x1={gIn} y1={mainBot} x2={gIn + 70} y2={mainBot} class="wv-lane-line" />
      <line x1={gIn + 70} y1={mainBot} x2="320" y2={mainBot} class="wv-edge" />
      <!-- on-ramp edges -->
      <line x1={gIn - RAMP} y1={mainBot + DROP} x2={gIn} y2={mainBot} class="wv-edge" />
      <line x1={gIn - RAMP} y1={mainBot + DROP + LANE} x2={gIn + 70} y2={mainBot} class="wv-edge" />
    {:else}
      <!-- top edge: solid the whole way -->
      <line x1="0" y1={mainTop} x2="320" y2={mainTop} class="wv-edge" />
      <!-- mainline/auxiliary boundary: solid outside the gores, dashed within -->
      <line x1="0" y1={mainBot} x2={gIn} y2={mainBot} class="wv-edge" />
      <line x1={gIn} y1={mainBot} x2={gOut} y2={mainBot} class="wv-lane-line" />
      <line x1={gOut} y1={mainBot} x2="320" y2={mainBot} class="wv-edge" />
      <!-- outer edge: up the on-ramp, along the auxiliary lane, down the off-ramp -->
      <polyline points="{gIn - RAMP},{auxBot + DROP} {gIn},{auxBot} {gOut},{auxBot} {gOut + RAMP},{auxBot + DROP}" class="wv-edge-path" />
      <!-- gore edges (inner ramp edges meeting the mainline edge) -->
      <line x1={gIn - RAMP} y1={auxBot + DROP - LANE} x2={gIn} y2={mainBot} class="wv-edge" />
      <line x1={gOut} y1={mainBot} x2={gOut + RAMP} y2={auxBot + DROP - LANE} class="wv-edge" />
    {/if}

    <!-- ══ movement paths ══ -->
    <!-- freeway-to-freeway: straight through a middle lane -->
    <path d={`M0,${yLane(Math.max(0, Math.floor((mainLanes - 1) / 2)))} H312`} class={`mv-ff ${cls(hovered, 'ff')}`} />

    {#if twoSided}
      <!-- ramp legs run straight along the band centerline to the gore, so no
           curve cuts across the gore notch; curves happen inside the through lanes -->
      <!-- ramp-to-ramp: enters lower left, crosses every lane in one smooth S, and leaves
           up the outer side of the off-ramp band (the freeway-to-ramp movement keeps the
           gore side, so the two never cross inside the band) -->
      <path d={`M${rampInlet2.x},${rampInlet2.y} L${gIn + 2},${mainBot + 9} C${gIn + 100},${yBottom + 6} ${gOut - 110},${yTop - 4} ${gOut - 2},${mainTop - 13} L${rampOutlet2.x},${rampOutlet2.y - 2}`} class={`mv-rr ${cls(hovered, 'rr')}`} />
      <!-- ramp-to-freeway: enters lower left, settles into the bottom lane -->
      <path d={`M${rampInlet2.x},${rampInlet2.y + 4} L${gIn + 4},${mainBot + 12} Q${gIn + 56},${mainBot} ${gIn + 96},${yBottom} H312`} class={`mv-rf ${cls(hovered, 'rf')}`} />
      <!-- freeway-to-ramp: rides the top lane, leaves up the gore side of the off-ramp -->
      <path d={`M0,${yTop} H${gOut - 70} Q${gOut - 16},${yTop - 6} ${gOut + 2},${mainTop - 7} L${rampOutlet2.x},${rampOutlet2.y + 4}`} class={`mv-fr ${cls(hovered, 'fr')}`} />
    {:else}
      <!-- ramp legs run straight along the band centerline to the gore point
           (the centerline meets the auxiliary lane middle exactly at the gore) -->
      <!-- ramp-to-freeway: up the on-ramp, along the auxiliary lane, merge to lane 1 -->
      <path d={`M${rampInlet.x},${rampInlet.y - 3} L${gIn},${yAux - 3} C${gIn + 52},${yAux - 2} ${gIn + 84},${yBottom} ${gIn + 128},${yBottom} H312`} class={`mv-rf ${cls(hovered, 'rf')}`} />
      <!-- freeway-to-ramp: lane 1 to the auxiliary lane, out the off-ramp -->
      <path d={`M0,${yBottom} H${gIn + 24} C${gIn + 60},${yBottom} ${gIn + 72},${yAux - 2} ${gIn + 108},${yAux - 2} H${gOut} L${rampOutlet.x},${rampOutlet.y - 3}`} class={`mv-fr ${cls(hovered, 'fr')}`} />
      <!-- ramp-to-ramp: stays in the auxiliary lane the whole length -->
      <path d={`M${rampInlet.x},${rampInlet.y + 4} L${gIn},${yAux + 4} H${gOut} L${rampOutlet.x},${rampOutlet.y + 4}`} class={`mv-rr ${cls(hovered, 'rr')}`} />
    {/if}

    <!-- direction arrow on the freeway-to-freeway lane -->
    <polygon points="300,{yLane(Math.max(0, Math.floor((mainLanes - 1) / 2))) - 5} 314,{yLane(Math.max(0, Math.floor((mainLanes - 1) / 2)))} 300,{yLane(Math.max(0, Math.floor((mainLanes - 1) / 2))) + 5}" class="wv-arrow" />

    <!-- ══ L_S dimension between the gores ══ -->
    {#if twoSided}
      <!-- dimension below the roadway, gore to gore, with dotted extension lines -->
      <line x1={gIn} y1={mainBot + 24} x2={gIn} y2={mainBot + DROP + LANE + 12} class="wv-ext" />
      <line x1={gOut} y1={mainTop + 2} x2={gOut} y2={mainBot + DROP + LANE + 12} class="wv-ext" />
      <line x1={gIn} y1={mainBot + DROP + LANE + 8} x2={gOut} y2={mainBot + DROP + LANE + 8} class="wv-dim" />
      <text x={(gIn + gOut) / 2} y={mainBot + DROP + LANE + 18} class="wv-label" text-anchor="middle">L_S</text>
    {:else}
      <line x1={gIn} y1={auxBot + 20} x2={gOut} y2={auxBot + 20} class="wv-dim" />
      <line x1={gIn} y1={auxBot + 2} x2={gIn} y2={auxBot + 24} class="wv-dim" />
      <line x1={gOut} y1={auxBot + 2} x2={gOut} y2={auxBot + 24} class="wv-dim" />
      <text x={(gIn + gOut) / 2} y={auxBot + 32} class="wv-label" text-anchor="middle">L_S</text>
    {/if}
  </svg>

  <div class="wv-legend" role="list">
    {#each movements as m}
      <label
        role="listitem"
        class="wv-chip {m.key}"
        class:active={hovered === m.key}
        on:mouseenter={() => (hovered = m.key)}
        on:mouseleave={() => (hovered = null)}
      >
        <span class="swatch {m.key}"></span>
        {m.label}
        <input
          type="number"
          min="0"
          aria-label="{m.label} volume (veh/h)"
          value={volumes[m.key]}
          on:input={(e) => setVol(m.key, e.currentTarget.value)}
          on:focus={() => (hovered = m.key)}
          on:blur={() => (hovered = null)}
        />
        veh/h
      </label>
    {/each}
  </div>
</div>

<style>
  .weave-diagram svg {
    width: 100%;
    max-width: 720px;
    display: block;
    margin: 0 auto;
  }
  .wv-pavement { fill: #e2e8f0; }
  .wv-edge {
    stroke: #334155;
    stroke-width: 2;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .wv-edge-path {
    fill: none;
    stroke: #334155;
    stroke-width: 2;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .wv-lane-line {
    stroke: #ffffff;
    stroke-width: 1.5;
    stroke-dasharray: 8 6;
    vector-effect: non-scaling-stroke;
  }
  .wv-dim { stroke: #64748b; stroke-width: 1; }
  .wv-ext { stroke: #64748b; stroke-width: 0.75; stroke-dasharray: 2 3; opacity: 0.6; }
  .wv-label { font-size: 9px; fill: #64748b; }
  .wv-arrow { fill: #334155; }

  .wv-move {
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.85;
  }
  .wv-move.dim { opacity: 0.12; }
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
  .wv-chip input {
    width: 3.6rem;
    font-size: 0.72rem;
    padding: 0.05rem 0.25rem;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: #ffffff;
    color: #0f172a;
    text-align: right;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
</style>
