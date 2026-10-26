// PVC drying stand: a sawhorse-style stand for painted parts. Two T-shaped end
// frames (a foot bar on the floor, an upright) joined by a top rail the parts
// hang from and a lower stretcher. All 32 mm PVC-U pipe in standard solvent-weld
// fittings: a tee at each foot and halfway up each upright, an elbow at each top
// corner, a cap on each foot end. Each fitting is bought hardware with a shape
// round its joint (one list per piece), so the pipes meet in it: their ends read
// "into the tee" and the analysis joins them where their axes cross.
// Datum: x along the length from the centre line of the left upright, y across
// from the front end of the foot bars, z up from the floor.

const OD = 32, WALL = 2.4;   // PVC-U pressure pipe, PN16
const Z = 17;                // fitting: centre to the bottom of the socket (laying length)
const FR = 21;               // fitting radius over a socket hub
const FB = 19;               // fitting radius over its body, between the hubs
const SOCK = 22;             // socket depth
const CAP = 3;               // end cap: thickness of its closed end

export const plan = {
  id: 'pvc-drying-stand',
  name: 'PVC drying stand',
  short: 'Drying stand',
  version: '1',
  summary: 'A sawhorse-style stand of 32 mm PVC pipe in solvent-weld fittings: two T-shaped ends joined by a top rail to hang painted parts from and a lower stretcher.',
  units: 'metric',
  currency: '$',
  params: [
    { id: 'length', label: 'Length', type: 'len', value: 1000, min: 600, max: 1200, group: 'Size', hint: 'upright to upright, centre lines' },
    { id: 'height', label: 'Height', type: 'len', value: 800, min: 500, max: 1100, group: 'Size', hint: 'floor to top of the elbows' },
    { id: 'width', label: 'Foot width', type: 'len', value: 650, min: p => Math.ceil(0.75 * p.height / 10) * 10, max: 900, group: 'Size', hint: 'foot bar over the caps; at least three quarters of the height' },
    { id: 'load', label: 'Parts on the rail', type: 'kg', value: 6, min: 1, max: p => Math.max(1, Math.floor(Math.min(10, 10 * (1000 / p.length) ** 3) * Math.min(1, (800 / p.height) ** 2))), group: 'Load', hint: 'spread along the rail; the limit falls as the stand gets longer or taller' },
  ],

  build(p, { u, pvcPipe, shapes }) {
    const PIPE = pvcPipe(OD, WALL, { id: 'PVC32', label: `${OD} × ${WALL} PVC-U pressure pipe`, short: 'PVC 32', stockLen: 3000, price: 2.2 });
    const L = p.length, W = p.width, H = p.height;
    const yc = W / 2;
    const z0 = FR;               // foot tee centre
    const zt = H - FB;           // top elbow centre (its rounded top at the height)
    const zm = z0 + (zt - z0) * 0.35;   // mid tee centre (stretcher)
    const ends = { L: 0, R: L };

    const nodes = {};
    const members = [];
    const hardware = [];
    const cyl = (a, b, r) => ({ type: 'cyl', a, b, r });
    // a fitting as it looks: a socket hub at each opening, a slimmer body to the centre
    const at = (c, d, t) => c.map((v, i) => v + d[i] * t);
    const sock = (c, d) => [cyl(at(c, d, Z), at(c, d, Z + SOCK), FR), cyl(c, at(c, d, Z), FB)];
    const tees = [], elbows = [], caps = [];
    for (const [k, x] of Object.entries(ends)) {
      const dx = k === 'L' ? 1 : -1;
      nodes[`${k}F0`] = [x, CAP, z0]; nodes[`${k}F1`] = [x, yc - Z, z0];
      nodes[`${k}B1`] = [x, yc + Z, z0]; nodes[`${k}B0`] = [x, W - CAP, z0];
      nodes[`${k}U0`] = [x, yc, z0 + Z]; nodes[`${k}U1`] = [x, yc, zm - Z];
      nodes[`${k}U2`] = [x, yc, zm + Z]; nodes[`${k}U3`] = [x, yc, zt - Z];
      members.push({ id: `foot-${k}F`, name: 'Foot', sec: 'PIPE', pts: [`${k}F0`, `${k}F1`], step: 2 });
      members.push({ id: `foot-${k}B`, name: 'Foot', sec: 'PIPE', pts: [`${k}B1`, `${k}B0`], step: 2 });
      members.push({ id: `up-${k}lo`, name: 'Upright, lower', sec: 'PIPE', pts: [`${k}U0`, `${k}U1`], step: 2 });
      members.push({ id: `up-${k}hi`, name: 'Upright, upper', sec: 'PIPE', pts: [`${k}U2`, `${k}U3`], step: 2 });
      // one list per fitting: a tee is three sockets round its centre
      const cF = [x, yc, z0], cM = [x, yc, zm], cT = [x, yc, zt];
      tees.push([...sock(cF, [0, -1, 0]), ...sock(cF, [0, 1, 0]), ...sock(cF, [0, 0, 1])]);
      tees.push([...sock(cM, [0, 0, -1]), ...sock(cM, [0, 0, 1]), ...sock(cM, [dx, 0, 0])]);
      // an elbow: a socket hub at each end, a curved body between them (centre-line radius Z)
      elbows.push([cyl(at(cT, [0, 0, -1], Z), at(cT, [0, 0, -1], Z + SOCK), FR), cyl(at(cT, [dx, 0, 0], Z), at(cT, [dx, 0, 0], Z + SOCK), FR),
        shapes.bend([x + dx * Z, yc, zt - Z], [x, yc, zt - Z], [0, dx, 0], 90, FB)]);
      caps.push([cyl([x, 0, z0], [x, SOCK, z0], FR)], [cyl([x, W - SOCK, z0], [x, W, z0], FR)]);
    }
    nodes.T0 = [Z, yc, zt]; nodes.T1 = [L - Z, yc, zt];
    nodes.S0 = [Z, yc, zm]; nodes.S1 = [L - Z, yc, zm];
    members.push({ id: 'rail-top', name: 'Rail', sec: 'PIPE', pts: ['T0', 'T1'], step: 3 });
    members.push({ id: 'rail-low', name: 'Rail', sec: 'PIPE', pts: ['S0', 'S1'], step: 3 });

    hardware.push(
      { id: 'tee', name: 'Tee, 32 mm solvent weld', spec: 'equal tee, PVC-U', qty: 4, step: 2, kg: 0.03, price: 0.8, shape: tees },
      { id: 'elbow', name: 'Elbow 90°, 32 mm solvent weld', spec: 'PVC-U', qty: 2, step: 3, kg: 0.02, price: 0.6, shape: elbows },
      { id: 'cap', name: 'End cap, 32 mm solvent weld', spec: 'PVC-U', qty: 4, step: 2, kg: 0.01, price: 0.4, shape: caps },
    );

    const footCut = yc - Z - CAP;
    return {
      sections: { PIPE },
      axes: { x: ['right', 'left'], y: ['back', 'front'], z: ['top', 'bottom'] },
      datum: 'x from the centre line of the left upright, y from the front end of the foot bars, z up from the floor',
      nodes, members, plates: [], hardware,
      consumables: [
        { name: 'PVC primer', qty: '100 ml' }, { name: 'PVC solvent cement', qty: '100 ml' },
        { name: 'Rag', qty: '1' },
      ],
      tools: ['PVC pipe cutter or fine hacksaw and mitre box', 'Deburring tool or file', 'Tape measure, marker', 'Spirit level'],
      supports: Object.keys(ends).flatMap(k => [{ at: nodes[`${k}F0`], fix: 'pin' }, { at: nodes[`${k}B0`], fix: 'pin' }]),
      loads: [
        { id: 'parts', name: 'Parts hung along the rail', kg: p.load, what: 'hung along the top rail', on: ['rail-top'], sf: 2, defl: Math.max(L / 80, 12) },   // a drying rail: sag only has to stay out of sight
        { id: 'point', name: 'Heavy part at mid span', kg: Math.max(5, p.load), at: [[L / 2, yc, zt]], what: 'at the middle of the top rail', sf: 2 },
        { id: 'bump', name: 'Bumped sideways', N: 20, dir: [0, 1, 0], on: ['rail-top'], what: 'pushing the rail sideways', sf: 2 },
      ],
      checks: [
        { name: 'Foot spread for its height', pass: W >= 0.75 * H - 1, value: `${u.len(W, { u: true })} for ${u.len(H, { u: true })}`, why: 'Foot bars at least three quarters of the height: the empty stand weighs very little, so its stance is what keeps a swinging part from tipping it.' },
        { name: 'Room under the rail for hung parts', pass: zt - zm - FR >= 250, value: u.len(zt - zm - FR, { u: true }), why: `At least ${u.len(250, { u: true })} between the rail and the stretcher for parts on hooks.` },
      ],
      join: 'glue',
      tolerance: `cut ${u.tol(1)}; pipe fully home in every socket`,
      steps: [
        { n: 1, phase: 'Fabricate', title: 'Cut and deburr', hours: 1, tasks: [
          'Cut every piece from the cutting plan, square: pipe cutter or mitre box.',
          'Deburr inside and out. Chamfer the outside edge a little.',
          'Write each piece mark on it. Count against the cut list.',
        ], check: `Every piece ${u.tol(1)} of its length. Ends square.`, tip: `Lengths assume fittings ${u.len(Z, { u: true })} centre to socket bottom. Measure yours; adjust each fitted end by the difference.` },
        { n: 2, phase: 'Fabricate', title: 'Two end frames (dry fit)', hours: 1, tasks: [
          `Two feet ({mark:foot-LF}) into a tee's run, a cap on each end: ${u.len(W, { u: true })} over the caps.`,
          'Lower upright ({mark:up-Llo}) into the branch. A tee on top, run vertical. Upper upright ({mark:up-Lhi}).',
          'Middle tee branch toward the other end. Second end the same, mirrored.',
        ], check: 'Each end stands upright. Foot tee branch vertical.', tip: 'Dry fit everything first: cement sets in seconds.' },
        { n: 3, phase: 'Fabricate', title: 'Join the ends (dry fit)', hours: 0.5, tasks: [
          'An elbow on each upright, pointing along the stand.',
          'One rail ({mark:rail-top}) into both elbows, the other into both middle tees.',
          `Height ${u.len(H, { u: true })} to the elbow tops.`,
        ], check: `Top rail level. Uprights plumb. Feet parallel, ${u.len(L, { u: true })} apart on centre.` },
        { n: 4, phase: 'Assemble', title: 'Cement', hours: 1, tasks: [
          'Draw a line across each joint.',
          'One joint at a time: primer, solvent cement on both, push home to the line with a quarter turn, hold 30 s.',
          'Feet, then uprights, then rails. On a flat floor.',
        ], check: 'Every pipe fully home. Sits on all four caps without rocking.', tip: 'Ventilate. Gloves. No flames.' },
        { n: 5, phase: 'Assemble', title: 'Cure and use', hours: 0.5, tasks: [
          'Leave it to cure: move it after 2 hours, load it after the full time on the can (often 24 hours).',
          `Hang up to ${u.mass(p.load)}, spread along the top rail.`,
        ], check: 'No visible sag. Does not rock with a part at one end.' },
      ],
    };
  },
};
