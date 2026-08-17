// Analysis checks for the facility builder, in the idiom of tests/boundary and
// of tests/builder/derivation.mjs: plain node, no runner, nonzero exit on
// failure. Run with `npm run test:builder`.
//
// The claim here is stronger than "the analysis runs". The derivation tests
// prove that six placed ramps reproduce Example Problem 1's eleven segments;
// these prove that analyzing those derived segments reproduces the published
// values of the exhibits, through the same construction
// tests/boundary/ch10_freeway_facilities.mjs uses. Together they close the loop
// from a facility an engineer described to numbers the manual prints.
//
// The expected values and tolerances are the boundary file's, not new ones. A
// published number is asserted at its published value; a documented
// reproduction gap is pinned at what this engine computes with the published
// value named alongside, exactly as the boundary file and the Rust tests do.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { deriveRows } from '../../src/lib/builder/derive.js';
import { loadExample } from '../../src/lib/builder/examples.js';
import { emptyDocument } from '../../src/lib/builder/document.js';
import { fromFixture, toFixture } from '../../src/lib/builder/fixture.js';
import { analyzeFacility, unboundFieldsIn } from '../../src/lib/builder/analyze.js';
import { analyzeReliability, defaultReliabilityInputs, handoffNotes } from '../../src/lib/builder/reliability.js';
import { discussion, reliabilityDiscussion } from '../../src/lib/builder/discussion.js';
import { MEASURES, RAMP, domainOf, cellStyle, cellText, rampStep } from '../../src/lib/builder/heatmap.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, '..', '..', 'HCM-middleware', 'pkg');
const LIB_CASES =
	process.env.HCM_LIB_CASES ||
	join(here, '..', '..', '..', 'transportations-library', 'tests', 'ExampleCases', 'hcm');

const wasm = await import(join(pkgDir, 'HCM_middleware.js'));
await wasm.default(readFileSync(join(pkgDir, 'HCM_middleware_bg.wasm')));
const api = {
	segment_ramp_section: wasm.segment_ramp_section,
	ramp_influence_area_ft: wasm.ramp_influence_area_ft
};

const failures = [];
let checks = 0;
function eq(actual, expected, label) {
	checks += 1;
	const a = JSON.stringify(actual);
	const e = JSON.stringify(expected);
	if (a !== e) failures.push(`${label}: got ${a}, expected ${e}`);
}
function ok(cond, label) {
	checks += 1;
	if (!cond) failures.push(label);
}
function approx(actual, expected, tol, label) {
	checks += 1;
	if (!Number.isFinite(actual) || Math.abs(actual - expected) > tol) {
		failures.push(`${label}: got ${actual}, expected ${expected} +-${tol}`);
	}
}
function throws(fn, needle, label) {
	checks += 1;
	try {
		fn();
		failures.push(`${label}: expected a throw, got none`);
	} catch (e) {
		const msg = String(e.message ?? e);
		if (!msg.toLowerCase().includes(needle)) {
			failures.push(`${label}: message "${msg}" does not mention "${needle}"`);
		}
	}
}

/** The path the page takes: document, derived rows, run. */
function run(id, mutate = null) {
	const doc = loadExample(id);
	if (mutate) mutate(doc);
	const { rows, errors } = deriveRows(doc, api);
	eq(errors, [], `${id} derives without errors`);
	return { doc, rows, result: analyzeFacility(doc, rows, wasm) };
}

