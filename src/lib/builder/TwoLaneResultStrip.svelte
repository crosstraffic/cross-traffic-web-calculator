<script>
  // The two-lane highway result view: segments across, one row of values.
  //
  // This is the urban result strip's shape for the same reason it has that
  // shape. `WasmTwoLaneHighways` takes one demand volume per segment and exposes
  // no period axis at all, so a Chapter 15 run produces exactly one value per
  // segment per measure. The design gives a single-period method the
  // strip-with-values view rather than a time-space grid, and this is it.
  //
  // One thing is genuinely different from the urban strip and it is not
  // cosmetic. A passing lane's cell holds its MIDPOINT follower density and
  // every other cell holds a plain or Step 9 adjusted endpoint value, which are
  // different quantities. The cell is marked and the detail panel prints both,
  // because a reader comparing a passing lane's 6.04 against its neighbour's
  // 21.60 and concluding the lane fixed the highway would be wrong twice over.

  import { TWOLANE_MEASURES, twoLaneMeasureById, domainOf, cellStyle, cellText, legendStops } from './heatmap.js';

  /**
   * @typedef {Object} Props
   * @property {any} result frozen analysis result from twoLaneAnalyze.js
   * @property {boolean} [dark] page theme, so the ramp anchors at the surface end
   */

  /** @type {Props} */
  let { result, dark = false } = $props();

  let measureId = $state('los');
  let selected = $state(null);
  let focusIndex = $state(0);
  let rowEl = $state(null);

  let measure = $derived(twoLaneMeasureById(measureId));
  // One row, so the domain is over the segments. `domainOf` takes a matrix, so
  // the row is handed to it as a matrix of one.
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
  const mi = (v) => (Number.isFinite(v) ? v.toFixed(2) : '–');
  // Indexed by `passing_type`, which is what the result carries, so this is an
  // abbreviation of PASSING_TYPE_NAMES rather than a second list of types.
  const SHORT = ['PC', 'PZ', 'PL'];
</script>

