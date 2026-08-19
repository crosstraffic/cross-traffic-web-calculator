// Urban street checks for the facility builder, in the idiom of
// tests/boundary and tests/builder: plain node, no runner, nonzero exit on
// failure. Run with `npm run test:builder`.
//
// Three separate claims are being checked here and they fail in different ways.
//
// 1. The derivation. Boundary signals partition the street into Chapter 18
//    segments, each reading its timing off the signal at its downstream end.
//    The edge cases are the ones a structural rule gets wrong quietly: two
//    signals at one station, an access point exactly on a boundary, a terminus
//    with no signal on it.
// 2. The published values. The Chapter 29 Example Problem 1 reconstruction has
//    to reproduce what tests/boundary/ch16_urban_facilities.mjs pins, and the
//    Chapter 30 Example Problem 1 reconstruction likewise, through the SAME
//    engine calls the page makes. A builder that reproduced the boundary by a
//    different route could be green here and wrong on the page.
// 3. The fixture round trip. An untouched import has to re-export to the file
//    it came from, byte for byte, which is what makes the "an urban fixture is
//    invertible" claim in fixture.js a fact rather than an assertion.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// The sibling library's fixtures; tests/libCases.mjs resolves the checkout and
// says why that is not a one-line join.
import { readCase } from '../libCases.mjs';

import { deriveRows } from '../../src/lib/builder/derive.js';
import { emptyDocument, makeFeature, migrate, setPeriods, DOC_VERSION } from '../../src/lib/builder/document.js';
import { loadUrbanExample, URBAN_EXAMPLES } from '../../src/lib/builder/urbanExamples.js';
import { fromUrbanFixture, toUrbanFixture } from '../../src/lib/builder/fixture.js';
import { validateFacility } from '../../src/lib/builder/validate.js';
import { analyzeUrbanFacility, segmentConfig } from '../../src/lib/builder/urbanAnalyze.js';
import {
	analyzeUrbanReliability,
	defaultUrbanReliabilityInputs,
	defaultUrbanWeather,
	urbanHandoffNotes
} from '../../src/lib/builder/urbanReliability.js';
import { urbanDiscussion, urbanReliabilityDiscussion } from '../../src/lib/builder/urbanDiscussion.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, '..', '..', 'HCM-middleware', 'pkg');

const wasm = await import(join(pkgDir, 'HCM_middleware.js'));
await wasm.default(readFileSync(join(pkgDir, 'HCM_middleware_bg.wasm')));

const loadCase = (name) => readCase('UrbanFacilities', name);

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

const derive = (doc) => deriveRows(doc, null);
const lengths = (doc) => derive(doc).rows.map((r) => r.segment_length_ft);
const flagIds = (doc) => {
	const d = derive(doc);
	return validateFacility(doc, d.rows, d.errors).map((f) => f.id);
};

/** A street with signals at the given stations and nothing else. */
function street(stations, lengthFt = stations[stations.length - 1]) {
	const doc = emptyDocument('urban');
	doc.mainline.lengthFt = lengthFt;
	for (const st of stations) doc.features.push(makeFeature(doc, 'signal', st));
	return doc;
}

// ── 1. The derivation ───────────────────────────────────────────────────

{
	// The plain case: N signals spanning the street give N-1 segments.
	const doc = street([0, 1320, 2640, 3960, 4620, 5280]);
	eq(lengths(doc), [1320, 1320, 1320, 660, 660], 'signals at their stations give the segments between them');
	eq(derive(doc).errors, [], 'a fully signalized street derives without errors');
}

{
	// The termini are boundary intersections whether or not a signal sits on
	// them, so an interior-only signal set still produces the two end segments.
	const doc = street([2000], 5000);
	eq(lengths(doc), [2000, 3000], 'the two termini bound the street even with one interior signal');
	ok(
		derive(doc).errors.some((e) => e.includes('no signal on it')),
		'a terminus with no signal is reported, because Chapter 18 has no timing for it'
	);
	ok(flagIds(doc).includes('derivation'), 'that derivation error blocks the analysis');
}

{
	// Each segment reads the signal at its DOWNSTREAM end, which is the whole
	// point of the rule and the thing most worth pinning: giving two signals
	// different cycle lengths must move the second segment, not the first.
	const doc = street([0, 1000, 2000]);
	const sigs = doc.features.filter((f) => f.kind === 'signal');
	sigs[1].config.cycle_length_s = 60;
	sigs[2].config.cycle_length_s = 140;
	eq(derive(doc).rows.map((r) => r.cycle_length_s), [60, 140], 'a segment takes its timing from its downstream signal');
	// The upstream intersection's width goes the other way.
	sigs[0].config.width_ft = 88;
	sigs[1].config.width_ft = 44;
	eq(
		derive(doc).rows.map((r) => r.upstream_intersection_width_ft),
		[88, 44],
		'a segment takes its upstream intersection width from its upstream signal'
	);
}

{
	// Adjacent signals: two at the same station collapse to one boundary, so the
	// segment between them never existed. Dropping one silently is the failure.
	const doc = street([0, 1000, 1000, 2000]);
	eq(lengths(doc), [1000, 1000], 'two signals at one station make one boundary, not a zero-length segment');
	ok(
		derive(doc).errors.some((e) => e.includes('same station')),
		'the collapsed pair is reported rather than silently dropped'
	);
}

