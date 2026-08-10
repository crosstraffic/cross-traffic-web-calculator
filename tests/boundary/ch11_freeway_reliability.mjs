// HCM Chapter 25, Example Problem 7 (Chapter 11 freeway reliability,
// Exhibits 25-97 .. 25-105) through the WASM boundary, mirroring
// transportations-library/tests/chapter11_integration.rs for the subset the
// binding can express.
//
// BINDING SCOPE (what the Rust test uses that the WASM surface cut):
// - Weather is not exposed at all, so EP7's Exhibit 25-101/25-102 inputs
//   and the 27 expected weather events (Equation 25-76) are core-only, and
//   the Exhibit 25-104 distribution metrics (TTI_mean 1.30, PTI 1.67,
//   misery 5.76, rating 90.8 ...) are NOT mirrored here: without weather the
//   distribution is a different (milder) experiment. Metrics are checked as
//   invariants plus coarse sanity bands only.
// - Custom demand multipliers are not exposed; the binding always uses the
//   Exhibit 11-18 urban ratios, while EP7 uses Exhibit 25-100 (the same
//   table rescaled to an ADT base and re-rounded, so DAF ratios agree to
//   ~0.2% but not exactly; e.g. July Friday 1.62/1.21 = 1.3388 here vs the
//   Rust-asserted 1.329/0.995 = 1.3357).
// - Work zones / special events / ATDM strategies are not exposed, so the
//   two Chapter 37 direction-of-effect tests are core-only.
// - The reliability constructor cannot pass jam_density_pc,
//   queue_discharge_drop, total_ramp_density, or interchange_density to its
//   internal facility (WasmFreewayFacility can). For this fixture only
//   interchange_density matters: the binding falls back to
//   total_ramp_density (default 1.0) instead of the fixture's 0.8, which
//   shifts the weaving-segment speed model slightly in every scenario. The
//   seed-date equality check below therefore compares against a Chapter 10
//   facility built exactly the way the reliability binding builds its own.
// Everything else in the fixture matches binding defaults exactly: weekdays
// Mon-Fri, 4 replications, seed Nov/Tuesday, CR 150 with ICR 7.0, the
// Equation 25-85 severity distribution, rng seed 1, VMT weighting.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();
const fx = loadCase('FreewayReliability', 'case1.json');
const fac = fx.facility;
const sg = fx.scenario_generation;

const pendingRebuild = new Set();
function has(obj, name) {
  if (typeof obj[name] === 'function') return true;
  pendingRebuild.add(name);
  return false;
}
// Band check: reports the observed value as approx(mid +- half-width).
function within(actual, lo, hi, label) {
  approx(actual, (lo + hi) / 2, (hi - lo) / 2, label);
}

// Constructors consume the segment objects; build fresh ones per facility.
function buildSegments() {
  return fac.segments.map(s => new m.WasmFacilitySegment(
    s.seg_type, s.length_ft, s.lanes,
    s.on_ramp_demand ?? [], s.off_ramp_demand ?? [], s.ramp_to_ramp_demand ?? [],
    s.ramp_ffs, s.accel_lane_ft, s.decel_lane_ft, s.short_length_ft,
    s.num_weaving_lanes, s.lc_rf, s.lc_fr, s.ffs, s.caf, s.saf, s.daf));
}
function buildReliability(rngSeed) {
  return new m.WasmFreewayReliability(
    buildSegments(), fac.mainline_demand, fac.ffs, fac.heavy_vehicle_pct,
    fac.terrain, fac.city_type, fac.phf, sg.months, sg.replications,
    sg.seed_month, sg.seed_weekday, sg.incidents.crash_rate_per_100mvmt,
    sg.incidents.incident_to_crash_ratio, rngSeed, fx.vmt_weighted);
}

// ═══════════════════════════════════════════════════════════════════════
// (b) Base (seed) dataset through the Chapter 10 core binding: EP7 text
// says undersaturated with max vd/c = 0.99 (segments 7-10).
// ═══════════════════════════════════════════════════════════════════════
const base = new m.WasmFreewayFacility(
  buildSegments(), fac.mainline_demand, fac.ffs, fac.heavy_vehicle_pct,
  fac.terrain, fac.city_type, fac.phf, fac.jam_density_pc,
  fac.queue_discharge_drop, fac.total_ramp_density, fac.interchange_density);
