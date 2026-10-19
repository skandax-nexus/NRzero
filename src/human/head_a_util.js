// Shared math / noise helpers for the procedural head (head_a). All original code.

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); };
export const smax = (a, b, k) => { const h = clamp(0.5 + 0.5 * (a - b) / k, 0, 1); return lerp(b, a, h) + k * h * (1 - h); };
// compact smooth bump: 1 at d2=0, 0 for d2>=1 (C2 at the border)
export const bump = (d2) => (d2 >= 1 ? 0 : (1 - d2) * (1 - d2) * (1 - d2));
export const gauss = (d2) => Math.exp(-d2);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// integer hash -> [0,1)
export function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function hash3(ix, iy, iz, seed) {
  let h = (ix * 374761393 + iy * 668265263 + iz * 1440662683 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// smooth 2D value noise in [-1,1]
export function vnoise2(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) * 2 - 1;
}
export function vnoise3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const h = (i, j, k) => hash3(ix + i, iy + j, iz + k, seed);
  const x00 = lerp(h(0, 0, 0), h(1, 0, 0), fx), x10 = lerp(h(0, 1, 0), h(1, 1, 0), fx);
  const x01 = lerp(h(0, 0, 1), h(1, 0, 1), fx), x11 = lerp(h(0, 1, 1), h(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz) * 2 - 1;
}
export function fbm2(x, y, seed, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise2(x * f, y * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
export function fbm3(x, y, z, seed, oct = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise3(x * f, y * f, z * f, seed + i * 31); n += a; a *= 0.5; f *= 2.07; }
  return s / n;
}

// Catmull-Rom through points [[x,y],...] (open), t in [0,1]
export function crPoint(pts, t, out) {
  const n = pts.length - 1;
  const ft = clamp(t, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(ft));
  const u = ft - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const u2 = u * u, u3 = u2 * u;
  const dim = p1.length;
  out = out || new Array(dim);
  for (let k = 0; k < dim; k++) {
    out[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
  }
  return out;
}
// closed Catmull-Rom
export function crClosed(pts, t, out) {
  const n = pts.length;
  let ft = ((t % 1) + 1) % 1 * n;
  const i = Math.floor(ft) % n;
  const u = ft - Math.floor(ft);
  const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
  const u2 = u * u, u3 = u2 * u;
  const dim = p1.length;
  out = out || new Array(dim);
  for (let k = 0; k < dim; k++) {
    out[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
  }
  return out;
}

// resample a polyline (array of arrays) to n points by arc length; closed optional
export function resample(pts, n, closed) {
  const P = closed ? pts.concat([pts[0]]) : pts;
  const L = [0];
  for (let i = 1; i < P.length; i++) {
    let d = 0; for (let k = 0; k < P[i].length; k++) d += (P[i][k] - P[i - 1][k]) ** 2;
    L.push(L[i - 1] + Math.sqrt(d));
  }
  const tot = L[L.length - 1];
  const out = [];
  const cnt = closed ? n : n - 1;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = (i / cnt) * tot;
    while (j < L.length - 2 && L[j + 1] < t) j++;
    const u = (t - L[j]) / Math.max(1e-12, L[j + 1] - L[j]);
    out.push(P[j].map((v, k) => lerp(v, P[j + 1][k], clamp(u, 0, 1))));
  }
  return out;
}

// piecewise-linear 1D table lookup: xs ascending
export function interp1(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  const n = xs.length;
  if (x >= xs[n - 1]) return ys[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + (ys[hi] - ys[lo]) * t;
}
// smooth (monotone cubic Hermite) 1D table lookup
export function interpS(xs, ys, x) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  const h = xs[hi] - xs[lo];
  const t = (x - xs[lo]) / h;
  const sl = (i) => {
    if (i <= 0) return (ys[1] - ys[0]) / (xs[1] - xs[0]);
    if (i >= n - 1) return (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]);
    const d0 = (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1]), d1 = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
    if (d0 * d1 <= 0) return 0;
    return 2 / (1 / d0 + 1 / d1);
  };
  const m0 = sl(lo) * h, m1 = sl(hi) * h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * m1;
}

// sRGB <-> linear
export const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const l2s = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export function hexToLin(hex) { return [s2l(((hex >> 16) & 255) / 255), s2l(((hex >> 8) & 255) / 255), s2l((hex & 255) / 255)]; }

// fast lookup table for linear->sRGB byte
const L2S_N = 4096;
const L2S_T = new Uint8Array(L2S_N + 1);
for (let i = 0; i <= L2S_N; i++) L2S_T[i] = Math.round(clamp(l2s(i / L2S_N), 0, 1) * 255);
export function linToByte(v) { return L2S_T[(v <= 0 ? 0 : v >= 1 ? L2S_N : (v * L2S_N + 0.5) | 0)]; }

// distance from point to polyline in 2D; returns {d, t (0..1 along), side sign}
export function polyDist2(pts, x, y) {
  let best = 1e9, bt = 0, side = 1, acc = 0;
  const segL = [];
  let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segL.push(l); tot += l; }
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-12;
    const u = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
    const px = ax + dx * u, py = ay + dy * u;
    const d = Math.hypot(x - px, y - py);
    if (d < best) { best = d; bt = (acc + u * segL[i]) / tot; side = (dx * (y - ay) - dy * (x - ax)) >= 0 ? 1 : -1; }
    acc += segL[i];
  }
  return { d: best, t: bt, side };
}

// natural cubic spline through (xs, ys) (C2, so shading shows no bands at the knots); clamped outside
export function makeSpline(xs, ys) {
  const n = xs.length;
  const y2 = new Float64Array(n), u = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    const sig = (xs[i] - xs[i - 1]) / (xs[i + 1] - xs[i - 1]);
    const p = sig * y2[i - 1] + 2;
    y2[i] = (sig - 1) / p;
    const d = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) - (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1]);
    u[i] = (6 * d / (xs[i + 1] - xs[i - 1]) - sig * u[i - 1]) / p;
  }
  for (let k = n - 2; k >= 0; k--) y2[k] = y2[k] * y2[k + 1] + u[k];
  const s0 = (ys[1] - ys[0]) / (xs[1] - xs[0]) - (xs[1] - xs[0]) * (2 * y2[0] + y2[1]) / 6;
  const s1 = (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]) + (xs[n - 1] - xs[n - 2]) * (y2[n - 2] + 2 * y2[n - 1]) / 6;
  return function (x) {
    if (x <= xs[0]) return ys[0] + s0 * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + s1 * (x - xs[n - 1]);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] > x) hi = m; else lo = m; }
    const h = xs[hi] - xs[lo], a = (xs[hi] - x) / h, b = (x - xs[lo]) / h;
    return a * ys[lo] + b * ys[hi] + ((a * a * a - a) * y2[lo] + (b * b * b - b) * y2[hi]) * h * h / 6;
  };
}
