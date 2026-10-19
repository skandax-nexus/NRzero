// Face specification for head_a: turns createHead() params into concrete anatomical
// measurements (reference space = adult male, meters; the whole head is scaled by S at the end).
import { clamp, sstep, mulberry32 } from './head_a_util.js';

const DEF_SHAPE = { jaw: 0, cheek: 0, nose: 0, noseWidth: 0, lips: 0, brow: 0, eyeSize: 0, faceLength: 0, chin: 0 };
const DEF_MARKS = { scar: false, freckles: 0, wrinkles: 0, stubble: 0 };

export function normParams(p = {}) {
  const sh = { ...DEF_SHAPE };
  for (const k in DEF_SHAPE) if (p.shape && Number.isFinite(+p.shape[k])) sh[k] = clamp(+p.shape[k], -1, 1);
  const mk = { ...DEF_MARKS, ...(p.marks || {}) };
  mk.scar = !!mk.scar; mk.freckles = clamp(+mk.freckles || 0, 0, 1); mk.wrinkles = clamp(+mk.wrinkles || 0, 0, 1); mk.stubble = clamp(+mk.stubble || 0, 0, 1);
  return {
    sex: clamp(Number.isFinite(+p.sex) ? +p.sex : 0, 0, 1),
    age: clamp(Number.isFinite(+p.age) ? +p.age : 32, 8, 80),
    skin: Number.isFinite(+p.skin) ? (+p.skin) & 0xffffff : 0xc08a6a,
    eyeColor: Number.isFinite(+p.eyeColor) ? (+p.eyeColor) & 0xffffff : 0x3d2a18,
    seed: (Number.isFinite(+p.seed) ? +p.seed : 1) | 0,
    shape: sh, marks: mk,
    detail: p.detail === 'low' || p.detail === 'medium' ? p.detail : 'high',
  };
}

