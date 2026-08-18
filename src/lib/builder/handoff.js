// The bridge from a released chapter page into the builder: "Open in Builder".
//
// The carrier is the library's own serde fixture schema and not the builder
// document, and that is the honest choice rather than the convenient one. A
// chapter page holds SEGMENTS, which is what its engine takes. The builder
// document holds FEATURES an analyst placed, and segments are derived from
// them. Going from segments back to features is only possible where the chapter
// makes it possible, and fixture.js already draws that line: an urban and a
// two-lane fixture invert exactly, a freeway one does not and arrives as a
// segment list with no feature layer. Handing over a fixture puts every page on
// whichever of those two the chapter actually supports, and the builder shows
// its normal imported-fixture state either way. Nothing here invents a feature.
//
// Transport is sessionStorage rather than the URL, because an eleven-segment
// facility with five demand periods per ramp is several kilobytes and a query
// string has no business carrying it. The key is read once on the builder's
// mount and removed in the same call, so a later reload of /builder shows the
// autosaved slot rather than replaying a handoff the analyst has moved on from.
//
// The `dropped` list is the other half of honesty. Whatever a page holds that
// the builder cannot represent is named on it, and the builder prints it beside
// the existing carried/dropped disclosure. A page that loses nothing sends an
// empty list, which is a claim worth making explicitly.

const KEY = 'hcm-builder-handoff';

/**
 * Write the payload, so a caller can navigate afterwards.
 *
 * A failed write THROWS rather than being swallowed, which is the opposite of
 * how the builder's own autosave treats a full or disabled store, and for a
 * reason. A dropped autosave costs the analyst nothing they can see; a dropped
 * handoff would let the navigation go through and land them in the builder
 * holding whatever facility was in the slot from yesterday, looking for all the
 * world like the one they just sent. Better to stay on the page and say so.
 */
export function putHandoff(payload) {
	if (typeof sessionStorage === 'undefined') {
		throw new Error('This browser has no session storage, so the facility cannot be carried across.');
	}
	sessionStorage.setItem(KEY, JSON.stringify(payload));
}

/** Read the payload and clear it in the same call, so it is consumed exactly
 * once. Returns null when there is nothing waiting. */
export function takeHandoff() {
	if (typeof sessionStorage === 'undefined') return null;
	let raw;
	try {
		raw = sessionStorage.getItem(KEY);
		sessionStorage.removeItem(KEY);
	} catch {
		return null;
	}
	if (!raw) return null;
	try {
		const payload = JSON.parse(raw);
		if (!payload || typeof payload !== 'object' || !payload.fixture) return null;
		return payload;
	} catch {
		return null;
	}
}

// ── Shared coercion ──────────────────────────────────────────────────────
//
// Every chapter page binds its inputs to text or number fields, so a value that
// started life as the number 12 is the string "12" the moment anyone types in
// it. The fixture schema is numbers. These do that conversion in one place, and
// each has a rule about the empty field, because "" and 0 are different answers
// and the pages already treat them as different.

/** A required numeric field. An unparseable value throws rather than becoming
 * NaN, because NaN serializes to JSON `null` and would land on a serde default
 * three layers downstream as a finished-looking wrong answer. */
function num(v, what) {
	const n = Number(v);
	if (!Number.isFinite(n)) throw new Error(`${what} is not a number`);
	return n;
}

/** An optional numeric field. Blank means "the page did not state this", which
 * the fixture expresses by omitting the key, so this returns undefined and the
 * caller drops it. */
function opt(v) {
	if (v === '' || v == null) return undefined;
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
}

/** Drop every key whose value is undefined, so an omitted optional field is
 * absent from the fixture rather than present as null. The library's serde
 * treats an absent key as "take the default" and a null as a type error. */
function compact(o) {
	return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

/** The demand lists on the freeway page, parsed the way that page parses them.
 * COMMAS ONLY, which is not a detail to normalize away: `parseList` there splits
 * on commas, so "450 540" is one unparseable token it drops, and a parser here
 * that also split on whitespace would carry a demand the page never analyzed
 * with. Carrying exactly what the page holds means carrying its parser too. */
function commaList(text) {
	return String(text ?? '')
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0)
		.map(Number)
		.filter((v) => Number.isFinite(v));
}

/** The access-point delay lists on the urban pages, parsed the way those pages
 * parse them: `parseDelays` splits on commas OR whitespace, so this one does
 * too, for the same reason `commaList` does not. */
