// head_a sculpt: one continuous skin surface (face, skull, neck stub) built from a dense
// sphere-topology grid (azimuth x elevation around a ray origin, pole at the crown, open at the neck),
// shaped by layered landmark-anchored deformation fields:
//   1. radial smooth union of anatomical masses (cranium, parietals, occiput, zygoma, mandible, neck)
//   2. the frontal face relief (head_a_relief.js) met along each ray
//   3. 3D bump / ridge fields (temples, jaw angle, neck muscles, larynx ...)
//   4. ring patches cut into the grid for the eyes (lids draped over the globe, head_a_lids.js), the
//      mouth (lips, slit, oral cavity) and the nostrils (real openings), re-built per expression state
// Rows are distributed along each column by weighted 3D arc length, so steep regions (nose base,
// under the chin) get enough vertices without any shrinking smoothing. Morph targets (blink, mouth
// open, smile) come from the same pipeline. Everything is computed here from code.
import { clamp, lerp, sstep, smax, bump } from './head_a_util.js';
import { faceSpec } from './head_a_spec.js';
import { makeRelief } from './head_a_relief.js';
import { makeEyeLids } from './head_a_lids.js';

const DEG = Math.PI / 180;
const E_J = -54 * DEG;
const MM = 0.001;

export const LODS = {
  high: {
    NI: 128, NJ: 86, NK: 7, samples: 260,
    eyeN: 72, eyeLam: [0.07, 0.17, 0.3, 0.45, 0.62, 0.8, 0.92, 1.0, 1.09, 1.22, 1.4, 1.62, 1.9], eyeFill: 2, eyeTuck: true,
    mouthN: 96, mouthLam: [0.1, 0.25, 0.42, 0.6, 0.76, 0.88, 0.96, 1.0, 1.05, 1.14, 1.3, 1.55, 1.85], mouthFill: 2, interior: 5,
    noseR: 22, noseN: 64, uvH: 0.86,
  },
  medium: {
    NI: 66, NJ: 44, NK: 4, samples: 160,
    eyeN: 32, eyeLam: [0.2, 0.5, 0.8, 1.0, 1.25, 1.6], eyeFill: 1, eyeTuck: true,
    mouthN: 44, mouthLam: [0.3, 0.7, 1.0, 1.2, 1.6], mouthFill: 1, interior: 3,
    noseR: 10, noseN: 32, uvH: 0.86,
  },
  low: {
    NI: 30, NJ: 21, NK: 2, samples: 90,
    eyeN: 12, eyeLam: [0.6, 1.2], eyeFill: 0, eyeTuck: false,
    mouthN: 16, mouthLam: [0.6, 1.2], mouthFill: 0, interior: 1,
    noseR: 0, noseN: 0, uvH: 0.86,
  },
};

// ---------------------------------------------------------------- 1D density tables
function cdfTable(rho, a, b, N = 1024) {
  const xs = new Float64Array(N + 1), cs = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) xs[i] = a + (b - a) * i / N;
  for (let i = 0; i < N; i++) cs[i + 1] = cs[i] + rho((xs[i] + xs[i + 1]) * 0.5);
  const tot = cs[N];
  for (let i = 0; i <= N; i++) cs[i] /= tot;
  return { xs, cs, N };
}
function invCdf(T, u) {
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
let TSAZ = null;
function azTable() {
  if (!TSAZ) TSAZ = cdfTable(s => 0.26 + 0.72 * Math.exp(-Math.pow(Math.abs(s) / 1.2, 5)) + 0.62 * Math.exp(-((s / 0.36) ** 2)), -Math.PI, Math.PI, 2048);
  return TSAZ;
}

// ---------------------------------------------------------------- hull primitives (radial union)
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function ellip(c, r, axes) { return { c, ir: [1 / r[0], 1 / r[1], 1 / r[2]], axes: axes || null }; }
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
function frameFrom(dir) {
  const a = norm3(dir);
  let up = [0, 1, 0];
  if (Math.abs(a[1]) > 0.9) up = [1, 0, 0];
  const b = norm3(cross3(up, a)); const c = cross3(a, b);
  return [a, c, b];
}
function makeHull(F) {
  // every primitive contains the ray origin C = (0, 0.02, 0), so each radial distance is smooth and
  // the radial smooth union has no silhouette creases
  const jw = F.jawW, cw = F.cheekW, fw = F.foreW;
  const tilt = 22 * DEG;
  const jawAx = [[1, 0, 0], [0, Math.cos(tilt), Math.sin(tilt)], [0, -Math.sin(tilt), Math.cos(tilt)]];
  const prims = [
    [ellip([0, 0.086, -0.012], [0.0715 * fw, 0.109, 0.094]), 0],                  // cranium
    [ellip([0, 0.090, -0.030], [0.0775 * fw, 0.105, 0.079]), 0.012],              // parietal breadth
    [ellip([0, 0.062, -0.034], [0.060, 0.066, 0.074]), 0.012],                    // occiput
    [ellip([0, 0.117, -0.014], [0.0775 * fw, 0.078, 0.084]), 0.014],             // vault (silhouette from C lies deep inside)
    [ellip([0, 0.100, 0.000], [0.070 * fw, 0.0955, 0.106]), 0.012],              // forehead / temples
    [ellip([0, 0.055, 0.000], [0.0725 * cw, 0.062, 0.092]), 0.012],              // zygomatic level
    [ellip([0, 0.038, 0.012], [0.063 * cw, 0.056, 0.080]), 0.012],                // midface
    [ellip([0, -0.004 + 0.003 * F.sh.faceLength, 0.008], [0.0525 * jw, 0.043 + 0.003 * F.sh.faceLength, 0.079 + F.chinProj], jawAx), 0.010], // jaw block
  ];
  const neck = { a: F.neckR, b: F.neckR * 1.05, cz: -0.012, yTop: 0.07 };
  const rayNeck = (o, d) => {
    const ox = o[0] / neck.a, oz = (o[2] - neck.cz) / neck.b, dx = d[0] / neck.a, dz = d[2] / neck.b;
    const A = dx * dx + dz * dz, B = 2 * (ox * dx + oz * dz), Cc = ox * ox + oz * oz - 1;
    let t = 0;
    if (A > 1e-12) { const disc = B * B - 4 * A * Cc; if (disc >= 0) t = (-B + Math.sqrt(disc)) / (2 * A); } else t = 10;
    if (d[1] > 1e-6) t = Math.min(t, (neck.yTop - o[1]) / d[1]);
    return Math.max(0, t);
  };
  const hull = function (o, d) {
    let r = 0;
    for (let i = 0; i < prims.length; i++) {
      const ri = rayEllip(prims[i][0], o, d);
      r = i === 0 ? ri : smax(r, ri, prims[i][1]);
    }
    return smax(r, rayNeck(o, d), 0.014);
  };
  hull.neck = neck;
  return hull;
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
    L.push({ curve: [[sd * 0.052, 0.025, -0.034], [sd * 0.042, -0.02, -0.005], [sd * 0.026, -0.07, 0.028], [sd * 0.014, -0.11, 0.046]], w: 0.0095, a: 0.0022 * (1 - 0.4 * F.fem) });
  }
  L.push({ c: [0, -0.066, 0.046], r: [0.0085, 0.013, 0.012], a: F.adam, dir: [0, 0.1, 1] });
  L.push({ c: [0, -0.056, 0.05], r: [0.03, 0.012, 0.03], a: 0.0026 * F.old });
  L.push({ c: [0, -0.088, 0.046], r: [0.012, 0.014, 0.015], a: -0.0016 });
  L.push({ c: [0, 0.04, -0.07], r: [0.018, 0.03, 0.02], a: -0.0015 });
  for (const f of L) {
    if (f.curve) {
      const mn = [1, 1, 1], mx = [-1, -1, -1];
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
function fieldDisp(L, p, C, out) {
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
    const v = f.dir ? f.dir : [p[0] - C[0], (p[1] - C[1]) * 0.6, p[2] - C[2]];
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    dx += f.a * w * v[0] / l; dy += f.a * w * v[1] / l; dz += f.a * w * v[2] / l;
  }
  out[0] = dx; out[1] = dy; out[2] = dz;
  return out;
}

// ---------------------------------------------------------------- generic helpers
const PHI = (x) => (x < 0.55 ? x : 1 - 0.45 * Math.exp(-(x - 0.55) / 0.45));
function angleTable(n, fn2) { // fn2(t) -> [a,b] around the origin; returns unwrapped angles at t = k/n
  const A = new Float64Array(n + 1);
  let prev = 0;
  for (let k = 0; k <= n; k++) {
    const p = fn2(k / n);
    let a = Math.atan2(p[1], p[0]);
    if (k > 0) { while (a < prev - Math.PI) a += 2 * Math.PI; while (a > prev + Math.PI) a -= 2 * Math.PI; }
    A[k] = a; prev = a;
  }
  return A;
}
function tOfAngle(A, a) { // A ascending unwrapped over one turn; a any angle
  const n = A.length - 1;
  const a0 = A[0];
  let x = a;
  while (x < a0) x += 2 * Math.PI;
  while (x >= a0 + 2 * Math.PI) x -= 2 * Math.PI;
  let lo = 0, hi = n;
  if (x >= A[n]) return ((n - 1) + (x - A[n - 1]) / Math.max(1e-9, A[n] - A[n - 1])) / n % 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= x) lo = m; else hi = m; }
  return (lo + (x - A[lo]) / Math.max(1e-12, A[hi] - A[lo])) / n;
}

