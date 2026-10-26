#!/usr/bin/env node
// The one command an agent runs. Every other script is reached through it.
//
//   node <skill>/scripts/blueprint.mjs <command> [args]
//
//   doctor                      what this machine has and what to install (run it first)
//   examples                    the example plans, with what each one shows
//   new <id> [--from <example>] [--dir plans] [--name "Welding cart"]
//                               start plans/<id>/design.mjs from the closest example
//   build <design.mjs> [--out index.html] [--units imperial]
//                               the standalone page, and every check with its value
//   audit <design.mjs> [--samples 40] [--verbose]
//                               every check at every size the fields allow: "audit passed"
//   capture <index.html> [--out dir] [--pdf] [--hash "a=1&b=2"]
//                               the page in headless Chromium, with screenshots: "capture passed"
//   check <design.mjs> [--hash "a=1"]... [--no-browser]
//                               build, audit and capture --pdf in one go (plus one capture per
//                               --hash, into shots/<hash>): "check passed"
//   test                        the frame solver against textbook beams
//
// Exit codes: 0 passed, 1 a check failed (fix the design), 2 bad usage or the machine
// is missing something (run doctor). Paths are relative to where you run it.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NODE_MIN, nodeMajor, findPlaywright, launchChromium, hasPdftoppm, PLAYWRIGHT_FIX } from './env.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, '..');
const EXAMPLES = join(SKILL, 'examples');
const [cmd, ...rest] = process.argv.slice(2);
const pos = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && !['--pdf', '--verbose', '--no-browser'].includes(rest[i - 1])));
const opt = (k, def) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : def; };
const opts = k => rest.flatMap((a, i) => (a === '--' + k ? [rest[i + 1]] : []));
// relative when it is near, absolute when the skill lives far away (~/.claude/skills/...)
const rel = p => { const r = relative(process.cwd(), p) || '.'; return r.startsWith('../..') ? p : r; };

function usage(code = 2) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1).filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n').split('\n\nExit')[0]);
  process.exit(code);
}
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };
const run = (script, args) => spawnSync(process.execPath, [join(HERE, script), ...args], { stdio: 'inherit' }).status ?? 1;
const needFile = (f, ext, what) => {
  if (!f) die(`missing ${what}. Usage: node ${rel(fileURLToPath(import.meta.url))} ${cmd} <${what}>`);
  if (!f.endsWith(ext)) die(`${f}: expected a ${ext} file (${what})`);
  if (!existsSync(f)) die(`${f}: not found`);
  return f;
};

// ---------------------------------------------------------------- doctor
async function doctor() {
  let bad = 0;
  const row = (ok, name, detail, fix) => {
    console.log(`  ${ok === true ? '✓' : ok === null ? '·' : '✗'} ${name}${detail ? ': ' + detail : ''}`);
    if (ok === false && fix) console.log(`      fix: ${fix}`);
    if (ok === false) bad++;
  };
  console.log(`blueprint skill at ${SKILL}`);
  row(nodeMajor() >= NODE_MIN, 'Node.js', `${process.versions.node} (needs ${NODE_MIN}+)`, 'install Node.js 20 or newer: https://nodejs.org');
  try {
    const { derive } = await import(pathToFileURL(join(SKILL, 'kit/derive.mjs')).href);
    const { plan } = await import(pathToFileURL(join(EXAMPLES, 'shelf-rack/design.mjs')).href);
    const d = derive(plan, {}, 'metric');
    row(d.checks.every(c => c.pass), 'kit', `the shelf-rack example derives, ${d.checks.length} checks pass`);
  } catch (e) { row(false, 'kit', e.message.split('\n')[0], 'the skill folder is incomplete: copy all of skills/blueprint/ again'); }
  const pw = findPlaywright();
  row(!!pw, 'Playwright', pw ? 'found' : 'not found (needed by capture and check)', PLAYWRIGHT_FIX);
  if (pw) {
    try { const b = await launchChromium(pw); row(true, 'Chromium', b.version()); await b.close(); }
    catch (e) { row(false, 'Chromium', e.message.split('\n')[0], e.fix); }
  }
  const pdf = hasPdftoppm();
  row(pdf || null, 'pdftoppm', pdf ? 'found' : 'optional, not found: the printed pack is still checked, its pages are not turned into PNGs (apt install poppler-utils / brew install poppler)');
  console.log(bad ? `\ndoctor: ${bad} to fix (without a browser, run check with --no-browser and say the page was not opened)` : '\ndoctor: ready');
  return bad ? 2 : 0;
}

// ---------------------------------------------------------------- examples
async function loadPlan(file) {
  const mod = await import(pathToFileURL(resolve(file)).href + '?t=' + Date.now());
  return mod.plan || mod.default;
}
const exampleIds = () => readdirSync(EXAMPLES).filter(d => existsSync(join(EXAMPLES, d, 'design.mjs')));

