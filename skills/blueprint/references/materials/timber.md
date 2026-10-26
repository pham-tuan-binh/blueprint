# Timber, plywood and board

Read this when a plan has timber members or wooden sheet. Members: `timber(bu, bw, { material: 'timber' })` (softwood C24, design bending strength 14 MPa, not a yield), `join: 'screw'`. Sheet: plates with `material: 'plywood' | 'mdf' | 'timber'`.

## Stock

Use actual sizes, not names:

| Sold as | Actual (mm) | In code |
|---|---|---|
| 2×2 | 38 × 38 | `timber(38, 38)` |
| 2×4 | 38 × 89 | `timber(38, 89)` (on edge) or `roll: 90` |
| 2×6 | 38 × 140 | `timber(38, 140)` |
| 4×4 | 89 × 89 | `timber(89, 89)` |
| Metric planed (PSE) | 45 × 45, 45 × 70, 45 × 95 | `timber(45, 95)` |
| Plywood | 12, 15, 18, 25 mm; 2440 × 1220 sheets | a plate, `material: 'plywood'` |
| MDF | 12, 18, 25 mm | a plate, `material: 'mdf'`: indoors and dry only |

## Design

- **Wood moves across the grain**, about 1% of its width per 4% change in moisture for flatsawn boards, almost nothing along it. A solid top over 300 mm wide is fixed at the middle of each rail and held elsewhere with slotted holes or tabletop clips. Plywood and MDF barely move: screw them anywhere.
- **Grain along the span.** Rails and shelves span with the grain; plywood spans with its face grain.
- **Shelves sag and creep.** Wood sags about 50% more over months under a steady load. Hold wooden shelves to span/600 at their rated load in the load case (`defl: span / 600`), or add a front edge strip on edge, which stiffens a plywood shelf several times.
- **Screws**: length about 2.5 × the piece being fixed; pilot holes always in hardwood and within 50 mm of an end or edge in softwood; at least 5 diameters from an edge and 10 from an end. Glue and screws in long grain; screws alone into end grain hold poorly, so use a block, a pocket screw or a bolt there.
- **Bolts** (coach / carriage bolts) where a joint carries a person or racks: a washer under every nut on wood.
- **Racking**: a timber frame of butt joints is a mechanism without help. Brace it: a plywood back or side screwed every 150 mm, diagonal braces, or corner blocks.
- **Outdoors**: pressure-treated timber, with hot-dip galvanised or stainless (316 near the sea or a pool) screws and brackets; plain zinc-plated screws rust out in treated wood. Keep end grain off the ground (feet or plastic pads) and seal cut ends.
- **Indoor furniture** wants dry timber (about 8-12% moisture); construction timber straight from the yard shrinks and twists, so let it sit indoors for a week first and say so in step 1.

## In the steps

- Cut to marks with the saw on the waste side; check square on the first piece, then use a stop block for identical pieces.
- Dry-fit, then glue and screw; wipe squeeze-out before it sets.
- Finish (oil, varnish or paint) after all cutting, with end grain sealed.
- Safety: dust extraction or a mask when sanding MDF, push sticks on a table saw.
