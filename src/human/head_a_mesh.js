// head_a mesh topology: a sphere-topology grid in chart space (azimuth / elevation of rays from CEN,
// dense on the face, sparse at the back, closed by a crown pole, open at the neck) into which feature
// patches are stitched: concentric edge loops around each eye fissure and around the mouth slit (the
// fissures and the slit are holes, so lids and lips get real margins). Grid cells under a patch are
// removed, the staircase rim is stitched to the patch's outer loop with a zipper strip and the nearby grid
// vertices are relaxed. All original code.
import { clamp, interp1 } from './head_a_util.js';

const DEG = Math.PI / 180;

// angles from lo to hi with local spacing sp(angle) (degrees), scaled to land exactly on hi
function seq(lo, hi, sp) {
  const a = [lo];
  let x = lo;
  while (x < hi - 1e-6) { x += sp(x); a.push(x); }
  const k = (hi - lo) / (a[a.length - 1] - lo);
  return a.map(v => lo + (v - lo) * k);
}

const LOD = {
  high: { col: [[0, 14, 32, 60, 95, 180], [1.05, 1.2, 1.8, 3.4, 6.5, 10]], row: [[-72, -50, -40, 42, 55, 72, 90], [3.2, 2.4, 1.15, 1.15, 1.7, 3.2, 4.5]], eyeN: 56, eyeLoops: [0, 0, 0, 0.022, 0.06, 0.12, 0.2, 0.3, 0.42, 0.56, 0.72, 0.86, 1], mouthN: 72 },
  medium: { col: [[0, 14, 32, 60, 95, 180], [2.3, 2.6, 3.8, 7, 12, 18]], row: [[-72, -50, -40, 42, 55, 72, 90], [6, 5, 2.6, 2.6, 3.6, 6, 9]], eyeN: 28, eyeLoops: [0, 0, 0, 0.05, 0.2, 0.42, 0.7, 1], mouthN: 36 },
  low: { col: [[0, 20, 40, 70, 110, 180], [6.5, 7.5, 9, 14, 22, 30]], row: [[-72, -50, -40, 42, 55, 72, 90], [12, 10, 7, 7, 9, 13, 18]], eyeN: 12, eyeLoops: [0, 0, 0.35, 1], mouthN: 16 },
};
export function lodSpec(lod) { return LOD[lod] || LOD.high; }

// chart grid (cached per LOD)
const GRIDS = new Map();
export function chartGrid(lod) {
  let G = GRIDS.get(lod);
  if (G) return G;
  const L = lodSpec(lod);
  const half = seq(0, 180, (t) => interp1(L.col[0], L.col[1], t));
  const NH = half.length - 1, NU = 2 * NH;
  const colTh = new Float64Array(NU + 1);
  for (let i = 0; i <= NU; i++) { const h = i - NH; colTh[i] = (h < 0 ? -half[-h] : half[h]) * DEG; }
  const rows = seq(L.row[0][0], L.row[0][L.row[0].length - 1], (t) => interp1(L.row[0], L.row[1], t));
  rows.pop(); // the last one is the pole
  const NV = rows.length;
  const rowPh = Float64Array.from(rows.map(r => r * DEG));
  G = { lod, NH, NU, NV, colTh, rowPh };
  // fractional index lookups
  G.iOf = (th) => {
    let lo = 0, hi = NU;
    if (th <= colTh[0]) return 0;
    if (th >= colTh[NU]) return NU;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (colTh[m] <= th) lo = m; else hi = m; }
    return lo + (th - colTh[lo]) / (colTh[hi] - colTh[lo]);
  };
  G.jOf = (ph) => {
    let lo = 0, hi = NV - 1;
    if (ph <= rowPh[0]) return (ph - rowPh[0]) / (rowPh[1] - rowPh[0]);
    if (ph >= rowPh[NV - 1]) return NV - 1 + (ph - rowPh[NV - 1]) / (Math.PI / 2 - rowPh[NV - 1]);
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rowPh[m] <= ph) lo = m; else hi = m; }
    return lo + (ph - rowPh[lo]) / (rowPh[hi] - rowPh[lo]);
  };
  G.thOf = (i) => { const a = clamp(Math.floor(i), 0, NU - 1), f = i - a; return colTh[a] + (colTh[a + 1] - colTh[a]) * f; };
  G.phOf = (j) => {
    if (j >= NV - 1) return rowPh[NV - 1] + (Math.PI / 2 - rowPh[NV - 1]) * (j - NV + 1);
    const a = clamp(Math.floor(j), 0, NV - 2), f = j - a; return rowPh[a] + (rowPh[a + 1] - rowPh[a]) * f;
  };
  GRIDS.set(lod, G);
  return G;
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function distToPoly(px, py, poly) {
  let best = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], ay = poly[j][1], bx = poly[i][0], by = poly[i][1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-12;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    best = Math.min(best, Math.hypot(px - ax - dx * t, py - ay - dy * t));
  }
  return best;
}
const signedArea = (poly) => { let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]); return a * 0.5; };