export function faceSpec(P) {
  const sh = P.shape, fem = P.sex, age = P.age;
  const R = mulberry32((P.seed * 9973 + 7) >>> 0);
  const rnd = () => R() * 2 - 1;
  const old = sstep(28, 80, age);                 // 0 young adult .. 1 elderly
  const child = 1 - sstep(9, 19, age);            // 1 = child
  const masc = (1 - fem) * (1 - 0.85 * child);    // masculine bone strength
  const F = { fem, masc, old, child, age, sh, mk: P.marks, seed: P.seed };
  F.S = (1 - 0.06 * fem) * (1 - 0.12 * child);
  F.C = [0, 0.02, 0.0]; // ray origin for the radial parameterisation (reference space)

  // ---- vertical landmarks (reference space)
  const fl = sh.faceLength;
  F.yCrown = 0.195;
  F.yBrow = 0.1075 + 0.0015 * sh.brow - 0.001 * fem;
  F.yEye = 0.085 + 0.0006 * rnd();
  F.yNasion = 0.092;
  F.ySub = 0.0305 - 0.0025 * sh.nose - 0.004 * fl * 0.5 - 0.0015 * old + 0.0015 * child;
  F.yTip = 0.0455 - 0.0035 * sh.nose - 0.0015 * fl - 0.0022 * old + 0.002 * child;
  F.ySlit = 0.0055 - 0.0045 * fl + 0.001 * fem - 0.0012 * old + 0.004 * child;
  F.yPog = -0.024 - 0.008 * fl - 0.0035 * sh.chin + 0.004 * fem + 0.008 * child;
  F.yMent = -0.0425 - 0.009 * fl - 0.004 * sh.chin + 0.004 * fem + 0.009 * child;
  // canonical knots for the vertical remap (actual -> canonical)
  F.yAct = [-0.12, F.yMent - 0.02, F.yMent, F.yPog, F.ySlit, F.ySub, F.yTip, F.yEye, F.yBrow, 0.15, 0.25];
  F.yCan = [-0.12, -0.0625, -0.0425, -0.024, 0.0055, 0.0305, 0.0455, 0.085, 0.1075, 0.15, 0.25];

  // ---- widths
  F.jawW = 1 + 0.07 * sh.jaw - 0.06 * fem + 0.03 * masc - 0.08 * child;
  F.cheekW = 1 + 0.025 * sh.cheek - 0.02 * fem - 0.03 * child;
  F.foreW = 1 - 0.015 * fem;
  F.chinW = 1 + 0.08 * sh.chin * 0.5 - 0.12 * fem + 0.06 * masc;
  F.chinProj = 0.0035 * sh.chin + 0.0012 * masc - 0.001 * child;

  // ---- eyes
  F.eyeR = 0.0118 * (1 - 0.03 * child) / F.S;            // eyeball constant-ish in world size
  const ex = 0.0322 + 0.0006 * rnd() - 0.0005 * fem;
  F.eyeX = ex;
  F.eyeZ = 0.0715 + 0.0012 * fem - 0.0022 * masc * (1 + sh.brow * 0.5) + 0.0015 * child + 0.0008 * sh.eyeSize;
  F.eyeAsym = [0.0004 * rnd(), 0.0004 * rnd()];           // dy L,R
  F.fissW = 1 + 0.05 * sh.eyeSize + 0.02 * fem;
  F.fissH = 1 + 0.12 * sh.eyeSize + 0.06 * fem + 0.04 * child - 0.10 * old;
  F.cantTilt = 0.6 + 0.9 * fem + 0.4 * rnd() - 1.0 * old;  // mm extra lateral canthus height
  F.creaseH = 7.2 + 1.2 * fem - 0.8 * masc + 1.0 * rnd() + 2.5 * old;  // mm above margin
  F.hood = 0.4 + 0.9 * old + 0.35 * masc + 0.25 * sh.brow + 0.2 * rnd();    // fold fullness (mm)
  F.bags = 0.15 + 1.1 * old;
  F.socketDepth = 1 + 0.25 * masc + 0.25 * old + 0.15 * sh.brow - 0.15 * child;

  // ---- brow
  F.browAmp = 0.0008 + 0.0024 * masc + 0.0012 * sh.brow;
  F.glabella = 0.0004 + 0.0018 * masc + 0.0006 * sh.brow;

  // ---- nose
  F.noseProj = 1 + 0.10 * sh.nose - 0.06 * fem - 0.22 * child + 0.02 * old;
  F.noseW = 1 + 0.12 * sh.noseWidth - 0.08 * fem - 0.08 * child + 0.04 * old;
  F.noseBridge = 1 + 0.12 * sh.nose - 0.12 * fem - 0.35 * child;  // dorsum height at the root
  F.noseHump = 0.0006 * masc + 0.0006 * Math.max(0, sh.nose) + 0.0004 * rnd();
  F.tipDroop = 0.0015 * old;
  F.noseDev = 0.0005 * rnd();

  // ---- lips / mouth
  const lp = sh.lips;
  F.mouthW = (0.0245 + 0.0008 * lp - 0.0008 * fem - 0.003 * child + 0.0006 * rnd()) * (1 + 0.02 * sh.jaw);
  F.tu = (0.0084 + 0.0018 * lp + 0.0011 * fem - 0.0025 * old) * (1 - 0.15 * child);
  F.tl = (0.0098 + 0.0020 * lp + 0.0012 * fem - 0.0022 * old) * (1 - 0.15 * child);
  F.au = 0.0046 + 0.0015 * lp + 0.0009 * fem - 0.0016 * old;
  F.al = 0.0054 + 0.0016 * lp + 0.0008 * fem - 0.0014 * old;
  F.bow = 0.07 + 0.06 * fem + 0.03 * lp;
  F.cornerDrop = 0.0004 + 0.0018 * old + 0.0004 * rnd();
  F.slitAsym = 0.0004 * rnd();

  // ---- cheeks, folds, aging
  F.cheekAmp = 0.0032 + 0.0018 * sh.cheek + 0.0008 * fem;
  F.nlf = 0.0007 + 0.0022 * old + 0.0004 * masc;  // nasolabial crease depth
  F.nlBulge = 0.0009 + 0.0018 * old + 0.0004 * fem;
  F.jowl = 0.0024 * old;
  F.hollow = 0.0012 * masc + 0.0018 * old - 0.0008 * fem - 0.001 * child;
  F.temple = 0.0018 + 0.0022 * old + 0.0006 * masc;
  F.adam = 0.0042 * masc * (1 - child);
  F.neckR = 0.054 - 0.0045 * fem - 0.004 * child;
  F.gonion = 0.0018 * masc + 0.0012 * sh.jaw;

  // ---- skin marks
  F.wrinkles = clamp(P.marks.wrinkles * 0.75 + old * 0.55, 0, 1.2);
  F.rnd = rnd;
  return F;
}
