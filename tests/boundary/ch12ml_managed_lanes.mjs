// HCM Chapter 12 Section 4 basic managed lane segments through the WASM
// boundary. There is NO published example problem for managed lanes in the
// transportations-library integration suite (chapter12_integration.rs covers
// basic segments only), so this file mirrors the unit tests in
// src/hcm/chapter12/managed_lanes.rs and checks the published Exhibit 12-30
// parameters and Exhibit 12-11 capacities through Equations 12-13/12-14
// (with CAF = SAF = 1, Eq. 12-14 reproduces Exhibit 12-11 exactly).
//
// Constructor order under test: (lane_type, ffs, demand, gp_density, caf, saf).
import { loadWasm, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

// --- Exhibit 12-30 anchors at FFS = 75 mi/h: c_adj = c_75 and BP = BP_75.
// (Mirrors test_continuous_access_params: bp_75 = 500, c_75 = 1800 for
// continuous access; extended to the other four published rows.)
const anchors = [
  // [lane_type, c_75 (pc/h/ln), BP_75 (pc/h/ln)]
  ['continuous_access', 1800, 500],
  ['buffer1', 1700, 600],
  ['buffer2', 1850, 500],
  ['barrier1', 1750, 800],
  ['barrier2', 2100, 700],
];
for (const [type, c75, bp75] of anchors) {
  const seg = new m.WasmManagedLanes(type, 75.0);
  approx(seg.calculate_capacity(), c75, 1e-9, `${type} c_75 (Exhibit 12-30, Eq. 12-14)`);
  approx(seg.calculate_breakpoint(), bp75, 1e-9, `${type} BP_75 (Exhibit 12-30, Eq. 12-13)`);
}

// --- Exhibit 12-11 estimated lane capacities (pc/h/ln) at FFS 70/65/60/55,
// mirroring get_estimated_capacity() in managed_lanes.rs.
const exhibit12_11 = {
  continuous_access: { 70: 1750, 65: 1700, 60: 1650, 55: 1600 },
  buffer1: { 70: 1650, 65: 1600, 60: 1550, 55: 1500 },
  buffer2: { 70: 1800, 65: 1750, 60: 1700, 55: 1650 },
  barrier1: { 70: 1700, 65: 1650, 60: 1600, 55: 1550 },
  barrier2: { 70: 2050, 65: 2000, 60: 1950, 55: 1900 },
};
for (const [type, byFfs] of Object.entries(exhibit12_11)) {
  for (const [ffs, cap] of Object.entries(byFfs)) {
    const seg = new m.WasmManagedLanes(type, Number(ffs));
    approx(seg.calculate_capacity(), cap, 1e-9, `${type} capacity at FFS ${ffs} (Exhibit 12-11)`);
  }
}

// --- Breakpoint lambda_BP application (Eq. 12-13 with Exhibit 12-30 rates):
// Buffer2 (lambda_BP = 10): BP = 500 + 10 x (75 - 65) = 600 at FFS 65.
// Barrier2 (lambda_BP = 20): BP = 700 + 20 x (75 - 60) = 1000 at FFS 60.
approx(new m.WasmManagedLanes('buffer2', 65.0).calculate_breakpoint(), 600, 1e-9,
  'buffer2 BP at FFS 65 (Eq. 12-13)');
approx(new m.WasmManagedLanes('barrier2', 60.0).calculate_breakpoint(), 1000, 1e-9,
  'barrier2 BP at FFS 60 (Eq. 12-13)');

// --- CAF argument position (Eq. 12-13 squares CAF, Eq. 12-14 is linear):
// continuous access, FFS 75, CAF 0.9 -> c_adj = 0.9 x 1800 = 1620 and
// BP = 500 x 0.81 = 405. A caf/saf swap in the binding would break both.
const cafSeg = new m.WasmManagedLanes('continuous_access', 75.0, undefined, undefined, 0.9, 1.0);
approx(cafSeg.calculate_capacity(), 1620, 1e-9, 'CAF=0.9 capacity (Eq. 12-14)');
approx(cafSeg.calculate_breakpoint(), 405, 1e-9, 'CAF=0.9 breakpoint (Eq. 12-13, CAF^2)');

// --- Friction behavior (Exhibit 12-30 note, Eq. 12-18), mirroring
// test_barrier_no_friction and test_continuous_access_friction. gp_density
// is passed through the constructor (4th arg) to exercise its position.
exact(new m.WasmManagedLanes('barrier2', 70.0).has_friction_effect(), false,
  'barrier2 has no friction effect');
exact(new m.WasmManagedLanes('buffer1', 70.0).has_friction_effect(), true,
  'buffer1 has friction effect (K_cf defined)');
const fric = new m.WasmManagedLanes('continuous_access', 70.0, undefined, 40.0);
exact(fric.has_friction_effect(), true, 'continuous access has friction effect');
exact(fric.is_friction_active(), true, 'friction active at K_GP = 40 > 35 (Eq. 12-18)');
exact(new m.WasmManagedLanes('continuous_access', 70.0, undefined, 30.0).is_friction_active(),
  false, 'friction inactive at K_GP = 30 <= 35 (Eq. 12-18)');

// --- Chapter 26, Example Problem 7: basic managed lane segment ----------
// Continuous access, FFS 60, PHF 0.92, 7.5% trucks level terrain
// (f_HV = 0.93), ML demand 1,300 veh/h -> 1,519 pc/h/ln. Mirrors the core
// test in transportations-library/tests/chapter12_integration.rs. The
// example's Step 4 prose says 5% trucks; its own Equation 12-10
// substitution and printed flow rates use 7.5%.
{
  const fHv = 1 / (1 + 0.075 * (2.0 - 1.0));
  const vpMl = 1300 / (0.92 * 1 * fHv);
  approx(vpMl, 1519, 1.0, 'EP7 ML flow rate (Eq. 12-9)');

  // Case 1: GP density 1,169/60 = 19.5 pc/mi/ln, under the 35 threshold, so
  // I_c = 0. Published: S_ML = 56.3 mi/h, D = 27.0 pc/mi/ln, LOS D.
  const vpGp1 = 2000 / (0.92 * 2 * fHv);
  approx(vpGp1, 1169, 1.0, 'EP7 GP Case 1 flow rate');
  const case1 = new m.WasmManagedLanes('continuous_access', 60.0, vpMl, vpGp1 / 60);
  const los1 = case1.run_analysis();
  approx(case1.calculate_capacity(), 1650, 1.0, 'EP7 ML capacity (Eq. 12-14)');
  approx(case1.calculate_breakpoint(), 500, 1.0, 'EP7 ML breakpoint (Eq. 12-13)');
  approx(case1.calculate_speed(), 56.3, 0.1, 'EP7 Case 1 ML speed');
  approx(case1.calculate_density(), 27.0, 0.1, 'EP7 Case 1 ML density');
  exact(los1, 'D', 'EP7 Case 1 ML LOS');

  // Case 2: GP flow 2,221 pc/h/ln -> S = 53.0, density 41.9 > 35, I_c = 1.
  // Published: S_ML = 41.9 mi/h, D = 36.3 pc/mi/ln, LOS E.
  const vpGp2 = 3800 / (0.92 * 2 * fHv);
  approx(vpGp2, 2221, 1.0, 'EP7 GP Case 2 flow rate');
  const cGp = 2300, bpGp = 1600;
  const sGp2 = 60 - (60 - cGp / 45) * (vpGp2 - bpGp) ** 2 / (cGp - bpGp) ** 2;
  approx(sGp2, 53.0, 0.1, 'EP7 GP Case 2 speed (Eq. 12-1)');
  const case2 = new m.WasmManagedLanes('continuous_access', 60.0, vpMl, vpGp2 / sGp2);
  const los2 = case2.run_analysis();
  approx(case2.calculate_speed(), 41.9, 0.1, 'EP7 Case 2 ML speed');
  approx(case2.calculate_density(), 36.3, 0.1, 'EP7 Case 2 ML density');
  exact(los2, 'E', 'EP7 Case 2 ML LOS');
}

report('ch12 managed lanes (HCM Ch.26 EP7 + Exhibits 12-11/12-30)');
