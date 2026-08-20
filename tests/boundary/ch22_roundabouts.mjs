// HCM Chapter 33, Roundabout Example Problems 1 and 2 (Chapter 22 method)
// through the WASM boundary. Expected values and tolerances mirror
// transportations-library/tests/chapter22_integration.rs: LOS exact, control
// delays +-0.5 s/veh, capacities +-5 veh/h.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

const DELAY_TOL = 0.5;
const CAP_TOL = 5.0;

// Flatten a fixture leg into the constructor's entry descriptor
// [v_u, v_l, v_t, v_r, hv_pct, entry_lanes, circulating_lanes, exiting_lanes,
// n_ped]; missing v_u / n_ped default to 0.
function entry(leg) {
  return Float64Array.of(
    leg.v_u ?? 0,
    leg.v_l ?? 0,
    leg.v_t ?? 0,
    leg.v_r ?? 0,
    leg.heavy_vehicle_pct,
    leg.entry_lanes,
    leg.circulating_lanes,
    leg.exiting_lanes,
    leg.n_ped ?? 0,
  );
}

// Fixture lane-assignment names (library enum variants) to the constructor's
// short codes for two-lane entries.
const LANE_ASSIGNMENT = {
  LeftAndThroughRight: 'l_tr',
  LeftThroughAndRight: 'lt_r',
  LeftThroughAndThroughRight: 'lt_tr',
  LeftAndAllMovements: 'l_ltr',
  AllMovementsAndRight: 'ltr_r',
};

function build(c) {
  return new m.WasmRoundabouts(
    entry(c.nb),
    entry(c.sb),
    entry(c.eb),
    entry(c.wb),
    c.nb.bypass?.toLowerCase(),
    c.sb.bypass?.toLowerCase(),
    c.eb.bypass?.toLowerCase(),
    c.wb.bypass?.toLowerCase(),
    c.nb.lane_assignment && LANE_ASSIGNMENT[c.nb.lane_assignment],
    c.sb.lane_assignment && LANE_ASSIGNMENT[c.sb.lane_assignment],
    c.eb.lane_assignment && LANE_ASSIGNMENT[c.eb.lane_assignment],
    c.wb.lane_assignment && LANE_ASSIGNMENT[c.wb.lane_assignment],
    c.phf ?? undefined,
    c.analysis_period_h,
  );
}

// ── HCM Chapter 33, Roundabout Example Problem 1 (single-lane roundabout
// with bypass lanes) ──
// Published answers: c_NB = 597, c_SB = 618, c_EB = 824, c_WB = 694,
// c_bypass,WB = 851 veh/h; x_NB = 0.70; lane delays 22.6 / 14.0 / 0 / 22.0 /
// 26.8 / 20.2 s with LOS C/B/A/C/D/C (Exhibit 33-8); approach delays
// d_WB = 23.3 (C), d_SB = 4.7 (A); intersection 17.5 s LOS C;
// Q95,NB = 5.7 veh. Hourly volumes (Exhibit 33-6), PHF = 0.94, 2% heavy
// vehicles, 50 p/h crossing the NB entry.
const c1 = loadCase('Roundabouts', 'case1.json');
const r1 = build(c1);
r1.analyze();

const nb1 = r1.lane_result_to_js_value('NB', 0);
approx(nb1.capacity_veh, 597.0, CAP_TOL, 'EP1 c_NB');
approx(nb1.v_c_ratio, 0.7, 0.01, 'EP1 x_NB');
approx(nb1.control_delay, 22.6, DELAY_TOL, 'EP1 d_NB');
exact(nb1.los, 'C', 'EP1 NB entry LOS');
approx(nb1.queue_95, 5.7, 0.3, 'EP1 Q95,NB');

const sb1 = r1.lane_result_to_js_value('SB', 0);
approx(sb1.capacity_veh, 618.0, CAP_TOL, 'EP1 c_SB');
approx(sb1.control_delay, 14.0, DELAY_TOL, 'EP1 d_SB entry');
exact(sb1.los, 'B', 'EP1 SB entry LOS');
const sbBy1 = r1.bypass_result_to_js_value('SB');
approx(sbBy1.control_delay, 0.0, 1e-9, 'EP1 d_bypass,SB (nonyielding)');
exact(sbBy1.los, 'A', 'EP1 SB bypass LOS');

const eb1 = r1.lane_result_to_js_value('EB', 0);
approx(eb1.capacity_veh, 824.0, CAP_TOL, 'EP1 c_EB');
approx(eb1.control_delay, 22.0, DELAY_TOL, 'EP1 d_EB');
exact(eb1.los, 'C', 'EP1 EB entry LOS');

const wb1 = r1.lane_result_to_js_value('WB', 0);
approx(wb1.capacity_veh, 694.0, CAP_TOL, 'EP1 c_WB');
approx(wb1.control_delay, 26.8, DELAY_TOL, 'EP1 d_WB');
exact(wb1.los, 'D', 'EP1 WB entry LOS');
const wbBy1 = r1.bypass_result_to_js_value('WB');
approx(wbBy1.capacity_veh, 851.0, CAP_TOL, 'EP1 c_bypass,WB');
approx(wbBy1.control_delay, 20.2, DELAY_TOL, 'EP1 d_bypass,WB');
exact(wbBy1.los, 'C', 'EP1 WB bypass LOS');

