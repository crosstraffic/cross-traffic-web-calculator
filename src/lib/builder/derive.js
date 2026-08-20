// Builder document -> HCM Chapter 10 segment table.
//
// The branch logic that turns a ramp pair into merge/basic/diverge,
// merge/overlap/diverge, a weave or a single truncated overlap is NOT here. It
// is `segment_ramp_section` in the library (src/hcm/freeway_facilities/
// freeway_facilities.rs), bound through crosstraffic_middleware 0.3.12 and
// called once per ramp section. A second copy of Exhibits 10-11 and 10-12 in
// JS is how the two start to disagree, and the ch15 entries in VALIDATION.md
// are what that looks like after a year.
//
// What IS here is the assembly around it, and every rule below is quoted from
// the Chapter 10 Section 2 segmentation list ("The following general
// segmentation rules apply for the second step, dividing a facility into HCM
// segments") and checked against the library's own Example Problem 1 fixture,
// tests/ExampleCases/hcm/FreewayFacilities/case1.json, whose eleven segments
// this module reproduces exactly from six placed ramps.

/** Half of the weaving segment's overhang past the gores. Chapter 10 Section 2:
 * "the weave influence area extends 500 ft upstream and 500 ft downstream of
 * the two respective gore areas (see Exhibit 10-2)".
 *
 * This is the one number the derivation carries that the binding does not,
 * because the library's `segment_ramp_section` returns its auxiliary-lane
 * argument unchanged as the weaving segment's length. So the caller extends
 * the gore-to-gore distance by 2 x 500 ft before calling, and hands the
 * gore-to-gore distance itself back as `short_length_ft`. Example Problem 1
 * pins both halves: its weaving segment is 2,640 ft with a 1,640 ft short
 * length, and the difference is exactly these two extensions. */
export const WEAVE_EXTENSION_FT = 500;

/** Structural rows carry no numbers of their own, so they are cheap to name. */
const BASIC = 'Basic';

/**
 * @param {object} doc builder document
 * @param {{segment_ramp_section: Function, ramp_influence_area_ft: Function}} api
 *        the wasm surface, injected so this module is testable under plain node
 * @returns {{rows: object[], sections: object[], errors: string[]}}
 */
export function deriveRows(doc, api) {
  if (doc.facilityType === 'urban') return deriveUrbanRows(doc);
  if (doc.facilityType === 'twolane') return deriveTwoLaneRows(doc);
  if (doc.importedSegments) return importedRows(doc);

  const errors = [];
  const L = doc.mainline.lengthFt;
  const ria = api.ramp_influence_area_ft();
  const all = [...doc.features].sort((a, b) => a.stationFt - b.stationFt || a.id.localeCompare(b.id));
  // Ramps are what the segmentation rules act on. Lane changes and work zones
  // act on the segments those rules produce, in the property pass below.
  const feats = all.filter((f) => f.kind === 'on_ramp' || f.kind === 'off_ramp');
  const laneChanges = all.filter((f) => f.kind === 'lane_change');
  const workZones = all.filter((f) => f.kind === 'work_zone');

  // Pass 1: each feature or ramp pair claims a span of the mainline.
  const sections = [];
  let i = 0;
  while (i < feats.length) {
    const f = feats[i];
    const g = feats[i + 1];

    if (f.kind === 'on_ramp' && g && g.kind === 'off_ramp') {
      // "Ramp segments ... are classified either as merge (on-ramp) or as
      // diverge (off-ramp) segments, unless two adjacent merge and diverge
      // segments are connected by an auxiliary lane, in which case the
      // entire segment is coded as a weaving segment." Both cases, and the
      // three spacing bands underneath them, are the binding's job.
      const gore = g.stationFt - f.stationFt;
      const aux = !!f.auxLaneToNext;
      const span = aux ? gore + 2 * WEAVE_EXTENSION_FT : gore;
      let pieces;
      try {
        pieces = api.segment_ramp_section(span, aux);
      } catch (e) {
        errors.push(`ramp pair ${f.id}/${g.id}: ${e.message ?? e}`);
        i += 2;
        continue;
      }
      sections.push({
        key: `pair:${f.id}:${g.id}`,
        kind: aux ? 'weave-pair' : 'ramp-pair',
        startFt: aux ? f.stationFt - WEAVE_EXTENSION_FT : f.stationFt,
        pieces,
        on: f,
        off: g,
        goreToGoreFt: gore,
        why: whyPair(gore, aux, pieces),
      });
      i += 2;
      continue;
    }

    // An unpaired ramp is not a section in the manual's sense, it is one
    // influence area. "The influence area of a ramp is considered to be
    // 1,500 ft, measured downstream from the gore point for on-ramps and
    // upstream of the gore point for off-ramps."
    if (f.kind === 'on_ramp') {
      // "when this occurs, the 1,500-ft merge or diverge segment length is
      // truncated at the adjacent ramp gore point" — the same truncation
      // the manual gives for sub-1,500 ft spacing, applied at whichever
      // boundary comes first.
      const limit = Math.min(g ? g.stationFt : L, L);
      const len = Math.min(ria, limit - f.stationFt);
      if (len <= 0) {
        errors.push(`on-ramp ${f.id} has no room downstream of its gore for a merge segment`);
      } else {
        sections.push({
          key: `ramp:${f.id}`,
          kind: 'merge',
          startFt: f.stationFt,
          pieces: [{ seg_type: 'Merge', length_ft: len }],
          on: f,
          off: null,
          why: whyIsolated('Merge', f, len, ria),
        });
      }
    } else {
      const prevEnd = sections.length ? sectionEnd(sections[sections.length - 1]) : 0;
      const len = Math.min(ria, f.stationFt - prevEnd);
      if (len <= 0) {
        errors.push(`off-ramp ${f.id} has no room upstream of its gore for a diverge segment`);
      } else {
        sections.push({
          key: `ramp:${f.id}`,
          kind: 'diverge',
          startFt: f.stationFt - len,
          pieces: [{ seg_type: 'Diverge', length_ft: len }],
          on: null,
          off: f,
          why: whyIsolated('Diverge', f, len, ria),
        });
      }
    }
    i += 1;
  }

  // Pass 2: "Any remaining unassigned segments after all merge, diverge,
  // weave, and overlap segments have been defined are labeled as basic
  // segments." Including the two termini, which is also how "the first and
  // last segments of the defined facility are recommended to be basic freeway
  // segments" is satisfied without a special case.
  // Every station where the cross section changes is a segment boundary:
  // "A new segment should be started whenever capacity changes (i.e., when a
  // full or auxiliary lane is added, when one or more lanes are added or
  // dropped, when the terrain changes significantly, or where lane widths or
  // lateral clearances change in a way that affects capacity)." A lane change
  // is one such station; a work zone is two, its upstream and downstream ends.
  const breakpoints = [...laneChanges.map((f) => f.stationFt), ...workZones.flatMap((f) => [f.stationFt, f.endFt])]
    .filter((x) => x > 0.5 && x < L - 0.5)
    .sort((a, b) => a - b);

  const rows = [];
  let cursor = 0;
  const pushBasic = (from, to, afterKey) => {
    const len = to - from;
    if (len <= 0.5) return; // sub-foot slivers are rounding, not segments
    // One unassigned stretch can span several cross sections, so it is cut
    // at every breakpoint inside it before it becomes a row.
    const cuts = [from, ...breakpoints.filter((b) => b > from + 0.5 && b < to - 0.5), to];
    for (let i = 0; i < cuts.length - 1; i++) {
      rows.push(
        row(doc, {
          key: `gap:${afterKey}${i ? `+${i}` : ''}`,
          seg_type: BASIC,
          length_ft: cuts[i + 1] - cuts[i],
          startFt: cuts[i],
          section: null,
          why: `Unassigned stretch between the ramp segments around it, so it is a basic freeway segment (Chapter 10 Section 2, last segmentation rule).${cuts.length > 2 ? ' It is cut here because the cross section changes at this station.' : ''}`,
        }),
      );
    }
  };

  for (const s of sections) {
    const secEnd = sectionEnd(s);
    const inside = breakpoints.filter((b) => b > s.startFt + 0.5 && b < secEnd - 0.5);
    if (inside.length) {
      errors.push(
        `the cross section changes at ${inside.map((b) => `${Math.round(b)} ft`).join(', ')}, inside the ramp section between ${s.on?.id ?? '?'} and ${s.off?.id ?? '?'}. A ramp influence area cannot be split, so the change is applied to the whole section instead of starting a segment there.`,
      );
    }
    if (s.startFt < cursor - 0.5) {
      errors.push(
        `the influence area of ${s.on?.id ?? s.off?.id} starts upstream of the segment before it, so the ramps are too close to segment independently`,
      );
    }
    pushBasic(cursor, s.startFt, rows.length ? rows[rows.length - 1].key : 'start');
    let x = s.startFt;
    s.pieces.forEach((p, pi) => {
      rows.push(
        row(doc, {
          key: `${s.key}#${pi}`,
          seg_type: p.seg_type,
          length_ft: p.length_ft,
          startFt: x,
          section: s,
          why: s.why,
        }),
      );
      x += p.length_ft;
    });
    cursor = Math.max(cursor, x);
  }
  pushBasic(cursor, L, rows.length ? rows[rows.length - 1].key : 'start');

  if (rows.length === 0) {
    rows.push(
      row(doc, {
        key: 'gap:start',
        seg_type: BASIC,
        length_ft: L,
        startFt: 0,
        section: null,
        why: 'No features placed, so the whole facility is one basic freeway segment.',
      }),
    );
  }

  applyCrossSection(doc, rows, laneChanges, workZones, errors);
  return { rows: applyOverrides(doc, rows), sections, errors };
}

