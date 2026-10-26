// Welded steel shelf rack: four square-tube posts, a rectangle of upright
// rectangular tube at every shelf level, plywood decks and foot plates.
// The posts run the full height (prio 1); the rails butt onto their faces.
// Datum: x along the width from the left post's outer face, y from the front
// face to the back, z up from the floor.

export const plan = {
  id: 'shelf-rack',
  name: 'Welded steel shelf rack',
  short: 'Shelf rack',
  version: '1',
  summary: 'Four posts, welded shelf frames and plywood decks. Straight cuts only: every rail butts square onto a post face.',
  units: 'metric',
  currency: '$',
  params: [
    { id: 'width', label: 'Width', type: 'len', value: 1200, min: 600, max: 2000, group: 'Size' },
    { id: 'depth', label: 'Depth', type: 'len', value: 450, min: 300, max: 800, group: 'Size' },
    { id: 'height', label: 'Height', type: 'len', value: 1800, min: 600, max: 2400, group: 'Size' },
    { id: 'shelves', label: 'Shelves', type: 'count', value: 4, min: 2, max: p => Math.max(2, Math.min(7, Math.floor((p.height - 270) / 250) + 1)), hint: 'at least 250 between shelves', group: 'Size' },
    { id: 'shelfKg', label: 'Load per shelf', type: 'kg', value: 80, min: 20, max: 200, group: 'Load' },
  ],

  build(p, { u, squareTube, rectTube }) {
    const POST = squareTube(40, 2, { id: 'SHS40', label: '40 × 40 × 2 square tube', short: 'SHS 40×40×2', stockLen: 6000, price: 4.2 });
    const RAIL = rectTube(20, 40, 2, { id: 'RHS40x20', label: '40 × 20 × 2 rectangular tube, on edge', short: 'RHS 40×20×2', stockLen: 6000, price: 3.4 });
    const deckT = 18, foot = 6, h = 20;                // rail half height
    const W = p.width, D = p.depth, H = p.height;
    const x0 = 20, x1 = W - 20, y0 = 20, y1 = D - 20;   // post centre lines
    const topZ = H - deckT - h;                         // top rail centre line
    const lowZ = foot + 120 + h;
    const levels = Array.from({ length: p.shelves }, (_, i) => lowZ + ((topZ - lowZ) * i) / (p.shelves - 1));
    const gapMin = Math.min(...levels.slice(1).map((z, i) => z - levels[i]));

    const nodes = {};
    const corners = { FL: [x0, y0], FR: [x1, y0], BL: [x0, y1], BR: [x1, y1] };
    for (const [k, [x, y]] of Object.entries(corners)) {
      nodes[k + '0'] = [x, y, foot];
      levels.forEach((z, i) => (nodes[`${k}${i + 1}`] = [x, y, z]));
    }
    const members = [];
    for (const k of Object.keys(corners)) members.push({ id: `post-${k}`, name: 'Post', sec: 'POST', prio: 1, step: 2, pts: [k + '0', ...levels.map((_, i) => `${k}${i + 1}`)] });
    levels.forEach((_, i) => {
      const n = i + 1;
      members.push({ id: `end-L${n}`, name: 'End rail', sec: 'RAIL', step: 2, pts: [`FL${n}`, `BL${n}`] });
      members.push({ id: `end-R${n}`, name: 'End rail', sec: 'RAIL', step: 2, pts: [`FR${n}`, `BR${n}`] });
      members.push({ id: `long-F${n}`, name: 'Long rail', sec: 'RAIL', step: 3, pts: [`FL${n}`, `FR${n}`] });
      members.push({ id: `long-B${n}`, name: 'Long rail', sec: 'RAIL', step: 3, pts: [`BL${n}`, `BR${n}`] });
    });

    const plates = [];
    for (const [k, [x, y]] of Object.entries(corners)) plates.push({ id: `foot-${k}`, name: 'Foot plate', c: [x, y, foot / 2], s: [40, 40, foot], step: 4, holes: [{ at: [20, 20], d: 10 }], note: 'Same size as the post. Drill for an M8 floor anchor, weld all round.' });
    levels.forEach((z, i) => plates.push({
      id: `deck-${i + 1}`, name: i === levels.length - 1 ? 'Top deck' : 'Deck', material: 'plywood', materialLabel: 'plywood',
      c: [W / 2, D / 2, z + h + deckT / 2], s: [W, D, deckT], step: 5, notch: true, price: (W * D / 1e6) * 18,
    }));

    const totalKg = p.shelfKg * p.shelves;
    return {
      sections: { POST, RAIL },
      axes: { x: ['right', 'left'], y: ['back', 'front'], z: ['top', 'bottom'] },
      datum: 'x from the outer face of the left posts, y from the front face, z up from the floor',
      nodes, members, plates,
      hardware: [
        { id: 'anchor', name: 'Floor anchor, M8', spec: 'sleeve or wedge anchor', qty: 4, step: 6, price: 1.2 },
        { id: 'screws', name: 'Deck screws', spec: '4 × 30 mm pan head, self-drilling', qty: 8 * p.shelves, step: 5, price: 0.08 },
      ],
      consumables: [
        { name: 'MIG wire, 0.8 mm', qty: '1 kg spool' }, { name: 'Primer and enamel', qty: '1 L each' },
        { name: 'Flap discs, 80 grit', qty: '3' },
      ],
      tools: ['MIG welder', 'Chop saw or angle grinder with cut-off discs', 'Square, tape, scriber', 'Four clamps', 'Drill and 10 mm bit'],
      supports: Object.keys(corners).map(k => ({ at: nodes[k + '0'], fix: 'pin' })),
      loads: [
        { id: 'full', name: 'Every shelf loaded', kg: totalKg, what: 'spread over every shelf', on: members.filter(m => m.sec === 'RAIL').map(m => m.id), sf: 2, defl: W / 250 },
        { id: 'push', name: 'Bumped sideways', N: 0.05 * totalKg * 9.81 + 100, what: 'pushing the top sideways', dir: [1, 0, 0], on: [`long-F${p.shelves}`], sf: 2 },
      ],
      tip: { N: 150, height: H, sf: 1.5, anchored: 'step 6, four M8 floor anchors' },
      checks: [
        { name: 'Room between shelves', pass: gapMin - 2 * h - deckT >= 150, value: `${u.len(gapMin - 2 * h - deckT, { u: true })} clear`, why: `At least ${u.len(150, { u: true })} between a deck and the rail above it.` },
      ],
      steps: [
        { n: 1, phase: 'Fabricate', title: 'Cut and deburr', hours: 2, tasks: [
          'Cut every piece from the cutting plan. Square ends: check with a square after each cut.',
          'Deburr every end and label the piece mark on it in marker.',
          `Lay out the cut pieces by mark and count them against the cut list: 4 posts ({mark:post-FL}), ${4 * p.shelves} rails.`,
        ], check: `Every piece within ${u.tol(1)} of its long point.` },
        { n: 2, phase: 'Fabricate', title: 'Two end frames (tack)', hours: 2, tasks: [
          'Lay two posts flat on the table, outer faces against a straight edge.',
          `Mark the rail centre lines on both posts, measured from the bottom end of the post: ${levels.map(z => u.len(z - foot)).join(', ')}.`,
          'Clamp each end rail ({mark:end-L1}) between the posts on its mark, square to them, and tack both ends.',
          'Build the second frame the same way, on top of the first if you like, so they match.',
        ], check: `Diagonals of each frame equal within ${u.len(2, { u: true })}. Both frames the same.` },
        { n: 3, phase: 'Fabricate', title: 'Join the frames (tack)', hours: 2, tasks: [
          'Stand both end frames up, clamp them to something square.',
          'Tack the long rails ({mark:long-F1}) at the top level first, then the bottom level, then the rest.',
          'Check the top rectangle diagonals, nudge to equal, then tack every joint fully.',
        ], check: `Top diagonals equal within ${u.len(3, { u: true })}; the rack sits level on all four posts.` },
        { n: 4, phase: 'Fabricate', title: 'Weld out and feet', hours: 3, tasks: [
          'Weld every joint all round, alternating corners so heat does not pull it out of square.',
          'Lay the rack down, weld a foot plate centred under each post, all four sides.',
          'Grind the welds that a deck will sit on flush.',
        ], check: `Diagonals still equal within ${u.len(3, { u: true })} after welding.` },
        { n: 5, phase: 'Finish', title: 'Paint and decks', hours: 3, tasks: [
          'Degrease, prime and paint.',
          `Cut ${p.shelves} decks ${u.len(W)} × ${u.len(D)} from ${u.len(18, { u: true })} plywood. Notch the lower decks around the posts as their drawing shows.`,
          'Screw each deck down through the rails, two screws per rail.',
        ] },
        { n: 6, phase: 'Finish', title: 'Stand and anchor', hours: 1, tasks: [
          'Stand it in place, mark the foot holes, drill and anchor all four feet.',
          `Load the shelves gradually up to ${u.mass(p.shelfKg)} each.`,
        ], check: 'Does not rock or move when pushed at the top.', tip: 'Anchor any rack taller than three times its depth.' },
      ],
    };
  },
};
