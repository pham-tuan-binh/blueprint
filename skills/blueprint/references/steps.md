# Writing the build order and the steps

The steps are what a person reads with gloves on. Write them like an IKEA guide: short imperative lines, every number from the model, every step ends with a check you can pass or fail before you move on. Leave out anything an experienced builder can infer; teaching belongs in the guide, not the step.

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
    'Rails (A, B) upside down on the table.',
    `Outside ${u.len(L)} × ${u.len(D)}.`,
    'Clamp square. Tack each joint top and bottom.',
  ],
  check: `Diagonals equal ${u.tol(2)}. Flat at all four corners.`,
  tip: 'No welding until step 4.' }
```

On the page the step opens with its number big (64 px), the title and the time, with a 3D view beside the steps that follows the one being read; the tasks are numbered checkboxes; `check` prints after a circled ✓ and `tip` after a filled !. No boxes.

- **Title**: what you end up with, plus `(tack)` when nothing is welded out yet. "Top frame (tack)", "Weld out", "Feet".
- **Tasks**: two to six lines, each one action, as short as it can be and still be clear. Start with a verb or the part. Refer to pieces by mark ("Rails (A)"); the jig and the joint table show where they go, so do not repeat coordinates in prose.
- **Numbers**: only from the model, formatted with `u`. A plain count ("two screws per rail") is fine.
- **Check** (✓): a measurement with a tolerance, or a test (diagonals, plumb, level, rocks or not). It is the gate to the next step.
- **Tip** (!): a warning only: the mistake that costs the build, or a safety line. Not an explanation.
- **hours**: honest time for one competent person, not counting paint drying. The page totals them.
- **Explanations go to the guide.** These words get a `?` automatically the first time they appear in a step, opening a short explanation that links into the plan's guide: tack, weld out, mitre, diagonals, plumb, deburr, long point, datum, solvent cement, dry fit, load test, cutting plan, piece mark. Use the words; do not explain them in the task.

## Phrases that fail

- "Assemble the frame." (Which pieces, in what order, held how, checked how?)
- "Cut the legs to 850 mm." (Hard-coded: wrong as soon as someone types a new height, and wrong in inches. Use the piece mark; the cut sheet has the length.)
- "Weld everything." (In what order? A frame welded one corner at a time pulls out of square.)
- "Make sure it is square." (Measure what, to what tolerance?)
- "Tack each joint, which means a small weld that just holds it, on two faces so that it does not move." (Teaching in the step: say "Tack each joint on two faces."; the `?` explains tack.)
- "Optionally add bracing if needed." (The checks decide what is needed; the model either has the brace or does not.)
- A step that fits a part the materials list does not have, or a part on the list that no step fits. (The audit fails a part without a step.)

## Safety lines

Put them where they apply, once: eye and hand protection before the first cut; ventilation and no galvanised tube in a weld step (or grind the zinc off first); "lift with two people" for anything over about 25 kg; a gentle, staged load test in the last step.
