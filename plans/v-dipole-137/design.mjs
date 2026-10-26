// 137 MHz V-dipole for NOAA APT and Meteor LRPT weather satellites (the 9A4QV
// design): two quarter-wave rods at 120 degrees in a horizontal plane, fed at the
// apex by a panel-mount SMA jack in a 3D-printed hub that sockets onto a PVC mast.
// The coax centre goes to one rod, the shield to the other. A choke on the coax
// under the hub keeps the feedline from radiating. Tuned with a NanoVNA.
//
// Datum: x east from the apex of the V (the feed point), y north (the V opens
// toward +y), z up from the bottom end of the mast pipe. The two rods lie in one
// horizontal plane; the mast stands behind the apex so nothing metal is under the V.

const C_MM_MHZ = 299792.458;                     // speed of light, in mm × MHz
const PIPES = {                                  // PVC-U PN16 pressure pipe, outside diameter × wall
  '32': { OD: 32, t: 2.4, price: 3.2 },
  '40': { OD: 40, t: 3.0, price: 4.5 },
  '50': { OD: 50, t: 3.7, price: 6.5 },
};
const RODS = {                                   // element metals: strength for the wind check, price per metre for a 6 mm rod
  al: { name: 'Aluminium', material: 'aluminium-bare', yield: 170, E: 68900, rho: 2.7e-6, price: 3 },
  // brass or copper, checked with the weaker and heavier of the two (half-hard copper's yield, copper's weight, brass's stiffness)
  cu: { name: 'Brass or copper', material: 'copper', yield: 200, E: 100000, rho: 8.96e-6, price: 13 },
};
const CLAMP_LOW = 50, CLAMP_HIGH = 250;          // mast clamp centre lines above the pipe's bottom end
const GAP = 12;                                  // feed gap: between the inner end faces of the rods
const COAX_D = 5;                                // RG58 outside diameter
const SNAG_N = 25;                               // coax snagged or tugged at the hub
const N_PTS = 10;                                // points along the mast for its own wind drag

const windText = (u, v) => (u.imperial ? `${Math.round(v * 2.237)} mph` : `${v} m/s`);

// The hub and the drag on the antenna head: depends only on the params declared
// before the mast length, so the mast length's limit can use it too.
function head(p) {
  const f = p.freq, lam = C_MM_MHZ / f, q4 = lam / 4;
  const d = +p.elemD;
  const K = 1 - 0.118 / Math.log(lam / d);       // end effect of a rod of this thickness: about 2 %
  const Le = q4 * K;                             // element length, inner end face to tip
  const th = (p.angle * Math.PI) / 180, s = Math.sin(th / 2), c = Math.cos(th / 2);
  const r0 = GAP / (2 * s);                      // apex to each rod's inner end
  const { OD, t } = PIPES[p.pipe];
  const R = OD / 2 + 0.2 + 4;                    // socket: push-fit bore OD + 0.4, 4 mm wall
  const sd = OD + 10;                            // socket depth
  const floorT = 3, below = Math.max(d / 2, 4) + 2, above = d / 2 + 6;
  const ySMA = Math.min(r0 * c, 0) - 9;          // SMA jack axis, just behind the apex
  const yM = ySMA - 9 - R;                       // mast axis: room for the SMA plug in front of the socket
  const px = (r0 + 6) * s + 3;                   // wiring pocket half width
  const py0 = ySMA - 6, py1 = (r0 + 6) * c + d / 2 + 3;
  const rw = Math.min(px / s, c > 0.01 ? py1 / c : Infinity);   // where a rod leaves the pocket
  const rg = rw + 6;                             // grub screw along each arm
  const La = Math.max(rg + 10, r0 + Math.max(35, 4 * d));       // arm length from the apex
  const hw = d / 2 + 4;                          // arm half width
  const bx = Math.max(R, px + 3), by0 = yM - R, by1 = py1 + 4;  // hub body
  const T = floorT + below + above;              // hub plate thickness
  const ext = {
    x: 2 * Math.max(bx, La * s + hw * c),
    y: Math.max(by1, La * c + hw * s) - by0,
    z: T + sd,
  };
  const Ahub = Math.max(ext.x, ext.y) * T + 2 * R * sd;          // largest face the wind sees, mm²
  const V = +p.wind, q = 0.613 * V * V / 1e6;                    // dynamic pressure, N/mm²
  const Fh = q * (1.2 * 2 * Le * d + 1.6 * Ahub);                // drag on rods and hub, N (rods face-on: conservative)
  const w = q * 1.2 * OD;                                        // mast drag per mm, N/mm
  const di = OD - 2 * t, S = (Math.PI / 32) * (OD ** 4 - di ** 4) / OD;
  const Mallow = 0.92 * (25 / 2) * S;                            // PVC long-term 25 MPa, safety factor 2, a margin for self weight
  // the wind case puts the mast drag on N_PTS points and the head drag on whole copies of the top point,
  // so its moment is at most Fh·L + 0.65·w·L²; the snag case is SNAG_N at the top
  const Lwind = (-Fh + Math.sqrt(Fh * Fh + 4 * 0.65 * w * Mallow)) / (2 * 0.65 * w);
  const Lfree = Math.min(Lwind, Mallow / SNAG_N);
  return { f, lam, q4, d, K, Le, th, s, c, r0, OD, t, R, sd, floorT, below, above, ySMA, yM, px, py0, py1, rw, rg, La, hw, bx, by0, by1, T, ext, Ahub, V, q, Fh, w, S, Mallow, Lfree };
}

