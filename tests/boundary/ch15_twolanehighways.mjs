// HCM Chapter 15 (Two-Lane Highways) through the WASM boundary.
// Runs the four TwoLaneHighways fixture cases (case1..case4, the published
// HCM Chapter 15 / Chapter 26 example-problem inputs used by the core tests)
// through WasmSubSegment / WasmSegment / WasmTwoLaneHighways exactly the way
// the production UI does (src/routes/hcm15/+page.svelte), and asserts the same
// step-by-step values as transportations-library/tests/twolanehighways_test.rs.
//
// Known binding footguns exercised here:
// * WasmSubSegment constructor order is (length, avg_speed, design_rad,
//   central_angle, hor_class, sup_ele) — the core SubSegment::new order is
//   (length, avg_speed, hor_class, design_rad, central_angle, sup_ele);
// * SubSegment length is in FEET while Segment length is in miles;
// * spl is the POSTED speed limit, not FFS;
// * horizontal curves only count when is_hc is set on the segment.
//
// Tolerances are the rounding granularity the Rust test asserts against
// (assert_eq on values rounded to N decimals => tolerance 0.5 * 10^-N on the
// raw value; demand flows are asserted as .round() => tolerance 0.5).
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

const CASE_FILES = ['case1.json', 'case2.json', 'case3.json', 'case4.json'];

// Expected values copied verbatim from twolanehighways_test.rs (rows =
// case1..case4 in sorted order, columns = segments).
const EXPECTED = {
  vcMin: [
    [0.25], [0.25],
    [0.25, 0.5, 0.25, 0.25, 0.25],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.25],
  ],
  vcMax: [
    [3.0], [3.0],
    [3.0, 3.0, 3.0, 2.0, 3.0],
    [3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
  ],
  flowI: [
    [800.0], [800.0],
    [904.0, 868.0, 863.0, 851.0, 850.0],
    [1222.0, 1222.0, 1222.0, 1222.0, 1222.0, 1222.0],
  ],
  flowO: [
    [1500.0], [1500.0],
    [1500.0, 0.0, 1500.0, 532.0, 1500.0],
    [1500.0, 1500.0, 1500.0, 1500.0, 0.0, 1500.0],
  ],
  capacity: [
    [1700.0], [1700.0],
    [1700.0, 1500.0, 1700.0, 1700.0, 1700.0],
    [1700.0, 1700.0, 1700.0, 1700.0, 1500.0, 1700.0],
  ],
  verAlign: [
    [1], [1],
    [1, 1, 1, 1, 1],
    [4, 5, 4, 4, 1, 1],
  ],
  ffs: [
    [56.83], [56.83],
    [62.43, 62.43, 62.43, 62.45, 62.43],
    [60.02, 59.04, 60.07, 60.02, 62.43, 62.43],
  ],
  avgSpeed: [
    [53.7], [49.5],
    [58.8, 57.8, 58.9, 59.2, 58.9],
    [47.9, 43.9, 50.8, 49.2, 56.0, 58.3],
  ],
  pf: [
    [67.7], [67.7],
    [69.7, 60.7, 68.0, 67.8, 67.7],
    [86.9, 89.3, 83.9, 86.9, 78.2, 78.4],
  ],
  fd: [
    [10.1], [10.9],
    [10.7, 9.1, 10.0, 9.7, 9.8],
    [22.2, 24.9, 20.2, 21.6, 17.1, 16.4],
  ],
  fdAdj: [
    [0.0], [0.0],
    [0.0, 10.3, 8.3, 8.2, 8.8],
    [0.0, 0.0, 0.0, 0.0, 18.0, 13.2],
  ],
  segLos: [
    ['D'], ['D'],
    ['D', 'B', 'D', 'D', 'D'],
    ['E', 'E', 'E', 'E', 'C', 'E'],
  ],
  // Equation 15-39, from `determine_facility_follower_density`. Same values
  // twolanehighways_test.rs asserts in determine_facility_los_test. case3 is
  // Chapter 26 Example Problem 3, published in Exhibit 26-27 as 7.3
  // followers/mi and LOS C; weighting that exhibit's own per-segment column by
  // length gives (10.7)(0.75) + (2.9)(1.5) + (8.2)(1.0) + (8.2)(0.5) +
  // (8.8)(1.75) = 40.075 over 5.5 mi = 7.3. case4 is Example Problem 4, LOS E
  // in Exhibit 26-36. case1 and case2 are single-segment facilities with no
  // published facility row, so the facility value is the segment value.
  facilityFd: [10.092, 10.933, 7.271, 19.897],
  facilityLos: ['D', 'D', 'C', 'E'],
};

