// HCM Chapter 25, Example Problems 1 (undersaturated), 2 (oversaturated),
// 3 (capacity improvements to the oversaturated facility), 4 (work zone),
// 5 (managed lanes) and 6 (planning-level method) — the Chapter 10 freeway
// facilities methodology — through the WASM boundary. Expected
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
// facility gets freshly built segments. A fixture's `work_zone` object goes
// through set_work_zone (middleware 0.3.7) rather than through the
// constructor, which still takes seg_type through daf.
function buildSegments(fx) {
  return fx.segments.map((s) => {
    const seg = new m.WasmFacilitySegment(
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
function buildFacility(fx) {
  return new m.WasmFreewayFacility(
    buildSegments(fx),
    fx.mainline_demand,
    fx.ffs,
    fx.heavy_vehicle_pct,
    fx.terrain,
    fx.city_type,
    fx.phf,
    fx.jam_density_pc,
    fx.queue_discharge_drop,
    fx.total_ramp_density,
    fx.interchange_density,
  );
}

// expected[p][i] (period-major, as printed in the exhibits); actual getter
// is (segment, period), mirroring the Rust assert_matrix.
function checkMatrix(getFn, expected, tol, label) {
  expected.forEach((row, p) =>
    row.forEach((e, i) => {
      approx(getFn(i, p), e, tol, `${label} seg ${i + 1} p${p + 1}`);
    }),
  );
}

// Mirrors the Rust assert_matrix_against_published. `published` is the exhibit
// and `engine` is what this implementation computes for the same cells. Where
// the two agree within `tol` the cell is asserted at its published value,
// which is the real reproduction check; where they do not, the cell is a
// documented reproduction gap and is asserted at the engine value within
// `pinTol`, so no cell is left unasserted and a gap that closes or widens
// fails rather than passing unnoticed.
function checkAgainstPublished(getFn, published, engine, tol, pinTol, label) {
  published.forEach((row, p) =>
    row.forEach((book, i) => {
      const mine = engine[p][i];
      const cell = `${label} seg ${i + 1} p${p + 1}`;
      if (Math.abs(mine - book) <= tol) {
        approx(getFn(i, p), book, tol, cell);
      } else {
        approx(getFn(i, p), mine, pinTol, `${cell} (VERIFY-HCM gap, published ${book})`);
      }
    }),
  );
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
    checkMatrix(
      (i, p) => fac.get_volume_served(i, p),
      [
        [4505, 4955, 4955, 4955, 4685, 5225, 4865, 5315, 5315, 5315, 5045],
        [4955, 5495, 5495, 5495, 5135, 5855, 5495, 6035, 6035, 6035, 5765],
        [5225, 5855, 5855, 5855, 5585, 6395, 6035, 6665, 6665, 6665, 6215],
        [4685, 5045, 5045, 5045, 4775, 5135, 4775, 5225, 5225, 5225, 4955],
        [3785, 3965, 3965, 3965, 3695, 3965, 3785, 4055, 4055, 4055, 3875],
      ],
      0.5,
      'EP1 volume served',
    );
  }

  // Speed matrix (Exhibit 25-49), all 55 cells, +-0.5 mi/h.
  checkMatrix(
    (i, p) => fac.get_speed(i, p),
    [
      [60.0, 53.9, 59.7, 56.1, 60.0, 48.0, 59.9, 53.4, 53.4, 56.0, 59.7],
      [59.9, 53.2, 58.6, 55.8, 59.6, 46.8, 58.6, 52.3, 52.3, 55.7, 57.6],
      [59.4, 52.6, 57.2, 55.7, 58.3, 46.2, 56.2, 50.6, 50.6, 51.8, 55.1],
      [60.0, 53.8, 59.7, 56.1, 60.0, 49.7, 60.0, 53.6, 53.6, 56.0, 59.9],
      [60.0, 54.9, 59.8, 56.3, 60.0, 52.5, 60.0, 54.8, 54.8, 56.5, 60.0],
    ],
    0.5,
    'EP1 speed',
  );

  // Density matrix (Exhibit 25-50), all 55 cells, +-0.5 veh/mi/ln.
  checkMatrix(
    (i, p) => fac.get_density_veh(i, p),
    [
      [25.0, 30.6, 27.6, 29.4, 26.0, 27.2, 27.1, 33.2, 33.2, 31.6, 28.1],
      [27.6, 34.5, 31.2, 32.8, 28.7, 31.3, 31.2, 38.5, 38.5, 36.1, 33.4],
      [29.3, 37.1, 34.1, 35.0, 31.9, 34.6, 35.8, 43.9, 43.9, 42.9, 37.6],
      [26.0, 31.3, 28.1, 30.0, 26.5, 25.8, 26.5, 32.5, 32.5, 31.1, 27.6],
      [21.0, 24.1, 22.0, 23.5, 20.5, 18.9, 21.0, 24.7, 24.7, 23.9, 21.5],
    ],
    0.5,
    'EP1 density',
  );

  // Segment LOS matrix (Exhibit 25-51), all 55 cells exact.
  [
    ['C', 'C', 'D', 'C', 'D', 'C', 'D', 'D', 'D', 'D', 'D'],
    ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'E', 'D', 'D'],
    ['D', 'D', 'D', 'D', 'D', 'D', 'E', 'E', 'E', 'D', 'E'],
    ['D', 'C', 'D', 'C', 'D', 'C', 'D', 'C', 'D', 'D', 'D'],
    ['C', 'C', 'C', 'C', 'C', 'B', 'C', 'C', 'C', 'C', 'C'],
  ].forEach((row, p) =>
    row.forEach((e, i) => {
      exact(fac.get_los(i, p), e, `EP1 LOS seg ${i + 1} p${p + 1}`);
    }),
  );

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
  const published = (6.0 / 56.9) * 60.0;
  const tt = (fac.total_length_mi() / fac.get_overall_speed()) * 60.0;
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
  [0.86, 0.96, 0.96, 0.96, 0.92, 0.85, 0.99, 1.1, 1.1, 1.1, 1.02].forEach((e, i) =>
    approx(fac.get_dc_ratio(i, 2), e, 0.005, `EP2 vd/c seg ${i + 1} p3`),
  );

  // Volume-served matrix (Exhibit 25-56), all 55 cells, +-40 veh/h.
  if (has(fac, 'get_volume_served')) {
    checkMatrix(
      (i, p) => fac.get_volume_served(i, p),
      [
        [5001, 5500, 5500, 5500, 5200, 5800, 5400, 5900, 5900, 5900, 5600],
        [5500, 6099, 6099, 6099, 5700, 6499, 6099, 6699, 6699, 6699, 6399],
        [5800, 6499, 6499, 6499, 5831, 6281, 5584, 6284, 6284, 6284, 5859],
        [5200, 5600, 5600, 5600, 5668, 6311, 5776, 6276, 6276, 6276, 5934],
        [4201, 4401, 4401, 4401, 4102, 4608, 4840, 5140, 5140, 5140, 4912],
      ],
      40.0,
      'EP2 volume served',
    );
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
  approx(fac.get_overall_speed(), 49.3, 0.05, 'EP2 overall SMS (VERIFY-HCM, published 50.5)');
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
// ═══════════════════════════════════════════════════════════════════════
{
  const fx = loadCase('FreewayFacilities', 'case3.json');
  const fac = buildFacility(fx);
  fac.run_analysis();

  // Segment capacities (Exhibit 25-63), veh/h, +-1 for the book's rounding to
  // whole vehicles. Segments 1-5 keep the three-lane cross section at 6,748;
  // Segments 7-11 gain the fourth lane and rise to 8,998. Weaving Segment 6
  // follows the period's weaving pattern, so it varies across the five
  // periods. This was checked only indirectly through the d/c matrix until
  // get_capacity() arrived in middleware 0.3.7.
  const weavingByPeriod = [8273, 8281, 8323, 8403, 8463];
  for (let p = 0; p < 5; p++) {
    for (let i = 0; i < 11; i++) {
      const e = i <= 4 ? 6748 : i === 5 ? weavingByPeriod[p] : 8998;
      approx(fac.get_capacity(i, p), e, 1.0, `EP3 capacity seg ${i + 1} p${p + 1}`);
    }
  }

  // Adding the fourth lane removes every bottleneck (Exhibit 25-64).
  exact(fac.is_oversaturated(), false, 'EP3 undersaturated after the improvement');
  for (let p = 0; p < 5; p++) {
    for (let i = 0; i < 11; i++) {
      exact(fac.get_dc_ratio(i, p) <= 1.0 + 1e-9, true, `EP3 d/c seg ${i + 1} p${p + 1} <= 1`);
    }
  }

  // Demand-to-capacity matrix (Exhibit 25-64), all 55 cells, +-0.01.
  checkMatrix(
    (i, p) => fac.get_dc_ratio(i, p),
    [
      [0.74, 0.82, 0.82, 0.82, 0.77, 0.7, 0.6, 0.66, 0.66, 0.66, 0.62],
      [0.82, 0.9, 0.9, 0.9, 0.84, 0.78, 0.68, 0.74, 0.74, 0.74, 0.71],
      [0.86, 0.96, 0.96, 0.96, 0.92, 0.85, 0.74, 0.82, 0.82, 0.82, 0.77],
      [0.77, 0.83, 0.83, 0.83, 0.79, 0.68, 0.59, 0.64, 0.64, 0.64, 0.61],
      [0.62, 0.65, 0.65, 0.65, 0.61, 0.52, 0.47, 0.5, 0.5, 0.5, 0.48],
    ],
    0.01,
    'EP3 d/c ratio',
  );

  // Speed matrix (Exhibit 25-65), all 55 cells, +-0.5 mi/h. The facility is
  // globally undersaturated here, so every cell comes from the Chapter
  // 12/13/14 segment methods directly rather than from the oversaturated
  // engine — which is why all 55 reproduce where EP2's period 4 does not.
  checkMatrix(
    (i, p) => fac.get_speed(i, p),
    [
      [59.8, 53.2, 58.6, 55.9, 59.5, 50.5, 60.0, 54.9, 54.9, 58.1, 60.0],
      [58.6, 52.1, 55.8, 55.5, 57.9, 50.1, 60.0, 54.3, 54.3, 57.7, 60.0],
      [57.4, 51.1, 53.1, 53.1, 55.2, 49.7, 59.8, 53.6, 53.6, 57.2, 59.5],
      [59.5, 53.0, 58.3, 55.8, 59.2, 50.8, 60.0, 55.0, 55.0, 58.1, 60.0],
      [60.0, 54.5, 59.7, 56.2, 60.0, 53.4, 60.0, 55.9, 55.9, 58.8, 60.0],
    ],
    0.5,
    'EP3 speed',
  );

  // Density matrix (Exhibit 25-66), all 55 cells, +-0.5 veh/mi/ln.
  checkMatrix(
    (i, p) => fac.get_density_veh(i, p),
    [
      [27.9, 34.5, 31.3, 32.8, 29.2, 28.7, 22.5, 26.8, 26.8, 25.4, 23.3],
      [31.3, 39.0, 36.4, 36.7, 32.8, 32.5, 25.4, 30.9, 30.9, 29.0, 26.7],
      [33.7, 42.4, 40.8, 40.8, 37.4, 35.7, 28.0, 34.5, 34.5, 32.4, 29.0],
      [29.2, 35.2, 32.0, 33.4, 29.8, 28.1, 22.1, 26.4, 26.4, 24.9, 22.9],
      [23.3, 26.9, 24.5, 26.1, 22.8, 20.6, 17.5, 20.1, 20.1, 19.1, 17.9],
    ],
    0.5,
    'EP3 density',
  );

  // Segment LOS matrix (Exhibit 25-67), all 55 cells exact. The improvement
  // pulls Segments 7-11 out of the D/E band Example Problem 2 produced.
  [
    ['D', 'D', 'D', 'D', 'D', 'D', 'C', 'C', 'D', 'C', 'C'],
    ['D', 'D', 'E', 'D', 'D', 'D', 'C', 'C', 'D', 'C', 'D'],
    ['D', 'D', 'E', 'D', 'E', 'E', 'D', 'D', 'D', 'D', 'D'],
    ['D', 'D', 'D', 'D', 'D', 'D', 'C', 'C', 'D', 'C', 'C'],
    ['C', 'C', 'C', 'C', 'C', 'C', 'B', 'B', 'C', 'B', 'B'],
  ].forEach((row, p) =>
    row.forEach((e, i) => {
      exact(fac.get_los(i, p), e, `EP3 LOS seg ${i + 1} p${p + 1}`);
    }),
  );

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
// case4.json puts a `work_zone` object on Segment 11 (three lanes to two open,
// plastic drums, urban, daylight) and the core reads it in
// effective_caf/effective_saf to apply CAF_wz and SAF_wz per Equations
// 10-7..10-12. Until middleware 0.3.7 that field had nowhere to go:
// WasmFacilitySegment took seg_type through daf and no work zone, so the
// facility got Segment 11's two-lane cross section at full unadjusted
// capacity and every published EP4 exhibit was out of reach. This block held
// a guard pinning the tell, Segment 11 period-1 d/c at 1.121 against the
// published 1.26 with the 0.892 between them. The guard did its job: it
// failed the moment set_work_zone landed, which is what forced these matrices
// to be written. They mirror the Rust ep4_* tests cell for cell.
// ═══════════════════════════════════════════════════════════════════════
{
  const fx = loadCase('FreewayFacilities', 'case4.json');
  exact(fx.segments[10].work_zone !== undefined, true, 'EP4 fixture carries a Segment 11 work zone');

  // Equations 10-7 through 10-12 on their own, before the facility runs. The
  // non-work-zone per-lane capacity is 2,300 pc/h/ln at the facility FFS of
  // 60 mi/h (Equation 12-6), which is what the core passes internally.
  const wzSeg = buildSegments(fx)[10];
  exact(wzSeg.has_work_zone(), true, 'EP4 seg 11 carries the work zone through the binding');
  approx(wzSeg.work_zone_lcsi(), 0.75, 1e-9, 'EP4 LCSI (Equation 10-7, Exhibit 10-15 3-to-2)');
  approx(wzSeg.work_zone_caf(2300.0), 0.892, 0.002, 'EP4 CAF_wz (Equation 10-11)');
  approx(wzSeg.work_zone_saf(60.0), 0.982, 0.002, 'EP4 SAF_wz (Equation 10-12)');

  const fac = buildFacility(fx);
  fac.run_analysis();
  exact(fac.is_oversaturated(), true, 'EP4 the work zone drives the facility oversaturated');

  // Segment capacities (Exhibit 25-71), veh/h. Segments 1-5 and 7-10 keep the
  // three-lane 6,748 cross section and weaving Segment 6 varies by period,
  // exactly as in Example Problem 3.
  //
  // Segment 11 is the stage trap. Exhibit 25-71 prints 4,499, which is the
  // Step A-7 value carrying only the lane closure. The book then applies
  // CAF_wz in Step A-8 and the facility's capacity matrix holds that post-CAF
  // value, which is the stage the Exhibit 25-72 ratios below reproduce
  // against: 4,499 x 0.892 = 4,013 veh/h.
  const weavingByPeriod = [8273, 8281, 8323, 8403, 8463];
  for (let p = 0; p < 5; p++) {
    for (let i = 0; i < 10; i++) {
      const e = i === 5 ? weavingByPeriod[p] : 6748;
      approx(fac.get_capacity(i, p), e, 1.0, `EP4 capacity seg ${i + 1} p${p + 1}`);
    }
    approx(
      fac.get_capacity(10, p),
      4499 * 0.892,
      5.0,
      `EP4 work zone capacity seg 11 p${p + 1} (Exhibit 25-71 prints the pre-CAF 4499)`,
    );
  }

  // Demand-to-capacity matrix (Exhibit 25-72), all 55 cells. Segment 11
  // exceeds 1.0 in every period except the last, which is what activates the
  // oversaturated engine from Analysis Period 1 onward. +-0.02: the book's
  // Segment 11 period-3 ratio prints 1.56 where the unrounded quotient is
  // 1.548, so its own rounding needs more than 0.01.
  checkMatrix(
    (i, p) => fac.get_dc_ratio(i, p),
    [
      [0.67, 0.73, 0.73, 0.73, 0.69, 0.63, 0.72, 0.79, 0.79, 0.79, 1.26],
      [0.73, 0.81, 0.81, 0.81, 0.76, 0.71, 0.81, 0.89, 0.89, 0.89, 1.44],
      [0.77, 0.87, 0.87, 0.87, 0.83, 0.77, 0.89, 0.99, 0.99, 0.99, 1.56],
      [0.69, 0.75, 0.75, 0.75, 0.71, 0.61, 0.71, 0.77, 0.77, 0.77, 1.24],
      [0.56, 0.59, 0.59, 0.59, 0.55, 0.47, 0.56, 0.6, 0.6, 0.6, 0.97],
    ],
    0.02,
    'EP4 d/c ratio',
  );

  // Volume-served matrix (Exhibit 25-73), all 55 cells. 33 of them reproduce
  // within +-40 veh/h and are asserted at their published values: the whole of
  // Analysis Period 1, the work zone (Segment 11) in every period, where the
  // bottleneck meters throughput at the work zone discharge rate of ~3,714
  // veh/h, and Analysis Period 2 everywhere but Segment 4.
  //
  // VERIFY-HCM (documented reproduction gap): the remaining 22 cells are the
  // upstream segments of Analysis Periods 3-5. Once the Segment 11 queue
  // reaches back through the facility the engine distributes stored demand
  // differently from the published FREEVAL run. This is the same
  // oversaturated-regime gap documented for Example Problem 2, not a
  // work-zone-specific defect: the work zone segment itself and the whole
  // pre-queue period reproduce.
  if (has(fac, 'get_volume_served')) {
    checkAgainstPublished(
      (i, p) => fac.get_volume_served(i, p),
      [
        [4505, 4955, 4955, 4955, 4685, 5225, 3924, 4185, 4126, 3929, 3719],
        [4955, 5495, 5495, 5446, 3947, 3701, 3325, 3878, 3882, 3895, 3714],
        [3275, 3476, 3094, 3031, 2912, 3391, 3250, 3899, 3905, 3929, 3714],
        [2831, 3398, 3474, 3416, 3424, 3914, 3597, 4014, 4004, 3965, 3714],
        [3589, 3991, 4096, 3957, 3452, 3912, 3675, 3923, 3916, 3897, 3714],
      ],
      [
        [4505, 4955, 4955, 4955, 4685, 5225, 3925, 4193, 4133, 3948, 3738],
        [4955, 5495, 5495, 5397, 3935, 3686, 3348, 3901, 3905, 3915, 3733],
        [3434, 3712, 3215, 3184, 2894, 3337, 3242, 3891, 3898, 3921, 3733],
        [3138, 3570, 3625, 3469, 3449, 3961, 3627, 4048, 4036, 4006, 3733],
        [3632, 3801, 3787, 3777, 3543, 4044, 3721, 3967, 3960, 3938, 3733],
      ],
      40.0,
      2.0,
      'EP4 volume served (veh/h)',
    );
  }

  // Speed matrix (Exhibit 25-74) and density matrix (Exhibit 25-75), all 110
  // cells across the two.
  //
  // Segment 11 is the cell the work-zone methodology actually governs. It
  // never queues (it is the bottleneck, discharging at its own reduced
  // capacity), so its operating point is set entirely by the Step A-8 work
  // zone adjustments rather than by the queue engine, and it holds 50.4-50.5
  // mi/h and 36.8-36.9 veh/mi/ln across all five periods. That is the cell
  // that would move if CAF_wz or SAF_wz were wrong, which makes it the real
  // regression guard for Equations 10-7 through 10-12 downstream of the
  // factor checks above.
  //
  // VERIFY-HCM (documented reproduction gap): 34 of the 55 speed cells and 15
  // of the 55 density cells reproduce and are asserted at their published
  // values. The rest are the queued segments upstream of the work zone, pinned
  // at the engine value. Speeds there differ from Exhibit 25-74 by up to 6.2
  // mi/h (period 5 Segment 3 computes 12.4 against a published 18.6) and
  // densities from Exhibit 25-75 by up to 28.6 veh/mi/ln (the same cell, 102.1
  // against 73.5), because the engine holds the residual queue in different
  // segments than the published FREEVAL run does. Every LOS letter still
  // reproduces below, so the disagreement is in how the same total queue is
  // distributed, not in its size.
  checkAgainstPublished(
    (i, p) => fac.get_speed(i, p),
    [
      [60.0, 53.9, 59.7, 56.1, 60.0, 48.0, 24.2, 15.9, 13.0, 13.0, 50.4],
      [59.9, 53.2, 54.5, 52.3, 22.2, 8.9, 9.4, 12.3, 12.2, 12.2, 50.5],
      [12.9, 12.8, 13.1, 9.7, 8.0, 6.5, 9.1, 12.4, 12.4, 12.4, 50.5],
      [5.9, 11.0, 12.9, 12.8, 11.5, 8.3, 11.0, 13.1, 12.7, 12.7, 50.5],
      [11.0, 16.4, 18.6, 16.4, 12.3, 8.3, 11.2, 12.5, 12.3, 12.3, 50.5],
    ],
    [
      [60.0, 53.9, 59.7, 56.1, 60.0, 48.0, 24.1, 16.3, 15.0, 13.4, 50.2],
      [59.9, 53.2, 58.6, 53.2, 22.0, 8.9, 9.7, 12.6, 12.5, 12.6, 50.2],
      [16.6, 13.9, 10.0, 8.9, 7.4, 6.8, 9.2, 12.5, 12.5, 12.6, 50.2],
      [7.7, 12.2, 11.4, 10.7, 9.6, 8.8, 11.0, 13.5, 13.3, 13.1, 50.2],
      [12.2, 14.1, 12.4, 12.3, 10.1, 9.1, 11.5, 13.0, 12.9, 12.7, 50.2],
    ],
    0.5,
    0.1,
    'EP4 speed (mi/h)',
  );

  checkAgainstPublished(
    (i, p) => fac.get_density_veh(i, p),
    [
      [25.0, 30.6, 27.6, 29.4, 26.0, 27.2, 54.1, 87.5, 100.6, 100.6, 36.9],
      [27.6, 34.5, 33.6, 34.7, 59.1, 104.2, 117.8, 105.5, 106.2, 106.2, 36.8],
      [84.6, 90.6, 78.7, 104.6, 121.4, 130.1, 119.1, 104.4, 105.4, 105.4, 36.8],
      [159.3, 103.4, 89.8, 88.7, 99.4, 117.3, 109.0, 102.5, 104.2, 104.2, 36.8],
      [108.6, 81.0, 73.5, 80.4, 93.5, 118.2, 109.2, 105.0, 106.0, 106.0, 36.8],
    ],
    [
      [25.0, 30.6, 27.7, 29.4, 26.0, 27.2, 54.4, 86.0, 91.7, 98.4, 37.2],
      [27.6, 34.5, 31.2, 33.8, 59.7, 103.9, 115.3, 103.5, 103.8, 103.5, 37.1],
      [69.1, 89.2, 106.9, 118.8, 131.1, 121.9, 117.9, 103.5, 103.9, 103.4, 37.1],
      [136.0, 97.5, 105.7, 108.1, 120.1, 112.9, 110.0, 99.8, 101.0, 101.6, 37.1],
      [99.4, 89.9, 102.1, 102.5, 116.8, 111.6, 108.3, 101.9, 102.6, 103.0, 37.1],
    ],
    0.5,
    0.2,
    'EP4 density (veh/mi/ln)',
  );

  // Segment LOS matrix (Exhibit 25-76), all 55 cells exact. Every queued
  // segment reaches LOS F while the work zone itself stays at LOS E, because
  // Segment 11 discharges at its own reduced capacity rather than queueing.
  // This is the strongest reproduction check available for Example Problem 4:
  // the LOS letters bin the densities the speed and density matrices only
  // partly reproduce, and every bin lands where the book puts it.
  [
    ['C', 'C', 'D', 'C', 'D', 'C', 'F', 'F', 'F', 'F', 'E'],
    ['D', 'D', 'D', 'D', 'F', 'F', 'F', 'F', 'F', 'F', 'E'],
    ['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'E'],
    ['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'E'],
    ['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'E'],
  ].forEach((row, p) =>
    row.forEach((e, i) => {
      exact(fac.get_los(i, p), e, `EP4 LOS seg ${i + 1} p${p + 1}`);
    }),
  );

  // Facility performance summary (Exhibit 25-77). Space mean speed reproduces
  // within 0.7 mi/h per period and average density within 1.0 veh/mi/ln in the
  // first four. Period 5 is the queue-recovery period, where both measures are
  // most sensitive to the discharge capacity, and it keeps a wider density
  // bound: scoping the Equation 25-12 front-clearing test to a restored
  // bottleneck moved it onto a close speed and a density that now overshoots
  // by about as much as it used to undershoot. LOS is F in every period.
  [
    [39.2, 38.4],
    [21.8, 66.1],
    [11.5, 99.1],
    [11.3, 105.5],
    [13.7, 93.4],
  ].forEach(([s, k], p) => {
    const [speedTol, densityTol] = p === 4 ? [0.8, 5.2] : [0.7, 1.0];
    approx(fac.get_facility_speed(p), s, speedTol, `EP4 facility SMS p${p + 1}`);
    approx(fac.get_facility_density_veh(p), k, densityTol, `EP4 facility density p${p + 1}`);
    exact(fac.get_facility_los(p), 'F', `EP4 facility LOS p${p + 1}`);
  });

  // Exhibit 25-77 overall totals. The demand-weighted overall speed carries a
  // larger gap than the per-period values (computed 16.2 against a published
  // 19.5 mi/h) while the overall density is close (81.6 against 80.5) — the
  // same oversaturated-regime gap documented for Example Problem 2, amplified
  // by the far deeper queues here. Both are pinned at what this engine
  // measures, at the measurement precision rather than at the Rust tolerance,
  // because a pinned value exists to fail when it moves.
  approx(fac.get_overall_speed(), 16.2, 0.1, 'EP4 overall SMS (VERIFY-HCM, published 19.5)');
  approx(fac.get_overall_density_veh(), 81.6, 0.1, 'EP4 overall density (VERIFY-HCM, published 80.5)');
}

// ═══════════════════════════════════════════════════════════════════════
// Example Problem 5: managed-lane facility (Exhibits 25-78 .. 25-87)
//
// The managed lane is a parallel lane group rather than a property of a
// general-purpose segment, so it cannot be reached through
// WasmFreewayFacility at all. WasmManagedLaneFacility (middleware 0.3.6)
// takes the whole facility as one config object in the serde schema of the
// library's own ManagedLaneFacility, so ml_case1.json loads verbatim. The
// six checks below mirror the six Rust ep5_* tests.
// ═══════════════════════════════════════════════════════════════════════
{
  const fx = loadCase('FreewayFacilities', 'ml_case1.json');
  const fac = new m.WasmManagedLaneFacility(fx);
  fac.run_analysis();

  exact(fac.num_segments(), 11, 'EP5 segment count');
  exact(fac.num_periods(), 5, 'EP5 period count');

  // ML capacity (Exhibit 25-81): 1,614 veh/h for the marking-separated
  // Continuous Access lane at FFS 60 (1,650 pc/h/ln x f_HV), uniform over
  // every segment and period.
  for (let p = 0; p < 5; p++) {
    for (let i = 0; i < 11; i++) {
      approx(fac.get_ml_capacity(i, p), 1614, 3.0, `EP5 ML capacity seg ${i + 1} p${p + 1}`);
    }
  }

  // ML demand-to-capacity ratios (Exhibit 25-82, lower table): uniform along
  // the facility, since there are no ML ramps.
  [0.62, 0.68, 0.72, 0.64, 0.52].forEach((e, p) => {
    for (let i = 0; i < 11; i++) {
      approx(fac.get_ml_dc_ratio(i, p), e, 0.005, `EP5 ML vd/c seg ${i + 1} p${p + 1}`);
    }
  });

  // GP segment density matrix (Exhibit 25-84, upper table), all 55 cells.
  // This is the lane group whose densities drive the ML adjacent-friction
  // check, read through the GP facility snapshot rather than a second set of
  // getters duplicated on the managed-lane wrapper.
  const gp = fac.gp_facility();
  checkMatrix(
    (i, p) => gp.get_density_veh(i, p),
    [
      [22.2, 27.6, 25.0, 26.7, 23.3, 25.0, 24.4, 30.3, 30.3, 29.1, 25.6],
      [24.4, 31.0, 27.9, 29.8, 25.6, 28.9, 27.9, 35.2, 35.2, 33.4, 29.8],
      [25.8, 33.4, 30.1, 31.8, 28.1, 32.2, 31.6, 40.2, 40.2, 37.8, 33.2],
      [23.1, 28.0, 25.3, 27.1, 23.7, 23.4, 23.7, 29.3, 29.3, 28.3, 24.8],
      [18.7, 21.5, 19.8, 21.1, 18.1, 16.9, 18.7, 22.1, 22.1, 21.6, 19.2],
    ],
    0.6,
    'EP5 GP density (veh/mi/ln)',
  );

  // ML adjacent-friction speed reductions (Exhibit 25-83, lower table): the
  // Continuous Access ML loses speed where the adjacent GP density exceeds
  // 35 pc/mi/ln (Step A-13, Equations 12-18/12-19). Segments 8-9 in period 2
  // and Segments 8-10 in period 3 are affected; the unaffected segments hold
  // the uniform 59.3/58.9/58.6/59.2/59.7 mi/h by period.
  [
    [0, 59.3],
    [1, 58.9],
    [2, 58.6],
    [4, 59.7],
  ].forEach(([p, e]) => {
    approx(fac.get_ml_speed(0, p), e, 0.3, `EP5 ML speed seg 1 p${p + 1}`);
  });
  [
    [7, 1, 53.5],
    [8, 1, 53.5],
    [7, 2, 52.1],
    [8, 2, 52.1],
    [9, 2, 52.1],
  ].forEach(([i, p, e]) => {
    approx(fac.get_ml_speed(i, p), e, 0.4, `EP5 ML speed seg ${i + 1} p${p + 1} (friction)`);
  });
  exact(fac.is_ml_friction_active(7, 2), true, 'EP5 friction active seg 8 p3');
  exact(fac.is_ml_friction_active(0, 0), false, 'EP5 no friction seg 1 p1');

  // Lane-group performance (Exhibit 25-86): GP and ML space mean speed and
  // average density by analysis period.
  const gpGroup = [
    [57.7, 24.9],
    [57.3, 28.1],
    [56.5, 31.0],
    [58.0, 24.6],
    [58.5, 19.1],
  ];
  const mlGroup = [
    [59.3, 16.9],
    [58.6, 18.8],
    [58.0, 20.0],
    [59.2, 17.6],
    [59.7, 14.1],
  ];
  gpGroup.forEach(([s, k], p) => {
    approx(fac.get_gp_group_speed(p), s, 0.6, `EP5 GP group SMS p${p + 1}`);
    approx(fac.get_gp_group_density_veh(p), k, 0.6, `EP5 GP group density p${p + 1}`);
  });
  mlGroup.forEach(([s, k], p) => {
    approx(fac.get_ml_group_speed(p), s, 0.5, `EP5 ML group SMS p${p + 1}`);
    approx(fac.get_ml_group_density_veh(p), k, 0.5, `EP5 ML group density p${p + 1}`);
  });

  // Combined facility performance and LOS (Exhibit 25-87).
  //
  // VERIFY-HCM: the combined density is the exact Equation 10-1
  // lane-mile-weighted average of the two lane groups. In the peak period
  // (p3) that yields 28.3 veh/mi/ln where Exhibit 25-87 reports 29.1, a value
  // not reproducible from the book's own Exhibit 25-86 group densities (31.0
  // GP, 20.0 ML) under Equation 10-1. LOS is unaffected. That one cell is
  // asserted at the engine value with the published one named; the other four
  // periods carry their published densities.
  [
    [58.0, 23.4, 'C'],
    [57.5, 26.4, 'D'],
    [56.7, 29.1, 'D'],
    [58.2, 23.3, 'C'],
    [58.7, 18.1, 'C'],
  ].forEach(([s, k, l], p) => {
    approx(fac.get_facility_speed(p), s, 0.6, `EP5 facility SMS p${p + 1}`);
    if (p === 2) {
      approx(fac.get_facility_density_veh(p), 28.3, 0.15, 'EP5 facility density p3 (VERIFY-HCM, published 29.1)');
    } else {
      approx(fac.get_facility_density_veh(p), k, 0.6, `EP5 facility density p${p + 1}`);
    }
    exact(fac.get_facility_los(p), l, `EP5 facility LOS p${p + 1}`);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Example Problem 6: planning-level method (Exhibits 25-88 .. 25-96)
// ═══════════════════════════════════════════════════════════════════════
{
  const fx = loadCase('FreewayFacilities', 'planning_case1.json');
  const secTypes = fx.sections.map((s) => s.sec_type).join(',');
  const plan = new m.WasmPlanningFacility(
    secTypes,
    fx.sections.map((s) => s.length_mi),
    new Uint32Array(fx.sections.map((s) => s.lanes)),
    fx.sections.map((s) => s.inflow_aadt ?? 0),
    fx.sections.map((s) => s.outflow_aadt ?? 0),
    fx.sections.map((s) => s.weave_vr ?? 0),
    fx.ffs,
    fx.k_factor,
    fx.growth_factor,
    fx.phf,
    fx.pct_sut,
    fx.pct_tt,
    fx.terrain,
    fx.city_type,
  );
  plan.run_analysis();

  exact(plan.num_sections(), 7, 'EP6 section count');
  approx(plan.total_length_mi(), 6.0, 1e-9, 'EP6 facility length (mi)');

  // Demand-to-capacity ratios (Exhibit 25-91), +-0.01; expected[p][i].
  [
    [0.72, 0.86, 0.74, 0.65, 0.76, 0.91, 0.79],
    [0.8, 0.96, 0.82, 0.72, 0.85, 1.02, 0.88],
    [0.72, 0.86, 0.74, 0.65, 0.76, 0.93, 0.8],
    [0.64, 0.77, 0.66, 0.58, 0.68, 0.81, 0.7],
  ].forEach((row, p) =>
    row.forEach((e, i) => {
      approx(plan.get_dc_ratio(i, p), e, 0.01, `EP6 d/c sec ${i + 1} p${p + 1}`);
    }),
  );

  // Delay rates (Exhibit 25-92), s/mi, +-0.4.
  if (has(plan, 'get_delay_rate')) {
    [
      [0.0, 2.8, 0.2, 0.0, 0.5, 5.0, 0.8],
      [1.0, 7.4, 1.6, 0.1, 2.3, 11.7, 3.3],
      [0.0, 2.8, 0.2, 0.0, 0.5, 5.8, 1.1],
      [0.0, 0.5, 0.0, 0.0, 0.0, 1.3, 0.0],
    ].forEach((row, p) =>
      row.forEach((e, i) => {
        approx(plan.get_delay_rate(i, p), e, 0.4, `EP6 delay sec ${i + 1} p${p + 1}`);
      }),
    );
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
  console.log(
    `NOTE  skipped checks awaiting middleware wrapper work (getters not in any released version): ${[...pendingRebuild].join(', ')}`,
  );
}
report('ch10 freeway facilities (HCM Ch.25 EP1-EP6, all six example problems at the boundary)');
