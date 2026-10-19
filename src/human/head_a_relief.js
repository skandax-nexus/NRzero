// Frontal relief for head_a: the face is sculpted as a heightfield z = M(x, y) on a 0.4 mm raster.
// Layers (each a landmark-anchored deformation field accumulated over its own bounding box):
// lofted face shield -> eye sockets -> brow ridge -> cheekbones / malar fat -> tear troughs -> nasolabial
// folds -> alar creases -> lips (vermilion volumes, Cupid's bow, white roll) -> philtrum -> sulcus / chin
// -> aging folds; then the nose (dorsum, tip lobule, alae, columella, sills) joined by smooth union.
import { clamp, lerp, sstep, smax, bump, interpS } from './head_a_util.js';

const SH_Y = [-0.075, -0.058, -0.046, -0.036, -0.024, -0.012, -0.002, 0.008, 0.020, 0.032, 0.045, 0.058, 0.070, 0.080, 0.090, 0.100, 0.110, 0.122, 0.138, 0.155, 0.172, 0.192];
const SH_Z = [0.030, 0.052, 0.071, 0.087, 0.0935, 0.0920, 0.0975, 0.0995, 0.1022, 0.1012, 0.0935, 0.0895, 0.0880, 0.0880, 0.0905, 0.0955, 0.0970, 0.0955, 0.0915, 0.0840, 0.0715, 0.0480];
const SH_W = [0.035, 0.040, 0.044, 0.046, 0.048, 0.052, 0.055, 0.057, 0.060, 0.063, 0.066, 0.069, 0.071, 0.071, 0.070, 0.069, 0.068, 0.067, 0.066, 0.063, 0.058, 0.046];
const SH_N = [2.0, 2.0, 2.1, 2.2, 2.2, 2.1, 2.0, 2.0, 2.1, 2.3, 2.5, 2.7, 2.8, 2.8, 2.6, 2.4, 2.4, 2.4, 2.3, 2.2, 2.1, 2.0];
const PU_Q = [0, 0.08, 0.22, 0.42, 0.62, 0.84, 0.98, 1.06, 1.2, 1.5, 2.2];
const PU_V = [-0.5, 0.0, 0.6, 0.95, 1.0, 0.84, 0.6, 0.66, 0.4, 0.08, 0];
const PL_Q = [0, 0.08, 0.22, 0.42, 0.64, 0.86, 1.0, 1.12, 1.35, 1.7];
const PL_V = [-0.5, 0.05, 0.7, 1.0, 0.94, 0.66, 0.36, 0.16, 0.04, 0];

export const RX0 = -0.08, RY0 = -0.085, RD = 0.0004, RNX = 401, RNY = 726;

function q1(xs, ys, x) { // smoothstep-interpolated table
  if (x <= xs[0]) return ys[0];
  const n = xs.length;
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = 1; while (xs[i] < x) i++;
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + (ys[i] - ys[i - 1]) * t * t * (3 - 2 * t);
}
// prepared polyline for fast 2D distance queries
function poly(pts) {
  const segs = [];
  let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1]; const l = Math.hypot(dx, dy); segs.push([pts[i][0], pts[i][1], dx, dy, dx * dx + dy * dy, tot, l]); tot += l; }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return { segs, tot, bb: [x0, x1, y0, y1], d: 0, t: 0, side: 1 };
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

