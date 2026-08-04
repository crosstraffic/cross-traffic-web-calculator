// HCM Chapter 19 (Signalized Intersections) through the WASM boundary.
// Expected values and tolerances mirror
// transportations-library/tests/chapter19_integration.rs:
// * case1.json — HCM 7th Ed. Chapter 31, Section 10, Example Problem 1
//   (motorized vehicle LOS; Exhibits 31-69..31-82), driven through
//   WasmSignalizedIntersection.from_config (the fixture is richer than the
//   flat constructor: permitted lefts, parking, peds, per-approach widths).
// * case2.json — Chapter 31, Section 2 pretimed phase-duration example
//   (Exhibit 31-7) as a full timing plan, driven BOTH through from_config
//   and through the flat constructor (which is the arg-order/units surface
//   the JS calculator uses), asserting both paths give the published X_c
//   and the hand-computed Equation 19-19/19-26 delays.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

function laneGroup(groups, dir, kind, label) {
  const lg = groups.find((g) => g.direction === dir && g.kind === kind);
  if (!lg) throw new Error(`${label}: lane group ${dir}/${kind} missing`);
  return lg;
}

// ── Example Problem 1 (case1.json) ────────────────────────────────────────
{
  const cfg = loadCase('Signalized', 'case1.json');
  const ix = m.WasmSignalizedIntersection.from_config(cfg);
  ix.analyze();
  const groups = ix.lane_groups_to_js_value();

  // (dir, kind, v [31-76], s [31-77], c [31-80], X [31-80], d [31-81],
  //  d tol, LOS [31-81]) — verbatim from chapter19_integration.rs.
  const cases = [
    ['EB', 'ExclusiveLeft', 71.0, 702.0, 149.0, 0.47, 45.5, 1.5, 'D'],
    ['EB', 'ExclusiveThrough', 239.0, 1643.0, 484.0, 0.49, 29.9, 0.5, 'C'],
    ['EB', 'SharedRightThrough', 185.0, 1201.0, 354.0, 0.52, 30.6, 0.5, 'C'],
    ['WB', 'ExclusiveLeft', 118.0, 825.0, 208.0, 0.57, 43.5, 1.5, 'D'],
    ['WB', 'ExclusiveThrough', 337.0, 1643.0, 484.0, 0.70, 35.5, 0.5, 'D'],
    ['WB', 'SharedRightThrough', 287.0, 1398.0, 412.0, 0.70, 36.2, 0.5, 'D'],
    ['NB', 'ExclusiveLeft', 133.0, 1603.0, 328.0, 0.41, 13.5, 1.5, 'B'],
    ['NB', 'ExclusiveThrough', 870.0, 1683.0, 827.0, 1.05, 72.0, 1.5, 'F'],
    ['NB', 'SharedRightThrough', 863.0, 1648.0, 809.0, 1.07, 76.7, 1.5, 'F'],
    ['SB', 'ExclusiveLeft', 194.0, 1603.0, 225.0, 0.86, 32.6, 1.5, 'C'],
    ['SB', 'ExclusiveThrough', 513.0, 1683.0, 887.0, 0.58, 17.0, 0.5, 'B'],
    ['SB', 'SharedRightThrough', 497.0, 1630.0, 859.0, 0.58, 17.1, 0.5, 'B'],
  ];
  for (const [dir, kind, v, s, c, x, d, dTol, los] of cases) {
    const lg = laneGroup(groups, dir, kind, 'EP1');
    approx(lg.flow_rate, v, 3.0, `EP1 ${dir} ${kind} v`);
    approx(lg.sat_flow, s, 10.0, `EP1 ${dir} ${kind} s`);
    approx(lg.capacity, c, 6.0, `EP1 ${dir} ${kind} c`);
    approx(lg.vc_ratio, x, 0.02, `EP1 ${dir} ${kind} X`);
    approx(lg.control_delay_s, d, dTol, `EP1 ${dir} ${kind} d`);
    exact(lg.los, los, `EP1 ${dir} ${kind} LOS`);
  }

  // Left-turn 50th percentile back of queue (Exhibit 31-82, ADP method).
  approx(laneGroup(groups, 'SB', 'ExclusiveLeft', 'EP1').back_of_queue_veh,
    4.9, 0.5, 'EP1 SB-left back of queue');
  approx(laneGroup(groups, 'EB', 'ExclusiveLeft', 'EP1').back_of_queue_veh,
    1.8, 0.4, 'EP1 EB-left back of queue');
  approx(laneGroup(groups, 'NB', 'ExclusiveLeft', 'EP1').back_of_queue_veh,
    1.4, 0.5, 'EP1 NB-left back of queue');

  // Approach delay and LOS (Exhibit 31-81).
  const approaches = [
    ['EB', 32.4, 'C'],
    ['WB', 37.0, 'D'],
    ['NB', 70.0, 'E'],
    ['SB', 19.6, 'B'],
  ];
  for (const [dir, d, los] of approaches) {
    approx(ix.approach_delay_s(dir), d, 0.5, `EP1 ${dir} approach delay`);
    exact(ix.approach_los(dir), los, `EP1 ${dir} approach LOS`);
  }

  // Intersection delay 45.9 s/veh, LOS D (Exhibit 31-81).
  approx(ix.get_intersection_delay_s(), 45.9, 0.5, 'EP1 intersection delay');
  exact(ix.get_intersection_los(), 'D', 'EP1 intersection LOS');
}

