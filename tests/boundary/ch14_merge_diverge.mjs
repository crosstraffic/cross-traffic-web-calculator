// HCM Chapter 14 freeway merge and diverge segments through the WASM
// boundary, run against HCM Chapter 28 Example Problems 1-5. Expected values
// and tolerances mirror transportations-library/tests/chapter14_integration.rs.
//
// Constructor order under test: (ramp_type, ramp_side, ramp_lanes,
// freeway_lanes, freeway_ffs, ramp_ffs, accel_lane_length,
// accel_lane_length2, decel_lane_length, decel_lane_length2, freeway_demand,
// ramp_demand, phf, heavy_vehicle_pct, ramp_heavy_vehicle_pct, terrain,
// adjacent_upstream, upstream_distance, upstream_ramp_flow,
// adjacent_downstream, downstream_distance, downstream_ramp_flow, caf, saf).
//
// Mapping notes: the fixtures store ramp_lanes as the serde enum name
// ("OneLane"); the binding takes a number (2 -> TwoLane, else OneLane), so 1
// is passed here. heavy_vehicle_pct / ramp_heavy_vehicle_pct are DECIMAL
// shares (0.05 = 5%), matching the fixtures and the Rust struct.
// freeway_lanes is lanes in ONE direction (2 = "four-lane freeway").
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

function build(c) {
  const rampLanes = c.ramp_lanes === 'TwoLane' ? 2 : 1;
  return new m.WasmRampSegment(
    c.ramp_type, c.ramp_side, rampLanes, c.freeway_lanes, c.freeway_ffs,
    c.ramp_ffs, c.accel_lane_length, c.accel_lane_length2,
    c.decel_lane_length, c.decel_lane_length2, c.freeway_demand,
    c.ramp_demand, c.phf, c.heavy_vehicle_pct, c.ramp_heavy_vehicle_pct,
    c.terrain, c.adjacent_upstream, c.upstream_distance, c.upstream_ramp_flow,
    c.adjacent_downstream, c.downstream_distance, c.downstream_ramp_flow,
    c.caf, c.saf);
}

// --- HCM Ch.28 Example Problem 1: isolated one-lane, right-hand on-ramp to a
// four-lane freeway (FFS = 60 mi/h, ramp FFS = 45 mi/h, L_A = 740 ft).
{
  const seg = build(loadCase('MergeDiverge', 'case1.json'));
  const los = seg.run_analysis();

  // Step 1 (Equation 14-1)
  approx(seg.get_flow_freeway(), 2918.0, 5.0, 'EP1 v_F (pc/h)');
  approx(seg.get_flow_ramp(), 625.0, 2.0, 'EP1 v_R (pc/h)');

  // Step 2: four-lane freeway, P_FM = 1.000 (Exhibit 14-8)
  approx(seg.get_p_f(), 1.0, 1e-9, 'EP1 P_FM');
  approx(seg.get_v12(), 2918.0, 5.0, 'EP1 v_12 (pc/h)');
  approx(seg.get_vr12(), 3543.0, 6.0, 'EP1 v_R12 (pc/h)');

  // Step 3: capacity checks (Exhibits 14-10/14-12)
  approx(seg.get_capacity_freeway(), 4600.0, 1e-9, 'EP1 freeway capacity (pc/h)');
  approx(seg.get_capacity_ramp(), 2100.0, 1e-9, 'EP1 ramp capacity (pc/h)');
  exact(seg.get_demand_exceeds_capacity(), false, 'EP1 demand within capacity');
  exact(seg.get_exceeds_max_desirable(), false, 'EP1 v_R12 within max desirable');

  // Step 4 (Equation 14-22, Exhibit 14-3)
  approx(seg.get_density(), 28.2, 0.5, 'EP1 D_R (pc/mi/ln)');
  exact(los, 'D', 'EP1 LOS');

  // Step 5 (Exhibit 14-13): S_R = 53.0 mi/h with M_S = 0.389
  approx(seg.get_speed_ramp(), 53.0, 0.5, 'EP1 S_R (mi/h)');
  // No outer lanes on a four-lane freeway
  exact(seg.get_speed_outer(), undefined, 'EP1 S_O does not apply');
}

