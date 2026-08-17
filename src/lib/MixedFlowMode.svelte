<script>
  // HCM mixed-flow model, the alternative to the Chapter 12 passenger-car-equivalent path on
  // a segment whose grade or truck mix puts it outside the PCE tables. Two procedures share
  // this component because they share every input but the grade description: Chapter 26 for a
  // single sustained grade, Chapter 25 for a composite profile the vehicle traverses in order.
  //
  // Neither procedure assigns a level of service from its density. Chapter 26 Step 2 stops at
  // LOS F when demand exceeds mixed-flow capacity, and the Example Problem 5 discussion is
  // explicit that D_mix "is the mixed-flow density, not an auto-only flow density. As such, it
  // cannot be used to derive LOS." So this page prints an LOS letter only in the one case the
  // chapter names, and says why there is no letter otherwise, rather than reading D_mix
  // against the Exhibit 12-15 bands, which are pc/mi/ln and a different quantity.
  import { WasmMixedFlow, WasmCompositeGrade } from 'HCM-middleware';
  import GradeProfileStrip from '$lib/GradeProfileStrip.svelte';
  import LosBadge from '$lib/LosBadge.svelte';
  import Discussion from '$lib/Discussion.svelte';
  import { setReport } from '$lib/report';
  import { discussion, discussionComposite } from '$lib/MixedFlowMode.discussion.js';

  let { ready = false } = $props();

  // The truck performance curves are digitised from the published figures, and only for the
  // combinations the two worked examples need, so the engine refuses anything else by name
  // rather than extrapolating. These two lists are that digitised domain, measured by
  // sweeping the built package rather than transcribed: every (grade, FFS) pair outside them
  // throws, and every pair inside them returns an analysis.
  //
  // -5% shares a plotted line with 0% in every source exhibit, which is why a downgrade is
  // offered at all and why it is the only one.
  const GRADES = [-5, 0, 2, 3, 5];
  const FFS_VALUES = [65];

  let submode = $state('single');   // 'single' = Chapter 26 | 'composite' = Chapter 25

  // Shared traffic inputs. Truck shares are percents here and decimals at the boundary.
  let ffs = $state(65);
  let v_mix = $state(1500);
  let p_sut_pct = $state(5);
  let p_tt_pct = $state(10);
  let caf_ao = $state(1.0);

  // Single grade (Chapter 26).
  let length = $state(2.0);
  let grade = $state(5);

  // Composite profile (Chapter 25), in the order a vehicle meets the grades.
  let segments = $state([
    { length: 1.5, grade: 3 },
    { length: 2.0, grade: 2 },
    { length: 1.0, grade: 5 }
  ]);

  let results = $state(null);
  let hasError = $state(false);
  let errMessage = $state('');

  const fmt = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—');

  function baseConfig() {
    return {
      ffs: Number(ffs),
      v_mix: Number(v_mix),
      p_sut: Number(p_sut_pct) / 100.0,
      p_tt: Number(p_tt_pct) / 100.0,
      caf_ao: Number(caf_ao)
    };
  }

  function addSegment() {
    segments = [...segments, { length: 1.0, grade: 0 }];
  }

  function removeSegment(i) {
    if (segments.length > 1) segments = segments.filter((_, j) => j !== i);
  }

  // HCM Chapter 26, Example Problem 5, mixed-flow half: a 2-mi 5% upgrade on a six-lane
  // freeway at FFS 65, 1,500 veh/h/ln, 5% SUTs and 10% TTs. Same fixture the boundary suite
  // runs (transportations-library tests/ExampleCases/hcm/Chapter26/ep5_mixed_flow.json).
  function loadEp5() {
    submode = 'single';
    ffs = 65;
    v_mix = 1500;
    p_sut_pct = 5;
    p_tt_pct = 10;
    caf_ao = 1.0;
    length = 2.0;
    grade = 5;
    results = null;
    hasError = false;
  }

  // HCM Chapter 25, Example Problem 11: the same freeway and traffic over three grades in the
  // order a vehicle meets them. The order is an input, not a presentation detail — reversing
  // it slows the trucks onto curves that were never digitised and the analysis refuses.
  function loadEp11() {
    submode = 'composite';
    ffs = 65;
    v_mix = 1500;
    p_sut_pct = 5;
    p_tt_pct = 10;
    caf_ao = 1.0;
    segments = [
      { length: 1.5, grade: 3 },
      { length: 2.0, grade: 2 },
      { length: 1.0, grade: 5 }
    ];
    results = null;
    hasError = false;
  }

  function runAnalysis() {
    hasError = false;
    results = null;
    try {
      if (submode === 'single') {
        const r = new WasmMixedFlow({ ...baseConfig(), length: Number(length), grade: Number(grade) })
          .results_to_js_value();
        results = { kind: 'single', ...r };
        // Generated once, off the run that produced these numbers, and carried on the result so the
        // page and the printable report can never drift apart or restate a since-edited input.
        results.discussion = discussion(results, {
          grade: Number(grade),
          length: Number(length),
          vMix: Number(v_mix),
          pSutPct: Number(p_sut_pct),
          pTtPct: Number(p_tt_pct)
        });
      } else {
        const r = new WasmCompositeGrade({
          ...baseConfig(),
          segments: segments.map((s) => ({ length: Number(s.length), grade: Number(s.grade) }))
        }).results_to_js_value();
        results = { kind: 'composite', ...r };
        results.discussion = discussionComposite(results, {
          segments: segments.map((s) => ({ length: Number(s.length), grade: Number(s.grade) })),
          vMix: Number(v_mix)
        });
      }
      publishReport();
    } catch (err) {
      hasError = true;
      // The engine's refusals name the exhibit that would have to be digitised, which is the
      // only actionable thing a user can be told here, so the message is passed through.
      errMessage = String(err && err.message ? err.message : err);
    }
  }

  // s_mix and d_mix are ABSENT above mixed-flow capacity, and serde crosses a Rust None as
  // `undefined` rather than `null`, so a `=== null` guard here would never fire and the page
  // would print the oversaturated case as a speed. `== null` catches both.
  let hasSpeed = $derived(results && results.kind === 'single' && results.s_mix != null);
  let oversaturated = $derived(Boolean(results && results.oversaturated));

  function publishReport() {
    if (!results) return;
    const common = [
      { label: 'Procedure', value: submode === 'single' ? 'Single grade (HCM Ch. 26)' : 'Composite grade profile (HCM Ch. 25)' },
      { label: 'Free-flow speed, FFS', value: `${ffs} mi/h` },
      { label: 'Mixed-flow demand, v_mix', value: `${v_mix} veh/h/ln` },
      { label: 'Single-unit trucks', value: `${p_sut_pct} %` },
      { label: 'Tractor-trailers', value: `${p_tt_pct} %` },
      { label: 'Auto-only CAF', value: caf_ao }
    ];

    if (results.kind === 'single') {
      setReport({
        chapter: 'Basic Freeway Segments · Mixed flow, single grade',
        chapterRef: 'HCM Chapter 26',
        href: '/hcm12',
        generatedAt: new Date().toLocaleString(),
        headline: {
          label: 'Mixed-flow result',
          value: oversaturated ? 'LOS F' : `${fmt(results.s_mix)} mi/h`
        },
        discussion: results.discussion,
        inputs: [...common, { label: 'Grade', value: `${grade} %` }, { label: 'Grade length', value: `${length} mi` }],
        resultTable: {
          columns: ['Quantity', 'Value'],
          rows: [
            ['Capacity adjustment factor, CAF_mix', fmt(results.caf_mix, 3)],
            ['Mixed-flow capacity, C_mix', `${fmt(results.capacity_mix, 0)} veh/h/ln`],
            ['Mixed-flow free-flow speed, FFS_mix', `${fmt(results.ffs_mix)} mi/h`],
            ['Mixed-flow speed, S_mix', hasSpeed ? `${fmt(results.s_mix)} mi/h` : 'not reported (LOS F)'],
            ['Mixed-flow density, D_mix', hasSpeed ? `${fmt(results.d_mix)} veh/mi/ln` : 'not reported (LOS F)'],
            ['Level of service', oversaturated ? 'F' : 'not assigned by the method']
          ]
        },
        summary: [],
        methodology: [
          'Capacity: Equations 26-1 through 26-5, the truck and grade capacity adjustment factors applied to the Exhibit 12-6 auto-only capacity.',
          'Free-flow speed: Equations 26-6 through 26-14, mixing the automobile rate with kinematic truck travel-time rates read from the Chapter 26 Appendix A curves.',
          'Speed and density: Equations 26-16 through 26-22.',
          'HCM Chapter 26 assigns LOS F when v_mix exceeds C_mix and stops. It assigns no other letter, because D_mix is a mixed-flow density and the Exhibit 12-15 bands are auto-only densities.'
        ],
        diagram: {
          kind: 'grade-profile',
          props: { segments: [{ length: Number(length), grade: Number(grade) }], governing: 0 }
        }
      });
      return;
    }

    setReport({
      chapter: 'Basic Freeway Segments · Mixed flow, composite grade',
      chapterRef: 'HCM Chapter 25',
      href: '/hcm12',
      generatedAt: new Date().toLocaleString(),
      headline: {
        label: 'Overall mixed-flow speed',
        value: oversaturated ? 'LOS F' : `${fmt(results.s_mix_overall)} mi/h`
      },
      discussion: results.discussion,
      inputs: [
        ...common,
        { label: 'Grades, in order of travel', value: segments.map((s) => `${s.length} mi @ ${s.grade}%`).join(', ') }
      ],
      resultTable: {
        columns: ['Segment', 'Grade', 'Length (mi)', 'C_mix (veh/h/ln)', 'S_mix (mi/h)', 'Travel time (s)'],
        rows: results.segments.map((s, i) => [
          String(i + 1),
          `${segments[i]?.grade ?? '—'} %`,
          String(segments[i]?.length ?? '—'),
          fmt(s.capacity_mix, 0),
          fmt(s.s_mix),
          fmt(s.travel_time)
        ])
      },
      summary: [
        {
          label: `Governing capacity, C_mix (set by segment ${results.governing_segment + 1})`,
          value: `${fmt(results.capacity_mix, 0)} veh/h/ln`
        },
        {
          label: 'Overall mixed-flow speed, S_mix,oa (Equation 25-70)',
          value: `${fmt(results.s_mix_overall)} mi/h over ${fmt(results.total_length, 2)} mi in ${fmt(results.total_travel_time)} s`
        }
      ],
      methodology: [
        'Per-segment capacity: Equations 25-53 through 25-57, the facility capacity being the tightest of them.',
        'Chaining: each grade is entered at the speed the vehicle left the previous one with (Step 4), which is what separates this from analysing each grade alone.',
        'Overall speed: Equation 25-70, total length over summed segment travel times.',
        'HCM Chapter 25 assigns no LOS letter to a composite-grade result beyond flagging demand above the governing capacity.'
      ],
      diagram: {
        kind: 'grade-profile',
        props: {
          segments: segments.map((s) => ({ length: Number(s.length), grade: Number(s.grade) })),
          governing: results.governing_segment
        }
      }
    });
  }
