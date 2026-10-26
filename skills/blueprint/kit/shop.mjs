// Shop drawings as SVG strings: cut sheets, jig views, the general arrangement,
// plate sheets and the stock nesting. Pure functions of a derived plan (derive.mjs)
// and the units in force, so imperial is a re-render, never a second drawing.
import { esc, f1, r0 } from './core.mjs';
import { memberCorners } from './joints.mjs';
import { printSolids, printBox } from './print.mjs';
import { hull2 } from './derive.mjs';

// ---------------------------------------------------------------- views
// top: looking down, front at the bottom. front: from -y. side: from +x.
// depth: larger is nearer the viewer, drawn later.
export const VIEWS = {
  top: { title: 'Top', pr: q => [q[0], -q[1]], depth: q => q[2] },
  front: { title: 'Front', pr: q => [q[0], -q[2]], depth: q => -q[1] },
  side: { title: 'Side (from the right)', pr: q => [q[1], -q[2]], depth: q => q[0] },
  // isometric from the front right, for gallery cards (painter's order by centroid)
  iso: { title: 'Isometric', pr: q => [(q[0] + q[1]) * 0.7071, -(q[1] - q[0] + 2 * q[2]) * 0.4082], depth: q => q[0] - q[1] + q[2] },
};
const boxCorners = ([lo, hi]) => [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]);
const cylCorners = sh => {
  const out = [];
  for (const p of [sh.a, sh.b]) for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
    const ax = [sh.b[0] - sh.a[0], sh.b[1] - sh.a[1], sh.b[2] - sh.a[2]];
    const m = Math.hypot(...ax) || 1;
    const k = [dx, dy, dz].map((v, i) => v * sh.r * Math.sqrt(1 - (ax[i] / m) ** 2));
    out.push([p[0] + k[0], p[1] + k[1], p[2] + k[2]]);
  }
  return out;
};

// Every solid in the plan as a list of corner sets, tagged.
export function solids(d, { upTo = Infinity, only = null } = {}) {
  const out = [];
  for (const m of d.model.members) if (m.step <= upTo && (!only || only(m))) out.push({ id: m.id, kind: 'member', step: m.step, pts: memberCorners(d.joints[m.id]) });
  for (const pl of d.model.plates) if (pl.step <= upTo && (!only || only(pl))) out.push({ id: pl.id, kind: 'plate', step: pl.step, pts: boxCorners([pl.c.map((v, i) => v - pl.s[i] / 2), pl.c.map((v, i) => v + pl.s[i] / 2)]) });
  for (const pr of d.model.prints || []) if (pr.step <= upTo && (!only || only(pr))) for (const pts of printSolids(pr, { all: true })) out.push({ id: pr.id, kind: 'print', step: pr.step, pts });
  for (const h of d.model.hardware) if (h.shape && h.step <= upTo && (!only || only(h))) {
    const shapes = [h.shape].flat(Infinity);
    for (const sh of shapes) out.push({ id: h.id, kind: 'hardware', step: h.step, pts: sh.type === 'box' ? boxCorners([sh.c.map((v, i) => v - sh.s[i] / 2), sh.c.map((v, i) => v + sh.s[i] / 2)]) : cylCorners(sh) });
  }
  return out;
}

// Painter's order for the isometric view: box A is behind box B when they are
// separated along an axis on the far side (camera at +x, -y, +z). A topological
// sort over those pairs; centroid depth breaks ties and cycles.
function isoOrder(polys) {
  const box = p => [[0, 1, 2].map(i => Math.min(...p.pts.map(q => q[i]))), [0, 1, 2].map(i => Math.max(...p.pts.map(q => q[i])))];
  const B = polys.map(box), e = 0.5, n = polys.length;
  const behind = (a, b) => B[a][1][0] <= B[b][0][0] + e || B[a][0][1] >= B[b][1][1] - e || B[a][1][2] <= B[b][0][2] + e;
  const indeg = new Array(n).fill(0), out = polys.map(() => []);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    if (a === b) continue;
    if (behind(a, b) && !behind(b, a)) { out[a].push(b); indeg[b]++; }
  }
  const done = [], used = new Array(n).fill(false);
  while (done.length < n) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!used[i] && indeg[i] === 0 && (pick < 0 || polys[i].depth < polys[pick].depth)) pick = i;
    if (pick < 0) for (let i = 0; i < n; i++) if (!used[i] && (pick < 0 || polys[i].depth < polys[pick].depth)) pick = i;
    used[pick] = true; done.push(polys[pick]);
    for (const b of out[pick]) indeg[b]--;
  }
  return done;
}

// A label on a drawing in its own paper-coloured box, so it reads over lines and
// filled members. Width from the monospace advance (0.6 em per character).
function tag(x, y, text, size, { cls, anchor = 'start', rotate = 0 } = {}) {
  const pad = size * 0.28, w = String(text).length * size * 0.6 + pad * 2, h = size * 1.3;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x - pad;
  const box = `<rect class="lbox" x="${f1(x0)}" y="${f1(y - size * 0.98)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(size * 0.22)}"/>`;
  const t = `<text class="${cls}" x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}">${esc(text)}</text>`;
  return rotate ? `<g transform="rotate(${rotate} ${f1(x)} ${f1(y)})">${box}${t}</g>` : box + t;
}

