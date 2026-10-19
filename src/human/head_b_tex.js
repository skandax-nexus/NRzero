// AFTERZERO head_b: procedural skin textures baked in UV space.
// The skin mesh is rasterised into a UV-space geometry buffer (canonical position, normal, AO);
// anatomical region masks are evaluated from those 3D positions at quarter resolution, then a
// full-resolution pass adds high-frequency detail (pores, fine lines, freckles, moles, stubble,
// painted brow hairs, scar). Outputs RGBA8 arrays for albedo (sRGB), tangent-space normal map
// (from a height field) and roughness/AO. All our own code; no external images.

import { lidAt, lipOutline, clamp, smoothstep, mix, gauss, mulberry32, earFrame, noseFrame } from './head_b_sdf.js';

const { sqrt, abs, floor, min, max, exp, sin, cos, atan2, PI, pow } = Math;

// ---------------------------------------------------------------------------------------------
// hashing / noise (2D value noise on a lattice, tileable not required)
function hash2(ix, iy, s) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x, y, s, oct) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 17); f *= 2.03; a *= 0.5; } return v; }
// cellular "pore" field: distance to nearest jittered point in a grid (0 at pore centre)
function cell(x, y, s) {
  const ix = floor(x), iy = floor(y);
  let d1 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i + hash2(ix + i, iy + j, s), cy = iy + j + hash2(ix + i, iy + j, s + 7);
    const dx = x - cx, dy = y - cy, d = dx * dx + dy * dy;
    if (d < d1) d1 = d;
  }
  return sqrt(d1);
}

export function hexToLin(hex) {
  const c = [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
  return c.map(v => v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4));
}
function linToSrgb8(v) { v = v <= 0 ? 0 : v >= 1 ? 1 : v; return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255); }

// ---------------------------------------------------------------------------------------------
// UV-space geometry buffer: rasterise triangles (u may exceed 1 at the seam: wraps)
function rasterGBuf(geo, R, S) {
  const P = geo.position, Nn = geo.normal, UV = geo.uv, A = geo.attr, I = geo.index;
  const pos = new Float32Array(R * R * 3), nor = new Float32Array(R * R * 3), ao = new Float32Array(R * R), cov = new Uint8Array(R * R);
  const dep = new Float32Array(R * R).fill(-1);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ax = UV[a * 2] * R, ay = UV[a * 2 + 1] * R, bx = UV[b * 2] * R, by = UV[b * 2 + 1] * R, cx = UV[c * 2] * R, cy = UV[c * 2 + 1] * R;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (abs(area) < 1e-9) continue;
    const x0 = max(floor(min(ax, bx, cx)), -R), x1 = min(Math.ceil(max(ax, bx, cx)), 2 * R), y0 = max(floor(min(ay, by, cy)), 0), y1 = min(Math.ceil(max(ay, by, cy)), R - 1);
    for (let py = y0; py <= y1; py++) {
      const sy = py + 0.5;
      for (let px = x0; px <= x1; px++) {
        const sx = px + 0.5;
        let w0 = ((bx - sx) * (cy - sy) - (by - sy) * (cx - sx)) / area;
        let w1 = ((cx - sx) * (ay - sy) - (cy - sy) * (ax - sx)) / area;
        let w2 = 1 - w0 - w1;
        const e = -0.02;
        if (w0 < e || w1 < e || w2 < e) continue;
        const wx = ((px % R) + R) % R;
        const k = py * R + wx;
        const X = (P[a * 3] * w0 + P[b * 3] * w1 + P[c * 3] * w2) / S, Y = (P[a * 3 + 1] * w0 + P[b * 3 + 1] * w1 + P[c * 3 + 1] * w2) / S, Z = (P[a * 3 + 2] * w0 + P[b * 3 + 2] * w1 + P[c * 3 + 2] * w2) / S;
        const dd = X * X + (Y - 0.045) * (Y - 0.045) + (Z + 0.005) * (Z + 0.005);
        if (dd <= dep[k]) continue;
        dep[k] = dd;
        for (let q = 0; q < 3; q++) {
          pos[k * 3 + q] = (P[a * 3 + q] * w0 + P[b * 3 + q] * w1 + P[c * 3 + q] * w2) / S;
          nor[k * 3 + q] = Nn[a * 3 + q] * w0 + Nn[b * 3 + q] * w1 + Nn[c * 3 + q] * w2;
        }
        ao[k] = A[a * 2] * w0 + A[b * 2] * w1 + A[c * 2] * w2;
        cov[k] = 1;
      }
    }
  }
  // dilate a few texels so bilinear sampling never reads empty space
  for (let it = 0; it < 4; it++) {
    const add = [];
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      const k = y * R + x; if (cov[k]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = (x + dx + R) % R, yy = y + dy; if (yy < 0 || yy >= R) continue;
        const kk = yy * R + xx; if (cov[kk] === 1) { add.push([k, kk]); break; }
      }
    }
    for (const [k, kk] of add) { for (let q = 0; q < 3; q++) { pos[k * 3 + q] = pos[kk * 3 + q]; nor[k * 3 + q] = nor[kk * 3 + q]; } ao[k] = ao[kk]; cov[k] = 2; }
    for (const [k] of add) cov[k] = 1;
  }
  return { pos, nor, ao, cov };
}

