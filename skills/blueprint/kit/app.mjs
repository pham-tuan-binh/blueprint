// Browser runtime for a build pack page. Reads the params from the URL hash (so a
// size can be shared as a link), shows them as input fields, and on every change
// re-runs derive() and re-renders every section and the 3D model. Units switch
// between metric (default) and imperial without changing the design.
import { derive } from './derive.mjs';
import { makeUnits, esc } from './core.mjs';
import { checksHtml, bomHtml, drawingsHtml, legendHtml, orderHtml, stepHtml, cutListHtml, paramsSummary, optLabel, contentsHtml } from './pack.mjs';
import { createViewer, printSolid } from './viewer.mjs';
import { scadOf, stlOf, meshFaults } from './print.mjs';
import { initTips } from './guide.mjs';

const $ = s => document.querySelector(s);
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: ticks just do not persist */ } },
};

function readHash(plan) {
  const q = new URLSearchParams(location.hash.slice(1));
  const given = {};
  // lengths in mm and masses in kg in a link, whatever the page shows; bools as 1/0 or true/false
  for (const pd of plan.params || []) if (q.has(pd.id)) given[pd.id] = pd.type === 'choice' ? q.get(pd.id) : pd.type === 'bool' ? ['1', 'true', 'yes'].includes(q.get(pd.id)) : Number(q.get(pd.id));
  const units = q.get('units') === 'imperial' || q.get('units') === 'metric' ? q.get('units') : null;
  return { given, units };
}

