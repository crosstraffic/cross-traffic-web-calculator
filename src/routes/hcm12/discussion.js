import { letterFor } from '$lib/los.js';
import { n, share, positionSentence, headroomSentence } from '$lib/discussion.js';

/**
 * Discussion for a basic freeway segment (HCM Chapter 12, standard passenger-car-equivalent path).
 *
 * The chapter's own Example Problem discussions read the density against its band, then say how far
 * demand is from capacity, then name what is holding the speed down. That is the order here.
 */
export function discussion(results, inputs) {
  if (!results) return [];
  const { phv, usesGrade, sutPercentage } = inputs;
  const earned = letterFor('density_pc', results.density);
  const out = [];

  if (earned && results.los !== earned) {
    // Exhibit 12-15 assigns F on demand above capacity whatever the density, so the letter and the
    // density can disagree. Say which one the engine reported and why, rather than printing a
    // position sentence that contradicts the badge.
    out.push(
      `Demand exceeds capacity at a volume-to-capacity ratio of ${n(results.vc_ratio, 2)}, so LOS ${results.los} is assigned. The density of ${n(results.density, 1)} pc/mi/ln would read LOS ${earned} on its own.`,
    );
  } else {
    out.push(positionSentence('density_pc', results.density, { digits: 1, label: 'Density' }));
  }

  out.push(
    headroomSentence(results.v_p, results.adjusted_capacity, 'pc/h/ln', {
      subject: 'Demand flow rate',
    }),
  );

  if (Number.isFinite(results.breakpoint) && results.v_p <= results.breakpoint) {
    out.push(
      `Flow of ${n(results.v_p, 0)} pc/h/ln stays below the Equation 12-1 breakpoint of ${n(results.breakpoint, 0)} pc/h/ln, so the segment holds its free-flow speed of ${n(results.ffs, 1)} mi/h and density rises with demand alone.`,
    );
  } else if (Number.isFinite(results.breakpoint)) {
    out.push(
      `Flow of ${n(results.v_p, 0)} pc/h/ln is past the Equation 12-1 breakpoint of ${n(results.breakpoint, 0)} pc/h/ln, so speed has dropped ${n(results.ffs - results.speed, 1)} mi/h below the free-flow speed of ${n(results.ffs, 1)} mi/h to ${n(results.speed, 1)} mi/h.`,
    );
  }

  if (Number(phv) > 0 && Number.isFinite(results.f_hv) && results.f_hv > 0) {
    const source = usesGrade
      ? `the ${sutPercentage}% single-unit-truck specific-upgrade exhibit`
      : 'the general-terrain exhibit 12-25';
    out.push(
      `Heavy vehicles at ${phv}% enter through a passenger-car equivalent of ${n(results.e_t, 2)} read from ${source}, which raises the flow rate ${share(1 / results.f_hv - 1, 1, 0)}% above the vehicle count.`,
    );
  }

  return out.filter(Boolean);
}