{
	// An access point exactly on a boundary belongs to the segment UPSTREAM of
	// it, because that boundary is that segment's downstream end.
	const doc = street([0, 1000, 2000]);
	doc.features.push({ ...makeFeature(doc, 'access_point', 1000), side: 'subject' });
	eq(derive(doc).rows.map((r) => r.n_access_points_subject), [1, 0], 'an access point on a boundary counts to the segment upstream of it');

	// One at station 0 belongs to the first segment, since no segment ends there.
	const doc2 = street([0, 1000, 2000]);
	doc2.features.push({ ...makeFeature(doc2, 'access_point', 0), side: 'subject' });
	eq(derive(doc2).rows.map((r) => r.n_access_points_subject), [1, 0], 'an access point on the upstream terminus counts to the first segment');

	// Every point lands in exactly one segment. The bounds are complementary
	// rather than both tolerant, so a point cannot be counted twice; the engine
	// would take a double count as a real second driveway.
	const doc3 = street([0, 1000, 2000, 3000]);
	for (const st of [0, 1, 999, 1000, 1001, 1999, 2000, 2001, 2999, 3000]) {
		doc3.features.push({ ...makeFeature(doc3, 'access_point', st), side: 'subject' });
	}
	const counts = derive(doc3).rows.map((r) => r.n_access_points_subject);
	eq(counts.reduce((a, b) => a + b, 0), 10, 'every access point lands in exactly one segment, none dropped and none doubled');
	eq(counts, [4, 3, 3], 'and they land in the segment whose downstream boundary they sit at or before');
}

{
	// A signal outside the street is clamped for the derivation and warned about
	// rather than silently bounding a segment somewhere it does not sit.
	const doc = street([0, 1000], 1000);
	doc.features.push(makeFeature(doc, 'signal', 5000));
	ok(flagIds(doc).includes('signal-outside'), 'a signal past the downstream terminus is flagged');
}

{
	// Subject and opposing points are two different counts, because Exhibit 18-11
	// note c reads them separately.
	const doc = street([0, 2000]);
	doc.features.push({ ...makeFeature(doc, 'access_point', 500), side: 'subject' });
	doc.features.push({ ...makeFeature(doc, 'access_point', 900), side: 'opposing' });
	doc.features.push({ ...makeFeature(doc, 'access_point', 1400), side: 'opposing' });
	const r = derive(doc).rows[0];
	eq([r.n_access_points_subject, r.n_access_points_opposing], [1, 2], 'subject and opposing access points are counted separately');
}

{
	// The three Equation 18-7 sources, and the order the library picks among
	// them. A point carrying both a delay and an approach must take the delay,
	// because that is what the library does and a builder that guessed the other
	// way would silently analyze a different segment.
	const base = () => {
		const d = street([0, 2000]);
		d.features.push({ ...makeFeature(d, 'access_point', 1000), side: 'subject' });
		return d;
	};
	const planning = base();
	eq(derive(planning).rows[0].apDelaySource, 'planning', 'no delay and no approach falls to the Exhibit 18-13 planning estimate');

	const published = base();
	published.features.at(-1).delayS = 0.2;
	eq(derive(published).rows[0].apDelaySource, 'published', 'a supplied per-point delay takes the published source');
	eq(derive(published).rows[0].access_point_delays_s, [0.2], 'the supplied delay reaches the segment config');

	const computed = base();
	computed.features.at(-1).approach = { v_lt: 1, v_th: 2, v_rt: 3 };
	eq(derive(computed).rows[0].apDelaySource, 'computed', 'an approach alone takes the computed Chapter 30 Section 4 source');
	ok(derive(computed).rows[0].analysis_period_h != null, 'the computed source carries the analysis period the branch reads');

	const both = base();
	both.features.at(-1).delayS = 0.2;
	both.features.at(-1).approach = { v_lt: 1, v_th: 2, v_rt: 3 };
	eq(derive(both).rows[0].apDelaySource, 'published', 'a per-point delay wins over an approach, as the library picks');
	ok(derive(both).rows[0].access_point_approaches == null, 'the losing source is not also sent');

	// An opposing point contributes to the count but never to the delay.
	const opp = street([0, 2000]);
	opp.features.push({ ...makeFeature(opp, 'access_point', 1000), side: 'opposing', delayS: 0.2 });
	eq(derive(opp).rows[0].apDelaySource, 'planning', 'an opposing-side point supplies no delay however it is configured');
}

{
	// A signal may override the mainline's posted limit, which published
	// facilities need: Chapter 29 Example Problem 1 runs 35 mi/h then 30.
	const doc = street([0, 1000, 2000]);
	doc.mainline.speedLimitMph = 35;
	doc.features.filter((f) => f.kind === 'signal')[2].config.speed_limit_mph = 30;
	eq(derive(doc).rows.map((r) => r.speed_limit_mph), [35, 30], 'a signal overrides the mainline speed limit for the segment ending at it');
}

{
	// Signal spacing is the segment length by construction, because both
	// boundaries are intersections. Equation 18-4's f_L reads it.
	const doc = street([0, 1500, 4000]);
	const rows = derive(doc).rows;
	eq(rows.map((r) => r.signal_spacing_ft), rows.map((r) => r.segment_length_ft), 'signal spacing equals the derived segment length');
}

// ── The document model ──────────────────────────────────────────────────

{
	const doc = emptyDocument('urban');
	eq(doc.facilityType, 'urban', 'emptyDocument("urban") makes an urban document');
	eq(doc.periods, 1, 'an urban document has one period');
	// The urban engines have no period axis, so the count is pinned rather than
	// clamped. Accepting a 4 would grow vectors nothing downstream reads.
	eq(setPeriods(doc, 4).periods, 1, 'setPeriods cannot give an urban document a period axis');
	eq(setPeriods(doc, 4).mainline.demand.length, 1, 'and cannot grow its demand vector');

	const freeway = emptyDocument();
	eq(freeway.facilityType, 'freeway', 'emptyDocument() still defaults to freeway');
	eq(setPeriods(freeway, 4).periods, 4, 'and a freeway document still takes a period count');
}