// --- HCM Ch.28 Example Problem 2 (first off-ramp): two adjacent single-lane,
// right-hand off-ramps on a six-lane freeway (FFS = 60 mi/h). The downstream
// off-ramp is beyond L_EQ = 657 ft, so Equation 14-9 governs.
{
  const seg = build(loadCase('MergeDiverge', 'case2.json'));
  const los = seg.run_analysis();

  approx(seg.get_flow_freeway(), 5093.0, 5.0, 'EP2 v_F (pc/h)');
  approx(seg.get_flow_ramp(), 340.0, 2.0, 'EP2 v_R (pc/h)');

  // Step 2: isolated treatment (L_DOWN = 750 ft >= L_EQ = 657 ft),
  // Equation 14-9: P_FD = 0.617
  approx(seg.get_p_f(), 0.617, 0.002, 'EP2 P_FD');
  approx(seg.get_v12(), 3273.0, 6.0, 'EP2 v_12 (pc/h)');

  // Step 3
  approx(seg.get_capacity_freeway(), 6900.0, 1e-9, 'EP2 freeway capacity (pc/h)');
  approx(seg.get_capacity_ramp(), 2000.0, 1e-9, 'EP2 ramp capacity (pc/h)');
  exact(seg.get_demand_exceeds_capacity(), false, 'EP2 demand within capacity');
  exact(seg.get_exceeds_max_desirable(), false, 'EP2 v_12 within max desirable');

  // Step 4 (Equation 14-23, Exhibit 14-3)
  approx(seg.get_density(), 27.9, 0.5, 'EP2 D_R (pc/mi/ln)');
  exact(los, 'C', 'EP2 LOS');

  // Step 5 (Exhibits 14-14/14-15): S_R = 52.9, S_O = 62.6, S = 56.0
  approx(seg.get_speed_ramp(), 52.9, 0.5, 'EP2 S_R (mi/h)');
  approx(seg.get_speed_outer(), 62.6, 0.5, 'EP2 S_O (mi/h)');
  approx(seg.get_speed_avg(), 56.0, 0.5, 'EP2 S (mi/h)');
}

// --- HCM Ch.28 Example Problem 3 (first ramp): one-lane on-ramp on an
// eight-lane freeway (FFS = 65 mi/h, ramp FFS = 30 mi/h, L_A = 260 ft).
// The lane-distribution check fails and Equation 14-19 governs:
// v_12a = v_F / 2.50 = 2,570 pc/h. The published all-lane average speed
// (58.8 mi/h) is not reproducible from the published S_R/S_O/flows via
// Exhibit 14-15, so component speeds are asserted instead (as in Rust).
{
  const seg = build(loadCase('MergeDiverge', 'case3.json'));
  const los = seg.run_analysis();

  approx(seg.get_flow_freeway(), 6425.0, 5.0, 'EP3 v_F (pc/h)');
  approx(seg.get_flow_ramp(), 458.0, 2.0, 'EP3 v_R (pc/h)');

  // Step 2: v_F/S_FR = 214 > 72 -> P_FM = 0.2178 - 0.000125 v_R = 0.16;
  // Equation 14-19 adjustment applies.
  approx(seg.get_p_f(), 0.160, 0.002, 'EP3 P_FM');
  approx(seg.get_v12(), 2570.0, 6.0, 'EP3 v_12a (pc/h)');
  approx(seg.get_vr12(), 3028.0, 8.0, 'EP3 v_R12 (pc/h)');

  // Step 3
  approx(seg.get_capacity_freeway(), 9400.0, 1e-9, 'EP3 freeway capacity (pc/h)');
  approx(seg.get_capacity_ramp(), 1900.0, 1e-9, 'EP3 ramp capacity (pc/h)');
  exact(seg.get_demand_exceeds_capacity(), false, 'EP3 demand within capacity');

  // Step 4 (Equation 14-22, Exhibit 14-3)
  approx(seg.get_density(), 27.2, 0.5, 'EP3 D_R (pc/mi/ln)');
  exact(los, 'C', 'EP3 LOS');

  // Step 5 (Exhibit 14-13): S_R = 56.2, S_O = 59.9
  approx(seg.get_speed_ramp(), 56.2, 0.5, 'EP3 S_R (mi/h)');
  approx(seg.get_speed_outer(), 59.9, 0.5, 'EP3 S_O (mi/h)');
}

