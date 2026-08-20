import { letterFor } from '$lib/los.js';
import { n, positionSentence, headroomSentence } from '$lib/discussion.js';

/**
 * Discussion for a basic managed lane segment (HCM Chapter 12, Section 4).
 *
 * What separates this from a basic freeway segment is the adjacent general purpose lanes, so the
 * generator always says whether the Equation 12-18 friction term is doing anything and why. A
 * managed lane that is uncongested on its own can still be held down by the traffic beside it, and
 * the density alone does not show that.
 */
export function discussion(results, inputs) {
  if (!results) return [];
  const { laneTypeLabel } = inputs;
  const earned = letterFor('density_pc', results.density);
  const out = [];

  if (earned && results.los !== earned) {
    out.push(
      `Demand exceeds the adjusted capacity, so LOS ${results.los} is assigned. The density of ${n(results.density, 1)} pc/mi/ln would read LOS ${earned} on its own.`,
    );
  } else {
    out.push(positionSentence('density_pc', results.density, { digits: 1, label: 'Density' }));
  }

  out.push(
    headroomSentence(results.v_p_ml, results.capacity, 'pc/h/ln', {
      subject: 'Managed lane demand',
    }),
  );

  if (!results.has_friction_effect) {
    out.push(
      `The ${laneTypeLabel} separation carries no adjacent friction term, so the general purpose density of ${n(results.k_gp, 1)} pc/mi/ln beside the lane does not enter the managed lane speed at all.`,
    );
  } else if (results.friction_active) {
    out.push(
      `The adjacent general purpose lanes run at ${n(results.k_gp, 1)} pc/mi/ln, above the 35 pc/mi/ln threshold, so the Equation 12-18 friction term is active and it, rather than the managed lane's own flow, is holding the speed at ${n(results.speed, 1)} mi/h.`,
    );
  } else {
    out.push(
      `The adjacent general purpose lanes run at ${n(results.k_gp, 1)} pc/mi/ln, below the 35 pc/mi/ln threshold, so the friction term is inactive and the managed lane speed of ${n(results.speed, 1)} mi/h comes from its own flow alone.`,
    );
  }

  return out.filter(Boolean);
}
