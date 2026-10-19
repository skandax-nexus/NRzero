// head_a surface: the sculpted skin surface of one person, in millimetres of the reference space (adult
// male, face toward +Z, character's left = +X, origin = head pivot). Two layers:
//   1. the HULL: an implicit smooth union of skull / face-block / mandible / neck masses plus 3D
//      landmark-anchored bumps and dents (temples, zygomatic arch, masseter, mastoid, neck muscles,
//      larynx, nape). Grid vertices are rays from CEN solved against it.
//   2. the FACE: a sculpted relief z = h(x, y) (sagittal profile, lateral curvature and layered Gaussian /
//      curve-based bumps, dents and creases: brow, sockets, eyelid shells with crease and fold, cheekbones,
//      nasolabial folds, lips, chin ...) and the nose, smoothly unioned with the hull along +Z where the
//      hull faces forward.
// The eye fissures and the mouth slit are described here as 2D curves (shared by the topology builder).
// Everything is our own anthropometric estimate; nothing is transcribed from published head models.
import { clamp, lerp, sstep, smax, smin, makeSpline } from './head_a_util.js';

export const CEN = [0, 45, -5];
const g1 = (a) => Math.exp(-a * a);
const g2 = (a, b) => Math.exp(-(a * a + b * b));

// ------------------------------------------------------------------ hull (implicit)
function ellD(x, y, z, c, r) {
  const a = (x - c[0]) / r[0], b = (y - c[1]) / r[1], d = (z - c[2]) / r[2];
  const k0 = Math.sqrt(a * a + b * b + d * d);
  const a2 = a / r[0], b2 = b / r[1], d2 = d / r[2];
  const k1 = Math.sqrt(a2 * a2 + b2 * b2 + d2 * d2);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -r[0];
}

