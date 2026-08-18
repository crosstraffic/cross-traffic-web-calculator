// The Chapter 17 handoff: the urban street the builder just analyzed, handed to
// the reliability engine.
//
// "The same facility" is a weaker claim here than it is on the freeway side, and
// the difference is worth stating rather than glossing. `WasmFreewayReliability`
// takes the very `WasmFacilitySegment` handles the Chapter 10 run was built
// from, so anything a segment carries crosses by construction.
// `WasmUrbanReliability::add_segment` takes sixteen positional scalars instead,
// which is a strict subset of what a Chapter 18 segment holds. So the handoff is
// a re-statement of the facility, not a re-use of it, and the fields that have
// no argument are dropped. `handoffNotes` names every one of them against the
// facility rather than in the abstract, because a builder facility must never
// lose a feature silently.

import { defaultSignalConfig } from './document.js';

/** Chapter 17 inputs the builder offers, at the same defaults the hcm17 page
 * opens on, so the two pages agree on what an unconfigured reliability run is.
 * These are the Chapter 29 Example Problem 4 values (Exhibits 29-62 through
 * 29-77): Lincoln, Nebraska, weekdays for one year, 7-10 a.m., seeds 82/11/63. */
export function defaultUrbanReliabilityInputs() {
	return {
		functionalClass: 'UrbanPrincipalArterial',
		studyPeriodStartHour: 7,
		analysisPeriodsPerDay: 12,
		jan1DayOfWeek: 6,
		entryIntersectionCrashes: 32,
		minorLegVolume: 1300,
		shoulderPresent: true,
		vmtWeighted: true,
		weatherSeed: 82,
		demandSeed: 11,
		incidentSeed: 63,
		strategies: []
	};
}

/**
 * The Lincoln NCDC monthly weather, January through December, transcribed from
 * the library's own `tests/ExampleCases/hcm/UrbanReliability/case1.json` rather
 * than from the exhibit, because that fixture is what the boundary suite pins
 * and a second transcription is how the two start to disagree.
 *
 * January and April are the two months Exhibit 29-65 publishes; the other ten
 * are the fixture's representative values, since the full 284-city NCDC table
 * lives in HCM Volume 4 and is not transcribed there either.
 *
 * There is no snowfall column, and its absence is the point. The fixture carries
 * one and the library never reads it: the Chapter 29 procedure decides rain
 * against snow from the sampled temperature and sizes the snow from the
 * precipitation columns.
 */
export function defaultUrbanWeather() {
	return [
		{ total_precip_in: 0.67, days_with_precip: 5, mean_temp_f: 22.4, precip_rate_in_h: 0.03 },
		{ total_precip_in: 0.8, days_with_precip: 6, mean_temp_f: 27.0, precip_rate_in_h: 0.035 },
		{ total_precip_in: 1.8, days_with_precip: 7, mean_temp_f: 39.0, precip_rate_in_h: 0.045 },
		{ total_precip_in: 2.9, days_with_precip: 9, mean_temp_f: 51.2, precip_rate_in_h: 0.062 },
		{ total_precip_in: 4.2, days_with_precip: 11, mean_temp_f: 62.0, precip_rate_in_h: 0.07 },
		{ total_precip_in: 3.5, days_with_precip: 9, mean_temp_f: 72.0, precip_rate_in_h: 0.08 },
		{ total_precip_in: 3.0, days_with_precip: 8, mean_temp_f: 78.0, precip_rate_in_h: 0.085 },
		{ total_precip_in: 3.2, days_with_precip: 8, mean_temp_f: 75.0, precip_rate_in_h: 0.08 },
		{ total_precip_in: 2.9, days_with_precip: 7, mean_temp_f: 66.0, precip_rate_in_h: 0.07 },
		{ total_precip_in: 1.9, days_with_precip: 6, mean_temp_f: 54.0, precip_rate_in_h: 0.055 },
		{ total_precip_in: 1.2, days_with_precip: 5, mean_temp_f: 38.0, precip_rate_in_h: 0.04 },
		{ total_precip_in: 0.8, days_with_precip: 5, mean_temp_f: 26.0, precip_rate_in_h: 0.032 }
	];
}

