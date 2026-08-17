<script>
  // The facility builder, phases 1a and 1b: the chassis and the freeway editor,
  // and the analysis on top of it. The user describes the road as an engineer
  // knows it — a mainline with ramps at stations — and the builder does Chapter
  // 10's segmentation homework, shows its work, and then runs it.
  //
  // The seam between the two halves is exactly one object: `toFixture(doc,
  // rows)` returns the facility in the library's own serde schema, which is
  // what WasmFreewayFacility takes. Nothing in the editor knows what an LOS is,
  // and nothing in `analyze.js` knows what a feature is.
  //
  // The derivation itself is not here and not in JS anywhere: it calls
  // `segment_ramp_section` in the library through crosstraffic_middleware, per
  // the house rule that a second implementation is how drift starts. The
  // analysis follows the same rule from the other side: it constructs the
  // facility exactly as tests/boundary/ch10_freeway_facilities.mjs does, so a
  // run here and the boundary suite cannot disagree about what the published
  // Example Problems produce.

  import { onMount, tick } from 'svelte';
  import init, {
    segment_ramp_section,
    ramp_influence_area_ft,
    WasmFacilitySegment,
    WasmFreewayFacility,
    WasmFreewayReliability
  } from 'HCM-middleware';

  import BuilderStrip from '$lib/builder/BuilderStrip.svelte';
  import FeatureEditor from '$lib/builder/FeatureEditor.svelte';
  import SegmentTable from '$lib/builder/SegmentTable.svelte';
  import DemandGrid from '$lib/builder/DemandGrid.svelte';
  import Heatmap from '$lib/builder/Heatmap.svelte';
  import Discussion from '$lib/Discussion.svelte';
  import { emptyDocument, makeFeature, migrate, setPeriods, FT_PER_MI, isRamp } from '$lib/builder/document.js';
  import { deriveRows } from '$lib/builder/derive.js';
  import { validateFacility } from '$lib/builder/validate.js';
  import { fromFixture, toFixture, UNCARRIED_FIELDS } from '$lib/builder/fixture.js';
  import { TEMPLATES, applyTemplate } from '$lib/builder/templates.js';
  import { EXAMPLES, loadExample } from '$lib/builder/examples.js';
  import { createHistory, parseSnapshot } from '$lib/builder/history.js';
  import { saveSlot, loadSlot, downloadJson, readJsonFile } from '$lib/builder/storage.js';
  import { analyzeFacility } from '$lib/builder/analyze.js';
  import { analyzeReliability, defaultReliabilityInputs, handoffNotes } from '$lib/builder/reliability.js';
  import { discussion, reliabilityDiscussion } from '$lib/builder/discussion.js';
  import { withWasmRetry } from '$lib/wasmRetry';
  import { setReport } from '$lib/report';

  const SLOT = 'default';

  let ready = $state(false);
  let doc = $state(emptyDocument());
  let selectedKey = $state(null);
  // One id, doing two jobs that were never really separate: it is the feature
  // whose markers are lit on the strip, and it is the feature whose editor is
  // open in the list. Holding them apart would allow the two halves of the same
  // selection to disagree, which is the state the sync exists to prevent.
  let selectedFeature = $state(null);
  // The editor area (strip, features, derived table) blown up to fill the
  // viewport. It is page state rather than editor state so that a run, which
  // leaves the results below the editor, does not disturb it.
  let maximized = $state(false);
  let message = $state('');
  let error = $state('');
  let fileInput = $state(null);

  // Seeded with a fresh empty document rather than with `doc`, which is a rune:
  // onMount resets it to whatever was restored anyway, and reading the rune at
  // module scope would capture only its initial value.
  const history = createHistory(emptyDocument());
  let canUndo = $state(false);
  let canRedo = $state(false);

  let api = $derived(ready ? { segment_ramp_section, ramp_influence_area_ft } : null);

  // ── Results ─────────────────────────────────────────────────────
  //
  // A run is frozen onto the moment it happened: `analyzeFacility` copies every
  // matrix out of the wasm module and freezes the whole object, and the page
  // renders only from that. Editing the document afterwards leaves the results
  // standing and marks them stale, which is what keeps the printable report
  // from quoting numbers the form no longer holds.
  let results = $state(null);
  let discussionLines = $state([]);
  let analysisError = $state('');
  let reliability = $state(null);
  let relDiscussion = $state([]);
  let reliabilityError = $state('');
  let reliabilityRunning = $state(false);
  let relInputs = $state(defaultReliabilityInputs());
  let runDocJson = $state('');
  let stale = $derived(!!results && runDocJson !== JSON.stringify(doc));

  // The heatmap ramp anchors its near-zero end at the page surface, and that is
  // a different end in each theme. The navbar toggle writes the attribute
  // directly with no store behind it, so an observer is how this page hears
  // about a theme change.
  let dark = $state(false);

  // Everything below the document is derived, which is what makes undo a
  // one-liner: restoring a snapshot restores the whole view.
  let derivation = $derived(
    api ? deriveRows(doc, api) : { rows: [], sections: [], errors: [] }
  );
  let rows = $derived(derivation.rows);
  let flags = $derived(api ? validateFacility(doc, rows, derivation.errors) : []);
  let errors = $derived(flags.filter((f) => f.level === 'error'));
  let warns = $derived(flags.filter((f) => f.level === 'warn'));
  let notes = $derived(flags.filter((f) => f.level === 'note'));

  // Shown before the reliability run as well as after it, because "this facility
  // carries something the reliability path cannot express" is worth knowing
  // before pressing the button rather than after reading the answer.
  let relNotes = $derived(api ? handoffNotes(doc, rows) : []);

  // "Why this segment?" lights the features that produced the selected row.
  let highlightIds = $derived(
    selectedKey ? (rows.find((r) => r.key === selectedKey)?.sourceIds ?? []) : selectedFeature ? [selectedFeature] : []
  );

  onMount(async () => {
    await init();
    const saved = loadSlot(SLOT);
    if (saved) {
      try {
        doc = migrate(saved);
        message = 'Restored your last facility from this browser.';
      } catch (e) {
        // A slot written by an older build is not a reason to lose the editor.
        error = `Could not restore the saved facility: ${e.message}`;
      }
    }
    history.reset(doc);
    syncHistoryFlags();
    ready = true;
  });

  onMount(() => {
    const root = document.documentElement;
    const read = () => (dark = root.getAttribute('data-theme') === 'dark');
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  });

  function syncHistoryFlags() {
    canUndo = history.canUndo;
    canRedo = history.canRedo;
  }

  /** Every mutation goes through here, so there is exactly one place that
   * records history and autosaves, and no path that changes the document
   * without both. */
  function commit(mutate, coalesceKey = null) {
    const next = JSON.parse(JSON.stringify(doc));
    mutate(next);
    doc = next;
    history.push(next, coalesceKey);
    syncHistoryFlags();
    saveSlot(SLOT, next);
  }

  function replaceDoc(next, note = '') {
    doc = next;
    history.reset(next);
    syncHistoryFlags();
    saveSlot(SLOT, next);
    selectedKey = null;
    selectedFeature = null;
    message = note;
    error = '';
    // A replacement is a different facility, so keeping the old results beside
    // it would invite reading one against the other. An edit only marks them
    // stale; a replacement discards them.
    clearResults();
  }

  function clearResults() {
    results = null;
    discussionLines = [];
    reliability = null;
    relDiscussion = [];
    analysisError = '';
    reliabilityError = '';
    runDocJson = '';
  }

  function undo() {
    doc = parseSnapshot(history.undo());
    syncHistoryFlags();
    saveSlot(SLOT, doc);
  }
  function redo() {
    doc = parseSnapshot(history.redo());
    syncHistoryFlags();
    saveSlot(SLOT, doc);
  }

  function onKey(e) {
    // Escape leaves the maximized editor, which is the only way out other than
    // the toggle and the one a reader of a full-screen overlay reaches for
    // first. It is checked before the modifier gate because it carries none.
    if (e.key === 'Escape' && maximized) {
      e.preventDefault();
      setMaximized(false);
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((k === 'z' && e.shiftKey) || k === 'y') {
      e.preventDefault();
      redo();
    }
  }

  // ── Features ─────────────────────────────────────────────────────────

  /** Open one feature's editor, or close it. Only one is open at a time, so
   * "which feature am I editing" has one answer and the strip can light it. */
  function toggleFeature(id) {
    selectedFeature = selectedFeature === id ? null : id;
    selectedKey = null;
  }

  /** A marker click opens the row and brings it into view. The strip only calls
   * this when the pointer went down and up without moving the feature, because
   * scrolling the page under a drag would move the strip out from under the
   * pointer mid-gesture. */
  async function revealFeature(id) {
    selectedFeature = id;
    selectedKey = null;
    await tick();
    document
      .querySelector(`tr[data-feature-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function setMaximized(next) {
    maximized = next;
    // Focus follows the control the user pressed, so Escape and the button
    // leave the keyboard in the same place rather than at the top of the page.
    tick().then(() => maximizeBtn?.focus());
  }

  let maximizeBtn = $state(null);

  function addFeature(kind) {
    commit((d) => {
      const station = d.features.length
        ? Math.min(d.mainline.lengthFt, Math.max(...d.features.map((f) => f.stationFt)) + 2 * FT_PER_MI / 2)
        : Math.round(d.mainline.lengthFt / 2);
      // Placing a feature ends the segments-only state an import arrives in:
      // from here the segments follow the features, so the imported list would
      // only be a stale second answer.
      d.importedSegments = null;
      d.importedRaw = null;
      d.features.push(makeFeature(d, kind, station));
    });
  }

  function removeFeature(id) {
    commit((d) => {
      d.features = d.features.filter((f) => f.id !== id);
      // Overrides keyed to a section this feature was half of no longer refer
      // to anything, and a dead override is worse than no override. The key is
      // split rather than searched, because `on1` is a substring of `on11`.
      for (const k of Object.keys(d.overrides)) {
        if (k.split(/[:#]/).includes(id)) delete d.overrides[k];
      }
    });
    if (selectedFeature === id) selectedFeature = null;
  }

  function setFeature(id, field, value) {
    commit((d) => {
      const f = d.features.find((x) => x.id === id);
      if (f) f[field] = value;
    });
  }

  function setWorkZone(id, field, value) {
    commit((d) => {
      const f = d.features.find((x) => x.id === id);
      if (f?.config) f.config[field] = value;
    });
  }

  function moveFeature(id, stationFt, phase) {
    // The final position of a drag coalesces into the same undo step as the
    // moves that led to it. Committing it under a null key instead would make
    // every drag two steps, and the first undo would land the ramp one
    // pointermove short of where the user let go.
    commit((d) => {
      const f = d.features.find((x) => x.id === id);
      if (!f) return;
      const next = Math.round(stationFt);
      // An interval feature is dragged whole: its length is a property of the
      // work zone, not of where it happens to sit.
      if (f.endFt != null) f.endFt += next - f.stationFt;
      f.stationFt = next;
    }, `drag:${id}`);
    if (phase === 'end') history.seal();
  }

  function dropTemplate(templateId) {
    commit((d) => {
      d.importedSegments = null;
      d.importedRaw = null;
      const last = d.features.length ? Math.max(...d.features.map((f) => f.stationFt)) : 0;
      const at = Math.min(d.mainline.lengthFt - 1, last ? last + FT_PER_MI : FT_PER_MI);
      applyTemplate(d, templateId, at);
    });
  }

  // ── Mainline, demands, overrides ─────────────────────────────────────

  function setMainline(field, raw) {
    const value = field === 'terrain' || field === 'cityType' ? raw : Number(raw);
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    commit((d) => {
      d.mainline[field] = value;
    });
  }

  function setLengthMi(raw) {
    const miVal = Number(raw);
    if (!Number.isFinite(miVal) || miVal <= 0) return;
    commit((d) => {
      d.mainline.lengthFt = Math.round(miVal * FT_PER_MI);
    });
  }

  function editDemand(target, id, p, v) {
    commit((d) => {
      if (target === 'mainline') d.mainline.demand[p] = v;
      else {
        const f = d.features.find((x) => x.id === id);
        if (!f) return;
        if (target === 'rampToRamp') f.rampToRampDemand[p] = v;
        else f.demand[p] = v;
      }
    });
  }

  function setPeriodCount(n) {
    if (!Number.isFinite(n) || n < 1) return;
    commit((d) => setPeriods(d, n));
  }

  function setOverride(rowKey, field, value, derivedSegType) {
    commit((d) => {
      const cur = d.overrides[rowKey] ?? { fields: {}, appliedTo: derivedSegType };
      cur.fields = { ...cur.fields, [field]: value };
      d.overrides[rowKey] = cur;
    });
  }

  function clearOverride(rowKey) {
    commit((d) => {
      delete d.overrides[rowKey];
    });
  }

  // ── Persistence ──────────────────────────────────────────────────────

  function downloadDocument() {
    downloadJson(`${slug(doc.meta.name)}.builder.json`, doc);
  }

  function downloadFixture() {
    downloadJson(`${slug(doc.meta.name)}.facility.json`, toFixture(doc, rows));
  }

  async function onFile(e) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    e.currentTarget.value = '';
    error = '';
    try {
      const raw = await readJsonFile(file);
      // One input, two formats. A builder document declares itself with a
      // version; anything else is tried as a fixture, and the failure message
      // says which of the two it failed to be.
      if (raw && typeof raw === 'object' && 'version' in raw && 'facilityType' in raw) {
        replaceDoc(migrate(raw), `Loaded the builder document ${file.name}.`);
      } else {
        replaceDoc(fromFixture(raw, file.name), `Imported ${file.name} as a fixture. It arrived as segments with no feature layer.`);
      }
    } catch (err) {
      error = String(err.message ?? err);
    }
  }

  function newFacility() {
    replaceDoc(emptyDocument(), 'Started an empty facility.');
  }

  function openExample(id) {
    replaceDoc(loadExample(id), `Loaded ${EXAMPLES.find((e) => e.id === id).name} as placed ramps, not as a segment table.`);
  }

  // ── Analysis ────────────────────────────────────────────────────

  const wasm = { WasmFacilitySegment, WasmFreewayFacility, WasmFreewayReliability };

  /** Errors block the run and warnings do not. The distinction is the one
   * `validate.js` already draws: an error is a state the engine either rejects
   * or mis-handles silently, and a warning is a state a competent analyst may
   * have meant. */
  function runAnalysis() {
    analysisError = '';
    reliability = null;
    relDiscussion = [];
    reliabilityError = '';
    if (errors.length) {
      analysisError = 'Fix the blocking checks above before analyzing.';
      return;
    }
    try {
      const run = analyzeFacility(doc, rows, wasm);
      results = run;
      // Generated once, off the run that produced these numbers, so the page
      // and the printable report can never drift apart or restate a
      // since-edited input.
      discussionLines = discussion(run);
      runDocJson = JSON.stringify(doc);
      publishReport(run);
    } catch (e) {
      results = null;
      discussionLines = [];
      runDocJson = '';
      analysisError = String(e?.message ?? e);
    }
  }

  function runReliability() {
    reliabilityError = '';
    reliabilityRunning = true;
    try {
      reliability = analyzeReliability(doc, rows, relInputs, wasm, withWasmRetry);
      relDiscussion = reliabilityDiscussion(reliability, results);
      if (results) publishReport(results);
    } catch (e) {
      reliability = null;
      relDiscussion = [];
      reliabilityError = String(e?.message ?? e);
    } finally {
      reliabilityRunning = false;
    }
  }

  function setRelInput(field, value) {
    relInputs = { ...relInputs, [field]: value };
  }

  /** The report is published off the frozen run rather than off `doc`, so the
   * printed page and the screen cannot disagree even after an edit. */
  function publishReport(run) {
    const wzSegs = run.segments.filter((s) => s.workZone).map((s) => s.index + 1);
    setReport({
      chapter: `Facility Builder — ${run.facilityName}`,
      chapterRef: 'HCM Chapter 10',
      href: '/builder',
      generatedAt: new Date().toLocaleString(),
      headline: {
        label: 'Facility LOS (poorest period)',
        value: run.perPeriod.reduce((w, p) => (p.los > w ? p.los : w), 'A')
      },
      discussion: [...discussionLines, ...relDiscussion],
      inputs: [
        { label: 'Facility length', value: `${run.totalLengthMi.toFixed(2)} mi` },
        { label: 'Free-flow speed', value: `${doc.mainline.ffs} mi/h` },
        { label: 'Heavy vehicles', value: `${(doc.mainline.heavyVehiclePct * 100).toFixed(2)} %` },
        { label: 'Terrain', value: doc.mainline.terrain },
        { label: 'Area type', value: doc.mainline.cityType },
        { label: 'Peak hour factor', value: doc.mainline.phf },
        { label: 'Jam density', value: `${doc.mainline.jamDensityPc} pc/mi/ln` },
        { label: 'Queue discharge capacity drop', value: `${(doc.mainline.queueDischargeDrop * 100).toFixed(1)} %` },
        { label: 'Total ramp density', value: `${doc.mainline.totalRampDensity} /mi` },
        { label: 'Interchange density', value: `${doc.mainline.interchangeDensity} /mi` },
        { label: 'Mainline entry demand', value: `${doc.mainline.demand.join(', ')} veh/h` },
        {
          label: 'Derived segments (upstream to downstream)',
          value: run.segments.map((s) => `${s.segType} ${Math.round(s.lengthFt)} ft x${s.lanes}`).join(', ')
        },
        ...(wzSegs.length ? [{ label: 'Work zone segments', value: wzSegs.join(', ') }] : [])
      ],
      resultTable: {
        columns: ['Period', 'Space mean speed (mi/h)', 'Average density (veh/mi/ln)', 'Facility LOS'],
        rows: run.perPeriod.map((p, i) => [`${i + 1}`, p.speed.toFixed(1), p.density.toFixed(1), p.los])
      },
      // The heatmap as a table of letters. A fill does not survive a print
      // reliably and a greyscale ramp is unreadable at cell size, so the
      // printed form of the time-space domain is the letters themselves.
      matrixTable: {
        title: 'Time-space domain (segment LOS by analysis period)',
        columns: ['Period', ...run.segments.map((s) => `${s.index + 1} ${s.segType}${s.workZone ? ' (WZ)' : ''}`)],
        rows: run.perPeriod.map((_, p) => [`${p + 1}`, ...run.segments.map((s) => run.matrices.los[s.index][p])]),
        caption:
          'Segments across, analysis periods down (Exhibit 10-10). Letters rather than colours, so the table reads the same in print and in greyscale.'
      },
      summary: [
        { label: 'Overall space mean speed', value: `${run.overallSpeed.toFixed(1)} mi/h` },
        { label: 'Overall density', value: `${run.overallDensity.toFixed(1)} veh/mi/ln` },
        {
          label: 'Oversaturated',
          value: run.oversaturated ? `Yes, demand first exceeds capacity in period ${run.firstOversatPeriod + 1}` : 'No'
        },
        ...(reliability
          ? [
              { label: 'Mean travel time index', value: reliability.ttiMean.toFixed(3) },
              { label: 'Median travel time index', value: reliability.tti50.toFixed(3) },
              { label: 'Planning time index (95th percentile)', value: reliability.tti95.toFixed(3) },
              { label: 'Reliability rating', value: `${reliability.reliabilityRating.toFixed(1)} %` }
            ]
          : [])
      ],
      methodology: [
        'HCM Chapter 10 core methodology, run on the segment table the Chapter 10 Section 2 segmentation rules derived from the placed features. Each segment is analyzed per its own chapter (12, 13, 14) per 15-min period, with oversaturated periods handled by the Chapter 25 queue-tracking procedure over the time-space domain.',
        'On an oversaturated facility the placement of a queue among upstream segments can differ from the published engine while the facility totals agree.',
        ...(wzSegs.length
          ? ['Work zone segments carry the Chapter 10 Section 4 adjustments (Equations 10-7 through 10-12). The capacity reported for a work zone segment is the post-CAF value.']
          : []),
        ...(reliability
          ? [`HCM Chapter 11 reliability run on the same facility as its seed file, over ${reliability.numScenarios} scenarios. Weather, the incident frequency, severity and duration overrides, the demand multiplier table and the reliability reporting period all take the engine defaults here; the Chapter 11 page has a panel for each.`]
          : [])
      ]
    });
  }

  const slug = (s) => (s || 'facility').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const LEVEL_LABEL = { error: 'Blocks analysis', warn: 'Check this', note: 'Note' };
  const n1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '–');

  // A collapsed row says what the feature is and what the editor would open on,
  // so the list still reads as a list once every field moved into the panel.
  const mi2 = (ft) => (ft / FT_PER_MI).toFixed(2);
  const peak = (v) => (Array.isArray(v) && v.length ? Math.max(...v) : 0);
  const rampSummary = (f) =>
    f.kind === 'on_ramp'
      ? `FFS ${f.rampFfs} mi/h · accel ${f.accelLaneFt} ft${f.auxLaneToNext ? ' · aux lane to next' : ''}`
      : `FFS ${f.rampFfs} mi/h · decel ${f.decelLaneFt} ft`;
  const changeSummary = (f) =>
    f.kind === 'lane_change'
      ? `to ${f.lanes} lanes`
      : `${f.config.total_lanes} lanes to ${f.config.open_lanes}, ${f.config.soft_barrier ? 'cones/drums' : 'hard barrier'}, ${f.config.speed_limit_mi_h} mi/h`;
</script>

<svelte:head>
  <title>Facility Builder — HCM Calculator</title>
  <meta name="description" content="Build an HCM Chapter 10 freeway facility by placing ramps, and let the Chapter 10 segmentation rules derive the segment table." />
</svelte:head>

<svelte:window on:keydown={onKey} />

<div class="builder">
  <header class="bd-head">
    <div>
      <h1>Facility Builder</h1>
      <p class="bd-lede">
        Place ramps along a mainline and the HCM Chapter 10 segmentation rules derive the analysis segments. The derivation calls the library's own <code>segment_ramp_section</code>, so the table here and the table the engines analyze cannot disagree.
      </p>
    </div>
    <div class="bd-status" aria-live="polite">
      {#if !ready}<span class="bd-loading">Loading the engine…</span>{/if}
    </div>
  </header>

  <!-- The whole editor is inert until the wasm module has initialized, the way
       every chapter page gates its form. Without it a ramp placed in the first
       frames would derive nothing and look like an empty facility. -->
  <div class="bd-body" inert={!ready} data-testid="builder-body" data-ready={ready}>
    <section class="bd-bar" aria-label="Facility actions">
      <div class="bd-group">
        <button type="button" class="btn btn-sm" onclick={newFacility} data-testid="new-facility">New</button>
        <button type="button" class="btn btn-sm" onclick={undo} disabled={!canUndo} data-testid="undo">Undo</button>
        <button type="button" class="btn btn-sm" onclick={redo} disabled={!canRedo} data-testid="redo">Redo</button>
      </div>
      <div class="bd-group">
        <span class="bd-group-label">Add</span>
        <button type="button" class="btn btn-sm" onclick={() => addFeature('on_ramp')} data-testid="add-on-ramp">On-ramp</button>
        <button type="button" class="btn btn-sm" onclick={() => addFeature('off_ramp')} data-testid="add-off-ramp">Off-ramp</button>
        <button type="button" class="btn btn-sm" onclick={() => addFeature('lane_change')} data-testid="add-lane-change">Lane change</button>
        <button type="button" class="btn btn-sm" onclick={() => addFeature('work_zone')} data-testid="add-work-zone">Work zone</button>
        {#each TEMPLATES as t}
          <button type="button" class="btn btn-sm" title={t.summary}
                  onclick={() => dropTemplate(t.id)} data-testid="template-{t.id}">{t.name}</button>
        {/each}
      </div>
      <div class="bd-group">
        <span class="bd-group-label">Load</span>
        {#each EXAMPLES as ex}
          <button type="button" class="btn btn-sm" title={ex.summary}
                  onclick={() => openExample(ex.id)} data-testid="example-{ex.id}">{ex.name}</button>
        {/each}
        <button type="button" class="btn btn-sm" onclick={() => fileInput?.click()} data-testid="import-file">Open file…</button>
        <input bind:this={fileInput} type="file" accept="application/json,.json" onchange={onFile} class="bd-file" aria-label="Open a builder document or a facility fixture" />
      </div>
      <div class="bd-group">
        <span class="bd-group-label">Save</span>
        <button type="button" class="btn btn-sm" onclick={downloadDocument} data-testid="download-document">Document</button>
        <button type="button" class="btn btn-sm" onclick={downloadFixture} data-testid="download-fixture">Fixture</button>
      </div>
    </section>

    {#if error}
      <p class="bd-error" role="alert" data-testid="builder-error">{error}</p>
    {:else if message}
      <p class="bd-message" data-testid="builder-message">{message}</p>
    {/if}

    <section class="bd-mainline" aria-label="Mainline">
      <h2>Mainline</h2>
      <div class="bd-fields">
        <label>Name <input type="text" value={doc.meta.name} onchange={(e) => commit((d) => (d.meta.name = e.target.value))} data-testid="facility-name" /></label>
        <label>Length (mi) <input type="number" min="0.1" step="0.1" value={(doc.mainline.lengthFt / FT_PER_MI).toFixed(2)} onchange={(e) => setLengthMi(e.currentTarget.value)} data-testid="facility-length" /></label>
        <label>Lanes <input type="number" min="2" max="8" step="1" value={doc.mainline.lanes} onchange={(e) => setMainline('lanes', e.currentTarget.value)} data-testid="facility-lanes" /></label>
        <label>FFS (mi/h) <input type="number" min="45" max="80" step="1" value={doc.mainline.ffs} onchange={(e) => setMainline('ffs', e.currentTarget.value)} data-testid="facility-ffs" /></label>
        <label>Terrain
          <select value={doc.mainline.terrain} onchange={(e) => setMainline('terrain', e.currentTarget.value)}>
            <option>Level</option><option>Rolling</option><option>Mountainous</option>
          </select>
        </label>
        <label>Area
          <select value={doc.mainline.cityType} onchange={(e) => setMainline('cityType', e.currentTarget.value)}>
            <option>Urban</option><option>Rural</option>
          </select>
        </label>
        <label>PHF <input type="number" min="0.5" max="1" step="0.01" value={doc.mainline.phf} onchange={(e) => setMainline('phf', e.currentTarget.value)} /></label>
        <label>Heavy vehicles (decimal) <input type="number" min="0" max="1" step="0.0005" value={doc.mainline.heavyVehiclePct} onchange={(e) => setMainline('heavyVehiclePct', e.currentTarget.value)} /></label>
        <label>Ramp density (ramps/mi) <input type="number" min="0" step="0.1" value={doc.mainline.totalRampDensity} onchange={(e) => setMainline('totalRampDensity', e.currentTarget.value)} /></label>
        <label>Interchange density (int/mi) <input type="number" min="0" step="0.1" value={doc.mainline.interchangeDensity} onchange={(e) => setMainline('interchangeDensity', e.currentTarget.value)} /></label>
      </div>
    </section>

    <!-- Strip, features and derived table are one editor, so they maximize
         together: the reason to want the room is to see a marker, its editor and
         the segments it produced at once. The results stay outside it and below,
         which is what lets a run survive the toggle in either direction. -->
    <div class="bd-editor" class:maximized data-testid="builder-editor" data-maximized={maximized}>
      <div class="bd-editor-bar">
        <span class="bd-editor-title">Editor</span>
        <button type="button" class="btn btn-sm" bind:this={maximizeBtn}
                onclick={() => setMaximized(!maximized)}
                aria-pressed={maximized} data-testid="maximize-editor">
          {maximized ? 'Restore editor (Esc)' : 'Maximize editor'}
        </button>
      </div>

    <section class="bd-strip-wrap" aria-label="Facility strip">
      <BuilderStrip {doc} {rows} {selectedKey} {highlightIds} interactive={ready}
                    onselectrow={(k) => { selectedKey = selectedKey === k ? null : k; selectedFeature = null; }}
                    onselectfeature={(id) => { selectedFeature = id; selectedKey = null; }}
                    onrevealfeature={revealFeature}
                    onmovefeature={moveFeature} />
    </section>

    {#if doc.features.some(isRamp)}
      <section class="bd-features" aria-label="Ramps">
        <h2>Ramps</h2>
        <p class="bd-sub">
          A row opens the whole feature, including the fields no table column fits: the weaving geometry an auxiliary lane brings into play and the ramp's own demand by period. Clicking a marker on the strip opens the same editor.
        </p>
        <div class="bd-scroll">
          <table class="bd-table" data-testid="feature-table">
            <thead>
              <tr>
                <th scope="col">Ramp</th><th scope="col">Station (mi)</th><th scope="col">Geometry</th>
                <th scope="col">Peak demand</th><th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {#each [...doc.features].filter(isRamp).sort((a, b) => a.stationFt - b.stationFt) as f (f.id)}
                {@const open = selectedFeature === f.id}
                <tr class:selected={open} data-testid="feature-row" data-feature-id={f.id} data-expanded={open}>
                  <th scope="row">
                    <button type="button" class="bd-disclose" onclick={() => toggleFeature(f.id)}
                            aria-expanded={open} aria-controls="fe-{f.id}" data-testid="expand-{f.id}">
                      <span class="bd-caret" class:open aria-hidden="true">▸</span>
                      <span class="bd-kind" class:on={f.kind === 'on_ramp'}>{f.kind === 'on_ramp' ? 'On' : 'Off'}</span>
                      <span class="bd-feat-name">{f.label || f.id}</span>
                    </button>
                  </th>
                  <td class="bd-num">{mi2(f.stationFt)}</td>
                  <td class="bd-summary">{rampSummary(f)}</td>
                  <td class="bd-num">{peak(f.demand)}</td>
                  <td><button type="button" class="bd-remove" onclick={() => removeFeature(f.id)} data-testid="remove-{f.id}">remove</button></td>
                </tr>
                {#if open}
                  <tr class="bd-detail" data-testid="feature-detail" data-feature-id={f.id}>
                    <td colspan="5" id="fe-{f.id}">
                      <FeatureEditor feature={f} {doc} interactive={ready}
                                     onfield={setFeature} onworkzone={setWorkZone} ondemand={editDemand} />
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

    {#if doc.features.some((f) => !isRamp(f))}
      <section class="bd-features" aria-label="Mainline changes">
        <h2>Mainline changes</h2>
        <p class="bd-sub">
          A lane change and a work zone are both places where capacity changes, so each one starts a new segment (Chapter 10 Section 2). A work zone is coded with the lanes that stay open, which is what the engine analyzes; the lanes it closes feed the severity index instead.
        </p>
        <div class="bd-scroll">
          <table class="bd-table" data-testid="mainline-feature-table">
            <thead>
              <tr>
                <th scope="col">Feature</th><th scope="col">Extent (mi)</th><th scope="col">Configuration</th><th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {#each [...doc.features].filter((f) => !isRamp(f)).sort((a, b) => a.stationFt - b.stationFt) as f (f.id)}
                {@const open = selectedFeature === f.id}
                <tr class:selected={open} data-testid="mainline-feature-row" data-feature-id={f.id}
                    data-kind={f.kind} data-expanded={open}>
                  <th scope="row">
                    <button type="button" class="bd-disclose" onclick={() => toggleFeature(f.id)}
                            aria-expanded={open} aria-controls="fe-{f.id}" data-testid="expand-{f.id}">
                      <span class="bd-caret" class:open aria-hidden="true">▸</span>
                      <span class="bd-kind">{f.kind === 'lane_change' ? 'Lanes' : 'WZ'}</span>
                      <span class="bd-feat-name">{f.label || f.id}</span>
                    </button>
                  </th>
                  <td class="bd-num">{mi2(f.stationFt)}{f.endFt != null ? ` – ${mi2(f.endFt)}` : ''}</td>
                  <td class="bd-summary">{changeSummary(f)}</td>
                  <td><button type="button" class="bd-remove" onclick={() => removeFeature(f.id)} data-testid="remove-{f.id}">remove</button></td>
                </tr>
                {#if open}
                  <tr class="bd-detail" data-testid="feature-detail" data-feature-id={f.id}>
                    <td colspan="4" id="fe-{f.id}">
                      <FeatureEditor feature={f} {doc} interactive={ready}
                                     onfield={setFeature} onworkzone={setWorkZone} ondemand={editDemand} />
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

    <SegmentTable {rows} {doc} {selectedKey} interactive={ready}
                  onselect={(k) => { selectedKey = selectedKey === k ? null : k; selectedFeature = null; }}
                  onoverride={setOverride}
                  onclearoverride={clearOverride} />
    </div>

    <DemandGrid {doc} interactive={ready} onedit={editDemand} onperiods={setPeriodCount} />

    <section class="bd-checks" aria-label="Validation" data-testid="validation-panel">
      <h3>Checks</h3>
      {#if flags.length === 0}
        <p class="bd-clean" data-testid="validation-clean">Nothing flagged.</p>
      {:else}
        <ul class="bd-flags">
          {#each [...errors, ...warns, ...notes] as f}
            <li class="bd-flag {f.level}" data-testid="validation-flag" data-level={f.level} data-flag-id={f.id}>
              <span class="bd-flag-level">{LEVEL_LABEL[f.level]}</span>
              <span class="bd-flag-msg">{f.message}</span>
              <span class="bd-flag-cite">{f.cite}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="bd-uncarried">
        Exporting to the fixture schema carries the facility parameters above and every per-segment field this editor shows. It does not carry {UNCARRIED_FIELDS.join(', ')}, which have no editor here. A fixture that was imported keeps those fields verbatim through a round trip.
      </p>
    </section>

    <section class="bd-run" aria-label="Analysis">
      <div class="bd-run-bar">
        <button type="button" class="btn btn-primary" onclick={runAnalysis}
                disabled={errors.length > 0} data-testid="analyze">Analyze</button>
        <span class="bd-run-note">
          {#if errors.length}
            {errors.length} check{errors.length === 1 ? '' : 's'} above block the analysis. Warnings and notes do not.
          {:else}
            Runs the HCM Chapter 10 core methodology on the derived segment table.
          {/if}
        </span>
        {#if results}
          <a class="btn btn-sm" href="/report" data-testid="open-report">Open printable report</a>
        {/if}
      </div>
      {#if analysisError}
        <p class="bd-error" role="alert" data-testid="analysis-error">{analysisError}</p>
      {/if}
      {#if stale}
        <p class="bd-stale" data-testid="results-stale">
          The facility has been edited since this run. What follows is what the engine produced then, not what it would produce now. Press Analyze again to refresh it.
        </p>
      {/if}
    </section>

    {#if results}
      <Heatmap result={results} {dark} />

      <section class="bd-summary" aria-label="Facility summary" data-testid="facility-summary">
        <h2>Facility summary</h2>
        <div class="bd-figures">
          <div class="bd-fig">
            <span class="bd-fig-label">Overall space mean speed</span>
            <span class="bd-fig-value" data-testid="overall-speed">{n1(results.overallSpeed)}</span>
            <span class="bd-fig-unit">mi/h</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Overall density</span>
            <span class="bd-fig-value" data-testid="overall-density">{n1(results.overallDensity)}</span>
            <span class="bd-fig-unit">veh/mi/ln</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Facility length</span>
            <span class="bd-fig-value">{results.totalLengthMi.toFixed(2)}</span>
            <span class="bd-fig-unit">mi</span>
          </div>
        </div>

        <div class="bd-scroll">
          <table class="bd-table bd-perperiod" data-testid="facility-periods">
            <thead>
              <tr>
                <th scope="col">Analysis period</th>
                {#each results.perPeriod as _, p}<th scope="col">{p + 1}</th>{/each}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Space mean speed (mi/h)</th>
                {#each results.perPeriod as pp}<td>{n1(pp.speed)}</td>{/each}
              </tr>
              <tr>
                <th scope="row">Average density (veh/mi/ln)</th>
                {#each results.perPeriod as pp}<td>{n1(pp.density)}</td>{/each}
              </tr>
              <tr data-testid="facility-los-row">
                <th scope="row">Facility LOS</th>
                {#each results.perPeriod as pp}<td class="bd-los">{pp.los}</td>{/each}
              </tr>
            </tbody>
          </table>
        </div>

        {#if results.oversaturated}
          <!-- The core's own `first_oversat_period` has no binding getter in
               any released middleware version, so this is derived from the
               demand-to-capacity matrix by the same test the core applies. It
               is worded as the first period demand exceeds capacity rather
               than as an engine output. -->
          <p class="bd-oversat" data-testid="oversaturated-flag">
            Oversaturated. Demand first exceeds capacity in
            <strong data-testid="first-oversat-period">period {results.firstOversatPeriod + 1}</strong>,
            so the Chapter 25 queue-tracking procedure carried queues into upstream segments and later periods.
            {#if results.firstQueuedPeriod != null}
              A queue stands at the end of period {results.firstQueuedPeriod + 1}{results.lastQueuedPeriod !== results.firstQueuedPeriod ? ` through period ${results.lastQueuedPeriod + 1}` : ''}.
            {/if}
          </p>
        {:else}
          <p class="bd-undersat" data-testid="oversaturated-flag">
            Undersaturated. No cell of the time-space domain exceeds its capacity, so every period was analyzed on its own.
          </p>
        {/if}
      </section>

      <section class="bd-discussion" aria-label="Discussion">
        <Discussion sentences={discussionLines} />
      </section>

      <section class="bd-rel" aria-label="Reliability" data-testid="reliability-panel">
        <h2>Reliability</h2>
        <p class="bd-sub">
          Hands this same facility to the HCM Chapter 11 methodology as its seed file. The reliability engine builds its internal Chapter 10 facility from these same segments, so the derived segmentation, the overrides and any work zone are what the scenarios are generated against.
        </p>
        <div class="bd-fields">
          <label>Replications
            <input type="number" min="1" max="20" step="1" value={relInputs.replications}
                   data-testid="rel-replications"
                   onchange={(e) => setRelInput('replications', Number(e.currentTarget.value))} />
          </label>
          <label>Seed month
            <input type="number" min="1" max="12" step="1" value={relInputs.seedMonth}
                   onchange={(e) => setRelInput('seedMonth', Number(e.currentTarget.value))} />
          </label>
          <label>Seed weekday
            <select value={relInputs.seedWeekday} onchange={(e) => setRelInput('seedWeekday', e.currentTarget.value)}>
              <option>monday</option><option>tuesday</option><option>wednesday</option>
              <option>thursday</option><option>friday</option><option>saturday</option><option>sunday</option>
            </select>
          </label>
          <label>Random seed
            <input type="number" min="0" step="1" value={relInputs.rngSeed}
                   onchange={(e) => setRelInput('rngSeed', Number(e.currentTarget.value))} />
          </label>
          <label>Target speed (mi/h)
            <input type="number" min="10" max="70" step="1" value={relInputs.targetSpeed}
                   onchange={(e) => setRelInput('targetSpeed', Number(e.currentTarget.value))} />
          </label>
          <label class="bd-check-field">Incidents
            <input type="checkbox" checked={relInputs.includeIncidents}
                   onchange={(e) => setRelInput('includeIncidents', e.currentTarget.checked)} />
          </label>
          {#if relInputs.includeIncidents}
            <label>Crash rate (per 100M VMT)
              <input type="number" min="0" step="1" value={relInputs.crashRate}
                     onchange={(e) => setRelInput('crashRate', Number(e.currentTarget.value))} />
            </label>
            <label>Incident-to-crash ratio
              <input type="number" min="1" step="0.1" value={relInputs.incidentCrashRatio}
                     onchange={(e) => setRelInput('incidentCrashRatio', Number(e.currentTarget.value))} />
            </label>
          {/if}
        </div>
        <div class="bd-run-bar">
          <button type="button" class="btn btn-sm" onclick={runReliability}
                  disabled={reliabilityRunning} data-testid="run-reliability">
            {reliabilityRunning ? 'Running…' : 'Run reliability'}
          </button>
          <span class="bd-run-note">Scenario generation plus one Chapter 10 evaluation per scenario.</span>
        </div>

        {#if reliabilityError}
          <p class="bd-error" role="alert" data-testid="reliability-error">{reliabilityError}</p>
        {/if}

        {#if reliability}
          <div class="bd-figures" data-testid="reliability-summary">
            <div class="bd-fig">
              <span class="bd-fig-label">Mean TTI</span>
              <span class="bd-fig-value" data-testid="rel-tti-mean">{reliability.ttiMean.toFixed(3)}</span>
            </div>
            <div class="bd-fig">
              <span class="bd-fig-label">Median TTI</span>
              <span class="bd-fig-value" data-testid="rel-tti-50">{reliability.tti50.toFixed(3)}</span>
            </div>
            <div class="bd-fig">
              <span class="bd-fig-label">Planning time index (95th)</span>
              <span class="bd-fig-value" data-testid="rel-pti">{reliability.tti95.toFixed(3)}</span>
            </div>
            <div class="bd-fig">
              <span class="bd-fig-label">Reliability rating</span>
              <span class="bd-fig-value" data-testid="rel-rating">{reliability.reliabilityRating.toFixed(1)}</span>
              <span class="bd-fig-unit">%</span>
            </div>
          </div>
          <p class="bd-rel-meta">
            {reliability.numScenarios} scenarios over {reliability.numObservations} observations, free-flow travel time {reliability.fftt.toFixed(2)} min. {reliability.pctBelowTarget.toFixed(1)}% of travel runs below {reliability.targetSpeed} mi/h.
          </p>
          <Discussion sentences={relDiscussion} />
        {/if}

        <ul class="bd-rel-notes" data-testid="reliability-notes">
          {#each relNotes as note}
            <li class="bd-rel-note {note.level}" data-note-id={note.id}>{note.text}</li>
          {/each}
          <li class="bd-rel-note note">
            <a href="/hcm11">The Chapter 11 calculator</a> has a panel for each of those, and takes the same facility.
          </li>
        </ul>
      </section>
    {/if}
  </div>
</div>

<style>
  .builder { max-width: 1100px; margin: 0 auto; padding: 1rem 1rem 3rem; color: var(--text); }
  .bd-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .bd-head h1 { margin: 0 0 0.3rem; font-size: 1.5rem; }
  .bd-lede { margin: 0; font-size: 0.86rem; color: var(--text-secondary); max-width: 62ch; line-height: 1.5; }
  .bd-loading { font-size: 0.78rem; color: var(--text-muted); }

  .bd-bar { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; margin: 1rem 0 0.5rem; padding: 0.5rem 0.6rem; background: var(--surface-subtle); border: 1px solid var(--border); border-radius: 6px; }
  .bd-group { display: inline-flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
  .bd-group-label { font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  .btn.btn-sm { font-size: 0.76rem; padding: 0.18rem 0.55rem; border: 1px solid var(--border-strong); border-radius: 4px; background: var(--surface); color: var(--text); cursor: pointer; }
  .btn.btn-sm:disabled { opacity: 0.45; cursor: default; }
  .bd-file { display: none; }

  .bd-error { font-size: 0.8rem; color: var(--warn-text); background: var(--warn-bg); border: 1px solid var(--warn-border); border-radius: 4px; padding: 0.35rem 0.5rem; margin: 0.4rem 0; }
  .bd-message { font-size: 0.8rem; color: var(--ok-text); background: var(--ok-bg); border: 1px solid var(--ok-border); border-radius: 4px; padding: 0.35rem 0.5rem; margin: 0.4rem 0; }

  .bd-mainline h2, .bd-features h2 { font-size: 1rem; margin: 1rem 0 0.35rem; }
  .bd-sub { font-size: 0.76rem; color: var(--text-muted); margin: 0 0 0.35rem; max-width: 82ch; line-height: 1.5; }
  .bd-inline { font-size: 0.7rem; color: var(--text-muted); display: inline-flex; flex-direction: column; gap: 0.08rem; margin-right: 0.45rem; }
  .bd-inline.bd-check { flex-direction: row; align-items: center; gap: 0.2rem; }
  .bd-fields { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; }
  .bd-fields label { font-size: 0.75rem; color: var(--text-secondary); display: inline-flex; flex-direction: column; gap: 0.12rem; }

  .bd-strip-wrap { margin-top: 0.75rem; overflow-x: auto; }

  .bd-editor-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-top: 1rem; }
  .bd-editor-title { font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  /* Maximized is an overlay rather than a layout change, so the page underneath
     keeps its scroll position and the results are where they were when the
     editor is restored. It paints its own background because the page's is on
     an ancestor it now covers. */
  .bd-editor.maximized {
    position: fixed;
    inset: 0;
    z-index: 60;
    overflow: auto;
    padding: 0.75rem 1.25rem 2rem;
    background: var(--surface-page);
  }
  .bd-editor.maximized .bd-editor-bar { margin-top: 0; position: sticky; top: 0; background: inherit; padding: 0.4rem 0; z-index: 1; }

  .bd-disclose {
    display: inline-flex; align-items: center; gap: 0.3rem;
    background: none; border: none; padding: 0.1rem 0; margin: 0;
    color: var(--text); font: inherit; font-size: 0.8rem; cursor: pointer; text-align: left;
  }
  .bd-caret { display: inline-block; font-size: 0.7rem; color: var(--text-muted); transition: transform 120ms ease; }
  .bd-caret.open { transform: rotate(90deg); }
  .bd-feat-name { font-weight: 600; }
  .bd-summary { color: var(--text-secondary); white-space: normal; }
  .bd-num { font-variant-numeric: tabular-nums; }
  /* The detail row carries its own left rule from the editor component, so the
     cell adds only room; a border here would double it. */

  .bd-scroll { overflow-x: auto; }
  .bd-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .bd-table th, .bd-table td { padding: 0.2rem 0.4rem; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
  .bd-table thead th { color: var(--text-muted); font-weight: 600; font-size: 0.72rem; }
  .bd-table tr.selected > * { background: var(--accent-soft); }
  /* Table cells are nowrap so a row stays one line. The panel is prose and
     fields, so it wraps: without this its explanatory line sets the table's
     width and the sentence runs off the right edge of the scroll box. */
  .bd-detail > td { padding: 0 0 0 0.2rem; border-bottom: 1px solid var(--border); white-space: normal; }
  .bd-kind { font-size: 0.68rem; font-weight: 700; color: var(--text-muted); border: 1px solid var(--border-strong); border-radius: 3px; padding: 0 0.25rem; margin-right: 0.3rem; }
  .bd-kind.on { color: var(--accent); border-color: var(--accent); }
  .bd-label-input { width: 10ch; }
  .bd-dash { color: var(--text-faint); }
  .bd-remove { background: none; border: none; color: var(--accent); font-size: 0.72rem; cursor: pointer; text-decoration: underline; padding: 0; }

  input, select { font-size: 0.78rem; padding: 0.08rem 0.25rem; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 3px; }
  input[type='number'] { width: 8ch; }
  input[type='text'] { width: 18ch; }

  .bd-checks { margin-top: 1.25rem; }
  .bd-checks h3 { font-size: 1rem; margin: 0 0 0.35rem; }
  .bd-clean { font-size: 0.8rem; color: var(--text-muted); margin: 0; }
  .bd-flags { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .bd-flag { font-size: 0.78rem; line-height: 1.45; padding: 0.3rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); background: var(--surface-subtle); }
  .bd-flag.error { border-color: var(--warn-border); background: var(--warn-bg); }
  .bd-flag.warn { border-color: var(--warn-border); }
  .bd-flag-level { display: inline-block; font-weight: 700; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); margin-right: 0.4rem; }
  .bd-flag.error .bd-flag-level, .bd-flag.warn .bd-flag-level { color: var(--warn-text); }
  .bd-flag-msg { color: var(--text); }
  .bd-flag-cite { display: block; color: var(--text-faint); font-size: 0.7rem; margin-top: 0.1rem; }
  .bd-uncarried { font-size: 0.74rem; color: var(--text-muted); margin: 0.75rem 0 0; line-height: 1.5; max-width: 78ch; }

  .bd-run { margin-top: 1.25rem; padding-top: 0.9rem; border-top: 1px solid var(--border); }
  .bd-run-bar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  .bd-run-note { font-size: 0.74rem; color: var(--text-muted); }
  .btn.btn-primary { font-size: 0.84rem; font-weight: 600; padding: 0.3rem 0.9rem; border: 1px solid var(--accent-strong); border-radius: 4px; background: var(--accent); color: #fff; cursor: pointer; }
  .btn.btn-primary:disabled { opacity: 0.45; cursor: default; }
  .bd-stale { font-size: 0.78rem; color: var(--warn-text); background: var(--warn-bg); border: 1px solid var(--warn-border); border-radius: 4px; padding: 0.35rem 0.5rem; margin: 0.5rem 0 0; line-height: 1.45; max-width: 84ch; }

  .bd-summary { margin-top: 1.25rem; }
  .bd-summary h2, .bd-rel h2 { font-size: 1rem; margin: 0 0 0.35rem; }
  .bd-figures { display: flex; flex-wrap: wrap; gap: 0.4rem 1.6rem; margin: 0.5rem 0 0.7rem; }
  .bd-fig { display: flex; flex-direction: column; gap: 0.05rem; }
  .bd-fig-label { font-size: 0.68rem; color: var(--text-muted); }
  .bd-fig-value { font-size: 1.3rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .bd-fig-unit { font-size: 0.68rem; color: var(--text-muted); }
  /* Sized to its content rather than to the page: at 100% the five period
     columns were pushed to the far right, away from the labels they belong to. */
  .bd-perperiod { width: auto; }
  .bd-perperiod th[scope='col']:not(:first-child), .bd-perperiod td { min-width: 4.5rem; text-align: right; }
  .bd-perperiod td { font-variant-numeric: tabular-nums; }
  .bd-perperiod td.bd-los { font-weight: 700; }
  .bd-oversat, .bd-undersat { font-size: 0.8rem; line-height: 1.5; margin: 0.6rem 0 0; max-width: 88ch; }
  .bd-oversat { color: var(--warn-text); }
  .bd-undersat { color: var(--text-secondary); }

  .bd-discussion { margin-top: 1rem; }

  .bd-rel { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border); }
  .bd-check-field { flex-direction: row !important; align-items: center; gap: 0.3rem !important; }
  .bd-rel-meta { font-size: 0.78rem; color: var(--text-secondary); margin: 0 0 0.5rem; line-height: 1.5; }
  .bd-rel-notes { list-style: none; padding: 0; margin: 0.75rem 0 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .bd-rel-note { font-size: 0.76rem; line-height: 1.5; color: var(--text-muted); border-left: 2px solid var(--border-strong); padding-left: 0.5rem; max-width: 92ch; }
  .bd-rel-note.warn { color: var(--warn-text); border-left-color: var(--warn-border); }
  .bd-rel-note.ok { color: var(--text-secondary); border-left-color: var(--ok-border); }
  /* The global anchor rules give a bare link a heading size, which made this
     one read as a section title rather than as part of the sentence. */
  .bd-rel-note a { color: var(--accent); font-size: inherit; font-weight: inherit; }
</style>
