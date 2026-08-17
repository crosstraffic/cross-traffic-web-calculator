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

import { emptyDocument, setPeriods } from './document.js';

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
