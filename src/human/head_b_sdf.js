// AFTERZERO head_b: anatomical signed distance field of a human head (our own construction).
// The head is sculpted from anatomical masses blended with smooth-min / smooth-max:
//   base   : cranium (superellipsoid with occipital and parietal shaping), a face block whose front
//            is a profile-driven relief (forehead, orbits, maxilla, dental arch, chin) bounded by the
//            side planes of the face and the sloping submandibular plane, and the neck;
//   masses : brow ridge + glabella, zygoma + zygomatic arch, malar fat pads, masseter, mandible bar
//            (jawline + ramus), chin pad and tubercles, jowls (age), nasal bones/dorsum wedge, tip
//            lobule domes, alae, columella, upper and lower lips (arc-aligned ellipsoids capped by a
//            Cupid's bow), philtral columns, sternocleidomastoids, thyroid cartilage, ears (relief plate);
//   carves : orbit hollows, temporal hollows, nasolabial and mentolabial grooves, nostrils, the
//            palpebral fissures (radial walls around the eyeball = lid margins), mouth slit + cavity.
// Units: metres in canonical adult-male space (scaled by m.S afterwards). +Y up, face toward +Z,
// character left = +X. Pure JS (no three.js) so it runs in node for tests and fitting.

const { sqrt, abs, min, max, exp, sin, cos, atan2, PI, pow, hypot } = Math;

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
export function smin(a, b, k) { if (k <= 0) return a < b ? a : b; const h = k - abs(a - b); if (h <= 0) return a < b ? a : b; const t = h / k; return (a < b ? a : b) - t * t * k * 0.25; }
export function smax(a, b, k) { if (k <= 0) return a > b ? a : b; const h = k - abs(a - b); if (h <= 0) return a > b ? a : b; const t = h / k; return (a > b ? a : b) + t * t * k * 0.25; }
export function gauss(v, s) { const q = v / s; return q * q > 16 ? 0 : exp(-q * q); }

/** approximate ellipsoid distance (iq), exact on the surface, good near it */
export function ell(x, y, z, rx, ry, rz) {
  const ax = x / rx, ay = y / ry, az = z / rz;
  const k0 = sqrt(ax * ax + ay * ay + az * az);
  if (k0 < 1e-9) return -min(rx, ry, rz);
  const bx = ax / rx, by = ay / ry, bz = az / rz;
  const k1 = sqrt(bx * bx + by * by + bz * bz);
  return k0 * (k0 - 1) / k1;
}
/** capsule with linearly varying radius (round cone approximation) */
export function rcap(px, py, pz, ax, ay, az, ra, bx, by, bz, rb) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const t = clamp((pax * bax + pay * bay + paz * baz) / l2, 0, 1);
  const dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
  return sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
}

// monotone cubic interpolation through points [[x,y],...]
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
/** dense lookup table of a 1D function over [a, b] */
function lut(f, a, b, n) {
  const T = new Float64Array(n + 1), d = (b - a) / n;
  for (let i = 0; i <= n; i++) T[i] = f(a + i * d);
  return { T, a, inv: 1 / d, n };
}
function lget(L, v) {
  let f = (v - L.a) * L.inv;
  if (f <= 0) return L.T[0];
  if (f >= L.n) return L.T[L.n];
  const i = f | 0; f -= i;
  return L.T[i] + (L.T[i + 1] - L.T[i]) * f;
}
// bump on [0,1] peaking at p (0..1), value 0 at the ends
export function bump01(t, p, sharp = 1) {
  t = clamp(t, 0, 1);
  const e = Math.log(0.5) / Math.log(p);
  const s = sin(PI * pow(t, e));
  return sharp === 1 ? s : pow(s, sharp);
}

// ---------------------------------------------------------------------------------------------
// model: all anatomical dimensions derived from params (sex, age, shape sliders, traits, seed)
// ---------------------------------------------------------------------------------------------
export const SHAPE_KEYS = ['jaw', 'cheek', 'nose', 'noseWidth', 'lips', 'brow', 'eyeSize', 'faceLength', 'chin'];
// extra internal traits (all optional, -1..1 unless noted). Profiles / likeness fits set these.
export const TRAIT_KEYS = ['lidFold', 'eyeDepth', 'eyeTilt', 'eyeSpacing', 'eyeHeight', 'browHeight', 'noseBridge', 'noseHump', 'noseTip', 'noseLen',
  'noseDeviate', 'mouthWidth', 'upperLip', 'lowerLip', 'lipProtrude', 'philtrum', 'faceWidth', 'cheekFat', 'jawAngle', 'chinHeight', 'forehead',
  'foreheadSlope', 'earSize', 'earOut', 'neck', 'jowl', 'temple', 'zygoma', 'midface', 'mouthY', 'cleft'];

