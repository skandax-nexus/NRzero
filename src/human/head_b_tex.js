// AFTERZERO head_b: procedural skin textures baked in UV space.
// The skin mesh is rasterised into a UV-space geometry buffer (canonical position, normal, AO);
// anatomical region masks are evaluated from those 3D positions at quarter resolution, then a
// full-resolution pass adds high-frequency detail (pores, fine lines, freckles, moles, stubble,
// painted brow hairs, scar) from cached tileable noise tiles. An optional portrait layer (likeness,
// see head_b_like.js) is blended into the albedo. Outputs RGBA8 arrays for albedo (sRGB), a
// tangent-space normal map (from a height field) and roughness. All our own code.

import { lidAt, clamp, smoothstep, mix, gauss, mulberry32 } from './head_b_sdf.js';

const { sqrt, abs, floor, min, max, sin, cos, atan2, pow } = Math;

// ---------------------------------------------------------------------------------------------
// cached tileable noise tiles (built once per session)
const T = 256, TM = T - 1;
let TILES = null;
function hash2(ix, iy, s) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function buildTiles() {
  // value noise (period 32 lattice cells over the tile), a cellular pore tile, a line tile
  const vn = new Float32Array(T * T), pore = new Float32Array(T * T), cellD = new Float32Array(T * T);
  const P = 32;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const fx = x / T * P, fy = y / T * P, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy;
    const ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty);
    const w = (i, j) => hash2((i % P + P) % P, (j % P + P) % P, 7);
    const a = w(ix, iy), b = w(ix + 1, iy), c = w(ix, iy + 1), d = w(ix + 1, iy + 1);
    vn[y * T + x] = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  const C = 40; // pore cells per tile
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const u = x / T * C, v = y / T * C, ix = floor(u), iy = floor(v);
    let d1 = 9, d2 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j, wx = (cx % C + C) % C, wy = (cy % C + C) % C;
      const px = cx + 0.1 + 0.8 * hash2(wx, wy, 3), py = cy + 0.1 + 0.8 * hash2(wx, wy, 4);
      const dd = (u - px) * (u - px) + (v - py) * (v - py);
      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
    }
    const r = sqrt(d1);
    pore[y * T + x] = -max(0, 1 - r / 0.3) ** 2;               // pits
    cellD[y * T + x] = sqrt(d2) - r;                             // 0 on cell borders (skin micro-relief)
  }
  TILES = { vn, pore, cellD };
  return TILES;
}
function tl(A, x, y) { // bilinear wrap lookup, x,y in texels of the tile
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const x0 = ix & TM, y0 = iy & TM, x1 = (x0 + 1) & TM, y1 = (y0 + 1) & TM;
  const a = A[y0 * T + x0], b = A[y0 * T + x1], c = A[y1 * T + x0], d = A[y1 * T + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
// value noise with unit lattice spacing (one lattice cell = 8 tile texels)
function vn(x, y, s) { return tl(TILES.vn, x * 8 + s * 37.1, y * 8 + s * 21.7); }
function fbm(x, y, s, oct) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += a * vn(x * f, y * f, s + i * 3); n += a; f *= 2.07; a *= 0.5; } return v / n; }

export function hexToLin(hex) {
  const c = [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
  return c.map(v => v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4));
}
export function linToSrgb8(v) { v = v <= 0 ? 0 : v >= 1 ? 1 : v; return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255); }

