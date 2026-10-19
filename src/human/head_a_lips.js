// head_a lips: explicit lip model. The mouth slit rows are the inner contact lines of the upper and lower
// lip; the rows outward of them follow a sagittal lip profile (wet inner roll, vermilion bulge, white
// roll at the vermilion border) whose height and projection vary across the mouth (Cupid's bow,
// tubercle, tapering commissures), blended into the sculpted face beyond the border.
import { clamp, lerp, sstep } from './head_a_util.js';

const g1 = (a) => Math.exp(-a * a);

// row tables: [sigma (0 contact .. 1 vermilion border) or extra mm beyond the border when > 1, weight]
const UP = [[0, 1], [0.07, 1], [0.19, 1], [0.36, 1], [0.56, 1], [0.78, 1], [1, 1], [1 + 1.6, 0.92], [1 + 3.6, 0.62], [1 + 6.0, 0.3], [1 + 8.5, 0.08], [1 + 10, 0]];
const LO = [[0, 1], [0.07, 1], [0.18, 1], [0.33, 1], [0.5, 1], [0.67, 1], [0.84, 1], [1, 1], [1 + 1.8, 0.88], [1 + 4.0, 0.58], [1 + 6.6, 0.26], [1 + 9, 0.05], [1 + 11, 0]];

export function makeMouthModel(F, FC) {
  const mw = F.mouthW, yS = F.slitY;
  const bow = F.bow;
  const Hu = (a) => {
    const b = Math.abs(a);
    const base = 1 - 0.86 * Math.pow(b, 2.1);
    const peaks = 0.07 * bow * g1((b - 0.2) / 0.1) - 0.09 * bow * g1(a / 0.075);
    return Math.max(0.1, base + peaks);
  };
  const Hl = (a) => Math.max(0.1, 1 - 0.88 * Math.pow(Math.abs(a), 1.9));
  const Pu = (a) => 1 - 0.92 * Math.pow(Math.abs(a), 1.7);
  const Pl = (a) => 1 - 0.94 * Math.pow(Math.abs(a), 1.5);
  const contactY = (a) => yS - F.cornerDrop * Math.pow(Math.abs(a), 3) + F.slitAsym * a * 0.6 - 0.45 * g1(a / 0.2);
  const contactZ = (X, Y, a) => FC.base(X, Y) - 0.5 - 1.1 * sstep(0.75, 1.0, Math.abs(a));
  const bulgeU = (sg) => Math.pow(Math.sin(Math.PI * Math.pow(sg, 0.72)), 0.75) * (1 - 0.12 * sg) + 0.13 * g1((sg - 0.95) / 0.07);
  const bulgeL = (sg) => Math.pow(Math.sin(Math.PI * Math.pow(sg, 0.85)), 0.7) + 0.07 * g1((sg - 0.95) / 0.07);
  return { mw, yS, Hu, Hl, Pu, Pl, contactY, contactZ, bulgeU, bulgeL };
}

// open: 0..1 lip parting (the jaw rotation is applied separately); smile 0..1
export function applyLips(F, G, FC, pos, base, MM, open = 0, smile = 0) {
  const W = G.W;
  const [iL, iR] = G.mouthC;
  const thC = G.colTh[iR];
  const rML = G.rML, rMU = G.rMU;
  const ctr = [];
  for (let i = iL - 8; i <= iR + 8; i++) {
    const th = G.colTh[i];
    const a = th / thC;
    const b = Math.abs(a);
    const inside = b <= 1;
    const X = inside ? a * MM.mw : Math.sign(a) * (MM.mw + (b - 1) * thC * 1.55);
    const wc = inside ? 1 : 1 - sstep(0, 0.42, b - 1);
    if (wc <= 0) continue;
    const ac = clamp(a, -1, 1);
    const yc = MM.contactY(ac) + (inside ? 0 : -F.cornerDrop * 0.3 * (b - 1));
    const zc = MM.contactZ(X, yc, ac);
    // parting: the upper contact line lifts and rolls out, the lower one drops (before jaw rotation)
    const part = open * (1 - 0.85 * b * b) * (inside ? 1 : 0);
    // smile pulls the corners up and back
    const sm = smile * Math.pow(b, 1.6);
    const ycU = yc + part * 1.6 + sm * 3.2, ycL = yc - part * 0.8 + sm * 2.6;
    const hu = F.lipU * MM.Hu(ac) * (1 - 0.18 * smile * (1 - b)), hl = F.lipL * MM.Hl(ac) * (1 - 0.12 * smile);
    const ybU = yc + hu + sm * 2.6, ybL = yc - hl + sm * 1.6;
    const zbU = FC.base(X, ybU) + sm * -1.2, zbL = FC.base(X, ybL) - sm * 1.0;
    const pu = F.lipProjU * MM.Pu(ac) * (1 - 0.25 * smile), pl = F.lipProjL * MM.Pl(ac) * (1 - 0.15 * smile);
    const zcS = zc - sm * 2.4 + part * 0.6;
    for (let k = 0; k < UP.length; k++) {
      const j = rMU + k;
      const [sg, wr] = UP[k];
      const w = wr * wc;
      if (w <= 0) continue;
      let x = X, y, z;
      if (sg <= 1) {
        const yy = lerp(ycU, ybU, Math.pow(sg, 1.08));
        y = yy;
        z = lerp(zcS, zbU, sg) + pu * MM.bulgeU(sg) - part * 1.2 * (1 - sg) * (1 - sg);
        if (!inside) { y = lerp(ycU, ycU + 1.1, sg); z = zcS + 0.6 * sg; }
      } else {
        y = ybU + (sg - 1) * (inside ? 1 : 0.6) + (inside ? 0 : 1.1);
        z = FC.base(x, y);
      }
      const q = (j * W + i) * 3;
      pos[q] = lerp(base[q], x, w); pos[q + 1] = lerp(base[q + 1], y, w); pos[q + 2] = lerp(base[q + 2], z, w);
    }
    for (let k = 0; k < LO.length; k++) {
      const j = rML - k;
      const [sg, wr] = LO[k];
      const w = wr * wc;
      if (w <= 0) continue;
      let x = X, y, z;
      if (sg <= 1) {
        y = lerp(ycL, ybL, Math.pow(sg, 1.05));
        z = lerp(zcS, zbL, sg) + pl * MM.bulgeL(sg) - part * 1.0 * (1 - sg) * (1 - sg);
        if (!inside) { y = lerp(ycL, ycL - 1.1, sg); z = zcS + 0.6 * sg; }
      } else {
        y = ybL - (sg - 1) * (inside ? 1 : 0.6) - (inside ? 0 : 1.1);
        z = FC.base(x, y);
      }
      const q = (j * W + i) * 3;
      pos[q] = lerp(base[q], x, w); pos[q + 1] = lerp(base[q + 1], y, w); pos[q + 2] = lerp(base[q + 2], z, w);
    }
    if (inside) ctr.push(i);
  }
  return ctr;
}
