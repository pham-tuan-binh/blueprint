// The guide (guide.html, "How to read this plan") and the "?" explainers dotted
// through the plan. The plan stays terse; what a first-timer needs lives here.
// Every figure is generated from the plan (shop.mjs), so it changes with it.
import { esc } from './core.mjs';
import { pieceSvg, stepViews, stepNodes, markedJig, bayOf, diagJig, jointCloseup, CODE } from './shop.mjs';
import { partBoxes } from './derive.mjs';

// ---------------------------------------------------------------- explainers
// key: [short explanation, guide section]
export const TIPS = {
  datum: ['Datum: the zero every position is measured from. The legend says where x, y and z start.', 'coords'],
  points: ['Where the members\' centre lines meet, measured from the datum. Mark each one before you place the parts.', 'coords'],
  cl: ['℄ = a centre-line dimension: from the middle of one member to the middle of the other, not outside to outside.', 'coords'],
  jig: ['This step\'s parts, full layout: dark = fit now, light = already there. Set the parts on the marked points.', 'jig'],
  plumb: ['Exactly vertical. Check two faces with a level.', 'jig'],
  diag: ['Measure corner to corner both ways. Equal = square. Not equal: push the long diagonal until they match.', 'square'],
  check: ['A gate: pass it before the next step. Fixing it later costs far more.', 'start'],
  warn: ['A warning: read it before you start the step.', 'start'],
  mark: ['Piece mark: one letter per different piece. Write it on each piece as you cut it.', 'cut'],
  lp: ['Long point: the overall length of the piece, tip to tip.', 'cut'],
  marks: ['Distances from the square end of the stock to the cut, one per edge. Mark every edge, join the marks, cut.', 'cut'],
  sheets: ['One cut sheet per piece mark: its length and how each end is cut.', 'cut'],
  deburr: ['Take the sharp edge off with a file or a deburring tool.', 'cut'],
  mitre: ['Two members of the same size cut at the same angle so they meet on the middle line, like a picture frame.', 'joints'],
  butt: ['This end is cut square and sits flat against the face of the other member.', 'joints'],
  flush: ['Where sizes differ, the end stops level with the outside of the other member.', 'joints'],
  fitting: ['The pipe goes into a bought fitting (a tee, an elbow, a cap) until it bottoms out in the socket.', 'joints'],
  tack: ['A small spot of weld that just holds parts in place. Easy to break and redo, unlike a full weld.', 'weld'],
  weldout: ['Welding every joint all the way round, in short runs spread around the frame so the heat does not pull it out of shape.', 'weld'],
  cement: ['Solvent cement melts the pipe and fitting together. Primer first, then cement, push home with a quarter turn. It sets in seconds.', 'glue'],
  dryfit: ['Put everything together without glue first, so a mistake costs nothing.', 'glue'],
  primer: ['Primer cleans and softens the pipe and the socket so the cement bites. Brush it on both, then cement while it is still wet.', 'glue'],
  cure: ['Cement sets in seconds but takes hours to reach full strength. Handle the frame gently after about 2 hours; load it only after the full cure time on the can.', 'glue'],
  chamfer: ['A small bevel on the outside edge of the cut end, so it slides into the socket without scraping off the cement.', 'glue'],
  print: ['Print the part with the settings shown, the way it says to lay it on the bed. The .stl is the part at this size.', 'prints'],
  stock: ['Bought lengths. The cutting plan shows which pieces come out of which length.', 'stock'],
  sf: ['Safety factor: how many times the load it could take before the metal starts to bend for good. 2 or more for furniture, 3 for anything a person stands on.', 'checks'],
  sag: ['How far the loaded part moves under the rated load. Small enough that you will not notice it.', 'checks'],
  tol: ['± is how far off you may be and still be right.', 'tol'],
  loadtest: ['Load it a little at a time up to the rated load, watching for movement, before you trust it.', 'checks'],
};

