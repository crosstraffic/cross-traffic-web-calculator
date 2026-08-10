// HCM Chapter 17 (Urban Street Reliability) through the WASM boundary:
// Chapter 29, Section 5, Example Problem 4 (Exhibits 29-62 through 29-77;
// 3-mi Lincoln, Nebraska principal arterial, weekdays for one year,
// 7-10 a.m., seeds 82/11/63), Example Problem 5 Strategy 1 (Exhibit 29-78),
// and the Chapter 37, Section 5 adaptive signal control strategy. Expected
// values and tolerances mirror
// transportations-library/tests/chapter17_integration.rs, which itself
// asserts the published Exhibit 29-73 measures at the distribution-band
// level because, per the HCM, the Monte Carlo stream is software-specific
// ("Each result, though different, will be equally valid").
//
// Binding-surface scope (WasmUrbanReliability, crosstraffic_middleware
// 0.3.3): the constructor gained monthly snowfall, jan1_day_of_week, and
// prop_left_turn_lanes; add_segment gained the boundary signal's k factor,
// I factor, and approach lane count; add_atdm_strategy and
// num_oversaturated_scenarios were added. With the fixture's full inputs
// supplied, this boundary now reproduces the Rust test's computed point
// values exactly rather than merely landing inside its bands, so the
// assertions below are tightened to +-0.005 on the TTI measures and to an
// exact oversaturated-scenario count. What closed the gap was
// jan1_day_of_week, approach_lanes, and prop_left_turn_lanes. NOT snowfall:
// the library never reads total_snowfall_in (the Chapter 29 procedure
// decides rain vs snow from the sampled temperature, Equations 29-3/29-4,
// and sizes snow from the precipitation columns), so the snowfall array
// supplied below is climatological metadata that changes nothing — see the
// middleware 0.3.4 CHANGELOG correction.
//
// Remaining boundary gaps: per-scenario results are exposed only through
// the summary getters (the Rust test can filter analysis.scenario_results
// directly; here the oversaturated count is the one per-scenario readout),
// and AtdmStrategy is reached through its serde form, so the
// AtdmStrategy::adaptive_signal_control constructor helper is expressed as
// the sat_flow_adjustment value it computes rather than called by name.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

const c1 = loadCase('UrbanReliability', 'case1.json');
const cfg = c1.config;
const weatherColumn = (key) => Float64Array.from(cfg.weather.map(w => w[key]));

// `legacy: true` reproduces the pre-0.3.3 call shape (no snowfall, no
// calendar anchor, no boundary-signal k/I/approach-lane arguments) so the
// old wide-band block below still exercises the argument defaults.
function build({ legacy = false, seeds = [cfg.weather_seed, cfg.demand_seed, cfg.incident_seed], strategies = [] } = {}) {
  const rel = new m.WasmUrbanReliability(
    cfg.functional_class,                             // "UrbanPrincipalArterial"
    cfg.study_period_start_hour,                      // 7 (also the count hour)
    cfg.analysis_periods_per_day,                     // 12 x 15-min periods
    weatherColumn('total_precip_in'),                 // Lincoln NCDC (Exhibit 29-65)
    weatherColumn('days_with_precip'),
    weatherColumn('mean_temp_f'),
    weatherColumn('precip_rate_in_h'),
    cfg.incidents.intersection_crash_frequencies[0],  // entry intersection, 32 crashes/yr (Exhibit 29-68)
    cfg.incidents.minor_leg_volume_veh_h,             // 1,300 veh/h
    cfg.incidents.shoulder_present,                   // true
    cfg.vmt_weighted,                                 // true
    seeds[0], seeds[1], seeds[2],
    legacy ? undefined : weatherColumn('total_snowfall_in'),  // 6.6 in. in January down to 0 in summer
    legacy ? undefined : cfg.jan1_day_of_week,               // 6 = Saturday
    legacy ? undefined : c1.facility.prop_left_turn_lanes);  // 1.0
  // Strategies must be registered before run().
  for (const s of strategies) rel.add_atdm_strategy(s);
  c1.facility.segments.forEach((s, i) => {
    const signal = cfg.boundary_signals[i];
    rel.add_segment(
      s.segment_length_ft,        // 2,640 ft (0.5 mi)
      s.n_through_lanes,          // 2
      s.speed_limit_mph,          // 35 mi/h
      s.through_demand_veh_h,     // 1,000 veh/h
      s.cycle_length_s,           // 100 s
      s.effective_green_s,        // 45 s
      s.sat_flow_veh_h_ln,        // 1,800 veh/h/ln
      s.platoon_ratio,            // 1.333 (good progression)
      s.n_access_points_subject,  // 2
      s.n_access_points_opposing, // 2
      s.full_stop_rate_override,  // 0.5 stops/veh
      cfg.incidents.segment_crash_frequencies[i],            // 15..20 crashes/yr
      cfg.incidents.intersection_crash_frequencies[i + 1],   // 33..38 crashes/yr (downstream boundary)
      legacy ? undefined : signal.k_factor,       // 0.5
      legacy ? undefined : signal.i_factor,       // 1.0
      legacy ? undefined : signal.approach_lanes); // 4
  });
  rel.run();
  return rel;
}

