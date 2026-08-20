<script>
  // The time-space heatmap: the Exhibit 10-10 domain as the primary result
  // view. Segments across, analysis periods down, one cell per segment-period,
  // which is the unit the Chapter 10 methodology actually computes.
  //
  // The value is printed in every cell and the fill is a second channel on top
  // of it. That is what makes the view survive a greyscale print, a reader who
  // cannot separate two adjacent steps, and the forced-colours case, and it is
  // why the grid is an HTML table rather than an SVG: the letters are text, the
  // header cells are header cells, and the whole thing is selectable and
  // printable without a second rendering path.
  //
  // Wide facilities scroll inside `.hm-scroll` rather than widening the page,
  // and the period column is sticky, so scrolling out to segment 15 does not
  // lose which row is which.

  import { MEASURES, measureById, domainOf, cellStyle, cellText, legendStops } from './heatmap.js';

  /**
   * @typedef {Object} Props
   * @property {any} result frozen analysis result from analyze.js
   * @property {boolean} [dark] page theme, so the ramp anchors at the surface end
   */

  /** @type {Props} */
  let { result, dark = false } = $props();

  let measureId = $state('los');
  let selected = $state(null); // { s, p }
  // Roving focus: one tab stop for the whole grid with arrow keys inside it,
  // because a 15-by-15 facility is 225 cells and 225 tab stops is not
  // navigation. The key handler sits on the cells rather than on the table,
  // since the cells are the interactive elements and a listener on a table is
  // one nothing reaches by keyboard.
  let focusCell = $state({ s: 0, p: 0 });
  let gridEl = $state(null);

  let measure = $derived(measureById(measureId));
  let matrix = $derived(result.matrices[measure.key]);
  let domain = $derived(measure.kind === 'ramp' ? domainOf(matrix) : null);
  let stops = $derived(legendStops(measure, domain, dark));
  // On a measure the HCM reads the other way round the ramp still runs
  // pale-to-deep as operation degrades, so the pale end of the legend carries
  // the high value rather than the low one.
  let legendLow = $derived(domain ? (measure.invert ? domain.hi : domain.lo) : null);
  let legendHigh = $derived(domain ? (measure.invert ? domain.lo : domain.hi) : null);

  let detail = $derived(selected ? detailFor(selected.s, selected.p) : null);

  function detailFor(s, p) {
    const m = result.matrices;
    return {
      s,
      p,
      seg: result.segments[s],
      los: m.los[s][p],
      demandLos: m.demandLos?.[s]?.[p] ?? null,
      speed: m.speed[s][p],
      densityVeh: m.density[s][p],
      densityPc: m.densityPc[s][p],
      dc: m.dc[s][p],
      capacity: m.capacity[s][p],
      volume: m.volume?.[s]?.[p] ?? null,
      queueFt: m.queue?.[s]?.[p] ?? null,
    };
  }

  function selectCell(s, p) {
    selected = selected && selected.s === s && selected.p === p ? null : { s, p };
    focusCell = { s, p };
  }

  function onGridKey(e) {
    const moves = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    if (e.key === 'Home') {
      e.preventDefault();
      moveFocus(0, focusCell.p);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      moveFocus(result.numSegments - 1, focusCell.p);
      return;
    }
    const d = moves[e.key];
    if (!d) return;
    e.preventDefault();
    moveFocus(focusCell.s + d[0], focusCell.p + d[1]);
  }

  function moveFocus(s, p) {
    const ns = Math.min(result.numSegments - 1, Math.max(0, s));
    const np = Math.min(result.numPeriods - 1, Math.max(0, p));
    focusCell = { s: ns, p: np };
    gridEl?.querySelector(`[data-cell="${ns}-${np}"]`)?.focus();
  }

  const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '–');
  const SHORT = { Basic: 'Bas', Merge: 'Mrg', Diverge: 'Div', Weaving: 'Wev', OverlappingRamp: 'Ovl' };
</script>

