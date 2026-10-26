#!/usr/bin/env node
// Build the plans site: every plans/<id>/design.mjs becomes _site/<id>/index.html
// (the full build pack, with a link back), and _site/index.html lists them all.
//
//   node tools/site.mjs [--out _site]
//
// To add a plan to the site, add plans/<id>/design.mjs (made with the blueprint
// skill, passing its audit). Nothing here needs to change. The skill's own
// examples are listed too, unless a plan of the same id is already there.
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

const designsIn = dir => existsSync(dir) ? readdirSync(dir, { withFileTypes: true })
  .filter(e => e.isDirectory() && existsSync(join(dir, e.name, 'design.mjs')))
  .map(e => ({ id: e.name, file: join(dir, e.name, 'design.mjs') })) : [];
const plans = designsIn(join(ROOT, 'plans'));
const designs = [...plans, ...designsIn(join(SKILL, 'examples')).filter(x => !plans.some(p => p.id === x.id))]
  .sort((a, b) => a.id.localeCompare(b.id));
if (!designs.length) { console.error('no plans/<id>/design.mjs found'); process.exit(1); }
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const cards = [];
for (const { id, file } of designs) {
  const plan = (await import(pathToFileURL(file).href)).plan;
  const d = derive(plan, {}, plan.units || 'metric');
  const bad = d.checks.filter(c => !c.pass);
  if (bad.length) { console.error(`${id}: ${bad.length} failing check(s): ${bad.map(c => c.name).join('; ')}`); process.exit(1); }
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'index.html'), pageHtml(d, { script: bundle(file), back: { href: '../', label: 'All plans' } }));
  cards.push({
    id, plan, thumb: thumbSvg(d),
  });
  console.log(`built ${id}: ${d.model.members.length} members, ${d.checks.length} checks pass`);
}

const REPO = 'https://github.com/pham-tuan-binh/blueprint';
const GH_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
const COPY_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 3.5v-1h-8v8h1"/></svg>';
const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 11L11 5M6 5h5v5"/></svg>';

// what the visitor copies: install, ask, open, share
const STEPS = [
  { n: 1, title: 'Install the skill', note: 'Works with Claude Code, Codex, Cursor, Gemini CLI and any agent that can run Node.js 20+.',
    code: 'npx skills add pham-tuan-binh/blueprint' },
  { n: 2, title: 'Ask your agent for a plan', note: 'In plain words. Say inches if you want imperial.',
    code: 'Create build plans for a simple metal workbench.', prompt: true },
  { n: 3, title: 'Open the plan', note: 'One page to take to the shop: change the sizes in it and everything follows.',
    code: 'open plans/metal-workbench/index.html' },
  { n: 4, title: 'Share the plan', note: 'If you want to share your work in this page\'s examples, the skill also describes how to: just tell your agent to share the plan.',
    code: 'Share my plan in plans/metal-workbench with the blueprint gallery.', prompt: true },
];

const GALLERY_CSS = `
.gh{display:inline-flex;align-items:center;gap:8px;font:500 15px/1 var(--sans);color:var(--ink2);text-decoration:none}
.gh svg{width:18px;height:18px;flex:none}.gh .ext{width:11px;height:11px;margin-left:3px}
.gh span{display:inline-flex;align-items:center;padding-bottom:2px;border-bottom:1px solid var(--line)}
.gh:hover,.gh:focus-visible{color:var(--ink)}.gh:hover span,.gh:focus-visible span{border-bottom-color:var(--ink)}
.hero{max-width:66ch;margin:40px 0 28px}
.hero h1{margin:0 0 10px;font-size:48px;letter-spacing:-.02em}
.hero .tag{font-size:20px;line-height:1.4;color:var(--ink);margin:0 0 20px}
@media (max-width:600px){.hero{margin-top:16px}.hero h1{font-size:36px}.hero .tag{font-size:18px}}
.start{display:grid;gap:14px;max-width:760px;margin:0 0 48px;padding:0;list-style:none}
.start li{display:grid;grid-template-columns:34px 1fr;gap:4px 12px}
.start .n{width:28px;height:28px;border:1.5px solid var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center;font:600 13px var(--mono);margin-top:1px}
.start h3{margin:3px 0 0;font-size:16px}.start p{margin:0;color:var(--ink2);font-size:14px}
.code{grid-column:2;display:flex;align-items:stretch;border:1.5px solid var(--ink);background:var(--th);margin-top:6px;min-width:0}
.code pre{margin:0;padding:11px 14px;flex:1;overflow-x:auto;font:14px/1.5 var(--mono)}
.code .ps{color:var(--muted);user-select:none}
.code button{border:0;border-left:1.5px solid var(--ink);background:var(--paper);color:var(--ink);width:44px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;flex:none}
.code button svg{width:16px;height:16px}.code button:hover,.code button:focus-visible{background:var(--ink);color:var(--paper)}
.code button.ok{background:var(--okc);color:var(--paper)}
h2.sec{font-size:24px;margin:0 0 6px;padding:0;border:0}
p.sec{margin:0 0 18px;color:var(--ink2);max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px}
.card{border:1.5px solid var(--ink);display:flex;flex-direction:column;text-decoration:none;color:inherit;background:var(--paper);position:relative;transition:background .15s}
.card:hover,.card:focus-visible{background:var(--th)}
.card .arrow{position:absolute;top:12px;right:12px;width:34px;height:34px;border:1.5px solid var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--paper);transition:background .15s,color .15s}
.card .arrow svg{width:16px;height:16px}
.card:hover .arrow,.card:focus-visible .arrow{background:var(--ink);color:var(--paper)}
.card .pic{border-bottom:1px solid var(--line);padding:14px;height:250px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.card .pic svg{width:100%;height:100%;border:0;background:transparent}
.card .txt{padding:12px 16px 16px;display:flex;flex-direction:column;gap:6px;flex:1}
.card h2{font-size:19px;margin:0;padding:0;border:0;display:block}.card p{margin:0;color:var(--ink2);font-size:14px}
.card p.by{font:12px var(--mono);color:var(--muted)}
.card .go{margin-top:auto;padding-top:10px;font-weight:600;font-size:14px}
@media (prefers-reduced-motion:reduce){.card,.card .arrow,.code button{transition:none}}
`;

