// head_a lids: explicit eyelid model draped over the eyeball. The two slit rows of the grid are the
// posterior lid margins (resting on the globe); the rows above / below are the lash line, the tarsal
// plate, the crease, the hooding fold and the lower-lid roll, written as frontal offsets from the margin
// curves and projected onto spheres around the eye centre, then blended into the sculpted socket.
import { clamp, lerp, sstep } from './head_a_util.js';

const DEG = Math.PI / 180;

// rows of the upper lid above the posterior margin: [s offset (fraction of crease height, or mm if
// negative), radial thickness over the globe (mm), blend weight]
function upperRows(F) {
  const c = F.crease, h = F.hood;
  return [
    [0, 0.16, 1], [0.32, 1.0, 1], [0.14 * c + 0.5, 1.42, 1], [0.33 * c + 0.5, 1.62, 1], [0.55 * c + 0.4, 1.70, 1], [0.78 * c + 0.2, 1.62 + 0.1 * h, 1],
    [c, 1.30 + 0.25 * h, 1],                       // crease
    [c + 1.0 + 0.2 * h, 1.85 + 0.85 * h, 1],       // fold
    [c + 2.5 + 0.4 * h, 2.6 + 1.0 * h, 1],
    [c + 4.3 + 0.4 * h, 3.4 + 0.6 * h, 0.85],
    [c + 6.2, 4.0, 0.55],
    [c + 8.4, 4.2, 0.22],
    [c + 10.5, 4.2, 0],
  ];
}
function lowerRows(F) {
  const b = F.bags;
  return [
    [0, 0.16, 1], [0.34, 0.95, 1], [1.15, 1.38, 1], [2.3, 1.62, 1], [3.6, 1.78 + 0.1 * b, 1], [5.1, 2.0 + 0.5 * b, 1],
    [6.9, 2.5 + 1.2 * b, 0.9], [8.9, 3.2 + 1.0 * b, 0.5], [11.0, 3.6, 0],
  ];
}

export function makeEyeModel(F, side) {
  const s = side;
  const R = F.eyeR;
  const ia = side > 0 ? 1 : 0;
  const E = [s * F.E[0], F.E[1] + (side > 0 ? F.eyeAsym[0] : F.eyeAsym[1]), F.E[2]];
  const fw = F.fissW;
  const Xin = -15.4 * fw - 0.6 * F.epicanthus, Xout = 12.7 * fw;
  const Yin = R * Math.sin(F.canthIn * DEG), Yout = Yin + R * Math.sin(F.tilt * DEG) * 0.9;
  const Yup = R * Math.sin(F.lidUp * DEG), Ylo = R * Math.sin(F.lidLo * DEG);
  const peakU = 0.43 - 0.04 * F.fem, peakL = 0.57;
  const aU = Math.log(0.5) / Math.log(peakU), aL = Math.log(0.5) / Math.log(peakL);
  const canth = (X) => lerp(Yin, Yout, clamp((X - Xin) / (Xout - Xin), 0, 1));
  const ycA = canth(Xin + peakU * (Xout - Xin)), ycB = canth(Xin + peakL * (Xout - Xin));
  const HU = Yup - ycA, HL = ycB - Ylo;
  // margin heights (frontal mm, relative to the eye centre)
  function marginU(X) {
    const t = clamp((X - Xin) / (Xout - Xin), 0, 1);
    let sh = Math.pow(Math.sin(Math.PI * Math.pow(t, aU)), 0.78);
    // epicanthic fold flattens the medial upper lid
    sh *= 1 - 0.25 * F.epicanthus * (1 - sstep(0, 0.35, t));
    return canth(X) + HU * sh;
  }
  function marginL(X) {
    const t = clamp((X - Xin) / (Xout - Xin), 0, 1);
    const sh = Math.pow(Math.sin(Math.PI * Math.pow(t, aL)), 0.9);
    return canth(X) - HL * sh;
  }
  // frontal (X, Y) + radial offset t -> head-space point
  function project(X, Y, t, out) {
    const Rr = R + t;
    const rho = Math.hypot(X, Y), rc = 0.965 * Rr;
    let x, y, z;
    if (rho <= rc) { x = X; y = Y; z = Math.sqrt(Rr * Rr - X * X - Y * Y); } else {
      const k = rc / rho;
      x = X; y = Y; z = Rr * Math.sqrt(1 - 0.965 * 0.965) - (rho - rc) * (0.28 + 0.25 * sstep(0, 6, rho - rc)) * (X < 0 ? 1 : 1.25);
      void k;
    }
    out[0] = E[0] + s * x; out[1] = E[1] + y; out[2] = E[2] + z;
    return out;
  }
  const UR = upperRows(F), LR = lowerRows(F);
  return { E, R, Xin, Xout, Yin, Yout, marginU, marginL, project, UR, LR, side, ia, canth };
}