/**
 * Run the Chapter 17 methodology on the built urban street.
 *
 * @param {object} doc builder document
 * @param {object[]} rows derived rows, overrides already applied
 * @param {object} inputs see `defaultUrbanReliabilityInputs`
 * @param {object[]} weather twelve monthly rows, see `defaultUrbanWeather`
 * @param {object} wasm module namespace
 * @param {(fn: Function) => any} [retry] the WebKit one-shot retry the hcm11 page uses
 */
export function analyzeUrbanReliability(doc, rows, inputs, weather, wasm, retry = (f) => f()) {
	const column = (key) => Float64Array.from(weather.map((w) => Number(w[key])));

	const rel = retry(() => {
		const r = new wasm.WasmUrbanReliability(
			inputs.functionalClass,
			Number(inputs.studyPeriodStartHour),
			Number(inputs.analysisPeriodsPerDay),
			column('total_precip_in'),
			column('days_with_precip'),
			column('mean_temp_f'),
			column('precip_rate_in_h'),
			Number(inputs.entryIntersectionCrashes),
			Number(inputs.minorLegVolume),
			!!inputs.shoulderPresent,
			!!inputs.vmtWeighted,
			Number(inputs.weatherSeed),
			Number(inputs.demandSeed),
			Number(inputs.incidentSeed),
			// Monthly snowfall. Passed as undefined deliberately: the library never
			// reads it. The Chapter 29 procedure decides rain against snow from the
			// sampled temperature (Equations 29-3 and 29-4) and sizes the snow from
			// the precipitation columns, so a snowfall array here would be
			// climatological metadata that changes nothing. The middleware 0.3.4
			// CHANGELOG carries the correction.
			undefined,
			Number(inputs.jan1DayOfWeek),
			Number(doc.mainline.propLeftTurnLanes)
		);

		// Strategies must be registered before run(), and the boundary file pins
		// that ordering.
		for (const s of inputs.strategies ?? []) {
			const strategy = { name: s.name };
			if (Number.isFinite(Number(s.effectiveGreenAdjustmentS)) && s.effectiveGreenAdjustmentS !== '') {
				strategy.effective_green_adjustment_s = Number(s.effectiveGreenAdjustmentS);
			}
			if (Number.isFinite(Number(s.satFlowAdjustment)) && s.satFlowAdjustment !== '') {
				strategy.sat_flow_adjustment = Number(s.satFlowAdjustment);
			}
			r.add_atdm_strategy(strategy);
		}

		const fallback = defaultSignalConfig(doc);
		for (const row of rows) {
			const sig = signalOf(doc, row);
			const cfg = sig?.config ?? fallback;
			r.add_segment(
				row.segment_length_ft,
				row.n_through_lanes,
				row.speed_limit_mph,
				row.through_demand_veh_h,
				row.cycle_length_s,
				row.effective_green_s,
				row.sat_flow_veh_h_ln,
				row.platoon_ratio,
				row.n_access_points_subject,
				row.n_access_points_opposing,
				row.full_stop_rate_override,
				Number(cfg.segment_crashes),
				Number(cfg.intersection_crashes),
				Number(cfg.k_factor),
				Number(cfg.i_factor),
				Number(cfg.approach_lanes)
			);
		}
		r.run();
		return r;
	});

	const res = rel.results_to_js_value();
	return Object.freeze({
		numSegments: rel.num_segments(),
		numScenarios: rel.num_scenarios(),
		baseFreeFlowTravelTime: rel.get_base_free_flow_travel_time(),
		meanTravelTime: rel.get_mean_travel_time(),
		ttiMean: rel.tti_mean(),
		tti50: rel.tti_percentile(50),
		tti80: rel.tti_percentile(80),
		tti95: rel.tti_percentile(95),
		reliabilityRating: rel.reliability_rating(),
		totalVhd: rel.get_total_vhd(),
		numWeatherEvents: rel.num_weather_events(),
		numIncidents: rel.num_incidents(),
		numOversaturatedScenarios: rel.num_oversaturated_scenarios(),
		vmtWeighted: !!inputs.vmtWeighted,
		strategyCount: (inputs.strategies ?? []).length,
		results: res
	});
}

/** The signal whose config a derived row read its timing from, which is the one
 * at the row's downstream end. The row key carries both bounding signal ids, so
 * this reads the identity the derivation already recorded rather than
 * re-deciding it by station. */