<section class="hm" aria-label="Time-space heatmap" data-testid="heatmap">
  <div class="hm-head">
    <div>
      <h2>Time-space domain</h2>
      <p class="hm-sub">
        One cell per segment and analysis period, which is the unit Chapter 10 computes (Exhibit 10-10). Select a cell
        for everything the engine reports about it. Every cell prints its own value, so the grid reads the same in
        colour, in greyscale and on paper.
      </p>
    </div>
    <label class="hm-measure">
      Colour by
      <select bind:value={measureId} data-testid="measure-select" aria-label="Heatmap measure">
        {#each MEASURES as m}
          <option value={m.id}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="hm-legend" data-testid="heatmap-legend">
    {#if measure.kind === 'status'}
      <span class="hm-legend-label">LOS</span>
      {#each stops as s}
        <span class="hm-chip" style="background:{s.fill};color:{s.ink}">{s.letter}</span>
      {/each}
    {:else}
      <span class="hm-legend-label">{measure.label}{measure.unit ? ` (${measure.unit})` : ''}</span>
      <span class="hm-legend-end" data-testid="legend-low">{fmt(legendLow, measure.digits)}</span>
      <span class="hm-ramp">
        {#each stops as s}<span class="hm-ramp-step" style="background:{s.fill}"></span>{/each}
      </span>
      <span class="hm-legend-end" data-testid="legend-high">{fmt(legendHigh, measure.digits)}</span>
    {/if}
    <span class="hm-legend-note">{measure.note}</span>
  </div>

  <div class="hm-scroll">
    <table class="hm-grid" bind:this={gridEl} data-testid="heatmap-grid">
      <caption class="sr-only">
        {measure.label} by segment and analysis period for {result.facilityName}. Use the arrow keys to move between
        cells.
      </caption>
      <thead>
        <tr>
          <th scope="col" class="hm-corner">Period</th>
          {#each result.segments as seg}
            <th scope="col" class="hm-seg-head" class:wz={seg.workZone} data-testid="heatmap-col">
              <span class="hm-seg-num">{seg.index + 1}</span>
              <span class="hm-seg-type">{SHORT[seg.segType] ?? seg.segType}</span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each { length: result.numPeriods } as _, p}
          <tr data-testid="heatmap-row">
            <th scope="row" class="hm-period">{p + 1}</th>
            {#each result.segments as seg, s}
              {@const value = matrix[s][p]}
              {@const style = cellStyle(measure, value, domain, dark)}
              <td class="hm-cell-wrap">
                <button
                  type="button"
                  class="hm-cell"
                  class:selected={selected && selected.s === s && selected.p === p}
                  data-cell="{s}-{p}"
                  data-testid="heatmap-cell"
                  data-seg={s + 1}
                  data-period={p + 1}
                  data-value={cellText(measure, value)}
                  data-los={result.matrices.los[s][p]}
                  tabindex={focusCell.s === s && focusCell.p === p ? 0 : -1}
                  style="background:{style.fill};color:{style.ink}"
                  aria-label="Segment {s + 1} {seg.segType}, period {p + 1}, {measure.label} {cellText(
                    measure,
                    value,
                  )}{measure.unit ? ` ${measure.unit}` : ''}"
                  onclick={() => selectCell(s, p)}
                  onkeydown={onGridKey}
                  onfocus={() => (focusCell = { s, p })}>{cellText(measure, value)}</button
                >
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if detail}
    <div
      class="hm-detail"
      data-testid="cell-detail"
      role="region"
      aria-live="polite"
      aria-label="Segment {detail.s + 1}, period {detail.p + 1}"
    >
      <div class="hm-detail-head">
        <h3>Segment {detail.s + 1} ({detail.seg.segType}) · Period {detail.p + 1}</h3>
        <button type="button" class="hm-close" onclick={() => (selected = null)} data-testid="close-detail"
          >close</button
        >
      </div>
      <dl class="hm-detail-grid">
        <div>
          <dt>Level of service</dt>
          <dd data-testid="detail-los">{detail.los}</dd>
        </div>
        <div>
          <dt>Space mean speed</dt>
          <dd data-testid="detail-speed">{fmt(detail.speed, 1)} mi/h</dd>
        </div>
        <div>
          <dt>Density</dt>
          <dd data-testid="detail-density">{fmt(detail.densityVeh, 1)} veh/mi/ln</dd>
        </div>
        <!-- The LOS letter is read off the passenger-car density, not the
             vehicle one, so both are shown rather than leaving a reader to
             wonder which the letter came from. -->
        <div>
          <dt>Density, passenger cars</dt>
          <dd data-testid="detail-density-pc">{fmt(detail.densityPc, 1)} pc/mi/ln</dd>
        </div>
        <div>
          <dt>Capacity</dt>
          <dd data-testid="detail-capacity">{fmt(detail.capacity, 0)} veh/h</dd>
        </div>
        <div>
          <dt>Demand-to-capacity</dt>
          <dd data-testid="detail-dc">{fmt(detail.dc, 2)}</dd>
        </div>
        <div>
          <dt>Volume served</dt>
          <dd data-testid="detail-volume">{fmt(detail.volume, 0)} veh/h</dd>
        </div>
        <div>
          <dt>Queue length</dt>
          <dd data-testid="detail-queue">{fmt(detail.queueFt, 0)} ft</dd>
        </div>
        <div>
          <dt>Cross section</dt>
          <dd>{detail.seg.lanes} lanes, {Math.round(detail.seg.lengthFt).toLocaleString('en-US')} ft</dd>
        </div>
        {#if detail.demandLos}
          <!-- Exhibit 10-6: a segment whose demand exceeds its capacity is LOS
               F on demand even where the metered volume it actually serves
               earns a better letter. The two are different questions and the
               manual prints both. -->
          <div>
            <dt>Demand-based LOS</dt>
            <dd data-testid="detail-demand-los">{detail.demandLos}</dd>
          </div>
        {/if}
        {#if detail.seg.workZone}
          <div>
            <dt>Work zone</dt>
            <dd data-testid="detail-work-zone">Yes, the capacity shown is post-CAF<sub>wz</sub></dd>
          </div>
        {/if}
      </dl>
    </div>
  {/if}
</section>

<style>
  .hm {
    margin-top: 1.5rem;
  }
  .hm-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .hm-head h2 {
    font-size: 1rem;
    margin: 0 0 0.25rem;
  }
  .hm-sub {
    margin: 0;
    font-size: 0.76rem;
    color: var(--text-muted);
    max-width: 68ch;
    line-height: 1.5;
  }
  .hm-measure {
    font-size: 0.74rem;
    color: var(--text-secondary);
    display: inline-flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .hm-measure select {
    font-size: 0.78rem;
    padding: 0.1rem 0.25rem;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border-strong);
    border-radius: 3px;
  }

  .hm-legend {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
    margin: 0.6rem 0 0.4rem;
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .hm-legend-label {
    font-weight: 600;
    color: var(--text-secondary);
  }
  .hm-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.4rem;
    height: 1.25rem;
    border-radius: 3px;
    font-weight: 700;
    font-size: 0.7rem;
  }
  .hm-ramp {
    display: inline-flex;
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid var(--border-strong);
  }
  .hm-ramp-step {
    width: 1.5rem;
    height: 0.7rem;
  }
  .hm-legend-end {
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary);
  }
  .hm-legend-note {
    flex-basis: 100%;
    line-height: 1.45;
  }

  .hm-scroll {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--surface);
  }
  .hm-grid {
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.72rem;
  }
  .hm-corner,
  .hm-period {
    position: sticky;
    left: 0;
    z-index: 2;
    background: var(--surface);
  }
  .hm-corner {
    font-size: 0.66rem;
    color: var(--text-muted);
    font-weight: 600;
    text-align: left;
    padding: 0.25rem 0.45rem;
  }
  .hm-period {
    font-weight: 600;
    color: var(--text-secondary);
    text-align: right;
    padding: 0 0.45rem;
    white-space: nowrap;
  }
  .hm-seg-head {
    padding: 0.2rem 0.15rem;
    font-weight: 600;
    color: var(--text-secondary);
    line-height: 1.15;
    min-width: 3.1rem;
  }
  .hm-seg-head.wz {
    color: var(--warn-text);
  }
  .hm-seg-num {
    display: block;
    font-size: 0.74rem;
  }
  .hm-seg-type {
    display: block;
    font-size: 0.6rem;
    color: var(--text-muted);
    font-weight: 500;
  }
  .hm-seg-head.wz .hm-seg-type {
    color: var(--warn-text);
  }

  .hm-cell-wrap {
    padding: 1px;
  }
  /* Every cell is its own button: click opens the detail, and the grid takes a
     single tab stop with arrow keys inside it. */
  .hm-cell {
    display: block;
    width: 100%;
    min-width: 3rem;
    padding: 0.28rem 0.2rem;
    border: 1px solid rgba(120, 120, 120, 0.35);
    border-radius: 3px;
    font: inherit;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: center;
    cursor: pointer;
  }
  .hm-cell:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .hm-cell.selected {
    box-shadow: inset 0 0 0 2px var(--text);
  }

  .hm-detail {
    margin-top: 0.7rem;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    padding: 0.5rem 0.65rem;
    background: var(--surface-subtle);
  }
  .hm-detail-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
  }
  .hm-detail-head h3 {
    font-size: 0.85rem;
    margin: 0 0 0.35rem;
  }
  .hm-close {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 0.72rem;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }
  .hm-detail-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.4rem;
    margin: 0;
  }
  .hm-detail-grid dt {
    font-size: 0.68rem;
    color: var(--text-muted);
    margin: 0;
  }
  .hm-detail-grid dd {
    font-size: 0.82rem;
    color: var(--text);
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* On paper the fills are unreliable and often suppressed outright, so the
     printed grid falls back to the values and a plain rule. */
  @media print {
    .hm-scroll {
      overflow: visible;
    }
    .hm-cell {
      background: transparent !important;
      color: #000 !important;
      border-color: #999;
    }
  }
</style>
