#!/usr/bin/env node
// Build the plans site: every plans/<id>/design.mjs becomes _site/<id>/index.html
// (the full build pack, with a link back), and _site/index.html lists them all.
//
//   node tools/site.mjs [--out _site]
//
// To add a plan to the site, add plans/<id>/design.mjs (made with the blueprint
// skill, passing its audit). Nothing here needs to change.
import { readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills/blueprint');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = resolve(ROOT, outIdx >= 0 ? args[outIdx + 1] : '_site');

const imp = f => import(pathToFileURL(join(SKILL, f)).href);
const { derive } = await imp('kit/derive.mjs');
const { pageHtml, PAGE_CSS } = await imp('kit/page.mjs');
const { thumbSvg } = await imp('kit/shop.mjs');
const { esc } = await imp('kit/core.mjs');
const { bundle } = await imp('scripts/build.mjs');

const plansDir = join(ROOT, 'plans');
const ids = readdirSync(plansDir, { withFileTypes: true })
  .filter(e => e.isDirectory() && existsSync(join(plansDir, e.name, 'design.mjs')))
  .map(e => e.name).sort();
if (!ids.length) { console.error('no plans/<id>/design.mjs found'); process.exit(1); }

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const cards = [];
for (const id of ids) {
  const file = join(plansDir, id, 'design.mjs');
  const plan = (await import(pathToFileURL(file).href)).plan;
  const d = derive(plan, {}, plan.units || 'metric');
  const bad = d.checks.filter(c => !c.pass);
  if (bad.length) { console.error(`${id}: ${bad.length} failing check(s): ${bad.map(c => c.name).join('; ')}`); process.exit(1); }
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'index.html'), pageHtml(d, { script: bundle(file), back: { href: '../', label: 'All plans' } }));
  const u = d.units, [lo, hi] = d.bbox;
  cards.push({
    id, plan, thumb: thumbSvg(d),
    facts: [
      ['Size', `${u.len(hi[0] - lo[0])} × ${u.len(hi[1] - lo[1])} × ${u.len(hi[2] - lo[2])}${u.imperial ? '' : ' mm'}`],
      ['Mass', u.mass(d.totalKg)],
      ['Pieces', `${d.model.members.length} (${d.pieces.length} marks)`],
      ['Steps', `${d.model.steps.length} · ${d.hours} h`],
      ['Fields', (plan.params || []).map(p => p.label.toLowerCase()).join(', ')],
    ],
  });
  console.log(`built ${id}: ${d.model.members.length} members, ${d.checks.length} checks pass`);
}

const GALLERY_CSS = `
.hero{max-width:70ch;margin:0 0 28px}.hero h1{margin-bottom:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px}
.card{border:1.5px solid var(--ink);display:flex;flex-direction:column;text-decoration:none;color:inherit;background:var(--paper);position:relative;transition:background .15s}
.card:hover,.card:focus-visible{background:var(--th)}
.card .arrow{position:absolute;top:12px;right:12px;width:34px;height:34px;border:1.5px solid var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--paper);transition:background .15s,color .15s}
.card .arrow svg{width:16px;height:16px}
.card:hover .arrow,.card:focus-visible .arrow{background:var(--ink);color:var(--paper)}
.card .pic{border-bottom:1px solid var(--line);padding:14px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center}
.card .pic svg{width:100%;height:100%;border:0}
.card .txt{padding:12px 16px 16px;display:flex;flex-direction:column;gap:6px;flex:1}
.card h2{font-size:19px;margin:0;padding:0;border:0;display:block}.card p{margin:0;color:var(--ink2);font-size:14px}
.card dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:6px 0 0;font:12px var(--mono)}.card dt{color:var(--muted)}.card dd{margin:0}
.card .go{margin-top:auto;padding-top:10px;font-weight:600;font-size:14px}
.how{margin-top:44px;border-top:2px solid var(--ink);padding-top:14px;max-width:75ch}
@media (prefers-reduced-motion:reduce){.card,.card .arrow{transition:none}}
`;

const index = `<!doctype html>
<html lang="en" style="color-scheme:light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>Blueprint plans</title>
<meta name="description" content="Parametric build plans made with the blueprint agent skill: 3D model, sizes you can change, checks, cut sheets and steps.">
<style>${PAGE_CSS}${GALLERY_CSS}</style>
</head>
<body>
<header class="top"><div class="top-in"><a class="brand" href="./">blueprint</a><nav class="toc"><a href="https://github.com/pham-tuan-binh/blueprint">GitHub</a></nav></div></header>
<main>
  <div class="hero">
    <p class="kicker">Build plans · ${ids.length} plan${ids.length > 1 ? 's' : ''}</p>
    <h1>Build plans for things made of steel and wood</h1>
    <p class="lede">Each plan is a complete build pack: a 3D model, sizes you can change in the page, checks that must all pass, the materials to buy, drawings, numbered steps and a cut sheet for every piece. Metric, with an inch switch.</p>
  </div>
  <div class="grid">
${cards.map(c => `    <a class="card" href="${esc(c.id)}/">
      <span class="arrow" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 11L11 5M6 5h5v5"/></svg></span>
      <div class="pic">${c.thumb}</div>
      <div class="txt">
        <h2>${esc(c.plan.name)}</h2>
        <p>${esc(c.plan.summary || '')}</p>
        <dl>${c.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        <span class="go">Open the build plan →</span>
      </div>
    </a>`).join('\n')}
  </div>
  <section class="how">
    <h2 style="border:0;padding:0;margin:0 0 6px">Make your own</h2>
    <p>These plans are generated by the <a href="https://github.com/pham-tuan-binh/blueprint/tree/main/skills/blueprint">blueprint</a> agent skill. Install it with <code>npx skills add pham-tuan-binh/blueprint</code> and ask your coding agent for plans for anything: a welding cart, a shelf, a gate. Every plan here passed the skill's audit at every size its fields allow.</p>
  </section>
</main>
<footer class="foot"><p>Plans are a starting point, not an engineer's sign-off. Check your stock, wear eye and hand protection, and load-test gently before you trust a build.</p></footer>
</body>
</html>
`;
writeFileSync(join(OUT, 'index.html'), index);
writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`site: ${OUT} (${ids.length} plan${ids.length > 1 ? 's' : ''})`);
