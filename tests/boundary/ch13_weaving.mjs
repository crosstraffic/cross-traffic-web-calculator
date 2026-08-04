// HCM Chapter 13 freeway weaving segments through the WASM boundary, run
// against HCM Chapter 27 Example Problems 1-3. Expected values and tolerances
// mirror transportations-library/tests/chapter13_integration.rs.
//
// Constructor order under test: (weaving_type, facility_type, length_short,
// num_lanes, num_weaving_lanes, ffs, v_ff, v_fr, v_rf, v_rr, phf,
// heavy_vehicle_pct, terrain, lc_rf, lc_fr, lc_rr, interchange_density,
// basic_freeway_capacity, caf, saf). heavy_vehicle_pct is a DECIMAL share
// (0.05 = 5%), matching the fixture and the Rust struct.
//
// get_c_iwl / get_capacity_weaving / get_lc_w / get_lc_nw are new binding
// getters; until the pkg is rebuilt they are absent and those checks are
// skipped with a NOTE.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

function build(c) {
  return new m.WasmWeavingSegment(
    c.weaving_type, c.facility_type, c.length_short, c.num_lanes,
    c.num_weaving_lanes, c.ffs, c.v_ff, c.v_fr, c.v_rf, c.v_rr, c.phf,
    c.heavy_vehicle_pct, c.terrain, c.lc_rf, c.lc_fr, c.lc_rr,
    c.interchange_density, c.basic_freeway_capacity, c.caf, c.saf);
}

function optCheck(seg, getter, fn, label) {
  if (typeof seg[getter] === 'function') {
    fn(seg[getter]());
  } else {
    console.log(`NOTE  ${label}: skipped, ${getter} needs a pkg rebuild`);
  }
}

// --- HCM Ch.27 Example Problem 1: LOS of a major weaving segment.
// One-sided major weave, L_S = 1,500 ft, N = 4, N_WL = 3, FFS = 65 mi/h.
{
  const c = loadCase('Weaving', 'case1.json');
  const seg = build(c);
  const los = seg.run_analysis();

  // Step 2 (Equation 13-1): component flows and aggregates
  approx(seg.get_flow_weaving(), 1995.0, 5.0, 'EP1 v_W (pc/h)');
  approx(seg.get_flow_nonweaving(), 3591.0, 5.0, 'EP1 v_NW (pc/h)');
  approx(seg.get_flow_total(), 5586.0, 5.0, 'EP1 v (pc/h)');
  approx(seg.get_volume_ratio(), 0.357, 0.002, 'EP1 VR');

  // Step 3 (Equation 13-2)
  approx(seg.get_lc_min(), 798.0, 5.0, 'EP1 LC_MIN (lc/h)');

  // Step 4 (Equation 13-4)
  approx(seg.get_l_max(), 4639.0, 5.0, 'EP1 L_MAX (ft)');
  exact(seg.is_weaving(), true, 'EP1 operates as a weaving segment');

  // Step 5 (Equations 13-5 through 13-9): capacity governed by density
  optCheck(seg, 'get_c_iwl', v => approx(v, 2110.0, 5.0, 'EP1 c_IWL (pc/h/ln)'), 'EP1 c_IWL (pc/h/ln)');
  approx(seg.get_capacity(), 8038.0, 10.0, 'EP1 c_W (veh/h)');

  // Step 6 (Equations 13-11 through 13-17)
  optCheck(seg, 'get_lc_w', v => approx(v, 1144.0, 5.0, 'EP1 LC_W (lc/h)'), 'EP1 LC_W (lc/h)');
  optCheck(seg, 'get_lc_nw', v => approx(v, 782.0, 5.0, 'EP1 LC_NW (lc/h)'), 'EP1 LC_NW (lc/h)');
  approx(seg.get_lc_all(), 1926.0, 8.0, 'EP1 LC_ALL (lc/h)');

  // Step 7 (Equations 13-19 through 13-22)
  approx(seg.get_speed_weaving(), 54.2, 0.5, 'EP1 S_W (mi/h)');
  approx(seg.get_speed_nonweaving(), 52.5, 0.5, 'EP1 S_NW (mi/h)');
  approx(seg.get_speed_avg(), 53.1, 0.5, 'EP1 S (mi/h)');

  // Step 8 (Equation 13-23, Exhibit 13-6)
  approx(seg.get_density(), 26.3, 0.5, 'EP1 D (pc/mi/ln)');
  exact(los, 'C', 'EP1 LOS');
}

