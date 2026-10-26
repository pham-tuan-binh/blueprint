# Aluminium, copper and brass

Read this when a plan has aluminium, copper or brass parts: light frames, handles, antenna elements, conductors, ground rods.

## Choose the joint first

| `material` | Yield the kit uses | When |
|---|---|---|
| `aluminium-bare` (6063-T6) | 170 MPa | bolted, riveted or clamped: keeps its full strength. The default for home builds |
| `aluminium` (6061-T6, welded) | 110 MPa | welded: the metal about 25 mm each side of a weld loses roughly half its strength, and the kit checks the whole member at that |
| `copper` (half hard) | 200 MPa | rod, tube, bus bar |
| `copper-annealed` | 70 MPa | house wire and soft-drawn wire: bends easily, so support it often |
| `brass` | 250 MPa | small turned or threaded parts |

- Welding aluminium needs TIG or a spool gun and practice; most home builders cannot. Prefer bolts, rivets or printed or bought connectors, and `join: 'bolt'`.
- If it must be welded, keep welds away from where the bending is highest (mid span, the root of a cantilever), or let a bolted plate carry it.

## Stock

| | Common sizes | In code |
|---|---|---|
| Aluminium rod | 4, 6, 8, 10 mm | `rod(6, { material: 'aluminium-bare' })` |
| Aluminium tube | 8 × 1, 10 × 1, 12 × 1, 20 × 1.5, 25 × 1.5 | `roundTube(10, 1, { material: 'aluminium-bare' })` |
| Aluminium square / angle | 20 × 20 × 1.5, 25 × 25 × 2 | `squareTube(25, 2, { material: 'aluminium-bare' })` |
| Copper wire | 1.5 to 4 mm | `rod(2.5, { material: 'copper-annealed' })` |
| Copper pipe | 15 × 0.7, 22 × 0.9 | `roundTube(15, 0.7, { material: 'copper' })` |

## Design

- **Stiffness is a third of steel's**, so the same section sags three times as much: deflection usually sets the size, not strength. Go up a section, not a wall.
- **Keep dissimilar metals apart outdoors.** Aluminium touching steel, copper or brass in the wet corrodes fast. Use stainless fasteners with nylon or EPDM washers and sleeves, and seal the joint (paint, tape or a jointing compound). Never put bare aluminium on pressure-treated timber.
- **Threads in aluminium** strip easily: engage at least 1.5 × the bolt diameter, or use a through bolt and nut, a rivet nut or a thread insert.
- **Anodised or painted** for outdoors where looks matter; bare 6063 weathers to a dull grey and is fine.
- **Copper and brass outdoors** go green; that is harmless. Tin or seal soldered joints that carry RF or current outside.
- **Electrical and RF**: the structure is half the job. Put the electrical numbers in plan checks (element length from frequency, conductor size from current, clearances), formatted with `u`.

## In the steps

- Cut with a fine-tooth blade (a wood blade on a mitre saw works for aluminium; wax it), deburr every end.
- Drill with a sharp bit and cutting fluid; clamp thin tube so it does not crush.
- Solder copper clean and bright: flux, heat the work not the solder, let it cool unmoved.
