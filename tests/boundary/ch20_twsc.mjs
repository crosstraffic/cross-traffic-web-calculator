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
// fixture's conflicting_flow_overrides list is EMPTY: the December 2022
// corrections to Equations 20-14/20-15 and Exhibits 20-14/20-16 made the
// published Stage I/II conflicting flows reproduce natively, so the
// override loop below is a no-op kept to exercise the pass-through, and
// add_conflicting_flow_override is boundary-tested separately.
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
  console.log('SKIP  ch20 EP3 override-dependent checks: middleware wrapper work needed'
    + ' for WasmTwsc.add_conflicting_flow_override');
}

// ── HCM Chapter 32, TWSC Example Problem 2 (Chapter 20 Section 5 pedestrian
// mode) ──
// A different procedure from the two blocks above. There the pedestrian is an
// impedance on vehicular capacity (movements v13 through v16 of `WasmTwsc`);
// here the pedestrian is the subject, the service measure is the proportion
// who would rate the crossing "dissatisfied" or worse, and Exhibit 20-3 sets
// LOS from that proportion rather than from any delay. The three scenarios
// share a four-lane major street at 1,700 veh/h and a K-factor of 0.08, and
// differ only in staging, countermeasures, and motorist yield rate.
//
// Expected values and tolerances mirror the pedestrian section of
// chapter20_integration.rs, which cites the published answers of the Step
// prose and Exhibit 32-7. Five things the HCM does not settle are documented
// in the library's `src/hcm/twsc/pedestrian.rs` and carried through here
// rather than re-adjudicated:
//   1. VERIFY-HCM. The Equation 20-95 I_MR and I_NY coefficients (1.5490 and
//      -1.9043) are clipped out of the HCM PDF by a scrollable typeset box and
//      appear nowhere in the Chapter 20 text. They were solved out of the six
//      published O(S/D) values of this very example, which over-determine the
//      two unknowns. That makes the O(S/D) checks below a fit residual rather
//      than an independent reproduction, and they are labelled as such.
//   2. VERIFY-HCM. Equations 20-91 and 20-92 are clipped by the same
//      typesetting, but unlike 20-95 both are recoverable from the chapter
//      (20-91's numerator is the intact 20-90, and 20-92 appears in full as
//      the numerator of 20-93).
//   3. VERIFY-HCM. The core evaluates the yield probability as one binomial
//      sum over blocked lanes rather than as the book's four transcribed lane
//      cases, which extends past the four-lane crossings the HCM enumerates.
//   4. VERIFY-HCM. N_p is called a count of pedestrian rows but Equation 20-77
//      is a ratio the HCM neither rounds nor truncates, so it is carried real.
//   5. VERIFY-HCM. Step 7 takes the first stage's P_d and P(Y_1) on a
//      two-stage crossing. The example cannot discriminate first from last
//      from worst, because its two stages are identical by construction, but
//      it does rule out the across-stage product: Exhibit 32-7 reports
//      P_nd = 0.481, not 0.481^2.
const ped = loadCase('Twsc', 'case4_pedestrian.json');
const PROB_TOL = 0.001;

