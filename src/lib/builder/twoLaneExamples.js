// The published two-lane highway example problems as builder documents, which is
// a stronger claim than a fixture loader. The library's TwoLaneHighways fixtures
// are tables of segments; these are the terrain, passing and curve features an
// analyst would have placed, and the derivation has to put the same segments
// back at their published lengths, types, grades and classes.
//
// tests/builder/twolane.mjs pins all four reconstructions against the library's
// own tests/ExampleCases/hcm/TwoLaneHighways/case1.json through case4.json and
// against the Step 11 values tests/boundary/ch15_twolanehighways.mjs pins.
//
// STATIONS ARE FEET, and so are the curve extents. A segment length reaches the
// engine in miles and a subsegment length in feet, and that conversion happens
// once, in the derivation. Nothing in this file divides by 5,280 except to
// state a station a published example gives in miles.

import { emptyDocument } from './document.js';

const MI = 5280;

export const TWOLANE_EXAMPLES = [
  {
    id: 'ch26ep1',
    name: 'Ch 26 EP1',
    summary:
      'A single 0.75-mi Passing Constrained segment at a 50 mi/h posted limit, level, 752 veh/h. The base case: no features at all, so the whole highway is one segment. Reproduces facility follower density 10.092 followers/mi and LOS D.',
    build: () => ch26ep1(false),
  },
  {
    id: 'ch26ep2',
    name: 'Ch 26 EP2',
    summary:
      'Example Problem 1 with five horizontal curves through it, 275 to 1,100 ft radius. The curves become eleven subsegments of the one segment rather than eleven segments, and drop the average speed from 53.7 to 49.5 mi/h. Reproduces 10.933 followers/mi and LOS D.',
    build: () => ch26ep1(true),
  },
  {
    id: 'ch26ep3',
    name: 'Ch 26 EP3',
    summary:
      'A 5.5-mi facility of five segments: a passing lane and a passing zone placed along it, with the demand stepping down at each boundary. Reproduces the Exhibit 26-27 facility follower density of 7.3 followers/mi and LOS C, at 7.271 exactly.',
    build: ch26ep3,
  },
  {
    id: 'ch26ep4',
    name: 'Ch 26 EP4',
    summary:
      'A 5.1-mi mountainous facility: four graded segments carrying three horizontal curves, then a passing lane on the downgrade and the segment below it. Reproduces the Exhibit 26-36 LOS E at 19.897 followers/mi, and exercises the Step 9 downstream adjustment.',
    build: ch26ep4,
  },
];

export function loadTwoLaneExample(id) {
  const e = TWOLANE_EXAMPLES.find((x) => x.id === id);
  if (!e) throw new Error(`unknown two-lane example "${id}"`);
  return e.build();
}

/**
 * HCM Chapter 26, Section 8, Example Problems 1 and 2.
 *
 * One 0.75-mi Passing Constrained segment, level, vertical class 1, at a 50 mi/h
 * posted limit carrying 752 veh/h at a 0.94 peak hour factor with 5% heavy
 * vehicles. The two problems are the same highway, and Example Problem 2 adds
 * the horizontal curves, which is the whole difference: the average speed falls
 * from 53.7 to 49.5 mi/h and the follower density rises from 10.1 to 10.9.
 *
 * Example Problem 1 places NO features. That is not an omission. A stretch of
 * two-lane highway with no passing feature on it is Passing Constrained, level
 * and vertical class 1, which is exactly what this example is, so the honest
 * reconstruction is a highway and nothing else.
 *
 * The curves are placed at the stations the published subsegment lengths imply,
 * measured from the upstream end: 280 ft of tangent, then a 432-ft curve, and so
 * on. The derivation puts the tangents back between them, which is what makes
 * the eleven subsegments eleven rather than five.
 */