{
	// A v2 document is a valid document at the current version, and an unknown
	// type is still refused rather than half-loaded.
	const v2 = { ...emptyDocument(), version: 2 };
	eq(migrate(v2).version, DOC_VERSION, 'a v2 freeway document migrates to the current version');
	eq(migrate(v2).facilityType, 'freeway', 'and stays a freeway');
	const urban = emptyDocument('urban');
	eq(migrate(JSON.parse(JSON.stringify(urban))).facilityType, 'urban', 'an urban document round-trips through migrate');
	// `twolane` used to be the unshipped type this line proved was refused. Phase
	// 3 shipped it, so the assertion moved to a name no phase will ever claim
	// rather than being deleted: the claim is that an unknown type is refused,
	// and it needs a type that stays unknown.
	throws(() => migrate({ ...urban, facilityType: 'monorail' }), 'unsupported facility type', 'an unshipped facility type is refused');
	eq(migrate({ ...emptyDocument('twolane') }).facilityType, 'twolane', 'and the two-lane type phase 3 shipped is accepted');
}

// ── Validation ──────────────────────────────────────────────────────────

{
	const bare = emptyDocument('urban');
	const ids = flagIds(bare);
	ok(ids.includes('too-few-signals'), 'a street with no signals is flagged as un-analyzable');

	const good = street([0, 1000, 2000]);
	ok(!flagIds(good).includes('too-few-signals'), 'a signalized street is not');

	const overGreen = street([0, 1000]);
	overGreen.features[1].config.effective_green_s = 200;
	overGreen.features[1].config.cycle_length_s = 100;
	ok(flagIds(overGreen).includes('green-exceeds-cycle'), 'more effective green than cycle is an error');

	const overCap = street([0, 1000]);
	overCap.features[1].config.through_demand_veh_h = 2000;
	overCap.features[1].config.through_capacity_veh_h = 1000;
	ok(flagIds(overCap).includes('demand-over-capacity'), 'a through v/c above 1 is flagged, since it forces facility LOS F');

	// Measures mode needs the two speeds Equations 16-2 and 16-3 read.
	const measures = street([0, 1000]);
	measures.analysisMode = 'measures';
	measures.features[1].measures = { base_ffs_mph: 40 };
	ok(flagIds(measures).includes('measures-incomplete'), 'a summary segment missing its travel speed is an error');
	ok(flagIds(measures).includes('no-stop-rate'), 'a summary segment missing its stop rate is a warning, since it leaves Equation 16-4 undefined');
}

{
	// The override layer's join between the chassis and the Chapter 18 schema.
	// The chassis reads `length_ft`, `lanes` and `seg_type`; the ENGINE reads
	// `segment_length_ft`, `n_through_lanes` and `control`. A pin that moved only
	// the chassis half changed the table and left the analysis alone, silently.
	const doc = street([0, 1000, 2000]);
	const key = derive(doc).rows[0].key;
	doc.overrides = {
		[key]: { fields: { length_ft: 1500, lanes: 3, seg_type: 'AllWayStop' }, appliedTo: 'Signalized' }
	};
	const r = derive(doc).rows[0];
	eq(r.segment_length_ft, 1500, 'a pinned length reaches the Chapter 18 segment length');
	eq(r.signal_spacing_ft, 1500, 'and the signal spacing Equation 18-4 reads, which is the same distance');
	eq(r.n_through_lanes, 3, 'a pinned lane count reaches the through lanes');
	eq(r.control, 'AllWayStop', 'and a pinned type reaches the boundary control');
	doc.overrides = {};
	eq(derive(doc).rows[0].segment_length_ft, 1000, 'clearing the override restores the derived length');
}

// ── 2. The published values, through the page's own engine calls ────────

{
	// Chapter 30 Example Problem 1. The geometry route: the full analyze()
	// pipeline, Chapter 18 per segment then Chapter 16. Values are the ones
	// tests/boundary/ch16_urban_facilities.mjs pins for case3 full geometry.
	const doc = loadUrbanExample('ch30ep1');
	const d = derive(doc);
	eq(d.errors, [], 'Chapter 30 EP1 derives without errors');
	eq(lengths(doc), [1800, 1800, 1800], 'Chapter 30 EP1 derives three 1,800 ft segments');
	eq(d.rows.map((r) => r.apDelaySource), ['published', 'published', 'published'], 'its access points supply the Exhibit 30-35 per-point delays');
	eq(d.rows.map((r) => [r.n_access_points_subject, r.n_access_points_opposing]), [[4, 4], [4, 4], [4, 4]], 'and N_ap,s = N_ap,o = 4 per segment');

	const run = analyzeUrbanFacility(doc, d.rows, wasm);
	eq(run.mode, 'inputs', 'Chapter 30 EP1 runs the inputs path');
	eq(run.los, 'C', 'Chapter 30 EP1 facility LOS [Exhibit 16-3]');
	near(run.baseFfs, 40.78, 0.01, 'Chapter 30 EP1 facility base FFS [30-36]');
	near(run.travelSpeed, 23.67, 0.01, 'Chapter 30 EP1 facility travel speed [30-36]');
	near(run.spatialStopRate, 1.61, 0.02, 'Chapter 30 EP1 facility stop rate [30-36]');
	near(run.criticalVcRatio, 0.52, 0.005, 'Chapter 30 EP1 critical v/c (968/1848) [30-36]');
	near(run.perceptionScore, 2.53, 0.01, 'Chapter 30 EP1 perception score [30-36]');
	eq(run.poorestSegmentLos, 'C', 'Chapter 30 EP1 poorest segment LOS');
	eq(run.numPeriods, 1, 'the urban result carries one period, because the engines are single-period');
	ok(Object.isFrozen(run), 'the run is frozen onto the moment it happened');
}

