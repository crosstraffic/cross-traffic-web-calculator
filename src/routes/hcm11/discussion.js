import { n } from '$lib/discussion.js';

/**
 * Discussion for a freeway reliability run (HCM Chapter 11).
 *
 * The chapter's answer is a distribution, not a letter, so the reading is where the middle of that
 * distribution sits and how long its tail is. The last sentence says plainly that no level of
 * service is assigned, because every other page here ends in one.
 */
export function discussion(results, inputs) {
  if (!results) return [];
  const { targetSpeed, vmtWeighted } = inputs;
  const out = [];

  out.push(
    `A mean travel time index of ${n(results.tti_mean, 3)} puts the average trip at ${n(results.tti_mean * results.fftt, 2)} min against a free-flow travel time of ${n(results.fftt, 2)} min, over ${results.num_scenarios} scenarios.`
  );

  out.push(
    `The 95th percentile index of ${n(results.tti_95, 3)} against a median of ${n(results.tti_50, 3)} is the length of the tail, and a misery index of ${n(results.misery_index, 3)} describes the worst of it.`
  );

  out.push(
    `The reliability rating of ${n(results.reliability_rating, 1)}% is the share of ${vmtWeighted ? 'travel' : 'observations'} running below a travel time index of 1.33, and ${n(results.pct_below_target, 1)}% of travel falls below ${targetSpeed} mi/h.`
  );

  out.push(
    'Chapter 11 reports a travel time distribution rather than a service measure, so no level of service letter is assigned to a reliability run.'
  );

  return out.filter(Boolean);
}
