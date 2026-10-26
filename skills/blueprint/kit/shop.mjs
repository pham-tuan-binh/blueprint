// Shop drawings as SVG strings: cut sheets, jig views, the general arrangement,
// plate sheets and the stock nesting. Pure functions of a derived plan (derive.mjs)
// and the units in force, so imperial is a re-render, never a second drawing.
import { esc, f1, r0 } from './core.mjs';
import { memberCorners, describeEnd } from './joints.mjs';
import { hull2 } from './derive.mjs';

// ---------------------------------------------------------------- views
// top: looking down, front at the bottom. front: from -y. side: from +x.
// depth: larger is nearer the viewer, drawn later.
export const VIEWS = {
  top: { title: 'Top', pr: q => [q[0], -q[1]], depth: q => q[2] },
  front: { title: 'Front', pr: q => [q[0], -q[2]], depth: q => -q[1] },
  side: { title: 'Side (from the right)', pr: q => [q[1], -q[2]], depth: q => q[0] },
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
  for (const h of d.model.hardware) if (h.shape && h.step <= upTo && (!only || only(h))) {
    const shapes = [].concat(h.shape);
    for (const sh of shapes) out.push({ id: h.id, kind: 'hardware', step: h.step, pts: sh.type === 'box' ? boxCorners([sh.c.map((v, i) => v - sh.s[i] / 2), sh.c.map((v, i) => v + sh.s[i] / 2)]) : cylCorners(sh) });
  }
  return out;
}

