<script>
  // Everything one two-lane feature carries, in one panel, opened in place under
  // its row in the features list.
  //
  // A sibling of FeatureEditor and UrbanFeatureEditor rather than more branches
  // inside either, for the reason the urban one gives: the three share nothing
  // but a label and a station, and growing an editor the earlier phases' suites
  // pin puts those phases at risk for no reuse.
  //
  // Three of the four kinds are intervals and one is a point, and the panel
  // says which because the difference is what a reader needs: a grade or a
  // passing feature bounds segments at both of its ends, a curve bounds nothing
  // and becomes a subsegment, and a demand change bounds one segment at its
  // single station.
  //
  // UNITS ARE STATED ON EVERY FIELD AND THEY ARE NOT ALL THE SAME. A station and
  // a curve extent are shown in the unit they are used in: stations in miles,
  // because that is how a highway is chained, and a curve's length in FEET,
  // because a subsegment length is feet and showing it in miles would hide the
  // one Chapter 15 unit trap that has cost this project a published number.

  import { FT_PER_MI } from '$lib/builder/document.js';

  let {
    feature,
    doc,
    onfield = null, // (id, field, value)
    onmove = null, // (id, stationFt, phase) — the same callback the strip drags through
    ondemandconfig = null, // (id, configField, value)
    interactive = true,
  } = $props();

  let cfg = $derived(feature?.config ?? {});
  let lengthFt = $derived(feature?.endFt != null ? feature.endFt - feature.stationFt : null);

  const KIND_LABEL = {
    grade: 'Grade',
    passing: 'Passing feature',
    curve: 'Horizontal curve',
    demand: 'Demand change',
  };

  /** Typing a station goes through the SAME callback the strip drags through,
   * which is what makes the numeric field the fine adjustment the strip's note
   * promises rather than a second way of moving something. It also settles two
   * things that would otherwise differ between the two gestures: an interval
   * moves whole rather than stretching, and the whole move is one undo step
   * rather than one per field written. */
  function setStationMiles(raw) {
    const mi = Number(raw);
    if (!Number.isFinite(mi)) return;
    onmove?.(feature.id, Math.round(mi * FT_PER_MI), 'end');
  }

  /** An interval's length is edited rather than its far end, because an analyst
   * knows a curve is 432 ft long and does not know it ends at 712. Moving the
   * end keeps the start, which is what dragging the marker already does. */
  function setLengthFt(raw) {
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) return;
    onfield?.(feature.id, 'endFt', feature.stationFt + v);
  }

  function setNumber(commit, field, raw) {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    commit(field, v);
  }

  /** A blank field means the highway's own value, which is a different thing
   * from zero. A posted limit of 0 would drive the base free-flow speed to 0. */
  function setOptional(commit, field, raw) {
    if (raw === '' || raw == null) {
      commit(field, null);
      return;
    }
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    commit(field, v);
  }

  const featSet = (field, v) => onfield?.(feature.id, field, v);
  const cfgSet = (field, v) => ondemandconfig?.(feature.id, field, v);
</script>

