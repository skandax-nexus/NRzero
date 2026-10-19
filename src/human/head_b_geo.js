// AFTERZERO head_b: builds the skin mesh from the anatomical SDF.
// Adaptive dual contouring -> tangential relaxation (re-projected onto the field) -> normals ->
// per-vertex SDF ambient occlusion and thickness -> procedural UVs (front-weighted cylindrical /
// elevation mapping, seam split at the back) -> morph targets (blink half/full, jaw open, smile)
// computed as anatomical deformations of the same vertices. Pure JS, no three.js.

import { sdf, lidCurves, lipOutline, clamp, smoothstep, mix, gauss } from './head_b_sdf.js';

import { polygonize, computeNormals, relax, compact, adjacency } from './head_b_mesh.js';

const { sqrt, abs, atan2, sin, cos, PI, max, min, sign } = Math;

// ---- cell size (canonical metres) ----
// The octree root is 0.36 m * S at depth 9, so leaf sizes are 0.70, 1.41, 2.81, 5.6, 11.2 mm (* S).
// sizeFn returns the largest allowed leaf size; values are chosen just above those steps.
const C1 = 0.00072, C2 = 0.00143, C3 = 0.00285, C4 = 0.0057, C5 = 0.0114;
function sizeFn(m, detail) {
  const S = m.S;
  const hi = detail === 'high', med = detail === 'medium';
  const mouthHW = m.mouthHW;
  const sEye = hi ? C1 : med ? C2 : C4, sLip = hi ? C1 : med ? C3 : C4, sNose = hi ? C2 : med ? C3 : C4, sEar = hi ? C2 : med ? C3 : C5;
  const sFace = hi ? C3 : med ? C4 : C4, sRest = hi ? C4 : C5;
  const low = detail === 'low';
  return (X, Y, Z) => {
    const x = X / S, y = Y / S, z = Z / S, ax = abs(x);
    // eyelid margins and fissure
    const ex = ax - m.eyeX, ey = y - m.eyeY, ez = z - m.eyeZ;
    const er = ex * ex + ey * ey + ez * ez;
    if (er < 0.0152 * 0.0152 && er > 0.0109 * 0.0109 && ez > 0.0) {
      const h = sqrt(ex * ex + ez * ez), az = atan2(ex, ez), el = atan2(ey, h);
      const lc = lidCurves(m, az);
      if (lc.t > -0.12 && lc.t < 1.12 && (abs(el - lc.up) < 0.2 || abs(el - lc.lo) < 0.17)) return sEye;
      return sNose;
    }
    if (er < 0.019 * 0.019 && ez > -0.004) return min(sNose, sFace);
    // lips and mouth slit
    if (ax < mouthHW + 0.003 && y > m.mouthY - 0.013 && y < m.mouthY + 0.011 && z > 0.086) {
      const L = lipOutline(m, ax);
      return abs(y - L.ys) < 0.0019 && z > 0.091 ? sLip : z > 0.093 ? sNose : sFace;
    }
    // nose
    if (ax < 0.017 && y > 0.026 && y < 0.098 && z > 0.084 && (y < 0.056 || ax < 0.0045)) return sNose;
    // ears
    const ux = ax - m.earX, uy = y - m.earY, uz = z - m.earZ;
    if (ux > 0.003 && ux * ux + uy * uy * 0.4 + uz * uz < 0.024 * 0.024) return sEar;
    // face
    if (low) return z > 0.055 && ax < 0.05 && y > -0.05 && y < 0.12 ? C4 : C5;
    if (z > 0.03 && ax < 0.068 && y > -0.058 && y < 0.14) return sFace;
    if (z < -0.02 || y > 0.15) return hi ? C5 : sRest;
    return sRest;
  };
}

const LEVEL = { high: { depth: 9 }, medium: { depth: 8 }, low: { depth: 6 } };

// ---- UV mapping (canonical coords): front-weighted azimuth, elevation about a mid-head point ----
const UZA = -0.005, VYC = 0.045;
function warp(t, a) { const s = t < 0 ? -1 : 1; t = abs(t); return s * (a * t - (a - 1) * t * t); }
export function uvOf(x, y, z) {
  const dz = z - UZA, rho = sqrt(x * x + dz * dz);
  const u = 0.5 + 0.5 * warp(atan2(x, dz) / PI, 1.65);
  const v = 0.5 + 0.5 * warp(atan2(y - VYC, rho) / (PI / 2), 1.35);
  return [u, v];
}

