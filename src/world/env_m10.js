// Mission 10 environment: Continuum Detention Block D4, built into the ruin of Helix Sub-Level 4 (Rain City, 2196),
// and the same rooms in 2049 when they were Helix's archive, substation and test hall.
// North = -z. Floor at y = 0. Static geometry is merged per material per era (env_m6 Batch): the concrete shell is
// shared by both eras; Helix fittings exist only in 2049, the Continuum's pearl-and-gold inserts only in 2196.
//   Gallery (cells, pillars, guard post)  x -24..24, z -9..9.6
//   Substation (2049) / relay vault (2196)  x -22..-8, z -21..-9
//   Records vault (2049) / armoury (2196)   x 8..22,  z -21..-9
//   Transit spine                           x 24..55, z -3.2..3.2
//   Testing chamber (round, r 15)           centre (70, 0)
//   Shaft and broken gantry, the breach     x 85..120, z -6..6   (outside: the ruined city at dusk)
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat } from './kit.js';
import { Batch } from './env_m6.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';
import { combatState } from '../systems/combat.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
export const CELL_X = [-15.4, -11, -6.6, -2.2, 2.2, 6.6, 11, 15.4];
export const KAI_CELL = 3, SERA_CELL = 4, TEO_CELL = 7;
export const TC = [70, 0], TR = 15;                       // testing chamber centre / radius
export const LOOP_ANG = [62, 82, 98, 118].map(a => a * Math.PI / 180);   // loop cells on the south arc
export const loopCellPos = (i, r = TR + 1.6) => [TC[0] + Math.cos(LOOP_ANG[i]) * r, 0, TC[1] + Math.sin(LOOP_ANG[i]) * r];
export const P = {
  start: [-2.6, 0, 6.6, Math.PI],
  vent: [-0.35, 0, 7.4],
  conduit: [-3.5, 0, 9.2],
  seraCell: [2.2, 0, 7.0],
  guardPost: [-21.2, 0, -0.4],
  powerDoor: [-14, 0, -8.6],
  breakers: [[-18, -20.1], [-15, -20.1], [-12, -20.1]],
  vaultDoor: [14, 0, -9],
  armSafe: [14, 0, -11.6],
  locker: [19.6, 0, -19.6],
  gateConsole: [21.3, 0, -13.5],
  eastGate: [24, 0, 0],
  roster: [-22.6, 0, 1.2],
  teoCell: [15.4, 0, 6.8],
  spineIn: [26, 0, 0],
  chamberDoor: [55.2, 0, 0],
  loopPanel: [70, 0, 9.2],
  exitDoor: [85, 0, 0],
  gapFrom: [96.4, 0, 0], gapTo: [104.2, 0, 0],
  breach: [113, 0, 0],
};
export const SHARDS = [
  [-1.2, 0.35, 8.9, '2196'],     // under Kai's bunk
  [-9.6, 0.4, -18.6, '2049'],    // behind the transformer
  [9.4, 0.9, -20.4, '2196'],     // armoury, behind the racks
  [42, 0.4, -5.6, '2049'],       // spine alcove (2049 only: a barricade blocks it in 2196)
  [70, 0.6, -13.4, '2196'],      // under the observation window
];

// ---------------------------------------------------------------------------------------------
// Cast (COSTUMES.md: continuum_2 officer, continuum_1 trooper, surv_* survivors)
// ---------------------------------------------------------------------------------------------
export const TROOPER = { era: '2196', costume: 'continuum_1', sex: 0, age: 30, height: 1.86, build: 1.06, skin: 0xd9a585, hair: 0x111111, hairStyle: 'buzz',
  topType: 'armored', top: 0xe6e8ea, topKind: 'synthetic', armor: true, pantsType: 'trousers', pants: 0x202328, shoes: 'boots', boots: 0x202328, gloves: 0x202328, belt: 0x8a9098, lod: true };
