<svelte:head>
  <title>Report · HCM Calculator</title>
</svelte:head>

<script>
  import { run } from 'svelte/legacy';

  import { onMount } from 'svelte';
  import { reports, lastKey, loadReports } from '$lib/report';
  import FreewaySegment3D from '../FreewaySegment3D/+page.svelte';
  import FacilityView from '../FacilityView/+page.svelte';
  import WeavingDiagram from '$lib/WeavingDiagram.svelte';
  import RampDiagram from '$lib/RampDiagram.svelte';
  import SignalizedDiagram from '$lib/SignalizedDiagram.svelte';
  import TwscDiagram from '$lib/TwscDiagram.svelte';
  import AwscDiagram from '$lib/AwscDiagram.svelte';
  import RoundaboutDiagram from '$lib/RoundaboutDiagram.svelte';
  import PathDiagram from '$lib/PathDiagram.svelte';
  import UrbanSegmentDiagram from '$lib/UrbanSegmentDiagram.svelte';
  import UrbanFacilityDiagram from '$lib/UrbanFacilityDiagram.svelte';

  onMount(() => { if (!Object.keys($reports).length) loadReports(); });

  let selected = $state(null);
  // Default to the most recent report; keep the user's tab choice while it's valid.
  let keys = $derived(Object.keys($reports));
  run(() => {
    if (selected === null || !$reports[selected]) {
      selected = ($lastKey && $reports[$lastKey]) ? $lastKey : (keys[0] || null);
    }
  });
  let current = $derived(selected ? $reports[selected] : null);
  let tabs = $derived(keys.map((k) => ({ key: k, label: $reports[k].chapter })));

  function printReport() { window.print(); }

  function losClass(v) {
    if (v === 'A' || v === 'B') return 'los-badge los-good';
    if (v === 'C' || v === 'D') return 'los-badge los-warn';
    return 'los-badge los-bad';
  }
</script>

