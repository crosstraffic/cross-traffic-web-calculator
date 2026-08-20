// HCM Chapter 16 (Urban Street Facilities) through the WASM boundary.
// Expected values and tolerances mirror
// transportations-library/tests/chapter16_integration.rs.
//
// Binding-surface scope (WasmUrbanFacility, crosstraffic_middleware 0.3.3:
// new(prop_left_turn_lanes) + repeated 31-arg add_segment +
// add_segment_summary + aggregate() + analyze()):
// * Chapter 29, Section 5, Example Problem 1 (case1 eastbound / case2 westbound, Exhibits 29-39 through 29-49) drives UrbanFacility::aggregate() on PUBLISHED per-segment Chapter 18 measures. 0.3.3 added add_segment_summary, which is exactly that Exhibit 16-7 "HCM method output" path, so the fixture is now expressible: facility base FFS 40.1 and the LOS pair (C facility, D poorest) reproduce the published Exhibit 29-49 values exactly. The published facility travel speeds (22.6 EB / 22.2 WB) do NOT reproduce, and the fixtures say why in their own _source notes: Segments 2-4 are not individually published and copy Segments 1 and 5, which yields 22.1 EB / 21.5 WB. That is a fixture artifact, not a boundary defect, and the Rust integration test carries the same gap under wider tolerances (+-0.6 / +-0.8 around the published values). Both the tight computed value and the published band are asserted below.
// * case3 (three copies of the Chapter 30 EP1 eastbound segment through the full Chapter 18-driven analyze() pipeline) gained the sixteen trailing add_segment arguments in 0.3.3, so the geometry that used to fall back to Chapter 18 defaults (curb proportion, upstream intersection width, restrictive median, parking, signal spacing) and the access-point delay hook are now supplied. The published facility base FFS 40.78 and travel speed 23.67 (Exhibit 30-36 at facility level) are consequently reachable here for the first time; before 0.3.3 this boundary computed ~40.66 / ~22.5.
// * analyze() must REFUSE to run on a facility holding summary segments, since there are no Chapter 18 inputs behind them to recompute from. That refusal is asserted, not just documented.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

// ── case3, LEGACY 15-argument mapping: Chapter 18-driven facility, three
// copies of Chapter 30 EP1 EB, with only the original fifteen add_segment
// arguments supplied. Retained as a regression anchor so callers written
// against the pre-0.3.3 surface keep getting identical numbers; the
// full-geometry construction that reaches the published values is further
// down. ──
const c3 = loadCase('UrbanFacilities', 'case3.json');
const s0 = c3.segments[0];

function addSegment(fac, seg, capacity = seg.through_capacity_veh_h) {
  fac.add_segment(
    seg.segment_length_ft, // 1,800 ft
    seg.n_through_lanes, // 2
    seg.speed_limit_mph, // 35 mi/h
    seg.through_demand_veh_h, // 968 veh/h
    seg.control, // "Signalized"
    seg.n_access_points_subject, // 4
    seg.n_access_points_opposing, // 4
    seg.midsegment_flow_veh_h, // 1,150 veh/h
    capacity, // 1,848 veh/h (Exhibit 30-32)
    seg.through_control_delay_s, // 18.31 s/veh (Exhibit 30-36)
    seg.cycle_length_s, // 100 s
    seg.effective_green_s, // 48.63 s
    undefined, // platoon_ratio (uniform arrivals)
    undefined, // sat_flow_veh_h_ln
    seg.full_stop_rate_override,
  ); // 0.547 stops/veh (Exhibit 30-36)
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
  s0.segment_length_ft,
  s0.n_through_lanes,
  s0.speed_limit_mph,
  s0.through_demand_veh_h,
  s0.control,
  undefined,
  undefined,
  undefined,
  undefined, // width/median/curb/parking not in add_segment
  s0.n_access_points_subject,
  s0.n_access_points_opposing,
  undefined,
  undefined,
  undefined,
  s0.midsegment_flow_veh_h,
  s0.through_capacity_veh_h,
  s0.through_control_delay_s,
  s0.cycle_length_s,
  s0.effective_green_s,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  s0.full_stop_rate_override,
  undefined,
  s0.prop_left_turn_lanes,
);
ref.analyze();
approx(
  fac.get_base_ffs(),
  ref.get_base_ffs(),
  1e-9,
  'case3 facility base FFS == segment base FFS (Equation 16-2, identical segments)',
);
approx(
  fac.get_travel_speed(),
  ref.get_travel_speed(),
  1e-9,
  'case3 facility travel speed == segment travel speed (Equation 16-3, identical segments)',
);
approx(
  fac.get_spatial_stop_rate(),
  ref.get_spatial_stop_rate(),
  1e-9,
  'case3 facility stop rate == segment stop rate (Equation 16-4, identical segments)',
);
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
approx(res.travel_time, (3600.0 * 5400.0) / (5280.0 * fac.get_travel_speed()), 1e-9, 'case3 travel time identity');
approx(
  res.base_free_flow_travel_time,
  (3600.0 * 5400.0) / (5280.0 * fac.get_base_ffs()),
  1e-9,
  'case3 base free-flow travel time identity',
);
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

