// AFTERZERO head_b: anatomical signed distance field of a human head (our own construction).
//
// The head is built the way a sculptor blocks it in, from masses:
//   face block : a sculpted frontal relief z = H(x, y) (forehead, brow ridge, glabella, orbits,
//                eyelid shells wrapping the globe with crease and lid-cheek junction, cheekbones,
//                malar fat, nasolabial fold, nose dorsum / tip lobule / alae / columella, philtrum,
//                Cupid's bow, upper and lower vermilion, modiolus, mentolabial sulcus, chin boss),
//                intersected (round fillets) with a side profile |x| = W(y, z) (temples, zygomatic
//                arch, masseter, mandible) and the sloping submandibular plane;
//   volumes    : cranium (superellipsoid), neck with sternocleidomastoids and thyroid cartilage,
//                ears (relief plate: helix, antihelix + crura, concha, tragus, antitragus, lobe);
//   carves     : palpebral fissures (radial walls around each eyeball = lid margins), nostrils,
//                mouth slit and oral cavity.
// The relief H and side profile W are 2D fields cached on grids per parameter set, so evaluating
// the 3D field during polygonisation stays cheap.
// Units: metres in canonical adult-male space (scaled by m.S afterwards). +Y up, face toward +Z,
// character left = +X. Pure JS (no three.js) so it runs in node for tests and likeness fitting.

const { sqrt, abs, min, max, exp, sin, cos, atan2, PI, pow, hypot, asin } = Math;

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
export function smin(a, b, k) { const h = k - abs(a - b); if (h <= 0) return a < b ? a : b; const t = h / k; return (a < b ? a : b) - t * t * k * 0.25; }
export function smax(a, b, k) { const h = k - abs(a - b); if (h <= 0) return a > b ? a : b; const t = h / k; return (a > b ? a : b) + t * t * k * 0.25; }
/** round intersection with a circular fillet of radius r (hg_sdf) */
export function rmax(a, b, r) { const u = max(r + a, 0), v = max(r + b, 0); return min(-r, max(a, b)) + sqrt(u * u + v * v); }
/** round union with a circular fillet of radius r */
export function rmin(a, b, r) { const u = max(r - a, 0), v = max(r - b, 0); return max(r, min(a, b)) - sqrt(u * u + v * v); }
export function gauss(v, s) { const q = v / s; return q * q > 16 ? 0 : exp(-q * q); }
// bump on [0,1] peaking at p (0..1), 0 at the ends
export function bump01(t, p, sharp = 1) {
  if (t <= 0 || t >= 1) return 0;
  const e = Math.log(0.5) / Math.log(p);
  const s = sin(PI * pow(t, e));
  return sharp === 1 ? s : pow(s, sharp);
}

/** approximate ellipsoid distance (iq), exact on the surface, good near it */
export function ell(x, y, z, rx, ry, rz) {
  const ax = x / rx, ay = y / ry, az = z / rz;
  const k0 = sqrt(ax * ax + ay * ay + az * az);
  if (k0 < 1e-9) return -min(rx, ry, rz);
  const bx = ax / rx, by = ay / ry, bz = az / rz;
  const k1 = sqrt(bx * bx + by * by + bz * bz);
  return k0 * (k0 - 1) / k1;
}
/** capsule with linearly varying radius */
export function rcap(px, py, pz, ax, ay, az, ra, bx, by, bz, rb) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const t = clamp((pax * bax + pay * bay + paz * baz) / l2, 0, 1);
  const dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
  return sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
}
// natural cubic-ish (monotone Hermite) interpolation through points [[x,y],...]
export function spline(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0]);
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
  return v => {
    if (v <= xs[0]) return ys[0] + mk[0] * (v - xs[0]);
    if (v >= xs[n - 1]) return ys[n - 1] + mk[n - 1] * (v - xs[n - 1]);
    let i = 0; while (xs[i + 1] < v) i++;
    const h = xs[i + 1] - xs[i], t = (v - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * mk[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * mk[i + 1];
  };
}
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
/** in-place separable max filter (radius r samples) on a W x H grid */
/** in-place separable box blur (radius r samples, repeated n times) on a W x H grid */
function boxBlur2D(A, W, H, r, n = 2) {
  const T = new Float32Array(max(W, H));
  for (let it = 0; it < n; it++) {
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) { let s = 0, c = 0; for (let k = max(0, i - r); k <= min(W - 1, i + r); k++) { s += A[j * W + k]; c++; } T[i] = s / c; }
      for (let i = 0; i < W; i++) A[j * W + i] = T[i];
    }
    for (let i = 0; i < W; i++) {
      for (let j = 0; j < H; j++) { let s = 0, c = 0; for (let k = max(0, j - r); k <= min(H - 1, j + r); k++) { s += A[k * W + i]; c++; } T[j] = s / c; }
      for (let j = 0; j < H; j++) A[j * W + i] = T[j];
    }
  }
}
function maxFilter2D(A, W, H, r) {
  const T = new Float32Array(max(W, H));
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) { let v = 0; for (let k = max(0, i - r); k <= min(W - 1, i + r); k++) if (A[j * W + k] > v) v = A[j * W + k]; T[i] = v; }
    for (let i = 0; i < W; i++) A[j * W + i] = T[i];
  }
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) { let v = 0; for (let k = max(0, j - r); k <= min(H - 1, j + r); k++) if (A[k * W + i] > v) v = A[k * W + i]; T[j] = v; }
    for (let j = 0; j < H; j++) A[j * W + i] = T[j];
  }
}
/** heights of an ellipsoid dome over (x, y); -1 when outside its footprint */
function dome(x, y, cx, cy, cz, rx, ry, rz) {
  const u = (x - cx) / rx, v = (y - cy) / ry, q = 1 - u * u - v * v;
  return q <= 0 ? -1 : cz + rz * sqrt(q);
}

// ---------------------------------------------------------------------------------------------
// model: all anatomical dimensions derived from params (sex, age, shape sliders, traits, seed)
// ---------------------------------------------------------------------------------------------
export const SHAPE_KEYS = ['jaw', 'cheek', 'nose', 'noseWidth', 'lips', 'brow', 'eyeSize', 'faceLength', 'chin'];
// internal traits (-1..1, 0 = average); likeness fits and cast profiles set these
export const TRAIT_KEYS = ['lidFold', 'eyeDepth', 'eyeTilt', 'eyeSpacing', 'eyeHeight', 'browHeight', 'browArch', 'noseBridge', 'noseHump', 'noseTip', 'noseLen',
  'noseDeviate', 'noseTipW', 'alarFlare', 'mouthWidth', 'upperLip', 'lowerLip', 'lipProtrude', 'lipCorner', 'philtrum', 'faceWidth', 'cheekFat', 'cheekHollow',
  'jawAngle', 'chinHeight', 'chinWidth', 'forehead', 'foreheadSlope', 'earSize', 'earOut', 'neck', 'jowl', 'temple', 'zygoma', 'midface', 'mouthY',
  'cleft', 'nasolabial', 'underEye', 'headLength', 'skullWidth'];

