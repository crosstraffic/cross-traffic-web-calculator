// Builder document -> HCM Chapter 15 run, over the segments the terrain,
// passing and demand features derived.
//
// The construction is the one tests/boundary/ch15_twolanehighways.mjs uses and
// the one src/routes/hcm15/+page.svelte uses, in that order of precedence where
// they differ, and they differ in two places worth naming.
//
// The page passes five arguments to `WasmTwoLaneHighways` and the boundary file
// passes six. The sixth is `l_de`, the facility's effective downstream length of
// a passing lane, and it matters twice: it seeds Step 9, and the binding keeps
// the constructor's value so that `determine_facility_follower_density` can
// restore it. Every published fixture passes 0. This module passes it.
//
// The page also builds its subsegments with `central_angle` and `hor_class`
// forced to zero and reads `subseg.design_radius` on import, which is not the
// field name the library's fixtures use. This module writes the library's schema
// (`design_rad`, `central_angle`, `hor_class`, `sup_ele`), which is what makes
// case2's eleven subsegments reach the engine at all.
//
// ORDER IS LOAD-BEARING AND THE FAILURE IS SILENT. `TwoLaneHighways` is not
// idempotent: Step 9 records the passing lane's effective downstream length on
// the FACILITY, and a segment is adjusted when its distance from the passing
// lane is below it. Walking segments in order keeps that value unset while the
// walk is still upstream of the lane. Run the Step 9 loop first and then ask for
// the facility value and the upstream segments, whose distance is zero, are
// adjusted too. On case4 that is 14.936 followers/mi instead of 19.897. The
// binding restores the constructor's value inside
// `determine_facility_follower_density`, which is why that call is safe after
// the loop below and why nothing here reweights the per-segment column by hand.
//
// Nothing here reads a rune or touches the DOM, so tests/builder/twolane.mjs
// runs it under plain node against the same wasm the page loads.

import { TWOLANE_SEGMENT_KEYS } from './derive.js';

/** The Chapter 15 segment schema for one derived row, and nothing else. Built
 * from an explicit key list for the same reason the urban one is. */
export function segmentConfig(row) {
	const cfg = {};
	for (const k of TWOLANE_SEGMENT_KEYS) if (row[k] != null) cfg[k] = clone(row[k]);
	return cfg;
}

function clone(v) {
	if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? { ...x } : x));
	return v && typeof v === 'object' ? { ...v } : v;
}

/** Build the wasm facility from the derived rows.
 *
 * Exported because a run consumes it: wasm-bindgen takes ownership of every
 * `WasmSegment` and `WasmSubSegment` handed to a constructor, so a second
 * analysis needs a second facility built from scratch. Callers that want to ask
 * the engine one more question build another one rather than reusing this.
 */
export function buildFacility(doc, rows, wasm) {
	const segments = rows.map((r) => {
		// The subsegment constructor order is (length, avg_speed, design_rad,
		// central_angle, hor_class, sup_ele), which is NOT the core's
		// SubSegment::new order; the binding reorders internally. Lengths here are
		// FEET while the segment length two lines down is miles.
		const subs = (r.subsegments ?? []).map(
			(ss) =>
				new wasm.WasmSubSegment(ss.length, ss.avg_speed, ss.design_rad, ss.central_angle, ss.hor_class, ss.sup_ele)
		);
		return new wasm.WasmSegment(
			r.passing_type,
			r.length,
			r.grade,
			r.spl,
			r.is_hc,
			r.volume,
			r.volume_op,
			r.flow_rate,
			r.flow_rate_o,
			r.capacity,
			r.ffs,
			r.avg_speed,
			r.vertical_class,
			subs,
			r.phf,
			r.phv,
			r.pf,
			r.fd,
			r.fd_mid,
			r.hor_class
		);
	});
	const m = doc.mainline;
	return new wasm.WasmTwoLaneHighways(
		segments,
		m.laneWidthFt,
		m.shoulderWidthFt,
		m.accessPointDensity,
		m.pctHeavyVehInPassingLane,
		m.effectiveDownstreamLengthMi
	);
}

/**
 * Run Chapter 15 on the built facility.
 *
 * Returns a plain frozen snapshot with the wasm handle dropped, so the result
 * cannot change when the document is edited afterwards and the printable report
 * cannot drift from the run that produced it.
 *
 * @param {object} doc builder document
 * @param {object[]} rows derived rows, overrides already applied
 * @param {object} wasm the module namespace
 */