// The three marks as drawn icons, so each sits dead centre in its circle whatever the
// font: a black outline always, the fill from the colour code (yellow ?, green ✓, red !).
// Size and paint are also attributes, so an icon looks right even before a stylesheet applies.
const mk = (cls, fill, ink, inner) => `<svg class="mk ${cls}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="10.6" fill="${fill}" stroke="#14171a" stroke-width="1.6"/>${inner(ink)}</svg>`;
const ln = (d, ink) => `<path class="ln" d="${d}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
const dot = (cx, cy, r, ink) => `<circle class="dot" cx="${cx}" cy="${cy}" r="${r}" fill="${ink}"/>`;
export const ICON = {
  q: mk('mk-q', CODE.yellow, '#14171a', k => ln('M9.1 9.3a2.9 2.9 0 1 1 4.3 2.6c-.9.5-1.4 1.1-1.4 2.1v.4', k) + dot(12, 17.6, 1.25, k)),
  check: mk('mk-ok', CODE.green, '#fff', k => ln('M7.4 12.4l3.1 3.1 6.1-6.6', k)),
  warn: mk('mk-warn', CODE.red, '#fff', k => ln('M12 6.6v7.2', k) + dot(12, 17.4, 1.3, k)),
};

// the circled "?" itself
export function q(key) {
  const t = TIPS[key];
  if (!t) return '';
  return `<span class="q" role="button" tabindex="0" aria-label="Explain" data-tip="${esc(t[0])}" data-more="${t[1]}">${ICON.q}</span>`;
}

// words in step text that get a "?" (the first time each appears in a step)
const TERMS = [
  [/\btack(s|ed|ing)?\b/i, 'tack'], [/\bweld (it )?out\b|\bweld-out\b/i, 'weldout'], [/\bmitre(s|d)?\b/i, 'mitre'],
  [/\bdiagonals?\b/i, 'diag'], [/\bplumb\b/i, 'plumb'], [/\bdeburr\b/i, 'deburr'], [/\blong point\b/i, 'lp'],
  [/\bdatum\b/i, 'datum'], [/\bsolvent cement\b|\bcement\b/i, 'cement'], [/\bdry fit\b/i, 'dryfit'], [/\bprimer\b/i, 'primer'], [/(?<![-\w])cur(e|ed|ing)\b/i, 'cure'], [/\bchamfer(s|ed)?\b/i, 'chamfer'], [/\bload[- ]test\b/i, 'loadtest'],
  [/\bcutting plan\b/i, 'stock'], [/\bpiece marks?\b/i, 'mark'],
];
export function annotate(text, seen = new Set()) {
  const hits = [];
  for (const [re, key] of TERMS) {
    if (seen.has(key)) continue;
    const m = re.exec(text);
    if (m && !hits.some(h => m.index < h.end && h.start < m.index + m[0].length)) { hits.push({ start: m.index, end: m.index + m[0].length, key }); seen.add(key); }
  }
  hits.sort((a, b) => a.start - b.start);
  let out = '', at = 0;
  for (const h of hits) { out += esc(text.slice(at, h.end)) + q(h.key); at = h.end; }
  return out + esc(text.slice(at));
}

// One floating bubble for every "?": hover with a mouse, tap or Enter on touch
// and keyboard. Self-contained, so a page can inline it as a string.
export function initTips(guideHref) {
  if (window.__tips) return;
  window.__tips = true;
  const pop = document.createElement('div');
  pop.className = 'qpop'; pop.hidden = true; pop.setAttribute('role', 'tooltip');
  document.body.append(pop);
  let cur = null, pinned = false, hideT = 0;
  const place = el => {
    const r = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
    let y = r.bottom + 8;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  };
  const show = (el, pin) => {
    clearTimeout(hideT); cur = el; pinned = pin;
    pop.textContent = '';
    const p = document.createElement('p'); p.textContent = el.dataset.tip; pop.append(p);
    if (el.dataset.more) {
      const a = document.createElement('a');
      a.href = guideHref + '#' + el.dataset.more; a.textContent = 'More in the guide →';
      if (guideHref) { a.target = '_blank'; a.rel = 'noopener'; }
      pop.append(a);
    }
    pop.hidden = false; place(el);
  };
  const hide = () => { pop.hidden = true; cur = null; pinned = false; };
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    if (e.target.closest('.qpop')) { clearTimeout(hideT); return; }
    const el = e.target.closest('.q');
    if (el && !pinned) show(el, false);
  });
  document.addEventListener('pointerout', e => {
    if (e.pointerType !== 'mouse' || pinned) return;
    if (e.target.closest('.q, .qpop')) hideT = setTimeout(hide, 300);
  });
  // capture, so a "?" inside a label or summary does not also tick or fold it
  document.addEventListener('click', e => {
    const el = e.target.closest('.q');
    if (el) { e.preventDefault(); e.stopPropagation(); if (cur === el && pinned) hide(); else show(el, true); return; }
    if (!e.target.closest('.qpop')) hide();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hide();
    const el = e.target.closest?.('.q');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(el, true); }
  });
  addEventListener('scroll', () => { if (cur) place(cur); }, { passive: true });
  addEventListener('resize', () => { if (cur) place(cur); });
}

export const Q_CSS = `
.q{display:inline-block;width:1.2em;height:1.2em;margin-left:.3em;vertical-align:middle;position:relative;top:0;cursor:help;user-select:none}
.mk{display:block;width:100%;height:100%;overflow:visible}.mk circle:first-child{stroke:var(--ink);stroke-width:1.6}.mk .ln{fill:none;stroke:var(--ink);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.mk .dot{fill:var(--ink)}
.mk-q circle:first-child{fill:${CODE.yellow}}.mk-ok circle:first-child{fill:${CODE.green}}.mk-warn circle:first-child{fill:${CODE.red}}.mk-ok .ln,.mk-warn .ln{stroke:#fff}.mk-warn .dot{fill:#fff}
.q:hover .mk-q circle:first-child,.q:focus-visible .mk-q circle:first-child{fill:var(--ink)}.q:hover .mk-q .ln,.q:focus-visible .mk-q .ln{stroke:${CODE.yellow}}.q:hover .mk-q .dot,.q:focus-visible .mk-q .dot{fill:${CODE.yellow}}
th .q,h4 .q,summary .q{width:15px;height:15px}
.qpop{position:fixed;z-index:50;max-width:min(320px,calc(100vw - 16px));background:var(--paper);color:var(--ink);border:1.5px solid var(--ink);padding:8px 12px;font:14px/1.45 var(--sans);text-align:left;white-space:normal}
.qpop p{margin:0 0 4px}.qpop a{color:var(--ink);font-weight:600}
.guide-cta{display:flex;align-items:center;gap:14px;margin:0 0 8px;padding:12px 16px;border:1.5px solid var(--ink);color:var(--ink);text-decoration:none;background:var(--paper)}
.guide-cta:hover{background:var(--th)}
.guide-cta .gq{flex:none;width:40px;height:40px}
.guide-cta b{display:block;font-size:17px}.guide-cta small{display:block;font-size:13px;color:var(--ink2);margin-top:2px}.guide-cta .arr{margin-left:auto;flex:none;width:22px;height:22px}
@media print{.q,.qpop,.guide-cta{display:none!important}}
`;

const EXT = '<svg class="arr" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
export function guideCta(href = 'guide.html') {
  return `<a class="guide-cta" href="${href}" target="_blank" rel="noopener"><span class="gq">${ICON.q}</span><span><b>New to building? Start here: How to read this plan</b><small>Coordinates, cut sheets, joints and checks, with drawings from this plan. Then tap any <span class="q" style="pointer-events:none">${ICON.q}</span> for a quick reminder.</small></span>${EXT}</a>`;
}

// ---------------------------------------------------------------- the guide page
const fig = (svg, cap) => `<figure class="gfig">${svg}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;

// the side that shows two directions in their own plane: top for x-y, front for x-z, side for y-z
function viewFor(dirs) {
  const normals = { top: [0, 0, 1], front: [0, 1, 0], side: [1, 0, 0] };
  let best = 'front', bs = Infinity;
  for (const [v, n] of Object.entries(normals)) {
    const s = dirs.reduce((a, dv) => a + Math.abs(dv[0] * n[0] + dv[1] * n[1] + dv[2] * n[2]), 0);
    if (s < bs - 1e-6) { bs = s; best = v; }
  }
  return best;
}

// one real joint of each kind in the plan: [kind, caption, svg]
function jointExamples(d) {
  const md = d.model, out = [], seen = new Set(), used = [];
  const fresh = p => !used.some(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1);
  const lab = ids => ids.filter(id => d.joints[id]).map(id => ({ id, text: d.markOf[id] || id }));
  const dir = id => { const j = d.joints[id], v = j.B.map((x, i) => x - j.A[i]), l = Math.hypot(...v) || 1; return v.map(x => x / l); };
  const name = id => d.ref(id);
  for (const m of md.members) for (const end of ['A', 'B']) {
    const j = d.joints[m.id], e = j.ends[end], at = j[end];
    let kind = e.kind, other = e.onto || e.with || e.to;
    if (kind === 'free') {
      const inside = (b, p) => [0, 1, 2].every(i => p[i] >= b[0][i] && p[i] <= b[1][i]);
      const fit = md.hardware.flatMap(h => partBoxes(h)).find(f => inside(f.b, at));
      if (!fit || seen.has('fitting')) continue;
      kind = 'fitting';
      const h = fit.h, box = fit.b;
      const near = md.members.filter(o => o.id !== m.id && ['A', 'B'].some(k => [0, 1, 2].every(i => d.joints[o.id][k][i] >= box[0][i] && d.joints[o.id][k][i] <= box[1][i])));
      if (!near.length) continue;          // a cap holds one pipe: show a fitting where pipes meet
      const ids = [m.id, ...near.map(o => o.id), h.id];
      seen.add(kind);
      out.push(['into a fitting', `${esc(name(m.id))} into the ${esc(h.name.split(',')[0].toLowerCase())}`, jointCloseup(d, ids, [0, 1, 2].map(i => (box[0][i] + box[1][i]) / 2), viewFor([dir(m.id), ...near.map(o => dir(o.id))]), lab(ids))]);
      continue;
    }
    if (seen.has(kind) || !other || !d.joints[other] || !fresh(at)) continue;
    seen.add(kind); used.push(at);
    const word = { miter: 'mitre', butt: 'butt', flush: 'flush' }[kind];
    out.push([word, `${esc(name(m.id))} ${word === 'mitre' ? 'mitred to' : word === 'butt' ? 'butts onto' : 'flush with'} ${esc(name(other))}`, jointCloseup(d, [m.id, other], at, viewFor([dir(m.id), dir(other)]), lab([m.id, other]))]);
  }
  return out;
}

export function guideHtml(d, { pageCss = '', back = 'index.html' } = {}) {
  const md = d.model, u = d.units, plan = d.plan;
  const welded = d.weld.joins > 0 && (!md.join || md.join === 'weld');
  const glued = md.join === 'glue';
  const framed = md.steps.filter(st => md.members.some(m => m.step === st.n));
  // the first step laid out by points gives the coordinates figure; any step whose corners make a rectangle, the squareness one
  const ptStep = framed.find(st => st.points !== false && stepNodes(d, st.n).length);
  let bay = null;
  for (const st of framed) { for (const v of stepViews(d, st)) { const b = bayOf(d, st, v); if (b) { bay = { st, v, b }; break; } } if (bay) break; }
  const piece = d.pieces.find(g => !(g.endText[0].square && g.endText[1].square)) || d.pieces[0];
  const joints = jointExamples(d);

  const S = [];
  const add = (id, title, note, body) => S.push({ id, title, note, body });
  add('start', 'How the plan works', 'parts of a step', `
<p>${esc(md.steps.length)} steps, in order. ${welded ? 'Tack, measure, then weld.' : glued ? 'Dry fit, check, then cement.' : 'Fit, check, then fix.'}</p>
<div class="wrap"><table class="doc"><tr><th>In a step</th><th></th></tr>
<tr><td>1</td><td>step number, title, time for one person</td></tr>
<tr><td>1. 2. 3.</td><td>tasks, in order</td></tr>
<tr><td>✓</td><td>pass this before the next step</td></tr>
<tr><td>!</td><td>a warning</td></tr>
${framed.length ? `<tr><td>Jig</td><td>this step's parts, dark; earlier ones light</td></tr><tr><td>Joint positions</td><td>those points, from the datum</td></tr><tr><td>Pieces</td><td>one cut sheet per piece mark</td></tr>` : ''}
${d.prints.length ? '<tr><td>Print</td><td>the part, its settings and its files</td></tr>' : ''}
</table></div>
<p><b>Make it yours</b> changes the sizes: every number on the plan follows. The <b>3D view beside the steps</b> follows the step you are reading: the build as it stands after it, that step's parts lit (on a phone, tap <b>3D</b>).</p>`);
  if (md.tools?.length) add('tools', 'Tools you need', 'what to have', `<ul>${md.tools.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`);
  if (ptStep) {
    const view = stepViews(d, ptStep).includes('top') ? 'top' : stepViews(d, ptStep)[0];
    const pt = stepNodes(d, ptStep.n)[0];
    add('coords', 'Coordinates', 'x, y, z from the datum', `
<p>Every position is from the <b>datum</b>: ${esc(md.datum || 'x along the length, y front to back, z up from the floor')}.</p>
${fig(markedJig(d, ptStep, view, pt.name), `One joint, <code>${esc(pt.name)}</code>: where the centre lines of its members meet.`)}
<ol><li>Mark the datum lines on your table or floor.</li><li>Measure x along one, then y square to it.</li><li>Mark each point, then set the parts on the marks.</li></ol>
<p>Dimensions marked <code>℄</code> are centre to centre.</p>`);
    add('jig', 'Jig drawings', 'dark = now, light = done', `<p>Each step's jig shows the parts to fit now in dark, the parts already there in light, and every joint labelled. The joint table under it gives the same points as numbers.</p>`);
  }
  if (bay) add('square', 'Squareness', 'diagonals', `
${fig(diagJig(d, bay.st, bay.v, bay.b), 'Both diagonals of a rectangle. Equal = square.')}
<p>Not equal: push the long diagonal until they match, then check again.</p>`);
  add('stock', 'Buying stock', `${d.nesting.length} section${d.nesting.length > 1 ? 's' : ''}`, `<p>The materials list says how many lengths to buy; the cutting plan shows which pieces come out of each. Reject bent or damaged lengths. Write the piece mark on every piece as you cut it.</p>`);
  if (piece) add('cut', 'Cut sheets', 'marks, long point', `
<div class="gpiece">${pieceSvg(d, piece)}</div>
${piece.endText[0].square && piece.endText[1].square ? `<ol><li>Measure the long point from a square end.</li><li>Mark it all the way round.</li><li>Cut on the waste side. Deburr.</li></ol>`
    : `<ol><li>Square one end of the stock. Every number is from that end.</li><li>Mark each edge at its number.</li><li>Join the marks face by face.</li><li>Cut on the waste side. File to the line.</li></ol>`}
<p><code>x4</code> = cut four the same. Long point = overall length. Each end says how it is cut and what it meets.</p>`);
  if (joints.length) add('joints', 'Joint types', joints.map(j => j[0]).join(', '), `
<div class="trio">${joints.map(([k, cap, svg]) => fig(svg, `<b>${esc(k)}</b> · ${cap}`)).join('')}</div>
<p>${joints.map(([k]) => ({ mitre: '<b>mitre</b>: same size, cut on the middle line.', butt: '<b>butt</b>: cut square, sits flat on the other member\'s face.', flush: '<b>flush</b>: stops level with the other member\'s outside.', 'into a fitting': '<b>into a fitting</b>: push the pipe in until it bottoms out.' }[k])).join(' ')}</p>`);
  if (welded) add('weld', 'Tacking and welding', 'tack, then weld out', `
<ol><li>Weld two offcuts and break them in a vise first: the metal should tear, not the weld.</li><li>Tack each joint on two faces. Measure. Wrong: break the tack and redo.</li><li>Weld out in short runs, alternating sides, clamped until cold.</li><li>Measure again.</li></ol>`);
  if (glued) add('glue', 'Dry fit and cement', 'dry fit first', `
<ol><li>Dry fit everything. Check it.</li><li>Draw a line across each joint so it goes back the same way.</li><li>One joint at a time: primer, cement on both parts, push home with a quarter turn to the line, hold 30 seconds.</li><li>Handle it gently after about 2 hours. Load it only after the full cure time on the can (often 24 hours).</li></ol>`);
  if (d.prints.length) add('prints', '3D prints', 'settings, files', `
<p>Each print lists its filament, layer height, walls, infill and how to lay it on the bed. Download the <code>.stl</code> (the part at this size) or the <code>.scad</code> (its source). Print them first: they take hours, and you can cut while the printer runs.</p>`);
  add('checks', 'The checks', 'what they prove', `
<p>Every size the fields allow is checked before you see it: every joint can be made, nothing floats or clashes, pieces fit the stock, and it holds its loads. A <b>safety factor</b> of 2 means it would take twice the load before the metal bends for good. <b>Sag</b> is how far it moves under the rated load.</p>
<p>A plan is a starting point, not an engineer's sign-off. Load-test it gently.</p>`);
  add('tol', 'Tolerances', 'how close is close enough', `<p>${esc(md.tolerance || (welded ? `Cut ${u.tol(1)}, tacked ${u.tol(1)}, finished ${u.tol(2)}.` : `Cut ${u.tol(1)}.`))} Out of tolerance: fix it now, before the next step.</p>`);
  add('safety', 'Safety', 'before you start', `<ul>
<li>Eye protection for every cut. Ear protection for saws and grinders.</li>
${welded ? '<li>Welding: auto-darkening helmet, leather gloves, cotton sleeves. Never weld galvanised steel. Extinguisher in reach.</li>' : ''}
${glued ? '<li>Primer and cement: ventilate, gloves, no flames.</li>' : ''}
${d.prints.length ? '<li>Printing: ventilate for ASA and ABS.</li>' : ''}
<li>Load-test gently before you trust it.</li></ul>`);
  const glossary = Object.entries(TIPS).map(([k, [t, more]]) => `<tr><td><a href="#${S.some(s => s.id === more) ? more : 'start'}">${esc({ lp: 'long point', cl: '℄', sf: 'safety factor', weldout: 'weld out', dryfit: 'dry fit', loadtest: 'load test', points: 'joint positions' }[k] || k)}</a></td><td>${esc(t)}</td></tr>`).join('');
  add('glossary', 'Glossary', 'every term', `<div class="wrap"><table class="doc">${glossary}</table></div>`);

  const contents = `<nav class="toc" aria-label="Contents"><p class="contents-h">Contents</p><ol class="contents">` +
    S.map((s, i) => `<li><a href="#${s.id}"><span class="cn">${i + 1}</span><span class="ct">${esc(s.title)}</span><span class="cl" aria-hidden="true"></span><span class="cm">${esc(s.note)}</span></a></li>`).join('') +
    `<li><a href="${esc(back)}"><span class="cn"></span><span class="ct">Back to the plan</span><span class="cl" aria-hidden="true"></span><span class="cm">the steps</span></a></li></ol></nav>`;
  return `<!doctype html>
<html lang="en" style="color-scheme:light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>How to read this plan: ${esc(plan.name)}</title>
<style>${pageCss}
.gfig{margin:40px 0}.gfig figcaption{color:var(--muted);font-size:14px;margin-top:8px;max-width:68ch}
.gfig .sheet{max-width:760px}.gpiece{max-width:760px;margin:24px 0}.gpiece svg{border:1px solid var(--line);width:100%;height:auto}
.trio{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px}.trio .gfig{margin:16px 0}.trio svg{border:1px solid var(--line);width:100%;height:auto;display:block}
</style>
</head>
<body>
<main>
  <a class="btn back" href="${esc(back)}"><svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8H3M7 4L3 8l4 4"/></svg>Back to the build plan</a>
  <h1>How to read this plan</h1>
  <p class="lede">${esc(plan.name)}: what the plan leaves out. Read once; after that the <span class="q" style="pointer-events:none">${ICON.q}</span> marks remind you.</p>
  ${contents}
${S.map((s, i) => `<section class="sec" id="${s.id}"><h2><span class="secn">${i + 1}</span>${esc(s.title)}</h2>${s.body}</section>`).join('\n')}
</main>
<script>${initTips.toString()}; initTips('');<\/script>
</body>
</html>
`;
}
