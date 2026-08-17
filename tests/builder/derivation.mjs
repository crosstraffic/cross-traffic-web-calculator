// Derivation checks for the facility builder, in the idiom of tests/boundary:
// plain node, no runner, nonzero exit on failure. Run with `npm run test:builder`.
//
// Two things are being checked and they are different claims. The first is that
// the four Exhibit 10-11/10-12 branches reach the builder through the wasm
// binding with the same answers the library's own `test_segmentation_rules_
// exhibit_10_11` asserts in Rust. The second is that the assembly around the
// binding is right, and the only honest test of that is a published facility:
// six ramps placed at their gores have to reproduce Example Problem 1's eleven
// segments, lengths, lanes and demands exactly.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { deriveRows, WEAVE_EXTENSION_FT } from '../../src/lib/builder/derive.js';
import { emptyDocument, makeFeature, setPeriods } from '../../src/lib/builder/document.js';
import { loadExample } from '../../src/lib/builder/examples.js';
import { fromFixture, toFixture } from '../../src/lib/builder/fixture.js';
import { validateFacility } from '../../src/lib/builder/validate.js';
import { applyTemplate } from '../../src/lib/builder/templates.js';

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

// ── The binding itself, mirroring the library's Rust test ───────────────

const shape = (ft, aux) => api.segment_ramp_section(ft, aux).map((p) => [p.seg_type, p.length_ft]);

eq(shape(4000, false), [['Merge', 1500], ['Basic', 1000], ['Diverge', 1500]], 'Exhibit 10-11(a) 4,000 ft');
eq(shape(3000, false), [['Merge', 1500], ['Diverge', 1500]], 'Exhibit 10-11(b) 3,000 ft');
eq(shape(2000, false), [['Merge', 500], ['OverlappingRamp', 1000], ['Diverge', 500]], 'Exhibit 10-11(c) 2,000 ft');
eq(shape(2640, true), [['Weaving', 2640]], 'Exhibit 10-12 auxiliary lane');
eq(shape(1200, false), [['OverlappingRamp', 1200]], 'sub-1,500 ft truncation');
eq(api.ramp_influence_area_ft(), 1500, 'ramp influence area');
throws(() => api.segment_ramp_section(NaN, false), 'finite', 'a NaN spacing is rejected at the binding');
throws(() => api.segment_ramp_section(0, false), 'positive', 'a zero spacing is rejected at the binding');

// ── The four branches through the builder's own assembly ────────────────

function pairDoc(spacingFt, aux) {
	const doc = emptyDocument();
	doc.mainline.lengthFt = 30000;
	const on = makeFeature(doc, 'on_ramp', 10000);
	on.auxLaneToNext = aux;
	doc.features.push(on);
	doc.features.push(makeFeature(doc, 'off_ramp', 10000 + spacingFt));
	return doc;
}
const types = (doc) => deriveRows(doc, api).rows.map((r) => [r.seg_type, Math.round(r.length_ft)]);

eq(
	types(pairDoc(4000, false)),
	[['Basic', 10000], ['Merge', 1500], ['Basic', 1000], ['Diverge', 1500], ['Basic', 16000]],
	'assembled 4,000-ft pair, basic termini around it'
);
eq(
	types(pairDoc(2000, false)),
	[['Basic', 10000], ['Merge', 500], ['OverlappingRamp', 1000], ['Diverge', 500], ['Basic', 18000]],
	'assembled 2,000-ft pair'
);
eq(
	types(pairDoc(1200, false)),
	[['Basic', 10000], ['OverlappingRamp', 1200], ['Basic', 18800]],
	'assembled sub-1,500-ft pair'
);
// The weaving segment reaches 500 ft past each gore, so the basic segment
// upstream of it is 500 ft shorter than the on-ramp station.
eq(
	types(pairDoc(1640, true)),
	[['Basic', 9500], ['Weaving', 2640], ['Basic', 17860]],
	'assembled auxiliary-lane pair, extended 500 ft past each gore'
);
{
	const rows = deriveRows(pairDoc(1640, true), api).rows;
	const weave = rows.find((r) => r.seg_type === 'Weaving');
	eq(weave.short_length_ft, 1640, 'the weave carries the gore-to-gore distance as its short length');
	eq(weave.length_ft - weave.short_length_ft, 2 * WEAVE_EXTENSION_FT, 'the difference is the two Exhibit 10-2 extensions');
	eq(weave.lanes, 4, 'the auxiliary lane makes the weave one lane wider than the mainline');
}