// ---------------------------------------------------------------------------------------------
// anatomical regions (canonical coords)
const NCH = 16;
// channel ids
const RED = 0, YEL = 1, BLU = 2, LIP = 3, BEARD = 4, BROW = 5, ROUGH = 6, WFORE = 7, WCROW = 8, WNASO = 9, WEYE = 10, PORE = 11, SCAR = 12, DARK = 13, BROWS = 14, BROWT = 15;

function regions(m, p, x, y, z, nz, out) {
  const ax = abs(x), fem = m.fem, mal = m.mal, old = m.old;
  const yf = y < 0.1 ? 0.1 + (y - 0.1) / m.fl : y;
  const front = smoothstep(0.015, 0.06, z);
  // --- blood / redness: malar cheeks, nose tip and alae, ears, chin, slight forehead
  let red = 0.6 * gauss(ax - 0.043, 0.016) * gauss(yf - 0.055, 0.017) * front;
  red += 0.55 * gauss(ax, 0.012) * gauss(yf - 0.046, 0.011) * smoothstep(0.1, 0.112, z);
  red += 0.45 * gauss(ax - 0.013, 0.006) * gauss(yf - 0.04, 0.006) * smoothstep(0.088, 0.098, z);
  red += 0.3 * gauss(x, 0.016) * gauss(yf + 0.03, 0.012) * front;
  red += 0.15 * gauss(x, 0.03) * gauss(y - 0.135, 0.02) * front;
  red += 0.2 * gauss(ax, 0.012) * gauss(yf - 0.025, 0.008) * front;           // upper lip / columella base
  const ef = earFrame(m, ax, y, z);
  const earM = smoothstep(0.034, 0.024, sqrt(ef.u * ef.u + ef.v * ef.v * 0.42)) * smoothstep(-0.012, -0.002, ef.w);
  red += 0.7 * earM;
  // --- periorbital: upper lid darker/pinker crease, under-eye cooler and darker
  const ex = ax - m.eyeX, ey = y - m.eyeY, ez = z - m.eyeZ, er = sqrt(ex * ex + ey * ey + ez * ez);
  let lid = 0, under = 0, browM = 0, bs = 0, bt = 0;
  if (er < 0.032 && ez > -0.01) {
    const L = lidAt(m, ex);
    const inS = smoothstep(-0.25, 0.05, L.s) * smoothstep(1.3, 0.95, L.s);
    const hu = (ey - L.up) * 1000, hl = (L.lo - ey) * 1000;
    lid = gauss(hu - 3.0, 3.2) * inS * smoothstep(-1, 0.5, hu);
    under = gauss(hl - 4.5, 3.5) * inS * smoothstep(-1, 0.5, hl);
    red += 0.2 * lid + 0.12 * gauss(L.s, 0.08) * smoothstep(0.02, 0.012, er); // pink canthus
  }
  // --- eyebrow: s along the brow (0 head .. 1 tail), t across
  {
    const bx0 = 0.0125 - 0.001 * fem, bx1 = 0.0585 - 0.003 * fem;
    const s = (ax - bx0) / (bx1 - bx0);
    if (s > -0.3 && s < 1.3 && y > 0.085 && y < 0.135 && z > 0.035) {
      const sc = clamp(s, 0, 1);
      const arch = fem * 0.0045 + 0.0014 - 0.0012 * mal * max(0, m.brow) + 0.001 * fem * m.brow;
      const peak = mix(0.7, 0.64, fem);
      const yc = m.eyeY + 0.0168 + 0.0006 * mal + m.hU * 0.25 + arch * (sc < peak ? pow(sc / peak, 0.75) : 1 - pow((sc - peak) / (1 - peak), 1.5) * 1.2) - 0.0014 * mal * max(0, m.brow) * (1 - sc);
      const thick = (mix(0.0056, 0.0036, fem) + 0.0012 * mal * max(0, m.brow)) * mix(1.1, 0.42, pow(sc, 1.4)) * (1 - 0.12 * old);
      const tt = (y - yc) / thick;
      const along = smoothstep(-0.06, 0.08, s) * smoothstep(1.06, 0.84, s);
      browM = clamp(1.15 - abs(tt + 0.08), 0, 1) * along;
      bs = s; bt = tt;
    }
  }
  // --- lips (vermilion)
  let lip = 0, lipU = 0;
  {
    const L = lipOutline(m, ax);
    if (L.t < 1.15 && z > 0.072) {
      const edgeU = (L.up - yf) / 0.00055, edgeL = (yf - L.lo) / 0.0007;
      const lat = (1.03 - L.t) / 0.05;
      lip = clamp(min(edgeU, edgeL, lat), 0, 1);
      lip = lip * lip * (3 - 2 * lip);
      lipU = yf > L.ys ? 1 : 0;
    }
  }
  // --- beard area (male): moustache, chin, jaw and neck below an anatomical cheek line, sideburns
  let beard = 0;
  {
    // cheek line from the sideburn (ax .064, y .062) to near the mouth corner (ax .036, y .03)
    const t = clamp((ax - 0.036) / (0.064 - 0.036), -0.5, 1.4);
    const lineY = 0.03 + t * 0.032;
    const cheek = smoothstep(lineY + 0.004, lineY - 0.005, yf);
    const sideburn = smoothstep(0.05, 0.06, ax) * smoothstep(0.095, 0.08, y) * smoothstep(-0.018, -0.006, z) * smoothstep(0.022, 0.01, z);
    const neckLo = smoothstep(-0.088, -0.052, y);
    const L = lipOutline(m, min(ax, m.mouthHW));
    const nb = noseFrame(m);
    const mustache = smoothstep(0.03, 0.022, ax) * smoothstep(nb.baseY + 0.0015, nb.baseY - 0.002, yf) * smoothstep(L.up - 0.0004, L.up + 0.0012, yf);
    beard = max(cheek * smoothstep(-0.03, -0.005, z) * neckLo, sideburn, mustache) * (1 - lip);
    // sparser on the upper cheeks and the sides below the lower lip
    beard *= 1 - 0.45 * smoothstep(lineY - 0.012, lineY, yf) - 0.3 * gauss(ax - 0.02, 0.006) * gauss(yf - (L.lo - 0.006), 0.004);
    beard = clamp(beard, 0, 1) * mal;
  }
  // --- roughness (final roughness value)
  const tzone = gauss(ax, 0.017) * smoothstep(0.03, 0.06, yf) * smoothstep(0.1, 0.085, yf) * front + 0.7 * gauss(ax, 0.03) * gauss(y - 0.132, 0.022) * front + 0.4 * gauss(x, 0.012) * gauss(yf + 0.03, 0.01) * front;
  let rough = 0.5 - 0.12 * tzone;
  rough = mix(rough, 0.3, lip);
  rough = mix(rough, 0.42, lid * 0.6);
  rough += 0.1 * beard * (p.stubble ?? 0);
  // --- wrinkle masks
  const wf = smoothstep(0.115, 0.126, y) * smoothstep(0.168, 0.148, y) * smoothstep(0.066, 0.046, ax) * front;
  let crow = 0, wn = 0;
  {
    const lx = ax - (m.eyeX + m.cLx + 0.003), ly = y - (m.eyeY + m.cLy);
    crow = gauss(sqrt(lx * lx + ly * ly) - 0.007, 0.0055) * smoothstep(-0.004, 0.003, lx) * smoothstep(0.03, 0.055, z);
    const tt = clamp((0.035 - yf) / 0.045, 0, 1);
    const fx = mix(0.019, m.mouthHW + 0.007, pow(tt, 0.8)) + 0.0018 * tt * tt;
    wn = gauss(ax - fx, 0.0035) * smoothstep(0, 0.1, tt) * smoothstep(1.05, 0.75, tt) * front;
  }
  // --- pore strength
  const pore = (0.35 + 0.65 * gauss(ax - 0.035, 0.02) * gauss(yf - 0.05, 0.022) + 0.7 * gauss(ax, 0.012) * smoothstep(0.03, 0.055, yf) * smoothstep(0.1, 0.075, yf) * smoothstep(0.1, 0.112, z) + 0.35 * gauss(x, 0.014) * gauss(yf + 0.03, 0.012)) * (1 - lip) * (1 - 0.8 * lid);
  // --- scar (character right side: -X): forehead through the brow down to the cheek
  let scar = 0;
  if (p.scar) {
    const sx = -x;
    const a0 = [m.eyeX - 0.012, 0.152], a1 = [m.eyeX + 0.004, 0.068];
    const dx = a1[0] - a0[0], dy = a1[1] - a0[1];
    const tt = clamp(((sx - a0[0]) * dx + (y - a0[1]) * dy) / (dx * dx + dy * dy), 0, 1);
    const cx = a0[0] + dx * tt + 0.0015 * sin(tt * 11), cy = a0[1] + dy * tt;
    const dd = sqrt((sx - cx) * (sx - cx) + (y - cy) * (y - cy));
    const eyeGap = smoothstep(0.0125, 0.0145, er);
    scar = clamp(1 - dd / mix(0.0017, 0.001, tt), 0, 1) * smoothstep(0.0, 0.06, tt) * smoothstep(1.0, 0.86, tt) * eyeGap * front * (x < 0 ? 1 : 0);
  }
  out[RED] = clamp(red, 0, 1.2);
  out[YEL] = 0.5 * gauss(ax, 0.035) * smoothstep(0.1, 0.13, y) * front;
  out[BLU] = 0.55 * under;
  out[LIP] = lip; out[BEARD] = beard; out[BROW] = browM; out[ROUGH] = rough; out[WFORE] = wf; out[WCROW] = crow; out[WNASO] = wn; out[WEYE] = under;
  out[PORE] = pore; out[SCAR] = scar; out[DARK] = 0.35 * under + 0.3 * lid + 0.12 * lipU * lip; out[BROWS] = bs; out[BROWT] = bt;
}

