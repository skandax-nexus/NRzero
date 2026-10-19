// head_a sculpt: a dense sphere-topology head mesh (lat-long grid around a ray origin, pole at the
// crown, open at the neck) shaped by layered, landmark-anchored deformation fields:
//   1. radial smooth-union hull of anatomical masses (cranium, frontal, occiput, zygoma, mandible, neck)
//   2. a frontal relief field (face shield, nose, lips, folds) intersected along the rays
//   3. 3D bump / ridge / crease fields (temples, jaw angle, neck muscles, ...)
//   4. ring patches cut into the grid for the eyes (lids draped over the eyeball), mouth (lips + oral
//      cavity) and nostrils (real openings), whose inner rings are rebuilt per expression state
//   5. tangential relaxation; morph targets (blink, mouth open, smile) from the same pipeline.
// Everything is computed here from code; no external data.
import { clamp, lerp, sstep, smax, bump, interpS, polyDist2 } from './head_a_util.js';
import { faceSpec } from './head_a_spec.js';

const DEG = Math.PI / 180;
const E_J = -42 * DEG, E_TOP = 89.0 * DEG;
const MM = 0.001;

export const LODS = {
  high: { NI: 124, NJ: 88, NK: 8, eyeK: 5, eyeN: 84, mouthK: 11, mouthN: 104, nosK: 3, nosN: 20, interior: 5, relax: 3 },
  medium: { NI: 64, NJ: 46, NK: 4, eyeK: 2, eyeN: 40, mouthK: 4, mouthN: 48, nosK: 1, nosN: 10, interior: 3, relax: 2 },
  low: { NI: 30, NJ: 22, NK: 2, eyeK: 1, eyeN: 14, mouthK: 1, mouthN: 16, nosK: 0, nosN: 0, interior: 1, relax: 1 },
};

// ---------------------------------------------------------------- param warp (index -> angles)
function cdfTable(rho, a, b, N = 2048) {
  const xs = new Float64Array(N + 1), cs = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) xs[i] = a + (b - a) * i / N;
  for (let i = 0; i < N; i++) cs[i + 1] = cs[i] + rho((xs[i] + xs[i + 1]) * 0.5);
  const tot = cs[N];
  for (let i = 0; i <= N; i++) cs[i] /= tot;
  return { xs, cs, N };
}
function invCdf(T, u) { // u in [0,1] -> x
  const { xs, cs, N } = T;
  if (u <= 0) return xs[0];
  if (u >= 1) return xs[N];
  let lo = 0, hi = N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cs[m] <= u) lo = m; else hi = m; }
  return xs[lo] + (xs[hi] - xs[lo]) * (u - cs[lo]) / Math.max(1e-12, cs[hi] - cs[lo]);
}
function cdf(T, x) {
  const { xs, cs, N } = T;
  const f = (x - xs[0]) / (xs[N] - xs[0]) * N;
  if (f <= 0) return 0;
  if (f >= N) return 1;
  const i = Math.floor(f);
  return cs[i] + (cs[i + 1] - cs[i]) * (f - i);
}
const gk = (e, c, w) => Math.exp(-(((e - c) / w) ** 2));
const win = (e, a, b, w) => sstep(a - w, a + w, e) * (1 - sstep(b - w, b + w, e));
let WARP = null;
function getWarp() {
  if (WARP) return WARP;
  const TS = cdfTable(s => 0.30 + 0.85 * Math.exp(-Math.pow(s / 1.30, 6)) + 0.55 * Math.exp(-((s / 0.50) ** 2)), -Math.PI, Math.PI);
  const TF = cdfTable(e => 0.28 + 0.62 * win(e, -36 * DEG, 52 * DEG, 6 * DEG) + 0.95 * gk(e, 31.5 * DEG, 5.5 * DEG) + 0.85 * gk(e, 8 * DEG, 4.5 * DEG)
    + 0.75 * gk(e, -8.5 * DEG, 6 * DEG) + 0.25 * gk(e, -27 * DEG, 8 * DEG), E_J, E_TOP);
  const TB = cdfTable(e => 0.55 + 0.45 * win(e, -40 * DEG, 55 * DEG, 10 * DEG), E_J, E_TOP);
  const wf = s => Math.exp(-((s / 1.45) ** 4));
  WARP = {
    sOf: u => invCdf(TS, u), uOf: s => cdf(TS, s),
    eOf: (u, v) => { const s = invCdf(TS, u); const w = wf(s); return lerp(invCdf(TB, v), invCdf(TF, v), w); },
    vOf: (u, e) => { // invert eOf in v by bisection
      let lo = 0, hi = 1;
      const s = invCdf(TS, u), w = wf(s);
      for (let k = 0; k < 30; k++) { const m = (lo + hi) * 0.5; const em = lerp(invCdf(TB, m), invCdf(TF, m), w); if (em < e) lo = m; else hi = m; }
      return (lo + hi) * 0.5;
    },
  };
  return WARP;
}

// ---------------------------------------------------------------- hull primitives (radial union)
function ellip(c, r, axes) { // axes: optional [ax,ay,az] unit vectors (local frame)
  return { type: 'e', c, ir: [1 / r[0], 1 / r[1], 1 / r[2]], axes: axes || null };
}
function rayEllip(P, o, d) {
  let ox = o[0] - P.c[0], oy = o[1] - P.c[1], oz = o[2] - P.c[2], dx = d[0], dy = d[1], dz = d[2];
  if (P.axes) {
    const [a, b, c] = P.axes;
    const lox = ox * a[0] + oy * a[1] + oz * a[2], loy = ox * b[0] + oy * b[1] + oz * b[2], loz = ox * c[0] + oy * c[1] + oz * c[2];
    const ldx = dx * a[0] + dy * a[1] + dz * a[2], ldy = dx * b[0] + dy * b[1] + dz * b[2], ldz = dx * c[0] + dy * c[1] + dz * c[2];
    ox = lox; oy = loy; oz = loz; dx = ldx; dy = ldy; dz = ldz;
  }
  ox *= P.ir[0]; oy *= P.ir[1]; oz *= P.ir[2]; dx *= P.ir[0]; dy *= P.ir[1]; dz *= P.ir[2];
  const A = dx * dx + dy * dy + dz * dz, B = 2 * (ox * dx + oy * dy + oz * dz), Cc = ox * ox + oy * oy + oz * oz - 1;
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return 0;
  return Math.max(0, (-B + Math.sqrt(disc)) / (2 * A));
}
function rayNeck(N, o, d) { // elliptic cylinder along y, capped at yTop
  const ox = (o[0]) / N.a, oz = (o[2] - N.cz) / N.b, dx = d[0] / N.a, dz = d[2] / N.b;
  const A = dx * dx + dz * dz, B = 2 * (ox * dx + oz * dz), Cc = ox * ox + oz * oz - 1;
  let t = 0;
  if (A > 1e-12) { const disc = B * B - 4 * A * Cc; if (disc >= 0) t = (-B + Math.sqrt(disc)) / (2 * A); } else t = 10;
  if (d[1] > 1e-6) t = Math.min(t, (N.yTop - o[1]) / d[1]);
  return Math.max(0, t);
}
function frameFrom(dir) { // local axes with x = dir
  const a = norm3(dir);
  let up = [0, 1, 0];
  if (Math.abs(a[1]) > 0.9) up = [1, 0, 0];
  const b = norm3(cross3(up, a)); const c = cross3(a, b);
  return [a, c, b];
}
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

function makeHull(F) {
  const jw = F.jawW, cw = F.cheekW, fw = F.foreW;
  const prims = [
    [ellip([0, 0.086, -0.012], [0.0715 * fw, 0.109, 0.094]), 0],
    [ellip([0, 0.118, -0.028], [0.0765 * fw, 0.074, 0.074]), 0.012],
    [ellip([0, 0.062, -0.034], [0.060, 0.066, 0.074]), 0.012],
    [ellip([0, 0.118, 0.004], [0.063 * fw, 0.072, 0.086]), 0.012],
    [ellip([0, 0.068, 0.0], [0.0695 * cw, 0.034, 0.056]), 0.012],
    [ellip([0, 0.052, 0.012], [0.058 * cw, 0.05, 0.07]), 0.012],
    [ellip([0, F.yPog + 0.011, 0.058 + F.chinProj], [0.0235 * F.chinW, 0.026, 0.031]), 0.009],
  ];
  for (const sd of [-1, 1]) {
    const G = [sd * 0.0515 * jw, -0.001 - 0.002 * F.sh.faceLength, -0.007];
    const K = [sd * 0.019 * F.chinW, F.yPog - 0.008, 0.064 + F.chinProj * 0.6];
    const mid = [(G[0] + K[0]) / 2, (G[1] + K[1]) / 2, (G[2] + K[2]) / 2];
    const dir = [K[0] - G[0], K[1] - G[1], K[2] - G[2]];
    const L = Math.hypot(...dir) * 0.5 + 0.008;
    prims.push([ellip(mid, [L, 0.0145, 0.016], frameFrom(dir)), 0.009]);
    prims.push([ellip([sd * 0.0505 * jw, 0.024, -0.006], [0.0125, 0.034, 0.02]), 0.01]);
  }
  const neck = { a: F.neckR, b: F.neckR * 1.05, cz: -0.012, yTop: 0.07 };
  return function hull(o, d) {
    let r = 0;
    for (let i = 0; i < prims.length; i++) {
      const ri = rayEllip(prims[i][0], o, d);
      r = i === 0 ? ri : smax(r, ri, prims[i][1]);
    }
    return smax(r, rayNeck(neck, o, d), 0.014);
  };
}

