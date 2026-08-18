// Builder document -> HCM Chapter 10 segment table.
//
// The branch logic that turns a ramp pair into merge/basic/diverge,
// merge/overlap/diverge, a weave or a single truncated overlap is NOT here. It
// is `segment_ramp_section` in the library (src/hcm/freeway_facilities/
// freeway_facilities.rs), bound through crosstraffic_middleware 0.3.12 and
// called once per ramp section. A second copy of Exhibits 10-11 and 10-12 in
// JS is how the two start to disagree, and the ch15 entries in VALIDATION.md
// are what that looks like after a year.
//
// What IS here is the assembly around it, and every rule below is quoted from
// the Chapter 10 Section 2 segmentation list ("The following general
// segmentation rules apply for the second step, dividing a facility into HCM
// segments") and checked against the library's own Example Problem 1 fixture,
// tests/ExampleCases/hcm/FreewayFacilities/case1.json, whose eleven segments
// this module reproduces exactly from six placed ramps.

/** Half of the weaving segment's overhang past the gores. Chapter 10 Section 2:
 * "the weave influence area extends 500 ft upstream and 500 ft downstream of
 * the two respective gore areas (see Exhibit 10-2)".
 *
 * This is the one number the derivation carries that the binding does not,
 * because the library's `segment_ramp_section` returns its auxiliary-lane
 * argument unchanged as the weaving segment's length. So the caller extends
 * the gore-to-gore distance by 2 x 500 ft before calling, and hands the
 * gore-to-gore distance itself back as `short_length_ft`. Example Problem 1
 * pins both halves: its weaving segment is 2,640 ft with a 1,640 ft short
 * length, and the difference is exactly these two extensions. */
export const WEAVE_EXTENSION_FT = 500;

/** Structural rows carry no numbers of their own, so they are cheap to name. */
const BASIC = 'Basic';

/**
 * @param {object} doc builder document
 * @param {{segment_ramp_section: Function, ramp_influence_area_ft: Function}} api
 *        the wasm surface, injected so this module is testable under plain node
 * @returns {{rows: object[], sections: object[], errors: string[]}}
 */