// ---------------------------------------------------------------------------------------------
/** UV-space geometry buffer: canonical position, normal, AO per texel (u wraps at the seam) */
export function rasterGBuf(geo, R) {
  const P = geo.position, Nn = geo.normal, UV = geo.uv, A = geo.attr, I = geo.index;
  const pos = new Float32Array(R * R * 3), nor = new Float32Array(R * R * 3), ao = new Float32Array(R * R), cov = new Uint8Array(R * R);
  const dep = new Float32Array(R * R).fill(-1);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ax = UV[a * 2] * R, ay = UV[a * 2 + 1] * R, bx = UV[b * 2] * R, by = UV[b * 2 + 1] * R, cx = UV[c * 2] * R, cy = UV[c * 2 + 1] * R;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (abs(area) < 1e-9) continue;
    const x0 = max(floor(min(ax, bx, cx)), -R), x1 = min(Math.ceil(max(ax, bx, cx)), 2 * R), y0 = max(floor(min(ay, by, cy)), 0), y1 = min(Math.ceil(max(ay, by, cy)), R - 1);
    // the outermost surface (largest distance from the head centre) wins where UVs overlap
    for (let py = y0; py <= y1; py++) {
      const sy = py + 0.5;
      for (let px = x0; px <= x1; px++) {
        const sx = px + 0.5;
        const w0 = ((bx - sx) * (cy - sy) - (by - sy) * (cx - sx)) / area;
        const w1 = ((cx - sx) * (ay - sy) - (cy - sy) * (ax - sx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const k = py * R + (((px % R) + R) % R);
        const X = P[a * 3] * w0 + P[b * 3] * w1 + P[c * 3] * w2, Y = P[a * 3 + 1] * w0 + P[b * 3 + 1] * w1 + P[c * 3 + 1] * w2, Z = P[a * 3 + 2] * w0 + P[b * 3 + 2] * w1 + P[c * 3 + 2] * w2;
        const dd = X * X + (Y - 0.05) * (Y - 0.05) + (Z + 0.01) * (Z + 0.01);
        if (dd <= dep[k]) continue;
        dep[k] = dd;
        pos[k * 3] = X; pos[k * 3 + 1] = Y; pos[k * 3 + 2] = Z;
        for (let q = 0; q < 3; q++) nor[k * 3 + q] = Nn[a * 3 + q] * w0 + Nn[b * 3 + q] * w1 + Nn[c * 3 + q] * w2;
        ao[k] = A[a * 2] * w0 + A[b * 2] * w1 + A[c * 2] * w2;
        cov[k] = 1;
      }
    }
  }
  // dilate so bilinear/mip sampling never reads empty texels
  for (let it = 0; it < 4; it++) {
    const add = [];
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      const k = y * R + x; if (cov[k]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = (x + dx + R) % R, yy = y + dy; if (yy < 0 || yy >= R) continue;
        const kk = yy * R + xx; if (cov[kk] === 1) { add.push(k, kk); break; }
      }
    }
    for (let j = 0; j < add.length; j += 2) { const k = add[j], kk = add[j + 1]; for (let q = 0; q < 3; q++) { pos[k * 3 + q] = pos[kk * 3 + q]; nor[k * 3 + q] = nor[kk * 3 + q]; } ao[k] = ao[kk]; cov[k] = 2; }
    for (let j = 0; j < add.length; j += 2) cov[add[j]] = 1;
  }
  return { pos, nor, ao, cov, R };
}

// ---------------------------------------------------------------------------------------------
// anatomical regions (canonical coords)
const NCH = 18;
const RED = 0, YEL = 1, BLU = 2, LIP = 3, BEARD = 4, BROW = 5, ROUGH = 6, WFORE = 7, WCROW = 8, WNASO = 9, WEYE = 10, PORE = 11, SCAR = 12, DARK = 13, BROWS = 14, BROWT = 15, LIPU = 16, SCALP = 17;

