// AFTERZERO head_b: procedural anatomical signed distance field for a human head.
// Everything here is our own construction: a lofted face mass (spline tables for width, profile,
// jaw line), cranium, brow ridge, zygoma, muzzle, chin, cheek fat pads, neck, eyelids carved
// around the eyeball, nose (dorsum wedge, lobule, alae, columella, nostrils), lips with a real
// mouth slit and cavity, sculpted ears; blended with smooth min / max.
// Units: meters in head-group space (+Y up, face toward +Z, character left = +X). No three.js.

const { sqrt, abs, min, max, exp, sin, cos, atan2, PI, pow } = Math;

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function smoothstep(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function mix(a, b, t) { return a + (b - a) * t; }
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---- primitives -----------------------------------------------------------------------------
function ell(x, y, z, rx, ry, rz) {
  const ax = x / rx, ay = y / ry, az = z / rz;
  const k0 = sqrt(ax * ax + ay * ay + az * az);
  if (k0 < 1e-6) return -min(rx, ry, rz);
  const bx = ax / rx, by = ay / ry, bz = az / rz;
  const k1 = sqrt(bx * bx + by * by + bz * bz);
  return k0 * (k0 - 1) / k1;
}
function smin(a, b, k) { const h = k - abs(a - b); if (h <= 0) return a < b ? a : b; const t = h / k; return (a < b ? a : b) - t * t * k * 0.25; }
function smax(a, b, k) { const h = k - abs(a - b); if (h <= 0) return a > b ? a : b; const t = h / k; return (a > b ? a : b) + t * t * k * 0.25; }
function rcone(px, py, pz, ax, ay, az, ra, bx, by, bz, rb) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const t = clamp((pax * bax + pay * bay + paz * baz) / l2, 0, 1);
  const dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
  return sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
}
function gauss(v, s) { return exp(-(v * v) / (s * s)); }

