// 3D-printed parts: fixtures, hubs, brackets, clips. A print is a union of simple
// solids minus cuts, in the plan's own coordinates (mm), so it sits where it goes
// in the 3D view and the drawings. This module is pure (Node and browser): the
// bounding boxes, a filament and time estimate, the OpenSCAD source, and the exact
// solid (printManifold) for the 3D view and the STL. The solid is built with
// manifold-3d, which always returns a closed, watertight mesh; the browser loads it
// from jsDelivr (viewer.mjs), a test can pass the npm package.
//
// Solids and cuts:
//   { type: 'cyl',   a, b, r }             a solid cylinder from point a to point b
//   { type: 'tube',  a, b, r, ri }         a cylinder with a bore of radius ri through it
//   { type: 'box',   c, s }                an axis-aligned box, centre c, size s
//   { type: 'prism', pts, z0, h, axis }    a 2D outline extruded along 'z' (or 'x', 'y'):
//                                          pts are [u, v] on the other two axes in order
//   { type: 'hole',  a, b, d }             (cuts) a round hole of diameter d from a to b
//
// copies: [{ move: [dx, dy, dz], rotZ: deg, about: [x, y, z] }] places the same part
// again (clips along an arm): turned about a vertical axis through `about`, then
// moved. One STL; the quantity is the copies plus one.
import { v3 } from './core.mjs';
import { meshVolume, meshBox } from './shapes.mjs';

// g/cm³, $/kg, and what each is for
export const FILAMENTS = {
  PLA: { rho: 1.24, price: 20, note: 'indoor; softens in a hot car or the sun' },
  PETG: { rho: 1.27, price: 22, note: 'tough, outdoor-capable' },
  ASA: { rho: 1.07, price: 28, note: 'outdoor and UV stable' },
  ABS: { rho: 1.04, price: 22, note: 'heat resistant, warps without an enclosure' },
  TPU: { rho: 1.21, price: 30, note: 'flexible: feet, bumpers, grips' },
  PA: { rho: 1.14, price: 40, note: 'nylon: strong, wear resistant, dry it first' },
};

const ext = (sh) => {
  if (sh.type === 'box') return [sh.c.map((v, i) => v - sh.s[i] / 2), sh.c.map((v, i) => v + sh.s[i] / 2)];
  if (sh.type === 'cyl' || sh.type === 'tube' || sh.type === 'hole') {
    const r = sh.r ?? sh.d / 2, ax = v3.norm(v3.sub(sh.b, sh.a)), e = ax.map(c => r * Math.sqrt(Math.max(0, 1 - c * c)));
    return [[0, 1, 2].map(i => Math.min(sh.a[i], sh.b[i]) - e[i]), [0, 1, 2].map(i => Math.max(sh.a[i], sh.b[i]) + e[i])];
  }
  if (sh.type === 'prism') {
    const [iu, iv, iz] = prismAxes(sh.axis);
    const us = sh.pts.map(p => p[0]), vs = sh.pts.map(p => p[1]);
    const lo = [], hi = [];
    lo[iu] = Math.min(...us); hi[iu] = Math.max(...us);
    lo[iv] = Math.min(...vs); hi[iv] = Math.max(...vs);
    lo[iz] = sh.z0; hi[iz] = sh.z0 + sh.h;
    return [lo, hi];
  }
  if (sh.type === 'sphere') return [sh.c.map(v => v - sh.r), sh.c.map(v => v + sh.r)];
  if (sh.type === 'mesh') return meshBox(sh);
  throw new Error(`unknown print solid "${sh.type}"`);
};
export const printQty = pr => pr.qty || (pr.copies?.length || 0) + 1;
// every placement of a part, as a point transform; the first is the part as modelled
export function placements(pr) {
  return [p => p, ...(pr.copies || []).map(c => {
    const t = ((c.rotZ || 0) * Math.PI) / 180, cs = Math.cos(t), sn = Math.sin(t), ab = c.about || [0, 0, 0], mv = c.move || [0, 0, 0];
    return p => { const x = p[0] - ab[0], y = p[1] - ab[1]; return [ab[0] + x * cs - y * sn + mv[0], ab[1] + x * sn + y * cs + mv[1], p[2] + mv[2]]; };
  })];
}
export const prismAxes = axis => (axis === 'x' ? [1, 2, 0] : axis === 'y' ? [0, 2, 1] : [0, 1, 2]);

