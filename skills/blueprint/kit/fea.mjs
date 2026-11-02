// Frame solver: 3D Euler-Bernoulli beam elements, dense LU, checked against
// textbook beams by scripts/test-fea.mjs. A section has two bending stiffnesses (Iuu, Iww), so rectangular tube
// and flat bar are modelled the way they stand.
//
// What it is for: "will this frame hold the load the plan promises, and how far
// will it sag". It models members on their centre lines, welded joints as rigid,
// and ignores plates and sheets (conservative: a deck only adds stiffness).
import { v3, G0 } from './core.mjs';

const { sub, add, mul, dot, cross, len, norm } = v3;

function elementMatrices(el, pts) {
  const a = pts[el.n1], b = pts[el.n2];
  const L = len(sub(b, a));
  const ex = el.ax, ey = el.u, ez = el.w;
  const { A, Iuu, Iww, J, mat } = el.sec;
  const E = mat.E, G = mat.G;
  const k = Array.from({ length: 12 }, () => new Float64Array(12));
  const set = (i, j, v) => { k[i][j] += v; if (i !== j) k[j][i] += v; };
  const EA = (E * A) / L, GJ = (G * J) / L;
  set(0, 0, EA); set(6, 6, EA); set(0, 6, -EA);
  set(3, 3, GJ); set(9, 9, GJ); set(3, 9, -GJ);
  // bending in local xy (deflection along u): dofs 1,5,7,11, stiffness Iuu
  let b1 = (12 * E * Iuu) / L ** 3, b2 = (6 * E * Iuu) / L ** 2, b3 = (4 * E * Iuu) / L, b4 = (2 * E * Iuu) / L;
  set(1, 1, b1); set(7, 7, b1); set(1, 7, -b1);
  set(1, 5, b2); set(1, 11, b2); set(5, 7, -b2); set(7, 11, -b2);
  set(5, 5, b3); set(11, 11, b3); set(5, 11, b4);
  // bending in local xz (deflection along w): dofs 2,4,8,10, stiffness Iww
  b1 = (12 * E * Iww) / L ** 3; b2 = (6 * E * Iww) / L ** 2; b3 = (4 * E * Iww) / L; b4 = (2 * E * Iww) / L;
  set(2, 2, b1); set(8, 8, b1); set(2, 8, -b1);
  set(2, 4, -b2); set(2, 10, -b2); set(4, 8, b2); set(8, 10, b2);
  set(4, 4, b3); set(10, 10, b3); set(4, 10, b4);
  return { k, R: [ex, ey, ez], L };
}

const toLocal = (R, u) => {
  const o = new Float64Array(12);
  for (let blk = 0; blk < 4; blk++) for (let i = 0; i < 3; i++) o[blk * 3 + i] = R[i][0] * u[blk * 3] + R[i][1] * u[blk * 3 + 1] + R[i][2] * u[blk * 3 + 2];
  return o;
};

function luSolve(n, K, rhsList) {
  const piv = new Int32Array(n);
  for (let c = 0; c < n; c++) {
    let p = c, mx = Math.abs(K[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(K[r * n + c]); if (v > mx) { mx = v; p = r; } }
    if (mx < 1e-9) throw new Error('the frame is a mechanism (singular stiffness): a member is not connected, or the supports do not hold it');
    piv[c] = p;
    if (p !== c) for (let j = 0; j < n; j++) { const t = K[c * n + j]; K[c * n + j] = K[p * n + j]; K[p * n + j] = t; }
    const d = K[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const f = K[r * n + c] / d;
      if (f === 0) continue;
      K[r * n + c] = f;
      const ro = r * n, co = c * n;
      for (let j = c + 1; j < n; j++) K[ro + j] -= f * K[co + j];
    }
  }
  return rhsList.map(b0 => {
    const b = Float64Array.from(b0);
    for (let c = 0; c < n; c++) { const p = piv[c]; if (p !== c) { const t = b[c]; b[c] = b[p]; b[p] = t; } }
    for (let c = 0; c < n; c++) for (let r = c + 1; r < n; r++) b[r] -= K[r * n + c] * b[c];
    for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let j = r + 1; j < n; j++) s -= K[r * n + j] * b[j]; b[r] = s / K[r * n + r]; }
    return b;
  });
}

