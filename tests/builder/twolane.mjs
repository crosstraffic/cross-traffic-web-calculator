// Two-lane highway checks for the facility builder, in the idiom of
// tests/boundary and the other two builder files: plain node, no runner,
// nonzero exit on failure. Run with `npm run test:builder`.
//
// Four separate claims, and they fail in different ways.
//
// 1. The derivation. Grade, passing and demand features partition the highway
//    and curves deliberately do not, which is the one structural rule Chapter 15
//    states differently from the other two chapters. The edge cases are the ones
//    a partition gets wrong quietly: a curve straddling a boundary, a curve that
//    tiles a segment exactly, a passing lane under the Exhibit 15-10 minimum.
// 2. The units. Chapter 15 is the one chapter that mixes miles and feet inside
//    one facility, and the footguns note calls mixing them the classic error
//    because the results stay plausible. So the conversion is checked in both
//    directions and at the boundary where it happens.
// 3. The published values. All four reconstructions have to reproduce the Step
//    11 values tests/boundary/ch15_twolanehighways.mjs pins, through the SAME
//    engine calls the page makes. A builder that reproduced the boundary by a
//    different route could be green here and wrong on the page.
// 4. The fixture round trip. An untouched import has to re-export to the file it
//    came from, which is what makes the "a Chapter 15 fixture is invertible"
//    claim in fixture.js a fact rather than an assertion.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// The sibling library's fixtures; tests/libCases.mjs resolves the checkout and
// says why that is not a one-line join.
import { readCase } from '../libCases.mjs';

import {
  deriveRows,
  deriveTwoLaneRows,
  PASSING_LANE_MIN_FT,
  TWOLANE_SEGMENT_KEYS,
} from '../../src/lib/builder/derive.js';
import { emptyDocument, makeFeature, migrate, setPeriods, DOC_VERSION } from '../../src/lib/builder/document.js';
import { loadTwoLaneExample, TWOLANE_EXAMPLES } from '../../src/lib/builder/twoLaneExamples.js';
import { fromTwoLaneFixture, toTwoLaneFixture, toFixture } from '../../src/lib/builder/fixture.js';
import { validateFacility } from '../../src/lib/builder/validate.js';
import { analyzeTwoLaneFacility, segmentConfig } from '../../src/lib/builder/twoLaneAnalyze.js';
import { twoLaneDiscussion } from '../../src/lib/builder/twoLaneDiscussion.js';
import { TWOLANE_MEASURES, twoLaneMeasureById, domainOf, cellText } from '../../src/lib/builder/heatmap.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, '..', '..', 'HCM-middleware', 'pkg');

const wasm = await import(join(pkgDir, 'HCM_middleware.js'));
await wasm.default(readFileSync(join(pkgDir, 'HCM_middleware_bg.wasm')));

const MI = 5280;
const loadCase = (name) => readCase('TwoLaneHighways', name);

