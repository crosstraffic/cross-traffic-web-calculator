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
    selected = -1,
    onselect = null,
    note = 'Segment chain, upstream to downstream. Widths follow segment length; press Calculate to color each segment by its per-period LOS.',
  } = $props();

  let period = $state(0);

  const LANE = 10;
  const TOP = 22;
  const RAMP_H = 16;

  let periods = $derived(losMatrix && losMatrix[0] ? losMatrix[0].length : 0);
  $effect(() => {
    if (period >= periods) period = 0;
  });

  let layout = $derived.by(() => {
    let x = 8;
    return (segments || []).map((s) => {
      const len = Math.max(200, Number(s.length_ft) || 1000);
      const w = Math.max(36, Math.min(120, 22 + len / 55));
      const lanes = Math.max(1, Math.min(8, Number(s.lanes) || 3));
      const item = { x, w, lanes, type: s.seg_type, num: s.seg_num };
      x += w + 3;
      return item;
    });
  });
  let totalW = $derived((layout.at(-1)?.x ?? 8) + (layout.at(-1)?.w ?? 0) + 8);
  let maxLanes = $derived(Math.max(3, ...layout.map((l) => l.lanes)));
  let H = $derived(TOP + maxLanes * LANE + RAMP_H + 26);

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

  function pick(i) {
    onselect?.(i);
  }
</script>

<div class="fd-diagram">
  <svg viewBox="0 0 {totalW} {H}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label="freeway facility, {segments.length} segments upstream to downstream">
    {#each layout as seg, i}
      {@const bot = TOP + seg.lanes * LANE}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <g class="fd-seg" class:selected={selected === i}
         onclick={() => pick(i)} role="button" tabindex="-1"
         aria-label="segment {seg.num}, {seg.type}{losFor(i) ? `, LOS ${losFor(i)}` : ''}">
        <title>Segment {seg.num} · {seg.type}{losFor(i) ? ` · LOS ${losFor(i)} · ${densityFor(i)?.toFixed(1)} veh/mi/ln` : ''}</title>

        <!-- mainline -->
        <rect x={seg.x} y={TOP} width={seg.w} height={seg.lanes * LANE}
              fill={fillFor(i)} class="fd-main" class:scored={losFor(i) != null} />
        {#each Array.from({ length: seg.lanes - 1 }) as _, li}
          <line x1={seg.x} y1={TOP + LANE * (li + 1)} x2={seg.x + seg.w} y2={TOP + LANE * (li + 1)} class="fd-lane-line" />
        {/each}

        <!-- ramp geometry below the mainline -->
        {#if seg.type === 'Merge'}
          <polygon points="{seg.x - 12},{bot + RAMP_H} {seg.x + seg.w * 0.45},{bot} {seg.x + 4},{bot}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
        {:else if seg.type === 'Diverge'}
          <polygon points="{seg.x + seg.w - 4},{bot} {seg.x + seg.w + 12},{bot + RAMP_H} {seg.x + seg.w * 0.55},{bot}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
        {:else if seg.type === 'Weaving'}
          <rect x={seg.x} y={bot} width={seg.w} height={LANE * 0.8} fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <polygon points="{seg.x - 12},{bot + RAMP_H} {seg.x},{bot} {seg.x},{bot + LANE * 0.8}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <polygon points="{seg.x + seg.w},{bot} {seg.x + seg.w + 12},{bot + RAMP_H} {seg.x + seg.w},{bot + LANE * 0.8}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
        {:else if seg.type === 'OverlappingRamp'}
          <polygon points="{seg.x - 10},{bot + RAMP_H} {seg.x + seg.w * 0.4},{bot} {seg.x + 2},{bot}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
          <polygon points="{seg.x + seg.w - 2},{bot} {seg.x + seg.w + 10},{bot + RAMP_H} {seg.x + seg.w * 0.6},{bot}" fill={fillFor(i)} class="fd-ramp" class:scored={losFor(i) != null} />
        {/if}

        <!-- labels -->
        <text x={seg.x + seg.w / 2} y={TOP - 7} class="fd-num" text-anchor="middle">{seg.num}</text>
        {#if losFor(i)}
          <text x={seg.x + seg.w / 2} y={TOP + (seg.lanes * LANE) / 2 + 3.5} class="fd-los" text-anchor="middle">{losFor(i)}</text>
        {/if}
        <text x={seg.x + seg.w / 2} y={H - 6} class="fd-type" text-anchor="middle">{seg.type === 'OverlappingRamp' ? 'Ovlp' : seg.type}</text>
      </g>
    {/each}

    <!-- direction arrow -->
    <polygon points="{totalW - 26},{TOP - 14} {totalW - 12},{TOP - 10} {totalW - 26},{TOP - 6}" class="fd-arrow" />
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
  .fd-main, .fd-ramp {
    stroke: var(--diag-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    transition: fill 150ms ease;
  }
  .fd-main.scored, .fd-ramp.scored { stroke: rgba(15, 23, 42, 0.35); }
  .fd-seg.selected .fd-main { stroke: var(--accent); stroke-width: 2.5; }
  .fd-lane-line { stroke: var(--diag-lane-line); stroke-width: 1; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; opacity: 0.8; }
  .fd-num { font-size: 8px; fill: var(--text-muted); font-weight: 600; }
  .fd-los { font-size: 9px; fill: #ffffff; font-weight: 700; paint-order: stroke; stroke: rgba(15, 23, 42, 0.45); stroke-width: 2px; }
  .fd-type { font-size: 7px; fill: var(--text-faint); }
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