<div class="fe" data-testid="twolane-feature-editor" data-feature-id={feature.id} data-kind={feature.kind}>
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
        disabled={!interactive}
        data-testid="label-{feature.id}"
        onchange={(e) => featSet('label', e.currentTarget.value)}
      />
    </label>
    <label
      >Station (mi)
      <input
        type="number"
        step="0.01"
        min="0"
        value={(feature.stationFt / FT_PER_MI).toFixed(2)}
        disabled={!interactive}
        data-testid="station-{feature.id}"
        onchange={(e) => setStationMiles(e.currentTarget.value)}
      />
    </label>
    {#if feature.endFt != null}
      <label
        >{feature.kind === 'curve' ? 'Length (ft)' : 'Length (mi)'}
        <input
          type="number"
          min="0"
          step={feature.kind === 'curve' ? 1 : 0.05}
          value={feature.kind === 'curve' ? lengthFt : (lengthFt / FT_PER_MI).toFixed(2)}
          disabled={!interactive}
          data-testid="length-{feature.id}"
          onchange={(e) =>
            setLengthFt(feature.kind === 'curve' ? e.currentTarget.value : Number(e.currentTarget.value) * FT_PER_MI)}
        />
      </label>
    {/if}
  </div>

  {#if feature.kind === 'grade'}
    <fieldset class="fe-group">
      <legend>Grade and vertical class</legend>
      <p class="fe-note">
        Chapter 15 Section 2 asks grade to be homogeneous within a segment, so this feature's two ends are segment
        boundaries. A downgrade is entered negative and Exhibit 15-11 reads it down its parenthesized column.
      </p>
      <div class="fe-grid">
        <label
          >Grade (%)
          <input
            type="number"
            step="0.1"
            min="-15"
            max="15"
            value={feature.gradePct}
            disabled={!interactive}
            data-testid="grade-{feature.id}"
            onchange={(e) => setNumber(featSet, 'gradePct', e.currentTarget.value)}
          />
        </label>
        <label
          >Vertical class
          <select
            value={String(feature.verticalClass)}
            disabled={!interactive}
            data-testid="vclass-{feature.id}"
            onchange={(e) => featSet('verticalClass', Number(e.currentTarget.value))}
          >
            <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
          </select>
        </label>
      </div>
      <p class="fe-note">
        Step 3 recomputes the vertical class from the grade and the segment length and overwrites what it is given, so
        this looks like a display field and is not one. Step 2 runs first and picks a passing lane's capacity off the
        entered value, so it is a real input on any facility with a passing lane. The result panel names any segment the
        two disagreed on.
      </p>
    </fieldset>
  {/if}

  {#if feature.kind === 'passing'}
    <fieldset class="fe-group">
      <legend>Passing type</legend>
      <p class="fe-note">
        A stretch no passing feature covers is Passing Constrained, which is why there is no third option here. A
        Passing Zone permits passing in the opposing lane, so its opposing demand reaches the speed and percent-follower
        models; a Passing Lane adds a lane, and the engine takes its opposing flow as zero and reports its midpoint
        follower density instead of its endpoint one.
      </p>
      <div class="fe-grid">
        <label
          >Type
          <select
            value={String(feature.passingType)}
            disabled={!interactive}
            data-testid="passing-type-{feature.id}"
            onchange={(e) => featSet('passingType', Number(e.currentTarget.value))}
          >
            <option value="1">Passing Zone</option>
            <option value="2">Passing Lane</option>
          </select>
        </label>
      </div>
      {#if feature.passingType === 2 && lengthFt != null && lengthFt < 0.5 * FT_PER_MI - 0.5}
        <p class="fe-inert" data-testid="pl-too-short-{feature.id}">
          This passing lane is {(lengthFt / FT_PER_MI).toFixed(2)} mi, under the 0.5 mi Exhibit 15-10 minimum, so it is analyzed
          as Passing Constrained. Step 1 says a passing lane shorter than the minimum should be ignored and treated as Passing
          Constrained instead, and the chapter separately calls an added lane of a few hundred feet a turnout, which the
          method does not address.
        </p>
      {/if}
    </fieldset>
  {/if}

  {#if feature.kind === 'curve'}
    <fieldset class="fe-group">
      <legend>Curve geometry (Exhibit 15-22)</legend>
      <p class="fe-note">
        A curve is the one two-lane feature that does not start a segment. Step 1 sends varying curvature to the Step 5d
        subsegment adjustment inside one segment, and adds that the segment length minima do not apply to subsegments.
        Its length above is in FEET, unlike every other length on this page, because a subsegment length is feet where a
        segment length is miles.
      </p>
      <div class="fe-grid">
        <label
          >Design radius (ft)
          <input
            type="number"
            min="0"
            step="5"
            value={feature.designRadiusFt}
            disabled={!interactive}
            data-testid="radius-{feature.id}"
            onchange={(e) => setNumber(featSet, 'designRadiusFt', e.currentTarget.value)}
          />
        </label>
        <label
          >Superelevation (%)
          <input
            type="number"
            min="0"
            max="12"
            step="0.5"
            value={feature.superelevationPct}
            disabled={!interactive}
            data-testid="superelevation-{feature.id}"
            onchange={(e) => setNumber(featSet, 'superelevationPct', e.currentTarget.value)}
          />
        </label>
        <label
          >Central angle (deg)
          <input
            type="number"
            min="0"
            max="360"
            step="1"
            value={feature.centralAngleDeg ?? 0}
            disabled={!interactive}
            data-testid="central-angle-{feature.id}"
            onchange={(e) => setNumber(featSet, 'centralAngleDeg', e.currentTarget.value)}
          />
        </label>
      </div>
      <p class="fe-note">
        Superelevation is a PERCENT, per Exhibit 15-22's own column headings, so 4% is 4 and not 0.04. The horizontal
        class is not entered: Step 5d works it out from the radius and the superelevation and overwrites anything
        supplied. The central angle is carried for the drawing and for fixture fidelity and is not read by the method at
        all, which the library's own field comment says.
      </p>
    </fieldset>
  {/if}

  {#if feature.kind === 'demand'}
    <fieldset class="fe-group">
      <legend>Conditions from here downstream</legend>
      <p class="fe-note">
        Traffic demand and posted speed limit are both among the properties Chapter 15 Section 2 asks to be homogeneous
        within a segment, so a change in either starts one. These values hold from this station until the next demand
        change.
      </p>
      <div class="fe-grid">
        <label
          >Demand (veh/h)
          <input
            type="number"
            min="0"
            step="5"
            value={cfg.volume}
            disabled={!interactive}
            data-testid="volume-{feature.id}"
            onchange={(e) => setNumber(cfgSet, 'volume', e.currentTarget.value)}
          />
        </label>
        <label
          >Opposing demand (veh/h)
          <input
            type="number"
            min="0"
            step="5"
            value={cfg.opposingVolume}
            disabled={!interactive}
            data-testid="opposing-{feature.id}"
            onchange={(e) => setNumber(cfgSet, 'opposingVolume', e.currentTarget.value)}
          />
        </label>
        <label
          >Peak hour factor
          <input
            type="number"
            min="0.1"
            max="1"
            step="0.005"
            value={cfg.phf}
            disabled={!interactive}
            data-testid="phf-{feature.id}"
            onchange={(e) => setNumber(cfgSet, 'phf', e.currentTarget.value)}
          />
        </label>
        <label
          >Heavy vehicles (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={cfg.heavyVehiclePct}
            disabled={!interactive}
            data-testid="phv-{feature.id}"
            onchange={(e) => setNumber(cfgSet, 'heavyVehiclePct', e.currentTarget.value)}
          />
        </label>
        <label
          >Posted limit (mi/h)
          <input
            type="number"
            min="20"
            max="70"
            step="5"
            value={cfg.speedLimitMph ?? ''}
            placeholder={String(doc?.mainline?.speedLimitMph ?? '')}
            disabled={!interactive}
            data-testid="spl-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'speedLimitMph', e.currentTarget.value)}
          />
        </label>
      </div>
      <p class="fe-note">
        Heavy vehicles is a PERCENT, so 5% is 5 and not 0.05; a fraction lands in the lowest lookup bucket and analyzes
        to a plausible wrong answer rather than failing. The opposing demand reaches the answer on a Passing Zone only:
        the engine applies a standing 1,500 veh/h on a Passing Constrained segment and zero on a Passing Lane. A blank
        posted limit inherits the highway's.
      </p>
    </fieldset>
  {/if}
</div>

<style>
  .fe {
    border-left: 2px solid var(--accent-soft);
    padding: 0.4rem 0 0.5rem 0.6rem;
  }
  .fe-head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .fe-head h4 {
    font-size: 0.84rem;
    margin: 0 0 0.3rem;
  }
  .fe-id {
    font-size: 0.68rem;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
  .fe-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.9rem;
  }
  .fe-grid label {
    font-size: 0.72rem;
    color: var(--text-secondary);
    display: inline-flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .fe-group {
    border: none;
    border-top: 1px solid var(--border);
    margin: 0.6rem 0 0;
    padding: 0.45rem 0 0;
  }
  .fe-group legend {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-muted);
    padding: 0 0.3rem 0 0;
  }
  .fe-note {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin: 0 0 0.4rem;
    max-width: 86ch;
    line-height: 1.5;
  }
  .fe-inert {
    font-size: 0.72rem;
    color: var(--text-muted);
    border-left: 2px solid var(--border-strong);
    padding: 0.2rem 0 0.2rem 0.5rem;
    margin: 0.3rem 0 0;
    max-width: 86ch;
    line-height: 1.45;
  }
  input,
  select {
    font-size: 0.76rem;
    padding: 0.08rem 0.25rem;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  input[type='number'] {
    width: 8ch;
  }
  input[type='text'] {
    width: 16ch;
  }
</style>
