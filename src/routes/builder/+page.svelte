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
    WasmFreewayReliability,
    WasmUrbanFacility,
    WasmUrbanReliability,
    WasmSegment,
    WasmSubSegment,
    WasmTwoLaneHighways
  } from 'HCM-middleware';

  import BuilderStrip from '$lib/builder/BuilderStrip.svelte';
  import FeatureEditor from '$lib/builder/FeatureEditor.svelte';
  import UrbanFeatureEditor from '$lib/builder/UrbanFeatureEditor.svelte';
  import SegmentTable from '$lib/builder/SegmentTable.svelte';
  import DemandGrid from '$lib/builder/DemandGrid.svelte';
  import Heatmap from '$lib/builder/Heatmap.svelte';
  import UrbanResultStrip from '$lib/builder/UrbanResultStrip.svelte';
  import TwoLaneFeatureEditor from '$lib/builder/TwoLaneFeatureEditor.svelte';
  import TwoLaneResultStrip from '$lib/builder/TwoLaneResultStrip.svelte';
  import Discussion from '$lib/Discussion.svelte';
  import { emptyDocument, makeFeature, migrate, setPeriods, FT_PER_MI, isRamp, defaultAccessApproach } from '$lib/builder/document.js';
  import { deriveRows } from '$lib/builder/derive.js';
  import { validateFacility } from '$lib/builder/validate.js';
  import {
    fromFixture,
    fromUrbanFixture,
    fromTwoLaneFixture,
    toFixture,
    UNCARRIED_FIELDS,
    URBAN_UNCARRIED_FIELDS,
    TWOLANE_UNCARRIED_FIELDS
  } from '$lib/builder/fixture.js';
  import { TEMPLATES, applyTemplate } from '$lib/builder/templates.js';
  import { EXAMPLES, loadExample } from '$lib/builder/examples.js';
  import { URBAN_EXAMPLES, loadUrbanExample } from '$lib/builder/urbanExamples.js';
  import { TWOLANE_EXAMPLES, loadTwoLaneExample } from '$lib/builder/twoLaneExamples.js';
  import { createHistory, parseSnapshot } from '$lib/builder/history.js';
  import { saveSlot, loadSlot, downloadJson, readJsonFile } from '$lib/builder/storage.js';
  import { analyzeFacility } from '$lib/builder/analyze.js';
  import { analyzeUrbanFacility } from '$lib/builder/urbanAnalyze.js';
  import { analyzeTwoLaneFacility } from '$lib/builder/twoLaneAnalyze.js';
  import { analyzeReliability, defaultReliabilityInputs, handoffNotes } from '$lib/builder/reliability.js';
  import {
    analyzeUrbanReliability,
    defaultUrbanReliabilityInputs,
    defaultUrbanWeather,
    urbanHandoffNotes
  } from '$lib/builder/urbanReliability.js';
  import { discussion, reliabilityDiscussion } from '$lib/builder/discussion.js';
  import { urbanDiscussion, urbanReliabilityDiscussion } from '$lib/builder/urbanDiscussion.js';
  import { twoLaneDiscussion } from '$lib/builder/twoLaneDiscussion.js';
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

  // The one branch the whole page turns on. The urban derivation is structural
  // and calls no engine function, so `api` gates it only because the analysis
  // below it needs the module loaded either way.
  let isUrban = $derived(doc.facilityType === 'urban');
  // The two-lane derivation is structural too, and Chapter 15 is the one of the
  // three chapters with no reliability methodology at all, which is the second
  // thing this flag gates.
  let isTwoLane = $derived(doc.facilityType === 'twolane');
  let examples = $derived(isUrban ? URBAN_EXAMPLES : isTwoLane ? TWOLANE_EXAMPLES : EXAMPLES);
  let uncarried = $derived(isUrban ? URBAN_UNCARRIED_FIELDS : isTwoLane ? TWOLANE_UNCARRIED_FIELDS : UNCARRIED_FIELDS);
  let stripMode = $derived(isUrban ? 'urban' : isTwoLane ? 'twolane' : 'freeway');

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
  let urbanRelInputs = $state(defaultUrbanReliabilityInputs());
  const urbanWeather = defaultUrbanWeather();
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
  let relNotes = $derived(
    !api || isTwoLane ? [] : isUrban ? urbanHandoffNotes(doc, rows) : handoffNotes(doc, rows)
  );

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

  /** A signal's Chapter 18 inputs for the segment ending at it. Separate from
   * `setWorkZone` despite both writing into `config`, because a work zone's
   * config is the engine's `WorkZone` struct and a signal's is this builder's
   * own shape. */
  function setSignalConfig(id, field, value) {
    commit((d) => {
      const f = d.features.find((x) => x.id === id);
      if (f?.config) f.config[field] = value;
    });
  }

  function setMeasure(id, field, value) {
    commit((d) => {
      const f = d.features.find((x) => x.id === id);
      if (!f) return;
      f.measures = { ...(f.measures ?? {}), [field]: value };
    });
  }

  /** Turning the computed access-point branch on installs a whole approach
   * rather than an empty object, because an approach of zeros is a valid input
   * the Chapter 30 Section 4 procedure will happily run to a delay of zero. The
   * published Example Problem 1 approach is the one shape certain to analyze. */
  function setApproach(id, field, value) {
    commit((d) => {
      const f = d.features.find((x) => x.id === id);
      if (!f?.approach) return;
      f.approach[field] = value;
    });
  }

  function setUrbanFeature(id, field, value) {
    commit((d) => {
      const f = d.features.find((x) => x.id === id);
      if (!f) return;
      if (field === 'approach') {
        f.approach = value === 'enable' ? defaultAccessApproach() : null;
        return;
      }
      f[field] = value;
    });
  }

  /** A two-lane demand change's own conditions. Separate from `setSignalConfig`
   * despite both writing into `config`, because the two shapes share no field
   * and a single setter would accept either key on either kind. */
  function setDemandConfig(id, field, value) {
    commit((d) => {
      const f = d.features.find((x) => x.id === id);
      if (f?.config) f.config[field] = value;
    });
  }

  function setAnalysisMode(mode) {
    commit((d) => {
      d.analysisMode = mode;
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
      // feature itself and not of where it happens to sit. Work zones, grades,
      // passing features and curves all take this path, and the two-lane editor
      // routes its station field through here for the same reason.
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
      } else if (isTwoLaneFixture(raw)) {
        // A Chapter 15 fixture is invertible too, and for a longer list of
        // reasons than the urban one: it states the passing type, the grade and
        // its class, the demand and its factors, and the subsegments a curve
        // produced, all per segment. So every feature comes back.
        replaceDoc(
          fromTwoLaneFixture(raw, file.name),
          `Imported ${file.name} as a two-lane highway. The passing features, grades, demand changes and horizontal curves were all recovered from the segment table, so it is editable as features.`
        );
      } else if (isUrbanFixture(raw)) {
        // An urban fixture is invertible, unlike a freeway one, so this import
        // recovers the boundary signals rather than arriving as a bare segment
        // list. The message says so, because the two imports behave differently
        // and the difference is not something to discover by poking at it.
        replaceDoc(
          fromUrbanFixture(raw, file.name),
          `Imported ${file.name} as an urban street. The boundary signals were recovered from the segment lengths, so it is editable as features.`
        );
      } else {
        replaceDoc(fromFixture(raw, file.name), `Imported ${file.name} as a fixture. It arrived as segments with no feature layer.`);
      }
    } catch (err) {
      error = String(err.message ?? err);
    }
  }

  function newFacility(type = doc.facilityType) {
    replaceDoc(
      emptyDocument(type),
      type === 'urban'
        ? 'Started an empty urban street. Place a boundary signal at each end, because a Chapter 18 segment runs between two of them.'
        : type === 'twolane'
          ? 'Started an empty two-lane highway. It is already one Passing Constrained segment and already analyzes, because that is what a two-lane highway with no passing feature on it is. Place grades, passing features and curves where they are.'
          : 'Started an empty facility.'
    );
  }

  function openExample(id) {
    if (isUrban) {
      replaceDoc(
        loadUrbanExample(id),
        `Loaded ${URBAN_EXAMPLES.find((e) => e.id === id).name} as placed boundary signals, not as a segment table.`
      );
      return;
    }
    if (isTwoLane) {
      const ex = TWOLANE_EXAMPLES.find((e) => e.id === id);
      replaceDoc(
        loadTwoLaneExample(id),
        `Loaded ${ex.name} as placed grades, passing features and curves, not as a segment table.${ex.build().features.length === 0 ? ' This one places no features at all, because a level Passing Constrained highway is exactly a highway and nothing else.' : ''}`
      );
      return;
    }
    replaceDoc(loadExample(id), `Loaded ${EXAMPLES.find((e) => e.id === id).name} as placed ramps, not as a segment table.`);
  }

  // ── Analysis ────────────────────────────────────────────────────

  const wasm = {
    WasmFacilitySegment,
    WasmFreewayFacility,
    WasmFreewayReliability,
    WasmUrbanFacility,
    WasmUrbanReliability,
    // Chapter 15's three. `WasmSegment` and `WasmSubSegment` are the only
    // constructors on this page whose instances the facility CONSUMES, so
    // twoLaneAnalyze rebuilds them per run rather than holding any.
    WasmSegment,
    WasmSubSegment,
    WasmTwoLaneHighways
  };

  /** Which schema a dropped JSON file is. The two fixture shapes are told apart
   * by the field that only one of them has on its segments, rather than by the
   * facility keys, because a freeway fixture and an urban one both have a
   * `segments` array and neither names its own chapter. */
  /** A Chapter 15 fixture, told apart from the other two by the facility-level
   * keys rather than by a segment field, because its segments carry `length` and
   * `grade`, which are common enough words to collide. `apd` and `pmhvfl` appear
   * in no other schema. */
  function isTwoLaneFixture(raw) {
    if (!raw?.segments?.length) return false;
    return raw.apd != null || raw.pmhvfl != null || raw.segments[0]?.passing_type != null;
  }

  function isUrbanFixture(raw) {
    const s = raw?.segments?.[0];
    return !!s && (s.segment_length_ft != null || s.n_through_lanes != null || s.control != null);
  }

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
      const run = isUrban
        ? analyzeUrbanFacility(doc, rows, wasm)
        : isTwoLane
          ? analyzeTwoLaneFacility(doc, rows, wasm)
          : analyzeFacility(doc, rows, wasm);
      results = run;
      // Generated once, off the run that produced these numbers, so the page
      // and the printable report can never drift apart or restate a
      // since-edited input.
      discussionLines = isUrban ? urbanDiscussion(run) : isTwoLane ? twoLaneDiscussion(run) : discussion(run);
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
      if (isUrban) {
        reliability = analyzeUrbanReliability(doc, rows, urbanRelInputs, urbanWeather, wasm, withWasmRetry);
        relDiscussion = urbanReliabilityDiscussion(reliability, results);
      } else {
        reliability = analyzeReliability(doc, rows, relInputs, wasm, withWasmRetry);
        relDiscussion = reliabilityDiscussion(reliability, results);
      }
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
    if (isUrban) {
      publishUrbanReport(run);
      return;
    }
    if (isTwoLane) {
      publishTwoLaneReport(run);
      return;
    }
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

  /**
   * The urban street's report, published off the frozen run for the same reason
   * the freeway one is: the printed page and the screen cannot disagree even
   * after an edit.
   *
   * The result table is one row per segment rather than one per period, because
   * the Chapter 16 and 18 engines are single-period. The `matrixTable` the
   * freeway report carries has no urban counterpart for the same reason, and it
   * is left off rather than filled with a one-column grid that would imply an
   * axis the method does not have.
   */
  function publishUrbanReport(run) {
    const m = doc.mainline;
    setReport({
      chapter: `Facility Builder — ${run.facilityName}`,
      chapterRef: 'HCM Chapter 16',
      href: '/builder',
      generatedAt: new Date().toLocaleString(),
      headline: { label: 'Facility LOS', value: run.los },
      discussion: [...discussionLines, ...relDiscussion],
      inputs: [
        { label: 'Facility length', value: `${(run.lengthFt / FT_PER_MI).toFixed(2)} mi` },
        { label: 'Direction', value: m.direction },
        { label: 'Through lanes', value: m.lanes },
        { label: 'Posted speed limit', value: `${m.speedLimitMph} mi/h` },
        { label: 'Left-turn lane proportion', value: m.propLeftTurnLanes },
        { label: 'Proportion with curb', value: m.proportionWithCurb },
        { label: 'On-street parking proportion', value: m.proportionOnStreetParking },
        { label: 'Restrictive median length', value: `${m.restrictiveMedianLengthFt} ft` },
        { label: 'Boundary signals', value: doc.features.filter((f) => f.kind === 'signal').length },
        { label: 'Access points', value: doc.features.filter((f) => f.kind === 'access_point').length },
        {
          label: 'Segment description',
          value:
            run.mode === 'measures'
              ? 'Published Chapter 18 measures, aggregated by Chapter 16 (Exhibit 16-7 "HCM method output")'
              : 'Chapter 18 inputs, evaluated per segment and then aggregated'
        },
        {
          label: 'Derived segments (upstream to downstream)',
          value: run.segments.map((s) => `${Math.round(s.lengthFt)} ft x${s.lanes}`).join(', ')
        }
      ],
      resultTable: {
        columns: ['Segment', 'Length (ft)', 'Base FFS (mi/h)', 'Travel speed (mi/h)', 'Stop rate (stops/mi)', 'Through v/c', 'LOS'],
        rows: run.segments.map((s) => [
          `${s.index + 1}`,
          `${Math.round(s.lengthFt)}`,
          n2(s.baseFfs),
          n2(s.travelSpeed),
          n2(s.spatialStopRate),
          n3(s.vcRatio),
          s.los ?? '–'
        ])
      },
      summary: [
        { label: 'Facility LOS', value: run.los },
        { label: 'Poorest-performing segment LOS', value: run.poorestSegmentLos },
        { label: 'Facility base free-flow speed', value: `${n2(run.baseFfs)} mi/h` },
        { label: 'Facility travel speed', value: `${n2(run.travelSpeed)} mi/h` },
        { label: 'Facility spatial stop rate', value: `${n2(run.spatialStopRate)} stops/mi` },
        { label: 'Critical through v/c ratio', value: n3(run.criticalVcRatio) },
        { label: 'Traveler perception score', value: n2(run.perceptionScore) },
        ...(reliability
          ? [
              { label: 'Mean travel time index', value: n3(reliability.ttiMean) },
              { label: 'Median travel time index', value: n3(reliability.tti50) },
              { label: 'Planning time index (95th percentile)', value: n3(reliability.tti95) },
              { label: 'Reliability rating', value: `${n1(reliability.reliabilityRating)} %` }
            ]
          : [])
      ],
      methodology: [
        run.mode === 'measures'
          ? 'HCM Chapter 16 Steps 1 through 4, aggregating published Chapter 18 performance measures over the segments the boundary signals derived. This is the Exhibit 16-7 "HCM method output" path, which the published example problems take. The Chapter 18 engine is not re-run, because there are no Chapter 18 inputs behind the supplied measures to recompute from.'
          : 'HCM Chapter 18 evaluated per segment and then aggregated by Chapter 16 (Equations 16-2 through 16-4 and the Exhibit 16-3 level of service), over the segment table the Chapter 18 segment definition derived from the placed boundary signals. Each segment runs from one boundary intersection to the next and takes its through control delay, cycle length and effective green from the intersection at its downstream end.',
        'The Chapter 16 and 18 methods are single-period. There is one value per segment rather than a time-space domain, and the reliability run below is where variation over time is described.',
        ...(run.mode === 'inputs'
          ? [
              `Access-point delay (Equation 18-7) came from ${describeApSources(run)}.`
            ]
          : []),
        ...(reliability
          ? [
              `HCM Chapter 17 reliability run over ${reliability.numScenarios.toLocaleString('en-US')} scenarios. The reliability engine takes a strict subset of what a Chapter 18 segment holds, so the capacity, control delay, cross-section geometry and access-point delay of the facility above do not cross into it; the handoff panel on the builder names each one.`
            ]
          : [])
      ]
    });
  }

  /**
   * The two-lane highway's report, published off the frozen run like the other
   * two.
   *
   * There is no `matrixTable` and no reliability block, and both absences are
   * the chapter rather than an omission. Chapter 15 is single-period, so a
   * time-space domain would be a one-row grid implying an axis the method does
   * not have; and Chapter 15 has no reliability methodology, so there is nothing
   * to hand the facility to. The methodology list says so rather than leaving a
   * reader to wonder.
   */
  function publishTwoLaneReport(run) {
    const m = doc.mainline;
    const pl = run.segments.filter((sg) => sg.passingType === 2).map((sg) => sg.index + 1);
    const curved = run.segments.filter((sg) => sg.isHc);
    setReport({
      chapter: `Facility Builder — ${run.facilityName}`,
      chapterRef: 'HCM Chapter 15',
      href: '/builder',
      generatedAt: new Date().toLocaleString(),
      headline: { label: 'Facility LOS', value: run.los },
      discussion: [...discussionLines],
      inputs: [
        { label: 'Facility length', value: `${(run.lengthFt / FT_PER_MI).toFixed(2)} mi` },
        { label: 'Direction', value: m.direction },
        { label: 'Posted speed limit', value: `${m.speedLimitMph} mi/h` },
        { label: 'Lane width', value: `${m.laneWidthFt} ft` },
        { label: 'Shoulder width', value: `${m.shoulderWidthFt} ft` },
        { label: 'Access point density', value: `${m.accessPointDensity} /mi` },
        { label: 'Heavy vehicles in passing lane', value: `${m.pctHeavyVehInPassingLane} %` },
        { label: 'Entering demand', value: `${m.demand[0]} veh/h` },
        { label: 'Peak hour factor', value: m.phf },
        { label: 'Heavy vehicles', value: `${m.heavyVehiclePct} %` },
        {
          label: 'Derived segments (in the analysis direction)',
          value: run.segments.map((sg) => `${sg.segType} ${sg.lengthMi.toFixed(2)} mi`).join(', ')
        },
        ...(pl.length ? [{ label: 'Passing lane segments', value: pl.join(', ') }] : []),
        ...(curved.length
          ? [
              {
                label: 'Horizontal curves',
                value: `${curved.reduce((a, sg) => a + sg.curveCount, 0)} in segments ${curved.map((sg) => sg.index + 1).join(', ')}, as Step 5d subsegments`
              }
            ]
          : [])
      ],
      resultTable: {
        columns: [
          'Segment',
          'Type',
          'Length (mi)',
          'FFS (mi/h)',
          'Average speed (mi/h)',
          'Percent followers (%)',
          'Follower density (followers/mi)',
          'LOS'
        ],
        rows: run.segments.map((sg) => [
          `${sg.index + 1}`,
          sg.segType,
          sg.lengthMi.toFixed(2),
          n2(sg.ffs),
          n1(sg.avgSpeed),
          n1(sg.percentFollowers),
          n2(sg.followerDensity),
          sg.los ?? '–'
        ])
      },
      summary: [
        { label: 'Facility LOS', value: run.los },
        { label: 'Facility follower density', value: `${n3(run.facilityFd)} followers/mi` },
        { label: 'Length-weighted posted speed limit', value: `${n1(run.weightedSpl)} mi/h` }
      ],
      methodology: [
        'HCM 7th Edition Chapter 15 (Two-Lane Highways), Steps 1 through 11, run on the segment table the Chapter 15 Section 2 segmentation rules derived from the placed grade, passing and demand features. A segment runs between the stations where the ability to pass, the grade, the demand or the posted speed limit changes.',
        'Service measure: follower density (followers/mi). The facility value is length-weighted across the segments by Equation 15-39, taking each segment\'s adjusted follower density where it has one and a passing lane\'s midpoint value.',
        'Level of service comes from Exhibit 15-6, whose bands differ above and below a 50 mi/h POSTED speed limit. The facility letter is read against the length-weighted posted limit rather than against the speed achieved.',
        ...(curved.length
          ? [
              'Horizontal curves are subsegments of the segment containing them rather than segments of their own (Step 5d), and their lengths are in feet where a segment length is in miles. Each subsegment speed is weighted by its share of the segment.'
            ]
          : []),
        ...(pl.length
          ? [
              'A passing lane segment reports its midpoint follower density, and the segments downstream of it carry the Step 9 adjusted follower density for as far as the passing lane\'s effective length reaches. Only the closest upstream passing lane is considered.'
            ]
          : []),
        'Chapter 15 has no travel time reliability methodology, so unlike a Chapter 10 freeway facility or a Chapter 16 urban street facility there is no reliability run to report beside this one.'
      ]
    });
  }

  function describeApSources(run) {
    const set = new Set(run.segments.map((s) => s.apDelaySource).filter(Boolean));
    const LABEL = {
      published: 'per-point delays supplied on the access points',
      computed: 'the Chapter 30 Section 4 computed procedure',
      planning: 'the Exhibit 18-13 planning estimate'
    };
    return [...set].map((s) => LABEL[s] ?? s).join(', ');
  }

  const n2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '–');
  const n3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '–');

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
  /** The collapsed row's one line. For a signal that is the timing the segment
   * ending at it reads; for an access point it is which of the three Equation
   * 18-7 sources it supplies, since that is the thing most worth seeing without
   * opening the panel. */
  const urbanSummary = (f) => {
    if (f.kind === 'signal') {
      const c = f.config ?? {};
      const timing = c.control === 'Signalized' ? `C ${c.cycle_length_s ?? '–'} s · g ${c.effective_green_s ?? '–'} s` : String(c.control ?? '');
      return `${timing}${c.speed_limit_mph ? ` · ${c.speed_limit_mph} mi/h` : ''}${f.inferred ? ' · timing inferred on import' : ''}`;
    }
    if (f.side === 'opposing') return 'Opposing side, counted for f_A only';
    if (f.delayS != null) return `${f.delayS} s/veh supplied`;
    if (f.approach) return 'Chapter 30 Section 4, computed from the approach';
    return 'Exhibit 18-13 planning estimate';
  };

  /** The chip on a collapsed two-lane row, and its one line. Which of the four
   * kinds it is matters more here than on the other two facility types, because
   * one of the four does not bound a segment and a reader has to be able to tell
   * that at a glance. */
  const TL_KIND_CHIP = {
    passing: (f) => (f.passingType === 2 ? 'PL' : 'PZ'),
    grade: (f) => (f.gradePct < 0 ? 'Down' : 'Up'),
    curve: () => 'Curve',
    demand: () => 'Demand'
  };

  const twoLaneSummary = (f) => {
    if (f.kind === 'passing') {
      const lengthMi = (f.endFt - f.stationFt) / FT_PER_MI;
      const short = f.passingType === 2 && lengthMi < 0.5 - 1e-9;
      return `${f.passingType === 2 ? 'Passing lane' : 'Passing zone'}, ${lengthMi.toFixed(2)} mi${short ? ' \u00b7 under the 0.5 mi Exhibit 15-10 minimum, so analyzed as Passing Constrained' : ''}`;
    }
    if (f.kind === 'grade') return `${f.gradePct > 0 ? '+' : ''}${f.gradePct}% \u00b7 vertical class ${f.verticalClass}`;
    if (f.kind === 'curve') {
      return `${Math.round(f.endFt - f.stationFt)} ft \u00b7 R ${Math.round(f.designRadiusFt)} ft \u00b7 e ${f.superelevationPct}% \u00b7 a subsegment, not a segment`;
    }
    const c = f.config ?? {};
    return `${Math.round(c.volume ?? 0)} veh/h \u00b7 PHF ${c.phf} \u00b7 ${c.heavyVehiclePct}% HV${c.opposingVolume ? ` \u00b7 opposing ${Math.round(c.opposingVolume)} veh/h` : ''}${c.speedLimitMph ? ` \u00b7 ${c.speedLimitMph} mi/h` : ''}`;
  };

  const changeSummary = (f) =>
    f.kind === 'lane_change'
      ? `to ${f.lanes} lanes`
      : `${f.config.total_lanes} lanes to ${f.config.open_lanes}, ${f.config.soft_barrier ? 'cones/drums' : 'hard barrier'}, ${f.config.speed_limit_mi_h} mi/h`;
