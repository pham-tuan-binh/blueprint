# 3D-printed parts

Read this when the plan has a printed part. A print is a part like any other: a step, the 3D view, the drawings, the materials list, and its files. The page builds the exact part at the current size, so a clamp follows the pipe size the person picks.

## When to print

Where a fabricated part would be fiddly or a bought one does not exist: a hub where members meet at odd angles, a saddle, clamp or clip on a pipe, a holder for a connector, switch or gland, a drilling or cutting jig, feet, caps and spacers (TPU where it should give). Never the main load path of anything heavy, stood on or hot. Prints are strong in compression and clamping, weak when layers are pulled apart.

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
    { type: 'box', c: [0, 0, zTop + 2], s: [20, 12, 6] },                         // a pocket
  ],
  copies: [{ rotZ: 120, about: [0, 0, 0] }],                                       // optional: the same part again
  note: 'Push the rods in until they bottom out; one M3 grub screw each.',
}]
```

- Plan coordinates (mm), so it sits where it goes.
- `shapes` are unioned; `cuts` and every `tube` bore are taken out. Solids: `box`, `cyl`, `tube`, `prism`, `sphere`, `mesh` (`k.shapes` or your own closed mesh). Cuts: `hole` (round, a to b, diameter `d`), `cyl`, `box`, `prism`.
- `prism` extrudes an outline: `axis: 'z'` takes `pts` as [x, y]; `'x'` as [y, z]; `'y'` as [x, z].
- Overlap solids that join by a millimetre, and run a cut 1 mm past any face it opens. A `tube` bore cuts through everything it overlaps; to stop a bore against a plate, use a `cyl` and a `hole` of the length you want.
- `bed`: the face that goes down on the bed, `'-z'` (default), `'+z'`, `'-x'`, `'+x'`, `'-y'`, `'+y'`. The STL and .scad come out turned that way, at the origin. Say the same in `orient` (the step prints it after "print it").
- `material`: PLA, PETG, ASA, ABS, TPU, PA. `infill` 0 to 1.
- A print touches what it holds (the floating check sees it); `on: 'member-id'` names a holder it does not touch.
- `copies: [{ move, rotZ, about }]`: each copy turned about a vertical axis through `about`, then moved. One STL; quantity is copies plus one (or `qty`).

## Design rules

| Rule | Value |
|---|---|
| Walls | 3 perimeters at least (1.2 mm on a 0.4 nozzle); 2.5-4 mm round a clamped or pushed-in bore |
| Pipe or rod bore | diameter + 0.3 to 0.5 (push fit); + 0.8 (sliding); a split clamp: diameter + 0.2, with a 2-3 mm slot and a bolt across it to close it |
| Bolt holes | + 0.3 (M3 3.3, M4 4.3, M5 5.3). Threads: heat-set inserts or a nut trap, not tapped plastic |
| Connector holes | SMA bulkhead 6.4; BNC 9.6; 6 mm panel jack 6.3 |
| Overhangs | 45° or less, or a chamfer; `supports: true` only when there is no way round it |
| Orientation | keep pulling or bending loads across the layers, not along the stack. A clamped socket is fine either way; pick the side without supports |
| Outdoors | ASA or PETG, 4 walls, 40% infill or more. PLA creeps and softens in the sun |

Fits and walls are yours to prove: a plan check for each bore against what it takes and the thinnest clamped wall, sizes in `u.fine()`.

The frame solver does not analyse prints. When a print carries load (an arm, a bracket, a hook), prove it with a plan check by hand: bending stress M / Z at its root at most a quarter of the filament's strength (PLA 50, PETG 45, ASA 40, PA 60 MPa along the layers; halve it across them). If it cannot pass, it is not a print's job.

## What the kit does with it

- The 3D view, a drawing with every cut dashed and a hole table, its size on the bed, and a check that it fits the printer (`printer: { bed }`, default 220 × 220 × 250).
- The materials list's **3D prints** table: settings, filament (g) and time (h) estimates from the volume, and **.stl** / **.scad** downloads.
- The STL is built with manifold-3d: one closed, watertight solid every time. The .scad is its OpenSCAD source with the same facets. Capture proves every STL watertight at every end of every field.
- Print in the first step that needs the part: it takes hours, and the person can cut while it runs.
