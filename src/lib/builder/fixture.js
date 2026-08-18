// The other half of the layered persistence: the library's own FreewayFacilities
// serde schema, so anything built here runs unchanged in the Rust and Python
// APIs and in the boundary suite, and so every published example problem loads.
//
// Import and export are deliberately not symmetric. A fixture stores the
// segments Step A-2 produced and not the ramps an analyst placed, and that is
// not invertible: a 1,500 ft merge could be an isolated on-ramp or half of a
// pair 3,000 ft apart. So an import arrives with no feature layer at all, says
// so, and is edited through the segment table. Only a document built from
// features can be re-derived.

import { emptyDocument, setPeriods, defaultSignalConfig } from './document.js';
import {
	URBAN_SEGMENT_KEYS,
	URBAN_MEASURE_KEYS,
	TWOLANE_SEGMENT_KEYS,
	deriveUrbanRows,
	deriveTwoLaneRows
} from './derive.js';

const FACILITY_KEYS = [
	['mainline_demand', (m) => m.demand],
	['ffs', (m) => m.ffs],
	['heavy_vehicle_pct', (m) => m.heavyVehiclePct],
	['terrain', (m) => m.terrain],
	['city_type', (m) => m.cityType],
	['phf', (m) => m.phf],
	['jam_density_pc', (m) => m.jamDensityPc],
	['queue_discharge_drop', (m) => m.queueDischargeDrop],
	['total_ramp_density', (m) => m.totalRampDensity],
	['interchange_density', (m) => m.interchangeDensity]
];

/** Per-segment keys the builder carries, in the order the library's fixtures
 * write them, so an exported segment reads like a hand-written one. */
const SEGMENT_KEYS = [
	'seg_type',
	'length_ft',
	'lanes',
	'ramp_ffs',
	'accel_lane_ft',
	'decel_lane_ft',
	'short_length_ft',
	'num_weaving_lanes',
	'lc_rf',
	'lc_fr',
	'on_ramp_demand',
	'off_ramp_demand',
	'ramp_to_ramp_demand',
	'work_zone'
];

/** Fields of `FacilitySegment` and `FreewayFacility` that phase 1 has no editor
 * for. They are preserved verbatim on a fixture that was imported (see
 * `toFixture`), and simply absent from a facility built out of features. */
export const UNCARRIED_FIELDS = [
	'ffs (per-segment free-flow speed override)',
	'caf / saf / daf',
	'caf_schedule / saf_schedule',
	'ramp_metering',
	'c_ifl_override',
	'time_step_s'
];

/** Fields of `UrbanSegment` this editor has no control for. They survive a round
 * trip on an imported fixture, because `toUrbanFixture` merges onto the original
 * parse, and are simply absent from a facility built out of features. */
export const URBAN_UNCARRIED_FIELDS = [
	'stopped_vehicles_veh_ln',
	'queue2_veh_ln / queue3_veh_ln',
	'stop_rate_other',
	'midsegment_other_delay_s',
	'access_point_turn_delay_speed_mph',
	'free_flow_speed_override_mph',
	'prop_opposing_left_accessible',
	's_calib_mph',
	'upstream_discharge_profiles',
	'arrival_uniform_volume_veh_h / flow_profile_time_step_s / downstream_green_start_s'
];

/**
 * An `UrbanFacilities` fixture to a builder document, feature layer and all.
 *
 * This import is not the freeway one. A freeway fixture is not invertible, so it
 * arrives as a segment list with no features. An urban fixture IS invertible,
 * exactly: N segments in order give N+1 boundary intersections at the running
 * sums of their lengths, and each segment's timing belongs to the boundary at
 * its downstream end (Chapter 18, Section 2). So the signals come back, and the
 * imported facility is editable as features rather than only through overrides.
 *
 * The one thing that genuinely cannot be recovered is the upstream terminus's
 * own timing: no segment ends at it, so the fixture never recorded it. That
 * signal gets the defaults and carries `inferred: true`, which the editor shows,
 * rather than being given borrowed numbers that would look measured.
 */
