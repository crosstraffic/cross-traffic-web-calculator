// Shared projection helpers for the 3D diagram views. Plan coordinates are
// x east / y north; the projector rotates by yaw, foreshortens by pitch, and
// the fit helper centers and scales the projected model into the viewport.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function planProjector(yawDeg, pitchDeg) {
  const ay = (yawDeg * Math.PI) / 180;
  const ap = (pitchDeg * Math.PI) / 180;
  const cay = Math.cos(ay), say = Math.sin(ay), cap = Math.cos(ap);
  return (x, y) => {
    const x1 = x * cay - y * say;
    const y1 = x * say + y * cay;
    return { x: x1, y: -(y1 * cap) };
  };
}

// Same rotation as planProjector, with an elevation term so a model that
// carries height (road grade, superelevation banking) projects as height
// rather than as a plan offset. Plan-only diagrams keep using planProjector;
// both are accepted by fitTransform.
export function planProjector3(yawDeg, pitchDeg) {
  const ay = (yawDeg * Math.PI) / 180;
  const ap = (pitchDeg * Math.PI) / 180;
  const cay = Math.cos(ay), say = Math.sin(ay), cap = Math.cos(ap), sap = Math.sin(ap);
  return (x, y, z = 0) => {
    const x1 = x * cay - y * say;
    const y1 = x * say + y * cay;
    return { x: x1, y: -(y1 * cap + z * sap) };
  };
}

// Rotation-invariant fit: scale from the plan bounding radius (so zooming the
// camera around does not rescale), centered on the projected bounding box.
// Points may be [x, y] or [x, y, z]; a plan-only projector ignores the z and
// the elevation span collapses to zero, which leaves 2D models unchanged.
export function fitTransform(project, planPts, viewW, viewH, pad, zoom, panX, panY, thick, fill = 1.28) {
  const xs = planPts.map((p) => p[0]), ys = planPts.map((p) => p[1]), zs = planPts.map((p) => p[2] || 0);
  const rad = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  const spanZ = Math.max(...zs) - Math.min(...zs);
  const sc = Math.min((viewW - 2 * pad) / rad, (viewH - 2 * pad) / (rad + spanZ)) * fill * zoom;
  const pr = planPts.map((p) => project(p[0], p[1], p[2] || 0));
  const pxs = pr.map((p) => p.x), pys = pr.map((p) => p.y);
  const cxp = (Math.min(...pxs) + Math.max(...pxs)) / 2;
  const cyp = (Math.min(...pys) + Math.max(...pys)) / 2;
  const ox = viewW / 2 - cxp * sc + panX;
  const oy = viewH / 2 - cyp * sc + panY - thick / 2;
  return (x, y, z = 0) => {
    const p = project(x, y, z);
    return { x: p.x * sc + ox, y: p.y * sc + oy };
  };
}

export function qSample(p0, pc, p1, n = 14) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, u = 1 - t;
    out.push([
      u * u * p0[0] + 2 * u * t * pc[0] + t * t * p1[0],
      u * u * p0[1] + 2 * u * t * pc[1] + t * t * p1[1],
    ]);
  }
  return out;
}

export function cSample(p0, c1, c2, p1, n = 16) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ]);
  }
  return out;
}

// Path-string builders over a fitted transform.
export function makeDrawers(tf, thick) {
  const pt = ([x, y, z = 0]) => tf(x, y, z);
  const fmt = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  const polygon = (pts) => 'M' + pts.map((p) => fmt(pt(p))).join(' L') + ' Z';
  const polyline = (pts) => 'M' + pts.map((p) => fmt(pt(p))).join(' L');
  const shadow = (pts, drop = 3) =>
    'M' + pts.map((p) => { const q = pt(p); return `${q.x.toFixed(1)},${(q.y + thick + drop).toFixed(1)}`; }).join(' L') + ' Z';
  // One wall quad per outline edge, extruded downward in screen space. Interior
  // walls get covered when the tops draw after them; silhouette walls remain.
  const walls = (pts) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pt(pts[i]), b = pt(pts[(i + 1) % pts.length]);
      out.push(`M${fmt(a)} L${fmt(b)} L${b.x.toFixed(1)},${(b.y + thick).toFixed(1)} L${a.x.toFixed(1)},${(a.y + thick).toFixed(1)} Z`);
    }
    return out;
  };
  const seg = (a, b) => `M${fmt(pt(a))} L${fmt(pt(b))}`;
  return { polygon, polyline, shadow, walls, seg };
}
