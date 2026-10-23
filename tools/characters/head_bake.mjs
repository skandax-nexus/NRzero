// head_bake.mjs: the hero-pipeline helpers of pack_cast2.mjs (docs/CHARACTER_LOOK.md, "Faces: hero pipeline").
// Plain typed arrays only (no glTF), so they can be tested on their own.
//  - headWeights(): per vertex, the summed skin weight on the head and its face bones;
//  - loopSubdivide(): one Loop subdivision step of a triangle soup with uv seams (positions welded across seams,
//    uvs interpolated per side), the "high-resolution head" the normal map is baked from;
//  - bakeHeadNormals(): a same-uv transfer bake. The simplified mesh keeps a subset of the raw vertices with their uvs,
//    so a texel names the same point of the skin on the raw (subdivided) head and on the shipped one: the shipped
//    surface's tangent frame there (three.js derivative frame: T along the uv's u gradient, B along v, glTF y flip)
//    re-expresses the high-resolution normal, and the generator's painted detail (pores, creases) is laid on top with
//    reoriented normal mapping. Only head skin texels that no other surface shares are written.

/** Sum of the skin weights on bones whose name matches re, per vertex. J / Wt: JOINTS_0 / WEIGHTS_0 arrays (floats). */
export function boneWeights(J, Wt, jointNames, re) {
  const n = J.length / 4, out = new Float32Array(n), hit = jointNames.map(nm => re.test(nm));
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) if (hit[J[i * 4 + k]]) out[i] += Wt[i * 4 + k];
  return out;
}

const keyOf = (x, y, z) => Math.round(x * 2e5) + ',' + Math.round(y * 2e5) + ',' + Math.round(z * 2e5);