export function fromUrbanFixture(raw, name = 'imported fixture') {
	if (!raw || typeof raw !== 'object') throw new Error('not a JSON object');
	if (!Array.isArray(raw.segments) || raw.segments.length === 0) {
		throw new Error('not an UrbanFacilities fixture: no "segments" array');
	}
	const doc = emptyDocument('urban');
	doc.meta = { name, source: `fixture:${name}`, modified: null };
	const first = raw.segments[0];
	const m = doc.mainline;
	if (raw.prop_left_turn_lanes != null) m.propLeftTurnLanes = raw.prop_left_turn_lanes;
	if (first.n_through_lanes != null) m.lanes = first.n_through_lanes;
	if (first.speed_limit_mph != null) m.speedLimitMph = first.speed_limit_mph;
	if (first.proportion_with_curb != null) m.proportionWithCurb = first.proportion_with_curb;
	if (first.proportion_on_street_parking != null) m.proportionOnStreetParking = first.proportion_on_street_parking;
	if (first.restrictive_median_length_ft != null) m.restrictiveMedianLengthFt = first.restrictive_median_length_ft;
	if (first.analysis_period_h != null) m.analysisPeriodH = first.analysis_period_h;
	if (first.through_demand_veh_h != null) m.demand = [first.through_demand_veh_h];
	m.lengthFt = raw.segments.reduce((a, s) => a + (s.segment_length_ft ?? 0), 0);

	// A segment carrying published measures is a summary segment, which is what
	// `add_segment_from_config` itself decides on. The document mode follows the
	// fixture rather than the other way round.
	doc.analysisMode = raw.segments.some((s) => URBAN_MEASURE_KEYS.some((k) => s[k] != null))
		? 'measures'
		: 'inputs';

	// The upstream terminus. Its width is the only thing segment 1 records about
	// it, so that is the only thing taken from the fixture.
	doc.features = [
		{
			id: 'sig1',
			kind: 'signal',
			stationFt: 0,
			label: 'Signal 1',
			inferred: true,
			config: { ...defaultSignalConfig(doc), width_ft: first.upstream_intersection_width_ft ?? 0 },
			measures: null
		}
	];

	let station = 0;
	raw.segments.forEach((s, i) => {
		station += s.segment_length_ft ?? 0;
		doc.features.push({
			id: `sig${i + 2}`,
			kind: 'signal',
			stationFt: Math.round(station),
			label: `Signal ${i + 2}`,
			config: {
				...defaultSignalConfig(doc),
				control: s.control ?? 'Signalized',
				speed_limit_mph: s.speed_limit_mph ?? null,
				through_demand_veh_h: s.through_demand_veh_h,
				midsegment_flow_veh_h: s.midsegment_flow_veh_h,
				through_capacity_veh_h: s.through_capacity_veh_h,
				through_control_delay_s: s.through_control_delay_s,
				cycle_length_s: s.cycle_length_s,
				effective_green_s: s.effective_green_s,
				platoon_ratio: s.platoon_ratio ?? null,
				sat_flow_veh_h_ln: s.sat_flow_veh_h_ln ?? null,
				arrival_type: s.arrival_type ?? null,
				full_stop_rate_override: s.full_stop_rate_override ?? null,
				// The Exhibit 18-13 planning parameters, recovered so a fixture that
				// states them round-trips and shows them in the editor rather than
				// carrying them invisibly through `importedRaw`.
				n_influential_access_points: s.n_influential_access_points ?? null,
				pct_left_turns_access: s.pct_left_turns_access ?? null,
				pct_right_turns_access: s.pct_right_turns_access ?? null,
				access_left_bay_adequate: s.access_left_bay_adequate ?? null,
				access_right_bay_adequate: s.access_right_bay_adequate ?? null,
				// The width of the intersection at the NEXT segment's upstream end,
				// which is this one. The last signal has no segment after it to have
				// recorded its width, so it keeps the default.
				width_ft: raw.segments[i + 1]?.upstream_intersection_width_ft ?? defaultSignalConfig(doc).width_ft
			},
			measures: URBAN_MEASURE_KEYS.some((k) => s[k] != null)
				? Object.fromEntries(URBAN_MEASURE_KEYS.filter((k) => s[k] != null).map((k) => [k, s[k]]))
				: null
		});

		// Access points are counts in the fixture, so they come back evenly spaced
		// inside their segment. The count is what Exhibit 18-11 note c reads, and
		// the published per-point delays attach to the first subject-side points,
		// which is the arrangement `access_point_delays_s` describes.
		const segStart = station - (s.segment_length_ft ?? 0);
		const delays = Array.isArray(s.access_point_delays_s) ? s.access_point_delays_s : [];
		const approaches = Array.isArray(s.access_point_approaches) ? s.access_point_approaches : [];
		addPoints(doc, segStart, s.segment_length_ft ?? 0, i, 'subject', Math.round(s.n_access_points_subject ?? 0), delays, approaches);
		addPoints(doc, segStart, s.segment_length_ft ?? 0, i, 'opposing', Math.round(s.n_access_points_opposing ?? 0), [], []);
	});

	doc.importedRaw = JSON.parse(JSON.stringify(raw));
	return setPeriods(doc, 1);
}

