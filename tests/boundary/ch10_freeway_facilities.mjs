// HCM Chapter 25, Example Problems 1 (undersaturated), 2 (oversaturated),
// 3 (capacity improvements to the oversaturated facility), 4 (work zone,
// partial — see the block below) and 6 (planning-level method) — the Chapter
// 10 freeway facilities methodology — through the WASM boundary. Expected
// values and tolerances mirror
// transportations-library/tests/chapter10_integration.rs, which cites the
// exhibit for each number (speeds/densities +-0.5, volumes +-40 in EP2, LOS
// exact). Cells that reproduce the book are asserted at the published value;
// cells that do not are pinned at the value this engine computes with the
// published one named alongside, exactly as the Rust tests do, so a gap that
// closes or widens fails rather than passing unnoticed.
//
// Anchored on the post-PR-#75 library, which scoped the Equation 25-12
// front-clearing test to a restored bottleneck. That correction moved several
// Example Problem 2 period-4 cells onto their published values; the additions
// are marked "corrected engine" where they land.
//
// Example Problem 5 (managed lanes, ml_case1.json, Exhibits 25-78..25-87) is
// OUT OF SCOPE for this boundary: the managed-lane binding was cut from the
// published WASM surface, so those six Rust tests are core-only.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

// Some checks want getters (volume served, demand-based LOS, planning delay
// rate / queue) that are not bound in any released middleware version —
// they are pending wrapper work, not a rebuild. Skip those checks and say so.
const pendingRebuild = new Set();
function has(obj, name) {
  if (typeof obj[name] === 'function') return true;
  pendingRebuild.add(name);
  return false;
}

// The WasmFreewayFacility constructor consumes the segment objects, so each
// facility gets freshly built segments.
function buildSegments(fx) {
  return fx.segments.map(s => new m.WasmFacilitySegment(
    s.seg_type, s.length_ft, s.lanes,
    s.on_ramp_demand ?? [], s.off_ramp_demand ?? [], s.ramp_to_ramp_demand ?? [],
    s.ramp_ffs, s.accel_lane_ft, s.decel_lane_ft, s.short_length_ft,
    s.num_weaving_lanes, s.lc_rf, s.lc_fr, s.ffs, s.caf, s.saf, s.daf));
}
function buildFacility(fx) {
  return new m.WasmFreewayFacility(buildSegments(fx), fx.mainline_demand,
    fx.ffs, fx.heavy_vehicle_pct, fx.terrain, fx.city_type, fx.phf,
    fx.jam_density_pc, fx.queue_discharge_drop, fx.total_ramp_density,
    fx.interchange_density);
}