// ---------------------------------------------------------------- frontal relief (heightfield z = M(x, y))
const SH_Y = [-0.075, -0.058, -0.046, -0.036, -0.024, -0.012, -0.002, 0.008, 0.020, 0.032, 0.045, 0.058, 0.070, 0.080, 0.090, 0.100, 0.110, 0.122, 0.138, 0.155, 0.172, 0.192];
const SH_Z = [0.030, 0.052, 0.071, 0.087, 0.0935, 0.0920, 0.0975, 0.0995, 0.1022, 0.1012, 0.0935, 0.0895, 0.0880, 0.0880, 0.0905, 0.0955, 0.0970, 0.0955, 0.0915, 0.0840, 0.0715, 0.0480];
const SH_W = [0.035, 0.040, 0.044, 0.046, 0.048, 0.052, 0.055, 0.057, 0.060, 0.063, 0.066, 0.069, 0.071, 0.071, 0.070, 0.069, 0.068, 0.067, 0.066, 0.063, 0.058, 0.046];
const SH_N = [2.0, 2.0, 2.1, 2.2, 2.2, 2.1, 2.0, 2.0, 2.1, 2.3, 2.5, 2.7, 2.8, 2.8, 2.6, 2.4, 2.4, 2.4, 2.3, 2.2, 2.1, 2.0];
const PU_Q = [0, 0.08, 0.22, 0.42, 0.62, 0.84, 0.98, 1.06, 1.2, 1.5, 2.2];
const PU_V = [-0.5, 0.0, 0.6, 0.95, 1.0, 0.84, 0.6, 0.66, 0.4, 0.08, 0];
const PL_Q = [0, 0.08, 0.22, 0.42, 0.64, 0.86, 1.0, 1.12, 1.35, 1.7];
const PL_V = [-0.5, 0.05, 0.7, 1.0, 0.94, 0.66, 0.36, 0.16, 0.04, 0];

export function makeRelief(F) {
  const yc = (y) => interpS(F.yAct, F.yCan, y);
  const mw = F.mouthW;
  const slitY = (x) => { const u = x / mw; return F.ySlit - F.cornerDrop * u * u + F.slitAsym * u; };
  const bowF = (x) => 1 + F.bow * Math.exp(-(((Math.abs(x) - 0.0053) / 0.0024) ** 2)) - F.bow * 1.3 * Math.exp(-((x / 0.0016) ** 2));
  const tuF = (x) => { const q = 1 - (x / mw) ** 2; return q <= 0 ? 0 : F.tu * bowF(x) * Math.pow(q, 0.55); };
  const tlF = (x) => { const q = 1 - (x / mw) ** 2; return q <= 0 ? 0 : F.tl * Math.pow(q, 0.5); };
  const auF = (x) => { const q = 1 - (x / (mw * 1.02)) ** 2; return q <= 0 ? 0 : F.au * Math.pow(q, 0.85); };
  const alF = (x) => { const q = 1 - (x / (mw * 1.02)) ** 2; return q <= 0 ? 0 : F.al * Math.pow(q, 0.75); };
  const wsc = (Y) => Y < 0.03 ? lerp(F.jawW, F.cheekW, sstep(-0.03, 0.03, Y)) : lerp(F.cheekW, F.foreW, sstep(0.07, 0.12, Y));

  // nose landmarks
  const nP = F.noseProj, nW = F.noseW, nB = F.noseBridge;
  const zBase = 0.0885;
  const yN = F.yNasion, yT = F.yTip, yS = F.ySub;
  const yd = [yN + 0.010, yN, lerp(yN, yT, 0.25), lerp(yN, yT, 0.5), lerp(yN, yT, 0.75), yT + 0.0075];
  const hd0 = [0.0068, 0.0030, 0.0080, 0.0140, 0.0200, 0.0245];
  const hd = hd0.map((h, i) => h * (i <= 1 ? nB : lerp(nB, nP, i / 5)) + (i === 3 ? F.noseHump : 0));
  const bd = [0.0085, 0.0068, 0.0058, 0.0056, 0.0060, 0.0068].map((b, i) => b * Math.sqrt(nW) * (i <= 1 ? 1 + 0.15 * (1 - nB) : 1));
  const sd = [0.55, 1.0, 1.2, 1.3, 1.35, 1.3];
  const zTip = zBase + 0.0322 * nP - F.tipDroop * 0.5;
  const tip = { c: [F.noseDev, yT + 0.0004 - F.tipDroop, zTip - 0.0118], r: [0.0112 * nW, 0.0102, 0.0118] };
  const zSub = 0.1024 + 0.0012 * (nP - 1);
  const ala = { y: yS + 0.0062, z: 0.0952 + 0.003 * (nP - 1), x: 0.0152 * nW, r: [0.0072 * Math.sqrt(nW), 0.0068, 0.0086] };
  const ellipH = (x, y, c, r) => { const q = 1 - ((x - c[0]) / r[0]) ** 2 - ((y - c[1]) / r[1]) ** 2; return q <= 0 ? -1 : c[2] + r[2] * Math.sqrt(q); };

  function nose(x, y) {
    if (y < yS - 0.004 || y > yN + 0.014 || Math.abs(x) > 0.03) return -1;
    const xd = x - F.noseDev * sstep(yN, yT, y);
    let z = -1;
    // dorsum
    if (y > yT - 0.002) {
      const yy = clamp(y, yd[5], yd[0]);
      const ys = yd.slice().reverse(), hs = hd.slice().reverse(), bs = bd.slice().reverse(), ss = sd.slice().reverse();
      const h = interpS(ys, hs, yy), b = interpS(ys, bs, yy), s = interpS(ys, ss, yy);
      const a = s * b;
      let zd = zBase + h - a * (Math.sqrt(1 + (xd / b) ** 2) - 1);
      zd -= 0.012 * sstep(yd[0] - 0.004, yd[0] + 0.004, y);
      z = zd;
    }
    // tip lobule (+ two domes)
    const zt = ellipH(xd, y, tip.c, tip.r);
    if (zt > -1) {
      const dome = 0.0005 * (Math.exp(-(((xd - 0.0042) / 0.003) ** 2 + ((y - tip.c[1] - 0.0005) / 0.004) ** 2)) + Math.exp(-(((xd + 0.0042) / 0.003) ** 2 + ((y - tip.c[1] - 0.0005) / 0.004) ** 2)));
      z = smax(z, zt + dome, 0.002);
    }
    // alae
    for (const sgn of [-1, 1]) {
      const za = ellipH(xd, y, [sgn * ala.x, ala.y, ala.z], ala.r);
      if (za > -1) z = smax(z, za, 0.0016);
    }
    // columella
    if (y > yS - 0.002 && y < yT - 0.002 && Math.abs(xd) < 0.006) {
      const f = clamp((y - yS) / (yT - 0.0065 - yS), 0, 1.3);
      const zc = lerp(zSub, zTip - 0.0072, f) - 0.0022 * (xd / 0.0034) ** 2;
      z = smax(z, zc, 0.0012);
    }
    // nose base plate (nostril floor / sills)
    if (y > yS - 0.003 && y < yT && Math.abs(xd) < 0.021 * nW) {
      const zp = zSub + (y - yS) * 0.9 - 0.004 * (xd / (0.02 * nW)) ** 4 - 0.0006;
      z = smax(z, zp, 0.0015);
    }
    return z;
  }

  // curve features (left side; mirrored by |x|)
  const browPts = [[0.004, F.yBrow - 0.005], [0.016, F.yBrow - 0.0022], [0.030, F.yBrow], [0.044, F.yBrow - 0.0022], [0.054, F.yBrow - 0.0085], [0.0605, F.yBrow - 0.0175]];
  const nlPts = [[0.0198 * nW + 0.0008, yS + 0.0135], [0.0222 * nW + 0.001, yS + 0.004], [0.0262 + 0.0005 * nW, yS - 0.008], [mw + 0.0058, F.ySlit + 0.0045], [mw + 0.0088, F.ySlit - 0.0055], [mw + 0.0098, F.ySlit - 0.012]];
  const ttPts = [[0.0165, F.yEye - 0.0085], [0.024, F.yEye - 0.0128], [0.034, F.yEye - 0.0152], [0.045, F.yEye - 0.0142]];
  const mrPts = [[mw * 1.04, F.ySlit - 0.002], [mw * 1.1, F.ySlit - 0.012], [mw * 1.14, F.ySlit - 0.024]];
  const alarPts = [[ala.x - 0.002, ala.y + 0.0072], [ala.x + 0.0045, ala.y + 0.0035], [ala.x + 0.0072, ala.y - 0.0015], [ala.x + 0.0062, ala.y - 0.0055], [ala.x + 0.0035, yS - 0.0005]];

  function shield(x, y) {
    const Y = yc(y);
    const ax = Math.abs(x);
    const ws = wsc(Y);
    const z0 = interpS(SH_Y, SH_Z, Y), hw = interpS(SH_Y, SH_W, Y) * ws, n = interpS(SH_Y, SH_N, Y);
    const zb = -0.01;
    const t = ax / hw;
    let z = t < 1 ? zb + (z0 - zb) * Math.pow(1 - Math.pow(t, n), 1 / n) : zb - (ax - hw) * 3;
    // ---- additive anatomical features
    // eye socket
    for (const sgn of [-1, 1]) {
      const ex = sgn * F.eyeX, dx = (x - ex) / 0.0195, dy = (y - F.yEye - 0.0015) / 0.0152;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1) z -= 0.0135 * F.socketDepth * bump(d2) * (1 + 0.25 * clamp(dy, -1, 1) - 0.15 * clamp(sgn * dx, -1, 1));
    }
    // brow ridge + glabella
    if (y > F.yBrow - 0.03 && y < F.yBrow + 0.016 && ax < 0.07) {
      const pd = polyDist2(browPts, ax, y);
      z += F.browAmp * Math.exp(-((pd.d / 0.0062) ** 2)) * (0.6 + 0.4 * Math.sin(Math.PI * clamp(pd.t * 1.2, 0, 1)));
      z += F.glabella * Math.exp(-((x / 0.010) ** 2 + ((y - F.yBrow + 0.006) / 0.008) ** 2));
    }
    // frontal eminences
    z += 0.0012 * (0.3 + F.fem + F.child) * (Math.exp(-(((ax - 0.024) / 0.02) ** 2 + ((y - F.yBrow - 0.034) / 0.02) ** 2)));
    // cheekbones (malar eminence)
    {
      const dx = (ax - 0.043 * F.cheekW) / 0.019, dy = (y - F.yEye + 0.0195) / 0.0135;
      z += F.cheekAmp * bump(dx * dx + dy * dy);
      // malar fat pad (fuller in young/female)
      const fx = (ax - 0.032) / 0.016, fy = (y - F.yEye + 0.028) / 0.014;
      z += (0.0016 + 0.0012 * F.fem + 0.001 * F.child - 0.0008 * F.old) * bump(fx * fx + fy * fy);
    }
    // tear trough + lower lid bags
    if (y > F.yEye - 0.03 && y < F.yEye && ax > 0.008 && ax < 0.055) {
      const pd = polyDist2(ttPts, ax, y);
      z -= (0.0005 + 0.0022 * F.old) * Math.exp(-((pd.d / 0.0032) ** 2));
    }
    // nasolabial fold: crease + cheek mass bulging over it
    if (y > F.ySlit - 0.025 && y < yS + 0.022 && ax > 0.01 && ax < 0.06) {
      const pd = polyDist2(nlPts, ax, y);
      const fade = sstep(0.0, 0.12, pd.t) * (1 - sstep(0.8, 1.0, pd.t));
      const lateral = (pd.side < 0);
      z -= F.nlf * Math.exp(-((pd.d / 0.0017) ** 2)) * (0.4 + 0.6 * fade);
      if (lateral) z += F.nlBulge * Math.exp(-(((pd.d - 0.0042) / 0.0045) ** 2)) * fade * 1.0;
      else z += 0.0004 * Math.exp(-(((pd.d - 0.003) / 0.003) ** 2)) * fade;
    }
    // alar crease (groove around the nose wing)
    if (y > yS - 0.006 && y < ala.y + 0.012 && ax > 0.008 && ax < 0.03) {
      const pd = polyDist2(alarPts, ax, y);
      z -= (0.0011 + 0.0004 * F.old) * Math.exp(-((pd.d / 0.0011) ** 2));
    }
    // lips
    const sy = slitY(x);
    if (ax < mw * 1.02 && y > sy - 0.022 && y < sy + 0.025) {
      if (y >= sy) { const t = tuF(x); if (t > 1e-5) z += auF(x) * interp1q(PU_Q, PU_V, (y - sy) / t); }
      else { const t = tlF(x); if (t > 1e-5) z += alF(x) * interp1q(PL_Q, PL_V, (sy - y) / t); }
      // slit crease continuing slightly into the corners
    }
    // commissure / modiolus
    {
      const dx = (ax - mw * 1.07) / 0.0045, dy = (y - slitY(mw)) / 0.0058;
      z -= (0.0009 + 0.0006 * F.old) * bump(dx * dx + dy * dy);
      const cx = (ax - mw * 0.98) / 0.0035, cy = (y - slitY(mw)) / 0.0018;
      z -= 0.0006 * bump(cx * cx + cy * cy);
    }
    // philtrum columns + groove
    {
      const yb = sy + tuF(0) * 1.02, yt = yS - 0.0012;
      if (y > yb - 0.002 && y < yt + 0.002 && ax < 0.012) {
        const f = clamp((y - yb) / (yt - yb), 0, 1);
        const fade = sstep(-0.15, 0.1, f) * (1 - sstep(0.9, 1.1, f));
        const px = lerp(0.0054, 0.0039, f);
        z += (0.00075 + 0.0002 * F.fem) * Math.exp(-(((ax - px) / 0.0015) ** 2)) * fade;
        z -= 0.00045 * Math.exp(-((x / 0.0022) ** 2)) * fade;
      }
    }
    // mentolabial sulcus + chin
    {
      const ys = slitY(0) - F.tl - 0.0062;
      const dx = x / 0.017, dy = (y - ys) / 0.0042;
      z -= 0.0011 * bump(dx * dx + dy * dy);
      const cx = x / (0.0135 * F.chinW), cy = (y - F.yPog - 0.001) / 0.012;
      z += (0.0014 + F.chinProj * 0.7) * bump(cx * cx + cy * cy);
      // subtle chin cleft for strong male chins
      z -= 0.0004 * F.masc * Math.max(0, F.sh.chin + 0.3) * Math.exp(-((x / 0.0022) ** 2 + ((y - F.yPog) / 0.006) ** 2));
    }
    // marionette lines (age)
    if (F.old > 0.05 && y < F.ySlit && y > F.ySlit - 0.03) {
      const pd = polyDist2(mrPts, ax, y);
      z -= 0.0013 * F.old * Math.exp(-((pd.d / 0.0019) ** 2));
    }
    // buccal hollow + jowls
    {
      const dx = (ax - 0.049 * F.jawW) / 0.014, dy = (y - F.ySlit - 0.024) / 0.016;
      z -= F.hollow * bump(dx * dx + dy * dy);
      const jx = (ax - 0.035 * F.jawW) / 0.012, jy = (y - F.yPog - 0.002) / 0.011;
      z += F.jowl * bump(jx * jx + jy * jy);
    }
    return z;
  }

  function M(x, y) {
    const zs = shield(x, y);
    const zn = nose(x, y);
    return zn > -1 ? smax(zs, zn, 0.0022) : zs;
  }
  return { M, slitY, tuF, tlF, auF, alF, nose, shield, ala, tip, zSub, zTip };
}
function interp1q(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  const n = xs.length;
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = 1; while (xs[i] < x) i++;
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  const s = t * t * (3 - 2 * t);
  return ys[i - 1] + (ys[i] - ys[i - 1]) * s;
}

