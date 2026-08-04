# Chapter validation status

Boundary validation runs the published HCM example problems through the built WASM package (`tests/boundary/`, `node tests/boundary/<file>.mjs`), asserting the same expected values and tolerances as the Rust core tests in `transportations-library/tests/`. Core = Rust integration tests against the book. Boundary = the same numbers reproduced through the JS constructor path the calculator uses. A chapter leaves beta when it passes both layers and Rei has inspected it.

Inspection workflow: go chapter by chapter, read the test file, spot-check the expected values against the cited HCM example problem, run the file, then mark the sign-off line. Decision items collect anything that needs a judgment call rather than a code fix.

| Ch | Method | Core EPs | Boundary checks | Status | Sign-off |
|----|--------|----------|----------------|--------|----------|
| 10 | Freeway Facilities | Ch.25 EP1, EP2, EP6 | 618 | pass | |
| 11 | Freeway Reliability | Ch.25 EP7 | 61 | pass | |
| 12 | Basic Freeway Segments | Ch.26 EP1-3 | 18 | pass (after f_HV fix) | |
| 12 | Managed Lanes | none published in suite | 39 (exhibit anchors) | pass | |
| 13 | Weaving Segments | Ch.27 EP1-3 | 53 (11 gated on rebuild) | pass | |
| 14 | Merge and Diverge | Ch.28 EP1-4 | 51 | pass | |
| 15 | Two-Lane Highways | 4 fixture cases | 160 | pass | |
| 16 | Urban Street Facilities | Ch.29 EP1 (partial) | 22 | pass | |
| 17 | Urban Street Reliability | Ch.29 §5 EP4 | 22 | pass | |
| 18 | Urban Street Segments | Ch.30 §8 EP1 | 17 | pass | |
| 19 | Signalized Intersections | Ch.31 §10 EP1 + Exhibit 31-7 | 155 | pass | |
| 20 | TWSC | Ch.32 EP1, EP3 | 23 (13 gated on rebuild) | pass | |
| 21 | AWSC | Ch.32 EP1-2 | 34 | pass | |
| 22 | Roundabouts | Ch.33 EP1-2 | 55 | pass | |
| 23 | Ramp Terminals | Ch.34 EP1, EP5, EP16 | 159 | pass | |
| 24 | Off-Street Ped/Bike | Ch.35 EP1-2 | 15 | pass | |

## Findings from the boundary pass

**Chapter 12 f_HV defect (fixed in `wasm_basicfreeways.rs`).** The binding never set `sut_percentage`, the core defaults it to 50, which routes the heavy-vehicle adjustment through the sparse mixed-flow SUT table and silently degrades f_HV to 1/(1 - p_t) off the table grid. Densities and LOS were wrong for freight scenarios (EP1 published LOS C, page showed B). The binding now defaults `sut_percentage = 0` (terrain-based Exhibit 12-25 E_T, the convention of the published EPs and the Rust tests) and exposes `sut_percentage` and `e_t` as trailing optional constructor args for mixed-flow analysis.

## Decision items for Rei

1. The PyO3 binding has the same `sut_percentage` gap (no parameter, core default 50), so the MCP Chapter 12 tools inherit the off-grid f_HV behavior. Corridor B used on-grid points so paper numbers are unaffected. Should PyO3 adopt the same book-default as the WASM binding? Touching it affects experiment-adjacent code, so this stays with you.
2. Whether the core's off-grid fallback (e_t = None → f_HV = 1/(1 - p_t)) should instead fall back to the terrain E_T, which would fix the failure mode for every consumer at once.
3. The reliability binding hard-codes jam density, queue-discharge drop, TRD, and interchange density to their defaults when building its internal facility, so the EP7 fixture's interchange density of 0.8 is inexpressible (weaving speeds shift in every scenario). A small constructor extension would close this.
4. Promotion order out of beta once you have inspected each chapter.

## Full-suite status

All sixteen test files pass, 1,515 checks total (run `for f in tests/boundary/ch*.mjs; do node "$f"; done`). Chapters 25 EPs beyond 1, 2, 5, 6, 7 (work zones, strategy assessment) have no fixture or Rust coverage at any layer.

## Known out-of-scope at the boundary (core-tested only, no WASM path)

- Ch.12: `estimate_number_of_lanes` design step (Ch.26 EP2's 3-lane answer is core-only).
- Ch.15: BicycleLOS.
- Ch.19: actuated timing estimation and RTOR volume estimation.
- Ch.23: RCUT and MUT (AlternativeIntersection, Ch.34 EPs 12/13/15) and the DLT offset step.
- Ch.10: managed-lane facilities (ml_case1 fixture inexpressible through the binding).
- Ch.18: the access-point-delay hook and the planning-parameter path (the binding always takes Exhibit 18-13 with the 10 percent baseline, so EP1's published running time and travel speed are core-only; the boundary asserts the derived values instead, labeled non-published).
- Ch.16: no aggregate-from-published-segment-measures path and no FFS geometry args in add_segment, so Ch.29 EP1's published facility speeds are core-only.
- Ch.17: snowfall is hard-coded to zero and boundary-signal approach lanes to the two-lane fallback, so the fixture's exact weather stream and the oversaturated-scenario count are core-only; ATDM strategy evaluation (Ch.29 EP5, Ch.37) has no binding surface. Distribution bands, scenario count, determinism, and seed-replication behavior are boundary-verified.

## Coverage gaps (no fixture or Rust test at any layer)

- Ch.26 managed-lane example problem — the largest gap, zero EP coverage anywhere.
- Ch.26 later EPs (multilane-highway LOS, service volumes, mixed-flow applications).
- Ch.27 and Ch.28 later EPs (design and service-volume applications).
- Ch.31 §10 EPs 2+ (pedestrian and bicycle modes at signals).
- Ch.32 TWSC EP2 (pedestrian crossing).
- Ch.34 EPs 2-4, 6-11, 14, 17.
- Ch.15: which published two-lane EPs the four fixtures correspond to is undocumented in the Rust tests.
