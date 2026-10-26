# Verify: the review checklist

Read this when the plan passes `check`. The person who builds it finds faults by standing at the saw with the page. Find them first. Run `check`, read every PNG, then answer every question below. Fix the design or the text, run it again, and go round until every answer is yes.

```bash
node $SKILL/scripts/blueprint.mjs check plans/<id>/design.mjs --hash "top=steel" --hash "length=2400"
#   build, audit, capture --pdf, then one capture per --hash into shots/<hash>/: must end "check passed"
#   a --hash for every option and every size where the design changes: param ids from design.mjs, values in mm / kg, bools 1/0
node $SKILL/scripts/blueprint.mjs test   # once per kit change: the frame solver against textbook beams
```

## The commands must pass

- **audit passed.** Every kit check and plan check at every min, max, all-min, all-max, a 12-step sweep of each field with the others at their max and at their min, and 40 random sizes, in both units. A failing case is a design bug at a size the page allows: fix the design so it adapts, or narrow the range only if the thing stops making sense there.
- **capture passed.** The layout audit clean (every number, checkbox, mark and icon within 1 px of its text), no console errors, a 3D view that is neither blank nor all ink, a field that changes the cut list and the URL, a pass in the other units with nothing of the first left in the plan's own numbers, no sideways scroll at 390 px. The PDF prints in the plan's own units.

## Read the shots like a builder

Open every PNG in `shots/`. For each, ask:

1. **desktop.png**: is it instantly the thing? Does the 3D model look like a real, well-made object (legs on the floor, top flat, nothing floating or poking through)? Do the facts make sense (mass, load, safety factor, cost)? Light paper, even on a device set to dark mode? No header of any kind (no bar, no nav, nothing pinned to the top or its corners): does the page open on its title, then the start-here link to the guide, then a Contents list with dotted leaders, and every link and control in the flow of the page? Space, not boxes: big step numbers, ✓ and ! marks, no boxed panels or rules between sections? Colour only as the code: yellow for what is new in a step and for help, green checks, red warnings, nothing else coloured? No drop or offset shadows anywhere; buttons and links show they are clickable with an icon?
2. **size.png**: are the fields the ones a person would change, in the order they think, with ranges that make sense? Are the defaults a sensible, common size?
3. **checks.png** and **materials.png**: all pass, and does each result read as a real number with a reason? Is the tightest margin where you expected it?
4. **drawings.png**: does the general arrangement show the whole thing in three views at one scale, with the overall dimensions matching the fields?
5. **step-N.png** (every step): can every joint id and dimension on the jig be read without zooming, each in its own box, none hidden behind a member or another label?
   Could someone do this step with only this? Is every piece named by mark, every position in the joint table or the jig, every check measurable? Is the lit (dark) part in the jig what this step adds?
6. **cut sheets**: does each piece's long point and end description agree with how it is joined? Are pieces that should be identical one mark (×4, not four marks)?
7. **cutlist.png**: is the waste reasonable, and is the number of stock lengths on the materials list the number in the cutting plan?
8. **metric-*.png / imperial-*.png** (the plan switched to the other units): every length in the other system, sensible values, stock labels unchanged (they are what you buy)?
9. **phone.png / phone-full.png**: readable at 390 px, fields usable, drawings legible when zoomed?
10. **pdf-N.png** (the printed pages of plan.pdf): each step starts on a new page, no controls printed, drawings not split across pages?
11. **prints** (if any): does each printed part look right in the 3D view, holes and bores where they should be, and sized for what it holds at this size (clearance per `references/prints.md`)? Capture fails an STL that is not watertight at any end of any field. Is the printing in an early step?
12. **every step, in order: can each part get to its place?** Picture it moving in through what is already built: a deck lowered into a welded rack, a sheet slid between posts, a wheel onto a welded axle. A frame closed round a space shuts out anything bigger than its opening. Wood, plastic and bought parts only after the welding and paint near them. Check the smallest and the largest sizes too.
13. **guide.png / guide-phone.png** (the guide beside the plan): do its figures show this plan (the marked joint, the bay's diagonals, a real cut sheet, real joint close-ups), and only the sections that apply (no welding section for a glued PVC frame)? Is every task in the steps short enough that the explanation lives behind a `?`, not in the task?
14. **every variant** you captured with `--hash`: does each step still read right with the option or the extra member (the steel top's welding step, the middle legs)?

## Then change the size

Read the audit's "tightest" lines: the sweeps hold every other field at its max (and min) while one field runs its range, so a threshold in your design is met at its worst. Then type the extremes into the page: longest and shortest, tallest and lowest, heaviest load. Look at the 3D model at each. A plan that passes its checks but looks wrong at an extreme (a 2.4 m bench with no centre support that sags visibly, shelves 100 mm apart) needs a design that adapts.

## Faults earlier plans were rejected for

- A number in the step text that did not follow the fields (written by hand instead of `u.len()`).
- A field that changed nothing (the audit flags it now) or changed only the 3D view and not the steps.
- A long rail with no centre support at the max length: passed strength, sagged past span/300.
- Rails mitred into legs, so the legs stopped at the rail and the top was not one plane: legs need `prio: 1`.
- A brace butting onto a smaller tube (the joint check now fails it).
- Plates or parts that touched nothing: a foot plate modelled 1 mm under the leg.
- Hardware without a step, so it never got bought or fitted.
- A cut list with four marks for four identical legs because one leg's node was 0.3 mm off: build nodes from the same numbers so symmetric pieces are exactly symmetric.
- Imperial plans with metric stock labels, or metric plans with imperial stock.
- Steps that said "the short rails" where the mark covered three kinds of rail: name pieces with `{mark:id}`, and give members that share a mark one name.
- A lower shelf modelled as a plain board that passed through the legs: `notch: true` cuts and draws the notches.
- Joint ids drawn in plain black text over dark members, unreadable: labels sit in their own box (the kit does it; keep it if you change the kit).
- A worst case the random samples never hit (1800 long × deepest × heaviest, just before the middle leg appears): the sweeps exist for this; still check the sizes either side of every threshold in your design.