// Scenario A: 46-ft unmarked single-stage crossing of all four lanes, 0%
// motorist yield rate. Published: t_c = 12.5 s, P_b = 0.771, P_d = 0.997,
// d_g = 761 s, d_gd = 763 s, d_p = 761 s, O(S/D) = 1.066 / 0.159,
// P(D) = 48.4% / 86.3%, P(Y_1) = 0, P_nd = 0.003, LOS F.
const pa = new m.WasmPedestrianCrossing(ped.scenario_a);
const ra = pa.results_to_js_value();
exact(pa.get_stage_count(), 1, 'EP2-A stage count');
exact(ra.stages.length, 1, 'EP2-A result stages');
const sa = ra.stages[0];
approx(sa.critical_headway, 12.5, 0.05, 'EP2-A t_c');
// No platooning, so Equations 20-77 and 20-78 are skipped and t_c,G = t_c.
approx(sa.spatial_distribution, 1.0, 1e-9, 'EP2-A N_p');
approx(sa.group_critical_headway, 12.5, 0.05, 'EP2-A t_c,G');
approx(sa.prob_blocked_lane, 0.771, PROB_TOL, 'EP2-A P_b');
approx(sa.prob_delayed_crossing, 0.997, PROB_TOL, 'EP2-A P_d');
// Published to three significant figures, and Equation 20-82 is exponential
// in v*t_c,G, so these carry a 0.5% band rather than an absolute one.
approx(sa.gap_delay, 761.0, 761.0 * 0.005, 'EP2-A d_g');
approx(sa.gap_delay_when_delayed, 763.0, 763.0 * 0.005, 'EP2-A d_gd');
exact(sa.prob_yield.every((p) => p === 0), true, 'EP2-A every P(Y_i) = 0 at a 0% yield rate');
approx(ra.delay, 761.0, 761.0 * 0.005, 'EP2-A d_p');
approx(pa.get_delay(), ra.delay, 1e-12, 'EP2-A get_delay matches the results object');
// The book labels this step "d_p,1 = d_gd = 761 s", which is a mislabel of
// d_gd = 763 s. With M_y = 0 every P(Y_i) is zero, so Equation 20-84 reduces
// to P_d * d_gd, and 761 is what that yields.
approx(ra.delay, sa.prob_delayed_crossing * sa.gap_delay_when_delayed, 0.001, 'EP2-A d_p = P_d * d_gd at a 0% yield rate');
// Fit residual, not an independent reproduction: see note 1 above.
approx(ra.odds_satisfied_no_delay, 1.066, 0.005, 'EP2-A O(S/D, no delay) [Eq 20-95 fit residual]');
approx(ra.odds_satisfied_delay, 0.159, PROB_TOL, 'EP2-A O(S/D, delay) [Eq 20-95 fit residual]');
approx(ra.prob_dissatisfied_no_delay, 0.484, PROB_TOL, 'EP2-A P(D, no delay)');
approx(ra.prob_dissatisfied_delay, 0.863, PROB_TOL, 'EP2-A P(D, delay)');
approx(ra.prob_yield_first_event, 0.0, 1e-9, 'EP2-A P(Y_1)');
approx(ra.prob_non_delayed, 0.003, PROB_TOL, 'EP2-A P_nd');
approx(ra.proportion_dissatisfied, 0.862, 0.005, 'EP2-A P_D');
exact(ra.los, 'F', 'EP2-A LOS');
exact(pa.get_los(), 'F', 'EP2-A get_los');

// Scenario B: two-stage crossing behind a median refuge, 20 ft and two through
// lanes per stage, marked crosswalk, 50% motorist yield rate. Published:
// t_c = 6.0 s, P_b = 0.508, P_d = 0.758, d_g = 7.2 s, d_gd = 9.5 s, h = 2.3 s,
// n = 4, P(Y_1) = 0.314, d_p,1 = d_p,2 = 3.0 s, d_p = 6.0 s. Exhibit 32-7:
// O(S/D) = 13.44 / 2.00, P(D) = 6.9% / 33.4%, P_nd = 0.481, P_D = 0.207, C.
const pb = new m.WasmPedestrianCrossing(ped.scenario_b);
const rb = pb.results_to_js_value();
exact(pb.get_stage_count(), 2, 'EP2-B stage count');
const sb = rb.stages[0];
approx(sb.critical_headway, 6.0, 0.05, 'EP2-B t_c');
approx(sb.prob_blocked_lane, 0.508, PROB_TOL, 'EP2-B P_b');
approx(sb.prob_delayed_crossing, 0.758, PROB_TOL, 'EP2-B P_d');
approx(sb.gap_delay, 7.2, 0.05, 'EP2-B d_g');
approx(sb.gap_delay_when_delayed, 9.5, 0.05, 'EP2-B d_gd');
approx(sb.average_short_headway, 2.3, 0.05, 'EP2-B h');
exact(sb.yield_events, 4, 'EP2-B n = int(d_gd / h)');
// The book prints the running cumulative sums inside the P(Y_i) brackets.
approx(sb.prob_yield[1], 0.314, PROB_TOL, 'EP2-B P(Y_1)');
approx(sb.prob_yield[1] + sb.prob_yield[2], 0.498, PROB_TOL, 'EP2-B P(Y_1..2)');
approx(sb.prob_yield[1] + sb.prob_yield[2] + sb.prob_yield[3], 0.606, PROB_TOL, 'EP2-B P(Y_1..3)');
approx(sb.delay, 3.0, DELAY_TOL, 'EP2-B d_p,1');
approx(rb.stages[1].delay, 3.0, DELAY_TOL, 'EP2-B d_p,2');
approx(rb.delay, 6.0, DELAY_TOL, 'EP2-B d_p');
// Equation 20-94 is a plain sum over the stages, and both stages are identical
// by construction here, so the total must be exactly twice one stage.
approx(rb.delay, sb.delay + rb.stages[1].delay, 1e-12, 'EP2-B d_p sums the stages');
approx(rb.odds_satisfied_no_delay, 13.44, 0.05, 'EP2-B O(S/D, no delay) [Eq 20-95 fit residual]');
approx(rb.odds_satisfied_delay, 2.0, 0.01, 'EP2-B O(S/D, delay) [Eq 20-95 fit residual]');
approx(rb.prob_dissatisfied_no_delay, 0.069, PROB_TOL, 'EP2-B P(D, no delay)');
approx(rb.prob_dissatisfied_delay, 0.334, PROB_TOL, 'EP2-B P(D, delay)');
approx(rb.prob_yield_first_event, 0.314, PROB_TOL, 'EP2-B P(Y_1)');
approx(rb.prob_non_delayed, 0.481, PROB_TOL, 'EP2-B P_nd');
approx(rb.proportion_dissatisfied, 0.207, PROB_TOL, 'EP2-B P_D');
exact(rb.los, 'C', 'EP2-B LOS');
// Note 5 above: Step 7 takes the first stage's P_d and P(Y_1) rather than
// compounding the stages. The published 0.481 is what one stage gives.
approx(rb.prob_non_delayed, (1 - sb.prob_delayed_crossing) + sb.prob_delayed_crossing * sb.prob_yield[1], 1e-12, 'EP2-B P_nd is the first stage, not the across-stage product');