</script>

{#if hasError}
  <div class="alert alert-error shadow-sm mb-6" data-testid="mf-error">
    <span>{errMessage}</span>
  </div>
{/if}

<form id="hcm12mf" onsubmit={(e) => { e.preventDefault(); runAnalysis(); }} inert={!ready}>
  <section class="panel">
    <div class="panel-head with-actions">
      <div>
        <h2 class="panel-title">Grade Description</h2>
        <p class="panel-sub">
          One sustained grade is a Chapter 26 analysis. A sequence of grades is a Chapter 25
          analysis, which carries each truck's speed from one grade into the next instead of
          restarting every grade at free-flow speed.
        </p>
      </div>
      <div class="panel-actions">
        <button class="btn btn-outline btn-sm" type="button" onclick={loadEp5}>Load Ch.26 EP5</button>
        <button class="btn btn-outline btn-sm" type="button" onclick={loadEp11}>Load Ch.25 EP11</button>
      </div>
    </div>
    <div class="param-grid">
      <div class="param-field">
        <label for="MFSUB_input">Grade Description</label>
        <select id="MFSUB_input" class="select select-bordered select-sm" bind:value={submode}>
          <option value="single">Single grade · Chapter 26</option>
          <option value="composite">Composite grade profile · Chapter 25</option>
        </select>
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">{submode === 'single' ? 'Grade' : 'Grade Profile'}</h2>
        <p class="panel-sub">
          {#if submode === 'single'}
            The sustained upgrade the segment carries. Grade is a fixed list because the truck
            performance curves are published as figures with no closed form, one per tabulated
            grade, and each grade settles at its own crawl speed, so a value between them
            cannot be interpolated.
          {:else}
            The grades in the order a vehicle meets them. Reordering changes the answer,
            because the speed a truck leaves one grade with is the speed it enters the next.
          {/if}
        </p>
      </div>
    </div>

    {#if submode === 'single'}
      <div class="param-grid">
        <div class="param-field">
          <label for="MFGRADE_input">Grade</label>
          <select id="MFGRADE_input" class="select select-bordered select-sm" bind:value={grade}>
            {#each GRADES as g}
              <option value={g}>{g} %</option>
            {/each}
          </select>
        </div>

        <div class="param-field">
          <label for="MFLEN_input">Grade Length</label>
          <div class="cell-field">
            <input id="MFLEN_input" type="number" step="0.1" min="0.1" class="input input-bordered input-sm" bind:value={length} required />
            <span class="unit">mi</span>
          </div>
          <p class="param-hint">Miles, not the feet a Chapter 15 subsegment takes. Past about 2 mi the trucks have reached crawl speed and the answer stops changing.</p>
        </div>
      </div>

      <!-- Same profile the composite mode draws, on a one-grade facility, so switching between
           the two procedures does not change what the segment looks like. -->
      <div class="diagram-block">
        <GradeProfileStrip segments={[{ length, grade }]} governing={-1} />
      </div>
    {:else}
      {#each segments as seg, i}
        <div class="param-grid" data-testid={`mf-seg-row-${i + 1}`}>
          <div class="param-field">
            <label for={`MFSEGG${i}_input`}>Grade {i + 1}</label>
            <select id={`MFSEGG${i}_input`} class="select select-bordered select-sm" bind:value={seg.grade}>
              {#each GRADES as g}
                <option value={g}>{g} %</option>
              {/each}
            </select>
          </div>
          <div class="param-field">
            <label for={`MFSEGL${i}_input`}>Length {i + 1}</label>
            <div class="cell-field">
              <input id={`MFSEGL${i}_input`} type="number" step="0.1" min="0.1" class="input input-bordered input-sm" bind:value={seg.length} required />
              <span class="unit">mi</span>
            </div>
          </div>
        </div>
        <div class="seg-action">
          <button type="button" class="btn btn-ghost btn-sm" onclick={() => removeSegment(i)} disabled={segments.length <= 1}>Remove grade {i + 1}</button>
        </div>
      {/each}

      <div class="seg-action">
        <button type="button" class="btn btn-outline btn-sm" onclick={addSegment}>Add a grade</button>
      </div>

      <div class="diagram-block">
        <GradeProfileStrip
          segments={segments}
          governing={results && results.kind === 'composite' ? results.governing_segment : -1}
        />
      </div>
    {/if}
  </section>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Traffic</h2>
        <p class="panel-sub">The mixed stream is described by its total flow rate and the share of each truck class, not converted to passenger cars. That is the whole point of the method.</p>
      </div>
    </div>
    <div class="param-grid">
      <div class="param-field">
        <label for="MFFFS_input">Free-Flow Speed</label>
        <select id="MFFFS_input" class="select select-bordered select-sm" bind:value={ffs}>
          {#each FFS_VALUES as f}
            <option value={f}>{f} mi/h</option>
          {/each}
        </select>
        <p class="param-hint">
          Only the 65 mi/h curves of the Chapter 25 and 26 appendices are digitised. Other
          free-flow speeds are refused rather than extrapolated, so they are not offered here.
        </p>
      </div>

      <div class="param-field">
        <label for="MFV_input">Mixed-Flow Demand, v<sub>mix</sub></label>
        <div class="cell-field">
          <input id="MFV_input" type="number" step="1" min="1" class="input input-bordered input-sm" bind:value={v_mix} required />
          <span class="unit">veh/h/ln</span>
        </div>
        <p class="param-hint">Vehicles, not passenger cars, and per lane.</p>
      </div>

      <div class="param-field">
        <label for="MFSUT_input">Single-Unit Trucks</label>
        <div class="cell-field">
          <input id="MFSUT_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={p_sut_pct} required />
          <span class="unit">%</span>
        </div>
      </div>

      <div class="param-field">
        <label for="MFTT_input">Tractor-Trailers</label>
        <div class="cell-field">
          <input id="MFTT_input" type="number" step="0.1" min="0" max="100" class="input input-bordered input-sm" bind:value={p_tt_pct} required />
          <span class="unit">%</span>
        </div>
        <p class="param-hint">The two truck shares are separate inputs because the two classes climb differently. Together they must stay below 100%.</p>
      </div>

      <div class="param-field">
        <label for="MFCAF_input">Auto-Only CAF</label>
        <div class="cell-field">
          <input id="MFCAF_input" type="number" step="0.01" min="0.1" max="1" class="input input-bordered input-sm" bind:value={caf_ao} required />
        </div>
        <p class="param-hint">Weather, incident, and work-zone adjustment applied before the mixed-flow factors. 1.00 is the no-adjustment case.</p>
      </div>
    </div>
  </section>

  <div class="action-bar">
    <button class="btn btn-ghost" onclick={submode === 'single' ? loadEp5 : loadEp11} type="button">Reset Params</button>
    <button class="btn btn-primary" type="submit" disabled={!ready}>Calculate</button>
  </div>
</form>

<section class="panel results-panel">
  <div class="panel-head with-actions">
    <div>
      <h2 class="panel-title">Outputs</h2>
      <p class="panel-sub">Results populate after pressing Calculate.</p>
    </div>
    {#if results}
      <div class="panel-actions">
        {#if oversaturated}
          <LosBadge los="F" size="lg" />
        {/if}
        <a class="btn btn-outline btn-sm" href="/report">Open printable report</a>
      </div>
    {/if}
  </div>

  {#if results && oversaturated}
    <div class="alert alert-warning shadow-sm mb-4" data-testid="mf-oversaturated">
      <span>
        LOS F — demand exceeds mixed-flow capacity; the method reports no speed.
        {#if results.kind === 'single'}
          v<sub>mix</sub> of {fmt(v_mix, 0)} veh/h/ln is above the C<sub>mix</sub> of {fmt(results.capacity_mix, 0)} veh/h/ln, and Chapter 26 Step 2 stops here. A facility analysis is recommended.
        {:else}
          v<sub>mix</sub> of {fmt(v_mix, 0)} veh/h/ln is above the governing C<sub>mix</sub> of {fmt(results.capacity_mix, 0)} veh/h/ln, set by segment {results.governing_segment + 1}. The per-segment speeds below are still computed by Chapter 25 but fall outside the range the method is calibrated for.
        {/if}
      </span>
    </div>
  {/if}

  {#if results && results.kind === 'single'}
    <div class="los overflow-x-auto">
      <table class="table w-full step-table">
        <thead>
          <tr><th>Step</th><th>Quantity</th><th class="num">Value</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="step-num">2</td>
            <th>Truck capacity adjustment, CAF<sub>T,mix</sub></th>
            <td class="num" data-testid="mf-caf-t">{fmt(results.caf_t_mix, 3)}</td>
          </tr>
          <tr>
            <td class="step-num"></td>
            <th>Grade capacity adjustment, CAF<sub>g,mix</sub></th>
            <td class="num" data-testid="mf-caf-g">{fmt(results.caf_g_mix, 3)}</td>
          </tr>
          <tr>
            <td class="step-num"></td>
            <th>Mixed-flow capacity adjustment, CAF<sub>mix</sub></th>
            <td class="num" data-testid="mf-caf-mix">{fmt(results.caf_mix, 3)}</td>
          </tr>
          <tr>
            <td class="step-num"></td>
            <th>Auto-only capacity, C<sub>ao</sub></th>
            <td class="num">{fmt(results.capacity_ao, 0)} pc/h/ln</td>
          </tr>
          <tr>
            <td class="step-num"></td>
            <th>Mixed-flow capacity, C<sub>mix</sub></th>
            <td class="num" data-testid="mf-capacity">{fmt(results.capacity_mix, 0)} veh/h/ln</td>
          </tr>
          <tr>
            <td class="step-num">3</td>
            <th>Mixed-flow free-flow speed, FFS<sub>mix</sub></th>
            <td class="num" data-testid="mf-ffs-mix">{fmt(results.ffs_mix)} mi/h</td>
          </tr>
          <tr>
            <td class="step-num"></td>
            <th>Speed adjustment factor, SAF<sub>mix</sub></th>
            <td class="num">{fmt(results.saf_mix, 3)}</td>
          </tr>
          <tr>
            <td class="step-num">7</td>
            <th>Mixed-flow speed, S<sub>mix</sub></th>
            <td class="num" data-testid="mf-speed">{hasSpeed ? `${fmt(results.s_mix)} mi/h` : 'no speed reported'}</td>
          </tr>
          <tr>
            <td class="step-num">8</td>
            <th>Mixed-flow density, D<sub>mix</sub></th>
            <td class="num" data-testid="mf-density">{hasSpeed ? `${fmt(results.d_mix)} veh/mi/ln` : 'no density reported'}</td>
          </tr>
          <tr class="step-los">
            <td class="step-num"></td>
            <th>Level of service</th>
            <td class="num" data-testid="mf-los">{oversaturated ? 'F' : 'not assigned'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  {/if}

  {#if results && results.kind === 'composite'}
    <div class="los overflow-x-auto">
      <table class="table w-full">
        <thead>
          <tr>
            <th>Grade</th>
            <th class="num">Slope</th>
            <th class="num">Length (mi)</th>
            <th class="num">C_mix (veh/h/ln)</th>
            <th class="num">S_mix (mi/h)</th>
            <th class="num">Travel time (s)</th>
          </tr>
        </thead>
        <tbody>
          {#each results.segments as s, i}
            <tr data-testid={`mf-comp-seg-${i + 1}`} class:seg-governing={i === results.governing_segment}>
              <th>{i + 1}{#if i === results.governing_segment} · governs{/if}</th>
              <td class="num">{segments[i]?.grade ?? '—'} %</td>
              <td class="num">{segments[i]?.length ?? '—'}</td>
              <td class="num">{fmt(s.capacity_mix, 0)}</td>
              <td class="num">{fmt(s.s_mix)}</td>
              <td class="num">{fmt(s.travel_time)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="los overflow-x-auto">
      <table class="table w-full">
        <tbody>
          <tr>
            <th>Governing mixed-flow capacity, C<sub>mix</sub></th>
            <td class="num" data-testid="mf-comp-capacity">{fmt(results.capacity_mix, 0)} veh/h/ln</td>
          </tr>
          <tr>
            <th>Governing grade</th>
            <td class="num" data-testid="mf-comp-governing">Grade {results.governing_segment + 1}</td>
          </tr>
          <tr>
            <th>Total length</th>
            <td class="num">{fmt(results.total_length, 2)} mi</td>
          </tr>
          <tr>
            <th>Total travel time</th>
            <td class="num">{fmt(results.total_travel_time)} s</td>
          </tr>
          <tr class="step-los">
            <th>Overall mixed-flow speed, S<sub>mix,oa</sub> (Equation 25-70)</th>
            <td class="num" data-testid="mf-comp-overall">{fmt(results.s_mix_overall)} mi/h</td>
          </tr>
          <tr>
            <th>Level of service</th>
            <td class="num" data-testid="mf-comp-los">{oversaturated ? 'F' : 'not assigned'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  {/if}

  <div class="facility-summary" data-testid="mf-los-basis">
    <p>
      The mixed-flow model reports a speed and a density, not a level of service. HCM Chapter 26
      assigns LOS F when v<sub>mix</sub> exceeds C<sub>mix</sub> and stops there; below capacity
      it assigns no letter, because D<sub>mix</sub> is a mixed-flow density in veh/mi/ln and the
      Exhibit 12-15 bands are auto-only densities in pc/mi/ln. Chapter 25 Example Problem 11's
      own discussion makes the same point about the composite procedure.
    </p>
  </div>

  {#if results}
    <Discussion sentences={results.discussion} />
  {/if}
</section>

<style>
  .seg-action { display: flex; justify-content: flex-end; margin: -0.25rem 0 0.75rem; }
  .diagram-block { margin: 1rem auto 0; max-width: 560px; }
  .step-table .step-num { width: 3rem; text-align: center; font-variant-numeric: tabular-nums; opacity: 0.6; }
  .step-table tr.step-los th, .step-table tr.step-los td { font-weight: 700; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.step-los th, tr.step-los td { font-weight: 700; }
  tr.seg-governing { background: color-mix(in srgb, var(--diag-center) 12%, transparent); }
</style>