/** Weld by position (0.005 mm): returns { id: Int32Array per vertex, n: welded count }. */
export function weld(P, verts) {
  const map = new Map(), id = new Int32Array(P.length / 3).fill(-1);
  let n = 0;
  for (const v of verts) {
    const k = keyOf(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    let w = map.get(k);
    if (w === undefined) { w = n++; map.set(k, w); }
    id[v] = w;
  }
  return { id, n };
}

/**
 * One Loop subdivision step of the triangles `tris` (flat index list into P / UV).
 * Returns { P, UV, N, T } (new arrays; N = area-weighted normals of the subdivided surface, welded across uv seams).
 */
export function loopSubdivide(P, UV, tris) {
  const used = [...new Set(tris)];
  const { id: wid, n: nw } = weld(P, used);
  // welded positions (first occurrence)
  const WP = new Float64Array(nw * 3), seen = new Uint8Array(nw);
  for (const v of used) { const w = wid[v]; if (!seen[w]) { seen[w] = 1; WP[w * 3] = P[v * 3]; WP[w * 3 + 1] = P[v * 3 + 1]; WP[w * 3 + 2] = P[v * 3 + 2]; } }
  // welded edges: opposite vertices; neighbours
  const E = new Map();      // "a_b" (a < b) -> { opp: [], id }
  const nb = Array.from({ length: nw }, () => new Set());
  const nt = tris.length / 3;
  for (let t = 0; t < nt; t++) {
    const w = [wid[tris[t * 3]], wid[tris[t * 3 + 1]], wid[tris[t * 3 + 2]]];
    for (let k = 0; k < 3; k++) {
      const a = w[k], b = w[(k + 1) % 3], c = w[(k + 2) % 3];
      if (a === b) continue;
      const ek = a < b ? a + '_' + b : b + '_' + a;
      let e = E.get(ek); if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), opp: [] }; E.set(ek, e); }
      e.opp.push(c);
      nb[a].add(b); nb[b].add(a);
    }
  }
  // boundary: edges with one face
  const bnb = Array.from({ length: nw }, () => []);
  for (const e of E.values()) if (e.opp.length === 1) { bnb[e.a].push(e.b); bnb[e.b].push(e.a); }
  // even (old) vertices
  const EV = new Float64Array(nw * 3);
  for (let w = 0; w < nw; w++) {
    if (bnb[w].length >= 2) {
      const [p, q] = bnb[w];
      for (let d = 0; d < 3; d++) EV[w * 3 + d] = 0.75 * WP[w * 3 + d] + 0.125 * (WP[p * 3 + d] + WP[q * 3 + d]);
      continue;
    }
    const k = nb[w].size;
    if (!k) { for (let d = 0; d < 3; d++) EV[w * 3 + d] = WP[w * 3 + d]; continue; }
    const beta = k > 3 ? 3 / (8 * k) : 3 / 16;
    for (let d = 0; d < 3; d++) {
      let s = 0; for (const q of nb[w]) s += WP[q * 3 + d];
      EV[w * 3 + d] = (1 - k * beta) * WP[w * 3 + d] + beta * s;
    }
  }
  // odd (edge) vertices, welded edge index
  const eIndex = new Map(); let ne = 0;
  const OV = [];
  for (const [ek, e] of E) {
    eIndex.set(ek, ne++);
    const out = [0, 0, 0];
    if (e.opp.length === 2) for (let d = 0; d < 3; d++) out[d] = 0.375 * (WP[e.a * 3 + d] + WP[e.b * 3 + d]) + 0.125 * (WP[e.opp[0] * 3 + d] + WP[e.opp[1] * 3 + d]);
    else for (let d = 0; d < 3; d++) out[d] = 0.5 * (WP[e.a * 3 + d] + WP[e.b * 3 + d]);
    OV.push(out);
  }
  // output: one vertex per (unwelded) old vertex and per (unwelded) edge
  const vOut = new Map(); const oP = [], oUV = [], oW = [];     // oW: welded id in the new surface (for normals)
  const add = (key, p, uv, w) => { let i = vOut.get(key); if (i === undefined) { i = oP.length / 3; vOut.set(key, i); oP.push(p[0], p[1], p[2]); oUV.push(uv[0], uv[1]); oW.push(w); } return i; };
  const T = [];
  for (let t = 0; t < nt; t++) {
    const v = [tris[t * 3], tris[t * 3 + 1], tris[t * 3 + 2]], w = v.map(x => wid[x]);
    if (w[0] === w[1] || w[1] === w[2] || w[0] === w[2]) continue;
    const ev = v.map((x, k) => add('v' + x, [EV[w[k] * 3], EV[w[k] * 3 + 1], EV[w[k] * 3 + 2]], [UV[x * 2], UV[x * 2 + 1]], w[k]));
    const od = [0, 1, 2].map(k => {
      const a = v[k], b = v[(k + 1) % 3], wa = w[k], wb = w[(k + 1) % 3];
      const ek = wa < wb ? wa + '_' + wb : wb + '_' + wa, ei = eIndex.get(ek);
      const uk = a < b ? a + '_' + b : b + '_' + a;
      return add('e' + uk, OV[ei], [(UV[a * 2] + UV[b * 2]) / 2, (UV[a * 2 + 1] + UV[b * 2 + 1]) / 2], nw + ei);
    });
    T.push(ev[0], od[0], od[2], od[0], ev[1], od[1], od[2], od[1], ev[2], od[0], od[1], od[2]);
  }
  const NP = new Float32Array(oP), NUV = new Float32Array(oUV), NT = new Uint32Array(T);
  // normals over the welded subdivided surface
  const acc = new Float64Array((nw + ne) * 3);
  for (let t = 0; t < NT.length / 3; t++) {
    const a = NT[t * 3], b = NT[t * 3 + 1], c = NT[t * 3 + 2];
    const ux = NP[b * 3] - NP[a * 3], uy = NP[b * 3 + 1] - NP[a * 3 + 1], uz = NP[b * 3 + 2] - NP[a * 3 + 2];
    const vx = NP[c * 3] - NP[a * 3], vy = NP[c * 3 + 1] - NP[a * 3 + 1], vz = NP[c * 3 + 2] - NP[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) { const w = oW[q]; acc[w * 3] += nx; acc[w * 3 + 1] += ny; acc[w * 3 + 2] += nz; }
  }
  const NN = new Float32Array(NP.length);
  for (let i = 0; i < NP.length / 3; i++) {
    const w = oW[i], x = acc[w * 3], y = acc[w * 3 + 1], z = acc[w * 3 + 2], l = Math.hypot(x, y, z) || 1;
    NN[i * 3] = x / l; NN[i * 3 + 1] = y / l; NN[i * 3 + 2] = z / l;
  }
  return { P: NP, UV: NUV, N: NN, T: NT };
}

