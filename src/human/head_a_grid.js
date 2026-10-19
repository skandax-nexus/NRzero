// head_a grid: canonical sphere-topology grid for the skin surface (azimuth columns x knot-anchored rows,
// closed by a crown pole, open at the neck). The eye fissures and the mouth are slits: two adjacent rows
// whose shared quads are removed between the canthi / mouth corners, so the lids and lips get their own
// edge loops and UV rows. Topology depends only on the LOD, so it is built once and cached.

// column knots (degrees of azimuth, one side; mirrored) and counts to the next knot
const COLS = {
  high: { knots: [0, 6, 11, 15, 22, 33, 50, 78, 115, 180], n: [6, 6, 4, 8, 12, 12, 10, 7, 7] },
  medium: { knots: [0, 6, 11, 15, 22, 33, 50, 78, 115, 180], n: [3, 3, 2, 4, 6, 6, 5, 4, 3] },
  low: { knots: [0, 11, 22, 33, 50, 78, 115, 180], n: [2, 2, 2, 2, 2, 2, 2] },
};
// row knots bottom -> top with counts to the next knot. 'mL'/'mU' and 'eL'/'eU' are the slit row pairs.
const ROWS = {
  high: [['bottom', 7], ['throat', 6], ['menton', 5], ['pog', 6], ['lbord', 7], ['mL', 1], ['mU', 6], ['ubord', 6], ['sub', 12], ['tip', 7], ['eLo', 8], ['eL', 1], ['eU', 6], ['crease', 6], ['brow', 8], ['fore', 9], ['top', 0]],
  medium: [['bottom', 4], ['throat', 3], ['menton', 3], ['pog', 3], ['lbord', 4], ['mL', 1], ['mU', 3], ['ubord', 3], ['sub', 6], ['tip', 4], ['eLo', 4], ['eL', 1], ['eU', 3], ['crease', 3], ['brow', 4], ['fore', 5], ['top', 0]],
  low: [['bottom', 2], ['throat', 2], ['menton', 1], ['pog', 2], ['lbord', 2], ['mL', 1], ['mU', 2], ['ubord', 1], ['sub', 2], ['tip', 2], ['eLo', 2], ['eL', 1], ['eU', 2], ['crease', 1], ['brow', 2], ['fore', 3], ['top', 0]],
};

const CACHE = new Map();

export function getGrid(lod) {
  let G = CACHE.get(lod);
  if (G) return G;
  const C = COLS[lod], RW = ROWS[lod];
  // ---- columns: half list from 0 to 180, then mirrored to -180..180 (col 0 = -180, col NU = +180)
  const half = [0];
  const halfKnot = { 0: 0 };
  for (let s = 0; s < C.n.length; s++) {
    const a = C.knots[s], b = C.knots[s + 1], n = C.n[s];
    for (let k = 1; k <= n; k++) half.push(a + (b - a) * k / n);
    halfKnot[b] = half.length - 1;
  }
  const NH = half.length - 1;          // columns per side
  const NU = 2 * NH;
  const colTh = new Float64Array(NU + 1);
  for (let i = 0; i <= NU; i++) { const h = i - NH; colTh[i] = (h < 0 ? -half[-h] : half[h]); }
  const colOf = (deg) => NH + Math.sign(deg) * halfKnot[Math.abs(deg)];
  // ---- rows
  const rowKnot = {}, rowSeg = [];   // rowSeg[j] = [knotIndex, fraction]
  let j = 0;
  for (let s = 0; s < RW.length; s++) {
    const [name, n] = RW[s];
    rowKnot[name] = j;
    if (n === 0) { rowSeg.push([s, 0]); j++; break; }
    for (let k = 0; k < n; k++) { rowSeg.push([s, k / n]); j++; }
  }
  const NV = j;
  const knotNames = RW.map(r => r[0]);
  // ---- holes
  const eyeIn = [colOf(-11), colOf(11)], eyeOut = [colOf(-33), colOf(33)];
  const mouthC = [colOf(-15), colOf(15)];
  const rEL = rowKnot.eL, rEU = rowKnot.eU, rML = rowKnot.mL, rMU = rowKnot.mU;
  const isHole = (i, jj) => {
    if (jj === rEL) { if ((i >= eyeOut[0] && i < eyeIn[0]) || (i >= eyeIn[1] && i < eyeOut[1])) return true; }
    if (jj === rML) { if (i >= mouthC[0] && i < mouthC[1]) return true; }
    return false;
  };
  // ---- indices (vertex (i, j) -> j * (NU + 1) + i; pole = NV * (NU + 1))
  const W = NU + 1;
  const NVtx = NV * W + 1;
  const idx = [];
  for (let jj = 0; jj < NV - 1; jj++) {
    for (let i = 0; i < NU; i++) {
      if (isHole(i, jj)) continue;
      const a = jj * W + i, b = a + 1, c = a + W + 1, d = a + W;
      if (colTh[i] >= 0) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);
    }
  }
  const pole = NV * W;
  for (let i = 0; i < NU; i++) { const a = (NV - 1) * W + i; idx.push(a, a + 1, pole); }
  // seam pairs (col 0 and col NU coincide)
  const seam = [];
  for (let jj = 0; jj < NV; jj++) seam.push([jj * W, jj * W + NU]);
  // UVs: grid index space (v up to 0.86; the strip above is reserved for ears)
  const VMAX = 0.86;
  const uv = new Float32Array(NVtx * 2);
  for (let jj = 0; jj < NV; jj++) for (let i = 0; i <= NU; i++) { const k = jj * W + i; uv[k * 2] = i / NU; uv[k * 2 + 1] = (jj / (NV - 1)) * VMAX; }
  uv[pole * 2] = 0.5; uv[pole * 2 + 1] = VMAX;
  G = {
    lod, NU, NV, NH, W, NVtx, pole, colTh, rowSeg, rowKnot, knotNames, index: idx, seam, uv, VMAX,
    eyeIn, eyeOut, mouthC, rEL, rEU, rML, rMU, colOf,
    RW,
  };
  CACHE.set(lod, G);
  return G;
}