function addPoints(doc, startFt, lengthFt, segIndex, side, count, delays, approaches) {
	for (let k = 0; k < count; k++) {
		doc.features.push({
			id: `ap${segIndex + 1}${side === 'subject' ? 's' : 'o'}${k + 1}`,
			kind: 'access_point',
			stationFt: Math.round(startFt + (lengthFt * (k + 1)) / (count + 1)),
			label: '',
			side,
			delayS: side === 'subject' && k < delays.length ? delays[k] : null,
			approach: side === 'subject' && k < approaches.length ? { ...approaches[k] } : null
		});
	}
}

/**
 * The derived urban segment table back to the `UrbanFacilities` serde schema.
 *
 * For an imported document the original parse is the base and the derived rows
 * are merged onto it key by key, so keys this builder has no editor for survive
 * and an untouched import re-exports to the identical canonical JSON it came
 * from.
 */
export function toUrbanFixture(doc, rows) {
	const measures = doc.analysisMode === 'measures';
	const keys = measures ? [...URBAN_SEGMENT_KEYS, ...URBAN_MEASURE_KEYS] : URBAN_SEGMENT_KEYS;

	if (doc.importedRaw) {
		const out = JSON.parse(JSON.stringify(doc.importedRaw));
		// A key the fixture never wrote meant "take the serde default", and the
		// derivation fills every key regardless, so writing them all back would
		// turn a five-key segment into a twenty-key one and no import would ever
		// round-trip. The test for whether an absent key has become worth writing
		// is whether the user changed it, which is the comparison against what
		// this same fixture derived to on arrival.
		const baseline = importBaseline(doc.importedRaw);
		out.segments = out.segments.map((orig, i) => {
			const r = rows[i];
			if (!r) return orig;
			const merged = { ...orig };
			for (const k of keys) {
				if (k in orig) merged[k] = cloneVal(r[k] ?? orig[k]);
				else if (r[k] != null && !same(r[k], baseline[i]?.[k])) merged[k] = cloneVal(r[k]);
			}
			return merged;
		});
		return out;
	}

	const out = { prop_left_turn_lanes: doc.mainline.propLeftTurnLanes, segments: [] };
	out.segments = rows.map((r) => {
		const s = {};
		for (const k of keys) if (r[k] != null) s[k] = cloneVal(r[k]);
		return s;
	});
	return out;
}

/** What this fixture's segments derive to the moment it is imported, before any
 * edit. Pure in `raw`, so it is the same answer every time and needs no state
 * carried on the document. The import is small (a facility is a handful of
 * segments), so re-deriving it on export is cheaper than keeping a second copy
 * in sync. */
function importBaseline(raw) {
	const doc = fromUrbanFixture(raw, 'baseline');
	return deriveUrbanRows(doc).rows;
}

/** Structural equality for the scalar, array and object values a segment key can
 * hold. Deep rather than `===` because `access_point_delays_s` and
 * `access_point_approaches` are both non-scalar. */
