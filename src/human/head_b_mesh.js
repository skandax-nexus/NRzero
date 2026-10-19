// AFTERZERO head_b: adaptive octree polygonizer for signed distance fields.
// Dual contouring on an adaptive octree with surface-nets style vertices (mass point of the
// edge crossings, then projected onto the surface). Cells are subdivided only near the surface
// and only down to the size requested by sizeFn(x,y,z), so the face, eyelids, lips, nostrils
// and ears get fine cells while the back of the skull stays coarse. Crack free by construction:
// quads are emitted across minimal edges using the four leaves around each edge.
// Pure JS (no three.js) so it can be unit tested in node.

const EDGES = [ // [corner0, corner1, axis]  corner index = dx<<2 | dy<<1 | dz
  [0, 4, 0], [2, 6, 0], [1, 5, 0], [3, 7, 0],
  [0, 2, 1], [4, 6, 1], [1, 3, 1], [5, 7, 1],
  [0, 1, 2], [4, 5, 2], [2, 3, 2], [6, 7, 2],
];

/**
 * @param {(x:number,y:number,z:number)=>number} sdf
 * @param {{min:number[], size:number, depth:number, sizeFn:Function, lip?:number}} o
 */
export function polygonize(sdf, o) {
  const D = o.depth, N = 1 << D, L = o.size, u0 = L / N;
  const X0 = o.min[0], Y0 = o.min[1], Z0 = o.min[2];
  const lip = o.lip || 1.3, sizeFn = o.sizeFn;
  const N1 = N + 1;
  // node storage
  let cap = 1 << 16;
  let nX = new Int32Array(cap), nY = new Int32Array(cap), nZ = new Int32Array(cap), nS = new Int32Array(cap);
  let nChild = new Int32Array(cap), nLeaf = new Int32Array(cap);
  let nCount = 0;
  function grow() {
    cap *= 2;
    const g = a => { const b = new Int32Array(cap); b.set(a); return b; };
    nX = g(nX); nY = g(nY); nZ = g(nZ); nS = g(nS); nChild = g(nChild); nLeaf = g(nLeaf);
  }
  // leaves (cells at final size that may hold surface)
  let lcap = 1 << 14;
  let lVal = new Float64Array(lcap * 8), lNode = new Int32Array(lcap), lVert = new Int32Array(lcap);
  let lCount = 0;
  function lgrow() {
    lcap *= 2;
    let b = new Float64Array(lcap * 8); b.set(lVal); lVal = b;
    let c = new Int32Array(lcap); c.set(lNode); lNode = c;
    c = new Int32Array(lcap); c.set(lVert); lVert = c;
  }
  // open addressing hash for lattice samples (key = linear lattice index)
  let hcap = 1 << 17, hKeys = new Int32Array(hcap).fill(-1), hVals = new Float64Array(hcap), hCount = 0;
  let evals = 0;
  function hgrow() {
    const ok = hKeys, ov = hVals;
    hcap *= 2; hKeys = new Int32Array(hcap).fill(-1); hVals = new Float64Array(hcap); hCount = 0;
    for (let i = 0; i < ok.length; i++) if (ok[i] >= 0) hput(ok[i], ov[i]);
  }
  function hput(key, v) {
    let i = Math.imul(key, 0x9E3779B1) >>> 0 & (hcap - 1);
    while (hKeys[i] >= 0) i = (i + 1) & (hcap - 1);
    hKeys[i] = key; hVals[i] = v; hCount++;
  }
  function corner(ix, iy, iz) {
    const key = (ix * N1 + iy) * N1 + iz;
    let i = Math.imul(key, 0x9E3779B1) >>> 0 & (hcap - 1);
    for (;;) {
      const k = hKeys[i];
      if (k === key) return hVals[i];
      if (k < 0) break;
      i = (i + 1) & (hcap - 1);
    }
    const v = sdf(X0 + ix * u0, Y0 + iy * u0, Z0 + iz * u0); evals++;
    if (hCount * 2 > hcap) { hgrow(); hput(key, v); } else { hKeys[i] = key; hVals[i] = v; hCount++; }
    return v;
  }

  function alloc() { if (nCount >= cap) grow(); return nCount++; }

  function build(id, ix, iy, iz, s) {
    nX[id] = ix; nY[id] = iy; nZ[id] = iz; nS[id] = s; nChild[id] = -1; nLeaf[id] = -1;
    const h = s * u0;
    const cx = X0 + (ix + s * 0.5) * u0, cy = Y0 + (iy + s * 0.5) * u0, cz = Z0 + (iz + s * 0.5) * u0;
    const isLeaf = s === 1 || h <= sizeFn(cx, cy, cz);
    if (!isLeaf) {
      const d = sdf(cx, cy, cz); evals++;
      if (Math.abs(d) > h * 0.8660254 * lip) return; // no surface in this cell
      const c0 = nCount;
      for (let i = 0; i < 8; i++) alloc();
      nChild[id] = c0;
      const hs = s >> 1;
      for (let i = 0; i < 8; i++) build(c0 + i, ix + ((i >> 2) & 1) * hs, iy + ((i >> 1) & 1) * hs, iz + (i & 1) * hs, hs);
      return;
    }
    // leaf: sample corners on the shared lattice (no centre evaluation)
    if (lCount >= lcap) lgrow();
    const li = lCount;
    let neg = 0, mn = 1e9;
    for (let c = 0; c < 8; c++) {
      const v = corner(ix + ((c >> 2) & 1) * s, iy + ((c >> 1) & 1) * s, iz + (c & 1) * s);
      lVal[li * 8 + c] = v;
      if (v < 0) neg++;
      const a = v < 0 ? -v : v; if (a < mn) mn = a;
    }
    if ((neg === 0 || neg === 8) && mn > h * 1.7320508 * lip) return; // provably empty
    lCount++;
    lNode[li] = id; lVert[li] = -1; nLeaf[id] = li;
  }
  alloc();
  build(0, 0, 0, 0, N);

  function findNode(ix, iy, iz) {
    if (ix < 0 || iy < 0 || iz < 0 || ix >= N || iy >= N || iz >= N) return -1;
    let n = 0;
    while (nChild[n] >= 0) {
      const hs = nS[n] >> 1;
      n = nChild[n] + (((ix >= nX[n] + hs) ? 4 : 0) | ((iy >= nY[n] + hs) ? 2 : 0) | ((iz >= nZ[n] + hs) ? 1 : 0));
    }
    return n;
  }

  // vertices
  const pos = [];
  let vCount = 0;
  const nodeVert = new Map(); // fallback verts for nodes without leaf data
  function gradAt(x, y, z, e) {
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
    const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
    const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    evals += 6;
    return [gx / (2 * e), gy / (2 * e), gz / (2 * e)];
  }
  function projectInBox(x, y, z, bx0, by0, bz0, h) {
    for (let it = 0; it < 4; it++) {
      const d = sdf(x, y, z); evals++;
      if (Math.abs(d) < h * 0.01) break;
      const g = gradAt(x, y, z, h * 0.05);
      const gg = g[0] * g[0] + g[1] * g[1] + g[2] * g[2] || 1;
      x -= d * g[0] / gg; y -= d * g[1] / gg; z -= d * g[2] / gg;
      x = Math.min(Math.max(x, bx0), bx0 + h); y = Math.min(Math.max(y, by0), by0 + h); z = Math.min(Math.max(z, bz0), bz0 + h);
    }
    return [x, y, z];
  }
  function leafVertex(li) {
    if (lVert[li] >= 0) return lVert[li];
    const n = lNode[li], s = nS[n], ix = nX[n], iy = nY[n], iz = nZ[n];
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    const b = li * 8;
    for (let e = 0; e < 12; e++) {
      const E = EDGES[e];
      const v0 = lVal[b + E[0]], v1 = lVal[b + E[1]];
      if ((v0 < 0) === (v1 < 0)) continue;
      const t = v0 / (v0 - v1);
      const c0 = E[0], c1 = E[1];
      const ax = ((c0 >> 2) & 1) + (((c1 >> 2) & 1) - ((c0 >> 2) & 1)) * t;
      const ay = ((c0 >> 1) & 1) + (((c1 >> 1) & 1) - ((c0 >> 1) & 1)) * t;
      const az = (c0 & 1) + ((c1 & 1) - (c0 & 1)) * t;
      sx += ax; sy += ay; sz += az; cnt++;
    }
    let x, y, z;
    const h = s * u0, bx = X0 + ix * u0, by = Y0 + iy * u0, bz = Z0 + iz * u0;
    if (cnt) { x = bx + sx / cnt * h; y = by + sy / cnt * h; z = bz + sz / cnt * h; }
    else {
      const p = projectInBox(bx + h * 0.5, by + h * 0.5, bz + h * 0.5, bx, by, bz, h);
      x = p[0]; y = p[1]; z = p[2];
    }
    pos.push(x, y, z);
    lVert[li] = vCount;
    return vCount++;
  }
  function nodeVertex(n) {
    if (nLeaf[n] >= 0) return leafVertex(nLeaf[n]);
    let v = nodeVert.get(n);
    if (v !== undefined) return v;
    const h = nS[n] * u0, bx = X0 + nX[n] * u0, by = Y0 + nY[n] * u0, bz = Z0 + nZ[n] * u0;
    const p = projectInBox(bx + h * 0.5, by + h * 0.5, bz + h * 0.5, bx, by, bz, h);
    pos.push(p[0], p[1], p[2]);
    v = vCount++;
    nodeVert.set(n, v);
    return v;
  }

  const tris = [];
  const q = [0, 0, 0, 0], qv = [0, 0, 0, 0];
  for (let li = 0; li < lCount; li++) {
    const n = lNode[li], s = nS[n], ix = nX[n], iy = nY[n], iz = nZ[n];
    const b = li * 8;
    for (let e = 0; e < 12; e++) {
      const E = EDGES[e];
      const v0 = lVal[b + E[0]], v1 = lVal[b + E[1]];
      if ((v0 < 0) === (v1 < 0)) continue;
      const c0 = E[0], axis = E[2];
      const ex = ix + ((c0 >> 2) & 1) * s, ey = iy + ((c0 >> 1) & 1) * s, ez = iz + (c0 & 1) * s;
      const m = s > 1 ? (s >> 1) : 0;
      if (axis === 0) {
        q[0] = findNode(ex + m, ey - 1, ez - 1); q[1] = findNode(ex + m, ey, ez - 1); q[2] = findNode(ex + m, ey, ez); q[3] = findNode(ex + m, ey - 1, ez);
      } else if (axis === 1) {
        q[0] = findNode(ex - 1, ey + m, ez - 1); q[1] = findNode(ex - 1, ey + m, ez); q[2] = findNode(ex, ey + m, ez); q[3] = findNode(ex, ey + m, ez - 1);
      } else {
        q[0] = findNode(ex - 1, ey - 1, ez + m); q[1] = findNode(ex, ey - 1, ez + m); q[2] = findNode(ex, ey, ez + m); q[3] = findNode(ex - 1, ey, ez + m);
      }
      let ok = true, owner = -1;
      for (let k = 0; k < 4; k++) {
        if (q[k] < 0 || nS[q[k]] < s) { ok = false; break; }
        if (owner < 0 && nS[q[k]] === s) owner = q[k];
      }
      if (!ok || owner !== n) continue;
      for (let k = 0; k < 4; k++) qv[k] = nodeVertex(q[k]);
      const flip = !(v0 < 0); // inside at low end -> normal along +axis -> keep order
      emit(qv, flip);
    }
  }
  function emit(v, flip) {
    // remove duplicates (adjacent leaves can be the same big node)
    const u = [];
    for (let k = 0; k < 4; k++) if (u.indexOf(v[k]) < 0) u.push(v[k]);
    if (u.length < 3) return;
    if (flip) u.reverse();
    if (u.length === 3) { tris.push(u[0], u[1], u[2]); return; }
    const d02 = dist2(u[0], u[2]), d13 = dist2(u[1], u[3]);
    if (d02 <= d13) tris.push(u[0], u[1], u[2], u[0], u[2], u[3]);
    else tris.push(u[0], u[1], u[3], u[1], u[2], u[3]);
  }
  function dist2(a, b) {
    const dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1], dz = pos[a * 3 + 2] - pos[b * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(tris), stats: { evals, nodes: nCount, leaves: lCount } };
}

