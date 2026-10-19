// Frontal relief for head_a: the face is sculpted as a heightfield z = M(x, y) on a 0.4 mm raster
// (reference space, meters). Each layer is a landmark-anchored deformation field added over its own
// box and multiplied by a smooth window, so no layer leaves an edge:
//   lofted face shield -> orbits -> brow ridge / glabella / corrugators / temples -> cheekbones, malar fat,
//   buccal hollow, jowls -> lid-cheek junction -> nasolabial folds -> lips (vermilion volumes, Cupid's bow,
//   tubercle, white roll) -> philtrum, commissures, modiolus, mentolabial sulcus, chin -> nose (a smooth
//   height bump: dorsum, tip lobule, alar lobes, columella, alar creases, nostril pockets).
// All shapes are our own.
import { clamp, lerp, sstep, bump, interpS } from './head_a_util.js';

// midline profile / half width / superellipse exponent of the face shield (canonical heights)
const SH_Y = [-0.095, -0.075, -0.058, -0.047, -0.0335, -0.024, -0.012, -0.002, 0.008, 0.020, 0.032, 0.045, 0.058, 0.070, 0.080, 0.090, 0.100, 0.110, 0.122, 0.138, 0.155, 0.172, 0.192, 0.212, 0.25];
const SH_Z = [0.0, 0.026, 0.049, 0.068, 0.0855, 0.0885, 0.0895, 0.0935, 0.0965, 0.0990, 0.0985, 0.0930, 0.0895, 0.0880, 0.0880, 0.0905, 0.0950, 0.0972, 0.0960, 0.0925, 0.0850, 0.0715, 0.0430, 0.0, -0.08];
const SH_W = [0.036, 0.036, 0.042, 0.045, 0.046, 0.0485, 0.052, 0.055, 0.057, 0.060, 0.063, 0.066, 0.069, 0.071, 0.071, 0.070, 0.069, 0.068, 0.067, 0.066, 0.062, 0.054, 0.040, 0.03, 0.02];
const SH_N = [2.0, 2.0, 2.0, 2.05, 2.1, 2.1, 2.05, 2.0, 2.0, 2.05, 2.25, 2.5, 2.7, 2.8, 2.8, 2.6, 2.4, 2.35, 2.35, 2.3, 2.2, 2.1, 2.0, 2.0, 2.0];
// lip profiles: height fraction q (0 = slit, 1 = vermilion border) -> projection fraction
const PU_Q = [0, 0.05, 0.18, 0.36, 0.56, 0.78, 0.94, 1.02, 1.12, 1.4, 2.0];
const PU_V = [-0.22, 0.12, 0.66, 0.95, 1.0, 0.86, 0.66, 0.66, 0.44, 0.12, 0];
const PL_Q = [0, 0.05, 0.2, 0.42, 0.64, 0.86, 1.0, 1.15, 1.4, 1.8];
const PL_V = [-0.22, 0.16, 0.74, 1.0, 0.94, 0.66, 0.38, 0.17, 0.05, 0];

const MM = 0.001;
export const RX0 = -0.084, RY0 = -0.09, RD = 0.0004, RNX = 421, RNY = 741;

// prepared polyline for fast 2D distance queries
function poly(pts) {
  const segs = [];
  let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1]; const l = Math.hypot(dx, dy); segs.push([pts[i][0], pts[i][1], dx, dy, dx * dx + dy * dy, tot, l]); tot += l; }
  return { segs, tot, d: 0, t: 0, side: 1 };
}
function pdist(P, x, y) {
  let best = 1e9, bt = 0, side = 1;
  for (const s of P.segs) {
    let u = ((x - s[0]) * s[2] + (y - s[1]) * s[3]) / s[4];
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const px = s[0] + s[2] * u - x, py = s[1] + s[3] * u - y;
    const d = px * px + py * py;
    if (d < best) { best = d; bt = (s[5] + u * s[6]) / P.tot; side = (s[2] * (y - s[1]) - s[3] * (x - s[0])) >= 0 ? 1 : -1; }
  }
  P.d = Math.sqrt(best); P.t = bt; P.side = side;
  return P;
}

