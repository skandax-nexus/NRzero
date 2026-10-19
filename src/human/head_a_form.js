// head_a form: the sculpted surface. Every grid vertex is a ray from a centre inside the head; along it
//   1. the cranium / face block / mandible / neck masses are met by a radial smooth union of ellipsoids,
//   2. a frontal relief (sagittal profile + lateral falloff + landmark-anchored bumps, dents and creases
//      for brow ridge, sockets, cheekbones, nasolabial folds, philtrum, chin ...) and the nose
//      (dorsum ridge, tip lobule, columella and alae) are met as a heightfield and smoothly unioned,
//   3. 3D side fields add temples, zygomatic arch, jaw angle, neck muscles, larynx,
//   4. the eye and mouth zones are replaced by explicit lid / lip models (head_a_lids.js, head_a_lips.js)
//      draped over the eyeballs and the dental arch, blended into the surrounding surface,
//   5. nostrils are pressed in along the surface normal and the result is lightly relaxed.
// All in millimetres of the reference (adult male) space; the caller scales to metres.
import { clamp, lerp, sstep, smax, interpS, makeSpline } from './head_a_util.js';

const DEG = Math.PI / 180;
export const CEN = [0, 40, -5];

// ------------------------------------------------------------------ hull (radial union of ellipsoids)
function ell(c, r, tilt = 0) {
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  return { c, ir: [1 / r[0], 1 / r[1], 1 / r[2]], ct, st, tilt };
}
function rayEll(E, o, d) {
  let ox = o[0] - E.c[0], oy = o[1] - E.c[1], oz = o[2] - E.c[2], dx = d[0], dy = d[1], dz = d[2];
  if (E.tilt) { // rotate about x
    const y1 = oy * E.ct - oz * E.st, z1 = oy * E.st + oz * E.ct; oy = y1; oz = z1;
    const y2 = dy * E.ct - dz * E.st, z2 = dy * E.st + dz * E.ct; dy = y2; dz = z2;
  }
  ox *= E.ir[0]; oy *= E.ir[1]; oz *= E.ir[2]; dx *= E.ir[0]; dy *= E.ir[1]; dz *= E.ir[2];
  const A = dx * dx + dy * dy + dz * dz, B = 2 * (ox * dx + oy * dy + oz * dz), Cc = ox * ox + oy * oy + oz * oz - 1;
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return 0;
  return Math.max(0, (-B + Math.sqrt(disc)) / (2 * A));
}

export function makeHull(F) {
  const cw = F.craniumW, L = F.craniumL;
  const ch = F.child;
  const prims = [
    [ell([0, 93 + 2 * ch, -14], [cw, 102 + 3 * ch, 96 * L]), 0],
    [ell([0, 112 + 3 * ch, -26], [cw + 1.5, 82, 80 * L]), 12],
    [ell([0, 68, -42], [58, 56, 70 * L]), 12],
    [ell([0, 100, -2], [cw - 9, 92, 96]), 12],
    [ell([0, 50, 6], [F.zygW - 2, 50 - 4 * ch, 80]), 12],
    [ell([0, 4 + 3 * ch, 6], [F.gonX + 3, 40 - 4 * ch, 82 - 6 * ch], -18 * DEG), 10],
    [ell([0, F.mentY + 19, 42], [34 * F.chinW + 4, 20.5, 46], -8 * DEG), 8],
  ];
  const nr = F.neckR, ncz = -10;
  const rayNeck = (o, d) => {
    const ox = o[0] / nr, oz = (o[2] - ncz) / (nr * 1.04), dx = d[0] / nr, dz = d[2] / (nr * 1.04);
    const A = dx * dx + dz * dz, B = 2 * (ox * dx + oz * dz), Cc = ox * ox + oz * oz - 1;
    let t = 1e3;
    if (A > 1e-12) { const disc = B * B - 4 * A * Cc; if (disc >= 0) t = (-B + Math.sqrt(disc)) / (2 * A); }
    if (d[1] > 1e-6) t = Math.min(t, (60 - o[1]) / d[1]);
    return Math.max(0, t);
  };
  return (o, d) => {
    let r = rayEll(prims[0][0], o, d);
    for (let i = 1; i < prims.length; i++) r = smax(r, rayEll(prims[i][0], o, d), prims[i][1]);
    return smax(r, rayNeck(o, d), 9);
  };
}

