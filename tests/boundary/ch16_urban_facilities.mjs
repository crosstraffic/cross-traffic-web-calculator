// HCM Chapter 16 (Urban Street Facilities) through the WASM boundary.
// Expected values and tolerances mirror
// transportations-library/tests/chapter16_integration.rs.
//
// Binding-surface scope (WasmUrbanFacility: new(prop_left_turn_lanes) +
// repeated 15-arg add_segment + analyze()):
// * Chapter 29, Section 5, Example Problem 1 (case1 eastbound / case2 westbound, Exhibits 29-39 through 29-49) drives UrbanFacility::aggregate() on PUBLISHED per-segment Chapter 18 measures (Segment 1: base FFS 40.9, speed 24.2, stop rate 1.72, LOS C; Segment 5: 37.9/17.6/2.63/D). The binding has no aggregate-with-supplied-measures path: add_segment takes raw Chapter 18 inputs and analyze() recomputes every segment, and the raw geometry needed to reproduce those measures (curb proportion, upstream intersection width, restrictive median, parking, signal spacing) is not among the 15 add_segment args. Chapter 29 EP1 (facility base FFS 40.1, speed 22.6/22.2, stop rate 1.83/1.93, LOS C, poorest D) is therefore NOT expressible at this boundary; the Rust integration tests keep it.
// * case3 (three copies of the Chapter 30 EP1 eastbound segment through the full Chapter 18-driven analyze() pipeline) IS the boundary-expressible fixture, minus the same missing geometry args: curb 0.70 and upstream width 50 ft fall back to the Chapter 18 defaults (1.0 / 0 ft) and the access-point delay takes the Exhibit 18-13 default path (2.96 s, see ch18_urban_segments.mjs), so the published facility base FFS 40.78 and travel speed 23.67 are NOT reproducible here (computed ~40.66 / ~22.5). Asserted instead: every published measure independent of those inputs (critical v/c, spatial stop rate, LOS, poorest-segment LOS, perception score, length), the Rust test's harmonic-mean identity, the Exhibit 16-3 v/c > 1.0 footnote, and exact cross-surface agreement between WasmUrbanFacility.add_segment and the standalone WasmUrbanSegment constructor on the identical expressible inputs (this validates the 15-arg mapping).
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

// ── case3: Chapter 18-driven facility, three copies of Chapter 30 EP1 EB ──
const c3 = loadCase('UrbanFacilities', 'case3.json');
const s0 = c3.segments[0];

function addSegment(fac, seg, capacity = seg.through_capacity_veh_h) {
  fac.add_segment(
    seg.segment_length_ft,        // 1,800 ft
    seg.n_through_lanes,          // 2
    seg.speed_limit_mph,          // 35 mi/h
    seg.through_demand_veh_h,     // 968 veh/h
    seg.control,                  // "Signalized"
    seg.n_access_points_subject,  // 4
    seg.n_access_points_opposing, // 4
    seg.midsegment_flow_veh_h,    // 1,150 veh/h
    capacity,                     // 1,848 veh/h (Exhibit 30-32)
    seg.through_control_delay_s,  // 18.31 s/veh (Exhibit 30-36)
    seg.cycle_length_s,           // 100 s
    seg.effective_green_s,        // 48.63 s
    undefined,                    // platoon_ratio (uniform arrivals)
    undefined,                    // sat_flow_veh_h_ln
    seg.full_stop_rate_override); // 0.547 stops/veh (Exhibit 30-36)
}

const fac = new m.WasmUrbanFacility(c3.prop_left_turn_lanes); // P_LTL = 0.33
for (const seg of c3.segments) addSegment(fac, seg);

// Facility LOS (Exhibit 16-3 = Exhibit 18-1): robust to the access-point
// delay and curb/width fallbacks (computed speed ~22.5 mi/h sits well
// inside the C band for a ~40.7 mi/h facility base FFS).
exact(fac.analyze(), 'C', 'case3 facility LOS [Exhibit 16-3]');
exact(fac.num_segments(), 3, 'case3 segment count');
approx(fac.get_length_ft(), 5400.0, 1e-9, 'case3 facility length (3 x 1,800 ft)');