export const TROOPER_F = { ...TROOPER, sex: 1, female: true, age: 27, height: 1.76, build: 0.98, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'bun' };
export const PRISONERS = [
  { era: '2196', costume: 'surv_m1', sex: 0, age: 41, height: 1.78, build: 0.92, skin: 0xa77a5d, hair: 0x15100b, hairStyle: 'short', beard: 0x15100b, topType: 'jacket', top: 0x8a7458, topKind: 'fabric', hood: true, vest: 0x4a4a3a, pantsType: 'cargo', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 28, height: 1.7, build: 1.0, skin: 0x6b4029, hair: 0x0e0a08, hairStyle: 'tied-back', topType: 'jacket', top: 0x6a5a44, topKind: 'fabric', pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_m2', sex: 0, age: 63, height: 1.68, build: 0.9, skin: 0xd8b08e, hair: 0x9a9690, hairStyle: 'short', stubble: true, topType: 'jacket', top: 0x6a6a64, topKind: 'fabric', hood: true, vest: 0x5a3e28, pantsType: 'trousers', pants: 0x8a7458, shoes: 'boots', boots: 0x4a3a2a, lod: true },
  { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 45, height: 1.66, build: 1.02, skin: 0xe0b8a0, hair: 0x8a8278, hairStyle: 'tied-back', topType: 'jacket', top: 0x6a6a64, topKind: 'fabric', hood: true, vest: 0x4a4a38, pantsType: 'trousers', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
];
export function registerM10Cast() {
  registerCast('prefect', {
    name: 'PREFECT IMA ADAIR', role: 'The Continuum · Warden of Block D4',
    bio: 'Officer of the Continuum, the order that holds the ruined city to one timeline. She has met Kai Varen in sixteen versions of this day and remembers every one.',
    look: { era: '2196', costume: 'continuum_2', sex: 1, female: true, age: 33, height: 1.76, build: 1.0, skin: 0xe8c0a0, hair: 0x0e0a08, hairStyle: 'bun', eyes: 0x2a2018,
      face: { jaw: 0.1, cheek: 0.45, nose: -0.1, noseWidth: -0.1, lips: -0.05, brow: 0.2, eyeSize: -0.05, faceLength: 0.1, chin: 0.1 },
      topType: 'armored', top: 0xe6e8ea, topKind: 'synthetic', armor: true, pantsType: 'trousers', pants: 0x202328, shoes: 'boots', boots: 0x202328, gloves: 0x202328, belt: 0xd9a441 },
    rimColor: 0xffd27a, glow: 0x2a2010, bg: 0x101014,
    vp: { sex: 'f', pitch: 0.96, rate: 0.93, langs: ['en-GB', 'en-US'] },
  });
  registerCast('trooper', { name: 'CONTINUUM TROOPER', role: 'Block D4 · helmet sealed', look: { ...TROOPER, lod: false }, vp: { sex: 'm', pitch: 0.8, rate: 1.0, langs: ['en-GB', 'en-US'] } });
  registerCast('teo', {
    name: 'TEO OKAFOR', role: 'Scout · Sera Voss\'s crew',
    bio: 'Nineteen, quick, and the only one of Sera\'s scouts who was caught. He has been in cell 7 for eleven days.',
    look: { era: '2196', costume: 'surv_f1', sex: 0, age: 19, height: 1.77, build: 0.9, skin: 0x5a3622, hair: 0x0e0a08, hairStyle: 'curly', eyes: 0x2a1c14,
      face: { jaw: -0.1, cheek: 0.2, nose: 0.1, noseWidth: 0.25, lips: 0.3, brow: 0.0, eyeSize: 0.15, faceLength: 0.05, chin: -0.1 },
      topType: 'jacket', top: 0x6a5a44, topKind: 'fabric', vest: 0x7a6a3a, pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, gloves: 0x3a3028 },
    vp: { sex: 'm', pitch: 1.06, rate: 1.06, langs: ['en-GB', 'en-NG', 'en-US'] },
  });
  registerCast('looper', { name: 'LOOP SUBJECT', role: 'Testing Chamber 2 · held in a loop', look: { ...PRISONERS[2], lod: false }, vp: { sex: 'm', pitch: 0.86, rate: 0.9, langs: ['en-GB', 'en-US'] } });
  registerCast('pa', { name: 'CONTINUUM ADDRESS', role: 'Block D4 · automated', voice: true, vp: { sex: 'f', pitch: 1.08, rate: 0.96, langs: ['en-GB', 'en-US'] } });
  registerCast('helix49', { name: 'HELIX SL4 SYSTEMS', role: 'Sub-Level 4 · 2049', voice: true, vp: { sex: 'f', pitch: 1.12, rate: 1.04, langs: ['en-US', 'en-GB'] } });
}

// ---------------------------------------------------------------------------------------------
// Music: the cell (sparse), Sera's motif, stealth that tightens with awareness, combat layered by threat,
// the loop cells (a phrase that repeats with one note missing), and the escape / Echo Step ending.
// ---------------------------------------------------------------------------------------------
export const musicState = { echo: 0, loops: 0 };
export function registerM10Themes() {
  registerTheme('m10-cell', { bpm: 58, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([45, 52, 60], t, d * 16, 0.014, 380); if (bar % 2 === 0) a.cello(33, t, d * 32, 0.04); }
    if (b === 6 && bar % 2) a.piano(64, t, 0.09, 3.6);
    if (b === 12 && bar % 4 === 3) a.piano(63, t, 0.08, 4);
    if (b % 8 === 4) a.tick(t, 0.012, 2400);
  } });
  registerTheme('m10-sera', { bpm: 72, step(a, s, t, d) {   // Sera: warm pluck, low strings, a rising fourth
    const bar = Math.floor(s / 16), b = s % 16, ch = [[50, 57, 62], [48, 55, 60], [46, 53, 58], [45, 52, 57]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016, 520); a.cello(ch[0] - 12, t, d * 16, 0.04); }
    if ([0, 3, 6, 10].includes(b)) a.pluck(ch[(b >> 2) % 3] + 12, t, 0.06);
    if (b === 8 && bar % 2) a.flute(ch[2] + 17, t, d * 6, 0.02);
  } });
  registerTheme('m10-stealth', { bpm: 84, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, al = combatState.alert;
    if (b % 4 === 0) a.tick(t, 0.02 + al * 0.03, 4200);
    if (b === 0) { a.pad([50, 53, 58], t, d * 16, 0.013, 360); a.cello(bar % 2 ? 38 : 41, t, d * 16, 0.045); }
    if (al > 0.3 && b % 2 === 1) a.tick(t, 0.015 * al, 7000);
    if (al > 0.55 && b % 8 === 0) a.drum(t, 0.1 * al, 90, 40);
    if (b === 14 && bar % 2) a.glass(86, t, 0.012);
  } });
  registerTheme('m10-combat', { bpm: 118, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, th = combatState.threat;
    if (b % 4 === 0) a.drum(t, 0.14 + th * 0.08, 110, 44);
    if (th > 0.25 && b % 4 === 2) a.drum(t, 0.06, 180, 90);
    a.tick(t, b % 2 ? 0.01 : 0.022 * (0.5 + th), 6500);
    if (b % 2 === 0) a.cello([38, 38, 41, 43][(b >> 2) % 4] + (bar % 4 === 3 ? 2 : 0), t, d * 1.8, 0.04 + th * 0.02);
    if (b === 0) a.pad([62, 65, 69], t, d * 16, 0.012, 640);
    if (th > 0.6 && b === 8) a.glass(88, t, 0.016);
  } });
  registerTheme('m10-loop', { bpm: 66, step(a, s, t, d) {     // the loop cells: a five-note phrase; each release restores a note
    const bar = Math.floor(s / 16), b = s % 16, mel = [69, 72, 76, 74, 71], at = [0, 3, 6, 9, 12];
    const i = at.indexOf(b); if (i >= 0 && (i < 1 + musicState.loops || bar % 2 === 0)) a.glass(mel[i] + 12, t, 0.022);
    if (b === 0) { a.pad([57, 64, 69], t, d * 16, 0.014, 420); a.cello(33, t, d * 16, 0.035); }
    if (b % 4 === 2) a.tick(t, 0.01, 3000);
  } });
  registerTheme('m10-escape', { bpm: 132, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b % 4 === 0) a.drum(t, 0.16, 120, 44);
    if (b % 2 === 0) a.cello([40, 43, 47, 45][(b >> 2) % 4], t, d * 1.6, 0.05);
    a.tick(t, b % 4 === 2 ? 0.03 : 0.012, 7000);
    if (b === 0) a.pad([64, 67, 71], t, d * 16, 0.015, 760);
    if (bar % 2 === 1 && b === 8) a.glass(88, t, 0.018);
  } });
  registerTheme('m10-echo', { bpm: 56, step(a, s, t, d) {     // the ending: the motif, and its echo half a beat behind
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([57, 64, 69, 76], t, d * 16, 0.018, 520); a.cello(33, t, d * 16, 0.045); }
    if (bar % 2 === 0 && [0, 6, 12].includes(b)) { const n = [76, 83, 81][b / 6]; a.piano(n, t, 0.18, 5); a.piano(n, t + d * 2, 0.07, 4); }
    if (bar % 4 === 3 && b === 4) a.glass(93, t, 0.014);
  } });
}