// model: { pts: [[x,y,z]], els: [{ n1, n2, sec, id, ax, u, w }] }
// fixed: [[node, [dofs]]], loads: [Float64Array(N*6)]
export function solveFrame(model, fixed, loads) {
  const N = model.pts.length, nd = N * 6;
  const mats = model.els.map(el => elementMatrices(el, model.pts));
  const isFixed = new Uint8Array(nd);
  for (const [node, dofs] of fixed) for (const d of dofs) isFixed[node * 6 + d] = 1;
  const used = new Uint8Array(N);
  model.els.forEach(e => { used[e.n1] = 1; used[e.n2] = 1; });
  for (let i = 0; i < N; i++) if (!used[i]) for (let d = 0; d < 6; d++) isFixed[i * 6 + d] = 1;
  const map = new Int32Array(nd).fill(-1), free = [];
  for (let i = 0; i < nd; i++) if (!isFixed[i]) { map[i] = free.length; free.push(i); }
  const n = free.length;
  const K = new Float64Array(n * n);
  model.els.forEach((el, ei) => {
    const { k, R } = mats[ei];
    const dofs = [];
    for (const q of [el.n1, el.n2]) for (let d = 0; d < 6; d++) dofs.push(q * 6 + d);
    const T = (i, j) => (Math.floor(i / 3) === Math.floor(j / 3) ? R[i % 3][j % 3] : 0);
    const kT = Array.from({ length: 12 }, () => new Float64Array(12));
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { let s = 0; const bj = Math.floor(j / 3) * 3; for (let m = bj; m < bj + 3; m++) s += k[i][m] * T(m, j); kT[i][j] = s; }
    for (let i = 0; i < 12; i++) {
      const gi = map[dofs[i]]; if (gi < 0) continue;
      const bi = Math.floor(i / 3) * 3;
      for (let j = 0; j < 12; j++) {
        const gj = map[dofs[j]]; if (gj < 0) continue;
        let s = 0; for (let m = bi; m < bi + 3; m++) s += T(m, i) * kT[m][j];
        K[gi * n + gj] += s;
      }
    }
  });
  const rhs = loads.map(F => { const b = new Float64Array(n); free.forEach((d, i) => (b[i] = F[d])); return b; });
  const K0 = Float64Array.from(K);
  const sols = luSolve(n, K, rhs);
  sols.forEach((x, si) => {
    let res = 0, fmax = 1;
    for (let i = 0; i < n; i++) {
      let acc = 0; const row = i * n;
      for (let j = 0; j < n; j++) acc += K0[row + j] * x[j];
      res = Math.max(res, Math.abs(acc - rhs[si][i])); fmax = Math.max(fmax, Math.abs(rhs[si][i]));
    }
    if (res > 1e-6 * fmax) throw new Error(`frame solver residual ${res.toExponential(1)} N: the answer is not trustworthy`);
  });
  return sols.map(x => {
    const u = new Float64Array(nd);
    free.forEach((d, i) => (u[d] = x[i]));
    let worst = { sf: Infinity, id: null };
    const elStress = model.els.map((el, ei) => {
      const { k, R } = mats[ei];
      const ue = new Float64Array(12);
      for (let d = 0; d < 6; d++) { ue[d] = u[el.n1 * 6 + d]; ue[6 + d] = u[el.n2 * 6 + d]; }
      const ul = toLocal(R, ue);
      const f = new Float64Array(12);
      for (let i = 0; i < 12; i++) { let s = 0; for (let j = 0; j < 12; j++) s += k[i][j] * ul[j]; f[i] = s; }
      const s = el.sec;
      // f[4], f[10]: moment about u (bends along w); f[5], f[11]: about w (bends along u)
      const sig = Math.abs(f[0]) / s.A + Math.max(Math.abs(f[4]) / s.Sw + Math.abs(f[5]) / s.Su, Math.abs(f[10]) / s.Sw + Math.abs(f[11]) / s.Su);
      const tau = s.tau(f[3]);
      const vm = Math.sqrt(sig * sig + 3 * tau * tau);
      const sf = vm > 1e-9 ? s.mat.yield / vm : Infinity;
      if (sf < worst.sf) worst = { sf, vm, id: el.id };
      return vm;
    });
    return { u, worst, elStress };
  });
}

