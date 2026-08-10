# Chapter validation status

Boundary validation runs the published HCM example problems through the built WASM package (`tests/boundary/`, `node tests/boundary/<file>.mjs`), asserting the same expected values and tolerances as the Rust core tests in `transportations-library/tests/`. Core = Rust integration tests against the book. Boundary = the same numbers reproduced through the JS constructor path the calculator uses. A chapter leaves beta when it passes both layers and Rei has inspected it.

Inspection workflow: go chapter by chapter, read the test file, spot-check the expected values against the cited HCM example problem, run the file, then mark the sign-off line. Decision items collect anything that needs a judgment call rather than a code fix.

| Ch | Method | Core EPs | Boundary checks | Status | Sign-off |
|----|--------|----------|----------------|--------|----------|
| 10 | Freeway Facilities | Ch.25 EP1, EP2, EP6 | 421 | pass | |
| 11 | Freeway Reliability | Ch.25 EP7 | 27 (some getters unbound) | pass | |
| 12 | Basic Freeway Segments | Ch.26 EP1-3 | 15 (some getters unbound) | pass (after f_HV fix) | |
| 12 | Managed Lanes | Ch.26 EP7 | 51 | pass | |
| 13 | Weaving Segments | Ch.27 EP1-3 | 42 (11 gated on unbound getters) | pass | |
| 14 | Merge and Diverge | Ch.28 EP1-4 | 51 | pass | |
| 15 | Two-Lane Highways | 4 fixture cases | 160 | pass | |
| 16 | Urban Street Facilities | Ch.29 §5 EP1 EB+WB | 55 | pass | |
| 17 | Urban Street Reliability | Ch.29 §5 EP4 + EP5 Strategy 1, Ch.37 §5 ASC | 37 | pass | |
| 18 | Urban Street Segments | Ch.30 §8 EP1 (all three AP-delay paths) | 72 | pass | |
| 19 | Signalized Intersections | Ch.31 §10 EP1 + Exhibit 31-7 | 155 | pass | |
| 20 | TWSC | Ch.32 EP1, EP3 | 23 (13 gated on unbound override) | pass | |
| 21 | AWSC | Ch.32 EP1-2 | 34 | pass | |
| 22 | Roundabouts | Ch.33 EP1-2 | 55 | pass | |
| 23 | Ramp Terminals | Ch.34 EP1, EP5, EP13, EP14, EP15, EP16 | 227 | pass | |
| 24 | Off-Street Ped/Bike | Ch.35 EP1-2 | 15 | pass | |

## Findings from the boundary pass

**Chapter 12 f_HV defect (fixed in `wasm_basicfreeways.rs`).** The binding never set `sut_percentage`, the core defaults it to 50, which routes the heavy-vehicle adjustment through the sparse mixed-flow SUT table and silently degrades f_HV to 1/(1 - p_t) off the table grid. Densities and LOS were wrong for freight scenarios (EP1 published LOS C, page showed B). The binding now defaults `sut_percentage = 0` (terrain-based Exhibit 12-25 E_T, the convention of the published EPs and the Rust tests) and exposes `sut_percentage` and `e_t` as trailing optional constructor args for mixed-flow analysis.

## Decision items for Rei

1. RESOLVED (verified 2026-08-08 against a fresh maturin build, 151 pytest green): the fix landed in the core during the pre-0.3.0 API work, so both bindings share it — `sut_percentage` defaults to 0 (general-terrain Exhibit 12-25) and PyO3 exposes the parameter and `e_t()` like WASM.
2. RESOLVED with item 1: the silent off-grid fallback no longer exists. An off-grid SUT mix (say 40%) raises an error naming Exhibits 12-26 through 12-28 instead of degrading to 1/(1 - p_t).
3. The reliability binding hard-codes jam density, queue-discharge drop, TRD, and interchange density to their defaults when building its internal facility, so the EP7 fixture's interchange density of 0.8 is inexpressible (weaving speeds shift in every scenario). A small constructor extension would close this.
4. Promotion order out of beta once you have inspected each chapter.

## Full-suite status

All sixteen test files pass, 1,401 checks executed against middleware 0.3.3 (`npm run test:boundary`). Every row's count is the executed count measured from that run. The total counts only checks the harness actually ran: files whose wanted getters have no middleware wrapper yet skip those checks and print a NOTE saying so, and skips are not counted.

Chapters 25 EPs beyond 1, 2, 5, 6, 7 (work zones, strategy assessment) have no fixture or Rust coverage at any layer.

## Known out-of-scope at the boundary (core-tested only, no WASM path)

- Ch.12: `estimate_number_of_lanes` design step (Ch.26 EP2's 3-lane answer is core-only).
- Ch.15: BicycleLOS.
- Ch.19: actuated timing estimation and RTOR volume estimation.
- Ch.23: closed by middleware 0.3.2. `WasmAlternativeIntersection` plus the EDTT/offset helper functions cover the RCUT (EP13), MUT (EP15), and DLT offset (EP16) paths, and the boundary suite runs them (200 checks). Still core-only: EP 12 (RCUT with merges) as a full worked journey, though `edtt_merge` is bound; EP14 (RCUT with signals) landed at the boundary 2026-08-09.
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
