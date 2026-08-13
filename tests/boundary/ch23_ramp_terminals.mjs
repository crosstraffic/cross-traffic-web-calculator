// HCM Chapter 23 (Ramp Terminals and Alternative Intersections) through the
// WASM boundary. Expected values and tolerances mirror
// transportations-library/tests/chapter23_integration.rs and the DLT part of
// chapter23_alternative_integration.rs:
// * RampTerminals/case1.json — HCM 7th Ed. Chapter 34, Example Problem 1
//   (conventional diamond; Exhibits 34-3..34-16), via WasmInterchange(cfg).
// * RampTerminals/case2.json — Chapter 34, Example Problem 5 (DDI with
//   signal control; Exhibits 34-62..34-65), via WasmInterchange(cfg).
// * RampTerminals/case6.json — Chapter 34, Example Problem 2 (Parclo A-2Q,
//   I-75 at Newberry Avenue; Exhibits 34-17..34-29), via WasmInterchange(cfg).
// * RampTerminals/case7.json — Chapter 34, Example Problem 7 (single-point
//   urban interchange, I-95 at University Drive; Exhibits 34-72..34-82), via
//   WasmInterchange(cfg).
// * AlternativeIntersections/case4.json dlt block — Chapter 23 Part C
//   Equation 23-69 weighted delay (Chapter 34 Example Problem 16, partial
//   DLT; Exhibit 34-145), via the WasmDisplacedLeftTurn flat constructor.
// * Inline configs — Part C RCUT journeys via WasmAlternativeIntersection:
//   Example Problem 12 (merges, Exhibits 34-123/34-125 with the results in
//   the EP12 prose), Example Problem 13 (STOP, Exhibits 34-128/34-129),
//   Example Problem 14 (signals, Exhibits 34-130/34-133), and MUT Example
//   Problem 15 (Exhibits 34-137/34-138), plus the EDTT / offset helpers.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

function group(groups, mv, label) {
  const g = groups.find((r) => r.movement === mv);
  if (!g) throw new Error(`${label}: lane group ${mv} missing`);
  return g;
}
function od(ods, mv, label) {
  const r = ods.find((o) => o.movement === mv);
  if (!r) throw new Error(`${label}: O-D ${mv} missing`);
  return r;
}

// ── Example Problem 1: conventional diamond (case1.json) ──────────────────
{
  const ix = new m.WasmInterchange(loadCase('RampTerminals', 'case1.json'));
  ix.analyze();
  const groups = ix.lane_group_results_to_js_value();
  const ods = ix.od_results_to_js_value();

  // Adjusted saturation flows (lane-group totals), Exhibits 34-7/34-8,
  // tolerance +-20 veh/h (Equation 19-10 vs split fHV x fg convention).
  const satFlows = [
    ['EbExtThrough', 3700.0],
    ['EbIntThrough', 3568.0],
    ['EbIntLeft', 1703.0],
    ['WbExtThrough', 3637.0],
    ['WbIntThrough', 3535.0],
    ['WbIntLeft', 1767.0],
    ['NbRampLeft', 1749.0],
    ['NbRampRight', 1656.0],
    ['SbRampLeft', 1734.0],
    ['SbRampRight', 1638.0],
  ];
  for (const [mv, s] of satFlows) {
    approx(group(groups, mv, 'EP1').sat_flow, s, 20.0, `EP1 s ${mv}`);
  }

  // Effective greens equal the displayed greens; no downstream-queue or
  // demand-starvation lost time (Exhibits 34-10/34-11).
  const greens = [
    ['EbExtThrough', 63.0],
    ['EbIntThrough', 97.0],
    ['EbIntLeft', 29.0],
    ['WbExtThrough', 63.0],
    ['WbIntThrough', 111.0],
    ['WbIntLeft', 43.0],
    ['NbRampLeft', 53.0],
    ['SbRampLeft', 39.0],
  ];
  for (const [mv, g] of greens) {
    const lg = group(groups, mv, 'EP1');
    approx(lg.effective_green_s, g, 1e-9, `EP1 g ${mv}`);
    approx((lg.downstream_queue_lost_time_s ?? 0) +
      (lg.demand_starvation_lost_time_s ?? 0), 0.0, 1e-9, `EP1 lost time ${mv}`);
  }

  // Movement control delays, Exhibits 34-14/34-15 (+-1.0 s/veh). Column 1 is
  // asserted; the comment carries the published value where the two differ.
  // Only the two 2-lane external throughs differ, and only by the d2 term:
  // library 0.3.1 evaluates the Equation 19-26 incremental delay with the
  // Step 7 lane group capacity instead of the per-lane capacity, which is what
  // the equation's variable list calls for. Example Problem 1 is the one
  // worked example whose published d2 reproduces only per-lane (4.65 against
  // the published 4.6, 2.33 lane-group), so its worksheet is treated as a book
  // defect outvoted by the equation text and by Example Problems 3 and 5.
  const delays = [
    ['EbExtThrough', 41.99], // published 44.1
    ['EbIntLeft', 55.0],
    ['EbIntThrough', 7.8],
    ['WbExtThrough', 34.61], // published 37.5
    ['WbIntLeft', 45.2],
    ['WbIntThrough', 2.3],
    ['NbRampLeft', 43.4],
    ['NbRampRight', 43.4],
    ['SbRampLeft', 55.9],
    ['SbRampRight', 54.6],
  ];
  for (const [mv, d] of delays) {
    approx(group(groups, mv, 'EP1').control_delay_s, d, 1.0, `EP1 d ${mv}`);
  }

  // v/c and queue storage ratios below 1 throughout (Exhibits 34-12/34-13).
  for (const r of groups) {
    exact(r.vc_ratio < 1.0, true, `EP1 ${r.movement} v/c < 1`);
    exact(r.queue_storage_ratio < 1.0, true, `EP1 ${r.movement} R_Q < 1`);
  }

  // O-D results: (O-D, demand, control delay, EDTT, ETT, LOS); delay/ETT
  // +-1.0 s/veh, EDTT +-0.1 s, LOS exact. Column 1 is the asserted engine
  // value; the comment carries the published Exhibit 34-16 (delay, ETT) pair
  // wherever the two differ by more than the tolerance. Every difference is
  // the Equation 19-26 d2 correction above reaching an external through
  // movement: the six O-Ds whose path includes EbExtThrough or WbExtThrough
  // drop by exactly the 2.11 or 2.89 s/veh those lane groups lost, the four
  // that avoid both (A, B, C, D) still reproduce the published values inside
  // tolerance, and every LOS letter still matches the published one.
  const expected = [
    ['A', 233.0, 45.7, 1.9, 47.7, 'C'],
    ['B', 227.0, 43.8, -1.9, 41.8, 'C'],
    ['C', 173.0, 54.6, -1.9, 52.7, 'C'],
    ['D', 206.0, 63.7, 1.9, 65.7, 'D'],
    ['E', 107.0, 97.0, 1.9, 98.9, 'E'], // published 99.2 / 101.1
    ['F', 89.0, 42.0, -1.9, 40.0, 'C'], // published 44.2 /  42.3
    ['G', 150.0, 34.6, -1.9, 32.7, 'C'], // published 37.5 /  35.6
    ['H', 236.0, 79.8, 1.9, 81.8, 'D'], // published 82.7 /  84.6
    ['I', 761.0, 49.8, 0.0, 49.8, 'C'], // published 52.0 /  52.0
    ['J', 650.0, 36.9, 0.0, 36.9, 'C'], // published 39.8 /  39.8
  ];
  for (const [mv, demand, delay, edtt, ett, los] of expected) {
    const r = od(ods, mv, 'EP1');
    approx(r.demand, demand, 1.0, `EP1 demand ${mv}`);
    approx(r.control_delay_s, delay, 1.0, `EP1 delay ${mv}`);
    approx(r.edtt_s, edtt, 0.1, `EP1 EDTT ${mv}`);
    approx(r.ett_s, ett, 1.0, `EP1 ETT ${mv}`);
    exact(r.los, los, `EP1 LOS ${mv}`);
    exact(!r.vc_exceeds_one && !r.rq_exceeds_one, true, `EP1 flags ${mv}`);
  }

  // Interchange ETT 50.7 s/veh against the published 52.4 (Exhibit 34-16
  // totals row), same LOS C. The 1.7 s/veh is the demand-weighted share of the
  // two external-through d2 corrections above.
  approx(ix.get_interchange_ett_s(), 50.7, 1.0, 'EP1 interchange ETT');
  exact(ix.get_interchange_los(), 'C', 'EP1 interchange LOS');
}

