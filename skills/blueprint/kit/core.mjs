// Blueprint kit, core: vectors, materials, stock sections and units.
// Every other kit module and every plan's design.mjs builds on these.
//
// Internal units are always millimetres, kilograms, newtons and MPa. Units only
// change at the edge: what the page prints and what the input fields accept.
// Axes: x and y on the floor, z up. The plan names what +x and +y mean.

export const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
export const DEG = 180 / Math.PI;
export const G0 = 9.81;
export const INCH = 25.4;
export const inch = v => v * INCH;           // for imperial stock: inch(1.5) = 38.1 mm
export const feet = v => v * 12 * INCH;

// ---------------------------------------------------------------- materials
// yield: the stress the checks divide by (MPa). For aluminium it is the welded
// (heat-affected) value, because a welded joint is where it fails. Timber uses a
// design bending strength, not a yield.
export const MATERIALS = {
  steel: { name: 'Mild steel (S235 / A36 / SS400)', E: 200000, G: 79300, yield: 235, rho: 7.85e-6, join: 'weld' },
  stainless: { name: 'Stainless 304', E: 193000, G: 77000, yield: 205, rho: 8.0e-6, join: 'weld' },
  aluminium: { name: 'Aluminium 6061-T6 (welded)', E: 68900, G: 26000, yield: 110, rho: 2.7e-6, join: 'weld' },
  timber: { name: 'Softwood C24', E: 11000, G: 690, yield: 14, rho: 4.2e-7, join: 'screw' },
  // bolted, clamped or riveted aluminium keeps its full strength
  'aluminium-bare': { name: 'Aluminium 6063-T6 (not welded)', E: 68900, G: 26000, yield: 170, rho: 2.7e-6, join: 'bolt' },
  // PVC-U pipe: a long-term design stress, since PVC creeps under a steady load
  pvc: { name: 'PVC-U pipe', E: 3000, G: 1100, yield: 25, rho: 1.4e-6, join: 'glue' },
  copper: { name: 'Copper (half hard)', E: 117000, G: 44000, yield: 200, rho: 8.96e-6, join: 'solder' },
  // house wire and other soft-drawn copper
  'copper-annealed': { name: 'Copper (annealed, house wire)', E: 117000, G: 44000, yield: 70, rho: 8.96e-6, join: 'solder' },
  brass: { name: 'Brass CZ121', E: 100000, G: 37000, yield: 250, rho: 8.5e-6, join: 'solder' },
};

// ---------------------------------------------------------------- stock sections
// bu: width along the member's u axis (horizontal, across the member)
// bw: width along w (the other face normal, up for a level member)
// Every section is drawn and cut as its rectangular envelope; round tube is
// allowed for parts with free ends or ends cut square onto a flat face.
function makeSection(kind, bu, bw, t, o = {}) {
  const mat = MATERIALS[o.material || 'steel'];
  let A, Iuu, Iww, J, tau;
  if (kind === 'rect-tube') {
    const iu = bu - 2 * t, iw = bw - 2 * t;
    A = bu * bw - iu * iw;
    Iuu = (bw * bu ** 3 - iw * iu ** 3) / 12;     // resists deflection along u
    Iww = (bu * bw ** 3 - iu * iw ** 3) / 12;     // resists deflection along w
    const Am = (bu - t) * (bw - t), pm = 2 * (bu - t) + 2 * (bw - t);
    J = (4 * Am * Am * t) / pm;
    tau = T => Math.abs(T) / (2 * Am * t);
  } else if (kind === 'round-tube') {
    const d = bu - 2 * t;
    A = (Math.PI / 4) * (bu * bu - d * d);
    Iuu = Iww = (Math.PI / 64) * (bu ** 4 - d ** 4);
    J = 2 * Iuu;
    tau = T => (Math.abs(T) * bu / 2) / J;
  } else {
    // solid rectangle: flat bar, square bar, timber
    A = bu * bw;
    Iuu = (bw * bu ** 3) / 12;
    Iww = (bu * bw ** 3) / 12;
    const a = Math.max(bu, bw), b = Math.min(bu, bw);
    const beta = 1 / 3 - 0.21 * (b / a) * (1 - b ** 4 / (12 * a ** 4));
    J = beta * a * b ** 3;
    tau = T => Math.abs(T) / (0.208 * a * b * b);
  }
  const id = o.id || `${kind}-${bu}x${bw}${t ? 'x' + t : ''}`;
  return {
    id, kind, bu, bw, t: t || 0, material: o.material || 'steel', mat,
    label: o.label || id, short: o.short || o.label || id,
    // price per metre in the plan's currency; US stock is priced per foot, so pricePerFt converts
    stockLen: o.stockLen || 6000, price: o.pricePerFt != null ? o.pricePerFt / 0.3048 : o.price ?? null,
    A, Iuu, Iww, J, tau, Su: Iuu / (bu / 2), Sw: Iww / (bw / 2),
    kgPerM: A * mat.rho * 1000, round: kind === 'round-tube',
  };
}
export const rectTube = (bu, bw, t, o) => makeSection('rect-tube', bu, bw, t, o);
export const squareTube = (b, t, o) => makeSection('rect-tube', b, b, t, o);
export const roundTube = (d, t, o) => makeSection('round-tube', d, d, t, o);
export const flatBar = (b, t, o) => makeSection('flat', b, t, 0, o);      // lies flat: b across, t up
export const bar = (bu, bw, o) => makeSection('bar', bu, bw, 0, o);
export const timber = (bu, bw, o) => makeSection('timber', bu, bw, 0, { material: 'timber', ...o });
export const rod = (d, o) => makeSection('round-tube', d, d, d / 2, o);      // solid round bar or wire
export const pvcPipe = (d, t, o) => makeSection('round-tube', d, d, t, { material: 'pvc', ...o });

