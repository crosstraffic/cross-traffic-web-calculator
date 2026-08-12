/* tslint:disable */
/* eslint-disable */
/**
* HCM Equation 23-58: extra distance travel time for a rerouted movement
* at an RCUT with merges, s/veh.
*
* * `dist_to_crossover_ft` / `dist_from_crossover_ft` — distances D_t and
*   D_f between the main junction and the U-turn crossover, ft.
* * `free_flow_speed_mph` — major-street free-flow speed S_f, mi/h.
* * `accel_decel_s` — deceleration/acceleration term `a`, s: 10 for a
*   minor-street left turn, 15 for a minor-street through movement.
* @param {number} dist_to_crossover_ft
* @param {number} dist_from_crossover_ft
* @param {number} free_flow_speed_mph
* @param {number} accel_decel_s
* @returns {number}
*/
export function edtt_merge(dist_to_crossover_ft: number, dist_from_crossover_ft: number, free_flow_speed_mph: number, accel_decel_s: number): number;
/**
* HCM Equation 23-59: extra distance travel time for a rerouted movement
* at an RCUT or MUT with STOP signs or signals, s/veh. No acceleration/
* deceleration term, because that delay is already captured by the STOP or
* signal control-delay computation.
* @param {number} dist_to_crossover_ft
* @param {number} dist_from_crossover_ft
* @param {number} free_flow_speed_mph
* @returns {number}
*/
export function edtt_stop_or_signal(dist_to_crossover_ft: number, dist_from_crossover_ft: number, free_flow_speed_mph: number): number;
/**
* HCM Exhibit 23-52: saturation flow rate adjustment factor for a
* signalized MUT/RCUT U-turn crossover, by median width (0.80 below 35 ft,
* 0.85 through 80 ft, 0.95 above).
* @param {number} median_width_ft
* @returns {number}
*/
export function uturn_saturation_adjustment(median_width_ft: number): number;
/**
* Evaluate a STOP-controlled junction movement with the Chapter 20
* gap-acceptance capacity (Equation 20-18) and control delay (Equation
* 20-61). Returns `{ capacity_veh_h, vc_ratio, control_delay_s,
* queue_95_veh }`. The default U-turn crossover headways are t_c = 4.4 s
* and t_f = 2.6 s (Part C Step 5).
* @param {number} flow_veh_h
* @param {number} conflicting_flow_veh_h
* @param {number} critical_headway_s
* @param {number} followup_headway_s
* @param {number} analysis_period_h
* @returns {any}
*/
export function stop_junction_delay(flow_veh_h: number, conflicting_flow_veh_h: number, critical_headway_s: number, followup_headway_s: number, analysis_period_h: number): any;
/**
* HCM Equations 23-63 through 23-68: the DLT supplemental-intersection
* offset so displaced left-turn vehicles arrive during the guaranteed
* green window at the main intersection. Returns `{ tt_dlt_s, st_dlt_s,
* st_th_s, offset_supp_s }` with the adjusted offset wrapped into
* `[0, C)`.
*
* * `td_dlt_ft` — displaced left-turn roadway travel distance TD_DLT, ft.
* * `sf_dlt_mph` — displaced left-turn roadway free-flow speed, mi/h.
* * `lag_dlt_s` / `lag_th_s` — durations from the reference point to the
*   start of the DLT phase (supplemental) and the major-street through
*   phase (main), s.
* * `offset_supp_s` / `offset_main_s` — initial offsets, s.
* * `cycle_s` — background cycle length C, s.
* @param {number} td_dlt_ft
* @param {number} sf_dlt_mph
* @param {number} lag_dlt_s
* @param {number} lag_th_s
* @param {number} offset_supp_s
* @param {number} offset_main_s
* @param {number} cycle_s
* @returns {any}
*/
export function dlt_offset(td_dlt_ft: number, sf_dlt_mph: number, lag_dlt_s: number, lag_th_s: number, offset_supp_s: number, offset_main_s: number, cycle_s: number): any;
/**
*/
export class WasmAlternativeIntersection {
  free(): void;
/**
* Build an RCUT or MUT alternative-intersection analysis (HCM Ch.23
* Part C, Exhibit 23-47 Steps 6-10) from a configuration object
* matching the serde schema of
* `hcm::chapter23::alternative_intersections::AlternativeIntersection`:
*
* ```json
* {
*   "form": "RcutFourLeg",
*   "movements": [
*     {
*       "label": "NB L",
*       "approach": "Nb",
*       "demand_veh_h": 167.0,
*       "edtt_s": 15.9,
*       "junctions": [
*         { "type": "stop", "flow_veh_h": 167.0,
*           "conflicting_flow_veh_h": 1189.0,
*           "critical_headway_s": 4.4, "followup_headway_s": 2.6 },
*         { "type": "provided", "control_delay_s": 20.2 },
*         { "type": "merge" }
*       ]
*     }
*   ]
* }
* ```
*
* `form` is one of `RcutFourLeg` / `RcutThreeLeg` / `MutFourLeg` /
* `MutThreeLeg`. Each movement lists the junctions of its journey in
* traversal order (Exhibits 23-48 through 23-50): `provided` carries a
* Chapter 19 signalized control delay (optional `vc_gt_1` / `rq_gt_1`
* flags force LOS F), `stop` is evaluated here with the Chapter 20
* gap-acceptance procedure (optional `storage_ft` / `queue_spacing_ft`
* for the queue-storage check), and `merge` is a zero-delay free-flow
* merge. `edtt_s` is the Step 7 extra distance travel time (compute it
* with [`edtt_merge`] or [`edtt_stop_or_signal`]); `analysis_period_h`
* defaults to 0.25.
* @param {any} config
*/
  constructor(config: any);
/**
* Per-movement results as a JS array (label, per-junction control
* delays in journey order, total control delay, EDTT, ETT per Equation
* 23-60, v/c and queue-storage flags, LOS per Exhibit 23-13).
* @returns {any}
*/
  movement_results_to_js_value(): any;
/**
* Demand-weighted approach experienced travel time ETT_A, s/veh (HCM
* Equation 23-61). `approach` is "EB", "WB", "NB", or "SB" (case-
* insensitive). `undefined` when the approach carries no demand.
* @param {string} approach
* @returns {number | undefined}
*/
  get_approach_ett_s(approach: string): number | undefined;
/**
* Demand-weighted intersection experienced travel time ETT_I, s/veh
* (HCM Equation 23-62). `undefined` when no movement carries demand.
* @returns {number | undefined}
*/
  get_intersection_ett_s(): number | undefined;
/**
* Intersection LOS letter from Exhibit 23-13 applied to ETT_I, e.g.
* "C". Per-movement LOS F forcing (v/c > 1 or queue storage exceeded)
* is reported in the movement results, not here.
* @returns {string | undefined}
*/
  get_intersection_los(): string | undefined;
}
/**
*/
export class WasmAwsc {
  free(): void;
/**
* Lane volumes are flat arrays of [left, through, right] triples in
* veh/h, one triple per lane (left-to-right). Pass an empty array for
* a leg with no approach (three-leg intersection).
* @param {Float64Array} eb_lane_volumes
* @param {Float64Array} wb_lane_volumes
* @param {Float64Array} nb_lane_volumes
* @param {Float64Array} sb_lane_volumes
* @param {number | undefined} [eb_heavy_vehicle_pct]
* @param {number | undefined} [wb_heavy_vehicle_pct]
* @param {number | undefined} [nb_heavy_vehicle_pct]
* @param {number | undefined} [sb_heavy_vehicle_pct]
* @param {number | undefined} [phf]
* @param {number | undefined} [analysis_period_h]
*/
  constructor(eb_lane_volumes: Float64Array, wb_lane_volumes: Float64Array, nb_lane_volumes: Float64Array, sb_lane_volumes: Float64Array, eb_heavy_vehicle_pct?: number, wb_heavy_vehicle_pct?: number, nb_heavy_vehicle_pct?: number, sb_heavy_vehicle_pct?: number, phf?: number, analysis_period_h?: number);
/**
* Run the HCM Chapter 21 procedure (Steps 1-16 except the Step 12
* capacity search; see `compute_lane_capacity`).
*/
  analyze(): void;
/**
* Iterations used by the departure-headway convergence loop.
* @returns {number | undefined}
*/
  get_iterations(): number | undefined;
/**
* Number of lanes on an approach ("EB"/"WB"/"NB"/"SB").
* @param {string} approach
* @returns {number}
*/
  get_lane_count(approach: string): number;
/**
* Converged departure headway h_d of a lane, s (Equation 21-28).
* @param {string} approach
* @param {number} lane
* @returns {number | undefined}
*/
  get_departure_headway(approach: string, lane: number): number | undefined;
/**
* Degree of utilization x = v h_d / 3,600 (Equation 21-14).
* @param {string} approach
* @param {number} lane
* @returns {number | undefined}
*/
  get_degree_of_utilization(approach: string, lane: number): number | undefined;
/**
* Service time t_s = h_d - m, s (Equation 21-29).
* @param {string} approach
* @param {number} lane
* @returns {number | undefined}
*/
  get_service_time(approach: string, lane: number): number | undefined;
/**
* Lane control delay, s/veh (Equation 21-30).
* @param {string} approach
* @param {number} lane
* @returns {number | undefined}
*/
  get_lane_delay(approach: string, lane: number): number | undefined;
/**
* Lane LOS letter (Exhibit 21-8).
* @param {string} approach
* @param {number} lane
* @returns {string | undefined}
*/
  get_lane_los(approach: string, lane: number): string | undefined;
/**
* Lane 95th percentile queue, veh (Equation 21-33).
* @param {string} approach
* @param {number} lane
* @returns {number | undefined}
*/
  get_lane_queue_95(approach: string, lane: number): number | undefined;
/**
* Step 12 capacity of a lane, veh/h (iterative search; expensive).
* @param {string} approach
* @param {number} lane
* @returns {number}
*/
  compute_lane_capacity(approach: string, lane: number): number;
/**
* Approach control delay, s/veh (Equation 21-31).
* @param {string} approach
* @returns {number | undefined}
*/
  get_approach_delay(approach: string): number | undefined;
/**
* Approach LOS letter (Exhibit 21-8).
* @param {string} approach
* @returns {string | undefined}
*/
  get_approach_los(approach: string): string | undefined;
/**
* Intersection control delay, s/veh (Equation 21-32).
* @returns {number | undefined}
*/
  get_intersection_delay(): number | undefined;
/**
* Intersection LOS letter (Exhibit 21-8).
* @returns {string | undefined}
*/
  get_intersection_los(): string | undefined;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmBasicFreeways {
  free(): void;
/**
* @param {number | undefined} [bffs]
* @param {number | undefined} [lane_width]
* @param {number | undefined} [lane_count]
* @param {number | undefined} [lc_r]
* @param {number | undefined} [lc_l]
* @param {number | undefined} [trd]
* @param {number | undefined} [apd]
* @param {number | undefined} [grade]
* @param {string | undefined} [terrain_type]
* @param {number | undefined} [speed_limit]
* @param {number | undefined} [phf]
* @param {number | undefined} [p_t]
* @param {number | undefined} [demand_flow_i]
* @param {number | undefined} [length]
* @param {string | undefined} [highway_type]
* @param {string | undefined} [city_type]
* @param {number | undefined} [sut_percentage]
*/
  constructor(bffs?: number, lane_width?: number, lane_count?: number, lc_r?: number, lc_l?: number, trd?: number, apd?: number, grade?: number, terrain_type?: string, speed_limit?: number, phf?: number, p_t?: number, demand_flow_i?: number, length?: number, highway_type?: string, city_type?: string, sut_percentage?: number);
/**
* Run the full HCM Ch.12 operational analysis and return the LOS letter.
* Populates ffs, capacity, speed, density, and v/c ratio.
* @returns {string}
*/
  run_operational_analysis(): string;
/**
* @returns {number}
*/
  determine_free_flow_speed(): number;
/**
* @returns {number}
*/
  get_ffs(): number;
/**
* Adjusted free-flow speed FFS_adj = FFS x SAF (mi/h), which the Equation 12-1 speed curve is
* drawn against. Note the asymmetry: the breakpoint below follows this, while base capacity is
* computed from the unadjusted FFS.
* @returns {number}
*/
  get_ffs_adj(): number;
/**
* Adjusted breakpoint BP_adj (pc/h/ln) - Exhibit 12-6, the flow at which the speed curve stops
* being flat. Exposed so a caller can plot the curve without restating the exhibit's formula.
* @returns {number}
*/
  get_breakpoint(): number;
/**
* @returns {number}
*/
  get_capacity(): number;
/**
* @returns {number}
*/
  get_adjusted_capacity(): number;
/**
* @returns {number}
*/
  get_speed(): number;
/**
* @returns {number}
*/
  get_density(): number;
/**
* @returns {number}
*/
  get_vc_ratio(): number;
/**
* Demand flow rate v_p under equivalent base conditions, pc/h/ln
* (Equation 12-9). This is the abscissa of the Exhibit 12-6 speed-flow
* curve, so it is what the breakpoint and capacity above are compared
* against, not the veh/h demand handed to the constructor. 0.0 before
* the analysis has run.
* @returns {number}
*/
  get_demand_volume(): number;
/**
* @returns {number}
*/
  get_lane_count(): number;
/**
* Passenger-car equivalent for heavy vehicles (E_T), populated by the
* analysis. This is what `sut_percentage` selects: general terrain vs. the
* specific-upgrade exhibits. 0.0 before the analysis has run.
* @returns {number}
*/
  get_e_t(): number;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmDisplacedLeftTurn {
  free(): void;
/**
* Build a displaced left-turn (DLT) intersection analysis (HCM Ch.23
* Part C, Equation 23-69) from the per-junction weighted control-delay
* table of Exhibit 34-145.
*
* * `junction_flows` — flow rate v_j through each component junction, veh/h.
* * `junction_delays` — control delay d_j experienced by that flow, s/veh
*   (same order and length as `junction_flows`).
* * `total_od_demand_veh_h` — O-D demand total Σ v_OD, veh/h.
* * `full_dlt` — true for a full DLT, false or absent for a partial DLT.
* @param {Float64Array} junction_flows
* @param {Float64Array} junction_delays
* @param {number} total_od_demand_veh_h
* @param {boolean | undefined} [full_dlt]
*/
  constructor(junction_flows: Float64Array, junction_delays: Float64Array, total_od_demand_veh_h: number, full_dlt?: boolean);
/**
* Weighted-average intersection ETT (= control delay), s/veh
* (HCM Equation 23-69).
* @returns {number}
*/
  get_intersection_ett_s(): number;
/**
* Intersection LOS letter (Chapter 19 control-delay thresholds).
* @returns {string}
*/
  get_los(): string;
}
/**
*/
export class WasmExclusivePedestrianFacility {
  free(): void;
/**
* Build an exclusive off-street pedestrian facility analysis (HCM Ch.24).
*
* * `total_walkway_width` — total walkway width W_T, ft.
* * `fixed_object_width` — fixed-object effective widths and shy distances W_O, ft.
* * `pedestrian_demand` — hourly pedestrian demand v_h, p/h.
* * `peak_15min_volume` — field-measured peak 15-min volume, p (used
*   directly instead of v_h / (4 × PHF) when provided).
* * `phf` — peak hour factor (default 0.85).
* * `pedestrian_speed` — average pedestrian speed S_p, ft/min (default 300).
* * `facility_type` — "walkway" (default), "cross_flow", or "stairway".
* * `flow_type` — "random" (default) or "platooned".
* @param {number} total_walkway_width
* @param {number | undefined} [fixed_object_width]
* @param {number | undefined} [pedestrian_demand]
* @param {number | undefined} [peak_15min_volume]
* @param {number | undefined} [phf]
* @param {number | undefined} [pedestrian_speed]
* @param {string | undefined} [facility_type]
* @param {string | undefined} [flow_type]
*/
  constructor(total_walkway_width: number, fixed_object_width?: number, pedestrian_demand?: number, peak_15min_volume?: number, phf?: number, pedestrian_speed?: number, facility_type?: string, flow_type?: string);
/**
* Run the complete methodology (Steps 1-5) and return the LOS letter.
* @returns {string}
*/
  analyze(): string;
/**
* Effective walkway width W_E, ft (HCM Equation 24-1).
* @returns {number}
*/
  get_effective_width(): number;
/**
* Pedestrian volume during the peak 15 min, p (HCM Equation 24-2).
* @returns {number}
*/
  get_flow_rate_15min(): number;
/**
* Pedestrian flow per unit width v_p, p/ft/min (HCM Equation 24-3).
* @returns {number}
*/
  get_unit_flow_rate(): number;
/**
* Average pedestrian space A_p, ft²/p (HCM Equation 24-4). Infinity for
* an empty facility.
* @returns {number}
*/
  get_pedestrian_space(): number;
/**
* Volume-to-capacity ratio.
* @returns {number}
*/
  get_vc_ratio(): number;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
* One HCM Chapter 10 analysis segment (Basic / Merge / Diverge / Weaving /
* OverlappingRamp). Ramp demand vectors carry one value per 15-min analysis
* period, veh/h.
*/
export class WasmFacilitySegment {
  free(): void;
/**
* @param {string} seg_type
* @param {number} length_ft
* @param {number} lanes
* @param {Float64Array} on_ramp_demand
* @param {Float64Array} off_ramp_demand
* @param {Float64Array} ramp_to_ramp_demand
* @param {number | undefined} [ramp_ffs]
* @param {number | undefined} [accel_lane_ft]
* @param {number | undefined} [decel_lane_ft]
* @param {number | undefined} [short_length_ft]
* @param {number | undefined} [num_weaving_lanes]
* @param {number | undefined} [lc_rf]
* @param {number | undefined} [lc_fr]
* @param {number | undefined} [ffs]
* @param {number | undefined} [caf]
* @param {number | undefined} [saf]
* @param {number | undefined} [daf]
*/
  constructor(seg_type: string, length_ft: number, lanes: number, on_ramp_demand: Float64Array, off_ramp_demand: Float64Array, ramp_to_ramp_demand: Float64Array, ramp_ffs?: number, accel_lane_ft?: number, decel_lane_ft?: number, short_length_ft?: number, num_weaving_lanes?: number, lc_rf?: number, lc_fr?: number, ffs?: number, caf?: number, saf?: number, daf?: number);
/**
* @returns {string}
*/
  get_seg_type(): string;
/**
* @returns {number}
*/
  get_length_ft(): number;
/**
* @returns {number}
*/
  get_lanes(): number;
/**
* Place a work zone on this segment (HCM Chapter 10, Section 4; Equations
* 10-7 through 10-12), from a configuration object matching the serde
* schema of the library's `WorkZone` — the shape of the library's own
* fixtures, so the `work_zone` object of
* `tests/ExampleCases/hcm/FreewayFacilities/case4.json` (Example Problem
* 4) passes verbatim:
*
* ```json
* {
*   "total_lanes": 3, "open_lanes": 2,
*   "soft_barrier": true, "rural": false,
*   "lateral_distance_ft": 0.0, "night": false,
*   "speed_ratio": 1.0909090909090908, "speed_limit_mi_h": 55.0,
*   "total_ramp_density": 1.0, "queue_discharge_drop": 0.131
* }
* ```
*
* The work zone is a structured input with eleven fields, all of which
* enter Equations 10-7 through 10-12, so it arrives as a config object
* rather than as eleven more trailing constructor arguments, the same
* choice `WasmManagedLaneFacility` makes for the other Chapter 10 input
* that has no home on a segment. This is a setter rather than an
* eighteenth constructor argument so that the seventeen-argument
* constructor every existing caller uses keeps its exact signature.
*
* Every field has a serde default and unknown fields are ignored, so a
* misspelled field name falls back to its default rather than throwing —
* prefer copying names from the fixture files. The defaults describe a
* three-to-two urban daylight closure behind a hard barrier, which is not
* a no-op: calling this with `{}` places a real work zone.
* @param {any} config
*/
  set_work_zone(config: any): void;
/**
* Remove the work zone from this segment, restoring unadjusted capacity
* and free-flow speed.
*/
  clear_work_zone(): void;
/**
* @returns {boolean}
*/
  has_work_zone(): boolean;
/**
* Equation 10-7 lane closure severity index, or undefined with no work
* zone. `LCSI = 1 / (OR x N_o)`, capped at 2.0 (Exhibit 10-15).
* @returns {number | undefined}
*/
  work_zone_lcsi(): number | undefined;
/**
* Equation 10-11 work zone capacity adjustment factor, or undefined with
* no work zone. `non_wz_capacity_pc` is the non-work-zone per-lane
* capacity in pc/h/ln, which the facility supplies from Equation 12-6 at
* the segment's unadjusted FFS when it runs the analysis; pass it here to
* read the factor on its own (2,300 pc/h/ln at the FFS 60 of Example
* Problem 4, giving CAF_wz = 0.892).
* @param {number} non_wz_capacity_pc
* @returns {number | undefined}
*/
  work_zone_caf(non_wz_capacity_pc: number): number | undefined;
/**
* Equation 10-12 work zone speed adjustment factor, or undefined with no
* work zone. `non_wz_ffs` is the segment free-flow speed in mi/h (60 in
* Example Problem 4, giving SAF_wz = 0.982).
* @param {number} non_wz_ffs
* @returns {number | undefined}
*/
  work_zone_saf(non_wz_ffs: number): number | undefined;
}
/**
* HCM Chapter 10 freeway facilities core methodology (Steps A-1 through
* A-17): a directional facility of ordered segments evaluated over
* consecutive 15-min analysis periods.
*/
export class WasmFreewayFacility {
  free(): void;
/**
* @param {(WasmFacilitySegment)[]} wasm_segments
* @param {Float64Array} mainline_demand
* @param {number | undefined} [ffs]
* @param {number | undefined} [heavy_vehicle_pct]
* @param {string | undefined} [terrain]
* @param {string | undefined} [city_type]
* @param {number | undefined} [phf]
* @param {number | undefined} [jam_density_pc]
* @param {number | undefined} [queue_discharge_drop]
* @param {number | undefined} [total_ramp_density]
* @param {number | undefined} [interchange_density]
*/
  constructor(wasm_segments: (WasmFacilitySegment)[], mainline_demand: Float64Array, ffs?: number, heavy_vehicle_pct?: number, terrain?: string, city_type?: string, phf?: number, jam_density_pc?: number, queue_discharge_drop?: number, total_ramp_density?: number, interchange_density?: number);
/**
* Run the full core methodology. Throws with the validation message on
* invalid input (e.g. first/last segment not basic, no periods).
*/
  run_analysis(): void;
/**
* @returns {number}
*/
  num_segments(): number;
/**
* @returns {number}
*/
  num_periods(): number;
/**
* @returns {number}
*/
  total_length_mi(): number;
/**
* @returns {boolean}
*/
  is_oversaturated(): boolean;
/**
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_speed(seg: number, period: number): number;
/**
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_density_veh(seg: number, period: number): number;
/**
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_density_pc(seg: number, period: number): number;
/**
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_dc_ratio(seg: number, period: number): number;
/**
* Segment capacity, veh/h (Exhibits 25-63 and 25-71). This is the
* denominator of `get_dc_ratio()` and it varies by period, both because a
* weaving segment's capacity follows the period's weaving pattern and
* because the Step A-8 adjustments are per period. Where a work zone is
* placed this is the post-CAF_wz value, not the Step A-7 lane-closure
* capacity the exhibit prints: Exhibit 25-71 prints 4,499 veh/h for the
* Example Problem 4 work zone segment, and the Exhibit 25-72 d/c ratios
* of the same problem only reproduce against 4,499 x 0.892.
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_capacity(seg: number, period: number): number;
/**
* Volume served v_a, veh/h (Exhibit 25-48/25-56). This equals the
* segment demand only while the facility is undersaturated. Once a
* queue forms the oversaturated engine meters what the segment can
* actually discharge, so volume served and demand diverge, and it is
* volume served that the speed and density of the period are computed
* from.
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_volume_served(seg: number, period: number): number;
/**
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_queue_length_ft(seg: number, period: number): number;
/**
* @param {number} seg
* @param {number} period
* @returns {string}
*/
  get_los(seg: number, period: number): string;
/**
* @param {number} period
* @returns {number}
*/
  get_facility_speed(period: number): number;
/**
* @param {number} period
* @returns {number}
*/
  get_facility_density_veh(period: number): number;
/**
* @param {number} period
* @returns {string}
*/
  get_facility_los(period: number): string;
/**
* @returns {number}
*/
  get_overall_speed(): number;
/**
* @returns {number}
*/
  get_overall_density_veh(): number;
/**
* @returns {any}
*/
  speed_matrix(): any;
/**
* @returns {any}
*/
  density_matrix(): any;
/**
* @returns {any}
*/
  dc_matrix(): any;
/**
* Segment capacity `[segment][period]`, veh/h (Exhibits 25-63, 25-71).
* See `get_capacity()` for what a work zone segment holds here.
* @returns {any}
*/
  capacity_matrix(): any;
/**
* @returns {any}
*/
  los_matrix(): any;
/**
* @returns {any}
*/
  queue_matrix(): any;
/**
* @returns {any}
*/
  volume_served_matrix(): any;
/**
* Demand-based segment LOS `[segment][period]` (Exhibit 25-59, lower
* table): "F" where vd/c > 1.0, undefined otherwise. The density-based
* `los_matrix()` above reports what the segment delivered at the volume
* it served, which can stay at D or E through a period whose demand
* exceeded capacity; the demand-based table is where that excess shows
* up, so the two are reported side by side rather than merged.
* @returns {any}
*/
  demand_based_los_matrix(): any;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
* HCM Chapter 11 freeway reliability analysis (Steps B-1 through B-13),
* scoped to demand variability plus optional weather and incidents. The
* scenario generator defaults to a whole-year reliability reporting period
* (12 months, Monday through Friday, Exhibit 11-18 urban demand ratios) with
* no weather; `set_weather()` and `set_demand_multipliers()` replace those
* two defaults. Work zones and special events, and with them the Chapter 37
* ATDM strategies built on top of them, are not exposed by this binding.
*/
export class WasmFreewayReliability {
  free(): void;
/**
* The four trailing facility parameters are the ones
* `WasmFreewayFacility` has always taken and this constructor used to
* pass as `None`: jam density, the queue discharge capacity drop, total
* ramp density, and interchange density. Omitting any of them keeps the
* core default, which for the first three is the value Example Problem 7
* itself uses (190 pc/mi/ln, 7%, 1.0 ramps/mi) but for interchange
* density is `None`, and the core then falls back to the total ramp
* density rather than to Example Problem 7's 0.8 interchanges/mi.
* @param {(WasmFacilitySegment)[]} wasm_segments
* @param {Float64Array} mainline_demand
* @param {number | undefined} ffs
* @param {number | undefined} heavy_vehicle_pct
* @param {string | undefined} terrain
* @param {string | undefined} city_type
* @param {number | undefined} phf
* @param {Uint32Array} months
* @param {number | undefined} [replications]
* @param {number | undefined} [seed_month]
* @param {string | undefined} [seed_weekday]
* @param {number | undefined} [crash_rate_per_100mvmt]
* @param {number | undefined} [incident_to_crash_ratio]
* @param {number | undefined} [rng_seed]
* @param {boolean | undefined} [vmt_weighted]
* @param {number | undefined} [jam_density_pc]
* @param {number | undefined} [queue_discharge_drop]
* @param {number | undefined} [total_ramp_density]
* @param {number | undefined} [interchange_density]
*/
  constructor(wasm_segments: (WasmFacilitySegment)[], mainline_demand: Float64Array, ffs: number | undefined, heavy_vehicle_pct: number | undefined, terrain: string | undefined, city_type: string | undefined, phf: number | undefined, months: Uint32Array, replications?: number, seed_month?: number, seed_weekday?: string, crash_rate_per_100mvmt?: number, incident_to_crash_ratio?: number, rng_seed?: number, vmt_weighted?: boolean, jam_density_pc?: number, queue_discharge_drop?: number, total_ramp_density?: number, interchange_density?: number);
/**
* Place the Step B-6 weather inputs, from a configuration object in the
* serde schema of the library's `WeatherInputs`, so the `weather` object
* of `tests/ExampleCases/hcm/FreewayReliability/case1.json` passes
* verbatim. The inputs are a 12-by-10 timewise probability matrix
* (Equation 25-75, months by `SEVERE_WEATHER_TYPES`), the ten mean event
* durations, optional per-type CAF and SAF overrides on the Exhibit
* 11-20/11-21 defaults, and the event demand adjustment factor, so they
* arrive as one config object rather than as a further row of positional
* arguments. Without this the generator sees no weather at all, which is
* a milder facility rather than a differently parameterized one.
*
* The shapes are checked here because `WeatherInputs` is `serde(default)`:
* a misspelled or transposed probability matrix would otherwise
* deserialize into the all-zero default and silently generate the same
* weather-free distribution the caller was trying to leave behind.
* @param {any} config
*/
  set_weather(config: any): void;
/**
* Remove the weather inputs, returning the generator to its default of
* modeling no weather events.
*/
  clear_weather(): void;
/**
* @returns {boolean}
*/
  has_weather(): boolean;
/**
* Replace the demand multipliers DM of Equation 25-72 with a local
* table: 12 rows (January through December) of 7 columns (Monday through
* Sunday). Only ratios to the seed date's multiplier are used, so any
* common base works, which is why Example Problem 7's Exhibit 25-100
* table (an ADT-based rescaling of Exhibit 11-18) gives a July Friday DAF
* of 1.329/0.995 = 1.3357 where the Exhibit 11-18 default gives
* 1.62/1.21 = 1.3388.
*
* The shape is checked because the core's lookup returns 1.0 for a month
* or weekday the table does not reach, so a transposed or short table
* would quietly flatten part of the year to no demand variation at all.
* @param {any} rows
*/
  set_demand_multipliers(rows: any): void;
/**
* Demand multiplier DM(Seed) of the seed dataset date, the denominator
* of every scenario's DAF (Equation 25-72).
* @returns {number}
*/
  seed_demand_multiplier(): number;
/**
* Run the full reliability methodology (scenario generation plus one
* Chapter 10 core-methodology evaluation per scenario). Throws with the
* validation message on invalid input.
*/
  run(): void;
/**
* Seed-file VMT over the whole study period, veh-mi (Equation 25-88).
* This is the denominator the incident frequencies of Equation 25-77
* are built on, so it is available before `run()` and does not depend
* on the Monte Carlo draw.
* @returns {number}
*/
  seed_total_vmt(): number;
/**
* Number of 15-min analysis periods in the seed file, i.e. the study
* period length D_SP in quarter hours.
* @returns {number}
*/
  seed_num_periods(): number;
/**
* @returns {number}
*/
  num_scenarios(): number;
/**
* @returns {number}
*/
  num_observations(): number;
/**
* @returns {number}
*/
  free_flow_travel_time_min(): number;
/**
* @returns {number}
*/
  expected_vhd(): number;
/**
* @returns {number}
*/
  tti_mean(): number;
/**
* Weighted percentile TTI (p in 0-100), e.g. 95 for the PTI.
* @param {number} p
* @returns {number}
*/
  tti_percentile(p: number): number;
/**
* Largest TTI in the weighted distribution. This is the single worst
* scenario-period, so it is the measure most exposed to the Monte Carlo
* pairing of an incident with a high-demand scenario.
* @returns {number}
*/
  tti_max(): number;
/**
* Percentage of the weighted distribution above a TTI threshold, e.g.
* 2.0 for the Exhibit 25-104 "%VMT at TTI > 2" row.
* @param {number} threshold
* @returns {number}
*/
  pct_tti_above(threshold: number): number;
/**
* Misery index (mean of the worst 5% of TTIs).
* @returns {number}
*/
  misery_index(): number;
/**
* Reliability rating, % (weighted share with TTI < 1.33).
* @returns {number}
*/
  reliability_rating(): number;
/**
* Semi-standard deviation (one-sided about TTI = 1).
* @returns {number}
*/
  semi_std_dev(): number;
/**
* Percentage of the weighted distribution below the target facility
* space mean speed, %.
* @param {number} target_speed_mi_h
* @returns {number}
*/
  failure_pct_below_speed(target_speed_mi_h: number): number;
/**
* Percentage of the weighted distribution at or above the target
* facility space mean speed, %. The complement of
* `failure_pct_below_speed()` at the same target.
* @param {number} target_speed_mi_h
* @returns {number}
*/
  on_time_pct_at_speed(target_speed_mi_h: number): number;
/**
* Scenario probabilities (one entry per generated scenario).
* @returns {Float64Array}
*/
  scenario_probabilities(): Float64Array;
/**
* Month of year (1-12) of each scenario's demand combination. Empty
* before `run()`. This and the four vectors below share the ordering of
* `scenario_probabilities()` and `scenario_tti_matrix()`, so a scenario
* is identified by its index across all of them.
* @returns {Uint32Array}
*/
  scenario_months(): Uint32Array;
/**
* Day of week of each scenario, as the English weekday name.
* @returns {(string)[]}
*/
  scenario_weekdays(): (string)[];
/**
* Demand adjustment factor DAF_s of each scenario (Equation 25-72),
* the scenario's demand multiplier over the seed date's. The seed-date
* scenario therefore has DAF = 1 by construction.
* @returns {Float64Array}
*/
  scenario_dafs(): Float64Array;
/**
* Number of incidents assigned to each scenario. Scenarios with zero
* incidents differ from the seed only through demand, which is what
* makes them comparable against a plain Chapter 10 run.
* @returns {Uint32Array}
*/
  scenario_incident_counts(): Uint32Array;
/**
* Expected incident frequency n_j per study period by month, indexed
* January = 0 (Equation 25-77). Months outside the reliability
* reporting period read zero. Empty before `run()`.
* @returns {Float64Array}
*/
  monthly_incident_frequencies(): Float64Array;
/**
* Expected weather event counts E[n_w,j] by month (12 rows, January
* first) and severe weather type (10 columns, `SEVERE_WEATHER_TYPES`
* order), Equation 25-76. These are the deterministic counts the
* stochastic assignment then places, so they are the part of the
* weather step that reproduces exactly. Empty before `run()`.
* @returns {any}
*/
  expected_weather_event_counts(): any;
/**
* Total weather events generated across the whole scenario set.
* @returns {number}
*/
  total_weather_events(): number;
/**
* Number of weather events assigned to each scenario, sharing the
* ordering of `scenario_probabilities()`.
* @returns {Uint32Array}
*/
  scenario_weather_event_counts(): Uint32Array;
/**
* Total incidents generated across the whole scenario set. The count
* is a draw, not the expectation, so it moves with the rng seed.
* @returns {number}
*/
  total_incidents(): number;
/**
* Per-scenario TTI matrix [scenario][period].
* @returns {any}
*/
  scenario_tti_matrix(): any;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmInterchange {
  free(): void;
/**
* Build a signalized interchange ramp terminal analysis (HCM Ch.23
* Part B: diamond / parclo / SPUI / DDI) from a configuration object
* matching the serde schema of `hcm::chapter23::ramp_terminals::Interchange`
* (same shape as `tests/ExampleCases/hcm/RampTerminals/case1.json`):
* interchange form, cycle length, O-D demands A..N, and the per-lane-group
* geometry and signal timing.
*
* `form` is one of the nine Exhibit 23-17 / 23-18 names: `"Diamond"`,
* `"Ddi"`, `"ParcloA2Q"`, `"ParcloA4Q"`, `"ParcloAB2Q"`, `"ParcloAB4Q"`,
* `"ParcloB2Q"`, `"ParcloB4Q"`, `"Spui"`. Only `Diamond`, `Ddi`, and
* `ParcloA2Q` are validated against a published example problem; the
* other six route and analyze but have no published answer column behind
* them (the library says the same in `docs/hcm/VERIFICATION.md`).
*
* A lane group's `movement` is the composed name approach + position +
* turn, e.g. `"EbExtThrough"`, `"EbExtLeft"`, `"EbIntThroughRight"`,
* `"NbRampTwoLeft"`. The ten diamond names are unchanged compositions, so
* a configuration written against 0.3.7 keeps its meaning.
*
* An unknown form or movement name is rejected here rather than defaulted,
* which matters because a form that silently fell back to `Diamond` would
* route every O-D through lane groups the interchange does not have.
* @param {any} config
*/
  constructor(config: any);
/**
* Interchange form as parsed, e.g. `"ParcloA2Q"`. This is the readback
* that lets a caller prove the configuration it sent is the form the
* engine analyzed, rather than inferring it from the lane groups.
* @returns {string}
*/
  get_form(): string;
/**
* Run the complete HCM Ch.23 Part B procedure (Steps 1-9 of Exhibit 23-22).
*/
  analyze(): void;
/**
* @returns {number}
*/
  get_cycle_length_s(): number;
/**
* @returns {number}
*/
  get_peak_hour_factor(): number;
/**
* Demand-weighted interchange experienced travel time ETT, s/veh
* (HCM Equation 23-52).
* @returns {number | undefined}
*/
  get_interchange_ett_s(): number | undefined;
/**
* Interchange LOS letter (HCM Exhibit 23-10), e.g. "C".
* @returns {string | undefined}
*/
  get_interchange_los(): string | undefined;
/**
* O-D results as a JS array (movement letter, PHF-adjusted demand,
* control delay, EDTT, ETT, v/c and queue-storage flags, LOS).
* @returns {any}
*/
  od_results_to_js_value(): any;
/**
* Lane-group results as a JS array (movement, flow rate, saturation
* flow, effective green, capacity, v/c, delays, back of queue).
* @returns {any}
*/
  lane_group_results_to_js_value(): any;
}
/**
* HCM Chapter 10 managed-lane facility extension (Steps A-9/A-13/A-14/A-17;
* Chapter 25 Section 2): a general-purpose lane group paired with a parallel
* managed-lane lane group, analyzed with the cross-weave capacity adjustment
* on the GP side and the adjacent-friction speed reduction on the ML side,
* then aggregated per lane group and combined.
*
* The managed lane is not a segment flag on the GP facility, so it cannot be
* reached through [`WasmFreewayFacility`]. `ml` is a vector parallel to the
* GP segments carrying `null` where a GP segment has no adjacent managed
* lane, and the ML lane group has its own entry demand, free-flow speed, and
* ramp demands. Those are the inputs this wrapper adds.
*/
export class WasmManagedLaneFacility {
  free(): void;
/**
* Build the whole facility, both lane groups, from a configuration
* object matching the serde schema of the library's
* `ManagedLaneFacility` — the shape of the library's own fixtures, so
* `tests/ExampleCases/hcm/FreewayFacilities/ml_case1.json` (Example
* Problem 5) loads verbatim:
*
* ```json
* {
*   "gp": { "segments": [ ... ], "mainline_demand": [ ... ], "ffs": 60.0 },
*   "ml": [ { "lane_type": "ContinuousAccess", "lanes": 1 }, null ],
*   "ml_entry_demand": [1000.0, 1100.0],
*   "ml_ffs": 60.0
* }
* ```
*
* `gp` is the same schema [`WasmFreewayFacility`] takes positionally.
* `ml` must have one entry per GP segment once `run_analysis()` is
* called, `null` marking a segment with no adjacent managed lane.
* `lane_type` is one of `ContinuousAccess` / `Buffer1` / `Buffer2` /
* `Barrier1` / `Barrier2` (Exhibit 12-9); only the first two are subject
* to the Step A-13 adjacent friction. An ML segment may also carry
* `ffs`, `caf`, `saf`, `on_ramp_demand`, and `off_ramp_demand`. The
* optional `cross_weave` vector is parallel to the GP segments as well,
* each entry `{"cw_demand_pc": [...], "l_cw_min_ft": 0.0}` (Step A-9,
* Equations 13-24/13-25); omit it and no cross-weave reduction applies.
*
* Every field has a serde default and unknown fields are ignored, so a
* misspelled field name falls back to its default rather than throwing —
* prefer copying names from the fixture files.
* @param {any} config
*/
  constructor(config: any);
/**
* Build from an already-constructed general-purpose facility plus the
* managed-lane half as a config object (`ml`, `ml_entry_demand`,
* `ml_ffs`, `cross_weave`, as documented on the constructor). The GP
* facility is copied, not consumed, and need not have been run.
* @param {WasmFreewayFacility} gp
* @param {any} ml_config
* @returns {WasmManagedLaneFacility}
*/
  static from_gp(gp: WasmFreewayFacility, ml_config: any): WasmManagedLaneFacility;
/**
* Run both lane groups and the combined aggregation. Throws when `ml`
* (or a non-empty `cross_weave`) does not have one entry per GP segment,
* and on any GP validation failure.
*/
  run_analysis(): void;
/**
* @returns {number}
*/
  num_segments(): number;
/**
* @returns {number}
*/
  num_periods(): number;
/**
* The general-purpose lane group as a [`WasmFreewayFacility`], which is
* how the GP segment matrices are read. This is a snapshot copy taken
* after `run_analysis()`, so the Step A-9 cross-weave CAF is already
* folded into its segment capacities; running it again is harmless but
* pointless.
* @returns {WasmFreewayFacility}
*/
  gp_facility(): WasmFreewayFacility;
/**
* ML segment demand, veh/h — the entry demand accumulated through the ML
* ramp demands, not metered by capacity.
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_ml_demand(seg: number, period: number): number;
/**
* ML segment capacity, veh/h (Exhibit 25-81): the Chapter 12 adjusted
* per-lane capacity times the lane count and the facility heavy-vehicle
* factor, so it is a vehicle rate and not the pc/h/ln of Equation 12-14.
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_ml_capacity(seg: number, period: number): number;
/**
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_ml_dc_ratio(seg: number, period: number): number;
/**
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_ml_speed(seg: number, period: number): number;
/**
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_ml_density_veh(seg: number, period: number): number;
/**
* @param {number} seg
* @param {number} period
* @returns {number}
*/
  get_ml_density_pc(seg: number, period: number): number;
/**
* @param {number} seg
* @param {number} period
* @returns {string}
*/
  get_ml_los(seg: number, period: number): string;
/**
* Whether the Step A-13 adjacent friction was active on the ML segment,
* which needs both a friction-capable lane type (continuous access or
* Buffer 1) and an adjacent GP density above 35 pc/mi/ln. The speed drop
* it causes is already in `get_ml_speed()`; this reports why.
* @param {number} seg
* @param {number} period
* @returns {boolean}
*/
  is_ml_friction_active(seg: number, period: number): boolean;
/**
* @param {number} period
* @returns {number}
*/
  get_gp_group_speed(period: number): number;
/**
* @param {number} period
* @returns {number}
*/
  get_gp_group_density_veh(period: number): number;
/**
* @param {number} period
* @returns {string}
*/
  get_gp_group_los(period: number): string;
/**
* @param {number} period
* @returns {number}
*/
  get_ml_group_speed(period: number): number;
/**
* @param {number} period
* @returns {number}
*/
  get_ml_group_density_veh(period: number): number;
/**
* @param {number} period
* @returns {string}
*/
  get_ml_group_los(period: number): string;
/**
* @param {number} period
* @returns {number}
*/
  get_facility_speed(period: number): number;
/**
* Combined facility density, veh/mi/ln (Exhibit 25-87).
*
* VERIFY-HCM: this is the exact Equation 10-1 lane-mile-weighted
* combination of the two lane-group densities. In Example Problem 5
* Period 3 it gives 28.3 where Exhibit 25-87 prints 29.1, a value not
* reproducible from the book's own Exhibit 25-86 group densities (31.0
* GP, 20.0 ML) under Equation 10-1. LOS is unaffected.
* @param {number} period
* @returns {number}
*/
  get_facility_density_veh(period: number): number;
/**
* @param {number} period
* @returns {string}
*/
  get_facility_los(period: number): string;
/**
* @returns {any}
*/
  ml_capacity_matrix(): any;
/**
* @returns {any}
*/
  ml_dc_matrix(): any;
/**
* @returns {any}
*/
  ml_speed_matrix(): any;
/**
* @returns {any}
*/
  ml_density_matrix(): any;
/**
* @returns {any}
*/
  ml_los_matrix(): any;
/**
* @returns {any}
*/
  ml_friction_matrix(): any;
/**
* Both lane groups by period (Exhibit 25-86): space mean speed, average
* density in veh/mi/ln and pc/mi/ln, and LOS.
* @returns {any}
*/
  lane_group_performance_to_js_value(): any;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmManagedLanes {
  free(): void;
/**
* @param {string | undefined} [lane_type]
* @param {number | undefined} [ffs]
* @param {number | undefined} [demand]
* @param {number | undefined} [gp_density]
* @param {number | undefined} [caf]
* @param {number | undefined} [saf]
*/
  constructor(lane_type?: string, ffs?: number, demand?: number, gp_density?: number, caf?: number, saf?: number);
/**
* Run the full HCM Ch.12 Section 4 managed lane analysis and return the LOS letter.
* Populates breakpoint, adjusted capacity, speed, and density.
* @returns {string}
*/
  run_analysis(): string;
/**
* Breakpoint BP (pc/h/ln) - Equation 12-13.
* @returns {number}
*/
  calculate_breakpoint(): number;
/**
* Adjusted capacity c_adj (pc/h/ln) - Equation 12-14.
* @returns {number}
*/
  calculate_capacity(): number;
/**
* Space mean speed S_ML (mi/h) - Equation 12-12.
* @returns {number}
*/
  calculate_speed(): number;
/**
* Density (pc/mi/ln).
* @returns {number}
*/
  calculate_density(): number;
/**
* Level of service letter (Exhibit 12-15 criteria).
* @returns {string}
*/
  determine_los(): string;
/**
* @param {number} v_p
*/
  set_demand(v_p: number): void;
/**
* @param {number} k_gp
*/
  set_gp_density(k_gp: number): void;
/**
* @returns {number}
*/
  get_breakpoint(): number;
/**
* @returns {number}
*/
  get_capacity(): number;
/**
* @returns {number}
*/
  get_speed(): number;
/**
* @returns {number}
*/
  get_density(): number;
/**
* @returns {string | undefined}
*/
  get_los(): string | undefined;
/**
* Whether the segment type is subject to GP-lane friction
* (continuous access and Buffer 1 types).
* @returns {boolean}
*/
  has_friction_effect(): boolean;
/**
* Whether friction is active (K_GP > 35 pc/mi/ln on a friction type).
* @returns {boolean}
*/
  is_friction_active(): boolean;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmOffStreetBicycleFacility {
  free(): void;
/**
* Build a bicycle LOS (BLOS) analysis for a shared-use or exclusive
* off-street bicycle facility (HCM Ch.24).
*
* * `path_width` — path width, ft (methodology applies up to 20 ft).
* * `segment_length` — path segment length L, mi.
* * `has_centerline` — centerline stripe present.
* * `two_way_demand` — total two-directional path demand, users/h.
* * `directional_split` — subject-direction share of demand (default 0.50).
* * `phf` — peak hour factor (default 0.85).
* * `is_one_way` — one-way path flag (no opposing users).
* * `exclusive_bicycle` — true for an exclusive bicycle facility (the
*   bicycle mode split is set to 1.0 and all other modes to zero).
* * `mode_splits`, `mode_speeds`, `mode_speed_sds` — optional 5-value
*   overrides for [bicycle, pedestrian, runner, inline skater, child
*   bicyclist] (defaults from HCM Exhibit 24-6).
* @param {number} path_width
* @param {number} segment_length
* @param {boolean | undefined} [has_centerline]
* @param {number | undefined} [two_way_demand]
* @param {number | undefined} [directional_split]
* @param {number | undefined} [phf]
* @param {boolean | undefined} [is_one_way]
* @param {boolean | undefined} [exclusive_bicycle]
* @param {Float64Array | undefined} [mode_splits]
* @param {Float64Array | undefined} [mode_speeds]
* @param {Float64Array | undefined} [mode_speed_sds]
*/
  constructor(path_width: number, segment_length: number, has_centerline?: boolean, two_way_demand?: number, directional_split?: number, phf?: number, is_one_way?: boolean, exclusive_bicycle?: boolean, mode_splits?: Float64Array, mode_speeds?: Float64Array, mode_speed_sds?: Float64Array);
/**
* Run the complete BLOS methodology (Steps 1-8, including the low-volume
* adjustment) and return the LOS letter.
* @returns {string}
*/
  analyze(): string;
/**
* Active passings per minute A_T (HCM Equation 24-12).
* @returns {number}
*/
  get_active_passings_per_minute(): number;
/**
* Meetings per minute M_T (HCM Equation 24-16).
* @returns {number}
*/
  get_meetings_per_minute(): number;
/**
* Number of effective lanes (HCM Exhibit 24-14).
* @returns {number}
*/
  get_effective_lanes(): number;
/**
* Total probability of delayed passing P_Tds (HCM Equation 24-33).
* @returns {number}
*/
  get_probability_delayed_passing(): number;
/**
* Delayed passings per minute DP_m (HCM Equation 24-34).
* @returns {number}
*/
  get_delayed_passings_per_minute(): number;
/**
* Weighted events per minute E = M_T + 10 A_T (HCM Equation 24-35 term).
* @returns {number}
*/
  get_weighted_events_per_minute(): number;
/**
* BLOS score (HCM Equation 24-35).
* @returns {number}
*/
  get_blos_score(): number;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
* HCM Chapter 25, Section 6 planning-level freeway facility method (the
* screening companion to the Chapter 10 core methodology). Sections are
* passed as parallel arrays; `sec_types` is a comma-separated list of
* "basic", "ramp", or "weave" entries.
*/
export class WasmPlanningFacility {
  free(): void;
/**
* @param {string} sec_types
* @param {Float64Array} lengths_mi
* @param {Uint32Array} lanes
* @param {Float64Array} inflow_aadt
* @param {Float64Array} outflow_aadt
* @param {Float64Array} weave_vr
* @param {number | undefined} [ffs]
* @param {number | undefined} [k_factor]
* @param {number | undefined} [growth_factor]
* @param {number | undefined} [phf]
* @param {number | undefined} [pct_sut]
* @param {number | undefined} [pct_tt]
* @param {string | undefined} [terrain]
* @param {string | undefined} [city_type]
*/
  constructor(sec_types: string, lengths_mi: Float64Array, lanes: Uint32Array, inflow_aadt: Float64Array, outflow_aadt: Float64Array, weave_vr: Float64Array, ffs?: number, k_factor?: number, growth_factor?: number, phf?: number, pct_sut?: number, pct_tt?: number, terrain?: string, city_type?: string);
/**
* Run the planning-level analysis (Steps 1-5, four 15-min periods).
*/
  run_analysis(): void;
/**
* @returns {number}
*/
  num_sections(): number;
/**
* @returns {number}
*/
  total_length_mi(): number;
/**
* @param {number} section
* @param {number} period
* @returns {number}
*/
  get_dc_ratio(section: number, period: number): number;
/**
* Section delay rate ΔR, s/mi (Exhibit 25-92). Only the undersaturated
* term ΔRU of Equation 25-47 is reported, evaluated at the actual d/c
* even above 1.0; the library reproduces the worked Example Problem 6
* rather than the ΔRU + ΔRO form of Equation 25-49, and expresses
* oversaturation through the vertical queue instead (see the VERIFY-HCM
* note in the library's `planning.rs`).
* @param {number} section
* @param {number} period
* @returns {number}
*/
  get_delay_rate(section: number, period: number): number;
/**
* @param {number} section
* @param {number} period
* @returns {number}
*/
  get_section_speed(section: number, period: number): number;
/**
* @param {number} section
* @param {number} period
* @returns {number}
*/
  get_section_density(section: number, period: number): number;
/**
* @param {number} period
* @returns {number}
*/
  get_facility_speed(period: number): number;
/**
* @param {number} period
* @returns {number}
*/
  get_facility_density(period: number): number;
/**
* @param {number} period
* @returns {string}
*/
  get_facility_los(period: number): string;
/**
* Total vertical-queue length across all sections at the end of the
* period, mi (Exhibit 25-96). This is the planning method's only
* account of oversaturation, since its delay and travel rates leave
* the ΔRO term out (see `get_delay_rate`).
* @param {number} period
* @returns {number}
*/
  get_facility_queue_mi(period: number): number;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmRampSegment {
  free(): void;
/**
* @param {string | undefined} [ramp_type]
* @param {string | undefined} [ramp_side]
* @param {number | undefined} [ramp_lanes]
* @param {number | undefined} [freeway_lanes]
* @param {number | undefined} [freeway_ffs]
* @param {number | undefined} [ramp_ffs]
* @param {number | undefined} [accel_lane_length]
* @param {number | undefined} [accel_lane_length2]
* @param {number | undefined} [decel_lane_length]
* @param {number | undefined} [decel_lane_length2]
* @param {number | undefined} [freeway_demand]
* @param {number | undefined} [ramp_demand]
* @param {number | undefined} [phf]
* @param {number | undefined} [heavy_vehicle_pct]
* @param {number | undefined} [ramp_heavy_vehicle_pct]
* @param {string | undefined} [terrain]
* @param {string | undefined} [adjacent_upstream]
* @param {number | undefined} [upstream_distance]
* @param {number | undefined} [upstream_ramp_flow]
* @param {string | undefined} [adjacent_downstream]
* @param {number | undefined} [downstream_distance]
* @param {number | undefined} [downstream_ramp_flow]
* @param {number | undefined} [caf]
* @param {number | undefined} [saf]
* @param {string | undefined} [version]
*/
  constructor(ramp_type?: string, ramp_side?: string, ramp_lanes?: number, freeway_lanes?: number, freeway_ffs?: number, ramp_ffs?: number, accel_lane_length?: number, accel_lane_length2?: number, decel_lane_length?: number, decel_lane_length2?: number, freeway_demand?: number, ramp_demand?: number, phf?: number, heavy_vehicle_pct?: number, ramp_heavy_vehicle_pct?: number, terrain?: string, adjacent_upstream?: string, upstream_distance?: number, upstream_ramp_flow?: number, adjacent_downstream?: string, downstream_distance?: number, downstream_ramp_flow?: number, caf?: number, saf?: number, version?: string);
/**
* Full Edition 7.1 analysis as a JS object (null until `run_analysis()` has run on a
* version "7.1" segment). Fields follow the Rust `RampAnalysis` struct: flows, ffs_adj,
* speed_basic, speed_impedance, speed_avg (null far past capacity), capacity_per_lane,
* dc_ratio, the capacity checks, density, and los.
* @returns {any}
*/
  analysis_v7_1(): any;
/**
* Run the full HCM Ch.14 analysis (Steps 1-5) and return the LOS letter.
* Populates flows, v_12, capacities, density, and speeds.
*
* Returns `undefined` for a major merge operating under capacity, where the HCM defines no
* level of service and only the capacity checks apply. Callers must render that case rather
* than printing an empty letter.
* @returns {string | undefined}
*/
  run_analysis(): string | undefined;
/**
* Step 1: demand flows [v_F, v_R] in pc/h - Eq. 14-1.
* 7th Edition only; throws on a "7.1" segment.
* @returns {Float64Array}
*/
  determine_demand_flow(): Float64Array;
/**
* Step 2: flow in Lanes 1 and 2, v_12 (pc/h) - Eqs. 14-2..14-19.
* 7th Edition only; throws on a "7.1" segment.
* @returns {number}
*/
  estimate_v12(): number;
/**
* Step 3: adjusted freeway capacity (pc/h) and capacity checks
* (Exhibits 14-10/14-12, Eq. 14-21).
* 7th Edition only; throws on a "7.1" segment.
* @returns {number}
*/
  determine_capacity(): number;
/**
* Step 4: density in the ramp influence area (pc/mi/ln)
* - Eqs. 14-22/14-23/14-28.
* 7th Edition only; throws on a "7.1" segment.
* @returns {number}
*/
  determine_density(): number;
/**
* Level of service letter - Exhibit 14-3.
* 7th Edition only; throws on a "7.1" segment.
*
* Returns `undefined` for a major merge under capacity; see [`Self::run_analysis`].
* @returns {string | undefined}
*/
  determine_los(): string | undefined;
/**
* Step 5: speeds [S_R, S_O, S] in mi/h - Exhibits 14-13/14-14/14-15.
* S_O is NaN when the outer-lane speed does not apply.
* 7th Edition only; throws on a "7.1" segment.
* @returns {Float64Array}
*/
  estimate_speed(): Float64Array;
/**
* @returns {number}
*/
  get_flow_freeway(): number;
/**
* @returns {number}
*/
  get_flow_ramp(): number;
/**
* @returns {number | undefined}
*/
  get_p_f(): number | undefined;
/**
* @returns {number}
*/
  get_v12(): number;
/**
* @returns {number}
*/
  get_vr12(): number;
/**
* @returns {number}
*/
  get_capacity_freeway(): number;
/**
* @returns {number}
*/
  get_capacity_ramp(): number;
/**
* @returns {number}
*/
  get_vc_ratio(): number;
/**
* @returns {boolean | undefined}
*/
  get_demand_exceeds_capacity(): boolean | undefined;
/**
* @returns {boolean | undefined}
*/
  get_exceeds_max_desirable(): boolean | undefined;
/**
* @returns {number}
*/
  get_density(): number;
/**
* @returns {number}
*/
  get_speed_ramp(): number;
/**
* @returns {number | undefined}
*/
  get_speed_outer(): number | undefined;
/**
* @returns {number}
*/
  get_speed_avg(): number;
/**
* @returns {string | undefined}
*/
  get_los(): string | undefined;
/**
* @returns {any}
*/
  results_to_js_value(): any;
/**
* The HCM edition this segment analyzes under, "7" or "7.1".
*/
  version: string;
}
/**
*/
export class WasmRoundabouts {
  free(): void;
/**
* Each entry array is laid out as [v_u, v_l, v_t, v_r,
* heavy_vehicle_pct, entry_lanes, circulating_lanes, exiting_lanes,
* n_ped] with volumes in veh/h and pedestrians in p/h. Bypass types
* are "none", "yielding", or "nonyielding". Lane assignments apply to
* two-lane entries ("l_tr", "lt_r", "lt_tr", "l_ltr", "ltr_r").
* @param {Float64Array} nb_entry
* @param {Float64Array} sb_entry
* @param {Float64Array} eb_entry
* @param {Float64Array} wb_entry
* @param {string | undefined} [nb_bypass]
* @param {string | undefined} [sb_bypass]
* @param {string | undefined} [eb_bypass]
* @param {string | undefined} [wb_bypass]
* @param {string | undefined} [nb_lane_assignment]
* @param {string | undefined} [sb_lane_assignment]
* @param {string | undefined} [eb_lane_assignment]
* @param {string | undefined} [wb_lane_assignment]
* @param {number | undefined} [phf]
* @param {number | undefined} [analysis_period_h]
*/
  constructor(nb_entry: Float64Array, sb_entry: Float64Array, eb_entry: Float64Array, wb_entry: Float64Array, nb_bypass?: string, sb_bypass?: string, eb_bypass?: string, wb_bypass?: string, nb_lane_assignment?: string, sb_lane_assignment?: string, eb_lane_assignment?: string, wb_lane_assignment?: string, phf?: number, analysis_period_h?: number);
/**
* Run the complete HCM Chapter 22 procedure (Steps 1-12).
*/
  analyze(): void;
/**
* Set a local calibration (A, B) for the entry capacity model
* (Equations 22-21 through 22-23; A = 3,600/t_f,
* B = (t_c - t_f/2)/3,600).
* @param {number} a
* @param {number} b
*/
  set_calibration(a: number, b: number): void;
/**
* Conflicting circulating flow of an entry, pc/h (Equation 22-11).
* @param {string} entry
* @returns {number | undefined}
*/
  get_circulating_flow_pce(entry: string): number | undefined;
/**
* Number of entry lanes with results for an entry.
* @param {string} entry
* @returns {number}
*/
  get_lane_count(entry: string): number;
/**
* Entry-lane result (0 = left/only lane) as an object with label,
* flow_veh, capacity_veh, v_c_ratio, control_delay, los, and queue_95.
* @param {string} entry
* @param {number} lane
* @returns {any}
*/
  lane_result_to_js_value(entry: string, lane: number): any;
/**
* Bypass-lane result object, or null if the entry has no bypass lane.
* @param {string} entry
* @returns {any}
*/
  bypass_result_to_js_value(entry: string): any;
/**
* Approach control delay, s/veh (Equation 22-18, bypass included).
* @param {string} entry
* @returns {number | undefined}
*/
  get_approach_delay(entry: string): number | undefined;
/**
* Approach LOS letter (Exhibit 22-8).
* @param {string} entry
* @returns {string | undefined}
*/
  get_approach_los(entry: string): string | undefined;
/**
* Intersection control delay, s/veh (Equation 22-19).
* @returns {number | undefined}
*/
  get_intersection_delay(): number | undefined;
/**
* Intersection LOS letter (Exhibit 22-8).
* @returns {string | undefined}
*/
  get_intersection_los(): string | undefined;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmSegment {
  free(): void;
/**
* @param {number} passing_type
* @param {number} length
* @param {number} grade
* @param {number} spl
* @param {boolean | undefined} is_hc
* @param {number | undefined} volume
* @param {number | undefined} volume_op
* @param {number | undefined} flow_rate
* @param {number | undefined} flow_rate_o
* @param {number | undefined} capacity
* @param {number | undefined} ffs
* @param {number | undefined} avg_speed
* @param {number | undefined} vertical_class
* @param {(WasmSubSegment)[]} wasm_subsegments
* @param {number | undefined} [phf]
* @param {number | undefined} [phv]
* @param {number | undefined} [pf]
* @param {number | undefined} [fd]
* @param {number | undefined} [fd_mid]
* @param {number | undefined} [hor_class]
*/
  constructor(passing_type: number, length: number, grade: number, spl: number, is_hc: boolean | undefined, volume: number | undefined, volume_op: number | undefined, flow_rate: number | undefined, flow_rate_o: number | undefined, capacity: number | undefined, ffs: number | undefined, avg_speed: number | undefined, vertical_class: number | undefined, wasm_subsegments: (WasmSubSegment)[], phf?: number, phv?: number, pf?: number, fd?: number, fd_mid?: number, hor_class?: number);
/**
* @returns {any}
*/
  subsegs_to_js_value(): any;
/**
* @returns {any}
*/
  to_js_value(): any;
/**
* @returns {number}
*/
  get_passing_type(): number;
/**
* @returns {number}
*/
  get_length(): number;
/**
* @returns {number}
*/
  get_grade(): number;
/**
* @returns {number}
*/
  get_spl(): number;
/**
* @returns {boolean}
*/
  get_is_hc(): boolean;
/**
* @returns {number}
*/
  get_volume(): number;
/**
* @returns {number}
*/
  get_volume_op(): number;
/**
* @returns {number}
*/
  get_flow_rate(): number;
/**
* @returns {number}
*/
  get_flow_rate_o(): number;
/**
* @returns {number}
*/
  get_capacity(): number;
/**
* @returns {number}
*/
  get_ffs(): number;
/**
* @returns {number}
*/
  get_avg_speed(): number;
/**
* @returns {any}
*/
  get_subsegments(): any;
/**
* @returns {number}
*/
  get_vertical_class(): number;
/**
* @returns {number}
*/
  get_phf(): number;
/**
* @returns {number}
*/
  get_phv(): number;
/**
* @returns {number}
*/
  get_percent_followers(): number;
/**
* @returns {number}
*/
  get_followers_density(): number;
/**
* @returns {number}
*/
  get_followers_density_mid(): number;
/**
* @returns {number}
*/
  get_hor_class(): number;
}
/**
*/
export class WasmSharedUsePathPedestrian {
  free(): void;
/**
* Build a shared-use path pedestrian LOS analysis (HCM Ch.24).
*
* * `bicycle_demand_same_direction` — Q_sb, bicycles/h.
* * `bicycle_demand_opposing` — Q_ob, bicycles/h.
* * `phf` — peak hour factor (default 0.85).
* * `pedestrian_speed` — mean pedestrian speed S_p (default 3.4 mi/h;
*   only the ratio S_p / S_b is used).
* * `bicycle_speed` — mean bicycle speed S_b (default 12.8 mi/h).
* * `is_one_way` — one-way path flag (no meeting events).
* @param {number | undefined} [bicycle_demand_same_direction]
* @param {number | undefined} [bicycle_demand_opposing]
* @param {number | undefined} [phf]
* @param {number | undefined} [pedestrian_speed]
* @param {number | undefined} [bicycle_speed]
* @param {boolean | undefined} [is_one_way]
*/
  constructor(bicycle_demand_same_direction?: number, bicycle_demand_opposing?: number, phf?: number, pedestrian_speed?: number, bicycle_speed?: number, is_one_way?: boolean);
/**
* Run the complete methodology (Steps 1-3) and return the LOS letter.
* @returns {string}
*/
  analyze(): string;
/**
* Number of passing events F_p, events/h (HCM Equation 24-5).
* @returns {number}
*/
  get_passing_events(): number;
/**
* Number of meeting events F_m, events/h (HCM Equation 24-6).
* @returns {number}
*/
  get_meeting_events(): number;
/**
* Total weighted events F = F_p + 0.5 F_m, events/h (HCM Equation 24-7).
* @returns {number}
*/
  get_total_events(): number;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmSignalizedIntersection {
  free(): void;
/**
* Build a four-leg pretimed signalized intersection (HCM Ch.19).
*
* Array arguments are ordered NB, SB, EB, WB:
* * `volumes` — 12 values `[NB L, NB T, NB R, SB L, SB T, SB R, EB L, EB T, EB R, WB L, WB T, WB R]`, veh/h.
* * `lanes` — 12 values `[excl. left, through, excl. right]` per approach, same order.
* * `through_phase_s` — 4 through-phase durations D_p = G + Y + Rc, s.
* * `left_phase_s` — 4 protected left-turn phase durations, s (0 = no protected phase).
*
* A left turn with demand is treated as protected when it has an
* exclusive lane and a left phase duration, permitted otherwise (shared
* with the through lane when no exclusive left lane exists). A right
* turn without an exclusive lane shares the rightmost through lane.
* @param {number} cycle_length_s
* @param {number | undefined} analysis_period_h
* @param {number | undefined} base_saturation_flow
* @param {boolean | undefined} area_type_cbd
* @param {number | undefined} peak_hour_factor
* @param {Float64Array} volumes
* @param {Uint32Array} lanes
* @param {Float64Array} through_phase_s
* @param {Float64Array} left_phase_s
* @param {number | undefined} [yellow_s]
* @param {number | undefined} [red_clearance_s]
* @param {number | undefined} [pct_heavy_vehicles]
* @param {number | undefined} [speed_limit_mph]
* @param {number | undefined} [lane_width_ft]
* @param {number | undefined} [ped_flow_ph]
*/
  constructor(cycle_length_s: number, analysis_period_h: number | undefined, base_saturation_flow: number | undefined, area_type_cbd: boolean | undefined, peak_hour_factor: number | undefined, volumes: Float64Array, lanes: Uint32Array, through_phase_s: Float64Array, left_phase_s: Float64Array, yellow_s?: number, red_clearance_s?: number, pct_heavy_vehicles?: number, speed_limit_mph?: number, lane_width_ft?: number, ped_flow_ph?: number);
/**
* Build the intersection from a full configuration object matching the
* serde schema of `hcm::chapter19::signalized::SignalizedIntersection`
* (same shape as `tests/ExampleCases/hcm/Signalized/case1.json`).
* @param {any} config
* @returns {WasmSignalizedIntersection}
*/
  static from_config(config: any): WasmSignalizedIntersection;
/**
* Run the full HCM Ch.19 motorized vehicle methodology (Steps 1-10 of
* Exhibit 19-18). Populates lane group, approach, and intersection results.
*/
  analyze(): void;
/**
* @returns {number}
*/
  get_cycle_length_s(): number;
/**
* Intersection control delay d_I, s/veh (HCM Equation 19-29).
* @returns {number | undefined}
*/
  get_intersection_delay_s(): number | undefined;
/**
* Intersection LOS letter (HCM Exhibit 19-8), e.g. "D".
* @returns {string | undefined}
*/
  get_intersection_los(): string | undefined;
/**
* Critical intersection volume-to-capacity ratio X_c (HCM Equation 19-30).
* @returns {number | undefined}
*/
  get_critical_vc_ratio(): number | undefined;
/**
* Approach control delay for "NB", "SB", "EB", or "WB", s/veh
* (HCM Equation 19-28). NaN when the approach has no results.
* @param {string} direction
* @returns {number}
*/
  approach_delay_s(direction: string): number;
/**
* Approach LOS letter for "NB", "SB", "EB", or "WB" (HCM Exhibit 19-8).
* Empty string when the approach has no results.
* @param {string} direction
* @returns {string}
*/
  approach_los(direction: string): string;
/**
* Lane-group results (direction, kind, flow rate, saturation flow,
* capacity, v/c, delays, LOS, back of queue) as a JS array.
* @returns {any}
*/
  lane_groups_to_js_value(): any;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmSubSegment {
  free(): void;
/**
* @param {number | undefined} [length]
* @param {number | undefined} [avg_speed]
* @param {number | undefined} [design_rad]
* @param {number | undefined} [central_angle]
* @param {number | undefined} [hor_class]
* @param {number | undefined} [sup_ele]
*/
  constructor(length?: number, avg_speed?: number, design_rad?: number, central_angle?: number, hor_class?: number, sup_ele?: number);
/**
* @returns {any}
*/
  to_js_value(): any;
/**
* @returns {number}
*/
  get_length(): number;
/**
* @returns {number}
*/
  get_avg_speed(): number;
/**
* @returns {number}
*/
  get_hor_class(): number;
/**
* @returns {number}
*/
  get_design_rad(): number;
/**
* @returns {number}
*/
  get_central_angle(): number;
/**
* @returns {number}
*/
  get_sup_ele(): number;
}
/**
*/
export class WasmTwoLaneHighways {
  free(): void;
/**
* @param {(WasmSegment)[]} wasm_segments
* @param {number | undefined} [lane_width]
* @param {number | undefined} [shoulder_width]
* @param {number | undefined} [apd]
* @param {number | undefined} [pmhvfl]
* @param {number | undefined} [l_de]
*/
  constructor(wasm_segments: (WasmSegment)[], lane_width?: number, shoulder_width?: number, apd?: number, pmhvfl?: number, l_de?: number);
/**
* @returns {any}
*/
  segs_to_js_value(): any;
/**
* @returns {any}
*/
  get_segments(): any;
/**
* @param {number} seg_num
* @returns {Float64Array}
*/
  identify_vertical_class(seg_num: number): Float64Array;
/**
* @param {number} seg_num
* @returns {Float64Array}
*/
  determine_demand_flow(seg_num: number): Float64Array;
/**
* @param {number} seg_num
* @returns {number}
*/
  determine_vertical_alignment(seg_num: number): number;
/**
* @param {number} seg_num
* @returns {number}
*/
  determine_free_flow_speed(seg_num: number): number;
/**
* @param {number} seg_num
* @returns {Float64Array}
*/
  estimate_average_speed(seg_num: number): Float64Array;
/**
* @param {number} seg_num
* @returns {number}
*/
  estimate_percent_followers(seg_num: number): number;
/**
* @param {number} seg_num
* @param {number} length
* @param {number} vd
* @param {number} phv
* @param {number} rad
* @param {number} sup_ele
* @returns {Float64Array}
*/
  estimate_average_speed_sf(seg_num: number, length: number, vd: number, phv: number, rad: number, sup_ele: number): Float64Array;
/**
* @param {number} seg_num
* @param {number} vd
* @param {number} phv
* @returns {number}
*/
  estimate_percent_followers_sf(seg_num: number, vd: number, phv: number): number;
/**
* @param {number} seg_num
* @returns {Float64Array}
*/
  determine_follower_density_pl(seg_num: number): Float64Array;
/**
* @param {number} seg_num
* @returns {number}
*/
  determine_follower_density_pc_pz(seg_num: number): number;
/**
* @param {number} seg_num
* @returns {number}
*/
  determine_adjustment_to_follower_density(seg_num: number): number;
/**
* @param {number} seg_num
* @param {number} s_pl
* @param {number} cap
* @returns {string}
*/
  determine_segment_los(seg_num: number, s_pl: number, cap: number): string;
/**
* Step 11: length-weighted facility follower density, followers/mi/ln
* (Equation 15-39). Feed the result to `determine_facility_los`.
*
* Equation 15-39 defines FD_i as the "follower density, or adjusted
* follower density, for segment i", so the term a segment contributes is
* not always the `fd` that `segs_to_js_value` reports. A passing lane
* contributes its midpoint density FD_PLmid, a segment lying within the
* effective downstream length of an upstream passing lane contributes its
* Step 9 adjusted density, and only the remaining segments contribute the
* plain Step 8 density. Reweighting the `fd` column caller-side discards
* the Step 9 benefit, which is most of what Chapter 26 Example Problem 3
* is spent computing, and on that example it returns 8.041 and LOS D
* against the published 7.3 and LOS C.
*
* Steps 1 through 8 must already have run over every segment, since this
* reads their stored speeds, percent followers, and densities.
*
* The core walks the segments in order, because the effective downstream
* length of a passing lane is recorded when the walk reaches that passing
* lane and every later segment is measured against it. That recorded
* length is facility state, so a caller that has already run its own
* per-segment `determine_adjustment_to_follower_density` loop, as the
* calculator does to fill the FD-adjustment column, leaves it set and the
* walk would then find it already populated on the segments *upstream* of
* the passing lane, whose distance from that lane is zero. Those segments
* would take an adjustment they should not have. This binding therefore
* restores the constructor's `l_de` before delegating, so the result
* depends only on Steps 1 through 8 and not on what else has been called.
* On Chapter 26 Example Problem 4, whose passing lane is the fifth of six
* segments, the difference is 19.897 against 14.936.
* @returns {number}
*/
  determine_facility_follower_density(): number;
/**
* @param {number} fd
* @param {number} s_pl
* @returns {string}
*/
  determine_facility_los(fd: number, s_pl: number): string;
}
/**
*/
export class WasmTwsc {
  free(): void;
/**
* @param {number | undefined} [v1]
* @param {number | undefined} [v1u]
* @param {number | undefined} [v2]
* @param {number | undefined} [v3]
* @param {number | undefined} [v4]
* @param {number | undefined} [v4u]
* @param {number | undefined} [v5]
* @param {number | undefined} [v6]
* @param {number | undefined} [v7]
* @param {number | undefined} [v8]
* @param {number | undefined} [v9]
* @param {number | undefined} [v10]
* @param {number | undefined} [v11]
* @param {number | undefined} [v12]
* @param {number | undefined} [v13_ped]
* @param {number | undefined} [v14_ped]
* @param {number | undefined} [v15_ped]
* @param {number | undefined} [v16_ped]
* @param {boolean | undefined} [is_three_leg]
* @param {number | undefined} [major_lanes_per_direction]
* @param {string | undefined} [major_right_turn_eb]
* @param {string | undefined} [major_right_turn_wb]
* @param {string | undefined} [uturn_median_width]
* @param {number | undefined} [grade_minor_nb_pct]
* @param {number | undefined} [grade_minor_sb_pct]
* @param {string | undefined} [minor_lanes_nb]
* @param {string | undefined} [minor_lanes_sb]
* @param {number | undefined} [median_storage_nb]
* @param {number | undefined} [median_storage_sb]
* @param {number | undefined} [flare_storage_nb]
* @param {number | undefined} [flare_storage_sb]
* @param {number | undefined} [lane_width_ft]
* @param {number | undefined} [phf]
* @param {number | undefined} [analysis_period_h]
* @param {number | undefined} [heavy_vehicle_pct]
*/
  constructor(v1?: number, v1u?: number, v2?: number, v3?: number, v4?: number, v4u?: number, v5?: number, v6?: number, v7?: number, v8?: number, v9?: number, v10?: number, v11?: number, v12?: number, v13_ped?: number, v14_ped?: number, v15_ped?: number, v16_ped?: number, is_three_leg?: boolean, major_lanes_per_direction?: number, major_right_turn_eb?: string, major_right_turn_wb?: string, uturn_median_width?: string, grade_minor_nb_pct?: number, grade_minor_sb_pct?: number, minor_lanes_nb?: string, minor_lanes_sb?: string, median_storage_nb?: number, median_storage_sb?: number, flare_storage_nb?: number, flare_storage_sb?: number, lane_width_ft?: number, phf?: number, analysis_period_h?: number, heavy_vehicle_pct?: number);
/**
* Override a conflicting flow rate v_c,x, veh/h, before `analyze()`.
*
* `movement` is an Exhibit 20-1 label ("1", "1U", ..., "12") and
* `stage` is "total", "stage1", or "stage2". Setting either stage
* refreshes the one-stage total as the sum of the two stages; setting
* "total" leaves the stages alone. The HCM text below Exhibits 20-8
* through 20-16 allows the conflicting-flow factors to be modified
* from field data, which is what this is for. Overrides accumulate, so
* calling twice for the same movement and stage leaves the later value
* in force.
* @param {string} movement
* @param {string} stage
* @param {number} value
*/
  add_conflicting_flow_override(movement: string, stage: string, value: number): void;
/**
* Drop every conflicting-flow override added so far, returning the
* intersection to the Step 3 exhibit factors.
*/
  clear_conflicting_flow_overrides(): void;
/**
* Run the complete HCM Chapter 20 procedure (Steps 1-13).
*/
  analyze(): void;
/**
* Demand flow rate of a movement ("1", "1U", ..., "12"), veh/h.
* @param {string} movement
* @returns {number}
*/
  get_flow_rate(movement: string): number;
/**
* Conflicting flow rate v_c,x of a movement, veh/h (Step 3).
* @param {string} movement
* @returns {number | undefined}
*/
  get_conflicting_flow(movement: string): number | undefined;
/**
* Potential capacity c_p,x of a movement, veh/h (Equation 20-18).
* @param {string} movement
* @returns {number | undefined}
*/
  get_potential_capacity(movement: string): number | undefined;
/**
* Movement capacity c_m,x, veh/h (Steps 6-9).
* @param {string} movement
* @returns {number | undefined}
*/
  get_movement_capacity(movement: string): number | undefined;
/**
* Control delay of an exclusive-lane movement, s/veh (Equation 20-61).
* @param {string} movement
* @returns {number | undefined}
*/
  get_movement_delay(movement: string): number | undefined;
/**
* LOS letter of an exclusive-lane movement (Exhibit 20-2).
* @param {string} movement
* @returns {string | undefined}
*/
  get_movement_los(movement: string): string | undefined;
/**
* 95th percentile queue of a movement, veh (Equation 20-66).
* @param {string} movement
* @returns {number | undefined}
*/
  get_movement_queue_95(movement: string): number | undefined;
/**
* Number of minor-street approach lanes ("NB" or "SB").
* @param {string} approach
* @returns {number}
*/
  get_lane_count(approach: string): number;
/**
* Minor-approach lane result as an object with movements, flow_rate,
* capacity, control_delay, los, and queue_95.
* @param {string} approach
* @param {number} lane
* @returns {any}
*/
  lane_result_to_js_value(approach: string, lane: number): any;
/**
* Approach control delays [EB, WB, NB, SB], s/veh (Equation 20-64).
* Empty before `analyze()` has run.
* @returns {Float64Array}
*/
  get_approach_delays(): Float64Array;
/**
* Intersection control delay, s/veh (Equation 20-65). Note LOS is not
* defined for a TWSC intersection as a whole.
* @returns {number | undefined}
*/
  get_intersection_delay(): number | undefined;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmUrbanFacility {
  free(): void;
/**
* @param {number | undefined} [prop_left_turn_lanes]
*/
  constructor(prop_left_turn_lanes?: number);
/**
* Append a Chapter 18 segment (ordered upstream to downstream) to the
* facility in the subject direction of travel. Everything after
* `control` is optional.
*
* The trailing arguments are not in `WasmUrbanSegment`'s constructor
* order. This one runs `n_access_points_subject`,
* `n_access_points_opposing`, `midsegment_flow_veh_h`,
* `through_capacity_veh_h`, `through_control_delay_s`, `cycle_length_s`,
* `effective_green_s`, `platoon_ratio`, `sat_flow_veh_h_ln`,
* `full_stop_rate_override`, then the free-flow-speed geometry
* (`upstream_intersection_width_ft`, `restrictive_median_length_ft`,
* `proportion_with_curb`, `proportion_on_street_parking`,
* `prop_opposing_left_accessible`, `signal_spacing_ft`,
* `free_flow_speed_override_mph`), and finally the nine access-point
* delay arguments of Equation 18-7. Pass by position against this list,
* not against the segment constructor.
*
* Six `UrbanSegment` fields have no argument here and are reachable only
* through [`Self::add_segment_from_config`]: `arrival_type`,
* `stopped_vehicles_veh_ln`, `queue2_veh_ln`, `queue3_veh_ln`,
* `stop_rate_other`, and the per-segment `prop_left_turn_lanes` (the
* facility-wide one is a constructor argument).
*
* * `analysis_period_h` — read only by the computed Chapter 30 Section 4
*   access-point branch, which the segment enters only when
*   `access_point_approaches` is populated. That field has no argument
*   here, so on a segment added through this method the value is inert;
*   reach the branch through [`Self::add_segment_from_config`], whose
*   serde schema carries `access_point_approaches`.
* * `access_point_turn_delay_speed_mph` — same branch, same condition.
*   It overrides the posted speed limit in the right-turn delay term of
*   the Section 4 procedure, and is likewise inert without
*   `access_point_approaches`.
* @param {number} segment_length_ft
* @param {number} n_through_lanes
* @param {number} speed_limit_mph
* @param {number} through_demand_veh_h
* @param {string} control
* @param {number | undefined} [n_access_points_subject]
* @param {number | undefined} [n_access_points_opposing]
* @param {number | undefined} [midsegment_flow_veh_h]
* @param {number | undefined} [through_capacity_veh_h]
* @param {number | undefined} [through_control_delay_s]
* @param {number | undefined} [cycle_length_s]
* @param {number | undefined} [effective_green_s]
* @param {number | undefined} [platoon_ratio]
* @param {number | undefined} [sat_flow_veh_h_ln]
* @param {number | undefined} [full_stop_rate_override]
* @param {number | undefined} [upstream_intersection_width_ft]
* @param {number | undefined} [restrictive_median_length_ft]
* @param {number | undefined} [proportion_with_curb]
* @param {number | undefined} [proportion_on_street_parking]
* @param {number | undefined} [prop_opposing_left_accessible]
* @param {number | undefined} [signal_spacing_ft]
* @param {number | undefined} [free_flow_speed_override_mph]
* @param {Float64Array | undefined} [access_point_delays_s]
* @param {number | undefined} [n_influential_access_points]
* @param {number | undefined} [pct_left_turns_access]
* @param {number | undefined} [pct_right_turns_access]
* @param {boolean | undefined} [access_left_bay_adequate]
* @param {boolean | undefined} [access_right_bay_adequate]
* @param {number | undefined} [midsegment_other_delay_s]
* @param {number | undefined} [analysis_period_h]
* @param {number | undefined} [access_point_turn_delay_speed_mph]
*/
  add_segment(segment_length_ft: number, n_through_lanes: number, speed_limit_mph: number, through_demand_veh_h: number, control: string, n_access_points_subject?: number, n_access_points_opposing?: number, midsegment_flow_veh_h?: number, through_capacity_veh_h?: number, through_control_delay_s?: number, cycle_length_s?: number, effective_green_s?: number, platoon_ratio?: number, sat_flow_veh_h_ln?: number, full_stop_rate_override?: number, upstream_intersection_width_ft?: number, restrictive_median_length_ft?: number, proportion_with_curb?: number, proportion_on_street_parking?: number, prop_opposing_left_accessible?: number, signal_spacing_ft?: number, free_flow_speed_override_mph?: number, access_point_delays_s?: Float64Array, n_influential_access_points?: number, pct_left_turns_access?: number, pct_right_turns_access?: number, access_left_bay_adequate?: boolean, access_right_bay_adequate?: boolean, midsegment_other_delay_s?: number, analysis_period_h?: number, access_point_turn_delay_speed_mph?: number): void;
/**
* Append a segment from a configuration object matching the serde
* schema of the library's `UrbanSegment` — the same shape the library's
* own fixture files use (e.g. the `segments` entries of
* `tests/ExampleCases/hcm/UrbanFacilities/case3.json`), so a fixture
* segment is loadable verbatim in one call instead of through the
* 31-argument positional [`Self::add_segment`]. Five fields are
* required and throw when omitted — `segment_length_ft`,
* `n_through_lanes`, `speed_limit_mph`, `through_demand_veh_h`, and
* `control`. Every other field has a serde default; unknown fields are
* ignored, so misspelling a field name silently falls back to that
* default — prefer copying field names from the fixture files.
*
* A config may also carry the computed output fields (`base_ffs_mph`,
* `travel_speed_mph`, `spatial_stop_rate_stops_mi`, `vc_ratio`, `los`),
* as a serialized post-analysis fixture does. Such a segment is counted
* as a summary segment, exactly as if it had come through
* [`Self::add_segment_summary`], because its measures are already
* decided and re-running the Chapter 18 engine over the inputs beside
* them would overwrite what the caller supplied.
* @param {any} config
*/
  add_segment_from_config(config: any): void;
/**
* Append a segment described by its already-known Chapter 18
* performance measures rather than by its inputs — the Exhibit 16-7
* "HCM method output" case, and the one the published example problems
* take (Chapter 29 Example Problem 1 publishes per-segment base FFS,
* travel speed, and spatial stop rate, not the geometry behind them).
*
* The arguments are the fields of the library's `SegmentSummary`. Use
* with [`Self::aggregate`], which runs Chapter 16 Steps 1-4 over these
* measures; `analyze()` refuses to run once any summary segment is
* present, because there are no Chapter 18 inputs behind it to
* recompute from.
*
* * `spatial_stop_rate_stops_mi` — omit on any segment and the
*   Equation 16-4 facility stop rate (and the perception score built on
*   it) is reported as `undefined` rather than aggregated from a
*   partial set.
* * `vc_ratio` — the through movement's ratio at the segment's
*   downstream boundary intersection; the largest becomes the critical
*   ratio of the Exhibit 16-3 footnote.
* * `los` — the segment LOS letter, for the poorest-performing-segment
*   report of Step 4.
* @param {number} length_ft
* @param {number} base_ffs_mph
* @param {number} travel_speed_mph
* @param {number | undefined} [spatial_stop_rate_stops_mi]
* @param {number | undefined} [vc_ratio]
* @param {string | undefined} [los]
*/
  add_segment_summary(length_ft: number, base_ffs_mph: number, travel_speed_mph: number, spatial_stop_rate_stops_mi?: number, vc_ratio?: number, los?: string): void;
/**
* Run the Chapter 16 aggregation (Equations 16-2 through 16-4 and the
* Exhibit 16-3 LOS) over the per-segment measures already held. Returns
* the facility LOS letter. Use after [`Self::add_segment_summary`], or
* after `analyze()` to re-aggregate.
*
* This is also the entry point for a facility mixing the two kinds of
* segment. Segments that arrived with their measures already set are
* left exactly as supplied, and any segment still missing them is
* evaluated with the Chapter 18 engine first, so the aggregation sees a
* complete set either way.
* @returns {string}
*/
  aggregate(): string;
/**
* Run the full HCM Ch.16 pipeline: evaluate every segment with the
* Chapter 18 engine, then aggregate (Equations 16-2 through 16-4 and
* the Exhibit 16-3 LOS). Returns the facility LOS letter. Throws when
* any segment arrived carrying its own measures, whose Chapter 18 inputs
* are placeholders — use `aggregate()` there, which also handles a
* facility mixing supplied measures with input-driven segments.
* @returns {string}
*/
  analyze(): string;
/**
* @returns {number}
*/
  num_segments(): number;
/**
* @returns {number}
*/
  get_length_ft(): number;
/**
* @returns {number | undefined}
*/
  get_base_ffs(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_travel_speed(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_travel_time(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_base_free_flow_travel_time(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_spatial_stop_rate(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_critical_vc_ratio(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_perception_score(): number | undefined;
/**
* @returns {string}
*/
  get_los(): string;
/**
* @returns {string}
*/
  get_poorest_segment_los(): string;
/**
* Per-segment results (travel speed, base FFS, spatial stop rate, v/c
* ratio, LOS) as an array of plain objects, ordered upstream to
* downstream.
* @returns {any}
*/
  segments_to_js_value(): any;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmUrbanReliability {
  free(): void;
/**
* Scope: a fully signalized urban street facility (every segment's
* downstream boundary intersection is a traffic signal), evaluated
* with the HCM default demand-ratio, weather, and incident models.
* Each of the five monthly weather arrays takes 0, 1, or 12 entries
* (none, one value replicated to every month, or January-December
* values).
*
* * `monthly_total_snowfall_in` — climatological metadata only, carried
*   on the weather record but not read by the scenario generator. The
*   Chapter 29 weather procedure decides rain versus snow from the
*   sampled temperature (Equations 29-3 and 29-4) and sizes the snow
*   event from the precipitation columns through the snow-to-rain depth
*   ratio of Step 7, so a snow climate is expressed through
*   `monthly_mean_temp_f`, `monthly_total_precip_in`, and
*   `monthly_precip_rate_in_h`. Supplying or omitting this column does
*   not change any result.
* * `jan1_day_of_week` — 0 = Sunday through 6 = Saturday. This anchors
*   the calendar the reliability reporting period is built on, so a
*   wrong value shifts every Exhibit 17-6 day-of-week demand factor onto
*   the wrong day. Values above 6 are rejected rather than clamped.
* @param {string | undefined} functional_class
* @param {number | undefined} study_period_start_hour
* @param {number | undefined} analysis_periods_per_day
* @param {Float64Array} monthly_total_precip_in
* @param {Float64Array} monthly_days_with_precip
* @param {Float64Array} monthly_mean_temp_f
* @param {Float64Array} monthly_precip_rate_in_h
* @param {number | undefined} [entry_intersection_crash_frequency]
* @param {number | undefined} [minor_leg_volume_veh_h]
* @param {boolean | undefined} [shoulder_present]
* @param {boolean | undefined} [vmt_weighted]
* @param {number | undefined} [weather_seed]
* @param {number | undefined} [demand_seed]
* @param {number | undefined} [incident_seed]
* @param {Float64Array | undefined} [monthly_total_snowfall_in]
* @param {number | undefined} [jan1_day_of_week]
* @param {number | undefined} [prop_left_turn_lanes]
*/
  constructor(functional_class: string | undefined, study_period_start_hour: number | undefined, analysis_periods_per_day: number | undefined, monthly_total_precip_in: Float64Array, monthly_days_with_precip: Float64Array, monthly_mean_temp_f: Float64Array, monthly_precip_rate_in_h: Float64Array, entry_intersection_crash_frequency?: number, minor_leg_volume_veh_h?: number, shoulder_present?: boolean, vmt_weighted?: boolean, weather_seed?: number, demand_seed?: number, incident_seed?: number, monthly_total_snowfall_in?: Float64Array, jan1_day_of_week?: number, prop_left_turn_lanes?: number);
/**
* Register an ATDM strategy, work zone, or special event (HCM Chapter
* 17, Section 4). Strategies are applied to every scenario matching
* their schedule, as input-level adjustments to demand, saturation
* flow, effective green, free-flow speed, and crash frequency.
*
* `strategy` is an object matching the serde schema of
* `hcm::urban_reliability::AtdmStrategy`; every field has a
* no-effect default, so supply only what the strategy changes. The
* Chapter 29 Example Problem 5 Strategy 1 (5 s of split shifted to the
* coordinated through phase) is:
*
* ```json
* { "name": "EP5 Strategy 1", "effective_green_adjustment_s": 5.0 }
* ```
*
* An empty `months` / `days_of_week` / `periods` list means always
* active. Call before `run()`.
* @param {any} strategy
*/
  add_atdm_strategy(strategy: any): void;
/**
* Append a signalized Chapter 18 segment (ordered upstream to
* downstream) with its boundary-signal timing and the crash
* frequencies used by the incident generator. The intersection crash
* frequency belongs to the segment's downstream boundary
* intersection.
* @param {number} segment_length_ft
* @param {number} n_through_lanes
* @param {number} speed_limit_mph
* @param {number} through_demand_veh_h
* @param {number} cycle_length_s
* @param {number} effective_green_s
* @param {number | undefined} sat_flow_veh_h_ln
* @param {number | undefined} platoon_ratio
* @param {number | undefined} n_access_points_subject
* @param {number | undefined} n_access_points_opposing
* @param {number | undefined} full_stop_rate_override
* @param {number} segment_crash_frequency
* @param {number} intersection_crash_frequency
* @param {number | undefined} [k_factor]
* @param {number | undefined} [i_factor]
* @param {number | undefined} [approach_lanes]
*/
  add_segment(segment_length_ft: number, n_through_lanes: number, speed_limit_mph: number, through_demand_veh_h: number, cycle_length_s: number, effective_green_s: number, sat_flow_veh_h_ln: number | undefined, platoon_ratio: number | undefined, n_access_points_subject: number | undefined, n_access_points_opposing: number | undefined, full_stop_rate_override: number | undefined, segment_crash_frequency: number, intersection_crash_frequency: number, k_factor?: number, i_factor?: number, approach_lanes?: number): void;
/**
* Run the full HCM Ch.17 methodology: weather, demand, and incident
* scenario generation over a one-year reliability reporting period
* (weekdays), Chapter 16/18 evaluation of every scenario, and the
* travel time distribution summary.
*/
  run(): void;
/**
* @returns {number}
*/
  num_segments(): number;
/**
* @returns {number}
*/
  num_scenarios(): number;
/**
* @returns {number}
*/
  num_weather_events(): number;
/**
* @returns {number}
*/
  num_incidents(): number;
/**
* Scenarios flagged as oversaturated by the library, which marks a
* scenario when at least one boundary through movement either ran over
* capacity (v/c > 1) or began the analysis period with a residual queue
* carried in from the previous one (Q_b > 0). The count therefore
* includes undersaturated periods that inherited a queue, and it reads
* as how much of the travel-time distribution's tail is queue-driven
* rather than weather- or incident-driven. The two conditions are not
* separable through this surface; the library collapses them into one
* flag per scenario.
* @returns {number}
*/
  num_oversaturated_scenarios(): number;
/**
* @returns {number | undefined}
*/
  get_base_free_flow_travel_time(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_mean_travel_time(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_total_vhd(): number | undefined;
/**
* Mean travel time index across the weighted scenario distribution.
* @returns {number}
*/
  tti_mean(): number;
/**
* Weighted percentile TTI (p in 0-100), e.g. 95 for the planning
* time index.
* @param {number} p
* @returns {number}
*/
  tti_percentile(p: number): number;
/**
* Urban street reliability rating, percent of the weighted
* distribution with TTI below 2.5.
* @returns {number}
*/
  reliability_rating(): number;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmUrbanSegment {
  free(): void;
/**
* Build a Chapter 18 segment. Everything after `control` is optional
* and takes the Exhibit 18-5 default when omitted.
*
* The last nine arguments drive Step 2's access-point delay term
* `Σ d_ap,i` of Equation 18-7. The library picks among three sources in
* order: the Chapter 30, Section 4 procedure when access-point
* approaches have been added with [`Self::add_access_point`]; then
* `access_point_delays_s`, the per-point delays supplied directly (the
* Exhibit 30-35 published values take this path); then the Exhibit
* 18-13 planning estimate, whose inputs are
* `n_influential_access_points` (default `N_ap,s + p_ap,lt N_ap,o`),
* the two turn percentages (Exhibit 18-13 assumes 10% each), and the
* two turn-bay adequacy flags.
* @param {number} segment_length_ft
* @param {number} n_through_lanes
* @param {number} speed_limit_mph
* @param {number} through_demand_veh_h
* @param {string} control
* @param {number | undefined} [upstream_intersection_width_ft]
* @param {number | undefined} [restrictive_median_length_ft]
* @param {number | undefined} [proportion_with_curb]
* @param {number | undefined} [proportion_on_street_parking]
* @param {number | undefined} [n_access_points_subject]
* @param {number | undefined} [n_access_points_opposing]
* @param {number | undefined} [prop_opposing_left_accessible]
* @param {number | undefined} [signal_spacing_ft]
* @param {number | undefined} [free_flow_speed_override_mph]
* @param {number | undefined} [midsegment_flow_veh_h]
* @param {number | undefined} [through_capacity_veh_h]
* @param {number | undefined} [through_control_delay_s]
* @param {number | undefined} [cycle_length_s]
* @param {number | undefined} [effective_green_s]
* @param {number | undefined} [arrival_type]
* @param {number | undefined} [platoon_ratio]
* @param {number | undefined} [sat_flow_veh_h_ln]
* @param {number | undefined} [stopped_vehicles_veh_ln]
* @param {number | undefined} [queue2_veh_ln]
* @param {number | undefined} [queue3_veh_ln]
* @param {number | undefined} [full_stop_rate_override]
* @param {number | undefined} [stop_rate_other]
* @param {number | undefined} [prop_left_turn_lanes]
* @param {Float64Array | undefined} [access_point_delays_s]
* @param {number | undefined} [n_influential_access_points]
* @param {number | undefined} [pct_left_turns_access]
* @param {number | undefined} [pct_right_turns_access]
* @param {boolean | undefined} [access_left_bay_adequate]
* @param {boolean | undefined} [access_right_bay_adequate]
* @param {number | undefined} [midsegment_other_delay_s]
* @param {number | undefined} [analysis_period_h]
* @param {number | undefined} [access_point_turn_delay_speed_mph]
*/
  constructor(segment_length_ft: number, n_through_lanes: number, speed_limit_mph: number, through_demand_veh_h: number, control: string, upstream_intersection_width_ft?: number, restrictive_median_length_ft?: number, proportion_with_curb?: number, proportion_on_street_parking?: number, n_access_points_subject?: number, n_access_points_opposing?: number, prop_opposing_left_accessible?: number, signal_spacing_ft?: number, free_flow_speed_override_mph?: number, midsegment_flow_veh_h?: number, through_capacity_veh_h?: number, through_control_delay_s?: number, cycle_length_s?: number, effective_green_s?: number, arrival_type?: number, platoon_ratio?: number, sat_flow_veh_h_ln?: number, stopped_vehicles_veh_ln?: number, queue2_veh_ln?: number, queue3_veh_ln?: number, full_stop_rate_override?: number, stop_rate_other?: number, prop_left_turn_lanes?: number, access_point_delays_s?: Float64Array, n_influential_access_points?: number, pct_left_turns_access?: number, pct_right_turns_access?: number, access_left_bay_adequate?: boolean, access_right_bay_adequate?: boolean, midsegment_other_delay_s?: number, analysis_period_h?: number, access_point_turn_delay_speed_mph?: number);
/**
* Append one active access point approach in the subject direction of
* travel, switching Step 2 to the computed Chapter 30, Section 4
* procedure (Equations 30-31 through 30-68) for every access point on
* the segment. Call once per point, before `analyze()`.
*
* `approach` is an object matching the serde schema of
* `hcm::urban_segments::access_point_delay::AccessPointApproach`:
*
* ```json
* { "v_lt": 74.0, "v_th": 1002.0, "v_rt": 74.0,
*   "n_sl": 1, "n_t": 0, "n_sr": 1,
*   "opposing_flow_veh_h": 1076.0,
*   "left_turn_bay": false, "right_turn_bay": false,
*   "n_lt_lanes": 0, "left_bay_storage_ft": 0.0,
*   "pct_heavy_veh": 0.0 }
* ```
*
* The right-turn branch is evaluated at the posted speed limit unless
* `access_point_turn_delay_speed_mph` overrides it; that is what
* reproduces the Exhibit 30-35 published per-point delays (0.193 and
* 0.194 s/veh) and the 0.115 inside-lane blockage probability. See the
* VERIFY-HCM note in the library's `access_point_delay` module docs.
* @param {any} approach
*/
  add_access_point(approach: any): void;
/**
* Run the full HCM Ch.18 motorized vehicle pipeline (Steps 1-3 and
* 5-10) and return the segment LOS letter (Exhibit 18-1).
* Populates free-flow speed, running time, travel speed, stop rates,
* v/c ratio, and the perception score.
* @returns {string}
*/
  analyze(): string;
/**
* Speed constant S_0, mi/h (Exhibit 18-11, note a).
* @returns {number | undefined}
*/
  get_speed_constant(): number | undefined;
/**
* Cross-section adjustment f_CS, mi/h (Exhibit 18-11, note b).
* @returns {number | undefined}
*/
  get_f_cs(): number | undefined;
/**
* Access point adjustment f_A, mi/h (Exhibit 18-11, note c).
* @returns {number | undefined}
*/
  get_f_a(): number | undefined;
/**
* On-street parking adjustment f_pk, mi/h (Exhibit 18-11, note d).
* @returns {number | undefined}
*/
  get_f_pk(): number | undefined;
/**
* Signal spacing adjustment factor f_L (Equation 18-4).
* @returns {number | undefined}
*/
  get_f_l(): number | undefined;
/**
* Vehicle proximity adjustment factor f_v (Equation 18-6).
* @returns {number | undefined}
*/
  get_f_v(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_base_ffs(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_free_flow_speed(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_running_time(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_running_speed(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_proportion_arriving_green(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_access_point_delay(): number | undefined;
/**
* Per-access-point Chapter 30, Section 4 breakdown as a JS array of
* `{ delay_left_s, delay_right_s, delay_total_s,
* prob_inside_lane_blocked }` in the order the approaches were added
* (the Exhibit 30-35 columns). `null` unless approaches were supplied
* through [`Self::add_access_point`] and `analyze()` has run.
* @returns {any}
*/
  access_point_delays_computed(): any;
/**
* @returns {number | undefined}
*/
  get_through_delay(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_full_stop_rate(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_travel_speed(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_spatial_stop_rate(): number | undefined;
/**
* @returns {number | undefined}
*/
  get_vc_ratio(): number | undefined;
/**
* @returns {boolean | undefined}
*/
  get_demand_exceeds_capacity(): boolean | undefined;
/**
* @returns {number | undefined}
*/
  get_perception_score(): number | undefined;
/**
* @returns {string}
*/
  get_los(): string;
/**
* @returns {any}
*/
  results_to_js_value(): any;
}
/**
*/
export class WasmWeavingSegment {
  free(): void;
/**
* @param {string | undefined} [weaving_type]
* @param {string | undefined} [facility_type]
* @param {number | undefined} [length_short]
* @param {number | undefined} [num_lanes]
* @param {number | undefined} [num_weaving_lanes]
* @param {number | undefined} [ffs]
* @param {number | undefined} [v_ff]
* @param {number | undefined} [v_fr]
* @param {number | undefined} [v_rf]
* @param {number | undefined} [v_rr]
* @param {number | undefined} [phf]
* @param {number | undefined} [heavy_vehicle_pct]
* @param {string | undefined} [terrain]
* @param {number | undefined} [lc_rf]
* @param {number | undefined} [lc_fr]
* @param {number | undefined} [lc_rr]
* @param {number | undefined} [interchange_density]
* @param {number | undefined} [basic_freeway_capacity]
* @param {number | undefined} [caf]
* @param {number | undefined} [saf]
* @param {number | undefined} [nw_rf]
* @param {number | undefined} [nw_fr]
* @param {number | undefined} [nw_rr]
* @param {string | undefined} [version]
*/
  constructor(weaving_type?: string, facility_type?: string, length_short?: number, num_lanes?: number, num_weaving_lanes?: number, ffs?: number, v_ff?: number, v_fr?: number, v_rf?: number, v_rr?: number, phf?: number, heavy_vehicle_pct?: number, terrain?: string, lc_rf?: number, lc_fr?: number, lc_rr?: number, interchange_density?: number, basic_freeway_capacity?: number, caf?: number, saf?: number, nw_rf?: number, nw_fr?: number, nw_rr?: number, version?: string);
/**
* Full Edition 7.1 analysis as a JS object (null until `run_analysis()` has run on a
* version "7.1" segment). Fields follow the Rust `WeavingAnalysis` struct: class, flows,
* ffs_adj, speed_basic, weaving_intensity, speed_impedance, speed_avg (null far past
* capacity), capacity_per_lane, dc_ratio, density, los, and the rest.
* @returns {any}
*/
  analysis_v7_1(): any;
/**
* Run the full HCM Ch.13 analysis (Steps 2-8) and return the LOS letter.
* Populates flows, capacity, lane-changing rates, speeds, and density.
* @returns {string}
*/
  run_analysis(): string;
/**
* Step 2: demand flows under equivalent ideal conditions (Eq. 13-1).
* Returns [v_W, v_NW, v] in pc/h. 7th Edition only; throws on a "7.1" segment.
* @returns {Float64Array}
*/
  determine_demand_flow(): Float64Array;
/**
* Step 3: minimum lane-changing rate LC_MIN (lc/h) - Eqs. 13-2/13-3.
* 7th Edition only; throws on a "7.1" segment.
* @returns {number}
*/
  determine_configuration_characteristics(): number;
/**
* Step 4: maximum weaving length L_MAX (ft) - Eq. 13-4.
* 7th Edition only; throws on a "7.1" segment.
* @returns {number}
*/
  determine_max_weaving_length(): number;
/**
* Step 5: weaving segment capacity (veh/h) - Eqs. 13-5..13-10.
* 7th Edition only; throws on a "7.1" segment.
* @returns {number}
*/
  determine_capacity(): number;
/**
* Step 6: total lane-changing rate LC_ALL (lc/h) - Eqs. 13-11..13-17.
* 7th Edition only; throws on a "7.1" segment.
* @returns {number}
*/
  determine_lane_changing_rates(): number;
/**
* Step 7: speeds [S_W, S_NW, S] in mi/h - Eqs. 13-18..13-22.
* 7th Edition only; throws on a "7.1" segment.
* @returns {Float64Array}
*/
  estimate_speed(): Float64Array;
/**
* Step 8a: density (pc/mi/ln) - Eq. 13-23.
* 7th Edition only; throws on a "7.1" segment.
* @returns {number}
*/
  determine_density(): number;
/**
* Step 8b: level of service letter - Exhibit 13-6.
* 7th Edition only; throws on a "7.1" segment.
* @returns {string}
*/
  determine_los(): string;
/**
* @returns {number}
*/
  get_flow_weaving(): number;
/**
* @returns {number}
*/
  get_flow_nonweaving(): number;
/**
* @returns {number}
*/
  get_flow_total(): number;
/**
* @returns {number}
*/
  get_volume_ratio(): number;
/**
* @returns {number}
*/
  get_lc_min(): number;
/**
* @returns {number}
*/
  get_l_max(): number;
/**
* @returns {boolean}
*/
  is_weaving(): boolean;
/**
* Per-lane capacity from the density criterion c_IWL, pc/h/ln
* (Equation 13-5). This is the base freeway capacity discounted for
* the volume ratio, the number of weaving lanes, and the short length,
* before Equation 13-6 scales it to prevailing conditions.
* @returns {number}
*/
  get_c_iwl(): number;
/**
* @returns {number}
*/
  get_capacity(): number;
/**
* Capacity from the weaving-flow criterion, veh/h (Equations 13-7 and
* 13-8): the maximum weaving flow the configuration can carry (2,400
* pc/h with two weaving lanes, 3,500 with three) divided by the volume
* ratio. Undefined on a two-sided segment, where N_WL is zero and that
* criterion does not apply, so Equation 13-6 governs alone.
* @returns {number | undefined}
*/
  get_capacity_weaving(): number | undefined;
/**
* @returns {number}
*/
  get_vc_ratio(): number;
/**
* Lane-changing rate of weaving vehicles LC_W, lc/h (Equation 13-11).
* @returns {number}
*/
  get_lc_w(): number;
/**
* Lane-changing rate of nonweaving vehicles LC_NW, lc/h (Equation
* 13-16). The two components are exposed separately because they carry
* the configuration's cost differently: LC_W follows the short length
* and the number of lanes, while LC_NW switches between the Equation
* 13-12 and 13-13 branches on the nonweaving intensity I_NW.
* @returns {number}
*/
  get_lc_nw(): number;
/**
* @returns {number}
*/
  get_lc_all(): number;
/**
* @returns {number}
*/
  get_speed_weaving(): number;
/**
* @returns {number}
*/
  get_speed_nonweaving(): number;
/**
* @returns {number}
*/
  get_speed_avg(): number;
/**
* @returns {number}
*/
  get_density(): number;
/**
* @returns {string | undefined}
*/
  get_los(): string | undefined;
/**
* @returns {any}
*/
  results_to_js_value(): any;
/**
* The HCM edition this segment analyzes under, "7" or "7.1".
*/
  version: string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmfacilitysegment_free: (a: number) => void;
  readonly wasmfacilitysegment_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number, d1: number, e1: number, f1: number) => number;
  readonly wasmfacilitysegment_get_seg_type: (a: number, b: number) => void;
  readonly wasmfacilitysegment_get_length_ft: (a: number) => number;
  readonly wasmfacilitysegment_get_lanes: (a: number) => number;
  readonly wasmfacilitysegment_set_work_zone: (a: number, b: number, c: number) => void;
  readonly wasmfacilitysegment_clear_work_zone: (a: number) => void;
  readonly wasmfacilitysegment_has_work_zone: (a: number) => number;
  readonly wasmfacilitysegment_work_zone_lcsi: (a: number, b: number) => void;
  readonly wasmfacilitysegment_work_zone_caf: (a: number, b: number, c: number) => void;
  readonly wasmfacilitysegment_work_zone_saf: (a: number, b: number, c: number) => void;
  readonly __wbg_wasmfreewayfacility_free: (a: number) => void;
  readonly wasmfreewayfacility_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number) => number;
  readonly wasmfreewayfacility_run_analysis: (a: number, b: number) => void;
  readonly wasmfreewayfacility_num_segments: (a: number) => number;
  readonly wasmfreewayfacility_num_periods: (a: number) => number;
  readonly wasmfreewayfacility_total_length_mi: (a: number) => number;
  readonly wasmfreewayfacility_is_oversaturated: (a: number) => number;
  readonly wasmfreewayfacility_get_speed: (a: number, b: number, c: number) => number;
  readonly wasmfreewayfacility_get_density_veh: (a: number, b: number, c: number) => number;
  readonly wasmfreewayfacility_get_density_pc: (a: number, b: number, c: number) => number;
  readonly wasmfreewayfacility_get_dc_ratio: (a: number, b: number, c: number) => number;
  readonly wasmfreewayfacility_get_capacity: (a: number, b: number, c: number) => number;
  readonly wasmfreewayfacility_get_volume_served: (a: number, b: number, c: number) => number;
  readonly wasmfreewayfacility_get_queue_length_ft: (a: number, b: number, c: number) => number;
  readonly wasmfreewayfacility_get_los: (a: number, b: number, c: number, d: number) => void;
  readonly wasmfreewayfacility_get_facility_speed: (a: number, b: number) => number;
  readonly wasmfreewayfacility_get_facility_density_veh: (a: number, b: number) => number;
  readonly wasmfreewayfacility_get_facility_los: (a: number, b: number, c: number) => void;
  readonly wasmfreewayfacility_get_overall_speed: (a: number) => number;
  readonly wasmfreewayfacility_get_overall_density_veh: (a: number) => number;
  readonly wasmfreewayfacility_speed_matrix: (a: number) => number;
  readonly wasmfreewayfacility_density_matrix: (a: number) => number;
  readonly wasmfreewayfacility_dc_matrix: (a: number) => number;
  readonly wasmfreewayfacility_capacity_matrix: (a: number) => number;
  readonly wasmfreewayfacility_los_matrix: (a: number) => number;
  readonly wasmfreewayfacility_queue_matrix: (a: number) => number;
  readonly wasmfreewayfacility_volume_served_matrix: (a: number) => number;
  readonly wasmfreewayfacility_demand_based_los_matrix: (a: number) => number;
  readonly wasmfreewayfacility_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmmanagedlanefacility_free: (a: number) => void;
  readonly wasmmanagedlanefacility_new: (a: number, b: number) => void;
  readonly wasmmanagedlanefacility_from_gp: (a: number, b: number, c: number) => void;
  readonly wasmmanagedlanefacility_run_analysis: (a: number, b: number) => void;
  readonly wasmmanagedlanefacility_gp_facility: (a: number) => number;
  readonly wasmmanagedlanefacility_get_ml_demand: (a: number, b: number, c: number) => number;
  readonly wasmmanagedlanefacility_get_ml_capacity: (a: number, b: number, c: number) => number;
  readonly wasmmanagedlanefacility_get_ml_dc_ratio: (a: number, b: number, c: number) => number;
  readonly wasmmanagedlanefacility_get_ml_speed: (a: number, b: number, c: number) => number;
  readonly wasmmanagedlanefacility_get_ml_density_veh: (a: number, b: number, c: number) => number;
  readonly wasmmanagedlanefacility_get_ml_density_pc: (a: number, b: number, c: number) => number;
  readonly wasmmanagedlanefacility_get_ml_los: (a: number, b: number, c: number, d: number) => void;
  readonly wasmmanagedlanefacility_is_ml_friction_active: (a: number, b: number, c: number) => number;
  readonly wasmmanagedlanefacility_get_gp_group_speed: (a: number, b: number) => number;
  readonly wasmmanagedlanefacility_get_gp_group_density_veh: (a: number, b: number) => number;
  readonly wasmmanagedlanefacility_get_gp_group_los: (a: number, b: number, c: number) => void;
  readonly wasmmanagedlanefacility_get_ml_group_speed: (a: number, b: number) => number;
  readonly wasmmanagedlanefacility_get_ml_group_density_veh: (a: number, b: number) => number;
  readonly wasmmanagedlanefacility_get_ml_group_los: (a: number, b: number, c: number) => void;
  readonly wasmmanagedlanefacility_get_facility_speed: (a: number, b: number) => number;
  readonly wasmmanagedlanefacility_get_facility_density_veh: (a: number, b: number) => number;
  readonly wasmmanagedlanefacility_get_facility_los: (a: number, b: number, c: number) => void;
  readonly wasmmanagedlanefacility_ml_capacity_matrix: (a: number) => number;
  readonly wasmmanagedlanefacility_ml_dc_matrix: (a: number) => number;
  readonly wasmmanagedlanefacility_ml_speed_matrix: (a: number) => number;
  readonly wasmmanagedlanefacility_ml_density_matrix: (a: number) => number;
  readonly wasmmanagedlanefacility_ml_los_matrix: (a: number) => number;
  readonly wasmmanagedlanefacility_ml_friction_matrix: (a: number) => number;
  readonly wasmmanagedlanefacility_lane_group_performance_to_js_value: (a: number) => number;
  readonly wasmmanagedlanefacility_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmplanningfacility_free: (a: number) => void;
  readonly wasmplanningfacility_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number) => number;
  readonly wasmplanningfacility_run_analysis: (a: number, b: number) => void;
  readonly wasmplanningfacility_num_sections: (a: number) => number;
  readonly wasmplanningfacility_total_length_mi: (a: number) => number;
  readonly wasmplanningfacility_get_dc_ratio: (a: number, b: number, c: number) => number;
  readonly wasmplanningfacility_get_delay_rate: (a: number, b: number, c: number) => number;
  readonly wasmplanningfacility_get_section_speed: (a: number, b: number, c: number) => number;
  readonly wasmplanningfacility_get_section_density: (a: number, b: number, c: number) => number;
  readonly wasmplanningfacility_get_facility_speed: (a: number, b: number) => number;
  readonly wasmplanningfacility_get_facility_density: (a: number, b: number) => number;
  readonly wasmplanningfacility_get_facility_los: (a: number, b: number, c: number) => void;
  readonly wasmplanningfacility_get_facility_queue_mi: (a: number, b: number) => number;
  readonly wasmplanningfacility_results_to_js_value: (a: number) => number;
  readonly wasmmanagedlanefacility_num_segments: (a: number) => number;
  readonly wasmmanagedlanefacility_num_periods: (a: number) => number;
  readonly __wbg_wasmexclusivepedestrianfacility_free: (a: number) => void;
  readonly wasmexclusivepedestrianfacility_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => number;
  readonly wasmexclusivepedestrianfacility_analyze: (a: number, b: number) => void;
  readonly wasmexclusivepedestrianfacility_get_effective_width: (a: number) => number;
  readonly wasmexclusivepedestrianfacility_get_flow_rate_15min: (a: number) => number;
  readonly wasmexclusivepedestrianfacility_get_unit_flow_rate: (a: number) => number;
  readonly wasmexclusivepedestrianfacility_get_pedestrian_space: (a: number) => number;
  readonly wasmexclusivepedestrianfacility_get_vc_ratio: (a: number) => number;
  readonly wasmexclusivepedestrianfacility_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmsharedusepathpedestrian_free: (a: number) => void;
  readonly wasmsharedusepathpedestrian_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => number;
  readonly wasmsharedusepathpedestrian_analyze: (a: number, b: number) => void;
  readonly wasmsharedusepathpedestrian_get_meeting_events: (a: number) => number;
  readonly wasmsharedusepathpedestrian_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmoffstreetbicyclefacility_free: (a: number) => void;
  readonly wasmoffstreetbicyclefacility_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number) => number;
  readonly wasmoffstreetbicyclefacility_analyze: (a: number, b: number) => void;
  readonly wasmoffstreetbicyclefacility_get_active_passings_per_minute: (a: number) => number;
  readonly wasmoffstreetbicyclefacility_get_meetings_per_minute: (a: number) => number;
  readonly wasmoffstreetbicyclefacility_get_effective_lanes: (a: number) => number;
  readonly wasmoffstreetbicyclefacility_get_probability_delayed_passing: (a: number) => number;
  readonly wasmoffstreetbicyclefacility_get_delayed_passings_per_minute: (a: number) => number;
  readonly wasmoffstreetbicyclefacility_get_weighted_events_per_minute: (a: number) => number;
  readonly wasmoffstreetbicyclefacility_get_blos_score: (a: number) => number;
  readonly wasmoffstreetbicyclefacility_results_to_js_value: (a: number) => number;
  readonly wasmsharedusepathpedestrian_get_passing_events: (a: number) => number;
  readonly wasmsharedusepathpedestrian_get_total_events: (a: number) => number;
  readonly __wbg_wasmmanagedlanes_free: (a: number) => void;
  readonly wasmmanagedlanes_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
  readonly wasmmanagedlanes_run_analysis: (a: number, b: number) => void;
  readonly wasmmanagedlanes_calculate_breakpoint: (a: number) => number;
  readonly wasmmanagedlanes_calculate_capacity: (a: number) => number;
  readonly wasmmanagedlanes_calculate_speed: (a: number) => number;
  readonly wasmmanagedlanes_calculate_density: (a: number) => number;
  readonly wasmmanagedlanes_determine_los: (a: number, b: number) => void;
  readonly wasmmanagedlanes_set_demand: (a: number, b: number) => void;
  readonly wasmmanagedlanes_set_gp_density: (a: number, b: number) => void;
  readonly wasmmanagedlanes_get_breakpoint: (a: number) => number;
  readonly wasmmanagedlanes_get_capacity: (a: number) => number;
  readonly wasmmanagedlanes_get_speed: (a: number) => number;
  readonly wasmmanagedlanes_get_density: (a: number) => number;
  readonly wasmmanagedlanes_get_los: (a: number, b: number) => void;
  readonly wasmmanagedlanes_has_friction_effect: (a: number) => number;
  readonly wasmmanagedlanes_is_friction_active: (a: number) => number;
  readonly wasmmanagedlanes_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmrampsegment_free: (a: number) => void;
  readonly wasmrampsegment_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number, d1: number, e1: number, f1: number, g1: number, h1: number, i1: number, j1: number, k1: number, l1: number, m1: number, n1: number, o1: number, p1: number, q1: number, r1: number, s1: number, t1: number, u1: number, v1: number, w1: number, x1: number) => number;
  readonly wasmrampsegment_version: (a: number, b: number) => void;
  readonly wasmrampsegment_set_version: (a: number, b: number, c: number, d: number) => void;
  readonly wasmrampsegment_analysis_v7_1: (a: number, b: number) => void;
  readonly wasmrampsegment_run_analysis: (a: number, b: number) => void;
  readonly wasmrampsegment_determine_demand_flow: (a: number, b: number) => void;
  readonly wasmrampsegment_estimate_v12: (a: number, b: number) => void;
  readonly wasmrampsegment_determine_capacity: (a: number, b: number) => void;
  readonly wasmrampsegment_determine_density: (a: number, b: number) => void;
  readonly wasmrampsegment_determine_los: (a: number, b: number) => void;
  readonly wasmrampsegment_estimate_speed: (a: number, b: number) => void;
  readonly wasmrampsegment_get_flow_freeway: (a: number) => number;
  readonly wasmrampsegment_get_flow_ramp: (a: number) => number;
  readonly wasmrampsegment_get_p_f: (a: number, b: number) => void;
  readonly wasmrampsegment_get_v12: (a: number) => number;
  readonly wasmrampsegment_get_vr12: (a: number) => number;
  readonly wasmrampsegment_get_capacity_freeway: (a: number) => number;
  readonly wasmrampsegment_get_capacity_ramp: (a: number) => number;
  readonly wasmrampsegment_get_vc_ratio: (a: number) => number;
  readonly wasmrampsegment_get_demand_exceeds_capacity: (a: number) => number;
  readonly wasmrampsegment_get_exceeds_max_desirable: (a: number) => number;
  readonly wasmrampsegment_get_density: (a: number) => number;
  readonly wasmrampsegment_get_speed_ramp: (a: number) => number;
  readonly wasmrampsegment_get_speed_outer: (a: number, b: number) => void;
  readonly wasmrampsegment_get_speed_avg: (a: number) => number;
  readonly wasmrampsegment_get_los: (a: number, b: number) => void;
  readonly wasmrampsegment_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmsubsegment_free: (a: number) => void;
  readonly wasmsubsegment_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
  readonly wasmsubsegment_to_js_value: (a: number) => number;
  readonly wasmsubsegment_get_length: (a: number) => number;
  readonly wasmsubsegment_get_avg_speed: (a: number) => number;
  readonly wasmsubsegment_get_hor_class: (a: number) => number;
  readonly __wbg_wasmsegment_free: (a: number) => void;
  readonly wasmsegment_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number, d1: number, e1: number, f1: number, g1: number, h1: number, i1: number) => number;
  readonly wasmsegment_to_js_value: (a: number) => number;
  readonly wasmsegment_get_passing_type: (a: number) => number;
  readonly wasmsegment_get_length: (a: number) => number;
  readonly wasmsegment_get_grade: (a: number) => number;
  readonly wasmsegment_get_spl: (a: number) => number;
  readonly wasmsegment_get_is_hc: (a: number) => number;
  readonly wasmsegment_get_volume: (a: number) => number;
  readonly wasmsegment_get_volume_op: (a: number) => number;
  readonly wasmsegment_get_flow_rate: (a: number) => number;
  readonly wasmsegment_get_flow_rate_o: (a: number) => number;
  readonly wasmsegment_get_capacity: (a: number) => number;
  readonly wasmsegment_get_ffs: (a: number) => number;
  readonly wasmsegment_get_avg_speed: (a: number) => number;
  readonly wasmsegment_get_subsegments: (a: number) => number;
  readonly wasmsegment_get_vertical_class: (a: number) => number;
  readonly wasmsegment_get_phf: (a: number) => number;
  readonly wasmsegment_get_phv: (a: number) => number;
  readonly wasmsegment_get_percent_followers: (a: number) => number;
  readonly wasmsegment_get_followers_density: (a: number) => number;
  readonly wasmsegment_get_followers_density_mid: (a: number) => number;
  readonly wasmsegment_get_hor_class: (a: number) => number;
  readonly __wbg_wasmtwolanehighways_free: (a: number) => void;
  readonly wasmtwolanehighways_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
  readonly wasmtwolanehighways_get_segments: (a: number) => number;
  readonly wasmtwolanehighways_identify_vertical_class: (a: number, b: number, c: number) => void;
  readonly wasmtwolanehighways_determine_demand_flow: (a: number, b: number, c: number) => void;
  readonly wasmtwolanehighways_determine_vertical_alignment: (a: number, b: number) => number;
  readonly wasmtwolanehighways_determine_free_flow_speed: (a: number, b: number) => number;
  readonly wasmtwolanehighways_estimate_average_speed: (a: number, b: number, c: number) => void;
  readonly wasmtwolanehighways_estimate_percent_followers: (a: number, b: number) => number;
  readonly wasmtwolanehighways_estimate_average_speed_sf: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
  readonly wasmtwolanehighways_estimate_percent_followers_sf: (a: number, b: number, c: number, d: number) => number;
  readonly wasmtwolanehighways_determine_follower_density_pl: (a: number, b: number, c: number) => void;
  readonly wasmtwolanehighways_determine_follower_density_pc_pz: (a: number, b: number) => number;
  readonly wasmtwolanehighways_determine_adjustment_to_follower_density: (a: number, b: number) => number;
  readonly wasmtwolanehighways_determine_segment_los: (a: number, b: number, c: number, d: number) => number;
  readonly wasmtwolanehighways_determine_facility_follower_density: (a: number) => number;
  readonly wasmtwolanehighways_determine_facility_los: (a: number, b: number, c: number) => number;
  readonly wasmsubsegment_get_design_rad: (a: number) => number;
  readonly wasmsubsegment_get_central_angle: (a: number) => number;
  readonly wasmsubsegment_get_sup_ele: (a: number) => number;
  readonly wasmsegment_subsegs_to_js_value: (a: number) => number;
  readonly wasmtwolanehighways_segs_to_js_value: (a: number) => number;
  readonly __wbg_wasmawsc_free: (a: number) => void;
  readonly wasmawsc_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number) => void;
  readonly wasmawsc_analyze: (a: number) => void;
  readonly wasmawsc_get_iterations: (a: number, b: number) => void;
  readonly wasmawsc_get_lane_count: (a: number, b: number, c: number, d: number) => void;
  readonly wasmawsc_get_departure_headway: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmawsc_get_degree_of_utilization: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmawsc_get_service_time: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmawsc_get_lane_delay: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmawsc_get_lane_los: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmawsc_get_lane_queue_95: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmawsc_compute_lane_capacity: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmawsc_get_approach_delay: (a: number, b: number, c: number, d: number) => void;
  readonly wasmawsc_get_approach_los: (a: number, b: number, c: number, d: number) => void;
  readonly wasmawsc_get_intersection_delay: (a: number, b: number) => void;
  readonly wasmawsc_get_intersection_los: (a: number, b: number) => void;
  readonly wasmawsc_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmroundabouts_free: (a: number) => void;
  readonly wasmroundabouts_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number) => void;
  readonly wasmroundabouts_analyze: (a: number) => void;
  readonly wasmroundabouts_set_calibration: (a: number, b: number, c: number) => void;
  readonly wasmroundabouts_get_circulating_flow_pce: (a: number, b: number, c: number, d: number) => void;
  readonly wasmroundabouts_get_lane_count: (a: number, b: number, c: number, d: number) => void;
  readonly wasmroundabouts_lane_result_to_js_value: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmroundabouts_bypass_result_to_js_value: (a: number, b: number, c: number, d: number) => void;
  readonly wasmroundabouts_get_approach_delay: (a: number, b: number, c: number, d: number) => void;
  readonly wasmroundabouts_get_approach_los: (a: number, b: number, c: number, d: number) => void;
  readonly wasmroundabouts_get_intersection_delay: (a: number, b: number) => void;
  readonly wasmroundabouts_get_intersection_los: (a: number, b: number) => void;
  readonly wasmroundabouts_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmurbanfacility_free: (a: number) => void;
  readonly wasmurbanfacility_new: (a: number, b: number) => number;
  readonly wasmurbanfacility_add_segment: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number, d1: number, e1: number, f1: number, g1: number, h1: number, i1: number, j1: number, k1: number, l1: number, m1: number, n1: number, o1: number, p1: number, q1: number, r1: number, s1: number, t1: number, u1: number, v1: number, w1: number, x1: number, y1: number, z1: number, a2: number, b2: number, c2: number, d2: number, e2: number) => void;
  readonly wasmurbanfacility_add_segment_from_config: (a: number, b: number, c: number) => void;
  readonly wasmurbanfacility_add_segment_summary: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
  readonly wasmurbanfacility_aggregate: (a: number, b: number) => void;
  readonly wasmurbanfacility_analyze: (a: number, b: number) => void;
  readonly wasmurbanfacility_num_segments: (a: number) => number;
  readonly wasmurbanfacility_get_length_ft: (a: number) => number;
  readonly wasmurbanfacility_get_base_ffs: (a: number, b: number) => void;
  readonly wasmurbanfacility_get_travel_speed: (a: number, b: number) => void;
  readonly wasmurbanfacility_get_travel_time: (a: number, b: number) => void;
  readonly wasmurbanfacility_get_base_free_flow_travel_time: (a: number, b: number) => void;
  readonly wasmurbanfacility_get_spatial_stop_rate: (a: number, b: number) => void;
  readonly wasmurbanfacility_get_critical_vc_ratio: (a: number, b: number) => void;
  readonly wasmurbanfacility_get_perception_score: (a: number, b: number) => void;
  readonly wasmurbanfacility_get_los: (a: number, b: number) => void;
  readonly wasmurbanfacility_get_poorest_segment_los: (a: number, b: number) => void;
  readonly wasmurbanfacility_segments_to_js_value: (a: number) => number;
  readonly wasmurbanfacility_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmurbansegment_free: (a: number) => void;
  readonly wasmurbansegment_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number, d1: number, e1: number, f1: number, g1: number, h1: number, i1: number, j1: number, k1: number, l1: number, m1: number, n1: number, o1: number, p1: number, q1: number, r1: number, s1: number, t1: number, u1: number, v1: number, w1: number, x1: number, y1: number, z1: number, a2: number, b2: number, c2: number, d2: number, e2: number, f2: number, g2: number, h2: number, i2: number, j2: number, k2: number, l2: number, m2: number, n2: number, o2: number, p2: number) => number;
  readonly wasmurbansegment_add_access_point: (a: number, b: number, c: number) => void;
  readonly wasmurbansegment_analyze: (a: number, b: number) => void;
  readonly wasmurbansegment_get_speed_constant: (a: number, b: number) => void;
  readonly wasmurbansegment_get_f_cs: (a: number, b: number) => void;
  readonly wasmurbansegment_get_f_a: (a: number, b: number) => void;
  readonly wasmurbansegment_get_f_pk: (a: number, b: number) => void;
  readonly wasmurbansegment_get_f_l: (a: number, b: number) => void;
  readonly wasmurbansegment_get_f_v: (a: number, b: number) => void;
  readonly wasmurbansegment_get_base_ffs: (a: number, b: number) => void;
  readonly wasmurbansegment_get_free_flow_speed: (a: number, b: number) => void;
  readonly wasmurbansegment_get_running_time: (a: number, b: number) => void;
  readonly wasmurbansegment_get_running_speed: (a: number, b: number) => void;
  readonly wasmurbansegment_get_proportion_arriving_green: (a: number, b: number) => void;
  readonly wasmurbansegment_get_access_point_delay: (a: number, b: number) => void;
  readonly wasmurbansegment_access_point_delays_computed: (a: number) => number;
  readonly wasmurbansegment_get_through_delay: (a: number, b: number) => void;
  readonly wasmurbansegment_get_full_stop_rate: (a: number, b: number) => void;
  readonly wasmurbansegment_get_travel_speed: (a: number, b: number) => void;
  readonly wasmurbansegment_get_spatial_stop_rate: (a: number, b: number) => void;
  readonly wasmurbansegment_get_vc_ratio: (a: number, b: number) => void;
  readonly wasmurbansegment_get_demand_exceeds_capacity: (a: number) => number;
  readonly wasmurbansegment_get_perception_score: (a: number, b: number) => void;
  readonly wasmurbansegment_get_los: (a: number, b: number) => void;
  readonly wasmurbansegment_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmsignalizedintersection_free: (a: number) => void;
  readonly wasmsignalizedintersection_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number) => number;
  readonly wasmsignalizedintersection_from_config: (a: number, b: number) => void;
  readonly wasmsignalizedintersection_analyze: (a: number) => void;
  readonly wasmsignalizedintersection_get_cycle_length_s: (a: number) => number;
  readonly wasmsignalizedintersection_get_intersection_delay_s: (a: number, b: number) => void;
  readonly wasmsignalizedintersection_get_intersection_los: (a: number, b: number) => void;
  readonly wasmsignalizedintersection_get_critical_vc_ratio: (a: number, b: number) => void;
  readonly wasmsignalizedintersection_approach_delay_s: (a: number, b: number, c: number) => number;
  readonly wasmsignalizedintersection_approach_los: (a: number, b: number, c: number, d: number) => void;
  readonly wasmsignalizedintersection_lane_groups_to_js_value: (a: number) => number;
  readonly wasmsignalizedintersection_results_to_js_value: (a: number) => number;
  readonly __wbg_wasminterchange_free: (a: number) => void;
  readonly wasminterchange_new: (a: number, b: number) => void;
  readonly wasminterchange_get_form: (a: number, b: number) => void;
  readonly wasminterchange_analyze: (a: number) => void;
  readonly wasminterchange_get_cycle_length_s: (a: number) => number;
  readonly wasminterchange_get_peak_hour_factor: (a: number) => number;
  readonly wasminterchange_get_interchange_ett_s: (a: number, b: number) => void;
  readonly wasminterchange_get_interchange_los: (a: number, b: number) => void;
  readonly wasminterchange_od_results_to_js_value: (a: number) => number;
  readonly wasminterchange_lane_group_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmdisplacedleftturn_free: (a: number) => void;
  readonly wasmdisplacedleftturn_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly wasmdisplacedleftturn_get_intersection_ett_s: (a: number) => number;
  readonly wasmdisplacedleftturn_get_los: (a: number, b: number) => void;
  readonly __wbg_wasmbasicfreeways_free: (a: number) => void;
  readonly wasmbasicfreeways_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number, d1: number, e1: number, f1: number, g1: number, h1: number) => number;
  readonly wasmbasicfreeways_run_operational_analysis: (a: number, b: number) => void;
  readonly wasmbasicfreeways_determine_free_flow_speed: (a: number) => number;
  readonly wasmbasicfreeways_get_ffs: (a: number) => number;
  readonly wasmbasicfreeways_get_ffs_adj: (a: number) => number;
  readonly wasmbasicfreeways_get_breakpoint: (a: number) => number;
  readonly wasmbasicfreeways_get_capacity: (a: number) => number;
  readonly wasmbasicfreeways_get_adjusted_capacity: (a: number) => number;
  readonly wasmbasicfreeways_get_speed: (a: number) => number;
  readonly wasmbasicfreeways_get_density: (a: number) => number;
  readonly wasmbasicfreeways_get_vc_ratio: (a: number) => number;
  readonly wasmbasicfreeways_get_demand_volume: (a: number) => number;
  readonly wasmbasicfreeways_get_lane_count: (a: number) => number;
  readonly wasmbasicfreeways_get_e_t: (a: number) => number;
  readonly wasmbasicfreeways_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmweavingsegment_free: (a: number) => void;
  readonly wasmweavingsegment_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number, d1: number, e1: number, f1: number, g1: number, h1: number, i1: number, j1: number, k1: number, l1: number, m1: number, n1: number, o1: number, p1: number, q1: number, r1: number, s1: number, t1: number, u1: number, v1: number) => number;
  readonly wasmweavingsegment_version: (a: number, b: number) => void;
  readonly wasmweavingsegment_set_version: (a: number, b: number, c: number, d: number) => void;
  readonly wasmweavingsegment_analysis_v7_1: (a: number, b: number) => void;
  readonly wasmweavingsegment_run_analysis: (a: number, b: number) => void;
  readonly wasmweavingsegment_determine_demand_flow: (a: number, b: number) => void;
  readonly wasmweavingsegment_determine_configuration_characteristics: (a: number, b: number) => void;
  readonly wasmweavingsegment_determine_max_weaving_length: (a: number, b: number) => void;
  readonly wasmweavingsegment_determine_capacity: (a: number, b: number) => void;
  readonly wasmweavingsegment_determine_lane_changing_rates: (a: number, b: number) => void;
  readonly wasmweavingsegment_estimate_speed: (a: number, b: number) => void;
  readonly wasmweavingsegment_determine_density: (a: number, b: number) => void;
  readonly wasmweavingsegment_determine_los: (a: number, b: number) => void;
  readonly wasmweavingsegment_get_flow_weaving: (a: number) => number;
  readonly wasmweavingsegment_get_flow_total: (a: number) => number;
  readonly wasmweavingsegment_get_volume_ratio: (a: number) => number;
  readonly wasmweavingsegment_get_lc_min: (a: number) => number;
  readonly wasmweavingsegment_get_l_max: (a: number) => number;
  readonly wasmweavingsegment_is_weaving: (a: number) => number;
  readonly wasmweavingsegment_get_c_iwl: (a: number) => number;
  readonly wasmweavingsegment_get_capacity: (a: number) => number;
  readonly wasmweavingsegment_get_capacity_weaving: (a: number, b: number) => void;
  readonly wasmweavingsegment_get_vc_ratio: (a: number) => number;
  readonly wasmweavingsegment_get_lc_w: (a: number) => number;
  readonly wasmweavingsegment_get_lc_nw: (a: number) => number;
  readonly wasmweavingsegment_get_lc_all: (a: number) => number;
  readonly wasmweavingsegment_get_speed_weaving: (a: number) => number;
  readonly wasmweavingsegment_get_speed_nonweaving: (a: number) => number;
  readonly wasmweavingsegment_get_speed_avg: (a: number) => number;
  readonly wasmweavingsegment_get_density: (a: number) => number;
  readonly wasmweavingsegment_get_los: (a: number, b: number) => void;
  readonly wasmweavingsegment_results_to_js_value: (a: number) => number;
  readonly wasmweavingsegment_get_flow_nonweaving: (a: number) => number;
  readonly __wbg_wasmfreewayreliability_free: (a: number) => void;
  readonly wasmfreewayreliability_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number, d1: number, e1: number, f1: number, g1: number, h1: number, i1: number, j1: number, k1: number) => number;
  readonly wasmfreewayreliability_set_weather: (a: number, b: number, c: number) => void;
  readonly wasmfreewayreliability_clear_weather: (a: number) => void;
  readonly wasmfreewayreliability_has_weather: (a: number) => number;
  readonly wasmfreewayreliability_set_demand_multipliers: (a: number, b: number, c: number) => void;
  readonly wasmfreewayreliability_seed_demand_multiplier: (a: number) => number;
  readonly wasmfreewayreliability_run: (a: number, b: number) => void;
  readonly wasmfreewayreliability_seed_total_vmt: (a: number) => number;
  readonly wasmfreewayreliability_seed_num_periods: (a: number) => number;
  readonly wasmfreewayreliability_num_scenarios: (a: number) => number;
  readonly wasmfreewayreliability_num_observations: (a: number) => number;
  readonly wasmfreewayreliability_free_flow_travel_time_min: (a: number) => number;
  readonly wasmfreewayreliability_expected_vhd: (a: number) => number;
  readonly wasmfreewayreliability_tti_mean: (a: number) => number;
  readonly wasmfreewayreliability_tti_percentile: (a: number, b: number) => number;
  readonly wasmfreewayreliability_tti_max: (a: number) => number;
  readonly wasmfreewayreliability_pct_tti_above: (a: number, b: number) => number;
  readonly wasmfreewayreliability_misery_index: (a: number) => number;
  readonly wasmfreewayreliability_reliability_rating: (a: number) => number;
  readonly wasmfreewayreliability_semi_std_dev: (a: number) => number;
  readonly wasmfreewayreliability_failure_pct_below_speed: (a: number, b: number) => number;
  readonly wasmfreewayreliability_on_time_pct_at_speed: (a: number, b: number) => number;
  readonly wasmfreewayreliability_scenario_probabilities: (a: number, b: number) => void;
  readonly wasmfreewayreliability_scenario_months: (a: number, b: number) => void;
  readonly wasmfreewayreliability_scenario_weekdays: (a: number, b: number) => void;
  readonly wasmfreewayreliability_scenario_dafs: (a: number, b: number) => void;
  readonly wasmfreewayreliability_scenario_incident_counts: (a: number, b: number) => void;
  readonly wasmfreewayreliability_monthly_incident_frequencies: (a: number, b: number) => void;
  readonly wasmfreewayreliability_expected_weather_event_counts: (a: number) => number;
  readonly wasmfreewayreliability_total_weather_events: (a: number) => number;
  readonly wasmfreewayreliability_scenario_weather_event_counts: (a: number, b: number) => void;
  readonly wasmfreewayreliability_total_incidents: (a: number) => number;
  readonly wasmfreewayreliability_scenario_tti_matrix: (a: number) => number;
  readonly wasmfreewayreliability_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmurbanreliability_free: (a: number) => void;
  readonly wasmurbanreliability_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number, d1: number, e1: number, f1: number, g1: number) => void;
  readonly wasmurbanreliability_add_atdm_strategy: (a: number, b: number, c: number) => void;
  readonly wasmurbanreliability_add_segment: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number) => void;
  readonly wasmurbanreliability_run: (a: number, b: number) => void;
  readonly wasmurbanreliability_num_segments: (a: number) => number;
  readonly wasmurbanreliability_num_scenarios: (a: number) => number;
  readonly wasmurbanreliability_num_weather_events: (a: number) => number;
  readonly wasmurbanreliability_num_incidents: (a: number) => number;
  readonly wasmurbanreliability_num_oversaturated_scenarios: (a: number) => number;
  readonly wasmurbanreliability_get_base_free_flow_travel_time: (a: number, b: number) => void;
  readonly wasmurbanreliability_get_mean_travel_time: (a: number, b: number) => void;
  readonly wasmurbanreliability_get_total_vhd: (a: number, b: number) => void;
  readonly wasmurbanreliability_tti_mean: (a: number) => number;
  readonly wasmurbanreliability_tti_percentile: (a: number, b: number) => number;
  readonly wasmurbanreliability_reliability_rating: (a: number) => number;
  readonly wasmurbanreliability_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmtwsc_free: (a: number) => void;
  readonly wasmtwsc_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number, a1: number, b1: number, c1: number, d1: number, e1: number, f1: number, g1: number, h1: number, i1: number, j1: number, k1: number, l1: number, m1: number, n1: number, o1: number, p1: number, q1: number, r1: number, s1: number, t1: number, u1: number, v1: number, w1: number, x1: number, y1: number, z1: number, a2: number, b2: number, c2: number, d2: number, e2: number, f2: number, g2: number, h2: number, i2: number, j2: number, k2: number, l2: number, m2: number, n2: number, o2: number, p2: number, q2: number, r2: number) => void;
  readonly wasmtwsc_add_conflicting_flow_override: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly wasmtwsc_clear_conflicting_flow_overrides: (a: number) => void;
  readonly wasmtwsc_analyze: (a: number) => void;
  readonly wasmtwsc_get_flow_rate: (a: number, b: number, c: number, d: number) => void;
  readonly wasmtwsc_get_conflicting_flow: (a: number, b: number, c: number, d: number) => void;
  readonly wasmtwsc_get_potential_capacity: (a: number, b: number, c: number, d: number) => void;
  readonly wasmtwsc_get_movement_capacity: (a: number, b: number, c: number, d: number) => void;
  readonly wasmtwsc_get_movement_delay: (a: number, b: number, c: number, d: number) => void;
  readonly wasmtwsc_get_movement_los: (a: number, b: number, c: number, d: number) => void;
  readonly wasmtwsc_get_movement_queue_95: (a: number, b: number, c: number, d: number) => void;
  readonly wasmtwsc_get_lane_count: (a: number, b: number, c: number, d: number) => void;
  readonly wasmtwsc_lane_result_to_js_value: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmtwsc_get_approach_delays: (a: number, b: number) => void;
  readonly wasmtwsc_get_intersection_delay: (a: number, b: number) => void;
  readonly wasmtwsc_results_to_js_value: (a: number) => number;
  readonly __wbg_wasmalternativeintersection_free: (a: number) => void;
  readonly wasmalternativeintersection_new: (a: number, b: number) => void;
  readonly wasmalternativeintersection_movement_results_to_js_value: (a: number) => number;
  readonly wasmalternativeintersection_get_approach_ett_s: (a: number, b: number, c: number, d: number) => void;
  readonly wasmalternativeintersection_get_intersection_ett_s: (a: number, b: number) => void;
  readonly wasmalternativeintersection_get_intersection_los: (a: number, b: number) => void;
  readonly edtt_merge: (a: number, b: number, c: number, d: number) => number;
  readonly edtt_stop_or_signal: (a: number, b: number, c: number) => number;
  readonly uturn_saturation_adjustment: (a: number) => number;
  readonly stop_junction_delay: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly dlt_offset: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