const SE_N0 = 1.9, SE_DN = 0.05, SE_NN = 24, SE_T = 1024;
let SE_LUT = null;
function seLUT() { // (1 - t^n)^(1/n) for n = 1.9 .. 3.05, t in [0, 1]
  if (SE_LUT) return SE_LUT;
  SE_LUT = [];
  for (let q = 0; q < SE_NN; q++) {
    const n = SE_N0 + q * SE_DN, a = new Float32Array(SE_T + 2);
    for (let k = 0; k <= SE_T + 1; k++) { const t = Math.min(1, k / SE_T); a[k] = Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n); }
    SE_LUT.push(a);
  }
  return SE_LUT;
}
const gauss2 = (u, v) => Math.exp(-(u * u + v * v));

export function makeRelief(F) {
  const G = new Float32Array(RNX * RNY);
  const mw = F.mouthW;
  const slitY = (x) => { const u = x / mw; return F.ySlit - F.cornerDrop * u * u + F.slitAsym * u; };
  const bowF = (x) => 1 + F.bow * Math.exp(-(((Math.abs(x) - 0.0056) / 0.0027) ** 2)) - F.bow * 1.2 * Math.exp(-((x / 0.0018) ** 2));
  const tuF = (x) => { const q = 1 - (x / mw) ** 2; return q <= 0 ? 0 : F.tu * bowF(x) * Math.pow(q, 0.42); };
  const tlF = (x) => { const q = 1 - (x / mw) ** 2; return q <= 0 ? 0 : F.tl * Math.pow(q, 0.5); };
  const auF = (x) => { const q = 1 - (x / (mw * 1.02)) ** 2; return q <= 0 ? 0 : F.au * Math.pow(q, 0.75); };
  const alF = (x) => { const q = 1 - (x / (mw * 1.02)) ** 2; const ax = Math.abs(x); return q <= 0 ? 0 : F.al * Math.pow(q, 0.6) * (1 + 0.07 * Math.exp(-(((ax - 0.0075) / 0.0055) ** 2)) - 0.04 * Math.exp(-((x / 0.0025) ** 2))); };
  const wsc = (Y) => Y < 0.03 ? lerp(F.jawW, F.cheekW, sstep(-0.03, 0.03, Y)) : lerp(F.cheekW, F.foreW, sstep(0.07, 0.12, Y));
  const X = (i) => RX0 + i * RD, Yr = (j) => RY0 + j * RD;
  const I = (x) => Math.round((x - RX0) / RD), J = (y) => Math.round((y - RY0) / RD);
  // add fn(ax, x, y) over a box, multiplied by a C1 window that vanishes at the box edges (margin m)
  const field = (x0, x1, y0, y1, m, fn) => {
    const i0 = Math.max(0, I(x0)), i1 = Math.min(RNX - 1, I(x1)), j0 = Math.max(0, J(y0)), j1 = Math.min(RNY - 1, J(y1));
    for (let j = j0; j <= j1; j++) {
      const y = Yr(j);
      const wy = sstep(y0, y0 + m, y) * sstep(y1, y1 - m, y);
      if (wy <= 0) continue;
      for (let i = i0; i <= i1; i++) {
        const x = X(i);
        const w = wy * sstep(x0, x0 + m, x) * sstep(x1, x1 - m, x);
        if (w <= 0) continue;
        G[j * RNX + i] += w * fn(Math.abs(x), x, y);
      }
    }
  };

  // ---------------- 1. lofted shield (per-row tables, superellipse cross-sections from a shared LUT)
  {
    const half = (RNX - 1) / 2;
    const L = seLUT();
    for (let j = 0; j < RNY; j++) {
      const y = Yr(j);
      const Y = interpS(F.yAct, F.yCan, y);
      const z0 = interpS(SH_Y, SH_Z, Y) + F.chinProj * Math.exp(-(((Y + 0.034) / 0.012) ** 2)), hw = interpS(SH_Y, SH_W, Y) * wsc(Y), n = interpS(SH_Y, SH_N, Y);
      const zb = -0.01;
      const nf = clamp((n - SE_N0) / SE_DN, 0, SE_NN - 1.001), ni = nf | 0, nt = nf - ni;
      const ta = L[ni], tb = L[ni + 1];
      for (let i = 0; i <= half; i++) {
        const ax = Math.abs(X(i));
        const t = ax / hw;
        let z;
        if (t < 1) {
          const ft = t * SE_T, k = ft | 0, u = ft - k;
          const fa = ta[k] + (ta[k + 1] - ta[k]) * u, fb = tb[k] + (tb[k + 1] - tb[k]) * u;
          z = zb + (z0 - zb) * (fa + (fb - fa) * nt);
        } else z = zb - (ax - hw) * 3;
        G[j * RNX + i] = z; G[j * RNX + (RNX - 1 - i)] = z;
      }
    }
  }
  // ---------------- 2. orbits: a bowl deeper under the brow and medially, plus the medial canthal recess
  for (const sg of [-1, 1]) {
    const ex = sg * F.eyeX, ey = F.yEye + 0.0018;
    const rx = 0.0205, ry = 0.0168;
    field(ex - rx, ex + rx, ey - ry, ey + ry, 0.001, (ax, x, y) => {
      const dx = (x - ex) / rx, dy = (y - ey) / ry;
      const d2 = dx * dx + dy * dy;
      return d2 < 1 ? -0.0128 * F.socket * bump(d2) * (1 + 0.22 * clamp(dy, -1, 1) - 0.12 * clamp(sg * dx, -1, 1)) : 0;
    });
    const mx = sg * (F.eyeX - 0.0158);
    field(mx - 0.008, mx + 0.008, F.yEye - 0.009, F.yEye + 0.008, 0.001, (ax, x, y) => -0.0024 * F.socket * bump(((x - mx) / 0.0075) ** 2 + ((y - F.yEye + 0.0005) / 0.0082) ** 2));
  }
  // ---------------- 3. brow ridge, glabella, corrugators / procerus, frontal eminences, temporal lines
  const BX = [-0.016, -0.004, 0.0, 0.004, 0.016, 0.030, 0.043, 0.053, 0.060, 0.066, 0.075], BY = [-0.0025, -0.0055, -0.0058, -0.0055, -0.0025, 0, -0.002, -0.008, -0.017, -0.028, -0.045];
  const yB = F.yBrow;
  field(-0.076, 0.076, yB - 0.034, yB + 0.03, 0.006, (ax, x, y) => {
    const by = yB + interpS(BX, BY, ax);
    const sl = (interpS(BX, BY, ax + 0.0005) - interpS(BX, BY, ax - 0.0005)) / 0.001;
    const d = (y - by) / Math.sqrt(1 + sl * sl);
    const tb = clamp(ax / 0.062, 0, 1);
    let dz = F.browAmp * Math.exp(-((d / 0.0064) ** 2)) * (0.55 + 0.45 * Math.sin(Math.PI * clamp(tb * 1.15, 0, 1)));
    dz += F.glabella * gauss2(x / 0.011, (y - yB + 0.005) / 0.009);
    dz += 0.0011 * F.frown * gauss2((ax - 0.0125) / 0.0055, (y - yB - 0.001) / 0.005);
    dz -= 0.0005 * F.frown * gauss2(x / 0.0028, (y - yB - 0.002) / 0.008);
    return dz;
  });
  field(-0.08, 0.08, yB - 0.02, yB + 0.095, 0.008, (ax, x, y) => {
    let dz = 0.0013 * (0.3 + F.fem + F.child) * (gauss2((x - 0.024) / 0.02, (y - yB - 0.036) / 0.02) + gauss2((x + 0.024) / 0.02, (y - yB - 0.036) / 0.02));
    dz -= F.temple * 0.6 * gauss2((ax - 0.064) / 0.010, (y - yB - 0.006) / 0.02);
    return dz;
  });
  // ---------------- 4. cheekbones + malar fat + buccal hollow + jowls (compact bumps)
  field(-0.075, 0.075, F.yPog - 0.02, F.yEye + 0.006, 0.002, (ax, x, y) => {
    const dx = (ax - 0.0445 * F.cheekW) / 0.019, dy = (y - F.yEye + 0.0205) / 0.0135;
    let dz = F.cheekAmp * bump(dx * dx + dy * dy);
    const fx = (ax - 0.031) / 0.016, fy = (y - F.yEye + 0.029) / 0.014;
    dz += (0.0016 + 0.0012 * F.fem + 0.001 * F.child + 0.0006 * F.young - 0.0008 * F.old) * bump(fx * fx + fy * fy);
    const hx = (ax - 0.050 * F.jawW) / 0.014, hy = (y - F.ySlit - 0.022) / 0.017;
    dz -= F.hollow * bump(hx * hx + hy * hy);
    const jx = (ax - 0.036 * F.jawW) / 0.012, jy = (y - F.yPog - 0.002) / 0.011;
    dz += F.jowl * bump(jx * jx + jy * jy);
    return dz;
  });
  // ---------------- 5. lid-cheek junction / tear trough
  const ttP = poly([[0.0165, F.yEye - 0.0085], [0.024, F.yEye - 0.0128], [0.034, F.yEye - 0.0152], [0.045, F.yEye - 0.0142]]);
  field(-0.06, 0.06, F.yEye - 0.03, F.yEye + 0.002, 0.005, (ax, x, y) => {
    if (ax < 0.008) return 0;
    pdist(ttP, ax, y);
    return -(0.0004 + 0.0022 * F.old) * Math.exp(-((ttP.d / 0.0034) ** 2));
  });
  // ---------------- 6. nasolabial folds (crease + cheek fat lateral to it) and marionette lines
  const nW = F.noseW, yS = F.ySub;
  const nlP = poly([[0.0205 * nW + 0.001, yS + 0.0095], [0.0228 * nW + 0.001, yS + 0.002], [0.0262 + 0.0005 * nW, yS - 0.0085], [mw + 0.0055, F.ySlit + 0.004], [mw + 0.0082, F.ySlit - 0.006], [mw + 0.0094, F.ySlit - 0.014]]);
  field(-0.065, 0.065, F.ySlit - 0.03, yS + 0.026, 0.006, (ax, x, y) => {
    if (ax < 0.008) return 0;
    pdist(nlP, ax, y);
    const fade = sstep(0.0, 0.14, nlP.t) * (1 - sstep(0.78, 1.0, nlP.t));
    let dz = -F.nlf * Math.exp(-((nlP.d / 0.0018) ** 2)) * (0.35 + 0.65 * fade);
    if (nlP.side < 0) dz += F.nlBulge * Math.exp(-(((nlP.d - 0.0045) / 0.0048) ** 2)) * fade;
    else dz += 0.0003 * Math.exp(-(((nlP.d - 0.003) / 0.003) ** 2)) * fade;
    return dz;
  });
  if (F.old > 0.05) {
    const mrP = poly([[mw * 1.04, F.ySlit - 0.002], [mw * 1.1, F.ySlit - 0.012], [mw * 1.14, F.ySlit - 0.024]]);
    field(-0.05, 0.05, F.ySlit - 0.035, F.ySlit + 0.006, 0.005, (ax, x, y) => { pdist(mrP, ax, y); return -0.0013 * F.old * Math.exp(-((mrP.d / 0.0019) ** 2)); });
  }
  // ---------------- 7. lips (per-column smooth profiles)
  {
    const i0 = Math.max(0, I(-mw * 1.03)), i1 = Math.min(RNX - 1, I(mw * 1.03));
    for (let i = i0; i <= i1; i++) {
      const x = X(i);
      const sy = slitY(x), tu = tuF(x), tl = tlF(x), au = auF(x), al = alF(x);
      const tub = 1 + 0.16 * Math.exp(-((x / 0.0045) ** 2));
      const j0 = J(sy - 0.024), j1 = J(sy + 0.026);
      for (let j = j0; j <= j1; j++) {
        const y = Yr(j);
        let dz = 0;
        if (y >= sy) { if (tu > 1e-5) { const q = (y - sy) / tu; dz = au * interpS(PU_Q, PU_V, q) * (q < 0.7 ? lerp(tub, 1, q / 0.7) : 1); } } else if (tl > 1e-5) dz = al * interpS(PL_Q, PL_V, (sy - y) / tl);
        G[j * RNX + i] += dz;
      }
    }
  }
  // commissures, modiolus, philtrum, mentolabial sulcus, chin pad
  field(-0.05, 0.05, F.yMent - 0.016, yS + 0.004, 0.004, (ax, x, y) => {
    let dz = 0;
    const cyy = slitY(mw);
    { const dx = (ax - mw * 1.06) / 0.0045, dy = (y - cyy) / 0.0058; dz -= (0.0010 + 0.0006 * F.old) * bump(dx * dx + dy * dy); }
    { const dx = (ax - mw * 0.98) / 0.0035, dy = (y - cyy) / 0.0018; dz -= 0.0006 * bump(dx * dx + dy * dy); }
    { const dx = (ax - mw * 1.2) / 0.0075, dy = (y - cyy + 0.001) / 0.010; dz += 0.0009 * bump(dx * dx + dy * dy); }
    const sy = slitY(x);
    const yb = sy + tuF(0) * 0.98, yt = yS - 0.0008;
    if (y > yb - 0.003 && y < yt + 0.003 && ax < 0.014) {
      const f = clamp((y - yb) / (yt - yb), 0, 1);
      const fade = sstep(-0.25, 0.12, (y - yb) / (yt - yb)) * (1 - sstep(0.85, 1.12, (y - yb) / (yt - yb)));
      const px = lerp(0.0055, 0.0036, f);
      dz += (0.0008 + 0.0002 * F.fem) * Math.exp(-(((ax - px) / 0.0017) ** 2)) * fade;
      dz -= 0.0005 * Math.exp(-((x / 0.0024) ** 2)) * fade;
    }
    const ys = slitY(0) - F.tl - 0.0066;
    { const dx = x / 0.019, dy = (y - ys) / 0.0048; dz -= 0.0012 * bump(dx * dx + dy * dy); }
    const cw = 0.0135 * F.chinW;
    { const cx = x / cw, cy = (y - F.yPog - 0.001) / 0.0128; dz += (0.0016 + F.chinProj * 0.6) * bump(cx * cx + cy * cy); }
    { const cx = (ax - 0.0088 * F.chinW) / 0.0072, cy = (y - F.yPog + 0.0035) / 0.0085; dz += 0.0008 * F.chinSquare * bump(cx * cx + cy * cy); }
    dz -= 0.0004 * F.masc * Math.max(0, F.sh.chin + 0.3) * gauss2(x / 0.0022, (y - F.yPog) / 0.006);
    return dz;
  });

  // ---------------- 8. nose: a smooth height bump h(x,y) added to the face
  const nP = F.noseProj, nB = F.noseBridge;
  const yN = F.yNasion, yT = F.yTip;
  const yRh = lerp(yN, yT, 0.42), ySt = yT + 0.0075;
  const dY = [yT - 0.006, ySt, lerp(ySt, yRh, 0.5), yRh, lerp(yRh, yN, 0.5), yN, yN + 0.012];
  const dH = [21.0 * nP, 19.6 * nP, 16.0 * nP + 1e3 * F.noseHump, 12.0 * lerp(nP, nB, 0.5) + 0.6e3 * F.noseHump, 7.8 * nB, 4.4 * nB, 0].map(v => v * MM);
  const dW = [13.8, 12.6, 10.8, 9.6, 10.6, 12.4, 15].map(v => v * MM * Math.sqrt(nW));
  const dPw = [2.2, 2.5, 3.0, 3.3, 3.0, 2.5, 2.2];
  const tipC = [F.noseDev, yT + 0.0006 - F.tipDroop], tipR = [0.0122 * F.tipW, 0.0112], tipH = 0.0258 * nP;
  const alaC = [0.0118 * nW, yS + 0.0075], alaR = [0.0086 * Math.sqrt(nW), 0.0104], alaH = 0.0074 * Math.sqrt(nP);
  const ca = Math.cos(0.5), sa = Math.sin(0.5);
  const nosC = [0.0068 * nW, yS + 0.0032], nosR = [0.0034 * Math.sqrt(nW), 0.0021];
  const bellP = (t, p) => { const a = Math.abs(t); if (a >= 1) return 0; const q = 1 - Math.pow(a, p); return q * q; };
  // smooth max of non-negative heights; exact when either is zero (no k/4 step at a component's edge)
  const smaxH = (a, b, k) => { const kk = Math.min(k, a, b); if (kk <= 1e-9) return a > b ? a : b; const h = clamp(0.5 + 0.5 * (a - b) / kk, 0, 1); return b + (a - b) * h + kk * h * (1 - h); };
  {
    const j0 = Math.max(0, J(yS - 0.006)), j1 = Math.min(RNY - 1, J(yN + 0.016));
    const i0 = I(-0.032), i1 = I(0.032);
    for (let j = j0; j <= j1; j++) {
      const y = Yr(j);
      const dev = F.noseDev * sstep(yN, yT, y);
      const inD = y > dY[0] && y < dY[6];
      const Hd = inD ? interpS(dY, dH, y) * sstep(dY[0], dY[1], y) : 0, Wd = inD ? interpS(dY, dW, y) : 1, Pd = inD ? interpS(dY, dPw, y) : 2;
      const colF = clamp((y - yS) / (yT - 0.007 - yS), 0, 1);
      for (let i = i0; i <= i1; i++) {
        const x = X(i), xd = x - dev, ax = Math.abs(xd);
        let h = 0;
        if (Hd > 0) h = Hd * bellP(xd / Wd, Pd);
        // tip lobule (flatter on top so the dorsum flows into it)
        { const u = xd / tipR[0], v = (y - tipC[1]) / (y > tipC[1] ? tipR[1] * 1.3 : tipR[1]); const r2 = u * u + v * v; if (r2 < 1) h = smaxH(h, tipH * Math.pow(1 - Math.pow(r2, 1.2), 1.3) + 0.0005 * (gauss2((xd - 0.0042) / 0.0034, (y - tipC[1] - 0.001) / 0.0042) + gauss2((xd + 0.0042) / 0.0034, (y - tipC[1] - 0.001) / 0.0042)), 0.003); }
        // alar lobes
        { const ux = ax - alaC[0], uy = y - alaC[1]; const rx = (ux * ca - uy * sa) / alaR[0], ry = (ux * sa + uy * ca) / alaR[1]; const r2 = rx * rx + ry * ry; if (r2 < 1) h = smaxH(h, alaH * Math.pow(1 - r2, 1.5), 0.005); }
        // columella
        if (y > yS - 0.003 && y < yT) { const hc = lerp(0.0026, tipH * 0.6, Math.pow(colF, 1.15)) * bellP(xd / 0.0044, 2.4) * sstep(yS - 0.003, yS + 0.0015, y); h = smaxH(h, hc, 0.0012); }
        const k = j * RNX + i;
        let z = G[k] + h;
        // alar crease around the top of the ala, alar-facial groove where it meets the cheek
        {
          const ux = ax - alaC[0], uy = y - alaC[1]; const rx = (ux * ca - uy * sa) / (alaR[0] * 0.95), ry = (ux * sa + uy * ca) / (alaR[1] * 0.95);
          const rr = Math.sqrt(rx * rx + ry * ry);
          const sn = ry / (rr || 1);
          z -= (0.00085 + 0.0004 * F.old) * Math.exp(-(((rr - 0.9) / 0.1) ** 2)) * (0.3 + 0.7 * sstep(-0.4, 0.6, sn));
        }
        // nostril pockets
        { const ux = (ax - nosC[0]) / nosR[0], uy = (y - nosC[1]) / nosR[1]; const r2 = ux * ux + uy * uy; if (r2 < 1.6) z -= 0.0040 * sstep(1.5, 0.3, r2); }
        G[k] = z;
      }
    }
  }

  function M0(x, y) { const fx = clamp((x - RX0) / RD, 0, RNX - 1.001), fy = clamp((y - RY0) / RD, 0, RNY - 1.001); const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * RNX + i; return G[k] + (G[k + 1] - G[k]) * tx + (G[k + RNX] - G[k]) * ty + (G[k] - G[k + 1] - G[k + RNX] + G[k + RNX + 1]) * tx * ty; }
  const YT = RY0 + (RNY - 1) * RD, XT = RX0 + (RNX - 1) * RD;
  function M(x, y) {
    let fx = (x - RX0) / RD, fy = (y - RY0) / RD;
    let ext = 0;
    if (fx < 0) { ext += -fx * RD * 3; fx = 0; } else if (fx > RNX - 1.001) { ext += (x - XT) * 3; fx = RNX - 1.001; }
    if (fy < 0) { ext += -fy * RD * 3; fy = 0; } else if (fy > RNY - 1.001) { ext += (y - YT) * 3; fy = RNY - 1.001; }
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * RNX + i;
    const a = G[k], b = G[k + 1], c = G[k + RNX], d = G[k + RNX + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty - ext;
  }
  // point on the relief along the line p + s*d closest to s = 0 (|s| < span); null if none
  function project(p, d, span = 0.012) {
    const g = (s) => p[2] + s * d[2] - M(p[0] + s * d[0], p[1] + s * d[1]);
    const g0 = g(0);
    if (Math.abs(g0) < 1e-7) return [p[0], p[1], p[2]];
    const st = span / 24;
    let a = 0, b = 0, found = false;
    for (let k = 1; k <= 24 && !found; k++) {
      for (const sgn of [1, -1]) {
        const s = sgn * k * st, sp = sgn * (k - 1) * st;
        const gs = g(s), gq = k === 1 ? g0 : g(sp);
        if ((gs > 0) !== (gq > 0)) { a = sp; b = s; found = true; break; }
      }
    }
    if (!found) return null;
    let ga = g(a);
    for (let it = 0; it < 22; it++) { const m = (a + b) * 0.5; const gm = g(m); if ((gm > 0) === (ga > 0)) { a = m; ga = gm; } else b = m; }
    const s = (a + b) * 0.5;
    return [p[0] + s * d[0], p[1] + s * d[1], p[2] + s * d[2]];
  }
  // where the relief replaces the skull: the frontal face, fading out before the shield's steep side walls
  const hwAt = (y) => { const Y = interpS(F.yAct, F.yCan, y); return interpS(SH_Y, SH_W, Y) * wsc(Y); };
  function mask(x, y) {
    if (y > 0.19 || y < F.yMent - 0.03) return 0;
    const hw = hwAt(y);
    const ax = Math.abs(x);
    if (ax > hw - 0.004) return 0;
    return (1 - sstep(hw - 0.017, hw - 0.004, ax)) * sstep(F.yMent - 0.03, F.yMent - 0.012, y) * (1 - sstep(0.158, 0.184, y));
  }
  const zTip = M0(0, yT), zSub = M0(0, yS);
  return { M, G, project, mask, hwAt, slitY, tuF, tlF, auF, alF, ala: { x: alaC[0], y: alaC[1] }, tip: { c: [tipC[0], tipC[1], zTip], r: tipR }, zSub, zTip, nostril: { c: nosC, r: nosR } };
}
