// Mission 18 environment: THE FRACTURE. A sequence of places across a collapsing world, one scene each (built when Kai
// gets there, so each stays inside the phone budget). North = -z everywhere.
//   I   LANTERN HALL, 2196 (the M14 settlement, env_m14 buildReach) + the storm bubble its failing anchor still holds.
//   II  VARROW GORGE, 2026 / 2049: the gorge exists only in the past; in 2049 it has been filled to carry the Eastway
//       and the storm has torn the fill away. West rim (x < -14) · the 2026 haul ramp cut into the west wall (x -13..-9.6,
//       z 34 -> -26, y 0 -> -16) · the gorge floor (y -16, river |x| < 2.5) · the crane · the pier hoist (x 6.4) and the
//       half-built deck (x 4..9.6, y 0) · the 2049 fill island (x 2..34) · east rim (x > 14).
//   III THE EASTWAY, 2049 (night, rain): a flooded motorway on the fill (road x -14..14, z 36..-98), the surge cycle,
//       the jack-knifed lorry (z -27..-20), isolator E-7, the bus (x 8, z -80), pump station 3 (x -22..-16, z -98..-92),
//       the dip under the rail bridge (z -98..-116, y -1.4) and the off-ramp (z -116..-140). In 2026 the same place is the
//       open fill pit with two haul strips (x 6..10, z -8..-44 · x -13..-9, z -86..-101) and culvert C-3.
//   IV  THE CORRAN BUILDING, 2196 (2049 holds here for 12 s at a time): a leaning office tower (x -12..12, z -12..12,
//       floors at 4.5 / 9 / 13.5 / roof 18), the river gorge to the north, a fallen crane boom from the roof to the
//       Helix terrace (z -36..-60, y 12).
//   V   HELIX TEST HALL C, 2196 / 2049: the ruined hall (x -26..26, z -26..26), the cracked Chronolith (0, 3.4, -10),
//       the stabilizer spire (0, 0, 6), the south gallery (y 6, z 26..34) and three breaches.
//   VI  THE LONG ARRAY, 2196 / 2049: Halcyon Hill's plateau (x -50..50, z -30..90), the planetary transmission tower
//       (0, 0, 0): P1 y 14, P2 y 30, the crown P3 y 44 with three feed horns.
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, chronolith } from './kit.js';
import { Batch } from './env_m6.js';
import { zoneMaterial } from './env_m14.js';
import { streetKit } from './props.js';
import { registerCast, CAST } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const HAND = '"Caveat", "Segoe Print", "Bradley Hand", cursive';
const PI = Math.PI;

// ---------------------------------------------------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------------------------------------------------
export const P1 = {   // Lantern Hall (env_m14 coordinates)
  start: [0, 0, -82, PI], gate: [0, 0, -77], sera: [-2.6, 0, -79.4], wren: [2.8, 0, -79.0], beacon: [0, 0, -121],
  joss: [2.6, 0.4, -117.6], cabs: [[-2.0, 0.4, -118.9], [2.0, 0.4, -118.9]], jossLog: [3.2, 0.9, -117.9],
  ama: [-3.5, 0, -98], gard: [[2.2, 0, -103.4], [6.4, 0, -99.6]], tin: [-22.4, 6.0, -101.8], cisternTop: [-27.9, 6.0, -101.2],
  teacher: [16.2, 1, -96.4], kids: [[16.8, 1, -94.8], [18.0, 1, -95.6], [15.6, 1, -95.2]], lio: [19.0, 1.0, -113.4],
  patient: [-17.0, 1, -108.6], medic: [-18.6, 1, -107.2], elders: [[-6.4, 0, -63.4], [-9.6, 0, -63.6]],
  out: [[0, 0, -79], [0, 0, -70], [0.5, 0, -58]], shard: [-27.4, 0.6, -126.4],
};
export const P2 = {   // Varrow Gorge
  start: [-56, 0, 0, PI / 2], fenceX: -34, gen: [-26, 0, -16], office: [-28, 0, 14], board: [-34.25, 1.7, 6],
  rampTop: [-11.3, 0, 36], rampFoot: [-11.3, -16, -27], crane: [-5.4, -16, -14], remote: [-6.6, -16, -9.6], girderZ: -8.1,
  carving: [-6.6, -16, 16.4], hoist: [6.4, -16, 0], deck: [8.4, 0, 0], exitX: 26,
  shards: [[-6.0, 0.6, 1.9, 'on the end of the unfinished deck', '2026'], [6.8, -15.4, 22.6, 'on the east bank of the river', '2026']],
};
export const P3 = {   // The Eastway
  start: [0, 2.0, 50, PI], e7: [13.9, 0, -46], cable: [-3, 0, -58], cableR: 8.5, bus: [8, 0, -80], busRoof: [8, 3.25, -78.4],
  cab: [-12.5, 0, -19.4], lorry: [-14, -27, 14, -24.5], culvert26: [-11, 0, -99.4], grate: [-14.4, 0, -99], pumpDoor: [-15.6, 0, -95], pump: [-19.4, 0.6, -95],
  dip: [-98, -116], exitZ: -134, shard: [8.6, 3.85, -82.6],
};
export const P4 = {   // The Corran Building
  start: [0, 0, 30, PI], L: [0, 4.5, 9, 13.5, 18], boomEnd: [0, 12, -37], shard: [7.6, 9.6, 9.2], memo: [9.6, 9.0, 7.4], terraceZ: -40,
};
export const P5 = {   // Helix Test Hall C
  start: [0, 6, 31, PI], ring: [0, 3.4, -10], spire: [0, 0, 6], sera: [-1.7, 0, -7.4], console49: [5.8, 0, -9.4], log49: [-9.4, 0, -14.6],
  spawns: { w: [-31, 0, -3.5], e: [31, 0, 2.5], n: [0, 0, -31] }, shard: [18.4, 6.6, 30.4],
};
export const P6 = {   // The Long Array
  start: [0, 0, 84, PI], base: [0, 0, 0], ladder1: [0, 0, 5.2], P1y: 14, P2y: 30, P3y: 44, lift: [0, 14, 1.4], ladder2: [0, 30, -4.6],
  horns: [[-2.5, 44, 0], [2.5, 44, 0], [0, 44, -2.5]], booth: [-14, 0, 40], shard: [4.4, 14.6, 4.4],
};

// Mira's three notes (M17: E-B-A in the cello): the Array's horns must carry them, west, north, east
export const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const NOTE_MIDI = [60, 62, 64, 65, 67, 69, 71];
export const HORN_OK = [2, 5, 6];          // per horn (west, east, north): E, A, B. The tune is played west E, north B, east A