// ── Example Problem 5: DDI with signal control (case2.json) ───────────────
{
  const ix = new m.WasmInterchange(loadCase('RampTerminals', 'case2.json'));
  ix.analyze();
  const groups = ix.lane_group_results_to_js_value();
  const ods = ix.od_results_to_js_value();

  // Adjusted saturation flows (Exhibit 34-62 lane-group totals) with the
  // per-movement tolerances documented in the Rust test (f_LU rounding and
  // the Equation 23-15 left-turn form deltas).
  const satFlows = [
    ['EbExtThrough', 3563.0, 55.0],
    ['WbExtThrough', 2045.0, 5.0],
    ['EbIntThrough', 3229.0, 5.0],
    ['WbIntThrough', 3156.0, 5.0],
    ['NbRampLeft', 1682.0, 25.0],
    ['NbRampRight', 1601.0, 5.0],
    ['SbRampLeft', 1674.0, 20.0],
    ['SbRampRight', 1601.0, 5.0],
  ];
  for (const [mv, s, tol] of satFlows) {
    approx(group(groups, mv, 'EP5').sat_flow, s, tol, `EP5 s ${mv}`);
  }

  // Effective green times (Exhibit 34-63 publishes rounded-down values;
  // the engine values asserted here are the Rust-test expectations).
  const greens = [
    ['EbExtThrough', 31.0], // M6
    ['WbExtThrough', 21.0], // M2: published 20 (VERIFY-HCM: 25+5-9)
    ['EbIntThrough', 35.0], // M1
    ['WbIntThrough', 25.0], // M5
    ['NbRampLeft', 24.5],   // M3: published 24
    ['NbRampRight', 20.1],  // M4: published 20
    ['SbRampLeft', 14.5],   // M7: published 14
    ['SbRampRight', 30.1],  // M8: published 30
  ];
  for (const [mv, g] of greens) {
    approx(group(groups, mv, 'EP5').effective_green_s, g, 0.1, `EP5 g ${mv}`);
  }

  // DDIs have no demand starvation lost time (Chapter 23 Step 4).
  approx(group(groups, 'EbIntThrough', 'EP5').demand_starvation_lost_time_s,
    0.0, 1e-12, 'EP5 M1 L_DS');

  // O-D ETT (equation-based expectations, +-0.5 s/veh) and LOS, with the
  // published Exhibit 34-65 values inline. The published movement delays of
  // Exhibit 34-64 are not reproducible from the printed equations (the
  // published uniform delays are inconsistent with Equation 19-19 for M1 / M2
  // / M4 / M5 under any tabulated arrival type), so most of these gaps are not
  // the d2 term. O-D E is the exception and the sharpest test of it: it runs
  // entirely on the 3-lane eastbound external crossover at X = 0.84, and under
  // the Equation 19-26 lane group capacity it now reproduces the published
  // 24.7 s/veh and LOS B exactly, where the per-lane form gave 33.9 and the
  // wrong letter.
  const expected = [
    ['A', 42.7, 'C'], // published 40.1 C
    ['B', 21.4, 'B'], // published 21.0 B
    ['C', 12.1, 'A'], // published 11.4 A
    ['D', 64.8, 'D'], // published 76.3 D
    ['E', 24.7, 'B'], // published 24.7 B
    ['F', 0.0, 'A'],  // free-flow bypass
    ['G', 0.0, 'A'],  // free-flow bypass
    ['H', 31.5, 'C'], // published 50.3 C
    ['I', 37.0, 'C'], // published 45.5 C
    ['J', 48.3, 'C'], // published 66.4 D
  ];
  for (const [mv, ett, los] of expected) {
    const r = od(ods, mv, 'EP5');
    approx(r.ett_s, ett, 0.5, `EP5 ETT ${mv}`);
    exact(r.los, los, `EP5 LOS ${mv}`);
  }

  // Demand-weighted interchange ETT 29.8 s/veh against the published 34.9
  // (Exhibit 34-65 totals row), LOS B against the published C. The Exhibit
  // 23-10 B/C boundary is 30 s/veh, so the aggregate sits 0.2 s/veh on the
  // wrong side of it, carried by the westbound O-Ds whose Exhibit 34-64
  // movement delays are the non-reproducible ones noted above rather than by
  // the Step 9 aggregation itself.
  exact(ix.get_interchange_los(), 'B', 'EP5 interchange LOS');
  approx(ix.get_interchange_ett_s(), 29.8, 0.5, 'EP5 interchange ETT');
}