export function mountPlan(plan) {
  const key = `blueprint:${plan.id}`;
  const fromHash = readHash(plan);
  let system = fromHash.units || store.get(key + ':units', null) || plan.units || 'metric';
  let given = fromHash.given;
  let d = null;
  const ticks = store.get(key + ':ticks', {});
  const vals = store.get(key + ':vals', {});

  // ---------------------------------------------------------------- form
  const form = $('#size-form');
  function fieldHtml(pd, u) {
    const v = d ? d.p[pd.id] : pd.value;
    const id = `f-${pd.id}`;
    const hintText = typeof pd.hint === 'function' ? pd.hint(u) : pd.hint;
    const hint = hintText ? `<small>${esc(hintText)}</small>` : '';
    if (pd.type === 'choice') return `<label class="field" for="${id}"><span>${esc(pd.label)}</span><select id="${id}" data-param="${pd.id}">${pd.options.map(o => `<option value="${esc(o.value)}" ${o.value === v ? 'selected' : ''}>${esc(optLabel(o, u))}</option>`).join('')}</select>${hint}</label>`;
    if (pd.type === 'bool') return `<label class="field check" for="${id}"><input type="checkbox" id="${id}" data-param="${pd.id}" ${v ? 'checked' : ''}><span>${esc(pd.label)}</span>${hint}</label>`;
    const lim = d?.limits[pd.id] || { min: pd.min, max: pd.max };
    let val = v, min = lim.min, max = lim.max, step = pd.step ?? 1, unit = pd.unit || '';
    if (pd.type === 'len') { val = u.toInput(v); min = u.toInput(lim.min); max = u.toInput(lim.max); step = u.imperial ? 0.0625 : (pd.step ?? 10); unit = u.lenUnit; }
    if (pd.type === 'kg') { val = u.massToInput(v); min = u.massToInput(lim.min); max = u.massToInput(lim.max); step = u.imperial ? 5 : (pd.step ?? 5); unit = u.massUnit; }
    const range = pd.type === 'len' ? `${u.len(lim.min)}–${u.len(lim.max)}` : pd.type === 'kg' ? `${u.mass(lim.min)}–${u.mass(lim.max)}` : `${min}–${max}`;
    // inch lengths are text so they can show and take fractions (59 1/16)
    const input = pd.type === 'len' && u.imperial
      ? `<input type="text" inputmode="decimal" id="${id}" data-param="${pd.id}" value="${esc(u.toText(v))}" spellcheck="false">`
      : `<input type="number" inputmode="decimal" id="${id}" data-param="${pd.id}" value="${val}" min="${min}" max="${max}" step="${step}">`;
    return `<label class="field" for="${id}"><span>${esc(pd.label)}</span><span class="inp">${input}<i>${esc(unit)}</i></span><small>${esc(range)}${hintText ? ' · ' + esc(hintText) : ''}</small></label>`;
  }
  function renderForm() {
    const u = makeUnits(system);
    const groups = [...new Set((plan.params || []).map(p => p.group || 'Size'))];
    form.innerHTML = groups.map(g => `<fieldset><legend>${esc(g)}</legend>${plan.params.filter(p => (p.group || 'Size') === g).map(p => fieldHtml(p, u)).join('')}</fieldset>`).join('');
    document.querySelectorAll('[data-units]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.units === system)));
  }
  function readForm() {
    const u = makeUnits(system), out = {};
    for (const el of form.querySelectorAll('[data-param]')) {
      const pd = plan.params.find(p => p.id === el.dataset.param);
      if (pd.type === 'choice') out[pd.id] = el.value;
      else if (pd.type === 'bool') out[pd.id] = el.checked;
      else {
        if (pd.type === 'len') { const mm = u.parse(el.value); if (Number.isFinite(mm)) out[pd.id] = mm; continue; }
        const n = parseFloat(el.value);
        if (!Number.isFinite(n)) continue;
        out[pd.id] = pd.type === 'kg' ? u.massFromInput(n) : n;
      }
    }
    return out;
  }
  // after a clamp, show the value actually used, without rebuilding the fields
  function syncForm() {
    const u = makeUnits(system);
    for (const el of form.querySelectorAll('[data-param]')) {
      if (el === document.activeElement) continue;
      const pd = plan.params.find(p => p.id === el.dataset.param), v = d.p[pd.id];
      if (pd.type === 'choice') el.value = v;
      else if (pd.type === 'bool') el.checked = v;
      else {
        el.value = pd.type === 'len' ? (u.imperial ? u.toText(v) : u.toInput(v)) : pd.type === 'kg' ? u.massToInput(v) : v;
        if (typeof pd.min === 'function' || typeof pd.max === 'function') el.closest('.field').outerHTML = fieldHtml(pd, u);
      }
    }
  }
  function writeHash() {
    const q = new URLSearchParams();
    for (const pd of plan.params || []) {
      const v = d.p[pd.id];
      if (v === pd.value) continue;
      q.set(pd.id, pd.type === 'bool' ? (v ? '1' : '0') : pd.type === 'len' || pd.type === 'kg' ? String(Math.round(v * 10) / 10) : String(v));
    }
    if (system !== (plan.units || 'metric')) q.set('units', system);
    const h = q.toString();
    history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  }

  // ---------------------------------------------------------------- viewer
  let viewer = null;
  try {
    viewer = createViewer($('#viewer'), {
      onPick: info => {
        const el = $('#pick');
        if (!info) { el.hidden = true; return; }
        el.hidden = false;
        el.innerHTML = `<b>${esc(info.mark ? info.mark + ' · ' : '')}${esc(info.name)}</b> <span class="muted">${esc(info.id)}${info.spec ? ' · ' + esc(info.spec) : ''} · step ${info.step}</span>`;
      },
    });
  } catch (e) {
    $('#viewer').innerHTML = `<p class="muted pad">3D view unavailable (${esc(e.message)}). The drawings below show the same build.</p>`;
  }
  document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => viewer?.view(b.dataset.cam)));
  // the step viewer: sticky beside the steps on a wide screen, a panel the 3D button opens on a
  // phone. It follows the step you are reading: the build as it stands after that step, its parts lit.
  let stepViewer = null, stepNow = null;
  function currentStep() {
    const els = [...document.querySelectorAll('#steps-body .step')];
    let cur = els[0];
    for (const el of els) if (el.getBoundingClientRect().top < innerHeight * 0.4) cur = el;
    return cur ? +cur.id.slice(5) : null;
  }
  function followSteps(force) {
    const n = currentStep();
    if (n == null || (n === stepNow && !force)) return;
    stepNow = n;
    $('#step-3d-cap').textContent = `${n}  ${d.model.steps.find(s => s.n === n)?.title || ''}`;
    stepViewer?.setStep(n, n);
  }
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; followSteps(); }); } }, { passive: true });
  const show3d = on => { document.body.classList.toggle('show-3d', on); $('#toggle-3d').setAttribute('aria-pressed', on); store.set(key + ':show3d', on); };
  $('#toggle-3d').addEventListener('click', () => show3d(!document.body.classList.contains('show-3d')));
  new IntersectionObserver(([e]) => document.body.classList.toggle('in-steps', e.isIntersecting)).observe($('#steps'));
  $('#show-stress').addEventListener('change', e => {
    if (!e.target.checked) return viewer?.setStress(null);
    const map = {};
    for (const r of d.loads) r.fm.els.forEach((el, i) => { const sf = el.sec.mat.yield / Math.max(r.stress[i], 1e-9); map[el.id] = Math.min(map[el.id] ?? Infinity, sf); });
    viewer?.setStress(map);
  });

  // ---------------------------------------------------------------- render
  function render() {
    try {
      d = derive(plan, given, system);
    } catch (e) {
      $('#notes').innerHTML = `<p class="warn">This size cannot be built: ${esc(e.message)}. Go back toward the defaults.</p>`;
      return;
    }
    const u = d.units;
    const bad = d.checks.filter(c => !c.pass);
    $('#notes').innerHTML = (d.notes.length ? `<p class="warn">${esc(d.notes.join('. '))}.</p>` : '') +
      (bad.length ? `<p class="warn">${bad.length} check${bad.length > 1 ? 's' : ''} fail at this size: ${esc(bad.map(c => c.name).join('; '))}. <a href="#checks">Checks</a></p>` : '');
    $('#built-for').textContent = paramsSummary(d);
    $('#contents-body').innerHTML = contentsHtml(d);
    $('#checks-body').innerHTML = checksHtml(d);
    $('#bom-body').innerHTML = bomHtml(d);
    $('#drawings-body').innerHTML = drawingsHtml(d);
    $('#legend-body').innerHTML = legendHtml(d);
    $('#order-body').innerHTML = orderHtml(d);
    $('#steps-body').innerHTML = d.model.steps.map(st => stepHtml(d, st, { interactive: true, checked: ticks })).join('');
    document.querySelectorAll('[data-val]').forEach(el => { if (vals[el.dataset.val] != null) el.value = vals[el.dataset.val]; });
    $('#cutlist-body').innerHTML = cutListHtml(d);
    document.querySelectorAll('.unit-len').forEach(el => (el.textContent = u.lenUnit));
    viewer?.setModel(d);
    if (stepViewer) { stepViewer.setModel(d); stepViewer.setStep(stepNow, stepNow); }
    if ($('#show-stress').checked) $('#show-stress').dispatchEvent(new Event('change'));
    writeHash();
    document.dispatchEvent(new CustomEvent('blueprint:render', { detail: { ok: d.ok } }));
  }
  let timer = null;
  form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { given = readForm(); render(); }, 180); });
  form.addEventListener('change', () => { clearTimeout(timer); given = readForm(); render(); syncForm(); });
  $('#reset').addEventListener('click', () => { given = {}; d = null; render(); renderForm(); });
  $('#copy-link').addEventListener('click', async e => {
    const label = $('#copy-link span');
    try { await navigator.clipboard.writeText(location.href); label.textContent = 'Link copied'; } catch { label.textContent = 'Copy the address bar'; }
    setTimeout(() => (label.textContent = 'Copy link'), 1600);
  });
  document.querySelectorAll('[data-units]').forEach(b => b.addEventListener('click', () => {
    system = b.dataset.units; store.set(key + ':units', system); render(); renderForm();
  }));
  // the print row sits in the contents, which re-renders: listen on the document
  document.addEventListener('click', e => { if (e.target.closest('#print')) window.print(); });
  // folded cut sheets print open
  addEventListener('beforeprint', () => document.querySelectorAll('details.sheets').forEach(x => (x.open = true)));
  initTips('guide.html');
  // downloads for 3D prints: the STL is cut from the part at the current size, in mm,
  // moved so it sits on the bed at the origin; the .scad is its OpenSCAD source
  const save = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-stl],[data-scad]');
    if (!b) return;
    const pr = d.model.prints.find(x => x.id === (b.dataset.stl || b.dataset.scad));
    if (!pr) return;
    if (b.dataset.scad) return save(`${plan.id}-${pr.id}.scad`, new Blob([scadOf(pr, plan)], { type: 'text/plain' }));
    const label = b.innerHTML;
    b.textContent = 'cutting…';
    try { save(`${plan.id}-${pr.id}.stl`, new Blob([stlOf(await printSolid(pr), pr)], { type: 'model/stl' })); }
    catch (err) { alert('Could not make the STL: ' + err.message + '. Download the .scad and export it from OpenSCAD.'); }
    b.innerHTML = label;
  });
  // measured values typed into a step's table, kept on this device like the ticks
  document.addEventListener('input', e => {
    const id = e.target.dataset?.val;
    if (!id) return;
    if (e.target.value === '') delete vals[id]; else vals[id] = e.target.value;
    store.set(key + ':vals', vals);
  });
  document.addEventListener('change', e => {
    const c = e.target.closest('[data-check]');
    if (!c) return;
    ticks[c.dataset.check] = c.checked; store.set(key + ':ticks', ticks);
  });

  render();
  renderForm();
  show3d(!!store.get(key + ':show3d', false));
  followSteps(true);
  // the step viewer second, after the first frame, so the page never waits on two builds at once
  requestAnimationFrame(() => setTimeout(() => {
    try { stepViewer = createViewer($('#viewer-steps')); stepViewer.setModel(d); stepViewer.setStep(stepNow, stepNow); $('#loading-steps').hidden = true; }
    catch (e) { $('#viewer-steps').innerHTML = '<p class="muted pad">3D view unavailable.</p>'; }
  }, 50));
  // for capture: every print at a size, cut, with what a slicer would find in it
  const printFaults = async given => Promise.all(derive(plan, given, system).model.prints.map(async pr => ({ id: pr.id, ...meshFaults(await printSolid(pr)) })));
  window.__blueprint = { get d() { return d; }, render, printFaults, picture: () => viewer?.picture(), setParams(p) { given = { ...given, ...p }; render(); renderForm(); }, setUnits(s) { system = s; render(); renderForm(); } };
}
