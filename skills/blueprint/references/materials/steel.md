# Steel (mild and stainless)

Read this when a plan has steel members or plates. The kit's defaults are steel: `material: 'steel'` (S235 / A36, yield 235 MPa) or `'stainless'` (304, 205 MPa), `join: 'weld'`.

## Stock

Metric (Europe, Asia, Australia): 6 m lengths (`stockLen: 6000`), mild steel S235 / SS400 / A36.

| Use | Section | Notes |
|---|---|---|
| Light frames, shelves, braces | SHS 20×20×1.5, 25×25×1.6, 25×25×2 | cuts by hand |
| Benches, tables, racks | SHS 30×30×2, 40×40×2, 40×40×3 | 40×40×3 for a heavy bench's legs |
| Heavy benches, stands, carts | SHS 50×50×3, RHS 50×25×2, 60×40×3, 80×40×3 | RHS on edge for long rails |
| Flat bar | 25×5, 30×5, 40×5, 50×6 | tabs, shelf supports |
| Plate | 3, 5, 6, 8, 10 | 5-6 for feet and tabs; 5-10 for a steel top |

Imperial (when asked): 20 or 24 ft lengths (`stockLen: feet(20)`), A500 / A513. Gauge: 16 ga = 0.065", 14 ga = 0.083", 11 ga = 0.120", 3/16" = 0.1875".

| Use | Section (in) | In code |
|---|---|---|
| Light | 1 × 1 × 16 or 14 ga | `squareTube(inch(1), inch(0.083))` |
| Benches, tables | 1-1/2 × 1-1/2 × 14 or 11 ga | `squareTube(inch(1.5), inch(0.120))` |
| Heavy | 2 × 2 × 11 ga, 2 × 1 or 2 × 3 × 11 ga (rect) | `rectTube(inch(1), inch(2), inch(0.12))` |
| Flat bar | 1 × 3/16, 1-1/2 × 1/4, 2 × 1/4 | `flatBar(inch(2), inch(0.25))` |
| Plate | 3/16, 1/4, 3/8 | `inch(0.25)` |

Label imperial stock as sold: `label: '1-1/2" × 1-1/2" × 11 ga square tube'`, `short: '1.5" SQ 11ga'`. Rough prices for a first estimate (they move; `price` per metre or `pricePerFt`): SHS 40×40×2 about $4/m, 40×40×3 $5.5/m, RHS 60×40×3 $7/m, 5 mm plate $45/m²; 1-1/2" 11 ga about $3/ft.

## Design

- **Walls of 1.5 mm or more** for MIG at home; thinner burns through and distorts. Use 2 mm or more where a joint carries the load.
- **Square cuts and tight fits.** A gap over about 1 mm at a butt joint is a weak, ugly weld; the cut tolerance in the steps is ±1 mm for this reason.
- **Close every open tube end** that shows: a plastic cap (`cap: true`) or a welded plate. Open tubes collect water and rust from inside.
- **Stainless** where it lives wet or near food; it costs about 3-4 times mild steel and warps more when welded. Stainless fasteners in mild steel are fine indoors.
- **Galvanised tube**: grind the zinc back 25 mm from every weld, weld only with fume extraction or outdoors with a respirator rated for welding fume (zinc fume causes metal fume fever), then touch up with zinc-rich paint. Say it in the weld step.
- **To be hot-dip galvanised after welding**: every closed tube needs a vent and a drain hole (at the high and low corners as it hangs) or it can burst in the bath. Put the holes in the plate drawing or a task, and say "ask the galvaniser" in the step.

## In the steps

- Tack everything on a flat table first; square it while only tacked (diagonals).
- Weld out in short stitches, alternating sides and opposite corners like torquing wheel nuts, letting each area cool. Clamped until cold. Weld shrinkage pulls the frame toward the last weld.
- On thin wall, pre-set a corner about 1 mm out of square away from the weld so it pulls back true.
- Clean to bright metal before welding; degrease and prime bare steel the same day it is cleaned.
- Safety: eye, hand and skin protection for grinding and welding, no flammables near the work, a fire watch for a few minutes after.