// eye-local spherical coordinates for a point (canonical), mirrored for the right eye
function eyeLocal(m, x, y, z) {
  const ax = abs(x);
  const lx = ax - m.eyeX, ly = y - (m.eyeY + (x > 0 ? m.eyeDy : -m.eyeDy)), lz = z - m.eyeZ;
  const r = sqrt(lx * lx + ly * ly + lz * lz);
  const h = sqrt(lx * lx + lz * lz);
  return { r, az: atan2(lx, lz), el: atan2(ly, h), lx, ly, lz };
}

/** lid closure: returns elevation delta for a vertex (canonical) for full blink */
function lidDelta(m, x, y, z) {
  const e = eyeLocal(m, x, y, z);
  if (e.r > 0.024 || e.lz < -0.008) return null;
  const lc = lidCurves(m, e.az);
  if (lc.t <= -0.08 || lc.t >= 1.08) return null;
  const up = lc.up, lo = lc.lo, span = up - lo;
  if (span < 1e-4) return null;
  const meet = lo + 0.3 * span;
  const mid = (up + lo) * 0.5;
  let d = 0;
  const radial = smoothstep(0.024, 0.017, e.r);
  if (e.el >= mid) {
    // upper lid: rigid tarsal part up to the crease, stretching fold above, fixed brow
    const crease = up + 0.42 + 0.05 * m.hood;
    const w = e.el <= crease ? 1 : smoothstep(crease + 0.45, crease, e.el);
    d = (meet - up) * w;
  } else {
    const w = smoothstep(lo - 0.42, lo - 0.04, e.el);
    d = (meet - lo) * w;
  }
  return { e, d: d * radial };
}

function rotEl(m, x, y, z, e, el2, dr) {
  const ax = abs(x), s = x >= 0 ? 1 : -1;
  const r = e.r + dr;
  const cy = m.eyeY + (x > 0 ? m.eyeDy : -m.eyeDy);
  const nx = m.eyeX + r * cos(el2) * sin(e.az), ny = cy + r * sin(el2), nz = m.eyeZ + r * cos(el2) * cos(e.az);
  return [s * nx, ny, nz, ax];
}

// cornea protrusion beyond the eyeball sphere in a direction (az, el) for a forward gaze
function corneaBulge(az, el) {
  const c = cos(az) * cos(el);
  const ang = Math.acos(clamp(c, -1, 1));
  return 0.0016 * smoothstep(0.62, 0.0, ang) * (0.6 + 0.4 * smoothstep(0.5, 0.0, ang));
}

/** jaw-open weight for a canonical point */
export function jawWeight(m, x, y, z) {
  const ax = abs(x);
  const L = lipOutline(m, min(ax, m.mouthHW));
  const hw = m.mouthHW;
  // dividing line: mouth slit, then from the corner down/back toward the jaw angle
  let yl = L.ys;
  if (ax > hw) yl = L.ys - (ax - hw) * 0.55 - max(0, ax - hw - 0.012) * 0.6;
  const band = 0.0007 + max(0, ax - hw) * 0.55 + max(0, 0.07 - z) * 0.15;
  let w = smoothstep(yl + band, yl - band, y);
  // fade toward the TMJ (back of the jaw) and the neck
  w *= smoothstep(-0.025, 0.02, z) * 0.6 + 0.4 * smoothstep(-0.01, 0.03, z);
  w *= smoothstep(-0.085, -0.04, y);
  return w;
}

/** smile displacement (canonical) */
function smileDisp(m, x, y, z) {
  const ax = abs(x), s = x >= 0 ? 1 : -1;
  const hw = m.mouthHW;
  const L = lipOutline(m, min(ax, hw));
  let dx = 0, dy = 0, dz = 0;
  // mouth corners: up, out, back
  const cw = gauss(ax - hw, 0.012) * gauss(y - L.ys, 0.012) * smoothstep(0.05, 0.08, z);
  dy += 0.0032 * cw; dx += 0.0022 * cw; dz -= 0.0016 * cw;
  // lips stretch laterally (more near corners), upper lip lifts a bit
  const lw = smoothstep(0.0, hw, ax) * gauss(y - L.ys, 0.01) * smoothstep(0.07, 0.09, z);
  dx += 0.0012 * lw * (ax < hw ? ax / hw : 1);
  dy += 0.0006 * gauss(y - (L.ys + 0.006), 0.006) * gauss(ax, hw);
  // cheeks raise and bulge
  const ck = gauss(ax - 0.036, 0.016) * gauss(y - 0.04, 0.018) * smoothstep(0.03, 0.07, z);
  dy += 0.0022 * ck; dz += 0.0012 * ck;
  // lower lid squint
  const e = eyeLocal(m, x, y, z);
  if (e.r < 0.025 && e.lz > -0.006) {
    const lc = lidCurves(m, e.az);
    if (lc.t > 0 && lc.t < 1 && e.el < (lc.up + lc.lo) * 0.5) {
      const w = smoothstep(lc.lo - 0.5, lc.lo - 0.05, e.el) * smoothstep(0.025, 0.016, e.r);
      dy += 0.0011 * w; dz += 0.0003 * w;
    }
  }
  return [dx * s, dy, dz];
}