base.run_analysis();
exact(base.num_periods(), 12, 'EP7 base period count');
approx(base.total_length_mi(), 6.0, 0.01, 'EP7 base facility length (mi)');
exact(base.is_oversaturated(), false, 'EP7 base undersaturated');
let maxDc = 0;
for (let i = 0; i < base.num_segments(); i++) {
  for (let p = 0; p < base.num_periods(); p++) {
    maxDc = Math.max(maxDc, base.get_dc_ratio(i, p));
  }
}
approx(maxDc, 0.99, 0.005, 'EP7 base max vd/c (EP7 text)');

// Base per-period facility travel times for the seed-date scenario check,
// from a facility built the way the reliability binding builds its own
// (jam/queue-discharge/TRD/interchange left at defaults; see the header on
// the interchange_density 0.8 inexpressibility).
const baseAsBinding = new m.WasmFreewayFacility(
  buildSegments(), fac.mainline_demand, fac.ffs, fac.heavy_vehicle_pct,
  fac.terrain, fac.city_type, fac.phf);
baseAsBinding.run_analysis();
exact(baseAsBinding.is_oversaturated(), false, 'EP7 binding-default base undersaturated');
const segLenMi = fac.segments.map(s => s.length_ft / 5280.0);
const baseTT = [];
for (let p = 0; p < 12; p++) {
  baseTT.push(segLenMi.reduce((t, L, i) => t + L / baseAsBinding.get_speed(i, p) * 60.0, 0));
}

// ═══════════════════════════════════════════════════════════════════════
// (a) Scenario-generation intermediates
// ═══════════════════════════════════════════════════════════════════════
const rel = buildReliability(sg.rng_seed);

// Seed-file statistics: EP7 publishes 71,501 veh-mi over the 3-h study
// period (12 periods).
if (has(rel, 'seed_total_vmt')) {
  approx(rel.seed_total_vmt(), 71501.0, 1.0, 'EP7 seed VMT (veh-mi)');
  exact(rel.seed_num_periods(), 12, 'EP7 seed period count');
}

rel.run();

// 12 months x 5 weekdays x 4 replications = 240 scenarios (Equation
// 25-71), each with probability 1/240 (Equation 25-73), 240 x 12 = 2,880
// observations.
exact(rel.num_scenarios(), 240, 'EP7 scenario count');
exact(rel.num_observations(), 2880, 'EP7 observation count');
const probs = rel.scenario_probabilities();
exact(probs.length, 240, 'EP7 probability vector length');
let probSum = 0;
let probBad = 0;
for (const p of probs) {
  probSum += p;
  if (Math.abs(p - 1.0 / 240.0) > 1e-12) probBad += 1;
}
approx(probSum, 1.0, 1e-9, 'EP7 scenario probability sum');
exact(probBad, 0, 'EP7 scenarios off the 1/240 probability');

// Free-flow travel time: 6 mi at 60 mi/h = 6 min.
approx(rel.free_flow_travel_time_min(), 6.0, 0.01, 'EP7 free-flow TT (min)');
const ffTT = rel.free_flow_travel_time_min();

