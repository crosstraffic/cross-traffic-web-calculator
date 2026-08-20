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
    c.ramp_type,
    c.ramp_side,
    rampLanes,
    c.freeway_lanes,
    c.freeway_ffs,
    c.ramp_ffs,
    c.accel_lane_length,
    c.accel_lane_length2,
    c.decel_lane_length,
    c.decel_lane_length2,
    c.freeway_demand,
    c.ramp_demand,
    c.phf,
    c.heavy_vehicle_pct,
    c.ramp_heavy_vehicle_pct,
    c.terrain,
    c.adjacent_upstream,
    c.upstream_distance,
    c.upstream_ramp_flow,
    c.adjacent_downstream,
    c.downstream_distance,
    c.downstream_ramp_flow,
    c.caf,
    c.saf,
  );
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
  approx(seg.get_p_f(), 0.16, 0.002, 'EP3 P_FM');
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
  approx(seg.get_p_f(), 0.6, 0.002, 'EP4 P_FM');
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
// `ramp_service_volumes`. Both of those, and the `ServiceDemandBasis` enum they
// take, are bound in middleware 0.3.11, so the solver runs at the boundary in
// the section below this one. This block is the forward check that preceded it
// and it stays as written: it feeds each published service flow rate back in as
// demand under ideal conditions (PHF = 1, 0% heavy vehicles, so Equation 14-1
// passes the value through unchanged) and asserts the engine returns the
// Exhibit 14-3 threshold density that the book solved for. Forward and inverse
// are independent readings of the same exhibits, and the forward one is the
// only one that touches Equation 14-22 through the ordinary segment surface.
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
    'OnRamp',
    'Right',
    1,
    3,
    70.0,
    40.0,
    1000.0,
    undefined,
    undefined,
    undefined,
    freewayDemand,
    rampDemand,
    1.0,
    0.0,
    0.0,
    'Level',
    'None',
    undefined,
    undefined,
    'None',
    undefined,
    undefined,
    1.0,
    1.0,
  );
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
  for (const [los, sfi, threshold] of [
    ['A', 1979.0, 10.0],
    ['B', 3813.0, 20.0],
    ['C', 5280.0, 28.0],
  ]) {
    const seg = ep5(sfi, 0.1 * sfi);
    seg.run_analysis();
    approx(seg.get_flow_freeway(), sfi, 5.0, `EP5 case 1 LOS ${los} v_F (pc/h, Exhibit 28-4)`);
    approx(
      seg.get_density(),
      threshold,
      TOL_D_CASE1,
      `EP5 case 1 LOS ${los} D_R at SFI ${sfi} (pc/mi/ln, Exhibit 14-3)`,
    );
  }

  // LOS E is the capacity limit, not a density limit: the downstream freeway
  // reaches 7,200 pc/h, so v_F = 7,200 / 1.10 = 6,545 pc/h (Exhibit 28-4).
  const sfiE = 6545.0;
  const segE = ep5(sfiE, 0.1 * sfiE);
  segE.run_analysis();
  approx(
    segE.get_flow_freeway() + segE.get_flow_ramp(),
    7200.0,
    2.0,
    'EP5 case 1 LOS E downstream flow at capacity (pc/h, Exhibit 28-4)',
  );
  exact(0.1 * sfiE < segE.get_capacity_ramp(), true, 'EP5 case 1 LOS E ramp flow (655 pc/h) within ramp capacity');
  exact(segE.get_demand_exceeds_capacity(), false, 'EP5 case 1 LOS E demand within capacity');

  // Exhibit 28-4 reports NA for LOS D: capacity is reached at a density below
  // the 35-pc/mi/ln threshold, so the LOS D service flow rate is unachievable.
  // The book states the conclusion but prints no density for it, so 34.92 is
  // measured from this engine at the published LOS E flow, pinned loosely; the
  // assertion that carries the Exhibit 28-4 claim is the strict inequality.
  approx(
    segE.get_density(),
    34.92,
    0.5,
    'EP5 case 1 D_R at LOS E capacity (pc/mi/ln, measured; Exhibit 28-4 LOS D = NA)',
  );
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
  approx(
    segZero.get_density(),
    22.33,
    0.5,
    'EP5 case 2 D_R at zero ramp flow (pc/mi/ln, measured; Exhibit 28-5 LOS A/B = NA)',
  );
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
  for (const [los, sfi, threshold] of [
    ['C', 772.0, 28.0],
    ['D', 1726.0, 35.0],
  ]) {
    const seg = ep5(vF, sfi);
    seg.run_analysis();
    approx(seg.get_flow_ramp(), sfi, 3.0, `EP5 case 2 LOS ${los} v_R (pc/h, Exhibit 28-5)`);
    approx(
      seg.get_density(),
      threshold,
      TOL_D_CASE2,
      `EP5 case 2 LOS ${los} D_R at SFI ${sfi} (pc/mi/ln, Exhibit 14-3)`,
    );
  }

  // LOS E: the downstream-capacity ramp flow (7,200 - 4,896 = 2,304 pc/h)
  // violates the 2,000 pc/h ramp capacity, so LOS E is capped at the ramp
  // capacity (Exhibit 28-5 SFI = 2,000).
  const segE = ep5(vF, 2000.0);
  const losE = segE.run_analysis();
  exact(
    segE.get_capacity_freeway() - vF > segE.get_capacity_ramp(),
    true,
    'EP5 case 2 LOS E governed by ramp capacity, not downstream freeway',
  );
  approx(
    Math.min(segE.get_capacity_freeway() - vF, segE.get_capacity_ramp()),
    2000.0,
    1.0,
    'EP5 case 2 LOS E v_R SFI (pc/h, Exhibit 28-5)',
  );
  exact(losE, 'E', 'EP5 case 2 LOS at the capacity-limited ramp flow');
}

