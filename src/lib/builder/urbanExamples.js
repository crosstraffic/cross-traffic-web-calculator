// The published urban street example problems as builder documents, which is a
// stronger claim than a fixture loader. The Chapter 29 Example Problem 1 fixture
// is a table of five segments; this is the six boundary intersections an analyst
// would have placed, and the derivation has to put the five segments back at
// their published lengths.
//
// tests/builder/urban.mjs pins both reconstructions against the library's own
// tests/ExampleCases/hcm/UrbanFacilities/case1.json, case2.json and case3.json,
// and against the values tests/boundary/ch16_urban_facilities.mjs pins.
//
// The two chapters load in different modes, and that is a property of what the
// chapters publish rather than a choice:
//
// * Chapter 29 Example Problem 1 publishes per-segment Chapter 18 OUTPUTS (base
//   FFS, travel speed, spatial stop rate, LOS) and none of the Chapter 18 input
//   geometry behind them. There is nothing for the Chapter 18 engine to run, so
//   the facility loads in `measures` mode and only the Chapter 16 aggregation
//   runs. This is the Exhibit 16-7 "HCM method output" path.
// * Chapter 30 Example Problem 1 publishes the segment's inputs, so it loads in
//   `inputs` mode and the full analyze() pipeline runs.

import { emptyDocument, defaultSignalConfig } from './document.js';

export const URBAN_EXAMPLES = [
	{
		id: 'ch29ep1eb',
		name: 'Ch 29 EP1 eastbound',
		summary:
			'1-mi downtown facility, five segments between six signals, given by its published Chapter 18 measures (Exhibits 29-39 through 29-49). Reproduces facility base FFS 40.1 mi/h, LOS C and poorest-segment LOS D exactly.',
		build: () => ch29ep1('eb')
	},
	{
		id: 'ch29ep1wb',
		name: 'Ch 29 EP1 westbound',
		summary:
			'The westbound direction of the same downtown facility (Exhibit 29-49). Same base FFS and LOS pair, a slower travel speed.',
		build: () => ch29ep1('wb')
	},
	{
		id: 'ch30ep1',
		name: 'Ch 30 EP1',
		summary:
			'Three copies of the Chapter 30 Example Problem 1 eastbound segment, run through the full Chapter 18 pipeline (Exhibits 30-26 through 30-36). Reproduces base FFS 40.78 mi/h and travel speed 23.67 mi/h.',
		build: ch30ep1
	},
	{
		id: 'ch29ep4',
		name: 'Ch 29 EP4 (reliability)',
		summary:
			'The 3-mi Lincoln, Nebraska principal arterial of Example Problem 4 (Exhibits 29-62 through 29-77): six half-mile segments between seven signals, built for the Chapter 17 handoff. Reproduces the 3,120-scenario reliability reporting period at seeds 82/11/63.',
		build: ch29ep4
	}
];

export function loadUrbanExample(id) {
	const e = URBAN_EXAMPLES.find((x) => x.id === id);
	if (!e) throw new Error(`unknown urban example "${id}"`);
	return e.build();
}

/**
 * HCM Chapter 29, Section 5, Example Problem 1: Automobile-Oriented Urban
 * Street (Exhibits 29-39 through 29-49).
 *
 * Five segments over 1 mi: three of 1,320 ft at a 35 mi/h posted limit, then two
 * of 660 ft at 30 mi/h. Six boundary intersections, so five signals carry the
 * segments that end at them and a sixth sits on the upstream terminus.
 *
 * Only Segments 1 and 5 are individually published (Exhibits 29-47 and 29-48).
 * The fixture copies Segment 1's measures into the unpublished Segments 2 and 3
 * and Segment 5's into Segment 4, which is what makes the facility travel speed
 * land at 22.13 rather than the published 22.6 eastbound, and 21.54 rather than
 * 22.2 westbound. That gap is a property of the fixture, not of the aggregation,
 * and it is carried here verbatim rather than tuned away, because the boundary
 * suite pins both the computed value and the published band.
 */