export function analyzeTwoLaneFacility(doc, rows, wasm) {
	if (!rows.length) throw new Error('the highway has no segments, so there is nothing to analyze');
	const fac = buildFacility(doc, rows, wasm);

	const segments = [];
	let totalLengthFt = 0;
	let splWeighted = 0;

	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		// Step 1. The return is Exhibit 15-10's recommended minimum and maximum
		// segment length in miles for this segment's class and passing type. The
		// library computes it and then consumes it nowhere, so reading it here is
		// the only way the recommendation reaches anyone.
		fac.identify_vertical_class(i);
		// Step 2.
		const [flowRate, opposingFlow, capacity] = fac.determine_demand_flow(i);
		// Step 3. This overwrites the vertical class when the grade and the length
		// imply a different one, so the bounds are re-read after it rather than
		// before, and the class the later steps used is the one reported.
		const verticalAlignment = fac.determine_vertical_alignment(i);
		const [minLengthMi, maxLengthMi] = fac.identify_vertical_class(i);
		// Step 4. BFFS is 1.14 x the POSTED limit inside here.
		const ffs = fac.determine_free_flow_speed(i);
		// Step 5, including the Step 5d subsegment walk when is_hc is set.
		const [avgSpeed, horClass] = fac.estimate_average_speed(i);
		// Step 6.
		const percentFollowers = fac.estimate_percent_followers(i);

		// Steps 7 and 8. A passing lane reports its midpoint follower density;
		// every other segment reports the plain value, or the adjusted one when it
		// falls inside the effective length downstream of a passing lane. Step 9
		// runs for every segment, passing lanes included, because it is what
		// advances the passing-lane bookkeeping later segments read.
		const isPl = r.passing_type === 2;
		let followerDensity;
		let fdMid = null;
		let fd = null;
		if (isPl) {
			const [endpoint, mid] = fac.determine_follower_density_pl(i);
			fd = endpoint;
			fdMid = mid;
			followerDensity = mid;
		} else {
			fd = fac.determine_follower_density_pc_pz(i);
		}
		const fdAdjustment = fac.determine_adjustment_to_follower_density(i);
		if (!isPl) followerDensity = fdAdjustment > 0 ? fdAdjustment : fd;

		// Step 10. The average speed is passed rather than the posted limit,
		// matching the boundary file and the hcm15 page. Exhibit 15-6 bands by
		// posted limit, and the facility call below does pass it, but the segment
		// call is pinned at the boundary against the library's own
		// determine_segment_los_test and is left alone here rather than corrected
		// in one caller only.
		const los = fac.determine_segment_los(i, avgSpeed, capacity);

		totalLengthFt += r.length_ft;
		splWeighted += r.spl * r.length_ft;

		segments.push({
			index: i,
			key: r.key,
			startFt: r.startFt,
			lengthFt: r.length_ft,
			lengthMi: r.length,
			lanes: r.lanes,
			segType: r.seg_type,
			passingType: r.passing_type,
			demotedPassingLane: !!r.demotedPassingLane,
			isHc: !!r.is_hc,
			subsegmentCount: (r.subsegments ?? []).length,
			curveCount: (r.subsegments ?? []).filter((s) => s.design_rad > 0).length,
			grade: r.grade,
			spl: r.spl,
			volume: r.volume,
			volumeOpposing: r.volume_op,
			flowRate,
			opposingFlow,
			capacity,
			ffs,
			avgSpeed,
			percentFollowers,
			followerDensity,
			fd,
			fdMid,
			fdAdjustment,
			horClass,
			verticalClassEntered: r.vertical_class,
			verticalAlignment,
			// Exhibit 15-10, off the engine rather than out of a second copy of the
			// table. `outsideRecommended` is the check Step 1 asks for and the
			// library performs nowhere.
			minLengthMi,
			maxLengthMi,
			outsideRecommended: r.length < minLengthMi - 1e-9 || r.length > maxLengthMi + 1e-9,
			los,
			overridden: !!r.overridden
		});
	}

	// Step 11, Equation 15-39. The engine does the length weighting and picks
	// FD_i per segment the same way the column above does, since the equation
	// reads "follower density, or adjusted follower density, for segment i".
	// Reweighting the column here instead agrees on a single-segment facility and
	// stops agreeing the moment a passing lane appears: on Chapter 26 Example
	// Problem 3 it gives 8.041 and LOS D where the equation gives 7.271 and LOS C
	// and Exhibit 26-27 publishes 7.3 and C.
	const facilityFd = fac.determine_facility_follower_density();
	// Exhibit 15-6 splits its bands by POSTED SPEED LIMIT, by its own column
	// headings, not by average speed. The HCM defines no facility-level posted
	// limit, so it is length-weighted, which reduces to the common value when the
	// highway posts one limit throughout.
	const weightedSpl = splWeighted / totalLengthFt;
	const los = fac.determine_facility_los(facilityFd, weightedSpl);

	return deepFreeze({
		los,
		facilityFd,
		weightedSpl,
		lengthFt: totalLengthFt,
		segments,
		facilityName: doc.meta?.name ?? 'Untitled two-lane highway',
		direction: doc.mainline?.direction ?? '',
		// Chapter 15 is single-period. Carried on the result rather than assumed by
		// the view, the same way the urban result carries it.
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
