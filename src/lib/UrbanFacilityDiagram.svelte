<script>
  // Strip view of an urban street facility (HCM Chapter 16): the segment chain
  // drawn upstream to downstream in the subject direction of travel, with the
  // boundary intersections that separate the segments drawn as cross streets.
  // Segment widths follow length, deck depth follows the through-lane count,
  // and the driveway ticks below each link are placed from the access-point
  // count. After a run each segment fills with its LOS colour, which is what
  // makes a facility's poorest-performing segment findable at a glance. A
  // click reports the segment index so the page can highlight the matching
  // segment card.
  //
  // The urban counterpart of FacilityDiagram.svelte (freeway facilities): same
  // strip idiom and the same selection contract, but the geometry between
  // segments is a cross street rather than a ramp.
  import { LOS_COLORS } from './los.js';

  let {
    segments = [],
    selected = -1,
    onselect = null,
    note = 'Segment chain, upstream to downstream, separated by its boundary intersections. Widths follow segment length; press Calculate to colour each segment by its LOS.'
  } = $props();

  const TOP = 32;        // deck top edge
  const LANE = 12;
  const CW = 16;         // cross-street width
  const CROSS_OUT = 15;  // how far the cross-street stubs run past the deck
  const TICK_H = 7;      // driveway stub depth below the deck
  const PAD = 6;
  const ARROW_PAD = 26;  // clear space past the last cross street for the direction arrow

  let lanesOf = (s) => Math.max(1, Math.min(6, Math.round(Number(s.lanes) || 2)));

  // One pass upstream to downstream: a boundary intersection, a segment, a
  // boundary intersection, and so on, so a facility of n segments has n + 1
  // cross streets.
  let layout = $derived.by(() => {
    let x = PAD;
    const segs = [];
    const crosses = [{ x: x + CW / 2, signalized: (segments[0]?.control ?? 'signalized') === 'signalized' }];
    for (const s of segments) {
      x += CW;
      const len = Math.max(200, Number(s.length_ft) || 1000);
      const w = Math.max(44, Math.min(150, 26 + len / 22));
      segs.push({
        x,
        w,
        lanes: lanesOf(s),
        ap: Math.max(0, Math.min(12, Math.round(Number(s.accessPoints) || 0))),
        los: s.los || null,
        control: s.control || 'signalized',
        length_ft: Number(s.length_ft) || 0
      });
      x += w;
      crosses.push({ x: x + CW / 2, signalized: (s.control ?? 'signalized') === 'signalized' });
    }
    return { segs, crosses, totalW: x + CW + PAD + ARROW_PAD };
  });

  let maxLanes = $derived(Math.max(2, ...layout.segs.map((s) => s.lanes)));
  let deckH = $derived(maxLanes * LANE);
  let BOT = $derived(TOP + deckH);
  let H = $derived(BOT + CROSS_OUT + TICK_H + 26);
  let arrowY = $derived(TOP + deckH / 2);

  let anyLos = $derived(layout.segs.some((s) => s.los));

  function fillFor(s) {
    return s.los ? LOS_COLORS[s.los] : 'var(--diag-pavement)';
  }

  // Driveways are spaced evenly for legibility; the method uses only the count.
  function driveways(s) {
    return Array.from({ length: s.ap }, (_, k) => s.x + (s.w * (k + 1)) / (s.ap + 1));
  }

  let ariaLabel = $derived(
    `urban street facility, ${layout.segs.length} segment${layout.segs.length === 1 ? '' : 's'} upstream to downstream` +
    (anyLos ? `, coloured by segment level of service` : '')
  );
</script>

