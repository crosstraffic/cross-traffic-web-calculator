# Chapter validation status

Boundary validation runs the published HCM example problems through the built WASM package (`tests/boundary/`, `node tests/boundary/<file>.mjs`), asserting the same expected values and tolerances as the Rust core tests in `transportations-library/tests/`. Core = Rust integration tests against the book. Boundary = the same numbers reproduced through the JS constructor path the calculator uses. A chapter leaves beta when it passes both layers and Rei has inspected it.

Inspection workflow: go chapter by chapter, read the test file, spot-check the expected values against the cited HCM example problem, run the file, then mark the sign-off line. Decision items collect anything that needs a judgment call rather than a code fix.

| Ch | Method | Core EPs | Boundary checks | Status | Sign-off |
|----|--------|----------|----------------|--------|----------|
| 10 | Freeway Facilities | Ch.25 EP1, EP2, EP6 | 618 | pass | |
| 11 | Freeway Reliability | Ch.25 EP7 | 61 | pass | |
| 12 | Basic Freeway Segments | Ch.26 EP1-3 | 18 | pass (after f_HV fix) | |
| 12 | Managed Lanes | Ch.26 EP7 | 51 | pass | |
| 13 | Weaving Segments | Ch.27 EP1-3 | 53 | pass | |
| 14 | Merge and Diverge | Ch.28 EP1-4 | 51 | pass | |
| 15 | Two-Lane Highways | 4 fixture cases | 160 | pass | |
| 16 | Urban Street Facilities | Ch.29 §5 EP1 EB+WB | 55 | pass | |
| 17 | Urban Street Reliability | Ch.29 §5 EP4 + EP5 Strategy 1, Ch.37 §5 ASC | 37 | pass | |
| 18 | Urban Street Segments | Ch.30 §8 EP1 (all three AP-delay paths) | 72 | pass | |
| 19 | Signalized Intersections | Ch.31 §10 EP1 + Exhibit 31-7 | 155 | pass | |
| 20 | TWSC | Ch.32 EP1, EP3 | 36 | pass | |
| 21 | AWSC | Ch.32 EP1-2 | 34 | pass | |
| 22 | Roundabouts | Ch.33 EP1-2 | 55 | pass | |
| 23 | Ramp Terminals | Ch.34 EP1, EP5, EP12, EP13, EP14, EP15, EP16 | 257 | pass | |
| 24 | Off-Street Ped/Bike | Ch.35 EP1-2 | 15 | pass | |

## Findings from the boundary pass

**Chapter 12 f_HV defect (fixed in `wasm_basicfreeways.rs`).** The binding never set `sut_percentage`, the core defaults it to 50, which routes the heavy-vehicle adjustment through the sparse mixed-flow SUT table and silently degrades f_HV to 1/(1 - p_t) off the table grid. Densities and LOS were wrong for freight scenarios (EP1 published LOS C, page showed B). The binding now defaults `sut_percentage = 0` (terrain-based Exhibit 12-25 E_T, the convention of the published EPs and the Rust tests) and exposes `sut_percentage` and `e_t` as trailing optional constructor args for mixed-flow analysis.

**Middleware 0.3.5 / library 0.3.1 landed three HCM-text corrections (2026-08-10).** Two of them move numbers this calculator prints, and both moves are away from a published value that the library adjudicated as a book defect, so they are recorded here rather than in a test comment alone.

