// AFTERZERO head_b: skin mesh from the anatomical SDF.
// Adaptive octree dual contouring (head_b_mesh.js) with cell sizes chosen per region (fine lid
// margins / lip line, medium nose / ears / lips, coarse skull) -> drop the neck cap -> tangential
// relaxation re-projected onto the field -> normals -> per-vertex SDF ambient occlusion, thinness
// and tissue tint -> anatomical morph targets (blink, jaw open, smile) -> lips split along the
// stomion so the jaw opens cleanly -> front-weighted spherical UVs with a seam split at the back.
// Pure JS (no three.js).

import { PART, clamp, smoothstep, mix, gauss, lidAt } from './head_b_sdf.js';
import { polygonize, computeNormals, relax, compact } from './head_b_mesh.js';

const { sqrt, abs, max, min, atan2, sin, cos, PI } = Math;

// octree: root cube 0.36 m at depth 9 -> leaf sizes 0.70, 1.41, 2.81, 5.6, 11.25 mm
const ROOT = { min: [-0.18, -0.15, -0.135], size: 0.36 };
const C1 = 0.00072, C2 = 0.00143, C3 = 0.00285, C4 = 0.0057, C5 = 0.0114, C6 = 0.0228;

function sizeFn(m, F, detail) {
  const hi = detail === 'high', med = detail === 'medium', low = detail === 'low';
  const E = F.E;
  const sMargin = hi ? C2 : med ? C3 : C4;
  const sEye = hi ? C2 : med ? C3 : C4;
  const sLipLine = hi ? C1 : med ? C3 : C4;
  const sLip = hi ? C2 : med ? C3 : C4;
  const sNose = hi ? C2 : med ? C3 : C4;
  const sEar = hi ? C3 : med ? C4 : C5;
  const sFace = hi ? C3 : C4;
  const sBack = hi ? C4 : med ? C5 : C5;
  const mw = m.mouthHW;
  return (x, y, z) => {
    const ax = abs(x);
    // eyes: fine at the lid margins (the fissure), medium over the lids
    const ex = ax - E.x, ey = y - E.y, ez = z - E.z;
    const er2 = ex * ex + ey * ey + ez * ez;
    if (er2 < 0.019 * 0.019 && ez > -0.004) {
      if (low) return C4;
      const r = sqrt(er2);
      if (hi && r > F.Re - 0.0015 && r < F.Re + 0.004) {
        const al = atan2(ex, ez), be = atan2(ey, sqrt(ex * ex + ez * ez));
        const L = lidAt(m, al);
        if (L[2] > -0.1 && L[2] < 1.1 && (abs(be - L[0]) < 0.16 || abs(be - L[1]) < 0.14)) return C1;
      }
      return r < F.Re + 0.006 ? sMargin : sEye;
    }
    // lips / mouth line
    if (ax < mw + 0.006 && abs(y - m.stoY) < 0.016 && z > m.lipZ - 0.02) {
      if (abs(y - m.stoY) < 0.003 && z > m.lipZ - 0.012) return sLipLine;
      return sLip;
    }
    // nose
    if (ax < 0.024 && y > m.subY - 0.008 && y < m.sellY + 0.004 && z > m.sellZ - 0.014) return (y < m.tipY + 0.012 ? sNose : sFace);
    // ears
    if (ax > 0.06 && y > 0.02 && y < 0.125 && z < 0.025 && z > -0.045) return sEar;
    if (low) return z > 0.035 && ax < 0.06 && y > m.mentY - 0.01 && y < m.browY + 0.03 ? C4 : (y > 0.13 || z < -0.03 || y < -0.06 ? C6 : C5);
    // face front
    if (z > 0.02 && ax < 0.07 && y > m.mentY - 0.012 && y < m.browY + 0.035) return sFace;
    if (z > -0.03 && y > m.mentY - 0.03 && y < m.browY + 0.06) return hi ? C4 : C5;
    if (y < -0.075) return med ? C6 : C5;
    return sBack;
  };
}

