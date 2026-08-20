// HCM Chapter 35, Example Problems 1 and 2 (Chapter 24 methods) through the
// WASM boundary. Expected values and tolerances mirror
// transportations-library/tests/chapter24_integration.rs.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

// Example Problem 1, part 1: pedestrian LOS on the shared-use path.
const c1 = loadCase('OffStreetPedBike', 'case1.json');
const sp = c1.shared_use_path;
const shared = new m.WasmSharedUsePathPedestrian(
  sp.bicycle_demand_same_direction,
  sp.bicycle_demand_opposing,
  sp.phf,
  sp.pedestrian_speed,
  sp.bicycle_speed,
  sp.is_one_way,
);
exact(shared.analyze(), c1.expected.shared_use_path_pedestrian_los, 'EP1 shared-use path LOS');
approx(shared.get_passing_events(), c1.expected.passing_events_per_hour, 0.5, 'EP1 passing events');
approx(shared.get_meeting_events(), c1.expected.meeting_events_per_hour, 0.5, 'EP1 meeting events');
approx(shared.get_total_events(), c1.expected.total_events_per_hour, 0.5, 'EP1 total events');

// Example Problem 1, part 2: pedestrian LOS on the exclusive path.
// Fixture pedestrian_speed is in ft/min for the exclusive-path method.
const ep = c1.exclusive_path;
const excl = new m.WasmExclusivePedestrianFacility(
  ep.total_walkway_width,
  ep.fixed_object_width,
  undefined,
  ep.peak_15min_volume,
  ep.phf,
  ep.pedestrian_speed,
  ep.facility_type.toLowerCase(),
  ep.flow_type.toLowerCase(),
);
exact(excl.analyze(), c1.expected.exclusive_path_pedestrian_los, 'EP1 exclusive path LOS');
approx(excl.get_effective_width(), c1.expected.effective_width_ft, 1e-9, 'EP1 effective width');
approx(excl.get_unit_flow_rate(), c1.expected.unit_flow_rate_p_ft_min, 0.005, 'EP1 unit flow rate');
approx(excl.get_pedestrian_space(), c1.expected.pedestrian_space_ft2_p, 0.5, 'EP1 pedestrian space');

// Example Problem 2: bicycle LOS on the shared-use path.
const c2 = loadCase('OffStreetPedBike', 'case2.json');
const bf = c2.bicycle_facility;
const splits = bf.user_groups.map((g) => g.mode_split);
const speeds = bf.user_groups.map((g) => g.average_speed);
const sds = bf.user_groups.map((g) => g.speed_standard_deviation);
const bike = new m.WasmOffStreetBicycleFacility(
  bf.path_width,
  bf.segment_length,
  bf.has_centerline,
  bf.two_way_demand,
  bf.directional_split,
  bf.phf,
  bf.is_one_way,
  false,
  splits,
  speeds,
  sds,
);
exact(bike.analyze(), c2.expected.bicycle_los, 'EP2 bicycle LOS');
approx(bike.get_active_passings_per_minute(), c2.expected.active_passings_per_minute, 0.01, 'EP2 active passings');
approx(bike.get_meetings_per_minute(), c2.expected.meetings_per_minute, 0.03, 'EP2 meetings');
exact(bike.get_effective_lanes(), c2.expected.effective_lanes, 'EP2 effective lanes');
approx(bike.get_probability_delayed_passing(), c2.expected.total_probability_delayed_passing, 0.002, 'EP2 P_Tds');
approx(bike.get_delayed_passings_per_minute(), c2.expected.delayed_passings_per_minute, 0.01, 'EP2 delayed passings');
approx(bike.get_blos_score(), c2.expected.blos_score, 0.01, 'EP2 BLOS score');

report('ch24 off-street ped/bike (HCM Ch.35 EP1-EP2)');
