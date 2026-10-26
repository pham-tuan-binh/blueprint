// The page shell for a build pack: one standalone HTML file. The build script
// renders every section once in Node (so the file reads and prints without
// JavaScript), then the inlined runtime takes over and re-renders on every input.
import { esc } from './core.mjs';
import { factsHtml, checksHtml, bomHtml, drawingsHtml, legendHtml, orderHtml, stepHtml, cutListHtml, paramsSummary } from './pack.mjs';
import { SHOP_CSS } from './shop.mjs';

export const PAGE_CSS = `
:root{--paper:#fbfbfa;--ink:#16181b;--ink2:#3a3f46;--muted:#666d75;--line:#d7dade;--th:#f0f1f2;--face:#e1e4e7;--now:#4a4f57;--old:#e6e8eb;--oldline:#a9afb6;--lit:#d23f45;--okc:#1d6b3a;
--sans:"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#141416;--ink:#ecebe8;--ink2:#c9c8c4;--muted:#9a9a96;--line:#34353a;--th:#1d1e21;--face:#3a3c40;--now:#c9ccd0;--old:#26272a;--oldline:#56585d;--lit:#ef6a6f;--okc:#6fcf8f;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#141416;--ink:#ecebe8;--ink2:#c9c8c4;--muted:#9a9a96;--line:#34353a;--th:#1d1e21;--face:#3a3c40;--now:#c9ccd0;--old:#26272a;--oldline:#56585d;--lit:#ef6a6f;--okc:#6fcf8f;color-scheme:dark}
*{box-sizing:border-box}[hidden]{display:none!important}html{scroll-padding-top:64px}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 var(--sans);-webkit-text-size-adjust:100%}
a{color:inherit}code{font:13px var(--mono)}.muted{color:var(--muted)}.pad{padding:16px}
.top{position:sticky;top:0;z-index:10;background:var(--paper);border-bottom:1px solid var(--line)}
.top-in{max-width:1080px;margin:0 auto;padding:8px 16px;display:flex;gap:14px;align-items:center}
.brand{font-weight:700;text-decoration:none;white-space:nowrap}
.toc{display:flex;gap:14px;overflow-x:auto;flex:1;scrollbar-width:none}.toc a{text-decoration:none;white-space:nowrap;color:var(--ink2)}.toc a:hover{color:var(--ink)}
.seg{display:inline-flex;border:1.5px solid var(--ink)}.seg button{font:600 13px var(--sans);background:none;color:var(--ink);border:0;padding:5px 10px;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
.btn{font:600 14px var(--sans);background:none;color:var(--ink);border:1.5px solid var(--ink);padding:5px 12px;cursor:pointer;white-space:nowrap}
.btn:hover,.seg button:hover{box-shadow:2px 2px 0 var(--ink)}
main{max-width:1080px;margin:0 auto;padding:24px 16px 64px}
.kicker{font:12px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0}
h1{font-size:34px;line-height:1.1;margin:6px 0 8px;letter-spacing:-.01em}.lede{max-width:70ch;margin:0 0 16px;color:var(--ink2)}
h2{font-size:23px;margin:48px 0 10px;padding-top:14px;border-top:2px solid var(--ink);display:flex;gap:12px;align-items:baseline}
.secn{font:400 15px var(--mono);color:var(--muted)}h3{font-size:18px;margin:26px 0 6px}h4{font-size:15px;margin:20px 0 6px}
p,li{max-width:75ch}
.status{display:inline-block;font:600 13px var(--mono);padding:3px 10px;border:1.5px solid currentColor;margin:0 0 12px}.status.ok{color:var(--okc)}.status.bad{color:var(--lit)}
.warn{color:var(--lit);font-weight:600}
.split{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:20px;align-items:start}
@media (max-width:880px){.split{grid-template-columns:1fr}}
.viewer-box{position:relative;border:1.5px solid var(--ink);aspect-ratio:4/3;background:var(--paper)}
.viewer{position:absolute;inset:0}.viewer canvas{display:block}
.cams{position:absolute;left:10px;bottom:10px;display:flex;border:1.5px solid var(--ink);background:var(--paper)}
.cams button{font:600 13px var(--sans);background:none;color:var(--ink);border:0;border-right:1px solid var(--line);padding:6px 11px;cursor:pointer}.cams button:last-child{border-right:0}
.cams button:hover{background:var(--th)}
.step-badge{position:absolute;top:10px;left:10px;right:10px;display:flex;gap:10px;align-items:center;justify-content:space-between;background:var(--paper);border:1.5px solid var(--lit);padding:6px 10px;font-size:14px}
.hint{font:12px var(--mono);color:var(--muted);margin:6px 0 0}
.pick{font-size:14px;margin:6px 0 0}
.viewer-ctl{display:flex;gap:16px;flex-wrap:wrap;margin:8px 0 0;font-size:14px}.viewer-ctl label{display:flex;gap:6px;align-items:center}
.size{border:1.5px solid var(--ink);padding:14px 16px 16px;box-shadow:4px 4px 0 var(--ink)}
.size h2{margin:0 0 4px;padding:0;border:0;font-size:19px}
.size fieldset{border:0;padding:0;margin:10px 0 0}.size legend{font:12px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:0;margin:0 0 4px}
.field{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}
.field>span:first-child{font-weight:600;font-size:14px}.field small{grid-column:1/-1;color:var(--muted);font:12px var(--mono)}
.inp{display:inline-flex;align-items:center;border:1.5px solid var(--ink);background:var(--paper)}
.inp input{width:96px;font:600 15px var(--mono);border:0;background:none;color:var(--ink);padding:5px 6px;text-align:right}
.inp i{font:13px var(--mono);font-style:normal;color:var(--muted);padding:0 8px 0 2px}
.field select{font:600 14px var(--sans);border:1.5px solid var(--ink);background:var(--paper);color:var(--ink);padding:5px 6px;max-width:190px}
.field.check{grid-template-columns:auto 1fr;justify-content:start}.field.check input{width:18px;height:18px;margin:0}
input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--lit);outline-offset:2px}
.size-act{display:flex;gap:8px;margin:12px 0 0;flex-wrap:wrap}
.built{font:12px var(--mono);color:var(--muted);margin:10px 0 0}
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:0;margin:20px 0 0;border-top:1px solid var(--line)}
.facts div{padding:8px 12px 8px 0;border-bottom:1px solid var(--line)}.facts dt{font:12px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.facts dd{margin:2px 0 0;font-weight:700;font-size:17px}.facts small{display:block;font-weight:400;font-size:12px;color:var(--muted)}
.doc{border-collapse:collapse;font:13px/1.45 var(--mono);margin:8px 0;min-width:100%}
.doc td,.doc th{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}.doc .n{text-align:right;white-space:nowrap}
.doc th{background:var(--th);font-weight:700}
.doc small{display:block;color:var(--muted);font:12px var(--sans)}
.checks td:nth-child(2){font-family:var(--sans);font-weight:600}.checks td:first-child{font-weight:700;width:2em;text-align:center}
.checks tr.ok td:first-child{color:var(--okc)}.checks tr.bad td{color:var(--lit)}
.legend th{text-align:left;white-space:nowrap;width:1%}.legend td{text-align:left}
.wrap{overflow-x:auto;max-width:100%}
.sheet{display:grid;gap:0;border:1px solid var(--line);margin:8px 0}.sheet figure{margin:0;min-width:0}.sheet svg{border:0!important}
.sheet .v-top{grid-column:1;grid-row:1}.sheet .v-front{grid-column:1;grid-row:2}.sheet .v-side{grid-column:2;grid-row:2}.sheet.one{grid-template-columns:1fr;max-width:620px}
figure{margin:0}
.views svg,.piece-list svg,figure>svg{border:1px solid var(--line);width:100%;height:auto;display:block}
.piece-list{display:grid;gap:14px}.plate-fig figcaption{font-size:13px;color:var(--ink2);padding:6px 2px 0}.plate-fig figcaption p{margin:2px 0;max-width:none}
.phases{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 24px}.phases h4{margin:8px 0 0}.phases ol{margin:4px 0;padding-left:1.6em}
.step{padding-top:10px}.step-h h3{display:flex;gap:10px;align-items:baseline;margin-bottom:0}.sn{font:400 .9em var(--mono);color:var(--muted)}.step-h p{margin:2px 0 8px}
.tasks{list-style:none;padding:0}.tasks li{display:flex;gap:8px;align-items:flex-start;margin:4px 0}.tasks input{margin-top:5px;width:16px;height:16px;flex:none}
.tasks li:has(input:checked) label{color:var(--muted);text-decoration:line-through}
.gate{border:1.5px solid var(--ink);padding:6px 12px;max-width:none}.note{border-left:2px solid var(--muted);padding:4px 12px;color:var(--ink2);max-width:none}
details.sheets{margin:12px 0;border:1.5px solid var(--ink);padding:6px 12px}details.sheets summary{cursor:pointer;font-weight:600}
.linkish{font:inherit;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer}
ul.plain{padding-left:1.2em}ul.cols{columns:2;max-width:none}
.foot{max-width:1080px;margin:0 auto;padding:24px 16px 48px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
@media (max-width:600px){h1{font-size:27px}.toc{display:none}.inp input{width:84px}ul.cols{columns:1}}
${SHOP_CSS}
@media print{
  :root{--paper:#fff;--ink:#000;--ink2:#222;--muted:#555;--line:#bbb;--th:#eee;--face:#e4e4e4;--now:#444;--old:#eee;--oldline:#aaa;--lit:#000;color-scheme:light}
  .top,.viewer-box,.hint,.viewer-ctl,.pick,.size-act,#size-form,.cams,[data-show-step],[data-show-wrap]{display:none!important}
  .split{display:block}.size{box-shadow:none;border:1px solid #000}
  .step{break-before:page}.piece-list svg,figure,.sheet,table{break-inside:avoid}h2,h3,h4,.step-h{break-after:avoid}details.sheets{border:0;padding:0}
  details.sheets>summary{list-style:none;font-weight:700}a{text-decoration:none}main{padding-top:0}
}
`;

