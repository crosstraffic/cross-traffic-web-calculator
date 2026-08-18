// The builder document: the facility as an engineer describes it, before any
// segmentation. It is a plain serializable object with no class instances and
// no functions, so a snapshot is a structuredClone and persistence is
// JSON.stringify. Everything the strip, the table, the demand grid and the
// validation panel show is derived from this and nothing else.
//
// A fixture cannot play this role. The library's FreewayFacilities schema
// stores the segments Chapter 10 Step A-2 produced, not the ramps the analyst
// placed, and the two are not invertible: a 1,500 ft merge could have come
// from an isolated on-ramp or from a ramp pair 3,000 ft apart. So the document
// is what round-trips the builder, and the fixture is what round-trips the
// engines.

export const DOC_VERSION = 3;

/** Stations are stored in FEET, like every length in the Chapter 10 schema. The
 * strip snaps drags to 0.1 mi, which is 528 ft, but nothing downstream sees
 * miles. */
export const FT_PER_MI = 5280;

let seq = 0;
/** Ids only have to be unique within one document, and they key overrides, so
 * they must be stable across a save and reload. A counter seeded from the
 * document's own high-water mark does that; Math.random would too, but this
 * keeps the JSON readable. */
export function nextId(doc, prefix) {
	const used = new Set((doc?.features ?? []).map((f) => f.id));
	let n = ++seq;
	while (used.has(`${prefix}${n}`)) n = ++seq;
	return `${prefix}${n}`;
}

/** The facility types the builder can hold. Phase 1 shipped freeway; phase 2
 * adds urban street. Two-lane (Chapter 15) is phase 3 and is deliberately not
 * listed, because an entry here is a promise the derivation can keep. */
export const FACILITY_TYPES = ['freeway', 'urban'];

export function emptyDocument(facilityType = 'freeway') {
	return facilityType === 'urban' ? emptyUrbanDocument() : emptyFreewayDocument();
}

function emptyFreewayDocument() {
	return {
		version: DOC_VERSION,
		facilityType: 'freeway',
		meta: { name: 'Untitled facility', source: 'builder', modified: null },
		periods: 4,
		mainline: {
			lengthFt: 3 * FT_PER_MI,
			lanes: 3,
			ffs: 60,
			terrain: 'Level',
			cityType: 'Urban',
			phf: 0.95,
			heavyVehiclePct: 0.05,
			jamDensityPc: 190,
			queueDischargeDrop: 0.07,
			totalRampDensity: 1,
			interchangeDensity: 1,
			demand: [4000, 4400, 4400, 4000]
		},
		features: [],
		overrides: {},
		// Set only by a fixture import. A fixture arrives with no feature layer
		// at all, so the derived table is the fixture's own segment list and the
		// segment table becomes the primary editor. Placing a feature clears
		// this, because from that point the segments follow the features.
		importedSegments: null,
		// The verbatim parsed fixture an import came from, so an untouched
		// import exports byte-identically including keys this builder has no
		// editor for.
		importedRaw: null
	};
}

/**
 * The urban street document (HCM Chapters 16/17/18).
 *
 * Two things differ structurally from the freeway document and both come from
 * the engines rather than from taste.
 *
 * The urban engines are single-period. `WasmUrbanSegment`, `WasmUrbanFacility`
 * and `WasmUrbanReliability` all take a scalar `through_demand_veh_h`; there is
 * no per-period demand vector anywhere on the urban surface. So `periods` is
 * pinned at 1, the demand grid collapses to the strip-with-values row the design
 * gives single-period methods, and no period axis is invented. (Chapter 17 does
 * have an internal period axis, `analysis_periods_per_day`, but that is scenario
 * generation inside the reliability engine and not an axis the builder edits.)
 *
 * Demand is a property of a segment rather than of the facility, and a segment
 * is what the boundary signals derive. So the per-segment inputs live on the
 * signal at the segment's DOWNSTREAM end, which is where Chapter 18 puts them:
 * the through control delay, the cycle length and the effective green all belong
 * to the boundary intersection the segment runs into. The Chapter 29 Example
 * Problem 4 fixture is organized the same way, one `boundary_signals` entry per
 * segment. `mainline.demand` survives as the single-element vector the chassis'
 * period machinery needs, and it is the default a newly placed signal inherits.
 */
