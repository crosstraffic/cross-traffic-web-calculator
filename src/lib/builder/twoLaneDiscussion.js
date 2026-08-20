import { n, losRank } from '../discussion.js';

/**
 * Discussion for a two-lane highway built in the builder (HCM Chapter 15).
 *
 * This is the hcm15 generator's subject with the builder's own inputs, and it is
 * a separate file rather than a shared one for the same reason the urban one is:
 * the builder knows things that page does not. It knows which features produced
 * which segment, which rows an analyst pinned, whether a passing lane was demoted
 * under Exhibit 15-10, and what the engine's own recommended segment lengths came
 * back as. The hcm15 page has none of that and would have to be handed a fake
 * feature layer to borrow this.
 *
 * The order follows what a reader of a Chapter 15 result needs in order. The
 * facility letter and the band it sits in, because Exhibit 15-6 keys on the
 * posted speed limit and not on the speed the highway actually runs. Then the
 * governing segment, because a length-weighted facility value hides it. Then the
 * passing lane, because its column is a different quantity from every other
 * column and its benefit reaches segments that do not contain it. Then the
 * things this builder alone can say.
 */
export function twoLaneDiscussion(result) {
  if (!result || !result.segments?.length) return [];
  const out = [];
  const segs = result.segments;
  const lengthMi = (result.lengthFt ?? 0) / 5280;
  const higherSpeedClass = result.weightedSpl >= 50;

  out.push(
    `${result.facilityName} runs ${n(lengthMi, 2)} mi ${result.direction ? `${result.direction.toLowerCase()} ` : ''}in ${segs.length} segment${segs.length === 1 ? '' : 's'}, and reads LOS ${result.los} at a facility follower density of ${n(result.facilityFd, 2)} followers/mi.`,
  );

  // The band, not the number, is what most readers get wrong here: Exhibit 15-6
  // has two columns and the posted limit picks the column.
  out.push(
    `Exhibit 15-6 bands follower density by POSTED speed limit rather than by the speed achieved, and this highway posts ${n(result.weightedSpl, 0)} mi/h${segs.length > 1 ? ' on a length-weighted average' : ''}, so the letter comes off the ${higherSpeedClass ? '50 mi/h and above' : 'below 50 mi/h'} column.`,
  );

  if (segs.length > 1) {
    let worst = segs[0];
    for (const s of segs)
      if (
        losRank(s.los) > losRank(worst.los) ||
        (losRank(s.los) === losRank(worst.los) && s.followerDensity > worst.followerDensity)
      )
        worst = s;
    out.push(
      `Segment ${worst.index + 1} governs at ${n(worst.followerDensity, 2)} followers/mi and LOS ${worst.los}, and the facility value is the length-weighted mix of all ${segs.length} (Equation 15-39).`,
    );
    out.push(
      `On that segment ${n(worst.percentFollowers, 1)}% of vehicles are following, at an average speed of ${n(worst.avgSpeed, 1)} mi/h against a free-flow speed of ${n(worst.ffs, 2)} mi/h.`,
    );
    if (losRank(worst.los) > losRank(result.los)) {
      out.push(
        'That segment reads a poorer letter than the facility as a whole, so the facility letter alone masks how the trip runs over the worst of it.',
      );
    }
  } else {
    const only = segs[0];
    out.push(
      `${n(only.percentFollowers, 1)}% of vehicles are following, at an average speed of ${n(only.avgSpeed, 1)} mi/h against a free-flow speed of ${n(only.ffs, 2)} mi/h. A single-segment facility has nothing to length-weight, so the facility value is the segment value.`,
    );
  }

  const pl = segs.find((s) => s.passingType === 2);
  if (pl) {
    const adjusted = segs.filter((s) => s.passingType !== 2 && s.fdAdjustment > 0);
    out.push(
      `Segment ${pl.index + 1} is a passing lane, so the ${n(pl.followerDensity, 2)} followers/mi in its column is the MIDPOINT value of Step 8 rather than the ${n(pl.fd, 2)} at its end, which is the value Steps 10 and 11 read for it.`,
    );
    out.push(
      adjusted.length
        ? `Its benefit reaches ${adjusted.length} segment${adjusted.length === 1 ? '' : 's'} downstream of it, ${adjusted.map((s) => `segment ${s.index + 1}`).join(' and ')}, which carr${adjusted.length === 1 ? 'ies' : 'y'} the Step 9 adjusted follower density rather than the plain one for as far as the passing lane's effective length reaches.`
        : 'No segment downstream of it falls inside its effective length, so nothing carries a Step 9 adjustment.',
    );
  }

  // Curves are the reason a two-lane segment can be slower than its geometry
  // suggests, and they are invisible in the segment table because they are
  // subsegments rather than segments.
  const curved = segs.filter((s) => s.isHc);
  if (curved.length) {
    const total = curved.reduce((a, s) => a + s.curveCount, 0);
    out.push(
      `${total} horizontal curve${total === 1 ? '' : 's'} sit inside ${curved.length} segment${curved.length === 1 ? '' : 's'} as subsegments rather than as segments of their own, and the Step 5d adjustment averages each subsegment's speed over the segment by length. A curve does not appear as a row in the table above for that reason.`,
    );
  }

  // Exhibit 15-10, off the engine's own identify_vertical_class rather than out
  // of a second copy of the table. The library computes these bounds and then
  // uses them nowhere, so this sentence is the only place they surface.
  const outside = segs.filter((s) => s.outsideRecommended);
  if (outside.length) {
    out.push(
      `${outside.length} segment${outside.length === 1 ? '' : 's'} fall outside the Exhibit 15-10 recommended length for their vertical class and passing type: ${outside.map((s) => `segment ${s.index + 1} at ${n(s.lengthMi, 2)} mi against ${n(s.minLengthMi, 2)} to ${n(s.maxLengthMi, 2)} mi`).join(', ')}. Step 1 asks for the bound to be substituted in Steps 2 through 9 and the actual length used again in Step 10. The engine does neither, so these segments were analyzed at their actual lengths and the values above are outside the range the method was calibrated over.`,
    );
  }

  // The entered vertical class is a real Step 2 input even though Step 3
  // overwrites it, so a disagreement is worth naming rather than hiding.
  const reclassified = segs.filter((s) => s.verticalAlignment !== s.verticalClassEntered);
  if (reclassified.length) {
    out.push(
      `${reclassified.length} segment${reclassified.length === 1 ? '' : 's'} were reclassified by Step 3: ${reclassified.map((s) => `segment ${s.index + 1} from class ${s.verticalClassEntered} to ${s.verticalAlignment}`).join(', ')}. Exhibit 15-11 computes the class from the grade and the segment length, and Steps 4 onward used the computed value. Step 2 had already picked a capacity off the entered one, so the two are worth reconciling.`,
    );
  }

  const demoted = segs.filter((s) => s.demotedPassingLane);
  if (demoted.length) {
    out.push(
      `${demoted.length} passing lane${demoted.length === 1 ? ' was' : 's were'} placed shorter than the 0.5 mi Exhibit 15-10 minimum and ${demoted.length === 1 ? 'is' : 'are'} therefore analyzed as Passing Constrained: ${demoted.map((s) => `segment ${s.index + 1} at ${n(s.lengthMi, 2)} mi`).join(', ')}. Step 1 says a passing lane shorter than the minimum should be ignored and treated as Passing Constrained, and a short added lane of that order is a turnout rather than a passing lane.`,
    );
  }

  const pinned = segs.filter((s) => s.overridden).length;
  if (pinned) {
    out.push(
      `${pinned} segment${pinned === 1 ? ' was' : 's were'} pinned by an override, so ${pinned === 1 ? 'its row does' : 'their rows do'} not follow the features above ${pinned === 1 ? 'it' : 'them'}.`,
    );
  }

  out.push(
    'Chapter 15 has no travel time reliability methodology, so unlike a freeway or an urban street facility there is no distribution to hand this highway to.',
  );

  return out.filter(Boolean);
}