export function deriveRows(doc, api) {
	if (doc.facilityType === 'urban') return deriveUrbanRows(doc);
	if (doc.importedSegments) return importedRows(doc);

	const errors = [];
	const L = doc.mainline.lengthFt;
	const ria = api.ramp_influence_area_ft();
	const all = [...doc.features].sort(
		(a, b) => a.stationFt - b.stationFt || a.id.localeCompare(b.id)
	);
	// Ramps are what the segmentation rules act on. Lane changes and work zones
	// act on the segments those rules produce, in the property pass below.
	const feats = all.filter((f) => f.kind === 'on_ramp' || f.kind === 'off_ramp');
	const laneChanges = all.filter((f) => f.kind === 'lane_change');
	const workZones = all.filter((f) => f.kind === 'work_zone');

	// Pass 1: each feature or ramp pair claims a span of the mainline.
	const sections = [];
	let i = 0;
	while (i < feats.length) {
		const f = feats[i];
		const g = feats[i + 1];

		if (f.kind === 'on_ramp' && g && g.kind === 'off_ramp') {
			// "Ramp segments ... are classified either as merge (on-ramp) or as
			// diverge (off-ramp) segments, unless two adjacent merge and diverge
			// segments are connected by an auxiliary lane, in which case the
			// entire segment is coded as a weaving segment." Both cases, and the
			// three spacing bands underneath them, are the binding's job.
			const gore = g.stationFt - f.stationFt;
			const aux = !!f.auxLaneToNext;
			const span = aux ? gore + 2 * WEAVE_EXTENSION_FT : gore;
			let pieces;
			try {
				pieces = api.segment_ramp_section(span, aux);
			} catch (e) {
				errors.push(`ramp pair ${f.id}/${g.id}: ${e.message ?? e}`);
				i += 2;
				continue;
			}
			sections.push({
				key: `pair:${f.id}:${g.id}`,
				kind: aux ? 'weave-pair' : 'ramp-pair',
				startFt: aux ? f.stationFt - WEAVE_EXTENSION_FT : f.stationFt,
				pieces,
				on: f,
				off: g,
				goreToGoreFt: gore,
				why: whyPair(gore, aux, pieces)
			});
			i += 2;
			continue;
		}

		// An unpaired ramp is not a section in the manual's sense, it is one
		// influence area. "The influence area of a ramp is considered to be
		// 1,500 ft, measured downstream from the gore point for on-ramps and
		// upstream of the gore point for off-ramps."
		if (f.kind === 'on_ramp') {
			// "when this occurs, the 1,500-ft merge or diverge segment length is
			// truncated at the adjacent ramp gore point" — the same truncation
			// the manual gives for sub-1,500 ft spacing, applied at whichever
			// boundary comes first.
			const limit = Math.min(g ? g.stationFt : L, L);
			const len = Math.min(ria, limit - f.stationFt);
			if (len <= 0) {
				errors.push(`on-ramp ${f.id} has no room downstream of its gore for a merge segment`);
			} else {
				sections.push({
					key: `ramp:${f.id}`,
					kind: 'merge',
					startFt: f.stationFt,
					pieces: [{ seg_type: 'Merge', length_ft: len }],
					on: f,
					off: null,
					why: whyIsolated('Merge', f, len, ria)
				});
			}
		} else {
			const prevEnd = sections.length ? sectionEnd(sections[sections.length - 1]) : 0;
			const len = Math.min(ria, f.stationFt - prevEnd);
			if (len <= 0) {
				errors.push(`off-ramp ${f.id} has no room upstream of its gore for a diverge segment`);
			} else {
				sections.push({
					key: `ramp:${f.id}`,
					kind: 'diverge',
					startFt: f.stationFt - len,
					pieces: [{ seg_type: 'Diverge', length_ft: len }],
					on: null,
					off: f,
					why: whyIsolated('Diverge', f, len, ria)
				});
			}
		}
		i += 1;
	}

	// Pass 2: "Any remaining unassigned segments after all merge, diverge,
	// weave, and overlap segments have been defined are labeled as basic
	// segments." Including the two termini, which is also how "the first and
	// last segments of the defined facility are recommended to be basic freeway
	// segments" is satisfied without a special case.
	// Every station where the cross section changes is a segment boundary:
	// "A new segment should be started whenever capacity changes (i.e., when a
	// full or auxiliary lane is added, when one or more lanes are added or
	// dropped, when the terrain changes significantly, or where lane widths or
	// lateral clearances change in a way that affects capacity)." A lane change
	// is one such station; a work zone is two, its upstream and downstream ends.
	const breakpoints = [
		...laneChanges.map((f) => f.stationFt),
		...workZones.flatMap((f) => [f.stationFt, f.endFt])
	]
		.filter((x) => x > 0.5 && x < L - 0.5)
		.sort((a, b) => a - b);

	const rows = [];
	let cursor = 0;
	const pushBasic = (from, to, afterKey) => {
		const len = to - from;
		if (len <= 0.5) return; // sub-foot slivers are rounding, not segments
		// One unassigned stretch can span several cross sections, so it is cut
		// at every breakpoint inside it before it becomes a row.
		const cuts = [from, ...breakpoints.filter((b) => b > from + 0.5 && b < to - 0.5), to];
		for (let i = 0; i < cuts.length - 1; i++) {
			rows.push(
				row(doc, {
					key: `gap:${afterKey}${i ? `+${i}` : ''}`,
					seg_type: BASIC,
					length_ft: cuts[i + 1] - cuts[i],
					startFt: cuts[i],
					section: null,
					why: `Unassigned stretch between the ramp segments around it, so it is a basic freeway segment (Chapter 10 Section 2, last segmentation rule).${cuts.length > 2 ? ' It is cut here because the cross section changes at this station.' : ''}`
				})
			);
		}
	};

	for (const s of sections) {
		const secEnd = sectionEnd(s);
		const inside = breakpoints.filter((b) => b > s.startFt + 0.5 && b < secEnd - 0.5);
		if (inside.length) {
			errors.push(
				`the cross section changes at ${inside.map((b) => `${Math.round(b)} ft`).join(', ')}, inside the ramp section between ${s.on?.id ?? '?'} and ${s.off?.id ?? '?'}. A ramp influence area cannot be split, so the change is applied to the whole section instead of starting a segment there.`
			);
		}
		if (s.startFt < cursor - 0.5) {
			errors.push(
				`the influence area of ${s.on?.id ?? s.off?.id} starts upstream of the segment before it, so the ramps are too close to segment independently`
			);
		}
		pushBasic(cursor, s.startFt, rows.length ? rows[rows.length - 1].key : 'start');
		let x = s.startFt;
		s.pieces.forEach((p, pi) => {
			rows.push(
				row(doc, {
					key: `${s.key}#${pi}`,
					seg_type: p.seg_type,
					length_ft: p.length_ft,
					startFt: x,
					section: s,
					why: s.why
				})
			);
			x += p.length_ft;
		});
		cursor = Math.max(cursor, x);
	}
	pushBasic(cursor, L, rows.length ? rows[rows.length - 1].key : 'start');

	if (rows.length === 0) {
		rows.push(
			row(doc, {
				key: 'gap:start',
				seg_type: BASIC,
				length_ft: L,
				startFt: 0,
				section: null,
				why: 'No features placed, so the whole facility is one basic freeway segment.'
			})
		);
	}

	applyCrossSection(doc, rows, laneChanges, workZones, errors);
	return { rows: applyOverrides(doc, rows), sections, errors };
}