// --- HCM Ch.28 Example Problem 5 through the solver (middleware 0.3.11).
//
// The block above runs Exhibits 28-4 and 28-5 forward, from the published
// service flow rate to the threshold density. This one runs them the way the
// book and the Rust test do, from the threshold density to the service flow
// rate, through `ramp_service_flow_rate_ideal`, and then converts to the
// prevailing-condition SF and SV columns through `ramp_service_volumes`. Those
// two columns had no WASM path at all before 0.3.11.
//
// Tolerances follow chapter14_integration.rs: +-6 pc/h on Case 1 flows and +-3
// on Case 2. The SF and SV bands are not the Rust test's flat +-3 veh/h but the
// flow band carried through the same two multiplications the columns are, since
// that is what the residual is made of. The book computed each SF from its own
// SFI, so an SFI that differs by the full 6 pc/h produces an SF differing by
// 6 x f_HV whatever the engine does; measured against Exhibit 28-4 the worst
// residual is Case 1 LOS C, 3.25 veh/h on SF, which exceeds a flat +-3 and is
// entirely the book carrying its rounded 5,280 forward.
const F_HV = 1.0 / (1.0 + 0.065 * (2.0 - 1.0)); // = 0.939, 6.5% trucks, E_T = 2.0 (level terrain)
const F_P = 1.0; // regular commuters, printed as the "x 1" term in both exhibits
const EP5_PHF = 0.87;

// The template carries geometry only. The solver replaces the demands, PHF,
// heavy-vehicle percentages, CAF and SAF with equivalent ideal conditions
// before each probe, which the control at the end of this section asserts
// rather than assumes.
function ep5Template() {
  return ep5(0.0, 0.0);
}

const TOL_SFI_1 = 6.0;
const TOL_SF_1 = TOL_SFI_1 * F_HV;
const TOL_SV_1 = TOL_SF_1 * EP5_PHF;
const TOL_SFI_2 = 3.0;
const TOL_SF_2 = TOL_SFI_2 * F_HV;
const TOL_SV_2 = TOL_SF_2 * EP5_PHF;