// ── Example Problem 2: Parclo A-2Q (case6.json) ───────────────────────────
// The first interchange at this boundary that is not the diamond skeleton.
// Each arterial direction has an external through, an external left onto the
// loop quadrant, and an internal shared through-and-right; neither internal
// approach has a left turn at all. Those lane groups can only be named
// because library 0.3.3 made InterchangeMovement a composition of approach,
// position, and turn, so this block is also the check that the composed names
// survive the JSON round trip through wasm.
//
// Tolerances mirror the Rust test: effective greens exact, saturation flows
// +-5 veh/h, capacities +-2, v/c +-0.01, upstream filtering +-0.005, control
// delays +-0.15, O-D ETT +-0.8 against the published Exhibit 34-29 column
// with LOS letters and both flags exact.
{
  const ix = new m.WasmInterchange(loadCase('RampTerminals', 'case6.json'));
  // The form is the one input whose being wrong still produces a plausible
  // answer, so it is read back rather than assumed from the lane groups.
  exact(ix.get_form(), 'ParcloA2Q', 'EP2 interchange form');
  ix.analyze();
  const groups = ix.lane_group_results_to_js_value();
  const ods = ix.od_results_to_js_value();

  // Effective greens, Exhibits 34-24 through 34-26. Every approach carries the
  // same 6 s total lost time, so g' is the displayed green less 1 s and every
  // value is exact. WbExtThrough is the case that needs the green window to
  // wrap the cycle boundary: 95 s of displayed green, not the 90 s the two
  // Exhibit 34-23 rows add up to.
  const greens = [
    ['EbExtThrough', 89.0],
    ['EbExtLeft', 24.0],
    ['EbIntThroughRight', 64.0],
    ['WbExtThrough', 94.0],
    ['WbExtLeft', 24.0],
    ['WbIntThroughRight', 59.0],
    ['NbRampLeft', 34.0],
    ['NbRampRight', 34.0],
    ['SbRampLeft', 39.0],
    ['SbRampRight', 39.0],
  ];
  for (const [mv, g] of greens) {
    approx(group(groups, mv, 'EP2').effective_green_s, g, 0.01, `EP2 g ${mv}`);
  }

  // Neither internal approach is starved and no approach carries additional
  // lost time from a downstream queue: every Exhibit 34-24 DQ clears the 200 ft
  // threshold on an 800 ft internal link. The starvation term is zero for a
  // structural reason rather than an arithmetic one, since a parclo A internal
  // approach has no left turn and every Intersection I phase feeds the
  // eastbound link.
  for (const mv of ['EbExtThrough', 'WbExtThrough', 'NbRampLeft', 'SbRampLeft']) {
    approx(group(groups, mv, 'EP2').downstream_queue_lost_time_s, 0.0, 1e-12, `EP2 L_D ${mv}`);
  }
  for (const mv of ['EbIntThroughRight', 'WbIntThroughRight']) {
    approx(group(groups, mv, 'EP2').demand_starvation_lost_time_s, 0.0, 1e-12, `EP2 L_DS ${mv}`);
  }

  // Saturation flows (Exhibits 34-21/34-22), capacities and v/c (Exhibits
  // 34-25/34-26), Equation 19-6 upstream filtering, and control delays
  // (Exhibits 34-27/34-28), for the eight groups that are not an internal
  // shared through-and-right. The v/c tolerance is +-0.01 rather than the
  // +-0.005 Example Problem 3 gets because the four single-lane ramp groups
  // land 1 to 2 veh/h under the published capacity, the exhibits rounding
  // f_HVg and f_v to three decimals being worth 0.2% of the saturation flow
  // there.
  const rows = [
    ['EbExtThrough', 3786.0, 2407.0, 0.44, 1.00, 13.5],
    ['EbExtLeft', 1798.0, 308.0, 1.02, 1.00, 115.7],
    ['WbExtThrough', 3310.0, 2222.0, 0.56, 1.00, 13.2],
    ['WbExtLeft', 1733.0, 297.0, 0.58, 1.00, 61.6],
    ['NbRampLeft', 1674.0, 407.0, 0.56, 1.00, 52.1],
    ['NbRampRight', 1658.0, 403.0, 0.65, 1.00, 55.7],
    ['SbRampLeft', 1701.0, 474.0, 0.61, 1.00, 49.7],
    ['SbRampRight', 1617.0, 450.0, 0.28, 1.00, 41.1],
  ];
  for (const [mv, s, c, x, i, d] of rows) {
    const r = group(groups, mv, 'EP2');
    approx(r.sat_flow, s, 5.0, `EP2 s ${mv}`);
    approx(r.capacity, c, 2.0, `EP2 c ${mv}`);
    approx(r.vc_ratio, x, 0.01, `EP2 X ${mv}`);
    approx(r.upstream_filtering, i, 0.005, `EP2 I ${mv}`);
    approx(r.control_delay_s, d, 0.15, `EP2 d ${mv}`);
  }

  // Exhibit 34-25: the eastbound external left is the movement that fails, at
  // v/c 1.02 and a queue 1.96 times its 200 ft bay. That pair is what puts
  // O-D F on LOS F below regardless of its travel time.
  const ebl = group(groups, 'EbExtLeft', 'EP2');
  exact(ebl.vc_ratio > 1.0, true, 'EP2 EB EXT-L v/c > 1');
  approx(ebl.queue_storage_ratio, 1.96, 0.01, 'EP2 EB EXT-L R_Q');

  // Book defect 1 of 3 (documented in the library, mirrored here rather than
  // matched): Exhibit 34-22 gives the two internal shared through-and-right
  // groups a lane utilization factor of 1.000 where Chapter 19's Exhibit 19-15
  // default for a three-lane through group is 0.908. Chapter 23 Step 3 sends
  // every non-external approach to Chapter 19, and Example Problems 1, 3, and
  // 4 all print 0.908 in their own f_LU column, so the text and three worked
  // examples outvote one column. Overriding to the published 1.000 reproduces
  // the published saturation flows to within 4 veh/h but makes the O-D table
  // worse, mean absolute error against the ten Exhibit 34-29 ETTs rising from
  // 0.26 to 0.63 s/veh. The engine values are asserted with the published ones
  // inline.
  const internals = [
    ['EbIntThroughRight', 4766.5, 21.03, 0.90], // published s 5,253, d 20.3
    ['WbIntThroughRight', 4784.1, 26.85, 0.81], // published s 5,271, d 26.8
  ];
  for (const [mv, s, d, i] of internals) {
    const r = group(groups, mv, 'EP2');
    approx(r.lane_utilization, 0.908, 1e-9, `EP2 f_LU ${mv}`);
    approx(r.sat_flow, s, 0.5, `EP2 s ${mv}`);
    approx(r.control_delay_s, d, 0.05, `EP2 d ${mv}`);
    approx(r.upstream_filtering, i, 0.005, `EP2 I ${mv}`);
  }

  // Book defects 2 and 3 are inputs rather than outputs, so they leave no cell
  // to assert here and are recorded for the reader. Exhibit 34-25 prints a
  // demand of 1,282 veh/h for the eastbound internal group where the Exhibit
  // 34-163 worksheet composes 1,356, and Exhibit 34-27's own v/c of 0.56 and
  // Exhibit 34-25's own 0.38 veh/s arrival rate both give 1,356. Exhibit
  // 34-20's rightmost-lane utilization shares need an Exhibit 23-24
  // coefficient of 0.655 where the exhibit prints 0.605, the same unprinted
  // value implied independently by both approaches; the fixture therefore
  // supplies the published Exhibit 34-20 factors as overrides (0.7328 EB /
  // 0.6332 WB) and the engine keeps the printed 0.605.

  // O-D results against Exhibit 34-29. This is the routing check for the
  // family: every O-D takes a different turn from its diamond counterpart at
  // one terminal or the other, and the published delay column decomposes into
  // the Exhibit 34-27/34-28 movement delays, which is what fixes the routing.
  // O-D E is the external through plus the internal through-and-right
  // (13.5 + 20.3 = 33.8) where a diamond would send it through an internal
  // left; O-D F is the external left alone (115.7) where a diamond would share
  // it with the external through; O-D A is the ramp left plus the opposite
  // internal through-and-right (52.1 + 26.8 = 78.9).
  const odExpected = [
    ['A', 229.0, 99.5, 'E', false],
    ['B', 263.0, 40.1, 'C', false],
    ['C', 126.0, 25.5, 'B', false],
    ['D', 289.0, 90.6, 'E', false],
    ['E', 198.0, 71.5, 'D', false],
    ['F', 316.0, 136.3, 'F', true],
    ['G', 174.0, 82.2, 'D', false],
    ['H', 368.0, 77.7, 'D', false],
    ['I', 868.0, 33.8, 'C', false],
    ['J', 881.0, 40.0, 'C', false],
  ];
  for (const [mv, demand, ett, los, flagged] of odExpected) {
    const r = od(ods, mv, 'EP2');
    approx(r.demand, demand, 1.0, `EP2 demand ${mv}`);
    approx(r.ett_s, ett, 0.8, `EP2 ETT ${mv}`);
    exact(r.los, los, `EP2 LOS ${mv}`);
    exact(r.vc_exceeds_one, flagged, `EP2 v/c flag ${mv}`);
    exact(r.rq_exceeds_one, flagged, `EP2 R_Q flag ${mv}`);
  }

  // EDTT is the other thing library 0.3.3 added, a per-movement design speed
  // on top of the interchange-wide one. Equation 23-50 defines v_D per
  // diverted movement and this example mixes two: the six diverted O-Ds that
  // stay on the arterial run the 800 ft interchange spacing at 35 mi/h, and
  // the two loop-ramp O-Ds (E and H) run 1,200 ft at 25 mi/h plus the 5 s
  // deceleration/acceleration term. The published Exhibit 34-29 column is
  // 20.6 / -15.6 / 37.7; the engine runs 0.05 s/veh short throughout because
  // Equation 23-50's printed 1.47 conversion leaves the 15.6 s term at 15.55.
  for (const [mv, edtt] of [['A', 20.55], ['B', -15.55], ['E', 37.65], ['H', 37.65], ['I', 0.0]]) {
    approx(od(ods, mv, 'EP2').edtt_s, edtt, 0.05, `EP2 EDTT ${mv}`);
  }

  // Interchange ETT 61.5 s/veh against the published 61.3 (Exhibit 34-29
  // totals row), LOS D either way.
  approx(ix.get_interchange_ett_s(), 61.3, 0.5, 'EP2 interchange ETT');
  exact(ix.get_interchange_los(), 'D', 'EP2 interchange LOS');
}

