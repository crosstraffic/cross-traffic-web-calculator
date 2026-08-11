<script>
  // 3D view of a two-lane highway facility (HCM Chapter 15): one extruded slab
  // per segment, laid end to end along a centreline that bends with the
  // horizontal-curve radii, climbs with the grade, and banks with the
  // superelevation. The predecessor drew the whole facility as a single
  // surface, which looked continuous but made a segment impossible to point
  // at; one polygon per segment keeps the continuity (neighbours share their
  // boundary station) and makes each segment selectable.
  import Camera3DSvg from '$lib/Camera3DSvg.svelte';
  import { planProjector3, fitTransform, makeDrawers } from '$lib/proj3d.js';
  import { LOS_COLORS } from '$lib/los.js';

  let {
    rows = [],
    laneWidth = 12,
    results = null,
    selected = -1,
    onselect = null,
  } = $props();

  const VIEW_W = 560;
  const VIEW_H = 260; // a facility is long and shallow; a square frame wastes half of it
  const THICK = 9;      // slab thickness, screen px
  const Z_EXAG = 7;     // grade elevation exaggeration
  const BANK_EXAG = 6;  // superelevation exaggeration

  // Tap-to-select without stealing the camera drag: the camera captures the
  // pointer, so pointerup retargets to the svg and no click fires on the slab.
  // Record where a slab was pressed and treat a release within a few pixels as
  // a tap on it. Same threshold as the Chapter 10 facility view.
  let pendingTap = null;
  function pressTop(e, i) {
    pendingTap = { i, x: e.clientX, y: e.clientY };
  }
  function release(e) {
    if (pendingTap && Math.hypot(e.clientX - pendingTap.x, e.clientY - pendingTap.y) < 6) {
      onselect?.(pendingTap.i);
    }
    pendingTap = null;
  }

  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const dashFor = (t) => (t === 'Passing Zone' ? '6 5' : null);

  const STEPS = 190; // stations across the whole facility

  let model = $derived.by(() => {
    // Segment lengths arrive in miles, subsegment lengths in FEET.
    const segs = (rows || []).map((r) => ({
      type: r.passing_type || '',
      len: num(r.seg_length, 0),
      grade: num(r.seg_grade, 0),
      isHc: !!r.is_hc,
      num: r.seg_num,
      subs: (r.subrows || []).map((s) => ({
        len: num(s.subseg_length, 0) / 5280,
        radius: num(s.design_radius, 0) / 5280,
        supere: num(s.superelevation, 0),
      })),
    }));
    if (!segs.length) return null;

    // A facility with no lengths entered yet still deserves a drawing, so fall
    // back to equal-length segments; a partly filled one gets stubs.
    const anyLength = segs.some((s) => s.len > 0);
    segs.forEach((s) => (s.elen = s.len > 0 ? s.len : anyLength ? 0.0015 : 1));
    const total = segs.reduce((a, s) => a + s.elen, 0) || 1;

    const lwF = laneWidth > 0 ? laneWidth / 12 : 1;
    const base = total * 0.019 * lwF; // one lane half-extent, plan units; exaggerated so lane markings and the passing-lane widening stay readable at facility scale

    // Curvature and superelevation come from whichever horizontal-curve
    // subsegment covers the current position within the segment.
    const sample = (segPos, s) => {
      let kappa = 0, supere = 0;
      if (s.isHc) {
        let acc = 0;
        for (const sub of s.subs) {
          if (sub.len <= 0) continue;
          if (segPos >= acc && segPos < acc + sub.len) {
            if (sub.radius > 0) kappa = 1 / sub.radius;
            supere = sub.supere;
            break;
          }
          acc += sub.len;
        }
      }
      return { kappa, supere };
    };

    let hx = 0, hy = 0, heading = Math.PI / 2, elev = 0;
    let kappa = 0, supere = 0;
    const stn = [];
    const ranges = [];

    const push = (s, f) => {
      // Passing-lane taper: the extra lane opens and closes inside the segment.
      const t = s.type === 'Passing Lane'
        ? (f < 0.18 ? smooth(f / 0.18) : f > 0.82 ? smooth((1 - f) / 0.18) : 1)
        : 0;
      const lat = { x: -Math.sin(heading), y: Math.cos(heading) };
      const hwR = base * (1 + t);
      // Banking carries only BANK_EXAG. The predecessor applied the grade
      // exaggeration on top of it, which turned a 4% superelevation into a
      // cross-slope steep enough to read as a flared end rather than a curve.
      const bank = (supere / 100) * base * BANK_EXAG * (kappa > 0 ? 1 : kappa < 0 ? -1 : 0);
      const z = elev * Z_EXAG;
      stn.push({
        c: [hx, hy, z],
        l: [hx + lat.x * base, hy + lat.y * base, z - bank],
        r: [hx - lat.x * hwR, hy - lat.y * hwR, z + bank],
        d: [hx - lat.x * base, hy - lat.y * base, z],
        pl: t > 0.05,
      });
    };

    ({ kappa, supere } = sample(0, segs[0]));
    push(segs[0], 0);
    for (const s of segs) {
      const start = stn.length - 1;
      const n = Math.max(2, Math.round((s.elen / total) * STEPS));
      const step = s.elen / n;
      let segPos = 0;
      for (let k = 0; k < n; k++) {
        ({ kappa, supere } = sample(segPos, s));
        heading += kappa * step;
        hx += Math.cos(heading) * step;
        hy += Math.sin(heading) * step;
        elev += step * (s.grade / 100);
        segPos += step;
        push(s, segPos / s.elen);
      }
      ranges.push([start, stn.length - 1]);
    }

    const built = segs.map((s, si) => {
      const [a, b] = ranges[si];
      const span = stn.slice(a, b + 1);
      const mid = stn[Math.floor((a + b) / 2)];
      // Passing-lane divider only where the extra lane is actually open.
      const plRun = span.filter((p) => p.pl).map((p) => p.d);
      return {
        num: s.num,
        type: s.type,
        left: span.map((p) => p.l),
        right: span.map((p) => p.r),
        outline: [...span.map((p) => p.l), ...[...span].reverse().map((p) => p.r)],
        center: span.map((p) => p.c),
        divider: plRun.length > 1 ? plRun : null,
        dash: dashFor(s.type),
        mid: mid.c,
      };
    });

    // Travel-direction arrow, extrapolated past the downstream end so it
    // reads as an arrow rather than as a stub between two adjacent stations.
    const last = stn[stn.length - 1], prev = stn[stn.length - 2] || last;
    const dx = last.c[0] - prev.c[0], dy = last.c[1] - prev.c[1];
    const mag = Math.hypot(dx, dy) || 1;
    const reach = total * 0.035;
    return {
      segs: built,
      pts: stn.flatMap((p) => [p.l, p.r, p.c]),
      arrow: {
        from: last.c,
        to: [last.c[0] + (dx / mag) * reach, last.c[1] + (dy / mag) * reach, last.c[2]],
      },
    };
  });

  const losFor = (i) => (results && results.segs[i] ? results.segs[i].los : null);
  const topFill = (i) => LOS_COLORS[losFor(i)] ?? 'var(--diag-pavement)';
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tl3-wrap" onpointerup={release} onpointercancel={() => (pendingTap = null)}>
  {#if !model}
    <p class="tl3-empty">Add a segment to see the connected facility.</p>
  {:else}
    <Camera3DSvg viewW={VIEW_W} viewH={VIEW_H} defYaw={28} defPitch={38}
                 ariaLabel="two-lane highway facility 3D view, {model.segs.length} segments">
      {#snippet children({ yaw, pitch, zoom, panX, panY })}
        {@const project = planProjector3(yaw, pitch)}
        <!-- A facility is nearly a line, so its projected extent is far smaller than
             its bounding radius; the fit factor compensates. The radius (not the
             projected box) is still what sets the scale, so rotating does not
             resize the model. -->
        {@const tf = fitTransform(project, model.pts, VIEW_W, VIEW_H, 26, zoom, panX, panY, THICK, 1.75)}
        {@const d = makeDrawers(tf, THICK)}

        {#each model.segs as s}
          <path d={d.shadow(s.outline)} class="tl3-shadow" />
        {/each}

        <!-- Side walls as one strip per edge rather than the shared per-edge
             quads: a ribbon has one station every few pixels, and the seams
             between that many quads read as a comb down the side of the road.
             All walls draw before any top, so the joins between neighbouring
             slabs end up underneath. -->
        {@const px = (p) => { const q = tf(p[0], p[1], p[2]); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }}
        {@const dropped = (p) => { const q = tf(p[0], p[1], p[2]); return `${q.x.toFixed(1)},${(q.y + THICK).toFixed(1)}`; }}
        {@const wall = (edge) => 'M' + edge.map(px).join(' L') + ' L' + [...edge].reverse().map(dropped).join(' L') + ' Z'}
        {#each model.segs as s}
          <path d={wall(s.left)} class="tl3-wall" />
          <path d={wall(s.right)} class="tl3-wall" />
          <path d={wall([s.left[0], s.right[0]])} class="tl3-wall" />
          <path d={wall([s.left.at(-1), s.right.at(-1)])} class="tl3-wall" />
        {/each}

        {#each model.segs as s, i}
          <path d={d.polygon(s.outline)} fill={topFill(i)}
                class="tl3-top tl3-deck" class:scored={losFor(i) != null} class:selected={selected === i}
                onpointerdown={(e) => pressTop(e, i)} />
        {/each}

        {#each model.segs as s}
          <path d={d.polyline(s.center)} class="tl3-center" stroke-dasharray={s.dash} />
          {#if s.divider}
            <path d={d.polyline(s.divider)} class="tl3-center tl3-divider" stroke-dasharray="3 5" />
          {/if}
        {/each}

        {#each model.segs as s, i}
          {@const m = tf(...s.mid)}
          {#if losFor(i)}
            <text x={m.x} y={m.y + 3} class="tl3-los" text-anchor="middle">{losFor(i)}</text>
          {/if}
          <text x={m.x} y={m.y - 12} class="tl3-num" text-anchor="middle">{s.num}</text>
        {/each}

        <!-- direction of travel, off the downstream end -->
        {@const a0 = tf(...model.arrow.from)}
        {@const a1 = tf(...model.arrow.to)}
        <line x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} class="tl3-arrow" marker-end="url(#tl3ArrowHead)" />
        <defs>
          <marker id="tl3ArrowHead" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" class="tl3-arrow-head" />
          </marker>
        </defs>
      {/snippet}
    </Camera3DSvg>
  {/if}
</div>

<style>
  .tl3-empty { font-size: 0.78rem; color: var(--text-faint); }
  .tl3-shadow { fill: var(--text); opacity: 0.08; }
  /* No wall stroke: one quad per outline edge means a 190-station ribbon
     would otherwise draw as a comb of hairlines down its own side. */
  .tl3-wall { fill: var(--diag-wall); stroke: none; }
  .tl3-top { stroke: var(--diag-edge); stroke-width: 1; vector-effect: non-scaling-stroke; transition: fill 150ms ease; }
  .tl3-top.scored { stroke: rgba(15, 23, 42, 0.4); }
  .tl3-top.selected { stroke: var(--accent); stroke-width: 2.5; }
  .tl3-deck { cursor: pointer; }
  /* Markings and labels must not swallow slab taps. */
  .tl3-center, .tl3-los, .tl3-num, .tl3-arrow { pointer-events: none; }
  .tl3-center { fill: none; stroke: var(--diag-center); stroke-width: 1.6; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .tl3-divider { stroke: var(--diag-lane-line); }
  .tl3-los { font-size: 9px; fill: #fff; font-weight: 700; paint-order: stroke; stroke: rgba(15, 23, 42, 0.45); stroke-width: 2px; }
  .tl3-num { font-size: 7.5px; fill: var(--text-muted); font-weight: 600; }
  .tl3-arrow { stroke: var(--diag-dim); stroke-width: 1.4; }
  .tl3-arrow-head { fill: var(--diag-dim); }
</style>
