<script>
  // Interactive strip view of a freeway facility (HCM Chapter 10): the
  // segment chain drawn upstream to downstream, widths proportional to
  // segment length, mainline depth to lane count, and the ramp geometry of
  // merge, diverge, weaving, and overlapping-ramp segments sketched below
  // the mainline. After a run, each segment fills with its LOS color for the
  // selected analysis period, which makes the time-space domain readable at
  // a glance. Clicking a segment reports the index so the page can highlight
  // the matching table row.
  let {
    segments = [],
    losMatrix = null,
    densityMatrix = null,
    // Adjacent managed lane (HCM Chapter 10 Steps A-9/A-13, Chapter 25
    // Section 2). `mlLanes` is parallel to `segments`, carrying null where a
    // segment has no managed lane, which is how the engine takes it too.
    mlLanes = null,
    mlLosMatrix = null,
    mlDensityMatrix = null,
    selected = -1,
    onselect = null,
    note = 'Segment chain, upstream to downstream. Widths follow segment length; press Calculate to color each segment by its per-period LOS.',
  } = $props();

  let period = $state(0);

  const LANE = 10;
  const LABEL_TOP = 22;
  const ML_GAP = 7;     // painted separation between the ML and GP lane groups
  const RL = 7;         // acceleration/deceleration lane depth
  const RAMP_H = 17;    // how far the ramp stubs reach below the mainline

  let periods = $derived(losMatrix && losMatrix[0] ? losMatrix[0].length : 0);
  $effect(() => {
    if (period >= periods) period = 0;
  });

  // With a managed lane the strip carries two stacked bands, so it needs a
  // left gutter wide enough to name which is which.
  let gutter = $derived(mlLanes && mlLanes.some((n) => n) ? 22 : 8);

  const clampLanes = (n) => Math.max(1, Math.min(8, n));

  // Per-segment work zone (HCM Chapter 10, Section 4), read off the same
  // `segments` state the page hands to set_work_zone so the picture cannot
  // disagree with the run.
  //
  // A three-to-two closure takes a lane out of the cross section, it does not
  // add one beside it: the drawn pavement is the normal lane count the closure
  // declares, the closed lanes overlay its ramp-side lanes, and the travelled
  // band is what is left. The engine does not do this narrowing itself. It
  // takes the segment's lane count as the lanes that stay open and folds the
  // closure into CAF_wz and SAF_wz through the lane closure severity index
  // (Equations 10-7, 10-11, 10-12), which is why Segment 11 of case4.json is
  // coded as two lanes carrying a three-to-two closure. Coded that way the
  // drawing and the run agree exactly. Coded with the full three lanes they do
  // not, and the chip says so instead of the strip silently picking one.
  function wzFor(s, lanes) {
    const wz = s.work_zone;
    if (!wz) return null;
    const open = clampLanes(Number(wz.open_lanes) || 1);
    const total = Math.max(open, clampLanes(Number(wz.total_lanes) || open));
    const mismatch = lanes !== open;
    return {
      open,
      total,
      closed: total - open,
      soft: !!wz.soft_barrier,
      mismatch,
      label: `WZ ${total}→${open}${mismatch ? ' !' : ''}`,
    };
  }

  function wzNote(seg) {
    const base = `work zone ${seg.wz.total} to ${seg.wz.open} lanes, ${seg.wz.soft ? 'cones or drums' : 'hard barrier'}`;
    return seg.wz.mismatch ? `${base}, but the segment is coded with ${seg.lanes} lanes, which is what the run uses` : base;
  }

  let layout = $derived.by(() => {
    let x = gutter;
    return (segments || []).map((s, i) => {
      const len = Math.max(200, Number(s.length_ft) || 1000);
      const w = Math.max(36, Math.min(120, 22 + len / 55));
      const lanes = clampLanes(Number(s.lanes) || 3);
      const ml = mlLanes && mlLanes[i] ? Math.max(1, Math.min(4, Number(mlLanes[i]) || 1)) : 0;
      const wz = wzFor(s, lanes);
      // Drawn cross section: the wider of the coded lanes and the lanes the
      // closure says are normally there, so a closure never hides coded
      // pavement and never invents pavement past what it declares. `open` is
      // the travelled band left after the closed lanes come off the ramp side.
      const pav = wz ? Math.max(lanes, wz.total) : lanes;
      const open = pav - (wz ? wz.closed : 0);
      const item = { x, w, lanes, open, pav, ml, wz, type: s.seg_type, num: s.seg_num };
      x += w + 3;
      return item;
    });
  });
  let totalW = $derived((layout.at(-1)?.x ?? gutter) + (layout.at(-1)?.w ?? 0) + 8);
  // Drawn pavement, not the coded lane count: on a work zone segment the two
  // differ, and the strip has to leave room for the wider of them.
  let maxLanes = $derived(Math.max(3, ...layout.map((l) => l.pav)));
  let maxMl = $derived(Math.max(0, ...layout.map((l) => l.ml)));
  // The managed lane group is painted above the general-purpose mainline, so
  // its depth pushes the mainline down rather than growing the strip in place.
  let mlDepth = $derived(maxMl > 0 ? maxMl * LANE + ML_GAP : 0);
  let top = $derived(LABEL_TOP + mlDepth);
  let H = $derived(top + maxLanes * LANE + RAMP_H + 26);

  const LOS_COLOR = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444', F: '#b91c1c' };

  function fillFor(i) {
    if (!losMatrix || !losMatrix[i]) return 'var(--diag-pavement)';
    const los = losMatrix[i][period];
    return LOS_COLOR[los] ?? 'var(--diag-pavement)';
  }
  function losFor(i) {
    return losMatrix && losMatrix[i] ? losMatrix[i][period] : null;
  }
  function densityFor(i) {
    return densityMatrix && densityMatrix[i] ? densityMatrix[i][period] : null;
  }
  function mlFillFor(i) {
    if (!mlLosMatrix || !mlLosMatrix[i]) return 'var(--diag-pavement)';
    return LOS_COLOR[mlLosMatrix[i][period]] ?? 'var(--diag-pavement)';
  }
  function mlLosFor(i) {
    return mlLosMatrix && mlLosMatrix[i] ? mlLosMatrix[i][period] : null;
  }
  function mlDensityFor(i) {
    return mlDensityMatrix && mlDensityMatrix[i] ? mlDensityMatrix[i][period] : null;
  }

  function pick(i) {
    onselect?.(i);
  }
