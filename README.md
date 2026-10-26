# blueprint

An agent skill that creates the build plan for anything made from stock material: welded steel or aluminium tube, flat bar, plate, timber and sheet. Ask your coding agent for "plans for a welding cart" and you get one standalone HTML build pack:

- a 3D model (orbit, front/side/top, click a part to identify it, a stress view)
- **input fields for the sizes**: change the length and every cut, drawing, check and step follows, live in the page; the size goes into the URL so it can be shared
- **metric by default**, imperial when you ask for it, and an mm / in switch on every page
- checks that must all pass: every joint can be made, nothing floating, no clashes, pieces fit the stock, strength and sag under its load cases (a 3D frame solver), tip-over, plus the plan's own
- the materials to buy, with the stock lengths from a cutting plan
- a third-angle general arrangement drawing with overall dimensions
- numbered steps with jig drawings, joint coordinates and a check at the end of each
- a cut sheet for every piece with edge marks you can follow with a hacksaw, and a cut list
- a print layout (each step on its own page)

## Install

```bash
npx skills add pham-tuan-binh/blueprint
```

or copy `skills/blueprint/` into your agent's skills folder (for Claude Code: `~/.claude/skills/blueprint/` or `.claude/skills/blueprint/` in a project). It needs Node.js 20+; the browser check needs Playwright with Chromium.

## Use

Ask for a plan in plain words. Say inches if you want imperial.

> Create build plans for a simple metal workbench.

> I need plans for a welding cart for a 120 A MIG and one gas bottle, in inches.

The agent writes `plans/<name>/design.mjs` (the single source of truth), builds it, audits it at every size the fields allow and checks the page in a browser, then hands you `plans/<name>/index.html`.

## Examples

- [`plans/metal-workbench/`](plans/metal-workbench/): a welded steel workbench, generated with the skill
- [`skills/blueprint/examples/shelf-rack/`](skills/blueprint/examples/shelf-rack/): a welded shelf rack, the skill's reference example

## How it works

```
skills/blueprint/
  SKILL.md            the workflow and rules the agent follows
  references/         the design.mjs schema, structure and stock tables, writing steps, the review checklist
  kit/                one pipeline from a design to the page: joints, analysis, drawings, page, 3D viewer
  scripts/
    build.mjs         design.mjs -> one standalone index.html
    audit.mjs         every check at every min, max and 40 random sizes, metric and imperial: "audit passed"
    capture.mjs       headless Chromium: types into a field, switches to inches, screenshots: "capture passed"
    test-fea.mjs      the frame solver against textbook beams
  examples/
```

A plan is a pure function from its params to a model (nodes, members, plates, parts, loads, steps). The kit solves how every member end is cut and joined, groups identical pieces under one mark, nests the cuts into stock lengths, runs the load cases, and lays out the pack. Because every plan goes through the same kit and must pass the same audit, every plan comes out with the same sections, drawings and checks.

Plans are a starting point, not an engineer's sign-off. Check your stock, wear eye and hand protection, and load-test gently before you trust a build.
