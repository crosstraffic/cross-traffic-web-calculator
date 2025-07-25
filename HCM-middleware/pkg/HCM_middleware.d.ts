/* tslint:disable */
/* eslint-disable */
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
* @param {number} fd
* @param {number} s_pl
* @returns {string}
*/
  determine_facility_los(fd: number, s_pl: number): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
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
  readonly wasmtwolanehighways_determine_facility_los: (a: number, b: number, c: number) => number;
  readonly wasmsubsegment_get_design_rad: (a: number) => number;
  readonly wasmsubsegment_get_central_angle: (a: number) => number;
  readonly wasmsubsegment_get_sup_ele: (a: number) => number;
  readonly wasmsegment_subsegs_to_js_value: (a: number) => number;
  readonly wasmtwolanehighways_segs_to_js_value: (a: number) => number;
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