// Build the solver model from solved joints: centre lines, split wherever another
// member's end or a load point lands, then subdivided so a spread load acts along
// the span and not only at its ends. Free member ends within one section size of
// another member are snapped onto it (a post that starts on top of a rail).
// fits: boxes of bought fittings (a PVC tee or elbow). An end inside one is carried on
// along its own axis to the point nearest the fitting's centre, so every pipe in that
// fitting meets at one node: the fitting is taken as a rigid joint. Only a box the size
// of a fitting for that member counts (isFitting): a long part whose box happens to hold
// two ends (a cable down a mast) must not weld them into one node.
export const isFitting = (box, j) => Math.max(...[0, 1, 2].map(i => box[1][i] - box[0][i])) <= 6 * 2 * Math.max(j.hu, j.hw);
export function frameModel(jm, extraPts = [], { maxDof = 1100, fits = [] } = {}) {
  const segs = Object.values(jm).filter(j => !j.m.loose).map(j => ({ a: j.A.slice(), b: j.B.slice(), j }));
  const proj = (p, s) => {
    const d = sub(s.b, s.a), L2 = dot(d, d);
    const t = Math.max(0, Math.min(1, dot(sub(p, s.a), d) / L2));
    const q = add(s.a, mul(d, t));
    return { t, q, dist: len(sub(p, q)) };
  };
  const ends = [];
  segs.forEach(s => { ends.push([s, 'a']); ends.push([s, 'b']); });
  // ends in each fitting meet where their axes cross (least squares), or at the box centre
  const fitted = new Set();
  for (const f of fits) {
    const inF = ends.filter(([s, k]) => isFitting(f, s.j) && [0, 1, 2].every(i => s[k][i] >= f[0][i] && s[k][i] <= f[1][i]));
    if (inF.length < 2) continue;
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r = [0, 0, 0];
    for (const [s] of inF) {
      const dd = norm(sub(s.b, s.a));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const P = (i === j ? 1 : 0) - dd[i] * dd[j]; M[i][j] += P; r[i] += P * s.a[j]; }
    }
    const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(M);
    const c = Math.abs(D) > 1e-6 * inF.length ** 3
      ? [0, 1, 2].map(col => det(M.map((row, i) => row.map((v, j) => (j === col ? r[i] : v)))) / D)
      : [0, 1, 2].map(i => (f[0][i] + f[1][i]) / 2);
    for (const [s, k] of inF) {
      const dd = sub(s.b, s.a);
      s[k] = add(s.a, mul(dd, dot(sub(c, s.a), dd) / dot(dd, dd)));
      fitted.add(s[k]);
    }
  }
  for (const [s, k] of ends) {
    const p = s[k];
    if (fitted.has(p)) continue;
    if (ends.some(([o, ok]) => o !== s && len(sub(o[ok], p)) < 1)) continue;
    let best = null;
    for (const o of segs) {
      if (o === s) continue;
      const r = proj(p, o);
      const tol = Math.max(o.j.hu, o.j.hw) + Math.max(s.j.hu, s.j.hw) + 1;
      if (r.dist < tol && (!best || r.dist < best.dist)) best = r;
    }
    if (best) s[k] = best.q;
  }
  const pts = [];
  const addPt = p => { for (let i = 0; i < pts.length; i++) if (len(sub(pts[i], p)) < 1.5) return i; pts.push(p); return pts.length - 1; };
  segs.forEach(s => { addPt(s.a); addPt(s.b); });
  const snapped = extraPts.map(p => {
    let best = null;
    for (const s of segs) { const r = proj(p, s); if (!best || r.dist < best.dist) best = r; }
    return best ? { idx: addPt(best.q), dist: best.dist } : { idx: -1, dist: Infinity };
  });
  // subdivide: as fine as the dof budget allows (2-4 pieces per span)
  const spans = [];
  for (const s of segs) {
    const on = [];
    pts.forEach((p, i) => { const r = proj(p, s); if (r.dist < 1.5) on.push([r.t, i]); });
    on.sort((x, y) => x[0] - y[0]);
    for (let k = 1; k < on.length; k++) if (on[k][1] !== on[k - 1][1]) spans.push({ s, i1: on[k - 1][1], i2: on[k][1] });
  }
  const nodesNow = pts.length;
  let div = 4;
  while (div > 1 && (nodesNow + spans.length * (div - 1)) * 6 > maxDof) div--;
  const els = [];
  const byMember = {};
  for (const sp of spans) {
    let prev = sp.i1;
    for (let k = 1; k <= div; k++) {
      const next = k === div ? sp.i2 : (pts.push(v3.lerp(pts[sp.i1], pts[sp.i2], k / div)), pts.length - 1);
      const j = sp.s.j;
      // the element frame must be right-handed (ax × u = w) for rotations to read the right way round;
      // a member's w may point the other way along the same line (a vertical post), so turn it
      const ax = norm(sub(pts[next], pts[prev])), w = dot(cross(ax, j.u), j.w) < 0 ? mul(j.w, -1) : j.w;
      els.push({ n1: prev, n2: next, sec: j.sec, id: j.id, ax, u: j.u, w });
      (byMember[j.id] ||= new Set()).add(prev).add(next);
      prev = next;
    }
  }
  return { pts, els, snapped, byMember };
}