1. *Interchange-level LOS comes from the demand-weighted ETT alone.* Chapter 23 Step 9 no longer propagates the per-O-D v/c and R_Q flags into the aggregate letter. Exhibit 23-10's "automatically LOS F" rule is a per-O-D rule and the per-O-D behavior is unchanged. Nothing in the boundary suite or the pages asserted a flag-forced aggregate, so no expectation moved for this one.
2. *Incremental delay d2 uses the Step 7 lane group capacity, not the per-lane capacity*, per the Equation 19-26 variable list. This is the one that moves printed numbers. Chapter 34 Example Problem 1 is the single worked example whose published d2 reproduces only per-lane, so its worksheet is treated as a book defect outvoted by the equation text and by Example Problems 3 and 5. The hcm23 page's default (EP1) interchange ETT prints 50.4 s/veh where it printed 52.4 and where Exhibit 34-16 publishes 52.4, with LOS C unchanged and every O-D letter still matching the published one. The DDI form (EP5) prints 29.8 s/veh and LOS B where it printed 34.8 and C, against a published 34.9 and C. The Exhibit 23-10 B/C boundary is 30 s/veh, so that aggregate now sits 0.2 s/veh on the far side of a band edge. It is carried by the westbound O-Ds, whose Exhibit 34-64 movement delays the library already documents as not reproducible from the printed equations, and the same correction is what makes EP5's O-D E reproduce its published 24.7 s/veh and LOS B exactly.
3. *Two-lane facility follower density aggregates the adjusted segment densities* (Equation 15-39), centralized in `TwoLaneHighways::determine_facility_follower_density`. **This one has not reached the calculator.** The aggregator is not bound in middleware 0.3.5, so both the hcm15 page and the ch15 boundary suite still reweight the per-segment column in JS, using fd_mid for passing lanes but the raw fd everywhere else. That discards the Step 9 downstream passing-lane benefit. Measured against the four fixtures, case1, case2 and case4 agree, and case3 (Chapter 26 Example Problem 3) does not: the JS aggregation gives 8.041 followers/mi and LOS D where Equation 15-39 gives 7.271 and LOS C and where Exhibit 26-27 publishes 7.3 and LOS C. case4 (Example Problem 4) differs numerically as well, 20.219 against 19.897 with the published 20.0, but stays inside the LOS E band and so shows no letter change and breaks no assertion. No ch15 expectation was changed here, because the right fix is to bind the aggregator in the middleware and call it from the page rather than reweighting the column in JS a third time, which is exactly the duplication the library centralized to stop. Tracked as decision item 5.

## Decision items for Rei

1. RESOLVED (verified 2026-08-08 against a fresh maturin build, 151 pytest green): the fix landed in the core during the pre-0.3.0 API work, so both bindings share it — `sut_percentage` defaults to 0 (general-terrain Exhibit 12-25) and PyO3 exposes the parameter and `e_t()` like WASM.
2. RESOLVED with item 1: the silent off-grid fallback no longer exists. An off-grid SUT mix (say 40%) raises an error naming Exhibits 12-26 through 12-28 instead of degrading to 1/(1 - p_t).
3. The reliability binding hard-codes jam density, queue-discharge drop, TRD, and interchange density to their defaults when building its internal facility, so the EP7 fixture's interchange density of 0.8 is inexpressible (weaving speeds shift in every scenario). A small constructor extension would close this.
4. Promotion order out of beta once you have inspected each chapter.
5. Chapter 15 facility follower density is aggregated in JS by the page and by the boundary suite, and it omits the Equation 15-39 adjusted column (finding 3 above). Binding `determine_facility_follower_density` in `crosstraffic_middleware` and calling it from `src/routes/hcm15/+page.svelte` would move the printed facility LOS for a case3-shaped facility from D to C, matching Exhibit 26-27. That is a middleware release plus a page change, so it is left for you rather than folded into the 0.3.5 bump.

## Full-suite status

All sixteen test files pass, 1,728 checks executed against middleware 0.3.5 / transportations_library 0.3.1 (`npm run test:boundary`). Every row's count is the executed count measured from that run. The total counts only checks the harness actually ran: files whose wanted getters have no middleware wrapper yet skip those checks and print a NOTE saying so, and skips are not counted. As of 0.3.5 no file prints a NOTE or SKIP line, so the executed count and the written count are the same everywhere for the first time.

Chapters 25 EPs beyond 1, 2, 5, 6, 7 (work zones, strategy assessment) have no fixture or Rust coverage at any layer.

## Known out-of-scope at the boundary (core-tested only, no WASM path)