// ── Exhibit 31-7 pretimed timing plan (case2.json) ────────────────────────
// Expected per-approach through lane-group values (hand-computed from HCM
// Equations 19-19 and 19-26 with pretimed k = 0.50, I = 1.0; X_c = 0.923
// published) — verbatim from chapter19_integration.rs.
const CASE2 = [
  // dir, v, c, X, d1, d2, d, LOS
  ['EB', 855.0, 927.8, 0.922, 14.28, 15.75, 30.03, 'C'],
  ['WB', 475.0, 927.8, 0.512, 10.47, 2.02, 12.49, 'B'],
  ['NB', 665.0, 718.8, 0.925, 17.84, 19.57, 37.40, 'D'],
  ['SB', 475.0, 718.8, 0.661, 15.46, 4.73, 20.19, 'C'],
];

function checkCase2(ix, tag) {
  ix.analyze();
  approx(ix.get_critical_vc_ratio(), 0.923, 0.001, `${tag} X_c`);
  const groups = ix.lane_groups_to_js_value();
  for (const [dir, v, c, x, d1, d2, d, los] of CASE2) {
    const lg = laneGroup(groups, dir, 'ExclusiveThrough', tag);
    approx(lg.flow_rate, v, 1e-9, `${tag} ${dir} v`);
    approx(lg.capacity, c, 1.0, `${tag} ${dir} c`);
    approx(lg.vc_ratio, x, 0.005, `${tag} ${dir} X`);
    approx(lg.uniform_delay_s, d1, 0.5, `${tag} ${dir} d1`);
    approx(lg.incremental_delay_s, d2, 0.5, `${tag} ${dir} d2`);
    approx(lg.control_delay_s, d, 0.5, `${tag} ${dir} d`);
    exact(lg.los, los, `${tag} ${dir} LOS`);
    approx(lg.k_factor, 0.5, 1e-9, `${tag} ${dir} k`);
  }
  approx(ix.get_intersection_delay_s(), 26.75, 0.5, `${tag} intersection delay`);
  exact(ix.get_intersection_los(), 'C', `${tag} intersection LOS`);
}

// Path 1: full serde config.
checkCase2(
  m.WasmSignalizedIntersection.from_config(loadCase('Signalized', 'case2.json')),
  'Ex31-7 from_config');

// Path 2: the flat constructor. Arrays are NB, SB, EB, WB ordered, volumes
// and lanes as [left, through, right] triples; through-phase durations are
// D_p = g + Y (EB/WB 29.3 + 4 = 33.3 s, NB/SB 22.7 + 4 = 26.7 s at C = 60 s).
// Fixture conditions: PHF null (undefined here), 0% HV, 12-ft lanes, 35 mi/h,
// no peds, non-CBD, base saturation flow 1,900 pc/h/ln.
checkCase2(
  new m.WasmSignalizedIntersection(
    60.0,           // cycle_length_s
    0.25,           // analysis_period_h
    1900.0,         // base_saturation_flow
    false,          // area_type_cbd
    undefined,      // peak_hour_factor (fixture: null)
    [0, 665, 0, 0, 475, 0, 0, 855, 0, 0, 475, 0],  // volumes NB,SB,EB,WB
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],          // lanes NB,SB,EB,WB
    [26.7, 26.7, 33.3, 33.3],                      // through D_p NB,SB,EB,WB
    [0, 0, 0, 0],                                  // no protected lefts
    4.0,            // yellow_s
    0.0,            // red_clearance_s
    0.0,            // pct_heavy_vehicles
    35.0,           // speed_limit_mph
    12.0,           // lane_width_ft
    0.0),           // ped_flow_ph
  'Ex31-7 flat ctor');

report('ch19 signalized intersections (HCM Ch.31 EP1 + Exhibit 31-7)');
