import { n, losRank } from '$lib/discussion.js';

/**
 * Discussion for a freeway facility (HCM Chapter 10 core methodology).
 *
 * A facility answer is a matrix, so the useful reading is which cell of it governs. The generator
 * names the poorest period, then the tightest segment-period cell by demand-to-capacity ratio,
 * which is the cell that breaks down first as demand grows and the one the oversaturated procedure
 * starts from.
 */
export function discussion(results, inputs) {
  if (!results || !results.perPeriod || results.perPeriod.length === 0) return [];
  const { segments } = inputs;
  const out = [];

  out.push(
    `The facility averages ${n(results.overall_speed, 1)} mi/h and ${n(results.overall_density, 1)} veh/mi/ln over ${n(results.total_length, 2)} mi across ${results.perPeriod.length} analysis period${results.perPeriod.length === 1 ? '' : 's'}.`
  );

  let worstP = 0;
  results.perPeriod.forEach((p, i) => {
    if (losRank(p.los) > losRank(results.perPeriod[worstP].los)) worstP = i;
  });
  out.push(
    `Period ${worstP + 1} is the poorest at LOS ${results.perPeriod[worstP].los}, ${n(results.perPeriod[worstP].density, 1)} veh/mi/ln at ${n(results.perPeriod[worstP].speed, 1)} mi/h.`
  );

  // The governing cell of the time-space domain. Reported by ratio rather than by density, because
  // that is what decides whether the facility breaks down and which segment does so first.
  let gov = null;
  (results.dcMatrix ?? []).forEach((row, s) => {
    row.forEach((dc, p) => {
      if (Number.isFinite(dc) && (!gov || dc > gov.dc)) gov = { s, p, dc };
    });
  });
  if (gov) {
    const wz = results.workZoneSegs && results.workZoneSegs[gov.s] ? ', which carries the work zone' : '';
    const type = segments && segments[gov.s] ? ` (${segments[gov.s].seg_type})` : '';
    out.push(
      `The tightest cell is segment ${gov.s + 1}${type}${wz} in period ${gov.p + 1}, at a demand-to-capacity ratio of ${n(gov.dc, 2)} against a capacity of ${n(results.capacityMatrix[gov.s][gov.p], 0)} veh/h.`
    );
  }

  out.push(
    results.oversaturated
      ? 'Demand exceeds capacity somewhere in the time-space domain, so the Chapter 25 queue-tracking procedure carried queues into upstream segments and later periods rather than analyzing each cell on its own.'
      : 'No cell exceeds its capacity, so every period was analyzed as an undersaturated facility and no queue was carried forward.'
  );

  if (results.ml) {
    const g = results.ml.groups[worstP];
    out.push(
      `In that period the managed lane group runs at ${n(g.ml.speed, 1)} mi/h and LOS ${g.ml.los} against ${n(g.gp.speed, 1)} mi/h and LOS ${g.gp.los} on the general purpose lanes, and the facility values above combine the two by lane miles.`
    );
  }

  return out.filter(Boolean);
}