// Case 1 (Exhibit 28-4), solved.
{
  const basis = { ApproachingFreeway: { ramp_fraction: 0.1 } };
  const template = ep5Template();

  // The three achievable rows of Exhibit 28-4, every column.
  for (const [los, threshold, sfiPub, sfPub, svPub] of [
    ['A', 10.0, 1979.0, 1858.0, 1616.0],
    ['B', 20.0, 3813.0, 3580.0, 3115.0],
    ['C', 28.0, 5280.0, 4958.0, 4313.0],
  ]) {
    const sfi = m.ramp_service_flow_rate_ideal(template, basis, threshold);
    approx(sfi, sfiPub, TOL_SFI_1, `EP5 case 1 LOS ${los} SFI solved (pc/h, Exhibit 28-4)`);
    const { sf, sv } = m.ramp_service_volumes(sfi, F_HV, F_P, EP5_PHF);
    approx(sf, sfPub, TOL_SF_1, `EP5 case 1 LOS ${los} SF solved (veh/h, Exhibit 28-4)`);
    approx(sv, svPub, TOL_SV_1, `EP5 case 1 LOS ${los} SV solved (veh/h, Exhibit 28-4)`);
  }

  // LOS E is a capacity limit rather than a density, so it does not come from
  // the solver: v_F = 7,200 / 1.10. Its SF and SV columns do come from
  // ramp_service_volumes, and had no boundary path before 0.3.11.
  const probe = ep5Template();
  probe.run_analysis();
  const sfiE = probe.get_capacity_freeway() / 1.1;
  approx(sfiE, 6545.0, TOL_SFI_1, 'EP5 case 1 LOS E SFI (pc/h, Exhibit 28-4)');
  const eVols = m.ramp_service_volumes(sfiE, F_HV, F_P, EP5_PHF);
  approx(eVols.sf, 6146.0, TOL_SF_1, 'EP5 case 1 LOS E SF (veh/h, Exhibit 28-4)');
  approx(eVols.sv, 5347.0, TOL_SV_1, 'EP5 case 1 LOS E SV (veh/h, Exhibit 28-4)');

  // Exhibit 28-4 prints NA across the LOS D row. The determination is not that
  // density 35 is unreachable -- the solver finds the flow that reaches it --
  // but that capacity is reached first, which is what the book says: "Before
  // densities reach the 35-pc/h/ln threshold for LOS D, the capacity of the
  // merge junction has been reached." So the NA is an inequality between two
  // solved quantities, and both sides are now computed here.
  const sfiD = m.ramp_service_flow_rate_ideal(template, basis, 35.0);
  approx(sfiD, 6559.6, 1.0, 'EP5 case 1 LOS D threshold flow (pc/h, measured; Exhibit 28-4 prints NA)');
  exact(sfiD > sfiE, true, 'EP5 case 1 LOS D is NA (its threshold flow exceeds the LOS E capacity flow)');
  exact(
    0.1 * sfiE < probe.get_capacity_ramp(),
    true,
    'EP5 case 1 LOS E ramp flow (655 pc/h) within the 2,000 pc/h ramp capacity',
  );
}

// Case 2 (Exhibit 28-5), solved.
{
  const vF = 4000.0 / (EP5_PHF * F_HV);
  const basis = { FixedFreeway: { v_f: vF } };
  const template = ep5Template();

  // Exhibit 28-5 prints NA for LOS A and B, and here the solver returns the NA
  // itself rather than an inequality standing in for it: the density at zero
  // ramp flow already exceeds both thresholds, so there is no flow to find.
  // The absence crosses as `undefined`, not `null` -- serde sends None that way
  // -- so a caller guarding on `=== null` would render 22 pc/mi/ln of
  // unavoidable congestion as an achievable LOS A.
  for (const [los, threshold] of [
    ['A', 10.0],
    ['B', 20.0],
  ]) {
    const sfi = m.ramp_service_flow_rate_ideal(template, basis, threshold);
    exact(sfi === undefined, true, `EP5 case 2 LOS ${los} is NA (solver returns no flow, Exhibit 28-5)`);
    exact(sfi === null, false, `EP5 case 2 LOS ${los} NA crosses as undefined rather than null`);
  }

  // LOS C and D, every column.
  const solved = {};
  for (const [los, threshold, sfiArith, sfPub, svPub] of [
    ['C', 28.0, 772.0, 725.0, 631.0],
    ['D', 35.0, 1726.0, 1621.0, 1410.0],
  ]) {
    const sfi = m.ramp_service_flow_rate_ideal(template, basis, threshold);
    solved[los] = sfi;
    approx(sfi, sfiArith, TOL_SFI_2, `EP5 case 2 LOS ${los} SFI solved (pc/h, Exhibit 28-5 SF-column arithmetic)`);
    const { sf, sv } = m.ramp_service_volumes(sfi, F_HV, F_P, EP5_PHF);
    approx(sf, sfPub, TOL_SF_2, `EP5 case 2 LOS ${los} SF solved (veh/h, Exhibit 28-5)`);
    approx(sv, svPub, TOL_SV_2, `EP5 case 2 LOS ${los} SV solved (veh/h, Exhibit 28-5)`);
  }

  // Exhibit 28-5 disagrees with itself: its SFI column prints 769 and 1,723,
  // while the SF column beside it multiplies 772 and 1,726 by 0.939. The
  // forward block above settled this on densities; the solver settles it again
  // from the other direction, and it is the same verdict. Asserted as a
  // comparison rather than as a band, because at +-3 the printed 1,723 is
  // excluded by only 0.03 pc/h, which is too thin to rest a check on. The
  // ratio is not thin: the solved values sit 0.35 and 0.03 pc/h from the
  // arithmetic column and 3.35 and 3.03 from the printed one.
  exact(
    Math.abs(solved.C - 772.0) < Math.abs(solved.C - 769.0),
    true,
    'EP5 case 2 LOS C: solver agrees with the Exhibit 28-5 SF arithmetic (772), not its printed SFI (769)',
  );
  exact(
    Math.abs(solved.D - 1726.0) < Math.abs(solved.D - 1723.0),
    true,
    'EP5 case 2 LOS D: solver agrees with the Exhibit 28-5 SF arithmetic (1,726), not its printed SFI (1,723)',
  );

  // LOS E is capped by the ramp roadway, not by the downstream freeway.
  const probe = ep5Template();
  probe.run_analysis();
  const sfiE = Math.min(probe.get_capacity_freeway() - vF, probe.get_capacity_ramp());
  approx(sfiE, 2000.0, 1.0, 'EP5 case 2 LOS E SFI (pc/h, Exhibit 28-5)');
  const eVols = m.ramp_service_volumes(sfiE, F_HV, F_P, EP5_PHF);
  approx(eVols.sf, 1878.0, TOL_SF_2, 'EP5 case 2 LOS E SF (veh/h, Exhibit 28-5)');
  approx(eVols.sv, 1633.0, TOL_SV_2, 'EP5 case 2 LOS E SV (veh/h, Exhibit 28-5)');
}

