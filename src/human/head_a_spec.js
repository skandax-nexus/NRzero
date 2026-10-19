// head_a spec: turns createHead() params into concrete anatomical measurements (millimetres, reference
// space = adult male, face toward +Z, character's left = +X, origin = head pivot). The finished mesh is
// scaled by F.S * 0.001. Every number is our own anthropometric estimate; nothing is transcribed.
import { clamp, lerp, sstep, mulberry32 } from './head_a_util.js';

const DEF_SHAPE = { jaw: 0, cheek: 0, nose: 0, noseWidth: 0, lips: 0, brow: 0, eyeSize: 0, faceLength: 0, chin: 0 };
const DEF_MARKS = { scar: false, freckles: 0, wrinkles: 0, stubble: 0 };

export function normParams(p = {}) {
  const sh = { ...DEF_SHAPE };
  for (const k in DEF_SHAPE) if (p.shape && Number.isFinite(+p.shape[k])) sh[k] = clamp(+p.shape[k], -1, 1);
  // optional extra shape keys (not in the contract, all -1..1): eyeFold (epicanthic / low crease),
  // noseBridge, lipEvert
  for (const k of ['eyeFold', 'noseBridge', 'lipEvert']) if (p.shape && Number.isFinite(+p.shape[k])) sh[k] = clamp(+p.shape[k], -1, 1);
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
    likeness: typeof p.likeness === 'string' ? p.likeness : null,
    portrait: p.portrait || null,
    tune: p.tune || null,
  };
}

const lum = (hex) => { const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255; return 0.2126 * r * r + 0.7152 * g * g + 0.0722 * b * b; };

