import { n } from '$lib/discussion.js';

/**
 * Discussion for an urban street reliability run (HCM Chapter 17).
 *
 * Like Chapter 11 this ends in a distribution rather than a letter, and the sentence that carries
 * the most is which source of variability the scenarios actually generated. A run with no
 * oversaturated scenarios and no weather events has a narrow distribution for a reason the numbers
 * alone do not show.
 */
export function discussion(results, inputs) {
  if (!results) return [];
  const { strategyCount } = inputs;
  const out = [];

  out.push(
    `A mean travel time index of ${n(results.tti_mean, 3)} puts the average trip at ${n(results.mean_travel_time, 1)} s against a base free-flow travel time of ${n(results.base_free_flow_travel_time, 1)} s.`,
  );

  out.push(
    `The planning time index of ${n(results.tti_95, 3)} against a median of ${n(results.tti_50, 3)} is the tail a traveler budgets for, and the reliability rating of ${n(results.reliability_rating, 1)}% is the share of travel below a travel time index of 2.5.`,
  );

  out.push(
    `Of ${results.num_scenarios} scenarios, ${results.num_oversaturated_scenarios} ran oversaturated and ${n(results.pct_nondry_scenarios, 1)}% carried nondry weather, from ${results.num_weather_events} weather events and ${results.num_incidents} incidents, and those are the sources the spread above comes from.`,
  );

  out.push(
    `Total delay across the reliability reporting period is ${n(results.total_vhd, 0)} veh-h.${strategyCount > 0 ? ` The ${strategyCount} ATDM strateg${strategyCount === 1 ? 'y was' : 'ies were'} applied to every scenario, so this is the treated condition rather than the base one.` : ''} Chapter 17 reports a distribution rather than a service measure, so no level of service letter is assigned.`,
  );

  return out.filter(Boolean);
}