<div class="uf-diagram">
  <svg viewBox="0 0 {layout.totalW} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>

    <!-- ══ pavement (fills only) ══ -->
    {#each layout.crosses as c}
      <rect x={c.x - CW / 2} y={TOP - CROSS_OUT} width={CW} height={deckH + CROSS_OUT * 2} class="uf-cross" />
    {/each}
    {#each layout.segs as s}
      {@const bot = TOP + s.lanes * LANE}
      {#each driveways(s) as dx}
        <rect x={dx - 2.2} y={bot} width="4.4" height={TICK_H} class="uf-drive" />
      {/each}
    {/each}

    <!-- ══ segments ══ -->
    {#each layout.segs as s, i}
      {@const bot = TOP + s.lanes * LANE}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <g class="uf-seg" class:selected={selected === i} onclick={() => onselect?.(i)}
         role="button" tabindex="-1"
         aria-label="segment {i + 1}, {Math.round(s.length_ft).toLocaleString('en-US')} feet{s.los ? `, LOS ${s.los}` : ''}">
        <title>Segment {i + 1} · {Math.round(s.length_ft).toLocaleString('en-US')} ft{s.los ? ` · LOS ${s.los}` : ''}</title>

        <rect x={s.x} y={TOP} width={s.w} height={s.lanes * LANE}
              fill={fillFor(s)} class="uf-deck" class:scored={s.los != null} />

        <!-- lane lines and the stop bar at the downstream boundary -->
        {#each Array.from({ length: s.lanes - 1 }) as _, li}
          <line x1={s.x} y1={TOP + LANE * (li + 1)} x2={s.x + s.w} y2={TOP + LANE * (li + 1)} class="uf-lane-line" />
        {/each}
        {#if s.control !== 'uncontrolled'}
          <line x1={s.x + s.w - 2} y1={TOP} x2={s.x + s.w - 2} y2={bot} class="uf-stop" />
        {/if}

        <text x={s.x + s.w / 2} y={TOP - CROSS_OUT - 5} class="uf-num" text-anchor="middle">{i + 1}</text>
        {#if s.los}
          <text x={s.x + s.w / 2} y={TOP + (s.lanes * LANE) / 2 + 3.5} class="uf-los" text-anchor="middle">{s.los}</text>
        {/if}
        <text x={s.x + s.w / 2} y={H - 6} class="uf-len" text-anchor="middle">{Math.round(s.length_ft).toLocaleString('en-US')} ft</text>
      </g>
    {/each}

    <!-- ══ boundary-intersection markings, over every segment deck ══ -->
    {#each layout.crosses as c}
      <line x1={c.x} y1={TOP - CROSS_OUT} x2={c.x} y2={TOP} class="uf-cross-center" />
      <line x1={c.x} y1={BOT} x2={c.x} y2={BOT + CROSS_OUT} class="uf-cross-center" />
      {#if c.signalized}
        <rect x={c.x - 3} y={TOP - CROSS_OUT - 12} width="6" height="11" rx="1.6" class="uf-signal" />
        <circle cx={c.x} cy={TOP - CROSS_OUT - 9.2} r="1.3" class="uf-signal-r" />
        <circle cx={c.x} cy={TOP - CROSS_OUT - 6.5} r="1.3" class="uf-signal-y" />
        <circle cx={c.x} cy={TOP - CROSS_OUT - 3.8} r="1.3" class="uf-signal-g" />
      {/if}
    {/each}

    <!-- direction of travel, clear of the last boundary intersection -->
    <line x1={layout.totalW - ARROW_PAD} y1={arrowY} x2={layout.totalW - 9} y2={arrowY} class="uf-arrow-line" />
    <polygon points="{layout.totalW - 13},{arrowY - 4} {layout.totalW - 4},{arrowY} {layout.totalW - 13},{arrowY + 4}" class="uf-arrow" />
  </svg>

  <div class="uf-bar">
    {#if anyLos}
      <div class="uf-scale" aria-hidden="true">
        {#each Object.entries(LOS_COLORS) as [l, c]}
          <span class="uf-swatch" style="background:{c}">{l}</span>
        {/each}
      </div>
    {/if}
    <p class="uf-note">{note}</p>
  </div>
</div>

<style>
  .uf-diagram svg {
    width: 100%;
    max-width: 760px;
    display: block;
    margin: 0 auto;
  }
  .uf-seg { cursor: pointer; }
  .uf-cross { fill: var(--diag-pavement-alt); }
  .uf-drive { fill: var(--diag-pavement-alt); stroke: var(--diag-edge); stroke-width: 0.6; vector-effect: non-scaling-stroke; }
  .uf-deck {
    stroke: var(--diag-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    transition: fill 150ms ease;
  }
  .uf-deck.scored { stroke: rgba(15, 23, 42, 0.35); }
  .uf-seg.selected .uf-deck { stroke: var(--accent); stroke-width: 2.5; }
  .uf-lane-line { stroke: var(--diag-lane-line); stroke-width: 1; stroke-dasharray: 6 5; vector-effect: non-scaling-stroke; opacity: 0.8; }
  .uf-stop { stroke: var(--diag-lane-line); stroke-width: 2.5; vector-effect: non-scaling-stroke; }
  .uf-cross-center { stroke: var(--diag-center); stroke-width: 1.25; vector-effect: non-scaling-stroke; }
  .uf-signal { fill: var(--diag-edge); }
  .uf-signal-r { fill: #dc2626; }
  .uf-signal-y { fill: #eab308; }
  .uf-signal-g { fill: #16a34a; }
  .uf-arrow { fill: var(--diag-dim); }
  .uf-arrow-line { stroke: var(--diag-dim); stroke-width: 1.5; vector-effect: non-scaling-stroke; }

  .uf-num { font-size: 8px; fill: var(--text-muted); font-weight: 600; }
  .uf-los { font-size: 10px; fill: #ffffff; font-weight: 700; paint-order: stroke; stroke: rgba(15, 23, 42, 0.45); stroke-width: 2px; }
  .uf-len { font-size: 7px; fill: var(--text-faint); }
  /* Labels and markings must not swallow a tap meant for the segment below. */
  .uf-num, .uf-los, .uf-len, .uf-lane-line, .uf-stop, .uf-cross-center, .uf-arrow, .uf-arrow-line, .uf-drive { pointer-events: none; }

  .uf-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-top: 0.4rem; flex-wrap: wrap; }
  .uf-scale { display: inline-flex; gap: 2px; }
  .uf-swatch {
    width: 1.15rem;
    height: 1.05rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.62rem;
    font-weight: 700;
    color: #fff;
    border-radius: 3px;
    text-shadow: 0 0 2px rgba(15, 23, 42, 0.5);
  }
  .uf-note { font-size: 0.72rem; color: var(--text-muted); margin: 0; flex: 1 1 16rem; }
</style>
