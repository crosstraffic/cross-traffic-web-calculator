import { letterFor } from '$lib/los.js';
import { n, positionSentence, worstBy, losRank } from '$lib/discussion.js';

/**
 * Discussion for a roundabout (HCM Chapter 22).
 *
 * A roundabout answer lives at the entry lane. Capacity there is set by the circulating flow in
 * front of the entry, so an entry can be the worst one at the intersection while carrying less
 * traffic than another, and naming the governing lane with its volume-to-capacity ratio is the
 * sentence that explains the letter.
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
      : `Intersection control delay of ${n(results.intersectionDelay, 1)} s/veh gives LOS ${results.intersectionLos} against the Exhibit 22-8 thresholds.`
  );

  const worstLane = worstBy(results.laneRows, (l) => l.v_c_ratio ?? -Infinity);
  if (worstLane) {
    out.push(
      `The ${worstLane.entry} ${worstLane.label} governs at a volume-to-capacity ratio of ${n(worstLane.v_c_ratio, 2)}, ${n(worstLane.flow_veh, 0)} veh/h against a gap-acceptance capacity of ${n(worstLane.capacity_veh, 0)} veh/h, and that capacity is set by the flow circulating in front of it rather than by the entry's own geometry.`
    );
    out.push(
      worstLane.v_c_ratio >= 1
        ? `That entry is over capacity, so its delay of ${n(worstLane.control_delay, 1)} s/veh and its 95th percentile queue of ${n(worstLane.queue_95, 1)} vehicles understate what a longer period would produce.`
        : `It waits ${n(worstLane.control_delay, 1)} s/veh with a 95th percentile queue of ${n(worstLane.queue_95, 1)} vehicles.`
    );
  }

  const approaches = (results.approachRows ?? []).filter((a) => Number.isFinite(a.delay));
  const worstApproach = worstBy(approaches, (a) => losRank(a.los));
  if (worstApproach && approaches.length > 1) {
    const best = approaches.reduce((b, a) => (a.delay < b.delay ? a : b));
    const steps = losRank(worstApproach.los) - losRank(results.intersectionLos);
    out.push(
      `Approach delays span ${n(best.delay, 1)} s/veh on ${best.label} to ${n(worstApproach.delay, 1)} s/veh on ${worstApproach.label}${steps > 0 ? `, which is ${steps} step${steps === 1 ? '' : 's'} poorer than the intersection letter` : ''}.`
    );
  }

  return out.filter(Boolean);
}