export function makeModel(p) {
  const sex = clamp(p.sex ?? 0, 0, 1);
  const age = clamp(p.age ?? 30, 8, 80);
  const shape = p.shape || {}, tr = p.traits || {};
  const s = k => clamp(+shape[k] || 0, -1, 1);
  const t = k => clamp(+tr[k] || 0, -1.5, 1.5);
  const rnd = mulberry32(((p.seed | 0) + 101) * 7919 + 13);
  const r2 = () => rnd() * 2 - 1;
  const fem = sex, mal = 1 - sex;
  const grown = clamp((age - 8) / 12, 0, 1); // 0 = child (8), 1 = adult (20+)
  const child = 1 - grown;
  const old = clamp((age - 38) / 34, 0, 1);
  const young = clamp((30 - age) / 12, 0, 1) * grown;
  const m = {
    sex, age, fem, mal, old, young, child, grown,
    seed: p.seed | 0, dbg: p._dbg || null,
    S: mix(1, 0.935, fem) * mix(0.89, 1, grown),
    jaw: s('jaw'), cheek: s('cheek'), nose: s('nose'), noseW: s('noseWidth'), lips: s('lips'),
    brow: s('brow'), eyeSize: s('eyeSize'), faceLen: s('faceLength'), chin: s('chin'),
  };
  for (const k of TRAIT_KEYS) m[k] = t(k);
  const J = m.jaw, C = m.chin, CK = m.cheek, FL = m.faceLen, B = m.brow;
  // a few seeded natural variations that every head gets (on top of the sliders)
  const v = { face: r2() * 0.35, nose: r2() * 0.35, lip: r2() * 0.3, eye: r2() * 0.3, ear: r2() * 0.4, brow: r2() * 0.3, chin: r2() * 0.3 };
  m.var = v;

  // ---- vertical layout (y) ----
  const lowerScale = (1 + 0.075 * FL + 0.02 * m.midface) * mix(1, 0.86, child) * mix(1, 0.965, fem);
  const midScale = (1 + 0.05 * FL + 0.05 * m.midface) * mix(1, 0.88, child) * mix(1, 0.97, fem);
  m.eyeY = 0.0855 + 0.002 * m.eyeHeight + 0.004 * child;
  m.browY = m.eyeY + 0.0215 + 0.003 * m.browHeight + 0.0025 * fem - 0.002 * B * mal;
  m.sellY = m.eyeY + 0.002;
  m.noseBaseY = m.eyeY - 0.0545 * midScale - 0.003 * m.noseLen; // subnasale
  m.tipY = m.noseBaseY + 0.0115 + 0.0025 * m.nose - 0.003 * m.noseTip * -1;
  m.mouthY = m.noseBaseY - (0.0235 + 0.002 * m.philtrum) * lowerScale + 0.002 * m.mouthY;
  m.chinY = m.mouthY - (0.0505 + 0.004 * m.chinHeight + 0.003 * C) * lowerScale; // menton
  m.crownY = 0.196 + 0.004 * m.forehead;
  m.hairY = m.browY + 0.06 + 0.006 * m.forehead;

  // ---- depth (z) and widths ----
  const deep = m.eyeDepth + 0.35 * B * mal; // deep-set eyes under a heavy brow
  m.eyeX = (0.0318 + 0.0012 * m.eyeSpacing + 0.0006 * v.eye) * mix(1, 0.97, child);
  m.eyeZ = 0.0745 - 0.0016 * deep + 0.001 * child;
  m.Re = 0.0119 * mix(1, 0.97, child);
  m.glabZ = 0.1005 + 0.0022 * B * mal - 0.0015 * fem + 0.0006 * m.foreheadSlope;
  m.sellZ = m.eyeZ + 0.0215 + 0.0032 * m.noseBridge + 0.0008 * deep - 0.002 * child;
  m.tipZ = 0.1195 + 0.0055 * m.nose - 0.004 * child - 0.0015 * fem + 0.0015 * v.nose;
  m.subZ = 0.1015 - 0.0005 * child;
  m.alarHW = (0.0172 + 0.0028 * m.noseW + 0.0005 * v.nose) * mix(1, 0.94, fem) * mix(1, 0.86, child);
  m.mouthHW = (0.0262 + 0.0018 * m.mouthWidth + 0.0006 * m.lips) * mix(1, 0.965, fem) * mix(1, 0.9, child);
  m.lipZ = 0.1012 + 0.0012 * m.lipProtrude + 0.0006 * m.lips;
  m.upperH = (0.0082 + 0.0022 * m.lips + 0.0012 * m.upperLip + 0.0014 * fem) * (1 - 0.32 * old) * mix(1, 0.85, child);
  m.lowerH = (0.0098 + 0.0024 * m.lips + 0.0014 * m.lowerLip + 0.0012 * fem) * (1 - 0.22 * old) * mix(1, 0.85, child);
  m.chinZ = 0.0935 + 0.0045 * C - 0.002 * fem - 0.004 * child + 0.0008 * v.chin;
  m.chinW = (0.0155 + 0.003 * J * mal + 0.0015 * C) * mix(1, 0.88, fem);
  m.gonX = (0.0505 + 0.0045 * J + 0.0012 * m.faceWidth) * mix(1, 0.9, fem) * mix(1, 0.92, child);
  m.gonY = -0.004 + 0.003 * m.jawAngle - 0.002 * J + 0.004 * fem + 0.004 * child;
  m.gonZ = -0.004 + 0.002 * J;
  m.jawRound = mix(0.0085, 0.013, fem) * (1 - 0.25 * J) + 0.006 * child + 0.004 * old;
  m.zygX = (0.0675 + 0.003 * CK + 0.0025 * m.faceWidth + 0.001 * m.zygoma) * mix(1, 0.97, fem);
  m.cheekPro = 0.0035 * CK + 0.0015 * m.zygoma + 0.002 * fem;
  m.cheekFull = 0.6 + 0.25 * m.cheekFat + 0.35 * young + 0.5 * child + 0.2 * fem - 0.35 * old - 0.15 * mal * CK;
  m.headW = (0.0755 + 0.0015 * m.faceWidth) * mix(1, 0.985, fem);
  m.neckR = (0.056 + 0.004 * m.neck) * mix(1, 0.84, fem) * mix(1, 0.82, child);

  // eye fissure (angles around the eyeball centre); eyeSize scales it
  const es = 1 + 0.11 * m.eyeSize + 0.05 * child + 0.03 * fem - 0.06 * old;
  m.fis = {
    am: -1.2 * mix(1, 1.03, fem), al: 1.27 * (1 + 0.04 * m.eyeSize),
    bm: -0.05, bl: 0.02 + 0.07 * m.eyeTilt + 0.04 * fem + 0.02 * v.eye,
    up: 0.43 * es * (1 - 0.12 * m.lidFold * (m.lidFold > 0 ? 1 : 0)) - 0.05 * old, upPeak: 0.43, lo: 0.41 * es, loPeak: 0.56,
  };
  m.lidT = 0.0019;
  m.lidFoldAmt = m.lidFold; // >0 hooded/monolid, <0 deep crease

  // ---- asymmetry (left = +x, right = -x) ----
  const as = 0.6 + 0.4 * old;
  m.asym = {
    eyeDy: r2() * 0.0008 * as, browDy: r2() * 0.0012 * as, mouthDy: r2() * 0.0006 * as, noseDx: (r2() * 0.0006 + 0.0025 * m.noseDeviate),
    jawDx: r2() * 0.0012, earDy: r2() * 0.0018, cheekD: r2() * 0.0008, tipDx: r2() * 0.0005 + 0.0015 * m.noseDeviate,
  };
  m.nose_ = { hump: 0.0009 * m.noseHump + 0.0004 * mal + 0.0006 * old, bridgeW: 0.0056 + 0.0012 * m.noseW + 0.001 * mal - 0.0008 * child, tipW: (0.0079 + 0.0012 * m.noseW + 0.0006 * m.nose) * mix(1, 0.9, fem), tipUp: m.noseTip };
  m.earS = (1 + 0.06 * m.earSize + 0.04 * v.ear + 0.08 * old) * mix(1, 0.93, fem) * mix(1, 0.92, child);
  m.earOutA = 0.33 + 0.12 * m.earOut + 0.05 * v.ear;
  m.brow_ = { amt: (0.0034 + 0.0024 * B) * mix(1, 0.3, fem) * mix(1, 0.3, child), w: 0.019 };
  m.fh = { slope: 0.5 * m.foreheadSlope + 0.4 * mal - 0.2 * child };
  return m;
}

// ---------------------------------------------------------------------------------------------
// field
// ---------------------------------------------------------------------------------------------
// part ids returned by field.part(): which tissue a surface point belongs to
export const PART = { SKIN: 0, LIP: 1, MOUTH: 2, NOSTRIL: 3, EAR: 4, LIDINNER: 5, CARUNCLE: 6, NECKCAP: 7 };

