// HCM Chapter 32, AWSC Example Problems 1 and 2 (Chapter 21 method) through
// the WASM boundary. Expected values and tolerances mirror
// transportations-library/tests/chapter21_integration.rs: LOS exact, control
// delays +-0.5 s/veh, departure headways +-0.1 s (single-lane) / +-0.15 s
// (multilane).
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

const DELAY_TOL = 0.5;

// Flatten a fixture leg into the [left, through, right] triples per lane
// that the WASM constructor takes; a leg with no approach becomes an empty
// array (three-leg intersection).
function flat(leg) {
  return Float64Array.from(leg.lanes.flatMap((l) => [l.volume_left, l.volume_through, l.volume_right]));
}

function build(c) {
  return new m.WasmAwsc(
    flat(c.eb),
    flat(c.wb),
    flat(c.nb),
    flat(c.sb),
    c.eb.heavy_vehicle_pct,
    c.wb.heavy_vehicle_pct,
    c.nb.heavy_vehicle_pct,
    c.sb.heavy_vehicle_pct,
    c.phf ?? undefined,
    c.analysis_period_h,
  );
}

// ── HCM Chapter 32, AWSC Example Problem 1 (single-lane, three-leg) ──
// Published answers: h_d,EB = 4.97 s, h_d,WB = 4.74 s, h_d,SB = 5.70 s
// (Exhibit 32-21); t_s,EB = 2.97 s; d_EB = 13.0 s (LOS B), d_WB = 13.5 s,
// d_minor = 10.6 s; intersection 12.8 s LOS B; Q95,EB = 2.9 veh.
// Fixture volumes are hourly with PHF = 0.95, 2% heavy vehicles.
const c1 = loadCase('Awsc', 'case1.json');
const a1 = build(c1);
a1.analyze();

exact(a1.get_lane_count('EB'), 1, 'EP1 EB lane count');
exact(a1.get_lane_count('NB'), 0, 'EP1 NB lane count (no approach)');
approx(a1.get_departure_headway('EB', 0), 4.97, 0.1, 'EP1 h_d,EB');
approx(a1.get_degree_of_utilization('EB', 0), 0.508, 0.01, 'EP1 x_EB');
approx(a1.get_service_time('EB', 0), 2.97, 0.1, 'EP1 t_s,EB');
approx(a1.get_lane_delay('EB', 0), 13.0, DELAY_TOL, 'EP1 d_EB');
exact(a1.get_lane_los('EB', 0), 'B', 'EP1 EB LOS');
approx(a1.get_lane_queue_95('EB', 0), 2.9, 0.2, 'EP1 Q95,EB');

approx(a1.get_departure_headway('WB', 0), 4.74, 0.1, 'EP1 h_d,WB');
approx(a1.get_lane_delay('WB', 0), 13.5, DELAY_TOL, 'EP1 d_WB');
exact(a1.get_lane_los('WB', 0), 'B', 'EP1 WB LOS');

approx(a1.get_departure_headway('SB', 0), 5.7, 0.1, 'EP1 h_d,SB');
approx(a1.get_lane_delay('SB', 0), 10.6, DELAY_TOL, 'EP1 d_SB');

approx(a1.get_intersection_delay(), 12.8, DELAY_TOL, 'EP1 d_I');
exact(a1.get_intersection_los(), 'B', 'EP1 intersection LOS');

// Step 12: eastbound lane capacity approximately 720 veh/h, below the naive
// 748 veh/h estimate because of approach interactions (see the tolerance
// note in chapter21/tests.rs). Fresh instance, as in the Rust test.
const a1c = build(c1);
const cEB = a1c.compute_lane_capacity('EB', 0);
approx(cEB, 720.0, 20.0, 'EP1 c_EB');
exact(cEB < 748.0, true, 'EP1 c_EB reflects approach interactions (< 748)');

// ── HCM Chapter 32, AWSC Example Problem 2 (multilane, four-leg, 512-state
// framework) ──
// Published answers: h_d,EB,1 = 8.19 s, x_EB,1 = 0.1274, t_s,EB,1 = 5.89 s,
// d_EB,1 = 12.1 s (LOS B), d_EB,2 = 16.1 s; d_EB = 15.3 s (LOS C),
// d_WB = 14.3 s, d_NB = 13.1 s, d_SB = 12.6 s; intersection 14.0 s LOS B;
// Q95,EB,1 = 0.4 veh. Fixture demand values are hourly flow rates
// (15-min volumes x 4, Exhibit 32-23), so phf is null.
const c2 = loadCase('Awsc', 'case2.json');
const a2 = build(c2);
a2.analyze();

exact(a2.get_lane_count('EB'), 2, 'EP2 EB lane count');
exact(a2.get_lane_count('NB'), 3, 'EP2 NB lane count');
approx(a2.get_departure_headway('EB', 0), 8.19, 0.15, 'EP2 h_d,EB,1');
approx(a2.get_degree_of_utilization('EB', 0), 0.1274, 0.005, 'EP2 x_EB,1');
approx(a2.get_service_time('EB', 0), 5.89, 0.15, 'EP2 t_s,EB,1');
approx(a2.get_lane_delay('EB', 0), 12.1, DELAY_TOL, 'EP2 d_EB,1');
exact(a2.get_lane_los('EB', 0), 'B', 'EP2 EB lane 1 LOS');
approx(a2.get_lane_queue_95('EB', 0), 0.4, 0.2, 'EP2 Q95,EB,1');

approx(a2.get_lane_delay('EB', 1), 16.1, DELAY_TOL, 'EP2 d_EB,2');
exact(a2.get_lane_los('EB', 1), 'C', 'EP2 EB lane 2 LOS');

approx(a2.get_approach_delay('EB'), 15.3, DELAY_TOL, 'EP2 d_EB');
exact(a2.get_approach_los('EB'), 'C', 'EP2 EB approach LOS');
approx(a2.get_approach_delay('WB'), 14.3, DELAY_TOL, 'EP2 d_WB');
approx(a2.get_approach_delay('NB'), 13.1, DELAY_TOL, 'EP2 d_NB');
approx(a2.get_approach_delay('SB'), 12.6, DELAY_TOL, 'EP2 d_SB');

approx(a2.get_intersection_delay(), 14.0, DELAY_TOL, 'EP2 d_I');
exact(a2.get_intersection_los(), 'B', 'EP2 intersection LOS');

report('ch21 AWSC (HCM Ch.32 EP1-EP2)');
