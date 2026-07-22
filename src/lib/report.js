import { writable } from 'svelte/store';

// Completed analyses, keyed by page href ('/hcm12', '/hcm15'), so a freeway and
// a two-lane report can be held at the same time. Persisted to sessionStorage so
// they survive a refresh (cleared when the tab closes).
const KEY = 'hcm-reports';

export const reports = writable({});   // { '/hcm12': {...}, '/hcm15': {...} }
export const lastKey = writable(null); // most recently published report

export function setReport(value) {
  let snapshot;
  reports.update((m) => { snapshot = { ...m, [value.href]: value }; return snapshot; });
  lastKey.set(value.href);
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.setItem(KEY, JSON.stringify({ map: snapshot, last: value.href })); } catch (e) { /* ignore quota */ }
  }
}

// Rehydrate from sessionStorage (call in onMount so it stays SSR-safe).
export function loadReports() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const { map, last } = JSON.parse(raw);
    if (map) reports.set(map);
    if (last) lastKey.set(last);
  } catch (e) { /* ignore */ }
}
