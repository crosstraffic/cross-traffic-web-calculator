import { letterFor } from '$lib/los.js';
import { n, positionSentence, worstBy } from '$lib/discussion.js';

/**
 * Discussion for a two-way STOP-controlled intersection (HCM Chapter 20, Section 4).
 *
 * Chapter 20 assigns LOS per movement and per minor lane and defines none for the intersection as
 * a whole, because the major through movements are unimpeded and averaging them in would hide the
 * movement that is actually waiting. The generator therefore leads with the governing lane and says
 * plainly that the intersection delay carries no letter.
 */
export function discussion(results, inputs) {
  if (!results || !results.laneRows || results.laneRows.length === 0) return [];
  const { threeLeg } = inputs;
  const out = [];

  const worst = worstBy(results.laneRows, (l) => l.control_delay ?? -Infinity);
  if (worst) {
    const label = `${worst.approach} minor lane ${worst.lane}`;
    const earned = letterFor('control_delay_unsignalized', worst.control_delay);
    const banded =
      earned === worst.los
        ? positionSentence('control_delay_unsignalized', worst.control_delay, {
            digits: 1,
            label: `Control delay on the ${label}`,
          })
        : null;
    out.push(
      banded ||
        `Control delay on the ${label} is ${n(worst.control_delay, 1)} s/veh, LOS ${worst.los}, the poorest at the intersection.`,
    );
    // The engine leaves v/c absent on some shared lanes, so the ratio rides only when it exists
    // rather than printing the word "null" into a paragraph.
    const vc = n(worst.vc_ratio, 2);
    out.push(
      worst.vc_ratio >= 1
        ? `That lane is over capacity at a volume-to-capacity ratio of ${vc} against ${n(worst.capacity, 0)} veh/h, so its delay and its 95th percentile queue of ${n(worst.queue_95, 1)} vehicles will keep growing through the analysis period.`
        : `Its capacity is ${n(worst.capacity, 0)} veh/h${vc ? ` at a volume-to-capacity ratio of ${vc}` : ''}, with a 95th percentile queue of ${n(worst.queue_95, 1)} vehicles.`,
    );
  }

  const majorLeft = worstBy(
    (results.movementRows ?? []).filter((m) => /Major/.test(m.name)),
    (m) => m.control_delay ?? -Infinity,
  );
  if (majorLeft) {
    out.push(
      `Major-street left and U-turn movements are the only major-street traffic the ${threeLeg ? 'three-leg' : 'four-leg'} gap-acceptance procedure impedes, and the worst of them is the ${majorLeft.name} at ${n(majorLeft.control_delay, 1)} s/veh and LOS ${majorLeft.los}.`,
    );
  }

  out.push(
    `The intersection averages ${n(results.intersectionDelay, 1)} s/veh, but the HCM defines no level of service for a TWSC intersection as a whole, so the letters above belong to the movements and lanes rather than to the site.`,
  );

  return out.filter(Boolean);
}