// One orthographic view with overall dimensions. now(id) marks the parts of this step.
function viewSvg(items, view, { now = () => true, labels = [], title = '', u, dims = true, cls = 'jig', fs: fsIn }) {
  const V = VIEWS[view];
  const polys = items.map(it => ({ ...it, hull: hull2(it.pts.map(V.pr)), depth: it.pts.reduce((s, q) => s + V.depth(q), 0) / it.pts.length }))
    .sort((a, b) => a.depth - b.depth);
  const all = polys.flatMap(p => p.hull);
  const x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0]));
  const y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]));
  const span = Math.max(x1 - x0, y1 - y0, 200);
  const fs = fsIn || span / 34, pad = fs * 5;
  // the dimensioned extent is what this step adds (or everything, when it is the GA)
  const nowPts = polys.filter(p => now(p)).flatMap(p => p.hull);
  const dx0 = Math.min(...nowPts.map(p => p[0])), dx1 = Math.max(...nowPts.map(p => p[0]));
  const dy0 = Math.min(...nowPts.map(p => p[1])), dy1 = Math.max(...nowPts.map(p => p[1]));
  const vb = [x0 - pad, y0 - pad * 1.2, x1 - x0 + pad * 2.2, y1 - y0 + pad * 2.6];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f1).join(' ')}" class="${cls}" style="--fs:${f1(fs)}px" data-w="${f1(vb[2])}" role="img" aria-label="${esc(title || V.title)}">`;
  for (const p of polys) s += `<polygon class="${now(p) ? 'jn' : 'jo'} k-${p.kind}" points="${p.hull.map(q => f1(q[0]) + ',' + f1(q[1])).join(' ')}"/>`;
  if (dims && nowPts.length) {
    const a = fs * 0.5, off = fs * 2.2;
    const yb = y1 + off, xr = x1 + off;
    // horizontal: under the view
    s += `<path class="dl" d="M${f1(dx0)} ${f1(dy1 + fs * 0.4)}V${f1(yb + a)}M${f1(dx1)} ${f1(dy1 + fs * 0.4)}V${f1(yb + a)}M${f1(dx0)} ${f1(yb)}H${f1(dx1)}"/>`;
    s += `<path class="da" d="M${f1(dx0)} ${f1(yb)}l${f1(a * 1.6)} ${f1(-a * 0.55)}v${f1(a * 1.1)}zM${f1(dx1)} ${f1(yb)}l${f1(-a * 1.6)} ${f1(-a * 0.55)}v${f1(a * 1.1)}z"/>`;
    s += `<text class="dt" x="${f1((dx0 + dx1) / 2)}" y="${f1(yb - fs * 0.35)}" text-anchor="middle">${esc(u.len(dx1 - dx0))}</text>`;
    // vertical: right of the view
    s += `<path class="dl" d="M${f1(dx1 + fs * 0.4)} ${f1(dy0)}H${f1(xr + a)}M${f1(dx1 + fs * 0.4)} ${f1(dy1)}H${f1(xr + a)}M${f1(xr)} ${f1(dy0)}V${f1(dy1)}"/>`;
    s += `<path class="da" d="M${f1(xr)} ${f1(dy0)}l${f1(-a * 0.55)} ${f1(a * 1.6)}h${f1(a * 1.1)}zM${f1(xr)} ${f1(dy1)}l${f1(-a * 0.55)} ${f1(-a * 1.6)}h${f1(a * 1.1)}z"/>`;
    s += `<text class="dt" x="${f1(xr + fs * 0.4)}" y="${f1((dy0 + dy1) / 2)}" transform="rotate(-90 ${f1(xr + fs * 0.4)} ${f1((dy0 + dy1) / 2)})" text-anchor="middle" dy="${f1(-fs * 0.2)}">${esc(u.len(dy1 - dy0))}</text>`;
  }
  // points that land on the same spot in this view share one label: BL1…BL4
  const spots = new Map();
  for (const l of labels) {
    const [x, y] = V.pr(l.p), k = `${Math.round(x)},${Math.round(y)}`;
    if (!spots.has(k)) spots.set(k, { p: l.p, names: [] });
    spots.get(k).names.push(l.name);
  }
  const merged = [...spots.values()].map(sp => ({ p: sp.p, name: sp.names.length > 2 ? `${sp.names[0]}…${sp.names[sp.names.length - 1]}` : sp.names.join(', ') }));
  for (const l of merged) {
    const [x, y] = V.pr(l.p);
    s += `<circle class="jp" cx="${f1(x)}" cy="${f1(y)}" r="${f1(fs * 0.28)}"/><text class="jl" x="${f1(x + fs * 0.45)}" y="${f1(y - fs * 0.4)}">${esc(l.name)}</text>`;
  }
  s += `<text class="jt" x="${f1(vb[0] + fs * 0.6)}" y="${f1(vb[1] + fs * 1.6)}">${esc(title || V.title)}</text>`;
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
  const fs = Math.max(ext(0), ext(1), ext(2), 200) / 34;
  const svg = {};
  for (const v of views) svg[v] = viewSvg(items, v, { ...opts, fs, title: opts.title ? opts.title(v) : VIEWS[v].title });
  const w = v => +svg[v].match(/data-w="([\d.]+)"/)[1];
  if (views.length === 1) return `<div class="sheet one"><figure>${svg[views[0]]}</figure></div>`;
  const cols = views.includes('side') ? `${f1(w('front'))}fr ${f1(w('side'))}fr` : '1fr';
  return `<div class="sheet" style="grid-template-columns:${cols}">` +
    (views.includes('top') ? `<figure class="v-top">${svg.top}</figure>` : '') +
    (views.includes('front') ? `<figure class="v-front">${svg.front}</figure>` : '') +
    (views.includes('side') ? `<figure class="v-side">${svg.side}</figure>` : '') + `</div>`;
}

export function jigSheet(d, st, views) {
  const items = solids(d, { upTo: st.n, only: st.alone ? x => x.step === st.n : null });
  return sheet(items, views, { now: it => it.step === st.n, labels: stepNodes(d, st.n), title: v => `Step ${st.n}: ${VIEWS[v].title}`, u: d.units });
}

export function gaSheet(d) {
  return sheet(solids(d), ['top', 'front', 'side'], { u: d.units, cls: 'jig ga' });
}