// ------------------------------------------------------------------ frontal relief + nose
const g2 = (a, b) => Math.exp(-(a * a + b * b));
const g1 = (a) => Math.exp(-a * a);

export function makeFace(F) {
  const E = F.E, fem = F.fem, masc = F.masc, old = F.old, ch = F.child;
  // sagittal profile of the face without nose and lips (y -> z)
  const yS = F.slitY, yPg = F.pogY, yMe = F.mentY, ySub = F.subY;
  const fs = F.foreSlope;
  const PY = [yMe - 4, yMe + 2, yPg, (yPg + yS - F.lipL) * 0.5 - 2, yS - F.lipL - 2, yS, yS + F.lipU, (yS + F.lipU + ySub) * 0.5, ySub, ySub + 9, 55, 70, 80, F.nasion[1], 100, 107, 118, 130, 145, 160, 172, 184];
  const pgz = F.pogZ;
  const PZ = [pgz - 26, pgz - 9, pgz, pgz - 3.2 - 0.6 * F.lipProjL, pgz + 0.5, F.subZ - 3.5, F.subZ - 0.5, F.subZ - 0.6, F.subZ - 1.5, F.subZ - 6, 92, 90, 89.5, 90.0, 93.0 + 0.5 * F.glabella, 95.2 + 0.6 * masc, 94.6 - 0.6 * fs, 93 - 2.2 * fs, 89 - 4 * fs, 81 - 5 * fs, 68 - 4 * fs, 50 - 2 * fs];
  // lateral radius of curvature by height
  const profZ = makeSpline(PY, PZ);
  const RY = [yMe, yPg, yS - 10, yS, yS + 12, 32, 48, 60, 72, 85, 100, 116, 135, 160, 185];
  const RC = [24 + 4 * F.chinW + 8 * F.chinSquare, 30 + 6 * F.chinSquare, 32, 33 + 2 * fem, 38, 48, 64, 72, 70, 66, 70, 78, 84, 80, 70];
  // nasolabial curve (x>0 side), alar top -> beside the mouth corner -> below
  const rcF = makeSpline(RY, RC);
  const nlA = [F.alarW + 1.5, ySub + 9], nlB = [F.mouthW + 6.5, yS - 1], nlC = [F.mouthW + 8, yS - 14];
  const mw = F.mouthW;

  // nose: dorsum profile (y -> z) from nasion to the tip, then columella to subnasale
  const yN = F.nasion[1], yT = F.tipY, zT = F.tipZ;
  const br = F.bridge;
  const zN = 90.2 + 1.4 * br + 0.3 * masc;           // sellion depth
  const tipR = F.tipRot * DEG;
  const dorsY = [yT - 1.5, yT + 1.2, yT + 6, yT + 14, (yT + yN) * 0.5 + 4, yN - 6, yN, yN + 7];
  const dorsZ = [zT - 0.6, zT, zT - 1.6, zT - 5.5 - 1.2 * Math.sin(tipR) * 10 * 0.1, lerp(zT - 5.5, zN, 0.42) + F.hump, zN + 1.2, zN, zN + 2.2];
  const NW = [yT - 2, yT + 3, yT + 10, (yT + yN) * 0.5, yN - 6, yN + 4];
  const NWV = [F.tipW * 1.1, F.tipW, F.dorsumW * 1.25, F.dorsumW * 0.95, F.dorsumW * 1.15, F.dorsumW * 1.9];
  const alX = F.alarW - 5.2, alY = ySub + 5.5, alZ = F.subZ - 3.0;
  const alR = [6.2, 6.0 + 0.4 * F.african, 8.5];
  const tipC = [0, yT - 1.0, zT - 6.6], tipRd = [F.tipW * 1.12, 6.8, 6.6];

  const ellZ = (x, y, c, r) => { const a = (x - c[0]) / r[0], b = (y - c[1]) / r[1], q = 1 - a * a - b * b; return q > 0 ? c[2] + r[2] * Math.sqrt(q) : c[2] - 30 * (Math.sqrt(-q + 1) - 1) - 0; };

  function nose(x, y) {
    if (y < ySub - 6 || y > yN + 16) return -1e9;
    const ax = Math.abs(x - F.noseDev * sstep(yN, yT, y));
    // dorsum ridge
    let z = -1e9;
    if (y > yT - 6) {
      const zd = interpS(dorsY, dorsZ, y);
      const w = interpS(NW, NWV, y);
      const u = ax / w;
      z = zd - (u * u * 2.6 + u * u * u * u * 0.9) * (1 + 0.6 * sstep(yN - 10, yN + 8, y));
      z -= 3 * sstep(yN + 2, yN + 16, y);
    }
    // tip lobule (slightly bifid domes)
    const t1 = ellZ(ax, y, [F.tipW * 0.28, tipC[1], tipC[2]], [tipRd[0] * 0.82, tipRd[1], tipRd[2]]);
    z = smax(z, t1, 2.0);
    // columella: ridge from the tip down to subnasale
    if (y < yT + 1 && y > ySub - 1) {
      const f = clamp((y - ySub) / (yT - ySub), 0, 1);
      const zc = lerp(F.subZ + 1.5, zT - 4.5, Math.pow(f, 0.8));
      const wc = 3.4 + 1.2 * f;
      z = smax(z, zc - (ax / wc) * (ax / wc) * 6, 1.5);
    }
    // alae
    const a1 = ellZ(ax, y, [alX, alY, alZ - alR[2] + 3.0], alR);
    z = smax(z, a1, 2.2);
    return z;
  }

  // nasolabial signed distance (lateral > 0) to the fold curve for the x>0 side
  function nlDist(ax, y) {
    // piecewise linear A->B->C
    const seg = (p, q) => {
      const dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy;
      const t = clamp(((ax - p[0]) * dx + (y - p[1]) * dy) / l2, 0, 1);
      const px = p[0] + dx * t, py = p[1] + dy * t;
      const d = Math.hypot(ax - px, y - py);
      const s = (dx * (y - p[1]) - dy * (ax - p[0])) < 0 ? 1 : -1;
      return [d * s, t];
    };
    const r1 = seg(nlA, nlB), r2 = seg(nlB, nlC);
    return Math.abs(r1[0]) < Math.abs(r2[0]) ? [r1[0], r1[1] * 0.75] : [r2[0], 0.75 + 0.25 * r2[1]];
  }

  function base(x, y) {
    const ax = Math.abs(x);
    let z = profZ(y);
    const Rc = rcF(y);
    z -= ax * ax / (2 * Rc) + 0.0000018 * ax * ax * ax * ax * (1 + 2 * sstep(20, -30, y));
    // brow ridge: arc above each orbit + glabella
    const bx = ax - 22, byc = 104.5 + 3.5 * g1((ax - 26) / 14) - 0.004 * bx * bx;
    z += F.browRidge * g1((y - byc) / 5.5) * g1(bx / 20) * (1 - 0.35 * sstep(20, 46, ax));
    z += F.glabella * g2(x / 9, (y - 102) / 6);
    // frontal eminences (softer, younger, female foreheads)
    z += (0.6 + 1.2 * fem + 1.5 * ch) * g2((ax - 24) / 16, (y - 140) / 16);
    // eye sockets: superior sulcus + general orbit recess
    const ex = ax - E[0];
    z -= (1.2 + 1.6 * F.socket) * g2(ex / 15, (y - E[1] - 9) / 7.5);
    z -= (1.0 + 0.6 * F.socket) * g2(ex / 17, (y - E[1] + 1) / 13);
    // tear trough / infraorbital hollow (age)
    {
      const tx = ax - 26, ty = y - (E[1] - 13.5 + 0.18 * (ax - 26));
      z -= (0.3 + 1.2 * old + 0.4 * F.bags) * g2(tx / 9, ty / 2.8);
    }
    // cheekbones
    z += F.malar * g2((ax - 43) / 14, (y - F.malarY) / 10.5);
    z += 0.6 * F.malar * g2((ax - 55) / 10, (y - F.malarY - 2) / 8);
    // buccal hollow
    z -= F.buccal * 1.5 * g2((ax - 46) / 11, (y - 18) / 14);
    // nasolabial fold: cheek mound lateral to a crease
    {
      const [d, t] = nlDist(ax, y);
      const along = sstep(-0.05, 0.15, t) * (1 - sstep(0.8, 1.0, t));
      if (d > 0) z += (0.5 + F.nlf * 0.9 + 0.8 * F.fem * 0) * along * g1((d - 5) / 5.5) * (1 - 0.6 * ch) + 0.4 * along * (1 - Math.exp(-d / 6));
      z -= F.nlf * 0.55 * along * g1(d / 1.3);
    }
    // philtrum columns & groove
    {
      const yt = yS + F.lipU * 0.85, ys = ySub - 1;
      if (y > yt - 2 && y < ys + 1) {
        const f = clamp((y - yt) / (ys - yt), 0, 1);
        const px = lerp(4.6 + 0.4 * F.bow, 3.3, f);
        z += F.philtrum * 0.75 * g1((ax - px) / 1.6) * sstep(-0.05, 0.12, f) * (1 - sstep(0.85, 1.05, f));
        z -= F.philtrum * 0.25 * g1(ax / 2.0) * sstep(0, 0.2, f) * (1 - sstep(0.8, 1, f));
      }
    }
    // modiolus (bump lateral to the mouth corner) and marionette / jowl (age)
    z += (0.5 + 0.3 * F.fem) * g2((ax - mw - 3.5) / 3.5, (y - yS) / 4.5);
    z -= F.marionette * 0.9 * g1((ax - mw - 1.5 - 0.15 * (yS - y)) / 2.0) * sstep(yS, yS - 6, y) * sstep(yPg - 4, yPg + 6, y);
    z += F.jowl * 2.2 * g2((ax - mw - 9) / 7, (y - yPg - 4) / 7);
    // mentolabial sulcus lateral extension + chin pad + cleft
    z += (1.2 + 0.8 * F.chinSquare) * g2(ax / (13 * F.chinW), (y - yPg - 1) / 8.5);
    z -= F.cleft * 0.6 * g2(x / 2.2, (y - yPg) / 4.5);
    // lower-face fat / lip support: keep the region round under the lips
    z += 0.9 * g2(ax / 14, (y - yS + F.lipL + 5) / 4.5) * (0.6 + 0.4 * F.lipProjL / 4);
    return z;
  }

  function face(x0, y0) {
    // continuous everywhere (the root finder needs it): clamp the domain and ramp down outside
    const y = clamp(y0, yMe - 10, 190), x = clamp(x0, -78, 78);
    const out = Math.max(0, yMe - 10 - y0) + Math.max(0, Math.abs(x0) - 78) + Math.max(0, y0 - 190);
    if (out > 0) return base(x, y) - 2 * out;
    let z = base(x, y);
    const nz = nose(x, y);
    if (nz > -1e8) {
      // tight crease at the alar groove, softer at the root and bridge
      const k = lerp(0.8, 3.5, sstep(ySub + 12, yN - 10, y));
      z = smax(z, nz, k);
    }
    return z;
  }
  // authority of the frontal field (1 = face decides, 0 = skull hull decides)
  function mask(x, y) {
    const ax = Math.abs(x);
    const wx = 1 - sstep(34 + 8 * sstep(150, 95, y), 56 + 6 * sstep(150, 95, y), ax);
    const wy = sstep(yMe - 6, yMe + 3, y) * (1 - sstep(165, 185, y));
    return wx * wy;
  }
  return { face, base, nose, nlDist, mask, alar: { x: alX, y: alY, z: alZ, r: alR }, tip: tipC, tipR: tipRd };
}