/**
 * Apply the properties that belong to a stretch of mainline rather than to a
 * ramp: the lane count in force, and any work zone covering the row.
 *
 * This runs after the segmentation rather than inside it because that is the
 * order the manual gives. Step A-2 divides the facility by where the demand and
 * capacity change; what the cross section then *is* at each of those segments
 * is Step A-3 onward. Keeping it separate is also what lets a work zone sit on
 * a merge segment without the segmentation having to know about work zones.
 */
function applyCrossSection(doc, rows, laneChanges, workZones, errors) {
	const steps = [...laneChanges].sort((a, b) => a.stationFt - b.stationFt);
	const lanesAt = (ft) => {
		let n = doc.mainline.lanes;
		for (const s of steps) {
			if (s.stationFt <= ft + 0.5) n = s.lanes;
			else break;
		}
		return n;
	};

	for (const r of rows) {
		const base = lanesAt(r.startFt);
		// The auxiliary lane that makes a section a weave is a lane added to
		// whatever cross section is in force there.
		r.lanes = r.seg_type === 'Weaving' ? base + 1 : base;
		if (base !== doc.mainline.lanes) {
			r.why += ` The mainline carries ${base} lanes here.`;
		}
	}

	for (const wz of workZones) {
		const covered = rows.filter(
			(r) => r.startFt >= wz.stationFt - 0.5 && r.startFt + r.length_ft <= wz.endFt + 0.5
		);
		if (covered.length === 0) {
			errors.push(
				`work zone ${wz.id} covers no whole segment, so it would not reach the analysis. Move its ends to segment boundaries, or place a ramp so a boundary falls inside it.`
			);
			continue;
		}
		for (const r of covered) {
			r.work_zone = { ...wz.config };
			// The engine takes a work-zone segment's lane count as the lanes that
			// stay OPEN and folds the closure into CAF_wz and SAF_wz through the
			// lane closure severity index (Equations 10-7, 10-11, 10-12). Example
			// Problem 4 codes its three-to-two closure as a two-lane segment for
			// exactly this reason, so the drawn cross section and the run agree.
			r.lanes = Math.max(1, Math.round(wz.config.open_lanes));
			r.workZoneId = wz.id;
			r.sourceIds = [...r.sourceIds, wz.id];
			r.why += ` A work zone closes ${Math.round(wz.config.total_lanes) - Math.round(wz.config.open_lanes)} of ${Math.round(wz.config.total_lanes)} lanes over this segment, so it is coded with the ${Math.round(wz.config.open_lanes)} lanes that stay open (Chapter 10 Section 4).`;
		}
	}
}