// --- mesh utilities -------------------------------------------------------------------------

export function computeNormals(P, I, out) {
  const nv = P.length / 3;
  const Nn = out || new Float32Array(nv * 3);
  Nn.fill(0);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
    const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    Nn[a] += nx; Nn[a + 1] += ny; Nn[a + 2] += nz;
    Nn[b] += nx; Nn[b + 1] += ny; Nn[b + 2] += nz;
    Nn[c] += nx; Nn[c + 1] += ny; Nn[c + 2] += nz;
  }
  for (let i = 0; i < nv * 3; i += 3) {
    const l = Math.sqrt(Nn[i] * Nn[i] + Nn[i + 1] * Nn[i + 1] + Nn[i + 2] * Nn[i + 2]) || 1;
    Nn[i] /= l; Nn[i + 1] /= l; Nn[i + 2] /= l;
  }
  return Nn;
}

// vertex adjacency in CSR form
export function adjacency(nv, I) {
  const deg = new Int32Array(nv + 1);
  for (let t = 0; t < I.length; t += 3) { deg[I[t]] += 2; deg[I[t + 1]] += 2; deg[I[t + 2]] += 2; }
  const off = new Int32Array(nv + 1);
  for (let i = 0; i < nv; i++) off[i + 1] = off[i] + deg[i];
  const fill = off.slice(0, nv);
  const nb = new Int32Array(off[nv]);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    nb[fill[a]++] = b; nb[fill[a]++] = c;
    nb[fill[b]++] = a; nb[fill[b]++] = c;
    nb[fill[c]++] = a; nb[fill[c]++] = b;
  }
  return { off, nb };
}