function emptyUrbanDocument() {
	return {
		version: DOC_VERSION,
		facilityType: 'urban',
		meta: { name: 'Untitled urban street', source: 'builder', modified: null },
		periods: 1,
		// Which of the two things a segment can be, for the whole document. The
		// engine's `aggregate()` would accept a facility mixing them, but a
		// per-segment switch doubles every editor for a case no published example
		// problem exercises, and the hcm16 page already made this call and says so.
		analysisMode: 'inputs',
		mainline: {
			lengthFt: 5400,
			direction: 'Eastbound',
			lanes: 2,
			speedLimitMph: 35,
			// Facility-wide P_LTL, the one argument `WasmUrbanFacility`'s
			// constructor takes. Stored as the decimal the engine wants, not the
			// percent the chapter pages show.
			propLeftTurnLanes: 0.33,
			// Chapter 18 has no "area type" input. What an area type would imply is
			// the cross section, and these are the three inputs that carry it into
			// the free-flow speed chain (Equations 18-3 through 18-6). An area-type
			// dropdown on top of them would be inert, so there is not one.
			proportionWithCurb: 0.7,
			proportionOnStreetParking: 0,
			restrictiveMedianLengthFt: 0,
			// Read only by the computed Chapter 30 Section 4 access-point branch,
			// which a segment enters only when its access points carry approaches.
			analysisPeriodH: 0.25,
			demand: [968]
		},
		features: [],
		overrides: {},
		importedSegments: null,
		importedRaw: null
	};
}

/** The per-segment Chapter 18 inputs a boundary signal carries for the segment
 * ENDING at it. Defaults are the Chapter 30 Example Problem 1 eastbound segment
 * (Exhibits 30-26 through 30-36), because a signal dropped on an empty street
 * should analyze rather than throw, and a published segment is the one shape
 * that is certain to. */
export function defaultSignalConfig(doc) {
	return {
		control: 'Signalized',
		// Null inherits the mainline's posted limit. It is overridable per segment
		// because published facilities change posted speed along their length:
		// Chapter 29 Example Problem 1 runs 35 mi/h over its first three segments
		// and 30 mi/h over its last two.
		speed_limit_mph: null,
		through_demand_veh_h: doc?.mainline?.demand?.[0] ?? 968,
		midsegment_flow_veh_h: 1150,
		through_capacity_veh_h: 1848,
		through_control_delay_s: 18.31,
		cycle_length_s: 100,
		effective_green_s: 48.63,
		platoon_ratio: null,
		sat_flow_veh_h_ln: null,
		arrival_type: null,
		full_stop_rate_override: 0.547,
		// The width of THIS intersection, which Chapter 18 charges to the segment
		// on its far side as `upstream_intersection_width_ft`.
		width_ft: 50,
		// Chapter 17 only. Carried on the signal because that is the boundary
		// intersection the reliability engine attributes them to.
		k_factor: 0.5,
		i_factor: 1.0,
		approach_lanes: 4,
		segment_crashes: 15,
		intersection_crashes: 33
	};
}

/** The published Chapter 18 measures a signal carries in `measures` mode, for
 * the segment ending at it. Defaults are Segment 1 of Chapter 29 Example
 * Problem 1 eastbound (Exhibit 29-47). */
export function defaultSignalMeasures() {
	return {
		base_ffs_mph: 40.9,
		travel_speed_mph: 24.2,
		spatial_stop_rate_stops_mi: 1.72,
		vc_ratio: 0.85,
		los: 'C'
	};
}

/** One access point approach, in the serde shape the library's
 * `access_point_approaches` takes (Chapter 30 Section 4, Equations 30-31
 * through 30-68). Defaults are the first approach of the Chapter 30 Example
 * Problem 1 fixture. */
export function defaultAccessApproach() {
	return {
		v_lt: 74.8,
		v_th: 981.71,
		v_rt: 93.5,
		n_sl: 0,
		n_t: 2,
		n_sr: 0,
		opposing_flow_veh_h: 1086.15,
		left_turn_bay: false,
		right_turn_bay: false,
		n_lt_lanes: 0,
		left_bay_storage_ft: 0,
		pct_heavy_veh: 0
	};
}

export const isSignal = (f) => f.kind === 'signal';
export const isAccessPoint = (f) => f.kind === 'access_point';
export const isUrban = (doc) => doc?.facilityType === 'urban';