// ── Example Problem 7: single-point urban interchange (case7.json) ────────
// The first interchange at this boundary with no internal link at all. Every
// approach is external, all six meet at one signal, and the two arterial left
// turns are one lane group running in two phases rather than two lane groups,
// which is the surface library 0.3.4 and middleware 0.3.9 added
// (`protected_permitted_left` in, `protected_sat_flow` and
// `permitted_sat_flow` out). This block is therefore both the SPUI check and
// the check that the two-phase lane group survives the JSON round trip
// through wasm.
//
// Tolerances mirror the Rust test: effective greens exact, the component
// recombination identity to 1e-9, O-D demands +-0.6 veh/h, O-D ETT +-0.05
// s/veh at the engine values with the published Exhibit 34-82 column inline,
// and eight of the ten published LOS letters exact.
{
  const ix = new m.WasmInterchange(loadCase('RampTerminals', 'case7.json'));
  exact(ix.get_form(), 'Spui', 'EP7 interchange form');
  ix.analyze();
  const groups = ix.lane_group_results_to_js_value();
  const ods = ix.od_results_to_js_value();

  // The single-point convention, which is visible from the results alone:
  // every O-D resolves onto exactly one lane group, so there is no extra
  // distance to travel and the O-D's experienced travel time is that
  // movement's control delay unchanged. Exhibit 34-82 shows the same thing by
  // printing its ETT column equal to the Exhibit 34-80/34-81 delays. This is
  // what separates a SPUI from every other form at this boundary and it is
  // asserted to the last bit rather than to a tolerance.
  for (const r of ods) {
    approx(r.edtt_s, 0.0, 1e-12, `EP7 EDTT ${r.movement}`);
    approx(r.ett_s, r.control_delay_s, 1e-12, `EP7 ETT = d ${r.movement}`);
  }
  // ... and the lane group each O-D lands on, by the delay they share.
  const odsLaneGroup = [
    ['A', 'NbRampLeft'], ['B', 'NbRampRight'], ['C', 'SbRampRight'], ['D', 'SbRampLeft'],
    ['E', 'EbExtLeft'], ['F', 'EbExtRight'], ['G', 'WbExtRight'], ['H', 'WbExtLeft'],
    ['I', 'EbExtThrough'], ['J', 'WbExtThrough'],
  ];
  for (const [mv, lg] of odsLaneGroup) {
    approx(od(ods, mv, 'EP7').control_delay_s, group(groups, lg, 'EP7').control_delay_s,
      1e-12, `EP7 O-D ${mv} is ${lg} alone`);
  }

  // Effective greens, Exhibits 34-78 and 34-79. Total lost time is 4 s on
  // every approach, so g' is the displayed green less nothing here: the
  // published g row is the displayed green itself. The two arterial lefts
  // carry the sum of their protected and permitted windows, 16 + 32 = 48 s,
  // which is what Exhibit 34-78 prints for a movement it has already
  // collapsed into one column.
  const greens = [
    ['EbExtLeft', 48.0], ['EbExtThrough', 32.0], ['EbExtRight', 38.0],
    ['WbExtLeft', 48.0], ['WbExtThrough', 32.0], ['WbExtRight', 38.0],
    ['NbRampLeft', 38.0], ['NbRampRight', 16.0],
    ['SbRampLeft', 38.0], ['SbRampRight', 16.0],
  ];
  for (const [mv, g] of greens) {
    approx(group(groups, mv, 'EP7').effective_green_s, g, 1e-9, `EP7 g ${mv}`);
  }

  // The two-phase lane groups, and only those two. A dropped or misspelled
  // `protected_permitted_left` would leave a protected-only left turn that
  // still analyzes and still prints a number, so its arrival is asserted by
  // the fields it produces rather than by the input being present.
  for (const mv of ['EbExtLeft', 'WbExtLeft']) {
    const r = group(groups, mv, 'EP7');
    exact(r.protected_sat_flow > 0, true, `EP7 ${mv} has a protected component`);
    exact(r.permitted_sat_flow > 0, true, `EP7 ${mv} has a permitted component`);
  }
  for (const r of groups) {
    if (r.movement === 'EbExtLeft' || r.movement === 'WbExtLeft') continue;
    exact(r.protected_sat_flow == null && r.permitted_sat_flow == null, true,
      `EP7 ${r.movement} carries no phase components`);
  }

  // Recombination is capacity addition (Exhibit 34-78 collapses the pair into
  // one saturation flow, one capacity and one v/c before Steps 6, 7 and 9 run).
  // The identity is asserted rather than the number, because the number
  // depends on the components and the identity is what the engine promises.
  const C = ix.get_cycle_length_s();
  approx(C, 110.0, 1e-12, 'EP7 cycle length');
  for (const [mv, gProt, gPerm, gU] of [['EbExtLeft', 16.0, 32.0, 13.01], ['WbExtLeft', 16.0, 32.0, 11.78]]) {
    const r = group(groups, mv, 'EP7');
    const sum = r.protected_sat_flow * gProt + r.permitted_sat_flow * gU;
    approx(r.capacity, sum / C, 1e-9, `EP7 ${mv} c = component addition`);
    approx(r.sat_flow, sum / (gProt + gPerm), 1e-9, `EP7 ${mv} s over the summed green`);
  }
  // Exhibit 34-78's published 672 and 661 veh/h are what the same identity
  // gives when it is fed the exhibit's OWN component saturation flows
  // (Exhibit 34-75: 1,560 and 561 eastbound, 1,561 and 573 westbound). They
  // are not what the engine's components give, because the exhibits carry HCM
  // 2000 adjustment factors; that is the defect block below. The arithmetic
  // is pinned here so the two claims cannot be confused for each other.
  for (const [label, sProt, sPerm, gU, published] of [
    ['eastbound', 1560.0, 561.0, 13.01, 672.0],
    ['westbound', 1561.0, 573.0, 11.78, 661.0],
  ]) {
    approx(Math.round((sProt * 16.0 + sPerm * gU) / 48.0), published, 0,
      `EP7 published ${label} components recombine to Exhibit 34-78`);
  }

  // Saturation flow, capacity, v/c, and queue storage ratio. Column 1 is the
  // asserted engine value and the comment carries the published Exhibit 34-78
  // / 34-79 pair, which the engine does not reproduce anywhere on this
  // example. Every published saturation flow is a per-lane figure, so the two
  // through groups are compared against twice the published number.
  //
  // Book defects, all in the saturation flow chain and all documented in the
  // library. Exhibits 34-75 and 34-76 print f_w = 0.967 for the stated 10.3
  // ft lanes; HCM 7's Exhibit 19-20 is a three-tier lookup returning 1.000 for
  // every width from 10.0 to 12.9 ft, and 0.967 is the HCM 2000 continuous
  // form 1 + (W - 12)/30 at 11 ft. Exhibit 34-76 then prints f_HVg = 1.000 on
  // the northbound and southbound approaches, which the example's own text
  // gives 5% heavy vehicles and Equation 19-10 gives 0.961. The two deviations
  // nearly cancel on the ramp approaches, which is why those rows land within
  // 1% and the arterial rows run about 3.5% high. The traffic pressure row
  // reproduces Equation 23-15 exactly for the eight columns that are not a
  // left-turn phase component and for none of the four that are, and it prints
  // different values for the protected and permitted halves of a single
  // movement at a single demand, which the equation cannot do.
  const rows = [
    // movement,          s,      c,     X,      R_Q      published s / c / X / R_Q
    ['EbExtLeft',     714.5,  311.8, 0.5672, 0.500], //   672 /  293 / 0.60 / 0.61
    ['EbExtThrough', 3468.5, 1009.0, 0.9024, 0.561], // 3,352 /  975 / 0.93 / 0.69
    ['EbExtRight',   1552.6,  536.3, 0.1570, 0.067], // 1,659 /  573 / 0.15 / 0.08
    ['WbExtLeft',     697.5,  304.4, 0.6364, 0.584], //   661 /  288 / 0.67 / 0.71
    ['WbExtThrough', 3460.9, 1006.8, 0.8751, 0.527], // 3,346 /  973 / 0.91 / 0.64
    ['WbExtRight',   1583.0,  546.9, 0.4042, 0.198], // 1,673 /  578 / 0.38 / 0.23
    ['NbRampLeft',   1658.4,  572.9, 0.3032, 0.149], // 1,597 /  552 / 0.31
    ['NbRampRight',  1571.0,  228.5, 0.7370, 0.238], // 1,580 /  230 / 0.73
    ['SbRampLeft',   1791.2,  618.8, 0.8846, 0.694], // 1,724 /  596 / 0.92
    ['SbRampRight',  1561.7,  227.2, 0.5561, 0.161], // 1,571 /  228 / 0.55
  ];
  for (const [mv, s, c, x, rq] of rows) {
    const r = group(groups, mv, 'EP7');
    approx(r.sat_flow, s, 0.5, `EP7 s ${mv}`);
    approx(r.capacity, c, 0.5, `EP7 c ${mv}`);
    approx(r.vc_ratio, x, 0.001, `EP7 X ${mv}`);
    approx(r.queue_storage_ratio, rq, 0.002, `EP7 R_Q ${mv}`);
    exact(r.vc_ratio < 1.0, true, `EP7 ${mv} v/c < 1`);
    exact(r.queue_storage_ratio < 1.0, true, `EP7 ${mv} R_Q < 1`);
  }

  // O-D results against Exhibit 34-82. Asserted at the engine values with the
  // published ETT inline, because Exhibits 34-75 and 34-76 are not
  // reproducible from the HCM 7 equations. Eight of the ten published LOS
  // letters land exactly; the two that do not, D and E, are the two sitting
  // closest to an Exhibit 23-10 band edge, D running 5.2 s/veh short of the
  // 55 s C/D line and E 1.8 s/veh short of the 30 s B/C line.
  const odExpected = [
    ['A', 174.0, 27.68, 'B'],   // published 27.9  B
    ['B', 168.0, 64.01, 'D'],   // published 63.6  D
    ['C', 126.0, 53.17, 'C'],   // published 53.0  C
    ['D', 547.0, 50.77, null],  // published 56.0  D; engine C
    ['E', 177.0, 29.18, null],  // published 31.0  C; engine B
    ['F',  84.0, 25.54, 'B'],   // published 25.4  B
    ['G', 221.0, 29.60, 'B'],   // published 29.1  B
    ['H', 194.0, 32.33, 'C'],   // published 34.6  C
    ['I', 911.0, 50.27, 'C'],   // published 54.6  C
    ['J', 881.0, 47.64, 'C'],   // published 51.0  C
  ];
  for (const [mv, demand, ett, los] of odExpected) {
    const r = od(ods, mv, 'EP7');
    approx(r.demand, demand, 0.6, `EP7 demand ${mv}`);
    approx(r.ett_s, ett, 0.05, `EP7 ETT ${mv}`);
    exact(r.vc_exceeds_one, false, `EP7 v/c flag ${mv}`);
    exact(r.rq_exceeds_one, false, `EP7 R_Q flag ${mv}`);
    if (los) exact(r.los, los, `EP7 LOS ${mv}`);
  }

  // Interchange ETT 45.35 s/veh against the published 48.3 (Exhibit 34-82
  // totals row), LOS C either way.
  approx(ix.get_interchange_ett_s(), 45.35, 0.05, 'EP7 interchange ETT');
  exact(ix.get_interchange_los(), 'C', 'EP7 interchange LOS');
}

