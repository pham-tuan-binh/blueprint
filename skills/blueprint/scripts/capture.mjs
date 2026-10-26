#!/usr/bin/env node
// Open a built plan in headless Chromium and prove the page, not just the model.
//
//   node scripts/capture.mjs path/to/index.html [--out shots/] [--pdf] [--hash "top=steel&length=2400"]
//
// --hash opens the page at another size or option (the same as a shared link), so
// the steps of a variant can be read too: capture each choice option into its own --out.
// Values in a hash are always mm and kg (whatever the plan's units), bools 1 or 0.
//
// Writes PNGs (desktop, phone, the size panel, materials, drawings, every step, cut
// list, the other units) and, with --pdf, the printed pack. Fails on any console error, a
// blank 3D view, sideways scroll on a phone, a number or mark more than 1 px off its text, an input field that does not change
// the plan, or a units switch that leaves millimetres behind. Read every PNG.
import { execSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { findPlaywright, launchChromium, hasPdftoppm, PLAYWRIGHT_FIX } from './env.mjs';
import { layoutAudit, summarise } from './layout.mjs';

const args = process.argv.slice(2);
const page0 = args.find(a => !a.startsWith('--'));
if (!page0) { console.error('usage: node scripts/capture.mjs path/to/index.html [--out dir] [--pdf]'); process.exit(2); }
const opt = (k, def) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : def; };
const file = resolve(page0);
const out = resolve(opt('out', join(dirname(file), 'shots')));
mkdirSync(out, { recursive: true });

const pw = findPlaywright();
if (!pw) { console.error(`playwright not found. Fix: ${PLAYWRIGHT_FIX}\nThen: node scripts/blueprint.mjs doctor`); process.exit(2); }
let browser;
try { browser = await launchChromium(pw); }
catch (e) { console.error(`${e.message}\nFix: ${e.fix}`); process.exit(2); }
const problems = [];
const url = pathToFileURL(file).href + (opt('hash', '') ? '#' + opt('hash', '').replace(/^#/, '') : '');

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


// ---------------------------------------------------------------- desktop
const p = await open({ width: 1280, height: 900 });
await p.screenshot({ path: join(out, 'desktop.png') });
// layout: every number, checkbox, mark and icon centred on the text beside it, within 1 px
const layout = async (pg, label) => { for (const line of summarise(await pg.evaluate(layoutAudit))) problems.push(`layout (${label}): ${line}`); };
await layout(p, 'page, desktop');
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
await shot(p, '#bom', 'materials.png');
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
  return pd && { id: pd.id, len: pd.type === 'len', max: window.__blueprint.d.limits[pd.id].max, min: window.__blueprint.d.limits[pd.id].min, value: window.__blueprint.d.p[pd.id] };
});
if (lenField) {
  const before = await text(p, '#cutlist-body');
  const target = Math.abs(lenField.value - lenField.max) < 1 ? lenField.min : lenField.max;
  // type it the way the field shows it: mm, or inches in an imperial page
  const typed = await p.evaluate(([mm, isLen]) => { const u = window.__blueprint.d.units; return isLen ? (u.imperial ? u.toText(mm) : String(Math.round(mm))) : String(Math.round(mm)); }, [target, lenField.len]);
  await p.fill(`#f-${lenField.id}`, typed);
  await p.press(`#f-${lenField.id}`, 'Tab');
  await p.waitForTimeout(600);
  const after = await text(p, '#cutlist-body');
  const got = await p.evaluate(id => window.__blueprint.d.p[id], lenField.id);
  if (Math.abs(got - target) > 1) problems.push(`typing ${typed} into ${lenField.id} gave ${Math.round(got)} mm, not ${Math.round(target)}`);
  if (before === after) problems.push(`changing ${lenField.id} did not change the cut list`);
  if (!(await p.evaluate(() => location.hash.length > 1))) problems.push('the size is not in the URL, so it cannot be shared');
  await p.screenshot({ path: join(out, 'desktop-changed.png') });
  await p.click('#reset');
  await p.waitForTimeout(300);
  if (opt('hash', '')) await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
}

// ---------------------------------------------------------------- 3D print downloads
// a plan with prints must hand over a real STL (cut at this size) and its .scad
if (await p.$('[data-stl]')) {
  const ids = await p.$$eval('#bom [data-stl]', bs => bs.map(b => b.dataset.stl));
  for (const id of ids) {
    const [dlS] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(`#bom [data-stl="${id}"]`)]);
    const fs = await import('node:fs');
    const path = join(out, await dlS.suggestedFilename());
    await dlS.saveAs(path);
    const buf = fs.readFileSync(path), tris = buf.length > 84 ? buf.readUInt32LE(80) : 0;
    if (tris < 12 || buf.length !== 84 + tris * 50) problems.push(`print ${id}: the STL is empty or malformed (${buf.length} bytes)`);
    const [dlC] = await Promise.all([p.waitForEvent('download'), p.click(`#bom [data-scad="${id}"]`)]);
    const scadPath = join(out, await dlC.suggestedFilename());
    await dlC.saveAs(scadPath);
    if (!/difference\(\)/.test(fs.readFileSync(scadPath, 'utf8'))) problems.push(`print ${id}: the .scad has no geometry`);
  }
  await shot(p, '#bom', 'materials.png');
}

