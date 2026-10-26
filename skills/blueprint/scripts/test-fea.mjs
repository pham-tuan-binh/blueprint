#!/usr/bin/env node
// Checks the frame solver against textbook beams. Run: node scripts/test-fea.mjs
// A rectangular tube is used on purpose, so both bending stiffnesses are proved.
import { solveFrame } from '../kit/fea.mjs';
import { rectTube } from '../kit/core.mjs';
import { memberFrame } from '../kit/joints.mjs';

const sec = rectTube(20, 40, 2);           // 20 across (u), 40 tall (w)
const E = sec.mat.E, G = sec.mat.G, L = 1000, P = 500;
let failed = 0;
const check = (name, got, want) => {
  const err = Math.abs(got - want) / Math.abs(want);
  const ok = err < 1e-3;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${got.toFixed(4)} vs ${want.toFixed(4)} (${(err * 100).toFixed(3)}%)`);
};

// cantilever along x in 4 elements, fixed at x = 0
const pts = [0, 250, 500, 750, 1000].map(x => [x, 0, 0]);
const fr = memberFrame([1, 0, 0]);
const els = [0, 1, 2, 3].map(i => ({ n1: i, n2: i + 1, sec, id: 'c' + i, ax: fr.a, u: fr.u, w: fr.w }));
const tip = 4 * 6, F = () => new Float64Array(pts.length * 6);
const Fz = F(); Fz[tip + 2] = -P;        // down: bends about u, stiffness Iww (the tall way)
const Fy = F(); Fy[tip + 1] = P;         // sideways: stiffness Iuu
const Fx = F(); Fx[tip] = P;
const Tx = F(); Tx[tip + 3] = P * 100;
const [rz, ry, rx, rt] = solveFrame({ pts, els }, [[0, [0, 1, 2, 3, 4, 5]]], [Fz, Fy, Fx, Tx]);

check('tip deflection, vertical  PL^3/3EI(ww)', -rz.u[tip + 2], (P * L ** 3) / (3 * E * sec.Iww));
check('tip deflection, sideways  PL^3/3EI(uu)', ry.u[tip + 1], (P * L ** 3) / (3 * E * sec.Iuu));
check('tip slope                 PL^2/2EI(ww)', Math.abs(rz.u[tip + 4]), (P * L ** 2) / (2 * E * sec.Iww));
check('axial stretch             PL/EA', rx.u[tip], (P * L) / (E * sec.A));
check('twist                     TL/GJ', rt.u[tip + 3], (P * 100 * L) / (G * sec.J));
check('root stress, vertical     PL/Sw', rz.elStress[0], (P * L) / sec.Sw);
check('root stress, sideways     PL/Su', ry.elStress[0], (P * L) / sec.Su);

// simply supported beam, centre load: deflection PL^3/48EI
const pts2 = [0, 250, 500, 750, 1000].map(x => [x, 0, 0]);
const els2 = [0, 1, 2, 3].map(i => ({ n1: i, n2: i + 1, sec, id: 's' + i, ax: fr.a, u: fr.u, w: fr.w }));
const Fc = new Float64Array(pts2.length * 6); Fc[2 * 6 + 2] = -P;
const [rs] = solveFrame({ pts: pts2, els: els2 }, [[0, [0, 1, 2, 3]], [4, [1, 2]]], [Fc]);
check('simply supported centre  PL^3/48EI', -rs.u[2 * 6 + 2], (P * L ** 3) / (48 * E * sec.Iww));

if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nFrame solver matches the textbook.');
