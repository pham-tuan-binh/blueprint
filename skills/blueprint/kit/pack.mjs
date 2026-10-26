// The build pack as HTML strings, from one derived plan (derive.mjs). The same
// functions feed the live page and its printed form; nothing here computes a
// number of its own, it only lays out what derive() found.
import { esc } from './core.mjs';
import { jigSheet, gaSheet, printSheet, pieceSvg, plateSvg, plateNotes, nestSvg, stepNodes, stepViews } from './shop.mjs';
import { printBox, bedBox } from './print.mjs';

// a plate: its drawing, then its holes, notches and note as text that wraps
const plateFigure = (d, pl) => `<figure class="plate-fig">${plateSvg(d, pl)}<figcaption>${plateNotes(d, pl).map(t => `<p>${esc(t)}</p>`).join('')}</figcaption></figure>`;

const money = (d, v) => (d.model.currency ? `${d.model.currency}${v < 10 ? v.toFixed(2) : Math.round(v).toLocaleString('en-US')}` : '');

const printHours = d => (Math.round(d.prints.reduce((h, x) => h + x.est.hours * (x.part.qty || 1), 0) * 10) / 10);
const dl = pr => `<span class="dls"><button type="button" class="btn sm" data-stl="${esc(pr.id)}">${ICON_DL}.stl</button><button type="button" class="btn sm" data-scad="${esc(pr.id)}">${ICON_DL}.scad</button></span>`;
const ICON_DL = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/></svg>';
const printSettings = pr => `${pr.material || 'PETG'} · ${pr.layer ?? 0.2} mm layers · ${pr.walls ?? 3} walls · ${Math.round((pr.infill ?? 0.3) * 100)}% infill · ${pr.supports ? 'supports' : 'no supports'}`;

// the holes, bores and pockets of a print, so the part can be checked against its drawing
function printCuts(d, pr) {
  const u = d.units, [lo] = printBox(pr), rel = p => p.map((v, i) => u.fine(v - lo[i])).join(', ');
  const axis = (a, b) => { const v = b.map((x, i) => x - a[i]), k = [0, 1, 2].filter(i => Math.abs(v[i]) > 1e-6); return k.length === 1 ? 'xyz'[k[0]] : 'angled'; };
  const rows = [
    ...pr.shapes.filter(c => c.type === 'tube').map(c => ['Bore', `⌀${u.fine(c.ri * 2)}`, axis(c.a, c.b), rel(c.a), u.fine(Math.hypot(...c.b.map((x, i) => x - c.a[i])))]),
    ...(pr.cuts || []).map(c => c.type === 'hole' ? ['Hole', `⌀${u.fine(c.d)}`, axis(c.a, c.b), rel(c.a), u.fine(Math.hypot(...c.b.map((x, i) => x - c.a[i])))]
      : c.type === 'box' ? ['Pocket', c.s.map(v => u.fine(v)).join(' × '), '', rel(c.c), ''] : c.type === 'cyl' ? ['Bore', `⌀${u.fine(c.r * 2)}`, axis(c.a, c.b), rel(c.a), u.fine(Math.hypot(...c.b.map((x, i) => x - c.a[i])))] : ['Cut', c.type, '', '', '']),
  ];
  const bb = bedBox(pr);
  return (rows.length ? `<div class="wrap"><table class="doc"><tr><th>Cut</th><th>Size</th><th>Axis</th><th class=n>From (x, y, z)</th><th class=n>Depth</th></tr>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td class=n>${esc(r[3])}</td><td class=n>${esc(r[4])}</td></tr>`).join('')}</table></div><p class="muted">Dashed on the drawing. Positions from the part's lower-left-bottom corner as drawn${pr.bed && pr.bed !== '-z' ? `; the files come turned for printing (${esc(pr.bed)} face on the bed)` : ''}. On the bed it is ${bb.size.map(v => u.fine(v)).join(' × ')}${u.imperial ? '' : ' mm'}.</p>` : '');
}

