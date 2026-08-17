import { letterFor } from '$lib/los.js';
import { n, positionSentence, worstBy, losRank } from '$lib/discussion.js';

/**
 * Discussion for an all-way STOP-controlled intersection (HCM Chapter 21).
 *
 * The quantity that explains an AWSC result is the degree of utilization, because every approach's
 * departure headway depends on every other approach's and the whole set is solved by iteration. A
 * lane near a utilization of 1.0 is the one whose delay runs away first, and that is not visible
 * from the delay column alone.
 */
export function discussion(results) {
  if (!results || !results.laneRows || results.laneRows.length === 0) return [];
  const out = [];

  const earned = letterFor('control_delay_unsignalized', results.intersectionDelay);
  out.push(
    earned === results.intersectionLos
      ? positionSentence('control_delay_unsignalized', results.intersectionDelay, {
          digits: 1,
          label: 'Intersection control delay'
        })
      : `Intersection control delay of ${n(results.intersectionDelay, 1)} s/veh gives LOS ${results.intersectionLos} against the Exhibit 21-8 thresholds.`
  );

  const worstApproach = worstBy(results.approachRows ?? [], (a) => losRank(a.los));
  if (worstApproach) {
    const steps = losRank(worstApproach.los) - losRank(results.intersectionLos);
    out.push(
      `The ${worstApproach.label} approach governs at ${n(worstApproach.delay, 1)} s/veh and LOS ${worstApproach.los}${steps > 0 ? `, ${steps} step${steps === 1 ? '' : 's'} poorer than the intersection average` : ', the same letter the intersection earns'}.`
    );
  }

  const busiest = worstBy(results.laneRows, (l) => l.degree_of_utilization ?? -Infinity);
  if (busiest) {
    out.push(
      `${busiest.approach} lane ${busiest.lane} runs at a degree of utilization of ${n(busiest.degree_of_utilization, 3)} on a departure headway of ${n(busiest.departure_headway, 2)} s, the highest at the intersection, and it is the lane whose delay climbs first as demand grows.`
    );
  }

  out.push(
    `The departure headways settled in ${results.iterations} iteration${results.iterations === 1 ? '' : 's'}, which is the coupling between approaches that separates an all-way stop from a two-way one.`
  );

  return out.filter(Boolean);
}