// Demand-combination structure and Equation 25-72 DAFs.
if (has(rel, 'scenario_months') && has(rel, 'scenario_weekdays') && has(rel, 'scenario_dafs')) {
  const months = rel.scenario_months();
  const weekdays = rel.scenario_weekdays();
  const dafs = rel.scenario_dafs();
  const monthCounts = new Array(13).fill(0);
  const dayCounts = {};
  months.forEach(mo => { monthCounts[mo] += 1; });
  weekdays.forEach(d => { dayCounts[d] = (dayCounts[d] ?? 0) + 1; });
  let monthBad = 0;
  for (let mo = 1; mo <= 12; mo++) if (monthCounts[mo] !== 20) monthBad += 1;
  exact(monthBad, 0, 'EP7 months without exactly 20 scenarios');
  exact(Object.keys(dayCounts).sort().join(','),
    'Friday,Monday,Thursday,Tuesday,Wednesday', 'EP7 weekday coverage (Mon-Fri)');
  exact(dayCounts.Friday, 48, 'EP7 scenarios per weekday');

  // Seed-date (November Tuesday) scenarios have DAF = 1 (Equation 25-72).
  const novTue = [...months.keys()].find(k => months[k] === 11 && weekdays[k] === 'Tuesday');
  approx(dafs[novTue], 1.0, 1e-9, 'EP7 seed-date scenario DAF');
  // July Friday: Exhibit 11-18 gives 1.62/1.21 = 1.3388 (the Rust test's
  // 1.329/0.995 = 1.3357 comes from the Exhibit 25-100 multipliers the
  // binding cannot express).
  const julFri = [...months.keys()].find(k => months[k] === 7 && weekdays[k] === 'Friday');
  approx(dafs[julFri], 1.62 / 1.21, 1e-9, 'EP7 July Friday DAF (Exhibit 11-18)');
}

// Exhibit 25-103 monthly incident frequencies (CR = 150 per 100M VMT,
// ICR = 7; Equations 25-77/25-78). Tolerances are the Rust test's
// (+-0.012; +-0.045 for the book-inconsistent October) widened to +-0.02 /
// +-0.05: the binding substitutes the Exhibit 11-18 demand ratios for
// EP7's Exhibit 25-100 ones, which shifts each month's VMT share by up to
// ~0.2%. This is a documented inexpressibility allowance, not a loosened
// mirror of the same computation.
if (has(rel, 'monthly_incident_frequencies')) {
  const freq = rel.monthly_incident_frequencies();
  const published = [0.65, 0.67, 0.72, 0.77, 0.77, 0.80, 0.89, 0.82, 0.83, 0.83, 0.79, 0.77];
  published.forEach((e, mo) => {
    approx(freq[mo], e, mo === 9 ? 0.05 : 0.02, `EP7 incident frequency month ${mo + 1}`);
  });
  // Identical October and November demand-ratio rows (true in Exhibit
  // 11-18 just as in Exhibit 25-100) force identical frequencies; the
  // published October 0.83 is inconsistent with the published inputs.
  approx(freq[9], freq[10], 1e-12, 'EP7 October == November incident frequency');
}
if (has(rel, 'total_incidents')) {
  const n = rel.total_incidents();
  exact(n >= 150 && n <= 220, true, `EP7 total incidents in [150, 220] (got ${n})`);
}

// ═══════════════════════════════════════════════════════════════════════
// (b) continued: the seed-date scenario (November Tuesday, DAF = 1, no
// incident events; weather does not exist in this binding) must reproduce
// the Chapter 10 base travel times exactly.
// ═══════════════════════════════════════════════════════════════════════
if (has(rel, 'scenario_months') && has(rel, 'scenario_weekdays') && has(rel, 'scenario_incident_counts')) {
  const months = rel.scenario_months();
  const weekdays = rel.scenario_weekdays();
  const incCounts = rel.scenario_incident_counts();
  const ttiMatrix = rel.scenario_tti_matrix();
  const clean = [...months.keys()].find(k =>
    months[k] === 11 && weekdays[k] === 'Tuesday' && incCounts[k] === 0);
  if (clean === undefined) {
    console.log('NOTE  no event-free November Tuesday scenario in this Monte Carlo draw; seed-date equality check not applicable');
  } else {
    for (let p = 0; p < 12; p++) {
      // TTI is clamped at 1.0, so travel time is only recoverable where
      // the base period runs slower than free flow.
      if (baseTT[p] > ffTT) {
        approx(ttiMatrix[clean][p] * ffTT, baseTT[p], 1e-6,
          `EP7 seed-date scenario TT p${p + 1} (min)`);
      } else {
        approx(ttiMatrix[clean][p], 1.0, 1e-9, `EP7 seed-date scenario TTI p${p + 1} (clamped)`);
      }
    }
  }

  // July scenarios must include heavy congestion from demand alone
  // (DAF up to 1.34 on a 0.99-vd/c base; Rust asserts oversaturation).
  let julMax = 0;
  for (const k of months.keys()) {
    if (months[k] === 7) julMax = Math.max(julMax, Math.max(...ttiMatrix[k]));
  }
  exact(julMax > 2.0, true, `EP7 July worst-period TTI > 2 (got ${julMax.toFixed(2)})`);
}