function sectionEnd(s) {
	return s.startFt + s.pieces.reduce((a, p) => a + p.length_ft, 0);
}

/**
 * Build one derived row, attaching the demands and geometry the features on it
 * carry. Which feature contributes what follows the manual's own statement that
 * "a new segment should be started whenever demand volume changes (i.e., at on-
 * and off-ramps)", so on-ramp demand lands on the merge (or weave) that begins
 * at its gore and off-ramp demand on the diverge (or weave) that ends at it.
 */
function row(doc, { key, seg_type, length_ft, startFt, section, why }) {
	const periods = doc.periods;
	const zeros = () => new Array(periods).fill(0);
	const r = {
		key,
		seg_type,
		length_ft,
		startFt,
		// "A new segment should be started whenever capacity changes (i.e., when
		// a full or auxiliary lane is added ...)": the auxiliary lane that makes
		// the section a weave is that added lane, so the weaving segment carries
		// one lane more than the mainline. Example Problem 1's weave is 4 lanes
		// against a 3-lane mainline.
		lanes: seg_type === 'Weaving' ? doc.mainline.lanes + 1 : doc.mainline.lanes,
		on_ramp_demand: zeros(),
		off_ramp_demand: zeros(),
		ramp_to_ramp_demand: zeros(),
		sourceIds: [],
		why,
		overridden: false,
		staleOverride: false
	};

	const on = section?.on;
	const off = section?.off;
	if (seg_type === 'Merge' && on) {
		r.on_ramp_demand = [...on.demand];
		r.ramp_ffs = on.rampFfs;
		r.accel_lane_ft = on.accelLaneFt;
		r.sourceIds = [on.id];
	} else if (seg_type === 'Diverge' && off) {
		r.off_ramp_demand = [...off.demand];
		r.ramp_ffs = off.rampFfs;
		r.decel_lane_ft = off.decelLaneFt;
		r.sourceIds = [off.id];
	} else if (seg_type === 'Weaving' && on && off) {
		r.on_ramp_demand = [...on.demand];
		r.off_ramp_demand = [...off.demand];
		r.ramp_to_ramp_demand = [...on.rampToRampDemand];
		r.ramp_ffs = on.rampFfs;
		r.short_length_ft = section.goreToGoreFt;
		r.num_weaving_lanes = on.numWeavingLanes;
		r.lc_rf = on.lcRf;
		r.lc_fr = on.lcFr;
		r.sourceIds = [on.id, off.id];
	} else if (section) {
		// The overlapping-ramp and in-section basic rows are produced by the
		// pair but carry neither ramp's demand: the demand changes at the gores,
		// which are the merge's and the diverge's boundaries.
		r.sourceIds = [on?.id, off?.id].filter(Boolean);
	}
	return r;
}

/** An override pins one row and survives re-derivation until it is cleared,
 * because an analyst will know something the rules do not. It is keyed by the
 * row's provenance rather than its index, so moving a ramp does not shift an
 * override onto its neighbour. When the row it pins changes type underneath it
 * — dragging a pair across 3,000 ft turns an overlapping ramp into a basic
 * segment — the override is kept and marked stale rather than dropped, since
 * dropping it silently is the failure this design exists to avoid. */
function applyOverrides(doc, rows) {
	const ov = doc.overrides ?? {};
	return rows.map((r) => {
		const o = ov[r.key];
		if (!o) return r;
		const out = { ...r, ...o.fields, overridden: true };
		out.key = r.key;
		out.startFt = r.startFt;
		out.why = r.why;
		out.sourceIds = r.sourceIds;
		out.staleOverride = !!o.appliedTo && o.appliedTo !== r.seg_type;
		out.derivedSegType = r.seg_type;
		out.derivedLengthFt = r.length_ft;
		return out;
	});
}

