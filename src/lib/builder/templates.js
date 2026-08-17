// Templates are feature groups and nothing else. There is no template object in
// the document, no link back to the pattern a ramp came from, and no special
// case anywhere downstream: dropping a template appends features, and from that
// moment they are ordinary features the user can drag apart.

import { makeFeature } from './document.js';

/** Both patterns are named for what an engineer would call them, and both are
 * placed by the station of the on-ramp gore. The default spacings are the ones
 * that make each pattern segment the way its name implies, so a freshly dropped
 * template shows the shape it promises before anything is adjusted. */
export const TEMPLATES = [
	{
		id: 'diamond',
		name: 'Diamond ramp pair',
		// A diamond interchange's on-ramp and off-ramp for one direction, far
		// enough apart that the two influence areas do not touch: above 3,000 ft
		// the section codes as merge + basic + diverge (Exhibit 10-11).
		summary: 'On-ramp then off-ramp 4,000 ft apart, no auxiliary lane. Segments as merge + basic + diverge.',
		spacingFt: 4000,
		aux: false
	},
	{
		id: 'aux-weave',
		name: 'Auxiliary-lane weave pair',
		// An on-ramp and off-ramp joined by an auxiliary lane, which is the
		// Exhibit 10-12 case: the whole section is one weaving segment. 1,640 ft
		// gore-to-gore is Example Problem 1's weave, whose segment is 2,640 ft
		// once the 500-ft extensions past each gore are added.
		summary: 'On-ramp then off-ramp 1,640 ft apart joined by an auxiliary lane. Segments as one weaving segment.',
		spacingFt: 1640,
		aux: true
	}
];

/**
 * Append a template's features at `stationFt` (the on-ramp gore) and return the
 * ids placed, so the caller can select and highlight them.
 */
export function applyTemplate(doc, templateId, stationFt) {
	const t = TEMPLATES.find((x) => x.id === templateId);
	if (!t) throw new Error(`unknown template "${templateId}"`);
	const on = makeFeature(doc, 'on_ramp', stationFt);
	on.label = `${t.name} on`;
	on.auxLaneToNext = t.aux;
	doc.features.push(on);
	const off = makeFeature(doc, 'off_ramp', stationFt + t.spacingFt);
	off.label = `${t.name} off`;
	doc.features.push(off);
	return [on.id, off.id];
}