// ── Example Problem 4 at full fidelity, published seed pattern 82/11/63 ──
const r1 = build();

exact(r1.num_segments(), 6, 'EP4 segment count');
// Published, deterministic: 3,120 scenarios = 12 analysis periods x 260 weekdays.
exact(r1.num_scenarios(), 3120, 'EP4 published scenario count');
// Published base free-flow travel time 262.9 s, +-10 s band (Rust test).
approx(r1.get_base_free_flow_travel_time(), 262.9, 10.0, 'EP4 base free-flow travel time [Exhibit 29-73]');

// With the fixture's full weather and calendar inputs supplied, this
// boundary computes the same point values the Rust test's module docs
// record for the residual-queue-carryover run. Published Exhibit 29-73 for
// reference: mean TTI 1.69/1.64, TTI-80 1.57/1.56, PTI 2.98/2.61, rating
// 93.2/94.1. The Rust test documents the remaining gap to the published PTI
// as still-deferred random 15-min demand variation (Equations 29-30 through
// 29-33) and uncalibrated Exhibit 17-10/17-11 incident durations.
approx(r1.tti_mean(), 1.5449, 0.005, 'EP4 mean TTI (computed; published 1.69/1.64)');
approx(r1.tti_percentile(80), 1.5927, 0.005, 'EP4 TTI-80 (computed; published 1.57/1.56)');
approx(r1.tti_percentile(95), 1.7462, 0.005, 'EP4 PTI (computed; published 2.98/2.61)');
approx(r1.reliability_rating(), 98.83, 0.1, 'EP4 reliability rating (computed; published 93.2/94.1)');
exact(r1.tti_percentile(50) <= r1.tti_percentile(80) && r1.tti_percentile(80) <= r1.tti_percentile(95), true, 'EP4 percentile ordering');
// Oversaturated scenarios feed residual queues forward into the next
// analysis period. The Rust test asserts >= 60 (computed 70, up from 37
// before residual-queue carryover); the seeds are deterministic, so the
// exact count is pinned here.
exact(r1.num_oversaturated_scenarios(), 70, 'EP4 oversaturated scenarios (Rust test asserts >= 60; deterministic at seeds 82/11/63)');
exact(r1.get_total_vhd() > 0.0, true, 'EP4 positive annual through delay');
exact(r1.num_weather_events() > 50, true, 'EP4 weather events generated');
exact(r1.num_incidents() > 50, true, 'EP4 incidents generated');

// Deterministic reproducibility with the published seed pattern (82/11/63).
const r1b = build();
exact(r1b.num_incidents(), r1.num_incidents(), 'EP4 seeded incident stream reproducible');
approx(r1b.tti_mean(), r1.tti_mean(), 1e-12, 'EP4 seeded mean TTI reproducible');
approx(r1b.tti_percentile(95), r1.tti_percentile(95), 1e-12, 'EP4 seeded PTI reproducible');

// ── Replication with different seeds (EP4 replication concept, Exhibit
// 29-75: average travel time varied by ~+-1.4% across replications; the
// Rust test allows 10%). Seeds 83/12/64 as in the Rust test. ──
const r2 = build({ seeds: [83, 12, 64] });
exact(r2.num_scenarios(), r1.num_scenarios(), 'replication: same reliability reporting period');
const relDiff = Math.abs(r1.get_mean_travel_time() - r2.get_mean_travel_time()) / r1.get_mean_travel_time();
exact(relDiff < 0.10, true, `replication: mean travel times agree within 10% (got ${(100 * relDiff).toFixed(2)}%)`);
approx(r2.tti_mean(), 1.85, 0.75, 'replication mean TTI in [1.1, 2.6]');

