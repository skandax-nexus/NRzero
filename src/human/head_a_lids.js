// head_a eyelids: the palpebral margin, the lid shell draped over the eyeball and the crease / fold /
// pretarsal roll profiles, in eye-local millimetres (u = lateral, v = up, w = forward from the eyeball
// centre). The mesher (head_a_sculpt.js) builds ring patches from these functions; the lids wrap the
// globe so the eye is never a painted-on disc or a bulging ball. All shapes are our own.
import { clamp, lerp, sstep, interpS } from './head_a_util.js';

const MM = 0.001;
const smaxv = (a, b, k) => { const h = clamp(0.5 + 0.5 * (a - b) / k, 0, 1); return b + (a - b) * h + k * h * (1 - h); };

export function makeEyeLids(F, side) {
  const E = [side * F.eyeX, F.yEye + F.eyeAsym[side > 0 ? 0 : 1], F.eyeZ];
  const R = F.eyeR / MM;
  const fw = F.fissW, fh = F.fissH, lift = F.cantTilt;
  // margin control points, left-eye local mm, loop CCW in (u,v): LC -> upper -> MC -> lower -> LC
  const uLC = 13.4 * fw, uMC = -15.4 * fw;
  const vLC = 0.9 + lift, vMC = -0.6;
  const up = [[uLC, vLC], [11.4 * fw, 2.55 + 0.62 * lift], [8 * fw, 3.95 * fh + 0.32 * lift], [4 * fw, 4.6 * fh + 0.1 * lift], [-0.5 * fw, 4.78 * fh], [-4.8 * fw, 4.5 * fh], [-8.6 * fw, 3.55 * fh], [-11.8 * fw, 2.15 * fh], [-14.1 * fw, 0.55], [uMC, vMC]];
  const lo = [[uMC, vMC], [-14.2 * fw, -1.45], [-11.6 * fw, -3.25 * fh], [-7.6 * fw, -4.85 * fh], [-3 * fw, -5.55 * fh], [1.6 * fw, -5.7 * fh], [6 * fw, -5.2 * fh + 0.1 * lift], [9.6 * fw, -3.8 * fh + 0.3 * lift], [12.0 * fw, -1.3 + 0.65 * lift], [uLC, vLC]];
  const dense = (pts) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 10; k++) {
      const t = k / 10, p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
    out.push(pts[pts.length - 1]);
    return out;
  };
  const upD = dense(up), loD = dense(lo);
  const loop = upD.concat(loD.slice(1, -1));
  const cum = [0];
  for (let i = 1; i <= loop.length; i++) { const a = loop[i - 1], b = loop[i % loop.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const tot = cum[cum.length - 1];
  let Lu = 0; for (let i = 1; i < upD.length; i++) Lu += Math.hypot(upD[i][0] - upD[i - 1][0], upD[i][1] - upD[i - 1][1]);
  const tSplit = Lu / tot;          // param of the medial canthus
  const at = (tl) => {
    const L = (((tl % 1) + 1) % 1) * tot;
    let lo2 = 0, hi = cum.length - 1;
    while (hi - lo2 > 1) { const m = (lo2 + hi) >> 1; if (cum[m] <= L) lo2 = m; else hi = m; }
    const f = (L - cum[lo2]) / Math.max(1e-9, cum[hi] - cum[lo2]);
    const a = loop[lo2 % loop.length], b = loop[hi % loop.length];
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  };
  const tabU = upD.slice().reverse(), tabL = loD.slice();
  const tUx = tabU.map(p => p[0]), tUy = tabU.map(p => p[1]), tLx = tabL.map(p => p[0]), tLy = tabL.map(p => p[1]);
  const vUp = (u) => interpS(tUx, tUy, clamp(u, uMC, uLC));
  const vLo = (u) => interpS(tLx, tLy, clamp(u, uMC, uLC));
  const isUpper = (tl) => { const t = ((tl % 1) + 1) % 1; return t < tSplit; };
  // 1 on the upper lid, 0 on the lower lid, 0.5 at the canthi (smooth)
  const wUp = (tl) => {
    const t = ((tl % 1) + 1) % 1;
    if (t < tSplit) return 0.5 + 0.5 * sstep(0, 0.04, Math.min(t, tSplit - t));
    return 0.5 - 0.5 * sstep(0, 0.04, Math.min(t - tSplit, 1 - t));
  };
  // lid heights (margin -> crease above, margin -> lid/cheek junction below), mm
  const hUp = (u) => Math.max(3.6, F.creaseH * (1 - 0.5 * ((u + 0.5) / 15.5) ** 2));
  const hLo = (u) => Math.max(3.4, (5.6 + 1.6 * F.old) * (1 - 0.45 * ((u - 1.5) / 15) ** 2));
  const hOf = (tl) => { const m = at(tl); const w = wUp(tl); return lerp(hLo(m[0]), hUp(m[0]), w); };

  // ---- globe and shell (front-view heightfields, eye-local mm)
  const zGlobe = (u, v) => { const q = R * R - u * u - v * v; return q > 0 ? Math.sqrt(q) : 0; };
  const zG = (u, v) => zGlobe(u, v) + 1.3 * Math.exp(-(u * u + v * v) / 52); // cornea smeared over the gaze range
  const aL = 14.6 * fw, aM = 19.3 * fw, bU = 17.5, bD = 16.5, c0 = 14.3, w0 = -2.0;
  const zEll = (u, v) => {
    const a = u >= 0 ? aL : aM, b = v >= 0 ? bU : bD;
    const q = 1 - (u / a) ** 2 - (v / b) ** 2;
    return q > 0 ? w0 + c0 * Math.sqrt(q) : w0 - 10 * Math.min(1.5, -q);
  };
  const shell = (u, v) => smaxv(zG(u, v) + 0.3, zEll(u, v), 1.2);

  // margin at state (blink b, smile s); returns [u, v]
  function margin(tl, b = 0, s = 0) {
    const p = at(tl);
    let [u, v] = p;
    const uc = clamp(u, uMC, uLC);
    const vu = vUp(uc), vl = vLo(uc);
    const close = vl + 0.24 * (vu - vl);
    const w = wUp(tl);
    // squint: the lower lid rises (mostly laterally), the upper lid drops a little
    const sqz = s * (0.9 * sstep(-15, -6, u) * (1 - sstep(10, 13.5, u)));
    if (w > 0.5) v += ((close - 0.2) - v) * b * (2 * w - 1) - 0.45 * s * (2 * w - 1);
    else v += (close - v) * 0.1 * b * (1 - 2 * w) + sqz * (1 - 2 * w);
    return [u, v];
  }
  // outward (away from the opening) unit normal of the neutral margin in (u,v)
  function mNormal(tl) {
    const a = at(tl - 0.003), c = at(tl + 0.003);
    const tx = c[0] - a[0], ty = c[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [ty / l, -tx / l];
  }

  // lid surface depth at a patch point. lam = distance from the margin in lid heights, fb = fraction of
  // the way to the patch boundary, wU = upper weight, zFace = face relief depth there (eye-local mm)
  function lidW(u, v, lam, fb, wU, zFace, b = 0, s = 0) {
    const sh = shell(u, v);
    // upper lid: pretarsal skin on the globe, crease, overhanging fold, sulcus
    const Tu = 1.75 + 0.75 * Math.min(lam, 1.4);
    let zu = sh + Tu;
    const Wu = Math.max(sstep(0.95, 1.95, lam), sstep(0.7, 0.97, fb));
    zu = lerp(zu, zFace, Wu);
    const keepU = 1 - sstep(0.75, 0.97, fb);
    zu -= (0.55 + 0.45 * F.old) * Math.exp(-(((lam - 1.0) / 0.11) ** 2)) * (1 - 0.65 * b) * keepU;
    zu += F.hood * Math.exp(-(((lam - 1.26) / 0.24) ** 2)) * (1 - 0.35 * b) * keepU;
    zu -= F.sulcus * Math.exp(-(((lam - 1.75) / 0.35) ** 2)) * keepU;
    // lower lid: margin, pretarsal roll, bags, lid-cheek junction
    const Tl = 1.4 + 0.45 * Math.min(lam, 1.2);
    let zl = sh + Tl;
    const Wl = Math.max(sstep(0.5, 1.55, lam), sstep(0.7, 0.97, fb));
    zl = lerp(zl, zFace, Wl);
    const keepL = 1 - sstep(0.75, 0.97, fb);
    zl += (0.35 + 0.4 * s) * Math.exp(-(((lam - 0.3) / 0.19) ** 2)) * keepL * (1 - 0.6 * F.old);
    zl += F.bags * Math.exp(-(((lam - 0.72) / 0.28) ** 2)) * keepL;
    zl -= (0.15 + 0.7 * F.old) * Math.exp(-(((lam - 1.05) / 0.22) ** 2)) * keepL;
    let z = lerp(zl, zu, wU);
    // never inside the eyeball
    const zg = zG(u, v);
    if (zg > 0) z = Math.max(z, zg + 0.55);
    return z;
  }
  const toWorld = (u, v, w) => [E[0] + side * u * MM, E[1] + v * MM, E[2] + w * MM];
  const toLocal = (p) => [side * (p[0] - E[0]) / MM, (p[1] - E[1]) / MM, (p[2] - E[2]) / MM];
  // sample points spanning the patch region (world), for the grid hole rectangle
  function regionPts(zOf) {
    const pts = [];
    for (const [u, v] of [[-20.5, -16.5], [20.5, -16.5], [-20.5, 20], [20.5, 20], [0, 21], [0, -17.5], [-21, 2], [21, 2], [10, 20.5], [-10, 20.5], [10, -17], [-10, -17]]) {
      const x = E[0] + side * u * MM, y = E[1] + v * MM;
      pts.push([x, y, zOf(x, y)]);
    }
    return pts;
  }
  return {
    E, side, R, uLC, uMC, tSplit, at, margin, mNormal, isUpper, wUp, hOf, shell, zG, zGlobe, lidW, toWorld, toLocal, regionPts,
    caruncle: () => { const u = uMC + 2.2, v = vMC - 0.2; return { p: toWorld(u, v, shell(u, v) - 0.9), r: [1.6 * MM, 1.5 * MM, 1.3 * MM] }; },
  };
}