function ch26ep1(withCurves) {
  const doc = emptyDocument('twolane');
  doc.meta = {
    name: withCurves ? 'Chapter 26 Example Problem 2 (horizontal curves)' : 'Chapter 26 Example Problem 1',
    source: withCurves ? 'example:ch26ep2' : 'example:ch26ep1',
    modified: null,
  };
  Object.assign(doc.mainline, {
    lengthFt: 0.75 * MI,
    direction: 'Northbound',
    laneWidthFt: 12,
    shoulderWidthFt: 6,
    accessPointDensity: 0,
    pctHeavyVehInPassingLane: 0.4,
    effectiveDownstreamLengthMi: 0,
    speedLimitMph: 50,
    demand: [752],
    opposingDemand: 0,
    phf: 0.94,
    heavyVehiclePct: 5,
    verticalClass: 1,
  });

  // Station, length, radius, superelevation, central angle: the five curves of
  // Example Problem 2, at the stations the published tangent lengths put them
  // at. The central angles are carried because the fixture states them; the
  // method does not read them.
  const CURVES = [
    [280, 432, 450, 3, 55],
    [972, 366.5, 300, 2, 70],
    [1588.5, 216, 275, 5, 45],
    [2080.1, 458, 750, 0, 35],
    [2823.1, 767.9, 1100, 4, 40],
  ];
  doc.features = withCurves
    ? CURVES.map(([station, length, radius, superelevation, angle], i) => ({
        id: `hc${i + 1}`,
        kind: 'curve',
        stationFt: station,
        endFt: station + length,
        label: `Curve ${i + 1}`,
        designRadiusFt: radius,
        superelevationPct: superelevation,
        centralAngleDeg: angle,
        // Left unset on purpose. Step 5d computes the Exhibit 15-22 class from
        // the radius and the superelevation and overwrites what it is handed,
        // and the five classes the fixture stores are exactly what it computes,
        // so transcribing them here could only ever drift.
        horClassEntered: null,
      }))
    : [];
  return doc;
}

/**
 * HCM Chapter 26, Section 8, Example Problem 3 (Exhibit 26-27).
 *
 * 5.5 mi in five segments at a 55 mi/h posted limit, level throughout: 0.75 mi
 * Passing Constrained, 1.5 mi Passing Lane, 1.0 mi Passing Constrained, 0.5 mi
 * Passing Zone, 1.75 mi Passing Constrained. The demand steps down along the
 * facility, 850 to 795 veh/h, and the peak hour factor and heavy-vehicle
 * percentage move with it, which is what puts a demand feature at every
 * boundary.
 *
 * The published facility value is 7.3 followers/mi and LOS C. The engine gives
 * 7.271, and the difference is the exhibit's own rounding of its per-segment
 * column: weighting that column by length gives (10.7)(0.75) + (2.9)(1.5) +
 * (8.2)(1.0) + (8.2)(0.5) + (8.8)(1.75) over 5.5 mi, which is 7.3.
 *
 * The passing zone is the only segment whose entered opposing demand reaches the
 * answer. A Passing Constrained segment takes the engine's standing 1,500 veh/h
 * and a Passing Lane takes zero, so the 500 veh/h below is on the one segment
 * that reads it.
 */
function ch26ep3() {
  const doc = emptyDocument('twolane');
  doc.meta = { name: 'Chapter 26 Example Problem 3 (Exhibit 26-27)', source: 'example:ch26ep3', modified: null };
  Object.assign(doc.mainline, {
    lengthFt: 5.5 * MI,
    direction: 'Northbound',
    laneWidthFt: 12,
    shoulderWidthFt: 6,
    accessPointDensity: 0,
    pctHeavyVehInPassingLane: 0.4,
    effectiveDownstreamLengthMi: 0,
    speedLimitMph: 55,
    // Segment 1's conditions, which a stretch with no demand feature inherits.
    demand: [850],
    opposingDemand: 0,
    phf: 0.94,
    heavyVehiclePct: 8,
    verticalClass: 1,
  });

  doc.features = [
    {
      id: 'ps1',
      kind: 'passing',
      stationFt: 0.75 * MI,
      endFt: 2.25 * MI,
      label: 'Passing lane',
      passingType: 2,
    },
    {
      id: 'ps2',
      kind: 'passing',
      stationFt: 3.25 * MI,
      endFt: 3.75 * MI,
      label: 'Passing zone',
      passingType: 1,
    },
    demandAt('dm2', 0.75 * MI, 'Segment 2 conditions', { volume: 825, phf: 0.95, heavyVehiclePct: 8 }),
    demandAt('dm3', 2.25 * MI, 'Segment 3 conditions', { volume: 820, phf: 0.95, heavyVehiclePct: 8 }),
    demandAt('dm4', 3.25 * MI, 'Segment 4 conditions', {
      volume: 800,
      opposingVolume: 500,
      phf: 0.94,
      heavyVehiclePct: 7.5,
    }),
    demandAt('dm5', 3.75 * MI, 'Segment 5 conditions', { volume: 795, phf: 0.935, heavyVehiclePct: 8 }),
  ];
  return doc;
}

