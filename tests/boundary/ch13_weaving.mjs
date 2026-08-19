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
    console.log(`NOTE  ${label}: skipped, ${getter} is not bound in the middleware yet`);
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

// ===========================================================================
// HCM Edition 7.1
//
// Edition 7.1 replaced Chapter 13 outright, so these are different problems
// against a different model, not the cases above re-run. Expected values and
// tolerances mirror transportations-library/tests/chapter13_v7_1_integration.rs
// and cite the page of the Edition 7.1 Chapter 27 (or 28) extract they come
// from. No fixture files exist for these, so the inputs are literal.
//
// The 7.1 arguments sit at the END of the constructor: nw_rf, nw_fr, nw_rr at
// positions 21-23 and version at 24. build71 does that counting once.
// heavy_vehicle_pct is still a DECIMAL share.
// ===========================================================================

function build71(o) {
  return new m.WasmWeavingSegment(
    o.weaving_type, 'Freeway', o.length_short, o.num_lanes,
    o.num_weaving_lanes ?? 0, o.ffs, o.v_ff, o.v_fr, o.v_rf, o.v_rr, o.phf,
    o.heavy_vehicle_pct, o.terrain ?? 'Level', o.lc_rf ?? 0, o.lc_fr ?? 0,
    o.lc_rr ?? 0, undefined, undefined, undefined, undefined,
    o.nw_rf ?? 0, o.nw_fr ?? 0, o.nw_rr ?? 0, o.version ?? '7.1');
}

