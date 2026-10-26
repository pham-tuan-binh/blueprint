#!/usr/bin/env node
// Build a plan into one standalone HTML build pack.
//
//   node scripts/build.mjs path/to/design.mjs [--out path/to/index.html] [--units imperial]
//
// Also writes guide.html beside it (how to read the plan, linked from its "?" marks).
// Renders every section once in Node with the default params (so the file reads
// and prints without JavaScript), then inlines the kit and the design as one
// module script that re-renders on every input. The only network fetch is
// three.js from jsDelivr for the 3D view; everything else works offline.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../kit');
const ORDER = ['core', 'print', 'joints', 'fea', 'derive', 'shop', 'guide', 'pack', 'viewer', 'app'];

// Turn one ES module into a scoped block: imports from sibling kit modules become
// destructures of earlier blocks, URL imports are hoisted to the top of the bundle.
function scope(name, src, hoisted) {
  const exportsList = [];
  let body = src.replace(/^import\s+(\*\s+as\s+\w+|\{[^}]*\})\s+from\s+'(https?:[^']+)';\s*$/gm, (m) => { hoisted.add(m.trim()); return ''; });
  body = body.replace(/^import\s+\{([^}]*)\}\s+from\s+'\.\/([\w-]+)\.mjs';\s*$/gm, (_, names, mod) =>
    `const {${names.replace(/\s+as\s+/g, ': ')}} = __${mod};`);
  body = body.replace(/^import\s+\*\s+as\s+(\w+)\s+from\s+'\.\/([\w-]+)\.mjs';\s*$/gm, (_, id, mod) => `const ${id} = __${mod};`);
  body = body.replace(/^export\s+(async\s+function|function|const|let|class)\s+(\w+)/gm, (_, kw, id) => { exportsList.push(id); return `${kw} ${id}`; });
  body = body.replace(/^export\s+\{([^}]*)\};?\s*$/gm, (_, names) => { exportsList.push(...names.split(',').map(s => s.trim()).filter(Boolean)); return ''; });
  if (/^\s*(import|export)\s/m.test(body)) throw new Error(`bundler: unsupported import/export form left in ${name}`);
  return `const __${name} = (() => {\n${body}\nreturn { ${exportsList.join(', ')} };\n})();\n`;
}

export function bundle(designPath) {
  const hoisted = new Set();
  let out = '';
  for (const m of ORDER) out += scope(m, readFileSync(join(KIT, m + '.mjs'), 'utf8'), hoisted);
  let design = readFileSync(designPath, 'utf8');
  if (/^\s*import\s/m.test(design)) throw new Error('design.mjs must not import anything: build(p, k) receives the kit helpers in k');
  design = design.replace(/^export\s+default\s+/m, 'const plan = ').replace(/^export\s+const\s+plan\s*=/m, 'const plan =');
  out += `const __plan = (() => {\n${design}\nreturn plan;\n})();\n`;
  out += `__app.mountPlan(__plan);\n`;
  return [...hoisted].join('\n') + '\n' + out;
}

async function main() {
  const args = process.argv.slice(2);
  const designPath = resolve(args.find(a => !a.startsWith('--')) || '');
  if (!designPath.endsWith('.mjs')) { console.error('usage: node scripts/build.mjs path/to/design.mjs [--out index.html] [--units imperial]'); process.exit(2); }
  const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
  const out = resolve(opt('out') || join(dirname(designPath), 'index.html'));
  const mod = await import(pathToFileURL(designPath).href + '?t=' + Date.now());
  const plan = mod.plan || mod.default;
  const { derive } = await import(pathToFileURL(join(KIT, 'derive.mjs')).href);
  const { pageHtml, PAGE_CSS } = await import(pathToFileURL(join(KIT, 'page.mjs')).href);
  const { guideHtml } = await import(pathToFileURL(join(KIT, 'guide.mjs')).href);
  const d = derive(plan, {}, opt('units') || plan.units || 'metric');
  const html = pageHtml(d, { script: bundle(designPath) });
  writeFileSync(out, html);
  // the guide sits next to the page: "How to read this plan", figures from this plan
  writeFileSync(join(dirname(out), 'guide.html'), guideHtml(d, { pageCss: PAGE_CSS, back: basename(out) }));
  for (const c of d.checks) console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}: ${c.value}`);
  const bad = d.checks.filter(c => !c.pass);
  console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB) · ${d.model.members.length} members, ${d.pieces.length} piece marks, ${d.model.steps.length} steps · ${bad.length ? bad.length + ' FAILING checks: ' + bad.map(c => c.name).join('; ') : 'all ' + d.checks.length + ' checks pass'}`);
  if (basename(out) !== 'index.html') console.log('note: name the page index.html when it is the plan\'s main page');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
