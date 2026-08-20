// HCM Chapter 18 (Urban Street Segments) through the WASM boundary:
// Chapter 30, Section 8, Example Problem 1 (Exhibits 30-26 through 30-36).
// Expected values and tolerances mirror
// transportations-library/tests/chapter18_integration.rs.
//
// Binding-surface scope (WasmUrbanSegment, 37-arg flat constructor +
// add_access_point, crosstraffic_middleware 0.3.3): all three sources the
// library picks among for the Equation 18-7 access-point delay term
// `Sum d_ap,i` are now reachable, so every published Exhibit 30-36 measure
// is reproducible here at the Rust integration-test tolerances:
// * case1 — the `access_point_delays_s` published-input hook (Exhibit 30-35
//   per-point delays 0.193/0.194 s/veh);
// * case3 — the Chapter 30, Section 4 computed procedure (Equations 30-31
//   through 30-68) driven by `add_access_point` per approach, with the
//   per-point breakdown read back through `access_point_delays_computed()`;
// * case2 — the Exhibit 18-13 planning estimate, with the fixture's own
//   turn percentages and turn-bay flags rather than the exhibit's 10%/10%
//   baseline.
// The Step 2 intermediates (S_0, f_CS, f_A, f_pk, f_L, f_v) also gained
// getters in 0.3.3 and are checked against the hand-verified values the
// Rust test asserts.
//
// Before 0.3.3 none of the nine trailing arguments existed, so the binding
// always took the Exhibit 18-13 planning path with the exhibit's built-in
// 10%/10% turn baseline and N_ap = N_ap,s + p_ap,lt * N_ap,o = 4 + 1.0*4 = 8.
// That default path is retained below as a REGRESSION anchor: existing
// callers that pass only the original 28 arguments must keep getting
// identical numbers.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

const c1 = loadCase('UrbanSegments', 'case1.json');
const c2 = loadCase('UrbanSegments', 'case2.json');
const c3 = loadCase('UrbanSegments', 'case3.json');

// The first 28 constructor arguments are identical across the three cases
// (they differ only in which access-point delay source they supply), so the
// shared prefix is built once and spread into each construction.
function prefix(c) {
  return [
    c.segment_length_ft, // 1,800 ft
    c.n_through_lanes, // 2
    c.speed_limit_mph, // 35 mi/h
    c.through_demand_veh_h, // 968 veh/h
    c.control, // "Signalized"
    c.upstream_intersection_width_ft, // 50 ft
    c.restrictive_median_length_ft, // 0 ft (undivided)
    c.proportion_with_curb, // 0.70
    c.proportion_on_street_parking, // 0.0
    c.n_access_points_subject, // 4
    c.n_access_points_opposing, // 4
    undefined, // prop_opposing_left_accessible (default 1.0, undivided)
    c.signal_spacing_ft, // 1,800 ft
    undefined, // free_flow_speed_override_mph
    c.midsegment_flow_veh_h, // 1,150 veh/h (Exhibit 30-29)
    c.through_capacity_veh_h, // 1,848 veh/h (Exhibit 30-32)
    c.through_control_delay_s, // 18.310 s/veh (Exhibit 30-36, engine output input per Exhibit 18-5)
    c.cycle_length_s, // 100 s
    c.effective_green_s, // 48.63 s (Exhibit 30-33)
    undefined, // arrival_type
    undefined, // platoon_ratio (uniform arrivals, P = g/C)
    undefined, // sat_flow_veh_h_ln
    undefined, // stopped_vehicles_veh_ln
    undefined, // queue2_veh_ln
    undefined, // queue3_veh_ln
    c.full_stop_rate_override, // 0.547 stops/veh (Exhibit 30-36)
    undefined, // stop_rate_other
    c.prop_left_turn_lanes, // 0.33
  ];
}

