<script>
  /**
   * @typedef {Object} Props
   * @property {any} ffsAdj - The Chapter 12 speed-flow relationship with the analysed segment plotted on it.
Equation 12-1 is literally a curve, and the single most useful thing a basic-freeway result can
show is where the segment sits along it: flat and free-flowing below the breakpoint, or out on
the falling limb with little headroom left. A density number alone does not convey that.
   * @property {any} capacityAdj
   * @property {any} breakpoint
   * @property {any} [flow] - Per-lane demand flow rate, pc/h/ln.
   * @property {any} [speed] - Space mean speed at that flow, mi/h. Recomputed from the curve when not supplied.
   * @property {number} [exponent] - Exponent a of Equation 12-1: 2 for basic freeway, 1.31 for multilane.
   * @property {number} [densityAtCapacity]
   */

  /** @type {Props} */
  let { ffsAdj, capacityAdj, breakpoint, flow = null, speed = null, exponent = 2, densityAtCapacity = 45 } = $props();

  const W = 640;
  const H = 260;
  const PAD = { top: 16, right: 18, bottom: 32, left: 44 };

  function speedAt(v) {
    if (v <= breakpoint) return ffsAdj;
    if (v > capacityAdj) return null;
    const atCap = capacityAdj / densityAtCapacity;
    const den = capacityAdj - breakpoint;
    if (den <= 0) return atCap;
    return ffsAdj - (ffsAdj - atCap) * Math.pow((v - breakpoint) / den, exponent);
  }

  function tickValues(max, count) {
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
    const out = [];
    for (let t = 0; t <= max; t += step) out.push(t);
    return out;
  }
  let plotW = $derived(W - PAD.left - PAD.right);
  let plotH = $derived(H - PAD.top - PAD.bottom);
  let xMax = $derived(Math.max(capacityAdj * 1.06, (flow || 0) * 1.06, 100));
  let yMax = $derived(Math.ceil((ffsAdj + 6) / 10) * 10);
  let xOf = $derived((v) => PAD.left + (v / xMax) * plotW);
  let yOf = $derived((s) => PAD.top + (1 - s / yMax) * plotH);
  let curve = $derived(
    (() => {
      const pts = [];
      const steps = 90;
      for (let i = 0; i <= steps; i++) {
        const v = (capacityAdj * i) / steps;
        const s = speedAt(v);
        if (s !== null) pts.push([xOf(v), yOf(s)]);
      }
      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    })(),
  );
  let plottedSpeed = $derived(Number.isFinite(speed) ? speed : flow !== null ? speedAt(flow) : null);
  let overCapacity = $derived(flow !== null && flow > capacityAdj);
  let xTicks = $derived(tickValues(xMax, 5));
  let yTicks = $derived(tickValues(yMax, 4).filter((t) => t > 0));
</script>

