// The page shell for a build pack: one standalone HTML file. The build script
// renders every section once in Node (so the file reads and prints without
// JavaScript), then the inlined runtime takes over and re-renders on every input.
import { esc } from './core.mjs';
import { checksHtml, bomHtml, drawingsHtml, legendHtml, orderHtml, stepHtml, cutListHtml, paramsSummary, contentsHtml } from './pack.mjs';
import { SHOP_CSS } from './shop.mjs';
import { Q_CSS, guideCta } from './guide.mjs';

// Light paper only, like a printed drawing: no dark theme, whatever the device prefers.
export const PAGE_CSS = `
:root{--paper:#fff;--ink:#14171a;--ink2:#3d4651;--muted:#5b6470;--line:#d5dade;--th:#f2f4f6;--face:#e1e4e7;--now:#4a4f57;--old:#e6e8eb;--oldline:#a9afb6;--lit:#d23f45;--okc:#14171a;
--sans:"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;color-scheme:light}
*{box-sizing:border-box}[hidden]{display:none!important}html{scroll-padding-top:16px;scroll-behavior:smooth}@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 var(--sans);-webkit-text-size-adjust:100%;-webkit-font-smoothing:antialiased}
a{color:inherit}code{font:.88em var(--mono);background:var(--th);padding:.05em .35em}.muted{color:var(--muted)}.pad{padding:16px}
main{max-width:1000px;margin:0 auto;padding:24px max(16px,env(safe-area-inset-right)) 80px max(16px,env(safe-area-inset-left))}
.back{display:inline-block;text-decoration:none;color:var(--muted);font-size:14px;margin:0 0 8px}.back:hover{color:var(--ink)}
h1{font-size:40px;line-height:1.15;margin:24px 0 32px;letter-spacing:-.01em;text-wrap:balance}.lede{font-size:18px;max-width:68ch;margin:0 0 24px}
.sec{margin-top:144px}.sec>h2{display:flex;align-items:baseline;gap:14px;font-size:28px;line-height:1.2;margin:0 0 24px}
.secn{font:400 .85em var(--mono);color:var(--muted)}h3{font-size:19px;margin:40px 0 8px}h4{font-size:15px;margin:40px 0 12px}
p,li{max-width:72ch}
.seg{display:inline-flex;border:1.5px solid var(--ink)}.seg button{font:600 13px var(--sans);background:none;color:var(--ink);border:0;padding:5px 10px;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
.btn{font:600 14px var(--sans);background:none;color:var(--ink);border:1.5px solid var(--ink);padding:5px 12px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.btn:hover,.seg button:hover{background:var(--th)}.btn svg{width:15px;height:15px;flex:none}.btn.sm{font-size:12px;padding:3px 8px;font-family:var(--mono)}.dls{display:inline-flex;gap:6px;flex-wrap:wrap}
.warn{font-weight:600}
.contents-h{margin:48px 0 4px;font:600 .72rem var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.contents{list-style:none;margin:0 0 48px;padding:0}.contents li{max-width:none}
.contents a,.contents .crow{display:flex;align-items:baseline;gap:10px;padding:5px 0;color:inherit;text-decoration:none;width:100%;font:inherit;background:none;border:0;cursor:pointer;text-align:left}
.contents .cn{flex:none;width:1.4em;font:400 .9em var(--mono);color:var(--muted)}.contents .ct{flex:0 1 auto;min-width:0;font-weight:600}
.contents .cl{flex:1;min-width:16px;border-bottom:1.5px dotted #9aa5b1;transform:translateY(-4px)}
.contents .cm{flex:0 1 auto;min-width:0;text-align:right;font:.82em var(--mono);color:var(--muted);align-self:center}.contents .cm svg{width:16px;height:16px;display:block}
.contents a:hover .ct,.contents .crow:hover .ct{text-decoration:underline}
.split{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:24px;align-items:start}
@media (max-width:880px){.split{grid-template-columns:1fr}}
.viewer-box{position:relative;border:1px solid var(--line);aspect-ratio:4/3;background:#fbfbfa}
.viewer{position:absolute;inset:0}.viewer canvas{display:block}
.cams{position:absolute;left:12px;bottom:12px;display:flex;border:1px solid var(--ink);background:var(--paper)}
.cams button{font:600 13px var(--sans);background:none;color:var(--ink);border:0;border-right:1px solid var(--line);padding:6px 11px;cursor:pointer}.cams button:last-child{border-right:0}
.cams button:hover{background:var(--th)}
.pick{font-size:14px;margin:8px 0 0}
.viewer-ctl{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0 0;font-size:15px}.viewer-ctl label{display:flex;gap:8px;align-items:center}.viewer-ctl input{accent-color:var(--ink);width:1.05rem;height:1.05rem}
.size{border:1px solid var(--ink);padding:14px 16px 16px}
.size h2{margin:0;padding:0;border:0;font-size:19px}.size-h{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 4px}
.size fieldset{border:0;padding:0;margin:10px 0 0}.size legend{font:600 .72rem var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:0;margin:0 0 4px}
.field{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}
.field>span:first-child{font-weight:600;font-size:14px}.field small{grid-column:1/-1;color:var(--muted);font:12px var(--mono)}
.inp{display:inline-flex;align-items:center;border:1px solid var(--ink);background:var(--paper)}
.inp input{width:96px;font:600 15px var(--mono);border:0;background:none;color:var(--ink);padding:5px 6px;text-align:right}
.inp i{font:13px var(--mono);font-style:normal;color:var(--muted);padding:0 8px 0 2px}
.field select{font:600 14px var(--sans);border:1px solid var(--ink);background:var(--paper);color:var(--ink);padding:5px 6px;max-width:190px}
.field.check{grid-template-columns:auto 1fr;justify-content:start}.field.check input{width:18px;height:18px;margin:0;accent-color:var(--ink)}
input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible,.q:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.size-act{display:flex;gap:8px;margin:12px 0 0;flex-wrap:wrap}
.built{font:12px var(--mono);color:var(--muted);margin:10px 0 0}
.totals{font:14px var(--mono);color:var(--ink2);margin:0 0 8px;max-width:none}
.doc{border-collapse:collapse;font:13px/1.45 var(--mono);margin:8px 0;min-width:100%}
.doc td,.doc th{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}.doc .n{text-align:right;white-space:nowrap}
.doc th{background:var(--th);font-weight:700}
.doc small{display:block;color:var(--muted);font:12px var(--sans)}
.checks td:nth-child(2){font-family:var(--sans);font-weight:600}.checks td:first-child{font-weight:700;width:2em;text-align:center}
.checks tr.bad td{color:var(--lit)}
.legend th{text-align:left;white-space:nowrap;width:1%}.legend td{text-align:left}
.wrap{overflow-x:auto;max-width:100%}
.sheet{display:grid;gap:0;border:1px solid var(--line);margin:8px 0}.sheet figure{margin:0;min-width:0}.sheet svg{border:0!important}
.sheet .v-top{grid-column:1;grid-row:1}.sheet .v-front{grid-column:1;grid-row:2}.sheet .v-side{grid-column:2;grid-row:2}.sheet.one{grid-template-columns:1fr;max-width:620px}.sheet.print{max-width:520px}
figure{margin:0}
.views svg,.piece-list svg,figure>svg{border:1px solid var(--line);width:100%;height:auto;display:block}
.piece-list{display:grid;gap:18px}.plate-fig figcaption{font-size:13px;color:var(--ink2);padding:6px 2px 0}.plate-fig figcaption p{margin:2px 0;max-width:none}
.phases{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 24px}.phases h4{margin:8px 0 0}.phases ol{margin:4px 0;padding-left:1.6em}.phases li{margin:2px 0}
.step{margin-top:112px}.step-h{display:flex;align-items:center;gap:24px;margin-bottom:28px}.sn{font:700 64px/1 var(--sans);min-width:1.2em}
.step-h h3{margin:0;font-size:22px}.step-h p{margin:4px 0 0}
.tasks{list-style:none;padding:0;margin:0;display:grid;gap:10px;counter-reset:t}
.tasks li{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;counter-increment:t}
.tasks input{margin:.22rem 0 0}
.tasks label::before{content:counter(t) ". ";font:600 .85rem var(--mono);color:var(--muted)}
.tasks li:has(input:checked) label{color:var(--muted);text-decoration:line-through}
/* square checkboxes, drawn: ink on paper, a tick when done */
input[type=checkbox]{appearance:none;-webkit-appearance:none;flex:none;width:1.1rem;height:1.1rem;border:1.5px solid var(--ink);border-radius:0;background:var(--paper);display:inline-grid;place-content:center;cursor:pointer}
input[type=checkbox]:checked{background:var(--ink)}
input[type=checkbox]:checked::after{content:"";width:.55rem;height:.28rem;border:2px solid var(--paper);border-top:0;border-right:0;transform:translateY(-1px) rotate(-45deg)}
.gate,.note{display:flex;align-items:center;gap:12px;max-width:none;margin:24px 0}
.ic{flex:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:1.5px solid var(--ink);border-radius:50%;font:700 14px/1 var(--sans)}
.note .ic{background:var(--ink);color:var(--paper)}
/* the steps with a 3D view beside them that follows the step you are reading; on a phone a panel the 3D button opens */
.steps-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,40%);gap:56px;align-items:start;width:min(1280px,calc(100vw - 32px));margin-left:calc(50% - min(640px,50vw - 16px))}
.step-3d{position:sticky;top:24px;margin-top:112px}.step-3d .viewer-box{aspect-ratio:auto;height:calc(100vh - 110px)}
.step-3d-cap{margin:12px 0 0;font-weight:600;white-space:pre}
.toggle-3d{display:none}
@media (max-width:900px){
  .steps-grid{display:block;width:auto;margin-left:0}
  .step-3d{display:none;position:fixed;inset:auto 0 0 0;margin:0;z-index:20;background:var(--paper);border-top:1px solid var(--line);padding:8px max(16px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
  .step-3d .viewer-box{height:36vh}.step-3d-cap{margin-top:6px;font-size:.9rem}
  body.show-3d.in-steps .step-3d{display:block}body.show-3d{padding-bottom:calc(36vh + 64px)}
  .toggle-3d{position:fixed;z-index:21;right:max(16px,env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));width:52px;height:52px;border-radius:50%;border:1.5px solid var(--ink);background:var(--paper);color:var(--ink);font:700 15px var(--sans);cursor:pointer}
  body.in-steps .toggle-3d{display:block}
  body.show-3d .toggle-3d{background:var(--ink);color:var(--paper);bottom:calc(36vh + 72px + env(safe-area-inset-bottom))}
}
details.sheets{margin:40px 0 0}details.sheets summary{cursor:pointer;font-weight:600}details.sheets[open] summary{margin-bottom:12px}
.linkish{font:inherit;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer}
ul.plain{padding-left:1.2em}ul.cols{columns:2;max-width:none}
.foot{max-width:1000px;margin:0 auto;padding:48px 16px;color:var(--muted);font-size:13px}
@media (max-width:600px){h1{font-size:30px}.sec{margin-top:96px}.step{margin-top:80px}.sn{font-size:48px}.inp input{width:84px}ul.cols{columns:1}}
${SHOP_CSS}
${Q_CSS}
@media print{
  :root{--ink:#000;--ink2:#222;--muted:#555;--line:#bbb;--th:#eee;--face:#e4e4e4;--now:#444;--old:#eee;--oldline:#aaa;--lit:#000;color-scheme:light}
  .dls,.back,.seg,.viewer-box,.step-3d,.toggle-3d,.viewer-ctl,.pick,.size-act,#size-form,.cams,.crow{display:none!important}
  .contents{break-after:page}.size>p.muted{display:none}
  .split{display:block}.size{border:1px solid #000}.sec{margin-top:48px}.steps-grid{display:block;width:auto;margin:0}
  .step{break-before:page;margin-top:0}.piece-list svg,figure,.sheet,table{break-inside:avoid}h2,h3,h4,.step-h{break-after:avoid}
  details.sheets>summary{list-style:none;font-weight:700}details::details-content{content-visibility:visible;display:block}a{text-decoration:none}main{padding-top:0}
}
`;

