import { n, losRank } from '../discussion.js';

/**
 * Discussion for a facility built in the builder (HCM Chapter 10 core methodology).
 *
 * The chapter's answer is a matrix, so the reading is which cell of it governs. The generator names
 * the tightest segment-period cell by demand-to-capacity ratio, since that is what decides whether
 * the facility breaks down and which segment does so first, then the facility letters as a sequence
 * with its poorest period, then the queue. Where the facility went oversaturated it says when the
 * queue formed and whether it cleared inside the study period, because that is the question the
 * temporal limits of Chapter 10 Section 3 are about.
 *
 * This is the hcm10 generator's subject with the builder's own inputs. It is a separate file rather
 * than a shared one because the builder knows things that page does not, which segments a work zone
 * covers and which rows an analyst pinned, and would otherwise have to fake a segment list to
 * borrow it.
 */
export function discussion(result) {
  if (!result || !result.perPeriod?.length) return [];
  const out = [];
  const periods = result.numPeriods;

  out.push(
    `${result.facilityName} runs ${n(result.totalLengthMi, 2)} mi in ${result.numSegments} segments over ${periods} analysis period${periods === 1 ? '' : 's'}, averaging ${n(result.overallSpeed, 1)} mi/h and ${n(result.overallDensity, 1)} veh/mi/ln.`,
  );

  // The governing cell of the time-space domain, by ratio rather than by density, because the
  // ratio is what decides whether the cell breaks down at all.
  let gov = null;
  result.matrices.dc.forEach((row, s) => {
    row.forEach((dc, p) => {
      if (Number.isFinite(dc) && (!gov || dc > gov.dc)) gov = { s, p, dc };
    });
  });
  if (gov) {
    const seg = result.segments[gov.s];
    const wz = seg?.workZone ? ', which carries the work zone' : '';
    const pin = seg?.overridden ? ', a row pinned by an override' : '';
    out.push(
      `The governing cell is segment ${gov.s + 1} (${seg?.segType})${wz}${pin} in period ${gov.p + 1}, at a demand-to-capacity ratio of ${n(gov.dc, 2)} against a capacity of ${n(result.matrices.capacity[gov.s][gov.p], 0)} veh/h, running ${n(result.matrices.density[gov.s][gov.p], 1)} veh/mi/ln at LOS ${result.matrices.los[gov.s][gov.p]}.`,
    );
  }

  let worstP = 0;
  result.perPeriod.forEach((p, i) => {
    if (losRank(p.los) > losRank(result.perPeriod[worstP].los)) worstP = i;
  });
  out.push(
    `Across the study period the facility reads ${result.perPeriod.map((p) => p.los).join(', ')}, poorest in period ${worstP + 1} at ${n(result.perPeriod[worstP].density, 1)} veh/mi/ln and ${n(result.perPeriod[worstP].speed, 1)} mi/h.`,
  );

  if (result.oversaturated) {
    const formed = result.firstQueuedPeriod;
    const cleared = result.lastQueuedPeriod;
    const first = result.firstOversatPeriod;
    const when = first == null ? '' : ` Demand first exceeds capacity in period ${first + 1}.`;
    if (formed == null) {
      out.push(
        `Demand exceeds capacity somewhere in the time-space domain, so the Chapter 25 queue-tracking procedure ran, though no segment held a standing queue at the end of any period.${when}`,
      );
    } else if (cleared != null && cleared < periods - 1) {
      out.push(
        `A queue forms in period ${formed + 1} and has dissipated by period ${cleared + 2}, so the study period contains the whole of it, which is what Chapter 10 Section 3 asks of the temporal extent.${when}`,
      );
    } else {
      out.push(
        `A queue forms in period ${formed + 1} and is still standing in the last period, so the study period does not contain its dissipation. Chapter 10 Section 3 asks that it should, so further periods should be added at the end before these numbers are used.${when}`,
      );
    }
  } else {
    out.push(
      'No cell exceeds its capacity, so every period was analyzed as an undersaturated facility and no queue was carried into an upstream segment or a later period.',
    );
  }

  if (result.unboundFields.length) {
    out.push(
      `This facility carries ${result.unboundFields.map((u) => `${u.field} on segment ${u.segment}`).join(', ')}, which no binding can pass to the engine, so the run above is of the facility without ${result.unboundFields.length === 1 ? 'it' : 'them'}.`,
    );
  }

  return out.filter(Boolean);
}

/**
 * Discussion for the Chapter 11 handoff.
 *
 * Chapter 11's answer is a distribution rather than a letter, so the reading is where its middle
 * sits and how long its tail is, and the last sentence says plainly that no level of service is
 * assigned. The hcm11 generator says the same things about the same measures. What this one adds is
 * the sentence only the builder can write, that the distribution belongs to the same facility the
 * heatmap above it describes.
 */
export function reliabilityDiscussion(rel, result = null) {
  if (!rel) return [];
  const out = [];

  out.push(
    `A mean travel time index of ${n(rel.ttiMean, 3)} puts the average trip at ${n(rel.ttiMean * rel.fftt, 2)} min against a free-flow travel time of ${n(rel.fftt, 2)} min, over ${rel.numScenarios} scenarios generated from this facility as the seed file.`,
  );

  out.push(
    `The 95th percentile index of ${n(rel.tti95, 3)} against a median of ${n(rel.tti50, 3)} is the length of the tail, and a misery index of ${n(rel.miseryIndex, 3)} describes the worst of it.`,
  );

  out.push(
    `The reliability rating of ${n(rel.reliabilityRating, 1)}% is the share of ${rel.vmtWeighted ? 'travel' : 'observations'} running below a travel time index of 1.33, and ${n(rel.pctBelowTarget, 1)}% of travel falls below ${rel.targetSpeed} mi/h.`,
  );

  if (result) {
    out.push(
      result.oversaturated
        ? `The seed facility is already oversaturated in the Chapter 10 run above, at ${n(result.overallSpeed, 1)} mi/h overall, so these scenarios are variations on a facility that breaks down under its own seed demand rather than only on an unusual day.`
        : `The seed facility is undersaturated in the Chapter 10 run above, at ${n(result.overallSpeed, 1)} mi/h overall, so the tail of this distribution comes from the demand and incident scenarios rather than from the seed day itself.`,
    );
  }

  out.push(
    'Chapter 11 reports a travel time distribution rather than a service measure, so no level of service letter is assigned to a reliability run.',
  );

  return out.filter(Boolean);
}