// ── Example Problem 16: partial DLT weighted delay (Equation 23-69) ───────
// The per-junction flow/delay table of Exhibit 34-145 from the fixture's dlt
// block, through the WasmDisplacedLeftTurn flat constructor (form DltPartial
// => full_dlt false).
{
  const dlt = loadCase('AlternativeIntersections', 'case4.json').dlt;
  const flows = dlt.cells.map((c) => c.flow_veh_h);
  const delaysS = dlt.cells.map((c) => c.control_delay_s);
  const w = new m.WasmDisplacedLeftTurn(
    flows, delaysS, dlt.total_od_demand_veh_h, false);
  approx(w.get_intersection_ett_s(), 28.5, 0.1, 'EP16 DLT ETT');
  exact(w.get_los(), 'C', 'EP16 DLT LOS');
}

// ── Example Problem 12: four-legged RCUT with merges ──────────────────────
// Journeys per the bottom of Exhibit 23-48. The main street runs east-west,
// so the eastbound and westbound movements are the major ones and the
// northbound and southbound movements are the rerouted minor ones. The
// minor-street lefts and throughs meet only free-flow merges, which is why
// the book writes their control delay as "(0 + 0)" and their whole ETT comes
// from the Equation 23-58 extra distance travel time; the two major-street
// left turns are the only movements with control delay, taken from the
// Chapter 20 gap-acceptance results quoted in the example (11.2 and 15.0
// s/veh) since the book does not publish their conflicting flows.
//
// Demands are Exhibit 34-123 (D_t = D_f = 2,000 ft, storage 300 ft, PHF
// 0.92, S_f = 60 mi/h, no trucks or grades). The eastbound and westbound
// left readings are pinned by Exhibit 34-125, whose 130 and 196 veh/h
// crossover flows are 120/0.92 and 180/0.92, and the minor-street approach
// totals by Exhibit 34-124 (250 southbound, 490 northbound). The
// southbound and northbound left/right readings are interchangeable here
// because both approaches carry equal left and right demands.
//
// EP12 publishes its per-movement results as prose rather than a table
// (there is no Exhibit 34-129 equivalent), and it publishes no Equation
// 23-62 intersection aggregate, so nothing is asserted for the aggregate.
{
  const merge = () => ({ type: 'merge' });
  const prov = (d) => ({ type: 'provided', control_delay_s: d });
  const phf = 0.92;
  const edttLeft = m.edtt_merge(2000, 2000, 60, 10);
  const edttThrough = m.edtt_merge(2000, 2000, 60, 15);
  approx(edttLeft, 55.4, 0.05, 'EP12 EDTT minor left (Equation 23-58, a = 10)');
  approx(edttThrough, 60.4, 0.05, 'EP12 EDTT minor through (Equation 23-58, a = 15)');
  const mv = (label, approach, demand, junctions, ed) => ({
    label, approach, demand_veh_h: Math.round(demand / phf), edtt_s: ed, junctions,
  });
  const ix = new m.WasmAlternativeIntersection({
    form: 'RcutFourLeg',
    movements: [
      mv('EB L', 'Eb', 120, [prov(11.2)], 0),
      mv('EB T', 'Eb', 800, [], 0),
      mv('EB R', 'Eb', 220, [], 0),
      mv('WB L', 'Wb', 180, [prov(15.0)], 0),
      mv('WB T', 'Wb', 500, [], 0),
      mv('WB R', 'Wb', 110, [], 0),
      mv('NB L', 'Nb', 200, [merge(), merge()], edttLeft),
      mv('NB T', 'Nb', 90, [merge(), merge()], edttThrough),
      mv('NB R', 'Nb', 200, [merge()], 0),
      mv('SB L', 'Sb', 100, [merge(), merge()], edttLeft),
      mv('SB T', 'Sb', 50, [merge(), merge()], edttThrough),
      mv('SB R', 'Sb', 100, [merge()], 0),
    ],
  });
  const rows = ix.movement_results_to_js_value();
  const expected = [
    ['EB L', 11.2, 'B'], ['WB L', 15.0, 'B'],
    ['EB T', 0.0, 'A'], ['WB T', 0.0, 'A'],
    ['EB R', 0.0, 'A'], ['WB R', 0.0, 'A'],
    ['NB L', 55.4, 'E'], ['SB L', 55.4, 'E'],
    ['NB T', 60.4, 'E'], ['SB T', 60.4, 'E'],
    ['NB R', 0.0, 'A'], ['SB R', 0.0, 'A'],
  ];
  for (const [label, ett, los] of expected) {
    const r = rows.find((x) => x.label === label);
    approx(r.ett_s, ett, 0.05, `EP12 ETT ${label}`);
    exact(r.los, los, `EP12 LOS ${label}`);
  }
  // A merge junction contributes no control delay, which is the whole point
  // of the RCUT-with-merges form: the minor movements pay in distance only.
  for (const label of ['NB L', 'NB T', 'SB L', 'SB T']) {
    const r = rows.find((x) => x.label === label);
    approx(r.total_control_delay_s, 0.0, 1e-12, `EP12 merge delay ${label}`);
  }
}