// Published Exhibit 30-36 measures that do not depend on which access-point
// delay source is used. Asserted on all three paths, since reproducing them
// identically is the point of the three-source equivalence.
function assertDelayIndependent(seg, tag) {
  approx(seg.get_base_ffs(), 40.78, 0.01, `${tag} base FFS [30-36]`);
  approx(seg.get_free_flow_speed(), 39.33, 0.01, `${tag} free-flow speed S_f (Equation 18-5)`);
  approx(seg.get_through_delay(), 18.31, 0.001, `${tag} through delay pass-through [30-36]`);
  approx(seg.get_full_stop_rate(), 0.547, 0.001, `${tag} full stop rate override pass-through [30-36]`);
  approx(seg.get_spatial_stop_rate(), 1.61, 0.01, `${tag} spatial stop rate (Equation 18-16) [30-36]`);
  approx(seg.get_vc_ratio(), 0.52, 0.005, `${tag} through v/c (968/1848) [30-36]`);
  approx(seg.get_perception_score(), 2.53, 0.01, `${tag} traveler perception score (Equations 18-17..18-22) [30-36]`);
  approx(
    seg.get_proportion_arriving_green(),
    0.486,
    0.001,
    `${tag} P = g/C (uniform arrivals; published dispersion value 0.493)`,
  );
  exact(seg.get_demand_exceeds_capacity(), false, `${tag} demand within capacity`);
}

// ── (A) case1: published Chapter 30, Section 4 per-point delays supplied
// through the access_point_delays_s hook (Exhibit 30-35). This is the path
// that reproduces Exhibit 30-36 exactly. ──
const segA = new m.WasmUrbanSegment(...prefix(c1), Float64Array.from(c1.access_point_delays_s)); // [0.193, 0.194] s/veh (Exhibit 30-35)

exact(segA.analyze(), 'C', 'case1 LOS [Exhibit 30-36]');
assertDelayIndependent(segA, 'case1');
approx(segA.get_access_point_delay(), 0.387, 0.001, 'case1 Sum d_ap,i (0.193 + 0.194) [30-35]');
approx(segA.get_running_time(), 33.54, 0.01, 'case1 running time [30-36]');
approx(segA.get_running_speed(), 36.59, 0.01, 'case1 running speed [30-36]');
approx(segA.get_travel_speed(), 23.67, 0.01, 'case1 travel speed [30-36]');

// Step 2 intermediates, hand-verified in the Rust test from Equations 18-3
// through 18-7. f_pk is 0 because the fixture has no on-street parking.
approx(segA.get_speed_constant(), 42.05, 0.01, 'case1 S_0 speed constant (Exhibit 18-11 note a)');
approx(segA.get_f_cs(), -0.329, 0.001, 'case1 f_CS cross-section adjustment (Exhibit 18-11 note b)');
approx(segA.get_f_a(), -0.941, 0.001, 'case1 f_A access point adjustment (Exhibit 18-11 note c)');
approx(segA.get_f_pk(), 0.0, 1e-12, 'case1 f_pk parking adjustment (no on-street parking)');
approx(segA.get_f_l(), 0.9644, 0.0005, 'case1 f_L signal spacing adjustment (Equation 18-4)');
approx(segA.get_f_v(), 1.034, 0.001, 'case1 f_v vehicle proximity adjustment (Equation 18-6)');

// ── (B) case3: the Chapter 30, Section 4 procedure COMPUTED from access
// point geometry and turn volumes, one add_access_point call per approach.
// The computed per-point delays must reproduce the Exhibit 30-35 published
// values that case1 supplies as inputs, and every downstream measure must
// land where case1 lands. ──
const segB = new m.WasmUrbanSegment(
  ...prefix(c3),
  undefined, // access_point_delays_s (superseded by the computed procedure)
  undefined, // n_influential_access_points
  undefined, // pct_left_turns_access
  undefined, // pct_right_turns_access
  undefined, // access_left_bay_adequate
  undefined, // access_right_bay_adequate
  undefined, // midsegment_other_delay_s
  c3.analysis_period_h,
); // 0.25 h
for (const ap of c3.access_point_approaches) segB.add_access_point(ap);

exact(segB.analyze(), 'C', 'case3 LOS [Exhibit 30-36]');
assertDelayIndependent(segB, 'case3');

const computed = segB.access_point_delays_computed();
exact(computed.length, 2, 'case3 two active access points [Exhibit 30-31]');
approx(computed[0].delay_total_s, 0.193, 0.001, 'case3 d_ap AP1 computed [30-35]');
approx(computed[1].delay_total_s, 0.194, 0.001, 'case3 d_ap AP2 computed [30-35]');
approx(computed[0].prob_inside_lane_blocked, 0.115, 0.001, 'case3 p_ov AP1 inside-lane blockage [30-35]');
approx(computed[1].prob_inside_lane_blocked, 0.115, 0.001, 'case3 p_ov AP2 inside-lane blockage [30-35]');
// Sum = 0.1934 + 0.1947 = 0.3881 vs the published 0.193 + 0.194 = 0.387;
// the two per-point roundings accumulate, hence the +-0.002 the Rust test uses.
approx(segB.get_access_point_delay(), 0.387, 0.002, 'case3 Sum d_ap,i (computed vs Exhibit 30-35)');
approx(segB.get_running_time(), 33.54, 0.01, 'case3 running time [30-36]');
approx(segB.get_running_speed(), 36.59, 0.01, 'case3 running speed [30-36]');
approx(segB.get_travel_speed(), 23.67, 0.01, 'case3 travel speed [30-36]');

