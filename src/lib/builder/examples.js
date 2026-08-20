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
    name: 'Example Problem 1',
    summary:
      '6-mi urban freeway, three ramp pairs, five 15-min periods. The undersaturated facility of Exhibits 25-43 through 25-52.',
    build: ep1,
  },
  {
    id: 'ep2',
    name: 'Example Problem 2',
    summary:
      'Example Problem 1 geometry at demands roughly 11% higher, which pushes it oversaturated (Exhibits 25-53 through 25-60).',
    build: ep2,
  },
  {
    id: 'ep3',
    name: 'Example Problem 3',
    summary:
      'Example Problem 2 with a lane added downstream of the weave, the capacity improvement of Exhibits 25-61 through 25-68.',
    build: ep3,
  },
  {
    id: 'ep4',
    name: 'Example Problem 4',
    summary: 'Example Problem 1 with a three-to-two lane closure on the last segment (Exhibits 25-69 through 25-77).',
    build: ep4,
  },
];

export function loadExample(id) {
  const e = EXAMPLES.find((x) => x.id === id);
  if (!e) throw new Error(`unknown example "${id}"`);
  return e.build();
}

/** Example Problems 2, 3 and 4 are all Example Problem 1's ramps at different
 * demands, so each is built by taking EP1 and saying only what changed. That is
 * how the manual presents them, and it keeps the one place the stations are
 * written down to one place. */
function ep2() {
  const doc = ep1();
  doc.meta = { name: 'Example Problem 2 (Exhibit 25-53)', source: 'example:ep2', modified: null };
  doc.mainline.demand = [5001, 5500, 5800, 5200, 4201];
  const set = (id, demand, r2r) => {
    const f = doc.features.find((x) => x.id === id);
    f.demand = demand;
    if (r2r) f.rampToRampDemand = r2r;
  };
  set('on1', [500, 599, 699, 400, 200]);
  set('off1', [300, 400, 300, 300, 300]);
  set('on2', [599, 799, 899, 400, 300], [56, 111, 167, 89, 56]);
  set('off2', [400, 400, 400, 400, 200]);
  set('on3', [500, 599, 699, 500, 300]);
  set('off3', [300, 300, 500, 300, 200]);
  return doc;
}

function ep3() {
  const doc = ep2();
  doc.meta = { name: 'Example Problem 3 (Exhibit 25-61)', source: 'example:ep3', modified: null };
  // The capacity improvement: the auxiliary lane through the weave is carried
  // on as a full lane instead of being dropped, so the mainline steps from
  // three lanes to four at the weaving segment's downstream boundary, which is
  // 500 ft past the off-ramp gore (Exhibit 10-2).
  doc.features.push({
    id: 'lc1',
    kind: 'lane_change',
    stationFt: 18480,
    label: 'Lane added',
    lanes: 4,
  });
  // With the lane carried on, ramp traffic no longer has to change lanes to
  // reach the freeway, so the weave's required ramp-to-freeway lane changes
  // drop to zero (Exhibit 25-61; Chapter 13 lane-addition configuration).
  doc.features.find((f) => f.id === 'on2').lcRf = 0;
  return doc;
}

function ep4() {
  const doc = ep1();
  doc.meta = { name: 'Example Problem 4 (Exhibit 25-69)', source: 'example:ep4', modified: null };
  // A three-to-two closure over the whole last segment, 5.00 to 6.00 mi. The
  // values are the fixture's, and the two that are not obvious are the
  // published ones: a speed ratio of 60/55 and a queue discharge drop of 13.1%
  // rather than the 7% the rest of the facility uses.
  doc.features.push({
    id: 'wz1',
    kind: 'work_zone',
    stationFt: 26400,
    endFt: 31680,
    label: 'Lane closure',
    config: {
      total_lanes: 3,
      open_lanes: 2,
      soft_barrier: true,
      rural: false,
      lateral_distance_ft: 0,
      night: false,
      speed_ratio: 60 / 55,
      speed_limit_mi_h: 55,
      total_ramp_density: 1,
      queue_discharge_drop: 0.131,
    },
  });
  return doc;
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
    demand: [4505, 4955, 5225, 4685, 3785],
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
      rampToRampDemand: [0, 0, 0, 0, 0],
    },
    {
      id: 'off1',
      kind: 'off_ramp',
      stationFt: 10560,
      label: 'Ramp 1 off',
      rampFfs: 40,
      decelLaneFt: 500,
      demand: [270, 360, 270, 270, 270],
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
      rampToRampDemand: [50, 100, 150, 80, 50],
    },
    {
      id: 'off2',
      kind: 'off_ramp',
      stationFt: 17980,
      label: 'Weave off',
      rampFfs: 40,
      decelLaneFt: 500,
      demand: [360, 360, 360, 360, 180],
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
      rampToRampDemand: [0, 0, 0, 0, 0],
    },
    {
      id: 'off3',
      kind: 'off_ramp',
      stationFt: 26400,
      label: 'Ramp 3 off',
      rampFfs: 40,
      decelLaneFt: 500,
      demand: [270, 270, 450, 270, 180],
    },
  ];
  return setPeriods(doc, 5);
}