// A member as slices about 40 mm long, each with its own depth and its own outline: the
// edges along the member, and the end faces on the first and last slice only. A hairline
// in the fill colour hides the seams between slices.
const SLICE = 40;
function hullIdx(P) {
  const idx = P.map((q, i) => i).sort((a, b) => P[a][0] - P[b][0] || P[a][1] - P[b][1]);
  const cr = (o, a, b) => (P[a][0] - P[o][0]) * (P[b][1] - P[o][1]) - (P[a][1] - P[o][1]) * (P[b][0] - P[o][0]);
  const lo = [], up = [];
  for (const q of idx) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of idx.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function memberSlices(it, V) {
  const c = it.pts;
  const len = Math.max(...[0, 1, 2, 3].map(k => Math.hypot(...c[k + 4].map((v, i) => v - c[k][i]))));
  const n = Math.max(1, Math.ceil(len / SLICE));
  const at = (k, t) => c[k].map((v, i) => v + (c[k + 4][i] - v) * t);
  // flat to the view (its depth the same along it) or seen end-on (a leg from above): one
  // depth after all, so draw it whole; only a member sloping toward the viewer needs slices
  const a0 = V.pr(at(0, 0)), a1 = V.pr(at(0, 1));
  if (Math.abs(V.depth(at(0, 1)) - V.depth(at(0, 0))) < 1 || Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) < 1)
    return [{ ...it, hull: hull2(c.map(V.pr)), depth: c.reduce((s, q) => s + V.depth(q), 0) / 8 }];
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const R = [0, 1, 2, 3].flatMap(k => [at(k, t0), at(k, t1)]).map(V.pr), h = hullIdx(R);   // index k*2 + (0: t0, 1: t1)
    let edges = '';
    for (let e = 0; e < h.length; e++) {
      const a = h[e], b = h[(e + 1) % h.length], ea = a % 2, eb = b % 2;
      if (ea !== eb || (ea === 0 && i === 0) || (ea === 1 && i === n - 1)) edges += `M${f1(R[a][0])} ${f1(R[a][1])}L${f1(R[b][0])} ${f1(R[b][1])}`;
    }
    const mid = (t0 + t1) / 2, ctr = at(0, mid).map((v, j) => (v + at(2, mid)[j]) / 2);
    out.push({ ...it, hull: h.map(j => R[j]), depth: V.depth(ctr), edges });
  }
  return out;
}

