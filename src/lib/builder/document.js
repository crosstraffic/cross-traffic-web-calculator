// The builder document: the facility as an engineer describes it, before any
// segmentation. It is a plain serializable object with no class instances and
// no functions, so a snapshot is a structuredClone and persistence is
// JSON.stringify. Everything the strip, the table, the demand grid and the
// validation panel show is derived from this and nothing else.
//
// A fixture cannot play this role. The library's FreewayFacilities schema
// stores the segments Chapter 10 Step A-2 produced, not the ramps the analyst
// placed, and the two are not invertible: a 1,500 ft merge could have come
// from an isolated on-ramp or from a ramp pair 3,000 ft apart. So the document
// is what round-trips the builder, and the fixture is what round-trips the
// engines.

export const DOC_VERSION = 1;

/** Stations are stored in FEET, like every length in the Chapter 10 schema. The
 * strip snaps drags to 0.1 mi, which is 528 ft, but nothing downstream sees
 * miles. */
export const FT_PER_MI = 5280;

let seq = 0;
/** Ids only have to be unique within one document, and they key overrides, so
 * they must be stable across a save and reload. A counter seeded from the
 * document's own high-water mark does that; Math.random would too, but this
 * keeps the JSON readable. */
export function nextId(doc, prefix) {
	const used = new Set((doc?.features ?? []).map((f) => f.id));
	let n = ++seq;
	while (used.has(`${prefix}${n}`)) n = ++seq;
	return `${prefix}${n}`;
}

export function emptyDocument() {
	return {
		version: DOC_VERSION,
		facilityType: 'freeway',
		meta: { name: 'Untitled facility', source: 'builder', modified: null },
		periods: 4,
		mainline: {
			lengthFt: 3 * FT_PER_MI,
			lanes: 3,
			ffs: 60,
			terrain: 'Level',
			cityType: 'Urban',
			phf: 0.95,
			heavyVehiclePct: 0.05,
			jamDensityPc: 190,
			queueDischargeDrop: 0.07,
			totalRampDensity: 1,
			interchangeDensity: 1,
			demand: [4000, 4400, 4400, 4000]
		},
		features: [],
		overrides: {},
		// Set only by a fixture import. A fixture arrives with no feature layer
		// at all, so the derived table is the fixture's own segment list and the
		// segment table becomes the primary editor. Placing a feature clears
		// this, because from that point the segments follow the features.
		importedSegments: null,
		// The verbatim parsed fixture an import came from, so an untouched
		// import exports byte-identically including keys this builder has no
		// editor for.
		importedRaw: null
	};
}

/** A feature is a point on the mainline. `stationFt` is the gore point: the
 * downstream end of an on-ramp's gore area and the upstream end of an
 * off-ramp's, which is where the 1,500 ft influence area is measured from
 * (Chapter 10 Section 2, Exhibit 10-1). */
export function makeFeature(doc, kind, stationFt) {
	const periods = doc.periods;
	const base = {
		id: nextId(doc, kind === 'on_ramp' ? 'on' : 'off'),
		kind,
		stationFt: Math.round(stationFt),
		label: '',
		rampFfs: 40,
		demand: new Array(periods).fill(0)
	};
	if (kind === 'on_ramp') {
		return {
			...base,
			accelLaneFt: 500,
			// An auxiliary lane between this on-ramp's gore and the next
			// off-ramp's turns the whole section into one weaving segment
			// (Exhibit 10-12). It is a property of the pair, held on the
			// upstream half of it.
			auxLaneToNext: false,
			numWeavingLanes: 2,
			lcRf: 1,
			lcFr: 1,
			rampToRampDemand: new Array(periods).fill(0)
		};
	}
	return { ...base, decelLaneFt: 500 };
}

export function sortedFeatures(doc) {
	return [...doc.features].sort((a, b) => a.stationFt - b.stationFt || a.id.localeCompare(b.id));
}

export function cloneDoc(doc) {
	return JSON.parse(JSON.stringify(doc));
}

/** Resize every per-period vector at once. The period count is one control for
 * the whole document because a facility whose ramps disagree about how many
 * 15-min periods exist is not analyzable, and the engine reads the period count
 * off the mainline demand vector alone, so a short ramp vector would be read as
 * zeros rather than rejected. */
export function setPeriods(doc, n) {
	const periods = Math.max(1, Math.round(n));
	const fit = (v) => {
		const out = (v ?? []).slice(0, periods);
		while (out.length < periods) out.push(out.length ? out[out.length - 1] : 0);
		return out;
	};
	doc.periods = periods;
	doc.mainline.demand = fit(doc.mainline.demand);
	for (const f of doc.features) {
		f.demand = fit(f.demand);
		if (f.kind === 'on_ramp') f.rampToRampDemand = fit(f.rampToRampDemand);
	}
	if (doc.importedSegments) {
		for (const s of doc.importedSegments) {
			for (const k of ['on_ramp_demand', 'off_ramp_demand', 'ramp_to_ramp_demand']) {
				if (Array.isArray(s[k])) s[k] = fit(s[k]);
			}
		}
	}
	return doc;
}

/** Documents loaded from a file or from local storage are untrusted input, so
 * the shape is checked rather than assumed. The failure this guards is silent:
 * a document missing `mainline.demand` renders an empty demand grid and derives
 * a segment table that looks finished. */
export function migrate(raw) {
	if (!raw || typeof raw !== 'object') throw new Error('not a builder document');
	if (raw.version !== DOC_VERSION) {
		throw new Error(`unsupported builder document version ${raw.version} (this build reads ${DOC_VERSION})`);
	}
	if (raw.facilityType !== 'freeway') {
		throw new Error(`unsupported facility type "${raw.facilityType}" (phase 1 is freeway only)`);
	}
	const doc = { ...emptyDocument(), ...raw };
	doc.meta = { ...emptyDocument().meta, ...(raw.meta ?? {}) };
	doc.mainline = { ...emptyDocument().mainline, ...(raw.mainline ?? {}) };
	doc.features = Array.isArray(raw.features) ? raw.features : [];
	doc.overrides = raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {};
	if (!Array.isArray(doc.mainline.demand) || doc.mainline.demand.length === 0) {
		throw new Error('document has no mainline demand, so it has no analysis periods');
	}
	// The period count is whatever the mainline vector says, and every other
	// vector is refit to it rather than trusted.
	return setPeriods(doc, doc.mainline.demand.length);
}
