# Writing the build order and the steps

Read this when writing the steps. The steps are what a person reads with gloves on. Write them like an IKEA guide: short imperative lines, every number from the model, every step ends with a check you can pass or fail before you move on. Leave out anything an experienced builder can infer; teaching belongs in the guide, not the step.

## The order

One sequence fits every build: **make** each piece, **join** them loosely, **check** the whole, **fix** it for good, then **fit** what the earlier work would spoil. Each joining method has its loose and its fixed form:

| Joined by | Loose | Fixed |
|---|---|---|
| Welding | tack | weld out, in short stitches alternating sides so the heat does not pull it out of square |
| PVC solvent cement | dry fit, marked | cement, one joint at a time, in the dry-fit order |
| Glue and screws (timber) | dry fit, clamped | glue and screw |
| Bolts | snug | tighten, once it is square |
| Prints, connectors, wire | fitted | sealed or tied down after the test |

The kit's three phases follow from it:

1. **Fabricate**: cut, drill and print every piece (start prints first: they take hours and run while you cut). Build the biggest flat sub-frame first on a flat table, then join the sub-frames, then check every coordinate and diagonal before anything is fixed. Plates, tabs and feet from the real frame, last.
2. **Finish**: clean, prime, paint or oil. Fit tops, decks and sheet.
3. **Assemble**: bought parts, wiring and routing, then a gentle, staged test up to the rating (a load test, a leak test, a tune).

Never fix what you have not measured. Nothing hot, dusty or wet near a part it would spoil: paint, wood, plastic, prints and electronics come after.

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

## Can it get there?

The model shows where each part ends up, not how it got there. Before a step fits a part, walk its path: what is already built round this spot, can the part pass it, and can a hand and a tool reach it to fasten it? A part goes in before whatever closes round it, or is sized to pass through the opening that is left. The same holds for everything that runs through the build: a cable, hose or pipe is threaded while its path is still open, with its connector on the end that can pass.

Typical traps, all one mistake: a deck larger than the opening of a rack already welded round it; a sheet between posts tied top and bottom; a wheel on an axle welded at both ends; a plug that must go up a mast after the hub is bolted on.

If the order alone cannot solve it, change the design, and say in the step how the part goes in ("lower each deck down through the frames, the lowest first").

## Phrases that fail

- "Assemble the frame." (Which pieces, in what order, held how, checked how?)
- "Cut the legs to 850 mm." (Hard-coded: wrong as soon as someone types a new height, and wrong in inches. Use the piece mark; the cut sheet has the length.)
- "Weld everything." (In what order? A frame welded one corner at a time pulls out of square.)
- "Make sure it is square." (Measure what, to what tolerance?)
- "Tack each joint, which means a small weld that just holds it, on two faces so that it does not move." (Teaching in the step: say "Tack each joint on two faces."; the `?` explains tack.)
- "Optionally add bracing if needed." (The checks decide what is needed; the model either has the brace or does not.)
- "Screw the decks down." on a rack already welded shut round them. (How did the decks get in? See "Can it get there?" above.)
- "Run the cable down the mast." (In or on it? Where does it enter and leave, and when is the connector fitted?)
- A step that fits a part the materials list does not have, or a part on the list that no step fits. (The audit fails a part without a step.)

## Safety lines

Put them where they apply, once: eye and hand protection before the first cut; ventilation and no galvanised tube in a weld step (or grind the zinc off first); "lift with two people" for anything over about 25 kg; a gentle, staged load test in the last step.
