// Boundary validation harness: runs the published HCM example problems through
// the built WASM package so the whole chain from JS constructor to LOS is
// checked against the book, not just the Rust core. Expected values and
// tolerances mirror the transportations-library integration tests, which cite
// the HCM chapter and example problem for each number.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Library fixtures come from the sibling checkout, or from HCM_LIB_CASES.
// tests/libCases.mjs says why that is not a one-line join.
import { readCase } from '../libCases.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, '..', '..', 'HCM-middleware', 'pkg');

let wasm = null;
export async function loadWasm() {
  if (!wasm) {
    wasm = await import(join(pkgDir, 'HCM_middleware.js'));
    await wasm.default(readFileSync(join(pkgDir, 'HCM_middleware_bg.wasm')));
  }
  return wasm;
}

export const loadCase = readCase;

const failures = [];
let checks = 0;

export function approx(actual, expected, tol, label) {
  checks += 1;
  if (typeof actual !== 'number' || Number.isNaN(actual) || Math.abs(actual - expected) > tol) {
    failures.push(`${label}: got ${actual}, expected ${expected} (+-${tol})`);
  }
}

export function exact(actual, expected, label) {
  checks += 1;
  if (String(actual) !== String(expected)) {
    failures.push(`${label}: got ${actual}, expected ${expected}`);
  }
}

export function report(chapter) {
  if (failures.length) {
    console.log(`FAIL  ${chapter}  (${failures.length}/${checks} checks failed)`);
    for (const f of failures) console.log(`      ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`OK    ${chapter}  (${checks} checks)`);
  }
}
