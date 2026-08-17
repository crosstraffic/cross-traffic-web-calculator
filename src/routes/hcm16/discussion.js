import { n, share, worstBy, losRank } from '$lib/discussion.js';

/**
 * Discussion for an urban street facility (HCM Chapter 16).
 *
 * Exhibit 16-3 keys LOS on travel speed against the base free-flow speed, and the thresholds are a
 * table interpolated on that base speed rather than a fixed ratio, so the generator states both
 * speeds and the ratio between them without naming a band edge. The band-edge sentences elsewhere
 * come from `los.js`, which does not carry this table, and transcribing it a second time here
 * would give the site two copies of a published exhibit that could drift apart.
 */
export function discussion(results, inputs) {
  if (!results) return [];
  const { mode } = inputs;
  const segments = results.segments ?? [];
  const out = [];

  out.push(
    `A facility travel speed of ${n(results.travel_speed, 2)} mi/h is ${share(results.travel_speed, results.base_ffs, 0)}% of the base free-flow speed of ${n(results.base_ffs, 2)} mi/h, and Exhibit 16-3 reads LOS ${results.los} from that travel speed against thresholds interpolated on the base speed.`
  );

  if (Number.isFinite(results.critical_vc_ratio) && results.critical_vc_ratio > 1) {
    out.push(
      `The critical volume-to-capacity ratio of ${n(results.critical_vc_ratio, 2)} is above 1.0, and the Exhibit 16-3 footnote forces LOS F on that alone whatever the speed ratio says.`
    );
  } else if (Number.isFinite(results.critical_vc_ratio)) {
    out.push(
      `The critical volume-to-capacity ratio is ${n(results.critical_vc_ratio, 2)}, so no boundary intersection is over capacity and the letter comes from the speed rather than from the footnote.`
    );
  }

  const worst = worstBy(
    segments.map((s, i) => ({ ...s, index: i })),
    (s) => losRank(s.los)
  );
  if (worst && segments.length > 1) {
    out.push(
      `The poorest segment is number ${worst.index + 1} at LOS ${worst.los} and ${n(worst.travel_speed, 2)} mi/h over ${n(worst.length_ft, 0)} ft, and the facility figure is the length-weighted harmonic mean across all ${segments.length} segments.`
    );
  }

  out.push(
    `A spatial stop rate of ${n(results.spatial_stop_rate, 2)} stops/mi over ${n(results.length_ft, 0)} ft works out to about ${n((results.spatial_stop_rate * results.length_ft) / 5280, 1)} stops across the facility, against a traveler perception score of ${n(results.perception_score, 2)}.${mode === 'measures' ? ' The segment measures were entered rather than computed, so no Chapter 18 engine ran behind them.' : ''}`
  );

  return out.filter(Boolean);
}