// ---------------------------------------------------------------- 3D fields
function makeFields(F) {
  const L = [];
  const jw = F.jawW;
  for (const sd of [-1, 1]) {
    L.push({ c: [sd * 0.0635, 0.113, 0.046], r: [0.016, 0.022, 0.024], a: -F.temple });
    L.push({ c: [sd * 0.054 * jw, 0.001, -0.004], r: [0.012, 0.015, 0.015], a: F.gonion });
    L.push({ c: [sd * 0.058, 0.044, -0.032], r: [0.010, 0.013, 0.012], a: 0.0012 });
    L.push({ c: [sd * 0.062, 0.069, 0.02], r: [0.006, 0.006, 0.02], a: 0.0012 }); // zygomatic arch
    // sternocleidomastoid
    L.push({ curve: [[sd * 0.052, 0.025, -0.034], [sd * 0.042, -0.02, -0.005], [sd * 0.026, -0.07, 0.028], [sd * 0.014, -0.11, 0.046]], w: 0.0095, a: 0.0022 * (1 - 0.4 * F.fem) });
  }
  L.push({ c: [0, -0.064, 0.052], r: [0.0085, 0.013, 0.012], a: F.adam, dir: [0, 0.1, 1] });
  L.push({ c: [0, -0.052, 0.048], r: [0.03, 0.012, 0.03], a: 0.0028 * F.old });
  L.push({ c: [0, -0.085, 0.05], r: [0.012, 0.014, 0.015], a: -0.0018 }); // suprasternal hollow hint
  L.push({ c: [0, 0.04, -0.07], r: [0.018, 0.03, 0.02], a: -0.0015 }); // nape groove
  for (const f of L) {
    if (f.curve) {
      let mn = [1, 1, 1], mx = [-1, -1, -1];
      for (const p of f.curve) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k] - f.w); mx[k] = Math.max(mx[k], p[k] + f.w); }
      f.bb = [mn, mx];
    } else f.bb = [[f.c[0] - f.r[0], f.c[1] - f.r[1], f.c[2] - f.r[2]], [f.c[0] + f.r[0], f.c[1] + f.r[1], f.c[2] + f.r[2]]];
  }
  return L;
}
function seg3Dist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const l2 = dx * dx + dy * dy + dz * dz;
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / l2, 0, 1);
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t, p[2] - a[2] - dz * t);
}
function applyFields(L, pos, n, C) {
  const p = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    p[0] = pos[i * 3]; p[1] = pos[i * 3 + 1]; p[2] = pos[i * 3 + 2];
    let dx = 0, dy = 0, dz = 0;
    for (const f of L) {
      const bb = f.bb;
      if (p[0] < bb[0][0] || p[0] > bb[1][0] || p[1] < bb[0][1] || p[1] > bb[1][1] || p[2] < bb[0][2] || p[2] > bb[1][2]) continue;
      let w;
      if (f.curve) {
        let d = 1e9; for (let k = 0; k < f.curve.length - 1; k++) d = Math.min(d, seg3Dist(p, f.curve[k], f.curve[k + 1]));
        w = bump((d / f.w) ** 2);
      } else {
        const ax = (p[0] - f.c[0]) / f.r[0], ay = (p[1] - f.c[1]) / f.r[1], az = (p[2] - f.c[2]) / f.r[2];
        w = bump(ax * ax + ay * ay + az * az);
      }
      if (w <= 0) continue;
      let v;
      if (f.dir) v = f.dir; else v = norm3([p[0] - C[0], (p[1] - C[1]) * 0.6, p[2] - C[2]]);
      const l = Math.hypot(v[0], v[1], v[2]);
      dx += f.a * w * v[0] / l; dy += f.a * w * v[1] / l; dz += f.a * w * v[2] / l;
    }
    pos[i * 3] += dx; pos[i * 3 + 1] += dy; pos[i * 3 + 2] += dz;
  }
}

