// derive(plan, given, system): the one pipeline from a plan and its params to
// everything a build pack shows. The page calls it on every input change; the
// audit calls it at defaults and at every parameter's extremes. Nothing on the
// page is computed anywhere else.
import { v3, makeUnits, resolveParams, G0, MATERIALS, squareTube, rectTube, roundTube, flatBar, bar, timber, inch, feet } from './core.mjs';
import { solveJoints, memberCorners } from './joints.mjs';
import { runLoads } from './fea.mjs';

const { sub, len, dot, add, mul } = v3;

// ---------------------------------------------------------------- normalise
function normalise(model, plan) {
  model.axes ||= { x: ['right', 'left'], y: ['back', 'front'], z: ['top', 'bottom'] };
  model.members ||= []; model.plates ||= []; model.hardware ||= []; model.consumables ||= [];
  model.steps ||= []; model.checks ||= []; model.facts ||= [];
  model.kerf ??= 2; model.trim ??= 10;
  model.steps.sort((a, b) => a.n - b.n);
  for (const s of model.steps) s.tasks ||= [];
  model.currency ||= plan.currency || '';
  return model;
}

// ---------------------------------------------------------------- piece marks
const word = (v, axes) => {
  const i = [0, 1, 2].reduce((b, k) => (Math.abs(v[k]) > Math.abs(v[b]) ? k : b), 0);
  const names = [axes.x, axes.y, axes.z][i];
  return v[i] > 0 ? names[0] : names[1];
};
const SIGNS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

// Four edge marks per piece, measured from one square end of the stock: mark each
// edge at A and B, join the marks around the section, cut on the lines.
export function pieceMarks(j, axes) {
  const t0 = Math.min(...j.edges.map(e => e.ta));
  const edges = j.edges.map((e, k) => {
    const [su, sw] = SIGNS[k];
    return { label: `${word(j.w.map(v => v * sw), axes)}-${word(j.u.map(v => v * su), axes)}`, a: e.ta - t0, b: e.tb - t0 };
  });
  const stock = Math.max(...edges.map(e => e.b));
  return { id: j.id, edges, stock, longPoint: j.longPoint, shortPoint: j.shortPoint, ends: j.ends, faces: { top: word(j.w, axes), side: word(j.u, axes) } };
}