// ---------------------------------------------------------------------------------------------
// Code-drawn screens and signs
// ---------------------------------------------------------------------------------------------
const lines = (g, list, x, y, size, col, lh = 1.35, weight = 600) => { g.font = `${weight} ${size}px ${FONT}`; list.forEach((l, i) => { g.fillStyle = Array.isArray(l) ? l[1] : col; g.fillText(Array.isArray(l) ? l[0] : l, x, y + i * size * lh); }); };
export function contScreen(key, w, h, draw) {   // Continuum UI: graphite glass, gold rule lines
  return canvasTex(w, h, (g, W, H) => {
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#15171b'); grd.addColorStop(1, '#0b0c0f'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,210,122,0.5)'; g.lineWidth = 2; g.strokeRect(8, 8, W - 16, H - 16);
    g.strokeStyle = 'rgba(255,210,122,0.08)'; g.lineWidth = 1; for (let y = 0; y < H; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.beginPath(); g.strokeStyle = 'rgba(255,210,122,0.8)'; g.lineWidth = 3; g.arc(W - 46, 44, 18, 0, 7); g.stroke(); g.beginPath(); g.moveTo(W - 64, 44); g.lineTo(W - 28, 44); g.stroke();
    draw(g, W, H);
  }, 'm10' + key);
}
function helixPlate(key, w, h, draw) {
  return canvasTex(w, h, (g, W, H) => { g.fillStyle = '#e4e8ec'; g.fillRect(0, 0, W, H); g.fillStyle = '#1d2a36'; g.fillRect(0, 0, W, H * 0.22); draw(g, W, H); }, 'm10' + key);
}
export const TEX = {
  roster: (teoOut) => contScreen('roster' + (teoOut ? 1 : 0), 512, 384, (g) => {
    lines(g, ['BLOCK D4 · INTAKE'], 26, 50, 26, '#ffd27a', 1.3, 700);
    lines(g, ['C1  HALE, J.        LOOP-TEST', 'C2  —', 'C3  VAREN, K.   ◆ 17TH INTAKE', 'C4  VOSS, S.          HOLD', 'C5  MARR, D.          HOLD', 'C6  —', 'C7  OKAFOR, T.  ' + (teoOut ? 'RELEASED' : 'HOLD · MANUAL'), 'C8  —', '', 'TESTING CHAMBER 2 · 4 IN LOOP'], 26, 96, 19, '#e8e2d2', 1.38);
  }),
  dossier: () => contScreen('dossier', 512, 384, (g) => {
    lines(g, ['SUBJECT · VAREN, KAI'], 26, 50, 24, '#ffd27a', 1.3, 700);
    lines(g, ['Recorded versions ........ 16', 'Escaped this block ........ 4', 'Escape aid ........ VOSS, S. (×3)', 'Classification ... ARCHITECT', '                     OF THE FRACTURE', 'Disposition ... ASSESS · TEST 2', '"He does not remember us.', '  We remember him."'], 26, 92, 19, '#e8e2d2', 1.4);
  }),
  doctrine: () => contScreen('doctrine', 768, 256, (g, W) => {
    g.textAlign = 'center'; lines(g, ['ONE TIME · ONE LINE · HELD'], W / 2, 110, 46, '#ffd27a', 1.2, 700);
    lines(g, ['The Continuity Protocol, article I · adopted from Helix directive E-ROOK-2049'], W / 2, 170, 20, '#c9bfae'); g.textAlign = 'left';
  }),
  d4sign: () => contScreen('d4', 512, 160, (g) => { lines(g, ['D4 · DETENTION'], 30, 92, 50, '#f0e6d0', 1, 700); lines(g, ['THE CONTINUUM HOLDS'], 32, 132, 18, '#ffd27a'); }),
  sl4sign: () => helixPlate('sl4', 512, 160, (g) => { lines(g, ['HELIX · SL4'], 24, 26, 22, '#e8f2ff', 1, 700); lines(g, ['ARCHIVE & SUBSTATION'], 24, 90, 36, '#1d2a36', 1, 700); lines(g, ['Level −4 · Authorised personnel'], 24, 132, 18, '#3a4a5a'); }),
  breaker: (id, label, on) => helixPlate('brk' + id + (on ? 1 : 0), 256, 320, (g) => {
    lines(g, ['SL4-' + id], 18, 30, 24, '#e8f2ff', 1, 700); lines(g, label, 18, 104, 22, '#1d2a36', 1.3, 700);
    g.fillStyle = on ? '#2fbf6a' : '#c43a3a'; g.beginPath(); g.arc(128, 250, 26, 0, 7); g.fill();
    lines(g, [on ? 'LIVE' : 'ISOLATED'], on ? 96 : 76, 306, 20, '#1d2a36', 1, 700);
  }),
  lockdown: () => helixPlate('lock', 384, 192, (g) => { lines(g, ['HELIX · SL4'], 18, 30, 18, '#e8f2ff', 1, 700); g.fillStyle = '#c43a3a'; g.fillRect(0, 50, 384, 70); lines(g, ['LOCKDOWN BAY'], 18, 100, 34, '#fff', 1, 700); lines(g, ['Sealed 19.10.2049 · 08:14'], 18, 158, 18, '#1d2a36'); }),
  ivenNote: () => helixPlate('iven', 384, 256, (g) => {
    lines(g, ['MAINTENANCE · I. MARR'], 18, 34, 18, '#e8f2ff', 1, 700);
    lines(g, ['Re-cabled SL4 after the 08:14 lockdown.', 'Row circuit, services and maglocks still on', 'the original copper. Whoever designed this', 'level wired it to last a hundred years.', 'Didn\'t ask why. — I.M. 20.10.49'], 18, 86, 16, '#1d2a36', 1.45);
  }),
  hallPlate: () => helixPlate('hall', 512, 200, (g) => {
    lines(g, ['HELIX · TEST HALL 2'], 22, 30, 22, '#e8f2ff', 1, 700);
    lines(g, ['CHRONOLITH CALIBRATION'], 22, 96, 32, '#1d2a36', 1, 700);
    lines(g, ['Programme director: Dr. E. Rook · Operator of record: K. Varen'], 22, 140, 17, '#3a4a5a');
    lines(g, ['"Hold the line, and nothing is lost." — Continuity Protocol draft'], 22, 172, 15, '#3a4a5a');
  }),
  loopPanel: (n) => contScreen('loop' + n, 512, 256, (g) => {
    lines(g, ['TESTING CHAMBER 2 · LOOP CELLS'], 24, 48, 22, '#ffd27a', 1.3, 700);
    lines(g, ['L1  HELD  6.0 s', 'L2  HELD  5.2 s', 'L3  HELD  6.8 s', 'L4  HELD  5.6 s'].map((l, i) => i < n ? l.replace('HELD', 'FREE') : l), 24, 92, 20, '#e8e2d2', 1.4);
    lines(g, ['Stabilizer draw: LIFT 2 · ' + (n ? 'DIVERTED' : 'NOMINAL')], 24, 230, 16, n ? '#ff8a6a' : '#c9bfae');
  }),
  monitor: (seed) => contScreen('mon' + seed, 256, 160, (g, W, H) => {
    g.strokeStyle = 'rgba(255,210,122,0.6)'; g.lineWidth = 2; g.beginPath();
    for (let x = 16; x < W - 16; x += 4) g.lineTo(x, H / 2 + Math.sin(x * 0.07 + seed) * 22 * Math.sin(x * 0.013 + seed * 2));
    g.stroke(); lines(g, ['CELL ' + (seed % 8 + 1) + ' · VITALS'], 16, 30, 14, '#ffd27a');
  }),
};

// ---------------------------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------------------------
export function buildBlock(game, scene) {
  const Q = RZ.getQuality(), low = Q === 'low';
  const T = game.temporal, col = game.collision;
  const W = { lightSrc: [], bars: [], barBoxes: [], doors: {}, screens: {}, shardMeshes: [], loopGlass: [], ext: null, breakerTex: [], updaters: [] };
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const M = {
    shell: pm('concrete', { color: 0x8a8984, formwork: 1, stains: 0.55 }),
    shellDark: pm('concrete', { color: 0x5e5d5a, formwork: 0, stains: 0.7 }),
    floor96: pm('concrete', { color: 0x6e6c68, slabs: 1, stains: 0.8, formwork: 0 }),
    tile49: pm('ceramicTile', { color: 0x9aa0a6, grout: 0x5a5e62, count: 2, gloss: 0.7, variation: 0.15 }),
    panel49: pm('paintedMetalPanel', { color: 0xd6dade, cols: 1, rows: 3, wear: 0.1, grime: 0.12, gloss: 0.5 }),
    panelDark49: pm('paintedMetalPanel', { color: 0x3a4048, cols: 2, rows: 2, wear: 0.2, grime: 0.2, gloss: 0.4 }),
    ceiling: pm('paintedMetalPanel', { color: 0x9a9ea2, cols: 4, rows: 4, wear: 0.15, grime: 0.3, gloss: 0.25 }),
    steel: pm('brushedMetal', { color: 0x9aa0a6, roughness: 0.32 }),
    darkSteel: pm('brushedMetal', { color: 0x3a3f46, roughness: 0.42 }),
    rust: pm('rust', { color: 0x4a2a14, paint: 0x3d4a52, amount: 0.6 }),
    rubber: pm('rubber', { color: 0x1a1b1d }),
  };
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xe6e8ea, roughness: 0.2, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.15 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.5, metalness: 0.35 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.3, metalness: 0.8 });
  const gold = glowMat(0xffd27a, 2.4), goldDim = glowMat(0xd9a441, 1.1);
  const cyan = glowMat(0x9fe8ff, 2.2), white = glowMat(0xf2f6ff, 2.6), red = glowMat(0xff4d5e, 1.8), green = glowMat(0x6aff9a, 1.6);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfd0d8, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  W.M = M; W.mats = { pearl, gold, barMat, glass };
  const B = new Batch(), B49 = new Batch(), B96 = new Batch();
  const BB = { both: B, '2049': B49, '2196': B96 };
  const blk = (x0, y0, z0, x1, y1, z1, era) => col.add([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], era && era !== 'both' ? { states: [era] } : {});
  // a rotated wall (radial axis = angle a; sx along the radius, sz along the tangent) as a chain of small boxes
  const rotBlk = (x, z, sx, sz, a, h, era) => {
    const long = Math.max(sx, sz), n = Math.max(1, Math.ceil(long / 0.45)), th = Math.max(0.35, Math.min(sx, sz));
    const ux = sx >= sz ? Math.cos(a) : -Math.sin(a), uz = sx >= sz ? Math.sin(a) : Math.cos(a), out = [];
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n - 0.5, px = x + ux * t * long, pz = z + uz * t * long; out.push(col.add([px - th / 2, 0, pz - th / 2], [px + th / 2, h, pz + th / 2], era ? { states: [era] } : {})); }
    return out;
  };
  const solid = (era, mat, x0, y0, z0, x1, y1, z1, collide = true) => { BB[era].box(mat, x0, y0, z0, x1, y1, z1); if (collide) return blk(x0, y0, z0, x1, y1, z1, era); return null; };
  const wallX = (z, x0, x1, h, gaps = [], era = 'both', mat = M.shell, t = 0.3) => { // wall along x at z
    const cuts = [x0]; for (const [a, b] of gaps) cuts.push(a, b); cuts.push(x1);
    for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > 0.02) solid(era, mat, cuts[i], 0, z - t / 2, cuts[i + 1], h, z + t / 2);
    for (const [a, b] of gaps) BB[era].box(mat, a, 2.7, z - t / 2, b, h, z + t / 2);
  };
  const wallZ = (x, z0, z1, h, gaps = [], era = 'both', mat = M.shell, t = 0.3) => {
    const cuts = [z0]; for (const [a, b] of gaps) cuts.push(a, b); cuts.push(z1);
    for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > 0.02) solid(era, mat, x - t / 2, 0, cuts[i], x + t / 2, h, cuts[i + 1]);
    for (const [a, b] of gaps) BB[era].box(mat, x - t / 2, 2.7, a, x + t / 2, h, b);
  };
  const floor = (x0, z0, x1, z1, ceilY) => {
    solid('both', M.floor96, x0, -0.3, z0, x1, 0, z1);
    B49.box(M.tile49, x0, 0, z0, x1, 0.012, z1);
    if (ceilY) B.box(M.ceiling, x0, ceilY, z0, x1, ceilY + 0.25, z1);
  };
  const src = (x, y, z, c, i, d, zone, era) => W.lightSrc.push({ p: [x, y, z], c, i, d, zone, era: era || null });
  const plane = (tex, w, h, pos, ry = 0, era = null, emissive = 1.2) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(emissive, emissive, emissive) }));
    m.position.set(...pos); m.rotation.y = ry; scene.add(m); if (era) T.only(m, era); return m;
  };
  const lightStrip = (era, x0, z0, x1, z1, y, mat) => BB[era].box(mat, x0, y - 0.05, z0, x1, y, z1);

  // ======================= GALLERY =======================
  const GH = 6;
  floor(-24, -9, 24, 9.6, GH);
  wallX(-9, -24, 24, GH, [[-15.2, -12.8], [12.8, 15.2]]);
  wallX(9.6, -24, 24, GH);
  wallZ(-24, -9, 9.6, GH);
  wallZ(24, -9, 9.6, GH, [[-1.6, 1.6]]);
  // dropped beams and pillars (both eras): the cover line on the north side
  for (const z of [-4.6, 3.4]) B.box(M.shellDark, -24, GH - 0.6, z - 0.35, 24, GH, z + 0.35);
  for (const x of [-18, -12, -6, 0, 6, 12, 18]) { solid('both', M.shell, x - 0.55, 0, -5.15, x + 0.55, GH, -4.05); B.box(M.rubber, x - 0.6, 0, -5.2, x + 0.6, 0.12, -4.0); }
  // pipes along the north wall + cable trays (both)
  for (const [y, r] of [[4.9, 0.14], [5.25, 0.1]]) B.cyl(M.darkSteel, 0, y, -8.65, r, 48, 10, [0, 0, Math.PI / 2]);
  B.box(M.steel, -24, 5.5, 8.6, 24, 5.56, 9.3);
  // 2049: Helix wall cladding, archive racks, desks, ceiling panels
  for (const [z, s] of [[-8.82, 1], [9.42, -1]]) B49.box(M.panel49, -23.8, 0.1, z - 0.04 * s, 23.8, 3.4, z + 0.04 * s);
  B49.box(M.panel49, -23.82, 0.1, -8.8, -23.74, 3.4, 9.4); B49.box(M.panel49, 23.74, 0.1, -8.8, 23.82, 3.4, 9.4);
  for (const x of [-13.2, -4.4, 4.4, 13.2]) {
    solid('2049', M.darkSteel, x - 0.45, 0, 2.2, x + 0.45, 2.3, 9.2);
    for (let k = 0; k < 6; k++) B49.box(cyan, x - 0.46, 0.3 + k * 0.33, 2.4, x + 0.46, 0.33 + k * 0.33, 2.42);
  }
  // the 2049 lockdown shutters: after 08:14 Helix sealed SL4 into bays (the rack lines continue them to the cells)
  for (const x of [-4.4, 4.4]) { solid('2049', M.darkSteel, x - 0.16, 0, -8.85, x + 0.16, 3.6, 2.2); for (let z = -8.4; z < 2; z += 0.9) B49.box(z % 1.8 < 0.9 ? red : M.panel49, x - 0.18, 1.0, z, x + 0.18, 1.15, z + 0.45); }
  W.shutterSign = [plane(TEX.lockdown(), 1.4, 0.7, [-4.22, 2.4, -2], Math.PI / 2, '2049', 1.0), plane(TEX.lockdown(), 1.4, 0.7, [4.22, 2.4, -2], -Math.PI / 2, '2049', 1.0)];
  for (const [x, z] of [[-20, -6.6], [8, -1.4], [19, 5.8]]) { solid('2049', M.panelDark49, x - 1, 0, z - 0.4, x + 1, 0.85, z + 0.4); B49.box(M.steel, x - 1.05, 0.85, z - 0.45, x + 1.05, 0.9, z + 0.45); }
  for (let x = -20; x <= 20; x += 5) { lightStrip('2049', x - 1.1, -1.8, x + 1.1, -1.4, GH - 0.62, white); lightStrip('2049', x - 1.1, 6.2, x + 1.1, 6.6, GH - 0.02, white); }
  // 2196: cells (pearl partitions, gold-lit frames, force bars), bunks, crates, the guard post, rubble
  for (const x of [-17.6, -13.2, -8.8, -4.4, 0, 4.4, 8.8, 13.2, 17.6]) {
    if (x === 0) {   // the partition between cells 3 and 4 has the vent (an open grate) low down
      solid('2196', pearl, x - 0.12, 0, 3.6, x + 0.12, 3.4, 6.9); solid('2196', pearl, x - 0.12, 0, 7.9, x + 0.12, 3.4, 9.45);
      solid('2196', pearl, x - 0.12, 1.65, 6.9, x + 0.12, 3.4, 7.9); solid('2196', pearl, x - 0.12, 0, 6.9, x + 0.12, 0.45, 7.9);
      blk(x - 0.12, 0, 6.9, x + 0.12, 1.65, 7.9, '2196');
    } else solid('2196', pearl, x - 0.12, 0, 3.6, x + 0.12, 3.4, 9.45);
    B96.box(trim, x - 0.18, 0, 3.45, x + 0.18, 3.6, 3.75); B96.box(goldDim, x - 0.03, 0.2, 3.44, x + 0.03, 3.3, 3.46);
  }
  B96.box(pearl, -17.6, 3.4, 3.45, 17.6, 3.7, 9.45);   // cell-row canopy
  B96.box(gold, -17.6, 3.38, 3.43, 17.6, 3.42, 3.47);
  CELL_X.forEach((cx, i) => {
    // force bars (one mesh per cell so each can drop)
    const g = new THREE.Group();
    for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 3.3, 0.035), barMat); b.position.set(cx - 1.9 + k * 0.475, 1.68, 3.6); g.add(b); }
    scene.add(g); T.only(g, '2196'); W.bars.push(g);
    W.barBoxes.push(col.add([cx - 2.1, 0, 3.45], [cx + 2.1, 3.4, 3.75], { states: ['2196'] }));
    solid('2196', pearl, cx + 0.6, 0, 8.4, cx + 2.05, 0.48, 9.42); B96.box(graphite, cx + 0.65, 0.48, 8.45, cx + 2.0, 0.56, 9.38);   // bunk
    B96.box(gold, cx - 0.4, 3.32, 6.2, cx + 0.4, 3.36, 6.5);
  });
  // the old Helix conduit box in Kai's cell (both eras: clean in 2049, corroded in 2196)
  const cv = P.conduit;
  solid('2049', M.panelDark49, cv[0] - 0.35, 0.7, 9.2, cv[0] + 0.35, 1.5, 9.45); B49.box(green, cv[0] - 0.1, 1.32, 9.18, cv[0] + 0.1, 1.38, 9.2);
  solid('2196', M.rust, cv[0] - 0.35, 0.7, 9.2, cv[0] + 0.35, 1.5, 9.45); B96.cyl(M.rust, cv[0], 3.6, 9.32, 0.07, 4.2, 8);
  // the vent between cells 3 and 4
  for (const z of [6.9, 7.86]) B96.box(M.darkSteel, -0.15, 0.45, z, 0.15, 1.65, z + 0.04);
  for (const y of [0.45, 1.61]) B96.box(M.darkSteel, -0.15, y, 6.9, 0.15, y + 0.04, 7.9);
  for (let k = 0; k < 6; k++) B96.box(M.steel, -0.025, 0.55 + k * 0.19, 6.92, 0.025, 0.575 + k * 0.19, 7.88);
  // guard post (2196) at the west end
  solid('2196', graphite, -23.2, 0, -2.6, -21.8, 1.05, 2.2); B96.box(pearl, -23.3, 1.05, -2.7, -21.7, 1.12, 2.3); B96.box(gold, -21.75, 0.9, -2.6, -21.7, 0.95, 2.2);
  W.screens.roster = plane(TEX.roster(false), 0.9, 0.68, [-22.4, 1.62, 1.3], Math.PI / 2, '2196');
  plane(TEX.monitor(3), 0.8, 0.5, [-22.4, 1.55, -0.2], Math.PI / 2, '2196'); plane(TEX.monitor(6), 0.8, 0.5, [-22.4, 1.55, -1.5], Math.PI / 2, '2196');
  W.consoleSparkPos = new THREE.Vector3(-22.2, 1.3, -0.4);
  // watch pylon (2196): a gold ring over the walkway
  B96.cyl(pearl, -8, 3.2, 0.4, 0.12, 6.4, 10); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 40), gold); ring.position.set(-8, 4.6, 0.4); ring.rotation.x = Math.PI / 2; scene.add(ring); T.only(ring, '2196'); W.pylonRing = ring;
  // Continuum storage cases (cover)
  for (const [x, z, w] of [[-9.4, -1.8, 1.6], [9.6, -1.6, 1.8], [19.6, -6.6, 2], [-19.4, -6.8, 1.6], [3.2, -7.4, 1.4]]) { solid('2196', graphite, x - w / 2, 0, z - 0.5, x + w / 2, 1.05, z + 0.5); B96.box(gold, x - w / 2, 0.98, z + 0.5, x + w / 2, 1.0, z + 0.52); }
  // 2196 decay: rubble, cracks, hanging cables
  for (const [x, z, s] of [[-23, 8.4, 1.2], [22.6, -7.8, 1.5], [-6.6, -8.4, 0.9], [23, 7.6, 1.0]]) B96.geo(M.shellDark, new THREE.DodecahedronGeometry(s, 0), [x, s * 0.35, z], [0.3, x, 0.2], [1, 0.45, 1]);
  for (const x of [-21, -3, 9, 21]) B96.cyl(M.rubber, x, GH - 1.2, -2, 0.025, 2.4, 5);
  // light strips (2196): cold gold lines in the ceiling; emergency red when services are cut
  W.galLights = new THREE.Group();
  for (let x = -20; x <= 20; x += 5) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.12), white); s.position.set(x, GH - 0.64, -1.6); W.galLights.add(s); }
  scene.add(W.galLights); T.only(W.galLights, '2196');
  for (let x = -18; x <= 18; x += 9) src(x, GH - 0.8, -1.2, 0xfff0d8, 26, 15, 'gal');
  src(-2.2, 3.1, 6.4, 0xffd8a0, 10, 7, 'gal'); src(2.2, 3.1, 6.4, 0xffd8a0, 8, 7, 'gal');
  src(-21.5, 2.6, -0.4, 0xffd27a, 10, 8, 'gal', '2196');
  // signs
  plane(TEX.d4sign(), 2.6, 0.82, [0, 4.6, -8.82], 0, '2196');
  plane(TEX.sl4sign(), 2.6, 0.82, [0, 4.6, -8.76], 0, '2049', 1.0);
  // doors from the gallery
  W.doors.power96 = solid('2196', pearl, -15.2, 0, -9.12, -12.8, 2.7, -8.88); B96.box(gold, -14.05, 0.2, -8.86, -13.95, 2.5, -8.85);
  W.doors.east = makeSlide(scene, T, col, pearl, gold, [24, 0, 0], 'z', 3.2, 2.9, ['2196'], 0.3);
  W.doors.armoury = makeSlide(scene, T, col, pearl, gold, [14, 0, -9], 'x', 2.4, 2.7, ['2196'], 0.24);
  W.doors.vault = makeSlide(scene, T, col, M.darkSteel, red, [14, 0, -9.05], 'x', 2.4, 2.7, ['2049'], 0.34);

  // set dressing: floor inlays and hazard paint, vertical conduits, ceiling sensors (2196) / cameras and exit signs (2049)
  const paint = new THREE.MeshStandardMaterial({ color: 0xd9b020, roughness: 0.6 }), extRed = new THREE.MeshStandardMaterial({ color: 0xb01e1e, roughness: 0.45 });
  for (const z of [-2.9, 3.05]) B96.box(goldDim, -23.6, 0.004, z - 0.03, 23.6, 0.01, z + 0.03);
  B49.box(paint, -23.6, 0.013, 2.0, 23.6, 0.018, 2.12); B49.box(paint, -23.6, 0.013, -3.4, 23.6, 0.018, -3.28);
  for (let x = -21; x <= 21; x += 6) { B.cyl(M.darkSteel, x, GH / 2, -8.72, 0.07, GH, 8); B.box(M.steel, x - 0.18, 1.3, -8.84, x + 0.18, 1.7, -8.76); }
  for (const x of [-15, -3, 9, 21]) { B96.geo(pearl, new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), [x, GH - 0.6, 0.6], [Math.PI, 0, 0]); B96.cyl(gold, x, GH - 0.62, 0.6, 0.235, 0.03, 18); }
  for (const x of [-12, 12]) { B49.box(M.panelDark49, x - 0.12, GH - 1.0, -8.7, x + 0.12, GH - 0.8, -8.4); B49.box(red, x - 0.03, GH - 0.95, -8.41, x + 0.03, GH - 0.9, -8.39); }
  for (const x of [-19, 7]) B49.box(extRed, x - 0.25, 0.9, -8.8, x + 0.25, 1.6, -8.62);
  B49.box(green, -21.6, 2.75, -8.82, -20.4, 3.05, -8.78);
  B.box(M.steel, -24, 4.4, -7.2, 24, 4.46, -6.6); for (let x = -22; x <= 22; x += 4) B.box(M.darkSteel, x - 0.03, 4.46, -6.95, x + 0.03, GH - 0.6, -6.85);
  for (let x = 26; x < 55; x += 3) B.cyl(M.darkSteel, x, 3.9, -2.6, 0.08, 3.0, 8, [0, 0, Math.PI / 2]);
  for (const r of [6, 12]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.04, r + 0.04, 72), goldDim); ring.rotation.x = -Math.PI / 2; ring.position.set(TC[0], 0.006, TC[1]); scene.add(ring); T.only(ring, '2196'); }

  // ======================= SUBSTATION (2049) / RELAY VAULT (2196) =======================
  floor(-22, -21, -8, -9, 4.5);
  wallZ(-22, -21, -9, 4.5); wallZ(-8, -21, -9, 4.5); wallX(-21, -22, -8, 4.5);
  B49.box(M.panel49, -21.84, 0.1, -20.8, -21.8, 3.4, -9.2); B49.box(M.panel49, -8.2, 0.1, -20.8, -8.16, 3.4, -9.2);
  W.breakerFaces = [];
  P.breakers.forEach(([x, z], i) => {
    solid('2049', M.panelDark49, x - 0.8, 0, z - 0.5, x + 0.8, 2.2, z + 0.4);
    const face = plane(TEX.breaker('ABC'[i], [['GALLERY', 'SERVICES'], ['ROW', 'CIRCUIT 3-4'], ['VAULT &', 'EAST GATE']][i], true), 0.9, 1.12, [x, 1.35, z + 0.42], 0, '2049', 1.0);
    W.breakerFaces.push(face);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), M.steel); lever.position.set(x + 0.62, 1.3, z + 0.48); scene.add(lever); T.only(lever, '2049'); (W.levers ||= []).push(lever);
    solid('2196', M.rust, x - 0.8, 0, z - 0.5, x + 0.8, 2.0, z + 0.3);
  });
  solid('2049', M.steel, -11.6, 0, -15.2, -9.4, 2.4, -12.8); for (let k = 0; k < 6; k++) B49.box(M.darkSteel, -11.65, 0.3 + k * 0.35, -15.25, -9.35, 0.42 + k * 0.35, -12.75);   // transformer
  for (const x of [-19.5, -10.5]) { solid('2196', pearl, x - 0.4, 0, -12.4, x + 0.4, 4.4, -11.6); B96.box(gold, x - 0.42, 0.4, -11.62, x + 0.42, 4.0, -11.58); }
  B49.box(M.steel, -21.8, 3.6, -20.6, -8.2, 3.66, -19.6);
  W.ivenNote = plane(TEX.ivenNote(), 0.5, 0.34, [-21.78, 1.4, -15.5], Math.PI / 2, '2049', 1.0);
  src(-15, 4.0, -15, 0xeaf2ff, 22, 13, 'pow', '2049'); src(-15, 4.0, -15, 0xffc060, 10, 10, 'pow', '2196');
  lightStrip('2049', -16, -15.2, -14, -14.8, 4.48, white); B96.box(goldDim, -21.8, 4.3, -15.1, -8.2, 4.35, -14.9);

  // ======================= RECORDS VAULT (2049) / ARMOURY (2196) =======================
  floor(8, -21, 22, -9, 4.5);
  wallZ(8, -21, -9, 4.5); wallZ(22, -21, -9, 4.5); wallX(-21, 8, 22, 4.5);
  for (const x of [10.6, 13.2, 17.4]) { solid('2049', M.steel, x - 0.4, 0, -20.4, x + 0.4, 2.6, -14.2); for (let k = 0; k < 4; k++) B49.box(M.panelDark49, x - 0.42, 0.4 + k * 0.6, -20.4, x + 0.42, 0.44 + k * 0.6, -14.2); }
  B49.box(M.panel49, 21.8, 0.1, -20.8, 21.84, 3.4, -9.2); B49.box(M.panel49, 8.16, 0.1, -20.8, 8.2, 3.4, -9.2);
  // armoury: racks with displacer-shaped rifles, the locker, a table, the gate console
  for (const x of [10, 12.6]) { solid('2196', graphite, x - 1.1, 0, -20.9, x + 1.1, 2.4, -20.3); for (let k = 0; k < 4; k++) { B96.box(trim, x - 0.9 + k * 0.5, 0.6, -20.25, x - 0.82 + k * 0.5, 1.9, -20.18); B96.box(gold, x - 0.88 + k * 0.5, 1.2, -20.17, x - 0.84 + k * 0.5, 1.3, -20.16); } }
  solid('2196', pearl, 18.8, 0, -20.9, 20.6, 2.3, -20.1); B96.box(gold, 18.8, 2.3, -20.12, 20.6, 2.34, -20.08);
  W.lockerDoor = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.1, 0.06), graphite); W.lockerDoor.position.set(19.7, 1.1, -20.06); scene.add(W.lockerDoor); T.only(W.lockerDoor, '2196');
  W.displacer = buildDisplacer(); W.displacer.position.set(19.7, 1.25, -20.3); W.displacer.rotation.y = Math.PI / 2; scene.add(W.displacer); T.only(W.displacer, '2196');
  solid('2196', graphite, 14.2, 0, -16.4, 16.8, 0.9, -15.2); B96.box(pearl, 14.1, 0.9, -16.5, 16.9, 0.96, -15.1);
  solid('2196', graphite, 21.2, 0, -15, 21.8, 1.1, -12); W.screens.dossier = plane(TEX.dossier(), 0.9, 0.68, [21.15, 1.7, -14.1], -Math.PI / 2, '2196');
  plane(TEX.monitor(1), 0.8, 0.5, [21.15, 1.6, -12.7], -Math.PI / 2, '2196');
  plane(TEX.monitor(5), 1.1, 0.7, [11, 1.8, -20.85], 0, '2196');
  src(15, 4.0, -15, 0xfff0d8, 18, 12, 'arm', '2196'); src(15, 4.0, -15, 0xeaf2ff, 18, 12, 'arm', '2049');
  lightStrip('2196', 12, -15.1, 18, -14.9, 4.48, white); lightStrip('2049', 12, -17.1, 18, -16.9, 4.48, white);

  // ======================= TRANSIT SPINE =======================
  floor(24, -3.2, 55, 3.2, 4.2);
  wallX(-3.2, 24, 55, 4.2, [[28, 32], [40, 44]]); wallX(3.2, 24, 55, 4.2); wallZ(55, -3.2, 3.2, 4.2, [[-1.8, 1.8]]);
  for (const ax of [30, 42]) { floor(ax - 2, -6.6, ax + 2, -3.2, 3.2); wallX(-6.6, ax - 2, ax + 2, 3.2); wallZ(ax - 2, -6.6, -3.2, 3.2); wallZ(ax + 2, -6.6, -3.2, 3.2); }
  for (let x = 26; x < 55; x += 4) { B.box(M.shellDark, x - 0.2, 0, -3.1, x + 0.2, 4.2, -2.9); B.box(M.shellDark, x - 0.2, 0, 2.9, x + 0.2, 4.2, 3.1); }
  B49.box(M.panel49, 24, 0.1, 2.98, 55, 2.8, 3.02); for (let x = 27; x < 55; x += 6) lightStrip('2049', x - 1, -0.2, x + 1, 0.2, 4.18, white);
  for (const [x0, x1] of [[24, 28], [32, 40], [44, 55]]) B49.box(M.steel, x0, 2.2, -2.95, x1, 2.26, -2.6);
  // Continuum barricades (2196): a zig-zag and a checkpoint arch
  for (const [x, z0, z1] of [[35.5, -3.0, -0.4], [45.5, 0.4, 3.0], [49.5, -3.0, -1.2]]) { solid('2196', pearl, x - 0.35, 0, z0, x + 0.35, 1.2, z1); B96.box(gold, x - 0.36, 1.1, z0, x + 0.36, 1.14, z1); }
  solid('2196', graphite, 40.4, 0, -4.4, 43.6, 2.6, -3.6);   // blocks the 2049 alcove at x=42 in 2196
  for (const z of [-3.0, 3.0]) B96.box(pearl, 51.6, 0, z - 0.3, 52.4, 3.6, z + 0.3); B96.box(pearl, 51.6, 3.4, -3.2, 52.4, 3.8, 3.2); B96.box(gold, 51.62, 3.36, -3.1, 52.38, 3.4, 3.1);
  W.screens.doctrine = plane(TEX.doctrine(), 2.6, 0.87, [38, 2.6, 3.02], Math.PI, '2196');
  for (let x = 28; x < 55; x += 8) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.1), white); s.position.set(x, 4.14, 0); scene.add(s); T.only(s, '2196'); }
  for (let x = 28; x < 55; x += 9) src(x, 3.7, 0, 0xfff0d8, 16, 11, 'spine');

  // ======================= TESTING CHAMBER =======================
  const [cx, cz] = TC, CH = 12;
  { const fl = new THREE.Mesh(new THREE.CircleGeometry(TR + 3.4, 48), M.floor96); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.001, cz); scene.add(fl);
    col.add([cx - TR - 3.4, -0.3, cz - TR - 3.4], [cx + TR + 3.4, 0, cz + TR + 3.4]);
    const tl = new THREE.Mesh(new THREE.CircleGeometry(TR, 48), M.tile49); tl.rotation.x = -Math.PI / 2; tl.position.set(cx, 0.012, cz); scene.add(tl); T.only(tl, '2049');
    const ce = new THREE.Mesh(new THREE.CircleGeometry(TR + 1, 48), M.ceiling); ce.rotation.x = Math.PI / 2; ce.position.set(cx, CH, cz); scene.add(ce); }
  const NSEG = 40;
  const gapAt = (a) => { const deg = ((a * 180 / Math.PI) % 360 + 360) % 360; return Math.abs(deg - 180) < 7 || Math.abs(deg) < 6 || deg > 354 || LOOP_ANG.some(l => Math.abs(((l * 180 / Math.PI) - deg)) < 4.5); };
  for (let i = 0; i < NSEG; i++) {
    const a = (i + 0.5) / NSEG * Math.PI * 2; if (gapAt(a)) continue;
    const segW = 2 * Math.PI * (TR + 0.2) / NSEG + 0.08, x = cx + Math.cos(a) * (TR + 0.2), z = cz + Math.sin(a) * (TR + 0.2);
    B.boxc(M.shell, x, CH / 2, z, 0.4, CH, segW, -a);
    rotBlk(x, z, 0.4, segW, a, CH);
    B96.boxc(pearl, cx + Math.cos(a) * (TR - 0.05), 1.4, cz + Math.sin(a) * (TR - 0.05), 0.12, 2.8, segW, -a);
    B96.boxc(gold, cx + Math.cos(a) * (TR - 0.12), 2.86, cz + Math.sin(a) * (TR - 0.12), 0.03, 0.04, segW, -a);
    B49.boxc(M.panel49, cx + Math.cos(a) * (TR - 0.05), 1.7, cz + Math.sin(a) * (TR - 0.05), 0.1, 3.4, segW, -a);
  }
  // connection to the spine (west) and the exit (east)
  floor(55, -1.8, cx - TR + 0.4, 1.8, 4.2); wallX(-1.8, 55, cx - TR + 0.5, 4.2); wallX(1.8, 55, cx - TR + 0.5, 4.2);
  W.doors.chamber = makeSlide(scene, T, col, pearl, gold, [55.2, 0, 0], 'z', 3.4, 3.4, null, 0.3);
  W.doors.exit = makeSlide(scene, T, col, pearl, gold, [cx + TR + 0.2, 0, 0], 'z', 3.2, 3.4, null, 0.4);
  // the rig at the centre
  solid('both', M.darkSteel, cx - 2.2, 0, cz - 2.2, cx + 2.2, 1.1, cz + 2.2, false); col.addBox(cx, 0, cz, 4.0, 1.1, 4.0);
  B.cyl(M.steel, cx, 0.55, cz, 2.5, 1.1, 32);
  const rig = new THREE.Group();
  const r96 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 10, 64), gold); r96.rotation.x = Math.PI / 2; const r96b = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.05, 8, 64), gold);
  const g96 = new THREE.Group(); g96.add(r96, r96b); g96.position.set(cx, 4.2, cz); rig.add(g96); T.only(g96, '2196');
  const r49 = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.18, 10, 64), M.steel); const r49c = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.04, 6, 64), cyan); r49c.position.z = 0.19;
  const g49 = new THREE.Group(); g49.add(r49, r49c); g49.position.set(cx, 3.6, cz); rig.add(g49); T.only(g49, '2049');
  scene.add(rig); W.rig = { g96, g49 };
  // cover: Continuum barriers (2196) and Helix test benches (2049)
  W.cover96 = [];
  for (const [deg, r] of [[30, 8], [80, 9.5], [140, 8], [215, 8.5], [270, 9], [330, 8], [180, 11.5], [0, 11]]) {
    const a = deg * Math.PI / 180, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    B96.boxc(pearl, x, 0.6, z, 0.6, 1.2, 2.4, -a); B96.boxc(gold, x, 1.22, z, 0.62, 0.04, 2.4, -a);
    const dx = Math.abs(Math.cos(a)) * 0.3 + Math.abs(Math.sin(a)) * 1.2, dz = Math.abs(Math.sin(a)) * 0.3 + Math.abs(Math.cos(a)) * 1.2;
    blk(x - dx, 0, z - dz, x + dx, 1.2, z + dz, '2196'); W.cover96.push([x, z]);
  }
  for (const deg of [55, 165, 245, 300]) {
    const a = deg * Math.PI / 180, x = cx + Math.cos(a) * 5.6, z = cz + Math.sin(a) * 5.6;
    B49.boxc(M.panelDark49, x, 0.5, z, 1.8, 1.0, 0.8, -a + Math.PI / 2); B49.boxc(cyan, x, 1.02, z, 1.6, 0.03, 0.5, -a + Math.PI / 2);
    blk(x - 0.9, 0, z - 0.9, x + 0.9, 1.0, z + 0.9, '2049');
  }
  // the observation window (north) and the Prefect's balcony
  B.box(M.shellDark, cx - 4, 5.2, cz - TR - 2.6, cx + 4, 5.4, cz - TR + 0.2);
  B.box(glass, cx - 3.5, 5.4, cz - TR + 0.02, cx + 3.5, 8.0, cz - TR + 0.06);
  B96.box(gold, cx - 3.6, 5.38, cz - TR + 0.1, cx + 3.6, 5.42, cz - TR + 0.14);
  // Helix plate (2049) / doctrine (2196) at the west door
  W.screens.hall = plane(TEX.hallPlate(), 1.6, 0.62, [cx - TR + 0.6, 2.2, -2.6], Math.PI / 2, '2049', 1.0);
  // loop cells on the south arc: glass alcoves
  LOOP_ANG.forEach((a, i) => {
    const x = cx + Math.cos(a) * (TR + 1.6), z = cz + Math.sin(a) * (TR + 1.6);
    B.boxc(M.shellDark, cx + Math.cos(a) * (TR + 3.1), CH / 2, cz + Math.sin(a) * (TR + 3.1), 0.4, CH, 3.2, -a);
    for (const s of [-1, 1]) { const px = x + Math.cos(a + Math.PI / 2) * 1.4 * s, pz = z + Math.sin(a + Math.PI / 2) * 1.4 * s; B.boxc(M.shellDark, px, CH / 2, pz, 3.0, CH, 0.3, -a); rotBlk(px, pz, 3.0, 0.3, a, CH); }
    rotBlk(cx + Math.cos(a) * (TR + 3.1), cz + Math.sin(a) * (TR + 3.1), 0.4, 3.2, a, CH);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.0, 2.6), new THREE.MeshPhysicalMaterial({ color: 0xffd27a, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false, emissive: 0x3a2a08, side: THREE.DoubleSide }));
    gl.position.set(cx + Math.cos(a) * (TR + 0.15), 1.5, cz + Math.sin(a) * (TR + 0.15)); gl.rotation.y = -a; scene.add(gl); W.loopGlass.push(gl);
    W.loopBoxes ||= []; W.loopBoxes.push(rotBlk(gl.position.x, gl.position.z, 0.3, 2.6, a, 3.0));
    const ringF = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.5, toneMapped: false, side: THREE.DoubleSide }));
    ringF.rotation.x = -Math.PI / 2; ringF.position.set(cx + Math.cos(a) * (TR - 1.0), 0.03, cz + Math.sin(a) * (TR - 1.0)); scene.add(ringF); (W.loopRings ||= []).push(ringF);
  });
  W.screens.loop = plane(TEX.loopPanel(0), 1.4, 0.7, [P.loopPanel[0], 1.5, P.loopPanel[2] + 0.36], Math.PI, '2196');
  solid('2196', graphite, P.loopPanel[0] - 0.9, 0, P.loopPanel[2] + 0.2, P.loopPanel[0] + 0.9, 1.0, P.loopPanel[2] + 0.6);
  const hring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.08, 6, 80), white); hring.rotation.x = Math.PI / 2; hring.position.set(cx, CH - 1.4, cz); scene.add(hring);
  src(cx, CH - 2, cz, 0xfff0d8, 40, 26, 'test'); src(cx, 4.2, cz, 0xffd27a, 18, 12, 'test', '2196'); src(cx, 3.6, cz, 0x9fe8ff, 18, 12, 'test', '2049');
  src(cx - 10, 6, cz + 8, 0xfff0d8, 16, 14, 'test'); src(cx + 10, 6, cz - 8, 0xfff0d8, 16, 14, 'test'); src(cx, 6.5, cz - TR - 1.4, 0xffd27a, 10, 8, 'test');

  // ======================= SHAFT, GANTRY, BREACH =======================
  const SX0 = cx + TR + 0.4;
  floor(SX0, -6, 92, 6, 9);
  wallX(-6, SX0, 114, 9); wallX(6, SX0, 114, 9); wallZ(SX0, -6, 6, 9, [[-1.6, 1.6]]);
  solid('both', M.shellDark, 92, -24, -6, 114, -23.6, 6, false);
  // gantry: intact span, the broken gap (97 .. 103.5), the far span, the breach ledge
  const gW = 1.3;
  for (const [x0, x1] of [[92, 97], [103.5, 108]]) { solid('both', M.darkSteel, x0, -0.25, -gW, x1, 0, gW); for (const s of [-1, 1]) { B.box(M.steel, x0, 0, s * gW - 0.03, x1, 1.05, s * gW + 0.03); blk(x0, 0, s * gW - 0.1, x1, 1.1, s * gW + 0.1); } }
  for (const [x, s] of [[97, 1], [103.5, -1]]) for (let k = 0; k < 5; k++) B.cyl(M.rust, x + s * 0.3, -0.1, -1 + k * 0.5, 0.025, 1.0, 5, [0, 0, s * 1.1]);
  solid('both', M.floor96, 108, -0.3, -5, 114, 0, 5);
  // the breach: the outer wall at x = 114 is torn open; a ledge beyond
  wallZ(114, -6, 6, 9, [[-3.6, 3.6]], 'both', M.shellDark, 0.6);
  solid('both', M.floor96, 114, -0.4, -4, 121, 0, 4);
  for (const [z, s] of [[-3.8, 1], [3.8, -1]]) B.geo(M.shellDark, new THREE.DodecahedronGeometry(1.1, 0), [116, 0.3, z], [0.3, s, 0.2], [1.2, 0.5, 1]);
  // a shielded sentry post at the near platform
  solid('both', M.darkSteel, 89.2, 0, -3.6, 90.8, 1.1, -2.4);
  for (let x = 88; x < 114; x += 7) src(x, 7.5, 0, 0xfff0d8, 14, 14, 'shaft');
  src(117, 3, 0, 0xffa060, 30, 30, 'out');

  // ======================= EXTERIOR (establishing shot + the breach view) =======================
  const ext = new THREE.Group(); W.ext = ext; scene.add(ext);
  try {
    for (const [x0, y0, z0, x1, y1, z1] of [[-27, -1, -25, 100, 15, 23], [100, -1, -25, 114.6, 15, -6.3], [100, -1, 6.3, 114.6, 15, 23], [100, 9, -6.3, 114.6, 15, 6.3]]) {
      const mass = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), M.shellDark); mass.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); mass.castShadow = false; mass.receiveShadow = false; ext.add(mass);
    }
    // the ruined Helix tower above the block, and the Continuum spire grafted onto it
    const tower = RZ.cityBlock([
      { width: 34, depth: 30, height: 44, position: [-6, 15, -4], seed: 7, wall: 'concrete', ruin: 0.85, collapse: 0.6, moss: 0.3, faces: ['windows', 'windows', 'windows', 'windows'] },
      { width: 26, depth: 26, height: 30, position: [30, 15, 4], seed: 9, wall: 'concrete', ruin: 0.7, moss: 0.25, faces: ['windows', 'windows', 'windows', 'windows'] },
    ], { era: '2196', lit: 0.0, daylight: 0.6, detail: low ? 'low' : undefined });
    tower.mesh.castShadow = false; ext.add(tower.mesh);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 7.5, 58, 24, 1), pearl); spire.position.set(70, 15 + 29, 0); ext.add(spire);
    for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(7.2 - k * 1.0, 0.18, 6, 48), gold); r.rotation.x = Math.PI / 2; r.position.set(70, 22 + k * 12, 0); ext.add(r); }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.3, 9, 24), pearl); cap.position.set(70, 77.5, 0); ext.add(cap);
    // the ruined city east of the breach
    const city = [];
    const R = RZ.rng(1010);
    for (let i = 0; i < (low ? 9 : 14); i++) {
      const x = 150 + R() * 160, z = -120 + R() * 240, h = 16 + R() * 60;
      city.push({ width: 14 + R() * 14, depth: 14 + R() * 14, height: h, position: [x, -18, z], yaw: R() * 0.4, seed: 20 + i, wall: R() < 0.5 ? 'concrete' : 'brick', ruin: 0.6 + R() * 0.4, collapse: R() < 0.4 ? 0.5 : 0, moss: 0.3 + R() * 0.4, faces: ['windows', 'windows', 'windows', 'windows'] });
    }
    const cb = RZ.cityBlock(city, { era: '2196', lit: 0.02, daylight: 0.5, detail: low ? 'low' : undefined }); cb.mesh.castShadow = false; ext.add(cb.mesh);
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M.floor96); gnd.rotation.x = -Math.PI / 2; gnd.position.set(200, -18, 0); ext.add(gnd);
    try { const sk = RZ.skyline({ center: [60, 0], radius: [340, 560], arc: [-1.4, 1.4], count: low ? 40 : 70, height: [30, 120], lit: 0.02 }); if (sk) ext.add(sk.mesh || sk); } catch (e) { void e; }
  } catch (e) { console.warn('m10 exterior', e); }
  // the survivors' skiff at the ledge (both eras: it arrives only at the end)
  W.skiff = buildSkiff(pearl, M); W.skiff.position.set(124, -2, 0); W.skiff.visible = false; scene.add(W.skiff);

  // ======================= shards =======================
  SHARDS.forEach(([x, y, z, era]) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x5fe6ff, emissiveIntensity: 2.4, roughness: 0.2 }));
    m.position.set(x, y, z); m.userData.noBatch = true; scene.add(m); T.only(m, era); W.shardMeshes.push(m);
  });

  // ======================= build batches =======================
  const shell = B.build(scene, { blockers: true, game });
  const m49 = B49.build(scene, { blockers: true, game }); const m96 = B96.build(scene, { blockers: true, game });
  for (const d of Object.values(W.doors)) if (d.group) game.blocker(d.group.children[0]);
  for (const m of m49) T.only(m, '2049');
  for (const m of m96) T.only(m, '2196');
  W.shell = shell;

  W.update = (dt, t) => {
    for (const m of W.shardMeshes) { m.rotation.y += dt * 1.4; m.position.y += Math.sin(t * 2 + m.position.x) * 0.0015; }
    if (W.pylonRing) W.pylonRing.rotation.z += dt * 0.4;
    W.rig.g96.rotation.y += dt * 0.25; W.rig.g49.rotation.x = Math.PI / 2 + Math.sin(t * 0.4) * 0.05;
    barMat.opacity = 0.7 + Math.sin(t * 3.1) * 0.08;
    for (const d of Object.values(W.doors)) d.update?.(dt);
    for (const f of W.updaters) f(dt, t);
  };
  return W;
}