// --- What the solver binding reads off the template, and what it refuses.
{
  const basis = { ApproachingFreeway: { ramp_fraction: 0.1 } };

  // The template is borrowed, not consumed: the same handle answers repeated
  // probes. If it were moved, the second call would throw on a null pointer and
  // every loop above would have to rebuild it.
  const shared = ep5Template();
  const first = m.ramp_service_flow_rate_ideal(shared, basis, 28.0);
  const second = m.ramp_service_flow_rate_ideal(shared, basis, 28.0);
  exact(first === second, true, 'EP5 solver borrows the template (repeated probes on one handle agree)');

  // The demands, PHF and heavy-vehicle percentages on the template are replaced
  // by equivalent ideal conditions inside the search, so a template built with
  // a real peak hour returns the same LOS C flow as the empty one. This is the
  // one thing about the surface a caller could get silently wrong, since a
  // template that DID carry its demands through would still return a number.
  const dirty = new m.WasmRampSegment(
    'OnRamp',
    'Right',
    1,
    3,
    70.0,
    40.0,
    1000.0,
    undefined,
    undefined,
    undefined,
    9999.0,
    8888.0,
    0.5,
    0.3,
    0.3,
    'Level',
    'None',
    undefined,
    undefined,
    'None',
    undefined,
    undefined,
    1.0,
    1.0,
  );
  approx(
    m.ramp_service_flow_rate_ideal(dirty, basis, 28.0),
    first,
    1e-9,
    'EP5 solver ignores the template demands, PHF and truck percentages',
  );

  // The control on that control: geometry is not ignored. Shortening the
  // acceleration lane from 1,000 ft to 300 ft moves P_FM and with it the LOS C
  // service flow rate by roughly 675 pc/h, so the template is being read.
  const shortAccel = new m.WasmRampSegment(
    'OnRamp',
    'Right',
    1,
    3,
    70.0,
    40.0,
    300.0,
    undefined,
    undefined,
    undefined,
    0.0,
    0.0,
    1.0,
    0.0,
    0.0,
    'Level',
    'None',
    undefined,
    undefined,
    'None',
    undefined,
    undefined,
    1.0,
    1.0,
  );
  approx(
    m.ramp_service_flow_rate_ideal(shortAccel, basis, 28.0),
    4601.4,
    1.0,
    'EP5 solver reads the template geometry (L_A = 300 ft moves LOS C SFI)',
  );

  // Refusals. A non-finite target or basis parameter is the one input that
  // produces a finished-looking answer rather than a failure: every density
  // comparison inside the search is false against a NaN, so the bisection
  // collapses to a service flow rate of zero instead of returning the NA.
  for (const [label, b, target] of [
    ['NaN target density', basis, NaN],
    ['zero target density', basis, 0.0],
    ['negative target density', basis, -28.0],
    ['NaN ramp_fraction', { ApproachingFreeway: { ramp_fraction: NaN } }, 28.0],
    ['negative v_f', { FixedFreeway: { v_f: -1.0 } }, 28.0],
    ['unknown variant name', { Bogus: { x: 1.0 } }, 28.0],
    ['misspelled v_f', { FixedFreeway: { vf: 4896.0 } }, 28.0],
    ['both variants at once', { ApproachingFreeway: { ramp_fraction: 0.1 }, FixedFreeway: { v_f: 4896.0 } }, 28.0],
    ['basis is not an object', 'ApproachingFreeway', 28.0],
  ]) {
    let threw = false;
    try {
      m.ramp_service_flow_rate_ideal(shared, b, target);
    } catch {
      threw = true;
    }
    exact(threw, true, `EP5 solver rejects ${label}`);
  }
}