// Scenario C: Scenario B plus RRFBs at an 80% motorist yield rate. Published:
// P(Y_1) = 0.565, d_p,1 = d_p,2 = 1.5 s, d_p = 3.0 s. Exhibit 32-7:
// O(S/D) = 95.15 / 14.15, P(D) = 1.0% / 6.6%, P_nd = 0.670, P_D = 0.029, A.
const pc = new m.WasmPedestrianCrossing(ped.scenario_c);
const rc = pc.results_to_js_value();
exact(pc.get_stage_count(), 2, 'EP2-C stage count');
const sc = rc.stages[0];
// Only the yield rate changes from Scenario B, so Steps 2 through 4 are
// unchanged and pinning them here catches a countermeasure leaking upstream.
approx(sc.prob_delayed_crossing, 0.758, PROB_TOL, 'EP2-C P_d');
approx(sc.average_short_headway, 2.3, 0.05, 'EP2-C h');
exact(sc.yield_events, 4, 'EP2-C n = int(d_gd / h)');
approx(sc.prob_yield[1], 0.565, PROB_TOL, 'EP2-C P(Y_1)');
approx(sc.prob_yield[1] + sc.prob_yield[2], 0.709, PROB_TOL, 'EP2-C P(Y_1..2)');
approx(sc.prob_yield[1] + sc.prob_yield[2] + sc.prob_yield[3], 0.746, PROB_TOL, 'EP2-C P(Y_1..3)');
approx(sc.delay, 1.5, DELAY_TOL, 'EP2-C d_p,1');
approx(rc.delay, 3.0, DELAY_TOL, 'EP2-C d_p');
approx(rc.odds_satisfied_no_delay, 95.15, 0.15, 'EP2-C O(S/D, no delay) [Eq 20-95 fit residual]');
approx(rc.odds_satisfied_delay, 14.15, 0.05, 'EP2-C O(S/D, delay) [Eq 20-95 fit residual]');
approx(rc.prob_dissatisfied_no_delay, 0.010, PROB_TOL, 'EP2-C P(D, no delay)');
approx(rc.prob_dissatisfied_delay, 0.066, PROB_TOL, 'EP2-C P(D, delay)');
approx(rc.prob_yield_first_event, 0.565, PROB_TOL, 'EP2-C P(Y_1)');
approx(rc.prob_non_delayed, 0.670, PROB_TOL, 'EP2-C P_nd');
approx(rc.proportion_dissatisfied, 0.029, PROB_TOL, 'EP2-C P_D');
exact(rc.los, 'A', 'EP2-C LOS');

