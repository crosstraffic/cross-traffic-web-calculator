// HCM Chapter 14 freeway merge and diverge segments through the WASM
// boundary, run against HCM Chapter 28 Example Problems 1-4. Expected values
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

report('ch14 merge/diverge (HCM Ch.28 EP1-EP4)');
