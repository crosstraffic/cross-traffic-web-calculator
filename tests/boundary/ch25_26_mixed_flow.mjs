// The HCM mixed-flow model through the WASM boundary: Chapter 26 Example
// Problem 5's mixed-flow half on a single grade, and Chapter 25 Example
// Problem 11 on a composite grade. Expected values and tolerances mirror
// transportations-library/tests/chapter12_integration.rs and
// tests/chapter25_composite_grade_integration.rs.
//
// This is a separate file from ch12 on purpose. Example Problem 5 is one
// segment analysed twice, once by the Chapter 12 passenger-car-equivalent
// method that ch12_basicfreeways.mjs covers and once by this model, and the
// example exists to show that the two disagree: 25.2 veh/mi/ln from the PCE
// path against 31.7 here. Filing the mixed-flow checks under ch12 would put
// two answers for the same segment in one place with nothing marking which
// method produced which.
//
// Three of the published numbers below are not the ones printed in the book.
// Each is a case where the example contradicts itself and the self-consistent
// value is asserted, with the reasoning at the check. They are flagged rather
// than quietly corrected because a future reader comparing this file against
// the PDF will otherwise think the suite is wrong.
//
// Units in these config objects are the manual's and mix conventions within a
// single object: length in MILES, grade in PERCENT, truck shares as DECIMALS.
import { loadWasm, loadCase, approx, exact, report } from './_harness.mjs';

const m = await loadWasm();

// --- HCM Ch.26 Example Problem 5, mixed-flow half: a 2-mi 5% upgrade on a
// six-lane freeway, FFS 65 mi/h, 1,500 veh/h/ln, 5% SUTs and 10% TTs.
const ep5 = loadCase('Chapter26', 'ep5_mixed_flow.json');
const mf = new m.WasmMixedFlow(ep5);
const r5 = mf.results_to_js_value();

// Step 2, capacity. Equations 26-1 through 26-5.
approx(r5.caf_t_mix, 0.135, 0.001, 'EP5 CAF_T,mix (Eq. 26-2)');
approx(r5.rho_g_mix, 0.1215, 1e-9, 'EP5 rho_g,mix (Eq. 26-4)');
approx(r5.caf_g_mix, 0.131, 0.001, 'EP5 CAF_g,mix (Eq. 26-3)');
approx(r5.caf_mix, 0.734, 0.001, 'EP5 CAF_mix (Eq. 26-1)');
approx(r5.capacity_ao, 2350.0, 1e-9, 'EP5 C_ao (pc/h/ln), Exhibit 12-6');
// The example carries CAF_mix rounded to three decimals into Equation 26-5,
// which is where the last veh/h/ln goes: 2,350 x 0.734 = 1,724.9 against
// 1,726.2 unrounded.
approx(r5.capacity_mix, 1725.0, 2.0, 'EP5 C_mix (veh/h/ln), Eq. 26-5');
exact(r5.oversaturated, false, 'EP5 1,500 veh/h/ln is below C_mix');

// Step 3, mixed-flow free-flow speed. Equations 26-11 through 26-14.
approx(r5.tau_sut_kin, 71.1, 0.5, 'EP5 tau_SUT,kin (s/mi), Eq. 26-12');
approx(r5.tau_tt_kin, 92.2, 0.5, 'EP5 tau_TT,kin (s/mi), Eq. 26-12');
approx(r5.tau_a_ffs, 55.4, 0.1, 'EP5 tau_a at free flow (s/mi), Eq. 26-8');
approx(r5.tau_mix_ffs, 59.87, 0.1, 'EP5 tau_mix at free flow (s/mi), Eq. 26-13');
approx(r5.ffs_mix, 60.1, 0.1, 'EP5 FFS_mix (mi/h), Eq. 26-14');
approx(r5.saf_mix, 0.92, 0.01, 'EP5 SAF_mix (Eq. 26-15)');