// One orthographic view with overall dimensions. now(id) marks the parts of this step.
// overlay(V, fs) adds marks of a figure's own; win { c, r } crops to a close-up round c.
function viewSvg(items, view, { now = () => true, labels = [], title = '', u, dims = true, cls = 'jig', fs: fsIn, dimPts = null, bare = false, overlay = null, win = null }) {
  const V = VIEWS[view];
  // in the flat views a member is drawn as short slices, each sorted by its own depth, so a
  // sloped member passing over or under another overlaps right (a whole member has no one depth)
  let polys = items.flatMap(it => (view !== 'iso' && it.kind === 'member' && it.pts.length === 8) ? memberSlices(it, V)
    : [{ ...it, hull: hull2(it.pts.map(V.pr)), depth: it.pts.reduce((s, q) => s + V.depth(q), 0) / it.pts.length }])
    .sort((a, b) => a.depth - b.depth);
  if (view === 'iso') polys = isoOrder(polys);
  const draw = p => {
    const c = `${now(p) ? 'jn' : 'jo'} k-${p.kind}`, pts = p.hull.map(q => f1(q[0]) + ',' + f1(q[1])).join(' ');
    return p.edges == null ? `<polygon class="${c}" points="${pts}"/>` : `<polygon class="${c} f" points="${pts}"/>${p.edges ? `<path class="${c} e" d="${p.edges}"/>` : ''}`;
  };
  if (win) {
    const [cx, cy] = V.pr(win.c), r = win.r, fs = r / 9;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[cx - r, cy - r * 0.75, r * 2, r * 1.5].map(f1).join(' ')}" class="${cls} close" style="--fs:${f1(fs)}px" role="img" aria-label="${esc(title)}">`;
    for (const p of polys) s += draw(p);
    return s + (overlay ? overlay(V, fs) : '') + '</svg>';
  }
  const all = polys.flatMap(p => p.hull);
  const x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0]));
  const y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]));
  const span = Math.max(x1 - x0, y1 - y0, 200);
  const fs = fsIn || span / 34, pad = fs * (bare ? 1.2 : 5);
  // the dimensioned extent is what this step adds (or everything, when it is the GA)
  // jigs dimension centre lines (like the joint table, marked ℄); the GA outside faces
  const nowPts = dimPts ? dimPts.map(V.pr) : polys.filter(p => now(p)).flatMap(p => p.hull);
  const cl = dimPts ? '℄ ' : '';
  const dx0 = Math.min(...nowPts.map(p => p[0])), dx1 = Math.max(...nowPts.map(p => p[0]));
  const dy0 = Math.min(...nowPts.map(p => p[1])), dy1 = Math.max(...nowPts.map(p => p[1]));
  const vb = bare ? [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2] : [x0 - pad, y0 - pad * 1.2, x1 - x0 + pad * 2.2, y1 - y0 + pad * 2.6];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f1).join(' ')}" class="${cls}" style="--fs:${f1(fs)}px" data-w="${f1(vb[2])}" role="img" aria-label="${esc(title || V.title)}">`;
  for (const p of polys) s += draw(p);
  if (dims && nowPts.length) {
    const a = fs * 0.5, off = fs * 2.2, showH = dx1 - dx0 > 1, showV = dy1 - dy0 > 1;
    const yb = y1 + off, xr = x1 + off;
    // horizontal: under the view
    if (showH) s += `<path class="dl" d="M${f1(dx0)} ${f1(dy1 + fs * 0.4)}V${f1(yb + a)}M${f1(dx1)} ${f1(dy1 + fs * 0.4)}V${f1(yb + a)}M${f1(dx0)} ${f1(yb)}H${f1(dx1)}"/>`;
    if (showH) s += `<path class="da" d="M${f1(dx0)} ${f1(yb)}l${f1(a * 1.6)} ${f1(-a * 0.55)}v${f1(a * 1.1)}zM${f1(dx1)} ${f1(yb)}l${f1(-a * 1.6)} ${f1(-a * 0.55)}v${f1(a * 1.1)}z"/>`;
    if (showH) s += tag((dx0 + dx1) / 2, yb + fs * 0.36, `${cl}${u.len(dx1 - dx0)}`, fs, { cls: 'dt', anchor: 'middle' });
    // vertical: right of the view
    if (showV) s += `<path class="dl" d="M${f1(dx1 + fs * 0.4)} ${f1(dy0)}H${f1(xr + a)}M${f1(dx1 + fs * 0.4)} ${f1(dy1)}H${f1(xr + a)}M${f1(xr)} ${f1(dy0)}V${f1(dy1)}"/>`;
    if (showV) s += `<path class="da" d="M${f1(xr)} ${f1(dy0)}l${f1(-a * 0.55)} ${f1(a * 1.6)}h${f1(a * 1.1)}zM${f1(xr)} ${f1(dy1)}l${f1(-a * 0.55)} ${f1(-a * 1.6)}h${f1(a * 1.1)}z"/>`;
    if (showV) s += tag(xr + fs * 0.36, (dy0 + dy1) / 2, `${cl}${u.len(dy1 - dy0)}`, fs, { cls: 'dt', anchor: 'middle', rotate: -90 });
  }
  // points that land on the same spot in this view share one label: BL1…BL4
  // points closer than a label's height on this view share one label
  const spots = [];
  for (const l of labels) {
    const [x, y] = V.pr(l.p);
    const near = spots.find(sp => Math.hypot(sp.x - x, sp.y - y) < fs * 1.4);
    if (near) near.names.push(l.name); else spots.push({ x, y, p: l.p, names: [l.name] });
  }
  const merged = spots.map(sp => ({ p: sp.p, name: sp.names.length > 2 ? `${sp.names[0]}…${sp.names[sp.names.length - 1]}` : sp.names.join(', ') }));
  for (const l of merged) {
    const [x, y] = V.pr(l.p);
    s += `<circle class="jp" cx="${f1(x)}" cy="${f1(y)}" r="${f1(fs * 0.28)}"/>` + tag(x + fs * 0.7, y - fs * 0.85, l.name, fs * 0.8, { cls: 'jl' });
  }
  if (overlay) s += overlay(V, fs);
  if (!bare) s += tag(vb[0] + fs * 0.6, vb[1] + fs * 1.2, title || V.title, fs * 0.8, { cls: 'jt' });
  return s + '</svg>';
}

// Nodes the step's members end on, in a stable order.
export function stepNodes(d, n) {
  const names = new Set();
  for (const m of d.model.members.filter(x => x.step === n)) for (const q of [m.pts[0], m.pts[m.pts.length - 1]]) names.add(q);
  return [...names].map(name => ({ name, p: d.model.nodes[name] }))
    .sort((a, b) => a.p[2] - b.p[2] || a.p[1] - b.p[1] || a.p[0] - b.p[0]);
}

// Which views a step needs: a flat step (one level) only the top view.
export function stepViews(d, st) {
  if (st.views) return st.views;
  const zs = d.model.members.filter(m => m.step === st.n).flatMap(m => [d.joints[m.id].A[2], d.joints[m.id].B[2]]);
  return zs.length && Math.max(...zs) - Math.min(...zs) < 1 ? ['top'] : ['front', 'side', 'top'];
}

