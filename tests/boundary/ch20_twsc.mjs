// HCM Chapter 32, TWSC Example Problems 1 and 3 (Chapter 20 method) through
// the WASM boundary. Expected values and tolerances mirror
// transportations-library/tests/chapter20_integration.rs: LOS exact, control
// delays +-0.5 s/veh, capacities +-5 veh/h, queues +-0.2 veh.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

const DELAY_TOL = 0.5;
const CAP_TOL = 5.0;

// ── HCM Chapter 32, TWSC Example Problem 1 (three-leg intersection) ──
// Published answers: c_m,4 = 1,238; c_m,9 = 760; c_m,7 = 268;
// c_SH,NB = 521 veh/h; d_4 = 8.3 s (LOS A); d_NB = 14.9 s (LOS B);
// d_A,WB = 2.9 s; d_I = 4.1 s; Q95,4 = 0.4; Q95,NB = 1.3 veh.
// Fixture demand values are peak 15-min flow rates (veh/h), so phf is null
// and must stay undefined at the boundary.
const c1 = loadCase('Twsc', 'case1.json');
const d1 = c1.demand;
const g1 = c1.geometry;
const t1 = new m.WasmTwsc(
  undefined, undefined, d1.v2, d1.v3, d1.v4, undefined, d1.v5, undefined,
  d1.v7, undefined, d1.v9, undefined, undefined, undefined, // v1..v12
  undefined, undefined, undefined, undefined,               // v13..v16 (ped)
  g1.is_three_leg, g1.major_lanes_per_direction,
  g1.major_right_turn_eb.toLowerCase(), g1.major_right_turn_wb.toLowerCase(),
  undefined,                                                // uturn_median_width
  undefined, undefined,                                     // minor grades, pct
  g1.minor_lanes_nb.toLowerCase(), undefined,               // minor lane configs
  undefined, undefined, undefined, undefined,               // median/flare storage
  undefined,                                                // lane_width_ft
  c1.phf ?? undefined, c1.analysis_period_h, c1.heavy_vehicle_pct);
t1.analyze();

approx(t1.get_movement_capacity('4'), 1238.0, CAP_TOL, 'EP1 c_m,4');
approx(t1.get_movement_capacity('9'), 760.0, CAP_TOL, 'EP1 c_m,9');
approx(t1.get_movement_capacity('7'), 268.0, CAP_TOL, 'EP1 c_m,7');

// Shared northbound minor lane
exact(t1.get_lane_count('NB'), 1, 'EP1 NB lane count');
const nb1 = t1.lane_result_to_js_value('NB', 0);
approx(nb1.capacity, 521.0, CAP_TOL, 'EP1 c_SH,NB');
approx(nb1.control_delay, 14.9, DELAY_TOL, 'EP1 d_SH,NB');
exact(nb1.los, 'B', 'EP1 NB approach LOS');
approx(nb1.queue_95, 1.3, 0.2, 'EP1 Q95,NB');

// Major-street left turn
approx(t1.get_movement_delay('4'), 8.3, DELAY_TOL, 'EP1 d_4');
exact(t1.get_movement_los('4'), 'A', 'EP1 movement 4 LOS');
approx(t1.get_movement_queue_95('4'), 0.4, 0.2, 'EP1 Q95,4');

// Approach and intersection delays (Equations 20-64 and 20-65)
const ad1 = t1.get_approach_delays(); // [EB, WB, NB, SB]
approx(ad1[0], 0.0, DELAY_TOL, 'EP1 d_A,EB');
approx(ad1[1], 2.9, DELAY_TOL, 'EP1 d_A,WB');
approx(ad1[2], 14.9, DELAY_TOL, 'EP1 d_A,NB');
approx(t1.get_intersection_delay(), 4.1, DELAY_TOL, 'EP1 d_I');

