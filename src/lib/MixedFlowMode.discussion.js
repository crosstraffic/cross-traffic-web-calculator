import { n, share } from '$lib/discussion.js';

/**
 * Discussion for the mixed-flow model (HCM Chapters 26 and 25), the second method on the Chapter 12
 * page.
 *
 * The no-LOS rule is the whole point of these two generators. Chapter 26 assigns LOS F when demand
 * exceeds mixed-flow capacity and assigns nothing else, because D_mix is a mixed-flow density and
 * the Exhibit 12-15 bands are auto-only densities of a different quantity. So the discussion states
 * the density and the capacity margin and then says why there is no letter, rather than leaving the
 * absence to be read as a gap in the tool.
 */

/** Single sustained grade, HCM Chapter 26. */
export function discussion(results, inputs) {
  if (!results) return [];
  const { grade, length, vMix, pSutPct, pTtPct } = inputs;
  // Whole percentages are the common case and "15.0%" reads as a measured value rather than an
  // entered one, so the decimal rides only when the sum actually has one.
  const truckSum = Number(pSutPct) + Number(pTtPct);
  const truckPct = n(truckSum, Number.isInteger(truckSum) ? 0 : 1);
  const out = [];

  if (results.oversaturated) {
    out.push(
      `Mixed-flow demand of ${n(vMix, 0)} veh/h/ln exceeds the mixed-flow capacity of ${n(results.capacity_mix, 0)} veh/h/ln, which is the one condition Chapter 26 assigns a letter on, so LOS F follows and the method reports no speed or density above capacity.`,
    );
  } else {
    out.push(
      `A mixed-flow speed of ${n(results.s_mix, 1)} mi/h at ${n(vMix, 0)} veh/h/ln gives a density of ${n(results.d_mix, 1)} veh/mi/ln, against a mixed-flow free-flow speed of ${n(results.ffs_mix, 1)} mi/h.`,
    );
    out.push(
      `Demand is ${share(vMix, results.capacity_mix, 0)}% of the mixed-flow capacity of ${n(results.capacity_mix, 0)} veh/h/ln, leaving ${n(results.capacity_mix - vMix, 0)} veh/h/ln of headroom.`,
    );
  }

  out.push(
    `The ${grade}% grade over ${length} mi with ${truckPct}% trucks cuts capacity to ${share(results.caf_mix, 1, 0)}% of the auto-only value through CAF_mix of ${n(results.caf_mix, 3)}, and the trucks slowing on the grade rather than the car stream set that factor.`,
  );

  out.push(
    results.oversaturated
      ? 'No other level of service letter is defined. D_mix is a mixed-flow density in veh/mi/ln and the Exhibit 12-15 bands are auto-only densities in pc/mi/ln, so the two cannot be read against each other.'
      : 'No level of service letter is assigned below capacity. Chapter 26 assigns F only above mixed-flow capacity, and D_mix is a mixed-flow density in veh/mi/ln that the auto-only Exhibit 12-15 bands in pc/mi/ln do not apply to.',
  );

  return out.filter(Boolean);
}

/** Composite grade profile, HCM Chapter 25. */
export function discussionComposite(results, inputs) {
  if (!results) return [];
  const { segments, vMix } = inputs;
  const gov = segments[results.governing_segment];
  const out = [];

  out.push(
    results.oversaturated
      ? `Mixed-flow demand of ${n(vMix, 0)} veh/h/ln exceeds the governing capacity of ${n(results.capacity_mix, 0)} veh/h/ln, so LOS F is assigned and the profile is over capacity somewhere along it.`
      : `Covering ${n(results.total_length, 2)} mi in ${n(results.total_travel_time, 1)} s gives an overall mixed-flow speed of ${n(results.s_mix_overall, 1)} mi/h, the total distance over the summed segment travel times rather than an average of the segment speeds.`,
  );

  if (gov) {
    out.push(
      `The governing capacity of ${n(results.capacity_mix, 0)} veh/h/ln is set by segment ${results.governing_segment + 1}, the ${gov.grade}% grade over ${gov.length} mi, and the facility can carry no more than its tightest grade allows.`,
    );
  }

  const slowest = results.segments.reduce(
    (w, s, i) => (s.s_mix != null && (w === null || s.s_mix < results.segments[w].s_mix) ? i : w),
    null,
  );
  if (slowest !== null && segments[slowest]) {
    out.push(
      `Trucks are slowest on segment ${slowest + 1} at ${n(results.segments[slowest].s_mix, 1)} mi/h, and because each grade is entered at the speed the previous one was left at, that speed depends on the order of the profile and not only on the grade itself.`,
    );
  }

  out.push(
    'Chapter 25 assigns no level of service letter to a composite-grade result beyond flagging demand above the governing capacity.',
  );

  return out.filter(Boolean);
}