// Views laid out as one third-angle sheet at one scale: top above front, side to
// the right of front. One text size (fs) for every view on the sheet.
function sheet(items, views, opts) {
  const pts = items.flatMap(it => it.pts);
  const ext = i => Math.max(...pts.map(q => q[i])) - Math.min(...pts.map(q => q[i]));
  const fs = opts.fs || Math.max(ext(0), ext(1), ext(2), 200) / 34;
  const svg = {};
  for (const v of views) svg[v] = viewSvg(items, v, { ...opts, fs, title: opts.title ? opts.title(v) : VIEWS[v].title });
  const w = v => +svg[v].match(/data-w="([\d.]+)"/)[1];
  if (views.length === 1) return `<div class="sheet one"><figure>${svg[views[0]]}</figure></div>`;
  // the side view stands beside the front view; with no front view, beside the top view
  const left = views.includes('front') ? 'front' : 'top';
  const cols = views.includes('side') ? `${f1(w(left))}fr ${f1(w('side'))}fr` : '1fr';
  const sideRow = views.includes('front') ? 2 : 1;
  return `<div class="sheet" style="grid-template-columns:${cols}">` +
    (views.includes('top') ? `<figure class="v-top">${svg.top}</figure>` : '') +
    (views.includes('front') ? `<figure class="v-front"${views.includes('top') ? '' : ' style="grid-row:1"'}>${svg.front}</figure>` : '') +
    (views.includes('side') ? `<figure class="v-side" style="grid-row:${sideRow}">${svg.side}</figure>` : '') + `</div>`;
}

export function jigSheet(d, st, views) {
  const items = solids(d, { upTo: st.n, only: st.alone ? x => x.step === st.n : null });
  const pts = stepNodes(d, st.n);
  // points: false draws no point labels (bars laid with a spacer, not by coordinates)
  return sheet(items, views, { now: it => it.step === st.n, labels: st.points === false ? [] : pts, dimPts: pts.map(l => l.p), title: v => `Step ${st.n}: ${VIEWS[v].title}`, u: d.units });
}

// ---------------------------------------------------------------- guide figures
// Figures for the guide, generated from the plan so they change with it.

// a step's jig with one joint ringed and its coordinates written out
export function markedJig(d, st, view, name) {
  const items = solids(d, { upTo: st.n, only: st.alone ? x => x.step === st.n : null }), u = d.units;
  const q = d.model.nodes[name];
  const overlay = (V, fs) => {
    const [x, y] = V.pr(q);
    return `<circle class="gmk" cx="${f1(x)}" cy="${f1(y)}" r="${f1(fs * 0.9)}"/>` +
      tag(x + fs * 1.3, y + fs * 2.2, `${name}: x ${u.len(q[0])} · y ${u.len(q[1])} · z ${u.len(q[2])}`, fs * 0.8, { cls: 'jl' });
  };
  return sheet(items, [view], { now: it => it.step === st.n, labels: [], dims: false, overlay, title: () => `Step ${st.n}: ${VIEWS[view].title}`, u });
}

// the four corner joints of a step in one view, when they make a rectangle
export function bayOf(d, st, view) {
  const V = VIEWS[view], pts = stepNodes(d, st.n).map(l => ({ ...l, q: V.pr(l.p) }));
  if (pts.length < 4) return null;
  const xs = pts.map(p => p.q[0]), ys = pts.map(p => p.q[1]);
  const corner = (x, y) => pts.find(p => Math.abs(p.q[0] - x) < 1 && Math.abs(p.q[1] - y) < 1);
  const [a, b, c, e] = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)], [Math.max(...xs), Math.min(...ys)], [Math.min(...xs), Math.max(...ys)]].map(([x, y]) => corner(x, y));
  if (!a || !b || !c || !e || Math.max(...xs) - Math.min(...xs) < 50 || Math.max(...ys) - Math.min(...ys) < 50) return null;
  // a closed frame: a member (fitted by now) along each of the four sides
  const segs = d.model.members.filter(m => m.step <= st.n).map(m => [V.pr(d.joints[m.id].A), V.pr(d.joints[m.id].B)]);
  const covered = (P, Q) => {
    const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]), ux = (Q[0] - P[0]) / L, uy = (Q[1] - P[1]) / L;
    return segs.some(([S, T]) => {
      const off = p => Math.abs((p[0] - P[0]) * uy - (p[1] - P[1]) * ux), at = p => (p[0] - P[0]) * ux + (p[1] - P[1]) * uy;
      return off(S) < 30 && off(T) < 30 && Math.max(at(S), at(T)) - Math.min(at(S), at(T)) > L * 0.8;
    });
  };
  if (![[a, c], [c, b], [b, e], [e, a]].every(([P, Q]) => covered(P.q, Q.q))) return null;
  return { a: a.p, b: b.p, c: c.p, e: e.p, diag: Math.hypot(b.q[0] - a.q[0], b.q[1] - a.q[1]) };
}