// Corner sets per solid, for the drawings (each solid drawn as its outline); with
// all: true, for every placement of the part.
export function printSolids(part, { all = false } = {}) {
  const base = solidsOf(part);
  return all ? placements(part).flatMap(f => base.map(pts => pts.map(f))) : base;
}
function solidsOf(part) {
  return part.shapes.map(sh => {
    if (sh.type === 'prism') {
      const [iu, iv, iz] = prismAxes(sh.axis);
      return sh.pts.flatMap(([u, v]) => [sh.z0, sh.z0 + sh.h].map(z => { const q = []; q[iu] = u; q[iv] = v; q[iz] = z; return q; }));
    }
    if (sh.type === 'cyl' || sh.type === 'tube') {
      const ax = v3.norm(v3.sub(sh.b, sh.a));
      let u = v3.cross(ax, Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]); u = v3.norm(u);
      const w = v3.cross(ax, u), out = [];
      for (const p of [sh.a, sh.b]) for (let k = 0; k < 16; k++) {
        const t = (k / 16) * Math.PI * 2;
        out.push(v3.add(p, v3.add(v3.mul(u, sh.r * Math.cos(t)), v3.mul(w, sh.r * Math.sin(t)))));
      }
      return out;
    }
    if (sh.type === 'mesh') return sh.pts;
    if (sh.type === 'sphere') return [0, 1, 2].flatMap(ax => Array.from({ length: 24 }, (_, k) => { const t = (k / 24) * 2 * Math.PI, q = sh.c.slice(), [i, j] = [0, 1, 2].filter(a => a !== ax); q[i] += sh.r * Math.cos(t); q[j] += sh.r * Math.sin(t); return q; }));
    const [lo, hi] = ext(sh);
    return [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]);
  });
}

// the box round every placement (for the floating check, the 3D view and the overall size)
export function printBoxAll(part) {
  const pts = printSolids(part, { all: true }).flat();
  return [[0, 1, 2].map(i => Math.min(...pts.map(q => q[i]))), [0, 1, 2].map(i => Math.max(...pts.map(q => q[i])))];
}

export function printBox(part) {
  const bs = part.shapes.map(ext);
  return [[0, 1, 2].map(i => Math.min(...bs.map(b => b[0][i]))), [0, 1, 2].map(i => Math.max(...bs.map(b => b[1][i])))];
}

const area = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const vol = sh => {
  if (sh.type === 'box') return sh.s[0] * sh.s[1] * sh.s[2];
  const L = v3.len(v3.sub(sh.b ?? [0, 0, 0], sh.a ?? [0, 0, 0]));
  if (sh.type === 'cyl') return Math.PI * sh.r * sh.r * L;
  if (sh.type === 'tube') return Math.PI * (sh.r * sh.r - sh.ri * sh.ri) * L;
  if (sh.type === 'hole') return Math.PI * (sh.d / 2) ** 2 * L;
  if (sh.type === 'prism') return area(sh.pts) * sh.h;
  if (sh.type === 'sphere') return (4 / 3) * Math.PI * sh.r ** 3;
  if (sh.type === 'mesh') return Math.abs(meshVolume(sh));
  return 0;
};

// An honest estimate, not a slicer: solid volume (overlaps and cuts approximated),
// walls and skins solid, the rest at the infill. About 12 g an hour on a common
// 0.4 mm nozzle at 0.2 mm layers.
export function printEstimate(part) {
  const f = FILAMENTS[part.material || 'PETG'];
  if (!f) throw new Error(`print ${part.id}: unknown filament "${part.material}" (${Object.keys(FILAMENTS).join(', ')})`);
  // cuts can overlap each other or cut air, so never let them take more than 70% away
  const whole = part.shapes.reduce((s, sh) => s + vol(sh), 0);
  const solid = Math.max(0.3 * whole, whole - (part.cuts || []).reduce((s, c) => s + vol(c), 0)) * (part.overlap ?? 0.85);
  const [lo, hi] = printBox(part);
  const size = Math.min(...[0, 1, 2].map(i => hi[i] - lo[i]));
  const shell = Math.min(1, ((part.walls ?? 3) * 0.45 * 2) / Math.max(size, 1) + 0.15);
  const fill = shell + (1 - shell) * (part.infill ?? 0.3);
  const grams = (solid / 1000) * f.rho * fill;
  return { grams, hours: Math.max(0.2, grams / 12), cost: (grams / 1000) * f.price, filament: f };
}