// Run every load case of a plan. Self weight of the frame is in every case, plus
// the mass of plates and hardware spread over the nearest frame nodes.
export function runLoads(d) {
  const { model, joints } = d;
  const loads = model.loads || [];
  if (!loads.length || !model.supports?.length) return [];
  // a load case may be several parts, each with its own members or points, size and
  // direction (drag spread up a mast plus a load at its head): parts: [{ on, at, kg | N, dir }]
  const partsOf = l => l.parts || [l];
  const extra = [...model.supports.map(s => s.at), ...loads.flatMap(l => partsOf(l).flatMap(q => q.at || []))];
  const fm = frameModel(joints, extra, { fits: d.fitBoxes || [] });
  const N = fm.pts.length;
  let k = 0;
  const supIdx = model.supports.map(s => ({ idx: fm.snapped[k++].idx, fix: s.fix || 'pin' }));
  const fixed = supIdx.map(s => [s.idx, s.fix === 'fixed' ? [0, 1, 2, 3, 4, 5] : s.fix === 'roller' ? [2] : [0, 1, 2]]);
  const used = [...new Set(fm.els.flatMap(e => [e.n1, e.n2]))];
  // dead load: members on their own nodes, everything else spread to the 4 nearest
  const lumps = new Float64Array(N);
  for (const el of fm.els) {
    const m = el.sec.A * el.sec.mat.rho * len(sub(fm.pts[el.n2], fm.pts[el.n1]));
    lumps[el.n1] += m / 2; lumps[el.n2] += m / 2;
  }
  // a mass off the frame (an antenna above a mast, a box on a bracket) keeps its lever arm:
  // the weight goes to the nearest nodes and the moment it makes about them goes in as a couple
  const deadM = new Float64Array(N * 3);
  const spread = (p, m) => {
    const near = used.map(i => [i, len(sub(fm.pts[i], p))]).sort((x, y) => x[1] - y[1]).slice(0, 4);
    const w = near.map(([, dd]) => 1 / (dd + 50)), ws = w.reduce((x, y) => x + y, 0);
    near.forEach(([i], j) => (lumps[i] += (m * w[j]) / ws));
    const c = near.reduce((acc, [i], j) => add(acc, mul(fm.pts[i], w[j] / ws)), [0, 0, 0]);
    const M = cross(sub(p, c), [0, 0, -m * G0]), i0 = near[0][0];
    for (let k = 0; k < 3; k++) deadM[i0 * 3 + k] += M[k];
  };
  for (const it of d.massItems) if (it.kind !== 'member' && it.m > 0) spread(it.c, it.m);
  const cases = loads.map(l => {
    const F = new Float64Array(N * 6);
    for (let i = 0; i < N; i++) { F[i * 6 + 2] -= lumps[i] * G0; for (let k = 0; k < 3; k++) F[i * 6 + 3 + k] += deadM[i * 3 + k]; }
    const all = [];
    for (const q of partsOf(l)) {
      const dir = norm(q.dir || l.dir || [0, 0, -1]);
      const total = (q.kg != null ? q.kg * G0 : q.N) || 0;
      // a load on members is spread by length: each node takes half of every loaded element
      // touching it, so a long bay carries more than a short one; a load at points is shared equally
      const w = new Map();
      if (q.on) {
        const on = new Set(q.on);
        for (const el of fm.els) if (on.has(el.id)) {
          const L = len(sub(fm.pts[el.n2], fm.pts[el.n1])) / 2;
          w.set(el.n1, (w.get(el.n1) || 0) + L); w.set(el.n2, (w.get(el.n2) || 0) + L);
        }
      }
      const atPts = q.at || [], atIdx = atPts.map(() => fm.snapped[k++].idx);
      if (!w.size && !atIdx.length) throw new Error(`load "${l.name}" lands on no member`);
      const shares = [];
      if (w.size) { const sum = [...w.values()].reduce((a, b) => a + b, 0); for (const [i, L] of w) shares.push([i, (L / sum) * (atIdx.length ? w.size / (w.size + atIdx.length) : 1)]); }
      for (const i of atIdx) shares.push([i, 1 / (w.size + atIdx.length)]);
      for (const [i, s] of shares) for (let c = 0; c < 3; c++) F[i * 6 + c] += total * dir[c] * s;
      // a point off the frame snaps to the nearest member point: the force moves, so add the moment
      // it makes about that point (a wind load on an antenna above the mast top keeps its lever arm)
      atIdx.forEach((i, a) => {
        const M = cross(sub(atPts[a], fm.pts[i]), mul(dir, total / (w.size + atIdx.length)));
        for (let c = 0; c < 3; c++) F[i * 6 + 3 + c] += M[c];
      });
      all.push(...shares.map(x => x[0]));
    }
    return { l, F, idx: all };
  });
  const sols = solveFrame(fm, fixed, cases.map(c => c.F));
  return cases.map((c, i) => {
    const r = sols[i];
    const disp = q => Math.hypot(r.u[q * 6], r.u[q * 6 + 1], r.u[q * 6 + 2]);
    const maxDefl = Math.max(...used.map(disp));
    const loadDefl = Math.max(...c.idx.map(disp));
    // sag of the loaded members relative to the chord of their supports is what you feel;
    // report the larger of the two so a racking sway is not hidden
    return {
      id: c.l.id, name: c.l.name, load: c.l, sf: r.worst.sf, worstMember: r.worst.id, vm: r.worst.vm,
      maxDefl, loadDefl, stress: r.elStress, fm,
    };
  });
}
