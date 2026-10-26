# Writing the build order and the steps

The steps are what a person reads with gloves on. The rule: short imperative lines, every number from the model, every step ends with a check you can pass or fail before you move on.

## The order

Two or three phases, in this order:

1. **Fabricate**: everything with a saw, grinder, drill or welder.
   1. *Cut and prep*: cut every piece from the cutting plan, deburr, label the piece mark on each, count against the cut list. Drill plates now if they are flat.
   2. *Sub-frames, tacked*: the biggest flat frame first, on a flat table (the top frame upside down, or two end frames). Tack only.
   3. *Join, tacked*: stand the sub-frames up, join them with the connecting rails, top level first, then the rest. Square it up while it is only tacked.
   4. *Weld out*: re-check every coordinate and diagonal, then weld in short stitches, alternating sides and corners so the heat does not pull it out of square. Clamped until cold.
   5. *Plates, tabs and feet*: from the real frame, welded last.
2. **Finish**: clean, prime, paint (or oil timber). Fit the top, decks, sheet.
3. **Assemble** (if there are bought parts): feet, casters, vise, drawers, wiring. Level it, then load-test it gently up to its rated load.

All welding before paint. All tacking before welding. Never weld a frame you have not measured.

## A step

```js
{ n: 2, phase: 'Fabricate', title: 'Top frame (tack)', hours: 2, views: ['top'],
  tasks: [
    'Lay the two long rails (A) and two end rails (B) upside down on the table, top faces down.',
    `Set them to the outside size ${u.len(L)} × ${u.len(D)}; legs stand in the corners in step 3.`,
    'Clamp each corner square and tack each joint top and bottom.',
  ],
  check: `Diagonals equal within ${u.len(2, { u: true })}; frame flat on the table at all four corners.`,
  tip: 'Tack only: the frame is welded out in step 4, once the legs are on.' }
```

- **Title**: what you end up with, plus `(tack)` when nothing is welded out yet. "Top frame (tack)", "Weld out", "Feet and levellers".
- **Tasks**: three to seven lines, each one action. Start with a verb. Refer to pieces by mark ("rails (A)"), say where they go (the jig drawing and the joint table under the step show the numbers), how they are held, and what to measure.
- **Numbers**: only from the model, formatted with `u`. A plain integer the user can measure (a count of pieces, "two screws per rail") is fine.
- **Check**: a measurement with a tolerance, or a test (diagonals, plumb, level, rocks or not, flat on the table). It is the gate to the next step.
- **Tip**: optional. The mistake people make here, or why the step is done this way.
- **hours**: honest time for one competent person, not counting paint drying. The page totals them.

## Phrases that fail

- "Assemble the frame." (Which pieces, in what order, held how, checked how?)
- "Cut the legs to 850 mm." (Hard-coded: wrong as soon as someone types a new height, and wrong in inches. Use the piece mark; the cut sheet has the length.)
- "Weld everything." (In what order? A frame welded one corner at a time pulls out of square.)
- "Make sure it is square." (Measure what, to what tolerance?)
- "Optionally add bracing if needed." (The checks decide what is needed; the model either has the brace or does not.)
- A step that fits a part the materials list does not have, or a part on the list that no step fits. (The audit fails a part without a step.)

## Safety lines

Put them where they apply, once: eye and hand protection before the first cut; ventilation and no galvanised tube in a weld step (or grind the zinc off first); "lift with two people" for anything over about 25 kg; a gentle, staged load test in the last step.