{
	// All three Equation 18-7 access-point delay sources reached through the
	// builder, on the same published facility, so the three are comparable.
	//
	// The numbers are the ones tests/boundary/ch18_urban_segments.mjs pins for
	// the same three paths at segment level, which is the claim: the builder can
	// reach every source the binding exposes, and each lands where the boundary
	// says it should. The planning estimate's 22.55 is the boundary file's own
	// documented default path, and it is 1.1 mi/h off the published travel speed
	// — which is why an example loader that took it would quietly fail to
	// reproduce its own exhibit.
	const approaches = readCase('UrbanSegments', 'case3.json').access_point_approaches;

	const published = loadUrbanExample('ch30ep1');
	const pubRun = analyzeUrbanFacility(published, derive(published).rows, wasm);
	near(pubRun.travelSpeed, 23.67, 0.01, 'published per-point delays reproduce the Exhibit 30-36 travel speed');

	const computed = loadUrbanExample('ch30ep1');
	let k = 0;
	for (const f of computed.features) {
		if (f.kind !== 'access_point' || f.side !== 'subject' || f.delayS == null) continue;
		f.approach = { ...approaches[k % approaches.length] };
		f.delayS = null;
		k += 1;
	}
	const compRows = derive(computed).rows;
	eq(compRows[0].apDelaySource, 'computed', 'swapping delays for approaches takes the computed source');
	eq(compRows[0].access_point_approaches.length, 2, 'and sends both approaches');
	const compRun = analyzeUrbanFacility(computed, compRows, wasm);
	near(compRun.travelSpeed, 23.67, 0.01, 'the computed Chapter 30 Section 4 procedure reproduces the same published travel speed');
	near(compRun.travelSpeed, pubRun.travelSpeed, 0.005, 'computed and supplied agree to the rounding of the published per-point values they share');

	const planning = loadUrbanExample('ch30ep1');
	for (const f of planning.features) {
		if (f.kind !== 'access_point') continue;
		f.delayS = null;
		f.approach = null;
	}
	const planRows = derive(planning).rows;
	eq(planRows[0].apDelaySource, 'planning', 'stripping both sources falls to the Exhibit 18-13 planning estimate');
	ok(planRows[0].access_point_delays_s == null && planRows[0].access_point_approaches == null, 'and sends neither of the other two');
	const planRun = analyzeUrbanFacility(planning, planRows, wasm);
	near(planRun.travelSpeed, 22.55, 0.05, 'the planning estimate lands on the boundary file\'s documented default path');
	ok(planRun.travelSpeed < pubRun.travelSpeed - 1.0, 'and misses the published travel speed by over 1 mi/h, which is why the loaders supply a real source');

	// The Exhibit 18-13 parameters themselves, which the builder had no editor
	// for until now. They are what separates the two planning numbers the ch18
	// boundary file pins: 22.55 mi/h is the estimate at its defaults, N_ap = 8
	// from the raw driveway counts and the exhibit's own 10%/10% turn split;
	// 23.60 is the same estimate given the segment's 2 influential approaches and
	// the 6.5%/8.1% the Exhibit 30-35 volumes imply. Both are values this engine
	// computes rather than values Chapter 30 publishes, and the published 23.67
	// above is reached by a different source entirely.
	const tuned = loadUrbanExample('ch30ep1');
	for (const f of tuned.features) {
		if (f.kind === 'access_point') {
			f.delayS = null;
			f.approach = null;
			continue;
		}
		// Station 0 terminates no segment, so its parameters would reach nothing
		// and setting them would prove nothing.
		if (f.stationFt === 0) continue;
		Object.assign(f.config, {
			n_influential_access_points: 2,
			pct_left_turns_access: 6.5,
			pct_right_turns_access: 8.1
		});
	}
	const tunedRows = derive(tuned).rows;
	eq(tunedRows[0].apDelaySource, 'planning', 'the tuned facility is still on the planning source');
	eq(
		tunedRows.map((r) => [r.n_influential_access_points, r.pct_left_turns_access, r.pct_right_turns_access]),
		[[2, 6.5, 8.1], [2, 6.5, 8.1], [2, 6.5, 8.1]],
		'and every derived row carries the three parameters off the signal that terminates it'
	);
	const tunedRun = analyzeUrbanFacility(tuned, tunedRows, wasm);
	near(tunedRun.travelSpeed, 23.60, 0.05, 'the Exhibit 18-13 parameters move the planning estimate to the ch18 boundary file\'s case2 value');
	ok(tunedRun.travelSpeed > planRun.travelSpeed + 1.0, 'which is over 1 mi/h above the same facility left at the exhibit defaults');

	// A bay of adequate length halves the per-point delay and two take it to
	// zero, so the two flags have to be reachable and have to be distinguishable
	// from "unset". A control on the strongest of the five: with both bays the
	// access-point delay term vanishes and the travel speed rises again.
	const bays = loadUrbanExample('ch30ep1');
	for (const f of bays.features) {
		if (f.kind === 'access_point') {
			f.delayS = null;
			f.approach = null;
		} else if (f.stationFt !== 0) {
			Object.assign(f.config, { access_left_bay_adequate: true, access_right_bay_adequate: true });
		}
	}
	const bayRun = analyzeUrbanFacility(bays, derive(bays).rows, wasm);
	ok(bayRun.travelSpeed > planRun.travelSpeed, 'two adequate turn bays take the Exhibit 18-13 delay to zero and raise the travel speed');

	// The five are optional, so a facility nobody touched exports exactly what it
	// did before they existed. This is the claim that adding them cost the
	// round trip nothing.
	//
	// ABSENT rather than merely blank, which is the distinction the export's
	// round-trip contract rests on: `undefined` is "never touched" and `null` is
	// "the analyst cleared it", and the two export differently. A default of null
	// would satisfy "blank" and would tell the export that every new signal had
	// had all five cleared.
	const untouched = loadUrbanExample('ch30ep1');
	const untouchedRows = derive(untouched).rows;
	const planningKeys = [
		'n_influential_access_points',
		'pct_left_turns_access',
		'pct_right_turns_access',
		'access_left_bay_adequate',
		'access_right_bay_adequate'
	];
	ok(
		untouchedRows.every((r) => planningKeys.every((k) => r[k] === undefined && !(k in r))),
		'an untouched facility carries none of the five, so a blank field stays the engine\'s own default'
	);

	// And a cleared one is null on the row rather than undefined, which is the
	// other half of the same distinction. Both analyze identically; only the
	// export tells them apart.
	const cleared = loadUrbanExample('ch30ep1');
	for (const f of cleared.features) {
		if (f.kind !== 'signal' || f.stationFt === 0) continue;
		f.config.n_influential_access_points = 2;
		f.config.full_stop_rate_override = null;
	}
	const clearedRows = derive(cleared).rows;
	ok(
		clearedRows.every((r) => r.full_stop_rate_override === null && r.n_influential_access_points === 2),
		'a cleared optional input reaches the row as null, distinct from an untouched one'
	);
	eq(
		segmentConfig(clearedRows[0]).full_stop_rate_override,
		undefined,
		'and the engine config drops it, so a cleared field analyzes as cleared'
	);
}

