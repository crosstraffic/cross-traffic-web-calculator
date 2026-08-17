<script>
  // Side elevation of a composite grade (HCM Chapter 25): the grades in the order a vehicle
  // meets them, each drawn as wide as its length and sloped by its grade. After a run the
  // segment that sets the governing capacity is called out, which is the one number a
  // composite-grade analysis turns on.
  //
  // The vertical scale is exaggerated and stated as such in the caption. A 5% grade over a
  // mile rises 264 ft against 5,280 ft of run, so an honest 1:1 profile is a flat line and
  // shows nothing. Because the vertical is exaggerated, the pavement band is offset
  // vertically rather than perpendicular to the slope: a perpendicular offset would encode a
  // thickness the vertical scale has already made meaningless, and the vertical one keeps
  // consecutive segments sharing an exact edge at every boundary.

  let { segments = [], governing = -1 } = $props();

  const W = 480;
  const H = 150;
  const PAD_X = 26;
  const TOP = 30;
  const BAND = 9;        // pavement thickness, px
  const RISE = 62;       // px available to the elevation range

  const lengthOf = (s) => {
    const n = Number(s.length);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const gradeOf = (s) => {
    const n = Number(s.grade);
    return Number.isFinite(n) ? n : 0;
  };

  // Cumulative station and elevation at every segment boundary, elevation in feet.
  let nodes = $derived.by(() => {
    const out = [{ mi: 0, ft: 0 }];
    for (const s of segments) {
      const prev = out[out.length - 1];
      out.push({ mi: prev.mi + lengthOf(s), ft: prev.ft + (gradeOf(s) / 100) * lengthOf(s) * 5280 });
    }
    return out;
  });

  let totalMi = $derived(nodes[nodes.length - 1].mi);
  let minFt = $derived(Math.min(...nodes.map((n) => n.ft)));
  let maxFt = $derived(Math.max(...nodes.map((n) => n.ft)));

  const x = (mi) => (totalMi > 0 ? PAD_X + (mi / totalMi) * (W - 2 * PAD_X) : PAD_X);
  // Elevation grows upward on the page, so a rise is a smaller y.
  let y = $derived.by(() => {
    const span = maxFt - minFt;
    const k = span > 0 ? RISE / span : 0;
    return (ft) => TOP + RISE - (ft - minFt) * k;
  });

  // One closed path for the pavement: forward along the surface, back along the underside.
  let pavement = $derived.by(() => {
    if (!nodes.length) return '';
    const top = nodes.map((n) => `${x(n.mi).toFixed(2)},${y(n.ft).toFixed(2)}`);
    const bottom = [...nodes].reverse().map((n) => `${x(n.mi).toFixed(2)},${(y(n.ft) + BAND).toFixed(2)}`);
    return `M ${top.join(' L ')} L ${bottom.join(' L ')} Z`;
  });

  let surfaceLine = $derived(nodes.map((n) => `${x(n.mi).toFixed(2)},${y(n.ft).toFixed(2)}`).join(' '));
  let underLine = $derived(nodes.map((n) => `${x(n.mi).toFixed(2)},${(y(n.ft) + BAND).toFixed(2)}`).join(' '));

  // The governing segment gets its own fill, drawn over the band rather than instead of it.
  let governingPath = $derived.by(() => {
    if (governing < 0 || governing >= segments.length) return '';
    const a = nodes[governing];
    const b = nodes[governing + 1];
    if (!a || !b) return '';
    return `M ${x(a.mi).toFixed(2)},${y(a.ft).toFixed(2)} L ${x(b.mi).toFixed(2)},${y(b.ft).toFixed(2)} `
      + `L ${x(b.mi).toFixed(2)},${(y(b.ft) + BAND).toFixed(2)} L ${x(a.mi).toFixed(2)},${(y(a.ft) + BAND).toFixed(2)} Z`;
  });

  // Label a segment only where its own width can hold the text.
  let labels = $derived(
    segments.map((s, i) => {
      const a = nodes[i];
      const b = nodes[i + 1];
      const w = x(b.mi) - x(a.mi);
      return {
        i,
        mid: (x(a.mi) + x(b.mi)) / 2,
        yMid: (y(a.ft) + y(b.ft)) / 2,
        grade: gradeOf(s),
        length: lengthOf(s),
        room: w > 44,
      };
    })
  );

  let exaggeration = $derived.by(() => {
    const span = maxFt - minFt;
    if (span <= 0 || totalMi <= 0) return 0;
    const runPx = W - 2 * PAD_X;
    return (RISE / span) / (runPx / (totalMi * 5280));
  });
</script>

<div
  class="grade-profile"
  role="img"
  aria-label={segments.length
    ? `Composite grade profile, ${segments.length} grade${segments.length === 1 ? '' : 's'} in the order a vehicle meets them: ${segments.map((s) => `${lengthOf(s)} mi at ${gradeOf(s)}%`).join(', ')}`
    : 'Composite grade profile, no grades entered'}
>
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet">
    {#if segments.length && totalMi > 0}
      <path d={pavement} class="gp-pavement" />
      {#if governingPath}
        <path d={governingPath} class="gp-governing" />
        <path d={governingPath} class="gp-governing-edge" fill="none" />
      {/if}
      <polyline points={surfaceLine} class="gp-edge" fill="none" />
      <polyline points={underLine} class="gp-edge gp-edge-soft" fill="none" />

      {#each nodes as n, i}
        {#if i > 0 && i < nodes.length - 1}
          <line x1={x(n.mi)} y1={y(n.ft) - 6} x2={x(n.mi)} y2={y(n.ft) + BAND + 6} class="gp-tick" />
        {/if}
      {/each}

      <!-- Direction of travel, pointing into the first grade: the segment order is an input,
           not a drawing choice, so the profile has to say which end the vehicle enters. -->
      <polygon
        points="{PAD_X - 20},{y(nodes[0].ft) + BAND / 2 - 4} {PAD_X - 20},{y(nodes[0].ft) + BAND / 2 + 4} {PAD_X - 8},{y(nodes[0].ft) + BAND / 2}"
        class="gp-arrow"
      />

      {#each labels as l}
        {#if l.room}
          <text x={l.mid} y={l.yMid - 8} class="gp-grade" text-anchor="middle">{l.grade}%</text>
          <text x={l.mid} y={l.yMid + BAND + 16} class="gp-len" text-anchor="middle">{l.length} mi</text>
        {/if}
        {#if l.i === governing}
          <text x={l.mid} y={l.yMid + BAND + (l.room ? 28 : 16)} class="gp-gov-label" text-anchor="middle">governs capacity</text>
        {/if}
      {/each}

      <text x={PAD_X} y={H - 6} class="gp-len">entry</text>
      <text x={W - PAD_X} y={H - 6} class="gp-len" text-anchor="end">{totalMi.toFixed(2)} mi total</text>
    {:else}
      <text x={W / 2} y={H / 2} class="gp-len" text-anchor="middle">Add a grade to draw the profile</text>
    {/if}
  </svg>
  {#if exaggeration > 0}
    <p class="gp-caption">Lengths to scale, elevation exaggerated about {Math.round(exaggeration)}x.</p>
  {/if}
</div>

<style>
  .grade-profile svg { width: 100%; height: auto; display: block; }
  .gp-pavement { fill: var(--diag-pavement); }
  .gp-governing { fill: color-mix(in srgb, var(--diag-center) 45%, var(--diag-pavement-alt)); }
  .gp-governing-edge { stroke: var(--diag-center); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .gp-edge { stroke: var(--diag-edge); stroke-width: 1.6; vector-effect: non-scaling-stroke; }
  .gp-edge-soft { opacity: 0.5; }
  .gp-tick { stroke: var(--diag-edge); stroke-width: 1; opacity: 0.45; vector-effect: non-scaling-stroke; }
  .gp-arrow { fill: var(--diag-edge); opacity: 0.7; }
  .gp-grade { font-size: 11px; font-weight: 600; fill: var(--diag-edge); }
  .gp-len { font-size: 9px; fill: var(--diag-dim); }
  .gp-gov-label { font-size: 9px; font-weight: 600; fill: var(--diag-center); }
  .gp-caption { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.35rem; text-align: center; }
</style>