// Approach and intersection aggregation (Equations 22-18 and 22-19)
approx(r1.get_approach_delay('WB'), 23.3, DELAY_TOL, 'EP1 d_A,WB');
exact(r1.get_approach_los('WB'), 'C', 'EP1 WB approach LOS');
approx(r1.get_approach_delay('SB'), 4.7, DELAY_TOL, 'EP1 d_A,SB');
exact(r1.get_approach_los('SB'), 'A', 'EP1 SB approach LOS');
approx(r1.get_intersection_delay(), 17.5, DELAY_TOL, 'EP1 d_I');
exact(r1.get_intersection_los(), 'C', 'EP1 intersection LOS');

// ── HCM Chapter 33, Roundabout Example Problem 2 (multilane roundabout,
// Exhibit 33-9) ──
// Published answers: c_NB = 607, c_SB,L = 651, c_SB,R = 723, c_EB = 675,
// c_WB = 964 veh/h; lane delays 11.8 / 13.0 / 14.6 / 14.0 / 16.1 / 8.8 /
// 7.8 s with LOS B/B/B/B/C/A/A (Exhibit 33-11); approach delays 11.8 /
// 13.9 / 15.1 / 8.3 s; intersection 12.3 s LOS B; Q95,NB = 1.9 veh.
// PHF = 0.95; 5% heavy vehicles EB/WB, 2% NB/SB.
const c2 = loadCase('Roundabouts', 'case2.json');
const r2 = build(c2);
r2.analyze();

const nb2 = r2.lane_result_to_js_value('NB', 0);
approx(nb2.capacity_veh, 607.0, CAP_TOL, 'EP2 c_NB');
approx(nb2.control_delay, 11.8, DELAY_TOL, 'EP2 d_NB');
exact(nb2.los, 'B', 'EP2 NB LOS');
approx(nb2.queue_95, 1.9, 0.2, 'EP2 Q95,NB');

exact(r2.get_lane_count('SB'), 2, 'EP2 SB lane count');
const sb2L = r2.lane_result_to_js_value('SB', 0);
const sb2R = r2.lane_result_to_js_value('SB', 1);
approx(sb2L.capacity_veh, 651.0, CAP_TOL, 'EP2 c_SB,L');
approx(sb2R.capacity_veh, 723.0, CAP_TOL, 'EP2 c_SB,R');
approx(sb2L.control_delay, 13.0, DELAY_TOL, 'EP2 d_SB,L');
approx(sb2R.control_delay, 14.6, DELAY_TOL, 'EP2 d_SB,R');
exact(sb2L.los, 'B', 'EP2 SB left-lane LOS');
exact(sb2R.los, 'B', 'EP2 SB right-lane LOS');

const eb2L = r2.lane_result_to_js_value('EB', 0);
const eb2R = r2.lane_result_to_js_value('EB', 1);
approx(eb2L.capacity_veh, 675.0, CAP_TOL, 'EP2 c_EB,L');
approx(eb2R.capacity_veh, 675.0, CAP_TOL, 'EP2 c_EB,R');
approx(eb2L.control_delay, 14.0, DELAY_TOL, 'EP2 d_EB,L');
approx(eb2R.control_delay, 16.1, DELAY_TOL, 'EP2 d_EB,R');
exact(eb2L.los, 'B', 'EP2 EB left-lane LOS');
exact(eb2R.los, 'C', 'EP2 EB right-lane LOS');

const wb2L = r2.lane_result_to_js_value('WB', 0);
const wb2R = r2.lane_result_to_js_value('WB', 1);
approx(wb2L.capacity_veh, 964.0, CAP_TOL, 'EP2 c_WB,L');
approx(wb2R.capacity_veh, 964.0, CAP_TOL, 'EP2 c_WB,R');
approx(wb2L.control_delay, 8.8, DELAY_TOL, 'EP2 d_WB,L');
approx(wb2R.control_delay, 7.8, DELAY_TOL, 'EP2 d_WB,R');
exact(wb2L.los, 'A', 'EP2 WB left-lane LOS');
exact(wb2R.los, 'A', 'EP2 WB right-lane LOS');

approx(r2.get_approach_delay('NB'), 11.8, DELAY_TOL, 'EP2 d_A,NB');
approx(r2.get_approach_delay('SB'), 13.9, DELAY_TOL, 'EP2 d_A,SB');
approx(r2.get_approach_delay('EB'), 15.1, DELAY_TOL, 'EP2 d_A,EB');
approx(r2.get_approach_delay('WB'), 8.3, DELAY_TOL, 'EP2 d_A,WB');
exact(r2.get_approach_los('EB'), 'C', 'EP2 EB approach LOS');
approx(r2.get_intersection_delay(), 12.3, DELAY_TOL, 'EP2 d_I');
exact(r2.get_intersection_los(), 'B', 'EP2 intersection LOS');

report('ch22 roundabouts (HCM Ch.33 EP1-EP2)');