// Identical pieces share one mark (A, B, C...): same section, same cut marks,
// read from either end. Mirror images count as the same piece.
function signature(pm, sec) {
  const r = v => Math.round(v * 2) / 2;
  const fwd = pm.edges.map(e => [r(e.a), r(e.b)]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const rev = pm.edges.map(e => [r(pm.stock - e.b), r(pm.stock - e.a)]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const s1 = JSON.stringify(fwd), s2 = JSON.stringify(rev);
  return sec.id + '|' + (s1 < s2 ? s1 : s2);
}
const letter = i => (i < 26 ? String.fromCharCode(65 + i) : letter(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

function groupPieces(model, joints) {
  const groups = new Map();
  for (const m of model.members) {
    const j = joints[m.id];
    const pm = pieceMarks(j, model.axes);
    const sig = signature(pm, j.sec);
    if (!groups.has(sig)) groups.set(sig, { sec: j.sec, pm, ids: [], members: [], step: m.step });
    const g = groups.get(sig);
    g.ids.push(m.id); g.members.push(m); g.step = Math.min(g.step, m.step);
  }
  const list = [...groups.values()].sort((a, b) => a.step - b.step || b.sec.bu * b.sec.bw - a.sec.bu * a.sec.bw || b.pm.longPoint - a.pm.longPoint);
  list.forEach((g, i) => { g.mark = letter(i); g.qty = g.ids.length; g.name = g.members[0].name; });
  const markOf = {};
  for (const g of list) for (const id of g.ids) markOf[id] = g.mark;
  return { pieces: list, markOf };
}

// ---------------------------------------------------------------- nesting
// First-fit decreasing into stock lengths, kerf per cut, a trim off the mill end.
function nest(model, pieces) {
  const bySec = new Map();
  for (const g of pieces) for (const id of g.ids) {
    if (!bySec.has(g.sec.id)) bySec.set(g.sec.id, { sec: g.sec, items: [] });
    bySec.get(g.sec.id).items.push({ mark: g.mark, id, L: g.pm.stock });
  }
  const out = [];
  for (const { sec, items } of bySec.values()) {
    const S = sec.stockLen, bars = [];
    items.sort((a, b) => b.L - a.L);
    const tooLong = items.filter(it => it.L + model.trim > S);
    for (const it of items) {
      if (it.L + model.trim > S) continue;
      let bar = bars.find(b => b.used + it.L + model.kerf <= S);
      if (!bar) { bar = { used: model.trim, cuts: [] }; bars.push(bar); }
      bar.cuts.push({ ...it, at: bar.used });
      bar.used += it.L + model.kerf;
    }
    const total = items.reduce((s, it) => s + it.L, 0);
    out.push({ sec, bars, total, tooLong, offcut: bars.reduce((s, b) => s + (S - b.used), 0) });
  }
  return out;
}

// ---------------------------------------------------------------- mass
function shapeBox(sh) {
  if (!sh) return null;
  if (sh.type === 'box') return [sh.c.map((v, i) => v - sh.s[i] / 2), sh.c.map((v, i) => v + sh.s[i] / 2)];
  if (sh.type === 'cyl') return [[0, 1, 2].map(i => Math.min(sh.a[i], sh.b[i]) - sh.r), [0, 1, 2].map(i => Math.max(sh.a[i], sh.b[i]) + sh.r)];
  return null;
}
const plateBox = pl => [pl.c.map((v, i) => v - pl.s[i] / 2), pl.c.map((v, i) => v + pl.s[i] / 2)];
const boxGap = (A, B) => Math.max(0, ...[0, 1, 2].map(i => Math.max(A[0][i] - B[1][i], B[0][i] - A[1][i])));
const memberBox = j => { const c = memberCorners(j); return [[0, 1, 2].map(i => Math.min(...c.map(q => q[i]))), [0, 1, 2].map(i => Math.max(...c.map(q => q[i])))]; };

function massItems(model, joints) {
  const items = [];
  for (const m of model.members) {
    const j = joints[m.id];
    const L = j.edges.reduce((s, e) => s + (e.tb - e.ta), 0) / 4;
    items.push({ kind: 'member', id: m.id, m: (j.sec.kgPerM * L) / 1000, c: v3.lerp(j.A, j.B, 0.5) });
  }
  for (const pl of model.plates) {
    const rho = pl.rho ?? { steel: 7.85e-6, aluminium: 2.7e-6, stainless: 8e-6, timber: 4.2e-7, plywood: 6e-7, mdf: 7.5e-7 }[pl.material || 'steel'];
    items.push({ kind: 'plate', id: pl.id, m: pl.s[0] * pl.s[1] * pl.s[2] * rho * (pl.fill ?? 1), c: pl.c });
  }
  for (const h of model.hardware) {
    if (!h.kg) continue;
    const b = shapeBox(h.shape);
    items.push({ kind: 'hardware', id: h.id, m: h.kg * (h.qty || 1), c: h.at || (b ? b[0].map((v, i) => (v + b[1][i]) / 2) : [0, 0, 0]) });
  }
  return items;
}

// ---------------------------------------------------------------- geometry checks
function segDist(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  const c = dot(d1, r), b = dot(d1, d2), den = a * e - b * b;
  s = den > 1e-9 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0;
  t = (b * s + f) / e;
  if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
  return len(sub(add(p1, mul(d1, s)), add(p2, mul(d2, t))));
}

function geometryChecks(model, joints, sites) {
  const ids = model.members.map(m => m.id);
  const sharesSite = new Set();
  for (const s of sites) {
    const here = [...new Set([...s.ends.map(e => e.t.m.id), ...s.through.map(t => t.m.id)])];
    for (const a of here) for (const b of here) if (a !== b) sharesSite.add(a + '|' + b);
  }
  const half = j => Math.max(j.hu, j.hw), halfMin = j => Math.min(j.hu, j.hw);
  const clashes = [], adj = new Map();
  const link = (a, b) => { (adj.get(a) || adj.set(a, new Set()).get(a)).add(b); (adj.get(b) || adj.set(b, new Set()).get(b)).add(a); };
  for (let i = 0; i < ids.length; i++) for (let k = i + 1; k < ids.length; k++) {
    const A = joints[ids[i]], B = joints[ids[k]];
    if (sharesSite.has(A.id + '|' + B.id)) { link(A.id, B.id); continue; }
    const d = segDist(A.A, A.B, B.A, B.B);
    if (d <= half(A) + half(B) + 1) link(A.id, B.id);
    if (d < halfMin(A) + halfMin(B) - 1) clashes.push(`${A.id} passes through ${B.id}`);
  }
  // plates and hardware touch a member, a plate, or name what they sit on
  const boxes = {};
  for (const id of ids) boxes[id] = memberBox(joints[id]);
  for (const pl of model.plates) boxes[pl.id] = plateBox(pl);
  for (const h of model.hardware) { const b = shapeBox(h.shape); if (b) boxes[h.id] = b; }
  const others = [...model.plates.map(p => ({ id: p.id, on: p.on })), ...model.hardware.filter(h => boxes[h.id]).map(h => ({ id: h.id, on: h.on }))];
  for (const o of others) {
    if (o.on) { for (const t of [].concat(o.on)) if (boxes[t]) link(o.id, t); continue; }
    for (const [id, b] of Object.entries(boxes)) if (id !== o.id && boxGap(boxes[o.id], b) <= 1) link(o.id, id);
  }
  const all = Object.keys(boxes);
  const seen = new Set(), stack = all.length ? [all[0]] : [];
  while (stack.length) { const n = stack.pop(); if (seen.has(n)) continue; seen.add(n); for (const q of adj.get(n) || []) stack.push(q); }
  const floating = all.filter(n => !seen.has(n));
  return { clashes, floating, boxes };
}

function hull2(pts) {
  const p = pts.map(q => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export { hull2 };

// ---------------------------------------------------------------- derive
export function derive(plan, given = {}, system) {
  const { p, notes, limits } = resolveParams(plan.params || [], given);
  const units = makeUnits(system || p.units || plan.units || 'metric');
  // the design gets its helpers injected, so a design.mjs needs no import paths
  const kit = { u: units, p, v3, MATERIALS, squareTube, rectTube, roundTube, flatBar, bar, timber, inch, feet };
  const model = normalise(plan.build(p, kit), plan);
  const { joints, sites, report } = solveJoints(model);
  const { pieces, markOf } = groupPieces(model, joints);
  const nesting = nest(model, pieces);
  // identical plates share a mark (P1, P2...): same size, thickness, holes and material
  const pg = new Map();
  for (const pl of model.plates) {
    const key = [...pl.s].map(v => Math.round(v * 2) / 2).sort((a, b) => a - b).join('x') + '|' + (pl.material || 'steel') + '|' + JSON.stringify(pl.holes || []) + '|' + pl.name;
    if (!pg.has(key)) pg.set(key, { pl, qty: 0, ids: [], step: pl.step });
    const g = pg.get(key); g.qty += pl.qty || 1; g.ids.push(pl.id); g.step = Math.min(g.step, pl.step);
  }
  const plateGroups = [...pg.values()].sort((a, b) => a.step - b.step);
  plateGroups.forEach((g, i) => { g.mark = 'P' + (i + 1); for (const pl of model.plates) if (g.ids.includes(pl.id)) pl.mark = g.mark; });
  const mass = massItems(model, joints);
  const totalKg = mass.reduce((s, it) => s + it.m, 0);
  const cog = mass.reduce((c, it) => add(c, mul(it.c, it.m / (totalKg || 1))), [0, 0, 0]);
  const geo = geometryChecks(model, joints, sites);
  const allBoxes = Object.values(geo.boxes);
  const bbox = [[0, 1, 2].map(i => Math.min(...allBoxes.map(b => b[0][i]))), [0, 1, 2].map(i => Math.max(...allBoxes.map(b => b[1][i])))];
  const d = { plan, p, notes, limits, units, model, joints, sites, pieces, markOf, nesting, plateGroups, massItems: mass, totalKg, cog, bbox };

  // joining: weld run (or fastener count) from every end that meets something
  let weld = 0, joins = 0;
  for (const j of Object.values(joints)) for (const e of ['A', 'B']) {
    const c = j.ends[e];
    if (c.kind === 'free') continue;
    joins++;
    weld += (4 * (j.hu + j.hw)) * (c.kind === 'miter' ? 0.5 : 1);
  }
  d.weld = { length: weld, joins };

  // loads
  let loadErr = null;
  try { d.loads = runLoads(d); } catch (e) { d.loads = []; loadErr = e.message; }

  // stability: tip over under a side push at a height
  if (model.tip && model.supports?.length) {
    const hull = hull2(model.supports.map(s => s.at));
    let dmin = Infinity;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
      dmin = Math.min(dmin, ((cog[0] - a[0]) * ey - (cog[1] - a[1]) * ex) / L * -1);
    }
    const F = model.tip.kg != null ? model.tip.kg * G0 : model.tip.N;
    d.tip = { sf: (totalKg * G0 * dmin) / (F * model.tip.height), dmin, F, height: model.tip.height };
  }

  // checks: kit checks first, then the plan's own
  const u = units, checks = [];
  const add2 = (name, pass, value, why) => checks.push({ name, pass: !!pass, value, why });
  add2('Every joint can be made as drawn', !report.length, report.length ? report[0] : `${d.weld.joins} joints`, 'Each end is a mitre, a butt onto a face, a flush cut or a free end; nothing overhangs.');
  add2('Nothing floating', !geo.floating.length, geo.floating.length ? geo.floating.join(', ') : 'all connected', 'Every member, plate and part touches what holds it.');
  add2('No clashes', !geo.clashes.length, geo.clashes[0] || 'none', 'No member passes through another away from a joint.');
  const longest = Math.max(...pieces.map(g => g.pm.stock));
  const tooLong = nesting.flatMap(n => n.tooLong);
  add2('Every piece fits the stock', !tooLong.length, tooLong.length ? `${tooLong[0].id} is ${u.len(tooLong[0].L, { u: true })}` : `longest ${u.len(longest, { u: true })}`, 'Cut from standard lengths with a trim and a kerf per cut.');
  const shortest = pieces.reduce((m, g) => (g.pm.shortPoint < m.v ? { v: g.pm.shortPoint, g } : m), { v: Infinity });
  const minPiece = model.minPiece ?? 30;
  add2('Every piece can be clamped and cut', shortest.v >= minPiece, `shortest ${u.len(shortest.v, { u: true })}`, `No piece shorter than ${u.len(minPiece, { u: true })} on its short side.`);
  if (loadErr) add2('Frame analysis', false, loadErr, 'The frame solver could not run.');
  for (const r of d.loads) {
    const need = r.load.sf ?? 2;
    add2(`${r.name}: strength`, r.sf >= need, `safety factor ${r.sf === Infinity ? '∞' : r.sf.toFixed(2)} (need ${need})${r.worstMember ? ', worst ' + r.worstMember : ''}`, `Yield ÷ peak stress with ${r.load.kg != null ? u.mass(r.load.kg) : u.force(r.load.N)} ${r.load.what || 'applied'}, plus self weight.`);
    if (r.load.defl != null) add2(`${r.name}: deflection`, r.loadDefl <= r.load.defl, `${u.deflection(r.loadDefl)} (limit ${u.deflection(r.load.defl)})`, 'Largest movement of the loaded members.');
  }
  if (d.tip && model.tip.anchored) add2('Does not tip over', true, `anchored (${model.tip.anchored}); free-standing factor ${d.tip.sf.toFixed(2)}`, `Free-standing it would tip with ${u.force(d.tip.F)} sideways at ${u.len(d.tip.height, { u: true })} high, so it is fixed down.`);
  else if (d.tip) add2('Does not tip over', d.tip.sf >= (model.tip.sf ?? 1.5), `factor ${d.tip.sf.toFixed(2)} (need ${model.tip.sf ?? 1.5})`, `${u.force(d.tip.F)} sideways at ${u.len(d.tip.height, { u: true })} high against its own weight.`);
  const stepNs = new Set(model.steps.map(s => s.n));
  const orphan = [...model.members, ...model.plates, ...model.hardware].filter(x => !stepNs.has(x.step));
  add2('Every part has a step', !orphan.length, orphan.length ? orphan.map(x => x.id).slice(0, 3).join(', ') : `${model.steps.length} steps`, 'Each piece is cut, fitted or bought in a numbered step.');
  for (const c of model.checks) add2(c.name, c.pass, c.value, c.why);
  d.checks = checks;
  d.ok = checks.every(c => c.pass);

  // cost
  const price = { stock: 0, plates: 0, hardware: 0, known: true };
  for (const n of nesting) { if (n.sec.price == null) price.known = false; else price.stock += (n.bars.length * n.sec.stockLen / 1000) * n.sec.price; }
  for (const pl of model.plates) { if (pl.price == null) price.known = false; else price.plates += pl.price * (pl.qty || 1); }
  for (const h of model.hardware) { if (h.price == null) price.known = false; else price.hardware += h.price * (h.qty || 1); }
  price.total = price.stock + price.plates + price.hardware;
  d.price = price;
  d.hours = model.steps.reduce((s, st) => s + (st.hours || 0), 0);
  return d;
}