// ------------------------------------------------------------------ 3D side fields
function makeSide(F) {
  const L = [];
  for (const s of [-1, 1]) {
    L.push({ c: [s * 60, 112, 38], r: [12, 22, 24], a: -F.temple });                         // temporal hollow
    L.push({ c: [s * 63, 62, 22], r: [7, 6, 16], a: 1.4 + 0.4 * F.masc });                  // zygomatic arch
    L.push({ c: [s * (F.gonX - 2), F.gonY + 10, F.gonZ + 6], r: [10, 14, 14], a: 1.4 * F.jawDef });   // masseter / jaw angle
    L.push({ c: [s * 52, 40, -42], r: [10, 18, 12], a: 1.0 });                              // mastoid
    L.push({ curve: [[s * 52, 30, -40], [s * 42, -10, -18], [s * 25, -55, 18], [s * 12, -95, 40]], w: 11, a: (2.4 - 0.9 * F.fem) * (1 - 0.5 * F.child) }); // sternocleidomastoid
  }
  L.push({ c: [0, -62, 46], r: [9, 13, 10], a: F.adam, dir: [0, 0.15, 1] });              // larynx
  L.push({ c: [0, -30, -66], r: [16, 30, 14], a: -1.6 });                                 // nape groove
  L.push({ c: [0, 56, -110], r: [16, 10, 10], a: 1.0 * F.masc });                          // occipital protuberance
  for (const f of L) {
    if (f.curve) {
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const p of f.curve) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k] - f.w); mx[k] = Math.max(mx[k], p[k] + f.w); }
      f.bb = [mn, mx];
    } else f.bb = [[f.c[0] - f.r[0], f.c[1] - f.r[1], f.c[2] - f.r[2]], [f.c[0] + f.r[0], f.c[1] + f.r[1], f.c[2] + f.r[2]]];
  }
  return L;
}
function seg3(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t, p[2] - a[2] - dz * t);
}
function sideDisp(L, p, d) {
  let s = 0;
  for (const f of L) {
    const bb = f.bb;
    if (p[0] < bb[0][0] || p[0] > bb[1][0] || p[1] < bb[0][1] || p[1] > bb[1][1] || p[2] < bb[0][2] || p[2] > bb[1][2]) continue;
    let w;
    if (f.curve) {
      let dd = 1e9; for (let k = 0; k < f.curve.length - 1; k++) dd = Math.min(dd, seg3(p, f.curve[k], f.curve[k + 1]));
      const q = (dd / f.w) ** 2; w = q >= 1 ? 0 : (1 - q) ** 3;
    } else {
      const ax = (p[0] - f.c[0]) / f.r[0], ay = (p[1] - f.c[1]) / f.r[1], az = (p[2] - f.c[2]) / f.r[2];
      const q = ax * ax + ay * ay + az * az; w = q >= 1 ? 0 : (1 - q) ** 3;
    }
    if (w <= 0) continue;
    if (f.dir) { const c = f.dir[0] * d[0] + f.dir[1] * d[1] + f.dir[2] * d[2]; s += f.a * w * Math.max(0.2, c); } else s += f.a * w;
  }
  return s;
}