// ---------------------------------------------------------------- print orientation
// bed: the face of the part, in plan axes, that goes down on the printer bed
// ('-z' as modelled, '+z' upside down, '-x', '+x', '-y', '+y'). The STL and the
// .scad come out turned that way and moved onto the bed at the origin.
const BED = {
  '-z': { m: p => p, scad: null },
  '+z': { m: ([x, y, z]) => [x, -y, -z], scad: [180, 0, 0] },
  '-x': { m: ([x, y, z]) => [-z, y, x], scad: [0, -90, 0] },
  '+x': { m: ([x, y, z]) => [z, y, -x], scad: [0, 90, 0] },
  '-y': { m: ([x, y, z]) => [x, -z, y], scad: [90, 0, 0] },
  '+y': { m: ([x, y, z]) => [x, z, -y], scad: [-90, 0, 0] },
};
export function bedTurn(part) {
  const b = BED[part.bed || '-z'];
  if (!b) throw new Error(`print ${part.id}: bed must be one of ${Object.keys(BED).join(', ')}`);
  return b;
}
// the part's size as it sits on the bed, and the offset that puts it at the origin
export function bedBox(part) {
  const [lo, hi] = printBox(part), t = bedTurn(part).m;
  const cs = [0, 1, 2, 3, 4, 5, 6, 7].map(i => t([i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]));
  const a = [0, 1, 2].map(i => Math.min(...cs.map(c => c[i]))), b = [0, 1, 2].map(i => Math.max(...cs.map(c => c[i])));
  return { lo: a, size: b.map((v, i) => v - a[i]), turn: t };
}