// ---------------------------------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites). Every look: era, sex/age and a COSTUMES.md archetype.
// ---------------------------------------------------------------------------------------------------------------------
export const SURV = [
  { era: '2196', costume: 'surv_m1', sex: 0, age: 39, height: 1.79, build: 1.02, skin: 0xa77a5d, hair: 0x15100b, hairStyle: 'short', beard: 0x15100b, topType: 'jacket', top: 0x7a6a50, topKind: 'fabric', hood: true, vest: 0x4a4a3a, pantsType: 'cargo', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 26, height: 1.68, build: 0.96, skin: 0x6b4029, hair: 0x0e0a08, hairStyle: 'tied-back', topType: 'jacket', top: 0x6a5a44, topKind: 'fabric', pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_m2', sex: 0, age: 64, height: 1.7, build: 0.9, skin: 0xd8b08e, hair: 0x9a9690, hairStyle: 'short', stubble: true, topType: 'jacket', top: 0x6a6a64, topKind: 'fabric', hood: true, vest: 0x5a3e28, pantsType: 'trousers', pants: 0x8a7458, shoes: 'boots', boots: 0x4a3a2a, lod: true },
  { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 48, height: 1.64, build: 1.04, skin: 0xe0b8a0, hair: 0x8a8278, hairStyle: 'bun', topType: 'jacket', top: 0x5a6058, topKind: 'fabric', hood: true, vest: 0x4a4a38, pantsType: 'trousers', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_m1', sex: 0, age: 31, height: 1.83, build: 1.06, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'buzz', stubble: true, topType: 'jacket', top: 0x4a3a28, topKind: 'fabric', vest: 0x7a3e22, pantsType: 'cargo', pants: 0x3a3a30, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 21, height: 1.66, build: 0.94, skin: 0xd9a585, hair: 0x5a3a22, hairStyle: 'short', topType: 'jacket', top: 0xa89a80, topKind: 'fabric', pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, lod: true },
];
export const KID96 = [
  { era: '2196', costume: 'lotte', child: true, sex: 1, female: true, age: 8, height: 1.26, build: 0.88, skin: 0xb98463, hair: 0x2a1c14, hairStyle: 'tied-back', topType: 'jacket', top: 0x8a7458, topKind: 'fabric', hood: true, pantsType: 'cargo', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'lotte', child: true, sex: 0, age: 9, height: 1.32, build: 0.9, skin: 0x6b4029, hair: 0x0e0a08, hairStyle: 'curly', topType: 'jacket', top: 0x5a6a5a, topKind: 'fabric', hood: true, pantsType: 'cargo', pants: 0x4a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'lotte', child: true, sex: 1, female: true, age: 7, height: 1.2, build: 0.86, skin: 0xe0b8a0, hair: 0x6a4a2a, hairStyle: 'bob', topType: 'jacket', top: 0x7a3e22, topKind: 'fabric', hood: true, pantsType: 'cargo', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
];
export const PASSENGERS = [
  { era: '2049', costume: 'c49_m2', sex: 0, age: 44, height: 1.77, build: 1.04, skin: 0xc89a7a, hair: 0x2a2420, hairStyle: 'short', topType: 'jacket', top: 0x2a3440, topKind: 'synthetic', pantsType: 'trousers', pants: 0x23262b, shoes: 'shoes', boots: 0x141210, lod: true },
  { era: '2049', costume: 'c49_f4', sex: 1, female: true, age: 20, height: 1.64, build: 0.94, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'curly', topType: 'jacket', hood: true, top: 0x5a3a6a, topKind: 'synthetic', pantsType: 'cargo', pants: 0x1f2227, shoes: 'boots', boots: 0x141210, lod: true },
  { era: '2049', costume: 'c49_f5', sex: 1, female: true, age: 71, height: 1.6, build: 1.0, skin: 0xe0b8a0, hair: 0xc8c4be, hairStyle: 'bun', topType: 'jacket', top: 0x6a4a3a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes', boots: 0x2a1d14, lod: true },
  { era: '2049', costume: 'c49_m4', sex: 0, age: 27, height: 1.82, build: 0.96, skin: 0xd9a585, hair: 0x3a2a1a, hairStyle: 'messy', topType: 'jacket', hood: true, top: 0x1e5a4a, topKind: 'synthetic', pantsType: 'cargo', pants: 0x23262b, shoes: 'boots', boots: 0x1b1611, lod: true },
];
const KID_KAI6 = { era: '2026', costume: 'kid_kai', sex: 0, height: 1.16, build: 0.8, age: 6, skin: 0xb98463, hair: 0x15100c, hairStyle: 'messy', eyes: 0x3d2a18, topType: 'jacket', hood: true, top: 0x2a4a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2f3a4e, shoes: 'shoes', boots: 0x3a2a1a };
const KID_MIRA9 = { era: '2026', costume: 'kid_mira', sex: 1, female: true, height: 1.3, build: 0.84, age: 9, skin: 0xd9a585, hair: 0x120d0b, hairStyle: 'bob', eyes: 0x2f4a3a, topType: 'sweater', top: 0x6a2a3a, topKind: 'fabric', pantsType: 'trousers', pants: 0x1f2227, shoes: 'shoes', boots: 0x3a2a1a };

export function registerM18Cast() {
  const BG96 = { rimColor: 0xb6ff8a, glow: 0x10180a, bg: 0x0a0c08 };
  registerCast('m18teacher', {
    name: 'HEDDA LIND', role: 'Teacher · Lantern Hall · 2196', ...BG96,
    bio: 'Fifty-two. Teaches eleven children to read from the names on the memorial wall, because it is the only long text left in the Reach.',
    look: { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 52, height: 1.67, build: 1.0, skin: 0xd8b08e, hair: 0x6a5a4a, hairStyle: 'bun', eyes: 0x4a5a6a, wrinkles: 0.4,
      face: { jaw: -0.1, cheek: 0.2, nose: 0.3, noseWidth: 0.1, lips: -0.1, brow: 0.1, eyeSize: 0.05, faceLength: 0.25, chin: 0.05 },
      topType: 'jacket', top: 0x5a6a6a, topKind: 'fabric', hood: true, vest: 0x6a5a3a, pantsType: 'trousers', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018 },
    vp: { sex: 'f', pitch: 1.02, rate: 0.96, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('m18lio', {
    name: 'LIO', role: 'Pupil · Lantern Hall school · 2196', ...BG96,
    bio: 'Seven. Hides when the sky goes purple because his grandmother said the storm takes children who are outside.',
    look: { ...KID96[1], age: 7, height: 1.2, hair: 0x2a1c14, skin: 0xb98463, lod: false },
    vp: { sex: 'm', pitch: 1.5, rate: 1.06, langs: ['en-GB', 'en-US'] },
  });
  registerCast('m18medic', {
    name: 'NADIA OYELARAN', role: 'Medic · Lantern Hall · 2196', ...BG96,
    bio: 'Thirty-eight. Sets bones with wire and keeps the hall\'s only box of real medicine under her cot.',
    look: { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 38, height: 1.7, build: 0.98, skin: 0x5a3622, hair: 0x0e0a08, hairStyle: 'tied-back', eyes: 0x24160c,
      face: { jaw: 0.1, cheek: 0.45, nose: 0.05, noseWidth: 0.35, lips: 0.35, brow: 0.05, eyeSize: 0.1, faceLength: 0.05, chin: 0.05 },
      topType: 'jacket', top: 0x6a6a5a, topKind: 'fabric', vest: 0x7a3a2a, pantsType: 'cargo', pants: 0x4a4a38, shoes: 'boots', boots: 0x2a2018, gloves: 0x5a4a38 },
    vp: { sex: 'f', pitch: 1.0, rate: 1.04, langs: ['en-GB', 'en-NG', 'en-US'] },
  });
  registerCast('m18tomas', {
    name: 'TOMAS BRENNAN', role: 'Scavenger · Lantern Hall · 2196', ...BG96,
    bio: 'Forty-one. Broke his leg on the Line 4 beam the day Kai came through the Reach. Has not stopped talking about it.',
    look: { ...SURV[0], age: 41, lod: false, hair: 0x3a2a1a, beard: 0x3a2a1a, skin: 0xc49a7c },
    vp: { sex: 'm', pitch: 0.92, rate: 1.04, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('m18ruth', {
    name: 'RUTH ABARA', role: 'Elder · Lantern Hall · 2196', ...BG96,
    bio: 'Seventy-four. Comes to the wall of names every evening to read her mother\'s name out loud, so the city remembers it once more.',
    look: { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 74, height: 1.6, build: 0.94, skin: 0x5a3622, hair: 0xc8c4be, hairStyle: 'bun', eyes: 0x24160c, wrinkles: 0.85,
      topType: 'jacket', top: 0x5a4a3a, topKind: 'fabric', hood: true, vest: 0x4a3a2a, pantsType: 'trousers', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018 },
    vp: { sex: 'f', pitch: 0.92, rate: 0.86, langs: ['en-GB', 'en-NG', 'en-US'] },
  });
  registerCast('m18mira', {
    name: 'MIRA VAREN', role: 'A pattern · 61 % · the Long Array',
    bio: 'Officially dead for twenty-three years. Sixty-one percent of her persisted in the Chronolith. Tonight she has found a transmitter.',
    look: { ...(CAST.mira?.look || {}), role: 'mira', era: '2049', costume: 'mira', sex: 1, female: true, age: 29 },
    rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 1.1, rate: 0.94, langs: ['en-GB', 'en-US'] },
  });
  registerCast('m18kai6', { name: 'KAI, 6', role: 'Residue · Varrow Gorge, 2025', look: { ...KID_KAI6 }, rimColor: 0xffd8a0, vp: { sex: 'm', pitch: 1.55, rate: 1.12, langs: ['en-GB', 'en-US'] } });
  registerCast('m18mira9', { name: 'MIRA, 9', role: 'Residue · Varrow Gorge, 2025', look: { ...KID_MIRA9 }, rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 1.45, rate: 1.06, langs: ['en-GB', 'en-US'] } });
  registerCast('m18band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist · binding', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m18sera', { name: 'SERA VOSS', role: 'Radio · 2196', portraitOf: 'sera', voice: true, vp: { sex: 'f', pitch: 0.94, rate: 1.0, langs: ['en-GB', 'en-US'] } });
  registerCast('m18jossr', { name: 'JOSS HARROW', role: 'Radio · the convoy', portraitOf: 'joss', voice: true, vp: { sex: 'm', pitch: 0.8, rate: 0.9, langs: ['en-GB', 'en-IE', 'en-US'] } });
  registerCast('m18adair', { name: 'PREFECT IMA ADAIR', role: 'Continuum channel', portraitOf: 'prefect', voice: true, vp: { sex: 'f', pitch: 0.96, rate: 0.93, langs: ['en-GB', 'en-US'] } });
  registerCast('m18array', { name: 'HELIX LONG ARRAY', role: 'Automated · Halcyon Hill', voice: true, vp: { sex: 'm', pitch: 0.86, rate: 0.95, langs: ['en-US', 'en-GB'] } });
  registerCast('m18pass', { name: 'PASSENGER', role: 'Night bus N4 · the Eastway, 2049', look: { ...PASSENGERS[2], lod: false }, vp: { sex: 'f', pitch: 0.96, rate: 0.9, langs: ['en-GB', 'en-US'] } });
  registerCast('m18trooper', { name: 'CONTINUUM TROOPER', role: 'Test Hall C · helmet sealed', voice: true, vp: { sex: 'm', pitch: 0.8, rate: 1.0, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music (bible: Future "beautiful catastrophe", Kai "the need to fix it" 92 BPM with ticking that drifts off-grid, Mira
// "memory without a body" 64 BPM felt piano and warm cello, three notes E-B-A). musicState drives layers.
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { anchor: 1, surge: 0, collapse: 0, threat: 0, repair: 0, climb: 0 };
export function registerM18Themes() {
  registerTheme('m18-storm', { bpm: 84, step(a, s, t, d) {            // the failing anchor: a pulse that speeds as it fails
    const bar = Math.floor(s / 16), b = s % 16, fail = 1 - musicState.anchor, ch = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016 + fail * 0.008, 420 + fail * 500); a.cello(ch[0] - 12, t, d * 16, 0.045); }
    if (b % (fail > 0.55 ? 2 : 4) === 0) a.tick(t, 0.01 + fail * 0.012, 2600);
    if (b === 0 || b === 8) a.drum(t, 0.05 + fail * 0.04, 60, 34);
    if ((b === 6 || b === 14) && bar % 2 === 0) a.piano(ch[(b >> 2) % 4] + 12, t, 0.05, 3);
    if (b === 10 && fail > 0.35) a.glass(ch[3] + 24, t, 0.01);
  } });
  registerTheme('m18-hall', { bpm: 76, step(a, s, t, d) {             // people leaving: warm plucks under the storm
    const bar = Math.floor(s / 16), b = s % 16, ch = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.014, 800); a.cello(ch[0] - 12, t, d * 16, 0.035); }
    if ([0, 3, 6, 10, 13].includes(b)) a.pluck(ch[b % 4] + 12, t, 0.035);
    if (b % 8 === 4) a.tick(t, 0.008 + (1 - musicState.anchor) * 0.01, 2400);
    if (b === 8 && bar % 2) a.flute(ch[3] + 12, t, d * 6, 0.013);
  } });
  registerTheme('m18-gorge', { bpm: 70, step(a, s, t, d) {            // 2026, an autumn gorge: open fifths, a plucked line
    const bar = Math.floor(s / 16), b = s % 16, ch = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.013, 1100); a.cello(ch[0] - 12, t, d * 16, 0.03); }
    if ([0, 4, 7, 10, 12].includes(b)) a.pluck(ch[(b >> 1) % 4] + 12, t, 0.03);
    if (b === 2 && bar % 4 === 1) a.flute(ch[2] + 12, t, d * 10, 0.014);
  } });
  registerTheme('m18-tear', { bpm: 70, step(a, s, t, d) {             // 2049 over the gorge: glass, a hum, a void
    const b = s % 16, bar = Math.floor(s / 16);
    if (b === 0) { a.pad([38, 45, 51], t, d * 16, 0.014, 320); a.cello(26, t, d * 16, 0.04); }
    if (s % 7 === 0) a.glass([83, 86, 81][Math.floor(s / 7) % 3], t, 0.01);
    if (b === 12 && bar % 2) a.piano(62, t, 0.04, 3);
  } });
  registerTheme('m18-flood', { bpm: 92, step(a, s, t, d) {            // Kai's drive: dry piano cells, ticking that drifts
    const bar = Math.floor(s / 16), b = s % 16, sg = musicState.surge, ch = [[45, 52, 55], [41, 48, 52], [43, 50, 53], [40, 47, 50]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.012 + sg * 0.01, 360 + sg * 600); a.cello(ch[0] - 12, t, d * 16, 0.04 + sg * 0.02); }
    if ([0, 3, 6].includes(b % 8)) a.piano(ch[(b + bar) % 3] + 12, t, 0.035, 0.6);
    a.tick(t + ((b * 7) % 5) * 0.004 * sg, 0.006 + sg * 0.008, 3200);
    if (sg > 0.4 && (b === 0 || b === 10)) a.drum(t, 0.06 + sg * 0.06, 70, 36);
  } });
  registerTheme('m18-pit', { bpm: 70, step(a, s, t, d) {              // 2026 under the Eastway: grey daylight, an engine
    const b = s % 16;
    if (b === 0) { a.pad([43, 50, 55], t, d * 16, 0.012, 700); a.cello(31, t, d * 16, 0.03); }
    if (b % 4 === 0) a.drum(t, 0.02, 90, 50);
    if (b === 6 || b === 13) a.pluck([67, 62, 59][s % 3], t, 0.025);
  } });
  registerTheme('m18-tower', { bpm: 66, step(a, s, t, d) {            // the leaning tower: bowed metal, a low creak pulse
    const bar = Math.floor(s / 16), b = s % 16, c = musicState.collapse, ch = [[40, 47, 52], [41, 48, 51], [38, 45, 50], [36, 43, 50]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.015, 300 + c * 500); a.cello(ch[0] - 12, t, d * 16, 0.05); }
    if (b === 4 || b === 12) a.glass(ch[2] + 24 - (bar % 2), t, 0.008 + c * 0.01);
    if (c > 0.3 && b % 2 === 0) a.tick(t, 0.01 + c * 0.012, 1800);
    if (c > 0.5 && (b === 0 || b === 8)) a.drum(t, 0.08, 55, 30);
    if (b === 9 && bar % 2 === 0) a.piano(ch[1] + 12, t, 0.04, 4);
  } });
  registerTheme('m18-office', { bpm: 66, step(a, s, t, d) {           // the same floors in 2049: a muffled office hum
    const b = s % 16;
    if (b === 0) { a.pad([52, 59, 64], t, d * 16, 0.012, 1400); }
    if (b % 2 === 0) a.tick(t, 0.012, 5200);
    if (b === 7) a.piano(76, t, 0.03, 1.5);
  } });
  registerTheme('m18-defend', { bpm: 104, step(a, s, t, d) {          // the stand at the ring: threat and repair layers
    const bar = Math.floor(s / 16), b = s % 16, th = musicState.threat, rp = musicState.repair, ch = [[45, 52, 57], [43, 50, 55], [41, 48, 53], [40, 47, 52]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.013 + rp * 0.01, 500 + rp * 900); a.cello(ch[0] - 12, t, d * 16, 0.05); }
    if (b % 4 === 0 || (th > 0.5 && b % 4 === 2)) a.drum(t, 0.05 + th * 0.07, 80, 38);
    if (b % 2 === 1) a.tick(t, 0.007 + th * 0.01, 3600);
    if (rp > 0.3 && [0, 6, 10].includes(b)) a.pluck(ch[b % 3] + 12, t, 0.03);
    if (rp > 0.66 && b === 8) a.flute(ch[2] + 12, t, d * 6, 0.015);
  } });
  registerTheme('m18-array', { bpm: 70, step(a, s, t, d) {            // Halcyon Hill: wide strings, wind, a slow rise
    const bar = Math.floor(s / 16), b = s % 16, cl = musicState.climb, ch = [[45, 52, 57, 64], [48, 55, 60, 67], [50, 57, 62, 69], [52, 59, 64, 71]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.015 + cl * 0.008, 500 + cl * 700); a.cello(ch[0] - 12, t, d * 16, 0.045); }
    if (b === 0 || b === 8) a.drum(t, 0.03, 50, 30);
    if (cl > 0.3 && b % 4 === 2) a.pluck(ch[(b >> 2) % 4] + 12, t, 0.03);
    if (cl > 0.6 && (b === 6 || b === 14)) a.piano(ch[3] + 12, t, 0.05, 3.5);
  } });
  registerTheme('m18-mira', { bpm: 64, step(a, s, t, d) {             // Memory Without a Body: felt piano, warm cello, E-B-A
    const bar = Math.floor(s / 16), b = s % 16, ch = [[52, 59, 64], [47, 54, 59], [45, 52, 57], [48, 55, 60]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.014, 700); a.cello(ch[0] - 12, t, d * 16, 0.05); }
    if (bar % 2 === 0 && (b === 0 || b === 4 || b === 8)) a.piano([64, 71, 69][b >> 2], t, 0.07, 4);
    if (bar % 2 === 1 && b === 6) a.piano(ch[2] + 12, t, 0.045, 5);
    if (b === 12 && bar % 4 === 3) a.glass(88, t, 0.006);
  } });
  registerTheme('m18-memory', { bpm: 60, step(a, s, t, d) {           // the carving: a child's tune on a music box
    const b = s % 16, bar = Math.floor(s / 16);
    if (b === 0) a.pad([50, 57, 62], t, d * 16, 0.012, 900);
    if (b % 2 === 0) a.glass([74, 78, 81, 78, 76, 74, 71, 74][(b >> 1) + (bar % 2) * 0], t, 0.012);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Code-drawn signs and papers
// ---------------------------------------------------------------------------------------------------------------------
const grain = (g, w, h, n, a, seed = 3) => { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } };
/** A sign: lines [[text, size, colour?, weight?]], bg / fg / border; key for the cache. */
export function signTex(key, lines, o = {}) {
  const w = o.w || 512, h = o.h || 256;
  return canvasTex(w, h, (g) => {
    g.fillStyle = o.bg || '#1c2a30'; g.fillRect(0, 0, w, h);
    if (o.grain !== false) grain(g, w, h, 900, 0.06, key.length);
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = o.bw || 8; g.strokeRect(10, 10, w - 20, h - 20); }
    if (o.stripe) { g.fillStyle = o.stripe; for (let x = -h; x < w; x += 44) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 22, h); g.lineTo(x + 22 + h * 0.25, h - h * 0.25); g.lineTo(x + h * 0.25, h - h * 0.25); g.fill(); } }
    g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    const tot = lines.reduce((s, l) => s + (l[1] || 30) * 1.3, 0); let y = (o.top ?? (h - tot) / 2);
    for (const [txt, size = 30, c, wt = 700, font] of lines) { g.font = `${wt} ${size}px ${font || FONT}`; g.fillStyle = c || o.fg || '#e8eef0'; y += size * 0.65; g.fillText(txt, o.align === 'left' ? 30 : w / 2, y); y += size * 0.65; }
    if (o.wear) { g.globalCompositeOperation = 'destination-out'; const r = rng(key.length * 3); for (let i = 0; i < 60 * o.wear; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.6})`; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 14, 0, 7); g.fill(); } g.globalCompositeOperation = 'source-over'; }
  }, 'm18sign' + key);
}
export function paperTex(key, title, lines, o = {}) {
  return canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = o.bg || '#e6dcc2'; g.fillRect(0, 0, w, h); grain(g, w, h, 2400, 0.05, key.length + 1);
    g.fillStyle = o.ink || '#2a2018'; g.font = `700 30px ${FONT}`; g.textAlign = 'left'; g.fillText(title, 34, 64);
    g.fillRect(34, 80, w - 68, 2);
    g.font = o.hand ? `500 30px ${HAND}` : `500 23px ${FONT}`;
    lines.forEach((l, i) => g.fillText(l, 34, 128 + i * (o.hand ? 40 : 34)));
  }, 'm18paper' + key);
}
export const TEX = {
  tally: (n, total) => canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#2a3226'; g.fillRect(0, 0, w, h); grain(g, w, h, 1600, 0.08, 7);
    g.strokeStyle = 'rgba(230,240,220,0.8)'; g.fillStyle = 'rgba(232,240,220,0.92)'; g.font = `600 40px ${HAND}`; g.textAlign = 'left';
    g.fillText('OUT THROUGH THE GATE', 28, 54);
    g.font = `600 64px ${HAND}`; g.fillText(`${n} / ${total}`, 28, 140);
    g.lineWidth = 4; for (let i = 0; i < n; i++) { const gx = 30 + (Math.floor(i / 5) % 8) * 58, gy = 186 + Math.floor(i / 40) * 60; if (i % 5 === 4) { g.beginPath(); g.moveTo(gx - 6, gy + 40); g.lineTo(gx + 40, gy + 4); g.stroke(); } else { g.beginPath(); g.moveTo(gx + (i % 5) * 9, gy); g.lineTo(gx + (i % 5) * 9, gy + 44); g.stroke(); } }
  }, 'm18tally' + n),
  carving: () => canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(240,226,200,0.9)'; g.lineWidth = 7; g.lineCap = 'round';
    g.font = `700 150px ${HAND}`; g.fillStyle = 'rgba(0,0,0,0)';
    g.strokeText('K + M', 60, 230); g.lineWidth = 5; g.font = `700 90px ${HAND}`; g.strokeText('2025', 150, 360);
    g.beginPath(); g.moveTo(80, 410); g.lineTo(430, 400); g.stroke();
  }, 'm18carving'),
  dial: (note, ok) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#0c1012'; g.fillRect(0, 0, w, h); g.strokeStyle = ok ? '#b6ff8a' : '#9a7bff'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 104, 0, 7); g.stroke();
    g.fillStyle = ok ? '#d8ffc0' : '#d8ccff'; g.font = `700 120px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(note, 128, 136);
  }, 'm18dial' + note + ok),
};

// ---------------------------------------------------------------------------------------------------------------------
// Shared helpers: per-state batches, collision, light sources, planes; disposal
// ---------------------------------------------------------------------------------------------------------------------
export function kit(game, scene, T, name) {
  const col = game.collision, root = new THREE.Group(); root.name = name; scene.add(root);
  const BS = {};
  const bat = (e = 'all') => BS[e] || (BS[e] = new Batch());
  const box = (x0, y0, z0, x1, y1, z1, e) => col.add([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], e && e !== 'all' ? { states: [].concat(e) } : {});
  const solid = (mat, x0, y0, z0, x1, y1, z1, e) => { bat(e || 'all').box(mat, x0, y0, z0, x1, y1, z1); return box(x0, y0, z0, x1, y1, z1, e); };
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const lightSrc = [];
  const src = (x, y, z, c, i, d, era = 'all') => lightSrc.push({ p: [x, y, z], c, i, d, era });
  const add = (obj, e) => { root.add(obj); if (e && e !== 'all') T.only(obj, ...[].concat(e)); return obj; };
  const plane = (tex, w, h, x, y, z, ry, emiss = 0.25, e) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emiss, transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; return add(m, e);
  };
  const ground = (mat, x0, z0, x1, z1, y = 0, e) => { const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)); g.rotateX(-PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); bat(e).push(mat, g); };
  // stairs: n steps along z (dir ±1) from zStart at floor y0, each rise / run; visual + collision
  const flight = (mat, x0, x1, zStart, dir, y0, n, rise, run, e) => {
    for (let i = 0; i < n; i++) {
      const za = zStart + dir * i * run, zb = za + dir * run, y = y0 + (i + 1) * rise;
      solid(mat, x0, y - Math.min(0.5, (i + 1) * rise), Math.min(za, zb), x1, y, Math.max(za, zb), e);
    }
  };
  const finish = () => { for (const [e, b] of Object.entries(BS)) { const g = new THREE.Group(); b.build(g, { name: name + '-' + e }); add(g, e); } for (const k of Object.keys(BS)) delete BS[k]; };
  return { root, bat, box, solid, pm, src, lightSrc, add, plane, ground, flight, finish };
}
/** Free the geometry a chapter built (materials and baked textures are shared caches and stay). */
export function disposeGroup(g) { g?.traverse(o => { if (o.geometry && !o.userData.keepGeo) o.geometry.dispose?.(); }); g?.parent?.remove(g); }

/** Storm material: slow violet / cyan bands rolling up a wall (additive, no strobing). */
export function stormMaterial(a = 0x8a6aff, b = 0x5fe6ff, amp = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uAmp: { value: amp } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uAmp; varying vec2 vUv; varying vec3 vW;\n' +
      'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
      'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }\n' +
      'void main(){ vec2 p = vec2(vUv.x * 48.0, vUv.y * 6.0);\n' +
      ' float f = n(p + vec2(uTime * 0.15, -uTime * 0.35)) * 0.6 + n(p * 2.3 + vec2(-uTime * 0.2, -uTime * 0.6)) * 0.4;\n' +
      ' float band = smoothstep(0.35, 0.95, f); float v = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));\n' +
      ' vec3 c = mix(uA, uB, smoothstep(0.4, 0.9, n(p * 0.5 + uTime * 0.05)));\n' +
      ' gl_FragColor = vec4(c * (0.35 + band * 1.1), (0.22 + band * 0.55) * v * uAmp); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}
/** A ring of storm around (cx, cz): returns the mesh; animate mat.uniforms.uTime, scale x/z for the radius. */
export function stormWall({ center = [0, 0], radius = 120, height = 90, y = -4, a, b, amp } = {}) {
  const mat = stormMaterial(a, b, amp);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, height, 72, 1, true), mat);
  m.position.set(center[0], y + height / 2, center[1]); m.scale.set(radius, 1, radius);
  m.userData.noBatch = true; m.frustumCulled = false; m.renderOrder = 2; m.userData.noCapture = true;
  return m;
}
/** Storm cells: drifting columns that throw Kai back a few seconds. list: { x, y, z, r, path: [[dx, dz], ...], period, era } */
export function stormCells(scene, T, list, color = 0xb08aff) {
  const out = [];
  for (const c of list) {
    const g = new THREE.Group(); g.position.set(c.x, c.y, c.z); scene.add(g);
    const mat = zoneMaterial(color), hgt = c.h || 6;
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, hgt, 32, 1, true), mat); shell.position.y = hgt / 2; shell.scale.set(c.r, 1, c.r); shell.userData.noBatch = true; g.add(shell);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: 0xd8c8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    ring.rotation.x = -PI / 2; ring.position.y = 0.05; ring.scale.setScalar(c.r); ring.userData.noBatch = true; g.add(ring);
    if (c.era) T.only(g, ...[].concat(c.era));
    out.push({ ...c, g, mat, cx: c.x, cz: c.z, on: true });
  }
  return {
    cells: out,
    update(t) {
      for (const c of out) {
        c.mat.uniforms.uTime.value = t;
        const path = c.path || [[0, 0]], per = c.period || 8, k = ((t / per) % 1) * path.length, i = Math.floor(k), f = k - i, A = path[i], B = path[(i + 1) % path.length];
        const s = f * f * (3 - 2 * f); c.cx = c.x + A[0] + (B[0] - A[0]) * s; c.cz = c.z + A[1] + (B[1] - A[1]) * s;
        c.g.position.x = c.cx; c.g.position.z = c.cz; c.g.visible = c.on && (!c.era || [].concat(c.era).includes(T.current));
      }
    },
    hit(p) { for (const c of out) { if (!c.on || !c.g.visible) continue; if (Math.abs(p.y - c.y) < 3 && Math.hypot(p.x - c.cx, p.z - c.cz) < c.r + 0.25) return c; } return null; },
  };
}
/** Temporal shard: a small glowing crystal. */
export function shardMesh() {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glowMat(0xd8f6ff, 2.6)); m.scale.set(0.8, 1.5, 0.8); m.userData.noBatch = true; return m;
}

