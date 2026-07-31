<script>
  import { LOS_COLORS } from './los.js';

  /** LOS letter, or null when the chapter defines none for this configuration. */
  export let los = null;
  export let size = 'md';
  /** Shown under the badge when `los` is null, e.g. why the HCM assigns no letter here. */
  export let undefinedNote = 'Not defined';

  $: color = los ? LOS_COLORS[los] : null;
</script>

<div class="los-badge-wrap" class:sm={size === 'sm'} class:lg={size === 'lg'}>
  {#if los}
    <span class="los-badge" style="--los: {color}" aria-label={`Level of service ${los}`}>{los}</span>
  {:else}
    <span class="los-badge is-none" aria-label={undefinedNote}>–</span>
    <span class="los-none-note">{undefinedNote}</span>
  {/if}
</div>

<style>
  .los-badge-wrap {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }

  /* The letter is the encoding; the colour is a second channel on top of it. A user who cannot
     separate the amber and orange steps still reads the letter. */
  .los-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.4rem;
    height: 2.4rem;
    border-radius: 0.5rem;
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1;
    background: var(--los);
    color: #10100f;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--los) 75%, black);
  }

  .los-badge.is-none {
    background: color-mix(in srgb, currentColor 12%, transparent);
    color: inherit;
    opacity: 0.7;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent);
  }

  .los-none-note {
    font-size: 0.6rem;
    opacity: 0.6;
    text-align: center;
    max-width: 7rem;
    line-height: 1.25;
  }

  .sm .los-badge {
    min-width: 1.8rem;
    height: 1.8rem;
    font-size: 1rem;
  }

  .lg .los-badge {
    min-width: 3rem;
    height: 3rem;
    font-size: 1.7rem;
  }
</style>
