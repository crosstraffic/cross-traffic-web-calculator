// Colour and bucketing for the time-space heatmap.
//
// Kept out of the component so the palette is testable rather than eyeballed,
// and so the on-screen grid and the printed table read the same measure
// definitions.
//
// Two encodings, chosen by what the measure is:
//
// - LOS is a status encoding, not a magnitude one. It reports a graded
//   operating state, so it takes the house status steps from `los.js`, the same
//   six a LosBadge and a facility diagram use, and a letter never means one
//   colour here and another there. The amber and orange steps are close enough
//   that they are not reliably separable, which is why the letter is printed in
//   every cell rather than carried by the fill.
// - Density, speed and demand-to-capacity are continuous magnitudes, so each
//   takes a sequential single-hue ramp, pale to deep. No rainbow, one hue.
//
// The ramp anchors the end that means "nothing to see" nearest the page
// surface, and that end changes with the theme: on light the palest step
// recedes into white, on dark the deepest recedes into the dark surface. Both
// ends are printed in the legend with their numeric values and the value itself
// is in the cell, so nothing depends on reading a fill.

import { LOS_COLORS, LOS_LETTERS } from '../los.js';

/** Sequential blue, steps 100 through 700, pale to deep. */
export const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

/** Ink per ramp step, chosen by measured contrast against that step rather than
 * by eye: the near-black clears 4.5:1 on steps 0-3 (14.4, 10.7, 7.6, 5.2) and
 * the near-white clears it on steps 4-6 (5.2, 7.7, 11.4). The near-black is the
 * same ink a LosBadge prints on its status fill. */
const RAMP_INK = ['#10100f', '#10100f', '#10100f', '#10100f', '#f7fafc', '#f7fafc', '#f7fafc'];
export const LOS_INK = '#10100f';

/**
 * The four measures the selector offers.
 *
 * `key` indexes `result.matrices`. `invert` marks a measure the HCM reads the
 * other way round, so the ramp still runs pale-to-deep as operation degrades: a
 * slow segment is the deep one whether the measure counts vehicles or miles per
 * hour. Without it the same facility would read as a deep band of trouble under
 * density and a deep band of calm under speed.
 */
export const MEASURES = [
	{
		id: 'los',
		key: 'los',
		label: 'Level of service',
		unit: '',
		kind: 'status',
		digits: 0,
		note: 'Segment LOS by density (Exhibits 12-15, 13-6 and 14-3), or F where demand exceeds capacity.'
	},
	{
		id: 'density',
		key: 'density',
		label: 'Density',
		unit: 'veh/mi/ln',
		kind: 'ramp',
		digits: 1,
		invert: false,
		note: 'The Chapter 10 service measure. Deeper is denser.'
	},
	{
		id: 'speed',
		key: 'speed',
		label: 'Space mean speed',
		unit: 'mi/h',
		kind: 'ramp',
		digits: 1,
		invert: true,
		note: 'Deeper is slower, so the deep cells are the poor ones on every measure here.'
	},
	{
		id: 'dc',
		key: 'dc',
		label: 'Demand-to-capacity ratio',
		unit: '',
		kind: 'ramp',
		digits: 2,
		invert: false,
		note: 'Above 1.00 a segment cannot serve its demand and the queue procedure takes over.'
	}
];

export function measureById(id) {
	return MEASURES.find((m) => m.id === id) ?? MEASURES[0];
}

/**
 * The measures an urban street result offers.
 *
 * There are five rather than four, and they sit on one row rather than a grid,
 * because the Chapter 16 and 18 engines are single-period: `WasmUrbanSegment`
 * and `WasmUrbanFacility` take a scalar demand and expose no period axis at all.
 * So the time-space domain the freeway heatmap draws collapses to the
 * strip-with-values row the design gives a single-period method, and the columns
 * are the segments. Nothing here invents a period.
 *
 * `key` indexes a per-segment result object rather than a matrix, which is the
 * other difference from `MEASURES`.
 */