// ------------------------------------------------------------------ surface along a ray
export function makeSurface(F) {
  const hull = makeHull(F);
  const FC = makeFace(F);
  const side = makeSide(F);
  const C = CEN;
  const P = [0, 0, 0];
  function rayFace(d, t0) {
    if (d[2] < 0.25) return 0;
    // solve C.z + t d.z = face(C.x + t d.x, C.y + t d.y): secant from the guess, bracketing fallback
    const g = (t) => C[2] + t * d[2] - FC.face(C[0] + t * d[0], C[1] + t * d[1]);
    let ta = t0 > 30 && t0 < 175 ? t0 : 100, ga = g(ta);
    let tb = ta - ga / d[2] * 0.7, gb = g(tb);
    for (let it = 0; it < 7; it++) {
      if (Math.abs(gb) < 0.003) return tb;
      const den = gb - ga;
      if (Math.abs(den) < 1e-9) break;
      const tn = tb - gb * (tb - ta) / den;
      if (!(tn > 25 && tn < 185) || Math.abs(tn - tb) > 40) break;
      ta = tb; ga = gb; tb = tn; gb = g(tb);
    }
    if (Math.abs(gb) < 0.01) return tb;
    let a = 30, b = 175;
    ga = g(a); gb = g(b);
    if (ga > 0 || gb < 0) return 0;
    let t = (a + b) * 0.5, side = 0;
    for (let it = 0; it < 30; it++) {
      t = (a * gb - b * ga) / (gb - ga);
      const gt = g(t);
      if (Math.abs(gt) < 0.003) break;
      if (gt > 0) { b = t; gb = gt; if (side === -1) ga *= 0.5; side = -1; } else { a = t; ga = gt; if (side === 1) gb *= 0.5; side = 1; }
    }
    return t;
  }
  // point on the base surface for a ray direction d (unit)
  function point(d, out) {
    const rh = hull(C, d);
    let r = rh;
    if (d[2] > 0.2) {
      const rf = rayFace(d, rh);
      if (rf > 0) {
        // the face is authoritative in its core (it may dent below the skull masses there); toward the
        // sides it is unioned with the hull so the two always meet without a step
        const w = FC.mask(C[0] + rf * d[0], C[1] + rf * d[1]);
        const ru = smax(rh, rf, 7);
        r = lerp(ru, rf, w);
      }
    }
    P[0] = C[0] + r * d[0]; P[1] = C[1] + r * d[1]; P[2] = C[2] + r * d[2];
    r += sideDisp(side, P, d);
    out = out || [0, 0, 0];
    out[0] = C[0] + r * d[0]; out[1] = C[1] + r * d[1]; out[2] = C[2] + r * d[2];
    return out;
  }
  return { point, hull, FC, rayFace };
}