function signalOf(doc, row) {
	const id = String(row.key ?? '').split(':')[2];
	return doc.features.find((f) => f.id === id && f.kind === 'signal') ?? null;
}

/**
 * What this urban street carries that the reliability run does or does not
 * express, in the caller's own terms.
 *
 * Every entry is checked against the facility rather than printed
 * unconditionally, so the panel stays quiet on a plain street and speaks up on
 * the cases that matter. It is shown before the run as well as after it, because
 * "this cannot be expressed" is worth knowing before pressing the button rather
 * than after reading the answer.
 */
export function urbanHandoffNotes(doc, rows) {
	const notes = [];

	if (doc.analysisMode === 'measures') {
		notes.push({
			id: 'measures-mode',
			level: 'warn',
			text: 'This facility is described by its published Chapter 18 measures rather than by Chapter 18 inputs. The reliability engine builds its own Chapter 18 segments from inputs and has no way to take a supplied travel speed, so the run below is of the segment geometry beside those measures and not of the measures themselves. On a facility loaded from Chapter 29 Example Problem 1 that geometry is mostly defaults, so treat the distribution as illustrative.'
		});
	}

	// The Chapter 18 fields that reach the Chapter 16 run and have no argument on
	// WasmUrbanReliability::add_segment. Checked against the rows so a facility
	// that does not use them says nothing.
	const dropped = [
		['through_capacity_veh_h', 'the through capacity, so the reliability engine computes its own from the saturation flow and the green time'],
		['through_control_delay_s', 'the through control delay, which the reliability engine recomputes per scenario'],
		['upstream_intersection_width_ft', 'the upstream intersection width'],
		['proportion_with_curb', 'the proportion of the segment with curb'],
		['proportion_on_street_parking', 'the on-street parking proportion'],
		['restrictive_median_length_ft', 'the restrictive median length'],
		['arrival_type', 'the arrival type'],
		['access_point_delays_s', 'the published per-point access-point delays'],
		['access_point_approaches', 'the access point approach volumes that drive the computed Chapter 30 Section 4 delay']
	];
	for (const [key, phrase] of dropped) {
		const n = rows.filter((r) => r[key] != null).length;
		if (!n) continue;
		notes.push({
			id: `unbound-${key}`,
			level: 'warn',
			text: `${n === rows.length ? 'Every segment' : `${n} of ${rows.length} segments`} carries ${phrase}. WasmUrbanReliability::add_segment has no argument for it, so it reaches the Chapter 16 run above and not this one.`
		});
	}

	notes.push({
		id: 'snowfall',
		level: 'note',
		text: 'There is no snowfall input. The Chapter 29 procedure decides whether an event falls as rain or as snow from the sampled temperature (Equations 29-3 and 29-4) and sizes the snow depth from the precipitation columns, so a snow climate is entered through the mean temperature and precipitation values. The engine does carry a snowfall column, and never reads it.'
	});

	notes.push({
		id: 'per-scenario',
		level: 'note',
		text: 'Per-scenario results are summary-only. The distribution measures and the oversaturated-scenario count are the readouts; the individual scenario travel times behind them are not exported across the binding.'
	});

	notes.push({
		id: 'atdm',
		level: 'note',
		text: 'ATDM strategies enter as input-level adjustments rather than by name. The green adjustment is added to the coordinated through phase at every boundary signal, which is what Example Problem 5 Strategy 1 does with 5 s of split, and the saturation flow adjustment multiplies the boundary saturation flow rate. Adaptive signal control is expressed as a saturation flow adjustment of 1.156, the value Chapter 37 implies for its default 13.5% delay reduction target, because the AtdmStrategy constructor helper that computes it is not reachable across the binding.'
	});

	notes.push({
		id: 'published-gap',
		level: 'note',
		text: 'The Monte Carlo stream is software-specific, which the HCM anticipates ("Each result, though different, will be equally valid"). Against the published Exhibit 29-73 values for Example Problem 4 (mean TTI 1.69/1.64, PTI 2.98/2.61, rating 93.2/94.1) this engine computes a tighter distribution, and the library records the remaining causes as still-deferred random 15-min demand variation (Equations 29-30 through 29-33) and uncalibrated Exhibit 17-10 and 17-11 incident durations. A run here reproduces exactly on the same seeds and differs on any other seeds.'
	});

	return notes;
}