export function pageHtml(d, { script = '', title, description, back = null, guide = 'guide.html' } = {}) {
  const plan = d.plan, steps = d.model.steps;
  const t = title || `${plan.name} build plan`;
  return `<!doctype html>
<html lang="en" style="color-scheme:light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>${esc(t)}</title>
<meta name="description" content="${esc(description || plan.summary || '')}">
<style>${PAGE_CSS}</style>
</head>
<body>
<main id="top">
  ${back ? `<a class="back" href="${esc(back.href)}">← ${esc(back.label)}</a>` : ''}
  <h1>${esc(plan.name)}</h1>
  ${guide ? guideCta(guide) : ''}
  <nav aria-label="Contents" id="contents-body">${contentsHtml(d)}</nav>
  <div class="split" id="model">
    <div>
      <div class="viewer-box">
        <div class="viewer" id="viewer" role="img" aria-label="3D model. Drag to orbit, Ctrl and scroll to zoom, click a part to identify it."></div>
        <div class="cams" role="group" aria-label="Camera"><button type="button" data-cam="iso">3/4</button><button type="button" data-cam="front">Front</button><button type="button" data-cam="side">Side</button><button type="button" data-cam="top">Top</button></div>
      </div>
      <div class="viewer-ctl"><label for="show-stress"><input type="checkbox" id="show-stress"> Show stress (red = least margin)</label></div>
      <div class="pick" id="pick" hidden></div>
    </div>
    <section class="size" id="size" aria-labelledby="size-h">
      <div class="size-h"><h2 id="size-h">Make it yours</h2><div class="seg" role="group" aria-label="Units"><button type="button" data-units="metric" aria-pressed="${!d.units.imperial}">mm</button><button type="button" data-units="imperial" aria-pressed="${d.units.imperial}">in</button></div></div>
      <form id="size-form" onsubmit="return false"></form>
      <div class="size-act"><button type="button" class="btn" id="reset"><svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.1M2.5 2v3h3"/></svg>Reset</button><button type="button" class="btn" id="copy-link"><svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1"/></svg><span>Copy link</span></button></div>
      <div id="notes">${d.ok ? '' : `<p class="warn">${d.checks.filter(c => !c.pass).length} check(s) fail at this size.</p>`}</div>
      <p class="built" id="built-for">${esc(paramsSummary(d))}</p>
    </section>
  </div>
  <section class="sec" id="checks"><h2><span class="secn">1</span>Checks</h2><div id="checks-body">${checksHtml(d)}</div></section>
  <section class="sec" id="bom"><h2><span class="secn">2</span>Materials</h2><div id="bom-body">${bomHtml(d)}</div></section>
  <section class="sec" id="drawings"><h2><span class="secn">3</span>Drawings</h2><div id="drawings-body">${drawingsHtml(d)}</div></section>
  <section class="sec" id="legend"><h2><span class="secn">4</span>Legend</h2><div id="legend-body">${legendHtml(d)}</div></section>
  <section class="sec" id="order"><h2><span class="secn">5</span>Order</h2><div id="order-body">${orderHtml(d)}</div></section>
  <section class="sec" id="steps"><h2><span class="secn">6</span>Steps</h2>
    <div class="steps-grid">
      <div id="steps-body">${steps.map(st => stepHtml(d, st, { interactive: true })).join('')}</div>
      <aside class="step-3d" aria-label="3D model at the step you are reading"><div class="viewer-box"><div class="viewer" id="viewer-steps"></div></div><p class="step-3d-cap" id="step-3d-cap"></p></aside>
    </div>
    <button type="button" class="toggle-3d" id="toggle-3d" aria-pressed="false">3D</button>
  </section>
  <section class="sec" id="cutlist"><h2><span class="secn">7</span>Cut list</h2><div id="cutlist-body">${cutListHtml(d)}</div></section>
</main>
<footer class="foot"><p>${esc(plan.name)}${plan.version ? ' · v' + esc(plan.version) : ''}. ${esc(plan.footer || 'Generated by the blueprint skill. Check every dimension against your own stock before you cut, wear eye and hand protection, and load-test the build gently before trusting it.')}</p></footer>
<script type="module">
${script}
</script>
</body>
</html>
`;
}