function delayList(text) {
	const parts = String(text ?? '')
		.split(/[,\s]+/)
		.filter((t) => t.length > 0);
	const nums = parts.map(Number);
	// The pages treat a negative or unparseable delay as an error rather than
	// dropping it, and so does this: a list that silently lost an entry would
	// attach the remaining delays to the wrong access points.
	if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
		throw new Error('Access point delays must be a list of nonnegative numbers.');
	}
	return nums;
}

// ── Chapter 10, freeway facilities ───────────────────────────────────────

/** The hcm10 page writes lower-case terrain and area type into its selects; the
 * fixture schema and the builder's own selects are title case. Carried through
 * a map rather than a `charAt(0).toUpperCase()` so an unrecognized value throws
 * here instead of arriving at the builder as an option that matches nothing and
 * silently shows the first entry. */
const TERRAIN = { level: 'Level', rolling: 'Rolling', mountainous: 'Mountainous' };
const CITY_TYPE = { urban: 'Urban', rural: 'Rural' };

/**
 * The hcm10 form to a `FreewayFacilities` fixture.
 *
 * A freeway fixture is the one of the three that does not invert, so this
 * arrives at the builder as segments with no feature layer, editable through
 * the override column. That is the builder's existing imported state and not a
 * reduced one, and it is what the chapter page holds anyway: the page's form IS
 * a segment table.
 *
 * The managed lane is the one thing the page can hold that the builder cannot.
 * Chapter 10's Steps A-9 through A-17 analyze a parallel lane group, and the
 * builder document has no second lane group at all, so an enabled managed lane
 * is named in `dropped` rather than quietly left behind.
 */
export function freewayHandoff(page) {
	const demand = commaList(page.mainline_demand);
	if (demand.length === 0) throw new Error('Enter at least one mainline demand value first.');

	const terrain = TERRAIN[page.terrain];
	const cityType = CITY_TYPE[page.city_type];
	if (!terrain) throw new Error(`unknown terrain "${page.terrain}"`);
	if (!cityType) throw new Error(`unknown area type "${page.city_type}"`);

	const segments = page.segments.map((s, i) => {
		const onRamp = commaList(s.on_ramp);
		const offRamp = commaList(s.off_ramp);
		const rampToRamp = commaList(s.ramp_to_ramp);
		const weaving = s.seg_type === 'Weaving';
		const ramp = weaving || s.seg_type === 'Merge' || s.seg_type === 'Diverge';
		return compact({
			seg_type: s.seg_type,
			length_ft: num(s.length_ft, `segment ${i + 1} length`),
			lanes: num(s.lanes, `segment ${i + 1} lanes`),
			// The ramp geometry fields are written only for the segment types that
			// read them, which is a deliberate difference from what the page does.
			// The page shows those inputs on every row and passes all of them into
			// `WasmFacilitySegment` regardless of type, because the positional
			// constructor has no way to say "absent"; the engine then ignores an
			// acceleration lane on a basic segment. A fixture does have a way to say
			// absent, and the library's own hand-written ones use it, so writing a
			// 500 ft acceleration lane onto every basic segment would make an export
			// from the builder unlike any fixture in the tree while changing no
			// number. Chapter 25 Example Problem 1 reproduces to 56.9 mi/h either
			// way, which is the check that this is a presentation choice and not a
			// dropped input.
			ramp_ffs: ramp ? opt(s.ramp_ffs) : undefined,
			accel_lane_ft: s.seg_type === 'Merge' || weaving ? opt(s.accel) : undefined,
			decel_lane_ft: s.seg_type === 'Diverge' || weaving ? opt(s.decel) : undefined,
			short_length_ft: weaving ? opt(s.short_length) : undefined,
			num_weaving_lanes: weaving ? opt(s.weaving_lanes) : undefined,
			lc_rf: weaving ? opt(s.lc_rf) : undefined,
			lc_fr: weaving ? opt(s.lc_fr) : undefined,
			on_ramp_demand: onRamp.length ? onRamp : undefined,
			off_ramp_demand: offRamp.length ? offRamp : undefined,
			ramp_to_ramp_demand: rampToRamp.length ? rampToRamp : undefined,
			// Already the engine's `WorkZone` serde shape, because the page built it
			// that way to call `set_work_zone`. Passed through whole rather than
			// rebuilt field by field, so a field added upstream reaches the builder
			// without a second mapping to keep in step.
			work_zone: s.work_zone ? page.workZoneConfig(s.work_zone) : undefined
		});
	});

	const fixture = compact({
		mainline_demand: demand,
		ffs: num(page.ffs, 'free-flow speed'),
		heavy_vehicle_pct: num(page.hv_pct, 'heavy vehicle percentage') / 100,
		terrain,
		city_type: cityType,
		phf: num(page.phf, 'peak hour factor'),
		jam_density_pc: num(page.jam_density, 'jam density'),
		queue_discharge_drop: num(page.queue_discharge_drop, 'queue discharge drop') / 100,
		total_ramp_density: num(page.total_ramp_density, 'total ramp density'),
		interchange_density: opt(page.interchange_density),
		segments
	});

	return {
		v: 1,
		from: '/hcm10',
		label: 'the Chapter 10 freeway facilities page',
		facilityType: 'freeway',
		name: 'Freeway facility from Chapter 10',
		fixture,
		dropped: page.ml_enabled
			? ['the adjacent managed lane, which the builder has no second lane group for']
			: []
	};
}

