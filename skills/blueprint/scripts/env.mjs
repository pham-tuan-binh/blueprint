// What the scripts need from the machine, found the same way everywhere, so
// `blueprint doctor` and `blueprint capture` never disagree.
//
// The kit itself needs only Node.js 20+. The browser check needs Playwright and a
// Chromium it can launch; pdftoppm (poppler) is optional and only turns the
// printed pack into PNGs.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const NODE_MIN = 20;
export const nodeMajor = () => +process.versions.node.split('.')[0];

const sh = cmd => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };

// Playwright from this folder, the project, NODE_PATH or the global npm root
export function findPlaywright() {
  const require = createRequire(import.meta.url);
  const roots = [null, process.cwd(), ...(process.env.NODE_PATH || '').split(':').filter(Boolean), sh('npm root -g')].filter(r => r !== '');
  for (const r of roots) {
    try { return r ? createRequire(join(r, 'noop.js'))('playwright') : require('playwright'); } catch { /* next */ }
    if (r) try { return require(join(r, 'playwright')); } catch { /* next */ }
  }
  return null;
}

// Chromium: Playwright's own first, then any we know of
const CANDIDATES = () => [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].filter(p => p && existsSync(p));
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export async function launchChromium(pw) {
  const errors = [];
  for (const executablePath of [undefined, ...CANDIDATES()]) {
    try { return await pw.chromium.launch({ args: GL, ...(executablePath ? { executablePath } : {}) }); }
    catch (e) { errors.push(`${executablePath || 'playwright default'}: ${e.message.split('\n')[0]}`); }
  }
  const err = new Error('no Chromium could be launched\n  ' + errors.join('\n  '));
  err.fix = 'npx playwright install chromium   (or set CHROMIUM_PATH to a Chrome/Chromium binary)';
  throw err;
}

export const PLAYWRIGHT_FIX = 'npm i -g playwright && npx playwright install chromium   (or npm i playwright in the project)';
export const hasPdftoppm = () => !!sh(process.platform === 'win32' ? 'where pdftoppm' : 'command -v pdftoppm');