// ── Example Problem 1: the undersaturated facility ──────────────────────
{
	const { result: r } = run('ep1');
	eq([r.numSegments, r.numPeriods], [11, 5], 'EP1 shape');
	eq(r.oversaturated, false, 'EP1 undersaturated');
	approx(r.totalLengthMi, 6.0, 0.01, 'EP1 facility length (mi)');

	// Exhibit 25-52 totals: 56.9 mi/h, 28.4 veh/mi/ln.
	approx(r.overallSpeed, 56.9, 0.5, 'EP1 overall SMS (Exhibit 25-52)');
	approx(r.overallDensity, 28.4, 0.5, 'EP1 overall density (Exhibit 25-52)');

	// Facility performance summary (Exhibit 25-52), all five periods.
	[
		[57.6, 27.5, 'D'],
		[56.6, 31.3, 'D'],
		[55.0, 34.8, 'E'],
		[57.9, 27.5, 'D'],
		[58.4, 21.4, 'C']
	].forEach(([s, k, l], p) => {
		approx(r.perPeriod[p].speed, s, 0.5, `EP1 facility SMS p${p + 1}`);
		approx(r.perPeriod[p].density, k, 0.5, `EP1 facility density p${p + 1}`);
		eq(r.perPeriod[p].los, l, `EP1 facility LOS p${p + 1}`);
	});

	// Segment LOS matrix (Exhibit 25-51), all 55 cells exact. This is the
	// strongest single check that the derived segment table is the published
	// one: a segment of the wrong type, length or lane count moves a letter.
	[
		['C', 'C', 'D', 'C', 'D', 'C', 'D', 'D', 'D', 'D', 'D'],
		['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'E', 'D', 'D'],
		['D', 'D', 'D', 'D', 'D', 'D', 'E', 'E', 'E', 'D', 'E'],
		['D', 'C', 'D', 'C', 'D', 'C', 'D', 'C', 'D', 'D', 'D'],
		['C', 'C', 'C', 'C', 'C', 'B', 'C', 'C', 'C', 'C', 'C']
	].forEach((row, p) =>
		row.forEach((e, i) => eq(r.matrices.los[i][p], e, `EP1 LOS seg ${i + 1} p${p + 1}`))
	);

	// Density matrix (Exhibit 25-50), all 55 cells, +-0.5 veh/mi/ln.
	[
		[25.0, 30.6, 27.6, 29.4, 26.0, 27.2, 27.1, 33.2, 33.2, 31.6, 28.1],
		[27.6, 34.5, 31.2, 32.8, 28.7, 31.3, 31.2, 38.5, 38.5, 36.1, 33.4],
		[29.3, 37.1, 34.1, 35.0, 31.9, 34.6, 35.8, 43.9, 43.9, 42.9, 37.6],
		[26.0, 31.3, 28.1, 30.0, 26.5, 25.8, 26.5, 32.5, 32.5, 31.1, 27.6],
		[21.0, 24.1, 22.0, 23.5, 20.5, 18.9, 21.0, 24.7, 24.7, 23.9, 21.5]
	].forEach((row, p) =>
		row.forEach((e, i) => approx(r.matrices.density[i][p], e, 0.5, `EP1 density seg ${i + 1} p${p + 1}`))
	);

	// Speed matrix (Exhibit 25-49), all 55 cells, +-0.5 mi/h.
	[
		[60.0, 53.9, 59.7, 56.1, 60.0, 48.0, 59.9, 53.4, 53.4, 56.0, 59.7],
		[59.9, 53.2, 58.6, 55.8, 59.6, 46.8, 58.6, 52.3, 52.3, 55.7, 57.6],
		[59.4, 52.6, 57.2, 55.7, 58.3, 46.2, 56.2, 50.6, 50.6, 51.8, 55.1],
		[60.0, 53.8, 59.7, 56.1, 60.0, 49.7, 60.0, 53.6, 53.6, 56.0, 59.9],
		[60.0, 54.9, 59.8, 56.3, 60.0, 52.5, 60.0, 54.8, 54.8, 56.5, 60.0]
	].forEach((row, p) =>
		row.forEach((e, i) => approx(r.matrices.speed[i][p], e, 0.5, `EP1 speed seg ${i + 1} p${p + 1}`))
	);

	// On an undersaturated facility the derived queue lifecycle is empty, which
	// is what the summary panel reads to decide whether to print a queue at all.
	eq([r.firstOversatPeriod, r.firstQueuedPeriod, r.lastQueuedPeriod], [null, null, null], 'EP1 no queue lifecycle');
	eq(r.unboundFields, [], 'EP1 loses nothing at the binding');

	// Every matrix is copied out of the module and the whole result frozen, so a
	// later edit cannot reach into a finished run.
	ok(Object.isFrozen(r) && Object.isFrozen(r.matrices.los) && Object.isFrozen(r.perPeriod[0]), 'the run is frozen');
	throws(() => {
		'use strict';
		r.matrices.los[0][0] = 'A';
	}, 'read only', 'a frozen matrix rejects a write');
}

// ── Example Problem 2: the oversaturated facility ───────────────────────
{
	const { result: r } = run('ep2');
	eq(r.oversaturated, true, 'EP2 oversaturated');

	// `first_oversat_period` has no binding getter, so the builder derives it
	// from the demand-to-capacity matrix. Exhibit 25-55 puts the first ratios
	// above 1.0 in Analysis Period 3 (Segments 8-11 at 1.10), and the queue
	// matrix agrees the first standing queue is in that same period.
	eq(r.firstOversatPeriod, 2, 'EP2 first oversaturated period is period 3 (Exhibit 25-55)');
	eq(r.firstQueuedPeriod, 2, 'EP2 the first standing queue agrees with the ratio test');
	ok(r.lastQueuedPeriod < r.numPeriods - 1, 'EP2 every queue clears before the last period');

	// Demand-to-capacity ratios in period 3 (Exhibit 25-55), +-0.005.
	[0.86, 0.96, 0.96, 0.96, 0.92, 0.85, 0.99, 1.1, 1.1, 1.1, 1.02].forEach((e, i) =>
		approx(r.matrices.dc[i][2], e, 0.005, `EP2 vd/c seg ${i + 1} p3`)
	);

	// Expanded LOS matrix (Exhibit 25-59): periods 1, 2, 3 and 5 whole, then
	// period 4 segments 4 and 6-11. Period-4 segments 1-3 and 5 are the
	// documented queue-redistribution gap and are not asserted, same as the
	// boundary file and the Rust tests.
	[
		[0, ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'E', 'D', 'D']],
		[1, ['D', 'D', 'E', 'D', 'D', 'E', 'E', 'E', 'E', 'D', 'E']],
		[2, ['D', 'D', 'E', 'D', 'E', 'F', 'F', 'D', 'E', 'D', 'D']],
		[4, ['C', 'C', 'C', 'C', 'C', 'C', 'D', 'C', 'D', 'C', 'D']]
	].forEach(([p, row]) =>
		row.forEach((e, i) => eq(r.matrices.los[i][p], e, `EP2 LOS seg ${i + 1} p${p + 1}`))
	);
	eq(r.matrices.los[3][3], 'E', 'EP2 LOS seg 4 p4');
	['F', 'F', 'D', 'E', 'D', 'E'].forEach((e, k) =>
		eq(r.matrices.los[5 + k][3], e, `EP2 LOS seg ${6 + k} p4`)
	);

	// Facility performance summary (Exhibit 25-60).
	[
		[56.8, 31.0, 'D'],
		[54.4, 36.2, 'E'],
		[42.5, 45.6, 'F'],
		[42.5, 43.8, 'E'],
		[56.4, 26.2, 'D']
	].forEach(([s, k, l], p) => {
		approx(r.perPeriod[p].speed, s, 0.5, `EP2 facility SMS p${p + 1}`);
		approx(r.perPeriod[p].density, k, 0.5, `EP2 facility density p${p + 1}`);
		eq(r.perPeriod[p].los, l, `EP2 facility LOS p${p + 1}`);
	});

	// VERIFY-HCM: the residual period-4 queue-distribution gap keeps the overall
	// totals off the published 50.5 mi/h and 35.6 veh/mi/ln, so they are pinned
	// at what the engine measures, at the boundary file's own precision.
	approx(r.overallSpeed, 49.3, 0.05, 'EP2 overall SMS (VERIFY-HCM, published 50.5)');
	approx(r.overallDensity, 36.53, 0.05, 'EP2 overall density (VERIFY-HCM, published 35.6)');

	// The discussion names the governing cell rather than restating the totals,
	// and says when the queue formed and that it dissipated inside the study
	// period. Both are claims about content rather than about wording, so they
	// are asserted on what the sentences have to contain.
	const lines = discussion(r);
	ok(lines.some((l) => l.includes('governing cell') && l.includes('period 3')), 'EP2 discussion names the governing cell and its period');
	ok(lines.some((l) => /queue forms in period 3/.test(l) && /dissipated/.test(l)), 'EP2 discussion reports queue formation and dissipation');
	ok(lines.some((l) => l.includes('D, E, F, E, D')), 'EP2 discussion lists the facility letters');
}

