let wasm;

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

let heap_next = heap.length;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function getObject(idx) { return heap[idx]; }

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

let cachedBigInt64Memory0 = null;

function getBigInt64Memory0() {
    if (cachedBigInt64Memory0 === null || cachedBigInt64Memory0.byteLength === 0) {
        cachedBigInt64Memory0 = new BigInt64Array(wasm.memory.buffer);
    }
    return cachedBigInt64Memory0;
}

let cachedInt32Memory0 = null;

function getInt32Memory0() {
    if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
        cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32Memory0;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

let WASM_VECTOR_LEN = 0;

let cachedUint8Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8Memory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

let cachedFloat64Memory0 = null;

function getFloat64Memory0() {
    if (cachedFloat64Memory0 === null || cachedFloat64Memory0.byteLength === 0) {
        cachedFloat64Memory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64Memory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_exn_store(addHeapObject(e));
    }
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64Memory0().subarray(ptr / 8, ptr / 8 + len);
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64Memory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedUint32Memory0 = null;

function getUint32Memory0() {
    if (cachedUint32Memory0 === null || cachedUint32Memory0.byteLength === 0) {
        cachedUint32Memory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32Memory0;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    const mem = getUint32Memory0();
    for (let i = 0; i < array.length; i++) {
        mem[ptr / 4 + i] = addHeapObject(array[i]);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32Memory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

const WasmAwscFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmawsc_free(ptr >>> 0));
/**
*/
export class WasmAwsc {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmAwscFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmawsc_free(ptr);
    }
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
    constructor(eb_lane_volumes, wb_lane_volumes, nb_lane_volumes, sb_lane_volumes, eb_heavy_vehicle_pct, wb_heavy_vehicle_pct, nb_heavy_vehicle_pct, sb_heavy_vehicle_pct, phf, analysis_period_h) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArrayF64ToWasm0(eb_lane_volumes, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passArrayF64ToWasm0(wb_lane_volumes, wasm.__wbindgen_malloc);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passArrayF64ToWasm0(nb_lane_volumes, wasm.__wbindgen_malloc);
            const len2 = WASM_VECTOR_LEN;
            const ptr3 = passArrayF64ToWasm0(sb_lane_volumes, wasm.__wbindgen_malloc);
            const len3 = WASM_VECTOR_LEN;
            wasm.wasmawsc_new(retptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, !isLikeNone(eb_heavy_vehicle_pct), isLikeNone(eb_heavy_vehicle_pct) ? 0 : eb_heavy_vehicle_pct, !isLikeNone(wb_heavy_vehicle_pct), isLikeNone(wb_heavy_vehicle_pct) ? 0 : wb_heavy_vehicle_pct, !isLikeNone(nb_heavy_vehicle_pct), isLikeNone(nb_heavy_vehicle_pct) ? 0 : nb_heavy_vehicle_pct, !isLikeNone(sb_heavy_vehicle_pct), isLikeNone(sb_heavy_vehicle_pct) ? 0 : sb_heavy_vehicle_pct, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(analysis_period_h), isLikeNone(analysis_period_h) ? 0 : analysis_period_h);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0 >>> 0;
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Run the HCM Chapter 21 procedure (Steps 1-16 except the Step 12
    * capacity search; see `compute_lane_capacity`).
    */
    analyze() {
        wasm.wasmawsc_analyze(this.__wbg_ptr);
    }
    /**
    * Iterations used by the departure-headway convergence loop.
    * @returns {number | undefined}
    */
    get_iterations() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmawsc_get_iterations(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Number of lanes on an approach ("EB"/"WB"/"NB"/"SB").
    * @param {string} approach
    * @returns {number}
    */
    get_lane_count(approach) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmawsc_get_lane_count(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            return r0 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Converged departure headway h_d of a lane, s (Equation 21-28).
    * @param {string} approach
    * @param {number} lane
    * @returns {number | undefined}
    */
    get_departure_headway(approach, lane) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmawsc_get_departure_headway(retptr, this.__wbg_ptr, ptr0, len0, lane);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Degree of utilization x = v h_d / 3,600 (Equation 21-14).
    * @param {string} approach
    * @param {number} lane
    * @returns {number | undefined}
    */
    get_degree_of_utilization(approach, lane) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmawsc_get_degree_of_utilization(retptr, this.__wbg_ptr, ptr0, len0, lane);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Service time t_s = h_d - m, s (Equation 21-29).
    * @param {string} approach
    * @param {number} lane
    * @returns {number | undefined}
    */
    get_service_time(approach, lane) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmawsc_get_service_time(retptr, this.__wbg_ptr, ptr0, len0, lane);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Lane control delay, s/veh (Equation 21-30).
    * @param {string} approach
    * @param {number} lane
    * @returns {number | undefined}
    */
    get_lane_delay(approach, lane) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmawsc_get_lane_delay(retptr, this.__wbg_ptr, ptr0, len0, lane);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Lane LOS letter (Exhibit 21-8).
    * @param {string} approach
    * @param {number} lane
    * @returns {string | undefined}
    */
    get_lane_los(approach, lane) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmawsc_get_lane_los(retptr, this.__wbg_ptr, ptr0, len0, lane);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            var r3 = getInt32Memory0()[retptr / 4 + 3];
            if (r3) {
                throw takeObject(r2);
            }
            let v2;
            if (r0 !== 0) {
                v2 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Lane 95th percentile queue, veh (Equation 21-33).
    * @param {string} approach
    * @param {number} lane
    * @returns {number | undefined}
    */
    get_lane_queue_95(approach, lane) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmawsc_get_lane_queue_95(retptr, this.__wbg_ptr, ptr0, len0, lane);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Step 12 capacity of a lane, veh/h (iterative search; expensive).
    * @param {string} approach
    * @param {number} lane
    * @returns {number}
    */
    compute_lane_capacity(approach, lane) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmawsc_compute_lane_capacity(retptr, this.__wbg_ptr, ptr0, len0, lane);
            var r0 = getFloat64Memory0()[retptr / 8 + 0];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            var r3 = getInt32Memory0()[retptr / 4 + 3];
            if (r3) {
                throw takeObject(r2);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Approach control delay, s/veh (Equation 21-31).
    * @param {string} approach
    * @returns {number | undefined}
    */
    get_approach_delay(approach) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmawsc_get_approach_delay(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Approach LOS letter (Exhibit 21-8).
    * @param {string} approach
    * @returns {string | undefined}
    */
    get_approach_los(approach) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmawsc_get_approach_los(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            var r3 = getInt32Memory0()[retptr / 4 + 3];
            if (r3) {
                throw takeObject(r2);
            }
            let v2;
            if (r0 !== 0) {
                v2 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Intersection control delay, s/veh (Equation 21-32).
    * @returns {number | undefined}
    */
    get_intersection_delay() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmawsc_get_intersection_delay(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Intersection LOS letter (Exhibit 21-8).
    * @returns {string | undefined}
    */
    get_intersection_los() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmawsc_get_intersection_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmawsc_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmBasicFreewaysFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmbasicfreeways_free(ptr >>> 0));
/**
*/
export class WasmBasicFreeways {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmBasicFreewaysFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmbasicfreeways_free(ptr);
    }
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
    */
    constructor(bffs, lane_width, lane_count, lc_r, lc_l, trd, apd, grade, terrain_type, speed_limit, phf, p_t, demand_flow_i, length, highway_type, city_type) {
        var ptr0 = isLikeNone(terrain_type) ? 0 : passStringToWasm0(terrain_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(highway_type) ? 0 : passStringToWasm0(highway_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(city_type) ? 0 : passStringToWasm0(city_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmbasicfreeways_new(!isLikeNone(bffs), isLikeNone(bffs) ? 0 : bffs, !isLikeNone(lane_width), isLikeNone(lane_width) ? 0 : lane_width, !isLikeNone(lane_count), isLikeNone(lane_count) ? 0 : lane_count, !isLikeNone(lc_r), isLikeNone(lc_r) ? 0 : lc_r, !isLikeNone(lc_l), isLikeNone(lc_l) ? 0 : lc_l, !isLikeNone(trd), isLikeNone(trd) ? 0 : trd, !isLikeNone(apd), isLikeNone(apd) ? 0 : apd, !isLikeNone(grade), isLikeNone(grade) ? 0 : grade, ptr0, len0, !isLikeNone(speed_limit), isLikeNone(speed_limit) ? 0 : speed_limit, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(p_t), isLikeNone(p_t) ? 0 : p_t, !isLikeNone(demand_flow_i), isLikeNone(demand_flow_i) ? 0 : demand_flow_i, !isLikeNone(length), isLikeNone(length) ? 0 : length, ptr1, len1, ptr2, len2);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the full HCM Ch.12 operational analysis and return the LOS letter.
    * Populates ffs, capacity, speed, density, and v/c ratio.
    * @returns {string}
    */
    run_operational_analysis() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmbasicfreeways_run_operational_analysis(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @returns {number}
    */
    determine_free_flow_speed() {
        const ret = wasm.wasmbasicfreeways_determine_free_flow_speed(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_ffs() {
        const ret = wasm.wasmbasicfreeways_get_ffs(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_capacity() {
        const ret = wasm.wasmbasicfreeways_get_capacity(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_adjusted_capacity() {
        const ret = wasm.wasmbasicfreeways_get_adjusted_capacity(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_speed() {
        const ret = wasm.wasmbasicfreeways_get_speed(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_density() {
        const ret = wasm.wasmbasicfreeways_get_density(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_vc_ratio() {
        const ret = wasm.wasmbasicfreeways_get_vc_ratio(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_lane_count() {
        const ret = wasm.wasmbasicfreeways_get_lane_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmbasicfreeways_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmDisplacedLeftTurnFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmdisplacedleftturn_free(ptr >>> 0));
/**
*/
export class WasmDisplacedLeftTurn {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmDisplacedLeftTurnFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmdisplacedleftturn_free(ptr);
    }
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
    constructor(junction_flows, junction_delays, total_od_demand_veh_h, full_dlt) {
        const ptr0 = passArrayF64ToWasm0(junction_flows, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(junction_delays, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmdisplacedleftturn_new(ptr0, len0, ptr1, len1, total_od_demand_veh_h, isLikeNone(full_dlt) ? 0xFFFFFF : full_dlt ? 1 : 0);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Weighted-average intersection ETT (= control delay), s/veh
    * (HCM Equation 23-69).
    * @returns {number}
    */
    get_intersection_ett_s() {
        const ret = wasm.wasmdisplacedleftturn_get_intersection_ett_s(this.__wbg_ptr);
        return ret;
    }
    /**
    * Intersection LOS letter (Chapter 19 control-delay thresholds).
    * @returns {string}
    */
    get_los() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmdisplacedleftturn_get_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}

const WasmExclusivePedestrianFacilityFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmexclusivepedestrianfacility_free(ptr >>> 0));
/**
*/
export class WasmExclusivePedestrianFacility {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmExclusivePedestrianFacilityFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmexclusivepedestrianfacility_free(ptr);
    }
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
    constructor(total_walkway_width, fixed_object_width, pedestrian_demand, peak_15min_volume, phf, pedestrian_speed, facility_type, flow_type) {
        var ptr0 = isLikeNone(facility_type) ? 0 : passStringToWasm0(facility_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(flow_type) ? 0 : passStringToWasm0(flow_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmexclusivepedestrianfacility_new(total_walkway_width, !isLikeNone(fixed_object_width), isLikeNone(fixed_object_width) ? 0 : fixed_object_width, !isLikeNone(pedestrian_demand), isLikeNone(pedestrian_demand) ? 0 : pedestrian_demand, !isLikeNone(peak_15min_volume), isLikeNone(peak_15min_volume) ? 0 : peak_15min_volume, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(pedestrian_speed), isLikeNone(pedestrian_speed) ? 0 : pedestrian_speed, ptr0, len0, ptr1, len1);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the complete methodology (Steps 1-5) and return the LOS letter.
    * @returns {string}
    */
    analyze() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmexclusivepedestrianfacility_analyze(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * Effective walkway width W_E, ft (HCM Equation 24-1).
    * @returns {number}
    */
    get_effective_width() {
        const ret = wasm.wasmexclusivepedestrianfacility_get_effective_width(this.__wbg_ptr);
        return ret;
    }
    /**
    * Pedestrian volume during the peak 15 min, p (HCM Equation 24-2).
    * @returns {number}
    */
    get_flow_rate_15min() {
        const ret = wasm.wasmexclusivepedestrianfacility_get_flow_rate_15min(this.__wbg_ptr);
        return ret;
    }
    /**
    * Pedestrian flow per unit width v_p, p/ft/min (HCM Equation 24-3).
    * @returns {number}
    */
    get_unit_flow_rate() {
        const ret = wasm.wasmexclusivepedestrianfacility_get_unit_flow_rate(this.__wbg_ptr);
        return ret;
    }
    /**
    * Average pedestrian space A_p, ft²/p (HCM Equation 24-4). Infinity for
    * an empty facility.
    * @returns {number}
    */
    get_pedestrian_space() {
        const ret = wasm.wasmexclusivepedestrianfacility_get_pedestrian_space(this.__wbg_ptr);
        return ret;
    }
    /**
    * Volume-to-capacity ratio.
    * @returns {number}
    */
    get_vc_ratio() {
        const ret = wasm.wasmexclusivepedestrianfacility_get_vc_ratio(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmexclusivepedestrianfacility_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmFacilitySegmentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmfacilitysegment_free(ptr >>> 0));
/**
* One HCM Chapter 10 analysis segment (Basic / Merge / Diverge / Weaving /
* OverlappingRamp). Ramp demand vectors carry one value per 15-min analysis
* period, veh/h.
*/
export class WasmFacilitySegment {

    static __unwrap(jsValue) {
        if (!(jsValue instanceof WasmFacilitySegment)) {
            return 0;
        }
        return jsValue.__destroy_into_raw();
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmFacilitySegmentFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmfacilitysegment_free(ptr);
    }
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
    constructor(seg_type, length_ft, lanes, on_ramp_demand, off_ramp_demand, ramp_to_ramp_demand, ramp_ffs, accel_lane_ft, decel_lane_ft, short_length_ft, num_weaving_lanes, lc_rf, lc_fr, ffs, caf, saf, daf) {
        const ptr0 = passStringToWasm0(seg_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(on_ramp_demand, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF64ToWasm0(off_ramp_demand, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayF64ToWasm0(ramp_to_ramp_demand, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.wasmfacilitysegment_new(ptr0, len0, length_ft, lanes, ptr1, len1, ptr2, len2, ptr3, len3, !isLikeNone(ramp_ffs), isLikeNone(ramp_ffs) ? 0 : ramp_ffs, !isLikeNone(accel_lane_ft), isLikeNone(accel_lane_ft) ? 0 : accel_lane_ft, !isLikeNone(decel_lane_ft), isLikeNone(decel_lane_ft) ? 0 : decel_lane_ft, !isLikeNone(short_length_ft), isLikeNone(short_length_ft) ? 0 : short_length_ft, !isLikeNone(num_weaving_lanes), isLikeNone(num_weaving_lanes) ? 0 : num_weaving_lanes, !isLikeNone(lc_rf), isLikeNone(lc_rf) ? 0 : lc_rf, !isLikeNone(lc_fr), isLikeNone(lc_fr) ? 0 : lc_fr, !isLikeNone(ffs), isLikeNone(ffs) ? 0 : ffs, !isLikeNone(caf), isLikeNone(caf) ? 0 : caf, !isLikeNone(saf), isLikeNone(saf) ? 0 : saf, !isLikeNone(daf), isLikeNone(daf) ? 0 : daf);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * @returns {string}
    */
    get_seg_type() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmfacilitysegment_get_seg_type(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @returns {number}
    */
    get_length_ft() {
        const ret = wasm.wasmfacilitysegment_get_length_ft(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_lanes() {
        const ret = wasm.wasmfacilitysegment_get_lanes(this.__wbg_ptr);
        return ret >>> 0;
    }
}

const WasmFreewayFacilityFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmfreewayfacility_free(ptr >>> 0));
/**
* HCM Chapter 10 freeway facilities core methodology (Steps A-1 through
* A-17): a directional facility of ordered segments evaluated over
* consecutive 15-min analysis periods.
*/
export class WasmFreewayFacility {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmFreewayFacilityFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmfreewayfacility_free(ptr);
    }
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
    constructor(wasm_segments, mainline_demand, ffs, heavy_vehicle_pct, terrain, city_type, phf, jam_density_pc, queue_discharge_drop, total_ramp_density, interchange_density) {
        const ptr0 = passArrayJsValueToWasm0(wasm_segments, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(mainline_demand, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(terrain) ? 0 : passStringToWasm0(terrain, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(city_type) ? 0 : passStringToWasm0(city_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len3 = WASM_VECTOR_LEN;
        const ret = wasm.wasmfreewayfacility_new(ptr0, len0, ptr1, len1, !isLikeNone(ffs), isLikeNone(ffs) ? 0 : ffs, !isLikeNone(heavy_vehicle_pct), isLikeNone(heavy_vehicle_pct) ? 0 : heavy_vehicle_pct, ptr2, len2, ptr3, len3, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(jam_density_pc), isLikeNone(jam_density_pc) ? 0 : jam_density_pc, !isLikeNone(queue_discharge_drop), isLikeNone(queue_discharge_drop) ? 0 : queue_discharge_drop, !isLikeNone(total_ramp_density), isLikeNone(total_ramp_density) ? 0 : total_ramp_density, !isLikeNone(interchange_density), isLikeNone(interchange_density) ? 0 : interchange_density);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the full core methodology. Throws with the validation message on
    * invalid input (e.g. first/last segment not basic, no periods).
    */
    run_analysis() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmfreewayfacility_run_analysis(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number}
    */
    num_segments() {
        const ret = wasm.wasmfreewayfacility_num_segments(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    num_periods() {
        const ret = wasm.wasmfreewayfacility_num_periods(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    total_length_mi() {
        const ret = wasm.wasmfreewayfacility_total_length_mi(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {boolean}
    */
    is_oversaturated() {
        const ret = wasm.wasmfreewayfacility_is_oversaturated(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {number} seg
    * @param {number} period
    * @returns {number}
    */
    get_speed(seg, period) {
        const ret = wasm.wasmfreewayfacility_get_speed(this.__wbg_ptr, seg, period);
        return ret;
    }
    /**
    * @param {number} seg
    * @param {number} period
    * @returns {number}
    */
    get_density_veh(seg, period) {
        const ret = wasm.wasmfreewayfacility_get_density_veh(this.__wbg_ptr, seg, period);
        return ret;
    }
    /**
    * @param {number} seg
    * @param {number} period
    * @returns {number}
    */
    get_density_pc(seg, period) {
        const ret = wasm.wasmfreewayfacility_get_density_pc(this.__wbg_ptr, seg, period);
        return ret;
    }
    /**
    * @param {number} seg
    * @param {number} period
    * @returns {number}
    */
    get_dc_ratio(seg, period) {
        const ret = wasm.wasmfreewayfacility_get_dc_ratio(this.__wbg_ptr, seg, period);
        return ret;
    }
    /**
    * @param {number} seg
    * @param {number} period
    * @returns {number}
    */
    get_queue_length_ft(seg, period) {
        const ret = wasm.wasmfreewayfacility_get_queue_length_ft(this.__wbg_ptr, seg, period);
        return ret;
    }
    /**
    * @param {number} seg
    * @param {number} period
    * @returns {string}
    */
    get_los(seg, period) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmfreewayfacility_get_los(retptr, this.__wbg_ptr, seg, period);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @param {number} period
    * @returns {number}
    */
    get_facility_speed(period) {
        const ret = wasm.wasmfreewayfacility_get_facility_speed(this.__wbg_ptr, period);
        return ret;
    }
    /**
    * @param {number} period
    * @returns {number}
    */
    get_facility_density_veh(period) {
        const ret = wasm.wasmfreewayfacility_get_facility_density_veh(this.__wbg_ptr, period);
        return ret;
    }
    /**
    * @param {number} period
    * @returns {string}
    */
    get_facility_los(period) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmfreewayfacility_get_facility_los(retptr, this.__wbg_ptr, period);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @returns {number}
    */
    get_overall_speed() {
        const ret = wasm.wasmfreewayfacility_get_overall_speed(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_overall_density_veh() {
        const ret = wasm.wasmfreewayfacility_get_overall_density_veh(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {any}
    */
    speed_matrix() {
        const ret = wasm.wasmfreewayfacility_speed_matrix(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    density_matrix() {
        const ret = wasm.wasmfreewayfacility_density_matrix(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    dc_matrix() {
        const ret = wasm.wasmfreewayfacility_dc_matrix(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    los_matrix() {
        const ret = wasm.wasmfreewayfacility_los_matrix(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    queue_matrix() {
        const ret = wasm.wasmfreewayfacility_queue_matrix(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmfreewayfacility_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmFreewayReliabilityFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmfreewayreliability_free(ptr >>> 0));
/**
* HCM Chapter 11 freeway reliability analysis (Steps B-1 through B-13),
* scoped to demand variability plus optional incidents. The scenario
* generator defaults to a whole-year reliability reporting period
* (12 months, Monday through Friday, Exhibit 11-18 urban demand ratios).
* Weather events, work zones, and special events are not exposed by this
* binding.
*/
export class WasmFreewayReliability {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmFreewayReliabilityFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmfreewayreliability_free(ptr);
    }
    /**
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
    */
    constructor(wasm_segments, mainline_demand, ffs, heavy_vehicle_pct, terrain, city_type, phf, months, replications, seed_month, seed_weekday, crash_rate_per_100mvmt, incident_to_crash_ratio, rng_seed, vmt_weighted) {
        const ptr0 = passArrayJsValueToWasm0(wasm_segments, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(mainline_demand, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(terrain) ? 0 : passStringToWasm0(terrain, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(city_type) ? 0 : passStringToWasm0(city_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len3 = WASM_VECTOR_LEN;
        const ptr4 = passArray32ToWasm0(months, wasm.__wbindgen_malloc);
        const len4 = WASM_VECTOR_LEN;
        var ptr5 = isLikeNone(seed_weekday) ? 0 : passStringToWasm0(seed_weekday, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len5 = WASM_VECTOR_LEN;
        const ret = wasm.wasmfreewayreliability_new(ptr0, len0, ptr1, len1, !isLikeNone(ffs), isLikeNone(ffs) ? 0 : ffs, !isLikeNone(heavy_vehicle_pct), isLikeNone(heavy_vehicle_pct) ? 0 : heavy_vehicle_pct, ptr2, len2, ptr3, len3, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, ptr4, len4, !isLikeNone(replications), isLikeNone(replications) ? 0 : replications, !isLikeNone(seed_month), isLikeNone(seed_month) ? 0 : seed_month, ptr5, len5, !isLikeNone(crash_rate_per_100mvmt), isLikeNone(crash_rate_per_100mvmt) ? 0 : crash_rate_per_100mvmt, !isLikeNone(incident_to_crash_ratio), isLikeNone(incident_to_crash_ratio) ? 0 : incident_to_crash_ratio, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? 0 : rng_seed, isLikeNone(vmt_weighted) ? 0xFFFFFF : vmt_weighted ? 1 : 0);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the full reliability methodology (scenario generation plus one
    * Chapter 10 core-methodology evaluation per scenario). Throws with the
    * validation message on invalid input.
    */
    run() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmfreewayreliability_run(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number}
    */
    num_scenarios() {
        const ret = wasm.wasmfreewayreliability_num_scenarios(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    num_observations() {
        const ret = wasm.wasmfreewayreliability_num_observations(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    free_flow_travel_time_min() {
        const ret = wasm.wasmfreewayreliability_free_flow_travel_time_min(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    expected_vhd() {
        const ret = wasm.wasmfreewayreliability_expected_vhd(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    tti_mean() {
        const ret = wasm.wasmfreewayreliability_tti_mean(this.__wbg_ptr);
        return ret;
    }
    /**
    * Weighted percentile TTI (p in 0-100), e.g. 95 for the PTI.
    * @param {number} p
    * @returns {number}
    */
    tti_percentile(p) {
        const ret = wasm.wasmfreewayreliability_tti_percentile(this.__wbg_ptr, p);
        return ret;
    }
    /**
    * Misery index (mean of the worst 5% of TTIs).
    * @returns {number}
    */
    misery_index() {
        const ret = wasm.wasmfreewayreliability_misery_index(this.__wbg_ptr);
        return ret;
    }
    /**
    * Reliability rating, % (weighted share with TTI < 1.33).
    * @returns {number}
    */
    reliability_rating() {
        const ret = wasm.wasmfreewayreliability_reliability_rating(this.__wbg_ptr);
        return ret;
    }
    /**
    * Semi-standard deviation (one-sided about TTI = 1).
    * @returns {number}
    */
    semi_std_dev() {
        const ret = wasm.wasmfreewayreliability_semi_std_dev(this.__wbg_ptr);
        return ret;
    }
    /**
    * Percentage of the weighted distribution below the target facility
    * space mean speed, %.
    * @param {number} target_speed_mi_h
    * @returns {number}
    */
    failure_pct_below_speed(target_speed_mi_h) {
        const ret = wasm.wasmfreewayreliability_failure_pct_below_speed(this.__wbg_ptr, target_speed_mi_h);
        return ret;
    }
    /**
    * Scenario probabilities (one entry per generated scenario).
    * @returns {Float64Array}
    */
    scenario_probabilities() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmfreewayreliability_scenario_probabilities(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Per-scenario TTI matrix [scenario][period].
    * @returns {any}
    */
    scenario_tti_matrix() {
        const ret = wasm.wasmfreewayreliability_scenario_tti_matrix(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmfreewayreliability_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmInterchangeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasminterchange_free(ptr >>> 0));
/**
*/
export class WasmInterchange {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmInterchangeFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasminterchange_free(ptr);
    }
    /**
    * Build a signalized interchange ramp terminal analysis (HCM Ch.23
    * Part B: diamond / parclo / SPUI / DDI) from a configuration object
    * matching the serde schema of `hcm::chapter23::ramp_terminals::Interchange`
    * (same shape as `tests/ExampleCases/hcm/RampTerminals/case1.json`):
    * interchange form, cycle length, O-D demands A..N, and the per-lane-group
    * geometry and signal timing.
    * @param {any} config
    */
    constructor(config) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasminterchange_new(retptr, addHeapObject(config));
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0 >>> 0;
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Run the complete HCM Ch.23 Part B procedure (Steps 1-9 of Exhibit 23-22).
    */
    analyze() {
        wasm.wasminterchange_analyze(this.__wbg_ptr);
    }
    /**
    * @returns {number}
    */
    get_cycle_length_s() {
        const ret = wasm.wasminterchange_get_cycle_length_s(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_peak_hour_factor() {
        const ret = wasm.wasminterchange_get_peak_hour_factor(this.__wbg_ptr);
        return ret;
    }
    /**
    * Demand-weighted interchange experienced travel time ETT, s/veh
    * (HCM Equation 23-52).
    * @returns {number | undefined}
    */
    get_interchange_ett_s() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasminterchange_get_interchange_ett_s(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Interchange LOS letter (HCM Exhibit 23-10), e.g. "C".
    * @returns {string | undefined}
    */
    get_interchange_los() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasminterchange_get_interchange_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * O-D results as a JS array (movement letter, PHF-adjusted demand,
    * control delay, EDTT, ETT, v/c and queue-storage flags, LOS).
    * @returns {any}
    */
    od_results_to_js_value() {
        const ret = wasm.wasminterchange_od_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * Lane-group results as a JS array (movement, flow rate, saturation
    * flow, effective green, capacity, v/c, delays, back of queue).
    * @returns {any}
    */
    lane_group_results_to_js_value() {
        const ret = wasm.wasminterchange_lane_group_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmManagedLanesFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmmanagedlanes_free(ptr >>> 0));
/**
*/
export class WasmManagedLanes {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmManagedLanesFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmmanagedlanes_free(ptr);
    }
    /**
    * @param {string | undefined} [lane_type]
    * @param {number | undefined} [ffs]
    * @param {number | undefined} [demand]
    * @param {number | undefined} [gp_density]
    * @param {number | undefined} [caf]
    * @param {number | undefined} [saf]
    */
    constructor(lane_type, ffs, demand, gp_density, caf, saf) {
        var ptr0 = isLikeNone(lane_type) ? 0 : passStringToWasm0(lane_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmmanagedlanes_new(ptr0, len0, !isLikeNone(ffs), isLikeNone(ffs) ? 0 : ffs, !isLikeNone(demand), isLikeNone(demand) ? 0 : demand, !isLikeNone(gp_density), isLikeNone(gp_density) ? 0 : gp_density, !isLikeNone(caf), isLikeNone(caf) ? 0 : caf, !isLikeNone(saf), isLikeNone(saf) ? 0 : saf);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the full HCM Ch.12 Section 4 managed lane analysis and return the LOS letter.
    * Populates breakpoint, adjusted capacity, speed, and density.
    * @returns {string}
    */
    run_analysis() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmmanagedlanes_run_analysis(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * Breakpoint BP (pc/h/ln) - Equation 12-13.
    * @returns {number}
    */
    calculate_breakpoint() {
        const ret = wasm.wasmmanagedlanes_calculate_breakpoint(this.__wbg_ptr);
        return ret;
    }
    /**
    * Adjusted capacity c_adj (pc/h/ln) - Equation 12-14.
    * @returns {number}
    */
    calculate_capacity() {
        const ret = wasm.wasmmanagedlanes_calculate_capacity(this.__wbg_ptr);
        return ret;
    }
    /**
    * Space mean speed S_ML (mi/h) - Equation 12-12.
    * @returns {number}
    */
    calculate_speed() {
        const ret = wasm.wasmmanagedlanes_calculate_speed(this.__wbg_ptr);
        return ret;
    }
    /**
    * Density (pc/mi/ln).
    * @returns {number}
    */
    calculate_density() {
        const ret = wasm.wasmmanagedlanes_calculate_density(this.__wbg_ptr);
        return ret;
    }
    /**
    * Level of service letter (Exhibit 12-15 criteria).
    * @returns {string}
    */
    determine_los() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmmanagedlanes_determine_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @param {number} v_p
    */
    set_demand(v_p) {
        wasm.wasmmanagedlanes_set_demand(this.__wbg_ptr, v_p);
    }
    /**
    * @param {number} k_gp
    */
    set_gp_density(k_gp) {
        wasm.wasmmanagedlanes_set_gp_density(this.__wbg_ptr, k_gp);
    }
    /**
    * @returns {number}
    */
    get_breakpoint() {
        const ret = wasm.wasmmanagedlanes_get_breakpoint(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_capacity() {
        const ret = wasm.wasmmanagedlanes_get_capacity(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_speed() {
        const ret = wasm.wasmmanagedlanes_get_speed(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_density() {
        const ret = wasm.wasmmanagedlanes_get_density(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {string | undefined}
    */
    get_los() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmmanagedlanes_get_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Whether the segment type is subject to GP-lane friction
    * (continuous access and Buffer 1 types).
    * @returns {boolean}
    */
    has_friction_effect() {
        const ret = wasm.wasmmanagedlanes_has_friction_effect(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * Whether friction is active (K_GP > 35 pc/mi/ln on a friction type).
    * @returns {boolean}
    */
    is_friction_active() {
        const ret = wasm.wasmmanagedlanes_is_friction_active(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmmanagedlanes_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmOffStreetBicycleFacilityFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmoffstreetbicyclefacility_free(ptr >>> 0));
/**
*/
export class WasmOffStreetBicycleFacility {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmOffStreetBicycleFacilityFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmoffstreetbicyclefacility_free(ptr);
    }
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
    constructor(path_width, segment_length, has_centerline, two_way_demand, directional_split, phf, is_one_way, exclusive_bicycle, mode_splits, mode_speeds, mode_speed_sds) {
        var ptr0 = isLikeNone(mode_splits) ? 0 : passArrayF64ToWasm0(mode_splits, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(mode_speeds) ? 0 : passArrayF64ToWasm0(mode_speeds, wasm.__wbindgen_malloc);
        var len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(mode_speed_sds) ? 0 : passArrayF64ToWasm0(mode_speed_sds, wasm.__wbindgen_malloc);
        var len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmoffstreetbicyclefacility_new(path_width, segment_length, isLikeNone(has_centerline) ? 0xFFFFFF : has_centerline ? 1 : 0, !isLikeNone(two_way_demand), isLikeNone(two_way_demand) ? 0 : two_way_demand, !isLikeNone(directional_split), isLikeNone(directional_split) ? 0 : directional_split, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, isLikeNone(is_one_way) ? 0xFFFFFF : is_one_way ? 1 : 0, isLikeNone(exclusive_bicycle) ? 0xFFFFFF : exclusive_bicycle ? 1 : 0, ptr0, len0, ptr1, len1, ptr2, len2);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the complete BLOS methodology (Steps 1-8, including the low-volume
    * adjustment) and return the LOS letter.
    * @returns {string}
    */
    analyze() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmoffstreetbicyclefacility_analyze(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * Active passings per minute A_T (HCM Equation 24-12).
    * @returns {number}
    */
    get_active_passings_per_minute() {
        const ret = wasm.wasmoffstreetbicyclefacility_get_active_passings_per_minute(this.__wbg_ptr);
        return ret;
    }
    /**
    * Meetings per minute M_T (HCM Equation 24-16).
    * @returns {number}
    */
    get_meetings_per_minute() {
        const ret = wasm.wasmoffstreetbicyclefacility_get_meetings_per_minute(this.__wbg_ptr);
        return ret;
    }
    /**
    * Number of effective lanes (HCM Exhibit 24-14).
    * @returns {number}
    */
    get_effective_lanes() {
        const ret = wasm.wasmoffstreetbicyclefacility_get_effective_lanes(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * Total probability of delayed passing P_Tds (HCM Equation 24-33).
    * @returns {number}
    */
    get_probability_delayed_passing() {
        const ret = wasm.wasmoffstreetbicyclefacility_get_probability_delayed_passing(this.__wbg_ptr);
        return ret;
    }
    /**
    * Delayed passings per minute DP_m (HCM Equation 24-34).
    * @returns {number}
    */
    get_delayed_passings_per_minute() {
        const ret = wasm.wasmoffstreetbicyclefacility_get_delayed_passings_per_minute(this.__wbg_ptr);
        return ret;
    }
    /**
    * Weighted events per minute E = M_T + 10 A_T (HCM Equation 24-35 term).
    * @returns {number}
    */
    get_weighted_events_per_minute() {
        const ret = wasm.wasmoffstreetbicyclefacility_get_weighted_events_per_minute(this.__wbg_ptr);
        return ret;
    }
    /**
    * BLOS score (HCM Equation 24-35).
    * @returns {number}
    */
    get_blos_score() {
        const ret = wasm.wasmoffstreetbicyclefacility_get_blos_score(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmoffstreetbicyclefacility_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmPlanningFacilityFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmplanningfacility_free(ptr >>> 0));
/**
* HCM Chapter 25, Section 6 planning-level freeway facility method (the
* screening companion to the Chapter 10 core methodology). Sections are
* passed as parallel arrays; `sec_types` is a comma-separated list of
* "basic", "ramp", or "weave" entries.
*/
export class WasmPlanningFacility {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmPlanningFacilityFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmplanningfacility_free(ptr);
    }
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
    constructor(sec_types, lengths_mi, lanes, inflow_aadt, outflow_aadt, weave_vr, ffs, k_factor, growth_factor, phf, pct_sut, pct_tt, terrain, city_type) {
        const ptr0 = passStringToWasm0(sec_types, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(lengths_mi, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray32ToWasm0(lanes, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayF64ToWasm0(inflow_aadt, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArrayF64ToWasm0(outflow_aadt, wasm.__wbindgen_malloc);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passArrayF64ToWasm0(weave_vr, wasm.__wbindgen_malloc);
        const len5 = WASM_VECTOR_LEN;
        var ptr6 = isLikeNone(terrain) ? 0 : passStringToWasm0(terrain, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len6 = WASM_VECTOR_LEN;
        var ptr7 = isLikeNone(city_type) ? 0 : passStringToWasm0(city_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len7 = WASM_VECTOR_LEN;
        const ret = wasm.wasmplanningfacility_new(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, !isLikeNone(ffs), isLikeNone(ffs) ? 0 : ffs, !isLikeNone(k_factor), isLikeNone(k_factor) ? 0 : k_factor, !isLikeNone(growth_factor), isLikeNone(growth_factor) ? 0 : growth_factor, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(pct_sut), isLikeNone(pct_sut) ? 0 : pct_sut, !isLikeNone(pct_tt), isLikeNone(pct_tt) ? 0 : pct_tt, ptr6, len6, ptr7, len7);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the planning-level analysis (Steps 1-5, four 15-min periods).
    */
    run_analysis() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmplanningfacility_run_analysis(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number}
    */
    num_sections() {
        const ret = wasm.wasmplanningfacility_num_sections(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    total_length_mi() {
        const ret = wasm.wasmplanningfacility_total_length_mi(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {number} section
    * @param {number} period
    * @returns {number}
    */
    get_dc_ratio(section, period) {
        const ret = wasm.wasmplanningfacility_get_dc_ratio(this.__wbg_ptr, section, period);
        return ret;
    }
    /**
    * @param {number} section
    * @param {number} period
    * @returns {number}
    */
    get_section_speed(section, period) {
        const ret = wasm.wasmplanningfacility_get_section_speed(this.__wbg_ptr, section, period);
        return ret;
    }
    /**
    * @param {number} section
    * @param {number} period
    * @returns {number}
    */
    get_section_density(section, period) {
        const ret = wasm.wasmplanningfacility_get_section_density(this.__wbg_ptr, section, period);
        return ret;
    }
    /**
    * @param {number} period
    * @returns {number}
    */
    get_facility_speed(period) {
        const ret = wasm.wasmplanningfacility_get_facility_speed(this.__wbg_ptr, period);
        return ret;
    }
    /**
    * @param {number} period
    * @returns {number}
    */
    get_facility_density(period) {
        const ret = wasm.wasmplanningfacility_get_facility_density(this.__wbg_ptr, period);
        return ret;
    }
    /**
    * @param {number} period
    * @returns {string}
    */
    get_facility_los(period) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmplanningfacility_get_facility_los(retptr, this.__wbg_ptr, period);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmplanningfacility_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmRampSegmentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmrampsegment_free(ptr >>> 0));
/**
*/
export class WasmRampSegment {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmRampSegmentFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmrampsegment_free(ptr);
    }
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
    */
    constructor(ramp_type, ramp_side, ramp_lanes, freeway_lanes, freeway_ffs, ramp_ffs, accel_lane_length, accel_lane_length2, decel_lane_length, decel_lane_length2, freeway_demand, ramp_demand, phf, heavy_vehicle_pct, ramp_heavy_vehicle_pct, terrain, adjacent_upstream, upstream_distance, upstream_ramp_flow, adjacent_downstream, downstream_distance, downstream_ramp_flow, caf, saf) {
        var ptr0 = isLikeNone(ramp_type) ? 0 : passStringToWasm0(ramp_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(ramp_side) ? 0 : passStringToWasm0(ramp_side, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(terrain) ? 0 : passStringToWasm0(terrain, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(adjacent_upstream) ? 0 : passStringToWasm0(adjacent_upstream, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(adjacent_downstream) ? 0 : passStringToWasm0(adjacent_downstream, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmrampsegment_new(ptr0, len0, ptr1, len1, !isLikeNone(ramp_lanes), isLikeNone(ramp_lanes) ? 0 : ramp_lanes, !isLikeNone(freeway_lanes), isLikeNone(freeway_lanes) ? 0 : freeway_lanes, !isLikeNone(freeway_ffs), isLikeNone(freeway_ffs) ? 0 : freeway_ffs, !isLikeNone(ramp_ffs), isLikeNone(ramp_ffs) ? 0 : ramp_ffs, !isLikeNone(accel_lane_length), isLikeNone(accel_lane_length) ? 0 : accel_lane_length, !isLikeNone(accel_lane_length2), isLikeNone(accel_lane_length2) ? 0 : accel_lane_length2, !isLikeNone(decel_lane_length), isLikeNone(decel_lane_length) ? 0 : decel_lane_length, !isLikeNone(decel_lane_length2), isLikeNone(decel_lane_length2) ? 0 : decel_lane_length2, !isLikeNone(freeway_demand), isLikeNone(freeway_demand) ? 0 : freeway_demand, !isLikeNone(ramp_demand), isLikeNone(ramp_demand) ? 0 : ramp_demand, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(heavy_vehicle_pct), isLikeNone(heavy_vehicle_pct) ? 0 : heavy_vehicle_pct, !isLikeNone(ramp_heavy_vehicle_pct), isLikeNone(ramp_heavy_vehicle_pct) ? 0 : ramp_heavy_vehicle_pct, ptr2, len2, ptr3, len3, !isLikeNone(upstream_distance), isLikeNone(upstream_distance) ? 0 : upstream_distance, !isLikeNone(upstream_ramp_flow), isLikeNone(upstream_ramp_flow) ? 0 : upstream_ramp_flow, ptr4, len4, !isLikeNone(downstream_distance), isLikeNone(downstream_distance) ? 0 : downstream_distance, !isLikeNone(downstream_ramp_flow), isLikeNone(downstream_ramp_flow) ? 0 : downstream_ramp_flow, !isLikeNone(caf), isLikeNone(caf) ? 0 : caf, !isLikeNone(saf), isLikeNone(saf) ? 0 : saf);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the full HCM Ch.14 analysis (Steps 1-5) and return the LOS letter.
    * Populates flows, v_12, capacities, density, and speeds.
    * @returns {string}
    */
    run_analysis() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmrampsegment_run_analysis(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * Step 1: demand flows [v_F, v_R] in pc/h - Eq. 14-1.
    * @returns {Float64Array}
    */
    determine_demand_flow() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmrampsegment_determine_demand_flow(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Step 2: flow in Lanes 1 and 2, v_12 (pc/h) - Eqs. 14-2..14-19.
    * @returns {number}
    */
    estimate_v12() {
        const ret = wasm.wasmrampsegment_estimate_v12(this.__wbg_ptr);
        return ret;
    }
    /**
    * Step 3: adjusted freeway capacity (pc/h) and capacity checks
    * (Exhibits 14-10/14-12, Eq. 14-21).
    * @returns {number}
    */
    determine_capacity() {
        const ret = wasm.wasmrampsegment_determine_capacity(this.__wbg_ptr);
        return ret;
    }
    /**
    * Step 4: density in the ramp influence area (pc/mi/ln)
    * - Eqs. 14-22/14-23/14-28.
    * @returns {number}
    */
    determine_density() {
        const ret = wasm.wasmrampsegment_determine_density(this.__wbg_ptr);
        return ret;
    }
    /**
    * Level of service letter - Exhibit 14-3.
    * @returns {string}
    */
    determine_los() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmrampsegment_determine_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * Step 5: speeds [S_R, S_O, S] in mi/h - Exhibits 14-13/14-14/14-15.
    * S_O is NaN when the outer-lane speed does not apply.
    * @returns {Float64Array}
    */
    estimate_speed() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmrampsegment_estimate_speed(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number}
    */
    get_flow_freeway() {
        const ret = wasm.wasmrampsegment_get_flow_freeway(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_flow_ramp() {
        const ret = wasm.wasmrampsegment_get_flow_ramp(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number | undefined}
    */
    get_p_f() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmrampsegment_get_p_f(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number}
    */
    get_v12() {
        const ret = wasm.wasmrampsegment_get_v12(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_vr12() {
        const ret = wasm.wasmrampsegment_get_vr12(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_capacity_freeway() {
        const ret = wasm.wasmrampsegment_get_capacity_freeway(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_capacity_ramp() {
        const ret = wasm.wasmrampsegment_get_capacity_ramp(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_vc_ratio() {
        const ret = wasm.wasmrampsegment_get_vc_ratio(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {boolean | undefined}
    */
    get_demand_exceeds_capacity() {
        const ret = wasm.wasmrampsegment_get_demand_exceeds_capacity(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @returns {boolean | undefined}
    */
    get_exceeds_max_desirable() {
        const ret = wasm.wasmrampsegment_get_exceeds_max_desirable(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @returns {number}
    */
    get_density() {
        const ret = wasm.wasmrampsegment_get_density(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_speed_ramp() {
        const ret = wasm.wasmrampsegment_get_speed_ramp(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number | undefined}
    */
    get_speed_outer() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmrampsegment_get_speed_outer(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number}
    */
    get_speed_avg() {
        const ret = wasm.wasmrampsegment_get_speed_avg(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {string | undefined}
    */
    get_los() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmrampsegment_get_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmrampsegment_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmRoundaboutsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmroundabouts_free(ptr >>> 0));
/**
*/
export class WasmRoundabouts {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmRoundaboutsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmroundabouts_free(ptr);
    }
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
    constructor(nb_entry, sb_entry, eb_entry, wb_entry, nb_bypass, sb_bypass, eb_bypass, wb_bypass, nb_lane_assignment, sb_lane_assignment, eb_lane_assignment, wb_lane_assignment, phf, analysis_period_h) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArrayF64ToWasm0(nb_entry, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passArrayF64ToWasm0(sb_entry, wasm.__wbindgen_malloc);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passArrayF64ToWasm0(eb_entry, wasm.__wbindgen_malloc);
            const len2 = WASM_VECTOR_LEN;
            const ptr3 = passArrayF64ToWasm0(wb_entry, wasm.__wbindgen_malloc);
            const len3 = WASM_VECTOR_LEN;
            var ptr4 = isLikeNone(nb_bypass) ? 0 : passStringToWasm0(nb_bypass, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len4 = WASM_VECTOR_LEN;
            var ptr5 = isLikeNone(sb_bypass) ? 0 : passStringToWasm0(sb_bypass, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len5 = WASM_VECTOR_LEN;
            var ptr6 = isLikeNone(eb_bypass) ? 0 : passStringToWasm0(eb_bypass, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len6 = WASM_VECTOR_LEN;
            var ptr7 = isLikeNone(wb_bypass) ? 0 : passStringToWasm0(wb_bypass, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len7 = WASM_VECTOR_LEN;
            var ptr8 = isLikeNone(nb_lane_assignment) ? 0 : passStringToWasm0(nb_lane_assignment, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len8 = WASM_VECTOR_LEN;
            var ptr9 = isLikeNone(sb_lane_assignment) ? 0 : passStringToWasm0(sb_lane_assignment, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len9 = WASM_VECTOR_LEN;
            var ptr10 = isLikeNone(eb_lane_assignment) ? 0 : passStringToWasm0(eb_lane_assignment, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len10 = WASM_VECTOR_LEN;
            var ptr11 = isLikeNone(wb_lane_assignment) ? 0 : passStringToWasm0(wb_lane_assignment, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len11 = WASM_VECTOR_LEN;
            wasm.wasmroundabouts_new(retptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, ptr6, len6, ptr7, len7, ptr8, len8, ptr9, len9, ptr10, len10, ptr11, len11, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(analysis_period_h), isLikeNone(analysis_period_h) ? 0 : analysis_period_h);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0 >>> 0;
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Run the complete HCM Chapter 22 procedure (Steps 1-12).
    */
    analyze() {
        wasm.wasmroundabouts_analyze(this.__wbg_ptr);
    }
    /**
    * Set a local calibration (A, B) for the entry capacity model
    * (Equations 22-21 through 22-23; A = 3,600/t_f,
    * B = (t_c - t_f/2)/3,600).
    * @param {number} a
    * @param {number} b
    */
    set_calibration(a, b) {
        wasm.wasmroundabouts_set_calibration(this.__wbg_ptr, a, b);
    }
    /**
    * Conflicting circulating flow of an entry, pc/h (Equation 22-11).
    * @param {string} entry
    * @returns {number | undefined}
    */
    get_circulating_flow_pce(entry) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(entry, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmroundabouts_get_circulating_flow_pce(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Number of entry lanes with results for an entry.
    * @param {string} entry
    * @returns {number}
    */
    get_lane_count(entry) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(entry, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmroundabouts_get_lane_count(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            return r0 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Entry-lane result (0 = left/only lane) as an object with label,
    * flow_veh, capacity_veh, v_c_ratio, control_delay, los, and queue_95.
    * @param {string} entry
    * @param {number} lane
    * @returns {any}
    */
    lane_result_to_js_value(entry, lane) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(entry, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmroundabouts_lane_result_to_js_value(retptr, this.__wbg_ptr, ptr0, len0, lane);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            return takeObject(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Bypass-lane result object, or null if the entry has no bypass lane.
    * @param {string} entry
    * @returns {any}
    */
    bypass_result_to_js_value(entry) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(entry, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmroundabouts_bypass_result_to_js_value(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            return takeObject(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Approach control delay, s/veh (Equation 22-18, bypass included).
    * @param {string} entry
    * @returns {number | undefined}
    */
    get_approach_delay(entry) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(entry, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmroundabouts_get_approach_delay(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Approach LOS letter (Exhibit 22-8).
    * @param {string} entry
    * @returns {string | undefined}
    */
    get_approach_los(entry) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(entry, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmroundabouts_get_approach_los(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            var r3 = getInt32Memory0()[retptr / 4 + 3];
            if (r3) {
                throw takeObject(r2);
            }
            let v2;
            if (r0 !== 0) {
                v2 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Intersection control delay, s/veh (Equation 22-19).
    * @returns {number | undefined}
    */
    get_intersection_delay() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmroundabouts_get_intersection_delay(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Intersection LOS letter (Exhibit 22-8).
    * @returns {string | undefined}
    */
    get_intersection_los() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmroundabouts_get_intersection_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmroundabouts_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmSegmentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsegment_free(ptr >>> 0));
/**
*/
export class WasmSegment {

    static __unwrap(jsValue) {
        if (!(jsValue instanceof WasmSegment)) {
            return 0;
        }
        return jsValue.__destroy_into_raw();
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSegmentFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsegment_free(ptr);
    }
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
    constructor(passing_type, length, grade, spl, is_hc, volume, volume_op, flow_rate, flow_rate_o, capacity, ffs, avg_speed, vertical_class, wasm_subsegments, phf, phv, pf, fd, fd_mid, hor_class) {
        const ptr0 = passArrayJsValueToWasm0(wasm_subsegments, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsegment_new(passing_type, length, grade, spl, isLikeNone(is_hc) ? 0xFFFFFF : is_hc ? 1 : 0, !isLikeNone(volume), isLikeNone(volume) ? 0 : volume, !isLikeNone(volume_op), isLikeNone(volume_op) ? 0 : volume_op, !isLikeNone(flow_rate), isLikeNone(flow_rate) ? 0 : flow_rate, !isLikeNone(flow_rate_o), isLikeNone(flow_rate_o) ? 0 : flow_rate_o, !isLikeNone(capacity), isLikeNone(capacity) ? 0 : capacity, !isLikeNone(ffs), isLikeNone(ffs) ? 0 : ffs, !isLikeNone(avg_speed), isLikeNone(avg_speed) ? 0 : avg_speed, !isLikeNone(vertical_class), isLikeNone(vertical_class) ? 0 : vertical_class, ptr0, len0, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(phv), isLikeNone(phv) ? 0 : phv, !isLikeNone(pf), isLikeNone(pf) ? 0 : pf, !isLikeNone(fd), isLikeNone(fd) ? 0 : fd, !isLikeNone(fd_mid), isLikeNone(fd_mid) ? 0 : fd_mid, !isLikeNone(hor_class), isLikeNone(hor_class) ? 0 : hor_class);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * @returns {any}
    */
    subsegs_to_js_value() {
        const ret = wasm.wasmsegment_get_subsegments(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    to_js_value() {
        const ret = wasm.wasmsegment_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {number}
    */
    get_passing_type() {
        const ret = wasm.wasmsegment_get_passing_type(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get_length() {
        const ret = wasm.wasmsegment_get_length(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_grade() {
        const ret = wasm.wasmsegment_get_grade(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_spl() {
        const ret = wasm.wasmsegment_get_spl(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {boolean}
    */
    get_is_hc() {
        const ret = wasm.wasmsegment_get_is_hc(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {number}
    */
    get_volume() {
        const ret = wasm.wasmsegment_get_volume(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_volume_op() {
        const ret = wasm.wasmsegment_get_volume_op(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_flow_rate() {
        const ret = wasm.wasmsegment_get_flow_rate(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_flow_rate_o() {
        const ret = wasm.wasmsegment_get_flow_rate_o(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_capacity() {
        const ret = wasm.wasmsegment_get_capacity(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_ffs() {
        const ret = wasm.wasmsegment_get_ffs(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_avg_speed() {
        const ret = wasm.wasmsegment_get_avg_speed(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {any}
    */
    get_subsegments() {
        const ret = wasm.wasmsegment_get_subsegments(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {number}
    */
    get_vertical_class() {
        const ret = wasm.wasmsegment_get_vertical_class(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_phf() {
        const ret = wasm.wasmsegment_get_phf(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_phv() {
        const ret = wasm.wasmsegment_get_phv(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_percent_followers() {
        const ret = wasm.wasmsegment_get_percent_followers(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_followers_density() {
        const ret = wasm.wasmsegment_get_followers_density(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_followers_density_mid() {
        const ret = wasm.wasmsegment_get_followers_density_mid(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_hor_class() {
        const ret = wasm.wasmsegment_get_hor_class(this.__wbg_ptr);
        return ret;
    }
}

const WasmSharedUsePathPedestrianFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsharedusepathpedestrian_free(ptr >>> 0));
/**
*/
export class WasmSharedUsePathPedestrian {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSharedUsePathPedestrianFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsharedusepathpedestrian_free(ptr);
    }
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
    constructor(bicycle_demand_same_direction, bicycle_demand_opposing, phf, pedestrian_speed, bicycle_speed, is_one_way) {
        const ret = wasm.wasmsharedusepathpedestrian_new(!isLikeNone(bicycle_demand_same_direction), isLikeNone(bicycle_demand_same_direction) ? 0 : bicycle_demand_same_direction, !isLikeNone(bicycle_demand_opposing), isLikeNone(bicycle_demand_opposing) ? 0 : bicycle_demand_opposing, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(pedestrian_speed), isLikeNone(pedestrian_speed) ? 0 : pedestrian_speed, !isLikeNone(bicycle_speed), isLikeNone(bicycle_speed) ? 0 : bicycle_speed, isLikeNone(is_one_way) ? 0xFFFFFF : is_one_way ? 1 : 0);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the complete methodology (Steps 1-3) and return the LOS letter.
    * @returns {string}
    */
    analyze() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmsharedusepathpedestrian_analyze(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * Number of passing events F_p, events/h (HCM Equation 24-5).
    * @returns {number}
    */
    get_passing_events() {
        const ret = wasm.wasmexclusivepedestrianfacility_get_unit_flow_rate(this.__wbg_ptr);
        return ret;
    }
    /**
    * Number of meeting events F_m, events/h (HCM Equation 24-6).
    * @returns {number}
    */
    get_meeting_events() {
        const ret = wasm.wasmsharedusepathpedestrian_get_meeting_events(this.__wbg_ptr);
        return ret;
    }
    /**
    * Total weighted events F = F_p + 0.5 F_m, events/h (HCM Equation 24-7).
    * @returns {number}
    */
    get_total_events() {
        const ret = wasm.wasmexclusivepedestrianfacility_get_vc_ratio(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmsharedusepathpedestrian_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmSignalizedIntersectionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsignalizedintersection_free(ptr >>> 0));
/**
*/
export class WasmSignalizedIntersection {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmSignalizedIntersection.prototype);
        obj.__wbg_ptr = ptr;
        WasmSignalizedIntersectionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSignalizedIntersectionFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsignalizedintersection_free(ptr);
    }
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
    constructor(cycle_length_s, analysis_period_h, base_saturation_flow, area_type_cbd, peak_hour_factor, volumes, lanes, through_phase_s, left_phase_s, yellow_s, red_clearance_s, pct_heavy_vehicles, speed_limit_mph, lane_width_ft, ped_flow_ph) {
        const ptr0 = passArrayF64ToWasm0(volumes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray32ToWasm0(lanes, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF64ToWasm0(through_phase_s, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayF64ToWasm0(left_phase_s, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsignalizedintersection_new(cycle_length_s, !isLikeNone(analysis_period_h), isLikeNone(analysis_period_h) ? 0 : analysis_period_h, !isLikeNone(base_saturation_flow), isLikeNone(base_saturation_flow) ? 0 : base_saturation_flow, isLikeNone(area_type_cbd) ? 0xFFFFFF : area_type_cbd ? 1 : 0, !isLikeNone(peak_hour_factor), isLikeNone(peak_hour_factor) ? 0 : peak_hour_factor, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, !isLikeNone(yellow_s), isLikeNone(yellow_s) ? 0 : yellow_s, !isLikeNone(red_clearance_s), isLikeNone(red_clearance_s) ? 0 : red_clearance_s, !isLikeNone(pct_heavy_vehicles), isLikeNone(pct_heavy_vehicles) ? 0 : pct_heavy_vehicles, !isLikeNone(speed_limit_mph), isLikeNone(speed_limit_mph) ? 0 : speed_limit_mph, !isLikeNone(lane_width_ft), isLikeNone(lane_width_ft) ? 0 : lane_width_ft, !isLikeNone(ped_flow_ph), isLikeNone(ped_flow_ph) ? 0 : ped_flow_ph);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Build the intersection from a full configuration object matching the
    * serde schema of `hcm::chapter19::signalized::SignalizedIntersection`
    * (same shape as `tests/ExampleCases/hcm/Signalized/case1.json`).
    * @param {any} config
    * @returns {WasmSignalizedIntersection}
    */
    static from_config(config) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmsignalizedintersection_from_config(retptr, addHeapObject(config));
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            return WasmSignalizedIntersection.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Run the full HCM Ch.19 motorized vehicle methodology (Steps 1-10 of
    * Exhibit 19-18). Populates lane group, approach, and intersection results.
    */
    analyze() {
        wasm.wasmsignalizedintersection_analyze(this.__wbg_ptr);
    }
    /**
    * @returns {number}
    */
    get_cycle_length_s() {
        const ret = wasm.wasmsignalizedintersection_get_cycle_length_s(this.__wbg_ptr);
        return ret;
    }
    /**
    * Intersection control delay d_I, s/veh (HCM Equation 19-29).
    * @returns {number | undefined}
    */
    get_intersection_delay_s() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmsignalizedintersection_get_intersection_delay_s(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Intersection LOS letter (HCM Exhibit 19-8), e.g. "D".
    * @returns {string | undefined}
    */
    get_intersection_los() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmsignalizedintersection_get_intersection_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Critical intersection volume-to-capacity ratio X_c (HCM Equation 19-30).
    * @returns {number | undefined}
    */
    get_critical_vc_ratio() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmsignalizedintersection_get_critical_vc_ratio(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Approach control delay for "NB", "SB", "EB", or "WB", s/veh
    * (HCM Equation 19-28). NaN when the approach has no results.
    * @param {string} direction
    * @returns {number}
    */
    approach_delay_s(direction) {
        const ptr0 = passStringToWasm0(direction, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsignalizedintersection_approach_delay_s(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
    * Approach LOS letter for "NB", "SB", "EB", or "WB" (HCM Exhibit 19-8).
    * Empty string when the approach has no results.
    * @param {string} direction
    * @returns {string}
    */
    approach_los(direction) {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(direction, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmsignalizedintersection_approach_los(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred2_0 = r0;
            deferred2_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
    * Lane-group results (direction, kind, flow rate, saturation flow,
    * capacity, v/c, delays, LOS, back of queue) as a JS array.
    * @returns {any}
    */
    lane_groups_to_js_value() {
        const ret = wasm.wasmsignalizedintersection_lane_groups_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmsignalizedintersection_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmSubSegmentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsubsegment_free(ptr >>> 0));
/**
*/
export class WasmSubSegment {

    static __unwrap(jsValue) {
        if (!(jsValue instanceof WasmSubSegment)) {
            return 0;
        }
        return jsValue.__destroy_into_raw();
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSubSegmentFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsubsegment_free(ptr);
    }
    /**
    * @param {number | undefined} [length]
    * @param {number | undefined} [avg_speed]
    * @param {number | undefined} [design_rad]
    * @param {number | undefined} [central_angle]
    * @param {number | undefined} [hor_class]
    * @param {number | undefined} [sup_ele]
    */
    constructor(length, avg_speed, design_rad, central_angle, hor_class, sup_ele) {
        const ret = wasm.wasmsubsegment_new(!isLikeNone(length), isLikeNone(length) ? 0 : length, !isLikeNone(avg_speed), isLikeNone(avg_speed) ? 0 : avg_speed, !isLikeNone(design_rad), isLikeNone(design_rad) ? 0 : design_rad, !isLikeNone(central_angle), isLikeNone(central_angle) ? 0 : central_angle, !isLikeNone(hor_class), isLikeNone(hor_class) ? 0 : hor_class, !isLikeNone(sup_ele), isLikeNone(sup_ele) ? 0 : sup_ele);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * @returns {any}
    */
    to_js_value() {
        const ret = wasm.wasmsubsegment_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {number}
    */
    get_length() {
        const ret = wasm.wasmsubsegment_get_length(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_avg_speed() {
        const ret = wasm.wasmsubsegment_get_avg_speed(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_hor_class() {
        const ret = wasm.wasmsubsegment_get_hor_class(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_design_rad() {
        const ret = wasm.wasmsegment_get_flow_rate(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_central_angle() {
        const ret = wasm.wasmsegment_get_flow_rate_o(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_sup_ele() {
        const ret = wasm.wasmsegment_get_ffs(this.__wbg_ptr);
        return ret;
    }
}

const WasmTwoLaneHighwaysFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmtwolanehighways_free(ptr >>> 0));
/**
*/
export class WasmTwoLaneHighways {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmTwoLaneHighwaysFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmtwolanehighways_free(ptr);
    }
    /**
    * @param {(WasmSegment)[]} wasm_segments
    * @param {number | undefined} [lane_width]
    * @param {number | undefined} [shoulder_width]
    * @param {number | undefined} [apd]
    * @param {number | undefined} [pmhvfl]
    * @param {number | undefined} [l_de]
    */
    constructor(wasm_segments, lane_width, shoulder_width, apd, pmhvfl, l_de) {
        const ptr0 = passArrayJsValueToWasm0(wasm_segments, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmtwolanehighways_new(ptr0, len0, !isLikeNone(lane_width), isLikeNone(lane_width) ? 0 : lane_width, !isLikeNone(shoulder_width), isLikeNone(shoulder_width) ? 0 : shoulder_width, !isLikeNone(apd), isLikeNone(apd) ? 0 : apd, !isLikeNone(pmhvfl), isLikeNone(pmhvfl) ? 0 : pmhvfl, !isLikeNone(l_de), isLikeNone(l_de) ? 0 : l_de);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * @returns {any}
    */
    segs_to_js_value() {
        const ret = wasm.wasmtwolanehighways_get_segments(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    get_segments() {
        const ret = wasm.wasmtwolanehighways_get_segments(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @param {number} seg_num
    * @returns {Float64Array}
    */
    identify_vertical_class(seg_num) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmtwolanehighways_identify_vertical_class(retptr, this.__wbg_ptr, seg_num);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number} seg_num
    * @returns {Float64Array}
    */
    determine_demand_flow(seg_num) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmtwolanehighways_determine_demand_flow(retptr, this.__wbg_ptr, seg_num);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number} seg_num
    * @returns {number}
    */
    determine_vertical_alignment(seg_num) {
        const ret = wasm.wasmtwolanehighways_determine_vertical_alignment(this.__wbg_ptr, seg_num);
        return ret;
    }
    /**
    * @param {number} seg_num
    * @returns {number}
    */
    determine_free_flow_speed(seg_num) {
        const ret = wasm.wasmtwolanehighways_determine_free_flow_speed(this.__wbg_ptr, seg_num);
        return ret;
    }
    /**
    * @param {number} seg_num
    * @returns {Float64Array}
    */
    estimate_average_speed(seg_num) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmtwolanehighways_estimate_average_speed(retptr, this.__wbg_ptr, seg_num);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number} seg_num
    * @returns {number}
    */
    estimate_percent_followers(seg_num) {
        const ret = wasm.wasmtwolanehighways_estimate_percent_followers(this.__wbg_ptr, seg_num);
        return ret;
    }
    /**
    * @param {number} seg_num
    * @param {number} length
    * @param {number} vd
    * @param {number} phv
    * @param {number} rad
    * @param {number} sup_ele
    * @returns {Float64Array}
    */
    estimate_average_speed_sf(seg_num, length, vd, phv, rad, sup_ele) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmtwolanehighways_estimate_average_speed_sf(retptr, this.__wbg_ptr, seg_num, length, vd, phv, rad, sup_ele);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number} seg_num
    * @param {number} vd
    * @param {number} phv
    * @returns {number}
    */
    estimate_percent_followers_sf(seg_num, vd, phv) {
        const ret = wasm.wasmtwolanehighways_estimate_percent_followers_sf(this.__wbg_ptr, seg_num, vd, phv);
        return ret;
    }
    /**
    * @param {number} seg_num
    * @returns {Float64Array}
    */
    determine_follower_density_pl(seg_num) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmtwolanehighways_determine_follower_density_pl(retptr, this.__wbg_ptr, seg_num);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number} seg_num
    * @returns {number}
    */
    determine_follower_density_pc_pz(seg_num) {
        const ret = wasm.wasmtwolanehighways_determine_follower_density_pc_pz(this.__wbg_ptr, seg_num);
        return ret;
    }
    /**
    * @param {number} seg_num
    * @returns {number}
    */
    determine_adjustment_to_follower_density(seg_num) {
        const ret = wasm.wasmtwolanehighways_determine_adjustment_to_follower_density(this.__wbg_ptr, seg_num);
        return ret;
    }
    /**
    * @param {number} seg_num
    * @param {number} s_pl
    * @param {number} cap
    * @returns {string}
    */
    determine_segment_los(seg_num, s_pl, cap) {
        const ret = wasm.wasmtwolanehighways_determine_segment_los(this.__wbg_ptr, seg_num, s_pl, cap);
        return String.fromCodePoint(ret);
    }
    /**
    * @param {number} fd
    * @param {number} s_pl
    * @returns {string}
    */
    determine_facility_los(fd, s_pl) {
        const ret = wasm.wasmtwolanehighways_determine_facility_los(this.__wbg_ptr, fd, s_pl);
        return String.fromCodePoint(ret);
    }
}

const WasmTwscFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmtwsc_free(ptr >>> 0));
/**
*/
export class WasmTwsc {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmTwscFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmtwsc_free(ptr);
    }
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
    constructor(v1, v1u, v2, v3, v4, v4u, v5, v6, v7, v8, v9, v10, v11, v12, v13_ped, v14_ped, v15_ped, v16_ped, is_three_leg, major_lanes_per_direction, major_right_turn_eb, major_right_turn_wb, uturn_median_width, grade_minor_nb_pct, grade_minor_sb_pct, minor_lanes_nb, minor_lanes_sb, median_storage_nb, median_storage_sb, flare_storage_nb, flare_storage_sb, lane_width_ft, phf, analysis_period_h, heavy_vehicle_pct) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            var ptr0 = isLikeNone(major_right_turn_eb) ? 0 : passStringToWasm0(major_right_turn_eb, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len0 = WASM_VECTOR_LEN;
            var ptr1 = isLikeNone(major_right_turn_wb) ? 0 : passStringToWasm0(major_right_turn_wb, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            var ptr2 = isLikeNone(uturn_median_width) ? 0 : passStringToWasm0(uturn_median_width, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len2 = WASM_VECTOR_LEN;
            var ptr3 = isLikeNone(minor_lanes_nb) ? 0 : passStringToWasm0(minor_lanes_nb, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len3 = WASM_VECTOR_LEN;
            var ptr4 = isLikeNone(minor_lanes_sb) ? 0 : passStringToWasm0(minor_lanes_sb, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len4 = WASM_VECTOR_LEN;
            wasm.wasmtwsc_new(retptr, !isLikeNone(v1), isLikeNone(v1) ? 0 : v1, !isLikeNone(v1u), isLikeNone(v1u) ? 0 : v1u, !isLikeNone(v2), isLikeNone(v2) ? 0 : v2, !isLikeNone(v3), isLikeNone(v3) ? 0 : v3, !isLikeNone(v4), isLikeNone(v4) ? 0 : v4, !isLikeNone(v4u), isLikeNone(v4u) ? 0 : v4u, !isLikeNone(v5), isLikeNone(v5) ? 0 : v5, !isLikeNone(v6), isLikeNone(v6) ? 0 : v6, !isLikeNone(v7), isLikeNone(v7) ? 0 : v7, !isLikeNone(v8), isLikeNone(v8) ? 0 : v8, !isLikeNone(v9), isLikeNone(v9) ? 0 : v9, !isLikeNone(v10), isLikeNone(v10) ? 0 : v10, !isLikeNone(v11), isLikeNone(v11) ? 0 : v11, !isLikeNone(v12), isLikeNone(v12) ? 0 : v12, !isLikeNone(v13_ped), isLikeNone(v13_ped) ? 0 : v13_ped, !isLikeNone(v14_ped), isLikeNone(v14_ped) ? 0 : v14_ped, !isLikeNone(v15_ped), isLikeNone(v15_ped) ? 0 : v15_ped, !isLikeNone(v16_ped), isLikeNone(v16_ped) ? 0 : v16_ped, isLikeNone(is_three_leg) ? 0xFFFFFF : is_three_leg ? 1 : 0, !isLikeNone(major_lanes_per_direction), isLikeNone(major_lanes_per_direction) ? 0 : major_lanes_per_direction, ptr0, len0, ptr1, len1, ptr2, len2, !isLikeNone(grade_minor_nb_pct), isLikeNone(grade_minor_nb_pct) ? 0 : grade_minor_nb_pct, !isLikeNone(grade_minor_sb_pct), isLikeNone(grade_minor_sb_pct) ? 0 : grade_minor_sb_pct, ptr3, len3, ptr4, len4, !isLikeNone(median_storage_nb), isLikeNone(median_storage_nb) ? 0 : median_storage_nb, !isLikeNone(median_storage_sb), isLikeNone(median_storage_sb) ? 0 : median_storage_sb, !isLikeNone(flare_storage_nb), isLikeNone(flare_storage_nb) ? 0 : flare_storage_nb, !isLikeNone(flare_storage_sb), isLikeNone(flare_storage_sb) ? 0 : flare_storage_sb, !isLikeNone(lane_width_ft), isLikeNone(lane_width_ft) ? 0 : lane_width_ft, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(analysis_period_h), isLikeNone(analysis_period_h) ? 0 : analysis_period_h, !isLikeNone(heavy_vehicle_pct), isLikeNone(heavy_vehicle_pct) ? 0 : heavy_vehicle_pct);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0 >>> 0;
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Run the complete HCM Chapter 20 procedure (Steps 1-13).
    */
    analyze() {
        wasm.wasmtwsc_analyze(this.__wbg_ptr);
    }
    /**
    * Demand flow rate of a movement ("1", "1U", ..., "12"), veh/h.
    * @param {string} movement
    * @returns {number}
    */
    get_flow_rate(movement) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(movement, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmtwsc_get_flow_rate(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getFloat64Memory0()[retptr / 8 + 0];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            var r3 = getInt32Memory0()[retptr / 4 + 3];
            if (r3) {
                throw takeObject(r2);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Conflicting flow rate v_c,x of a movement, veh/h (Step 3).
    * @param {string} movement
    * @returns {number | undefined}
    */
    get_conflicting_flow(movement) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(movement, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmtwsc_get_conflicting_flow(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Potential capacity c_p,x of a movement, veh/h (Equation 20-18).
    * @param {string} movement
    * @returns {number | undefined}
    */
    get_potential_capacity(movement) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(movement, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmtwsc_get_potential_capacity(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Movement capacity c_m,x, veh/h (Steps 6-9).
    * @param {string} movement
    * @returns {number | undefined}
    */
    get_movement_capacity(movement) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(movement, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmtwsc_get_movement_capacity(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Control delay of an exclusive-lane movement, s/veh (Equation 20-61).
    * @param {string} movement
    * @returns {number | undefined}
    */
    get_movement_delay(movement) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(movement, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmtwsc_get_movement_delay(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * LOS letter of an exclusive-lane movement (Exhibit 20-2).
    * @param {string} movement
    * @returns {string | undefined}
    */
    get_movement_los(movement) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(movement, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmtwsc_get_movement_los(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            var r3 = getInt32Memory0()[retptr / 4 + 3];
            if (r3) {
                throw takeObject(r2);
            }
            let v2;
            if (r0 !== 0) {
                v2 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * 95th percentile queue of a movement, veh (Equation 20-66).
    * @param {string} movement
    * @returns {number | undefined}
    */
    get_movement_queue_95(movement) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-32);
            const ptr0 = passStringToWasm0(movement, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmtwsc_get_movement_queue_95(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            var r4 = getInt32Memory0()[retptr / 4 + 4];
            var r5 = getInt32Memory0()[retptr / 4 + 5];
            if (r5) {
                throw takeObject(r4);
            }
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(32);
        }
    }
    /**
    * Number of minor-street approach lanes ("NB" or "SB").
    * @param {string} approach
    * @returns {number}
    */
    get_lane_count(approach) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmtwsc_get_lane_count(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            return r0 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Minor-approach lane result as an object with movements, flow_rate,
    * capacity, control_delay, los, and queue_95.
    * @param {string} approach
    * @param {number} lane
    * @returns {any}
    */
    lane_result_to_js_value(approach, lane) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(approach, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.wasmtwsc_lane_result_to_js_value(retptr, this.__wbg_ptr, ptr0, len0, lane);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeObject(r1);
            }
            return takeObject(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Approach control delays [EB, WB, NB, SB], s/veh (Equation 20-64).
    * Empty before `analyze()` has run.
    * @returns {Float64Array}
    */
    get_approach_delays() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmtwsc_get_approach_delays(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Intersection control delay, s/veh (Equation 20-65). Note LOS is not
    * defined for a TWSC intersection as a whole.
    * @returns {number | undefined}
    */
    get_intersection_delay() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmtwsc_get_intersection_delay(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmtwsc_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmUrbanFacilityFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmurbanfacility_free(ptr >>> 0));
/**
*/
export class WasmUrbanFacility {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmUrbanFacilityFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmurbanfacility_free(ptr);
    }
    /**
    * @param {number | undefined} [prop_left_turn_lanes]
    */
    constructor(prop_left_turn_lanes) {
        const ret = wasm.wasmurbanfacility_new(!isLikeNone(prop_left_turn_lanes), isLikeNone(prop_left_turn_lanes) ? 0 : prop_left_turn_lanes);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Append a Chapter 18 segment (ordered upstream to downstream) to the
    * facility in the subject direction of travel.
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
    */
    add_segment(segment_length_ft, n_through_lanes, speed_limit_mph, through_demand_veh_h, control, n_access_points_subject, n_access_points_opposing, midsegment_flow_veh_h, through_capacity_veh_h, through_control_delay_s, cycle_length_s, effective_green_s, platoon_ratio, sat_flow_veh_h_ln, full_stop_rate_override) {
        const ptr0 = passStringToWasm0(control, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmurbanfacility_add_segment(this.__wbg_ptr, segment_length_ft, n_through_lanes, speed_limit_mph, through_demand_veh_h, ptr0, len0, !isLikeNone(n_access_points_subject), isLikeNone(n_access_points_subject) ? 0 : n_access_points_subject, !isLikeNone(n_access_points_opposing), isLikeNone(n_access_points_opposing) ? 0 : n_access_points_opposing, !isLikeNone(midsegment_flow_veh_h), isLikeNone(midsegment_flow_veh_h) ? 0 : midsegment_flow_veh_h, !isLikeNone(through_capacity_veh_h), isLikeNone(through_capacity_veh_h) ? 0 : through_capacity_veh_h, !isLikeNone(through_control_delay_s), isLikeNone(through_control_delay_s) ? 0 : through_control_delay_s, !isLikeNone(cycle_length_s), isLikeNone(cycle_length_s) ? 0 : cycle_length_s, !isLikeNone(effective_green_s), isLikeNone(effective_green_s) ? 0 : effective_green_s, !isLikeNone(platoon_ratio), isLikeNone(platoon_ratio) ? 0 : platoon_ratio, !isLikeNone(sat_flow_veh_h_ln), isLikeNone(sat_flow_veh_h_ln) ? 0 : sat_flow_veh_h_ln, !isLikeNone(full_stop_rate_override), isLikeNone(full_stop_rate_override) ? 0 : full_stop_rate_override);
    }
    /**
    * Run the full HCM Ch.16 pipeline: evaluate every segment with the
    * Chapter 18 engine, then aggregate (Equations 16-2 through 16-4 and
    * the Exhibit 16-3 LOS). Returns the facility LOS letter.
    * @returns {string}
    */
    analyze() {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanfacility_analyze(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            var r3 = getInt32Memory0()[retptr / 4 + 3];
            var ptr1 = r0;
            var len1 = r1;
            if (r3) {
                ptr1 = 0; len1 = 0;
                throw takeObject(r2);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
    * @returns {number}
    */
    num_segments() {
        const ret = wasm.wasmurbanfacility_num_segments(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get_length_ft() {
        const ret = wasm.wasmurbanfacility_get_length_ft(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number | undefined}
    */
    get_base_ffs() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanfacility_get_base_ffs(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_travel_speed() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanfacility_get_travel_speed(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_travel_time() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanfacility_get_travel_time(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_base_free_flow_travel_time() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanfacility_get_base_free_flow_travel_time(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_spatial_stop_rate() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanfacility_get_spatial_stop_rate(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_critical_vc_ratio() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanfacility_get_critical_vc_ratio(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_perception_score() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanfacility_get_perception_score(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    get_los() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanfacility_get_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @returns {string}
    */
    get_poorest_segment_los() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanfacility_get_poorest_segment_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * Per-segment results (travel speed, base FFS, spatial stop rate, v/c
    * ratio, LOS) as an array of plain objects, ordered upstream to
    * downstream.
    * @returns {any}
    */
    segments_to_js_value() {
        const ret = wasm.wasmurbanfacility_segments_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmurbanfacility_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmUrbanReliabilityFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmurbanreliability_free(ptr >>> 0));
/**
*/
export class WasmUrbanReliability {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmUrbanReliabilityFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmurbanreliability_free(ptr);
    }
    /**
    * Scope: a fully signalized urban street facility (every segment's
    * downstream boundary intersection is a traffic signal), evaluated
    * with the HCM default demand-ratio, weather, and incident models.
    * Each monthly weather array takes 0, 1, or 12 entries (none, one
    * value replicated to every month, or January-December values).
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
    */
    constructor(functional_class, study_period_start_hour, analysis_periods_per_day, monthly_total_precip_in, monthly_days_with_precip, monthly_mean_temp_f, monthly_precip_rate_in_h, entry_intersection_crash_frequency, minor_leg_volume_veh_h, shoulder_present, vmt_weighted, weather_seed, demand_seed, incident_seed) {
        var ptr0 = isLikeNone(functional_class) ? 0 : passStringToWasm0(functional_class, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(monthly_total_precip_in, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF64ToWasm0(monthly_days_with_precip, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayF64ToWasm0(monthly_mean_temp_f, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArrayF64ToWasm0(monthly_precip_rate_in_h, wasm.__wbindgen_malloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmurbanreliability_new(ptr0, len0, !isLikeNone(study_period_start_hour), isLikeNone(study_period_start_hour) ? 0 : study_period_start_hour, !isLikeNone(analysis_periods_per_day), isLikeNone(analysis_periods_per_day) ? 0 : analysis_periods_per_day, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, !isLikeNone(entry_intersection_crash_frequency), isLikeNone(entry_intersection_crash_frequency) ? 0 : entry_intersection_crash_frequency, !isLikeNone(minor_leg_volume_veh_h), isLikeNone(minor_leg_volume_veh_h) ? 0 : minor_leg_volume_veh_h, isLikeNone(shoulder_present) ? 0xFFFFFF : shoulder_present ? 1 : 0, isLikeNone(vmt_weighted) ? 0xFFFFFF : vmt_weighted ? 1 : 0, !isLikeNone(weather_seed), isLikeNone(weather_seed) ? 0 : weather_seed, !isLikeNone(demand_seed), isLikeNone(demand_seed) ? 0 : demand_seed, !isLikeNone(incident_seed), isLikeNone(incident_seed) ? 0 : incident_seed);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
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
    */
    add_segment(segment_length_ft, n_through_lanes, speed_limit_mph, through_demand_veh_h, cycle_length_s, effective_green_s, sat_flow_veh_h_ln, platoon_ratio, n_access_points_subject, n_access_points_opposing, full_stop_rate_override, segment_crash_frequency, intersection_crash_frequency) {
        wasm.wasmurbanreliability_add_segment(this.__wbg_ptr, segment_length_ft, n_through_lanes, speed_limit_mph, through_demand_veh_h, cycle_length_s, effective_green_s, !isLikeNone(sat_flow_veh_h_ln), isLikeNone(sat_flow_veh_h_ln) ? 0 : sat_flow_veh_h_ln, !isLikeNone(platoon_ratio), isLikeNone(platoon_ratio) ? 0 : platoon_ratio, !isLikeNone(n_access_points_subject), isLikeNone(n_access_points_subject) ? 0 : n_access_points_subject, !isLikeNone(n_access_points_opposing), isLikeNone(n_access_points_opposing) ? 0 : n_access_points_opposing, !isLikeNone(full_stop_rate_override), isLikeNone(full_stop_rate_override) ? 0 : full_stop_rate_override, segment_crash_frequency, intersection_crash_frequency);
    }
    /**
    * Run the full HCM Ch.17 methodology: weather, demand, and incident
    * scenario generation over a one-year reliability reporting period
    * (weekdays), Chapter 16/18 evaluation of every scenario, and the
    * travel time distribution summary.
    */
    run() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanreliability_run(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number}
    */
    num_segments() {
        const ret = wasm.wasmurbanreliability_num_segments(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    num_scenarios() {
        const ret = wasm.wasmurbanreliability_num_scenarios(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    num_weather_events() {
        const ret = wasm.wasmurbanreliability_num_weather_events(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    num_incidents() {
        const ret = wasm.wasmurbanreliability_num_incidents(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number | undefined}
    */
    get_base_free_flow_travel_time() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanreliability_get_base_free_flow_travel_time(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_mean_travel_time() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanreliability_get_mean_travel_time(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_total_vhd() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbanreliability_get_total_vhd(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Mean travel time index across the weighted scenario distribution.
    * @returns {number}
    */
    tti_mean() {
        const ret = wasm.wasmurbanreliability_tti_mean(this.__wbg_ptr);
        return ret;
    }
    /**
    * Weighted percentile TTI (p in 0-100), e.g. 95 for the planning
    * time index.
    * @param {number} p
    * @returns {number}
    */
    tti_percentile(p) {
        const ret = wasm.wasmurbanreliability_tti_percentile(this.__wbg_ptr, p);
        return ret;
    }
    /**
    * Urban street reliability rating, percent of the weighted
    * distribution with TTI below 2.5.
    * @returns {number}
    */
    reliability_rating() {
        const ret = wasm.wasmurbanreliability_reliability_rating(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmurbanreliability_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmUrbanSegmentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmurbansegment_free(ptr >>> 0));
/**
*/
export class WasmUrbanSegment {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmUrbanSegmentFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmurbansegment_free(ptr);
    }
    /**
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
    */
    constructor(segment_length_ft, n_through_lanes, speed_limit_mph, through_demand_veh_h, control, upstream_intersection_width_ft, restrictive_median_length_ft, proportion_with_curb, proportion_on_street_parking, n_access_points_subject, n_access_points_opposing, prop_opposing_left_accessible, signal_spacing_ft, free_flow_speed_override_mph, midsegment_flow_veh_h, through_capacity_veh_h, through_control_delay_s, cycle_length_s, effective_green_s, arrival_type, platoon_ratio, sat_flow_veh_h_ln, stopped_vehicles_veh_ln, queue2_veh_ln, queue3_veh_ln, full_stop_rate_override, stop_rate_other, prop_left_turn_lanes) {
        const ptr0 = passStringToWasm0(control, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmurbansegment_new(segment_length_ft, n_through_lanes, speed_limit_mph, through_demand_veh_h, ptr0, len0, !isLikeNone(upstream_intersection_width_ft), isLikeNone(upstream_intersection_width_ft) ? 0 : upstream_intersection_width_ft, !isLikeNone(restrictive_median_length_ft), isLikeNone(restrictive_median_length_ft) ? 0 : restrictive_median_length_ft, !isLikeNone(proportion_with_curb), isLikeNone(proportion_with_curb) ? 0 : proportion_with_curb, !isLikeNone(proportion_on_street_parking), isLikeNone(proportion_on_street_parking) ? 0 : proportion_on_street_parking, !isLikeNone(n_access_points_subject), isLikeNone(n_access_points_subject) ? 0 : n_access_points_subject, !isLikeNone(n_access_points_opposing), isLikeNone(n_access_points_opposing) ? 0 : n_access_points_opposing, !isLikeNone(prop_opposing_left_accessible), isLikeNone(prop_opposing_left_accessible) ? 0 : prop_opposing_left_accessible, !isLikeNone(signal_spacing_ft), isLikeNone(signal_spacing_ft) ? 0 : signal_spacing_ft, !isLikeNone(free_flow_speed_override_mph), isLikeNone(free_flow_speed_override_mph) ? 0 : free_flow_speed_override_mph, !isLikeNone(midsegment_flow_veh_h), isLikeNone(midsegment_flow_veh_h) ? 0 : midsegment_flow_veh_h, !isLikeNone(through_capacity_veh_h), isLikeNone(through_capacity_veh_h) ? 0 : through_capacity_veh_h, !isLikeNone(through_control_delay_s), isLikeNone(through_control_delay_s) ? 0 : through_control_delay_s, !isLikeNone(cycle_length_s), isLikeNone(cycle_length_s) ? 0 : cycle_length_s, !isLikeNone(effective_green_s), isLikeNone(effective_green_s) ? 0 : effective_green_s, !isLikeNone(arrival_type), isLikeNone(arrival_type) ? 0 : arrival_type, !isLikeNone(platoon_ratio), isLikeNone(platoon_ratio) ? 0 : platoon_ratio, !isLikeNone(sat_flow_veh_h_ln), isLikeNone(sat_flow_veh_h_ln) ? 0 : sat_flow_veh_h_ln, !isLikeNone(stopped_vehicles_veh_ln), isLikeNone(stopped_vehicles_veh_ln) ? 0 : stopped_vehicles_veh_ln, !isLikeNone(queue2_veh_ln), isLikeNone(queue2_veh_ln) ? 0 : queue2_veh_ln, !isLikeNone(queue3_veh_ln), isLikeNone(queue3_veh_ln) ? 0 : queue3_veh_ln, !isLikeNone(full_stop_rate_override), isLikeNone(full_stop_rate_override) ? 0 : full_stop_rate_override, !isLikeNone(stop_rate_other), isLikeNone(stop_rate_other) ? 0 : stop_rate_other, !isLikeNone(prop_left_turn_lanes), isLikeNone(prop_left_turn_lanes) ? 0 : prop_left_turn_lanes);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the full HCM Ch.18 motorized vehicle pipeline (Steps 1-3 and
    * 5-10) and return the segment LOS letter (Exhibit 18-1).
    * Populates free-flow speed, running time, travel speed, stop rates,
    * v/c ratio, and the perception score.
    * @returns {string}
    */
    analyze() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_analyze(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_base_ffs() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_base_ffs(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_free_flow_speed() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_free_flow_speed(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_running_time() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_running_time(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_running_speed() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_running_speed(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_proportion_arriving_green() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_proportion_arriving_green(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_access_point_delay() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_access_point_delay(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_through_delay() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_through_delay(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_full_stop_rate() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_full_stop_rate(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_travel_speed() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_travel_speed(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_spatial_stop_rate() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_spatial_stop_rate(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number | undefined}
    */
    get_vc_ratio() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_vc_ratio(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {boolean | undefined}
    */
    get_demand_exceeds_capacity() {
        const ret = wasm.wasmurbansegment_get_demand_exceeds_capacity(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @returns {number | undefined}
    */
    get_perception_score() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_perception_score(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getFloat64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    get_los() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmurbansegment_get_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmurbansegment_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

const WasmWeavingSegmentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmweavingsegment_free(ptr >>> 0));
/**
*/
export class WasmWeavingSegment {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmWeavingSegmentFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmweavingsegment_free(ptr);
    }
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
    */
    constructor(weaving_type, facility_type, length_short, num_lanes, num_weaving_lanes, ffs, v_ff, v_fr, v_rf, v_rr, phf, heavy_vehicle_pct, terrain, lc_rf, lc_fr, lc_rr, interchange_density, basic_freeway_capacity, caf, saf) {
        var ptr0 = isLikeNone(weaving_type) ? 0 : passStringToWasm0(weaving_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(facility_type) ? 0 : passStringToWasm0(facility_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(terrain) ? 0 : passStringToWasm0(terrain, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmweavingsegment_new(ptr0, len0, ptr1, len1, !isLikeNone(length_short), isLikeNone(length_short) ? 0 : length_short, !isLikeNone(num_lanes), isLikeNone(num_lanes) ? 0 : num_lanes, !isLikeNone(num_weaving_lanes), isLikeNone(num_weaving_lanes) ? 0 : num_weaving_lanes, !isLikeNone(ffs), isLikeNone(ffs) ? 0 : ffs, !isLikeNone(v_ff), isLikeNone(v_ff) ? 0 : v_ff, !isLikeNone(v_fr), isLikeNone(v_fr) ? 0 : v_fr, !isLikeNone(v_rf), isLikeNone(v_rf) ? 0 : v_rf, !isLikeNone(v_rr), isLikeNone(v_rr) ? 0 : v_rr, !isLikeNone(phf), isLikeNone(phf) ? 0 : phf, !isLikeNone(heavy_vehicle_pct), isLikeNone(heavy_vehicle_pct) ? 0 : heavy_vehicle_pct, ptr2, len2, !isLikeNone(lc_rf), isLikeNone(lc_rf) ? 0 : lc_rf, !isLikeNone(lc_fr), isLikeNone(lc_fr) ? 0 : lc_fr, !isLikeNone(lc_rr), isLikeNone(lc_rr) ? 0 : lc_rr, !isLikeNone(interchange_density), isLikeNone(interchange_density) ? 0 : interchange_density, !isLikeNone(basic_freeway_capacity), isLikeNone(basic_freeway_capacity) ? 0 : basic_freeway_capacity, !isLikeNone(caf), isLikeNone(caf) ? 0 : caf, !isLikeNone(saf), isLikeNone(saf) ? 0 : saf);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }
    /**
    * Run the full HCM Ch.13 analysis (Steps 2-8) and return the LOS letter.
    * Populates flows, capacity, lane-changing rates, speeds, and density.
    * @returns {string}
    */
    run_analysis() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmweavingsegment_run_analysis(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * Step 2: demand flows under equivalent ideal conditions (Eq. 13-1).
    * Returns [v_W, v_NW, v] in pc/h.
    * @returns {Float64Array}
    */
    determine_demand_flow() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmweavingsegment_determine_demand_flow(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Step 3: minimum lane-changing rate LC_MIN (lc/h) - Eqs. 13-2/13-3.
    * @returns {number}
    */
    determine_configuration_characteristics() {
        const ret = wasm.wasmweavingsegment_determine_configuration_characteristics(this.__wbg_ptr);
        return ret;
    }
    /**
    * Step 4: maximum weaving length L_MAX (ft) - Eq. 13-4.
    * @returns {number}
    */
    determine_max_weaving_length() {
        const ret = wasm.wasmweavingsegment_determine_max_weaving_length(this.__wbg_ptr);
        return ret;
    }
    /**
    * Step 5: weaving segment capacity (veh/h) - Eqs. 13-5..13-10.
    * @returns {number}
    */
    determine_capacity() {
        const ret = wasm.wasmweavingsegment_determine_capacity(this.__wbg_ptr);
        return ret;
    }
    /**
    * Step 6: total lane-changing rate LC_ALL (lc/h) - Eqs. 13-11..13-17.
    * @returns {number}
    */
    determine_lane_changing_rates() {
        const ret = wasm.wasmweavingsegment_determine_lane_changing_rates(this.__wbg_ptr);
        return ret;
    }
    /**
    * Step 7: speeds [S_W, S_NW, S] in mi/h - Eqs. 13-18..13-22.
    * @returns {Float64Array}
    */
    estimate_speed() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmweavingsegment_estimate_speed(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Step 8a: density (pc/mi/ln) - Eq. 13-23.
    * @returns {number}
    */
    determine_density() {
        const ret = wasm.wasmweavingsegment_determine_density(this.__wbg_ptr);
        return ret;
    }
    /**
    * Step 8b: level of service letter - Exhibit 13-6.
    * @returns {string}
    */
    determine_los() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmweavingsegment_determine_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
    * @returns {number}
    */
    get_flow_weaving() {
        const ret = wasm.wasmweavingsegment_get_flow_weaving(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_flow_nonweaving() {
        const ret = wasm.wasmweavingsegment_get_flow_nonweaving(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_flow_total() {
        const ret = wasm.wasmweavingsegment_get_flow_total(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_volume_ratio() {
        const ret = wasm.wasmweavingsegment_get_volume_ratio(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_lc_min() {
        const ret = wasm.wasmweavingsegment_get_lc_min(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_l_max() {
        const ret = wasm.wasmweavingsegment_get_l_max(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {boolean}
    */
    is_weaving() {
        const ret = wasm.wasmweavingsegment_is_weaving(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {number}
    */
    get_capacity() {
        const ret = wasm.wasmweavingsegment_get_capacity(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_vc_ratio() {
        const ret = wasm.wasmweavingsegment_get_vc_ratio(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_lc_all() {
        const ret = wasm.wasmweavingsegment_get_lc_all(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_speed_weaving() {
        const ret = wasm.wasmweavingsegment_get_speed_weaving(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_speed_nonweaving() {
        const ret = wasm.wasmweavingsegment_get_speed_nonweaving(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_speed_avg() {
        const ret = wasm.wasmweavingsegment_get_speed_avg(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_density() {
        const ret = wasm.wasmweavingsegment_get_density(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {string | undefined}
    */
    get_los() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmweavingsegment_get_los(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {any}
    */
    results_to_js_value() {
        const ret = wasm.wasmweavingsegment_results_to_js_value(this.__wbg_ptr);
        return takeObject(ret);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_get_bd8e338fbd5f5cc8 = function(arg0, arg1) {
        const ret = getObject(arg0)[arg1 >>> 0];
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_length_cd7af8117672b8b8 = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbg_new_16b304a2cfa7ff4a = function() {
        const ret = new Array();
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_number_new = function(arg0) {
        const ret = arg0;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof(getObject(arg0)) === 'function';
        return ret;
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = getObject(arg0);
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbg_next_40fc327bfc8770e6 = function(arg0) {
        const ret = getObject(arg0).next;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_next_196c84450b364254 = function() { return handleError(function (arg0) {
        const ret = getObject(arg0).next();
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbindgen_bigint_get_as_i64 = function(arg0, arg1) {
        const v = getObject(arg1);
        const ret = typeof(v) === 'bigint' ? v : undefined;
        getBigInt64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? BigInt(0) : ret;
        getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
    };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(getObject(arg1));
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len1;
        getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = getObject(arg1);
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len1;
        getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    };
    imports.wbg.__wbg_done_298b57d23c0fc80c = function(arg0) {
        const ret = getObject(arg0).done;
        return ret;
    };
    imports.wbg.__wbg_value_d93c65011f51a456 = function(arg0) {
        const ret = getObject(arg0).value;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_iterator_2cee6dadfd956dfa = function() {
        const ret = Symbol.iterator;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_get_e3c254076557e348 = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.get(getObject(arg0), getObject(arg1));
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_call_27c0f87801dedf93 = function() { return handleError(function (arg0, arg1) {
        const ret = getObject(arg0).call(getObject(arg1));
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_new_72fb9a18b5ae2624 = function() {
        const ret = new Object();
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof(getObject(arg0)) === 'string';
        return ret;
    };
    imports.wbg.__wbindgen_number_get = function(arg0, arg1) {
        const obj = getObject(arg1);
        const ret = typeof(obj) === 'number' ? obj : undefined;
        getFloat64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? 0 : ret;
        getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
    };
    imports.wbg.__wbindgen_object_clone_ref = function(arg0) {
        const ret = getObject(arg0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = getObject(arg0) === undefined;
        return ret;
    };
    imports.wbg.__wbg_set_d4638f722068f043 = function(arg0, arg1, arg2) {
        getObject(arg0)[arg1 >>> 0] = takeObject(arg2);
    };
    imports.wbg.__wbg_isArray_2ab64d95e09ea0ae = function(arg0) {
        const ret = Array.isArray(getObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_push_a5b05aedc7234f9f = function(arg0, arg1) {
        const ret = getObject(arg0).push(getObject(arg1));
        return ret;
    };
    imports.wbg.__wbg_instanceof_ArrayBuffer_836825be07d4c9d2 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof ArrayBuffer;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_isSafeInteger_f7b04ef02296c4d2 = function(arg0) {
        const ret = Number.isSafeInteger(getObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_entries_95cc2c823b285a09 = function(arg0) {
        const ret = Object.entries(getObject(arg0));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_buffer_12d079cc21e14bdb = function(arg0) {
        const ret = getObject(arg0).buffer;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_63b92bc8671ed464 = function(arg0) {
        const ret = new Uint8Array(getObject(arg0));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_a47bac70306a19a7 = function(arg0, arg1, arg2) {
        getObject(arg0).set(getObject(arg1), arg2 >>> 0);
    };
    imports.wbg.__wbg_length_c20a40f15020d68a = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Uint8Array_2b3bbecd033d19f6 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof Uint8Array;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbindgen_jsval_loose_eq = function(arg0, arg1) {
        const ret = getObject(arg0) == getObject(arg1);
        return ret;
    };
    imports.wbg.__wbindgen_boolean_get = function(arg0) {
        const v = getObject(arg0);
        const ret = typeof(v) === 'boolean' ? (v ? 1 : 0) : 2;
        return ret;
    };
    imports.wbg.__wbg_String_91fba7ded13ba54c = function(arg0, arg1) {
        const ret = String(getObject(arg1));
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len1;
        getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_bigint_from_u64 = function(arg0) {
        const ret = BigInt.asUintN(64, arg0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_getwithrefkey_15c62c2b8546208d = function(arg0, arg1) {
        const ret = getObject(arg0)[getObject(arg1)];
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_20cbc34131e76824 = function(arg0, arg1, arg2) {
        getObject(arg0)[takeObject(arg1)] = takeObject(arg2);
    };
    imports.wbg.__wbg_wasmfacilitysegment_unwrap = function(arg0) {
        const ret = WasmFacilitySegment.__unwrap(takeObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_wasmsubsegment_unwrap = function(arg0) {
        const ret = WasmSubSegment.__unwrap(takeObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_wasmsegment_unwrap = function(arg0) {
        const ret = WasmSegment.__unwrap(takeObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_set_1f9b04f170055d33 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
        return ret;
    }, arguments) };
    imports.wbg.__wbindgen_in = function(arg0, arg1) {
        const ret = getObject(arg0) in getObject(arg1);
        return ret;
    };
    imports.wbg.__wbindgen_is_bigint = function(arg0) {
        const ret = typeof(getObject(arg0)) === 'bigint';
        return ret;
    };
    imports.wbg.__wbindgen_jsval_eq = function(arg0, arg1) {
        const ret = getObject(arg0) === getObject(arg1);
        return ret;
    };

    return imports;
}

function __wbg_init_memory(imports, maybe_memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedBigInt64Memory0 = null;
    cachedFloat64Memory0 = null;
    cachedInt32Memory0 = null;
    cachedUint32Memory0 = null;
    cachedUint8Memory0 = null;


    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(input) {
    if (wasm !== undefined) return wasm;

    if (typeof input === 'undefined') {
        input = new URL('HCM_middleware_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request) || (typeof URL === 'function' && input instanceof URL)) {
        input = fetch(input);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await input, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync }
export default __wbg_init;
