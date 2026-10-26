# Structure, loads and stock

How to lay out a frame so the joint solver, the checks and a person with a saw and a welder all agree. In short: square tube, straight cuts, no bending, a flat table, tack everything, weld out once.

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

Safety factor (yield ÷ peak stress, what the checks report): at least 2 for furniture, benches and racks; 3 for anything a person stands on, sits on or hangs from; and never rely on the factor for lifting gear or vehicles (that is a Machine: see SKILL.md). Deflection: a work surface span/300 at its rated load; a shelf span/250.

Tip-over: add `tip: { N, height, sf: 1.5 }` for anything taller than about 1.5 × its depth, and for anything people push at height (a bench being planed or filed on). Use a realistic push: 150 N at the top of a rack; 300 N at work height for a bench used hard. A light steel bench (40-60 kg) rarely passes 300 N free-standing: a heavy top, a wider stance, or anchoring fixes it. If it only passes anchored, fit the anchors in a step (as hardware in that step) and name it: `anchored: 'step 8, four M8 anchors'`. The audit checks that step fits anchors, bolts or screws. Say plainly in that step that it must be anchored.

## Metric stock (default)

Common in Europe, Asia and Australia; sold in 6 m lengths (`stockLen: 6000`). Mild steel S235 / SS400 / A36-equivalent.

| Use | Section | Notes |
|---|---|---|
| Light frames, shelves, braces | SHS 20×20×1.5, 25×25×1.6, 25×25×2 | easy to cut by hand |
| Benches, tables, racks | SHS 30×30×2, 40×40×2, 40×40×3 | 40×40×3 for legs of a heavy bench |
| Heavy benches, stands, carts | SHS 50×50×3, RHS 50×25×2, 60×40×3, 80×40×3 | RHS on edge for long rails |
| Flat bar | 25×5, 30×5, 40×5, 50×6 | tabs, shelf supports |
| Plate | 3, 5, 6, 8, 10 mm | 5-6 mm for feet and tabs; 5-10 mm for a steel bench top |
| Sheet | 1.5, 2 mm steel; 18 mm plywood; 25-30 mm MDF/hardwood top | |

Approximate prices (2026, USD, check local): SHS 40×40×2 about $4/m, 40×40×3 $5.5/m, RHS 60×40×3 $7/m, 5 mm plate about $45/m², 18 mm plywood $18/m².

## Imperial stock (when the user asks)

US / Canada; sold in 20 ft (`stockLen: feet(20)`) and 24 ft lengths. A500 / A513 mild steel. Wall gauge: 16 ga = 0.065", 14 ga = 0.083", 11 ga = 0.120", 3/16" = 0.1875".

| Use | Section (in) | In code |
|---|---|---|
| Light | 1 × 1 × 16 ga, 1 × 1 × 14 ga | `squareTube(inch(1), inch(0.083))` |
| Benches, tables | 1-1/2 × 1-1/2 × 14 ga, 1-1/2 × 1-1/2 × 11 ga | `squareTube(inch(1.5), inch(0.120))` |
| Heavy | 2 × 2 × 11 ga, 2 × 1 × 11 ga (rect), 2 × 3 × 11 ga | `rectTube(inch(1), inch(2), inch(0.12))` |
| Flat bar | 1 × 3/16, 1-1/2 × 1/4, 2 × 1/4 | `flatBar(inch(2), inch(0.25))` |
| Plate | 3/16", 1/4", 3/8" | `inch(0.25)` |
| Sheet | 3/4" plywood, 1-1/2" butcher block | |

Label imperial stock the way it is sold: `label: '1-1/2" × 1-1/2" × 11 ga square tube'`, `short: '1.5" SQ 11ga'`.

## Timber and bolted builds

The kit draws and cuts timber the same way (`timber(bu, bw)`, `join: 'screw'` on the model). Use butt joints with screws or bolts and a corner brace; the strength check uses a design bending strength, not yield. Use actual sizes (a 2×4 is 38 × 89 mm, `timber(38, 89)` laid flat or `roll: 90`).
