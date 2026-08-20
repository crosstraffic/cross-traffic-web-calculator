// Layer one of the persistence: the builder document itself, autosaved to a
// keyed local-storage slot and downloadable as a file. Layer two is the fixture
// schema, in fixture.js.
//
// localStorage rather than the sessionStorage $lib/report.js uses, because a
// half-built facility is work in progress and should still be there tomorrow,
// where a report is about the run that just happened.

const SLOT_PREFIX = 'hcm-builder:';

export function slotKey(slot) {
  return `${SLOT_PREFIX}${slot}`;
}

export function saveSlot(slot, doc) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      slotKey(slot),
      JSON.stringify({ ...doc, meta: { ...doc.meta, modified: new Date().toISOString() } }),
    );
  } catch {
    // A full or disabled store must not take the editor down with it. The
    // document is still in memory and still downloadable.
  }
}

export function loadSlot(slot) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(slotKey(slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSlot(slot) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(slotKey(slot));
  } catch {
    /* see saveSlot */
  }
}

/** The download shape the hcm12 and hcm15 pages already use, factored here
 * rather than copied a third time. It is not shared with those pages, because
 * changing a signed-off chapter page to reuse it would put two released
 * validations at risk for a refactor. */
export function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error(`could not read ${file.name}`));
    fr.onload = () => {
      try {
        resolve(JSON.parse(String(fr.result)));
      } catch (e) {
        reject(new Error(`${file.name} is not valid JSON: ${e.message}`));
      }
    };
    fr.readAsText(file);
  });
}
