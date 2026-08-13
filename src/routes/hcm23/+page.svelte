<svelte:head>
  <title>Ramp Terminals and Alternative Intersections · HCM Calculator</title>
</svelte:head>

<script>
  import { preventDefault } from 'svelte/legacy';

  import init, { WasmInterchange } from "HCM-middleware";
  import DiamondDiagram from '$lib/DiamondDiagram.svelte';
  import DiamondDiagram3D from '$lib/DiamondDiagram3D.svelte';
  import ParcloDiagram from '$lib/ParcloDiagram.svelte';
  import SpuiDiagram from '$lib/SpuiDiagram.svelte';
  import ViewToggle from '$lib/ViewToggle.svelte';
  import PartCAlternative from '$lib/PartCAlternative.svelte';

  let diagramMode = $state('2d');

  // Which half of Chapter 23 the page analyzes: Part B signalized interchanges
  // or Part C alternative intersections (RCUT, MUT, DLT).
  let part = $state('B');
  import { setReport } from '$lib/report';
  import { onMount } from "svelte";

  let ready = $state(false);

  onMount(async() => {
    await init(); // init initializes memory addresses needed by WASM and that will be used by JS/TS
    ready = true;
  });

  // Interchange form. Diamond defaults follow HCM Chapter 34 Example
  // Problem 1; switching to the DDI loads Example Problem 5 (Exhibits 34-58
  // through 34-65) and to the Parclo A-2Q loads Example Problem 2 (Exhibits
  // 34-17 through 34-29).
  let form = $state('Diamond');
  let ddi_eb_config = $state('ThreeLaneExclusive');
  let ddi_wb_config = $state('TwoLaneShared');

  let cycle_length = $state(160);
  let phf = $state(0.90);
  let base_sat_flow = $state(1900);
  let area_type = $state('other');
  let distance = $state(500);
  let yellow_all_red = $state(5);
  let phv = $state(6.1);
  let ramp_grade = $state(2);
  let extra_dist = $state(100);
  let design_speed = $state(35);
  // Loop-ramp terms, parclo only. Equation 23-50 takes a design speed per
  // diverted movement, and Example Problem 2 mixes two of them: its two loop
  // O-Ds run 1,200 ft at 25 mi/h while the rest of its diverted O-Ds run the
  // interchange spacing at 35.
  let loop_dist = $state(1200);
  let loop_speed = $state(25);

  const defaultOd = () => ([
    { key: 'a', label: 'A · NB off-ramp left (to WB)', value: 210 },
    { key: 'b', label: 'B · NB off-ramp right (to EB)', value: 204 },
    { key: 'c', label: 'C · SB off-ramp right (to WB)', value: 156 },
    { key: 'd', label: 'D · SB off-ramp left (to EB)', value: 185 },
    { key: 'e', label: 'E · EB left to NB on-ramp', value: 96 },
    { key: 'f', label: 'F · EB right to SB on-ramp', value: 80 },
    { key: 'g', label: 'G · WB right to NB on-ramp', value: 135 },
    { key: 'h', label: 'H · WB left to SB on-ramp', value: 212 },
    { key: 'i', label: 'I · EB arterial through', value: 685 },
    { key: 'j', label: 'J · WB arterial through', value: 585 },
    { key: 'k', label: 'K · NB frontage through', value: 0 },
    { key: 'l', label: 'L · SB frontage through', value: 0 },
    { key: 'm', label: 'M · NB freeway U-turn', value: 0 },
    { key: 'n', label: 'N · SB freeway U-turn', value: 0 }
  ]);

  const defaultLaneGroups = () => ([
    { movement: 'EbExtThrough', label: 'EB external through + right', lanes: 2, begin: 0, green: 63, is_ramp: false, turn_radius: null, shared_right_radius: 50, arrival: 3, storage: 600 },
    { movement: 'EbIntThrough', label: 'EB internal through', lanes: 2, begin: 116, green: 97, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 4, storage: 500 },
    { movement: 'EbIntLeft', label: 'EB internal left (to NB on-ramp)', lanes: 1, begin: 116, green: 29, is_ramp: false, turn_radius: 75, shared_right_radius: null, arrival: 4, storage: 200 },
    { movement: 'WbExtThrough', label: 'WB external through + right', lanes: 2, begin: 150, green: 63, is_ramp: false, turn_radius: null, shared_right_radius: 50, arrival: 4, storage: 600 },
    { movement: 'WbIntThrough', label: 'WB internal through', lanes: 2, begin: 0, green: 111, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 4, storage: 500 },
    { movement: 'WbIntLeft', label: 'WB internal left (to SB on-ramp)', lanes: 1, begin: 68, green: 43, is_ramp: false, turn_radius: 75, shared_right_radius: null, arrival: 4, storage: 200 },
    { movement: 'NbRampLeft', label: 'NB off-ramp left', lanes: 1, begin: 58, green: 53, is_ramp: true, turn_radius: 75, shared_right_radius: null, arrival: 3, storage: 400 },
    { movement: 'NbRampRight', label: 'NB off-ramp right', lanes: 1, begin: 58, green: 53, is_ramp: true, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 400 },
    { movement: 'SbRampLeft', label: 'SB off-ramp left', lanes: 1, begin: 116, green: 39, is_ramp: true, turn_radius: 75, shared_right_radius: null, arrival: 3, storage: 400 },
    { movement: 'SbRampRight', label: 'SB off-ramp right', lanes: 1, begin: 116, green: 39, is_ramp: true, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 400 }
  ]);

  const ddiOd = () => ([
    { key: 'a', label: 'A · NB off-ramp left (to WB)', value: 350 },
    { key: 'b', label: 'B · NB off-ramp right (to EB)', value: 200 },
    { key: 'c', label: 'C · SB off-ramp right (to WB)', value: 200 },
    { key: 'd', label: 'D · SB off-ramp left (to EB)', value: 300 },
    { key: 'e', label: 'E · EB left to NB on-ramp', value: 600 },
    { key: 'f', label: 'F · EB right to SB on-ramp', value: 200 },
    { key: 'g', label: 'G · WB right to NB on-ramp', value: 300 },
    { key: 'h', label: 'H · WB left to SB on-ramp', value: 300 },
    { key: 'i', label: 'I · EB arterial through', value: 700 },
    { key: 'j', label: 'J · WB arterial through', value: 150 },
    { key: 'k', label: 'K · NB frontage through', value: 0 },
    { key: 'l', label: 'L · SB frontage through', value: 0 },
    { key: 'm', label: 'M · NB freeway U-turn', value: 0 },
    { key: 'n', label: 'N · SB freeway U-turn', value: 0 }
  ]);

  // Chapter 34 Example Problem 5 lane groups. hv/grade/overlap/dq are carried
  // per row because the DDI example sets them per lane group.
  const ddiLaneGroups = () => ([
    { movement: 'EbExtThrough', label: 'EB external crossover', lanes: 3, begin: 0, green: 35, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 0, dq: 4, speed: 35 },
    { movement: 'EbIntThrough', label: 'EB internal crossover', lanes: 2, begin: 0, green: 35, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 0, dq: null, speed: 35, lu: 1 },
    { movement: 'WbExtThrough', label: 'WB external crossover', lanes: 2, begin: 35, green: 25, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 0, dq: 4, speed: 35 },
    { movement: 'WbIntThrough', label: 'WB internal crossover', lanes: 2, begin: 35, green: 25, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 0, dq: null, speed: 35, lu: 1 },
    { movement: 'NbRampLeft', label: 'NB off-ramp left', lanes: 1, begin: 35, green: 35, is_ramp: true, turn_radius: 150, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 6.5, dq: 4, speed: 35 },
    { movement: 'NbRampRight', label: 'NB off-ramp right', lanes: 1, begin: 0, green: 25, is_ramp: true, turn_radius: 75, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 4.9, dq: null, speed: 35 },
    { movement: 'SbRampLeft', label: 'SB off-ramp left', lanes: 1, begin: 0, green: 25, is_ramp: true, turn_radius: 150, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 6.5, dq: 4, speed: 35 },
    { movement: 'SbRampRight', label: 'SB off-ramp right', lanes: 1, begin: 35, green: 35, is_ramp: true, turn_radius: 75, shared_right_radius: null, arrival: 3, storage: null, hv: 6.1, grade: 0, overlap: 4.9, dq: null, speed: 35 }
  ]);

  // Chapter 34 Example Problem 2, the Parclo A-2Q at I-75 and Newberry Avenue
  // (Exhibit 34-19 demands).
  const parcloOd = () => ([
    { key: 'a', label: 'A · NB off-ramp left (to WB)', value: 218 },
    { key: 'b', label: 'B · NB off-ramp right (to EB)', value: 250 },
    { key: 'c', label: 'C · SB off-ramp right (to WB)', value: 120 },
    { key: 'd', label: 'D · SB off-ramp left (to EB)', value: 275 },
    { key: 'e', label: 'E · EB to NB on-ramp (SE loop)', value: 188 },
    { key: 'f', label: 'F · EB to SB on-ramp (external left)', value: 300 },
    { key: 'g', label: 'G · WB to NB on-ramp (external left)', value: 165 },
    { key: 'h', label: 'H · WB to SB on-ramp (NW loop)', value: 350 },
    { key: 'i', label: 'I · EB arterial through', value: 825 },
    { key: 'j', label: 'J · WB arterial through', value: 837 },
    { key: 'k', label: 'K · NB frontage through', value: 0 },
    { key: 'l', label: 'L · SB frontage through', value: 0 },
    { key: 'm', label: 'M · NB freeway U-turn', value: 0 },
    { key: 'n', label: 'N · SB freeway U-turn', value: 0 }
  ]);

  // Chapter 34 Example Problem 2 lane groups, mirroring
  // transportations-library/tests/ExampleCases/hcm/RampTerminals/case6.json.
  // These are not the diamond skeleton: each arterial direction has an
  // external through, an external left onto the loop quadrant, and an internal
  // shared through-and-right, and neither internal approach has a left turn.
  // Green windows are Exhibit 34-23 with both offsets zero, and the westbound
  // external through is entered as one window wrapping the cycle boundary
  // because it holds NEMA 6 through two consecutive phases of Intersection II
  // (Exhibit 34-24 prints G = 95 s and g' = 94 s, which only that reading
  // gives). lu carries the published Exhibit 34-20 lane utilization factors,
  // su the 3 s start-up lost time the example uses throughout.
  const parcloLaneGroups = () => ([
    { movement: 'EbExtThrough', label: 'EB external through', lanes: 3, begin: 0, green: 90, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: 800, hv: 11.7, grade: 0, lu: 0.7328, su: 3 },
    { movement: 'EbExtLeft', label: 'EB external left (to SB on-ramp)', lanes: 1, begin: 0, green: 25, is_ramp: false, turn_radius: 80, shared_right_radius: null, arrival: 3, storage: 200, hv: 0, grade: 0, su: 3 },
    { movement: 'EbIntThroughRight', label: 'EB internal through + right (to NB loop)', lanes: 3, begin: 70, green: 65, is_ramp: false, turn_radius: null, shared_right_radius: 50, arrival: 4, storage: 800, hv: 11.7, grade: 0, su: 3 },
    { movement: 'WbExtThrough', label: 'WB external through', lanes: 3, begin: 70, green: 95, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: 800, hv: 11.7, grade: 0, lu: 0.6332, su: 3 },
    { movement: 'WbExtLeft', label: 'WB external left (to NB on-ramp)', lanes: 1, begin: 0, green: 25, is_ramp: false, turn_radius: 80, shared_right_radius: null, arrival: 3, storage: 200, hv: 0, grade: 0, su: 3 },
    { movement: 'WbIntThroughRight', label: 'WB internal through + right (to SB loop)', lanes: 3, begin: 30, green: 60, is_ramp: false, turn_radius: null, shared_right_radius: 50, arrival: 4, storage: 800, hv: 11.7, grade: 0, su: 3 },
    { movement: 'NbRampLeft', label: 'NB off-ramp left', lanes: 1, begin: 30, green: 35, is_ramp: true, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 400, hv: 0, grade: 2, su: 3 },
    { movement: 'NbRampRight', label: 'NB off-ramp right', lanes: 1, begin: 30, green: 35, is_ramp: true, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 400, hv: 0, grade: 2, su: 3 },
    { movement: 'SbRampLeft', label: 'SB off-ramp left', lanes: 1, begin: 95, green: 40, is_ramp: true, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 400, hv: 0, grade: 2, su: 3 },
    { movement: 'SbRampRight', label: 'SB off-ramp right', lanes: 1, begin: 95, green: 40, is_ramp: true, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 400, hv: 0, grade: 2, su: 3 }
  ]);

  // Chapter 34 Example Problem 7, the SPUI at I-95 and University Drive
  // (Exhibit 34-72 demands, Exhibit 34-74 after the 0.95 PHF).
  const spuiOd = () => ([
    { key: 'a', label: 'A · NB off-ramp left (to WB)', value: 165 },
    { key: 'b', label: 'B · NB off-ramp right (to EB)', value: 160 },
    { key: 'c', label: 'C · SB off-ramp right (to WB)', value: 120 },
    { key: 'd', label: 'D · SB off-ramp left (to EB)', value: 520 },
    { key: 'e', label: 'E · EB left to NB on-ramp', value: 168 },
    { key: 'f', label: 'F · EB right to SB on-ramp', value: 80 },
    { key: 'g', label: 'G · WB right to NB on-ramp', value: 210 },
    { key: 'h', label: 'H · WB left to SB on-ramp', value: 184 },
    { key: 'i', label: 'I · EB arterial through', value: 865 },
    { key: 'j', label: 'J · WB arterial through', value: 837 },
    { key: 'k', label: 'K · NB frontage through', value: 0 },
    { key: 'l', label: 'L · SB frontage through', value: 0 },
    { key: 'm', label: 'M · NB freeway U-turn', value: 0 },
    { key: 'n', label: 'N · SB freeway U-turn', value: 0 }
  ]);

  // Chapter 34 Example Problem 7 lane groups, mirroring
  // transportations-library/tests/ExampleCases/hcm/RampTerminals/case7.json.
  // Every approach is external, because a SPUI has no internal link: the four
  // ramp approaches and the two arterial approaches all meet at one signal.
  // Green windows are the Exhibit 34-73 three-phase plan, 0-16 for the
  // protected arterial lefts with the ramp rights, 24-56 for the arterial
  // throughs with the permitted arterial lefts, and 64-102 for the ramp lefts
  // with the arterial rights, on a 110 s cycle with 8 s of yellow plus all-red.
  // The two arterial lefts carry `perm`, which is the second green window and
  // the protected-plus-permitted parameters at once, so the phase the engine
  // sees and the phase the left turn is told about cannot drift apart.
  const spuiLaneGroups = () => ([
    { movement: 'EbExtLeft', label: 'EB arterial left (to NB on-ramp)', lanes: 1, begin: 0, green: 16, is_ramp: false, turn_radius: 87, shared_right_radius: null, arrival: 3, storage: 200, hv: 3.4, grade: 2, width: 10.3, perm: { begin: 24, green: 32, gu: 13.01 } },
    { movement: 'EbExtThrough', label: 'EB arterial through', lanes: 2, begin: 24, green: 32, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: 600, hv: 3.4, grade: 2, width: 10.3 },
    { movement: 'EbExtRight', label: 'EB arterial right (to SB on-ramp)', lanes: 1, begin: 64, green: 38, is_ramp: false, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 600, hv: 3.4, grade: 2, width: 10.3 },
    { movement: 'WbExtLeft', label: 'WB arterial left (to SB on-ramp)', lanes: 1, begin: 0, green: 16, is_ramp: false, turn_radius: 87, shared_right_radius: null, arrival: 3, storage: 200, hv: 3.4, grade: 2, width: 10.3, perm: { begin: 24, green: 32, gu: 11.78 } },
    { movement: 'WbExtThrough', label: 'WB arterial through', lanes: 2, begin: 24, green: 32, is_ramp: false, turn_radius: null, shared_right_radius: null, arrival: 3, storage: 600, hv: 3.4, grade: 2, width: 10.3 },
    { movement: 'WbExtRight', label: 'WB arterial right (to NB on-ramp)', lanes: 1, begin: 64, green: 38, is_ramp: false, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 600, hv: 3.4, grade: 2, width: 10.3 },
    { movement: 'NbRampLeft', label: 'NB off-ramp left', lanes: 1, begin: 64, green: 38, is_ramp: true, turn_radius: 87, shared_right_radius: null, arrival: 3, storage: 600, hv: 5, grade: 0, width: 10.3 },
    { movement: 'NbRampRight', label: 'NB off-ramp right', lanes: 1, begin: 0, green: 16, is_ramp: true, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 600, hv: 5, grade: 0, width: 10.3 },
    { movement: 'SbRampLeft', label: 'SB off-ramp left', lanes: 1, begin: 64, green: 38, is_ramp: true, turn_radius: 87, shared_right_radius: null, arrival: 3, storage: 600, hv: 5, grade: 0, width: 10.3 },
    { movement: 'SbRampRight', label: 'SB off-ramp right', lanes: 1, begin: 0, green: 16, is_ramp: true, turn_radius: 50, shared_right_radius: null, arrival: 3, storage: 600, hv: 5, grade: 0, width: 10.3 }
  ]);

  let odDemands = $state(defaultOd());
  let laneGroups = $state(defaultLaneGroups());

  // Switching forms loads that form's published example as the new defaults.
  function applyForm(next) {
    form = next;
    if (form === 'Ddi') {
      odDemands = ddiOd();
      laneGroups = ddiLaneGroups();
      cycle_length = 70;
      phf = 1.0;
      distance = 500;
      extra_dist = 100;
      yellow_all_red = 5;
    } else if (form === 'ParcloA2Q') {
      odDemands = parcloOd();
      laneGroups = parcloLaneGroups();
      cycle_length = 140;
      phf = 0.95;
      distance = 800;
      // The Exhibit 34-29 EDTT column is the interchange spacing on the six
      // diverted O-Ds that stay on the arterial, so the two track together.
      extra_dist = 800;
      loop_dist = 1200;
      loop_speed = 25;
      yellow_all_red = 5;
    } else if (form === 'Spui') {
      odDemands = spuiOd();
      laneGroups = spuiLaneGroups();
      cycle_length = 110;
      phf = 0.95;
      // A SPUI has one signalized point, so there is no second terminal to be
      // spaced from and no path that leaves the arterial and rejoins it. Both
      // are zero rather than small, which is why Exhibit 34-82's ETT column
      // equals its control delay column exactly.
      distance = 0;
      extra_dist = 0;
      yellow_all_red = 8;
    } else {
      odDemands = defaultOd();
      laneGroups = defaultLaneGroups();
      cycle_length = 160;
      phf = 0.90;
      distance = 500;
      extra_dist = 100;
      yellow_all_red = 5;
    }
    results = null;
  }

  let hasPermitted = $derived(laneGroups.some((g) => g.perm));

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  // Per-O-D LOS map for the diagram animation.
  let losByOd = $derived(results
    ? Object.fromEntries(results.od_results.filter((o) => o.los).map((o) => [o.movement, o.los]))
    : {});

  // Extra travel distances per O-D letter A..N (Exhibit 23-8 sign convention:
  // positive for left turns, negative for right turns), as the Equation 23-50
  // input objects.
  function extraDistances() {
    const dt = Number(extra_dist);
    if (form === 'ParcloA2Q') {
      // Every parclo A-2Q O-D except the two arterial throughs is diverted, so
      // all eight carry the 5 s deceleration/acceleration term except the two
      // off-ramp rights, which are the only movements that shorten their path.
      // O-Ds E and H run the loop, at their own design speed.
      const loop = { distance_ft: Number(loop_dist), accel_decel_s: 5.0, design_speed_mph: Number(loop_speed) };
      const div = (sign, a) => ({ distance_ft: sign * dt, accel_decel_s: a });
      const nil = { distance_ft: 0.0, accel_decel_s: 0.0 };
      return [
        div(1, 5), div(-1, 0), div(-1, 0), div(1, 5),
        loop, div(1, 5), div(1, 5), loop,
        nil, nil, nil, nil, nil, nil,
      ];
    }
    // The SPUI takes the same left-positive / right-negative convention as the
    // diamond and needs no branch of its own, because Example Problem 7 sets
    // the extra distance to zero: one signalized point means no O-D leaves the
    // arterial and rejoins it, which is why Exhibit 34-82's ETT column equals
    // its control delay column.
    const signed = form === 'Ddi'
      ? [dt, -dt, -dt, dt, dt, 0, 0, dt, 40, 40, 0, 0, 0, 0]
      : [dt, -dt, -dt, dt, dt, -dt, -dt, dt, 0, 0, 0, 0, 0, 0];
    return signed.map((d) => ({ distance_ft: d, accel_decel_s: 0.0 }));
  }

  // Which O-D through movement opposes each protected-plus-permitted left.
  const OPPOSING_OD = { EbExtLeft: 'j', WbExtLeft: 'i' };

  function buildConfig() {
    const od = {};
    for (const d of odDemands) {
      od[d.key] = Number(d.value);
    }

    return {
      form,
      cycle_length_s: Number(cycle_length),
      analysis_period_h: 0.25,
      base_saturation_flow: Number(base_sat_flow),
      area_type_cbd: area_type === 'cbd',
      peak_hour_factor: Number(phf),
      distance_between_intersections_ft: Number(distance),
      queue_spacing_ft: 25.0,
      od,
      // Only the conventional diamond shares its external right turn with the
      // external through group. The DDI carries it on a free-flow bypass, and
      // in a parclo A-2Q the movement is not a right turn at all: it is the
      // external left onto the loop quadrant, which has its own lane group.
      eb_external_right_shared: form === 'Diamond',
      wb_external_right_shared: form === 'Diamond',
      ddi_eb_lane_config: form === 'Ddi' ? ddi_eb_config : null,
      ddi_wb_lane_config: form === 'Ddi' ? ddi_wb_config : null,
      extra_distances: extraDistances(),
      extra_distance_speed_mph: Number(design_speed),
      lane_groups: laneGroups.map((g) => ({
        movement: g.movement,
        lanes: Number(g.lanes),
        // A protected-plus-permitted left turn is one lane group running in two
        // phases, so its second green window and its permitted-phase parameters
        // come from the same `perm` object.
        greens: g.perm
          ? [
              { begin_s: Number(g.begin), duration_s: Number(g.green) },
              { begin_s: Number(g.perm.begin), duration_s: Number(g.perm.green) }
            ]
          : [{ begin_s: Number(g.begin), duration_s: Number(g.green) }],
        ...(g.perm ? { protected_permitted_left: {
          permitted_green_s: Number(g.perm.green),
          unblocked_green_s: Number(g.perm.gu),
          // The opposing flow of an arterial left at a single point is the
          // other direction's through movement, the only movement running with
          // the permitted phase (Exhibit 34-73 phase 2). Derived rather than
          // typed in, so editing a through demand cannot leave it stale.
          opposing_flow_veh_h: Number(od[OPPOSING_OD[g.movement]] ?? 0) / Number(phf)
        } } : {}),
        yellow_all_red_s: Number(yellow_all_red),
        control: 'Signalized',
        turn_radius_ft: g.turn_radius,
        shared_right_turn_radius_ft: g.shared_right_radius,
        pct_heavy_vehicles: g.hv ?? (g.is_ramp ? 0.0 : Number(phv)),
        grade_pct: g.grade ?? (g.is_ramp ? Number(ramp_grade) : 0.0),
        lane_width_ft: g.width ?? 12.0,
        parking_maneuvers_h: null,
        bus_stops_h: 0.0,
        arrival_type: g.arrival,
        storage_ft: g.storage,
        lane_utilization_override: g.lu ?? null,
        downstream_queue_lost_time_s: g.dq ?? null,
        overlap_lost_time_s: g.overlap ?? 0.0,
        start_up_lost_time_s: g.su ?? 2.0,
        extension_of_green_s: 2.0,
        upstream_filtering_override: null,
        speed_limit_mph: g.speed ?? 40.0,
        initial_queue_veh: 0.0,
        demand_override_veh_h: null
      }))
    };
  }

  function runAnalysis() {
    hasError = false;
    results = null;

    try {
      const ix = new WasmInterchange(buildConfig());
      ix.analyze();
      results = {
        ett: ix.get_interchange_ett_s(),
        los: ix.get_interchange_los(),
        od_results: ix.od_results_to_js_value()
      };

      setReport({
        chapter: 'Ramp Terminals and Alternative Intersections',
        chapterRef: 'HCM Chapter 23',
        href: '/hcm23',
        generatedAt: new Date().toLocaleString(),
        headline: { label: 'Interchange LOS', value: results.los },
        inputs: [
          { label: 'Interchange form', value: form === 'Ddi' ? 'Diverging diamond (DDI), pretimed signals' : form === 'ParcloA2Q' ? 'Partial cloverleaf A-2Q, pretimed signals' : form === 'Spui' ? 'Single-point urban interchange (SPUI), pretimed signals' : 'Conventional diamond, pretimed signals' },
          { label: 'Cycle length', value: `${cycle_length} s` },
          { label: 'Distance between terminals', value: form === 'Spui' ? 'one signalized point' : `${distance} ft` },
          { label: 'Peak hour factor', value: phf },
          { label: 'Heavy vehicles (arterial)', value: `${phv} %` },
          { label: 'Ramp grade', value: `${ramp_grade} %` },
          { label: 'O-D demands (A-N)', value: odDemands.map((d) => `${d.key.toUpperCase()} ${d.value}`).join(', ') + ' veh/h' },
        ],
        resultTable: {
          columns: ['O-D', 'Demand (veh/h)', 'Control delay (s/veh)', 'EDTT (s/veh)', 'ETT (s/veh)', 'LOS'],
          rows: results.od_results.map((o) => [
            o.movement, o.demand.toFixed(0), o.control_delay_s.toFixed(1), o.edtt_s.toFixed(1), o.ett_s.toFixed(1), o.los ?? '',
          ]),
        },
        summary: [
          { label: 'Interchange ETT (demand-weighted)', value: `${results.ett.toFixed(1)} s/veh` },
          { label: 'Interchange LOS (Exhibit 23-10)', value: results.los },
        ],
        methodology: [
          'HCM Chapter 23 Part B interchange methodology: lane-group analysis per Chapter 19 at both ramp terminals, extra distance travel time by O-D (Exhibit 23-8 sign convention), experienced travel time per O-D (Equation 23-1), and interchange LOS from the demand-weighted ETT (Exhibit 23-10).',
        ],
      });
    } catch (err) {
      console.error('Chapter 23 analysis failed:', err);
      hasError = true;
      errMessage = 'The analysis could not be completed with the given inputs. Check the values and try again.';
    }
  }

  function resetParams() {
    // Reload the current form's published-example defaults plus the shared
    // site parameters.
    base_sat_flow = 1900;
    area_type = 'other';
    yellow_all_red = 5;
    phv = 6.1;
    ramp_grade = 2;
    extra_dist = 100;
    design_speed = 35;
    hasError = false;
    applyForm(form);
  }