// ---------------------------------------------------------------- units
// Metric is the default. Imperial prints inches to the nearest 1/16 (what a tape
// reads), pounds and feet; the inputs take decimal inches.
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function fracIn(mm, den = 16) {
  const neg = mm < 0, v = Math.abs(mm) / INCH;
  let whole = Math.floor(v), n = Math.round((v - whole) * den);
  if (n === den) { whole++; n = 0; }
  const g = n ? gcd(n, den) : 1;
  const f = n ? `${n / g}/${den / g}` : '';
  return (neg ? '-' : '') + (whole && f ? `${whole} ${f}` : whole ? `${whole}` : f || '0') + '"';
}
const group3 = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function makeUnits(system = 'metric') {
  const imp = system === 'imperial';
  return {
    system, imperial: imp,
    lenUnit: imp ? 'in' : 'mm',
    // a length on a drawing, cut sheet or task
    len: (mm, { u = false } = {}) => (imp ? fracIn(mm) : `${Math.round(mm)}${u ? ' mm' : ''}`),
    // an overall size for prose: 1.50 m / 4' 11"
    // a small size to a tenth (a drill, a clearance, a wall): 4.3 / 0.169"
    fine: (mm, { u = false } = {}) => (imp ? `${(mm / INCH).toFixed(3)}"` : `${Math.round(mm * 10) / 10}${u ? ' mm' : ''}`),
    size: mm => {
      if (!imp) return mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm)} mm`;
      const inTot = Math.round(mm / INCH);
      return inTot >= 24 ? `${Math.floor(inTot / 12)}' ${inTot % 12}"` : `${inTot}"`;
    },
    // long totals: 14.2 m / 46.6 ft
    run: mm => (imp ? `${(mm / 304.8).toFixed(1)} ft` : `${(mm / 1000).toFixed(1)} m`),
    tol: mm => (imp ? '±' + fracIn(Math.max(mm, 0.8)) : `±${mm} mm`),
    mass: kg => (imp ? `${Math.round(kg * 2.2046)} lb` : `${kg < 10 ? kg.toFixed(1) : Math.round(kg)} kg`),
    force: N => (imp ? `${Math.round(N / 4.448)} lbf` : `${Math.round(N)} N`),
    area: mm2 => (imp ? `${(mm2 / 92903).toFixed(1)} ft²` : `${(mm2 / 1e6).toFixed(2)} m²`),
    stress: mpa => (imp ? `${(mpa * 0.145).toFixed(1)} ksi` : `${Math.round(mpa)} MPa`),
    deflection: mm => (imp ? `${(mm / INCH).toFixed(3)}"` : `${mm.toFixed(1)} mm`),
    num: group3,
    // input fields
    toInput: mm => (imp ? Math.round((mm / INCH) * 16) / 16 : Math.round(mm)),
    fromInput: v => (imp ? v * INCH : v),
    // what an inch field shows and accepts: 59 1/16, 59-1/16, 59.0625
    toText: mm => (imp ? fracIn(mm).replace('"', '') : String(Math.round(mm))),
    parse: t => {
      const s = String(t).trim().replace(/["”]|in$/g, '').trim();
      const m = /^(\d+(?:\.\d+)?)?(?:[\s-]+)?(?:(\d+)\/(\d+))?$/.exec(s);
      if (!m || (!m[1] && !m[2])) return NaN;
      const v = (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? +m[2] / +m[3] : 0);
      return imp ? v * INCH : v;
    },
    inputStep: mm => (imp ? 0.0625 : mm),
    massToInput: kg => (imp ? Math.round(kg * 2.2046) : kg),
    massFromInput: v => (imp ? v / 2.2046 : v),
    massUnit: imp ? 'lb' : 'kg',
  };
}

// ---------------------------------------------------------------- params
// A plan's params are declared in mm / kg. resolveParams fills defaults, clamps to
// [min, max] and snaps integers, so build(p) never sees a value it was not written for.
// min and max may be functions of the params declared before them (a shelf count
// whose max follows the height); limits holds the numbers in force.
export function resolveParams(defs, given = {}) {
  const p = {}, notes = [], limits = {};
  for (const d of defs) {
    let v = given[d.id] ?? d.value;
    if (d.type === 'choice') { if (!d.options.some(o => o.value === v)) v = d.value; }
    else if (d.type === 'bool') v = v === true || v === 'true' || v === 1 || v === '1';
    else {
      const min = typeof d.min === 'function' ? d.min(p) : d.min, max = typeof d.max === 'function' ? d.max(p) : d.max;
      limits[d.id] = { min, max };
      v = Number(v);
      if (!Number.isFinite(v)) v = d.value;
      if (d.type === 'count') v = Math.round(v);
      if (min != null && v < min) { if (given[d.id] != null) notes.push(`${d.label} raised to its minimum`); v = min; }
      if (max != null && v > max) { if (given[d.id] != null) notes.push(`${d.label} lowered to its maximum`); v = max; }
    }
    p[d.id] = v;
  }
  return { p, notes, limits };
}

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const r0 = v => Math.round(v);
export const f1 = v => (Math.round(v * 10) / 10).toString();
