import { n, share, worstBy, losRank } from '$lib/discussion.js';

/**
 * Discussion for a signalized interchange (HCM Chapter 23, Part B).
 *
 * The interchange measure is experienced travel time, which is control delay at the ramp terminals
 * plus the extra distance travel time an origin-destination movement spends getting between them.
 * Splitting the governing movement's total into those two parts is what tells an analyst whether
 * the signals or the interchange geometry is costing the time, and neither the table nor the letter
 * shows it.
 *
 * Exhibit 23-10's bands are not in `los.js`, so no band-edge sentence is offered here.
 */
export function discussion(results, inputs) {
  if (!results || !results.od_results) return [];
  const { formLabel } = inputs;
  const out = [];

  out.push(
    `An interchange experienced travel time of ${n(results.ett, 1)} s/veh gives LOS ${results.los} against the Exhibit 23-10 bands, which are set higher than the signalized-intersection ones because an interchange movement travels through two terminals.`
  );

  const worst = worstBy(results.od_results, (o) => o.ett_s ?? -Infinity);
  if (worst) {
    out.push(
      `Origin-destination movement ${worst.movement} governs at ${n(worst.ett_s, 1)} s/veh and LOS ${worst.los ?? results.los}, made up of ${n(worst.control_delay_s, 1)} s/veh of control delay and ${n(worst.edtt_s, 1)} s/veh of extra distance travel time, so ${Math.abs(worst.edtt_s) >= worst.control_delay_s ? 'the geometry of the ' + formLabel + ' costs it more than the signals do' : 'the signals cost it more than the geometry does'}.`
    );
  }

  const totalDemand = results.od_results.reduce((a, o) => a + (o.demand ?? 0), 0);
  const failing = results.od_results.filter((o) => losRank(o.los) >= losRank('E'));
  out.push(
    failing.length > 0
      ? `${failing.length} of the ${results.od_results.length} origin-destination movements ${failing.length === 1 ? 'runs' : 'run'} at LOS E or worse, carrying ${share(failing.reduce((a, o) => a + (o.demand ?? 0), 0), totalDemand, 0)}% of the ${n(totalDemand, 0)} veh/h through the interchange, and the interchange letter is the demand-weighted average over all of them.`
      : `No origin-destination movement runs worse than LOS D, and the interchange letter is the demand-weighted average of all ${results.od_results.length} of them over ${n(totalDemand, 0)} veh/h.`
  );

  return out.filter(Boolean);
}
