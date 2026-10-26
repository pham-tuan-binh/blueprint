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
const FR = 21;               // fitting body radius
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

  build(p, { u, pvcPipe }) {
    const PIPE = pvcPipe(OD, WALL, { id: 'PVC32', label: `${OD} × ${WALL} PVC-U pressure pipe`, short: 'PVC 32', stockLen: 3000, price: 2.2 });
    const L = p.length, W = p.width, H = p.height;
    const yc = W / 2;
    const z0 = FR;               // foot tee centre
    const zt = H - FR;           // top elbow centre
    const zm = z0 + (zt - z0) * 0.35;   // mid tee centre (stretcher)
    const ends = { L: 0, R: L };

    const nodes = {};
    const members = [];
    const hardware = [];
    const cyl = (a, b, r) => ({ type: 'cyl', a, b, r });
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
      // one list per fitting: its run, then its branch
      tees.push([cyl([x, yc - Z - SOCK, z0], [x, yc + Z + SOCK, z0], FR), cyl([x, yc, z0], [x, yc, z0 + Z + SOCK], FR)]);
      tees.push([cyl([x, yc, zm - Z - SOCK], [x, yc, zm + Z + SOCK], FR), cyl([x, yc, zm], [x + dx * (Z + SOCK), yc, zm], FR)]);
      elbows.push([cyl([x, yc, zt - Z - SOCK], [x, yc, zt], FR), cyl([x, yc, zt], [x + dx * (Z + SOCK), yc, zt], FR)]);
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
          'Wear eye protection. Cut every piece from the cutting plan, square: use a pipe cutter or a mitre box.',
          'Deburr inside and out and chamfer the outside edge slightly so it slides into the socket.',
          'Write the piece mark on each piece in marker and count them against the cut list.',
        ], check: `Every piece within ${u.tol(1)} of its length; ends square.`, tip: `The cut lengths assume fittings ${u.len(Z, { u: true })} from centre to socket bottom. Push a scrap into one of yours and measure: if it differs, change each length by the difference at each fitting end.` },
        { n: 2, phase: 'Fabricate', title: 'Two end frames (dry fit)', hours: 1, tasks: [
          `Push two feet ({mark:foot-LF}) into the run of a tee and a cap onto each free end: the foot bar measures ${u.len(W, { u: true })} over the caps.`,
          'Push a lower upright ({mark:up-Llo}) into the branch of the foot tee, a second tee on top with its run vertical, then an upper upright ({mark:up-Lhi}).',
          'Turn the middle tee so its branch points along the stand, toward the other end. Build the second end the same, the branch pointing the other way.',
        ], check: 'Each end stands upright on its foot bar; the foot tee branch is vertical (level across the foot bar).', tip: 'Dry fit everything first: solvent cement sets in seconds and cannot be turned.' },
        { n: 3, phase: 'Fabricate', title: 'Join the ends (dry fit)', hours: 0.5, tasks: [
          'Put an elbow on top of each upright, pointing along the stand.',
          'Push one rail ({mark:rail-top}) into both elbows (the top rail) and the other into both middle tees (the stretcher).',
          `Stand it on the floor and check the height: ${u.len(H, { u: true })} to the top of the elbows.`,
        ], check: `Top rail level; both uprights plumb; the two foot bars parallel, ${u.len(L, { u: true })} apart on centre.` },
        { n: 4, phase: 'Assemble', title: 'Cement', hours: 1, tasks: [
          'Ventilate. Mark a line across each joint in marker so it goes back the same way.',
          'Take one joint apart at a time, prime both pipe end and socket, cement both, push home with a quarter twist to the mark and hold 30 seconds.',
          'Do the foot bars first, then the uprights, then the top rail and stretcher, keeping the stand on a flat floor.',
        ], check: 'Every pipe fully home; the stand sits on all four caps without rocking.' },
        { n: 5, phase: 'Assemble', title: 'Cure and use', hours: 0.5, tasks: [
          'Leave it 2 hours before loading.',
          `Hang the parts along the top rail, up to ${u.mass(p.load)} in all, spread along it.`,
        ], check: 'Rail does not sag visibly; stand does not rock when a part is hung at one end.' },
      ],
    };
  },
};
