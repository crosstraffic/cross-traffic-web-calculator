/**
 * Level-of-service scales, shared by every calculator page.
 *
 * The HCM's shape is always the same: compute a service measure, compare it against that measure's
 * thresholds, read off a letter. What changes between chapters is *which* measure and *which*
 * thresholds, and that is exactly the thing a results panel should show rather than hide. A bare
 * "LOS: C" tells an engineer nothing about how close C was to D.
 *
 * Colour here is a status encoding, not a magnitude ramp: it reports a graded operating state, the
 * way good/warning/serious/critical does. The letter and the numeric band edges are always rendered
 * alongside it, so nothing is carried by colour alone. That matters concretely, because the amber
 * and orange steps sit close enough (dE 13.6 in normal vision) that they are not reliably
 * distinguishable on their own.
 */

/** Status steps, ordered A through F. Fixed, never themed. */
export const LOS_COLORS = {
  A: '#0ca30c',
  B: '#5cb318',
  C: '#fab219',
  D: '#ef9a3c',
  E: '#ec835a',
  F: '#d03b3b'
};

export const LOS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * The service measures the library actually reports, with the thresholds each chapter defines.
 *
 * `edges` are the upper bounds of bands A through E; F is everything beyond the last edge.
 * `direction: 'higher-is-worse'` covers density and delay, where the measure climbs as service
 * degrades. `'higher-is-better'` covers speed-based measures, where the bands run the other way.
 */
export const SERVICE_MEASURES = {
  density_pc: {
    label: 'Density',
    unit: 'pc/mi/ln',
    direction: 'higher-is-worse',
    edges: [11, 18, 26, 35, 45],
    source: 'HCM Exhibit 12-15',
    note: 'Basic freeway segments. Passenger cars per mile per lane.'
  },
  density_weaving_v7: {
    label: 'Density',
    unit: 'pc/mi/ln',
    direction: 'higher-is-worse',
    edges: [10, 20, 28, 35, 43],
    source: 'HCM Exhibit 13-6',
    note: 'Weaving segments, 7th Edition.'
  },
  density_v7_1: {
    label: 'Density',
    unit: 'pc/mi/ln',
    direction: 'higher-is-worse',
    edges: [11, 18, 25, 30, 35],
    source: 'HCM Edition 7.1, Exhibits 13-7 and 14-2',
    note: 'Weaving, merge, and diverge segments under Edition 7.1. Tighter than the 7th Edition at every letter.'
  },
  density_ramp_v7: {
    label: 'Density',
    unit: 'pc/mi/ln',
    direction: 'higher-is-worse',
    edges: [10, 20, 28, 35, Infinity],
    source: 'HCM Exhibit 14-3',
    note: 'Ramp influence areas, 7th Edition. LOS F is assigned only when demand exceeds capacity, never by density alone.'
  },
  follower_density: {
    label: 'Follower density',
    unit: 'followers/mi/ln',
    direction: 'higher-is-worse',
    edges: [2, 4, 8, 12, 16],
    source: 'HCM Exhibit 15-6',
    note: 'Two-lane highways, higher-speed class.'
  },
  control_delay_signal: {
    label: 'Control delay',
    unit: 's/veh',
    direction: 'higher-is-worse',
    edges: [10, 20, 35, 55, 80],
    source: 'HCM Exhibit 19-8',
    note: 'Signalized intersections. A volume-to-capacity ratio above 1.0 forces LOS F whatever the delay.'
  },
  control_delay_unsignalized: {
    label: 'Control delay',
    unit: 's/veh',
    direction: 'higher-is-worse',
    edges: [10, 15, 25, 35, 50],
    source: 'HCM Exhibit 20-2',
    note: 'Two-way and all-way STOP control, and roundabouts.'
  },
  los_score: {
    label: 'LOS score',
    unit: '',
    direction: 'higher-is-worse',
    edges: [1.5, 2.5, 3.5, 4.5, 5.5],
    source: 'HCM Exhibits 15-8 and 19-9',
    note: 'Traveler-perception score for two-lane highway and signalized-intersection bicycle and pedestrian modes. A lower score is better.'
  },
  segment_los_score: {
    label: 'LOS score',
    unit: '',
    direction: 'higher-is-worse',
    edges: [2.0, 2.75, 3.5, 4.25, 5.0],
    source: 'HCM Exhibits 16-4, 16-5, 18-2, and 18-3',
    note: 'Urban street segment and facility scores. Note these bands differ from the intersection ones.'
  },
  blos_score_path: {
    label: 'BLOS score',
    unit: '',
    direction: 'higher-is-better',
    edges: [4.0, 3.5, 3.0, 2.5, 2.0],
    source: 'HCM Exhibit 24-5',
    note: 'Shared-use and exclusive paths. This scale runs the other way from the Chapter 15 and 19 scores: here a higher score is better.'
  },
  pedestrian_space: {
    label: 'Pedestrian space',
    unit: 'ft²/p',
    direction: 'higher-is-better',
    edges: [60, 40, 24, 15, 8],
    source: 'HCM Exhibit 16-4',
    note: 'More space is better, so the bands run downward.'
  }
};