export function makeHull(F) {
  const cw = F.craniumW / 75, cl = F.craniumL, zw = F.zygW / 68.5;
  const cran = { c: [0, F.crown - 95, -12], r: [F.craniumW, 95, 96 * cl] };
  const low = { c: [0, 62, -14], r: [70.5 * cw, 58, 90 * cl] };
  const face = { c: [0, 50, 20], r: [F.zygW - 1.5, 46, 70] };
  const jx = F.gonX + 2.5;
  const mand = { c: [0, F.gonY - 6, 22], r: [jx, 32 - 2 * F.fem, 64] };
  const chinB = { c: [0, F.mentY + 12, F.pogZ - 22], r: [24 * F.chinW, 13, 20] };
  const gon = [-1, 1].map(s => ({ c: [s * (F.gonX - 6), F.gonY + 2, F.gonZ + 4], r: [9, 16, 15] }));
  const nr = F.neckR, nz = -12;
  const bumps = [];
  for (const s of [-1, 1]) {
    bumps.push({ c: [s * 63, 112, 36], r: [12, 22, 26], a: -F.temple });                       // temporal hollow
    bumps.push({ c: [s * 64, 62, 22], r: [8, 6.5, 18], a: 1.1 + 0.5 * F.masc });                // zygomatic arch
    bumps.push({ c: [s * (F.gonX - 1), F.gonY + 14, F.gonZ + 10], r: [9, 16, 16], a: 1.3 * F.jawDef }); // masseter
    bumps.push({ c: [s * 50, 36, -40], r: [10, 16, 12], a: 1.2 });                              // mastoid
    bumps.push({ seg: [[s * 50, 26, -38], [s * 40, -12, -16], [s * 22, -62, 20], [s * 10, -100, 40]], w: 10.5, a: (2.0 - 0.8 * F.fem) * (1 - 0.5 * F.child) }); // sternocleidomastoid
  }
  bumps.push({ c: [0, -60, 44], r: [8.5, 12, 10], a: F.adam });                                // larynx
  bumps.push({ c: [0, -30, -64], r: [15, 30, 12], a: -1.8 });                                  // nape groove
  bumps.push({ c: [0, 58, -108], r: [18, 11, 10], a: 1.2 * F.masc });                          // occipital protuberance
  for (const f of bumps) {
    if (f.seg) {
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const p of f.seg) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k] - f.w); mx[k] = Math.max(mx[k], p[k] + f.w); }
      f.bb = [mn, mx];
    } else f.bb = [[f.c[0] - f.r[0], f.c[1] - f.r[1], f.c[2] - f.r[2]], [f.c[0] + f.r[0], f.c[1] + f.r[1], f.c[2] + f.r[2]]];
  }
  function segD(x, y, z, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t, z - a[2] - dz * t);
  }
  function bumpSum(x, y, z) {
    let s = 0;
    for (const f of bumps) {
      const bb = f.bb;
      if (x < bb[0][0] || x > bb[1][0] || y < bb[0][1] || y > bb[1][1] || z < bb[0][2] || z > bb[1][2]) continue;
      let q;
      if (f.seg) { let d = 1e9; for (let k = 0; k < f.seg.length - 1; k++) d = Math.min(d, segD(x, y, z, f.seg[k], f.seg[k + 1])); q = (d / f.w) ** 2; }
      else { const a = (x - f.c[0]) / f.r[0], b = (y - f.c[1]) / f.r[1], c = (z - f.c[2]) / f.r[2]; q = a * a + b * b + c * c; }
      if (q < 1) s += f.a * (1 - q) * (1 - q) * (1 - q);
    }
    return s;
  }
  function H(x, y, z) {
    let d = ellD(x, y, z, cran.c, cran.r);
    d = smin(d, ellD(x, y, z, low.c, low.r), 12);
    d = smin(d, ellD(x, y, z, face.c, face.r), 12);
    let dm = ellD(x, y, z, mand.c, mand.r);
    dm = smin(dm, ellD(x, y, z, chinB.c, chinB.r), 8);
    for (const g of gon) dm = smin(dm, ellD(x, y, z, g.c, g.r), 7);
    d = smin(d, dm, 10);
    // neck: elliptic cylinder capped inside the head
    const a = x / nr, b = (z - nz) / (nr * 0.98);
    const dn = smax((Math.sqrt(a * a + b * b) - 1) * nr * 0.98, y - 8, 10);
    d = smin(d, dn, 14);
    return d - bumpSum(x, y, z);
  }
  // ray from o along unit d: distance to the surface (o must be inside)
  function ray(o, d) {
    let a = 30, fa = H(o[0] + a * d[0], o[1] + a * d[1], o[2] + a * d[2]);
    let b = a, fb = fa;
    while (fb < 0 && b < 400) { a = b; fa = fb; b += 24; fb = H(o[0] + b * d[0], o[1] + b * d[1], o[2] + b * d[2]); }
    if (fa > 0) { a = 0; fa = H(o[0], o[1], o[2]); }
    let t = b, side = 0;
    for (let it = 0; it < 40; it++) {
      t = (a * fb - b * fa) / (fb - fa);
      const ft = H(o[0] + t * d[0], o[1] + t * d[1], o[2] + t * d[2]);
      if (Math.abs(ft) < 0.002 || b - a < 0.004) break;
      if (ft > 0) { b = t; fb = ft; if (side === -1) fa *= 0.5; side = -1; } else { a = t; fa = ft; if (side === 1) fb *= 0.5; side = 1; }
    }
    return t;
  }
  function grad(x, y, z, out) {
    const e = 0.35;
    out[0] = H(x + e, y, z) - H(x - e, y, z); out[1] = H(x, y + e, z) - H(x, y - e, z); out[2] = H(x, y, z + e) - H(x, y, z - e);
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l;
    return out;
  }
  // front surface along -Z at (x, y): largest z with H = 0 (or null)
  function frontZ(x, y) {
    let b = 140, fb = H(x, y, b);
    if (fb < 0) return null;
    let a = b, fa = fb;
    while (fa > 0 && a > -60) { b = a; fb = fa; a -= 12; fa = H(x, y, a); }
    if (fa > 0) return null;
    let t = a, side = 0;
    for (let it = 0; it < 40; it++) {
      t = (a * fb - b * fa) / (fb - fa);
      const ft = H(x, y, t);
      if (Math.abs(ft) < 0.002 || b - a < 0.004) break;
      if (ft < 0) { a = t; fa = ft; if (side === -1) fb *= 0.5; side = -1; } else { b = t; fb = ft; if (side === 1) fa *= 0.5; side = 1; }
    }
    return t;
  }
  return { H, ray, grad, frontZ };
}

