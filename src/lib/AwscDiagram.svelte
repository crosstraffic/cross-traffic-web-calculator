<script>
  // Interactive plan view of an all-way STOP-controlled intersection (HCM
  // Chapter 21). Every present approach stops, so every leg carries a stop
  // bar; a leg exists exactly when its approach has at least one lane, which
  // lets the picture follow three-leg fixtures like the Chapter 32 examples.
  // All movements share rank at an AWSC, so every path draws solid.
  //
  // `approaches` is the page's object: { eb|wb|nb|sb: { laneCount, lanes:
  // [{left,through,right}], hv } }. On-diagram editing targets lane 1 and is
  // disabled for multi-lane approaches, where the form's per-lane table is

  // Approach LOS letters from the last run; each approach's traffic slows

  /**
   * @typedef {Object} Props
   * @property {any} [approaches] - authoritative.
   * @property {boolean} [editable]
   * @property {any} [approachLos] - and bunches with its LOS (everyone stops at an AWSC).
   */

  /** @type {Props} */
  let { approaches = $bindable({}), editable = true, approachLos = {} } = $props();

  let hovered = $state(null); // 'EB' | 'WB' | 'NB' | 'SB' | null

  const LANE = 18;
  const RUN = 105;

  // Svelte 4 only tracks identifiers that appear in the reactive statement, so
  // the lane counts read `approaches` directly instead of through a closure.
  let nEB = $derived(Math.max(0, Number(approaches?.eb?.laneCount) || 0));
  let nWB = $derived(Math.max(0, Number(approaches?.wb?.laneCount) || 0));
  let nNB = $derived(Math.max(0, Number(approaches?.nb?.laneCount) || 0));
  let nSB = $derived(Math.max(0, Number(approaches?.sb?.laneCount) || 0));
  let counts = $derived({ EB: nEB, WB: nWB, NB: nNB, SB: nSB });
  let legW = $derived(nEB > 0);
  let legE = $derived(nWB > 0);
  let legS = $derived(nNB > 0);
  let legN = $derived(nSB > 0);

  // Road half widths; an absent approach still leaves a one-lane receiving half.
  let hEB = $derived(Math.max(1, nEB) * LANE);
  let hWB = $derived(Math.max(1, nWB) * LANE);
  let hNB = $derived(Math.max(1, nNB) * LANE);
  let hSB = $derived(Math.max(1, nSB) * LANE);

  let cx = $derived((legW ? RUN : 0) + hSB);
  let cy = $derived((legN ? RUN : 0) + hWB);
  let W = $derived(cx + hNB + (legE ? RUN : 0));
  let H = $derived(cy + hEB + (legS ? RUN : 0));

  let boxW = $derived(cx - hSB);
  let boxE = $derived(cx + hNB);
  let boxN = $derived(cy - hWB);
  let boxS = $derived(cy + hEB);

  let xNB = $derived((i) => cx + (i + 0.5) * LANE);
  let xSB = $derived((i) => cx - (i + 0.5) * LANE);
  let yEB = $derived((i) => cy + (i + 0.5) * LANE);
  let yWB = $derived((i) => cy - (i + 0.5) * LANE);
  const mid = (n) => Math.floor((Math.max(1, n) - 1) / 2);

  // Movement paths; a path only exists when its receiving leg does.
  let dEB = $derived(
    !legW
      ? {}
      : {
          L: legN ? `M 0,${yEB(0)} H ${boxW} Q ${cx + LANE / 2},${yEB(0)} ${cx + LANE / 2},${boxN} V 0` : null,
          T: legE ? `M 0,${yEB(mid(nEB))} H ${W}` : null,
          R: legS
            ? `M 0,${yEB(nEB - 1)} H ${boxW} Q ${boxW + LANE / 2},${yEB(nEB - 1)} ${boxW + LANE / 2},${boxS} V ${H}`
            : null,
        },
  );
  let dWB = $derived(
    !legE
      ? {}
      : {
          L: legS ? `M ${W},${yWB(0)} H ${boxE} Q ${cx - LANE / 2},${yWB(0)} ${cx - LANE / 2},${boxS} V ${H}` : null,
          T: legW ? `M ${W},${yWB(mid(nWB))} H 0` : null,
          R: legN
            ? `M ${W},${yWB(nWB - 1)} H ${boxE} Q ${boxE - LANE / 2},${yWB(nWB - 1)} ${boxE - LANE / 2},${boxN} V 0`
            : null,
        },
  );
  let dNB = $derived(
    !legS
      ? {}
      : {
          L: legW ? `M ${xNB(0)},${H} V ${boxS} Q ${xNB(0)},${cy - LANE / 2} ${boxW},${cy - LANE / 2} H 0` : null,
          T: legN ? `M ${xNB(mid(nNB))},${H} V 0` : null,
          R: legE
            ? `M ${xNB(nNB - 1)},${H} V ${boxS} Q ${xNB(nNB - 1)},${boxS - LANE / 2} ${boxE},${boxS - LANE / 2} H ${W}`
            : null,
        },
  );
  let dSB = $derived(
    !legN
      ? {}
      : {
          L: legE ? `M ${xSB(0)},0 V ${boxN} Q ${xSB(0)},${cy + LANE / 2} ${boxE},${cy + LANE / 2} H ${W}` : null,
          T: legS ? `M ${xSB(mid(nSB))},0 V ${H}` : null,
          R: legW
            ? `M ${xSB(nSB - 1)},0 V ${boxN} Q ${xSB(nSB - 1)},${boxN + LANE / 2} ${boxW},${boxN + LANE / 2} H 0`
            : null,
        },
  );
  let paths = $derived({ EB: dEB, WB: dWB, NB: dNB, SB: dSB });

  let present = $derived({ EB: legW, WB: legE, NB: legS, SB: legN });
  let order = $derived(
    [
      { key: 'EB', label: 'Eastbound' },
      { key: 'WB', label: 'Westbound' },
      { key: 'NB', label: 'Northbound' },
      { key: 'SB', label: 'Southbound' },
    ].filter((o) => present[o.key]),
  );

  let lane1 = $derived((a, k) => a?.[k.toLowerCase()]?.lanes?.[0] ?? { left: 0, through: 0, right: 0 });

  function setVol(ap, mv, raw) {
    const lane = approaches[ap.toLowerCase()].lanes[0];
    lane[{ L: 'left', T: 'through', R: 'right' }[mv]] = raw === '' ? '' : Number(raw);
    approaches = approaches;
  }

  const CW = 104;
  const CH = 24;
  let clusterPos = $derived({
    NB: { x: boxE + 6, y: H - CH - 6 },
    SB: { x: boxW - CW - 6, y: 6 },
    EB: { x: 6, y: boxS + 22 },
    WB: { x: W - CW - 6, y: boxN - CH - 6 },
  });

  // ── illustrative traffic, LOS-responsive per approach ──
  let animating = $state(false);
  const LOS_SPEED = { A: 1, B: 0.85, C: 0.7, D: 0.5, E: 0.32, F: 0.16 };
  const LOS_FLEET = { A: 1, B: 1, C: 1.1, D: 1.3, E: 1.7, F: 2.3 };
  let vehiclePlan = $derived(
    (() => {
      if (!animating) return [];
      const items = [];
      let total = 0;
      const raw = [];
      for (const o of order) {
        const a = approaches?.[o.key.toLowerCase()];
        if (!a || !a.lanes?.length) continue;
        const slow = LOS_SPEED[approachLos?.[o.key]] ?? 1;
        const crowd = LOS_FLEET[approachLos?.[o.key]] ?? 1;
        const sums = a.lanes.reduce(
          (s, l) => [s[0] + (Number(l.left) || 0), s[1] + (Number(l.through) || 0), s[2] + (Number(l.right) || 0)],
          [0, 0, 0],
        );
        ['L', 'T', 'R'].forEach((mv, i) => {
          const vol = sums[i];
          const d = paths[o.key][mv];
          if (vol <= 0 || !d) return;
          raw.push({ key: o.key, d, vol, dur: (mv === 'T' ? 6 : 5) / slow, crowd });
          total += vol;
        });
      }
      for (const it of raw) {
        const n = Math.max(1, Math.min(7, Math.round((24 * it.vol * it.crowd) / (total || 1))));
        for (let k = 0; k < n; k++) {
          items.push({
            id: it.key + it.d.length + k,
            key: it.key,
            d: it.d,
            dur: it.dur,
            begin: (-(k + 0.4 * (k % 2)) / n) * it.dur,
          });
        }
      }
      return items;
    })(),
  );

  function cls(h, key) {
    if (h == null) return 'aw-move';
    return h === key ? 'aw-move active' : 'aw-move dim';
  }
