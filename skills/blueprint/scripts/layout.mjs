// The layout audit. Runs inside the page (pass it to
// page.evaluate) and returns one line per problem: a number, checkbox, mark or icon whose
// visual centre is more than 1 px off the text beside it, measured on the ink from font
// metrics, not on the CSS boxes; section and contents numbers more than 1 px shorter or
// taller than their title's capitals; the step's left column (number, checkboxes, marks)
// not sharing one centre; a page wider than the screen. Misalignments of a pixel or two
// are easy to miss by eye; trust this over a screenshot.
export function layoutAudit() {
  const out = [];
  const ctx = document.createElement('canvas').getContext('2d');
  const probe = () => { const s = document.createElement('span'); s.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; return s; };
  // ink box of a text element's first line, from canvas metrics
  const textInk = (el, sample) => {
    const cs = getComputedStyle(el); ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = ctx.measureText(sample || 'H');
    const s = probe(); el.insertBefore(s, el.firstChild); const base = s.getBoundingClientRect().top; s.remove();
    return { top: base - m.actualBoundingBoxAscent, bottom: base, mid: base - m.actualBoundingBoxAscent / 2 };
  };
  const boxMid = el => { const r = el.getBoundingClientRect(); return (r.top + r.bottom) / 2; };
  const where = el => (el.closest('[id]') || {}).id || el.className;
  const add = (what, el, d) => { if (Math.abs(d) > 1) out.push(`${what}: ${d.toFixed(1)} px [${where(el)}]`); };
  const shown = el => el && el.getClientRects().length;

  // 1. section numbers vs section titles: centre and cap height
  document.querySelectorAll('h2').forEach(h2 => {
    const n = h2.querySelector('.secn'); if (!shown(n)) return;
    const txt = [...h2.childNodes].find(c => c.nodeType === 3 && c.textContent.trim()); if (!txt) return;
    const t = document.createElement('span'); t.textContent = txt.textContent; txt.replaceWith(t);
    const a = textInk(n, '0'), b = textInk(t);
    add('section number vs title (centre)', h2, a.mid - b.mid);
    add('section number height vs title caps', h2, (a.bottom - a.top) - (b.bottom - b.top));
    t.replaceWith(txt);
  });
  // 2. contents: number vs title
  document.querySelectorAll('.contents li').forEach(li => {
    const n = li.querySelector('.cn'), t = li.querySelector('.ct');
    if (!n || !n.textContent.trim() || !shown(t)) return;
    const a = textInk(n, '0'), b = textInk(t);
    add('contents number vs title (centre)', li, a.mid - b.mid);
    add('contents number height vs title caps', li, (a.bottom - a.top) - (b.bottom - b.top));
  });
  // 3. step header: the title's cap top at the number's top, the hours' baseline at its baseline
  document.querySelectorAll('.step-h').forEach(sh => {
    if (!shown(sh)) return;
    const n = textInk(sh.querySelector('.sn'), '0'), t = textInk(sh.querySelector('h3'));
    const s = probe(); const pEl = sh.querySelector('p'); pEl.appendChild(s); const hb = s.getBoundingClientRect().top; s.remove();
    add('step title top vs number top', sh, t.top - n.top);
    add('step hours baseline vs number baseline', sh, hb - n.bottom);
  });
  // 4. checkboxes vs the first line of their task
  document.querySelectorAll('.tasks li').forEach(li => { const i = li.querySelector('input'), l = li.querySelector('label'); if (shown(i)) add('checkbox vs task text', li, boxMid(i) - textInk(l, 'x').mid); });
  // 5. check and warning marks vs their text (one line only)
  document.querySelectorAll('.gate, .note').forEach(g => { const ic = g.querySelector('.ic'), sp = g.querySelector('.ic + span'); if (shown(sp) && sp.getBoundingClientRect().height < 30) add('check/warning mark vs text', g, boxMid(ic) - textInk(sp, 'x').mid); });
  // 6. ? marks vs the line they sit on (a zero-size probe right before or after the mark)
  document.querySelectorAll('.q').forEach(q => {
    if (!shown(q) || q.closest('.guide-cta .gq')) return;
    const cs = getComputedStyle(q.parentElement); ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const xh = ctx.measureText('x').actualBoundingBoxAscent, mid = boxMid(q), s = probe();
    q.before(s); const b1 = s.getBoundingClientRect().top; q.after(s); const b2 = s.getBoundingClientRect().top; s.remove();
    const base = Math.abs(b1 - xh / 2 - mid) < Math.abs(b2 - xh / 2 - mid) ? b1 : b2;
    add('? mark vs its line', q, mid - (base - xh / 2));
  });
  // 7. start-here icon vs its two lines
  document.querySelectorAll('.guide-cta').forEach(c => { const g = c.querySelector('.gq'), t = c.querySelector('.gq + span'); if (shown(g)) add('start-here icon vs text block', c, boxMid(g) - boxMid(t)); });
  // 8. the step's left column: number, checkboxes and marks share one centre (x)
  document.querySelectorAll('.step').forEach(st => {
    const sn = st.querySelector('.sn'); if (!shown(sn)) return;
    const rg = document.createRange(); rg.selectNodeContents(sn); const g = rg.getBoundingClientRect(), cx = (g.left + g.right) / 2;
    st.querySelectorAll('.tasks input, .ic').forEach(e => { if (shown(e)) { const r = e.getBoundingClientRect(); add('left column centre (x)', st, (r.left + r.right) / 2 - cx); } });
  });
  if (document.documentElement.scrollWidth > innerWidth) out.push(`page wider than the screen: ${document.documentElement.scrollWidth - innerWidth}.0 px [page]`);
  return out;
}

// group a list of problems into "N x first example" lines, for a short report
export const summarise = res => {
  const key = r => r.replace(/\[.*\]/, '').replace(/-?\d+\.\d px/, 'N px');
  return [...new Set(res.map(key))].map(k => { const ex = res.filter(r => key(r) === k); return `${ex.length} x ${ex[0]}`; });
};