function ch29ep1(dir) {
	const eb = dir === 'eb';
	const doc = emptyDocument('urban');
	doc.meta = {
		name: `Chapter 29 Example Problem 1 ${eb ? 'eastbound' : 'westbound'} (Exhibit 29-49)`,
		source: `example:ch29ep1${dir}`,
		modified: null
	};
	doc.analysisMode = 'measures';
	Object.assign(doc.mainline, {
		lengthFt: 5280,
		direction: eb ? 'Eastbound' : 'Westbound',
		lanes: 2,
		speedLimitMph: 35,
		// Exhibit 29-49 reports the facility with left-turn lanes throughout.
		propLeftTurnLanes: 1.0,
		demand: [800]
	});

	// Segment 1 (Exhibit 29-47) and Segment 5 (Exhibit 29-48) are the published
	// pair; the middle three copy them as the fixture does.
	const long = eb
		? { base_ffs_mph: 40.9, travel_speed_mph: 24.2, spatial_stop_rate_stops_mi: 1.72, vc_ratio: 0.85, los: 'C' }
		: { base_ffs_mph: 40.9, travel_speed_mph: 23.4, spatial_stop_rate_stops_mi: 1.93, vc_ratio: 0.85, los: 'C' };
	const short = eb
		? { base_ffs_mph: 37.9, travel_speed_mph: 17.6, spatial_stop_rate_stops_mi: 2.63, vc_ratio: 0.9, los: 'D' }
		: { base_ffs_mph: 37.9, travel_speed_mph: 17.4, spatial_stop_rate_stops_mi: 2.75, vc_ratio: 0.9, los: 'D' };

	// Station 0 is the upstream terminus. Its signal contributes the width the
	// first segment reads as its upstream intersection width and nothing else,
	// since no segment ends at it.
	const plan = [
		{ station: 0, limit: 35, measures: long },
		{ station: 1320, limit: 35, measures: long },
		{ station: 2640, limit: 35, measures: long },
		{ station: 3960, limit: 35, measures: long },
		{ station: 4620, limit: 30, measures: short },
		{ station: 5280, limit: 30, measures: short }
	];

	doc.features = plan.map((p, i) => ({
		id: `sig${i + 1}`,
		kind: 'signal',
		stationFt: p.station,
		label: `Signal ${i + 1}`,
		config: {
			...defaultSignalConfig(doc),
			speed_limit_mph: p.limit,
			through_demand_veh_h: 800
		},
		measures: { ...p.measures }
	}));
	return doc;
}

/**
 * HCM Chapter 30, Section 8, Example Problem 1 eastbound (Exhibits 30-26
 * through 30-36), as the three-segment facility of the library's
 * UrbanFacilities/case3.json.
 *
 * Equations 16-2 and 16-3 are length-weighted harmonic means and Equation 16-4
 * a length-weighted arithmetic mean, so a facility of identical segments
 * reproduces the published segment values at facility level. That is what makes
 * this the geometry-route gate: base FFS 40.78 mi/h and travel speed 23.67 mi/h
 * are the published Exhibit 30-36 segment values read at the facility.
 *
 * The two access points carrying the published Exhibit 30-35 per-point delays
 * are what reach the published travel speed. Without them the free-flow speed
 * chain falls to the Exhibit 18-13 planning estimate and misses it, which is the
 * documented 22.55 mi/h legacy path in the ch18 boundary file.
 */
function ch30ep1() {
	const doc = emptyDocument('urban');
	doc.meta = {
		name: 'Chapter 30 Example Problem 1 (Exhibit 30-36)',
		source: 'example:ch30ep1',
		modified: null
	};
	doc.analysisMode = 'inputs';
	Object.assign(doc.mainline, {
		lengthFt: 5400,
		direction: 'Eastbound',
		lanes: 2,
		speedLimitMph: 35,
		propLeftTurnLanes: 0.33,
		proportionWithCurb: 0.7,
		proportionOnStreetParking: 0,
		restrictiveMedianLengthFt: 0,
		analysisPeriodH: 0.25,
		demand: [968]
	});

	const signalConfig = () => ({
		...defaultSignalConfig(doc),
		control: 'Signalized',
		speed_limit_mph: 35,
		through_demand_veh_h: 968,
		midsegment_flow_veh_h: 1150,
		through_capacity_veh_h: 1848,
		through_control_delay_s: 18.31,
		cycle_length_s: 100,
		effective_green_s: 48.63,
		full_stop_rate_override: 0.547,
		width_ft: 50
	});

	doc.features = [];
	for (let i = 0; i <= 3; i++) {
		doc.features.push({
			id: `sig${i + 1}`,
			kind: 'signal',
			stationFt: i * 1800,
			label: `Signal ${i + 1}`,
			config: signalConfig(),
			measures: null
		});
	}

	// Four subject-side and four opposing-side access points per segment, which
	// is the N_ap,s = 4 and N_ap,o = 4 the fixture reports for the f_A adjustment
	// (Exhibit 18-11 note c). Two of the four subject points on each segment
	// carry the published Exhibit 30-35 per-point delays; the other two are
	// counted but contribute no delay, which is what the published Sum d_ap,i of
	// 0.193 + 0.194 = 0.387 s/veh says happened.
	const DELAYS = [0.193, 0.194];
	for (let s = 0; s < 3; s++) {
		const a = s * 1800;
		for (let k = 0; k < 4; k++) {
			const station = a + (1800 * (k + 1)) / 5;
			doc.features.push({
				id: `ap${s + 1}s${k + 1}`,
				kind: 'access_point',
				stationFt: Math.round(station),
				label: `Access ${s + 1}.${k + 1}`,
				side: 'subject',
				delayS: k < DELAYS.length ? DELAYS[k] : null,
				approach: null
			});
			doc.features.push({
				id: `ap${s + 1}o${k + 1}`,
				kind: 'access_point',
				stationFt: Math.round(station),
				label: `Opposing ${s + 1}.${k + 1}`,
				side: 'opposing',
				delayS: null,
				approach: null
			});
		}
	}
	return doc;
}