// ---------------------------------------------------------------- the other units
// the page opens in the plan's units; switch to the other system and check nothing
// of the first is left in the plan's own numbers (bought parts keep their trade names)
const home = await p.evaluate(() => window.__blueprint.d.units.system);
const other = home === 'imperial' ? 'metric' : 'imperial';
const ownText = (sel) => p.$eval(sel, el => { const c = el.cloneNode(true); c.querySelectorAll('ul.plain, .spec, .bought').forEach(x => x.remove()); document.body.appendChild(c); const t = c.innerText; c.remove(); return t; }).catch(() => '');
const SECTIONS = ['#checks-body', '#bom-body', '#drawings-body', '#legend-body', '#steps-body', '#cutlist-body', '#size'];
await p.click(`[data-units="${other}"]`);
await p.waitForTimeout(600);
const left = other === 'imperial' ? /(?<![\d.])\d+(\.\d+)?\s?mm\b(?![²2])/g : /\d+(\s\d+\/\d+)?"/g;
for (const sel of SECTIONS) {
  const t = await ownText(sel), hits = t.match(left);
  if (!hits) continue;
  const at = t.indexOf(hits[0]), ctx = t.slice(Math.max(0, at - 40), at + 20).replace(/\s+/g, ' ').trim();
  problems.push(`${other}: ${sel.replace(/^#|-body$/g, '')} still shows ${other === 'imperial' ? 'millimetres' : 'inches'} (${hits.slice(0, 3).join(', ')}) in "…${ctx}…": format it with u.len() / u.tol() in design.mjs`);
}
if (other === 'imperial' && !/"/.test(await text(p, '#cutlist-body'))) problems.push('imperial: no inch marks in the cut list');
await shot(p, '#model', `${other}-model.png`);
await shot(p, '#cutlist', `${other}-cutlist.png`);
await shot(p, '#steps-body .step:nth-child(2)', `${other}-step-2.png`);
if (args.includes('--pdf')) {
  // print in the plan's own units
  await p.click(`[data-units="${home}"]`);
  await p.waitForTimeout(400);
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: join(out, 'plan.pdf'), format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
  // pages as images, so the print layout can be read too
  if (hasPdftoppm()) execSync(`pdftoppm -r 50 -png "${join(out, 'plan.pdf')}" "${join(out, 'pdf')}"`);
  else console.log('note: pdftoppm not found, so plan.pdf pages were not rendered to PNG (install poppler-utils)');
}
await p.close();

// ---------------------------------------------------------------- light paper, always
// a device set to dark mode still gets light paper: the pack is a drawing, not an app
{
  const dk = await browser.newPage({ viewport: { width: 1000, height: 700 }, colorScheme: 'dark' });
  await dk.goto(url, { waitUntil: 'networkidle' });
  await dk.waitForTimeout(800);
  const lum = await dk.evaluate(() => {
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
    return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
  });
  if (lum < 0.85) problems.push(`dark mode: the page turns dark (background luminance ${lum.toFixed(2)}); it must stay light paper`);
  await dk.screenshot({ path: join(out, 'dark-mode-device.png') });
  await dk.close();
}

// ---------------------------------------------------------------- explainers and the guide
// a "?" opens its bubble; the guide beside the page opens light, without errors, and fits a phone
{
  const pq = await open({ width: 1000, height: 800 });
  const q = await pq.$('#steps-body .q');
  if (!q) problems.push('no "?" explainers in the steps');
  else {
    await q.click();
    if (!(await pq.evaluate(() => { const b = document.querySelector('.qpop'); return b && !b.hidden && b.textContent.length > 10; }))) problems.push('a "?" does not open its explanation');
  }
  await pq.close();
  const gfile = join(dirname(file), 'guide.html');
  if (!existsSync(gfile)) problems.push('no guide.html beside the page (build writes it)');
  else for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const g = await browser.newPage({ viewport: vp });
    g.on('pageerror', e => problems.push(`guide: page error: ${e.message}`));
    g.on('console', m => { if (m.type() === 'error') problems.push(`guide: console: ${m.text()}`); });
    await g.goto(pathToFileURL(gfile).href, { waitUntil: 'networkidle' });
    await layout(g, `guide, ${vp.width < 500 ? 'phone' : 'desktop'}`);
    await g.screenshot({ path: join(out, vp.width < 500 ? 'guide-phone.png' : 'guide.png'), fullPage: true });
    if (vp.width < 500 && (await g.evaluate(() => document.documentElement.scrollWidth)) > 392) problems.push('guide: scrolls sideways on a phone');
    await g.close();
  }
}

// ---------------------------------------------------------------- phone
const ph = await open({ width: 390, height: 844 });
await layout(ph, 'page, phone');
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