// ── HCM Chapter 32, TWSC Example Problem 3 (two-stage gap acceptance and
// flared minor approaches) ──
// Published answers: c_T,8 = 390, c_T,11 = 405, c_T,7 = 365, c_T,10 = 342,
// c_F,NB = 498, c_F,SB = 487 veh/h; d_1 = 8.4 s (A), d_4 = 8.2 s (A),
// d_NB = 18.3 s (C), d_SB = 15.6 s (C); d_I = 6.3 s; Q95: 0.1, 0.2, 2.4,
// 1.3 veh. Fixture demand values are the published flow rates (hourly
// volumes already divided by PHF = 0.92), so phf stays undefined. The
// fixture's conflicting-flow overrides reproduce the published Stage I/II
// conflicting flows (6th Edition equation forms; see the VERIFY-HCM note in
// twsc.rs) and are applied through add_conflicting_flow_override.
const c2 = loadCase('Twsc', 'case2.json');
const d2 = c2.demand;
const g2 = c2.geometry;
const t2 = new m.WasmTwsc(
  d2.v1, undefined, d2.v2, d2.v3, d2.v4, undefined, d2.v5, d2.v6,
  d2.v7, d2.v8, d2.v9, d2.v10, d2.v11, d2.v12,
  undefined, undefined, undefined, undefined,               // v13..v16 (ped)
  g2.is_three_leg, g2.major_lanes_per_direction,
  g2.major_right_turn_eb.toLowerCase(), g2.major_right_turn_wb.toLowerCase(),
  undefined,                                                // uturn_median_width
  undefined, undefined,                                     // minor grades, pct
  g2.minor_lanes_nb.toLowerCase(), g2.minor_lanes_sb.toLowerCase(),
  g2.median_storage_nb, g2.median_storage_sb,
  g2.flare_storage_nb, g2.flare_storage_sb,
  undefined,                                                // lane_width_ft
  c2.phf ?? undefined, c2.analysis_period_h, c2.heavy_vehicle_pct);

const hasOverrideSetter = typeof t2.add_conflicting_flow_override === 'function';
if (hasOverrideSetter) {
  for (const ov of c2.conflicting_flow_overrides) {
    t2.add_conflicting_flow_override(ov.movement, ov.stage, ov.value);
  }
}
t2.analyze();

// Major-street left turns do not depend on the overrides, so these checks
// run against either pkg build.
approx(t2.get_movement_delay('1'), 8.4, DELAY_TOL, 'EP3 d_1');
approx(t2.get_movement_delay('4'), 8.2, DELAY_TOL, 'EP3 d_4');
exact(t2.get_movement_los('1'), 'A', 'EP3 movement 1 LOS');
exact(t2.get_movement_los('4'), 'A', 'EP3 movement 4 LOS');
approx(t2.get_movement_queue_95('1'), 0.1, 0.2, 'EP3 Q95,1');
approx(t2.get_movement_queue_95('4'), 0.2, 0.2, 'EP3 Q95,4');
const ad2 = t2.get_approach_delays();
approx(ad2[0], 0.8, DELAY_TOL, 'EP3 d_A,EB');
approx(ad2[1], 1.2, DELAY_TOL, 'EP3 d_A,WB');

if (hasOverrideSetter) {
  // Two-stage movement capacities
  approx(t2.get_movement_capacity('8'), 390.0, CAP_TOL, 'EP3 c_T,8');
  approx(t2.get_movement_capacity('11'), 405.0, CAP_TOL, 'EP3 c_T,11');
  approx(t2.get_movement_capacity('7'), 365.0, CAP_TOL, 'EP3 c_T,7');
  approx(t2.get_movement_capacity('10'), 342.0, CAP_TOL, 'EP3 c_T,10');

  // Flared-lane approach capacities (Equation 20-50)
  const nb2 = t2.lane_result_to_js_value('NB', 0);
  const sb2 = t2.lane_result_to_js_value('SB', 0);
  approx(nb2.capacity, 498.0, CAP_TOL, 'EP3 c_F,NB');
  approx(sb2.capacity, 487.0, CAP_TOL, 'EP3 c_F,SB');

  // Minor-approach delay, LOS, and queues
  approx(nb2.control_delay, 18.3, DELAY_TOL, 'EP3 d_NB');
  approx(sb2.control_delay, 15.6, DELAY_TOL, 'EP3 d_SB');
  exact(nb2.los, 'C', 'EP3 NB LOS');
  exact(sb2.los, 'C', 'EP3 SB LOS');
  approx(nb2.queue_95, 2.4, 0.2, 'EP3 Q95,NB');
  approx(sb2.queue_95, 1.3, 0.2, 'EP3 Q95,SB');

  approx(t2.get_intersection_delay(), 6.3, DELAY_TOL, 'EP3 d_I');
} else {
  console.log('SKIP  ch20 EP3 override-dependent checks: pkg rebuild needed'
    + ' for WasmTwsc.add_conflicting_flow_override');
}

report('ch20 TWSC (HCM Ch.32 EP1, EP3)');
