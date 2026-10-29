# The design.mjs schema

Read this when writing `design.mjs`. `examples/shelf-rack/design.mjs` (in the skill folder) is the whole shape in about 150 lines: read it top to bottom first.

## Contents

- The plan object
- Units
- params: the input fields
- build(p, k): what `k` holds
- The model: members, plates, hardware, shapes, supports and loads, steps, checks

## The plan object

A plan is one file that exports `plan` and imports nothing. `derive()` calls `plan.build(p, k)` on every input change, in Node for the audit and in the browser for the page, so `build` must be **pure**: same params, same model; no randomness, dates or network.

```js
export const plan = {
  id: 'metal-workbench',          // kebab-case; also the key for saved ticks on the page
  name: 'Welded steel workbench', // the page title
  version: '1',
  summary: 'One sentence: what it is, what it holds, how it is built.',   // the gallery card
  author: { github: 'handle', name: 'Name' },   // optional; needed to share it (blueprint-share)
  units: 'metric',                // or 'imperial' when the user asked for it
  currency: '$',                  // optional; prices are in it
  params: [ /* input fields */ ],
  build(p, k) { return { /* the model */ }; },
};
```

## Units

- The model is always millimetres, kilograms and newtons. The page's mm / in switch only changes how numbers print, so stock never depends on it.
- Imperial (only when asked): `units: 'imperial'`, imperial stock (`squareTube(inch(1.5), inch(0.083))`, `stockLen: feet(20)`), round inch defaults and limits (`inch(60)`).
- Every size in any text goes through `k.u`: `u.len(v)` (bare, for tables and drawings: `1500` or `59 1/16"`), `u.len(v, { u: true })` (with its unit, for sentences), `u.fine(v, { u: true })` (to a tenth: drills, clearances, walls), `u.size(v)` (overall: `1.50 m`, `4' 11"`), `u.mass(kg)`, `u.tol(mm)` (`±1 mm`), `u.force(N)`. That covers tasks, checks, facts, notes, hints, option labels and `tolerance`. The audit fails "mm" left in imperial and inch marks left in metric.
- Bought parts keep their trade names ("Tee, 32 mm solvent weld", "M8 × 25"): the lint leaves hardware names and specs alone.
- A shared link carries the params in the hash, always in mm and kg, bools `1`/`0`: `#length=1828.8&shelf=0` (the same for `--hash`). Imperial fields show and take fractions (`59 1/16`).

## params: the input fields

```js
{ id: 'length', label: 'Length', type: 'len', value: 1500, min: 900, max: 2400, group: 'Size', hint: 'top, end to end' }
```

| type | value | the field |
|---|---|---|
| `len` | mm | mm or inches, by the units switch |
| `kg` | kg | kg or lb |
| `count` | an integer | a number |
| `number` | a plain number (`unit: '°'`) | a number with its unit |
| `choice` | one of `options: [{ value: 'steel', label: u => `${u.len(5, { u: true })} steel plate` }]` | a select |
| `bool` | true / false | a checkbox |

- `min` / `max` may be functions of the params declared **before**: `max: p => Math.floor((p.height - 270) / 250) + 1`.
- `hint` and option `label` are strings, or functions of `u` when they name a size.
- `group` puts fields under a heading (Size, Load, Options). Overall size first.
- Params are plain data outside `build`; for imperial define helpers at the top of the file: `const inch = v => v * 25.4, lb = v => v / 2.2046;`.

## build(p, k)

`p` holds the resolved params (clamped, counts rounded). `k` holds:

| name | use |
|---|---|
| `k.u` | units, above |
| `k.squareTube(b, t, o)`, `k.rectTube(bu, bw, t, o)`, `k.roundTube(d, t, o)`, `k.flatBar(b, t, o)`, `k.bar(bu, bw, o)`, `k.timber(bu, bw, o)`, `k.rod(d, o)`, `k.pvcPipe(d, t, o)` | stock sections. `bu` = width across (horizontal), `bw` = height. `o`: `{ id, label, short, stockLen, price (per m) or pricePerFt, material }` |
| `k.inch(v)`, `k.feet(v)` | imperial sizes in mm |
| `k.MATERIALS` | steel, stainless, aluminium (welded), aluminium-bare (bolted), timber, pvc, copper, copper-annealed, brass: `material:` in a section's `o` |
| `k.FILAMENTS` | PLA, PETG, ASA, ABS, TPU, PA |
| `k.shapes` | mesh generators, below |
| `k.v3` | vector helpers |