// monotone cubic table sampled every DY over [TY0, TY0 + (TN-1)*DY]
const TY0 = -0.05, DY = 0.0005, TN = 380;
function table(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const dk = [], mk = new Array(n);
  for (let i = 0; i < n - 1; i++) dk.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  mk[0] = dk[0]; mk[n - 1] = dk[n - 2];
  for (let i = 1; i < n - 1; i++) mk[i] = dk[i - 1] * dk[i] <= 0 ? 0 : (dk[i - 1] + dk[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (dk[i] === 0) { mk[i] = mk[i + 1] = 0; continue; }
    const a = mk[i] / dk[i], b = mk[i + 1] / dk[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / sqrt(h); mk[i] = t * a * dk[i]; mk[i + 1] = t * b * dk[i]; }
  }
  const out = new Float64Array(TN);
  for (let j = 0; j < TN; j++) {
    const y = TY0 + j * DY;
    if (y <= xs[0]) { out[j] = ys[0]; continue; }
    if (y >= xs[n - 1]) { out[j] = ys[n - 1]; continue; }
    let i = 0; while (xs[i + 1] < y) i++;
    const h = xs[i + 1] - xs[i], t = (y - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    out[j] = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * mk[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * mk[i + 1];
  }
  return out;
}

// ---- model ----------------------------------------------------------------------------------
export const EYE_R = 0.0120;

export function makeModel(p) {
  const sex = clamp(p.sex ?? 0, 0, 1);
  const age = clamp(p.age ?? 30, 8, 80);
  const shape = p.shape || {}, marks = p.marks || {};
  const s = k => clamp(+shape[k] || 0, -1, 1);
  const rnd = mulberry32((p.seed | 0) * 7919 + 13);
  const r2 = () => rnd() * 2 - 1;
  const fem = sex, mal = 1 - sex;
  const ageY = clamp((age - 8) / 12, 0, 1);
  const old = clamp((age - 32) / 40, 0, 1);
  const young = clamp((30 - age) / 12, 0, 1);
  const m = {
    sex, age, fem, mal, old, young,
    S: mix(1, 0.94, fem) * mix(0.9, 1, ageY),
    seed: p.seed | 0,
    jaw: s('jaw'), cheek: s('cheek'), nose: s('nose'), noseWv: s('noseWidth'), lips: s('lips'),
    brow: s('brow'), eyeSize: s('eyeSize'), faceLen: s('faceLength'), chin: s('chin'),
    wrinkles: clamp(marks.wrinkles ?? 0, 0, 1),
    asym: [r2(), r2(), r2(), r2(), r2(), r2(), r2(), r2()],
  };
  m.fl = 1 + 0.055 * m.faceLen;
  // ---- face loft tables (adult male reference, then sex/age/shape) ----
  const J = m.jaw, C = m.chin;
  const jawW = (1 + 0.055 * J) * mix(1, 0.93, fem) * (1 + 0.02 * old);
  const chinF = 0.0035 * C + 0.001 * mal;
  m.tW = table([
    [-0.0475, 0.004], [-0.044, 0.015 * mix(1, 0.85, fem)], [-0.038, 0.0255 * mix(1, 0.88, fem) * (1 + 0.05 * C)], [-0.03, 0.0355 * mix(1, 0.92, fem) * (1 + 0.03 * J)],
    [-0.02, 0.0475 * jawW], [-0.01, 0.0565 * jawW], [0.0, 0.0612 * jawW], [0.012, 0.0632 * (1 + 0.02 * J)],
    [0.03, 0.0652], [0.045, 0.0672 + 0.0012 * m.cheek], [0.062, 0.0688 + 0.0018 * m.cheek], [0.076, 0.0698 + 0.0015 * m.cheek],
    [0.09, 0.0678], [0.1, 0.0655], [0.11, 0.0638], [0.12, 0.0622], [0.135, 0.06],
  ]);
  m.tF = table([
    [-0.0475, 0.0745 + chinF], [-0.044, 0.0785 + chinF], [-0.038, 0.0858 + chinF], [-0.03, 0.0905 + chinF], [-0.022, 0.0895 + chinF * 0.8],
    [-0.012, 0.0885], [0.0, 0.0895], [0.012, 0.0905], [0.024, 0.0915], [0.034, 0.092],
    [0.048, 0.0915], [0.062, 0.0878], [0.076, 0.0852], [0.09, 0.0848], [0.1, 0.0878 + 0.002 * mal], [0.11, 0.0912], [0.12, 0.0918], [0.135, 0.0885],
  ]);
  m.tB = table([
    [-0.0475, 0.068], [-0.044, 0.061], [-0.038, 0.05], [-0.03, 0.033], [-0.02, 0.021], [-0.01, 0.01], [0.0, -0.001], [0.01, -0.014], [0.02, -0.022], [0.03, -0.025], [0.135, -0.025],
  ]);
  m.tC = table([[-0.0475, 0.35], [-0.02, 0.22], [0.0, 0.2], [0.02, 0.32], [0.05, 0.45], [0.135, 0.45]]);
  const nJaw = mix(2.25, 1.9, fem) + 0.15 * J;
  m.tN = table([[-0.0475, 2.0], [-0.03, nJaw], [0.0, nJaw + 0.1], [0.03, 2.2], [0.07, 2.35], [0.135, 2.2]]);
  // eyes
  m.eyeX = 0.0320 - 0.0008 * fem; m.eyeY = 0.085; m.eyeZ = 0.0755;
  m.lidT = 0.0021 + 0.0003 * old;
  m.fisU = (0.30 + 0.03 * fem - 0.04 * old + 0.03 * m.eyeSize);
  m.fisL = (0.36 + 0.02 * fem + 0.025 * m.eyeSize);
  m.azM = -1.25 - 0.03 * m.eyeSize; m.azL = 1.18 + 0.03 * m.eyeSize;
  m.tilt = 0.04 + 0.06 * fem - 0.05 * old;
  m.hood = clamp(0.3 + 0.6 * old - 0.15 * fem + 0.1 * m.brow, 0, 1);
  m.bags = clamp(0.15 + 0.85 * old - 0.3 * young, 0, 1);
  m.browP = clamp(0.55 * mal + 0.12 + 0.3 * m.brow, 0, 1.2);
  // nose
  m.noseLen = 1 + 0.07 * m.nose + 0.04 * old - 0.05 * fem;
  m.noseProj = 1 + 0.08 * m.nose - 0.06 * fem;
  m.noseW = 1 + 0.12 * m.noseWv + 0.05 * mal + 0.04 * old;
  m.bridge = 1 + 0.3 * m.nose - 0.2 * fem;
  // mouth
  m.mouthHW = (0.0252 - 0.0008 * fem) * (1 + 0.03 * m.lips);
  m.lipU = (0.0036 + 0.0012 * fem) * (1 + 0.35 * m.lips) * (1 - 0.35 * old);
  m.lipL = (0.0044 + 0.0012 * fem) * (1 + 0.35 * m.lips) * (1 - 0.3 * old);
  m.lipUH = (0.0074 + 0.0008 * fem) * (1 + 0.15 * m.lips) * (1 - 0.25 * old);
  m.lipLH = (0.0094 + 0.0008 * fem) * (1 + 0.15 * m.lips) * (1 - 0.2 * old);
  m.mouthY = 0.0055;
  m.chinZ = 0.069 + 0.004 * C + 0.001 * mal;
  m.chinW = (0.0175 + 0.0015 * J + 0.002 * mal) * (1 + 0.05 * C);
  m.chinY = -0.0265 - 0.0015 * C;
  m.cheekP = 1 + 0.35 * m.cheek;
  m.neckR = mix(0.055, 0.047, fem);
  m.jowl = old;
  // ear
  m.earX = 0.0715; m.earY = 0.0715; m.earZ = -0.0105;
  m.earS = (1.04 + 0.08 * old - 0.03 * fem);
  // asymmetry (tiny, seeded)
  m.eyeDy = 0.0005 * m.asym[0];
  m.noseDev = 0.0006 * m.asym[1];
  m.pU = Math.log(0.5) / Math.log(0.43);
  m.pL = Math.log(0.5) / Math.log(0.56);
  return m;
}

// lid margin curves; t in [0,1] from medial to lateral canthus
export function lidCurves(m, az) {
  const t = (az - m.azM) / (m.azL - m.azM);
  if (t <= 0 || t >= 1) { const c = t <= 0 ? 0 : m.tilt; return { t, up: c, lo: c, c }; }
  const c = m.tilt * t;
  const bu = sin(PI * pow(t, m.pU)); const bl = sin(PI * pow(t, m.pL));
  return { t, up: c + m.fisU * pow(bu, 0.8), lo: c - m.fisL * pow(bl, 0.9), c };
}

export function sdf(m, X, Y, Z) {
  const S = m.S;
  return headField(m, X / S, Y / S, Z / S) * S;
}

// lofted face mass: per-height superellipse section (width W, front zF, back zB, widest at zc)
function loftF(m, ax, y, z) {
  let fi = (y - TY0) / DY;
  if (fi < 0) fi = 0; else if (fi > TN - 1.001) fi = TN - 1.001;
  const i = fi | 0, t = fi - i;
  const W = m.tW[i] + (m.tW[i + 1] - m.tW[i]) * t;
  const zF = m.tF[i] + (m.tF[i + 1] - m.tF[i]) * t;
  const zB = m.tB[i] + (m.tB[i + 1] - m.tB[i]) * t;
  const cf = m.tC[i] + (m.tC[i + 1] - m.tC[i]) * t;
  const zc = zB + cf * (zF - zB);
  let D, n;
  if (z >= zc) { D = zF - zc; n = m.tN[i] + (m.tN[i + 1] - m.tN[i]) * t; } else { D = zc - zB; n = 2.0; }
  const a = ax / W, b = abs(z - zc) / D;
  const g = pow(a, n) + pow(b, n);
  return pow(g, 1 / n) - 1;
}
function loft(m, ax, y, z) {
  const f = loftF(m, ax, y, z);
  if (f > 0.6) return 0.6 * 0.05;
  const e = 0.0006;
  const fx = (loftF(m, ax + e, y, z) - f) / e, fy = (loftF(m, ax, y + e, z) - f) / e, fz = (loftF(m, ax, y, z + e) - f) / e;
  const gl = sqrt(fx * fx + fy * fy + fz * fz) || 1;
  let d = f / gl;
  d = smax(d, -0.0478 - y, 0.005);
  d = smax(d, y - 0.135, 0.01);
  return d;
}

function headField(m, x, y, z) {
  const ax = abs(x);
  const fl = m.fl;
  const yf = y < 0.105 ? 0.105 + (y - 0.105) / fl : y;   // face-length scaling below the brow

  // --- cranium ---
  let d = ell(x, y - 0.112, z + 0.012, 0.0795, 0.083, 0.093);
  d = smin(d, ell(x, y - 0.121, z - 0.026, 0.0645, 0.063, 0.066), 0.02);            // frontal bone
  d = smin(d, ell(x, y - 0.082, z + 0.036, 0.066, 0.07, 0.069), 0.022);              // occiput
  d = smax(d, ax - 0.0805, 0.016);                                                  // flatter parietal sides
  d = smax(d, -ell(ax - 0.0815, y - 0.112, z - 0.05, 0.012, 0.022, 0.018), 0.018);  // temporal fossa (subtle)

  // --- neck ---
  {
    const nr = m.neckR / m.S;
    const dn = rcone(x, y, z, 0, 0.02, -0.016, nr * 0.97, 0, -0.16, -0.008, nr);
    d = smin(d, dn, 0.03);
    // sternocleidomastoid hint and laryngeal prominence (male)
    if (m.mal > 0.3) d = smin(d, ell(x, y + 0.083, z - 0.040, 0.0085, 0.013, 0.0085), 0.012 * m.mal + 0.001);
  }

  // --- face ---
  if (z > -0.035 && y < 0.15) {
    d = smin(d, loft(m, ax, yf, z), 0.014);
    // muzzle: maxilla + mandible alveolar arch carrying the lips
    d = smin(d, ell(x, yf - 0.013, z - 0.058, 0.0335, 0.031, 0.0385), 0.012);
    // chin (mental protuberance)
    d = smin(d, ell(x, yf - m.chinY, z - m.chinZ, m.chinW, 0.0175, 0.0225), 0.01);
    // zygoma / malar eminence
    const cp = m.cheekP;
    d = smin(d, ell(ax - 0.0465, y - 0.0665, z - 0.0575, 0.0185 * cp, 0.0125, 0.019), 0.014);
    // cheek fat pad (fuller in youth, descends with age)
    const cf = 1 + 0.2 * m.young - 0.2 * m.old;
    d = smin(d, ell(ax - 0.036, yf - 0.05 + 0.005 * m.old, z - 0.064, 0.021 * cf, 0.021, 0.0185 * cf), 0.016);
    // jaw angle (gonial) definition for males / strong jaws
    // jowls (age)
    if (m.jowl > 0.05) d = smin(d, ell(ax - 0.037, yf + 0.014, z - 0.062, 0.011, 0.012, 0.012 * m.jowl + 0.001), 0.012);
  }

  // --- brow ridge (rotated so its lateral end recedes) ---
  {
    const bp = m.browP;
    const bx = ax - 0.028, bz = z - (0.0785 + 0.003 * bp);
    const c = cos(0.38), sn = sin(0.38);
    const rx = c * bx + sn * bz, rz = -sn * bx + c * bz;
    const bd = ell(rx, y - (0.1075 + 0.001 * m.fem), rz, 0.024, 0.0095 + 0.0018 * bp, 0.0105 + 0.0015 * bp);
    d = smin(d, bd, 0.014);
    d = smin(d, ell(x, y - 0.1045, z - (0.0785 + 0.003 * bp), 0.0135, 0.0125, 0.011), 0.014); // glabella
  }

  if (z > 0.035 && ax < 0.07 && y > 0.05 && y < 0.125) d = eyes(m, d, x, ax, y, z);
  if (z > 0.06 && ax < 0.04 && y > 0.015 && y < 0.11) d = nose(m, d, x, y, z);
  if (z > 0.035 && ax < 0.05 && yf > -0.03 && yf < 0.04) d = mouth(m, d, x, ax, y, yf, z);
  if (ax > 0.045 && y > 0.015 && y < 0.125 && z < 0.035 && z > -0.065) d = ear(m, d, ax, y, z);

  d = smax(d, -0.095 / m.S - y, 0.004);  // neck cut
  return d;
}

// ---------------------------------------------------------------------------------------------
function eyes(m, d, x, ax, y, z) {
  const ex = m.eyeX, ey = m.eyeY + (x > 0 ? m.eyeDy : -m.eyeDy), ez = m.eyeZ;
  const lx = ax - ex, ly = y - ey, lz = z - ez;
  const R = EYE_R;
  // orbit: carve the socket between brow and cheek
  d = smax(d, -ell(lx + 0.0005, ly + 0.0008, lz - 0.0172, 0.0205, 0.0158, 0.0128), 0.009);
  const r = sqrt(lx * lx + ly * ly + lz * lz);
  if (r > 0.03) return d;
  const az = atan2(lx, lz), el = atan2(ly, sqrt(lx * lx + lz * lz));
  const lc = lidCurves(m, az);
  const T = m.lidT;
  let shell = r - (R + T);
  const crease = lc.up + 0.5 + 0.06 * m.hood;
  const inT = smoothstep(-0.15, 0.3, lc.t) * smoothstep(1.15, 0.78, lc.t);
  const foldB = gauss(el - (crease + 0.06 - 0.08 * m.hood), 0.2) * (0.0010 + 0.0017 * m.hood) * inT;
  const creaseG = gauss(el - crease, 0.065) * 0.0006 * smoothstep(0.0, 0.3, lc.t) * smoothstep(1.0, 0.75, lc.t);
  const roll = gauss(el - (lc.lo - 0.11), 0.085) * 0.0005 * smoothstep(0.05, 0.3, lc.t) * smoothstep(0.98, 0.7, lc.t);
  const bag = gauss(el - (lc.lo - 0.55), 0.22) * 0.0016 * m.bags * smoothstep(0.1, 0.4, lc.t) * smoothstep(1.0, 0.7, lc.t);
  shell -= foldB - creaseG + roll + bag;
  d = smin(d, shell, 0.0035);
  d = smax(d, R + 0.00035 - r, 0.0008);           // eyeball cavity
  const re = max(r, R);
  let w = max((el - lc.up) * re, (lc.lo - el) * re);
  w = max(w, (m.azM - az) * re, (az - m.azL) * re);
  w = max(w, r - (R + T + 0.0035));
  d = smax(d, -w, 0.0008);                          // palpebral fissure
  {
    const caz = m.azM + 0.16, cr = R + 0.0011;      // caruncle
    const cx = cr * sin(caz), cz = cr * cos(caz);
    d = smin(d, ell(lx - cx, ly - 0.0003, lz - cz, 0.0016, 0.002, 0.0018), 0.0012);
  }
  return d;
}

// ---------------------------------------------------------------------------------------------
export function noseFrame(m) {
  const nl = m.noseLen, np = m.noseProj;
  const nasY = 0.0972, nasZ = 0.0902 + 0.0015 * m.mal;
  const tipY = 0.105 - (0.105 - 0.0465) * nl, tipZ = 0.0875 + (0.1175 - 0.0875) * np;
  const baseY = 0.105 - (0.105 - 0.0315) * nl;
  return { nasY, nasZ, tipY, tipZ, baseY };
}
function nose(m, d, x, y, z) {
  const nw = m.noseW, br = m.bridge;
  const xs = x - m.noseDev * smoothstep(0.1, 0.05, y);
  const axs = abs(xs);
  const F = noseFrame(m);
  const { nasY, nasZ, tipY, tipZ, baseY } = F;
  // dorsum wedge: ridge line from nasion to supratip; triangular section blended into the face
  let n;
  {
    const ry0 = nasY + 0.001, rz0 = nasZ - 0.0005, ry1 = tipY + 0.0065, rz1 = tipZ - 0.0045;
    const dy = ry1 - ry0, dz = rz1 - rz0, L = sqrt(dy * dy + dz * dz);
    const uy = dy / L, uz = dz / L;                        // along the ridge (down/forward)
    const vy = uz, vz = -uy;                               // perpendicular, pointing out of the face (up/forward)
    const py = y - ry0, pz = z - rz0;
    const s = (py * uy + pz * uz) / L;                     // 0 at nasion .. 1 at supratip
    const h = py * vy + pz * vz;                           // height relative to ridge line (<=0 below)
    const sc = clamp(s, 0, 1);
    const halfW = mix(0.0085, 0.0105, sc) * mix(1, nw, sc) * (1 + 0.1 * (1 - br) * (1 - sc));  // base half width
    const H = mix(0.0068, 0.0105, sc) * mix(1, br, 0.5);                                         // ridge height above base
    const rr = mix(0.0032, 0.0042, sc);                                                         // ridge rounding
    // rounded wedge: apex circle of radius rr tangent to the side walls
    const sb = halfW / sqrt(halfW * halfW + H * H), cb = H / sqrt(halfW * halfW + H * H); // sin/cos of half angle
    const hd = h + rr / sb;
    const dSide = axs * cb + hd * sb, proj = axs * sb - hd * cb;
    let wdg = (proj < 0 && dSide > 0) ? sqrt(axs * axs + hd * hd) : dSide;
    wdg -= rr;
    wdg = max(wdg, -h - H * 1.8);
    const cap = max(-s * L - 0.002, (s - 1) * L - 0.004);
    n = smax(wdg, cap, 0.008);
    // slight dorsal hump for long/older noses, supratip break
    n -= 0.0006 * (m.nose + 0.5 * m.old) * gauss(s - 0.45, 0.18);
  }
  // lower nose: basal triangle (tip in front, alar bases behind), extruded upward
  {
    const zb = 0.0905, hb = 0.0158 * nw, za = tipZ - 0.004;
    const sl = sqrt(hb * hb + (za - zb) * (za - zb));
    const sideN = (axs * (za - zb) + (z - za) * hb) / sl;            // distance to the side edge
    const back = zb - z;
    const tri = smax(sideN, back, 0.006) + 0.0005;
    const fr = clamp((z - zb) / (za - zb), 0, 1);
    const yb = baseY + 0.0018 + 0.0055 * fr * fr;
    const yt = 0.0525;
    const box = smax(tri, max(yb - y, y - yt), 0.0035);
    n = smin(n, box, 0.004);
  }
  // tip lobule (two soft domes)
  const tipW = 0.0026 * nw;
  n = smin(n, ell(axs - tipW, y - tipY, z - (tipZ - 0.0072), 0.0062 * mix(1, nw, 0.5), 0.0072, 0.0082), 0.0035);
  // alae: wings bulging on the lower sides, separated from the lobule by the alar groove
  {
    const alX = 0.0128 * nw, alY = baseY + 0.0056, alZ = 0.0975;
    const lx = axs - alX, ly = y - alY, lz = z - alZ;
    const c = cos(0.2), sn = sin(0.2);
    const ry = c * ly - sn * lz, rz = sn * ly + c * lz;
    const a = ell(lx, ry, rz, 0.0042 * mix(1, nw, 0.6), 0.0056, 0.0078);
    n = smin(n, a, 0.0016);
  }
  // nostrils (carved from below), long axis pointing toward the tip
  {
    const lx0 = axs - 0.0061 * mix(1, nw, 0.7), lz0 = z - (tipZ - 0.0118);
    const cr = cos(0.38), sr = sin(0.38);
    const lx = cr * lx0 - sr * lz0, lz1 = sr * lx0 + cr * lz0;
    const ly = y - (baseY + 0.0016);
    const c = cos(0.3), sn = sin(0.3);
    const ry = c * ly - sn * lz1, rz = sn * ly + c * lz1;
    const nh = ell(lx, ry, rz, 0.0027 * mix(1, nw, 0.5), 0.0031, 0.0058);
    n = smax(n, -nh, 0.0009);
  }
  d = smin(d, n, 0.005);
  // nostril cavities continue up into the nose
  {
    const lx = axs - 0.0062 * mix(1, nw, 0.7), ly = y - (baseY + 0.0045), lz = z - (tipZ - 0.0135);
    d = smax(d, -ell(lx, ly, lz, 0.0024, 0.0034, 0.0044), 0.001);
  }
  return d;
}

// ---------------------------------------------------------------------------------------------
export function lipOutline(m, ax) {
  const hw = m.mouthHW;
  const t = clamp(ax / hw, 0, 1.2);
  const ys = m.mouthY + 0.0008 * t * t;
  const tt = min(t, 1);
  const bow = 1 - 0.12 * gauss(tt, 0.09) + 0.05 * gauss(tt - 0.23, 0.1);
  const up = ys + m.lipUH * bow * pow(max(0, 1 - pow(tt, 2.4)), 0.72);
  const lo = ys - m.lipLH * pow(max(0, 1 - pow(tt, 2.1)), 0.6);
  return { ys, up, lo, t };
}

function mouth(m, d, x, ax, y, yf, z) {
  const L = lipOutline(m, ax);
  const hw = m.mouthHW;
  const fz = smoothstep(0.062, 0.085, z);
  let disp = 0;
  // philtrum
  if (yf > L.up - 0.002 && yf < 0.034) {
    const v = clamp((yf - L.up) / (0.031 - L.up), 0, 1);
    const colX = mix(0.0054, 0.0036, v);
    const col = gauss(ax - colX, 0.0019) * 0.00055 * (1 - v * 0.5);
    const groove = -gauss(ax, 0.0026) * 0.00035 * (1 - v * 0.3);
    disp += (col + groove) * smoothstep(0.0, 0.18, v);
    disp += 0.0009 * gauss(ax, 0.018) * (1 - v) * (1 - v);
  }
  // lip volumes
  if (L.t < 1.15) {
    const fall = smoothstep(1.1, 0.8, L.t);
    if (yf >= L.ys) {
      const h = (yf - L.ys) / max(L.up - L.ys, 1e-4);   // 0 slit .. 1 border
      let prof;
      if (h <= 1) prof = 0.3 + 0.7 * pow(sin(PI * 0.5 * min(1, (h + 0.05) / 0.72)), 0.7);
      else prof = max(0, 1 - (h - 1) * 2.6);
      const roll = 0.0003 * gauss(h - 1.0, 0.08);
      disp += (m.lipU * prof + roll) * fall * (1 - 0.3 * L.t * L.t);
    } else {
      const h = (L.ys - yf) / max(L.ys - L.lo, 1e-4);
      let prof;
      if (h <= 1) prof = 0.35 + 0.65 * pow(sin(PI * min(1, h * 0.68 + 0.12)), 0.55);
      else prof = max(0, 0.75 - (h - 1) * 2.2);
      disp += m.lipL * prof * fall * (1 - 0.3 * L.t * L.t);
      disp -= 0.0002 * gauss(ax, 0.003) * gauss(h - 0.5, 0.35) * fall;
    }
  }
  // mentolabial sulcus
  {
    const sy = L.lo - 0.0075 - 0.001 * m.chin;
    disp -= 0.0019 * gauss(yf - sy, 0.0048) * gauss(ax / 0.028, 0.8);
  }
  // mouth corners and modiolus
  {
    disp -= 0.0010 * gauss(ax - hw - 0.0004, 0.0024) * gauss(yf - L.ys, 0.0038);
    disp += 0.0007 * gauss(ax - hw - 0.0062, 0.0048) * gauss(yf - L.ys, 0.0075);
  }
  // nasolabial fold
  {
    const t = clamp((0.03 - yf) / 0.04, 0, 1);
    const fx = mix(0.0185 * m.noseW, hw + 0.0068, pow(t, 0.8)) + 0.0018 * t * t;
    const depth = (0.0006 + 0.0018 * m.old + 0.0006 * m.wrinkles) * smoothstep(0, 0.12, t) * smoothstep(1.05, 0.7, t);
    disp -= depth * gauss(ax - fx, 0.0026 + 0.001 * m.old);
    disp += (0.0008 + 0.0016 * m.old) * smoothstep(0, 0.15, t) * smoothstep(1.0, 0.55, t) * gauss(ax - fx - 0.0065, 0.0055);
  }
  d -= disp * fz;
  // mouth slit
  if (L.t < 1.05) {
    const gap = 0.00055 + 0.00028 * (1 - L.t);
    const sheet = abs(yf - L.ys) - gap;
    const endC = (L.t - 1) * hw;
    let w = max(sheet, endC);
    w = max(w, 0.066 - z);
    d = smax(d, -w, 0.0007);
  }
  // mouth cavity
  {
    const cav = ell(x, yf - (m.mouthY - 0.001), z - 0.074, hw * 0.9, 0.0052, 0.016);
    d = smax(d, -cav, 0.002);
  }
  return d;
}

// ---------------------------------------------------------------------------------------------
export function earFrame(m, ax, y, z) {
  const S = m.earS;
  const px = ax - m.earX, py = y - m.earY, pz = z - m.earZ;
  const ct = cos(0.26), st = sin(0.26);
  const v1 = ct * py + st * pz, u1 = -st * py + ct * pz;
  const cf = cos(0.30), sf = sin(0.30);
  const w = cf * px - sf * u1, u = sf * px + cf * u1;
  return { u: u / S, v: v1 / S, w: w / S, S };
}

function ear(m, d, ax, y, z) {
  const F = earFrame(m, ax, y, z);
  const u = F.u * 1000, v = F.v * 1000, w = F.w * 1000; // mm
  if (u * u / 900 + v * v / 1600 > 1.7 || w > 16 || w < -18) return d;
  const vv = v + 1.5;
  const au = 15.8 * (vv < -8 ? (1 - 0.3 * pow(min((-8 - vv) / 22, 1), 1.4)) : 1) * (vv > 10 ? (1 - 0.16 * pow((vv - 10) / 22, 2)) : 1);
  const uc = u + 1.0 + (vv < -8 ? 0.12 * (vv + 8) : 0);
  const av = 31.5;
  const e2 = sqrt((uc / au) * (uc / au) + (vv / av) * (vv / av));
  const rho = (1 - e2) * min(au, av) * 1.05;
  const lobe = smoothstep(-12, -20, vv);
  const front = smoothstep(4, 10, uc);
  let hgt;
  {
    const rim = 3.2 * sqrt(max(0, 1 - pow((rho - 2.2) / 2.6, 2)));
    const scapha = 1.2;
    const anti = 3.6 * gauss(rho - 9.5, 2.2);
    const conchaC = sqrt(pow((uc - 3.5) / 7.5, 2) + pow((vv + 5) / 10.5, 2));
    const concha = -9 * smoothstep(1.1, 0.35, conchaC);
    hgt = max(rim, scapha + anti) + concha;
    hgt = mix(hgt, 2.4 + 0.6 * gauss(rho - 4, 3), lobe);
    hgt = mix(hgt, 1.5 + concha * 0.8, front * (1 - lobe));
    hgt += 3.4 * gauss(uc - 10.5, 2.4) * gauss(vv + 6, 3.5);
    hgt += 2.2 * gauss(uc - 2, 2.8) * gauss(vv + 15, 2.6);
    hgt += 2.0 * gauss(vv - 5.5 + 0.25 * (uc - 4), 1.6) * smoothstep(12, 4, uc) * smoothstep(-2, 3, uc);
  }
  const thick = 3.2 + 2.2 * lobe;
  const wf = hgt + 1.5;
  const wb = wf - thick - max(0, -hgt) * 0.2;
  let de = max(-rho, max(w - wf, wb - w));
  const root = ell(uc - 4, vv + 3, w + 8, 9, 15, 11);
  de = smin(de, root, 3.0);
  const dm = de * 0.001 * F.S * 0.75;
  d = smin(d, dm, 0.0016);
  {
    const cv = ell((uc - 7.5) * 0.001, (vv + 6.5) * 0.001, (w + 3) * 0.001, 0.0028, 0.0034, 0.006);
    d = smax(d, -cv * F.S, 0.0012);
  }
  return d;
}
