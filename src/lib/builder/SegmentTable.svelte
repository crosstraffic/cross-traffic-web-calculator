<script>
  // The derived segment table, always visible, and the override layer's editor.
  //
  // Two things are true at once and the table has to show both: every row was
  // produced by a rule, and any row can be pinned to a value the rule did not
  // choose. So a row carries its provenance (the features that made it, and the
  // rule in words) and its override state, and an overridden cell shows what the
  // derivation would have said beside what the analyst pinned.

  import { PASSING_TYPE_NAMES } from '$lib/builder/document.js';

  let {
    rows = [],
    doc,
    selectedKey = null,
    onselect = null,
    onoverride = null,      // (rowKey, field, value, derivedSegType)
    onclearoverride = null, // (rowKey)
    interactive = true
  } = $props();

  /** What a row's type can be pinned to, per chapter. The freeway list was the
   * only one until phase 2, and offering it on an urban or a two-lane row let an
   * analyst pin a segment to a type its own chapter has no such thing as. The
   * derivation's `syncOverrideTwins` carries the pinned value through to the
   * schema field the engine reads. */
  const TYPES_BY_FACILITY = {
    freeway: ['Basic', 'Merge', 'Diverge', 'Weaving', 'OverlappingRamp'],
    urban: ['Signalized', 'AllWayStop', 'YieldControlled', 'Roundabout', 'Uncontrolled'],
    twolane: PASSING_TYPE_NAMES
  };
  let TYPES = $derived(TYPES_BY_FACILITY[doc?.facilityType] ?? TYPES_BY_FACILITY.freeway);
  // Chapter 10 needs two lanes and Chapter 18 one; a two-lane highway carries one
  // in the analysis direction and two through a passing lane.
  let minLanes = $derived(doc?.facilityType === 'freeway' ? 2 : 1);

  let overrideCount = $derived(rows.filter((r) => r.overridden).length);
  let totalMi = $derived(rows.reduce((a, r) => a + r.length_ft, 0) / 5280);

  function edit(r, field, raw) {
    const value = field === 'seg_type' ? raw : Number(raw);
    if (field !== 'seg_type' && !Number.isFinite(value)) return;
    onoverride?.(r.key, field, value, r.derivedSegType ?? r.seg_type);
  }

  const mi = (ft) => (ft / 5280).toFixed(2);
</script>