// ---------------------------------------------------------------- the exact solid
// facets round a circle of radius r: about 0.6 mm each, 24 to 128 (the .scad matches)
export const segs = r => Math.max(24, Math.min(128, Math.round((2 * Math.PI * r) / 0.6)));
const lift = 0.01;   // cuts run this far past every face they open, so none is left as a skin
// a column-major 4x4 that takes local x, y, z to the columns u, w, ax and moves to o
const frameMat = (u, w, ax, o) => [...u, 0, ...w, 0, ...ax, 0, ...o, 1];
// a cylinder's axis as OpenSCAD's rotate([0, tilt, turn]) sets it, so the STL and the
// .scad agree facet for facet; its facets start half a facet round, so a cylinder that
// just touches a flat face (a socket flush with a body) meets it on a face, never on
// one edge (that would leave a pinch a slicer reads as a fault)
const tiltTurn = d => [Math.acos(Math.max(-1, Math.min(1, d[2] / v3.len(d)))), Math.atan2(d[1], d[0])];
function axisFrame(d) {
  const [t, p] = tiltTurn(d), ct = Math.cos(t), st = Math.sin(t), cp = Math.cos(p), sp = Math.sin(p);
  return [[ct * cp, ct * sp, -st], [-sp, cp, 0], [st * cp, st * sp, ct]];
}
const ccw = pts => (pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) < 0 ? pts.slice().reverse() : pts);
function manifoldOf(M, sh, grow = 0) {
  const { Manifold, Mesh } = M;
  if (sh.type === 'box') return Manifold.cube(sh.s.map(v => v + 2 * grow), true).translate(sh.c);
  if (sh.type === 'cyl' || sh.type === 'tube' || sh.type === 'hole') {
    const r = sh.r ?? sh.d / 2, d = v3.sub(sh.b, sh.a), L = v3.len(d), [u, w, ax] = axisFrame(d);
    return Manifold.cylinder(L + 2 * grow, r, r, segs(r)).rotate([0, 0, 180 / segs(r)]).translate([0, 0, -grow]).transform(frameMat(u, w, ax, sh.a));
  }
  if (sh.type === 'prism') {
    // local x, y = the outline's u, v; local z = the extrusion. For 'y' the outline goes in
    // as (v, u) so the map stays a turn, not a mirror
    const swap = sh.axis === 'y', pts = ccw(sh.pts.map(([a, b]) => (swap ? [b, a] : [a, b])));
    const m = { z: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], x: [[0, 1, 0], [0, 0, 1], [1, 0, 0]], y: [[0, 0, 1], [1, 0, 0], [0, 1, 0]] }[sh.axis || 'z'];
    return Manifold.extrude([pts], sh.h + 2 * grow).translate([0, 0, sh.z0 - grow]).transform(frameMat(...m, [0, 0, 0]));
  }
  if (sh.type === 'sphere') return Manifold.sphere(sh.r + grow, segs(sh.r)).translate(sh.c);
  if (sh.type === 'mesh') {
    const mesh = new Mesh({ numProp: 3, vertProperties: Float32Array.from(sh.pts.flat()), triVerts: Uint32Array.from(sh.tris.flat()) });
    mesh.merge();
    const s = new Manifold(mesh);
    if (s.status() !== 'NoError') throw new Error(`a mesh solid is not closed (${s.status()})`);
    return s;
  }
  throw new Error(`unknown print solid "${sh.type}"`);
}
// the part as one watertight solid, in plan coordinates (mm): its solids unioned, then
// its cuts and bores taken out. M is the set-up manifold-3d module. Returns
// { pts: Float32Array xyz, tris: Uint32Array }.
export function printManifold(part, M) {
  const bores = part.shapes.filter(s => s.type === 'tube').map(s => ({ type: 'cyl', a: s.a, b: s.b, r: s.ri }));
  const made = [];
  const keep = m => (made.push(m), m);
  try {
    const body = keep(M.Manifold.union(part.shapes.map(sh => keep(manifoldOf(M, sh)))));
    const cuts = [...(part.cuts || []), ...bores].map(c => keep(manifoldOf(M, c, lift)));
    // simplified to a micron: drops the slivers a cut can leave where faces nearly meet
    const solid = keep((cuts.length ? keep(M.Manifold.difference([body, ...cuts])) : body).simplify(0.001));
    if (solid.status() !== 'NoError' || solid.isEmpty()) throw new Error(`print ${part.id}: the cut left nothing (${solid.status()})`);
    const mesh = solid.getMesh();
    const np = mesh.numProp, pts = new Float32Array((mesh.vertProperties.length / np) * 3);
    for (let i = 0; i < pts.length / 3; i++) for (let k = 0; k < 3; k++) pts[i * 3 + k] = mesh.vertProperties[i * np + k];
    return { pts, tris: Uint32Array.from(mesh.triVerts) };
  } finally { for (const m of made) m.delete(); }
}
// what a slicer would complain about, with the points welded where they meet (to a
// tenth of a micron): edges open or shared by more than two faces, faces turned inside
// out, and the volume (mm³). A printable solid has none of the first three.
export function meshFaults({ pts, tris }) {
  const ids = new Map(), at = i => { const k = `${Math.round(pts[i * 3] * 1e4)},${Math.round(pts[i * 3 + 1] * 1e4)},${Math.round(pts[i * 3 + 2] * 1e4)}`; if (!ids.has(k)) ids.set(k, ids.size); return ids.get(k); };
  const edges = new Map();
  let volume = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map(k => tris[t + k]), P = [a, b, c].map(i => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]]);
    volume += v3.dot(P[0], v3.cross(P[1], P[2])) / 6;
    const w = [a, b, c].map(at);
    if (new Set(w).size < 3) continue;
    for (const [u, v] of [[w[0], w[1]], [w[1], w[2]], [w[2], w[0]]]) {
      const k = u < v ? `${u},${v}` : `${v},${u}`, e = edges.get(k) || [0, 0];
      e[u < v ? 0 : 1]++; edges.set(k, e);
    }
  }
  let open = 0, shared = 0, flipped = 0;
  for (const [f, r] of edges.values()) { if (f + r === 1) open++; else if (f + r > 2) shared++; else if (f !== 1) flipped++; }
  return { open, shared, flipped, volume };
}
// a binary STL back to { pts, tris } (one point per corner), for meshFaults
export function stlMesh(buf) {
  const dv = new DataView(buf.buffer || buf, buf.byteOffset || 0), n = dv.getUint32(80, true), pts = new Float32Array(n * 9);
  for (let t = 0; t < n; t++) for (let k = 0; k < 9; k++) pts[t * 9 + k] = dv.getFloat32(84 + t * 50 + 12 + k * 4, true);
  return { pts, tris: Uint32Array.from({ length: n * 3 }, (_, i) => i) };
}