// ---- UV mapping (canonical coords): front-weighted azimuth, elevation about a mid-head point ----
const UZA = -0.01, VYC = 0.05;
function warp(t, a) { const s = t < 0 ? -1 : 1; t = abs(t); return s * (a * t - (a - 1) * t * t); }
export function uvOf(x, y, z) {
  const dz = z - UZA, rho = sqrt(x * x + dz * dz);
  const u = 0.5 + 0.5 * warp(atan2(x, dz) / PI, 1.6);
  const v = 0.5 + 0.5 * warp(atan2(y - VYC, rho) / (PI / 2), 1.3);
  return [u, v];
}

// ---- eye-local frame ----
function eyeLocal(m, F, x, y, z) {
  const side = x >= 0 ? 1 : -1;
  const lx = side * x - F.E.x, ly = y - (F.E.y + side * m.asym.eyeDy), lz = z - (F.E.z + side * m.asym.eyeDz);
  const r = sqrt(lx * lx + ly * ly + lz * lz), h = sqrt(lx * lx + lz * lz);
  return { side, r, az: atan2(lx, lz), el: atan2(ly, h) };
}
function fromEyeLocal(m, F, side, r, az, el) {
  const lx = r * cos(el) * sin(az), ly = r * sin(el), lz = r * cos(el) * cos(az);
  return [side * (lx + F.E.x), ly + F.E.y + side * m.asym.eyeDy, lz + F.E.z + side * m.asym.eyeDz];
}

/** blink: elevation delta (full closure) for a vertex near an eye, or 0 */
function lidClose(m, F, e) {
  if (e.r > 0.026) return 0;
  const L = lidAt(m, e.az);
  const t = L[2];
  if (t <= -0.25 || t >= 1.25) return 0;
  const tc = clamp(t, 0, 1);
  const up = L[0], lo = L[1];
  const meet = lo + 0.22 * (up - lo);           // lids meet low (the upper lid does most of the work)
  const mid = 0.5 * (up + lo);
  const lat = smoothstep(-0.25, 0.02, t) * smoothstep(1.25, 0.98, t);
  const rad = smoothstep(0.026, 0.019, e.r);
  const crease = F.lidPack.crease;
  if (e.el >= mid) {
    const u = e.el - up;                        // 0 at the margin, grows toward the brow
    const w = u <= crease * 0.85 ? 1 : smoothstep(crease + 0.5, crease * 0.85, u);
    return (meet - up) * w * lat * rad * (0.9 + 0.1 * sin(PI * tc));
  }
  const l = lo - e.el;
  const w = l <= 0.05 ? 1 : smoothstep(0.42, 0.05, l);
  return (meet - lo) * w * lat * rad;
}

/** jaw-open weight for a canonical point (1 = moves fully with the mandible) */
function jawWeight(m, F, x, y, z) {
  const ax = abs(x), hw = m.mouthHW;
  let yl = F.stomion(clamp(x, -hw, hw));
  if (ax > hw) yl -= (ax - hw) * 0.7 + max(0, ax - hw - 0.012) * 0.5;
  const band = 0.0006 + max(0, ax - hw) * 0.6 + max(0, 0.07 - z) * 0.12;
  let w = smoothstep(yl + band, yl - band, y);
  w *= 0.35 + 0.65 * smoothstep(-0.02, 0.03, z);       // fade toward the jaw joint
  w *= smoothstep(-0.095, -0.045, y);                   // and into the neck
  return w;
}

