---
name: blueprint
description: Generates a parametric build plan as one standalone HTML page for anything a workshop builds (welded steel or aluminium frames, timber and plywood, PVC pipe, plate, 3D-printed parts, bought hardware). The page has a 3D model, size fields that redo the whole plan live, checks that must pass, a materials list, STL and OpenSCAD files for prints, drawings, numbered steps with jigs and a cut list. Use when someone wants plans, a blueprint, a build guide, a cut list or "how do I build" for a physical thing (workbench, cart, shelf, gate, stand, jig, mount, antenna, PVC rack, furniture), even if they never say "plan". Metric by default, imperial when asked.
license: MIT
compatibility: Node.js 20+, no npm install. The browser check needs Playwright with Chromium, or a host app's browser via BLUEPRINT_BROWSER_HOST; `scripts/blueprint.mjs doctor` checks the machine and prints the fix.
metadata:
  version: "1.2"
---

# Blueprint

You write one file, `plans/<id>/design.mjs`: params plus a pure `build(p, k)` that returns the model. The kit turns it into the page (3D view, checks, materials, prints, drawings, steps, cut list) and a guide beside it. Every plan gets the same sections, drawings, checks and look; your job is the design.

`$SKILL` is the folder this file is in (`doctor` prints it); write it out in full. Run the scripts, never read them to use them: `blueprint.mjs help` lists every command and flag.

```bash
node $SKILL/scripts/blueprint.mjs doctor                                   # first: what this machine lacks, and the fix
node $SKILL/scripts/blueprint.mjs examples                                 # the examples and what each shows
node $SKILL/scripts/blueprint.mjs new <id> --from <example> --name "Name"  # plans/<id>/design.mjs from an example
node $SKILL/scripts/blueprint.mjs check plans/<id>/design.mjs              # build + audit + browser capture: "check passed"
```

`check` stops at the first failing stage. Exit 0 passed, 1 a check failed (fix the design), 2 bad usage or a missing tool (run `doctor`). `--hash "top=steel"` (repeatable) also captures a variant. With no browser: `--no-browser`, and tell the user the page was not opened. Never skip the audit. A file from `new` carries a "STARTED FROM" note; the audit fails until you have rewritten the plan and deleted it.

## Examples

Open the closest one and copy its shape.

| Example | Shows |
|---|---|
| `shelf-rack` | the smallest plan: posts with `prio`, a limit that follows another field, notched decks, a plan check, an anchored tip check |
| `metal-workbench` | a design that adapts (middle legs, rail spacing), a `bool`, four load cases, bars placed by a rule, foot plates, `{mark:id}` |
| `pvc-drying-stand` | bought fittings with real shapes, pipes cut to the socket, a load limit that follows size, a stance check |
| `v-dipole-137` | 3D prints (solids, cuts, `bed`, copies) kept quick to print, non-steel materials, electrical plan checks, coax routed inside the mast, a two-part wind load |

## The rule: the model is the plan

Every length, angle, coordinate, quantity and mass is computed in `build(p, k)`, never written into prose. Text formats sizes with `k.u` (`u.len(mm)`, `u.len(mm, { u: true })`, `u.fine`, `u.size`, `u.mass`, `u.tol`). If a number appears, it was computed. Every step says what to cut, where it goes, how it is held and the check before the next step.

## Workflow

When you build a plan, copy this checklist into your reply and tick it off as you go (not when step 1 says not to build it):

```
Plan progress:
- [ ] 1. Size it (Part / Assembly / Machine)
- [ ] 2. Truth first: loads, ground, place, tools, stock
- [ ] 3. Structure and materials, in words
- [ ] 4. design.mjs started with `new --from`, then written
- [ ] 5. `check` passes (fix, rerun, until "check passed")
- [ ] 6. Every PNG read, references/verify.md answered
- [ ] 7. Delivered with numbers and assumptions
```