// that bay with both diagonals dashed: equal means square
export function diagJig(d, st, view, bay) {
  const items = solids(d, { upTo: st.n, only: st.alone ? x => x.step === st.n : null }), u = d.units;
  const overlay = (V, fs) => {
    const [A, B, C, E] = [bay.a, bay.b, bay.c, bay.e].map(V.pr);
    return `<path class="gdg" d="M${f1(A[0])} ${f1(A[1])}L${f1(B[0])} ${f1(B[1])}M${f1(C[0])} ${f1(C[1])}L${f1(E[0])} ${f1(E[1])}"/>` +
      tag((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - fs * 0.6, `${u.len(bay.diag)} = ${u.len(bay.diag)}`, fs * 0.8, { cls: 'jl', anchor: 'middle' });
  };
  return sheet(items, [view], { now: it => it.step === st.n, labels: [], dims: false, overlay, title: () => `Step ${st.n}: ${VIEWS[view].title}`, u });
}

// a close-up of one real joint, from the side that shows both members in their plane
// labels: [{ id, text }] put each member's mark on it, a little way from the joint
export function jointCloseup(d, ids, at, view, labels = []) {
  const items = solids(d, { only: x => ids.includes(x.id) });
  const r = Math.max(...ids.map(id => Math.max(d.joints[id]?.hu || 20, d.joints[id]?.hw || 20))) * 5;
  const overlay = (V, fs) => {
    const [cx, cy] = V.pr(at);
    let s = `<circle class="jp" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(fs * 0.25)}"/>`;
    for (const l of labels) {
      const j = d.joints[l.id], far = [j.A, j.B].sort((a, b) => Math.hypot(...b.map((v, i) => v - at[i])) - Math.hypot(...a.map((v, i) => v - at[i])))[0];
      const dv = far.map((v, i) => v - at[i]), L = Math.hypot(...dv) || 1, p = at.map((v, i) => v + (dv[i] / L) * r * 0.62);
      const [x, y] = V.pr(p);
      s += tag(x, y + fs * 0.3, l.text, fs * 0.9, { cls: 'jl', anchor: 'middle' });
    }
    return s;
  };
  return viewSvg(items, view, { win: { c: at, r }, cls: 'jig', title: 'Joint close-up', overlay });
}

// one undimensioned view for a gallery card
export function thumbSvg(d, view = 'iso') {
  return viewSvg(solids(d), view, { u: d.units, dims: false, bare: true, cls: 'jig ga thumb' });
}

// one print alone, top front and side at one scale, dimensioned
export function printSheet(d, pr) {
  const cuts = [...(pr.cuts || []), ...pr.shapes.filter(c => c.type === 'tube').map(c => ({ type: 'cyl', a: c.a, b: c.b, r: c.ri }))];
  const items = [
    ...printSolids(pr).map(pts => ({ id: pr.id, kind: 'print', step: pr.step, pts })),
    ...printSolids({ shapes: cuts.map(c => (c.type === 'hole' ? { ...c, type: 'cyl', r: c.d / 2 } : c)) }).map(pts => ({ id: pr.id, kind: 'cut', step: pr.step, pts })),
  ];
  // text sized to the sheet as it is shown (about 520 px wide), not to the part
  const [lo, hi] = printBox(pr);
  const fs = Math.max((hi[0] - lo[0] + hi[1] - lo[1]) * 0.04, 1.2);
  return sheet(items, ['top', 'front', 'side'], { u: d.units, cls: 'jig ga', fs, title: v => `${pr.name}: ${VIEWS[v].title}` }).replace('<div class="sheet"', '<div class="sheet print"');
}

export function gaSheet(d) {
  return sheet(solids(d), ['top', 'front', 'side'], { u: d.units, cls: 'jig ga' });
}

// ---------------------------------------------------------------- cut sheet
// One piece mark: the two faces you mark, both ends drawn large with the middle
// broken out, the edge marks at each end, and how each end is joined.
// member ids under a mark, cut to the width of the sheet ("…and 6 more")
function idList(ids, width) {
  const max = Math.floor((width - 20) / 7.4);
  let out = '';
  for (let i = 0; i < ids.length; i++) {
    const next = (out ? out + ', ' : '') + ids[i];
    if (next.length > max - 14 && i < ids.length - 1) return `${out}, …and ${ids.length - i} more`;
    out = next;
  }
  return out;
}

export function pieceSvg(d, g) {
  const u = d.units, pm = g.pm, sec = g.sec;
  const [A, B] = g.endText;
  const head = (total) => `<text class="pt" x="10" y="28">${esc(g.mark)}</text><text class="pq" x="${10 + 18 * g.mark.length + 8}" y="28">x${g.qty}</text>` +
    `<text class="ps" x="10" y="52">${esc(g.name)} · ${esc(sec.short)} · step ${g.step}</text>` +
    `<text class="ps pm2" x="10" y="72">${esc(idList(g.ids, total))}</text>` +
    `<text class="pk" x="${total - 10}" y="28" text-anchor="end">${esc(u.len(pm.longPoint, { u: true }))}</text>` +
    `<text class="ps" x="${total - 10}" y="52" text-anchor="end">long point</text>`;
  // square both ends: no marks to transfer, one bar and its length is the whole sheet
  if (A.square && B.square) {
    const total = 760, x0 = 10, x1 = 600, y = 92, h = 22;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 190" class="piece square" role="img" aria-label="Cut sheet, piece ${esc(g.mark)}">` + head(total);
    s += `<rect class="pf" x="${x0}" y="${y}" width="${x1 - x0}" height="${h}"/>`;
    s += `<path class="dl" d="M${x0} ${y + h + 6}v18M${x1} ${y + h + 6}v18M${x0} ${y + h + 16}H${x1}"/>`;
    s += `<text class="pm" x="${(x0 + x1) / 2}" y="${y + h + 36}" text-anchor="middle">${esc(u.len(pm.longPoint))}, square both ends</text>`;
    s += `<text class="ps" x="10" y="174">Left end: ${esc(A.how)} · Right end: ${esc(B.how)}</text>`;
    return s + '</svg>';
  }
  const j = d.joints[g.ids[0]];
  const sizeMax = Math.max(2 * j.hu, 2 * j.hw);
  const k = Math.min(2.2, 70 / sizeMax), END = Math.max(60, sizeMax * 1.4);
  // a thin face is drawn at least 34 px tall so its two edge names stay apart
  const faces = [{ name: pm.faces.top, e: [0, 1], W: Math.max(34, 2 * j.hu * k) }, { name: pm.faces.side, e: [0, 3], W: Math.max(34, 2 * j.hw * k) }];
  const gap = 46, x0 = 150, strip = END * 2 * k + gap;
  let y = 96;
  const rows = faces.map(f => { const r = { ...f, y0: y }; y += f.W + 64; return r; });
  const H = y + 40;
  const total = Math.max(760, x0 + strip + 190);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${f1(H)}" class="piece" role="img" aria-label="Cut sheet, piece ${esc(g.mark)}">` + head(total);
  for (const f of rows) {
    const [e1, e2] = f.e.map(i => pm.edges[i]);
    const X = v => x0 + v * k;
    const XR = v => x0 + END * k + gap + (v - (pm.stock - END)) * k;
    const yA = f.y0, yB = f.y0 + f.W;
    s += `<text class="ps" x="10" y="${f1(yA + f.W / 2 + 5)}">${esc(f.name)} face</text>`;
    s += `<polygon class="pf" points="${f1(X(e1.a))},${f1(yA)} ${f1(X(END))},${f1(yA)} ${f1(X(END))},${f1(yB)} ${f1(X(e2.a))},${f1(yB)}"/>`;
    s += `<polygon class="pf" points="${f1(XR(pm.stock - END))},${f1(yA)} ${f1(XR(e1.b))},${f1(yA)} ${f1(XR(e2.b))},${f1(yB)} ${f1(XR(pm.stock - END))},${f1(yB)}"/>`;
    const brk = x => `M${f1(x)} ${f1(yA - 6)}l${gap / 4} ${f1(f.W / 3)}l-${gap / 4} ${f1(f.W / 3)}l${gap / 4} ${f1(f.W / 3 + 12)}`;
    s += `<path class="pb" d="${brk(X(END))}${brk(XR(pm.stock - END))}"/>`;
    s += `<text class="pm" x="${f1(X(e1.a) - 5)}" y="${f1(yA - 6)}" text-anchor="end">${esc(u.len(e1.a))}</text>`;
    s += `<text class="pm" x="${f1(X(e2.a) - 5)}" y="${f1(yB + 17)}" text-anchor="end">${esc(u.len(e2.a))}</text>`;
    s += `<text class="pm" x="${f1(XR(e1.b) + 5)}" y="${f1(yA - 6)}">${esc(u.len(e1.b))}</text>`;
    s += `<text class="pm" x="${f1(XR(e2.b) + 5)}" y="${f1(yB + 17)}">${esc(u.len(e2.b))}</text>`;
    s += `<text class="pe" x="${f1(x0 + strip + 64)}" y="${f1(yA + 9)}">${esc(e1.label)}</text><text class="pe" x="${f1(x0 + strip + 64)}" y="${f1(yB)}">${esc(e2.label)}</text>`;
  }
  s += `<text class="ps" x="10" y="${f1(H - 34)}">Left end: ${esc(A.ang)}, ${esc(A.how)}</text>`;
  s += `<text class="ps" x="10" y="${f1(H - 12)}">Right end: ${esc(B.ang)}, ${esc(B.how)}</text>`;
  return s + '</svg>';
}

// ---------------------------------------------------------------- plates
// A plate drawn on its two big dimensions, holes dimensioned from the lower-left
// corner. at: [a, b] in the plate's own drawing axes (first big axis, second).
export function plateSvg(d, pl) {
  const u = d.units;
  const ax = [0, 1, 2].sort((a, b) => pl.s[b] - pl.s[a]);
  const W = pl.s[ax[0]], H = pl.s[ax[1]], T = pl.s[ax[2]];
  const k = Math.min(520 / W, 260 / H);
  const ox = 70, oy = 60, w = W * k, h = H * k;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(Math.max(700, w + 220))} ${f1(h + 110)}" class="piece plate" role="img" aria-label="Plate ${esc(pl.id)}">`;
  s += `<text class="pt" x="10" y="28">${esc(pl.mark || pl.id)}</text><text class="pq" x="${10 + 18 * String(pl.mark || pl.id).length + 8}" y="28">x${pl.qty || 1}</text>`;
  s += `<text class="ps" x="10" y="50">${esc(pl.name)} · ${esc(u.len(T, { u: true }))} ${esc(pl.materialLabel || pl.material || 'steel')} · step ${pl.step}</text>`;
  const notches = pl.notches || [];
  if (!notches.length) s += `<rect class="pf" x="${ox}" y="${oy}" width="${f1(w)}" height="${f1(h)}" rx="${f1((pl.r || 0) * k)}"/>`;
  else {
    // the outline minus its notches, as grid cells: fill the kept cells, ink the edges between kept and cut
    const xs = [...new Set([0, W, ...notches.flatMap(n => [n[0], n[2]])])].sort((a, b) => a - b);
    const ys = [...new Set([0, H, ...notches.flatMap(n => [n[1], n[3]])])].sort((a, b) => a - b);
    const cut = (a, b) => notches.some(n => a > n[0] && a < n[2] && b > n[1] && b < n[3]);
    const keep = (i, j) => i >= 0 && j >= 0 && i < xs.length - 1 && j < ys.length - 1 && !cut((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2);
    const X = v => ox + v * k, Y = v => oy + h - v * k;
    let fillD = '', edgeD = '';
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      if (!keep(i, j)) continue;
      fillD += `M${f1(X(xs[i]))} ${f1(Y(ys[j]))}H${f1(X(xs[i + 1]))}V${f1(Y(ys[j + 1]))}H${f1(X(xs[i]))}Z`;
      if (!keep(i - 1, j)) edgeD += `M${f1(X(xs[i]))} ${f1(Y(ys[j]))}V${f1(Y(ys[j + 1]))}`;
      if (!keep(i + 1, j)) edgeD += `M${f1(X(xs[i + 1]))} ${f1(Y(ys[j]))}V${f1(Y(ys[j + 1]))}`;
      if (!keep(i, j - 1)) edgeD += `M${f1(X(xs[i]))} ${f1(Y(ys[j]))}H${f1(X(xs[i + 1]))}`;
      if (!keep(i, j + 1)) edgeD += `M${f1(X(xs[i]))} ${f1(Y(ys[j + 1]))}H${f1(X(xs[i + 1]))}`;
    }
    s += `<path class="pf" style="stroke:none" d="${fillD}"/><path class="pb" style="stroke:var(--ink);stroke-width:1.5" d="${edgeD}"/>`;
  }
  for (const hole of pl.holes || []) {
    const cx = ox + hole.at[0] * k, cy = oy + h - hole.at[1] * k;
    s += `<circle class="ph" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(Math.max(2.5, (hole.d / 2) * k))}"/>`;
  }
  // overall dims
  s += `<path class="dl" d="M${ox} ${f1(oy + h + 22)}H${f1(ox + w)}M${ox} ${f1(oy + h + 6)}v24M${f1(ox + w)} ${f1(oy + h + 6)}v24"/>`;
  s += `<text class="pm" x="${f1(ox + w / 2)}" y="${f1(oy + h + 44)}" text-anchor="middle">${esc(u.len(W))}</text>`;
  s += `<path class="dl" d="M${f1(ox + w + 22)} ${oy}V${f1(oy + h)}M${f1(ox + w + 6)} ${oy}h24M${f1(ox + w + 6)} ${f1(oy + h)}h24"/>`;
  s += `<text class="pm" x="${f1(ox + w + 34)}" y="${f1(oy + h / 2 + 5)}">${esc(u.len(H))}</text>`;
  // where the members welded to it stand: their outline on its face, dashed
  for (const f of pl.footprints || []) s += `<rect class="pfoot" x="${f1(ox + f[0] * k)}" y="${f1(oy + h - f[3] * k)}" width="${f1((f[2] - f[0]) * k)}" height="${f1((f[3] - f[1]) * k)}"/>`;
  return s + '</svg>';
}