function plateLine(d) {
  const metal = d.plateGroups.filter(g => ['steel', 'aluminium', 'stainless'].includes(g.pl.material || 'steel')).reduce((s, g) => s + g.qty, 0);
  const sheet = d.plateGroups.reduce((s, g) => s + g.qty, 0) - metal;
  return [metal ? `${metal} plate${metal > 1 ? 's' : ''}` : '', sheet ? `${sheet} sheet${sheet > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ');
}

export function factsHtml(d) {
  const u = d.units, [lo, hi] = d.bbox;
  const rows = [
    ['Overall', `${u.len(hi[0] - lo[0])} × ${u.len(hi[1] - lo[1])} × ${u.len(hi[2] - lo[2])}${u.imperial ? '' : ' mm'}`, 'length × depth × height'],
    ['Mass', u.mass(d.totalKg), 'as built, with every part listed'],
    ['Pieces', `${d.model.members.length} cut (${d.pieces.length} different)`, plateLine(d)],
    ...(d.weld.joins ? [[d.model.join && d.model.join !== 'weld' ? 'Joints' : 'Welds', `${d.weld.joins} joints`, d.model.join && d.model.join !== 'weld' ? '' : `about ${u.run(d.weld.length)} of weld`]] : []),
    ...d.loads.map(r => [r.name, `factor ${r.sf === Infinity ? '∞' : r.sf.toFixed(1)}`, r.load.defl != null ? `${(r.load.dir && Math.abs(r.load.dir[2]) < 0.5) ? 'moves' : 'sags'} ${u.deflection(r.loadDefl)}` : 'safety factor on yield']),
    ...(d.prints.length ? [['3D prints', `${d.prints.reduce((n, x) => n + (x.part.qty || 1), 0)} part${d.prints.length > 1 || (d.prints[0].part.qty || 1) > 1 ? 's' : ''}`, `about ${Math.round(d.prints.reduce((g, x) => g + x.est.grams * (x.part.qty || 1), 0))} g of filament, ${printHours(d)} h printing`]] : []),
    ['Build time', d.hours ? `${d.hours} h` : '', `${d.model.steps.length} steps`],
    ...(d.price.total && d.model.currency ? [['Cost', `~${money(d, d.price.total)}`, d.price.known ? 'everything on the materials list' : 'priced lines only; see the materials list']] : []),
    ...d.model.facts,
  ];
  return rows.filter(r => r[1]).map(([k, v, s]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}${s ? `<small>${esc(s)}</small>` : ''}</dd></div>`).join('');
}

export function checksHtml(d) {
  const bad = d.checks.filter(c => !c.pass).length;
  return `<p class="${bad ? 'warn' : 'muted'}">${bad ? `${bad} check${bad > 1 ? 's' : ''} failing at this size. Change the size or the stock before you cut anything.` : `All ${d.checks.length} checks pass at this size.`}</p>` +
    `<div class="wrap"><table class="doc checks"><tr><th></th><th>Check</th><th>Result</th></tr>` +
    d.checks.map(c => `<tr class="${c.pass ? 'ok' : 'bad'}"><td>${c.pass ? '✓' : '✗'}</td><td>${esc(c.name)}<small>${esc(c.why || '')}</small></td><td>${esc(c.value)}</td></tr>`).join('') +
    `</table></div>`;
}

