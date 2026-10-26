---
name: blueprint
description: Create a complete, parametric build plan for anything made from stock material (welded steel or aluminium tube, flat bar, plate, timber, sheet) as one standalone HTML build pack: a 3D model, input fields that resize the whole plan live, structural and buildability checks that must all pass, a bill of materials with what to buy, a third-angle general arrangement drawing, numbered build steps with jig drawings and joint coordinates, a cut sheet with edge marks for every piece, and a cut list with a stock cutting plan. Use it whenever someone wants plans, a blueprint, a build guide, a cut list, fabrication drawings or "how do I build" instructions for a physical thing: a workbench, welding cart, shelf, rack, table, bed frame, trailer frame, gate, stand, cage, jig or furniture, even if they never say "plan". Metric by default; imperial when the user asks for it.
license: MIT
compatibility: Written for Claude Code; runs in any agent that can run Node.js 20+. The browser check needs Playwright with Chromium.
metadata:
  version: "1.0"
---

# Blueprint

This skill makes build packs: one page a person takes to the shop and builds from without asking anyone anything. Every number on it (each cut, coordinate, drawing dimension, kilogram and safety factor) comes from one `design.mjs`, through one kit, so every plan this skill makes has the same sections, the same drawings, the same checks and the same look. The kit is what makes the output consistent; your job is the design.

Open the closest example before you start, and copy its shape.

- `examples/shelf-rack/design.mjs`: four posts, a welded rectangle at every shelf level, plywood decks. The smallest complete plan (about 150 lines). Shows posts that run past corners (`prio`), dynamic limits (the shelf count follows the height), a plan check of its own, and an anchored tip check.

Build one with `node scripts/build.mjs examples/<name>/design.mjs --out /tmp/<name>.html` and open it (without `--out` it writes `index.html` next to the design).

## The one idea that matters

**The model is the plan.** You write a pure function `build(p, k)` that turns the params into nodes, members, plates, parts, loads and steps. You never write a length, angle, coordinate, quantity, mass or dimension anywhere else, and never into prose by hand: task text formats every size with `k.u.len(mm)`. Then the person types a new length into the page and every cut, drawing, check and step follows, in millimetres or inches.

Two ways this fails, both easy to fall into:

- **A drawing of a plan, not a plan.** Text that says "cut the legs to 850 mm" while the model has another number, a size that only works at the defaults, a step that welds a piece the cut list never mentions. The audit catches most of it; the rule catches the rest: if a number appears, it was computed.
- **A plan nobody can follow.** Pieces with no marks, joints with no coordinates, a step that says "assemble the frame". Every step names what to cut, where it goes (jig + coordinates), how it is held, and the check to pass before the next step.

## Units