// ------------------------------------------------------------------ eye fissure (2D curves) and lid shells
// local coordinates: lx = lateral (+ away from the nose), ly = up, both relative to the eyeball centre.
export function makeEyeGeo(F, s) {
  const E = [s * F.E[0] + 0.25 * F.eyeAsym[0] * s, F.E[1] + (s > 0 ? F.eyeAsym[1] : -F.eyeAsym[1]) * 0.6, F.E[2]];
  const R = F.eyeR;
  const fw = F.fissW;
  const mc = [-14.6 * fw, -1.2 + 0.15 * F.v.eyeY];
  const tiltMm = 27 * Math.tan(F.tilt * Math.PI / 180) * 0.75;
  const lc = [13.4 * fw, mc[1] + tiltMm];
  const upH = R * Math.sin(F.lidUp * Math.PI / 180), loH = R * Math.sin(F.lidLo * Math.PI / 180);
  const upPeak = 0.44 - 0.04 * F.asian, loPeak = 0.57;
  const eU = Math.log(0.5) / Math.log(upPeak), eL = Math.log(0.5) / Math.log(loPeak);
  const lxOf = (t) => lerp(mc[0], lc[0], t);
  const baseY = (t) => lerp(mc[1], lc[1], t);
  // vertical opening shapes (0 at the canthi): upper is rounder medially, sharper laterally
  const upShape = (t) => { const q = Math.pow(clamp(t, 0, 1), eU); return Math.pow(Math.sin(Math.PI * q), 0.9 + 0.25 * t); };
  const loShape = (t) => { const q = Math.pow(clamp(t, 0, 1), eL); return Math.pow(Math.sin(Math.PI * q), 1.05); };
  const upAmp = upH - baseY(upPeak), loAmp = baseY(loPeak) - loH;
  // t: 0 = medial canthus, 1 = lateral canthus
  const upper = (t) => [lxOf(t), baseY(t) + upAmp * upShape(t)];
  const lower = (t) => [lxOf(t), baseY(t) - loAmp * loShape(t)];
  const toXY = (l) => [E[0] + s * l[0], E[1] + l[1]];
  // closed fissure: sigma in [0,1): 0 medial -> upper -> 0.5 lateral -> lower -> 1 medial.
  // cosine spacing in t gives more points near the canthi
  const tOf = (sig) => { const u = sig < 0.5 ? sig * 2 : (1 - sig) * 2; return (1 - Math.cos(Math.PI * u)) * 0.5; };
  const fissure = (sig) => { const t = tOf(sig); return toXY(sig < 0.5 ? upper(t) : lower(t)); };
  // outer boundary of the eye patch (ellipse in x, y)
  const oc = [0.8, 1.5], oax = 21.5, oayU = 17.2, oayD = 14.8;
  const outer = (sig) => {
    const t = tOf(sig);
    const lx = lerp(oc[0] - oax, oc[0] + oax, t);
    const c = (lx - oc[0]) / oax;
    const h = Math.sqrt(Math.max(0, 1 - c * c));
    return toXY([lx, oc[1] + (sig < 0.5 ? oayU * h : -oayD * h)]);
  };
  // crease height above the upper margin (mm) by t
  const creaseOff = (t) => F.crease * Math.pow(Math.sin(Math.PI * clamp(lerp(0.04, 0.98, t), 0, 1)), 0.55);
  return { s, E, R, mc, lc, upper, lower, toXY, fissure, outer, tOf, creaseOff, upH, loH, lxOf };
}

// ------------------------------------------------------------------ mouth (2D curves)
export function makeMouthGeo(F) {
  const mw = F.mouthW;
  const yS = F.slitY;
  const HU = makeSpline([0, 0.08, 0.17, 0.3, 0.5, 0.7, 0.86, 0.95, 1.0], [0.84 - 0.08 * F.bow, 0.93, 1.0, 0.95, 0.82, 0.6, 0.36, 0.17, 0]);
  const HL = makeSpline([0, 0.2, 0.4, 0.6, 0.8, 0.92, 1.0], [1.0, 0.98, 0.9, 0.74, 0.46, 0.22, 0]);
  const slitY = (x) => yS - F.cornerDrop * Math.pow(Math.min(1, Math.abs(x) / mw), 2.2) + F.slitAsym * 0.4 * (x / mw);
  const hu = (x) => { const u = Math.abs(x) / mw; return u >= 1 ? 0 : F.lipU * Math.max(0, HU(u)); };
  const hl = (x) => { const u = Math.abs(x) / mw; return u >= 1 ? 0 : F.lipL * Math.max(0, HL(u)); };
  // outer patch ellipse (half extents)
  const outUp = Math.max(14, F.subY - 1.6 - yS), outDn = 17 + 0.5 * F.lipL, outW = mw + 13;
  return { mw, yS, slitY, hu, hl, outUp, outDn, outW };
}

