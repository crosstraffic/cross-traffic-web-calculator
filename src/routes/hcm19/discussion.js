import { letterFor } from '$lib/los.js';
import { n, positionSentence, worstBy, losRank } from '$lib/discussion.js';

/**
 * Discussion for a signalized intersection (HCM Chapter 19).
 *
 * An intersection letter is an average over approaches that can differ by two letters, so the
 * generator names the worst approach next to the intersection figure. The critical
 * volume-to-capacity ratio gets its own sentence because it is the quantity that decides whether
 * the signal has capacity at all, and it can force LOS F past any delay.
 */
export function discussion(results, inputs) {
  if (!results) return [];
  const { cycleLength } = inputs;
  const out = [];

  const earned = letterFor('control_delay_signal', results.delay);
  if (earned === results.los) {
    out.push(
      positionSentence('control_delay_signal', results.delay, { digits: 1, label: 'Intersection control delay' }),
    );
  } else {
    out.push(
      `Intersection control delay of ${n(results.delay, 1)} s/veh gives LOS ${results.los}, which is not the letter the delay alone would earn because a lane group runs over capacity.`,
    );
  }

  const worst = worstBy(results.approaches ?? [], (a) => losRank(a.los));
  if (worst) {
    const steps = losRank(worst.los) - losRank(results.los);
    const tail =
      steps > 0
        ? `, so the intersection letter averages over an approach ${steps} step${steps === 1 ? '' : 's'} poorer`
        : ', which is the same letter the intersection as a whole earns';
    out.push(
      `The ${worst.direction} approach governs at ${n(worst.control_delay_s, 1)} s/veh and LOS ${worst.los} on ${n(worst.flow_rate, 0)} veh/h${tail}.`,
    );
  }

  out.push(
    results.critical_vc > 1
      ? `The critical volume-to-capacity ratio of ${n(results.critical_vc, 2)} is above 1.0, so the ${cycleLength} s cycle cannot serve the critical movements and LOS F follows whatever the delay.`
      : `A critical volume-to-capacity ratio of ${n(results.critical_vc, 2)} means the ${cycleLength} s cycle serves the critical movements with ${n((1 - results.critical_vc) * 100, 0)}% of its capacity unused.`,
  );

  return out.filter(Boolean);
}
