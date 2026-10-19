// Face specification for head_a: turns createHead() params into concrete anatomical measurements.
// Reference space = adult male, meters, face toward +Z, character's left = +X. The finished mesh is
// scaled by F.S (sex / child scale). All numbers are our own anthropometric estimates.
import { clamp, sstep, mulberry32 } from './head_a_util.js';

const DEF_SHAPE = { jaw: 0, cheek: 0, nose: 0, noseWidth: 0, lips: 0, brow: 0, eyeSize: 0, faceLength: 0, chin: 0 };
const DEF_MARKS = { scar: false, freckles: 0, wrinkles: 0, stubble: 0 };

export function normParams(p = {}) {
  const sh = { ...DEF_SHAPE };
  for (const k in DEF_SHAPE) if (p.shape && Number.isFinite(+p.shape[k])) sh[k] = clamp(+p.shape[k], -1, 1);
  const mk = { ...DEF_MARKS, ...(p.marks || {}) };
  mk.scar = !!mk.scar; mk.freckles = clamp(+mk.freckles || 0, 0, 1); mk.wrinkles = clamp(+mk.wrinkles || 0, 0, 1); mk.stubble = clamp(+mk.stubble || 0, 0, 1);
  const dbg = {};
  for (const k in p) if (k.startsWith('__')) dbg[k] = p[k];
  return {
    ...dbg,
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
  const old = sstep(30, 78, age);                 // 0 young adult .. 1 elderly
  const child = 1 - sstep(10, 20, age);           // 1 = child
  const young = 1 - sstep(18, 34, age);           // extra smoothness for teens / twenties
  const masc = (1 - fem) * (1 - 0.85 * child);    // masculine bone strength
  const F = { fem, masc, old, child, young, age, sh, mk: P.marks, seed: P.seed, rnd };
  F.S = (1 - 0.06 * fem) * (1 - 0.13 * child);
  F.C = [0, 0.02, 0.0];                           // ray origin of the radial parameterisation

  // ---- vertical landmarks (reference space)
  const fl = sh.faceLength;
  F.yCrown = 0.195 + 0.002 * fl;
  F.yEye = 0.085 + 0.0004 * rnd();
  F.yBrow = 0.110 - 0.0025 * sh.brow + 0.0015 * fem - 0.001 * old;
  F.yNasion = 0.0905 - 0.001 * sh.brow;
  F.yTip = 0.0455 - 0.0032 * sh.nose - 0.0022 * fl - 0.0022 * old + 0.0025 * child + 0.0012 * fem;
  F.ySub = 0.0295 - 0.0018 * sh.nose - 0.0035 * fl - 0.0015 * old + 0.0025 * child + 0.001 * fem;
  F.ySlit = 0.0055 - 0.0055 * fl + 0.002 * fem - 0.0015 * old + 0.005 * child;
  F.yPog = -0.0335 - 0.0085 * fl - 0.0045 * sh.chin + 0.0045 * fem + 0.009 * child;
  F.yMent = F.yPog - 0.0135 - 0.002 * sh.chin + 0.002 * fem;
  // canonical knots for the vertical remap of the shield tables (actual -> canonical)
  F.yAct = [-0.12, F.yMent - 0.02, F.yMent, F.yPog, F.ySlit, F.ySub, F.yTip, F.yEye, F.yBrow, 0.16, 0.25];
  F.yCan = [-0.12, -0.0670, -0.0470, -0.0335, 0.0055, 0.0295, 0.0455, 0.085, 0.110, 0.16, 0.25];

  // ---- widths / projections
  F.jawW = 1 + 0.075 * sh.jaw - 0.075 * fem + 0.025 * masc - 0.08 * child;
  F.cheekW = 1 + 0.03 * sh.cheek - 0.025 * fem - 0.03 * child;
  F.foreW = 1 - 0.015 * fem;
  F.chinW = 1 + 0.10 * sh.chin + 0.06 * sh.jaw - 0.16 * fem + 0.04 * masc;
  F.chinProj = 0.0032 * sh.chin + 0.0012 * masc - 0.0015 * child;
  F.chinSquare = clamp(0.2 + 0.5 * masc + 0.45 * sh.jaw + 0.25 * sh.chin - 0.35 * fem, 0, 1);

  // ---- eyes
  F.eyeR = 0.0120 / (1 - 0.06 * fem) * (1 - 0.02 * child) / (1 - 0.13 * child); // eyeball ~constant in world size
  F.eyeX = 0.0320 + 0.0005 * rnd();
  F.eyeZ = 0.0752 + 0.0012 * fem - 0.0022 * masc * (0.5 + 0.6 * Math.max(0, sh.brow)) + 0.0015 * child + 0.0006 * sh.eyeSize - 0.0005 * old;
  F.eyeAsym = [0.00035 * rnd(), 0.00035 * rnd()];
  F.fissW = 1 + 0.045 * sh.eyeSize + 0.025 * fem;   // fissure width scale
  F.fissH = 1 + 0.16 * sh.eyeSize + 0.07 * fem + 0.05 * child - 0.08 * old - 0.04 * masc;
  F.cantTilt = 0.7 + 1.0 * fem + 0.35 * rnd() - 0.9 * old - 0.3 * sh.brow; // mm extra lateral canthus height
  F.creaseH = 7.6 + 1.2 * fem - 0.6 * masc + 0.6 * rnd() + 1.6 * old - 0.8 * Math.max(0, sh.brow); // mm above margin
  F.hood = 0.35 + 1.1 * old + 0.35 * masc + 0.45 * Math.max(0, sh.brow) + 0.15 * rnd();   // fold fullness (mm)
  F.bags = 0.1 + 1.0 * old;
  F.socket = 1 + 0.22 * masc + 0.25 * old + 0.22 * sh.brow - 0.15 * child - 0.1 * fem;
  F.sulcus = 0.4 + 1.6 * old + 0.6 * masc * Math.max(0, sh.brow) - 0.3 * fem;

  // ---- brow
  F.browAmp = 0.0010 + 0.0026 * masc + 0.0015 * sh.brow;
  F.glabella = 0.0006 + 0.0016 * masc + 0.0008 * sh.brow;
  F.frown = clamp(0.25 * masc + 0.6 * Math.max(0, sh.brow) + 0.2 * old, 0, 1);

  // ---- nose
  F.noseProj = 1 + 0.09 * sh.nose - 0.06 * fem - 0.22 * child + 0.02 * old;
  F.noseW = 1 + 0.12 * sh.noseWidth - 0.08 * fem - 0.08 * child + 0.05 * old;
  F.noseBridge = 1 + 0.12 * sh.nose - 0.14 * fem - 0.35 * child + 0.08 * masc;
  F.noseHump = 0.0004 * masc + 0.0005 * Math.max(0, sh.nose) + 0.0003 * rnd();
  F.tipDroop = 0.0018 * old;
  F.tipW = 1 + 0.08 * sh.noseWidth - 0.06 * fem + 0.04 * masc;
  F.noseDev = 0.0004 * rnd();

  // ---- lips / mouth
  const lp = sh.lips;
  F.mouthW = (0.0248 + 0.0008 * lp - 0.0012 * fem - 0.003 * child + 0.0005 * rnd()) * (1 + 0.02 * sh.jaw);
  F.tu = (0.0080 + 0.0016 * lp + 0.0010 * fem - 0.0022 * old) * (1 - 0.15 * child);   // upper vermilion height
  F.tl = (0.0096 + 0.0020 * lp + 0.0012 * fem - 0.0020 * old) * (1 - 0.15 * child);   // lower vermilion height
  F.au = 0.0040 + 0.0014 * lp + 0.0009 * fem - 0.0014 * old;   // upper lip projection
  F.al = 0.0050 + 0.0016 * lp + 0.0008 * fem - 0.0012 * old;   // lower lip projection
  F.bow = 0.08 + 0.07 * fem + 0.03 * lp;
  F.cornerDrop = 0.0003 + 0.0016 * old + 0.0005 * Math.max(0, sh.brow) * masc + 0.0003 * rnd();
  F.slitAsym = 0.0003 * rnd();

  // ---- cheeks, folds, aging
  F.cheekAmp = 0.0030 + 0.0020 * sh.cheek + 0.0006 * fem;
  F.nlf = 0.0006 + 0.0020 * old + 0.0004 * masc + 0.0002 * Math.max(0, sh.cheek);  // nasolabial crease depth
  F.nlBulge = 0.0008 + 0.0016 * old + 0.0004 * fem;
  F.jowl = 0.0022 * old;
  F.hollow = 0.0010 * masc + 0.0020 * old - 0.0008 * fem - 0.001 * child + 0.0008 * Math.max(0, sh.cheek);
  F.temple = 0.0016 + 0.0022 * old + 0.0006 * masc;
  F.adam = 0.0040 * masc * (1 - child);
  F.neckR = 0.054 - 0.005 * fem - 0.004 * child;
  F.gonion = 0.0016 * masc + 0.0014 * sh.jaw;

  // ---- skin marks
  F.wrinkles = clamp(P.marks.wrinkles * 0.8 + old * 0.5, 0, 1.2);
  return F;
}