// =====================================================================================================================
// II · VARROW GORGE (2026 / 2049)
// =====================================================================================================================
export const rampY = (z) => (z >= 34 ? 0 : z <= -26 ? -16 : -16 * (34 - z) / 60);
export function buildGorge(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low', R = rng(1802);
  const K = kit(game, scene, T, 'gorge'), { box, solid, pm, src, add, plane, ground, bat } = K;
  const W = { lightSrc: K.lightSrc, root: K.root };
  const M = {
    asphalt: pm('wetAsphalt', { color: 0x34363a, puddles: 0.35 }), verge: pm('dirt', { color: 0x4a4436 }), grass: pm('grass', { color: 0x5a6a34 }),
    dirt: pm('dirt', { color: 0x7a6248 }), gravel: pm('gravel', { color: 0x8a8274 }), concrete: pm('concrete', { color: 0x9a968c, formwork: 1, stains: 0.4 }),
    conc49: pm('concrete', { color: 0x6a6862, formwork: 0, stains: 0.8 }), steel: pm('brushedMetal', { color: 0x8a8e90, roughness: 0.45 }),
    yellow: pm('paintedMetalPanel', { color: 0xd8a420, cols: 2, rows: 1, wear: 0.25, grime: 0.3, gloss: 0.4 }), timber: pm('wood', { color: 0x8a6a44, planks: 4 }),
    hoarding: pm('paintedMetalPanel', { color: 0x2e5a3a, cols: 6, rows: 1, wear: 0.2, grime: 0.4, gloss: 0.2 }), cabin: pm('paintedMetalPanel', { color: 0xc8c8be, cols: 4, rows: 1, wear: 0.3, grime: 0.5, gloss: 0.3 }),
    rock: pm('rock', { color: 0x8a7a68 }),
  };
  const amber = glowMat(0xffb040, 2.4), red = glowMat(0xff4030, 2.0), violet = glowMat(0xb08aff, 2.6);
  W.mats = { amber, red, violet };

  // ---------- the gorge (2026): a terrain carved to the walkable surfaces ----------
  const hgt = (x, z) => {
    const ax = Math.abs(x), n = RZ.noise.fbm2(x * 0.09 + 3, z * 0.07, 4);
    if (x > -13.4 && x < -9.3 && z > -28 && z < 36) return rampY(z) - 0.06;                         // the haul ramp ledge
    if (ax >= 14.6) return -0.04 + Math.max(0, n) * 0.25 + (ax > 40 ? (ax - 40) * 0.12 : 0);
    if (ax < 2.6) return -17.8 + n * 0.3;
    if (ax < 8) return -16.05 + n * 0.12;
    const t = (ax - 8) / 6.6, wall = -16 + 16 * Math.pow(t, 0.55);
    if (x < 0 && z > -28 && z < 36) { const r = rampY(z); if (x < -13.4) return Math.max(r, wall) + n * 0.8; return Math.min(wall, r) + n * 1.2; }
    return wall + n * 1.6 - (t < 0.9 ? 0 : 0);
  };
  try {
    const ter = RZ.terrain({ size: 200, sizeZ: 150, center: [0, 0], heightFn: hgt, segments: low ? 120 : 180, rockSlope: 0.3, dirt: 0.35, waterLevel: -16.6,
      layers: [['grass', { color: 0x6a7438 }], ['dirt', { color: 0x7a6248 }], ['rock', { color: 0x9a8a74 }], ['sand', { color: 0xa89a80 }]] });
    add(ter.mesh, '2026'); W.terrain = ter.mesh;
  } catch (e) { console.warn('m18 terrain', e); }
  try { const wat = RZ.water({ rect: [-2.8, -75, 5.6, 150], level: -16.55, flow: [0, -0.6], deep: 0x1a3a3a, shallow: 0x4a7a6a, heightAt: () => -18 }); add(wat.mesh, '2026'); W.river = wat.mesh; } catch (e) { console.warn('m18 river', e); }

  // collision: rims (both), floor and banks (2026), the river bed (low, so a fall in reads as a fall)
  box(-100, -1, -75, -14, 0, 75); box(14, -1, -75, 100, 0, 75);
  box(-8.2, -17, -75, -2.5, -16, 75, '2026'); box(2.5, -17, -75, 8.2, -16, 75, '2026'); box(-2.5, -19, -75, 2.5, -18.2, 75, '2026');
  // the walls (2026): solid above the floor so nobody walks up them; the ramp ledge is carved out of the west one
  box(-14, -16, -75, -13.4, 0, 75, '2026'); box(13.4, -16, -75, 14, 0, 75, '2026');
  box(-13.4, -16, -75, -8.2, -0.2, -28, '2026'); box(-13.4, -16, 36, -8.2, 0, 75, '2026'); box(8.2, -16, -75, 13.4, -0.2, 75, '2026');
  // ramp: 54 steps of 0.296 from z 34 to -26, a timber rail on the drop side, and the wall below it
  for (let i = 0; i < 54; i++) {
    const za = 34 - i * (60 / 54), zb = za - 60 / 54, y = -(i + 1) * (16 / 54);
    box(-13.4, y - 0.6, zb, -9.6, y, za, '2026');
    box(-9.6, -16, zb, -8.2, y - 0.6, za, '2026');
  }
  box(-13.4, -16.5, -28, -9.6, -16, -26, '2026'); box(-9.6, -16.5, -28, -8.2, -16, -26, '2026');
  box(-14, -0.5, 34, -9.6, 0, 38, '2026');                                     // landing at the top
  for (let i = 0; i < 9; i++) { const z = 30 - i * 6.6, y = rampY(z); bat('2026').box(M.timber, -9.75, y, z - 0.08, -9.6, y + 1.05, z + 0.08); }
  for (let i = 0; i < 8; i++) { const za = 30 - i * 6.6, zb = za - 6.6; const ya = rampY(za) + 0.95, yb = rampY(zb) + 0.95; bat('2026').geo(M.timber, new THREE.BoxGeometry(0.08, 0.1, 6.7), [-9.68, (ya + yb) / 2, (za + zb) / 2], [Math.atan2(ya - yb, 6.6), 0, 0]); }
  box(-9.8, -16, -26, -9.5, 1.0, 34, '2026');                                    // rail as a collider along the whole ramp edge
  // rim barriers: 2026 site fencing (gaps at the ramp landing and the west deck), 2049 crash barrier on the torn edge
  box(-14.4, 0, -75, -14.1, 1.1, -2.6, '2026'); box(-14.4, 0, 2.6, -14.1, 1.1, 34, '2026'); box(-14.4, 0, 38, -14.1, 1.1, 75, '2026');
  box(-14.4, 0, -75, -14.1, 1.1, 75, '2049'); box(14.1, 0, -75, 14.4, 1.1, -12.2, '2026'); box(14.1, 0, 12.2, 14.4, 1.1, 75, '2026');
  box(14.1, 0, -12.2, 14.4, 1.1, 12.2, '2026');
  for (let z = -48; z < 48; z += 2.4) { if ((z > 33 && z < 38.5) || Math.abs(z) < 2.8) continue; bat('2026').box(M.yellow, -14.35, 0, z, -14.15, 1.0, z + 0.06); bat('2026').box(M.yellow, -14.35, 0.92, z, -14.15, 1.0, z + 2.4); }

  // ---------- the haul road, the site compound and its hoarding (2026) ----------
  ground(M.gravel, -34, -50, -14, 50, 0.01, '2026');
  for (let z = -50; z < 50; z += 2.5) { if (Math.abs(z) < 0.1) continue; bat('2026').box(M.hoarding, -34.2, 0, z, -34, 2.4, z + 2.46); }
  box(-34.2, 0, -75, -34, 2.4, 75, '2026');
  plane(signTex('siteboard', [['RAIN CITY TRANSPORT', 22, '#cfe8d6'], ['EASTWAY · VARROW FILL', 40], ['CONTRACT 7 · CORRAN & VEY CIVIL', 22, '#cfe8d6'], ['Sponsor: Helix Temporal Research (logistics corridor)', 18, '#e8d8a0', 500], ['Gorge filled by 2031 · Keep out', 22, '#ffd27a']], { bg: '#24463a', border: '#cfe8d6', h: 300 }), 3.6, 2.1, P2.board[0], P2.board[1], P2.board[2], -PI / 2, 0.15, '2026');
  // generator hut
  solid(M.cabin, -27.6, 0, -17.4, -24.4, 2.4, -14.6, '2026'); bat('2026').box(M.steel, -28.0, 0, -16.8, -27.6, 1.2, -15.2);
  W.genLamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.16), red.clone()); W.genLamp.position.set(-28.05, 1.5, -16); add(W.genLamp, '2026');
  plane(signTex('gen', [['SITE GENERATOR G-2', 30], ['400 V · CRANE 2 · HOIST', 22, '#ffd27a']], { bg: '#202428', border: '#ffd27a', h: 200 }), 1.2, 0.48, -28.06, 1.9, -16, -PI / 2, 0.2, '2026');
  // site office: a cabin with a whiteboard inside its window
  solid(M.cabin, -31, 0, 11.4, -25, 2.8, 16.4, '2026');
  plane(paperTex('wboard', 'VARROW FILL · WEEK 41', ['Pier 2 to deck: Mon', 'Culvert C-3 pour Fri (strike formwork!)', 'Crane 2 load: girder G-7 over river', 'Helix trucks: route via fill from 2031', '', 'NO public access to the gorge.', 'Kids seen at the river again.'], { bg: '#f2f2ee', ink: '#1a3a7a', hand: true }), 1.3, 1.6, -24.96, 1.5, 13.9, PI / 2, 0.25, '2026');
  for (const [x, z] of [[-30, -30], [-22, 26], [-18, -40]]) bat('2026').geo(M.dirt, new THREE.ConeGeometry(3 + R() * 2, 2 + R() * 1.4, 7), [x, 0.8, z], [0, R() * 3, 0]);
  for (let i = 0; i < 4; i++) bat('2026').box(M.yellow, -22 + i * 0.5, 0, 30, -21.6 + i * 0.5, 0.5, 38);  // stacked girders
  src(-27, 2.8, -12, 0xffe2b0, 4, 10, '2026'); src(-28, 3.2, 18, 0xffe2b0, 3, 9, '2026');

  // ---------- the 2049 Eastway on both rims; the torn fill and its island ----------
  ground(M.asphalt, -100, -12, -14.2, 12, 0.012, '2049'); ground(M.verge, -100, -75, -14.2, -12, 0.0, '2049'); ground(M.verge, -100, 12, -14.2, 75, 0.0, '2049');
  ground(M.asphalt, 2, -12, 100, 12, 0.012, '2049'); ground(M.verge, 14, -75, 100, -12, 0.0, '2049'); ground(M.verge, 14, 12, 100, 75, 0.0, '2049');
  ground(M.grass, -100, -75, -34.2, 75, 0.0, '2026'); ground(M.grass, 14.2, -75, 100, 75, 0.005, '2026');
  box(2, -30, -12.2, 14, 0, 12.2, '2049');                                          // the island: fill under the road
  solid(M.conc49, 1.6, -9, -12.2, 2.0, 0, 12.2, '2049');                            // its torn west face
  for (let i = 0; i < 10; i++) bat('2049').geo(M.conc49, new THREE.DodecahedronGeometry(0.8 + R() * 1.2, 0), [1.4 + R() * 0.6, -1 - R() * 6, -11 + R() * 22], [R(), R(), R()]);
  try { const st = []; for (const [x, len] of [[-57, 86], [51, 98]]) { st.push({ x, z: 0, length: len, width: 0.16, yaw: PI / 2, dash: [3, 6] }); for (const z of [-11.4, 11.4]) st.push({ x, z, length: len, width: 0.18, yaw: PI / 2 }); }
    add(RZ.roadPaint({ strips: st, y: 0.022, seed: 18, wear: 0.3 }), '2049'); } catch (e) { void e; }
  for (const x of [-14.6, 2.4]) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 24.4), M.steel); g.position.set(x, 0.4, 0); add(g, '2049'); }
  box(1.9, 0, -12.2, 2.3, 1.1, 12.2, '2049');
  // the void where the fill was: a storm floor and two torn walls
  const voidM = stormMaterial(0x6a4aff, 0x2ae6ff, 1.1);
  const vfloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 150, 1, 1), voidM); vfloor.rotation.x = -PI / 2; vfloor.position.set(-6, -7, 0); vfloor.userData.noBatch = true; add(vfloor, '2049');
  for (const x of [-14.2, 1.8]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(150, 14), voidM); w.rotation.y = PI / 2; w.position.set(x, -7, 0); w.userData.noBatch = true; add(w, '2049'); }
  W.voidMat = voidM;
  plane(signTex('e2closed', [['EASTWAY E2', 36], ['VARROW FILL · CLOSED', 26, '#ffd27a'], ['HALDEN 4 · HELIX 9', 22, '#cfe0e8', 500]], { bg: '#1a3a5a', border: '#e8eef0', h: 220 }), 4.2, 1.8, -30, 6.2, -6, PI / 2, 0.35, '2049');
  bat('2049').box(M.steel, -30.2, 0, -12.6, -29.8, 7.2, -12.2); bat('2049').box(M.steel, -30.2, 0, 12.2, -29.8, 7.2, 12.6); bat('2049').box(M.steel, -30.2, 7.0, -12.6, -29.8, 7.3, 12.6);
  plane(signTex('helix9', [['HALDEN 4', 34], ['HELIX 9 →', 34, '#5fe6ff']], { bg: '#1a3a5a', border: '#e8eef0', h: 200 }), 3.6, 1.6, 30, 6.2, 6, -PI / 2, 0.35, '2049');
  bat('2049').box(M.steel, 29.8, 0, -12.6, 30.2, 7.2, -12.2); bat('2049').box(M.steel, 29.8, 0, 12.2, 30.2, 7.2, 12.6); bat('2049').box(M.steel, 29.8, 7.0, -12.6, 30.2, 7.3, 12.6);
  src(-36, 7, 0, 0x9fc4ff, 3, 16, '2049'); src(20, 7, 0, 0x9fc4ff, 3, 16, '2049');

  // ---------- the half-built deck, the pier, the hoist (2026) ----------
  solid(M.steel, -14.1, -0.4, -2.4, -5, 0, 2.4, '2026'); solid(M.steel, 4, -0.4, -2.4, 9.6, 0, 2.4, '2026');
  for (const [x0, x1] of [[-14, -5], [4, 9.6]]) for (const z of [-2.2, 2.2]) bat('2026').box(M.yellow, x0, 0, z - 0.06, x1, 1.0, z + 0.06);
  box(-14, 0, -2.5, -5, 1.0, -2.3, '2026'); box(-14, 0, 2.3, -5, 1.0, 2.5, '2026'); box(4, 0, -2.5, 9.6, 1.0, -2.3, '2026'); box(4, 0, 2.3, 9.6, 1.0, 2.5, '2026');
  box(-5.1, 0, -2.4, -4.9, 1.0, 2.4, '2026');                                       // the west deck ends in a barrier: no jumping off
  for (let x = -13; x < -5; x += 2.2) bat('2026').box(M.steel, x, -1.4, -2.4, x + 0.3, -0.4, 2.4);
  solid(M.concrete, 8.0, -16, -1.8, 10.4, -0.4, 1.8, '2026');                        // pier 2
  solid(M.concrete, -11, -0.4, -1.8, -8.6, -0.0, 1.8, '2026');
  bat('2026').box(M.concrete, -12.6, -16, -1.8, -10.2, -0.4, 1.8);                    // pier 1 (west, inside the wall)
  // hoist tower and cage
  for (const [x, z] of [[5.5, -0.9], [7.3, -0.9], [5.5, 0.9], [7.3, 0.9]]) bat('2026').box(M.yellow, x - 0.07, -16, z - 0.07, x + 0.07, 0.6, z + 0.07);
  for (let y = -15; y < 0; y += 1.6) { bat('2026').box(M.yellow, 5.45, y, -0.95, 7.35, y + 0.08, -0.85); bat('2026').box(M.yellow, 5.45, y, 0.85, 7.35, y + 0.08, 0.95); }
  const cage = new THREE.Group(); cage.position.set(P2.hoist[0], P2.hoist[1], P2.hoist[2]); add(cage, '2026'); W.cage = cage;
  { const fl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.6), M.steel); fl.position.y = 0.06; cage.add(fl);
    for (const [x, z] of [[-0.78, -0.78], [0.78, -0.78], [-0.78, 0.78], [0.78, 0.78]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.06), M.yellow); p.position.set(x, 1.1, z); cage.add(p); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.6), M.yellow); top.position.y = 2.2; cage.add(top);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), amber); lamp.position.set(0, 2.3, 0); cage.add(lamp); W.cageLamp = lamp; }
  W.cageBox = box(5.6, -16.2, -0.8, 7.2, -16.0, 0.8, '2026'); W.cageBox.enabled = false;
  // the pier ladder (from the hoist top to the deck)
  for (let y = -4.6; y < 0; y += 0.32) bat('2026').box(M.steel, 7.88, y, -0.3, 7.96, y + 0.04, 0.3);
  bat('2026').box(M.steel, 7.88, -4.8, -0.34, 7.96, 0.9, -0.3); bat('2026').box(M.steel, 7.88, -4.8, 0.3, 7.96, 0.9, 0.34);
  src(6.4, -13.6, 0, 0xffc060, 3, 8, '2026');

  // ---------- crane 2 and its load (2026) ----------
  const [cx, cy, cz] = P2.crane;
  for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) bat('2026').box(M.yellow, cx + x - 0.09, cy, cz + z - 0.09, cx + x + 0.09, 14, cz + z + 0.09);
  for (let y = cy + 1; y < 14; y += 2.2) { bat('2026').geo(M.yellow, new THREE.BoxGeometry(2.3, 0.07, 0.07), [cx, y + 1.1, cz - 0.8], [0, 0, 0.75]); bat('2026').geo(M.yellow, new THREE.BoxGeometry(2.3, 0.07, 0.07), [cx, y + 1.1, cz + 0.8], [0, 0, -0.75]); bat('2026').geo(M.yellow, new THREE.BoxGeometry(0.07, 0.07, 2.3), [cx - 0.8, y + 1.1, cz], [0.75, 0, 0]); }
  solid(M.concrete, cx - 1.6, cy, cz - 1.6, cx + 1.6, cy + 1.0, cz + 1.6, '2026');
  const jib = new THREE.Group(); jib.position.set(cx, 14, cz); add(jib, '2026'); W.jib = jib;
  { const J = new Batch(); J.box(M.yellow, -6, 0, -0.5, 24, 1.1, 0.5); J.box(M.concrete, -6, -0.6, -0.9, -3, 0.8, 0.9); J.box(M.cabin, -0.9, -1.6, 0.6, 0.9, 0.2, 2.0); J.box(M.yellow, -0.5, 1.1, -0.5, 0.5, 5.4, 0.5); J.build(jib, { name: 'jib' }); }
  const hook = new THREE.Group(); jib.add(hook); W.hook = hook;
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), M.steel); cable.userData.noBatch = true; hook.add(cable); W.hookCable = cable;
  const girder = new THREE.Group(); add(girder, '2026'); W.girder = girder;
  { const G = new Batch(); G.box(M.yellow, -3.7, 0, -0.45, 3.7, 0.3, 0.45); G.box(M.yellow, -3.7, 0.3, -0.06, 3.7, 0.7, 0.06); G.box(M.yellow, -3.7, 0.7, -0.4, 3.7, 0.78, 0.4); G.build(girder, { name: 'girder' }); }
  W.girderBox = box(-3.7, -16.2, P2.girderZ - 0.45, 3.7, -15.42, P2.girderZ + 0.45, '2026'); W.girderBox.enabled = false;
  W.setGirder = (k) => {   // 0 = hanging over the west bank, 1 = lying across the river
    const a0 = 2.35, a1 = Math.atan2(-(P2.girderZ - cz), 0 - cx), r0 = 9, r1 = Math.hypot(0 - cx, P2.girderZ - cz);
    const a = a0 + (a1 - a0) * Math.min(1, k * 1.6), r = r0 + (r1 - r0) * Math.min(1, k * 1.6), y = -6 + (-16.02 + 6) * Math.max(0, (k - 0.6) / 0.4);
    jib.rotation.y = a; const gx = cx + Math.cos(a) * r, gz = cz - Math.sin(a) * r;
    girder.position.set(gx, y, gz); girder.rotation.y = a + (PI / 2 - a) * Math.max(0, (k - 0.3) / 0.7) - (k < 0.3 ? 0 : 0);
    hook.position.set(r, 0, 0); cable.scale.y = 14 - (y + 0.8); cable.position.y = -(14 - (y + 0.8)) / 2;
  };
  W.setGirder(0);
  // crane remote on its post
  bat('2026').box(M.steel, P2.remote[0] - 0.05, -16, P2.remote[2] - 0.05, P2.remote[0] + 0.05, -14.9, P2.remote[2] + 0.05);
  const pend = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.12), M.yellow); pend.position.set(P2.remote[0], -14.7, P2.remote[2]); add(pend, '2026');
  W.remoteLamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), red.clone()); W.remoteLamp.position.set(P2.remote[0], -14.5, P2.remote[2] + 0.07); add(W.remoteLamp, '2026');
  src(-5, -12, -9, 0xffe0b0, 3, 10, '2026');

  // ---------- the carving and the river bank ----------
  try { const rk = RZ.rocks({ placements: [{ x: P2.carving[0], z: P2.carving[2], y: -16, scale: 1.5 }, { x: -7.2, z: 22, y: -16, scale: 1.1 }, { x: 6.9, z: -26, y: -16, scale: 1.3 }, { x: -6.8, z: -34, y: -16, scale: 1.0 }, { x: 7.0, z: 30, y: -16, scale: 1.6 }], seed: 18, moss: 0.3 }); add(rk.mesh || rk, '2026'); } catch (e) { console.warn('m18 rocks', e); }
  box(P2.carving[0] - 0.9, -16, P2.carving[2] - 0.9, P2.carving[0] + 0.9, -14.9, P2.carving[2] + 0.9, '2026');
  const carve = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ map: TEX.carving(), transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  carve.position.set(P2.carving[0] + 0.94, -15.2, P2.carving[2]); carve.rotation.y = PI / 2; add(carve, '2026');

  // ---------- trees, grass and the far hills ----------
  try {
    const pl = []; for (let i = 0; i < 26; i++) { const x = (R() < 0.5 ? -1 : 1) * (40 + R() * 50), z = (R() - 0.5) * 140; pl.push({ x, z, scale: 0.8 + R() * 0.6 }); }
    for (let i = 0; i < 8; i++) pl.push({ x: 18 + R() * 16, z: (R() < 0.5 ? -1 : 1) * (18 + R() * 40), scale: 0.7 + R() * 0.5 });
    add(RZ.forest({ species: 'broadleaf', placements: pl, heightAt: (x, z) => hgt(x, z), impostors: !low, variants: 2, seed: 181 }), '2026');
  } catch (e) { console.warn('m18 trees', e); }
  try { const gr = RZ.instancedGrass({ heightAt: () => 0, mask: (x, z) => (x < -34.5 || x > 14.5) && Math.abs(z) < 70 ? 0.8 : 0, rect: [-90, -70, 180, 140], radius: 22, height: 0.5, color: 0x6a7438, tipColor: 0xc8a860, seed: 182 }); add(gr.mesh, '2026'); } catch (e) { void e; }
  try { const mt = RZ.mountains({ center: [0, 0], radius: [240, 520], height: 90, seed: 183 }); add(mt.mesh || mt, '2026'); } catch (e) { void e; }
  try { const sk = RZ.skyline({ center: [0, 0], radius: [160, 300], count: low ? 26 : 44, height: [30, 140], lit: 0.7, seed: 184 }); add(sk.mesh || sk, '2049'); } catch (e) { void e; }
  try {
    const k = streetKit({ era: '2049', seed: 1849 });
    k.car([-24, 0, -6, 0.2], PI / 2).car([-44, 0, 5, 0.1], -PI / 2).van([-60, 0, -5, 0.3], PI / 2).car([40, 0, -6, 0.2], PI / 2).car([22, 0, 5, -0.3], -PI / 2);
    k.scatter('lamp', [[-90, 12.8], [-16, 12.8]], { spacing: 22, turn: -PI / 2, y: 0 }).scatter('lamp', [[16, -12.8], [90, -12.8]], { spacing: 22, turn: PI / 2, y: 0 });
    const b49 = k.build(); add(b49, '2049'); for (const c of k.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2], '2049');
    const k2 = streetKit({ era: '2026', seed: 1826 });
    k2.scatter('cone', [[-30, -10], [-30, 10]], { spacing: 3, y: 0 }).add('barrier', [-20, 0, 34], PI / 2).add('barrier', [-20, 0, 31], PI / 2).scatter('lamp', [[-33, -40], [-33, 40]], { spacing: 20, turn: PI / 2, y: 0 });
    const b26 = k2.build(); add(b26, '2026'); for (const c of k2.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2], '2026');
  } catch (e) { console.warn('m18 street', e); }

  // ---------- shards, storm cells ----------
  W.storm = stormCells(scene, T, [
    { x: -11.5, y: rampY(22), z: 22, r: 1.35, path: [[-1.7, 0], [1.7, 0]], period: 6.5, era: '2026' },
    { x: -11.5, y: rampY(6), z: 6, r: 1.35, path: [[1.7, 0.6], [-1.7, -0.6]], period: 5.5, era: '2026' },
    { x: -11.5, y: rampY(-12), z: -12, r: 1.4, path: [[-1.7, 0], [1.7, 0]], period: 5.0, era: '2026' },
    { x: 5.2, y: -16, z: -6, r: 1.5, path: [[0, -5], [0, 5]], period: 9, era: '2026' },
  ]);
  K.finish();
  W.update = (dt, t) => { W.storm.update(t); voidM.uniforms.uTime.value = t; if (W.genLamp.material.emissiveIntensity) W.genLamp.material.emissiveIntensity = 1.8 + Math.sin(t * 2) * 0.3; };
  return W;
}