// ---------------------------------------------------------------- cut sheet
// One piece mark: the two faces you mark, both ends drawn large with the middle
// broken out, the edge marks at each end, and how each end is joined.
export function pieceSvg(d, g) {
  const u = d.units, pm = g.pm, sec = g.sec;
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
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${f1(H)}" class="piece" role="img" aria-label="Cut sheet, piece ${esc(g.mark)}">`;
  s += `<text class="pt" x="10" y="28">${esc(g.mark)}</text><text class="pq" x="${10 + 18 * g.mark.length + 8}" y="28">x${g.qty}</text>`;
  s += `<text class="ps" x="10" y="52">${esc(g.name)} · ${esc(sec.short)} · step ${g.step}</text>`;
  s += `<text class="ps pm2" x="10" y="72">${esc(g.ids.join(', '))}</text>`;
  s += `<text class="pk" x="${total - 10}" y="28" text-anchor="end">${esc(u.len(pm.longPoint, { u: true }))}</text>`;
  s += `<text class="ps" x="${total - 10}" y="52" text-anchor="end">long point</text>`;
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
  const A = describeEnd(pm.ends.A), B = describeEnd(pm.ends.B);
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
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(Math.max(700, w + 220))} ${f1(h + 150)}" class="piece plate" role="img" aria-label="Plate ${esc(pl.id)}">`;
  s += `<text class="pt" x="10" y="28">${esc(pl.mark || pl.id)}</text><text class="pq" x="${10 + 18 * String(pl.mark || pl.id).length + 8}" y="28">x${pl.qty || 1}</text>`;
  s += `<text class="ps" x="10" y="50">${esc(pl.name)} · ${esc(u.len(T, { u: true }))} ${esc(pl.materialLabel || pl.material || 'steel')} · step ${pl.step}</text>`;
  s += `<rect class="pf" x="${ox}" y="${oy}" width="${f1(w)}" height="${f1(h)}" rx="${f1((pl.r || 0) * k)}"/>`;
  for (const hole of pl.holes || []) {
    const cx = ox + hole.at[0] * k, cy = oy + h - hole.at[1] * k;
    s += `<circle class="ph" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(Math.max(2.5, (hole.d / 2) * k))}"/>`;
  }
  // overall dims
  s += `<path class="dl" d="M${ox} ${f1(oy + h + 22)}H${f1(ox + w)}M${ox} ${f1(oy + h + 6)}v24M${f1(ox + w)} ${f1(oy + h + 6)}v24"/>`;
  s += `<text class="pm" x="${f1(ox + w / 2)}" y="${f1(oy + h + 44)}" text-anchor="middle">${esc(u.len(W))}</text>`;
  s += `<path class="dl" d="M${f1(ox + w + 22)} ${oy}V${f1(oy + h)}M${f1(ox + w + 6)} ${oy}h24M${f1(ox + w + 6)} ${f1(oy + h)}h24"/>`;
  s += `<text class="pm" x="${f1(ox + w + 34)}" y="${f1(oy + h / 2 + 5)}">${esc(u.len(H))}</text>`;
  if (pl.holes?.length) {
    const hs = [...new Map(pl.holes.map(hh => [hh.d, hh])).values()];
    s += `<text class="ps" x="10" y="${f1(oy + h + 76)}">${pl.holes.length} holes: ${hs.map(hh => `⌀${esc(u.len(hh.d))}`).join(', ')} · centres from the lower-left corner: ${pl.holes.map(hh => `(${u.len(hh.at[0])}, ${u.len(hh.at[1])})`).join(' ')}</text>`;
  }
  if (pl.note) s += `<text class="ps" x="10" y="${f1(oy + h + (pl.holes?.length ? 98 : 76))}">${esc(pl.note)}</text>`;
  return s + '</svg>';
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
.ph{fill:var(--paper);stroke:var(--ink);stroke-width:1.5}
.jn{fill:var(--now);stroke:var(--ink);stroke-width:calc(var(--fs) * .09)}.jo{fill:var(--old);stroke:var(--oldline);stroke-width:calc(var(--fs) * .07)}
.ga .jn{fill:var(--face)}.jn.k-hardware,.jo.k-hardware{fill:none;stroke-dasharray:calc(var(--fs) * .4) calc(var(--fs) * .25)}
.dl{stroke:var(--ink2);stroke-width:calc(var(--fs) * .06);fill:none}.da{fill:var(--ink2)}
.dt{font:700 var(--fs) var(--mono);fill:var(--ink)}
.jp{fill:var(--ink)}.jl{font:700 calc(var(--fs) * .8) var(--mono);fill:var(--ink)}.jt{font:700 calc(var(--fs) * 1.1) var(--sans);fill:var(--ink)}
.nb{fill:var(--paper);stroke:var(--oldline)}.nc{fill:var(--face);stroke:var(--ink);stroke-width:1}.nt{font:700 13px var(--mono);fill:var(--ink)}
`;
