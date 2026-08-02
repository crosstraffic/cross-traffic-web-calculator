<script>
  import { SERVICE_MEASURES, LOS_COLORS, bandsFor, letterFor } from './los.js';

  /** Key into SERVICE_MEASURES, e.g. "density_pc" or "control_delay_signal". */
  export let measure;
  /** The computed service measure value. */
  export let value = null;
  /**
   * LOS letter as reported by the library. Usually equal to the letter the value earns, but the
   * HCM overrides it in places: a v/c above 1.0 forces F at a signal regardless of delay. When the
   * two disagree the strip says so rather than quietly contradicting the engine.
   */
  export let los = null;
  /** Optional label above the strip; defaults to the measure's own name. */
  export let title = null;

  $: m = SERVICE_MEASURES[measure];
  $: bands = bandsFor(measure);
  $: earned = letterFor(measure, value);
  $: reported = los || earned;
  $: overridden = earned && reported && earned !== reported;
  $: hasValue = Number.isFinite(value);

  // Where the marker sits inside its band, so a value near a threshold visibly sits near the edge
  // instead of snapping to the middle. The open-ended final band has no upper edge to scale
  // against, so it uses the width of the previous band as a stand-in.
  $: markerPct = (() => {
    if (!hasValue || !earned) return null;
    const i = bands.findIndex((b) => b.letter === earned);
    if (i < 0) return null;
    const b = bands[i];
    const bandWidth = 100 / bands.length;
    let frac;
    if (b.openEnded) {
      const prev = bands[i - 1];
      const span = prev && Number.isFinite(prev.to - prev.from) ? Math.abs(prev.to - prev.from) : 1;
      frac = Math.min(0.85, Math.abs(value - b.from) / (span || 1));
    } else {
      frac = Math.abs(value - b.from) / Math.abs(b.to - b.from);
    }
    return (i + Math.min(Math.max(frac, 0), 1)) * bandWidth;
  })();

  function fmtValue(v) {
    if (!Number.isFinite(v)) return '—';
    return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
  }
</script>

{#if m}
  <figure class="los-scale">
    <figcaption class="los-scale-head">
      <span class="los-scale-title">{title || m.label}</span>
      {#if hasValue}
        <span class="los-scale-value">
          <span class="los-scale-num">{fmtValue(value)}</span>
          {#if m.unit}<span class="los-scale-unit">{m.unit}</span>{/if}
        </span>
      {/if}
    </figcaption>

    <div
      class="los-track"
      role="img"
      aria-label={hasValue
        ? `${m.label} of ${fmtValue(value)} ${m.unit}, level of service ${reported}. Thresholds: ${bands.map((b) => `${b.letter} ${b.rangeLabel}`).join(', ')}.`
        : `${m.label} thresholds: ${bands.map((b) => `${b.letter} ${b.rangeLabel}`).join(', ')}.`}
    >
      {#each bands as b}
        <div
          class="los-band"
          class:is-current={hasValue && b.letter === earned}
          style="--band: {LOS_COLORS[b.letter]}"
        >
          <span class="los-band-letter">{b.letter}</span>
          <span class="los-band-range">{b.rangeLabel}</span>
        </div>
      {/each}

      {#if markerPct !== null}
        <div class="los-marker" style="left: {markerPct}%">
          <span class="los-marker-stem" aria-hidden="true"></span>
        </div>
      {/if}
    </div>

    <div class="los-scale-foot">
      {#if overridden}
        <p class="los-override">
          Reported LOS is <strong>{reported}</strong>, not {earned}. The {m.label.toLowerCase()} alone
          would earn {earned}; the chapter overrides it, which happens when demand exceeds capacity.
        </p>
      {/if}
      <p class="los-scale-source">{m.source}. {m.note}</p>
    </div>
  </figure>
{/if}

<style>
  .los-scale {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .los-scale-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .los-scale-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.6;
  }

  .los-scale-value {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .los-scale-num {
    font-size: 1.35rem;
    font-weight: 650;
    line-height: 1;
  }

  .los-scale-unit {
    font-size: 0.7rem;
    opacity: 0.6;
    margin-left: 0.2rem;
  }

  /* The 2px gaps are load-bearing, not decorative: the amber and orange steps are close enough in
     normal vision that abutting them directly would blur the boundary between bands. */
  .los-track {
    position: relative;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 2px;
    margin-top: 0.15rem;
  }

  .los-band {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.05rem;
    min-height: 2.6rem;
    padding: 0.3rem 0.1rem;
    border-radius: 4px;
    background: color-mix(in srgb, var(--band) 22%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--band) 38%, transparent);
    transition: background 120ms ease, box-shadow 120ms ease;
  }

  .los-band.is-current {
    background: var(--band);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--band) 80%, black);
  }

  .los-band-letter {
    font-size: 0.85rem;
    font-weight: 700;
    line-height: 1;
  }

  /* On the filled band the text sits on a saturated surface. Amber and orange are light enough
     that white would drop below contrast, so the letter keeps a dark ink there. */
  .los-band.is-current .los-band-letter,
  .los-band.is-current .los-band-range {
    color: #10100f;
  }

  .los-band-range {
    font-size: 0.6rem;
    font-variant-numeric: tabular-nums;
    opacity: 0.75;
    line-height: 1;
    white-space: nowrap;
  }

  .los-marker {
    position: absolute;
    top: -0.3rem;
    bottom: -0.3rem;
    width: 0;
    pointer-events: none;
  }

  .los-marker-stem {
    position: absolute;
    inset: 0;
    width: 2px;
    margin-left: -1px;
    border-radius: 1px;
    background: currentColor;
    /* The ring keeps the stem legible wherever it lands. `--surface-ring` lets a page that
       introduces a dark surface hand one in; the app is light-only today. */
    box-shadow: 0 0 0 2px var(--surface-ring, rgba(252, 252, 251, 0.9));
  }

  .los-scale-foot {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .los-scale-source {
    font-size: 0.65rem;
    opacity: 0.55;
    margin: 0;
    line-height: 1.35;
  }

  .los-override {
    font-size: 0.7rem;
    margin: 0;
    line-height: 1.4;
    padding: 0.3rem 0.45rem;
    border-radius: 4px;
    background: color-mix(in srgb, currentColor 7%, transparent);
    border-left: 2px solid var(--los-f, #d03b3b);
  }
</style>