{
	// Chapter 29 Example Problem 1, both directions. The summary route:
	// published Chapter 18 measures, aggregate() only. The three exact published
	// values and the two documented fixture artifacts are pinned together, at the
	// boundary suite's own numbers.
	for (const [id, tag, speed, published, stopRate] of [
		['ch29ep1eb', 'EB', 22.13, 22.6, 1.95],
		['ch29ep1wb', 'WB', 21.54, 22.2, 2.14]
	]) {
		const doc = loadUrbanExample(id);
		const d = derive(doc);
		eq(d.errors, [], `Chapter 29 EP1 ${tag} derives without errors`);
		eq(lengths(doc), [1320, 1320, 1320, 660, 660], `Chapter 29 EP1 ${tag} derives its five published segment lengths`);

		const run = analyzeUrbanFacility(doc, d.rows, wasm);
		eq(run.mode, 'measures', `Chapter 29 EP1 ${tag} runs the measures path`);
		// The three the chapter publishes and the aggregation reproduces exactly.
		eq(run.los, 'C', `Chapter 29 EP1 ${tag} facility LOS [29-49]`);
		near(run.baseFfs, 40.1, 0.05, `Chapter 29 EP1 ${tag} facility base FFS (Equation 16-2) [29-49]`);
		eq(run.poorestSegmentLos, 'D', `Chapter 29 EP1 ${tag} poorest-performing segment LOS [29-49]`);
		// The documented fixture artifact. Chapter 29 publishes per-segment
		// measures only for Segments 1 and 5, and the fixture copies those into
		// the unpublished Segments 2 through 4, which is what moves the facility
		// travel speed off the published value. The computed value is pinned
		// tight so the aggregation cannot drift, and the published band is
		// asserted beside it, exactly as the boundary suite does.
		near(run.travelSpeed, speed, 0.05, `Chapter 29 EP1 ${tag} travel speed (computed; published ${published})`);
		near(run.travelSpeed, published, tag === 'EB' ? 0.6 : 0.8, `Chapter 29 EP1 ${tag} travel speed within the published band [29-49]`);
		near(run.spatialStopRate, stopRate, 0.05, `Chapter 29 EP1 ${tag} stop rate (computed, from the copied segments)`);
	}
}

{
	// Which signal edits actually reach the Chapter 16 result, and which do not.
	//
	// This is the check that stops the editor from being a row of fields that
	// look connected. On the Chapter 30 EP1 segment the through control delay is
	// a SUPPLIED input (Exhibit 30-36 gives it) and the full stop rate is
	// overridden, so the effective green feeds nothing: Equation 18-9's
	// proportion arriving on green reaches the stop rate, and the stop rate is
	// overridden. Editing the green therefore moves nothing at all here, which
	// is a real property of the method and not a wiring bug. It still matters
	// for the Chapter 17 handoff, where the engine recomputes the delay itself.
	const run = (mutate) => {
		const doc = loadUrbanExample('ch30ep1');
		for (const f of doc.features) if (f.kind === 'signal') mutate(f.config);
		return analyzeUrbanFacility(doc, derive(doc).rows, wasm);
	};
	const base = run(() => {});

	const green = run((c) => (c.effective_green_s = 20));
	near(green.travelSpeed, base.travelSpeed, 1e-9, 'the effective green is inert when the through delay is supplied and the stop rate overridden');
	near(green.spatialStopRate, base.spatialStopRate, 1e-9, 'and it does not move the stop rate either, since that is overridden too');

	// The controls that do reach it, so the assertion above is a finding rather
	// than a dead editor.
	const delay = run((c) => (c.through_control_delay_s = 60));
	ok(delay.travelSpeed < base.travelSpeed - 5, 'a larger through control delay slows the facility');
	eq(delay.los, 'E', 'and moves it down the Exhibit 16-3 bands');

	const cap = run((c) => (c.through_capacity_veh_h = 900));
	ok(cap.criticalVcRatio > 1.0, 'a capacity below the demand pushes the critical v/c above 1');
	eq(cap.los, 'F', 'which forces facility LOS F by the Exhibit 16-3 footnote, whatever the travel speed');
	near(cap.travelSpeed, base.travelSpeed, 1e-9, 'and it does so without changing the travel speed at all');
}

