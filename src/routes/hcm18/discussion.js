import { n, share } from '$lib/discussion.js';

/**
 * Discussion for an urban street segment (HCM Chapter 18).
 *
 * The interpretive question on a segment is always the same. Travel time splits into running time
 * along the link and control delay at the boundary intersection, and which of the two dominates
 * decides whether the segment or the signal is worth treating. The generator computes that split
 * from the two values the engine reports.
 *
 * Exhibit 18-1's thresholds are a table interpolated on the base free-flow speed rather than a
 * fixed ratio, and `los.js` does not carry it, so the speeds and their ratio are stated without
 * naming a band edge.
 */
export function discussion(results, inputs) {
  if (!results) return [];
  const { apSource, segmentLength } = inputs;
  const out = [];

  out.push(
    `A travel speed of ${n(results.travel_speed, 2)} mi/h is ${share(results.travel_speed, results.base_ffs, 0)}% of the base free-flow speed of ${n(results.base_ffs, 2)} mi/h, and Exhibit 18-1 reads LOS ${results.los} from that travel speed against thresholds interpolated on the base speed.`,
  );

  const travelTime = results.running_time + results.through_delay;
  if (Number.isFinite(travelTime) && travelTime > 0) {
    const delayShare = share(results.through_delay, travelTime, 0);
    out.push(
      `Of ${n(travelTime, 1)} s spent on the segment, ${n(results.through_delay, 1)} s is control delay at the boundary intersection and ${n(results.running_time, 1)} s is running time, so ${Number(delayShare) >= 50 ? 'the signal rather than the link governs' : 'the link rather than the signal governs'} at ${delayShare}% of the total.`,
    );
  }

  if (Number.isFinite(results.access_point_delay) && results.access_point_delay > 0) {
    out.push(
      `Access-point turning delay adds ${n(results.access_point_delay, 2)} s/veh inside the running time, taken from the ${apSource === 'measured' ? 'per-point delays entered on the form' : apSource === 'computed' ? 'Chapter 30 Section 4 procedure' : 'Exhibit 18-13 planning estimate'}.`,
    );
  }

  if (Number.isFinite(results.vc_ratio) && results.vc_ratio > 1) {
    out.push(
      `The through volume-to-capacity ratio of ${n(results.vc_ratio, 2)} is above 1.0, which forces LOS F on its own whatever the travel speed.`,
    );
  } else {
    out.push(
      `The segment stops ${n(results.full_stop_rate, 2)} times per vehicle over ${n(segmentLength, 0)} ft, ${n(results.spatial_stop_rate, 2)} stops/mi, at a through volume-to-capacity ratio of ${n(results.vc_ratio, 2)}.`,
    );
  }

  return out.filter(Boolean);
}