// ── Example Problem 5, Strategy 1 (Exhibit 29-78): 5 s of split shifted to
// the coordinated through phase. Published direction of effect is travel
// time 438.2 -> 400.7 s and rating 93.2 -> 96.8, so the assertion is
// directional, matching the Rust test. ──
const strategy1 = build({ strategies: [{ name: 'EP5 Strategy 1: +5 s to the coordinated phase', effective_green_adjustment_s: 5.0 }] });
exact(strategy1.num_scenarios(), 3120, 'EP5 Strategy 1 same reliability reporting period');
exact(strategy1.get_mean_travel_time() < r1.get_mean_travel_time(), true,
  `EP5 Strategy 1 reduces mean travel time (${strategy1.get_mean_travel_time().toFixed(1)} vs ${r1.get_mean_travel_time().toFixed(1)} s)`);
exact(strategy1.reliability_rating() >= r1.reliability_rating(), true,
  `EP5 Strategy 1 does not degrade the reliability rating (${strategy1.reliability_rating().toFixed(2)} vs ${r1.reliability_rating().toFixed(2)})`);
exact(strategy1.tti_percentile(95) <= r1.tti_percentile(95), true, 'EP5 Strategy 1 does not degrade the PTI');
exact(strategy1.num_oversaturated_scenarios() <= r1.num_oversaturated_scenarios(), true,
  `EP5 Strategy 1 does not add oversaturated scenarios (${strategy1.num_oversaturated_scenarios()} vs ${r1.num_oversaturated_scenarios()})`);

// ── Chapter 37, Section 5 adaptive signal control. AtdmStrategy reaches the
// binding through its serde form, which carries plain fields and no
// constructor helpers, so AtdmStrategy::adaptive_signal_control is expressed
// as the sat_flow_adjustment it computes: 1 / (1 - target/100) at the
// Exhibit 37-9 range midpoint of 13.5%, i.e. 1.15607. Direction-of-effect
// assertion only, as in the Rust test: Chapter 37 publishes an illustrative
// simulation-study range (3%-24% delay reduction), not a reproducible
// example problem. ──
const adaptiveSatFlow = 1.0 / (1.0 - 13.5 / 100.0);
const asc = build({ strategies: [{ name: 'Ch37 Sec.5 adaptive signal control (13.5% target)', sat_flow_adjustment: adaptiveSatFlow }] });
approx(adaptiveSatFlow, 1.15607, 1e-5, 'adaptive signal control sat flow adjustment (Exhibit 37-9 midpoint)');
exact(asc.get_mean_travel_time() <= r1.get_mean_travel_time(), true,
  `adaptive signal control does not raise mean travel time (${asc.get_mean_travel_time().toFixed(1)} vs ${r1.get_mean_travel_time().toFixed(1)} s)`);
exact(asc.tti_percentile(95) <= r1.tti_percentile(95), true, 'adaptive signal control does not degrade the PTI');
exact(asc.reliability_rating() >= r1.reliability_rating(), true, 'adaptive signal control does not degrade the reliability rating');

// ── LEGACY regression anchor: the pre-0.3.3 call shape, with snowfall,
// calendar anchor, and boundary-signal k/I/approach-lane arguments omitted.
// The weather stream differs (no snow-driven capacity loss), so only the
// Rust test's wide distribution bands are meaningful here. Retained so the
// argument defaults cannot shift underneath callers written against the old
// surface. ──
const legacy = build({ legacy: true });
exact(legacy.num_scenarios(), 3120, 'legacy call shape: published scenario count');
exact(legacy.tti_mean() >= 1.0, true, 'legacy call shape: mean TTI >= 1');
approx(legacy.tti_mean(), 1.95, 0.65, 'legacy call shape: mean TTI in [1.3, 2.6] vs published 1.69/1.64');
approx(legacy.tti_percentile(80), 1.95, 0.65, 'legacy call shape: TTI-80 in [1.3, 2.6] vs published 1.57/1.56');
approx(legacy.tti_percentile(95), 3.2, 1.8, 'legacy call shape: PTI in [1.4, 5.0] vs published 2.98/2.61');
approx(legacy.reliability_rating(), 95.0, 5.0, 'legacy call shape: reliability rating in [90, 100] vs published 93.2/94.1');

// results_to_js_value must agree with the getters.
const res = r1.results_to_js_value();
exact(res.num_scenarios, 3120, 'EP4 results object scenario count');
approx(res.tti_mean, r1.tti_mean(), 1e-12, 'EP4 results object mean TTI == getter');
approx(res.tti_95, r1.tti_percentile(95), 1e-12, 'EP4 results object PTI == getter');
approx(res.reliability_rating, r1.reliability_rating(), 1e-12, 'EP4 results object rating == getter');

report('ch17 urban street reliability (HCM Ch.29 EP4 + EP5 Strategy 1 + Ch.37 adaptive signal control)');
