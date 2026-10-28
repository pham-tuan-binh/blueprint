# PVC pipe and plastic sheet

Read this when a plan has PVC pipe or plastic sheet. Pipe: `pvcPipe(OD, wall)` (`material: 'pvc'`, a long-term design stress of 25 MPa because PVC creeps), `join: 'glue'`. `examples/pvc-drying-stand` is the pattern.

## Stock

| | Sizes | In code |
|---|---|---|
| PVC-U pressure pipe, metric | OD 16, 20, 25, 32, 40, 50 (PN10/16 walls about 1.5 to 3) | `pvcPipe(32, 2.4)` |
| PVC Sch 40, US | 1/2" 21.3 × 2.77, 3/4" 26.7 × 2.87, 1" 33.4 × 3.38, 1-1/4" 42.2 × 3.56 | `pvcPipe(33.4, 3.38)` |
| Plastic sheet | HDPE, acrylic, polycarbonate, FR4 | a plate, `material: 'hdpe'` etc. |

## Fittings

- Each fitting is hardware with a `shape` round its joint, and each pipe's nodes sit at the bottom of its socket, so the cut length is right. Draw an elbow with `k.shapes.elbow`, so its body curves.
- Laying length (centre to socket bottom) of equal tees and elbows, roughly: 20 mm pipe 11, 25 mm 13, 32 mm 17, 40 mm 21, 50 mm 26; socket depth about 0.6 × OD + 6. Tell the builder to measure their own fittings and adjust in the first step.
- Furniture-grade fittings (no print, smooth) look better; pressure fittings are cheaper and everywhere. Do not mix metric and US sizes.

## Design

- **Sag decides the size.** PVC is about 70 times less stiff than steel. Let the load limit follow the length and height (`max: p => ...`) or step up a pipe size; do not narrow the fields.
- **Creep**: never a sustained heavy bending load, and never anything a person stands on, sits on or hangs from. Things hung on it (clothes, parts, a light antenna) are ordinary loads at safety factor 2, applied to the 25 MPa design stress.
- **Heat**: rated at about 23 °C, much weaker by 40 °C, and soft at 60 °C. Keep it away from heaters, engines and a hot car's interior; in full sun on dark paving or a deck, paint it white or light.
- **Sun**: plain PVC goes brittle outdoors within a year or two. Paint it (an acrylic or plastic-rated paint) or buy UV-stabilised pipe, and say so in the last step.
- **Fixing it down**: a bolt through the pipe with a sleeve inside it (fasteners.md), or a bought or printed pipe clamp screwed to the floor or deck; then it is anchored for the tip check.
- **Never pressurised air or gas**: PVC shatters when it fails with stored gas. A frame only.
- **Light frames tip**: size the push to what really happens, and tie the foot spread to the height with a plan check (references/structure.md, tip-over).
- **Plastic sheet**: polycarbonate for anything that gets knocked (it bends, acrylic cracks); drill acrylic slowly with a sharp bit, holes at least 2 × the thickness from an edge, and oversize them so it can move with heat. HDPE for wet and wear, but nothing glues to it: screw or bolt it.

## In the steps

- Cut square (a pipe cutter or a mitre box), deburr inside and out, chamfer the outside edge slightly.
- Dry-fit the whole frame and mark each joint across pipe and fitting so it goes back the same way.
- Solvent weld one joint at a time: primer on pipe and socket, then cement, push fully home with a quarter turn, hold about 30 s. Handle the frame after about 2 h; load it only after the full cure time on the can (often 24 h). Ventilate; no flames.
- Joints that must come apart (storage, transport) are dry-fit with a screw or pin through, not glued.