// ═══════════════════════════════════════════════════════════════════════
// (c) Distribution metrics: invariants plus coarse sanity bands. The
// Exhibit 25-104 values themselves are NOT asserted (weather cut, see the
// header); the bands only catch gross binding faults (unit or
// percent/decimal errors explode these immediately).
// ═══════════════════════════════════════════════════════════════════════
const tti50 = rel.tti_percentile(50);
const tti80 = rel.tti_percentile(80);
const tti95 = rel.tti_percentile(95);
const ttiMax = rel.tti_percentile(100);
const ttiMean = rel.tti_mean();
exact(ttiMean >= 1.0, true, 'EP7 TTI_mean >= 1');
exact(tti50 <= tti80 && tti80 <= tti95 && tti95 <= ttiMax, true,
  `EP7 TTI percentiles monotone (${tti50.toFixed(3)}/${tti80.toFixed(3)}/${tti95.toFixed(3)}/${ttiMax.toFixed(2)})`);
exact(rel.misery_index() >= ttiMean, true, 'EP7 misery index >= TTI_mean');
exact(rel.semi_std_dev() > 0.0, true, 'EP7 semi-std dev > 0');
exact(rel.expected_vhd() > 0.0, true, 'EP7 expected VHD > 0');
within(tti50, 1.0, 1.10, 'EP7 TTI_50 sanity band (published 1.03)');
within(ttiMean, 1.05, 1.45, 'EP7 TTI_mean sanity band (published 1.30)');
within(tti95, 1.10, 2.60, 'EP7 PTI sanity band (published 1.67)');
within(rel.reliability_rating(), 70.0, 100.0, 'EP7 reliability rating sanity band (published 90.8)');

// Failure measures at the standard 35/45/50 mi/h targets are monotone and
// in range (the on-time complement has no getter; core-only).
const f35 = rel.failure_pct_below_speed(35.0);
const f45 = rel.failure_pct_below_speed(45.0);
const f50 = rel.failure_pct_below_speed(50.0);
exact(f35 <= f45 && f45 <= f50, true, `EP7 failure % monotone (${f35.toFixed(2)}/${f45.toFixed(2)}/${f50.toFixed(2)})`);
exact(f35 >= 0.0 && f50 <= 100.0, true, 'EP7 failure % in range');

// Scenario-result consistency: every TTI >= 1 (2,880 cells).
{
  const ttiMatrix = rel.scenario_tti_matrix();
  let bad = 0;
  for (const row of ttiMatrix) {
    exactLen: for (const v of row) if (!(v >= 1.0)) { bad += 1; break exactLen; }
  }
  exact(bad, 0, 'EP7 scenarios with TTI < 1');
}

// ═══════════════════════════════════════════════════════════════════════
// Determinism: the same rng seed must reproduce the identical scenario set
// and results; a different seed must change the incident assignment.
// ═══════════════════════════════════════════════════════════════════════
const relB = buildReliability(sg.rng_seed);
relB.run();
exact(relB.tti_mean(), ttiMean, 'EP7 rerun TTI_mean identical');
const probsB = relB.scenario_probabilities();
exact(probs.every((v, k) => v === probsB[k]), true, 'EP7 rerun probabilities identical');
exact(JSON.stringify(rel.scenario_tti_matrix()) === JSON.stringify(relB.scenario_tti_matrix()),
  true, 'EP7 rerun scenario TTI matrix identical');

const relC = buildReliability(7);
relC.run();
exact(JSON.stringify(rel.scenario_tti_matrix()) !== JSON.stringify(relC.scenario_tti_matrix()),
  true, 'EP7 different rng seed changes the results');

if (pendingRebuild.size) {
  console.log(`NOTE  skipped checks awaiting middleware wrapper work (getters not in any released version): ${[...pendingRebuild].join(', ')}`);
}
report('ch11 freeway reliability (HCM Ch.25 EP7; weather/custom demand ratios/ATDM out of binding scope)');
