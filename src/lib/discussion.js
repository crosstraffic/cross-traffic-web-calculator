/**
 * Shared pieces for the per-page Discussion generators.
 *
 * Each chapter page owns a small generator that turns its own result state into two to four
 * sentences, modelled on the Discussion paragraphs that close the HCM's Example Problems. Those
 * paragraphs interpret rather than restate: they name what governs the answer, say how much
 * headroom the facility has, and say how close the service measure sits to a band edge. What lives
 * here is only the arithmetic those sentences share, so a generator stays a list of sentences and
 * the rounding rules have one home.
 *
 * Everything here is data-driven from the computed values. Nothing generates a claim the numbers do
 * not carry, and no generator invents a level of service where its chapter declines to assign one.
 */

import { SERVICE_MEASURES, LOS_LETTERS, letterFor } from './los.js';

/** Round for prose, matching what the pages print. Non-finite values become null so a sentence can be dropped rather than printing a dash mid-paragraph. */
export function n(value, digits = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : null;
}

/** A percentage of a whole, as an integer string. Returns null on a zero or absent whole. */
export function share(part, whole, digits = 0) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return null;
  return ((part / whole) * 100).toFixed(digits);
}

/**
 * Where a value sits inside its level-of-service band, for the measures `los.js` already defines.
 *
 * `edge` is the nearest finite band boundary and `distance` the gap to it, so a caller can say
 * "1.7 below the C/D boundary of 28" without knowing which measure it holds. `near` marks the value
 * as within `tolerance` of that boundary relative to the value itself, which is the "a small change
 * moves the letter" case the HCM discussions call out.
 *
 * Returns null when the measure is unknown or the value is not finite, and callers drop the
 * sentence rather than guessing. Chapters whose thresholds are not in `los.js` (the Exhibit 18-1
 * travel-speed table, the Exhibit 23-10 experienced-travel-time bands) get no band sentence at all
 * rather than a second transcription of a published table that could drift from the engine's.
 */
export function bandPosition(measureKey, value, { tolerance = 0.1 } = {}) {
  const m = SERVICE_MEASURES[measureKey];
  const letter = letterFor(measureKey, value);
  if (!m || !letter || !Number.isFinite(value)) return null;

  const worseHigher = m.direction === 'higher-is-worse';
  const i = LOS_LETTERS.indexOf(letter);
  // Band i runs from edges[i-1] to edges[i]; either end may be absent (LOS A has no lower edge,
  // LOS F no upper one) or infinite (Exhibit 14-3's open LOS E).
  const candidates = [
    { edge: m.edges[i - 1], betterLetter: LOS_LETTERS[i - 1], worseLetter: letter },
    { edge: m.edges[i], betterLetter: letter, worseLetter: LOS_LETTERS[i + 1] },
  ].filter((c) => Number.isFinite(c.edge) && c.betterLetter && c.worseLetter);
  if (candidates.length === 0) return null;

  const nearest = candidates.reduce((best, c) => (Math.abs(value - c.edge) < Math.abs(value - best.edge) ? c : best));
  const distance = Math.abs(value - nearest.edge);

  return {
    letter,
    edge: nearest.edge,
    betterLetter: nearest.betterLetter,
    worseLetter: nearest.worseLetter,
    distance,
    // Which side of the threshold the number is on, arithmetically. This is deliberately not the
    // same question as which letter is better: on a speed or space measure the bands run downward,
    // so a value above a threshold is on the better side of it and "below the boundary" would read
    // as the opposite of the truth.
    above: value > nearest.edge,
    // The value has already crossed into the poorer band, so the edge is behind it, not ahead.
    past: worseHigher ? value > nearest.edge : value < nearest.edge,
    near: value !== 0 && distance / Math.abs(value) <= tolerance,
    label: m.label,
    unit: m.unit,
  };
}

/**
 * The standard "where does this land" sentence for a measure whose reported letter is the one the
 * value earns. Where a chapter overrides the letter (a volume-to-capacity ratio above 1.0 forcing
 * F, say) the generator writes its own sentence instead, because only it knows the reason.
 */
export function positionSentence(measureKey, value, { digits = 1, label = null, unit = null, tolerance = 0.1 } = {}) {
  const p = bandPosition(measureKey, value, { tolerance });
  if (!p) return null;
  const measure = label || p.label;
  const units = unit ?? p.unit;
  const suffix = units ? ` ${units}` : '';
  const boundary = `${p.betterLetter}/${p.worseLetter} boundary of ${n(p.edge, edgeDigits(p.edge, digits))}`;
  const head = `${measure} of ${n(value, digits)}${suffix} earns LOS ${p.letter}`;

  // At the printed precision the gap can round to nothing, and "0.0 below the boundary, within 0%"
  // reads as a defect rather than as a value sitting on a threshold. Say so directly instead.
  if (Number(n(p.distance, digits)) === 0) return `${head} and sits right on the ${boundary}.`;

  const gap = `${n(p.distance, digits)}${suffix} ${p.above ? 'above' : 'below'} the ${boundary}`;
  if (p.near) {
    return `${head} and sits ${gap}, within ${share(p.distance, Math.abs(value), 0)}% of the band edge.`;
  }
  return `${head}, ${gap}.`;
}

/** Band edges are usually whole numbers in the exhibits, and printing "28.0" where the book prints 28 reads as a computed value rather than a threshold. */
function edgeDigits(edge, digits) {
  return Number.isInteger(edge) ? 0 : digits;
}

/**
 * Headroom to capacity, in the units the caller holds.
 *
 * Below capacity this is the HCM's "demand can grow significantly before reaching capacity"
 * observation with the growth stated. At or above capacity the caller normally wants its own
 * sentence, since what happens then is chapter-specific, so null comes back.
 */
export function headroomSentence(demand, capacity, unit, { digits = 0, subject = 'Demand' } = {}) {
  if (!Number.isFinite(demand) || !Number.isFinite(capacity) || capacity <= 0) return null;
  if (demand >= capacity) return null;
  const pctOf = share(demand, capacity, 0);
  return `${subject} of ${n(demand, digits)} ${unit} is ${pctOf}% of the capacity of ${n(capacity, digits)} ${unit}, leaving ${n(capacity - demand, digits)} ${unit} of headroom.`;
}

/** The worst entry of a list under an ordering, used wherever a governing segment, approach, or lane has to be named. */
export function worstBy(rows, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const row of rows ?? []) {
    const s = score(row);
    if (Number.isFinite(s) && s > bestScore) {
      bestScore = s;
      best = row;
    }
  }
  return best;
}

/** Rank of a LOS letter, so "worst" can be taken over letters as well as over numbers. */
export function losRank(letter) {
  const i = LOS_LETTERS.indexOf(letter);
  return i < 0 ? -1 : i;
}