// =====================================================================================================================
// III · THE EASTWAY (2049 flood / 2026 fill pit)
// =====================================================================================================================
export const roadY = (z) => {
  if (z > 44) return 2.0;
  if (z > 36) return 2.0 * (z - 36) / 8;
  if (z > -98) return 0;
  if (z > -102) return -1.4 * (-98 - z) / 4;
  if (z > -112) return -1.4;
  if (z > -116) return -1.4 + 1.4 * (-112 - z) / 4;
  return Math.min(3.2, (-116 - z) * (3.2 / 24));
};
export const EW_CARS = [   // [x, z, yaw, kind]  the high ground in the flood
  [-9.4, 26, 0.05, 'car'], [3.4, 20, PI, 'car'], [10.6, 14, 0.04, 'van'], [-4.6, 9, PI - 0.06, 'car'], [6.6, 2, 0, 'car'], [-11, -2, PI, 'car'],
  [2.4, -8, 0.05, 'car'], [-6.4, -14, PI, 'van'], [10.8, -16, 0, 'car'], [-9.6, -36, 0.06, 'car'], [3.6, -40, PI, 'car'], [11.2, -34, 0, 'car'],
  [-2.6, -48, PI, 'van'], [9.4, -56, 0, 'car'], [-11.2, -66, PI, 'car'], [3.4, -70, 0, 'car'], [-6, -86, PI, 'car'], [-11.6, -92, 0, 'van'],
];
export function buildEastway(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low', R = rng(1803);
  const K = kit(game, scene, T, 'eastway'), { box, solid, pm, src, add, plane, ground, bat } = K;
  const W = { lightSrc: K.lightSrc, root: K.root, high: [] };
  const M = {
    asphalt: pm('wetAsphalt', { color: 0x2c2e32, puddles: 0.8 }), conc: pm('concrete', { color: 0x7a7872, formwork: 0, stains: 0.9 }), wall: pm('concrete', { color: 0x6a6c6a, formwork: 1, stains: 0.8 }),
    steel: pm('brushedMetal', { color: 0x7a7e80, roughness: 0.5 }), panel: pm('paintedMetalPanel', { color: 0x3a4a5a, cols: 3, rows: 1, wear: 0.5, grime: 0.6, gloss: 0.3 }),
    lorry: pm('paintedMetalPanel', { color: 0xb8b8b0, cols: 10, rows: 1, wear: 0.4, grime: 0.6, gloss: 0.4 }), cabRed: pm('paintedMetalPanel', { color: 0x8a1a1a, cols: 2, rows: 1, wear: 0.3, grime: 0.4, gloss: 0.5 }),
    bus: pm('paintedMetalPanel', { color: 0x1c5a7a, cols: 8, rows: 1, wear: 0.2, grime: 0.4, gloss: 0.5 }), rubber: pm('rubber', { color: 0x1a1a1a }),
    dirt: pm('dirt', { color: 0x6a5440 }), gravel: pm('gravel', { color: 0x8a8274 }), yellow: pm('paintedMetalPanel', { color: 0xd8a420, cols: 2, rows: 1, wear: 0.3, grime: 0.4, gloss: 0.4 }),
    timber: pm('wood', { color: 0x8a6a44, planks: 4 }), brick: pm('brick', { color: 0x6a4a3a }),
  };
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false });
  const cyan = glowMat(0x5fe6ff, 2.4), amber = glowMat(0xffb040, 2.6), white = glowMat(0xe8f0ff, 2.4), red = glowMat(0xff3a2a, 2.2), green = glowMat(0x7aff9a, 2.2);
  W.mats = { cyan, amber, red, green };

  // ---------- the road (2049): embankment, carriageways, dip, off-ramp; sound walls ----------
  const STEP = (z0, z1, y0, y1, n, x0 = -14, x1 = 14, mat = M.asphalt, e = '2049') => {
    for (let i = 0; i < n; i++) { const za = z0 + (z1 - z0) * i / n, zb = z0 + (z1 - z0) * (i + 1) / n, y = y0 + (y1 - y0) * (i + 0.5) / n; solid(mat, x0, y - 0.6, Math.min(za, zb), x1, y, Math.max(za, zb), e); }
  };
  solid(M.asphalt, -14, 1.4, 44, 14, 2.0, 60, '2049'); STEP(44, 36, 2.0, 0, 8);
  solid(M.asphalt, -14, -0.6, -98, 14, 0, 36, '2049'); STEP(-98, -102, 0, -1.4, 4); solid(M.asphalt, -14, -2.0, -112, 14, -1.4, -102, '2049'); STEP(-112, -116, -1.4, 0, 4);
  STEP(-116, -140, 0, 3.2, 14); solid(M.asphalt, -14, 2.6, -152, 14, 3.2, -140, '2049');
  // median (a concrete barrier, high ground) with the lorry gap, and the hard shoulders' kerbs
  for (const [z0, z1] of [[-98, -27.4], [-24.2, 44]]) solid(M.conc, -0.35, 0, z0, 0.35, 1.0, z1, '2049');
  for (const s of [-1, 1]) { solid(M.wall, s * 15.6 - 0.3, -2, -152, s * 15.6 + 0.3, 4.6, -96.4, '2049'); solid(M.wall, s * 15.6 - 0.3, -2, -93.6, s * 15.6 + 0.3, 4.6, 60, '2049'); }
  solid(M.wall, 15.3, -2, -96.4, 15.9, 4.6, -93.6, '2049');                                                // east wall has no door
  for (let z = 56; z > -150; z -= 6) for (const s of [-1, 1]) bat('2049').box(M.steel, s * 15.6 - 0.36, 0, z, s * 15.6 + 0.36, 4.8, z + 0.2);
  try { const st = [-7.5, -3.9, 3.9, 7.5].map(x => ({ x, z: -27, length: 142, width: 0.15, dash: [3, 6] })).concat([-11.2, 11.2].map(x => ({ x, z: -27, length: 142, width: 0.18 })));
    add(RZ.roadPaint({ strips: st, y: 0.022, seed: 183, wear: 0.35 }), '2049'); } catch (e) { void e; }
  // gantries and their signs
  for (const [z, a, b] of [[-6, 'EASTWAY E2', 'HALDEN 4 · HELIX 9'], [-66, 'HELIX 7', 'KEEP LEFT · FLOODING']]) {
    bat('2049').box(M.steel, -15.4, 0, z - 0.2, -15.0, 7.4, z + 0.2); bat('2049').box(M.steel, 15.0, 0, z - 0.2, 15.4, 7.4, z + 0.2); bat('2049').box(M.steel, -15.4, 7.0, z - 0.4, 15.4, 7.6, z + 0.4);
    plane(signTex('g' + z, [[a, 40], [b, 26, '#cfe0e8']], { bg: '#1a3a5a', border: '#e8eef0', h: 200 }), 5.2, 2.0, -6.5, 6.0, z + 0.45, 0, 0.4, '2049');
    plane(signTex('gl' + z, [['↓  ↓', 52, '#e8eef0'], ['FLOOD · 40', 26, '#ffd27a']], { bg: '#101418', border: '#ffd27a', h: 200 }), 2.6, 2.0, 6.5, 6.0, z + 0.45, 0, 0.6, '2049');
  }
  // the rail bridge over the dip
  solid(M.conc, -16, 6.0, -110, 16, 7.4, -104, '2049'); solid(M.conc, -0.8, -1.4, -109, 0.8, 6.0, -105, '2049');
  for (let x = -15; x < 16; x += 2.5) bat('2049').box(M.steel, x, 7.4, -109.8, x + 0.12, 8.6, -109.6);
  plane(signTex('railbr', [['LINE 6 · HALDEN BRANCH', 28], ['HEADROOM 5.1 m', 24, '#ffd27a']], { bg: '#202428', border: '#ffd27a', h: 160 }), 4, 1.2, -7, 5.4, -103.9, 0, 0.25, '2049');
  src(-7, 5.6, -103, 0xffb060, 4, 12, '2049'); src(7, 5.6, -111, 0xffb060, 3, 12, '2049');
  // street lights along the hard shoulders
  try {
    const k = streetKit({ era: '2049', seed: 1803 });
    k.scatter('lamp', [[-14.6, 40], [-14.6, -140]], { spacing: 26, turn: PI / 2, y: 0 }).scatter('lamp', [[14.6, 30], [14.6, -140]], { spacing: 26, turn: -PI / 2, y: 0 });
    add(k.build(), '2049');
  } catch (e) { console.warn('m18 lamps', e); }
  for (let z = 30; z > -140; z -= 26) { src(-12.6, 6, z, 0xffd8a8, 3.4, 15, '2049'); src(12.6, 6, z - 13, 0xffd8a8, 3.4, 15, '2049'); }

  // ---------- cars: high ground (a bonnet you can jump to, a roof you can climb to) ----------
  const carGroup = new THREE.Group(); add(carGroup, '2049');
  const carMat = [0x8a1a1a, 0x1c2a44, 0xd8dde4, 0x202225, 0x5a6066, 0x2a4a3a].map(c => pm('paintedMetalPanel', { color: c, cols: 1, rows: 1, wear: 0.1, grime: 0.3, gloss: 0.7 }));
  for (const [x, z, yaw, kind] of EW_CARS) {
    const van = kind === 'van', L = van ? 5.4 : 4.5, Wd = 1.92, H1 = van ? 1.0 : 0.82, H2 = van ? 2.15 : 1.42, flip = Math.cos(yaw) < 0 ? -1 : 1;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; carGroup.add(g);
    const CB = new Batch(), mat = carMat[Math.floor(R() * carMat.length)];
    CB.box(mat, -Wd / 2, 0.28, -L / 2, Wd / 2, H1, L / 2);
    if (van) CB.box(mat, -Wd / 2 + 0.04, H1, -L / 2 + 1.0, Wd / 2 - 0.04, H2, L / 2);
    else { CB.box(mat, -Wd / 2 + 0.1, H1, -0.9, Wd / 2 - 0.1, H2, 1.2); CB.geo(glass, new THREE.BoxGeometry(Wd - 0.26, 0.5, 0.06), [0, H1 + 0.3, -0.95], [0.5, 0, 0]); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) CB.geo(M.rubber, new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), [sx * (Wd / 2 - 0.08), 0.34, sz * (L / 2 - 0.85)], [0, 0, PI / 2]);
    CB.geo(white, new THREE.BoxGeometry(Wd - 0.3, 0.06, 0.04), [0, H1 - 0.1, -L / 2 - 0.01]); CB.geo(red, new THREE.BoxGeometry(Wd - 0.3, 0.06, 0.04), [0, H1 - 0.1, L / 2 + 0.01]);
    CB.build(g, { name: 'car' });
    // collision (axis aligned; cars sit near 0 / PI)
    box(x - Wd / 2, 0, z - L / 2, x + Wd / 2, H1, z + L / 2, '2049');
    const c0 = van ? (z + flip * (-L / 2 + 1.0)) : (z - flip * 0.9), c1 = van ? z + flip * L / 2 : z + flip * 1.2;
    box(x - Wd / 2 + 0.1, H1, Math.min(c0, c1), x + Wd / 2 - 0.1, H2, Math.max(c0, c1), '2049');
    W.high.push({ x, z, top: H2, bonnet: H1, roofZ: (c0 + c1) / 2, kind });
  }
  // ---------- the jack-knifed lorry: cab, trailer, spilled crates ----------
  const [lx0, lz0, lx1, lz1] = P3.lorry;
  solid(M.lorry, lx0, 0.9, lz0, lx1, 3.9, lz1, '2049'); bat('2049').box(M.steel, lx0, 0.5, lz0 + 0.2, lx1, 0.9, lz1 - 0.2);
  for (let x = lx0 + 1.2; x < lx1; x += 3.2) bat('2049').geo(M.rubber, new THREE.CylinderGeometry(0.5, 0.5, 2.2, 14), [x, 0.5, (lz0 + lz1) / 2], [PI / 2, 0, 0]);
  box(lx0, 0, lz0, lx1, 0.9, lz1, '2049');
  plane(signTex('lorry', [['HALVORSEN FREIGHT', 46, '#1a2a3a'], ['RAIN CITY · KESTREL · PORT 9', 22, '#3a4a5a']], { bg: '#e8e8e0', grain: true, h: 160, w: 1024 }), 9, 1.4, -2, 2.6, lz1 + 0.02, 0, 0.1, '2049');
  solid(M.cabRed, -14, 0.6, -24.5, -10.8, 3.1, -20.4, '2049'); bat('2049').geo(glass, new THREE.BoxGeometry(2.9, 1.0, 0.06), [-12.4, 2.3, -20.38]);
  box(-14, 0, -24.5, -10.8, 0.6, -20.4, '2049');
  for (let i = 0; i < 7; i++) bat('2049').geo(M.timber, new THREE.BoxGeometry(1.1, 0.9, 1.1), [-8 + R() * 18, 0.45, -29 - R() * 3], [0, R() * 3, 0]);
  W.lorryTop = 3.9;
  // ---------- isolator E-7 and the fallen lighting column with its live cable ----------
  solid(M.panel, P3.e7[0] - 0.3, 0, P3.e7[2] - 0.7, P3.e7[0] + 0.5, 1.6, P3.e7[2] + 0.7, '2049');
  plane(signTex('e7', [['RAIN CITY GRID', 22, '#1a1a1a'], ['ISOLATOR E-7', 40, '#1a1a1a'], ['⚡ DANGER 11 kV', 26, '#b01010']], { bg: '#e8d020', border: '#1a1a1a', h: 220 }), 0.9, 0.5, P3.e7[0] - 0.32, 1.25, P3.e7[2], -PI / 2, 0.25, '2049');
  W.e7Lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.12), red.clone()); W.e7Lamp.position.set(P3.e7[0] - 0.33, 0.7, P3.e7[2] + 0.4); add(W.e7Lamp, '2049');
  bat('2049').geo(M.steel, new THREE.CylinderGeometry(0.1, 0.16, 13, 8), [7.6, 0.6, -57.4], [0, 0.2, PI / 2 - 0.06]);
  bat('2049').geo(M.rubber, new THREE.CylinderGeometry(0.03, 0.03, 30, 5), [0, 0.32, -58], [0, 0, PI / 2]);
  const spark = new THREE.Group(); add(spark, '2049'); W.spark = spark;
  const sparkM = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  for (let i = 0; i < 22; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.05 + R() * 0.05, 6, 4), sparkM); s.position.set(-14 + R() * 28, 0.3, P3.cable[2] + (R() - 0.5) * 2); s.userData.ph = R() * 6; spark.add(s); }
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(31, 12), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  halo.rotation.x = -PI / 2; halo.position.set(0, 0.45, P3.cable[2]); spark.add(halo); W.halo = halo;
  src(P3.cable[0], 1.2, P3.cable[2], 0x9fd8ff, 4, 9, '2049');
  // ---------- the night bus ----------
  const [bx, , bz] = P3.bus;
  solid(M.bus, bx - 1.3, 0.35, bz - 6, bx + 1.3, 3.2, bz + 6, '2049'); box(bx - 1.3, 0, bz - 6, bx + 1.3, 0.35, bz + 6, '2049');
  for (let z = bz - 5; z < bz + 5.4; z += 1.4) for (const s of [-1, 1]) bat('2049').geo(glass, new THREE.BoxGeometry(0.06, 0.9, 1.1), [bx + s * 1.31, 2.1, z]);
  bat('2049').geo(cyan, new THREE.BoxGeometry(2.4, 0.05, 0.05), [bx, 3.05, bz - 6.02]);
  plane(signTex('n4', [['N4  HALDEN · NIGHT', 44, '#ffb040']], { bg: '#080808', h: 96, w: 768, grain: false }), 2.0, 0.26, bx, 2.85, bz - 6.03, PI, 1.4, '2049');
  for (let y = 0.5; y < 3.2; y += 0.36) bat('2049').box(M.steel, bx - 0.3, y, bz + 6.0, bx + 0.3, y + 0.04, bz + 6.08);
  src(bx, 2.2, bz, 0xbfe8ff, 3, 8, '2049');
  // ---------- pump station 3 (west, behind the wall) ----------
  solid(M.brick, -22.6, -2, -98.6, -16.0, 0.6, -91.4, '2049');
  solid(M.brick, -22.6, 0.6, -98.6, -22.0, 4.2, -91.4, '2049'); solid(M.brick, -22.6, 0.6, -98.6, -16.0, 4.2, -98.0, '2049'); solid(M.brick, -22.6, 0.6, -92.0, -16.0, 4.2, -91.4, '2049');
  solid(M.brick, -16.6, 0.6, -98.0, -16.0, 4.2, -96.4, '2049'); solid(M.brick, -16.6, 0.6, -93.6, -16.0, 4.2, -92.0, '2049'); solid(M.brick, -16.6, 3.0, -96.4, -16.0, 4.2, -93.6, '2049');
  bat('2049').box(M.conc, -22.8, 4.2, -98.8, -15.8, 4.5, -91.2);
  solid(M.conc, -16.0, 0, -96.4, -15.3, 0.36, -93.6, '2049');                      // the step up through the wall
  bat('2049').box(M.panel, -21.9, 0.6, -96.4, -21.4, 2.4, -93.6);
  W.pumpLamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.14), red.clone()); W.pumpLamp.position.set(-21.38, 2.0, -95); add(W.pumpLamp, '2049');
  plane(signTex('pump3', [['EASTWAY DRAINAGE', 26], ['PUMP STATION 3', 40], ['outfall via culvert C-3', 22, '#ffd27a']], { bg: '#202830', border: '#e8eef0', h: 220 }), 1.2, 0.55, -21.36, 1.7, -95, PI / 2, 0.3, '2049');
  plane(signTex('pump3o', [['PUMP STN 3', 30]], { bg: '#202830', border: '#e8eef0', h: 96 }), 1.4, 0.34, -15.28, 3.4, -95, PI / 2, 0.3, '2049');
  src(-19.5, 3.6, -95, 0xffe0b0, 3, 7, '2049');
  // the culvert grate in the west shoulder (2049)
  W.grate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.6 })); W.grate.rotation.x = -PI / 2; W.grate.position.set(P3.grate[0], 0.02, P3.grate[2]); add(W.grate, '2049');
  W.grateFoam = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: 0xe8eef0, transparent: true, opacity: 0.0, depthWrite: false })); W.grateFoam.rotation.x = -PI / 2; W.grateFoam.position.set(P3.grate[0], 0.05, P3.grate[2]); add(W.grateFoam, '2049');

  // ---------- 2026: the fill pit, its haul strips, culvert C-3 ----------
  ground(M.dirt, -40, -150, 40, 60, -6.0, '2026');
  box(-40, -7, -150, 40, -6, 60, '2026');                                              // the pit floor (a fall: the mission catches it)
  solid(M.gravel, -40, 1.4, 44, 40, 2.0, 60, '2026'); STEP(44, 36, 2.0, 0, 8, -40, 40, M.gravel, '2026');   // the old embankment end exists already
  solid(M.gravel, 6, -0.5, -44, 10, 0, -8, '2026'); solid(M.dirt, 6, -6, -44, 10, -0.5, -8, '2026');         // strip A
  solid(M.gravel, -13, -0.5, -101, -9, 0, -86, '2026'); solid(M.dirt, -13, -6, -101, -9, -0.5, -86, '2026');  // strip B
  solid(M.gravel, -40, 2.6, -152, 40, 3.2, -140, '2026'); STEP(-140, -128, 3.2, 1.6, 6, -40, 40, M.gravel, '2026');
  for (let i = 0; i < 14; i++) bat('2026').geo(M.dirt, new THREE.ConeGeometry(2 + R() * 3, 1.5 + R() * 2.4, 7), [(R() - 0.5) * 70, -6 + 0.8, 30 - R() * 160], [0, R() * 3, 0]);
  for (const [x, z] of [[8, -10], [8, -42], [-11, -87], [-11, -100]]) bat('2026').box(M.yellow, x - 0.04, 0, z - 0.04, x + 0.04, 1.2, z + 0.04);   // survey stakes
  // culvert C-3: a concrete pipe run from the west, its mouth on strip B, the timber formwork still inside
  bat('2026').geo(M.conc, new THREE.CylinderGeometry(1.0, 1.0, 8, 18, 1, true), [-17, -0.4, -99.4], [0, 0, PI / 2]);
  bat('2026').geo(M.conc, new THREE.TorusGeometry(1.0, 0.12, 8, 18), [-13.0, -0.4, -99.4], [0, PI / 2, 0]);
  W.formwork = new THREE.Group(); add(W.formwork, '2026');
  { const FB = new Batch(); for (let i = -2; i <= 2; i++) FB.box(M.timber, -13.1, -1.2 + (i + 2) * 0.36, -100.1, -12.9, -0.88 + (i + 2) * 0.36, -98.7); FB.box(M.timber, -13.0, -1.3, -99.5, -11.6, 0.4, -99.3); FB.build(W.formwork, { name: 'formwork' }); }
  plane(signTex('c3', [['CULVERT C-3', 32, '#1a1a1a'], ['STRIKE FORMWORK BEFORE POUR', 20, '#b01010'], ['pour: Fri 23.10.2026', 20, '#1a1a1a', 500]], { bg: '#e8e0c8', border: '#1a1a1a', h: 200 }), 1.0, 0.5, -10.9, 0.9, -98.4, PI / 2, 0.15, '2026');
  bat('2026').box(M.timber, -11.0, 0, -98.5, -10.9, 1.1, -98.3);
  // an excavator on strip A, a mixer truck by the culvert
  { const ex = bat('2026'); ex.box(M.yellow, 8.7, 0.6, -24, 11.3, 2.2, -20); ex.box(M.rubber, 8.5, 0, -24.4, 11.5, 0.6, -19.6); ex.geo(M.yellow, new THREE.BoxGeometry(0.5, 0.5, 5), [9.9, 3.2, -26], [0.7, 0, 0]); }
  box(8.7, 0, -24, 11.3, 2.2, -20, '2026');
  src(-11, 2.6, -96, 0xfff0d8, 3, 10, '2026'); src(8, 2.6, -26, 0xfff0d8, 3, 10, '2026');
  try { const sk = RZ.skyline({ center: [0, -40], radius: [150, 280], count: low ? 30 : 50, height: [30, 160], lit: 0.85, seed: 185 }); add(sk.mesh || sk, '2049'); } catch (e) { void e; }
  try { const sk = RZ.skyline({ center: [0, -40], radius: [170, 300], count: low ? 16 : 26, height: [20, 70], lit: 0.0, seed: 186 }); add(sk.mesh || sk, '2026'); } catch (e) { void e; }

  // ---------- the flood (2049) ----------
  W.waterBase = 0.3;
  try { const wat = RZ.water({ rect: [-15.6, -118, 31.2, 156], level: W.waterBase, flow: [0.05, -0.5], deep: 0x0e1a1e, shallow: 0x2a3a3a, foam: 0xc8d0d0, heightAt: (x, z) => roadY(z) - 0.02, chop: 1.4, waves: 0.8 }); add(wat.mesh, '2049'); W.water = wat.mesh; } catch (e) { console.warn('m18 flood', e); }
  W.setLevel = (L) => { if (W.water) W.water.position.y = L - W.waterBase; };
  K.finish();
  W.update = (dt, t) => {
    if (W.spark.visible) for (const s of W.spark.children) { if (!s.userData.ph) continue; const k = (Math.sin(t * 9 + s.userData.ph * 3) + 1) / 2; s.scale.setScalar(0.4 + k); s.position.y = (W.level ?? 0.3) + 0.05 + k * 0.25; }
    W.halo.material.opacity = 0.18 + Math.sin(t * 2.4) * 0.06;
  };
  return W;
}