// --- HCM Ch.28 Example Problem 4: single-lane, left-hand on-ramp on a
// six-lane freeway (FFS = 65 mi/h, ramp FFS = 30 mi/h, L_A = 820 ft).
// v_12 is computed as for a right-hand ramp and multiplied by the
// Exhibit 14-18 factor (1.12), giving v_23 = 3,211 pc/h.
{
  const seg = build(loadCase('MergeDiverge', 'case4.json'));
  const los = seg.run_analysis();

  approx(seg.get_flow_freeway(), 4779.0, 5.0, 'EP4 v_F (pc/h)');
  approx(seg.get_flow_ramp(), 561.0, 2.0, 'EP4 v_R (pc/h)');

  // Step 2: base P_FM = 0.5775 + 0.000028 x 820 = 0.600 (Equation 14-3);
  // Exhibit 14-18 left-hand factor 1.12 applied to v_12.
  approx(seg.get_p_f(), 0.600, 0.002, 'EP4 P_FM');
  approx(seg.get_v12(), 3211.0, 8.0, 'EP4 v_23 (pc/h)');
  approx(seg.get_vr12(), 3772.0, 10.0, 'EP4 v_R23 (pc/h)');

  // Step 3
  approx(seg.get_capacity_freeway(), 7050.0, 1e-9, 'EP4 freeway capacity (pc/h)');
  approx(seg.get_capacity_ramp(), 1900.0, 1e-9, 'EP4 ramp capacity (pc/h)');
  exact(seg.get_demand_exceeds_capacity(), false, 'EP4 demand within capacity');

  // Step 4 (Equation 14-22 with v_23, Exhibit 14-3)
  approx(seg.get_density(), 29.5, 0.5, 'EP4 D_R (pc/mi/ln)');
  exact(los, 'D', 'EP4 LOS');

  // Step 5 (Exhibits 14-13/14-15): S_R = 54.8, S_O = 61.2, S = 56.5
  approx(seg.get_speed_ramp(), 54.8, 0.5, 'EP4 S_R (mi/h)');
  approx(seg.get_speed_outer(), 61.2, 0.5, 'EP4 S_O (mi/h)');
  approx(seg.get_speed_avg(), 56.5, 0.5, 'EP4 S (mi/h)');
}

// --- HCM Ch.28 Example Problem 5: service flow rates and service volumes for
// an isolated single-lane, right-hand on-ramp on a six-lane freeway
// (FFS = 70 mi/h, ramp FFS = 40 mi/h, L_A = 1,000 ft, level terrain).
//
// EP5 has no fixture: the Rust test builds the geometry inline in
// `ep5_template()` and drives it with `ramp_service_flow_rate_ideal` and
// `ramp_service_volumes`. Neither of those free functions, nor the
// `ServiceDemandBasis` enum they take, is exported through the middleware
// shim, so the solver itself has no WASM surface to test. What IS reachable
// through WasmRampSegment is the same equation run forward, and that is what
// this block does: it feeds each published service flow rate back in as demand
// under ideal conditions (PHF = 1, 0% heavy vehicles, so Equation 14-1 passes
// the value through unchanged) and asserts the engine returns the Exhibit 14-3
// threshold density that the book solved for. The published numbers are
// therefore checked at the boundary, but the search that produces them is not,
// and the prevailing-condition SF/SV columns of Exhibits 28-4 and 28-5 stay
// out of reach until `ramp_service_volumes` is bound.
//
// Threshold densities are exact HCM Exhibit 14-3 values. Inverting the check
// also inverts the tolerance, so this file's usual +-0.5 pc/mi/ln band is not
// used here: at these flows it would accept a service flow rate wrong by
// roughly 90 pc/h, which is far looser than the Rust test allows. Equation
// 14-22 is linear in the demands, and the density response was measured at
// 0.0327 pc/mi/ln per 6 pc/h of v_F and 0.0220 per 3 pc/h of v_R, so the
// Rust tolerances of +-6 pc/h (case 1) and +-3 pc/h (case 2) map to +-0.033
// and +-0.022 pc/mi/ln. Worst observed residual is 0.017, at case 1 LOS C,
// which is the book linearizing Equation 14-22 with a rounded slope of
// 0.005454 against the exact 0.0054569 -- the same rounding the Rust test
// widened its flow tolerance to absorb.
const TOL_D_CASE1 = 0.033;
const TOL_D_CASE2 = 0.022;