function makeRegions(m, F, p) {
  const fem = m.fem, mal = m.mal, old = m.old, child = m.child;
  const E = F.E, hw = m.mouthHW;
  // eyebrow curve (canonical, left side): head near the nose root, peak at ~2/3, tail past the canthus
  const bx0 = E.x - 0.0175 + 0.0005 * fem, bx1 = E.x + 0.0235 - 0.002 * fem;
  const browBase = E.y + 0.0175 + 0.0012 * m.browHeight + 0.0012 * fem - 0.0014 * mal * max(0, m.brow) - 0.001 * old;
  const arch = 0.0016 + 0.0032 * fem + 0.0012 * m.browArch - 0.0012 * mal * max(0, m.brow);
  const peak = mix(0.68, 0.62, fem);
  const scarSide = -1;            // character right (-X), forehead -> brow -> cheek
  return function regions(x, y, z, out) {
    const ax = abs(x), sx = x >= 0 ? 1 : -1;
    const front = smoothstep(0.0, 0.05, z);
    // ---- blood / redness
    let red = 0.55 * gauss(ax - 0.042, 0.015) * gauss(y - (m.subY + 0.022), 0.016) * front;          // malar cheeks
    red += 0.6 * gauss(x, 0.011) * gauss(y - (m.tipY + 0.002), 0.01) * smoothstep(m.tipZ - 0.02, m.tipZ - 0.006, z); // nose tip
    red += 0.45 * gauss(ax - m.alarHW + 0.004, 0.005) * gauss(y - (m.subY + 0.006), 0.006) * front; // alae
    red += 0.28 * gauss(x, 0.014) * gauss(y - (m.pogY + 0.002), 0.011) * front;                      // chin
    red += 0.14 * gauss(x, 0.03) * gauss(y - (m.browY + 0.03), 0.02) * front;                        // forehead
    red += 0.18 * gauss(ax, 0.01) * gauss(y - (m.subY - 0.006), 0.006) * front;                     // upper lip
    const eu = F.ear.local(x, y, z);
    const earM = smoothstep(F.ear.H * 0.62, F.ear.H * 0.45, sqrt(eu[0] * eu[0] + eu[1] * eu[1] * 2.2)) * smoothstep(-0.012, -0.002, eu[2]);
    red += 0.75 * earM;
    // ---- periorbital
    const ex = ax - E.x, ey = y - (E.y + sx * m.asym.eyeDy), ez = z - E.z;
    const er = sqrt(ex * ex + ey * ey + ez * ez);
    let lid = 0, under = 0;
    if (er < 0.034 && ez > -0.012) {
      const al = atan2(ex, ez), be = atan2(ey, sqrt(ex * ex + ez * ez));
      const L = lidAt(m, al);
      const inS = smoothstep(-0.3, 0.05, L[2]) * smoothstep(1.35, 0.95, L[2]);
      const hu = (be - L[0]) * 12, hl = (L[1] - be) * 12;          // ~mm along the lid surface
      lid = gauss(hu - 3.2, 3.4) * inS * smoothstep(-0.6, 0.4, hu);
      under = gauss(hl - 4.2, 3.6) * inS * smoothstep(-0.6, 0.6, hl);
      red += 0.22 * lid + 0.25 * gauss(L[2] + 0.02, 0.07) * smoothstep(0.022, 0.014, er); // pink medial canthus
    }
    // ---- eyebrow (s along 0 head .. 1 tail, t across)
    let browM = 0, bs = 0, bt = 0;
    {
      const s = (ax - bx0) / (bx1 - bx0);
      if (s > -0.3 && s < 1.3 && abs(y - browBase) < 0.02 && z > 0.03) {
        const sc = clamp(s, 0, 1);
        const yc = browBase + sx * m.asym.browDy + arch * (sc < peak ? pow(sc / peak, 0.7) : 1 - pow((sc - peak) / (1 - peak), 1.4) * 1.25) - 0.0012 * (1 - sc) * mal;
        const thick = (mix(0.0062, 0.0042, fem) + 0.0012 * mal * max(0, m.brow) - 0.001 * child) * mix(1.05, 0.38, pow(sc, 1.3)) * (1 - 0.1 * old);
        const tt = (y - yc) / thick;
        const along = smoothstep(-0.08, 0.1, s) * smoothstep(1.06, 0.82, s);
        browM = clamp(1.1 - abs(tt + 0.05) * 1.05, 0, 1) * along;
        bs = s; bt = tt;
      }
    }
    // ---- lips
    const lip = F.lipMask(x, y) * smoothstep(m.lipZ - 0.012, m.lipZ - 0.005, z);
    const lipU = y > F.stomion(x) ? 1 : 0;
    // ---- beard zone (adult male): moustache, chin, jaw and neck below a cheek line, sideburns
    let beard = 0;
    if (mal > 0.05 && m.grown > 0.5) {
      const t = clamp((ax - (hw + 0.006)) / (0.066 - (hw + 0.006)), -0.6, 1.4);
      const lineY = mix(m.subY - 0.002, m.eyeY - 0.03, t) - 0.003 * m.cheek;
      const cheek = smoothstep(lineY + 0.004, lineY - 0.006, y);
      const sideburn = smoothstep(0.058, 0.066, ax) * smoothstep(m.eyeY + 0.006, m.eyeY - 0.006, y) * smoothstep(-0.02, -0.006, z) * smoothstep(0.026, 0.012, z);
      const neckLo = smoothstep(-0.085, -0.055, y) * (1 - 0.6 * smoothstep(-0.04, -0.08, y) * smoothstep(0.02, -0.02, z));
      const mustache = smoothstep(hw + 0.002, hw - 0.004, ax) * smoothstep(m.subY + 0.001, m.subY - 0.003, y) * smoothstep(F.stomion(x) + F.vermU(x) - 0.0004, F.stomion(x) + F.vermU(x) + 0.0015, y);
      beard = max(cheek * smoothstep(-0.03, -0.01, z) * neckLo, sideburn, mustache) * (1 - lip);
      beard *= 1 - 0.5 * smoothstep(lineY - 0.012, lineY, y);
      beard *= 1 - 0.55 * gauss(ax - hw * 0.75, 0.006) * gauss(y - (F.stomion(x) - F.vermL(x) - 0.006), 0.004); // bare patches under the lip
      beard = clamp(beard, 0, 1) * smoothstep(0.05, 0.6, mal);
    }
    // ---- scalp (above the hairline, back of the head)
    const hairline = m.hairY + 0.004 * sin(x * 60) - 0.012 * smoothstep(0.03, 0.06, ax);
    const scalp = max(smoothstep(hairline - 0.004, hairline + 0.01, y), smoothstep(-0.02, -0.05, z) * smoothstep(m.eyeY - 0.03, m.eyeY, y)) * (1 - earM);
    // ---- roughness
    const tzone = gauss(ax, 0.016) * smoothstep(m.subY, m.subY + 0.02, y) * smoothstep(m.sellY + 0.01, m.sellY - 0.01, y) * front
      + 0.75 * gauss(ax, 0.028) * gauss(y - (m.browY + 0.028), 0.022) * front + 0.4 * gauss(x, 0.012) * gauss(y - m.pogY, 0.01) * front;
    let rough = 0.52 - 0.14 * tzone + 0.06 * gauss(ax - 0.045, 0.02) * gauss(y - (m.subY + 0.01), 0.02);
    rough = mix(rough, 0.34, lip);
    rough = mix(rough, 0.38, lid * 0.7);
    rough = mix(rough, 0.6, scalp * 0.5);
    // ---- wrinkles
    const wf = smoothstep(m.browY + 0.008, m.browY + 0.017, y) * smoothstep(m.hairY + 0.004, m.hairY - 0.012, y) * smoothstep(0.066, 0.044, ax) * front;
    let crow = 0;
    {
      const lx = ax - (E.x + 0.0135), ly = y - (E.y + 0.001);
      crow = gauss(sqrt(lx * lx + ly * ly) - 0.007, 0.006) * smoothstep(-0.004, 0.004, lx) * smoothstep(0.02, 0.05, z);
    }
    let wn = 0;
    {
      const tN = clamp((m.subY + 0.006 - y) / (m.subY + 0.006 - (m.stoY - 0.008)), 0, 1);
      const fx = mix(m.alarHW + 0.003, hw + 0.006, pow(tN, 0.85)) + 0.0015 * tN * tN;
      wn = gauss(ax - fx, 0.0032) * smoothstep(-0.05, 0.1, tN) * smoothstep(1.1, 0.8, tN) * front;
    }
    // ---- pore strength: nose, cheeks, chin, forehead
    const pore = (0.35 + 0.6 * gauss(ax - 0.035, 0.02) * gauss(y - (m.subY + 0.018), 0.02)
      + 0.75 * gauss(ax, 0.012) * smoothstep(m.subY, m.subY + 0.02, y) * smoothstep(m.sellY, m.tipY, y) * smoothstep(m.tipZ - 0.025, m.tipZ - 0.01, z)
      + 0.3 * gauss(x, 0.015) * gauss(y - m.pogY, 0.012) + 0.25 * gauss(x, 0.03) * gauss(y - (m.browY + 0.03), 0.02)) * (1 - lip) * (1 - 0.8 * lid) * (1 - 0.6 * child);
    // ---- scar (character right side): forehead through the brow, skips the eye, onto the cheek
    let scar = 0;
    if (p.scar && x * scarSide > 0) {
      const qx = ax;
      const a0 = [E.x - 0.008, m.browY + 0.04], a1 = [E.x + 0.006, E.y - 0.03];
      const dx = a1[0] - a0[0], dy = a1[1] - a0[1];
      const tt = clamp(((qx - a0[0]) * dx + (y - a0[1]) * dy) / (dx * dx + dy * dy), 0, 1);
      const cx = a0[0] + dx * tt + 0.0014 * sin(tt * 13), cy = a0[1] + dy * tt;
      const dd = sqrt((qx - cx) * (qx - cx) + (y - cy) * (y - cy));
      const eyeGap = smoothstep(0.0135, 0.016, er);
      scar = clamp(1 - dd / mix(0.0018, 0.0011, tt), 0, 1) * smoothstep(0.0, 0.05, tt) * smoothstep(1.0, 0.85, tt) * eyeGap * front;
    }
    out[RED] = clamp(red, 0, 1.2);
    out[YEL] = 0.5 * gauss(ax, 0.035) * smoothstep(m.browY, m.browY + 0.03, y) * front;
    out[BLU] = under;
    out[LIP] = lip; out[LIPU] = lipU; out[BEARD] = beard; out[BROW] = browM; out[ROUGH] = rough;
    out[WFORE] = wf; out[WCROW] = crow; out[WNASO] = wn; out[WEYE] = under; out[PORE] = pore; out[SCAR] = scar;
    out[DARK] = 0.3 * under + 0.32 * lid; out[BROWS] = bs; out[BROWT] = bt; out[SCALP] = scalp;
  };
}

