// Worked examples as builder documents, which is a stronger claim than a
// fixture loader. Example Problem 1's fixture is a table of eleven segments;
// this is the six ramps an analyst would have placed, and the derivation has to
// put the eleven segments back. The stations are read off the fixture rather
// than off the exhibit drawing: each is the running sum of the segment lengths
// up to the gore, and the two weave stations are the segment boundaries pulled
// 500 ft inward, per Exhibit 10-2.
//
// tests/builder/derivation.test.mjs pins the whole reconstruction against the
// library's own tests/ExampleCases/hcm/FreewayFacilities/case1.json.

import { emptyDocument, setPeriods } from './document.js';

export const EXAMPLES = [
	{
		id: 'ep1',
		name: 'Chapter 25 Example Problem 1',
		summary:
			'6-mi urban freeway, three ramp pairs, five 15-min periods. The undersaturated facility of Exhibits 25-43 through 25-52.',
		build: ep1
	}
];

export function loadExample(id) {
	const e = EXAMPLES.find((x) => x.id === id);
	if (!e) throw new Error(`unknown example "${id}"`);
	return e.build();
}

function ep1() {
	const doc = emptyDocument();
	doc.meta = { name: 'Example Problem 1 (Exhibit 25-43)', source: 'example:ep1', modified: null };
	Object.assign(doc.mainline, {
		lengthFt: 31680, // 6.00 mi, the sum of the fixture's eleven segment lengths
		lanes: 3,
		ffs: 60,
		terrain: 'Level',
		cityType: 'Urban',
		phf: 1.0, // the fixture's demands are already 15-min flow rates
		heavyVehiclePct: 0.0225,
		jamDensityPc: 190,
		queueDischargeDrop: 0.07,
		totalRampDensity: 1.0,
		interchangeDensity: 0.8,
		demand: [4505, 4955, 5225, 4685, 3785]
	});
	doc.features = [
		{
			id: 'on1',
			kind: 'on_ramp',
			stationFt: 5280,
			label: 'Ramp 1 on',
			rampFfs: 40,
			accelLaneFt: 500,
			auxLaneToNext: false,
			numWeavingLanes: 2,
			lcRf: 1,
			lcFr: 1,
			demand: [450, 540, 630, 360, 180],
			rampToRampDemand: [0, 0, 0, 0, 0]
		},
		{
			id: 'off1',
			kind: 'off_ramp',
			stationFt: 10560,
			label: 'Ramp 1 off',
			rampFfs: 40,
			decelLaneFt: 500,
			demand: [270, 360, 270, 270, 270]
		},
		{
			// The weave's gores: the fixture's weaving segment spans 15,840 to
			// 18,480 ft, and Exhibit 10-2 puts its boundaries 500 ft outside each
			// gore, so the gores are at 16,340 and 17,980 and the gore-to-gore
			// distance is the fixture's 1,640 ft short length.
			id: 'on2',
			kind: 'on_ramp',
			stationFt: 16340,
			label: 'Weave on',
			rampFfs: 40,
			accelLaneFt: 500,
			auxLaneToNext: true,
			numWeavingLanes: 2,
			lcRf: 1,
			lcFr: 1,
			demand: [540, 720, 810, 360, 270],
			rampToRampDemand: [50, 100, 150, 80, 50]
		},
		{
			id: 'off2',
			kind: 'off_ramp',
			stationFt: 17980,
			label: 'Weave off',
			rampFfs: 40,
			decelLaneFt: 500,
			demand: [360, 360, 360, 360, 180]
		},
		{
			// Gore-to-gore 2,640 ft, between 1,500 and 3,000, which is the
			// overlapping-ramp branch: merge 1,140 + overlap 360 + diverge 1,140.
			id: 'on3',
			kind: 'on_ramp',
			stationFt: 23760,
			label: 'Ramp 3 on',
			rampFfs: 40,
			accelLaneFt: 500,
			auxLaneToNext: false,
			numWeavingLanes: 2,
			lcRf: 1,
			lcFr: 1,
			demand: [450, 540, 630, 450, 270],
			rampToRampDemand: [0, 0, 0, 0, 0]
		},
		{
			id: 'off3',
			kind: 'off_ramp',
			stationFt: 26400,
			label: 'Ramp 3 off',
			rampFfs: 40,
			decelLaneFt: 500,
			demand: [270, 270, 450, 270, 180]
		}
	];
	return setPeriods(doc, 5);
}