// ── Chapter 15, two-lane highways ────────────────────────────────────────

const PASSING_TYPE_INDEX = { 'Passing Constrained': 0, 'Passing Zone': 1, 'Passing Lane': 2 };

/**
 * The hcm15 form to a `TwoLaneHighways` fixture.
 *
 * This one inverts, so the builder recovers the grades, passing features and
 * horizontal curves and the highway arrives editable as features rather than as
 * a segment table. `fromTwoLaneFixture` does that work; nothing here anticipates
 * it.
 *
 * Two subsegment keys need saying. The page has no editor for `central_angle` or
 * `hor_class` and passes zero for both into its own `WasmSubSegment` call, so
 * zero is what the page holds and zero is what crosses. They are not in
 * `dropped`, because nothing is lost: the engine derives the horizontal class
 * from the radius and the superelevation in Step 5d either way, and a zero
 * central angle is what the page analyzed with.
 *
 * `l_de` likewise: the page has no input for it and hardcodes 0.0 on export, so
 * 0.0 is the honest value to carry rather than the library's own default.
 */
export function twoLaneHandoff(page) {
	const segments = page.rows.map((row, i) => {
		const passingType = PASSING_TYPE_INDEX[row.passing_type];
		if (passingType === undefined) {
			throw new Error(`Choose a passing type for segment ${i + 1} first.`);
		}
		const isHc = !!row.is_hc;
		return compact({
			passing_type: passingType,
			length: num(row.seg_length, `segment ${i + 1} length`),
			grade: num(row.seg_grade, `segment ${i + 1} grade`),
			spl: num(row.seg_spl, `segment ${i + 1} speed limit`),
			is_hc: isHc,
			volume: num(row.vi, `segment ${i + 1} directional demand`),
			volume_op: num(row.vo, `segment ${i + 1} opposing demand`),
			vertical_class: num(row.vertical_class, `segment ${i + 1} vertical class`),
			phf: num(row.phf, `segment ${i + 1} peak hour factor`),
			phv: num(row.phv, `segment ${i + 1} heavy vehicle percentage`),
			// Only a segment the page marked as containing horizontal curvature has
			// subsegments. Writing the page's placeholder row for a segment with
			// `is_hc` off would put a zero-length zero-radius subsegment into the
			// fixture, which is not what the page analyzed and not what a
			// hand-written fixture carries.
			subsegments: isHc
				? row.subrows.map((ss, k) =>
						compact({
							length: num(ss.subseg_length, `segment ${i + 1} subsegment ${k + 1} length`),
							design_rad: num(ss.design_radius, `segment ${i + 1} subsegment ${k + 1} radius`),
							sup_ele: num(ss.superelevation, `segment ${i + 1} subsegment ${k + 1} superelevation`),
							central_angle: 0,
							hor_class: 0
						})
					)
				: undefined
		});
	});

	return {
		v: 1,
		from: '/hcm15',
		label: 'the Chapter 15 two-lane highways page',
		facilityType: 'twolane',
		name: 'Two-lane highway from Chapter 15',
		fixture: {
			lane_width: num(page.lane_width, 'lane width'),
			shoulder_width: num(page.shoulder_width, 'shoulder width'),
			apd: num(page.apd, 'access point density'),
			pmhvfl: num(page.pmhvfl, 'heavy vehicles in the passing lane'),
			// The page has no input for the effective downstream length and writes
			// 0.0 on its own JSON export. Carrying that rather than omitting the key
			// keeps the two exports saying the same thing.
			l_de: 0.0,
			segments
		},
		dropped: []
	};
}

// ── Chapters 16 and 18, urban streets ────────────────────────────────────

/** The pages' lower-case control values to the `BoundaryControlType` variant
 * names serde expects. `yield` is `YieldControlled` and not `Yield`, which is
 * the kind of mismatch that would deserialize to a default rather than throw. */
const CONTROL = {
	signalized: 'Signalized',
	allwaystop: 'AllWayStop',
	yield: 'YieldControlled',
	roundabout: 'Roundabout',
	uncontrolled: 'Uncontrolled'
};

