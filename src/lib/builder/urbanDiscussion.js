import { n, losRank } from '../discussion.js';

/**
 * Discussion for an urban street built in the builder (HCM Chapter 16).
 *
 * Chapter 16's answer is one letter for a whole facility, so the reading is what
 * that letter averages over. The generator names the facility's travel speed
 * against its base free-flow speed, since the LOS threshold is the ratio of the
 * two and not the speed itself, then the poorest segment, since Step 4 reports
 * it separately for exactly the reason that an acceptable average can hide an
 * unacceptable block, then the critical v/c, since a value above 1.0 at any
 * boundary intersection overrides the letter entirely.
 *
 * This is the hcm16 generator's subject with the builder's own inputs. It is a
 * separate file rather than a shared one because the builder knows things that
 * page does not, which signals produced which segment and which rows an analyst
 * pinned, and would otherwise have to fake a segment list to borrow it.
 */
export function urbanDiscussion(result) {
  if (!result || !result.segments?.length) return [];
  const out = [];
  const segs = result.segments;
  const lengthMi = (result.lengthFt ?? 0) / 5280;

  out.push(
    `${result.facilityName} runs ${n(lengthMi, 2)} mi in ${segs.length} segment${segs.length === 1 ? '' : 's'} between ${segs.length + 1} boundary intersections, and reads LOS ${result.los} at a travel speed of ${n(result.travelSpeed, 1)} mi/h.`,
  );

  // The LOS threshold is the ratio, not the speed, which is the thing most
  // worth saying plainly: two facilities at the same speed can be two letters
  // apart if their base free-flow speeds differ.
  if (Number.isFinite(result.baseFfs) && result.baseFfs > 0) {
    const pct = (100 * result.travelSpeed) / result.baseFfs;
    out.push(
      `That speed is ${n(pct, 0)}% of the facility base free-flow speed of ${n(result.baseFfs, 1)} mi/h, and it is the percentage rather than the speed that Exhibit 16-3 reads for the letter.`,
    );
  }

  // Step 4 reports the poorest segment separately, so the discussion does too.
  let worst = segs[0];
  for (const s of segs) if (losRank(s.los) > losRank(worst.los)) worst = s;
  if (result.poorestSegmentLos && worst?.los) {
    out.push(
      result.poorestSegmentLos === result.los
        ? `The poorest-performing segment also reads LOS ${result.poorestSegmentLos}, so the facility letter is not hiding a worse block inside it.`
        : `The poorest-performing segment reads LOS ${result.poorestSegmentLos}, one the facility average does not show. That is segment ${worst.index + 1}, ${Math.round(worst.lengthFt)} ft ending at its boundary signal, at ${n(worst.travelSpeed, 1)} mi/h. Chapter 16 Step 4 reports it separately for this reason.`,
    );
  }

  if (Number.isFinite(result.criticalVcRatio)) {
    out.push(
      result.criticalVcRatio > 1.0
        ? `The critical through v/c ratio at a boundary intersection is ${n(result.criticalVcRatio, 2)}, above 1.0, so the Exhibit 16-3 footnote forces facility LOS F whatever the travel speed says.`
        : `The critical through v/c ratio at a boundary intersection is ${n(result.criticalVcRatio, 2)}, so every boundary is undersaturated and the letter comes from the travel speed alone.`,
    );
  }

  if (Number.isFinite(result.spatialStopRate)) {
    out.push(
      `The facility stops ${n(result.spatialStopRate, 2)} times per mile (Equation 16-4)${Number.isFinite(result.perceptionScore) ? `, which is what carries the traveler perception score of ${n(result.perceptionScore, 2)}` : ''}.`,
    );
  }

  if (result.mode === 'measures') {
    out.push(
      'This facility was given by its published Chapter 18 measures rather than by Chapter 18 inputs, so only the Chapter 16 aggregation ran. The segment speeds above are the ones supplied, not ones recomputed from geometry.',
    );
  } else {
    const sources = new Set(segs.map((s) => s.apDelaySource).filter(Boolean));
    if (sources.size === 1) {
      const only = [...sources][0];
      out.push(
        only === 'published'
          ? 'Every segment took its access-point delay from per-point values supplied on the access points, the first of the three sources Equation 18-7 accepts.'
          : only === 'computed'
            ? 'Every segment computed its access-point delay from the access point approach volumes by the Chapter 30 Section 4 procedure.'
            : 'No access point carries a delay or an approach, so every segment fell to the Exhibit 18-13 planning estimate for its access-point delay. That estimate is coarser than the Chapter 30 Section 4 procedure and is the usual reason a reproduction of a published example misses its travel speed.',
      );
    } else if (sources.size > 1) {
      out.push(
        `The segments do not agree on where their access-point delay comes from: ${[...sources].join(', ')}. Equation 18-7 takes whichever source a segment supplies, so a facility mixing them is comparing segments computed to different fidelities.`,
      );
    }
  }

  const pinned = segs.filter((s) => s.overridden).length;
  if (pinned) {
    out.push(
      `${pinned} segment${pinned === 1 ? ' was' : 's were'} pinned by an override, so ${pinned === 1 ? 'its row does' : 'their rows do'} not follow the signals above ${pinned === 1 ? 'it' : 'them'}.`,
    );
  }

  return out.filter(Boolean);
}