/** Rasterise triangles in uv space (texel centres; v as stored in glTF, row = v * res). cb(texelIndex, t, b0, b1, b2). */
export function rasterUV(UV, tris, res, cb) {
  const nt = tris.length / 3;
  for (let t = 0; t < nt; t++) {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    const x0 = UV[a * 2] * res, y0 = UV[a * 2 + 1] * res, x1 = UV[b * 2] * res, y1 = UV[b * 2 + 1] * res, x2 = UV[c * 2] * res, y2 = UV[c * 2 + 1] * res;
    const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(den) < 1e-12) continue;
    const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxx = Math.min(res - 1, Math.ceil(Math.max(x0, x1, x2)));
    const miny = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxy = Math.min(res - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let py = miny; py <= maxy; py++) {
      const cy = py + 0.5;
      for (let px = minx; px <= maxx; px++) {
        const cx = px + 0.5;
        const b0 = ((y1 - y2) * (cx - x2) + (x2 - x1) * (cy - y2)) / den;
        const b1 = ((y2 - y0) * (cx - x2) + (x0 - x2) * (cy - y2)) / den;
        const b2 = 1 - b0 - b1;
        if (b0 < -1e-4 || b1 < -1e-4 || b2 < -1e-4) continue;
        cb(py * res + px, t, b0, b1, b2);
      }
    }
  }
}

const TEST = globalThis.process && process.env.BAKE_TEST ? process.env.BAKE_TEST.split(',').map(Number) : null;   // debugging: a constant tilt
const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Bake into a tangent-space normal image (RGB 0..255, res x res, `img` modified in place; it holds the painted detail).
 * hi: { P, N, UV, T } (subdivided head, its own arrays); lo: { P, N, UV } (the shipped vertex arrays) with
 * loTris = the shipped head-skin triangles (written) and foreign = every other shipped triangle (texels they also
 * cover are left alone). strength: 1 = the full high-resolution normal. Returns { texels, meanDev (deg) }.
 */
