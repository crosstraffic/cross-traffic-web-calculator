// HCM Chapter 25, Example Problems 7, 8 and 9 (Chapter 11 freeway
// reliability, Exhibits 25-97 .. 25-108) through the WASM boundary, mirroring
// transportations-library/tests/chapter11_integration.rs. Example Problems 8
// and 9 are the geometric-improvement and incident-management alternatives on
// the same facility and the same scenario draw.
//
// The whole fixture now passes through the binding: middleware 0.3.7 added
// set_weather() and set_demand_multipliers() for the two scenario-generation
// inputs that had no home on the surface, and the four trailing facility
// parameters (jam density, queue discharge drop, total ramp density,
// interchange density) the constructor used to pass as None. Before that the
// distribution below was a milder experiment than the published one -- no
// weather at all, the Exhibit 11-18 national demand ratios in place of EP7's
// Exhibit 25-100 table, and an interchange density of 1.0 (the total ramp
// density fallback) instead of 0.8 -- so the Exhibit 25-104 metrics could
// only be checked as invariants and sanity bands. They are asserted here.
// Middleware 0.3.9 added set_incidents(), the last scenario-generation input
// with no way in, which is what opens Example Problem 9 (section (e)).
//
// STILL OUT OF BINDING SCOPE: work zones and special events on the scenario
// generator, and with them the two Chapter 37 ATDM direction-of-effect tests
// (shoulder lane, ramp metering), which the Rust suite covers.
//
// Published vs computed: the Exhibit 25-104 values come from FREEVAL's Monte
// Carlo stream at seed 1, which this implementation cannot replay. The
// central measures reproduce, the tail does not, and the assertions below use
// the Rust test's values and tolerances with the published number named in
// each label. The four gaps the core documents are PTI 1.97 computed vs 1.67
// published, TTI_max 39.7 vs 33.57, reliability rating 84.2% vs 90.8%, and
// %TTI>2 5.1% vs a published 2.95% of VMT.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();
const fx = loadCase('FreewayReliability', 'case1.json');
const fac = fx.facility;
const sg = fx.scenario_generation;

// Constructors consume the segment objects; build fresh ones per facility.
function buildSegments() {
  return fac.segments.map(
    (s) =>
      new m.WasmFacilitySegment(
        s.seg_type,
        s.length_ft,
        s.lanes,
        s.on_ramp_demand ?? [],
        s.off_ramp_demand ?? [],
        s.ramp_to_ramp_demand ?? [],
        s.ramp_ffs,
        s.accel_lane_ft,
        s.decel_lane_ft,
        s.short_length_ft,
        s.num_weaving_lanes,
        s.lc_rf,
        s.lc_fr,
        s.ffs,
        s.caf,
        s.saf,
        s.daf,
      ),
  );
}

// Full-fidelity construction: every fixture input reaches the core.
function buildReliability(rngSeed, vmtWeighted) {
  const r = new m.WasmFreewayReliability(
    buildSegments(),
    fac.mainline_demand,
    fac.ffs,
    fac.heavy_vehicle_pct,
    fac.terrain,
    fac.city_type,
    fac.phf,
    sg.months,
    sg.replications,
    sg.seed_month,
    sg.seed_weekday,
    sg.incidents.crash_rate_per_100mvmt,
    sg.incidents.incident_to_crash_ratio,
    rngSeed,
    vmtWeighted,
    fac.jam_density_pc,
    fac.queue_discharge_drop,
    fac.total_ramp_density,
    fac.interchange_density,
  );
  r.set_weather(sg.weather);
  r.set_demand_multipliers(sg.demand_multipliers);
  return r;
}

