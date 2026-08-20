<script>
  /**
   * The short interpretive paragraph that closes a results panel.
   *
   * The HCM's Example Problems end with a Discussion that reads the answer back: what governs it,
   * how much room is left before capacity, how close the service measure sits to a band edge, and
   * what the letter means for the facility. A results table cannot say any of that, and the letter
   * alone hides how far into its band a value sits. Each page generates its own sentences from its
   * own computed values; this component only renders them.
   *
   * @typedef {Object} Props
   * @property {string[]} sentences - The generated sentences, in reading order. Falsy entries are dropped, so a generator can leave a sentence out with a conditional expression rather than by building the array in pieces.
   * @property {string} [title] - Heading text.
   * @property {boolean} [open] - Whether the section starts expanded.
   */

  /** @type {Props} */
  let { sentences = [], title = 'Discussion', open = true } = $props();

  let lines = $derived((sentences ?? []).filter(Boolean));
</script>

{#if lines.length}
  <details class="discussion" {open} data-testid="discussion">
    <summary class="discussion-head">{title}</summary>
    <div class="discussion-body">
      {#each lines as line}
        <p>{line}</p>
      {/each}
    </div>
  </details>
{/if}

<style>
  .discussion {
    margin-top: 1.25rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface-subtle);
  }

  .discussion-head {
    cursor: pointer;
    list-style: none;
    padding: 0.55rem 0.9rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
  }

  .discussion-head::-webkit-details-marker {
    display: none;
  }

  /* The marker is drawn rather than left to the browser, so it matches the disclosure arrows the
     rest of the app uses and rotates with the open state. */
  .discussion-head::before {
    content: '▸';
    display: inline-block;
    margin-right: 0.45rem;
    opacity: 0.6;
  }

  .discussion[open] .discussion-head::before {
    content: '▾';
  }

  .discussion-body {
    padding: 0 0.9rem 0.8rem;
  }

  .discussion-body p {
    margin: 0 0 0.5rem;
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--text);
  }

  .discussion-body p:last-child {
    margin-bottom: 0;
  }
</style>