<div class="st-wrap">
  <div class="st-head">
    <h3>Derived segments</h3>
    <p class="st-sub">
      {rows.length} segment{rows.length === 1 ? '' : 's'}, {totalMi.toFixed(2)} mi{overrideCount ? `, ${overrideCount} overridden` : ''}
    </p>
  </div>

  <div class="st-scroll">
    <table class="st-table" data-testid="segment-table">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Type</th>
          <th scope="col">Length (ft)</th>
          <th scope="col">Lanes</th>
          <th scope="col">Station (mi)</th>
          <th scope="col">From</th>
          <th scope="col"><span class="sr-only">Override</span></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r, i (r.key)}
          <tr class:selected={selectedKey === r.key} class:overridden={r.overridden}
              data-testid="segment-row" data-seg-key={r.key} data-seg-type={r.seg_type}>
            <th scope="row">
              <button type="button" class="st-rownum" onclick={() => onselect?.(r.key)}
                      aria-label="explain segment {i + 1}">{i + 1}</button>
            </th>
            <td>
              {#if interactive}
                <select value={r.seg_type} onchange={(e) => edit(r, 'seg_type', e.currentTarget.value)}
                        aria-label="segment {i + 1} type">
                  {#each TYPES as t}<option value={t}>{t}</option>{/each}
                </select>
              {:else}{r.seg_type}{/if}
            </td>
            <td>
              {#if interactive}
                <input type="number" step="1" min="1" value={Math.round(r.length_ft)}
                       onchange={(e) => edit(r, 'length_ft', e.currentTarget.value)}
                       aria-label="segment {i + 1} length in feet" />
              {:else}{Math.round(r.length_ft)}{/if}
            </td>
            <td>
              {#if interactive}
                <input type="number" step="1" min={minLanes} value={r.lanes}
                       onchange={(e) => edit(r, 'lanes', e.currentTarget.value)}
                       aria-label="segment {i + 1} lanes" />
              {:else}{r.lanes}{/if}
            </td>
            <td class="st-station">{mi(r.startFt)}–{mi(r.startFt + r.length_ft)}</td>
            <td class="st-from">{r.sourceIds.length ? r.sourceIds.join(', ') : '—'}</td>
            <td class="st-flags">
              {#if r.overridden}
                <span class="st-pin" data-testid="override-pin"
                      title={r.derivedSegType && r.derivedSegType !== r.seg_type
                        ? `Derived as ${r.derivedSegType}, ${Math.round(r.derivedLengthFt)} ft`
                        : `Derived as ${Math.round(r.derivedLengthFt ?? r.length_ft)} ft`}>pinned</span>
                {#if r.staleOverride}
                  <span class="st-stale" data-testid="override-stale"
                        title="The derivation now produces a {r.derivedSegType} here, so this override was made against a different segment.">stale</span>
                {/if}
                <button type="button" class="st-clear" onclick={() => onclearoverride?.(r.key)}
                        data-testid="clear-override">clear</button>
              {/if}
            </td>
          </tr>
          {#if selectedKey === r.key}
            <tr class="st-why" data-testid="why-row">
              <td colspan="7">
                <strong>Why this segment?</strong> {r.why}
                {#if r.overridden}
                  <br /><em>This row is pinned. The derivation produces {r.derivedSegType ?? r.seg_type} at {Math.round(r.derivedLengthFt ?? r.length_ft)} ft; clearing the override restores that.</em>
                {/if}
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>

  {#if doc?.importedSegments}
    <p class="st-imported" data-testid="imported-note">
      This facility was imported from a fixture, which stores segments rather than the ramps that produced them. There is no feature layer to re-derive from, so this table is the editor and every change here is an override.
    </p>
  {/if}
</div>

<style>
  .st-wrap { margin-top: 0.75rem; }
  .st-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
  .st-head h3 { margin: 0; font-size: 1rem; }
  .st-sub { margin: 0; font-size: 0.78rem; color: var(--text-muted); }
  .st-scroll { overflow-x: auto; }
  .st-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 0.4rem; }
  .st-table th, .st-table td { padding: 0.22rem 0.4rem; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
  .st-table thead th { color: var(--text-muted); font-weight: 600; font-size: 0.72rem; }
  .st-table tr.selected > * { background: var(--accent-soft); }
  .st-table tr.overridden > * { border-left-color: var(--warn-border); }
  .st-table input, .st-table select { width: 7ch; font-size: 0.78rem; padding: 0.05rem 0.2rem; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 3px; }
  .st-table select { width: auto; }
  .st-rownum { background: none; border: none; color: var(--accent); font-weight: 700; cursor: pointer; padding: 0; font-size: 0.8rem; }
  .st-station, .st-from { color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .st-pin { font-size: 0.68rem; font-weight: 700; color: var(--warn-text); background: var(--warn-bg); border: 1px solid var(--warn-border); border-radius: 3px; padding: 0 0.28rem; }
  .st-stale { font-size: 0.68rem; font-weight: 700; color: var(--warn-text); font-style: italic; margin-left: 0.25rem; }
  .st-clear { margin-left: 0.3rem; font-size: 0.68rem; background: none; border: none; color: var(--accent); cursor: pointer; text-decoration: underline; padding: 0; }
  .st-why td { background: var(--surface-subtle); white-space: normal; font-size: 0.78rem; color: var(--text-secondary); line-height: 1.45; }
  .st-imported { font-size: 0.76rem; color: var(--text-muted); margin: 0.5rem 0 0; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
