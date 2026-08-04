<script>
  // Rotatable 3D view of the interchange: the arterial, ramp stubs, and O-D
  // movement paths sit at grade while the freeway carriageways cross on an
  // elevated deck (drawn last, lifted in screen space with deep walls, so it
  // reads as the overpass it is). Form-aware: the DDI variant crosses the
  // arterial throughs between the terminals.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector, fitTransform, makeDrawers, qSample } from '$lib/proj3d.js';

  /**
   * @typedef {Object} Props
   * @property {any} [odDemands]
   * @property {any} [odLos]
   * @property {string} [form]
   * @property {string} [ddiEb]
   * @property {string} [ddiWb]
   */

  /** @type {Props} */
  let {
    odDemands = [],
    odLos = {},
    form = 'Diamond',
    ddiEb = 'ThreeLaneExclusive',
    ddiWb = 'TwoLaneShared'
  } = $props();

  let hovered = $state(null);

  const VIEW_W = 560, VIEW_H = 330, PAD = 22, THICK = 8, ELEV = 26;

  // Plan geometry in the 2D component's coordinate frame (y down), flipped to
  // world (y north) when handed to the projector.
  const W = 520, H = 320, cy = 160, cx = 260;
  const xW = 165, xE = 355, FWY = 38, GAP = 12, LEAN = 46;
  const ebN = cy - 10, wbS = cy + 10;
  // Lane-reactive halves mirroring the 2D view.
  let nEbLanes = $derived(form === 'Ddi' ? (String(ddiEb).startsWith('Two') ? 2 : 3) : 2);
  let nWbLanes = $derived(form === 'Ddi' ? (String(ddiWb).startsWith('Two') ? 2 : 3) : 2);
  let sharedEb = $derived(form === 'Ddi' && (ddiEb === 'TwoLaneShared' || ddiEb === 'ThreeLaneShared'));
  let sharedWb = $derived(form === 'Ddi' && (ddiWb === 'TwoLaneShared' || ddiWb === 'ThreeLaneShared'));
  let hEB = $derived(nEbLanes * 14);
  let hWB = $derived(nWbLanes * 14);
  let edgeS = $derived(cy + hEB);
  let edgeN = $derived(cy - hWB);
  let ebLane = $derived((i) => cy + hEB - (i + 0.5) * 14);
  let wbLane = $derived((i) => cy - hWB + (i + 0.5) * 14);
  let ebOut = $derived(ebLane(0));
  let ebIn = $derived(ebLane(nEbLanes - 1));
  let wbOut = $derived(wbLane(0));
  let wbIn = $derived(wbLane(nWbLanes - 1));
  let yI = $derived(sharedEb ? ebIn : ebLane(nEbLanes - 2));
  let yJ = $derived(sharedWb ? wbIn : wbLane(nWbLanes - 2));
  let stubs = $derived({
    sbOff: { x0: xW, y0: edgeN, x1: xW + LEAN, y1: 16 },
    sbOn: { x0: xW, y0: edgeS, x1: xW + LEAN, y1: H - 16 },
    nbOn: { x0: xE, y0: edgeN, x1: xE - LEAN, y1: 16 },
    nbOff: { x0: xE, y0: edgeS, x1: xE - LEAN, y1: H - 16 },
  });
  let arterial = $derived([[0, edgeN], [W, edgeN], [W, edgeS], [0, edgeS]]);
  const at = (s, t) => [s.x0 + (s.x1 - s.x0) * t, s.y0 + (s.y1 - s.y0) * t];
  const stubPoly = (s) => {
    const dx = 11;
    return [[s.x0 - dx, s.y0], [s.x0 + dx, s.y0], [s.x1 + dx, s.y1], [s.x1 - dx, s.y1]];
  };

  // One deck spanning both carriageways and the median, so the overpass reads
  // as a single structure rather than two floating slabs.
  const fwyDeck = [[cx - FWY - GAP / 2, 0], [cx + FWY + GAP / 2, 0], [cx + FWY + GAP / 2, H], [cx - FWY - GAP / 2, H]];
  const medianW = [[cx - GAP / 2, 0], [cx - GAP / 2, H]];
  const medianE = [[cx + GAP / 2, 0], [cx + GAP / 2, H]];
  // Pier stations along the deck, clear of the arterial opening.
  const PIERS = [34, 96, H - 96, H - 34];

  // O-D paths as point arrays; node curves sampled with qSample.
  function buildPaths(form, ebOut, ebIn, wbOut, wbIn, yI, yJ, stubs) {
    const q = (p0, pc, p1) => qSample(p0, pc, p1, 10);
    const common = {
      B: [at(stubs.nbOff, 1), at(stubs.nbOff, 0.15), ...q(at(stubs.nbOff, 0.15), [xE + 4, ebOut], [xE + 26, ebOut]), [W, ebOut]],
      C: [at(stubs.sbOff, 1), at(stubs.sbOff, 0.15), ...q(at(stubs.sbOff, 0.15), [xW - 4, wbOut], [xW - 26, wbOut]), [0, wbOut]],
      F: [[0, ebOut], [xW - 26, ebOut], ...q([xW - 26, ebOut], [xW + 2, ebOut], at(stubs.sbOn, 0.15)), at(stubs.sbOn, 1)],
      G: [[W, wbOut], [xE + 26, wbOut], ...q([xE + 26, wbOut], [xE - 2, wbOut], at(stubs.nbOn, 0.15)), at(stubs.nbOn, 1)],
    };
    if (form === 'Ddi') {
      return {
        ...common,
        A: [at(stubs.nbOff, 1), at(stubs.nbOff, 0.1), ...q(at(stubs.nbOff, 0.1), [xE - 2, wbS], [xE - 26, wbS]), [xW + 30, wbS], ...q([xW + 30, wbS], [xW + 6, wbS + (wbIn - wbS) / 2], [xW - 26, wbIn]), [0, wbIn]],
        D: [at(stubs.sbOff, 1), at(stubs.sbOff, 0.1), ...q(at(stubs.sbOff, 0.1), [xW + 2, ebN], [xW + 26, ebN]), [xE - 30, ebN], ...q([xE - 30, ebN], [xE - 6, ebN + (ebIn - ebN) / 2], [xE + 26, ebIn]), [W, ebIn]],
        E: [[0, ebIn], [xW - 30, ebIn], ...q([xW - 30, ebIn], [xW - 6, (ebIn + ebN) / 2], [xW + 26, ebN]), [xE - 30, ebN], ...q([xE - 30, ebN], [xE - 4, ebN], at(stubs.nbOn, 0.14)), at(stubs.nbOn, 1)],
        H: [[W, wbIn], [xE + 30, wbIn], ...q([xE + 30, wbIn], [xE + 6, (wbIn + wbS) / 2], [xE - 26, wbS]), [xW + 30, wbS], ...q([xW + 30, wbS], [xW + 4, wbS], at(stubs.sbOn, 0.13)), at(stubs.sbOn, 1)],
        I: [[0, yI], [xW - 30, yI], ...q([xW - 30, yI], [xW - 6, (yI + ebN - 6) / 2], [xW + 26, ebN - 6]), [xE - 30, ebN - 6], ...q([xE - 30, ebN - 6], [xE - 6, (yI + ebN - 6) / 2], [xE + 26, yI]), [W, yI]],
        J: [[W, yJ], [xE + 30, yJ], ...q([xE + 30, yJ], [xE + 6, (yJ + wbS + 6) / 2], [xE - 26, wbS + 6]), [xW + 30, wbS + 6], ...q([xW + 30, wbS + 6], [xW + 6, (yJ + wbS + 6) / 2], [xW - 26, yJ]), [0, yJ]],
      };
    }
    return {
      ...common,
      A: [at(stubs.nbOff, 1), at(stubs.nbOff, 0.1), ...q(at(stubs.nbOff, 0.1), [xE, wbIn], [xE - 24, wbIn]), [0, wbIn]],
      D: [at(stubs.sbOff, 1), at(stubs.sbOff, 0.1), ...q(at(stubs.sbOff, 0.1), [xW, ebIn], [xW + 24, ebIn]), [W, ebIn]],
      E: [[0, ebIn], [xE - 26, ebIn], ...q([xE - 26, ebIn], [xE, ebIn], at(stubs.nbOn, 0.12)), at(stubs.nbOn, 1)],
      H: [[W, wbIn], [xW + 26, wbIn], ...q([xW + 26, wbIn], [xW, wbIn], at(stubs.sbOn, 0.12)), at(stubs.sbOn, 1)],
      I: [[0, (ebIn + ebOut) / 2], [W, (ebIn + ebOut) / 2]],
      J: [[W, (wbIn + wbOut) / 2], [0, (wbIn + wbOut) / 2]],
    };
  }
  let paths = $derived(buildPaths(form, ebOut, ebIn, wbOut, wbIn, yI, yJ, stubs));

  const groupOf = { A: 'NBOFF', B: 'NBOFF', C: 'SBOFF', D: 'SBOFF', E: 'EB', F: 'EB', I: 'EB', G: 'WB', H: 'WB', J: 'WB' };
  const clsOf = { NBOFF: 'nboff', SBOFF: 'sboff', EB: 'ebg', WB: 'wbg' };
  const GROUPS = [
    { key: 'NBOFF', label: 'NB off-ramp' },
    { key: 'SBOFF', label: 'SB off-ramp' },
    { key: 'EB', label: 'EB arterial' },
    { key: 'WB', label: 'WB arterial' },
  ];

  let volOf = $derived(Object.fromEntries((odDemands || []).map((d) => [d.key, Number(d.value) || 0])));

  let animating = $state(false);
  const LOS_SPEED = { A: 1, B: 0.85, C: 0.7, D: 0.5, E: 0.32, F: 0.16 };
  const LOS_FLEET = { A: 1, B: 1, C: 1.1, D: 1.3, E: 1.7, F: 2.3 };
  let vehiclePlan = $derived((() => {
    if (!animating) return [];
    const raw = [];
    let total = 0;
    for (const letter of Object.keys(groupOf)) {
      const vol = volOf[letter.toLowerCase()] || 0;
      if (vol <= 0) continue;
      const slow = LOS_SPEED[odLos?.[letter]] ?? 1;
      const crowd = LOS_FLEET[odLos?.[letter]] ?? 1;
      raw.push({ letter, group: groupOf[letter], vol, dur: 7 / slow, crowd });
      total += vol;
    }
    const items = [];
    for (const it of raw) {
      const n = Math.max(1, Math.min(6, Math.round((24 * it.vol * it.crowd) / (total || 1))));
      for (let j = 0; j < n; j++) {
        items.push({ id: it.letter + j, letter: it.letter, group: it.group, dur: it.dur, begin: (-(j + 0.4 * (j % 2)) / n) * it.dur });
      }
    }
    return items;
  })());

  const flip = (pts) => pts.map(([x, y]) => [x, -y]);
  let fitPts = $derived(flip([[0, 0], [W, 0], [W, H], [0, H]]));

  function cls(h, key) {
    if (h == null) return 'dd3-move';
    return h === key ? 'dd3-move active' : 'dd3-move dim';
  }
