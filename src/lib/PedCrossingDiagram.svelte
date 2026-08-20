<script>
  import { LOS_COLORS } from '$lib/los.js';

  // Cross-section through the crossing, drawn along the pedestrian's line of travel: the
  // pedestrian walks down the page, each stage is the lanes that stage crosses, and a two-stage
  // crossing has the median refuge drawn between them. This is the Step 1 decomposition of HCM
  // Chapter 20 Section 5 and nothing more. It carries no vehicle positions and no gap geometry,
  // because the method models the conflicting stream as a flow rate rather than as located
  // vehicles, and drawing vehicles would imply a spatial claim the analysis never makes.
  let { stages = [], walkSpeed = null, los = null, totalDelay = null } = $props();

  // Clamped for drawing only; the engine takes the entered stages unchanged. Past two stages the
  // HCM has no worked example, and the drawing stays readable by stacking whatever it is given.
  let drawn = $derived(
    stages.map((s) => ({
      lanes: Math.max(1, Math.min(6, Math.round(Number(s.through_lanes) || 1))),
      length: Number(s.crossing_length_ft) || 0,
      flow: Number(s.conflicting_flow_veh_h) || 0,
    })),
  );

  const W = 320;
  const LANE_H = 20;
  const REFUGE_H = 16;
  const TOP = 26;
  // Crosswalk sits at the left so the per-stage label has clear pavement to its right;
  // the walk line runs the full height of a band and would otherwise strike through the text.
  const WALK_X = 52;
  const LABEL_X = 92;

  // Stacked geometry, one pass, so the bands, the refuge blocks, and the walk line are all read
  // off the same list rather than recomputed per element.
  let bands = $derived.by(() => {
    const out = [];
    let y = TOP;
    drawn.forEach((s, i) => {
      if (i > 0) {
        out.push({ kind: 'refuge', y, h: REFUGE_H });
        y += REFUGE_H;
      }
      const h = LANE_H * s.lanes;
      out.push({ kind: 'stage', index: i, y, h, ...s });
      y += h;
    });
    return out;
  });

  let bottom = $derived(bands.length ? bands[bands.length - 1].y + bands[bands.length - 1].h : TOP);
  let height = $derived(bottom + 30);
  let twoStage = $derived(drawn.length > 1);

  // Built in script rather than in the markup: Svelte trims the leading whitespace inside an
  // {#if} block, which silently swallows the space before each separator.
  let headline = $derived(
    [
      twoStage ? `${drawn.length}-stage crossing` : 'One-stage crossing',
      ...(twoStage ? ['median refuge'] : []),
      ...(walkSpeed ? [`${Number(walkSpeed).toFixed(1)} ft/s`] : []),
    ].join(' · '),
  );

  let footline = $derived(
    [...(totalDelay != null ? [`d_p ${Number(totalDelay).toFixed(1)} s`] : []), ...(los ? [`LOS ${los}`] : [])].join(
      ' · ',
    ),
  );

  // The tint is a status encoding on top of the pavement fill, never the only carrier of the
  // result: the letter and the delay are printed under it.
  let tint = $derived(los ? LOS_COLORS[los] : null);

  let label = $derived(
    `${twoStage ? `${drawn.length}-stage` : 'one-stage'} pedestrian crossing of ` +
      drawn.map((s) => `${s.lanes} lane${s.lanes === 1 ? '' : 's'} at ${s.flow} veh/h`).join(' then ') +
      (los ? `, LOS ${los}` : ''),
  );
</script>

