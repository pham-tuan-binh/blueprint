# 3D-printed parts

A print is a part like any other: it has a step, it shows in the 3D view and the drawings, it is on the materials list, and the person gets the files to print it. The page cuts the exact part at the current size, so a print that holds a pipe follows the pipe size the person picks.

## When to print

Print it when a fabricated part would be fiddly or a bought one does not exist:

- a hub where members meet at odd angles (the feed point of a V antenna, a node of a PVC dome)
- a saddle, clamp or clip onto a pipe or tube
- a holder for a connector, a switch, a sensor or a cable gland
- a drilling or cutting jig that makes repeated parts identical
- feet, caps, bumpers and spacers (TPU for anything that should give)

Do not print the main load path of anything heavy, anything a person stands on, or anything hot. Prints are strongest in compression and clamping and weakest when the layers are pulled apart.

## In the model

```js
prints: [{
  id: 'hub', name: 'Feed hub', step: 1, qty: 1,
  material: 'PETG', layer: 0.2, walls: 4, infill: 0.4, supports: false,
  bed: '+z', orient: 'top face down, socket pointing up; no supports',
  shapes: [
    { type: 'tube', a: [0, 0, z0], b: [0, 0, z1], r: 18, ri: pipeOD / 2 + 0.3 },   // socket onto the mast
    { type: 'cyl', a: [0, 0, z1], b: armEnd, r: 7 },                              // an arm
    { type: 'box', c: [0, 0, zTop], s: [40, 30, 8] },                             // a pad
    { type: 'prism', pts: [[0, 0], [30, 0], [0, 30]], z0: 0, h: 5, axis: 'z' },   // a gusset
  ],
  cuts: [
    { type: 'hole', a: armStart, b: armEnd, d: rodD + 0.4 },                      // a bore for a rod
    { type: 'hole', a: [x, y, zTop - 10], b: [x, y, zTop + 10], d: 6.4 },          // a connector hole
  ],
  note: 'Push the rods in until they bottom out; one M3 grub screw each.',
}]
```

- Everything is in the plan's coordinates (mm), so the print sits where it goes in the 3D view and the drawings.
- `bed` is the face, in plan axes, that goes down on the printer bed: `'-z'` (as modelled, the default), `'+z'` (upside down), `'-x'`, `'+x'`, `'-y'`, `'+y'`. The STL and .scad come out turned that way and moved onto the bed at the origin, so the person never rotates it in the slicer. Say the same in `orient`.
- `shapes` are unioned; `cuts`, and the bore of every `tube`, are taken out. Overlap solids by a millimetre where they join. A `tube`'s bore cuts through everything it overlaps, so where a bore must stop against a plate, use a `cyl` and a `hole` cut of the length you want instead.
- Cuts can be `hole` (round, from a to b), `cyl` or `box` (a pocket or a slot) or `prism` (a shaped pocket).
- `prism` extrudes a 2D outline: `axis: 'z'` takes `pts` as [x, y]; `'x'` as [y, z]; `'y'` as [x, z].
- `material`: PLA, PETG, ASA, ABS, TPU or PA. `infill` is 0 to 1. `orient` is the sentence the step prints after "print it".
- A print touches what it holds, like a plate (the floating check sees it); `on: 'member-id'` names a holder it does not touch.
- `copies: [{ move: [dx, dy, dz], rotZ: deg, about: [x, y, z] }]` places the same part again: clips along an arm, feet under a frame. Each copy is turned about a vertical axis through `about` (default the origin), then moved. They all show in the 3D view and the drawings; there is one STL, and the quantity is the copies plus one (or `qty`).

## Design rules

| | |
|---|---|
| Walls | at least 3 perimeters (1.2 mm with a 0.4 mm nozzle); 2.5-4 mm around a bore that is clamped or pushed into |
| Clearance for a pipe or rod | bore = diameter + 0.3 to 0.5 mm (a push fit); + 0.8 mm for a sliding fit |
| Bolt holes | + 0.3 mm (M3: 3.3, M4: 4.3, M5: 5.3). For threads in plastic use heat-set inserts or a nut trap, not tapped plastic |
| Connector holes | SMA bulkhead 6.4 mm; BNC 9.6 mm; a 6 mm panel jack 6.3 mm |
| Overhangs | 45° or less, or design a chamfer, so it prints without supports; say `supports: true` only when there is no way round it |
| Orientation | the layers are weakest pulled apart: keep a pulling or bending load across the layers, not along the stack (a hook printed standing up snaps at a layer; printed lying down, it holds). A socket clamped round a pipe is fine either way, since its hoop load runs in the layers; pick the side that prints without supports |
| Outdoors | ASA or PETG, 4 walls, 40% infill or more. PLA creeps and softens in the sun |

## In the pack

The kit does this for every print:

- the 3D view shows the exact part, holes and all
- a check that every print fits the printer (`printer: { bed: [x, y, z] }` on the model, default 220 × 220 × 250 mm), turned the way the files come
- its drawing shows every cut dashed, with a table of the holes, bores and pockets (size, axis, position) and its size on the bed
- the materials list has a **3D prints** table with the settings, an estimate of filament (g) and print time (h), and **.stl** and **.scad** download buttons
- the step it is in shows a dimensioned drawing, the settings, the orientation and the download buttons
- the facts show the number of prints and the filament

Fits and walls are yours to check: put them in a plan check (the bore against the rod or pipe it takes, the thinnest wall round a clamped bore). Format the sizes with `u.fine()`, which keeps a tenth of a millimetre (4.3, 0.4), since `u.len()` rounds to whole millimetres.

Put the printing in the first step, or the first step that needs the part: it takes hours, and the person can cut and drill while the printer runs. The estimates come from the volume, so call them estimates; the slicer has the real numbers.