</script>

<div class="dd-diagram-3d">
  <Camera3DSvg viewW={VIEW_W} viewH={VIEW_H} defYaw={20} defPitch={44}
      ariaLabel={form === 'Ddi' ? 'diverging diamond interchange, 3D view' : 'conventional diamond interchange, 3D view'}
          >
    {#snippet children({ yaw, pitch, zoom, panX, panY })}
        {@const project = planProjector(yaw, pitch)}
      {@const tf = fitTransform(project, fitPts, VIEW_W, VIEW_H, PAD, zoom, panX, panY, THICK, 1.02)}
      {@const tfUp = (x, y) => { const p = tf(x, y); return { x: p.x, y: p.y - ELEV }; }}
      {@const d = makeDrawers(tf, THICK)}
      {@const dUp = makeDrawers(tfUp, 10)}

      <!-- at-grade: arterial and ramp stubs -->
      <path d={d.shadow(flip(arterial))} class="dd3-shadow" />
      {#each Object.values(stubs) as s}
        <path d={d.shadow(flip(stubPoly(s)))} class="dd3-shadow" />
      {/each}
      {#each Object.values(stubs) as s}
        {#each d.walls(flip(stubPoly(s))) as w}
          <path d={w} class="dd3-wall" />
        {/each}
      {/each}
      {#each d.walls(flip(arterial)) as w}
        <path d={w} class="dd3-wall" />
      {/each}
      {#each Object.values(stubs) as s}
        <path d={d.polygon(flip(stubPoly(s)))} class="dd3-top" />
      {/each}
      <path d={d.polygon(flip(arterial))} class="dd3-top" />

      <!-- movement paths and vehicles at grade -->
      {#each Object.entries(paths) as [letter, pts]}
        {#if (volOf[letter.toLowerCase()] || 0) > 0}
          <path d={d.polyline(flip(pts))} class={`mv-${clsOf[groupOf[letter]]} ${cls(hovered, groupOf[letter])}`} />
        {/if}
      {/each}
      {#if animating}
        {#each vehiclePlan as v (v.id)}
          <g class="dd3-veh veh-{clsOf[v.group]}" class:dim={hovered != null && hovered !== v.group}>
            <rect x="-4" y="-2.1" width="8" height="4.2" rx="1.2" />
            <animateMotion dur="{v.dur}s" repeatCount="indefinite" rotate="auto" begin="{v.begin}s"
                           path={d.polyline(flip(paths[v.letter]))} />
          </g>
        {/each}
      {/if}

      <!-- elevated freeway deck, drawn last so it crosses over everything -->
      <path d={d.shadow(flip(fwyDeck))} class="dd3-shadow" />
      {#each PIERS as py}
        {@const g = tf(cx, -py)}
        {@const u = tfUp(cx, -py)}
        <line x1={g.x} y1={g.y} x2={u.x} y2={u.y + 9} class="dd3-pier" />
      {/each}
      {#each dUp.walls(flip(fwyDeck)) as w}
        <path d={w} class="dd3-deckwall" />
      {/each}
      <path d={dUp.polygon(flip(fwyDeck))} class="dd3-deck" />
      <path d={dUp.polyline(flip(medianW))} class="dd3-median" />
      <path d={dUp.polyline(flip(medianE))} class="dd3-median" />
          {/snippet}
    </Camera3DSvg>

  <div class="dd3-legend" role="list">
    <button type="button" class="dd3-chip dd3-animate" class:active={animating}
            aria-pressed={animating} onclick={() => (animating = !animating)}>
      {animating ? '⏸ Stop traffic' : '▶ Animate traffic'}
    </button>
    {#each GROUPS as g}
      <button
        type="button"
        role="listitem"
        class="dd3-chip {clsOf[g.key]}"
        class:active={hovered === g.key}
        onmouseenter={() => (hovered = g.key)}
        onmouseleave={() => (hovered = null)}
        onfocus={() => (hovered = g.key)}
        onblur={() => (hovered = null)}
      >
        <span class="swatch {clsOf[g.key]}"></span>
        {g.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .dd3-shadow { fill: #0f172a; opacity: 0.08; }
  .dd3-wall { fill: var(--diag-wall); stroke: var(--diag-wall-edge); stroke-width: 0.5; }
  .dd3-top { fill: var(--diag-pavement); stroke: var(--diag-edge); stroke-width: 1.25; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .dd3-deckwall { fill: var(--diag-wall); stroke: var(--diag-wall-edge); stroke-width: 0.5; opacity: 0.92; }
  .dd3-pier { stroke: var(--diag-wall); stroke-width: 7; stroke-linecap: butt; }
  .dd3-median { fill: none; stroke: var(--diag-center); stroke-width: 1.1; vector-effect: non-scaling-stroke; opacity: 0.8; }
  .dd3-deck { fill: var(--diag-pavement-alt); stroke: var(--diag-edge); stroke-width: 1.25; stroke-linejoin: round; vector-effect: non-scaling-stroke; }

  .dd3-move {
    fill: none;
    stroke-width: 2.25;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    transition: opacity 120ms ease, stroke-width 120ms ease;
    opacity: 0.75;
  }
  .dd3-move.dim { opacity: 0.08; }
  .dd3-move.active { stroke-width: 4; opacity: 1; }
  .mv-nboff { stroke: #2563eb; }
  .mv-sboff { stroke: #16a34a; }
  .mv-ebg { stroke: #ea7317; }
  .mv-wbg { stroke: #dc2626; }
  .swatch.nboff { background: #2563eb; }
  .swatch.sboff { background: #16a34a; }
  .swatch.ebg { background: #ea7317; }
  .swatch.wbg { background: #dc2626; }

  .dd3-veh rect { stroke: rgba(15, 23, 42, 0.35); stroke-width: 0.6; }
  .dd3-veh { transition: opacity 120ms ease; }
  .dd3-veh.dim { opacity: 0.08; }
  .veh-nboff rect { fill: #2563eb; }
  .veh-sboff rect { fill: #16a34a; }
  .veh-ebg rect { fill: #ea7317; }
  .veh-wbg rect { fill: #dc2626; }

  .dd3-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.35rem; }
  .dd3-chip {
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
  .dd3-chip.active { border-color: var(--diag-edge); }
  .dd3-animate { cursor: pointer; font-weight: 600; }
  .swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
</style>