/** A fixture arrives as a segment list with no feature layer, so there is
 * nothing to derive. The rows are the fixture's own segments, keyed by index,
 * and the segment table is the only editor for them. */
function importedRows(doc) {
	const rows = doc.importedSegments.map((s, i) => ({
		key: `fixture:${i}`,
		seg_type: s.seg_type,
		length_ft: s.length_ft,
		startFt: doc.importedSegments.slice(0, i).reduce((a, p) => a + p.length_ft, 0),
		lanes: s.lanes,
		on_ramp_demand: s.on_ramp_demand ?? [],
		off_ramp_demand: s.off_ramp_demand ?? [],
		ramp_to_ramp_demand: s.ramp_to_ramp_demand ?? [],
		ramp_ffs: s.ramp_ffs,
		accel_lane_ft: s.accel_lane_ft,
		decel_lane_ft: s.decel_lane_ft,
		short_length_ft: s.short_length_ft,
		num_weaving_lanes: s.num_weaving_lanes,
		lc_rf: s.lc_rf,
		lc_fr: s.lc_fr,
		work_zone: s.work_zone,
		sourceIds: [],
		why: 'Imported from a fixture, which stores segments and not the ramps that produced them. There is no feature layer to explain this row, so it is editable only as an override.',
		overridden: false,
		staleOverride: false
	}));
	return { rows: applyOverrides(doc, rows), sections: [], errors: [] };
}

// ── Urban street (HCM Chapters 16/18) ────────────────────────────────────
//
// The urban derivation is structural rather than engine-backed, which the design
// settled and Chapter 18 justifies: a segment is not the output of a branch
// table the way a freeway ramp section is, it is the stretch between two
// boundary intersections. Chapter 18 Section 2, "Urban Street Segment": the
// segment "extends from one boundary intersection to the next", and its through
// control delay, cycle length and effective green all belong to the boundary
// intersection at its DOWNSTREAM end. So the signals partition the street and
// each segment reads its timing off the signal it runs into.
//
// That organization is not an invention of this module. The Chapter 29 Example
// Problem 4 reliability fixture is built the same way, one `boundary_signals`
// entry per segment, indexed by the segment the signal terminates.
//
// Nothing numerical happens here. Every value below is either copied from a
// feature or is a distance between two stations; the free-flow speed chain, the
// access-point delay and the aggregation are all the engines' work.

/** How close two stations have to be to count as the same boundary. Stations are
 * whole feet and the strip snaps to 528, so this only ever collapses a signal an
 * analyst dropped exactly onto a terminus. */
const BOUNDARY_TOL_FT = 0.5;

/** The keys of the library's `UrbanSegment` serde schema that a derived row
 * carries into `add_segment_from_config`. The list is explicit because that
 * method ignores unknown fields silently, so a misspelling would fall back to a
 * serde default and analyze to a plausible wrong number rather than throw. Row
 * bookkeeping (`key`, `startFt`, `why`) is therefore never handed to it. */
export const URBAN_SEGMENT_KEYS = [
	'segment_length_ft',
	'n_through_lanes',
	'speed_limit_mph',
	'through_demand_veh_h',
	'control',
	'upstream_intersection_width_ft',
	'restrictive_median_length_ft',
	'proportion_with_curb',
	'proportion_on_street_parking',
	'n_access_points_subject',
	'n_access_points_opposing',
	'signal_spacing_ft',
	'midsegment_flow_veh_h',
	'through_capacity_veh_h',
	'through_control_delay_s',
	'cycle_length_s',
	'effective_green_s',
	'platoon_ratio',
	'sat_flow_veh_h_ln',
	'arrival_type',
	'full_stop_rate_override',
	'prop_left_turn_lanes',
	'access_point_delays_s',
	'access_point_approaches',
	'analysis_period_h'
];

/** The published Chapter 18 measures that make a segment a summary segment. Any
 * of these present and `add_segment_from_config` stops treating the segment as
 * inputs to recompute, exactly as `add_segment_summary` would. */