/**
 * HCM Chapter 26, Section 8, Example Problem 4 (Exhibit 26-36).
 *
 * 5.1 mi in six segments at a 55 mi/h posted limit carrying 1,100 veh/h
 * throughout, so the demand feature is the highway's own default and the
 * segmentation comes entirely from the grades, the curves and the passing lane.
 *
 * The grades are what make this facility: +4% over 1.3 mi at vertical class 4,
 * +6% over 1.0 mi at class 5, +6% over 0.5 mi at class 4, +4% over 1.3 mi at
 * class 4, then -3% over the last mile at class 1. The class is entered rather
 * than computed because Step 2 picks a passing lane's capacity off the class
 * before Step 3 has a chance to recompute it, so it is a real input.
 *
 * The passing lane is the fifth segment, 0.5 mi on the downgrade, which is
 * exactly the Exhibit 15-10 minimum for a passing lane and so is not demoted.
 * Segment 6 below it is what the Step 9 downstream adjustment acts on, and the
 * order Step 9 is walked in is what makes the facility value 19.897 rather than
 * 14.936.
 */
function ch26ep4() {
  const doc = emptyDocument('twolane');
  doc.meta = { name: 'Chapter 26 Example Problem 4 (Exhibit 26-36)', source: 'example:ch26ep4', modified: null };
  Object.assign(doc.mainline, {
    lengthFt: 5.1 * MI,
    direction: 'Northbound',
    laneWidthFt: 12,
    shoulderWidthFt: 6,
    accessPointDensity: 0,
    pctHeavyVehInPassingLane: 0.4,
    effectiveDownstreamLengthMi: 0,
    speedLimitMph: 55,
    demand: [1100],
    opposingDemand: 0,
    phf: 0.9,
    heavyVehiclePct: 8,
    verticalClass: 1,
  });

  // The five graded stretches, in feet. The last one spans two segments,
  // because the passing lane inside it is what splits them rather than a change
  // of grade.
  const GRADES = [
    [0, 1.3, 4, 4],
    [1.3, 2.3, 6, 5],
    [2.3, 2.8, 6, 4],
    [2.8, 4.1, 4, 4],
    [4.1, 5.1, -3, 1],
  ];
  // The three curves, at the stations the published tangent lengths put them
  // at. Each one runs to the end of its segment.
  const CURVES = [
    [5964, 900, 350, 2],
    [7864, 4280, 500, 2],
    [18648, 3000, 850, 2],
  ];

  doc.features = [
    ...GRADES.map(([a, b, gradePct, verticalClass], i) => ({
      id: `gr${i + 1}`,
      kind: 'grade',
      stationFt: a * MI,
      endFt: b * MI,
      label: `${gradePct > 0 ? '+' : ''}${gradePct}% grade`,
      gradePct,
      verticalClass,
    })),
    ...CURVES.map(([station, length, radius, superelevation], i) => ({
      id: `hc${i + 1}`,
      kind: 'curve',
      stationFt: station,
      endFt: station + length,
      label: `Curve ${i + 1}`,
      designRadiusFt: radius,
      superelevationPct: superelevation,
      centralAngleDeg: 0,
      horClassEntered: null,
    })),
    {
      id: 'ps1',
      kind: 'passing',
      stationFt: 4.1 * MI,
      endFt: 4.6 * MI,
      label: 'Passing lane',
      passingType: 2,
    },
  ];
  return doc;
}

function demandAt(id, stationFt, label, config) {
  return {
    id,
    kind: 'demand',
    stationFt,
    label,
    config: { opposingVolume: 0, speedLimitMph: null, ...config },
  };
}