// The words under a plate drawing: holes, notches, what stands on it, the note.
export function plateNotes(d, pl) {
  const u = d.units, out = [];
  if (pl.holes?.length) {
    const hs = [...new Set(pl.holes.map(hh => hh.d))];
    out.push(`${pl.holes.length} hole${pl.holes.length > 1 ? 's' : ''} ${hs.map(v => `⌀${u.len(v, { u: true })}`).join(', ')}, centres from the lower-left corner: ${pl.holes.map(hh => `(${u.len(hh.at[0])}, ${u.len(hh.at[1])})`).join(' ')}.`);
  }
  const n = pl.notches || [];
  if (n.length) {
    const sizes = [...new Set(n.map(q => `${u.len(q[2] - q[0])} × ${u.len(q[3] - q[1])}`))];
    out.push(`${n.length} notch${n.length > 1 ? 'es' : ''} ${sizes.join(', ')} for the members that pass through, from the lower-left corner: ${n.map(q => `(${u.len(q[0])}, ${u.len(q[1])})`).join(' ')}.`);
  }
  const f = pl.footprints || [];
  if (f.length) out.push(`Dashed: where ${f.length > 1 ? 'members meet' : 'a member meets'} its face (welded on, or under it), from the lower-left corner: ${f.map(q => `(${u.len(q[0])}, ${u.len(q[1])})`).join(' ')}.`);
  if (pl.note) out.push(pl.note);
  return out;
}

