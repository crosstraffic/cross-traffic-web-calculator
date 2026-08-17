import { letterFor } from '$lib/los.js';
import { n, positionSentence } from '$lib/discussion.js';

/**
 * Discussion for an off-street pedestrian or bicycle facility (HCM Chapter 24).
 *
 * Three procedures share the page and none of them is a delay or a density, so each gets its own
 * branch. The exclusive pedestrian facility is scored on space per pedestrian, the shared-use path
 * on how often a pedestrian is passed or met, and the bicycle path on a perception score whose
 * scale runs the other way from every other score on the site.
 */
export function discussion(results, inputs) {
  if (!results) return [];

  if (results.kind === 'pedestrian') {
    const { totalWidth, objectWidth, flowType } = inputs;
    const out = [];
    const earned = letterFor('pedestrian_space', results.pedestrian_space);
    out.push(
      earned === results.los
        ? positionSentence('pedestrian_space', results.pedestrian_space, { digits: 0, label: 'Pedestrian space' })
        : `Pedestrian space of ${n(results.pedestrian_space, 0)} ft²/p gives LOS ${results.los}.`
    );
    out.push(
      `The ${totalWidth} ft walkway loses ${objectWidth} ft to fixed objects and shy distance, leaving an effective width of ${n(results.effective_width, 1)} ft, and the unit flow rate of ${n(results.unit_flow_rate, 2)} p/ft/min is taken over that width rather than the built one.`
    );
    out.push(
      flowType === 'platoon'
        ? 'The platooned-flow criteria were applied, which read the same space against tighter bands because pedestrians arriving in groups need more room for the same comfort.'
        : 'Random arrivals were assumed, so the average space above is read against the Exhibit 24-1 criteria rather than the tighter platooned ones.'
    );
    return out.filter(Boolean);
  }

  if (results.kind === 'shared_path') {
    const { oneWay } = inputs;
    return [
      `A weighted total of ${n(results.total_events, 0)} events/h gives LOS ${results.los} against the Exhibit 24-4 bands, where an event is a bicycle passing or meeting the average pedestrian.`,
      `That total is ${n(results.passing_events, 0)} passings and ${n(results.meeting_events, 0)} meetings per hour, and ${results.passing_events >= results.meeting_events ? 'passings from behind dominate' : 'meetings from the opposing direction dominate'} what a pedestrian on this path experiences.`,
      oneWay
        ? 'The path is one-way, so opposing bicycle traffic contributes nothing and every event is an overtaking.'
        : 'The path carries bicycles in both directions, so the opposing stream produces meetings the same-direction stream cannot.'
    ];
  }

  const { pathWidth, centerline, segmentLength } = inputs;
  const out = [];
  const earned = letterFor('blos_score_path', results.blos_score);
  out.push(
    earned === results.los
      ? positionSentence('blos_score_path', results.blos_score, { digits: 2, label: 'BLOS score' })
      : `A BLOS score of ${n(results.blos_score, 2)} gives LOS ${results.los} against the Exhibit 24-5 bands, on a scale where a higher score is better.`
  );
  out.push(
    `The score comes from ${n(results.active_passings_per_minute, 2)} active passings and ${n(results.meetings_per_minute, 2)} meetings per minute over ${segmentLength} mi, of which ${n(results.delayed_passings_per_minute, 2)} per minute are delayed.`
  );
  out.push(
    `The ${pathWidth} ft path works out to ${results.effective_lanes} effective lane${results.effective_lanes === 1 ? '' : 's'}${centerline ? ' with a centerline' : ' without a centerline'}, and that lane count is what sets the ${n(results.probability_delayed_passing * 100, 1)}% chance a passing is delayed.`
  );
  return out.filter(Boolean);
}
