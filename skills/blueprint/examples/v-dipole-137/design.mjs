// 137 MHz V-dipole for NOAA APT and Meteor LRPT weather satellites (the 9A4QV
// design), built from solid-core copper house wire: two quarter-wave wires at 120
// degrees in a horizontal plane. Wire cannot stand out half a metre on its own, so
// each one lies along the top of a thin PVC conduit arm, held by printed snap clips
// and a printed tip cap. The arms push into sockets on a 3D-printed hub that sits on
// a PVC mast; the wires enter the hub through a channel and are clamped under a
// screw and washer on a heat-set insert, with the SMA jack's tails. A choke on the
// coax under the hub keeps the feedline from radiating. Tuned with a NanoVNA by
// trimming the wire tips.
//
// Datum: x east from the apex of the V (the feed point), y north (the V opens
// toward +y), z up from the bottom end of the mast pipe. The two wires lie in one
// horizontal plane; the mast stands behind the apex so nothing metal is under the V.

const C_MM_MHZ = 299792.458;                     // speed of light, in mm × MHz
const PIPES = {                                  // PVC-U PN16 pressure pipe, outside diameter × wall
  '32': { OD: 32, t: 2.4, price: 3.2 },
  '40': { OD: 40, t: 3.0, price: 4.5 },
  '50': { OD: 50, t: 3.7, price: 6.5 },
};
// solid-core house wire (H07V-U / TW style): conductor and insulated outside diameters, nearest AWG, price per metre
const WIRES = {
  '1.5': { dc: 1.38, do: 3.0, awg: 16, price: 0.6 },
  '2.5': { dc: 1.78, do: 3.6, awg: 14, price: 0.9 },
  '4': { dc: 2.26, do: 4.2, awg: 12, price: 1.4 },
  '6': { dc: 2.76, do: 4.8, awg: 10, price: 2.0 },
};
const ARMS = {                                   // rigid PVC electrical conduit: outside diameter × wall
  '16': { OD: 16, t: 1.4, price: 1.0 },
  '20': { OD: 20, t: 1.6, price: 1.3 },
};
const CLAMP_LOW = 50, CLAMP_HIGH = 250;          // mast clamp centre lines above the pipe's bottom end
const GAP = 12;                                  // feed gap: between the inner ends of the two wires
const COAX_D = 5;                                // RG58 outside diameter
const SNAG_N = 25;                               // coax snagged or tugged at the hub
const N_PTS = 10;                                // points along the mast for its own wind drag
const PVC_MPA = 25;                              // PVC long-term design stress (the kit's value)
const CU_MPA = 70;                               // annealed (soft) copper house wire: yield, MPa
const EPS_PVC = 3.5;                             // PVC insulation, relative permittivity
const K_SUP = 0.99;                              // the PVC arm and clips touching the wire: about 1 % shorter
const SPACE = 120;                               // the wire is held at least this often
const CW = 10;                                   // clip width along the arm
const RING = 3;                                  // ring wall of the clips and the tip cap
const MOUTH = 0.75;                              // clip opening ÷ arm diameter
const CAP_SOCK = 15, CAP_END = 4;                // tip cap: socket depth over the tube, end wall
const STICK = 12;                                // wire past the cap at the design length
const WR = 6;                                    // M3 penny washer radius (3.2 × 12)
const PROUD = 0.8;                               // wire top above the pocket floor (= a ring terminal's thickness)

const windText = (u, v) => (u.imperial ? `${Math.round(v * 2.237)} mph` : `${v} m/s`);
const wireName = (u, k) => (u.imperial ? `${WIRES[k].awg} AWG / ${k} sq mm` : `${k} mm²`);