// An isolated ramp is one influence area, truncated at the next gore.
{
	const doc = emptyDocument();
	doc.mainline.lengthFt = 20000;
	doc.features.push(makeFeature(doc, 'on_ramp', 5000));
	eq(types(doc), [['Basic', 5000], ['Merge', 1500], ['Basic', 13500]], 'isolated on-ramp');
}
{
	const doc = emptyDocument();
	doc.mainline.lengthFt = 20000;
	doc.features.push(makeFeature(doc, 'off_ramp', 5000));
	eq(types(doc), [['Basic', 3500], ['Diverge', 1500], ['Basic', 15000]], 'isolated off-ramp');
}
{
	// Two on-ramps 800 ft apart: the first merge truncates at the second gore.
	const doc = emptyDocument();
	doc.mainline.lengthFt = 20000;
	doc.features.push(makeFeature(doc, 'on_ramp', 5000));
	doc.features.push(makeFeature(doc, 'on_ramp', 5800));
	eq(types(doc), [['Basic', 5000], ['Merge', 800], ['Merge', 1500], ['Basic', 12700]], 'consecutive on-ramps truncate');
}

// ── Example Problem 1: six ramps must rebuild eleven published segments ──

const case1 = JSON.parse(readFileSync(join(LIB_CASES, 'FreewayFacilities', 'case1.json')));
const ep1 = loadExample('ep1');
const ep1Rows = deriveRows(ep1, api).rows;

eq(ep1Rows.length, case1.segments.length, 'EP1 segment count');
case1.segments.forEach((want, i) => {
	const got = ep1Rows[i];
	eq(got?.seg_type, want.seg_type, `EP1 segment ${i + 1} type`);
	eq(Math.round(got?.length_ft), Math.round(want.length_ft), `EP1 segment ${i + 1} length`);
	eq(got?.lanes, want.lanes, `EP1 segment ${i + 1} lanes`);
	for (const k of ['ramp_ffs', 'accel_lane_ft', 'decel_lane_ft', 'short_length_ft', 'num_weaving_lanes', 'lc_rf', 'lc_fr']) {
		if (want[k] != null) eq(got?.[k], want[k], `EP1 segment ${i + 1} ${k}`);
	}
	for (const k of ['on_ramp_demand', 'off_ramp_demand', 'ramp_to_ramp_demand']) {
		if (want[k]) eq(got?.[k], want[k], `EP1 segment ${i + 1} ${k}`);
	}
});
eq(
	Math.round(ep1Rows.reduce((a, r) => a + r.length_ft, 0)),
	31680,
	'EP1 total length, 6.00 mi'
);
// Nothing the fixture does not name should acquire a demand vector.
ok(
	ep1Rows.filter((r) => r.on_ramp_demand.some((x) => x !== 0)).length === 3,
	'exactly three EP1 segments carry on-ramp demand'
);

// The EP1 document, exported to the fixture schema, is the fixture.
{
	const exported = toFixture(ep1, ep1Rows);
	eq(exported.segments.length, 11, 'exported EP1 has eleven segments');
	eq(exported.mainline_demand, case1.mainline_demand, 'exported EP1 mainline demand');
	eq(exported.ffs, case1.ffs, 'exported EP1 ffs');
	case1.segments.forEach((want, i) => {
		const got = exported.segments[i];
		for (const k of Object.keys(want)) eq(got[k], want[k], `exported EP1 segment ${i + 1} key ${k}`);
		eq(Object.keys(got), Object.keys(want), `exported EP1 segment ${i + 1} key set and order`);
	});
}

// ── Fixture import round-trip ───────────────────────────────────────────
{
	const doc = fromFixture(case1, 'case1.json');
	const { rows } = deriveRows(doc, api);
	eq(rows.length, 11, 'imported case1 shows eleven rows');
	eq(rows.map((r) => r.seg_type), case1.segments.map((s) => s.seg_type), 'imported case1 types');
	ok(doc.features.length === 0, 'an imported fixture arrives with no feature layer');
	const back = toFixture(doc, rows);
	// Byte-equality of the canonical form, which is the strongest claim
	// available: the fixtures are hand-formatted with several keys per line, so
	// the file's own bytes cannot be reproduced by any serializer.
	eq(JSON.stringify(back), JSON.stringify(case1), 'case1 round-trips to identical canonical JSON');
	ok(back._comment === case1._comment, 'the fixture comment survives a round trip');
}