export const plan = {
  id: 'v-dipole-137',
  name: '137 MHz V-dipole for weather satellites',
  short: 'V-dipole 137',
  version: '1',
  summary: 'Two quarter-wave rods at 120° in a horizontal plane, fed by an SMA jack in a 3D-printed hub on a PVC mast: the 9A4QV receive antenna for NOAA APT and Meteor LRPT near 137 MHz.',
  units: 'metric',
  currency: '$',
  params: [
    { id: 'freq', label: 'Centre frequency', type: 'number', unit: 'MHz', value: 137.5, min: 130, max: 150, group: 'Antenna', hint: 'NOAA and Meteor downlinks: 137.1 to 137.9' },
    { id: 'angle', label: 'V angle', type: 'number', unit: '°', value: 120, min: 90, max: 180, group: 'Antenna', hint: 'between the two elements; 180 is a straight dipole' },
    { id: 'elemD', label: 'Element diameter', type: 'choice', value: '6', group: 'Antenna', options: ['5', '6', '8', '10'].map(v => ({ value: v, label: u => `${u.len(+v, { u: true })} solid rod` })) },
    { id: 'elemMat', label: 'Element metal', type: 'choice', value: 'al', group: 'Antenna', options: [
      { value: 'al', label: 'Aluminium rod (6060 / 6063), tapped and screwed' },
      { value: 'cu', label: 'Brass or copper rod, soldered' },
    ] },
    { id: 'pipe', label: 'Mast pipe', type: 'choice', value: '40', group: 'Mast', options: Object.keys(PIPES).map(k => ({ value: k, label: u => `PVC-U pressure pipe, ${u.len(PIPES[k].OD, { u: true })} outside, PN16` })) },
    { id: 'wind', label: 'Design wind gust', type: 'choice', value: '35', group: 'Mast', options: ['25', '30', '35', '40'].map(v => ({ value: v, label: u => `${windText(u, +v)} gusts${v === '35' ? ' (exposed roof or garden)' : v === '25' ? ' (sheltered)' : ''}` })) },
    { id: 'mastLen', label: 'Mast pipe length', type: 'len', value: 1200, min: 600, group: 'Mast',
      max: p => Math.min(2500, Math.floor((CLAMP_HIGH + head(p).Lfree) / 10) * 10),
      hint: u => `bottom ${u.len(CLAMP_HIGH + 50, { u: true })} clamped to a post; the limit is what this pipe carries in this wind` },
    { id: 'coaxLen', label: 'Coax length', type: 'len', value: 3000, min: 1000, max: 10000, group: 'Feed', hint: 'RG58 from the hub to the receiver' },
    { id: 'choke', label: 'Choke', type: 'choice', value: 'coil', group: 'Feed', options: [
      { value: 'coil', label: 'Five turns of the coax round the mast' },
      { value: 'ferrite', label: 'Three snap-on ferrites (mix 31)' },
    ] },
  ],

  build(p, { u, rod, pvcPipe }) {
    const g = head(p);
    const { d, s, c, r0, Le, OD, R, sd, ySMA, yM, px, py0, py1, rg, La, hw, bx, by0, by1 } = g;
    const metal = RODS[p.elemMat];
    const ELEM = rod(d, { id: `ROD${d}-${p.elemMat}`, label: `⌀${d} solid ${metal.name.toLowerCase()} rod`, short: `${metal.name} rod ⌀${d}`, stockLen: 1000, price: metal.price * (d / 6) ** 2, material: metal.material });
    const MAST = pvcPipe(OD, g.t, { id: `PVC${OD}`, label: `${OD} × ${g.t} PVC-U pressure pipe, PN16`, short: `PVC ${OD}×${g.t}`, stockLen: 3000, price: PIPES[p.pipe].price });

    // heights
    const zb = p.mastLen;                  // top of the mast = underside of the hub plate
    const zf = zb + g.floorT;              // floor of the wiring pocket
    const ze = zf + g.below;               // centre line of the elements
    const zt = ze + g.above;               // top face of the hub
    const zc = zb - sd / 2;                // cross bolt through socket and mast
    const Lf = zb - CLAMP_HIGH;            // mast free above the upper clamp

    const dirE = [s, c], dirW = [-s, c];
    const at = (dir, r, z) => [dir[0] * r, dir[1] * r, z];
    const nodes = {
      M0: [0, yM, 0], M1: [0, yM, CLAMP_LOW], M2: [0, yM, CLAMP_HIGH], M3: [0, yM, zb],
      E0: at(dirE, r0, ze), E1: at(dirE, r0 + Le, ze),
      W0: at(dirW, r0, ze), W1: at(dirW, r0 + Le, ze),
    };
    const members = [
      { id: 'elem-E', name: 'Element', sec: 'ELEM', pts: ['E0', 'E1'], step: 3, loose: true },
      { id: 'elem-W', name: 'Element', sec: 'ELEM', pts: ['W0', 'W1'], step: 3, loose: true },
      { id: 'mast', name: 'Mast', sec: 'MAST', pts: ['M0', 'M1', 'M2', 'M3'], step: 4 },
    ];

    // ---------------------------------------------------------------- the printed hub
    const arm = dir => {
      const pr = [dir[1], -dir[0]];
      const a = [-dir[0] * hw, -dir[1] * hw], b = [dir[0] * La, dir[1] * La];
      return [[a[0] + pr[0] * hw, a[1] + pr[1] * hw], [b[0] + pr[0] * hw, b[1] + pr[1] * hw], [b[0] - pr[0] * hw, b[1] - pr[1] * hw], [a[0] - pr[0] * hw, a[1] - pr[1] * hw]];
    };
    const lidScrews = [[-(px - 4), py0 - 4.5], [px - 4, py0 - 4.5]];
    const hub = {
      id: 'hub', name: 'Feed hub', step: 1, qty: 1,
      material: 'PETG', layer: 0.2, walls: 4, infill: 0.4, supports: false,
      bed: '+z', orient: 'top face down on the bed, socket pointing up (the files come turned this way); no supports, the pocket floor bridges',
      shapes: [
        { type: 'cyl', a: [0, yM, zb - sd], b: [0, yM, zb + 1], r: R },                                   // socket onto the mast
        { type: 'prism', axis: 'z', z0: zb, h: zt - zb, pts: [[-bx, by0], [bx, by0], [bx, by1], [-bx, by1]] },   // body
        { type: 'prism', axis: 'z', z0: zb, h: zt - zb, pts: arm(dirE) },                                  // east arm
        { type: 'prism', axis: 'z', z0: zb, h: zt - zb, pts: arm(dirW) },                                  // west arm
      ],
      cuts: [
        { type: 'hole', a: [0, yM, zb - sd - 1], b: [0, yM, zb], d: OD + 0.4 },                           // mast bore, push fit
        { type: 'hole', a: [-R - 1, yM, zc], b: [R + 1, yM, zc], d: 4.3 },                                 // M4 cross bolt
        { type: 'box', c: [0, (py0 + py1) / 2, (zf + zt + 1) / 2], s: [2 * px, py1 - py0, zt + 1 - zf] },  // wiring pocket, open on top
        { type: 'hole', a: [0, ySMA, zb - 1], b: [0, ySMA, zf + 1], d: 6.4 },                              // SMA bulkhead jack
        ...[dirE, dirW].map(dir => ({ type: 'hole', a: at(dir, r0 - 1, ze), b: at(dir, La + 1, ze), d: d + 0.4 })),   // rod bores
        ...[dirE, dirW].map(dir => ({ type: 'hole', a: at(dir, rg, ze), b: at(dir, rg, zt + 1), d: 4.0 })),          // grub screw inserts
        ...lidScrews.map(([x, y]) => ({ type: 'hole', a: [x, y, zt - 6], b: [x, y, zt + 1], d: 4.0 })),                // lid screw inserts
      ],
      note: 'Melt an M3 heat-set insert into each of the four small holes on the top face.',
    };
    const lidY0 = py0 - 9, lidY1 = py1 + 3, lidT = 3;
    const lid = {
      id: 'lid', name: 'Pocket lid', step: 1, qty: 1,
      material: 'PETG', layer: 0.2, walls: 4, infill: 0.4, supports: false,
      orient: 'flat on the bed',
      shapes: [{ type: 'box', c: [0, (lidY0 + lidY1) / 2, zt + lidT / 2], s: [2 * (px + 3), lidY1 - lidY0, lidT] }],
      cuts: lidScrews.map(([x, y]) => ({ type: 'hole', a: [x, y, zt - 1], b: [x, y, zt + lidT + 1], d: 3.3 })),
      note: 'Screwed down over a bead of neutral-cure silicone after tuning.',
    };

    // ---------------------------------------------------------------- electrical numbers
    const lossPer100 = 16 * Math.sqrt(g.f / 100);               // RG58, dB per 100 m
    const loss = (lossPer100 * p.coaxLen) / 1e5 + 0.2;          // plus two SMA pairs
    const coil = p.choke === 'coil';
    const turns = 5;
    const rIn = (OD + COAX_D) / 2 / 25.4, lIn = (turns * COAX_D) / 25.4;
    const Luh = (rIn * rIn * turns * turns) / (9 * rIn + 10 * lIn);     // Wheeler, µH
    const Xchoke = coil ? 2 * Math.PI * g.f * Luh : 3 * 230;
    const Rfeed = 73 * s * s;                                    // rough: a V closes the dipole's 73 Ω
    const swr = Math.max(Rfeed / 50, 50 / Rfeed);
    const mmPerMHz = Le / g.f;
    const headGap = 2 * (r0 - (p.elemMat === 'al' ? 3.2 : 1)) * s;   // between the screw heads with their ring lugs (or the solder joints)
    // element as a cantilever out of its arm, in the design wind plus its own weight
    const Lo = Le - (La - r0);
    const A = (Math.PI / 4) * d * d, I = (Math.PI / 64) * d ** 4, Sr = (Math.PI / 32) * d ** 3;
    const wg = metal.rho * A * 9.81, ww = g.q * 1.2 * d;
    const sigE = Math.hypot(ww, wg) * Lo * Lo / 2 / Sr;
    const sfE = metal.yield / sigE;
    const sag = (wg * Lo ** 4) / (8 * metal.E * I);
    const bed = Math.max(g.ext.x, g.ext.y);

    // ---------------------------------------------------------------- loads
    // drag spread up the free mast, plus the hub and rods' drag at its head: one case, two parts
    const mastPts = Array.from({ length: N_PTS }, (_, i) => [0, yM, CLAMP_HIGH + (Lf * (i + 1)) / N_PTS]);

    // aluminium will not take solder: its rods are tapped for a screw and ring terminal; brass and copper are soldered
    const tapped = p.elemMat === 'al';
    // ties: every 200 down the mast, then every 500 along the rest of the run to the receiver
    const ties = Math.ceil(p.mastLen / 200) + Math.max(2, Math.ceil(Math.max(0, p.coaxLen - p.mastLen) / 500));
    const bolt = [50, 60, 70, 80].find(L => L >= 2 * R + 8) || 80;
    const insertSpec = 'M3, short (about 4 long), for a 4.0 hole';
    const hardware = [
      { id: 'inserts', name: 'Heat-set insert, M3', spec: insertSpec, qty: 4, step: 1, price: 0.1 },
      { id: 'sma', name: 'SMA female bulkhead jack, solder cup', spec: 'panel mount, 50 Ω, with nut and lock washer, for panels up to 4 thick', qty: 1, step: 2, kg: 0.006, price: 2,
        shape: { type: 'cyl', a: [0, ySMA, zb - 9], b: [0, ySMA, zf + 7], r: 3.2 } },
      { id: 'tag', name: 'Solder tag to fit the SMA jack thread', spec: 'tinned brass ground lug', qty: 1, step: 2, price: 0.2 },
      ...(tapped ? [{ id: 'lugs', name: 'Ring terminal, M3', spec: 'tinned copper, solder or crimp', qty: 2, step: 2, price: 0.1 }] : []),
      { id: 'wire', name: 'Hook-up wire', spec: 'stranded, silicone insulated, 0.5 square', qty: 1, step: 2, price: 0.5 },
      ...(tapped ? [{ id: 'rodscrews', name: 'Screw, M3 × 6, pan head, stainless', spec: 'with a stainless washer, into the tapped rod ends', qty: 2, step: 3, price: 0.1 }] : []),
      { id: 'grubs', name: 'Grub screw, M3 × 6, cup point, stainless', spec: 'into the heat-set inserts, onto the rods', qty: 2, step: 3, price: 0.1 },
      { id: 'bolt', name: `Bolt, M4 × ${bolt}, stainless, with nyloc nut and two washers`, spec: 'through the hub socket and the mast', qty: 1, step: 4, kg: 0.01, price: 0.4,
        shape: { type: 'cyl', a: [-R - 3, yM, zc], b: [R + 3, yM, zc], r: 2 } },
      { id: 'coax', name: 'Coax, RG58, SMA male to SMA male', spec: `${(p.coaxLen / 1000).toFixed(1)} metre assembly (or the plug your receiver needs at the far end)`, qty: 1, step: 5, kg: 0.04 * p.coaxLen / 1000, price: 6 + 1.2 * p.coaxLen / 1000 },
      ...(coil ? [] : [{ id: 'ferrite', name: 'Snap-on ferrite core, mix 31, for 5 cable', spec: 'Fair-Rite 0431164181 or similar, about 230 Ω each at 137 MHz', qty: 3, step: 5, kg: 0.02, price: 2 }]),
      { id: 'ties', name: 'Cable ties, UV-stable black', spec: '200 long', qty: ties, step: 5, price: 0.05 },
      { id: 'lidscrews', name: 'Screw, M3 × 8, pan head, stainless', spec: 'lid into the heat-set inserts', qty: 2, step: 7, price: 0.1 },
      { id: 'clamps', name: 'Mast clamp (U-bolt with saddle)', spec: `M6 U-bolt for a ${OD} pipe, with a saddle for your post or wall bracket`, qty: 2, step: 7, kg: 0.08, price: 3,
        shape: [CLAMP_LOW, CLAMP_HIGH].map(z => ({ type: 'cyl', a: [0, yM, z - 8], b: [0, yM, z + 8], r: OD / 2 + 2 })) },
    ];

    const tol = u.tol(1);
    // u.len rounds metric to whole millimetres; drill sizes and print clearances need tenths
    const fine = v => u.fine(v, { u: true });
    const fEdge = [137.1, 137.9];
    const steps = [
      { n: 1, phase: 'Fabricate', title: 'Print the hub and the lid', hours: 1, tasks: [
        'Print the feed hub and the pocket lid from the files below (settings and orientation with each). PETG or ASA, not PLA: it lives outdoors.',
        'Start the print first: it takes a few hours, and steps 2 to 4 can be done while it runs.',
        'Clean the strings out of the rod bores, the SMA hole and the socket. Run a drill of the bore size through each rod bore by hand if a rod does not slide in.',
        `Melt an M3 heat-set insert into each of the four ${fine(4)} holes on the top face with a soldering iron, flush with the face: two over the arms (grub screws), two behind the pocket (lid).`,
      ], check: `A rod slides into each arm bore by hand without play you can feel; the mast pipe pushes into the socket to the end; all four inserts square and flush within ${u.tol(0.5)}.`,
        tip: 'A bore that came out tight is drilled out, never forced: forcing a rod in splits the arm along its layers.' },
      { n: 2, phase: 'Fabricate', title: 'Wire the SMA jack', hours: 0.5, tasks: [
        'Slip the solder tag over the thread of the SMA jack, then push the jack down through the hole in the floor of the pocket from inside, thread first, so the jack points down under the hub.',
        'Fit the lock washer and nut from underneath and tighten with a spanner while holding the jack body inside: it must not turn.',
        tapped
          ? `Cut two tails of hook-up wire ${u.len(40, { u: true })} long, strip ${u.len(4, { u: true })} at each end, and solder an M3 ring terminal on one end of each.`
          : `Cut two tails of hook-up wire ${u.len(40, { u: true })} long and strip ${u.len(4, { u: true })} at each end; tin both ends.`,
        'Solder one tail to the centre solder cup of the jack (this is the east element feed) and the other to the solder tag (shield, west element).',
        'Bend the tails so each free end lies over where its rod end will be: the centre tail to the east (right, looking north), the tag tail to the west.',
      ], check: `Multimeter: centre pin to jack body open circuit (no short); centre pin to the east tail and jack body to the west tail both under 1 Ω.`,
        tip: 'Heat the solder cup briefly: the jack\'s plastic insulator melts if you hold the iron on for long.' },
      { n: 3, phase: 'Fabricate', title: 'Elements: cut, tap and fit', hours: 1.5, tasks: [
        `Cut the two elements ({mark:elem-E}) from ${u.len(d, { u: true })} ${metal.name.toLowerCase()} rod, square ends, to the length on the cut sheet. Deburr both ends of each.`,
        tapped
          ? `In one end of each rod, centre-punch, drill ${fine(2.5)} on the axis ${u.len(8, { u: true })} deep, and tap M3 with a drop of cutting oil. This is the inner (feed) end.`
          : `Clean ${u.len(10, { u: true })} of one end of each rod bright with abrasive paper and tin it with a hot iron. This is the inner (feed) end.`,
        'Push each rod, feed end first, into an arm from outside until the feed end stands in the pocket.',
        tapped
          ? 'Screw an M3 × 6 screw with a washer and its ring terminal into each rod end: centre tail to the east rod, tag tail to the west rod. Snug, not tight.'
          : 'Solder the centre tail to the tinned end of the east rod and the tag tail to the west rod, on the top of the rod so it can still slide.',
        `Slide the rods until the end faces are ${u.len(GAP, { u: true })} apart (calipers between them, across the pocket), then tighten a grub screw down onto each rod through the insert over its arm.`,
      ], check: `Both rods the same length within ${tol}; end faces ${u.len(GAP)} ${u.tol(1)} apart; tip to tip ${u.len(2 * (r0 + Le) * s)} ${u.tol(5)}; each rod tight when you twist it.`,
        tip: `The element length is measured from the rod's inner end face. Do not cut them shorter "to be safe": tuning in step 6 trims them, about ${fine(mmPerMHz)} per MHz.` },
      { n: 4, phase: 'Fabricate', title: 'Mast and hub', hours: 1, tasks: [
        `Cut the mast ({mark:mast}) to length from the ${u.len(OD, { u: true })} PVC pipe with a fine saw, square; deburr inside and out.`,
        `Mark a line ${u.len(sd / 2, { u: true })} down from the top end and drill a ${fine(4.3)} hole straight through the pipe on it, across a diameter.`,
        'Push the hub onto the top of the mast until the pipe bottoms in the socket, turn it until the cross holes line up, and fit the M4 bolt with a washer each side and the nyloc nut.',
        `Mark the clamp positions on the mast: ${u.len(CLAMP_LOW)} and ${u.len(CLAMP_HIGH, { u: true })} up from the bottom end.`,
      ], check: `Mast within ${tol} of its length; the hub does not turn or lift on the mast by hand; the elements are level when the mast is held plumb (a spirit level on each rod).` },
      { n: 5, phase: 'Assemble', title: coil ? 'Coax and coil choke' : 'Coax and ferrite choke', hours: 0.5, tasks: [
        'Screw the SMA plug of the coax onto the jack under the hub, finger tight, then an eighth of a turn with a spanner.',
        'Wrap the SMA joint in self-amalgamating tape, stretched, half lapped, from the hub underside down onto the cable; then a layer of PVC tape over it against UV.',
        coil
          ? `Directly under the hub socket, wind ${turns} tight turns of the coax round the mast, side by side (about ${u.len(turns * COAX_D, { u: true })} of mast), and hold the coil with tape at each end.`
          : `Snap the three ferrite cores onto the coax as close under the hub as they will go, touching each other, and hold them with a cable tie each side.`,
        `Run the coax down the mast and cable-tie it every ${u.len(200, { u: true })}; leave a drip loop where it leaves the mast.`,
      ], check: coil
        ? `${turns} turns, tight against each other and against the mast, starting within ${u.len(50, { u: true })} of the hub; nothing slides when you tug the cable.`
        : `Three cores closed and latched, within ${u.len(50, { u: true })} of the hub; nothing slides when you tug the cable.` },
      { n: 6, phase: 'Tune and install', title: 'Tune with a NanoVNA', hours: 1, tasks: [
        'Clamp the mast upright in the open, elements at least 1.5 times their own length from walls, metal and people (a temporary post, a fence, a tripod).',
        'Calibrate the NanoVNA (open, short, load) at the end of its own short lead, then connect the far end of the antenna coax.',
        `Sweep 120 to 160 MHz and read the frequency of the lowest SWR. The aim is ${g.f.toFixed(1)} MHz ±1 MHz.`,
        `If the dip is low (below ${(g.f - 1).toFixed(1)} MHz), the elements are long: file the outer tip of each rod back by the same amount, about ${fine(mmPerMHz)} per MHz, deburr, and sweep again.`,
        `If the dip is high, the elements are short: leave them if SWR at ${fEdge[0]} and ${fEdge[1]} MHz is under 2; otherwise cut a new pair ${fine(mmPerMHz)} longer for each MHz it is high.`,
        g.f < 143
          ? 'No NanoVNA? An SWR meter needs a transmitter, and you may not transmit at 137 MHz. A licensed operator can read SWR at 144 and 146 MHz instead: it should be low at 144 and rise toward 146.'
          : 'No NanoVNA? An SWR meter needs a transmitter: only a licensed operator may use one, and only inside an amateur band.',
      ], check: `SWR minimum within ±1 MHz of ${g.f.toFixed(1)} MHz and SWR under 2 from ${fEdge[0]} to ${fEdge[1]} MHz; both elements still the same length within ${tol}.`,
        tip: 'Trim both elements equally and a little at a time: a millimetre is easy to take off and impossible to put back.' },
      { n: 7, phase: 'Tune and install', title: 'Seal, mount and point it', hours: 1.5, tasks: [
        'Fill the pocket with neutral-cure silicone (not acetic: it corrodes the joints) over the screws and the jack, lay the lid on, and screw it down with the two M3 × 8 screws.',
        `Fix the mast to its post, rail or wall bracket with the two U-bolt clamps on the marks, ${u.len(CLAMP_LOW)} and ${u.len(CLAMP_HIGH, { u: true })} up from the bottom end. Both clamps tight: the wind check counts on them.`,
        `Turn the mast so the V opens toward north or south (true north: correct a compass for the local declination). East-west passes are what the open side faces away from.`,
        'Set the mast plumb so both elements are level, and put it where it sees as much of the sky as you can, above the roof line if possible and away from other antennas.',
        'Run the coax to the receiver with the drip loop below the entry point.',
      ], check: 'Opening within 10° of north or south; each element level within 3° (a spirit level bubble inside the lines); the mast does not move when you shake it at the hub.',
        tip: 'Mount it lower rather than in a place where the mast cannot be clamped at both marks: the wind check assumes two tight clamps on a post that does not move.' },
    ];

    return {
      sections: { ELEM, MAST },
      axes: { x: ['east', 'west'], y: ['north', 'south'], z: ['top', 'bottom'] },
      datum: 'x east from the apex of the V (the feed point), y north (the V opens toward north), z up from the bottom end of the mast',
      nodes, members, plates: [], hardware, prints: [hub, lid],
      consumables: [
        { name: 'Solder, rosin core', qty: 'a little', price: 0.5 },
        { name: 'Self-amalgamating tape', qty: '1 roll', price: 4 },
        { name: 'PVC electrical tape, black', qty: '1 roll', price: 1 },
        { name: 'Neutral-cure silicone sealant', qty: '1 small tube', price: 4 },
        { name: 'Cutting oil for tapping aluminium', qty: 'a few drops', price: 0 },
      ],
      tools: ['3D printer and the filament named with each print', 'Soldering iron (with a heat-set insert tip if you have one)', 'Hacksaw or fine-tooth saw, file and deburring tool', 'Drill, centre punch, the two bits named in steps 3 and 4, M3 tap and tap wrench', 'Calipers and tape measure', 'Multimeter', 'NanoVNA or antenna analyser', 'Spanner for the SMA nut, screwdrivers, hex key for the grub screws', 'Spirit level and compass'],
      supports: [{ at: nodes.M1, fix: 'pin' }, { at: nodes.M2, fix: 'fixed' }],
      loads: [
        { id: 'wind', name: 'Wind on mast, hub and elements', what: `of drag in ${windText(u, g.V)} gusts (${u.force(g.w * Lf)} on the mast, ${u.force(g.Fh)} on hub and rods, at the top)`, sf: 2,
          parts: [{ N: g.w * Lf, dir: [1, 0, 0], at: mastPts }, { N: g.Fh, dir: [1, 0, 0], at: [[0, yM, zb]] }] },
        { id: 'snag', name: 'Coax snagged at the hub', N: SNAG_N, what: 'pulled sideways at the hub', dir: [0, 1, 0], at: [[0, yM, zb]], sf: 2 },
      ],
      checks: [
        { name: 'Element length from frequency', pass: g.K >= 0.95 && g.K <= 0.99 && Math.abs(Le - g.q4 * g.K) < 0.01,
          value: `λ/4 at ${g.f.toFixed(1)} MHz = ${u.len(g.q4, { u: true })}; × ${g.K.toFixed(3)} = ${u.len(Le, { u: true })} per element`,
          why: `A rod resonates a little shorter than a free-space quarter wave; the end effect for a ${u.len(d, { u: true })} rod is about ${((1 - g.K) * 100).toFixed(1)} %. Tuning in step 6 trims the rest.` },
        { name: 'V angle', pass: p.angle >= 90 && p.angle <= 180, value: `${p.angle}° between the elements`,
          why: 'At 120° the horizontal V has its most gain overhead and a usable lobe down to low passes, and its impedance comes close to 50 Ω. Narrower drops the impedance; 180° is a plain dipole with nulls off its ends.' },
        { name: 'Feed gap', pass: GAP / g.lam < 0.01 && headGap >= 4,
          value: `${u.len(GAP, { u: true })} between rod ends (${((GAP / g.lam) * 100).toFixed(2)} % of a wavelength), ${u.len(headGap, { u: true })} between the ${p.elemMat === 'al' ? 'screw heads' : 'solder joints'}`,
          why: `Small against the wavelength so it does not detune the feed, and wide enough that the two feed joints cannot touch (at least ${u.len(4, { u: true })}).` },
        { name: 'Feed match (rough estimate)', pass: swr <= 1.6, value: `about ${Math.round(Rfeed)} Ω, SWR ${swr.toFixed(2)} on 50 Ω coax`,
          why: 'Estimate R ≈ 73 Ω × sin²(angle ÷ 2) at resonance; the NanoVNA in step 6 gives the real number. Under 2 is plenty for receiving.' },
        { name: 'Choke on the coax', pass: Xchoke >= 500, value: coil ? `${turns} turns, about ${Luh.toFixed(2)} µH, ${Math.round(Xchoke)} Ω at ${g.f.toFixed(1)} MHz` : `3 ferrites, about ${Xchoke} Ω at ${g.f.toFixed(1)} MHz`,
          why: 'At least 500 Ω of common-mode impedance keeps current off the outside of the shield, so the coax does not become part of the antenna and pick up house noise. Coil from Wheeler\'s formula; ferrites from the datasheet curve.' },
        { name: 'Coax loss', pass: loss <= 3, value: `${loss.toFixed(1)} dB over ${u.size(p.coaxLen)} of RG58 with its plugs`,
          why: 'Under 3 dB keeps the weak satellite signal above the receiver noise; use a better cable (or a preamp at the hub) for a longer run.' },
        { name: 'Elements in the wind', pass: sfE >= 2, value: `safety factor ${sfE.toFixed(2)} (need 2); tip sags ${u.deflection(sag)} under its own weight`,
          why: `Each rod as a cantilever ${u.len(Lo, { u: true })} out of its arm in ${windText(u, g.V)} gusts plus its own weight, against the yield of ${metal.name.toLowerCase()}.` },
        { name: 'Printed hub fits', pass: Math.abs(R - (OD / 2 + 4.2)) < 0.01 && hw - (d + 0.4) / 2 >= 2.5 && bed <= 200,
          value: `socket ⌀${fine(OD + 0.4)} on a ⌀${u.len(OD, { u: true })} pipe, rod bores ⌀${fine(d + 0.4)} on ⌀${u.len(d, { u: true })} rod, ${fine(hw - (d + 0.4) / 2)} wall round each rod; ${u.len(g.ext.x)} × ${u.len(g.ext.y)} on the bed`,
          why: `Push fits: bore ${fine(0.4)} over the size; at least ${fine(2.5)} of wall round a bore that is clamped; fits a ${u.len(200, { u: true })} bed.` },
      ],
      steps,
      facts: [
        ['Frequency', `${g.f.toFixed(1)} MHz`, 'centre; NOAA APT and Meteor LRPT'],
        ['Element', u.len(Le, { u: true }), `each, ${metal.name.toLowerCase()} ⌀${u.len(d)}`],
        ['V angle', `${p.angle}°`, 'opening north or south'],
        ['Tip to tip', u.size(2 * (r0 + Le) * s), ''],
        ['Hub height', u.size(zt), 'above the bottom of the mast'],
      ],
      join: 'clamp',
      minPiece: 32,
      orderNote: 'Start the print, then cut and tap the rods and the mast while it runs; wire the jack, fit the rods, tune, then seal and mount.',
    };
  },
};