/**
 * HCM Chapter 29, Section 5, Example Problem 4: Existing Urban Street
 * Reliability (Exhibits 29-62 through 29-77).
 *
 * An idealized 3-mi principal arterial in Lincoln, Nebraska: six half-mile
 * segments between seven signalized intersections, two through lanes per
 * direction, 35 mi/h, coordinated at a 100 s cycle with good progression
 * (platoon ratio 1.333). This is the Chapter 17 fixture rather than a Chapter 16
 * one, so it exists to drive the reliability handoff; its Chapter 16 run is
 * meaningful but is not what the chapter publishes.
 *
 * The crash frequencies of Exhibit 29-68 rise along the facility, 15 through 20
 * per year on the segments and 32 through 38 on the intersections, and they are
 * carried on the signals because that is where the reliability engine attributes
 * them. The entry intersection's 32 is a reliability input of its own rather
 * than a segment's, so it rides on the signal at station 0.
 */
function ch29ep4() {
	const doc = emptyDocument('urban');
	doc.meta = {
		name: 'Chapter 29 Example Problem 4 (Exhibit 29-73)',
		source: 'example:ch29ep4',
		modified: null
	};
	doc.analysisMode = 'inputs';
	Object.assign(doc.mainline, {
		lengthFt: 6 * 2640,
		direction: 'Eastbound',
		lanes: 2,
		speedLimitMph: 35,
		propLeftTurnLanes: 1.0,
		// The reliability fixture's segments are fully curbed.
		proportionWithCurb: 1.0,
		demand: [1000]
	});

	doc.features = [];
	for (let i = 0; i <= 6; i++) {
		doc.features.push({
			id: `sig${i + 1}`,
			kind: 'signal',
			stationFt: i * 2640,
			label: `Signal ${i + 1}`,
			config: {
				...defaultSignalConfig(doc),
				control: 'Signalized',
				speed_limit_mph: 35,
				through_demand_veh_h: 1000,
				cycle_length_s: 100,
				effective_green_s: 45,
				sat_flow_veh_h_ln: 1800,
				platoon_ratio: 1.333,
				full_stop_rate_override: 0.5,
				// Chapter 18 inputs the reliability fixture does not state. Left at
				// the defaults, and the Chapter 16 run above the handoff is therefore
				// of a plausible street rather than of a published one.
				midsegment_flow_veh_h: 1000,
				through_capacity_veh_h: 1620,
				through_control_delay_s: 20,
				k_factor: 0.5,
				i_factor: 1.0,
				approach_lanes: 4,
				// Exhibit 29-68. The segment frequency belongs to the segment ending
				// at this signal, so signal 1 at the upstream terminus has none.
				segment_crashes: i === 0 ? 0 : 14 + i,
				intersection_crashes: 32 + i
			},
			measures: null
		});
	}

	// Two access points per segment, per the fixture. They carry no delay and no
	// approach, so every segment takes the Exhibit 18-13 planning estimate, which
	// is what the reliability engine's own access-point term does anyway.
	for (let s = 0; s < 6; s++) {
		for (let k = 0; k < 2; k++) {
			const station = Math.round(s * 2640 + (2640 * (k + 1)) / 3);
			doc.features.push({
				id: `ap${s + 1}s${k + 1}`, kind: 'access_point', stationFt: station,
				label: '', side: 'subject', delayS: null, approach: null
			});
			doc.features.push({
				id: `ap${s + 1}o${k + 1}`, kind: 'access_point', stationFt: station,
				label: '', side: 'opposing', delayS: null, approach: null
			});
		}
	}
	return doc;
}