// Apply the lid model to the grid positions (mm). closure: 0 open .. 1 closed.
// colX(i) gives the frontal X for zone columns; base positions are blended at the zone edges.
export function applyLids(F, G, pos, base, EM, closure, extra) {
  const W = G.W;
  const s = EM.side, ia = EM.ia;
  const iIn = G.eyeIn[ia], iOut = G.eyeOut[ia];
  const thIn = G.colTh[iIn], thOut = G.colTh[iOut];
  const rEL = G.rEL, rEU = G.rEU;
  const nU = EM.UR.length, nL = EM.LR.length;
  const out = [0, 0, 0];
  const iMin = Math.min(iIn, iOut), iMax = Math.max(iIn, iOut);
  const span = EM.Xout - EM.Xin;
  const cl = clamp(closure, 0, 1);
  const marg = [];
  for (let i = iMin - 9; i <= iMax + 10; i++) {
    if (i < 0 || i > G.NU) continue;
    const th = G.colTh[i];
    // frontal X along the fissure (lateral positive)
    const a = (th - thIn) / (thOut - thIn);
    let X;
    if (a < 0) X = EM.Xin + a * Math.abs(thOut - thIn) * 1.35;
    else if (a > 1) X = EM.Xout + (a - 1) * Math.abs(thOut - thIn) * 1.25;
    else X = EM.Xin + a * span;
    const inside = a >= 0 && a <= 1;
    const wc = a < 0 ? 1 - sstep(0.0, 6.5, EM.Xin - X) : a > 1 ? 1 - sstep(0.0, 9, X - EM.Xout) : 1;
    if (wc <= 0) continue;
    const taper = inside ? lerp(0.35, 1, sstep(0, 0.14, a) * sstep(1, 0.86, a)) : 0.35;
    let yU = EM.marginU(X), yL = EM.marginL(X);
    if (!inside) { const yc = EM.canth(X); yU = yc + 0.08; yL = yc - 0.08; }
    // closing: upper margin comes down to just above the lower one, lower margin rises a little
    const yClose = yL + 0.55 + 0.12 * (yU - yL);
    const yU2 = lerp(yU, yClose, cl), yL2 = yL + 0.45 * cl * (inside ? 1 : 0);
    const creaseDrop = 2.2 * cl;
    for (let k = 0; k < nU; k++) {
      const j = rEU + k; if (j >= G.NV) break;
      const [so, t0, wr] = EM.UR[k];
      const w = wr * wc;
      if (w <= 0) continue;
      // rows below the crease stretch over the closing lid; fold rows drop a little
      const c = F.crease;
      let Y;
      if (so <= c) { const f = c > 0 ? so / c : 0; Y = lerp(yU2, yU + c - creaseDrop, f); } else Y = yU + so - creaseDrop * Math.max(0, 1 - (so - c) / 7);
      const t = k <= 1 ? t0 * taper + (1 - taper) * 0.16 : t0;
      EM.project(X, Y, t, out);
      const q = (j * W + i) * 3;
      pos[q] = lerp(base[q], out[0], w); pos[q + 1] = lerp(base[q + 1], out[1], w); pos[q + 2] = lerp(base[q + 2], out[2], w);
      if (k === 0 && inside && extra) marg.push([out[0], out[1], out[2]]);
    }
    for (let k = 0; k < nL; k++) {
      const j = rEL - k; if (j < 0) break;
      const [so, t0, wr] = EM.LR[k];
      const w = wr * wc;
      if (w <= 0) continue;
      const Y = yL2 - so * (1 - 0.08 * cl);
      const t = k <= 1 ? t0 * taper + (1 - taper) * 0.16 : t0;
      EM.project(X, Y, t, out);
      const q = (j * W + i) * 3;
      pos[q] = lerp(base[q], out[0], w); pos[q + 1] = lerp(base[q + 1], out[1], w); pos[q + 2] = lerp(base[q + 2], out[2], w);
    }
  }
  return marg;
}