export function bomHtml(d) {
  const u = d.units, md = d.model;
  let h = `<h3>Stock</h3><div class="wrap"><table class="doc"><tr><th>Section</th><th class=n>Pieces</th><th class=n>Cut length</th><th class=n>Buy</th><th class=n>Mass</th>${md.currency ? '<th class=n>Cost</th>' : ''}</tr>`;
  for (const n of d.nesting) {
    const pieces = n.bars.reduce((s, b) => s + b.cuts.length, 0) + n.tooLong.length;
    const kg = (n.total / 1000) * n.sec.kgPerM;
    h += `<tr><td>${esc(n.sec.label)}</td><td class=n>${pieces}</td><td class=n>${esc(u.run(n.total))}</td><td class=n>${n.bars.length} × ${esc(u.size(n.sec.stockLen))}</td><td class=n>${esc(u.mass(kg))}</td>${md.currency ? `<td class=n>${n.sec.price != null ? money(d, (n.bars.length * n.sec.stockLen / 1000) * n.sec.price) : ''}</td>` : ''}</tr>`;
  }
  h += `</table></div>`;
  if (md.plates.length) {
    h += `<h3>Plate and sheet</h3><div class="wrap"><table class="doc"><tr><th>Mark</th><th>Part</th><th>Size</th><th class=n>Qty</th><th class=n>Step</th>${md.currency ? '<th class=n>Cost</th>' : ''}</tr>`;
    for (const g of d.plateGroups) {
      const pl = g.pl, s = [...pl.s].sort((a, b) => b - a);
      h += `<tr><td>${esc(g.mark)}</td><td>${esc(pl.name)}</td><td>${esc(u.len(s[0]))} × ${esc(u.len(s[1]))} × ${esc(u.len(s[2]))} ${esc(pl.materialLabel || pl.material || 'steel')}</td><td class=n>${g.qty}</td><td class=n>${g.step}</td>${md.currency ? `<td class=n>${pl.price != null ? money(d, pl.price * g.qty) : ''}</td>` : ''}</tr>`;
    }
    h += `</table></div>`;
  }
  if (d.prints.length) {
    h += `<h3>3D prints</h3><div class="wrap"><table class="doc"><tr><th>Part</th><th>Settings</th><th class=n>Qty</th><th class=n>Filament</th><th class=n>Print</th><th class=n>Step</th>${md.currency ? '<th class=n>Cost</th>' : ''}<th>Files</th></tr>`;
    for (const { part: pr, est } of d.prints) h += `<tr><td>${esc(pr.name)}</td><td><span class="spec">${esc(printSettings(pr))}</span></td><td class=n>${pr.qty || 1}</td><td class=n>${Math.round(est.grams * (pr.qty || 1))} g</td><td class=n>${(Math.round(est.hours * (pr.qty || 1) * 10) / 10)} h</td><td class=n>${pr.step}</td>${md.currency ? `<td class=n>${money(d, est.cost * (pr.qty || 1))}</td>` : ''}<td>${dl(pr)}</td></tr>`;
    h += `</table></div><p class="muted">Filament and time are estimates from the part's volume; your slicer has the real numbers. The .stl is the part at this size, in millimetres; the .scad is its OpenSCAD source.</p>`;
  }
  if (md.hardware.length) {
    h += `<h3>Parts to buy</h3><div class="wrap"><table class="doc"><tr><th>Part</th><th>Spec</th><th class=n>Qty</th><th class=n>Step</th>${md.currency ? '<th class=n>Cost</th>' : ''}</tr>`;
    for (const x of md.hardware) h += `<tr><td>${esc(x.name)}</td><td>${esc(x.spec || '')}</td><td class=n>${x.qty || 1}</td><td class=n>${x.step}</td>${md.currency ? `<td class=n>${x.price != null ? money(d, x.price * (x.qty || 1)) : ''}</td>` : ''}</tr>`;
    h += `</table></div>`;
  }
  if (md.consumables.length) h += `<h3>Consumables</h3><ul class="plain">${md.consumables.map(c => `<li>${esc(c.name)}${c.qty ? ` · ${esc(c.qty)}` : ''}${c.note ? ` <span class="muted">${esc(c.note)}</span>` : ''}</li>`).join('')}</ul>`;
  if (md.tools?.length) h += `<h3>Tools</h3><ul class="plain cols">${md.tools.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
  return h;
}

export function drawingsHtml(d) {
  return gaSheet(d);
}

export function legendHtml(d) {
  const u = d.units, md = d.model;
  const joinWord = { screw: 'screw', bolt: 'bolt', glue: 'solvent-cement or glue', solder: 'solder', clamp: 'clamp' }[md.join] || 'weld';
  const rows = [
    ['Units', u.imperial ? 'inches (to 1/16"), pounds, degrees' : 'millimetres, kilograms, degrees'],
    ['Datum', md.datum || 'x along the length, y front to back, z up from the floor'],
    ['Piece marks', 'A, B, C… one letter per different piece; x4 after it means cut four the same. Mirror images share a mark.'],
    ['Cut marks', 'From one square end, mark each edge at the two numbers, join the marks around the section, cut on the lines. Angles are for reference.'],
    ['Edges', `named by where they face on the finished build (${md.axes.z[0]}-${md.axes.y[1]}, ${md.axes.z[1]}-${md.axes.x[0]}…)`],
    d.weld.joins ? ['Joints', `mitre = same section, on the bisector · butt onto X = square onto the face of X · flush with X = cut level with X's outer face · then ${joinWord}`]
      : ['Joints', `nothing is welded: parts ${joinWord === 'weld' ? 'clamp, bolt or sit in printed parts' : joinWord}, as each step says`],
    ['Long point', 'the overall length of the piece, tip to tip'],
    ['Dimensions', 'jig drawings and joint tables give centre lines (℄), where the members\' centres cross; the general arrangement gives outside sizes'],
    ['Tolerance', md.tolerance || !d.weld.joins ? (md.tolerance || `cut ${u.tol(1)} unless a step says otherwise`) : `cut ${u.tol(1)} · tacked ${u.tol(1)} · finished ${u.tol(2)} · diagonals equal within ${u.len(3)}`],
  ];
  return `<div class="wrap"><table class="doc legend">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>`;
}