<div class="hcm-page report-page">
  {#if !current}
    <header class="page-header">
      <span class="badge badge-outline page-badge">Report</span>
      <h1 class="page-title">Analysis Report</h1>
    </header>
    <div class="panel">
      <p class="panel-sub">
        No analysis yet. Run an analysis on any chapter page, then return here
        to view and print the report. Reports from several chapters are kept
        side by side for the session.
      </p>
    </div>
  {:else}
    <div class="report-actions no-print">
      {#if tabs.length > 1}
        <div class="report-tabs" role="group" aria-label="Available reports">
          {#each tabs as t}
            <button type="button" class:active={t.key === selected} onclick={() => selected = t.key}>{t.label}</button>
          {/each}
        </div>
      {:else}
        <a class="btn btn-ghost btn-sm" href={current.href}>← Back to {current.chapter}</a>
      {/if}
      <button class="btn btn-primary btn-sm" type="button" onclick={printReport}>Print / Save as PDF</button>
    </div>

    <article class="report-sheet">
      <header class="report-head">
        <div>
          <p class="report-eyebrow">{current.chapterRef}</p>
          <h1 class="report-title">{current.chapter}</h1>
          <p class="report-meta">HCM Calculator · generated {current.generatedAt}</p>
        </div>
        {#if current.headline}
          <div class="report-los">
            <span class="report-los-label">{current.headline.label}</span>
            <span class={losClass(current.headline.value)}>{current.headline.value}</span>
          </div>
        {/if}
      </header>

      <section class="report-section">
        <h2>Inputs</h2>
        <table class="report-table kv">
          <tbody>
            {#each current.inputs as row}
              <tr><th>{row.label}</th><td>{row.value}</td></tr>
            {/each}
          </tbody>
        </table>
      </section>

      <section class="report-section">
        <h2>Results</h2>
        <div class="report-table-scroll">
          <table class="report-table">
            <thead>
              <tr>{#each current.resultTable.columns as c}<th>{c}</th>{/each}</tr>
            </thead>
            <tbody>
              {#each current.resultTable.rows as r}
                <tr>{#each r as cell, ci}<td class:label={ci === 0}>{cell}</td>{/each}</tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if current.summary && current.summary.length}
          <table class="report-table kv report-summary">
            <tbody>
              {#each current.summary as row}
                <tr><th>{row.label}</th><td>{row.value}</td></tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>

      {#if current.diagram}
        <section class="report-section">
          <h2>{current.diagram.kind === 'urban-facility' ? 'Facility' : 'Segment'}</h2>
          <div class="report-diagram">
            {#if current.diagram.kind === 'freeway'}
              <FreewaySegment3D
                laneCount={current.diagram.props.laneCount}
                laneWidth={current.diagram.props.laneWidth}
                length={current.diagram.props.length}
                grade={current.diagram.props.grade}
                lcR={current.diagram.props.lcR}
              />
            {:else if current.diagram.kind === 'twolane'}
              <FacilityView rows={current.diagram.props.rows} laneWidth={current.diagram.props.laneWidth} />
            {:else if current.diagram.kind === 'weaving'}
              <WeavingDiagram
                weavingType={current.diagram.props.weavingType}
                numLanes={current.diagram.props.numLanes}
                vFF={current.diagram.props.vFF}
                vFR={current.diagram.props.vFR}
                vRF={current.diagram.props.vRF}
                vRR={current.diagram.props.vRR}
              />
            {:else if current.diagram.kind === 'ramp'}
              <RampDiagram
                rampType={current.diagram.props.rampType}
                rampSide={current.diagram.props.rampSide}
                rampLanes={current.diagram.props.rampLanes}
                freewayLanes={current.diagram.props.freewayLanes}
                accelLen={current.diagram.props.accelLen}
                decelLen={current.diagram.props.decelLen}
              />
            {:else if current.diagram.kind === 'signalized'}
              <SignalizedDiagram approaches={current.diagram.props.approaches} editable={false} />
            {:else if current.diagram.kind === 'twsc'}
              <TwscDiagram {...current.diagram.props} editable={false} />
            {:else if current.diagram.kind === 'awsc'}
              <AwscDiagram approaches={current.diagram.props.approaches} editable={false} />
            {:else if current.diagram.kind === 'roundabout'}
              <RoundaboutDiagram entries={current.diagram.props.entries} editable={false} />
            {:else if current.diagram.kind === 'path'}
              <PathDiagram {...current.diagram.props} editable={false} />
            {:else if current.diagram.kind === 'urban-segment'}
              <UrbanSegmentDiagram {...current.diagram.props} editable={false} />
            {:else if current.diagram.kind === 'urban-facility'}
              <UrbanFacilityDiagram
                segments={current.diagram.props.segments}
                note={current.diagram.props.note ?? 'Segment chain, upstream to downstream, coloured by segment level of service.'} />
            {/if}
          </div>
        </section>
      {/if}

      <section class="report-section">
        <h2>Methodology</h2>
        <ul class="report-notes">
          {#each current.methodology as note}
            <li>{note}</li>
          {/each}
        </ul>
      </section>

      <footer class="report-foot">
        Generated by the HCM Calculator ({current.chapterRef}). Calculations run in a Rust core
        compiled to WebAssembly. This is an independent tool and is not affiliated with any
        organization; verify results independently before relying on them in engineering work.
      </footer>
    </article>
  {/if}
</div>

<style>
  .report-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .report-tabs {
    display: inline-flex;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    overflow: hidden;
  }
  .report-tabs button {
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.35rem 0.9rem;
    background: #fff;
    color: #64748b;
  }
  .report-tabs button.active { background: #fff5ec; color: #ea7317; font-weight: 600; }
  .report-tabs button + button { border-left: 1px solid #e2e8f0; }

  .report-sheet {
    background: #fff;
    color: #1e293b;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 2rem 2.25rem;
    max-width: 900px;
    margin: 0 auto;
    box-shadow: 0 10px 30px -20px rgba(0, 0, 0, 0.35);
  }
  .report-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 2px solid #f1f5f9;
    padding-bottom: 1rem;
    margin-bottom: 1.25rem;
  }
  .report-eyebrow { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin: 0; }
  .report-title { font-size: 1.6rem; font-weight: 700; margin: 0.15rem 0; color: #0f172a; }
  .report-meta { font-size: 0.8rem; color: #64748b; margin: 0; }
  .report-los { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; }
  .report-los-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
  .los-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 2.5rem; height: 2.5rem; border-radius: 0.5rem;
    font-size: 1.35rem; font-weight: 700; color: #fff;
  }
  .los-good { background: #16a34a; }
  .los-warn { background: #d97706; }
  .los-bad  { background: #dc2626; }

  .report-section { margin-bottom: 1.5rem; }
  .report-section h2 {
    font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;
    color: #475569; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.3rem; margin-bottom: 0.6rem;
  }
  .report-table-scroll { overflow-x: auto; }
  .report-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .report-table th, .report-table td { padding: 0.4rem 0.6rem; text-align: left; border-bottom: 1px solid #f1f5f9; }
  .report-table thead th { color: #64748b; font-weight: 600; font-size: 0.78rem; }
  .report-table.kv th { color: #475569; font-weight: 500; width: 45%; }
  .report-table.kv td { text-align: right; font-variant-numeric: tabular-nums; }
  .report-table td.label { color: #334155; }
  .report-table td:not(.label) { text-align: right; font-variant-numeric: tabular-nums; }
  .report-summary { margin-top: 0.6rem; }
  .report-summary th { font-weight: 700; }
  .report-diagram { max-width: 560px; margin: 0 auto; }
  .report-notes { margin: 0; padding-left: 1.1rem; }
  .report-notes li { font-size: 0.85rem; color: #334155; margin-bottom: 0.3rem; }
  .report-foot { font-size: 0.72rem; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 0.8rem; margin-top: 1rem; }

  @media print {
    :global(header), :global(.site-footer) { display: none !important; }
    .no-print { display: none !important; }
    .report-sheet { border: none; box-shadow: none; padding: 0; max-width: 100%; }
    :global(body), :global(main) { background: #fff !important; }
  }
</style>