export function pageHtml(d, { script = '', title, description } = {}) {
  const plan = d.plan, steps = d.model.steps;
  const t = title || `${plan.name} build plan`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t)}</title>
<meta name="description" content="${esc(description || plan.summary || '')}">
<style>${PAGE_CSS}</style>
</head>
<body>
<header class="top"><div class="top-in">
  <a class="brand" href="#top">${esc(plan.short || plan.name)}</a>
  <nav class="toc" aria-label="Sections">
    <a href="#size">Size</a><a href="#checks">Checks</a><a href="#bom">Materials</a><a href="#drawings">Drawings</a><a href="#legend">Legend</a><a href="#steps">Steps</a><a href="#cutlist">Cut list</a>
  </nav>
  <div class="seg" role="group" aria-label="Units"><button type="button" data-units="metric" aria-pressed="${!d.units.imperial}">mm</button><button type="button" data-units="imperial" aria-pressed="${d.units.imperial}">in</button></div>
  <button type="button" class="btn" id="print">Print</button>
</div></header>
<main id="top">
  <p class="kicker">Build plan${plan.version ? ' · v' + esc(plan.version) : ''}</p>
  <h1>${esc(plan.name)}</h1>
  <p class="lede">${esc(plan.summary || '')}</p>
  <p id="status" class="status ${d.ok ? 'ok' : 'bad'}">${d.ok ? `✓ All ${d.checks.length} checks pass` : `✗ ${d.checks.filter(c => !c.pass).length} check(s) failing`}</p>
  <div class="split" id="model">
    <div>
      <div class="viewer-box">
        <div class="viewer" id="viewer" role="img" aria-label="3D model. Drag to orbit, Ctrl and scroll to zoom, click a part to identify it."></div>
        <div class="cams" role="group" aria-label="Camera"><button type="button" data-cam="iso">3/4</button><button type="button" data-cam="front">Front</button><button type="button" data-cam="side">Side</button><button type="button" data-cam="top">Top</button></div>
        <div class="step-badge" id="step-badge" hidden><span id="step-badge-text"></span><button type="button" class="linkish" id="step-badge-off">Show everything</button></div>
      </div>
      <p class="hint">Drag: orbit · Ctrl+scroll / pinch: zoom · click: identify a part</p>
      <div class="viewer-ctl"><label for="show-stress"><input type="checkbox" id="show-stress"> Show stress (red = least margin)</label></div>
      <div class="pick" id="pick" hidden></div>
    </div>
    <section class="size" id="size" aria-labelledby="size-h">
      <h2 id="size-h">Make it yours</h2>
      <p class="muted" style="margin:0">Change a number and the whole plan, drawings, cut list and checks follow.</p>
      <form id="size-form" onsubmit="return false"></form>
      <div class="size-act"><button type="button" class="btn" id="reset">Reset</button><button type="button" class="btn" id="copy-link">Copy link</button></div>
      <div id="notes"></div>
      <p class="built" id="built-for">${esc(paramsSummary(d))}</p>
    </section>
  </div>
  <dl class="facts" id="facts">${factsHtml(d)}</dl>
  <section id="checks"><h2><span class="secn">1</span>Checks</h2><div id="checks-body">${checksHtml(d)}</div></section>
  <section id="bom"><h2><span class="secn">2</span>Materials</h2><div id="bom-body">${bomHtml(d)}</div></section>
  <section id="drawings"><h2><span class="secn">3</span>Drawings</h2><p class="muted">Overall dimensions. Every number on this page is from the same model as the 3D view.</p><div id="drawings-body">${drawingsHtml(d)}</div></section>
  <section id="legend"><h2><span class="secn">4</span>Legend</h2><div id="legend-body">${legendHtml(d)}</div></section>
  <section id="order"><h2><span class="secn">5</span>Order</h2><div id="order-body">${orderHtml(d)}</div></section>
  <section id="steps"><h2><span class="secn">6</span>Steps</h2><p class="muted">Ticks save on this device. "Show in 3D" shows the build after that step, the new parts lit.</p><div id="steps-body">${steps.map(st => stepHtml(d, st, { interactive: true })).join('')}</div></section>
  <section id="cutlist"><h2><span class="secn">7</span>Cut list</h2><div id="cutlist-body">${cutListHtml(d)}</div></section>
</main>
<footer class="foot"><p>${esc(plan.footer || 'Generated by the blueprint skill. Check every dimension against your own stock before you cut, wear eye and hand protection, and load-test the build gently before trusting it.')}</p></footer>
<script type="module">
${script}
</script>
</body>
</html>
`;
}