// a sliding door slab on an axis ('x' = door spans x, slides up; 'z' = spans z)
function makeSlide(scene, T, col, mat, trimMat, pos, axis, w, h, states, t = 0.3) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? w : t, h, axis === 'x' ? t : w), mat); slab.position.y = h / 2; g.add(slab);
  const line = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.06 : t + 0.02, h * 0.9, axis === 'x' ? t + 0.02 : 0.06), trimMat); line.position.y = h / 2; g.add(line);
  g.position.set(...pos); scene.add(g); if (states) T.only(g, ...states);
  const box = col.add(axis === 'x' ? [pos[0] - w / 2, 0, pos[2] - t / 2 - 0.05] : [pos[0] - t / 2 - 0.05, 0, pos[2] - w / 2], axis === 'x' ? [pos[0] + w / 2, h, pos[2] + t / 2 + 0.05] : [pos[0] + t / 2 + 0.05, h, pos[2] + w / 2], states ? { states } : {});
  const d = { group: g, box, open: 0, target: 0, h,
    update(dt) { d.open += (d.target - d.open) * Math.min(1, dt * 2.4); g.position.y = pos[1] + d.open * (h - 0.25); box.enabled = d.open < 0.6; } };
  return d;
}

function buildDisplacer() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x3a3a2c, roughness: 0.6, metalness: 0.4 });
  const plate = new THREE.MeshPhysicalMaterial({ color: 0xe6e8ea, roughness: 0.2, clearcoat: 1 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(new THREE.BoxGeometry(0.62, 0.1, 0.08), body, 0, 0, 0);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10), body, 0.42, 0.01, 0).rotation.z = Math.PI / 2;
  add(new THREE.BoxGeometry(0.08, 0.16, 0.06), body, -0.12, -0.11, 0);
  add(new THREE.TorusGeometry(0.06, 0.016, 8, 20), glowMat(0xffd27a, 3), 0.18, 0.07, 0).rotation.y = Math.PI / 2;
  add(new THREE.BoxGeometry(0.2, 0.05, 0.09), plate, 0.18, 0.07, 0);
  add(new THREE.BoxGeometry(0.06, 0.06, 0.1), glowMat(0xb6ff8a, 1.4), -0.24, 0.07, 0);
  return g;
}

function buildSkiff(pearl, M) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.0, 3.2), M.rust); hull.position.y = 0.5; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.12, 2.8), M.darkSteel); deck.position.y = 1.06; g.add(deck);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 2.2), M.rust); cab.position.set(2.2, 1.7, 0); g.add(cab);
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.5, 16), M.darkSteel); f.position.set(s * 2.6, -0.1, 1.9); g.add(f); const f2 = f.clone(); f2.position.z = -1.9; g.add(f2); }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glowMat(0xb6ff8a, 2.2)); lamp.position.set(3.3, 2.4, 0); g.add(lamp);
  return g;
}
