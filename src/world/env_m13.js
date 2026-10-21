// Mission 13 environment: the Sable Yards, an inner-city rail and tram district on the east side of Rain City, in three
// authored states. North = -z. Roads at y = 0, pavements and the interchange plaza at Y0.
//   2026  the Sable Yards Interchange is being built: hoardings, the foundation pit with six pile cages, a tower crane,
//         the site office and a concrete mixer waiting for the 11:20 pour. Overcast Tuesday morning, 14.04.2026.
//   2049  the district is held in one second (08:14:00, Sunday 19.10.2049) since the Zero Second: rain hanging in the
//         air, traffic and people stopped mid-step, a tram stopped at the interchange. Helix cordon at the south end.
//   2196  the war: the Unwritten behind a scrap barricade in the south, the Continuum behind pearl barriers under the
//         rail viaduct in the north, and between them the Continuum's stabilizer standing where the interchange was.
// Layout (x, z):
//   Sable Street (road x -7..7, pavements to ±11) runs the whole length, z 84 .. -84.
//   South: the Helix cordon (2049, z 78), the Unwritten camp (2196, z 46..80), their barricade at z 42.
//   The interchange plaza x -26..26, z -24..22 (tram platforms 2049 / foundation pit 2026 / stabilizer 2196 at (0, -2)).
//   West of the plaza: the Yard Hall (rail shed). East: the quay, the Sable Canal (x 32..42) and Sable Bridge (z -4..4).
//   North: the rail viaduct (z -52..-46, deck 7 m); the Continuum line at z -40 and their command pavilion at z -60.
// Static geometry is merged per material (env_m6 Batch): one shared batch (viaduct, canal, bridge) plus one per state.
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, neonSign } from './kit.js';
import { Batch } from './env_m6.js';
import { streetKit, trainCar } from './props.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';
import { combatState } from '../systems/combat.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
export const Y0 = 0.15;
export const SPIRE = [0, -2], DOME_R = 12.5;
/** ground height: the road is at 0, pavements, the plaza, the quay and the east bank at Y0 */
export const groundY = (x, z) => ((z > 22 || z < -24) && (Math.abs(x) < 7 || (Math.abs(x) > 11 && x < 26)) ? 0 : (x >= 32 && x <= 42 && Math.abs(z) > 4) ? -2.2 : Y0);
export const P = {
  start: [0, Y0, 80, Math.PI], cordon: [0, 0, 77.5], note1: [8.9, 1.0, 50.2],
  arrive96: [1.5, Y0, 52, Math.PI], lasker: [-6.4, Y0, 61.6], sera: [8.6, Y0, 57.8], fire: [0, 0, 66], mapBoard: [-9.9, 1.5, 64.2],
  manifesto: [-10.9, 1.6, 70], tally: [-4.6, 1.3, 46.4],
  gap: [2.5, 0, 42], plazaEdge: [0, Y0, 23],
  nell: [-9.0, Y0, 30.4], balcony: [-11, 3.4, 30.4], bolts: [-10.2, Y0, 30.4],
  senn: [18.6, Y0, 19.4],
  tramAnchor: [-15.2, Y0, -7.9], tramCab: [-14.6, 1.6, -8],
  office: [-18, Y0, 11.5], pileBoard: [-15.3, 1.5, 11.4], deliveryNote: [-17.2, 1.1, 13.2], cranePanel: [13.4, Y0, -9.6],
  cageEdge: [0, Y0, 6.6], cageHang: [0, 4.2, 2],
  quay: [24, Y0, -1], bridgeW: [28, Y0, 0], bridgeAnchor: [35, Y0, 0], walk49: [33, Y0, 3.4],
  north: [0, Y0, -38], contGate: [0, Y0, -41], adair: [0, Y0, -60], contLog: [2.6, 1.3, -61.4],
  e1: [6.6, Y0, 45.2], e2: [-8.2, 1.0, -39.2], e3: [0, Y0, 11.6],
  spireStair: [0, Y0, 9.2], core: [0, 2.4, 1.0], couplings: [[-3.46, 2.4, -4.0], [3.46, 2.4, -4.0], [0, 2.4, 3.0]],
};
export const CAGES = [[-5, -6], [0, -6], [5, -6], [-5, 2], [0, 2], [5, 2]];   // C-1 .. C-6; the client's fitting is in C-5
export const ANCHOR_CAGE = 4;
export const SHARDS = [
  [-9.9, 0.6, 75.6, '2196', 'the Unwritten camp, behind the stove pipes'],
  [12.8, 0.7, -13.6, '2049', 'under the held tram platform'],
  [-20.6, 0.7, 13.8, '2026', 'behind the 2026 site office'],
  [40.6, 0.7, 3.6, '2049', 'at the east end of the jammed bridge'],
  [-20.5, 0.7, -35.5, '2196', 'in the ruin by the Continuum line'],
];
// barrage impact points by area (2196): the same shells landing in the same holes, every cycle
export const IMPACTS = {
  south: [[-3.5, 36.5], [5.5, 33.5], [0.5, 29.5], [-7.5, 27.5], [4.5, 24.5], [-2.5, 21.5]],
  plaza: [[-15, 14], [15, 12], [-17, -9], [18, -14], [-8, 17], [9, -19]],
  bridge: [[23.5, -2.5], [26.5, 5], [22, 4], [27, -5.5]],
  field: [[-6, 38], [7, 31], [-14, 12], [16, 8], [-4, -30], [7, -27], [0, 26], [-18, -12]],
};