</script>

<div class="awsc-diagram">
  <svg
    viewBox="0 0 {W} {H}"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label={`${order.length}-leg all-way stop-controlled intersection`}
  >
    <!-- ══ pavement ══ -->
    <rect
      x={boxW}
      y={legN ? 0 : boxN}
      width={hSB + hNB}
      height={(legN ? cy : hWB) + (legS ? H - cy : hEB)}
      class="aw-pavement"
    />
    <rect
      x={legW ? 0 : boxW}
      y={boxN}
      width={(legW ? cx : hSB) + (legE ? W - cx : hNB)}
      height={hWB + hEB}
      class="aw-pavement"
    />

    <!-- ══ outer edges, interrupted at present legs ══ -->
    {#if legN}
      <line x1={boxW} y1="0" x2={boxW} y2={boxN} class="aw-edge" />
      <line x1={boxE} y1="0" x2={boxE} y2={boxN} class="aw-edge" />
    {/if}
    {#if legS}
      <line x1={boxW} y1={boxS} x2={boxW} y2={H} class="aw-edge" />
      <line x1={boxE} y1={boxS} x2={boxE} y2={H} class="aw-edge" />
    {/if}
    <line x1={legW ? 0 : boxW} y1={boxN} x2={legN ? boxW : legE ? W : boxE} y2={boxN} class="aw-edge" />
    {#if legN && legE}
      <line x1={boxE} y1={boxN} x2={W} y2={boxN} class="aw-edge" />
    {/if}
    <line x1={legW ? 0 : boxW} y1={boxS} x2={legS ? boxW : legE ? W : boxE} y2={boxS} class="aw-edge" />
    {#if legS && legE}
      <line x1={boxE} y1={boxS} x2={W} y2={boxS} class="aw-edge" />
    {/if}

    <!-- ══ centerlines on present legs ══ -->
    {#if legW}<line x1="0" y1={cy} x2={boxW} y2={cy} class="aw-center" />{/if}
    {#if legE}<line x1={boxE} y1={cy} x2={W} y2={cy} class="aw-center" />{/if}
    {#if legN}<line x1={cx} y1="0" x2={cx} y2={boxN} class="aw-center" />{/if}
    {#if legS}<line x1={cx} y1={boxS} x2={cx} y2={H} class="aw-center" />{/if}

    <!-- ══ lane lines ══ -->
    {#each Array.from({ length: Math.max(0, nEB - 1) }) as _, i}
      <line x1="0" y1={cy + LANE * (i + 1)} x2={boxW} y2={cy + LANE * (i + 1)} class="aw-lane-line" />
    {/each}
    {#each Array.from({ length: Math.max(0, nWB - 1) }) as _, i}
      <line x1={boxE} y1={cy - LANE * (i + 1)} x2={W} y2={cy - LANE * (i + 1)} class="aw-lane-line" />
    {/each}
    {#each Array.from({ length: Math.max(0, nNB - 1) }) as _, i}
      <line x1={cx + LANE * (i + 1)} y1={boxS} x2={cx + LANE * (i + 1)} y2={H} class="aw-lane-line" />
    {/each}
    {#each Array.from({ length: Math.max(0, nSB - 1) }) as _, i}
      <line x1={cx - LANE * (i + 1)} y1="0" x2={cx - LANE * (i + 1)} y2={boxN} class="aw-lane-line" />
    {/each}

    <!-- ══ stop bars on every present approach ══ -->
    {#if legW}<line x1={boxW - 2} y1={cy} x2={boxW - 2} y2={boxS} class="aw-stop" /><text
        x={boxW - 8}
        y={boxS + 12}
        class="aw-stop-label"
        text-anchor="end">STOP</text
      >{/if}
    {#if legE}<line x1={boxE + 2} y1={boxN} x2={boxE + 2} y2={cy} class="aw-stop" /><text
        x={boxE + 8}
        y={cy - 4}
        class="aw-stop-label">STOP</text
      >{/if}
    {#if legS}<line x1={cx} y1={boxS + 2} x2={boxE} y2={boxS + 2} class="aw-stop" /><text
        x={boxE + 6}
        y={boxS + 14}
        class="aw-stop-label">STOP</text
      >{/if}
    {#if legN}<line x1={boxW} y1={boxN - 2} x2={cx} y2={boxN - 2} class="aw-stop" /><text
        x={boxW - 6}
        y={boxN - 8}
        class="aw-stop-label"
        text-anchor="end">STOP</text
      >{/if}

    <!-- ══ movement paths ══ -->
    {#each order as o}
      {#each ['T', 'L', 'R'] as mv}
        {#if paths[o.key][mv]}
          <path d={paths[o.key][mv]} class={`mv-${o.key.toLowerCase()} ${cls(hovered, o.key)}`} />
        {/if}
      {/each}
    {/each}

    <!-- ══ illustrative vehicles ══ -->
    {#if animating}
      {#each vehiclePlan as v (v.id)}
        <g class="aw-veh veh-{v.key.toLowerCase()}" class:dim={hovered != null && hovered !== v.key}>
          <rect x="-5" y="-2.6" width="10" height="5.2" rx="1.5" />
          <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s" path={v.d} />
        </g>
      {/each}
    {/if}

    <!-- ══ on-diagram volume editors (lane 1; multi-lane approaches edit in the form) ══ -->
    {#each editable ? order : [] as o (o.key)}
      {#if clusterPos[o.key]}
        <foreignObject x={clusterPos[o.key].x} y={clusterPos[o.key].y} width={CW} height={CH}>
          <div
            class="aw-cluster"
            xmlns="http://www.w3.org/1999/xhtml"
            onmouseenter={() => (hovered = o.key)}
            onmouseleave={() => (hovered = null)}
          >
            <span class="aw-cluster-title"><span class="swatch {o.key.toLowerCase()}"></span>{o.key}</span>
            {#each ['L', 'T', 'R'] as mv}
              <input
                type="number"
                min="0"
                title={counts[o.key] > 1
                  ? 'Multi-lane approach: edit per lane in the form'
                  : `${o.key} ${mv} volume (veh/h)`}
                aria-label="{o.key} {mv === 'L' ? 'left-turn' : mv === 'T' ? 'through' : 'right-turn'} volume"
                value={lane1(approaches, o.key)[{ L: 'left', T: 'through', R: 'right' }[mv]]}
                disabled={counts[o.key] > 1 || !paths[o.key][mv]}
                oninput={(e) => setVol(o.key, mv, e.currentTarget.value)}
              />
            {/each}
          </div>
        </foreignObject>
      {/if}
    {/each}
  </svg>

  <div class="aw-legend" role="list">
    <button
      type="button"
      class="aw-chip aw-animate"
      class:active={animating}
      aria-pressed={animating}
      onclick={() => (animating = !animating)}
    >
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each order as o}
      <button
        type="button"
        role="listitem"
        class="aw-chip {o.key.toLowerCase()}"
        class:active={hovered === o.key}
        onmouseenter={() => (hovered = o.key)}
        onmouseleave={() => (hovered = null)}
        onfocus={() => (hovered = o.key)}
        onblur={() => (hovered = null)}
      >
        <span class="swatch {o.key.toLowerCase()}"></span>
        {o.label} ({counts[o.key]} lane{counts[o.key] === 1 ? '' : 's'})
      </button>
    {/each}
  </div>
  <p class="aw-note">
    Every approach stops. An approach with zero lanes removes its leg, matching the three-leg worked examples. Animated
    traffic slows and bunches with each approach LOS after a run. An illustration, not a simulation.
  </p>
</div>

<style>
  .awsc-diagram svg {
    width: 100%;
    max-width: 480px;
    display: block;
    margin: 0 auto;
  }
  .aw-pavement {
    fill: var(--diag-pavement);
  }
  .aw-edge {
    stroke: var(--diag-edge);
    stroke-width: 2;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .aw-center {
    stroke: var(--diag-center);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .aw-lane-line {
    stroke: var(--diag-lane-line);
    stroke-width: 1.5;
    stroke-dasharray: 8 6;
    vector-effect: non-scaling-stroke;
  }
  .aw-stop {
    stroke: var(--diag-lane-line);
    stroke-width: 3;
    vector-effect: non-scaling-stroke;
  }
  .aw-stop-label {
    font-size: 8px;
    font-weight: 700;
    fill: var(--diag-dim);
    letter-spacing: 0.08em;
  }

  .aw-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition:
      opacity 120ms ease,
      stroke-width 120ms ease;
    opacity: 0.75;
  }
  .aw-move.dim {
    opacity: 0.1;
  }
  .aw-move.active {
    stroke-width: 4;
    opacity: 1;
  }
  .mv-eb {
    stroke: #ea7317;
  }
  .mv-wb {
    stroke: #dc2626;
  }
  .mv-nb {
    stroke: #2563eb;
  }
  .mv-sb {
    stroke: #16a34a;
  }
  .swatch.eb {
    background: #ea7317;
  }
  .swatch.wb {
    background: #dc2626;
  }
  .swatch.nb {
    background: #2563eb;
  }
  .swatch.sb {
    background: #16a34a;
  }

  .aw-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .aw-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: transparent;
    cursor: default;
  }
  .aw-chip.active {
    border-color: var(--diag-edge);
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    display: inline-block;
  }
  .aw-note {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 0.35rem;
  }
  .aw-veh rect {
    stroke: rgba(15, 23, 42, 0.35);
    stroke-width: 0.6;
  }
  .aw-veh {
    transition: opacity 120ms ease;
  }
  .aw-veh.dim {
    opacity: 0.08;
  }
  .veh-eb rect {
    fill: #ea7317;
  }
  .veh-wb rect {
    fill: #dc2626;
  }
  .veh-nb rect {
    fill: #2563eb;
  }
  .veh-sb rect {
    fill: #16a34a;
  }
  .aw-animate {
    cursor: pointer;
    font-weight: 600;
  }

  .aw-cluster {
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 2px;
    width: 100%;
    height: 100%;
    font-size: 8px;
    line-height: 1;
    color: var(--text-secondary);
    background: color-mix(in srgb, var(--surface) 90%, transparent);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    padding: 2px 3px;
    overflow: hidden;
  }
  .aw-cluster-title {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 7px;
    font-weight: 600;
    flex: none;
  }
  .aw-cluster input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    flex: 1 1 0;
    font-size: 8px;
    line-height: 1;
    padding: 2px 1px;
    border: 1px solid var(--border-strong);
    border-radius: 3px;
    background: var(--surface);
    color: var(--text);
    text-align: center;
  }
  .aw-cluster input:disabled {
    opacity: 0.35;
  }
  .aw-cluster input::-webkit-outer-spin-button,
  .aw-cluster input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .aw-cluster input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .aw-cluster .swatch {
    width: 6px;
    height: 6px;
  }
</style>