// ------------------------------------------------------------------ face relief z = h(x, y)
export function makeFace(F) {
  const E = F.E, fem = F.fem, masc = F.masc, old = F.old, ch = F.child;
  const M = makeMouthGeo(F);
  const eyes = [makeEyeGeo(F, -1), makeEyeGeo(F, 1)];
  const yS = F.slitY, yPg = F.pogY, yMe = F.mentY, ySub = F.subY;
  const fs = F.foreSlope;
  const yN = F.nasion[1];
  const zN = 90.4 + 1.4 * F.bridge + 0.3 * masc - 1.2 * F.asian;
  const zG = zN + 3.2 + 0.9 * F.glabella;
  const yG = yN + 9.5;
  const pgz = F.pogZ;
  const zMe = pgz - 15;
  const ySulc = yS - F.lipL - 5.5 - 0.15 * F.lipL;
  // sagittal base profile (muzzle without lips and nose)
  const PY = [yMe - 18, yMe - 7, yMe, yPg - 6, yPg, yPg + 8, ySulc, yS - F.lipL, yS, yS + F.lipU, ySub, ySub + 9, 55, 72, yN, yG, yG + 10, 130, 145, 160, 172, 186, 200];
  const PZ = [zMe - 34, zMe - 10, zMe, pgz - 2.2, pgz, pgz - 1.4, pgz - 3.4 - 0.5 * F.lipProjL, F.subZ - 6.8, F.subZ - 5.6, F.subZ - 3.0, F.subZ - 0.6, F.subZ - 5, 92.5, 90.5, zN - 1.5, zG, zG + 0.2, zG - 1.6 - 0.6 * fs, zG - 4.6 - 2.4 * fs, zG - 10 - 4 * fs, zG - 17 - 4 * fs, zG - 30 - 3 * fs, zG - 50];
  const prof = makeSpline(PY, PZ);
  // horizontal radius of curvature by height
  const RY = [yMe - 6, yMe, yPg, yS - 12, yS, yS + 12, ySub, 48, 60, 72, 86, 100, 116, 135, 160, 185];
  const RC = [18, 20 + 6 * F.chinW + 6 * F.chinSquare, 27 + 8 * F.chinSquare, 31, 32.5 + 1.5 * fem, 37, 46, 58, 66, 78, 86, 82, 80, 84, 78, 66];
  const rcF = makeSpline(RY, RC);
  const mw = M.mw;

  // ---- nose
  const yT = F.tipY, zT = F.tipZ;
  const tipR = F.tipRot * Math.PI / 180;
  const dY = [yT - 2.5, yT, yT + 4, yT + 9.5, lerp(yT + 9.5, yN, 0.42), lerp(yT + 9.5, yN, 0.75), yN, yN + 7, yN + 14];
  const dZ = [zT - 1.2, zT, zT - 1.3 - 6 * Math.sin(tipR) * 0.15, zT - 4.6 - 0.6 * Math.sin(tipR) * 10 * 0.1,
    lerp(zT - 4.6, zN, 0.42) + F.hump, lerp(zT - 4.6, zN, 0.75) + 0.35 * F.hump, zN, zN + 1.8, zN + 4.4];
  const dorsZ = makeSpline(dY, dZ);
  const wY = [yT - 3, yT + 2, yT + 9, (yT + yN) * 0.5, yN - 6, yN + 4, yN + 14];
  const wV = [F.tipW * 1.1, F.tipW, F.dorsumW * 1.15, F.dorsumW * 0.96, F.dorsumW * 1.12, F.dorsumW * 1.7, F.dorsumW * 3.2];
  const dorsW = makeSpline(wY, wV);
  const alX = F.alarW - 5.6, alY = ySub + 5.2, alZ = F.subZ - 3.6;
  const alR = [6.2, 5.8 + 0.4 * F.african, 7.6];
  const tipC = [F.tipW * 0.26, yT - 1.0, zT - 6.6], tipRd = [F.tipW * 0.92, 6.9, 6.7];
  const ellZ = (x, y, c, r) => {
    const a = (x - c[0]) / r[0], b = (y - c[1]) / r[1], q = 1 - a * a - b * b;
    return q > 0 ? c[2] + r[2] * Math.sqrt(q) : c[2] - r[2] * 2.2 * (Math.sqrt(1 - q) - 1);
  };
  const nostrilC = [F.alarW * 0.42, ySub + 3.2], nostrilR = [3.0 * F.nostril, 2.1 * F.nostril];
  function nose(x, y) {
    if (y < ySub - 7 || y > yN + 18 || Math.abs(x) > 30) return -1e9;
    const ax = Math.abs(x - F.noseDev * sstep(yN, yT, y));
    let z = -1e9;
    if (y > yT - 7) {
      const zd = dorsZ(y);
      const w = dorsW(y);
      const u = ax / w;
      z = zd - (2.5 * u * u + 0.55 * u * u * u * u) * (1 + 0.5 * sstep(yN - 8, yN + 10, y));
    }
    // tip lobule (two soft domes)
    const t1 = ellZ(ax, y, tipC, tipRd);
    z = smax(z, t1, 2.2);
    // columella
    if (y < yT + 1 && y > ySub - 2) {
      const f = clamp((y - ySub) / (yT - ySub), 0, 1);
      const zc = lerp(F.subZ + 1.2, zT - 4.6, Math.pow(f, 0.75));
      const wc = 3.3 + 1.4 * f;
      z = smax(z, zc - (ax / wc) * (ax / wc) * 5.5, 1.4);
    }
    // alae
    const a1 = ellZ(ax, y, [alX, alY, alZ], alR);
    z = smax(z, a1, 1.6);
    // nostril openings pressed up into the base of the nose
    const nx = (ax - nostrilC[0]) / nostrilR[0], ny = (y - nostrilC[1]) / nostrilR[1];
    const rot = 0.5;
    const nxr = nx * Math.cos(rot) - ny * Math.sin(rot), nyr = nx * Math.sin(rot) + ny * Math.cos(rot);
    z -= 4.2 * Math.exp(-(nxr * nxr * 0.8 + nyr * nyr) * 1.6) * sstep(yT - 3, yT - 7, y);
    return z;
  }

  // nasolabial fold: polyline from the alar crest past the mouth corner (x > 0 side)
  const nlP = [[F.alarW + 0.6, ySub + 7], [F.alarW + 3.5, ySub - 3], [mw + 5.5, yS + 1], [mw + 7.5, yS - 10]];
  function nlDist(ax, y) {
    let best = 1e9, bt = 0, sd = 1, acc = 0, tot = 0;
    const L = [];
    for (let k = 0; k < nlP.length - 1; k++) { const l = Math.hypot(nlP[k + 1][0] - nlP[k][0], nlP[k + 1][1] - nlP[k][1]); L.push(l); tot += l; }
    for (let k = 0; k < nlP.length - 1; k++) {
      const p = nlP[k], q = nlP[k + 1], dx = q[0] - p[0], dy = q[1] - p[1];
      const t = clamp(((ax - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy), 0, 1);
      const d = Math.hypot(ax - p[0] - dx * t, y - p[1] - dy * t);
      if (d < best) { best = d; bt = (acc + t * L[k]) / tot; sd = (dx * (y - p[1]) - dy * (ax - p[0])) < 0 ? 1 : -1; }
      acc += L[k];
    }
    return [best * sd, bt];
  }

  // lids: upper and lower shells around each eyeball, crease, fold, socket
  const Rl = F.eyeR + 1.95 - 0.15 * fem, RlL = F.eyeR + 1.55;
  function sphereZ(E, Rr, x, y) {
    const dx = x - E[0], dy = y - E[1], q = Rr * Rr - dx * dx - dy * dy;
    if (q > 0.25 * Rr * Rr) return E[2] + Math.sqrt(q);
    // continue with a gentle slope past ~0.87 R so the shell meets the socket softly
    const q0 = 0.25 * Rr * Rr, z0 = Math.sqrt(q0), dz = (q - q0) / (2 * z0);
    return E[2] + z0 + dz;
  }
  function eyeRegion(x, y, zBase) {
    let z = zBase;
    for (const G of eyes) {
      const lx = G.s * (x - G.E[0]), ly = y - G.E[1];
      if (lx < -26 || lx > 30 || ly < -24 || ly > 28) continue;
      const t = clamp((lx - G.mc[0]) / (G.lc[0] - G.mc[0]), 0, 1);
      const inside = lx > G.mc[0] && lx < G.lc[0];
      const yU = inside ? G.upper(t)[1] : lerp(G.mc[1], G.lc[1], t);
      const yLo = inside ? G.lower(t)[1] : lerp(G.mc[1], G.lc[1], t);
      // socket recess (orbit) under the lids
      const sock = (2.4 + 1.6 * F.socket) * g2((lx - 0.5) / 15.5, (ly - 2.5) / 13) + (1.4 + 1.8 * F.socket) * g2((lx + 1) / 12.5, (ly - 9.5) / 5.5);
      // medial recess beside the nose bridge (inner corner depth)
      const med = (1.6 + 0.8 * F.socket) * g2((lx + 13) / 4.5, (ly + 0.5) / 6);
      z -= sock + med;
      // upper lid shell: from the margin up to the crease
      const cr = G.creaseOff(t);
      const yC = yU + cr;
      const lidEnd = inside ? 1 : g1((lx < G.mc[0] ? lx - G.mc[0] : lx - G.lc[0]) / 2.0);
      let zU = sphereZ(G.E, Rl, x, y);
      zU -= 7 * sstep(yC - 0.4, yC + 2.4, y);             // fold away above the crease
      zU -= 9 * (1 - lidEnd);
      // upper lid soft-tissue fullness right above the lash line
      zU += 0.35 * g1((ly - yU - 2.0) / 2.2) * lidEnd;
      // lower lid shell: from the margin down to the lid-cheek junction
      let zL = sphereZ(G.E, RlL, x, y);
      zL += 0.35 * g1((ly - yLo + 1.6) / 1.5) * lidEnd;   // tarsal roll under the lashes
      zL -= 6 * sstep(yLo - 5.5 - 0.8 * F.bags, yLo - 10.5, y);
      zL -= 9 * (1 - lidEnd);
      z = smax(z, zU, 0.9);
      z = smax(z, zL, 1.3);
      // hooding: skin above the crease bulging forward / down over it (age, brow weight, epicanthic fold)
      const hood = F.hood * (0.7 + 0.6 * sstep(-4, 10, lx));
      z += hood * g2((lx - 2.5) / 13.5, (ly - yU - cr - 2.2) / 2.6);
      // epicanthic fold at the inner corner
      if (F.epicanthus > 0) z += 1.4 * F.epicanthus * g2((lx + 12.5) / 3.2, (ly - 1.5) / 3.6);
      // lower lid fat pad (bags) and tear trough
      z += F.bags * 1.25 * g2((lx - 1.5) / 9, (ly - yLo + 8) / 3.2);
      const ttx = lx + 6, tty = ly - (yLo - 9.5 - 0.25 * lx);
      z -= (0.25 + 1.0 * old + 0.25 * F.bags) * g2(ttx / 8, tty / 2.4) * sstep(8, -2, lx);
      // lateral canthal soft fold
      z -= 0.4 * g2((lx - G.lc[0] - 2.5) / 3.5, (ly - G.lc[1]) / 2.5);
    }
    return z;
  }

  function base(x, y) {
    const ax = Math.abs(x);
    let z = prof(y);
    const Rc = rcF(y);
    z -= ax * ax / (2 * Rc);
    { const e = Math.max(0, ax - 38 - 6 * sstep(80, 120, y)); z -= 0.075 * e * e * (1 + 0.6 * sstep(30, -20, y)); }
    // brow ridge (bone) and eyebrow soft tissue
    const bx = ax - 23, byc = 103.5 + 2.5 * g1((ax - 25) / 14) - 0.0045 * bx * bx - 1.6 * F.sh.brow * 0;
    z += F.browRidge * g1((y - byc) / 5.8) * g1(bx / 19) * (1 - 0.3 * sstep(22, 46, ax));
    z += (0.5 + 0.25 * masc) * g2((ax - 26) / 15, (y - F.browY + 0.5) / 3.6);
    z += F.glabella * g2(x / 8.5, (y - yG) / 6.5);
    // procerus dip between the brows / radix
    z -= 0.5 * g2(x / 5, (y - yN - 3) / 5);
    // frontal eminences
    z += (0.5 + 1.1 * fem + 1.4 * ch) * g2((ax - 24) / 16, (y - 142) / 16);
    // temporal ridge softening at the forehead sides
    z -= (0.8 + 1.0 * old) * g2((ax - 52) / 7, (y - 130) / 22);
    // cheekbones (malar eminence + body), zygoma lateral
    z += F.malar * g2((ax - 41) / 13.5, (y - F.malarY) / 10);
    z += 0.6 * F.malar * g2((ax - 53) / 9.5, (y - F.malarY - 3) / 8);
    // sub-malar / buccal hollow
    z -= F.buccal * 1.6 * g2((ax - 45) / 10.5, (y - 21) / 13);
    // maxillary fullness under the cheek / beside the nose
    z += 1.0 * g2((ax - 26) / 9, (y - 42) / 9);
    // nasolabial fold: cheek mound lateral to a crease
    {
      const [d, t] = nlDist(ax, y);
      const along = sstep(-0.02, 0.12, t) * (1 - sstep(0.82, 1.0, t));
      if (d > 0) z += (0.6 + F.nlf * 1.0) * along * g1((d - 5.5) / 5.5) * (1 - 0.6 * ch);
      z -= (0.25 + F.nlf * 0.6) * along * g1(d / (1.2 + 0.4 * old));
    }
    // philtrum columns & groove
    {
      const yt = yS + M.hu(0) * 0.9, ys = ySub - 0.5;
      if (y > yt - 2 && y < ys + 1.5) {
        const f = clamp((y - yt) / (ys - yt), 0, 1);
        const px = lerp(4.4 + 0.4 * F.bow, 3.0, f);
        z += F.philtrum * 0.75 * g1((ax - px) / 1.5) * sstep(-0.05, 0.15, f) * (1 - sstep(0.85, 1.05, f));
        z -= F.philtrum * 0.3 * g1(ax / 1.9) * sstep(0, 0.25, f) * (1 - sstep(0.8, 1, f));
      }
    }
    // modiolus, marionette and jowl
    z += (0.6 + 0.3 * fem) * g2((ax - mw - 3.5) / 3.6, (y - yS) / 4.8);
    z -= (0.35 + 0.3 * old) * g2((ax - mw - 0.8) / 1.6, (y - yS + 0.2) / 1.8);   // commissure dimple
    z -= F.marionette * 1.0 * g1((ax - mw - 1.5 - 0.15 * (yS - y)) / 2.2) * sstep(yS, yS - 6, y) * sstep(yPg - 4, yPg + 6, y);
    z += F.jowl * 2.4 * g2((ax - mw - 9) / 7.5, (y - yPg - 3) / 7);
    // chin pad, mentalis, cleft
    z += (1.0 + 0.8 * F.chinSquare) * g2(ax / (12.5 * F.chinW), (y - yPg - 1) / 8);
    z += 0.6 * F.chinSquare * g2((ax - 9 * F.chinW) / 5, (y - yPg + 1) / 7);
    z -= F.cleft * 0.6 * g2(x / 2.0, (y - yPg) / 4.5);
    // lower lip support / mentolabial sulcus shaping
    z -= (0.6 + 0.35 * F.lipProjL) * g2(ax / 12, (y - ySulc) / 3.5);
    return z;
  }

  // lips: vermilion volumes built on the slit and the vermilion borders
  function lips(x, y) {
    const ax = Math.abs(x);
    if (ax > mw + 8 || y < yS - F.lipL - 9 || y > yS + F.lipU + 10) return 0;
    const ys = M.slitY(x);
    const u = Math.min(1, ax / mw);
    const span = Math.pow(Math.max(0, 1 - u * u), 0.55);
    const hu = Math.max(0.6, M.hu(x)), hl = Math.max(0.6, M.hl(x));
    const dy = y - ys;
    let z = 0;
    if (dy >= 0) {
      const q = dy / hu;
      // vermilion bulge (max just below the border) then the skin of the upper lip above the border
      const verm = q <= 1 ? (0.42 + 0.58 * Math.sin(Math.PI * 0.5 * Math.min(1, q / 0.78))) : 1 - 0.65 * sstep(1, 1 + 9 / hu, q);
      z += F.lipProjU * span * verm;
      // vermilion border ridge (white roll)
      z += 0.32 * span * g1((q - 1.02) * hu / 0.75) * (1 - 0.4 * u);
      // roll into the slit
      z -= (0.9 + 0.5 * F.lipProjU) * span * g1(dy / 1.15);
    } else {
      const q = -dy / hl;
      const vv = q <= 1 ? 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * Math.min(1, q / 0.92)), 0.75) * (q < 0.46 ? 1 : 1) : 0.35 * (1 - sstep(1, 1 + 6 / hl, q));
      z += F.lipProjL * span * vv;
      z += 0.22 * span * g1((q - 1.0) * hl / 0.8) * (1 - 0.5 * u);
      z -= (0.9 + 0.5 * F.lipProjL) * span * g1(dy / 1.2);
    }
    // the corners tuck in
    z -= 1.4 * g2((ax - mw) / 2.2, dy / 2.0);
    return z;
  }

  function faceZ(x0, y0) {
    const y = clamp(y0, yMe - 20, 205), x = clamp(x0, -82, 82);
    const out = Math.max(0, yMe - 20 - y0) + Math.max(0, Math.abs(x0) - 82) + Math.max(0, y0 - 205);
    let z = base(x, y) + lips(x, y);
    z = eyeRegion(x, y, z);
    const nz = nose(x, y);
    if (nz > -1e8) {
      const k = lerp(0.85, 3.6, sstep(ySub + 10, yN - 10, y));
      z = smax(z, nz, k);
    }
    return z - 3 * out;
  }
  return { faceZ, base, nose, lips, eyeRegion, eyes, mouth: M, zN, zG, nlDist, alar: { x: alX, y: alY, z: alZ } };
}

