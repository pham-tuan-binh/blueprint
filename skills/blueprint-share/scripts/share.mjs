#!/usr/bin/env node
// Put a finished blueprint plan into a clone of pham-tuan-binh/blueprint, prove it
// passes there, and write the pull request text.
//
//   node <skill>/scripts/share.mjs <path/to/design.mjs> --repo <clone of the repo> [--update]
//
// It copies the one file a plan needs to <repo>/plans/<id>/design.mjs, runs the
// audit with the repo's own kit (what CI runs), builds the site to make sure the
// plan gets its page and its card, and writes the PR body. It never commits,
// pushes or opens anything: it prints those commands for you to run.
//
// Exit codes: 0 ready, 1 the plan fails in the repo (fix it), 2 bad usage or setup.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const UPSTREAM = 'pham-tuan-binh/blueprint';
const SITE = 'https://pham-tuan-binh.github.io/blueprint';
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const src = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--repo'));
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };
const say = msg => console.log(msg);

if (!src) die('usage: node scripts/share.mjs <path/to/design.mjs> --repo <clone of the blueprint repo> [--update]');
const file = resolve(src);
if (!existsSync(file) || !file.endsWith('.mjs')) die(`${src}: not a design.mjs file`);

// ---------------------------------------------------------------- the repo
const repo = resolve(opt('repo') || '.');
const isRepo = r => existsSync(join(r, 'tools/site.mjs')) && existsSync(join(r, 'skills/blueprint/scripts/blueprint.mjs'));
if (!isRepo(repo)) die(`${repo} is not a clone of ${UPSTREAM}.
Fork and clone it first, then pass --repo:
  gh repo fork ${UPSTREAM} --clone        # or fork on github.com and git clone your fork
  node ${relative(process.cwd(), process.argv[1])} ${src} --repo blueprint`);

// ---------------------------------------------------------------- the plan
const text = readFileSync(file, 'utf8');
if (/^\s*import\s/m.test(text)) die('design.mjs imports something: a plan must be one self-contained file (build(p, k) gets the kit in k)', 1);
if (/STARTED FROM examples\//.test(text)) die('design.mjs still has the "STARTED FROM examples/" note: finish the plan first', 1);
const { plan } = await import(pathToFileURL(file).href);
if (!plan) die('design.mjs has no `export const plan`', 1);
const problems = [];
if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(plan.id || '')) problems.push(`id "${plan.id}": use 3-40 lower-case letters, digits and dashes (welding-cart)`);
if (!plan.name) problems.push('no name');
if (!plan.summary || plan.summary.length < 40) problems.push('summary is missing or too short: it is the description on the gallery card (one or two sentences)');
if (plan.summary?.length > 320) problems.push(`summary is ${plan.summary.length} characters: keep it under 320, it is a card description`);
if (!plan.author?.github) problems.push(`no author: add  author: { github: 'your-github-handle', name: 'Your Name' },  after the summary (the card credits you)`);
else if (!/^[A-Za-z0-9-]{1,39}$/.test(plan.author.github)) problems.push(`author.github "${plan.author.github}" is not a GitHub handle (no @, no URL)`);
if (text.length > 200_000) problems.push(`design.mjs is ${Math.round(text.length / 1024)} KB: a plan is code, not data; keep it under 200 KB`);
if (problems.length) die('fix these in design.mjs, then run this again:\n' + problems.map(p => '  ✗ ' + p).join('\n'), 1);

const dest = join(repo, 'plans', plan.id), destFile = join(dest, 'design.mjs');
const taken = existsSync(destFile) || existsSync(join(repo, 'skills/blueprint/examples', plan.id));
if (taken && !args.includes('--update')) die(`the id "${plan.id}" is already in the repo. Pick another id, or pass --update if you are updating your own plan.`, 1);
if (existsSync(destFile) && args.includes('--update')) {
  const was = readFileSync(destFile, 'utf8').match(/github:\s*'([^']+)'/)?.[1];
  if (was && was !== plan.author.github) die(`plans/${plan.id} is by @${was}, not @${plan.author.github}: pick another id`, 1);
}
const before = existsSync(destFile) ? readFileSync(destFile) : null;
mkdirSync(dest, { recursive: true });
copyFileSync(file, destFile);
// a plan that fails leaves the clone as it was
const undo = () => { if (before) writeFileSync(destFile, before); else rmSync(dest, { recursive: true, force: true }); };
say(`copied to ${relative(process.cwd(), destFile)}`);

