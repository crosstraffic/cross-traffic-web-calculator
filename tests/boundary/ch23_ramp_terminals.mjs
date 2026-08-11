// HCM Chapter 23 (Ramp Terminals and Alternative Intersections) through the
// WASM boundary. Expected values and tolerances mirror
// transportations-library/tests/chapter23_integration.rs and the DLT part of
// chapter23_alternative_integration.rs:
// * RampTerminals/case1.json — HCM 7th Ed. Chapter 34, Example Problem 1
//   (conventional diamond; Exhibits 34-3..34-16), via WasmInterchange(cfg).
// * RampTerminals/case2.json — Chapter 34, Example Problem 5 (DDI with
//   signal control; Exhibits 34-62..34-65), via WasmInterchange(cfg).
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

  // Movement control delays, Exhibits 34-14/34-15 (+-1.0 s/veh).
  const delays = [
    ['EbExtThrough', 44.1],
    ['EbIntLeft', 55.0],
    ['EbIntThrough', 7.8],
    ['WbExtThrough', 37.5],
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

  // O-D results against Exhibit 34-16: (O-D, demand, control delay, EDTT,
  // ETT, LOS); delay/ETT +-1.0 s/veh, EDTT +-0.1 s, LOS exact.
  const published = [
    ['A', 233.0, 45.6, 1.9, 47.5, 'C'],
    ['B', 227.0, 43.7, -1.9, 41.8, 'C'],
    ['C', 173.0, 54.6, -1.9, 52.7, 'C'],
    ['D', 206.0, 63.6, 1.9, 65.5, 'D'],
    ['E', 107.0, 99.2, 1.9, 101.1, 'E'],
    ['F', 89.0, 44.2, -1.9, 42.3, 'C'],
    ['G', 150.0, 37.5, -1.9, 35.6, 'C'],
    ['H', 236.0, 82.7, 1.9, 84.6, 'D'],
    ['I', 761.0, 52.0, 0.0, 52.0, 'C'],
    ['J', 650.0, 39.8, 0.0, 39.8, 'C'],
  ];
  for (const [mv, demand, delay, edtt, ett, los] of published) {
    const r = od(ods, mv, 'EP1');
    approx(r.demand, demand, 1.0, `EP1 demand ${mv}`);
    approx(r.control_delay_s, delay, 1.0, `EP1 delay ${mv}`);
    approx(r.edtt_s, edtt, 0.1, `EP1 EDTT ${mv}`);
    approx(r.ett_s, ett, 1.0, `EP1 ETT ${mv}`);
    exact(r.los, los, `EP1 LOS ${mv}`);
    exact(!r.vc_exceeds_one && !r.rq_exceeds_one, true, `EP1 flags ${mv}`);
  }

  // Interchange ETT 52.4 s/veh, LOS C (Exhibit 34-16 totals row).
  approx(ix.get_interchange_ett_s(), 52.4, 1.0, 'EP1 interchange ETT');
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

  // O-D ETT (equation-based expectations, +-0.5 s/veh) and LOS. The Rust
  // test documents the published Exhibit 34-65 values inline; O-D E is the
  // known band difference (computed C vs published B).
  const expected = [
    ['A', 43.5, 'C'], // published 40.1 C
    ['B', 21.4, 'B'], // published 21.0 B
    ['C', 12.1, 'A'], // published 11.4 A
    ['D', 65.5, 'D'], // published 76.3 D
    ['E', 33.9, 'C'], // published 24.7 B (see chapter23_integration.rs notes)
    ['F', 0.0, 'A'],  // free-flow bypass
    ['G', 0.0, 'A'],  // free-flow bypass
    ['H', 38.3, 'C'], // published 50.3 C
    ['I', 47.0, 'C'], // published 45.5 C
    ['J', 55.9, 'D'], // published 66.4 D
  ];
  for (const [mv, ett, los] of expected) {
    const r = od(ods, mv, 'EP5');
    approx(r.ett_s, ett, 0.5, `EP5 ETT ${mv}`);
    exact(r.los, los, `EP5 LOS ${mv}`);
  }

  // Interchange LOS C, demand-weighted ETT within 0.5 s of the published
  // 34.9 s/veh (Exhibit 34-65 totals row).
  exact(ix.get_interchange_los(), 'C', 'EP5 interchange LOS');
  approx(ix.get_interchange_ett_s(), 34.9, 0.5, 'EP5 interchange ETT');
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

report('ch23 ramp terminals + Part C (HCM Ch.34 EP1, EP5, EP12, EP13, EP14, EP15, EP16)');