/**
 * Apply the properties that belong to a stretch of mainline rather than to a
 * ramp: the lane count in force, and any work zone covering the row.
 *
 * This runs after the segmentation rather than inside it because that is the
 * order the manual gives. Step A-2 divides the facility by where the demand and
 * capacity change; what the cross section then *is* at each of those segments
 * is Step A-3 onward. Keeping it separate is also what lets a work zone sit on
 * a merge segment without the segmentation having to know about work zones.
 */
function applyCrossSection(doc, rows, laneChanges, workZones, errors) {
  const steps = [...laneChanges].sort((a, b) => a.stationFt - b.stationFt);
  const lanesAt = (ft) => {
    let n = doc.mainline.lanes;
    for (const s of steps) {
      if (s.stationFt <= ft + 0.5) n = s.lanes;
      else break;
    }
    return n;
  };

  for (const r of rows) {
    const base = lanesAt(r.startFt);
    // The auxiliary lane that makes a section a weave is a lane added to
    // whatever cross section is in force there.
    r.lanes = r.seg_type === 'Weaving' ? base + 1 : base;
    if (base !== doc.mainline.lanes) {
      r.why += ` The mainline carries ${base} lanes here.`;
    }
  }

  for (const wz of workZones) {
    const covered = rows.filter((r) => r.startFt >= wz.stationFt - 0.5 && r.startFt + r.length_ft <= wz.endFt + 0.5);
    if (covered.length === 0) {
      errors.push(
        `work zone ${wz.id} covers no whole segment, so it would not reach the analysis. Move its ends to segment boundaries, or place a ramp so a boundary falls inside it.`,
      );
      continue;
    }
    for (const r of covered) {
      r.work_zone = { ...wz.config };
      // The engine takes a work-zone segment's lane count as the lanes that
      // stay OPEN and folds the closure into CAF_wz and SAF_wz through the
      // lane closure severity index (Equations 10-7, 10-11, 10-12). Example
      // Problem 4 codes its three-to-two closure as a two-lane segment for
      // exactly this reason, so the drawn cross section and the run agree.
      r.lanes = Math.max(1, Math.round(wz.config.open_lanes));
      r.workZoneId = wz.id;
      r.sourceIds = [...r.sourceIds, wz.id];
      r.why += ` A work zone closes ${Math.round(wz.config.total_lanes) - Math.round(wz.config.open_lanes)} of ${Math.round(wz.config.total_lanes)} lanes over this segment, so it is coded with the ${Math.round(wz.config.open_lanes)} lanes that stay open (Chapter 10 Section 4).`;
    }
  }
}

function sectionEnd(s) {
  return s.startFt + s.pieces.reduce((a, p) => a + p.length_ft, 0);
}

/**
 * Build one derived row, attaching the demands and geometry the features on it
 * carry. Which feature contributes what follows the manual's own statement that
 * "a new segment should be started whenever demand volume changes (i.e., at on-
 * and off-ramps)", so on-ramp demand lands on the merge (or weave) that begins
 * at its gore and off-ramp demand on the diverge (or weave) that ends at it.
 */
function row(doc, { key, seg_type, length_ft, startFt, section, why }) {
  const periods = doc.periods;
  const zeros = () => new Array(periods).fill(0);
  const r = {
    key,
    seg_type,
    length_ft,
    startFt,
    // "A new segment should be started whenever capacity changes (i.e., when
    // a full or auxiliary lane is added ...)": the auxiliary lane that makes
    // the section a weave is that added lane, so the weaving segment carries
    // one lane more than the mainline. Example Problem 1's weave is 4 lanes
    // against a 3-lane mainline.
    lanes: seg_type === 'Weaving' ? doc.mainline.lanes + 1 : doc.mainline.lanes,
    on_ramp_demand: zeros(),
    off_ramp_demand: zeros(),
    ramp_to_ramp_demand: zeros(),
    sourceIds: [],
    why,
    overridden: false,
    staleOverride: false,
  };

  const on = section?.on;
  const off = section?.off;
  if (seg_type === 'Merge' && on) {
    r.on_ramp_demand = [...on.demand];
    r.ramp_ffs = on.rampFfs;
    r.accel_lane_ft = on.accelLaneFt;
    r.sourceIds = [on.id];
  } else if (seg_type === 'Diverge' && off) {
    r.off_ramp_demand = [...off.demand];
    r.ramp_ffs = off.rampFfs;
    r.decel_lane_ft = off.decelLaneFt;
    r.sourceIds = [off.id];
  } else if (seg_type === 'Weaving' && on && off) {
    r.on_ramp_demand = [...on.demand];
    r.off_ramp_demand = [...off.demand];
    r.ramp_to_ramp_demand = [...on.rampToRampDemand];
    r.ramp_ffs = on.rampFfs;
    r.short_length_ft = section.goreToGoreFt;
    r.num_weaving_lanes = on.numWeavingLanes;
    r.lc_rf = on.lcRf;
    r.lc_fr = on.lcFr;
    r.sourceIds = [on.id, off.id];
  } else if (section) {
    // The overlapping-ramp and in-section basic rows are produced by the
    // pair but carry neither ramp's demand: the demand changes at the gores,
    // which are the merge's and the diverge's boundaries.
    r.sourceIds = [on?.id, off?.id].filter(Boolean);
  }
  return r;
}