// ── Example Problem 13: three-legged RCUT with STOP signs ─────────────────
// Movement journeys per the bottom of Exhibit 23-49, with the Exhibit 34-128
// junction inputs (flow-rate conversion, conflicting flows, and adjusted
// headways as the hcm23 page derives them from demands and site parameters).
// Published per-movement results are Exhibit 34-129; junction delays land
// within 0.1 s/veh of the book (which rounds intermediate capacities).
{
  const stop = (flow, vc, tc, tf, storage = null) => ({
    type: 'stop', flow_veh_h: flow, conflicting_flow_veh_h: vc,
    critical_headway_s: tc, followup_headway_s: tf, storage_ft: storage,
  });
  const edtt = m.edtt_stop_or_signal(700, 700, 60);
  approx(edtt, 15.9, 0.1, 'EP13 EDTT (Equation 23-59)');
  const ix = new m.WasmAlternativeIntersection({
    form: 'RcutThreeLeg',
    movements: [
      { label: 'EB L', approach: 'Eb', demand_veh_h: 167, edtt_s: edtt,
        junctions: [stop(344, 444, 7.22, 3.36), stop(167, 1189, 4.4, 2.6, 400)] },
      { label: 'EB R', approach: 'Eb', demand_veh_h: 178, edtt_s: 0,
        junctions: [stop(344, 444, 7.22, 3.36)] },
      { label: 'NB L', approach: 'Nb', demand_veh_h: 189, edtt_s: 0,
        junctions: [stop(189, 1044, 4.22, 2.26, 400)] },
      { label: 'NB T', approach: 'Nb', demand_veh_h: 1000, edtt_s: 0, junctions: [] },
      { label: 'SB T', approach: 'Sb', demand_veh_h: 889, edtt_s: 0, junctions: [] },
      { label: 'SB R', approach: 'Sb', demand_veh_h: 156, edtt_s: 0, junctions: [] },
    ],
  });
  const rows = ix.movement_results_to_js_value();
  const expected = [
    ['EB L', 55.2, 'E'],
    ['EB R', 22.9, 'C'],
    ['NB L', 13.0, 'B'],
    ['NB T', 0.0, 'A'],
    ['SB T', 0.0, 'A'],
    ['SB R', 0.0, 'A'],
  ];
  for (const [label, ett, los] of expected) {
    const r = rows.find((x) => x.label === label);
    approx(r.ett_s, ett, 0.2, `EP13 ETT ${label}`);
    exact(r.los, los, `EP13 LOS ${label}`);
  }
}

