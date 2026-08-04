// HCM Chapter 17 (Urban Street Reliability) through the WASM boundary:
// Chapter 29, Section 5, Example Problem 4 (Exhibits 29-62 through 29-77;
// 3-mi Lincoln, Nebraska principal arterial, weekdays for one year,
// 7-10 a.m., seeds 82/11/63). Expected values and tolerances mirror
// transportations-library/tests/chapter17_integration.rs, which itself
// asserts the published Exhibit 29-73 measures at the distribution-band
// level because, per the HCM, the Monte Carlo stream is software-specific
// ("Each result, though different, will be equally valid").
//
// Binding-surface scope (WasmUrbanReliability; fully signalized facilities):
// * Monthly SNOWFALL is not expressible: the constructor takes only total precipitation, days with precipitation, mean temperature, and precipitation rate, and hard-codes total_snowfall_in = 0.0. The fixture's Lincoln climatology has up to 6.6 in. of January snowfall, so the generated weather stream differs from the Rust run (snow-driven capacity losses are the strongest events). The Rust test's oversaturated-scenario count assertion (>= 60 with residual-queue carryover) is therefore NOT asserted here (it is also not exposed by any getter), and only the Rust test's distribution bands, not its computed point values, are meaningful at this boundary.
// * Boundary-signal approach_lanes is not expressible: the binding pushes approach_lanes = 0 (falls back to the segment's 2 through lanes) where the fixture publishes 4; k = 0.5 and I = 1.0 are hard-coded and happen to match the fixture.
// * jan1_day_of_week is not expressible (fixture 6 = Saturday, binding default 0 = Sunday). Both calendars contain exactly 260 weekdays, so the published scenario count (3,120 = 12 x 260) is unaffected, but month/weekday demand factors align to different dates.
// * Example Problem 5 (ATDM strategy evaluation, Exhibit 29-78) and the Chapter 37 adaptive-signal-control strategy are NOT expressible: the binding exposes no atdm_strategies surface. The Rust tests keep both.
// * The facility-level prop_left_turn_lanes (fixture 1.0) is not expressible; it feeds only the perception score, which the reliability method does not use.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

const c1 = loadCase('UrbanReliability', 'case1.json');
const cfg = c1.config;

function build(weatherSeed, demandSeed, incidentSeed) {
  const rel = new m.WasmUrbanReliability(
    cfg.functional_class,                                        // "UrbanPrincipalArterial"
    cfg.study_period_start_hour,                                 // 7 (also the count hour)
    cfg.analysis_periods_per_day,                                // 12 x 15-min periods
    Float64Array.from(cfg.weather.map(w => w.total_precip_in)),  // Lincoln NCDC (Exhibit 29-65)
    Float64Array.from(cfg.weather.map(w => w.days_with_precip)),
    Float64Array.from(cfg.weather.map(w => w.mean_temp_f)),
    Float64Array.from(cfg.weather.map(w => w.precip_rate_in_h)),
    cfg.incidents.intersection_crash_frequencies[0],             // entry intersection, 32 crashes/yr (Exhibit 29-68)
    cfg.incidents.minor_leg_volume_veh_h,                        // 1,300 veh/h
    cfg.incidents.shoulder_present,                              // true
    cfg.vmt_weighted,                                            // true
    weatherSeed, demandSeed, incidentSeed);
  c1.facility.segments.forEach((s, i) => {
    rel.add_segment(
      s.segment_length_ft,       // 2,640 ft (0.5 mi)
      s.n_through_lanes,         // 2
      s.speed_limit_mph,         // 35 mi/h
      s.through_demand_veh_h,    // 1,000 veh/h
      s.cycle_length_s,          // 100 s
      s.effective_green_s,       // 45 s
      s.sat_flow_veh_h_ln,       // 1,800 veh/h/ln
      s.platoon_ratio,           // 1.333 (good progression)
      s.n_access_points_subject, // 2
      s.n_access_points_opposing,// 2
      s.full_stop_rate_override, // 0.5 stops/veh
      cfg.incidents.segment_crash_frequencies[i],           // 15..20 crashes/yr
      cfg.incidents.intersection_crash_frequencies[i + 1]); // 33..38 crashes/yr (downstream boundary)
  });
  rel.run();
  return rel;
}

