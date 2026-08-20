<script>
  // The urban street result view: segments across, one row of values.
  //
  // This is the freeway heatmap's grid with the period axis removed, and the
  // axis is removed because the engines do not have one. `WasmUrbanSegment` and
  // `WasmUrbanFacility` take a scalar `through_demand_veh_h`; there is no
  // per-period demand vector anywhere on the urban surface, so a Chapter 16 run
  // produces exactly one value per segment per measure. The design gives a
  // single-period method the strip-with-values view rather than a grid, and this
  // is it: the same measure selector, the same palette, the same
  // value-printed-in-every-cell rule, collapsed to the one row that exists.
  //
  // Inventing a period axis here would mean drawing several identical columns,
  // which would read as a facility that is steady over time rather than as one
  // that was never analyzed over time.

  import { URBAN_MEASURES, urbanMeasureById, domainOf, cellStyle, cellText, legendStops } from './heatmap.js';

  /**
   * @typedef {Object} Props
   * @property {any} result frozen analysis result from urbanAnalyze.js
   * @property {boolean} [dark] page theme, so the ramp anchors at the surface end
   */

  /** @type {Props} */
  let { result, dark = false } = $props();

  let measureId = $state('los');
  let selected = $state(null);
  let focusIndex = $state(0);
  let rowEl = $state(null);

  let measure = $derived(urbanMeasureById(measureId));
  // One row, so the domain is over the segments rather than over a matrix.
  // `domainOf` takes a matrix, so the row is handed to it as a matrix of one.
  let values = $derived(result.segments.map((s) => s[measure.key]));
  let domain = $derived(measure.kind === 'ramp' ? domainOf([values]) : null);
  let stops = $derived(legendStops(measure, domain, dark));
  let legendLow = $derived(domain ? (measure.invert ? domain.hi : domain.lo) : null);
  let legendHigh = $derived(domain ? (measure.invert ? domain.lo : domain.hi) : null);

  let detail = $derived(selected == null ? null : result.segments[selected]);

  function selectCell(i) {
    selected = selected === i ? null : i;
    focusIndex = i;
  }

  function onRowKey(e) {
    const moves = { ArrowRight: 1, ArrowLeft: -1 };
    if (e.key === 'Home') {
      e.preventDefault();
      moveFocus(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      moveFocus(result.segments.length - 1);
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      selectCell(focusIndex);
      return;
    }
    const d = moves[e.key];
    if (d == null) return;
    e.preventDefault();
    moveFocus(focusIndex + d);
  }

  function moveFocus(i) {
    const next = Math.max(0, Math.min(result.segments.length - 1, i));
    focusIndex = next;
    rowEl?.querySelector(`[data-cell-index="${next}"]`)?.focus();
  }

  const n = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '–');
  const ft = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '–');
  const SOURCE_LABEL = {
    published: 'per-point delays supplied',
    computed: 'Chapter 30 Section 4 computed',
    planning: 'Exhibit 18-13 planning estimate',
  };
</script>