<section class="ts-wrap" aria-label="Segment results" data-testid="twolane-result-strip">
  <div class="ts-head">
    <h2>Segment results</h2>
    <label class="ts-measure">
      Measure
      <select bind:value={measureId} data-testid="twolane-measure">
        {#each TWOLANE_MEASURES as m}<option value={m.id}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>{/each}
      </select>
    </label>
  </div>

  <p class="ts-note" data-testid="twolane-measure-note">{measure.note}</p>

  <p class="ts-single" data-testid="twolane-single-period">
    The Chapter 15 method is single-period, so this is one value per segment rather than a time-space grid. Chapter 15 also has no reliability methodology, so unlike a freeway or an urban street facility there is no distribution below this to hand the highway to.
  </p>

  <div class="ts-scroll">
    <table class="ts-grid">
      <caption class="ts-caption">Segments in the analysis direction, one column each.</caption>
      <thead>
        <tr>
          <th scope="col" class="ts-corner">Segment</th>
          {#each result.segments as s}
            <th scope="col" class="ts-col">
              {s.index + 1}
              <span class="ts-col-sub">{SHORT[s.passingType]} · {mi(s.lengthMi)} mi</span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <tr bind:this={rowEl} onkeydown={onRowKey}>
          <th scope="row" class="ts-rowhead">{measure.label}{measure.unit ? ` (${measure.unit})` : ''}</th>
          {#each result.segments as s, i}
            {@const v = s[measure.key]}
            {@const style = cellStyle(measure, v, domain, dark)}
            <td class="ts-cell" class:selected={selected === i}
                class:midpoint={measure.id === 'followerDensity' && s.passingType === 2}
                data-testid="twolane-cell" data-cell-index={i}
                data-measure={measure.id} data-value={v ?? ''}
                data-passing-type={s.passingType}
                style="background:{style.fill}; color:{style.ink}"
                tabindex={focusIndex === i ? 0 : -1}
                role="button"
                aria-label="segment {i + 1}, {measure.label} {cellText(measure, v)}{measure.unit ? ` ${measure.unit}` : ''}{measure.id === 'followerDensity' && s.passingType === 2 ? ', midpoint value of a passing lane' : ''}"
                onclick={() => selectCell(i)}>
              {cellText(measure, v)}
            </td>
          {/each}
        </tr>
      </tbody>
    </table>
  </div>

  <div class="ts-legend" aria-hidden="true">
    {#if measure.kind === 'status'}
      {#each stops as st}
        <span class="ts-stop" style="background:{st.fill}; color:{st.ink}">{st.letter}</span>
      {/each}
    {:else if domain}
      <span class="ts-legend-end">{n(legendLow, measure.digits)}</span>
      {#each stops as st}<span class="ts-stop ts-ramp" style="background:{st.fill}"></span>{/each}
      <span class="ts-legend-end">{n(legendHigh, measure.digits)}</span>
    {/if}
  </div>

  {#if measure.id === 'followerDensity' && result.segments.some((s) => s.passingType === 2)}
    <p class="ts-note" data-testid="twolane-midpoint-note">
      The outlined cell is a passing lane, and its value is the midpoint follower density of Step 8 rather than the endpoint value the other cells hold. Steps 10 and 11 read the midpoint for a passing lane, so it is the comparable number for the letter and for the facility, but it is not the density a driver leaving the lane meets.
    </p>
  {/if}

  {#if detail}
    <div class="ts-detail" data-testid="twolane-cell-detail">
      <h3>Segment {detail.index + 1}</h3>
      <dl>
        <div><dt>Type</dt><dd>{detail.segType}</dd></div>
        <div><dt>Length</dt><dd>{mi(detail.lengthMi)} mi</dd></div>
        <div><dt>Grade</dt><dd>{n(detail.grade, 1)} %</dd></div>
        <div><dt>Posted limit</dt><dd>{n(detail.spl, 0)} mi/h</dd></div>
        <div><dt>Vertical class</dt><dd>{detail.verticalAlignment}{detail.verticalAlignment !== detail.verticalClassEntered ? ` (entered ${detail.verticalClassEntered})` : ''}</dd></div>
        <div><dt>Demand flow</dt><dd>{n(detail.flowRate, 0)} veh/h</dd></div>
        <div><dt>Opposing flow</dt><dd>{n(detail.opposingFlow, 0)} veh/h</dd></div>
        <div><dt>Capacity</dt><dd>{n(detail.capacity, 0)} veh/h</dd></div>
        <div><dt>Free-flow speed</dt><dd>{n(detail.ffs, 2)} mi/h</dd></div>
        <div><dt>Average speed</dt><dd>{n(detail.avgSpeed, 1)} mi/h</dd></div>
        <div><dt>Percent followers</dt><dd>{n(detail.percentFollowers, 1)} %</dd></div>
        <div><dt>Follower density</dt><dd>{n(detail.followerDensity, 2)} followers/mi</dd></div>
        {#if detail.passingType === 2}
          <div><dt>At its end</dt><dd>{n(detail.fd, 2)} followers/mi</dd></div>
        {:else if detail.fdAdjustment > 0}
          <div><dt>Unadjusted</dt><dd>{n(detail.fd, 2)} followers/mi, before the Step 9 passing-lane adjustment</dd></div>
        {/if}
        <div><dt>LOS</dt><dd>{detail.los ?? '–'}</dd></div>
        {#if detail.isHc}
          <div><dt>Horizontal curves</dt><dd>{detail.curveCount} in {detail.subsegmentCount} subsegments (Step 5d)</dd></div>
        {/if}
        {#if detail.demotedPassingLane}
          <div><dt>Passing lane</dt><dd>Placed here but shorter than the 0.5 mi Exhibit 15-10 minimum, so analyzed as Passing Constrained</dd></div>
        {/if}
        {#if detail.outsideRecommended}
          <div><dt>Exhibit 15-10</dt><dd>Outside the recommended {n(detail.minLengthMi, 2)} to {n(detail.maxLengthMi, 2)} mi for this class and type</dd></div>
        {/if}
        {#if detail.overridden}
          <div><dt>Override</dt><dd>This row was pinned by hand, so it does not follow the features.</dd></div>
        {/if}
      </dl>
    </div>
  {/if}
</section>

<style>
  .ts-wrap { margin-top: 1.25rem; }
  .ts-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .ts-head h2 { font-size: 1rem; margin: 0 0 0.35rem; }
  .ts-measure { font-size: 0.75rem; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 0.3rem; }
  .ts-note, .ts-single { font-size: 0.76rem; color: var(--text-muted); margin: 0 0 0.4rem; max-width: 88ch; line-height: 1.5; }

  .ts-scroll { overflow-x: auto; }
  .ts-grid { border-collapse: collapse; font-size: 0.8rem; }
  .ts-caption { caption-side: bottom; font-size: 0.72rem; color: var(--text-faint); text-align: left; padding-top: 0.3rem; }
  .ts-grid th, .ts-grid td { border: 1px solid var(--border); padding: 0.25rem 0.5rem; }
  .ts-col { font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-align: center; }
  .ts-col-sub { display: block; font-weight: 400; font-size: 0.66rem; color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .ts-rowhead, .ts-corner { position: sticky; left: 0; background: var(--surface); text-align: left; font-size: 0.74rem; color: var(--text-muted); font-weight: 600; white-space: nowrap; z-index: 1; }
  .ts-cell { text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; cursor: pointer; min-width: 4.6rem; }
  .ts-cell.selected { outline: 2px solid var(--accent-strong); outline-offset: -2px; }
  .ts-cell:focus-visible { outline: 2px solid var(--accent-strong); outline-offset: -2px; }
  /* A passing lane's follower density is a different quantity from its
     neighbours', so the cell is marked rather than left to read as comparable.
     A dashed inset border rather than a fill, because the fill is already
     carrying the magnitude. */
  .ts-cell.midpoint { box-shadow: inset 0 0 0 2px var(--accent-strong); }

  .ts-legend { display: flex; align-items: center; gap: 0.15rem; margin: 0.5rem 0 0; flex-wrap: wrap; }
  .ts-stop { display: inline-flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.1rem; font-size: 0.68rem; font-weight: 700; border-radius: 2px; }
  .ts-stop.ts-ramp { width: 1.9rem; }
  .ts-legend-end { font-size: 0.68rem; color: var(--text-muted); font-variant-numeric: tabular-nums; margin: 0 0.25rem; }

  .ts-detail { margin-top: 0.75rem; padding: 0.5rem 0.6rem; border: 1px solid var(--border); border-radius: 4px; background: var(--surface-subtle); }
  .ts-detail h3 { font-size: 0.86rem; margin: 0 0 0.3rem; }
  .ts-detail dl { display: flex; flex-wrap: wrap; gap: 0.3rem 1.4rem; margin: 0; }
  .ts-detail dt { font-size: 0.68rem; color: var(--text-muted); }
  .ts-detail dd { margin: 0; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
</style>