// ── Example Problem 4, published seed pattern 82/11/63 ──
const r1 = build(cfg.weather_seed, cfg.demand_seed, cfg.incident_seed);

exact(r1.num_segments(), 6, 'EP4 segment count');
// Published, deterministic: 3,120 scenarios = 12 analysis periods x 260 weekdays.
exact(r1.num_scenarios(), 3120, 'EP4 published scenario count');
// Published base free-flow travel time 262.9 s, +-10 s band (Rust test).
approx(r1.get_base_free_flow_travel_time(), 262.9, 10.0, 'EP4 base free-flow travel time [Exhibit 29-73]');

// Distribution bands mirrored from the Rust test (published Exhibit 29-73:
// mean TTI 1.69/1.64, TTI-80 1.57/1.56, PTI 2.98/2.61, rating 93.2/94.1).
// Bands expressed as center +- halfwidth for the harness.
exact(r1.tti_mean() >= 1.0, true, 'EP4 mean TTI >= 1');
approx(r1.tti_mean(), 1.95, 0.65, 'EP4 mean TTI in [1.3, 2.6] vs published 1.69/1.64');
approx(r1.tti_percentile(80), 1.95, 0.65, 'EP4 TTI-80 in [1.3, 2.6] vs published 1.57/1.56');
approx(r1.tti_percentile(95), 3.2, 1.8, 'EP4 PTI in [1.4, 5.0] vs published 2.98/2.61 (gap attributed to deferred elements, see Rust module docs)');
exact(r1.tti_percentile(50) <= r1.tti_percentile(80) && r1.tti_percentile(80) <= r1.tti_percentile(95), true, 'EP4 percentile ordering');
approx(r1.reliability_rating(), 95.0, 5.0, 'EP4 reliability rating in [90, 100] vs published 93.2/94.1');
exact(r1.get_total_vhd() > 0.0, true, 'EP4 positive annual through delay');
exact(r1.num_weather_events() > 50, true, 'EP4 weather events generated');
exact(r1.num_incidents() > 50, true, 'EP4 incidents generated');

// Deterministic reproducibility with the published seed pattern (82/11/63).
const r1b = build(cfg.weather_seed, cfg.demand_seed, cfg.incident_seed);
exact(r1b.num_incidents(), r1.num_incidents(), 'EP4 seeded incident stream reproducible');
approx(r1b.tti_mean(), r1.tti_mean(), 1e-12, 'EP4 seeded mean TTI reproducible');
approx(r1b.tti_percentile(95), r1.tti_percentile(95), 1e-12, 'EP4 seeded PTI reproducible');

// ── Replication with different seeds (EP4 replication concept, Exhibit
// 29-75: average travel time varied by ~+-1.4% across replications; the
// Rust test allows 10%). Seeds 83/12/64 as in the Rust test. ──
const r2 = build(83, 12, 64);
exact(r2.num_scenarios(), r1.num_scenarios(), 'replication: same reliability reporting period');
const relDiff = Math.abs(r1.get_mean_travel_time() - r2.get_mean_travel_time()) / r1.get_mean_travel_time();
exact(relDiff < 0.10, true, `replication: mean travel times agree within 10% (got ${(100 * relDiff).toFixed(2)}%)`);
approx(r2.tti_mean(), 1.85, 0.75, 'replication mean TTI in [1.1, 2.6]');

// results_to_js_value must agree with the getters.
const res = r1.results_to_js_value();
exact(res.num_scenarios, 3120, 'EP4 results object scenario count');
approx(res.tti_mean, r1.tti_mean(), 1e-12, 'EP4 results object mean TTI == getter');
approx(res.tti_95, r1.tti_percentile(95), 1e-12, 'EP4 results object PTI == getter');
approx(res.reliability_rating, r1.reliability_rating(), 1e-12, 'EP4 results object rating == getter');

report('ch17 urban street reliability (HCM Ch.29 EP4)');