// ---------------------------------------------------------------------------------------------
/**
 * @param G        rasterGBuf output
 * @param m, F     model and field
 * @param p        { skin, seed, freckles, stubble, wrinkles, scar, browColor }
 * @param portrait optional { rgb: Float32Array (linear), w: Float32Array, R } likeness layer
 */
export function bakeSkin(G, m, F, p, portrait) {
  if (!TILES) buildTiles();
  const t0 = performance.now();
  const R = G.R;
  const Q = R >> 2;
  const regions = makeRegions(m, F, p);
  const reg = new Float32Array(Q * Q * NCH);
  const tmp = new Float32Array(NCH);
  for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) {
    const k = (y * 4 + 2) * R + (x * 4 + 2);
    if (!G.cov[k]) continue;
    regions(G.pos[k * 3], G.pos[k * 3 + 1], G.pos[k * 3 + 2], tmp);
    reg.set(tmp, (y * Q + x) * NCH);
  }
  const t1 = performance.now();
  // ---- base colours
  const base0 = hexToLin(p.skin ?? 0xc08a64);
  const lum0 = 0.2126 * base0[0] + 0.7152 * base0[1] + 0.0722 * base0[2];
  const base = base0.map(c => (lum0 + (c - lum0) * 0.9) * 0.92);
  const lum = 0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2];
  const darkSkin = smoothstep(0.22, 0.06, lum);
  const rnd = mulberry32((p.seed | 0) * 131 + 7);
  const seed = ((p.seed | 0) * 7 + 3) % 97;
  const albedo = new Uint8Array(R * R * 4);
  const height = new Float32Array(R * R);
  const RR = R >> 1;
  const rough = new Uint8Array(RR * RR * 4);
  const browCol = hexToLin(p.browColor ?? 0x1a120c);
  const stubCol = hexToLin(p.beardColor ?? p.browColor ?? 0x1a120c);
  // moles: a few seeded spots on the face (canonical x, y)
  const moles = [];
  const nm = 2 + floor(rnd() * 4);
  for (let i = 0; i < nm; i++) moles.push([(rnd() * 2 - 1) * 0.055, m.mentY + rnd() * (m.hairY - m.mentY), 0.0006 + rnd() * 0.001]);
  const freck = p.freckles ?? 0, stub = p.stubble ?? 0;
  const wrk = clamp((p.wrinkles ?? 0) * 0.9 + m.old * 0.45, 0, 1.25);
  const lipCol = [base[0] * mix(0.8, 0.62, darkSkin) * mix(1, 1.04, m.fem) + 0.01 * (1 - darkSkin), base[1] * mix(0.52, 0.58, darkSkin) * mix(1, 0.94, m.fem), base[2] * mix(0.56, 0.62, darkSkin)];
  const v = new Float32Array(NCH);
  const sc = R / 1024;
  const pr = portrait && portrait.R === R ? portrait : null;
  for (let y = 0; y < R; y++) {
    const fy = (y + 0.5) / 4 - 0.5;
    const y0 = clamp(floor(fy), 0, Q - 1), y1 = min(y0 + 1, Q - 1), ty = clamp(fy - y0, 0, 1);
    for (let x = 0; x < R; x++) {
      const k = y * R + x;
      if (!G.cov[k]) continue;
      const fx = (x + 0.5) / 4 - 0.5;
      const x0 = ((floor(fx) % Q) + Q) % Q, x1 = (x0 + 1) % Q, tx = fx - floor(fx);
      const o00 = (y0 * Q + x0) * NCH, o10 = (y0 * Q + x1) * NCH, o01 = (y1 * Q + x0) * NCH, o11 = (y1 * Q + x1) * NCH;
      for (let c = 0; c < NCH; c++) {
        const a = reg[o00 + c] + (reg[o10 + c] - reg[o00 + c]) * tx, b = reg[o01 + c] + (reg[o11 + c] - reg[o01 + c]) * tx;
        v[c] = a + (b - a) * ty;
      }
      const u = x / sc, w = y / sc;                                    // texel units at 1024
      const X = G.pos[k * 3] * 1000, Y = G.pos[k * 3 + 1] * 1000, Z = G.pos[k * 3 + 2] * 1000; // mm
      const nxa = abs(G.nor[k * 3]);
      // planar coordinates for position-space noise: front (X,Y) blended with side (Z,Y)
      const PX = nxa > 0.7 ? Z : X;
      // ---- colour
      let r = base[0], g = base[1], b = base[2];
      const mot = fbm(PX * 0.045 + 3, Y * 0.045, seed, 3) - 0.5, mot2 = vn(PX * 0.32, Y * 0.32, seed + 1) - 0.5;
      r *= 1 + 0.07 * mot + 0.03 * mot2; g *= 1 + 0.065 * mot + 0.035 * mot2; b *= 1 + 0.06 * mot + 0.035 * mot2;
      const cap = 0.65 + 0.7 * fbm(PX * 0.22, Y * 0.22 + 3, seed + 2, 2);
      const red = v[RED] * cap * (1 - 0.6 * darkSkin);
      r *= 1 + 0.16 * red; g *= 1 - 0.12 * red; b *= 1 - 0.08 * red;
      r *= 1 + 0.015 * v[YEL]; b *= 1 - 0.05 * v[YEL];
      r *= 1 - 0.12 * v[BLU]; g *= 1 - 0.11 * v[BLU]; b *= 1 - 0.02 * v[BLU];
      r *= 1 - 0.1 * v[DARK]; g *= 1 - 0.14 * v[DARK]; b *= 1 - 0.11 * v[DARK];
      // shaved beard shadow: a cool grey-green cast even without stubble (adult men)
      const bsh = v[BEARD] * (0.25 + 0.75 * stub) * mix(0.22, 0.1, darkSkin);
      r *= 1 - 0.3 * bsh; g *= 1 - 0.22 * bsh; b *= 1 - 0.1 * bsh;
      // scalp: paler and less red
      r *= 1 - 0.04 * v[SCALP]; g *= 1 + 0.01 * v[SCALP];
      // cavity tint: pigment collects in creases
      const ao = G.ao[k];
      const cav = clamp((0.85 - ao) * 1.4, 0, 0.5);
      r *= 1 - 0.18 * cav; g *= 1 - 0.24 * cav; b *= 1 - 0.22 * cav;
      // lips
      if (v[LIP] > 0.001) {
        const ln = 0.92 + 0.16 * fbm(X * 0.4, Y * 0.12, seed + 9, 2);
        const lu = v[LIPU] ? 0.92 : 1.0;
        r = mix(r, lipCol[0] * ln * lu, v[LIP]); g = mix(g, lipCol[1] * ln * lu, v[LIP]); b = mix(b, lipCol[2] * ln * lu, v[LIP]);
      }
      // freckles
      if (freck > 0) {
        const fm = smoothstep(0.62, 0.8, vn(X * 0.9, Y * 0.9 + PX * 0.01, seed + 3)) * smoothstep(0.25, 0.7, vn(PX * 0.07, Y * 0.07, seed + 4));
        const fr = fm * freck * (0.3 + v[RED] + 0.7 * v[PORE]) * (1 - v[LIP]);
        r *= 1 - 0.16 * fr; g *= 1 - 0.27 * fr; b *= 1 - 0.34 * fr;
      }
      const fn = vn(u * 0.35, w * 0.35, seed + 5) - 0.5;
      r *= 1 + 0.03 * fn; g *= 1 + 0.034 * fn; b *= 1 + 0.038 * fn;
      let hgt = 0;
      // stubble: fine dark hair stubs
      if (v[BEARD] > 0.01 && stub > 0) {
        const den = v[BEARD] * stub * (0.8 + 0.4 * vn(X * 0.1, Y * 0.1, seed + 12));
        const tint = clamp(den, 0, 1) * mix(0.42, 0.2, darkSkin);
        r *= 1 - 0.3 * tint; g *= 1 - 0.27 * tint; b *= 1 - 0.2 * tint;
        const c = tl(TILES.pore, u * 0.55 + 13, w * 0.55 + 7);    // pits double as follicles
        const dot = smoothstep(-0.2, -0.75, c) * clamp(den * 1.25, 0, 1);
        const a = dot * mix(0.7, 0.92, stub);
        r = mix(r, stubCol[0], a); g = mix(g, stubCol[1], a); b = mix(b, stubCol[2], a);
        hgt += 0.25 * dot;
      }
      // painted brow hairs along their growth direction
      if (v[BROW] > 0.01) {
        const s = v[BROWS], t = v[BROWT];
        const ang = mix(1.25, 0.12, clamp(s * 1.6, 0, 1)) + 0.3 * t;
        const ca = cos(ang), sa = sin(ang);
        const hu = (abs(X) * ca + Y * sa), hv = (-abs(X) * sa + Y * ca);
        const strand = vn(hu * 0.3, hv * 3.2, seed + 21) * 0.6 + vn(hu * 0.5, hv * 5.5, seed + 22) * 0.4;
        const dens = v[BROW] * (0.85 + 0.3 * vn(X * 0.4, Y * 0.4, seed + 23));
        const hair = smoothstep(0.48, 0.72, strand) * smoothstep(0.05, 0.45, dens);
        const fill = smoothstep(0.1, 1.0, dens) * 0.5;
        const a = clamp(max(hair * 0.92, fill), 0, 0.95);
        r = mix(r, browCol[0], a); g = mix(g, browCol[1], a); b = mix(b, browCol[2], a);
        hgt += 0.3 * hair;
      }
      for (const [mx, my, mr] of moles) {
        if (Z < 20) continue;
        const dd = sqrt((X / 1000 - mx) ** 2 + (Y / 1000 - my) ** 2) / mr;
        if (dd < 1.5) { const a = smoothstep(1.2, 0.4, dd) * 0.6; r *= 1 - 0.38 * a; g *= 1 - 0.48 * a; b *= 1 - 0.48 * a; hgt += 0.3 * a; }
      }
      if (v[SCAR] > 0.01) {
        const s2 = v[SCAR];
        r = mix(r, r * 1.12 + 0.015, s2 * 0.7); g = mix(g, g * 0.86, s2 * 0.6); b = mix(b, b * 0.9, s2 * 0.5);
        hgt -= 1.0 * s2;
      }
      // likeness layer: the owner's portrait projected onto the face (already de-lit, linear)
      if (pr && pr.w[k] > 0.001) {
        const a = pr.w[k];
        r = mix(r, pr.rgb[k * 3], a); g = mix(g, pr.rgb[k * 3 + 1], a); b = mix(b, pr.rgb[k * 3 + 2], a);
      }
      const o = k * 4;
      albedo[o] = linToSrgb8(r); albedo[o + 1] = linToSrgb8(g); albedo[o + 2] = linToSrgb8(b); albedo[o + 3] = 255;
      // ---- height: pores, micro relief, wrinkles
      const pore = tl(TILES.pore, u * 0.9, w * 0.9) * 0.3 * v[PORE];
      const micro = tl(TILES.cellD, u * 0.6 + 50, w * 0.6 + 20);
      hgt += pore + (smoothstep(0.0, 0.25, micro) - 0.5) * 0.07 * (0.5 + v[PORE]) * (1 - 0.7 * v[LIP]);
      hgt += (vn(u * 0.3, w * 0.3, seed + 32) - 0.5) * 0.06;
      if (v[LIP] > 0.01) hgt += (vn(abs(X) * 1.5, Y * 0.22, seed + 34) - 0.5) * 0.8 * v[LIP];
      if (wrk > 0.01) {
        const fl = sin(Y * 0.7 + 0.9 * sin(abs(X) * 0.08 + 1.3) + 2.2 * fbm(X * 0.04, Y * 0.03, seed + 40, 2)) * 0.5 + 0.5;
        hgt -= v[WFORE] * wrk * smoothstep(0.8, 1.0, fl) * 1.6;
        const cx = abs(X) - (m.eyeX * 1000 + 14), cy = Y - m.eyeY * 1000;
        const cl = sin(atan2(cy, cx) * 24 + 2.5 * vn(X * 0.12, Y * 0.12, seed + 41)) * 0.5 + 0.5;
        hgt -= v[WCROW] * wrk * smoothstep(0.74, 1.0, cl) * 1.3;
        const ul = sin(Y * 2.0 + abs(X) * 0.3 + 2 * vn(X * 0.18, Y * 0.18, seed + 42)) * 0.5 + 0.5;
        hgt -= v[WEYE] * wrk * smoothstep(0.8, 1.0, ul) * 0.9;
        hgt -= v[WNASO] * wrk * 1.1;
      }
      height[k] = hgt;
      if ((x & 1) === 0 && (y & 1) === 0) {
        const ko = ((y >> 1) * RR + (x >> 1)) * 4;
        const rr = clamp(v[ROUGH] + 0.08 * (vn(u * 0.12, w * 0.12, seed + 50) - 0.5) - 0.08 * v[SCAR] + 0.06 * v[BEARD] * stub, 0.2, 0.92);
        rough[ko] = 255; rough[ko + 1] = Math.round(rr * 255); rough[ko + 2] = 0; rough[ko + 3] = 255;
      }
    }
  }
  // fill uncovered texels of the roughness map with a neutral value
  for (let i = 0; i < RR * RR; i++) if (rough[i * 4] === 0) { rough[i * 4] = 255; rough[i * 4 + 1] = 140; rough[i * 4 + 3] = 255; }
  const t2 = performance.now();
  // ---- normal map from height (tangent space: +u, +v)
  const normal = new Uint8Array(R * R * 4);
  const str = 0.8 * sc;
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    const k = y * R + x;
    const hl = height[y * R + ((x - 1 + R) % R)], hr = height[y * R + ((x + 1) % R)];
    const hd = height[max(y - 1, 0) * R + x], hu = height[min(y + 1, R - 1) * R + x];
    let nx = -(hr - hl) * str, ny = -(hu - hd) * str, nz = 1;
    const l = sqrt(nx * nx + ny * ny + nz * nz); nx /= l; ny /= l; nz /= l;
    const o = k * 4;
    normal[o] = Math.round((nx * 0.5 + 0.5) * 255); normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255); normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255); normal[o + 3] = 255;
  }
  // dilate albedo into uncovered texels
  for (let k = 0; k < R * R; k++) if (!G.cov[k]) { const o = k * 4; albedo[o] = linToSrgb8(base[0]); albedo[o + 1] = linToSrgb8(base[1]); albedo[o + 2] = linToSrgb8(base[2]); albedo[o + 3] = 255; }
  const t3 = performance.now();
  return { albedo, normal, rough, R, RR, ms: { regions: t1 - t0, full: t2 - t1, normal: t3 - t2 } };
}