// Build a fresh facility from a fixture through the production constructors.
// Same argument order the Calc page uses; wasm-bindgen consumes the
// WasmSubSegment / WasmSegment instances, so every pass rebuilds from scratch
// (mirroring the fresh state each Rust #[test] starts from).
function buildHighway(c) {
  const segments = c.segments.map((s) => {
    // SubSegment lengths are in FEET (e.g. 280 ft tangent), Segment length in
    // miles. WasmSubSegment reorders (design_rad, central_angle, hor_class)
    // into the core's (hor_class, design_rad, central_angle) internally.
    const subs = (s.subsegments || []).map(
      (ss) => new m.WasmSubSegment(
        ss.length, ss.avg_speed, ss.design_rad, ss.central_angle,
        ss.hor_class, ss.sup_ele)
    );
    return new m.WasmSegment(
      s.passing_type, s.length, s.grade, s.spl, s.is_hc,
      s.volume, s.volume_op, s.flow_rate, s.flow_rate_o, s.capacity,
      s.ffs, s.avg_speed, s.vertical_class, subs,
      s.phf, s.phv, s.pf, s.fd, s.fd_mid, s.hor_class);
  });
  return new m.WasmTwoLaneHighways(
    segments, c.lane_width, c.shoulder_width, c.apd, c.pmhvfl, c.l_de);
}

const cases = CASE_FILES.map((f) => loadCase('TwoLaneHighways', f));