/** An override pins one row and survives re-derivation until it is cleared,
 * because an analyst will know something the rules do not. It is keyed by the
 * row's provenance rather than its index, so moving a ramp does not shift an
 * override onto its neighbour. When the row it pins changes type underneath it
 * — dragging a pair across 3,000 ft turns an overlapping ramp into a basic
 * segment — the override is kept and marked stale rather than dropped, since
 * dropping it silently is the failure this design exists to avoid. */
function applyOverrides(doc, rows) {
  const ov = doc.overrides ?? {};
  return rows.map((r) => {
    const o = ov[r.key];
    if (!o) return r;
    const out = { ...r, ...o.fields, overridden: true };
    out.key = r.key;
    out.startFt = r.startFt;
    out.why = r.why;
    out.sourceIds = r.sourceIds;
    out.staleOverride = !!o.appliedTo && o.appliedTo !== r.seg_type;
    out.derivedSegType = r.seg_type;
    out.derivedLengthFt = r.length_ft;
    syncOverrideTwins(doc, out, o.fields ?? {});
    return out;
  });
}

/**
 * Carry an override on a chassis field through to the chapter-schema field that
 * holds the same quantity.
 *
 * A row is two things at once: the chassis' own view, which the table, the strip
 * and the summary read, and the chapter's serde schema, which the ENGINE reads.
 * For the freeway the two share their names, so an override reaches both. For
 * the other two they do not, and an override that moved only the chassis half
 * would change every number on the page except the one the engine computed.
 *
 * Chapter 18's segment length is feet like the chassis'; Chapter 15's is miles,
 * so pinning a two-lane length to 3,000 ft without this would analyze whatever
 * the derivation last said and report 3,000. Both are silent.
 */
function syncOverrideTwins(doc, out, fields) {
  if ('length_ft' in fields) {
    if (doc.facilityType === 'urban') {
      out.segment_length_ft = out.length_ft;
      // Signal spacing and segment length are the same distance on a derived
      // urban row by construction, so a pinned length moves both or Equation
      // 18-4's f_L reads a spacing the segment does not have.
      out.signal_spacing_ft = out.length_ft;
    }
    if (doc.facilityType === 'twolane') out.length = out.length_ft / 5280;
  }
  if ('lanes' in fields && doc.facilityType === 'urban') out.n_through_lanes = out.lanes;
  if ('seg_type' in fields) {
    if (doc.facilityType === 'urban') out.control = out.seg_type;
    if (doc.facilityType === 'twolane') {
      const pt = PASSING_TYPE_NAMES.indexOf(out.seg_type);
      if (pt >= 0) {
        out.passing_type = pt;
        // The drawn cross section follows the pinned type unless the lane
        // count was pinned too, in which case the analyst said both.
        if (!('lanes' in fields)) out.lanes = pt === 2 ? 2 : 1;
      }
    }
  }
}

/** A fixture arrives as a segment list with no feature layer, so there is
 * nothing to derive. The rows are the fixture's own segments, keyed by index,
 * and the segment table is the only editor for them. */
function importedRows(doc) {
  const rows = doc.importedSegments.map((s, i) => ({
    key: `fixture:${i}`,
    seg_type: s.seg_type,
    length_ft: s.length_ft,
    startFt: doc.importedSegments.slice(0, i).reduce((a, p) => a + p.length_ft, 0),
    lanes: s.lanes,
    on_ramp_demand: s.on_ramp_demand ?? [],
    off_ramp_demand: s.off_ramp_demand ?? [],
    ramp_to_ramp_demand: s.ramp_to_ramp_demand ?? [],
    ramp_ffs: s.ramp_ffs,
    accel_lane_ft: s.accel_lane_ft,
    decel_lane_ft: s.decel_lane_ft,
    short_length_ft: s.short_length_ft,
    num_weaving_lanes: s.num_weaving_lanes,
    lc_rf: s.lc_rf,
    lc_fr: s.lc_fr,
    work_zone: s.work_zone,
    sourceIds: [],
    why: 'Imported from a fixture, which stores segments and not the ramps that produced them. There is no feature layer to explain this row, so it is editable only as an override.',
    overridden: false,
    staleOverride: false,
  }));
  return { rows: applyOverrides(doc, rows), sections: [], errors: [] };
}

// ── Urban street (HCM Chapters 16/18) ────────────────────────────────────
//
// The urban derivation is structural rather than engine-backed, which the design
// settled and Chapter 18 justifies: a segment is not the output of a branch
// table the way a freeway ramp section is, it is the stretch between two
// boundary intersections. Chapter 18 Section 2, "Urban Street Segment": the
// segment "extends from one boundary intersection to the next", and its through
// control delay, cycle length and effective green all belong to the boundary
// intersection at its DOWNSTREAM end. So the signals partition the street and
// each segment reads its timing off the signal it runs into.
//
// That organization is not an invention of this module. The Chapter 29 Example
// Problem 4 reliability fixture is built the same way, one `boundary_signals`
// entry per segment, indexed by the segment the signal terminates.
//
// Nothing numerical happens here. Every value below is either copied from a
// feature or is a distance between two stations; the free-flow speed chain, the
// access-point delay and the aggregation are all the engines' work.

/** How close two stations have to be to count as the same boundary. Stations are
 * whole feet and the strip snaps to 528, so this only ever collapses a signal an
 * analyst dropped exactly onto a terminus. */
const BOUNDARY_TOL_FT = 0.5;

/** The keys of the library's `UrbanSegment` serde schema that a derived row
 * carries into `add_segment_from_config`. The list is explicit because that
 * method ignores unknown fields silently, so a misspelling would fall back to a
 * serde default and analyze to a plausible wrong number rather than throw. Row
 * bookkeeping (`key`, `startFt`, `why`) is therefore never handed to it. */
export const URBAN_SEGMENT_KEYS = [
  'segment_length_ft',
  'n_through_lanes',
  'speed_limit_mph',
  'through_demand_veh_h',
  'control',
  'upstream_intersection_width_ft',
  'restrictive_median_length_ft',
  'proportion_with_curb',
  'proportion_on_street_parking',
  'n_access_points_subject',
  'n_access_points_opposing',
  'signal_spacing_ft',
  'midsegment_flow_veh_h',
  'through_capacity_veh_h',
  'through_control_delay_s',
  'cycle_length_s',
  'effective_green_s',
  'platoon_ratio',
  'sat_flow_veh_h_ln',
  'arrival_type',
  'full_stop_rate_override',
  'prop_left_turn_lanes',
  'access_point_delays_s',
  'access_point_approaches',
  // The Exhibit 18-13 planning estimate's parameters. They sit beside the two
  // preferred sources rather than under them because the library reads them
  // only on the fall-through, and a segment cannot be on two sources at once.
  'n_influential_access_points',
  'pct_left_turns_access',
  'pct_right_turns_access',
  'access_left_bay_adequate',
  'access_right_bay_adequate',
  'analysis_period_h',
];