<section class="us-wrap" aria-label="Segment results" data-testid="urban-result-strip">
  <div class="us-head">
    <h2>Segment results</h2>
    <label class="us-measure">
      Measure
      <select bind:value={measureId} data-testid="urban-measure">
        {#each URBAN_MEASURES as m}<option value={m.id}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>{/each}
      </select>
    </label>
  </div>

  <p class="us-note" data-testid="urban-measure-note">{measure.note}</p>

  <!-- One row, because the Chapter 16 and 18 engines are single-period. Said
       here rather than only in a comment, so a reader does not go looking for
       the time axis the freeway view has. -->
  <p class="us-single" data-testid="urban-single-period">
    The Chapter 16 and 18 methods are single-period, so this is one value per segment rather than a time-space grid. The
    Chapter 17 handoff below is where variation over time is described, as a distribution rather than as periods.
  </p>

  <div class="us-scroll">
    <table class="us-grid">
      <caption class="us-caption">Segments upstream to downstream, one column each.</caption>
      <thead>
        <tr>
          <th scope="col" class="us-corner">Segment</th>
          {#each result.segments as s}
            <th scope="col" class="us-col">{s.index + 1}<span class="us-col-sub">{ft(s.lengthFt)} ft</span></th>
          {/each}
        </tr>
      </thead>
      <tbody>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <tr bind:this={rowEl} onkeydown={onRowKey}>
          <th scope="row" class="us-rowhead">{measure.label}{measure.unit ? ` (${measure.unit})` : ''}</th>
          {#each result.segments as s, i}
            {@const v = s[measure.key]}
            {@const style = cellStyle(measure, v, domain, dark)}
            <td
              class="us-cell"
              class:selected={selected === i}
              data-testid="urban-cell"
              data-cell-index={i}
              data-measure={measure.id}
              data-value={v ?? ''}
              style="background:{style.fill}; color:{style.ink}"
              tabindex={focusIndex === i ? 0 : -1}
              role="button"
              aria-label="segment {i + 1}, {measure.label} {cellText(measure, v)}{measure.unit
                ? ` ${measure.unit}`
                : ''}"
              onclick={() => selectCell(i)}
            >
              {cellText(measure, v)}
            </td>
          {/each}
        </tr>
      </tbody>
    </table>
  </div>

  <div class="us-legend" aria-hidden="true">
    {#if measure.kind === 'status'}
      {#each stops as st}
        <span class="us-stop" style="background:{st.fill}; color:{st.ink}">{st.letter}</span>
      {/each}
    {:else if domain}
      <span class="us-legend-end">{n(legendLow, measure.digits)}</span>
      {#each stops as st}<span class="us-stop us-ramp" style="background:{st.fill}"></span>{/each}
      <span class="us-legend-end">{n(legendHigh, measure.digits)}</span>
    {/if}
  </div>

  {#if detail}
    <div class="us-detail" data-testid="urban-cell-detail">
      <h3>Segment {detail.index + 1}</h3>
      <dl>
        <div>
          <dt>Length</dt>
          <dd>{ft(detail.lengthFt)} ft</dd>
        </div>
        <div>
          <dt>Through lanes</dt>
          <dd>{detail.lanes}</dd>
        </div>
        <div>
          <dt>Boundary control</dt>
          <dd>{detail.control ?? '–'}</dd>
        </div>
        <div>
          <dt>Travel speed</dt>
          <dd>{n(detail.travelSpeed, 2)} mi/h</dd>
        </div>
        <div>
          <dt>Base free-flow speed</dt>
          <dd>{n(detail.baseFfs, 2)} mi/h</dd>
        </div>
        <div>
          <dt>Spatial stop rate</dt>
          <dd>{n(detail.spatialStopRate, 2)} stops/mi</dd>
        </div>
        <div>
          <dt>Through v/c</dt>
          <dd>{n(detail.vcRatio, 3)}</dd>
        </div>
        <div>
          <dt>LOS</dt>
          <dd>{detail.los ?? '–'}</dd>
        </div>
        {#if result.mode === 'inputs'}
          <div>
            <dt>Access-point delay</dt>
            <dd>{SOURCE_LABEL[detail.apDelaySource] ?? '–'}</dd>
          </div>
        {/if}
        {#if detail.overridden}
          <div>
            <dt>Override</dt>
            <dd>This row was pinned by hand, so it does not follow the signals.</dd>
          </div>
        {/if}
      </dl>
    </div>
  {/if}
</section>

<style>
  .us-wrap {
    margin-top: 1.25rem;
  }
  .us-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .us-head h2 {
    font-size: 1rem;
    margin: 0 0 0.35rem;
  }
  .us-measure {
    font-size: 0.75rem;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .us-note,
  .us-single {
    font-size: 0.76rem;
    color: var(--text-muted);
    margin: 0 0 0.4rem;
    max-width: 88ch;
    line-height: 1.5;
  }

  .us-scroll {
    overflow-x: auto;
  }
  .us-grid {
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .us-caption {
    caption-side: bottom;
    font-size: 0.72rem;
    color: var(--text-faint);
    text-align: left;
    padding-top: 0.3rem;
  }
  .us-grid th,
  .us-grid td {
    border: 1px solid var(--border);
    padding: 0.25rem 0.5rem;
  }
  .us-col {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-weight: 600;
    text-align: center;
  }
  .us-col-sub {
    display: block;
    font-weight: 400;
    font-size: 0.66rem;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
  /* The row head is sticky for the same reason the heatmap's period column is:
     scrolling out to segment 15 must not lose which measure is on screen. */
  .us-rowhead,
  .us-corner {
    position: sticky;
    left: 0;
    background: var(--surface);
    text-align: left;
    font-size: 0.74rem;
    color: var(--text-muted);
    font-weight: 600;
    white-space: nowrap;
    z-index: 1;
  }
  .us-cell {
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    cursor: pointer;
    min-width: 4.2rem;
  }
  .us-cell.selected {
    outline: 2px solid var(--accent-strong);
    outline-offset: -2px;
  }
  .us-cell:focus-visible {
    outline: 2px solid var(--accent-strong);
    outline-offset: -2px;
  }

  .us-legend {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    margin: 0.5rem 0 0;
    flex-wrap: wrap;
  }
  .us-stop {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.1rem;
    font-size: 0.68rem;
    font-weight: 700;
    border-radius: 2px;
  }
  .us-stop.us-ramp {
    width: 1.9rem;
  }
  .us-legend-end {
    font-size: 0.68rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    margin: 0 0.25rem;
  }

  .us-detail {
    margin-top: 0.75rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface-subtle);
  }
  .us-detail h3 {
    font-size: 0.86rem;
    margin: 0 0 0.3rem;
  }
  .us-detail dl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.4rem;
    margin: 0;
  }
  .us-detail dt {
    font-size: 0.68rem;
    color: var(--text-muted);
  }
  .us-detail dd {
    margin: 0;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
</style>
