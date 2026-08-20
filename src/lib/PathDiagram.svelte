<script>
  // Interactive plan view of an off-street path (HCM Chapter 24). The band
  // width follows the facility width, keep-right travel puts eastbound users
  // on the south half, and the animation mixes the chapter's five user groups
  // at their Exhibit 24-6 speeds: bicycles, pedestrians, runners, inline
  // skaters, and child bicyclists. After a run, a share of bicycles matched
  // to the LOS gets stuck at pedestrian pace, which is exactly the
  // delayed-passing story the BLOS score measures.
  //
  // `kind`: 'pedestrian' (exclusive walkway, pedestrians only),
  // 'shared_path' (bicycle streams passing a probe pedestrian), or

  // Demand knobs, meaning depends on kind: bicycle = two-way volume + split
  // via demandA only; shared_path = same-direction / opposing bikes; the

  /**
   * @typedef {Object} Props
   * @property {string} [kind] - 'bicycle' (full five-mode mix).
   * @property {number} [widthFt]
   * @property {number} [objectWidthFt] - pedestrian kind: fixed-object strip
   * @property {boolean} [centerline]
   * @property {boolean} [oneWay]
   * @property {number} [demandA] - pedestrian kind uses demandA as the hourly volume.
   * @property {number} [demandB]
   * @property {any} [losLetter]
   * @property {boolean} [editable]
   */

  /** @type {Props} */
  let {
    kind = 'bicycle',
    widthFt = 10,
    objectWidthFt = 0,
    centerline = false,
    oneWay = false,
    demandA = $bindable(200),
    demandB = $bindable(0),
    losLetter = null,
    editable = true,
  } = $props();

  let hovered = $state(null);
  let animating = $state(true);

  const W = 520,
    H = 170,
    cy = 85,
    FT = 5.4;

  let bandH = $derived(Math.max(4, Math.min(20, Number(widthFt) || 10)) * FT);
  let top = $derived(cy - bandH / 2);
  let bot = $derived(cy + bandH / 2);
  // Fixed objects claim a strip along the north edge (shy distance shading).
  let objH = $derived(Math.max(0, Math.min(6, Number(objectWidthFt) || 0)) * FT);

  const MODES = [
    { key: 'bike', label: 'Bicycles', split: 0.55, speed: 12.8, cls: 'u-bike' },
    { key: 'ped', label: 'Pedestrians', split: 0.2, speed: 3.4, cls: 'u-ped' },
    { key: 'run', label: 'Runners', split: 0.1, speed: 6.5, cls: 'u-run' },
    { key: 'skate', label: 'Inline skaters', split: 0.1, speed: 10.1, cls: 'u-skate' },
    { key: 'child', label: 'Child bicyclists', split: 0.05, speed: 7.9, cls: 'u-child' },
  ];
  // Share of bicycles riding at pedestrian pace once the LOS says passing is
  // constrained.
  const DELAYED = { A: 0, B: 0.1, C: 0.25, D: 0.45, E: 0.65, F: 0.85 };

  let activeModes = $derived(
    kind === 'pedestrian'
      ? MODES.filter((m) => m.key === 'ped')
      : kind === 'shared_path'
        ? MODES.filter((m) => m.key === 'bike')
        : MODES,
  );

  // Lane y per direction; users scatter across their half.
  let yEast = $derived((f) => cy + (bandH / 2 - 6) * (0.35 + 0.6 * f)); // south half
  let yWest = $derived((f) => cy - (bandH / 2 - 6) * (0.35 + 0.6 * f)); // north half

  let vehiclePlan = $derived(
    (() => {
      if (!animating) return [];
      const items = [];
      const dirDemand =
        kind === 'shared_path'
          ? [Number(demandA) || 0, oneWay ? 0 : Number(demandB) || 0]
          : [Number(demandA) * (oneWay ? 1 : 0.5) || 0, oneWay ? 0 : Number(demandA) * 0.5 || 0];
      const totalAll = dirDemand[0] + dirDemand[1] || 1;
      const BUDGET = kind === 'bicycle' ? 26 : 20;
      const delayedFrac = DELAYED[losLetter] ?? 0;
      let idc = 0;
      for (let dir = 0; dir < 2; dir++) {
        if (dirDemand[dir] <= 0) continue;
        for (const m of activeModes) {
          const share = kind === 'bicycle' ? m.split : 1;
          const vol = dirDemand[dir] * share;
          const n = Math.max(1, Math.min(9, Math.round((BUDGET * vol) / totalAll)));
          for (let k = 0; k < n; k++) {
            const delayed = m.key === 'bike' && (k + 1) / n <= delayedFrac;
            const speed = delayed ? 3.9 : m.speed;
            const dur = (34 / speed) * (0.9 + 0.2 * ((k % 3) / 2));
            items.push({
              id: `${dir}${m.key}${k}${idc++}`,
              mode: m,
              delayed,
              dur,
              begin: (-(k + 0.41 * (k % 2)) / n) * dur,
              path:
                dir === 0
                  ? `M -12,${yEast((k % 4) / 3).toFixed(1)} L ${W + 12},${yEast((k % 4) / 3).toFixed(1)}`
                  : `M ${W + 12},${yWest((k % 4) / 3).toFixed(1)} L -12,${yWest((k % 4) / 3).toFixed(1)}`,
            });
          }
        }
      }
      // The shared-path pedestrian analysis is about bikes passing and meeting
      // the average pedestrian: draw the probe walker eastbound mid-half.
      if (kind === 'shared_path') {
        items.push({
          id: 'probe',
          mode: MODES[1],
          probe: true,
          delayed: false,
          dur: 34 / 3.4,
          begin: -3,
          path: `M -12,${yEast(0.5).toFixed(1)} L ${W + 12},${yEast(0.5).toFixed(1)}`,
        });
      }
      return items;
    })(),
  );

  function cls(h, key) {
    if (h == null) return 'pd-user';
    return h === key ? 'pd-user active' : 'pd-user dim';
  }