{
	// The refusal is a property of the engine and worth pinning here too: a
	// facility of published measures cannot be re-run through Chapter 18,
	// because there are no inputs behind them.
	const doc = loadUrbanExample('ch29ep1eb');
	const rows = derive(doc).rows;
	const fac = new wasm.WasmUrbanFacility(doc.mainline.propLeftTurnLanes);
	for (const r of rows) fac.add_segment_from_config(segmentConfig(r, { measures: true }));
	throws(() => fac.analyze(), '', 'analyze() refuses a facility built from published measures');
	eq(fac.aggregate(), 'C', 'aggregate() is the entry point for it');
}

{
	// The config handed to the engine is the serde schema and nothing else.
	// `add_segment_from_config` ignores unknown fields silently, so a bookkeeping
	// key leaking through would not throw, it would just sit there; the guard is
	// that it never leaves this function.
	const doc = loadUrbanExample('ch30ep1');
	const cfg = segmentConfig(derive(doc).rows[0]);
	for (const k of ['key', 'startFt', 'why', 'sourceIds', 'overridden', 'staleOverride', 'apDelaySource', 'seg_type', 'lanes', 'length_ft']) {
		ok(!(k in cfg), `the engine config carries no bookkeeping key "${k}"`);
	}
	ok('segment_length_ft' in cfg && 'control' in cfg, 'and does carry the schema keys');
}

// ── 3. The fixture round trip ───────────────────────────────────────────

for (const name of ['case1.json', 'case2.json', 'case3.json']) {
	const raw = loadCase(name);
	const doc = fromUrbanFixture(raw, name);
	const d = derive(doc);
	eq(d.errors, [], `${name} imports and derives without errors`);
	eq(d.rows.length, raw.segments.length, `${name} recovers one segment per fixture segment`);
	eq(lengths(doc), raw.segments.map((s) => s.segment_length_ft), `${name} recovers the fixture's segment lengths`);
	// N segments give N+1 boundary intersections. That is the invertibility the
	// whole urban import rests on.
	eq(
		doc.features.filter((f) => f.kind === 'signal').length,
		raw.segments.length + 1,
		`${name} recovers N+1 boundary signals from N segments`
	);
	eq(
		JSON.stringify(toUrbanFixture(doc, d.rows)),
		JSON.stringify(raw),
		`${name} re-exports byte-identically when untouched`
	);

	// A control on that round trip: it has to be able to see a change. Without
	// this the byte-identity above would also pass if the export ignored the
	// document entirely.
	const edited = fromUrbanFixture(raw, name);
	const sig = edited.features.filter((f) => f.kind === 'signal').at(-1);
	sig.config.through_demand_veh_h = (sig.config.through_demand_veh_h ?? 0) + 111;
	ok(
		JSON.stringify(toUrbanFixture(edited, derive(edited).rows)) !== JSON.stringify(raw),
		`${name} re-exports differently once a signal is edited`
	);
}

// ── 3b. The round-trip contract: absent, cleared, changed ───────────────
//
// The three states a key can be in on its way back out, checked per affected
// field class. The middle one is the fix: `merged[k] = r[k] ?? orig[k]` read a
// cleared field as untouched, so a field the analyst had cleared analyzed as
// cleared and exported as the value the fixture was imported with, and the
// document and its export disagreed about the facility. The first state is the
// half that must NOT move, and it is pinned byte-for-byte above.

{
	/** The signal that terminates segment `i` of an imported urban fixture. */
	const terminator = (doc, i) => doc.features.filter((f) => f.kind === 'signal')[i + 1];

	// Chapter 30 Example Problem 1, which states `full_stop_rate_override` on
	// every segment. One of the four phase-2 optional inputs, on a fixture that
	// actually carries it, so clearing it has something to remove.
	{
		const raw = loadCase('case3.json');
		const doc = fromUrbanFixture(raw, 'case3');
		ok('full_stop_rate_override' in raw.segments[0], 'case3 states the field being cleared');
		terminator(doc, 0).config.full_stop_rate_override = null;
		const out = toUrbanFixture(doc, derive(doc).rows);
		ok(
			!('full_stop_rate_override' in out.segments[0]),
			'a cleared optional urban input is absent from the export rather than exported as the imported value'
		);
		eq(
			out.segments.slice(1).map((s) => s.full_stop_rate_override),
			raw.segments.slice(1).map((s) => s.full_stop_rate_override),
			'and the segments whose signals were not touched keep theirs'
		);
		eq(
			JSON.stringify({ ...out, segments: out.segments.slice(1) }),
			JSON.stringify({ ...raw, segments: raw.segments.slice(1) }),
			'so the clear is the only difference in the whole file'
		);

		// The analysis half of the contract, which is what makes the export half a
		// correction rather than a preference: the cleared facility already ran
		// without the override, and now it exports as a facility that runs without
		// the override.
		const asCleared = JSON.parse(JSON.stringify(raw));
		for (const s of asCleared.segments) delete s.full_stop_rate_override;
		const never = fromUrbanFixture(asCleared, 'never stated');
		eq(
			segmentConfig(derive(doc).rows[0]).full_stop_rate_override,
			segmentConfig(derive(never).rows[0]).full_stop_rate_override,
			'a cleared field and a field the fixture never stated hand the engine the same config'
		);
	}

	// A field set to a NEW value exports the new value, whether or not the fixture
	// stated it. Without this the "absent from the export" check above would also
	// pass if the export had simply stopped writing the field.
	{
		const raw = loadCase('case3.json');
		const doc = fromUrbanFixture(raw, 'case3');
		terminator(doc, 0).config.full_stop_rate_override = 0.42;
		terminator(doc, 0).config.platoon_ratio = 1.333;
		const out = toUrbanFixture(doc, derive(doc).rows);
		eq(out.segments[0].full_stop_rate_override, 0.42, 'a stated field set to a new value exports the new value');
		eq(out.segments[0].platoon_ratio, 1.333, 'and a field the fixture never stated is added once it is set');
		ok(!('platoon_ratio' in out.segments[1]), 'only on the segment whose signal carries it');
	}

	// The five Exhibit 18-13 planning fields, on a fixture that states them. No
	// published case does, so case3 is augmented with them; the point being
	// checked is the merge, and the merge cannot tell where a stated key came
	// from. The boolean is included deliberately: unchecking a bay is the only
	// way the editor can express "clear", so the checkbox and the numeric field
	// have to clear the same way.
	{
		const raw = JSON.parse(JSON.stringify(loadCase('case3.json')));
		Object.assign(raw.segments[0], {
			n_influential_access_points: 2,
			pct_left_turns_access: 6.5,
			pct_right_turns_access: 8.1,
			access_left_bay_adequate: true,
			access_right_bay_adequate: true
		});
		const doc = fromUrbanFixture(raw, 'case3+planning');
		eq(
			JSON.stringify(toUrbanFixture(doc, derive(doc).rows)),
			JSON.stringify(raw),
			'a fixture stating the five planning fields still re-exports byte-identically when untouched'
		);

		const edited = fromUrbanFixture(raw, 'case3+planning');
		terminator(edited, 0).config.n_influential_access_points = null;
		terminator(edited, 0).config.access_left_bay_adequate = null;
		const out = toUrbanFixture(edited, derive(edited).rows);
		ok(!('n_influential_access_points' in out.segments[0]), 'a cleared planning count is absent from the export');
		ok(!('access_left_bay_adequate' in out.segments[0]), 'and so is an unchecked turn bay');
		eq(out.segments[0].pct_left_turns_access, 6.5, 'while the planning fields left alone are untouched');
		eq(out.segments[0].access_right_bay_adequate, true, 'the other bay included');
	}

	// The published measures are the third class of optional key on a signal and
	// they clear through the same path, so they are pinned here rather than left
	// to be discovered.
	{
		const raw = loadCase('case1.json');
		const doc = fromUrbanFixture(raw, 'case1');
		eq(doc.analysisMode, 'measures', 'case1 imports in measures mode');
		terminator(doc, 0).measures.spatial_stop_rate_stops_mi = null;
		const out = toUrbanFixture(doc, derive(doc).rows);
		ok(!('spatial_stop_rate_stops_mi' in out.segments[0]), 'a cleared published measure is absent from the export');
		eq(out.segments[0].travel_speed_mph, raw.segments[0].travel_speed_mph, 'and the measures beside it survive');
	}
}

