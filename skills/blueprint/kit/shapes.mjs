// Shapes beyond the primitives. Every generator returns a mesh, { type: 'mesh', pts, tris }:
// points in plan coordinates (mm) and triangles as index triples, wound so they face
// outward. The 3D view, the drawings, the bounding boxes and 3D prints (STL, .scad,
// filament) all take a mesh, so a plan is never limited to boxes and cylinders: when no
// generator fits, write the points and triangles yourself, or build them from these.
// In a plan: build(p, k) gets them as k.shapes.
import { v3 } from './core.mjs';
const { sub, add, mul, cross, norm, dot, len } = v3;

// two unit vectors square to an axis and to each other
function frame(ax) {
  const a = norm(ax), u = norm(cross(a, Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  return [u, cross(a, u)];
}
const ring = (c, u, w, r, n) => Array.from({ length: n }, (_, k) => { const t = (k / n) * 2 * Math.PI; return add(c, add(mul(u, r * Math.cos(t)), mul(w, r * Math.sin(t)))); });

// rings of n points joined into a tube; capped ends close it (a solid, so it can be printed)
function loft(rings, { caps = true } = {}) {
  const n = rings[0].length, pts = rings.flat(), tris = [];
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < n; k++) {
    const a = i * n + k, b = i * n + ((k + 1) % n), c = a + n, d = b + n;
    tris.push([a, b, d], [a, d, c]);
  }
  if (caps) {
    const s = pts.length, e = s + 1, last = (rings.length - 1) * n;
    pts.push(rings[0].reduce((p, q) => add(p, mul(q, 1 / n)), [0, 0, 0]), rings[rings.length - 1].reduce((p, q) => add(p, mul(q, 1 / n)), [0, 0, 0]));
    for (let k = 0; k < n; k++) { tris.push([s, (k + 1) % n, k]); tris.push([e, last + k, last + ((k + 1) % n)]); }
  }
  return orient({ type: 'mesh', pts, tris });
}

// make every triangle face away from the inside (signed volume positive)
function orient(m) { if (meshVolume(m) < 0) m.tris = m.tris.map(([a, b, c]) => [a, c, b]); return m; }

export const shapes = {
  // a ball
  sphere(c, r, n = 24) {
    const rows = Array.from({ length: n / 2 - 1 }, (_, i) => { const t = ((i + 1) / (n / 2)) * Math.PI; return ring(add(c, [0, 0, -r * Math.cos(t)]), [1, 0, 0], [0, 1, 0], r * Math.sin(t), n); });
    const m = loft(rows, { caps: false }), s = m.pts.length, last = (rows.length - 1) * n;
    m.pts.push(add(c, [0, 0, -r]), add(c, [0, 0, r]));
    for (let k = 0; k < n; k++) { m.tris.push([s, (k + 1) % n, k]); m.tris.push([s + 1, last + k, last + ((k + 1) % n)]); }
    return orient(m);
  },
  // a cone or a frustum from a (radius r1) to b (radius r2); r2 = 0 makes a point
  cone(a, b, r1, r2 = 0, n = 32) {
    const [u, w] = frame(sub(b, a));
    return loft([ring(a, u, w, r1, n), ring(b, u, w, Math.max(r2, 1e-3), n)]);
  },
  // a tube of radius r along a path of points (a rail, a hose, a bent bar), round in section
  sweep(path, r, n = 24) {
    const rings = path.map((p, i) => {
      const t = norm(sub(path[Math.min(i + 1, path.length - 1)], path[Math.max(i - 1, 0)]));
      const [u, w] = frame(t);
      return ring(p, u, w, r, n);
    });
    // keep the rings from twisting: turn each to follow the one before
    for (let i = 1; i < rings.length; i++) {
      const prev = rings[i - 1], cur = rings[i];
      let best = 0, bd = Infinity;
      for (let s = 0; s < n; s++) { const d = len(sub(cur[s], prev[0])); if (d < bd) { bd = d; best = s; } }
      rings[i] = cur.slice(best).concat(cur.slice(0, best));
    }
    return loft(rings);
  },
  // points along an arc: centre c, from point `from`, turning `deg` degrees about `axis`
  arc(c, from, axis, deg, steps = 16) {
    const a = norm(axis), r0 = sub(from, c);
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = ((deg * i) / steps) * Math.PI / 180, cs = Math.cos(t), sn = Math.sin(t);
      // Rodrigues rotation of r0 about a
      return add(c, add(add(mul(r0, cs), mul(cross(a, r0), sn)), mul(a, dot(a, r0) * (1 - cs))));
    });
  },
  // a curved tube: radius r round a bend of centre-line radius R from point `from`, `deg`
  // degrees about `axis` through the bend centre c (an elbow body, a bent rail)
  bend(c, from, axis, deg, r, n = 24) { return shapes.sweep(shapes.arc(c, from, axis, deg, Math.max(6, Math.round(Math.abs(deg) / 6))), r, n); },
  // a pipe elbow round centre c, its openings along d1 and d2: a socket hub of radius rHub
  // and depth sock on each, from z (centre to socket bottom) out, and a curved body of
  // radius rBody between them, tangent to both pipes. A list [hub, hub, body], not one mesh.
  elbow(c, d1, d2, z, sock, rHub, rBody, n = 24) {
    const a = norm(d1), b = norm(d2), cosA = dot(a, b);
    if (cosA < -0.999 || cosA > 0.999) throw new Error('elbow: d1 and d2 must not be parallel');
    const half = Math.acos(cosA) / 2, at = (d, t) => add(c, mul(d, t));
    const p1 = at(a, z), p2 = at(b, z), o = at(norm(add(a, b)), z / Math.cos(half));
    const hub = d => ({ type: 'cyl', a: at(d, z), b: at(d, z + sock), r: rHub });
    return [hub(a), hub(b), shapes.bend(o, p1, cross(sub(p1, o), sub(p2, o)), 180 - (2 * half * 180) / Math.PI, rBody, n)];
  },
  // a profile [[radius, height], ...] spun about the axis from a toward b (a knob, a foot, a bottle)
  revolve(profile, a, b, n = 32) {
    const ax = norm(sub(b, a)), [u, w] = frame(ax);
    return loft(profile.map(([rad, h]) => ring(add(a, mul(ax, h)), u, w, Math.max(rad, 1e-3), n)));
  },
  // a flat outline [[u, v], ...] pushed out along an axis ('x', 'y' or 'z') from z0 by h
  extrude(outline, z0, h, axis = 'z') {
    const place = (q, z) => (axis === 'x' ? [z, q[0], q[1]] : axis === 'y' ? [q[0], z, q[1]] : [q[0], q[1], z]);
    const n = outline.length, pts = [...outline.map(q => place(q, z0)), ...outline.map(q => place(q, z0 + h))], tris = [];
    for (let k = 0; k < n; k++) { const j = (k + 1) % n; tris.push([k, j, n + j], [k, n + j, n + k]); }
    // the caps as fans: right for convex outlines; split a concave one into convex pieces
    for (let k = 1; k + 1 < n; k++) { tris.push([0, k + 1, k]); tris.push([n, n + k, n + k + 1]); }
    return orient({ type: 'mesh', pts, tris });
  },
};

// helpers every consumer of a mesh shares
export function meshVolume(m) {
  let v = 0;
  for (const [a, b, c] of m.tris) v += dot(m.pts[a], cross(m.pts[b], m.pts[c])) / 6;
  return v;
}
export const meshBox = m => [[0, 1, 2].map(i => Math.min(...m.pts.map(p => p[i]))), [0, 1, 2].map(i => Math.max(...m.pts.map(p => p[i])))];