// ── Example Problem 3: the lane-change facility ─────────────────────────
{
	const { result: r } = run('ep3');
	eq(r.oversaturated, false, 'EP3 undersaturated after the improvement');
	// Adding the fourth lane removes every bottleneck (Exhibit 25-64).
	for (let p = 0; p < 5; p++) {
		for (let i = 0; i < 11; i++) {
			ok(r.matrices.dc[i][p] <= 1.0 + 1e-9, `EP3 d/c seg ${i + 1} p${p + 1} <= 1`);
		}
	}
	// Segment capacities (Exhibit 25-63): Segments 7-11 gain the fourth lane and
	// rise to 8,998 veh/h while the weave follows the period's weaving pattern.
	const weavingByPeriod = [8273, 8281, 8323, 8403, 8463];
	for (let p = 0; p < 5; p++) {
		for (let i = 0; i < 11; i++) {
			const e = i <= 4 ? 6748 : i === 5 ? weavingByPeriod[p] : 8998;
			approx(r.matrices.capacity[i][p], e, 1.0, `EP3 capacity seg ${i + 1} p${p + 1}`);
		}
	}
	// Exhibit 25-68 totals: 57.5 mi/h, 27.7 veh/mi/ln. The overall space mean
	// speed is demand-weighted across periods and computes 57.34, so it keeps
	// the boundary file's 0.2 band.
	approx(r.overallSpeed, 57.5, 0.2, 'EP3 overall SMS (Exhibit 25-68)');
	approx(r.overallDensity, 27.7, 0.5, 'EP3 overall density (Exhibit 25-68)');
	// Segment LOS matrix (Exhibit 25-67), all 55 cells exact.
	[
		['D', 'D', 'D', 'D', 'D', 'D', 'C', 'C', 'D', 'C', 'C'],
		['D', 'D', 'E', 'D', 'D', 'D', 'C', 'C', 'D', 'C', 'D'],
		['D', 'D', 'E', 'D', 'E', 'E', 'D', 'D', 'D', 'D', 'D'],
		['D', 'D', 'D', 'D', 'D', 'D', 'C', 'C', 'D', 'C', 'C'],
		['C', 'C', 'C', 'C', 'C', 'C', 'B', 'B', 'C', 'B', 'B']
	].forEach((row, p) =>
		row.forEach((e, i) => eq(r.matrices.los[i][p], e, `EP3 LOS seg ${i + 1} p${p + 1}`))
	);
	// The added lane is a placed feature, so the derived cross section has to
	// carry it: Segments 7 onward are four lanes wide and everything upstream
	// of the weave is three.
	eq(r.segments.map((s) => s.lanes), [3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4], 'EP3 lane counts step at the weave');
}

