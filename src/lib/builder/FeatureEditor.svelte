<script>
  // Everything one feature carries, in one panel, opened in place under its row
  // in the features list.
  //
  // The list rows can only ever hold the fields that fit across a table, which
  // left three of the document's fields with no editor at all: an on-ramp's
  // weaving geometry (`numWeavingLanes`, `lcRf`, `lcFr`) reached the engine
  // straight from the example loaders, and a work zone's `total_ramp_density`
  // reached it from the mainline default. A field that only a JSON file can
  // change is a field the analyst cannot check, so the panel carries the whole
  // shape of each kind rather than the part that fits.
  //
  // Every commit here goes through the page's `commit`, so one blur or Enter is
  // one undo step, exactly like a drag's `end` phase. Nothing in this component
  // holds state of its own: it renders the document and calls back.

  import { FT_PER_MI } from '$lib/builder/document.js';

  let {
    feature,
    doc,
    onfield = null, // (id, field, value)
    onworkzone = null, // (id, configField, value)
    ondemand = null, // (target, id, periodIndex, value)
    interactive = true,
  } = $props();

  let periods = $derived(doc?.periods ?? 0);

  const KIND_LABEL = {
    on_ramp: 'On-ramp',
    off_ramp: 'Off-ramp',
    lane_change: 'Lane change',
    work_zone: 'Work zone',
  };

  /** Station fields are shown in miles and stored in feet, the same conversion
   * the list rows and the strip use. A field that does not parse is dropped
   * rather than committed as NaN, which would derive an empty facility. */
  function setMiles(field, raw) {
    const mi = Number(raw);
    if (!Number.isFinite(mi)) return;
    onfield?.(feature.id, field, Math.round(mi * FT_PER_MI));
  }

  function setNumber(field, raw) {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    onfield?.(feature.id, field, v);
  }

  function setWzNumber(field, raw) {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    onworkzone?.(feature.id, field, v);
  }

  function setDemand(target, p, raw) {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    ondemand?.(target, feature.id, p, v);
  }
</script>

