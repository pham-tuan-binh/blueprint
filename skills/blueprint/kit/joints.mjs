// Joint model: how every member end is cut and joined. One source for the 3D
// model (members drawn trimmed, never overlapping), the cut list (true long-point
// lengths and the angle on each face) and the cut sheets. Works for
// rectangular sections of any size.
//
// At each joint, in order:
//   1. a member that passes straight through the joint is the receiver; every
//      member that ends there is cut to sit on its face (butt)
//   2. otherwise, two ends that carry on in nearly the same line (>= 150 deg) are
//      mitred to each other on the bisector, and the rest butt onto them
//   3. otherwise it is a corner, and nothing runs past it (no ears):
//      - a member with a higher `prio` wins: it is cut flush with the outer face of
//        the biggest other member, and the rest butt onto it (a leg that runs up to
//        the top and the rails welded to its faces)
//      - else, if the two biggest outline members are the same section they are
//        mitred on the bisector (a picture-frame corner)
//      - else the biggest is cut flush with the outer face of the next one and
//        gets an end cap; braces and the rest butt onto them
// A butting member is cut on the plane of the receiver face it lands on, so one
// arriving at an angle gets the matching angled cut.
import { v3, DEG } from './core.mjs';

const { sub, add, mul, dot, cross, len, norm } = v3;

// Orientation: one face pair stays level (u is horizontal). w is the other face
// normal, turned to point up (or toward +x for an upright member). A member may
// pass `roll: 90` to stand a rectangular section on edge (swaps u and w).
export function memberFrame(a, roll = 0) {
  let u = cross([0, 0, 1], a);
  if (len(u) < 1e-6) u = [0, 1, 0];
  u = norm(u);
  let w = norm(cross(u, a));
  if (w[2] < -1e-6 || (Math.abs(w[2]) < 1e-6 && (w[0] < -1e-6 || (Math.abs(w[0]) < 1e-6 && w[1] < 0)))) w = mul(w, -1);
  if (Math.abs(roll) === 90) return { a, u: w, w: mul(u, -1) };
  return { a, u, w };
}

const keyOf = p => p.map(v => Math.round(v * 2) / 2).join(',');

function onSegment(p, a, b) {
  const d = sub(b, a), L = len(d), t = dot(sub(p, a), d) / (L * L);
  if (t <= 1e-3 || t >= 1 - 1e-3) return false;
  return len(sub(add(a, mul(d, t)), p)) < 0.6;
}

const isBrace = m => (m.brace ? 1 : 0);