const failures = [];
let checks = 0;
function eq(actual, expected, label) {
  checks += 1;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${label}: got ${a}, expected ${e}`);
}
function near(actual, expected, tol, label) {
  checks += 1;
  if (typeof actual !== 'number' || Number.isNaN(actual) || Math.abs(actual - expected) > tol) {
    failures.push(`${label}: got ${actual}, expected ${expected} (+-${tol})`);
  }
}
function ok(cond, label) {
  checks += 1;
  if (!cond) failures.push(label);
}
function throws(fn, needle, label) {
  checks += 1;
  try {
    fn();
    failures.push(`${label}: expected a throw, got none`);
  } catch (e) {
    const msg = String(e.message ?? e);
    if (!msg.includes(needle)) failures.push(`${label}: message "${msg}" does not mention "${needle}"`);
  }
}

const derive = (doc) => deriveTwoLaneRows(doc);
const flagIds = (doc) => {
  const d = derive(doc);
  return validateFacility(doc, d.rows, d.errors).map((f) => f.id);
};
const blockingOf = (doc) => {
  const d = derive(doc);
  return validateFacility(doc, d.rows, d.errors).filter((f) => f.level === 'error');
};

/** A highway of one length with the given features and nothing else. */
function highway(lengthFt, features = []) {
  const doc = emptyDocument('twolane');
  doc.mainline.lengthFt = lengthFt;
  doc.features = features;
  return doc;
}

const grade = (id, aMi, bMi, gradePct, verticalClass = 1) => ({
  id,
  kind: 'grade',
  stationFt: aMi * MI,
  endFt: bMi * MI,
  label: '',
  gradePct,
  verticalClass,
});
const passing = (id, aMi, bMi, passingType) => ({
  id,
  kind: 'passing',
  stationFt: aMi * MI,
  endFt: bMi * MI,
  label: '',
  passingType,
});
const curve = (id, startFt, lengthFt, designRadiusFt, superelevationPct = 0) => ({
  id,
  kind: 'curve',
  stationFt: startFt,
  endFt: startFt + lengthFt,
  label: '',
  designRadiusFt,
  superelevationPct,
  centralAngleDeg: 0,
  horClassEntered: null,
});
const demand = (id, stationFt, config) => ({
  id,
  kind: 'demand',
  stationFt,
  label: '',
  config: { volume: 800, opposingVolume: 0, phf: 0.95, heavyVehiclePct: 5, speedLimitMph: null, ...config },
});

// ── 1. The derivation ───────────────────────────────────────────────────

{
  // The empty case, which is a real Chapter 15 facility rather than a
  // degenerate one: a two-lane highway with no passing feature on it is
  // Passing Constrained for its whole length.
  const doc = highway(3 * MI);
  const d = derive(doc);
  eq(d.errors, [], 'a highway with no features derives without errors');
  eq(d.rows.length, 1, 'and is one segment');
  eq(d.rows[0].passing_type, 0, 'which is Passing Constrained, because nothing said otherwise');
  eq(d.rows[0].seg_type, 'Passing Constrained', 'and its chassis type name says so');
  eq(d.rows[0].length, 3, 'its length reaches the engine in MILES');
  eq(d.rows[0].length_ft, 3 * MI, 'and the chassis in FEET, off the same span');
  eq(d.rows[0].is_hc, false, 'no curve, so horizontal curves are off');
  eq(d.rows[0].subsegments, [], 'and it has no subsegments at all');
  eq(d.rows[0].lanes, 1, 'a two-lane highway carries one lane in the analysis direction');
}

{
  // Passing features bound segments at both ends, and only where they are.
  const doc = highway(4 * MI, [passing('ps1', 1, 2, 2)]);
  const d = derive(doc);
  eq(d.errors, [], 'a passing lane derives without errors');
  eq(
    d.rows.map((r) => r.length),
    [1, 1, 2],
    'a passing lane in the middle cuts the highway in three',
  );
  eq(
    d.rows.map((r) => r.passing_type),
    [0, 2, 0],
    'and only the covered stretch is the passing lane',
  );
  eq(
    d.rows.map((r) => r.lanes),
    [1, 2, 1],
    'the passing lane draws as the added lane it is',
  );
  eq(d.rows[1].seg_type, 'Passing Lane', 'named for the strip and for the override key');
  ok(d.rows[1].key !== d.rows[0].key, 'and the rows key distinctly');
  ok(
    d.rows.every((r) => r.key.includes('ps1') || r.key.includes('start') || r.key.includes('end')),
    'every row key names the feature or terminus that bounded it, not its index',
  );
}

{
  // A passing zone is a different type and reads a different opposing flow.
  const doc = highway(3 * MI, [passing('ps1', 1, 2, 1), demand('dm1', 1 * MI, { opposingVolume: 500 })]);
  const d = derive(doc);
  eq(
    d.rows.map((r) => r.passing_type),
    [0, 1, 0],
    'a passing zone is type 1',
  );
  eq(d.rows[1].volume_op, 500, 'and the opposing demand in force reaches it');
  eq(d.rows[1].lanes, 1, 'a passing zone adds no lane, it only dashes the centerline');
}

{
  // The Exhibit 15-10 demotion, and its boundary. Step 1: "Passing lanes
  // shorter than the minima given in Exhibit 15-10 should be ignored and
  // treated as Passing Constrained segments instead."
  eq(PASSING_LANE_MIN_FT, 0.5 * MI, 'the passing lane minimum is 0.5 mi for every vertical class');

  const short = highway(3 * MI, [passing('ps1', 1, 1.3, 2)]);
  const ds = derive(short);
  eq(
    ds.rows.map((r) => r.passing_type),
    [0, 0, 0],
    'a 0.3 mi passing lane is analyzed as Passing Constrained',
  );
  ok(ds.rows[1].demotedPassingLane, 'and the row records that it was demoted rather than hiding it');
  ok(/Exhibit 15-10/.test(ds.rows[1].why), 'the reason cites the exhibit that demoted it');

  const exact = highway(3 * MI, [passing('ps1', 1, 1.5, 2)]);
  const de = derive(exact);
  eq(
    de.rows.map((r) => r.passing_type),
    [0, 2, 0],
    'a passing lane exactly at the 0.5 mi minimum is NOT demoted',
  );
  ok(!de.rows[1].demotedPassingLane, 'and is not marked as one');
}

{
  // Grades bound segments and carry the vertical class, which is a Step 2
  // input in its own right even though Step 3 recomputes it.
  const doc = highway(3 * MI, [grade('gr1', 1, 2, 5, 4)]);
  const d = derive(doc);
  eq(
    d.rows.map((r) => r.grade),
    [0, 5, 0],
    'a grade covers exactly the stretch it was placed over',
  );
  eq(
    d.rows.map((r) => r.vertical_class),
    [1, 4, 1],
    'and carries its vertical class with it',
  );
  eq(
    d.rows.map((r) => r.length),
    [1, 1, 1],
    'both of its ends are segment boundaries',
  );
}

{
  // A demand change bounds ONE segment, at its single station, and holds from
  // there downstream.
  const doc = highway(3 * MI, [demand('dm1', 2 * MI, { volume: 1200, phf: 0.9, heavyVehiclePct: 12 })]);
  const d = derive(doc);
  eq(
    d.rows.map((r) => r.length),
    [2, 1],
    'a demand change cuts the highway in two',
  );
  eq(
    d.rows.map((r) => r.volume),
    [800, 1200],
    'the upstream stretch takes the highway default',
  );
  eq(
    d.rows.map((r) => r.phf),
    [0.95, 0.9],
    'and the factors move with the volume',
  );
  eq(
    d.rows.map((r) => r.phv),
    [5, 12],
    'heavy vehicles is a PERCENT and is carried as one',
  );
  eq(
    d.rows.map((r) => r.spl),
    [55, 55],
    "a blank posted limit on the change inherits the highway's",
  );
}

{
  // The posted limit is a homogeneity property too, so a change in it alone
  // starts a segment.
  const doc = highway(3 * MI, [demand('dm1', 1.5 * MI, { speedLimitMph: 45 })]);
  const d = derive(doc);
  eq(
    d.rows.map((r) => r.spl),
    [55, 45],
    'a posted limit change reaches the segment below it',
  );
  eq(d.rows.length, 2, 'and starts a segment of its own');
}

// ── Curves: the one feature that does not bound a segment ────────────────

{
  // Step 1: "Varying horizontal curvature can be included within a single
  // segment, as described in Step 5d." So a curve inside a segment leaves the
  // segment count alone and adds subsegments.
  const doc = highway(1 * MI, [curve('hc1', 1000, 500, 600, 4)]);
  const d = derive(doc);
  eq(d.rows.length, 1, 'a curve does NOT start a segment');
  eq(d.rows[0].is_hc, true, 'but it does turn on horizontal curves, which is the gate the engine reads');
  eq(
    d.rows[0].subsegments.map((ss) => ss.length),
    [1000, 500, MI - 1500],
    'and the derivation fills tangents around it so the subsegments tile the segment',
  );
  eq(
    d.rows[0].subsegments.map((ss) => ss.design_rad),
    [0, 600, 0],
    'only the curve carries a radius',
  );
  eq(
    d.rows[0].subsegments.map((ss) => ss.sup_ele),
    [0, 4, 0],
    'superelevation is a PERCENT and rides with it',
  );
  eq(
    d.rows[0].subsegments.map((ss) => ss.hor_class),
    [0, 0, 0],
    'the horizontal class is left at zero, because Step 5d computes it from the radius and overwrites anything supplied',
  );
  near(
    d.rows[0].subsegments.reduce((a, ss) => a + ss.length, 0),
    d.rows[0].length_ft,
    1e-6,
    'the subsegments sum to the segment length in FEET',
  );
}

{
  // A curve starting at the very start of a segment needs no leading tangent,
  // and one ending at the very end needs no trailing one. Both off-by-ones
  // would leave a zero-length subsegment, which the engine would happily weight.
  const flush = highway(1 * MI, [curve('hc1', 0, MI, 600, 4)]);
  const df = derive(flush);
  eq(
    df.rows[0].subsegments.map((ss) => ss.length),
    [MI],
    'a curve filling its whole segment is one subsegment',
  );
  ok(
    df.rows[0].subsegments.every((ss) => ss.length > 0),
    'and no zero-length filler is emitted',
  );

  const head = highway(1 * MI, [curve('hc1', 0, 500, 600, 4)]);
  eq(
    derive(head).rows[0].subsegments.map((ss) => ss.length),
    [500, MI - 500],
    'a curve at the start of a segment has no leading tangent',
  );
  const tail = highway(1 * MI, [curve('hc1', MI - 500, 500, 600, 4)]);
  eq(
    derive(tail).rows[0].subsegments.map((ss) => ss.length),
    [MI - 500, 500],
    'a curve at the end of one has no trailing tangent',
  );
}

{
  // A curve straddling a segment boundary is clipped to each side, and each
  // side still tiles. This is the case that would silently break the Step 5d
  // weighting if the clip were wrong, because the engine divides by the
  // segment length either way.
  const doc = highway(2 * MI, [passing('ps1', 1, 2, 1), curve('hc1', MI - 400, 800, 500, 3)]);
  const d = derive(doc);
  eq(d.errors, [], 'a curve across a boundary derives without errors');
  eq(d.rows.length, 2, 'and does not add a segment of its own');
  eq(
    d.rows.map((r) => r.is_hc),
    [true, true],
    'both segments are coded with horizontal curves',
  );
  eq(
    d.rows[0].subsegments.map((ss) => [ss.length, ss.design_rad]),
    [
      [MI - 400, 0],
      [400, 500],
    ],
    'the upstream half gets 400 ft of curve',
  );
  eq(
    d.rows[1].subsegments.map((ss) => [ss.length, ss.design_rad]),
    [
      [400, 500],
      [MI - 400, 0],
    ],
    'and the downstream half the other 400',
  );
  for (const r of d.rows) {
    near(
      r.subsegments.reduce((a, ss) => a + ss.length, 0),
      r.length_ft,
      1e-6,
      'each half still tiles its own segment exactly',
    );
  }
}

{
  // Overlapping curves. The tiling gives the overlap to whichever curve reached
  // it first, so the second one is partly or wholly discarded, and a discarded
  // curve is a silently faster highway. Both shapes are checked, and the
  // swallowed one is the dangerous one: before it was guarded it emitted a
  // NEGATIVE subsegment length, which the engine weights like any other.
  const partial = highway(1 * MI, [curve('hc1', 500, 600, 600), curve('hc2', 900, 500, 900)]);
  const dp2 = derive(partial);
  ok(
    dp2.errors.some((e) => /overlap/.test(e)),
    'partly overlapping curves are reported',
  );
  ok(
    dp2.rows[0].subsegments.every((ss) => ss.length > 0),
    'and no subsegment comes out zero or negative',
  );
  near(
    dp2.rows[0].subsegments.reduce((a, ss) => a + ss.length, 0),
    MI,
    1e-6,
    'and the segment still tiles',
  );
  eq(
    dp2.rows[0].subsegments.map((ss) => [ss.length, ss.design_rad]),
    [
      [500, 0],
      [600, 600],
      [300, 900],
      [3880, 0],
    ],
    'the overlap goes to the upstream curve and the second contributes only its remainder',
  );

  const swallowed = highway(1 * MI, [curve('hc1', 500, 1000, 600), curve('hc2', 700, 200, 900)]);
  const ds2 = derive(swallowed);
  ok(
    ds2.errors.some((e) => /overlap/.test(e)),
    'a curve inside another is reported',
  );
  ok(
    ds2.rows[0].subsegments.every((ss) => ss.length > 0),
    'and contributes no subsegment at all rather than a negative-length one',
  );
  near(
    ds2.rows[0].subsegments.reduce((a, ss) => a + ss.length, 0),
    MI,
    1e-6,
    'so the segment still tiles',
  );
  eq(
    ds2.rows[0].subsegments.map((ss) => [ss.length, ss.design_rad]),
    [
      [500, 0],
      [1000, 600],
      [3780, 0],
    ],
    'the swallowed curve leaves the tiling exactly as the outer one alone would',
  );
  ok(blockingOf(swallowed).length > 0, 'and an overlap blocks the analysis rather than analyzing a discarded curve');
}

{
  // Two curves in one segment, so the middle tangent is produced rather than
  // the two curves being run together.
  const doc = highway(1 * MI, [curve('hc1', 500, 400, 600), curve('hc2', 1500, 300, 900)]);
  const d = derive(doc);
  eq(
    d.rows[0].subsegments.map((ss) => ss.length),
    [500, 400, 600, 300, MI - 1800],
    'two curves in one segment produce five subsegments, with a tangent between them',
  );
  eq(
    d.rows[0].subsegments.map((ss) => ss.design_rad),
    [0, 600, 0, 900, 0],
    'in the order they sit on the highway',
  );
}

{
  // The override layer, which the segment table writes and which is the one
  // place a number reaches the engine without passing through the derivation.
  //
  // A row is two things at once, and this is the join that has to hold: the
  // chassis reads `length_ft` and `seg_type`, and the ENGINE reads `length` in
  // miles and `passing_type`. An override that moved only the chassis half
  // would change the segment table, the strip and the reported facility length
  // while the engine analyzed whatever the derivation last said, and nothing
  // would error.
  const doc = highway(3 * MI, [passing('ps1', 1, 2, 2)]);
  const key = derive(doc).rows[1].key;

  doc.overrides = { [key]: { fields: { length_ft: 3000 }, appliedTo: 'Passing Lane' } };
  const pinnedLength = derive(doc).rows[1];
  eq(pinnedLength.length_ft, 3000, 'a pinned length reaches the chassis in feet');
  near(pinnedLength.length, 3000 / 5280, 1e-12, 'and the engine in miles, off the same pin');
  ok(pinnedLength.overridden, 'and the row is marked');
  // Through the engine, so the claim is about the answer and not about a field.
  const pinnedRun = analyzeTwoLaneFacility(doc, derive(doc).rows, wasm);
  near(pinnedRun.segments[1].lengthMi, 3000 / 5280, 1e-12, 'the analysis reports the pinned length');
  near(pinnedRun.lengthFt, 5280 + 3000 + 5280, 1e-9, 'and the facility length is the pinned sum');

  doc.overrides = { [key]: { fields: { seg_type: 'Passing Zone' }, appliedTo: 'Passing Lane' } };
  const pinnedType = derive(doc).rows[1];
  eq(pinnedType.seg_type, 'Passing Zone', 'a pinned type reaches the chassis');
  eq(pinnedType.passing_type, 1, 'and the engine, as the index Chapter 15 takes');
  eq(pinnedType.lanes, 1, 'and the drawn cross section follows it, since a passing zone adds no lane');

  doc.overrides = { [key]: { fields: { seg_type: 'Passing Zone', lanes: 2 }, appliedTo: 'Passing Lane' } };
  eq(derive(doc).rows[1].lanes, 2, 'unless the lane count was pinned too, in which case the analyst said both');

  // And clearing it restores the derivation.
  doc.overrides = {};
  eq(derive(doc).rows[1].passing_type, 2, 'clearing the override restores the derived type');
  eq(derive(doc).rows[1].length, 1, 'and the derived length');
}

// ── 2. Units ────────────────────────────────────────────────────────────

{
  // The whole point of the unit decision, asserted in both directions. The
  // document is feet; the engine takes a segment length in miles and a
  // subsegment length in feet; the conversion happens once.
  const doc = highway(2.5 * MI, [curve('hc1', 1000, 528, 700, 2)]);
  const r = derive(doc).rows[0];
  eq(doc.mainline.lengthFt, 13200, 'the document holds the highway length in feet');
  eq(r.length_ft, 13200, 'the row holds the same number for the chassis');
  eq(r.length, 2.5, 'and the same distance in miles for the Chapter 15 schema');
  eq(r.subsegments[1].length, 528, 'a subsegment length stays in FEET, and 528 ft is not 0.1');
  ok(r.length < r.length_ft, 'the two are different numbers, which is the trap this arrangement avoids');

  // And the round trip through the fixture keeps both.
  const out = toTwoLaneFixture(doc, [r]);
  eq(out.segments[0].length, 2.5, 'the exported segment length is miles');
  eq(out.segments[0].subsegments[1].length, 528, 'the exported subsegment length is feet');
}

{
  // The float case that produced a 0.49999999999999933 mi segment before the
  // highway length was rounded. 5.1 x 5280 is not an integer in binary.
  const doc = highway(5.1 * MI, [passing('ps1', 4.1, 4.6, 2)]);
  const d = derive(doc);
  eq(
    d.rows.map((r) => r.length),
    [4.1, 0.5, 0.5],
    'a highway length that is not exactly representable still yields exact segment lengths',
  );
  eq(d.rows[1].passing_type, 2, 'and the 0.5 mi passing lane is not demoted by a rounding error');
}

{
  // segmentConfig hands the engine the schema and nothing else, so a
  // bookkeeping key cannot fall through onto a serde default.
  const doc = highway(1 * MI, [curve('hc1', 100, 200, 500, 3)]);
  const cfg = segmentConfig(derive(doc).rows[0]);
  eq(Object.keys(cfg).sort(), [...TWOLANE_SEGMENT_KEYS].sort(), 'the config is exactly the Chapter 15 keys');
  ok(!('key' in cfg) && !('startFt' in cfg) && !('why' in cfg), 'and carries no row bookkeeping');
}

// ── 3. The published values, through the page's own engine calls ────────

{
  // The four Example Problems, reconstructed from features rather than
  // imported. Every expected value is the boundary file's, not a new one.
  const EXPECT = {
    ch26ep1: {
      segs: 1,
      facilityFd: 10.092,
      facilityLos: 'D',
      ffs: [56.83],
      speed: [53.7],
      pf: [67.7],
      fd: [10.1],
      los: ['D'],
    },
    ch26ep2: {
      segs: 1,
      facilityFd: 10.933,
      facilityLos: 'D',
      ffs: [56.83],
      speed: [49.5],
      pf: [67.7],
      fd: [10.9],
      los: ['D'],
    },
    ch26ep3: {
      segs: 5,
      facilityFd: 7.271,
      facilityLos: 'C',
      ffs: [62.43, 62.43, 62.43, 62.45, 62.43],
      speed: [58.8, 57.8, 58.9, 59.2, 58.9],
      pf: [69.7, 60.7, 68.0, 67.8, 67.7],
      fd: [10.7, 9.1, 10.0, 9.7, 9.8],
      los: ['D', 'B', 'D', 'D', 'D'],
    },
    ch26ep4: {
      segs: 6,
      facilityFd: 19.897,
      facilityLos: 'E',
      ffs: [60.02, 59.04, 60.07, 60.02, 62.43, 62.43],
      speed: [47.9, 43.9, 50.8, 49.2, 56.0, 58.3],
      pf: [86.9, 89.3, 83.9, 86.9, 78.2, 78.4],
      fd: [22.2, 24.9, 20.2, 21.6, 17.1, 16.4],
      los: ['E', 'E', 'E', 'E', 'C', 'E'],
    },
  };

  for (const [id, want] of Object.entries(EXPECT)) {
    const doc = loadTwoLaneExample(id);
    const d = derive(doc);
    eq(d.errors, [], `${id} derives without errors`);
    eq(d.rows.length, want.segs, `${id} derives ${want.segs} segments from its features`);
    eq(
      blockingOf(doc).map((f) => f.id),
      [],
      `${id} has no blocking validation flags`,
    );

    const run = analyzeTwoLaneFacility(doc, d.rows, wasm);
    // Equation 15-39, at the boundary file's own tolerance.
    near(run.facilityFd, want.facilityFd, 0.0005, `${id} facility follower density [Equation 15-39]`);
    eq(run.los, want.facilityLos, `${id} facility LOS [Exhibit 15-6]`);
    eq(run.numPeriods, 1, `${id} carries one period, because Chapter 15 is single-period`);
    ok(Object.isFrozen(run), `${id} run is frozen onto the moment it happened`);

    // Representative per-segment values, at the boundary file's tolerances.
    for (let i = 0; i < want.segs; i++) {
      const s = run.segments[i];
      near(s.ffs, want.ffs[i], 0.005, `${id} seg${i} FFS`);
      near(s.avgSpeed, want.speed[i], 0.05, `${id} seg${i} average speed`);
      near(s.percentFollowers, want.pf[i], 0.05, `${id} seg${i} percent followers`);
      // The RAW Step 7/8 value, which is what the boundary file pins. A
      // passing lane's reported column is its midpoint value instead, and
      // that is checked separately below.
      near(s.fd, want.fd[i], 0.05, `${id} seg${i} follower density`);
      eq(s.los, want.los[i], `${id} seg${i} LOS`);
    }

    // The example loaders and the library's own fixtures have to describe the
    // same facility, key for key, on every input the example states.
    const fixture = loadCase(`case${id.slice(-1)}.json`);
    const built = toTwoLaneFixture(doc, d.rows);
    for (const k of ['lane_width', 'shoulder_width', 'apd', 'pmhvfl', 'l_de']) {
      eq(built[k], fixture[k], `${id} facility ${k} matches the fixture`);
    }
    for (let i = 0; i < fixture.segments.length; i++) {
      for (const k of [
        'passing_type',
        'length',
        'grade',
        'spl',
        'is_hc',
        'volume',
        'volume_op',
        'vertical_class',
        'phf',
        'phv',
      ]) {
        eq(built.segments[i][k], fixture.segments[i][k], `${id} seg${i} ${k} matches the fixture`);
      }
      eq(
        (built.segments[i].subsegments ?? []).map((ss) => [ss.length, ss.design_rad, ss.sup_ele]),
        (fixture.segments[i].subsegments ?? []).map((ss) => [ss.length, ss.design_rad, ss.sup_ele]),
        `${id} seg${i} subsegments match the fixture`,
      );
    }
  }

  throws(() => loadTwoLaneExample('nope'), 'unknown two-lane example', 'an unknown example id is refused');
  eq(
    TWOLANE_EXAMPLES.map((e) => e.id),
    ['ch26ep1', 'ch26ep2', 'ch26ep3', 'ch26ep4'],
    'four examples are offered',
  );
}

{
  // The curve proof, stated as the comparison rather than as two numbers. The
  // two examples differ by the curves and by nothing else, so the whole
  // difference in speed is the Step 5d subsegment adjustment.
  const plain = loadTwoLaneExample('ch26ep1');
  const curved = loadTwoLaneExample('ch26ep2');
  const dp = derive(plain);
  const dc = derive(curved);
  eq(dp.rows[0].is_hc, false, 'Example Problem 1 has no horizontal curves');
  eq(dc.rows[0].is_hc, true, 'Example Problem 2 does');
  eq(dc.rows[0].subsegments.length, 11, 'and its five curves become eleven subsegments with the tangents between them');
  eq(dc.rows[0].subsegments.filter((ss) => ss.design_rad > 0).length, 5, 'five of which are the curves');
  eq(
    dc.rows[0].subsegments.map((ss) => ss.length),
    [280, 432, 260, 366.5, 250, 216, 275.6, 458, 285, 767.9, 369],
    'at the published subsegment lengths, in feet',
  );
  near(
    dc.rows[0].subsegments.reduce((a, ss) => a + ss.length, 0),
    3960,
    1e-6,
    'summing to the 0.75 mi segment exactly, which nothing in the engine checks',
  );
  eq(dp.rows[0].length, dc.rows[0].length, 'the two are the same segment length');
  eq(dp.rows[0].volume, dc.rows[0].volume, 'at the same demand');

  const rp = analyzeTwoLaneFacility(plain, dp.rows, wasm);
  const rc = analyzeTwoLaneFacility(curved, dc.rows, wasm);
  near(rp.segments[0].ffs, rc.segments[0].ffs, 1e-9, 'so their free-flow speeds are identical');
  near(rp.segments[0].percentFollowers, rc.segments[0].percentFollowers, 1e-9, 'and so are their percent followers');
  // The published columns round to 53.7 and 49.5, so the difference reads as
  // 4.2; the engine's own values differ by 4.13, and that is what is pinned.
  near(
    rc.segments[0].avgSpeed - rp.segments[0].avgSpeed,
    -4.13,
    0.01,
    'and the entire difference, 4.13 mi/h, is the horizontal-curve adjustment',
  );
  ok(rc.facilityFd > rp.facilityFd, 'which raises the follower density');

  // The is_hc gate itself, which is the footgun: curve geometry supplied
  // without the flag is silently ignored. The derivation sets it from the
  // curves, so the only way to reach the unflagged state is to strip them, and
  // the answer must go back to Example Problem 1's.
  const stripped = loadTwoLaneExample('ch26ep2');
  stripped.features = [];
  const rs = analyzeTwoLaneFacility(stripped, derive(stripped).rows, wasm);
  near(
    rs.segments[0].avgSpeed,
    rp.segments[0].avgSpeed,
    1e-9,
    'removing the curves returns the speed to the uncurved one, so is_hc is derived and not stale',
  );
}

{
  // The passing-lane proof: the passing-type derivation, the midpoint value
  // and the Step 9 downstream adjustment, on Example Problem 4.
  const doc = loadTwoLaneExample('ch26ep4');
  const d = derive(doc);
  eq(
    d.rows.map((r) => r.passing_type),
    [0, 0, 0, 0, 2, 0],
    'the passing lane is derived as the fifth segment',
  );
  const run = analyzeTwoLaneFacility(doc, d.rows, wasm);

  const pl = run.segments[4];
  eq(pl.passingType, 2, 'segment 5 is the passing lane');
  near(pl.fd, 17.1, 0.05, "its endpoint follower density is the boundary file's value");
  near(pl.fdMid, 6.04, 0.05, 'its midpoint value is far lower, and is a different quantity');
  near(pl.followerDensity, pl.fdMid, 1e-9, 'and the midpoint is what the column reports, per Steps 10 and 11');
  eq(pl.los, 'C', 'which is what puts it two letters above its neighbours');

  // Step 9. The segment below the lane takes the adjusted density; the ones
  // above it take none, which is the ordering guard the binding exists for.
  near(run.segments[5].fdAdjustment, 13.2, 0.05, 'the segment below the passing lane takes a Step 9 adjustment');
  near(run.segments[5].followerDensity, 13.2, 0.05, 'and reports the adjusted value rather than its own 16.4');
  near(run.segments[5].fd, 16.4, 0.05, 'which is lower than the unadjusted one, so the lane helped');
  for (const i of [0, 1, 2, 3]) {
    near(run.segments[i].fdAdjustment, 0, 1e-9, `segment ${i + 1}, upstream of the lane, takes no adjustment`);
    near(run.segments[i].followerDensity, run.segments[i].fd, 1e-9, `and reports its plain follower density`);
  }

  // The whole facility value depends on that ordering. Analyzing twice from
  // scratch must give the same answer, which is the property the facility-level
  // binding restores state to protect.
  const again = analyzeTwoLaneFacility(loadTwoLaneExample('ch26ep4'), derive(loadTwoLaneExample('ch26ep4')).rows, wasm);
  near(again.facilityFd, run.facilityFd, 1e-9, 'a second run from a fresh facility gives the same facility value');
  ok(
    Math.abs(run.facilityFd - 14.936) > 1.0,
    'and it is not the 14.936 an unrestored Step 9 walk produces, which is what the binding guards',
  );
}

{
  // Exhibit 15-10, read off the engine's own identify_vertical_class rather
  // than out of a second copy of the table here. The library computes these
  // bounds and consumes them nowhere.
  const doc = loadTwoLaneExample('ch26ep3');
  const run = analyzeTwoLaneFacility(doc, derive(doc).rows, wasm);
  eq(
    run.segments.map((s) => [s.minLengthMi, s.maxLengthMi]),
    [
      [0.25, 3],
      [0.5, 3],
      [0.25, 3],
      [0.25, 2],
      [0.25, 3],
    ],
    'the recommended bounds differ by passing type, which is what Exhibit 15-10 columns',
  );
  eq(
    run.segments.map((s) => s.outsideRecommended),
    [false, false, false, false, false],
    'and Example Problem 3 is inside all of them',
  );

  // Two controls, one at each end of the band, so a check that always reported
  // false would be caught. A Passing Constrained vertical class 1 segment is
  // recommended between 0.25 and 3 mi.
  const short = highway(0.2 * MI);
  const rShort = analyzeTwoLaneFacility(short, derive(short).rows, wasm);
  ok(rShort.segments[0].outsideRecommended, 'a 0.2 mi segment is reported as under the Exhibit 15-10 minimum');
  near(rShort.segments[0].minLengthMi, 0.25, 1e-9, 'against the 0.25 mi the engine returns for its class and type');

  const long = highway(4 * MI);
  const rLong = analyzeTwoLaneFacility(long, derive(long).rows, wasm);
  ok(rLong.segments[0].outsideRecommended, 'and a 4 mi one as over the maximum');
  near(rLong.segments[0].maxLengthMi, 3, 1e-9, 'against the 3 mi maximum');

  const inside = highway(1 * MI);
  const rIn = analyzeTwoLaneFacility(inside, derive(inside).rows, wasm);
  ok(!rIn.segments[0].outsideRecommended, 'a 1 mi one is inside, which is the control that the check can be false');
  ok(
    twoLaneDiscussion(rShort).some((l) => /Exhibit 15-10 recommended length/.test(l)),
    'and the discussion names the segment that fell outside, since the engine computes the bound and uses it nowhere',
  );
}

// ── 4. The fixture round trip ───────────────────────────────────────────

{
  for (const [i, name] of ['case1.json', 'case2.json', 'case3.json', 'case4.json'].entries()) {
    const raw = loadCase(name);
    const doc = fromTwoLaneFixture(raw, name);
    const d = derive(doc);
    eq(d.errors, [], `${name} imports and derives without errors`);
    eq(d.rows.length, raw.segments.length, `${name} imports as its own segment count`);
    eq(toTwoLaneFixture(doc, d.rows), raw, `${name} re-exports to the file it came from`);
    // And through the public dispatcher, which is what the page calls.
    eq(toFixture(doc, d.rows), raw, `${name} round-trips through toFixture too`);

    // The import is a feature layer, not a segment list. That is the claim
    // that makes an imported Chapter 15 fixture editable.
    ok(doc.importedSegments === null, `${name} arrives with a feature layer rather than as bare segments`);
    ok(doc.features.length > 0, `${name} recovers features`);

    // And the imported document analyzes to the same place the loader does.
    const run = analyzeTwoLaneFacility(doc, d.rows, wasm);
    near(
      run.facilityFd,
      [10.092, 10.933, 7.271, 19.897][i],
      0.0005,
      `${name} imported reproduces its Step 11 facility follower density`,
    );
  }
}

{
  // A hand-written fixture that states only what it has to. The four published
  // ones all state every key, so they cannot catch an export that writes the
  // derivation's placeholders back onto a segment that omitted them, and that
  // is exactly what an unguarded export does: `flow_rate`, `capacity`, `ffs`,
  // `pf`, `fd`, `hor_class` and an empty `subsegments` would all appear.
  const minimal = {
    lane_width: 12.0,
    shoulder_width: 6.0,
    apd: 0.0,
    pmhvfl: 0.0,
    segments: [
      { passing_type: 0, length: 1.0, grade: 0.0, spl: 55.0, volume: 800.0, phf: 0.95, phv: 5.0 },
      { passing_type: 1, length: 0.5, grade: 0.0, spl: 55.0, volume: 800.0, volume_op: 400.0, phf: 0.95, phv: 5.0 },
    ],
  };
  const doc = fromTwoLaneFixture(minimal, 'minimal.json');
  const d = derive(doc);
  eq(d.errors, [], 'a minimal fixture imports and derives without errors');
  eq(
    d.rows.map((r) => r.length),
    [1, 0.5],
    'at its own segment lengths',
  );
  eq(
    toTwoLaneFixture(doc, d.rows),
    minimal,
    "and an untouched minimal fixture re-exports exactly, without gaining the derivation's placeholders",
  );

  // And a key it omitted appears once, and only once, the user changes it.
  const edited = fromTwoLaneFixture(minimal, 'minimal.json');
  edited.features.find((f) => f.kind === 'grade' || f.kind === 'demand');
  edited.features.push({
    id: 'gr9',
    kind: 'grade',
    stationFt: 0,
    endFt: 5280,
    label: '',
    gradePct: 4,
    verticalClass: 4,
  });
  const de = derive(edited);
  const out = toTwoLaneFixture(edited, de.rows);
  eq(out.segments[0].grade, 4, 'a changed key the fixture stated is updated');
  eq(out.segments[0].vertical_class, 4, 'and the key it omitted appears, because the change brought it');
  ok(!('capacity' in out.segments[0]), 'while the placeholders it did not change stay absent');
  ok(!('subsegments' in out.segments[0]), 'including the empty subsegment list');
  eq(
    Object.keys(out.segments[1]),
    Object.keys(minimal.segments[1]),
    'and the segment nothing changed on keeps exactly the keys it arrived with',
  );
  eq(out.segments[1], minimal.segments[1], 'with exactly the values it arrived with');

  // The third state of the round-trip contract, which the urban export is where
  // it is reachable from an editor and this export shares the rule for: a row
  // value of null is the analyst clearing the key, so the key leaves the export
  // rather than falling back to what the fixture stated. Nothing in the Chapter
  // 15 derivation produces a null today (it fills every key structurally, and
  // the segment table refuses a non-finite edit), so this is checked against the
  // export directly. It is what keeps the rule shared if this schema ever grows
  // an optional control of its own.
  const rows = derive(fromTwoLaneFixture(minimal, 'minimal.json')).rows;
  const withCleared = toTwoLaneFixture(doc, [{ ...rows[0], spl: null }, rows[1]]);
  ok(!('spl' in withCleared.segments[0]), 'a null row value clears the key out of the two-lane export');
  eq(withCleared.segments[1], minimal.segments[1], 'and reaches no other segment');
}

{
  // The carried/dropped honesty. Chapter 15's segment schema is twenty keys and
  // the derivation fills all twenty, so nothing is dropped, and the export from
  // a facility built out of features is the full schema rather than a subset.
  const doc = loadTwoLaneExample('ch26ep3');
  const out = toTwoLaneFixture(doc, derive(doc).rows);
  eq(
    Object.keys(out.segments[0]).sort(),
    [...TWOLANE_SEGMENT_KEYS].sort(),
    'a built facility exports every key of the Chapter 15 segment schema',
  );
  eq(
    Object.keys(out)
      .filter((k) => k !== 'segments')
      .sort(),
    ['apd', 'l_de', 'lane_width', 'pmhvfl', 'shoulder_width'],
    'and exactly the five facility-level arguments',
  );
}

// ── The document, its version and its period pinning ────────────────────

{
  eq(DOC_VERSION, 4, 'the document format is at v4, which added the two-lane facility type');
  const doc = emptyDocument('twolane');
  eq(doc.periods, 1, 'a two-lane document has one period, because Chapter 15 is single-period');
  setPeriods(doc, 6);
  eq(doc.periods, 1, 'and the period count is pinned rather than clamped, since there is no axis to grow');

  // A v3 document still migrates, which is what makes the version bump safe.
  const v3 = { ...emptyDocument('urban'), version: 3 };
  eq(migrate(JSON.parse(JSON.stringify(v3))).version, 4, 'a v3 urban document migrates to v4');
  throws(
    () => migrate({ version: 4, facilityType: 'monorail' }),
    'unsupported facility type',
    'an unknown facility type is still refused',
  );

  // Early urban builds offered "TwoWayStop", which is not a
  // BoundaryControlType serde variant; a stored draft carrying it maps to
  // Uncontrolled (the variant whose own doc covers the TWSC through
  // movement), on the signal config and on a seg_type override alike.
  {
    const legacy = { ...emptyDocument('urban'), version: 3 };
    legacy.features = [{ id: 's1', kind: 'signal', stationFt: 1000, config: { control: 'TwoWayStop' } }];
    legacy.overrides = { 'gap:start': { fields: { seg_type: 'TwoWayStop' }, appliedTo: 'Uncontrolled' } };
    const up2 = migrate(JSON.parse(JSON.stringify(legacy)));
    eq(up2.features[0].config.control, 'Uncontrolled', 'a legacy TwoWayStop signal maps to Uncontrolled');
    eq(up2.overrides['gap:start'].fields.seg_type, 'Uncontrolled', 'and so does a legacy seg_type override');
  }

  // makeFeature produces the four kinds with the shapes the derivation reads.
  for (const kind of ['grade', 'passing', 'curve', 'demand']) {
    const f = makeFeature(doc, kind, 1000);
    eq(f.kind, kind, `makeFeature builds a ${kind}`);
    ok(f.id.length > 0, `and gives the ${kind} an id`);
    if (kind === 'demand') ok(f.endFt === undefined, 'a demand change is a point, so it has no end');
    else ok(f.endFt > f.stationFt, `a ${kind} is an interval, so it has an end past its start`);
  }
  eq(
    makeFeature(doc, 'curve', 1000).endFt - 1000,
    400,
    'a new curve is 400 ft rather than a mile, because a mile-long curve is not a thing Exhibit 15-22 describes',
  );
}

// ── Validation: what the engine cannot survive, and what it mis-handles ──

{
  // Both of these are engine defects reachable from this editor, and both are
  // blocking rather than advisory.
  const first = highway(3 * MI, [passing('ps1', 0, 1, 2)]);
  const df = derive(first);
  ok(
    df.errors.some((e) => /first segment is a passing lane/.test(e)),
    'a passing lane as the first segment is refused, because Step 9 measures from the segment above it and there is none',
  );
  ok(blockingOf(first).length > 0, 'and it blocks the analysis');

  const two = highway(6 * MI, [passing('ps1', 1, 2, 2), passing('ps2', 4, 5, 2)]);
  const dt = derive(two);
  ok(
    dt.errors.some((e) => /2 passing lanes/.test(e)),
    'two passing lanes are refused, because this engine measures from the LAST one rather than the closest upstream',
  );
  ok(blockingOf(two).length > 0, 'and that blocks too');

  const one = highway(6 * MI, [passing('ps1', 1, 2, 2)]);
  eq(
    blockingOf(one).map((f) => f.id),
    [],
    'one passing lane, not first, is fine',
  );
}

{
  // Overlaps, which the derivation resolves rather than throwing away, and
  // says so.
  const doc = highway(6 * MI, [passing('ps1', 1, 3, 1), passing('ps2', 2, 4, 2)]);
  const d = derive(doc);
  ok(
    d.errors.some((e) => /overlap/.test(e)),
    'overlapping passing features are reported',
  );
  ok(
    d.rows.some((r) => r.passing_type === 2),
    'and the overlap resolves to the more permissive of the two',
  );
}

{
  // The unit traps, as warnings rather than errors, because each one is a
  // value the engine accepts and analyzes.
  const frac = highway(2 * MI, [demand('dm1', 0, { heavyVehiclePct: 0.05 })]);
  ok(flagIds(frac).includes('phv-looks-fractional'), 'a fractional heavy-vehicle percentage is flagged');
  const pct = highway(2 * MI, [demand('dm1', 0, { heavyVehiclePct: 5 })]);
  ok(!flagIds(pct).includes('phv-looks-fractional'), 'and 5 is not, which is the control');

  const ffs = highway(2 * MI, [demand('dm1', 0, { speedLimitMph: 75 })]);
  ok(
    flagIds(ffs).includes('spl-looks-like-ffs'),
    'a posted limit high enough to be a free-flow speed is flagged, because BFFS is 1.14 x it',
  );

  const wide = emptyDocument('twolane');
  wide.mainline.laneWidthFt = 14;
  ok(flagIds(wide).includes('lane-width-range'), 'a lane width outside Exhibit 15-8 is flagged');

  const supEle = highway(2 * MI, [curve('hc1', 100, 200, 500, 0.04)]);
  ok(flagIds(supEle).includes('superelevation-looks-fractional'), 'a fractional superelevation is flagged');

  const noRadius = highway(2 * MI, [curve('hc1', 100, 200, 0, 2)]);
  ok(
    flagIds(noRadius).includes('curve-no-radius'),
    'a curve with no radius is flagged, because Step 5d treats it as a tangent',
  );
}

{
  // A feature that reaches nothing, for each of the three interval kinds. All
  // three are drawn on the strip either way, so the silence is what costs.
  for (const [kind, f] of [
    ['passing', passing('ps1', 3, 4, 2)],
    ['grade', grade('gr1', 3, 4, 5, 3)],
    ['curve', curve('hc1', 3 * MI, 400, 600, 2)],
  ]) {
    const doc = highway(2 * MI, [f]);
    ok(flagIds(doc).includes('feature-outside'), `a ${kind} past the end of the highway is flagged`);
    const inside = highway(6 * MI, [f]);
    ok(!flagIds(inside).includes('feature-outside'), `and one inside it is not, which is the control for ${kind}`);
  }

  // Sub-foot: it survives the derivation's own degeneracy check, because that
  // works in real feet, and then both of its ends round to the same boundary.
  const tiny = highway(2 * MI, [{ ...curve('hc1', 100.6, 0.8, 600, 2) }]);
  eq(derive(tiny).errors, [], 'a sub-foot interval is not a derivation error');
  ok(flagIds(tiny).includes('feature-sub-foot'), 'but it is flagged, because it bounds nothing');
  const notTiny = highway(2 * MI, [curve('hc1', 100, 200, 600, 2)]);
  ok(!flagIds(notTiny).includes('feature-sub-foot'), 'and a real one is not');
}

{
  // The two notes that are always there, because both are properties of the
  // chapter rather than of a facility.
  const ids = flagIds(emptyDocument('twolane'));
  ok(ids.includes('no-reliability'), 'the panel says Chapter 15 has no reliability methodology');
  ok(
    ids.includes('intersections-not-modelled'),
    'and that a segment cannot contain a signal, all-way stop or roundabout, which this builder cannot check',
  );
}

// ── The discussion generator ────────────────────────────────────────────

{
  const doc = loadTwoLaneExample('ch26ep4');
  const run = analyzeTwoLaneFacility(doc, derive(doc).rows, wasm);
  const lines = twoLaneDiscussion(run);
  ok(lines.length >= 6, 'the discussion says several things about a passing-lane facility');
  ok(
    lines.every((l) => typeof l === 'string' && l.length > 0),
    'and none of them is empty',
  );
  ok(
    lines.some((l) => l.includes('LOS E')),
    'it names the facility letter',
  );
  ok(
    lines.some((l) => /POSTED/.test(l) && /55/.test(l)),
    'it says the letter is read against the posted limit rather than the speed achieved',
  );
  ok(
    lines.some((l) => /MIDPOINT/.test(l)),
    "it says a passing lane's column is the midpoint value",
  );
  ok(
    lines.some((l) => /Step 9/.test(l)),
    'it names which segments the passing lane reached',
  );
  ok(
    lines.some((l) => /subsegment/.test(l)),
    'it says the curves are subsegments rather than rows',
  );
  ok(
    lines.some((l) => /no travel time reliability/.test(l)),
    'and it closes on the absence Chapter 15 has and the other two chapters do not',
  );
  eq(twoLaneDiscussion(null), [], 'no result, no discussion');

  const demoted = highway(3 * MI, [passing('ps1', 1, 1.3, 2)]);
  const rd = analyzeTwoLaneFacility(demoted, derive(demoted).rows, wasm);
  ok(
    twoLaneDiscussion(rd).some((l) => /Exhibit 15-10 minimum/.test(l)),
    'a demoted passing lane is named in the discussion rather than only in the row',
  );
}

// ── The result view's measures ──────────────────────────────────────────

{
  const doc = loadTwoLaneExample('ch26ep3');
  const run = analyzeTwoLaneFacility(doc, derive(doc).rows, wasm);
  eq(
    TWOLANE_MEASURES.map((m) => m.id),
    ['los', 'followerDensity', 'avgSpeed', 'percentFollowers', 'ffs'],
    'the selector offers the five measures a Chapter 15 result has',
  );
  for (const m of TWOLANE_MEASURES) {
    ok(
      run.segments.every((s) => s[m.key] != null),
      `every segment carries ${m.id}, so no cell is blank`,
    );
    ok(m.note.length > 20, `${m.id} says what it is`);
  }
  eq(twoLaneMeasureById('nope').id, 'los', 'an unknown measure id falls back to LOS');
  const fd = twoLaneMeasureById('followerDensity');
  const dom = domainOf([run.segments.map((s) => s.followerDensity)]);
  ok(dom.lo < dom.hi, 'the follower-density domain spans the facility');
  eq(
    cellText(fd, run.segments[0].followerDensity),
    run.segments[0].followerDensity.toFixed(2),
    'and every cell prints its own value, so the grid survives a greyscale print',
  );
  // Speed is inverted so the deep cells are the poor ones on every measure.
  ok(twoLaneMeasureById('avgSpeed').invert === true, 'average speed is inverted');
  ok(twoLaneMeasureById('followerDensity').invert === false, 'and follower density is not');
}

// ── The chassis dispatcher ──────────────────────────────────────────────

{
  // deriveRows routes a two-lane document without an api, since the derivation
  // calls no engine function. Passing null proves it.
  const doc = loadTwoLaneExample('ch26ep3');
  eq(deriveRows(doc, null).rows.length, 5, 'deriveRows routes a two-lane document with no wasm api at all');
  throws(() => analyzeTwoLaneFacility(doc, [], wasm), 'no segments', 'analyzing an empty highway is refused');
}

if (failures.length) {
  console.log(`FAIL  builder two-lane  (${failures.length}/${checks} checks failed)`);
  for (const f of failures) console.log(`      ${f}`);
  process.exitCode = 1;
} else {
  console.log(`OK    builder two-lane  (${checks} checks)`);
}
