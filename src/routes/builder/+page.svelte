<script>
  // The facility builder, phase 1a: the chassis and the freeway editor, with no
  // analysis. The user describes the road as an engineer knows it — a mainline
  // with ramps at stations — and the builder does Chapter 10's segmentation
  // homework and shows its work.
  //
  // The seam this phase leaves for the analysis phase is exactly one object:
  // `toFixture(doc, rows)` returns the facility in the library's own serde
  // schema, which is what WasmFreewayFacility takes. Nothing in the editor
  // knows what an LOS is.
  //
  // The derivation itself is not here and not in JS anywhere: it calls
  // `segment_ramp_section` in the library through crosstraffic_middleware, per
  // the house rule that a second implementation is how drift starts.

  import { onMount } from 'svelte';
  import init, { segment_ramp_section, ramp_influence_area_ft } from 'HCM-middleware';

  import BuilderStrip from '$lib/builder/BuilderStrip.svelte';
  import SegmentTable from '$lib/builder/SegmentTable.svelte';
  import DemandGrid from '$lib/builder/DemandGrid.svelte';
  import { emptyDocument, makeFeature, migrate, setPeriods, FT_PER_MI } from '$lib/builder/document.js';
  import { deriveRows } from '$lib/builder/derive.js';
  import { validateFacility } from '$lib/builder/validate.js';
  import { fromFixture, toFixture, UNCARRIED_FIELDS } from '$lib/builder/fixture.js';
  import { TEMPLATES, applyTemplate } from '$lib/builder/templates.js';
  import { EXAMPLES, loadExample } from '$lib/builder/examples.js';
  import { createHistory, parseSnapshot } from '$lib/builder/history.js';
  import { saveSlot, loadSlot, downloadJson, readJsonFile } from '$lib/builder/storage.js';

  const SLOT = 'default';

  let ready = $state(false);
  let doc = $state(emptyDocument());
  let selectedKey = $state(null);
  let selectedFeature = $state(null);
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

  function moveFeature(id, stationFt, phase) {
    // The final position of a drag coalesces into the same undo step as the
    // moves that led to it. Committing it under a null key instead would make
    // every drag two steps, and the first undo would land the ramp one
    // pointermove short of where the user let go.
    commit((d) => {
      const f = d.features.find((x) => x.id === id);
      if (f) f.stationFt = Math.round(stationFt);
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

  const slug = (s) => (s || 'facility').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const LEVEL_LABEL = { error: 'Blocks analysis', warn: 'Check this', note: 'Note' };
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

    <section class="bd-strip-wrap" aria-label="Facility strip">
      <BuilderStrip {doc} {rows} {selectedKey} {highlightIds} interactive={ready}
                    onselectrow={(k) => { selectedKey = selectedKey === k ? null : k; selectedFeature = null; }}
                    onselectfeature={(id) => { selectedFeature = id; selectedKey = null; }}
                    onmovefeature={moveFeature} />
    </section>

    {#if doc.features.length}
      <section class="bd-features" aria-label="Features">
        <h2>Features</h2>
        <div class="bd-scroll">
          <table class="bd-table" data-testid="feature-table">
            <thead>
              <tr>
                <th scope="col">Ramp</th><th scope="col">Station (mi)</th><th scope="col">Ramp FFS</th>
                <th scope="col">Accel / decel (ft)</th><th scope="col">Aux lane to next</th><th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {#each [...doc.features].sort((a, b) => a.stationFt - b.stationFt) as f (f.id)}
                <tr class:selected={selectedFeature === f.id} data-testid="feature-row" data-feature-id={f.id}>
                  <th scope="row">
                    <span class="bd-kind" class:on={f.kind === 'on_ramp'}>{f.kind === 'on_ramp' ? 'On' : 'Off'}</span>
                    <input type="text" class="bd-label-input" value={f.label} placeholder={f.id}
                           onchange={(e) => setFeature(f.id, 'label', e.currentTarget.value)}
                           aria-label="label for {f.id}" />
                  </th>
                  <td>
                    <input type="number" min="0" step="0.01" value={(f.stationFt / FT_PER_MI).toFixed(2)}
                           data-testid="station-{f.id}"
                           onchange={(e) => setFeature(f.id, 'stationFt', Math.round(Number(e.currentTarget.value) * FT_PER_MI))}
                           aria-label="station of {f.id} in miles" />
                  </td>
                  <td><input type="number" min="15" max="70" step="1" value={f.rampFfs} onchange={(e) => setFeature(f.id, 'rampFfs', Number(e.currentTarget.value))} aria-label="ramp free-flow speed for {f.id}" /></td>
                  <td>
                    {#if f.kind === 'on_ramp'}
                      <input type="number" min="0" step="10" value={f.accelLaneFt} onchange={(e) => setFeature(f.id, 'accelLaneFt', Number(e.currentTarget.value))} aria-label="acceleration lane length for {f.id}" />
                    {:else}
                      <input type="number" min="0" step="10" value={f.decelLaneFt} onchange={(e) => setFeature(f.id, 'decelLaneFt', Number(e.currentTarget.value))} aria-label="deceleration lane length for {f.id}" />
                    {/if}
                  </td>
                  <td>
                    {#if f.kind === 'on_ramp'}
                      <input type="checkbox" checked={f.auxLaneToNext} data-testid="aux-{f.id}"
                             onchange={(e) => setFeature(f.id, 'auxLaneToNext', e.currentTarget.checked)}
                             aria-label="auxiliary lane from {f.id} to the next off-ramp" />
                    {:else}<span class="bd-dash">—</span>{/if}
                  </td>
                  <td><button type="button" class="bd-remove" onclick={() => removeFeature(f.id)} data-testid="remove-{f.id}">remove</button></td>
                </tr>
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
  .bd-fields { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; }
  .bd-fields label { font-size: 0.75rem; color: var(--text-secondary); display: inline-flex; flex-direction: column; gap: 0.12rem; }

  .bd-strip-wrap { margin-top: 0.75rem; overflow-x: auto; }

  .bd-scroll { overflow-x: auto; }
  .bd-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .bd-table th, .bd-table td { padding: 0.2rem 0.4rem; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
  .bd-table thead th { color: var(--text-muted); font-weight: 600; font-size: 0.72rem; }
  .bd-table tr.selected > * { background: var(--accent-soft); }
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
</style>