- Ch.12: `estimate_number_of_lanes` design step (Ch.26 EP2's 3-lane answer is core-only).
- Ch.15: BicycleLOS.
- Ch.19: actuated timing estimation and RTOR volume estimation.
- Ch.23: closed by middleware 0.3.2. `WasmAlternativeIntersection` plus the EDTT/offset helper functions cover the RCUT (EP13), MUT (EP15), and DLT offset (EP16) paths, and the boundary suite runs them (100 of the chapter's 257 checks, the other 157 being the Part B interchanges; the "200 checks" recorded here previously did not match any measured subtotal). EP14 (RCUT with signals) landed at the boundary 2026-08-09 and EP12 (RCUT with merges) now runs as a full worked journey, its per-movement results taken from the EP12 prose because the chapter publishes them there rather than in a table. Still core-only: nothing.
- Ch.10: managed-lane facilities (ml_case1 fixture inexpressible through the binding).
- Ch.18: closed by middleware 0.3.3. All three Equation 18-7 access-point delay sources are now reachable (the `access_point_delays_s` published-input hook, the computed Chapter 30 §4 procedure via `add_access_point`, and the Exhibit 18-13 planning path with the fixture's own turn percentages), as are the Step 2 intermediates S_0, f_CS, f_A, f_pk, f_L, and f_v. EP1's published running time (33.54 s) and travel speed (23.67 mi/h) now reproduce at the boundary. The pre-0.3.3 forced-planning default path is retained as a labeled regression anchor so existing 28-argument callers cannot shift silently. Still core-only: nothing.
- Ch.16: closed by middleware 0.3.3. `add_segment_summary` + `aggregate()` express the Exhibit 16-7 "HCM method output" path, so Ch.29 EP1 EB and WB now run at the boundary (facility base FFS 40.1, LOS C, poorest-segment LOS D all exact), and the sixteen new `add_segment` arguments make the full Ch.30 EP1 geometry expressible (facility base FFS 40.78 and travel speed 23.67, previously unreachable). `analyze()` refusing to run on a summary-built facility is asserted, not just documented. Remaining deviation, not a binding gap: EP1's published facility travel speeds (22.6 EB / 22.2 WB) do not reproduce because the fixtures copy Segments 1 and 5 into the unpublished Segments 2-4, giving 22.1 / 21.5. The fixtures say so in their own `_source` notes and the Rust core tests carry the same gap.
- Ch.17: largely closed by middleware 0.3.3. Monthly snowfall, `jan1_day_of_week`, facility `prop_left_turn_lanes`, boundary-signal k/I/approach lanes, `add_atdm_strategy`, and `num_oversaturated_scenarios` are all expressible, so the boundary now reproduces the Rust test's computed point values rather than only landing inside its bands (mean TTI 1.5449, TTI-80 1.5927, PTI 1.7462, reliability rating 98.83, oversaturated scenarios 70 exact), and Ch.29 EP5 Strategy 1 plus the Ch.37 §5 adaptive signal control strategy are both evaluated. The pre-0.3.3 call shape is retained as a labeled regression anchor under the old wide bands. Still core-only: per-scenario results, which the boundary exposes only through summary getters plus the oversaturated count, so a Rust-style filter over `scenario_results` has no equivalent here. `AtdmStrategy` also reaches the binding through its serde form only, so `AtdmStrategy::adaptive_signal_control` is expressed as the `sat_flow_adjustment` value it computes (1 / (1 - 0.135) = 1.15607) rather than called by name.

## Coverage gaps (no fixture or Rust test at any layer)

- Ch.26 later EPs (multilane-highway LOS, service volumes, mixed-flow applications).
- Ch.27 and Ch.28 later EPs (design and service-volume applications).
- Ch.31 §10 EPs 2+ (pedestrian and bicycle modes at signals).
- Ch.32 TWSC EP2 (pedestrian crossing).
- Ch.34 EPs 2-4, 6-11, 17.
- Ch.15: which published two-lane EPs the four fixtures correspond to is undocumented in the Rust tests.