// The computed and supplied paths must agree to within the rounding of the
// published per-point values they share.
approx(
  segB.get_travel_speed(),
  segA.get_travel_speed(),
  0.005,
  'case3 travel speed == case1 travel speed (computed vs supplied d_ap)',
);

// ── (C) case2: the Exhibit 18-13 planning estimate with the fixture's own
// parameters (2 influential access points, 6.5%/8.1% access turn
// percentages from the Exhibit 30-35 volumes, no turn bays). Documented
// deviation from the Section 4 procedure: 0.540 s vs 0.387 s, so running
// time +0.16 s and travel speed -0.07 mi/h against the published values. ──
const segC = new m.WasmUrbanSegment(
  ...prefix(c2),
  undefined, // access_point_delays_s (planning path instead)
  c2.n_influential_access_points, // 2.0 (N_ap,s + p_ap,lt * N_ap,o, fractional)
  c2.pct_left_turns_access, // 6.5% (75.56 / 1,161.7)
  c2.pct_right_turns_access, // 8.1% (94.45 / 1,161.7)
  c2.access_left_bay_adequate, // false
  c2.access_right_bay_adequate,
); // false

exact(segC.analyze(), 'C', 'case2 LOS [Exhibit 30-36]');
assertDelayIndependent(segC, 'case2');
// 0.37 s/veh/pt at 575 veh/h/ln (2 through lanes) x 0.73 turn-percentage
// factor = 0.270 s/veh/pt, x 2 points = 0.540 s.
approx(
  segC.get_access_point_delay(),
  0.54,
  0.005,
  'case2 Sum d_ap (Exhibit 18-13 estimate; Section 4 procedure: 0.387)',
);
approx(segC.get_running_time(), 33.7, 0.01, 'case2 running time (computed)');
approx(segC.get_running_time(), 33.54, 0.5, 'case2 running time [30-36] within the planning-estimate tolerance');
approx(segC.get_travel_speed(), 23.6, 0.01, 'case2 travel speed (computed)');
approx(segC.get_travel_speed(), 23.67, 0.5, 'case2 travel speed [30-36] within the planning-estimate tolerance');

// ── REGRESSION anchor: the pre-0.3.3 no-trailing-args construction. Callers
// that pass only the original 28 arguments still fall through to the Exhibit
// 18-13 planning path with the exhibit's 10%/10% turn baseline and
// N_ap = 4 + 1.0*4 = 8, giving d_ap = 0.37 * 8 = 2.96 s, running time
// (33.54 - 0.387) + 2.96 = 36.11 s and travel speed
// 3600*1800/5280 / (36.11 + 18.310) = 22.55 mi/h. These are DERIVED values,
// not published ones; they are asserted only so the default path cannot
// change silently underneath existing callers. ──
const segLegacy = new m.WasmUrbanSegment(...prefix(c1));

exact(segLegacy.analyze(), 'C', 'legacy default path LOS (robust to the d_ap difference)');
assertDelayIndependent(segLegacy, 'legacy default path');
approx(
  segLegacy.get_access_point_delay(),
  2.96,
  0.005,
  'legacy default path d_ap (Exhibit 18-13 baseline, 0.37 s/pt x 8)',
);
approx(segLegacy.get_running_time(), 36.11, 0.05, 'legacy default path running time (derived, not published)');
approx(segLegacy.get_travel_speed(), 22.55, 0.05, 'legacy default path travel speed (derived, not published)');

// results_to_js_value must agree with the getters (JS-object conversion).
const r = segA.results_to_js_value();
exact(r.los, 'C', 'case1 results object LOS');
approx(r.base_ffs, segA.get_base_ffs(), 1e-12, 'case1 results object base FFS == getter');
approx(r.travel_speed, segA.get_travel_speed(), 1e-12, 'case1 results object travel speed == getter');
approx(r.vc_ratio, segA.get_vc_ratio(), 1e-12, 'case1 results object v/c == getter');

report('ch18 urban street segments (HCM Ch.30 EP1, all three access-point delay paths)');
