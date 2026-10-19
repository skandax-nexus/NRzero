// Signed-distance helpers and a surface-nets polygoniser for the procedural body and clothing.
import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);
export function rngF(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function sdEll(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = x - cx, py = y - cy, pz = z - cz;
  const k0 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
  const k1 = Math.sqrt((px / (rx * rx)) ** 2 + (py / (ry * ry)) ** 2 + (pz / (rz * rz)) ** 2);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
// tapered capsule from a to b with radii ra, rb; returns [distance, t]
export function sdCapT(x, y, z, a, b, ra, rb) {
  const pax = x - a[0], pay = y - a[1], paz = z - a[2], bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const L2 = bax * bax + bay * bay + baz * baz;
  const h = clamp((pax * bax + pay * bay + paz * baz) / L2, 0, 1);
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h);
}
export function sdCap(x, y, z, a, b, ra, rb) { return sdCapT(x, y, z, a, b, ra, rb); }
export function sdBoxR(x, y, z, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
// C1 cubic through [y, value] keys
export function curve(keys) {
  const k = keys.slice().sort((a, b) => a[0] - b[0]), n = k.length;
  const m = k.map((_, i) => (i === 0 || i === n - 1) ? 0 : (k[i + 1][1] - k[i - 1][1]) / (k[i + 1][0] - k[i - 1][0]));
  return y => {
    if (y <= k[0][0]) return k[0][1];
    if (y >= k[n - 1][0]) return k[n - 1][1];
    let i = 0; while (y > k[i + 1][0]) i++;
    const h = k[i + 1][0] - k[i][0], t = (y - k[i][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * k[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * k[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
}

/**
 * Surface nets over a regular grid. f(x,y,z) < 0 inside. Skips blocks far from the surface.
 * Returns { positions: Float32Array, normals: Float32Array, index: Uint32Array }.
 */
export function surfaceNets(f, bmin, bmax, h) {
  const nx = Math.max(2, Math.ceil((bmax[0] - bmin[0]) / h) + 1), ny = Math.max(2, Math.ceil((bmax[1] - bmin[1]) / h) + 1), nz = Math.max(2, Math.ceil((bmax[2] - bmin[2]) / h) + 1);
  const N = nx * ny * nz, val = new Float32Array(N);
  const at = (i, j, k) => (k * ny + j) * nx + i;
  const X = i => bmin[0] + i * h, Y = j => bmin[1] + j * h, Z = k => bmin[2] + k * h;
  // coarse pass: blocks of B cells; evaluate block centres and skip blocks clearly away from the surface
  const B = 4, bdiag = Math.sqrt(3) * B * h * 0.5;
  for (let bk = 0; bk < nz; bk += B) for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
    const ci = Math.min(nx - 1, bi + B / 2), cj = Math.min(ny - 1, bj + B / 2), ck = Math.min(nz - 1, bk + B / 2);
    const dc = f(X(bi + B / 2), Y(bj + B / 2), Z(bk + B / 2));
    const ie = Math.min(nx, bi + B + 1), je = Math.min(ny, bj + B + 1), ke = Math.min(nz, bk + B + 1);
    if (Math.abs(dc) > bdiag * 1.6 + h) {
      for (let k = bk; k < ke; k++) for (let j = bj; j < je; j++) for (let i = bi; i < ie; i++) val[at(i, j, k)] = dc;
      void ci; void cj; void ck;
      continue;
    }
    for (let k = bk; k < ke; k++) for (let j = bj; j < je; j++) for (let i = bi; i < ie; i++) val[at(i, j, k)] = f(X(i), Y(j), Z(k));
  }
  const cells = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cat = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const o = corner[c]; cv[c] = val[at(i + o[0], j + o[1], k + o[2])]; if (cv[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb), oa = corner[a], ob = corner[b];
      sx += oa[0] + (ob[0] - oa[0]) * t; sy += oa[1] + (ob[1] - oa[1]) * t; sz += oa[2] + (ob[2] - oa[2]) * t; n++;
    }
    cells[cat(i, j, k)] = pos.length / 3;
    pos.push(X(i) + sx / n * h, Y(j) + sy / n * h, Z(k) + sz / n * h);
  }
  const idx = [];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v0 = val[at(i, j, k)] < 0;
    // edges along +x, +y, +z from node (i,j,k); the four cells around each edge make a quad
    if (j > 0 && k > 0 && i < nx - 1) {
      const v1 = val[at(i + 1, j, k)] < 0;
      if (v0 !== v1) quad(cat(i, j - 1, k - 1), cat(i, j, k - 1), cat(i, j, k), cat(i, j - 1, k), v0);
    }
    if (i > 0 && k > 0 && j < ny - 1) {
      const v1 = val[at(i, j + 1, k)] < 0;
      if (v0 !== v1) quad(cat(i - 1, j, k - 1), cat(i - 1, j, k), cat(i, j, k), cat(i, j, k - 1), v0);
    }
    if (i > 0 && j > 0 && k < nz - 1) {
      const v1 = val[at(i, j, k + 1)] < 0;
      if (v0 !== v1) quad(cat(i - 1, j - 1, k), cat(i, j - 1, k), cat(i, j, k), cat(i - 1, j, k), v0);
    }
  }
  function quad(a, b, c, d, flip) {
    const A = cells[a], Bq = cells[b], Cq = cells[c], D = cells[d];
    if (A < 0 || Bq < 0 || Cq < 0 || D < 0) return;
    if (flip) idx.push(A, Bq, Cq, A, Cq, D); else idx.push(A, Cq, Bq, A, D, Cq);
  }
  // project vertices onto the surface and take normals from the field gradient
  const P = new Float32Array(pos), Nn = new Float32Array(pos.length), e = h * 0.25;
  for (let v = 0; v < P.length; v += 3) {
    let x = P[v], y = P[v + 1], z = P[v + 2], gx = 0, gy = 0, gz = 1;
    for (let it = 0; it < 2; it++) {
      const d = f(x, y, z);
      gx = f(x + e, y, z) - f(x - e, y, z); gy = f(x, y + e, z) - f(x, y - e, z); gz = f(x, y, z + e) - f(x, y, z - e);
      const g2 = gx * gx + gy * gy + gz * gz; if (g2 < 1e-14) break;
      const s = d * (2 * e) / g2, mx = gx * s, my = gy * s, mz = gz * s;
      const ml = Math.hypot(mx, my, mz), lim = h * 0.6;
      const k2 = ml > lim ? lim / ml : 1;
      x -= mx * k2; y -= my * k2; z -= mz * k2;
    }
    P[v] = x; P[v + 1] = y; P[v + 2] = z;
    const l = Math.hypot(gx, gy, gz) || 1; Nn[v] = gx / l; Nn[v + 1] = gy / l; Nn[v + 2] = gz / l;
  }
  return { positions: P, normals: Nn, index: idx.length > 65535 * 3 ? new Uint32Array(idx) : new Uint32Array(idx) };
}

export function toGeometry(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setIndex(new THREE.BufferAttribute(m.index, 1));
  return g;
}
