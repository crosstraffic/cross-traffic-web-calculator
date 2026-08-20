<script>
  // Everything one urban feature carries, in one panel, opened in place under
  // its row in the features list.
  //
  // This is a sibling of FeatureEditor rather than two more branches inside it.
  // The two share no field at all beyond a label and a station, and the freeway
  // editor is what the phase 1 suites pin, so growing it would put the whole
  // freeway path at risk for no reuse.
  //
  // The grouping follows the chapters rather than the struct: what the segment
  // ending here is, how its boundary signal is timed, and then the Chapter 17
  // inputs, which are the ones that reach only the reliability run. A reader who
  // never opens the reliability panel should be able to tell that the last group
  // does nothing for them, which is what the group's own note says.
  //
  // Every commit goes through the page's `commit`, so one blur or Enter is one
  // undo step, exactly like a drag's `end` phase. Nothing here holds state of
  // its own: it renders the document and calls back.

  import { FT_PER_MI } from '$lib/builder/document.js';
  import { urbanSourceEndingAt } from '$lib/builder/derive.js';

  /**
   * What the Exhibit 18-13 parameters are worth, as one worked case.
   *
   * Both speeds are what THIS engine computes, not what Chapter 30 publishes:
   * Exhibit 30-36 prints 23.67 mi/h, which the example problem reaches through
   * its per-point delays rather than through the planning estimate at all. The
   * pair below is the estimate at its default against the estimate given the
   * segment's own parameters, and it is here so the panel can say what the
   * fields are for in the units of the answer. Both are pinned, at segment level
   * by tests/boundary/ch18_urban_segments.mjs and through this editor by the
   * builder spec in tests/app.spec.ts.
   */
  const planningDemo = { from: '22.55', to: '23.60', published: '23.67', nap: '2', left: '6.5', right: '8.1' };

  let {
    feature,
    doc,
    onfield = null, // (id, field, value)
    onsignalconfig = null, // (id, configField, value)
    onmeasure = null, // (id, measureField, value)
    onapproach = null, // (id, approachField, value)
    interactive = true,
  } = $props();

  let measuresMode = $derived(doc?.analysisMode === 'measures');

  // No segment ends at the upstream-most signal, so nothing reads its timing:
  // Chapter 18 charges a segment's control delay, cycle and green to the
  // intersection at its DOWNSTREAM end. Only its width crosses, as the first
  // segment's upstream intersection width. A user retyping a cycle length here
  // and seeing the facility not move deserves to be told why.
  let upstreamMost = $derived(
    feature?.kind === 'signal' &&
      (doc?.features ?? [])
        .filter((f) => f.kind === 'signal')
        .every((f) => f.id === feature.id || f.stationFt > feature.stationFt),
  );
  // Why the Exhibit 18-13 group would not reach the run, or null when it does.
  // Three ways it can be inert and they are different facts, so they are not
  // collapsed: the Chapter 18 engine is not running at all, or it is running but
  // Equation 18-7 prefers a source the access points already supply. The
  // upstream-most case is left out because the note above it already covers
  // every group on that signal at once.
  let planningInert = $derived.by(() => {
    if (feature?.kind !== 'signal' || upstreamMost) return null;
    if (measuresMode) return 'measures';
    const source = urbanSourceEndingAt(doc, feature.id);
    return source === 'published' || source === 'computed' ? source : null;
  });
  let cfg = $derived(feature?.config ?? {});
  let meas = $derived(feature?.measures ?? {});
  let ap = $derived(feature?.approach ?? null);

  const KIND_LABEL = { signal: 'Boundary signal', access_point: 'Access point' };

  function setMiles(field, raw) {
    const mi = Number(raw);
    if (!Number.isFinite(mi)) return;
    onfield?.(feature.id, field, Math.round(mi * FT_PER_MI));
  }

  /** A blank field means "the engine's own default", which is a different thing
   * from zero and has to stay expressible. Committing 0 for a cleared platoon
   * ratio would pin the arrival type to the worst case rather than leave it to
   * the uniform-arrivals fallback. */
  function setOptional(commit, field, raw) {
    if (raw === '' || raw == null) {
      commit(field, null);
      return;
    }
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    commit(field, v);
  }

  const cfgSet = (field, v) => onsignalconfig?.(feature.id, field, v);
  const measSet = (field, v) => onmeasure?.(feature.id, field, v);
  const apSet = (field, v) => onapproach?.(feature.id, field, v);