/** smile displacement (canonical) */
function smileDisp(m, F, x, y, z, out) {
  const ax = abs(x), s = x >= 0 ? 1 : -1, hw = m.mouthHW;
  const ys = F.stomion(clamp(x, -hw, hw));
  let dx = 0, dy = 0, dz = 0;
  const front = smoothstep(0.045, 0.075, z);
  // corners: up, out, back (zygomaticus major pulls toward the cheekbone)
  const cw = gauss(ax - hw, 0.011) * gauss(y - ys, 0.011) * front;
  dy += 0.0034 * cw; dx += 0.0024 * cw; dz -= 0.0018 * cw;
  // lips stretch laterally and thin; upper lip lifts
  const lw = gauss(y - ys, 0.009) * smoothstep(0.065, 0.09, z) * (ax < hw ? ax / hw : 1);
  dx += 0.0012 * lw;
  dy += 0.0007 * gauss(y - (ys + 0.006), 0.006) * gauss(ax, hw);
  // cheeks raise and bulge (the nasolabial fold deepens)
  const ck = gauss(ax - 0.036, 0.016) * gauss(y - (m.subY + 0.012), 0.016) * front;
  dy += 0.0024 * ck; dz += 0.0014 * ck;
  // lower lid squint
  const e = eyeLocal(m, F, x, y, z);
  if (e.r < 0.026) {
    const L = lidAt(m, e.az);
    if (L[2] > -0.1 && L[2] < 1.1 && e.el < 0.5 * (L[0] + L[1])) {
      const w = smoothstep(L[1] - 0.6, L[1] - 0.05, e.el) * smoothstep(0.026, 0.017, e.r) * smoothstep(-0.1, 0.1, L[2]) * smoothstep(1.1, 0.9, L[2]);
      dy += 0.0011 * w; dz += 0.0003 * w;
    }
  }
  out[0] = dx * s; out[1] = dy; out[2] = dz;
}

/**
 * Build the skin mesh in canonical coordinates (metres before scaling by m.S).
 */