<figure class="sfc">
  <figcaption class="sfc-cap">
    Speed–flow curve (Equation 12-1)
    <span class="sfc-sub">free-flow speed {ffsAdj.toFixed(1)} mi/h · capacity {capacityAdj.toFixed(0)} pc/h/ln</span>
  </figcaption>

  <svg
    viewBox="0 0 {W} {H}"
    role="img"
    preserveAspectRatio="xMidYMid meet"
    aria-label={flow !== null && plottedSpeed !== null
      ? `Speed-flow curve. The segment carries ${flow.toFixed(0)} passenger cars per hour per lane at ${plottedSpeed.toFixed(1)} miles per hour, against a capacity of ${capacityAdj.toFixed(0)}.`
      : `Speed-flow curve for a free-flow speed of ${ffsAdj.toFixed(1)} miles per hour and a capacity of ${capacityAdj.toFixed(0)} passenger cars per hour per lane.`}
  >
    {#each yTicks as t}
      <line class="sfc-grid" x1={PAD.left} x2={W - PAD.right} y1={yOf(t)} y2={yOf(t)} />
      <text class="sfc-tick" x={PAD.left - 6} y={yOf(t)} text-anchor="end" dominant-baseline="middle">{t}</text>
    {/each}
    {#each xTicks as t}
      <text class="sfc-tick" x={xOf(t)} y={H - PAD.bottom + 14} text-anchor="middle">{t}</text>
    {/each}

    <text class="sfc-axis" x={PAD.left} y={H - 4} text-anchor="start">Flow rate (pc/h/ln)</text>
    <text class="sfc-axis" transform={`translate(11 ${PAD.top + plotH / 2}) rotate(-90)`} text-anchor="middle"
      >Speed (mi/h)</text
    >

    <!-- Breakpoint: where the curve stops being flat. Worth naming, because a segment just below it
         behaves completely differently from one just above. -->
    <line class="sfc-ref" x1={xOf(breakpoint)} x2={xOf(breakpoint)} y1={PAD.top} y2={H - PAD.bottom} />
    <text class="sfc-ref-label" x={xOf(breakpoint) + 4} y={PAD.top + 10}>breakpoint</text>

    <line class="sfc-ref sfc-ref-cap" x1={xOf(capacityAdj)} x2={xOf(capacityAdj)} y1={PAD.top} y2={H - PAD.bottom} />
    <text class="sfc-ref-label" x={xOf(capacityAdj) - 4} y={PAD.top + 10} text-anchor="end">capacity</text>

    <path class="sfc-curve" d={curve} />

    {#if flow !== null && plottedSpeed !== null && !overCapacity}
      <line class="sfc-drop" x1={xOf(flow)} x2={xOf(flow)} y1={yOf(plottedSpeed)} y2={H - PAD.bottom} />
      <circle class="sfc-pt-ring" cx={xOf(flow)} cy={yOf(plottedSpeed)} r="7" />
      <circle class="sfc-pt" cx={xOf(flow)} cy={yOf(plottedSpeed)} r="4.5" />
      <text
        class="sfc-pt-label"
        x={xOf(flow) < PAD.left + plotW * 0.7 ? xOf(flow) + 11 : xOf(flow) - 11}
        y={yOf(plottedSpeed) - 8}
        text-anchor={xOf(flow) < PAD.left + plotW * 0.7 ? 'start' : 'end'}
      >
        this segment · {plottedSpeed.toFixed(1)} mi/h
      </text>
    {:else if overCapacity}
      <text class="sfc-over" x={PAD.left + plotW / 2} y={PAD.top + plotH / 2} text-anchor="middle">
        demand exceeds capacity, past the end of the curve
      </text>
    {/if}
  </svg>
</figure>

<style>
  .sfc {
    margin: 0;
  }

  .sfc-cap {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.6;
    margin-bottom: 0.3rem;
  }

  .sfc-sub {
    display: block;
    text-transform: none;
    letter-spacing: 0;
    font-size: 0.68rem;
    opacity: 0.85;
    margin-top: 0.1rem;
  }

  .sfc svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }

  .sfc-grid {
    stroke: currentColor;
    stroke-width: 1;
    opacity: 0.09;
  }
  .sfc-tick {
    font-size: 9px;
    fill: currentColor;
    opacity: 0.5;
    font-variant-numeric: tabular-nums;
  }
  .sfc-axis {
    font-size: 9px;
    fill: currentColor;
    opacity: 0.5;
  }

  .sfc-ref {
    stroke: currentColor;
    stroke-width: 1;
    stroke-dasharray: 3 4;
    opacity: 0.3;
  }
  .sfc-ref-cap {
    opacity: 0.45;
  }
  .sfc-ref-label {
    font-size: 8.5px;
    fill: currentColor;
    opacity: 0.5;
  }

  .sfc-curve {
    fill: none;
    stroke: #256abf;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .sfc-drop {
    stroke: currentColor;
    stroke-width: 1;
    stroke-dasharray: 2 3;
    opacity: 0.35;
  }

  /* The 2px surface ring keeps the marker legible where it crosses the curve. `--sfc-surface`
     lets a page supply its own surface colour; the app is light-only today. */
  .sfc-pt-ring {
    fill: var(--sfc-surface, #fcfcfb);
  }
  .sfc-pt {
    fill: #256abf;
  }
  .sfc-pt-label {
    font-size: 10px;
    font-weight: 600;
    fill: currentColor;
  }
  .sfc-over {
    font-size: 11px;
    fill: #d03b3b;
    font-weight: 600;
  }
</style>