export function makeModel(p) {
  const sex = clamp(p.sex ?? 0, 0, 1);
  const age = clamp(p.age ?? 30, 8, 80);
  const shape = p.shape || {}, tr = p.traits || {};
  const rnd = mulberry32(((p.seed | 0) + 101) * 7919 + 13);
  const r2 = () => rnd() * 2 - 1;
  const fem = sex, mal = 1 - sex;
  const grown = clamp((age - 8) / 12, 0, 1); // 0 = child (8), 1 = adult (20+)
  const child = 1 - grown;
  const old = clamp((age - 38) / 34, 0, 1);
  const young = clamp((30 - age) / 12, 0, 1) * grown;
  const m = { sex, age, fem, mal, old, young, child, grown, seed: p.seed | 0 };
  for (const k of SHAPE_KEYS) m[k] = clamp(+shape[k] || 0, -1, 1);
  // every head gets small seeded natural variations of every trait on top of the explicit ones
  const nat = p.natural ?? 1;
  for (const k of TRAIT_KEYS) m[k] = clamp((+tr[k] || 0) + r2() * 0.28 * nat, -1.6, 1.6);
  m.noseW = m.noseWidth; m.faceLen = m.faceLength;
  const J = m.jaw, CH = m.chin, CK = m.cheek, FL = m.faceLen, B = m.brow, N = m.nose;

  // ---- vertical layout (y) ----
  const ad = mix(0.86, 1, grown);                         // child faces are short below the eyes
  const mid = (1 + 0.045 * FL + 0.05 * m.midface + 0.03 * N) * ad * mix(1, 0.965, fem);
  const low = (1 + 0.07 * FL + 0.03 * m.chinHeight) * mix(0.84, 1, grown) * mix(1, 0.955, fem);
  m.eyeY = 0.0855 + 0.0022 * m.eyeHeight + 0.004 * child;
  m.browY = m.eyeY + 0.0215 + 0.0028 * m.browHeight + 0.002 * fem;
  m.sellY = m.eyeY + 0.0035;
  m.subY = m.eyeY - 0.0525 * mid - 0.0025 * m.noseLen;           // subnasale
  m.tipY = m.subY + 0.0115 + 0.002 * N + 0.0028 * m.noseTip - 0.001 * child;
  m.stoY = m.subY - (0.0215 + 0.0016 * m.philtrum) * low + 0.0015 * m.mouthY; // stomion
  m.mentY = m.stoY - (0.0505 + 0.0035 * CH + 0.003 * m.chinHeight) * low;   // menton
  m.pogY = m.mentY + 0.0125 * low;
  m.hairY = m.browY + 0.058 + 0.007 * m.forehead;
  m.crownY = 0.196 + 0.004 * m.forehead;

  // ---- depth (z) ----
  const deep = clamp(m.eyeDepth + 0.45 * B * mal + 0.2 * old, -1.2, 1.8); // deep-set under a heavy brow
  m.deep = deep;
  m.Re = 0.0121 * mix(0.97, 1, grown);
  m.eyeZ = 0.0745 - 0.0018 * deep + 0.001 * child;
  m.glabZ = 0.0992 + 0.0024 * B * mal - 0.0014 * fem + 0.0008 * m.foreheadSlope - 0.002 * child;
  m.sellZ = 0.0945 + 0.0034 * m.noseBridge - 0.002 * child - 0.0012 * fem + 0.0008 * N;
  m.tipZ = 0.1205 + 0.0055 * N + 0.002 * m.noseLen - 0.005 * child - 0.0015 * fem;
  m.subZ = 0.1003 + 0.0006 * m.lipProtrude;
  m.lipZ = 0.1022 + 0.0016 * m.lipProtrude + 0.0007 * m.lips + 0.0006 * mal;   // vermilion front
  m.pogZ = 0.0965 + 0.0048 * CH - 0.0015 * fem - 0.004 * child;
  m.mentZ = 0.079 + 0.004 * CH - 0.002 * fem - 0.003 * child;

  // ---- widths (x) ----
  m.eyeX = (0.0322 + 0.0013 * m.eyeSpacing) * mix(0.96, 1, grown);
  m.alarHW = (0.0172 + 0.0026 * m.noseW + 0.0008 * m.alarFlare) * mix(1, 0.94, fem) * mix(0.86, 1, grown);
  m.mouthHW = (0.0258 + 0.0018 * m.mouthWidth + 0.0005 * m.lips) * mix(1, 0.965, fem) * mix(0.9, 1, grown);
  m.zygX = (0.0675 + 0.0028 * CK + 0.0022 * m.faceWidth + 0.001 * m.zygoma) * mix(1, 0.975, fem);
  m.gonX = (0.0498 + 0.0048 * J + 0.0014 * m.faceWidth) * mix(1, 0.9, fem) * mix(0.9, 1, grown);
  m.gonY = 0.0 + 0.0035 * m.jawAngle - 0.002 * J + 0.004 * fem + 0.004 * child;
  m.gonZ = -0.006 + 0.0025 * J;
  m.chinHW = (0.0165 + 0.0035 * J * mal + 0.0022 * m.chinWidth + 0.001 * CH) * mix(1, 0.86, fem);
  m.headW = (0.0765 + 0.0018 * m.skullWidth) * mix(1, 0.985, fem);
  m.headL = 1 + 0.03 * m.headLength;
  m.neckR = (0.0565 + 0.004 * m.neck) * mix(1, 0.84, fem) * mix(0.82, 1, grown);

  // ---- eyes: fissure as angles around the eyeball centre (alpha: azimuth, lateral +; beta: elevation)
  const es = 1 + 0.1 * m.eyeSize + 0.05 * child + 0.03 * fem - 0.05 * old;
  m.fis = {
    am: -1.3 * (1 + 0.02 * m.eyeSize), al: 1.3 * (1 + 0.03 * m.eyeSize),
    bm: -0.05,                                                         // medial canthus elevation
    bl: 0.03 + 0.08 * m.eyeTilt + 0.035 * fem + 0.02 * child,          // lateral canthus elevation
    hu: 0.43 * es * (1 - 0.06 * max(0, m.lidFold)) - 0.03 * old,       // upper lid opening (rad above canthal line)
    hl: 0.41 * es,
    pu: 0.43, pl: 0.57,                                                // where along the fissure the lids peak
  };
  m.lidT = 0.0019 + 0.0002 * mal;        // lid margin thickness
  m.lidTl = 0.0016;

  // ---- asymmetry (left = +x, right = -x): every face is a little uneven, more so with age ----
  const as = 0.7 + 0.5 * old;
  m.asym = {
    eyeDy: r2() * 0.0008 * as, browDy: r2() * 0.0013 * as, mouthDy: r2() * 0.0007 * as, mouthDx: r2() * 0.0005,
    noseDx: r2() * 0.0005 + 0.0022 * m.noseDeviate, tipDx: r2() * 0.0005 + 0.0016 * m.noseDeviate,
    jawDx: r2() * 0.0012, earDy: r2() * 0.0018, cheekD: r2() * 0.0009, eyeDz: r2() * 0.0004,
  };
  m.earS = (1 + 0.07 * m.earSize + 0.08 * old) * mix(1, 0.93, fem) * mix(0.93, 1, grown);
  m.earOutA = 0.32 + 0.14 * m.earOut;
  m.S = mix(1, 0.935, fem) * mix(0.88, 1, grown);
  return m;
}

// ---------------------------------------------------------------------------------------------
// eyelid fissure (shared with the mesh morphs, textures, lashes and eye shaders)
// ---------------------------------------------------------------------------------------------
/** margins at azimuth alpha: [upper elevation, lower elevation, t (0 medial .. 1 lateral)] */
export function lidAt(m, alpha) {
  const f = m.fis;
  const t = (alpha - f.am) / (f.al - f.am);
  const tc = clamp(t, 0, 1);
  const base = mix(f.bm, f.bl, tc);
  // upper lid: a fuller arch, flattened medially; lower lid: shallower medially, lowest laterally
  const up = base + f.hu * pow(bump01(tc, f.pu), 0.78);
  const lo = base - f.hl * pow(bump01(tc, f.pl), 0.95);
  return [up, lo, t];
}

// ---------------------------------------------------------------------------------------------
// field
// ---------------------------------------------------------------------------------------------
// part ids returned by field.part(): which tissue a surface point belongs to
export const PART = { SKIN: 0, LIP: 1, MOUTH: 2, NOSTRIL: 3, EAR: 4, LIDINNER: 5, CARUNCLE: 6, NECKCAP: 7 };

// grids for the frontal relief H(x, y) and side profile W(y, z)
const HG = { x0: -0.084, x1: 0.084, y0: -0.068, y1: 0.205, h: 0.0006 };
const WG = { y0: -0.07, y1: 0.205, z0: -0.07, z1: 0.125, h: 0.001 };