async function examples() {
  for (const id of exampleIds()) {
    const f = join(EXAMPLES, id, 'design.mjs');
    const plan = await loadPlan(f);
    const lines = readFileSync(f, 'utf8').split('\n').length;
    console.log(`${id}  (${lines} lines, ${plan.params.length} fields)\n  ${plan.name}. ${plan.summary}\n  ${rel(f)}\n`);
  }
  console.log(`start from one: node ${rel(fileURLToPath(import.meta.url))} new <id> --from <example>`);
  return 0;
}

// ---------------------------------------------------------------- new
async function scaffold() {
  const id = pos[0];
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) die('usage: new <id> [--from <example>] [--dir plans] [--name "Name"]   (id: lower-case words joined by -, e.g. welding-cart)');
  const from = opt('from', 'shelf-rack');
  if (!exampleIds().includes(from)) die(`no example "${from}". Examples: ${exampleIds().join(', ')}`);
  const dir = resolve(opt('dir', 'plans'), id), file = join(dir, 'design.mjs');
  if (existsSync(file)) die(`${rel(file)} already exists; edit it instead`);
  const name = opt('name', id.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase()));
  const short = name.split(' ').slice(-2).join(' ').replace(/^./, c => c.toUpperCase());
  let src = readFileSync(join(EXAMPLES, from, 'design.mjs'), 'utf8');
  const q = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  src = src.replace(/^(\s*id:\s*)'[^']*'/m, `$1${q(id)}`)
    .replace(/^(\s*name:\s*)'[^']*'/m, `$1${q(name)}`)
    .replace(/^(\s*short:\s*)'[^']*'/m, `$1${q(short)}`)
    .replace(/^(\s*version:\s*)'[^']*'/m, `$1'1'`)
    .replace(/^\s*author:\s*\{[^}]*\},?\n/m, '');          // the example's designer is not this plan's
  const head = `// ${name}.\n// STARTED FROM examples/${from}: everything below is that plan. Rewrite the header,\n// summary, params, model and steps for this one; keep only the shape. Delete this note.\n//\n`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, head + src);
  console.log(`wrote ${rel(file)} (from examples/${from})
next:
  1. rewrite it for the thing you are planning (references/model.md has the schema)
  2. node ${rel(fileURLToPath(import.meta.url))} check ${rel(file)}`);
  return 0;
}

// ---------------------------------------------------------------- check
function check() {
  const design = needFile(pos[0], '.mjs', 'design.mjs');
  const dir = dirname(resolve(design)), page = join(dir, 'index.html'), shots = join(dir, 'shots');
  const steps = [['build', () => run('build.mjs', [design, '--out', page])], ['audit', () => run('audit.mjs', [design])]];
  const browser = !rest.includes('--no-browser');
  if (browser) {
    steps.push(['capture', () => run('capture.mjs', [page, '--out', shots, '--pdf'])]);
    for (const h of opts('hash')) {
      const sub = join(shots, h.replace(/^#/, '').replace(/[^\w.-]+/g, '_'));
      steps.push([`capture ${h}`, () => run('capture.mjs', [page, '--out', sub, '--hash', h])]);
    }
  }
  for (const [name, fn] of steps) {
    console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`);
    const code = fn();
    if (code !== 0) {
      console.log(`\ncheck FAILED at ${name}${code === 2 ? ' (the machine is missing something: run doctor)' : ': fix the design, not the check, and run check again'}`);
      return code;
    }
  }
  console.log(`\npage   ${rel(page)}`);
  if (browser) console.log(`shots  ${rel(shots)}/  (read every PNG, then go through references/verify.md)`);
  else console.log('the page was NOT opened in a browser (--no-browser): say so when you deliver');
  console.log('check passed');
  return 0;
}

// ---------------------------------------------------------------- dispatch
const passthrough = (script, ext, what) => () => { needFile(pos[0], ext, what); return run(script, rest); };
const COMMANDS = {
  doctor, examples, new: scaffold, check,
  build: passthrough('build.mjs', '.mjs', 'design.mjs'),
  audit: passthrough('audit.mjs', '.mjs', 'design.mjs'),
  capture: passthrough('capture.mjs', '.html', 'index.html'),
  test: () => run('test-fea.mjs', []),
};
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') usage(cmd ? 0 : 2);
if (!COMMANDS[cmd]) { console.error(`unknown command "${cmd}"\n`); usage(); }
if (nodeMajor() < NODE_MIN && cmd !== 'doctor') die(`Node.js ${NODE_MIN}+ is needed (this is ${process.versions.node})`);
process.exit(await COMMANDS[cmd]());