<div class="fe" data-testid="feature-editor" data-feature-id={feature.id} data-kind={feature.kind}>
  <div class="fe-head">
    <h4>{KIND_LABEL[feature.kind]} {feature.label || feature.id}</h4>
    <span class="fe-id">{feature.id}</span>
  </div>

  <div class="fe-grid">
    <label
      >Label
      <input
        type="text"
        value={feature.label}
        placeholder={feature.id}
        disabled={!interactive}
        data-testid="label-{feature.id}"
        onchange={(e) => onfield?.(feature.id, 'label', e.currentTarget.value)}
        aria-label="label for {feature.id}"
      />
    </label>

    {#if feature.kind === 'work_zone'}
      <label
        >Begins (mi)
        <input
          type="number"
          min="0"
          step="0.01"
          value={(feature.stationFt / FT_PER_MI).toFixed(2)}
          disabled={!interactive}
          data-testid="station-{feature.id}"
          onchange={(e) => setMiles('stationFt', e.currentTarget.value)}
          aria-label="upstream end of {feature.id} in miles"
        />
      </label>
      <label
        >Ends (mi)
        <input
          type="number"
          min="0"
          step="0.01"
          value={(feature.endFt / FT_PER_MI).toFixed(2)}
          disabled={!interactive}
          data-testid="end-{feature.id}"
          onchange={(e) => setMiles('endFt', e.currentTarget.value)}
          aria-label="downstream end of {feature.id} in miles"
        />
      </label>
    {:else}
      <label
        >Station (mi)
        <input
          type="number"
          min="0"
          step="0.01"
          value={(feature.stationFt / FT_PER_MI).toFixed(2)}
          disabled={!interactive}
          data-testid="station-{feature.id}"
          onchange={(e) => setMiles('stationFt', e.currentTarget.value)}
          aria-label="station of {feature.id} in miles"
        />
      </label>
    {/if}

    {#if feature.kind === 'on_ramp' || feature.kind === 'off_ramp'}
      <label
        >Ramp FFS (mi/h)
        <input
          type="number"
          min="15"
          max="70"
          step="1"
          value={feature.rampFfs}
          disabled={!interactive}
          data-testid="ramp-ffs-{feature.id}"
          onchange={(e) => setNumber('rampFfs', e.currentTarget.value)}
          aria-label="ramp free-flow speed for {feature.id}"
        />
      </label>
      {#if feature.kind === 'on_ramp'}
        <label
          >Acceleration lane (ft)
          <input
            type="number"
            min="0"
            step="10"
            value={feature.accelLaneFt}
            disabled={!interactive}
            data-testid="accel-{feature.id}"
            onchange={(e) => setNumber('accelLaneFt', e.currentTarget.value)}
            aria-label="acceleration lane length for {feature.id}"
          />
        </label>
      {:else}
        <label
          >Deceleration lane (ft)
          <input
            type="number"
            min="0"
            step="10"
            value={feature.decelLaneFt}
            disabled={!interactive}
            data-testid="decel-{feature.id}"
            onchange={(e) => setNumber('decelLaneFt', e.currentTarget.value)}
            aria-label="deceleration lane length for {feature.id}"
          />
        </label>
      {/if}
    {/if}

    {#if feature.kind === 'lane_change'}
      <label
        >Lanes downstream
        <input
          type="number"
          min="2"
          max="8"
          step="1"
          value={feature.lanes}
          disabled={!interactive}
          data-testid="lanes-{feature.id}"
          onchange={(e) => setNumber('lanes', e.currentTarget.value)}
          aria-label="lane count downstream of {feature.id}"
        />
      </label>
    {/if}
  </div>

  {#if feature.kind === 'on_ramp'}
    <div class="fe-sub">
      <label class="fe-check">
        <input
          type="checkbox"
          checked={feature.auxLaneToNext}
          disabled={!interactive}
          data-testid="aux-{feature.id}"
          onchange={(e) => onfield?.(feature.id, 'auxLaneToNext', e.currentTarget.checked)}
          aria-label="auxiliary lane from {feature.id} to the next off-ramp"
        />
        Auxiliary lane to the next off-ramp
      </label>
      <p class="fe-note">
        An auxiliary lane running from this gore to the next off-ramp's makes the whole section one weaving segment
        (Exhibit 10-12), one lane wider than the mainline. The three fields below are read only while it does.
      </p>
      <div class="fe-grid" class:fe-off={!feature.auxLaneToNext}>
        <label
          >Weaving lanes
          <input
            type="number"
            min="2"
            max="4"
            step="1"
            value={feature.numWeavingLanes}
            disabled={!interactive}
            data-testid="weaving-lanes-{feature.id}"
            onchange={(e) => setNumber('numWeavingLanes', e.currentTarget.value)}
            aria-label="number of weaving lanes at {feature.id}"
          />
        </label>
        <label
          >Min lane changes, ramp to freeway
          <input
            type="number"
            min="0"
            max="3"
            step="1"
            value={feature.lcRf}
            disabled={!interactive}
            data-testid="lc-rf-{feature.id}"
            onchange={(e) => setNumber('lcRf', e.currentTarget.value)}
            aria-label="minimum lane changes from the ramp to the freeway at {feature.id}"
          />
        </label>
        <label
          >Min lane changes, freeway to ramp
          <input
            type="number"
            min="0"
            max="3"
            step="1"
            value={feature.lcFr}
            disabled={!interactive}
            data-testid="lc-fr-{feature.id}"
            onchange={(e) => setNumber('lcFr', e.currentTarget.value)}
            aria-label="minimum lane changes from the freeway to the ramp at {feature.id}"
          />
        </label>
      </div>
    </div>
  {/if}

  {#if feature.kind === 'work_zone'}
    <div class="fe-sub">
      <p class="fe-note">
        The engine analyzes the lanes that stay open. The lanes the closure takes out feed the severity index instead,
        which is why both counts are coded (Chapter 10 Section 4, Equations 10-7 through 10-12).
      </p>
      <div class="fe-grid">
        <label
          >Lanes, total
          <input
            type="number"
            min="1"
            max="8"
            step="1"
            value={feature.config.total_lanes}
            disabled={!interactive}
            data-testid="total-lanes-{feature.id}"
            onchange={(e) => setWzNumber('total_lanes', e.currentTarget.value)}
            aria-label="total lanes at {feature.id}"
          />
        </label>
        <label
          >Lanes, open
          <input
            type="number"
            min="1"
            max="8"
            step="1"
            value={feature.config.open_lanes}
            disabled={!interactive}
            data-testid="open-lanes-{feature.id}"
            onchange={(e) => setWzNumber('open_lanes', e.currentTarget.value)}
            aria-label="open lanes at {feature.id}"
          />
        </label>
        <label
          >Barrier
          <select
            value={feature.config.soft_barrier ? 'soft' : 'hard'}
            disabled={!interactive}
            data-testid="barrier-{feature.id}"
            onchange={(e) => onworkzone?.(feature.id, 'soft_barrier', e.currentTarget.value === 'soft')}
            aria-label="barrier type at {feature.id}"
          >
            <option value="soft">cones/drums</option>
            <option value="hard">hard barrier</option>
          </select>
        </label>
        <label
          >Speed limit (mi/h)
          <input
            type="number"
            min="25"
            max="75"
            step="5"
            value={feature.config.speed_limit_mi_h}
            disabled={!interactive}
            data-testid="wz-speed-limit-{feature.id}"
            onchange={(e) => setWzNumber('speed_limit_mi_h', e.currentTarget.value)}
            aria-label="work zone speed limit at {feature.id}"
          />
        </label>
        <label
          >Speed ratio
          <input
            type="number"
            min="0.5"
            max="2"
            step="0.0001"
            value={feature.config.speed_ratio}
            disabled={!interactive}
            data-testid="wz-speed-ratio-{feature.id}"
            onchange={(e) => setWzNumber('speed_ratio', e.currentTarget.value)}
            aria-label="speed ratio at {feature.id}"
          />
        </label>
        <label
          >Queue discharge drop
          <input
            type="number"
            min="0"
            max="0.5"
            step="0.001"
            value={feature.config.queue_discharge_drop}
            disabled={!interactive}
            data-testid="wz-queue-drop-{feature.id}"
            onchange={(e) => setWzNumber('queue_discharge_drop', e.currentTarget.value)}
            aria-label="queue discharge drop at {feature.id}"
          />
        </label>
        <label
          >Lateral distance (ft)
          <input
            type="number"
            min="0"
            step="1"
            value={feature.config.lateral_distance_ft}
            disabled={!interactive}
            data-testid="wz-lateral-{feature.id}"
            onchange={(e) => setWzNumber('lateral_distance_ft', e.currentTarget.value)}
            aria-label="lateral distance at {feature.id}"
          />
        </label>
        <!-- The mainline carries its own ramp density and the work zone's copy
             defaults from it, but the two are separate inputs to the engine:
             a closure inside an interchange sees more ramps per mile than the
             facility average. -->
        <label
          >Ramp density here (/mi)
          <input
            type="number"
            min="0"
            step="0.1"
            value={feature.config.total_ramp_density}
            disabled={!interactive}
            data-testid="wz-ramp-density-{feature.id}"
            onchange={(e) => setWzNumber('total_ramp_density', e.currentTarget.value)}
            aria-label="total ramp density at {feature.id}"
          />
        </label>
        <label class="fe-check">
          <input
            type="checkbox"
            checked={feature.config.night}
            disabled={!interactive}
            data-testid="wz-night-{feature.id}"
            onchange={(e) => onworkzone?.(feature.id, 'night', e.currentTarget.checked)}
            aria-label="night work at {feature.id}"
          />
          Night work
        </label>
        <label class="fe-check">
          <input
            type="checkbox"
            checked={feature.config.rural}
            disabled={!interactive}
            data-testid="wz-rural-{feature.id}"
            onchange={(e) => onworkzone?.(feature.id, 'rural', e.currentTarget.checked)}
            aria-label="rural work zone at {feature.id}"
          />
          Rural
        </label>
      </div>
    </div>
  {/if}

  <!-- The demand grid below the editor is the same numbers as a matrix across
       every source, which is how a demand profile is read. This is the same
       numbers in the context of the ramp they belong to, which is how one is
       entered. Both call the page's one `editDemand`. -->
  {#if feature.kind === 'on_ramp' || feature.kind === 'off_ramp'}
    <div class="fe-sub">
      <h5>Demand by period (veh/h)</h5>
      <div class="fe-periods" data-testid="feature-demands-{feature.id}">
        {#each Array.from({ length: periods }) as _, p}
          <label
            >P{p + 1}
            <input
              type="number"
              min="0"
              step="1"
              value={feature.demand[p] ?? 0}
              disabled={!interactive}
              data-testid="demand-{feature.id}-{p}"
              onchange={(e) => setDemand('feature', p, e.currentTarget.value)}
              aria-label="{feature.id} demand, period {p + 1}"
            />
          </label>
        {/each}
      </div>
      {#if feature.kind === 'on_ramp' && feature.auxLaneToNext}
        <h5>Ramp-to-ramp demand through the weave (veh/h)</h5>
        <div class="fe-periods" data-testid="feature-r2r-{feature.id}">
          {#each Array.from({ length: periods }) as _, p}
            <label
              >P{p + 1}
              <input
                type="number"
                min="0"
                step="1"
                value={feature.rampToRampDemand[p] ?? 0}
                disabled={!interactive}
                data-testid="r2r-{feature.id}-{p}"
                onchange={(e) => setDemand('rampToRamp', p, e.currentTarget.value)}
                aria-label="{feature.id} ramp-to-ramp demand, period {p + 1}"
              />
            </label>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .fe {
    border-left: 3px solid var(--accent);
    background: var(--surface-subtle);
    border-radius: 0 4px 4px 0;
    padding: 0.55rem 0.7rem 0.7rem;
    margin: 0.1rem 0 0.3rem;
  }
  .fe-head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
  }
  .fe-head h4 {
    margin: 0;
    font-size: 0.85rem;
  }
  .fe-id {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-family: ui-monospace, monospace;
  }

  .fe-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 1rem;
  }
  .fe-grid label {
    font-size: 0.72rem;
    color: var(--text-secondary);
    display: inline-flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .fe-grid label.fe-check,
  .fe-check {
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
  }
  /* The weaving fields stay legible and editable when no auxiliary lane is set,
     because entering them before setting the lane is a normal order of work.
     Dimming says the engine is not reading them yet. */
  .fe-off {
    opacity: 0.55;
  }

  .fe-sub {
    margin-top: 0.6rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--border);
  }
  .fe-sub h5 {
    margin: 0 0 0.25rem;
    font-size: 0.74rem;
    color: var(--text-secondary);
    font-weight: 600;
  }
  .fe-sub h5 + .fe-periods {
    margin-bottom: 0.5rem;
  }
  .fe-note {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin: 0.15rem 0 0.4rem;
    line-height: 1.5;
    max-width: 82ch;
  }

  .fe-periods {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.5rem;
  }
  .fe-periods label {
    font-size: 0.68rem;
    color: var(--text-muted);
    display: inline-flex;
    flex-direction: column;
    gap: 0.08rem;
  }

  input,
  select {
    font-size: 0.78rem;
    padding: 0.08rem 0.25rem;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  input[type='number'] {
    width: 9ch;
  }
  input[type='text'] {
    width: 16ch;
  }
  input[type='checkbox'] {
    width: auto;
  }
</style>