/** A feature is a point on the mainline. `stationFt` is the gore point: the
 * downstream end of an on-ramp's gore area and the upstream end of an
 * off-ramp's, which is where the 1,500 ft influence area is measured from
 * (Chapter 10 Section 2, Exhibit 10-1). */
export function makeFeature(doc, kind, stationFt) {
	const periods = doc.periods;
	// A boundary signal is the urban segmentation feature: Chapter 18 bounds a
	// segment by an intersection at each end, so placing one splits the street.
	if (kind === 'signal') {
		return {
			id: nextId(doc, 'sig'),
			kind,
			stationFt: Math.round(stationFt),
			label: '',
			config: defaultSignalConfig(doc),
			measures: defaultSignalMeasures()
		};
	}
	// An access point does not bound a segment. It sits inside one and feeds the
	// Equation 18-7 access-point delay term and the Exhibit 18-11 note c count.
	if (kind === 'access_point') {
		return {
			id: nextId(doc, 'ap'),
			kind,
			stationFt: Math.round(stationFt),
			label: '',
			// Which side of the street. `opposing` points raise N_ap,o rather than
			// N_ap,s, which is a different term of the f_A adjustment.
			side: 'subject',
			// The three Equation 18-7 sources, in the order the library picks among
			// them. `delayS` is the published per-point hook (Exhibit 30-35);
			// `approach` drives the computed Chapter 30 Section 4 procedure; both
			// null leaves the segment on the Exhibit 18-13 planning estimate.
			delayS: null,
			approach: null
		};
	}
	// The two non-ramp kinds are not demand sources, so they share nothing with
	// the ramp shape but an id and a station.
	if (kind === 'lane_change') {
		// A station where the mainline lane count steps. Chapter 10 Section 2:
		// "A new segment should be started whenever capacity changes (i.e., when
		// a full or auxiliary lane is added, when one or more lanes are added or
		// dropped ...)" — the same sentence the auxiliary lane is derived from.
		return {
			id: nextId(doc, 'lc'),
			kind,
			stationFt: Math.round(stationFt),
			label: '',
			lanes: doc.mainline.lanes + 1
		};
	}
	if (kind === 'work_zone') {
		// An interval feature. `stationFt` is its upstream end so that every
		// feature sorts by one key; `endFt` is the other end.
		return {
			id: nextId(doc, 'wz'),
			kind,
			stationFt: Math.round(stationFt),
			endFt: Math.round(stationFt) + FT_PER_MI,
			label: '',
			config: defaultWorkZone(doc)
		};
	}
	const base = {
		id: nextId(doc, kind === 'on_ramp' ? 'on' : 'off'),
		kind,
		stationFt: Math.round(stationFt),
		label: '',
		rampFfs: 40,
		demand: new Array(periods).fill(0)
	};
	if (kind === 'on_ramp') {
		return {
			...base,
			accelLaneFt: 500,
			// An auxiliary lane between this on-ramp's gore and the next
			// off-ramp's turns the whole section into one weaving segment
			// (Exhibit 10-12). It is a property of the pair, held on the
			// upstream half of it.
			auxLaneToNext: false,
			numWeavingLanes: 2,
			lcRf: 1,
			lcFr: 1,
			rampToRampDemand: new Array(periods).fill(0)
		};
	}
	return { ...base, decelLaneFt: 500 };
}

/** The ten fields of the library's `WorkZone`, defaulted to the shape of a
 * routine lane closure rather than to zeros, because a work zone whose
 * `total_lanes` is 0 analyzes and prints numbers. `speed_ratio` and
 * `queue_discharge_drop` are the two the caller is most likely to want to
 * change and the two whose defaults are least obvious, so both are the
 * Chapter 10 Section 4 defaults rather than invented values. */
export function defaultWorkZone(doc) {
	const lanes = doc?.mainline?.lanes ?? 3;
	return {
		total_lanes: lanes,
		open_lanes: Math.max(1, lanes - 1),
		soft_barrier: true,
		rural: (doc?.mainline?.cityType ?? 'Urban') === 'Rural',
		lateral_distance_ft: 0,
		night: false,
		speed_ratio: 1,
		speed_limit_mi_h: 55,
		total_ramp_density: doc?.mainline?.totalRampDensity ?? 1,
		queue_discharge_drop: doc?.mainline?.queueDischargeDrop ?? 0.07
	};
}