// ===========================================================================
// HCM Edition 7.1
//
// Edition 7.1 replaced Chapter 14 outright. Its Chapter 28 keeps the same
// example problem numbering but the problems themselves and the model behind
// them are different, so these are new cases rather than the ones above
// re-run. Expected values and tolerances mirror
// transportations-library/tests/chapter14_v7_1_integration.rs and cite the
// page of the Edition 7.1 Chapter 28 extract each number comes from. No
// fixture files exist for these, so the inputs are literal.
//
// version is argument 25, the LAST one. Note that accel_lane_length2 and
// decel_lane_length2 sit at positions 8 and 10, between the two lengths that
// are actually used here. build71 does that counting once.
// heavy_vehicle_pct and ramp_heavy_vehicle_pct are DECIMAL shares.
// ===========================================================================

function build71(o) {
  return new m.WasmRampSegment(
    o.ramp_type,
    o.ramp_side ?? 'Right',
    o.ramp_lanes ?? 1,
    o.freeway_lanes,
    o.freeway_ffs,
    o.ramp_ffs,
    o.accel_lane_length,
    undefined,
    o.decel_lane_length,
    undefined,
    o.freeway_demand,
    o.ramp_demand,
    o.phf,
    o.heavy_vehicle_pct,
    o.ramp_heavy_vehicle_pct,
    o.terrain ?? 'Level',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    o.version ?? '7.1',
  );
}