// expected[p][i] (period-major, as printed in the exhibits); actual getter
// is (segment, period), mirroring the Rust assert_matrix.
function checkMatrix(getFn, expected, tol, label) {
  expected.forEach((row, p) => row.forEach((e, i) => {
    approx(getFn(i, p), e, tol, `${label} seg ${i + 1} p${p + 1}`);
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// Example Problem 1: undersaturated facility (Exhibits 25-43 .. 25-52)
// ═══════════════════════════════════════════════════════════════════════
{
  const fx = loadCase('FreewayFacilities', 'case1.json');
  const fac = buildFacility(fx);
  fac.run_analysis();

  exact(fac.num_segments(), 11, 'EP1 segment count');
  exact(fac.num_periods(), 5, 'EP1 period count');
  exact(fac.is_oversaturated(), false, 'EP1 undersaturated');

  // Volume-served matrix (Exhibit 25-48): undersaturated, volume = demand.
  if (has(fac, 'get_volume_served')) {
    checkMatrix((i, p) => fac.get_volume_served(i, p), [
      [4505, 4955, 4955, 4955, 4685, 5225, 4865, 5315, 5315, 5315, 5045],
      [4955, 5495, 5495, 5495, 5135, 5855, 5495, 6035, 6035, 6035, 5765],
      [5225, 5855, 5855, 5855, 5585, 6395, 6035, 6665, 6665, 6665, 6215],
      [4685, 5045, 5045, 5045, 4775, 5135, 4775, 5225, 5225, 5225, 4955],
      [3785, 3965, 3965, 3965, 3695, 3965, 3785, 4055, 4055, 4055, 3875],
    ], 0.5, 'EP1 volume served');
  }

  // Speed matrix (Exhibit 25-49), all 55 cells, +-0.5 mi/h.
  checkMatrix((i, p) => fac.get_speed(i, p), [
    [60.0, 53.9, 59.7, 56.1, 60.0, 48.0, 59.9, 53.4, 53.4, 56.0, 59.7],
    [59.9, 53.2, 58.6, 55.8, 59.6, 46.8, 58.6, 52.3, 52.3, 55.7, 57.6],
    [59.4, 52.6, 57.2, 55.7, 58.3, 46.2, 56.2, 50.6, 50.6, 51.8, 55.1],
    [60.0, 53.8, 59.7, 56.1, 60.0, 49.7, 60.0, 53.6, 53.6, 56.0, 59.9],
    [60.0, 54.9, 59.8, 56.3, 60.0, 52.5, 60.0, 54.8, 54.8, 56.5, 60.0],
  ], 0.5, 'EP1 speed');

  // Density matrix (Exhibit 25-50), all 55 cells, +-0.5 veh/mi/ln.
  checkMatrix((i, p) => fac.get_density_veh(i, p), [
    [25.0, 30.6, 27.6, 29.4, 26.0, 27.2, 27.1, 33.2, 33.2, 31.6, 28.1],
    [27.6, 34.5, 31.2, 32.8, 28.7, 31.3, 31.2, 38.5, 38.5, 36.1, 33.4],
    [29.3, 37.1, 34.1, 35.0, 31.9, 34.6, 35.8, 43.9, 43.9, 42.9, 37.6],
    [26.0, 31.3, 28.1, 30.0, 26.5, 25.8, 26.5, 32.5, 32.5, 31.1, 27.6],
    [21.0, 24.1, 22.0, 23.5, 20.5, 18.9, 21.0, 24.7, 24.7, 23.9, 21.5],
  ], 0.5, 'EP1 density');

  // Segment LOS matrix (Exhibit 25-51), all 55 cells exact.
  [
    ['C', 'C', 'D', 'C', 'D', 'C', 'D', 'D', 'D', 'D', 'D'],
    ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'E', 'D', 'D'],
    ['D', 'D', 'D', 'D', 'D', 'D', 'E', 'E', 'E', 'D', 'E'],
    ['D', 'C', 'D', 'C', 'D', 'C', 'D', 'C', 'D', 'D', 'D'],
    ['C', 'C', 'C', 'C', 'C', 'B', 'C', 'C', 'C', 'C', 'C'],
  ].forEach((row, p) => row.forEach((e, i) => {
    exact(fac.get_los(i, p), e, `EP1 LOS seg ${i + 1} p${p + 1}`);
  }));

  // Facility performance summary (Exhibit 25-52).
  const perf = [
    [57.6, 27.5, 'D'],
    [56.6, 31.3, 'D'],
    [55.0, 34.8, 'E'],
    [57.9, 27.5, 'D'],
    [58.4, 21.4, 'C'],
  ];
  perf.forEach(([s, k, l], p) => {
    approx(fac.get_facility_speed(p), s, 0.5, `EP1 facility SMS p${p + 1}`);
    approx(fac.get_facility_density_veh(p), k, 0.5, `EP1 facility density p${p + 1}`);
    exact(fac.get_facility_los(p), l, `EP1 facility LOS p${p + 1}`);
  });
  // Exhibit 25-52 totals: 56.9 mi/h, 28.4 veh/mi/ln.
  approx(fac.get_overall_speed(), 56.9, 0.5, 'EP1 overall SMS');
  approx(fac.get_overall_density_veh(), 28.4, 0.5, 'EP1 overall density');

  // Travel time consistency: 6 mi at 56.9 mi/h ~= 6.33 min/veh, +-5%.
  approx(fac.total_length_mi(), 6.0, 0.01, 'EP1 facility length (mi)');
  const published = 6.0 / 56.9 * 60.0;
  const tt = fac.total_length_mi() / fac.get_overall_speed() * 60.0;
  approx(tt, published, 0.05 * published, 'EP1 avg travel time (min)');
}

// ═══════════════════════════════════════════════════════════════════════
// Example Problem 2: oversaturated facility (Exhibits 25-53 .. 25-60)
// ═══════════════════════════════════════════════════════════════════════
{
  const fx = loadCase('FreewayFacilities', 'case2.json');
  const fac = buildFacility(fx);
  fac.run_analysis();

  exact(fac.is_oversaturated(), true, 'EP2 oversaturated');
  // Not expressible: first_oversat_period, vc_ratio, had_queue, and
  // unserved_entry_veh have no binding getters (core-only assertions).

  // Demand-to-capacity ratios in period 3 (Exhibit 25-55), +-0.005.
  [0.86, 0.96, 0.96, 0.96, 0.92, 0.85, 0.99, 1.10, 1.10, 1.10, 1.02]
    .forEach((e, i) => approx(fac.get_dc_ratio(i, 2), e, 0.005, `EP2 vd/c seg ${i + 1} p3`));

  // Volume-served matrix (Exhibit 25-56), all 55 cells, +-40 veh/h.
  if (has(fac, 'get_volume_served')) {
    checkMatrix((i, p) => fac.get_volume_served(i, p), [
      [5001, 5500, 5500, 5500, 5200, 5800, 5400, 5900, 5900, 5900, 5600],
      [5500, 6099, 6099, 6099, 5700, 6499, 6099, 6699, 6699, 6699, 6399],
      [5800, 6499, 6499, 6499, 5831, 6281, 5584, 6284, 6284, 6284, 5859],
      [5200, 5600, 5600, 5600, 5668, 6311, 5776, 6276, 6276, 6276, 5934],
      [4201, 4401, 4401, 4401, 4102, 4608, 4840, 5140, 5140, 5140, 4912],
    ], 40.0, 'EP2 volume served');
  }

  // Speed matrix (Exhibit 25-57), reproduced cells (periods 1, 2, 5 whole;
  // period 3 with the VERIFY-HCM seg 5 gap at its computed 44.0 +-1.5;
  // period 4 segments 7-11 at +-1.0). Period-4 segments 1-6 are the
  // documented queue-redistribution gap and are not asserted, same as Rust.
  const speedRows = [
    [0, [59.8, 53.2, 58.6, 55.9, 59.5, 46.8, 59.0, 52.5, 52.5, 55.7, 58.3]],
    [1, [58.6, 52.1, 55.8, 55.5, 57.9, 45.4, 55.8, 50.6, 50.6, 51.5, 53.9]],
    [4, [60.0, 54.5, 59.7, 56.2, 60.0, 51.4, 50.9, 53.7, 53.7, 56.1, 59.9]],
  ];
  for (const [p, row] of speedRows) {
    row.forEach((e, i) => approx(fac.get_speed(i, p), e, 0.5, `EP2 speed seg ${i + 1} p${p + 1}`));
  }
  [57.4, 51.1, 53.1, 53.1, NaN, 24.2, 28.1, 51.6, 51.6, 54.7, 57.1].forEach((e, i) => {
    if (!Number.isNaN(e)) approx(fac.get_speed(i, 2), e, 0.5, `EP2 speed seg ${i + 1} p3`);
  });
  approx(fac.get_speed(4, 2), 44.0, 1.5, 'EP2 speed seg 5 p3 (VERIFY-HCM, published 45.3)');
  [30.3, 51.7, 51.7, 54.7, 56.8].forEach((e, k) => {
    approx(fac.get_speed(6 + k, 3), e, 1.0, `EP2 speed seg ${7 + k} p4`);
  });

  // Density matrix (Exhibit 25-58), reproduced cells.
  const densRows = [
    [0, [27.9, 34.5, 31.3, 32.8, 29.2, 31.0, 30.5, 37.4, 37.4, 35.3, 32.0]],
    [1, [31.3, 39.0, 36.4, 36.7, 32.8, 35.8, 36.4, 44.2, 44.2, 43.3, 39.6]],
    [4, [23.3, 26.9, 24.5, 26.1, 22.8, 22.4, 31.7, 31.9, 31.9, 30.5, 27.3]],
  ];
  for (const [p, row] of densRows) {
    row.forEach((e, i) => approx(fac.get_density_veh(i, p), e, 0.5, `EP2 density seg ${i + 1} p${p + 1}`));
  }
  // Period 3: queued segments 5-7 +-1.5 (VERIFY-HCM), others +-0.5.
  [33.7, 42.4, 40.8, 40.8, 42.9, 64.8, 66.4, 40.6, 40.6, 38.3, 34.2].forEach((e, i) => {
    const tol = i >= 4 && i < 7 ? 1.5 : 0.5;
    approx(fac.get_density_veh(i, 2), e, tol, `EP2 density seg ${i + 1} p3`);
  });
  // Period 4, segments 8-11: downstream of the bottleneck and unaffected by
  // the queue-redistribution gap, so these carry their published values on the
  // corrected engine. Segments 1-7 of this row compute
  // 29.2/35.2/32.1/35.8/39.2/73.4/63.5 against a published
  // 36.7/39.3/36.3/38.6/33.4/63.9/65.1 and stay in the VERIFY-HCM note above.
  [40.4, 40.4, 38.2, 34.8].forEach((e, k) => {
    approx(fac.get_density_veh(7 + k, 3), e, 0.5, `EP2 density seg ${8 + k} p4`);
  });

  // Expanded LOS matrix (Exhibit 25-59): periods 1, 2, 3, 5 whole; period 4
  // segments 4 and 6-11. Period-4 segments 1-3 and 5 are the documented gap
  // (computed D/D/D and E vs published E/E/E and D) and are not asserted, same
  // as Rust.
  const losRows = [
    [0, ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'E', 'D', 'D']],
    [1, ['D', 'D', 'E', 'D', 'D', 'E', 'E', 'E', 'E', 'D', 'E']],
    [2, ['D', 'D', 'E', 'D', 'E', 'F', 'F', 'D', 'E', 'D', 'D']],
    [4, ['C', 'C', 'C', 'C', 'C', 'C', 'D', 'C', 'D', 'C', 'D']],
  ];
  for (const [p, row] of losRows) {
    row.forEach((e, i) => exact(fac.get_los(i, p), e, `EP2 LOS seg ${i + 1} p${p + 1}`));
  }
  // Segment 4 of period 4 reads the published E on the corrected engine; it
  // was D before the Equation 25-12 front-clearing test was scoped to a
  // restored bottleneck.
  exact(fac.get_los(3, 3), 'E', 'EP2 LOS seg 4 p4');
  ['F', 'F', 'D', 'E', 'D', 'E'].forEach((e, k) => {
    exact(fac.get_los(5 + k, 3), e, `EP2 LOS seg ${6 + k} p4`);
  });

  // Demand-based LOS (Exhibit 25-59, lower table): F for segments 8-11 in
  // period 3 only, null everywhere else.
  if (has(fac, 'demand_based_los_matrix')) {
    const dbl = fac.demand_based_los_matrix();
    for (let p = 0; p < 5; p++) {
      for (let i = 0; i < 11; i++) {
        const e = p === 2 && i >= 7 ? 'F' : null;
        exact(dbl[i][p] ?? null, e, `EP2 demand-based LOS seg ${i + 1} p${p + 1}`);
      }
    }
  }

  // Facility performance summary (Exhibit 25-60), +-0.5, LOS exact.
  const perf = [
    [56.8, 31.0, 'D'],
    [54.4, 36.2, 'E'],
    [42.5, 45.6, 'F'],
    [42.5, 43.8, 'E'],
    [56.4, 26.2, 'D'],
  ];
  perf.forEach(([s, k, l], p) => {
    approx(fac.get_facility_speed(p), s, 0.5, `EP2 facility SMS p${p + 1}`);
    approx(fac.get_facility_density_veh(p), k, 0.5, `EP2 facility density p${p + 1}`);
    exact(fac.get_facility_los(p), l, `EP2 facility LOS p${p + 1}`);
  });
  // Overall totals: the residual VERIFY-HCM period-4 queue-distribution gap
  // keeps these off the published 50.5 mi/h / 35.6 veh/mi/ln, so they are
  // pinned at what the corrected engine measures here (49.30 / 36.53). The
  // Rust test allows +-1.5 on the same pin; this band is the measurement
  // precision instead, because a pinned value exists to fail when it moves and
  // +-1.5 would swallow a real regression.
  approx(fac.get_overall_speed(), 49.30, 0.05, 'EP2 overall SMS (VERIFY-HCM, published 50.5)');
  approx(fac.get_overall_density_veh(), 36.53, 0.05, 'EP2 overall density (VERIFY-HCM, published 35.6)');

  // Queue lifecycle (the subset expressible through get_queue_length_ft):
  // Segment 7 queues in period 3 and every queue clears by period 5.
  exact(fac.get_queue_length_ft(6, 2) > 0.0, true, 'EP2 seg 7 queued in p3');
  for (let i = 0; i < 11; i++) {
    exact(fac.get_queue_length_ft(i, 4) < 1.0, true, `EP2 seg ${i + 1} queue cleared by p5`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Example Problem 3: capacity improvements to the oversaturated facility
// (Exhibits 25-63 .. 25-68)
//
// case3.json differs from case2.json in two places: Segments 7-11 gain a lane,
// and weaving Segment 6 drops to lc_rf = 0 because the added continuous lane
// downstream means ramp traffic no longer has to change lanes to reach the
// freeway. Both fields are carried by the WasmFacilitySegment constructor, so
// this whole example problem reproduces through the boundary.
//
// Segment capacities (Exhibit 25-63) are the one EP3 Rust test with no
// boundary equivalent: WasmFreewayFacility exposes no capacity getter. The
// demand-to-capacity matrix below is the same quantity divided by demand, so
// the capacities are checked indirectly rather than left unchecked.
// ═══════════════════════════════════════════════════════════════════════
{
  const fx = loadCase('FreewayFacilities', 'case3.json');
  const fac = buildFacility(fx);
  fac.run_analysis();

  // Adding the fourth lane removes every bottleneck (Exhibit 25-64).
  exact(fac.is_oversaturated(), false, 'EP3 undersaturated after the improvement');
  for (let p = 0; p < 5; p++) {
    for (let i = 0; i < 11; i++) {
      exact(fac.get_dc_ratio(i, p) <= 1.0 + 1e-9, true, `EP3 d/c seg ${i + 1} p${p + 1} <= 1`);
    }
  }

  // Demand-to-capacity matrix (Exhibit 25-64), all 55 cells, +-0.01.
  checkMatrix((i, p) => fac.get_dc_ratio(i, p), [
    [0.74, 0.82, 0.82, 0.82, 0.77, 0.70, 0.60, 0.66, 0.66, 0.66, 0.62],
    [0.82, 0.90, 0.90, 0.90, 0.84, 0.78, 0.68, 0.74, 0.74, 0.74, 0.71],
    [0.86, 0.96, 0.96, 0.96, 0.92, 0.85, 0.74, 0.82, 0.82, 0.82, 0.77],
    [0.77, 0.83, 0.83, 0.83, 0.79, 0.68, 0.59, 0.64, 0.64, 0.64, 0.61],
    [0.62, 0.65, 0.65, 0.65, 0.61, 0.52, 0.47, 0.50, 0.50, 0.50, 0.48],
  ], 0.01, 'EP3 d/c ratio');

  // Speed matrix (Exhibit 25-65), all 55 cells, +-0.5 mi/h. The facility is
  // globally undersaturated here, so every cell comes from the Chapter
  // 12/13/14 segment methods directly rather than from the oversaturated
  // engine — which is why all 55 reproduce where EP2's period 4 does not.
  checkMatrix((i, p) => fac.get_speed(i, p), [
    [59.8, 53.2, 58.6, 55.9, 59.5, 50.5, 60.0, 54.9, 54.9, 58.1, 60.0],
    [58.6, 52.1, 55.8, 55.5, 57.9, 50.1, 60.0, 54.3, 54.3, 57.7, 60.0],
    [57.4, 51.1, 53.1, 53.1, 55.2, 49.7, 59.8, 53.6, 53.6, 57.2, 59.5],
    [59.5, 53.0, 58.3, 55.8, 59.2, 50.8, 60.0, 55.0, 55.0, 58.1, 60.0],
    [60.0, 54.5, 59.7, 56.2, 60.0, 53.4, 60.0, 55.9, 55.9, 58.8, 60.0],
  ], 0.5, 'EP3 speed');

  // Density matrix (Exhibit 25-66), all 55 cells, +-0.5 veh/mi/ln.
  checkMatrix((i, p) => fac.get_density_veh(i, p), [
    [27.9, 34.5, 31.3, 32.8, 29.2, 28.7, 22.5, 26.8, 26.8, 25.4, 23.3],
    [31.3, 39.0, 36.4, 36.7, 32.8, 32.5, 25.4, 30.9, 30.9, 29.0, 26.7],
    [33.7, 42.4, 40.8, 40.8, 37.4, 35.7, 28.0, 34.5, 34.5, 32.4, 29.0],
    [29.2, 35.2, 32.0, 33.4, 29.8, 28.1, 22.1, 26.4, 26.4, 24.9, 22.9],
    [23.3, 26.9, 24.5, 26.1, 22.8, 20.6, 17.5, 20.1, 20.1, 19.1, 17.9],
  ], 0.5, 'EP3 density');

  // Segment LOS matrix (Exhibit 25-67), all 55 cells exact. The improvement
  // pulls Segments 7-11 out of the D/E band Example Problem 2 produced.
  [
    ['D', 'D', 'D', 'D', 'D', 'D', 'C', 'C', 'D', 'C', 'C'],
    ['D', 'D', 'E', 'D', 'D', 'D', 'C', 'C', 'D', 'C', 'D'],
    ['D', 'D', 'E', 'D', 'E', 'E', 'D', 'D', 'D', 'D', 'D'],
    ['D', 'D', 'D', 'D', 'D', 'D', 'C', 'C', 'D', 'C', 'C'],
    ['C', 'C', 'C', 'C', 'C', 'C', 'B', 'B', 'C', 'B', 'B'],
  ].forEach((row, p) => row.forEach((e, i) => {
    exact(fac.get_los(i, p), e, `EP3 LOS seg ${i + 1} p${p + 1}`);
  }));

  // No cell of the facility exceeds demand, so no demand-based LOS F appears
  // anywhere (Exhibit 25-64 read against Exhibit 10-6). This is the check that
  // would catch the improvement being applied to the wrong segments.
  if (has(fac, 'demand_based_los_matrix')) {
    const dbl = fac.demand_based_los_matrix();
    for (let p = 0; p < 5; p++) {
      for (let i = 0; i < 11; i++) {
        exact(dbl[i][p] ?? null, null, `EP3 demand-based LOS seg ${i + 1} p${p + 1}`);
      }
    }
  }

  // Facility performance summary (Exhibit 25-68). Every period reproduces
  // within 0.03 mi/h, so space mean speed runs at +-0.1 rather than the file
  // default.
  [
    [57.9, 26.8, 'D'],
    [57.1, 30.3, 'D'],
    [55.9, 33.5, 'D'],
    [57.8, 26.9, 'D'],
    [58.6, 20.8, 'C'],
  ].forEach(([s, k, l], p) => {
    approx(fac.get_facility_speed(p), s, 0.1, `EP3 facility SMS p${p + 1}`);
    approx(fac.get_facility_density_veh(p), k, 0.5, `EP3 facility density p${p + 1}`);
    exact(fac.get_facility_los(p), l, `EP3 facility LOS p${p + 1}`);
  });
  // Exhibit 25-68 totals: 57.5 mi/h, 27.7 veh/mi/ln. The overall space mean
  // speed is demand-weighted across periods and computes 57.34, so it keeps a
  // 0.2 band where the per-period values do not need one.
  approx(fac.get_overall_speed(), 57.5, 0.2, 'EP3 overall SMS');
  approx(fac.get_overall_density_veh(), 27.7, 0.5, 'EP3 overall density');
}

// ═══════════════════════════════════════════════════════════════════════
// Example Problem 4: undersaturated facility with a work zone
// (Exhibits 25-71 .. 25-77)
//
// NOT REPRODUCIBLE THROUGH THIS BOUNDARY, and the reason is a missing
// constructor parameter rather than a missing getter. case4.json puts a
// `work_zone` object on Segment 11 (three lanes to two open, plastic drums,
// urban, daylight), and the core reads it in effective_caf/effective_saf to
// apply CAF_wz = 0.892 and SAF_wz = 0.982 per Equations 10-7..10-12.
// WasmFacilitySegment takes seg_type through daf and has no work_zone
// argument, so the field is silently dropped: the facility still gets Segment
// 11's two-lane cross section but at its full unadjusted capacity. Every
// published EP4 exhibit depends on the adjusted capacity, so none of them can
// be asserted here — the Rust ep4_* tests stay core-only until the wrapper
// exists.
//
// What follows is a guard on that gap, not a reproduction check. It pins the
// tell so that adding the work_zone binding fails this block and forces the
// real EP4 matrices to be written, instead of the gap sitting unnoticed
// because nothing referenced it.
// ═══════════════════════════════════════════════════════════════════════
{
  const fx = loadCase('FreewayFacilities', 'case4.json');
  exact(fx.segments[10].work_zone !== undefined, true, 'EP4 fixture carries a Segment 11 work zone');
  const fac = buildFacility(fx);
  fac.run_analysis();

  // Exhibit 25-72 gives Segment 11 a period-1 demand-to-capacity ratio of
  // 1.26, which only reproduces against the post-CAF capacity
  // (4,499 x 0.892 = 4,013 veh/h). Dropping the work zone leaves the raw
  // 4,499 and the ratio falls to 1.121 — the 0.892 factor exactly.
  approx(fac.get_dc_ratio(10, 0), 1.121, 0.005,
    'EP4 seg 11 d/c p1 without the work-zone binding (published 1.26)');
  approx(fac.get_dc_ratio(10, 0) / 0.892, 1.26, 0.01,
    'EP4 seg 11 d/c p1 recovers the published value when CAF_wz is applied');
}

// ═══════════════════════════════════════════════════════════════════════
// Example Problem 6: planning-level method (Exhibits 25-88 .. 25-96)
// ═══════════════════════════════════════════════════════════════════════
{
  const fx = loadCase('FreewayFacilities', 'planning_case1.json');
  const secTypes = fx.sections.map(s => s.sec_type).join(',');
  const plan = new m.WasmPlanningFacility(
    secTypes,
    fx.sections.map(s => s.length_mi),
    new Uint32Array(fx.sections.map(s => s.lanes)),
    fx.sections.map(s => s.inflow_aadt ?? 0),
    fx.sections.map(s => s.outflow_aadt ?? 0),
    fx.sections.map(s => s.weave_vr ?? 0),
    fx.ffs, fx.k_factor, fx.growth_factor, fx.phf,
    fx.pct_sut, fx.pct_tt, fx.terrain, fx.city_type);
  plan.run_analysis();

  exact(plan.num_sections(), 7, 'EP6 section count');
  approx(plan.total_length_mi(), 6.0, 1e-9, 'EP6 facility length (mi)');

  // Demand-to-capacity ratios (Exhibit 25-91), +-0.01; expected[p][i].
  [
    [0.72, 0.86, 0.74, 0.65, 0.76, 0.91, 0.79],
    [0.80, 0.96, 0.82, 0.72, 0.85, 1.02, 0.88],
    [0.72, 0.86, 0.74, 0.65, 0.76, 0.93, 0.80],
    [0.64, 0.77, 0.66, 0.58, 0.68, 0.81, 0.70],
  ].forEach((row, p) => row.forEach((e, i) => {
    approx(plan.get_dc_ratio(i, p), e, 0.01, `EP6 d/c sec ${i + 1} p${p + 1}`);
  }));

  // Delay rates (Exhibit 25-92), s/mi, +-0.4.
  if (has(plan, 'get_delay_rate')) {
    [
      [0.0, 2.8, 0.2, 0.0, 0.5, 5.0, 0.8],
      [1.0, 7.4, 1.6, 0.1, 2.3, 11.7, 3.3],
      [0.0, 2.8, 0.2, 0.0, 0.5, 5.8, 1.1],
      [0.0, 0.5, 0.0, 0.0, 0.0, 1.3, 0.0],
    ].forEach((row, p) => row.forEach((e, i) => {
      approx(plan.get_delay_rate(i, p), e, 0.4, `EP6 delay sec ${i + 1} p${p + 1}`);
    }));
  }

  // Facility performance summary (Exhibit 25-96):
  // [oversaturated, travel time (min), SMS, density, queue (mi), LOS].
  const results = plan.results_to_js_value();
  const expected = [
    [false, 6.1, 58.9, 29.2, 0.0, 'D'],
    [true, 6.4, 56.6, 33.7, 0.8, 'F'],
    [false, 6.1, 58.8, 29.4, 0.0, 'D'],
    [false, 6.0, 59.8, 25.5, 0.0, 'C'],
  ];
  expected.forEach(([over, tt, sms, dens, q, los], p) => {
    exact(results.oversaturated[p], over, `EP6 oversaturated p${p + 1}`);
    approx(results.travel_time_min[p], tt, 0.15, `EP6 travel time p${p + 1}`);
    approx(plan.get_facility_speed(p), sms, 0.6, `EP6 SMS p${p + 1}`);
    approx(plan.get_facility_density(p), dens, 0.8, `EP6 density p${p + 1}`);
    if (has(plan, 'get_facility_queue_mi')) {
      approx(plan.get_facility_queue_mi(p), q, 0.15, `EP6 queue p${p + 1}`);
    }
    exact(plan.get_facility_los(p), los, `EP6 LOS p${p + 1}`);
  });
}

if (pendingRebuild.size) {
  console.log(`NOTE  skipped checks awaiting middleware wrapper work (getters not in any released version): ${[...pendingRebuild].join(', ')}`);
}
report('ch10 freeway facilities (HCM Ch.25 EP1, EP2, EP3, EP6 full; EP4 work-zone binding absent; EP5 managed lanes out of binding scope)');
