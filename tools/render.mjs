// Pictures of a plan's 3D model, for the site's cards and the README. Opens a
// built page in Chromium and takes viewer.picture(): the 3/4 view on a clear
// background, cropped to the model with a margin.
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'skills/blueprint');
const { findPlaywright, launchChromium } = await import(pathToFileURL(join(SKILL, 'scripts/env.mjs')).href);

// a browser, or null with the reason printed
export async function browserOrNull(why) {
  const pw = findPlaywright();
  if (!pw) { console.warn(`${why}: playwright not found`); return null; }
  try { return await launchChromium(pw); } catch (e) { console.warn(`${why}: ${e.message.split('\n')[0]}`); return null; }
}

// PNG bytes of the model in the built page at `file`, or null if it drew nothing
export async function modelPng(page, file, { size = 900, margin = 24 } = {}) {
  await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__blueprint?.d, null, { timeout: 15000 });
  await page.evaluate(s => { const v = document.querySelector('#viewer'); v.style.width = s + 'px'; v.style.height = s + 'px'; }, size);
  await page.waitForTimeout(800);
  const png = await page.evaluate(async m => {
    const img = new Image();
    img.src = window.__blueprint.picture();
    await img.decode();
    const cv = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (px[(y * cv.width + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return null;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const out = Object.assign(document.createElement('canvas'), { width: w + 2 * m, height: h + 2 * m });
    out.getContext('2d').drawImage(cv, x0, y0, w, h, m, m, w, h);
    return out.toDataURL('image/png');
  }, margin);
  return png && Buffer.from(png.split(',')[1], 'base64');
}
