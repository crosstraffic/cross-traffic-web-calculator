<script>
  import { LOS_COLORS } from '$lib/los.js';

  // Plan strip of the managed lane and the adjacent general purpose lanes, drawn in the
  // Exhibit 12-29 arrangement: the managed lanes are the left-most lanes of the roadway, so
  // they are drawn on top and the GP lanes below them, both running left to right.
  let {
    laneType = 'continuous_access',
    mlLanes = 1,
    gpLanes = 2,
    mlLos = null,
    mlDensity = null,
    gpDensity = null,
    frictionActive = false,
  } = $props();

  // Clamped only for drawing; the engine takes the entered values unchanged.
  let drawnMl = $derived(Math.max(1, Math.min(3, Number(mlLanes) || 1)));
  let drawnGp = $derived(Math.max(1, Math.min(6, Number(gpLanes) || 1)));

  const LANE_H = 16;
  const SEP_H = 12;
  const TOP = 16;

  let separation = $derived(
    laneType.startsWith('barrier') ? 'barrier' : laneType.startsWith('buffer') ? 'buffer' : 'marking',
  );

  let mlTop = $derived(TOP);
  let mlBottom = $derived(mlTop + LANE_H * drawnMl);
  let sepBottom = $derived(mlBottom + (separation === 'marking' ? 0 : SEP_H));
  let gpBottom = $derived(sepBottom + LANE_H * drawnGp);
  let height = $derived(gpBottom + 22);

  // The tint is a status encoding on top of the pavement fill, never the only carrier of the
  // result: the LOS letter and the density are printed next to it.
  let mlTint = $derived(mlLos ? LOS_COLORS[mlLos] : null);

  // Built in script rather than in the markup: Svelte trims the leading whitespace inside an
  // {#if} block, which silently swallowed the space before each "·" separator.
  let mlLabel = $derived(
    [
      `Managed lane${drawnMl === 1 ? '' : 's'}`,
      ...(mlLos ? [`LOS ${mlLos}`] : []),
      ...(mlLos && mlDensity != null ? [`${mlDensity.toFixed(1)} pc/mi/ln`] : []),
    ].join(' · '),
  );

  let gpLabel = $derived(
    [
      `${drawnGp} general purpose lane${drawnGp === 1 ? '' : 's'}`,
      ...(gpDensity != null ? [`K_GP ${gpDensity.toFixed(1)} pc/mi/ln`] : []),
      ...(frictionActive ? ['friction active'] : []),
    ].join(' · '),
  );

  let sepLabel = $derived(
    separation === 'barrier'
      ? 'barrier separation'
      : separation === 'buffer'
        ? 'buffer separation'
        : 'continuous access',
  );
</script>

<div
  class="ml-diagram"
  role="img"
  aria-label={`${drawnMl} managed lane${drawnMl === 1 ? '' : 's'} with ${sepLabel} alongside ${drawnGp} general purpose lanes${mlLos ? `, managed lane LOS ${mlLos}` : ''}`}
>
  <svg viewBox="0 0 320 {height}" preserveAspectRatio="xMidYMid meet">
    <defs>
      <pattern id="ml-buffer-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" class="ml-hatch-line" />
      </pattern>
    </defs>

    <!-- Pavement is fills only; every edge is a separate line so the two never disagree. -->
    <rect x="0" y={mlTop} width="320" height={LANE_H * drawnMl} class="ml-pavement" />
    {#if mlTint}
      <rect x="0" y={mlTop} width="320" height={LANE_H * drawnMl} fill={mlTint} opacity="0.28" class="ml-tint" />
    {/if}
    <rect x="0" y={sepBottom} width="320" height={LANE_H * drawnGp} class="ml-pavement" />

    {#if separation === 'buffer'}
      <rect x="0" y={mlBottom} width="320" height={SEP_H} class="ml-pavement-alt" />
      <rect x="0" y={mlBottom} width="320" height={SEP_H} fill="url(#ml-buffer-hatch)" />
    {:else if separation === 'barrier'}
      <rect x="0" y={mlBottom + 2} width="320" height={SEP_H - 4} class="ml-barrier" />
    {/if}

    <!-- Lane lines inside each carriageway. -->
    {#each Array.from({ length: drawnMl - 1 }) as _, i}
      <line x1="0" y1={mlTop + LANE_H * (i + 1)} x2="320" y2={mlTop + LANE_H * (i + 1)} class="ml-lane-line" />
    {/each}
    {#each Array.from({ length: drawnGp - 1 }) as _, i}
      <line x1="0" y1={sepBottom + LANE_H * (i + 1)} x2="320" y2={sepBottom + LANE_H * (i + 1)} class="ml-lane-line" />
    {/each}

    <!-- Outer edges, plus the separation edges. A continuous-access boundary is a single wide
         dashed line, which is exactly what distinguishes it from the buffer and barrier types. -->
    <line x1="0" y1={mlTop} x2="320" y2={mlTop} class="ml-edge" />
    <line x1="0" y1={gpBottom} x2="320" y2={gpBottom} class="ml-edge" />
    {#if separation === 'marking'}
      <line x1="0" y1={mlBottom} x2="320" y2={mlBottom} class="ml-access-line" />
    {:else}
      <line x1="0" y1={mlBottom} x2="320" y2={mlBottom} class="ml-edge" />
      <line x1="0" y1={sepBottom} x2="320" y2={sepBottom} class="ml-edge" />
    {/if}

    <!-- Direction of travel, one arrow per carriageway, apex downstream (to the right). -->
    <polygon
      class="ml-arrow"
      points="288,{mlTop + (LANE_H * drawnMl) / 2} 272,{mlTop + (LANE_H * drawnMl) / 2 - 4} 272,{mlTop +
        (LANE_H * drawnMl) / 2 +
        4}"
    />
    <polygon
      class="ml-arrow"
      points="288,{sepBottom + (LANE_H * drawnGp) / 2} 272,{sepBottom + (LANE_H * drawnGp) / 2 - 4} 272,{sepBottom +
        (LANE_H * drawnGp) / 2 +
        4}"
    />

    <text x="4" y={mlTop - 5} class="ml-label" data-testid="ml-label">{mlLabel}</text>
    <text x="4" y={gpBottom + 14} class="ml-label" data-testid="gp-label">{gpLabel}</text>
    <!-- Right-aligned on the top row rather than against the separation itself, which put it
         on top of the managed lane's direction arrow. -->
    <text x="316" y={mlTop - 5} text-anchor="end" class="ml-sep-label">{sepLabel}</text>
  </svg>
</div>

<style>
  .ml-diagram svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .ml-pavement {
    fill: var(--diag-pavement);
  }
  .ml-pavement-alt {
    fill: var(--diag-pavement-alt);
  }
  .ml-barrier {
    fill: var(--diag-wall);
    stroke: var(--diag-wall-edge);
    stroke-width: 1;
  }
  .ml-hatch-line {
    stroke: var(--diag-edge);
    stroke-width: 1;
    opacity: 0.45;
  }
  .ml-edge {
    stroke: var(--diag-edge);
    stroke-width: 1.5;
  }
  .ml-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1;
    stroke-dasharray: 9 7;
  }
  .ml-access-line {
    stroke: var(--diag-lane-line);
    stroke-width: 2.5;
    stroke-dasharray: 3 4;
  }
  .ml-arrow {
    fill: var(--diag-edge);
    opacity: 0.7;
  }
  .ml-label {
    font-size: 8px;
    fill: var(--diag-dim);
  }
  .ml-sep-label {
    font-size: 7px;
    fill: var(--diag-dim);
    opacity: 0.9;
  }
</style>