// ---------------------------------------------------------------- nesting
export function nestSvg(d, n) {
  const u = d.units, S = n.sec.stockLen, W = 720, k = W / S, bh = 26, gap = 12;
  const H = n.bars.length * (bh + gap) + 44;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 120} ${H}" class="nest" role="img" aria-label="Cutting plan ${esc(n.sec.short)}">`;
  s += `<text class="ps" x="0" y="16">${esc(n.sec.short)} · ${n.bars.length} x ${esc(u.size(S))} lengths · kerf ${esc(u.len(d.model.kerf))}</text>`;
  n.bars.forEach((b, i) => {
    const y = 30 + i * (bh + gap);
    s += `<rect class="nb" x="0" y="${y}" width="${f1(W)}" height="${bh}"/>`;
    for (const c of b.cuts) {
      const x = c.at * k, w = c.L * k;
      s += `<rect class="nc" x="${f1(x)}" y="${y}" width="${f1(w)}" height="${bh}"/>`;
      if (w > 22) s += `<text class="nt" x="${f1(x + w / 2)}" y="${y + bh / 2 + 5}" text-anchor="middle">${esc(c.mark)}</text>`;
    }
    s += `<text class="ps" x="${W + 8}" y="${y + bh / 2 + 5}">off ${esc(u.len(S - b.used))}</text>`;
  });
  return s + '</svg>';
}