export function makeField(m) {
  const fem = m.fem, mal = m.mal, old = m.old, child = m.child, young = m.young;
  const Re = m.Re;
  const yE = m.eyeY, yS = m.subY, yM = m.stoY, yC = m.mentY;
  const asym = m.asym;
  const fis = m.fis;

  // ================= frontal relief H(x, y) =================
  // base: midline profile P(y) minus lateral recession R(|x|, y) (table, mm), then masses.
  const P = spline([
    [m.crownY + 0.012, -0.03],
    [m.hairY + 0.03, 0.05 - 0.008 * m.foreheadSlope],
    [m.hairY + 0.012, 0.0765 - 0.006 * m.foreheadSlope],
    [m.hairY - 0.01, 0.0878 - 0.0035 * m.foreheadSlope],
    [m.browY + 0.022, m.glabZ - 0.0025 - 0.0018 * m.foreheadSlope * mal],
    [m.browY + 0.004, m.glabZ - 0.0002],
    [m.sellY + 0.004, m.sellZ - 0.0012],
    [yE - 0.02, m.sellZ - 0.008],
    [yS + 0.006, m.subZ - 0.0065],
    [yS, m.subZ - 0.0035],
    [yS - 0.009, m.lipZ - 0.0045],
    [yM + 0.004, m.lipZ - 0.0062],
    [yM - 0.004, m.lipZ - 0.0072],
    [yM - 0.016, m.pogZ - 0.0075 - 0.0012 * m.lips],
    [m.pogY + 0.004, m.pogZ - 0.0006],
    [m.pogY - 0.003, m.pogZ - 0.0012],
    [yC + 0.002, m.mentZ + 0.003],
    [yC - 0.006, m.mentZ - 0.018],
    [yC - 0.02, m.mentZ - 0.06],
  ]);
  // recession (mm) at |x| = 0, 10 .. 80 mm for reference heights
  const RX = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08];
  const fw = 1 - 0.06 * m.faceWidth - 0.05 * child + 0.03 * fem - 0.04 * m.cheekFat * 0;   // rounder/wider face -> less recession
  const RL = [
    [m.crownY, [0, 3, 11, 24, 40, 58, 78, 100, 124]],
    [m.hairY + 0.02, [0, 1.2, 4.6, 10.5, 19, 30, 45, 64, 86]],
    [m.hairY, [0, 0.9, 3.5, 8, 14.5, 23.5, 36, 53, 74]],
    [m.browY + 0.02, [0, 0.7, 2.8, 6.5, 12, 20, 31.5, 47, 66]],
    [m.browY, [0, 0.6, 2.6, 6.2, 11.5, 19.5, 31, 46, 65]],
    [yE, [0, 2.6, 8.5, 13.5, 17, 22.5, 32, 47, 66]],
    [yE - 0.02, [0, 1.8, 5.0, 8.5, 13.5, 21, 32, 48, 68]],
    [yS + 0.004, [0, 1.6, 5.2, 10.5, 18, 29, 43, 61, 82]],
    [yM + 0.006, [0, 1.6, 6.0, 13, 23, 36, 52, 71, 92]],
    [yM - 0.012, [0, 1.3, 5.2, 12, 22.5, 36, 53, 73, 95]],
    [m.pogY, [0, 1.2, 4.6, 11, 21.5, 35, 52, 72, 94]],
    [yC, [0, 1.6, 6.4, 14.5, 26, 40, 57, 77, 99]],
    [yC - 0.02, [0, 2, 8, 18, 31, 47, 66, 87, 110]],
  ];
  RL.sort((a, b) => a[0] - b[0]);
  const recRow = new Float64Array(RX.length);
  function recSetRow(y) {
    // Catmull-Rom across levels per x column
    let i = 0; while (i < RL.length - 2 && RL[i + 1][0] < y) i++;
    const y0 = RL[i][0], y1 = RL[i + 1][0];
    const t = clamp((y - y0) / (y1 - y0), 0, 1);
    const a = RL[max(0, i - 1)][1], b = RL[i][1], c = RL[i + 1][1], d = RL[min(RL.length - 1, i + 2)][1];
    for (let k = 0; k < RX.length; k++) recRow[k] = max(0, catmull(a[k], b[k], c[k], d[k], t)) * 0.001 * fw;
  }
  function recAt(ax) {
    const f = ax / 0.01;
    const i = min(RX.length - 2, f | 0), t = f - i;
    if (f >= RX.length - 1) return recRow[RX.length - 1] + (recRow[RX.length - 1] - recRow[RX.length - 2]) * (f - RX.length + 1);
    return catmull(recRow[max(0, i - 1)], recRow[i], recRow[i + 1], recRow[min(RX.length - 1, i + 2)], t);
  }

  // ---- eye region relief, per side: lid shells around the globe, orbit hollow ----
  const E = { x: m.eyeX, y: yE, z: m.eyeZ };
  const fold = m.lidFold, deep = m.deep;
  const rS = Re + m.lidT;                                      // shell radius at the margin
  const crease = (0.36 + 0.07 * max(0, deep) + 0.03 * child) * (1 - 0.35 * max(0, fold)) * (1 - 0.15 * old);
  const lidPack = { rS, crease };
  function eyeShell(lx, y, side) {
    // returns the lid-skin height over (lx,y) for this eye or -1 if no lid here
    const ex = lx - E.x, ey = y - (E.y + side * asym.eyeDy);
    const rr = ex * ex + ey * ey;
    const R0 = rS + 0.0012;
    if (rr > R0 * R0 * 0.995) return -1;
    const ez0 = sqrt(R0 * R0 - rr);
    const al = atan2(ex, ez0), be = asin(clamp(ey / R0, -1, 1));
    const L = lidAt(m, al);
    const t = L[2];
    let r;
    if (be >= L[0] || t <= 0 || t >= 1) {
      // upper lid: pretarsal shell rising gently to the crease, then dropping under the fold
      const u = be - L[0];
      const inner = t < 0 ? -t : t > 1 ? t - 1 : 0;           // beyond the canthi
      const uu = max(u, inner * 1.6);
      r = rS + 0.0003 * smoothstep(0, 0.2, uu) - 0.0065 * smoothstep(crease, crease + 0.18, uu);
      // medial upper lid flattens toward the nose root
      r -= 0.0007 * smoothstep(0.25, -0.05, t) * smoothstep(0.0, 0.3, uu);
    } else if (be <= L[1]) {
      // lower lid: margin, pretarsal roll, lid-cheek junction
      const l = L[1] - be;
      r = m.Re + m.lidTl + 0.0007 * bump01(clamp(l / 0.34, 0, 1), 0.42) * (1 - 0.4 * old)
        - (0.0012 + 0.0012 * old + 0.0008 * m.underEye) * smoothstep(0.3, 0.62, l);
    } else {
      r = mix(m.Re + m.lidTl, rS, (be - L[1]) / max(1e-4, L[0] - L[1]));
    }
    const q = r * r - rr;
    if (q <= 0) return -1;
    return E.z + side * 0 + asym.eyeDz * side + sqrt(q);
  }
  function socket(lx, y) {
    // orbit hollow: deeper for deep-set eyes, fuller (shallower sulcus) when hooded / young
    const dx = (lx - (E.x + 0.0015)) / (0.0215 + 0.001 * fem), dy = (y - (E.y + 0.003 + 0.001 * deep)) / (0.0165 + 0.0008 * deep);
    const q = dx * dx + dy * dy;
    if (q >= 1) return 0;
    const w = (1 - q) * (1 - q);
    return -(0.0105 + 0.0028 * deep - 0.0018 * max(0, fold) - 0.001 * young - 0.0006 * child) * w;
  }

  // ---- nose ----
  const sell = { y: m.sellY, z: m.sellZ };
  const tipY = m.tipY, tipZ = m.tipZ;
  const supra = { y: tipY + 0.0085, z: tipZ - 0.0048 };
  const bridgeW = (0.0048 + 0.0011 * m.noseW + 0.0006 * mal - 0.0007 * child) * (1 + 0.15 * m.noseBridge * 0);
  const tipW = (0.0074 + 0.0011 * m.noseW + 0.0008 * m.noseTipW + 0.0004 * N_(m)) * mix(1, 0.92, fem);
  const hump = 0.0009 * m.noseHump + 0.0003 * mal + 0.0005 * old;
  function noseH(x, y) {
    if (y > sell.y + 0.012 || y < yS - 0.006) return -1;
    const xd = x - asym.noseDx * smoothstep(sell.y, tipY, y) - asym.tipDx * smoothstep(supra.y, tipY, y);
    const ax = abs(xd);
    if (ax > 0.032) return -1;
    let h = -1;
    // dorsum: ridge line from the sellion to the supratip, rounded-V cross-section
    {
      const t = clamp((sell.y - y) / (sell.y - supra.y), -0.4, 1.15);
      const zr = mix(sell.z, supra.z, t) + hump * bump01(clamp(t, 0, 1), 0.4) - 0.0006 * m.noseTip * bump01(clamp(t, 0, 1), 0.85);
      const w = mix(bridgeW * 0.8, bridgeW * 1.35, smoothstep(0, 1, t)) + 0.0012 * smoothstep(0.7, 1.1, t);
      const sw = mix(1.05, 1.9, smoothstep(0.0, 0.9, t));     // sidewall slope, steeper toward the tip
      h = zr - (sqrt(ax * ax + w * w) - w) * sw;
      // root of the nose dips into the nasion
      h -= 0.003 * smoothstep(-0.05, -0.4, t);
    }
    // tip lobule: paired domes + central lobule, infratip lobule down to the columella
    {
      const ty = tipY + 0.0004 * m.noseTip;
      const lob = dome(xd - asym.tipDx, y, 0, ty + 0.0018, tipZ - 0.0072, tipW, 0.0088, 0.0072);
      const dmL = dome(xd - asym.tipDx, y, 0.0033, ty + 0.0002, tipZ - 0.0045, 0.0050, 0.0060, 0.0045);
      const dmR = dome(xd - asym.tipDx, y, -0.0033, ty + 0.0002, tipZ - 0.0045, 0.0050, 0.0060, 0.0045);
      h = smax(h, smax(lob, smax(dmL, dmR, 0.0012), 0.0016), 0.0035);
      // columella + infratip: from under the tip back to the subnasale (steep underside)
      const cy = mix(ty - 0.0045, yS + 0.001, 0.5), cz = mix(tipZ - 0.006, m.subZ - 0.002, 0.5);
      const col = dome(xd, y, 0, cy, cz, 0.0034, 0.0062, 0.0105);
      h = smax(h, col, 0.002);
    }
    // alae: rounded wings beside the tip, flaring out to the alar base
    for (const sd of [1, -1]) {
      const cx = sd * (m.alarHW - 0.0062), cy = yS + 0.0062, cz = m.subZ - 0.0012;
      const al = dome(xd, y, cx, cy, cz, 0.0068, 0.0068, 0.0082 + 0.0008 * m.noseW);
      // alar sidewall connects to the dorsum and lobule
      h = smax(h, al, 0.0022);
    }
    return h;
  }
  function N_(mm) { return mm.nose; }

  // ---- mouth ----
  const mw = m.mouthHW;
  const arcK = 15.5 + 3 * child - 1.2 * m.lipProtrude;                 // dental arch curvature
  const hu0 = (0.0078 + 0.0022 * m.lips + 0.0012 * m.upperLip + 0.0014 * fem) * (1 - 0.3 * old) * mix(0.85, 1, m.grown);
  const hl0 = (0.0095 + 0.0026 * m.lips + 0.0014 * m.lowerLip + 0.0012 * fem) * (1 - 0.22 * old) * mix(0.85, 1, m.grown);
  function stomion(x) { // y of the lip line
    const a = abs(x) / mw;
    return yM + asym.mouthDy * (x / mw) - (0.0012 - 0.0016 * m.lipCorner) * a * a * a;
  }
  function vermU(x) { // upper vermilion border height above the stomion line (Cupid's bow)
    const a = abs(x) / mw;
    const pk = 0.2;
    const g = a < pk ? mix(0.84, 1.0, smoothstep(0, pk, a)) : mix(1.0, 0.0, pow(smoothstep(pk, 1.0, a), 0.9));
    return hu0 * g;
  }
  function vermL(x) { // lower border depth below the stomion
    const a = abs(x) / mw;
    return hl0 * pow(max(0, 1 - pow(a, 2.3)), 0.62);
  }
  function arcZ(x) { return m.lipZ - arcK * x * x * (1 + 1.6 * x * x / (mw * mw) * 0.25); }
  function lipsH(x, y) {
    const ax = abs(x - asym.mouthDx);
    if (ax > mw + 0.004 || y > yM + 0.016 || y < yM - 0.019) return -1;
    const xs = x - asym.mouthDx;
    const ys = stomion(xs);
    const z0 = arcZ(xs);
    const a = ax / mw;
    let h = -1;
    // upper lip vermilion: rolls in at the stomion, fullest ~55% up, crisp border (white roll)
    const hu = vermU(xs);
    if (y >= ys - 0.0006 && hu > 0) {
      const t = (y - ys) / max(hu, 1e-4);
      if (t < 1.25) {
        const tc = clamp(t, 0, 1);
        const prof = 0.6 * sin(PI * pow(tc, 0.75) * 0.94) - 0.55 * pow(1 - tc, 3) * 0.6 + 0.25 * tc;
        const thick = (0.0031 + 0.0015 * m.lips + 0.0008 * m.upperLip + 0.0004 * fem) * pow(max(0, 1 - pow(a, 2.4)), 0.55);
        h = z0 - 0.0016 + thick * prof - 0.004 * max(0, t - 1) - 0.0016 * pow(1 - tc, 4);
      }
    }
    // lower lip vermilion: fuller, rounded, with a slight central dip
    const hl = vermL(xs);
    if (y <= ys + 0.0006 && hl > 0) {
      const t = (ys - y) / max(hl, 1e-4);
      if (t < 1.3) {
        const tc = clamp(t, 0, 1);
        const prof = sin(PI * pow(tc, 0.85)) * 0.95 + 0.1 * (1 - tc) - 0.3 * pow(1 - tc, 4);
        const thick = (0.0036 + 0.0016 * m.lips + 0.001 * m.lowerLip + 0.0004 * fem) * pow(max(0, 1 - pow(a, 2.2)), 0.5) * (1 - 0.08 * gauss(x, 0.004));
        const hh = z0 - 0.0028 + thick * prof - 0.0045 * max(0, t - 1) - 0.0012 * pow(1 - tc, 5);
        h = max(h, hh);
      }
    }
    return h;
  }

  // the relief is evaluated row by row: every term is (x-factor) * (y-factor), y-factors per row
  const g = gauss;
  function frontRow(y, xs, out) {
    recSetRow(y);
    const Py = P(y);
    const B = m.brow;
    // ---- per-row factors ----
    const fEmin = (0.0010 + 0.0012 * fem + 0.0015 * child) * g(y - (m.browY + 0.04), 0.022);
    const glab = (0.0012 + 0.0016 * mal * max(0, B + 0.4)) * g(y - (m.browY - 0.002), 0.0075);
    const corr = 0.0004 * mal * g(y - (m.browY - 0.006), 0.005);
    const tline = (0.0022 + 0.0016 * old - 0.001 * young) * g(y - (m.browY + 0.02), 0.022);
    const browOn = y > yE && y < m.browY + 0.03;
    const browAmp = (0.0016 + 0.0028 * max(0, B) * mal + 0.0018 * mal + 0.0006 * deep) * mix(1, 0.35, fem) * mix(1, 0.4, child);
    const rimY = 0.0012 * g(y - (yE + 0.012), 0.012);
    const ck = m.cheek, cf = 0.55 + 0.3 * m.cheekFat + 0.3 * young + 0.45 * child + 0.2 * fem - 0.35 * old;
    const zyg = (0.0034 + 0.0018 * ck + 0.0008 * m.zygoma + 0.0006 * fem) * g(y - (yE - 0.024), 0.0105);
    const malar = 0.0026 * cf * g(y - (yS + 0.017 - 0.004 * old), 0.013);
    const tear = (0.0006 + 0.0012 * old + 0.0006 * m.underEye) * g(y - (yE - 0.016), 0.004);
    const tN = clamp((yS + 0.006 - y) / (yS + 0.006 - (yM - 0.006)), 0, 1);
    const lineX = mix(m.alarHW + 0.003, mw + 0.0055, pow(tN, 0.85)) + 0.0015 * tN * tN;
    const inY = smoothstep(-0.05, 0.08, tN) * smoothstep(1.15, 0.8, tN);
    const nlDepth = (0.0012 + 0.0016 * old + 0.0006 * m.nasolabial + 0.0004 * mal) * (1 - 0.6 * child) * inY;
    const nlW = 0.0022 + 0.0008 * old;
    const bucc = (0.0012 + 0.0016 * m.cheekHollow + 0.0012 * old - 0.0012 * young - 0.0015 * child) * g(y - (yM + 0.012), 0.014);
    const modi = 0.0008 * g(y - yM, 0.005);
    const jowl = 0.0022 * old * (1 + 0.5 * m.jowl) * g(y - (m.pogY + 0.006), 0.009);
    const philOn = y < yS + 0.004 && y > yM - 0.002;
    const tP = clamp((yS - y) / (yS - yM), 0, 1);
    const pc = (0.0046 + 0.0004 * m.philtrum) * mix(1.1, 0.9, tP) * mix(0.8, 1, m.grown);
    const ph = (0.0006 + 0.0002 * fem);
    const phCol = ph * smoothstep(0, 0.15, tP) * smoothstep(1.05, 0.85, tP), phGr = ph * 0.6 * smoothstep(0.05, 0.3, tP) * smoothstep(1.0, 0.75, tP);
    const cw = m.chinHW;
    const chinB = (0.002 + 0.0016 * m.chin) * g(y - (m.pogY + 0.002), 0.0085);
    const chinT = 0.0011 * mal * g(y - (yC + 0.008), 0.006);
    const sy = yM - vermL(0) - 0.0042 - 0.0008 * m.lips;
    const mlAmp = 0.0018 + 0.0008 * m.lips + 0.0004 * mal;
    const cleft = m.cleft > 0.3 ? 0.0008 * (m.cleft - 0.3) * g(y - m.pogY, 0.006) : 0;
    const noseRow = y <= sell.y + 0.012 && y >= yS - 0.006;
    const eyeRow = abs(y - yE) < rS + 0.004;
    const lipRow = y <= yM + 0.016 && y >= yM - 0.019;
    const agY = y - (yS + 0.0055), agOn = abs(agY) < 0.012;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i], ax = abs(x);
      let h = Py - recAt(ax);
      // forehead: frontal eminences, glabella, procerus, temporal line
      h += fEmin * g(ax - 0.026, 0.02) + glab * g(x, 0.0085) + corr * g(ax - 0.012, 0.005) - tline * g(ax - 0.06, 0.009);
      const sideX = x >= 0 ? 1 : -1;
      // brow ridge (supraorbital torus) following the brow line, strongest medially for men
      if (browOn && ax > -0.004) {
        const by = m.browY - 0.0025 + sideX * asym.browDy + 0.003 * smoothstep(0.012, 0.045, ax) * (0.5 + 0.5 * fem) - 0.004 * smoothstep(0.04, 0.062, ax);
        const along = smoothstep(-0.004, 0.012, ax) * (1 - 0.55 * smoothstep(0.028, 0.06, ax));
        h += browAmp * along * g(y - by, 0.0075 + 0.001 * mal);
      }
      h += rimY * g(ax - 0.05, 0.007);
      // orbit hollow
      if (eyeRow || abs(y - yE) < 0.025) h += socket(ax, y - sideX * asym.eyeDy);
      // cheeks
      const cs = 1 + sideX * asym.cheekD * 50;
      h += zyg * cs * g(ax - (m.zygX - 0.024), 0.012) + malar * g(ax - 0.034, 0.013) - tear * g(ax - 0.024, 0.006);
      if (nlDepth > 1e-6) {
        h += nlDepth * 1.2 * smoothstep(-0.001, 0.006, ax - lineX) * g(ax - lineX - 0.008, 0.012);
        h -= nlDepth * 0.7 * g(ax - lineX, nlW);
      }
      h -= bucc * g(ax - 0.047, 0.01);
      h += modi * g(ax - (mw + 0.004), 0.004) + jowl * g(ax - (mw + 0.014), 0.008);
      // upper lip skin: philtral columns and groove
      if (philOn) h += phCol * g(ax - pc * mix(0.7, 1.0, tP), 0.0016) - phGr * g(x, 0.0024);
      // chin boss, mental tubercles, mentolabial sulcus
      h += chinB * g(x, cw * 0.9) + chinT * g(ax - cw * 0.62, 0.0055);
      h -= mlAmp * g(y - sy - 0.006 * (ax / 0.02) * (ax / 0.02), 0.0035) * g(x, 0.014) + cleft * g(x, 0.0018);
      // nose, lids and lips are masses joined with smooth unions
      if (noseRow) {
        const nh = noseH(x, y);
        if (nh > h - 0.004) h = smax(h, nh, 0.003 + 0.0006 * m.noseW);
        if (agOn) { // alar-facial groove
          const gx = ax - (m.alarHW + 0.0002);
          if (gx > -0.003) {
            const ang = atan2(agY, gx), rr = sqrt(gx * gx + agY * agY * 0.8);
            h -= 0.0011 * g(rr - 0.0045, 0.0012) * smoothstep(-2.4, -1.2, ang) * smoothstep(2.3, 1.2, ang);
          }
        }
      }
      if (eyeRow) {
        const es = eyeShell(ax, y, sideX);
        if (es > 0 && es > h - 0.006) h = smax(h, es, 0.0013 + 0.0004 * max(0, fold) + 0.0003 * young);
      }
      if (lipRow) {
        const lh = lipsH(x, y);
        if (lh > h - 0.004) h = smax(h, lh, 0.0011);
      }
      out[i] = h;
    }
  }

  // bake H on the grid (+ gradient factor for distance normalisation)
  const HNX = Math.round((HG.x1 - HG.x0) / HG.h) + 1, HNY = Math.round((HG.y1 - HG.y0) / HG.h) + 1;
  const Hgrid = new Float32Array(HNX * HNY), Ggrid = new Float32Array(HNX * HNY);
  const HXs = new Float64Array(HNX), HROW = new Float32Array(HNX);
  for (let i = 0; i < HNX; i++) HXs[i] = HG.x0 + i * HG.h;
  for (let j = 0; j < HNY; j++) {
    const y = HG.y0 + j * HG.h;
    frontRow(y, HXs, HROW);
    Hgrid.set(HROW, j * HNX);
  }
  // gradient factor 1/sqrt(1+|grad H|^2) using the largest slope within ~4 mm, so the height-field
  // distance never overestimates the true distance (needed for octree pruning and ray marching)
  const G2 = new Float32Array(HNX * HNY);
  for (let j = 0; j < HNY; j++) for (let i = 0; i < HNX; i++) {
    const hx = (Hgrid[j * HNX + min(HNX - 1, i + 1)] - Hgrid[j * HNX + max(0, i - 1)]) / (HG.h * (min(HNX - 1, i + 1) - max(0, i - 1)));
    const hy = (Hgrid[min(HNY - 1, j + 1) * HNX + i] - Hgrid[max(0, j - 1) * HNX + i]) / (HG.h * (min(HNY - 1, j + 1) - max(0, j - 1)));
    G2[j * HNX + i] = hx * hx + hy * hy;
  }
  maxFilter2D(G2, HNX, HNY, 6);
  for (let k = 0; k < Ggrid.length; k++) Ggrid[k] = max(0.12, 1 / sqrt(1 + G2[k]));
  boxBlur2D(Ggrid, HNX, HNY, 5, 2); // smooth the factor so it never bends the field's normals
  const hInv = 1 / HG.h;
  function Hs(x, y) { // bilinear sample of H; returns [h, g]
    let fx = (x - HG.x0) * hInv, fy = (y - HG.y0) * hInv;
    if (fx < 0) fx = 0; else if (fx > HNX - 1.001) fx = HNX - 1.001;
    if (fy < 0) fy = 0; else if (fy > HNY - 1.001) fy = HNY - 1.001;
    const i = fx | 0, j = fy | 0, a = fx - i, b = fy - j, k = j * HNX + i;
    const h = (Hgrid[k] * (1 - a) + Hgrid[k + 1] * a) * (1 - b) + (Hgrid[k + HNX] * (1 - a) + Hgrid[k + HNX + 1] * a) * b;
    const g = (Ggrid[k] * (1 - a) + Ggrid[k + 1] * a) * (1 - b) + (Ggrid[k + HNX] * (1 - a) + Ggrid[k + HNX + 1] * a) * b;
    HS[0] = h; HS[1] = g;
    return HS;
  }
  const HS = [0, 0];

  // ================= side profile W(y, z): half width of the face block =================
  const Wy = spline([
    [m.crownY + 0.01, 0.0],
    [m.hairY + 0.03, m.headW - 0.026],
    [m.hairY + 0.01, m.headW - 0.012],
    [m.browY + 0.01, m.headW - 0.0075],
    [yE, m.zygX - 0.0035],
    [yE - 0.022, m.zygX + 0.0002],
    [yS + 0.004, m.zygX - 0.0045],
    [yM + 0.01, mix(m.zygX - 0.008, m.gonX + 0.006, 0.55)],
    [m.gonY + 0.015, m.gonX + 0.0045],
    [m.gonY, m.gonX + 0.0015],
    [yC + 0.01, m.chinHW + 0.012],
    [yC - 0.01, m.chinHW + 0.004],
  ]);
  function sideWidth(y, z, wy) {
    let w = wy;
    // toward the front the block is wide (the frontal relief shapes the face); behind the ear it
    // narrows into the cranium / neck
    w += 0.01 * smoothstep(0.03, 0.09, z);
    // temple hollow above the zygomatic arch, behind the lateral orbital rim
    w -= (0.0028 + 0.0015 * old - 0.0012 * young + 0.0008 * m.temple) * gauss(y - (m.browY - 0.002), 0.017) * gauss(z - 0.033, 0.02);
    // zygomatic arch: horizontal ridge from the cheekbone back toward the ear
    w += (0.0016 + 0.0008 * m.zygoma) * gauss(y - (yE - 0.024), 0.0055) * smoothstep(-0.012, 0.01, z) * smoothstep(0.075, 0.05, z);
    // masseter bulge over the ramus
    w += (0.0012 + 0.0016 * m.jaw * mal) * gauss(y - (m.gonY + 0.022), 0.014) * gauss(z - 0.015, 0.016);
    // mandible: the jaw tapers toward the chin as z grows (V for women, squarer for men)
    const jz = smoothstep(m.gonZ + 0.005, m.mentZ, z);
    const jawLine = mix(m.gonX, m.chinHW + 0.004, pow(jz, mix(1.25, 0.95, fem) - 0.25 * m.jaw));
    const below = smoothstep(m.gonY + 0.03, m.gonY - 0.002, y);
    w = mix(w, min(w, jawLine + 0.004), below * smoothstep(m.gonZ - 0.01, m.gonZ + 0.02, z));
    return w;
  }
  const WNY = Math.round((WG.y1 - WG.y0) / WG.h) + 1, WNZ = Math.round((WG.z1 - WG.z0) / WG.h) + 1;
  const Wgrid = new Float32Array(WNY * WNZ), WGg = new Float32Array(WNY * WNZ);
  for (let j = 0; j < WNY; j++) { const y = WG.y0 + j * WG.h, wy = Wy(y); for (let i = 0; i < WNZ; i++) Wgrid[j * WNZ + i] = sideWidth(y, WG.z0 + i * WG.h, wy); }
  for (let j = 0; j < WNY; j++) for (let i = 0; i < WNZ; i++) {
    const wz = (Wgrid[j * WNZ + min(WNZ - 1, i + 1)] - Wgrid[j * WNZ + max(0, i - 1)]) / (WG.h * 2);
    const wy = (Wgrid[min(WNY - 1, j + 1) * WNZ + i] - Wgrid[max(0, j - 1) * WNZ + i]) / (WG.h * 2);
    WGg[j * WNZ + i] = wz * wz + wy * wy;
  }
  maxFilter2D(WGg, WNZ, WNY, 4);
  for (let k = 0; k < WGg.length; k++) WGg[k] = max(0.15, 1 / sqrt(1 + WGg[k]));
  boxBlur2D(WGg, WNZ, WNY, 4, 2);
  const wInv = 1 / WG.h;
  const WS = [0, 0];
  function Ws(y, z) {
    let fy = (y - WG.y0) * wInv, fz = (z - WG.z0) * wInv;
    if (fy < 0) fy = 0; else if (fy > WNY - 1.001) fy = WNY - 1.001;
    if (fz < 0) fz = 0; else if (fz > WNZ - 1.001) fz = WNZ - 1.001;
    const j = fy | 0, i = fz | 0, b = fy - j, a = fz - i, k = j * WNZ + i;
    WS[0] = (Wgrid[k] * (1 - a) + Wgrid[k + 1] * a) * (1 - b) + (Wgrid[k + WNZ] * (1 - a) + Wgrid[k + WNZ + 1] * a) * b;
    WS[1] = (WGg[k] * (1 - a) + WGg[k + 1] * a) * (1 - b) + (WGg[k + WNZ] * (1 - a) + WGg[k + WNZ + 1] * a) * b;
    return WS;
  }

  // submandibular plane through the menton and the gonion
  const mentZb = m.mentZ - 0.004;
  const slopeB = (m.gonY - (yC + 0.001)) / (m.gonZ - mentZb);
  const nB = 1 / sqrt(1 + slopeB * slopeB);

  // ================= volumes =================
  const cr = { cy: 0.098 + 0.002 * m.forehead, cz: -0.012 - 0.004 * (m.headL - 1) / 0.03, rx: m.headW, ry: m.crownY - 0.098, rz: (0.0965 - 0.002 * fem) * m.headL };
  function cranium(x, y, z) {
    const dy = y - cr.cy, dz = z - cr.cz;
    const back = clamp(-dz / cr.rz, 0, 1), below = clamp(-dy / cr.ry, 0, 1);
    // flatter sides, fuller parietal/occipital, narrower toward the forehead and below
    const rx = cr.rx * (1 - 0.07 * clamp(dz / cr.rz, 0, 1) - 0.1 * below * (1 - back * 0.5));
    const rz = cr.rz * (1 + 0.04 * clamp(-dy / cr.ry + 0.25, 0, 1) * back);
    return ell(x, dy, dz, rx, cr.ry, rz);
  }
  const nk = { y0: 0.04, y1: -0.105, z0: -0.019, z1: -0.006, rx: m.neckR * 1.03, rz: m.neckR * 0.94 };
  function neck(x, y, z) {
    const t = clamp((nk.y0 - y) / (nk.y0 - nk.y1), 0, 1);
    const zc = mix(nk.z0, nk.z1, t);
    const flare = 1 + 0.1 * smoothstep(0.6, 1, t) + 0.05 * smoothstep(0.3, 0, t);
    const ex = x / (nk.rx * flare), ez = (z - zc) / (nk.rz * flare);
    const rr = sqrt(ex * ex + ez * ez);
    const dr = (rr - 1) * nk.rz * flare;
    return max(dr, max(y - (nk.y0 + 0.03), (nk.y1 - 0.004) - y));
  }
  function faceBlock(x, y, z) {
    const ax = abs(x);
    const hs = Hs(x, y);
    const dF = (z - hs[0]) * hs[1];
    const ws = Ws(y, z);
    const dSd = (ax - ws[0]) * ws[1];
    let d = rmax(dF, dSd, 0.017 - 0.006 * smoothstep(yE, m.gonY, y) + 0.004 * fem);
    const yb = yC + 0.001 + slopeB * (z - mentZb);
    const dB = (yb - y) * nB;
    d = rmax(d, dB, 0.0075 + 0.004 * fem + 0.004 * child + 0.002 * old);
    d = rmax(d, -0.035 - z, 0.012);
    // above the eyes the block is clipped to an expanded cranium (rounded forehead and top)
    if (y > yE - 0.01) {
      const clip = ell(x, y - cr.cy, z - (cr.cz + 0.012), cr.rx + 0.0005, cr.ry + 0.002, cr.rz + 0.0125) - 0.05 * smoothstep(m.browY + 0.005, yE - 0.01, y);
      d = smax(d, clip, 0.012);
    }
    return d;
  }

  const ear = buildEar(m);

  // ---- carves ----
  function eyeCarve(d, x, y, z) {
    const side = x >= 0 ? 1 : -1;
    const ex = side * x - E.x, ey = y - (E.y + side * asym.eyeDy), ez = z - (E.z + side * asym.eyeDz);
    const r2 = ex * ex + ey * ey + ez * ez;
    if (r2 > 0.022 * 0.022 || ez < -0.004) return d;
    const r = sqrt(r2);
    const al = atan2(ex, ez), be = atan2(ey, sqrt(ex * ex + ez * ez));
    if (al < fis.am - 0.3 || al > fis.al + 0.3) return d;
    const L = lidAt(m, al);
    let w = max(be - L[0], L[1] - be);
    const wc = max(fis.am - al, al - fis.al);
    w = smax(w, wc, 0.05);
    const outer = Re + 0.0075 - 0.0045 * smoothstep(0.35, 0.0, min(L[2], 1 - L[2]));
    const carve = max(w * r, max((Re - 0.0007) - r, r - outer));
    d = smax(d, -carve, 0.00045);
    // caruncle (medial corner)
    const ca = fis.am + 0.1, cb = fis.bm - 0.01, crr = Re + 0.0004;
    const cx = crr * sin(ca) * cos(cb), cy = crr * sin(cb), cz = crr * cos(ca) * cos(cb);
    const car = ell(ex - cx, ey - cy, ez - cz, 0.0018, 0.0016, 0.0016);
    return smin(d, car, 0.0005);
  }
  function nostrilVol(x, y, z) {
    if (y > yS + 0.016 || y < yS - 0.006 || abs(x) > 0.022 || z < m.subZ - 0.008) return 1;
    const xd = x - asym.noseDx - asym.tipDx * 0.7;
    let dn = 1;
    for (const sd of [1, -1]) {
      const cx = sd * (0.0056 + 0.0011 * m.noseW), cy = yS + 0.0032, cz = m.subZ + 0.0062 + 0.002 * m.nose;
      const lx = xd - cx, ly = y - cy, lz = z - cz;
      const ang = -sd * 0.38, ca = cos(ang), sa = sin(ang);
      const rx = lx * ca - lz * sa, rz = lx * sa + lz * ca;
      dn = min(dn, ell(rx, ly + 0.15 * rz, rz, 0.0028 + 0.0005 * m.noseW, 0.0028, 0.0058 + 0.0006 * m.nose));
    }
    return dn;
  }
  function mouthVol(x, y, z) {
    const xs = x - asym.mouthDx;
    if (abs(xs) > mw + 0.008 || y > yM + 0.022 || y < yM - 0.024 || z < 0.04) return 1;
    const a = abs(xs) / mw;
    const v = y - stomion(xs);
    const w = z - arcZ(xs);
    // slit between the lips: open toward the front, tapering to nothing at the corners
    const half = (0.00055 + 0.00045 * smoothstep(-0.002, -0.008, w)) * clamp((1.0 - a) / 0.14, 0, 1);
    const sheet = max(abs(v + 0.0001) - half, max(a - 1.0, 0) * mw);
    const sheetD = max(sheet, -0.0125 - w);
    // oral cavity behind the incisors
    const cav = ell(xs, y - (yM - 0.0012), z - (m.lipZ - 0.03), mw * 1.05, 0.0118, 0.0215);
    return smin(sheetD, cav, 0.0025);
  }

  // ================= assemble =================
  const yTop = m.crownY + 0.01;
  function sdfBase(x, y, z) {
    let d = cranium(x, y, z);
    if (y < yTop && z > -0.06) {
      const fb = faceBlock(x, y, z);
      d = smin(d, fb, 0.014);
    }
    const nkD = neck(x, y, z);
    // nape smoother at the back, crisper jaw-neck angle in front
    const kneck = mix(0.006 + 0.006 * fem + 0.008 * old + 0.006 * child, 0.028, smoothstep(0.02, -0.04, z));
    d = smin(d, nkD, kneck);
    const ax = abs(x);
    // neck muscles (sternocleidomastoid) and thyroid cartilage
    if (y < 0.05 && z > -0.07 && y > nk.y1 - 0.01) {
      for (const sd of [1, -1]) {
        const scm = rcap(x, y, z, sd * 0.05, 0.035, -0.045, 0.0085, sd * 0.016, -0.12, 0.032, 0.0085);
        d = smin(d, scm, 0.016);
      }
      if (mal > 0.3 && y < -0.035) {
        const th = ell(x, y + 0.062 - 0.004 * child, z - (0.041 + 0.0005), 0.0068, 0.0095, 0.006);
        d = smin(d, th, 0.012 * mal + 0.004);
      }
    }
    // ears
    if (ax > 0.05 && y > 0.015 && y < 0.135 && z < 0.035 && z > -0.055) d = ear.union(d, x, y, z);
    return d;
  }
  function sdf(x, y, z) {
    let d = sdfBase(x, y, z);
    if (z > 0.035) {
      const ax = abs(x);
      if (ax < 0.07 && ax > 0.004 && y > yE - 0.03 && y < yE + 0.03) d = eyeCarve(d, x, y, z);
      if (y < yS + 0.016 && y > yS - 0.006 && ax < 0.022) { const dn = nostrilVol(x, y, z); if (dn < 0.01) d = smax(d, -dn, 0.0008); }
      if (y < yM + 0.022 && y > yM - 0.024 && ax < mw + 0.01) { const mv = mouthVol(x, y, z); if (mv < 0.01) d = smax(d, -mv, 0.0005); }
    }
    return d;
  }

  // dominant tissue at a surface point (for colour masks)
  function part(x, y, z) {
    const ax = abs(x);
    if (ax > 0.05 && y > 0.015 && y < 0.135 && z < 0.035 && z > -0.055 && ear.dist(x, y, z) < 0.0012) return PART.EAR;
    if (y < nk.y1 + 0.002) return PART.NECKCAP;
    if (z > 0.035) {
      if (mouthVol(x, y, z) < 0.0008) return PART.MOUTH;
      if (nostrilVol(x, y, z) < 0.0006) return PART.NOSTRIL;
      if (ax > 0.004 && ax < 0.06 && abs(y - yE) < 0.03) {
        const side = x >= 0 ? 1 : -1;
        const ex = side * x - E.x, ey = y - (E.y + side * asym.eyeDy), ez = z - (E.z + side * asym.eyeDz);
        const r = sqrt(ex * ex + ey * ey + ez * ez);
        const ca = fis.am + 0.1, cb = fis.bm - 0.01, crr = Re + 0.0004;
        const car = ell(ex - crr * sin(ca) * cos(cb), ey - crr * sin(cb), ez - crr * cos(ca) * cos(cb), 0.0018, 0.0016, 0.0016);
        if (car < 0.0004) return PART.CARUNCLE;
        if (r < Re + 0.0006) return PART.LIDINNER;
      }
    }
    return PART.SKIN;
  }
  /** vermilion mask 0..1 at a canonical surface point (front view coordinates) */
  function lipMask(x, y) {
    const xs = x - asym.mouthDx;
    const a = abs(xs) / mw;
    if (a > 1.05) return 0;
    const ys = stomion(xs);
    const v = y - ys;
    const top = vermU(xs), bot = vermL(xs);
    const eu = (top - v) / 0.0005, el = (v + bot) / 0.0007, lat = (1.0 - a) / 0.04;
    const k = clamp(min(eu, el, lat), 0, 1);
    return k * k * (3 - 2 * k);
  }

  return {
    m, sdf, sdfBase, part, E, Re, lidPack, nk, ear,
    H: (x, y) => Hs(x, y)[0], W: (y, z) => Ws(y, z)[0],
    stomion, vermU, vermL, arcZ, lipMask, mouthVol, nostrilVol,
  };
}