export function makeField(m) {
  const fem = m.fem, mal = m.mal, old = m.old, child = m.child, young = m.young;
  const E = { x: m.eyeX, y: m.eyeY, z: m.eyeZ };
  const Re = m.Re;
  const FL = m.faceLen;

  // ---- midline base profile P(y): front of the face block at x = 0 (no nose/lips) ----
  const yE = m.eyeY, yN = m.noseBaseY, yM = m.mouthY, yC = m.chinY;
  const prof = spline([
    [m.crownY + 0.02, -0.02],
    [m.hairY + 0.03, 0.058 - 0.01 * m.fh.slope],
    [m.hairY + 0.012, 0.0785 - 0.006 * m.fh.slope],
    [m.hairY - 0.012, 0.0905 - 0.0025 * m.fh.slope],
    [m.browY + 0.02, m.glabZ - 0.0028 - 0.0012 * m.fh.slope],
    [m.browY + 0.002, m.glabZ],
    [m.sellY + 0.006, m.glabZ - 0.0032],
    [m.sellY - 0.004, m.sellZ - 0.0035],
    [yE - 0.022, m.sellZ - 0.007],
    [yN + 0.008, m.subZ - 0.008],
    [yN, m.subZ - 0.0045],
    [yN - 0.008, m.lipZ - 0.0025],
    [yM + 0.006, m.lipZ - 0.0045],
    [yM, m.lipZ - 0.0065],
    [yM - 0.007, m.lipZ - 0.0075],
    [yM - 0.016, m.chinZ - 0.0055 - 0.0012 * m.lips],
    [yC + 0.017, m.chinZ - 0.0028],
    [yC + 0.009, m.chinZ - 0.004],
    [yC + 0.002, m.chinZ - 0.0115],
    [yC - 0.006, m.chinZ - 0.03],
  ]);
  const Y0 = yC - 0.03, Y1 = m.crownY + 0.03;
  const P = lut(prof, Y0, Y1, 900);

  // ---- lateral recession of the face front, as even polynomials a x^2 + b x^4 + c x^6 per level ----
  // targets: recession (m) at x = 0.02, 0.04, 0.06 for key heights
  const fw = 1 - 0.05 * m.faceWidth - 0.04 * child + 0.03 * fem; // rounder/wider face -> less recession
  const cf = m.cheekFull;
  const levels = [
    [m.hairY + 0.02, 0.0042, 0.017, 0.042],
    [m.browY + 0.03, 0.0032, 0.0125, 0.032],
    [m.browY, 0.0022, 0.0085, 0.026],
    [yE, 0.0035, 0.0125, 0.036],
    [yE - 0.022, 0.0042, 0.0135, 0.033],
    [yN + 0.004, 0.0064, 0.0168 - 0.002 * cf, 0.034 - 0.003 * cf],
    [yM + 0.012, 0.0048, 0.0175 - 0.002 * cf, 0.038 - 0.003 * cf],
    [yM - 0.004, 0.0046, 0.0185 - 0.0015 * cf, 0.043],
    [yM - 0.02, 0.0050, 0.0205, 0.049],
    [yC + 0.012, 0.0062, 0.0245, 0.058],
    [yC, 0.0085, 0.031, 0.066],
  ];
  const coefs = levels.map(([y, r1, r2, r3]) => {
    r1 *= fw; r2 *= fw; r3 *= fw;
    // solve [x^2 x^4 x^6] [a b c]^T = r for x = .02 .04 .06
    const X = [0.02, 0.04, 0.06].map(x => [x * x, x ** 4, x ** 6]);
    const R = [r1, r2, r3];
    // gaussian elimination 3x3
    const A = X.map((row, i) => [...row, R[i]]);
    for (let c = 0; c < 3; c++) {
      let piv = c; for (let r = c + 1; r < 3; r++) if (abs(A[r][c]) > abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]];
      for (let r = 0; r < 3; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k]; }
    }
    return [y, A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
  });
  const ca = lut(spline(coefs.map(c => [c[0], c[1]])), Y0, Y1, 600);
  const cb = lut(spline(coefs.map(c => [c[0], c[2]])), Y0, Y1, 600);
  const cc = lut(spline(coefs.map(c => [c[0], c[3]])), Y0, Y1, 600);
  // side planes of the face block (half width by height)
  const sideW = lut(spline([
    [m.crownY + 0.01, 0.0], [m.hairY + 0.035, m.headW - 0.03], [m.hairY + 0.015, m.headW - 0.014], [m.browY, m.headW - 0.006], [yE, m.zygX - 0.002], [yE - 0.025, m.zygX],
    [yN - 0.01, m.zygX - 0.006], [yM, mix(m.zygX - 0.006, m.gonX + 0.005, 0.6)], [yM - 0.02, m.gonX + 0.002], [yC, m.gonX - 0.004],
  ]), Y0, Y1, 400);

  function faceFront(ax, y) {
    const x2 = ax * ax, x4 = x2 * x2;
    return lget(P, y) - (lget(ca, y) * x2 + lget(cb, y) * x4 + lget(cc, y) * x4 * x2);
  }

  // submandibular plane through the menton and the gonion: y = yb(z)
  const mentZ = m.chinZ - 0.014;
  const slopeB = (m.gonY - (yC + 0.001)) / (m.gonZ - mentZ);

  // ---- cranium: superellipsoid ----
  const cr = { cx: 0, cy: 0.099 + 0.002 * m.forehead, cz: -0.0115, rx: m.headW + 0.001, ry: m.crownY - 0.099, rz: 0.0955 - 0.002 * fem };
  function cranium(x, y, z) {
    const dy = y - cr.cy, dz = z - cr.cz;
    // flatter sides, fuller back-top (parietal), slightly narrower forehead
    const back = clamp(-dz / cr.rz, 0, 1);
    const rx = cr.rx * (1 - 0.06 * clamp(dz / cr.rz, 0, 1) - 0.1 * clamp(-dy / cr.ry, 0, 1) * (1 - back * 0.6));
    const rz = cr.rz * (1 + 0.035 * clamp(-dy / cr.ry + 0.2, 0, 1) * back);
    return ell(x, dy, dz, rx, cr.ry, rz);
  }

  // ---- neck ----
  const nk = { y0: 0.035, y1: -0.115, z0: -0.016, z1: -0.004, rx: m.neckR * 1.04, rz: m.neckR * 0.93 };
  function neck(x, y, z) {
    const t = clamp((nk.y0 - y) / (nk.y0 - nk.y1), 0, 1);
    const zc = mix(nk.z0, nk.z1, t);
    const flare = 1 + 0.12 * smoothstep(0.55, 1, t) + 0.05 * smoothstep(0.35, 0, t);
    const ex = x / (nk.rx * flare), ez = (z - zc) / (nk.rz * flare);
    const rr = sqrt(ex * ex + ez * ez);
    const dr = (rr - 1) * nk.rz * flare;
    const dcap = max(y - (nk.y0 + 0.02), (nk.y1 - 0.01) - y);
    return max(dr, dcap);
  }

  // ---- face block ----
  function faceBlock(x, y, z) {
    const ax = abs(x);
    const F = faceFront(ax, y);
    // gradient of F for distance normalisation
    const e = 0.0004;
    const Fx = (faceFront(ax + e, y) - F) / e, Fy = (faceFront(ax, y + e) - faceFront(ax, y - e)) / (2 * e);
    const dFront = (z - F) / sqrt(1 + Fx * Fx + Fy * Fy);
    const W = lget(sideW, y);
    const dSide = ax - W + 0.12 * min(0, z - 0.02); // sides open slightly toward the back
    const yb = yC + 0.001 + slopeB * (z - mentZ);
    const dBot = (yb - y) / sqrt(1 + slopeB * slopeB);
    const dBack = -0.03 - z;
    let d = smax(dFront, dSide, 0.02);
    d = smax(d, dBot, m.jawRound * 1.6);
    d = smax(d, dBack, 0.02);
    // above the eyes the face block is clipped to a slightly expanded cranium (rounded forehead/top)
    if (y > yE - 0.035) {
      const clip = ell(x, y - cr.cy, z - (cr.cz + 0.012), cr.rx - 0.002, cr.ry + 0.001, cr.rz + 0.013) - 0.06 * smoothstep(yE + 0.012, yE - 0.035, y);
      d = smax(d, clip, 0.016);
    }
    return d;
  }

  // ---- eye region ----
  const fis = m.fis;
  const lidCache = { up: null, lo: null };
  // lid margin elevations as functions of azimuth (precomputed tables)
  const NA = 256;
  const upT = new Float64Array(NA + 1), loT = new Float64Array(NA + 1);
  for (let i = 0; i <= NA; i++) {
    const tt = i / NA;
    const base = mix(fis.bm, fis.bl, tt);
    upT[i] = base + (fis.up - base * 0) * bump01(tt, fis.upPeak, 0.85) * 1;
    loT[i] = base - fis.lo * bump01(tt, fis.loPeak, 0.9);
  }
  lidCache.up = upT; lidCache.lo = loT;
  function lidAt(alpha) { // returns [up, lo, t] elevation of the margins at azimuth alpha (lateral +)
    const tt = (alpha - fis.am) / (fis.al - fis.am);
    const f = clamp(tt, 0, 1) * NA, i = min(NA - 1, f | 0), u = f - i;
    return [upT[i] + (upT[i + 1] - upT[i]) * u, loT[i] + (loT[i + 1] - loT[i]) * u, tt];
  }
  m.lidAt = lidAt;

  function eyeLocal(x, y, z, side) { // side +1 left, -1 right
    const ex = side * x - E.x, ey = y - (E.y + side * m.asym.eyeDy), ez = z - E.z;
    const h = sqrt(ex * ex + ez * ez);
    return { ex, ey, ez, r: sqrt(ex * ex + ey * ey + ez * ez), al: atan2(ex, ez), be: atan2(ey, h) };
  }

  // ---- eye region relief ----
  // Around each eyeball the skin is described as a radial surface R(alpha, beta) about the eyeball
  // centre: lid margins (thickness lidT) on the fissure curves, tarsal platform, crease and upper
  // sulcus, lower-lid pretarsal roll and lid-cheek junction, canthal corners. Away from the lids it
  // relaxes onto the base face (sampled by marching rays through the base field), so it blends
  // seamlessly into brow, nose side and cheek. The fissure is then cut with radial walls.
  const EA0 = -1.75, EA1 = 2.05, EB0 = -1.35, EB1 = 1.4, ENA = 48, ENB = 40;
  const eyeGrid = { 1: null, '-1': null };
  function buildEyeGrid(side, base) {
    const R = new Float32Array((ENA + 1) * (ENB + 1)), AD = new Float32Array(R.length);
    const cy = E.y + side * m.asym.eyeDy;
    const fold = m.lidFoldAmt, deep = clamp(m.eyeDepth + 0.4 * m.brow * mal, -1, 1.5);
    const rL = Re + m.lidT;
    const crease = (0.44 + 0.06 * deep - 0.1 * max(0, fold) + 0.03 * child) * (1 - 0.1 * old);
    const creaseD = (0.00075 + 0.0005 * max(0, deep) + 0.0002 * young) * clamp(1 - fold, 0, 1.3);
    const sulc = (0.0007 + 0.0012 * max(0, deep) + 0.0006 * old) * clamp(1 - 0.8 * max(0, fold), 0, 1);
    const hood = 0.0011 * max(0, fold) + 0.0005 * old;
    for (let j = 0; j <= ENB; j++) {
      const be = EB0 + (EB1 - EB0) * j / ENB;
      for (let i = 0; i <= ENA; i++) {
        const al = EA0 + (EA1 - EA0) * i / ENA;
        const k = j * (ENA + 1) + i;
        // direction (left-eye local; mirrored by side)
        const dx = sin(al) * cos(be), dy = sin(be), dz = cos(al) * cos(be);
        // march outward from near the eyeball centre to the first crossing of the base surface
        let r = 0.0075, f = base(side * (E.x + dx * r), cy + dy * r, E.z + dz * r);
        const s0 = f >= 0;
        let hit = 0.045;
        for (let it = 0; it < 60 && r < 0.045; it++) {
          const prev = r;
          r += max(abs(f) * 0.8, 0.0005);
          f = base(side * (E.x + dx * r), cy + dy * r, E.z + dz * r);
          if ((f >= 0) !== s0) {
            let a = prev, b = r;
            for (let q = 0; q < 6; q++) { const c = (a + b) * 0.5; if ((base(side * (E.x + dx * c), cy + dy * c, E.z + dz * c) >= 0) === s0) a = c; else b = c; }
            hit = (a + b) * 0.5; break;
          }
        }
        const Rf = hit;
        // lid design: upper and lower branches blended smoothly across the fissure line
        const L = lidAt(al);
        const dA = al < fis.am ? fis.am - al : al > fis.al ? al - fis.al : 0;
        const dU = be - L[0], dL = L[1] - be;
        const inMed = smoothstep(fis.am - 0.05, fis.am + 0.25, al); // no sulcus medial of the canthus
        let Ru, Rd;
        {
          const u = max(0, dU);
          let rr = rL + 0.0005 * smoothstep(0, 0.3, u) - creaseD * inMed * exp(-(((u - crease) / 0.055) ** 2));
          const sb = smoothstep(crease, crease + 0.5, u);
          const bowl = sulc * inMed * bump01(clamp((u - crease) / 0.55, 0, 1), 0.35);
          rr = mix(rr, max(Rf, rr), sb) - bowl * (1 - sb * 0.6);
          rr += hood * smoothstep(crease - 0.25, crease + 0.05, u) * (1 - smoothstep(crease + 0.2, crease + 0.6, u));
          Ru = rr;
        }
        {
          const u = max(0, dL);
          let rr = rL + 0.0008 * bump01(clamp(u / 0.32, 0, 1), 0.4) + 0.0004 * smoothstep(0.0, 0.25, u);
          const sb = smoothstep(0.18, 0.7, u);
          rr = mix(rr, max(Rf, rr - 0.0008), sb);
          rr -= (0.0003 + 0.0009 * old) * exp(-(((u - 0.6) / 0.12) ** 2)) * inMed; // lid-cheek junction / tear trough
          Rd = rr;
        }
        let Rl = mix(Rd, Ru, smoothstep(-0.1, 0.1, dU - dL));
        // canthal corners: lids merge, then relax onto the base face
        if (dA > 0) Rl = mix(Rl, max(Rf, Rl), smoothstep(0.0, 0.16, dA));
        // far from the fissure follow the base face (the orbit hollow)
        const angD = max(dU, dL, dA * 1.3);
        const far = smoothstep(0.5, 0.78, angD);
        R[k] = mix(Rl, Rf, far);
        AD[k] = angD;
      }
    }
    // gradient factor of the radial field: 1/sqrt(1 + |grad_angle R|^2 / R^2)
    const Gn = new Float32Array(R.length);
    const da = (EA1 - EA0) / ENA, db = (EB1 - EB0) / ENB;
    for (let j = 0; j <= ENB; j++) for (let i = 0; i <= ENA; i++) {
      const k = j * (ENA + 1) + i;
      const i0 = max(0, i - 1), i1 = min(ENA, i + 1), j0 = max(0, j - 1), j1 = min(ENB, j + 1);
      const be = EB0 + db * j;
      const gA = (R[j * (ENA + 1) + i1] - R[j * (ENA + 1) + i0]) / ((i1 - i0) * da * max(0.2, cos(be)));
      const gB = (R[j1 * (ENA + 1) + i] - R[j0 * (ENA + 1) + i]) / ((j1 - j0) * db);
      const rr = max(R[k], 0.008);
      Gn[k] = 1 / sqrt(1 + (gA * gA + gB * gB) / (rr * rr));
    }
    return { R, Gn, AD };
  }
  function eyeSample(G, al, be) {
    let fi = (al - EA0) / (EA1 - EA0) * ENA, fj = (be - EB0) / (EB1 - EB0) * ENB;
    if (fi < 0 || fj < 0 || fi > ENA || fj > ENB) return null;
    fi = min(fi, ENA - 0.0001); fj = min(fj, ENB - 0.0001);
    const i = fi | 0, j = fj | 0, a = fi - i, b = fj - j, k = j * (ENA + 1) + i;
    const bl = (T) => (T[k] * (1 - a) + T[k + 1] * a) * (1 - b) + (T[k + ENA + 1] * (1 - a) + T[k + ENA + 2] * a) * b;
    return [bl(G.R), bl(G.Gn), bl(G.AD)];
  }
  function eyeSide(d, x, y, z, side) {
    const ex = side * x - E.x, ey = y - (E.y + side * m.asym.eyeDy), ez = z - E.z;
    const r2 = ex * ex + ey * ey + ez * ez;
    if (r2 > 0.05 * 0.05 || r2 < 1e-10) return d;
    const r = sqrt(r2);
    const al = atan2(ex, ez), be = atan2(ey, sqrt(ex * ex + ez * ez));
    const G = eyeGrid[side];
    const sm = G ? eyeSample(G, al, be) : null;
    if (sm) {
      // replace the base by the eye relief inside the region W: a cone of directions around the
      // lids (angular distance < 0.85 rad) out to r = 0.03; the relief equals the base at its edge
      const dW = max((sm[2] - 0.85) * r, r - 0.03);
      const dE = (r - sm[0]) * sm[1];
      d = smin(smax(d, -dW, 0.0012), smax(dE, dW, 0.0012), 0.0012);
    }
    // palpebral fissure: radial window between the lid margins (= lid margin walls)
    const L = lidAt(al);
    const tt = L[2];
    let w2;
    if (tt <= 0 || tt >= 1) w2 = max(fis.am - al, al - fis.al) * r;
    else w2 = max(be - L[0], L[1] - be) * r;
    const wc = max(fis.am - al, al - fis.al) * r;
    w2 = smax(w2, wc, 0.0012);
    const carve = max(w2, max((Re - 0.0006) - r, r - (Re + 0.012)));
    d = smax(d, -carve, 0.0005);
    // caruncle at the medial corner
    const car = ell(ex + 0.0112, ey + 0.0003, ez - 0.0048, 0.0022, 0.0017, 0.0018);
    d = smin(d, car, 0.0006);
    return d;
  }

  // ---- nose ----
  const nose = m.nose_;
  const sell = { y: m.sellY, z: m.sellZ };
  const supra = { y: m.tipY + 0.0085, z: m.tipZ - 0.0052 };
  const dorsDy = supra.y - sell.y, dorsDz = supra.z - sell.z;
  const dorsL = hypot(dorsDy, dorsDz);
  const dny = dorsDy / dorsL, dnz = dorsDz / dorsL; // along the dorsum (downward-forward)
  function noseMass(d, x, y, z) {
    if (y > sell.y + 0.03 || y < m.noseBaseY - 0.012 || z < m.sellZ - 0.03 || abs(x) > 0.035) return d;
    const xd = x - m.asym.noseDx * smoothstep(sell.y, m.tipY, y);
    const ax = abs(xd);
    // dorsum wedge: ridge line from sellion to supratip, with a gentle hump
    const ty = y - sell.y, tz = z - sell.z;
    const along = ty * dny + tz * dnz; // distance along the dorsum from sellion
    const u = clamp(along / dorsL, -0.3, 1.2);
    const hump = nose.hump * bump01(clamp(u, 0, 1), 0.42) - 0.0004 * nose.tipUp * bump01(clamp(u, 0, 1), 0.8);
    // perpendicular (in the y-z plane) height above the ridge line (positive = outside)
    const perp = ty * dnz - tz * dny - hump; // outward normal of the dorsum line = (dnz, -dny)
    // half-width of the ridge grows down the nose; sidewall slope
    const bw = mix(nose.bridgeW * 0.62, nose.bridgeW, smoothstep(0, 0.6, u)) + 0.0025 * smoothstep(0.75, 1.1, u);
    // rounded-V cross-section: parabolic ridge of radius ~bw, sidewalls of slope sw (steeper toward the tip)
    const sw = mix(1.15, 2.1, smoothstep(0.05, 0.8, u));
    const rr = bw * 0.9;
    const wedge = (perp + (sqrt(ax * ax + rr * rr) - rr) * sw) / sqrt(1 + sw * sw);
    // bound the wedge to a capsule around the dorsum line (closed volume; the face union hides the back)
    const bound = rcap(xd, y, z, 0, sell.y + 0.006, sell.z - 0.011, 0.012, 0, m.noseBaseY + 0.004, supra.z - 0.016, 0.017);
    let nd = smax(wedge, bound, 0.004);
    nd = smax(nd, (m.noseBaseY + 0.004) - y, 0.006);
    // tip lobule: central mass + paired domes
    const tipDx = m.asym.tipDx;
    const tw = nose.tipW;
    const tipY = m.tipY + 0.0012 * nose.tipUp;
    const lob = ell(xd - tipDx, y - (tipY + 0.0012), z - (m.tipZ - 0.0075), tw, 0.0078, 0.0076);
    const domeL = ell(xd - tipDx - 0.0036, y - (tipY + 0.0006), z - (m.tipZ - 0.0042), 0.0044, 0.0046, 0.0042);
    const domeR = ell(xd - tipDx + 0.0036, y - (tipY + 0.0006), z - (m.tipZ - 0.0042), 0.0044, 0.0046, 0.0042);
    let tip = smin(lob, smin(domeL, domeR, 0.002), 0.0025);
    // columella
    const col = rcap(xd, y, z, 0, m.noseBaseY + 0.0012, m.subZ - 0.0005, 0.0028, tipDx * 0.5, tipY - 0.0035, m.tipZ - 0.0062, 0.0034);
    tip = smin(tip, col, 0.003);
    nd = smin(nd, tip, 0.0065);
    // alae (wings)
    for (const sd of [1, -1]) {
      const cx = sd * (m.alarHW - 0.0058), cy = m.noseBaseY + 0.0068, cz = m.subZ - 0.0035;
      const lx = xd - cx, ly = y - cy, lz = z - cz;
      // rotate about y so the wing points forward-medially toward the tip
      const ang = sd * 0.42, ca = cos(ang), sa = sin(ang);
      const rx = lx * ca - lz * sa, rz = lx * sa + lz * ca;
      const ala = ell(rx, ly + 0.0008 * (rz / 0.009), rz, 0.0058, 0.0056, 0.0102);
      nd = smin(nd, ala, 0.0032);
    }
    d = smin(d, nd, 0.0035);
    return d;
  }
  function nostrilVol(x, y, z) {
    if (y > m.noseBaseY + 0.02 || y < m.noseBaseY - 0.01 || abs(x) > 0.025 || z < m.subZ - 0.01) return 1;
    const xd = x - m.asym.noseDx - m.asym.tipDx * 0.6;
    let dn = 1;
    for (const sd of [1, -1]) {
      const cx = sd * (0.0062 + 0.0012 * m.noseW), cy = m.noseBaseY + 0.0034, cz = m.subZ + 0.0058;
      const lx = xd - cx, ly = y - cy, lz = z - cz;
      const ang = -sd * 0.42, ca = cos(ang), sa = sin(ang);
      const rx = lx * ca - lz * sa, rz = lx * sa + lz * ca;
      dn = min(dn, ell(rx, ly, rz, 0.0029 + 0.0004 * m.noseW, 0.0034, 0.0058));
    }
    return dn;
  }
  function nostrils(d, x, y, z) {
    const dn = nostrilVol(x, y, z);
    return dn > 0.01 ? d : smax(d, -dn, 0.0009);
  }

  // ---- mouth: lips as arc-aligned ellipsoids, slit + cavity carve ----
  const mw = m.mouthHW;
  const arcC = 16 + 4 * child; // curvature of the lip arc (z = lipZ - arcC x^2)
  function lipFrame(x, y, z) {
    const s = x;
    const v = y - (yM + m.asym.mouthDy * (x / mw) + 0.0012 * (x / mw) * (x / mw) * 0);
    const w = z - (m.lipZ - arcC * x * x);
    return [s, v, w];
  }
  function bowTop(s) { // height of the upper vermilion border above the stomion
    const a = abs(s) / mw;
    const peak = 0.21; // Cupid's bow peaks at ~21% of the half width
    const hb = m.upperH;
    const g = a < peak ? mix(0.86, 1.0, smoothstep(0, peak, a)) : mix(1.0, 0.0, pow(smoothstep(peak, 1.04, a), 0.85));
    return hb * g;
  }
  function lips(d, x, y, z) {
    if (abs(x) > mw + 0.012 || y > yM + 0.03 || y < yM - 0.03 || z < m.lipZ - 0.04) return d;
    const [s, v, w] = lipFrame(x, y, z);
    const a = abs(s) / mw;
    // upper lip
    const hu = m.upperH;
    const up = ell(s, v - hu * 0.36, w + 0.0042, mw * 1.02, hu * 0.78, 0.0062);
    const capU = v - bowTop(s);
    const upper = smax(up, capU, 0.0012);
    // philtral columns
    const pc = 0.0052 * (1 + 0.1 * m.philtrum);
    const colL = rcap(x, y, z, pc * 0.92, yM + hu * 0.96, m.lipZ - arcC * pc * pc - 0.0012, 0.0011, pc * 0.55, m.noseBaseY - 0.0005, m.subZ - 0.002, 0.0015);
    const colR = rcap(x, y, z, -pc * 0.92, yM + hu * 0.96, m.lipZ - arcC * pc * pc - 0.0012, 0.0011, -pc * 0.55, m.noseBaseY - 0.0005, m.subZ - 0.002, 0.0015);
    // lower lip
    const hl = m.lowerH;
    const lo = ell(s, v + hl * 0.44, w + 0.0050 + 0.001 * a, mw * 0.93, hl * 0.62, 0.0066);
    d = smin(d, smin(colL, colR, 0.001), 0.0022);
    d = smin(d, upper, 0.0016);
    d = smin(d, lo, 0.0024);
    return d;
  }
  function mouthCarve(d, x, y, z) {
    if (abs(x) > mw + 0.01 || y > yM + 0.025 || y < yM - 0.025 || z < 0.03) return d;
    return smax(d, -mouthVol(x, y, z), 0.0006);
  }
  function mouthVol(x, y, z) {
    if (abs(x) > mw + 0.01 || y > yM + 0.025 || y < yM - 0.025 || z < 0.03) return 1;
    const [s, v, w] = lipFrame(x, y, z);
    const a = abs(s) / mw;
    // slit: thin sheet from the lip front to the cavity, tapering to nothing at the corners
    const half = 0.00075 * clamp((1.0 - a) / 0.12, 0, 1);
    const sheet = max(abs(v + 0.0002) - half, max(a - 1.0, 0) * mw);
    const sheetD = max(sheet, -0.016 - w);
    // cavity behind the teeth line
    const cav = ell(x, y - (yM - 0.0015), z - (m.lipZ - 0.032), mw * 1.05, 0.0115, 0.0235);
    return smin(sheetD, cav, 0.003);
  }

  // ---- ears: relief plate in ear-local coordinates (precomputed 2D grids) ----
  const ear = buildEar(m);

  // ---- assemble ----
  const asym = m.asym;
  const bw = m.brow_;
  function sdfBase(x, y, z) {
    // base volumes
    let d = cranium(x, y, z);
    const fb = faceBlock(x, y, z);
    d = smin(d, fb, 0.016);
    const nkD = neck(x, y, z);
    // nape smoother at the back, crisper jaw-neck angle in front
    const kneck = mix(0.006 + 0.008 * fem + 0.01 * old + 0.006 * child, 0.03, smoothstep(0.01, -0.05, z));
    d = smin(d, nkD, kneck);
    const ax = abs(x);
    // neck muscles (sternocleidomastoid) and thyroid cartilage
    if (y < 0.05 && z > -0.07) {
      for (const sd of [1, -1]) {
        const scm = rcap(x, y, z, sd * 0.05, 0.03, -0.042, 0.0085, sd * 0.014, -0.12, 0.03, 0.0085);
        d = smin(d, scm, 0.014);
      }
      if (mal > 0.3 && y < -0.03) {
        const th = ell(x, y + 0.058 - 0.004 * child, z - (0.039 + 0.0005), 0.0065, 0.0095, 0.0055);
        d = smin(d, th, 0.012 * mal + 0.004);
      }
    }
    if (z > -0.04) {
      // forehead / brow ridge and glabella
      if (y > yE && y < m.browY + 0.03) {
        for (const sd of [1, -1]) {
          const ly = y - (m.browY - 0.002 + sd * asym.browDy);
          const lx = sd * x - 0.025;
          const br = ell(lx, ly + 0.07 * lx * (lx > 0 ? 1 : 0.3), z - (m.glabZ - 0.0105 - 0.18 * lx * lx * 20), bw.w, 0.0072, 0.0095 + bw.amt);
          d = smin(d, br, 0.012);
        }
        const gl = ell(x, y - (m.browY - 0.002), z - (m.glabZ - 0.0062 + bw.amt * 0.4), 0.0125, 0.0085, 0.006);
        d = smin(d, gl, 0.01);
      }
      // temporal hollows
      if (ax > 0.045 && y > yE) {
        const tmp = ell(ax - (m.headW + 0.004), y - (m.browY + 0.008), z - 0.028, 0.009, 0.024, 0.022);
        d = smax(d, -tmp, 0.012 + 0.006 * young);
      }
      // cheeks: zygoma body, arch, malar fat pad, masseter, nasolabial groove, jowls
      if (y < yE + 0.02 && y > yC - 0.01) {
        for (const sd of [1, -1]) {
          const lx = sd * x;
          if (lx < -0.01) continue;
          const zp = m.cheekPro + sd * asym.cheekD;
          const zy = ell(lx - (m.zygX - 0.019), y - (yE - 0.0215), z - (0.0655 + zp), 0.0165, 0.0105, 0.0128);
          d = smin(d, zy, 0.012);
          const arch = rcap(lx, y, z, m.zygX - 0.008, yE - 0.021, 0.046, 0.0042, m.zygX - 0.002, yE - 0.024, -0.003, 0.0046);
          d = smin(d, arch, 0.01);
          const cf = m.cheekFull;
          const sag = 0.004 * old;
          const fat = ell(lx - 0.033, y - (yN + 0.009 - sag), z - (0.0745 + 0.0025 * cf), 0.0175 + 0.002 * cf, 0.0165, 0.009 + 0.002 * cf);
          d = smin(d, fat, 0.013);
          const mas = ell(lx - (m.gonX + 0.0015), y - (yM + 0.004), z - 0.017, 0.0055 + 0.0015 * m.jaw * mal, 0.021, 0.0165);
          d = smin(d, mas, 0.012);
          // nasolabial groove from the alar crease to beside the mouth corner
          const nlA = [m.alarHW + 0.0025, m.noseBaseY + 0.0075, m.subZ - 0.0085];
          const nlB = [mw + 0.0058, yM - 0.0035, m.lipZ - arcC * mw * mw - 0.0068];
          const nl = rcap(lx, y, z, nlA[0], nlA[1], nlA[2], 0.0012, nlB[0], nlB[1], nlB[2], 0.0016);
          d = smax(d, -nl, 0.0042 + 0.003 * old);
          if (old > 0) {
            const jow = ell(lx - (mw + 0.017), y - (yC + 0.016 - 0.004 * old), z - 0.061, 0.0105, 0.0105, 0.0085);
            d = smin(d, jow + 0.004 * (1 - old), 0.01);
          }
        }
      }
      // mandible bar (jawline + ramus) and chin
      if (y < yM + 0.04 && y > yC - 0.02) {
        for (const sd of [1, -1]) {
          const gx = sd * (m.gonX + sd * asym.jawDx);
          const a = rcap(x, y, z, sd * m.chinW * 0.7, yC + 0.004, mentZ + 0.002, 0.0038, sd * (m.gonX * 0.82), m.gonY - 0.017, 0.032, 0.0042);
          const b = rcap(x, y, z, sd * (m.gonX * 0.82), m.gonY - 0.017, 0.032, 0.0042, gx, m.gonY + 0.0, m.gonZ, 0.0048);
          const c = rcap(x, y, z, gx, m.gonY, m.gonZ, 0.0048, sd * (m.gonX + 0.004), m.gonY + 0.045, m.gonZ - 0.006, 0.0042);
          const jb = smin(smin(a, b, 0.006), c, 0.006);
          d = smin(d, jb, m.jawRound);
        }
        const ch = ell(x, y - (yC + 0.0145 + 0.002 * m.chinHeight), z - (m.chinZ - 0.0105), m.chinW, 0.0128, 0.0105);
        d = smin(d, ch, 0.008);
        if (mal > 0.2) {
          for (const sd of [1, -1]) {
            const tb = ell(x - sd * m.chinW * 0.55, y - (yC + 0.0075), z - (m.chinZ - 0.0115), 0.0085, 0.0085, 0.0085);
            d = smin(d, tb, 0.006 * mal);
          }
        }
        // mentolabial sulcus
        const ms = rcap(x, y, z, -0.011, yM - 0.0175 - 0.002 * m.lips, m.chinZ + 0.0035, 0.0028, 0.011, yM - 0.0175 - 0.002 * m.lips, m.chinZ + 0.0035, 0.0028);
        d = smax(d, -ms, 0.006);
      }
      // orbit hollows (the socket the lids sit in; the eye relief replaces the centre)
      if (ax > 0.008 && ax < 0.06 && y > yE - 0.03 && y < yE + 0.032) {
        for (const sd of [1, -1]) {
          const ox = sd * x - E.x, oy = y - (E.y + sd * m.asym.eyeDy), oz = z - E.z;
          if (ox < -0.03) continue;
          const deepO = clamp(m.eyeDepth + 0.4 * m.brow * mal, -1, 1.5);
          const hol = ell(ox - 0.0012, oy - 0.0012 - 0.001 * deepO, oz - 0.0005, 0.0185, 0.0148 + 0.0008 * deepO, 0.0185);
          d = smax(d, -hol, 0.0065 + 0.0015 * max(0, m.lidFoldAmt) + 0.002 * young);
        }
      }
      // nose and lips
      d = noseMass(d, x, y, z);
      d = lips(d, x, y, z);
      d = nostrils(d, x, y, z);
      d = mouthCarve(d, x, y, z);
    }
    // ears
    if (ax > 0.05 && y > 0.02 && y < 0.13 && z < 0.03 && z > -0.05) d = ear.union(d, x, y, z);
    return d;
  }
  const DBG = m.dbg || {};
  function sdf(x, y, z) {
    let d = sdfBase(x, y, z);
    if (DBG.noeye) return d;
    if (z > 0.03 && y > yE - 0.05 && y < yE + 0.05 && abs(x) > 0.001 && abs(x) < 0.085) d = eyeSide(d, x, y, z, x >= 0 ? 1 : -1);
    return d;
  }
  eyeGrid[1] = buildEyeGrid(1, sdfBase);
  eyeGrid[-1] = buildEyeGrid(-1, sdfBase);

  // dominant tissue at a surface point (for UV charts and region masks)
  function part(x, y, z) {
    const ax = abs(x);
    if (ax > 0.05 && y > 0.02 && y < 0.13 && z < 0.03 && z > -0.05) {
      if (ear.dist(x, y, z) < 0.0015) return PART.EAR;
    }
    if (y < nk.y1 + 0.008) return PART.NECKCAP;
    // mouth interior: on the slit / cavity carve surface
    if (mouthVol(x, y, z) < 0.0009) return PART.MOUTH;
    // nostril interiors
    if (nostrilVol(x, y, z) < 0.0007) return PART.NOSTRIL;
    // eyes: inner lid (behind margin) / caruncle
    if (ax > 0.005 && ax < 0.06 && abs(y - yE) < 0.03) {
      const side = x >= 0 ? 1 : -1;
      const L = eyeLocal(x, y, z, side);
      if (L.r < Re + 0.0004) return PART.LIDINNER;
      const car = ell(L.ex + 0.0112, L.ey + 0.0003, L.ez - 0.0048, 0.0022, 0.0017, 0.0018);
      if (car < 0.0005) return PART.CARUNCLE;
    }
    // vermilion
    if (abs(x) < mw + 0.002 && abs(y - yM) < 0.016) {
      const [s, v, w] = lipFrame(x, y, z);
      if (w > -0.0095 && v < bowTop(s) - 0.0001 && v > -m.lowerH * 1.02) {
        const a = abs(s) / mw;
        if (a < 0.98 && v > -m.lowerH * (1 - 0.6 * a * a) - 0.0004 && v < bowTop(s)) return PART.LIP;
      }
    }
    return PART.SKIN;
  }

  return { sdf, sdfBase, part, lidAt, eyeLocal, faceFront, lipFrame, bowTop, mouthVol, nostrilVol, ear, E, Re, nk, mentZ };
}

