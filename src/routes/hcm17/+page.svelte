<svelte:head>
  <title>Urban Street Reliability and ATDM · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmUrbanReliability } from "HCM-middleware";
  import UrbanFacilityDiagram from '$lib/UrbanFacilityDiagram.svelte';
  import UrbanFacilityDiagram3D from '$lib/UrbanFacilityDiagram3D.svelte';
  import ViewToggle from '$lib/ViewToggle.svelte';
  import { setReport } from '$lib/report';
  import { onMount } from "svelte";

  let ready = $state(false);
  let running = $state(false);

  let diagramMode = $state('2d');
  let selectedSeg = $state(-1);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Defaults are HCM Chapter 29, Section 5, Example Problem 4 (Exhibits 29-62
  // through 29-77): the idealized 3-mi Lincoln, Nebraska principal arterial of
  // six 2,640-ft signalized segments, weekdays for one year, 7-10 a.m. in
  // twelve 15-min analysis periods, seeds 82/11/63. Monthly weather is the
  // Lincoln NCDC record of Exhibit 29-65. Same fixture and expectations as
  // tests/boundary/ch17_urban_reliability.mjs, so an untouched page reproduces
  // 3,120 scenarios, mean TTI 1.545, TTI-80 1.593, PTI 1.746, reliability
  // rating 98.8, and 70 oversaturated scenarios.
  let functional_class = $state('principal');
  let study_start_hour = $state(7);
  let analysis_periods = $state(12);
  // 0 = Sunday through 6 = Saturday. The calendar anchor decides which
  // Exhibit 17-6 day-of-week demand factor lands on which date, so it moves
  // the whole scenario set, not just the labels.
  let jan1_day_of_week = $state(6);
  let pct_left_turn_lanes = $state(100);

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Monthly weather normals, January through December. Snowfall is
  // deliberately absent: the Chapter 29 procedure decides rain versus snow
  // from the sampled temperature (Equations 29-3 and 29-4) and sizes the snow
  // event from the precipitation columns, so a snow climate is expressed
  // through the mean temperature and precipitation entries below. The
  // engine's snowfall column is carried but never read.
  function defaultWeather() {
    return [
      { total_precip: 0.67, days_with_precip: 5, mean_temp: 22.4, precip_rate: 0.030 },
      { total_precip: 0.80, days_with_precip: 6, mean_temp: 27.0, precip_rate: 0.035 },
      { total_precip: 1.80, days_with_precip: 7, mean_temp: 39.0, precip_rate: 0.045 },
      { total_precip: 2.90, days_with_precip: 9, mean_temp: 51.2, precip_rate: 0.062 },
      { total_precip: 4.20, days_with_precip: 11, mean_temp: 62.0, precip_rate: 0.070 },
      { total_precip: 3.50, days_with_precip: 9, mean_temp: 72.0, precip_rate: 0.080 },
      { total_precip: 3.00, days_with_precip: 8, mean_temp: 78.0, precip_rate: 0.085 },
      { total_precip: 3.20, days_with_precip: 8, mean_temp: 75.0, precip_rate: 0.080 },
      { total_precip: 2.90, days_with_precip: 7, mean_temp: 66.0, precip_rate: 0.070 },
      { total_precip: 1.90, days_with_precip: 6, mean_temp: 54.0, precip_rate: 0.055 },
      { total_precip: 1.20, days_with_precip: 5, mean_temp: 38.0, precip_rate: 0.040 },
      { total_precip: 0.80, days_with_precip: 5, mean_temp: 26.0, precip_rate: 0.032 }
    ];
  }

  let weather = $state(defaultWeather());

  // Incident inputs
  let entry_intersection_crashes = $state(32);
  let minor_leg_volume = $state(1300);
  let shoulder_present = $state('yes');

  // Monte Carlo seeds (same seeds reproduce the same scenario streams)
  let weather_seed = $state(82);
  let demand_seed = $state(11);
  let incident_seed = $state(63);

  // Exhibit 29-68 crash frequencies rise along the facility, so each segment
  // carries its own pair rather than sharing one default.
  function defaultSegment(i) {
    return {
      segment_length: 2640,
      n_through_lanes: 2,
      speed_limit: 35,
      through_demand: 1000,
      cycle_length: 100,
      effective_green: 45,
      sat_flow: 1800,
      platoon_ratio: 1.333,
      access_points_subject: 2,
      access_points_opposing: 2,
      stop_rate_override: 0.5,
      segment_crashes: 15 + i,
      intersection_crashes: 33 + i,
      k_factor: 0.5,
      i_factor: 1.0,
      approach_lanes: 4
    };
  }

  function defaultSegments() {
    return Array.from({ length: 6 }, (_, i) => defaultSegment(i));
  }

  // Signalized segments ordered upstream to downstream
  let segments = $state(defaultSegments());

  // ATDM strategies, work zones, and special events (Chapter 17, Section 4).
  // Every field of the engine's strategy record has a no-effect default, so a
  // blank cell is simply not sent.
  let strategies = $state([]);

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const CLASS_LABEL = {
    principal: 'Urban Principal Arterial',
    minor: 'Urban Minor Arterial',
    expressway: 'Expressway'
  };

  // Blank optional inputs become undefined so the engine applies its defaults.
  function opt(v) {
    return v === '' || v === null || v === undefined ? undefined : Number(v);
  }

  function column(key) {
    return Float64Array.from(weather.map((w) => Number(w[key])));
  }

  function addSegment() {
    segments = [...segments, defaultSegment(segments.length)];
  }

  function removeSegment(index) {
    if (segments.length <= 1) return;
    segments = segments.filter((_, i) => i !== index);
    if (selectedSeg >= index) selectedSeg = -1;
  }

  function addStrategy() {
    strategies = [...strategies, { name: '', effective_green_adjustment_s: '', sat_flow_adjustment: '' }];
  }

  function removeStrategy(index) {
    strategies = strategies.filter((_, i) => i !== index);
  }

  function strategyLabel(s, i) {
    return s.name.trim() === '' ? `Strategy ${i + 1}` : s.name.trim();
  }

  function runAnalysis() {
    hasError = false;
    results = null;
    running = true;

    // Let the button state paint before the synchronous WASM run starts.
    setTimeout(() => {
      try {
        const rel = new WasmUrbanReliability(
          functional_class,
          Number(study_start_hour),
          Number(analysis_periods),
          column('total_precip'),
          column('days_with_precip'),
          column('mean_temp'),
          column('precip_rate'),
          Number(entry_intersection_crashes),
          Number(minor_leg_volume),
          shoulder_present === 'yes',
          true,                      // VMT-weighted travel time distribution
          Number(weather_seed),
          Number(demand_seed),
          Number(incident_seed),
          undefined,                 // monthly snowfall: carried by the engine but never read, see the note below the weather table
          Number(jan1_day_of_week),
          Number(pct_left_turn_lanes) / 100
        );

        // Strategies must be registered before run().
        strategies.forEach((s, i) => {
          const strategy = { name: strategyLabel(s, i) };
          if (opt(s.effective_green_adjustment_s) !== undefined) strategy.effective_green_adjustment_s = Number(s.effective_green_adjustment_s);
          if (opt(s.sat_flow_adjustment) !== undefined) strategy.sat_flow_adjustment = Number(s.sat_flow_adjustment);
          rel.add_atdm_strategy(strategy);
        });

        for (const seg of segments) {
          rel.add_segment(
            Number(seg.segment_length),
            Number(seg.n_through_lanes),
            Number(seg.speed_limit),
            Number(seg.through_demand),
            Number(seg.cycle_length),
            Number(seg.effective_green),
            opt(seg.sat_flow),
            opt(seg.platoon_ratio),
            Number(seg.access_points_subject),
            Number(seg.access_points_opposing),
            opt(seg.stop_rate_override),
            Number(seg.segment_crashes),
            Number(seg.intersection_crashes),
            opt(seg.k_factor),
            opt(seg.i_factor),
            opt(seg.approach_lanes)
          );
        }

        rel.run();
        results = rel.results_to_js_value();

        setReport({
          chapter: 'Urban Street Reliability and ATDM',
          chapterRef: 'HCM Chapter 17',
          href: '/hcm17',
          generatedAt: new Date().toLocaleString(),
          headline: { label: 'Reliability rating', value: `${fmt(results.reliability_rating, 1)} %` },
          inputs: [
            { label: 'Functional class', value: CLASS_LABEL[functional_class] },
            { label: 'Study period', value: `${study_start_hour}:00 onward, ${analysis_periods} analysis periods of 15 min` },
            { label: 'Reliability reporting period', value: 'weekdays of a full year' },
            { label: 'January 1 day of week', value: DAY_NAMES[Number(jan1_day_of_week)] },
            { label: 'Signalized segments', value: segments.length },
            { label: 'Weather record', value: 'twelve monthly normals entered on the form' },
            { label: 'Entry intersection crash frequency', value: `${entry_intersection_crashes} crashes/yr` },
            { label: 'Minor-street leg volume', value: `${minor_leg_volume} veh/h` },
            { label: 'Outside shoulders present', value: shoulder_present === 'yes' ? 'yes' : 'no' },
            { label: 'Intersections with left-turn lanes', value: `${pct_left_turn_lanes}%` },
            { label: 'Seeds, weather / demand / incident', value: `${weather_seed} / ${demand_seed} / ${incident_seed}` },
            { label: 'Travel time distribution weighting', value: 'VMT-weighted' },
            { label: 'ATDM strategies', value: strategies.length === 0
              ? 'none'
              : strategies.map((s, i) => `${strategyLabel(s, i)} (green ${s.effective_green_adjustment_s === '' ? 0 : s.effective_green_adjustment_s} s, saturation flow x${s.sat_flow_adjustment === '' ? 1 : s.sat_flow_adjustment})`).join('; ') },
          ],
          resultTable: {
            columns: ['Measure', 'Value', 'Unit'],
            rows: [
              ['Scenarios evaluated', `${results.num_scenarios}`, ''],
              ['Weather events generated', `${results.num_weather_events}`, ''],
              ['Incidents generated', `${results.num_incidents}`, ''],
              ['Oversaturated scenarios', `${results.num_oversaturated_scenarios}`, ''],
              ['Scenarios with nondry weather', fmt(results.pct_nondry_scenarios, 1), '%'],
              ['Base free-flow travel time', fmt(results.base_free_flow_travel_time, 1), 's'],
              ['Mean travel time', fmt(results.mean_travel_time, 1), 's'],
              ['Mean travel time index', fmt(results.tti_mean, 3), ''],
              ['50th percentile TTI', fmt(results.tti_50, 3), ''],
              ['80th percentile TTI', fmt(results.tti_80, 3), ''],
              ['95th percentile TTI (PTI)', fmt(results.tti_95, 3), ''],
              ['Total vehicle hours of delay', fmt(results.total_vhd, 0), 'veh-h'],
            ],
          },
          summary: [
            { label: 'Mean travel time index', value: fmt(results.tti_mean, 3) },
            { label: 'Planning time index (95th percentile TTI)', value: fmt(results.tti_95, 3) },
            { label: 'Urban street reliability rating', value: `${fmt(results.reliability_rating, 1)} %` },
          ],
          methodology: [
            'HCM Chapter 17 reliability methodology with the Chapter 29 scenario generation procedure: a weather event record from the monthly normals (Equations 29-1 through 29-12), demand ratios by month and day of week (Exhibit 17-6) anchored on the January 1 day of week, and an incident record from the segment and intersection crash frequencies (Equations 29-13 through 29-29). Every generated scenario is evaluated with the Chapter 16 and 18 urban street methods, and oversaturated periods carry their residual queue forward into the next analysis period of the same day.',
            `Monte Carlo scheme: three independent seeded streams, weather ${weather_seed}, demand ${demand_seed}, and incidents ${incident_seed}. The stream is software-specific, which the HCM anticipates ("Each result, though different, will be equally valid"), so a run reproduces exactly on the same seeds and differs on any other seeds. The published Exhibit 29-73 replication study saw average travel time vary by about 1.4% across replications.`,
            'The travel time distribution is VMT-weighted, and the reliability rating is the percentage of that weighted distribution with a travel time index below 2.5 (Chapter 17, Section 3).',
            'Per-scenario results are summary-only here. The distribution measures and the oversaturated-scenario count are the readouts; the individual scenario travel times behind them are not exported.',
            strategies.length === 0
              ? 'No ATDM strategy, work zone, or special event was applied, so every scenario ran on the base inputs.'
              : `ATDM strategies applied to every scenario as input-level adjustments (Chapter 17, Section 4): ${strategies.map((s, i) => strategyLabel(s, i)).join('; ')}.`,
          ],
          diagram: {
            kind: 'urban-facility',
            props: {
              segments: diagramSegments,
              note: 'Segment chain, upstream to downstream. The reliability method reports one travel time distribution for the whole facility, so the decks carry no per-segment colour.'
            }
          },
        });
      } catch (err) {
        console.error('Chapter 17 analysis failed:', err);
        hasError = true;
        errMessage = 'The reliability run could not be completed with the given inputs. Check the values and try again.';
      } finally {
        running = false;
      }
    }, 20);
  }

  function resetParams() {
    functional_class = 'principal';
    study_start_hour = 7;
    analysis_periods = 12;
    jan1_day_of_week = 6;
    pct_left_turn_lanes = 100;
    weather = defaultWeather();
    entry_intersection_crashes = 32;
    minor_leg_volume = 1300;
    shoulder_present = 'yes';
    weather_seed = 82;
    demand_seed = 11;
    incident_seed = 63;
    segments = defaultSegments();
    strategies = [];
    results = null;
    selectedSeg = -1;
    hasError = false;
  }

  function fmt(v, digits) {
    return v === null || v === undefined ? '' : v.toFixed(digits);
  }

  // The percentile strip is drawn against the PTI so the longest bar always
  // fills the track, and against 1.0 at the left because a TTI below the base
  // free-flow travel time is not reachable.
  let ttiBars = $derived(results ? [
    { label: 'Mean', value: results.tti_mean },
    { label: '50th', value: results.tti_50 },
    { label: '80th', value: results.tti_80 },
    { label: '95th (PTI)', value: results.tti_95 }
  ] : []);

  function barPct(v) {
    const top = results ? Math.max(results.tti_95, 1.0001) : 1.0001;
    return Math.max(2, Math.min(100, ((v - 1) / (top - 1)) * 100));
  }

  // The strip is the same component the Chapter 16 page uses, with one
  // difference: `los` is always null, so the decks stay pavement-coloured
  // before and after a run. Chapter 17 reports the travel time distribution
  // of the whole facility and exports nothing per segment, so there is no
  // per-segment value to colour a deck with. Tinting all six decks one shade
  // for the facility mean TTI would reuse a channel that means "this
  // segment's LOS" everywhere else in the calculator, and it would put a TTI
  // band on the LOS colour scale, which is a different scale entirely. The
  // facility-level readout stays where it can be read as facility-level: the
  // TTI bar strip and the reliability rating below.
  let diagramSegments = $derived(
    segments.map((s) => ({
      length_ft: Number(s.segment_length) || 0,
      lanes: Number(s.n_through_lanes) || 2,
      accessPoints: Number(s.access_points_subject) || 0,
      control: 'signalized',
      los: null
    }))
  );

  const DIAGRAM_NOTE = 'Segment chain, upstream to downstream, separated by its signalized boundary intersections. Widths follow segment length, depth the through-lane count, and the ticks below each link are its subject-side access points. Click a segment to highlight its card. The decks are not colour coded: the reliability method reports one travel time distribution for the whole facility and exposes no per-segment result to tint them with.';
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 17 <span class="badge badge-warning badge-sm ml-2">Beta</span></span>
    <h1 class="page-title">Urban Street Reliability and ATDM</h1>
    <p class="page-sub">
      Estimate the travel time distribution, travel time index, and reliability
      rating of a signalized urban street facility over a one-year weekday
      reporting period with generated weather, demand, and incident scenarios.
    </p>
  </header>

  <div class="alert alert-warning shadow-sm mb-6 beta-note" role="note">
    <span>
      <strong>Beta.</strong> The compute engine is boundary-validated against HCM
      Chapter 29, Example Problem 4 (Exhibits 29-62 through 29-77), which the page
      defaults reproduce, along with the Example Problem 5 Strategy 1 and Chapter 37
      adaptive signal control directions of effect. Verify results independently
      before relying on them in engineering work, and please
      <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  <form id="hcm17" onsubmit={preventDefault(runAnalysis)}>
    <!-- Facility strip -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Facility</h2>
          <p class="panel-sub">The signalized segment chain the reliability run evaluates, drawn upstream to downstream in the subject direction of travel.</p>
        </div>
        <div class="panel-actions">
          <ViewToggle bind:mode={diagramMode} label="Facility view mode" />
        </div>
      </div>
      {#if diagramMode === '3d'}
        <UrbanFacilityDiagram3D
          segments={diagramSegments}
          selected={selectedSeg}
          onselect={(i) => (selectedSeg = selectedSeg === i ? -1 : i)} />
      {:else}
        <UrbanFacilityDiagram
          segments={diagramSegments}
          selected={selectedSeg}
          onselect={(i) => (selectedSeg = selectedSeg === i ? -1 : i)}
          note={DIAGRAM_NOTE} />
      {/if}
    </section>

    <!-- Reporting period -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Reliability Reporting Period</h2>
          <p class="panel-sub">Weekdays of a full year. Demand ratios follow the HCM defaults for the selected functional class.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="FC_input">Functional Class</label>
          <select id="FC_input" class="select select-bordered select-sm" bind:value={functional_class}>
            <option value="principal">Urban Principal Arterial</option>
            <option value="minor">Urban Minor Arterial</option>
            <option value="expressway">Expressway</option>
          </select>
        </div>

        <div class="param-field">
          <label for="SSH_input">Study Period Start Hour</label>
          <div class="cell-field">
            <input id="SSH_input" type="number" min="0" max="23" class="input input-bordered input-sm" bind:value={study_start_hour} placeholder="7" required />
            <span class="unit">h</span>
          </div>
          <p class="param-hint">7 starts the study period at 7 a.m. It is also the hour of the base traffic count.</p>
        </div>

        <div class="param-field">
          <label for="APD_input">Analysis Periods per Day</label>
          <div class="cell-field">
            <input id="APD_input" type="number" min="1" max="96" class="input input-bordered input-sm" bind:value={analysis_periods} placeholder="12" required />
            <span class="unit">15-min</span>
          </div>
          <p class="param-hint">12 periods cover a 3-hour study period.</p>
        </div>

        <div class="param-field">
          <label for="JAN_input">January 1 Falls On</label>
          <select id="JAN_input" class="select select-bordered select-sm" bind:value={jan1_day_of_week}>
            {#each DAY_NAMES as day, i}
              <option value={i}>{day}</option>
            {/each}
          </select>
          <p class="param-hint">Anchors the calendar. A wrong day puts every Exhibit 17-6 day-of-week demand factor on the wrong date.</p>
        </div>

        <div class="param-field">
          <label for="PLTL_input">Intersections with Left-Turn Lanes</label>
          <div class="cell-field">
            <input id="PLTL_input" type="number" min="0" max="100" class="input input-bordered input-sm" bind:value={pct_left_turn_lanes} placeholder="100" required />
            <span class="unit">%</span>
          </div>
          <p class="param-hint">Passed through to the Chapter 18 segment evaluation of each scenario.</p>
        </div>
      </div>
    </section>

    <!-- Weather -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Weather</h2>
          <p class="panel-sub">Monthly normals for the facility's location, January through December. Defaults are the Lincoln, Nebraska record of Exhibit 29-65.</p>
        </div>
      </div>
      <div class="w-full overflow-x-auto">
        <table class="table seg-table w-full">
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Precipitation (in.)</th>
              <th>Days with Precipitation</th>
              <th>Normal Daily Mean Temperature (F)</th>
              <th>Precipitation Rate (in./h)</th>
            </tr>
          </thead>
          <tbody>
            {#each weather as row, i}
              <tr>
                <td>{MONTH_NAMES[i]}</td>
                <td><input id={"PRC_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" aria-label={MONTH_NAMES[i] + " total precipitation"} bind:value={weather[i].total_precip} required /></td>
                <td><input id={"DWP_input_" + i} type="number" step="0.1" min="0" max="31" class="input input-bordered input-sm" aria-label={MONTH_NAMES[i] + " days with precipitation"} bind:value={weather[i].days_with_precip} required /></td>
                <td><input id={"TMP_input_" + i} type="number" step="0.1" class="input input-bordered input-sm" aria-label={MONTH_NAMES[i] + " mean temperature"} bind:value={weather[i].mean_temp} required /></td>
                <td><input id={"PRR_input_" + i} type="number" step="0.001" min="0" class="input input-bordered input-sm" aria-label={MONTH_NAMES[i] + " precipitation rate"} bind:value={weather[i].precip_rate} required /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="param-hint panel-note">
        There is no snowfall column. The Chapter 29 procedure decides whether an event
        falls as rain or as snow from the sampled temperature (Equations 29-3 and 29-4)
        and sizes the snow depth from the precipitation columns, so a snow climate is
        entered through the mean temperature and precipitation values above.
      </p>
    </section>

    <!-- Incidents -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Incidents</h2>
          <p class="panel-sub">Crash frequencies drive the incident generator. Per-segment values are entered with each segment below.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="EIC_input">Entry Intersection Crash Frequency</label>
          <div class="cell-field">
            <input id="EIC_input" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={entry_intersection_crashes} placeholder="32" required />
            <span class="unit">crashes/yr</span>
          </div>
          <p class="param-hint">The intersection at the upstream end of the facility.</p>
        </div>

        <div class="param-field">
          <label for="MLV_input">Minor-Street Leg Volume</label>
          <div class="cell-field">
            <input id="MLV_input" type="number" min="0" class="input input-bordered input-sm" bind:value={minor_leg_volume} placeholder="1300" required />
            <span class="unit">veh/h</span>
          </div>
        </div>

        <div class="param-field">
          <label for="SHP_input">Outside Shoulders Present</label>
          <select id="SHP_input" class="select select-bordered select-sm" bind:value={shoulder_present}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div class="param-field">
          <label for="WSE_input">Weather Seed</label>
          <div class="cell-field">
            <input id="WSE_input" type="number" min="0" class="input input-bordered input-sm" bind:value={weather_seed} placeholder="82" required />
          </div>
        </div>

        <div class="param-field">
          <label for="DSE_input">Demand Seed</label>
          <div class="cell-field">
            <input id="DSE_input" type="number" min="0" class="input input-bordered input-sm" bind:value={demand_seed} placeholder="11" required />
          </div>
        </div>

        <div class="param-field">
          <label for="ISE_input">Incident Seed</label>
          <div class="cell-field">
            <input id="ISE_input" type="number" min="0" class="input input-bordered input-sm" bind:value={incident_seed} placeholder="63" required />
          </div>
        </div>
      </div>
      <p class="param-hint panel-note">The three seeds fix the weather, demand, and incident streams. Rerunning with the same seeds reproduces the run exactly; any other seeds give an equally valid replication.</p>
    </section>

    <!-- ATDM strategies -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">ATDM Strategies</h2>
          <p class="panel-sub">Strategies, work zones, and special events are applied to every scenario as input-level adjustments (Chapter 17, Section 4). A blank cell leaves that input alone.</p>
        </div>
        <div class="panel-actions">
          <button class="btn btn-ghost btn-sm" type="button" onclick={addStrategy}>Add Strategy</button>
        </div>
      </div>
      {#if strategies.length === 0}
        <p class="param-hint">No strategies. The run evaluates the facility as entered.</p>
      {:else}
        <div class="w-full overflow-x-auto">
          <table class="table seg-table w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Effective Green Adjustment (s)</th>
                <th>Saturation Flow Adjustment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each strategies as s, i}
                <tr>
                  <td>{i + 1}</td>
                  <td><input id={"STN_input_" + i} class="input input-bordered input-sm" aria-label={"Strategy " + (i + 1) + " name"} bind:value={strategies[i].name} placeholder={"Strategy " + (i + 1)} autocomplete="off" /></td>
                  <td><input id={"SGA_input_" + i} type="number" step="0.1" class="input input-bordered input-sm" aria-label={"Strategy " + (i + 1) + " effective green adjustment"} bind:value={strategies[i].effective_green_adjustment_s} placeholder="0" /></td>
                  <td><input id={"SSA_input_" + i} type="number" step="0.001" min="0" class="input input-bordered input-sm" aria-label={"Strategy " + (i + 1) + " saturation flow adjustment"} bind:value={strategies[i].sat_flow_adjustment} placeholder="1.000" /></td>
                  <td><button class="btn btn-ghost btn-sm" type="button" onclick={() => removeStrategy(i)}>Remove</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <p class="param-hint panel-note">
        The green adjustment is added to the coordinated through phase at every boundary
        signal, which is what Example Problem 5 Strategy 1 does with 5 s of split. The
        saturation flow adjustment multiplies the boundary saturation flow rate. Adaptive
        signal control enters here as a saturation flow adjustment of 1.156, the value
        Chapter 37 implies for its default 13.5% delay reduction target.
      </p>
    </section>

    <!-- Segments -->
    {#each segments as seg, i}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <section class="panel seg-panel" class:seg-selected={selectedSeg === i} onclick={() => (selectedSeg = i)}>
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Segment {i + 1}</h2>
            <p class="panel-sub">Signalized Chapter 18 segment, ordered upstream to downstream.</p>
          </div>
          <button class="btn btn-ghost btn-sm" type="button" onclick={() => removeSegment(i)} disabled={segments.length <= 1}>Remove</button>
        </div>
        <div class="param-grid">
          <div class="param-field">
            <label for={"LEN_input_" + i}>Segment Length</label>
            <div class="cell-field">
              <input id={"LEN_input_" + i} type="number" min="1" class="input input-bordered input-sm" bind:value={seg.segment_length} placeholder="2640" required />
              <span class="unit">ft</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"NTH_input_" + i}>Through Lanes</label>
            <div class="cell-field">
              <input id={"NTH_input_" + i} type="number" min="1" max="6" class="input input-bordered input-sm" bind:value={seg.n_through_lanes} required />
              <span class="unit">ln</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"SPL_input_" + i}>Posted Speed Limit</label>
            <div class="cell-field">
              <input id={"SPL_input_" + i} type="number" min="1" class="input input-bordered input-sm" bind:value={seg.speed_limit} placeholder="35" required />
              <span class="unit">mph</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"DEM_input_" + i}>Through Demand Flow Rate</label>
            <div class="cell-field">
              <input id={"DEM_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.through_demand} placeholder="1000" required />
              <span class="unit">veh/h</span>
            </div>
            <p class="param-hint">Demand of the base traffic count. Scenario demands are scaled from it.</p>
          </div>

          <div class="param-field">
            <label for={"CYC_input_" + i}>Cycle Length</label>
            <div class="cell-field">
              <input id={"CYC_input_" + i} type="number" min="1" class="input input-bordered input-sm" bind:value={seg.cycle_length} placeholder="100" required />
              <span class="unit">s</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"GRN_input_" + i}>Effective Green Time</label>
            <div class="cell-field">
              <input id={"GRN_input_" + i} type="number" min="1" class="input input-bordered input-sm" bind:value={seg.effective_green} placeholder="45" required />
              <span class="unit">s</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"SAT_input_" + i}>Adjusted Saturation Flow Rate</label>
            <div class="cell-field">
              <input id={"SAT_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.sat_flow} placeholder="1800" />
              <span class="unit">veh/h/ln</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"PR_input_" + i}>Platoon Ratio (optional)</label>
            <div class="cell-field">
              <input id={"PR_input_" + i} type="number" step="0.001" min="0" class="input input-bordered input-sm" bind:value={seg.platoon_ratio} placeholder="1.000" />
            </div>
          </div>

          <div class="param-field">
            <label for={"APS_input_" + i}>Access Points (subject side)</label>
            <div class="cell-field">
              <input id={"APS_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.access_points_subject} placeholder="2" required />
              <span class="unit">pts</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"APO_input_" + i}>Access Points (opposing side)</label>
            <div class="cell-field">
              <input id={"APO_input_" + i} type="number" min="0" class="input input-bordered input-sm" bind:value={seg.access_points_opposing} placeholder="2" required />
              <span class="unit">pts</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"STP_input_" + i}>Full Stop Rate (optional)</label>
            <div class="cell-field">
              <input id={"STP_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={seg.stop_rate_override} placeholder="0.5" />
              <span class="unit">stops/veh</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"SCF_input_" + i}>Segment Crash Frequency</label>
            <div class="cell-field">
              <input id={"SCF_input_" + i} type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={seg.segment_crashes} placeholder="15" required />
              <span class="unit">crashes/yr</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"ICF_input_" + i}>Downstream Intersection Crash Frequency</label>
            <div class="cell-field">
              <input id={"ICF_input_" + i} type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={seg.intersection_crashes} placeholder="33" required />
              <span class="unit">crashes/yr</span>
            </div>
          </div>

          <div class="param-field">
            <label for={"APL_input_" + i}>Downstream Approach Lanes</label>
            <div class="cell-field">
              <input id={"APL_input_" + i} type="number" min="1" class="input input-bordered input-sm" bind:value={seg.approach_lanes} placeholder="4" />
              <span class="unit">ln</span>
            </div>
            <p class="param-hint">All lanes on the boundary signal's approach, used by the incident generator.</p>
          </div>

          <div class="param-field">
            <label for={"KF_input_" + i}>k Factor</label>
            <div class="cell-field">
              <input id={"KF_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={seg.k_factor} placeholder="0.5" />
            </div>
            <p class="param-hint">Share of the daily crash count exposed during the study period.</p>
          </div>

          <div class="param-field">
            <label for={"IF_input_" + i}>I Factor</label>
            <div class="cell-field">
              <input id={"IF_input_" + i} type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={seg.i_factor} placeholder="1.0" />
            </div>
            <p class="param-hint">Local adjustment on the crash-to-incident conversion.</p>
          </div>
        </div>
      </section>
    {/each}

    <!-- Form Actions -->
    <div class="action-bar">
      <button class="btn btn-ghost" onclick={addSegment} type="button">Add Segment</button>
      <button class="btn btn-ghost" onclick={resetParams} type="button">Reset Params</button>
      <button class="btn btn-primary" type="submit" disabled={!ready || running}>{running ? 'Running...' : 'Calculate'}</button>
    </div>
    <p class="param-hint">The run evaluates roughly three thousand scenarios and can take a few seconds.</p>
  </form>

  <section class="panel results-panel">
    <div class="panel-head with-actions">
      <div>
        <h2 class="panel-title">Outputs</h2>
        <p class="panel-sub">Results populate after the reliability run completes.</p>
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
            <th>Weather Events Generated:</th>
            <td>{results ? results.num_weather_events : ''}</td>
          </tr>
          <tr>
            <th>Incidents Generated:</th>
            <td>{results ? results.num_incidents : ''}</td>
          </tr>
          <tr>
            <th title="Scenarios in which a boundary through movement ran over capacity (v/c > 1) or started with a residual queue carried in from the previous analysis period.">Oversaturated Scenarios:</th>
            <td>{results ? results.num_oversaturated_scenarios : ''}</td>
          </tr>
          <tr>
            <th>Base Free-Flow Travel Time (s):</th>
            <td>{results ? fmt(results.base_free_flow_travel_time, 1) : ''}</td>
          </tr>
          <tr>
            <th>Mean Travel Time (s):</th>
            <td>{results ? fmt(results.mean_travel_time, 1) : ''}</td>
          </tr>
          <tr>
            <th>Mean Travel Time Index:</th>
            <td>{results ? fmt(results.tti_mean, 3) : ''}</td>
          </tr>
          <tr>
            <th>50th Percentile TTI:</th>
            <td>{results ? fmt(results.tti_50, 3) : ''}</td>
          </tr>
          <tr>
            <th>80th Percentile TTI:</th>
            <td>{results ? fmt(results.tti_80, 3) : ''}</td>
          </tr>
          <tr>
            <th>95th Percentile TTI (PTI):</th>
            <td>{results ? fmt(results.tti_95, 3) : ''}</td>
          </tr>
          <tr>
            <th>Total Vehicle Hours of Delay (veh-h):</th>
            <td>{results ? fmt(results.total_vhd, 0) : ''}</td>
          </tr>
          <tr>
            <th>Scenarios with Nondry Weather (%):</th>
            <td>{results ? fmt(results.pct_nondry_scenarios, 1) : ''}</td>
          </tr>
        </tbody>
      </table>
      {#if results}
        <figure class="tti-strip">
          <figcaption>Travel time index distribution</figcaption>
          {#each ttiBars as bar}
            <div class="tti-row">
              <span class="tti-label">{bar.label}</span>
              <span class="tti-track"><span class="tti-fill" style="width: {barPct(bar.value)}%"></span></span>
              <span class="tti-value">{fmt(bar.value, 3)}</span>
            </div>
          {/each}
          <p class="param-hint">Bars run from a travel time index of 1.0, the base free-flow travel time, to the planning time index.</p>
        </figure>
      {/if}
      <div class="facility-summary">
        <p>Urban Street Reliability Rating: {results ? fmt(results.reliability_rating, 1) + ' %' : ''}</p>
      </div>
    </div>
  </section>
</div>

<style>
  /* .param-hint is sized for the 16rem column of a single field; a note that
     runs the width of a table needs the room. */
  .panel-note { max-width: 46rem; }

  /* Selection sync with the facility strip: the picked segment's card takes
     the same accent as the diagram deck. */
  .seg-panel { cursor: pointer; }
  .seg-panel.seg-selected { outline: 2px solid var(--accent); outline-offset: 2px; }

  .tti-strip { margin: 1rem 0 0; }
  .tti-strip figcaption { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; margin-bottom: 0.4rem; }
  .tti-row { display: grid; grid-template-columns: 5.5rem 1fr 3.5rem; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
  .tti-label { font-size: 0.75rem; opacity: 0.75; }
  .tti-track { height: 0.6rem; border-radius: 3px; background: color-mix(in srgb, currentColor 10%, transparent); overflow: hidden; }
  .tti-fill { display: block; height: 100%; border-radius: 3px; background: color-mix(in srgb, currentColor 55%, transparent); }
  .tti-value { font-size: 0.75rem; font-variant-numeric: tabular-nums; text-align: right; }
</style>