// ---------------------------------------------------------------- mesh builder
export function buildHeadData(params) {
  const F = faceSpec(params);
  const lod = LODS[params.detail] || LODS.high;
  const W = getWarp();
  const C = F.C;
  const hull = makeHull(F);
  const RL = makeRelief(F);

  const NI = lod.NI, NJ = lod.NJ, NK = lod.NK;
  const ROWS = NK + NJ + 1, COLS = NI + 1;
  // dynamic vertex store
  const vs = { s: [], e: [], kind: [], tag: [], u: [], v: [], aux: [] };
  const addV = (s, e, kind, tag = 0) => { vs.s.push(s); vs.e.push(e); vs.kind.push(kind); vs.tag.push(tag); vs.u.push(0); vs.v.push(0); vs.aux.push(null); return vs.s.length - 1; };
  const gidx = (i, jr) => jr * COLS + i;

  // ---- grid params
  const colS = new Float64Array(COLS);
  for (let i = 0; i < COLS; i++) colS[i] = W.sOf(i / NI);
  for (let jr = 0; jr < ROWS; jr++) {
    for (let i = 0; i < COLS; i++) {
      const u = i / NI;
      let e;
      if (jr < NK) e = E_J; // neck rows: placed later
      else e = W.eOf(u, (jr - NK) / NJ);
      const id = addV(colS[i], e, jr < NK ? 4 : 0);
      vs.u[id] = u; vs.v[id] = jr / (ROWS - 1) * 0.88;
      vs.aux[id] = { i, jr };
    }
  }
  const pole = addV(0, Math.PI / 2, 0); vs.u[pole] = 0.5; vs.v[pole] = 0.88;

  // ---- helpers: param <-> index
  const uvOfParam = (s, e) => { const u = W.uOf(s); const vv = W.vOf(u, e); return [u, (NK + vv * NJ) / (ROWS - 1) * 0.88, u * NI, NK + vv * NJ]; };
  const paramOf = (x, y, z) => [Math.atan2(x, z), Math.atan2(y - C[1], Math.hypot(x, z))];
  const rectFor = (pts) => { // 3D pts -> index rect [i0,i1,j0,j1]
    let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
    for (const p of pts) { const [s, e] = paramOf(...p); const r = uvOfParam(s, e); i0 = Math.min(i0, r[2]); i1 = Math.max(i1, r[2]); j0 = Math.min(j0, r[3]); j1 = Math.max(j1, r[3]); }
    return [Math.floor(i0), Math.ceil(i1), Math.max(NK + 1, Math.floor(j0)), Math.ceil(j1)];
  };

  const tris = [];
  const holes = [];
  const patches = [];

  // ---------------------------------------------------------- eye definitions
  const eyes = [];
  for (const side of [1, -1]) {
    const E = [side * F.eyeX, F.yEye + F.eyeAsym[side > 0 ? 0 : 1], F.eyeZ];
    eyes.push(makeEyeDef(F, E, side));
  }
  // ---------------------------------------------------------- holes / patches
  for (const ed of eyes) {
    const E = ed.E, sd = ed.side;
    const pts = [];
    for (const [u, v, z] of [[-19.5, -9.5, 4], [17.5, -9.5, -2], [-19.5, 12.5, 6], [17.5, 12.5, 0], [0, 13.5, 10], [0, -10.5, 8], [-20.5, 1, 4], [18, 1, -2]]) pts.push([E[0] + sd * u * MM, E[1] + v * MM, E[2] + (10 + z) * MM]);
    ed.rect = rectFor(pts);
    holes.push(ed.rect);
  }
  const mouth = { rect: null };
  {
    const sy = RL.slitY(0);
    const pts = [[-F.mouthW - 0.0075, sy, 0.088], [F.mouthW + 0.0075, sy, 0.088], [0, sy - F.tl - 0.0045, 0.1], [0, sy + F.tu + 0.0055, 0.103], [-F.mouthW, sy + F.tu * 0.7 + 0.004, 0.094], [F.mouthW, sy - F.tl * 0.7 - 0.004, 0.094]];
    mouth.rect = rectFor(pts);
    holes.push(mouth.rect);
  }
  const nostrils = [];
  if (lod.nosN > 0) {
    for (const sd of [1, -1]) {
      const yS = F.ySub, nw = F.noseW;
      const pts = [[sd * 0.0036 * nw, yS + 0.0015, 0.1045], [sd * 0.0195 * nw, yS + 0.0005, 0.0985], [sd * 0.0036 * nw, F.yTip - 0.0045, 0.1135], [sd * 0.016 * nw, F.yTip - 0.0035, 0.107]];
      const r = rectFor(pts);
      nostrils.push({ side: sd, rect: r });
      holes.push(r);
    }
  }

  // grid triangles (excluding holes)
  const inHole = (i, jr) => { for (const h of holes) if (i >= h[0] && i < h[1] && jr >= h[2] && jr < h[3]) return true; return false; };
  for (let jr = 0; jr < ROWS - 1; jr++) for (let i = 0; i < NI; i++) {
    if (inHole(i, jr)) continue;
    const a = gidx(i, jr), b = gidx(i + 1, jr), c = gidx(i + 1, jr + 1), d = gidx(i, jr + 1);
    tris.push(a, b, c, a, c, d);
  }
  // pole fan
  for (let i = 0; i < NI; i++) tris.push(gidx(i, ROWS - 1), gidx(i + 1, ROWS - 1), pole);

  // rect loop (CCW from outside) with index-space arc param t starting at the rect's "start side" midpoint
  function rectLoop(r, startSide) { // startSide: 'right' | 'left'
    const [i0, i1, j0, j1] = r;
    const L = [];
    for (let i = i0; i < i1; i++) L.push([i, j0]);
    for (let j = j0; j < j1; j++) L.push([i1, j]);
    for (let i = i1; i > i0; i--) L.push([i, j1]);
    for (let j = j1; j > j0; j--) L.push([i0, j]);
    const n = L.length;
    const W2 = i1 - i0, H2 = j1 - j0;
    // start offset: right side midpoint is at arc W2 + H2/2 ; left side midpoint at 2*W2 + H2 + H2/2
    const s0 = startSide === 'right' ? W2 + H2 / 2 : 2 * W2 + H2 + H2 / 2;
    const items = L.map((q, k) => ({ q, t: (((k - s0) / n) % 1 + 1) % 1 }));
    items.sort((a, b) => a.t - b.t);
    return { idx: items.map(it => gidx(it.q[0], it.q[1])), t: items.map(it => it.t) };
  }
  function interpLoop(loop, t, arrS, arrE) { // param along the loop at t (piecewise-linear)
    const n = loop.t.length;
    let k = 0;
    while (k < n - 1 && loop.t[k + 1] <= t) k++;
    const k2 = (k + 1) % n;
    const t0 = loop.t[k], t1 = k2 === 0 ? loop.t[0] + 1 : loop.t[k2];
    let tt = t; if (tt < t0) tt += 1;
    const f = clamp((tt - t0) / Math.max(1e-9, t1 - t0), 0, 1);
    const a = loop.idx[k], b = loop.idx[k2];
    let sA = arrS[a], sB = arrS[b];
    return [lerp(sA, sB, f), lerp(arrE[a], arrE[b], f)];
  }
  function stitch(A, tA, B, tB) {
    const na = A.length, nb = B.length;
    let i = 0, j = 0;
    while (i < na || j < nb) {
      const ta = i < na ? (i + 1 < na ? tA[i + 1] : tA[0] + 1) : Infinity;
      const tb = j < nb ? (j + 1 < nb ? tB[j + 1] : tB[0] + 1) : Infinity;
      if (ta <= tb) { tris.push(A[i % na], A[(i + 1) % na], B[j % nb]); i++; }
      else { tris.push(A[i % na], B[(j + 1) % nb], B[j % nb]); j++; }
    }
  }
  function makeRing(n, kind, tag, extra) {
    const idx = [], t = [];
    for (let m = 0; m < n; m++) { const id = addV(0, 0, kind, tag); idx.push(id); t.push(m / n); vs.aux[id] = { ...(extra || {}), tm: m / n }; }
    return { idx, t };
  }

  // ---- eye patches: ring0 (grid) -> K skin rings -> anterior margin A -> posterior margin P -> tuck -> socket -> apex
  for (const ed of eyes) {
    const loop0 = rectLoop(ed.rect, ed.side > 0 ? 'right' : 'left');
    const nM = lod.eyeN;
    const rings = [loop0];
    const K = lod.eyeK;
    for (let k = 1; k <= K; k++) {
      const n = Math.round(lerp(loop0.idx.length, nM, k / (K + 1)));
      const r = makeRing(Math.max(n, 8), 1, 0, { eye: ed, f: 1 - k / (K + 1), ring: k });
      r.f = 1 - k / (K + 1); rings.push(r);
    }
    const rA = makeRing(nM, 1, 0, { eye: ed, f: 0, ring: 'A' });
    const rP = makeRing(nM, 1, 1, { eye: ed, ring: 'P' });
    const rT = makeRing(nM, 1, 2, { eye: ed, ring: 'T' });
    const rS = makeRing(Math.max(8, nM >> 1), 1, 2, { eye: ed, ring: 'S' });
    const apex = addV(0, 0, 1, 2); vs.aux[apex] = { eye: ed, ring: 'X' };
    rings.push(rA, rP, rT, rS);
    for (let k = 0; k < rings.length - 1; k++) stitch(rings[k].idx, rings[k].t, rings[k + 1].idx, rings[k + 1].t);
    for (let m = 0; m < rS.idx.length; m++) tris.push(rS.idx[m], rS.idx[(m + 1) % rS.idx.length], apex);
    ed.loop0 = loop0; ed.rings = rings; ed.rA = rA; ed.rP = rP; ed.rT = rT; ed.rS = rS; ed.apex = apex;
    patches.push({ type: 'eye', ed });
  }
  // ---- mouth patch: ring0 -> K lip rings -> slit -> interior rings -> apex
  {
    const loop0 = rectLoop(mouth.rect, 'right');
    const nS = lod.mouthN;
    const rings = [loop0];
    const K = lod.mouthK;
    for (let k = 1; k <= K; k++) {
      const f = 1 - Math.pow(1 - k / (K + 1), 1.25);
      const n = Math.round(lerp(loop0.idx.length, nS, Math.min(1, (k / K) * 1.4)));
      const r = makeRing(Math.max(8, n), 2, 0, { mouth: true, f, ring: k }); r.f = f; rings.push(r);
    }
    const rSl = makeRing(nS, 2, 0, { mouth: true, ring: 'slit' });
    rings.push(rSl);
    const inner = [];
    for (let k = 0; k < lod.interior; k++) { const r = makeRing(nS, 2, k === 0 ? 5 : 3, { mouth: true, ring: 'in', k }); rings.push(r); inner.push(r); }
    const apex = addV(0, 0, 2, 3); vs.aux[apex] = { mouth: true, ring: 'X' };
    for (let k = 0; k < rings.length - 1; k++) stitch(rings[k].idx, rings[k].t, rings[k + 1].idx, rings[k + 1].t);
    const last = rings[rings.length - 1];
    for (let m = 0; m < last.idx.length; m++) tris.push(last.idx[m], last.idx[(m + 1) % last.idx.length], apex);
    Object.assign(mouth, { loop0, rings, rSl, inner, apex });
    patches.push({ type: 'mouth' });
  }
  // ---- nostrils
  for (const no of nostrils) {
    const loop0 = rectLoop(no.rect, no.side > 0 ? 'right' : 'left');
    const rings = [loop0];
    const K = lod.nosK;
    for (let k = 1; k <= K + 1; k++) {
      const f = k / (K + 1);
      const r = makeRing(lod.nosN, 3, k === K + 1 ? 0 : 0, { nos: no, f, ring: k }); r.f = f; rings.push(r);
    }
    const t1 = makeRing(lod.nosN, 3, 4, { nos: no, ring: 'T1' });
    const t2 = makeRing(lod.nosN, 3, 4, { nos: no, ring: 'T2' });
    const apex = addV(0, 0, 3, 4); vs.aux[apex] = { nos: no, ring: 'X' };
    rings.push(t1, t2);
    for (let k = 0; k < rings.length - 1; k++) stitch(rings[k].idx, rings[k].t, rings[k + 1].idx, rings[k + 1].t);
    for (let m = 0; m < t2.idx.length; m++) tris.push(t2.idx[m], t2.idx[(m + 1) % t2.idx.length], apex);
    Object.assign(no, { loop0, rings, t1, t2, apex });
  }

  const NV = vs.s.length;
  const pos = new Float64Array(NV * 3);

  // ---------------------------------------------------------- pipeline: params -> positions
  const evalParam = (s, e, out, o) => {
    const ce = Math.cos(e);
    const d = [ce * Math.sin(s), Math.sin(e), ce * Math.cos(s)];
    let r = hull(C, d);
    // frontal relief: outermost crossing of z = M(x,y) along the ray
    if (d[2] > 0.15 && e > -50 * DEG && e < 80 * DEG) {
      const g = (rr) => C[2] + rr * d[2] - RL.M(C[0] + rr * d[0], C[1] + rr * d[1]);
      let hi = 0.17, ghi = g(hi);
      if (ghi > 0) {
        let lo = hi, glo = ghi;
        while (lo > 0.035) { lo -= 0.004; glo = g(lo); if (glo < 0) break; }
        if (glo < 0) {
          let a = lo, b = lo + 0.004;
          for (let it = 0; it < 14; it++) { const m = (a + b) * 0.5; if (g(m) < 0) a = m; else b = m; }
          r = smax(r, (a + b) * 0.5, 0.004);
        }
      }
    }
    out[o] = C[0] + r * d[0]; out[o + 1] = C[1] + r * d[1]; out[o + 2] = C[2] + r * d[2];
  };

  // grid head zone + pole
  for (let jr = NK; jr < ROWS; jr++) for (let i = 0; i < NI; i++) { const id = gidx(i, jr); evalParam(vs.s[id], vs.e[id], pos, id * 3); }
  evalParam(0, Math.PI / 2, pos, pole * 3);

  // ---- patch ring params (interpolated rings need param endpoints)
  for (const ed of eyes) {
    const A = ed.marginPts(0, 0); // anterior margin points (3D) for t in ring order
    const nA = ed.rA.idx.length;
    ed.rA.param = []; for (let m = 0; m < nA; m++) { const p = A(m / nA); ed.rA.param.push(paramOf(...p)); }
    for (let k = 1; k < ed.rings.length - 4; k++) {
      const r = ed.rings[k];
      for (let m = 0; m < r.idx.length; m++) {
        const t = r.t[m];
        const [s0, e0] = interpLoop(ed.loop0, t, vs.s, vs.e);
        const pA = paramOf(...A(t));
        const f = r.f; // 1 at loop0, 0 at A
        const id = r.idx[m];
        vs.s[id] = lerp(pA[0], s0, f); vs.e[id] = lerp(pA[1], e0, f);
        evalParam(vs.s[id], vs.e[id], pos, id * 3);
      }
    }
  }
  {
    const nS = mouth.rSl.idx.length;
    const slitP = (t) => { const x = F.mouthW * Math.cos(2 * Math.PI * t); const y = RL.slitY(x); return [x, y, RL.M(x, y)]; };
    mouth.slitP = slitP;
    for (let k = 1; k < mouth.rings.length - 1 - lod.interior; k++) {
      const r = mouth.rings[k];
      for (let m = 0; m < r.idx.length; m++) {
        const t = r.t[m];
        const [s0, e0] = interpLoop(mouth.loop0, t, vs.s, vs.e);
        const pS = paramOf(...slitP(t));
        const id = r.idx[m];
        vs.s[id] = lerp(s0, pS[0], r.f); vs.e[id] = lerp(e0, pS[1], r.f);
        evalParam(vs.s[id], vs.e[id], pos, id * 3);
      }
    }
    void nS;
  }
  for (const no of nostrils) {
    // opening: ellipse in param space inside the rect
    const n0 = no.loop0;
    let cs = 0, ce = 0; for (const id of n0.idx) { cs += vs.s[id]; ce += vs.e[id]; } cs /= n0.idx.length; ce /= n0.idx.length;
    let rs = 0, re = 0; for (const id of n0.idx) { rs = Math.max(rs, Math.abs(vs.s[id] - cs)); re = Math.max(re, Math.abs(vs.e[id] - ce)); }
    no.cs = cs; no.ce = ce;
    for (let k = 1; k < no.rings.length - 2; k++) {
      const r = no.rings[k];
      for (let m = 0; m < r.idx.length; m++) {
        const t = r.t[m];
        const [s0, e0] = interpLoop(n0, t, vs.s, vs.e);
        // inner ellipse: shrink toward center, tilted
        const ang = Math.atan2(e0 - ce, (s0 - cs) * 0.9);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const tilt = 0.55 * no.side;
        const ex = 0.52 * rs * (ca * Math.cos(tilt) - sa * Math.sin(tilt) * 0.0) + cs;
        const ey = 0.42 * re * sa + ce + 0.12 * re * ca * no.side * 0;
        const si = lerp(s0, ex + (sa * 0.18 * rs * tilt), 1), ei = ey;
        const id = r.idx[m];
        vs.s[id] = lerp(s0, si, r.f); vs.e[id] = lerp(e0, ei, r.f);
        evalParam(vs.s[id], vs.e[id], pos, id * 3);
      }
    }
  }

  // ---- neck rows: slide down the neck cylinder from the join row
  {
    const yBot = -0.092;
    for (let i = 0; i < NI; i++) {
      const jid = gidx(i, NK);
      const px = pos[jid * 3], py = pos[jid * 3 + 1], pz = pos[jid * 3 + 2];
      const az = Math.atan2(px / F.neckR, (pz + 0.012) / (F.neckR * 1.05));
      const nx = F.neckR * Math.sin(az), nz = -0.012 + F.neckR * 1.05 * Math.cos(az);
      for (let k = 0; k < NK; k++) {
        const f = k / NK; // 0 bottom .. ->1 join
        const y = lerp(yBot, py, Math.pow(f, 0.9));
        const w = sstep(0.0, 1.0, f);
        const id = gidx(i, k);
        const tilt = (y + 0.03) * 0.12;
        pos[id * 3] = nx + (px - nx) * w; pos[id * 3 + 1] = y; pos[id * 3 + 2] = nz + (pz - nz) * w + tilt * 0;
      }
    }
  }
  // seam column copy
  const copySeam = (P) => { for (let jr = 0; jr < ROWS; jr++) { const a = gidx(0, jr), b = gidx(NI, jr); P[b * 3] = P[a * 3]; P[b * 3 + 1] = P[a * 3 + 1]; P[b * 3 + 2] = P[a * 3 + 2]; } };
  copySeam(pos);

  // ---- 3D fields on all param-driven vertices
  const fieldList = makeFields(F);
  applyFields(fieldList, pos, NV, C);
  copySeam(pos);

  // ---- record base (pre-patch-explicit) positions for morph construction
  const base = Float64Array.from(pos);

  // ---- explicit patch geometry for a given state
  function patchState(P, st) {
    for (const ed of eyes) ed.post(P, st, vs, base);
    mouthPost(P, st);
    for (const no of nostrils) nostrilPost(no, P);
  }

  // jaw / smile deformation fields on param vertices
  const hinge = [0, 0.056, -0.006];
  const jawAngle = 18 * DEG;
  function jawWeight(id) {
    const ax = vs.aux[id];
    const x = base[id * 3], y = base[id * 3 + 1], z = base[id * 3 + 2];
    if (ax && ax.mouth && ax.ring !== undefined && (typeof ax.ring === 'number')) {
      const lower = ax.tm > 0.5;
      const xc = Math.abs(Math.cos(2 * Math.PI * ax.tm));
      const c = sstep(1.0, 0.62, xc);
      return lower ? lerp(0.5, 1, c) : lerp(0.5, 0.0, c) * (1 - ax.f * 0.0);
    }
    if (ax && ax.nos) return 0;
    if (ax && ax.eye) return 0;
    const sy = RL.slitY(clamp(x, -F.mouthW, F.mouthW));
    const axx = Math.abs(x);
    // line from mouth corner up toward the TMJ
    const lineY = sy + Math.max(0, axx - F.mouthW) * 0.75;
    let w = sstep(0.004, -0.009, y - lineY);
    w *= 1 - sstep(0.04, 0.075, Math.max(0, 0.05 - z) + Math.max(0, -y - 0.04) * 0.0);
    // under-chin / neck: fade toward the throat
    const neckD = (0.045 - z) * 0.8 + Math.max(0, -0.03 - y);
    w *= 1 - sstep(0.0, 0.05, neckD) * sstep(-0.02, -0.06, y) * 0.85;
    if (z < 0.0) w *= sstep(-0.02, 0.0, z);
    return clamp(w, 0, 1);
  }
  function rotX(p, c, a, w) {
    const ca = Math.cos(a * w), sa = Math.sin(a * w);
    const y = p[1] - c[1], z = p[2] - c[2];
    return [p[0], c[1] + y * ca - z * sa, c[2] + y * sa + z * ca];
  }
  function smileDisp(x, y, z) {
    // corners up/back, cheeks up/forward, nasolabial deepen
    const ax = Math.abs(x), sg = Math.sign(x) || 1;
    let dx = 0, dy = 0, dz = 0;
    const cy = RL.slitY(F.mouthW);
    const kc = bump(((ax - F.mouthW) / 0.016) ** 2 + ((y - cy) / 0.014) ** 2 + ((z - 0.088) / 0.03) ** 2);
    dx += sg * 0.0032 * kc; dy += 0.0034 * kc; dz -= 0.0022 * kc;
    const kk = bump(((ax - 0.036) / 0.022) ** 2 + ((y - F.yEye + 0.026) / 0.02) ** 2 + ((z - 0.07) / 0.04) ** 2);
    dy += 0.0022 * kk; dz += 0.0018 * kk; dx += sg * 0.0006 * kk;
    // upper lip stretch
    const ku = bump((x / (F.mouthW * 1.1)) ** 2 + ((y - cy - 0.006) / 0.01) ** 2 + ((z - 0.1) / 0.02) ** 2);
    dy += 0.0008 * ku; dz -= 0.0006 * ku;
    // lower lip flatten
    const kl = bump((x / (F.mouthW)) ** 2 + ((y - cy + 0.008) / 0.009) ** 2 + ((z - 0.1) / 0.02) ** 2);
    dz -= 0.0008 * kl; dy += 0.0004 * kl;
    return [dx, dy, dz];
  }
  function stateFields(P, st) {
    if (!st.mouth && !st.smile) return;
    for (let id = 0; id < NV; id++) {
      const ax = vs.aux[id];
      if (ax && (ax.ring === 'slit' || ax.ring === 'in' || ax.ring === 'X' && ax.mouth)) continue;
      let p = [P[id * 3], P[id * 3 + 1], P[id * 3 + 2]];
      if (st.smile) {
        const d = smileDisp(p[0], p[1], p[2]);
        p = [p[0] + d[0] * st.smile, p[1] + d[1] * st.smile, p[2] + d[2] * st.smile];
      }
      if (st.mouth) {
        const w = jawWeight(id);
        if (w > 0) p = rotX(p, hinge, -jawAngle * st.mouth, w);
        // upper lip lifts slightly when opening
        const ax2 = vs.aux[id];
        if (ax2 && ax2.mouth && typeof ax2.ring === 'number' && ax2.tm < 0.5) p[1] += 0.0006 * st.mouth * (1 - ax2.f);
      }
      P[id * 3] = p[0]; P[id * 3 + 1] = p[1]; P[id * 3 + 2] = p[2];
    }
  }

  // ---- mouth explicit rings
  const archZ = (x) => 0.0935 + 0.002 * (F.noseProj - 1) - 160 * x * x; // incisor labial surface depth
  mouth.archZ = archZ;
  function mouthPost(P, st) {
    const nS = mouth.rSl.idx.length;
    const open = st.mouth || 0;
    const mw = F.mouthW * (1 - 0.06 * open);
    for (let m = 0; m < nS; m++) {
      const t = m / nS;
      const cx = Math.cos(2 * Math.PI * t);
      const lower = t > 0.5;
      const x0 = F.mouthW * cx;
      const sy = RL.slitY(x0);
      const zg = RL.M(x0, sy) - 0.0003;
      const sg = lower ? -1 : 1;
      const xc = Math.abs(cx);
      const corner = sstep(1.0, 0.62, xc); // 0 at corners
      const wj = lower ? lerp(0.5, 1, corner) : lerp(0.5, 0, corner);
      const pts = [];
      const x = mw * cx;
      pts.push([x, sy, zg]);
      const za = archZ(x);
      const inner = [
        [x * 0.985, sy + sg * 0.0007 * corner, zg - 0.0022],
        [x * 0.95, sy + sg * 0.0038 * corner, Math.min(zg - 0.004, za + 0.0016)],
        [x * 0.9, sy + sg * 0.0105 * (0.3 + 0.7 * corner), za - 0.0006],
        [x * 0.82, sy + sg * 0.0125 * (0.3 + 0.7 * corner), za - 0.012],
        [x * 0.55, sy + sg * 0.009 * (0.3 + 0.7 * corner), za - 0.032],
      ];
      for (let k = 0; k < lod.interior; k++) pts.push(inner[Math.min(inner.length - 1, k + (lod.interior < 5 ? Math.floor(k * 4 / Math.max(1, lod.interior)) - k : 0))]);
      const ids = [mouth.rSl.idx[m], ...mouth.inner.map(r => r.idx[m])];
      for (let k = 0; k < ids.length; k++) {
        let p = pts[k];
        if (open > 0) {
          p = rotX(p, hinge, -jawAngle * open, wj);
          if (!lower) p[1] += 0.0006 * open * corner;
        }
        if (st.smile) {
          const d = smileDisp(p[0], p[1], Math.max(p[2], 0.085));
          const k2 = k === 0 ? 1 : 0.6;
          p = [p[0] + d[0] * st.smile * k2, p[1] + d[1] * st.smile * k2, p[2] + d[2] * st.smile * k2];
        }
        P[ids[k] * 3] = p[0]; P[ids[k] * 3 + 1] = p[1]; P[ids[k] * 3 + 2] = p[2];
      }
    }
    const ap = rotX([0, RL.slitY(0) - 0.002, archZ(0) - 0.045], hinge, -jawAngle * open, 0.5);
    P[mouth.apex * 3] = ap[0]; P[mouth.apex * 3 + 1] = ap[1]; P[mouth.apex * 3 + 2] = ap[2];
  }
  function nostrilPost(no, P) {
    const rim = no.rings[no.rings.length - 3];
    const n = rim.idx.length;
    let cx = 0, cy = 0, cz = 0;
    for (const id of rim.idx) { cx += P[id * 3]; cy += P[id * 3 + 1]; cz += P[id * 3 + 2]; }
    cx /= n; cy /= n; cz /= n;
    for (let m = 0; m < n; m++) {
      const id = rim.idx[m];
      const px = P[id * 3], py = P[id * 3 + 1], pz = P[id * 3 + 2];
      const a = no.t1.idx[m], b = no.t2.idx[m];
      P[a * 3] = lerp(px, cx, 0.22) + no.side * 0.0005; P[a * 3 + 1] = py + 0.0028; P[a * 3 + 2] = lerp(pz, cz, 0.22) - 0.0012;
      P[b * 3] = lerp(px, cx, 0.45) + no.side * 0.001; P[b * 3 + 1] = py + 0.0058; P[b * 3 + 2] = lerp(pz, cz, 0.45) - 0.0028;
    }
    P[no.apex * 3] = cx + no.side * 0.0012; P[no.apex * 3 + 1] = cy + 0.009; P[no.apex * 3 + 2] = cz - 0.004;
  }

  // ---- neutral
  patchState(pos, { blink: 0, mouth: 0, smile: 0 });
  // relax (tangential, grid+interpolated rings only), then re-apply explicit parts
  const adj = buildAdjacency(NV, tris);
  const fixed = new Uint8Array(NV);
  for (let id = 0; id < NV; id++) { const ax = vs.aux[id]; if (ax && (ax.ring === 'A' || ax.ring === 'P' || ax.ring === 'T' || ax.ring === 'S' || ax.ring === 'X' || ax.ring === 'slit' || ax.ring === 'in' || ax.ring === 'T1' || ax.ring === 'T2')) fixed[id] = 1; }
  for (let jr = 0; jr < ROWS; jr++) { fixed[gidx(0, jr)] = 1; fixed[gidx(NI, jr)] = 1; }
  fixed[pole] = 1;
  for (let i = 0; i <= NI; i++) fixed[gidx(i, 0)] = 1;
  relaxTangential(pos, adj, fixed, lod.relax, 0.35);
  copySeam(pos);
  base.set(pos);
  patchState(pos, { blink: 0, mouth: 0, smile: 0 });
  base.set(pos);

  // ---- morph targets
  const states = [{ blink: 1, mouth: 0, smile: 0 }, { blink: 0, mouth: 1, smile: 0 }, { blink: 0, mouth: 0, smile: 1 }];
  const morphs = states.map(st => {
    const P = Float64Array.from(base);
    stateFields(P, st);
    patchState(P, st);
    copySeam(P);
    const D = new Float32Array(NV * 3);
    for (let k = 0; k < NV * 3; k++) D[k] = P[k] - base[k];
    return { P, D };
  });

  // ---- UVs for patch vertices (from their param after positions are known)
  for (let id = 0; id < NV; id++) {
    const ax = vs.aux[id];
    if (vs.kind[id] === 0 || vs.kind[id] === 4) continue;
    const x = pos[id * 3], y = pos[id * 3 + 1], z = pos[id * 3 + 2];
    let px = x, py = y, pz = z;
    // interior vertices take the UV of a point near the opening
    if (ax && ax.eye && (ax.ring === 'T' || ax.ring === 'S' || ax.ring === 'X')) { const m = ax.ring === 'X' ? 0 : Math.round(ax.tm * ax.eye.rP.idx.length) % ax.eye.rP.idx.length; const j = ax.eye.rP.idx[m]; px = pos[j * 3]; py = pos[j * 3 + 1]; pz = pos[j * 3 + 2]; }
    if (ax && ax.mouth && (ax.ring === 'in' || ax.ring === 'X')) { const m = ax.ring === 'X' ? 0 : Math.round(ax.tm * mouth.rSl.idx.length) % mouth.rSl.idx.length; const j = mouth.rSl.idx[m]; px = pos[j * 3]; py = pos[j * 3 + 1] + (ax.tm > 0.5 ? -0.0006 : 0.0006); pz = pos[j * 3 + 2]; }
    if (ax && ax.nos && (ax.ring === 'T1' || ax.ring === 'T2' || ax.ring === 'X')) { const rim = ax.nos.rings[ax.nos.rings.length - 3]; const m = ax.ring === 'X' ? 0 : Math.round(ax.tm * rim.idx.length) % rim.idx.length; const j = rim.idx[m]; px = pos[j * 3]; py = pos[j * 3 + 1]; pz = pos[j * 3 + 2]; }
    const [s, e] = paramOf(px, py, pz);
    const uv = uvOfParam(s, e);
    vs.u[id] = uv[0]; vs.v[id] = uv[1];
  }

  // ---- output
  const S = F.S;
  const position = new Float32Array(NV * 3);
  for (let k = 0; k < NV * 3; k++) position[k] = pos[k] * S;
  for (const m of morphs) for (let k = 0; k < NV * 3; k++) m.D[k] *= S;
  const uv = new Float32Array(NV * 2);
  for (let id = 0; id < NV; id++) { uv[id * 2] = vs.u[id]; uv[id * 2 + 1] = vs.v[id]; }
  const tag = new Uint8Array(NV);
  for (let id = 0; id < NV; id++) tag[id] = vs.tag[id];
  const index = NV > 65535 ? new Uint32Array(tris) : new Uint16Array(tris);
  const seamPairs = []; for (let jr = 0; jr < ROWS; jr++) seamPairs.push([gidx(0, jr), gidx(NI, jr)]);

  const eyeOut = eyes.map(ed => ({
    side: ed.side, center: ed.E.map(v => v * S), radius: F.eyeR * S,
    lowerMargin: ed.rP.idx.filter((id, m) => ed.isLower(m / ed.rP.idx.length)).map(id => [pos[id * 3] * S, pos[id * 3 + 1] * S, pos[id * 3 + 2] * S]),
    rP: ed.rP.idx.slice(), tmOfP: ed.rP.t.slice(),
    caruncle: ed.caruncle().map(v => v * S),
  }));
  const landmarks = {
    eyeL: eyes[0].E.map(v => v * S), eyeR: eyes[1].E.map(v => v * S),
    noseTip: [F.noseDev * S, (F.yTip) * S, (RL.zTip) * S],
    mouth: [0, RL.slitY(0) * S, RL.M(0, RL.slitY(0)) * S],
    chin: [0, F.yPog * S, (RL.M(0, F.yPog)) * S],
    crown: [0, pos[pole * 3 + 1] * S, pos[pole * 3 + 2] * S],
    earL: [0.0735 * S, 0.069 * S, -0.010 * S], earR: [-0.0735 * S, 0.069 * S, -0.010 * S],
    browL: [0.03 * S, F.yBrow * S, (RL.M(0.03, F.yBrow) + 0.001) * S], browR: [-0.03 * S, F.yBrow * S, (RL.M(-0.03, F.yBrow) + 0.001) * S],
  };
  return {
    F, S, NV, position, uv, index, tag, seamPairs, morphs: morphs.map(m => m.D), eyes: eyeOut, landmarks,
    mouth: { hinge: hinge.map(v => v * S), jawAngle, archZ: (x) => archZ(x / S) * S, slitY: RL.slitY(0) * S, mouthW: F.mouthW * S, zSlit: RL.M(0, RL.slitY(0)) * S },
    relief: RL, rows: ROWS, cols: COLS, NK, pole, vs, posRef: pos,
  };
}