<div class="pedx-diagram" role="img" aria-label={label}>
  <svg viewBox="0 0 {W} {height}" preserveAspectRatio="xMidYMid meet">
    <defs>
      <pattern id="pedx-refuge-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" class="pedx-hatch-line" />
      </pattern>
    </defs>

    <!-- Pavement is fills only; every edge is drawn as its own line so the two never disagree. -->
    {#each bands as b}
      {#if b.kind === 'stage'}
        <rect x="0" y={b.y} width={W} height={b.h} class="pedx-pavement" />
        {#if tint}
          <rect x="0" y={b.y} width={W} height={b.h} fill={tint} opacity="0.22" />
        {/if}
      {:else}
        <rect x="0" y={b.y} width={W} height={b.h} class="pedx-pavement-alt" />
        <rect x="0" y={b.y} width={W} height={b.h} fill="url(#pedx-refuge-hatch)" />
      {/if}
    {/each}

    <!-- Lane lines inside each stage, then the outer and stage edges. -->
    {#each bands.filter((b) => b.kind === 'stage') as b}
      {#each Array.from({ length: b.lanes - 1 }) as _, i}
        <line x1="0" y1={b.y + LANE_H * (i + 1)} x2={W} y2={b.y + LANE_H * (i + 1)} class="pedx-lane-line" />
      {/each}
      <line x1="0" y1={b.y} x2={W} y2={b.y} class="pedx-edge" />
      <line x1="0" y1={b.y + b.h} x2={W} y2={b.y + b.h} class="pedx-edge" />
    {/each}

    <!-- Crosswalk bars, laid across the pavement in the pedestrian's direction of travel. -->
    {#each bands.filter((b) => b.kind === 'stage') as b}
      {#each [0, 1, 2, 3, 4] as i}
        <rect x={WALK_X - 26 + i * 11} y={b.y + 3} width="6" height={b.h - 6} class="pedx-crosswalk" />
      {/each}
    {/each}

    <!-- The pedestrian's path, one arrow per stage, apex in the direction of travel. Broken at
         the refuge, which is exactly what makes the crossing two stages. -->
    {#each bands.filter((b) => b.kind === 'stage') as b}
      <line x1={WALK_X} y1={b.y + 4} x2={WALK_X} y2={b.y + b.h - 8} class="pedx-walk" />
      <polygon
        class="pedx-arrow"
        points="{WALK_X},{b.y + b.h - 2} {WALK_X - 4},{b.y + b.h - 10} {WALK_X + 4},{b.y + b.h - 10}"
      />
    {/each}

    <!-- Conflicting stream, one arrow per stage on the right, running across the crossing. -->
    {#each bands.filter((b) => b.kind === 'stage') as b}
      <polygon
        class="pedx-veh-arrow"
        points="{W - 14},{b.y + b.h / 2} {W - 30},{b.y + b.h / 2 - 5} {W - 30},{b.y + b.h / 2 + 5}"
      />
    {/each}

    {#each bands.filter((b) => b.kind === 'stage') as b}
      <text x={LABEL_X} y={b.y + 13} class="pedx-label" data-testid={`pedx-stage-${b.index + 1}`}>
        {`Stage ${b.index + 1} · ${b.lanes} lane${b.lanes === 1 ? '' : 's'} · ${b.length} ft · ${b.flow} veh/h`}
      </text>
    {/each}
    {#each bands.filter((b) => b.kind === 'refuge') as b}
      <text x={LABEL_X} y={b.y + 11} class="pedx-sub-label" data-testid="pedx-refuge">Median refuge</text>
    {/each}

    <text x="4" y={16} class="pedx-label" data-testid="pedx-headline">{headline}</text>
    {#if footline}
      <text x={W - 4} y={bottom + 16} text-anchor="end" class="pedx-label" data-testid="pedx-footline">{footline}</text>
    {/if}
  </svg>
</div>

<style>
  .pedx-diagram svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .pedx-pavement {
    fill: var(--diag-pavement);
  }
  .pedx-pavement-alt {
    fill: var(--diag-pavement-alt);
  }
  .pedx-hatch-line {
    stroke: var(--diag-edge);
    stroke-width: 1;
    opacity: 0.45;
  }
  .pedx-edge {
    stroke: var(--diag-edge);
    stroke-width: 1.5;
  }
  .pedx-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1;
    stroke-dasharray: 9 7;
  }
  .pedx-crosswalk {
    fill: var(--diag-lane-line);
    opacity: 0.75;
  }
  .pedx-walk {
    stroke: var(--diag-edge);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }
  .pedx-arrow {
    fill: var(--diag-edge);
  }
  .pedx-veh-arrow {
    fill: var(--diag-edge);
    opacity: 0.55;
  }
  .pedx-label {
    font-size: 8px;
    fill: var(--diag-dim);
  }
  .pedx-sub-label {
    font-size: 7px;
    fill: var(--diag-dim);
    opacity: 0.9;
  }
</style>