/**
 * Build the skin mesh for a model.
 * @returns {{position:Float32Array, normal:Float32Array, uv:Float32Array, attr:Float32Array, index:Uint32Array, morphs:Object}}
 */
export function buildSkin(m, detail = 'high') {
  const t0 = performance.now();
  const S = m.S;
  const f = (x, y, z) => sdf(m, x, y, z);
  const L = LEVEL[detail] || LEVEL.high;
  const r = polygonize(f, { min: [-0.18 * S, -0.125 * S, -0.17 * S], size: 0.36 * S, depth: L.depth, sizeFn: sizeFn(m, detail), lip: 1.25 });
  const t1 = performance.now();
  let I0 = r.indices;
  {
    // drop the flat cap that closes the neck stub (hidden inside the body)
    const Pp = r.positions, yCut = (-0.095 + 0.0035) * S, keep = [];
    for (let t = 0; t < I0.length; t += 3) {
      const a = I0[t], b = I0[t + 1], c = I0[t + 2];
      if (Pp[a * 3 + 1] < yCut && Pp[b * 3 + 1] < yCut && Pp[c * 3 + 1] < yCut) continue;
      keep.push(a, b, c);
    }
    I0 = new Uint32Array(keep);
  }
  let { positions: P, indices: I } = compact(r.positions, I0);
  relax(P, I, 2, 0.5, f);
  let N = computeNormals(P, I);
  const t2 = performance.now();
  const nv = P.length / 3;
  // ---- per-vertex SDF ambient occlusion and thinness ----
  const attr = new Float32Array(nv * 2);
  const hs = [0.0015, 0.004, 0.009, 0.016];
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    let occ = 0, wsum = 0, w = 1;
    for (const h0 of hs) {
      const h = h0 * S;
      const d = f(x + nx * h, y + ny * h, z + nz * h);
      occ += w * clamp((h - d) / h, 0, 1); wsum += w; w *= 0.75;
    }
    const ao = clamp(1 - occ / wsum * 1.1, 0, 1);
    const hin = 0.005 * S;
    const din = f(x - nx * hin, y - ny * hin, z - nz * hin);
    const thin = clamp(1 + din / hin, 0, 1); // 0 = solid (din = -h), 1 = paper thin
    attr[i * 2] = ao; attr[i * 2 + 1] = thin;
  }
  const t3 = performance.now();
  // ---- morph targets (relative deltas) ----
  const morphs = { blinkA: new Float32Array(nv * 3), blinkB: new Float32Array(nv * 3), jaw: new Float32Array(nv * 3), smile: new Float32Array(nv * 3) };
  const jawAng = 0.26, jawSlide = 0.0025;
  const pivY = 0.058, pivZ = 0.004;
  const cj = cos(jawAng), sj = sin(jawAng);
  for (let i = 0; i < nv; i++) {
    const X = P[i * 3], Y = P[i * 3 + 1], Z = P[i * 3 + 2];
    const x = X / S, y = Y / S, z = Z / S;
    // blink
    const ld = lidDelta(m, x, y, z);
    if (ld && abs(ld.d) > 1e-6) {
      const e = ld.e;
      const bulgeB = e.el >= (lidCurves(m, e.az).up + lidCurves(m, e.az).lo) * 0.5 ? corneaBulge(e.az, e.el + ld.d) : corneaBulge(e.az, e.el + ld.d) * 0.6;
      const bulgeA = e.el >= 0 ? corneaBulge(e.az, e.el + ld.d * 0.5) : corneaBulge(e.az, e.el + ld.d * 0.5) * 0.6;
      const wB = smoothstep(0, 0.12, abs(ld.d));
      const pa = rotEl(m, x, y, z, e, e.el + ld.d * 0.5, bulgeA * wB);
      const pb = rotEl(m, x, y, z, e, e.el + ld.d, bulgeB * wB);
      morphs.blinkA[i * 3] = (pa[0] - x) * S; morphs.blinkA[i * 3 + 1] = (pa[1] - y) * S; morphs.blinkA[i * 3 + 2] = (pa[2] - z) * S;
      morphs.blinkB[i * 3] = (pb[0] - x) * S; morphs.blinkB[i * 3 + 1] = (pb[1] - y) * S; morphs.blinkB[i * 3 + 2] = (pb[2] - z) * S;
    }
    // jaw open: rotate about the TMJ axis (x) with a slight forward glide
    const w = jawWeight(m, x, y, z);
    if (w > 1e-4) {
      const ry = y - pivY, rz = z - pivZ;
      const ny = pivY + cj * ry - sj * rz, nz = pivZ + sj * ry + cj * rz + jawSlide;
      morphs.jaw[i * 3 + 1] = (ny - y) * w * S; morphs.jaw[i * 3 + 2] = (nz - z) * w * S;
    }
    // smile
    const sd = smileDisp(m, x, y, z);
    morphs.smile[i * 3] = sd[0] * S; morphs.smile[i * 3 + 1] = sd[1] * S; morphs.smile[i * 3 + 2] = sd[2] * S;
  }
  // split lips: triangles straddling the mouth slit are detached so the jaw opens cleanly
  ({ P, I, N } = splitMouth(m, P, I, N, attr, morphs));
  const nv2 = P.length / 3;
  // ---- UVs with seam split at the back ----
  const res = uvSplit(m, P, I, N, attr, morphs);
  const t4 = performance.now();
  // morph normals
  const morphN = {};
  const tmp = new Float32Array(res.P.length);
  for (const k of Object.keys(res.morphs)) {
    const D = res.morphs[k];
    for (let i = 0; i < tmp.length; i++) tmp[i] = res.P[i] + D[i];
    const n2 = computeNormals(tmp, res.I);
    for (let i = 0; i < n2.length; i++) n2[i] -= res.N[i];
    morphN[k] = n2;
  }
  const t5 = performance.now();
  return {
    position: res.P, normal: res.N, uv: res.UV, attr: res.A, index: res.I, morphs: res.morphs, morphNormals: morphN,
    stats: { tris: res.I.length / 3, verts: res.P.length / 3, nvPre: nv2, ms: { poly: t1 - t0, relax: t2 - t1, ao: t3 - t2, morph: t4 - t3, mnorm: t5 - t4, total: t5 - t0 }, evals: r.stats.evals },
  };
}