</script>

<svelte:head>
  <title>Facility Builder — HCM Calculator</title>
  <meta name="description" content="Build an HCM freeway, urban street or two-lane highway facility by placing the features an engineer knows, and let each chapter's own segmentation rules derive the segment table." />
</svelte:head>

<svelte:window on:keydown={onKey} />

<div class="builder">
  <header class="bd-head">
    <div>
      <h1>Facility Builder</h1>
      <p class="bd-lede">
        {#if isUrban}
          Place boundary signals along a street and the Chapter 18 segment definition derives the analysis segments: a segment runs from one boundary intersection to the next, and reads its timing from the one at its downstream end. Access points attach to the segment that contains them.
        {:else if isTwoLane}
          Place grades, passing lanes and zones, horizontal curves and demand changes along a highway and the Chapter 15 segmentation rules derive the analysis segments. A segment breaks where the ability to pass, the grade, the demand or the posted limit changes, all of which Section 2 asks to be homogeneous within one. A curve is the exception and breaks nothing: Step 1 sends varying curvature to the Step 5d subsegment adjustment inside a single segment.
        {:else}
          Place ramps along a mainline and the HCM Chapter 10 segmentation rules derive the analysis segments. The derivation calls the library's own <code>segment_ramp_section</code>, so the table here and the table the engines analyze cannot disagree.
        {/if}
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
        <span class="bd-group-label">Type</span>
        <!-- Changing the facility type starts a new document rather than
             converting the current one. A freeway's ramps have no urban
             counterpart and an urban street's signal timing has no freeway one,
             so a conversion would silently drop most of the document. The
             selector says "new" for that reason, and undo still reaches back
             past it. -->
        <select value={doc.facilityType} disabled={!ready} data-testid="facility-type"
                onchange={(e) => newFacility(e.currentTarget.value)}>
          <option value="freeway">Freeway (Ch 10/11)</option>
          <option value="urban">Urban street (Ch 16/17/18)</option>
          <option value="twolane">Two-lane highway (Ch 15)</option>
        </select>
      </div>
      <div class="bd-group">
        <button type="button" class="btn btn-sm" onclick={() => newFacility()} data-testid="new-facility">New</button>
        <button type="button" class="btn btn-sm" onclick={undo} disabled={!canUndo} data-testid="undo">Undo</button>
        <button type="button" class="btn btn-sm" onclick={redo} disabled={!canRedo} data-testid="redo">Redo</button>
      </div>
      <div class="bd-group">
        <span class="bd-group-label">Add</span>
        {#if isUrban}
          <button type="button" class="btn btn-sm" onclick={() => addFeature('signal')} data-testid="add-signal">Boundary signal</button>
          <button type="button" class="btn btn-sm" onclick={() => addFeature('access_point')} data-testid="add-access-point">Access point</button>
        {:else if isTwoLane}
          <button type="button" class="btn btn-sm" onclick={() => addFeature('grade')} data-testid="add-grade">Grade</button>
          <button type="button" class="btn btn-sm" onclick={() => addFeature('passing')} data-testid="add-passing">Passing lane or zone</button>
          <button type="button" class="btn btn-sm" onclick={() => addFeature('curve')} data-testid="add-curve">Horizontal curve</button>
          <button type="button" class="btn btn-sm" onclick={() => addFeature('demand')} data-testid="add-demand">Demand change</button>
        {:else}
          <button type="button" class="btn btn-sm" onclick={() => addFeature('on_ramp')} data-testid="add-on-ramp">On-ramp</button>
          <button type="button" class="btn btn-sm" onclick={() => addFeature('off_ramp')} data-testid="add-off-ramp">Off-ramp</button>
          <button type="button" class="btn btn-sm" onclick={() => addFeature('lane_change')} data-testid="add-lane-change">Lane change</button>
          <button type="button" class="btn btn-sm" onclick={() => addFeature('work_zone')} data-testid="add-work-zone">Work zone</button>
          {#each TEMPLATES as t}
            <button type="button" class="btn btn-sm" title={t.summary}
                    onclick={() => dropTemplate(t.id)} data-testid="template-{t.id}">{t.name}</button>
          {/each}
        {/if}
      </div>
      <div class="bd-group">
        <span class="bd-group-label">Load</span>
        {#each examples as ex}
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
      <h2>{isUrban ? 'Street' : isTwoLane ? 'Highway' : 'Mainline'}</h2>
      {#if isTwoLane}
        <div class="bd-fields">
          <label>Name <input type="text" value={doc.meta.name} onchange={(e) => commit((d) => (d.meta.name = e.target.value))} data-testid="facility-name" /></label>
          <label>Length (mi) <input type="number" min="0.1" step="0.05" value={(doc.mainline.lengthFt / FT_PER_MI).toFixed(2)} onchange={(e) => setLengthMi(e.currentTarget.value)} data-testid="facility-length" /></label>
          <label>Direction
            <select value={doc.mainline.direction} onchange={(e) => setMainline('direction', e.currentTarget.value)} data-testid="facility-direction">
              <option>Northbound</option><option>Southbound</option><option>Eastbound</option><option>Westbound</option>
            </select>
          </label>
          <label>Posted speed limit (mi/h) <input type="number" min="20" max="70" step="5" value={doc.mainline.speedLimitMph} onchange={(e) => setMainline('speedLimitMph', e.currentTarget.value)} data-testid="facility-spl" /></label>
          <label>Lane width (ft) <input type="number" min="9" max="12" step="0.5" value={doc.mainline.laneWidthFt} onchange={(e) => setMainline('laneWidthFt', e.currentTarget.value)} data-testid="facility-lane-width" /></label>
          <label>Shoulder width (ft) <input type="number" min="0" max="6" step="0.5" value={doc.mainline.shoulderWidthFt} onchange={(e) => setMainline('shoulderWidthFt', e.currentTarget.value)} data-testid="facility-shoulder-width" /></label>
          <label>Access point density (/mi) <input type="number" min="0" step="1" value={doc.mainline.accessPointDensity} onchange={(e) => setMainline('accessPointDensity', e.currentTarget.value)} data-testid="facility-apd" /></label>
          <label>Heavy vehicles in passing lane (%) <input type="number" min="0" max="100" step="0.1" value={doc.mainline.pctHeavyVehInPassingLane} onchange={(e) => setMainline('pctHeavyVehInPassingLane', e.currentTarget.value)} data-testid="facility-pmhvfl" /></label>
          <label>Entering demand (veh/h) <input type="number" min="0" step="5" value={doc.mainline.demand[0]} onchange={(e) => commit((d) => (d.mainline.demand = [Number(e.target.value)]))} data-testid="facility-demand" /></label>
          <label>Opposing demand (veh/h) <input type="number" min="0" step="5" value={doc.mainline.opposingDemand} onchange={(e) => setMainline('opposingDemand', e.currentTarget.value)} data-testid="facility-opposing" /></label>
          <label>Peak hour factor <input type="number" min="0.1" max="1" step="0.005" value={doc.mainline.phf} onchange={(e) => setMainline('phf', e.currentTarget.value)} data-testid="facility-phf" /></label>
          <label>Heavy vehicles (%) <input type="number" min="0" max="100" step="0.5" value={doc.mainline.heavyVehiclePct} onchange={(e) => setMainline('heavyVehiclePct', e.currentTarget.value)} data-testid="facility-phv" /></label>
        </div>
        <p class="bd-sub">
          The posted speed limit is the POSTED limit and not a free-flow speed. Chapter 15 derives the base free-flow speed as 1.14 times it, so a free-flow speed entered here inflates every speed downstream of it and nothing errors. Heavy vehicles is a PERCENT, so 5% is 5 rather than 0.05, and a fraction lands in the lowest lookup bucket and still analyzes. The four values above them are the facility-wide arguments Chapter 15 takes; the demand, factors and posted limit are what a stretch with no demand change on it inherits.
        </p>
        <p class="bd-sub" data-testid="twolane-direction-note">
          A two-lane highway is segmented separately for each direction, because passing zones and grades start and end in different places depending on which way you are going (Chapter 15, Section 2). This document describes the {doc.mainline.direction.toLowerCase()} direction; the other one is a second document.
        </p>
      {:else if isUrban}
        <div class="bd-fields">
          <label>Name <input type="text" value={doc.meta.name} onchange={(e) => commit((d) => (d.meta.name = e.target.value))} data-testid="facility-name" /></label>
          <label>Length (mi) <input type="number" min="0.05" step="0.05" value={(doc.mainline.lengthFt / FT_PER_MI).toFixed(2)} onchange={(e) => setLengthMi(e.currentTarget.value)} data-testid="facility-length" /></label>
          <label>Direction
            <select value={doc.mainline.direction} onchange={(e) => setMainline('direction', e.currentTarget.value)} data-testid="facility-direction">
              <option>Eastbound</option><option>Westbound</option><option>Northbound</option><option>Southbound</option>
            </select>
          </label>
          <label>Through lanes <input type="number" min="1" max="6" step="1" value={doc.mainline.lanes} onchange={(e) => setMainline('lanes', e.currentTarget.value)} data-testid="facility-lanes" /></label>
          <label>Speed limit (mi/h) <input type="number" min="20" max="60" step="1" value={doc.mainline.speedLimitMph} onchange={(e) => setMainline('speedLimitMph', e.currentTarget.value)} data-testid="facility-speed-limit" /></label>
          <label>Left-turn lane proportion <input type="number" min="0" max="1" step="0.01" value={doc.mainline.propLeftTurnLanes} onchange={(e) => setMainline('propLeftTurnLanes', e.currentTarget.value)} data-testid="facility-pltl" /></label>
          <label>Proportion with curb <input type="number" min="0" max="1" step="0.05" value={doc.mainline.proportionWithCurb} onchange={(e) => setMainline('proportionWithCurb', e.currentTarget.value)} data-testid="facility-curb" /></label>
          <label>On-street parking <input type="number" min="0" max="1" step="0.05" value={doc.mainline.proportionOnStreetParking} onchange={(e) => setMainline('proportionOnStreetParking', e.currentTarget.value)} data-testid="facility-parking" /></label>
          <label>Restrictive median (ft) <input type="number" min="0" step="10" value={doc.mainline.restrictiveMedianLengthFt} onchange={(e) => setMainline('restrictiveMedianLengthFt', e.currentTarget.value)} data-testid="facility-median" /></label>
          <label>Analysis period (h) <input type="number" min="0.05" max="1" step="0.05" value={doc.mainline.analysisPeriodH} onchange={(e) => setMainline('analysisPeriodH', e.currentTarget.value)} data-testid="facility-period-h" /></label>
        </div>
        <p class="bd-sub">
          Chapter 18 has no area-type input. What an area type would imply is the cross section, so the curb proportion, the on-street parking and the restrictive median are the fields that carry it into the free-flow speed chain (Equations 18-3 through 18-6). The analysis period length is read only by the computed Chapter 30 Section 4 access-point procedure, which a segment enters only when its access points carry approaches.
        </p>
        <div class="bd-fields bd-mode">
          <label>Segments described by
            <select value={doc.analysisMode} onchange={(e) => setAnalysisMode(e.currentTarget.value)} data-testid="analysis-mode">
              <option value="inputs">Chapter 18 inputs</option>
              <option value="measures">Published Chapter 18 measures</option>
            </select>
          </label>
        </div>
        <p class="bd-sub" data-testid="mode-note">
          {#if doc.analysisMode === 'measures'}
            Each segment carries its published base free-flow speed, travel speed, stop rate, v/c and LOS, and only the Chapter 16 aggregation runs over them. That is the Exhibit 16-7 "HCM method output" path and the one the published example problems take, because Chapter 29 publishes per-segment outputs rather than the geometry behind them. The engine refuses to re-run Chapter 18 on these segments, since there are no inputs behind them to recompute from.
          {:else}
            Each segment carries its Chapter 18 inputs and the full pipeline runs: the Chapter 18 engine per segment, then the Chapter 16 aggregation. One kind per run, because the engine would accept a facility mixing the two but a per-segment switch doubles every editor for a case no published example exercises.
          {/if}
        </p>
      {:else}
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
      {/if}
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
                    mode={stripMode}
                    onselectrow={(k) => { selectedKey = selectedKey === k ? null : k; selectedFeature = null; }}
                    onselectfeature={(id) => { selectedFeature = id; selectedKey = null; }}
                    onrevealfeature={revealFeature}
                    onmovefeature={moveFeature} />
    </section>

    {#if isUrban}
      {#each [['signal', 'Boundary signals', 'A Chapter 18 segment runs from one boundary intersection to the next, so the signals are what derive the segment table. Each segment reads its through control delay, cycle length and effective green from the signal at its downstream end, and a row opens that whole signal including the Chapter 17 inputs that reach only the reliability run.'], ['access_point', 'Access points', 'Access points do not bound a segment. They sit inside one and feed two things: the count Exhibit 18-11 note c reads for the free-flow speed adjustment, and the Equation 18-7 access-point delay term, from whichever of its three sources the point carries.']] as [kind, heading, blurb]}
        {@const list = [...doc.features].filter((f) => f.kind === kind).sort((a, b) => a.stationFt - b.stationFt)}
        {#if list.length}
          <section class="bd-features" aria-label={heading}>
            <h2>{heading}</h2>
            <p class="bd-sub">{blurb}</p>
            <div class="bd-scroll">
              <table class="bd-table" data-testid="urban-{kind}-table">
                <thead>
                  <tr>
                    <th scope="col">{kind === 'signal' ? 'Signal' : 'Access point'}</th>
                    <th scope="col">Station (mi)</th>
                    <th scope="col">{kind === 'signal' ? 'Timing' : 'Delay source'}</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {#each list as f (f.id)}
                    {@const open = selectedFeature === f.id}
                    <tr class:selected={open} data-testid="urban-feature-row" data-feature-id={f.id}
                        data-kind={f.kind} data-expanded={open}>
                      <th scope="row">
                        <button type="button" class="bd-disclose" onclick={() => toggleFeature(f.id)}
                                aria-expanded={open} aria-controls="fe-{f.id}" data-testid="expand-{f.id}">
                          <span class="bd-caret" class:open aria-hidden="true">▸</span>
                          <span class="bd-kind" class:on={f.kind === 'signal'}>{f.kind === 'signal' ? 'Sig' : f.side === 'opposing' ? 'Opp' : 'AP'}</span>
                          <span class="bd-feat-name">{f.label || f.id}</span>
                        </button>
                      </th>
                      <td class="bd-num">{mi2(f.stationFt)}</td>
                      <td class="bd-summary">{urbanSummary(f)}</td>
                      <td><button type="button" class="bd-remove" onclick={() => removeFeature(f.id)} data-testid="remove-{f.id}">remove</button></td>
                    </tr>
                    {#if open}
                      <tr class="bd-detail" data-testid="feature-detail" data-feature-id={f.id}>
                        <td colspan="4" id="fe-{f.id}">
                          <UrbanFeatureEditor feature={f} {doc} interactive={ready}
                                              onfield={setUrbanFeature}
                                              onsignalconfig={setSignalConfig}
                                              onmeasure={setMeasure}
                                              onapproach={setApproach} />
                        </td>
                      </tr>
                    {/if}
                  {/each}
                </tbody>
              </table>
            </div>
          </section>
        {/if}
      {/each}
    {/if}

    {#if isTwoLane}
      {#each [['passing', 'Passing lanes and zones', 'A stretch no passing feature covers is Passing Constrained, so these are the opportunities placed on a constrained road rather than a classification of all of it. Both ends of one are segment boundaries. A passing lane shorter than the 0.5 mi Exhibit 15-10 minimum is analyzed as Passing Constrained and the row says so.'], ['grade', 'Grades', 'Grade is one of the properties Chapter 15 Section 2 asks to be homogeneous within a segment, so both ends of a grade are segment boundaries. The vertical class entered here is a real Step 2 input even though Step 3 recomputes it.'], ['curve', 'Horizontal curves', 'A curve is the one feature here that does NOT start a segment. Chapter 15 Step 1 sends varying curvature to the Step 5d subsegment adjustment inside one segment, so a curve becomes a subsegment of whichever segment contains it, and its length is in FEET where a segment length is in miles.'], ['demand', 'Demand changes', 'Traffic demand and posted speed limit are both homogeneity properties, so a change in either starts a segment. The values on one hold from its station until the next change, and a stretch upstream of the first one takes the highway\'s own.']] as [kind, heading, blurb]}
        {@const list = [...doc.features].filter((f) => f.kind === kind).sort((a, b) => a.stationFt - b.stationFt)}
        {#if list.length}
          <section class="bd-features" aria-label={heading}>
            <h2>{heading}</h2>
            <p class="bd-sub">{blurb}</p>
            <div class="bd-scroll">
              <table class="bd-table" data-testid="twolane-{kind}-table">
                <thead>
                  <tr>
                    <th scope="col">{heading.replace(/s$/, '')}</th>
                    <th scope="col">{kind === 'demand' ? 'Station (mi)' : 'Extent (mi)'}</th>
                    <th scope="col">Configuration</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {#each list as f (f.id)}
                    {@const open = selectedFeature === f.id}
                    <tr class:selected={open} data-testid="twolane-feature-row" data-feature-id={f.id}
                        data-kind={f.kind} data-expanded={open}>
                      <th scope="row">
                        <button type="button" class="bd-disclose" onclick={() => toggleFeature(f.id)}
                                aria-expanded={open} aria-controls="fe-{f.id}" data-testid="expand-{f.id}">
                          <span class="bd-caret" class:open aria-hidden="true">&#9656;</span>
                          <span class="bd-kind" class:on={f.kind === 'passing' && f.passingType === 2}>{TL_KIND_CHIP[f.kind](f)}</span>
                          <span class="bd-feat-name">{f.label || f.id}</span>
                        </button>
                      </th>
                      <td class="bd-num">{mi2(f.stationFt)}{f.endFt != null ? ` \u2013 ${mi2(f.endFt)}` : ''}</td>
                      <td class="bd-summary">{twoLaneSummary(f)}</td>
                      <td><button type="button" class="bd-remove" onclick={() => removeFeature(f.id)} data-testid="remove-{f.id}">remove</button></td>
                    </tr>
                    {#if open}
                      <tr class="bd-detail" data-testid="feature-detail" data-feature-id={f.id}>
                        <td colspan="4" id="fe-{f.id}">
                          <TwoLaneFeatureEditor feature={f} {doc} interactive={ready}
                                                onfield={setFeature}
                                                onmove={moveFeature}
                                                ondemandconfig={setDemandConfig} />
                        </td>
                      </tr>
                    {/if}
                  {/each}
                </tbody>
              </table>
            </div>
          </section>
        {/if}
      {/each}
      {#if doc.features.length === 0}
        <section class="bd-features" aria-label="No features">
          <p class="bd-sub" data-testid="twolane-empty-note">
            No features placed, so the whole highway is one Passing Constrained segment at the values above. That is a complete Chapter 15 facility and it analyzes: Example Problem 1 is exactly this.
          </p>
        </section>
      {/if}
    {/if}

    {#if !isUrban && !isTwoLane && doc.features.some(isRamp)}
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

    {#if !isUrban && !isTwoLane && doc.features.some((f) => !isRamp(f))}
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

    <!-- The demand grid is a period axis, and the urban engines do not have
         one: demand is a scalar per segment, entered on the signal that
         terminates it. Showing a one-column grid here would imply an axis the
         method lacks. -->
    {#if !isUrban && !isTwoLane}
      <DemandGrid {doc} interactive={ready} onedit={editDemand} onperiods={setPeriodCount} />
    {/if}

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
      <p class="bd-uncarried" data-testid="uncarried-note">
        Exporting to the fixture schema carries the facility parameters above and every per-segment field this editor shows.
        {#if uncarried.length}
          It does not carry {uncarried.join(', ')}, which have no editor here. A fixture that was imported keeps those fields verbatim through a round trip{#if isUrban}, and a key the fixture never wrote stays absent unless it has been changed here, so an untouched import re-exports to the file it came from{/if}.
        {:else}
          There is nothing it does not carry: the Chapter 15 segment schema is twenty keys wide and the derivation fills every one of them, so an export from here is the whole schema rather than a subset and an untouched import re-exports to the file it came from.
        {/if}
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
            {isUrban
              ? doc.analysisMode === 'measures'
                ? 'Aggregates the published Chapter 18 measures over the derived segment table (HCM Chapter 16 Steps 1 through 4).'
                : 'Runs the HCM Chapter 18 engine on each derived segment, then the Chapter 16 aggregation.'
              : isTwoLane
                ? 'Runs HCM Chapter 15 Steps 1 through 11 on the derived segment table, in segment order, because the Step 9 passing-lane adjustment depends on it.'
                : 'Runs the HCM Chapter 10 core methodology on the derived segment table.'}
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

    {#if results && isUrban}
      <UrbanResultStrip result={results} {dark} />

      <section class="bd-summary" aria-label="Facility summary" data-testid="urban-facility-summary">
        <h2>Facility summary</h2>
        <div class="bd-figures">
          <div class="bd-fig">
            <span class="bd-fig-label">Facility LOS</span>
            <span class="bd-fig-value" data-testid="urban-los">{results.los}</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Travel speed</span>
            <span class="bd-fig-value" data-testid="urban-travel-speed">{n2(results.travelSpeed)}</span>
            <span class="bd-fig-unit">mi/h</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Base free-flow speed</span>
            <span class="bd-fig-value" data-testid="urban-base-ffs">{n2(results.baseFfs)}</span>
            <span class="bd-fig-unit">mi/h</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Poorest segment LOS</span>
            <span class="bd-fig-value" data-testid="urban-poorest-los">{results.poorestSegmentLos}</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Spatial stop rate</span>
            <span class="bd-fig-value" data-testid="urban-stop-rate">{n2(results.spatialStopRate)}</span>
            <span class="bd-fig-unit">stops/mi</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Critical through v/c</span>
            <span class="bd-fig-value" data-testid="urban-critical-vc">{n3(results.criticalVcRatio)}</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Perception score</span>
            <span class="bd-fig-value" data-testid="urban-perception">{n2(results.perceptionScore)}</span>
          </div>
        </div>
        <p class="bd-undersat" data-testid="urban-mode-readout">
          {#if results.mode === 'measures'}
            Aggregated from published Chapter 18 measures by Chapter 16 Steps 1 through 4. The Chapter 18 engine was not run, because there are no inputs behind these measures to recompute from.
          {:else}
            Every segment evaluated by the Chapter 18 engine, then aggregated by Chapter 16 (Equations 16-2 through 16-4, Exhibit 16-3).
          {/if}
        </p>
      </section>

      <section class="bd-discussion" aria-label="Discussion">
        <Discussion sentences={discussionLines} />
      </section>

      <section class="bd-rel" aria-label="Reliability" data-testid="urban-reliability-panel">
        <h2>Reliability</h2>
        <p class="bd-sub">
          Hands this street to the HCM Chapter 17 methodology. The handoff is a re-statement rather than a re-use: the reliability engine takes sixteen scalars per segment, which is a strict subset of what a Chapter 18 segment holds, so the notes below name every field that reaches the run above and not this one.
        </p>
        <div class="bd-fields">
          <label>Study period start hour
            <input type="number" min="0" max="23" step="1" value={urbanRelInputs.studyPeriodStartHour}
                   data-testid="urel-start-hour"
                   onchange={(e) => (urbanRelInputs = { ...urbanRelInputs, studyPeriodStartHour: Number(e.currentTarget.value) })} />
          </label>
          <label>Analysis periods per day
            <input type="number" min="1" max="96" step="1" value={urbanRelInputs.analysisPeriodsPerDay}
                   data-testid="urel-periods"
                   onchange={(e) => (urbanRelInputs = { ...urbanRelInputs, analysisPeriodsPerDay: Number(e.currentTarget.value) })} />
          </label>
          <label>Entry intersection crashes
            <input type="number" min="0" step="1" value={urbanRelInputs.entryIntersectionCrashes}
                   data-testid="urel-entry-crashes"
                   onchange={(e) => (urbanRelInputs = { ...urbanRelInputs, entryIntersectionCrashes: Number(e.currentTarget.value) })} />
          </label>
          <label>Minor leg volume (veh/h)
            <input type="number" min="0" step="10" value={urbanRelInputs.minorLegVolume}
                   onchange={(e) => (urbanRelInputs = { ...urbanRelInputs, minorLegVolume: Number(e.currentTarget.value) })} />
          </label>
          <label>Weather seed
            <input type="number" min="0" step="1" value={urbanRelInputs.weatherSeed}
                   data-testid="urel-weather-seed"
                   onchange={(e) => (urbanRelInputs = { ...urbanRelInputs, weatherSeed: Number(e.currentTarget.value) })} />
          </label>
          <label>Demand seed
            <input type="number" min="0" step="1" value={urbanRelInputs.demandSeed}
                   onchange={(e) => (urbanRelInputs = { ...urbanRelInputs, demandSeed: Number(e.currentTarget.value) })} />
          </label>
          <label>Incident seed
            <input type="number" min="0" step="1" value={urbanRelInputs.incidentSeed}
                   onchange={(e) => (urbanRelInputs = { ...urbanRelInputs, incidentSeed: Number(e.currentTarget.value) })} />
          </label>
          <label class="bd-check-field">Shoulder present
            <input type="checkbox" checked={urbanRelInputs.shoulderPresent}
                   onchange={(e) => (urbanRelInputs = { ...urbanRelInputs, shoulderPresent: e.currentTarget.checked })} />
          </label>
        </div>
        <div class="bd-run-bar">
          <button type="button" class="btn btn-sm" onclick={runReliability}
                  disabled={reliabilityRunning} data-testid="run-reliability">
            {reliabilityRunning ? 'Running…' : 'Run reliability'}
          </button>
          <span class="bd-run-note">Scenario generation plus one evaluation per scenario, over the Lincoln weather of Exhibit 29-65.</span>
        </div>

        {#if reliabilityError}
          <p class="bd-error" role="alert" data-testid="reliability-error">{reliabilityError}</p>
        {/if}

        {#if reliability}
          <div class="bd-figures" data-testid="urban-reliability-summary">
            <div class="bd-fig">
              <span class="bd-fig-label">Mean TTI</span>
              <span class="bd-fig-value" data-testid="urel-tti-mean">{n3(reliability.ttiMean)}</span>
            </div>
            <div class="bd-fig">
              <span class="bd-fig-label">Median TTI</span>
              <span class="bd-fig-value" data-testid="urel-tti-50">{n3(reliability.tti50)}</span>
            </div>
            <div class="bd-fig">
              <span class="bd-fig-label">Planning time index (95th)</span>
              <span class="bd-fig-value" data-testid="urel-pti">{n3(reliability.tti95)}</span>
            </div>
            <div class="bd-fig">
              <span class="bd-fig-label">Reliability rating</span>
              <span class="bd-fig-value" data-testid="urel-rating">{n1(reliability.reliabilityRating)}</span>
              <span class="bd-fig-unit">%</span>
            </div>
            <div class="bd-fig">
              <span class="bd-fig-label">Scenarios</span>
              <span class="bd-fig-value" data-testid="urel-scenarios">{reliability.numScenarios.toLocaleString('en-US')}</span>
            </div>
          </div>
          <p class="bd-rel-meta">
            {reliability.numOversaturatedScenarios} of them ran oversaturated, with {reliability.numWeatherEvents} weather events and {reliability.numIncidents} incidents generated. Base free-flow travel time {n1(reliability.baseFreeFlowTravelTime)} s.
          </p>
          <Discussion sentences={relDiscussion} />
        {/if}

        <ul class="bd-rel-notes" data-testid="urban-reliability-notes">
          {#each relNotes as note}
            <li class="bd-rel-note {note.level}" data-note-id={note.id}>{note.text}</li>
          {/each}
          <li class="bd-rel-note note">
            <a href="/hcm17">The Chapter 17 calculator</a> has a panel for the weather table and the ATDM strategies, and takes the same street.
          </li>
        </ul>
      </section>
    {/if}

    {#if results && isTwoLane}
      <TwoLaneResultStrip result={results} {dark} />

      <section class="bd-summary" aria-label="Facility summary" data-testid="twolane-facility-summary">
        <h2>Facility summary</h2>
        <div class="bd-figures">
          <div class="bd-fig">
            <span class="bd-fig-label">Facility LOS</span>
            <span class="bd-fig-value" data-testid="twolane-los">{results.los}</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Facility follower density</span>
            <span class="bd-fig-value" data-testid="twolane-fd">{n3(results.facilityFd)}</span>
            <span class="bd-fig-unit">followers/mi</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Posted limit the letter reads</span>
            <span class="bd-fig-value" data-testid="twolane-weighted-spl">{n1(results.weightedSpl)}</span>
            <span class="bd-fig-unit">mi/h</span>
          </div>
          <div class="bd-fig">
            <span class="bd-fig-label">Facility length</span>
            <span class="bd-fig-value" data-testid="twolane-length">{(results.lengthFt / FT_PER_MI).toFixed(2)}</span>
            <span class="bd-fig-unit">mi</span>
          </div>
        </div>
        <p class="bd-undersat" data-testid="twolane-basis">
          Follower density from Equation 15-39, length-weighted over {results.segments.length} segment{results.segments.length === 1 ? '' : 's'}, taking each segment's adjusted density where it has one and a passing lane's midpoint value. The letter comes from Exhibit 15-6 against the length-weighted POSTED speed limit above, which is the {results.weightedSpl >= 50 ? '50 mi/h and above' : 'below 50 mi/h'} column, and not against the speed the highway achieves.
        </p>
      </section>

      <section class="bd-discussion" aria-label="Discussion">
        <Discussion sentences={discussionLines} />
      </section>

      <!-- Where the other two facility types have a reliability panel. Chapter
           15 has no reliability methodology, so this says so rather than
           offering a button that cannot mean anything. -->
      <section class="bd-rel" aria-label="Reliability" data-testid="twolane-reliability-panel">
        <h2>Reliability</h2>
        <p class="bd-sub" data-testid="twolane-no-reliability">
          There is none. The HCM provides a travel time reliability methodology for freeway facilities in Chapter 11 and for urban street facilities in Chapter 17, and there is no two-lane highway counterpart, so this highway has no distribution to be handed to and no scenarios to generate. A freeway or urban street built here does have one, and this panel is where it appears.
        </p>
      </section>
    {/if}

    {#if results && !isUrban && !isTwoLane}
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
  .bd-mode { margin-top: 0.4rem; }

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
  .bd-uncarried { font-size: 0.74rem; color: var(--text-muted); margin: 0.75rem 0 0; line-height: 1.5; }

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