// Published Exhibit 30-36 measures that survive the binding surface, at the
// Rust case3 tolerances.
approx(fac.get_critical_vc_ratio(), 0.52, 0.005, 'case3 critical v/c (968/1848) [30-36]');
approx(fac.get_spatial_stop_rate(), 1.61, 0.02, 'case3 facility stop rate (Equation 16-4) [30-36]');
exact(fac.get_poorest_segment_los(), 'C', 'case3 poorest segment LOS');
// Facility perception score: H_F equals the segment H_seg (identical
// segments) and Chapter 16 Step 3 applies the same Equations 18-18..18-22,
// so the published segment score 2.53 [30-36] holds at facility level.
approx(fac.get_perception_score(), 2.53, 0.01, 'case3 facility perception score [30-36]');

// Cross-surface consistency: a standalone WasmUrbanSegment fed the same
// expressible inputs must agree exactly with the facility's per-segment
// engine (validates the add_segment 15-arg mapping against the 28-arg
// constructor mapping tested in ch18_urban_segments.mjs).
const ref = new m.WasmUrbanSegment(
  s0.segment_length_ft, s0.n_through_lanes, s0.speed_limit_mph,
  s0.through_demand_veh_h, s0.control,
  undefined, undefined, undefined, undefined,      // width/median/curb/parking not in add_segment
  s0.n_access_points_subject, s0.n_access_points_opposing,
  undefined, undefined, undefined,
  s0.midsegment_flow_veh_h, s0.through_capacity_veh_h,
  s0.through_control_delay_s, s0.cycle_length_s, s0.effective_green_s,
  undefined, undefined, undefined, undefined, undefined, undefined,
  s0.full_stop_rate_override, undefined, s0.prop_left_turn_lanes);
ref.analyze();
approx(fac.get_base_ffs(), ref.get_base_ffs(), 1e-9, 'case3 facility base FFS == segment base FFS (Equation 16-2, identical segments)');
approx(fac.get_travel_speed(), ref.get_travel_speed(), 1e-9, 'case3 facility travel speed == segment travel speed (Equation 16-3, identical segments)');
approx(fac.get_spatial_stop_rate(), ref.get_spatial_stop_rate(), 1e-9, 'case3 facility stop rate == segment stop rate (Equation 16-4, identical segments)');
exact(fac.get_los(), ref.get_los(), 'case3 facility LOS == segment LOS');

// Rust case3 harmonic-mean identity: the facility travel speed must equal
// the length-weighted travel-time computation on the per-segment outputs.
const segs = fac.segments_to_js_value();
exact(segs.length, 3, 'case3 per-segment results array length');
const totalLen = segs.reduce((a, s) => a + s.length_ft, 0);
const totalTime = segs.reduce((a, s) => a + s.length_ft / s.travel_speed, 0);
approx(fac.get_travel_speed(), totalLen / totalTime, 1e-12, 'case3 harmonic-mean identity with Chapter 18 outputs');
exact(segs[0].los, 'C', 'case3 segment 1 LOS');
approx(segs[0].vc_ratio, 0.52, 0.005, 'case3 segment 1 v/c [30-36]');

// Travel-time bookkeeping in results_to_js_value.
const res = fac.results_to_js_value();
approx(res.travel_time, 3600.0 * 5400.0 / (5280.0 * fac.get_travel_speed()), 1e-9, 'case3 travel time identity');
approx(res.base_free_flow_travel_time, 3600.0 * 5400.0 / (5280.0 * fac.get_base_ffs()), 1e-9, 'case3 base free-flow travel time identity');
exact(res.los, 'C', 'case3 results object LOS');
exact(res.poorest_segment_los, 'C', 'case3 results object poorest LOS');

// ── Exhibit 16-3 footnote: v/c > 1.0 at any boundary intersection forces
// facility LOS F (mirrors test_case1_vc_footnote_forces_los_f, which sets
// v/c = 1.02 directly; here the middle segment's capacity is lowered to
// 940 veh/h so v/c = 968/940 = 1.0298 > 1.0 through the binding inputs). ──
const facF = new m.WasmUrbanFacility(c3.prop_left_turn_lanes);
addSegment(facF, c3.segments[0]);
addSegment(facF, c3.segments[1], 940.0);
addSegment(facF, c3.segments[2]);
exact(facF.analyze(), 'F', 'v/c > 1.0 footnote forces facility LOS F [Exhibit 16-3]');
approx(facF.get_critical_vc_ratio(), 968.0 / 940.0, 1e-9, 'critical v/c picks the oversaturated segment');
exact(facF.get_poorest_segment_los(), 'F', 'oversaturated segment LOS F');

report('ch16 urban street facilities (HCM Ch.30 EP1-driven facility + Exhibit 16-3 footnote)');