// ---------------------------------------------------------------- prove it with the repo's kit
const node = (script, a) => spawnSync(process.execPath, [join(repo, script), ...a], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
say('auditing with the repo\'s kit (what CI runs)…');
const audit = node('skills/blueprint/scripts/blueprint.mjs', ['audit', destFile]);
const tail = (audit.stdout + audit.stderr).trim().split('\n').slice(-12).join('\n');
if (audit.status !== 0) {
  say(tail);
  undo();
  die(`\nthe audit fails with the repo's kit. If it passed with your installed skill, the repo is newer: update the skill (npx skills add ${UPSTREAM}) and fix the plan with it.`, 1);
}
say('  audit passed');
const out = mkdtempSync(join(tmpdir(), 'blueprint-site-'));
const site = node('tools/site.mjs', ['--out', out]);
const built = existsSync(join(out, plan.id, 'index.html')) && readFileSync(join(out, 'index.html'), 'utf8').includes(`href="${plan.id}/"`);
rmSync(out, { recursive: true, force: true });
if (site.status !== 0 || !built) { say((site.stdout + site.stderr).trim().split('\n').slice(-8).join('\n')); undo(); die('\nthe site did not build with this plan in it', 1); }
say('  site builds, with its page and its card');

// ---------------------------------------------------------------- the PR
const { derive } = await import(pathToFileURL(join(repo, 'skills/blueprint/kit/derive.mjs')).href);
const d = derive(plan, {}, plan.units || 'metric'), u = d.units, [lo, hi] = d.bbox;
const size = `${u.len(hi[0] - lo[0])} × ${u.len(hi[1] - lo[1])} × ${u.len(hi[2] - lo[2])}${u.imperial ? '' : ' mm'}`;
const sections = [...new Set(Object.values(d.model.sections).map(s => s.short))].join(', ');
const body = `Adds **${plan.name}** to the plans site.

${plan.summary}

| | |
|---|---|
| Size at the defaults | ${size} |
| Mass | ${u.mass(d.totalKg)} |
| Stock | ${sections}${d.prints?.length ? ` · ${d.prints.length} printed part${d.prints.length > 1 ? 's' : ''}` : ''} |
| Pieces | ${d.model.members.length} (${d.pieces.length} marks) |
| Steps | ${d.model.steps.length} |
| Fields | ${(plan.params || []).map(p => p.label.toLowerCase()).join(', ')} |
| Checks | all ${d.checks.length} pass at the defaults; audit passed at every size the fields allow |

Once merged it appears at ${SITE}/${plan.id}/

- [x] Only \`plans/${plan.id}/design.mjs\` is added
- [x] \`blueprint.mjs audit\` passes with this repo's kit
- [x] The site builds with it

Made with the blueprint skill by @${plan.author.github}.
`;
// inside .git, so it is never committed by accident
const bf = existsSync(join(repo, '.git')) ? join(repo, '.git', `blueprint-pr-${plan.id}.md`) : join(tmpdir(), `blueprint-pr-${plan.id}.md`);
writeFileSync(bf, body);
const branch = `plan/${plan.id}`, title = `${args.includes('--update') && taken ? 'Update' : 'Add'} plan: ${plan.name}`;
say(`
ready. PR text in ${relative(process.cwd(), bf)}
next, from ${relative(process.cwd(), repo) || '.'}:
  git checkout -b ${branch}
  git add plans/${plan.id}/design.mjs
  git commit -m "${title.replace(/"/g, '\\"')}"
  git push -u origin ${branch}
  gh pr create --repo ${UPSTREAM} --head ${plan.author.github}:${branch} --title "${title.replace(/"/g, '\\"')}" --body-file ${bf}
(without gh: open your fork on github.com, "Contribute" > "Open pull request", and paste the PR text)`);
