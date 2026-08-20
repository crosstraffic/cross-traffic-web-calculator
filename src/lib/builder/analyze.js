// Builder document -> Chapter 10 run.
//
// The seam phase 1a left is one object: `toFixture(doc, rows)` returns the
// facility in the library's own serde schema. This module is the other side of
// it, and it constructs `WasmFreewayFacility` exactly the way
// tests/boundary/ch10_freeway_facilities.mjs does, down to the argument order
// and to routing a `work_zone` through `set_work_zone` rather than through the
// constructor. That is deliberate: the boundary file is what pins the published
// Example Problem values, so a builder run that constructed the facility any
// other way could reproduce the boundary and still be wrong on the page.
//
// Nothing here reads a rune or touches the DOM, so tests/builder/analysis.mjs
// runs it under plain node against the same wasm the page loads.

import { toFixture } from './fixture.js';

/** Fields of the fixture schema that the builder can hold (through a fixture
 * import) but that no binding can express, so a run would drop them silently.
 * The segment constructor takes seg_type through daf and `set_work_zone` takes
 * the work zone; nothing else on `FacilitySegment` has a way in.
 *
 * This is `UNCARRIED_FIELDS` minus the three the constructor does carry, and it
 * is checked against the fixture rather than against the editor, because the
 * editor cannot produce these at all. */
const UNBOUND_SEGMENT_FIELDS = ['caf_schedule', 'saf_schedule', 'ramp_metering', 'c_ifl_override', 'time_step_s'];

/**
 * Build the segment handles for one run.
 *
 * The constructor consumes every handle it is given, so a caller that needs a
 * second facility (the reliability handoff) has to call this again rather than
 * reuse the array. Mirrors `buildSegments` in the ch10 boundary file.
 */
export function buildSegments(fx, wasm) {
  return fx.segments.map((s) => {
    const seg = new wasm.WasmFacilitySegment(
      s.seg_type,
      s.length_ft,
      s.lanes,
      s.on_ramp_demand ?? [],
      s.off_ramp_demand ?? [],
      s.ramp_to_ramp_demand ?? [],
      s.ramp_ffs,
      s.accel_lane_ft,
      s.decel_lane_ft,
      s.short_length_ft,
      s.num_weaving_lanes,
      s.lc_rf,
      s.lc_fr,
      s.ffs,
      s.caf,
      s.saf,
      s.daf,
    );
    if (s.work_zone) seg.set_work_zone(s.work_zone);
    return seg;
  });
}

/** The facility-wide arguments, read off the fixture once. The reliability
 * constructor needs the same values in a different order, and reading them off
 * the fixture twice is how the two runs start to describe different
 * facilities. */
export function facilityArgs(fx) {
  return {
    mainline_demand: fx.mainline_demand,
    ffs: fx.ffs,
    heavy_vehicle_pct: fx.heavy_vehicle_pct,
    terrain: fx.terrain,
    city_type: fx.city_type,
    phf: fx.phf,
    jam_density_pc: fx.jam_density_pc,
    queue_discharge_drop: fx.queue_discharge_drop,
    total_ramp_density: fx.total_ramp_density,
    interchange_density: fx.interchange_density,
  };
}

/**
 * Run the Chapter 10 core methodology on the built facility.
 *
 * Returns a plain frozen snapshot: every matrix is copied out of the wasm
 * module and the handle is dropped, so the result cannot change when the
 * document is edited afterwards and the printable report cannot drift from the
 * run that produced it. That is the rule the Discussion generators follow,
 * applied to the whole result rather than only to its prose.
 *
 * @param {object} doc builder document
 * @param {object[]} rows derived rows, overrides already applied
 * @param {object} wasm the module namespace (WasmFacilitySegment, WasmFreewayFacility)
 */