</script>

<div class="fe" data-testid="urban-feature-editor" data-feature-id={feature.id} data-kind={feature.kind}>
  <div class="fe-head">
    <h4>{KIND_LABEL[feature.kind]} {feature.label || feature.id}</h4>
    <span class="fe-id">{feature.id}</span>
  </div>

  {#if feature.inferred}
    <p class="fe-inferred" data-testid="inferred-note-{feature.id}">
      This signal was recovered from an imported fixture. No segment ends at it, so the fixture never recorded its
      timing and the values below are defaults rather than measurements. Only its width reaches the analysis, as the
      first segment's upstream intersection width.
    </p>
  {/if}

  <div class="fe-grid">
    <label
      >Label
      <input
        type="text"
        value={feature.label}
        disabled={!interactive}
        data-testid="label-{feature.id}"
        onchange={(e) => onfield?.(feature.id, 'label', e.currentTarget.value)}
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
        onchange={(e) => setMiles('stationFt', e.currentTarget.value)}
      />
    </label>

    {#if feature.kind === 'access_point'}
      <label
        >Side
        <select
          value={feature.side}
          disabled={!interactive}
          data-testid="side-{feature.id}"
          onchange={(e) => onfield?.(feature.id, 'side', e.currentTarget.value)}
        >
          <option value="subject">Subject</option>
          <option value="opposing">Opposing</option>
        </select>
      </label>
    {/if}
  </div>

  {#if upstreamMost}
    <p class="fe-inert" data-testid="upstream-most-note-{feature.id}">
      This is the upstream-most signal, so no segment ends at it. Chapter 18 charges a segment's through control delay,
      cycle length and effective green to the intersection at its downstream end, which means nothing below reaches the
      analysis except the intersection width, and that crosses as the first segment's upstream intersection width.
    </p>
  {/if}

  {#if feature.kind === 'signal'}
    <fieldset class="fe-group">
      <legend>The segment ending here</legend>
      <p class="fe-note">
        Chapter 18 bounds a segment by an intersection at each end and puts its through control delay, cycle length and
        effective green at the downstream end, so these describe the segment that runs into this signal rather than the
        one leaving it.
      </p>
      <div class="fe-grid">
        <label
          >Control
          <select
            value={cfg.control}
            disabled={!interactive}
            data-testid="control-{feature.id}"
            onchange={(e) => cfgSet('control', e.currentTarget.value)}
          >
            <option>Signalized</option>
            <option>AllWayStop</option>
            <option>YieldControlled</option>
            <option>Roundabout</option>
            <option>Uncontrolled</option>
          </select>
        </label>
        <label
          >Speed limit (mi/h)
          <input
            type="number"
            min="20"
            max="60"
            step="1"
            value={cfg.speed_limit_mph ?? ''}
            placeholder={String(doc?.mainline?.speedLimitMph ?? '')}
            disabled={!interactive}
            data-testid="speed-limit-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'speed_limit_mph', e.currentTarget.value)}
          />
        </label>
        <label
          >Through demand (veh/h)
          <input
            type="number"
            min="0"
            step="1"
            value={cfg.through_demand_veh_h ?? ''}
            disabled={!interactive}
            data-testid="demand-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'through_demand_veh_h', e.currentTarget.value)}
          />
        </label>
        <label
          >Midsegment flow (veh/h)
          <input
            type="number"
            min="0"
            step="1"
            value={cfg.midsegment_flow_veh_h ?? ''}
            disabled={!interactive}
            data-testid="midsegment-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'midsegment_flow_veh_h', e.currentTarget.value)}
          />
        </label>
        <label
          >Through capacity (veh/h)
          <input
            type="number"
            min="0"
            step="1"
            value={cfg.through_capacity_veh_h ?? ''}
            disabled={!interactive}
            data-testid="capacity-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'through_capacity_veh_h', e.currentTarget.value)}
          />
        </label>
        <label
          >Intersection width (ft)
          <input
            type="number"
            min="0"
            step="1"
            value={cfg.width_ft ?? ''}
            disabled={!interactive}
            data-testid="width-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'width_ft', e.currentTarget.value)}
          />
        </label>
      </div>
      <p class="fe-note">
        The width is this intersection's own, and Chapter 18 charges it to the segment on the far side of it, as that
        segment's upstream intersection width.
      </p>
    </fieldset>

    <fieldset class="fe-group">
      <legend>Signal timing</legend>
      <div class="fe-grid">
        <label
          >Cycle length (s)
          <input
            type="number"
            min="0"
            step="1"
            value={cfg.cycle_length_s ?? ''}
            disabled={!interactive}
            data-testid="cycle-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'cycle_length_s', e.currentTarget.value)}
          />
        </label>
        <label
          >Effective green (s)
          <input
            type="number"
            min="0"
            step="0.01"
            value={cfg.effective_green_s ?? ''}
            disabled={!interactive}
            data-testid="green-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'effective_green_s', e.currentTarget.value)}
          />
        </label>
        <label
          >Through control delay (s/veh)
          <input
            type="number"
            min="0"
            step="0.01"
            value={cfg.through_control_delay_s ?? ''}
            disabled={!interactive}
            data-testid="delay-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'through_control_delay_s', e.currentTarget.value)}
          />
        </label>
        <label
          >Platoon ratio
          <input
            type="number"
            min="0"
            step="0.001"
            value={cfg.platoon_ratio ?? ''}
            placeholder="uniform"
            disabled={!interactive}
            data-testid="platoon-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'platoon_ratio', e.currentTarget.value)}
          />
        </label>
        <label
          >Saturation flow (veh/h/ln)
          <input
            type="number"
            min="0"
            step="1"
            value={cfg.sat_flow_veh_h_ln ?? ''}
            placeholder="default"
            disabled={!interactive}
            data-testid="satflow-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'sat_flow_veh_h_ln', e.currentTarget.value)}
          />
        </label>
        <label
          >Full stop rate (stops/veh)
          <input
            type="number"
            min="0"
            step="0.001"
            value={cfg.full_stop_rate_override ?? ''}
            placeholder="computed"
            disabled={!interactive}
            data-testid="stoprate-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'full_stop_rate_override', e.currentTarget.value)}
          />
        </label>
      </div>
      <p class="fe-note">
        A blank platoon ratio means uniform arrivals, where the proportion arriving on green is the green-to-cycle ratio
        itself. Entering 0 is a different thing and would pin the worst arrival type, so a cleared field stays blank
        rather than becoming a zero.
      </p>
    </fieldset>

    <fieldset class="fe-group">
      <legend>Access-point planning estimate (Exhibit 18-13)</legend>
      <p class="fe-note">
        Read only when no access point on this segment carries a per-point delay or an approach, because those are the
        two sources Equation 18-7 prefers. Left blank the library counts every driveway, N_ap = N_ap,s + p_ap,lt N_ap,o,
        and takes Exhibit 18-13's own 10% turn assumption, which is the coarsest the estimate gets. The count is what
        moves the answer. On Chapter 30 Example Problem 1 the estimate reads <span data-testid="planning-demo-from"
          >{planningDemo.from}</span
        >
        mi/h left blank and <span data-testid="planning-demo-to">{planningDemo.to}</span> given that segment's {planningDemo.nap}
        influential approaches and its own {planningDemo.left}% and {planningDemo.right}% turn percentages. Neither is a
        published number; Exhibit 30-36 prints {planningDemo.published} mi/h, and the example problem reaches it through
        per-point delays rather than through this estimate.
      </p>
      <div class="fe-grid">
        <label
          >Influential approaches N_ap
          <input
            type="number"
            min="0"
            step="0.01"
            value={cfg.n_influential_access_points ?? ''}
            placeholder="from the counts"
            disabled={!interactive}
            data-testid="nap-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'n_influential_access_points', e.currentTarget.value)}
          />
        </label>
        <label
          >Left turns at a point (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={cfg.pct_left_turns_access ?? ''}
            placeholder="10"
            disabled={!interactive}
            data-testid="pctlt-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'pct_left_turns_access', e.currentTarget.value)}
          />
        </label>
        <label
          >Right turns at a point (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={cfg.pct_right_turns_access ?? ''}
            placeholder="10"
            disabled={!interactive}
            data-testid="pctrt-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'pct_right_turns_access', e.currentTarget.value)}
          />
        </label>
        <label class="fe-check"
          >Left-turn bay adequate
          <input
            type="checkbox"
            checked={cfg.access_left_bay_adequate === true}
            disabled={!interactive}
            data-testid="ltbayadq-{feature.id}"
            onchange={(e) => cfgSet('access_left_bay_adequate', e.currentTarget.checked || null)}
          />
        </label>
        <label class="fe-check"
          >Right-turn bay adequate
          <input
            type="checkbox"
            checked={cfg.access_right_bay_adequate === true}
            disabled={!interactive}
            data-testid="rtbayadq-{feature.id}"
            onchange={(e) => cfgSet('access_right_bay_adequate', e.currentTarget.checked || null)}
          />
        </label>
      </div>
      <p class="fe-note">
        A bay of adequate length halves the per-point delay and two of them take it to zero, so these two are the
        strongest controls on this panel and the easiest to assert without evidence. They describe the representative
        access point rather than any one driveway; the per-approach bay flags on an access point are a different input,
        on the computed Chapter 30 Section 4 path.
      </p>
      {#if planningInert}
        <p class="fe-inert" data-testid="planning-inert-{feature.id}" data-inert-reason={planningInert}>
          {#if planningInert === 'measures'}
            This facility is described by its published Chapter 18 measures, so the Chapter 18 engine does not run and
            no access-point delay is computed at all. Nothing in this group reaches the answer while that mode is
            selected.
          {:else}
            This segment's access points supply {planningInert === 'published' ? 'per-point delays' : 'approaches'}, so
            Equation 18-7 takes that source and nothing in this group reaches the run. The values are kept and exported
            rather than dropped, so clearing that source gives them back.
          {/if}
        </p>
      {/if}
    </fieldset>

    {#if measuresMode}
      <fieldset class="fe-group">
        <legend>Published Chapter 18 measures</legend>
        <p class="fe-note">
          This facility is in published-measures mode, so these are what the Chapter 16 aggregation runs over and the
          inputs above are not recomputed. That is the Exhibit 16-7 "HCM method output" path, and it is what the
          published example problems take.
        </p>
        <div class="fe-grid">
          <label
            >Base FFS (mi/h)
            <input
              type="number"
              min="0"
              step="0.1"
              value={meas.base_ffs_mph ?? ''}
              disabled={!interactive}
              data-testid="m-baseffs-{feature.id}"
              onchange={(e) => setOptional(measSet, 'base_ffs_mph', e.currentTarget.value)}
            />
          </label>
          <label
            >Travel speed (mi/h)
            <input
              type="number"
              min="0"
              step="0.1"
              value={meas.travel_speed_mph ?? ''}
              disabled={!interactive}
              data-testid="m-speed-{feature.id}"
              onchange={(e) => setOptional(measSet, 'travel_speed_mph', e.currentTarget.value)}
            />
          </label>
          <label
            >Stop rate (stops/mi)
            <input
              type="number"
              min="0"
              step="0.01"
              value={meas.spatial_stop_rate_stops_mi ?? ''}
              disabled={!interactive}
              data-testid="m-stoprate-{feature.id}"
              onchange={(e) => setOptional(measSet, 'spatial_stop_rate_stops_mi', e.currentTarget.value)}
            />
          </label>
          <label
            >Through v/c
            <input
              type="number"
              min="0"
              step="0.01"
              value={meas.vc_ratio ?? ''}
              disabled={!interactive}
              data-testid="m-vc-{feature.id}"
              onchange={(e) => setOptional(measSet, 'vc_ratio', e.currentTarget.value)}
            />
          </label>
          <label
            >LOS
            <select
              value={meas.los ?? ''}
              disabled={!interactive}
              data-testid="m-los-{feature.id}"
              onchange={(e) => measSet('los', e.currentTarget.value || null)}
            >
              <option value="">–</option>
              <option>A</option><option>B</option><option>C</option>
              <option>D</option><option>E</option><option>F</option>
            </select>
          </label>
        </div>
      </fieldset>
    {/if}

    <fieldset class="fe-group">
      <legend>Chapter 17 reliability</legend>
      <p class="fe-note">
        These reach the reliability handoff only. The Chapter 16 run above does not read any of them, so changing one
        here will not move the facility LOS.
      </p>
      <div class="fe-grid">
        <label
          >Segment crashes (per year)
          <input
            type="number"
            min="0"
            step="1"
            value={cfg.segment_crashes ?? ''}
            disabled={!interactive}
            data-testid="segcrash-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'segment_crashes', e.currentTarget.value)}
          />
        </label>
        <label
          >Intersection crashes (per year)
          <input
            type="number"
            min="0"
            step="1"
            value={cfg.intersection_crashes ?? ''}
            disabled={!interactive}
            data-testid="intcrash-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'intersection_crashes', e.currentTarget.value)}
          />
        </label>
        <label
          >k factor
          <input
            type="number"
            min="0"
            step="0.01"
            value={cfg.k_factor ?? ''}
            disabled={!interactive}
            data-testid="kfactor-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'k_factor', e.currentTarget.value)}
          />
        </label>
        <label
          >I factor
          <input
            type="number"
            min="0"
            step="0.01"
            value={cfg.i_factor ?? ''}
            disabled={!interactive}
            data-testid="ifactor-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'i_factor', e.currentTarget.value)}
          />
        </label>
        <label
          >Approach lanes
          <input
            type="number"
            min="1"
            step="1"
            value={cfg.approach_lanes ?? ''}
            disabled={!interactive}
            data-testid="approachlanes-{feature.id}"
            onchange={(e) => setOptional(cfgSet, 'approach_lanes', e.currentTarget.value)}
          />
        </label>
      </div>
    </fieldset>
  {/if}

  {#if feature.kind === 'access_point'}
    <fieldset class="fe-group">
      <legend>Access-point delay (Equation 18-7)</legend>
      <p class="fe-note">
        Equation 18-7 takes its access-point delay term from one of three sources, and the library picks among them in
        this order. Supplying a per-point delay wins over an approach; supplying neither leaves the segment on the
        Exhibit 18-13 planning estimate. An opposing-side point is counted for the Exhibit 18-11 note c adjustment but
        contributes no delay either way.
      </p>
      <div class="fe-grid">
        <label
          >Per-point delay (s/veh)
          <input
            type="number"
            min="0"
            step="0.001"
            value={feature.delayS ?? ''}
            placeholder="none"
            disabled={!interactive || feature.side === 'opposing'}
            data-testid="apdelay-{feature.id}"
            onchange={(e) => setOptional((f, v) => onfield?.(feature.id, f, v), 'delayS', e.currentTarget.value)}
          />
        </label>
        <label class="fe-check"
          >Compute from an approach
          <input
            type="checkbox"
            checked={!!ap}
            disabled={!interactive || feature.side === 'opposing'}
            data-testid="apapproach-{feature.id}"
            onchange={(e) => onfield?.(feature.id, 'approach', e.currentTarget.checked ? 'enable' : null)}
          />
        </label>
      </div>

      {#if ap}
        <div class="fe-grid">
          <label
            >Left-turn volume (veh/h)
            <input
              type="number"
              min="0"
              step="0.01"
              value={ap.v_lt}
              disabled={!interactive}
              data-testid="ap-vlt-{feature.id}"
              onchange={(e) => setOptional(apSet, 'v_lt', e.currentTarget.value)}
            />
          </label>
          <label
            >Through volume (veh/h)
            <input
              type="number"
              min="0"
              step="0.01"
              value={ap.v_th}
              disabled={!interactive}
              data-testid="ap-vth-{feature.id}"
              onchange={(e) => setOptional(apSet, 'v_th', e.currentTarget.value)}
            />
          </label>
          <label
            >Right-turn volume (veh/h)
            <input
              type="number"
              min="0"
              step="0.01"
              value={ap.v_rt}
              disabled={!interactive}
              data-testid="ap-vrt-{feature.id}"
              onchange={(e) => setOptional(apSet, 'v_rt', e.currentTarget.value)}
            />
          </label>
          <label
            >Opposing flow (veh/h)
            <input
              type="number"
              min="0"
              step="0.01"
              value={ap.opposing_flow_veh_h}
              disabled={!interactive}
              data-testid="ap-opp-{feature.id}"
              onchange={(e) => setOptional(apSet, 'opposing_flow_veh_h', e.currentTarget.value)}
            />
          </label>
          <label
            >Through lanes
            <input
              type="number"
              min="1"
              step="1"
              value={ap.n_t}
              disabled={!interactive}
              data-testid="ap-nt-{feature.id}"
              onchange={(e) => setOptional(apSet, 'n_t', e.currentTarget.value)}
            />
          </label>
          <label
            >Left-turn lanes
            <input
              type="number"
              min="0"
              step="1"
              value={ap.n_lt_lanes}
              disabled={!interactive}
              data-testid="ap-nlt-{feature.id}"
              onchange={(e) => setOptional(apSet, 'n_lt_lanes', e.currentTarget.value)}
            />
          </label>
          <label
            >Heavy vehicles (decimal)
            <input
              type="number"
              min="0"
              max="1"
              step="0.001"
              value={ap.pct_heavy_veh}
              disabled={!interactive}
              data-testid="ap-hv-{feature.id}"
              onchange={(e) => setOptional(apSet, 'pct_heavy_veh', e.currentTarget.value)}
            />
          </label>
          <label class="fe-check"
            >Left-turn bay
            <input
              type="checkbox"
              checked={!!ap.left_turn_bay}
              disabled={!interactive}
              data-testid="ap-ltbay-{feature.id}"
              onchange={(e) => apSet('left_turn_bay', e.currentTarget.checked)}
            />
          </label>
          <label class="fe-check"
            >Right-turn bay
            <input
              type="checkbox"
              checked={!!ap.right_turn_bay}
              disabled={!interactive}
              data-testid="ap-rtbay-{feature.id}"
              onchange={(e) => apSet('right_turn_bay', e.currentTarget.checked)}
            />
          </label>
        </div>
      {/if}
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
  .fe-grid label.fe-check {
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
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
    margin: 0 0 0.5rem;
    max-width: 86ch;
    line-height: 1.45;
  }
  .fe-inferred {
    font-size: 0.72rem;
    color: var(--warn-text);
    background: var(--warn-bg);
    border: 1px solid var(--warn-border);
    border-radius: 4px;
    padding: 0.3rem 0.45rem;
    margin: 0 0 0.5rem;
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
