#!/usr/bin/env node
// Prove a plan, the way a checker would, before anyone cuts steel.
//
//   node scripts/audit.mjs path/to/design.mjs [--samples 40] [--verbose]
//
// Runs derive() at the defaults, at every parameter's min and max (the others at
// their defaults), at all-min and all-max, and at random combinations, in metric
// and imperial. Every kit check and every plan check must pass at every one of
// them: a size the input fields allow is a size someone will build. It also lints
// the plan itself (text that ignores the units, fields that change nothing, steps
// without a check). Ends with "audit passed" or exits 1.
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../kit');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('usage: node scripts/audit.mjs path/to/design.mjs [--samples 40] [--verbose]'); process.exit(2); }
const opt = (k, def) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : def; };
const verbose = args.includes('--verbose');
const { derive } = await import(pathToFileURL(join(KIT, 'derive.mjs')).href);
const { resolveParams } = await import(pathToFileURL(join(KIT, 'core.mjs')).href);
const mod = await import(pathToFileURL(resolve(file)).href);
const plan = mod.plan || mod.default;

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
if (/STARTED FROM examples\//.test(readFileSync(resolve(file), 'utf8'))) fail('design.mjs', 'still carries the "STARTED FROM examples/" note from `blueprint new`: rewrite the plan for this thing, then delete the note');

// ---------------------------------------------------------------- plan lint
const params = plan.params || [];
for (const k of ['id', 'name', 'summary', 'build']) if (!plan[k]) fail('plan', `missing "${k}"`);
if (!/^[a-z0-9-]+$/.test(plan.id || '')) fail('plan', 'id must be kebab-case');
if (plan.units && plan.units !== 'metric' && plan.units !== 'imperial') fail('plan', 'units must be "metric" or "imperial"');
if (!params.length) fail('plan', 'no params: a build plan is parametric, give it at least its main sizes as input fields');
{
  const { p: dp, limits } = resolveParams(params, {});
  for (const pd of params) if (limits[pd.id] && !(limits[pd.id].min <= pd.value && pd.value <= limits[pd.id].max)) fail(`param ${pd.id}`, `default ${pd.value} is outside ${limits[pd.id].min}–${limits[pd.id].max}`);
  void dp;
}
for (const pd of params) {
  if (!pd.id || !pd.label) fail(`param ${pd.id}`, 'needs id and label');
  if (!['len', 'count', 'kg', 'choice', 'bool', 'number'].includes(pd.type)) fail(`param ${pd.id}`, `unknown type "${pd.type}" (len, count, kg, number, choice, bool)`);
  if (['len', 'count', 'kg', 'number'].includes(pd.type) && (pd.min == null || pd.max == null)) fail(`param ${pd.id}`, 'needs min and max');
  if (pd.type === 'choice' && !pd.options?.some(o => o.value === pd.value)) fail(`param ${pd.id}`, 'default is not one of its options');
}

// ---------------------------------------------------------------- the sweep
const numeric = params.filter(p => ['len', 'count', 'kg', 'number'].includes(p.type));
const cases = [{ name: 'defaults', given: {} }];
for (const pd of params) {
  if (pd.type === 'choice') for (const o of pd.options) cases.push({ name: `${pd.id}=${o.value}`, given: { [pd.id]: o.value } });
  else if (pd.type === 'bool') cases.push({ name: `${pd.id}=${!pd.value}`, given: { [pd.id]: !pd.value } });
  else { cases.push({ name: `${pd.id}=min`, given: { [pd.id]: -1e9 } }); cases.push({ name: `${pd.id}=max`, given: { [pd.id]: 1e9 } }); }
}
if (numeric.length > 1) {
  cases.push({ name: 'all min', given: Object.fromEntries(numeric.map(p => [p.id, -1e9])) });
  cases.push({ name: 'all max', given: Object.fromEntries(numeric.map(p => [p.id, 1e9])) });
}
// sweeps: each numeric param in 12 steps across its range with every other param at
// its max, then at its min, so a threshold in the design (a middle leg above some
// length) is met at its worst neighbours, not only by luck in the random samples
for (const pd of numeric) for (const corner of ['max', 'min']) for (let i = 0; i <= 11; i++) {
  const g = Object.fromEntries(numeric.filter(q => q !== pd).map(q => [q.id, corner === 'max' ? 1e9 : -1e9]));
  const lim = resolveParams(params, g).limits[pd.id];
  g[pd.id] = lim.min + ((lim.max - lim.min) * i) / 11;
  cases.push({ name: `sweep ${pd.id} ${i}/11, rest ${corner}`, given: g, sweep: true });
}
// every option of every choice at the numeric corners: a choice that is only weak
// together with a big size or a big load is met there
const choices = params.filter(p => p.type === 'choice' || p.type === 'bool');
for (const pd of choices) for (const v of pd.type === 'bool' ? [true, false] : pd.options.map(o => o.value)) for (const corner of ['max', 'min']) {
  const g = Object.fromEntries(numeric.map(q => [q.id, corner === 'max' ? 1e9 : -1e9]));
  // the other choices at their heaviest-looking option: the last listed
  for (const o of choices) if (o !== pd) g[o.id] = o.type === 'bool' ? true : o.options[o.options.length - 1].value;
  g[pd.id] = v;
  cases.push({ name: `${pd.id}=${v}, rest ${corner}`, given: g, sweep: true });
}
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const N = +opt('samples', 40);
for (let i = 0; i < N; i++) {
  const g = {};
  for (const pd of params) {
    if (pd.type === 'choice') g[pd.id] = pd.options[Math.floor(rnd() * pd.options.length)].value;
    else if (pd.type === 'bool') g[pd.id] = rnd() < 0.5;
    else { const lim = resolveParams(params, g).limits[pd.id]; g[pd.id] = lim.min + rnd() * (lim.max - lim.min); }
  }
  cases.push({ name: `random ${i + 1} (${Object.entries(g).map(([k, v]) => `${k}=${typeof v === 'number' ? Math.round(v) : v}`).join(' ')})`, given: g });
}

// what a person would see change: sizes, pieces, parts and their specs, sections, loads, and every check's result
const fingerprint = d => JSON.stringify([d.bbox.map(b => b.map(Math.round)), d.pieces.map(g => [g.mark, g.qty, Math.round(g.pm.longPoint), g.sec.id]), d.model.plates.map(p => [p.s.map(Math.round), p.material]), d.model.hardware.map(h => [h.qty, h.spec, h.name]), d.loads.map(l => l.load.kg ?? l.load.N), d.checks.map(c => c.value), d.model.prints.map(p => p.material)]);
const prints = {};
// a metric length in text; a wire gauge ("2.5 mm²") is a product name, not a length
const metricNum = /(^|[^\w.])\d+(\.\d+)?\s?(mm|cm|m)\b(?![²2])/;
let worst = {};
for (const c of cases) {
  for (const system of c.sweep ? ['metric'] : ['metric', 'imperial']) {
    let d;
    const where = `${c.name} [${system}]`;
    try { d = derive(plan, c.given, system); } catch (e) { fail(where, `derive threw: ${e.message}`); continue; }
    if (system === 'metric') prints[c.name] = fingerprint(d);
    for (const ch of d.checks) {
      if (!ch.pass) fail(where, `✗ ${ch.name}: ${ch.value}`);
      // remember the tightest margin seen for the report
      // tightest margins: safety factors, and deflection as limit ÷ movement
      const m = /anchored/.test(ch.value) ? null : /factor ([\d.]+)/.exec(ch.value);
      if (m && (!worst[ch.name] || +m[1] < worst[ch.name].v)) worst[ch.name] = { v: +m[1], at: c.name };
      const dm = d.loads.find(r => ch.name === `${r.name}: deflection`);
      if (dm) { const v = +(dm.load.defl / Math.max(dm.loadDefl, 1e-6)).toFixed(2); if (!worst[ch.name] || v < worst[ch.name].v) worst[ch.name] = { v, at: c.name, unit: '× under the limit' }; }
    }
    // every word the plan writes must follow the units: no "mm" in imperial, no inch marks in metric
    const texts = d.model.steps.flatMap(s => [s.title, s.summary, s.check, s.tip, ...s.tasks, ...(s.table ? s.table.rows.flat().map(String) : [])].filter(Boolean).map(t => [`step ${s.n}`, t]))
      .concat(d.model.checks.flatMap(ch => [['check', String(ch.name)], ['check', String(ch.value)], ['check', String(ch.why || '')]]))
      .concat(d.model.facts.map(f => ['fact', f.join(' ')]))
      .concat(d.model.plates.flatMap(pl => [['plate ' + pl.id, pl.name], ['plate ' + pl.id, pl.note || '']]))
      .concat((d.model.prints || []).flatMap(pr => [['print ' + pr.id, pr.orient || ''], ['print ' + pr.id, pr.note || '']]))
      .concat([['model tolerance', d.model.tolerance || '']])
      .concat((plan.params || []).flatMap(pd => [['param ' + pd.id, typeof pd.hint === 'function' ? pd.hint(d.units) : pd.hint || ''],
        ...(pd.options || []).map(o => ['param ' + pd.id, typeof o.label === 'function' ? o.label(d.units) : o.label])]));
    const bad = system === 'imperial' ? metricNum : /\d(\s\d+\/\d+)?"|\d+(\.\d+)?\s?(in|inch|inches|ft|feet)\b/;
    for (const [where2, t] of texts) if (bad.test(t)) { fail(`${where2} text`, `hard-coded ${system === 'imperial' ? 'metric' : 'imperial'} "${t.match(bad)[0].trim()}" in "${t.slice(0, 70)}…": format sizes with u.len() (a hint or option label can be a function of u)`); break; }
    if (c.name === 'defaults' && system === 'metric') {
      const md = d.model;
      for (const s of md.steps) {
        if (!s.tasks.length) fail(`step ${s.n}`, 'has no tasks');
        if (!s.hours) fail(`step ${s.n}`, 'has no hours estimate');
        if (md.members.some(m => m.step === s.n) && !s.check) fail(`step ${s.n}`, 'fits members but ends without a check to pass');
      }
      if (!md.datum) fail('model', 'no datum: say where x, y and z are measured from');
      if (!md.loads?.length) fail('model', 'no load case: say what it must hold and prove it');
      if (!md.supports?.length) fail('model', 'no supports: say where it stands');
      if (!md.tools?.length) fail('model', 'no tools list');
      if (md.tip?.anchored) {
        const n = +(/step (\d+)/.exec(md.tip.anchored) || [])[1];
        const fixings = md.hardware.filter(h => h.step === n && /anchor|bolt|screw|lag|fixing/i.test(h.name + ' ' + (h.spec || '')));
        if (!n || !md.steps.some(s => s.n === n)) fail('tip', 'anchored must name the step that fixes it down: "step 6, four M8 anchors"');
        else if (!fixings.length) fail('tip', `anchored in step ${n}, but no anchor, bolt or screw is fitted in step ${n}`);
      }
      const nsteps = md.steps.map(s => s.n);
      nsteps.forEach((n, i) => { if (n !== i + 1) fail('steps', `numbered ${nsteps.join(',')}: number them 1, 2, 3…`); });
      for (const m of md.members) if (!m.name) fail(`member ${m.id}`, 'has no name');
      // one mark is one stack of identical pieces, so it gets one name on the cut sheet
      for (const g of d.pieces) if (g.name.includes(' / ')) fail(`mark ${g.mark}`, `identical pieces with different names ("${g.name}"): give them one name, or make them differ`);
    }
  }
  if (problems.length > 60) break;
}
// a field that changes nothing is a broken promise
for (const pd of params) {
  if (pd.type === 'choice' || pd.type === 'bool') {
    if (pd.type === 'choice') { const fps = pd.options.map(o => prints[`${pd.id}=${o.value}`]); if (new Set(fps).size < fps.length) fail(`param ${pd.id}`, 'two options give the same plan'); }
    else if (prints[`${pd.id}=${!pd.value}`] === prints.defaults) fail(`param ${pd.id}`, 'changing it changes nothing in the plan');
  } else if (prints[`${pd.id}=min`] && prints[`${pd.id}=min`] === prints[`${pd.id}=max`]) fail(`param ${pd.id}`, 'min and max give the same plan: the field does nothing');
}

const runs = cases.reduce((n, c) => n + (c.sweep ? 1 : 2), 0);
if (verbose || problems.length) {
  for (const [k, w] of Object.entries(worst)) console.log(`  tightest ${k}: ${w.v} at ${w.at}`);
}
if (problems.length) {
  const uniq = [...new Set(problems)];
  console.log(uniq.slice(0, 40).map(p => '  ✗ ' + p).join('\n'));
  if (uniq.length > 40) console.log(`  … and ${uniq.length - 40} more`);
  console.log(`\naudit FAILED: ${uniq.length} problem(s) across ${runs} runs`);
  process.exit(1);
}
console.log(`${runs} runs over ${cases.length} sizes (sweeps, extremes and random, metric and imperial), every check passing`);
for (const [k, w] of Object.entries(worst)) console.log(`  tightest ${k}: ${w.v}${w.unit ? ' ' + w.unit : ''} at ${w.at}`);
console.log('audit passed');