export function bakeHeadNormals(img, res, hi, lo, loTris, foreign, strength = 1) {
  const R2 = res * res;
  const HN = new Float32Array(R2 * 3), HC = new Uint8Array(R2);
  rasterUV(hi.UV, hi.T, res, (i, t, b0, b1, b2) => {
    const a = hi.T[t * 3], b = hi.T[t * 3 + 1], c = hi.T[t * 3 + 2];
    HN[i * 3] = hi.N[a * 3] * b0 + hi.N[b * 3] * b1 + hi.N[c * 3] * b2;
    HN[i * 3 + 1] = hi.N[a * 3 + 1] * b0 + hi.N[b * 3 + 1] * b1 + hi.N[c * 3 + 1] * b2;
    HN[i * 3 + 2] = hi.N[a * 3 + 2] * b0 + hi.N[b * 3 + 2] * b1 + hi.N[c * 3 + 2] * b2;
    HC[i] = 1;
  });
  const FC = new Uint8Array(R2);
  rasterUV(lo.UV, foreign, res, i => { FC[i] = 1; });
  // per shipped triangle: u / v gradients on its plane
  const nt = loTris.length / 3, G = new Float32Array(nt * 6);
  for (let t = 0; t < nt; t++) {
    const a = loTris[t * 3], b = loTris[t * 3 + 1], c = loTris[t * 3 + 2];
    const e1 = [lo.P[b * 3] - lo.P[a * 3], lo.P[b * 3 + 1] - lo.P[a * 3 + 1], lo.P[b * 3 + 2] - lo.P[a * 3 + 2]];
    const e2 = [lo.P[c * 3] - lo.P[a * 3], lo.P[c * 3 + 1] - lo.P[a * 3 + 1], lo.P[c * 3 + 2] - lo.P[a * 3 + 2]];
    const du1 = lo.UV[b * 2] - lo.UV[a * 2], dv1 = lo.UV[b * 2 + 1] - lo.UV[a * 2 + 1];
    const du2 = lo.UV[c * 2] - lo.UV[a * 2], dv2 = lo.UV[c * 2 + 1] - lo.UV[a * 2 + 1];
    // gradient of a linear function f on the triangle: g = (df1 * (e2 x n) x ... ) solved with the metric tensor
    const g11 = dot(e1, e1), g12 = dot(e1, e2), g22 = dot(e2, e2), det = g11 * g22 - g12 * g12;
    if (Math.abs(det) < 1e-20) continue;
    const grad = (f1, f2) => { const a1 = (g22 * f1 - g12 * f2) / det, a2 = (g11 * f2 - g12 * f1) / det; return [a1 * e1[0] + a2 * e2[0], a1 * e1[1] + a2 * e2[1], a1 * e1[2] + a2 * e2[2]]; };
    const gu = grad(du1, du2), gv = grad(dv1, dv2);
    G.set([...gu, ...gv], t * 6);
  }
  let texels = 0, dev = 0;
  const out = new Uint8Array(img);
  const wrote = new Uint8Array(R2);
  rasterUV(lo.UV, loTris, res, (i, t, b0, b1, b2) => {
    if (FC[i] || !HC[i]) return;
    const a = loTris[t * 3], b = loTris[t * 3 + 1], c = loTris[t * 3 + 2];
    const N = nrm([lo.N[a * 3] * b0 + lo.N[b * 3] * b1 + lo.N[c * 3] * b2, lo.N[a * 3 + 1] * b0 + lo.N[b * 3 + 1] * b1 + lo.N[c * 3 + 1] * b2, lo.N[a * 3 + 2] * b0 + lo.N[b * 3 + 2] * b1 + lo.N[c * 3 + 2] * b2]);
    const gu = [G[t * 6], G[t * 6 + 1], G[t * 6 + 2]], gv = [G[t * 6 + 3], G[t * 6 + 4], G[t * 6 + 5]];
    // three.js: T, B perpendicular to the interpolated normal, scaled by 1 / max(|T|, |B|)
    const pu = dot(gu, N), pv = dot(gv, N);
    const Tt = [gu[0] - N[0] * pu, gu[1] - N[1] * pu, gu[2] - N[2] * pu], Bt = [gv[0] - N[0] * pv, gv[1] - N[1] * pv, gv[2] - N[2] * pv];
    const s = 1 / Math.sqrt(Math.max(dot(Tt, Tt), dot(Bt, Bt), 1e-20));
    for (let d = 0; d < 3; d++) { Tt[d] *= s; Bt[d] *= s; }
    let H = nrm([HN[i * 3], HN[i * 3 + 1], HN[i * 3 + 2]]);
    if (TEST) H = nrm([N[0] + TEST[0], N[1] + TEST[1], N[2] + TEST[2]]);
    if (strength < 1) H = nrm([N[0] + (H[0] - N[0]) * strength, N[1] + (H[1] - N[1]) * strength, N[2] + (H[2] - N[2]) * strength]);
    // solve [T B N] x = H (3x3, Cramer)
    const M = [Tt, Bt, N];
    const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    const dm = dot(M[0], cr(M[1], M[2]));
    if (Math.abs(dm) < 1e-8) return;
    const x = dot(H, cr(M[1], M[2])) / dm, y = dot(M[0], cr(H, M[2])) / dm, z = dot(M[0], cr(M[1], H)) / dm;
    const m = nrm([x, y, Math.max(z, 0.05)]);              // macro, real frame
    // painted detail at this texel: stored (x, -y_real, z)
    const d0 = [img[i * 3] / 127.5 - 1, -(img[i * 3 + 1] / 127.5 - 1), img[i * 3 + 2] / 127.5 - 1];
    // reoriented normal mapping: detail laid onto the macro normal
    const tt = [m[0], m[1], m[2] + 1], uu = [-d0[0], -d0[1], d0[2]];
    const k = dot(tt, uu) / tt[2];
    const r = nrm([tt[0] * k - uu[0], tt[1] * k - uu[1], tt[2] * k - uu[2]]);
    out[i * 3] = Math.round((r[0] * 0.5 + 0.5) * 255);
    out[i * 3 + 1] = Math.round((-r[1] * 0.5 + 0.5) * 255);
    out[i * 3 + 2] = Math.round((r[2] * 0.5 + 0.5) * 255);
    wrote[i] = 1;
    texels++; dev += Math.acos(Math.min(1, dot(H, N))) * 57.2958;
  });
  img.set(out);
  return { texels, meanDev: texels ? dev / texels : 0, wrote };
}

/**
 * Ambient occlusion of the head skin (eye sockets, nostrils, mouth corners, lid creases, behind the ears, under the
 * jaw and the hairline), per vertex of `tris`, by cosine-weighted rays against `occ` (triangles of the same mesh:
 * head, hair volume, eyes, neck and collar). maxD: ray length (m). Returns Float32Array (per vertex of P; 1 = open).
 */