// Step 4, breakpoint. Equation 26-16 is implemented as printed,
// max[0, e^(30g) + 1], and the + 1 is almost certainly a typo for - 1: with
// it the inner max can never bind and level ground gets a term of 2. The
// printed form is kept because it is load-bearing, driving BP_mix to zero
// here, which the example then rationalises in words rather than treating as
// an error, and which feeds Equations 26-20 and 26-21.
approx(r5.bp_ao, 1400.0, 1e-9, 'EP5 BP_ao (veh/h/ln), Exhibit 12-6');
approx(r5.bp_mix, 0.0, 1e-9, 'EP5 BP_mix (veh/h/ln), Eq. 26-16 as printed');

// Steps 5 through 8, speed and density.
approx(r5.s_calib_cap, 37.5, 0.3, 'EP5 S_calib at capacity (mi/h), Eq. 26-19');
approx(r5.s_calib_90cap, 44.3, 0.3, 'EP5 S_calib at 90% capacity (mi/h), Eq. 26-19');
approx(r5.phi_mix, 4.07, 0.1, 'EP5 phi_mix (Eq. 26-20)');
approx(r5.s_mix, 47.3, 0.3, 'EP5 S_mix (mi/h), Eq. 26-21');
// BOOK DEFECT. Step 8 computes 31.7 veh/mi/ln from its own S_mix, and the
// comparison paragraph a few lines later quotes 32.6. No step produces 32.6;
// it would need a mixed-flow speed of 46.0 mi/h, which nothing in the example
// computes. 31.7 is asserted.
approx(
  r5.d_mix,
  31.7,
  0.3,
  'EP5 D_mix (veh/mi/ln), Eq. 26-22 (Step 8 value, not the 32.6 of the comparison paragraph)',
);

// The headline getters must agree with the result object rather than being a
// second code path that can drift from it.
approx(mf.get_capacity_mix(), r5.capacity_mix, 1e-9, 'EP5 get_capacity_mix agrees with the result object');
approx(mf.get_density(), r5.d_mix, 1e-9, 'EP5 get_density agrees with the result object');

// Above mixed-flow capacity Chapter 26 Step 2 stops at LOS F rather than
// reporting a speed, and the binding must pass that absence through rather
// than as a zero a page would render as a number. Note the shape a consumer
// gets: serde-wasm-bindgen crosses a Rust None as `undefined`, not as `null`,
// so a page testing `s_mix === null` before rendering would print the
// oversaturated case as a speed.
const over = new m.WasmMixedFlow({ ...ep5, v_mix: 2000.0 }).results_to_js_value();
exact(over.oversaturated, true, 'EP5 at 2,000 veh/h/ln is oversaturated');
exact(typeof over.s_mix, 'undefined', 'EP5 oversaturated S_mix is absent, not a speed');
exact(typeof over.d_mix, 'undefined', 'EP5 oversaturated D_mix is absent, not a density');
exact(
  Object.prototype.hasOwnProperty.call(over, 'oversaturated'),
  true,
  'oversaturated flag is present alongside the absent measures',
);

// --- HCM Ch.25 Example Problem 11: three grades in the order a vehicle meets
// them (1.5 mi at 3%, 2.0 mi at 2%, 1.0 mi at 5%), same six-lane freeway,
// FFS 65 mi/h, 1,500 veh/h/ln, 5% SUTs and 10% TTs.
const ep11 = loadCase('Chapter25', 'ep11_composite_grade.json');
const cg = new m.WasmCompositeGrade(ep11);
const r11 = cg.results_to_js_value();

exact(cg.get_segment_count(), 3, 'EP11 segment count as deserialized');

// Step 2, capacity per segment, governed by the tightest.
const wantCafG = [0.067, 0.042, 0.122];
const wantCaf = [0.798, 0.823, 0.743];
const wantCap = [1875.0, 1934.0, 1746.0];
r11.segments.forEach((s, i) => {
  approx(s.caf_g_mix, wantCafG[i], 0.001, `EP11 segment ${i + 1} CAF_g,mix (Eq. 25-55)`);
  approx(s.caf_mix, wantCaf[i], 0.001, `EP11 segment ${i + 1} CAF_mix (Eq. 25-53)`);
  approx(s.capacity_mix, wantCap[i], 2.0, `EP11 segment ${i + 1} C_mix (veh/h/ln), Eq. 25-57`);
});
exact(r11.governing_segment, 2, 'EP11 the 1 mi 5% grade governs capacity (index 2)');
approx(r11.capacity_mix, 1746.0, 2.0, 'EP11 governing C_mix (veh/h/ln)');
exact(r11.oversaturated, false, 'EP11 1,500 veh/h/ln is below the governing C_mix');
approx(cg.get_capacity_mix(), r11.capacity_mix, 1e-9, 'EP11 get_capacity_mix agrees with the result object');

