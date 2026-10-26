# The design.mjs schema

A plan is one file that exports `plan` and imports nothing. The build script bundles it with the kit; `derive()` calls `plan.build(p, k)` on every input change, in Node for the audit and in the browser for the page. `build` must be **pure**: the same params give the same model, no randomness, no dates, no network.

```js
export const plan = {
  id: 'metal-workbench',          // kebab-case; also the key for saved ticks on the page
  name: 'Welded steel workbench', // the page title
  short: 'Workbench',             // top bar
  version: '1',
  summary: 'One sentence: what it is, what it holds, how it is built.',
  units: 'metric',                // 'metric' (default) or 'imperial' when the user asked for it
  currency: '$',                  // optional; prices below are in it
  params: [ /* input fields, below */ ],
  build(p, k) { return { /* the model, below */ }; },
};
```

## params: the input fields

```js
{ id: 'length', label: 'Length', type: 'len', value: 1500, min: 900, max: 2400, group: 'Size', hint: 'top, end to end' }
```

| type | value is | the field shows |
|---|---|---|
| `len` | millimetres | mm or decimal inches (by the page's units switch), with the range |
| `kg` | kilograms | kg or lb |
| `count` | an integer | a number |
| `number` | a plain number (`unit: '°'`) | a number with its unit |
| `choice` | one of `options: [{ value: 'steel', label: u => `${u.len(5, { u: true })} steel plate` }]` | a select |
| `bool` | true / false | a checkbox |

- `min` / `max` may be functions of the params declared **before** this one: `max: p => Math.floor((p.height - 270) / 250) + 1`.
- `hint` (and an option `label`) is a string, or a function of the units when it names a size: `hint: u => \`middle legs above ${u.len(1800, { u: true })}\``. The audit fails a hard-coded "mm" in imperial and a hard-coded inch mark in metric.
- An option `label` is a string, or a function of the units when it names a size (as above): a plain "18 mm plywood" would stay metric in an imperial page and fail the capture check.
- `group` puts fields under a small heading (Size, Load, Options). Order the params the way a person thinks: overall size first.
- In imperial plans give round inch values. The params are plain data outside `build`, so define helpers at the top of the file and use them there (inside `build`, `k.inch` and `k.feet` do the same):
  ```js
  const inch = v => v * 25.4, lb = v => v / 2.2046;
  // { id: 'length', type: 'len', value: inch(60), min: inch(36), max: inch(96) }
  // { id: 'load', type: 'kg', value: lb(1000), min: lb(200), max: lb(1500) }
  ```
- A shared link carries the params in the URL hash, always in mm and kg (bools `1`/`0`), whatever the page shows: `#length=1828.8&shelf=0`. The same goes for `capture.mjs --hash`.

## build(p, k)

`p` holds the resolved params (clamped to their limits, counts rounded). `k` holds:

| name | use |
|---|---|
| `k.u` | units, for every number in text: `u.len(mm)` (a bare number for drawings and tables, whole mm), `u.len(mm, { u: true })` (with its unit, for sentences), `u.fine(mm, { u: true })` (to a tenth: a drill, a clearance, a wall), `u.size(mm)`, `u.mass(kg)`, `u.tol(mm)` (`±1 mm` / `±1/16"`), `u.force(N)` |
| `k.squareTube(b, t, o)`, `k.rectTube(bu, bw, t, o)`, `k.roundTube(d, t, o)`, `k.flatBar(b, t, o)`, `k.bar(bu, bw, o)`, `k.timber(bu, bw, o)`, `k.rod(d, o)` (solid round), `k.pvcPipe(d, t, o)` | stock sections. `bu` is the width across the member (horizontal), `bw` its height (up for a level member). `o`: `{ id, label, short, stockLen, price (per metre) or pricePerFt, material }` |
| `k.inch(v)`, `k.feet(v)` | imperial stock sizes in mm |
| `k.MATERIALS` | steel, stainless, aluminium (welded strength), aluminium-bare (bolted), timber, pvc, copper, brass: pass `material:` in a section's `o` |
| `k.FILAMENTS` | PLA, PETG, ASA, ABS, TPU, PA for prints |
| `k.v3` | small vector helpers |

## The model build() returns

```js
return {
  sections: { LEG: squareTube(40, 3, {...}), RAIL: ... },   // keys used by members[].sec
  axes: { x: ['right', 'left'], y: ['back', 'front'], z: ['top', 'bottom'] },  // names of +/- each axis, for edge labels
  datum: 'x from the left end of the top, y from the front edge, z up from the floor',
  nodes: { FL0: [x, y, z], ... },            // centre-line points, mm
  members: [ ... ],
  plates: [ ... ],
  hardware: [ ... ],
  prints: [ ... ],             // 3D-printed parts: references/prints.md
  consumables: [{ name: 'MIG wire, 0.8 mm', qty: '1 kg spool', note: '' }],
  tools: ['MIG welder', '...'],
  supports: [{ at: [x, y, z], fix: 'pin' }],  // where it stands: 'pin' (feet), 'fixed', 'roller'
  loads: [ ... ],
  tip: { N: 300, height: 900, sf: 1.5 },      // optional; anchored: 'step 8, four M8 anchors' when it is fixed down
  checks: [{ name, pass, value, why }],       // the plan's own checks
  steps: [ ... ],
  facts: [['Work height', u.len(900, { u: true }), 'top surface']],   // optional extra facts
  join: 'weld',                // 'weld' (default), 'bolt', 'screw', 'glue', 'solder' or 'clamp': the legend wording
  kerf: 2, trim: 10, minPiece: 32,
  tolerance: 'cut ±1 mm; feed gap ±0.5 mm',   // the legend's tolerance line, when the frame default does not fit
  printer: { bed: [220, 220, 250] },          // the bed the print check uses
  orderNote: 'One line above the build order.',
};
```

### members

```js
{ id: 'leg-FL', name: 'Leg', sec: 'LEG', pts: ['FL0', 'FL1', 'FL2'], step: 2, prio: 1 }
```

- `pts`: the centre line from the first to the last node. Interior nodes must lie on that line: they are where other members meet it (a lower rail halfway up a leg), and they make this member the receiver there.
- `prio: 1`: this member runs past a corner (legs, posts): it is cut flush with the outer face of the biggest member it meets, and the rest butt onto its faces. Without `prio`, two equal sections meeting at a corner are mitred.
- `brace: true`: a diagonal or gusset member; it always butts onto the outline members and never wins a corner.
- `roll: 90`: stand a rectangular section the other way up.
- `cap: true`: an open end that gets a plastic cap (listed in the cut list).
- `loose: true`: a member bolted on, not welded into the frame (left out of the frame analysis).
- `tone`: `'hi'` (default), `'mid'`, `'lo'`, `'faint'` in the 3D view.

Member ids: short and meaningful (`rail-F-top`, `leg-BR`). Identical pieces get the same piece mark automatically; you never assign marks. Plan for it: on a simple frame the end rails and the cross rails often come out the same length, and so do the top and lower long rails, so they share a mark and one cut sheet. Give members that will share a mark one name ("Short rail", "Long rail", "Leg"), or the sheet prints "End rail / Cross rail".

### plates

```js
{ id: 'foot-FL', name: 'Foot plate', c: [x, y, z], s: [sx, sy, sz], step: 4,
  material: 'steel', holes: [{ at: [a, b], d: 10 }], note: 'Weld all round.', price: 1.5 }
```

An axis-aligned box: centre `c`, size `s`. The thinnest axis is the thickness. Plates count in the overall size: a foot plate centred under a leg at the corner of the frame sticks out past the top and makes the "Overall" bigger than the length the person typed. Keep foot plates inside the footprint (the leg's size, or offset inward) or let the top overhang the frame. The drawing shows, dashed, where the members welded to it stand. A plate that straight members pass through (a lower shelf around the legs) gets `notch: true`: the kit cuts a notch where each member passes, draws it on the plate's drawing with its size, and shows it in 3D; without it, that is a clash. Holes are drawn on the plate's two biggest axes, from its lower-left corner. `material: 'plywood' | 'mdf' | 'timber' | 'steel' | 'aluminium' | 'pvc' | 'hdpe' | 'acrylic' | 'polycarbonate' | 'copper' | 'brass' | 'fr4'` (or give `rho` in kg/mm³) (`materialLabel` overrides the printed material word only, printed after the size: "1500 × 700 × 18 plywood", so give `'plywood'`, not `'18 mm plywood'`), `drawing: false` for sheet goods that need no shop drawing (a plywood deck), `price` per piece, `tone`, `on: 'member-id'` when it is held by something it does not touch (rare). Identical plates (same size, holes, material and name) share a mark (P1, P2).

### hardware

```js
{ id: 'leveler', name: 'Levelling foot, M12', spec: '50 mm base, 500 kg', qty: 4, step: 6, kg: 0.2, price: 3,
  shape: [{ type: 'cyl', a: [x, y, 0], b: [x, y, 40], r: 25 }] }
```

Anything bought. `shape` (optional, a box `{ type: 'box', c, s }` or cylinder, or a list) draws it in 3D and the drawings and makes it count in the floating check; `kg` adds to the mass and the analysis; `on: 'id'` names what holds it if it does not touch it.

### prints

3D-printed parts, with their solids, cuts, filament and settings: see `references/prints.md`. The kit adds them to the 3D view, the drawings, the materials list (with .stl and .scad downloads) and their step.

### supports and loads

Supports must hold the frame still in every direction, or the solver reports a mechanism. Two `pin` supports on one vertical line (a mast in two clamps) leave it free to turn about its own axis: make one of them `fixed`. Feet under a frame are fine as `pin`s. Members with `loose: true` (clamped, bolted or held in a print) are left out of the frame analysis, but their weight still bears on it.

```js
supports: legs.map(n => ({ at: nodes[n], fix: 'pin' })),
loads: [
  { id: 'spread', name: 'Spread load on the top', kg: p.load, what: 'spread over the top', on: ['rail-F', 'rail-B', 'rail-L', 'rail-R'], sf: 2, defl: p.length / 300 },
  { id: 'corner', name: 'Point load at a corner', kg: 150, at: [[x, y, z]], sf: 2 },
  { id: 'shove', name: 'Shoved sideways', N: 400, dir: [1, 0, 0], on: ['rail-F'], sf: 2 },
]
```

- `what` is a short phrase that reads after the load in the check's explanation: "Yield ÷ peak stress with 150 kg *on one corner*". Write `what: 'on one corner'`, not a sentence.
- `parts: [{ on, at, kg | N, dir }, ...]` makes one case of several loads applied together: drag spread up a mast plus a load at its head. The case's `what` should describe the whole.
- `kg` (or `N`) is spread equally over every node of the members in `on` (the members are cut into short spans, so it acts along them) and/or the points in `at` (snapped to the nearest member).
- `dir` defaults to straight down. Self weight of every member, plate and part is always added.
- `sf`: the safety factor on yield the check requires. `defl`: the largest movement allowed at the loaded points, in mm.
- Plates and sheets are not in the analysis (conservative), so put the load on the members that carry the top.

### steps

```js
{ n: 2, phase: 'Fabricate', title: 'Top frame (tack)', hours: 2, views: ['top'],
  summary: 'Optional one line.',
  tasks: ['Short imperative lines with numbers from u.len().', p.shelf && 'An optional line: a falsy task is dropped.'],
  check: `Diagonals equal within ${u.len(2, { u: true })}.`,
  tip: 'Optional note.' }
```

Numbered 1, 2, 3… with no gaps. `phase` groups them in the build order. `hours` is the honest time for one person. `views` overrides which jig views are drawn: a list of `'top'`, `'front'`, `'side'` (default: the top view for a flat step, all three otherwise).

**Name pieces by mark** with `{mark:member-id}` in any step text, check or plate note: `'Clamp the end rails ({mark:end-L1}) between the legs'` prints "Clamp the end rails (B) between the legs". Marks are assigned after `build()` runs, so this placeholder is the only way to write them; an unknown id is an error. `alone: true` draws a sub-assembly built on its own without the rest of the frame. `points: false` leaves out the point labels and the joint table, for parts placed by a rule rather than by coordinates (bars laid with a spacer block); `table: { title, head, rows }` adds the step's own small table instead (the rule, the counts, the gaps). Every member, plate and part has a `step`, and the step that fits members shows its jig, joint positions and cut sheets automatically.

Not modelled (write them as tasks): holes in members (screw holes for a top: "drill a ⌀5 hole every 300 along the top rails"), bends, copes.

### checks

```js
{ name: 'Knee room under the top', pass: clear >= 600, value: u.len(clear, { u: true }), why: 'Sit at it on a stool.' }
```

Anything the kit cannot know: a clearance, a work height in a sensible range, a span for the top, a vise that clears the leg. They show with the kit's checks and the audit requires them to pass at every size.

## Worked example

`examples/shelf-rack/design.mjs` is the whole shape in about 150 lines. Read it top to bottom before writing a new plan: params with a dynamic limit, sections, nodes from a loop, posts with `prio`, rails per level, foot plates with a hole, plywood decks, hardware and consumables, supports, two load cases, an anchored tip check, a plan check, six steps.