## The model

```js
return {
  sections: { LEG: squareTube(40, 3, {...}), RAIL: ... },   // keys used by members[].sec
  axes: { x: ['right', 'left'], y: ['back', 'front'], z: ['top', 'bottom'] },  // names of +/- each axis
  datum: 'x from the left end of the top, y from the front edge, z up from the floor',
  nodes: { FL0: [x, y, z], ... },            // centre-line points, mm
  members: [...], plates: [...], hardware: [...],
  prints: [...],                             // references/prints.md
  consumables: [{ name: 'MIG wire, 0.8 mm', qty: '1 kg spool', note: '' }],
  tools: ['MIG welder', '...'],
  supports: [{ at: [x, y, z], fix: 'pin' }], // 'pin' (feet), 'fixed', 'roller'
  loads: [...],
  tip: { N: 300, height: 900, sf: 1.5 },     // optional; anchored: 'step 8, four M8 anchors' when fixed down
  checks: [{ name, pass, value, why }],      // the plan's own checks
  steps: [...],
  facts: [['Top', '14 steel bars', 'RHS 40×20 laid flat']],   // optional; what the fields do not already say
  join: 'weld',                              // 'weld', 'bolt', 'screw', 'glue', 'solder', 'clamp': the legend wording
  kerf: 2, trim: 10, minPiece: 32,
  tolerance: `cut ${u.tol(1)}; feed gap ${u.tol(0.5)}`,   // when the frame default does not fit
  printer: { bed: [220, 220, 250] },         // the bed the print check uses
  orderNote: 'One line above the build order.',
};
```

### members

```js
{ id: 'leg-FL', name: 'Leg', sec: 'LEG', pts: ['FL0', 'FL1', 'FL2'], step: 2, prio: 1 }
```

- `pts`: the centre line, first to last node. Interior nodes lie on that line: they are where other members meet it, and make this member the receiver there.
- `prio: 1`: runs past corners (legs, posts), cut flush with the outer face of the biggest member it meets; the rest butt onto its faces. Without it, two equal sections at a corner are mitred.
- `brace: true`: always butts onto the outline members, never wins a corner. `roll: 90`: a rectangular section the other way up. `cap: true`: an open end that gets a plastic cap. `loose: true`: bolted on, left out of the frame analysis. `tone`: `'hi'` (default), `'mid'`, `'lo'`, `'faint'`.
- Identical pieces share a piece mark automatically. End rails and cross rails often come out the same length: give members that will share a mark one name ("Short rail"), or the sheet prints "End rail / Cross rail".

### plates

```js
{ id: 'foot-FL', name: 'Foot plate', c: [x, y, z], s: [sx, sy, sz], step: 4,
  material: 'steel', holes: [{ at: [a, b], d: 10 }], note: 'Weld all round.', price: 1.5 }
```

- An axis-aligned box, centre `c`, size `s`; the thinnest axis is the thickness. Holes are on the two biggest axes, from the lower-left corner.
- Plates count in the overall size: keep foot plates inside the footprint, or the "Overall" grows past the length typed.
- `notch: true`: members pass through it (a lower shelf round the legs); the kit cuts, draws and dimensions the notches. Without it, that is a clash.
- `material`: plywood, mdf, timber, steel, aluminium, pvc, hdpe, acrylic, polycarbonate, copper, brass, fr4 (or `rho` in kg/mm³). `materialLabel` overrides the printed word only. `drawing: false` for sheet goods that need no drawing. `price` per piece, `tone`, `on: 'member-id'` when held by something it does not touch.
- Identical plates share a mark (P1, P2).

### hardware

```js
{ id: 'leveler', name: 'Levelling foot, M12', spec: '50 mm base, 500 kg', qty: 4, step: 6, kg: 0.2, price: 3,
  shape: [{ type: 'cyl', a: [x, y, 0], b: [x, y, 40], r: 25 }] }
```

- Anything bought. `shape` (a box `{ type: 'box', c, s }`, cylinder `{ type: 'cyl', a, b, r }`, sphere `{ type: 'sphere', c, r }`, mesh, or a list) draws it and makes it count in the floating check; `kg` adds to the mass and analysis; `on: 'id'` names what holds it if it does not touch it.
- **A fitting** (PVC tee, clamp, socket): put each pipe's nodes where the pipe really ends (the socket bottom) and give the fitting a `shape` round the joint; with `qty` above 1, one list per piece (`shape: [[run, branch], ...]`). Ends inside it read "into the tee", pipes meeting inside it are not a clash, and the analysis joins them. `examples/pvc-drying-stand` does this.
- Entries with the same `name`, `spec` and `price` merge into one line with the total quantity.

