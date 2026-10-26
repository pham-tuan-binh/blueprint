# The kit, and how the page must look

Read this only when you change the kit (`kit/`, `scripts/`). A plan never imports the kit: `build(p, k)` gets the helpers in `k`, and the build script bundles kit and design into one page.

## Files

| File | What it does |
|---|---|
| `scripts/blueprint.mjs` | The one command: `doctor`, `examples`, `new`, `build`, `audit`, `capture`, `check`, `test`. The other scripts are its stages. |
| `scripts/build.mjs` | `design.mjs` to one standalone `index.html` (sections pre-rendered, so it reads and prints without JavaScript) and `guide.html`. |
| `scripts/audit.mjs` | Every check at every size the fields allow, and the plan lint. Prints `audit passed`. |
| `scripts/capture.mjs` | The page in headless Chromium: fields, units, 3D view, downloads (every STL watertight at every end of every field), guide, phone width, the layout audit (`scripts/layout.mjs`), screenshots, `--pdf`. Prints `capture passed`. |
| `scripts/env.mjs` | Finds Node, Playwright, Chromium and pdftoppm for `doctor` and `capture`. |
| `scripts/test-fea.mjs` | The frame solver against textbook beams. |
| `kit/core.mjs` | Vectors, materials, stock sections with their properties, metric and imperial formatters, params with dynamic limits. |
| `kit/shapes.mjs` | Mesh generators (`k.shapes`): sphere, cone, sweep, arc, bend, revolve, extrude. |
| `kit/print.mjs` | 3D prints: boxes, filament and time, bed turn, the exact solid (`printManifold`, manifold-3d: always watertight), the STL, the OpenSCAD source (same facets as the STL). |
| `kit/joints.mjs` | The joint solver: through, mitre, butt or flush at every node; each member trimmed to its real cut planes. |
| `kit/derive.mjs` | `derive(plan, params, units)`: joints, piece and plate marks, nesting, mass, analysis, tip-over, every check, cost, hours. |
| `kit/fea.mjs` | 3D beam frame solver. |
| `kit/shop.mjs` | SVG drawings: third-angle sheets, jigs, cut sheets, plate drawings, cutting plans; `CODE`, the colour code. |
| `kit/pack.mjs`, `kit/page.mjs` | The page sections and the HTML shell, print styles included. |
| `kit/guide.mjs` | `guide.html` ("How to read this plan", figures from the plan) and the `?` explainers. |
| `kit/viewer.mjs` | The 3D view (three.js; manifold-3d for prints, loaded only when a plan has them). |
| `kit/app.mjs` | The page runtime: fields, units switch, URL state, live re-render, saved ticks, downloads. |

After changing `SKILL.md` or a reference, run the scenarios in `evals/evals.json` with a fresh agent (on every model the skill is for) and keep `SKILL.md` under 500 lines, the description in the third person and under 1024 characters; CI validates both skills against the [Agent Skills spec](https://agentskills.io/specification).

After a kit change keep green: `blueprint.mjs test`, the audit of every plan and example, `node tools/site.mjs`, and a capture of each example (its layout audit clean). Existing plans should build to the same output unless the change means to move them.

## How the page looks: an IKEA guide

- **Clear above all.** If it does not help someone build the thing, leave it out.
- **Generated, not hand-made.** Every drawing, table, number and figure comes from `design.mjs` through the kit. A missing figure is a new generator in `kit/shop.mjs`, never hand-written SVG or HTML in a plan.
- **Space, not boxes.** Sections ~144 px apart, steps ~112 px, step numbers 64 px bold. No rules or boxed panels between them.
- **Minimal elements.** Black ink on white paper, never a dark theme. No shadows, gradients or decorative borders. Icons only where they mean something, centred in their circle: ✓ check, ! warning, circled ? explainer, open-in-new-tab, printer.
- **Colour is a code** (`CODE` in `kit/shop.mjs`, the 3D view matches): yellow = look here (new in this step, help, start here), green = the ✓ check, red = the ! warning (and the clicked part in 3D). Everything else black, white and grey. No new colour without one meaning here.
- **Minimal text.** Short imperative tasks; teaching lives in the guide, reached through the `?` explainers.
- **No header of any kind.** No bar, nav, logo or version line, nothing pinned to the top or its corners. A plan opens with its title, then the start-here link to the guide, then a numbered Contents list with dotted leaders. Links and controls sit in the flow where a document would put them.
- **No lede, no facts grid.** The summary is for the gallery card; the totals are one line at the top of the materials list.
- **Labels on drawings** in their own white boxes. **The 3D model** in the anatomy style: orthographic, four greys by face direction, thin outlines, one accent.
- **Phone and paper.** 16 px gutter, no sideways scroll at 390 px; print styles hide the controls and print the folded cut sheets open.
- **Metric by default**, imperial when asked; an mm / in switch on every plan.
