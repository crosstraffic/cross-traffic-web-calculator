<script>
  // The builder's strip: the derived segmentation drawn along the mainline,
  // with the placed features as draggable markers beneath it.
  //
  // One thing here departs from FacilityDiagram.svelte deliberately. That strip
  // clamps each segment's drawn width into a 36-120 px band so an 11-segment
  // facility fits a printable width, which is right when the picture is a
  // legend for a table. This one is linear in station, because a marker is
  // dragged by pointer position and the station it lands on has to be the
  // station under the pointer. A 360-ft overlapping ramp is therefore genuinely
  // thin, which is what a 360-ft segment is.

  let {
    doc,
    rows = [],
    selectedKey = null,
    highlightIds = [],
    onselectrow = null,
    onselectfeature = null,
    onrevealfeature = null, // (id) on a click that moved nothing, so the list can scroll to it
    onmovefeature = null,   // (id, stationFt, phase) where phase is 'drag' | 'end'
    interactive = true
  } = $props();

  const W = 900;
  const LANE = 11;
  const TOP = 48;          // room for the work-zone bracket, the direction arrow and the station ruler
  const RAMP_H = 26;       // how far the ramp stubs reach below the mainline
  const PAD = 24;         // left room for the "mi" axis label beside the zero tick
  const SNAP_FT = 528;     // 0.1 mi, per the design; the numeric field is the fine adjustment

  let svgEl = $state(null);
  let dragging = $state(null);
  // Whether the pointer actually moved the feature between down and up. A press
  // that moved nothing is a click, and a click opens the feature's editor and
  // scrolls to it; a drag must not, because scrolling the page mid-gesture
  // moves the strip out from under the pointer.
  let dragMoved = false;

  const clampLanes = (n) => Math.max(1, Math.min(8, Math.round(Number(n) || 3)));

  let L = $derived(Math.max(1, doc?.mainline?.lengthFt ?? 1));
  let plotW = $derived(W - 2 * PAD);
  // Depth follows the widest cross section anywhere on the facility, so a lane
  // added halfway along does not resize the strip under the pointer mid-drag.
  let maxLanes = $derived(Math.max(3, ...laid.map((s) => s.pav)));
  let H = $derived(TOP + maxLanes * LANE + RAMP_H + 30);
  let bot = $derived(TOP + maxLanes * LANE);

  const xOf = (ft) => PAD + (ft / L) * plotW;
  const ftOf = (x) => ((x - PAD) / plotW) * L;

  // Segment-type fills come off the diagram tokens rather than the LOS scale,
  // because phase 1a has no results and a green segment would read as LOS A.
  // Phase 1b's heatmap is where LOS_COLORS from $lib/los.js belongs.
  // Merge and diverge get different fills rather than one influence-area
  // colour, because the segments this builder exists to show are often too
  // narrow to carry a label: Example Problem 1's third ramp pair draws as
  // 1,140 / 360 / 1,140 ft inside a 6-mi facility, which is 31 px, 10 px and
  // 31 px at a printable width. If the fill did not carry the type, that whole
  // group would read as one undifferentiated block.
  const FILL = {
    Basic: 'var(--diag-pavement)',
    Merge: 'var(--diag-infl)',
    Diverge: 'var(--diag-infl-edge)',
    OverlappingRamp: 'var(--diag-infl-soft)',
    Weaving: 'var(--diag-scl-active)'
  };
  const SHORT = { OverlappingRamp: 'Ovlp', Weaving: 'Weave', Diverge: 'Div', Merge: 'Merge', Basic: 'Basic' };

  let laid = $derived(
    rows.map((r, i) => {
      const x = xOf(r.startFt);
      const w = Math.max(1.5, (r.length_ft / L) * plotW);
      const open = clampLanes(r.lanes);
      // A closure takes a lane out of the cross section, it does not add one
      // beside it. `r.lanes` is what the engine analyzes, which is the lanes
      // that stay open, so the drawn pavement is the wider of that and the
      // closure's declared total and the difference is drawn closed. This is
      // the same reading FacilityDiagram.svelte uses, and Example Problem 4 is
      // why: its closure segment is coded with two lanes carrying a
      // three-to-two closure.
      const wz = r.work_zone
        ? {
            total: Math.max(open, clampLanes(r.work_zone.total_lanes)),
            open,
            soft: !!r.work_zone.soft_barrier
          }
        : null;
      const pav = wz ? wz.total : open;
      return { r, i, x, w, mid: x + w / 2, open, pav, wz, closed: wz ? wz.total - open : 0 };
    })
  );

  let features = $derived(
    [...(doc?.features ?? [])]
      .filter((f) => f.kind === 'on_ramp' || f.kind === 'off_ramp')
      .sort((a, b) => a.stationFt - b.stationFt)
      .map((f) => ({ f, x: xOf(f.stationFt) }))
  );

  // Lane changes and work zones are drawn on the pavement rather than under it,
  // because they describe the mainline rather than something joining it.
  let laneChanges = $derived(
    (doc?.features ?? [])
      .filter((f) => f.kind === 'lane_change')
      .map((f) => ({ f, x: xOf(f.stationFt) }))
  );
  let zones = $derived(
    (doc?.features ?? [])
      .filter((f) => f.kind === 'work_zone')
      .map((f) => ({ f, x: xOf(f.stationFt), w: Math.max(2, xOf(f.endFt) - xOf(f.stationFt)) }))
  );

  // Mile ticks, thinned so a long facility does not print a solid rule.
  let ticks = $derived.by(() => {
    const miles = L / 5280;
    const step = miles > 12 ? 2 : miles > 5 ? 1 : 0.5;
    const out = [];
    for (let mi = 0; mi <= miles + 1e-6; mi += step) out.push({ mi, x: xOf(mi * 5280) });
    return out;
  });

  function pick(r) {
    onselectrow?.(r.key);
  }

  function stationFromEvent(e) {
    const box = svgEl.getBoundingClientRect();
    const raw = ftOf(((e.clientX - box.left) / box.width) * W);
    const snapped = Math.round(raw / SNAP_FT) * SNAP_FT;
    return Math.max(0, Math.min(L, snapped));
  }

  function startDrag(e, f) {
    if (!interactive) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragging = f.id;
    dragMoved = false;
    onselectfeature?.(f.id);
  }

  function moveDrag(e, f) {
    if (dragging !== f.id) return;
    const to = stationFromEvent(e);
    // Compared against the feature's own station rather than counted as a
    // pointermove, because the strip snaps to 0.1 mi: a press that jitters a
    // few pixels fires moves that change nothing and is still a click.
    if (to !== f.stationFt) dragMoved = true;
    onmovefeature?.(f.id, to, 'drag');
  }

  function endDrag(e, f) {
    if (dragging !== f.id) return;
    dragging = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // A press that moved nothing commits nothing. Committing the pointer's
    // station anyway would snap a feature whose station is not on the 0.1-mi
    // grid — every station an example problem loads — so clicking a marker to
    // read it would silently move it.
    if (dragMoved) onmovefeature?.(f.id, stationFromEvent(e), 'end');
    else onrevealfeature?.(f.id);
  }

  // Keyboard is not an accessibility afterthought here: the strip snaps to
  // 0.1 mi and the arrow keys are how a station is nudged by one snap without
  // going to the numeric field.
  function keyNudge(e, f) {
    if (!interactive) return;
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(L, f.stationFt + dir * SNAP_FT));
    onmovefeature?.(f.id, next, 'end');
  }

  const mi = (ft) => (ft / 5280).toFixed(2);