{
	// The import recovers the analysis mode from what the fixture carries rather
	// than being told, which is what `add_segment_from_config` itself decides on.
	eq(fromUrbanFixture(loadCase('case1.json'), 'c1').analysisMode, 'measures', 'a fixture with published measures imports in measures mode');
	eq(fromUrbanFixture(loadCase('case3.json'), 'c3').analysisMode, 'inputs', 'a fixture with Chapter 18 inputs imports in inputs mode');
	// The upstream terminus signal is marked, because the fixture never recorded
	// its timing and the defaults it carries are not measurements.
	ok(fromUrbanFixture(loadCase('case3.json'), 'c3').features[0].inferred, 'the upstream terminus signal is marked as inferred');
	// An imported urban fixture keeps its feature layer, unlike a freeway one.
	ok(fromUrbanFixture(loadCase('case3.json'), 'c3').importedSegments == null, 'an urban import is not a segments-only document');
	throws(() => fromUrbanFixture({ segments: [] }, 'x'), 'no "segments" array', 'an empty fixture is refused');
}

{
	// An imported fixture reproduces its own published values, which is the
	// claim that matters: the import is not merely reversible, it is correct.
	const doc = fromUrbanFixture(loadCase('case3.json'), 'case3');
	const run = analyzeUrbanFacility(doc, derive(doc).rows, wasm);
	near(run.baseFfs, 40.78, 0.01, 'an imported Chapter 30 EP1 fixture reproduces its base FFS');
	near(run.travelSpeed, 23.67, 0.01, 'an imported Chapter 30 EP1 fixture reproduces its travel speed');
}

// ── The Chapter 17 handoff ──────────────────────────────────────────────

{
	// Example Problem 4 built from signals has to reproduce what
	// tests/boundary/ch17_urban_reliability.mjs pins, which is a stronger claim
	// than "the handoff runs": it says the builder constructs the identical
	// facility the boundary file constructs, argument for argument.
	const doc = loadUrbanExample('ch29ep4');
	const d = derive(doc);
	eq(d.errors, [], 'Chapter 29 EP4 derives without errors');
	eq(lengths(doc), [2640, 2640, 2640, 2640, 2640, 2640], 'Chapter 29 EP4 derives six half-mile segments');

	const rel = analyzeUrbanReliability(doc, d.rows, defaultUrbanReliabilityInputs(), defaultUrbanWeather(), wasm);
	eq(rel.numSegments, 6, 'EP4 segment count');
	eq(rel.numScenarios, 3120, 'EP4 published scenario count (12 periods x 260 weekdays)');
	near(rel.baseFreeFlowTravelTime, 262.9, 10.0, 'EP4 base free-flow travel time [Exhibit 29-73]');
	near(rel.ttiMean, 1.5449, 0.005, 'EP4 mean TTI, matching the boundary suite exactly');
	near(rel.tti80, 1.5927, 0.005, 'EP4 TTI-80, matching the boundary suite');
	near(rel.tti95, 1.7462, 0.005, 'EP4 PTI, matching the boundary suite');
	near(rel.reliabilityRating, 98.83, 0.1, 'EP4 reliability rating, matching the boundary suite');
	eq(rel.numOversaturatedScenarios, 70, 'EP4 oversaturated scenarios, deterministic at seeds 82/11/63');

	// Determinism, which is what makes the pins above meaningful at all.
	const again = analyzeUrbanReliability(doc, d.rows, defaultUrbanReliabilityInputs(), defaultUrbanWeather(), wasm);
	near(again.ttiMean, rel.ttiMean, 1e-12, 'the seeded stream reproduces exactly on a rerun');

	// A control on that determinism: different seeds must actually move it, or
	// the assertion above would pass on an engine that ignored the seeds.
	const other = analyzeUrbanReliability(
		doc, d.rows, { ...defaultUrbanReliabilityInputs(), weatherSeed: 83, demandSeed: 12, incidentSeed: 64 },
		defaultUrbanWeather(), wasm
	);
	ok(other.ttiMean !== rel.ttiMean, 'different seeds give a different stream, so the seeds are read');
	eq(other.numScenarios, rel.numScenarios, 'and the reliability reporting period is unchanged by the seeds');
}