/**
 * One urban segment's inputs to the `UrbanSegment` serde schema.
 *
 * Shared by hcm16's inputs mode and hcm18, because the two hold the same
 * per-segment fields under the same names: hcm18 is one segment as flat page
 * state and an hcm16 row is the same thing in an array. Written once so the two
 * cannot drift, which is the failure the builder's own `URBAN_SEGMENT_KEYS`
 * comment describes from the other side.
 *
 * Every field here is in `URBAN_SEGMENT_KEYS`, so every field reaches the
 * engine through the builder's `add_segment_from_config`. The two urban inputs
 * that are NOT are handled by the caller: see `urbanDropped`.
 */
export function urbanSegmentInputs(s) {
	const control = CONTROL[s.control];
	if (!control) throw new Error(`unknown boundary control "${s.control}"`);
	const signalized = s.control === 'signalized';
	const delays = delayList(s.ap_delays);
	return compact({
		segment_length_ft: num(s.segment_length, 'segment length'),
		n_through_lanes: num(s.n_through_lanes, 'through lanes'),
		speed_limit_mph: num(s.speed_limit, 'speed limit'),
		through_demand_veh_h: num(s.through_demand, 'through demand'),
		control,
		upstream_intersection_width_ft: num(s.upstream_width, 'upstream intersection width'),
		restrictive_median_length_ft: num(s.restrictive_median_length, 'restrictive median length'),
		// PERCENT on every chapter page, DECIMAL in the schema and in the engine.
		// The pages divide inline at the call site rather than storing decimals, so
		// the division belongs here too.
		proportion_with_curb: num(s.pct_curb, 'proportion with curb') / 100,
		proportion_on_street_parking: num(s.pct_parking, 'on-street parking') / 100,
		n_access_points_subject: num(s.access_points_subject, 'subject-side access points'),
		n_access_points_opposing: num(s.access_points_opposing, 'opposing-side access points'),
		signal_spacing_ft: opt(s.signal_spacing),
		midsegment_flow_veh_h: opt(s.midsegment_flow),
		through_capacity_veh_h: opt(s.through_capacity),
		// Uncontrolled through movements have no control delay by the Chapter 18
		// text, and the page suppresses the field rather than showing a zero.
		through_control_delay_s: s.control === 'uncontrolled' ? undefined : opt(s.through_delay),
		cycle_length_s: signalized ? opt(s.cycle_length) : undefined,
		effective_green_s: signalized ? opt(s.effective_green) : undefined,
		platoon_ratio: signalized ? opt(s.platoon_ratio) : undefined,
		sat_flow_veh_h_ln: signalized ? opt(s.sat_flow) : undefined,
		// `arrival_type` stays absent on purpose. No chapter page sets it; hcm18
		// passes undefined and says platoon ratio is used instead, so writing one
		// here would be inventing an input the page never had.
		full_stop_rate_override: opt(s.stop_rate_override),
		// The three access-point delay sources are exclusive, and the pages keep
		// all three subforms' state alive so switching back does not lose what was
		// typed. So each source's fields are written only when it is the live one.
		// hcm16 has no source selector at all and is always measured, which is why
		// an absent `ap_source` takes the measured branch rather than none.
		access_point_delays_s:
			(s.ap_source == null || s.ap_source === 'measured') && delays.length ? delays : undefined,
		access_point_approaches: s.ap_source === 'computed' && s.ap_approaches?.length
			? s.ap_approaches.map((a) => ({ ...a }))
			: undefined,
		analysis_period_h: s.ap_source === 'computed' ? opt(s.analysis_period) : undefined,
		n_influential_access_points: s.ap_source === 'planning' ? opt(s.n_influential_access_points) : undefined,
		pct_left_turns_access: s.ap_source === 'planning' ? opt(s.pct_left_turns_access) : undefined,
		pct_right_turns_access: s.ap_source === 'planning' ? opt(s.pct_right_turns_access) : undefined,
		access_left_bay_adequate: s.ap_source === 'planning' ? !!s.access_left_bay_adequate : undefined,
		access_right_bay_adequate: s.ap_source === 'planning' ? !!s.access_right_bay_adequate : undefined
	});
}

