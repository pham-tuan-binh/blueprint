# Structure and loads

Read this when laying out a frame. Stock sizes and material rules are in `references/materials/`. How to lay out a frame so the joint solver, the checks and a person with a saw and a welder all agree. In short: square tube, straight cuts, no bending, a flat table, tack everything, weld out once.

## Joints

The joint solver decides each joint from the geometry (`kit/joints.mjs`). Design so it lands on the joint you want:

| You want | Model it as |
|---|---|
| A leg that runs to the top with rails welded to its sides | leg with `prio: 1`, rails ending at the leg's centre line node. The leg is cut flush with the top of the rails; rails butt square onto its faces. |
| A rail halfway up a leg | an interior node in the leg's `pts`; the rail ends at it and butts onto the leg's face. |
| A picture-frame corner (two rails, same section, nothing else) | two members ending at the same node, no `prio`: mitred on the bisector. |
| A brace | `brace: true`, ending on nodes of the outline members. It butts with an angled cut; the cut sheet gives the marks. |
| A cross member between two rails | ends on interior nodes of the two rails: butts square onto their faces. |
| A piece that only rests or bolts on | `loose: true`, or model it as a plate / hardware. |

Rules the joint check enforces: a member never butts onto a smaller one (its edges would hang past the face), mitred pairs are the same section, no joint eats a whole member. Rules you keep yourself:

- **Centre lines meet.** Nodes are where centre lines cross. A rail that should sit flush with the top of a leg has its node at the rail's centre height; the leg's `prio` cut makes the top flush.
- **Flush tops.** For a top that sits on a frame, put every top-frame member at the same centre height and give legs `prio`. For rails of different heights, align them on top by putting each node at `top - section height / 2`.
- **Offsets are nodes too.** A shelf rail set in from the leg face is still a member between two nodes; put the nodes where the centre line really runs.
- **Same section around a rectangle** keeps every joint simple. Use a smaller section only for braces and shelf supports, and only where it lands on a face at least as big.

## Racking, braces and feet

A rectangle of tube welded at the corners resists racking only through its welded corners. For anything people push or lean on, check a sideways load (a shove of 300-500 N at the top, or 5% of the load sideways). If it fails or sways more than a few mm, add a lower rail rectangle (a shelf frame doubles as one), a back brace, or gussets. Prefer a lower frame: it is also a shelf.

Feet: a bare tube end marks floors and rocks. Use a foot plate (steel, welded under each leg, the leg's size or a little bigger) with a hole for a levelling foot or an anchor, or casters on a plate. Levelling feet are bought hardware with a `shape` so they show and carry the frame.

## Loads and safety factors

Write load cases for the job and for abuse:

| Thing | Job | Abuse |
|---|---|---|
| Workbench | its rated load spread over the top frame | 100-150 kg on one corner, 400 N shove sideways at the top |
| Shelf / rack | every shelf at its rated load | 5% of the total sideways, or a bump at the top |
| Table | 100 kg spread | a person sitting on one edge (100 kg at the middle of a long rail) |
| Stand / cart | its payload where it sits | payload at the worst corner; tip with a push at the top |
| Anything stood on | the person + 50% | 2 × the person at the worst point |

Safety factor (yield ÷ peak stress, what the checks report): at least 2 for furniture, benches and racks; 3 for anything a person stands on, sits on or hangs from; and never rely on the factor for lifting gear or vehicles (that is a Machine: see SKILL.md). Deflection: a work surface span/300 at its rated load; a steel shelf span/250 (wooden shelves span/600, since wood creeps: `materials/timber.md`); a rail or rack where sag only has to stay out of sight (a drying or hanging rail) span/80, with a floor of about 10 mm. The deflection the kit reports is how far the loaded member moves, frame and all (posts bending, joints turning), not only its own span sagging, so a tall, light frame can fail it with a short span.

Tip-over: add `tip: { N, height, sf: 1.5 }` for anything taller than about 1.5 × its depth, and for anything people push at height (a bench being planed or filed on). Use a realistic push: 150 N at the top of a rack; 150 N at work height for a light bench, 300 N for a bench used hard (vise work, planing). A light steel bench (40-60 kg) rarely passes 300 N free-standing: a heavy top, a wider stance, or anchoring fixes it. If it only passes anchored, fit the anchors in a step (as hardware in that step) and name it: `anchored: 'step 8, four M8 anchors'`. The audit checks that step fits anchors, bolts or screws. Say plainly in that step that it must be anchored.

The tip check counts the frame's own weight only: a load it carries can be taken off, so the empty frame is the case that tips. A light frame (PVC, aluminium, a few kg) fails any real push, so for those size the push to what really happens (a bump, 20 N at the top; wind on what hangs from it), and when it still fails, widen the stance with a plan check that ties the foot spread to the height (the drying stand: feet at least 0.75 × height), or weigh it down and say so in a step.