// --- Ch.28 EP1 (p. 28-2): isolated one-lane, right-hand on-ramp to a
// four-lane freeway. The per-lane demand is above the breakpoint, so S_b
// comes off the curved part of Equation 12-1.
{
  const seg = build71({
    ramp_type: 'OnRamp',
    freeway_lanes: 2,
    freeway_ffs: 60.0,
    ramp_ffs: 45.0,
    accel_lane_length: 740.0,
    freeway_demand: 2500.0,
    ramp_demand: 535.0,
    phf: 0.9,
    heavy_vehicle_pct: 0.05,
  });
  exact(seg.version, '7.1', 'EP1 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  approx(a.flow_freeway, 2918.0, 2.0, 'EP1 7.1 v_F (pc/h, p. 28-3)');
  approx(a.flow_ramp, 624.0, 1.0, 'EP1 7.1 v_R (pc/h, p. 28-3)');
  approx(a.flow_influence, 3542.0, 3.0, 'EP1 7.1 v (pc/h, p. 28-3)');
  approx(a.flow_per_lane, 1771.0, 2.0, 'EP1 7.1 v/N (pc/h/ln, p. 28-3)');
  approx(a.breakpoint_adj, 1600.0, 1e-9, 'EP1 7.1 BP_adj (pc/h/ln, p. 28-4)');
  approx(a.capacity_basic_adj, 2300.0, 1e-9, 'EP1 7.1 C_b,adj (pc/h/ln, p. 28-4)');
  approx(a.speed_basic, 59.47, 0.02, 'EP1 7.1 S_b (mi/h, p. 28-4)');
  approx(a.speed_impedance, 4.37, 0.02, 'EP1 7.1 SIM (mi/h, p. 28-4)');
  approx(a.speed_avg, 55.1, 0.03, 'EP1 7.1 S_M (mi/h, p. 28-4)');
  approx(a.capacity_per_lane, 1882.0, 3.0, 'EP1 7.1 C_M (pc/h/ln, p. 28-5)');
  approx(a.dc_ratio, 0.94, 0.005, 'EP1 7.1 d/c (p. 28-5)');
  approx(a.capacity_neighboring_freeway, 4600.0, 1e-9, 'EP1 7.1 downstream freeway capacity (pc/h, Exhibit 14-8)');
  approx(a.capacity_ramp_roadway, 2100.0, 1e-9, 'EP1 7.1 ramp roadway capacity (pc/h, Exhibit 14-10)');
  exact(a.demand_exceeds_capacity, false, 'EP1 7.1 demand within capacity');
  approx(a.density, 32.1, 0.1, 'EP1 7.1 D_M (pc/mi/ln, p. 28-6)');
  exact(los, 'E', 'EP1 7.1 LOS (Exhibit 14-2)');

  // The 7th Edition step methods are refused on a 7.1 segment rather than
  // answering from a model that no longer applies.
  let threw = false;
  try {
    seg.determine_demand_flow();
  } catch {
    threw = true;
  }
  exact(threw, true, 'EP1 7.1 segment refuses the 7th Edition step methods');
}

// --- Ch.28 EP2, first off-ramp (p. 28-6): one of two adjacent one-lane,
// right-hand off-ramps on a six-lane freeway. Edition 7.1 analyzes each ramp
// independently and applies the worse LOS to the overlapping influence area.
{
  const seg = build71({
    ramp_type: 'OffRamp',
    freeway_lanes: 3,
    freeway_ffs: 60.0,
    ramp_ffs: 40.0,
    decel_lane_length: 500.0,
    freeway_demand: 4500.0,
    ramp_demand: 300.0,
    phf: 0.95,
    heavy_vehicle_pct: 0.075,
  });
  exact(seg.version, '7.1', 'EP2a 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  approx(a.flow_freeway, 5093.0, 3.0, 'EP2a v_F (pc/h, p. 28-7)');
  approx(a.flow_ramp, 340.0, 1.0, 'EP2a v_R1 (pc/h, p. 28-7)');
  // A diverge's influence-area flow is the MAINLINE flow. The exiting
  // vehicles are already inside it, so v_R is not added: 5,093 and not the
  // 5,433 a merge-shaped reading would produce.
  approx(a.flow_influence, 5093.0, 3.0, 'EP2a v_1 is the mainline flow, not v_F + v_R (p. 28-7)');
  exact(Math.abs(a.flow_influence - 5433.0) > 300.0, true, 'EP2a v_1 is not v_F + v_R');
  approx(a.flow_per_lane, 1698.0, 2.0, 'EP2a v_1/N (pc/h/ln, p. 28-7)');
  approx(a.speed_basic, 59.83, 0.02, 'EP2a S_b (mi/h, p. 28-8)');
  approx(a.speed_impedance, 2.04, 0.02, 'EP2a SID (mi/h, p. 28-8)');
  approx(a.speed_avg, 57.79, 0.03, 'EP2a S_D (mi/h, p. 28-8)');
  approx(a.capacity_per_lane, 1940.0, 3.0, 'EP2a C_D (pc/h/ln, p. 28-9)');
  approx(a.capacity_neighboring_freeway, 6900.0, 1e-9, 'EP2a upstream freeway capacity (pc/h)');
  approx(a.capacity_ramp_roadway, 2000.0, 1e-9, 'EP2a ramp roadway capacity (pc/h)');
  exact(a.demand_exceeds_capacity, false, 'EP2a demand within capacity');
  approx(a.density, 29.4, 0.1, 'EP2a D_D (pc/mi/ln, p. 28-10)');
  exact(los, 'D', 'EP2a LOS (Exhibit 14-2)');
}

// --- Ch.28 EP2, second off-ramp (p. 28-9). Its per-lane demand of 1,584
// pc/h/ln falls just below the 1,600 pc/h/ln breakpoint, so the equivalent
// basic segment runs at the adjusted FFS.
{
  const seg = build71({
    ramp_type: 'OffRamp',
    freeway_lanes: 3,
    freeway_ffs: 60.0,
    ramp_ffs: 25.0,
    decel_lane_length: 300.0,
    // DERIVED, not a stated input: the mainline reaching the second ramp is
    // the original demand less what left at the first, 4,500 - 300 = 4,200
    // veh/h. The manual does that subtraction in prose on p. 28-9.
    freeway_demand: 4200.0,
    ramp_demand: 500.0,
    phf: 0.95,
    heavy_vehicle_pct: 0.075,
  });
  exact(seg.version, '7.1', 'EP2b 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  approx(a.flow_freeway, 4753.0, 3.0, 'EP2b v_2 (pc/h, p. 28-9)');
  approx(a.flow_ramp, 566.0, 1.0, 'EP2b v_R2 (pc/h, p. 28-9)');
  approx(a.flow_per_lane, 1584.0, 2.0, 'EP2b v_2/N (pc/h/ln, p. 28-9)');
  // Below the breakpoint, so the basic segment runs at the adjusted FFS.
  approx(a.speed_basic, 60.0, 1e-9, 'EP2b S_b (mi/h, p. 28-9)');
  approx(a.speed_impedance, 4.04, 0.02, 'EP2b SID (mi/h, p. 28-9)');
  approx(a.speed_avg, 55.96, 0.03, 'EP2b S_D (mi/h, p. 28-9)');
  approx(a.capacity_per_lane, 1874.0, 3.0, 'EP2b C_D (pc/h/ln, p. 28-10)');
  approx(a.capacity_ramp_roadway, 1900.0, 1e-9, 'EP2b ramp roadway capacity (pc/h)');
  exact(a.demand_exceeds_capacity, false, 'EP2b demand within capacity');
  approx(a.density, 28.3, 0.1, 'EP2b D_D (pc/mi/ln, p. 28-10)');
  exact(los, 'D', 'EP2b LOS (Exhibit 14-2)');
}

// --- Ch.28 EP3, first ramp (p. 28-11): a one-lane on-ramp on an eight-lane
// freeway, 1,300 ft upstream of a one-lane off-ramp. No auxiliary lane joins
// them, so each is an independent junction. The freeway carries 10% trucks
// and the on-ramp 5%, which is what ramp_heavy_vehicle_pct is for.
{
  const seg = build71({
    ramp_type: 'OnRamp',
    freeway_lanes: 4,
    freeway_ffs: 65.0,
    ramp_ffs: 30.0,
    accel_lane_length: 260.0,
    freeway_demand: 5490.0,
    ramp_demand: 410.0,
    phf: 0.94,
    heavy_vehicle_pct: 0.1,
    ramp_heavy_vehicle_pct: 0.05,
  });
  exact(seg.version, '7.1', 'EP3-merge 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  approx(a.flow_freeway, 6425.0, 3.0, 'EP3-merge v_F (pc/h, p. 28-12)');
  approx(a.flow_ramp, 458.0, 1.0, 'EP3-merge v_R1 (pc/h, p. 28-12)');
  approx(a.flow_influence, 6883.0, 4.0, 'EP3-merge v_1 (pc/h, p. 28-12)');
  approx(a.flow_per_lane, 1721.0, 1.0, 'EP3-merge v_1/N (pc/h/ln, p. 28-12)');
  approx(a.breakpoint_adj, 1400.0, 1e-9, 'EP3-merge BP_adj (pc/h/ln, p. 28-13)');
  approx(a.capacity_basic_adj, 2350.0, 1e-9, 'EP3-merge C_b,adj (pc/h/ln, p. 28-13)');
  approx(a.speed_basic, 63.54, 0.02, 'EP3-merge S_b (mi/h, p. 28-13)');
  approx(a.speed_impedance, 8.77, 0.02, 'EP3-merge SIM (mi/h, p. 28-13)');
  approx(a.speed_avg, 54.77, 0.03, 'EP3-merge S_M (mi/h, p. 28-13)');
  approx(a.capacity_per_lane, 1841.0, 3.0, 'EP3-merge C_M (pc/h/ln, p. 28-14)');
  approx(a.capacity_neighboring_freeway, 9400.0, 1e-9, 'EP3-merge downstream freeway capacity (pc/h, p. 28-15)');
  approx(a.capacity_ramp_roadway, 1900.0, 1e-9, 'EP3-merge ramp roadway capacity (pc/h, p. 28-16)');
  exact(a.demand_exceeds_capacity, false, 'EP3-merge demand within capacity');
  approx(a.density, 31.4, 0.1, 'EP3-merge D_M (pc/mi/ln, p. 28-16)');
  exact(los, 'E', 'EP3-merge LOS (Exhibit 14-2)');
}

// --- Ch.28 EP3, second ramp (p. 28-13). Its mainline flow is the flow
// departing the merge influence area, which the manual carries forward as
// v_2 = 6,883 pc/h. That is already a flow rate under equivalent base
// conditions, so it is fed in with PHF = 1.00 and no heavy vehicles. It
// cannot be re-derived in veh/h, because the two upstream demands carry
// different truck percentages and so cannot be summed.
{
  const seg = build71({
    ramp_type: 'OffRamp',
    freeway_lanes: 4,
    freeway_ffs: 65.0,
    ramp_ffs: 25.0,
    decel_lane_length: 260.0,
    freeway_demand: 6883.0,
    ramp_demand: 702.0,
    phf: 1.0,
    heavy_vehicle_pct: 0.0,
  });
  exact(seg.version, '7.1', 'EP3-diverge 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  approx(a.flow_freeway, 6883.0, 1e-9, 'EP3-diverge v_2 (pc/h, p. 28-12)');
  approx(a.flow_ramp, 702.0, 1e-9, 'EP3-diverge v_R2 (pc/h, p. 28-12)');
  approx(a.flow_influence, 6883.0, 1e-9, 'EP3-diverge v_2 is the mainline flow, not v_2 + v_R2 (p. 28-12)');
  approx(a.flow_per_lane, 1721.0, 1.0, 'EP3-diverge v_2/N (pc/h/ln, p. 28-12)');
  approx(a.speed_basic, 63.54, 0.02, 'EP3-diverge S_b (mi/h, p. 28-13)');
  approx(a.speed_impedance, 6.09, 0.02, 'EP3-diverge SID (mi/h, p. 28-14)');
  approx(a.speed_avg, 57.45, 0.03, 'EP3-diverge S_D (mi/h, p. 28-14)');
  approx(a.capacity_per_lane, 1904.0, 3.0, 'EP3-diverge C_D (pc/h/ln, p. 28-15)');
  approx(a.capacity_neighboring_freeway, 9400.0, 1e-9, 'EP3-diverge upstream freeway capacity (pc/h, p. 28-15)');
  approx(a.capacity_ramp_roadway, 1900.0, 1e-9, 'EP3-diverge ramp roadway capacity (pc/h, p. 28-16)');
  exact(a.demand_exceeds_capacity, false, 'EP3-diverge demand within capacity');
  approx(a.density, 29.95, 0.05, 'EP3-diverge D_D (pc/mi/ln, p. 28-16)');
  exact(los, 'D', 'EP3-diverge LOS (Exhibit 14-2)');
}

// --- Ch.28 EP4 (p. 28-18): a one-lane, LEFT-hand on-ramp on a six-lane
// freeway. Edition 7.1 makes no computational distinction between left- and
// right-hand junctions, so this case is here for its published values and to
// pin that ramp_side does not move them.
{
  const seg = build71({
    ramp_type: 'OnRamp',
    ramp_side: 'Left',
    freeway_lanes: 3,
    freeway_ffs: 65.0,
    ramp_ffs: 30.0,
    accel_lane_length: 820.0,
    freeway_demand: 4000.0,
    ramp_demand: 490.0,
    phf: 0.9,
    heavy_vehicle_pct: 0.075,
    ramp_heavy_vehicle_pct: 0.03,
  });
  exact(seg.version, '7.1', 'EP4 7.1 segment reports version 7.1');

  const los = seg.run_analysis();
  const a = seg.analysis_v7_1();

  approx(a.flow_freeway, 4779.0, 3.0, 'EP4 v_F (pc/h, p. 28-19)');
  approx(a.flow_ramp, 561.0, 1.0, 'EP4 v_R (pc/h, p. 28-19)');
  approx(a.flow_influence, 5340.0, 4.0, 'EP4 v (pc/h, p. 28-19)');
  approx(a.flow_per_lane, 1780.0, 2.0, 'EP4 v/N (pc/h/ln, p. 28-19)');
  approx(a.breakpoint_adj, 1400.0, 1e-9, 'EP4 BP_adj (pc/h/ln, p. 28-19)');
  approx(a.capacity_basic_adj, 2350.0, 1e-9, 'EP4 C_b,adj (pc/h/ln, p. 28-19)');
  approx(a.speed_basic, 62.96, 0.02, 'EP4 S_b (mi/h, p. 28-19)');
  approx(a.speed_impedance, 3.57, 0.02, 'EP4 SIM (mi/h, p. 28-20)');
  approx(a.speed_avg, 59.39, 0.03, 'EP4 S_M (mi/h, p. 28-20)');
  approx(a.capacity_per_lane, 1970.0, 3.0, 'EP4 C_M (pc/h/ln, p. 28-21)');
  approx(a.capacity_neighboring_freeway, 7050.0, 1e-9, 'EP4 downstream freeway capacity (pc/h, p. 28-21)');
  approx(a.capacity_ramp_roadway, 1900.0, 1e-9, 'EP4 ramp roadway capacity (pc/h, p. 28-21)');
  exact(a.demand_exceeds_capacity, false, 'EP4 demand within capacity');
  approx(a.density, 29.97, 0.05, 'EP4 D_M (pc/mi/ln, p. 28-21)');
  exact(los, 'D', 'EP4 LOS (Exhibit 14-2)');

  // Same junction on the right side: identical under Edition 7.1. If a later
  // edition or a fix gives the side an effect, this check is where it shows.
  const right = build71({
    ramp_type: 'OnRamp',
    ramp_side: 'Right',
    freeway_lanes: 3,
    freeway_ffs: 65.0,
    ramp_ffs: 30.0,
    accel_lane_length: 820.0,
    freeway_demand: 4000.0,
    ramp_demand: 490.0,
    phf: 0.9,
    heavy_vehicle_pct: 0.075,
    ramp_heavy_vehicle_pct: 0.03,
  });
  right.run_analysis();
  approx(right.analysis_v7_1().density, a.density, 1e-9, 'EP4 ramp side does not move the 7.1 density');
}

report('ch14 merge/diverge (HCM Ch.28 EP1-EP5 7e, EP1-EP4 7.1)');