// ------------------------------------------------------------------ the full surface
export function makeSurface(F) {
  const hull = makeHull(F);
  const face = makeFace(F);
  const C = CEN;
  const n = [0, 0, 0];
  const KF = 6;
  // union with the face along +Z, only where the hull faces forward
  function unite(p) {
    const x = p[0], y = p[1];
    if (p[2] < -25 || Math.abs(x) > 84 || y < F.mentY - 24 || y > 210) return p;
    hull.grad(x, y, p[2], n);
    const w = sstep(-0.15, 0.3, n[2]);
    if (w <= 0) return p;
    const hz = face.faceZ(x, y);
    const z = smax(p[2], hz, KF);
    p[2] = lerp(p[2], z, w);
    return p;
  }
  // point for the ray direction d (unit) from CEN
  function point(d, out) {
    const t = hull.ray(C, d);
    out = out || [0, 0, 0];
    out[0] = C[0] + t * d[0]; out[1] = C[1] + t * d[1]; out[2] = C[2] + t * d[2];
    return unite(out);
  }
  // point with prescribed (x, y) on the front of the face; also returns the hull point (for the chart)
  function pointXY(x, y, out, hullOut) {
    out = out || [0, 0, 0];
    let zh = hull.frontZ(x, y);
    if (zh === null) zh = 0;
    if (hullOut) { hullOut[0] = x; hullOut[1] = y; hullOut[2] = zh; }
    out[0] = x; out[1] = y; out[2] = zh;
    return unite(out);
  }
  return { point, pointXY, hull, face, F };
}

export function dirOf(th, ph, out) {
  out = out || [0, 0, 0];
  const c = Math.cos(ph);
  out[0] = c * Math.sin(th); out[1] = Math.sin(ph); out[2] = c * Math.cos(th);
  return out;
}
// chart angles of a point (direction from CEN)
export function angOf(p) {
  const dx = p[0] - CEN[0], dy = p[1] - CEN[1], dz = p[2] - CEN[2];
  return [Math.atan2(dx, dz), Math.atan2(dy, Math.hypot(dx, dz))];
}
