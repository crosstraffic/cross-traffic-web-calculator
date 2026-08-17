import { n, share, worstBy, losRank } from '$lib/discussion.js';

/**
 * Discussion for the Chapter 23 Part C alternative intersections.
 *
 * An alternative intersection trades control delay for travel distance. A movement that would have
 * turned left at the junction is sent to a crossover and comes back, so its experienced travel time
 * carries an extra distance term a conventional intersection has no equivalent of. Naming that
 * split on the governing movement is what makes the letter mean something.
 *
 * The DLT gets its own generator because its result is a weighted-average delay over component
 * junctions with no per-movement table, and because its letter is read from the Chapter 19
 * thresholds rather than from Exhibit 23-13.
 */

/** RCUT and MUT forms. */
export function discussion(results, inputs) {
  if (!results || !results.rows) return [];
  const { formLabel } = inputs;
  const out = [];

  out.push(
    `An intersection experienced travel time of ${n(results.ett, 1)} s/veh gives LOS ${results.los} against the Exhibit 23-13 bands, which are the same thresholds a conventional signalized intersection is read on.`
  );

  const worst = worstBy(results.rows, (m) => m.ett_s ?? -Infinity);
  if (worst) {
    out.push(
      `The ${worst.label} movement governs at ${n(worst.ett_s, 1)} s/veh and LOS ${worst.los}, ${n(worst.total_control_delay_s, 1)} s/veh of control delay plus ${n(worst.edtt_s, 1)} s/veh of extra distance travel time.`
    );
  }

  const rerouted = results.rows.filter((m) => Math.abs(m.edtt_s ?? 0) > 0.05);
  out.push(
    rerouted.length > 0
      ? `${rerouted.length} of the ${results.rows.length} movements ${rerouted.length === 1 ? 'is sent through a crossover and carries' : 'are sent through a crossover and carry'} an extra distance term, up to ${n(Math.max(...rerouted.map((m) => Math.abs(m.edtt_s))), 1)} s/veh, and that detour is what the ${formLabel} buys its remaining movements.`
      : `No movement carries an extra distance term on these inputs, so every experienced travel time above is control delay alone.`
  );

  const totalDemand = results.rows.reduce((a, m) => a + (Number(m.demand) || 0), 0);
  const failing = results.rows.filter((m) => losRank(m.los) >= losRank('E'));
  if (failing.length > 0 && totalDemand > 0) {
    out.push(
      `${failing.length} movement${failing.length === 1 ? ' runs' : 's run'} at LOS E or worse, carrying ${share(failing.reduce((a, m) => a + (Number(m.demand) || 0), 0), totalDemand, 0)}% of the ${n(totalDemand, 0)} veh/h the intersection letter is demand-weighted over.`
    );
  }

  return out.filter(Boolean);
}

/** Displaced left-turn form. */
export function discussionDlt(results, inputs) {
  if (!results) return [];
  const { full, tdFt, sfMph, cycle } = inputs;
  return [
    `A weighted-average experienced travel time of ${n(results.ett, 1)} s/veh gives LOS ${results.los}, read from the Chapter 19 control-delay thresholds as the Chapter 34 worked examples do rather than from Exhibit 23-13.`,
    `The average is taken over ${results.cellCount} junction delay cells, so the letter describes the whole ${full ? 'full' : 'partial'} displaced left-turn intersection rather than any one of its signals.`,
    `Traversing the ${tdFt} ft displaced left-turn roadway at ${sfMph} mi/h takes ${n(results.off.tt_dlt_s, 1)} s, and the supplemental intersection is offset ${n(results.off.offset_supp_s, 1)} s into the ${cycle} s cycle so a left turn arrives at the crossover on green.`
  ].filter(Boolean);
}