// ---------------------------------------------------------------- eye definition + lid construction
function makeEyeDef(F, E, side) {
  const R = F.eyeR / MM;           // mm
  const fw = F.fissW, fh = F.fissH;
  const lift = F.cantTilt;
  // margin control points (left eye local mm: u lateral, v up)
  const up = [[13.2 * fw, 1.4 + lift], [11.0 * fw, 2.9 + lift * 0.7], [7.5 * fw, 4.0 * fh + lift * 0.35], [3.5 * fw, 4.5 * fh], [-0.8 * fw, 4.62 * fh], [-5 * fw, 4.3 * fh], [-9 * fw, 3.25 * fh], [-12 * fw, 1.85 * fh], [-14.1 * fw, 0.45], [-15.3 * fw, -0.55]];
  const lo = [[-15.3 * fw, -0.55], [-14.2 * fw, -1.55], [-11.5 * fw, -3.3 * fh], [-7.5 * fw, -4.95 * fh], [-3 * fw, -5.75 * fh], [1.5 * fw, -5.9 * fh], [6 * fw, -5.35 * fh], [9.5 * fw, -3.9 * fh + lift * 0.2], [12 * fw, -1.6 + lift * 0.6], [13.2 * fw, 1.4 + lift]];
  const dense = (pts) => { const out = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 8; k++) { const t = k / 8; const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; const t2 = t * t, t3 = t2 * t; out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); } out.push(pts[pts.length - 1]); return out; };
  const upD = dense(up), loD = dense(lo);
  const lenOf = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
  const Lu = lenOf(upD), Ll = lenOf(loD);
  const tSplit = Lu / (Lu + Ll); // t at the medial canthus
  // arc-length param along the full loop (left-eye orientation: LC -> upper -> MC -> lower -> LC)
  const loopPts = upD.concat(loD.slice(1));
  const cum = [0]; for (let i = 1; i < loopPts.length; i++) cum.push(cum[i - 1] + Math.hypot(loopPts[i][0] - loopPts[i - 1][0], loopPts[i][1] - loopPts[i - 1][1]));
  const tot = cum[cum.length - 1];
  // concentrate samples away from the canthi a bit: t -> arc mapping
  const at = (tl) => { // tl in [0,1) left-eye loop param -> [u,v]
    let L = (((tl % 1) + 1) % 1) * tot;
    let i = 1; while (i < cum.length - 1 && cum[i] < L) i++;
    const f = (L - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    return [lerp(loopPts[i - 1][0], loopPts[i][0], f), lerp(loopPts[i - 1][1], loopPts[i][1], f)];
  };
  // height tables v(u) for upper and lower margins
  const tabU = upD.slice().reverse(), tabL = loD.slice();
  const uMC = -15.3 * fw, uLC = 13.2 * fw;
  const vUp = (u) => interpS(tabU.map(p => p[0]), tabU.map(p => p[1]), clamp(u, uMC, uLC));
  const vLo = (u) => interpS(tabL.map(p => p[0]), tabL.map(p => p[1]), clamp(u, uMC, uLC));
  const ccen = -0.5;
  const creaseH = (u) => F.creaseH * Math.max(0.3, 1 - 0.62 * ((u - ccen) / 15) ** 2);
  const lowJ = (u) => (6.5 + 1.5 * F.old) * Math.max(0.45, 1 - 0.5 * ((u - 1) / 15) ** 2);

  // lid shell: z (mm, eye-local) for a front-view point (u, v)
  const Rs = R + 0.35;
  const rho0 = 0.8 * Rs, z0 = Math.sqrt(Rs * Rs - rho0 * rho0), sl0 = rho0 / z0;
  const zShell = (u, v) => {
    const rho = Math.hypot(u, v);
    let z;
    if (rho < rho0) z = Math.sqrt(Rs * Rs - rho * rho);
    else { const d = rho - rho0; const c = u < 0 ? 0.2 : 0.075; z = z0 - sl0 * d + c * d * d; }
    z += 1.15 * Math.exp(-((rho / 6.8) ** 2)); // cornea bulge (smeared over gaze range)
    return z;
  };
  const zSphere = (u, v) => { const q = R * R - u * u - v * v; return q > 0 ? Math.sqrt(q) : -2; };
  const isLower = (tl) => tl > tSplit;
  const tmToLeft = (tm) => side > 0 ? tm : (1 - tm) % 1; // ring t (CCW) -> left-eye loop param

  const toWorld = (u, v, z) => [E[0] + side * u * MM, E[1] + v * MM, E[2] + z * MM];
  const toLocal = (p) => [side * (p[0] - E[0]) / MM, (p[1] - E[1]) / MM, (p[2] - E[2]) / MM];

  // margin point for state (blink b, smile s) at left-loop param tl
  function marginUV(tl, b, s) {
    let [u, v] = at(tl);
    const vu = vUp(u), vl = vLo(u);
    const close = vl + 0.24 * (vu - vl);
    const lower = isLower(tl);
    if (lower) v += (close - vl) * 0.12 * b + 0.9 * s * sstep(-15, -8, u) * (1 - sstep(11, 13.5, u)) - 0.0 * b;
    else v += (close - vu) * b * 0.985 - 0.45 * s;
    return [u, v];
  }
  function outwardNormal(tl) { // 2D outward normal of the margin (away from the opening)
    const a = at(tl - 0.004), c = at(tl + 0.004);
    const tx = c[0] - a[0], ty = c[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    // loop is CCW in left-eye local coords (u right, v up) -> outward = (ty, -tx)
    return [ty / l, -tx / l];
  }
  const def = {
    E, side, isLower: (tm) => isLower(tmToLeft(tm)),
    marginPts: (b, s) => (tm) => { const tl = tmToLeft(tm); const [u, v] = marginUV(tl, b, s); const n = outwardNormal(tl); const uu = u + n[0] * 0.35, vv = v + n[1] * 0.35; return toWorld(uu, vv, zShell(uu, vv) + 1.25); },
    caruncle: () => { const u = -13.0 * fw, v = -0.35; return toWorld(u, v, zShell(u, v) - 0.9); },
  };
  def.post = function (P, st, vs, base) {
    const b = st.blink || 0, s = st.smile || 0;
    const set = (id, w) => { P[id * 3] = w[0]; P[id * 3 + 1] = w[1]; P[id * 3 + 2] = w[2]; };
    // skin rings
    for (let k = 1; k < def.rings.length - 4; k++) {
      const r = def.rings[k];
      for (let m = 0; m < r.idx.length; m++) {
        const id = r.idx[m];
        const tl = tmToLeft(r.t[m]);
        const lower = isLower(tl);
        const L = toLocal([P[id * 3], P[id * 3 + 1], P[id * 3 + 2]]);
        let [u, v, zf] = L;
        const uc = clamp(u, uMC, uLC);
        const beyond = Math.max(0, u - uLC, uMC - u);
        let z;
        if (!lower) {
          const vm0 = vUp(uc);
          const hC = creaseH(uc);
          const lam = (Math.max(0, v - vm0) + beyond * 0.6) / hC;
          // blink: stretch lid below crease
          const [, vmB] = marginUV(tl, b, s);
          const vmShift = (b > 0 || s > 0) ? (vmB - vUp(at(tl)[0])) : 0;
          v += vmShift * (1 - sstep(0.05, 1.3, lam));
          const T = 1.35 + 0.45 * lam;
          const zl = zShell(u, v) + T;
          const W = sstep(0.82, 1.75, lam);
          z = lerp(zl, Math.max(zf, zl + 0.2), W);
          // crease and the fold over it
          z -= (0.55 + 0.35 * F.old) * Math.exp(-(((lam - 1.0) / 0.13) ** 2)) * (1 - 0.6 * b);
          z += F.hood * Math.exp(-(((lam - 1.32) / 0.3) ** 2)) * (1 - 0.3 * b);
          // slight orbital hollow above the fold (sulcus) for older / deep-set eyes
          z -= (0.25 + 0.9 * F.old) * Math.exp(-(((lam - 2.0) / 0.4) ** 2));
        } else {
          const vm0 = vLo(uc);
          const hJ = lowJ(uc);
          const mu = (Math.max(0, vm0 - v) + beyond * 0.6) / hJ;
          const [, vmB] = marginUV(tl, b, s);
          const vmShift = (b > 0 || s > 0) ? (vmB - vLo(at(tl)[0])) : 0;
          v += vmShift * (1 - sstep(0.05, 1.1, mu));
          const T = 1.25 + 0.35 * mu;
          const zl = zShell(u, v) + T;
          const W = sstep(0.45, 1.3, mu);
          z = lerp(zl, Math.max(zf, zl - 0.2), W);
          z += (0.32 + 0.35 * s) * Math.exp(-(((mu - 0.28) / 0.2) ** 2)); // pretarsal roll
          z -= (0.25 + 0.75 * F.old) * Math.exp(-(((mu - 1.0) / 0.2) ** 2)); // lid-cheek junction
          z += F.bags * Math.exp(-(((mu - 0.66) / 0.28) ** 2));
        }
        // never inside the eyeball
        const rr = Math.hypot(u, v, z);
        if (rr < R + 0.9 && z > 0) { const k2 = (R + 0.9) / rr; u *= 1; z = Math.sqrt(Math.max(0, (R + 0.9) ** 2 - u * u - v * v)); void k2; }
        set(id, toWorld(u, v, z));
      }
    }
    // explicit margin rings
    const nM = def.rA.idx.length;
    for (let m = 0; m < nM; m++) {
      const tm = m / nM, tl = tmToLeft(tm);
      const lower = isLower(tl);
      const [u, v] = marginUV(tl, b, s);
      const n = outwardNormal(tl);
      const T = lower ? 1.25 : 1.35;
      // A: anterior edge (lash line)
      const ua = u + n[0] * 0.35, va = v + n[1] * 0.35;
      set(def.rA.idx[m], toWorld(ua, va, zShell(ua, va) + T));
      // P: posterior edge on the globe
      set(def.rP.idx[m], toWorld(u, v, zShell(u, v) + 0.08));
      // T: tuck behind the globe surface
      const ut = u + n[0] * 1.4, vt = v + n[1] * 1.4;
      const zs = zSphere(ut, vt);
      set(def.rT.idx[m], toWorld(ut, vt, (zs > 0 ? zs : zShell(ut, vt) - 1.0) - 1.2));
    }
    const nS = def.rS.idx.length;
    for (let m = 0; m < nS; m++) {
      const tl = tmToLeft(m / nS);
      const [u, v] = marginUV(tl, b * 0.5, 0);
      set(def.rS.idx[m], toWorld(u * 0.75, v * 0.75, -3.5));
    }
    set(def.apex, toWorld(0, 0, -8));
  };
  return def;
}

// ---------------------------------------------------------------- mesh utilities
function buildAdjacency(NV, tris) {
  const sets = Array.from({ length: NV }, () => new Set());
  for (let k = 0; k < tris.length; k += 3) {
    const a = tris[k], b = tris[k + 1], c = tris[k + 2];
    sets[a].add(b); sets[a].add(c); sets[b].add(a); sets[b].add(c); sets[c].add(a); sets[c].add(b);
  }
  return sets.map(s => Int32Array.from(s));
}
function relaxTangential(pos, adj, fixed, iters, k) {
  const NV = adj.length;
  const tmp = new Float64Array(pos.length);
  for (let it = 0; it < iters; it++) {
    tmp.set(pos);
    for (let i = 0; i < NV; i++) {
      if (fixed[i]) continue;
      const nb = adj[i];
      if (nb.length < 3) continue;
      let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < nb.length; j++) { const q = nb[j] * 3; cx += tmp[q]; cy += tmp[q + 1]; cz += tmp[q + 2]; }
      cx /= nb.length; cy /= nb.length; cz /= nb.length;
      // normal estimate from the neighbour ring (fan cross products)
      const px = tmp[i * 3], py = tmp[i * 3 + 1], pz = tmp[i * 3 + 2];
      let nx = 0, ny = 0, nz = 0;
      for (let j = 0; j < nb.length; j++) {
        const a = nb[j] * 3, b = nb[(j + 1) % nb.length] * 3;
        const ax = tmp[a] - px, ay = tmp[a + 1] - py, az = tmp[a + 2] - pz, bx = tmp[b] - px, by = tmp[b + 1] - py, bz = tmp[b + 2] - pz;
        nx += ay * bz - az * by; ny += az * bx - ax * bz; nz += ax * by - ay * bx;
      }
      const nl = Math.hypot(nx, ny, nz);
      let dx = cx - px, dy = cy - py, dz = cz - pz;
      if (nl > 1e-12) { nx /= nl; ny /= nl; nz /= nl; const dn = dx * nx + dy * ny + dz * nz; dx -= dn * nx; dy -= dn * ny; dz -= dn * nz; }
      else continue;
      pos[i * 3] = px + dx * k; pos[i * 3 + 1] = py + dy * k; pos[i * 3 + 2] = pz + dz * k;
    }
  }
}

export function computeNormals(position, index, seamPairs) {
  const n = new Float32Array(position.length);
  for (let k = 0; k < index.length; k += 3) {
    const a = index[k] * 3, b = index[k + 1] * 3, c = index[k + 2] * 3;
    const abx = position[b] - position[a], aby = position[b + 1] - position[a + 1], abz = position[b + 2] - position[a + 2];
    const acx = position[c] - position[a], acy = position[c + 1] - position[a + 1], acz = position[c + 2] - position[a + 2];
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    n[a] += nx; n[a + 1] += ny; n[a + 2] += nz; n[b] += nx; n[b + 1] += ny; n[b + 2] += nz; n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
  }
  if (seamPairs) for (const [a, b] of seamPairs) for (let k = 0; k < 3; k++) { const s = n[a * 3 + k] + n[b * 3 + k]; n[a * 3 + k] = s; n[b * 3 + k] = s; }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}
