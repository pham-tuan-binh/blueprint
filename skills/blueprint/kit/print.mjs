// 3D-printed parts: fixtures, hubs, brackets, clips. A print is a union of simple
// solids minus cuts, in the plan's own coordinates (mm), so it sits where it goes
// in the 3D view and the drawings. This module is pure (Node and browser): the
// bounding boxes, a filament and time estimate, and the OpenSCAD source. The exact
// mesh (for the 3D view and the STL download) is cut in the browser by viewer.mjs.
//
// Solids and cuts:
//   { type: 'cyl',   a, b, r }             a solid cylinder from point a to point b
//   { type: 'tube',  a, b, r, ri }         a cylinder with a bore of radius ri through it
//   { type: 'box',   c, s }                an axis-aligned box, centre c, size s
//   { type: 'prism', pts, z0, h, axis }    a 2D outline extruded along 'z' (or 'x', 'y'):
//                                          pts are [u, v] on the other two axes in order
//   { type: 'hole',  a, b, d }             (cuts) a round hole of diameter d from a to b
import { v3 } from './core.mjs';

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
  throw new Error(`unknown print solid "${sh.type}"`);
};
export const prismAxes = axis => (axis === 'x' ? [1, 2, 0] : axis === 'y' ? [0, 2, 1] : [0, 1, 2]);

// Corner sets per solid, for the drawings (each solid drawn as its outline).
export function printSolids(part) {
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
    const [lo, hi] = ext(sh);
    return [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]);
  });
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
  return 0;
};

// An honest estimate, not a slicer: solid volume (overlaps and cuts approximated),
// walls and skins solid, the rest at the infill. About 12 g an hour on a common
// 0.4 mm nozzle at 0.2 mm layers.
export function printEstimate(part) {
  const f = FILAMENTS[part.material || 'PETG'];
  if (!f) throw new Error(`print ${part.id}: unknown filament "${part.material}" (${Object.keys(FILAMENTS).join(', ')})`);
  const solid = Math.max(0, part.shapes.reduce((s, sh) => s + vol(sh), 0) - (part.cuts || []).reduce((s, c) => s + vol(c), 0)) * (part.overlap ?? 0.85);
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

// ---------------------------------------------------------------- OpenSCAD
const n3 = v => `[${v.map(x => +x.toFixed(3)).join(', ')}]`;
function scadOrient(a, b, body) {
  const d = v3.sub(b, a), L = v3.len(d);
  const tilt = Math.acos(Math.max(-1, Math.min(1, d[2] / L))) * 180 / Math.PI, turn = Math.atan2(d[1], d[0]) * 180 / Math.PI;
  return `translate(${n3(a)}) rotate([0, ${tilt.toFixed(3)}, ${turn.toFixed(3)}]) ${body(L)}`;
}
function scadSolid(sh, grow = 0) {
  if (sh.type === 'box') return `translate(${n3(sh.c.map((v, i) => v - sh.s[i] / 2 - grow))}) cube(${n3(sh.s.map(v => v + 2 * grow))});`;
  if (sh.type === 'cyl' || sh.type === 'hole') {
    const r = sh.r ?? sh.d / 2;
    return scadOrient(sh.a, sh.b, L => `translate([0, 0, ${-grow}]) cylinder(h = ${(L + 2 * grow).toFixed(3)}, r = ${r.toFixed(3)});`);
  }
  if (sh.type === 'tube') return scadOrient(sh.a, sh.b, L => `cylinder(h = ${L.toFixed(3)}, r = ${sh.r.toFixed(3)});`);
  if (sh.type === 'prism') {
    const rot = sh.axis === 'x' ? 'rotate([90, 0, 90]) ' : sh.axis === 'y' ? 'rotate([90, 0, 0]) mirror([0, 0, 1]) ' : '';
    return `${rot}translate([0, 0, ${(sh.z0 - grow).toFixed(3)}]) linear_extrude(height = ${(sh.h + 2 * grow).toFixed(3)}) polygon(${JSON.stringify(sh.pts.map(p => p.map(x => +x.toFixed(3))))});`;
  }
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
${cuts.map(c => '  ' + scadSolid(c, 0.01)).join('\n')}
}
`;
}