// --- HCM Ch.27 Example Problem 2: LOS for a ramp weave.
// One-sided ramp weave, L_S = 1,000 ft, N = 4, N_WL = 2, FFS = 75 mi/h,
// demands already in pc/h (PHF = 1.00, no heavy vehicles).
{
  const c = loadCase('Weaving', 'case2.json');
  const seg = build(c);
  const los = seg.run_analysis();

  approx(seg.get_flow_weaving(), 900.0, 1.0, 'EP2 v_W (pc/h)');
  approx(seg.get_flow_nonweaving(), 4100.0, 1.0, 'EP2 v_NW (pc/h)');
  approx(seg.get_flow_total(), 5000.0, 1.0, 'EP2 v (pc/h)');
  approx(seg.get_volume_ratio(), 0.180, 0.001, 'EP2 VR');

  approx(seg.get_lc_min(), 900.0, 1.0, 'EP2 LC_MIN (lc/h)');
  approx(seg.get_l_max(), 4333.0, 5.0, 'EP2 L_MAX (ft)');
  exact(seg.is_weaving(), true, 'EP2 operates as a weaving segment');

  optCheck(seg, 'get_c_iwl', v => approx(v, 2145.0, 5.0, 'EP2 c_IWL (pc/h/ln)'), 'EP2 c_IWL (pc/h/ln)');
  approx(seg.get_capacity(), 8580.0, 10.0, 'EP2 c_W (pc/h)');
  // Weaving-flow criterion (Equations 13-7/13-8): 2,400/0.18 = 13,333 pc/h
  optCheck(seg, 'get_capacity_weaving',
    v => approx(v, 13333.0, 15.0, 'EP2 c_W weaving (pc/h)'), 'EP2 c_W weaving (pc/h)');

  optCheck(seg, 'get_lc_w', v => approx(v, 1187.0, 5.0, 'EP2 LC_W (lc/h)'), 'EP2 LC_W (lc/h)');
  optCheck(seg, 'get_lc_nw', v => approx(v, 616.0, 5.0, 'EP2 LC_NW (lc/h)'), 'EP2 LC_NW (lc/h)');
  approx(seg.get_lc_all(), 1803.0, 8.0, 'EP2 LC_ALL (lc/h)');

  approx(seg.get_speed_weaving(), 59.1, 0.5, 'EP2 S_W (mi/h)');
  approx(seg.get_speed_nonweaving(), 62.5, 0.5, 'EP2 S_NW (mi/h)');
  approx(seg.get_speed_avg(), 61.9, 0.5, 'EP2 S (mi/h)');

  approx(seg.get_density(), 20.2, 0.5, 'EP2 D (pc/mi/ln)');
  exact(los, 'C', 'EP2 LOS');
}

// --- HCM Ch.27 Example Problem 3: LOS of a two-sided weaving segment.
// L_S = 750 ft, N = 3, N_WL = 0, FFS = 60 mi/h, rolling terrain.
// The published solution carries a slightly inconsistent nonweaving flow
// (5,015 vs. 4,995 pc/h) into Equations 13-12/13-13, so lane-change-rate
// tolerances are widened to +-10 lc/h for this case (as in the Rust test).
{
  const c = loadCase('Weaving', 'case3.json');
  const seg = build(c);
  const los = seg.run_analysis();

  approx(seg.get_flow_weaving(), 389.0, 2.0, 'EP3 v_W (pc/h)');
  approx(seg.get_flow_nonweaving(), 4995.0, 5.0, 'EP3 v_NW (pc/h)');
  approx(seg.get_flow_total(), 5384.0, 5.0, 'EP3 v (pc/h)');
  approx(seg.get_volume_ratio(), 0.072, 0.001, 'EP3 VR');

  // Two-sided: LC_MIN = LC_RR x v_RR (Equation 13-3)
  approx(seg.get_lc_min(), 778.0, 4.0, 'EP3 LC_MIN (lc/h)');
  approx(seg.get_l_max(), 6405.0, 5.0, 'EP3 L_MAX (ft)');
  exact(seg.is_weaving(), true, 'EP3 operates as a weaving segment');

  optCheck(seg, 'get_c_iwl', v => approx(v, 1867.0, 5.0, 'EP3 c_IWL (pc/h/ln)'), 'EP3 c_IWL (pc/h/ln)');
  approx(seg.get_capacity(), 4593.0, 10.0, 'EP3 c_W (veh/h)');
  // Two-sided segments have no weaving-flow capacity limit
  optCheck(seg, 'get_capacity_weaving',
    v => exact(v, undefined, 'EP3 c_W weaving is None (two-sided)'), 'EP3 c_W weaving is None (two-sided)');

  optCheck(seg, 'get_lc_w', v => approx(v, 960.0, 10.0, 'EP3 LC_W (lc/h)'), 'EP3 LC_W (lc/h)');
  optCheck(seg, 'get_lc_nw', v => approx(v, 861.0, 10.0, 'EP3 LC_NW (lc/h)'), 'EP3 LC_NW (lc/h)');
  approx(seg.get_lc_all(), 1821.0, 15.0, 'EP3 LC_ALL (lc/h)');

  approx(seg.get_speed_weaving(), 45.9, 0.5, 'EP3 S_W (mi/h)');
  approx(seg.get_speed_nonweaving(), 45.8, 0.5, 'EP3 S_NW (mi/h)');
  approx(seg.get_speed_avg(), 45.8, 0.5, 'EP3 S (mi/h)');

  approx(seg.get_density(), 39.2, 0.5, 'EP3 D (pc/mi/ln)');
  exact(los, 'E', 'EP3 LOS');
}

report('ch13 weaving (HCM Ch.27 EP1-EP3)');