// ── (A) Chapter 29 EP1: published per-segment measures aggregated through
// add_segment_summary + aggregate(), the Exhibit 16-7 "HCM method output"
// path. This is the fixture the Rust chapter16 tests drive. ──
function summaryFacility(fixture) {
  const fac = new m.WasmUrbanFacility(fixture.prop_left_turn_lanes); // P_LTL = 1.0
  for (const s of fixture.segments) {
    fac.add_segment_summary(
      s.segment_length_ft, // 1,320 ft (Segments 1-3) / 660 ft (Segments 4-5)
      s.base_ffs_mph, // 40.9 / 37.9 mi/h (Exhibits 29-47, 29-48)
      s.travel_speed_mph, // published Chapter 18 output
      s.spatial_stop_rate_stops_mi, // published Chapter 18 output
      s.vc_ratio, // through v/c at the downstream boundary intersection
      s.los,
    ); // published segment LOS letter
  }
  return fac;
}

const ep1eb = summaryFacility(loadCase('UrbanFacilities', 'case1.json'));
exact(ep1eb.aggregate(), 'C', 'EP1 EB facility LOS [Exhibit 29-49]');
exact(ep1eb.num_segments(), 5, 'EP1 EB segment count');
approx(ep1eb.get_length_ft(), 5280.0, 1e-9, 'EP1 EB facility length (1 mi)');
// Exact: every segment base FFS is published, so Equation 16-2 has no gaps.
approx(ep1eb.get_base_ffs(), 40.1, 0.05, 'EP1 EB facility base FFS (Equation 16-2) [29-49]');
exact(ep1eb.get_poorest_segment_los(), 'D', 'EP1 EB poorest-performing segment LOS [29-49]');
// Published 22.6 mi/h. The fixture's own _source note records that copying
// Segments 1 and 5 into the unpublished Segments 2-4 yields 22.1, which is
// what the Rust test's +-0.6 band accommodates; the tight assertion here
// pins the computed value so the aggregation cannot drift unnoticed.
approx(
  ep1eb.get_travel_speed(),
  22.13,
  0.05,
  'EP1 EB facility travel speed (Equation 16-3; published 22.6, fixture artifact 22.1)',
);
approx(ep1eb.get_travel_speed(), 22.6, 0.6, 'EP1 EB facility travel speed within the published band [29-49]');
approx(ep1eb.get_spatial_stop_rate(), 1.83, 0.15, 'EP1 EB facility stop rate (Equation 16-4) [29-49]');
exact(ep1eb.get_critical_vc_ratio() <= 1.0, true, 'EP1 EB undersaturated boundary intersections');
exact(ep1eb.get_perception_score() > 0, true, 'EP1 EB perception score computed from the aggregated stop rate');

const ep1wb = summaryFacility(loadCase('UrbanFacilities', 'case2.json'));
exact(ep1wb.aggregate(), 'C', 'EP1 WB facility LOS [Exhibit 29-49]');
approx(ep1wb.get_base_ffs(), 40.1, 0.05, 'EP1 WB facility base FFS [29-49]');
exact(ep1wb.get_poorest_segment_los(), 'D', 'EP1 WB poorest-performing segment LOS [29-49]');
// Published 22.2 mi/h; the same copied-segment artifact gives 21.5, which is
// the value the Rust test's +-0.8 band is sized around.
approx(ep1wb.get_travel_speed(), 21.54, 0.05, 'EP1 WB facility travel speed (published 22.2, fixture artifact 21.5)');
approx(ep1wb.get_travel_speed(), 22.2, 0.8, 'EP1 WB facility travel speed within the published band [29-49]');
approx(ep1wb.get_spatial_stop_rate(), 1.93, 0.25, 'EP1 WB facility stop rate [29-49]');

// ── (B) analyze() must refuse a facility built from published summaries:
// the summary segments carry no Chapter 18 inputs to recompute from, so
// silently re-running the engine would overwrite the published measures
// with placeholder-driven ones. ──
let summaryAnalyzeThrew = false;
try {
  summaryFacility(loadCase('UrbanFacilities', 'case1.json')).analyze();
} catch {
  summaryAnalyzeThrew = true;
}
exact(summaryAnalyzeThrew, true, 'analyze() throws on a summary-built facility (use aggregate())');