// Build the topology.
//   patches: [{ name, loops: [[{ij: [i, j], xy: [x, y]}...N] ...K] }] innermost loop first (all loops have N
//   vertices, the outer loop must carry ij chart coordinates; inner loops carry ij for UVs).
// Returns { nGrid, ij (Float64Array 2 per vertex), index, seam pairs, patchBase (first vertex of each patch),
//   kind (0 grid, 1 patch) , gridW }
export function buildTopology(G, patches) {
  const NU = G.NU, NV = G.NV, W = NU + 1;
  const nGrid = NV * W + 1, pole = NV * W;
  // ---- orient patches CCW in chart space (u right, v up)
  for (const P of patches) {
    const outer = P.loops[P.loops.length - 1].map(v => v.ij);
    if (signedArea(outer) < 0) for (const L of P.loops) L.reverse();
  }
  // ---- removed cells
  const removed = new Uint8Array(NU * NV);
  for (const P of patches) {
    const poly = P.loops[P.loops.length - 1].map(v => v.ij);
    let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
    for (const [i, j] of poly) { i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
    const inside = (i, j) => pointInPoly(i, j, poly) || distToPoly(i, j, poly) < 0.5;
    for (let j = Math.max(0, Math.floor(j0) - 2); j <= Math.min(NV - 2, Math.ceil(j1) + 1); j++) {
      for (let i = Math.max(0, Math.floor(i0) - 2); i <= Math.min(NU - 1, Math.ceil(i1) + 1); i++) {
        if (inside(i, j) || inside(i + 1, j) || inside(i + 1, j + 1) || inside(i, j + 1)) removed[j * NU + i] = 1;
      }
    }
  }
  // remove pinches / near-enclosed cells so each hole rim is a simple loop
  const rem = (i, j) => (i < 0 || j < 0 || i >= NU || j >= NV - 1) ? 0 : removed[j * NU + i];
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU; i++) {
      if (removed[j * NU + i]) continue;
      const n = rem(i - 1, j) + rem(i + 1, j) + rem(i, j - 1) + rem(i, j + 1);
      const pinch = (rem(i - 1, j - 1) && !rem(i - 1, j) && !rem(i, j - 1)) || (rem(i + 1, j - 1) && !rem(i + 1, j) && !rem(i, j - 1)) ||
        (rem(i - 1, j + 1) && !rem(i - 1, j) && !rem(i, j + 1)) || (rem(i + 1, j + 1) && !rem(i + 1, j) && !rem(i, j + 1));
      if (n >= 3 || (n === 2 && ((rem(i - 1, j) && rem(i + 1, j)) || (rem(i, j - 1) && rem(i, j + 1))))) { removed[j * NU + i] = 1; changed = true; }
      else if (pinch && n >= 1) { removed[j * NU + i] = 1; changed = true; }
    }
    if (!changed) break;
  }
  // ---- grid triangles
  const idx = [];
  for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU; i++) {
    if (removed[j * NU + i]) continue;
    const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W;
    if (G.colTh[i] + G.colTh[i + 1] >= 0) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);
  }
  for (let i = 0; i < NU; i++) { const a = (NV - 1) * W + i; idx.push(a, a + 1, pole); }
  // ---- per patch: vertices, internal rings, rim loop and zipper
  const ij = [];
  for (let jj = 0; jj < NV; jj++) for (let i = 0; i <= NU; i++) ij.push(i, jj);
  ij.push(NU / 2, NV - 1 + 1);
  const kind = [];
  for (let k = 0; k < nGrid; k++) kind.push(0);
  const patchBase = [];
  let nv = nGrid;
  for (const P of patches) {
    const K = P.loops.length, N = P.loops[0].length;
    const base = nv;
    patchBase.push(base);
    for (const L of P.loops) for (const v of L) { ij.push(v.ij[0], v.ij[1]); kind.push(1); nv++; }
    const vid = (k, n) => base + k * N + ((n % N) + N) % N;
    for (let k = 0; k < K - 1; k++) {
      if (P.skipRing && P.skipRing(k)) continue;
      for (let n = 0; n < N; n++) {
        const a0 = vid(k, n), a1 = vid(k, n + 1), b0 = vid(k + 1, n), b1 = vid(k + 1, n + 1);
        idx.push(a0, b0, b1, a0, b1, a1);
      }
    }
    // rim loop of the hole: boundary edges of remaining cells next to removed cells of this patch
    const outer = P.loops[K - 1];
    const poly = outer.map(v => v.ij);
    let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
    for (const [i, j] of poly) { i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
    const next = new Map();
    for (let j = Math.max(0, Math.floor(j0) - 4); j <= Math.min(NV - 2, Math.ceil(j1) + 4); j++) {
      for (let i = Math.max(0, Math.floor(i0) - 4); i <= Math.min(NU - 1, Math.ceil(i1) + 4); i++) {
        if (removed[j * NU + i]) continue;
        const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W;
        // edges of this cell (CCW) whose neighbour is removed; stored reversed (CCW around the hole)
        if (rem(i, j - 1)) next.set(b, a);
        if (rem(i + 1, j)) next.set(c, b);
        if (rem(i, j + 1)) next.set(d, c);
        if (rem(i - 1, j)) next.set(a, d);
      }
    }
    // chain
    const start = next.keys().next().value;
    const rim = [start];
    let cur = next.get(start), guard = 0;
    while (cur !== start && cur !== undefined && guard++ < 100000) { rim.push(cur); cur = next.get(cur); }
    P.rim = rim;
    // zipper: inner loop = patch outer (CCW), outer loop = rim (CCW)
    const A = outer.map((v, n) => ({ id: vid(K - 1, n), x: v.xy[0], y: v.xy[1] }));
    const B = rim.map(id => ({ id, x: P.rimXY(id)[0], y: P.rimXY(id)[1] }));
    const Na = A.length, Nb = B.length;
    let jb = 0, best = 1e9;
    for (let n = 0; n < Nb; n++) { const d = Math.hypot(B[n].x - A[0].x, B[n].y - A[0].y); if (d < best) { best = d; jb = n; } }
    let ia = 0, cb = 0;
    const d2 = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
    while (ia < Na || cb < Nb) {
      const a = A[ia % Na], a1 = A[(ia + 1) % Na], b = B[(jb + cb) % Nb], b1 = B[(jb + cb + 1) % Nb];
      const advA = cb >= Nb || (ia < Na && d2(a1, b) < d2(a, b1));
      if (advA) { idx.push(a.id, b.id, a1.id); ia++; } else { idx.push(a.id, b.id, b1.id); cb++; }
    }
  }
  // seam pairs (column 0 and NU coincide)
  const seam = [];
  for (let jj = 0; jj < NV; jj++) seam.push([jj * W, jj * W + NU]);
  return { nGrid, nv, ij: Float64Array.from(ij), index: idx, seam, patchBase, kind: Uint8Array.from(kind), W, pole, removed };
}

// vertex adjacency (CSR) from triangles
export function adjacency(nv, index) {
  const cnt = new Int32Array(nv + 1);
  for (let t = 0; t < index.length; t++) cnt[index[t] + 1] += 2;
  for (let i = 0; i < nv; i++) cnt[i + 1] += cnt[i];
  const fill = cnt.slice(0, nv), nb = new Int32Array(cnt[nv]);
  for (let t = 0; t < index.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = index[t + e], b = index[t + (e + 1) % 3];
      nb[fill[a]++] = b; nb[fill[b]++] = a;
    }
  }
  return { off: cnt, nb };
}