export function analyzeFacility(doc, rows, wasm) {
  const fx = toFixture(doc, rows);
  const a = facilityArgs(fx);
  const fac = new wasm.WasmFreewayFacility(
    buildSegments(fx, wasm),
    a.mainline_demand,
    a.ffs,
    a.heavy_vehicle_pct,
    a.terrain,
    a.city_type,
    a.phf,
    a.jam_density_pc,
    a.queue_discharge_drop,
    a.total_ramp_density,
    a.interchange_density,
  );
  fac.run_analysis();

  const numSegments = fac.num_segments();
  const numPeriods = fac.num_periods();

  // Matrices arrive [segment][period] and are copied into ordinary arrays.
  const grab = (name) => copyMatrix(fac[name](), numSegments, numPeriods);
  const speed = grab('speed_matrix');
  const density = grab('density_matrix');
  const dc = grab('dc_matrix');
  const capacity = grab('capacity_matrix');
  const los = grab('los_matrix');
  const queue = grab('queue_matrix');
  const volume = grab('volume_served_matrix');
  const demandLos = grab('demand_based_los_matrix');

  // Density in passenger cars has no matrix getter, only the per-cell one.
  const densityPc = [];
  for (let s = 0; s < numSegments; s++) {
    const row = [];
    for (let p = 0; p < numPeriods; p++) row.push(fac.get_density_pc(s, p));
    densityPc.push(row);
  }

  const perPeriod = [];
  for (let p = 0; p < numPeriods; p++) {
    perPeriod.push({
      speed: fac.get_facility_speed(p),
      density: fac.get_facility_density_veh(p),
      los: fac.get_facility_los(p),
    });
  }

  const oversaturated = fac.is_oversaturated();
  const result = {
    numSegments,
    numPeriods,
    totalLengthMi: fac.total_length_mi(),
    overallSpeed: fac.get_overall_speed(),
    overallDensity: fac.get_overall_density_veh(),
    oversaturated,
    // `first_oversat_period` is a core field with no binding getter in any
    // released middleware version, so it is derived here from the
    // demand-to-capacity matrix, which is the same test the core applies:
    // the first analysis period in which any segment's demand exceeds its
    // capacity. It is cross-checked against the queue matrix in
    // tests/builder/analysis.mjs, and the page labels it as the first period
    // demand exceeds capacity rather than as an engine output.
    firstOversatPeriod: oversaturated ? firstPeriodWhere(dc, (v) => v > 1.0) : null,
    firstQueuedPeriod: firstPeriodWhere(queue, (v) => v > 0.0),
    lastQueuedPeriod: lastPeriodWhere(queue, (v) => v > 0.0),
    perPeriod,
    matrices: { speed, density, densityPc, dc, capacity, los, queue, volume, demandLos },
    // Row identity snapshotted with the run, so re-deriving or relabelling
    // the document afterwards cannot retitle a column of finished results.
    segments: rows.map((r, i) => ({
      index: i,
      segType: r.seg_type,
      lengthFt: r.length_ft,
      lanes: r.lanes,
      startFt: r.startFt,
      workZone: !!r.work_zone,
      overridden: !!r.overridden,
    })),
    facilityName: doc.meta?.name ?? 'Untitled facility',
    unboundFields: unboundFieldsIn(fx),
  };
  return deepFreeze(result);
}

/** Fixture keys present on some segment that no binding can carry into a run.
 * A facility built from features never has any; an imported fixture can, and
 * dropping them silently is exactly the kind of failure this workspace pays
 * for, so the page says which segment carries what. */
export function unboundFieldsIn(fx) {
  const out = [];
  fx.segments.forEach((s, i) => {
    for (const k of UNBOUND_SEGMENT_FIELDS) {
      if (s[k] != null) out.push({ segment: i + 1, field: k });
    }
  });
  return out;
}

function copyMatrix(m, segs, periods) {
  const out = [];
  for (let s = 0; s < segs; s++) {
    const row = [];
    const src = m?.[s] ?? [];
    for (let p = 0; p < periods; p++) row.push(src[p] ?? null);
    out.push(row);
  }
  return out;
}

/** Earliest period index in which any segment satisfies `pred`, or null. The
 * scan is period-major because the answer is a period; a segment-major scan
 * would return the earliest period of the first qualifying segment instead. */
function firstPeriodWhere(matrix, pred) {
  const periods = matrix[0]?.length ?? 0;
  for (let p = 0; p < periods; p++) {
    for (let s = 0; s < matrix.length; s++) {
      const v = matrix[s][p];
      if (Number.isFinite(v) && pred(v)) return p;
    }
  }
  return null;
}

function lastPeriodWhere(matrix, pred) {
  const periods = matrix[0]?.length ?? 0;
  for (let p = periods - 1; p >= 0; p--) {
    for (let s = 0; s < matrix.length; s++) {
      const v = matrix[s][p];
      if (Number.isFinite(v) && pred(v)) return p;
    }
  }
  return null;
}

/** Freezing is the enforcement of "the results belong to the run". Without it
 * the page could sort or annotate a matrix in place and the printed report,
 * which holds the same object, would silently follow. */
function deepFreeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(v[k]);
  }
  return v;
}