// detach triangles that bridge the upper and lower lip (by jaw weight) by duplicating vertices
function splitMouth(m, P, I, N, attr, morphs) {
  const S = m.S, nv = P.length / 3;
  const side = new Int8Array(nv); // 1 = moves with jaw, 0 = static, -1 = not in mouth zone
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3] / S, y = P[i * 3 + 1] / S, z = P[i * 3 + 2] / S;
    const ax = abs(x);
    if (ax > m.mouthHW * 0.98 || z < 0.06 || abs(y - m.mouthY) > 0.012) { side[i] = -1; continue; }
    const L = lipOutline(m, ax);
    side[i] = y < L.ys ? 1 : 0;
  }
  const extra = [];
  const dupMap = new Map();
  const I2 = I.slice();
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const sa = side[a], sb = side[b], sc = side[c];
    if (sa < 0 || sb < 0 || sc < 0) continue;
    const ones = sa + sb + sc;
    if (ones === 0 || ones === 3) continue;
    const keep = ones >= 2 ? 1 : 0; // majority side
    for (let k = 0; k < 3; k++) {
      const v = I[t + k];
      if (side[v] === keep) continue;
      let d = dupMap.get(v * 2 + keep);
      if (d === undefined) { d = nv + extra.length; extra.push([v, keep]); dupMap.set(v * 2 + keep, d); }
      I2[t + k] = d;
    }
  }
  if (!extra.length) return { P, I, N };
  const n2 = nv + extra.length;
  const P2 = new Float32Array(n2 * 3); P2.set(P);
  const N2 = new Float32Array(n2 * 3); N2.set(N);
  const A2 = new Float32Array(n2 * 2); A2.set(attr);
  const M2 = {};
  for (const k of Object.keys(morphs)) { M2[k] = new Float32Array(n2 * 3); M2[k].set(morphs[k]); }
  extra.forEach(([v, keep], j) => {
    const d = nv + j;
    for (let c = 0; c < 3; c++) { P2[d * 3 + c] = P[v * 3 + c]; N2[d * 3 + c] = N[v * 3 + c]; }
    A2[d * 2] = attr[v * 2]; A2[d * 2 + 1] = attr[v * 2 + 1];
    for (const k of Object.keys(morphs)) for (let c = 0; c < 3; c++) M2[k][d * 3 + c] = morphs[k][v * 3 + c];
    // jaw motion follows the side of the triangle it now belongs to
    const jw = M2.jaw;
    if (keep === 0) { jw[d * 3] = 0; jw[d * 3 + 1] = 0; jw[d * 3 + 2] = 0; }
    else {
      // copy the motion of a fully lower-lip point at this location
      const x = P[v * 3] / S, y = P[v * 3 + 1] / S, z = P[v * 3 + 2] / S;
      const pivY = 0.058, pivZ = 0.004, a = 0.26, cj = cos(a), sj = sin(a);
      const ry = y - pivY, rz = z - pivZ;
      jw[d * 3] = 0; jw[d * 3 + 1] = (pivY + cj * ry - sj * rz - y) * S; jw[d * 3 + 2] = (pivZ + sj * ry + cj * rz + 0.0025 - z) * S;
    }
  });
  // fix jaw motion of original vertices whose side is "static" but weight > 0 (and vice versa) near the slit
  for (let i = 0; i < nv; i++) {
    if (side[i] < 0) continue;
    const jw = M2.jaw;
    if (side[i] === 0) { jw[i * 3] = 0; jw[i * 3 + 1] = 0; jw[i * 3 + 2] = 0; }
  }
  // copy into the shared attr array reference
  attr.__replaced = A2;
  for (const k of Object.keys(morphs)) morphs[k] = M2[k];
  return { P: P2, I: I2, N: N2 };
}