export const URBAN_MEASURE_KEYS = [
	'base_ffs_mph',
	'travel_speed_mph',
	'spatial_stop_rate_stops_mi',
	'vc_ratio',
	'los'
];

/**
 * Boundary signals -> the Chapter 18 segment table.
 *
 * @param {object} doc urban builder document
 * @returns {{rows: object[], sections: object[], errors: string[]}}
 */
export function deriveUrbanRows(doc) {
	const errors = [];
	const L = doc.mainline.lengthFt;
	const measures = doc.analysisMode === 'measures';

	const signals = [...doc.features]
		.filter((f) => f.kind === 'signal')
		.sort((a, b) => a.stationFt - b.stationFt || a.id.localeCompare(b.id));
	const accessPoints = [...doc.features]
		.filter((f) => f.kind === 'access_point')
		.sort((a, b) => a.stationFt - b.stationFt || a.id.localeCompare(b.id));

	// The two termini are boundary intersections whether or not a signal sits on
	// them, because the facility has to end somewhere. A signal placed on a
	// terminus supplies that boundary's timing rather than adding a boundary.
	const stations = [0, ...signals.map((s) => clamp(s.stationFt, 0, L)), L].sort((a, b) => a - b);
	const boundaries = [];
	for (const st of stations) {
		if (!boundaries.length || st - boundaries[boundaries.length - 1] > BOUNDARY_TOL_FT) boundaries.push(st);
	}
	const signalAt = (ft) => signals.find((s) => Math.abs(clamp(s.stationFt, 0, L) - ft) <= BOUNDARY_TOL_FT) ?? null;

	// Two signals inside half a foot of each other collapse to one boundary, so
	// the segment between them never existed. Saying so is the point: silently
	// dropping one is how a facility loses an intersection.
	for (let i = 1; i < signals.length; i++) {
		const gap = signals[i].stationFt - signals[i - 1].stationFt;
		if (gap <= BOUNDARY_TOL_FT) {
			errors.push(
				`signals ${signals[i - 1].id} and ${signals[i].id} sit at the same station, so there is no segment between them. Move one, or remove it.`
			);
		}
	}

	const rows = [];
	for (let i = 0; i < boundaries.length - 1; i++) {
		const startFt = boundaries[i];
		const endFt = boundaries[i + 1];
		const upstream = signalAt(startFt);
		const downstream = signalAt(endFt);

		if (!downstream) {
			errors.push(
				`the segment from ${ft(startFt)} to ${ft(endFt)} ends at a terminus with no signal on it, so Chapter 18 has no boundary intersection to take its through control delay, cycle length and effective green from. Place a signal at ${ft(endFt)}.`
			);
		}

		// An access point exactly on a boundary belongs to the segment upstream of
		// it, because that boundary is that segment's downstream end. Only the
		// first segment claims one sitting on station 0, which has no segment
		// upstream of it to belong to.
		//
		// The two bounds are deliberately complementary rather than both
		// tolerant: a point is in exactly one segment. Half-open at each end with
		// a tolerance on both would put a point just past a boundary in the
		// segment before it and the segment after it, and the engine would then
		// count one driveway twice.
		const inside = accessPoints.filter(
			(a) => (i === 0 ? a.stationFt >= startFt : a.stationFt > startFt) && a.stationFt <= endFt
		);
		const subject = inside.filter((a) => a.side !== 'opposing');
		const opposing = inside.filter((a) => a.side === 'opposing');

		rows.push(
			urbanRow(doc, {
				key: `seg:${upstream?.id ?? 'start'}:${downstream?.id ?? 'end'}`,
				startFt,
				endFt,
				upstream,
				downstream,
				subject,
				opposing,
				measures,
				index: i
			})
		);
	}

	if (rows.length === 0) {
		errors.push('The street has no segments. A Chapter 18 segment runs between two boundary intersections, so place at least one signal.');
	}

	return { rows: applyOverrides(doc, rows), sections: [], errors };
}

