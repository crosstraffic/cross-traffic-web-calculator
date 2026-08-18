<script>
  // "Open in Builder", the one affordance every chapter page the builder speaks
  // gets. It writes the page's current form state into the handoff key and then
  // lets the link navigate; the builder reads the key on mount.
  //
  // The payload is built on click rather than kept in a derived value, because
  // building it can throw on a form that is not yet complete (a two-lane segment
  // with no passing type chosen, a demand list with nothing in it) and a page
  // should not carry an error banner for a button nobody has pressed. When it
  // does throw the message lands here and the navigation is cancelled, so the
  // analyst is left on the page with the field that needs filling rather than in
  // a builder holding half a facility.

  import { putHandoff } from '$lib/builder/handoff.js';

  let {
    /** Returns the handoff payload for the page's current state. May throw. */
    build,
    /** What crosses, in the page's own words. Shown beside the link. */
    note = ''
  } = $props();

  let error = $state('');

  function go(e) {
    error = '';
    try {
      putHandoff(build());
    } catch (err) {
      e.preventDefault();
      error = String(err?.message ?? err);
    }
  }
</script>

<div class="oib">
  <a class="btn btn-outline btn-sm" href="/builder" data-testid="open-in-builder" onclick={go}>
    Open in Builder
  </a>
  {#if note}<span class="oib-note">{note}</span>{/if}
</div>
{#if error}
  <p class="oib-error" role="alert" data-testid="open-in-builder-error">{error}</p>
{/if}

<style>
  .oib {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }

  .oib-note {
    font-size: 0.78rem;
    color: var(--text-muted);
    line-height: 1.5;
    max-width: 40rem;
  }

  .oib-error {
    font-size: 0.8rem;
    color: var(--warn-text);
    margin-top: 0.5rem;
  }
</style>
