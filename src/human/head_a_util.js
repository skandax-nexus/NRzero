// head_a utilities: small math helpers, seeded random numbers and value noise. No THREE dependency so the
// geometry core can also run in node for offline checks.

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k); return lerp(b, a, h) - k * h * (1 - h); };
export const smax = (a, b, k) => -smin(-a, -b, k);
export const gauss = (d2) => Math.exp(-d2);

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// integer hash -> [0,1)
export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function hash3(x, y, z, s = 0) { return hash2(x + Math.imul(z, 1619), y + Math.imul(z, 31337), s); }

// smooth value noise 2D / 3D in [-1, 1]
export function vnoise2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return 2 * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) - 1;
}
export function vnoise3(x, y, z, s = 0) {
  const zi = Math.floor(z), zf = z - zi, w = zf * zf * (3 - 2 * zf);
  return lerp(vnoise2(x + zi * 17.13, y - zi * 9.71, s), vnoise2(x + (zi + 1) * 17.13, y - (zi + 1) * 9.71, s), w);
}
export function fbm3(x, y, z, oct, s = 0) {
  let a = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { a += amp * vnoise3(x * f, y * f, z * f, s + i * 13); n += amp; amp *= 0.5; f *= 2.03; }
  return a / n;
}

// distance from point (px,py) to segment (ax,ay)-(bx,by): returns [dist, t]
export function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2) : 0;
  const ex = px - (ax + t * dx), ey = py - (ay + t * dy);
  return [Math.sqrt(ex * ex + ey * ey), t];
}

// polyline (array of [x,y]) distance with arc-length parameter (0..1) and signed side (+ left of travel)
export function polyDist(px, py, pts) {
  let best = 1e9, bs = 0, side = 1, L = 0, bestL = 0;
  const lens = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); lens.push(l); L += l; }
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const [d, t] = segDist2(px, py, a[0], a[1], b[0], b[1]);
    if (d < best) {
      best = d; bestL = acc + t * lens[i];
      const cr = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
      side = cr >= 0 ? 1 : -1; bs = i;
    }
    acc += lens[i];
  }
  return { d: best, s: L > 0 ? bestL / L : 0, side, seg: bs };
}

// Catmull-Rom style monotone-ish cubic spline through knots (xs ascending)
export function makeSpline(xs, ys) {
  const n = xs.length, m = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (i === 0) m[i] = (ys[1] - ys[0]) / (xs[1] - xs[0]);
    else if (i === n - 1) m[i] = (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]);
    else m[i] = 0.5 * ((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) + (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1]));
  }
  return (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// sample a closed/open polyline of 2D points by a cubic Catmull-Rom curve into n points
export function crCurve(pts, n) {
  const out = [];
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const segs = pts.length - 1;
  for (let k = 0; k <= n; k++) {
    const u = (k / n) * segs, i = Math.min(segs - 1, Math.floor(u)), t = u - i;
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const o = [];
    for (let c = 0; c < p1.length; c++) {
      o.push(0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t * t * t));
    }
    out.push(o);
  }
  return out;
}

export function hexToRGB(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
export const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

// thin-plate spline in 2D: fit z = f(x, y) through control points [x, y, z] with optional smoothing
export function fitTPS(pts, smooth = 0) {
  const n = pts.length, N = n + 3;
  const A = new Float64Array(N * N), b = new Float64Array(N);
  const U = (r2) => (r2 > 1e-12 ? r2 * Math.log(r2) * 0.5 : 0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
      A[i * N + j] = U(dx * dx + dy * dy) + (i === j ? smooth : 0);
    }
    A[i * N + n] = 1; A[i * N + n + 1] = pts[i][0]; A[i * N + n + 2] = pts[i][1];
    A[n * N + i] = 1; A[(n + 1) * N + i] = pts[i][0]; A[(n + 2) * N + i] = pts[i][1];
    b[i] = pts[i][2];
  }
  const w = solve(A, b, N);
  return (x, y) => {
    let s = w[n] + w[n + 1] * x + w[n + 2] * y;
    for (let i = 0; i < n; i++) { const dx = x - pts[i][0], dy = y - pts[i][1]; s += w[i] * U(dx * dx + dy * dy); }
    return s;
  };
}

// dense Gaussian elimination with partial pivoting (small systems)
export function solve(A, b, N) {
  const M = Float64Array.from(A), x = Float64Array.from(b);
  for (let c = 0; c < N; c++) {
    let p = c, mv = Math.abs(M[c * N + c]);
    for (let r = c + 1; r < N; r++) { const v = Math.abs(M[r * N + c]); if (v > mv) { mv = v; p = r; } }
    if (p !== c) {
      for (let k = 0; k < N; k++) { const t = M[c * N + k]; M[c * N + k] = M[p * N + k]; M[p * N + k] = t; }
      const t = x[c]; x[c] = x[p]; x[p] = t;
    }
    const d = M[c * N + c] || 1e-12;
    for (let r = c + 1; r < N; r++) {
      const f = M[r * N + c] / d;
      if (f === 0) continue;
      for (let k = c; k < N; k++) M[r * N + k] -= f * M[c * N + k];
      x[r] -= f * x[c];
    }
  }
  for (let r = N - 1; r >= 0; r--) {
    let s = x[r];
    for (let k = r + 1; k < N; k++) s -= M[r * N + k] * x[k];
    x[r] = s / (M[r * N + r] || 1e-12);
  }
  return x;
}