export function vertexAO(P, N, tris, occ, maxD = 0.06, rays = 40) {
  const nO = occ.length / 3;
  // uniform grid over the occluders
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < occ.length; i++) { const v = occ[i]; for (let d = 0; d < 3; d++) { mn[d] = Math.min(mn[d], P[v * 3 + d]); mx[d] = Math.max(mx[d], P[v * 3 + d]); } }
  const cs = 0.01, dim = [0, 1, 2].map(d => Math.max(1, Math.ceil((mx[d] - mn[d]) / cs) + 1));
  const cells = new Map();
  const cid = (x, y, z) => (x * dim[1] + y) * dim[2] + z;
  for (let t = 0; t < nO; t++) {
    const a = occ[t * 3], b = occ[t * 3 + 1], c = occ[t * 3 + 2];
    const lo = [0, 1, 2].map(d => Math.floor((Math.min(P[a * 3 + d], P[b * 3 + d], P[c * 3 + d]) - mn[d]) / cs));
    const hi = [0, 1, 2].map(d => Math.floor((Math.max(P[a * 3 + d], P[b * 3 + d], P[c * 3 + d]) - mn[d]) / cs));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
      const k = cid(x, y, z); let l = cells.get(k); if (!l) { l = []; cells.set(k, l); } l.push(t);
    }
  }
  const hit = (o, dir, skipV) => {
    // march the grid in steps of half a cell (cheap DDA), test each new cell's triangles once
    const seen = new Set();
    for (let s = 0; s <= maxD; s += cs * 0.5) {
      const x = Math.floor((o[0] + dir[0] * s - mn[0]) / cs), y = Math.floor((o[1] + dir[1] * s - mn[1]) / cs), z = Math.floor((o[2] + dir[2] * s - mn[2]) / cs);
      if (x < 0 || y < 0 || z < 0 || x >= dim[0] || y >= dim[1] || z >= dim[2]) continue;
      const k = cid(x, y, z); if (seen.has(k)) continue; seen.add(k);
      const l = cells.get(k); if (!l) continue;
      for (const t of l) {
        const a = occ[t * 3], b = occ[t * 3 + 1], c = occ[t * 3 + 2];
        if (a === skipV || b === skipV || c === skipV) continue;
        const e1x = P[b * 3] - P[a * 3], e1y = P[b * 3 + 1] - P[a * 3 + 1], e1z = P[b * 3 + 2] - P[a * 3 + 2];
        const e2x = P[c * 3] - P[a * 3], e2y = P[c * 3 + 1] - P[a * 3 + 1], e2z = P[c * 3 + 2] - P[a * 3 + 2];
        const px = dir[1] * e2z - dir[2] * e2y, py = dir[2] * e2x - dir[0] * e2z, pz = dir[0] * e2y - dir[1] * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det, tx = o[0] - P[a * 3], ty = o[1] - P[a * 3 + 1], tz = o[2] - P[a * 3 + 2];
        const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (dir[0] * qx + dir[1] * qy + dir[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
        const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (d > 0.0008 && d < maxD) return true;
      }
    }
    return false;
  };
  const ao = new Float32Array(P.length / 3).fill(1);
  const done = new Uint8Array(P.length / 3);
  const key = new Map();        // welded position -> ao (seams share it)
  // fixed cosine-weighted hemisphere directions (Hammersley), rotated into each normal's frame
  const H = [];
  for (let i = 0; i < rays; i++) {
    let b = 0, f = 0.5, n = i; while (n) { b += (n & 1) * f; n >>= 1; f *= 0.5; }
    const r = Math.sqrt((i + 0.5) / rays), ph = 2 * Math.PI * b;
    H.push([r * Math.cos(ph), r * Math.sin(ph), Math.sqrt(Math.max(0, 1 - r * r))]);
  }
  for (const v of tris) {
    if (done[v]) continue; done[v] = 1;
    const kk = Math.round(P[v * 3] * 2e5) + ',' + Math.round(P[v * 3 + 1] * 2e5) + ',' + Math.round(P[v * 3 + 2] * 2e5);
    if (key.has(kk)) { ao[v] = key.get(kk); continue; }
    const n = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    const t = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let tx = n[1] * t[2] - n[2] * t[1], ty = n[2] * t[0] - n[0] * t[2], tz = n[0] * t[1] - n[1] * t[0];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const bx = n[1] * tz - n[2] * ty, by = n[2] * tx - n[0] * tz, bz = n[0] * ty - n[1] * tx;
    const o = [P[v * 3] + n[0] * 0.0006, P[v * 3 + 1] + n[1] * 0.0006, P[v * 3 + 2] + n[2] * 0.0006];
    let free = 0;
    for (const h of H) {
      const d = [tx * h[0] + bx * h[1] + n[0] * h[2], ty * h[0] + by * h[1] + n[1] * h[2], tz * h[0] + bz * h[1] + n[2] * h[2]];
      if (!hit(o, d, v)) free++;
    }
    ao[v] = free / rays;
    key.set(kk, ao[v]);
  }
  return ao;
}

/** Write per-vertex values (ao) of `tris` into a single-channel image region: out[texel] = f(old, value). */
export function bakeVertexScalar(UV, tris, val, res, cb) {
  rasterUV(UV, tris, res, (i, t, b0, b1, b2) => {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    cb(i, val[a] * b0 + val[b] * b1 + val[c] * b2);
  });
}