// ---------------------------------------------------------------------------------------------
/**
 * @param geo  skin geometry arrays from buildSkin
 * @param m    model from makeModel
 * @param p    { skin, seed, freckles, stubble, wrinkles, scar, browColor, hairColor }
 * @param R    albedo/normal resolution
 */
export function bakeSkin(geo, m, p, R) {
  const t0 = performance.now();
  const S = m.S;
  const G = rasterGBuf(geo, R, S);
  const Q = R >> 2;                      // region resolution
  const reg = new Float32Array(Q * Q * NCH);
  const tmp = new Float32Array(NCH);
  for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) {
    const k = (y * 4 + 2) * R + (x * 4 + 2);
    const px = G.pos[k * 3], py = G.pos[k * 3 + 1], pz = G.pos[k * 3 + 2];
    regions(m, p, px, py, pz, G.nor[k * 3 + 2], tmp);
    reg.set(tmp, (y * Q + x) * NCH);
  }
  const t1 = performance.now();
  // ---- full-resolution pass
  const base0 = hexToLin(p.skin ?? 0xc08a64);
  const lum0 = 0.2126 * base0[0] + 0.7152 * base0[1] + 0.0722 * base0[2];
  const base = base0.map(c => (lum0 + (c - lum0) * 0.82) * 0.86);
  const lum = 0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2];
  const darkSkin = smoothstep(0.25, 0.08, lum);
  const rnd = mulberry32((p.seed | 0) * 131 + 7);
  const seed = (p.seed | 0) + 101;
  const albedo = new Uint8Array(R * R * 4);
  const height = new Float32Array(R * R);
  const RR = R >> 1;
  const rough = new Uint8Array(RR * RR * 4);
  const browCol = hexToLin(p.browColor ?? 0x1a120c);
  // moles: a few seeded spots in canonical (u,v)
  const moles = [];
  const nm = 3 + floor(rnd() * 4);
  for (let i = 0; i < nm; i++) moles.push([0.35 + rnd() * 0.3, 0.4 + rnd() * 0.35, 0.0007 + rnd() * 0.0012]);
  const freck = p.freckles ?? 0, stub = p.stubble ?? 0, wrk = clamp((p.wrinkles ?? 0) * 0.85 + m.old * 0.5, 0, 1.2);
  const lipCol = [base[0] * mix(0.82, 0.68, darkSkin) * mix(1, 1.05, m.fem) + 0.012 * (1 - darkSkin), base[1] * mix(0.5, 0.6, darkSkin) * mix(1, 0.94, m.fem), base[2] * mix(0.55, 0.62, darkSkin)];
  const v = new Float32Array(NCH);
  const sc = R / 1024; // noise scale relative to 1024
  for (let y = 0; y < R; y++) {
    const fy = (y + 0.5) / 4 - 0.5;
    const y0 = clamp(floor(fy), 0, Q - 1), y1 = min(y0 + 1, Q - 1), ty = clamp(fy - y0, 0, 1);
    for (let x = 0; x < R; x++) {
      const k = y * R + x;
      const fx = (x + 0.5) / 4 - 0.5;
      const x0 = ((floor(fx) % Q) + Q) % Q, x1 = (x0 + 1) % Q, tx = fx - floor(fx);
      const o00 = (y0 * Q + x0) * NCH, o10 = (y0 * Q + x1) * NCH, o01 = (y1 * Q + x0) * NCH, o11 = (y1 * Q + x1) * NCH;
      for (let c = 0; c < NCH; c++) {
        const a = reg[o00 + c] + (reg[o10 + c] - reg[o00 + c]) * tx, b = reg[o01 + c] + (reg[o11 + c] - reg[o01 + c]) * tx;
        v[c] = a + (b - a) * ty;
      }
      const u = x / sc, w = y / sc; // noise coords in 1024-texel units
      const X = G.pos[k * 3] * 1000, Y = G.pos[k * 3 + 1] * 1000, Z = G.pos[k * 3 + 2] * 1000; // canonical mm
      // --- colour
      let r = base[0], g = base[1], b = base[2];
      // large and medium scale mottling (position space, mm)
      const mot = fbm(X * 0.09 + 31, Y * 0.09 + 7, seed, 3) - 0.5, mot2 = vnoise(X * 0.6, Y * 0.6 + Z * 0.3, seed + 1) - 0.5;
      r *= 1 + 0.06 * mot + 0.025 * mot2; g *= 1 + 0.055 * mot + 0.03 * mot2; b *= 1 + 0.05 * mot + 0.03 * mot2;
      // blood: redder, a touch darker, capillary blotches
      const cap = 0.7 + 0.6 * fbm(X * 0.35, Y * 0.35 + 3, seed + 2, 2);
      const red = v[RED] * cap * (1 - 0.55 * darkSkin);
      r *= 1 + 0.16 * red; g *= 1 - 0.13 * red; b *= 1 - 0.1 * red;
      // sebaceous yellow on the forehead
      r *= 1 + 0.015 * v[YEL]; b *= 1 - 0.05 * v[YEL];
      // under-eye: cooler and darker; lid crease darker
      r *= 1 - 0.13 * v[BLU]; g *= 1 - 0.12 * v[BLU]; b *= 1 - 0.03 * v[BLU];
      r *= 1 - 0.12 * v[DARK]; g *= 1 - 0.15 * v[DARK]; b *= 1 - 0.12 * v[DARK];
      // lips
      if (v[LIP] > 0.001) {
        const ln = 0.9 + 0.2 * fbm(abs(X) * 0.5, Y * 0.12, seed + 9, 2);
        r = mix(r, lipCol[0] * ln, v[LIP]); g = mix(g, lipCol[1] * ln, v[LIP]); b = mix(b, lipCol[2] * ln, v[LIP]);
      }
      // freckles
      if (freck > 0) {
        const fm = smoothstep(0.6, 0.78, vnoise(X * 1.1, Y * 1.1, seed + 3)) * smoothstep(0.3, 0.7, vnoise(X * 0.08, Y * 0.08, seed + 4));
        const fr = fm * freck * (0.35 + v[RED] + 0.6 * v[PORE]) * (1 - v[LIP]);
        r *= 1 - 0.16 * fr; g *= 1 - 0.27 * fr; b *= 1 - 0.34 * fr;
      }
      // fine melanin noise
      const fn = vnoise(u * 0.7, w * 0.7, seed + 5) - 0.5;
      r *= 1 + 0.025 * fn; g *= 1 + 0.03 * fn; b *= 1 + 0.035 * fn;
      // stubble: blue-grey shadow of shaved follicles plus fine dark hair stubs
      let hgt = 0;
      if (v[BEARD] > 0.01 && stub > 0) {
        const den = v[BEARD] * stub * (0.75 + 0.5 * vnoise(X * 0.12, Y * 0.12, seed + 12));
        const tint = clamp(den, 0, 1) * mix(0.55, 0.3, darkSkin);
        r *= 1 - 0.34 * tint; g *= 1 - 0.3 * tint; b *= 1 - 0.2 * tint;
        const c = cell(u * 0.5, w * 0.5, seed + 11);
        const dot = smoothstep(0.34, 0.1, c) * clamp(den * 1.2, 0, 1);
        const a = dot * mix(0.75, 0.9, stub);
        r = mix(r, browCol[0] * 1.15, a); g = mix(g, browCol[1] * 1.15, a); b = mix(b, browCol[2] * 1.15, a);
        hgt += 0.2 * dot;
      }
      // painted brow hairs: strokes along the growth direction (medial hairs point up, later ones outward)
      if (v[BROW] > 0.01) {
        const s = v[BROWS], t = v[BROWT];
        const ang = mix(1.35, 0.1, clamp(s * 1.5, 0, 1)) + 0.25 * t;
        const ca = cos(ang), sa = sin(ang);
        const bxm = abs(X);
        const hu = (bxm * ca + Y * sa), hv = (-bxm * sa + Y * ca);
        const strand = vnoise(hu * 0.32, hv * 3.4, seed + 21) * 0.65 + vnoise(hu * 0.55, hv * 6.0, seed + 22) * 0.35;
        const dens = v[BROW] * (0.85 + 0.3 * vnoise(X * 0.4, Y * 0.4, seed + 23));
        const hair = smoothstep(0.5, 0.74, strand) * smoothstep(0.05, 0.5, dens);
        const fill = smoothstep(0.1, 1.0, dens) * 0.55;
        const a = clamp(max(hair * 0.95, fill), 0, 0.97);
        r = mix(r, browCol[0], a); g = mix(g, browCol[1], a); b = mix(b, browCol[2], a);
        hgt += 0.25 * hair;
      }
      // moles
      for (const [mu, mv, mr] of moles) {
        const du = (x / R - mu), dv = (y / R - mv);
        const dd = sqrt(du * du + dv * dv) / (mr * 0.9);
        if (dd < 1.5) { const a = smoothstep(1.2, 0.5, dd) * 0.65; r *= 1 - 0.4 * a; g *= 1 - 0.5 * a; b *= 1 - 0.5 * a; hgt += 0.25 * a; }
      }
      // scar: pinkish, slightly paler line with a depressed centre
      if (v[SCAR] > 0.01) {
        const sc2 = v[SCAR];
        r = mix(r, r * 1.1 + 0.02, sc2 * 0.7); g = mix(g, g * 0.88, sc2 * 0.6); b = mix(b, b * 0.92, sc2 * 0.5);
        hgt -= 0.9 * sc2;
      }
      const o = k * 4;
      albedo[o] = linToSrgb8(r); albedo[o + 1] = linToSrgb8(g); albedo[o + 2] = linToSrgb8(b); albedo[o + 3] = 255;
      // --- height: pores, fine lines, wrinkles
      const pc = cell(u * 0.38, w * 0.38, seed + 31);
      const pore = -smoothstep(0.3, 0.05, pc) * 0.22 * v[PORE];
      const micro = (vnoise(u * 0.7, w * 0.7, seed + 32) - 0.5) * 0.08 + (vnoise(u * 0.25, w * 0.8, seed + 33) - 0.5) * 0.06;
      hgt += pore + micro * (0.6 + 0.4 * v[PORE]) * (1 - 0.7 * v[LIP]);
      // lip vertical furrows
      if (v[LIP] > 0.01) hgt += (vnoise(abs(X) * 1.6, Y * 0.25, seed + 34) - 0.5) * 0.9 * v[LIP];
      // forehead lines (horizontal), crow's feet (radial), under-eye lines, nasolabial
      if (wrk > 0.01) {
        const fl = sin(Y * 0.72 + 0.8 * sin(abs(X) * 0.09 + 1.3) + 2.2 * fbm(X * 0.05, Y * 0.04, seed + 40, 2)) * 0.5 + 0.5;
        hgt -= v[WFORE] * wrk * smoothstep(0.78, 1.0, fl) * 1.8;
        const cx = abs(X) - (m.eyeX * 1000 + 15), cy = Y - m.eyeY * 1000;
        const cl = sin(atan2(cy, cx) * 26 + 2.5 * vnoise(X * 0.15, Y * 0.15, seed + 41)) * 0.5 + 0.5;
        hgt -= v[WCROW] * wrk * smoothstep(0.72, 1.0, cl) * 1.4;
        const ul = sin(Y * 2.2 + abs(X) * 0.35 + 2 * vnoise(X * 0.2, Y * 0.2, seed + 42)) * 0.5 + 0.5;
        hgt -= v[WEYE] * wrk * smoothstep(0.8, 1.0, ul) * 1.0;
        hgt -= v[WNASO] * wrk * 1.2;
      }
      height[k] = hgt;
      if ((x & 1) === 0 && (y & 1) === 0) {
        const ko = ((y >> 1) * RR + (x >> 1)) * 4;
        const rr = clamp(v[ROUGH] + 0.06 * (vnoise(u * 0.25, w * 0.25, seed + 50) - 0.5) - 0.08 * v[SCAR], 0.18, 0.95);
        rough[ko] = 255; rough[ko + 1] = Math.round(rr * 255); rough[ko + 2] = 0; rough[ko + 3] = 255;
      }
    }
  }
  const t2 = performance.now();
  // ---- normal map from height (tangent space: +u, +v)
  const normal = new Uint8Array(R * R * 4);
  const str = 0.9 * sc;
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    const k = y * R + x;
    const hl = height[y * R + ((x - 1 + R) % R)], hr = height[y * R + ((x + 1) % R)];
    const hd = height[max(y - 1, 0) * R + x], hu = height[min(y + 1, R - 1) * R + x];
    let nx = -(hr - hl) * str, ny = -(hu - hd) * str, nz = 1;
    const l = sqrt(nx * nx + ny * ny + nz * nz); nx /= l; ny /= l; nz /= l;
    const o = k * 4;
    normal[o] = Math.round((nx * 0.5 + 0.5) * 255); normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255); normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255); normal[o + 3] = 255;
  }
  const t3 = performance.now();
  return { albedo, normal, rough, R, RR, ms: { gbuf: t1 - t0, full: t2 - t1, normal: t3 - t2 } };
}
