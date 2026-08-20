import { letterFor } from '$lib/los.js';
import { n, share, positionSentence } from '$lib/discussion.js';

/**
 * Discussion for a freeway weaving segment (HCM Chapter 13), one generator per edition.
 *
 * The 7th Edition and Edition 7.1 answer different questions with the same inputs. The 7th Edition
 * reports separate weaving and nonweaving speeds and reads density against Exhibit 13-6; Edition
 * 7.1 builds one overall speed as an equivalent basic segment less an impedance and reads the
 * tighter Exhibit 13-7 bands. Splitting the generators keeps each one saying only what its own
 * method computed.
 */

/** 7th Edition. */
export function discussion(results, inputs) {
  if (!results) return [];
  const { facilityType, lengthShort } = inputs;
  const out = [];

  if (!results.is_weaving) {
    // Step 1's own exit. Nothing downstream is a weaving result, so this leads rather than trails.
    out.push(
      `The short length of ${n(lengthShort, 0)} ft is longer than the maximum weaving length L_MAX of ${n(results.l_max, 0)} ft, so weaving turbulence does not reach across the segment and the HCM directs it to be analyzed as separate merge and diverge segments instead.`,
    );
  }

  // los.js carries the Exhibit 13-6 freeway bands only, and the multilane and C-D column has its
  // own set, so the band sentence is offered for freeways and the plain reading for the rest.
  const earned = facilityType === 'freeway' ? letterFor('density_weaving_v7', results.density) : null;
  if (earned && earned === results.los) {
    out.push(positionSentence('density_weaving_v7', results.density, { digits: 1, label: 'Density' }));
  } else {
    out.push(
      `Density of ${n(results.density, 1)} pc/mi/ln gives LOS ${results.los} against the Exhibit 13-6 ${facilityType === 'freeway' ? 'freeway' : 'multilane and C-D roadway'} bands.`,
    );
  }

  const vc = results.vc_ratio;
  out.push(
    vc >= 1
      ? `Demand runs at a volume-to-capacity ratio of ${n(vc, 2)} against a capacity of ${n(results.capacity, 0)} veh/h, so the segment is over capacity.`
      : `Total flow of ${n(results.flow_total, 0)} pc/h runs at a volume-to-capacity ratio of ${n(vc, 2)} against a capacity of ${n(results.capacity, 0)} veh/h.`,
  );

  const gap = results.speed_weaving - results.speed_nonweaving;
  out.push(
    `Weaving vehicles travel ${n(Math.abs(gap), 1)} mi/h ${gap >= 0 ? 'faster' : 'slower'} than nonweaving vehicles, and with a volume ratio of ${n(results.volume_ratio, 3)} the weaving movements are ${share(results.volume_ratio, 1, 0)}% of the flow the average speed of ${n(results.speed_avg, 1)} mi/h is taken over.`,
  );

  return out.filter(Boolean);
}

/** Edition 7.1. */
export function discussion71(results) {
  if (!results) return [];
  const out = [];
  const overCapacity = results.dc_ratio != null && results.dc_ratio > 1;

  if (Number.isFinite(results.density) && !overCapacity) {
    const earned = letterFor('density_v7_1', results.density);
    out.push(
      earned === results.los
        ? positionSentence('density_v7_1', results.density, { digits: 1, label: 'Density' })
        : `Density of ${n(results.density, 1)} pc/mi/ln gives LOS ${results.los} against the Edition 7.1 Exhibit 13-7 bands.`,
    );
  } else {
    out.push(`Demand is past the segment capacity, so LOS ${results.los} is assigned and no density is reported.`);
  }

  if (results.speed_avg != null) {
    out.push(
      `The overall speed of ${n(results.speed_avg, 1)} mi/h is an equivalent basic segment speed of ${n(results.speed_basic, 1)} mi/h less a speed impedance of ${n(results.speed_impedance, 2)} mi/h, and that impedance is the whole of what the weaving costs under Edition 7.1.`,
    );
  }

  if (results.capacity_per_lane != null && results.dc_ratio != null) {
    out.push(
      overCapacity
        ? `The demand-to-capacity ratio is ${n(results.dc_ratio, 2)} against a capacity of ${n(results.capacity_per_lane, 0)} pc/h/ln, which Edition 7.1 sets at the 35 pc/mi/ln breakdown density.`
        : `Flow runs at a demand-to-capacity ratio of ${n(results.dc_ratio, 2)} against a capacity of ${n(results.capacity_per_lane, 0)} pc/h/ln, which Edition 7.1 sets at the 35 pc/mi/ln breakdown density rather than at a tabulated value.`,
    );
  }

  out.push(
    `The configuration class is ${results.class}, which is what selects the impedance form the speed was built with.`,
  );

  return out.filter(Boolean);
}