</script>

<div class="hcm-page">
  <header class="page-header">
    <span class="badge badge-outline page-badge">HCM Chapter 23</span>
    <h1 class="page-title">Ramp Terminals and Alternative Intersections</h1>
    <p class="page-sub">
      Estimate experienced travel time and level of service by origin-destination
      movement and for the facility as a whole, for signalized diamond
      interchanges (Part B) and for RCUT, MUT, and DLT alternative
      intersections (Part C).
    </p>
  </header>

  <div class="alert alert-info shadow-sm mb-6 beta-note" role="note">
    <span>
      The compute engine reproduces the published HCM Chapter 34 example
      problems within the library's documented tolerances: the conventional
      diamond, the diverging diamond, the Parclo A-2Q, and the single-point
      urban interchange with pretimed signals under Part B, and the
      STOP-controlled RCUT, the MUT, and the DLT evaluations under Part C. The
      other five partial cloverleaf forms of Exhibit 23-17 (A-4Q, AB-2Q, AB-4Q,
      B-2Q, B-4Q) are supported by the engine but have no published example
      problem behind them, so they are not offered here.
      Verify results
      independently before relying on them in engineering work, and please <a href="https://github.com/crosstraffic/cross-traffic-web-calculator/issues" target="_blank" rel="noreferrer">report discrepancies on GitHub</a>.
    </span>
  </div>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Analysis Part</h2>
        <p class="panel-sub">Part B evaluates signalized interchange ramp terminals. Part C evaluates alternative intersections: the restricted crossing U-turn, median U-turn, and displaced left-turn.</p>
      </div>
    </div>
    <div class="param-grid">
      <div class="param-field">
        <label for="PART_input">Chapter 23 Part</label>
        <select id="PART_input" class="select select-bordered select-sm" bind:value={part}>
          <option value="B">Part B · Interchange ramp terminals</option>
          <option value="C">Part C · Alternative intersections</option>
        </select>
      </div>
    </div>
  </section>

  {#if part === 'C'}
    <PartCAlternative {ready} />
  {:else}

  {#if hasError}
    <div class="alert alert-error shadow-sm mb-6">
      <span>{errMessage}</span>
    </div>
  {/if}

  {#if form === 'Spui'}
    <div class="alert alert-info shadow-sm mb-6 spui-note" role="note">
      <span>
        Defaults are HCM Chapter 34, Example Problem 7, the SPUI at I-95 and
        University Drive (Exhibits 34-72 through 34-80). It is the one worked
        example on this page whose saturation flow worksheets were carried over
        from a superseded edition, and seven documented defects follow from
        that. Exhibits 34-75 and 34-76 print a lane width factor of 0.967 for
        the stated 10.3 ft lanes, which is the HCM 2000 continuous form and
        which HCM 7 Exhibit 19-20 cannot produce for any width from 10.0 to
        12.9 ft; Exhibit 34-76 then prints a heavy vehicle and grade factor of
        1.000 on the two ramp approaches where the example's own 5% heavy
        vehicles give 0.961; the traffic pressure row reproduces Equation 23-15
        exactly for the eight columns that are not a left-turn phase component
        and for none of the four that are, and it prints different values for
        the protected and permitted halves of a single movement at a single
        demand, which the equation cannot do. Exhibit 34-77 then contradicts
        itself three ways: its own g<sub>u</sub> = G<sub>perm</sub> − g<sub>q</sub> − l<sub>1</sub>
        relation closes eastbound and misses westbound by 1.8 s, it prints a
        westbound uniform delay of 22.7 s/veh where Exhibit 34-80's own sum
        needs 22.8, and it labels its queue breakpoints in feet where Chapter
        31 defines every one of them in vehicles. Exhibit 34-78 finally omits
        the Equation 31-124 sneaker term from the left-turn capacity, worth
        about 65 veh/h, which the engine omits too because Chapter 34 does.
        Eight of the ten published O-D LOS letters and the interchange LOS
        still reproduce. The two that differ, D and E, are the two sitting
        closest to an Exhibit 23-10 band edge.
      </span>
    </div>
  {/if}

  <form id="hcm23" onsubmit={preventDefault(runAnalysis)}>
    <!-- Configuration -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Interchange Configuration</h2>
          <p class="panel-sub">Signal timing and geometry shared by both ramp terminal intersections. The arterial runs east-west, with the southbound ramps at the west intersection and the northbound ramps at the east intersection.</p>
        </div>
      </div>
      <div class="param-grid">
        <div class="param-field">
          <label for="FORM_input">Interchange Form</label>
          <select id="FORM_input" class="select select-bordered select-sm" value={form} onchange={(e) => applyForm(e.target.value)}>
            <option value="Diamond">Conventional diamond</option>
            <option value="Ddi">Diverging diamond (DDI)</option>
            <option value="ParcloA2Q">Parclo A-2Q</option>
            <option value="Spui">Single-point urban (SPUI)</option>
          </select>
          <p class="param-hint">Switching loads that form's published example as defaults.</p>
        </div>

        {#if form === 'ParcloA2Q'}
          <div class="param-field">
            <label for="LOOPD_input">Loop Ramp Extra Distance</label>
            <div class="cell-field">
              <input id="LOOPD_input" type="number" min="0" class="input input-bordered input-sm" bind:value={loop_dist} placeholder="1200" required />
              <span class="unit">ft</span>
            </div>
            <p class="param-hint">Applied to O-Ds E and H, the two movements that leave on a loop.</p>
          </div>
          <div class="param-field">
            <label for="LOOPS_input">Loop Ramp Design Speed</label>
            <div class="cell-field">
              <input id="LOOPS_input" type="number" min="5" class="input input-bordered input-sm" bind:value={loop_speed} placeholder="25" required />
              <span class="unit">mph</span>
            </div>
            <p class="param-hint">Equation 23-50 takes a design speed per diverted movement, so the loops need not match the rest.</p>
          </div>
        {/if}

        {#if form === 'Ddi'}
          <div class="param-field">
            <label for="DDIEB_input">EB Crossover Lane Configuration</label>
            <select id="DDIEB_input" class="select select-bordered select-sm" bind:value={ddi_eb_config}>
              <option value="TwoLaneShared">2 lanes, shared left</option>
              <option value="ThreeLaneShared">3 lanes, shared left</option>
              <option value="ThreeLaneExclusive">3 lanes, exclusive left</option>
              <option value="ThreeLaneExclusiveMiddleShared">3 lanes, exclusive left + middle shared</option>
            </select>
          </div>
          <div class="param-field">
            <label for="DDIWB_input">WB Crossover Lane Configuration</label>
            <select id="DDIWB_input" class="select select-bordered select-sm" bind:value={ddi_wb_config}>
              <option value="TwoLaneShared">2 lanes, shared left</option>
              <option value="ThreeLaneShared">3 lanes, shared left</option>
              <option value="ThreeLaneExclusive">3 lanes, exclusive left</option>
              <option value="ThreeLaneExclusiveMiddleShared">3 lanes, exclusive left + middle shared</option>
            </select>
          </div>
        {/if}

        <div class="param-field">
          <label for="CYCLE_input">Cycle Length</label>
          <div class="cell-field">
            <input id="CYCLE_input" type="number" min="40" max="300" class="input input-bordered input-sm" bind:value={cycle_length} placeholder="160" required />
            <span class="unit">s</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PHF_input">Peak Hour Factor</label>
          <div class="cell-field">
            <input id="PHF_input" type="number" step="0.01" min="0.25" max="1" class="input input-bordered input-sm" bind:value={phf} placeholder="0.90" required />
          </div>
        </div>

        <!-- A SPUI has one signalized point, so there is no spacing to enter.
             The field is withheld rather than shown at zero, because its
             min="100" would otherwise block the form from submitting at all
             and Calculate would silently do nothing. -->
        {#if form !== 'Spui'}
          <div class="param-field">
            <label for="DIST_input">Intersection Spacing</label>
            <div class="cell-field">
              <input id="DIST_input" type="number" min="100" class="input input-bordered input-sm" bind:value={distance} placeholder="500" required />
              <span class="unit">ft</span>
            </div>
          </div>
        {/if}

        <div class="param-field">
          <label for="SAT_input">Base Saturation Flow</label>
          <div class="cell-field">
            <input id="SAT_input" type="number" min="1000" max="2200" class="input input-bordered input-sm" bind:value={base_sat_flow} placeholder="1900" required />
            <span class="unit">pc/h/ln</span>
          </div>
        </div>

        <div class="param-field">
          <label for="AREA_input">Area Type</label>
          <select id="AREA_input" class="select select-bordered select-sm" bind:value={area_type}>
            <option value="other">Non-CBD</option>
            <option value="cbd">Central Business District</option>
          </select>
        </div>

        <div class="param-field">
          <label for="YAR_input">Yellow + All-Red Interval</label>
          <div class="cell-field">
            <input id="YAR_input" type="number" step="0.1" min="3" max="8" class="input input-bordered input-sm" bind:value={yellow_all_red} placeholder="5" required />
            <span class="unit">s</span>
          </div>
        </div>

        <div class="param-field">
          <label for="PHV_input">Heavy Vehicles (arterial)</label>
          <div class="cell-field">
            <input id="PHV_input" type="number" step="0.01" min="0" max="100" class="input input-bordered input-sm" bind:value={phv} placeholder="6.1" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="GRADE_input">Ramp Grade</label>
          <div class="cell-field">
            <input id="GRADE_input" type="number" step="0.1" class="input input-bordered input-sm" bind:value={ramp_grade} placeholder="2" required />
            <span class="unit">%</span>
          </div>
        </div>

        <div class="param-field">
          <label for="XDIST_input">Extra Ramp Travel Distance</label>
          <div class="cell-field">
            <input id="XDIST_input" type="number" min="0" class="input input-bordered input-sm" bind:value={extra_dist} placeholder="100" required />
            <span class="unit">ft</span>
          </div>
          <p class="param-hint">Applied with a positive sign to left turns and a negative sign to right turns.</p>
        </div>

        <div class="param-field">
          <label for="SPEED_input">Diverted-Path Design Speed</label>
          <div class="cell-field">
            <input id="SPEED_input" type="number" min="10" class="input input-bordered input-sm" bind:value={design_speed} placeholder="35" required />
            <span class="unit">mph</span>
          </div>
        </div>
      </div>
    </section>

    <!-- O-D Demands -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Interchange</h2>
          <p class="panel-sub">O-D movements per Exhibit 23-8. Hover the legend to isolate a group; demands are editable on the 2D picture, and the traffic animation slows per O-D LOS after a run.</p>
        </div>
        {#if form !== 'ParcloA2Q' && form !== 'Spui'}
          <div class="panel-actions">
            <ViewToggle bind:mode={diagramMode} label="Interchange view mode" />
          </div>
        {/if}
      </div>
      {#if form === 'Spui'}
        <!-- Plan view only. What distinguishes a SPUI from every other form on
             this page is that its four left turns cross one another inside a
             single junction, and that crossing is a planar fact: in the shared
             Camera3DSvg projection the four paths meet at the vanishing centre
             of the deck and foreshorten into each other exactly where they
             need to be legible. Elevation would hide the one thing the picture
             exists to show, so it is not offered. -->
        <SpuiDiagram bind:odDemands odLos={losByOd} {laneGroups} cycleLength={cycle_length} />
      {:else if form === 'ParcloA2Q'}
        <!-- The parclo has a plan view only. Its ramps leave the arterial in
             two quadrants and return to the freeway on structure, which the
             shared Camera3DSvg projection has no way to show without a
             second deck, so offering a 3D toggle here would promise a view
             that does not exist. -->
        <ParcloDiagram bind:odDemands odLos={losByOd} spacingFt={distance} loopDist={loop_dist} loopSpeed={loop_speed} />
      {:else if diagramMode === '3d'}
        <DiamondDiagram3D {odDemands} odLos={losByOd} {form} ddiEb={ddi_eb_config} ddiWb={ddi_wb_config} />
      {:else}
        <DiamondDiagram bind:odDemands odLos={losByOd} {form} ddiEb={ddi_eb_config} ddiWb={ddi_wb_config} />
      {/if}
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Origin-Destination Demands</h2>
          <p class="panel-sub">Hourly demand volumes for the fourteen O-D movements of HCM Exhibit 23-20. Frontage-road and U-turn movements are usually 0.</p>
        </div>
      </div>
      <div class="param-grid">
        {#each odDemands as od (od.key)}
          <div class="param-field">
            <label for="OD_{od.key}_input">{od.label}</label>
            <div class="cell-field">
              <input id="OD_{od.key}_input" type="number" min="0" class="input input-bordered input-sm" bind:value={od.value} required />
              <span class="unit">veh/h</span>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <!-- Lane Groups -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Lane Groups and Green Times</h2>
          <p class="panel-sub">Lanes and displayed green interval for each interchange lane group. Green begin times are measured from the start of the common cycle and may wrap past the end of the cycle.{hasPermitted ? ' The two arterial left turns run twice per cycle, protected in the first green window and permitted in the second, so they carry a second window and the part of it the opposing queue leaves unblocked.' : ''}</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Lane Group</th>
              <th>Lanes</th>
              <th>Green Begin (s)</th>
              <th>Green Duration (s)</th>
              {#if hasPermitted}
                <th>Permitted Begin (s)</th>
                <th>Permitted Green (s)</th>
                <th>Unblocked g<sub>u</sub> (s)</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each laneGroups as g (g.movement)}
              <tr>
                <th>{g.label}</th>
                <td>
                  <input id="LG_{g.movement}_lanes" aria-label="{g.label} lanes" type="number" min="1" max="4" class="input input-bordered input-sm" bind:value={g.lanes} required />
                </td>
                <td>
                  <input id="LG_{g.movement}_begin" aria-label="{g.label} green begin" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={g.begin} required />
                </td>
                <td>
                  <input id="LG_{g.movement}_green" aria-label="{g.label} green duration" type="number" step="0.1" min="1" class="input input-bordered input-sm" bind:value={g.green} required />
                </td>
                {#if hasPermitted}
                  {#if g.perm}
                    <td>
                      <input id="LG_{g.movement}_permbegin" aria-label="{g.label} permitted green begin" type="number" step="0.1" min="0" class="input input-bordered input-sm" bind:value={g.perm.begin} required />
                    </td>
                    <td>
                      <input id="LG_{g.movement}_permgreen" aria-label="{g.label} permitted green duration" type="number" step="0.1" min="1" class="input input-bordered input-sm" bind:value={g.perm.green} required />
                    </td>
                    <td>
                      <input id="LG_{g.movement}_gu" aria-label="{g.label} unblocked permitted green" type="number" step="0.01" min="0" class="input input-bordered input-sm" bind:value={g.perm.gu} required />
                    </td>
                  {:else}
                    <td>—</td><td>—</td><td>—</td>
                  {/if}
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if hasPermitted}
        <p class="panel-sub">g<sub>u</sub> is the part of the permitted green the opposing queue leaves unblocked (Equation 31-95), carried as an input because Exhibit 34-77 publishes it directly and its own g<sub>q</sub> row does not reproduce it westbound. The opposing flow follows the other direction's through demand, so it is not entered separately.</p>
      {/if}
    </section>

    <!-- Form Actions -->
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
    <div class="los overflow-x-auto">
      <table class="table w-full">
        <thead>
          <tr>
            <th>O-D Movement</th>
            <th>Demand (veh/h)</th>
            <th>Control Delay (s/veh)</th>
            <th>EDTT (s/veh)</th>
            <th>ETT (s/veh)</th>
            <th>LOS</th>
          </tr>
        </thead>
        <tbody>
          {#if results}
            {#each results.od_results as od}
              <tr>
                <th>{od.movement}</th>
                <td>{od.demand.toFixed(0)}</td>
                <td>{od.control_delay_s.toFixed(1)}</td>
                <td>{od.edtt_s.toFixed(1)}</td>
                <td>{od.ett_s.toFixed(1)}</td>
                <td>{od.los}</td>
              </tr>
            {/each}
          {:else}
            <tr>
              <th></th><td></td><td></td><td></td><td></td><td></td>
            </tr>
          {/if}
        </tbody>
      </table>
      <table class="table w-full">
        <tbody>
          <tr>
            <th>Interchange Experienced Travel Time (s/veh):</th>
            <td>{results && Number.isFinite(results.ett) ? results.ett.toFixed(1) : ''}</td>
          </tr>
        </tbody>
      </table>
      <div class="facility-summary">
        <p>Interchange LOS: {results ? results.los : ''}</p>
      </div>
    </div>
  </section>

  {/if}
</div>