// ── Example Problem 15: four-legged MUT ───────────────────────────────────
// Journeys per the middle of Exhibit 23-50 with the Exhibit 34-137 junction
// control delays as provided steps; published results are Exhibit 34-138
// (exact reproduction, since the junction delays enter as inputs).
{
  const prov = (d) => ({ type: 'provided', control_delay_s: d });
  const edtt = m.edtt_stop_or_signal(600, 600, 40);
  approx(edtt, 20.4, 0.1, 'EP15 EDTT (Equation 23-59)');
  const mv = (label, approach, demand, delays, ed) => ({
    label, approach, demand_veh_h: demand, edtt_s: ed, junctions: delays.map(prov),
  });
  const ix = new m.WasmAlternativeIntersection({
    form: 'MutFourLeg',
    movements: [
      mv('NB L', 'Nb', 295, [9.3, 34.6, 13.7], edtt),
      mv('SB L', 'Sb', 53, [12.3, 14.0, 9.4], edtt),
      mv('NB T', 'Nb', 737, [9.3], 0),
      mv('SB T', 'Sb', 1053, [12.3], 0),
      mv('NB R', 'Nb', 63, [9.4], 0),
      mv('SB R', 'Sb', 84, [13.7], 0),
      mv('EB L', 'Eb', 74, [23.7, 14.0, 9.3], edtt),
      mv('WB L', 'Wb', 84, [20.2, 34.6, 12.3], edtt),
      mv('EB T', 'Eb', 421, [25.1], 0),
      mv('WB T', 'Wb', 316, [22.2], 0),
      mv('EB R', 'Eb', 211, [23.7], 0),
      mv('WB R', 'Wb', 53, [20.2], 0),
    ],
  });
  const rows = ix.movement_results_to_js_value();
  const expected = [
    ['NB L', 78.0, 'E'], ['SB L', 56.1, 'E'],
    ['NB T', 9.3, 'A'], ['SB T', 12.3, 'B'],
    ['NB R', 9.4, 'A'], ['SB R', 13.7, 'B'],
    ['EB L', 67.4, 'E'], ['WB L', 87.5, 'F'],
    ['EB T', 25.1, 'C'], ['WB T', 22.2, 'C'],
    ['EB R', 23.7, 'C'], ['WB R', 20.2, 'C'],
  ];
  for (const [label, ett, los] of expected) {
    const r = rows.find((x) => x.label === label);
    approx(r.ett_s, ett, 0.05, `EP15 ETT ${label}`);
    exact(r.los, los, `EP15 LOS ${label}`);
  }
}