// ── (C) case3 with the full 0.3.3 geometry: the same three Chapter 30 EP1
// eastbound segments, now with curb proportion, upstream intersection width,
// restrictive median, parking, signal spacing, and the Exhibit 30-35
// access-point delay hook all supplied. The published Exhibit 30-36 values
// reproduce at facility level (identical segments through length-weighted
// harmonic means), which was unreachable before 0.3.3. ──
const facFull = new m.WasmUrbanFacility(c3.prop_left_turn_lanes); // P_LTL = 0.33
for (const seg of c3.segments) {
  facFull.add_segment(
    seg.segment_length_ft, // 1,800 ft
    seg.n_through_lanes, // 2
    seg.speed_limit_mph, // 35 mi/h
    seg.through_demand_veh_h, // 968 veh/h
    seg.control, // "Signalized"
    seg.n_access_points_subject, // 4
    seg.n_access_points_opposing, // 4
    seg.midsegment_flow_veh_h, // 1,150 veh/h
    seg.through_capacity_veh_h, // 1,848 veh/h
    seg.through_control_delay_s, // 18.31 s/veh
    seg.cycle_length_s, // 100 s
    seg.effective_green_s, // 48.63 s
    undefined, // platoon_ratio (uniform arrivals)
    undefined, // sat_flow_veh_h_ln
    seg.full_stop_rate_override, // 0.547 stops/veh
    seg.upstream_intersection_width_ft, // 50 ft
    seg.restrictive_median_length_ft, // 0 ft (undivided)
    seg.proportion_with_curb, // 0.70
    seg.proportion_on_street_parking, // 0.0
    undefined, // prop_opposing_left_accessible
    seg.signal_spacing_ft, // 1,800 ft
    undefined, // free_flow_speed_override_mph
    Float64Array.from(seg.access_point_delays_s),
  ); // [0.193, 0.194] s/veh (Exhibit 30-35)
}

exact(facFull.analyze(), 'C', 'case3 full-geometry facility LOS [Exhibit 16-3]');
approx(facFull.get_base_ffs(), 40.78, 0.01, 'case3 full-geometry facility base FFS [30-36]');
approx(facFull.get_travel_speed(), 23.67, 0.01, 'case3 full-geometry facility travel speed [30-36]');
approx(facFull.get_spatial_stop_rate(), 1.61, 0.02, 'case3 full-geometry facility stop rate [30-36]');
approx(facFull.get_critical_vc_ratio(), 0.52, 0.005, 'case3 full-geometry critical v/c (968/1848) [30-36]');
approx(facFull.get_perception_score(), 2.53, 0.01, 'case3 full-geometry facility perception score [30-36]');
exact(facFull.get_poorest_segment_los(), 'C', 'case3 full-geometry poorest segment LOS');

// The facility must reproduce the standalone segment exactly, since the
// Chapter 16 means over identical segments are identities. This pins the
// sixteen new add_segment argument positions against the WasmUrbanSegment
// constructor mapping checked in ch18_urban_segments.mjs.
const refFull = new m.WasmUrbanSegment(
  s0.segment_length_ft,
  s0.n_through_lanes,
  s0.speed_limit_mph,
  s0.through_demand_veh_h,
  s0.control,
  s0.upstream_intersection_width_ft,
  s0.restrictive_median_length_ft,
  s0.proportion_with_curb,
  s0.proportion_on_street_parking,
  s0.n_access_points_subject,
  s0.n_access_points_opposing,
  undefined,
  s0.signal_spacing_ft,
  undefined,
  s0.midsegment_flow_veh_h,
  s0.through_capacity_veh_h,
  s0.through_control_delay_s,
  s0.cycle_length_s,
  s0.effective_green_s,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  s0.full_stop_rate_override,
  undefined,
  s0.prop_left_turn_lanes,
  Float64Array.from(s0.access_point_delays_s),
);
refFull.analyze();
approx(
  facFull.get_base_ffs(),
  refFull.get_base_ffs(),
  1e-9,
  'case3 full-geometry facility base FFS == segment base FFS',
);
approx(
  facFull.get_travel_speed(),
  refFull.get_travel_speed(),
  1e-9,
  'case3 full-geometry facility travel speed == segment travel speed',
);
approx(
  facFull.get_spatial_stop_rate(),
  refFull.get_spatial_stop_rate(),
  1e-9,
  'case3 full-geometry facility stop rate == segment stop rate',
);

// aggregate() re-runs Chapter 16 Steps 1-4 over measures analyze() already
// produced, so it must be idempotent here.
exact(facFull.aggregate(), 'C', 'case3 full-geometry aggregate() after analyze() is idempotent');
approx(facFull.get_travel_speed(), 23.67, 0.01, 'case3 full-geometry travel speed unchanged by re-aggregation');

// ── add_segment_from_config: the fixture's serde shape loads verbatim ─────
// One call per segment with the raw fixture object, no positional counting.
// Must land exactly where the 31-argument add_segment path lands.
{
  const fx = loadCase('UrbanFacilities', 'case3.json');
  const fac = new m.WasmUrbanFacility(fx.prop_left_turn_lanes);
  for (const seg of fx.segments) fac.add_segment_from_config(seg);
  exact(fac.analyze(), 'C', 'case3 config-object facility LOS');
  approx(fac.get_base_ffs(), 40.78, 0.01, 'case3 config-object base FFS');
  approx(fac.get_travel_speed(), 23.67, 0.01, 'case3 config-object travel speed');
  let threw = false;
  try {
    fac.add_segment_from_config({ segment_length_ft: 'not a number' });
  } catch {
    threw = true;
  }
  exact(threw, true, 'config-object rejects a malformed segment');
}

report(
  'ch16 urban street facilities (HCM Ch.29 EP1 EB+WB summaries + Ch.30 EP1-driven facility + Exhibit 16-3 footnote)',
);