/** The `UrbanSegment` keys a boundary signal carries OPTIONALLY: the library has
 * a default for each, and a blank field on the editor means that default rather
 * than a number this builder chose.
 *
 * The list exists because these nine are the keys where "absent" and "null" mean
 * different things. A signal that never carried the key has not been touched; a
 * signal carrying null had the key and the analyst cleared it. Both analyze
 * identically, because `segmentConfig` drops either, and they export
 * differently: see the round-trip contract on `mergeSegment` in fixture.js.
 * `fromUrbanFixture` sets one only when the fixture states it, and `urbanRow`
 * passes whichever it finds through unchanged. */
export const URBAN_OPTIONAL_SIGNAL_KEYS = [
  'platoon_ratio',
  'sat_flow_veh_h_ln',
  'arrival_type',
  'full_stop_rate_override',
  'n_influential_access_points',
  'pct_left_turns_access',
  'pct_right_turns_access',
  'access_left_bay_adequate',
  'access_right_bay_adequate',
];

/** The published Chapter 18 measures that make a segment a summary segment. Any
 * of these present and `add_segment_from_config` stops treating the segment as
 * inputs to recompute, exactly as `add_segment_summary` would. */
export const URBAN_MEASURE_KEYS = ['base_ffs_mph', 'travel_speed_mph', 'spatial_stop_rate_stops_mi', 'vc_ratio', 'los'];

/**
 * Boundary signals -> the Chapter 18 segment table.
 *
 * @param {object} doc urban builder document
 * @returns {{rows: object[], sections: object[], errors: string[]}}
 */
export function deriveUrbanRows(doc) {
  const errors = [];
  const L = doc.mainline.lengthFt;
  const measures = doc.analysisMode === 'measures';

  const signals = [...doc.features]
    .filter((f) => f.kind === 'signal')
    .sort((a, b) => a.stationFt - b.stationFt || a.id.localeCompare(b.id));
  const accessPoints = [...doc.features]
    .filter((f) => f.kind === 'access_point')
    .sort((a, b) => a.stationFt - b.stationFt || a.id.localeCompare(b.id));

  // The two termini are boundary intersections whether or not a signal sits on
  // them, because the facility has to end somewhere. A signal placed on a
  // terminus supplies that boundary's timing rather than adding a boundary.
  const stations = [0, ...signals.map((s) => clamp(s.stationFt, 0, L)), L].sort((a, b) => a - b);
  const boundaries = [];
  for (const st of stations) {
    if (!boundaries.length || st - boundaries[boundaries.length - 1] > BOUNDARY_TOL_FT) boundaries.push(st);
  }
  const signalAt = (ft) => signals.find((s) => Math.abs(clamp(s.stationFt, 0, L) - ft) <= BOUNDARY_TOL_FT) ?? null;

  // Two signals inside half a foot of each other collapse to one boundary, so
  // the segment between them never existed. Saying so is the point: silently
  // dropping one is how a facility loses an intersection.
  for (let i = 1; i < signals.length; i++) {
    const gap = signals[i].stationFt - signals[i - 1].stationFt;
    if (gap <= BOUNDARY_TOL_FT) {
      errors.push(
        `signals ${signals[i - 1].id} and ${signals[i].id} sit at the same station, so there is no segment between them. Move one, or remove it.`,
      );
    }
  }

  const rows = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startFt = boundaries[i];
    const endFt = boundaries[i + 1];
    const upstream = signalAt(startFt);
    const downstream = signalAt(endFt);

    if (!downstream) {
      errors.push(
        `the segment from ${ft(startFt)} to ${ft(endFt)} ends at a terminus with no signal on it, so Chapter 18 has no boundary intersection to take its through control delay, cycle length and effective green from. Place a signal at ${ft(endFt)}.`,
      );
    }

    // An access point exactly on a boundary belongs to the segment upstream of
    // it, because that boundary is that segment's downstream end. Only the
    // first segment claims one sitting on station 0, which has no segment
    // upstream of it to belong to.
    //
    // The two bounds are deliberately complementary rather than both
    // tolerant: a point is in exactly one segment. Half-open at each end with
    // a tolerance on both would put a point just past a boundary in the
    // segment before it and the segment after it, and the engine would then
    // count one driveway twice.
    const inside = accessPoints.filter(
      (a) => (i === 0 ? a.stationFt >= startFt : a.stationFt > startFt) && a.stationFt <= endFt,
    );
    const subject = inside.filter((a) => a.side !== 'opposing');
    const opposing = inside.filter((a) => a.side === 'opposing');

    rows.push(
      urbanRow(doc, {
        key: `seg:${upstream?.id ?? 'start'}:${downstream?.id ?? 'end'}`,
        startFt,
        endFt,
        upstream,
        downstream,
        subject,
        opposing,
        measures,
        index: i,
      }),
    );
  }

  if (rows.length === 0) {
    errors.push(
      'The street has no segments. A Chapter 18 segment runs between two boundary intersections, so place at least one signal.',
    );
  }

  return { rows: applyOverrides(doc, rows), sections: [], errors };
}

/**
 * Which of the three Equation 18-7 sources the segment ENDING at one signal is
 * on, for an editor that holds the document but not the derivation.
 *
 * It re-derives rather than re-implementing the containment rule. Which access
 * points belong to which segment is the one genuinely subtle rule in this
 * module — half-open at one end, tolerant at the other, so a point is counted
 * once — and a second copy of it in a Svelte component is how the panel would
 * start telling a user their planning parameters are inert when they are not.
 *
 * Returns null when no segment ends at the signal, which is the upstream-most
 * one and the case the editor already has a note for.
 */
