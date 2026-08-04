// Boundary validation harness: runs the published HCM example problems through
// the built WASM package so the whole chain from JS constructor to LOS is
// checked against the book, not just the Rust core. Expected values and
// tolerances mirror the transportations-library integration tests, which cite
// the HCM chapter and example problem for each number.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, '..', '..', 'HCM-middleware', 'pkg');
// Library fixtures come from the sibling checkout (../transportations-library
// next to this repo), overridable via HCM_LIB_CASES. CI clones the library
// shallow to satisfy this.
const LIB_CASES = process.env.HCM_LIB_CASES
  || join(here, '..', '..', '..', 'transportations-library', 'tests', 'ExampleCases', 'hcm');

let wasm = null;
export async function loadWasm() {
  if (!wasm) {
    wasm = await import(join(pkgDir, 'HCM_middleware.js'));
    await wasm.default(readFileSync(join(pkgDir, 'HCM_middleware_bg.wasm')));
  }
  return wasm;
}

export function loadCase(chapterDir, name) {
  return JSON.parse(readFileSync(join(LIB_CASES, chapterDir, name)));
}

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