/**
 * What an urban inputs-mode segment holds that the builder's analysis will not
 * read, named per segment so the disclosure says which one.
 *
 * Both entries are in the builder's own `URBAN_UNCARRIED_FIELDS`: they are keys
 * of `UrbanSegment` with no editor in the builder, and more to the point they
 * are not in `URBAN_SEGMENT_KEYS`, so the builder's `segmentConfig` never hands
 * them to the engine. They still ride along in the exported fixture, because
 * the import keeps the original parse and merges onto it, but the number the
 * builder computes will not have seen them.
 *
 * Reported only when the page actually holds a value that differs from the
 * library default, because a list that always names the same two fields stops
 * being read. `prop_opposing_left_accessible` defaults to 1.0 in the engine
 * (`urban_segments.rs`), which is the pages' own default of 100 percent, so at
 * the default nothing is lost and there is nothing to report.
 */
export function urbanDropped(s, label = '') {
	const where = label ? ` on ${label}` : '';
	const out = [];
	const accessible = opt(s.pct_opposing_left_accessible);
	if (accessible !== undefined && accessible !== 100) {
		out.push(
			`the opposing left-turn accessibility of ${accessible}%${where}, which the builder keeps in an exported fixture but does not feed to the engine`
		);
	}
	if (opt(s.ffs_override) !== undefined) {
		out.push(
			`the free-flow speed override of ${s.ffs_override} mi/h${where}, which the builder keeps in an exported fixture but does not feed to the engine`
		);
	}
	return out;
}

/** What the hcm16 summary mode is short of, in the page's own vocabulary. Named
 * once here so the page's explanation and this module's refusal cannot drift
 * apart. */
export const SUMMARY_MODE_MISSING = 'a through demand, a through-lane count and a speed limit per segment';

/**
 * The hcm16 form to an `UrbanFacilities` fixture. INPUTS MODE ONLY, and the
 * reason is worth stating because the opposite looks obviously right.
 *
 * The schema has measure keys, the builder has an `analysisMode: 'measures'`
 * document, and its fixture import already decides the mode by whether any
 * measure key is present. So a summary facility looks like it should cross
 * unchanged. It cannot, and the wall is not a builder limitation: `UrbanSegment`
 * requires `through_demand_veh_h`, and deserializing a segment without one fails
 * with `missing field through_demand_veh_h` before the builder gets a say. The
 * library's own Chapter 29 Example Problem 1 fixture supplies 800 veh/h for
 * exactly that reason, and its `_source` note is candid that the number is
 * representative rather than published.
 *
 * The hcm16 summary form does not hold a demand, a lane count or a speed limit,
 * because Exhibit 16-7's "HCM method output" case does not need them: it holds a
 * length and five already-computed measures per segment. Supplying the three
 * would mean writing inputs into a fixture that no analyst entered and that the
 * builder would then draw as a cross-section and print in a segment table. That
 * is the fabrication this whole handoff exists to avoid, so summary mode does
 * not cross and the page says so instead of offering a link that lies.
 *
 * The throw is defence in depth. The page does not render the affordance in
 * summary mode, so nothing should reach here.
 */
export function urbanFacilityHandoff(page) {
	if (page.mode === 'measures') {
		throw new Error(
			`Summary mode holds published segment measures and no cross-section, and the builder needs ${SUMMARY_MODE_MISSING}. Switch to segment inputs to carry this facility across.`
		);
	}

	return {
		v: 1,
		from: '/hcm16',
		label: 'the Chapter 16 urban street facilities page',
		facilityType: 'urban',
		name: 'Urban street facility from Chapter 16',
		fixture: {
			prop_left_turn_lanes: num(page.inputs_pct_left_turn_lanes, 'left-turn lane percentage') / 100,
			segments: page.inputSegments.map((s) => urbanSegmentInputs(s))
		},
		dropped: page.inputSegments.flatMap((s, i) => urbanDropped(s, `segment ${i + 1}`))
	};
}

/**
 * The hcm18 form to a one-segment `UrbanFacilities` fixture.
 *
 * A Chapter 18 segment is not a facility, and this is the one place the handoff
 * changes what the page is looking at rather than only how it is written down.
 * A one-segment urban facility is a real fixture and the builder derives it from
 * two boundary signals, so the segment's own travel speed and LOS come back
 * unchanged. What is new on the other side is a facility aggregation over a
 * single segment, which Chapter 16 defines and which reduces to that segment.
 * So nothing is lost and nothing is invented; there is simply one more number.
 */
export function urbanSegmentHandoff(page) {
	return {
		v: 1,
		from: '/hcm18',
		label: 'the Chapter 18 urban street segments page',
		facilityType: 'urban',
		name: 'Urban street segment from Chapter 18',
		fixture: {
			prop_left_turn_lanes: num(page.pct_left_turn_lanes, 'left-turn lane percentage') / 100,
			segments: [urbanSegmentInputs(page)]
		},
		dropped: urbanDropped(page)
	};
}
