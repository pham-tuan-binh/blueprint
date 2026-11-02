# Bolts, screws and other fasteners

Read this when a plan bolts, screws or rivets parts together, or fits bought feet, casters or brackets. Every fastener is hardware with a step (and a `shape` where it shows or carries load).

## Bolts

| Size | Clearance hole (normal) | Tight fit | Tapping drill |
|---|---|---|---|
| M5 | 5.5 | 5.3 | 4.2 |
| M6 | 6.6 | 6.4 | 5.0 |
| M8 | 9.0 | 8.4 | 6.8 |
| M10 | 11.0 | 10.5 | 8.5 |
| M12 | 13.5 | 13.0 | 10.2 |

Imperial (UNC), when the plan is in inches:

| Size | Clearance hole (normal) | Tight fit | Tapping drill |
|---|---|---|---|
| #10-24 | 13/64" | #9 (0.196") | #25 (0.150") |
| 1/4"-20 | 17/64" | F (0.257") | #7 (0.201") |
| 5/16"-18 | 21/64" | P (0.323") | F (0.257") |
| 3/8"-16 | 25/64" | W (0.386") | 5/16" |
| 1/2"-13 | 17/32" | 33/64" | 27/64" |

Drill sizes in text go through `u.drill(mm)`, which prints the nearest 1/64" in imperial. Thread names like `1/2"-13` are trade names and stay as written in either unit system.

- **Grade 8.8** bolts (US: grade 5) with matching nuts for anything structural; plain zinc-plated 4.6 only for light, non-structural parts. Stainless is sold as A2 (304) and A4 (316), class 70: about as strong as 8.8 in the sizes here.
- **Edge distance** from a hole centre to any edge: at least 1.5 × the bolt diameter, 2 × in thin or soft material (plastic, aluminium sheet, wood). Holes at least 3 × the diameter apart.
- **Washers** under the head and the nut on soft material, slotted holes and paint; a penny (large) washer on wood and plastic.
- **Locking**: nyloc nuts where it vibrates (single use is safest; not above about 120 °C), or thread-lock. A spring washer adds little.
- **Length**: the bolt shows two threads past the nut; no more than needed.
- **Every fastener lands in material.** Picture where each screw or bolt goes: not into the open end of a tube, the hollow of a section, a void in a print or the gap between two parts. Place them from the model (a screw into the middle of a rail's face, not over a leg's open top).
- **Threads into a part**: engage at least 1 × the diameter in steel, 1.5 × in aluminium; in plastic or wood use a nut, an insert or a rivet nut instead.
- **Tubes**: a bolt through a hollow tube crushes it when tightened; use a sleeve (a short tube inside), a welded nut, or a bolt through a plate.
- **Levelling feet and casters**: a welded nut or a plate with a threaded insert under each leg (`examples/metal-workbench`). Casters rated so that three carry the whole load.

## Coatings: match the place

| Where | Fasteners |
|---|---|
| Indoors, dry | zinc-plated or black |
| Outdoors | hot-dip galvanised or stainless 304 |
| Coastal, pool, pressure-treated timber | stainless 316 (or hot-dip galvanised for treated timber) |
| In aluminium | stainless, with nylon or EPDM washers and sleeves to keep the metals apart |

Mixing metals in the wet corrodes the less noble one (aluminium and zinc first), so keep fasteners and connectors of one metal or isolate them.

## In the steps

- Name each fastener by its size and length ("M8 × 25, washer each side"); the materials list has the count.
- Snug first, square the frame, then tighten fully.
- A torque value only when it matters (feet, a vise, a wheel); otherwise "tight with a spanner".