1. **Size it.** A *Part* (one frame, up to ~40 members): build it. An *Assembly* (sub-assemblies or moving parts, 40-120 members): say so, build it. A *Machine* is anything that carries people, lifts loads overhead, moves under power, or goes on a public road (a trailer, even towed and unbraked, is one): do not build it, however simple it looks. Say what it would need (an engineer's sign-off, the standard or road rules that govern it, a proof load test) and offer the Part or Assembly that keeps the core (a stand, a dolly, a yard cart), built only if the user takes it.
2. **Truth first.** Write down the loads and how they act, what it stands on, where it lives, the builder's tools, the stock they can buy. Ask only if the answer changes the design; otherwise choose common local stock and say so.
3. **Structure and materials.** Pick each material for what the job asks of it (load, weather, weight, whether it conducts, the builder's tools), not by habit; the materials files (below) say what each is good at. Describe the design in words first: how load gets from where it is applied to the ground, how each part joins, what runs through it, and the order it goes together.
4. **Write `design.mjs`** with `new --from`: params, then sections, nodes, members, plates, hardware, prints, supports, loads, tip, plan checks, steps.
5. **Check it, fix it, check again** until it ends `check passed`. `audit <design.mjs> --at "length=800"` prints every check at one size, for a closer look at a failure or a threshold. Each failure names the stage, the size and the check. Fix the design, never a check: a weak member gets a bigger section or a brace, a failing size gets a design that adapts, a hard-coded "mm" gets `u.len()`. Capture every `choice` option and every size where the design changes with `--hash`.
6. **Verify like a builder**: read every PNG in `shots/`, then go through [references/verify.md](references/verify.md). A no sends you back to step 5.
7. **Deliver** the plan folder (`design.mjs`, `index.html`, `guide.html`, `shots/` with the printed pack `plan.pdf`) with the size, the main numbers (mass, load and safety factor, cost), your assumptions about stock and load, and how to change the size (the fields; the URL keeps it). To publish it on the plans site, use the `blueprint-share` skill.

Put plans in `plans/<id>/` in the user's project, never inside the skill folder.

## Rules

These hold for anything a workshop makes. Ask each one of every part, joint and step; the references show how it plays out for frames, prints, pipe and wiring, but the rule decides. In order of impact: the first six break a plan, the rest make it hard to build from.

- **Parametric.** Fields for the sizes a person would change (length, width, height, plus what they mentioned), 5-8 typical and fewer for a small part, each with `min`, `max` and a common default. Every check must pass at every size the fields allow. A limit may follow earlier fields (`max: p => ...`). When a size needs more structure, make the design add it (`if (p.length > 1800) ...`) instead of narrowing the field. Narrow a field only at a hard limit the design cannot move (the printer bed, the stock length, the thing stops making sense), and say so in its hint.
- **Prove it does its job.** Name every way it can fail (break, bend, tip, slip, loosen, leak, detune, overheat) and give each a check at its worst size. Loads: one case for the job at its rating, placed where it does most harm, and one for the abuse a person or the weather will really give it. Safety factor 2 on strength for what holds things, 3 for anything a person stands on, sits on or hangs from. What is not a load (a length, a clearance, a current) is a plan check.
- **Every part can be made and fitted, in order.** Walk the steps with each part in hand: can it be made with the builder's tools, pass what is already built, and be reached to fasten it? Work that heats, dirties or shakes comes before what it would spoil. If the order cannot work, change the design, not the words.
- **Everything that runs through it has a route.** Cables, hoses, pipes, water and air: trace each from end to end. Inside a hollow member when there is one, in and out through a real hole or open end, its connectors reachable when that step comes, nothing pinching it, and water out at a low point. A route left for the builder to improvise is a missing part.
- **Every part is in a step and on the materials list.** Plates, feet, bolts, paint, wire.
- **Size each part to its job.** Mass, cost, print hours and work all follow size, so nothing is bigger, deeper, thicker or denser than a check needs. Stack features rather than spreading them, and pick the lightest stock that passes. When one part takes most of the mass, cost or time in its table, rethink that part first.
- **Simple to make.** The fewest operations the builder's tools allow: straight pieces, square cuts, one or two stock sizes, joints that repeat. A bend, cope, notch or a mitre between different sections only when asked. The load takes the direct path: what carries most runs through, the rest butts onto it, never onto anything smaller (frames: `references/structure.md`).
- **Units.** Metric unless the user asks for imperial (`units: 'imperial'`, imperial stock via `k.inch()`, round inch defaults). The model is always mm; stock never depends on the display units. Bought parts keep their trade names.
- **Name for the builder.** Plain member names, readable node names (`FL0`), pieces by mark in text (`{mark:member-id}`). Members that share a mark share a name.
- **Model what it looks like.** Bought fittings and prints take their real shape (`k.shapes`, or your own mesh).
- **Tolerances a person can hold** (±1 mm cuts, diagonals within 2-3 mm), with how to check them. **Honest about limits**: if it only passes anchored or braced, say so in the check and the step.
- **Short text.** Imperative tasks, no teaching (the guide's `?` explainers do that). Plain words, no em dashes.

## Done when

- `check` ends `check passed` (with `--hash` for every option and every size where the design changes), or `--no-browser` and the user is told.
- Every question in [references/verify.md](references/verify.md) is a yes.
- No number in the plan's text was typed by hand, and no "STARTED FROM" note is left.
- The user has the folder, the main numbers and your assumptions.

## References

Read each when you reach that part of the work:

| File | Read it when |
|---|---|
| [references/model.md](references/model.md) | writing `design.mjs`: the full schema, field by field |
| [references/structure.md](references/structure.md) | laying out a frame: joints, braces, feet, load cases, safety factors, tip-over |
| [references/steps.md](references/steps.md) | writing the build order and the steps |
| [references/verify.md](references/verify.md) | reviewing the finished pack |
| [references/kit.md](references/kit.md) | changing the kit itself: what each file does and how the page must look |

Materials: read only the ones the plan uses, when you choose them (step 3). Each has the stock sizes, the design rules and what goes in the steps.

| File | Read it when the plan has |
|---|---|
| [references/materials/steel.md](references/materials/steel.md) | mild or stainless steel tube, bar or plate; welding; galvanised parts |
| [references/materials/aluminium-copper.md](references/materials/aluminium-copper.md) | aluminium, copper or brass; antenna elements and conductors |
| [references/materials/timber.md](references/materials/timber.md) | timber, plywood or MDF |
| [references/materials/pvc-plastics.md](references/materials/pvc-plastics.md) | PVC pipe and fittings, or plastic sheet |
| [references/materials/fasteners.md](references/materials/fasteners.md) | bolts, screws, rivets, feet, casters, brackets |
| [references/prints.md](references/prints.md) | a 3D-printed part |
