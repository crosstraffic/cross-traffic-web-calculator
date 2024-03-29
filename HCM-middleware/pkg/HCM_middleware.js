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

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
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

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64Memory0().subarray(ptr / 8, ptr / 8 + len);
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
    * @param {boolean} is_hc
    * @param {number} volume
    * @param {number} volume_op
    * @param {number} flow_rate
    * @param {number} flow_rate_o
    * @param {number} capacity
    * @param {number} ffs
    * @param {number} avg_speed
    * @param {number} vertical_class
    * @param {(WasmSubSegment)[]} wasm_subsegments
    * @param {number} phf
    * @param {number} phv
    * @param {number} pf
    * @param {number} fd
    * @param {number} fd_mid
    * @param {number} hor_class
    */
    constructor(passing_type, length, grade, spl, is_hc, volume, volume_op, flow_rate, flow_rate_o, capacity, ffs, avg_speed, vertical_class, wasm_subsegments, phf, phv, pf, fd, fd_mid, hor_class) {
        const ptr0 = passArrayJsValueToWasm0(wasm_subsegments, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsegment_new(passing_type, length, grade, spl, is_hc, volume, volume_op, flow_rate, flow_rate_o, capacity, ffs, avg_speed, vertical_class, ptr0, len0, phf, phv, pf, fd, fd_mid, hor_class);
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
    * @param {number} length
    * @param {number} avg_speed
    * @param {number} hor_class
    * @param {number} design_rad
    * @param {number} sup_ele
    */
    constructor(length, avg_speed, hor_class, design_rad, sup_ele) {
        const ret = wasm.wasmsubsegment_new(length, avg_speed, hor_class, design_rad, sup_ele);
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
        const ret = wasm.wasmsegment_get_length(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_avg_speed() {
        const ret = wasm.wasmsegment_get_grade(this.__wbg_ptr);
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
        const ret = wasm.wasmsegment_get_spl(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get_sup_ele() {
        const ret = wasm.wasmsegment_get_volume(this.__wbg_ptr);
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
    * @param {number} lane_width
    * @param {number} shoulder_width
    * @param {number} apd
    * @param {number} pmhvfl
    * @param {number} l_de
    */
    constructor(wasm_segments, lane_width, shoulder_width, apd, pmhvfl, l_de) {
        const ptr0 = passArrayJsValueToWasm0(wasm_segments, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmtwolanehighways_new(ptr0, len0, lane_width, shoulder_width, apd, pmhvfl, l_de);
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
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return addHeapObject(ret);
    };
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
    imports.wbg.__wbg_wasmsubsegment_unwrap = function(arg0) {
        const ret = WasmSubSegment.__unwrap(takeObject(arg0));
        return ret;
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_wasmsegment_unwrap = function(arg0) {
        const ret = WasmSegment.__unwrap(takeObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_getwithrefkey_15c62c2b8546208d = function(arg0, arg1) {
        const ret = getObject(arg0)[getObject(arg1)];
        return addHeapObject(ret);
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
    imports.wbg.__wbindgen_bigint_from_u64 = function(arg0) {
        const ret = BigInt.asUintN(64, arg0);
        return addHeapObject(ret);
    };
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
    imports.wbg.__wbg_set_1f9b04f170055d33 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
        return ret;
    }, arguments) };

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
