import { writable } from 'svelte/store';

// Most recent completed analysis, rendered on the /report page. The calculator
// pages call setReport() when Calculate succeeds. Persisted to sessionStorage so
// the report survives a page refresh (cleared when the tab closes).
const KEY = 'hcm-report';

export const report = writable(null);

export function setReport(value) {
  report.set(value);
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch (e) { /* ignore quota */ }
  }
}

// Rehydrate from sessionStorage (call in onMount so it stays SSR-safe).
export function loadReport() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) report.set(JSON.parse(raw));
  } catch (e) { /* ignore */ }
}
