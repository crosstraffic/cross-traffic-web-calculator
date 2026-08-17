<script>
  // Demands by period, one row per demand source: the mainline entering the
  // facility, then each ramp, in station order.
  //
  // The period count is one control for the whole document rather than a
  // per-row length, because the engine reads the number of analysis periods off
  // the mainline demand vector alone (`num_periods` is `mainline_demand.len()`).
  // A ramp vector one period short is therefore not rejected, it is read as a
  // zero, which is a demand the analyst did not enter and a result they would
  // not question.

  import { isRamp } from '$lib/builder/document.js';

  let { doc, onedit = null, onperiods = null, interactive = true } = $props();

  // Ramps only. Lane changes and work zones live in the same `features` array
  // but carry no demand vector at all, and reading `f.demand[p]` off one throws
  // during render, which takes the whole page down rather than showing a blank
  // row. Every consumer of `features` has to say which kinds it means.
  let feats = $derived(
    [...(doc?.features ?? [])].filter(isRamp).sort((a, b) => a.stationFt - b.stationFt)
  );
  let periods = $derived(doc?.periods ?? 0);

  const mi = (ft) => (ft / 5280).toFixed(2);

  function setCell(target, id, p, raw) {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    onedit?.(target, id, p, v);
  }
</script>

<div class="dg-wrap">
  <div class="dg-head">
    <h3>Demands</h3>
    <label class="dg-periods">
      Analysis periods
      <input type="number" min="1" max="96" step="1" value={periods} disabled={!interactive}
             data-testid="period-count"
             onchange={(e) => onperiods?.(Number(e.currentTarget.value))} />
    </label>
  </div>
  <p class="dg-sub">
    Each period is 15 min, and Chapter 10 sets no upper limit on how many there are. Values are veh/h.
  </p>

  <div class="dg-scroll">
    <table class="dg-table" data-testid="demand-grid">
      <thead>
        <tr>
          <th scope="col">Source</th>
          {#each Array.from({ length: periods }) as _, p}
            <th scope="col">P{p + 1}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        <tr data-testid="demand-row" data-source="mainline">
          <th scope="row">Mainline entering</th>
          {#each Array.from({ length: periods }) as _, p}
            <td>
              <input type="number" min="0" step="1" value={doc.mainline.demand[p] ?? 0} disabled={!interactive}
                     aria-label="mainline demand, period {p + 1}"
                     onchange={(e) => setCell('mainline', null, p, e.currentTarget.value)} />
            </td>
          {/each}
        </tr>
        {#each feats as f (f.id)}
          <tr data-testid="demand-row" data-source={f.id}>
            <th scope="row">
              {f.kind === 'on_ramp' ? 'On' : 'Off'}-ramp {f.label || f.id}
              <span class="dg-station">{mi(f.stationFt)} mi</span>
            </th>
            {#each Array.from({ length: periods }) as _, p}
              <td>
                <input type="number" min="0" step="1" value={f.demand[p] ?? 0} disabled={!interactive}
                       aria-label="{f.id} demand, period {p + 1}"
                       onchange={(e) => setCell('feature', f.id, p, e.currentTarget.value)} />
              </td>
            {/each}
          </tr>
          {#if f.kind === 'on_ramp' && f.auxLaneToNext}
            <tr data-testid="demand-row" data-source="{f.id}:r2r">
              <th scope="row" class="dg-sub-row">
                Ramp-to-ramp through the weave
              </th>
              {#each Array.from({ length: periods }) as _, p}
                <td>
                  <input type="number" min="0" step="1" value={f.rampToRampDemand[p] ?? 0} disabled={!interactive}
                         aria-label="{f.id} ramp-to-ramp demand, period {p + 1}"
                         onchange={(e) => setCell('rampToRamp', f.id, p, e.currentTarget.value)} />
                </td>
              {/each}
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .dg-wrap { margin-top: 1rem; }
  .dg-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
  .dg-head h3 { margin: 0; font-size: 1rem; }
  .dg-periods { font-size: 0.78rem; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 0.35rem; }
  .dg-periods input { width: 5ch; }
  .dg-sub { margin: 0.15rem 0 0; font-size: 0.76rem; color: var(--text-muted); }
  .dg-scroll { overflow-x: auto; }
  .dg-table { border-collapse: collapse; font-size: 0.8rem; margin-top: 0.4rem; }
  .dg-table th, .dg-table td { padding: 0.15rem 0.35rem; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
  .dg-table thead th { color: var(--text-muted); font-weight: 600; font-size: 0.72rem; }
  .dg-table tbody th { font-weight: 500; color: var(--text-secondary); }
  .dg-station { color: var(--text-faint); font-size: 0.7rem; margin-left: 0.3rem; }
  .dg-sub-row { padding-left: 1.1rem; font-style: italic; color: var(--text-muted); }
  input { width: 7ch; font-size: 0.78rem; padding: 0.05rem 0.2rem; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 3px; }
</style>