// ---------------------------------------------------------------------------------------------
// ear: lateral relief plate (helix, scapha, antihelix + crura, triangular fossa, concha, tragus,
// antitragus, lobule, canal). Built on a 2D grid in ear coordinates (u up along the ear axis,
// v forward, w lateral), then placed on each side of the head.
// ---------------------------------------------------------------------------------------------
function buildEar(m) {
  const S = m.earS;
  const H = 0.0625 * S, Wd = 0.033 * S;
  const NU = 72, NV = 40;
  const u0 = -H * 0.55, u1 = H * 0.55, v0 = -Wd * 0.75, v1 = Wd * 0.62;
  const du = (u1 - u0) / NU, dv = (v1 - v0) / NV;
  const OUT = new Float32Array((NU + 1) * (NV + 1)), HL = new Float32Array(OUT.length), HM = new Float32Array(OUT.length);
  // outline: superellipse with a narrower lobe, front edge attached
  const outline = (u, v) => {
    const un = u / (H * 0.5);
    const top = un > 0;
    const halfW = Wd * 0.5 * (top ? pow(max(0, 1 - pow(abs(un), 2.4)), 0.42) : pow(max(0, 1 - pow(abs(un), 2.0)), 0.5) * mix(1, 0.7, smoothstep(0.3, 1, -un)));
    const vc = -Wd * 0.08 + (top ? -0.08 * Wd * un : 0.06 * Wd * un);
    const dvv = abs(v - vc) - halfW;
    const duu = abs(u) - H * 0.5;
    return max(dvv, duu * 0.6);
  };
  const rimR = 0.0034 * S;
  for (let j = 0; j <= NU; j++) {
    for (let i = 0; i <= NV; i++) {
      const u = u0 + j * du, v = v0 + i * dv;
      const o = outline(u, v);
      const k = j * (NV + 1) + i;
      OUT[k] = o;
      const un = u / (H * 0.5), vn = (v + Wd * 0.08) / (Wd * 0.5);
      // distance inside the outline
      const din = -o;
      // helix rim: raised roll along the outline (not along the attached front edge in the lower half)
      const frontEdge = vn > 0.35 && un < 0.45;
      let h = 0.0028 * S; // plate base height
      const rim = frontEdge ? 0 : exp(-pow((din - rimR) / (rimR * 0.85), 2)) * 0.0042 * S;
      // scapha groove inside the rim
      const scapha = frontEdge ? 0 : exp(-pow((din - rimR * 2.5) / (rimR * 0.9), 2)) * -0.0018 * S;
      // antihelix: ridge roughly parallel to the back rim, splitting into two crura at the top
      const ahC = -0.28 + 0.12 * un; // centre line (vn) of the antihelix body
      const ah = exp(-pow((vn - ahC) / 0.16, 2)) * smoothstep(-0.55, -0.1, un) * smoothstep(0.62, 0.3, un) * 0.0034 * S;
      const crusU = exp(-pow((vn - (0.05 + 0.6 * (un - 0.3))) / 0.13, 2)) * smoothstep(0.2, 0.4, un) * smoothstep(0.85, 0.6, un) * 0.0026 * S;
      const crusL = exp(-pow((un - 0.32 - 0.25 * (vn + 0.1)) / 0.09, 2)) * smoothstep(-0.25, 0.1, vn) * smoothstep(0.7, 0.4, vn) * 0.0024 * S;
      // concha: bowl in the front-centre, lower half
      const cu = (un + 0.08) / 0.34, cv = (vn - 0.2) / 0.34;
      const conch = -exp(-pow(cu * cu + cv * cv, 1.4) * 1.2) * 0.0072 * S;
      // canal: deeper pit at the front of the concha
      const canal = -exp(-((un + 0.12) ** 2 + (vn - 0.42) ** 2) / 0.012) * 0.006 * S;
      // tragus: small flap in front of the canal
      const trag = exp(-(((un + 0.12) / 0.12) ** 2 + ((vn - 0.66) / 0.1) ** 2)) * 0.0048 * S;
      // antitragus
      const atr = exp(-(((un + 0.42) / 0.09) ** 2 + ((vn - 0.08) / 0.16) ** 2)) * 0.0036 * S;
      // lobule: smooth, slightly thicker
      const lobe = smoothstep(-0.5, -0.8, un) * 0.0012 * S;
      // crus of helix: rim continues into the concha
      const crusH = exp(-pow((un - 0.18 + 0.2 * (vn - 0.5)) / 0.06, 2)) * smoothstep(0.1, 0.5, vn) * smoothstep(0.85, 0.6, vn) * 0.0026 * S;
      h += rim + scapha + ah + crusU + crusL + conch + canal + trag + atr + lobe + crusH;
      // the lower front of the plate goes into the head (concha floor attaches there)
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
  // placement
  const tilt = 0.27; // top tilts back
  const cyE = 0.0705 + 0.002 * m.child, czE = -0.0095;
  const outA = m.earOutA;
  function local(x, y, z, side) {
    const lx = side * x, ly = y - (cyE + side * m.asym.earDy), lz = z - czE;
    // ear axis u: up, tilted back; v: forward; w: lateral, rotated outward about u by outA (back edge away from head)
    const ct = cos(tilt), st = sin(tilt);
    const u = ly * ct - lz * st;
    const v0_ = ly * st + lz * ct;
    const baseX = m.headW - 0.0045 + 0.0005 * (1 - m.grown);
    const w0 = lx - baseX;
    const ca = cos(outA), sa = sin(outA);
    // rotate in the v-w plane: points behind (v<0) are pushed out
    const v = v0_ * ca + w0 * sa;
    const w = -v0_ * sa + w0 * ca;
    return [u, v, w];
  }
  function dist(x, y, z) {
    const side = x >= 0 ? 1 : -1;
    const [u, v, w] = local(x, y, z, side);
    if (u < u0 || u > u1 || v < v0 || v > v1) return 1;
    const o = sample(OUT, u, v);
    const hl = sample(HL, u, v), hm = sample(HM, u, v);
    // gradient of HL for distance normalisation
    const e = 0.0006;
    const gu = (sample(HL, u + e, v) - sample(HL, u - e, v)) / (2 * e), gv = (sample(HL, u, v + e) - sample(HL, u, v - e)) / (2 * e);
    const dl = (w - hl) / sqrt(1 + gu * gu + gv * gv);
    const dm = (hm - w);
    let d = smax(dl, dm, 0.0015);
    d = smax(d, o, 0.0022);
    return d;
  }
  function union(d, x, y, z) {
    const de = dist(x, y, z);
    if (de > 0.02) return d;
    return smin(d, de, 0.0032);
  }
  return { dist, union, local, H, Wd, cy: cyE, cz: czE };
}

/** analytic landmarks in canonical space (before scaling by m.S) */
export function landmarks(m, F) {
  const L = {};
  L.eyeL = [m.eyeX, m.eyeY + m.asym.eyeDy, m.eyeZ];
  L.eyeR = [-m.eyeX, m.eyeY - m.asym.eyeDy, m.eyeZ];
  L.noseTip = [m.asym.noseDx + m.asym.tipDx, m.tipY, m.tipZ];
  L.mouth = [0, m.mouthY, m.lipZ];
  L.chin = [0, m.chinY + 0.004, m.chinZ - 0.009];
  L.crown = [0, m.crownY, -0.008];
  L.earL = [m.headW + 0.006, F.ear.cy + m.asym.earDy, F.ear.cz];
  L.earR = [-m.headW - 0.006, F.ear.cy - m.asym.earDy, F.ear.cz];
  return L;
}
