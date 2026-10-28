// The browser of the app the kit runs inside (e.g. Hey Muse), reached over a local
// socket, shaped like the slice of Playwright that capture.mjs uses. With it
// the browser check needs no Playwright and no Chromium download: the host
// already is Chromium. Used when BLUEPRINT_BROWSER_HOST names the socket.
import { connect } from 'node:net';
import { copyFileSync } from 'node:fs';

export async function connectHost(socketPath) {
  const sock = connect(socketPath);
  await new Promise((ok, fail) => { sock.once('connect', ok); sock.once('error', fail); });
  let next = 0, buf = '';
  const waiting = new Map();
  const listeners = new Map(); // page id -> { console: [], pageerror: [] }
  sock.on('data', (d) => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      const m = JSON.parse(line);
      if (m.event) {
        const l = listeners.get(m.page);
        if (m.event === 'console') for (const fn of l?.console ?? []) fn({ type: () => m.type, text: () => m.text });
        if (m.event === 'pageerror') for (const fn of l?.pageerror ?? []) fn(new Error(m.message));
        continue;
      }
      const w = waiting.get(m.id);
      if (!w) continue;
      waiting.delete(m.id);
      m.ok ? w.ok(m.value) : w.fail(new Error(m.error));
    }
  });
  const call = (op, args = {}) => new Promise((ok, fail) => {
    const id = ++next;
    waiting.set(id, { ok, fail });
    sock.write(JSON.stringify({ id, op, ...args }) + '\n');
  });
  const src = (fn) => (typeof fn === 'function' ? fn.toString() : `() => (${fn})`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function page(id) {
    listeners.set(id, { console: [], pageerror: [] });
    const evaluate = (fn, arg) => call('evaluate', { page: id, fn: src(fn), arg: arg === undefined ? null : arg });
    const element = (sel) => ({
      screenshot: (o = {}) => call('elementShot', { page: id, sel, path: o.path }),
      click: () => call('click', { page: id, sel }),
    });
    return {
      on(event, fn) { listeners.get(id)[event]?.push(fn); },
      goto: (url) => call('goto', { page: id, url }),
      evaluate,
      waitForTimeout: sleep,
      async waitForFunction(fn, arg, o = {}) {
        const until = Date.now() + (o.timeout ?? 30000);
        for (;;) {
          // only truthiness crosses the socket: the value itself may not serialize
          if (await call('evaluate', { page: id, fn: `(...a) => !!(${src(fn)})(...a)`, arg: arg === undefined ? null : arg })) return true;
          if (Date.now() > until) throw new Error('waitForFunction timed out');
          await sleep(100);
        }
      },
      addStyleTag: (o) => call('addStyle', { page: id, css: o.content }),
      async $(sel) { return (await call('exists', { page: id, sel })) ? element(sel) : null; },
      $eval: (sel, fn) => call('evalOn', { page: id, sel, fn: src(fn), all: false }),
      $$eval: (sel, fn) => call('evalOn', { page: id, sel, fn: src(fn), all: true }),
      fill: (sel, value) => call('fill', { page: id, sel, value }),
      press: (sel, key) => call('press', { page: id, sel, key }),
      click: (sel) => call('click', { page: id, sel }),
      screenshot: (o = {}) => call('screenshot', { page: id, path: o.path, fullPage: !!o.fullPage }),
      emulateMedia: (o) => call('media', { page: id, media: o.media ?? null }),
      pdf: (o) => call('pdf', { page: id, path: o.path, margin: o.margin ?? {}, printBackground: !!o.printBackground }),
      async waitForEvent(name, o = {}) {
        if (name !== 'download') throw new Error(`host browser: no ${name} event`);
        const d = await call('download', { page: id, timeout: o.timeout ?? 30000 });
        return { suggestedFilename: async () => d.filename, saveAs: async (p) => copyFileSync(d.path, p) };
      },
      close: () => call('closePage', { page: id }),
    };
  }

  return {
    version: () => 'Hey Muse (Chromium)',
    async newPage(o = {}) { return page(await call('newPage', { viewport: o.viewport ?? { width: 1280, height: 720 }, colorScheme: o.colorScheme ?? null })); },
    async close() { await call('closeAll').catch(() => {}); sock.end(); },
  };
}
