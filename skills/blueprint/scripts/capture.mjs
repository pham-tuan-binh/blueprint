#!/usr/bin/env node
// Open a built plan in headless Chromium and prove the page, not just the model.
//
//   node scripts/capture.mjs path/to/index.html [--out shots/] [--pdf]
//
// Writes PNGs (desktop, phone, the size panel, drawings, the first jig step, cut
// list, imperial) and, with --pdf, the printed pack. Fails on any console error, a
// blank 3D view, sideways scroll on a phone, an input field that does not change
// the plan, or a units switch that leaves millimetres behind. Read every PNG.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const page0 = args.find(a => !a.startsWith('--'));
if (!page0) { console.error('usage: node scripts/capture.mjs path/to/index.html [--out dir] [--pdf]'); process.exit(2); }
const opt = (k, def) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : def; };
const file = resolve(page0);
const out = resolve(opt('out', join(dirname(file), 'shots')));
mkdirSync(out, { recursive: true });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const tries = [() => require('playwright'), () => require(join(execSync('npm root -g').toString().trim(), 'playwright'))];
  for (const t of tries) { try { return t(); } catch { /* next */ } }
  console.error('playwright not found: npm i -g playwright (and a Chromium it can launch)');
  process.exit(2);
}
const { chromium } = loadPlaywright();
const exe = ['/opt/pw-browsers/chromium', process.env.CHROMIUM_PATH].find(p => p && existsSync(p) && !p.endsWith('/chromium'));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], ...(exe ? { executablePath: exe } : {}) });
const problems = [];
const url = pathToFileURL(file).href;

async function open(viewport) {
  const p = await browser.newPage({ viewport });
  p.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  p.on('pageerror', e => problems.push(`page error: ${e.message}`));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__blueprint?.d, null, { timeout: 15000 }).catch(() => problems.push('the runtime never rendered (window.__blueprint missing)'));
  await p.waitForTimeout(1200);
  await p.addStyleTag({ content: '.top{position:static!important}' });
  return p;
}
const shot = async (p, sel, name) => {
  const el = await p.$(sel);
  if (!el) { problems.push(`missing ${sel}`); return; }
  await el.screenshot({ path: join(out, name) });
};
const text = (p, sel) => p.$eval(sel, el => el.innerText).catch(() => '');
// the same, without the bought-parts lists inside steps
const ownText = (p, sel) => p.$eval(sel, el => { const c = el.cloneNode(true); c.querySelectorAll('ul.plain').forEach(x => x.remove()); document.body.appendChild(c); const t = c.innerText; c.remove(); return t; }).catch(() => '');

// ---------------------------------------------------------------- desktop
const p = await open({ width: 1280, height: 900 });
await p.screenshot({ path: join(out, 'desktop.png') });
const ink = await p.evaluate(() => {
  const c = document.querySelector('#viewer canvas');
  if (!c) return -1;
  const g = document.createElement('canvas'); g.width = 160; g.height = 120;
  const x = g.getContext('2d'); x.drawImage(c, 0, 0, 160, 120);
  const d = x.getImageData(0, 0, 160, 120).data, bg = [d[0], d[1], d[2]];
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 60) n++;
  return n / (160 * 120);
});
if (ink < 0) problems.push('no 3D canvas');
else if (ink < 0.01) problems.push(`3D view looks blank (${(ink * 100).toFixed(1)}% ink)`);
else if (ink > 0.5) problems.push(`3D view is mostly ink (${(ink * 100).toFixed(0)}%): outlines are firing everywhere`);
await shot(p, '#size', 'size.png');
await shot(p, '#checks', 'checks.png');
await shot(p, '#drawings', 'drawings.png');
const firstJig = await p.evaluate(() => [...document.querySelectorAll('.step')].find(s => s.querySelector('.sheet'))?.id);
if (firstJig) await shot(p, '#' + firstJig, 'step-first-jig.png');
await shot(p, '#cutlist', 'cutlist.png');
const stepIds = await p.evaluate(() => [...document.querySelectorAll('.step')].map(s => s.id));
for (const id of stepIds) await shot(p, '#' + id, `${id}.png`);

// ---------------------------------------------------------------- a field changes the plan
const lenField = await p.evaluate(() => {
  const plan = window.__blueprint.d.plan;
  const pd = plan.params.find(q => q.type === 'len') || plan.params.find(q => q.type === 'count');
  return pd && { id: pd.id, max: window.__blueprint.d.limits[pd.id].max, min: window.__blueprint.d.limits[pd.id].min, value: pd.value };
});
if (lenField) {
  const before = await text(p, '#cutlist-body');
  const target = lenField.value === lenField.max ? lenField.min : lenField.max;
  await p.fill(`#f-${lenField.id}`, String(Math.round(target)));
  await p.press(`#f-${lenField.id}`, 'Tab');
  await p.waitForTimeout(600);
  const after = await text(p, '#cutlist-body');
  const got = await p.evaluate(id => window.__blueprint.d.p[id], lenField.id);
  if (Math.abs(got - target) > 1) problems.push(`typing ${target} into ${lenField.id} gave ${got}`);
  if (before === after) problems.push(`changing ${lenField.id} did not change the cut list`);
  if (!(await p.evaluate(() => location.hash.length > 1))) problems.push('the size is not in the URL, so it cannot be shared');
  await p.screenshot({ path: join(out, 'desktop-changed.png') });
  await p.click('#reset');
  await p.waitForTimeout(400);
}

// ---------------------------------------------------------------- imperial
await p.click('[data-units="imperial"]');
await p.waitForTimeout(600);
const cut = await text(p, '#cutlist-body');
if (!/"/.test(cut)) problems.push('imperial: no inch marks in the cut list');
// bought-part specs ("0.8 mm wire") are sold by those names; the plan's own numbers are not
const all = (await Promise.all(['#facts', '#checks-body', '#drawings-body', '#legend-body', '#steps-body', '#cutlist-body', '#size'].map(s => ownText(p, s)))).join('\n');
const mm = all.match(/\d\s?mm\b/g);
if (mm && mm.length) problems.push(`imperial: still shows millimetres (${mm.slice(0, 3).join(', ')})`);
await shot(p, '#model', 'imperial-model.png');
await shot(p, '#cutlist', 'imperial-cutlist.png');
if (args.includes('--pdf')) {
  await p.click('[data-units="metric"]');
  await p.waitForTimeout(400);
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: join(out, 'plan.pdf'), format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
}
await p.close();

// ---------------------------------------------------------------- phone
const ph = await open({ width: 390, height: 844 });
await ph.screenshot({ path: join(out, 'phone.png') });
await ph.screenshot({ path: join(out, 'phone-full.png'), fullPage: true });
const sw = await ph.evaluate(() => document.documentElement.scrollWidth);
if (sw > 392) problems.push(`phone: page scrolls sideways (${sw}px wide)`);
await ph.close();
await browser.close();

if (problems.length) {
  console.log([...new Set(problems)].map(x => '  ✗ ' + x).join('\n'));
  console.log(`\ncapture FAILED (${problems.length})`);
  process.exit(1);
}
console.log(`shots in ${out}`);
console.log('capture passed');