function clamp(v, lo, hi) {
	return Math.min(hi, Math.max(lo, v));
}

/** One derived urban segment, in the library's own `UrbanSegment` field names so
 * that the row IS the config `add_segment_from_config` takes, less the
 * bookkeeping keys. */
function urbanRow(doc, { key, startFt, endFt, upstream, downstream, subject, opposing, measures, index }) {
	const m = doc.mainline;
	const cfg = downstream?.config ?? {};
	const lengthFt = endFt - startFt;

	const r = {
		key,
		startFt,
		// The freeway chassis keys overrides, staleness and the strip off
		// `seg_type`. For an urban row the type that can change underneath an
		// override is the boundary's control, so that is what fills it.
		seg_type: cfg.control ?? 'Signalized',
		length_ft: lengthFt,
		lanes: m.lanes,

		segment_length_ft: lengthFt,
		n_through_lanes: m.lanes,
		speed_limit_mph: cfg.speed_limit_mph ?? m.speedLimitMph,
		through_demand_veh_h: cfg.through_demand_veh_h,
		control: cfg.control ?? 'Signalized',
		// The width of the intersection at the segment's UPSTREAM end, which is
		// the one Equation 18-3's running-time chain charges to this segment.
		upstream_intersection_width_ft: upstream?.config?.width_ft ?? 0,
		restrictive_median_length_ft: m.restrictiveMedianLengthFt,
		proportion_with_curb: m.proportionWithCurb,
		proportion_on_street_parking: m.proportionOnStreetParking,
		n_access_points_subject: subject.length,
		n_access_points_opposing: opposing.length,
		// Signal spacing and segment length are the same distance here by
		// construction: both boundaries are signals, so the spacing between them
		// is the length between them. Equation 18-4's f_L reads it.
		signal_spacing_ft: lengthFt,
		midsegment_flow_veh_h: cfg.midsegment_flow_veh_h,
		through_capacity_veh_h: cfg.through_capacity_veh_h,
		through_control_delay_s: cfg.through_control_delay_s,
		cycle_length_s: cfg.cycle_length_s,
		effective_green_s: cfg.effective_green_s,
		platoon_ratio: cfg.platoon_ratio ?? undefined,
		sat_flow_veh_h_ln: cfg.sat_flow_veh_h_ln ?? undefined,
		arrival_type: cfg.arrival_type ?? undefined,
		full_stop_rate_override: cfg.full_stop_rate_override ?? undefined,
		prop_left_turn_lanes: m.propLeftTurnLanes,

		sourceIds: [upstream?.id, downstream?.id, ...subject.map((a) => a.id), ...opposing.map((a) => a.id)].filter(Boolean),
		overridden: false,
		staleOverride: false
	};

	// The Equation 18-7 access-point delay term, from whichever of the three
	// sources the access points on this segment actually carry. The library picks
	// among them in this order, so the derivation offers them in it: supplying
	// both a published delay and an approach would otherwise silently favour one.
	const published = subject.filter((a) => Number.isFinite(a.delayS));
	const approaches = subject.filter((a) => a.approach);
	if (published.length) {
		r.access_point_delays_s = published.map((a) => a.delayS);
		r.apDelaySource = 'published';
	} else if (approaches.length) {
		r.access_point_approaches = approaches.map((a) => ({ ...a.approach }));
		r.analysis_period_h = doc.mainline.analysisPeriodH;
		r.apDelaySource = 'computed';
	} else {
		r.apDelaySource = 'planning';
	}

	if (measures) {
		const pub = downstream?.measures ?? {};
		for (const k of URBAN_MEASURE_KEYS) if (pub[k] != null) r[k] = pub[k];
	}

	r.why = whyUrban({ index, startFt, endFt, upstream, downstream, subject, opposing, measures, source: r.apDelaySource });
	return r;
}