// =====================================================================================================================
// I · LANTERN HALL dressing (on top of env_m14 buildReach): the storm bubble, carts, the tally, items
// =====================================================================================================================
export function dressHall(game, scene, T) {
  const K = kit(game, scene, T, 'hall18'), { box, solid, pm, add, plane, bat } = K, R = rng(1801);
  const W = { lightSrc: K.lightSrc, root: K.root };
  const M = { wood: pm('wood', { color: 0x6a5034, planks: 5 }), rust: pm('rust', { color: 0x5a3018, paint: 0x3d4a52, amount: 0.8 }), canvas: new THREE.MeshStandardMaterial({ color: 0xb8ab90, roughness: 0.95, side: THREE.DoubleSide }), tin: pm('brushedMetal', { color: 0x8a8a7a, roughness: 0.5 }) };
  // handcarts and bundles in the square, where the convoy forms up
  for (const [x, z, a] of [[-3, -60, 0.2], [3.6, -58, -0.3], [8, -62, 0.6], [-9, -57, -0.5]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = a; add(g);
    const C = new Batch(); C.box(M.wood, -0.8, 0.6, -1.3, 0.8, 0.9, 1.3); C.box(M.wood, -0.8, 0.9, -1.3, -0.74, 1.4, 1.3); C.box(M.wood, 0.74, 0.9, -1.3, 0.8, 1.4, 1.3);
    C.geo(M.rust, new THREE.CylinderGeometry(0.5, 0.5, 0.08, 14), [-0.86, 0.5, 0], [0, 0, PI / 2]); C.geo(M.rust, new THREE.CylinderGeometry(0.5, 0.5, 0.08, 14), [0.86, 0.5, 0], [0, 0, PI / 2]);
    for (let i = 0; i < 3; i++) C.geo(M.canvas, new THREE.BoxGeometry(0.5 + R() * 0.3, 0.4, 0.6), [(R() - 0.5) * 0.8, 1.15, (R() - 0.5) * 1.6], [0, R(), 0]);
    C.build(g, { name: 'cart' }); box(x - 1.1, 0, z - 1.4, x + 1.1, 1.4, z + 1.4);
  }
  // the tally board by the gate
  W.tallyMat = new THREE.MeshStandardMaterial({ map: TEX.tally(0, 34), roughness: 0.9, emissive: 0xffffff, emissiveMap: TEX.tally(0, 34), emissiveIntensity: 0.12 });
  const tb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), W.tallyMat); tb.position.set(4.6, 1.8, -78.2); tb.rotation.y = PI; add(tb);
  bat().box(M.wood, 3.7, 0, -78.1, 3.8, 2.4, -78.0); bat().box(M.wood, 5.4, 0, -78.1, 5.5, 2.4, -78.0);
  W.setTally = (n) => { const t = TEX.tally(n, 34); W.tallyMat.map = t; W.tallyMat.emissiveMap = t; W.tallyMat.needsUpdate = true; };
  // Ama's seed tin on the cistern platform
  W.tin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 14), M.tin); W.tin.position.set(P1.tin[0], P1.tin[1] + 0.15, P1.tin[2]); W.tin.userData.noBatch = true; add(W.tin);
  // the stall Lio hides under: a low tarp over a crate stack
  bat().geo(M.canvas, new THREE.BoxGeometry(2.0, 0.04, 1.6), [P1.lio[0] + 0.4, 1.75, P1.lio[2]], [0.2, 0, 0.12]);
  solid(M.wood, P1.lio[0] + 1.0, 1, P1.lio[2] - 0.7, P1.lio[0] + 1.4, 1.7, P1.lio[2] + 0.8);
  for (let i = 0; i < 3; i++) bat().geo(M.canvas, new THREE.BoxGeometry(0.5, 0.4, 0.4), [P1.lio[0] + 0.7, 1.2, P1.lio[2] - 0.5 + i * 0.5], [0, R(), 0]);
  // Joss's log on his bench
  plane(paperTex('josslog', 'BEACON LOG · J. HARROW', ['Yr 30, day 211. Anchor 99. Quiet.', 'Day 290. She answered. A road to', '  Helix SL4, 08:14:00. (the Varen boy)', 'Day 297. Anchor 88. Purple sky N.', 'Day 298. Anchor 71. Hum in the coil', '  like a voice saying a name.', 'Day 298, later. Told Sera: if she', '  goes, take her heart. It holds.'], { hand: true }), 0.4, 0.5, P1.jossLog[0], P1.jossLog[1], P1.jossLog[2], -PI / 2, 0.15).rotation.x = -PI / 2;
  // the storm front, rolling in from the north: a wall of very large radius centred far beyond the hall, so near the
  // hall it reads as a straight front. setFront(z) puts its near face at z (the anchor holds it back)
  W.storm = stormWall({ center: [0, -520], radius: 300, height: 130, y: -8, a: 0x8a5aff, b: 0x4ad8ff, amp: 1.0 }); add(W.storm);
  W.storm2 = stormWall({ center: [0, -520], radius: 290, height: 170, y: -8, a: 0x5a3aaa, b: 0x8a6aff, amp: 0.75 }); add(W.storm2);
  W.shard = shardMesh(); W.shard.position.set(...P1.shard); add(W.shard);
  K.finish();
  W.front = -240;
  W.setFront = (z) => { W.front = z; const r = z + 520; W.storm.scale.set(r, 1, r); W.storm2.scale.set(r - 8, 1, r - 8); };
  W.setFront(-240);
  W.update = (dt, t) => { W.storm.material.uniforms.uTime.value = t; W.storm2.material.uniforms.uTime.value = t * 0.7 + 3; W.shard.rotation.y = t * 1.5; };
  return W;
}