// --- Ch.27 EP1 (p. 27-2): LOS of a complex weave. "Complex 0-1" on a
// four-lane urban freeway, L_S = 1,500 ft, FFS = 65 mi/h.
{
  const seg = build71({
    weaving_type: 'OneSided', length_short: 1500.0, num_lanes: 4, ffs: 65.0,
    v_ff: 1815.0, v_fr: 692.0, v_rf: 1037.0, v_rr: 1297.0,
    phf: 0.91, heavy_vehicle_pct: 0.05,
    lc_rf: 0, lc_fr: 1, nw_rf: 2, nw_fr: 1,
  });
  // The constructor takes the edition as a string and falls back to the 7th
  // Edition on anything it does not recognise, silently. Reading it back is
  // the only confirmation that a 7.1 analysis is what will run.
  exact(seg.version, '7.1', 'EP1 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  exact(a.class, 'Complex', 'EP1 7.1 weaving class');
  approx(a.f_hv, 0.952, 0.001, 'EP1 7.1 f_HV (p. 27-3)');
  approx(a.flows.v_ff, 2095.0, 1.0, 'EP1 7.1 v_FF (pc/h, p. 27-3)');
  approx(a.flows.v_fr, 799.0, 1.0, 'EP1 7.1 v_FR (pc/h, p. 27-3)');
  approx(a.flows.v_rf, 1197.0, 1.0, 'EP1 7.1 v_RF (pc/h, p. 27-3)');
  approx(a.flows.v_rr, 1497.0, 1.0, 'EP1 7.1 v_RR (pc/h, p. 27-3)');
  approx(a.flow_per_lane, 1397.0, 1.0, 'EP1 7.1 v/N (pc/h/ln, p. 27-3)');
  approx(a.breakpoint_adj, 1400.0, 1e-9, 'EP1 7.1 BP_adj (pc/h/ln, p. 27-4)');
  approx(a.capacity_basic_adj, 2350.0, 1e-9, 'EP1 7.1 C_b,adj (pc/h/ln, p. 27-4)');
  approx(a.speed_basic, 65.0, 1e-9, 'EP1 7.1 S_b (mi/h, p. 27-4)');
  approx(a.weaving_intensity, 0.006336, 5e-6, 'EP1 7.1 W (p. 27-4)');
  approx(a.speed_impedance, 5.68, 0.02, 'EP1 7.1 SIW (mi/h, p. 27-5)');
  approx(a.speed_avg, 59.32, 0.02, 'EP1 7.1 S_o (mi/h, p. 27-5)');
  approx(a.capacity_per_lane, 1866.0, 2.0, 'EP1 7.1 C_W (pc/h/ln, p. 27-6)');
  approx(a.dc_ratio, 0.75, 0.005, 'EP1 7.1 d/c (p. 27-6)');
  approx(a.density, 23.6, 0.1, 'EP1 7.1 D (pc/mi/ln, p. 27-6)');
  exact(los, 'C', 'EP1 7.1 LOS (Exhibit 13-7)');
  exact(a.los, 'C', 'EP1 7.1 LOS agrees between run_analysis and the result object');

  // Every step method of the 7th Edition procedure is refused on a 7.1
  // segment rather than answering with a number from a model that no longer
  // applies. determine_demand_flow stands in for all eight of them.
  let threw = false;
  try { seg.determine_demand_flow(); } catch { threw = true; }
  exact(threw, true, 'EP1 7.1 segment refuses the 7th Edition step methods');
}

// --- Ch.27 EP2 (p. 27-7): LOS of a simple weave. Demands are already flow
// rates in pc/h, and v/N sits above the breakpoint so S_b comes off the
// curved part of Equation 12-1.
{
  const seg = build71({
    weaving_type: 'OneSided', length_short: 1000.0, num_lanes: 4, ffs: 75.0,
    v_ff: 4000.0, v_fr: 600.0, v_rf: 300.0, v_rr: 100.0,
    phf: 1.00, heavy_vehicle_pct: 0.0,
    // Every simple weave has all four configuration parameters equal to 1.
    lc_rf: 1, lc_fr: 1, nw_rf: 1, nw_fr: 1,
  });
  exact(seg.version, '7.1', 'EP2 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  exact(a.class, 'Simple', 'EP2 7.1 weaving class');
  approx(a.f_hv, 1.0, 1e-9, 'EP2 7.1 f_HV');
  approx(a.flow_total, 5000.0, 1e-9, 'EP2 7.1 v (pc/h, p. 27-8)');
  approx(a.flow_per_lane, 1250.0, 1e-9, 'EP2 7.1 v/N (pc/h/ln, p. 27-8)');
  approx(a.breakpoint_adj, 1000.0, 1e-9, 'EP2 7.1 BP_adj (pc/h/ln, p. 27-8)');
  // 2,200 + 10(75 - 50) = 2,450, which the Exhibit 12-4 maximum caps at 2,400.
  // The cap is what the manual prints and what has to cross the boundary.
  approx(a.capacity_basic_adj, 2400.0, 1e-9, 'EP2 7.1 C_b,adj is the Exhibit 12-4 cap, not 2,450 (p. 27-8)');
  approx(a.speed_basic, 74.31, 0.01, 'EP2 7.1 S_b (mi/h, p. 27-9)');
  approx(a.weaving_intensity, 0.004814, 5e-6, 'EP2 7.1 W (p. 27-9)');
  approx(a.speed_impedance, 3.61, 0.01, 'EP2 7.1 SIW (mi/h, p. 27-9)');
  approx(a.speed_avg, 70.70, 0.01, 'EP2 7.1 S_o (mi/h, p. 27-9)');
  approx(a.capacity_per_lane, 1992.0, 2.0, 'EP2 7.1 C_W (pc/h/ln, p. 27-10)');
  approx(a.dc_ratio, 0.63, 0.005, 'EP2 7.1 d/c (p. 27-10)');
  approx(a.density, 17.7, 0.05, 'EP2 7.1 D (pc/mi/ln, p. 27-10)');
  exact(los, 'B', 'EP2 7.1 LOS (Exhibit 13-7)');
}

// --- Ch.27 EP3 (p. 27-11): LOS of a two-sided weaving segment. Only the
// ramp-to-ramp flow weaves, and its configuration reduces to the simplified
// Equation 13-14.
{
  const seg = build71({
    weaving_type: 'TwoSided', length_short: 750.0, num_lanes: 3, ffs: 60.0,
    v_ff: 3500.0, v_fr: 250.0, v_rf: 100.0, v_rr: 300.0,
    phf: 0.94, heavy_vehicle_pct: 0.11, terrain: 'Rolling',
    lc_rr: 2, nw_rr: 0,
  });
  exact(seg.version, '7.1', 'EP3 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  exact(a.class, 'TwoSided', 'EP3 7.1 weaving class');
  approx(a.f_hv, 0.82, 0.001, 'EP3 7.1 f_HV (p. 27-12)');
  approx(a.flows.v_ff, 4541.0, 2.0, 'EP3 7.1 v_FF (pc/h, p. 27-12)');
  approx(a.flows.v_fr, 324.0, 1.0, 'EP3 7.1 v_FR (pc/h, p. 27-12)');
  approx(a.flows.v_rf, 130.0, 1.0, 'EP3 7.1 v_RF (pc/h, p. 27-12)');
  approx(a.flows.v_rr, 389.0, 1.0, 'EP3 7.1 v_RR (pc/h, p. 27-12)');
  approx(a.flow_per_lane, 1795.0, 1.0, 'EP3 7.1 v/N (pc/h/ln, p. 27-12)');
  approx(a.breakpoint_adj, 1600.0, 1e-9, 'EP3 7.1 BP_adj (pc/h/ln, p. 27-13)');
  approx(a.capacity_basic_adj, 2300.0, 1e-9, 'EP3 7.1 C_b,adj (pc/h/ln, p. 27-13)');
  approx(a.speed_basic, 59.31, 0.02, 'EP3 7.1 S_b (mi/h, p. 27-13)');
  approx(a.weaving_intensity, 0.005199, 5e-6, 'EP3 7.1 W (p. 27-14)');
  approx(a.speed_impedance, 6.73, 0.02, 'EP3 7.1 SIW (mi/h, p. 27-14)');
  approx(a.speed_avg, 52.58, 0.03, 'EP3 7.1 S_o (mi/h, p. 27-14)');
  approx(a.capacity_per_lane, 1827.0, 3.0, 'EP3 7.1 C_W (pc/h/ln, p. 27-15)');
  approx(a.dc_ratio, 0.98, 0.005, 'EP3 7.1 d/c (p. 27-15)');
  approx(a.density, 34.1, 0.1, 'EP3 7.1 D (pc/mi/ln, p. 27-15)');
  exact(los, 'E', 'EP3 7.1 LOS (Exhibit 13-7)');
}

// --- Ch.27 EP4 Trial 1 (Exhibit 27-9, p. 27-17): design of a complex weave.
// Five entry lanes connected straight through to five exit lanes, so the
// freeway-to-ramp movement needs two lane changes. "Complex 0-2".
// The manual skips Step 4 here, so it prints no capacity and none is checked.
{
  const seg = build71({
    weaving_type: 'OneSided', length_short: 1320.0, num_lanes: 5, ffs: 60.0,
    v_ff: 2000.0, v_fr: 1450.0, v_rf: 1500.0, v_rr: 1750.0,
    phf: 1.00, heavy_vehicle_pct: 0.0,
    lc_rf: 0, lc_fr: 2, nw_rf: 2, nw_fr: 0,
  });
  exact(seg.version, '7.1', 'EP4-T1 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  exact(a.class, 'Complex', 'EP4-T1 weaving class');
  approx(a.flow_total, 6700.0, 1e-9, 'EP4-T1 v (pc/h, p. 27-17)');
  approx(a.flow_per_lane, 1340.0, 1e-9, 'EP4-T1 v/N (pc/h/ln, p. 27-17)');
  approx(a.breakpoint_adj, 1600.0, 1e-9, 'EP4-T1 BP_adj (pc/h/ln, p. 27-18)');
  approx(a.capacity_basic_adj, 2300.0, 1e-9, 'EP4-T1 C_b,adj (pc/h/ln, p. 27-18)');
  // The manual's prose on p. 27-18 says "the FFS of 65 mi/h" for a problem
  // whose FFS is 60, and then uses 60 in the arithmetic on p. 27-19.
  // Recorded in transportations-library docs/hcm/VERIFICATION.md.
  approx(a.speed_basic, 60.0, 1e-9, 'EP4-T1 S_b (mi/h, p. 27-19)');
  approx(a.weaving_intensity, 0.008040, 5e-6, 'EP4-T1 W (p. 27-18)');
  approx(a.speed_impedance, 6.75, 0.01, 'EP4-T1 SIW (mi/h, p. 27-19)');
  approx(a.speed_avg, 53.25, 0.01, 'EP4-T1 S_o (mi/h, p. 27-19)');
  approx(a.density, 25.2, 0.05, 'EP4-T1 D (pc/mi/ln, p. 27-19)');
  exact(los, 'D', 'EP4-T1 LOS (Exhibit 13-7)');
}

// --- Ch.27 EP4 Trial 2 (Exhibit 27-10, p. 27-19): the same segment after a
// lane is added to the exit-ramp leg, dropping LC_FR to 1 and raising NW_FR
// to 1. "Complex 0-1", and the design that reaches the target LOS C.
{
  const seg = build71({
    weaving_type: 'OneSided', length_short: 1320.0, num_lanes: 5, ffs: 60.0,
    v_ff: 2000.0, v_fr: 1450.0, v_rf: 1500.0, v_rr: 1750.0,
    phf: 1.00, heavy_vehicle_pct: 0.0,
    lc_rf: 0, lc_fr: 1, nw_rf: 2, nw_fr: 1,
  });
  exact(seg.version, '7.1', 'EP4-T2 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  approx(a.flow_per_lane, 1340.0, 1e-9, 'EP4-T2 v/N (pc/h/ln, p. 27-19)');
  approx(a.speed_basic, 60.0, 1e-9, 'EP4-T2 S_b (mi/h, p. 27-19)');
  approx(a.weaving_intensity, 0.006701, 5e-6, 'EP4-T2 W (p. 27-19)');
  approx(a.speed_impedance, 5.63, 0.01, 'EP4-T2 SIW (mi/h, p. 27-19)');
  approx(a.speed_avg, 54.37, 0.01, 'EP4-T2 S_o (mi/h, p. 27-19)');
  approx(a.density, 24.6, 0.05, 'EP4-T2 D (pc/mi/ln, p. 27-20)');
  // The manual's Trial 2 cites Equation 13-22 and Exhibit 13-6 here and heads
  // the step "Trial 1". The right citations are Equation 13-21 and Exhibit
  // 13-7, which is the table this letter comes from.
  exact(los, 'C', 'EP4-T2 LOS (Exhibit 13-7)');
}

// --- Ch.28 EP3 discussion (p. 28-16): the merge/diverge pair of Chapter 28's
// Example Problem 3 re-analyzed as a weaving segment, formed by connecting
// the two ramps with an auxiliary lane. A Chapter 13 problem printed in the
// Chapter 28 text, and the only published 7.1 simple weave that also prints a
// weaving capacity from Equation 13-16.
{
  const seg = build71({
    weaving_type: 'OneSided', length_short: 1300.0, num_lanes: 5, ffs: 65.0,
    // Flow rates carried over from EP3's Step 1. v_RR is set to zero as the
    // most conservative assumption (p. 28-16).
    v_ff: 5723.0, v_fr: 702.0, v_rf: 458.0, v_rr: 0.0,
    phf: 1.00, heavy_vehicle_pct: 0.0,
    lc_rf: 1, lc_fr: 1, nw_rf: 1, nw_fr: 1,
  });
  exact(seg.version, '7.1', 'EP3-aux 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  exact(a.class, 'Simple', 'EP3-aux weaving class');
  approx(a.flow_total, 6883.0, 1e-9, 'EP3-aux v (pc/h, p. 28-16)');
  approx(a.flow_per_lane, 1377.0, 1.0, 'EP3-aux v/N (pc/h/ln, p. 28-17)');
  approx(a.breakpoint_adj, 1400.0, 1e-9, 'EP3-aux BP_adj (pc/h/ln, p. 28-13)');
  approx(a.capacity_basic_adj, 2350.0, 1e-9, 'EP3-aux C_b,adj (pc/h/ln, p. 28-13)');
  approx(a.speed_basic, 65.0, 1e-9, 'EP3-aux S_b (mi/h, p. 28-17)');
  approx(a.weaving_intensity, 0.004546, 5e-6, 'EP3-aux W (p. 28-17)');
  approx(a.speed_impedance, 3.99, 0.01, 'EP3-aux SIW (mi/h, p. 28-17)');
  approx(a.speed_avg, 61.01, 0.01, 'EP3-aux S_o (mi/h, p. 28-17)');
  approx(a.capacity_per_lane, 1917.0, 2.0, 'EP3-aux C_W (pc/h/ln, p. 28-18)');
  approx(a.dc_ratio, 0.72, 0.005, 'EP3-aux d/c (p. 28-18)');
  approx(a.density, 22.6, 0.05, 'EP3-aux D (pc/mi/ln, p. 28-18)');
  exact(los, 'C', 'EP3-aux LOS (Exhibit 13-7)');
}

// --- Edition selection is a string, and a wrong one is silent.
{
  const shared = {
    weaving_type: 'OneSided', length_short: 1500.0, num_lanes: 4, ffs: 65.0,
    v_ff: 1815.0, v_fr: 692.0, v_rf: 1037.0, v_rr: 1297.0,
    phf: 0.91, heavy_vehicle_pct: 0.05,
    lc_rf: 0, lc_fr: 1, nw_rf: 2, nw_fr: 1, num_weaving_lanes: 2,
  };
  // The parser accepts a documented set of spellings. These four are the ones
  // the page and the fixtures use, and they must keep resolving to 7.1.
  for (const good of ['7.1', 'v7.1', 'HCM 7.1', 'hcm_7.1']) {
    const seg = build71({ ...shared, version: good });
    exact(seg.version, '7.1', `a version of ${JSON.stringify(good)} is Edition 7.1`);
  }

  // Anything the binding does not recognise becomes the 7th Edition, with no
  // error and no warning, because the constructor cannot fail. The two
  // editions are different models, so a typo in this one string silently
  // changes which methodology answers. The `version` SETTER throws on the
  // same input; only this positional argument swallows it.
  for (const bad of ['7.1.0', '71', '7,1', '', 'seven point one']) {
    const seg = build71({ ...shared, version: bad });
    exact(seg.version, '7', `a version of ${JSON.stringify(bad)} falls back to the 7th Edition`);
    seg.run_analysis();
    exact(seg.analysis_v7_1() == null, true, `and stores no 7.1 result for ${JSON.stringify(bad)}`);

    // Same string through the setter, which validates.
    let threw = false;
    try { build71({ ...shared }).version = bad; } catch { threw = true; }
    exact(threw, true, `but the version setter rejects ${JSON.stringify(bad)}`);
  }

  // The good path, for contrast: the same segment under each edition answers
  // differently, which is what makes the fallback worth pinning.
  const v71 = build71({ ...shared });
  v71.run_analysis();
  const v7 = build71({ ...shared, version: '7' });
  v7.run_analysis();
  exact(v7.analysis_v7_1() == null, true, 'a 7th Edition segment stores no 7.1 result');
  exact(Math.abs(v7.get_density() - v71.get_density()) > 1.0, true,
    'the two editions do not agree by accident on the same segment');
}

// --- Exhibit 13-7 density thresholds, read at the boundary rather than from
// the source. Demands on one simple weave are scaled until the letter flips,
// and the crossing density is the band edge. The bands are closed at the top
// (LOS A is D <= 11), so the flip density is the edge itself.
{
  const scaled = (k) => {
    const seg = build71({
      weaving_type: 'OneSided', length_short: 1500.0, num_lanes: 4, ffs: 65.0,
      v_ff: 3000 * k, v_fr: 500 * k, v_rf: 400 * k, v_rr: 100 * k,
      phf: 1.00, heavy_vehicle_pct: 0.0,
      lc_rf: 1, lc_fr: 1, nw_rf: 1, nw_fr: 1,
    });
    seg.run_analysis();
    return seg.analysis_v7_1();
  };
  const rank = (l) => 'ABCDEF'.indexOf(l);
  const crossing = (letter) => {
    let lo = 0.05, hi = 3.0;
    for (let i = 0; i < 60; i += 1) {
      const mid = (lo + hi) / 2;
      if (rank(scaled(mid).los) <= rank(letter)) lo = mid; else hi = mid;
    }
    return scaled(lo);
  };
  for (const [letter, edge] of [['A', 11.0], ['B', 18.0], ['C', 25.0], ['D', 30.0], ['E', 35.0]]) {
    const a = crossing(letter);
    approx(a.density, edge, 1e-3, `Exhibit 13-7: LOS ${letter} reaches D = ${edge} pc/mi/ln`);
    exact(a.los, letter, `Exhibit 13-7: D = ${edge} is still LOS ${letter}`);
  }
}

// --- LOS F and the absent speed. Past capacity the speed impedance can
// consume the whole basic-segment speed, and the result carries no average
// speed rather than a negative one.
{
  // Short segment, heavy weaving in both directions: d/c > 1 with a finite
  // speed still left.
  const overCapacity = build71({
    weaving_type: 'OneSided', length_short: 300.0, num_lanes: 4, ffs: 65.0,
    v_ff: 1500.0, v_fr: 1500.0, v_rf: 1500.0, v_rr: 1500.0,
    phf: 1.00, heavy_vehicle_pct: 0.0,
    lc_rf: 3, lc_fr: 3, nw_rf: 1, nw_fr: 1,
  });
  exact(overCapacity.run_analysis(), 'F', 'a segment past capacity is LOS F');
  const oc = overCapacity.analysis_v7_1();
  exact(oc.dc_ratio > 1.0, true, 'and reports d/c above 1');
  exact(oc.demand_exceeds_capacity, true, 'and flags demand_exceeds_capacity');
  // The two LOS F triggers cannot be separated at this boundary: a per-lane
  // capacity is at most C_b,adj and the average speed at most the FFS, so any
  // d/c above 1 already puts density past the 35 pc/mi/ln threshold. Recorded
  // here so a later reader does not go looking for a case that splits them.
  exact(oc.density > 35.0, true, 'd/c above 1 always comes with D past 35 pc/mi/ln');

  // Further past capacity, S_o is gone. serde_wasm_bindgen crosses Rust's
  // Option::None as `undefined`, NOT `null`, so a consumer testing
  // `speed_avg === null` before rendering prints the absent case as a number.
  const noSpeed = build71({
    weaving_type: 'OneSided', length_short: 300.0, num_lanes: 4, ffs: 65.0,
    v_ff: 2000.0, v_fr: 2000.0, v_rf: 2000.0, v_rr: 2000.0,
    phf: 1.00, heavy_vehicle_pct: 0.0,
    lc_rf: 3, lc_fr: 3, nw_rf: 1, nw_fr: 1,
  });
  exact(noSpeed.run_analysis(), 'F', 'a segment far past capacity is LOS F');
  const ns = noSpeed.analysis_v7_1();
  exact(typeof ns.speed_avg, 'undefined', 'an absent S_o crosses as undefined, not null');
  exact(ns.speed_avg === null, false, 'and a === null guard would not fire on it');
  exact(ns.density, 'Infinity', 'with no speed, density is infinite rather than a plausible number');
}

report('ch13 weaving (HCM Ch.27 EP1-EP3 7e, EP1-EP4 + Ch.28 EP3 aux lane 7.1)');
