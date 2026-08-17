// Undo/redo over whole-document snapshots.
//
// Structural sharing would be the right answer for a big document and is the
// wrong answer for this one. A facility with fifteen ramps and fifteen periods
// serializes to a few kilobytes, so a bounded stack of full snapshots costs
// less memory than the bookkeeping to avoid it, and it makes the invariant
// trivial: every action is reversible, which is why the builder has no
// confirmation dialog anywhere.

const LIMIT = 100;

export function createHistory(initial) {
	let past = [];
	let present = snapshot(initial);
	let future = [];

	return {
		get current() {
			return present;
		},
		get canUndo() {
			return past.length > 0;
		},
		get canRedo() {
			return future.length > 0;
		},
		/** Record a new state. `coalesceKey` merges consecutive edits of the same
		 * thing into one undo step, so dragging a ramp across the strip is one
		 * action to undo and not one per pointermove. */
		push(doc, coalesceKey = null) {
			const next = snapshot(doc);
			if (next === present) return present;
			if (coalesceKey && coalesceKey === this._lastKey && past.length) {
				present = next;
				future = [];
				return present;
			}
			past.push(present);
			if (past.length > LIMIT) past.shift();
			present = next;
			future = [];
			this._lastKey = coalesceKey;
			return present;
		},
		/** Close the current coalescing run, so the next edit starts a new undo
		 * step even if it touches the same thing. Called on pointerup. */
		seal() {
			this._lastKey = null;
		},
		undo() {
			if (!past.length) return present;
			future.push(present);
			present = past.pop();
			this._lastKey = null;
			return present;
		},
		redo() {
			if (!future.length) return present;
			past.push(present);
			present = future.pop();
			this._lastKey = null;
			return present;
		},
		reset(doc) {
			past = [];
			future = [];
			present = snapshot(doc);
			this._lastKey = null;
			return present;
		},
		_lastKey: null
	};
}

/** Snapshots are the serialized form, so an undone document cannot share a
 * mutable subobject with the live one. Comparing the strings is also how a
 * no-op edit is dropped before it becomes an undo step. */
function snapshot(doc) {
	return JSON.stringify(doc);
}

export function parseSnapshot(s) {
	return JSON.parse(s);
}
