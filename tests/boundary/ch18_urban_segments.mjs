// HCM Chapter 18 (Urban Street Segments) through the WASM boundary:
// Chapter 30, Section 8, Example Problem 1 (Exhibits 30-26 through 30-36).
// Expected values and tolerances mirror
// transportations-library/tests/chapter18_integration.rs.
//
// Binding-surface scope (WasmUrbanSegment, 28-arg flat constructor):
// * case1's `access_point_delays_s` published-input hook (Exhibit 30-35 per-point delays 0.193/0.194 s/veh),
// * case2's Exhibit 18-13 planning parameters (`n_influential_access_points` = 2, 6.5%/8.1% access turn percentages, turn-bay flags), and
// * case3's Chapter 30 Section 4 computed access-point geometry (`access_point_approaches`)
// are NOT expressible through the constructor. The binding therefore always takes the Exhibit 18-13 planning path with the exhibit's built-in 10%/10% turn baseline and N_ap = N_ap,s + p_ap,lt * N_ap,o = 4 + 1.0*4 = 8, giving a deterministic access-point delay of 0.37 s/veh/pt (Exhibit 18-13 at 1,150/2 = 575 veh/h/ln, two through lanes) * 8 = 2.96 s instead of the published Section 4 total of 0.387 s. The published running time (33.54 s) and travel speed (23.67 mi/h) of Exhibit 30-36 are consequently NOT reproducible at this boundary (the Rust integration tests keep those assertions); the checks below assert every published measure that is independent of the access-point delay term at the Rust tolerances, plus the derived running-time/travel-speed values implied by the published Exhibit 18-13 delay so the midsegment-flow and access-point-count argument mapping is still exercised.
// Case2 (westbound) differs from case1 only in the inexpressible planning parameters, so a second constructor run would duplicate case1 exactly and is omitted.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

// Chapter 30 EP1, eastbound (case1.json inputs, Exhibit 30-26 through 30-31).
const c1 = loadCase('UrbanSegments', 'case1.json');
const seg = new m.WasmUrbanSegment(
  c1.segment_length_ft,               // 1,800 ft
  c1.n_through_lanes,                 // 2
  c1.speed_limit_mph,                 // 35 mi/h
  c1.through_demand_veh_h,            // 968 veh/h
  c1.control,                         // "Signalized"
  c1.upstream_intersection_width_ft,  // 50 ft
  c1.restrictive_median_length_ft,    // 0 ft (undivided)
  c1.proportion_with_curb,            // 0.70
  c1.proportion_on_street_parking,    // 0.0
  c1.n_access_points_subject,         // 4
  c1.n_access_points_opposing,        // 4
  undefined,                          // prop_opposing_left_accessible (default 1.0, undivided)
  c1.signal_spacing_ft,               // 1,800 ft
  undefined,                          // free_flow_speed_override_mph
  c1.midsegment_flow_veh_h,           // 1,150 veh/h (Exhibit 30-29)
  c1.through_capacity_veh_h,          // 1,848 veh/h (Exhibit 30-32)
  c1.through_control_delay_s,         // 18.310 s/veh (Exhibit 30-36, engine output input per Exhibit 18-5)
  c1.cycle_length_s,                  // 100 s
  c1.effective_green_s,               // 48.63 s (Exhibit 30-33)
  undefined,                          // arrival_type
  undefined,                          // platoon_ratio (uniform arrivals, P = g/C)
  undefined,                          // sat_flow_veh_h_ln
  undefined,                          // stopped_vehicles_veh_ln
  undefined,                          // queue2_veh_ln
  undefined,                          // queue3_veh_ln
  c1.full_stop_rate_override,         // 0.547 stops/veh (Exhibit 30-36)
  undefined,                          // stop_rate_other
  c1.prop_left_turn_lanes);           // 0.33

// LOS is robust to the access-point-delay difference: the computed travel
// speed (~22.55 mi/h, see below) sits well inside the Exhibit 18-1 LOS C
// band for a 40.78 mi/h base FFS (roughly 20.5-26.9 mi/h).
exact(seg.analyze(), 'C', 'EP1 LOS [Exhibit 30-36]');

// Published Exhibit 30-36 measures independent of the access-point delay,
// at the Rust integration-test tolerances.
approx(seg.get_base_ffs(), 40.78, 0.01, 'EP1 base FFS [30-36]');
approx(seg.get_free_flow_speed(), 39.33, 0.01, 'EP1 free-flow speed S_f (Equation 18-5)');
approx(seg.get_proportion_arriving_green(), 0.486, 0.001, 'EP1 P = g/C (uniform arrivals; published dispersion value 0.493)');
approx(seg.get_through_delay(), 18.310, 0.001, 'EP1 through delay pass-through [30-36]');
approx(seg.get_full_stop_rate(), 0.547, 0.001, 'EP1 full stop rate override pass-through [30-36]');
approx(seg.get_spatial_stop_rate(), 1.61, 0.01, 'EP1 spatial stop rate (Equation 18-16) [30-36]');
approx(seg.get_vc_ratio(), 0.52, 0.005, 'EP1 through v/c (968/1848) [30-36]');
approx(seg.get_perception_score(), 2.53, 0.01, 'EP1 traveler perception score (Equations 18-17..18-22) [30-36]');
exact(seg.get_demand_exceeds_capacity(), false, 'EP1 demand within capacity');

// Derived (NOT published) values implied by the binding's forced Exhibit
// 18-13 planning path, documented above: d_ap = 0.37 * 8 = 2.96 s; running
// time = (33.54 - 0.387) + 2.96 = 36.11 s; travel speed =
// 3600*1800/5280 / (36.11 + 18.310) = 22.55 mi/h. These exercise the
// midsegment-flow and access-point-count argument positions.
approx(seg.get_access_point_delay(), 2.96, 0.005, 'EP1 access point delay (Exhibit 18-13 default path, 0.37 s/pt x 8)');
approx(seg.get_running_time(), 36.11, 0.05, 'EP1 running time (derived; published 33.54 unreachable, see header)');
approx(seg.get_travel_speed(), 22.55, 0.05, 'EP1 travel speed (derived; published 23.67 unreachable, see header)');

// results_to_js_value must agree with the getters (JS-object conversion).
const r = seg.results_to_js_value();
exact(r.los, 'C', 'EP1 results object LOS');
approx(r.base_ffs, seg.get_base_ffs(), 1e-12, 'EP1 results object base FFS == getter');
approx(r.travel_speed, seg.get_travel_speed(), 1e-12, 'EP1 results object travel speed == getter');
approx(r.vc_ratio, seg.get_vc_ratio(), 1e-12, 'EP1 results object v/c == getter');

report('ch18 urban street segments (HCM Ch.30 EP1)');