</script>

<div class="fd-diagram">
  <svg viewBox="0 0 {totalW} {H}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label="freeway facility, {segments.length} segments upstream to downstream">
    <defs>
      <!-- Closure hatch. A hard barrier reads as a continuous diagonal
           (concrete), cones and drums as an interrupted one, both at the same
           pitch so two closures compare at a glance. -->
      <pattern id="fdWzHard" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" class="fd-wz-stripe" />
      </pattern>
      <pattern id="fdWzSoft" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" class="fd-wz-stripe soft" />
      </pattern>
    </defs>
    {#each layout as seg, i}
      {@const trav = top + seg.open * LANE}
      {@const bot = top + seg.pav * LANE}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <g class="fd-seg" class:selected={selected === i} class:wz={!!seg.wz}
         data-wz-open={seg.wz ? seg.wz.open : null} data-wz-closed={seg.wz ? seg.wz.closed : null}
         onclick={() => pick(i)} role="button" tabindex="-1"
         aria-label="segment {seg.num}, {seg.type}{losFor(i) ? `, LOS ${losFor(i)}` : ''}{seg.ml ? ', managed lane' : ''}{seg.wz ? `, ${wzNote(seg)}` : ''}">
        <title>Segment {seg.num} · {seg.type}{losFor(i) ? ` · LOS ${losFor(i)} · ${densityFor(i)?.toFixed(1)} veh/mi/ln` : ''}{seg.ml && mlLosFor(i) ? ` · ML LOS ${mlLosFor(i)} · ${mlDensityFor(i)?.toFixed(1)} veh/mi/ln` : ''}{seg.wz ? ` · ${wzNote(seg)}` : ''}</title>

        <!-- adjacent managed lane group, drawn above the mainline it parallels -->
        {#if seg.ml}
          <rect x={seg.x} y={top - ML_GAP - seg.ml * LANE} width={seg.w} height={seg.ml * LANE}
                fill={mlFillFor(i)} class="fd-ml" class:scored={mlLosFor(i) != null} />
          {#if mlLosFor(i)}
            <text x={seg.x + seg.w / 2} y={top - ML_GAP - (seg.ml * LANE) / 2 + 3.5}
                  class="fd-ml-los" text-anchor="middle">{mlLosFor(i)}</text>
          {/if}
        {/if}

        <!-- mainline -->
        <rect x={seg.x} y={top} width={seg.w} height={seg.open * LANE}
              fill={fillFor(i)} class="fd-main" class:scored={losFor(i) != null} />
        {#each Array.from({ length: seg.open - 1 }) as _, li}
          <line x1={seg.x} y1={top + LANE * (li + 1)} x2={seg.x + seg.w} y2={top + LANE * (li + 1)} class="fd-lane-line" />
        {/each}

        <!-- closed lanes: pavement fill, then the barrier hatch over it, so the
             hatch never doubles the pavement edge -->
        {#if seg.wz && seg.wz.closed > 0}
          <rect x={seg.x} y={trav} width={seg.w} height={seg.wz.closed * LANE} class="fd-wz" />
          <rect x={seg.x} y={trav} width={seg.w} height={seg.wz.closed * LANE} class="fd-wz-hatch"
                fill="url(#{seg.wz.soft ? 'fdWzSoft' : 'fdWzHard'})" />
        {/if}

        <!-- ramp geometry below the mainline: an angled entry/exit stub feeding
             an acceleration or deceleration lane that tapers into the mainline -->
        {#if seg.type === 'Merge'}
          <polygon points="{seg.x - 14},{bot + RAMP_H} {seg.x - 4},{bot + RAMP_H} {seg.x + 10},{bot + RL} {seg.x},{bot + RL}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <polygon points="{seg.x},{bot} {seg.x},{bot + RL} {seg.x + seg.w * 0.55},{bot + RL} {seg.x + seg.w * 0.78},{bot}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <line x1={seg.x} y1={bot} x2={seg.x + seg.w * 0.55} y2={bot} class="fd-lane-line" />
        {:else if seg.type === 'Diverge'}
          <polygon points="{seg.x + seg.w * 0.22},{bot} {seg.x + seg.w * 0.45},{bot + RL} {seg.x + seg.w},{bot + RL} {seg.x + seg.w},{bot}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <polygon points="{seg.x + seg.w},{bot + RL} {seg.x + seg.w + 10},{bot + RL} {seg.x + seg.w + 14},{bot + RAMP_H} {seg.x + seg.w + 4},{bot + RAMP_H}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <line x1={seg.x + seg.w * 0.45} y1={bot} x2={seg.x + seg.w} y2={bot} class="fd-lane-line" />
        {:else if seg.type === 'Weaving'}
          <rect x={seg.x} y={bot} width={seg.w} height={RL} fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <polygon points="{seg.x - 14},{bot + RAMP_H} {seg.x - 4},{bot + RAMP_H} {seg.x + 10},{bot + RL} {seg.x},{bot + RL}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <polygon points="{seg.x + seg.w},{bot + RL} {seg.x + seg.w + 10},{bot + RL} {seg.x + seg.w + 14},{bot + RAMP_H} {seg.x + seg.w + 4},{bot + RAMP_H}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <line x1={seg.x} y1={bot} x2={seg.x + seg.w} y2={bot} class="fd-lane-line" />
        {:else if seg.type === 'OverlappingRamp'}
          <polygon points="{seg.x - 12},{bot + RAMP_H} {seg.x - 2},{bot + RAMP_H} {seg.x + 8},{bot + RL} {seg.x},{bot + RL}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <polygon points="{seg.x},{bot} {seg.x},{bot + RL} {seg.x + seg.w * 0.62},{bot + RL} {seg.x + seg.w * 0.62},{bot}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <polygon points="{seg.x + seg.w * 0.38},{bot} {seg.x + seg.w * 0.38},{bot + RL} {seg.x + seg.w},{bot + RL} {seg.x + seg.w},{bot}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <polygon points="{seg.x + seg.w},{bot + RL} {seg.x + seg.w + 8},{bot + RL} {seg.x + seg.w + 12},{bot + RAMP_H} {seg.x + seg.w + 2},{bot + RAMP_H}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <line x1={seg.x} y1={bot} x2={seg.x + seg.w} y2={bot} class="fd-lane-line" />
        {/if}

        <!-- labels -->
        <text x={seg.x + seg.w / 2} y={LABEL_TOP - 7} class="fd-num" text-anchor="middle">{seg.num}</text>
        {#if losFor(i)}
          <text x={seg.x + seg.w / 2} y={top + (seg.open * LANE) / 2 + 3.5} class="fd-los" text-anchor="middle">{losFor(i)}</text>
        {/if}
        {#if seg.wz}
          <text x={seg.x + seg.w / 2} y={seg.wz.closed > 0 ? trav + (seg.wz.closed * LANE) / 2 + 2.2 : trav - 2.5}
                class="fd-wz-chip" class:mismatch={seg.wz.mismatch} data-testid="wz-chip"
                text-anchor="middle">{seg.wz.label}</text>
        {/if}
        <text x={seg.x + seg.w / 2} y={H - 6} class="fd-type" text-anchor="middle">{seg.type === 'OverlappingRamp' ? 'Ovlp' : seg.type}</text>
      </g>
    {/each}

    <!-- direction arrow -->
    <polygon points="{totalW - 26},{LABEL_TOP - 14} {totalW - 12},{LABEL_TOP - 10} {totalW - 26},{LABEL_TOP - 6}" class="fd-arrow" />

    {#if maxMl > 0}
      <text x="2" y={top - ML_GAP - (maxMl * LANE) / 2 + 3} class="fd-band-label">ML</text>
      <text x="2" y={top + (maxLanes * LANE) / 2 + 3} class="fd-band-label">GP</text>
    {/if}
  </svg>

  <div class="fd-bar">
    {#if periods > 0}
      <div class="fd-periods" role="group" aria-label="Analysis period">
        {#each Array.from({ length: periods }) as _, p}
          <button type="button" class="fd-chip" class:active={period === p} onclick={() => (period = p)}>P{p + 1}</button>
        {/each}
      </div>
      <div class="fd-scale" aria-hidden="true">
        {#each Object.entries(LOS_COLOR) as [l, c]}
          <span class="fd-swatch" style="background:{c}">{l}</span>
        {/each}
      </div>
    {:else}
      <p class="fd-note">{note}</p>
    {/if}
  </div>
</div>

<style>
  .fd-diagram svg {
    width: 100%;
    max-width: 760px;
    display: block;
    margin: 0 auto;
  }
  .fd-seg { cursor: pointer; }
  .fd-main, .fd-ramp, .fd-ml {
    stroke: var(--diag-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    transition: fill 150ms ease;
  }
  .fd-main.scored, .fd-ramp.scored, .fd-ml.scored { stroke: rgba(15, 23, 42, 0.35); }
  .fd-seg.selected .fd-main, .fd-seg.selected .fd-ml { stroke: var(--accent); stroke-width: 2.5; }
  .fd-lane-line { stroke: var(--diag-lane-line); stroke-width: 1; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; opacity: 0.8; }
  /* Closure tint comes off the warning tokens, which are defined in both
     themes and sit outside the LOS colour channel. */
  .fd-wz { fill: var(--warn-bg); stroke: var(--diag-edge); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .fd-wz-hatch { stroke: none; pointer-events: none; }
  .fd-wz-stripe { stroke: var(--warn-text); stroke-width: 1.4; opacity: 0.85; }
  .fd-wz-stripe.soft { stroke-dasharray: 2 2.2; }
  .fd-wz-chip { font-size: 6px; font-weight: 700; fill: var(--warn-text); paint-order: stroke; stroke: var(--warn-bg); stroke-width: 2px; pointer-events: none; }
  .fd-wz-chip.mismatch { font-style: italic; }
  .fd-num { font-size: 8px; fill: var(--text-muted); font-weight: 600; }
  .fd-los { font-size: 9px; fill: #ffffff; font-weight: 700; paint-order: stroke; stroke: rgba(15, 23, 42, 0.45); stroke-width: 2px; }
  .fd-ml-los { font-size: 8px; fill: #ffffff; font-weight: 700; paint-order: stroke; stroke: rgba(15, 23, 42, 0.45); stroke-width: 2px; }
  .fd-type { font-size: 7px; fill: var(--text-faint); }
  .fd-band-label { font-size: 7px; fill: var(--text-muted); font-weight: 700; }
  .fd-arrow { fill: var(--diag-dim); }

  .fd-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-top: 0.4rem; flex-wrap: wrap; }
  .fd-periods { display: inline-flex; gap: 0.25rem; flex-wrap: wrap; }
  .fd-chip {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.12rem 0.5rem;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .fd-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .fd-scale { display: inline-flex; gap: 2px; }
  .fd-swatch {
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
  .fd-note { font-size: 0.72rem; color: var(--text-muted); margin: 0; }
</style>
