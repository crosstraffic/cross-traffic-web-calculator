// Builder document -> HCM Chapter 16 run, over the Chapter 18 segments the
// boundary signals derived.
//
// The seam is the same one phase 1 left on the freeway side: the derived rows
// are already in the library's `UrbanSegment` field names, so the whole
// construction is one `add_segment_from_config` per row. That method is chosen
// over the 31-argument `add_segment` for a reason the middleware's own doc
// comment gives: six fields of `UrbanSegment` have no positional argument at
// all, including `access_point_approaches`, which is the only way into the
// computed Chapter 30 Section 4 access-point procedure. Counting 31 positions
// against a different order from `WasmUrbanSegment`'s constructor is also
// exactly how two mappings drift, and the ch16 boundary file exists to catch
// that drift rather than to be re-created here.
//
// Nothing here reads a rune or touches the DOM, so tests/builder/urban.mjs runs
// it under plain node against the same wasm the page loads.

import { URBAN_SEGMENT_KEYS, URBAN_MEASURE_KEYS } from './derive.js';

/**
 * The config object for one derived row: the library's `UrbanSegment` schema and
 * nothing else.
 *
 * Built from an explicit key list rather than by deleting the bookkeeping keys,
 * because `add_segment_from_config` ignores unknown fields silently. A row key
 * that fell through by accident would not throw, it would land on a serde
 * default and produce a finished-looking wrong answer.
 */
export function segmentConfig(row, { measures = false } = {}) {
	const cfg = {};
	for (const k of URBAN_SEGMENT_KEYS) if (row[k] != null) cfg[k] = clone(row[k]);
	if (measures) {
		for (const k of URBAN_MEASURE_KEYS) if (row[k] != null) cfg[k] = row[k];
	}
	return cfg;
}

function clone(v) {
	if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? { ...x } : x));
	return v && typeof v === 'object' ? { ...v } : v;
}

/**
 * Run Chapter 16 on the built facility.
 *
 * Which of the engine's two entry points runs is decided by the document's mode
 * and not guessed from the data, matching the hcm16 page. `analyze()` evaluates
 * every segment with the Chapter 18 engine and then aggregates; `aggregate()`
 * runs Chapter 16 Steps 1 through 4 over measures that are already decided.
 * Calling `analyze()` on a facility holding published measures throws, by
 * design, because there are no Chapter 18 inputs behind them to recompute from.
 *
 * Returns a plain frozen snapshot with the wasm handle dropped, so the result
 * cannot change when the document is edited afterwards and the printable report
 * cannot drift from the run that produced it.
 *
 * @param {object} doc builder document
 * @param {object[]} rows derived rows, overrides already applied
 * @param {object} wasm the module namespace (WasmUrbanFacility)
 */
export function analyzeUrbanFacility(doc, rows, wasm) {
	const measures = doc.analysisMode === 'measures';
	const fac = new wasm.WasmUrbanFacility(doc.mainline.propLeftTurnLanes);
	for (const r of rows) fac.add_segment_from_config(segmentConfig(r, { measures }));

	// The facility LOS is the return value of the call, not a field of
	// `results_to_js_value()`. Reading it off the results object alone yields
	// undefined, which is the mistake the hcm16 page's spread guards against.
	const los = measures ? fac.aggregate() : fac.analyze();
	const res = fac.results_to_js_value();
	const segs = fac.segments_to_js_value() ?? [];

	return deepFreeze({
		mode: measures ? 'measures' : 'inputs',
		los,
		lengthFt: res.length_ft,
		baseFfs: res.base_ffs,
		travelSpeed: res.travel_speed,
		travelTime: res.travel_time,
		baseFreeFlowTravelTime: res.base_free_flow_travel_time,
		spatialStopRate: res.spatial_stop_rate,
		criticalVcRatio: res.critical_vc_ratio,
		perceptionScore: res.perception_score,
		poorestSegmentLos: res.poorest_segment_los,
		// Row identity snapshotted with the run, so re-deriving or relabelling the
		// document afterwards cannot retitle a column of finished results.
		segments: rows.map((r, i) => ({
			index: i,
			key: r.key,
			startFt: r.startFt,
			lengthFt: r.length_ft,
			lanes: r.lanes,
			control: r.control,
			apDelaySource: r.apDelaySource,
			overridden: !!r.overridden,
			baseFfs: segs[i]?.base_ffs,
			travelSpeed: segs[i]?.travel_speed,
			spatialStopRate: segs[i]?.spatial_stop_rate,
			vcRatio: segs[i]?.vc_ratio,
			los: segs[i]?.los
		})),
		facilityName: doc.meta?.name ?? 'Untitled urban street',
		// The urban engines take a scalar demand and expose no period axis, so the
		// result has one column of time and the grid collapses to it. Carried on
		// the result rather than assumed by the view, so the view has one thing to
		// read and phase 3 can set it differently without touching the component.
		numPeriods: 1
	});
}

function deepFreeze(v) {
	if (v && typeof v === 'object' && !Object.isFrozen(v)) {
		Object.freeze(v);
		for (const k of Object.keys(v)) deepFreeze(v[k]);
	}
	return v;
}