{
	// The handoff notes name what does not cross. The failure this guards is a
	// facility losing a feature silently, so the check is that a facility using
	// a field gets a note and a facility not using it does not.
	const doc = loadUrbanExample('ch30ep1');
	const rows = derive(doc).rows;
	const ids = urbanHandoffNotes(doc, rows).map((n) => n.id);
	ok(ids.includes('unbound-access_point_delays_s'), 'the per-point access-point delays are named as not crossing');
	ok(ids.includes('unbound-through_capacity_veh_h'), 'the through capacity is named as not crossing');
	ok(ids.includes('snowfall'), 'the snowfall note is present, since the engine carries the column and never reads it');
	ok(ids.includes('per-scenario'), 'the per-scenario limitation is stated');
	ok(ids.includes('atdm'), 'the ATDM encoding is stated');
	ok(ids.includes('published-gap'), 'the gap to the published Exhibit 29-73 values is stated');

	// A bare street uses none of those fields, so it must not claim they were
	// dropped. A panel that prints unconditionally is noise rather than honesty.
	const bare = street([0, 2000]);
	bare.features.forEach((f) => {
		f.config.through_capacity_veh_h = null;
		f.config.through_control_delay_s = null;
		f.config.width_ft = null;
	});
	bare.mainline.proportionWithCurb = null;
	bare.mainline.proportionOnStreetParking = null;
	bare.mainline.restrictiveMedianLengthFt = null;
	const bareIds = urbanHandoffNotes(bare, derive(bare).rows).map((n) => n.id);
	ok(!bareIds.includes('unbound-through_capacity_veh_h'), 'a street not carrying a capacity is not told one was dropped');
	ok(!bareIds.includes('unbound-access_point_delays_s'), 'nor one without access-point delays');

	// A measures-mode facility gets the warning that the reliability engine
	// cannot take a supplied travel speed.
	const meas = loadUrbanExample('ch29ep1eb');
	ok(
		urbanHandoffNotes(meas, derive(meas).rows).some((n) => n.id === 'measures-mode'),
		'a measures-mode facility is warned that its measures do not reach the reliability engine'
	);
}

// ── The discussion generators ───────────────────────────────────────────

{
	const doc = loadUrbanExample('ch30ep1');
	const rows = derive(doc).rows;
	const run = analyzeUrbanFacility(doc, rows, wasm);
	const lines = urbanDiscussion(run);
	ok(lines.length >= 4, 'the discussion says several things about an urban run');
	ok(lines.every((l) => typeof l === 'string' && l.length > 0), 'and no line is empty');
	ok(lines.some((l) => l.includes('LOS C')), 'it names the facility letter');
	// The threshold is the ratio rather than the speed, which is the sentence
	// most worth having, so it is pinned rather than left to drift out.
	ok(lines.some((l) => l.includes('%') && l.includes('base free-flow speed')), 'it says the letter comes from the speed as a percentage of the base free-flow speed');
	ok(lines.some((l) => l.includes('per-point values supplied')), 'it names which access-point delay source was used');

	const measRun = analyzeUrbanFacility(loadUrbanExample('ch29ep1eb'), derive(loadUrbanExample('ch29ep1eb')).rows, wasm);
	ok(
		urbanDiscussion(measRun).some((l) => l.includes('published Chapter 18 measures')),
		'a measures-mode run says so, so its speeds are not read as recomputed'
	);
	// The poorest segment is reported separately when it differs, because
	// Chapter 16 Step 4 reports it separately for exactly that reason.
	ok(
		urbanDiscussion(measRun).some((l) => l.includes('poorest-performing segment reads LOS D')),
		'a facility whose poorest segment is worse than its average says so'
	);

	eq(urbanDiscussion(null), [], 'no result, no discussion');
	eq(urbanReliabilityDiscussion(null), [], 'no reliability result, no reliability discussion');
}

// ── The examples all load ───────────────────────────────────────────────

{
	for (const ex of URBAN_EXAMPLES) {
		const doc = loadUrbanExample(ex.id);
		eq(doc.facilityType, 'urban', `${ex.id} builds an urban document`);
		const d = derive(doc);
		eq(d.errors, [], `${ex.id} derives without errors`);
		ok(d.rows.length > 0, `${ex.id} derives at least one segment`);
		const blocking = validateFacility(doc, d.rows, d.errors).filter((f) => f.level === 'error');
		eq(blocking.map((f) => f.id), [], `${ex.id} has no blocking validation flags`);
	}
	throws(() => loadUrbanExample('nope'), 'unknown urban example', 'an unknown example id is refused');
}

if (failures.length) {
	console.log(`FAIL  builder urban  (${failures.length}/${checks} checks failed)`);
	for (const f of failures) console.log(`      ${f}`);
	process.exitCode = 1;
} else {
	console.log(`OK    builder urban  (${checks} checks)`);
}