function uvSplit(m, P, I, N, attr0, morphs) {
  const S = m.S;
  const attr = attr0.__replaced || attr0;
  const nv = P.length / 3;
  const UV = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) {
    const [u, v] = uvOf(P[i * 3] / S, P[i * 3 + 1] / S, P[i * 3 + 2] / S);
    UV[i * 2] = u; UV[i * 2 + 1] = v;
  }
  const extra = [];
  const dup = new Map();
  const I2 = I.slice();
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ua = UV[a * 2], ub = UV[b * 2], uc = UV[c * 2];
    const mx = max(ua, ub, uc), mn = min(ua, ub, uc);
    if (mx - mn < 0.5) continue;
    for (let k = 0; k < 3; k++) {
      const v = I[t + k];
      if (UV[v * 2] >= 0.5) continue;
      let d = dup.get(v);
      if (d === undefined) { d = nv + extra.length; extra.push(v); dup.set(v, d); }
      I2[t + k] = d;
    }
  }
  const n2 = nv + extra.length;
  const P2 = new Float32Array(n2 * 3), N2 = new Float32Array(n2 * 3), UV2 = new Float32Array(n2 * 2), A2 = new Float32Array(n2 * 2);
  P2.set(P); N2.set(N); UV2.set(UV); A2.set(attr);
  const M2 = {};
  for (const k of Object.keys(morphs)) { M2[k] = new Float32Array(n2 * 3); M2[k].set(morphs[k]); }
  extra.forEach((v, j) => {
    const d = nv + j;
    for (let c = 0; c < 3; c++) { P2[d * 3 + c] = P[v * 3 + c]; N2[d * 3 + c] = N[v * 3 + c]; }
    UV2[d * 2] = UV[v * 2] + 1; UV2[d * 2 + 1] = UV[v * 2 + 1];
    A2[d * 2] = attr[v * 2]; A2[d * 2 + 1] = attr[v * 2 + 1];
    for (const k of Object.keys(morphs)) for (let c = 0; c < 3; c++) M2[k][d * 3 + c] = morphs[k][v * 3 + c];
  });
  return { P: P2, I: I2, N: N2, UV: UV2, A: A2, morphs: M2 };
}

export { adjacency };