// The hub, the arms and the drag on the antenna head: depends only on the params
// declared before the mast length, so the mast length's limit can use it too.
// The arms are 16 mm conduit where that holds in the design wind, else 20 mm.
function head(p) {
  const h = headFor(p, '16');
  return h.a.sf >= 2 ? h : { ...headFor(p, '20'), sf16: h.a.sf };
}
function headFor(p, armKey) {
  const f = p.freq, lam = C_MM_MHZ / f, q4 = lam / 4;
  const W = WIRES[p.wire], dc = W.dc, ins = p.insul === 'ins', dw = ins ? W.do : dc;
  const K = 1 - 0.118 / Math.log(lam / dc);              // end effect of a conductor this thin: about 1.5 %
  const epsEff = ins ? 1 + (1 - 1 / EPS_PVC) * Math.log(W.do / dc) / Math.log(lam / dc) : 1;
  const kIns = 1 / Math.sqrt(epsEff);                    // PVC insulation slows the wave: approximate
  const Le = q4 * K * K_SUP * kIns;                      // electrical length, inner end to tip
  const allow = Le * (ins ? 0.03 : 0.01);                // cut long, trim to tune
  const Lcut = Le + allow;
  const th = (p.angle * Math.PI) / 180, s = Math.sin(th / 2), c = Math.cos(th / 2);
  const r0 = GAP / (2 * s);                              // apex to each wire's inner end
  const A = ARMS[armKey], aOD = A.OD, aRi = aOD / 2 + 0.2, aRo = aRi + RING, hwA = aRi + 3.5;
  const sock = Math.max(25, 1.6 * aOD);                  // arm socket depth in the hub
  const { OD, t } = PIPES[p.pipe];
  const R = OD / 2 + 0.2 + 4;                            // mast socket: bore OD + 0.4, 4 mm wall
  const sd = OD + 10;                                    // mast socket depth
  // heights above the top of the mast (the hub's underside)
  const dzW = aOD / 2 + dw / 2 + 0.1;                    // wire centre above the arm's axis: it lies on top
  const eOff = 5.5 + aRi;                                // arm axis: 5.5 of wall under the socket bore
  const wOff = eOff + dzW;                               // wire centre line
  const flOff = wOff + dc / 2 - PROUD;                   // pocket floor: the wire stands proud of it in a groove
  const topOff = Math.max(wOff + dw / 2 + 0.2 + 2.5, flOff + 9);
  // the clamp: an M3 screw beside each wire, outboard, its washer over the wire's last few mm
  const rs = r0 + 7, off = 2.9 + dc / 2;
  const sx = rs * s + off * c, sy = rs * c - off * s;
  const ySMA = Math.min(-9, sy - WR - 9);                // SMA jack axis, behind the apex, clear of the washers
  const yM = ySMA - 9 - R;                               // mast axis: room for the SMA plug in front of the socket
  const px = sx + WR + 1.5, py0 = ySMA - 7, py1 = Math.max(sy + WR + 1.5, r0 * c + 3);
  const rw = Math.min(px / s, c > 0.01 ? py1 / c : Infinity);   // where a wire leaves the pocket
  // the arm socket starts where its bore clears the pocket by a 2.5 wall
  const clear = r => [-1, 1].every(k => [0, 5, 10, 20, 30].every(dr => {
    const x = (r + dr) * s + k * aRi * c, y = (r + dr) * c - k * aRi * s;
    return Math.abs(x) > px + 2.5 || y > py1 + 2.5 || y < py0 - 2.5;
  }));
  let ra0 = rw + 2;
  while (!clear(ra0)) ra0 += 0.5;
  const La = ra0 + sock;                                 // hub arm end, from the apex
  const rg = ra0 + sock / 2;                             // grub screw under each socket
  const bx = Math.max(R, px + 3), by0 = yM - R, by1 = py1 + 3;
  const T = topOff;
  const ext = { x: 2 * Math.max(bx, La * s + hwA * c), y: Math.max(by1, La * c + hwA * s) - by0, z: T + sd };
  const Ahub = Math.max(ext.x, ext.y) * T + 2 * R * sd;   // largest face the wind sees, mm²
  const V = +p.wind, q = 0.613 * V * V / 1e6;             // dynamic pressure, N/mm²
  // the arm as a cantilever out of its socket, wire, clips and cap on it
  const di = aOD - 2 * A.t, Sa = (Math.PI / 32) * (aOD ** 4 - di ** 4) / aOD, Aa = (Math.PI / 4) * (aOD ** 2 - di ** 2);
  const wWire = ((Math.PI / 4) * dc * dc * 8.96e-6 + (ins ? (Math.PI / 4) * (W.do ** 2 - dc * dc) * 1.4e-6 : 0)) * 9.81;   // N/mm
  const clipKg = (Math.PI * (aRo ** 2 - aRi ** 2) * CW * 1.4) * 1.27e-6 * 0.8;                     // ring and boss, about
  const capKg = (Math.PI * (aRo ** 2 - aRi ** 2) * CAP_SOCK * 1.4 + Math.PI * aRo ** 2 * CAP_END) * 1.27e-6 * 0.8;
  const arm = stick => {
    const rCapOut = r0 + Le - stick, rTube = rCapOut - CAP_END, rCapIn = rTube - CAP_SOCK;
    const span = rCapIn - La, nG = Math.ceil(span / SPACE), gap = span / nG, nC = nG - 1;
    const L = rCapOut - La, ls = stick + allow;          // free arm, and the wire past the cap
    const wh = q * 1.2 * (aOD + dw), wv = Aa * 1.4e-6 * 9.81 + wWire;
    const Fc = q * 1.6 * CW * 2 * aRo, Fcap = q * 1.6 * (CAP_SOCK + CAP_END) * 2 * aRo, Fs = q * 1.2 * dw * ls;
    let Mh = wh * L * L / 2 + Fcap * (L - (CAP_SOCK + CAP_END) / 2) + Fs * (L + ls / 2);
    let Mv = wv * L * L / 2 + capKg * 9.81 * (L - (CAP_SOCK + CAP_END) / 2) + wWire * ls * (L + ls / 2);
    for (let i = 1; i <= nC; i++) { Mh += Fc * gap * i; Mv += clipKg * 9.81 * gap * i; }
    const M = Math.hypot(Mh, Mv), sf = PVC_MPA / (M / Sa);
    return { stick, ls, rCapOut, rTube, rCapIn, span, nG, gap, nC, L, M, sf };
  };
  const a = arm(STICK);
  const Fh = q * (1.2 * 2 * (a.L * (aOD + dw) + a.ls * dw) + 1.6 * (Ahub + 2 * (a.nC * CW * 2 * aRo + (CAP_SOCK + CAP_END) * 2 * aRo)));
  const w = q * 1.2 * OD;                                        // mast drag per mm, N/mm
  const dm = OD - 2 * t, S = (Math.PI / 32) * (OD ** 4 - dm ** 4) / OD;
  const Mallow = 0.92 * (PVC_MPA / 2) * S;                       // safety factor 2, a margin for self weight
  // the wind case puts the mast drag on N_PTS points and the head drag on the top point,
  // so its moment is at most Fh·L + 0.65·w·L²; the snag case is SNAG_N at the top
  const Lwind = (-Fh + Math.sqrt(Fh * Fh + 4 * 0.65 * w * Mallow)) / (2 * 0.65 * w);
  const Lfree = Math.min(Lwind, Mallow / SNAG_N);
  return { armKey, f, lam, q4, W, dc, dw, ins, K, kIns, epsEff, Le, allow, Lcut, th, s, c, r0, A, aOD, aRi, aRo, hwA, sock, OD, t, R, sd,
    dzW, eOff, wOff, flOff, topOff, rs, off, sx, sy, ySMA, yM, px, py0, py1, rw, ra0, La, rg, bx, by0, by1, T, ext, Ahub, V, q,
    Sa, wWire, clipKg, capKg, a, Fh, w, S, Mallow, Lfree };
}