export function urbanSourceEndingAt(doc, signalId) {
  if (!doc || doc.facilityType !== 'urban' || !signalId) return null;
  const { rows } = deriveUrbanRows(doc);
  // Keys are `seg:<upstream>:<downstream>`, so the suffix is unambiguous even
  // though `sig1` is a prefix of `sig11`.
  return rows.find((r) => r.key.endsWith(`:${signalId}`))?.apDelaySource ?? null;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** One derived urban segment, in the library's own `UrbanSegment` field names so
 * that the row IS the config `add_segment_from_config` takes, less the
 * bookkeeping keys. */
function urbanRow(doc, { key, startFt, endFt, upstream, downstream, subject, opposing, measures, index }) {
  const m = doc.mainline;
  const cfg = downstream?.config ?? {};
  const lengthFt = endFt - startFt;

  const r = {
    key,
    startFt,
    // The freeway chassis keys overrides, staleness and the strip off
    // `seg_type`. For an urban row the type that can change underneath an
    // override is the boundary's control, so that is what fills it.
    seg_type: cfg.control ?? 'Signalized',
    length_ft: lengthFt,
    lanes: m.lanes,

    segment_length_ft: lengthFt,
    n_through_lanes: m.lanes,
    speed_limit_mph: cfg.speed_limit_mph ?? m.speedLimitMph,
    through_demand_veh_h: cfg.through_demand_veh_h,
    control: cfg.control ?? 'Signalized',
    // The width of the intersection at the segment's UPSTREAM end, which is
    // the one Equation 18-3's running-time chain charges to this segment.
    upstream_intersection_width_ft: upstream?.config?.width_ft ?? 0,
    restrictive_median_length_ft: m.restrictiveMedianLengthFt,
    proportion_with_curb: m.proportionWithCurb,
    proportion_on_street_parking: m.proportionOnStreetParking,
    n_access_points_subject: subject.length,
    n_access_points_opposing: opposing.length,
    // Signal spacing and segment length are the same distance here by
    // construction: both boundaries are signals, so the spacing between them
    // is the length between them. Equation 18-4's f_L reads it.
    signal_spacing_ft: lengthFt,
    midsegment_flow_veh_h: cfg.midsegment_flow_veh_h,
    through_capacity_veh_h: cfg.through_capacity_veh_h,
    through_control_delay_s: cfg.through_control_delay_s,
    cycle_length_s: cfg.cycle_length_s,
    effective_green_s: cfg.effective_green_s,
    prop_left_turn_lanes: m.propLeftTurnLanes,

    sourceIds: [upstream?.id, downstream?.id, ...subject.map((a) => a.id), ...opposing.map((a) => a.id)].filter(
      Boolean,
    ),
    overridden: false,
    staleOverride: false,
  };

  // The nine optional keys, passed through exactly as the signal holds them so
  // that a key the signal never carried stays undefined and a key the analyst
  // cleared stays null. Collapsing the two with `?? undefined` was the export
  // defect: a cleared field analyzed as cleared and exported as the value the
  // fixture was imported with, so the document and its export disagreed.
  //
  // The five planning parameters are carried whatever source the segment ends up
  // on. The library reads them only on the Exhibit 18-13 fall-through, so on a
  // segment with per-point delays they are inert, and dropping them here instead
  // would lose an analyst's numbers out of the document the moment a delay was
  // supplied and not give them back when it was cleared.
  for (const k of URBAN_OPTIONAL_SIGNAL_KEYS) if (k in cfg) r[k] = cfg[k];

  // The Equation 18-7 access-point delay term, from whichever of the three
  // sources the access points on this segment actually carry. The library picks
  // among them in this order, so the derivation offers them in it: supplying
  // both a published delay and an approach would otherwise silently favour one.
  const published = subject.filter((a) => Number.isFinite(a.delayS));
  const approaches = subject.filter((a) => a.approach);
  if (published.length) {
    r.access_point_delays_s = published.map((a) => a.delayS);
    r.apDelaySource = 'published';
  } else if (approaches.length) {
    r.access_point_approaches = approaches.map((a) => ({ ...a.approach }));
    r.analysis_period_h = doc.mainline.analysisPeriodH;
    r.apDelaySource = 'computed';
  } else {
    r.apDelaySource = 'planning';
  }

  if (measures) {
    const pub = downstream?.measures ?? {};
    // Presence rather than nullness, for the same reason the optional inputs
    // above use it: a measure the signal never carried is untouched and a
    // measure cleared to null is cleared, and the export tells them apart.
    for (const k of URBAN_MEASURE_KEYS) if (k in pub) r[k] = pub[k];
  }

  r.why = whyUrban({
    index,
    startFt,
    endFt,
    upstream,
    downstream,
    subject,
    opposing,
    measures,
    source: r.apDelaySource,
  });
  return r;
}

function whyUrban({ index, startFt, endFt, upstream, downstream, subject, opposing, measures, source }) {
  const ends = downstream
    ? `the signal ${downstream.label || downstream.id} at ${ft(endFt)}`
    : `the downstream terminus at ${ft(endFt)}, which carries no signal`;
  const begins = upstream
    ? `the signal ${upstream.label || upstream.id} at ${ft(startFt)}`
    : `the upstream terminus at ${ft(startFt)}`;
  const parts = [
    `Segment ${index + 1} runs ${ft(endFt - startFt)} from ${begins} to ${ends}. A Chapter 18 segment extends from one boundary intersection to the next, and its through control delay, cycle length and effective green belong to the intersection at its downstream end, so this segment reads its timing off ${downstream ? downstream.label || downstream.id : 'nothing'} (Chapter 18, Section 2).`,
  ];
  if (subject.length || opposing.length) {
    parts.push(
      `${subject.length} access point${subject.length === 1 ? '' : 's'} on the subject side and ${opposing.length} on the opposing side sit inside it, which is the count Exhibit 18-11 note c reads for the f_A adjustment.`,
    );
  }
  if (measures) {
    parts.push(
      'This run is in published-measures mode, so the segment carries its Chapter 18 outputs as given and only the Chapter 16 aggregation runs over them (Exhibit 16-7, "HCM method output").',
    );
  } else if (source === 'published') {
    parts.push(
      'Its access-point delay is the per-point values supplied on the access points themselves, which is the first of the three sources Equation 18-7 accepts.',
    );
  } else if (source === 'computed') {
    parts.push(
      'Its access-point delay is computed from the access point approach volumes and geometry by the Chapter 30 Section 4 procedure (Equations 30-31 through 30-68).',
    );
  } else {
    parts.push(
      'No access point here carries a delay or an approach, so the segment falls to the Exhibit 18-13 planning estimate for its access-point delay.',
    );
  }
  return parts.join(' ');
}

// ── Two-lane highway (HCM Chapter 15) ────────────────────────────────────
//
// Like the urban derivation and unlike the freeway one, this is structural: the
// features partition the highway and nothing here computes a speed, a flow or a
// class. Every rule below is quoted from Chapter 15 rather than invented.
//
// Chapter 15 Section 2, "Segmentation": "A two-lane highway is divided into
// segments for analysis purposes. The ability to pass, lane geometry, grades,
// lane and shoulder widths, posted speed limits, traffic demands, adjacent land
// uses, driveways, and other characteristics of the facility should be
// homogeneous within each analysis segment. Note that segmentation will be
// different for each direction of the highway because passing zones and other
// characteristics will start and end in different locations depending on the
// direction of travel."
//
// Section 3 Step 1: "Classify the study segment, or each segment being analyzed
// as part of a facility, as a Passing Constrained, Passing Zone, or Passing Lane
// segment. Each segment should have homogeneous properties with respect to
// traffic demand, grade, lane and shoulder widths, posted speed limit, etc.
// Varying horizontal curvature can be included within a single segment, as
// described in Step 5d."
//
// That last sentence is why a curve is the one two-lane feature that does NOT
// start a segment. It becomes a subsegment of whichever segment contains it,
// and Step 5d adds that "the segment length minima given in Step 1 do not apply
// to the subsegments used in this adjustment."
//
// UNITS. This module works in feet throughout, like the document and like the
// strip. A derived row therefore carries `length_ft` for the chassis AND
// `length` in MILES for the Chapter 15 serde schema, and its subsegment lengths
// stay in feet because that is what `SubSegment.length` is. The one division by
// 5,280 that an engine input passes through is in `twoLaneRow` below, and it is
// here rather than at the fixture boundary because the row IS the fixture
// segment, the same arrangement `urbanRow` uses. Prose elsewhere divides to say
// a distance in miles; nothing else divides to produce an input.

import { PASSING_TYPE_NAMES, defaultDemandChange } from './document.js';

/** Two stations closer than this are the same boundary. Stations are whole feet
 * and the strip snaps to 528, so this only collapses features an analyst dropped
 * on exactly the same point. */
const TL_TOL_FT = 0.5;

/** The minimum length of a passing lane, from Exhibit 15-10. It is 0.5 mi for
 * every one of the five vertical classes, which is why this is a constant here
 * rather than a copy of that table: the whole Passing Lane column reads 0.5.
 *
 * Chapter 15 Section 3, Step 1: "Passing lanes shorter than the minima given in
 * Exhibit 15-10 should be ignored and treated as Passing Constrained segments
 * instead." That is a change of segment TYPE rather than of any number, so the
 * derivation applies it and says so in the row's reason. The rest of Exhibit
 * 15-10, which asks for a short segment's length to be substituted in Steps 2
 * through 9, is a change to an engine input and is reported by the analysis off
 * the engine's own `identify_vertical_class` instead of being reimplemented
 * here. */
export const PASSING_LANE_MIN_FT = 0.5 * 5280;

/** The keys of the library's Chapter 15 segment schema that a derived row
 * carries. Explicit, for the same reason `URBAN_SEGMENT_KEYS` is: the two-lane
 * constructors are positional and long, and a key that fell through by accident
 * would become a plausible wrong answer rather than a throw. */
export const TWOLANE_SEGMENT_KEYS = [
  'passing_type',
  'length',
  'grade',
  'spl',
  'is_hc',
  'volume',
  'volume_op',
  'flow_rate',
  'flow_rate_o',
  'capacity',
  'ffs',
  'avg_speed',
  'vertical_class',
  'phf',
  'phv',
  'pf',
  'fd',
  'fd_mid',
  'hor_class',
  'subsegments',
];

const covers = (f, a, b) => f.stationFt <= a + TL_TOL_FT && f.endFt >= b - TL_TOL_FT;
const overlaps = (f, a, b) => f.stationFt < b - TL_TOL_FT && f.endFt > a + TL_TOL_FT;

/**
 * Features -> the Chapter 15 segment table.
 *
 * @param {object} doc two-lane builder document
 * @returns {{rows: object[], sections: object[], errors: string[]}}
 */
export function deriveTwoLaneRows(doc) {
  const errors = [];
  // Rounded, because the last segment's length in MILES is this number minus a
  // station divided by 5,280, and 5.1 x 5280 is 26928.000000000004 in binary
  // floating point. Unrounded it makes a published 0.5-mi segment arrive at the
  // engine as 0.49999999999999933, which analyzes and prints.
  const L = Math.round(doc.mainline.lengthFt);
  const all = [...doc.features].sort((a, b) => a.stationFt - b.stationFt || a.id.localeCompare(b.id));
  const grades = all.filter((f) => f.kind === 'grade');
  const passings = all.filter((f) => f.kind === 'passing');
  const curves = all.filter((f) => f.kind === 'curve');
  const demands = all.filter((f) => f.kind === 'demand');

  for (const f of [...grades, ...passings, ...curves]) {
    if (f.endFt <= f.stationFt + TL_TOL_FT) {
      errors.push(`${f.label || f.id} ends at or before it starts, so it covers no highway.`);
    }
  }
  // Two passing features over the same stretch is not a segmentation the
  // chapter describes: a stretch is one of three types, not two. Said rather
  // than silently resolved, because the resolution below picks the wider
  // classification and an analyst who meant the other one would never see it.
  for (let i = 1; i < passings.length; i++) {
    if (passings[i].stationFt < passings[i - 1].endFt - TL_TOL_FT) {
      errors.push(
        `${passings[i - 1].label || passings[i - 1].id} and ${passings[i].label || passings[i].id} overlap. A stretch of highway is Passing Constrained, a Passing Zone or a Passing Lane, and cannot be two of them, so the overlap is classified as the more permissive of the two.`,
      );
    }
  }
  for (let i = 1; i < grades.length; i++) {
    if (grades[i].stationFt < grades[i - 1].endFt - TL_TOL_FT) {
      errors.push(
        `${grades[i - 1].label || grades[i - 1].id} and ${grades[i].label || grades[i].id} overlap, so the grade over the overlap is ambiguous. Grade has to be homogeneous within a segment (Chapter 15, Section 2).`,
      );
    }
  }
  // Curves overlap differently from the other two, and worse. A subsegment has
  // one horizontal class, so two curves over one stretch of road is not a
  // geometry Exhibit 15-22 describes, and the tiling below resolves it by
  // giving the overlap to whichever curve reached it first. That silently
  // discards part of the second curve, and a curve entirely inside another
  // disappears completely, so it is blocked rather than resolved quietly.
  for (let i = 1; i < curves.length; i++) {
    if (curves[i].stationFt < curves[i - 1].endFt - TL_TOL_FT) {
      errors.push(
        `${curves[i - 1].label || curves[i - 1].id} and ${curves[i].label || curves[i].id} overlap. A Step 5d subsegment carries one horizontal class, so a stretch of road cannot be on two curves at once, and the overlap would be given to the upstream curve alone.`,
      );
    }
  }

  // Every station where one of the homogeneity properties changes, with what
  // changed there kept so the row key names its provenance rather than its
  // index. A curve is deliberately absent: Step 1 sends varying curvature to
  // Step 5d inside one segment.
  const marks = new Map();
  const mark = (ft, id) => {
    const at = clamp(Math.round(ft), 0, L);
    if (!marks.has(at)) marks.set(at, new Set());
    marks.get(at).add(id);
  };
  mark(0, 'start');
  mark(L, 'end');
  for (const f of [...grades, ...passings]) {
    mark(f.stationFt, f.id);
    mark(f.endFt, f.id);
  }
  for (const f of demands) mark(f.stationFt, f.id);

  // Every key is a whole foot, because `mark` rounds, so two stations are either
  // the same key or at least a foot apart and the map has already collapsed the
  // duplicates. The sort is what orders them; there is no second pass because
  // there is nothing left to merge.
  const bounds = [...marks.keys()].sort((a, b) => a - b);
  const srcOf = (st) => [...(marks.get(st) ?? ['?'])].sort().join('+');

  const rows = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    rows.push(
      twoLaneRow(doc, {
        key: `tl:${srcOf(bounds[i])}:${srcOf(bounds[i + 1])}`,
        startFt: bounds[i],
        endFt: bounds[i + 1],
        index: i,
        passings,
        grades,
        curves,
        demands,
        errors,
      }),
    );
  }

  if (rows.length === 0) {
    errors.push('The highway has no length, so it has no segments.');
  }

  // Two engine behaviours the builder can produce and the engine cannot survive
  // or cannot get right. Both are raised here rather than in validate.js because
  // both are properties of the derived segment sequence rather than of a
  // feature, and the analysis must not run into either.
  const plIndexes = rows.map((r, i) => (r.passing_type === 2 ? i : -1)).filter((i) => i >= 0);
  // Counted over the FEATURES rather than over the rows, because one lane split
  // by a demand change is two rows and still one passing lane. Counting rows
  // would refuse to analyze a facility the chapter has no objection to.
  const laneFeatures = passings.filter(
    (f) => f.passingType === 2 && f.endFt - f.stationFt >= PASSING_LANE_MIN_FT - TL_TOL_FT,
  );
  if (plIndexes.length && plIndexes[0] === 0) {
    errors.push(
      'The first segment is a passing lane. Step 9 measures every later segment from the segment upstream of the passing lane, and there is none, so the engine cannot evaluate this facility. Start the highway upstream of the passing lane.',
    );
  }
  if (laneFeatures.length > 1) {
    errors.push(
      `This facility has ${laneFeatures.length} passing lanes. Chapter 15 Step 9 considers only the closest upstream passing lane and resets at each new one, and this engine measures every downstream segment from the LAST passing lane in the facility instead, so the segments between the two would take the wrong adjustment. Analyze one passing lane at a time.`,
    );
  }
  // One lane carried by several segments is a second way into the same engine
  // defect, because Step 9 reads the LAST segment whose passing type is 2 and
  // the segments between the pieces are downstream of the first piece. The
  // message names the split rather than the count, since the count is one.
  if (laneFeatures.length === 1 && plIndexes.length > 1) {
    errors.push(
      `The passing lane ${laneFeatures[0].label || laneFeatures[0].id} is split into ${plIndexes.length} segments by a grade or demand change inside it. Step 9 measures downstream distance from the last passing-lane segment in the facility, so a split lane would be measured from its own downstream end rather than from its start. Move the change outside the lane, or shorten the lane to end at it.`,
    );
  }

  return { rows: applyOverrides(doc, rows), sections: [], errors };
}

