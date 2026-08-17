// Inline validation for the builder, non-blocking except where the facility is
// genuinely un-analyzable.
//
// Every rule below is either something `FreewayFacility::validate` rejects, or
// something the engine accepts and then mis-handles silently. Nothing here is
// invented, and one rule that a reasonable person would expect is deliberately
// absent: there is no cap on the number of analysis periods. Chapter 10
// Section 3 says so in as many words, "There is no limit to the number of
// analysis periods that can be analyzed", and the guidance it gives instead is
// about the temporal extent containing the queues, which is what the note
// below says.

const ERROR = 'error';
const WARN = 'warn';
const NOTE = 'note';

/**
 * @param {object} doc
 * @param {object[]} rows derived rows
 * @param {string[]} deriveErrors errors raised during derivation
 * @returns {{level: string, id: string, message: string, cite: string, rowKey?: string, featureId?: string}[]}
 */
export function validateFacility(doc, rows, deriveErrors = []) {
	const out = [];
	const add = (level, id, message, cite, extra = {}) =>
		out.push({ level, id, message, cite, ...extra });

	for (const e of deriveErrors) {
		add(ERROR, 'derivation', e, 'HCM Chapter 10, Section 2 (segmentation rules)');
	}

	// ── What FreewayFacility::validate rejects ───────────────────────────
	if (rows.length === 0) {
		add(ERROR, 'no-segments', 'The facility has no segments.', 'FreewayFacility::validate');
	}
	if (!doc.mainline.demand?.length) {
		add(
			ERROR,
			'no-periods',
			'The facility has no analysis periods, because the mainline demand vector is empty.',
			'FreewayFacility::validate'
		);
	}
	if (rows.length) {
		for (const [label, r] of [
			['first', rows[0]],
			['last', rows[rows.length - 1]]
		]) {
			if (r.seg_type !== 'Basic') {
				add(
					ERROR,
					'termini-not-basic',
					`The ${label} segment is a ${r.seg_type.toLowerCase()} segment. The termini must be basic freeway segments, so the facility has to be extended past this ramp.`,
					'HCM Chapter 10, Section 2 (first segmentation rule); FreewayFacility::validate',
					{ rowKey: r.key }
				);
			}
		}
	}
	for (const r of rows) {
		if (!(r.length_ft > 0)) {
			add(ERROR, 'nonpositive-length', `Segment ${r.key} has a length of ${r.length_ft}.`, 'FreewayFacility::validate', { rowKey: r.key });
		}
		if (!(r.lanes >= 2)) {
			add(ERROR, 'lanes-below-two', `Segment ${r.key} has ${r.lanes} lanes. Chapter 10 needs at least two.`, 'FreewayFacility::validate', { rowKey: r.key });
		}
	}

	// ── What the engine accepts and mis-handles ──────────────────────────

	// Demand accumulates segment by segment as upstream + on-ramp - off-ramp
	// (compute_demands, Equations 10-2/10-3). Nothing checks the running total,
	// so an off-ramp drawing more than is on the facility produces a negative
	// segment demand, and the analysis then runs to a finished-looking answer.
	const periods = doc.mainline.demand?.length ?? 0;
	let reportedNegative = false;
	for (let p = 0; p < periods && !reportedNegative; p++) {
		let running = doc.mainline.demand[p];
		for (const r of rows) {
			running += (r.on_ramp_demand?.[p] ?? 0) - (r.off_ramp_demand?.[p] ?? 0);
			if (running < 0) {
				reportedNegative = true;
				add(
					WARN,
					'demand-negative',
					`In period ${p + 1} the demand entering segment ${rows.indexOf(r) + 1} works out to ${Math.round(running)} veh/h, because the off-ramps upstream of it take more traffic than has entered the facility. The engine will carry the negative forward rather than reject it.`,
					'HCM Equations 10-2/10-3 (demand accumulation)',
					{ rowKey: r.key }
				);
				break;
			}
		}
	}

	// "The length of the freeway should be less than the distance a vehicle
	// traveling at the average speed can achieve in 15 min. This specification
	// generally results in a maximum facility length between 9 and 12 mi."
	const lengthMi = rows.reduce((a, r) => a + r.length_ft, 0) / 5280;
	const maxMi = (doc.mainline.ffs ?? 0) / 4;
	if (maxMi > 0 && lengthMi > maxMi) {
		add(
			WARN,
			'facility-too-long',
			`The facility is ${lengthMi.toFixed(2)} mi, longer than the ${maxMi.toFixed(2)} mi a vehicle covers in one 15-min analysis period at ${doc.mainline.ffs} mi/h. It should be divided into subfacilities at appropriate breakpoints and each analyzed separately.`,
			'HCM Chapter 10, Section 3 (Spatial and Temporal Limits)'
		);
	}

	// The temporal guidance, stated as guidance rather than as a threshold.
	if (periods > 0 && periods <= 2) {
		add(
			NOTE,
			'short-study-period',
			`${periods} analysis period${periods === 1 ? '' : 's'} is ${periods * 15} min of study time. The temporal extent should be long enough to contain the formation and dissipation of every queue, and ideally 30 min is added before and after the known peak period, which this cannot hold.`,
			'HCM Chapter 10, Section 3 (Spatial and Temporal Limits)'
		);
	}

	// total_ramp_density is not read by the FFS estimate here. Its one use in
	// FreewayFacility is as the fallback interchange density handed to the
	// Chapter 13 weaving engine, so on a facility with a weave a stale value
	// moves the weaving speed and nothing else, which is exactly the kind of
	// drift that goes unnoticed.
	const rampCount = doc.features?.length ?? 0;
	if (!doc.importedSegments && lengthMi > 0 && rampCount > 0) {
		const observed = rampCount / lengthMi;
		if (Math.abs(observed - (doc.mainline.totalRampDensity ?? 0)) > 0.25) {
			add(
				NOTE,
				'ramp-density-mismatch',
				`Total ramp density is entered as ${doc.mainline.totalRampDensity} ramps/mi, but ${rampCount} ramps over ${lengthMi.toFixed(2)} mi is ${observed.toFixed(2)}. This value is the interchange density the weaving engine reads when interchange density is not set separately.`,
				'HCM Chapter 10 Concepts; Chapter 13 (weaving)'
			);
		}
	}

	if (doc.importedSegments) {
		add(
			NOTE,
			'imported-no-features',
			'This facility was imported from a fixture. A fixture stores the segments the segmentation rules produced and not the ramps an analyst placed, so there is no feature layer to re-derive from and the segment table is the editor.',
			'library fixture schema (FreewayFacility)'
		);
	}

	return out;
}