export function makeRelief(F) {
  const G = new Float32Array(RNX * RNY);
  const mw = F.mouthW;
  const slitY = (x) => { const u = x / mw; return F.ySlit - F.cornerDrop * u * u + F.slitAsym * u; };
  const bowF = (x) => 1 + F.bow * Math.exp(-(((Math.abs(x) - 0.0053) / 0.0024) ** 2)) - F.bow * 1.3 * Math.exp(-((x / 0.0016) ** 2));
  const tuF = (x) => { const q = 1 - (x / mw) ** 2; return q <= 0 ? 0 : F.tu * bowF(x) * Math.pow(q, 0.55); };
  const tlF = (x) => { const q = 1 - (x / mw) ** 2; return q <= 0 ? 0 : F.tl * Math.pow(q, 0.5); };
  const auF = (x) => { const q = 1 - (x / (mw * 1.02)) ** 2; return q <= 0 ? 0 : F.au * Math.pow(q, 0.85); };
  const alF = (x) => { const q = 1 - (x / (mw * 1.02)) ** 2; return q <= 0 ? 0 : F.al * Math.pow(q, 0.75); };
  const wsc = (Y) => Y < 0.03 ? lerp(F.jawW, F.cheekW, sstep(-0.03, 0.03, Y)) : lerp(F.cheekW, F.foreW, sstep(0.07, 0.12, Y));
  const X = (i) => RX0 + i * RD, Yr = (j) => RY0 + j * RD;
  const I = (x) => Math.round((x - RX0) / RD), J = (y) => Math.round((y - RY0) / RD);
  const forBox = (x0, x1, y0, y1, fn) => {
    const i0 = Math.max(0, I(x0)), i1 = Math.min(RNX - 1, I(x1)), j0 = Math.max(0, J(y0)), j1 = Math.min(RNY - 1, J(y1));
    for (let j = j0; j <= j1; j++) { const y = Yr(j); for (let i = i0; i <= i1; i++) fn(i, j, X(i), y, j * RNX + i); }
  };

  // ---------------- 1. lofted shield (per-row tables)
  for (let j = 0; j < RNY; j++) {
    const y = Yr(j);
    const Y = interpS(F.yAct, F.yCan, y);
    const z0 = interpS(SH_Y, SH_Z, Y), hw = interpS(SH_Y, SH_W, Y) * wsc(Y), n = interpS(SH_Y, SH_N, Y), inv = 1 / n;
    const zb = -0.01;
    const half = (RNX - 1) / 2;
    for (let i = 0; i <= half; i++) {
      const ax = Math.abs(X(i));
      const t = ax / hw;
      const z = t < 1 ? zb + (z0 - zb) * Math.pow(1 - Math.pow(t, n), inv) : zb - (ax - hw) * 3;
      G[j * RNX + i] = z; G[j * RNX + (RNX - 1 - i)] = z;
    }
  }
  // ---------------- 2. eye sockets
  for (const sg of [-1, 1]) {
    const ex = sg * F.eyeX;
    forBox(ex - 0.0195, ex + 0.0195, F.yEye + 0.0015 - 0.0152, F.yEye + 0.0015 + 0.0152, (i, j, x, y, k) => {
      const dx = (x - ex) / 0.0195, dy = (y - F.yEye - 0.0015) / 0.0152;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1) G[k] -= 0.0135 * F.socketDepth * bump(d2) * (1 + 0.25 * clamp(dy, -1, 1) - 0.15 * clamp(sg * dx, -1, 1));
    });
  }
  // ---------------- 3. brow ridge, glabella, frontal eminences
  const browP = poly([[0.004, F.yBrow - 0.005], [0.016, F.yBrow - 0.0022], [0.030, F.yBrow], [0.044, F.yBrow - 0.0022], [0.054, F.yBrow - 0.0085], [0.0605, F.yBrow - 0.0175]]);
  forBox(-0.075, 0.075, F.yBrow - 0.035, F.yBrow + 0.06, (i, j, x, y, k) => {
    const ax = Math.abs(x);
    let dz = 0;
    if (y < F.yBrow + 0.018 && ax < 0.072) {
      pdist(browP, ax, y);
      dz += F.browAmp * Math.exp(-((browP.d / 0.0062) ** 2)) * (0.6 + 0.4 * Math.sin(Math.PI * clamp(browP.t * 1.2, 0, 1)));
      dz += F.glabella * Math.exp(-((x / 0.010) ** 2 + ((y - F.yBrow + 0.006) / 0.008) ** 2));
    }
    dz += 0.0012 * (0.3 + F.fem + F.child) * Math.exp(-(((ax - 0.024) / 0.02) ** 2 + ((y - F.yBrow - 0.034) / 0.02) ** 2));
    G[k] += dz;
  });
  // ---------------- 4. cheekbones + malar fat + buccal hollow + jowls
  forBox(-0.07, 0.07, F.yPog - 0.015, F.yEye - 0.002, (i, j, x, y, k) => {
    const ax = Math.abs(x);
    const dx = (ax - 0.043 * F.cheekW) / 0.019, dy = (y - F.yEye + 0.0195) / 0.0135;
    let dz = F.cheekAmp * bump(dx * dx + dy * dy);
    const fx = (ax - 0.032) / 0.016, fy = (y - F.yEye + 0.028) / 0.014;
    dz += (0.0016 + 0.0012 * F.fem + 0.001 * F.child - 0.0008 * F.old) * bump(fx * fx + fy * fy);
    const hx = (ax - 0.049 * F.jawW) / 0.014, hy = (y - F.ySlit - 0.024) / 0.016;
    dz -= F.hollow * bump(hx * hx + hy * hy);
    const jx = (ax - 0.035 * F.jawW) / 0.012, jy = (y - F.yPog - 0.002) / 0.011;
    dz += F.jowl * bump(jx * jx + jy * jy);
    G[k] += dz;
  });
  // ---------------- 5. tear troughs
  const ttP = poly([[0.0165, F.yEye - 0.0085], [0.024, F.yEye - 0.0128], [0.034, F.yEye - 0.0152], [0.045, F.yEye - 0.0142]]);
  forBox(-0.055, 0.055, F.yEye - 0.026, F.yEye - 0.002, (i, j, x, y, k) => {
    const ax = Math.abs(x); if (ax < 0.009) return;
    pdist(ttP, ax, y);
    G[k] -= (0.0005 + 0.0022 * F.old) * Math.exp(-((ttP.d / 0.0032) ** 2));
  });
  // ---------------- 6. nasolabial folds, alar creases, marionette lines
  const nW = F.noseW, yS = F.ySub;
  const ala = { y: yS + 0.0062, z: 0.0952 + 0.003 * (F.noseProj - 1), x: 0.0152 * nW, r: [0.0072 * Math.sqrt(nW), 0.0068, 0.0086] };
  const nlP = poly([[0.0198 * nW + 0.0008, yS + 0.0135], [0.0222 * nW + 0.001, yS + 0.004], [0.0262 + 0.0005 * nW, yS - 0.008], [mw + 0.0058, F.ySlit + 0.0045], [mw + 0.0088, F.ySlit - 0.0055], [mw + 0.0098, F.ySlit - 0.012]]);
  forBox(-0.06, 0.06, F.ySlit - 0.022, yS + 0.022, (i, j, x, y, k) => {
    const ax = Math.abs(x); if (ax < 0.01) return;
    pdist(nlP, ax, y);
    const fade = sstep(0.0, 0.12, nlP.t) * (1 - sstep(0.8, 1.0, nlP.t));
    let dz = -F.nlf * Math.exp(-((nlP.d / 0.0017) ** 2)) * (0.4 + 0.6 * fade);
    if (nlP.side < 0) dz += F.nlBulge * Math.exp(-(((nlP.d - 0.0042) / 0.0045) ** 2)) * fade;
    else dz += 0.0004 * Math.exp(-(((nlP.d - 0.003) / 0.003) ** 2)) * fade;
    G[k] += dz;
  });
  const alP = poly([[ala.x - 0.002, ala.y + 0.0072], [ala.x + 0.0045, ala.y + 0.0035], [ala.x + 0.0072, ala.y - 0.0015], [ala.x + 0.0062, ala.y - 0.0055], [ala.x + 0.0035, yS - 0.0005]]);
  forBox(-0.03, 0.03, yS - 0.006, ala.y + 0.012, (i, j, x, y, k) => {
    const ax = Math.abs(x); if (ax < 0.008) return;
    pdist(alP, ax, y);
    G[k] -= (0.0011 + 0.0004 * F.old) * Math.exp(-((alP.d / 0.0011) ** 2));
  });
  if (F.old > 0.05) {
    const mrP = poly([[mw * 1.04, F.ySlit - 0.002], [mw * 1.1, F.ySlit - 0.012], [mw * 1.14, F.ySlit - 0.024]]);
    forBox(-0.05, 0.05, F.ySlit - 0.03, F.ySlit + 0.002, (i, j, x, y, k) => {
      pdist(mrP, Math.abs(x), y);
      G[k] -= 0.0013 * F.old * Math.exp(-((mrP.d / 0.0019) ** 2));
    });
  }
  // ---------------- 7. lips (per-column tables)
  {
    const i0 = Math.max(0, I(-mw * 1.03)), i1 = Math.min(RNX - 1, I(mw * 1.03));
    for (let i = i0; i <= i1; i++) {
      const x = X(i);
      const sy = slitY(x), tu = tuF(x), tl = tlF(x), au = auF(x), al = alF(x);
      const j0 = J(sy - 0.022), j1 = J(sy + 0.025);
      for (let j = j0; j <= j1; j++) {
        const y = Yr(j);
        let dz = 0;
        if (y >= sy) { if (tu > 1e-5) dz = au * q1(PU_Q, PU_V, (y - sy) / tu); }
        else if (tl > 1e-5) dz = al * q1(PL_Q, PL_V, (sy - y) / tl);
        G[j * RNX + i] += dz;
      }
    }
  }
  // commissure / modiolus, philtrum, sulcus, chin
  forBox(-0.045, 0.045, F.yPog - 0.02, yS + 0.003, (i, j, x, y, k) => {
    const ax = Math.abs(x);
    let dz = 0;
    const cyy = slitY(mw);
    { const dx = (ax - mw * 1.07) / 0.0045, dy = (y - cyy) / 0.0058; dz -= (0.0009 + 0.0006 * F.old) * bump(dx * dx + dy * dy); }
    { const dx = (ax - mw * 0.98) / 0.0035, dy = (y - cyy) / 0.0018; dz -= 0.0006 * bump(dx * dx + dy * dy); }
    const sy = slitY(x);
    const yb = sy + tuF(0) * 1.02, yt = yS - 0.0012;
    if (y > yb - 0.002 && y < yt + 0.002 && ax < 0.012) {
      const f = clamp((y - yb) / (yt - yb), 0, 1);
      const fade = sstep(-0.15, 0.1, f) * (1 - sstep(0.9, 1.1, f));
      const px = lerp(0.0054, 0.0039, f);
      dz += (0.00075 + 0.0002 * F.fem) * Math.exp(-(((ax - px) / 0.0015) ** 2)) * fade;
      dz -= 0.00045 * Math.exp(-((x / 0.0022) ** 2)) * fade;
    }
    const ys = slitY(0) - F.tl - 0.0062;
    { const dx = x / 0.017, dy = (y - ys) / 0.0042; dz -= 0.0011 * bump(dx * dx + dy * dy); }
    { const cx = x / (0.0135 * F.chinW), cy = (y - F.yPog - 0.001) / 0.012; dz += (0.0014 + F.chinProj * 0.7) * bump(cx * cx + cy * cy); }
    dz -= 0.0004 * F.masc * Math.max(0, F.sh.chin + 0.3) * Math.exp(-((x / 0.0022) ** 2 + ((y - F.yPog) / 0.006) ** 2));
    G[k] += dz;
  });

  // ---------------- 8. nose (smooth union)
  const nP = F.noseProj, nB = F.noseBridge;
  const zBase = 0.0885;
  const yN = F.yNasion, yT = F.yTip;
  const yd = [yT + 0.0075, lerp(yN, yT, 0.75), lerp(yN, yT, 0.5), lerp(yN, yT, 0.25), yN, yN + 0.010];
  const hd0 = [0.0245, 0.0200, 0.0140, 0.0080, 0.0030, 0.0068];
  const hd = hd0.map((h, i) => h * (i >= 4 ? nB : lerp(nP, nB, i / 4)) + (i === 2 ? F.noseHump : 0));
  const bd = [0.0068, 0.0060, 0.0056, 0.0058, 0.0068, 0.0085].map((b, i) => b * Math.sqrt(nW) * (i >= 4 ? 1 + 0.15 * (1 - nB) : 1));
  const sd = [1.3, 1.35, 1.3, 1.2, 1.0, 0.55];
  const zTip = zBase + 0.0322 * nP - F.tipDroop * 0.5;
  const tip = { c: [F.noseDev, yT + 0.0004 - F.tipDroop, zTip - 0.0118], r: [0.0112 * nW, 0.0102, 0.0118] };
  const zSub = 0.1024 + 0.0012 * (nP - 1);
  const ellipH = (x, y, c, r) => { const q = 1 - ((x - c[0]) / r[0]) ** 2 - ((y - c[1]) / r[1]) ** 2; return q <= 0 ? -1 : c[2] + r[2] * Math.sqrt(q); };
  {
    const j0 = Math.max(0, J(yS - 0.004)), j1 = Math.min(RNY - 1, J(yN + 0.014));
    const i0 = I(-0.03), i1 = I(0.03);
    for (let j = j0; j <= j1; j++) {
      const y = Yr(j);
      const dev = F.noseDev * sstep(yN, yT, y);
      const hasD = y > yT - 0.002;
      let h = 0, b = 1, a = 0, fadeTop = 0;
      if (hasD) { const yy = clamp(y, yd[0], yd[5]); h = interpS(yd, hd, yy); b = interpS(yd, bd, yy); a = interpS(yd, sd, yy) * b; fadeTop = 0.012 * sstep(yd[5] - 0.004, yd[5] + 0.004, y); }
      const colF = clamp((y - yS) / (yT - 0.0065 - yS), 0, 1.3);
      for (let i = i0; i <= i1; i++) {
        const x = X(i), xd = x - dev;
        let z = -1;
        if (hasD) z = zBase + h - a * (Math.sqrt(1 + (xd / b) ** 2) - 1) - fadeTop;
        const zt = ellipH(xd, y, tip.c, tip.r);
        if (zt > -1) {
          const dome = 0.0005 * (Math.exp(-(((xd - 0.0042) / 0.003) ** 2 + ((y - tip.c[1] - 0.0005) / 0.004) ** 2)) + Math.exp(-(((xd + 0.0042) / 0.003) ** 2 + ((y - tip.c[1] - 0.0005) / 0.004) ** 2)));
          z = smax(z, zt + dome, 0.002);
        }
        for (let sg = -1; sg <= 1; sg += 2) { const za = ellipH(xd, y, [sg * ala.x, ala.y, ala.z], ala.r); if (za > -1) z = smax(z, za, 0.0016); }
        if (y > yS - 0.002 && y < yT - 0.002 && Math.abs(xd) < 0.006) z = smax(z, lerp(zSub, zTip - 0.0072, colF) - 0.0022 * (xd / 0.0034) ** 2, 0.0012);
        if (y > yS - 0.003 && y < yT && Math.abs(xd) < 0.021 * nW) z = smax(z, zSub + (y - yS) * 0.9 - 0.004 * (xd / (0.02 * nW)) ** 4 - 0.0006, 0.0015);
        if (z > -1) { const k = j * RNX + i; G[k] = smax(G[k], z, 0.0022); }
      }
    }
  }

  function M(x, y) {
    const fx = (x - RX0) / RD, fy = (y - RY0) / RD;
    if (fx < 0 || fy < 0 || fx >= RNX - 1 || fy >= RNY - 1) return -1;
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * RNX + i;
    const a = G[k], b = G[k + 1], c = G[k + RNX], d = G[k + RNX + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  return { M, G, slitY, tuF, tlF, auF, alF, ala, tip, zSub, zTip };
}