export const plan = {
  id: 'v-dipole-137',
  name: '137 MHz V-dipole for weather satellites',
  short: 'V-dipole 137',
  version: '2',
  summary: 'Two quarter-wave solid copper wires at 120° in a horizontal plane, each laid along a PVC conduit arm in printed clips, fed by an SMA jack in a 3D-printed hub on a PVC mast: the 9A4QV receive antenna for NOAA APT and Meteor LRPT near 137 MHz.',
  units: 'metric',
  currency: '$',
  params: [
    { id: 'freq', label: 'Centre frequency', type: 'number', unit: 'MHz', value: 137.5, min: 130, max: 150, group: 'Antenna', hint: 'NOAA and Meteor downlinks: 137.1 to 137.9' },
    { id: 'angle', label: 'V angle', type: 'number', unit: '°', value: 120, min: 90, max: 180, group: 'Antenna', hint: 'between the two elements; 180 is a straight dipole' },
    { id: 'wire', label: 'Copper wire', type: 'choice', value: '1.5', group: 'Antenna', options: Object.keys(WIRES).map(k => ({ value: k, label: u => `${wireName(u, k)} solid-core house wire, ⌀${u.fine(WIRES[k].dc, { u: true })} copper` })) },
    { id: 'insul', label: 'Insulation', type: 'choice', value: 'bare', group: 'Antenna', options: [
      { value: 'bare', label: 'Stripped bare (the length is exact)' },
      { value: 'ins', label: 'Left on (about 3 % shorter, approximate: tune it)' },
    ] },
    { id: 'pipe', label: 'Mast pipe', type: 'choice', value: '40', group: 'Mast', options: Object.keys(PIPES).map(k => ({ value: k, label: u => `PVC-U pressure pipe, ${u.len(PIPES[k].OD, { u: true })} outside, PN16` })) },
    { id: 'wind', label: 'Design wind gust', type: 'choice', value: '35', group: 'Mast', options: ['25', '30', '35', '40'].map(v => ({ value: v, label: u => `${windText(u, +v)} gusts${v === '35' ? ' (exposed roof or garden)' : v === '25' ? ' (sheltered)' : ''}` })) },
    { id: 'mastLen', label: 'Mast pipe length', type: 'len', value: 1000, min: 500, group: 'Mast',
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
    const { dc, dw, ins, s, c, r0, Le, Lcut, allow, aOD, aRi, aRo, hwA, OD, R, sd, ySMA, yM, px, py0, py1, rw, ra0, La, rg, bx, by0, by1, sx, sy, a } = g;
    const W = WIRES[p.wire];
    const WIRE = rod(dc, { id: `WIRE${p.wire}${ins ? 'i' : ''}`, label: `${wireName(u, p.wire)} solid copper house wire${ins ? ', insulated' : ''} (⌀${u.fine(dc)} conductor)`, short: `Cu wire ${p.wire}`, stockLen: 1000, price: W.price, material: 'copper' });
    const ARM = pvcPipe(aOD, g.A.t, { id: `CONDUIT${aOD}`, label: `${aOD} × ${g.A.t} rigid PVC electrical conduit`, short: `Conduit ${aOD}`, stockLen: 3000, price: g.A.price });
    const MAST = pvcPipe(OD, g.t, { id: `PVC${OD}`, label: `${OD} × ${g.t} PVC-U pressure pipe, PN16`, short: `PVC ${OD}×${g.t}`, stockLen: 3000, price: PIPES[p.pipe].price });

    // heights
    const zb = p.mastLen;                  // top of the mast = underside of the hub
    const ze = zb + g.eOff;                // arm axes
    const zw = zb + g.wOff;                // wire centre lines
    const zf = zb + g.flOff;               // pocket floor (the clamp face)
    const zt = zb + g.topOff;              // top face of the hub
    const zc = zb - sd / 2;                // cross bolt through socket and mast
    const Lf = zb - CLAMP_HIGH;            // mast free above the upper clamp

    const dirE = [s, c], dirW = [-s, c];
    const at = (dir, r, z) => [dir[0] * r, dir[1] * r, z];
    const nodes = {
      M0: [0, yM, 0], M1: [0, yM, CLAMP_LOW], M2: [0, yM, CLAMP_HIGH], M3: [0, yM, zb],
      AE0: at(dirE, ra0, ze), AE1: at(dirE, a.rTube, ze), AW0: at(dirW, ra0, ze), AW1: at(dirW, a.rTube, ze),
      E0: at(dirE, r0, zw), E1: at(dirE, r0 + Lcut, zw), W0: at(dirW, r0, zw), W1: at(dirW, r0 + Lcut, zw),
    };
    const members = [
      { id: 'arm-E', name: 'Arm', sec: 'ARM', pts: ['AE0', 'AE1'], step: 3, loose: true },
      { id: 'arm-W', name: 'Arm', sec: 'ARM', pts: ['AW0', 'AW1'], step: 3, loose: true },
      { id: 'wire-E', name: 'Element wire', sec: 'WIRE', pts: ['E0', 'E1'], step: 4, loose: true },
      { id: 'wire-W', name: 'Element wire', sec: 'WIRE', pts: ['W0', 'W1'], step: 4, loose: true },
      { id: 'mast', name: 'Mast', sec: 'MAST', pts: ['M0', 'M1', 'M2', 'M3'], step: 6 },
    ];

    // ---------------------------------------------------------------- the printed hub
    const band = (dir, r1, r2, hw) => {     // a strip along an arm, in plan: four corners
      const pr = [dir[1], -dir[0]];
      return [[dir[0] * r1 + pr[0] * hw, dir[1] * r1 + pr[1] * hw], [dir[0] * r2 + pr[0] * hw, dir[1] * r2 + pr[1] * hw],
        [dir[0] * r2 - pr[0] * hw, dir[1] * r2 - pr[1] * hw], [dir[0] * r1 - pr[0] * hw, dir[1] * r1 - pr[1] * hw]];
    };
    const strip = (dir, r1, r2, l1, l2) => {   // a strip along an arm between two lateral offsets, in plan
      const pr = [dir[1], -dir[0]], P = (r, l) => [dir[0] * r + pr[0] * l, dir[1] * r + pr[1] * l];
      return [P(r1, l1), P(r2, l1), P(r2, l2), P(r1, l2)];
    };
    const screws = [[sx, sy], [-sx, sy]];
    const lidScrews = [[-(px - 4), py0 - 4.5], [px - 4, py0 - 4.5]];
    const hub = {
      id: 'hub', name: 'Feed hub', step: 1, qty: 1,
      material: 'PETG', layer: 0.2, walls: 4, infill: 0.4, supports: false,
      bed: '+z', orient: 'top face down on the bed, mast socket pointing up (the files come turned this way); no supports: the pocket floor and the tops of the arm bores bridge',
      shapes: [
        { type: 'cyl', a: [0, yM, zb - sd], b: [0, yM, zb + 1], r: R },                                    // socket onto the mast
        { type: 'prism', axis: 'z', z0: zb, h: zt - zb, pts: [[-bx, by0], [bx, by0], [bx, by1], [-bx, by1]] },    // body
        { type: 'prism', axis: 'z', z0: zb, h: zt - zb, pts: band(dirE, -hwA, La, hwA) },                   // east arm socket
        { type: 'prism', axis: 'z', z0: zb, h: zt - zb, pts: band(dirW, -hwA, La, hwA) },                   // west arm socket
      ],
      cuts: [
        { type: 'hole', a: [0, yM, zb - sd - 1], b: [0, yM, zb], d: OD + 0.4 },                            // mast bore, push fit
        { type: 'hole', a: [-R - 1, yM, zc], b: [R + 1, yM, zc], d: 4.3 },                                  // M4 cross bolt
        { type: 'box', c: [0, (py0 + py1) / 2, (zf + zt + 1) / 2], s: [2 * px, py1 - py0, zt + 1 - zf] },   // wiring pocket, open on top
        { type: 'box', c: [0, ySMA, (zb + 3 + zf + 1) / 2], s: [14, 14, zf + 1 - zb - 3] },                 // well for the SMA jack: 3 thick floor
        { type: 'hole', a: [0, ySMA, zb - 1], b: [0, ySMA, zb + 4], d: 6.4 },                               // SMA bulkhead jack
        ...[dirE, dirW].map(dir => ({ type: 'hole', a: at(dir, ra0, ze), b: at(dir, La + 1, ze), d: aOD + 0.4 })),      // arm sockets
        ...[dirE, dirW].map(dir => ({ type: 'hole', a: at(dir, rw - 0.5, zw), b: at(dir, La + 1, zw), d: dw + 0.4 })),  // wire channels
        ...[dirE, dirW].map(dir => ({ type: 'hole', a: at(dir, r0 - 1, zw), b: at(dir, rw + 0.5, zw), d: dc + 0.3 })),  // wire grooves in the floor
        ...screws.map(([x, y]) => ({ type: 'hole', a: [x, y, zf - 7], b: [x, y, zf + 1], d: 4.0 })),                      // clamp screw inserts
        ...[dirE, dirW].map(dir => ({ type: 'hole', a: at(dir, rg, zb - 1), b: at(dir, rg, ze), d: 4.0 })),             // arm grub screw inserts, from below
        ...lidScrews.map(([x, y]) => ({ type: 'hole', a: [x, y, zt - 6], b: [x, y, zt + 1], d: 4.0 })),                 // lid screw inserts
      ],
      note: 'Melt an M3 heat-set insert into each of the six small holes: two in the pocket floor, two under the arm sockets, two on the top face behind the pocket.',
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

    // ---------------------------------------------------------------- clips and tip caps
    // one clip, modelled at the first position on the east arm; the copies place it along
    // both arms (turned about the apex by the V angle onto the west arm)
    const rb = dw / 2 + 0.2 + 2;                                  // boss round the wire hole: 2 of wall
    const mouth = MOUTH * aOD;
    const r1 = La + a.gap;
    const ringAt = (r, len, z, rad) => ({ type: 'cyl', a: at(dirE, r - len / 2, z), b: at(dirE, r + len / 2, z), r: rad });
    const holeAt = (r, len, z, d) => ({ type: 'hole', a: at(dirE, r - len / 2, z), b: at(dirE, r + len / 2, z), d });
    const clip = {
      id: 'clip', name: 'Wire clip', step: 5,
      material: 'PETG', layer: 0.2, walls: 4, infill: 0.6, supports: false,
      orient: 'as modelled: lying on its side, the open mouth down, standing on its two flat feet; no supports (the top of the bore bridges)',
      shapes: [
        ringAt(r1, CW, ze, aRo), ringAt(r1, CW, zw, rb),
        ...[1, -1].map(k => ({ type: 'prism', axis: 'z', z0: ze - aRo, h: aRo - 5, pts: strip(dirE, r1 - CW / 2, r1 + CW / 2, k * (mouth / 2 - 1), k * (mouth / 2 + 3)) })),   // flat feet either side of the mouth
      ],
      cuts: [
        holeAt(r1, CW + 2, ze, aOD + 0.2),                         // snug on the arm: the C springs closed onto it
        holeAt(r1, CW + 2, zw, dw + 0.4),                          // wire hole, the wire slides through
        { type: 'prism', axis: 'z', z0: ze - aRo - 1, h: aRo + 1.3 - Math.sqrt(aRi ** 2 - (mouth / 2) ** 2), pts: band(dirE, r1 - CW / 2 - 0.5, r1 + CW / 2 + 0.5, mouth / 2) },   // the mouth, up to where the bore takes over
      ],
      copies: [
        ...Array.from({ length: a.nC - 1 }, (_, i) => ({ move: [s * a.gap * (i + 1), c * a.gap * (i + 1), 0] })),
        ...Array.from({ length: a.nC }, (_, i) => ({ rotZ: p.angle, about: [0, 0, 0], move: [-s * a.gap * i, c * a.gap * i, 0] })),
      ],
      note: `Thread ${a.nC} onto each wire before the tip cap; snap onto the arm from above.`,
    };
    const capLen = CAP_SOCK + CAP_END, rCapMid = a.rCapIn + capLen / 2;
    const cap = {
      id: 'cap', name: 'Tip cap', step: 5,
      material: 'PETG', layer: 0.2, walls: 4, infill: 0.6, supports: false,
      orient: 'as modelled: lying on its flat foot, the socket and end wall standing up; no supports (the top of the socket bridges)',
      shapes: [
        ringAt(rCapMid, capLen, ze, aRo), ringAt(rCapMid, capLen, zw, rb),
        { type: 'prism', axis: 'z', z0: ze - aRo, h: 3, pts: band(dirE, a.rCapIn, a.rCapOut, 4.5) },   // flat foot
      ],
      cuts: [
        { type: 'hole', a: at(dirE, a.rCapIn - 1, ze), b: at(dirE, a.rTube, ze), d: aOD + 0.3 },        // socket over the tube end, push fit
        holeAt(rCapMid, capLen + 2, zw, dw + 0.4),                                                      // wire hole through the end wall
      ],
      copies: [{ rotZ: p.angle, about: [0, 0, 0] }],
      note: 'Pushed over the end of the arm; the wire comes out through the end wall.',
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
    // closest approach of the two sides' metal in the pocket: washer to washer, washer to the other wire's end
    const wEnd = [-r0 * s, r0 * c];
    const washerGap = Math.min(2 * sx - 2 * WR, Math.hypot(sx - wEnd[0], sy - wEnd[1]) - WR - dc / 2);
    // the wire past the cap, as a cantilever in the wind plus its own weight
    const Zc = (Math.PI / 32) * dc ** 3, Ic = (Math.PI / 64) * dc ** 4;
    const sigTip = Math.hypot(g.q * 1.2 * dw, g.wWire) * a.ls ** 2 / 2 / Zc;
    const sfTip = CU_MPA / sigTip;
    const sagTip = (g.wWire * a.ls ** 4) / (8 * 117000 * Ic);
    const longest = a.gap - CW / 2;                              // hub face to the first clip, clip to clip less a width
    const strain = ((aOD - mouth) * RING) / (3 * Math.PI * (aRi + RING / 2) ** 2);   // C ring sprung open over the arm
    const bed = Math.max(g.ext.x, g.ext.y);
    const stripIn = rw - r0 + 2;                                 // insulated wire: bare from the inner end to the channel
    const nClips = 2 * a.nC;

    // ---------------------------------------------------------------- loads
    // drag spread up the free mast, plus the head's drag (hub, arms, wires, clips, caps) at its top: one case, two parts
    const mastPts = Array.from({ length: N_PTS }, (_, i) => [0, yM, CLAMP_HIGH + (Lf * (i + 1)) / N_PTS]);

    // ties: every 200 down the mast, then every 500 along the rest of the run to the receiver
    const ties = Math.ceil(p.mastLen / 200) + Math.max(2, Math.ceil(Math.max(0, p.coaxLen - p.mastLen) / 500));
    const bolt = [50, 60, 70, 80].find(L => L >= 2 * R + 8) || 80;
    const hardware = [
      { id: 'inserts', name: 'Heat-set insert, M3', spec: 'M3, short (about 4 long), for a 4.0 hole', qty: 6, step: 1, price: 0.1 },
      { id: 'sma', name: 'SMA female bulkhead jack, solder cup', spec: 'panel mount, 50 Ω, with nut and lock washer, for panels up to 4 thick', qty: 1, step: 2, kg: 0.006, price: 2,
        shape: { type: 'cyl', a: [0, ySMA, zb - 9], b: [0, ySMA, zb + 3 + 7], r: 3.2 } },
      { id: 'tag', name: 'Solder tag to fit the SMA jack thread', spec: 'tinned brass ground lug', qty: 1, step: 2, price: 0.2 },
      { id: 'lugs', name: 'Ring terminal, M3', spec: 'tinned copper, for 0.5 to 1.5 square wire, solder or crimp', qty: 2, step: 2, price: 0.1 },
      { id: 'hookup', name: 'Hook-up wire', spec: 'stranded, silicone insulated, 0.5 square', qty: 1, step: 2, price: 0.5 },
      { id: 'grubs', name: 'Grub screw, M3 × 8, cup point, stainless', spec: 'into the inserts under the sockets, onto the arms', qty: 2, step: 3, price: 0.1 },
      { id: 'clampscrews', name: 'Screw, M3 × 8, pan head, stainless', spec: 'clamps each wire end into its insert in the pocket floor', qty: 2, step: 4, price: 0.1,
        shape: screws.map(([x, y]) => ({ type: 'cyl', a: [x, y, zf + PROUD], b: [x, y, zf + PROUD + 3.2], r: 2.75 })) },
      { id: 'washers', name: 'Penny washer, M3 × 12, stainless', spec: '3.2 hole, 12 outside, about 1 thick', qty: 2, step: 4, price: 0.1,
        shape: screws.map(([x, y]) => ({ type: 'cyl', a: [x, y, zf + PROUD], b: [x, y, zf + PROUD + 1], r: WR })) },
      { id: 'bolt', name: `Bolt, M4 × ${bolt}, stainless, with nyloc nut and two washers`, spec: 'through the hub socket and the mast', qty: 1, step: 6, kg: 0.01, price: 0.4,
        shape: { type: 'cyl', a: [-R - 3, yM, zc], b: [R + 3, yM, zc], r: 2 } },
      { id: 'coax', name: 'Coax, RG58, SMA male to SMA male', spec: `${(p.coaxLen / 1000).toFixed(1)} metre assembly (or the plug your receiver needs at the far end)`, qty: 1, step: 7, kg: 0.04 * p.coaxLen / 1000, price: 6 + 1.2 * p.coaxLen / 1000 },
      ...(coil ? [] : [{ id: 'ferrite', name: 'Snap-on ferrite core, mix 31, for 5 cable', spec: 'Fair-Rite 0431164181 or similar, about 230 Ω each at 137 MHz', qty: 3, step: 7, kg: 0.02, price: 2 }]),
      { id: 'ties', name: 'Cable ties, UV-stable black', spec: '200 long', qty: ties, step: 7, price: 0.05 },
      { id: 'lidscrews', name: 'Screw, M3 × 8, pan head, stainless', spec: 'lid into the heat-set inserts', qty: 2, step: 9, price: 0.1 },
      { id: 'clamps', name: 'Mast clamp (U-bolt with saddle)', spec: `M6 U-bolt for a ${OD} pipe, with a saddle for your post or wall bracket`, qty: 2, step: 9, kg: 0.08, price: 3,
        shape: [CLAMP_LOW, CLAMP_HIGH].map(z => ({ type: 'cyl', a: [0, yM, z - 8], b: [0, yM, z + 8], r: OD / 2 + 2 })) },
    ];

    const tol = u.tol(1);
    // u.len rounds metric to whole millimetres; drill sizes and print clearances need tenths
    const fine = v => u.fine(v, { u: true });
    const fEdge = [137.1, 137.9];
    const clipRows = Array.from({ length: a.nC }, (_, i) => [`Clip ${i + 1}`, u.len(a.gap * (i + 1)), '', '']);
    const steps = [
      { n: 1, phase: 'Fabricate', title: 'Print the hub and the lid', hours: 1, tasks: [
        `Print the hub, then the lid (files below). Queue the ${nClips} clips and 2 tip caps from step 5. PETG or ASA, not PLA.`,
        'Start steps 2 and 3 while it prints.',
        'Clear strings from the sockets, channels and holes. A scrap of wire must slide through each channel.',
        `Melt an M3 heat-set insert into each ${fine(4)} hole, flush: two in the pocket, two under the arm sockets, two behind the pocket.`,
      ], check: `Conduit and mast push into their sockets by hand. Inserts flush ${u.tol(0.5)}.`,
        tip: 'A tight socket: open it with a file. Never force the tube: the hub splits along its layers.' },
      { n: 2, phase: 'Fabricate', title: 'Wire the SMA jack', hours: 0.5, tasks: [
        `Two hook-up wire tails, ${u.len(50, { u: true })}. Strip ${u.len(4, { u: true })} each end. An M3 ring terminal on one end of each.`,
        'Solder tag over the jack thread. One tail to the centre cup (east), one to the tag (west).',
        'Jack down through the well behind the pocket. Lock washer and nut from under; hold the body, tighten.',
        'Centre tail to the east insert, tag tail to the west one.',
      ], check: 'Multimeter: centre pin to body open; each pin to its ring terminal under 1 Ω.',
        tip: 'Solder before the jack goes in: the insulator and the PETG soften under a slow iron.' },
      { n: 3, phase: 'Fabricate', title: 'Arms', hours: 0.5, tasks: [
        `Cut two arms ({mark:arm-E}) from ${u.len(aOD, { u: true })} conduit, square. Deburr.`,
        'Push each into its socket until it bottoms.',
        'Grub screw in each insert until it bears, then a quarter turn.',
      ], check: `Tip to tip ${u.len(2 * a.rTube * s)} ${u.tol(5)}. Arms do not turn or pull out. Tips level ${u.tol(3)} on a flat table.` },
      { n: 4, phase: 'Fabricate', title: 'Element wires', hours: 1, tasks: [
        `Straighten the ${wireName(u, p.wire)} wire: one end in a vise, pull the other until it lies dead straight. Cut two wires ({mark:wire-E}).`,
        ins
          ? `Strip ${u.len(stripIn, { u: true })} at the inner end only. Do not nick the copper.`
          : 'Strip all the insulation: slit it lengthwise, peel it off. Do not nick the copper.',
        'Feed each inner end through its arm channel into the pocket groove.',
        `Inner ends ${u.len(GAP, { u: true })} apart.`,
        'On each insert: ring terminal, penny washer over terminal and wire, M3 × 8 screw. Tighten until the wire flattens.',
      ], check: `Gap ${u.len(GAP)} ${u.tol(1)}. Wires stay put when tugged. Each wire to its pin under 1 Ω; pin to body still open.`,
        tip: `Set the gap before you tighten. The wires are ${u.len(allow, { u: true })} long on purpose: step 8 trims them.` },
      { n: 5, phase: 'Fabricate', title: 'Clips and tip caps', hours: 0.5, table: { title: 'Clip centres along each arm', head: ['Clip', 'From the hub arm end', 'East', 'West'], rows: clipRows, ticks: [2, 3] }, tasks: [
        `Print ${nClips} clips and 2 tip caps if not done. A clip must click onto an offcut and grip.`,
        `From the tip end: ${a.nC} clips onto each wire, mouths down, then a tip cap.`,
        'Cap over the arm end until it bottoms. A dab of neutral-cure silicone.',
        'Mark the clip centres (table). Snap each clip onto the arm on its mark.',
        `Pull the wire straight. Tip ${u.len(a.ls, { u: true })} past the cap.`,
      ], check: `No kinks. Clips on their marks ${u.tol(5)}. Tips ${u.len(a.ls)} ${u.tol(3)} past the caps. Tip to tip ${u.len(2 * (r0 + Lcut) * s)} ${u.tol(5)}.` },
      { n: 6, phase: 'Fabricate', title: 'Mast and hub', hours: 1, tasks: [
        `Cut the mast ({mark:mast}) from ${u.len(OD, { u: true })} PVC pipe, square. Deburr.`,
        `Drill ${fine(4.3)} straight through, ${u.len(sd / 2, { u: true })} below the top.`,
        'Hub onto the mast until it bottoms. Holes in line. M4 bolt, washers, nyloc nut.',
        `Mark the clamps ${u.len(CLAMP_LOW)} and ${u.len(CLAMP_HIGH, { u: true })} up from the bottom.`,
      ], check: `Mast ${tol} of its length. Hub does not turn or lift. Arms level with the mast plumb.` },
      { n: 7, phase: 'Assemble', title: coil ? 'Coax and coil choke' : 'Coax and ferrite choke', hours: 0.5, tasks: [
        'Coax SMA plug onto the jack: finger tight, then an eighth of a turn.',
        'Self-amalgamating tape over the joint, half lapped. PVC tape over it.',
        coil
          ? `${turns} tight turns of coax round the mast right under the hub (about ${u.len(turns * COAX_D, { u: true })}). Tape each end.`
          : 'Three ferrite cores on the coax right under the hub, touching. A cable tie each side.',
        `Coax down the mast, a cable tie every ${u.len(200, { u: true })}. A drip loop where it leaves.`,
      ], check: coil
        ? `${turns} turns, tight, starting ${u.len(50, { u: true })} or less under the hub. Nothing slides.`
        : `Three cores latched, ${u.len(50, { u: true })} or less under the hub. Nothing slides.` },
      { n: 8, phase: 'Tune and install', title: 'Tune with a NanoVNA', hours: 1, tasks: [
        'Mast upright in the open, clear of walls, metal and people.',
        'Calibrate the NanoVNA (open, short, load). Connect the antenna coax.',
        `Sweep 120 to 160 MHz. Aim: lowest SWR at ${g.f.toFixed(1)} MHz ±1 MHz. As cut, expect it low${ins ? ' (insulated: it can land a few MHz off)' : ''}.`,
        `Low: snip both tips equally, about ${fine(mmPerMHz)} per MHz. Sweep again.`,
        `High: fine if SWR at ${fEdge[0]} and ${fEdge[1]} MHz is under 2; else cut a new pair ${fine(mmPerMHz)} longer per MHz.`,
        g.f < 143
          ? 'No NanoVNA: a licensed operator can read SWR at 144 and 146 MHz. Low at 144, rising to 146.'
          : 'No NanoVNA: only a licensed operator may use an SWR meter, inside an amateur band.',
      ], check: `SWR minimum ±1 MHz of ${g.f.toFixed(1)} MHz. Under 2 from ${fEdge[0]} to ${fEdge[1]} MHz. Both tips equal ${tol}.`,
        tip: 'Trim a little at a time: a millimetre cannot be put back. Bend nothing at the tips.' },
      { n: 9, phase: 'Tune and install', title: 'Seal, mount and point it', hours: 1.5, tasks: [
        'Fill the pocket with neutral-cure silicone (not acetic). A bead at each channel. Lid on, two M3 × 8 screws.',
        `Two U-bolt clamps on the marks, ${u.len(CLAMP_LOW)} and ${u.len(CLAMP_HIGH, { u: true })} up. Both tight.`,
        'V open to true north or south.',
        'Mast plumb, arms level, as much sky as possible, away from other antennas.',
        'Coax to the receiver, drip loop below the entry.',
      ], check: 'Open within 10° of north or south. Arms level within 3°. No movement when shaken at the hub.',
        tip: 'Both clamps tight on a post that does not move: the wind check counts on them.' },
    ];

    const cutWhy = ins
      ? `PVC insulation slows the wave: effective permittivity about ${g.epsEff.toFixed(3)}, so × ${g.kIns.toFixed(3)} (approximate: the NanoVNA has the real answer)`
      : 'bare copper';
    return {
      sections: { ARM, WIRE, MAST },
      axes: { x: ['east', 'west'], y: ['north', 'south'], z: ['top', 'bottom'] },
      datum: 'x east from the apex of the V (the feed point), y north (the V opens toward north), z up from the bottom end of the mast',
      nodes, members, plates: [], hardware, prints: [hub, lid, clip, cap],
      consumables: [
        { name: 'Solder, rosin core', qty: 'a little', price: 0.5 },
        { name: 'Self-amalgamating tape', qty: '1 roll', price: 4 },
        { name: 'PVC electrical tape, black', qty: '1 roll', price: 1 },
        { name: 'Neutral-cure silicone sealant', qty: '1 small tube', price: 4 },
      ],
      tools: ['3D printer and the filament named with each print', 'Soldering iron (with a heat-set insert tip if you have one)', 'Fine-tooth saw, file and deburring tool', `Drill and a ${fine(4.3)} bit`, 'Vise, pliers, side cutters, wire strippers and a sharp knife', 'Calipers and tape measure', 'Multimeter', 'NanoVNA or antenna analyser', 'Spanner for the SMA nut, screwdrivers, hex key for the grub screws', 'Spirit level and compass'],
      supports: [{ at: nodes.M1, fix: 'pin' }, { at: nodes.M2, fix: 'fixed' }],
      loads: [
        { id: 'wind', name: 'Wind on mast and antenna head', what: `of drag in ${windText(u, g.V)} gusts (${u.force(g.w * Lf)} on the mast, ${u.force(g.Fh)} on the hub, arms, wires, clips and caps, at the top)`, sf: 2,
          parts: [{ N: g.w * Lf, dir: [1, 0, 0], at: mastPts }, { N: g.Fh, dir: [1, 0, 0], at: [[0, yM, zb]] }] },
        { id: 'snag', name: 'Coax snagged at the hub', N: SNAG_N, what: 'pulled sideways at the hub', dir: [0, 1, 0], at: [[0, yM, zb]], sf: 2 },
      ],
      checks: [
        { name: 'Element length from frequency', pass: Le / g.q4 >= 0.9 && Le / g.q4 <= 0.99 && Math.abs(Le - g.q4 * g.K * K_SUP * g.kIns) < 0.01,
          value: `λ/4 at ${g.f.toFixed(1)} MHz = ${u.len(g.q4, { u: true })}; × ${g.K.toFixed(3)} × ${K_SUP}${ins ? ` × ${g.kIns.toFixed(3)}` : ''} = ${u.len(Le, { u: true })} per wire; cut ${u.len(Lcut, { u: true })}`,
          why: `Measured from the wire's inner end in the hub. End effect for a ⌀${u.fine(dc, { u: true })} conductor ${((1 - g.K) * 100).toFixed(1)} %; the PVC arm and clips touching it about 1 %; ${cutWhy}. Cut ${ins ? 3 : 1} % long and trimmed at the tip in step 8.` },
        { name: 'V angle', pass: p.angle >= 90 && p.angle <= 180, value: `${p.angle}° between the elements`,
          why: 'At 120° the horizontal V has its most gain overhead and a usable lobe down to low passes, and its impedance comes close to 50 Ω. Narrower drops the impedance; 180° is a plain dipole with nulls off its ends.' },
        { name: 'Feed gap', pass: GAP / g.lam < 0.01 && washerGap >= 4,
          value: `${u.len(GAP, { u: true })} between the wire ends (${((GAP / g.lam) * 100).toFixed(2)} % of a wavelength); ${u.len(washerGap, { u: true })} between the two sides' washers and wires`,
          why: `Small against the wavelength so it does not detune the feed, and wide enough that the two clamps cannot touch (at least ${u.len(4, { u: true })}).` },
        { name: 'Feed match (rough estimate)', pass: swr <= 1.6, value: `about ${Math.round(Rfeed)} Ω, SWR ${swr.toFixed(2)} on 50 Ω coax`,
          why: 'Estimate R ≈ 73 Ω × sin²(angle ÷ 2) at resonance; the NanoVNA in step 8 gives the real number. Under 2 is plenty for receiving.' },
        { name: 'Choke on the coax', pass: Xchoke >= 500, value: coil ? `${turns} turns, about ${Luh.toFixed(2)} µH, ${Math.round(Xchoke)} Ω at ${g.f.toFixed(1)} MHz` : `3 ferrites, about ${Xchoke} Ω at ${g.f.toFixed(1)} MHz`,
          why: 'At least 500 Ω of common-mode impedance keeps current off the outside of the shield, so the coax does not become part of the antenna and pick up house noise. Coil from Wheeler\'s formula; ferrites from the datasheet curve.' },
        { name: 'Coax loss', pass: loss <= 3, value: `${loss.toFixed(1)} dB over ${u.size(p.coaxLen)} of RG58 with its plugs`,
          why: 'Under 3 dB keeps the weak satellite signal above the receiver noise; use a better cable (or a preamp at the hub) for a longer run.' },
        { name: 'Wire held along the arm', pass: longest <= SPACE && sfTip >= 2,
          value: `${a.nC} clips per arm every ${u.len(a.gap, { u: true })}, longest run between holds ${u.len(longest, { u: true })}; tip ${u.len(a.ls, { u: true })} past the cap, safety factor ${sfTip.toFixed(2)}, sags ${u.deflection(sagTip)}`,
          why: `Held at the screw, through the hub channel, by a clip at least every ${u.len(SPACE, { u: true })} and by the tip cap, so the soft wire stays straight on the arm; the tip past the cap carries its own wind and weight against annealed copper (${CU_MPA} MPa).` },
        { name: 'Arms in the wind', pass: a.sf >= 2,
          value: `safety factor ${a.sf.toFixed(2)} (need 2); each arm ${u.len(a.L, { u: true })} out of its socket${g.sf16 ? `; ${u.len(16, { u: true })} conduit would reach only ${g.sf16.toFixed(2)} here, so the arms are ${u.len(aOD, { u: true })}` : ''}`,
          why: `Each ${u.len(aOD, { u: true })} conduit arm as a cantilever out of the hub in ${windText(u, g.V)} gusts, with the wire, clips and cap on it and their weight, against PVC's long-term ${PVC_MPA} MPa. The design uses the thinner conduit where it holds and the thicker one where it does not.` },
        { name: 'Printed hub fits', pass: Math.abs(R - (OD / 2 + 4.2)) < 0.01 && hwA - aRi >= 3 && bed <= 200 && g.topOff - (g.wOff + dw / 2 + 0.2) >= 2.5,
          value: `mast socket ⌀${fine(OD + 0.4)} on ⌀${u.len(OD, { u: true })} pipe; arm sockets ⌀${fine(aOD + 0.4)} on ⌀${u.len(aOD, { u: true })} conduit, ${u.len(g.sock, { u: true })} deep, ${fine(hwA - aRi)} wall; wire channel ⌀${fine(dw + 0.4)}, groove ⌀${fine(dc + 0.3)} with the wire ${fine(PROUD)} proud; ${u.len(g.ext.x)} × ${u.len(g.ext.y)} on the bed`,
          why: `Push fits ${fine(0.4)} over the size, at least ${fine(3)} of wall round a socket that is clamped, the wire standing proud by a ring terminal's thickness so the washer clamps both; fits a ${u.len(200, { u: true })} bed.` },
        { name: 'Clips and caps fit', pass: strain <= 0.02 && RING >= 2.5 && rb - (dw / 2 + 0.2) >= 1.2,
          value: `clip bore ⌀${fine(aOD + 0.2)} snug on ⌀${u.len(aOD, { u: true })}, mouth ${fine(mouth)}, springs open ${(strain * 100).toFixed(1)} % to snap on; cap socket ⌀${fine(aOD + 0.3)}; wire hole ⌀${fine(dw + 0.4)} for ⌀${fine(dw)} ${ins ? 'insulated wire' : 'copper'}, ${fine(rb - dw / 2 - 0.2)} wall over it`,
          why: `The mouth is ${Math.round(MOUTH * 100)} % of the tube, so the C ring opens ${fine(aOD - mouth)} to pass it: under 2 % strain in PETG or ASA, which springs back. ${fine(RING)} ring walls; at least ${fine(1.2)} (three perimeters) over the wire hole.` },
      ],
      steps,
      facts: [
        ['Element', u.len(Le, { u: true }), `each, ${wireName(u, p.wire)} copper${ins ? ', insulated' : ''}, from its inner end`],
        ['Tip to tip', u.size(2 * (r0 + Lcut) * s), 'as cut'],
        ['Arms', `${u.len(aOD, { u: true })} PVC conduit`, g.sf16 ? `${u.len(16, { u: true })} is too weak in this wind` : 'rigid electrical conduit'],
        ['Clips', `${nClips}`, `${a.nC} per arm`],
        ['Hub height', u.size(zt), 'above the bottom of the mast'],
      ],
      join: 'clamp',
      minPiece: 32,
      orderNote: 'Start the hub print, then wire the jack and cut the arms while it runs; clamp the wires, clip them to the arms, fit the mast, tune by trimming the tips, then seal and mount.',
    };
  },
};
