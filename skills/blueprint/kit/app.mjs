// Browser runtime for a build pack page. Reads the params from the URL hash (so a
// size can be shared as a link), shows them as input fields, and on every change
// re-runs derive() and re-renders every section and the 3D model. Units switch
// between metric (default) and imperial without changing the design.
import { derive } from './derive.mjs';
import { makeUnits, esc } from './core.mjs';
import { factsHtml, checksHtml, bomHtml, drawingsHtml, legendHtml, orderHtml, stepHtml, cutListHtml, paramsSummary } from './pack.mjs';
import { createViewer } from './viewer.mjs';

const $ = s => document.querySelector(s);
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: ticks just do not persist */ } },
};

function readHash(plan) {
  const q = new URLSearchParams(location.hash.slice(1));
  const given = {};
  for (const pd of plan.params || []) if (q.has(pd.id)) given[pd.id] = pd.type === 'choice' ? q.get(pd.id) : pd.type === 'bool' ? q.get(pd.id) === '1' : Number(q.get(pd.id));
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

  // ---------------------------------------------------------------- form
  const form = $('#size-form');
  function fieldHtml(pd, u) {
    const v = d ? d.p[pd.id] : pd.value;
    const id = `f-${pd.id}`;
    const hint = pd.hint ? `<small>${esc(pd.hint)}</small>` : '';
    if (pd.type === 'choice') return `<label class="field" for="${id}"><span>${esc(pd.label)}</span><select id="${id}" data-param="${pd.id}">${pd.options.map(o => `<option value="${esc(o.value)}" ${o.value === v ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>${hint}</label>`;
    if (pd.type === 'bool') return `<label class="field check" for="${id}"><input type="checkbox" id="${id}" data-param="${pd.id}" ${v ? 'checked' : ''}><span>${esc(pd.label)}</span>${hint}</label>`;
    const lim = d?.limits[pd.id] || { min: pd.min, max: pd.max };
    let val = v, min = lim.min, max = lim.max, step = pd.step ?? 1, unit = pd.unit || '';
    if (pd.type === 'len') { val = u.toInput(v); min = u.toInput(lim.min); max = u.toInput(lim.max); step = u.imperial ? 0.0625 : (pd.step ?? 10); unit = u.lenUnit; }
    if (pd.type === 'kg') { val = u.massToInput(v); min = u.massToInput(lim.min); max = u.massToInput(lim.max); step = u.imperial ? 5 : (pd.step ?? 5); unit = u.massUnit; }
    const range = pd.type === 'len' ? `${u.len(lim.min)}–${u.len(lim.max)}` : pd.type === 'kg' ? `${u.mass(lim.min)}–${u.mass(lim.max)}` : `${min}–${max}`;
    return `<label class="field" for="${id}"><span>${esc(pd.label)}</span><span class="inp"><input type="number" inputmode="decimal" id="${id}" data-param="${pd.id}" value="${val}" min="${min}" max="${max}" step="${step}"><i>${esc(unit)}</i></span><small>${esc(range)}${pd.hint ? ' · ' + esc(pd.hint) : ''}</small></label>`;
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
        const n = parseFloat(el.value);
        if (!Number.isFinite(n)) continue;
        out[pd.id] = pd.type === 'len' ? u.fromInput(n) : pd.type === 'kg' ? u.massFromInput(n) : n;
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
        el.value = pd.type === 'len' ? u.toInput(v) : pd.type === 'kg' ? u.massToInput(v) : v;
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
    const theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    viewer = createViewer($('#viewer'), {
      theme,
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
  const badge = $('#step-badge');
  function showStep(n) {
    viewer?.setStep(n, n);
    badge.hidden = n == null;
    if (n != null) $('#step-badge-text').textContent = `After step ${n}: ${d.model.steps.find(s => s.n === n)?.title || ''}`;
  }
  $('#step-badge-off').addEventListener('click', () => showStep(null));
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
    $('#notes').innerHTML = d.notes.length ? `<p class="warn">${esc(d.notes.join('. '))}.</p>` : '';
    $('#built-for').textContent = paramsSummary(d);
    $('#facts').innerHTML = factsHtml(d);
    $('#status').className = 'status ' + (d.ok ? 'ok' : 'bad');
    $('#status').textContent = d.ok ? `✓ All ${d.checks.length} checks pass` : `✗ ${d.checks.filter(c => !c.pass).length} check(s) failing`;
    $('#checks-body').innerHTML = checksHtml(d);
    $('#bom-body').innerHTML = bomHtml(d);
    $('#drawings-body').innerHTML = drawingsHtml(d);
    $('#legend-body').innerHTML = legendHtml(d);
    $('#order-body').innerHTML = orderHtml(d);
    $('#steps-body').innerHTML = d.model.steps.map(st => stepHtml(d, st, { interactive: true, checked: ticks })).join('');
    $('#cutlist-body').innerHTML = cutListHtml(d);
    document.querySelectorAll('.unit-len').forEach(el => (el.textContent = u.lenUnit));
    viewer?.setModel(d);
    if ($('#show-stress').checked) $('#show-stress').dispatchEvent(new Event('change'));
    writeHash();
    document.dispatchEvent(new CustomEvent('blueprint:render', { detail: { ok: d.ok } }));
  }
  let timer = null;
  form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { given = readForm(); render(); }, 180); });
  form.addEventListener('change', () => { clearTimeout(timer); given = readForm(); render(); syncForm(); });
  $('#reset').addEventListener('click', () => { given = {}; d = null; render(); renderForm(); });
  $('#copy-link').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; } catch { e.target.textContent = 'Copy the address bar'; }
    setTimeout(() => (e.target.textContent = 'Copy link'), 1600);
  });
  document.querySelectorAll('[data-units]').forEach(b => b.addEventListener('click', () => {
    system = b.dataset.units; store.set(key + ':units', system); render(); renderForm();
  }));
  $('#print').addEventListener('click', () => window.print());
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-show-step]');
    if (!b) return;
    showStep(+b.dataset.showStep);
    $('#model').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  document.addEventListener('change', e => {
    const c = e.target.closest('[data-check]');
    if (!c) return;
    ticks[c.dataset.check] = c.checked; store.set(key + ':ticks', ticks);
  });

  render();
  renderForm();
  window.__blueprint = { get d() { return d; }, render, setParams(p) { given = { ...given, ...p }; render(); renderForm(); }, setUnits(s) { system = s; render(); renderForm(); } };
}