/** Ramps are the features the segmentation rules act on. Lane changes and work
 * zones act on the segments those rules produce, which is why they are
 * separated everywhere rather than filtered at each use. */
export const isRamp = (f) => f.kind === 'on_ramp' || f.kind === 'off_ramp';
export const isInterval = (f) => f.kind === 'work_zone';

export function sortedFeatures(doc) {
	return [...doc.features].sort((a, b) => a.stationFt - b.stationFt || a.id.localeCompare(b.id));
}

export function cloneDoc(doc) {
	return JSON.parse(JSON.stringify(doc));
}

/** Resize every per-period vector at once. The period count is one control for
 * the whole document because a facility whose ramps disagree about how many
 * 15-min periods exist is not analyzable, and the engine reads the period count
 * off the mainline demand vector alone, so a short ramp vector would be read as
 * zeros rather than rejected. */
export function setPeriods(doc, n) {
	// The urban engines take a scalar demand per segment and have no period
	// axis at all, so the count is pinned rather than clamped: accepting a 4 here
	// would grow vectors nothing downstream reads and show a grid that cannot
	// affect a result.
	const periods = isUrban(doc) ? 1 : Math.max(1, Math.round(n));
	const fit = (v) => {
		const out = (v ?? []).slice(0, periods);
		while (out.length < periods) out.push(out.length ? out[out.length - 1] : 0);
		return out;
	};
	doc.periods = periods;
	doc.mainline.demand = fit(doc.mainline.demand);
	for (const f of doc.features) {
		if (!isRamp(f)) continue;
		f.demand = fit(f.demand);
		if (f.kind === 'on_ramp') f.rampToRampDemand = fit(f.rampToRampDemand);
	}
	if (doc.importedSegments) {
		for (const s of doc.importedSegments) {
			for (const k of ['on_ramp_demand', 'off_ramp_demand', 'ramp_to_ramp_demand']) {
				if (Array.isArray(s[k])) s[k] = fit(s[k]);
			}
		}
	}
	return doc;
}

/** Documents loaded from a file or from local storage are untrusted input, so
 * the shape is checked rather than assumed. The failure this guards is silent:
 * a document missing `mainline.demand` renders an empty demand grid and derives
 * a segment table that looks finished. */
export function migrate(raw) {
	if (!raw || typeof raw !== 'object') throw new Error('not a builder document');
	if (raw.version > DOC_VERSION) {
		throw new Error(`unsupported builder document version ${raw.version} (this build reads ${DOC_VERSION})`);
	}
	if (!FACILITY_TYPES.includes(raw.facilityType)) {
		throw new Error(
			`unsupported facility type "${raw.facilityType}" (this build reads ${FACILITY_TYPES.join(' and ')})`
		);
	}
	const raw2 = upgradeToV3(upgradeToV2(raw));
	const base = emptyDocument(raw2.facilityType);
	const doc = { ...base, ...raw2 };
	doc.meta = { ...base.meta, ...(raw2.meta ?? {}) };
	doc.mainline = { ...base.mainline, ...(raw2.mainline ?? {}) };
	doc.features = Array.isArray(raw2.features) ? raw2.features : [];
	doc.overrides = raw2.overrides && typeof raw2.overrides === 'object' ? raw2.overrides : {};
	if (!Array.isArray(doc.mainline.demand) || doc.mainline.demand.length === 0) {
		throw new Error('document has no mainline demand, so it has no analysis periods');
	}
	// The period count is whatever the mainline vector says, and every other
	// vector is refit to it rather than trusted.
	return setPeriods(doc, doc.mainline.demand.length);
}

/** v1 to v2: v2 added the `lane_change` and `work_zone` feature kinds and
 * nothing else, so every v1 document is already a valid v2 document with none
 * of them. The migration is a version stamp, and it is written out rather than
 * assumed because the next one will not be. */
function upgradeToV2(raw) {
	if (raw.version >= 2) return raw;
	return { ...raw, version: 2 };
}

/** v2 to v3: v3 added the urban facility type and nothing else, so every v2
 * document is a valid v3 freeway document. Written out for the same reason v2's
 * was, and because a v2 document has no `facilityType` case to consider: the
 * only value v2 ever wrote was `freeway`. */
function upgradeToV3(raw) {
	if (raw.version >= 3) return raw;
	return { ...raw, version: 3 };
}