// An override survives re-derivation, and the row it pins is marked.
{
	const doc = pairDoc(4000, false);
	const middleKey = `pair:${doc.features[0].id}:${doc.features[1].id}#1`;
	doc.overrides[middleKey] = { fields: { lanes: 4 }, appliedTo: 'Basic' };
	let rows = deriveRows(doc, api).rows;
	const pinned = rows.find((r) => r.key === middleKey);
	eq(pinned.lanes, 4, 'the override is applied');
	ok(pinned.overridden === true, 'the overridden row is marked');
	ok(pinned.staleOverride === false, 'an override on the type it was made against is not stale');
	// Drag the pair down to 2,000 ft: the middle row is now an overlapping ramp,
	// the override is still there, and it says so.
	doc.features[1].stationFt = 12000;
	rows = deriveRows(doc, api).rows;
	const moved = rows.find((r) => r.key === middleKey);
	eq(moved.seg_type, 'OverlappingRamp', 'the middle row changed type across the 3,000-ft threshold');
	eq(moved.lanes, 4, 'the override survived re-derivation');
	ok(moved.staleOverride === true, 'the override is marked stale after the type changed underneath it');
}

// ── Validation ──────────────────────────────────────────────────────────
{
	const doc = loadExample('ep1');
	const flags = validateFacility(doc, deriveRows(doc, api).rows, []);
	eq(flags.filter((f) => f.level === 'error'), [], 'EP1 raises no errors');
	ok(!flags.some((f) => f.id === 'facility-too-long'), 'EP1 at 6 mi is inside the 15-min limit');
}
{
	// A facility whose first segment is a merge cannot be analyzed, because the
	// termini must be basic.
	const doc = emptyDocument();
	doc.mainline.lengthFt = 8000;
	doc.features.push(makeFeature(doc, 'on_ramp', 0));
	const flags = validateFacility(doc, deriveRows(doc, api).rows, []);
	ok(flags.some((f) => f.id === 'termini-not-basic' && f.level === 'error'), 'a ramp at station 0 flags the terminus');
}
{
	// An off-ramp taking more than has entered produces a negative segment
	// demand, which the engine carries forward silently.
	const doc = emptyDocument();
	doc.mainline.lengthFt = 20000;
	doc.mainline.demand = [100, 100, 100, 100];
	const off = makeFeature(doc, 'off_ramp', 10000);
	off.demand = [500, 500, 500, 500];
	doc.features.push(off);
	const flags = validateFacility(doc, deriveRows(doc, api).rows, []);
	ok(flags.some((f) => f.id === 'demand-negative' && f.level === 'warn'), 'negative demand is flagged');
}
{
	// 20 mi at 60 mi/h is past the distance one 15-min period covers.
	const doc = emptyDocument();
	doc.mainline.lengthFt = 20 * 5280;
	const flags = validateFacility(doc, deriveRows(doc, api).rows, []);
	const f = flags.find((x) => x.id === 'facility-too-long');
	ok(f && f.level === 'warn', 'an over-long facility is flagged as a warning, not an error');
	ok(f.cite.includes('Section 3'), 'the flag cites Chapter 10 Section 3');
}
{
	// And the rule that is NOT here: there is no analysis-period cap.
	const doc = loadExample('ep1');
	setPeriods(doc, 20);
	const flags = validateFacility(doc, deriveRows(doc, api).rows, []);
	ok(
		!flags.some((f) => /period/.test(f.id) && f.level !== 'note'),
		'twenty analysis periods raise nothing above a note, because Chapter 10 Section 3 sets no limit'
	);
}

// ── Templates are feature groups ────────────────────────────────────────
{
	const doc = emptyDocument();
	doc.mainline.lengthFt = 30000;
	applyTemplate(doc, 'diamond', 10000);
	eq(types(doc), [['Basic', 10000], ['Merge', 1500], ['Basic', 1000], ['Diverge', 1500], ['Basic', 16000]], 'diamond template');
	const doc2 = emptyDocument();
	doc2.mainline.lengthFt = 30000;
	applyTemplate(doc2, 'aux-weave', 10000);
	eq(types(doc2), [['Basic', 9500], ['Weaving', 2640], ['Basic', 17860]], 'auxiliary-lane weave template');
}

if (failures.length) {
	console.log(`FAIL  builder derivation  (${failures.length}/${checks} checks failed)`);
	for (const f of failures) console.log(`      ${f}`);
	process.exitCode = 1;
} else {
	console.log(`OK    builder derivation  (${checks} checks)`);
}