// =====================================================================================================================
// IV · THE CORRAN BUILDING (2196; 2049 below the third floor, 12 s at a time)
// =====================================================================================================================
export const TOWER = {
  L1: { all: [[6, -12, 7.8, 12], [7.8, -12, 11.2, -2.3], [7.8, 3.3, 11.2, 12], [11.2, -12, 12, 12], [-4, -6, 0, 2], [-12, -12, -6, 12]],
    only49: [[-6, -12, -4, 12], [-4, -12, 0, -6], [-4, 2, 0, 12], [0, -12, 6, 12]] },
  L2: { all: [[-12, -12, -11.2, 12], [-11.2, -12, -7.8, -1.5], [-11.2, 4.1, -7.8, 12], [-7.8, -12, 2, 12], [2, -12, 8, -2], [2, 6, 8, 12], [8, -12, 12, 12]], only49: [[2, -2, 8, 6]] },
  L3: [[-4, -12, 4, -9.5], [-12, -12, -4, -9.5], [-12, -9.5, -6, -3], [-12, -3, -6, 2]],
  L4: [[-12, -12, -11.2, 12], [-11.2, -12, -7.8, 1.9], [-11.2, 7.5, -7.8, 12], [-7.8, -12, 12, 12]],
};
export function buildTower(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low', R = rng(1804);
  const K = kit(game, scene, T, 'corran'), { box, solid, pm, src, add, plane, ground, bat, flight } = K;
  const W = { lightSrc: K.lightSrc, root: K.root, sections: [] };
  const M = {
    conc: pm('concrete', { color: 0x8a867e, formwork: 1, stains: 1 }), concD: pm('concrete', { color: 0x5e5a54, formwork: 0, stains: 1 }), moss: pm('moss', { color: 0x4a5a2a }),
    rust: pm('rust', { color: 0x5a3018, paint: 0x3d4a52, amount: 0.9 }), steel: pm('brushedMetal', { color: 0x8a8e90, roughness: 0.4 }),
    carpet: pm('rubber', { color: 0x3a4250 }), tile: pm('ceramicTile', { color: 0xc8c4bc, grout: 0x8a8680, count: 2, gloss: 0.6, variation: 0.2 }),
    desk: pm('wood', { color: 0x9a7a5a, planks: 1 }), panel: pm('paintedMetalPanel', { color: 0xdcdcd8, cols: 2, rows: 1, wear: 0.05, grime: 0.1, gloss: 0.4 }),
    dirt: pm('dirt', { color: 0x4a3e2e }), paving: pm('concrete', { color: 0x76716a, slabs: 1, stains: 0.9 }),
  };
  const glass49 = new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const ceil = glowMat(0xeaf2ff, 1.6), exitG = glowMat(0x3aff8a, 2.2);
  const L = P4.L;
  // ---------- ground: the plaza (south), the gorge (north), the Helix terrace beyond ----------
  ground(M.paving, -60, -14, 60, 60, 0.0); box(-60, -1, -14, 60, 0, 60);
  box(-60, -9, -36, 60, -8, -14);                                                     // the river bed (a fall here is caught by the mission)
  try { const wat = RZ.water({ rect: [-60, -36, 120, 22], level: -6.6, flow: [0.4, 0], deep: 0x1a2a2a, shallow: 0x3a4a3a, heightAt: () => -9 }); add(wat.mesh); } catch (e) { void e; }
  solid(M.concD, -60, -9, -15, 60, 0, -14);                                         // the embankment wall
  solid(M.concD, -30, -9, -60, 30, 12, -36);                                        // the Helix terrace (top 12)
  for (let x = -28; x < 29; x += 4) bat().box(M.rust, x, 12, -36.2, x + 0.12, 13.1, -36.0);
  bat().box(M.rust, -30, 12.95, -36.2, 30, 13.1, -36.0); box(-30, 12, -36.4, -1.2, 13.1, -36.0); box(1.2, 12, -36.4, 30, 13.1, -36.0);
  plane(signTex('helixterr', [['HELIX TEMPORAL RESEARCH', 40, '#cfe8f0'], ['TEST HALL C · EAST TERRACE', 24, '#8ab0c0']], { bg: '#20282c', border: '#5fe6ff', h: 200, wear: 0.8 }), 6, 2, 0, 8, -35.9, 0, 0.12);
  // ---------- the tower: columns, slabs, stairs ----------
  const cols = [-12, -6, 0, 6, 12];
  for (const x of cols) for (const z of cols) { if (x === 0 && (z === -6 || z === -12)) continue; const t = Math.abs(x) === 12 || Math.abs(z) === 12 ? 0.35 : 0.3; solid(M.conc, x - t, 0, z - t, x + t, 18, z + t); }
  const slab = (rects, y, e, mat = M.conc) => rects.forEach(([x0, z0, x1, z1]) => solid(mat, x0, y - 0.4, z0, x1, y, z1, e));
  ground(M.tile, -12, -12, 12, 12, 0.01); box(-12, -0.5, -12, 12, 0, 12);
  slab(TOWER.L1.all, L[1]); slab(TOWER.L1.only49, L[1], '2049', M.carpet);
  slab(TOWER.L2.all, L[2]); slab(TOWER.L2.only49, L[2], '2049', M.carpet);
  for (const [x0, z0, x1, z1] of [[-12, -12, 7.8, 12], [11.2, -12, 12, 12]]) bat('2049').box(M.carpet, x0, L[1] + 0.01, z0, x1, L[1] + 0.02, z1);
  slab(TOWER.L4, L[4]);
  // L3: the floor that will go (one mesh and one collider per section)
  TOWER.L3.forEach(([x0, z0, x1, z1], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.4, z1 - z0), M.conc); m.position.set((x0 + x1) / 2, L[3] - 0.2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; m.userData.noBatch = true; add(m);
    const b = box(x0, L[3] - 0.4, z0, x1, L[3], z1); W.sections.push({ m, b, y0: m.position.y, i });
  });
  // broken beams where the rest of L3 was
  for (let i = 0; i < 6; i++) bat().geo(M.conc, new THREE.BoxGeometry(0.5, 0.6, 6), [-4 + i * 3, L[3] - 0.3, 3 + R() * 6], [R() * 0.3, 0, R() * 0.3]);
  // stairs (rise 0.375 x 12 = 4.5, run 0.45)
  flight(M.concD, 8, 11, 3.2, -1, L[0], 12, 0.375, 0.45);           // E: lobby -> 1
  flight(M.concD, -11, -8, -1.4, 1, L[1], 12, 0.375, 0.45);         // W: 1 -> 2
  flight(M.panel, -2, 2, -4, -1, L[2], 12, 0.375, 0.45, '2049');     // N: 2 -> 3 (only the 2049 flight is still there)
  for (let i = 0; i < 5; i++) bat('2196').geo(M.concD, new THREE.BoxGeometry(3.4 + R(), 0.5, 1.2), [(R() - 0.5) * 2, L[2] + 0.25, -5 - R() * 4], [R() * 0.4, R(), R() * 0.4]);
  flight(M.concD, -11, -8, 2, 1, L[3], 12, 0.375, 0.45);            // roof stair: 3 -> roof
  // 2049 partitions on L1: the glass wall of the meeting suite and the alarmed fire door
  box(-2.05, L[1], -12, -1.95, L[1] + 3.2, 12, '2049'); bat('2049').geo(glass49, new THREE.BoxGeometry(0.04, 3.0, 24), [-2, L[1] + 1.5, 0]);
  for (let z = -12; z <= 12; z += 2) bat('2049').box(M.steel, -2.04, L[1], z - 0.03, -1.96, L[1] + 3.0, z + 0.03);
  plane(signTex('suite', [['CORRAN & VEY', 30, '#1a2a3a'], ['BOARD SUITE · BOOKED', 20, '#3a4a5a']], { bg: '#e8eaec', h: 128, grain: false }), 1.2, 0.32, -1.93, L[1] + 2.2, -3, PI / 2, 0.2, '2049');
  box(-11.2, L[1], -2.65, -7.8, L[1] + 3.0, -2.3, '2049'); bat('2049').box(M.panel, -11.2, L[1], -2.6, -7.8, L[1] + 2.9, -2.35);
  plane(signTex('fire', [['FIRE EXIT', 34, '#e8fff0'], ['ALARMED · STORM LOCKDOWN', 20, '#ffd27a']], { bg: '#0a6a3a', h: 128 }), 1.6, 0.5, -9.5, L[1] + 2.4, -2.66, PI, 0.6, '2049');
  // 2049: curtain wall, desks, ceiling panels on the lobby, 1 and 2
  for (const y of [L[0], L[1], L[2]]) {
    for (const s of [-1, 1]) { bat('2049').geo(glass49, new THREE.BoxGeometry(24, 4.0, 0.04), [0, y + 2.1, s * 12.1]); bat('2049').geo(glass49, new THREE.BoxGeometry(0.04, 4.0, 24), [s * 12.1, y + 2.1, 0]); }
    for (let x = -10; x <= 10; x += 4) for (let z = -10; z <= 10; z += 4) if (y > 0) bat('2049').geo(ceil, new THREE.BoxGeometry(1.2, 0.04, 0.6), [x, y + 4.04, z]);
  }
  for (const [x, z] of [[2, -8], [4.4, -8], [2, 8], [4.4, 8], [-8.8, 8], [-8.8, 10.4], [9, 8], [9, -8]]) { bat('2049').box(M.desk, x - 0.8, L[1] + 0.72, z - 0.4, x + 0.8, L[1] + 0.76, z + 0.4); bat('2049').box(M.steel, x - 0.75, L[1], z - 0.35, x - 0.7, L[1] + 0.72, z + 0.35); bat('2049').box(M.steel, x + 0.7, L[1], z - 0.35, x + 0.75, L[1] + 0.72, z + 0.35); }
  for (const [x, z] of [[-6, -9], [-3.6, -9], [-6, 9], [4, 9], [8, -9]]) { bat('2049').box(M.desk, x - 0.8, L[2] + 0.72, z - 0.4, x + 0.8, L[2] + 0.76, z + 0.4); }
  plane(signTex('l1', [['1', 120, '#e8eef0']], { bg: '#20282c', h: 200, w: 200 }), 0.6, 0.6, 11.4, L[1] + 1.8, -2.4, PI, 0.25);
  plane(signTex('l2', [['2', 120, '#e8eef0']], { bg: '#20282c', h: 200, w: 200 }), 0.6, 0.6, -7.6, L[2] + 1.8, 4.3, -PI / 2, 0.25);
  plane(signTex('l3', [['3', 120, '#e8eef0']], { bg: '#20282c', h: 200, w: 200 }), 0.6, 0.6, 2.2, L[3] + 1.8, -9.6, PI / 2, 0.25);
  plane(signTex('corrandir', [['THE CORRAN BUILDING', 30], ['CORRAN & VEY LOGISTICS', 22, '#8ab0c0'], ['1 · 2 BOARD SUITE · 3-40 OFFICES', 18, '#cfe0e8', 500]], { bg: '#1c2428', border: '#cfe0e8', h: 200, wear: 0.6 }), 1.6, 0.8, 4, 1.8, 11.6, 0, 0.15);
  // the façade: precast spandrel bands at every floor edge (broken in places in 2196), mullions, window frames; the
  // stump of the fallen upper floors above the roof
  for (const y of [L[1], L[2], L[3], L[4]]) for (let i = -12; i < 12; i += 3) {
    for (const [x0, z0, x1, z1] of [[i, -12.35, i + 3, -12.0], [i, 12.0, i + 3, 12.35], [12.0, i, 12.35, i + 3], [-12.35, i, -12.0, i + 3]]) {
      const broken = R() < (y === L[3] ? 0.55 : 0.22);
      bat(broken ? '2049' : 'all').box(M.conc, x0, y - 0.9, z0, x1, y + 0.5, z1);
      if (y < L[4]) for (let k = 0; k < 2; k++) { const m = R() < 0.35 ? '2049' : 'all'; if (x1 - x0 > 1) bat(m).box(M.steel, x0 + k * 1.5 - 0.04, y + 0.5, z0, x0 + k * 1.5 + 0.04, y + 3.6, z1); else bat(m).box(M.steel, x0, y + 0.5, z0 + k * 1.5 - 0.04, x1, y + 3.6, z0 + k * 1.5 + 0.04); }
    }
  }
  for (const [x, z] of [[-12, -12], [-6, -12], [6, -12], [12, -12], [-12, -6], [12, -6], [-12, 0], [12, 0]]) { const hgtS = 1.5 + R() * 4; bat('2196').box(M.conc, x - 0.3, L[4], z - 0.3, x + 0.3, L[4] + hgtS, z + 0.3); }
  bat('2196').geo(M.concD, new THREE.BoxGeometry(14, 0.4, 9), [-4, L[4] + 3.2, -8], [0.1, 0.2, -0.35]);
  try { add(new THREE.Mesh(RZ.rebar({ origin: [-6, L[4] + 3, -10], dir: [0, 1, 0.2], count: 18, length: 1.6, spread: 8, seed: 41 }), M.rust), '2196'); } catch (e) { void e; }
  for (let i = 0; i < 18; i++) bat('2196').geo(R() < 0.5 ? M.concD : M.moss, new THREE.DodecahedronGeometry(0.4 + R() * 0.7, 0), [(R() - 0.5) * 22, L[Math.floor(R() * 3)] + 0.2, (R() - 0.5) * 22], [R(), R(), R()]);
  bat('2196').geo(exitG, new THREE.BoxGeometry(0.5, 0.2, 0.04), [-9.5, L[1] + 2.6, -2.4]);
  // the roof: parapet, plant, the boom over the gorge
  for (const [x0, z0, x1, z1] of [[-12, 11.6, 12, 12], [-12, -12, -11.6, 12], [11.6, -12, 12, 12], [-12, -12, -1.0, -11.6], [1.0, -12, 12, -11.6]]) solid(M.concD, x0, L[4], z0, x1, L[4] + 1.0, z1);
  const crown = new THREE.Group(); add(crown); W.crown = crown;
  { const C = new Batch(); C.box(M.rust, 4, L[4], 2, 9, L[4] + 2.4, 7); C.cyl(M.rust, 8, L[4] + 3.4, -6, 1.6, 4, 16); C.box(M.steel, -6, L[4], -8, -2, L[4] + 1.6, -4); C.build(crown, { name: 'crown' }); }
  box(4, L[4], 2, 9, L[4] + 2.4, 7); box(6.4, L[4], -7.6, 9.6, L[4] + 5.4, -4.4); box(-6, L[4], -8, -2, L[4] + 1.6, -4);
  // the boom: a fallen tower-crane jib from the roof's north edge down onto the Helix terrace
  for (let i = 0; i < 24; i++) { const za = -12 - i, zb = za - 1, y = L[4] - (i + 1) * 0.25; box(-0.8, y - 0.4, zb, 0.8, y, za); box(-1.0, y, zb, -0.8, y + 1.0, za); box(0.8, y, zb, 1.0, y + 1.0, za); }
  bat().geo(M.rust, new THREE.BoxGeometry(1.6, 0.3, 24.8), [0, (L[4] + 12) / 2 - 0.2, -24], [Math.atan2(6, 24), 0, 0]);
  for (const s of [-1, 1]) bat().geo(M.rust, new THREE.BoxGeometry(0.1, 0.1, 24.8), [s * 0.9, (L[4] + 12) / 2 + 0.8, -24], [Math.atan2(6, 24), 0, 0]);
  for (let i = 0; i < 12; i++) { const z = -13 - i * 2, y = L[4] - (i * 2 + 1) * 0.25; for (const s of [-1, 1]) bat().box(M.rust, s * 0.9 - 0.04, y, z - 0.04, s * 0.9 + 0.04, y + 0.95, z + 0.04); bat().geo(M.rust, new THREE.BoxGeometry(1.7, 0.06, 0.06), [0, y - 0.5, z], [0, 0, 0]); }
  // L2 extras: Corran's shipping memo on a desk, a shard
  plane(paperTex('corranmemo', 'CORRAN & VEY · MANIFEST 31/07', ['Consignor: Helix Temporal Research', 'Item: "Artefact A" (ring, 1 unit)', 'From: Site Zero, sub-level 6', 'To: Helix main laboratory', 'Route: Eastway via Varrow fill', 'Escort: E. Rook in person', 'Note: do not open, do not log.']), 0.42, 0.52, P4.memo[0], P4.memo[1] + 0.78, P4.memo[2], 0, 0.15).rotation.x = -PI / 2;
  bat().box(M.desk, P4.memo[0] - 0.8, L[2] + 0.72, P4.memo[2] - 0.4, P4.memo[0] + 0.8, L[2] + 0.76, P4.memo[2] + 0.4); box(P4.memo[0] - 0.8, L[2], P4.memo[2] - 0.4, P4.memo[0] + 0.8, L[2] + 0.76, P4.memo[2] + 0.4);
  W.shard = shardMesh(); W.shard.position.set(...P4.shard); add(W.shard);
  // ---------- the city around: ruined towers, skyline, trees on the plaza ----------
  try {
    const list = [
      { width: 26, depth: 20, height: 46, position: [-38, 0, 14], yaw: PI / 2, seed: 1841, wall: 'concrete', ruin: 0.8, moss: 0.7, collapse: true },
      { width: 22, depth: 24, height: 62, position: [36, 0, 18], yaw: -PI / 2, seed: 1842, wall: 'panel', ruin: 0.7, moss: 0.5 },
      { width: 30, depth: 16, height: 30, position: [0, 0, 54], yaw: PI, seed: 1843, wall: 'brick', ruin: 0.6, moss: 0.6, collapse: true },
      { width: 20, depth: 18, height: 38, position: [-40, 12, -50], yaw: 0, seed: 1844, wall: 'darkBrick', ruin: 0.8, moss: 0.5 },
      { width: 24, depth: 20, height: 52, position: [40, 12, -50], yaw: 0, seed: 1845, wall: 'concrete', ruin: 0.75, moss: 0.6, collapse: true },
    ];
    for (const b of list) box(b.position[0] - (b.yaw ? b.depth : b.width) / 2, b.position[1], b.position[2] - (b.yaw ? b.width : b.depth) / 2, b.position[0] + (b.yaw ? b.depth : b.width) / 2, b.position[1] + b.height, b.position[2] + (b.yaw ? b.width : b.depth) / 2);
    const blk = RZ.cityBlock(list.map(b => ({ ...b, era: '2196', groundFloor: 4.4, faces: ['windows', 'windows', 'windows', 'windows'] })), { era: '2196', lit: 0.0, daylight: 0.4, detail: low ? 'low' : undefined }); add(blk.mesh);
    const sk = RZ.skyline({ center: [0, 0], radius: [160, 300], count: low ? 30 : 48, height: [30, 150], lit: 0.0, seed: 1846 }); add(sk.mesh || sk);
  } catch (e) { console.warn('m18 city', e); }
  try { add(RZ.forest({ species: 'broadleaf', placements: [{ x: -18, z: 24, scale: 1.0 }, { x: 20, z: 30, scale: 0.9 }, { x: -24, z: 4, scale: 0.8 }, { x: 22, z: 2, scale: 1.1 }, { x: 8, z: 22 + R() * 4, scale: 0.7 }], heightAt: () => 0, impostors: false, variants: 2, seed: 184 })); } catch (e) { void e; }
  try { const iv = RZ.ivy({ edges: [[[-12.3, L[2], -12], [-12.3, L[2], 12], [-1, 0, 0]], [[12.3, L[1], -12], [12.3, L[1], 12], [1, 0, 0]], [[-12, L[4], 12.3], [12, L[4], 12.3], [0, 0, 1]]], length: [1.2, 4.5], density: low ? 1.2 : 2, seed: 184 }); add(iv.mesh || iv); } catch (e) { void e; }
  try { const k = streetKit({ era: '2196', seed: 1804 }); k.car([-16, 0, 36, 0.4], 0.4).car([18, 0, 40, 2.1], 2.1).van([-8, 0, 46, -0.6], -0.6); k.overgrowth({ area: [-40, 14, 40, 60] }, { density: 0.7, cracks: 0.8 }); add(k.build()); for (const c of k.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2]); } catch (e) { void e; }
  src(9.5, L[1] + 3, -2, 0xffc890, 3, 9); src(-9.5, L[2] + 3, 2, 0xffc890, 3, 9); src(0, L[3] + 2, -8, 0xffb080, 3, 10); src(0, L[2] + 3.4, 0, 0xeaf2ff, 4, 14, '2049'); src(4, L[1] + 3.4, 0, 0xeaf2ff, 4, 14, '2049');
  W.storm = stormCells(scene, T, [
    { x: -3, y: L[2], z: 6, r: 1.5, path: [[-3, 0], [3, 0]], period: 7, era: '2196' },
    { x: 4, y: L[2], z: -8, r: 1.4, path: [[0, -2.5], [0, 2.5]], period: 6, era: '2196' },
  ]);
  W.sky = stormWall({ center: [0, 0], radius: 260, height: 220, y: -20, a: 0x6a3aff, b: 0xff7a4a, amp: 0.8 }); add(W.sky);
  K.finish();
  W.resetSections = () => { for (const s of W.sections) { s.m.position.y = s.y0; s.m.rotation.set(0, 0, 0); s.m.visible = true; s.b.enabled = true; s.fall = 0; } };
  W.update = (dt, t) => {
    W.storm.update(t); W.sky.material.uniforms.uTime.value = t; W.shard.rotation.y = t * 1.5;
    for (const s of W.sections) if (s.fall > 0) { s.fall += dt; s.m.position.y = s.y0 - s.fall * s.fall * 4.9; s.m.rotation.x = s.fall * 0.3; s.m.rotation.z = s.fall * 0.2 * (s.i % 2 ? 1 : -1); if (s.fall > 3) s.m.visible = false; }
  };
  return W;
}