export function solveJoints(model) {
  const P = n => {
    const p = model.nodes[n];
    if (!p) throw new Error(`member refers to unknown node "${n}"`);
    return p;
  };
  const info = model.members.map(m => {
    const A = P(m.pts[0]), B = P(m.pts[m.pts.length - 1]);
    const L = len(sub(B, A));
    if (L < 1) throw new Error(`member ${m.id} has zero length`);
    const a = norm(sub(B, A));
    const sec = model.sections[m.sec];
    if (!sec) throw new Error(`member ${m.id} uses unknown section "${m.sec}"`);
    const frame = memberFrame(a, m.roll || 0);
    const swap = Math.abs(m.roll || 0) === 90;
    return { m, A, B, a, L, sec, frame, hu: (swap ? sec.bw : sec.bu) / 2, hw: (swap ? sec.bu : sec.bw) / 2, size: Math.max(sec.bu, sec.bw), prio: m.prio || 0 };
  });
  const joints = new Map();
  const at = p => { const k = keyOf(p); if (!joints.has(k)) joints.set(k, { X: p, ends: [], through: [] }); return joints.get(k); };
  for (const t of info) {
    at(t.A).ends.push({ t, end: 'A', d: t.a });
    at(t.B).ends.push({ t, end: 'B', d: mul(t.a, -1) });
  }
  for (const j of joints.values()) for (const t of info) if (onSegment(j.X, t.A, t.B)) j.through.push(t);

  const rank = (p, q) => (q.t.prio - p.t.prio) || (isBrace(p.t.m) - isBrace(q.t.m)) || (q.t.size - p.t.size) ||
    ((p.t.m.step ?? 0) - (q.t.m.step ?? 0)) || (q.t.L - p.t.L) || p.t.m.id.localeCompare(q.t.m.id);
  const cuts = {};
  const set = (e, cut) => { (cuts[e.t.m.id] ||= {})[e.end] = cut; };
  const facesOf = r => [[r.frame.u, r.hu], [mul(r.frame.u, -1), r.hu], [r.frame.w, r.hw], [mul(r.frame.w, -1), r.hw]];
  // the face of receiver r that a member arriving along d lands on
  const face = (r, d, X) => {
    const perp = sub(d, mul(r.a, dot(d, r.a)));
    let best = null;
    for (const [f, h] of facesOf(r)) { const s = dot(f, perp); if (!best || s > best.s) best = { f, h, s }; }
    return { p0: add(X, mul(best.f, best.h)), n: best.f };
  };
  const squareness = (d, r) => len(cross(d, r.a));
  const flushTo = (R, E, X) => {
    let best = null;
    for (const [f, h] of facesOf(E.t)) { const sc = -dot(f, R.d); if (!best || sc > best.sc) best = { f, h, sc }; }
    return { kind: 'flush', to: E.t.m.id, p0: add(X, mul(best.f, best.h)), n: mul(best.f, -1), cap: !!R.t.m.cap };
  };
  const report = [];

  for (const j of joints.values()) {
    const { X } = j;
    let mains = [], rest = [...j.ends];
    if (j.through.length) {
      mains = j.through;
    } else if (rest.length === 1) {
      set(rest[0], { kind: 'free', p0: X, n: rest[0].d, cap: !!rest[0].t.m.cap });
      rest = [];
    } else {
      let pair = null;
      for (let i = 0; i < rest.length; i++) for (let k = i + 1; k < rest.length; k++) {
        const ang = Math.acos(Math.max(-1, Math.min(1, dot(rest[i].d, rest[k].d)))) * DEG;
        if (!pair || ang > pair.ang) pair = { i, k, ang };
      }
      const sorted = [...rest].sort(rank);
      const topPrio = sorted[0].t.prio > (sorted[1]?.t.prio ?? -Infinity);
      if (pair.ang >= 150 && !topPrio) {
        const e1 = rest[pair.i], e2 = rest[pair.k];
        set(e1, { kind: 'miter', with: e2.t.m.id, p0: X, n: norm(sub(e1.d, e2.d)) });
        set(e2, { kind: 'miter', with: e1.t.m.id, p0: X, n: norm(sub(e2.d, e1.d)) });
        if (e1.t.sec.id !== e2.t.sec.id) report.push(`joint at ${X.map(Math.round)}: ${e1.t.m.id} and ${e2.t.m.id} are mitred but are different sections`);
        mains = [e1.t, e2.t];
        rest = rest.filter(e => e !== e1 && e !== e2);
      } else if (topPrio) {
        const R = sorted[0], E = sorted[1];
        set(R, flushTo(R, E, X));
        mains = [R.t];
        rest = sorted.slice(1);
      } else {
        const outline = sorted.filter(e => !isBrace(e.t.m));
        const R = outline[0] || sorted[0];
        let mate = null;
        for (const e of outline.slice(1)) if (e.t.sec.id === R.t.sec.id && !!e.t.m.roll === !!R.t.m.roll) {
          const ang = Math.acos(Math.max(-1, Math.min(1, dot(e.d, R.d))));
          if (!mate || ang > mate.ang) mate = { e, ang };
        }
        if (mate) {
          const e2 = mate.e;
          set(R, { kind: 'miter', with: e2.t.m.id, p0: X, n: norm(sub(R.d, e2.d)) });
          set(e2, { kind: 'miter', with: R.t.m.id, p0: X, n: norm(sub(e2.d, R.d)) });
          mains = [R.t, e2.t];
          rest = sorted.filter(e => e !== R && e !== e2);
        } else {
          const E = sorted.filter(e => e !== R)[0];
          set(R, { ...flushTo(R, E, X), cap: true });
          mains = [R.t];
          rest = sorted.filter(e => e !== R);
        }
      }
    }
    for (const e of rest) {
      const r = [...mains].sort((p, q) => squareness(e.d, q) - squareness(e.d, p))[0];
      if (r.size < e.t.size - 0.5) report.push(`${e.t.m.id} butts onto the smaller ${r.m.id}: it will overhang its face`);
      const f = face(r, e.d, X);
      set(e, { kind: 'butt', onto: r.m.id, p0: f.p0, n: f.n });
    }
  }

  const out = {};
  for (const t of info) {
    const c = cuts[t.m.id];
    const { a, u, w } = t.frame;
    const SIGNS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const corners = SIGNS.map(([su, sw]) => add(mul(u, su * t.hu), mul(w, sw * t.hw)));
    const tAt = (cut, off) => dot(cut.n, sub(cut.p0, add(t.A, off))) / dot(cut.n, a);
    const edges = corners.map(off => ({ off, ta: tAt(c.A, off), tb: tAt(c.B, off) }));
    const lens = edges.map(e => e.tb - e.ta);
    if (Math.min(...lens) <= 0) report.push(`${t.m.id}: the joints eat the whole member (shortest edge ${Math.round(Math.min(...lens))} mm)`);
    const faceAngles = cut => {
      const n = cut.n, na = Math.abs(dot(n, a));
      return { top: Math.atan2(Math.abs(dot(n, u)), na) * DEG, side: Math.atan2(Math.abs(dot(n, w)), na) * DEG };
    };
    out[t.m.id] = {
      id: t.m.id, m: t.m, sec: t.sec, A: t.A, B: t.B, axis: a, u, w, hu: t.hu, hw: t.hw, edges, L: t.L,
      longPoint: Math.max(...lens), shortPoint: Math.min(...lens),
      ends: { A: { ...c.A, ...faceAngles(c.A) }, B: { ...c.B, ...faceAngles(c.B) } },
    };
  }
  return { joints: out, sites: [...joints.values()], report };
}

// The 8 corners of a trimmed member: 4 at end A, then 4 at end B (same edge order).
export function memberCorners(j) {
  const at = (e, t) => add(add(j.A, e.off), mul(j.axis, t));
  return [...j.edges.map(e => at(e, e.ta)), ...j.edges.map(e => at(e, e.tb))];
}

// Plain-language description of one end, for the cut list and cut sheets.
export function describeEnd(end) {
  const r = v => Math.round(v);
  const ang = (end.top > 0.5 || end.side > 0.5)
    ? [end.top > 0.5 ? `${r(end.top)}° top` : null, end.side > 0.5 ? `${r(end.side)}° side` : null].filter(Boolean).join(' ')
    : 'square';
  const how = end.kind === 'miter' ? `mitre to ${end.with}` : end.kind === 'butt' ? `butt onto ${end.onto}`
    : end.kind === 'flush' ? `flush with ${end.to}${end.cap ? ', cap' : ''}` : end.cap ? 'free end, cap' : 'free end';
  return { ang, how };
}
