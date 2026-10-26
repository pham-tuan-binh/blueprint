// Welded steel workbench: four square-tube legs that run to the top, a top
// frame and a lower frame of square tube butted onto the leg faces, cross
// rails under the top every 600 mm or less, a top and an optional lower
// shelf of rectangular steel bars laid flat, and levelling feet on welded foot plates. All metal.
// Benches longer than 1800 get a middle leg front and back.
// Datum: x from the left end of the top, y from the front edge, z up from the floor.

export const plan = {
  id: 'metal-workbench',
  name: 'Welded steel workbench',
  short: 'Workbench',
  version: '1',
  summary: 'All steel: four square-tube legs, a welded top frame and lower frame, and a top and lower shelf of steel bars laid flat. Straight square cuts only: every rail butts onto a leg face.',
  units: 'metric',
  currency: '$',
  params: [
    { id: 'length', label: 'Length', type: 'len', value: 1500, min: 900, max: 2400, group: 'Size', hint: u => `top, end to end; middle legs above ${u.len(1800, { u: true })}` },
    { id: 'depth', label: 'Depth', type: 'len', value: 700, min: 500, max: 900, group: 'Size', hint: 'top, front to back' },
    { id: 'height', label: 'Work height', type: 'len', value: 900, min: 750, max: 1050, group: 'Size', hint: 'floor to top surface, feet mid-travel' },
    { id: 'load', label: 'Rated load', type: 'kg', value: 300, min: 100, max: 500, group: 'Load', hint: 'spread over the top' },
    { id: 'shelf', label: 'Lower shelf', type: 'bool', value: true, group: 'Options' },
  ],

  build(p, { u, squareTube, rectTube }) {
    const SHS = squareTube(40, 2, { id: 'SHS40x2', label: '40 × 40 × 2 square tube', short: 'SHS 40×40×2', stockLen: 6000, price: 4 });
    // the top and the shelf are bars of rectangular tube laid flat, running the length
    const BAR = rectTube(40, 20, 2, { id: 'RHS40x20x2', label: '40 × 20 × 2 rectangular tube, laid flat', short: 'RHS 40×20×2', stockLen: 6000, price: 3.4 });

    const L = p.length, D = p.depth, H = p.height;
    const tt = BAR.bw;                      // the top bars sit on the frame
    const shelfT = BAR.bw;
    const h = 20;                           // half the frame tube size
    const lev = 30;                         // levelling foot height, mid-travel
    const footT = 6, footS = 40;            // foot plate
    const z0 = lev + footT;                 // bottom of the legs
    const zTop = H - tt - h;                // top frame centre line
    const zLow = 200;                       // lower frame centre line
    const x0 = h, x1 = L - h, y0 = h, y1 = D - h;
    const mid = L > 1800;
    const xm = L / 2;
    // cross rails under the top: bays no wider than 600, an even count when there is a middle leg
    let bays = Math.ceil((x1 - x0) / 600);
    if (mid && bays % 2) bays += 1;
    const crossX = Array.from({ length: bays - 1 }, (_, i) => x0 + ((x1 - x0) * (i + 1)) / bays);
    const bay = (x1 - x0) / bays;

    const nodes = {};
    const legs = { FL: [x0, y0], FR: [x1, y0], BL: [x0, y1], BR: [x1, y1] };
    if (mid) Object.assign(legs, { FM: [xm, y0], BM: [xm, y1] });
    for (const [k, [x, y]] of Object.entries(legs)) {
      nodes[k + '0'] = [x, y, z0];
      nodes[k + '1'] = [x, y, zLow];
      nodes[k + '2'] = [x, y, zTop];
    }
    // cross-rail nodes on the front and back top rails (the middle one is the middle legs when there are any)
    const crossIds = [];
    crossX.forEach((x, i) => {
      if (mid && Math.abs(x - xm) < 1e-6) { crossIds.push(['FM2', 'BM2']); return; }
      nodes[`F${i + 1}T`] = [x, y0, zTop];
      nodes[`B${i + 1}T`] = [x, y1, zTop];
      crossIds.push([`F${i + 1}T`, `B${i + 1}T`]);
    });
    // the lower frame is a rectangle the shelf bars run front to back across; a deep
    // bench gets a centre rail down its length so a shelf bar spans half the depth
    const lowIds = [];
    const centre = p.shelf && D - 2 * h > 680;
    if (centre) { nodes.LC1 = [x0, D / 2, zLow]; nodes.RC1 = [x1, D / 2, zLow]; }

    const members = [];
    for (const k of Object.keys(legs)) members.push({ id: `leg-${k}`, name: 'Leg', sec: 'SHS', prio: 1, step: 2, pts: [k + '0', k + '1', k + '2'] });
    // end frames: end rails top and bottom
    for (const s of ['L', 'R']) {
      members.push({ id: `end-${s}-top`, name: 'Short rail', sec: 'SHS', step: 2, pts: [`F${s}2`, `B${s}2`] });
      members.push({ id: `end-${s}-low`, name: 'Short rail', sec: 'SHS', step: 2, pts: centre ? [`F${s}1`, `${s}C1`, `B${s}1`] : [`F${s}1`, `B${s}1`] });
    }
    // long rails, split at the middle legs when there are any; interior nodes where cross rails land
    const xOf = id => nodes[id][0];
    const longRail = (side, lvl, ids, name) => {
      const a = `${side}L${lvl}`, b = `${side}R${lvl}`;
      const inner = ids.filter(id => id !== `${side}M${lvl}`).sort((m, n) => xOf(m) - xOf(n));
      if (!mid) return [{ pts: [a, ...inner, b] }];
      return [
        { pts: [a, ...inner.filter(id => xOf(id) < xm), `${side}M${lvl}`], half: 'left' },
        { pts: [`${side}M${lvl}`, ...inner.filter(id => xOf(id) > xm), b], half: 'right' },
      ];
    };
    const topF = crossIds.map(c => c[0]), topB = crossIds.map(c => c[1]);
    const lowF = lowIds.map(c => c[0]), lowB = lowIds.map(c => c[1]);
    const segs = [
      ['F', 2, topF, 'Long rail'], ['B', 2, topB, 'Long rail'],
      ['F', 1, lowF, 'Long rail'], ['B', 1, lowB, 'Long rail'],
    ];
    for (const [side, lvl, ids, name] of segs) {
      longRail(side, lvl, ids, name).forEach(s => members.push({
        id: `long-${side}-${lvl === 2 ? 'top' : 'low'}${s.half ? '-' + s.half : ''}`, name, sec: 'SHS', step: 3, pts: s.pts,
      }));
    }
    if (centre) members.push({ id: 'centre-low', name: 'Centre rail, lower', sec: 'SHS', step: 4, pts: ['LC1', 'RC1'] });
    crossIds.forEach(([f, b], i) => members.push({ id: `cross-top-${i + 1}`, name: 'Short rail', sec: 'SHS', step: 4, pts: [f, b] }));
    lowIds.forEach(([f, b], i) => members.push({ id: `cross-low-${i + 1}`, name: 'Short rail', sec: 'SHS', step: 4, pts: [f, b] }));
    const topRails = members.filter(m => m.id.startsWith('end-') && m.id.endsWith('-top') || m.id.startsWith('long-') && m.id.includes('-top') || m.id.startsWith('cross-top')).map(m => m.id);
    const lowRails = members.filter(m => m.id.includes('-low')).map(m => m.id);

    // top bars: outer bars flush with the front and back of the frame, even gaps between,
    // no gap wider than gapMax; the shelf gets the same bars with wider gaps
    const barRows = (gapMin, gapMax) => {
      let n = Math.floor((D + gapMin) / (BAR.bu + gapMin));
      while ((D - n * BAR.bu) / (n - 1) > gapMax) n++;
      const gap = (D - n * BAR.bu) / (n - 1);
      return { n, gap, ys: Array.from({ length: n }, (_, i) => BAR.bu / 2 + i * (BAR.bu + gap)) };
    };
    const top = barRows(6, 12);
    // shelf bars run front to back between the legs, an even gap at both ends of each run
    const runs = mid ? [[2 * h, xm - h], [xm + h, L - 2 * h]] : [[2 * h, L - 2 * h]];
    const shelfXs = [];
    let shelfGap = 0;
    for (const [a, b] of runs) {
      const len = b - a;
      let n = Math.floor((len - 25) / (BAR.bu + 25));
      while ((len - n * BAR.bu) / (n + 1) > 45) n++;
      shelfGap = (len - n * BAR.bu) / (n + 1);
      for (let i = 0; i < n; i++) shelfXs.push(a + shelfGap + BAR.bu / 2 + i * (BAR.bu + shelfGap));
    }
    const shelfBars = { n: shelfXs.length, gap: shelfGap };
    const zBar = zTop + h + tt / 2, zShelfBar = zLow + h + shelfT / 2;
    top.ys.forEach((y, i) => {
      nodes[`TB${i + 1}a`] = [0, y, zBar]; nodes[`TB${i + 1}b`] = [L, y, zBar];
      members.push({ id: `top-bar-${i + 1}`, name: 'Bar', sec: 'BAR', step: 6, loose: true, pts: [`TB${i + 1}a`, `TB${i + 1}b`] });
    });
    if (p.shelf) shelfXs.forEach((x, i) => {
      nodes[`SB${i + 1}a`] = [x, 0, zShelfBar]; nodes[`SB${i + 1}b`] = [x, D, zShelfBar];
      members.push({ id: `shelf-bar-${i + 1}`, name: 'Shelf bar', sec: 'BAR', step: 6, loose: true, pts: [`SB${i + 1}a`, `SB${i + 1}b`] });
    });
    const barKg = (BAR.kgPerM * L / 1000) * top.n;
    // each bar is a beam between the cross rails: 100 kg on the middle of one span, or
    // its share of the rated load spread along it
    const pointN = 100 * 9.81, spreadN = (p.load * 9.81) / top.n;
    const sigPoint = (pointN * bay / 4) / BAR.Sw, sigSpread = ((spreadN / L) * bay * bay / 8) / BAR.Sw;
    const barSF = BAR.mat.yield / Math.max(sigPoint, sigSpread);
    const barSag = (pointN * bay ** 3) / (48 * BAR.mat.E * BAR.Iww);
    const crossings = top.n * (bays + 1) + (p.shelf ? shelfBars.n * 2 : 0);
    // a shelf bar spans the depth between the lower long rails: 100 kg on its middle
    const shelfSpan = centre ? D / 2 - 2 * h : D - 2 * h;
    const shelfSF = BAR.mat.yield / ((pointN * shelfSpan / 4) / BAR.Sw);

    const nLegs = Object.keys(legs).length;
    const plates = [];
    for (const [k, [x, y]] of Object.entries(legs)) plates.push({
      id: `foot-${k}`, name: 'Foot plate', c: [x, y, lev + footT / 2], s: [footS, footS, footT], step: 7,
      holes: [{ at: [footS / 2, footS / 2], d: 13 }], price: 0.6,
      note: 'Weld an M12 nut over the hole on the top face first, then weld the plate centred under the leg, all round.',
    });
    const hardware = [
      { id: 'nut', name: 'Hex nut, M12', spec: 'plain steel, welded to the foot plate', qty: nLegs, step: 7, kg: 0.02, price: 0.15 },
      { id: 'leveller', name: 'Levelling foot, M12, bolt-down base', spec: `40 mm base with an anchor hole, M12 stud at least ${u.len(60, { u: true })}, 500 kg rating`, qty: nLegs, step: 9, kg: 0.25, price: 4,
        shape: Object.values(legs).map(([x, y]) => ({ type: 'cyl', a: [x, y, 0], b: [x, y, lev], r: 20 })) },
    ];
    hardware.push({ id: 'anchor', name: 'Floor anchor, M8', spec: 'sleeve or wedge anchor, to suit the levelling foot base hole', qty: nLegs, step: 9, kg: 0.05, price: 1.2 });

    const legSpan = mid ? xm - x0 : x1 - x0;
    const shelfClear = zTop - h - (zLow + h + shelfT);
    const steps = [];
    steps.push({ n: 1, phase: 'Fabricate', title: 'Cut, deburr, foot plates', hours: 3, tasks: [
      'Safety glasses, gloves and hearing protection from here on. Use bare or oiled tube, never galvanised.',
      'Cut every piece from the cutting plan, square ends; check each cut with a square.',
      'Deburr every end and write its piece mark on it in marker.',
      `Lay the pieces out by mark and count them against the cut list: ${nLegs} legs ({mark:leg-FL}), ${members.length - nLegs} rails.`,
      `Cut ${nLegs} foot plates ${u.len(footS)} × ${u.len(footS)} from ${u.len(footT, { u: true })} plate and drill a ${u.len(13, { u: true })} hole in the centre of each.`,
    ], check: `Every piece within ${u.tol(1)} of its long point on the cut list.` });
    steps.push({ n: 2, phase: 'Fabricate', title: 'Two end frames (tack)', hours: 2, views: ['side'], tasks: [
      'Lay two legs ({mark:leg-FL}) flat on the welding table, parallel, outer faces against a straight edge.',
      `Fit a short rail ({mark:end-L-top}) between them at the top, its top face flush with the leg tops, and a second one lower down with its centre line ${u.len(zLow - z0)} up from the leg bottoms.`,
      `Set the outside width to ${u.len(D)} at the top and the bottom, clamp each joint square, tack each joint on two faces.`,
      'Build the second end frame on top of the first so the two match.',
    ], check: `Diagonals of each frame equal within ${u.len(2, { u: true })}; both frames the same within ${u.tol(1)}; flat on the table at all four corners.` });
    steps.push({ n: 3, phase: 'Fabricate', title: mid ? 'Join the end frames, middle legs (tack)' : 'Join the end frames (tack)', hours: mid ? 3 : 2, tasks: [
      'Stand both end frames up on the table, top ends up, and brace each with a clamp to a square.',
      mid
        ? `Stand the two middle legs ({mark:leg-FM}) with their centre lines ${u.len(xm)} from the left end, front and back, and clamp each long rail ({mark:long-F-top-left}) between an end frame and a middle leg.`
        : `Clamp the long rails ({mark:long-F-top}) between the end frames: top rails flush with the leg tops, lower rails at the same height as the lower end rails.`,
      `Set the outside length to ${u.len(L)} on the top and the bottom rails.`,
      'Tack the top long rails first, then the lower ones, one tack per joint.',
      'Measure the top diagonals, nudge the frame until they are equal, then tack every joint on two faces.',
    ], check: `Top diagonals equal within ${u.len(3, { u: true })}; every leg plumb within ${u.tol(1)} over its height; the frame sits on all ${nLegs} legs without rocking.`,
      tip: 'Tack only: the frame is welded out in step 5, once every rail is in.' });
    steps.push({ n: 4, phase: 'Fabricate', title: 'Cross rails (tack)', hours: 1, tasks: [
      `Mark the cross rail positions on the top long rails, front and back: ${crossX.map(x => u.len(x)).join(', ')} from the left end to the centre line of each cross rail.`,
      'Fit a short rail ({mark:end-L-top}) as a cross rail at each mark, between the top long rails, top face flush with them, square to the front rail, and tack both ends.',
      centre && `Fit the lower centre rail ({mark:centre-low}) between the middle of the two lower end rails, top flush with them, and tack both ends.`,
    ], check: `Cross rails flush with the top within ${u.tol(1)} (lay a straight edge across), and ${u.len(bay)} apart centre to centre within ${u.tol(2)}.` });
    steps.push({ n: 5, phase: 'Fabricate', title: 'Weld out the frame', hours: 3, tasks: [
      'Re-check the top diagonals and the leg plumb before any weld; fix them while it is only tacked.',
      'Weld every joint all round in short runs, alternating diagonally opposite corners so the heat does not pull the frame out of square.',
      'Weld the top frame joints first, then the lower frame, then the cross rails. Leave it clamped until cold.',
      'Grind the welds on the top faces of the top frame and the lower frame flush, so the bars sit flat.',
    ], check: `Top diagonals still equal within ${u.len(3, { u: true })}; a straight edge across the rail tops shows no gap over ${u.len(1, { u: true })}.`,
      tip: 'Ventilate: weld fumes from mill scale and paint are toxic.' });
    steps.push({ n: 6, phase: 'Fabricate', title: p.shelf ? 'Top and shelf bars' : 'Top bars', hours: p.shelf ? 4 : 3, views: ['top', 'side'], points: false,
      table: { title: 'Bars', head: ['Where', 'Bars', 'Runs', 'Gap', 'First centre line'], rows: [
        ['Top', `{mark:top-bar-1} x${top.n}`, 'left to right', u.len(top.gap), `${u.len(BAR.bu / 2)} from the front`],
        ...(p.shelf ? [['Shelf', `{mark:shelf-bar-1} x${shelfBars.n}`, 'front to back', u.len(shelfBars.gap), `${u.len(shelfXs[0])} from the left end`]] : []),
      ] }, tasks: [
      `Lay the ${top.n} top bars ({mark:top-bar-1}) flat on the top frame, running the length, ends flush with the frame ends.`,
      `Put the outer two flush with the front and back of the frame and space the rest evenly: ${u.len(top.gap, { u: true })} gaps (cut a spacer block to that width and use it at both ends of every bar).`,
      'Tack each bar to the end rails at both ends, checking the gaps as you go, then tack it to every cross rail.',
      ...(p.shelf ? [`Lay the ${shelfBars.n} shelf bars ({mark:shelf-bar-1}) flat across the lower long rails, front to back, ends flush with the front and back of the frame, between the legs with ${u.len(shelfBars.gap, { u: true })} gaps (the same gap next to each leg). Tack both ends of each.`] : []),
      `Stitch-weld each bar to every rail it crosses, ${u.len(25, { u: true })} on each side, working from the middle bar outward (${crossings} crossings).`,
      'Grind any weld that stands proud of a bar top flush.',
    ], check: `Gaps equal within ${u.len(1, { u: true })}; a straight edge laid across the bars rocks nowhere; no bar moves when you lever it with a bar.`,
      tip: 'Weld the crossings in an even pattern, never one bar end to end: the top stays flat.' });
    steps.push({ n: 7, phase: 'Fabricate', title: 'Foot plates', hours: 1, tasks: [
      `Weld an M12 nut on the top face of each foot plate, centred over the ${u.len(13, { u: true })} hole: thread a bolt through both to hold it straight while you weld.`,
      `Lay the bench on its back (two people). Centre a foot plate on the bottom of each leg, nut inside the tube, and weld it all round.`,
      'Chase each nut with an M12 tap or run a bolt in and out to clear spatter.',
    ], check: 'A bolt screws into every nut by hand, straight.' });
    steps.push({ n: 8, phase: 'Finish', title: 'Clean and paint', hours: 2, tasks: [
      'Degrease, wire-brush the welds, and sand any mill scale on show.',
      'Prime and paint with two coats of enamel, getting the paint into the gaps between the bars; let it dry overnight.',
      'Leave the bar tops bare and oiled instead if you want a metal working surface.',
    ], check: 'No bare steel left except the oiled bar tops; paint dry to the touch.' });
    steps.push({ n: 9, phase: 'Assemble', title: 'Feet, anchors and load test', hours: 2, tasks: [
      `Screw a levelling foot into each leg and set each to ${u.len(lev)} under the foot plate.`,
      'Stand it in place and level it with the feet: a level on the top, front to back and end to end. Lock each foot with its nut.',
      `Mark the anchor hole of every foot base on the floor, move the bench, drill for the M8 anchors, set them, and bolt every foot down (${nLegs} anchors).`,
      `Load it gradually, in steps of about a quarter, up to ${u.mass(p.load)} spread over the top, and leave it an hour.`,
    ], check: `Level within ${u.tol(1)} over the length; does not move or lift when pushed hard at the top edge; no visible sag or cracked weld after the load test.` });

    return {
      sections: { SHS, BAR },
      axes: { x: ['right', 'left'], y: ['back', 'front'], z: ['top', 'bottom'] },
      datum: 'x from the left end of the top, y from the front edge, z up from the floor',
      nodes, members, plates, hardware,
      consumables: [
        { name: 'MIG wire, 0.8 mm', qty: '1 kg spool' },
        { name: 'Shielding gas, Ar/CO2', qty: 'one small cylinder' },
        { name: 'Cut-off discs, 1 mm', qty: '5' },
        { name: 'Flap discs, 80 grit', qty: '3' },
        { name: 'Primer and enamel', qty: '1 L each' },
        { name: 'Degreaser and rags', qty: '' },
      ],
      tools: ['MIG welder', 'Hammer drill and masonry bit for the anchors', 'Chop saw or angle grinder with cut-off discs', 'Angle grinder with flap disc', 'Welding table or flat floor', 'Square, tape, scriber, spirit level', 'Six or more clamps', 'Drill, 13 mm bit, M12 tap', 'A spacer block for the bar gaps'],
      tip: { N: 300, height: H, sf: 1.5, anchored: 'step 9, an M8 floor anchor through the base of every levelling foot' },
      supports: Object.keys(legs).map(k => ({ at: nodes[k + '0'], fix: 'pin' })),
      loads: [
        { id: 'spread', name: 'Rated load on the top', kg: p.load + barKg, what: 'spread over the top frame, with the bars', on: topRails, sf: 2, defl: legSpan / 300 },
        { id: 'corner', name: 'Point load at a front corner', kg: 150, what: 'on one front corner', at: [[x0, y0, zTop]], sf: 2 },
        { id: 'shove', name: 'Shoved sideways at the top', N: 400, what: 'pushing the top end-on', dir: [1, 0, 0], on: [members.find(m => m.id.startsWith('long-F-top')).id], sf: 2 },
        { id: 'shove-y', name: 'Shoved front to back at the top', N: 400, what: 'pushing the top front edge', dir: [0, 1, 0], on: ['end-L-top', 'end-R-top'], sf: 2 },
        ...(p.shelf ? [{ id: 'shelf', name: 'Loaded lower shelf', kg: 100, what: 'spread over the shelf', on: lowRails, sf: 2, defl: legSpan / 250 }] : []),
      ],
      checks: [
        { name: 'Top bars: strength', pass: barSF >= 2, value: `safety factor ${barSF.toFixed(2)} (need 2), sags ${u.deflection(barSag)} under 100 kg`, why: `Each bar spans ${u.len(bay, { u: true })} between cross rails: 100 kg on the middle of one span, or its share of the rated load.` },
        ...(p.shelf ? [{ name: 'Shelf bars: strength', pass: shelfSF >= 2, value: `safety factor ${shelfSF.toFixed(2)} (need 2)`, why: `Each shelf bar spans ${u.len(shelfSpan, { u: true })} between the lower rails${centre ? ' and the centre rail' : ''}, with 100 kg on its middle.` }] : []),
        { name: 'Gaps between the top bars', pass: top.gap <= 12 && top.gap >= 4, value: `${top.n} bars, ${u.len(top.gap, { u: true })} gaps`, why: `Small parts should not drop through: gaps between ${u.len(4, { u: true })} and ${u.len(12, { u: true })}.` },
        { name: 'Work height', pass: H >= 750 && H <= 1050, value: u.len(H, { u: true }), why: 'Standing work: about wrist height for a vise, elbow height for fine work.' },
        ...(p.shelf ? [{ name: 'Room above the shelf', pass: shelfClear >= 300, value: `${u.len(shelfClear, { u: true })} clear`, why: `At least ${u.len(300, { u: true })} between the shelf and the top frame for boxes and cases.` }] : []),
      ],
      steps,
      facts: [['Work height', u.len(H, { u: true }), 'top surface, feet mid-travel'], ['Top', `${top.n} steel bars`, `RHS 40×20 laid flat, ${u.len(top.gap, { u: true })} gaps`]],
      orderNote: 'Cut everything, tack the end frames, join them, weld out, weld the bars on, then feet, paint and load test.',
    };
  },
};
