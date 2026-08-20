import { n, share } from '$lib/discussion.js';

/**
 * Discussion for a pedestrian crossing at a TWSC intersection (HCM Chapter 20, Section 5).
 *
 * The letter here does not come from the delay. It comes from the proportion of pedestrians who
 * would rate the crossing dissatisfied or worse, and a crossing can carry a long wait with a good
 * letter or the reverse. That is the single thing a reader of this page most needs told, so it gets
 * its own sentence every time.
 */
export function discussion(results, inputs) {
  if (!results) return [];
  const { yieldPct, countermeasures } = inputs;
  const out = [];

  out.push(
    `Average pedestrian delay is ${n(results.delay, 1)} s over ${results.stageCount} stage${results.stageCount === 1 ? '' : 's'}, which Exhibit 20-29 reads as ${results.delay_interpretation.toLowerCase()}.`,
  );

  out.push(
    `LOS ${results.los} comes from the average proportion dissatisfied of ${n(results.proportion_dissatisfied, 3)} rather than from that delay, so the letter tracks how many pedestrians are made to wait at all rather than how long the wait is.`,
  );

  out.push(
    `${share(results.prob_non_delayed, 1, 0)}% of pedestrians cross without being delayed, at a motorist yield rate of ${n(yieldPct, 0)}% with ${countermeasures}.`,
  );

  if (results.stageCount > 1) {
    out.push(
      `The crossing is staged behind a refuge, so the pedestrian faces one conflicting stream at a time and the delay above is the sum over the ${results.stageCount} stages rather than the wait for a gap in all lanes at once.`,
    );
  }

  return out.filter(Boolean);
}