export function buildSkinMesh(m, F, detail = 'high') {
  const t0 = performance.now();
  const depth = detail === 'low' ? 8 : 9;
  const sdf = F.sdf;
  const res = polygonize(sdf, { min: ROOT.min, size: ROOT.size, depth, sizeFn: sizeFn(m, F, detail), lip: 1.5 });
  // drop the flat cap that closes the neck stub (hidden inside the body)
  let I0 = res.indices;
  {
    const Pp = res.positions, yCut = F.nk.y1 + 0.0035, keep = [];
    for (let t = 0; t < I0.length; t += 3) {
      const a = I0[t], b = I0[t + 1], c = I0[t + 2];
      if (Pp[a * 3 + 1] < yCut && Pp[b * 3 + 1] < yCut && Pp[c * 3 + 1] < yCut) continue;
      keep.push(a, b, c);
    }
    I0 = new Uint32Array(keep);
  }
  const t1 = performance.now();
  let { positions: P, indices: I } = compact(res.positions, I0);
  relax(P, I, detail === 'low' ? 2 : 2, 0.5, sdf, null);
  let N = computeNormals(P, I);
  const t2 = performance.now();
  const nv = P.length / 3;
  // ---- per-vertex attributes: AO, thinness, tint ----
  const attr = new Float32Array(nv * 2), col = new Float32Array(nv * 3), part = new Uint8Array(nv);
  const hs = detail === 'low' ? [0.003, 0.01] : [0.0015, 0.004, 0.009, 0.016];
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    let occ = 0, wsum = 0, w = 1;
    for (const h of hs) {
      const d = sdf(x + nx * h, y + ny * h, z + nz * h);
      occ += w * clamp((h - d) / h, 0, 1); wsum += w; w *= 0.72;
    }
    const ao = clamp(1 - occ / wsum * 1.05, 0, 1);
    const hin = 0.005;
    const din = sdf(x - nx * hin, y - ny * hin, z - nz * hin);
    const thin = clamp(1 + din / hin, 0, 1);
    attr[i * 2] = ao; attr[i * 2 + 1] = thin;
    const pt = F.part(x, y, z); part[i] = pt;
    let r = 1, g = 1, b = 1;
    if (pt === PART.MOUTH) { const dpt = smoothstep(0.0, 0.012, m.lipZ - z); r = mix(0.55, 0.16, dpt); g = mix(0.32, 0.05, dpt); b = mix(0.32, 0.05, dpt); }
    else if (pt === PART.NOSTRIL) { r = 0.5; g = 0.36; b = 0.34; }
    else if (pt === PART.LIDINNER) { r = 1.08; g = 0.78; b = 0.76; }
    else if (pt === PART.CARUNCLE) { r = 1.12; g = 0.68; b = 0.68; }
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  const t3 = performance.now();
  // ---- morph targets (relative deltas, canonical) ----
  const blink = new Float32Array(nv * 3), jaw = new Float32Array(nv * 3), smile = new Float32Array(nv * 3);
  const jawAng = 0.27, jawSlide = 0.0028, pivY = 0.06, pivZ = 0.002;
  const cj = cos(jawAng), sj = sin(jawAng);
  const sd = [0, 0, 0];
  const jawW = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const e = eyeLocal(m, F, x, y, z);
    if (e.r < 0.026 && e.az > m.fis.am - 0.6 && e.az < m.fis.al + 0.6) {
      const d = lidClose(m, F, e);
      if (abs(d) > 1e-6) {
        // keep the lid off the cornea while it slides down over the front of the eye
        const L = lidAt(m, e.az);
        const bulge = 0.0011 * smoothstep(0.75, 0.0, abs(e.az)) * smoothstep(0, 0.12, abs(d)) * (e.el >= 0.5 * (L[0] + L[1]) ? 1 : 0.4);
        const q = fromEyeLocal(m, F, e.side, e.r + bulge, e.az, e.el + d);
        blink[i * 3] = q[0] - x; blink[i * 3 + 1] = q[1] - y; blink[i * 3 + 2] = q[2] - z;
      }
    }
    const w = jawWeight(m, F, x, y, z);
    jawW[i] = w;
    if (w > 1e-4) {
      const ry = y - pivY, rz = z - pivZ;
      jaw[i * 3 + 1] = (pivY + cj * ry - sj * rz - y) * w;
      jaw[i * 3 + 2] = (pivZ + sj * ry + cj * rz + jawSlide - z) * w;
    }
    smileDisp(m, F, x, y, z, sd);
    smile[i * 3] = sd[0]; smile[i * 3 + 1] = sd[1]; smile[i * 3 + 2] = sd[2];
  }
  const morphs = { blink, jaw, smile };
  // ---- split the lips along the stomion so the jaw opens cleanly ----
  let A = { P, N, attr, col, part, morphs, I };
  A = splitMouth(m, F, A, jawW, pivY, pivZ, cj, sj, jawSlide);
  // ---- UVs with the seam split at the back ----
  A = uvSplit(A);
  const t4 = performance.now();
  // morph normals (relative)
  const morphNormals = {};
  const tmp = new Float32Array(A.P.length);
  for (const k of Object.keys(A.morphs)) {
    const D = A.morphs[k];
    let any = false;
    for (let i = 0; i < tmp.length; i++) { tmp[i] = A.P[i] + D[i]; if (D[i] !== 0) any = true; }
    if (!any) { morphNormals[k] = new Float32Array(tmp.length); continue; }
    const n2 = computeNormals(tmp, A.I);
    for (let i = 0; i < n2.length; i++) n2[i] -= A.N[i];
    morphNormals[k] = n2;
  }
  const t5 = performance.now();
  return {
    position: A.P, normal: A.N, uv: A.UV, attr: A.attr, color: A.col, part: A.part, index: A.I, morphs: A.morphs, morphNormals,
    stats: { tris: A.I.length / 3, verts: A.P.length / 3, evals: res.stats.evals, ms: { poly: t1 - t0, relax: t2 - t1, attr: t3 - t2, morph: t4 - t3, mnorm: t5 - t4, total: t5 - t0 } },
  };
}

// grow per-vertex arrays by duplicating vertices
function dupVerts(A, extra, edit) {
  const nv = A.P.length / 3, n2 = nv + extra.length;
  const grow = (a, k) => { const b = new a.constructor(n2 * k); b.set(a); for (let j = 0; j < extra.length; j++) for (let c = 0; c < k; c++) b[(nv + j) * k + c] = a[extra[j] * k + c]; return b; };
  const B = { P: grow(A.P, 3), N: grow(A.N, 3), attr: grow(A.attr, 2), col: grow(A.col, 3), part: grow(A.part, 1), I: A.I, morphs: {} };
  if (A.UV) B.UV = grow(A.UV, 2);
  for (const k of Object.keys(A.morphs)) B.morphs[k] = grow(A.morphs[k], 3);
  if (edit) extra.forEach((v, j) => edit(B, nv + j, v, j));
  return B;
}