// ── Example Problem 14: four-legged RCUT with signals ─────────────────────
// Exhibit 34-132 junction control delays enter as provided steps; journeys
// per the top of Exhibit 23-48; published per-movement results are Exhibit
// 34-133 and the Equation 23-62 aggregate is 79,900 / 3,500 = 22.8 s/veh,
// LOS C. Movements are weighted by FLOW RATE (demand / PHF 0.93), not raw
// demand: the Exhibit 34-130 demands sum to 3,250 veh/h, so the published
// 3,500 total is the flow-rate total, same convention as EP13 and EP15.
// The Exhibit 34-130 turning-movement diagram is ambiguous about L/T/R
// order; the assignment below is the one whose numerator reproduces the
// published 79,900 (computed 79,935 with total 3,497): SB 50/1,900/60,
// NB 150/420/10, EB 20/300/10 as L/T/R, WB right 200 / through 100 /
// left 30 (the WB reading is fixed by the EP14 discussion text).
{
  approx(m.edtt_stop_or_signal(800, 800, 50), 21.8, 0.1, 'EP14 EDTT (Equation 23-59)');
  const prov = (d) => ({ type: 'provided', control_delay_s: d });
  const edtt = m.edtt_stop_or_signal(800, 800, 50);
  const phf = 0.93;
  const mv = (label, approach, demand, delays, ed) => ({
    label, approach, demand_veh_h: Math.round(demand / phf), edtt_s: ed, junctions: delays.map(prov),
  });
  const ix = new m.WasmAlternativeIntersection({
    form: 'RcutFourLeg',
    movements: [
      mv('NB L', 'Nb', 150, [4.1, 33.2], 0),
      mv('SB L', 'Sb', 50, [7.6, 10.8], 0),
      mv('NB T', 'Nb', 420, [4.1, 6.4], 0),
      mv('SB T', 'Sb', 1900, [7.6, 5.4], 0),
      mv('NB R', 'Nb', 10, [4.1, 9.1], 0),
      mv('SB R', 'Sb', 60, [7.6, 0.3], 0),
      mv('EB L', 'Eb', 20, [35.1, 16.1, 6.4], edtt),
      mv('WB L', 'Wb', 30, [12.4, 33.3, 5.4], edtt),
      mv('EB T', 'Eb', 300, [35.1, 16.1, 9.1], edtt),
      mv('WB T', 'Wb', 100, [12.4, 33.3, 0.3], edtt),
      mv('EB R', 'Eb', 10, [35.1], 0),
      mv('WB R', 'Wb', 200, [12.4], 0),
    ],
  });
  const rows = ix.movement_results_to_js_value();
  const expected = [
    ['NB L', 37.3, 'D'], ['SB L', 18.4, 'B'],
    ['NB T', 10.5, 'B'], ['SB T', 13.0, 'B'],
    ['NB R', 13.2, 'B'], ['SB R', 7.9, 'A'],
    ['EB L', 79.4, 'E'], ['WB L', 72.9, 'E'],
    ['EB T', 82.1, 'F'], ['WB T', 67.8, 'E'],
    ['EB R', 35.1, 'D'], ['WB R', 12.4, 'B'],
  ];
  for (const [label, ett, los] of expected) {
    const r = rows.find((x) => x.label === label);
    approx(r.ett_s, ett, 0.05, `EP14 ETT ${label}`);
    exact(r.los, los, `EP14 LOS ${label}`);
  }
  approx(ix.get_intersection_ett_s(), 22.8, 0.1, 'EP14 intersection ETT (Equation 23-62, published 79,900/3,500)');
  exact(ix.get_intersection_los(), 'C', 'EP14 intersection LOS');
}

// ── Example Problem 16: DLT supplemental-intersection offset ──────────────
// Equations 23-63 through 23-68 (published: TT_DLT rounds to 7 s and the
// offset reports as 45 s; unrounded values are 6.8 and 45.2).
{
  const off = m.dlt_offset(350, 35, 0, 52, 0, 0, 65);
  approx(off.tt_dlt_s, 6.8, 0.05, 'EP16 TT_DLT (Equation 23-63)');
  exact(off.st_th_s, 52, 'EP16 ST_TH (Equation 23-65)');
  approx(off.offset_supp_s, 45.2, 0.1, 'EP16 O_SUPP (Equations 23-66 to 23-68)');
}

report('ch23 ramp terminals + Part C (HCM Ch.34 EP1, EP2, EP5, EP7, EP12, EP13, EP14, EP15, EP16)');
