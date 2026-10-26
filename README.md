# blueprint

An agent skill that creates the build plan for anything a workshop makes: welded steel or aluminium frames, timber and plywood, PVC pipe, plate and sheet, 3D-printed parts, and the parts you buy. Ask your coding agent for "plans for a welding cart" and you get one standalone HTML build pack:

- a 3D model (orbit, front/side/top, click a part to identify it, a stress view)
- **input fields for the sizes**: change the length and every cut, drawing, check and step follows, live in the page; the size goes into the URL so it can be shared
- **metric by default**, imperial when you ask for it, and an mm / in switch on every page
- checks that must all pass: every joint can be made, nothing floating, no clashes, pieces fit the stock, strength and sag under its load cases (a 3D frame solver), tip-over, plus the plan's own
- the materials to buy, with the stock lengths from a cutting plan
- a third-angle general arrangement drawing with overall dimensions
- numbered steps with jig drawings, joint coordinates and a check at the end of each
- a cut sheet for every piece with edge marks you can follow with a hacksaw, and a cut list
- 3D-printed parts with .stl and .scad downloads cut at the current size
- a print layout (each step on its own page)

## Install

```bash
npx skills add pham-tuan-binh/blueprint
```

or copy `skills/blueprint/` into your agent's skills folder (for Claude Code: `~/.claude/skills/blueprint/` or `.claude/skills/blueprint/` in a project). It needs Node.js 20+ and nothing to install; the browser check needs Playwright with Chromium. Check a machine with:

```bash
node skills/blueprint/scripts/blueprint.mjs doctor
```

Any agent that can run shell commands can use it (Claude Code, Codex, Cursor, Gemini CLI, ...): every tool is one command, `scripts/blueprint.mjs`.

## Use

Ask for a plan in plain words. Say inches if you want imperial.

> Create build plans for a simple metal workbench.

> I need plans for a welding cart for a 120 A MIG and one gas bottle, in inches.

The agent starts `plans/<name>/design.mjs` (the single source of truth) from the closest example, writes the design, and runs `blueprint.mjs check`, which builds it, audits it at every size the fields allow and checks the page in a browser. Then it hands you `plans/<name>/index.html`.

The same commands by hand:

```bash
B=skills/blueprint/scripts/blueprint.mjs
node $B new welding-cart --from metal-workbench     # plans/welding-cart/design.mjs
node $B check plans/welding-cart/design.mjs         # build + audit + capture: "check passed"
```

## Examples

In `skills/blueprint/examples/`, inside the skill so they install with it, and on the site:

- [`metal-workbench`](skills/blueprint/examples/metal-workbench/): an all-steel welded workbench with a bar top
- [`v-dipole-137`](skills/blueprint/examples/v-dipole-137/): a 137 MHz V-dipole antenna with a 3D-printed feed hub and an SMA jack on a PVC mast
- [`shelf-rack`](skills/blueprint/examples/shelf-rack/): a welded shelf rack, the smallest complete plan
- [`pvc-drying-stand`](skills/blueprint/examples/pvc-drying-stand/): a PVC pipe stand in solvent-weld fittings

Plans other people share go in [`plans/`](plans/).

## Share your plan

Made a plan you are proud of? Add it to the site with the `blueprint-share` skill (installed alongside `blueprint`). Ask your agent:

> Share my plan in plans/welding-cart with the blueprint gallery.

It checks the plan, forks this repo, copies in the one file a plan needs (`plans/<id>/design.mjs`), audits it with this repo's kit, builds the site to confirm the page and card appear, and opens a pull request credited to you, after showing you what it will send. By hand:

```bash
gh repo fork pham-tuan-binh/blueprint --clone
node skills/blueprint-share/scripts/share.mjs path/to/plans/welding-cart/design.mjs --repo blueprint
# then the git and gh commands it prints
```

A plan needs an `author: { github: 'your-handle', name: 'Your Name' }` line, a new id and a short summary (it is the card's description). CI audits it at every size its fields allow before it can merge.

## The plans site

The skill's examples and every shared plan in `plans/` are published to GitHub Pages by `.github/workflows/pages.yml`: it runs the solver test and every plan's audit, builds each into its own page (with its guide) with `tools/site.mjs`, and puts them on a landing page that shows how to install and use the skill. To add a plan, add `plans/<id>/design.mjs` (made with the skill, passing its audit, or through `blueprint-share`); nothing else changes. Build the site locally with `node tools/site.mjs` and open `_site/index.html` through a local server (`npx http-server _site`).

One-time setup: Settings > Pages > Build and deployment > Source: GitHub Actions.

## How it works

```
skills/blueprint/
  SKILL.md            the workflow and rules the agent follows
  references/         the design.mjs schema, structure and stock tables, writing steps, the review checklist
  kit/                one pipeline from a design to the page: joints, analysis, drawings, page, 3D viewer
  scripts/
    blueprint.mjs     the one command: doctor, examples, new, build, audit, capture, check, test
    build.mjs         design.mjs -> one standalone index.html
    audit.mjs         every check at every min, max and 40 random sizes, metric and imperial: "audit passed"
    capture.mjs       headless Chromium: types into a field, switches to inches, screenshots: "capture passed"
    test-fea.mjs      the frame solver against textbook beams
    env.mjs           finds Node, Playwright, Chromium and pdftoppm for doctor and capture
  examples/
skills/blueprint-share/
  SKILL.md            how an agent opens a PR that adds a plan to this repo
  scripts/share.mjs   copy in, audit with the repo's kit, build the site, write the PR text
```

A plan is a pure function from its params to a model (nodes, members, plates, parts, loads, steps). The kit solves how every member end is cut and joined, groups identical pieces under one mark, nests the cuts into stock lengths, runs the load cases, and lays out the pack. Because every plan goes through the same kit and must pass the same audit, every plan comes out with the same sections, drawings and checks.


## License

MIT, see [LICENSE](LICENSE).