// ---------------------------------------------------------------- mesh builder
export function buildHeadData(params) {
  const F = faceSpec(params);
  const lod = LODS[params.detail] || LODS.high;
  const C = F.C;
  const hull = makeHull(F);
  const RL = makeRelief(F);
  const M = RL.M;
  const TS = azTable();
  const NI = lod.NI, NJ = lod.NJ, NK = lod.NK;
  const ROWS = NK + NJ, COLS = NI + 1;

  // ---- surface along a ray from C
  const dTmp = [0, 0, 0];
  function rayR(s, e) {
    const ce = Math.cos(e);
    const dx = ce * Math.sin(s), dy = Math.sin(e), dz = ce * Math.cos(s);
    dTmp[0] = dx; dTmp[1] = dy; dTmp[2] = dz;
    let r = hull(C, dTmp);
    if (dz > 0.12 && e > -62 * DEG && e < 84 * DEG && !params.__noRelief) {
      const g = (rr) => C[2] + rr * dz - M(C[0] + rr * dx, C[1] + rr * dy);
      const hi = 0.24;
      if (g(hi) > 0) {
        let lo = hi, glo = 1;
        while (lo > 0.03) { lo -= 0.0035; glo = g(lo); if (glo < 0) break; }
        if (glo < 0) {
          let a = lo, b = lo + 0.0035;
          for (let it = 0; it < 13; it++) { const m = (a + b) * 0.5; if (g(m) < 0) a = m; else b = m; }
          const rf = (a + b) * 0.5;
          const w = RL.mask(C[0] + rf * dx, C[1] + rf * dy);
          if (w > 0) r += w * (rf - r);
        }
      }
    }
    return r;
  }
  if (params.__debugRay) return { rayR, hull, RL, C };
  const pOf = (s, e, r) => { const ce = Math.cos(e); return [C[0] + r * ce * Math.sin(s), C[1] + r * Math.sin(e), C[2] + r * ce * Math.cos(s)]; };
  const paramOf = (x, y, z) => [Math.atan2(x - C[0], z - C[2]), Math.atan2(y - C[1], Math.hypot(x - C[0], z - C[2]))];

  // ---- row density (per unit 3D length) as a function of azimuth / elevation
  const eAt = (y, z) => Math.atan2(y - C[1], z);
  const eChin = eAt(F.yPog, 0.087), eTip = eAt(F.yTip, 0.12), eBrow = eAt(F.yBrow, 0.098), eEye = eAt(F.yEye, 0.088);
  const rhoE = (s, e) => {
    const wf = Math.exp(-Math.pow(Math.abs(s) / 1.25, 4));
    const front = 0.42 + 0.62 * sstep(E_J - 0.05, E_J + 0.12, e) * (1 - sstep(eBrow + 0.06, eBrow + 0.22, e)) + 0.45 * gk(e, eTip - 0.03, 0.09) + 0.2 * gk(e, eChin, 0.1) - 0.18 * gk(e, eEye, 0.12);
    const back = 0.55;
    return lerp(back, front, wf);
  };

  // ---- columns: azimuth by density, rows by weighted arc length
  const colS = new Float64Array(COLS);
  for (let i = 0; i < COLS; i++) colS[i] = invCdf(TS, i / NI);
  colS[NI] = colS[0] + 2 * Math.PI;
  const NSm = lod.samples;
  const eTab = [];       // per column: NJ+1 elevations (last = pole)
  const sampE = new Float64Array(NSm), sampA = new Float64Array(NSm);
  for (let i = 0; i < NI; i++) {
    const s = colS[i];
    let prev = null;
    for (let m = 0; m < NSm; m++) {
      const e = E_J + (Math.PI / 2 - E_J) * m / (NSm - 1);
      sampE[m] = e;
      const p = pOf(s, e, rayR(s, e));
      if (prev) sampA[m] = sampA[m - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) * rhoE(s, e - 0.5 * (Math.PI / 2 - E_J) / (NSm - 1));
      else sampA[m] = 0;
      prev = p;
    }
    const tot = sampA[NSm - 1];
    const tab = new Float64Array(NJ + 1);
    let m = 0;
    for (let j = 0; j <= NJ; j++) {
      const a = tot * j / NJ;
      while (m < NSm - 2 && sampA[m + 1] < a) m++;
      const f = clamp((a - sampA[m]) / Math.max(1e-12, sampA[m + 1] - sampA[m]), 0, 1);
      tab[j] = lerp(sampE[m], sampE[m + 1], f);
    }
    tab[0] = E_J; tab[NJ] = Math.PI / 2;
    eTab.push(tab);
  }
  // smooth the row elevations across neighbouring columns so rows stay coherent curves
  for (let pass = 0; pass < 6; pass++) {
    const prevT = eTab.map(t => Float64Array.from(t));
    for (let i = 0; i < NI; i++) {
      const a = prevT[(i - 1 + NI) % NI], b = prevT[i], c = prevT[(i + 1) % NI];
      for (let j = 1; j < NJ; j++) eTab[i][j] = 0.25 * a[j] + 0.5 * b[j] + 0.25 * c[j];
    }
  }
  eTab.push(eTab[0]);

  // index-space coordinates of a 3D point
  const idxOf = (p) => {
    const [s, e] = paramOf(p[0], p[1], p[2]);
    const fi = cdf(TS, s) * NI;
    const i0 = Math.min(NI - 1, Math.max(0, Math.floor(fi))), fr = fi - i0;
    const jOf = (tab) => {
      if (e <= tab[0]) return 0;
      if (e >= tab[NJ]) return NJ;
      let lo = 0, hi = NJ;
      while (hi - lo > 1) { const mm = (lo + hi) >> 1; if (tab[mm] <= e) lo = mm; else hi = mm; }
      return lo + (e - tab[lo]) / (tab[hi] - tab[lo]);
    };
    const j = lerp(jOf(eTab[i0]), jOf(eTab[i0 + 1]), fr);
    return [fi, NK + j];
  };
  const uvH = lod.uvH;
  const uvOf = (p) => { const [fi, fr] = idxOf(p); return [fi / NI, fr / ROWS * uvH]; };

  // ---- vertex store
  const PX = [], PY = [], PZ = [], KIND = [], TAG = [], UVS = [];
  const addV = (p, kind, tag = 0) => { PX.push(p[0]); PY.push(p[1]); PZ.push(p[2]); KIND.push(kind); TAG.push(tag); UVS.push(-1); return PX.length - 1; };
  const gidx = (i, r) => r * COLS + i;
  for (let r = 0; r < ROWS; r++) for (let i = 0; i < COLS; i++) addV([0, 0, 0], r < NK ? 4 : 0);
  const pole = addV(pOf(0, Math.PI / 2, rayR(0, Math.PI / 2)), 0);
  const gridE = new Float64Array(ROWS * COLS);
  for (let r = NK; r < ROWS; r++) for (let i = 0; i < NI; i++) {
    const s = colS[i], e = eTab[i][r - NK];
    const p = pOf(s, e, rayR(s, e));
    const id = gidx(i, r);
    PX[id] = p[0]; PY[id] = p[1]; PZ[id] = p[2]; gridE[id] = e;
  }
  // neck rows: slide down the neck cylinder from the join row
  {
    const yBot = -0.094;
    for (let i = 0; i < NI; i++) {
      const jid = gidx(i, NK);
      const px = PX[jid], py = PY[jid], pz = PZ[jid];
      const az = Math.atan2(px / F.neckR, (pz + 0.012) / (F.neckR * 1.05));
      const nx = F.neckR * Math.sin(az), nz = -0.012 + F.neckR * 1.05 * Math.cos(az);
      for (let k = 0; k < NK; k++) {
        const f = k / NK;
        const y = lerp(yBot, py, Math.pow(f, 0.85));
        const w = sstep(0.0, 1.0, f) * sstep(0, 1, f);
        const id = gidx(i, k);
        PX[id] = nx + (px - nx) * w; PY[id] = y; PZ[id] = nz + (pz - nz) * w;
      }
    }
  }
  const copySeam = (X, Y, Z) => { for (let r = 0; r < ROWS; r++) { const a = gidx(0, r), b = gidx(NI, r); X[b] = X[a]; Y[b] = Y[a]; Z[b] = Z[a]; } };
  copySeam(PX, PY, PZ);
  // 3D detail fields on the grid
  const fieldList = makeFields(F);
  {
    const tmp = [0, 0, 0], d = [0, 0, 0];
    for (let id = 0; id < ROWS * COLS; id++) {
      tmp[0] = PX[id]; tmp[1] = PY[id]; tmp[2] = PZ[id];
      fieldDisp(fieldList, tmp, C, d);
      PX[id] += d[0]; PY[id] += d[1]; PZ[id] += d[2];
    }
    copySeam(PX, PY, PZ);
  }
  // grid UVs
  for (let r = 0; r < ROWS; r++) for (let i = 0; i < COLS; i++) UVS[gidx(i, r)] = [i / NI, r / ROWS * uvH];
  UVS[pole] = [0.5, uvH];

  // ---------------------------------------------------------- holes (footprints in frontal x,y)
  // each feature claims the grid quads whose centroid lies inside its footprint; pinch points are
  // repaired and the boundary loop is traced, so holes follow the face, not the grid's row warping
  const lids = [makeEyeLids(F, 1), makeEyeLids(F, -1)];
  const mw = F.mouthW;
  const sy0f = RL.slitY(0);
  const se4 = (a, b) => a * a * a * a + b * b * b * b;
  const fps = [];
  for (const L of lids) fps.push((x, y) => { const u = L.side * (x - L.E[0]) / MM, v = (y - L.E[1]) / MM; return se4((u + 0.5) / 20.8, (v - 1.6) / 19.2) < 1; });
  const mTop = F.ySub - 0.0026, mBot = sy0f - F.tl * 1.95 - 0.004, mCy = (mTop + mBot) / 2, mHy = (mTop - mBot) / 2, mHx = mw + 0.0105;
  fps.push((x, y) => se4(x / mHx, (y - mCy) / mHy) < 1);
  const noseOn = lod.noseR > 0;
  const nBot = F.ySub - 0.0012, nTop = Math.min(F.yTip + 0.026, F.yEye - 0.013), nW0 = 0.0185 * F.noseW + 0.0062;
  if (noseOn) fps.push((x, y) => {
    if (y < nBot || y > nTop) return false;
    const yb = (y - nBot) / 0.004;
    const hwN = y < F.yTip + 0.006 ? nW0 : lerp(nW0, 0.0092, sstep(F.yTip + 0.006, F.yTip + 0.02, y));
    return Math.abs(x - F.noseDev) < hwN * (yb < 1 ? Math.sqrt(Math.max(0, 1 - (1 - yb) ** 2)) * 0.15 + 0.85 : 1);
  });
  const NQ = NI * (ROWS - 1);
  const qHole = new Int8Array(NQ).fill(-1);
  for (let r = NK + 1; r < ROWS - 2; r++) for (let i = 0; i < NI; i++) {
    const a = gidx(i, r), b = gidx(i + 1, r), c = gidx(i + 1, r + 1), d = gidx(i, r + 1);
    if ((PZ[a] + PZ[c]) * 0.5 < 0.02) continue;
    const x = (PX[a] + PX[b] + PX[c] + PX[d]) * 0.25, y = (PY[a] + PY[b] + PY[c] + PY[d]) * 0.25;
    for (let h = 0; h < fps.length; h++) if (fps[h](x, y)) { qHole[r * NI + i] = h; break; }
  }
  // repair: fill quads surrounded by one hole, break diagonal pinches
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (let r = NK + 2; r < ROWS - 3; r++) for (let i = 1; i < NI - 1; i++) {
      const q = r * NI + i;
      if (qHole[q] >= 0) continue;
      const nb = [qHole[q - 1], qHole[q + 1], qHole[q - NI], qHole[q + NI]];
      for (let h = 0; h < fps.length; h++) if (nb.filter(v => v === h).length >= 3) { qHole[q] = h; changed = true; break; }
    }
    for (let r = NK + 2; r < ROWS - 3; r++) for (let i = 1; i < NI - 1; i++) { // vertex (i,r) with quads q00 (i-1,r-1), q10 (i,r-1), q01 (i-1,r), q11 (i,r)
      const q00 = (r - 1) * NI + i - 1, q10 = q00 + 1, q01 = q00 + NI, q11 = q01 + 1;
      for (let h = 0; h < fps.length; h++) {
        const A = qHole[q00] === h, B = qHole[q10] === h, Cq = qHole[q01] === h, Dq = qHole[q11] === h;
        if (A && Dq && !B && !Cq) { if (qHole[q10] < 0) qHole[q10] = h; else if (qHole[q01] < 0) qHole[q01] = h; changed = true; }
        else if (B && Cq && !A && !Dq) { if (qHole[q00] < 0) qHole[q00] = h; else if (qHole[q11] < 0) qHole[q11] = h; changed = true; }
      }
    }
    if (!changed) break;
  }
  const traceLoop = (h) => {
    const next = new Map();
    const has = (r, i) => i >= 0 && i < NI && r >= 0 && r < ROWS - 1 && qHole[r * NI + i] === h;
    for (let r = 0; r < ROWS - 1; r++) for (let i = 0; i < NI; i++) {
      if (!has(r, i)) continue;
      const a = gidx(i, r), b = gidx(i + 1, r), c = gidx(i + 1, r + 1), d = gidx(i, r + 1);
      if (!has(r - 1, i)) next.set(a, b);
      if (!has(r, i + 1)) next.set(b, c);
      if (!has(r + 1, i)) next.set(c, d);
      if (!has(r, i - 1)) next.set(d, a);
    }
    if (!next.size) return null;
    const start = next.keys().next().value;
    const L = [start];
    let v = next.get(start), guard = 0;
    while (v !== start && guard++ < 100000) { L.push(v); v = next.get(v); }
    if (L.length !== next.size) console.warn('head_a: hole', h, 'boundary not a single loop', L.length, next.size);
    return L;
  };
  const inHole = (i, r) => qHole[r * NI + i] >= 0;
  // ---------------------------------------------------------- triangles
  const tris = [];
  const P3 = (id) => [PX[id], PY[id], PZ[id]];
  const d2 = (a, b) => (PX[a] - PX[b]) ** 2 + (PY[a] - PY[b]) ** 2 + (PZ[a] - PZ[b]) ** 2;
  for (let r = 0; r < ROWS - 1; r++) for (let i = 0; i < NI; i++) {
    if (inHole(i, r)) continue;
    const a = gidx(i, r), b = gidx(i + 1, r), c = gidx(i + 1, r + 1), d = gidx(i, r + 1);
    if (d2(a, c) <= d2(b, d)) tris.push(a, b, c, a, c, d); else tris.push(a, b, d, b, c, d);
  }
  for (let i = 0; i < NI; i++) tris.push(gidx(i, ROWS - 1), gidx(i + 1, ROWS - 1), pole);

  // stitch two loops given as {idx, t} with t ascending in [0,1)
  function stitch(A, B, flip) {
    const na = A.idx.length, nb = B.idx.length;
    let i = 0, j = 0;
    const push = (a, b, c) => { if (flip) tris.push(a, c, b); else tris.push(a, b, c); };
    while (i < na || j < nb) {
      const ta = i < na ? (i + 1 < na ? A.t[i + 1] : A.t[0] + 1) : Infinity;
      const tb = j < nb ? (j + 1 < nb ? B.t[j + 1] : B.t[0] + 1) : Infinity;
      if (ta <= tb) { push(A.idx[i % na], A.idx[(i + 1) % na], B.idx[j % nb]); i++; } else { push(A.idx[i % na], B.idx[(j + 1) % nb], B.idx[j % nb]); j++; }
    }
  }
  function fan(A, apex, flip) {
    const n = A.idx.length;
    for (let m = 0; m < n; m++) { const a = A.idx[m], b = A.idx[(m + 1) % n]; if (flip) tris.push(a, apex, b); else tris.push(a, b, apex); }
  }
  // boundary loop param: polar angle in a 2D projection matched to the inner loop's angle table
  function boundaryParam(ids, to2, center, angTab) {
    const pts = ids.map(id => { const q = to2(P3(id)); return [q[0] - center[0], q[1] - center[1]]; });
    let area = 0;
    for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; area += a[0] * b[1] - a[1] * b[0]; }
    let order = ids.map((id, k) => k);
    const flip = area < 0;
    if (flip) order = order.reverse();
    // keep the loop order (every boundary edge is stitched exactly once); parameter from the polar
    // angle, made monotone starting at the smallest one
    const raw = order.map(k => tOfAngle(angTab, Math.atan2(pts[k][1], pts[k][0])));
    let k0 = 0; for (let k = 1; k < raw.length; k++) if (raw[k] < raw[k0]) k0 = k;
    const items = [];
    let prev = -1;
    for (let q = 0; q < raw.length; q++) {
      const k = (k0 + q) % raw.length;
      let t = raw[k];
      if (q > 0 && t < prev - 0.5) t += 1; // wrapped
      if (t <= prev) t = prev + 1e-5;
      prev = t;
      items.push({ id: ids[order[k]], t: Math.min(t, 0.99999), p2: pts[order[k]] });
    }
    for (let q = items.length - 2; q >= 0; q--) if (items[q].t >= items[q + 1].t) items[q].t = items[q + 1].t - 1e-6;
    return { idx: items.map(it => it.id), t: items.map(it => it.t), flip, pts: items };
  }
  // point on the boundary polygon at parameter t (linear between boundary vertices), 3D
  function boundaryAt(Bd, t) {
    const n = Bd.t.length;
    let k = n - 1;
    for (let q = 0; q < n; q++) if (Bd.t[q] > t) { k = q - 1; break; }
    let a, b, ta, tb;
    if (k < 0) { a = Bd.idx[n - 1]; b = Bd.idx[0]; ta = Bd.t[n - 1] - 1; tb = Bd.t[0]; } else { a = Bd.idx[k]; b = Bd.idx[(k + 1) % n]; ta = Bd.t[k]; tb = k + 1 < n ? Bd.t[k + 1] : Bd.t[0] + 1; }
    const f = clamp((t - ta) / Math.max(1e-9, tb - ta), 0, 1);
    return [lerp(PX[a], PX[b], f), lerp(PY[a], PY[b], f), lerp(PZ[a], PZ[b], f)];
  }
  const ringT = (n, ph = 0) => { const t = []; for (let m = 0; m < n; m++) t.push((m + ph) / n); return t; };

  // ---------------------------------------------------------- eye patches
  // each patch vertex keeps a recipe so it can be rebuilt for any expression state
  const eyeV = []; // {id, L, tl, kind: 'skin'|'A'|'P'|'T'|'X', lam?, d?, D?, dir?, crease?}
  const eyes = [];
  lids.forEach((L, li) => {
    const ids = traceLoop(li);
    const to2 = (p) => { const q = L.toLocal(p); return [q[0], q[1]]; };
    const cen = [-1.0, 0.3];
    const ang = angleTable(720, (t) => { const m = L.at(t); return [m[0] - cen[0], m[1] - cen[1]]; });
    const Bd = boundaryParam(ids, to2, cen, ang);
    const flip = Bd.flip;
    const rings = [];
    const nM = lod.eyeN;
    const lamList = lod.eyeLam;
    const K = lamList.length, J = lod.eyeFill;
    // per-t geometry, cached by t
    const geo = (tl) => {
      const m0 = L.at(tl);
      const B3 = boundaryAt(Bd, tl);
      const Bl = L.toLocal(B3);
      let dx = Bl[0] - m0[0], dy = Bl[1] - m0[1];
      const D = Math.hypot(dx, dy) || 1; dx /= D; dy /= D;
      return { m0, dir: [dx, dy], D, h: L.hOf(tl), wU: L.wUp(tl) };
    };
    for (let k = 0; k < K; k++) {
      const n = Math.round(lerp(nM, Math.max(nM * 0.85, Bd.idx.length), Math.pow(k / Math.max(1, K + J), 1.5)));
      const t = ringT(n, (k % 2) * 0.5);
      const idx = [];
      for (const tl of t) {
        const g = geo(tl);
        const d = g.D * PHI(lamList[k] * g.h / g.D);
        const id = addV([0, 0, 0], 1, 0);
        eyeV.push({ id, L, tl, kind: 'skin', g, d, dQ: g.D * PHI(g.h / g.D), lamN: lamList[k] });
        idx.push(id);
      }
      rings.push({ idx, t });
    }
    for (let j = 1; j <= J; j++) {
      const n = Math.round(lerp(nM * 0.85, Bd.idx.length, j / (J + 1)));
      const t = ringT(n, 0.25 * j);
      const idx = [];
      for (const tl of t) {
        const g = geo(tl);
        const dl = g.D * PHI(lamList[K - 1] * g.h / g.D);
        const d = lerp(dl, g.D, j / (J + 1));
        const id = addV([0, 0, 0], 1, 0);
        eyeV.push({ id, L, tl, kind: 'skin', g, d, dQ: g.D * PHI(g.h / g.D), lamN: d / g.h });
        idx.push(id);
      }
      rings.push({ idx, t });
    }
    // margin rings
    const tM = ringT(nM, 0);
    const mk = (kind, tag) => { const idx = []; for (const tl of tM) { const id = addV([0, 0, 0], 1, tag); eyeV.push({ id, L, tl, kind, g: geo(tl) }); idx.push(id); } return { idx, t: tM }; };
    const rA = mk('A', 0), rP = mk('P', 1);
    const inner = [rA, rP];
    if (lod.eyeTuck) inner.push(mk('T', 2));
    const apex = addV([0, 0, 0], 1, 2); eyeV.push({ id: apex, L, kind: 'X' });
    // stitch: boundary -> outer fill rings -> ... -> skin rings -> A -> P -> T -> apex
    const seq = [Bd, ...rings.slice().reverse(), ...inner];
    for (let k = 0; k < seq.length - 1; k++) stitch(seq[k], seq[k + 1], flip);
    fan(seq[seq.length - 1], apex, flip);
    eyes.push({ L, rA, rP, rings, apex, flip });
  });

  // ---------------------------------------------------------- mouth patch
  const mouthV = []; // {id, th, kind: 'ring'|'slit'|'in'|'X', lam, k}
  const archZ = (x) => 0.0935 + 0.0015 * (F.noseProj - 1) - 28 * x * x;
  const sy0 = RL.slitY(0);
  const ringPt = (th, lam) => { // explicit lip ring point (2D x,y)
    const A = mw + lam * 0.0014;
    const x = A * Math.cos(th);
    const sn = Math.sin(th), sg = sn >= 0 ? 1 : -1;
    const g = Math.min(1, Math.abs(sn) / 0.3);
    const xc = clamp(x, -mw, mw);
    const H = sg > 0 ? Math.max(RL.tuF(xc), 0.0013) : Math.max(RL.tlF(xc), 0.0013);
    return [x, RL.slitY(xc) + sg * lam * H * g];
  };
  {
    const ids = traceLoop(2);
    const to2 = (p) => [p[0] / (mw + 0.003), (p[1] - sy0) / 0.011];
    const ang = angleTable(720, (t) => { const q = ringPt(2 * Math.PI * t, 1.3); return [q[0] / (mw + 0.003), (q[1] - sy0) / 0.011]; });
    const Bd = boundaryParam(ids, (p) => to2(p), [0, 0], ang);
    const flip = Bd.flip;
    const lamList = lod.mouthLam;
    const K = lamList.length, J = lod.mouthFill, nS = lod.mouthN;
    const rings = [];
    for (let k = K - 1; k >= 0; k--) {
      const n = Math.round(lerp(nS, Math.max(nS * 0.8, Bd.idx.length), Math.pow(k / Math.max(1, K + J), 1.4)));
      const t = ringT(n, (k % 2) * 0.5);
      const idx = [];
      for (const tt of t) { const id = addV([0, 0, 0], 2, 0); mouthV.push({ id, th: 2 * Math.PI * tt, kind: 'ring', lam: lamList[k], t: tt, Bd }); idx.push(id); }
      rings.push({ idx, t });
    }
    const fill = [];
    for (let j = J; j >= 1; j--) {
      const n = Math.round(lerp(nS * 0.8, Bd.idx.length, j / (J + 1)));
      const t = ringT(n, 0.25 * j);
      const idx = [];
      for (const tt of t) { const id = addV([0, 0, 0], 2, 0); mouthV.push({ id, th: 2 * Math.PI * tt, kind: 'fill', lam: lamList[K - 1], f: j / (J + 1), t: tt, Bd }); idx.push(id); }
      fill.push({ idx, t });
    }
    const tS = ringT(nS, 0);
    const slit = { idx: [], t: tS };
    for (const tt of tS) { const id = addV([0, 0, 0], 2, 5); mouthV.push({ id, th: 2 * Math.PI * tt, kind: 'slit', t: tt }); slit.idx.push(id); }
    const inner = [];
    for (let k = 0; k < lod.interior; k++) {
      const r = { idx: [], t: tS };
      for (const tt of tS) { const id = addV([0, 0, 0], 2, k === 0 ? 5 : 3); mouthV.push({ id, th: 2 * Math.PI * tt, kind: 'in', k, t: tt }); r.idx.push(id); }
      inner.push(r);
    }
    const apex = addV([0, 0, 0], 2, 3); mouthV.push({ id: apex, kind: 'X' });
    const seq = [Bd, ...fill, ...rings, slit, ...inner];
    for (let k = 0; k < seq.length - 1; k++) stitch(seq[k], seq[k + 1], flip);
    fan(seq[seq.length - 1], apex, flip);
  }

  // ---------------------------------------------------------- nose patch (polar around the tip)
  // spokes radiate from the tip apex to the hole boundary; ring vertices sit at equal 3D arc length
  // along each spoke, so the steep alar / columella walls get as many vertices as the dorsum
  const noseV = [];
  if (noseOn) {
    const ids = traceLoop(3);
    const cen = [F.noseDev, F.yTip + 0.0008];
    const to2 = (p) => [p[0], p[1]];
    const ang = angleTable(720, (t) => [Math.cos(2 * Math.PI * t), Math.sin(2 * Math.PI * t)]);
    const Bd = boundaryParam(ids, to2, cen, ang);
    const flip = Bd.flip;
    const K = lod.noseR, nN = lod.noseN;
    const apex = addV([cen[0], cen[1], M(cen[0], cen[1])], 3, 0);
    noseV.push({ id: apex, kind: 'X', p: [cen[0], cen[1], M(cen[0], cen[1])] });
    const rings = [];
    const SP = 72;
    const spoke = (t) => { // returns sampler f -> point at arc fraction f
      const B3 = boundaryAt(Bd, t);
      const xs = new Float64Array(SP + 1), ys = new Float64Array(SP + 1), zs = new Float64Array(SP + 1), A = new Float64Array(SP + 1);
      for (let m = 0; m <= SP; m++) {
        const f = m / SP;
        xs[m] = lerp(cen[0], B3[0], f); ys[m] = lerp(cen[1], B3[1], f);
        zs[m] = m === SP ? B3[2] : M(xs[m], ys[m]);
        if (m > 0) { const dz = (zs[m] - zs[m - 1]) * 1.15; A[m] = A[m - 1] + Math.hypot(xs[m] - xs[m - 1], ys[m] - ys[m - 1], dz); }
      }
      return (f) => {
        const a = f * A[SP];
        let m = 0; while (m < SP - 1 && A[m + 1] < a) m++;
        const u = clamp((a - A[m]) / Math.max(1e-12, A[m + 1] - A[m]), 0, 1);
        const x = lerp(xs[m], xs[m + 1], u), y = lerp(ys[m], ys[m + 1], u);
        return [x, y, M(x, y)];
      };
    };
    const spokeCache = new Map();
    const getSpoke = (t) => { const key = Math.round(t * 1e6); let sp = spokeCache.get(key); if (!sp) { sp = spoke(t); spokeCache.set(key, sp); } return sp; };
    for (let k = 1; k <= K; k++) {
      const f = Math.pow(k / (K + 1), 1.08);
      const n = Math.max(6, Math.round(lerp(Math.min(12, nN), Math.max(nN, Bd.idx.length), Math.pow(k / (K + 1), 0.7))));
      const t = ringT(n, (k % 2) * 0.5);
      const idx = [];
      for (const tt of t) { const p = getSpoke(tt)(f); const id = addV(p, 3, 0); noseV.push({ id, kind: 'ring', p }); idx.push(id); }
      rings.push({ idx, t });
    }
    const seq = [Bd, ...rings.slice().reverse()];
    for (let k = 0; k < seq.length - 1; k++) stitch(seq[k], seq[k + 1], flip);
    fan(seq[seq.length - 1], apex, flip);
  }

  const NV = PX.length;
  const base = new Float64Array(NV * 3);
  for (let id = 0; id < NV; id++) { base[id * 3] = PX[id]; base[id * 3 + 1] = PY[id]; base[id * 3 + 2] = PZ[id]; }

  // ---------------------------------------------------------- patch positions for a state
  function setP(P, id, p) { P[id * 3] = p[0]; P[id * 3 + 1] = p[1]; P[id * 3 + 2] = p[2]; }
  // a point on the relief -> the same ray's point on the blended skull/relief surface the grid uses
  const dS = [0, 0, 0];
  function toS(p) {
    const w = RL.mask(p[0], p[1]);
    if (w >= 1) return p;
    const vx = p[0] - C[0], vy = p[1] - C[1], vz = p[2] - C[2];
    const rf = Math.hypot(vx, vy, vz);
    dS[0] = vx / rf; dS[1] = vy / rf; dS[2] = vz / rf;
    const rh = hull(C, dS);
    const r = rh + w * (rf - rh);
    return [C[0] + dS[0] * r, C[1] + dS[1] * r, C[2] + dS[2] * r];
  }
  function eyeState(P, b, s) {
    for (const ev of eyeV) {
      const L = ev.L;
      if (ev.kind === 'X') { setP(P, ev.id, L.toWorld(-0.5, 0, -5)); continue; }
      const g = ev.g, tl = ev.tl;
      const mb = L.margin(tl, b, s);
      if (ev.kind === 'skin') {
        let u, v;
        if (ev.d <= ev.dQ + 1e-9) {
          const Q = [g.m0[0] + g.dir[0] * ev.dQ, g.m0[1] + g.dir[1] * ev.dQ];
          const f = ev.d / ev.dQ;
          u = lerp(mb[0], Q[0], f); v = lerp(mb[1], Q[1], f);
        } else { u = g.m0[0] + g.dir[0] * ev.d; v = g.m0[1] + g.dir[1] * ev.d; }
        const w = L.toWorld(u, v, 0);
        const zFace = (M(w[0], w[1]) - L.E[2]) / MM;
        const z = L.lidW(u, v, ev.d / g.h, ev.d / g.D, g.wU, zFace, b, s);
        const pw = L.toWorld(u, v, z);
        setP(P, ev.id, ev.d / g.D > 0.6 ? toS(pw) : pw);
      } else {
        const nrm = L.mNormal(tl);
        if (ev.kind === 'A') {
          const z = L.lidW(mb[0], mb[1], 0, 0, g.wU, 0, b, s);
          setP(P, ev.id, L.toWorld(mb[0], mb[1], z));
        } else if (ev.kind === 'P') {
          const u = mb[0] - nrm[0] * 0.35, v = mb[1] - nrm[1] * 0.35;
          const z = Math.max(L.zG(u, v) + 0.08, L.shell(u, v) - 1.7);
          setP(P, ev.id, L.toWorld(u, v, z));
        } else if (ev.kind === 'T') {
          const u = mb[0] - nrm[0] * 1.3, v = mb[1] - nrm[1] * 1.3;
          const zg = L.zGlobe(u, v);
          const z = zg > 0 ? Math.max(zg - 0.9, L.shell(u, v) - 3.5) : L.shell(u, v) - 3.5;
          setP(P, ev.id, L.toWorld(u, v, z));
        }
      }
    }
  }
  function mouthBaseState(P) {
    const nS = lod.mouthN;
    for (const mv of mouthV) {
      if (mv.kind === 'X') { setP(P, mv.id, [0, sy0 - 0.002, archZ(0) - 0.042]); continue; }
      const th = mv.th;
      if (mv.kind === 'ring' || mv.kind === 'fill') {
        let q = ringPt(th, mv.lam);
        let p = [q[0], q[1], M(q[0], q[1])];
        if (mv.kind === 'fill') {
          const B3 = boundaryAt(mv.Bd, mv.t);
          p = [lerp(p[0], B3[0], mv.f), lerp(p[1], B3[1], mv.f), 0];
          p[2] = M(p[0], p[1]);
        }
        setP(P, mv.id, toS(p));
      } else if (mv.kind === 'slit' || mv.kind === 'in') {
        const cx = Math.cos(th), sn = Math.sin(th), sg = sn >= 0 ? 1 : -1;
        const x0 = mw * cx, sy = RL.slitY(x0);
        const zs = M(x0, sy) - 0.0002;
        const corner = Math.min(1, Math.abs(sn) / 0.35);
        if (mv.kind === 'slit') { setP(P, mv.id, [x0, sy, zs]); continue; }
        const za = archZ(x0);
        const k = lod.interior === 5 ? mv.k : Math.round(mv.k * 4 / Math.max(1, lod.interior - 1));
        const tab = [
          [x0 * 0.985, sy + sg * 0.0008 * corner, zs - 0.0022],
          [x0 * 0.955, sy + sg * 0.0036 * corner, Math.min(zs - 0.0048, za + 0.0014)],
          [x0 * 0.92, sy + sg * 0.0098 * (0.3 + 0.7 * corner), za + 0.0003],
          [x0 * 0.85, sy + sg * 0.0128 * (0.3 + 0.7 * corner), za - 0.006],
          [x0 * 0.5, sy + sg * 0.0085 * (0.3 + 0.7 * corner), za - 0.028],
        ];
        setP(P, mv.id, tab[Math.min(4, k)]);
      }
    }
    void nS;
  }
  function noseState(P) { for (const nv of noseV) setP(P, nv.id, nv.p); }

  // jaw / smile deformation fields
  const hinge = [0, 0.058, -0.008];
  const jawAngle = 17 * DEG;
  const mouthRec = new Map(mouthV.map(mv => [mv.id, mv]));
  function jawWeight(id, x, y, z) {
    const mv = mouthRec.get(id);
    if (mv && mv.kind !== 'X') {
      const sn = Math.sin(mv.th), lower = sn < 0;
      const c = Math.min(1, Math.abs(sn) / 0.35);
      if (mv.kind === 'slit' || mv.kind === 'in') return lower ? lerp(0.5, 1, c) : lerp(0.5, 0, c);
      if (mv.lam < 1.2) return lower ? lerp(0.5, 1, c) : lerp(0.5, 0.02, c);
    }
    if (mv && mv.kind === 'X') return 0.5;
    const sy = RL.slitY(clamp(x, -mw, mw));
    const axx = Math.abs(x);
    const lineY = sy + Math.max(0, axx - mw) * 0.75;
    let w = sstep(0.004, -0.010, y - lineY);
    const neckD = (0.045 - z) * 0.8 + Math.max(0, -0.03 - y);
    w *= 1 - sstep(0.0, 0.05, neckD) * sstep(-0.02, -0.065, y) * 0.85;
    if (z < 0.0) w *= sstep(-0.02, 0.0, z);
    return clamp(w, 0, 1);
  }
  function rotX(p, c, a, w) {
    const ca = Math.cos(a * w), sa = Math.sin(a * w);
    const y = p[1] - c[1], z = p[2] - c[2];
    return [p[0], c[1] + y * ca - z * sa, c[2] + y * sa + z * ca];
  }
  function smileDisp(x, y, z, out) {
    const ax = Math.abs(x), sg = Math.sign(x) || 1;
    let dx = 0, dy = 0, dz = 0;
    const cy = RL.slitY(mw);
    const kc = bump(((ax - mw) / 0.017) ** 2 + ((y - cy) / 0.015) ** 2 + ((z - 0.088) / 0.03) ** 2);
    dx += sg * 0.0030 * kc; dy += 0.0032 * kc; dz -= 0.0020 * kc;
    const kk = bump(((ax - 0.036) / 0.022) ** 2 + ((y - F.yEye + 0.027) / 0.02) ** 2 + ((z - 0.07) / 0.04) ** 2);
    dy += 0.0022 * kk; dz += 0.0016 * kk; dx += sg * 0.0006 * kk;
    const ku = bump((x / (mw * 1.1)) ** 2 + ((y - cy - 0.006) / 0.01) ** 2 + ((z - 0.1) / 0.02) ** 2);
    dy += 0.0008 * ku; dz -= 0.0005 * ku;
    const kl = bump((x / mw) ** 2 + ((y - cy + 0.008) / 0.009) ** 2 + ((z - 0.1) / 0.02) ** 2);
    dz -= 0.0007 * kl; dy += 0.0004 * kl;
    out[0] = dx; out[1] = dy; out[2] = dz;
    return out;
  }
  const eyeIds = new Set(eyeV.map(e => e.id));
  function stateFields(P, st) {
    if (!st.mouth && !st.smile) return;
    const d = [0, 0, 0];
    for (let id = 0; id < NV; id++) {
      let p = [P[id * 3], P[id * 3 + 1], P[id * 3 + 2]];
      if (st.smile) {
        smileDisp(p[0], p[1], p[2], d);
        const k = eyeIds.has(id) ? 0.5 : 1;
        p = [p[0] + d[0] * st.smile * k, p[1] + d[1] * st.smile * k, p[2] + d[2] * st.smile * k];
      }
      if (st.mouth) {
        const w = jawWeight(id, base[id * 3], base[id * 3 + 1], base[id * 3 + 2]);
        if (w > 0) p = rotX(p, hinge, jawAngle * st.mouth, w);
        const mv = mouthRec.get(id);
        if (mv && mv.kind !== 'X' && Math.sin(mv.th) > 0 && (mv.kind !== 'ring' || mv.lam < 1.3)) p[1] += 0.0007 * st.mouth;
      }
      P[id * 3] = p[0]; P[id * 3 + 1] = p[1]; P[id * 3 + 2] = p[2];
    }
  }
  function buildState(st) {
    const P = Float64Array.from(base);
    eyeState(P, st.blink || 0, st.smile || 0);
    mouthBaseState(P);
    noseState(P);
    stateFields(P, st);
    return P;
  }
  const P0 = buildState({});
  // patch vertices are now placed: compute their UVs from the neutral positions
  for (let id = 0; id < NV; id++) {
    if (UVS[id] !== -1) continue;
    UVS[id] = uvOf([P0[id * 3], P0[id * 3 + 1], P0[id * 3 + 2]]);
  }
  // interior vertices borrow the UV of the opening they hang from (they are darkened anyway)
  for (const e of eyes) {
    const n = e.rP.idx.length;
    for (let m = 0; m < n; m++) UVS[e.rP.idx[m]] = UVS[e.rA.idx[m]];
  }
  const states = [{ blink: 1 }, { mouth: 1 }, { smile: 1 }];
  const morphP = states.map(st => buildState(st));

  // ---------------------------------------------------------- output
  const S = F.S;
  const position = new Float32Array(NV * 3);
  for (let k = 0; k < NV * 3; k++) position[k] = P0[k] * S;
  const morphs = morphP.map(P => { const D = new Float32Array(NV * 3); for (let k = 0; k < NV * 3; k++) D[k] = (P[k] - P0[k]) * S; return D; });
  const uv = new Float32Array(NV * 2);
  for (let id = 0; id < NV; id++) { uv[id * 2] = UVS[id][0]; uv[id * 2 + 1] = UVS[id][1]; }
  const tag = Uint8Array.from(TAG);
  const kind = Uint8Array.from(KIND);
  const index = NV > 65535 ? new Uint32Array(tris) : new Uint16Array(tris);
  const seamPairs = []; for (let r = 0; r < ROWS; r++) seamPairs.push([gidx(0, r), gidx(NI, r)]);
  const sc = (p) => [p[0] * S, p[1] * S, p[2] * S];
  // per-vertex feature data for the skin shading
  const lip = new Float32Array(NV), lidRing = new Uint8Array(NV), lidLam = new Float32Array(NV).fill(-1), lidUp = new Float32Array(NV);
  for (const mv of mouthV) {
    if (mv.kind === 'ring') lip[mv.id] = sstep(1.035, 0.965, mv.lam);
    else if (mv.kind === 'slit' || (mv.kind === 'in' && mv.k === 0)) lip[mv.id] = 1;
  }
  for (const ev of eyeV) {
    if (ev.kind === 'A') lidRing[ev.id] = 1; else if (ev.kind === 'P') lidRing[ev.id] = 2; else if (ev.kind === 'T' || ev.kind === 'X') lidRing[ev.id] = 3;
    if (ev.kind === 'skin') lidLam[ev.id] = ev.d / ev.g.h; else if (ev.kind !== 'X') lidLam[ev.id] = 0;
    if (ev.g) lidUp[ev.id] = ev.g.wU;
  }
  const eyeOut = eyes.map(e => ({
    side: e.L.side, center: sc(e.L.E), radius: F.eyeR * S, lids: e.L,
    lowerMargin: e.rA.idx.filter((id, m) => !e.L.isUpper(e.rA.t[m])).map(id => [P0[id * 3] * S, P0[id * 3 + 1] * S, P0[id * 3 + 2] * S]),
    lowerP: e.rP.idx.filter((id, m) => !e.L.isUpper(e.rP.t[m]) && e.L.wUp(e.rP.t[m]) < 0.3).map(id => [P0[id * 3] * S, P0[id * 3 + 1] * S, P0[id * 3 + 2] * S]),
    upperA: e.rA.idx.filter((id, m) => e.L.isUpper(e.rA.t[m])).map(id => [P0[id * 3] * S, P0[id * 3 + 1] * S, P0[id * 3 + 2] * S]),
    caruncle: (() => { const c = e.L.caruncle(); return { p: sc(c.p), r: c.r.map(v => v * S) }; })(),
  }));
  const yTop = P0[pole * 3 + 1];
  const landmarks = {
    eyeL: sc(lids[0].E), eyeR: sc(lids[1].E),
    noseTip: sc([F.noseDev, F.yTip, RL.zTip]),
    mouth: sc([0, sy0, M(0, sy0 + 0.002)]),
    chin: sc([0, F.yPog, M(0, F.yPog)]),
    crown: sc([0, yTop, P0[pole * 3 + 2]]),
    earL: sc([0.0745, 0.069, -0.010]), earR: sc([-0.0745, 0.069, -0.010]),
    browL: sc([0.03, F.yBrow, M(0.03, F.yBrow) + 0.001]), browR: sc([-0.03, F.yBrow, M(-0.03, F.yBrow) + 0.001]),
  };
  return {
    F, S, NV, position, uv, index, tag, kind, seamPairs, morphs, eyes: eyeOut, landmarks, relief: RL, hull, lip, lidRing, lidLam, lidUp, P0,
    mouth: { hinge: sc(hinge), jawAngle, archZ: (x) => archZ(x / S) * S, slitY: sy0 * S, mouthW: mw * S, zSlit: M(0, sy0) * S },
    rows: ROWS, cols: COLS, NK, pole, uvH, uvOf: (p) => uvOf([p[0] / S, p[1] / S, p[2] / S]), uvOfRef: uvOf,
    surfaceAt: (x, y) => M(x / S, y / S) * S,
  };
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