// ── Example Problem 4: the work-zone facility ───────────────────────────
{
	const { doc, rows, result: r } = run('ep4');
	eq(r.oversaturated, true, 'EP4 the work zone drives the facility oversaturated');
	eq(r.firstOversatPeriod, 0, 'EP4 demand exceeds capacity from the first period (Exhibit 25-72)');

	// The stage trap. Exhibit 25-71 prints 4,499 veh/h, which carries only the
	// lane closure; the facility's capacity matrix holds the post-CAF_wz value
	// the Exhibit 25-72 ratios are taken against, 4,499 x 0.892 = 4,013 veh/h.
	for (let p = 0; p < 5; p++) {
		approx(r.matrices.capacity[10][p], 4499 * 0.892, 5.0, `EP4 work zone capacity seg 11 p${p + 1}`);
	}
	// Exhibit 25-72, Segment 11: 1.26 in period 1, above 1.0 in every period but
	// the last. This is the headline pair the builder has to reproduce.
	[1.26, 1.44, 1.56, 1.24, 0.97].forEach((e, p) =>
		approx(r.matrices.dc[10][p], e, 0.02, `EP4 work zone d/c seg 11 p${p + 1}`)
	);
	// Segment LOS matrix (Exhibit 25-76), all 55 cells exact. The work zone
	// itself holds LOS E because it discharges at its own reduced capacity
	// rather than queueing.
	[
		['C', 'C', 'D', 'C', 'D', 'C', 'F', 'F', 'F', 'F', 'E'],
		['D', 'D', 'D', 'D', 'F', 'F', 'F', 'F', 'F', 'F', 'E'],
		['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'E'],
		['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'E'],
		['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'E']
	].forEach((row, p) =>
		row.forEach((e, i) => eq(r.matrices.los[i][p], e, `EP4 LOS seg ${i + 1} p${p + 1}`))
	);
	// Exhibit 25-77 overall totals, pinned at the engine values with the
	// published ones named, exactly as the boundary file does.
	approx(r.overallSpeed, 16.2, 0.1, 'EP4 overall SMS (VERIFY-HCM, published 19.5)');
	approx(r.overallDensity, 81.6, 0.1, 'EP4 overall density (VERIFY-HCM, published 80.5)');

	// The segment the work zone governs is coded with the lanes that stay open,
	// so the drawn cross section and the run agree.
	eq(r.segments[10].workZone, true, 'EP4 segment 11 is the work zone segment');
	eq(r.segments[10].lanes, 2, 'EP4 segment 11 carries the two open lanes');
	eq(r.segments.filter((s) => s.workZone).length, 1, 'EP4 has exactly one work zone segment');

	const lines = discussion(r);
	ok(lines.some((l) => l.includes('which carries the work zone')), 'EP4 discussion names the work zone as the governing cell');
	ok(lines.some((l) => l.includes('still standing in the last period')), 'EP4 discussion says the queue outlives the study period');

	// The work zone is the only difference between this facility and Example
	// Problem 1, so removing it has to put every headline value back. This is
	// the control on the whole work-zone path: without it, a work zone that
	// silently failed to reach the engine would still produce a plausible run.
	const bare = run('ep4', (d) => (d.features = d.features.filter((f) => f.kind !== 'work_zone')));
	eq(bare.result.oversaturated, false, 'EP4 without its work zone is undersaturated');
	approx(bare.result.overallSpeed, 56.9, 0.5, 'EP4 without its work zone is Example Problem 1 again');
	ok(handoffNotes(doc, rows).some((n) => n.id === 'work-zone-carried'), 'EP4 says the work zone crosses to the reliability run');
	ok(!handoffNotes(bare.doc, bare.rows).some((n) => n.id === 'work-zone-carried'), 'a facility with no work zone says nothing about one');
}

// ── The Chapter 11 handoff ──────────────────────────────────────────────
//
// The claim on the panel is that the reliability run is of the same facility.
// The reliability constructor builds its internal Chapter 10 facility by
// cloning each segment's inner, so a work zone placed through set_work_zone
// rides across. That is checked here rather than asserted, and it is checked
// with a control: the same facility without the work zone has to reproduce the
// Example Problem 1 distribution exactly, or the comparison could not have
// detected the difference in the first place.
{
	const ep1 = run('ep1');
	const rel1 = analyzeReliability(ep1.doc, ep1.rows, defaultReliabilityInputs(), wasm);
	ok(rel1.numScenarios > 0 && rel1.numObservations > 0, 'the reliability run generates scenarios');
	approx(rel1.fftt, 6.0, 0.05, 'EP1 free-flow travel time is the facility at its free-flow speed');
	ok(rel1.ttiMean >= 1.0, 'a travel time index is at least 1');
	ok(rel1.tti95 >= rel1.tti50, 'the 95th percentile sits at or above the median');
	ok(rel1.reliabilityRating >= 0 && rel1.reliabilityRating <= 100, 'the reliability rating is a percentage');
	eq(rel1.hasIncidents, true, 'incidents are modeled at the default inputs');
	eq(rel1.hasWeather, false, 'weather is not, and the panel says so');

	const ep4 = run('ep4');
	const rel4 = analyzeReliability(ep4.doc, ep4.rows, defaultReliabilityInputs(), wasm);
	ok(rel4.ttiMean > rel1.ttiMean * 2, 'the work zone reaches the reliability run and more than doubles the mean travel time index');
	ok(rel4.reliabilityRating < rel1.reliabilityRating, 'and collapses the reliability rating');

	// The control.
	const bare = run('ep4', (d) => (d.features = d.features.filter((f) => f.kind !== 'work_zone')));
	const relBare = analyzeReliability(bare.doc, bare.rows, defaultReliabilityInputs(), wasm);
	approx(relBare.ttiMean, rel1.ttiMean, 1e-9, 'EP4 without its work zone reproduces the EP1 distribution exactly');
	approx(relBare.reliabilityRating, rel1.reliabilityRating, 1e-9, 'EP4 without its work zone reproduces the EP1 rating exactly');

	const lines = reliabilityDiscussion(rel1, ep1.result);
	ok(lines.some((l) => l.includes('seed file')), 'the reliability discussion says the facility is the seed file');
	ok(lines.some((l) => l.includes('undersaturated in the Chapter 10 run')), 'and reads the distribution against the Chapter 10 run');
	ok(lines.some((l) => l.includes('no level of service letter is assigned')), 'and declines to assign a letter');
	ok(reliabilityDiscussion(rel4, ep4.result).some((l) => l.includes('already oversaturated')), 'an oversaturated seed is called one');
	ok(handoffNotes(ep1.doc, ep1.rows).some((n) => n.id === 'fidelity-panels'), 'the fidelity inputs left out are named');
}

// ── An imported fixture whose fields no binding carries ─────────────────
//
// A facility built from features can never hold these, but an imported fixture
// can, and a run that drops them silently is exactly the failure this workspace
// pays for. The check is on the fixture rather than on the editor for that
// reason.
{
	const raw = JSON.parse(readFileSync(join(LIB_CASES, 'FreewayFacilities', 'case1.json'), 'utf8'));
	raw.segments[0].ramp_metering = 900;
	raw.segments[3].time_step_s = 30;
	const doc = fromFixture(raw, 'case1 with unbound fields');
	const { rows } = deriveRows(doc, api);
	eq(
		unboundFieldsIn(toFixture(doc, rows)),
		[
			{ segment: 1, field: 'ramp_metering' },
			{ segment: 4, field: 'time_step_s' }
		],
		'the unbound fields of an imported fixture are found'
	);

	const r = analyzeFacility(doc, rows, wasm);
	// The run still happens and still reproduces the published facility, because
	// these fields are absent from the fixture the boundary suite runs too. What
	// changes is that the page and the discussion say what was dropped.
	approx(r.overallSpeed, 56.9, 0.5, 'an imported fixture analyzes to the published overall speed');
	ok(discussion(r).some((l) => l.includes('ramp_metering on segment 1')), 'the discussion names what no binding could pass');
	ok(handoffNotes(doc, rows).some((n) => n.id === 'unbound-ramp_metering-1' && n.level === 'warn'), 'and the reliability panel says the same');
}

// ── A facility with no features at all ──────────────────────────────────
//
// The empty document is one basic segment, which is a real Chapter 10 facility
// and has to analyze rather than throw. It is also the state the page opens in,
// so a failure here would be the first thing a visitor met.
{
	const doc = emptyDocument();
	const { rows } = deriveRows(doc, api);
	const r = analyzeFacility(doc, rows, wasm);
	eq([r.numSegments, r.numPeriods], [1, 4], 'the default document analyzes as one segment over four periods');
	ok(r.overallSpeed > 0 && r.overallDensity > 0, 'and produces a facility speed and density');
	ok(discussion(r).length > 0, 'and a discussion');
}

// ── The heatmap encoding ────────────────────────────────────────────────
//
// The palette is testable rather than eyeballed, so it is tested. What matters
// is that the value is never carried by the fill alone, that the ramp runs
// pale-to-deep as operation degrades on every measure including the one the HCM
// reads the other way round, and that the theme flips the anchor rather than
// recolouring anything.
{
	const { result: r } = run('ep2');
	eq(MEASURES.map((m) => m.id), ['los', 'density', 'speed', 'dc'], 'the selector offers the four measures');

	const density = MEASURES.find((m) => m.id === 'density');
	const speed = MEASURES.find((m) => m.id === 'speed');
	const dDom = domainOf(r.matrices.density);
	const sDom = domainOf(r.matrices.speed);
	ok(dDom.lo < dDom.hi && sDom.lo < sDom.hi, 'the ramp domains are the finite extremes of the matrix');

	// The worst cell takes the deepest step on both measures, which is the whole
	// point of `invert`: without it the slowest segment would be the palest.
	eq(rampStep(dDom.hi, dDom, density.invert), RAMP.length - 1, 'the densest cell takes the deepest step');
	eq(rampStep(sDom.lo, sDom, speed.invert), RAMP.length - 1, 'the slowest cell takes the deepest step too');
	eq(rampStep(sDom.hi, sDom, speed.invert), 0, 'and the fastest takes the palest');
	// A uniform matrix takes the middle step rather than an extreme, so a
	// facility with nothing to report does not read as one in trouble.
	eq(rampStep(5, { lo: 5, hi: 5 }, false), 3, 'a degenerate domain takes the middle step');

	// The theme flips the anchor: the same step is the opposite end of the same
	// seven hues, never a different palette.
	const light = cellStyle(density, dDom.hi, dDom, false);
	const deep = cellStyle(density, dDom.hi, dDom, true);
	eq(light.fill, RAMP[RAMP.length - 1], 'the deepest step on light is the deepest hue');
	eq(deep.fill, RAMP[0], 'and on dark it is the palest, which is the one furthest from that surface');
	eq(light.step, deep.step, 'the step itself does not move with the theme');

	// Every cell prints its own value, so nothing is carried by colour alone.
	eq(cellText(MEASURES[0], 'E'), 'E', 'a LOS cell prints its letter');
	eq(cellText(density, 34.56), '34.6', 'a density cell prints its value');
	eq(cellText(speed, NaN), '–', 'and a cell with no value prints a dash rather than NaN');

	// The LOS encoding is the house status scale rather than a ramp, so a letter
	// means the same colour here as on a badge or a facility diagram.
	const losCell = cellStyle(MEASURES[0], 'F', null, false);
	eq(losCell.fill, '#d03b3b', 'LOS F takes the house critical step');
	eq(cellStyle(MEASURES[0], 'F', null, true).fill, losCell.fill, 'and the status steps are never themed');
}

if (failures.length) {
	console.log(`FAIL  builder analysis  (${failures.length}/${checks} checks failed)`);
	for (const f of failures) console.log(`      ${f}`);
	process.exitCode = 1;
} else {
	console.log(`OK    builder analysis  (${checks} checks)`);
}