/** The letter a value earns on a given measure, ignoring any capacity override. */
export function letterFor(measureKey, value) {
  const m = SERVICE_MEASURES[measureKey];
  if (!m || !Number.isFinite(value)) return null;
  const worseHigher = m.direction === 'higher-is-worse';
  for (let i = 0; i < m.edges.length; i++) {
    const edge = m.edges[i];
    if (worseHigher ? value <= edge : value > edge) return LOS_LETTERS[i];
  }
  return 'F';
}

/**
 * The bands of a measure, as renderable segments.
 *
 * Each carries its letter, its numeric range, and a human-readable range label. The last band is
 * open-ended, and `Infinity` edges (Exhibit 14-3's LOS E) collapse so the strip does not draw a
 * band that can never be reached by the measure alone.
 */
export function bandsFor(measureKey) {
  const m = SERVICE_MEASURES[measureKey];
  if (!m) return [];
  const worseHigher = m.direction === 'higher-is-worse';
  const bands = [];
  let lower = worseHigher ? 0 : Infinity;

  for (let i = 0; i < m.edges.length; i++) {
    const upper = m.edges[i];
    if (!Number.isFinite(upper)) {
      bands.push({ letter: LOS_LETTERS[i], from: lower, to: Infinity, rangeLabel: `> ${fmt(lower)}`, openEnded: true });
      return bands;
    }
    bands.push({
      letter: LOS_LETTERS[i],
      from: lower,
      to: upper,
      rangeLabel: rangeLabel(lower, upper, worseHigher, i === 0)
    });
    lower = upper;
  }
  bands.push({
    letter: 'F',
    from: lower,
    to: Infinity,
    rangeLabel: worseHigher ? `> ${fmt(lower)}` : `≤ ${fmt(lower)}`,
    openEnded: true
  });
  return bands;
}

function rangeLabel(lower, upper, worseHigher, first) {
  if (worseHigher) return first ? `≤ ${fmt(upper)}` : `${fmt(lower)}–${fmt(upper)}`;
  return first ? `> ${fmt(upper)}` : `${fmt(upper)}–${fmt(lower)}`;
}

function fmt(v) {
  if (!Number.isFinite(v)) return '∞';
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
}

/**
 * The calculator families. Each gets its own accent so a freeway page, a signal page, and a
 * bicycle page are recognisable at a glance without reading the title. The accent is chrome only:
 * it never touches the LOS colours, so a status colour cannot be mistaken for a family colour.
 */
export const FAMILIES = {
  freeway: { label: 'Freeway & highway', accent: '#256abf', icon: '🛣' },
  urban: { label: 'Urban street', accent: '#7a5bc7', icon: '🏙' },
  intersection: { label: 'Intersection', accent: '#b8542a', icon: '🚦' },
  activeTransport: { label: 'Pedestrian & bicycle', accent: '#0f8a72', icon: '🚲' }
};