const COPY_JS = `document.querySelectorAll('.code button').forEach(b => b.addEventListener('click', async () => {
  const t = b.parentElement.querySelector('code').textContent;
  try { await navigator.clipboard.writeText(t); } catch { const r = document.createRange(); r.selectNodeContents(b.parentElement.querySelector('code')); getSelection().removeAllRanges(); getSelection().addRange(r); return; }
  b.classList.add('ok'); b.setAttribute('aria-label', 'Copied'); setTimeout(() => { b.classList.remove('ok'); b.setAttribute('aria-label', 'Copy'); }, 1400);
}));`;

const index = `<!doctype html>
<html lang="en" style="color-scheme:light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>Blueprint</title>
<meta name="description" content="Blueprint: an agent skill that generates build plans for your fabrication shop. A 3D model, sizes you can change, checks, cut sheets, 3D prints and numbered steps.">
<style>${PAGE_CSS}${GALLERY_CSS}</style>
</head>
<body>
<main>
  <div class="hero">
    <h1>Blueprint</h1>
    <p class="tag">An agent skill that generates build plans for your fabrication shop.</p>
    <a class="gh" href="${REPO}">${GH_ICON}<span>pham-tuan-binh/blueprint on GitHub<svg class="ext" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 11L11 5M6 5h5v5"/></svg></span></a>
  </div>
  <ol class="start">
${STEPS.map(st => `    <li><span class="n">${st.n}</span><div><h3>${esc(st.title)}</h3><p>${esc(st.note)}</p></div>
      <div class="code"><pre><span class="ps">${st.prompt ? '&gt; ' : '$ '}</span><code>${esc(st.code)}</code></pre><button type="button" aria-label="Copy">${COPY_ICON}</button></div></li>`).join('\n')}
  </ol>
  <h2 class="sec">Examples</h2>
  <p class="sec">Here are some examples generated with this skill.</p>
  <div class="grid">
${cards.map(c => `    <a class="card" href="${esc(c.id)}/">
      <span class="arrow" aria-hidden="true">${ARROW}</span>
      <div class="pic">${c.thumb}</div>
      <div class="txt">
        <h2>${esc(c.plan.name)}</h2>
        <p>${esc(c.plan.summary || '')}</p>
        ${c.plan.author?.github ? `<p class="by">by @${esc(c.plan.author.github)}</p>` : ''}
        <span class="go">Open the build plan →</span>
      </div>
    </a>`).join('\n')}
  </div>
</main>
<footer class="foot"><p><a href="${REPO}">Blueprint on GitHub</a> · MIT. Plans are a starting point, not an engineer's sign-off. Check your stock, wear eye and hand protection, and load-test gently before you trust a build.</p></footer>
<script>${COPY_JS}</script>
</body>
</html>
`;
writeFileSync(join(OUT, 'index.html'), index);
writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`site: ${OUT} (${designs.length} plan${designs.length > 1 ? 's' : ''})`);