export function orderHtml(d) {
  const steps = d.model.steps, phases = [...new Set(steps.map(s => s.phase || 'Build'))];
  return (d.model.orderNote ? `<p>${esc(d.model.orderNote)}</p>` : '') +
    `<div class="phases">` + phases.map(ph => {
      const ss = steps.filter(s => (s.phase || 'Build') === ph);
      return `<div><h4>${esc(ph)}</h4><ol start="${ss[0].n}">${ss.map(s => `<li><a href="#step-${s.n}">${esc(s.title)}</a> <span class="muted">${s.hours ? s.hours + ' h' : ''}</span></li>`).join('')}</ol></div>`;
    }).join('') + `</div>`;
}

// a column is numeric (right-aligned) when every cell in it is a number or a length
const numCol = (t, i) => i > 0 && t.rows.every(r => /^[\d\s.,/"'×x±-]+(mm|in|kg|lb|h)?$/.test(String(r[i]).trim()));

function piecesOfStep(d, n) { return d.pieces.filter(g => g.members.some(m => m.step === n)); }

export function stepHtml(d, st, { interactive = false, checked = {} } = {}) {
  const u = d.units, n = st.n;
  let h = `<section class="step" id="step-${n}"><div class="step-h"><h3><span class="sn">${String(n).padStart(2, '0')}</span>${esc(st.title)}</h3>` +
    `<p class="muted">${esc(st.phase || 'Build')}${st.hours ? ` · ${st.hours} h` : ''}${interactive ? `<span data-show-wrap> · <button type="button" class="linkish" data-show-step="${n}">Show in 3D</button></span>` : ''}</p></div>` +
    (st.summary ? `<p>${esc(st.summary)}</p>` : '');
  h += interactive
    ? `<ol class="tasks">${st.tasks.map((t, i) => { const id = `t-${n}-${i}`; return `<li><input type="checkbox" id="${id}" data-check="${id}" ${checked[id] ? 'checked' : ''}><label for="${id}">${esc(t)}</label></li>`; }).join('')}</ol>`
    : `<ol>${st.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;
  // a plan's own table for the step: { title, head: [...], rows: [[...]] }, numbers right-aligned
  if (st.table) h += `<h4>${esc(st.table.title || 'Table')}</h4><div class="wrap"><table class="doc"><tr>${st.table.head.map((c, i) => `<th${numCol(st.table, i) ? ' class=n' : ''}>${esc(c)}</th>`).join('')}</tr>${st.table.rows.map(r => `<tr>${r.map((c, i) => `<td${numCol(st.table, i) ? ' class=n' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  if (st.check) h += `<p class="gate"><b>Check</b> ${esc(st.check)}</p>`;
  if (st.tip) h += `<p class="note">${esc(st.tip)}</p>`;
  for (const { part: pr, est } of d.prints.filter(x => x.part.step === n)) {
    h += `<h4>Print: ${esc(pr.name)}${(pr.qty || 1) > 1 ? ` x${pr.qty}` : ''}</h4><p class="muted"><span class="spec">${esc(printSettings(pr))}</span> · about ${Math.round(est.grams)} g, ${Math.round(est.hours * 10) / 10} h each${pr.orient ? ` · print it ${esc(pr.orient)}` : ''}</p>${printSheet(d, pr)}${printCuts(d, pr)}<p>${dl(pr)}</p>${pr.note ? `<p class="note">${esc(pr.note)}</p>` : ''}`;
  }
  const hw = d.model.hardware.filter(x => x.step === n);
  if (hw.length) h += `<h4>Parts</h4><ul class="plain">${hw.map(x => `<li>${esc(x.name)} x${x.qty || 1}${x.spec ? ` <span class="muted">${esc(x.spec)}</span>` : ''}</li>`).join('')}</ul>`;
  const ms = d.model.members.filter(m => m.step === n);
  if (ms.length) {
    h += `<h4>Jig</h4>${jigSheet(d, st, stepViews(d, st))}`;
    if (st.points !== false) h += `<h4>Joint positions</h4><div class="wrap"><table class="doc"><tr><th>Point</th><th class=n>x</th><th class=n>y</th><th class=n>z</th></tr>` +
      stepNodes(d, n).map(q => `<tr><td>${esc(q.name)}</td><td class=n>${esc(u.len(q.p[0]))}</td><td class=n>${esc(u.len(q.p[1]))}</td><td class=n>${esc(u.len(q.p[2]))}</td></tr>`).join('') + `</table></div>`;
    const pcs = piecesOfStep(d, n);
    const first = pcs.filter(g => g.step === n), earlier = pcs.filter(g => g.step !== n);
    const label = `Pieces: ${pcs.map(g => { const k = g.members.filter(m => m.step === n).length; return `${g.mark} x${k}${k < g.qty ? ` (of ${g.qty})` : ''}`; }).join(', ')}`;
    const sheets = (first.length ? `<div class="piece-list">${first.map(g => pieceSvg(d, g)).join('')}</div>` : '') +
      (earlier.length ? `<p class="muted">${earlier.map(g => `${g.mark}: cut sheet in <a href="#step-${g.step}">step ${g.step}</a>`).join(' · ')}</p>` : '');
    h += interactive ? `<details class="sheets" open><summary>${esc(label)}</summary>${sheets}</details>` : `<h4>${esc(label)}</h4>${sheets}`;
  }
  const pls = d.plateGroups.filter(g => g.step === n && g.pl.drawing !== false);
  if (pls.length) h += `<h4>Plates</h4><div class="piece-list">${pls.map(g => plateFigure(d, { ...g.pl, mark: g.mark, qty: g.qty })).join('')}</div>`;
  return h + `</section>`;
}

export function cutListHtml(d) {
  const u = d.units;
  return `<div class="wrap"><table class="doc"><tr><th>Mark</th><th class=n>Qty</th><th>Section</th><th class=n>Long point</th><th>Left end</th><th>Right end</th><th class=n>Step</th></tr>` +
    d.pieces.map(g => {
      const [A, B] = g.endText;
      return `<tr><td><b>${esc(g.mark)}</b> <span class="muted">${esc(g.name)}</span></td><td class=n>${g.qty}</td><td>${esc(g.sec.short)}</td><td class=n>${esc(u.len(g.pm.longPoint))}</td><td>${esc(A.ang)} · ${esc(A.how)}</td><td>${esc(B.ang)} · ${esc(B.how)}</td><td class=n>${g.step}</td></tr>`;
    }).join('') + `</table></div><h3>Cutting plan</h3><p class="muted">Each bar is one stock length; cut the pieces left to right.</p>` +
    d.nesting.map(n => `<figure>${nestSvg(d, n)}</figure>`).join('');
}

// an option label may be a function of the units, so a size in it follows them
export const optLabel = (o, u) => (o ? (typeof o.label === 'function' ? o.label(u) : o.label) : '');

// The contents, like the front of a printed pack: numbered sections with what is
// in them, the steps nested under Steps. Re-rendered with the plan, since steps
// and counts follow the size.
export function contentsHtml(d) {
  const md = d.model, bars = d.nesting.reduce((n, x) => n + x.bars.length, 0);
  const row = (href, n, title, meta = '', cls = '') => `<li class="${cls}"><a href="#${href}"><span class="cn">${n}</span><span class="ct">${esc(title)}</span><span class="cl" aria-hidden="true"></span><span class="cm">${esc(meta)}</span></a></li>`;
  const bad = d.checks.filter(c => !c.pass).length;
  return `<ol class="contents">` +
    row('checks', 1, 'Checks', bad ? `${bad} failing` : `all ${d.checks.length} pass`) +
    row('bom', 2, 'Materials', `${bars} stock length${bars > 1 ? 's' : ''}`) +
    row('drawings', 3, 'Drawings', 'top, front, side') +
    row('legend', 4, 'Legend', 'how to read it') +
    row('order', 5, 'Order', d.hours ? `${d.hours} h in all` : '') +
    row('steps', 6, 'Steps', `${md.steps.length} steps`) +
    md.steps.map(st => row(`step-${st.n}`, `6.${st.n}`, st.title, st.hours ? `${st.hours} h` : '', 'sub')).join('') +
    row('cutlist', 7, 'Cut list', `${d.pieces.length} piece mark${d.pieces.length > 1 ? 's' : ''}`) +
    `</ol>`;
}

export function paramsSummary(d) {
  const u = d.units;
  return (d.plan.params || []).map(pd => {
    const v = d.p[pd.id];
    const s = pd.type === 'choice' ? optLabel(pd.options.find(o => o.value === v), u) : pd.type === 'bool' ? (v ? 'yes' : 'no')
      : pd.type === 'len' ? u.len(v, { u: true }) : pd.type === 'kg' ? u.mass(v) : `${v}${pd.unit ? ' ' + pd.unit : ''}`;
    return `${pd.label} ${s}`;
  }).join(' · ');
}
