// The Chapter 11 handoff: the facility the builder just analyzed, handed to the
// reliability engine as its seed file.
//
// "The same facility" is a claim worth checking rather than asserting. It holds
// because `WasmFreewayReliability::new` builds its internal Chapter 10 facility
// by cloning the inner segment of every `WasmFacilitySegment` it is given,
// exactly as `WasmFreewayFacility::new` does, so anything a segment carries
// reaches the reliability run too. A work zone placed through `set_work_zone`
// is part of the segment, so it crosses; that is pinned in
// tests/builder/analysis.mjs rather than assumed, because the failure would be
// silent. A work zone that quietly vanished would produce a perfectly
// plausible, milder reliability distribution and nothing would say so.
//
// What genuinely does not cross is listed in `handoffNotes` and shown on the
// panel. The rule is that a builder facility never loses a feature silently.

import { toFixture } from './fixture.js';
import { buildSegments, facilityArgs, unboundFieldsIn } from './analyze.js';

/** Chapter 11 inputs the builder offers, at the same defaults the hcm11 page
 * opens on, so the two pages agree on what an unconfigured reliability run is. */
export function defaultReliabilityInputs() {
  return {
    replications: 4,
    seedMonth: 1,
    seedWeekday: 'monday',
    includeIncidents: true,
    crashRate: 150,
    incidentCrashRatio: 4.9,
    rngSeed: 1,
    targetSpeed: 45,
    vmtWeighted: true,
  };
}

/**
 * Run the Chapter 11 methodology on the built facility.
 *
 * @param {object} doc builder document
 * @param {object[]} rows derived rows, overrides already applied
 * @param {object} inputs see `defaultReliabilityInputs`
 * @param {object} wasm module namespace
 * @param {(fn: Function) => any} [retry] the WebKit one-shot retry the hcm11 page uses
 */
export function analyzeReliability(doc, rows, inputs, wasm, retry = (f) => f()) {
  const fx = toFixture(doc, rows);
  const a = facilityArgs(fx);

  const rel = retry(() => {
    // The segments are rebuilt inside the retry rather than hoisted out of
    // it. The constructor takes ownership of every handle, so a second pass
    // over the same array would hand the engine already-moved handles.
    const relArgs = [
      buildSegments(fx, wasm),
      a.mainline_demand,
      a.ffs,
      a.heavy_vehicle_pct,
      a.terrain,
      a.city_type,
      a.phf,
      [], // months, empty means the whole year
      Number(inputs.replications),
      Number(inputs.seedMonth),
      inputs.seedWeekday,
      inputs.includeIncidents ? Number(inputs.crashRate) : undefined,
      inputs.includeIncidents ? Number(inputs.incidentCrashRatio) : undefined,
      Number(inputs.rngSeed),
      !!inputs.vmtWeighted,
    ];
    // The four trailing facility parameters ride whenever the facility has
    // them, which for a facility built here is always: the builder writes a
    // jam density, a queue discharge drop and both densities into every
    // document. Leaving them off would let the reliability engine analyze a
    // facility with different parameters from the Chapter 10 run above it,
    // which is the one thing this panel exists not to do.
    if (
      a.jam_density_pc != null ||
      a.queue_discharge_drop != null ||
      a.total_ramp_density != null ||
      a.interchange_density != null
    ) {
      relArgs.push(a.jam_density_pc, a.queue_discharge_drop, a.total_ramp_density, a.interchange_density);
    }

    const r = new wasm.WasmFreewayReliability(...relArgs);
    r.run();
    return r;
  });

  return Object.freeze({
    numScenarios: rel.num_scenarios(),
    numObservations: rel.num_observations(),
    fftt: rel.free_flow_travel_time_min(),
    ttiMean: rel.tti_mean(),
    tti50: rel.tti_percentile(50.0),
    tti80: rel.tti_percentile(80.0),
    tti95: rel.tti_percentile(95.0),
    miseryIndex: rel.misery_index(),
    reliabilityRating: rel.reliability_rating(),
    semiStdDev: rel.semi_std_dev(),
    expectedVhd: rel.expected_vhd(),
    pctBelowTarget: rel.failure_pct_below_speed(Number(inputs.targetSpeed)),
    targetSpeed: Number(inputs.targetSpeed),
    vmtWeighted: !!inputs.vmtWeighted,
    hasIncidents: rel.has_incidents(),
    hasWeather: rel.has_weather(),
  });
}

/**
 * What this facility carries that the reliability run does or does not express,
 * in the caller's own terms.
 *
 * Every entry is checked against the facility rather than printed
 * unconditionally, so the panel stays quiet on a plain facility and speaks up
 * on the cases that matter. It is shown before the run as well as after it,
 * because "this cannot be expressed" is worth knowing before pressing the
 * button rather than after reading the answer.
 */
export function handoffNotes(doc, rows, fx = toFixture(doc, rows)) {
  const notes = [];

  const wz = rows.filter((r) => r.work_zone).length;
  if (wz) {
    notes.push({
      id: 'work-zone-carried',
      level: 'ok',
      text: `The ${wz === 1 ? 'work zone' : `${wz} work zones`} on this facility ${wz === 1 ? 'crosses' : 'cross'} into the reliability run: the reliability constructor builds its Chapter 10 seed facility from these same segments, so the Section 4 capacity and speed adjustments apply in every scenario. Chapter 11 has no work zone schedule of its own, so the closure is treated as present on every day of the reliability reporting period rather than only while it is built.`,
    });
  }

  for (const u of unboundFieldsIn(fx)) {
    notes.push({
      id: `unbound-${u.field}-${u.segment}`,
      level: 'warn',
      text: `Segment ${u.segment} carries ${u.field}, which no binding passes to either engine, so neither the Chapter 10 run nor this one includes it.`,
    });
  }

  notes.push({
    id: 'fidelity-panels',
    level: 'note',
    text: 'The Chapter 11 fidelity inputs are not offered here: the Step B-6 weather matrix, the Step B-7 incident frequency, severity and duration overrides, the Equation 25-72 demand multiplier table, and restricting the reliability reporting period to selected months. This run takes the engine defaults for all of them, which means no weather at all.',
  });

  return notes;
}
