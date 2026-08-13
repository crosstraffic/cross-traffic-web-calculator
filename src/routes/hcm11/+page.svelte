<svelte:head>
  <title>Freeway Reliability Analysis · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmFacilitySegment, WasmFreewayReliability } from "HCM-middleware";
  import { setReport } from '$lib/report';
  import ViewToggle from '$lib/ViewToggle.svelte';
  import FacilityDiagram from '$lib/FacilityDiagram.svelte';
  import FacilityDiagram3D from '$lib/FacilityDiagram3D.svelte';
  import { onMount } from "svelte";

  let diagramMode = $state('2d');

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Facility inputs (Chapter 10 seed dataset for the reliability run)
  let ffs = $state(60);
  let hv_pct = $state(5);
  let terrain = $state('level');
  let city_type = $state('urban');
  let mainline_demand = $state('4000, 4400, 4800, 4400');

  // Advanced facility parameters, the four trailing arguments the reliability
  // constructor forwards to its internal Chapter 10 facility. All blank by
  // default, which keeps the fifteen-argument call this page has always made:
  // the core then defaults jam density to 190 pc/mi/ln, the queue discharge
  // drop to 7% and the total ramp density to 1.0/mi, and falls back to the
  // total ramp density for the interchange density.
  let jam_density = $state('');
  let queue_discharge_drop = $state('');
  let total_ramp_density = $state('');
  let interchange_density = $state('');

  // Exhibit 25-104 is the probability-weighted distribution over the 2,880
  // observations; Exhibit 25-105 weights by VMT, which is how the HCM defines
  // the reliability rating. The page has always run VMT-weighted, so that
  // stays the default.
  let tti_weighting = $state('vmt');

  function blankSegment(num) {
    return { seg_num: num, seg_type: 'Basic', length_ft: '5280', lanes: '3', on_ramp: '', off_ramp: '', ramp_to_ramp: '', ramp_ffs: '40', accel: '500', decel: '500', short_length: '', weaving_lanes: '2', lc_rf: '1', lc_fr: '1' };
  }

  function defaultSegments() {
    return [
      { ...blankSegment(1) },
      { ...blankSegment(2), seg_type: 'Merge', length_ft: '1500', on_ramp: '450, 540, 630, 360' },
      { ...blankSegment(3) }
    ];
  }

  let segments = $state(defaultSegments());

  // Reliability inputs (Chapter 11 scenario generation)
  let replications = $state(4);
  let seed_month = $state(1);
  let seed_weekday = $state('monday');
  let include_incidents = $state(true);
  let crash_rate = $state(150);
  let incident_crash_ratio = $state(4.9);
  let rng_seed = $state(1);
  let target_speed = $state(45);

  // Step B-6 weather and the Equation 25-72 demand multipliers are opt-in and
  // held as null when off, because neither setter is a no-op: set_weather()
  // with anything at all makes the generator model weather, and
  // set_demand_multipliers() replaces the Exhibit 11-18 national ratios
  // outright. Null means the call is never made.
  let weather = $state(null);
  let demand_multipliers = $state(null);

  // SEVERE_WEATHER_TYPES order, which is the column order both the
  // probability matrix and the duration vector are indexed in.
  const WEATHER_TYPES = [
    'Medium rain', 'Heavy rain', 'Light snow', 'Light-medium snow',
    'Medium-heavy snow', 'Heavy snow', 'Severe cold', 'Low visibility',
    'Very low visibility', 'Minimal visibility'
  ];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // HCM Chapter 25, Example Problem 7 (Exhibits 25-97 through 25-105): the
  // 6-mi, 11-segment facility of Example Problem 1 over a 3-h study period.
  // Transcribed from the library fixture
  // tests/ExampleCases/hcm/FreewayReliability/case1.json, which is what the
  // boundary suite and the Rust integration test both run.
  const EP7 = {
    ffs: 60,
    hv_pct: 2.25,
    terrain: 'level',
    city_type: 'urban',
    // Exhibit 25-99 mainline entry demands, 12 periods of 15 min (4-7 p.m.).
    mainline_demand: '3095, 3595, 4175, 4505, 4955, 5225, 4685, 3785, 3305, 2805, 2455, 2405',
    jam_density: '190',
    queue_discharge_drop: '7',
    total_ramp_density: '1.0',
    interchange_density: '0.8',
    replications: 4,
    seed_month: 11,
    seed_weekday: 'tuesday',
    crash_rate: 150,
    incident_crash_ratio: 7,
    rng_seed: 1,
    segments: [
      { seg_type: 'Basic', length_ft: '5280', lanes: '3' },
      { seg_type: 'Merge', length_ft: '1500', lanes: '3', on_ramp: '270, 360, 360, 450, 540, 630, 360, 180, 180, 180, 180, 180' },
      { seg_type: 'Basic', length_ft: '2280', lanes: '3' },
      { seg_type: 'Diverge', length_ft: '1500', lanes: '3', off_ramp: '180, 270, 270, 270, 360, 270, 270, 270, 270, 270, 270, 180' },
      { seg_type: 'Basic', length_ft: '5280', lanes: '3' },
      // Exhibit 25-45 ramp-to-ramp demands for periods 4-8; the fixture uses
      // 50 veh/h elsewhere, which the HCM does not publish.
      { seg_type: 'Weaving', length_ft: '2640', lanes: '4', short_length: '1640', weaving_lanes: '2', lc_rf: '1', lc_fr: '1',
        on_ramp: '270, 360, 450, 540, 720, 810, 360, 270, 270, 270, 180, 180',
        off_ramp: '270, 360, 360, 360, 360, 360, 360, 180, 180, 180, 180, 180',
        ramp_to_ramp: '50, 50, 50, 50, 100, 150, 80, 50, 50, 50, 50, 50' },
      { seg_type: 'Basic', length_ft: '5280', lanes: '3' },
      { seg_type: 'Merge', length_ft: '1140', lanes: '3', on_ramp: '270, 360, 450, 450, 540, 630, 450, 270, 270, 270, 180, 180' },
      { seg_type: 'OverlappingRamp', length_ft: '360', lanes: '3' },
      { seg_type: 'Diverge', length_ft: '1140', lanes: '3', off_ramp: '180, 270, 270, 270, 270, 450, 270, 180, 180, 180, 180, 180' },
      { seg_type: 'Basic', length_ft: '5280', lanes: '3' }
    ],
    // Exhibit 25-100 demand ratios, 12 months by Monday-Sunday. The weekend
    // columns are zero because the reporting period is weekdays only; only
    // ratios to the seed date's multiplier are used, so the base is arbitrary.
    demand_multipliers: [
      [0.822, 0.822, 0.839, 0.864, 0.965, 0, 0],
      [0.849, 0.849, 0.866, 0.892, 0.996, 0, 0],
      [0.921, 0.921, 0.939, 0.967, 1.080, 0, 0],
      [0.976, 0.976, 0.995, 1.025, 1.145, 0, 0],
      [0.974, 0.974, 0.993, 1.023, 1.142, 0, 0],
      [1.022, 1.022, 1.043, 1.074, 1.199, 0, 0],
      [1.133, 1.133, 1.156, 1.191, 1.329, 0, 0],
      [1.033, 1.033, 1.054, 1.085, 1.212, 0, 0],
      [1.063, 1.063, 1.085, 1.117, 1.248, 0, 0],
      [0.995, 0.995, 1.016, 1.046, 1.168, 0, 0],
      [0.995, 0.995, 1.016, 1.046, 1.168, 0, 0],
      [0.979, 0.979, 0.998, 1.028, 1.148, 0, 0]
    ],
    // Exhibit 25-101 seasonal probabilities mapped to months (winter =
    // Dec/Jan/Feb, spring = Mar/Apr/May, summer = Jun/Jul/Aug, fall =
    // Sep/Oct/Nov), with the Exhibit 25-102 mean durations.
    weather: {
      probabilities_by_month: [
        [0.0080, 0.0047, 0.0091, 0.0029, 0.0004, 0, 0, 0.0097, 0, 0.0044],
        [0.0080, 0.0047, 0.0091, 0.0029, 0.0004, 0, 0, 0.0097, 0, 0.0044],
        [0.0101, 0.0081, 0, 0, 0, 0, 0, 0.0012, 0, 0.0010],
        [0.0101, 0.0081, 0, 0, 0, 0, 0, 0.0012, 0, 0.0010],
        [0.0101, 0.0081, 0, 0, 0, 0, 0, 0.0012, 0, 0.0010],
        [0.0071, 0.0133, 0, 0, 0, 0, 0, 0.0016, 0, 0],
        [0.0071, 0.0133, 0, 0, 0, 0, 0, 0.0016, 0, 0],
        [0.0071, 0.0133, 0, 0, 0, 0, 0, 0.0016, 0, 0],
        [0.0086, 0.0068, 0, 0, 0, 0, 0, 0.0034, 0, 0.0003],
        [0.0086, 0.0068, 0, 0, 0, 0, 0, 0.0034, 0, 0.0003],
        [0.0086, 0.0068, 0, 0, 0, 0, 0, 0.0034, 0, 0.0003],
        [0.0080, 0.0047, 0.0091, 0.0029, 0.0004, 0, 0, 0.0097, 0, 0.0044]
      ],
      durations_min: [40.2, 33.7, 93.1, 33.4, 21.7, 7.3, 0, 76.2, 0, 145.0],
      daf: 1.0
    }
  };

  // Everything the panels hold is a string, so the grids edit and validate the
  // same way the rest of the form does and one parse happens at run time.
  function toGrid(rows) {
    return rows.map((r) => r.map((v) => String(v)));
  }

  function seedWeather() {
    weather = {
      probabilities_by_month: toGrid(EP7.weather.probabilities_by_month),
      durations_min: EP7.weather.durations_min.map((v) => String(v)),
      daf: String(EP7.weather.daf)
    };
  }

  function seedDemandMultipliers() {
    demand_multipliers = toGrid(EP7.demand_multipliers);
  }

  function toggleWeather() {
    if (weather) weather = null;
    else seedWeather();
  }

  function toggleDemandMultipliers() {
    if (demand_multipliers) demand_multipliers = null;
    else seedDemandMultipliers();
  }

  // Load the whole published example, not only the three panels: the Exhibit
  // 25-104 metrics belong to Example Problem 7's own facility, so seeding the
  // weather and demand tables onto some other facility reproduces nothing.
  function loadExampleProblem7() {
    ffs = EP7.ffs;
    hv_pct = EP7.hv_pct;
    terrain = EP7.terrain;
    city_type = EP7.city_type;
    mainline_demand = EP7.mainline_demand;
    jam_density = EP7.jam_density;
    queue_discharge_drop = EP7.queue_discharge_drop;
    total_ramp_density = EP7.total_ramp_density;
    interchange_density = EP7.interchange_density;
    segments = EP7.segments.map((s, i) => ({ ...blankSegment(i + 1), ...s }));
    replications = EP7.replications;
    seed_month = EP7.seed_month;
    seed_weekday = EP7.seed_weekday;
    include_incidents = true;
    crash_rate = EP7.crash_rate;
    incident_crash_ratio = EP7.incident_crash_ratio;
    rng_seed = EP7.rng_seed;
    seedWeather();
    seedDemandMultipliers();
    tti_weighting = 'probability';
    results = null;
    hasError = false;
  }

  function addSegment() {
    segments = [...segments, blankSegment(segments.length + 1)];
  }

  function removeSegment() {
    if (segments.length > 1) {
      segments = segments.slice(0, segments.length - 1);
    }
  }

  function parseList(text) {
    return String(text)
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map(Number)
      .filter((v) => Number.isFinite(v));
  }

  // A cleared cell in a grid arrives as undefined, and Number(undefined) is
  // NaN, which both setters would accept and carry into the run. Name the cell
  // instead, because a NaN probability produces a completed analysis rather
  // than an error.
  function numericGrid(rows, what, rowNames, colNames) {
    return rows.map((r, i) => r.map((v, j) => {
      const n = Number(v);
      if (v === '' || v === null || v === undefined || !Number.isFinite(n)) {
        throw new Error(`${what}: ${rowNames[i]} ${colNames[j]} is blank. Every cell needs a value.`);
      }
      return n;
    }));
  }

  // Field names must match the library's WeatherInputs serde schema exactly:
  // it is serde(default), so a typo deserializes to the all-zero matrix and
  // silently produces the weather-free distribution instead of failing.
  function weatherConfig(w) {
    const daf = optionalNumber(w.daf);
    if (daf === undefined) throw new Error('Weather: the demand adjustment factor is blank.');
    return {
      probabilities_by_month: numericGrid(w.probabilities_by_month, 'Weather probabilities', MONTH_NAMES, WEATHER_TYPES),
      durations_min: numericGrid([w.durations_min], 'Weather durations', ['Duration'], WEATHER_TYPES)[0],
      daf
    };
  }

  // A cleared number input does not come back as the empty string: Svelte
  // writes undefined into a value bound to type="number". Testing for '' alone
  // would leave a cleared field looking filled and send NaN to the engine.
  function optionalNumber(v) {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  let jamDensityVal = $derived(optionalNumber(jam_density));
  let queueDropVal = $derived(optionalNumber(queue_discharge_drop));
  let rampDensityVal = $derived(optionalNumber(total_ramp_density));
  let interchangeDensityVal = $derived(optionalNumber(interchange_density));
  let facilityParamsActive = $derived(jamDensityVal !== undefined || queueDropVal !== undefined
    || rampDensityVal !== undefined || interchangeDensityVal !== undefined);

  // Built as one string so the default rendering is byte-identical to what
  // this page has always emitted; the rating is only the HCM's VMT-weighted
  // measure when the distribution is VMT-weighted.
  let ratingSuffix = $derived(tti_weighting === 'vmt'
    ? ' % of travel at TTI below 1.33'
    : ' % of observations at TTI below 1.33 (the HCM rating is VMT-weighted)');

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');
  let running = $state(false);

  function runAnalysis() {
    hasError = false;
    results = null;
    running = true;

    try {
      const demand = parseList(mainline_demand);
      if (demand.length === 0) {
        throw new Error('Enter at least one mainline demand value.');
      }

      const wasmSegments = segments.map((s) => new WasmFacilitySegment(
        s.seg_type,
        Number(s.length_ft),
        Number(s.lanes),
        parseList(s.on_ramp),
        parseList(s.off_ramp),
        parseList(s.ramp_to_ramp),
        Number(s.ramp_ffs),
        Number(s.accel),
        Number(s.decel),
        s.short_length !== '' ? Number(s.short_length) : undefined,
        Number(s.weaving_lanes),
        Number(s.lc_rf),
        Number(s.lc_fr),
        undefined,             // segment FFS override, mi/h
        undefined,             // calibration CAF
        undefined,             // calibration SAF
        undefined              // calibration DAF
      ));

      const relArgs = [
        wasmSegments,
        demand,
        Number(ffs),
        Number(hv_pct) / 100.0,             // UI takes percent, the engine takes a decimal
        terrain,
        city_type,
        1.0,                                 // PHF, 15-min flow rates assumed
        [],                                  // months, empty means the whole year
        Number(replications),
        Number(seed_month),
        seed_weekday,
        include_incidents ? Number(crash_rate) : undefined,
        include_incidents ? Number(incident_crash_ratio) : undefined,
        Number(rng_seed),
        tti_weighting === 'vmt'
      ];
      // The four facility parameters ride only when the user filled at least
      // one in, so an untouched form makes the same fifteen-argument call it
      // always has and the core's own defaults stay in charge.
      if (facilityParamsActive) {
        relArgs.push(
          jamDensityVal,
          queueDropVal === undefined ? undefined : queueDropVal / 100.0,   // UI takes percent, the engine takes a decimal
          rampDensityVal,
          interchangeDensityVal
        );
      }

      const rel = new WasmFreewayReliability(...relArgs);

      // Both setters throw on a table of the wrong shape rather than falling
      // back to a default, so a mistyped grid surfaces as an error here.
      if (weather) rel.set_weather(weatherConfig(weather));
      if (demand_multipliers) rel.set_demand_multipliers(numericGrid(demand_multipliers, 'Demand multipliers', MONTH_NAMES, WEEKDAY_NAMES));

      rel.run();

      results = {
        num_scenarios: rel.num_scenarios(),
        num_observations: rel.num_observations(),
        fftt: rel.free_flow_travel_time_min(),
        tti_mean: rel.tti_mean(),
        tti_50: rel.tti_percentile(50.0),
        tti_80: rel.tti_percentile(80.0),
        tti_95: rel.tti_percentile(95.0),
        misery_index: rel.misery_index(),
        reliability_rating: rel.reliability_rating(),
        semi_std_dev: rel.semi_std_dev(),
        expected_vhd: rel.expected_vhd(),
        pct_below_target: rel.failure_pct_below_speed(Number(target_speed))
      };

      setReport({
        chapter: 'Freeway Reliability Analysis',
        chapterRef: 'HCM Chapter 11',
        href: '/hcm11',
        generatedAt: new Date().toLocaleString(),
        headline: null,
        inputs: [
          { label: 'Free-flow speed', value: `${ffs} mi/h` },
          { label: 'Heavy vehicles', value: `${hv_pct} %` },
          { label: 'Terrain', value: terrain },
          { label: 'Area type', value: city_type },
          { label: 'Mainline entry demand', value: `${mainline_demand} veh/h` },
          { label: 'Segments (upstream to downstream)', value: segments.map((s) => `${s.seg_type} ${s.length_ft} ft x${s.lanes}`).join(', ') },
          { label: 'Replications per demand combination', value: replications },
          { label: 'Seed dataset', value: `month ${seed_month}, ${seed_weekday}` },
          { label: 'Incidents', value: include_incidents ? `crash rate ${crash_rate} per 100M VMT, incident-to-crash ratio ${incident_crash_ratio}` : 'excluded' },
          { label: 'Random seed', value: rng_seed },
          { label: 'Target speed for on-time measure', value: `${target_speed} mi/h` },
          { label: 'TTI distribution weighting', value: tti_weighting === 'vmt' ? 'VMT-weighted (Exhibit 25-105)' : 'Probability-weighted (Exhibit 25-104)' },
          ...(facilityParamsActive ? [{
            label: 'Facility parameters',
            value: [
              `jam density ${jamDensityVal === undefined ? 'default' : jamDensityVal + ' pc/mi/ln'}`,
              `queue discharge drop ${queueDropVal === undefined ? 'default' : queueDropVal + ' %'}`,
              `total ramp density ${rampDensityVal === undefined ? 'default' : rampDensityVal + ' /mi'}`,
              `interchange density ${interchangeDensityVal === undefined ? 'default' : interchangeDensityVal + ' /mi'}`
            ].join(', ')
          }] : []),
          ...(weather ? [{
            label: 'Weather (Step B-6)',
            value: `${WEATHER_TYPES.length} severe weather types, 12 monthly probability rows, event DAF ${weather.daf}`
          }] : []),
          ...(demand_multipliers ? [{
            label: 'Demand multipliers (Equation 25-72)',
            value: `local 12-month by weekday table, seed date ${MONTH_NAMES[Number(seed_month) - 1]} ${seed_weekday}`
          }] : []),
        ],
        resultTable: {
          columns: ['Measure', 'Value'],
          rows: [
            ['Scenarios evaluated', `${results.num_scenarios}`],
            ['Travel time observations', `${results.num_observations}`],
            ['Free-flow travel time', `${results.fftt.toFixed(2)} min`],
            ['Mean TTI', results.tti_mean.toFixed(3)],
            ['50th percentile TTI', results.tti_50.toFixed(3)],
            ['80th percentile TTI', results.tti_80.toFixed(3)],
            ['95th percentile TTI (PTI)', results.tti_95.toFixed(3)],
            ['Misery index', results.misery_index.toFixed(3)],
            ['Semi-standard deviation', results.semi_std_dev.toFixed(3)],
            ['Expected vehicle hours of delay', `${results.expected_vhd.toFixed(1)} veh-h`],
            [`Share of travel below ${target_speed} mi/h`, `${results.pct_below_target.toFixed(1)} %`],
            [`Reliability rating (${tti_weighting === 'vmt' ? 'share of travel' : 'share of observations'} at TTI below 1.33)`, `${results.reliability_rating.toFixed(1)} %`],
          ],
        },
        summary: [],
        methodology: [
          `HCM Chapter 11 reliability methodology: a whole-year weekday reporting period built from monthly and weekday demand ratios${weather ? ', severe weather events from the Step B-6 inputs' : ''} and randomly generated incidents, every scenario evaluated with the Chapter 10 core methodology, and the travel time index distribution ${tti_weighting === 'vmt' ? 'VMT-weighted' : 'probability-weighted over the observations'}.`,
          'Beta scope. The engine reproduces the published scenario generation and central reliability measures within a few percent, but tail measures depend on the published engine’s Monte Carlo stream and are not reproduced. The 95th percentile TTI runs up to about 20% high. Work zones and special events are excluded on this page.',
        ],
      });
    } catch (err) {
      console.error('Chapter 11 analysis failed:', err);
      hasError = true;
      errMessage = typeof err === 'string'
        ? err
        : (err && err.message) || 'The analysis could not be completed with the given inputs. Check the values and try again.';
    } finally {
      running = false;
    }
  }

  function resetParams() {
    ffs = 60;
    hv_pct = 5;
    terrain = 'level';
    city_type = 'urban';
    mainline_demand = '4000, 4400, 4800, 4400';
    jam_density = '';
    queue_discharge_drop = '';
    total_ramp_density = '';
    interchange_density = '';
    tti_weighting = 'vmt';
    weather = null;
    demand_multipliers = null;
    segments = defaultSegments();
    replications = 4;
    seed_month = 1;
    seed_weekday = 'monday';
    include_incidents = true;
    crash_rate = 150;
    incident_crash_ratio = 4.9;
    rng_seed = 1;
    target_speed = 45;
    results = null;
    hasError = false;
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 11 <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">Freeway Reliability Analysis</h1>
    <p class="page-sub">
      Estimate the travel time reliability of a freeway facility across a whole-year
      reporting period on Monday through Friday. This beta models demand variability
      by month and weekday plus randomly generated incidents, and optionally severe
      weather and a local demand multiplier table. Work zones and special events are
      not included.
    </p>
  </header>

  <div class="alert alert-warning shadow-sm mb-6 beta-note" role="note">
    <span>
      <strong>Beta.</strong> The engine reproduces the scenario generation and the
      central reliability measures of the published HCM worked example within a few
      percent (median and mean TTI, misery index). Tail measures depend on the
      published engine's Monte Carlo stream and are not reproduced, the 95th
      percentile TTI runs up to about 20% high, because those measures depend on
      which scenarios the random draw pairs a severe incident with. Work zones and
      special events are not modeled on this page. Verify results independently before
      relying on them in engineering work, and please <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm11" onsubmit={preventDefault(runAnalysis)} inert={!ready}>
    <!-- Facility -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Facility</h2>
          <p class="panel-sub">The Chapter 10 seed dataset that every scenario is built from.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="FFS_input">Free-Flow Speed</label>
          <div class="cell-field">
            <input id="FFS_input" type="number" min="55" max="75" class="input input-bordered input-sm" bind:value={ffs} placeholder="60" required />
            <span class="unit">mi/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="HV_input">Heavy Vehicles</label>
          <div class="cell-field">
            <input id="HV_input" type="number" step="0.01" min="0" max="100" class="input input-bordered input-sm" bind:value={hv_pct} placeholder="5" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="TERRAIN_input">Terrain</label>
          <select id="TERRAIN_input" class="select select-bordered select-sm" bind:value={terrain}>
            <option value="level">Level</option>
            <option value="rolling">Rolling</option>
            <option value="mountainous">Mountainous</option>
          </select>
        </div>

        <div class="param-field">
          <label for="CITY_input">Area Type</label>
          <select id="CITY_input" class="select select-bordered select-sm" bind:value={city_type}>
            <option value="urban">Urban</option>
            <option value="rural">Rural</option>
          </select>
        </div>

        <div class="param-field">
          <label for="DEMAND_input">Mainline Entry Demand</label>
          <div class="cell-field">
            <input id="DEMAND_input" type="text" class="input input-bordered input-sm demand-wide" bind:value={mainline_demand} placeholder="4000, 4400, 4800, 4400" required />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">Comma-separated list, one value per 15-min analysis period. The list length sets the study period.</p>
        </div>
      </div>
    </section>

    <!-- Segments -->
    <section class="panel">
      <div class="panel-head with-actions">
        <div>
          <h2 class="panel-title">Segments</h2>
          <p class="panel-sub">Ordered upstream to downstream. The facility must begin and end with a basic segment. Choosing Weaving opens that segment's own details card below the table.</p>
        </div>
        <div class="panel-actions">
          <button class="btn btn-outline btn-sm" onclick={addSegment} type="button">+ Add Segment</button>
          <button class="btn btn-ghost btn-sm" onclick={removeSegment} type="button">Remove</button>
        </div>
      </div>

      <!-- Seed facility view. Reliability results are travel-time distributions
           across scenarios, not per-segment LOS, so the chain stays geometric. -->
      <div class="diagram-block">
        <div class="diagram-toggle-row">
          <ViewToggle bind:mode={diagramMode} label="Facility view" />
        </div>
        {#if diagramMode === '2d'}
          <FacilityDiagram {segments} note="Seed facility, upstream to downstream. Widths follow segment length. Reliability results describe the whole facility across scenarios, so segments are not LOS-colored here." />
        {:else}
          <FacilityDiagram3D {segments} />
        {/if}
      </div>

      <div class="w-full overflow-x-auto">
        <table class="table seg-table w-full">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Length (ft)</th>
              <th>Lanes</th>
              <th>On-Ramp Demand (veh/h)</th>
              <th>Off-Ramp Demand (veh/h)</th>
              <th>Ramp FFS (mi/h)</th>
              <th>Accel Lane (ft)</th>
              <th>Decel Lane (ft)</th>
            </tr>
          </thead>
          <tbody>
            {#each segments as row, i (row.seg_num)}
              <tr>
                <td>{row.seg_num}</td>
                <td>
                  <select class="select select-bordered select-sm" bind:value={segments[i].seg_type}>
                    <option>Basic</option>
                    <option>Merge</option>
                    <option>Diverge</option>
                    <option>Weaving</option>
                    <option value="OverlappingRamp">Overlapping Ramp</option>
                  </select>
                </td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].length_ft} placeholder="5280" autocomplete="off" /></td>
                <td><input class="input input-bordered input-sm" type="number" min="1" max="8" bind:value={segments[i].lanes} placeholder="3" autocomplete="off" /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].on_ramp} placeholder="450, 540" autocomplete="off" disabled={row.seg_type !== 'Merge' && row.seg_type !== 'Weaving'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].off_ramp} placeholder="270, 360" autocomplete="off" disabled={row.seg_type !== 'Diverge' && row.seg_type !== 'Weaving'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].ramp_ffs} placeholder="40" autocomplete="off" disabled={row.seg_type === 'Basic'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].accel} placeholder="500" autocomplete="off" disabled={row.seg_type !== 'Merge' && row.seg_type !== 'OverlappingRamp'} /></td>
                <td><input class="input input-bordered input-sm" bind:value={segments[i].decel} placeholder="500" autocomplete="off" disabled={row.seg_type !== 'Diverge' && row.seg_type !== 'OverlappingRamp'} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Weaving details, one card per weaving segment (the hcm10 idiom) -->
      <div class="hc-subtables">
        {#each segments as row, i (row.seg_num)}
          {#if row.seg_type === 'Weaving'}
            <div class="hc-card">
              <div class="hc-card-head">
                <h3>Segment {row.seg_num} · Weaving Details</h3>
              </div>
              <div class="param-grid">
                <div class="param-field">
                  <label for="SL_input{row.seg_num}">Short Length</label>
                  <div class="cell-field">
                    <input id="SL_input{row.seg_num}" class="input input-bordered input-sm" bind:value={segments[i].short_length} placeholder="Segment length" autocomplete="off" />
                    <span class="unit">ft</span>
                  </div>
                </div>
                <div class="param-field">
                  <label for="NWL_input{row.seg_num}">Weaving Lanes</label>
                  <div class="cell-field">
                    <input id="NWL_input{row.seg_num}" type="number" min="2" max="3" class="input input-bordered input-sm" bind:value={segments[i].weaving_lanes} placeholder="2" autocomplete="off" />
                  </div>
                </div>
                <div class="param-field">
                  <label for="LCRF_input{row.seg_num}">Ramp-to-Freeway Lane Changes</label>
                  <div class="cell-field">
                    <input id="LCRF_input{row.seg_num}" type="number" min="0" class="input input-bordered input-sm" bind:value={segments[i].lc_rf} placeholder="1" autocomplete="off" />
                  </div>
                </div>
                <div class="param-field">
                  <label for="LCFR_input{row.seg_num}">Freeway-to-Ramp Lane Changes</label>
                  <div class="cell-field">
                    <input id="LCFR_input{row.seg_num}" type="number" min="0" class="input input-bordered input-sm" bind:value={segments[i].lc_fr} placeholder="1" autocomplete="off" />
                  </div>
                </div>
                <div class="param-field">
                  <label for="RR_input{row.seg_num}">Ramp-to-Ramp Demand</label>
                  <div class="cell-field">
                    <input id="RR_input{row.seg_num}" class="input input-bordered input-sm" bind:value={segments[i].ramp_to_ramp} placeholder="50, 100" autocomplete="off" />
                    <span class="unit">veh/h</span>
                  </div>
                  <p class="param-hint">One value per analysis period.</p>
                </div>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </section>

    <!-- Scenario generation -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Scenario Generation</h2>
          <p class="panel-sub">The reliability reporting period covers all 12 months on weekdays with HCM default demand ratios.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="REP_input">Replications per Demand Combination</label>
          <div class="cell-field">
            <input id="REP_input" type="number" min="1" max="20" class="input input-bordered input-sm" bind:value={replications} placeholder="4" required />
          </div>
          <p class="param-hint">4 replications across 12 months and 5 weekdays yields 240 scenarios.</p>
        </div>

        <div class="param-field">
          <label for="SEEDM_input">Seed Dataset Month</label>
          <select id="SEEDM_input" class="select select-bordered select-sm" bind:value={seed_month}>
            {#each ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as name, m}
              <option value={m + 1}>{name}</option>
            {/each}
          </select>
        </div>

        <div class="param-field">
          <label for="SEEDW_input">Seed Dataset Weekday</label>
          <select id="SEEDW_input" class="select select-bordered select-sm" bind:value={seed_weekday}>
            <option value="monday">Monday</option>
            <option value="tuesday">Tuesday</option>
            <option value="wednesday">Wednesday</option>
            <option value="thursday">Thursday</option>
            <option value="friday">Friday</option>
          </select>
        </div>

        <div class="param-field">
          <label for="SEED_input">Random Seed</label>
          <div class="cell-field">
            <input id="SEED_input" type="number" min="0" class="input input-bordered input-sm" bind:value={rng_seed} placeholder="1" required />
          </div>
          <p class="param-hint">Keep the same seed to reproduce a scenario set.</p>
        </div>

        <div class="param-field">
          <label for="INC_input">
            <input id="INC_input" type="checkbox" class="checkbox checkbox-sm" bind:checked={include_incidents} />
            Include Incidents
          </label>
        </div>

        <div class="param-field">
          <label for="CR_input">Crash Rate</label>
          <div class="cell-field">
            <input id="CR_input" type="number" min="0" class="input input-bordered input-sm" bind:value={crash_rate} placeholder="150" disabled={!include_incidents} />
            <span class="unit">per 100M VMT</span>
          </div>
        </div>

        <div class="param-field">
          <label for="ICR_input">Incident-to-Crash Ratio</label>
          <div class="cell-field">
            <input id="ICR_input" type="number" step="0.1" min="1" class="input input-bordered input-sm" bind:value={incident_crash_ratio} placeholder="4.9" disabled={!include_incidents} />
          </div>
          <p class="param-hint">The HCM national default is 4.9.</p>
        </div>

        <div class="param-field">
          <label for="TS_input">Target Speed for On-Time Measure</label>
          <div class="cell-field">
            <input id="TS_input" type="number" min="1" class="input input-bordered input-sm" bind:value={target_speed} placeholder="45" required />
            <span class="unit">mi/h</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Weather (Step B-6). Opt-in: the generator models no weather until the
         panel is opened, which is what this page has always done. -->
    <details class="panel fidelity-panel">
      <summary class="fidelity-summary">
        <span class="fidelity-title">Weather Events</span>
        <span class="fidelity-state">{weather ? 'Active' : 'Not modeled'}</span>
      </summary>
      <p class="panel-sub">HCM Chapter 11 Step B-6. Timewise probability of each severe weather type by month (Equation 25-75) with its mean event duration, which the generator rounds to the nearest 15-min analysis period. Capacity and speed adjustments come from the Exhibit 11-20 and 11-21 defaults at the facility free-flow speed and are not edited here. Opening the panel seeds Example Problem 7's own weather, so nothing is applied blank.</p>
      <div class="fidelity-actions">
        <label class="fidelity-check">
          <input id="WX_input" type="checkbox" class="checkbox checkbox-sm" checked={!!weather} onchange={toggleWeather} />
          Model weather events
        </label>
        <button class="btn btn-outline btn-sm" type="button" onclick={seedWeather} disabled={!weather}>Load Example Problem 7 weather</button>
      </div>
      {#if weather}
        <div class="w-full overflow-x-auto">
          <table class="table grid-table w-full">
            <thead>
              <tr>
                <th>Month</th>
                {#each WEATHER_TYPES as t}<th>{t}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each weather.probabilities_by_month as monthRow, mo}
                <tr>
                  <th>{MONTH_NAMES[mo]}</th>
                  {#each monthRow as _, ty}
                    <td><input class="input input-bordered input-xs grid-cell" type="number" step="0.0001" min="0" max="1" bind:value={weather.probabilities_by_month[mo][ty]} aria-label="{MONTH_NAMES[mo]} {WEATHER_TYPES[ty]} probability" /></td>
                  {/each}
                </tr>
              {/each}
              <tr>
                <th>Duration (min)</th>
                {#each weather.durations_min as _, ty}
                  <td><input class="input input-bordered input-xs grid-cell" type="number" step="0.1" min="0" bind:value={weather.durations_min[ty]} aria-label="{WEATHER_TYPES[ty]} mean duration" /></td>
                {/each}
              </tr>
            </tbody>
          </table>
        </div>
        <div class="param-grid">
          <div class="param-field">
            <label for="WXDAF_input">Demand Adjustment Factor During Events</label>
            <div class="cell-field">
              <input id="WXDAF_input" type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={weather.daf} />
            </div>
            <p class="param-hint">The HCM gives no national default; Step B-6 notes weather DAFs are user-supplied. Example Problem 7 uses 1.00.</p>
          </div>
        </div>
      {/if}
    </details>

    <!-- Demand multipliers (Equation 25-72). Opt-in: without them the engine
         uses the Exhibit 11-18 national ratios. -->
    <details class="panel fidelity-panel">
      <summary class="fidelity-summary">
        <span class="fidelity-title">Demand Multipliers</span>
        <span class="fidelity-state">{demand_multipliers ? 'Local table' : 'Exhibit 11-18 defaults'}</span>
      </summary>
      <p class="panel-sub">A local demand multiplier table replacing the Exhibit 11-18 national ratios (Equation 25-72). Only each cell's ratio to the seed date's own multiplier is used, so any consistent base works. Weekend columns stay at zero while the reporting period is weekdays only. Opening the panel seeds Example Problem 7's Exhibit 25-100 table.</p>
      <div class="fidelity-actions">
        <label class="fidelity-check">
          <input id="DM_input" type="checkbox" class="checkbox checkbox-sm" checked={!!demand_multipliers} onchange={toggleDemandMultipliers} />
          Use a local demand multiplier table
        </label>
        <button class="btn btn-outline btn-sm" type="button" onclick={seedDemandMultipliers} disabled={!demand_multipliers}>Load Example Problem 7 table (Exhibit 25-100)</button>
      </div>
      {#if demand_multipliers}
        <div class="w-full overflow-x-auto">
          <table class="table grid-table w-full">
            <thead>
              <tr>
                <th>Month</th>
                {#each WEEKDAY_NAMES as d}<th>{d}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each demand_multipliers as monthRow, mo}
                <tr>
                  <th>{MONTH_NAMES[mo]}</th>
                  {#each monthRow as _, d}
                    <td><input class="input input-bordered input-xs grid-cell" type="number" step="0.001" min="0" bind:value={demand_multipliers[mo][d]} aria-label="{MONTH_NAMES[mo]} {WEEKDAY_NAMES[d]} demand multiplier" /></td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </details>

    <!-- Facility parameters and distribution weighting. All blank/default. -->
    <details class="panel fidelity-panel">
      <summary class="fidelity-summary">
        <span class="fidelity-title">Facility Parameters</span>
        <span class="fidelity-state">{facilityParamsActive ? 'Overridden' : 'Engine defaults'}</span>
      </summary>
      <p class="panel-sub">The four parameters the reliability run forwards to its internal Chapter 10 facility. Leave any of them blank to keep the engine default.</p>
      <div class="param-grid">
        <div class="param-field">
          <label for="JAM_input">Jam Density</label>
          <div class="cell-field">
            <input id="JAM_input" type="number" min="100" class="input input-bordered input-sm" bind:value={jam_density} placeholder="190" />
            <span class="unit">pc/mi/ln</span>
          </div>
          <p class="param-hint">Blank uses 190 pc/mi/ln.</p>
        </div>
        <div class="param-field">
          <label for="QDROP_input">Queue Discharge Capacity Drop</label>
          <div class="cell-field">
            <input id="QDROP_input" type="number" step="0.5" min="0" max="30" class="input input-bordered input-sm" bind:value={queue_discharge_drop} placeholder="7" />
            <span class="unit">%</span>
          </div>
          <p class="param-hint">Blank uses 7%.</p>
        </div>
        <div class="param-field">
          <label for="TRD_input">Total Ramp Density</label>
          <div class="cell-field">
            <input id="TRD_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={total_ramp_density} placeholder="1.0" />
            <span class="unit">/mi</span>
          </div>
          <p class="param-hint">Blank uses 1.0 ramps/mi.</p>
        </div>
        <div class="param-field">
          <label for="ID_input">Interchange Density</label>
          <div class="cell-field">
            <input id="ID_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={interchange_density} placeholder="" />
            <span class="unit">/mi</span>
          </div>
          <p class="param-hint">Used by weaving segments. Blank falls back to the total ramp density, which is 1.0/mi where that is also blank.</p>
        </div>
        <div class="param-field">
          <label for="WEIGHT_input">TTI Distribution Weighting</label>
          <select id="WEIGHT_input" class="select select-bordered select-sm" bind:value={tti_weighting}>
            <option value="vmt">VMT-weighted (Exhibit 25-105)</option>
            <option value="probability">Probability-weighted (Exhibit 25-104)</option>
          </select>
          <p class="param-hint">The HCM reports Example Problem 7's summary measures probability-weighted over the observations and defines the reliability rating on VMT.</p>
        </div>
      </div>
    </details>

    <!-- Form Actions -->
    <div class="action-bar">
      <button class="btn btn-ghost" onclick={resetParams} type="button">Reset Params</button>
      <button class="btn btn-outline" onclick={loadExampleProblem7} type="button">Load Example Problem 7</button>
      <button class="btn btn-primary" type="submit" disabled={!ready || running}>{running ? 'Running…' : 'Calculate'}</button>
    </div>
  </form>

  <section class="panel results-panel">
    <div class="panel-head with-actions">
      <div>
        <h2 class="panel-title">Outputs</h2>
        <p class="panel-sub">Results populate after pressing Calculate. Every scenario is evaluated with the Chapter 10 core methodology, so the run can take a few seconds.</p>
      </div>
      {#if results}
        <div class="panel-actions">
          <a class="btn btn-outline btn-sm" href="/report">Open printable report</a>
        </div>
      {/if}
    </div>
    <div class="los overflow-x-auto">
      <table class="table w-full">
        <tbody>
          <tr>
            <th>Scenarios Evaluated:</th>
            <td>{results ? results.num_scenarios : ''}</td>
          </tr>
          <tr>
            <th>Travel Time Observations:</th>
            <td>{results ? results.num_observations : ''}</td>
          </tr>
          <tr>
            <th>Free-Flow Travel Time (min):</th>
            <td>{results ? results.fftt.toFixed(2) : ''}</td>
          </tr>
          <tr>
            <th>Mean TTI:</th>
            <td>{results ? results.tti_mean.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>50th Percentile TTI:</th>
            <td>{results ? results.tti_50.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>80th Percentile TTI:</th>
            <td>{results ? results.tti_80.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>95th Percentile TTI (PTI):</th>
            <td>{results ? results.tti_95.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>Misery Index:</th>
            <td>{results ? results.misery_index.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>Semi-Standard Deviation:</th>
            <td>{results ? results.semi_std_dev.toFixed(3) : ''}</td>
          </tr>
          <tr>
            <th>Expected Vehicle Hours of Delay (veh-h):</th>
            <td>{results ? results.expected_vhd.toFixed(1) : ''}</td>
          </tr>
          <tr>
            <th>Share of Travel Below {target_speed} mi/h (%):</th>
            <td>{results ? results.pct_below_target.toFixed(1) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Reliability Rating: {results ? results.reliability_rating.toFixed(1) + ratingSuffix : ''}</p>
      </div>
    </div>
  </section>
</div>

<style>
  .diagram-block { margin: 1rem auto 0; max-width: 640px; }
  .diagram-toggle-row { margin-bottom: 0.75rem; text-align: center; }

  .fidelity-panel > summary { cursor: pointer; list-style: none; }
  .fidelity-panel > summary::-webkit-details-marker { display: none; }
  .fidelity-summary { display: flex; align-items: baseline; gap: 0.75rem; }
  .fidelity-summary::before { content: '▸'; opacity: 0.6; }
  .fidelity-panel[open] .fidelity-summary::before { content: '▾'; }
  .fidelity-title { font-weight: 600; font-size: 1.05rem; }
  .fidelity-state { font-size: 0.8rem; opacity: 0.7; }
  .fidelity-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; margin: 0.75rem 0; }
  .fidelity-check { display: flex; align-items: center; gap: 0.4rem; }
  /* The probability matrix is 12 by 10, so the cells are sized to fit the
     grid rather than to match the rest of the form's inputs. */
  .grid-table th { font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
  .grid-cell { width: 5.5rem; }
</style>