function ep5(freewayDemand, rampDemand) {
  return new m.WasmRampSegment(
    'OnRamp', 'Right', 1, 3, 70.0, 40.0, 1000.0, undefined,
    undefined, undefined, freewayDemand, rampDemand, 1.0, 0.0, 0.0,
    'Level', 'None', undefined, undefined, 'None', undefined, undefined,
    1.0, 1.0);
}

// Case 1 (Exhibit 28-4): ramp demand fixed at 10% of the approaching freeway
// demand, service flow rates expressed as approaching freeway flows.
{
  // Capacity constraints the whole example rests on: the Chapter 28 text
  // states 7,200 pc/h downstream freeway (FFS = 70) and 2,000 pc/h ramp
  // (ramp FFS = 40), from Exhibits 14-10 and 14-12.
  const cap = ep5(0.0, 0.0);
  cap.run_analysis();
  approx(cap.get_capacity_freeway(), 7200.0, 1.0, 'EP5 downstream freeway capacity (pc/h, Ch.28 text)');
  approx(cap.get_capacity_ramp(), 2000.0, 1.0, 'EP5 ramp capacity (pc/h, Ch.28 text)');

  // Equation 14-3 with L_A = 1,000 ft; the Case 2 text quotes P_FM = 0.6055.
  approx(cap.get_p_f(), 0.6055, 0.002, 'EP5 P_FM (Ch.28 text)');

  // Exhibit 28-4 SFI column, fed back as demand. Each one should land on its
  // Exhibit 14-3 threshold density.
  for (const [los, sfi, threshold] of [['A', 1979.0, 10.0], ['B', 3813.0, 20.0], ['C', 5280.0, 28.0]]) {
    const seg = ep5(sfi, 0.10 * sfi);
    seg.run_analysis();
    approx(seg.get_flow_freeway(), sfi, 5.0, `EP5 case 1 LOS ${los} v_F (pc/h, Exhibit 28-4)`);
    approx(seg.get_density(), threshold, TOL_D_CASE1, `EP5 case 1 LOS ${los} D_R at SFI ${sfi} (pc/mi/ln, Exhibit 14-3)`);
  }

  // LOS E is the capacity limit, not a density limit: the downstream freeway
  // reaches 7,200 pc/h, so v_F = 7,200 / 1.10 = 6,545 pc/h (Exhibit 28-4).
  const sfiE = 6545.0;
  const segE = ep5(sfiE, 0.10 * sfiE);
  segE.run_analysis();
  approx(segE.get_flow_freeway() + segE.get_flow_ramp(), 7200.0, 2.0, 'EP5 case 1 LOS E downstream flow at capacity (pc/h, Exhibit 28-4)');
  exact(0.10 * sfiE < segE.get_capacity_ramp(), true, 'EP5 case 1 LOS E ramp flow (655 pc/h) within ramp capacity');
  exact(segE.get_demand_exceeds_capacity(), false, 'EP5 case 1 LOS E demand within capacity');

  // Exhibit 28-4 reports NA for LOS D: capacity is reached at a density below
  // the 35-pc/mi/ln threshold, so the LOS D service flow rate is unachievable.
  // The book states the conclusion but prints no density for it, so 34.92 is
  // measured from this engine at the published LOS E flow, pinned loosely; the
  // assertion that carries the Exhibit 28-4 claim is the strict inequality.
  approx(segE.get_density(), 34.92, 0.5, 'EP5 case 1 D_R at LOS E capacity (pc/mi/ln, measured; Exhibit 28-4 LOS D = NA)');
  exact(segE.get_density() < 35.0, true, 'EP5 case 1 LOS D unachievable (D_R at capacity below 35)');
}