// ---------------------------------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites an existing id). Every look carries era, sex/age and a COSTUMES.md archetype.
// ---------------------------------------------------------------------------------------------------------------------
export const UNWRITTEN = [
  { era: '2196', costume: 'surv_m1', sex: 0, age: 34, height: 1.8, build: 1.0, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'buzz', stubble: true, topType: 'jacket', top: 0x5a4a38, topKind: 'fabric', vest: 0x7a3e22, hood: true, pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, gloves: 0x3a3028, lod: true },
  { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 27, height: 1.7, build: 0.96, skin: 0xd9a585, hair: 0x2a1c14, hairStyle: 'tied-back', topType: 'jacket', top: 0x6a5a44, topKind: 'fabric', vest: 0x7a3e22, pantsType: 'cargo', pants: 0x3a3a30, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_m2', sex: 0, age: 58, height: 1.72, build: 0.94, skin: 0xe0b394, hair: 0x8a8278, hairStyle: 'short', beard: 0x8a8278, topType: 'jacket', top: 0x6a6a64, topKind: 'fabric', vest: 0x7a3e22, pantsType: 'trousers', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 41, height: 1.66, build: 1.02, skin: 0x6b4029, hair: 0x0e0a08, hairStyle: 'bun', topType: 'jacket', top: 0x8a7458, topKind: 'fabric', hood: true, vest: 0x7a3e22, pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, lod: true },
];
export const WORKER26 = [
  { era: '2026', costume: 'c26_m2', sex: 0, age: 38, height: 1.79, build: 1.08, skin: 0xd9a585, hair: 0x2a1c14, hairStyle: 'short', stubble: true, topType: 'jacket', top: 0x2a3a4e, topKind: 'fabric', vest: 0xd4c21a, cap: 0xe8e8e0, pantsType: 'cargo', pants: 0x2d2a26, shoes: 'boots', boots: 0x3a2a1a, gloves: 0x5a4a3a, lod: true },
  { era: '2026', costume: 'c26_m1', sex: 0, age: 26, height: 1.76, build: 0.96, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'buzz', topType: 'tshirt', top: 0x5a4a3a, topKind: 'fabric', vest: 0xff8a1e, cap: 0xe8e8e0, pantsType: 'cargo', pants: 0x3a3a3a, shoes: 'boots', boots: 0x3a2a1a, gloves: 0x5a4a3a, lod: true },
];
export const KEEPER_NOTE = 'Continuum troopers who walk in the held second (continuum_1)';
export function registerM13Cast() {
  registerCast('lasker', {
    name: 'DOV LASKER', role: 'The Unwritten · field commander, Sable Yards',
    bio: 'Commands the Unwritten at the Sable Yards. Has been fighting the same nine minutes for longer than he will admit, and blames Kai Varen for the reason there is a war at all.',
    look: { era: '2196', costume: 'surv_m1', sex: 0, age: 52, height: 1.84, build: 1.1, skin: 0xa77a5d, hair: 0x6a6a64, hairStyle: 'buzz', beard: 0x6a6a64, eyes: 0x3a3028, scar: true,
      face: { jaw: 0.6, cheek: 0.1, nose: 0.35, noseWidth: 0.3, lips: -0.3, brow: 0.55, eyeSize: -0.25, faceLength: 0.2, chin: 0.35 },
      topType: 'armored', top: 0x4a3a28, topKind: 'fabric', vest: 0x7a3e22, armor: true, pantsType: 'cargo', pants: 0x3a3a30, shoes: 'boots', boots: 0x2a2018, gloves: 0x2a2420, belt: 0x4a3a28, wrinkles: 0.55 },
    rimColor: 0xff8f6a, glow: 0x2a140c, bg: 0x120c0a,
    vp: { sex: 'm', pitch: 0.78, rate: 0.95, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('nell', {
    name: 'NELL ASHBY', role: 'The Unwritten · medic',
    bio: 'The Unwritten\'s only trained medic at the Yards. Went into no-man\'s land after a runner and a balcony came down on her.',
    look: { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 38, height: 1.68, build: 0.98, skin: 0xc49a7c, hair: 0x5a3a22, hairStyle: 'tied-back', eyes: 0x4a5a3a, freckles: 0.25,
      face: { jaw: -0.1, cheek: 0.35, nose: 0.05, noseWidth: 0.1, lips: 0.1, brow: 0.1, eyeSize: 0.1, faceLength: 0.05, chin: 0 },
      topType: 'jacket', top: 0xb8ab90, topKind: 'fabric', vest: 0x7a3e22, hood: true, pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, gloves: 0x3a3028 },
    rimColor: 0xff8f6a, vp: { sex: 'f', pitch: 1.04, rate: 1.02, langs: ['en-GB', 'en-AU', 'en-US'] },
  });
  registerCast('senn', {
    name: 'TROOPER ARVID SENN', role: 'The Continuum · forward post, pinned down',
    bio: 'Twenty-four. Lost his post, his helmet and, he says, count of how many times he has lived this morning.',
    look: { era: '2196', costume: 'continuum_1', sex: 0, age: 24, height: 1.82, build: 1.0, skin: 0xe8c0a0, hair: 0xb89a6a, hairStyle: 'short', eyes: 0x4a6a8a,
      face: { jaw: 0.1, cheek: 0.2, nose: 0.05, noseWidth: -0.1, lips: 0.05, brow: -0.1, eyeSize: 0.2, faceLength: 0.1, chin: 0 },
      topType: 'armored', top: 0xe6e8ea, topKind: 'synthetic', armor: true, pantsType: 'trousers', pants: 0x202328, shoes: 'boots', boots: 0x202328, gloves: 0x202328, belt: 0x8a9098 },
    rimColor: 0xffd27a, vp: { sex: 'm', pitch: 1.02, rate: 1.08, langs: ['en-GB', 'en-US'] },
  });
  registerCast('m13foreman', {
    name: 'GRETA OYELARAN', role: 'Site manager · Sable Yards Interchange, 2026',
    bio: 'Runs the foundation works for the new interchange. Has a pour booked for 11:20 and no time for a man who walked out of her hoarding.',
    look: { era: '2026', costume: 'c26_f2', sex: 1, female: true, age: 47, height: 1.7, build: 1.02, skin: 0x6b4029, hair: 0x0e0a08, hairStyle: 'tied-back', eyes: 0x2a1a0e,
      face: { jaw: 0.1, cheek: 0.45, nose: 0, noseWidth: 0.3, lips: 0.2, brow: 0.2, eyeSize: -0.05, faceLength: 0.05, chin: 0.05 },
      topType: 'jacket', top: 0x2a3a4e, topKind: 'fabric', vest: 0xd4c21a, cap: 0xe8e8e0, pantsType: 'cargo', pants: 0x2d2a26, shoes: 'boots', boots: 0x3a2a1a, wrinkles: 0.3 },
    rimColor: 0xffb36a, vp: { sex: 'f', pitch: 0.98, rate: 1.04, langs: ['en-GB', 'en-NG', 'en-US'] },
  });
  registerCast('m13pa', { name: 'CONTINUUM ADDRESS', role: 'Sable Yards · stabilizer field', voice: true, vp: { sex: 'f', pitch: 1.08, rate: 0.96, langs: ['en-GB', 'en-US'] } });
  registerCast('m13band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist · field reading', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m13fighter', { name: 'UNWRITTEN FIGHTER', role: 'Sable Yards barricade', look: { ...UNWRITTEN[0], lod: false }, vp: { sex: 'm', pitch: 0.92, rate: 1.04, langs: ['en-GB', 'en-US'] } });
  registerCast('m13keeper', { name: 'CONTINUUM KEEPER', role: 'Walks in the held second', look: { era: '2196', costume: 'continuum_1', sex: 0, age: 30, height: 1.86, build: 1.06, skin: 0xd9a585, hair: 0x111111, hairStyle: 'buzz', topType: 'armored', top: 0xe6e8ea, topKind: 'synthetic', armor: true, pantsType: 'trousers', pants: 0x202328, shoes: 'boots', boots: 0x202328, gloves: 0x202328, belt: 0x8a9098 }, vp: { sex: 'm', pitch: 0.82, rate: 0.98, langs: ['en-GB', 'en-US'] } });
  registerCast('m13worker', { name: 'SITE WORKER', role: 'Sable Yards Interchange, 2026', look: { ...WORKER26[0], lod: false }, vp: { sex: 'm', pitch: 0.94, rate: 1.06, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music (bible: "Nine-Minute War: urgency and tactical adaptation; layered percussion, short string ostinati, distorted
// breath textures, tempo feels like it is slipping; 118 BPM, strings in changing meters, brief gaps and reversed
// impacts, no trailer booms").
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { barrage: 0, anchors: 0, truth: 0, freed: 0 };
export function registerM13Themes() {
  registerTheme('m13-held', { bpm: 40, step(a, s, t, d) {          // 2049: one held second; glass harmonics, no pulse
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0 && bar % 2 === 0) a.pad([52, 59, 64, 71], t, d * 32, 0.012, 300);
    if (b === 0) a.glass([83, 88, 86, 81][bar % 4], t, 0.012);
    if (b === 8 && bar % 3 === 1) a.glass(76, t, 0.008);
    if (b === 12 && bar % 4 === 3) a.tick(t, 0.008, 1800);           // the one clock tick that never lands
  } });
  registerTheme('m13-camp', { bpm: 72, step(a, s, t, d) {          // the Unwritten camp / Sera: warm pluck, low strings
    const bar = Math.floor(s / 16), b = s % 16, ch = [[50, 57, 62], [48, 55, 60], [46, 53, 58], [45, 52, 57]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.015, 480); a.cello(ch[0] - 12, t, d * 16, 0.04); }
    if ([0, 3, 6, 10].includes(b)) a.pluck(ch[(b >> 2) % 3] + 12, t, 0.05);
    if (b === 8 && bar % 2) a.flute(ch[2] + 12, t, d * 6, 0.016);
    if (b % 8 === 4 && musicState.barrage > 0.2) a.drum(t, 0.05, 70, 36);   // the war through the walls
  } });
  registerTheme('m13-war', { bpm: 118, step(a, s, t, d) {          // the battle: bars of 16 and 14 steps, so the downbeat slips
    const cyc = s % 30, bar = Math.floor(s / 30) * 2 + (cyc >= 16 ? 1 : 0), b = cyc >= 16 ? cyc - 16 : cyc, len = cyc >= 16 ? 14 : 16;
    const th = Math.max(combatState.threat, musicState.barrage * 0.7), gap = bar % 8 === 7 && b >= 8;
    if (gap) { if (b === 8) a.glass(91, t, 0.012); return; }          // a brief gap, then the bar comes back
    if (b === 0 || b === 6 || (len === 16 && b === 10) || (len === 14 && b === 9)) a.drum(t, 0.13 + th * 0.07, 104, 42);
    if (th > 0.3 && b % 4 === 2) a.drum(t, 0.05, 190, 92);
    a.tick(t, b % 2 ? 0.009 : 0.018 * (0.6 + th), 6200);
    if (b % 2 === 0) a.cello([38, 41, 43, 41, 36, 38, 45][(b >> 1) % 7] + (bar % 4 === 3 ? 3 : 0), t, d * 1.6, 0.038 + th * 0.022);
    if (b === 0) a.pad([62, 65, 70], t, d * len, 0.011, 600);
    if (b === len - 2 && th > 0.45) a.glass(86 - (bar % 3) * 2, t, 0.014);   // the "reversed" impact: a rising glass before the downbeat
  } });
  registerTheme('m13-site', { bpm: 92, step(a, s, t, d) {          // 2026: a working morning, plucked and hopeful
    const bar = Math.floor(s / 16), b = s % 16, ch = [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.012, 900);
    if (b % 4 === 0) a.pluck(ch[(b >> 2) % 3] + 12, t, 0.045);
    if (b === 6 || b === 14) a.piano(ch[2] + 12 + (bar % 2 ? 2 : 0), t, 0.06, 2.2);
    if (b % 8 === 4) a.tick(t, 0.01, 3600);
  } });
  registerTheme('m13-truth', { bpm: 84, step(a, s, t, d) {         // the recognition: a nine-step figure against a 16-step bar
    const bar = Math.floor(s / 16), b = s % 16, k = s % 9;
    if (b === 0) { a.pad([50, 57, 60], t, d * 16, 0.013, 420); a.cello(bar % 2 ? 38 : 43, t, d * 16, 0.04); }
    if (k === 0) a.glass([74, 77, 81][Math.floor(s / 9) % 3] + (musicState.truth > 2 ? 5 : 0), t, 0.014);
    if (k === 4 && musicState.truth > 0) a.pluck(62 + musicState.truth * 2, t, 0.035);
    if (b % 4 === 0) a.tick(t, 0.014, 3000);
  } });
  registerTheme('m13-silence', { bpm: 52, step(a, s, t, d) {       // the ceasefire: almost nothing
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0 && bar % 2 === 0) { a.pad([45, 52, 57], t, d * 32, 0.012, 260); a.drum(t, 0.05, 55, 30); }
    if (b === 8 && bar % 4 === 1) a.piano(69, t, 0.06, 5);
  } });
  registerTheme('m13-choice', { bpm: 62, step(a, s, t, d) {        // the stabilizer core: piano and cello
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 64], [41, 48, 53, 60], [43, 50, 55, 62], [40, 47, 52, 59]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016, 520); a.cello(ch[0] - 12, t, d * 16, 0.045); }
    if (b === 0 || b === 6 || b === 10) a.piano(ch[(b / 2) % 4 | 0] + 12, t, 0.09, 3.2);
    if (b === 12 && bar % 2) a.glass(ch[3] + 24, t, 0.012);
  } });
  registerTheme('m13-free', { bpm: 66, step(a, s, t, d) {          // the held second lets go: the motif, then the strings bloom
    const bar = Math.floor(s / 16), b = s % 16, ch = [[48, 55, 60, 64], [45, 52, 57, 64], [41, 48, 53, 60], [43, 50, 55, 62]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.018 + Math.min(0.01, bar * 0.002), 700 + bar * 60); a.cello(ch[0] - 12, t, d * 16, 0.05); }
    if ([0, 6, 12].includes(b)) a.piano([76, 83, 81][b / 6] - (bar % 2 ? 2 : 0), t, 0.12, 4);
    if (b === 8 && bar > 1) a.flute(ch[3] + 12, t, d * 6, 0.018);
  } });
  registerTheme('m13-break', { bpm: 70, step(a, s, t, d) {         // the stabilizer comes apart: low and heavy, then air
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([38, 45, 50], t, d * 16, 0.015, 300); a.cello(26, t, d * 16, 0.05); }
    if (b % 8 === 0 && bar < 6) a.drum(t, 0.12, 60, 32);
    if (b === 10 && bar % 2) a.glass(74, t, 0.01);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Code-drawn signs, boards and screens
// ---------------------------------------------------------------------------------------------------------------------
const lines = (g, list, x, y, size, col, lh = 1.35, weight = 600) => { g.font = `${weight} ${size}px ${FONT}`; list.forEach((l, i) => { g.fillStyle = Array.isArray(l) ? l[1] : col; g.fillText(Array.isArray(l) ? l[0] : l, x, y + i * size * lh); }); };
const grain = (g, w, h, n, a, seed = 3) => { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } };
export const TEX = {
  sign: (t, sub, bg = '#16222c', fg = '#e8eef2', key = '') => canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.font = `700 54px ${FONT}`; g.fillText(t, w / 2, 82); if (sub) { g.font = `600 26px ${FONT}`; g.globalAlpha = 0.7; g.fillText(sub, w / 2, 128); }
  }, 'm13sign' + t + sub + key),
  cordon: () => canvasTex(512, 32, (g, w, h) => { for (let x = -40; x < w; x += 40) { g.fillStyle = (x / 40) % 2 ? '#e8c21a' : '#111'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40, 0); g.lineTo(x + 20, h); g.lineTo(x - 20, h); g.fill(); } g.fillStyle = '#111'; g.font = `700 18px ${FONT}`; g.fillText('HELIX · TEMPORAL CORDON · DO NOT CROSS', 60, 22); }, 'm13cordon'),
  mapBoard: () => canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#b8ab90'; g.fillRect(0, 0, w, h); grain(g, w, h, 900, 0.08, 7);
    g.strokeStyle = '#3a3028'; g.lineWidth = 3; g.strokeRect(40, 30, 432, 320);
    g.fillStyle = '#5a4a38'; g.fillRect(236, 30, 40, 320);                     // the street
    g.strokeStyle = '#2a4a5a'; g.lineWidth = 14; g.beginPath(); g.moveTo(430, 30); g.lineTo(430, 350); g.stroke();   // canal
    g.beginPath(); g.arc(256, 196, 50, 0, 7); g.strokeStyle = '#8a6a2a'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#3a3028'; g.font = `700 18px ${FONT}`; g.fillText('SPIRE', 232, 202); g.fillText('US', 248, 334); g.fillText('PEARLS', 226, 52);
    g.strokeStyle = '#a02a1a'; g.lineWidth = 5;
    for (const [x, y] of [[220, 210], [420, 196], [300, 170]]) { g.beginPath(); g.moveTo(x - 12, y - 12); g.lineTo(x + 12, y + 12); g.moveTo(x + 12, y - 12); g.lineTo(x - 12, y + 12); g.stroke(); }
    g.fillStyle = '#a02a1a'; g.font = `600 15px ${FONT}`; g.fillText('tram (in the still year?)', 120, 240); g.fillText('bridge', 404, 180); g.fillText('the hole (when?)', 300, 150);
    g.fillStyle = '#3a3028'; g.font = `italic 600 16px ${FONT}`; g.fillText('3 stakes. no way to reach 2. — D.L.', 60, 374);
  }, 'm13map'),
  manifesto: () => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#4a4440'; g.fillRect(0, 0, w, h); grain(g, w, h, 1400, 0.12, 9);
    g.fillStyle = '#d8d0c0'; g.font = `700 40px ${FONT}`; g.fillText('NO HISTORY', 30, 70); g.fillText('IS FINAL', 60, 120);
    g.fillStyle = '#ff8f6a'; g.font = `700 26px ${FONT}`; g.fillText('WE ARE THE ONES', 220, 170); g.fillText('THEY DIDN\'T WRITE DOWN', 150, 206);
    g.strokeStyle = '#ff8f6a'; g.lineWidth = 6; g.beginPath(); g.moveTo(420, 40); g.lineTo(470, 110); g.moveTo(470, 40); g.lineTo(420, 110); g.stroke();
  }, 'm13manifesto'),
  tally: () => canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#1e2420'; g.fillRect(0, 0, w, h); grain(g, w, h, 800, 0.1, 11);
    lines(g, ['TUBE 3 · LASKER BATTERY', '06:12  out ×4   (answering)', '06:21  in  ×4   (their reply)', '06:21  out ×4   (answering)', '06:30  in  ×4', '06:30  out ×4  ...'], 26, 44, 26, '#e8e4d8', 1.45, 600);
    g.strokeStyle = '#e8e4d8'; g.lineWidth = 3; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(330 + (i % 7) * 22, 250 + Math.floor(i / 7) * 30); g.lineTo(336 + (i % 7) * 22, 274 + Math.floor(i / 7) * 30); g.stroke(); }
  }, 'm13tally'),
  contLog: () => canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#0e1014'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9a441'; g.lineWidth = 2; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#ffd27a'; g.font = `700 22px ${FONT}`; g.fillText('SABLE LINE · FIRE RECORD', 28, 48);
    lines(g, [['06:15:00  OUT  salvo 212   reply', '#e6e8ea'], ['06:24:00  IN   4 rounds   origin: S', '#ff8f6a'], ['06:24:00  OUT  salvo 213   reply', '#e6e8ea'], ['06:33:00  IN   4 rounds   origin: S', '#ff8f6a'], ['interval between OUT and IN: 09:00:00', '#ffd27a']], 28, 92, 21, '#e6e8ea', 1.5, 600);
  }, 'm13contlog'),
  siteBoard: () => canvasTex(512, 360, (g, w, h) => {
    g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d4a7a'; g.fillRect(0, 0, w, 80);
    g.fillStyle = '#fff'; g.font = `700 30px ${FONT}`; g.fillText('SABLE YARDS INTERCHANGE', 24, 50);
    lines(g, ['Foundation works · Phase 1', 'Client: Rain City Transit Authority', 'Pour: Tue 14.04.2026 · 11:20', 'Site manager: G. Oyelaran', 'Hard hats · hi-vis · boots beyond this point'], 24, 128, 24, '#1a1a1a', 1.45, 600);
    g.fillStyle = '#e8c21a'; g.fillRect(0, h - 26, w, 26);
  }, 'm13siteboard'),
  pileBoard: () => canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#eceae2'; g.fillRect(0, 0, w, h); grain(g, w, h, 600, 0.05, 13);
    g.fillStyle = '#1a1a1a'; g.font = `700 26px ${FONT}`; g.fillText('PILE CAGES · POUR SEQUENCE', 22, 42);
    const rows = [['C-1', 'Ø900  12 m', 'checked'], ['C-2', 'Ø900  12 m', 'checked'], ['C-3', 'Ø900  12 m', 'checked'], ['C-4', 'Ø900  12 m', 'checked'], ['C-5', 'Ø900  12 m', 'CLIENT FITTING · DO NOT MOVE'], ['C-6', 'Ø900  12 m', 'checked']];
    rows.forEach((r, i) => { const y = 92 + i * 44; g.fillStyle = i === 4 ? '#a02a1a' : '#1a1a1a'; g.font = `700 24px ${FONT}`; g.fillText(r[0], 24, y); g.font = `600 20px ${FONT}`; g.fillText(r[1], 100, y); g.fillText(r[2], 250, y); g.strokeStyle = '#999'; g.beginPath(); g.moveTo(20, y + 14); g.lineTo(w - 20, y + 14); g.stroke(); });
    g.fillStyle = '#555'; g.font = `italic 600 17px ${FONT}`; g.fillText('layout: C-1 C-2 C-3 north row · C-4 C-5 C-6 south row', 22, h - 18);
  }, 'm13pileboard'),
  note: () => canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, w, h); grain(g, w, h, 300, 0.06, 17);
    g.strokeStyle = '#2a2a3a'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(20, 50 + i * 34); for (let x = 20; x < 230; x += 10) g.lineTo(x, 50 + i * 34 + Math.sin(x * 0.3 + i) * 3); g.stroke(); }
  }, 'm13note'),
  plate: (t) => canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#e8c21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = `700 36px ${FONT}`; g.textAlign = 'center'; g.fillText(t, w / 2, 46); }, 'm13plate' + t),
  stop: () => canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#0e1a22'; g.fillRect(0, 0, w, h); g.fillStyle = '#5fe6ff'; g.fillRect(0, 0, 14, h); g.fillStyle = '#e8eef2'; g.font = `700 44px ${FONT}`; g.fillText('SABLE YARDS', 34, 60); g.font = `600 24px ${FONT}`; g.globalAlpha = 0.75; g.fillText('Interchange · lines 4  7  11', 34, 100); }, 'm13stop'),
  clock: (txt, warn) => canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#0c0c10'; g.fillRect(0, 0, w, h); g.fillStyle = warn ? '#ff8f6a' : '#ffd27a'; g.font = `700 58px ${FONT}`; g.textAlign = 'center'; g.fillText(txt, w / 2, 68); }, null),
  shimmer: () => canvasTex(256, 256, (g, w, h) => { const r = rng(5); for (let i = 0; i < 80; i++) { g.strokeStyle = `rgba(255,220,140,${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 40, w * 0.7, y + (r() - 0.5) * 40, w, y + (r() - 0.5) * 20); g.stroke(); } }, 'm13shimmer'),
  ring: () => canvasTex(128, 128, (g, w) => { g.strokeStyle = '#ff5a3a'; g.lineWidth = 7; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 6, 0, 7); g.stroke(); g.lineWidth = 3; g.globalAlpha = 0.6; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 22, 0, 7); g.stroke(); }, 'm13ring'),
  scorch: () => canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(10,8,6,.95)'); gr.addColorStop(0.6, 'rgba(20,16,12,.6)'); gr.addColorStop(1, 'rgba(20,16,12,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, 'm13scorch'),
};

// ---------------------------------------------------------------------------------------------------------------------
// The district
// ---------------------------------------------------------------------------------------------------------------------
export function buildSable(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low';
  const W = { lightSrc: [], groups: {}, cages: [], fighters: [], blasts: [], tracers: [], smoke: [], tick: [] };
  const col = game.collision, R = rng(1313);
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const M = {
    asphalt: pm('wetAsphalt', { color: 0x34363a, puddles: 0.6 }),
    asphalt26: pm('wetAsphalt', { color: 0x3c3e42, puddles: 0.15 }),
    asphalt96: pm('wetAsphalt', { color: 0x3a3632, puddles: 0.1 }),
    paving: pm('concrete', { color: 0x7a7a76, slabs: 1, stains: 0.45, formwork: 0, wet: 0.7 }),
    paving96: pm('concrete', { color: 0x6a645a, slabs: 1, stains: 0.9, formwork: 0, wet: 0 }),
    plaza: pm('cutStone', { color: 0x8c8880 }),
    concrete: pm('concrete', { color: 0x8c8c88, formwork: 1, stains: 0.35 }),
    concreteNew: pm('concrete', { color: 0xa8a8a2, formwork: 1, stains: 0.08 }),
    concrete96: pm('concrete', { color: 0x6e6a62, formwork: 1, stains: 1 }),
    dirt: pm('dirt', { color: 0x5a4a38 }),
    gravel: pm('gravel', { color: 0x6a645a }),
    steel: pm('brushedMetal', { color: 0x9aa0a6, roughness: 0.32 }),
    dark: pm('brushedMetal', { color: 0x30353c, roughness: 0.45 }),
    rust: pm('rust', { color: 0x4a2a14, paint: 0x3d4a52, amount: 0.6 }),
    rustHeavy: pm('rust', { color: 0x5a3018, paint: 0x5a3a28, amount: 0.95 }),
    wood: pm('wood', { color: 0x6a4a30, planks: 8 }),
    ply: pm('wood', { color: 0xb08a5a, planks: 2 }),
    rubber: pm('rubber', { color: 0x1a1b1d }),
    paint: pm('paintedMetalPanel', { color: 0x2e4a44, cols: 2, rows: 2, wear: 0.3, grime: 0.3, gloss: 0.45 }),
    hoard: pm('paintedMetalPanel', { color: 0x1d4a7a, cols: 4, rows: 1, wear: 0.1, grime: 0.15, gloss: 0.3 }),
    tile: pm('ceramicTile', { color: 0xa8a49a, grout: 0x6a6660, count: 2, gloss: 0.6, variation: 0.25 }),
  };
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 });
  const pearl = new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.18, metalness: 0.1, envMapIntensity: 1.3 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.5, metalness: 0.4 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.3, metalness: 0.85 });
  const goldGlow = glowMat(0xffd27a, 2.4), ember = glowMat(0xff7a3a, 2.4);
  const hiVis = new THREE.MeshStandardMaterial({ color: 0xe8c21a, roughness: 0.6 });
  const tarp = new THREE.MeshStandardMaterial({ color: 0x5a5444, roughness: 0.95, side: THREE.DoubleSide });
  const tarpRed = new THREE.MeshStandardMaterial({ color: 0x7a3e22, roughness: 0.95, side: THREE.DoubleSide });
  const sand = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 });
  W.mats = { pearl, goldTrim, goldGlow, graphite };
  const S = { common: new Batch(), '2026': new Batch(), '2049': new Batch(), '2196': new Batch() };
  const g26 = new THREE.Group(), g49 = new THREE.Group(), g96 = new THREE.Group();
  scene.add(g26, g49, g96); T.only(g26, '2026'); T.only(g49, '2049'); T.only(g96, '2196');
  W.groups = { '2026': g26, '2049': g49, '2196': g96 };
  const G = { '2026': g26, '2049': g49, '2196': g96 };
  const box = (x0, y0, z0, x1, y1, z1, states) => col.add([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], states ? { states } : {});
  const src = (x, y, z, c, i, d, era = 'all') => W.lightSrc.push({ p: [x, y, z], c, i, d, era });
  const plane = (tex, w, h, x, y, z, ry, era, emiss = 0.25, parent) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emiss, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; (parent || (era ? G[era] : scene)).add(m); return m;
  };

  // ================= ground: roads at 0, pavements and the plaza at Y0 (surfaces per state) =================
  box(-62, -1, -88, 62, 0, 88);
  box(-62, 0, 86, 62, 30, 88); box(-62, 0, -88, 62, 30, -86); box(-62, 0, -88, -60, 30, 88); box(60, 0, -88, 62, 30, 88);
  for (const [x0, x1] of [[-60, 32], [42, 60]]) {
    S['2049'].box(M.asphalt, x0, -0.3, -86, x1, 0, 86); S['2026'].box(M.asphalt26, x0, -0.3, -86, x1, 0, 86); S['2196'].box(M.asphalt96, x0, -0.3, -86, x1, 0, 86);
  }
  const pave = (x0, z0, x1, z1, mats = [M.paving, M.paving, M.paving96], states = null) => {
    const eras = ['2026', '2049', '2196'];
    eras.forEach((e, i) => { if (!states || states.includes(e)) S[e].box(mats[i], x0, 0, Math.min(z0, z1), x1, Y0, Math.max(z0, z1)); });
    box(x0, 0, z0, x1, Y0, z1, states);
  };
  pave(-11, 22, -7, 86); pave(7, 22, 11, 86); pave(-11, -86, -7, -24); pave(7, -86, 11, -24);       // Sable Street pavements
  pave(-26, -24, 26, 22, [M.dirt, M.plaza, M.paving96], ['2049', '2196']); box(-26, 0, -24, 26, Y0, 22);   // the plaza
  for (const [x0, z0, x1, z1] of [[-26, -24, 26, -9], [-26, 5, 26, 22], [-26, -9, -8, 5], [8, -9, 26, 5]]) S['2026'].box(M.dirt, x0, 0, z0, x1, Y0, z1);   // 2026: the site around the pit
  pave(26, -24, 32, 22, [M.paving, M.paving, M.paving96]);                                           // the quay
  pave(42, -24, 60, 22, [M.paving, M.paving, M.paving96]);                                           // east bank

  // ================= the Sable Canal and the bridge (shared structure) =================
  try {
    const wat = RZ.water({ rect: [32, -86, 10, 172], level: -2.2, flow: [0, 0.04], deep: 0x16242a, shallow: 0x2e4a4a, heightAt: () => 3 });
    scene.add(wat.mesh); W.water = wat.mesh;
  } catch (e) { console.warn('m13 water', e); }
  for (const x of [32, 42]) { S.common.box(M.concrete, x - (x === 32 ? 0.6 : 0), -3, -86, x + (x === 42 ? 0.6 : 0), 0.15, 86); }
  S.common.box(M.concrete96, 32, -4, -86, 42, -3.2, 86);
  // railings along both canal edges (gap where the bridge meets the quay)
  for (const [x, z0, z1] of [[31.7, -86, -4.2], [31.7, 4.2, 86], [42.3, -86, -4.2], [42.3, 4.2, 86]]) {
    S.common.box(M.dark, x - 0.04, Y0, z0, x + 0.04, Y0 + 1.05, z1); S.common.box(M.dark, x - 0.06, Y0 + 1.0, z0, x + 0.06, Y0 + 1.08, z1);
    for (let z = z0; z <= z1; z += 2.5) S.common.box(M.dark, x - 0.05, Y0, z - 0.03, x + 0.05, Y0 + 1.05, z + 0.03);
    box(x - 0.15, 0, z0, x + 0.15, 1.3, z1);
  }
  // Sable Bridge: a 1930s riveted steel deck on two stone abutments (z -4..4)
  S.common.box(M.concrete, 30.5, -1.2, -4.4, 43.5, 0.0, 4.4);
  S.common.box(M.rust, 31, -1.9, -4.2, 43, -1.2, -3.6); S.common.box(M.rust, 31, -1.9, 3.6, 43, -1.2, 4.2);
  for (const z of [-4.1, 4.1]) {                      // parapet trusses
    S.common.box(M.rust, 30.5, Y0, z - 0.12, 43.5, Y0 + 0.25, z + 0.12); S.common.box(M.rust, 30.5, Y0 + 1.15, z - 0.1, 43.5, Y0 + 1.3, z + 0.1);
    for (let x = 31; x <= 43; x += 1.5) S.common.box(M.rust, x - 0.06, Y0, z - 0.08, x + 0.06, Y0 + 1.2, z + 0.08);
    box(30.5, 0, z - 0.2, 43.5, 1.4, z + 0.2);
  }
  pave(30.5, -4, 43.5, 4, [M.asphalt26, M.asphalt, M.asphalt96]);
  W.bridgeDeckY = Y0;

  // ================= the rail viaduct (shared), z -52..-46, deck at 7 m =================
  for (let x = -54; x <= 54; x += 12) { S.common.box(M.concrete, x - 1, 0, -51.5, x + 1, 7, -46.5); box(x - 1, 0, -51.5, x + 1, 7, -46.5); }
  S.common.box(M.concrete, -60, 7, -52.2, -6, 8.4, -45.8); S.common.box(M.concrete, 6, 7, -52.2, 60, 8.4, -45.8);
  S['2026'].box(M.concrete, -6, 7, -52.2, 6, 8.4, -45.8); S['2049'].box(M.concrete, -6, 7, -52.2, 6, 8.4, -45.8);   // 2196: the middle span is down
  S.common.box(M.dark, -60, 8.4, -52.2, 60, 9.4, -52.0); S.common.box(M.dark, -60, 8.4, -46.0, 60, 9.4, -45.8);
  S['2196'].geo(M.concrete96, new THREE.BoxGeometry(12, 1.4, 6.2), [-1, 3.0, -49], [0.2, 0.15, -0.5]);
  box(-5, 0, -51.5, 2, 4.2, -46.5, ['2196']);
  for (let k = 0; k < 6; k++) S['2196'].geo(M.concrete96, new THREE.BoxGeometry(1 + R(), 0.6 + R() * 0.6, 1 + R()), [-5 + R() * 9, 0.3, -53 + R() * 8], [R(), R(), R()]);

  // ================= buildings (one interior-mapped cityBlock per state; same footprints) =================
  const bld = (x0, x1, z0, z1, face, o) => {
    const yaw = face === '+x' ? Math.PI / 2 : face === '-x' ? -Math.PI / 2 : face === '-z' ? Math.PI : 0;
    const w = (face === '+z' || face === '-z') ? x1 - x0 : z1 - z0, d = (face === '+z' || face === '-z') ? z1 - z0 : x1 - x0;
    return { width: Math.abs(w), depth: Math.abs(d), position: [(x0 + x1) / 2, o.y ?? 0, (z0 + z1) / 2], yaw, ...o };
  };
  const FOOT = [
    [-30, -11, 54, 84, '+x', 20, 'brick'], [-30, -11, 28, 52, '+x', 17, 'plaster'], [-30, -11, -44, -24, '+x', 22, 'darkBrick'], [-30, -11, -86, -56, '+x', 26, 'concrete'],
    [11, 30, 54, 84, '-x', 18, 'stone'], [11, 30, 28, 52, '-x', 24, 'brick'], [11, 30, -44, -24, '-x', 19, 'plaster'], [11, 30, -86, -56, '-x', 28, 'panel'],
    [-56, -30, 24, 60, '+x', 14, 'brick'], [42, 60, 8, 30, '-x', 16, 'stone'], [42, 60, -30, -8, '-x', 12, 'brick'], [-56, -30, -44, -24, '+x', 18, 'concrete'],
  ];
  for (const [x0, x1, z0, z1] of FOOT) box(x0, 0, z0, x1, 40, z1);
  // the Yard Hall (rail shed) west of the plaza: one tall bay, gabled in 2026/2049, roofless in 2196
  box(-56, 0, -24, -26, 14, 22);
  const hallShell = (e, mat) => {
    const B = S[e];
    B.box(mat, -56, 0, -24, -26.4, 9, -23.4); B.box(mat, -56, 0, 21.4, -26.4, 9, 22);
    for (let z = -24; z < 22; z += 6) { B.box(mat, -26.6, 0, z, -26, 9, z + 1.2); B.box(e === '2196' ? M.rustHeavy : M.paint, -26.5, 1.2, z + 1.2, -26.3, 7.4, z + 6); }
    B.box(mat, -26.8, 9, -24, -25.8, 10, 22);
    if (e !== '2196') { B.geo(M.dark, new THREE.BoxGeometry(31, 0.3, 26), [-41, 12.2, -12], [0.42, 0, 0]); B.geo(M.dark, new THREE.BoxGeometry(31, 0.3, 26), [-41, 12.2, 10], [-0.42, 0, 0]); }
    else for (let x = -54; x < -27; x += 4) B.geo(M.rustHeavy, new THREE.BoxGeometry(0.3, 0.5, 46), [x, 9.6, -1], [0, 0, 0.1]);
  };
  hallShell('2026', M.concreteNew); hallShell('2049', M.concrete); hallShell('2196', M.concrete96);
  const blockFor = (era) => FOOT.map(([x0, x1, z0, z1, face, h, wall], i) => bld(x0, x1, z0, z1, face, {
    height: era === '2026' ? h - 2 : h, seed: 300 + i, wall: era === '2026' && wall === 'panel' ? 'concrete' : wall, era,
    groundFloor: 4.2, faces: i < 8 ? ['shop', 'windows', 'blank', 'windows'] : ['windows', 'windows', 'blank', 'windows'],
    groundBlank: i === 1 ? [true, false, false, false] : undefined,
    ...(era === '2049' ? { led: 0.45, holo: i % 3 === 0 ? 1 : 0, cables: true } : {}),
    ...(era === '2196' ? { ruin: 0.6 + (i % 3) * 0.12, moss: 0.4 + (i % 2) * 0.25, collapse: i % 3 === 1 } : {}),
    ...(era === '2026' ? { led: 0, holo: 0, roof: { solar: i % 2 === 0, hvac: 1 } } : {}),
  }));
  try {
    for (const era of ['2026', '2049', '2196']) {
      const b = RZ.cityBlock(blockFor(era), { era, lit: era === '2196' ? 0.0 : era === '2049' ? 0.22 : 0.08, daylight: era === '2196' ? 0.4 : 0.9, detail: low ? 'low' : undefined });
      G[era].add(b.mesh); W['block' + era] = b.mesh;
    }
    const sky = RZ.skyline({ center: [0, 0], radius: [150, 280], count: low ? 34 : 60, height: [36, 160], lit: 0.06, seed: 31 }); const sm = sky.mesh || sky; g26.add(sm); W.sky = sm;
    const sky49 = RZ.skyline({ center: [0, 0], radius: [150, 280], count: low ? 34 : 60, height: [36, 170], lit: 0.12, seed: 31 }); g49.add(sky49.mesh || sky49);
    const sky96 = RZ.skyline({ center: [0, 0], radius: [150, 280], count: low ? 26 : 44, height: [20, 110], lit: 0.0, seed: 33 }); g96.add(sky96.mesh || sky96);
  } catch (e) { console.warn('m13 city', e); }

  // ================= streets per state (props.js streetKit) =================
  const kits = {};
  for (const era of ['2026', '2049', '2196']) {
    const k = streetKit({ era, seed: era === '2026' ? 26 : era === '2049' ? 49 : 96 });
    k.kerb([[-7, 86], [-7, 22]]).kerb([[7, 22], [7, 86]]).kerb([[-7, -24], [-7, -86]]).kerb([[7, -86], [7, -24]], {});
    if (era !== '2196') k.markings({ lanes: [{ from: [0, 84], to: [0, 24] }, { from: [0, -26], to: [0, -84] }], crossings: [{ at: [0, 26], yaw: Math.PI / 2, width: 13 }, { at: [0, -28], yaw: Math.PI / 2, width: 13 }] });
    k.scatter('lamp', [[9.6, 84], [9.6, 24]], { spacing: 16, turn: -Math.PI / 2, y: Y0 }).scatter('lamp', [[-9.6, 84], [-9.6, 24]], { spacing: 16, turn: Math.PI / 2, y: Y0, offset: 0 });
    k.scatter('lamp', [[9.6, -26], [9.6, -84]], { spacing: 16, turn: -Math.PI / 2, y: Y0 }).scatter('lamp', [[-9.6, -26], [-9.6, -84]], { spacing: 16, turn: Math.PI / 2, y: Y0 });
    k.bins([[8, Y0, 70], [-8, Y0, 44], [8, Y0, -30]]).benches([[9.5, Y0, 64, -Math.PI / 2]]);
    if (era === '2049') {
      k.car([-3.6, 0, 72, 0.04], 0).car([3.4, 0, 60, Math.PI]).van([-3.4, 0, 46, 0.05]).car([3.6, 0, 34, Math.PI - 0.1]).car([-3.2, 0, -30, 0]).van([3.4, 0, -36, Math.PI]).scooter([-8.6, Y0, 56, 0.4]);
      k.car([31.6, Y0, -1.5], Math.PI / 2).car([36.6, Y0, -1.4], Math.PI / 2).van([40.8, Y0, -1.3], Math.PI / 2).car([33.4, Y0, 1.2], -Math.PI / 2).car([38.8, Y0, 1.2], -Math.PI / 2);
      k.shelter([8.9, Y0, 50], -Math.PI / 2).puddles([[-2, 66, 1.6], [2.4, 40, 1.4], [-5, 30, 1.8], [10, 12, 1.4], [-12, -16, 1.6], [3, -30, 1.4]]);
      k.cables([[[-11, 9, 66], [11, 8.5, 64]], [[-11, 9, 38], [11, 9, 36]]]);
      k.rails([[-26, -8.6], [26, -8.6]], { embedded: true }).rails([[-26, -7.4], [26, -7.4]], { embedded: true }).catenary([[-26, -8], [26, -8]], { height: 6, spacing: 13 });
    } else if (era === '2196') {
      k.car([-3.4, 0, 36, 0.6], 0).car([4, 0, 18, 2.1]).car([-14, 0, 8, 1.2]).car([16, 0, -16, 0.3]).van([3.2, 0, -30, Math.PI + 0.4]).car([-4, 0, 74, 0.2]);
      k.overgrowth({ area: [-11, -86, 11, 86] }, { density: 0.5, cracks: 0.7 }).overgrowth({ area: [-26, -24, 26, 22] }, { density: 0.35, cracks: 0.8 });
      k.scatter('rubble', { area: [-11, -40, 11, 40] }, { count: 18 }).scatter('rubble', { area: [-26, -24, 26, 22] }, { count: 16 });
    } else {
      k.car([-3.4, 0, 70, 0], 0).van([3.4, 0, 56, Math.PI]).car([-3.4, 0, -60, 0]).cones([[-1, 0, 40.5], [1, 0, 40.5], [-1, 0, -29.5], [1, 0, -29.5]]);
    }
    const built = k.build(); G[era].add(built); kits[era] = k;
    for (const c of k.colliders) col.add(c.min, c.max, { states: [era] });
  }

  // ================= 2049: the held second =================
  // the tram at the interchange (stopped with its doors half open), its platforms and shelters
  {
    const B = S['2049'];
    for (const z0 of [-12.6, -5.2]) { B.box(M.tile, -18, 0, z0, 18, 0.35, z0 + 2.2); box(-18, 0, z0, 18, 0.35, z0 + 2.2, ['2049']); B.box(hiVis, -18, 0.35, z0 + (z0 < -8 ? 2.1 : 0), 18, 0.36, z0 + (z0 < -8 ? 2.2 : 0.1)); }
    for (const [x, z] of [[-9, -12], [9, -12], [-9, -3.6], [9, -3.6]]) {
      B.box(M.dark, x - 2.4, 0.35, z - 0.1, x + 2.4, 2.9, z + 0.1); B.box(glass, x - 2.3, 0.6, z - 0.04, x + 2.3, 2.6, z + 0.04);
      B.box(M.dark, x - 2.6, 2.9, z - 0.9, x + 2.6, 3.0, z + 0.9); box(x - 2.4, 0.35, z - 0.15, x + 2.4, 2.9, z + 0.15, ['2049']);
    }
    plane(TEX.stop(), 3.2, 0.8, -9, 3.4, -11.9, 0, '2049', 0.6); plane(TEX.stop(), 3.2, 0.8, 9, 3.4, -3.7, Math.PI, '2049', 0.6);
    const tram = new THREE.Group(); tram.position.set(0, Y0, -8); g49.add(tram); W.tram = tram;
    for (const cx of [-7.0, 7.0]) { const car = trainCar(13.6, 0xe9edf2, 0x5fe6ff); car.rotation.y = Math.PI / 2; car.position.set(cx, 0, 0); car.scale.set(0.9, 0.95, 1); tram.add(car); }
    const gang = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.4, 2.2), M.rubber); gang.position.set(0, 1.9, 0); tram.add(gang);
    for (const dz of [-0.75, 0.75]) { const hl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), glowMat(0xfff2d8, 5)); hl.position.set(-13.95, 1.25, dz); tram.add(hl); }
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3), new THREE.MeshBasicMaterial({ map: TEX.sign('7 · SABLE', '', '#05080a', '#ffb347', 'dest'), toneMapped: false })); dest.position.set(-13.92, 3.05, 0); dest.rotation.y = -Math.PI / 2; tram.add(dest);
    for (const [x, z] of [[-9.6, -1.38], [-2.6, -1.38], [4.4, -1.38], [11.2, -1.38]]) { const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.1), new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: 0xffe9c8, emissiveIntensity: 0.35, roughness: 0.4 })); door.position.set(x, 1.45, z); door.rotation.y = Math.PI; tram.add(door); }
    const pant = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), M.dark); pant.position.set(-6, 4.0, 0); pant.rotation.z = 0.5; tram.add(pant);
    box(-14.2, 0, -9.55, 14.2, 3.6, -6.45, ['2049']);
    // the anchor: a gold Continuum stake driven through the cab's windscreen into the driver's console
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 2.0, 10), goldGlow); stake.position.set(-13.6, 1.75, -0.35); stake.rotation.set(0.2, 0, 1.0); tram.add(stake);
    const stakeRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 24), goldGlow); stakeRing.position.set(-14.25, 2.2, -0.35); stakeRing.rotation.set(0, 0, 1.0 + Math.PI / 2); tram.add(stakeRing);
    W.anchor49 = { stake, ring: stakeRing };
    src(-15, 2.4, -8, 0xffd27a, 4, 6, '2049');
    // the Helix cordon at the south end
    for (const x of [-10, -3.5, 3.5, 10]) B.cyl(M.dark, x, 0.55, 77.5, 0.05, 1.1, 8);
    const cord = new THREE.Mesh(new THREE.PlaneGeometry(22, 0.36), new THREE.MeshStandardMaterial({ map: TEX.cordon(), roughness: 0.6, side: THREE.DoubleSide })); cord.position.set(0, 1.0, 77.5); g49.add(cord);
    for (const x of [-5.5, 5.5]) { B.box(M.paint, x - 1.2, 0, 76.6, x + 1.2, 1.1, 77.1); }
    src(0, 4, 74, 0xbfe8ff, 3, 14, '2049');
    // neon signs, frozen mid-flicker
    for (const [t, c, x, y, z, ry] of [['SABLE NOODLE', '#ff4fa0', -10.95, 6.5, 40, Math.PI / 2], ['YARDS 24H', '#6affc8', 10.95, 6.0, 44, -Math.PI / 2], ['KESTREL TELECOM', '#ffb347', 10.95, 8.0, 66, -Math.PI / 2]]) { const s = neonSign(t, c, 3, 0.7, {}); s.position.set(x, y, z); s.rotation.y = ry; g49.add(s); }
    src(-9, 4.5, 40, 0xff4fa0, 3, 9, '2049'); src(9, 4.5, 44, 0x6affc8, 3, 9, '2049');
  }
  // the held rain: thousands of drops that never land (one Points draw)
  {
    const n = low ? 3200 : 7000, pos = new Float32Array(n * 3), r = rng(49);
    for (let i = 0; i < n; i++) { pos[i * 3] = -14 + r() * 28; pos[i * 3 + 1] = 0.3 + r() * 7; pos[i * 3 + 2] = -24 + r() * 104; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dropTex = canvasTex(32, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(220,240,255,0)'); gr.addColorStop(0.5, 'rgba(220,240,255,.85)'); gr.addColorStop(1, 'rgba(220,240,255,0)'); c.fillStyle = gr; c.fillRect(12, 0, 8, h); }, 'm13drop');
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: dropTex, size: 0.16, transparent: true, opacity: 0.8, depthWrite: false, color: 0xd8ecff, sizeAttenuation: true }));
    pts.frustumCulled = false; g49.add(pts); W.heldRain = pts; W.heldRainPos = pos;
  }

  // ================= 2026: the foundation works =================
  {
    const B = S['2026'];
    // hoardings: across the street north and south of the site (2026 never lets Kai past the lines), and the site ring
    const hoard = (x0, z0, x1, z1) => { B.box(M.hoard, x0, 0, z0, x1, 2.4, z1); box(x0, 0, z0, x1, 2.6, z1, ['2026']); };
    hoard(-11, 39.6, 11, 40.2); hoard(-11, -30.2, 11, -29.6);
    hoard(-26, 19.6, -4, 20.2); hoard(4, 19.6, 26, 20.2); hoard(-26, -24.2, 26, -23.6); hoard(25.6, -24, 26.2, 20); hoard(-26.2, -24, -25.6, 20);
    hoard(-4.2, 19.6, -3.8, 21); hoard(3.8, 19.6, 4.2, 21);   // gate posts
    plane(TEX.siteBoard(), 3.0, 2.1, 7.5, 1.5, 20.25, 0, '2026', 0.15); plane(TEX.siteBoard(), 3.0, 2.1, -7.5, 1.5, 40.25, 0, '2026', 0.15);
    // the foundation pit (x -8..8, z -9..5): dark floor 1.6 m down, a timber-shored edge and a railing; six pile cages
    B.box(M.dirt, -8, -1.7, -9, 8, -1.6, 5);
    for (const [x0, z0, x1, z1] of [[-8.3, -9.3, 8.3, -9], [-8.3, 5, 8.3, 5.3], [-8.3, -9, -8, 5], [8, -9, 8.3, 5]]) B.box(M.ply, x0, -1.6, z0, x1, 0.0, z1);
    for (const [x0, z0, x1, z1] of [[-8.6, -9.6, 8.6, -9.4], [-8.6, 5.4, 8.6, 5.6], [-8.6, -9.6, -8.4, 5.6], [8.4, -9.6, 8.6, 5.6]]) { B.box(hiVis, x0, Y0 + 0.95, z0, x1, Y0 + 1.05, z1); box(x0, 0, z0, x1, 1.3, z1, ['2026']); }
    for (let x = -8.5; x <= 8.5; x += 2.125) { B.box(M.steel, x - 0.03, Y0, -9.55, x + 0.03, Y0 + 1, -9.45); B.box(M.steel, x - 0.03, Y0, 5.45, x + 0.03, Y0 + 1, 5.55); }
    box(-8, -2, -9, 8, Y0, 5, ['2026']);   // the pit is closed to Kai (he works it from the edge)
    CAGES.forEach(([x, z], i) => {
      const cg = new THREE.Group(); cg.position.set(x, -1.6, z); g26.add(cg);
      const rebar = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7, metalness: 0.6 });
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.4, 4), rebar); bar.position.set(Math.cos(a) * 0.45, 1.7, Math.sin(a) * 0.45); cg.add(bar); }
      for (let y = 0.3; y < 3.4; y += 0.5) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.015, 4, 16), rebar); hoop.rotation.x = Math.PI / 2; hoop.position.y = y; cg.add(hoop); }
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: TEX.plate('C-' + (i + 1)), side: THREE.DoubleSide })); tag.position.set(0, 3.0, 0.47); cg.add(tag);
      cg.userData.home = cg.position.clone(); W.cages.push(cg);
      if (i === ANCHOR_CAGE) {
        const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 1.4, 10), goldGlow); spike.position.set(0, 1.0, 0); cg.add(spike);
        const sr = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 20), goldGlow); sr.rotation.x = Math.PI / 2; sr.position.set(0, 1.5, 0); cg.add(sr);
        W.anchor26 = { spike, ring: sr, cage: cg };
      }
    });
    // the tower crane (mast at (12, -15)) with its jib over the pit, the hook block and the ground control panel
    for (let y = 0; y < 26; y += 2) { B.box(hiVis, 11.2, y, -15.8, 11.35, y + 2, -15.65); B.box(hiVis, 12.65, y, -15.8, 12.8, y + 2, -15.65); B.box(hiVis, 11.2, y, -14.35, 11.35, y + 2, -14.2); B.box(hiVis, 12.65, y, -14.35, 12.8, y + 2, -14.2); B.geo(hiVis, new THREE.BoxGeometry(0.08, 2.1, 0.08), [12, y + 1, -15.75], [0, 0, 0.62]); }
    box(11.2, 0, -15.8, 12.8, 26, -14.2, ['2026']);
    const jib = new THREE.Group(); jib.position.set(12, 26.4, -15); g26.add(jib); W.jib = jib;
    const jibArm = new THREE.Mesh(new THREE.BoxGeometry(34, 1.0, 1.0), hiVis); jibArm.position.set(-9, 0, 0); jib.add(jibArm);
    const cw = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 2), M.concrete); cw.position.set(9, -0.6, 0); jib.add(cw);
    const cabC = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), M.paint); cabC.position.set(1.5, -1.6, 0); jib.add(cabC);
    const trolley = new THREE.Group(); jib.add(trolley); W.trolley = trolley;
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), ropeMat); trolley.add(rope); W.rope = rope;
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.3), hiVis); trolley.add(hook); W.hook = hook;
    W.setHook = (x, z, y) => {   // world target for the hook block
      const d = Math.hypot(x - 12, z + 15);
      jib.rotation.y = Math.atan2(z + 15, -(x - 12)); trolley.position.set(-d, 0, 0);
      const drop = 26.4 - y; rope.scale.y = drop; rope.position.set(0, -drop / 2, 0); hook.position.set(0, -drop, 0);
    };
    W.setHook(0, -2, 6);
    B.box(M.paint, 12.8, Y0, -10.2, 14.0, Y0 + 1.3, -9.0); B.box(M.dark, 12.7, Y0 + 1.1, -10.1, 12.75, Y0 + 1.25, -9.1); box(12.8, 0, -10.2, 14, 1.4, -9, ['2026']);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat(0x6aff8a, 3)); lamp.position.set(12.72, Y0 + 1.2, -9.4); g26.add(lamp);
    // the site office: a two-storey cabin stack
    for (const y of [0, 2.7]) { B.box(M.paint, -21, Y0 + y, 9.6, -15, Y0 + y + 2.6, 13.4); B.box(glass, -15.06, Y0 + y + 0.9, 10.2, -14.98, Y0 + y + 2.0, 12.8); }
    box(-21, 0, 9.6, -15, 5.5, 13.4, ['2026']);
    plane(TEX.pileBoard(), 1.6, 1.2, -14.94, 1.5, 11.4, Math.PI / 2, '2026', 0.12);
    B.box(M.ply, -15.0, Y0 + 0.7, 12.9, -14.4, Y0 + 0.75, 13.6); box(-15, 0, 12.9, -14.4, 0.8, 13.6, ['2026']);
    src(-14.5, 3, 11.5, 0xfff2e0, 3, 8, '2026');
    // the mixer truck waiting for the pour, the pump boom folded; stacked rebar, formwork panels, a skip
    B.box(M.paint, -9, 0, 12, -6.6, 2.6, 18.5); B.box(M.dark, -9.1, 0, 12, -6.5, 0.9, 18.5);
    B.geo(M.steel, new THREE.CylinderGeometry(1.0, 1.25, 3.6, 16), [-7.8, 2.4, 16.2], [Math.PI / 2 - 0.2, 0, 0]);
    box(-9.1, 0, 12, -6.5, 3.4, 18.5, ['2026']);
    for (let k = 0; k < 6; k++) B.box(M.rust, 14 + k * 0.1, Y0 + k * 0.12, 8, 21, Y0 + k * 0.12 + 0.1, 8.6); box(14, 0, 8, 21, 0.8, 8.6, ['2026']);
    for (let k = 0; k < 4; k++) B.box(M.ply, -22, Y0, -18 + k * 0.3, -20, Y0 + 2.4, -17.9 + k * 0.3); box(-22, 0, -18, -20, 2.4, -16.8, ['2026']);
    B.box(hiVis, 18, Y0, -20, 21, Y0 + 1.4, -17.6); box(18, 0, -20, 21, 1.6, -17.6, ['2026']);
    // the scaffold on the west row at Nell's corner: a new balcony being hung (x -11, z 30)
    for (const z of [27.6, 33.2]) for (const x of [-10.9, -9.7]) B.box(M.steel, x - 0.03, Y0, z - 0.03, x + 0.03, Y0 + 6, z + 0.03);
    for (const y of [2, 4]) { B.box(M.ply, -10.95, Y0 + y, 27.5, -9.6, Y0 + y + 0.05, 33.3); }
    box(-11, 0, 27.4, -9.5, 0.4, 33.4, ['2026']);
    const bal = new THREE.Group(); bal.position.set(-11, 3.4, 30.4); g26.add(bal); W.balcony26 = bal;
    const slab26 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 3.2), M.concreteNew); slab26.position.set(0.7, 0, 0); bal.add(slab26);
    W.bolts = [];
    for (const dz of [-1.2, 1.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), goldTrim); b.position.set(0.1, -0.25, dz); bal.add(b); W.bolts.push(b); }
    src(-6, 3, 30, 0xfff2e0, 2, 8, '2026');
  }

  // ================= 2196: the war =================
  {
    const B = S['2196'];
    // the Unwritten barricade (z 42, gap x 1.5..3.5): scrap, doors, a bus side, sandbags
    for (const [x0, x1] of [[-11, 1.5], [3.5, 11]]) {
      B.box(M.rustHeavy, x0, 0, 41.6, x1, 1.6, 42.6); box(x0, 0, 41.5, x1, 1.7, 42.7, ['2196']);
      for (let x = x0 + 0.5; x < x1; x += 1.1) B.geo(sand, new THREE.BoxGeometry(0.9, 0.32, 0.5), [x, 1.78, 42.1 + (R() - 0.5) * 0.2], [0, (R() - 0.5) * 0.3, 0]);
      for (let x = x0 + 1; x < x1 - 1; x += 3.2) B.geo(M.rust, new THREE.BoxGeometry(1.0, 2.4, 0.08), [x, 1.2, 42.7], [0.1, R() - 0.5, (R() - 0.5) * 0.2]);
    }
    B.geo(M.rust, new THREE.BoxGeometry(9, 2.6, 0.12), [-6, 1.3, 43.4], [0, 0.04, 0.03]);
    // the camp: tarps, a stove drum, crates, Lasker's table under a tarp, Sera's aid post
    for (const [x, z, w, d, m] of [[-8.6, 62, 4, 3.4, tarp], [8.6, 58, 3.6, 4, tarpRed], [-8.8, 50, 3.4, 3, tarp], [8.8, 70, 3.6, 3.6, tarp]]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 4, 4), m); const pa = t.geometry.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 1.3) * 0.12 + (R() - 0.5) * 0.06); t.geometry.computeVertexNormals();
      t.rotation.x = -Math.PI / 2 + 0.14; t.position.set(x, 2.5, z); g96.add(t);
      for (const [dx, dz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) B.box(M.rust, x + dx - 0.04, Y0, z + dz - 0.04, x + dx + 0.04, Y0 + 2.5, z + dz + 0.04);
    }
    B.box(M.wood, -10, Y0, 60.4, -7.2, Y0 + 0.85, 62.6); box(-10, 0, 60.4, -7.2, 0.95, 62.6, ['2196']);
    B.box(M.ply, -10.5, Y0, 64, -9.8, Y0 + 2.2, 64.4); plane(TEX.mapBoard(), 1.6, 1.2, -9.75, 1.5, 64.2, Math.PI / 2, '2196', 0.08);
    plane(TEX.manifesto(), 4.2, 2.1, -10.96, 2.0, 70, Math.PI / 2, '2196', 0.1);
    plane(TEX.tally(), 1.6, 1.0, -4.6, 1.3, 46.25, 0, '2196', 0.1); B.box(M.ply, -5.5, Y0, 46.0, -3.7, Y0 + 1.9, 46.2); box(-5.5, 0, 45.9, -3.7, 2, 46.3, ['2196']);
    B.cyl(M.rustHeavy, 0, 0.55, 66, 0.42, 1.1, 14); box(-0.45, 0, 65.55, 0.45, 1.1, 66.45, ['2196']);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 8), ember); fire.position.set(0, 1.35, 66); g96.add(fire); W.fire = fire;
    src(0, 2.0, 66, 0xff8a3a, 5, 10, '2196'); src(8.6, 2.2, 58, 0xffb070, 3, 7, '2196'); src(-8.6, 2.2, 62, 0xffb070, 3, 7, '2196');
    for (const [x, z] of [[-6, 56], [6.6, 64], [-7, 72], [7, 52], [-2, 70]]) { B.boxc(M.wood, x, Y0 + 0.35, z, 0.9, 0.7, 0.7, R()); box(x - 0.5, 0, z - 0.5, x + 0.5, 0.8, z + 0.5, ['2196']); }
    for (const [x, z] of [[9.2, 56.6], [9.2, 59.4]]) { B.box(tarp, x - 0.4, Y0, z - 1, x + 0.4, Y0 + 0.4, z + 1); }
    // stove pipes in the camp alley (shard)
    for (let k = 0; k < 3; k++) B.cyl(M.rustHeavy, -10.2 + k * 0.5, 0.75, 74.6, 0.18, 1.5, 8);
    // the Continuum line (z -40, gap x -1.5..1.5): pearl barriers with gold emitters, a checkpoint arch, pylons
    for (const [x0, x1] of [[-11, -1.5], [1.5, 11]]) {
      for (let x = x0; x < x1 - 0.1; x += 2.5) { const w = Math.min(2.4, x1 - x); B.geo(pearl, new THREE.BoxGeometry(w - 0.1, 1.3, 0.7), [x + w / 2, 0.65, -40.3], [0, 0, 0]); B.geo(goldTrim, new THREE.BoxGeometry(w - 0.3, 0.06, 0.72), [x + w / 2, 1.0, -40.3]); }
      box(x0, 0, -40.7, x1, 1.4, -39.9, ['2196']);
    }
    B.box(pearl, -2.2, 0, -40.8, -1.6, 4.2, -39.8); B.box(pearl, 1.6, 0, -40.8, 2.2, 4.2, -39.8); B.box(pearl, -2.2, 4.2, -40.8, 2.2, 4.7, -39.8); B.box(goldGlow, -1.6, 4.05, -40.5, 1.6, 4.15, -40.1);
    box(-2.2, 0, -40.8, -1.6, 4.7, -39.8, ['2196']); box(1.6, 0, -40.8, 2.2, 4.7, -39.8, ['2196']);
    for (const x of [-9, 9]) { B.cyl(pearl, x, 2.2, -42, 0.18, 4.4, 10); const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), goldGlow); e.position.set(x, 4.5, -42); g96.add(e); }
    src(0, 4, -41, 0xffd27a, 4, 12, '2196'); src(-12, 3, -42, 0xffd27a, 2.5, 10, '2196'); src(12, 3, -42, 0xffd27a, 2.5, 10, '2196');
    // the Continuum command pavilion (z -60): a pearl shell, a field table, the fire-record screen
    B.box(pearl, -7, 0, -66.4, 7, 0.3, -56); B.box(pearl, -7, 0.3, -66.4, 7, 3.8, -66); B.box(pearl, -7, 0.3, -66, -6.6, 3.8, -56); B.box(pearl, 6.6, 0.3, -66, 7, 3.8, -56);
    B.box(pearl, -7.2, 3.8, -66.6, 7.2, 4.1, -55.6); B.box(goldTrim, -7.2, 3.7, -55.7, 7.2, 3.8, -55.6);
    box(-7, 0, -66.4, 7, 0.3, -56); box(-7, 0, -66.4, 7, 4, -66); box(-7, 0, -66, -6.6, 4, -56); box(6.6, 0, -66, 7, 4, -56);
    B.box(graphite, -2, 0.3, -62.6, 2, 1.1, -61.2); box(-2, 0, -62.6, 2, 1.2, -61.2, ['2196']);
    const logScr = plane(TEX.contLog(), 1.4, 0.88, 2.6, 1.6, -61.6, 0, '2196', 0.9); logScr.material.toneMapped = false;
    src(0, 3.4, -60, 0xffe8c0, 4, 10, '2196');
    // Nell's corner: the 2049 balcony that came down (a slab pinning her), z 30
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 3.4), M.concrete96); slab.position.set(-9.6, 0.55, 30.4); slab.rotation.set(0.05, 0.08, -0.32); g96.add(slab); W.nellSlab = slab;
    W.nellSlabBox = box(-10.6, 0, 28.7, -8.6, 1.0, 32.1, ['2196']);
    // Sable Bridge: the 2196 anchor (a gold pylon mid-span) behind a Continuum post at the west end
    const py = new THREE.Group(); py.position.set(35, Y0, 0); g96.add(py); W.anchor96 = py;
    const pyBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 3.2, 12), pearl); pyBody.position.y = 1.6; py.add(pyBody);
    const pyCore = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 10), goldGlow); pyCore.position.y = 1.7; py.add(pyCore); W.anchor96core = pyCore;
    for (const y of [0.8, 1.6, 2.4]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 24), goldTrim); r.rotation.x = Math.PI / 2; r.position.y = y; py.add(r); }
    box(34.5, 0, -0.5, 35.5, 3.4, 0.5, ['2196']);
    for (const z of [-2.6, 2.6]) { B.geo(pearl, new THREE.BoxGeometry(0.7, 1.2, 2.0), [28.6, 0.75, z], [0, 0, 0]); box(28.25, 0, z - 1, 28.95, 1.35, z + 1, ['2196']); }
    src(35, 3, 0, 0xffd27a, 4, 9, '2196');
    // craters (scorched discs with a rubble lip) where the same shells keep landing
    const scorch = new THREE.MeshBasicMaterial({ map: TEX.scorch(), transparent: true, depthWrite: false, opacity: 0.9 });
    W.craters = [];
    for (const list of Object.values(IMPACTS)) for (const [x, z] of list) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), scorch); d.rotation.x = -Math.PI / 2; d.position.set(x, groundY(x, z) + 0.02, z); g96.add(d); W.craters.push(d);
      for (let k = 0; k < 6; k++) { const a = R() * 6.28, h = 0.12 + R() * 0.16; B.geo(M.concrete96, new THREE.BoxGeometry(0.22 + R() * 0.3, h, 0.2 + R() * 0.3), [x + Math.cos(a) * (1.7 + R() * 0.5), groundY(x, z) + h * 0.4, z + Math.sin(a) * (1.7 + R() * 0.5)], [(R() - 0.5) * 0.5, R() * 3, (R() - 0.5) * 0.5]); }
    }
    // cover in no-man's land: a tram body on its side, concrete blocks, a fallen kiosk
    B.geo(M.rustHeavy, new THREE.BoxGeometry(9, 2.6, 2.8), [-3, 1.3, 31.6], [0, 0.18, Math.PI / 2 - 0.05]); box(-7.4, 0, 30.2, 1.4, 2.6, 33, ['2196']);
    for (const [x, z] of [[5.6, 37.5], [-6.5, 24.8], [6.6, 21.2], [-1.2, 18.6], [14, 16.5], [-15, 18], [22, 9], [21, -8], [-20, -16], [12, -30], [-12, -31]]) { B.boxc(M.concrete96, x, 0.6, z, 2.2, 1.2, 0.8, R() * 0.6 - 0.3); box(x - 1.15, 0, z - 0.6, x + 1.15, 1.25, z + 0.6, ['2196']); }
    // the Continuum forward post at the plaza edge (z 16): two pearl shields
    for (const x of [-4.2, 4.8]) { B.geo(pearl, new THREE.BoxGeometry(2.2, 1.25, 0.5), [x, 0.75, 15.2], [0, 0, 0]); box(x - 1.1, 0, 14.9, x + 1.1, 1.35, 15.5, ['2196']); }
    // what is left of the interchange: rusted platform canopies and a buckled rail where the 2049 tram stood
    for (const [x, z] of [[-13, -12], [13, -12], [-15, -3.6], [15, -3.6]]) {
      for (const dx of [-2.2, 2.2]) B.box(M.rustHeavy, x + dx - 0.08, Y0, z - 0.08, x + dx + 0.08, Y0 + 2.9, z + 0.08);
      B.geo(M.rustHeavy, new THREE.BoxGeometry(5.2, 0.12, 1.6), [x, Y0 + 2.9, z], [0.05, 0, x > 0 ? -0.12 : 0.18]);
      box(x - 2.35, 0, z - 0.15, x + 2.35, 2.9, z + 0.15, ['2196']);
    }
    for (const z of [-8.6, -7.4]) B.geo(M.rust, new THREE.BoxGeometry(10, 0.12, 0.1), [-19, Y0 + 0.06, z], [0, 0.04 * (z + 8), 0]);
    // Senn's wreck (east plaza)
    // smoke columns from the ruins (drifting mist volumes)
    try {
      for (const [x, z, r, h] of [[-22, 30, 3, 14], [24, -30, 4, 18], [-40, -6, 5, 16], [48, 18, 3, 12]]) { const m = RZ.mist({ center: [x, h / 2, z], radius: r, height: h, color: 0x6a6460, ambient: 0x8a7a6a, opacity: 0.32, count: low ? 10 : 20, seed: x * 3 + z }); g96.add(m); }
    } catch (e) { console.warn('m13 mist', e); }
  }

  // ================= the stabilizer (2196) at (0, -2): plinth, three stairs, the spire, the field dome =================
  {
    const [sx, sz] = SPIRE, sp = new THREE.Group(); sp.position.set(sx, 0, sz); g96.add(sp); W.spire = sp;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.6, 2.4, 40), pearl); plinth.position.y = 1.2; sp.add(plinth);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(6.25, 0.08, 8, 64), goldTrim); trim.rotation.x = Math.PI / 2; trim.position.y = 2.42; sp.add(trim);
    for (const [hx, hz] of [[6.0, 3.2], [3.2, 6.0], [5.0, 5.0]]) box(sx - hx, 0, sz - hz, sx + hx, 2.4, sz + hz, ['2196']);
    // stairs up to the deck (south): six steps of 0.4 m (walkable risers), each box reaching back to the plinth
    for (let k = 0; k < 6; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4 * (k + 1), 0.7), pearl); st.position.set(0, 0.2 * (k + 1), 10.3 - k * 0.7); sp.add(st); box(sx - 1.6, 0, sz + 6.0, sx + 1.6, 0.4 * (k + 1), sz + 10.7 - k * 0.7, ['2196']); }
    // the spire: tapered graphite core with pearl fins and a gold seam
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.0, 24, 16, 1), graphite); core.position.y = 14.4; sp.add(core);
    for (let k = 0; k < 3; k++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 20, 2.6), pearl); const a = k / 3 * Math.PI * 2 + Math.PI / 6;
      fin.position.set(Math.cos(a) * 1.9, 12.4, Math.sin(a) * 1.9); fin.rotation.y = -a + Math.PI / 2; sp.add(fin);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 18, 0.06), goldGlow); seam.position.set(Math.cos(a) * 3.2, 12.4, Math.sin(a) * 3.2); seam.rotation.y = -a + Math.PI / 2; sp.add(seam);
      box(sx + Math.cos(a) * 2.6 - 0.7, 2.4, sz + Math.sin(a) * 2.6 - 0.7, sx + Math.cos(a) * 2.6 + 0.7, 26, sz + Math.sin(a) * 2.6 + 0.7, ['2196']);
    }
    box(sx - 2.1, 2.4, sz - 2.1, sx + 2.1, 26, sz + 2.1, ['2196']);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.2, 12), goldTrim); tip.position.y = 28; sp.add(tip);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 6), graphite); mast.position.y = 32; sp.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), goldGlow); beacon.position.y = 35.1; sp.add(beacon);
    // the heart: a gold core in a cage on the deck, three couplings around it
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), goldGlow); heart.position.set(0, 3.6, 3.0); sp.add(heart); W.heart = heart;
    const cage = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 6, 24), goldTrim); cage.position.copy(heart.position); sp.add(cage); W.heartCage = cage;
    W.couplings = P.couplings.map(([x, y, z]) => { const c = new THREE.Group(); c.position.set(x - sx, y, z - sz); sp.add(c); void y; const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.9, 12), graphite); body.position.y = 0.45; c.add(body); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 20), goldGlow); ring.position.y = 0.95; ring.rotation.x = Math.PI / 2; c.add(ring); c.userData.ring = ring; return c; });
    // the return ring: a gold hoop around the spire at 9 m where the shells go in, and come out again
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.12, 8, 64), goldGlow); ring.position.y = 9; ring.rotation.x = Math.PI / 2; sp.add(ring); W.returnRing = ring;
    // the field clock (nine minutes, counting down), on two faces of the plinth
    W.clockCanvas = document.createElement('canvas'); W.clockCanvas.width = 256; W.clockCanvas.height = 96;
    const ctex = new THREE.CanvasTexture(W.clockCanvas); ctex.colorSpace = THREE.SRGBColorSpace; W.clockTex = ctex;
    for (const a of [0, Math.PI]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.68), new THREE.MeshBasicMaterial({ map: ctex, toneMapped: false })); c.position.set(Math.sin(a) * 6.7, 1.6, Math.cos(a) * 6.7); c.rotation.y = a; sp.add(c); }
    // the field dome
    const domeMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, map: TEX.shimmer(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    domeMat.map.wrapS = domeMat.map.wrapT = THREE.RepeatWrapping; domeMat.map.repeat.set(4, 2);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), domeMat); dome.position.set(sx, 0, sz); g96.add(dome); W.dome = dome;
    src(0, 6, -2, 0xffd27a, 8, 22, '2196'); src(0, 3.5, 2.2, 0xffd27a, 3, 8, '2196');
  }

  // ================= the barrage: telegraph rings, blasts, mortar tracers, smoke screen =================
  {
    const ringMat = new THREE.MeshBasicMaterial({ map: TEX.ring(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9 });
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const dustMat = new THREE.MeshStandardMaterial({ color: 0x6a5e50, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat.clone()); ring.rotation.x = -Math.PI / 2; ring.visible = false; g96.add(ring);
      const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), flashMat.clone()); flash.visible = false; g96.add(flash);
      const dust = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), dustMat.clone()); dust.visible = false; g96.add(dust);
      W.blasts.push({ ring, flash, dust, t: -1, tele: 0, x: 0, z: 0 });
    }
    const trMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }), trMat2 = new THREE.MeshBasicMaterial({ color: 0xff8f6a, toneMapped: false });
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), i % 2 ? trMat : trMat2); m.visible = false; g96.add(m); W.tracers.push({ m, t: 1, a: new THREE.Vector3(), b: new THREE.Vector3(), h: 8, dur: 2 }); }
    W.smokeGroup = new THREE.Group(); g96.add(W.smokeGroup);
  }
  W.telegraph = (x, z, lead = 2.2) => {
    const b = W.blasts.find(q => q.t < 0 && q.tele <= 0) || W.blasts[0];
    b.x = x; b.z = z; b.tele = lead; b.lead = lead; b.t = -1; b.ring.visible = true; b.ring.position.set(x, groundY(x, z) + 0.05, z);
    return b;
  };
  W.blast = (b) => { b.ring.visible = false; b.t = 0; b.flash.visible = true; b.dust.visible = true; b.flash.position.set(b.x, 0.8, b.z); b.dust.position.set(b.x, 0.6, b.z); };
  W.tracer = (a, b, dur = 2.2, h = 10) => { const tr = W.tracers.find(q => q.t >= 1) || W.tracers[0]; tr.a.set(...a); tr.b.set(...b); tr.t = 0; tr.dur = dur; tr.h = h; tr.m.visible = true; return tr; };
  W.smokeAt = (x, z, dur = 30) => {
    try { const m = RZ.mist({ center: [x, 2.5, z], radius: 5, height: 5, color: 0xb8b0a4, ambient: 0x9a9088, opacity: 0.55, count: low ? 14 : 26, seed: Math.floor(x * 7 + z) }); W.smokeGroup.add(m); W.smoke.push({ m, t: dur, x, z }); } catch (e) { console.warn('m13 smoke', e); }
  };

  // ================= build the batches =================
  S.common.build(scene, { blockers: true, game });
  for (const e of ['2026', '2049', '2196']) S[e].build(G[e], { blockers: true, game });

  // ================= per-frame =================
  let clockT = -1;
  W.fieldClock = 540;   // seconds left in the current nine minutes
  W.update = (dt, t) => {
    if (W.dome?.visible) { W.dome.material.map.offset.x = t * 0.02; W.dome.material.map.offset.y = t * 0.013; }
    if (W.returnRing) W.returnRing.rotation.z = t * 0.3;
    if (W.heart) { W.heart.rotation.y = t * 0.6; W.heart.rotation.x = t * 0.21; }
    if (W.fire) W.fire.scale.set(1 + Math.sin(t * 9) * 0.08, 1 + Math.sin(t * 13) * 0.14, 1);
    for (const b of W.blasts) {
      if (b.tele > 0) { b.tele -= dt; const k = 1 - Math.max(0, b.tele) / b.lead; const s = 7 - k * 3.4; b.ring.scale.set(s, s, 1); b.ring.material.opacity = 0.35 + k * 0.6; }
      if (b.t >= 0) {
        b.t += dt; const k = b.t;
        b.flash.scale.setScalar(0.4 + k * 9); b.flash.material.opacity = Math.max(0, 0.75 - k * 2.2);
        b.dust.scale.set(1 + k * 4.2, 0.8 + k * 3.2, 1 + k * 4.2); b.dust.position.y = 0.6 + k * 1.4; b.dust.material.opacity = Math.max(0, 0.55 - k * 0.22);
        if (k > 2.5) { b.t = -1; b.flash.visible = false; b.dust.visible = false; }
      }
    }
    for (const tr of W.tracers) {
      if (tr.t >= 1) continue; tr.t = Math.min(1, tr.t + dt / tr.dur);
      tr.m.position.lerpVectors(tr.a, tr.b, tr.t); tr.m.position.y += Math.sin(tr.t * Math.PI) * tr.h;
      if (tr.t >= 1) tr.m.visible = false;
    }
    for (const s of W.smoke) { s.t -= dt; if (s.t < 4) s.m.material.uniforms && (s.m.material.uniforms.uOp.value = Math.max(0, 0.55 * s.t / 4)); }
    W.smoke = W.smoke.filter(s => { if (s.t > 0) return true; W.smokeGroup.remove(s.m); s.m.geometry?.dispose?.(); return false; });
    // the field clock text (once a second)
    const sec = Math.max(0, Math.ceil(W.fieldClock));
    if (sec !== clockT && W.clockCanvas) {
      clockT = sec; const g = W.clockCanvas.getContext('2d'); g.fillStyle = '#0c0c10'; g.fillRect(0, 0, 256, 96);
      g.fillStyle = sec < 30 ? '#ff8f6a' : '#ffd27a'; g.font = `700 58px ${FONT}`; g.textAlign = 'center'; g.fillText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, 128, 68);
      W.clockTex.needsUpdate = true;
    }
  };
  return W;
}