function whyUrban({ index, startFt, endFt, upstream, downstream, subject, opposing, measures, source }) {
	const ends = downstream
		? `the signal ${downstream.label || downstream.id} at ${ft(endFt)}`
		: `the downstream terminus at ${ft(endFt)}, which carries no signal`;
	const begins = upstream
		? `the signal ${upstream.label || upstream.id} at ${ft(startFt)}`
		: `the upstream terminus at ${ft(startFt)}`;
	const parts = [
		`Segment ${index + 1} runs ${ft(endFt - startFt)} from ${begins} to ${ends}. A Chapter 18 segment extends from one boundary intersection to the next, and its through control delay, cycle length and effective green belong to the intersection at its downstream end, so this segment reads its timing off ${downstream ? downstream.label || downstream.id : 'nothing'} (Chapter 18, Section 2).`
	];
	if (subject.length || opposing.length) {
		parts.push(
			`${subject.length} access point${subject.length === 1 ? '' : 's'} on the subject side and ${opposing.length} on the opposing side sit inside it, which is the count Exhibit 18-11 note c reads for the f_A adjustment.`
		);
	}
	if (measures) {
		parts.push(
			'This run is in published-measures mode, so the segment carries its Chapter 18 outputs as given and only the Chapter 16 aggregation runs over them (Exhibit 16-7, "HCM method output").'
		);
	} else if (source === 'published') {
		parts.push('Its access-point delay is the per-point values supplied on the access points themselves, which is the first of the three sources Equation 18-7 accepts.');
	} else if (source === 'computed') {
		parts.push('Its access-point delay is computed from the access point approach volumes and geometry by the Chapter 30 Section 4 procedure (Equations 30-31 through 30-68).');
	} else {
		parts.push('No access point here carries a delay or an approach, so the segment falls to the Exhibit 18-13 planning estimate for its access-point delay.');
	}
	return parts.join(' ');
}

// ── "Why this segment?" ──────────────────────────────────────────────────

function ft(n) {
	return `${Math.round(n).toLocaleString('en-US')} ft`;
}

function whyPair(gore, aux, pieces) {
	const shape = pieces.map((p) => (p.seg_type === 'OverlappingRamp' ? 'overlapping ramp' : p.seg_type.toLowerCase())).join(' + ');
	if (aux) {
		return `An auxiliary lane connects the two gores, so the whole section is one weaving segment (Exhibit 10-12). Its boundaries sit 500 ft outside each gore per Exhibit 10-2, so the ${ft(gore)} gore-to-gore distance becomes a ${ft(gore + 2 * WEAVE_EXTENSION_FT)} segment with a ${ft(gore)} short length.`;
	}
	if (gore > 3000) {
		return `Gore-to-gore ${ft(gore)}, above 3,000 ft, so the two 1,500-ft influence areas do not touch and the section is coded ${shape}, with the basic segment taking the spacing less 3,000 ft (Exhibit 10-11).`;
	}
	if (gore > 1500) {
		return `Gore-to-gore ${ft(gore)}, between 1,500 and 3,000 ft, so the two influence areas overlap and the section is coded ${shape}. The overlap is 3,000 ft less the spacing and the merge and diverge are the spacing less 1,500 ft (Exhibit 10-11).`;
	}
	return `Gore-to-gore ${ft(gore)}, at or below 1,500 ft with no auxiliary lane, which the manual calls highly unusual. The influence areas are truncated at the adjacent gore and the worst case applies over the whole distance, so the section is one overlapping ramp segment (Chapter 10 Section 2).`;
}

function whyIsolated(kind, f, len, ria) {
	const dir = kind === 'Merge' ? 'downstream of' : 'upstream of';
	const base = `The ${kind === 'Merge' ? 'on' : 'off'}-ramp at station ${ft(f.stationFt)} has no paired ramp forming a section with it, so its influence area alone is the segment: ${ft(ria)} ${dir} the gore (Exhibit 10-1).`;
	if (len < ria - 0.5) {
		return `${base} It is truncated to ${ft(len)} at the adjacent gore point, per the same rule the manual gives for sub-1,500-ft ramp spacing.`;
	}
	return base;
}
