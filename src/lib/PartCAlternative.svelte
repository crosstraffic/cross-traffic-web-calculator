<script>
  import { WasmAlternativeIntersection, WasmDisplacedLeftTurn, edtt_stop_or_signal, dlt_offset } from 'HCM-middleware';
  import RcutDiagram from '$lib/RcutDiagram.svelte';
  import RcutSignalDiagram from '$lib/RcutSignalDiagram.svelte';
  import MutDiagram from '$lib/MutDiagram.svelte';
  import DltDiagram from '$lib/DltDiagram.svelte';
  import Discussion from '$lib/Discussion.svelte';
  import { setReport } from '$lib/report';
  import { discussion, discussionDlt } from '$lib/PartCAlternative.discussion.js';

  let { ready = false } = $props();

  // Part C form. Each option loads its Chapter 34 example problem as defaults:
  // RCUT with STOP signs = Example Problem 13, RCUT with signals = Example
  // Problem 14, MUT = Example Problem 15, DLT = Example Problem 16.
  let form = $state('Rcut');

  // ── RCUT with STOP signs (three-legged, EP13) ────────────────────────────
  // The major street runs north-south; the minor street is the eastbound stem.
  const defaultRcut = () => ({
    phf: 0.9,
    dist: 700,
    ffs: 60,
    storage: 400,
    phv: 6,
    grade: 2,
    tc_minor: 6.9,
    tf_minor: 3.3,
    tc_major_left: 4.1,
    tf_major_left: 2.2,
    tc_uturn: 4.4,
    tf_uturn: 2.6,
    demands: { ebl: 150, ebr: 160, nbl: 170, nbt: 900, sbt: 800, sbr: 140 },
  });
  let rcut = $state(defaultRcut());

  const RCUT_OD = [
    { key: 'ebl', label: 'EB left (minor street)' },
    { key: 'ebr', label: 'EB right (minor street)' },
    { key: 'nbl', label: 'NB left (major street)' },
    { key: 'nbt', label: 'NB through' },
    { key: 'sbt', label: 'SB through' },
    { key: 'sbr', label: 'SB right' },
  ];

  // Chapter 20 headway adjustments (Equations 20-16 / 20-17): 2.0 s critical-
  // headway and 1.0 s follow-up increments per heavy-vehicle proportion on a
  // two-lane major street, 0.1 s/% grade on the critical headway.
  const rcutDerived = () => {
    const r = Math.round,
      phf = Number(rcut.phf);
    const d = Object.fromEntries(Object.entries(rcut.demands).map(([k, v]) => [k, Number(v)]));
    const phv = Number(rcut.phv) / 100,
      grade = Number(rcut.grade);
    return {
      main: {
        name: 'Main junction, minor-street approach',
        v: r((d.ebl + d.ebr) / phf),
        vc: r(d.sbt / phf / 2),
        tc: Number(rcut.tc_minor) + 2.0 * phv + 0.1 * grade,
        tf: Number(rcut.tf_minor) + 1.0 * phv,
      },
      nbl: {
        name: 'Main junction, major-street left turn',
        v: r(d.nbl / phf),
        vc: r((d.sbt + d.sbr) / phf),
        tc: Number(rcut.tc_major_left) + 2.0 * phv,
        tf: Number(rcut.tf_major_left) + 1.0 * phv,
      },
      uturn: {
        name: 'U-turn crossover',
        v: r(d.ebl / phf),
        vc: r((d.nbt + d.nbl) / phf),
        tc: Number(rcut.tc_uturn),
        tf: Number(rcut.tf_uturn),
      },
    };
  };

  // ── MUT with STOP-controlled crossovers (four-legged, EP15) ──────────────
  // Junction control delays come from the Chapter 19 / Chapter 20 analyses of
  // the component junctions and are entered per junction (Exhibit 34-137).
  const defaultMut = () => ({
    phf: 0.95,
    dist: 600,
    ffs: 40,
    delays: {
      ebT: 25.1,
      ebR: 23.7,
      wbT: 22.2,
      wbR: 20.2,
      nbT: 9.3,
      nbR: 9.4,
      sbT: 12.3,
      sbR: 13.7,
      nX: 34.6,
      sX: 14.0,
    },
    demands: {
      nbl: 280,
      nbt: 700,
      nbr: 60,
      sbl: 50,
      sbt: 1000,
      sbr: 80,
      ebl: 70,
      ebt: 400,
      ebr: 200,
      wbl: 80,
      wbt: 300,
      wbr: 50,
    },
  });
  let mut = $state(defaultMut());

  const MUT_JUNCTIONS = [
    { key: 'ebT', label: 'Main: EB through' },
    { key: 'ebR', label: 'Main: EB right' },
    { key: 'wbT', label: 'Main: WB through' },
    { key: 'wbR', label: 'Main: WB right' },
    { key: 'nbT', label: 'Main: NB through' },
    { key: 'nbR', label: 'Main: NB right' },
    { key: 'sbT', label: 'Main: SB through' },
    { key: 'sbR', label: 'Main: SB right' },
    { key: 'nX', label: 'North U-turn crossover' },
    { key: 'sX', label: 'South U-turn crossover' },
  ];
  const OD_TWELVE = [
    { key: 'nbl', label: 'NB left' },
    { key: 'nbt', label: 'NB through' },
    { key: 'nbr', label: 'NB right' },
    { key: 'sbl', label: 'SB left' },
    { key: 'sbt', label: 'SB through' },
    { key: 'sbr', label: 'SB right' },
    { key: 'ebl', label: 'EB left' },
    { key: 'ebt', label: 'EB through' },
    { key: 'ebr', label: 'EB right' },
    { key: 'wbl', label: 'WB left' },
    { key: 'wbt', label: 'WB through' },
    { key: 'wbr', label: 'WB right' },
  ];

  // ── RCUT with signals (four-legged, EP14) ────────────────────────────────
  // The main street runs north-south on two separate carriageways, so the
  // main junction is really two signals: the west main intersection carries
  // the southbound carriageway across the minor street and the east main
  // intersection carries the northbound one (Exhibit 34-131). Signalized
  // U-turn crossovers sit north and south of them. All twelve control delays
  // come from the Chapter 19 analyses of those four junctions and enter here
  // as provided inputs (Exhibit 34-132).
  const defaultRcutSignal = () => ({
    phf: 0.93,
    dist: 800,
    ffs: 50,
    delays: {
      nX_sbT: 7.6,
      nX_wb: 33.3,
      wM_sbT: 5.4,
      wM_sbR: 0.3,
      wM_ebR: 35.1,
      wM_nbL: 33.2,
      sX_nbT: 4.1,
      sX_eb: 16.1,
      eM_nbT: 6.4,
      eM_nbR: 9.1,
      eM_wbR: 12.4,
      eM_sbL: 10.8,
    },
    demands: {
      nbl: 150,
      nbt: 420,
      nbr: 10,
      sbl: 50,
      sbt: 1900,
      sbr: 60,
      ebl: 20,
      ebt: 300,
      ebr: 10,
      wbl: 30,
      wbt: 100,
      wbr: 200,
    },
  });
  let rcutSignal = $state(defaultRcutSignal());

  const RCUTSIGNAL_JUNCTIONS = [
    {
      title: 'North U-turn crossover',
      fields: [
        { key: 'nX_sbT', label: 'SB through' },
        { key: 'nX_wb', label: 'WB crossover (U-turn)' },
      ],
    },
    {
      title: 'West main intersection (southbound carriageway)',
      fields: [
        { key: 'wM_sbT', label: 'SB through' },
        { key: 'wM_sbR', label: 'SB right turn' },
        { key: 'wM_ebR', label: 'EB right turn' },
        { key: 'wM_nbL', label: 'NB left turn' },
      ],
    },
    {
      title: 'South U-turn crossover',
      fields: [
        { key: 'sX_nbT', label: 'NB through' },
        { key: 'sX_eb', label: 'EB crossover (U-turn)' },
      ],
    },
    {
      title: 'East main intersection (northbound carriageway)',
      fields: [
        { key: 'eM_nbT', label: 'NB through' },
        { key: 'eM_nbR', label: 'NB right turn' },
        { key: 'eM_wbR', label: 'WB right turn' },
        { key: 'eM_sbL', label: 'SB left turn' },
      ],
    },
  ];

  // ── DLT (EP16) ───────────────────────────────────────────────────────────
  const defaultDlt = () => ({
    full: false,
    td: 350,
    sf: 35,
    lagDlt: 0,
    lagTh: 52,
    oSupp: 0,
    oMain: 0,
    cycle: 65,
    totalOd: 5594,
    // Exhibit 34-145: flow through each component intersection and the control
    // delay that flow experiences there. Int 1 = west supplemental, Int 2 =
    // main, Int 3 = east supplemental. Blank cells mean the movement does not
    // incur delay there.
    rows: [
      {
        label: 'EB L',
        cells: [
          { flow: 761, delay: 22.5 },
          { flow: null, delay: null },
          { flow: null, delay: null },
        ],
      },
      {
        label: 'EB T',
        cells: [
          { flow: 859, delay: 0.4 },
          { flow: 437, delay: 41.9 },
          { flow: 1352, delay: 2.5 },
        ],
      },
      {
        label: 'EB R',
        cells: [
          { flow: null, delay: null },
          { flow: 422, delay: 42.5 },
          { flow: null, delay: null },
        ],
      },
      {
        label: 'WB L',
        cells: [
          { flow: null, delay: null },
          { flow: null, delay: null },
          { flow: 486, delay: 25.7 },
        ],
      },
      {
        label: 'WB T',
        cells: [
          { flow: 1397, delay: 4.0 },
          { flow: 340, delay: 29.3 },
          { flow: 667, delay: 0.4 },
        ],
      },
      {
        label: 'WB R',
        cells: [
          { flow: null, delay: null },
          { flow: 328, delay: 29.7 },
          { flow: null, delay: null },
        ],
      },
      {
        label: 'NB L',
        cells: [
          { flow: null, delay: null },
          { flow: 739, delay: 23.7 },
          { flow: null, delay: null },
        ],
      },
      {
        label: 'NB T',
        cells: [
          { flow: null, delay: null },
          { flow: 439, delay: 19.8 },
          { flow: null, delay: null },
        ],
      },
      {
        label: 'NB R',
        cells: [
          { flow: null, delay: null },
          { flow: 425, delay: 19.8 },
          { flow: null, delay: null },
        ],
      },
      {
        label: 'SB L',
        cells: [
          { flow: null, delay: null },
          { flow: 500, delay: 26.2 },
          { flow: null, delay: null },
        ],
      },
      {
        label: 'SB T',
        cells: [
          { flow: null, delay: null },
          { flow: 364, delay: 23.4 },
          { flow: null, delay: null },
        ],
      },
      {
        label: 'SB R',
        cells: [
          { flow: null, delay: null },
          { flow: 353, delay: 23.5 },
          { flow: null, delay: null },
        ],
      },
    ],
  });
  let dlt = $state(defaultDlt());

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  // The engine labels its result rows the way the exhibits do, so the diagram's
  // movement keys have to be mapped back from those labels.
  const RCUT_LABEL_KEY = { 'EB L': 'ebl', 'EB R': 'ebr', 'NB L': 'nbl', 'NB T': 'nbt', 'SB T': 'sbt', 'SB R': 'sbr' };
  let rcutLos = $derived(
    results?.form === 'Rcut'
      ? Object.fromEntries(results.rows.map((m) => [RCUT_LABEL_KEY[m.label], m.los]).filter(([k]) => k))
      : {},
  );

  // The twelve-movement labels map back mechanically ("NB L" -> "nbl"), so the
  // MUT diagram does not need a lookup table of its own.
  const twelveLos = (of) =>
    results?.form === of
      ? Object.fromEntries(results.rows.map((m) => [m.label.toLowerCase().replace(' ', ''), m.los]))
      : {};
  let rcutSignalLos = $derived(twelveLos('RcutSignal'));
  let mutLos = $derived(twelveLos('Mut'));

  // The DLT reports a single intersection LOS, so its diagram takes that
  // letter plus the offset result rather than a per-movement map.
  let dltLos = $derived(results?.form === 'Dlt' ? results.los : '');
  let dltOffset = $derived(results?.form === 'Dlt' ? results.off : null);

  const stop = (flow, vc, tc, tf, storage) => ({
    type: 'stop',
    flow_veh_h: flow,
    conflicting_flow_veh_h: vc,
    critical_headway_s: tc,
    followup_headway_s: tf,
    storage_ft: storage,
  });
  const prov = (delay) => ({ type: 'provided', control_delay_s: Number(delay) });

  function runRcut() {
    const j = rcutDerived();
    const r = Math.round,
      phf = Number(rcut.phf),
      st = Number(rcut.storage);
    const edtt = edtt_stop_or_signal(Number(rcut.dist), Number(rcut.dist), Number(rcut.ffs));
    const movements = [
      {
        label: 'EB L',
        approach: 'Eb',
        demand_veh_h: j.uturn.v,
        edtt_s: edtt,
        junctions: [
          stop(j.main.v, j.main.vc, j.main.tc, j.main.tf, null),
          stop(j.uturn.v, j.uturn.vc, j.uturn.tc, j.uturn.tf, st),
        ],
      },
      {
        label: 'EB R',
        approach: 'Eb',
        demand_veh_h: r(Number(rcut.demands.ebr) / phf),
        edtt_s: 0,
        junctions: [stop(j.main.v, j.main.vc, j.main.tc, j.main.tf, null)],
      },
      {
        label: 'NB L',
        approach: 'Nb',
        demand_veh_h: j.nbl.v,
        edtt_s: 0,
        junctions: [stop(j.nbl.v, j.nbl.vc, j.nbl.tc, j.nbl.tf, st)],
      },
      { label: 'NB T', approach: 'Nb', demand_veh_h: r(Number(rcut.demands.nbt) / phf), edtt_s: 0, junctions: [] },
      { label: 'SB T', approach: 'Sb', demand_veh_h: r(Number(rcut.demands.sbt) / phf), edtt_s: 0, junctions: [] },
      { label: 'SB R', approach: 'Sb', demand_veh_h: r(Number(rcut.demands.sbr) / phf), edtt_s: 0, junctions: [] },
    ];
    const ix = new WasmAlternativeIntersection({ form: 'RcutThreeLeg', movements });
    const rows = ix.movement_results_to_js_value().map((m, i) => ({ ...m, demand: movements[i].demand_veh_h }));
    return { rows, ett: ix.get_intersection_ett_s(), los: ix.get_intersection_los(), derived: j };
  }

  // Movement journeys through a four-legged MUT (Exhibit 23-50): left turns
  // pass the main junction, the U-turn crossover beyond it, and the main
  // junction again; every other movement meets only the main junction.
  function runMut() {
    const r = Math.round,
      phf = Number(mut.phf),
      dj = mut.delays;
    const edtt = edtt_stop_or_signal(Number(mut.dist), Number(mut.dist), Number(mut.ffs));
    const mv = (label, approach, demand, delays, ed) => ({
      label,
      approach,
      demand_veh_h: r(Number(demand) / phf),
      edtt_s: ed,
      junctions: delays.map(prov),
    });
    const movements = [
      mv('NB L', 'Nb', mut.demands.nbl, [dj.nbT, dj.nX, dj.sbR], edtt),
      mv('NB T', 'Nb', mut.demands.nbt, [dj.nbT], 0),
      mv('NB R', 'Nb', mut.demands.nbr, [dj.nbR], 0),
      mv('SB L', 'Sb', mut.demands.sbl, [dj.sbT, dj.sX, dj.nbR], edtt),
      mv('SB T', 'Sb', mut.demands.sbt, [dj.sbT], 0),
      mv('SB R', 'Sb', mut.demands.sbr, [dj.sbR], 0),
      mv('EB L', 'Eb', mut.demands.ebl, [dj.ebR, dj.sX, dj.nbT], edtt),
      mv('EB T', 'Eb', mut.demands.ebt, [dj.ebT], 0),
      mv('EB R', 'Eb', mut.demands.ebr, [dj.ebR], 0),
      mv('WB L', 'Wb', mut.demands.wbl, [dj.wbR, dj.nX, dj.sbT], edtt),
      mv('WB T', 'Wb', mut.demands.wbt, [dj.wbT], 0),
      mv('WB R', 'Wb', mut.demands.wbr, [dj.wbR], 0),
    ];
    const ix = new WasmAlternativeIntersection({ form: 'MutFourLeg', movements });
    const rows = ix.movement_results_to_js_value().map((m, i) => ({ ...m, demand: movements[i].demand_veh_h }));
    return { rows, ett: ix.get_intersection_ett_s(), los: ix.get_intersection_los() };
  }

  // Movement journeys through a four-legged RCUT with signals (top of Exhibit
  // 23-48). Every major-street movement crosses the near U-turn crossover
  // before reaching its main intersection. The minor-street lefts and
  // throughs cannot cross, so they turn right onto the near carriageway,
  // U-turn at the crossover beyond it, and come back to their destination,
  // which is the journey that carries the extra distance travel time.
  function runRcutSignal() {
    const r = Math.round,
      phf = Number(rcutSignal.phf),
      dj = rcutSignal.delays;
    const edtt = edtt_stop_or_signal(Number(rcutSignal.dist), Number(rcutSignal.dist), Number(rcutSignal.ffs));
    const mv = (label, approach, demand, delays, ed) => ({
      label,
      approach,
      demand_veh_h: r(Number(demand) / phf),
      edtt_s: ed,
      junctions: delays.map(prov),
    });
    const d = rcutSignal.demands;
    const movements = [
      mv('NB L', 'Nb', d.nbl, [dj.sX_nbT, dj.wM_nbL], 0),
      mv('SB L', 'Sb', d.sbl, [dj.nX_sbT, dj.eM_sbL], 0),
      mv('NB T', 'Nb', d.nbt, [dj.sX_nbT, dj.eM_nbT], 0),
      mv('SB T', 'Sb', d.sbt, [dj.nX_sbT, dj.wM_sbT], 0),
      mv('NB R', 'Nb', d.nbr, [dj.sX_nbT, dj.eM_nbR], 0),
      mv('SB R', 'Sb', d.sbr, [dj.nX_sbT, dj.wM_sbR], 0),
      mv('EB L', 'Eb', d.ebl, [dj.wM_ebR, dj.sX_eb, dj.eM_nbT], edtt),
      mv('WB L', 'Wb', d.wbl, [dj.eM_wbR, dj.nX_wb, dj.wM_sbT], edtt),
      mv('EB T', 'Eb', d.ebt, [dj.wM_ebR, dj.sX_eb, dj.eM_nbR], edtt),
      mv('WB T', 'Wb', d.wbt, [dj.eM_wbR, dj.nX_wb, dj.wM_sbR], edtt),
      mv('EB R', 'Eb', d.ebr, [dj.wM_ebR], 0),
      mv('WB R', 'Wb', d.wbr, [dj.eM_wbR], 0),
    ];
    const ix = new WasmAlternativeIntersection({ form: 'RcutFourLeg', movements });
    const rows = ix.movement_results_to_js_value().map((m, i) => ({ ...m, demand: movements[i].demand_veh_h }));
    return { rows, ett: ix.get_intersection_ett_s(), los: ix.get_intersection_los() };
  }

  function runDlt() {
    const flows = [],
      delays = [];
    for (const row of dlt.rows) {
      for (const c of row.cells) {
        const f = Number(c.flow),
          d = Number(c.delay);
        if (c.flow !== null && c.flow !== '' && f > 0 && c.delay !== null && c.delay !== '') {
          flows.push(f);
          delays.push(d);
        }
      }
    }
    const ix = new WasmDisplacedLeftTurn(
      new Float64Array(flows),
      new Float64Array(delays),
      Number(dlt.totalOd),
      dlt.full,
    );
    const off = dlt_offset(
      Number(dlt.td),
      Number(dlt.sf),
      Number(dlt.lagDlt),
      Number(dlt.lagTh),
      Number(dlt.oSupp),
      Number(dlt.oMain),
      Number(dlt.cycle),
    );
    return { ett: ix.get_intersection_ett_s(), los: ix.get_los(), off, cellCount: flows.length };
  }

  const FORM_NAMES = {
    Rcut: 'Restricted crossing U-turn (RCUT), STOP-controlled, three-legged',
    RcutSignal: 'Restricted crossing U-turn (RCUT), signalized, four-legged',
    Mut: 'Median U-turn (MUT), four-legged',
    Dlt: 'Displaced left-turn (DLT)',
  };

  // The short names, for prose that has to name the form inside a sentence rather than label it.
  const FORM_SHORT = { Rcut: 'RCUT', RcutSignal: 'signalized RCUT', Mut: 'MUT', Dlt: 'DLT' };

  const RUNNERS = { Rcut: runRcut, RcutSignal: runRcutSignal, Mut: runMut, Dlt: runDlt };

  // The three crossover-based forms share the same three site parameters, so
  // the report reads them through one accessor rather than a chain of tests.
  const site = () => (form === 'Rcut' ? rcut : form === 'RcutSignal' ? rcutSignal : mut);

  function runAnalysis() {
    hasError = false;
    results = null;
    try {
      const out = RUNNERS[form]();
      results = { form, ...out };
      // Generated once, off the run that produced these numbers, and carried on the result so the
      // page and the printable report can never drift apart or restate a since-edited input.
      results.discussion =
        form === 'Dlt'
          ? discussionDlt(results, { full: dlt.full, tdFt: dlt.td, sfMph: dlt.sf, cycle: dlt.cycle })
          : discussion(results, { formLabel: FORM_SHORT[form] });
      const common = {
        chapter: 'Ramp Terminals and Alternative Intersections',
        chapterRef: 'HCM Chapter 23',
        href: '/hcm23',
        generatedAt: new Date().toLocaleString(),
      };
      if (form === 'Dlt') {
        setReport({
          ...common,
          headline: { label: 'DLT intersection LOS', value: results.los },
          discussion: results.discussion,
          inputs: [
            {
              label: 'Intersection form',
              value: dlt.full ? 'Full displaced left-turn' : 'Partial displaced left-turn',
            },
            { label: 'DLT roadway distance', value: `${dlt.td} ft` },
            { label: 'DLT roadway free-flow speed', value: `${dlt.sf} mi/h` },
            { label: 'Cycle length', value: `${dlt.cycle} s` },
            { label: 'O-D demand total', value: `${dlt.totalOd} veh/h` },
            { label: 'Junction delay cells', value: `${results.cellCount}` },
          ],
          summary: [
            { label: 'Weighted-average ETT (Equation 23-69)', value: `${results.ett.toFixed(1)} s/veh` },
            { label: 'DLT roadway travel time (Equation 23-63)', value: `${results.off.tt_dlt_s.toFixed(1)} s` },
            {
              label: 'Supplemental-intersection offset (Equations 23-66 to 23-68)',
              value: `${results.off.offset_supp_s.toFixed(1)} s`,
            },
            { label: 'Intersection LOS (Chapter 19 thresholds)', value: results.los },
          ],
          methodology: [
            'HCM Chapter 23 Part C displaced left-turn evaluation: supplemental-intersection offset from Equations 23-63 through 23-68, and weighted-average experienced travel time (equal to control delay) from Equation 23-69 over the per-junction flows and delays of the component intersections. Junction control delays come from the Chapter 18 and Chapter 19 procedures.',
          ],
        });
      } else {
        setReport({
          ...common,
          headline: { label: 'Intersection LOS', value: results.los },
          discussion: results.discussion,
          inputs: [
            { label: 'Intersection form', value: FORM_NAMES[form] },
            { label: 'Distance to U-turn crossover', value: `${site().dist} ft` },
            { label: 'Major-street free-flow speed', value: `${site().ffs} mi/h` },
            { label: 'Peak hour factor', value: site().phf },
          ],
          resultTable: {
            columns: ['Movement', 'Flow rate (veh/h)', 'Control delay (s/veh)', 'EDTT (s/veh)', 'ETT (s/veh)', 'LOS'],
            rows: results.rows.map((m) => [
              m.label,
              String(m.demand ?? ''),
              m.total_control_delay_s.toFixed(1),
              m.edtt_s.toFixed(1),
              m.ett_s.toFixed(1),
              m.los,
            ]),
          },
          summary: [
            { label: 'Intersection ETT (Equation 23-62)', value: `${results.ett.toFixed(1)} s/veh` },
            { label: 'Intersection LOS (Exhibit 23-13)', value: results.los },
          ],
          methodology: [
            'HCM Chapter 23 Part C alternative-intersection evaluation (Exhibit 23-47): O-D demands redistributed to the component junctions and converted to flow rates (Equation 23-57), junction control delays from the Chapter 20 gap-acceptance procedure or supplied from the Chapter 19 signalized analysis, extra distance travel time (Equation 23-59), experienced travel time per movement (Equation 23-60), and LOS from Exhibit 23-13.',
          ],
        });
      }
    } catch (err) {
      console.error('Chapter 23 Part C analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    hasError = false;
    results = null;
    if (form === 'Rcut') rcut = defaultRcut();
    else if (form === 'RcutSignal') rcutSignal = defaultRcutSignal();
    else if (form === 'Mut') mut = defaultMut();
    else dlt = defaultDlt();
  }

  function applyForm(next) {
    form = next;
    results = null;
    hasError = false;
  }
</script>

{#if hasError}
  <div class="alert alert-error shadow-sm mb-6">
    <span>{errMessage}</span>
  </div>
{/if}

<form
  id="hcm23-partc"
  onsubmit={(e) => {
    e.preventDefault();
    runAnalysis();
  }}
>
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Alternative Intersection Configuration</h2>
        <p class="panel-sub">
          Each form loads its published HCM Chapter 34 example problem as defaults: the STOP-controlled RCUT is Example
          Problem 13, the signalized RCUT is Example Problem 14, the MUT is Example Problem 15, and the DLT is Example
          Problem 16.
        </p>
      </div>
    </div>
    <div class="param-grid">
      <div class="param-field">
        <label for="PC_FORM_input">Intersection Form</label>
        <select
          id="PC_FORM_input"
          class="select select-bordered select-sm"
          value={form}
          onchange={(e) => applyForm(e.target.value)}
        >
          <option value="Rcut">RCUT with STOP signs (three-legged)</option>
          <option value="RcutSignal">RCUT with signals (four-legged)</option>
          <option value="Mut">Median U-turn (four-legged)</option>
          <option value="Dlt">Displaced left-turn</option>
        </select>
        <p class="param-hint">Switching loads that form's published example as defaults.</p>
      </div>

      {#if form === 'Rcut'}
        <div class="param-field">
          <label for="PC_PHF_input">Peak Hour Factor</label>
          <input
            id="PC_PHF_input"
            type="number"
            step="0.01"
            min="0.25"
            max="1"
            class="input input-bordered input-sm"
            bind:value={rcut.phf}
            required
          />
        </div>
        <div class="param-field">
          <label for="PC_DIST_input">Distance to U-Turn Crossover</label>
          <div class="cell-field">
            <input
              id="PC_DIST_input"
              type="number"
              min="100"
              class="input input-bordered input-sm"
              bind:value={rcut.dist}
              required
            />
            <span class="unit">ft</span>
          </div>
        </div>
        <div class="param-field">
          <label for="PC_FFS_input">Major-Street Free-Flow Speed</label>
          <div class="cell-field">
            <input
              id="PC_FFS_input"
              type="number"
              min="10"
              class="input input-bordered input-sm"
              bind:value={rcut.ffs}
              required
            />
            <span class="unit">mi/h</span>
          </div>
        </div>
        <div class="param-field">
          <label for="PC_STORAGE_input">Crossover Storage Bay Length</label>
          <div class="cell-field">
            <input
              id="PC_STORAGE_input"
              type="number"
              min="0"
              class="input input-bordered input-sm"
              bind:value={rcut.storage}
              required
            />
            <span class="unit">ft</span>
          </div>
        </div>
        <div class="param-field">
          <label for="PC_PHV_input">Heavy Vehicles</label>
          <div class="cell-field">
            <input
              id="PC_PHV_input"
              type="number"
              step="0.1"
              min="0"
              max="100"
              class="input input-bordered input-sm"
              bind:value={rcut.phv}
              required
            />
            <span class="unit">%</span>
          </div>
        </div>
        <div class="param-field">
          <label for="PC_GRADE_input">Minor-Approach Grade</label>
          <div class="cell-field">
            <input
              id="PC_GRADE_input"
              type="number"
              step="0.1"
              class="input input-bordered input-sm"
              bind:value={rcut.grade}
              required
            />
            <span class="unit">%</span>
          </div>
        </div>
      {:else if form === 'RcutSignal'}
        <div class="param-field">
          <label for="PC_PHF_input">Peak Hour Factor</label>
          <input
            id="PC_PHF_input"
            type="number"
            step="0.01"
            min="0.25"
            max="1"
            class="input input-bordered input-sm"
            bind:value={rcutSignal.phf}
            required
          />
        </div>
        <div class="param-field">
          <label for="PC_DIST_input">Distance to U-Turn Crossovers</label>
          <div class="cell-field">
            <input
              id="PC_DIST_input"
              type="number"
              min="100"
              class="input input-bordered input-sm"
              bind:value={rcutSignal.dist}
              required
            />
            <span class="unit">ft</span>
          </div>
          <p class="param-hint">Main intersection to each crossover, north and south.</p>
        </div>
        <div class="param-field">
          <label for="PC_FFS_input">Major-Street Free-Flow Speed</label>
          <div class="cell-field">
            <input
              id="PC_FFS_input"
              type="number"
              min="10"
              class="input input-bordered input-sm"
              bind:value={rcutSignal.ffs}
              required
            />
            <span class="unit">mi/h</span>
          </div>
        </div>
      {:else if form === 'Mut'}
        <div class="param-field">
          <label for="PC_PHF_input">Peak Hour Factor</label>
          <input
            id="PC_PHF_input"
            type="number"
            step="0.01"
            min="0.25"
            max="1"
            class="input input-bordered input-sm"
            bind:value={mut.phf}
            required
          />
        </div>
        <div class="param-field">
          <label for="PC_DIST_input">Distance to U-Turn Crossovers</label>
          <div class="cell-field">
            <input
              id="PC_DIST_input"
              type="number"
              min="100"
              class="input input-bordered input-sm"
              bind:value={mut.dist}
              required
            />
            <span class="unit">ft</span>
          </div>
        </div>
        <div class="param-field">
          <label for="PC_FFS_input">Major-Street Free-Flow Speed</label>
          <div class="cell-field">
            <input
              id="PC_FFS_input"
              type="number"
              min="10"
              class="input input-bordered input-sm"
              bind:value={mut.ffs}
              required
            />
            <span class="unit">mi/h</span>
          </div>
        </div>
      {:else}
        <div class="param-field">
          <label for="PC_DLTFULL_input">DLT Configuration</label>
          <select id="PC_DLTFULL_input" class="select select-bordered select-sm" bind:value={dlt.full}>
            <option value={false}>Partial (major-street lefts displaced)</option>
            <option value={true}>Full (all lefts displaced)</option>
          </select>
        </div>
        <div class="param-field">
          <label for="PC_TD_input">DLT Roadway Distance</label>
          <div class="cell-field">
            <input
              id="PC_TD_input"
              type="number"
              min="50"
              class="input input-bordered input-sm"
              bind:value={dlt.td}
              required
            />
            <span class="unit">ft</span>
          </div>
          <p class="param-hint">Upstream crossover to the main-intersection stop bar.</p>
        </div>
        <div class="param-field">
          <label for="PC_SF_input">DLT Roadway Free-Flow Speed</label>
          <div class="cell-field">
            <input
              id="PC_SF_input"
              type="number"
              min="10"
              class="input input-bordered input-sm"
              bind:value={dlt.sf}
              required
            />
            <span class="unit">mi/h</span>
          </div>
        </div>
        <div class="param-field">
          <label for="PC_CYCLE_input">Background Cycle Length</label>
          <div class="cell-field">
            <input
              id="PC_CYCLE_input"
              type="number"
              min="30"
              max="300"
              class="input input-bordered input-sm"
              bind:value={dlt.cycle}
              required
            />
            <span class="unit">s</span>
          </div>
        </div>
        <div class="param-field">
          <label for="PC_LAGDLT_input">Lag to DLT Phase Start</label>
          <div class="cell-field">
            <input
              id="PC_LAGDLT_input"
              type="number"
              min="0"
              class="input input-bordered input-sm"
              bind:value={dlt.lagDlt}
              required
            />
            <span class="unit">s</span>
          </div>
          <p class="param-hint">Reference point to the displaced left-turn phase at the supplemental intersection.</p>
        </div>
        <div class="param-field">
          <label for="PC_LAGTH_input">Lag to Through Phase Start</label>
          <div class="cell-field">
            <input
              id="PC_LAGTH_input"
              type="number"
              min="0"
              class="input input-bordered input-sm"
              bind:value={dlt.lagTh}
              required
            />
            <span class="unit">s</span>
          </div>
          <p class="param-hint">
            Reference point to the major-street through phase at the main intersection, with actuated phases at their
            maximums.
          </p>
        </div>
        <div class="param-field">
          <label for="PC_OSUPP_input">Initial Supplemental Offset</label>
          <div class="cell-field">
            <input
              id="PC_OSUPP_input"
              type="number"
              class="input input-bordered input-sm"
              bind:value={dlt.oSupp}
              required
            />
            <span class="unit">s</span>
          </div>
        </div>
        <div class="param-field">
          <label for="PC_OMAIN_input">Main-Intersection Offset</label>
          <div class="cell-field">
            <input
              id="PC_OMAIN_input"
              type="number"
              class="input input-bordered input-sm"
              bind:value={dlt.oMain}
              required
            />
            <span class="unit">s</span>
          </div>
        </div>
        <div class="param-field">
          <label for="PC_TOTALOD_input">O-D Demand Total</label>
          <div class="cell-field">
            <input
              id="PC_TOTALOD_input"
              type="number"
              min="1"
              class="input input-bordered input-sm"
              bind:value={dlt.totalOd}
              required
            />
            <span class="unit">veh/h</span>
          </div>
          <p class="param-hint">
            Must equal the conventional-intersection movement total so trips are not double-counted.
          </p>
        </div>
      {/if}
    </div>
  </section>

  {#if form === 'Rcut'}
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Movement Demands</h2>
          <p class="panel-sub">
            Hourly demands for the six movements. The major street runs north-south with two through lanes each way; the
            minor street is the eastbound stem. Flow-rate conversion (Equation 23-57), conflicting flows, and the
            Chapter 20 headway adjustments are derived automatically and shown with the results.
          </p>
        </div>
      </div>
      <RcutDiagram bind:demands={rcut.demands} dist={rcut.dist} losByMovement={rcutLos} />
      <div class="param-grid">
        {#each RCUT_OD as od (od.key)}
          <div class="param-field">
            <label for="PC_OD_{od.key}_input">{od.label}</label>
            <div class="cell-field">
              <input
                id="PC_OD_{od.key}_input"
                type="number"
                min="0"
                class="input input-bordered input-sm"
                bind:value={rcut.demands[od.key]}
                required
              />
              <span class="unit">veh/h</span>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Base Gap-Acceptance Headways</h2>
          <p class="panel-sub">
            Base critical headway and follow-up time before the heavy-vehicle and grade adjustments. The U-turn
            crossover values are the Chapter 23 defaults observed in the field; the others are the Chapter 20 base
            values for a two-lane major street.
          </p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr><th>Junction Movement</th><th>Base Critical Headway (s)</th><th>Base Follow-Up Time (s)</th></tr>
          </thead>
          <tbody>
            <tr>
              <th>Minor-street approach at the main junction</th>
              <td
                ><input
                  aria-label="minor approach base critical headway"
                  type="number"
                  step="0.1"
                  min="1"
                  class="input input-bordered input-sm"
                  bind:value={rcut.tc_minor}
                  required
                /></td
              >
              <td
                ><input
                  aria-label="minor approach base follow-up time"
                  type="number"
                  step="0.1"
                  min="1"
                  class="input input-bordered input-sm"
                  bind:value={rcut.tf_minor}
                  required
                /></td
              >
            </tr>
            <tr>
              <th>Major-street left turn at the main junction</th>
              <td
                ><input
                  aria-label="major left base critical headway"
                  type="number"
                  step="0.1"
                  min="1"
                  class="input input-bordered input-sm"
                  bind:value={rcut.tc_major_left}
                  required
                /></td
              >
              <td
                ><input
                  aria-label="major left base follow-up time"
                  type="number"
                  step="0.1"
                  min="1"
                  class="input input-bordered input-sm"
                  bind:value={rcut.tf_major_left}
                  required
                /></td
              >
            </tr>
            <tr>
              <th>U-turn crossover</th>
              <td
                ><input
                  aria-label="U-turn crossover critical headway"
                  type="number"
                  step="0.1"
                  min="1"
                  class="input input-bordered input-sm"
                  bind:value={rcut.tc_uturn}
                  required
                /></td
              >
              <td
                ><input
                  aria-label="U-turn crossover follow-up time"
                  type="number"
                  step="0.1"
                  min="1"
                  class="input input-bordered input-sm"
                  bind:value={rcut.tf_uturn}
                  required
                /></td
              >
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  {:else if form === 'RcutSignal'}
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Movement Demands</h2>
          <p class="panel-sub">
            Hourly turning-movement demands (Exhibit 34-130). The main street runs north-south on separate carriageways;
            the minor street is east-west and its left turns and through movements are rerouted through the U-turn
            crossovers. Equation 23-62 weights each movement by its flow rate rather than its raw demand, which is why
            the published intersection total is 3,500 veh/h while these demands sum to 3,250: dividing each demand by
            the 0.93 peak hour factor and rounding gives 3,497 veh/h of flow.
          </p>
        </div>
      </div>
      <RcutSignalDiagram bind:demands={rcutSignal.demands} dist={rcutSignal.dist} losByMovement={rcutSignalLos} />
      <div class="param-grid">
        {#each OD_TWELVE as od (od.key)}
          <div class="param-field">
            <label for="PC_OD_{od.key}_input">{od.label}</label>
            <div class="cell-field">
              <input
                id="PC_OD_{od.key}_input"
                type="number"
                min="0"
                class="input input-bordered input-sm"
                bind:value={rcutSignal.demands[od.key]}
                required
              />
              <span class="unit">veh/h</span>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Junction Control Delays</h2>
          <p class="panel-sub">
            Control delay at each of the four signalized junctions, from the Chapter 19 analysis of each (Exhibit
            34-132). Each movement's journey sums the one to three junctions it traverses, per the top of Exhibit 23-48.
          </p>
        </div>
      </div>
      {#each RCUTSIGNAL_JUNCTIONS as jn (jn.title)}
        <div class="junction-group">
          <h3 class="junction-title">{jn.title}</h3>
          <div class="param-grid">
            {#each jn.fields as f (f.key)}
              <div class="param-field">
                <label for="PC_DJ_{f.key}_input">{f.label}</label>
                <div class="cell-field">
                  <input
                    id="PC_DJ_{f.key}_input"
                    type="number"
                    step="0.1"
                    min="0"
                    class="input input-bordered input-sm"
                    bind:value={rcutSignal.delays[f.key]}
                    required
                  />
                  <span class="unit">s/veh</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </section>
  {:else if form === 'Mut'}
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Movement Demands</h2>
          <p class="panel-sub">
            Hourly turning-movement demands (Exhibit 34-134 pattern). The major street runs north-south. Left turns are
            rerouted through the main junction, the downstream U-turn crossover, and the main junction again; the extra
            distance travel time from the crossover spacing is applied to each left turn (Equation 23-59).
          </p>
        </div>
      </div>
      <MutDiagram bind:demands={mut.demands} dist={mut.dist} losByMovement={mutLos} />
      <div class="param-grid">
        {#each OD_TWELVE as od (od.key)}
          <div class="param-field">
            <label for="PC_OD_{od.key}_input">{od.label}</label>
            <div class="cell-field">
              <input
                id="PC_OD_{od.key}_input"
                type="number"
                min="0"
                class="input input-bordered input-sm"
                bind:value={mut.demands[od.key]}
                required
              />
              <span class="unit">veh/h</span>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Junction Control Delays</h2>
          <p class="panel-sub">
            Control delay at each component junction, from the Chapter 19 signalized-intersection analysis of the main
            junction and the Chapter 20 analysis of the STOP-controlled crossovers (Exhibit 34-137). Each movement's
            journey sums the junctions it traverses.
          </p>
        </div>
      </div>
      <div class="param-grid">
        {#each MUT_JUNCTIONS as jn (jn.key)}
          <div class="param-field">
            <label for="PC_DJ_{jn.key}_input">{jn.label}</label>
            <div class="cell-field">
              <input
                id="PC_DJ_{jn.key}_input"
                type="number"
                step="0.1"
                min="0"
                class="input input-bordered input-sm"
                bind:value={mut.delays[jn.key]}
                required
              />
              <span class="unit">s/veh</span>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Junction Flows and Control Delays</h2>
          <p class="panel-sub">
            Per Exhibit 34-145: the flow each movement sends through each component intersection and the control delay
            that flow experiences there, from the Chapter 18 and Chapter 19 procedures. Int 1 and Int 3 are the
            supplemental (crossover) intersections, Int 2 the main intersection. Leave cells blank where a movement
            incurs no delay.
          </p>
        </div>
      </div>
      <DltDiagram td={dlt.td} full={dlt.full} offset={dltOffset} los={dltLos} />
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr>
              <th rowspan="2">Movement</th>
              <th colspan="2">Int 1 (West Supplemental)</th>
              <th colspan="2">Int 2 (Main)</th>
              <th colspan="2">Int 3 (East Supplemental)</th>
            </tr>
            <tr>
              <th>Flow (veh/h)</th><th>Delay (s/veh)</th>
              <th>Flow (veh/h)</th><th>Delay (s/veh)</th>
              <th>Flow (veh/h)</th><th>Delay (s/veh)</th>
            </tr>
          </thead>
          <tbody>
            {#each dlt.rows as row, i (row.label)}
              <tr>
                <th>{row.label}</th>
                {#each row.cells as cell, j}
                  <td
                    ><input
                      id="PC_DLT_r{i}_i{j}_flow"
                      aria-label="{row.label} intersection {j + 1} flow"
                      type="number"
                      min="0"
                      class="input input-bordered input-sm"
                      bind:value={cell.flow}
                    /></td
                  >
                  <td
                    ><input
                      id="PC_DLT_r{i}_i{j}_delay"
                      aria-label="{row.label} intersection {j + 1} delay"
                      type="number"
                      step="0.1"
                      min="0"
                      class="input input-bordered input-sm"
                      bind:value={cell.delay}
                    /></td
                  >
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  <div class="action-bar">
    <button class="btn btn-ghost" onclick={resetParams} type="button">Reset Params</button>
    <button class="btn btn-primary" type="submit" disabled={!ready}>Calculate</button>
  </div>
</form>

<section class="panel results-panel">
  <div class="panel-head with-actions">
    <div>
      <h2 class="panel-title">Outputs</h2>
      <p class="panel-sub">Results populate after pressing Calculate.</p>
    </div>
    {#if results}
      <div class="panel-actions">
        <a class="btn btn-outline btn-sm" href="/report">Open printable report</a>
      </div>
    {/if}
  </div>

  {#if results && results.form !== 'Dlt'}
    {#if results.derived}
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr
              ><th>STOP-Controlled Junction</th><th>Flow Rate (veh/h)</th><th>Conflicting Flow (veh/h)</th><th
                >Critical Headway (s)</th
              ><th>Follow-Up Time (s)</th></tr
            >
          </thead>
          <tbody>
            {#each Object.values(results.derived) as j}
              <tr>
                <th>{j.name}</th>
                <td>{j.v}</td>
                <td>{j.vc}</td>
                <td>{j.tc.toFixed(2)}</td>
                <td>{j.tf.toFixed(2)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    <div class="los overflow-x-auto">
      <table class="table w-full">
        <thead>
          <tr>
            <th>Movement</th>
            <th>Flow Rate (veh/h)</th>
            <th>Junction Delays (s/veh)</th>
            <th>Control Delay (s/veh)</th>
            <th>EDTT (s/veh)</th>
            <th>ETT (s/veh)</th>
            <th>LOS</th>
          </tr>
        </thead>
        <tbody>
          {#each results.rows as m (m.label)}
            <tr>
              <th>{m.label}</th>
              <td>{m.demand}</td>
              <td>{m.junction_delays_s.length ? m.junction_delays_s.map((x) => x.toFixed(1)).join(' + ') : '—'}</td>
              <td>{m.total_control_delay_s.toFixed(1)}</td>
              <td>{m.edtt_s.toFixed(1)}</td>
              <td>{m.ett_s.toFixed(1)}</td>
              <td>{m.los}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <table class="table w-full">
        <tbody>
          <tr>
            <th>Intersection Experienced Travel Time (s/veh):</th>
            <td>{Number.isFinite(results.ett) ? results.ett.toFixed(1) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Intersection LOS: {results.los}</p>
      </div>
    </div>
  {:else if results}
    <div class="los overflow-x-auto">
      <table class="table w-full">
        <tbody>
          <tr>
            <th>DLT Roadway Travel Time (Equation 23-63):</th>
            <td>{results.off.tt_dlt_s.toFixed(1)} s</td>
          </tr>
          <tr>
            <th>Adjusted Supplemental-Intersection Offset (Equations 23-66 to 23-68):</th>
            <td>{results.off.offset_supp_s.toFixed(1)} s</td>
          </tr>
          <tr>
            <th>Weighted-Average ETT (Equation 23-69):</th>
            <td>{results.ett.toFixed(1)} s/veh</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>DLT Intersection LOS: {results.los}</p>
      </div>
    </div>
  {:else}
    <div class="los overflow-x-auto">
      <table class="table w-full">
        <tbody>
          <tr><th></th><td></td></tr>
        </tbody>
      </table>
    </div>
  {/if}

  {#if results}
    <Discussion sentences={results.discussion} />
  {/if}
</section>

<style>
  /* The signalized RCUT has four component junctions, so its twelve delay
     inputs are banded by junction rather than left as one long flex row. */
  .junction-group + .junction-group {
    margin-top: 1rem;
  }
  .junction-title {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-faint);
    margin-bottom: 0.5rem;
  }
</style>