- **Metric is the default.** Millimetres, kilograms, newtons, metric stock (SHS 40×40×2, 6 m lengths). Do this unless the user asks otherwise.
- **Imperial only when the user asks** (says inches, feet, gauge, "US sizes", or gives sizes in inches). Then set `units: 'imperial'` on the plan, choose imperial stock with `k.inch()` (1-1/2" × 14 ga square tube = `squareTube(inch(1.5), inch(0.083))`, 20 ft lengths = `stockLen: feet(20)`), and write the params' defaults and limits as round inch values in mm (`inch(60)`).
- The model is always in millimetres internally. The page has an mm / in switch either way; it changes only how numbers print, never the design. So the stock you choose must never depend on the display units.
- In any text, format sizes with `u.len(v)` (a cut length: `1500` or `59 1/16"`), `u.len(v, { u: true })` (with its unit), `u.size(v)` (an overall size: `1.50 m`, `4' 11"`), `u.mass(kg)`, `u.tol(mm)`. The audit fails a plan whose step text says "mm" in imperial.

## Parametric, always

Every plan is parametric. Give the person the sizes they would actually change as input fields: overall length, width/depth and height at least, plus anything the user mentioned (shelf count, load, top material, feet or casters). The page shows them in a "Make it yours" panel; a change re-runs the whole plan in the browser and goes into the URL, so a size can be shared as a link.

- Each param has `min`, `max` and a sensible default. The audit builds the plan at every min, every max, all-min, all-max and 40 random combinations, and **every check must pass at every one of them**. A size the fields allow is a size someone will build.
- When one limit depends on another, make it a function of the params declared before it: `max: p => Math.floor((p.height - 270) / 250) + 1`.
- When a size needs more structure (a long bench needs a centre leg, a tall rack a brace), make the design add it (`if (p.length > 1800) …`) instead of narrowing the field until the problem disappears. Narrow a range only when the thing stops making sense.
- Do not add fields nobody would change. Five to eight is typical.

## Workflow

Work in this order. Write the requirements and the structure before any code: most of the quality is decided there.

1. **Size it.** Name the size before any other work.
   - **Part**: one frame or object, up to about 40 members (a stand, a shelf, a table, a cart). Build it without asking.
   - **Assembly**: several sub-assemblies or moving parts, 40-120 members (a workbench with drawers and a vise mount, a gate with a frame and hinges, a welding cart with a cylinder rack). Say so, then build it.
   - **Machine**: a vehicle, trailer, lifting device or anything that carries people or moves under power. Do not start it. Say what extra proof it needs (a licensed engineer, a standard, test loads), propose the Part or Assembly version that keeps the core, and build that unless the user insists.
2. **Truth first.** Write down what it must do before you design it: the load and how it is applied (a 300 kg spread load, a 100 kg point load at a corner, someone leaning on it), what it stands on, where it lives, who builds it and with what tools, the stock they can buy (ask only if it changes the design; otherwise pick common local stock and say so). These become the load cases, the checks and the tools list.
3. **Choose the structure.** Sketch it in words: which members run through, which butt, where the braces go, how it meets the floor. Follow `references/structure.md`: straight cuts, legs that run past corners with rails welded to their faces, one or two sections, no ears, triangulate or rely on welded corners (and check racking), feet that spread the load. Pick sections from its stock tables.
4. **Write the params**, then the model in `design.mjs`, in this order: sections, nodes (named so a builder can read them: `FL0` front-left at the floor), members, plates, hardware, supports, loads, tip, plan checks, steps. The schema is in `references/model.md`; copy the example's shape.
5. **Write the steps**: Fabricate (cut, tack sub-frames on a flat table, join, weld out in a balanced sequence, plates and tabs from the real parts), then Finish or Assemble (paint, fit parts, level, load-test). Every step that fits members ends with a check (diagonals, plumb, level, within a tolerance). `references/steps.md` has the rules and a model step.
6. **Build and audit.**
   - `node scripts/build.mjs plans/<id>/design.mjs` writes `plans/<id>/index.html` and prints every check with its value.
   - `node scripts/audit.mjs plans/<id>/design.mjs` must end `audit passed`. Fix the design, never a check: a failing strength check gets a bigger section or a brace, a failing size gets a design that adapts, a hard-coded "mm" gets `u.len()`.
   - `node scripts/capture.mjs plans/<id>/index.html --pdf` must end `capture passed`. It types into a field, switches to inches, checks the 3D view and the phone width, and writes PNGs (and the printed pages) to `plans/<id>/shots/`. For every `choice` option and every size where the design changes (a middle leg appears), capture that variant too: `--hash "top=steel" --out plans/<id>/shots/steel`.
7. **Verify like a builder.** Read every PNG: desktop, phone, every step, the drawings, the cut list, the imperial pass. Then go through `references/verify.md` as someone standing at the saw with only this page. Iterate until every answer is yes.
8. **Deliver.** The plan folder (`design.mjs`, `index.html`, `shots/`). Tell the user the size, the main numbers (mass, load and safety factor, cost if priced), the assumptions you made about stock and load, and how to change the size (the fields on the page; the URL keeps it).

## Setup

The kit is in `kit/`; a plan never imports it (the build script bundles both into one file, and `build(p, k)` gets the helpers in `k`).

| File | What it does |
|---|---|
| `kit/core.mjs` | Vectors, materials (steel, stainless, aluminium, timber), stock sections (`squareTube`, `rectTube`, `roundTube`, `flatBar`, `bar`, `timber`) with their section properties, the metric/imperial formatters, param resolution with dynamic limits. |
| `kit/joints.mjs` | The joint solver: at every node decides through / mitre / butt / flush, trims every member to its real cut planes, gives each end's angles. |
| `kit/derive.mjs` | `derive(plan, params, units)`: the one pipeline. Joints, piece marks (identical and mirror pieces share a letter), plate marks, stock nesting, mass and centre of mass, frame analysis, tip-over, every kit check plus the plan's own, cost, hours. |
| `kit/fea.mjs` | 3D beam frame solver, two bending stiffnesses per section. Proven by `scripts/test-fea.mjs`. |
| `kit/shop.mjs` | SVG drawings: third-angle sheets (GA and per-step jigs) at one scale with dimensions, cut sheets with edge marks, plate drawings with holes, cutting plans. |
| `kit/pack.mjs`, `kit/page.mjs` | The page sections and the standalone HTML shell, print styles included. |
| `kit/viewer.mjs` | The 3D view (three.js): orthographic, four greys by facing, ink outlines, the current step lit in red, a stress view. |
| `kit/app.mjs` | The page runtime: input fields, units switch, URL state, live re-render, step ticks saved on the device. |
| `scripts/build.mjs` | Builds `design.mjs` into one standalone `index.html` (the sections are pre-rendered, so it reads and prints without JavaScript). |
| `scripts/audit.mjs` | The sweep and the plan lint. Must print `audit passed`. |
| `scripts/capture.mjs` | Headless Chromium check and screenshots; `--pdf` prints the pack to A4. Must print `capture passed`. |
| `scripts/test-fea.mjs` | The frame solver against textbook beams. |

Put new plans in `plans/<id>/design.mjs` in the user's project (or wherever they ask), not inside the skill folder.

## Craft rules (short form)

`references/structure.md` and `references/steps.md` give the reasoning.

- **Straight cuts, flat table.** Every member is a straight piece of one section. Prefer square cuts: a rail between two legs butts square onto their faces. Mitre only two members of the same section at a corner. No bends, no copes, no notching, unless the user has the tool and asks.
- **No ears, no overhangs.** Nothing runs past a joint. A member never butts onto a smaller one (the joint check fails it).
- **Legs run through.** Give legs and posts `prio: 1`: they run from the floor to the top, cut flush with the top of the rails, and every rail butts onto their faces. The top stays one flat plane.
- **Name everything for the builder.** Members get a plain name ("Front rail, lower"), nodes a short readable name, steps a short title. Piece marks (A, B, C) are automatic; write them into step text with `{mark:member-id}`. Members that share a mark should share a name too ("Short rail"), since the cut sheet prints them together.
- **One or two sections.** Fewer sizes means fewer purchases and fewer mistakes. Use a lighter section only where the checks show it is enough.
- **Prove what it holds.** At least one load case for its job (spread over what carries it) and one for abuse (a point load, a sideways shove). Safety factor 2 on yield for furniture and fixtures, 3 for anything a person stands on or hangs from. A deflection limit where sag matters (a bench top: span/300). A tip check for anything taller than 1.5 × its depth or pushed at height (`references/structure.md`).
- **Every part is in a step and on the bill.** Plates, feet, bolts, screws, paint, wire and discs: the person buys from the materials list, so if it is not there they will not have it.
- **Tolerances a person can hold.** ±1 mm cut, diagonals equal within 2-3 mm. Say how to check it, not just the number.
- **Honest about limits.** If a check only passes because it is anchored, braced or loaded carefully, say so in the check and the step.

## References

Read these as you need them:

- `references/model.md`: the `design.mjs` schema, field by field, with the shelf rack as the worked example.
- `references/structure.md`: structural conventions (joints, legs, braces, racking, feet, plates), load cases and safety factors, metric and imperial stock tables.
- `references/steps.md`: how to write the build order and the steps, with a model step and the phrases that fail.
- `references/verify.md`: the review checklist for the finished pack, and the faults earlier plans were rejected for.
