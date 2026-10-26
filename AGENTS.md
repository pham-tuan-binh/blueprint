# AGENTS.md

Notes for any agent working in this repo. The owner's direction is written here so it survives between sessions. Read it before changing the skill, the kit, a plan or the site.

## What this repo is

Blueprint: an agent skill (`skills/blueprint/`) that generates parametric build plans for anything a workshop makes, as one standalone HTML page per plan. Also `skills/blueprint-share/` (opens a PR that adds someone's plan here), `skills/blueprint/examples/` (the official examples, shipped with the skill and shown on the site), `plans/` (plans people share), and `tools/site.mjs` (the GitHub Pages site: a landing page plus every plan and its guide).

## How it should look and read: an IKEA guide

The full rules are in `skills/blueprint/references/kit.md` ("How the page looks"); in short:

- **Clear above all.** If it does not help someone build the thing, remove it.
- **Generated, not hand-made.** Every drawing, table, figure and number comes from a plan's `design.mjs` through the kit. New figures are generators in `kit/shop.mjs`, never hand-drawn SVG or HTML.
- **Space, not boxes.** Sections ~144 px apart, steps ~112 px, step numbers 64 px bold. No rules or boxed panels between them.
- **Minimal elements.** Black ink on white paper, never a dark theme. No shadows, gradients or decorative borders. Icons only where they mean something: ✓ check, ! warning, circled ? explainer, open-in-new-tab, printer.
- **Colour is a code** (`CODE` in `kit/shop.mjs`): yellow = look here (new in this step, help), green = the check, red = the warning (and the clicked part in 3D). Everything else black and white.
- **Minimal text.** Short imperative tasks. Teaching goes in the plan's guide (`guide.html`), reached through the `?` explainers.
- **No header of any kind.** No bar, nav, logo or version line, nothing pinned to the top or its corners. Every page opens with its title, then the start-here link (plans), then a numbered Contents list with dotted leaders. The landing page opens on "Blueprint" and its tagline.
- **Labels on drawings** in white boxes. **The 3D model** in the anatomy style.
- **Phone and paper.** 16 px gutter, no sideways scroll at 390 px, print styles hide controls.
- **Metric by default**, imperial when asked; an mm / in switch on every plan.

## Engineering rules

- Every plan must pass its audit at every size its fields allow, and its capture: `node skills/blueprint/scripts/blueprint.mjs check plans/<id>/design.mjs`. Fix the design, never a check.
- After any change to the page, the guide or the site, capture every example: its layout audit must be clean (numbers, checkboxes, marks and icons within 1 px of their text, measured on the ink). Look at screenshots too, but trust the measurements.
- After a kit change, keep green: `blueprint.mjs test`, the audit of every plan and example, `node tools/site.mjs`, and the capture of each example. Existing plans should build to the same checks unless the change means to move them.
- The official examples live only in `skills/blueprint/examples/`; `plans/` is only for shared plans. Never keep a second copy of a plan.
- Plans contributed through `blueprint-share` add exactly one file, `plans/<id>/design.mjs`.

## Writing style

Plain words, no em dashes. Terse in the plan, explanatory only in the guide.

## Git

Work on a branch, open a PR when asked, and check whether the previous PR was already merged before pushing more commits to it (start a new branch from `main` if so).