// The 0.3.7 surface this file depends on, named so a package built against an
// older middleware fails legibly instead of throwing on the first call.
const missing = [];
for (const fn of [
  'set_weather',
  'clear_weather',
  'has_weather',
  'set_demand_multipliers',
  'seed_demand_multiplier',
  'expected_weather_event_counts',
  'total_weather_events',
  'scenario_weather_event_counts',
  'tti_max',
  'pct_tti_above',
  'on_time_pct_at_speed',
]) {
  exact(
    typeof m.WasmFreewayReliability.prototype[fn],
    'function',
    `EP7 binding exposes WasmFreewayReliability.${fn}()`,
  );
  if (typeof m.WasmFreewayReliability.prototype[fn] !== 'function') missing.push(fn);
}
if (missing.length) {
  report(`ch11 freeway reliability: package predates middleware 0.3.7 (missing ${missing.join(', ')})`);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════
// (b) Base (seed) dataset through the Chapter 10 core binding: EP7 text
// says undersaturated with max vd/c = 0.99 (segments 7-10).
// ═══════════════════════════════════════════════════════════════════════
const base = new m.WasmFreewayFacility(
  buildSegments(),
  fac.mainline_demand,
  fac.ffs,
  fac.heavy_vehicle_pct,
  fac.terrain,
  fac.city_type,
  fac.phf,
  fac.jam_density_pc,
  fac.queue_discharge_drop,
  fac.total_ramp_density,
  fac.interchange_density,
);
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

// Base per-period facility travel times. The reliability binding now builds
// its internal facility from the same four parameters, so this is the same
// facility the seed-date scenario runs, not an approximation of it.
const segLenMi = fac.segments.map((s) => s.length_ft / 5280.0);
const baseTT = [];
for (let p = 0; p < 12; p++) {
  baseTT.push(segLenMi.reduce((t, L, i) => t + (L / base.get_speed(i, p)) * 60.0, 0));
}

// ═══════════════════════════════════════════════════════════════════════
// (a) Scenario-generation intermediates
// ═══════════════════════════════════════════════════════════════════════
const rel = buildReliability(sg.rng_seed, false); // probability-weighted
exact(rel.has_weather(), true, 'EP7 weather inputs accepted');

// Seed-file statistics: EP7 publishes 71,501 veh-mi over the 3-h study
// period (12 periods).
approx(rel.seed_total_vmt(), 71501.0, 1.0, 'EP7 seed VMT (veh-mi)');
exact(rel.seed_num_periods(), 12, 'EP7 seed period count');
// Exhibit 25-100 seed date (November Tuesday): DM(Seed) = 0.995.
approx(rel.seed_demand_multiplier(), 0.995, 1e-12, 'EP7 DM(Seed) (Exhibit 25-100)');

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
const months = rel.scenario_months();
const weekdays = rel.scenario_weekdays();
const dafs = rel.scenario_dafs();
const monthCounts = new Array(13).fill(0);
const dayCounts = {};
months.forEach((mo) => {
  monthCounts[mo] += 1;
});
weekdays.forEach((d) => {
  dayCounts[d] = (dayCounts[d] ?? 0) + 1;
});
let monthBad = 0;
for (let mo = 1; mo <= 12; mo++) if (monthCounts[mo] !== 20) monthBad += 1;
exact(monthBad, 0, 'EP7 months without exactly 20 scenarios');
exact(
  Object.keys(dayCounts).sort().join(','),
  'Friday,Monday,Thursday,Tuesday,Wednesday',
  'EP7 weekday coverage (Mon-Fri)',
);
exact(dayCounts.Friday, 48, 'EP7 scenarios per weekday');

// Seed-date (November Tuesday) scenarios have DAF = 1 (Equation 25-72), and
// July Friday carries the Exhibit 25-100 ratio 1.329/0.995.
const novTue = [...months.keys()].find((k) => months[k] === 11 && weekdays[k] === 'Tuesday');
approx(dafs[novTue], 1.0, 1e-9, 'EP7 seed-date scenario DAF');
const julFri = [...months.keys()].find((k) => months[k] === 7 && weekdays[k] === 'Friday');
approx(dafs[julFri], 1.329 / 0.995, 1e-9, 'EP7 July Friday DAF (Exhibit 25-100, 1.3357)');

// Equation 25-76 expected weather event counts from the Exhibit 25-101
// probabilities and Exhibit 25-102 durations (D_SP = 3 h, 20 scenarios per
// month): one medium rain event every month, one heavy rain event except two
// in each summer month, and every snow, cold, and visibility type rounding to
// zero. 3 x 3 + 9 x 2 = 27 events in the reliability reporting period.
const weatherCounts = rel.expected_weather_event_counts();
exact(weatherCounts.length, 12, 'EP7 expected weather event rows (months)');
for (let mo = 1; mo <= 12; mo++) {
  const row = weatherCounts[mo - 1];
  exact(row[0], 1, `EP7 medium rain events, month ${mo}`);
  exact(row[1], mo >= 6 && mo <= 8 ? 2 : 1, `EP7 heavy rain events, month ${mo}`);
  exact(
    row.slice(2).every((c) => c === 0),
    true,
    `EP7 snow/cold/visibility events zero, month ${mo}`,
  );
}
exact(rel.total_weather_events(), 27, 'EP7 total weather events in the RRP');
exact(
  rel.scenario_weather_event_counts().reduce((a, b) => a + b, 0),
  27,
  'EP7 weather events placed across the scenario set',
);

// Exhibit 25-103 monthly incident frequencies (CR = 150 per 100M VMT,
// ICR = 7; Equations 25-77/25-78) at the Rust test's tolerances: +-0.012, and
// +-0.045 for October, whose published 0.83 is inconsistent with the
// published inputs (see the equality check below).
const freq = rel.monthly_incident_frequencies();
const published = [0.65, 0.67, 0.72, 0.77, 0.77, 0.8, 0.89, 0.82, 0.83, 0.83, 0.79, 0.77];
published.forEach((e, mo) => {
  approx(freq[mo], e, mo === 9 ? 0.045 : 0.012, `EP7 incident frequency month ${mo + 1}`);
});
// The October and November demand-ratio rows of Exhibit 25-100 are identical,
// which forces identical frequencies; the published October 0.83 therefore
// cannot follow from the published inputs. Book defect, asserted as such.
approx(freq[9], freq[10], 1e-12, 'EP7 October == November incident frequency');
const nInc = rel.total_incidents();
exact(nInc >= 150 && nInc <= 220, true, `EP7 total incidents in [150, 220] (got ${nInc})`);

// ═══════════════════════════════════════════════════════════════════════
// (b) continued: the seed-date scenario (November Tuesday, DAF = 1, no
// weather and no incident events) must reproduce the Chapter 10 base
// travel times exactly.
// ═══════════════════════════════════════════════════════════════════════
const incCounts = rel.scenario_incident_counts();
const wxCounts = rel.scenario_weather_event_counts();
const ttiMatrix = rel.scenario_tti_matrix();
const clean = [...months.keys()].find(
  (k) => months[k] === 11 && weekdays[k] === 'Tuesday' && incCounts[k] === 0 && wxCounts[k] === 0,
);
if (clean === undefined) {
  console.log(
    'NOTE  no event-free November Tuesday scenario in this Monte Carlo draw; seed-date equality check not applicable',
  );
} else {
  for (let p = 0; p < 12; p++) {
    // TTI is clamped at 1.0, so travel time is only recoverable where
    // the base period runs slower than free flow.
    if (baseTT[p] > ffTT) {
      approx(ttiMatrix[clean][p] * ffTT, baseTT[p], 1e-6, `EP7 seed-date scenario TT p${p + 1} (min)`);
    } else {
      approx(ttiMatrix[clean][p], 1.0, 1e-9, `EP7 seed-date scenario TTI p${p + 1} (clamped)`);
    }
  }
}

// July scenarios must include heavy congestion (DAF up to 1.3357 on a
// 0.99-vd/c base; the Rust test asserts oversaturation there).
let julMax = 0;
for (const k of months.keys()) {
  if (months[k] === 7) julMax = Math.max(julMax, Math.max(...ttiMatrix[k]));
}
exact(julMax > 2.0, true, `EP7 July worst-period TTI > 2 (got ${julMax.toFixed(2)})`);

// Every one of the 2,880 cells has TTI >= 1.
{
  let bad = 0;
  for (const row of ttiMatrix) {
    for (const v of row)
      if (!(v >= 1.0)) {
        bad += 1;
        break;
      }
  }
  exact(bad, 0, 'EP7 scenarios with TTI < 1');
}

// ═══════════════════════════════════════════════════════════════════════
// (c) Exhibit 25-104 distribution metrics, at the values and tolerances of
// the Rust test (published values named in the labels).
// ═══════════════════════════════════════════════════════════════════════
approx(rel.tti_percentile(50), 1.03, 0.01, 'EP7 TTI_50 (published 1.03)');
approx(rel.tti_mean(), 1.3, 0.04, 'EP7 TTI_mean (published 1.30)');
approx(rel.misery_index(), 5.76, 0.3, 'EP7 misery index (published 5.76)');
approx(rel.semi_std_dev(), 2.05, 0.12, 'EP7 semi-std dev (published 2.05)');
// Documented reproduction gaps, pinned at their computed values.
approx(rel.tti_percentile(95), 2.0, 0.1, 'EP7 PTI computed (published 1.67)');
approx(rel.tti_max(), 39.7, 3.0, 'EP7 TTI_max computed (published 33.57)');
approx(rel.pct_tti_above(2.0), 5.1, 0.8, 'EP7 %obs at TTI>2 computed (published 2.95% of VMT)');
// tti_max() and the 100th percentile are the same quantity by definition.
approx(rel.tti_max(), rel.tti_percentile(100), 1e-12, 'EP7 TTI_max == 100th percentile');

// Distribution-shape invariants.
const tti50 = rel.tti_percentile(50);
const tti80 = rel.tti_percentile(80);
const tti95 = rel.tti_percentile(95);
exact(rel.tti_mean() >= 1.0, true, 'EP7 TTI_mean >= 1');
exact(
  tti50 <= tti80 && tti80 <= tti95 && tti95 <= rel.tti_max(),
  true,
  `EP7 TTI percentiles monotone (${tti50.toFixed(3)}/${tti80.toFixed(3)}/${tti95.toFixed(3)}/${rel.tti_max().toFixed(2)})`,
);
exact(rel.misery_index() >= rel.tti_mean(), true, 'EP7 misery index >= TTI_mean');
exact(rel.expected_vhd() > 0.0, true, 'EP7 expected VHD > 0');

// Failure/on-time measures at the standard 35/45/50 mi/h targets.
const f35 = rel.failure_pct_below_speed(35.0);
const f45 = rel.failure_pct_below_speed(45.0);
const f50 = rel.failure_pct_below_speed(50.0);
exact(f35 <= f45 && f45 <= f50, true, `EP7 failure % monotone (${f35.toFixed(2)}/${f45.toFixed(2)}/${f50.toFixed(2)})`);
exact(f35 >= 0.0 && f50 <= 100.0, true, 'EP7 failure % in range');
approx(rel.on_time_pct_at_speed(45.0) + f45, 100.0, 1e-9, 'EP7 on-time + failure = 100%');

// VMT-weighted distribution: the HCM reliability-rating definition and the
// Exhibit 25-105 presentation.
const relv = buildReliability(sg.rng_seed, fx.vmt_weighted);
relv.run();
approx(relv.reliability_rating(), 84.2, 1.5, 'EP7 reliability rating computed (published 90.8)');
approx(relv.tti_percentile(50), 1.04, 0.01, 'EP7 VMT-weighted TTI_50 (published 1.03)');
exact(relv.tti_mean() >= 1.0, true, 'EP7 VMT-weighted TTI_mean >= 1');

// ═══════════════════════════════════════════════════════════════════════
// Determinism: the same rng seed must reproduce the identical scenario set
// and results; a different seed must change the event assignment.
// ═══════════════════════════════════════════════════════════════════════
const relB = buildReliability(sg.rng_seed, false);
relB.run();
exact(relB.tti_mean(), rel.tti_mean(), 'EP7 rerun TTI_mean identical');
const probsB = relB.scenario_probabilities();
exact(
  probs.every((v, k) => v === probsB[k]),
  true,
  'EP7 rerun probabilities identical',
);
exact(
  JSON.stringify(rel.scenario_tti_matrix()) === JSON.stringify(relB.scenario_tti_matrix()),
  true,
  'EP7 rerun scenario TTI matrix identical',
);

const relC = buildReliability(7, false);
relC.run();
exact(
  JSON.stringify(rel.scenario_tti_matrix()) !== JSON.stringify(relC.scenario_tti_matrix()),
  true,
  'EP7 different rng seed changes the results',
);

// ═══════════════════════════════════════════════════════════════════════
// (d) Example Problem 8: reliability analysis with geometric improvements
// (Exhibits 25-106 and 25-107). Segments 7-11 of the same facility gain a
// lane, everything else including the rng seed held fixed, so the scenario
// set is identical and the delta is purely geometric. This mirrors the Rust
// test ep8_geometric_improvement_improves_reliability(), which asserts the
// direction only; the value pins below are this engine's computed numbers
// with the Exhibit 25-107 published value named beside each.
//
// The book text says the improvement is applied to "Example Problem 6",
// which is the planning-level analysis of a different facility. Exhibit
// 25-106 draws the EP1/EP7 facility with the added lane boxed on Segments
// 7-11, and the reliability inputs it inherits exist only in EP7, so the
// reference is read as EP7 here. Two published figures cannot be taken at
// face value either way: the narrative's "1.54" baseline mean TTI is not the
// 1.30 of Exhibit 25-104, and the published PTI of 1.17 sits below the
// published mean of 1.18, which no right-skewed TTI distribution allows.
// Neither is resolvable from the book, so neither is asserted as a target.
// ═══════════════════════════════════════════════════════════════════════
function buildWidened(rngSeed, vmtWeighted) {
  // Segments 7-11 are fixture indices 6-10.
  const widened = fac.segments.map(
    (s, i) =>
      new m.WasmFacilitySegment(
        s.seg_type,
        s.length_ft,
        s.lanes + (i >= 6 && i <= 10 ? 1 : 0),
        s.on_ramp_demand ?? [],
        s.off_ramp_demand ?? [],
        s.ramp_to_ramp_demand ?? [],
        s.ramp_ffs,
        s.accel_lane_ft,
        s.decel_lane_ft,
        s.short_length_ft,
        s.num_weaving_lanes,
        s.lc_rf,
        s.lc_fr,
        s.ffs,
        s.caf,
        s.saf,
        s.daf,
      ),
  );
  const r = new m.WasmFreewayReliability(
    widened,
    fac.mainline_demand,
    fac.ffs,
    fac.heavy_vehicle_pct,
    fac.terrain,
    fac.city_type,
    fac.phf,
    sg.months,
    sg.replications,
    sg.seed_month,
    sg.seed_weekday,
    sg.incidents.crash_rate_per_100mvmt,
    sg.incidents.incident_to_crash_ratio,
    rngSeed,
    vmtWeighted,
    fac.jam_density_pc,
    fac.queue_discharge_drop,
    fac.total_ramp_density,
    fac.interchange_density,
  );
  r.set_weather(sg.weather);
  r.set_demand_multipliers(sg.demand_multipliers);
  return r;
}

const ep8 = buildWidened(sg.rng_seed, false);
ep8.run();

// The widened facility is the same experiment on different geometry.
exact(ep8.num_scenarios(), 240, 'EP8 scenario count matches the EP7 draw');
exact(ep8.num_observations(), 2880, 'EP8 observation count matches the EP7 draw');
exact(
  JSON.stringify(ep8.scenario_dafs()) === JSON.stringify(rel.scenario_dafs()),
  true,
  'EP8 runs the identical scenario set (same seed, same demand table)',
);
approx(ep8.free_flow_travel_time_min(), 6.0, 0.01, 'EP8 free-flow TT unchanged by widening (min)');

// Direction, as the Rust test asserts it.
exact(
  ep8.tti_mean() < rel.tti_mean(),
  true,
  `EP8 widening lowers mean TTI (${rel.tti_mean().toFixed(4)} -> ${ep8.tti_mean().toFixed(4)})`,
);
exact(
  ep8.reliability_rating() > rel.reliability_rating(),
  true,
  `EP8 widening raises the reliability rating (${rel.reliability_rating().toFixed(2)} -> ${ep8.reliability_rating().toFixed(2)})`,
);
exact(
  ep8.tti_percentile(95) <= rel.tti_percentile(95) + 1e-9,
  true,
  `EP8 widening does not worsen the PTI (${rel.tti_percentile(95).toFixed(4)} -> ${ep8.tti_percentile(95).toFixed(4)})`,
);
exact(
  ep8.misery_index() < rel.misery_index(),
  true,
  `EP8 widening lowers the misery index (${rel.misery_index().toFixed(3)} -> ${ep8.misery_index().toFixed(3)})`,
);
exact(
  ep8.pct_tti_above(2.0) < rel.pct_tti_above(2.0),
  true,
  `EP8 widening cuts the share above TTI 2 (${rel.pct_tti_above(2.0).toFixed(2)} -> ${ep8.pct_tti_above(2.0).toFixed(2)})`,
);

// Value pins. The central measures land close to Exhibit 25-107; the tail
// carries the same Monte Carlo gap Example Problem 7 documents.
approx(ep8.tti_mean(), 1.198, 0.01, 'EP8 TTI_mean computed (Exhibit 25-107 published 1.18)');
approx(ep8.tti_percentile(50), 1.028, 0.01, 'EP8 TTI_50 computed (published 1.02)');
approx(ep8.misery_index(), 4.17, 0.1, 'EP8 misery index computed (published 4.07)');
approx(ep8.semi_std_dev(), 1.526, 0.06, 'EP8 semi-std dev computed (published 1.71)');
approx(ep8.tti_percentile(95), 1.297, 0.05, 'EP8 PTI computed (published 1.17, which is below the published mean)');
approx(ep8.tti_max(), 36.73, 2.0, 'EP8 TTI_max computed (published 33.5)');
approx(ep8.pct_tti_above(2.0), 2.19, 0.5, 'EP8 %obs at TTI>2 computed (published 1.42% of VMT)');

// The reliability rating is defined on VMT, so it is read from the
// VMT-weighted pair rather than from the probability-weighted one above.
const ep8v = buildWidened(sg.rng_seed, fx.vmt_weighted);
ep8v.run();
approx(ep8v.reliability_rating(), 95.5, 1.5, 'EP8 reliability rating computed (published 97.56)');
exact(
  ep8v.reliability_rating() > relv.reliability_rating(),
  true,
  `EP8 widening raises the VMT-weighted rating (${relv.reliability_rating().toFixed(2)} -> ${ep8v.reliability_rating().toFixed(2)})`,
);

// ═══════════════════════════════════════════════════════════════════════
// (e) Example Problem 9: evaluation of incident management (Exhibit
// 25-108). The same facility and the same scenario draw with every incident
// severity's mean duration and standard deviation cut by 30%, the minima and
// maxima left alone. This mirrors the Rust test
// ep9_incident_management_improves_reliability(), which scales
// `scenario_generation.incidents.duration_params` on the loaded case.
//
// Two guards used to sit here instead, because the wasm surface took
// incidents as exactly two constructor arguments (the crash rate and the
// incident-to-crash ratio) wrapped in an IncidentInputs::default(), which put
// duration_params out of reach from JS and dropped the fixture's own
// severity_distribution. Middleware 0.3.9 added set_incidents(), taking the
// serde shape of the library's IncidentInputs the way set_weather() takes
// WeatherInputs, and that is what this block is. The guards did their job:
// the method probe failed on the first package built against 0.3.9.
//
// The reliability rating and mean TTI the Rust test compares are read from
// the fixture's own weighting (vmt_weighted = true), so the baseline here is
// the VMT-weighted `relv` rather than the probability-weighted `rel`.
// ═══════════════════════════════════════════════════════════════════════
for (const fn of ['set_incidents', 'clear_incidents', 'has_incidents', 'incident_duration_params']) {
  exact(
    typeof m.WasmFreewayReliability.prototype[fn],
    'function',
    `EP9 binding exposes WasmFreewayReliability.${fn}()`,
  );
}

// The duration parameters the constructor installs are the Exhibit 11-22 /
// Exhibit 25-41 national defaults, read back rather than transcribed here, so
// the 30% cut below is applied to the same numbers the core would use.
const ep9 = buildReliability(sg.rng_seed, fx.vmt_weighted);
exact(ep9.has_incidents(), true, 'EP9 constructor crash rate models incidents');
const dp = ep9.incident_duration_params();
exact(dp.length, 5, 'EP9 duration parameters, one per Equation 25-85 severity');
[
  [34.0, 15.1, 8.7, 58.0],
  [34.6, 13.8, 16.0, 58.2],
  [53.6, 13.9, 30.5, 66.9],
  [67.9, 21.9, 36.0, 93.3],
  [67.9, 21.9, 36.0, 93.3],
].forEach(([mean, sd, mn, mx], i) => {
  exact(
    dp[i].mean === mean && dp[i].std_dev === sd && dp[i].min === mn && dp[i].max === mx,
    true,
    `EP9 Exhibit 11-22 defaults, severity ${i + 1} (${dp[i].mean}/${dp[i].std_dev}/${dp[i].min}/${dp[i].max})`,
  );
});

// What the retired severity-distribution guard was pinning by string
// comparison is now provable: sending the fixture's whole incidents object
// through the setter reproduces the two-argument constructor path exactly, so
// the EP7 numbers above are the fixture's incident inputs and not a default
// that happens to resemble them.
const fixtureInc = buildReliability(sg.rng_seed, fx.vmt_weighted);
fixtureInc.set_incidents({ ...sg.incidents, duration_params: dp });
fixtureInc.run();
exact(
  JSON.stringify(fixtureInc.scenario_tti_matrix()) === JSON.stringify(relv.scenario_tti_matrix()),
  true,
  'EP7 fixture incidents through the setter reproduce the constructor path exactly',
);

ep9.set_incidents({
  ...sg.incidents,
  duration_params: dp.map((p) => ({ ...p, mean: p.mean * 0.7, std_dev: p.std_dev * 0.7 })),
});
const sent = ep9.incident_duration_params();
exact(
  sent.every(
    (p, i) =>
      p.mean === dp[i].mean * 0.7 && p.std_dev === dp[i].std_dev * 0.7 && p.min === dp[i].min && p.max === dp[i].max,
  ),
  true,
  'EP9 duration parameters read back as sent (means and standard deviations cut 30%, ranges kept)',
);
ep9.run();

// Same draw, different clearance times.
exact(ep9.num_scenarios(), 240, 'EP9 scenario count matches the EP7 draw');
exact(
  ep9.total_incidents(),
  relv.total_incidents(),
  `EP9 runs the identical incident draw (${relv.total_incidents()} incidents)`,
);
exact(
  JSON.stringify(ep9.scenario_incident_counts()) === JSON.stringify(relv.scenario_incident_counts()),
  true,
  'EP9 assigns incidents to the same scenarios',
);

// Direction, as the Rust test asserts it. Exhibit 25-108 publishes a mean TTI
// of 1.35 -> 1.20 and a mean speed of 44.4 -> 50.0 mi/h; as with Example
// Problem 8 the published baseline is not the Exhibit 25-104 value for the
// same facility, so the published pair is named rather than asserted.
exact(
  ep9.tti_mean() < relv.tti_mean(),
  true,
  `EP9 faster clearance lowers mean TTI (${relv.tti_mean().toFixed(5)} -> ${ep9.tti_mean().toFixed(5)}; published 1.35 -> 1.20)`,
);
exact(
  ep9.reliability_rating() > relv.reliability_rating(),
  true,
  `EP9 faster clearance raises the reliability rating (${relv.reliability_rating().toFixed(3)} -> ${ep9.reliability_rating().toFixed(3)})`,
);
exact(
  ep9.misery_index() < relv.misery_index(),
  true,
  `EP9 faster clearance lowers the misery index (${relv.misery_index().toFixed(4)} -> ${ep9.misery_index().toFixed(4)})`,
);
exact(
  ep9.tti_max() < relv.tti_max(),
  true,
  `EP9 faster clearance cuts the worst period (${relv.tti_max().toFixed(2)} -> ${ep9.tti_max().toFixed(2)})`,
);

// Value pins. Unlike the EP7 and EP8 pins above, these are not book numbers
// with a Monte Carlo gap behind them: they are the values the library's own
// EP9 path computes natively on this fixture, so the tolerance is the
// wasm-versus-native math-library gap and nothing else. That gap measures
// 2e-12 across these ten measures, and the pins are set at 1e-9 so an engine
// change fails here rather than passing inside a book-sized band.
approx(relv.tti_mean(), 1.23776960774207834, 1e-9, 'EP7 VMT-weighted TTI_mean (core EP9-test baseline)');
approx(ep9.tti_mean(), 1.21130324922242227, 1e-9, 'EP9 TTI_mean (published 1.20)');
approx(ep9.tti_percentile(50), 1.03727689973000747, 1e-9, 'EP9 TTI_50');
approx(ep9.tti_percentile(80), 1.22854003536663847, 1e-9, 'EP9 TTI_80');
approx(ep9.tti_percentile(95), 1.90776750198548761, 1e-9, 'EP9 PTI');
approx(ep9.tti_max(), 32.3542467510951397, 1e-7, 'EP9 TTI_max');
approx(ep9.misery_index(), 3.08690563642527005, 1e-9, 'EP9 misery index');
approx(ep9.semi_std_dev(), 0.895404883170202393, 1e-9, 'EP9 semi-std dev');
approx(ep9.reliability_rating(), 85.4208221102839218, 1e-9, 'EP9 reliability rating');
approx(ep9.pct_tti_above(2.0), 3.78101337000392324, 1e-9, 'EP9 %obs at TTI>2');
approx(ep9.expected_vhd(), 233.482534688971327, 1e-7, 'EP9 expected VHD (veh-h)');

// ═══════════════════════════════════════════════════════════════════════
// LEGACY SHAPE: the pre-0.3.7 call, with none of the three inputs above.
// Kept as the regression anchor for callers built on the old signature (the
// hcm11 page is one), and as the control that the new inputs bite: this
// facility carries no weather, the Exhibit 11-18 national demand ratios, and
// the interchange-density fallback, and it must therefore be measurably
// milder than the full-fidelity run.
// ═══════════════════════════════════════════════════════════════════════
const legacy = new m.WasmFreewayReliability(
  buildSegments(),
  fac.mainline_demand,
  fac.ffs,
  fac.heavy_vehicle_pct,
  fac.terrain,
  fac.city_type,
  fac.phf,
  sg.months,
  sg.replications,
  sg.seed_month,
  sg.seed_weekday,
  sg.incidents.crash_rate_per_100mvmt,
  sg.incidents.incident_to_crash_ratio,
  sg.rng_seed,
  false,
);
exact(legacy.has_weather(), false, 'legacy shape models no weather');
legacy.run();
exact(legacy.num_scenarios(), 240, 'legacy shape scenario count');
exact(legacy.total_weather_events(), 0, 'legacy shape generates no weather events');
// Exhibit 11-18 July Friday over November Tuesday: 1.62/1.21 = 1.3388.
const legacyMonths = legacy.scenario_months();
const legacyDays = legacy.scenario_weekdays();
const legacyJulFri = [...legacyMonths.keys()].find((k) => legacyMonths[k] === 7 && legacyDays[k] === 'Friday');
approx(legacy.scenario_dafs()[legacyJulFri], 1.62 / 1.21, 1e-9, 'legacy shape July Friday DAF (Exhibit 11-18, 1.3388)');
approx(legacy.seed_demand_multiplier(), 1.21, 1e-12, 'legacy shape DM(Seed) (Exhibit 11-18)');
exact(
  legacy.tti_mean() < rel.tti_mean(),
  true,
  `full fidelity is the harsher experiment (legacy TTI_mean ${legacy.tti_mean().toFixed(4)} < ${rel.tti_mean().toFixed(4)})`,
);
exact(
  legacy.misery_index() < rel.misery_index(),
  true,
  `full fidelity raises the misery index (legacy ${legacy.misery_index().toFixed(3)} < ${rel.misery_index().toFixed(3)})`,
);

// Shape validation on the two config inputs. Both matrices fall back to a
// silent default in the core when they are short or transposed (all-zero
// weather probabilities, a demand multiplier of 1.0), so the binding must
// reject them rather than compute a plausible wrong answer.
function throws(fn, label) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  exact(threw, true, label);
}
{
  const probe = new m.WasmFreewayReliability(
    buildSegments(),
    fac.mainline_demand,
    fac.ffs,
    fac.heavy_vehicle_pct,
    fac.terrain,
    fac.city_type,
    fac.phf,
    sg.months,
    sg.replications,
    sg.seed_month,
    sg.seed_weekday,
    sg.incidents.crash_rate_per_100mvmt,
    sg.incidents.incident_to_crash_ratio,
    sg.rng_seed,
    false,
  );
  throws(
    () => probe.set_demand_multipliers(sg.demand_multipliers.slice(0, 11)),
    'set_demand_multipliers rejects an 11-month table',
  );
  throws(
    () => probe.set_demand_multipliers(sg.demand_multipliers.map((r) => r.slice(0, 5))),
    'set_demand_multipliers rejects a Monday-Friday-only table',
  );
  throws(
    () => probe.set_weather({ ...sg.weather, probabilities_by_month: sg.weather.probabilities_by_month.slice(0, 4) }),
    'set_weather rejects a 4-month probability matrix',
  );
  throws(
    () => probe.set_weather({ ...sg.weather, durations_min: sg.weather.durations_min.slice(0, 3) }),
    'set_weather rejects a short duration vector',
  );
  exact(probe.has_weather(), false, 'a rejected weather config leaves the generator weather-free');

  // The incident config has the same shape of hazard, three times over. The
  // core looks duration_params up per severity with the Exhibit 11-22 default
  // as the fallback, so a four-entry cut silently restores the book duration
  // for the severity it omits -- which is precisely the mistake this EP9 block
  // would otherwise invite. It checks the severity distribution's sum but not
  // its length, and it reads the monthly frequency table with a 0.0 fallback,
  // so a short table models an incident-free month. The fourth case is a
  // config with no frequency source at all, which is what a wholly misspelled
  // object deserializes into: it generates no incidents while reporting that
  // incidents are modeled.
  throws(
    () => probe.set_incidents({ ...sg.incidents, duration_params: dp.slice(0, 4) }),
    'set_incidents rejects a four-entry duration_params',
  );
  throws(
    () => probe.set_incidents({ ...sg.incidents, severity_distribution: [0.754, 0.196, 0.031, 0.019] }),
    'set_incidents rejects a four-entry severity distribution',
  );
  throws(
    () => probe.set_incidents({ ...sg.incidents, severity_distribution: [0.754, 0.196, 0.031, 0.019, 0.0, 0.0] }),
    'set_incidents rejects a six-entry severity distribution',
  );
  throws(
    () => probe.set_incidents({ ...sg.incidents, monthly_frequencies: new Array(11).fill(0.8) }),
    'set_incidents rejects an eleven-month frequency table',
  );
  throws(
    () => probe.set_incidents({ crash_rate_per_100_mvmt: 150.0 }),
    'set_incidents rejects a config with no frequency source (a misspelled crash rate)',
  );
  exact(probe.has_incidents(), true, 'a rejected incidents config leaves the constructor inputs in place');
  exact(
    JSON.stringify(probe.incident_duration_params()),
    JSON.stringify(dp),
    'a rejected incidents config leaves the Exhibit 11-22 defaults in place',
  );
  probe.clear_incidents();
  exact(probe.has_incidents(), false, 'clear_incidents() removes the incident inputs');
  exact(probe.incident_duration_params(), null, 'incident duration parameters are null with no incidents');
}

report(
  'ch11 freeway reliability (HCM Ch.25 EP7 full fidelity + EP8 geometric improvement + EP9 incident management; work zones/special events/ATDM out of binding scope)',
);