export function dirOf(th, ph, out) {
  out = out || [0, 0, 0];
  const c = Math.cos(ph);
  out[0] = c * Math.sin(th); out[1] = Math.sin(ph); out[2] = c * Math.cos(th);
  return out;
}

// knot heights by |azimuth| (degrees): rows follow features at the front and wrap smoothly around
const KA = [0, 15, 30, 50, 80, 120, 180];
export function knotHeights(F) {
  const E = F.E;
  const yS = F.slitY;
  return {
    bottom: [-90, -90, -90, -90, -90, -90, -90],
    throat: [-57, -57, -56, -52, -48, -52, -55],
    menton: [F.mentY, F.mentY + 1, -38, -30, -24, -36, -36],
    pog: [F.pogY, F.pogY + 1.5, -23, -14, -8, -16, -16],
    lbord: [yS - F.lipL, yS - F.lipL + 0.5, -1, 2, 5, 0, 0],
    mL: [yS, yS, 7, 9, 12, 9, 9],
    mU: [yS + 0.01, yS + 0.01, 8, 10, 13, 10, 10],
    ubord: [yS + F.lipU, yS + F.lipU - 0.5, 14.5, 17, 21, 18, 18],
    sub: [F.subY, F.subY + 0.5, 30, 31, 32, 28, 28],
    tip: [F.tipY, F.tipY + 1, 46, 47, 45, 40, 40],
    eLo: [E[1] - 13, E[1] - 13, E[1] - 13, E[1] - 15, 58, 52, 52],
    eL: [E[1] - 1.5, E[1] - 1.5, E[1] - 1.5, E[1] + 0.5, 71, 64, 64],
    eU: [E[1] - 0.5, E[1] - 0.5, E[1] - 0.5, E[1] + 1.5, 72, 65, 65],
    crease: [E[1] + 11, E[1] + 11, E[1] + 12, E[1] + 11, 88, 80, 80],
    brow: [F.browY + 6, F.browY + 6, F.browY + 7, F.browY + 4, 102, 96, 96],
    fore: [142, 142, 141, 140, 138, 136, 136],
    top: [191, 191, 191, 191, 191, 190, 189],
  };
}
export { KA };