</script>

<div class="bs-strip" data-testid="builder-strip">
  <svg bind:this={svgEl} viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet"
       role="img" aria-label="freeway facility under construction, {rows.length} derived segments and {features.length} features">
    <defs>
      <!-- Closure hatching in the two barrier kinds the engine distinguishes:
           a solid stripe for a hard barrier, a dashed one for cones or drums
           (soft_barrier). Same visual language as FacilityDiagram.svelte. -->
      <pattern id="bsWzHard" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="7" class="bs-wz-stripe" />
      </pattern>
      <pattern id="bsWzSoft" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="7" class="bs-wz-stripe soft" />
      </pattern>
    </defs>

    <!-- station ruler -->
    {#each ticks as t}
      <line x1={t.x} y1={TOP - 8} x2={t.x} y2={TOP} class="bs-tick" />
      <text x={t.x} y={TOP - 11} class="bs-tick-label" text-anchor="middle">{t.mi.toFixed(t.mi % 1 ? 1 : 0)}</text>
    {/each}
    <text x="2" y={TOP - 9} class="bs-axis-label">mi</text>

    <!-- Edge of the widest cross section on the facility, drawn under the
         segments so that anything narrower visibly falls short of it. Without a
         datum an added lane is an 11 px step in a 148 px frame and reads as
         nothing; against this line it reads as a lane. -->
    <line x1={PAD} y1={bot} x2={W - PAD} y2={bot} class="bs-datum" />

    <!-- derived segments -->
    {#each laid as s (s.r.key)}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <g class="bs-seg" class:selected={selectedKey === s.r.key} class:overridden={s.r.overridden}
         data-testid="strip-seg" data-seg-type={s.r.seg_type} data-seg-key={s.r.key}
         data-seg-lanes={s.open} data-seg-wz={s.wz ? 'yes' : null}
         onclick={() => pick(s.r)} role="button" tabindex="-1"
         aria-label="segment {s.i + 1}, {s.r.seg_type}, {Math.round(s.r.length_ft)} feet, {s.open} lanes{s.wz ? `, work zone ${s.wz.total} to ${s.wz.open} lanes` : ''}">
        <title>Segment {s.i + 1} · {s.r.seg_type} · {Math.round(s.r.length_ft).toLocaleString('en-US')} ft · station {mi(s.r.startFt)}–{mi(s.r.startFt + s.r.length_ft)} mi</title>
        <rect x={s.x} y={TOP} width={s.w} height={s.open * LANE} fill={FILL[s.r.seg_type] ?? FILL.Basic} class="bs-main" />
        {#each Array.from({ length: s.open - 1 }) as _, li}
          <line x1={s.x} y1={TOP + LANE * (li + 1)} x2={s.x + s.w} y2={TOP + LANE * (li + 1)} class="bs-lane-line" />
        {/each}
        {#if s.closed > 0}
          <rect x={s.x} y={TOP + s.open * LANE} width={s.w} height={s.closed * LANE} class="bs-wz" />
          <rect x={s.x} y={TOP + s.open * LANE} width={s.w} height={s.closed * LANE} class="bs-wz-hatch"
                fill="url(#{s.wz.soft ? 'bsWzSoft' : 'bsWzHard'})" />
        {/if}
        {#if s.w > 34}
          <!-- Centred inside a lane rather than at mid-depth, because at an
               even lane count mid-depth is exactly a lane line and the dashes
               show through the gaps between letters as a strikethrough. The
               halo hides the line under the glyphs and cannot hide it between
               them, so the label moves instead. -->
          <text x={s.mid} y={TOP + (Math.floor(s.open / 2) + 0.5) * LANE + 3} class="bs-seg-label" class:plain={s.r.seg_type === 'Basic'} text-anchor="middle">{SHORT[s.r.seg_type] ?? s.r.seg_type}</text>
        {/if}
        <text x={s.mid} y={H - 4} class="bs-seg-num" text-anchor="middle">{s.i + 1}</text>
      </g>
    {/each}

    <!-- features, drawn over the segments they produced -->
    {#each features as { f, x } (f.id)}
      {@const lit = highlightIds.includes(f.id)}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <g class="bs-feat" class:on={f.kind === 'on_ramp'} class:dragging={dragging === f.id} class:lit
         data-testid="feature-marker" data-feature-id={f.id} data-station-ft={f.stationFt}
         role="slider" tabindex="0"
         aria-label="{f.kind === 'on_ramp' ? 'on' : 'off'}-ramp {f.label || f.id} at station {mi(f.stationFt)} mi"
         aria-valuemin="0" aria-valuemax={Math.round(L)} aria-valuenow={f.stationFt} aria-valuetext="{mi(f.stationFt)} mi"
         onpointerdown={(e) => startDrag(e, f)}
         onpointermove={(e) => moveDrag(e, f)}
         onpointerup={(e) => endDrag(e, f)}
         onpointercancel={(e) => endDrag(e, f)}
         onkeydown={(e) => keyNudge(e, f)}>
        <title>{f.kind === 'on_ramp' ? 'On-ramp' : 'Off-ramp'} {f.label || f.id} · gore at {mi(f.stationFt)} mi</title>
        <line x1={x} y1={TOP} x2={x} y2={bot + 4} class="bs-gore" />
        {#if f.kind === 'on_ramp'}
          <polygon points="{x - 16},{bot + RAMP_H} {x - 7},{bot + RAMP_H} {x},{bot + 4} {x - 6},{bot + 4}" class="bs-ramp" />
        {:else}
          <polygon points="{x + 16},{bot + RAMP_H} {x + 7},{bot + RAMP_H} {x},{bot + 4} {x + 6},{bot + 4}" class="bs-ramp" />
        {/if}
        <circle cx={x} cy={bot + 4} r="5.5" class="bs-handle" />
      </g>
    {/each}

    <!-- lane changes: a rule at the station where the cross section steps -->
    {#each laneChanges as { f, x } (f.id)}
      {@const lit = highlightIds.includes(f.id)}
      <g class="bs-lc" class:lit data-testid="lane-change-marker" data-feature-id={f.id}
         data-station-ft={f.stationFt} data-lanes={f.lanes}
         role="slider" tabindex="0"
         aria-label="lane change to {f.lanes} lanes at station {mi(f.stationFt)} mi"
         aria-valuemin="0" aria-valuemax={Math.round(L)} aria-valuenow={f.stationFt} aria-valuetext="{mi(f.stationFt)} mi"
         onpointerdown={(e) => startDrag(e, f)}
         onpointermove={(e) => moveDrag(e, f)}
         onpointerup={(e) => endDrag(e, f)}
         onpointercancel={(e) => endDrag(e, f)}
         onkeydown={(e) => keyNudge(e, f)}>
        <title>Lane change to {f.lanes} lanes at {mi(f.stationFt)} mi</title>
        <line x1={x} y1={TOP - 4} x2={x} y2={bot + 4} class="bs-lc-rule" />
        <text x={x} y={TOP - 6} class="bs-lc-chip" text-anchor="middle">{f.lanes} ln</text>
      </g>
    {/each}

    <!-- work zones: a bracket over the stretch they cover -->
    {#each zones as { f, x, w } (f.id)}
      {@const lit = highlightIds.includes(f.id)}
      <g class="bs-zone" class:lit data-testid="work-zone-marker" data-feature-id={f.id}
         data-station-ft={f.stationFt} data-end-ft={f.endFt}
         role="slider" tabindex="0"
         aria-label="work zone from {mi(f.stationFt)} to {mi(f.endFt)} mi, {f.config.total_lanes} lanes to {f.config.open_lanes}"
         aria-valuemin="0" aria-valuemax={Math.round(L)} aria-valuenow={f.stationFt} aria-valuetext="{mi(f.stationFt)} mi"
         onpointerdown={(e) => startDrag(e, f)}
         onpointermove={(e) => moveDrag(e, f)}
         onpointerup={(e) => endDrag(e, f)}
         onpointercancel={(e) => endDrag(e, f)}
         onkeydown={(e) => keyNudge(e, f)}>
        <title>Work zone {mi(f.stationFt)}&ndash;{mi(f.endFt)} mi, {f.config.total_lanes} lanes to {f.config.open_lanes}</title>
        <line x1={x} y1={TOP - 20} x2={x + w} y2={TOP - 20} class="bs-zone-bar" />
        <line x1={x} y1={TOP - 24} x2={x} y2={TOP - 16} class="bs-zone-bar" />
        <line x1={x + w} y1={TOP - 24} x2={x + w} y2={TOP - 16} class="bs-zone-bar" />
        <text x={x + w / 2} y={TOP - 23} class="bs-zone-chip" text-anchor="middle">WZ {f.config.total_lanes}&rarr;{f.config.open_lanes}</text>
      </g>
    {/each}

    <!-- Direction of travel, on its own row above the ruler: at the right-hand
         edge it would otherwise sit on the last mile tick's label. -->
    <line x1={W - PAD - 46} y1="9" x2={W - PAD - 6} y2="9" class="bs-arrow-line" />
    <polygon points="{W - PAD - 10},{5} {W - PAD},{9} {W - PAD - 10},{13}" class="bs-arrow" />
  </svg>
  <p class="bs-note">
    Segments are derived from the features by the Chapter 10 rules and cannot be dragged. Drag a ramp marker, or focus it and use the arrow keys, to move its gore; stations snap to 0.1 mi and the station field is the fine adjustment. Clicking a marker without moving it opens that feature's editor in the list below.
  </p>
</div>

<style>
  .bs-strip svg { width: 100%; display: block; }
  .bs-seg { cursor: pointer; }
  .bs-main {
    stroke: var(--diag-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    transition: fill 150ms ease;
  }
  .bs-seg.selected .bs-main { stroke: var(--accent); stroke-width: 2.5; }
  .bs-seg.overridden .bs-main { stroke: var(--warn-text); stroke-width: 2; stroke-dasharray: 4 3; }
  .bs-lane-line { stroke: var(--diag-lane-line); stroke-width: 1; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; opacity: 0.8; }
  .bs-tick { stroke: var(--diag-dim); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .bs-tick-label { font-size: 8px; fill: var(--text-muted); }
  .bs-axis-label { font-size: 8px; fill: var(--text-faint); }
  /* The type colours span pale yellow to saturated blue and change again in
     dark mode, so a token text colour reads on some of them and disappears on
     others. The outlined white the house uses for LOS letters reads on all of
     them. Basic segments are the exception and keep a plain token colour: they
     are drawn on the pavement token, which is low-contrast in both themes, and
     an outlined label there reads as a smudge rather than as a word. */
  .bs-seg-label { font-size: 8px; fill: #ffffff; font-weight: 700; paint-order: stroke; stroke: rgba(15, 23, 42, 0.55); stroke-width: 2.4px; pointer-events: none; }
  /* The label sits at mid-depth, which on an even lane count is exactly a lane
     line, so it needs a halo in the pavement colour to knock the dashes out
     from behind the word. The coloured fills get the dark halo above; this is
     the same trick in the other direction. */
  .bs-seg-label.plain { fill: var(--text-secondary); stroke: var(--diag-pavement); stroke-width: 2.6px; font-weight: 600; }
  .bs-seg-num { font-size: 8px; fill: var(--text-faint); pointer-events: none; }

  .bs-feat { cursor: ew-resize; touch-action: none; }
  .bs-gore { stroke: var(--diag-center); stroke-width: 1.4; vector-effect: non-scaling-stroke; stroke-dasharray: 3 3; }
  .bs-ramp { fill: var(--diag-pavement-alt); stroke: var(--diag-edge); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .bs-handle { fill: var(--surface); stroke: var(--text-secondary); stroke-width: 1.6; vector-effect: non-scaling-stroke; }
  .bs-feat.on .bs-handle { stroke: var(--accent); }
  .bs-feat.lit .bs-handle, .bs-feat.dragging .bs-handle { fill: var(--accent); stroke: var(--accent-strong); }
  .bs-feat.lit .bs-gore, .bs-feat.dragging .bs-gore { stroke: var(--accent); stroke-dasharray: none; }
  .bs-feat:focus-visible .bs-handle { fill: var(--accent-soft); stroke: var(--accent-strong); stroke-width: 2.5; }

  /* Closure tint and stripes come off the warning tokens, which are defined in
     both themes and sit outside the segment-type colour channel. */
  .bs-wz { fill: var(--warn-bg); stroke: var(--diag-edge); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .bs-wz-hatch { stroke: none; pointer-events: none; }
  .bs-wz-stripe { stroke: var(--warn-text); stroke-width: 1.4; opacity: 0.85; }
  .bs-wz-stripe.soft { stroke-dasharray: 2 2.2; }

  .bs-lc { cursor: ew-resize; touch-action: none; }
  .bs-lc-rule { stroke: var(--accent); stroke-width: 1.6; vector-effect: non-scaling-stroke; stroke-dasharray: 2 3; }
  .bs-lc-chip { font-size: 7px; font-weight: 700; fill: var(--accent); paint-order: stroke; stroke: var(--surface); stroke-width: 2.5px; }
  .bs-lc.lit .bs-lc-rule { stroke-dasharray: none; stroke-width: 2.4; }
  .bs-lc:focus-visible .bs-lc-rule { stroke-width: 3; stroke-dasharray: none; }

  .bs-zone { cursor: ew-resize; touch-action: none; }
  .bs-zone-bar { stroke: var(--warn-text); stroke-width: 1.6; vector-effect: non-scaling-stroke; }
  .bs-zone-chip { font-size: 7px; font-weight: 700; fill: var(--warn-text); paint-order: stroke; stroke: var(--surface); stroke-width: 2.5px; }
  .bs-zone.lit .bs-zone-bar { stroke-width: 2.6; }
  .bs-zone:focus-visible .bs-zone-bar { stroke-width: 3; }

  .bs-datum { stroke: var(--diag-dim); stroke-width: 1.2; vector-effect: non-scaling-stroke; stroke-dasharray: 2 4; opacity: 0.9; }

  .bs-arrow { fill: var(--diag-dim); }
  .bs-arrow-line { stroke: var(--diag-dim); stroke-width: 1.2; vector-effect: non-scaling-stroke; }
  .bs-note { font-size: 0.72rem; color: var(--text-muted); margin: 0.35rem 0 0; }
</style>