// detach triangles that bridge the upper and lower lip by duplicating vertices on the minority side
function splitMouth(m, F, A, jawW, pivY, pivZ, cj, sj, slide) {
  const { P, I } = A, nv = P.length / 3;
  const side = new Int8Array(nv);  // 1 = lower (moves), 0 = upper, -1 = outside the lip zone
  const hw = m.mouthHW;
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (abs(x - m.asym.mouthDx) > hw * 0.97 || z < m.lipZ - 0.016 || abs(y - m.stoY) > 0.012) { side[i] = -1; continue; }
    side[i] = y < F.stomion(x) ? 1 : 0;
  }
  const extra = [], dup = new Map(), I2 = I.slice();
  for (let t = 0; t < I.length; t += 3) {
    const sa = side[I[t]], sb = side[I[t + 1]], sc = side[I[t + 2]];
    if (sa < 0 || sb < 0 || sc < 0) continue;
    const ones = sa + sb + sc;
    if (ones === 0 || ones === 3) continue;
    const keep = ones >= 2 ? 1 : 0;
    for (let k = 0; k < 3; k++) {
      const v = I[t + k];
      if (side[v] === keep) continue;
      const key = v * 2 + keep;
      let d = dup.get(key);
      if (d === undefined) { d = nv + extra.length; extra.push(v); dup.set(key, d); }
      I2[t + k] = d;
    }
  }
  const keepOf = new Int8Array(extra.length);
  for (const [key, d] of dup) keepOf[d - nv] = key & 1;
  const B = dupVerts({ ...A, I: I2 }, extra, (B, d, v, j) => {
    const jw = B.morphs.jaw;
    if (keepOf[j] === 0) { jw[d * 3] = 0; jw[d * 3 + 1] = 0; jw[d * 3 + 2] = 0; }
    else {
      const y = P[v * 3 + 1], z = P[v * 3 + 2], ry = y - pivY, rz = z - pivZ;
      jw[d * 3] = 0; jw[d * 3 + 1] = pivY + cj * ry - sj * rz - y; jw[d * 3 + 2] = pivZ + sj * ry + cj * rz + slide - z;
    }
  });
  // vertices of the upper lip never move with the jaw; the lower lip moves fully
  const jw = B.morphs.jaw;
  for (let i = 0; i < nv; i++) {
    if (side[i] === 0) { jw[i * 3] = 0; jw[i * 3 + 1] = 0; jw[i * 3 + 2] = 0; }
    else if (side[i] === 1 && jawW[i] < 0.999) {
      const y = P[i * 3 + 1], z = P[i * 3 + 2], ry = y - pivY, rz = z - pivZ;
      jw[i * 3 + 1] = pivY + cj * ry - sj * rz - y; jw[i * 3 + 2] = pivZ + sj * ry + cj * rz + slide - z;
    }
  }
  B.I = I2;
  return B;
}

function uvSplit(A) {
  const { P, I } = A, nv = P.length / 3;
  const UV = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) { const [u, v] = uvOf(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); UV[i * 2] = u; UV[i * 2 + 1] = v; }
  const extra = [], dup = new Map(), I2 = I.slice();
  for (let t = 0; t < I.length; t += 3) {
    const ua = UV[I[t] * 2], ub = UV[I[t + 1] * 2], uc = UV[I[t + 2] * 2];
    if (max(ua, ub, uc) - min(ua, ub, uc) < 0.5) continue;
    for (let k = 0; k < 3; k++) {
      const v = I[t + k];
      if (UV[v * 2] >= 0.5) continue;
      let d = dup.get(v);
      if (d === undefined) { d = nv + extra.length; extra.push(v); dup.set(v, d); }
      I2[t + k] = d;
    }
  }
  const B = dupVerts({ ...A, UV, I: I2 }, extra, (B, d) => { B.UV[d * 2] += 1; });
  B.I = I2;
  return B;
}