### shapes

Bought parts and prints take their real shape. Beyond `box`, `cyl`, `sphere` (and for prints `tube`, `prism`), any shape is a **mesh** `{ type: 'mesh', pts, tris }`: points in mm, triangles as index triples facing outward, closed. The 3D view, drawings and prints all take it. `k.shapes` builds them:

| | |
|---|---|
| `sphere(c, r)` | a ball, a knob |
| `cone(a, b, r1, r2)` | a cone or frustum (a foot, a funnel) |
| `sweep(path, r)` | a round tube along points (a hose, a cable, a bent rail) |
| `arc(c, from, axis, deg)` | points along an arc, for `sweep` |
| `bend(c, from, axis, deg, r)` | a curved tube (an elbow body, a bent handle) |
| `elbow(c, d1, d2, z, sock, rHub, rBody)` | a pipe elbow at centre `c`, openings along `d1`, `d2` (any angle): two socket hubs and a curved body, as a list |
| `revolve(profile, a, b)` | `[[radius, height], ...]` spun about an axis (a bottle, a wheel) |
| `extrude(outline, z0, h, axis)` | a convex outline pushed out (split a concave one) |

When none fits, compute the points and triangles yourself. A PVC elbow is `elbow(...)`, never two cylinders meeting at the centre. A shape that keeps coming up belongs in `kit/shapes.mjs`.

### supports and loads

```js
supports: legs.map(n => ({ at: nodes[n], fix: 'pin' })),
loads: [
  { id: 'spread', name: 'Spread load on the top', kg: p.load, what: 'spread over the top', on: ['rail-F', 'rail-B'], sf: 2, defl: p.length / 300 },
  { id: 'corner', name: 'Point load at a corner', kg: 150, at: [[x, y, z]], sf: 2 },
  { id: 'shove', name: 'Shoved sideways', N: 400, dir: [1, 0, 0], on: ['rail-F'], sf: 2 },
]
```

- Supports must hold the frame still in every direction, or the solver reports a mechanism. Two `pin`s on one vertical line (a mast in two clamps) leave it free to spin: make one `fixed`.
- `kg` (or `N`) is spread over every node of the members in `on` and/or the points in `at` (snapped to the nearest member). `dir` defaults to down. Self weight is always added.
- `what` reads after the load in the check: "Yield ÷ peak stress with 150 kg *on one corner*".
- `parts: [{ on, at, kg | N, dir }, ...]` makes one case of several loads together (drag up a mast plus a load at its head).
- `sf`: required safety factor on yield. `defl`: largest movement allowed at the loaded points, mm.
- Plates are not in the analysis: put the load on the members that carry the top. `loose` members are left out but their weight still bears.

### steps

```js
{ n: 2, phase: 'Fabricate', title: 'Top frame (tack)', hours: 2, views: ['top'],
  summary: 'Optional one line.',
  tasks: ['Short imperative lines, sizes from u.', p.shelf && 'A falsy task is dropped.'],
  check: `Diagonals equal within ${u.len(2, { u: true })}.`,
  tip: 'Optional warning.' }
```

- Numbered 1, 2, 3 with no gaps; `phase` groups them; `hours` is honest time for one person; `views` picks the jig views (`'top'`, `'front'`, `'side'`).
- `{mark:member-id}` in any step text, check or plate note prints that piece's mark; marks are assigned after `build()`, so this is the only way to write them.
- `alone: true` draws a sub-assembly on its own. `points: false` drops the point labels and joint table for parts placed by a rule; `table: { title, head, rows }` adds the step's own table instead. A column headed `✓` or listed in `ticks: [i]` gets checkboxes, `fill: [i]` gets number fields; both are saved on the device and print as boxes for a pen.
- Every member, plate, part and print has a `step`. Not modelled, so write them as tasks: holes in members, bends, copes.

### checks

```js
{ name: 'Knee room under the top', pass: clear >= 600, value: u.len(clear, { u: true }), why: 'Sit at it on a stool.' }
```

Anything the kit cannot know: a clearance, a work height, a span, an element length. The audit requires them at every size.
