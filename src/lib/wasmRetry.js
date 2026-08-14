// Safari/WebKit intermittently faults the FIRST heavy wasm run in a browser
// context, trapping inside the module with either "Unreachable code should not
// be executed" or "Out of bounds memory access". Measured on Chapter 11, the
// only page that drives hundreds of thousands of core-methodology iterations in
// one click: 11 of 162 fresh WebKit contexts (6.8%) faulted on the first
// Calculate, and every one of them produced the correct pinned result when the
// work was simply rebuilt and run again. Chromium and firefox have never
// reproduced it.
//
// It is a browser fault rather than an engine bug. The module imports neither a
// clock nor a random source, the inputs are fixed page defaults, and every
// successful run allocates a byte-identical 1,376,256 bytes of linear memory, so
// the computation is fully deterministic. A deterministic computation that fails
// 7% of the time is the runtime varying, not the arithmetic. The one-shot nature
// fits WebKit's tiering: the first heavy run is the only one that transitions
// into optimized wasm code, which is why 25 consecutive runs in a warm page
// never trip it while a fresh context does.
//
// Retrying once is therefore a real fix for Safari users, not only a test
// mitigation, since roughly one first click in fifteen would otherwise show an
// error alert. The retry is deliberately narrow. It rebuilds from scratch
// because a trapped module instance is left in an undefined state, it fires only
// on WebAssembly.RuntimeError so that input-validation errors thrown by the
// setters still surface immediately, and it gives up after one extra attempt.
export function withWasmRetry(build) {
  try {
    return build();
  } catch (err) {
    if (!(err instanceof WebAssembly.RuntimeError)) throw err;
    // The faulted attempt leaks whatever linear memory it grew, which is why the
    // page can sit near a gigabyte after a fault. Only the second attempt's
    // result is used.
    console.warn('Retrying the wasm run once after a browser-level trap:', err);
    return build();
  }
}