// F: everything in mm (reference space)
export function faceSpec(P) {
  const sh = P.shape, fem = P.sex, age = P.age;
  const R = mulberry32((P.seed * 9973 + 7) >>> 0);
  const rnd = () => R() * 2 - 1;
  const old = sstep(30, 76, age);                 // 0 young adult .. 1 elderly
  const child = 1 - sstep(10, 19, age);           // 1 = child
  const young = 1 - sstep(17, 30, age);
  const masc = (1 - fem) * (1 - 0.85 * child);
  const L = lum(P.skin);
  const dark = 1 - sstep(0.07, 0.30, L);          // deep skin tone
  // correlated phenotype traits (derived from shape params + tone; can be overridden by shape.eyeFold etc.)
  const asian = sh.eyeFold !== undefined ? clamp(sh.eyeFold, 0, 1)
    : clamp(sstep(0.1, 0.4, -sh.eyeSize) * sstep(0.0, 0.25, -sh.nose) * sstep(0.2, 0.45, sh.cheek) * 1.0, 0, 1);
  const african = clamp(dark * sstep(0.1, 0.3, sh.noseWidth) * sstep(0.1, 0.25, sh.lips), 0, 1);
  const F = { P, fem, masc, old, child, young, age, sh, mk: P.marks, seed: P.seed, rnd, dark, asian, african };
  F.S = (1 - 0.06 * fem) * lerp(1, 0.86, child);
  const fl = sh.faceLength;
  // per-person seeded variation so equal params still give different people
  const v = {}; for (const k of ['eyeX', 'eyeY', 'eyeZ', 'tilt', 'crease', 'nose', 'noseW', 'hump', 'tip', 'tipR', 'mouthW', 'lipU', 'lipL', 'bow', 'chin', 'jaw', 'cheek', 'brow', 'brH', 'fore', 'ear', 'earP', 'philt', 'slit', 'asym1', 'asym2', 'asym3', 'asym4', 'cranium', 'occ', 'nostril', 'gon']) v[k] = rnd();
  F.v = v;

  // ---------------- cranium
  F.crown = 195 + 2 * v.cranium + 6 * child;
  F.craniumW = 75 + 1.5 * v.cranium - 1.5 * fem + 2 * child;   // half breadth
  F.craniumL = 1 + 0.02 * v.occ;                                // length factor
  F.foreSlope = clamp(0.55 * masc + 0.2 * old - 0.35 * child + 0.15 * v.fore, -0.3, 1);

  // ---------------- eyes
  F.eyeR = 11.9 / F.S * lerp(1, 0.97, child);
  const ipd = 31.6 + 0.9 * v.eyeX - 0.4 * fem - 0.8 * child;
  F.E = [ipd, 85 + 0.6 * v.eyeY + 1.5 * child, 75.2 + 1.2 * fem - 2.2 * masc * (0.45 + 0.8 * Math.max(0, sh.brow)) + 2.2 * child + 0.6 * v.eyeZ - 0.6 * old + 1.6 * asian];
  F.eyeAsym = [0.35 * v.asym1, 0.35 * v.asym2];
  // fissure (angles on the globe, degrees). up = upper margin elevation at apex, lo = lower margin at nadir
  F.lidUp = 20.5 + 4.5 * sh.eyeSize + 2.5 * fem + 2.5 * child - 3.5 * old - 1.5 * masc * Math.max(0, sh.brow) - 3 * asian;
  F.lidLo = -24.5 - 2.5 * sh.eyeSize - 1.2 * fem - 1.5 * child - 2.2 * old + 1.5 * asian;
  F.canthIn = -6 + 0.8 * v.eyeY;                 // inner canthus elevation (deg)
  F.tilt = 6 + 5 * fem + 2.0 * v.tilt - 5 * old + 6 * asian + 2 * child;   // outer canthus extra elevation (deg)
  F.fissW = 1 + 0.06 * sh.eyeSize + 0.02 * fem - 0.03 * asian;              // fissure width factor
  F.crease = clamp(6.6 + 1.6 * fem + 0.5 * v.crease - 0.8 * masc * Math.max(0, sh.brow) + 1.4 * old - 5.0 * asian, 1.0, 10);  // mm above margin
  F.hood = clamp(0.35 + 0.35 * masc + 1.25 * old + 0.6 * Math.max(0, sh.brow) + 0.25 * v.crease + 1.3 * asian - 0.3 * child, 0, 2.5); // fold fullness (mm)
  F.epicanthus = clamp(asian * 1.0 + 0.4 * child, 0, 1);
  F.bags = clamp(0.15 + 1.1 * old + 0.1 * v.asym3, 0, 1.4);
  F.socket = 1 + 0.25 * masc + 0.35 * old + 0.3 * sh.brow - 0.3 * child - 0.1 * fem - 0.4 * asian;

  // ---------------- brow (bone + hair line)
  F.browRidge = clamp(0.6 + 2.6 * masc + 1.6 * sh.brow + 0.6 * old - 0.6 * asian, 0, 5);
  F.glabella = clamp(0.4 + 1.6 * masc + 0.9 * sh.brow - 0.4 * asian, 0, 3);
  F.browY = 102.5 + 2.6 * fem - 1.6 * sh.brow - 1.0 * old + 0.8 * v.brH;      // eyebrow hair centre height (at the pupil)
  F.browArch = 2.0 + 2.2 * fem + 0.6 * v.brow;
  F.browThick = 1 + 0.35 * masc + 0.25 * sh.brow - 0.25 * fem;
  F.frown = clamp(0.25 * masc + 0.6 * Math.max(0, sh.brow) + 0.25 * old, 0, 1);

  // ---------------- nose
  const nl = sh.nose;
  F.nasion = [0, 92.5 - 1.2 * sh.brow + 1.0 * fem, 0];  // z filled below
  F.bridge = clamp(1 + 0.18 * (sh.noseBridge || 0) + 0.12 * nl - 0.22 * child - 0.55 * asian - 0.35 * african + 0.05 * v.nose, 0.25, 1.4);
  F.tipY = 45.5 - 3.2 * nl - 2.2 * fl - 2.0 * old + 2.5 * child + 1.0 * fem + 0.6 * v.tip;
  F.tipZ = 119.5 + 3.5 * nl - 4.0 * fem - 9.5 * child + 1.0 * old - 6 * asian - 3.5 * african + 0.8 * v.nose;
  F.subY = 31.5 - 2.0 * nl - 2.6 * fl - 1.2 * old + 2.2 * child + 0.6 * fem;
  F.subZ = 101.2 - 1.0 * fem - 3.5 * child - 2 * asian + 0.5 * african;
  F.alarW = 17.2 + 2.6 * sh.noseWidth - 1.5 * fem - 2.8 * child + 1.0 * old + 2.6 * african + 1.0 * asian + 0.6 * v.noseW;
  F.dorsumW = (5.2 + 0.8 * sh.noseWidth - 0.5 * fem - 1.2 * child + 1.0 * african + 0.8 * asian) * (1 + 0.05 * v.noseW);
  F.tipW = 6.4 + 1.0 * sh.noseWidth - 0.4 * fem - 0.6 * child + 1.3 * african + 0.6 * asian + 0.4 * v.tip;
  F.hump = clamp(0.5 * masc + 0.8 * Math.max(0, nl) + 0.5 * v.hump + 0.3 * old - 0.6 * asian - 0.5 * child, -0.6, 2.2);
  F.tipRot = 4 * fem + 6 * child - 4 * old + 3 * v.tipR + 2 * asian + 2 * african; // upturn (deg)
  F.nostril = 1 + 0.15 * v.nostril + 0.35 * african;
  F.noseDev = 0.5 * v.asym4;

  // ---------------- mouth & lips
  const lp = sh.lips;
  F.mouthW = (24.6 + 1.0 * lp - 1.2 * fem - 3.6 * child + 1.6 * african + 0.7 * v.mouthW) * (1 + 0.025 * sh.jaw);
  F.slitY = 6.0 - 4.2 * fl - 1.6 * old + 3.5 * child + 0.6 * fem + 0.4 * v.slit;
  F.lipU = clamp(7.4 + 1.8 * lp + 1.4 * fem - 2.6 * old + 2.4 * african - 0.8 * child + 0.6 * v.lipU, 3.2, 13);   // upper vermilion height
  F.lipL = clamp(9.2 + 2.0 * lp + 1.2 * fem - 2.0 * old + 2.4 * african - 0.6 * child + 0.6 * v.lipL, 4.5, 15);   // lower vermilion height
  F.lipProjU = 3.6 + 1.2 * lp + 0.8 * fem - 1.4 * old + 1.6 * african + 0.4 * v.lipU;
  F.lipProjL = 4.2 + 1.2 * lp + 0.6 * fem - 0.8 * old + 1.6 * african + 0.4 * v.lipL;
  F.bow = clamp(0.9 + 0.7 * fem + 0.3 * lp + 0.4 * v.bow - 0.5 * old, 0.2, 2.2);
  F.cornerDrop = 0.2 + 1.3 * old + 0.35 * masc * Math.max(0, sh.brow) + 0.3 * v.asym3;
  F.philtrum = clamp(0.55 + 0.25 * v.philt - 0.25 * old + 0.2 * fem, 0.1, 1);
  F.slitAsym = 0.35 * v.asym4;

  // ---------------- chin & jaw
  const cn = sh.chin;
  F.pogY = -32.5 - 6.0 * fl - 3.0 * cn + 4.0 * fem + 9.0 * child + 0.8 * v.chin;
  F.pogZ = 93.0 + 3.0 * cn + 1.0 * masc - 4.0 * child - 1.0 * old + 0.8 * v.chin - 1.0 * asian;
  F.mentY = F.pogY - 11.5 - 1.5 * cn + 1.5 * fem + 2 * child;
  F.chinW = (1 + 0.12 * cn + 0.10 * sh.jaw - 0.16 * fem + 0.05 * masc - 0.08 * child);
  F.chinSquare = clamp(0.25 + 0.45 * masc + 0.45 * sh.jaw + 0.25 * cn - 0.3 * fem, 0, 1);
  F.cleft = clamp(0.2 * masc + 0.4 * Math.max(0, v.chin) * masc, 0, 0.8);
  F.gonX = 49.5 + 4.5 * sh.jaw - 4.0 * fem - 5.0 * child + 1.0 * v.jaw + 1.5 * asian;
  F.gonY = -7 + 3 * fem + 5 * child - 2.5 * sh.jaw - 1.5 * fl + 1.0 * v.gon;
  F.gonZ = -8 + 1.5 * child;
  F.jawDef = clamp(0.45 + 0.4 * masc + 0.35 * sh.jaw - 0.3 * child - 0.2 * old + 0.2 * v.jaw, 0, 1.2);

  // ---------------- cheeks & soft tissue
  F.zygW = 68.5 + 2.2 * sh.cheek - 3.0 * fem - 4.0 * child + 2.0 * asian + 0.8 * v.cheek;
  F.malar = 2.4 + 2.0 * sh.cheek + 0.8 * fem + 0.5 * v.cheek + 0.8 * asian + 0.6 * african;
  F.malarY = 59 + 2.0 * sh.cheek + 1.5 * fem;
  F.buccal = clamp(0.6 * masc + 1.4 * old - 1.6 * child - 0.6 * fem - 0.6 * young + 0.6 * Math.max(0, sh.cheek) + 0.2 * v.cheek, -1.6, 2.5);
  F.nlf = clamp(0.3 + 1.6 * old + 0.35 * masc + 0.25 * Math.max(0, sh.cheek) - 0.4 * child + 0.2 * v.asym2, 0, 2.6);
  F.marionette = clamp(1.4 * old - 0.2, 0, 1.4);
  F.jowl = clamp(1.6 * old - 0.3, 0, 1.6);
  F.temple = 1.2 + 2.0 * old + 0.6 * masc - 0.8 * child;
  F.adam = clamp(4.0 * masc * (1 - child) * (1 + 0.2 * v.jaw), 0, 5);
  F.neckR = lerp(55, 47, fem) * lerp(1, 0.78, child) / F.S;   // world radius 55 male / 47 female
  F.chinFat = clamp(0.4 * old + 0.3 * masc * old, 0, 1);

  // ---------------- ears
  F.earC = [74.5 + 1 * v.ear - 1 * fem, 69 + 1.5 * v.ear, -10];
  F.earLen = 61 + 7 * old - 3 * fem - 4 * child + 1.5 * v.ear;
  F.earW = 31 + 2 * old - 1.5 * fem + 1.0 * v.ear;
  F.earOut = 17 + 6 * v.earP + 4 * child;   // protrusion angle (deg)

  // ---------------- skin
  F.wrinkles = clamp(P.marks.wrinkles * 0.75 + old * 0.55 - child * 0.3, 0, 1.2);
  return F;
}