</script>

<div class="path-diagram">
  <svg
    viewBox="0 0 {W} {H}"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label={`${kind === 'pedestrian' ? 'exclusive pedestrian facility' : kind === 'shared_path' ? 'shared-use path' : 'off-street bicycle path'}, ${widthFt} ft wide`}
  >
    <!-- ══ path band ══ -->
    <rect x="0" y={top} width={W} height={bandH} class="pd-pavement" />
    {#if objH > 0}
      <rect x="0" y={top} width={W} height={objH} class="pd-object" />
      <text x="6" y={top + objH - 3} class="pd-label">fixed objects, {objectWidthFt} ft</text>
    {/if}
    <line x1="0" y1={top} x2={W} y2={top} class="pd-edge" />
    <line x1="0" y1={bot} x2={W} y2={bot} class="pd-edge" />
    {#if centerline && !oneWay}
      <line x1="0" y1={cy} x2={W} y2={cy} class="pd-centerline" />
    {:else if !oneWay && kind !== 'pedestrian'}
      <line x1="0" y1={cy} x2={W} y2={cy} class="pd-centerline-soft" />
    {/if}
    <text x={W - 6} y={top - 6} class="pd-label" text-anchor="end">{widthFt} ft</text>

    <!-- ══ on-diagram demand editors ══ -->
    {#if editable}
      <foreignObject x="4" y="4" width="150" height="24">
        <div class="pd-cluster" xmlns="http://www.w3.org/1999/xhtml">
          <span class="pd-cluster-title"
            >{kind === 'shared_path' ? 'bikes same/opp' : kind === 'pedestrian' ? 'peds/h' : 'users/h'}</span
          >
          <input
            type="number"
            min="0"
            aria-label="primary demand (per hour)"
            value={demandA}
            oninput={(e) => (demandA = e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))}
          />
          {#if kind === 'shared_path' && !oneWay}
            <input
              type="number"
              min="0"
              aria-label="opposing demand (per hour)"
              value={demandB}
              oninput={(e) => (demandB = e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))}
            />
          {/if}
        </div>
      </foreignObject>
    {/if}

    <!-- ══ users ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class={`${cls(hovered, v.mode.key)} ${v.mode.cls}`} class:probe={v.probe} class:delayed={v.delayed}>
          {#if v.mode.key === 'ped' || v.mode.key === 'run'}
            <circle r={v.mode.key === 'run' ? 3.2 : 2.8} />
          {:else}
            <rect x="-4.5" y="-2" width="9" height="4" rx="1.6" />
          {/if}
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s" path={v.path} />
        </g>
      {/each}
    {/if}
  </svg>

  <div class="pd-legend" role="list">
    <button
      type="button"
      class="pd-chip pd-animate"
      class:active={animating}
      aria-pressed={animating}
      onclick={() => (animating = !animating)}
    >
      {animating ? '⏸ Stop' : '▶ Animate'}
    </button>
    {#each activeModes as m}
      <button
        type="button"
        role="listitem"
        class="pd-chip {m.cls}"
        class:active={hovered === m.key}
        onmouseenter={() => (hovered = m.key)}
        onmouseleave={() => (hovered = null)}
        onfocus={() => (hovered = m.key)}
        onblur={() => (hovered = null)}
      >
        <span class="swatch {m.cls}"></span>
        {m.label}{kind === 'bicycle' ? ` (${Math.round(m.split * 100)}%)` : ''} · {m.speed} mi/h
      </button>
    {/each}
  </div>
  <p class="pd-note">
    Keep-right travel: eastbound on the lower half, westbound on the upper.
    {#if kind === 'bicycle'}Mode shares and speeds are the Exhibit 24-6 defaults. After a run, the share of bicycles
      stuck at walking pace follows the LOS, which is the delayed-passing effect the BLOS score measures.{/if}
    {#if kind === 'shared_path'}The highlighted walker is the average pedestrian the method scores: bicycles overtaking
      it are passing events, bicycles toward it are meetings.{/if}
    {#if kind === 'pedestrian'}Pedestrian space comes from the effective width after fixed objects and the platooned or
      random flow pattern.{/if}
    An illustration, not a simulation.
  </p>
</div>

<style>
  .path-diagram svg {
    width: 100%;
    max-width: 640px;
    display: block;
    margin: 0 auto;
  }
  .pd-pavement {
    fill: var(--diag-pavement);
  }
  .pd-object {
    fill: var(--diag-pavement-alt);
  }
  .pd-edge {
    stroke: var(--diag-edge);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .pd-centerline {
    stroke: var(--diag-center);
    stroke-width: 1.5;
    stroke-dasharray: 10 7;
    vector-effect: non-scaling-stroke;
  }
  .pd-centerline-soft {
    stroke: var(--diag-lane-line);
    stroke-width: 1.25;
    stroke-dasharray: 4 8;
    vector-effect: non-scaling-stroke;
    opacity: 0.6;
  }
  .pd-label {
    font-size: 9px;
    fill: var(--diag-dim);
  }

  .pd-user {
    transition: opacity 120ms ease;
    opacity: 0.9;
  }
  .pd-user.dim {
    opacity: 0.1;
  }
  .pd-user.active {
    opacity: 1;
  }
  .pd-user rect,
  .pd-user circle {
    stroke: rgba(15, 23, 42, 0.35);
    stroke-width: 0.6;
  }
  .u-bike rect {
    fill: #2563eb;
  }
  .u-bike.delayed rect {
    fill: #93b6f8;
  }
  .u-ped circle {
    fill: #16a34a;
  }
  .pd-user.probe circle {
    fill: #16a34a;
    stroke: #0f172a;
    stroke-width: 1.6;
    r: 4;
  }
  .u-run circle {
    fill: #ea7317;
  }
  .u-skate rect {
    fill: #8b5cf6;
  }
  .u-child rect {
    fill: #dc2626;
  }
  .swatch.u-bike {
    background: #2563eb;
  }
  .swatch.u-ped {
    background: #16a34a;
  }
  .swatch.u-run {
    background: #ea7317;
  }
  .swatch.u-skate {
    background: #8b5cf6;
  }
  .swatch.u-child {
    background: #dc2626;
  }

  .pd-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .pd-chip {
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
  .pd-chip.active {
    border-color: var(--diag-edge);
  }
  .pd-animate {
    cursor: pointer;
    font-weight: 600;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
  .pd-note {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 0.35rem;
  }

  .pd-cluster {
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
  .pd-cluster-title {
    font-size: 7px;
    font-weight: 600;
    flex: none;
  }
  .pd-cluster input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    flex: 1 1 0;
    font-size: 8px;
    padding: 2px 1px;
    border: 1px solid var(--border-strong);
    border-radius: 3px;
    background: var(--surface);
    color: var(--text);
    text-align: center;
  }
  .pd-cluster input::-webkit-outer-spin-button,
  .pd-cluster input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .pd-cluster input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