/**
 * Discussion for the Chapter 17 handoff.
 *
 * Chapter 17's answer is a distribution rather than a letter, so the reading is
 * where its middle sits and how long its tail is, and the last sentence says
 * plainly that no level of service is assigned. What this generator adds over
 * the hcm17 page's is the sentence only the builder can write, that the
 * distribution belongs to the same street the facility result above it
 * describes, and the qualification that on a measures-mode facility it does not.
 */
export function urbanReliabilityDiscussion(rel, result = null) {
  if (!rel) return [];
  const out = [];

  out.push(
    `Over ${rel.numScenarios.toLocaleString('en-US')} scenarios, a mean travel time index of ${n(rel.ttiMean, 3)} puts the average trip at ${n(rel.meanTravelTime, 1)} s against a base free-flow travel time of ${n(rel.baseFreeFlowTravelTime, 1)} s.`,
  );

  out.push(
    `The 95th percentile index of ${n(rel.tti95, 3)} against a median of ${n(rel.tti50, 3)} is the length of the tail, and the reliability rating of ${n(rel.reliabilityRating, 1)}% is the share of ${rel.vmtWeighted ? 'travel' : 'observations'} running below a travel time index of 1.33.`,
  );

  if (rel.numOversaturatedScenarios > 0) {
    out.push(
      `${rel.numOversaturatedScenarios} of those scenarios ran oversaturated, and each carried its residual queue forward into the next analysis period rather than discarding it, which is what puts weight in the tail above.`,
    );
  }

  if (rel.strategyCount) {
    out.push(
      `${rel.strategyCount} ATDM strateg${rel.strategyCount === 1 ? 'y was' : 'ies were'} applied, as input-level adjustments to the boundary signals rather than as a named strategy the engine models.`,
    );
  }

  if (result) {
    out.push(
      result.mode === 'measures'
        ? 'The facility above was given by its published Chapter 18 measures, and the reliability engine cannot take a supplied travel speed. So this distribution belongs to the segment geometry beside those measures rather than to the measures themselves, and the two results are not describing quite the same street.'
        : `The facility above reads LOS ${result.los} at ${n(result.travelSpeed, 1)} mi/h under its seed demand, so the spread here comes from the weather, demand and incident scenarios rather than from the seed day itself.`,
    );
  }

  out.push(
    'Chapter 17 reports a travel time distribution rather than a service measure, so no level of service letter is assigned to a reliability run.',
  );

  return out.filter(Boolean);
}