// ---------------------------------------------------------------------------------------------
// ear: lateral relief plate (helix, scapha, antihelix + crura, triangular fossa, concha, tragus,
// antitragus, lobule, canal) on a 2D grid in ear coordinates (u up the ear axis, v forward,
// w lateral), placed on each side of the head.
// ---------------------------------------------------------------------------------------------
function buildEar(m) {
  const S = m.earS;
  const H = 0.0625 * S, Wd = 0.033 * S;
  const NU = 64, NV = 36;
  const u0 = -H * 0.56, u1 = H * 0.56, v0 = -Wd * 0.78, v1 = Wd * 0.64;
  const du = (u1 - u0) / NU, dv = (v1 - v0) / NV;
  const OUT = new Float32Array((NU + 1) * (NV + 1)), HL = new Float32Array(OUT.length), HM = new Float32Array(OUT.length);
  const outline = (u, v) => {
    const un = u / (H * 0.5);
    const top = un > 0;
    const halfW = Wd * 0.5 * (top ? pow(max(0, 1 - pow(abs(un), 2.4)), 0.42) : pow(max(0, 1 - pow(abs(un), 2.0)), 0.5) * mix(1, 0.68, smoothstep(0.3, 1, -un)));
    const vc = -Wd * 0.08 + (top ? -0.08 * Wd * un : 0.06 * Wd * un);
    return max(abs(v - vc) - halfW, (abs(u) - H * 0.5) * 0.6);
  };
  const rimR = 0.0033 * S;
  for (let j = 0; j <= NU; j++) {
    for (let i = 0; i <= NV; i++) {
      const u = u0 + j * du, v = v0 + i * dv;
      const o = outline(u, v);
      const k = j * (NV + 1) + i;
      OUT[k] = o;
      const un = u / (H * 0.5), vn = (v + Wd * 0.08) / (Wd * 0.5);
      const din = -o;
      const frontEdge = vn > 0.35 && un < 0.45;
      let h = 0.0026 * S;
      const rim = frontEdge ? 0 : exp(-pow((din - rimR) / (rimR * 0.85), 2)) * 0.0042 * S;
      const scapha = frontEdge ? 0 : exp(-pow((din - rimR * 2.5) / (rimR * 0.9), 2)) * -0.0018 * S;
      const ahC = -0.28 + 0.12 * un;
      const ah = exp(-pow((vn - ahC) / 0.16, 2)) * smoothstep(-0.55, -0.1, un) * smoothstep(0.62, 0.3, un) * 0.0034 * S;
      const crusU = exp(-pow((vn - (0.05 + 0.6 * (un - 0.3))) / 0.13, 2)) * smoothstep(0.2, 0.4, un) * smoothstep(0.85, 0.6, un) * 0.0026 * S;
      const crusL = exp(-pow((un - 0.32 - 0.25 * (vn + 0.1)) / 0.09, 2)) * smoothstep(-0.25, 0.1, vn) * smoothstep(0.7, 0.4, vn) * 0.0024 * S;
      const cu = (un + 0.08) / 0.34, cv = (vn - 0.2) / 0.34;
      const conch = -exp(-pow(cu * cu + cv * cv, 1.4) * 1.2) * 0.0072 * S;
      const canal = -exp(-((un + 0.12) ** 2 + (vn - 0.42) ** 2) / 0.012) * 0.006 * S;
      const trag = exp(-(((un + 0.12) / 0.12) ** 2 + ((vn - 0.66) / 0.1) ** 2)) * 0.0048 * S;
      const atr = exp(-(((un + 0.42) / 0.09) ** 2 + ((vn - 0.08) / 0.16) ** 2)) * 0.0036 * S;
      const lobe = smoothstep(-0.5, -0.8, un) * 0.0012 * S;
      const crusH = exp(-pow((un - 0.18 + 0.2 * (vn - 0.5)) / 0.06, 2)) * smoothstep(0.1, 0.5, vn) * smoothstep(0.85, 0.6, vn) * 0.0026 * S;
      h += rim + scapha + ah + crusU + crusL + conch + canal + trag + atr + lobe + crusH;
      HL[k] = h;
      HM[k] = -0.0012 * S - 0.003 * S * smoothstep(0.2, 0.8, vn);
    }
  }
  const sample = (A, u, v) => {
    let fj = (u - u0) / du, fi = (v - v0) / dv;
    fj = clamp(fj, 0, NU - 0.001); fi = clamp(fi, 0, NV - 0.001);
    const j = fj | 0, i = fi | 0, a = fj - j, b = fi - i;
    const k = j * (NV + 1) + i;
    return (A[k] * (1 - b) + A[k + 1] * b) * (1 - a) + (A[k + NV + 1] * (1 - b) + A[k + NV + 2] * b) * a;
  };
  const tilt = 0.27;
  const cyE = 0.0705 + 0.002 * m.child, czE = -0.0095;
  const outA = m.earOutA;
  const ct = cos(tilt), st = sin(tilt), ca = cos(outA), sa = sin(outA);
  const baseX = m.headW - 0.0048;
  function local(x, y, z) {
    const side = x >= 0 ? 1 : -1;
    const lx = side * x, ly = y - (cyE + side * m.asym.earDy), lz = z - czE;
    const u = ly * ct - lz * st;
    const v_ = ly * st + lz * ct;
    const w0 = lx - baseX;
    return [u, v_ * ca + w0 * sa, -v_ * sa + w0 * ca];
  }
  function dist(x, y, z) {
    const [u, v, w] = local(x, y, z);
    if (u < u0 || u > u1 || v < v0 || v > v1) return 1;
    const o = sample(OUT, u, v);
    const hl = sample(HL, u, v), hm = sample(HM, u, v);
    const e = 0.0006;
    const gu = (sample(HL, u + e, v) - sample(HL, u - e, v)) / (2 * e), gv = (sample(HL, u, v + e) - sample(HL, u, v - e)) / (2 * e);
    const dl = (w - hl) / sqrt(1 + gu * gu + gv * gv);
    let d = smax(dl, hm - w, 0.0015);
    return smax(d, o, 0.0022);
  }
  function union(d, x, y, z) {
    const de = dist(x, y, z);
    if (de > 0.02) return d;
    return smin(d, de, 0.0032);
  }
  return { dist, union, local, H, Wd, cy: cyE, cz: czE, baseX };
}

/** spec landmarks in canonical space (before scaling by m.S) */
export function landmarks(m, F) {
  const L = {};
  L.eyeL = [m.eyeX, m.eyeY + m.asym.eyeDy, m.eyeZ + m.asym.eyeDz];
  L.eyeR = [-m.eyeX, m.eyeY - m.asym.eyeDy, m.eyeZ - m.asym.eyeDz];
  L.noseTip = [m.asym.noseDx + m.asym.tipDx, m.tipY, m.tipZ];
  L.mouth = [m.asym.mouthDx, m.stoY, m.lipZ];
  L.chin = [0, m.pogY - 0.004, m.pogZ - 0.004];
  L.crown = [0, m.crownY, -0.008];
  L.earL = [m.headW + 0.006, F.ear.cy + m.asym.earDy, F.ear.cz];
  L.earR = [-m.headW - 0.006, F.ear.cy - m.asym.earDy, F.ear.cz];
  return L;
}