// Steps 3 through 6, per segment.
const wantSpeed = [57.7, 58.7, 47.9];
const wantTime = [93.6, 122.7, 75.2];
r11.segments.forEach((s, i) => {
  approx(s.s_mix, wantSpeed[i], 0.3, `EP11 segment ${i + 1} S_mix (mi/h)`);
  approx(s.travel_time, wantTime[i], 0.7, `EP11 segment ${i + 1} t_mix (s)`);
});

// BOOK DEFECT. Segment 2 Step 6 prints
// tau_mix,2 = 0.85 x 61.4 + 0.05 x 62.01 + 0.10 x 73.51 = 62.6 s/mi and then
// divides 3,600 by 61.3 on the very next line. The three rates that line
// substitutes match nothing Step 5 produced; Step 5's own rates give 61.33,
// which is the value the next line uses and which the published segment
// travel time and Exhibits 25-110 and 25-111 all agree with. 61.3 is
// asserted.
approx(r11.segments[1].tau_mix, 61.3, 0.2, 'EP11 tau_mix,2 (s/mi) (Step 5 rates, not the 62.6 printed in Step 6)');
approx(r11.segments[1].s_mix, 58.7, 0.2, 'EP11 S_mix,2 (mi/h)');

// Step 7. BOOK DEFECT: the prose says the three segment travel times "equal
// 294 s". They sum to 291.5, and it is 291.5 that Equation 25-70 divides
// into to reach the published 55.6 mi/h; 294 would give 55.1.
approx(r11.total_length, 4.5, 1e-9, 'EP11 total length (mi)');
approx(r11.total_travel_time, 291.5, 1.5, 'EP11 summed segment travel times (s) (not the 294 of the Step 7 prose)');
approx(r11.s_mix_overall, 55.6, 0.3, 'EP11 S_mix,oa (mi/h), Eq. 25-70');
approx(cg.get_overall_speed(), r11.s_mix_overall, 1e-9, 'EP11 get_overall_speed agrees with the result object');

// Exhibit 25-110, space mean speeds by segment for autos, SUTs and TTs.
const wantSpace = [
  [58.7, 57.0, 50.6],
  [59.5, 60.9, 51.8],
  [49.9, 46.6, 36.3],
];
const classes = ['autos', 'SUTs', 'TTs'];
r11.segments.forEach((s, i) => {
  classes.forEach((name, k) => {
    approx(
      s.space_speeds[k],
      wantSpace[i][k],
      0.5,
      `EP11 segment ${i + 1} ${name} space mean speed (mi/h), Exhibit 25-110`,
    );
  });
});

// Exhibit 25-111, overall space mean speeds by class.
[56.8, 55.8, 47.0].forEach((want, k) => {
  approx(r11.overall_space_speeds[k], want, 0.4, `EP11 overall ${classes[k]} space mean speed (mi/h), Exhibit 25-111`);
});

// Exhibit 25-109, spot speeds at the facility entry and at the end of each
// segment. BOOK DEFECT in one row: the end-of-Segment-1 row is published as
// 59.5 / 56.1 / 56.4, and the rates Step 5 prints for that node (63.8, 64.15
// and 78.15 s/mi) are 56.4, 56.1 and 46.1 mi/h. The SUT value is right, the
// number labelled TTs is the automobile speed, and the number labelled autos
// is the entry speed duplicated from the row above. The other three rows
// verify as printed, which is why this reads as a transcription slip rather
// than a modelling difference.
classes.forEach((name, k) => {
  approx(r11.entry_spot_speeds[k], 59.5, 0.3, `EP11 facility entry ${name} spot speed (mi/h), Exhibit 25-109`);
});
const wantSpot = [
  [56.4, 56.1, 46.1], // corrected; the exhibit prints 59.5 / 56.1 / 56.4
  [60.9, 60.9, 54.0],
  [45.2, 42.2, 31.8],
];
r11.segments.forEach((s, i) => {
  classes.forEach((name, k) => {
    approx(
      s.spot_speeds[k],
      wantSpot[i][k],
      1.0,
      `EP11 end of segment ${i + 1} ${name} spot speed (mi/h), Exhibit 25-109${i === 0 ? ' (corrected row)' : ''}`,
    );
  });
});