function same(a, b) {
	return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Fields of the Chapter 15 schema this editor has no control for. There are
 * none: the two-lane segment schema is twenty keys wide and the derivation fills
 * every one of them. The list is kept, and kept empty, because the checks panel
 * prints it either way and an empty list is a claim worth making explicitly. */
export const TWOLANE_UNCARRIED_FIELDS = [];

/**
 * A `TwoLaneHighways` fixture to a builder document, feature layer and all.
 *
 * Like the urban import and unlike the freeway one, this is invertible. A
 * Chapter 15 fixture states, per segment, everything the features encode: the
 * passing type, the grade and its vertical class, the demand and its peak hour
 * factor and heavy-vehicle percentage, the posted limit, and the subsegments a
 * horizontal curve produced. So the features come back and the imported highway
 * is editable as features rather than only through overrides.
 *
 * A demand feature is emitted at the START OF EVERY SEGMENT rather than only
 * where the traffic characteristics change. That looks redundant on a fixture
 * whose segments all carry the same volume, and it is the thing that makes the
 * import exact: a demand feature marks a segment boundary, so emitting one per
 * segment guarantees the boundary set regardless of whether a grade or a passing
 * feature happens to bound that segment too. Emitting them only on a change
 * would silently merge two identical adjacent segments into one, which is a
 * different facility with a different segment count.
 */
export function fromTwoLaneFixture(raw, name = 'imported fixture') {
	if (!raw || typeof raw !== 'object') throw new Error('not a JSON object');
	if (!Array.isArray(raw.segments) || raw.segments.length === 0) {
		throw new Error('not a TwoLaneHighways fixture: no "segments" array');
	}
	const doc = emptyDocument('twolane');
	doc.meta = { name, source: `fixture:${name}`, modified: null };
	const m = doc.mainline;
	if (raw.lane_width != null) m.laneWidthFt = raw.lane_width;
	if (raw.shoulder_width != null) m.shoulderWidthFt = raw.shoulder_width;
	if (raw.apd != null) m.accessPointDensity = raw.apd;
	if (raw.pmhvfl != null) m.pctHeavyVehInPassingLane = raw.pmhvfl;
	if (raw.l_de != null) m.effectiveDownstreamLengthMi = raw.l_de;

	const first = raw.segments[0];
	if (first.spl != null) m.speedLimitMph = first.spl;
	if (first.volume != null) m.demand = [first.volume];
	if (first.phf != null) m.phf = first.phf;
	if (first.phv != null) m.heavyVehiclePct = first.phv;
	if (first.vertical_class != null) m.verticalClass = first.vertical_class;

	// MILES to FEET, once, here. Everything on the document side of this call is
	// feet, and a subsegment's length is already feet and is not touched.
	//
	// The highway length is the LAST STATION rather than the rounded sum, and the
	// two are different numbers. Rounding the sum and rounding each segment
	// separately can disagree by up to half a foot per segment, and both end up as
	// marks in the derivation, so the shortfall would appear as a sliver segment
	// past the last one and an overshoot would collapse the final boundary. It is
	// set below, once the stations have been walked.
	doc.features = [];
	let stationFt = 0;
	raw.segments.forEach((s, i) => {
		const lengthFt = Math.round((s.length ?? 0) * 5280);
		const startFt = stationFt;
		const endFt = startFt + lengthFt;

		doc.features.push({
			id: `dm${i + 1}`,
			kind: 'demand',
			stationFt: startFt,
			label: `Segment ${i + 1} conditions`,
			config: {
				volume: s.volume ?? 0,
				opposingVolume: s.volume_op ?? 0,
				phf: s.phf ?? 0.95,
				heavyVehiclePct: s.phv ?? 5,
				// Only carried when it differs from the highway's, so a fixture posting
				// one limit throughout does not put an override on every segment.
				speedLimitMph: s.spl != null && s.spl !== m.speedLimitMph ? s.spl : null
			}
		});

		if ((s.passing_type ?? 0) > 0) {
			doc.features.push({
				id: `ps${i + 1}`,
				kind: 'passing',
				stationFt: startFt,
				endFt,
				label: s.passing_type === 2 ? `Passing lane ${i + 1}` : `Passing zone ${i + 1}`,
				passingType: s.passing_type
			});
		}

		// A grade feature is emitted whenever the segment states a grade or a
		// vertical class other than the highway's default, because the class is a
		// Step 2 input in its own right: the passing-lane capacity lookup reads it
		// before Step 3 has a chance to recompute it.
		if ((s.grade ?? 0) !== 0 || (s.vertical_class ?? 1) !== (m.verticalClass ?? 1)) {
			doc.features.push({
				id: `gr${i + 1}`,
				kind: 'grade',
				stationFt: startFt,
				endFt,
				label: `Grade ${i + 1}`,
				gradePct: s.grade ?? 0,
				verticalClass: s.vertical_class ?? 1
			});
		}

		// Subsegments back to curves. A subsegment with no radius is the tangent
		// filler the derivation puts between curves, so it is not a feature; it is
		// what the derivation will produce again from the gaps between these.
		let subStation = startFt;
		for (const [k, ss] of (s.subsegments ?? []).entries()) {
			const len = ss.length ?? 0;
			if ((ss.design_rad ?? 0) > 0) {
				doc.features.push({
					id: `hc${i + 1}_${k + 1}`,
					kind: 'curve',
					// Not rounded, unlike every other station in every document. A
					// subsegment boundary genuinely falls between feet in the published
					// fixtures, and rounding it moves the tangent beside it by the same
					// amount, which is a silent change to a Step 5d weight.
					stationFt: subStation,
					endFt: subStation + len,
					label: '',
					designRadiusFt: ss.design_rad,
					superelevationPct: ss.sup_ele ?? 0,
					centralAngleDeg: ss.central_angle ?? 0,
					horClassEntered: ss.hor_class ?? null
				});
			}
			subStation += len;
		}

		stationFt = endFt;
	});
	m.lengthFt = stationFt;

	doc.importedRaw = JSON.parse(JSON.stringify(raw));
	return setPeriods(doc, 1);
}

/**
 * The derived Chapter 15 segment table back to the `TwoLaneHighways` serde
 * schema.
 *
 * For an imported document the original parse is the base and the derived rows
 * are merged onto it key by key, the same arrangement the freeway and urban
 * exports use, so an untouched import re-exports to the file it came from.
 */
export function toTwoLaneFixture(doc, rows) {
	if (doc.importedRaw) {
		const out = JSON.parse(JSON.stringify(doc.importedRaw));
		for (const [key, get] of TWOLANE_FACILITY_MAP) if (key in out) out[key] = get(doc.mainline);
		// A key the fixture never wrote meant "take the serde default", and the
		// derivation fills all twenty regardless, so writing them all back would
		// turn a hand-written segment into a full one and no such import would
		// round-trip. The test for whether an absent key has become worth writing
		// is whether the user changed it, which is the comparison against what this
		// same fixture derived to on arrival. Same arrangement the urban export
		// uses, and the reason the published fixtures did not catch this is that
		// all four of them state every key.
		const baseline = twoLaneImportBaseline(doc.importedRaw);
		out.segments = out.segments.map((orig, i) => {
			const r = rows[i];
			if (!r) return orig;
			const merged = { ...orig };
			for (const k of TWOLANE_SEGMENT_KEYS) {
				if (k in orig) merged[k] = cloneVal(r[k] ?? orig[k]);
				else if (r[k] != null && !same(r[k], baseline[i]?.[k])) merged[k] = cloneVal(r[k]);
			}
			return merged;
		});
		return out;
	}

	const out = {};
	for (const [key, get] of TWOLANE_FACILITY_MAP) out[key] = get(doc.mainline);
	out.segments = rows.map((r) => {
		const s = {};
		for (const k of TWOLANE_SEGMENT_KEYS) if (r[k] != null) s[k] = cloneVal(r[k]);
		return s;
	});
	return out;
}

/** The five facility-level keys, in the order the library's own fixtures write
 * them. They are exactly the `WasmTwoLaneHighways` constructor arguments after
 * the segment list. */
const TWOLANE_FACILITY_MAP = [
	['lane_width', (m) => m.laneWidthFt],
	['shoulder_width', (m) => m.shoulderWidthFt],
	['apd', (m) => m.accessPointDensity],
	['pmhvfl', (m) => m.pctHeavyVehInPassingLane],
	['l_de', (m) => m.effectiveDownstreamLengthMi]
];

/** What a Chapter 15 fixture's segments derive to the moment it is imported,
 * before any edit. Pure in `raw` for the same reason the urban one is, and
 * cheap for the same reason: a two-lane facility is a handful of segments. */
function twoLaneImportBaseline(raw) {
	const doc = fromTwoLaneFixture(raw, 'baseline');
	return deriveTwoLaneRows(doc).rows;
}

export function fromFixture(raw, name = 'imported fixture') {
	if (!raw || typeof raw !== 'object') throw new Error('not a JSON object');
	if (!Array.isArray(raw.segments) || raw.segments.length === 0) {
		throw new Error('not a FreewayFacilities fixture: no "segments" array');
	}
	if (!Array.isArray(raw.mainline_demand) || raw.mainline_demand.length === 0) {
		throw new Error('not a FreewayFacilities fixture: no "mainline_demand" array');
	}
	const doc = emptyDocument();
	doc.meta = { name, source: `fixture:${name}`, modified: null };
	const m = doc.mainline;
	m.demand = [...raw.mainline_demand];
	if (raw.ffs != null) m.ffs = raw.ffs;
	if (raw.heavy_vehicle_pct != null) m.heavyVehiclePct = raw.heavy_vehicle_pct;
	if (raw.terrain != null) m.terrain = raw.terrain;
	if (raw.city_type != null) m.cityType = raw.city_type;
	if (raw.phf != null) m.phf = raw.phf;
	if (raw.jam_density_pc != null) m.jamDensityPc = raw.jam_density_pc;
	if (raw.queue_discharge_drop != null) m.queueDischargeDrop = raw.queue_discharge_drop;
	if (raw.total_ramp_density != null) m.totalRampDensity = raw.total_ramp_density;
	if (raw.interchange_density != null) m.interchangeDensity = raw.interchange_density;
	m.lanes = raw.segments[0].lanes ?? m.lanes;
	m.lengthFt = raw.segments.reduce((a, s) => a + s.length_ft, 0);

	doc.importedSegments = JSON.parse(JSON.stringify(raw.segments));
	doc.importedRaw = JSON.parse(JSON.stringify(raw));
	return setPeriods(doc, m.demand.length);
}

/**
 * Serialize the derived segment table back to the fixture schema.
 *
 * For an imported document the original parse is the base and the derived rows
 * are merged onto it key by key, so keys this builder has no editor for
 * (`_comment`, work zones, CAF schedules) survive and an untouched import
 * re-exports to the identical canonical JSON it came from.
 */
export function toFixture(doc, rows) {
	if (doc.facilityType === 'urban') return toUrbanFixture(doc, rows);
	if (doc.facilityType === 'twolane') return toTwoLaneFixture(doc, rows);
	if (doc.importedRaw) {
		const out = JSON.parse(JSON.stringify(doc.importedRaw));
		out.mainline_demand = [...doc.mainline.demand];
		out.segments = out.segments.map((orig, i) => {
			const r = rows[i];
			if (!r) return orig;
			const merged = { ...orig };
			for (const k of SEGMENT_KEYS) {
				if (k in orig) merged[k] = cloneVal(r[k] ?? orig[k]);
				else if (isCarried(r, k)) merged[k] = cloneVal(r[k]);
			}
			return merged;
		});
		return out;
	}

	const out = { segments: rows.map(segmentOf) };
	for (const [key, get] of FACILITY_KEYS) {
		const v = get(doc.mainline);
		if (v != null) out[key] = Array.isArray(v) ? [...v] : v;
	}
	return out;
}

function segmentOf(r) {
	const s = {};
	for (const k of SEGMENT_KEYS) if (isCarried(r, k)) s[k] = cloneVal(r[k]);
	return s;
}

/** A demand vector of nothing but zeros is what a segment with no ramp has, and
 * the library defaults it, so writing it out would add noise the hand-written
 * fixtures do not carry. */
function isCarried(r, k) {
	const v = r[k];
	if (v == null) return false;
	if (Array.isArray(v)) return v.some((x) => x !== 0);
	return true;
}

/** Work-zone configs are objects rather than scalars, so cloning has to reach
 * one level in or the exported fixture would share the live config and an edit
 * after export would reach back into it. */
function cloneDeep(v) {
	return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
}

function cloneVal(v) {
	return Array.isArray(v) ? [...v] : cloneDeep(v);
}
