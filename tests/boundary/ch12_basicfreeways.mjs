// HCM Chapter 12 basic freeway segments through the WASM boundary, run against
// HCM Chapter 26 Example Problems 1-3. Expected values and tolerances mirror
// transportations-library/tests/chapter12_integration.rs (rounded-equality
// asserts there become +-0.05 / +-0.5 tolerances here).
//
// Constructor order under test: (bffs, lane_width, lane_count, lc_r, lc_l,
// trd, apd, grade, terrain_type, speed_limit, phf, p_t, demand_flow_i,
// length, highway_type, city_type). p_t is a DECIMAL share (0.05), matching
// the fixture and the Rust struct.
//
// History note (the f_HV defect, fixed): the binding once left the core's
// then-default sut_percentage of 50, routing f_HV through the sparse SUT
// table and silently degrading to 1/(1 - p_t) off-grid (EP1 printed LOS B
// against the published C). The core now defaults sut_percentage to 0
// (general-terrain Exhibit 12-25 E_T), the constructor exposes
// sut_percentage and e_t, and off-grid SUT mixes error naming Exhibits
// 12-26..12-28. The demand/density/LOS checks below assert the published
// values on the corrected path.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

function build(c, laneCount) {
  return new m.WasmBasicFreeways(
    c.bffs, c.lw, laneCount ?? c.lane_count, c.lc_r, c.lc_l, c.trd, c.apd,
    c.grade, c.terrain_type, c.speed_limit, c.phf, c.p_t, c.demand_flow_i,
    c.length, c.highway_type, c.city_type);
}

// get_demand_volume() is a new binding getter (v_p, pc/h/ln); until the pkg
// is rebuilt it is absent and those checks are skipped with a note.
function checkDemandVolume(seg, expected, label) {
  if (typeof seg.get_demand_volume === 'function') {
    approx(seg.get_demand_volume(), expected, 0.5, label);
  } else {
    console.log(`NOTE  ${label}: skipped, get_demand_volume is not bound in the middleware yet`);
  }
}

// --- HCM Ch.26 Example Problem 1: four-lane freeway LOS (2 lanes/direction).
// BFFS 75.4, 11-ft lanes, 2-ft right clearance, TRD 4/mi, V = 2,000 veh/h,
// PHF 0.92, 5% trucks (E_T = 2.0, level terrain).
const c1 = loadCase('BasicFreeways', 'case1.json');
const ep1 = build(c1);
const los1 = ep1.run_operational_analysis();
approx(ep1.get_ffs(), 60.8, 0.05, 'EP1 FFS (mi/h)');
approx(ep1.get_capacity(), 2308.0, 0.5, 'EP1 capacity (pc/h/ln), Eq. 12-6');
checkDemandVolume(ep1, 1142.0, 'EP1 demand flow v_p (pc/h/ln), Eq. 12-9');
// Below the breakpoint, S = FFS (Equation 12-1).
approx(ep1.get_speed(), 60.8, 0.1, 'EP1 speed (mi/h), Eq. 12-1');
approx(ep1.get_density(), 18.8, 0.05, 'EP1 density (pc/mi/ln), Eq. 12-11');
exact(los1, 'C', 'EP1 LOS (Exhibit 12-15)');

// --- HCM Ch.26 Example Problem 2: number of lanes for a target LOS, then the
// 3-lane operational continuation. The lane-count design step
// (estimate_number_of_lanes -> 3 lanes) is NOT exposed by the WASM binding,
// so this constructs the published 3-lane answer directly and checks the
// operational results the Rust test asserts after that step.
const c2 = loadCase('BasicFreeways', 'case2.json');
const ep2 = build(c2, 3);
const los2 = ep2.run_operational_analysis();
approx(ep2.get_ffs(), 67.3, 0.05, 'EP2 FFS (mi/h)');
approx(ep2.get_capacity(), 2373.0, 0.5, 'EP2 capacity (pc/h/ln), Eq. 12-6');
checkDemandVolume(ep2, 1694.0, 'EP2 demand flow v_p (pc/h/ln), Eq. 12-9');
approx(ep2.get_speed(), 65.4, 0.1, 'EP2 speed (mi/h), Eq. 12-1');
approx(ep2.get_density(), 25.9, 0.05, 'EP2 density (pc/mi/ln), Eq. 12-11');
exact(los2, 'C', 'EP2 LOS (Exhibit 12-15)');

// --- HCM Ch.26 Example Problem 3: six-lane freeway LOS and speed
// (3 lanes/direction), FFS given as 70 mi/h, rolling terrain (E_T = 3.0),
// V = 5,000 veh/h, PHF 0.96, 4% trucks.
const c3 = loadCase('BasicFreeways', 'case3.json');
const ep3 = build(c3);
const los3 = ep3.run_operational_analysis();
approx(ep3.get_ffs(), 70.0, 0.05, 'EP3 FFS (mi/h)');
approx(ep3.get_capacity(), 2400.0, 0.5, 'EP3 capacity (pc/h/ln), Eq. 12-6 cap');
checkDemandVolume(ep3, 1875.0, 'EP3 demand flow v_p (pc/h/ln), Eq. 12-9');
approx(ep3.get_speed(), 64.7, 0.1, 'EP3 speed (mi/h), Eq. 12-1');
approx(ep3.get_density(), 29.0, 0.05, 'EP3 density (pc/mi/ln), Eq. 12-11');
exact(los3, 'D', 'EP3 LOS (Exhibit 12-15)');

report('ch12 basic freeways (HCM Ch.26 EP1-EP3)');