// Chaining is the whole reason Chapter 25 exists as a separate procedure from
// Chapter 26, and it is invisible in the published numbers: without it every
// segment would restart at free-flow speed and the facility would come out
// optimistic everywhere, with nothing failing. Segment 2 is entered by trucks
// already slowed by the 3% grade above it, which is what makes the example
// read its Segment 2 curves off the 60 and 50 mi/h exhibits rather than the
// 65 mi/h ones.
approx(3600.0 / r11.segments[0].tau_f_sut_kin, 60.9, 1.0, 'EP11 SUT speed entering segment 2 (mi/h)');
approx(3600.0 / r11.segments[0].tau_f_tt_kin, 49.5, 1.0, 'EP11 TT speed entering segment 2 (mi/h)');
exact(r11.segments[1].decelerating, false, 'EP11 segment 2 is where the trucks recover');
exact(r11.segments[2].decelerating, true, 'EP11 segment 3 slows them again');

const standalone = new m.WasmCompositeGrade({ ...ep11, segments: [ep11.segments[1]] }).results_to_js_value();
const chainedS2 = r11.segments[1].s_mix;
const aloneS2 = standalone.segments[0].s_mix;
exact(
  chainedS2 < aloneS2 - 0.5,
  true,
  `EP11 the 2% grade is slower when entered with trucks already slowed: chained ${chainedS2.toFixed(2)} vs standalone ${aloneS2.toFixed(2)} mi/h`,
);

// --- Domain refusals. The truck-performance curves are published as figures
// with no closed form anywhere in either chapter, so they are digitised from
// the exhibit rasters, and only for the grades and speeds the two worked
// examples need. Anything else must refuse by name rather than extrapolate,
// because each grade settles at its own crawl speed and an extrapolated curve
// would be quietly wrong rather than approximately right. What is checked
// here is that the refusal reaches JS as a throw carrying the exhibit name,
// which is what a calculator page would have to show a user.
let refusal = null;
try {
  new m.WasmMixedFlow({ ...ep5, ffs: 70.0 }).results_to_js_value();
} catch (e) {
  refusal = String(e);
}
exact(refusal !== null, true, 'EP5 at FFS 70 throws rather than extrapolating');
exact(
  String(refusal).includes('Chapter 26 Appendix A'),
  true,
  `refusal names the exhibit that would have to be digitised, got: ${refusal}`,
);
exact(String(refusal).includes('70 mi/h FFS'), true, 'refusal names the speed that is missing');

let refusal25 = null;
try {
  const bad = { ...ep11, segments: ep11.segments.map((s, i) => (i === 1 ? { ...s, grade: 7.0 } : s)) };
  new m.WasmCompositeGrade(bad).results_to_js_value();
} catch (e) {
  refusal25 = String(e);
}
exact(refusal25 !== null, true, 'EP11 with a 7% grade throws rather than extrapolating');
exact(
  String(refusal25).includes('Exhibit 25-20/25-21'),
  true,
  `composite refusal names the exhibit, got: ${refusal25}`,
);

// --- A misspelled optional key is rejected, not silently dropped. caf_ao is the
// one serde-defaulted field on either surface, so before library 0.3.5's
// deny_unknown_fields a typo'd key was discarded and the analysis ran
// unadjusted at 1.0 with no error.
let typo = null;
try {
  const { caf_ao: _caf_ao, ...rest } = ep5;
  new m.WasmMixedFlow({ ...rest, caf_a0: 0.85 });
} catch (e) {
  typo = String(e);
}
exact(typo !== null, true, 'a misspelled caf_ao key is rejected at construction');
exact(String(typo).includes('caf_a0'), true, `the rejection names the unknown key, got: ${typo}`);

report('ch25/26 mixed-flow model (HCM Ch.26 EP5 mixed-flow half, Ch.25 EP11)');