export const SHOP_CSS = `
.piece,.jig,.nest{background:var(--paper);max-width:100%;height:auto;display:block}
.pt{font:700 24px var(--mono);fill:var(--ink)}.pq{font:400 20px var(--mono);fill:var(--muted)}
.ps{font:14px var(--sans);fill:var(--ink2)}.pm2{font:12px var(--mono);fill:var(--muted)}
.pk{font:700 20px var(--mono);fill:var(--ink)}.pm{font:700 15px var(--mono);fill:var(--ink)}.pe{font:12px var(--mono);fill:var(--muted)}
.pf{fill:var(--face);stroke:var(--ink);stroke-width:1.5}.pb{fill:none;stroke:var(--muted);stroke-width:1.2}
.ph{fill:var(--paper);stroke:var(--ink);stroke-width:1.5}.pfoot{fill:none;stroke:var(--ink2);stroke-width:1.2;stroke-dasharray:6 4}
.jn{fill:var(--now);stroke:var(--ink);stroke-width:calc(var(--fs) * .09)}.jo{fill:var(--old);stroke:var(--oldline);stroke-width:calc(var(--fs) * .07)}
.jn.f{stroke:var(--now);stroke-width:calc(var(--fs) * .03)}.jo.f{stroke:var(--old);stroke-width:calc(var(--fs) * .03)}.ga .jn.f{stroke:var(--face)}.jn.e,.jo.e{fill:none;stroke-linecap:round}
.ga .jn{fill:var(--face)}.jn.k-print,.jo.k-print{fill:var(--paper);fill-opacity:.6}.jn.k-cut,.jo.k-cut{fill:none;stroke-dasharray:calc(var(--fs) * .35) calc(var(--fs) * .2);stroke-width:calc(var(--fs) * .05)}.jn.k-hardware,.jo.k-hardware{fill:none;stroke-dasharray:calc(var(--fs) * .4) calc(var(--fs) * .25)}
.dl{stroke:var(--ink2);stroke-width:calc(var(--fs) * .06);fill:none}.da{fill:var(--ink2)}
.dt{font:700 var(--fs) var(--mono);fill:var(--ink)}
.lbox{fill:var(--paper);stroke:var(--oldline);stroke-width:calc(var(--fs) * .04)}
.jp{fill:var(--ink)}.jl{font:700 calc(var(--fs) * .8) var(--mono);fill:var(--ink)}.jt{font:700 calc(var(--fs) * .8) var(--mono);fill:var(--ink)}
.gmk{fill:none;stroke:var(--ink);stroke-width:calc(var(--fs) * .14)}.gdg{fill:none;stroke:var(--ink);stroke-width:calc(var(--fs) * .1);stroke-dasharray:calc(var(--fs) * .6) calc(var(--fs) * .35)}
.close{background:var(--paper)}
.nb{fill:var(--paper);stroke:var(--oldline)}.nc{fill:var(--face);stroke:var(--ink);stroke-width:1}.nt{font:700 13px var(--mono);fill:var(--ink)}
`;
