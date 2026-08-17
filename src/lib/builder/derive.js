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
	if (doc.importedSegments) return importedRows(doc);

	const errors = [];
	const L = doc.mainline.lengthFt;
	const ria = api.ramp_influence_area_ft();
	const feats = [...doc.features].sort(
		(a, b) => a.stationFt - b.stationFt || a.id.localeCompare(b.id)
	);

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
	const rows = [];
	let cursor = 0;
	const pushBasic = (from, to, afterKey) => {
		const len = to - from;
		if (len <= 0.5) return; // sub-foot slivers are rounding, not segments
		rows.push(
			row(doc, {
				key: `gap:${afterKey}`,
				seg_type: BASIC,
				length_ft: len,
				startFt: from,
				section: null,
				why: `Unassigned stretch between the ramp segments around it, so it is a basic freeway segment (Chapter 10 Section 2, last segmentation rule).`
			})
		);
	};

	for (const s of sections) {
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

	return { rows: applyOverrides(doc, rows), sections, errors };
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
		sourceIds: [],
		why: 'Imported from a fixture, which stores segments and not the ramps that produced them. There is no feature layer to explain this row, so it is editable only as an override.',
		overridden: false,
		staleOverride: false
	}));
	return { rows: applyOverrides(doc, rows), sections: [], errors: [] };
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