/** One derived Chapter 15 segment, in the library's own field names so the row
 * IS the fixture segment, less the bookkeeping keys. */
function twoLaneRow(doc, { key, startFt, endFt, index, passings, grades, curves, demands, errors }) {
  const m = doc.mainline;
  const lengthFt = endFt - startFt;

  // The most permissive passing feature covering the span wins, so an overlap
  // resolves rather than throwing away a passing lane. The overlap itself is
  // reported above.
  const covering = passings.filter((f) => covers(f, startFt, endFt));
  const passing = covering.reduce((best, f) => (!best || f.passingType > best.passingType ? f : best), null);
  const grade = grades.find((f) => covers(f, startFt, endFt)) ?? null;
  // The last demand change at or before this segment's start is the one in
  // force over it, the same reading `applyCrossSection` gives a lane change.
  const demand = [...demands].filter((f) => f.stationFt <= startFt + TL_TOL_FT).pop() ?? null;
  const cfg = demand?.config ?? defaultDemandChange(doc);

  let passing_type = passing?.passingType ?? 0;
  // Exhibit 15-10's minimum is a property of the PASSING LANE, not of the
  // segment a boundary happened to cut out of it. A demand change inside a
  // 0.6 mi lane splits it into two 0.3 mi segments, and measuring the segment
  // would demote both halves of a lane the chapter is perfectly happy with, and
  // then explain the demotion with a length the lane does not have.
  const passingLengthFt = passing ? passing.endFt - passing.stationFt : 0;
  const demoted = passing_type === 2 && passingLengthFt < PASSING_LANE_MIN_FT - TL_TOL_FT;
  if (demoted) passing_type = 0;

  const { subsegments, curvesOn } = subsegmentsFor(curves, startFt, endFt);

  const r = {
    key,
    startFt,
    // The chassis keys overrides, staleness and the strip off `seg_type`, and
    // the thing that can change underneath an override here is the passing
    // type, so that is what fills it.
    seg_type: PASSING_TYPE_NAMES[passing_type],
    length_ft: lengthFt,
    // A two-lane highway carries one lane in the analysis direction, and a
    // passing lane is the added second one. The strip draws `lanes`, so this
    // is what makes a passing lane read as a widening rather than as a colour.
    lanes: passing_type === 2 ? 2 : 1,

    // ── the Chapter 15 serde schema ──
    passing_type,
    // MILES. The one conversion in the two-lane path; everything on either
    // side of this line is feet.
    length: lengthFt / 5280,
    grade: grade?.gradePct ?? 0,
    // The POSTED speed limit. BFFS is 1.14 x this inside the engine.
    spl: cfg.speedLimitMph ?? m.speedLimitMph,
    // Curve geometry is ignored entirely unless this is set, so it is derived
    // from whether any curve actually lands on the segment rather than being a
    // switch of its own.
    is_hc: curvesOn.length > 0,
    volume: cfg.volume,
    // Read only on a Passing Zone. The engine hardcodes 1,500 veh/h of
    // opposing flow on a Passing Constrained segment and 0 on a Passing Lane,
    // so this value reaches the answer on one of the three types.
    volume_op: cfg.opposingVolume,
    // The engine fills these; they are written so an exported fixture has the
    // same shape as a hand-written one.
    flow_rate: 0,
    flow_rate_o: 0,
    capacity: 0,
    ffs: 0,
    avg_speed: 0,
    vertical_class: grade?.verticalClass ?? m.verticalClass ?? 1,
    phf: cfg.phf,
    // PERCENT.
    phv: cfg.heavyVehiclePct,
    pf: 0,
    fd: 0,
    fd_mid: 0,
    hor_class: 0,
    subsegments,

    // Not part of the schema. Carried so the result, the strip and the
    // discussion can all say that a passing lane was placed here and demoted,
    // which is otherwise visible only in the row's reason.
    demotedPassingLane: demoted,

    sourceIds: [passing?.id, grade?.id, demand?.id, ...curvesOn.map((c) => c.f.id)].filter(Boolean),
    overridden: false,
    staleOverride: false,
  };

  if (r.is_hc) {
    // Nothing in the engine checks that the subsegments tile the segment, and
    // the failure is quantitative and silent: the weighted speed sum is divided
    // by the SEGMENT length, so subsegments that fall short report a speed
    // proportionally too low. The derivation tiles by construction, and this
    // asserts the construction rather than trusting it.
    const sum = subsegments.reduce((a, s) => a + s.length, 0);
    if (Math.abs(sum - lengthFt) > 0.05) {
      errors.push(
        `The subsegments of the segment at ${ft(startFt)} sum to ${ft(sum)} against a segment length of ${ft(lengthFt)}. Chapter 15 Step 5d weights subsegment speeds by their share of the segment, and the engine divides by the segment length either way, so a gap would be reported as a speed rather than as an error.`,
      );
    }
  }

  r.why = whyTwoLane({ index, startFt, endFt, passing, passing_type, demoted, grade, demand, curvesOn, r });
  return r;
}