// =====================================================================================================================
// V · HELIX TEST HALL C (2196 ruin / 2049 lab)
// =====================================================================================================================
export const HALL_COVER = [[-8, 4, 2.0, 1.2, 1.6], [8, -2, 2.2, 1.1, 1.4], [-12, -12, 1.6, 1.6, 1.4], [12, 10, 2.4, 1.2, 1.2], [0, -19, 3.0, 1.2, 1.3], [-16, 8, 4.2, 1.0, 1.1], [16, -8, 1.2, 4.0, 1.1], [-5, 14, 1.6, 1.0, 1.1], [6, 15, 1.4, 1.4, 1.2]];
export function buildHallC(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low', R = rng(1805);
  const K = kit(game, scene, T, 'hallc'), { box, solid, pm, src, add, plane, ground, bat, flight } = K;
  const W = { lightSrc: K.lightSrc, root: K.root };
  const M = {
    floor: pm('concrete', { color: 0x6a6862, slabs: 1, stains: 1 }), wall: pm('concrete', { color: 0x7a766e, formwork: 1, stains: 1 }), moss: pm('moss', { color: 0x4a5a2a }),
    rust: pm('rust', { color: 0x5a3018, paint: 0x3d4a52, amount: 0.85 }), steel: pm('brushedMetal', { color: 0x9a9ea0, roughness: 0.35 }),
    lab: pm('ceramicTile', { color: 0xe4e6e8, grout: 0xb8bcc0, count: 1, gloss: 0.7, variation: 0.08 }), labWall: pm('paintedMetalPanel', { color: 0xe8eaec, cols: 4, rows: 2, wear: 0.02, grime: 0.05, gloss: 0.5 }),
    crate: pm('paintedMetalPanel', { color: 0x4a5a4a, cols: 2, rows: 1, wear: 0.7, grime: 0.7, gloss: 0.2 }), cont: pm('paintedMetalPanel', { color: 0xe6e8ea, cols: 2, rows: 1, wear: 0.1, grime: 0.2, gloss: 0.6 }),
  };
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const gold = glowMat(0xffd27a, 2.4), cyan = glowMat(0x5fe6ff, 2.2), labL = glowMat(0xf2f6ff, 1.8);
  W.mats = { gold, cyan };
  ground(M.floor, -26, -26, 26, 26, 0.01, '2196'); ground(M.lab, -26, -26, 26, 26, 0.012, '2049'); box(-40, -1, -40, 40, 0, 40);
  // walls: breaches in 2196 (west, east, north), closed doors in 2049
  const wallSeg = (x0, z0, x1, z1, h, e) => solid(e === '2049' ? M.labWall : M.wall, x0, 0, z0, x1, h, z1, e);
  for (const e of ['2196', '2049']) {
    const h = e === '2049' ? 12 : 8.5;
    wallSeg(-26.6, -26.6, -26, -6, h, e); wallSeg(-26.6, -1, -26, 26.6, h, e);
    wallSeg(26, -26.6, 26.6, 0, h, e); wallSeg(26, 5, 26.6, 26.6, h, e);
    wallSeg(-26.6, -26.6, -2.5, -26, h, e); wallSeg(2.5, -26.6, 26.6, -26, h, e);
    wallSeg(-26.6, 26, 26.6, 26.6, h, e);
  }
  solid(M.labWall, -26.6, 0, -6, -26, 12, -1, '2049'); solid(M.labWall, 26, 0, 0, 26.6, 12, 5, '2049'); solid(M.labWall, -2.5, 0, -26.6, 2.5, 12, -26, '2049');
  for (let i = 0; i < 16; i++) bat('2196').geo(R() < 0.6 ? M.wall : M.moss, new THREE.DodecahedronGeometry(0.6 + R() * 1.0, 0), [(R() < 0.5 ? -1 : 1) * (22 + R() * 4), 0.4, (R() - 0.5) * 50], [R(), R(), R()]);
  for (let i = 0; i < 10; i++) bat('2196').geo(M.wall, new THREE.DodecahedronGeometry(0.5 + R() * 0.8, 0), [(R() - 0.5) * 50, 0.4, -22 - R() * 4], [R(), R(), R()]);
  // the gallery (south) and its stair
  solid(M.wall, -22, 5.6, 26, 22, 6, 34); box(-24, 0, 26, 24, 5.6, 34); box(-24, 6, 34, 24, 8, 34.4); box(-24, 6, 26, -22, 8, 34); box(22, 6, 26, 24, 8, 34);
  for (const [x0, x1] of [[-22, -2.2], [2.2, 22]]) { solid(M.steel, x0, 6, 25.8, x1, 7.05, 26.0); bat('2049').geo(glass, new THREE.BoxGeometry(x1 - x0, 3.0, 0.05), [(x0 + x1) / 2, 8.6, 25.9]); }
  flight(M.wall, -2, 2, 20, 1, 0, 16, 0.375, 0.375);
  for (const s of [-1, 1]) solid(M.steel, s * 2.0 - 0.05, 0, 20, s * 2.0 + 0.05, 1.0, 26);
  // the Chronolith: a cracked ring in its cradle
  const ring = chronolith(1.35, { color: 0x9a7bff, power: 0.15 }); ring.position.set(...P5.ring); add(ring); W.ring = ring;
  solid(M.steel, -3.8, 0, -11.2, -2.8, 1.6, -8.8); solid(M.steel, 2.8, 0, -11.2, 3.8, 1.6, -8.8); bat().box(M.wall, -4.4, 0, -12, 4.4, 0.4, -8);
  box(-4.4, 0, -12, 4.4, 0.4, -8);
  W.cracks = []; for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5 + R() * 0.4, 0.62), new THREE.MeshBasicMaterial({ color: 0x000000 })); const a = R() * PI * 2; c.position.set(P5.ring[0] + Math.cos(a) * 3.24, P5.ring[1] + Math.sin(a) * 3.24, P5.ring[2]); c.rotation.z = a; c.userData.noBatch = true; add(c); W.cracks.push(c); }
  const tools = new Batch(); tools.box(M.crate, -3.2, 0, -6.4, -1.8, 0.7, -5.6); tools.box(M.steel, -3.0, 0.7, -6.2, -2.2, 0.8, -5.8); tools.build(K.root, { name: 'tools' });
  // the stabilizer spire and its field
  const [sx, , sz] = P5.spire;
  bat().cyl(M.cont, sx, 0.5, sz, 1.4, 1.0, 20); bat().cyl(M.steel, sx, 3.8, sz, 0.42, 6.6, 16); box(sx - 1.4, 0, sz - 1.4, sx + 1.4, 7, sz + 1.4);
  W.vanes = []; for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 1.0), M.cont); const a = i * PI * 2 / 3; v.position.set(sx + Math.cos(a) * 0.7, 4.6, sz + Math.sin(a) * 0.7); v.rotation.y = -a; v.userData.noBatch = true; add(v); W.vanes.push(v); }
  W.core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), gold.clone()); W.core.position.set(sx, 7.4, sz); W.core.userData.noBatch = true; add(W.core);
  W.field = new THREE.Mesh(new THREE.SphereGeometry(15, 40, 20, 0, PI * 2, 0, PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  W.field.position.set(sx, 0, sz); W.field.userData.noBatch = true; add(W.field, '2196');
  plane(signTex('stab', [['CONTINUUM FIELD STABILIZER', 24, '#ffd27a'], ['UNIT 4 · SEIZED', 20, '#e8eef0']], { bg: '#202328', border: '#ffd27a', h: 128 }), 1.6, 0.4, sx, 1.4, sz + 1.42, 0, 0.5, '2196');
  // cover: crates, fallen columns (2196) and lab benches (2049)
  for (const [x, z, w, d, h] of HALL_COVER) { solid(M.crate, x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, '2196'); }
  for (const [x, z] of [[-10, -4], [10, 4], [-14, 16], [14, -16]]) { bat('2049').box(M.labWall, x - 1.6, 0, z - 0.5, x + 1.6, 0.92, z + 0.5); bat('2049').box(M.steel, x - 1.6, 0.92, z - 0.5, x + 1.6, 0.96, z + 0.5); box(x - 1.6, 0, z - 0.5, x + 1.6, 0.96, z + 0.5, '2049'); }
  for (let x = -20; x <= 20; x += 8) for (let z = -20; z <= 20; z += 8) bat('2049').geo(labL, new THREE.BoxGeometry(2.4, 0.06, 0.4), [x, 11.8, z]);
  // the 2049 ring console and Rook's run log, the 2196 shard on the gallery
  solid(M.labWall, P5.console49[0] - 0.7, 0, P5.console49[2] - 0.4, P5.console49[0] + 0.7, 1.0, P5.console49[2] + 0.4, '2049');
  W.consoleScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), cyan.clone()); W.consoleScreen.position.set(P5.console49[0], 1.25, P5.console49[2] + 0.2); W.consoleScreen.rotation.x = -0.6; add(W.consoleScreen, '2049');
  plane(signTex('collar', [['RING COLLAR · C', 30, '#0a2a3a'], ['phase lock: manual', 20, '#2a4a5a']], { bg: '#e8f4f8', h: 128, grain: false }), 1.0, 0.3, P5.console49[0], 0.7, P5.console49[2] + 0.41, 0, 0.3, '2049');
  plane(paperTex('tchlog', 'TEST HALL C · RUN SHEET', ['19.10.2049 · 08:13:58 · ring at 4.1 kHz', '08:14:00 · ZERO SECOND (see incident)', 'Collar C slipped half a phase at', '08:14:00.2. Reseat by hand from', 'this console if it slips again.', '', 'Operator on shift: K. VAREN']), 0.5, 0.62, P5.log49[0], 1.0, P5.log49[2], 0.4, 0.2, '2049');
  bat('2049').box(M.labWall, P5.log49[0] - 0.6, 0, P5.log49[2] - 0.3, P5.log49[0] + 0.6, 0.85, P5.log49[2] + 0.3); box(P5.log49[0] - 0.6, 0, P5.log49[2] - 0.3, P5.log49[0] + 0.6, 0.85, P5.log49[2] + 0.3, '2049');
  W.shard = shardMesh(); W.shard.position.set(...P5.shard); add(W.shard, '2196');
  // the sky through the broken roof, the Array on the hill to the north (its light pulses when the ring wakes)
  const mast = new THREE.Group(); mast.position.set(-60, 0, -220); add(mast, '2196'); W.farMast = mast;
  { const MB = new Batch(); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) MB.geo(M.rust, new THREE.BoxGeometry(0.8, 90, 0.8), [dx * 4, 45, dz * 4], [dz * 0.04, 0, -dx * 0.04]); MB.build(mast, { name: 'farmast' }); }
  W.farLight = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 8), glowMat(0x9a7bff, 0.6)); W.farLight.position.set(0, 92, 0); mast.add(W.farLight);
  try { const sk = RZ.skyline({ center: [0, 0], radius: [120, 260], count: low ? 24 : 40, height: [30, 120], lit: 0.0, seed: 1851 }); add(sk.mesh || sk, '2196'); } catch (e) { void e; }
  try { const iv = RZ.ivy({ edges: [[[-26, 8.5, -26], [-26, 8.5, 26], [1, 0, 0]], [[26, 8.5, -26], [26, 8.5, 26], [-1, 0, 0]], [[-26, 8.5, -26], [26, 8.5, -26], [0, 0, 1]]], length: [1.5, 5], density: low ? 1.2 : 2, seed: 185 }); add(iv.mesh || iv, '2196'); } catch (e) { void e; }
  src(0, 5, -7, 0x9a7bff, 5, 14); src(sx, 7, sz, 0xffd27a, 5, 14, '2196'); src(-14, 6, 12, 0xffc890, 3, 12, '2196'); src(14, 6, -12, 0xffc890, 3, 12, '2196'); src(0, 10, 0, 0xf2f6ff, 6, 30, '2049');
  W.sky = stormWall({ center: [0, 0], radius: 200, height: 200, y: -20, a: 0x6a3aff, b: 0x5fe6ff, amp: 0.7 }); add(W.sky, '2196');
  K.finish();
  W.update = (dt, t) => {
    ring.userData.update?.(t); W.sky.material.uniforms.uTime.value = t; W.shard.rotation.y = t * 1.5;
    W.vanes.forEach((v, i) => { v.rotation.y += dt * (0.4 + (W.spin || 0)); const a = t * (0.4 + (W.spin || 0)) + i * PI * 2 / 3; v.position.x = sx + Math.cos(a) * 0.7; v.position.z = sz + Math.sin(a) * 0.7; });
    W.core.material.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.4;
  };
  return W;
}

