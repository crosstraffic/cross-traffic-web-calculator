import { letterFor } from '$lib/los.js';
import { n, positionSentence, worstBy, losRank } from '$lib/discussion.js';

/**
 * Discussion for a two-lane highway facility (HCM Chapter 15).
 *
 * The facility value is length-weighted, so the sentence that matters is which segment is dragging
 * it. Exhibit 15-6 splits its bands by posted speed limit, and `los.js` carries only the 50 mi/h
 * and above column, so the band sentence is offered on that side and the plain reading on the
 * other rather than transcribing the second column here.
 */
export function discussion(results, inputs) {
  if (!results || !results.segs || results.segs.length === 0) return [];
  const { rows, weightedSpl } = inputs;
  const out = [];

  const higherSpeedClass =
    Number(weightedSpl) >= 50 && letterFor('follower_density', results.facilityFd) === results.facilityLos;
  const banded = higherSpeedClass
    ? positionSentence('follower_density', results.facilityFd, {
        digits: 2,
        label: 'Facility follower density',
        // los.js states the measure per lane; the page and the report print followers/mi, and a
        // two-lane highway has one lane per direction so the two are the same number.
        unit: 'followers/mi'
      })
    : null;
  out.push(
    banded ||
      `Facility follower density of ${n(results.facilityFd, 2)} followers/mi gives LOS ${results.facilityLos} against the Exhibit 15-6 bands for the ${Number(weightedSpl) >= 50 ? '50 mi/h and above' : 'below 50 mi/h'} posted speed class.`
  );

  const segs = results.segs.map((s, i) => ({ ...s, index: i }));
  const worst = worstBy(segs, (s) => s.fd);
  if (worst && segs.length > 1) {
    out.push(
      `Segment ${worst.index + 1} governs at ${n(worst.fd, 2)} followers/mi and LOS ${worst.los}, the poorest of the ${segs.length} segments, and the facility value is the length-weighted mix of them all.`
    );
  }

  const focus = worst || segs[0];
  out.push(
    `On that segment ${n(focus.pf, 1)}% of vehicles are following, at an average speed of ${n(focus.avgspd, 1)} mi/h against a free-flow speed of ${n(focus.ffs, 1)} mi/h.`
  );

  const plIndex = (rows ?? []).findIndex((r) => r.passing_type === 'Passing Lane');
  if (plIndex >= 0) {
    out.push(
      `Segment ${plIndex + 1} is a passing lane, so its follower density is the midpoint value and the segments downstream of it carry an adjusted follower density for as far as its effective length reaches.`
    );
  } else if (segs.length > 1 && losRank(worst.los) > losRank(results.facilityLos)) {
    out.push(
      `The governing segment reads a poorer letter than the facility as a whole, so the facility letter alone masks how the trip runs on the worst part of it.`
    );
  }

  return out.filter(Boolean);
}