/**
 * The Step 5d subsegments of one segment: its curves, clipped to it, with
 * tangent fillers between them so the list tiles the segment exactly.
 *
 * The fillers are not decoration. A curve subsegment takes the Exhibit 15-22
 * horizontal class from its radius and superelevation and a tangent one takes
 * the segment's own speed, and the two are averaged by length over the SEGMENT
 * length. Omitting the tangents would weight the curves against a shorter total
 * than the engine divides by, which is the silent-and-quantitative failure the
 * caller asserts against above.
 *
 * `hor_class` is inert either way: Step 5d computes it from the radius and the
 * superelevation and overwrites whatever it is handed. A hand-placed curve
 * therefore carries 0, and one that came from a fixture carries the class the
 * fixture stated, so that the fixture round-trips. Neither value reaches an
 * answer. The published case2 classes agree with what the engine computes, so
 * nothing is lost by not transcribing them onto new curves.
 */
function subsegmentsFor(curves, startFt, endFt) {
  const curvesOn = curves
    .filter((f) => overlaps(f, startFt, endFt))
    .map((f) => ({ f, a: Math.max(f.stationFt, startFt), b: Math.min(f.endFt, endFt) }))
    .sort((x, y) => x.a - y.a);
  if (curvesOn.length === 0) return { subsegments: [], curvesOn };

  // Subsegment boundaries are the only lengths in this document that are not
  // whole feet: the published case2 curves run 366.5 and 767.9 ft. So the
  // stations are kept unrounded and only the emitted length is rounded, at a
  // precision fine enough that the sum still closes on the segment and coarse
  // enough that 2080.1 - 1804.5 is 275.6 rather than 275.60000000000014.
  const round4 = (v) => Math.round(v * 1e4) / 1e4;
  const out = [];
  // Key order is the library's own fixture order, so an exported subsegment
  // reads like a hand-written one.
  const tangent = (length) =>
    out.push({
      length: round4(length),
      avg_speed: 0,
      hor_class: 0,
      design_rad: 0,
      central_angle: 0,
      sup_ele: 0,
    });
  let cursor = startFt;
  for (const c of curvesOn) {
    // Where this curve actually starts contributing, which is not where it
    // starts when an earlier curve already covered part of it.
    const from = Math.max(cursor, c.a);
    // A curve entirely swallowed by the one before it contributes nothing.
    // Emitting it anyway would push a NEGATIVE length, and a negative
    // subsegment length is the worst shape available here: nothing in the
    // engine checks the tiling, the Step 5d weights are lengths, and the sum
    // would still be arithmetically consistent with a shorter segment. The
    // overlap itself is reported by the caller.
    if (c.b <= from + TL_TOL_FT) continue;
    if (from > cursor + TL_TOL_FT) tangent(from - cursor);
    out.push({
      length: round4(c.b - from),
      avg_speed: 0,
      hor_class: c.f.horClassEntered ?? 0,
      design_rad: c.f.designRadiusFt,
      // Not read by the method. Carried so a fixture that states it survives a
      // round trip and so the strip can draw the curve at its real sweep.
      central_angle: c.f.centralAngleDeg ?? 0,
      // PERCENT, per Exhibit 15-22's own column headings.
      sup_ele: c.f.superelevationPct,
    });
    cursor = c.b;
  }
  if (endFt > cursor + TL_TOL_FT) tangent(endFt - cursor);
  return { subsegments: out, curvesOn };
}

