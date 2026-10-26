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

const fingerprint = d => JSON.stringify([d.bbox.map(b => b.map(Math.round)), d.pieces.map(g => [g.mark, g.qty, Math.round(g.pm.longPoint)]), d.model.plates.map(p => p.s.map(Math.round)), d.model.hardware.map(h => h.qty), d.loads.map(l => l.load.kg ?? l.load.N)]);
const prints = {};
const metricNum = /(^|[^\w.])\d+(\.\d+)?\s?(mm|cm|m)\b/;
let worst = {};
for (const c of cases) {
  for (const system of ['metric', 'imperial']) {
    let d;
    const where = `${c.name} [${system}]`;
    try { d = derive(plan, c.given, system); } catch (e) { fail(where, `derive threw: ${e.message}`); continue; }
    if (system === 'metric') prints[c.name] = fingerprint(d);
    for (const ch of d.checks) {
      if (!ch.pass) fail(where, `✗ ${ch.name}: ${ch.value}`);
      // remember the tightest margin seen for the report
      const m = /factor ([\d.]+)/.exec(ch.value);
      if (m && (!worst[ch.name] || +m[1] < worst[ch.name].v)) worst[ch.name] = { v: +m[1], at: c.name };
    }
    if (system === 'imperial') {
      const texts = d.model.steps.flatMap(s => [s.title, s.summary, s.check, s.tip, ...s.tasks].filter(Boolean).map(t => [s.n, t]))
        .concat(d.model.checks.map(ch => ['check', String(ch.value)]));
      for (const [n, t] of texts) if (metricNum.test(t)) { fail(`step ${n} text`, `hard-coded metric "${t.match(metricNum)[0].trim()}" in "${t.slice(0, 70)}…": format sizes with u.len() so imperial works`); break; }
    }
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
      const nsteps = md.steps.map(s => s.n);
      nsteps.forEach((n, i) => { if (n !== i + 1) fail('steps', `numbered ${nsteps.join(',')}: number them 1, 2, 3…`); });
      for (const m of md.members) if (!m.name) fail(`member ${m.id}`, 'has no name');
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

const runs = cases.length * 2;
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
console.log(`${runs} runs (${cases.length} sizes × metric, imperial), every check passing`);
for (const [k, w] of Object.entries(worst)) console.log(`  tightest ${k}: ${w.v} at ${w.at}`);
console.log('audit passed');