export const URBAN_MEASURES = [
	{
		id: 'los',
		key: 'los',
		label: 'Level of service',
		unit: '',
		kind: 'status',
		digits: 0,
		note: 'Segment LOS by travel speed as a percentage of the base free-flow speed (Exhibit 18-1), or F where the through v/c at the boundary intersection exceeds 1.0.'
	},
	{
		id: 'travelSpeed',
		key: 'travelSpeed',
		label: 'Travel speed',
		unit: 'mi/h',
		kind: 'ramp',
		digits: 1,
		invert: true,
		note: 'The Chapter 18 service measure. Deeper is slower, so the deep cells are the poor ones on every measure here.'
	},
	{
		id: 'baseFfs',
		key: 'baseFfs',
		label: 'Base free-flow speed',
		unit: 'mi/h',
		kind: 'ramp',
		digits: 1,
		invert: true,
		note: 'What the segment would run with no signal, from the Equation 18-3 running-time chain. The LOS threshold is the travel speed as a percentage of this, not the travel speed itself.'
	},
	{
		id: 'spatialStopRate',
		key: 'spatialStopRate',
		label: 'Spatial stop rate',
		unit: 'stops/mi',
		kind: 'ramp',
		digits: 2,
		invert: false,
		note: 'Equation 18-16. It carries the traveler perception score, and omitting it on any segment leaves the facility stop rate undefined rather than partial.'
	},
	{
		id: 'vcRatio',
		key: 'vcRatio',
		label: 'Through v/c ratio',
		unit: '',
		kind: 'ramp',
		digits: 2,
		invert: false,
		note: 'The through movement at the segment\'s downstream boundary intersection. Above 1.0 at any boundary the Exhibit 16-3 footnote forces facility LOS F.'
	}
];

export function urbanMeasureById(id) {
	return URBAN_MEASURES.find((m) => m.id === id) ?? URBAN_MEASURES[0];
}

/** Finite low and high of a matrix, for the ramp domain and the legend. */
export function domainOf(matrix) {
	let lo = Infinity;
	let hi = -Infinity;
	for (const row of matrix ?? []) {
		for (const v of row) {
			if (!Number.isFinite(v)) continue;
			if (v < lo) lo = v;
			if (v > hi) hi = v;
		}
	}
	return Number.isFinite(lo) ? { lo, hi } : null;
}

/**
 * Cell fill and ink for one value.
 *
 * `dark` is the page theme, and it reverses the ramp rather than recolouring
 * it: the same seven steps, anchored at whichever end sits nearest the surface.
 */
export function cellStyle(measure, value, domain, dark) {
	if (measure.kind === 'status') {
		const fill = LOS_COLORS[value];
		if (!fill) return { fill: 'transparent', ink: 'currentColor', step: null };
		return { fill, ink: LOS_INK, step: LOS_LETTERS.indexOf(value) };
	}
	if (!Number.isFinite(value) || !domain) return { fill: 'transparent', ink: 'currentColor', step: null };
	const step = rampStep(value, domain, measure.invert);
	const i = dark ? RAMP.length - 1 - step : step;
	return { fill: RAMP[i], ink: RAMP_INK[i], step };
}

/** Which of the seven steps a value falls in. A degenerate domain (one distinct
 * value across the whole matrix) takes the middle step rather than an extreme,
 * because a uniform facility drawn entirely in the deepest blue reads as a
 * facility in trouble. */
export function rampStep(value, { lo, hi }, invert = false) {
	if (!(hi > lo)) return Math.floor(RAMP.length / 2);
	const t = (value - lo) / (hi - lo);
	const u = invert ? 1 - t : t;
	return Math.min(RAMP.length - 1, Math.max(0, Math.floor(u * RAMP.length)));
}

/** What goes in the cell. Every cell prints its own value, so the grid survives
 * a greyscale print and a reader who cannot separate two adjacent steps. */
export function cellText(measure, value) {
	if (measure.kind === 'status') return value ?? '–';
	if (!Number.isFinite(value)) return '–';
	return value.toFixed(measure.digits);
}

/** Legend stops, in the order the cells use them: the six status steps for LOS,
 * or the ramp anchored for this theme. */
export function legendStops(measure, domain, dark) {
	if (measure.kind === 'status') {
		return LOS_LETTERS.map((letter) => ({ letter, fill: LOS_COLORS[letter], ink: LOS_INK }));
	}
	if (!domain) return [];
	return RAMP.map((_, step) => {
		const i = dark ? RAMP.length - 1 - step : step;
		return { fill: RAMP[i], ink: RAMP_INK[i], step };
	});
}
