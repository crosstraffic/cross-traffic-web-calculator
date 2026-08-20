import { letterFor } from '$lib/los.js';
import { n, positionSentence } from '$lib/discussion.js';

/**
 * Discussion for a freeway merge or diverge segment (HCM Chapter 14), one generator per edition.
 *
 * Two things about this chapter have to survive into the prose. Exhibit 14-3 assigns LOS F only on
 * insufficient capacity, so a high density alone is LOS E and saying "close to F" off the density
 * would be wrong. And a major merge under capacity gets no letter at all, which the generator
 * states rather than leaving as a blank.
 */

/** 7th Edition. */
export function discussion(results, inputs) {
  if (!results) return [];
  const { typeLabel, accelLen, decelLen, isOnRamp } = inputs;
  const out = [];

  if (results.losUndefined) {
    out.push(
      `Chapter 14 evaluates a ${typeLabel.toLowerCase()} through its capacity checks alone and defines no level of service for it below capacity, so no letter is assigned here.`,
    );
  } else if (results.demand_exceeds_capacity) {
    out.push(
      `Demand exceeds the freeway capacity of ${n(results.capacity_freeway, 0)} pc/h, which is the only condition Exhibit 14-3 assigns LOS F on, so the letter is F whatever the influence area density.`,
    );
  } else {
    const earned = letterFor('density_ramp_v7', results.density);
    out.push(
      earned === results.los
        ? positionSentence('density_ramp_v7', results.density, { digits: 1, label: 'Influence area density' })
        : `Influence area density of ${n(results.density, 1)} pc/mi/ln gives LOS ${results.los} against the Exhibit 14-3 bands.`,
    );
  }

  out.push(
    `Of ${n(results.flow_freeway, 0)} pc/h approaching on the freeway, ${n(results.v12, 0)} pc/h runs in lanes 1 and 2, and the influence area density is taken over that flow rather than over the whole roadway.`,
  );

  out.push(
    `Demand runs at a volume-to-capacity ratio of ${n(results.vc_ratio, 2)}, with the ramp roadway itself carrying ${n(results.flow_ramp, 0)} pc/h against a ramp capacity of ${n(results.capacity_ramp, 0)} pc/h.`,
  );

  const gap = results.speed_avg - results.speed_ramp;
  out.push(
    `The influence area averages ${n(results.speed_ramp, 1)} mi/h against ${n(results.speed_avg, 1)} mi/h across all lanes, a difference of ${n(Math.abs(gap), 1)} mi/h that the ${isOnRamp ? `${accelLen} ft acceleration lane` : `${decelLen} ft deceleration lane`} is the main geometric control on.`,
  );

  return out.filter(Boolean);
}

/** Edition 7.1. */
export function discussion71(results, inputs) {
  if (!results) return [];
  const { typeLabel } = inputs;
  const out = [];

  if (results.demand_exceeds_capacity) {
    out.push(`Demand exceeds capacity, so LOS ${results.los} is assigned and no influence area density is reported.`);
  } else if (Number.isFinite(results.density)) {
    const earned = letterFor('density_v7_1', results.density);
    out.push(
      earned === results.los
        ? positionSentence('density_v7_1', results.density, { digits: 1, label: 'Influence area density' })
        : `Influence area density of ${n(results.density, 1)} pc/mi/ln gives LOS ${results.los} against the Edition 7.1 Exhibit 14-2 bands, which are tighter than the 7th Edition's at every letter.`,
    );
  }

  if (results.speed_avg != null) {
    out.push(
      `The influence area speed of ${n(results.speed_avg, 1)} mi/h is an equivalent basic segment speed of ${n(results.speed_basic, 1)} mi/h less a speed impedance of ${n(results.speed_impedance, 2)} mi/h, and that impedance is the whole of what the ${typeLabel.toLowerCase()} costs under Edition 7.1.`,
    );
  }

  if (results.capacity_per_lane != null && results.dc_ratio != null) {
    out.push(
      `Flow of ${n(results.flow_per_lane, 0)} pc/h/ln runs at a demand-to-capacity ratio of ${n(results.dc_ratio, 2)} against an influence area capacity of ${n(results.capacity_per_lane, 0)} pc/h/ln.`,
    );
  }

  out.push(
    `The neighboring freeway capacity is ${n(results.capacity_neighboring_freeway, 0)} pc/h and the ramp roadway capacity ${n(results.capacity_ramp_roadway, 0)} pc/h, and either can bind before the influence area does.`,
  );

  return out.filter(Boolean);
}