function whyTwoLane({ index, startFt, endFt, passing, passing_type, demoted, grade, demand, curvesOn, r }) {
  const parts = [
    `Segment ${index + 1} runs ${ft(endFt - startFt)} from ${ft(startFt)} to ${ft(endFt)}, and is ${PASSING_TYPE_NAMES[passing_type]}.`,
  ];
  if (demoted) {
    parts.push(
      `The passing lane ${passing.label || passing.id} covering this segment is ${ft(passing.endFt - passing.stationFt)} long, under the 0.5 mi Exhibit 15-10 minimum, and Step 1 says a passing lane shorter than that "should be ignored and treated as Passing Constrained segments instead", so it is. The minimum is measured over the whole lane rather than over this segment, since a demand or grade change inside a lane does not make it two shorter lanes.`,
    );
  } else if (passing) {
    parts.push(
      passing_type === 2
        ? `The passing lane ${passing.label || passing.id} covers it, so the segment carries the added lane and Step 8 reports its midpoint follower density rather than its endpoint one.`
        : `The passing zone ${passing.label || passing.id} covers it, so passing in the opposing lane is permitted and the opposing demand of ${Math.round(r.volume_op)} veh/h reaches the speed and percent-follower models.`,
    );
  } else {
    parts.push(
      'No passing feature covers it, so it is Passing Constrained, and the engine applies its standing 1,500 veh/h opposing flow rather than the entered opposing demand.',
    );
  }
  parts.push(
    grade
      ? `Its grade is ${grade.gradePct}% over vertical class ${r.vertical_class}, from ${grade.label || grade.id}. A grade change starts a segment because grade is one of the properties Chapter 15 Section 2 asks to be homogeneous within one.`
      : 'No grade feature covers it, so it is level and vertical class 1 unless the highway says otherwise. Step 3 recomputes the class from the grade and this length and overwrites what it was given.',
  );
  if (demand) {
    parts.push(
      `Its demand of ${Math.round(r.volume)} veh/h at a peak hour factor of ${r.phf} and ${r.phv}% heavy vehicles comes from ${demand.label || demand.id}, which is the last demand change at or before it. Traffic demand is homogeneous within a segment, so a change in it starts one.`,
    );
  }
  if (curvesOn.length) {
    parts.push(
      `${curvesOn.length} horizontal curve${curvesOn.length === 1 ? '' : 's'} sit inside it, so it is coded with horizontal curves and its ${r.subsegments.length} subsegments carry them at ${curvesOn.map((c) => `${Math.round(c.f.designRadiusFt)} ft`).join(', ')} radius with tangents between. A curve does not start a segment: Step 1 sends varying curvature to the Step 5d subsegment adjustment inside one segment, and the subsegment lengths are in feet where the segment length is in miles.`,
    );
  }
  return parts.join(' ');
}

// ── "Why this segment?" ──────────────────────────────────────────────────

function ft(n) {
  return `${Math.round(n).toLocaleString('en-US')} ft`;
}

function whyPair(gore, aux, pieces) {
  const shape = pieces
    .map((p) => (p.seg_type === 'OverlappingRamp' ? 'overlapping ramp' : p.seg_type.toLowerCase()))
    .join(' + ');
  if (aux) {
    return `An auxiliary lane connects the two gores, so the whole section is one weaving segment (Exhibit 10-12). Its boundaries sit 500 ft outside each gore per Exhibit 10-2, so the ${ft(gore)} gore-to-gore distance becomes a ${ft(gore + 2 * WEAVE_EXTENSION_FT)} segment with a ${ft(gore)} short length.`;
  }
  if (gore > 3000) {
    return `Gore-to-gore ${ft(gore)}, above 3,000 ft, so the two 1,500-ft influence areas do not touch and the section is coded ${shape}, with the basic segment taking the spacing less 3,000 ft (Exhibit 10-11).`;
  }
  if (gore > 1500) {
    return `Gore-to-gore ${ft(gore)}, between 1,500 and 3,000 ft, so the two influence areas overlap and the section is coded ${shape}. The overlap is 3,000 ft less the spacing and the merge and diverge are the spacing less 1,500 ft (Exhibit 10-11).`;
  }
  return `Gore-to-gore ${ft(gore)}, at or below 1,500 ft with no auxiliary lane, which the manual calls highly unusual. The influence areas are truncated at the adjacent gore and the worst case applies over the whole distance, so the section is one overlapping ramp segment (Chapter 10 Section 2).`;
}

function whyIsolated(kind, f, len, ria) {
  const dir = kind === 'Merge' ? 'downstream of' : 'upstream of';
  const base = `The ${kind === 'Merge' ? 'on' : 'off'}-ramp at station ${ft(f.stationFt)} has no paired ramp forming a section with it, so its influence area alone is the segment: ${ft(ria)} ${dir} the gore (Exhibit 10-1).`;
  if (len < ria - 0.5) {
    return `${base} It is truncated to ${ft(len)} at the adjacent gore point, per the same rule the manual gives for sub-1,500-ft ramp spacing.`;
  }
  return base;
}