for (let ci = 0; ci < cases.length; ci++) {
  const c = cases[ci];
  const nSeg = c.segments.length;
  const tag = CASE_FILES[ci];

  // Step 1: vertical class range (identify_vertical_class_test).
  {
    const hw = buildHighway(c);
    for (let i = 0; i < nSeg; i++) {
      const [vmin, vmax] = hw.identify_vertical_class(i);
      approx(vmin, EXPECTED.vcMin[ci][i], 1e-9, `${tag} seg${i} vertical class min`);
      approx(vmax, EXPECTED.vcMax[ci][i], 1e-9, `${tag} seg${i} vertical class max`);
    }
  }

  // Step 2: demand flows and capacity (determine_demand_flow_test).
  {
    const hw = buildHighway(c);
    for (let i = 0; i < nSeg; i++) {
      const [fi, fo, cap] = hw.determine_demand_flow(i);
      approx(fi, EXPECTED.flowI[ci][i], 0.5, `${tag} seg${i} demand flow v_i`);
      approx(fo, EXPECTED.flowO[ci][i], 0.5, `${tag} seg${i} opposing flow v_o`);
      approx(cap, EXPECTED.capacity[ci][i], 1e-9, `${tag} seg${i} capacity`);
    }
  }

  // Step 3: vertical alignment class (determine_vertical_alignment_test).
  {
    const hw = buildHighway(c);
    for (let i = 0; i < nSeg; i++) {
      exact(hw.determine_vertical_alignment(i), EXPECTED.verAlign[ci][i],
        `${tag} seg${i} vertical alignment`);
    }
  }

  // Step 4: free-flow speed (determine_free_flow_speed_test; BFFS = 1.14 spl).
  {
    const hw = buildHighway(c);
    for (let i = 0; i < nSeg; i++) {
      hw.determine_demand_flow(i);
      approx(hw.determine_free_flow_speed(i), EXPECTED.ffs[ci][i], 0.005,
        `${tag} seg${i} FFS`);
    }
  }

  // Step 5: average speed (estimate_average_speed_test). case2 differs from
  // case1 only by is_hc + the 11 horizontal subsegments (53.7 -> 49.5 mi/h),
  // so this is the check that the subsegment path through the binding works.
  {
    const hw = buildHighway(c);
    for (let i = 0; i < nSeg; i++) {
      hw.determine_demand_flow(i);
      hw.determine_free_flow_speed(i);
      const [s] = hw.estimate_average_speed(i);
      approx(s, EXPECTED.avgSpeed[ci][i], 0.05, `${tag} seg${i} average speed`);
    }
  }

  // Step 6: percent followers (estimate_percent_followers_test).
  {
    const hw = buildHighway(c);
    for (let i = 0; i < nSeg; i++) {
      hw.determine_demand_flow(i);
      hw.determine_free_flow_speed(i);
      approx(hw.estimate_percent_followers(i), EXPECTED.pf[ci][i], 0.05,
        `${tag} seg${i} percent followers`);
    }
  }

  // Step 7/8: follower density (determine_follower_density_test; PL segments
  // use the passing-lane form, PC/PZ the plain form).
  {
    const hw = buildHighway(c);
    for (let i = 0; i < nSeg; i++) {
      hw.determine_demand_flow(i);
      hw.determine_free_flow_speed(i);
      hw.estimate_average_speed(i);
      hw.estimate_percent_followers(i);
      let fd;
      if (c.segments[i].passing_type === 2) {
        [fd] = hw.determine_follower_density_pl(i);
      } else {
        fd = hw.determine_follower_density_pc_pz(i);
      }
      approx(fd, EXPECTED.fd[ci][i], 0.05, `${tag} seg${i} follower density`);
    }
  }

  // Step 9: adjustment for upstream passing lane
  // (determine_adjustment_to_follower_density_test).
  {
    const hw = buildHighway(c);
    for (let i = 0; i < nSeg; i++) {
      hw.determine_demand_flow(i);
      hw.determine_free_flow_speed(i);
      hw.estimate_average_speed(i);
      hw.estimate_percent_followers(i);
      hw.determine_follower_density_pc_pz(i);
      approx(hw.determine_adjustment_to_follower_density(i),
        EXPECTED.fdAdj[ci][i], 0.05, `${tag} seg${i} FD adjustment`);
    }
  }

  // Step 10: segment LOS (determine_segment_los_test).
  {
    const hw = buildHighway(c);
    for (let i = 0; i < nSeg; i++) {
      const [, , cap] = hw.determine_demand_flow(i);
      hw.determine_free_flow_speed(i);
      const [s] = hw.estimate_average_speed(i);
      hw.estimate_percent_followers(i);
      if (c.segments[i].passing_type === 2) {
        hw.determine_follower_density_pl(i);
      } else {
        hw.determine_follower_density_pc_pz(i);
      }
      exact(hw.determine_segment_los(i, s, cap), EXPECTED.segLos[ci][i],
        `${tag} seg${i} LOS`);
    }
  }

  // Step 11: facility follower density and LOS (Equation 15-39), through
  // `determine_facility_follower_density`, bound in middleware 0.3.6.
  //
  // This block used to weight the per-segment column here, taking fd_mid on a
  // passing lane and the raw fd everywhere else. Equation 15-39 reads
  // "follower density, or adjusted follower density, for segment i", so a
  // segment inside the effective downstream length of a passing lane
  // contributes its Step 9 adjusted density, and reweighting the raw column
  // discards that benefit. It agreed on case1 and case2, and did not on case3
  // (Chapter 26 Example Problem 3), giving 8.041 followers/mi and LOS D where
  // the equation gives 7.271 and LOS C and Exhibit 26-27 publishes 7.3 and C.
  // case4 (Example Problem 4) was wrong by less, 20.219 against 19.897, and
  // stayed inside the LOS E band, so it broke no assertion. That is the shape
  // of the defect: it cost one letter out of four, on one fixture.
  // The hcm15 page never had this defect; it already selected the
  // adjusted density per segment, and its printed facility values do not move.
  //
  // Order matters, and silently. The effective downstream length of a passing
  // lane is facility state, and the Step 9 loop above leaves it set. The
  // binding restores the constructor's value before walking, without which the
  // walk finds it already populated on the segments upstream of the passing
  // lane, whose distance from it is zero, and adjusts them too. The second
  // assertion below is that guard: it reuses a facility that has already been
  // through a full Step 9 loop, which on case4, whose passing lane is fifth of
  // six, otherwise returns 14.936 instead of 19.897.
  {
    const hw = buildHighway(c);
    let totLen = 0, splTot = 0;
    for (let i = 0; i < nSeg; i++) {
      hw.determine_demand_flow(i);
      hw.determine_free_flow_speed(i);
      hw.estimate_average_speed(i);
      hw.estimate_percent_followers(i);
      if (c.segments[i].passing_type === 2) {
        hw.determine_follower_density_pl(i);
      } else {
        hw.determine_follower_density_pc_pz(i);
      }
      const len = c.segments[i].length;
      totLen += len;
      splTot += c.segments[i].spl * len;
    }
    const fdF = hw.determine_facility_follower_density();
    approx(fdF, EXPECTED.facilityFd[ci], 0.0005, `${tag} facility follower density`);
    // Exhibit 15-6 keys its higher/lower-speed bands on the POSTED SPEED
    // LIMIT (its own column headers), so the length-weighted posted limit is
    // passed, matching the library's corrected callers. All four fixtures
    // post 55 uniformly, so this cannot move a letter here; it prevents the
    // latent case (posted >= 50, average speed < 50, FD between the bands).
    exact(hw.determine_facility_los(fdF, splTot / totLen),
      EXPECTED.facilityLos[ci], `${tag} facility LOS`);

    // Same facility, after the caller's own per-segment Step 9 loop.
    for (let i = 0; i < nSeg; i++) hw.determine_adjustment_to_follower_density(i);
    approx(hw.determine_facility_follower_density(), EXPECTED.facilityFd[ci], 0.0005,
      `${tag} facility follower density after a Step 9 loop`);
  }
}

report('ch15 two-lane highways (fixtures case1-case4)');