// the solid as a binary STL, turned onto the bed and moved to the origin, in mm
export function stlOf(solid, part) {
  const { turn } = bedBox(part), { pts, tris } = solid;
  const P = Array.from({ length: pts.length / 3 }, (_, i) => turn([pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]]));
  const lo = P.reduce((a, p) => a.map((v, k) => Math.min(v, p[k])), [Infinity, Infinity, Infinity]);
  const n = tris.length / 3, buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  dv.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    const p = [0, 1, 2].map(k => P[tris[t * 3 + k]].map((v, i) => v - lo[i]));
    const u = v3.sub(p[1], p[0]), w = v3.sub(p[2], p[0]), nn = v3.cross(u, w), L = v3.len(nn) || 1;
    let o = 84 + t * 50;
    for (const v of [...nn.map(x => x / L), ...p.flat()]) { dv.setFloat32(o, v, true); o += 4; }
  }
  return buf;
}

// ---------------------------------------------------------------- OpenSCAD
const n3 = v => `[${v.map(x => +x.toFixed(3)).join(', ')}]`;
function scadOrient(a, b, body) {
  const d = v3.sub(b, a), [t, p] = tiltTurn(d).map(x => (x * 180) / Math.PI);
  return `translate(${n3(a)}) rotate([0, ${t.toFixed(3)}, ${p.toFixed(3)}]) ${body(v3.len(d))}`;
}
const scadCyl = (L, r, z0 = 0) => `translate([0, 0, ${z0}]) rotate([0, 0, ${+(180 / segs(r)).toFixed(4)}]) cylinder(h = ${L.toFixed(3)}, r = ${r.toFixed(3)}, $fn = ${segs(r)});`;
function scadSolid(sh, grow = 0) {
  if (sh.type === 'box') return `translate(${n3(sh.c.map((v, i) => v - sh.s[i] / 2 - grow))}) cube(${n3(sh.s.map(v => v + 2 * grow))});`;
  if (sh.type === 'cyl' || sh.type === 'hole') {
    const r = sh.r ?? sh.d / 2;
    return scadOrient(sh.a, sh.b, L => scadCyl(L + 2 * grow, r, -grow));
  }
  if (sh.type === 'tube') return scadOrient(sh.a, sh.b, L => scadCyl(L, sh.r));
  if (sh.type === 'prism') {
    const rot = sh.axis === 'x' ? 'rotate([90, 0, 90]) ' : sh.axis === 'y' ? 'rotate([90, 0, 0]) mirror([0, 0, 1]) ' : '';
    return `${rot}translate([0, 0, ${(sh.z0 - grow).toFixed(3)}]) linear_extrude(height = ${(sh.h + 2 * grow).toFixed(3)}) polygon(${JSON.stringify(sh.pts.map(p => p.map(x => +x.toFixed(3))))});`;
  }
  if (sh.type === 'sphere') return `translate(${n3(sh.c)}) sphere(r = ${(sh.r + grow).toFixed(3)}, $fn = ${segs(sh.r)});`;
  // OpenSCAD wants polyhedron faces wound clockwise seen from outside: reverse ours
  if (sh.type === 'mesh') return `polyhedron(points = ${JSON.stringify(sh.pts.map(p => p.map(x => +x.toFixed(3))))}, faces = ${JSON.stringify(sh.tris.map(([a, b, c]) => [a, c, b]))});`;
  return '';
}
export function scadOf(part, plan) {
  const bores = part.shapes.filter(s => s.type === 'tube').map(s => ({ type: 'cyl', a: s.a, b: s.b, r: s.ri }));
  const cuts = [...(part.cuts || []), ...bores];
  const bb = bedBox(part), rot = bedTurn(part).scad;
  return `// ${part.name} (${part.id}) for ${plan?.name || 'a blueprint plan'}
// ${part.material || 'PETG'}, ${part.layer ?? 0.2} mm layers, ${part.walls ?? 3} walls, ${Math.round((part.infill ?? 0.3) * 100)}% infill${part.supports ? ', supports' : ', no supports'}
// Print it: ${part.orient || 'as modelled'}
// Generated by the blueprint skill from the plan at its current size. Units: mm.
$fn = 96;
translate(${n3(bb.lo.map(v => -v))})${rot ? ` rotate(${n3(rot)})` : ''}
difference() {
  union() {
${part.shapes.map(sh => '    ' + scadSolid(sh)).join('\n')}
  }
${cuts.map(c => '  ' + scadSolid(c, lift)).join('\n')}
}
`;
}
