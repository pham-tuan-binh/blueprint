---
name: blueprint
description: Make a parametric build plan, one standalone HTML page, for anything a workshop builds (welded steel or aluminium frames, timber and plywood, PVC pipe, plate, 3D-printed parts, bought hardware). The page has a 3D model, size fields that redo the whole plan live, checks that must pass, a materials list, STL and OpenSCAD files for prints, drawings, numbered steps with jigs and a cut list. Use it whenever someone wants plans, a blueprint, a build guide, a cut list or "how do I build" for a physical thing (workbench, cart, shelf, gate, stand, jig, mount, antenna, PVC rack, furniture), even if they never say "plan". Metric by default, imperial when asked.
license: MIT
compatibility: Node.js 20+, no npm install. The browser check needs Playwright with Chromium; `scripts/blueprint.mjs doctor` checks the machine and prints the fix.
metadata:
  version: "1.2"
---

# Blueprint

You write one file, `plans/<id>/design.mjs`: params plus a pure `build(p, k)` that returns the model. The kit turns it into the page (3D view, checks, materials, prints, drawings, steps, cut list) and a guide beside it. Every plan gets the same sections, drawings, checks and look; your job is the design.

`$SKILL` is the folder this file is in; write it out in full.

```bash
node $SKILL/scripts/blueprint.mjs doctor                                   # first: what this machine lacks, and the fix
node $SKILL/scripts/blueprint.mjs examples                                 # the examples and what each shows
node $SKILL/scripts/blueprint.mjs new <id> --from <example> --name "Name"  # plans/<id>/design.mjs from an example
node $SKILL/scripts/blueprint.mjs check plans/<id>/design.mjs              # build + audit + browser capture: "check passed"
```

`check` stops at the first failing stage. Exit 0 passed, 1 a check failed (fix the design), 2 bad usage or a missing tool (run `doctor`). `--hash "top=steel"` (repeatable) also captures a variant. With no browser: `--no-browser`, and tell the user the page was not opened. Never skip the audit. A file from `new` carries a "STARTED FROM" note; the audit fails until you have rewritten the plan and deleted it. `blueprint.mjs help` lists every command and flag.

## Examples

Open the closest one and copy its shape.

| Example | Shows |
|---|---|
| `shelf-rack` | the smallest plan: posts with `prio`, a limit that follows another field, notched decks, a plan check, an anchored tip check |
| `metal-workbench` | a design that adapts (middle legs, rail spacing), a `bool`, four load cases, bars placed by a rule, foot plates, `{mark:id}` |
| `pvc-drying-stand` | bought fittings with real shapes, pipes cut to the socket, a load limit that follows size, a stance check |
| `v-dipole-137` | 3D prints (solids, cuts, `bed`, copies), non-steel materials, electrical plan checks, a two-part wind load |

## The rule: the model is the plan

Every length, angle, coordinate, quantity and mass is computed in `build(p, k)`, never written into prose. Text formats sizes with `k.u` (`u.len(mm)`, `u.len(mm, { u: true })`, `u.fine`, `u.size`, `u.mass`, `u.tol`). If a number appears, it was computed. Every step says what to cut, where it goes, how it is held and the check before the next step.

## Workflow

1. **Size it.** A *Part* (one frame, up to ~40 members): build it. An *Assembly* (sub-assemblies or moving parts, 40-120 members): say so, build it. A *Machine* (carries people, lifts, moves under power): do not build it; say what proof it needs and offer the Part or Assembly that keeps the core.
2. **Truth first.** Write down the loads and how they act, what it stands on, where it lives, the builder's tools, the stock they can buy. Ask only if the answer changes the design; otherwise choose common local stock and say so.
3. **Structure and materials.** Pick what the job needs, not steel by habit: PVC for light and outdoor frames, aluminium for light conductors, timber for benches and decks, steel for real load, a print for odd-angle hubs, clamps and holders. Lay out the frame in words first: what runs through, what butts, where braces go, how it meets the floor.
4. **Write `design.mjs`** with `new --from`: params, then sections, nodes, members, plates, hardware, prints, supports, loads, tip, plan checks, steps.
5. **Check it** until it ends `check passed`. Fix the design, never a check: a weak member gets a bigger section or a brace, a failing size gets a design that adapts, a hard-coded "mm" gets `u.len()`. Capture every `choice` option and every size where the design changes with `--hash`.
6. **Verify like a builder**: read every PNG in `shots/`, then go through `references/verify.md`.
7. **Deliver** the plan folder (`design.mjs`, `index.html`, `guide.html`, `shots/`) with the size, the main numbers (mass, load and safety factor, cost), your assumptions about stock and load, and how to change the size (the fields; the URL keeps it). To publish it on the plans site, use the `blueprint-share` skill.

Put plans in `plans/<id>/` in the user's project, never inside the skill folder.

## Rules

- **Parametric.** Fields for the sizes a person would change (length, width, height, plus what they mentioned), 5-8 typical, each with `min`, `max` and a common default. Every check must pass at every size the fields allow. A limit may follow earlier fields (`max: p => ...`). When a size needs more structure, make the design add it (`if (p.length > 1800) ...`) instead of narrowing the field.
- **Units.** Metric unless the user asks for imperial (`units: 'imperial'`, imperial stock via `k.inch()`, round inch defaults). The model is always mm; stock never depends on the display units. Bought parts keep their trade names.
- **Straight cuts, flat table.** Straight pieces of one section, square cuts, mitres only between equal sections. No bends, copes or notches unless asked. Nothing runs past a joint; nothing butts onto a smaller member.
- **Legs run through** (`prio: 1`), rails butt onto their faces, the top stays one plane. One or two sections per plan.
- **Name for the builder.** Plain member names, readable node names (`FL0`), pieces by mark in text (`{mark:member-id}`). Members that share a mark share a name.
- **Prove it.** A load case for the job and one for abuse. Safety factor 2 on yield for furniture and fixtures, 3 for anything stood on or hung from. A deflection limit where sag matters, a tip check when tall or pushed at height. Anything else it must do (an element length, a clearance, a current) is a plan check.
- **Model what it looks like.** Bought fittings and prints take their real shape (`k.shapes`, or your own mesh).
- **Every part can get to its place.** Walk each step: can the deck, panel, wheel or part pass what is already built? Fit it before the frame closes or size it for the opening; wood, plastic, paint and bought parts after welding. If the order cannot work, change the design.
- **Every part is in a step and on the materials list.** Plates, feet, bolts, paint, wire.
- **Tolerances a person can hold** (±1 mm cuts, diagonals within 2-3 mm), with how to check them. **Honest about limits**: if it only passes anchored or braced, say so in the check and the step.
- **Short text.** Imperative tasks, no teaching (the guide's `?` explainers do that). Plain words, no em dashes.

## References

Read each when you reach that part of the work:

| File | Read it when |
|---|---|
| `references/model.md` | writing `design.mjs`: the full schema, field by field |
| `references/structure.md` | laying out a frame: joints, braces, feet, load cases, stock tables (steel, aluminium, timber, PVC) |
| `references/prints.md` | the plan has a 3D-printed part |
| `references/steps.md` | writing the build order and the steps |
| `references/verify.md` | reviewing the finished pack |
| `references/kit.md` | changing the kit itself: what each file does and how the page must look |