// =====================================================================================================================
// VI · THE LONG ARRAY (2196 / 2049)
// =====================================================================================================================
export function buildArray(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low', R = rng(1806);
  const K = kit(game, scene, T, 'array'), { box, solid, pm, src, add, plane, bat } = K;
  const W = { lightSrc: K.lightSrc, root: K.root, horns: [] };
  const M = {
    rust: pm('rust', { color: 0x5a3018, paint: 0x6a6e70, amount: 0.75 }), steel49: pm('brushedMetal', { color: 0xc8ccd0, roughness: 0.3 }), grate: pm('paintedMetalPanel', { color: 0x4a4e50, cols: 6, rows: 6, wear: 0.6, grime: 0.7, gloss: 0.2 }),
    conc: pm('concrete', { color: 0x7a766e, formwork: 1, stains: 0.9 }), panel: pm('paintedMetalPanel', { color: 0xe8eaec, cols: 3, rows: 1, wear: 0.1, grime: 0.2, gloss: 0.5 }), fence: pm('brushedMetal', { color: 0x6a6e70, roughness: 0.6 }),
  };
  const violet = glowMat(0x9a7bff, 2.4), white = glowMat(0xf2f6ff, 2.0), red = glowMat(0xff4030, 2.4);
  // the hill: a plateau carved into a terrain that falls away on every side
  const hgt = (x, z) => { const dx = Math.max(0, Math.abs(x) - 50), dz = Math.max(0, z - 90, -30 - z), d = Math.hypot(dx, dz), n = RZ.noise.fbm2(x * 0.05, z * 0.05, 4); return d > 0 ? -Math.min(60, d * 0.7) + n * 3 : -0.04 + n * 0.2; };
  try { const ter = RZ.terrain({ size: 260, sizeZ: 260, center: [0, 30], heightFn: hgt, segments: low ? 110 : 160, rockSlope: 0.45, dirt: 0.4, layers: [['grass', { color: 0x4a5a2a }], ['dirt', { color: 0x5a4a38 }], ['rock', { color: 0x6a645a }], ['sand', { color: 0x8a7a62 }]] }); add(ter.mesh); } catch (e) { console.warn('m18 hill', e); }
  box(-50, -1, -30, 50, 0, 90); box(-51, 0, -31, -50, 3, 91); box(50, 0, -31, 51, 3, 91); box(-51, 0, 90, 51, 3, 91); box(-51, 0, -31, 51, 3, -30);
  try { add(RZ.rocks({ placements: Array.from({ length: 22 }, () => ({ x: (R() - 0.5) * 90, z: -20 + R() * 100, scale: 0.6 + R() * 1.6 })).filter(p => Math.hypot(p.x, p.z) > 9 && !(Math.abs(p.x) < 3 && p.z > 6)), seed: 186, moss: 0.4 })); } catch (e) { void e; }
  try { const gr = RZ.instancedGrass({ heightAt: () => 0, mask: (x, z) => (Math.hypot(x, z) < 7 ? 0 : 0.9), rect: [-50, -30, 100, 120], radius: 24, height: 0.6, color: 0x5a6a30, tipColor: 0xb8a870, seed: 187 }); add(gr.mesh, '2196'); } catch (e) { void e; }
  // the 2049 campus: fence, security booth, lit path (2049); its ruin (2196)
  for (let z = -20; z < 80; z += 3) for (const s of [-1, 1]) bat('2049').box(M.fence, s * 24 - 0.04, 0, z, s * 24 + 0.04, 2.4, z + 0.06);
  for (const s of [-1, 1]) bat('2049').box(M.fence, s * 24 - 0.02, 2.3, -20, s * 24 + 0.02, 2.36, 80);
  solid(M.panel, P6.booth[0] - 2, 0, P6.booth[2] - 1.6, P6.booth[0] + 2, 2.8, P6.booth[2] + 1.6, '2049');
  bat('2196').box(M.conc, P6.booth[0] - 2, 0, P6.booth[2] - 1.6, P6.booth[0] + 2, 1.2, P6.booth[2] + 1.6); box(P6.booth[0] - 2, 0, P6.booth[2] - 1.6, P6.booth[0] + 2, 1.2, P6.booth[2] + 1.6, '2196');
  plane(signTex('arrayplq', [['HELIX LONG ARRAY', 38], ['HALCYON HILL · COMMISSIONED 2041', 20, '#8ab0c0'], ['"ONE SECOND FOR EVERY CLOCK ON EARTH"', 18, '#e8d8a0', 500]], { bg: '#1c2428', border: '#cfe0e8', h: 200, wear: 0.0 }), 2.4, 1.2, P6.booth[0] + 2.02, 1.6, P6.booth[2], PI / 2, 0.25, '2049');
  plane(signTex('arrayplq96', [['HELIX LONG ARRAY', 38], ['HALCYON HILL · 2041', 20, '#8ab0c0'], ['"ONE SECOND FOR EVERY CLOCK ON EARTH"', 18, '#e8d8a0', 500]], { bg: '#1c2428', border: '#cfe0e8', h: 200, wear: 1.2 }), 2.4, 1.2, P6.booth[0] + 2.02, 0.7, P6.booth[2], PI / 2, 0.15, '2196');
  for (let z = 10; z < 80; z += 8) { bat('2049').geo(white, new THREE.BoxGeometry(0.2, 0.2, 0.2), [-2.2, 0.4, z]); bat('2049').geo(white, new THREE.BoxGeometry(0.2, 0.2, 0.2), [2.2, 0.4, z]); }
  // the mast: four tapering legs, bracing, platforms, ladders, the lift shaft
  const leg = (y) => 4 - 2.4 * y / 46;
  const mastMat = (e) => (e === '2049' ? M.steel49 : M.rust);
  for (const e of ['2196', '2049']) {
    const B = bat(e), mm = mastMat(e);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const a = Math.atan2(2.4, 46); B.geo(mm, new THREE.BoxGeometry(0.34, 46.2, 0.34), [sx * (4 - 1.2), 23, sz * (4 - 1.2)], [sz * a, 0, -sx * a]); }
    for (let y = 2; y < 46; y += 4) { const w = leg(y); for (const s of [-1, 1]) { B.box(mm, -w, y, s * w - 0.06, w, y + 0.12, s * w + 0.06); B.box(mm, s * w - 0.06, y, -w, s * w + 0.06, y + 0.12, w); } const w2 = leg(y + 4), d = Math.hypot(w + w2, 4), ang = Math.atan2(4, w + w2); for (const s of [-1, 1]) { B.geo(mm, new THREE.BoxGeometry(d, 0.08, 0.08), [0, y + 2, s * (w + w2) / 2], [0, 0, ang]); B.geo(mm, new THREE.BoxGeometry(0.08, 0.08, d), [s * (w + w2) / 2, y + 2, 0], [ang, 0, 0]); } }
    for (const [x0, x1] of [[-1.0, -0.9], [0.9, 1.0]]) for (const [z0, z1] of [[-1.0, -0.9], [0.9, 1.0]]) B.box(mm, x0, 0, z0, x1, 34, z1);
  }
  solid(M.conc, -5, 0, -5, 5, 0.4, 5);
  const deck = (y, hw, gapZ) => {   // a grated deck with the lift shaft cut out, rails with a ladder gap on +z (south) or -z (north)
    for (const [x0, z0, x1, z1] of [[-hw, -hw, hw, -1.0], [-hw, 1.0, hw, hw], [-hw, -1.0, -1.0, 1.0], [1.0, -1.0, hw, 1.0]]) solid(M.grate, x0, y - 0.25, z0, x1, y, z1);
    for (const s of [-1, 1]) { solid(M.rust, s * hw - 0.05, y, -hw, s * hw + 0.05, y + 1.1, hw); }
    for (const s of [-1, 1]) { const z = s * hw; if (s === gapZ) { solid(M.rust, -hw, y, z - 0.05, -0.7, y + 1.1, z + 0.05); solid(M.rust, 0.7, y, z - 0.05, hw, y + 1.1, z + 0.05); } else solid(M.rust, -hw, y, z - 0.05, hw, y + 1.1, z + 0.05); }
  };
  deck(P6.P1y, 5, 1); deck(P6.P2y, 4, -1); deck(P6.P3y, 3, 0);
  solid(M.grate, -1.0, P6.P3y - 0.25, -1.0, 1.0, P6.P3y, 1.0);   // the crown has no lift shaft: close the middle
  // ladders: south face base -> P1, north face P2 -> P3
  const ladder = (z, y0, y1, s) => { for (const x of [-0.32, 0.32]) bat().box(M.rust, x - 0.03, y0, z - 0.03, x + 0.03, y1 + 1.0, z + 0.03); for (let y = y0 + 0.3; y < y1; y += 0.32) bat().box(M.rust, -0.32, y, z - 0.02, 0.32, y + 0.04, z + 0.02); for (let y = y0 + 2.2; y < y1; y += 1.4) bat().geo(M.rust, new THREE.TorusGeometry(0.55, 0.03, 4, 16, PI), [0, y, z + s * 0.05], [PI / 2, 0, 0]); };
  ladder(5.15, 0.4, P6.P1y, 1); ladder(-4.15, P6.P2y, P6.P3y, -1);
  // the 2049 lift car and the radome hatch that seals the crown in 2049
  W.lift = new THREE.Group(); W.lift.position.set(0, 0.4, 0); add(W.lift, '2049');
  { const LB = new Batch(); LB.box(M.panel, -0.85, 0, -0.85, 0.85, 0.1, 0.85); LB.box(M.panel, -0.85, 2.3, -0.85, 0.85, 2.4, 0.85); for (const s of [-1, 1]) { LB.box(M.panel, s * 0.85 - 0.05, 0, -0.85, s * 0.85 + 0.05, 2.4, 0.85); LB.box(M.panel, -0.85, 0, s * 0.85 - 0.05, 0.85, 2.4, s * 0.85 + 0.05); } LB.geo(white, new THREE.BoxGeometry(1.0, 0.04, 0.3), [0, 2.28, 0]); LB.build(W.lift, { name: 'liftcar' }); }
  W.liftLamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), red.clone()); W.liftLamp.position.set(0.9, P6.P1y + 1.4, 1.02); add(W.liftLamp, '2049');
  plane(signTex('liftop', [['SERVICE LIFT · P1 → P2', 26], ['OPERATOR ACCESS ONLY', 20, '#ffd27a']], { bg: '#202830', border: '#e8eef0', h: 128 }), 1.0, 0.32, 0, P6.P1y + 2.2, 1.04, 0, 0.3, '2049');
  box(-1.0, P6.P2y, -4.4, 1.0, P6.P2y + 3, -4.0, '2049'); bat('2049').box(M.panel, -1.0, P6.P2y, -4.4, 1.0, P6.P2y + 3, -4.0);
  plane(signTex('radome', [['RADOME HATCH', 28], ['SEALED · STORM PROTOCOL', 20, '#ffd27a']], { bg: '#202830', border: '#ffd27a', h: 128 }), 1.2, 0.36, 0, P6.P2y + 1.8, -3.98, PI, 0.35, '2049');
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.6, 32, 18, 0, PI * 2, 0, PI * 0.62), new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide })); dome.position.set(0, P6.P3y - 3, 0); add(dome, '2049');
  const domeR = new THREE.Mesh(new THREE.SphereGeometry(5.6, 24, 12, 0.6, PI * 0.7, 0, PI * 0.45), new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.8, side: THREE.DoubleSide })); domeR.position.set(0, P6.P3y - 6.4, 0); add(domeR, '2196');   // the broken radome hangs below the crown deck
  // the crown: three feed horns with tuning dials, the emitter
  const hornG = new THREE.ConeGeometry(0.7, 1.6, 20, 1, true);
  P6.horns.forEach(([x, y, z], i) => {
    const out = new THREE.Vector3(x, 0, z).normalize();
    const h = new THREE.Mesh(hornG, M.rust); h.position.set(x * 1.0, y + 1.6, z * 1.0); h.lookAt(x * 3, y + 3.2, z * 3); h.rotateX(PI / 2); add(h);
    const dialMat = new THREE.MeshBasicMaterial({ map: TEX.dial('·', false), toneMapped: false });
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), dialMat); d.position.set(x - out.x * 0.45, y + 1.0, z - out.z * 0.45); d.lookAt(0, y + 1.0, 0); d.userData.noBatch = true; add(d);
    bat().box(M.rust, x - out.x * 0.45 - 0.3, y, z - out.z * 0.45 - 0.3, x - out.x * 0.45 + 0.3, y + 0.75, z - out.z * 0.45 + 0.3);
    W.horns.push({ mesh: h, dial: d, dialMat, i, pos: [x - out.x * 0.9, y, z - out.z * 0.9] });
  });
  W.setDial = (i, note, ok) => { const t = TEX.dial(note, ok); W.horns[i].dialMat.map = t; W.horns[i].dialMat.needsUpdate = true; };
  W.emitter = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.1, 10, 36), violet.clone()); W.emitter.position.set(0, P6.P3y + 3.6, 0); W.emitter.rotation.x = PI / 2; W.emitter.userData.noBatch = true; add(W.emitter);
  bat().box(M.rust, -0.12, P6.P3y, -0.12, 0.12, P6.P3y + 3.6, 0.12); box(-0.3, P6.P3y, -0.3, 0.3, P6.P3y + 3.6, 0.3);
  W.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.4, 300, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x9a7bff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  W.beam.position.set(0, P6.P3y + 154, 0); W.beam.userData.noBatch = true; add(W.beam);
  W.shard = shardMesh(); W.shard.position.set(...P6.shard); add(W.shard);
  // storm cells on the plateau path; the planetary storm around the hill; the unbuilt city in the clouds (hidden)
  W.storm = stormCells(scene, T, [
    { x: -3, y: 0, z: 62, r: 2.0, path: [[-6, 0], [6, 0]], period: 8, era: '2196' },
    { x: 3, y: 0, z: 40, r: 2.2, path: [[5, -3], [-5, 3]], period: 7, era: '2196' },
    { x: 0, y: 0, z: 20, r: 2.0, path: [[-7, 0], [7, 0]], period: 6.5, era: '2196' },
  ]);
  W.sky = stormWall({ center: [0, 30], radius: 230, height: 260, y: -60, a: 0x7a4aff, b: 0x4ad8ff, amp: 0.9 }); add(W.sky);
  try { const sk = RZ.skyline({ center: [0, -60], radius: [260, 380], count: low ? 30 : 50, height: [60, 240], lit: 1.0, seed: 1861 }); const m = sk.mesh || sk; m.position.y = 70; m.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0; o.material.depthWrite = false; } }); m.visible = false; add(m); W.unbuilt = m; } catch (e) { void e; }
  src(0, P6.P1y + 2, 0, 0xffc890, 3, 10); src(0, P6.P3y + 2, 0, 0x9a7bff, 5, 14); src(P6.booth[0], 3, P6.booth[2], 0xf2f6ff, 3, 10, '2049'); src(0, 3, 6, 0xffc890, 3, 10);
  K.finish();
  W.update = (dt, t) => {
    W.storm.update(t); W.sky.material.uniforms.uTime.value = t; W.shard.rotation.y = t * 1.5;
    W.emitter.rotation.z = t * 0.6; W.emitter.material.emissiveIntensity = 1.6 + Math.sin(t * 2.2) * 0.6;
  };
  return W;
}