// Case 2 (Exhibit 28-5): approaching freeway demand held at 4,000 veh/h,
// service flow rates expressed as ramp demands.
{
  // 4,000 veh/h converted to ideal pc/h through Equation 14-1 with PHF = 0.87
  // and f_HV = 1 / (1 + 0.065 (2 - 1)) = 0.939; the Ch.28 text quotes 4,896 pc/h.
  const vF = 4000.0 / (0.87 * (1.0 / (1.0 + 0.065 * (2.0 - 1.0))));
  approx(vF, 4896.0, 2.0, 'EP5 case 2 v_F ideal (pc/h, Ch.28 text)');

  // Exhibit 28-5 reports NA for LOS A and B: even at zero ramp flow the
  // density already exceeds the 20-pc/mi/ln LOS B threshold. The book asserts
  // this without printing the density, so 22.33 is the value the Rust test
  // computes and this engine reproduces; the inequality carries the claim.
  const segZero = ep5(vF, 0.0);
  segZero.run_analysis();
  approx(segZero.get_density(), 22.33, 0.5, 'EP5 case 2 D_R at zero ramp flow (pc/mi/ln, measured; Exhibit 28-5 LOS A/B = NA)');
  exact(segZero.get_density() > 20.0, true, 'EP5 case 2 LOS A and B unachievable (minimum D_R above 20)');

  // LOS C and D ramp service flow rates. Exhibit 28-5 is internally
  // inconsistent: its SFI column prints 769 and 1,723, but its own SF
  // arithmetic in the next column multiplies 772 and 1,726 by 0.939. The Rust
  // test takes the arithmetic values, and so does this block, because the
  // engine agrees with them -- at the tolerance used here the two readings are
  // distinguishable, and the SFI column loses. Measured: 772 gives D_R =
  // 27.997 against the 28 threshold, while 769 gives 27.973, a residual of
  // 0.027 that exceeds the +-0.022 band. Likewise 1,726 gives 35.000 and
  // 1,723 gives 34.975.
  for (const [los, sfi, threshold] of [['C', 772.0, 28.0], ['D', 1726.0, 35.0]]) {
    const seg = ep5(vF, sfi);
    seg.run_analysis();
    approx(seg.get_flow_ramp(), sfi, 3.0, `EP5 case 2 LOS ${los} v_R (pc/h, Exhibit 28-5)`);
    approx(seg.get_density(), threshold, TOL_D_CASE2, `EP5 case 2 LOS ${los} D_R at SFI ${sfi} (pc/mi/ln, Exhibit 14-3)`);
  }

  // LOS E: the downstream-capacity ramp flow (7,200 - 4,896 = 2,304 pc/h)
  // violates the 2,000 pc/h ramp capacity, so LOS E is capped at the ramp
  // capacity (Exhibit 28-5 SFI = 2,000).
  const segE = ep5(vF, 2000.0);
  const losE = segE.run_analysis();
  exact(segE.get_capacity_freeway() - vF > segE.get_capacity_ramp(), true, 'EP5 case 2 LOS E governed by ramp capacity, not downstream freeway');
  approx(Math.min(segE.get_capacity_freeway() - vF, segE.get_capacity_ramp()), 2000.0, 1.0, 'EP5 case 2 LOS E v_R SFI (pc/h, Exhibit 28-5)');
  exact(losE, 'E', 'EP5 case 2 LOS at the capacity-limited ramp flow');
}

report('ch14 merge/diverge (HCM Ch.28 EP1-EP5)');