// The progression the example is written to show: a marked crosswalk and
// median refuge move the crossing from LOS F to C, and RRFBs move it to A.
exact(ra.proportion_dissatisfied > rb.proportion_dissatisfied
  && rb.proportion_dissatisfied > rc.proportion_dissatisfied, true, 'EP2 P_D falls monotonically as countermeasures are added');
exact(ra.delay > rb.delay && rb.delay > rc.delay, true, 'EP2 d_p falls monotonically');

// `PedestrianCrossing` is serde(default) at both levels, so a config whose
// `stages` key is missing or misspelled deserializes into a crossing of no
// stages, which sums to zero delay and returns LOS A. That is the one input
// mistake on this surface whose result still reads like a finished answer,
// and the binding rejects it rather than passing it through.
const noStages = { ...ped.scenario_b };
delete noStages.stages;
noStages.stagez = ped.scenario_b.stages;
let rejected = false;
try {
  new m.WasmPedestrianCrossing(noStages);
} catch {
  rejected = true;
}
exact(rejected, true, 'EP2 a crossing with no stages is rejected at the binding');

// A dropped *second* stage is not catchable that way, because one stage is a
// valid crossing. Only the stage-count readback sees it.
const halfCrossing = new m.WasmPedestrianCrossing({ ...ped.scenario_b, stages: [ped.scenario_b.stages[0]] });
exact(halfCrossing.get_stage_count(), 1, 'EP2 stage-count readback sees a dropped stage');
approx(halfCrossing.get_delay(), 3.0, DELAY_TOL, 'EP2 a dropped stage halves the crossing delay');

// Each Equation 20-95 indicator moves the answer by more than a LOS letter, so
// none of the three is silently dropped on the way through the binding.
const noRefuge = new m.WasmPedestrianCrossing({ ...ped.scenario_b, has_median_refuge: false }).results_to_js_value();
exact(noRefuge.los, 'E', 'EP2-B without the median refuge indicator');
const noMarking = new m.WasmPedestrianCrossing({ ...ped.scenario_b, has_marked_crosswalk: false }).results_to_js_value();
exact(noMarking.los, 'E', 'EP2-B without the marked-crosswalk indicator');
const noRrfb = new m.WasmPedestrianCrossing({ ...ped.scenario_c, has_rrfb: false }).results_to_js_value();
exact(noRrfb.los, 'C', 'EP2-C without the RRFB indicator');
// AADT reaches Equation 20-95 either directly or through the K-factor, and the
// direct value wins when both are given.
const direct = new m.WasmPedestrianCrossing({ ...ped.scenario_b, aadt_veh: ped.scenario_b.peak_hour_volume_veh_h / ped.scenario_b.k_factor }).results_to_js_value();
approx(direct.odds_satisfied_no_delay, rb.odds_satisfied_no_delay, 1e-9, 'EP2-B aadt_veh equal to the K-factor estimate reproduces it');
const higherAadt = new m.WasmPedestrianCrossing({ ...ped.scenario_b, aadt_veh: 30000 }).results_to_js_value();
exact(higherAadt.odds_satisfied_no_delay < rb.odds_satisfied_no_delay, true, 'EP2-B a higher AADT lowers the satisfaction odds');

// Platooning is the one Step 2 branch no scenario of Example Problem 2
// exercises, so it has no published column. It is pinned by direction only:
// Equations 20-77 through 20-79 must lift the group critical headway above the
// single-pedestrian value, and must be inert when platooning is off.
const platoon = new m.WasmPedestrianCrossing({ ...ped.scenario_b, pedestrian_platooning: true, crosswalk_width_ft: 10.0, pedestrian_flow_p_h: 300.0 }).results_to_js_value();
exact(platoon.stages[0].group_critical_headway > sb.group_critical_headway, true, 'EP2-B platooning raises t_c,G above t_c');
exact(platoon.stages[0].spatial_distribution > 1.0, true, 'EP2-B platooning gives N_p above one row');
const platoonOff = new m.WasmPedestrianCrossing({ ...ped.scenario_b, crosswalk_width_ft: 10.0, pedestrian_flow_p_h: 300.0 }).results_to_js_value();
approx(platoonOff.delay, rb.delay, 1e-12, 'EP2-B crosswalk width and pedestrian flow are inert with platooning off');

report('ch20 TWSC (HCM Ch.32 EP1, EP2 pedestrian, EP3)');