/** Tangential relaxation: move vertices toward the neighbour centroid within the tangent plane,
 *  then (optionally) snap back onto the SDF surface with one Newton step. */
export function relax(P, I, iters, amount, sdf, weightFn) {
  const nv = P.length / 3;
  const { off, nb } = adjacency(nv, I);
  const Nn = new Float32Array(nv * 3);
  const tmp = new Float32Array(nv * 3);
  for (let it = 0; it < iters; it++) {
    computeNormals(P, I, Nn);
    for (let i = 0; i < nv; i++) {
      const i3 = i * 3;
      let sx = 0, sy = 0, sz = 0;
      const o0 = off[i], o1 = off[i + 1];
      if (o1 === o0) { tmp[i3] = P[i3]; tmp[i3 + 1] = P[i3 + 1]; tmp[i3 + 2] = P[i3 + 2]; continue; }
      for (let k = o0; k < o1; k++) { const j = nb[k] * 3; sx += P[j]; sy += P[j + 1]; sz += P[j + 2]; }
      const inv = 1 / (o1 - o0);
      let dx = sx * inv - P[i3], dy = sy * inv - P[i3 + 1], dz = sz * inv - P[i3 + 2];
      const nx = Nn[i3], ny = Nn[i3 + 1], nz = Nn[i3 + 2];
      const dn = dx * nx + dy * ny + dz * nz;
      dx -= dn * nx; dy -= dn * ny; dz -= dn * nz;
      const w = weightFn ? amount * weightFn(P[i3], P[i3 + 1], P[i3 + 2]) : amount;
      tmp[i3] = P[i3] + dx * w; tmp[i3 + 1] = P[i3 + 1] + dy * w; tmp[i3 + 2] = P[i3 + 2] + dz * w;
    }
    P.set(tmp);
    if (sdf) {
      for (let i = 0; i < nv; i++) {
        const i3 = i * 3;
        const x = P[i3], y = P[i3 + 1], z = P[i3 + 2];
        const d = sdf(x, y, z);
        if (Math.abs(d) < 1e-6) continue;
        const e = 2e-4;
        const gx = (sdf(x + e, y, z) - d) / e, gy = (sdf(x, y + e, z) - d) / e, gz = (sdf(x, y, z + e) - d) / e;
        const gg = gx * gx + gy * gy + gz * gz;
        if (gg < 1e-8) continue;
        let k = d / gg;
        const mx = 0.0015; // never jump far (thin features)
        const step = Math.abs(k) * Math.sqrt(gg);
        if (step > mx) k *= mx / step;
        P[i3] -= k * gx; P[i3 + 1] -= k * gy; P[i3 + 2] -= k * gz;
      }
    }
  }
  return { off, nb };
}

/** Remove unreferenced vertices and degenerate triangles; returns compacted arrays + old->new map */
export function compact(P, I) {
  const nv = P.length / 3;
  const map = new Int32Array(nv).fill(-1);
  const keep = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (a === b || b === c || a === c) continue;
    keep.push(a, b, c);
  }
  let n = 0;
  for (const v of keep) if (map[v] < 0) map[v] = n++;
  const P2 = new Float32Array(n * 3);
  for (let i = 0; i < nv; i++) if (map[i] >= 0) { P2[map[i] * 3] = P[i * 3]; P2[map[i] * 3 + 1] = P[i * 3 + 1]; P2[map[i] * 3 + 2] = P[i * 3 + 2]; }
  const I2 = new Uint32Array(keep.length);
  for (let i = 0; i < keep.length; i++) I2[i] = map[keep[i]];
  return { positions: P2, indices: I2, map };
}
