// Mission 21 environment: THE LAST BATTLE OF THE CONTINUUM. One place in three states, north = -z.
//   2196  THE BASTION: the Continuum's command, grafted onto the shell of Helix Tower One. The Unwritten forward post
//         (z 34..42), the Approach (z 12..34) under the Bastion wall (z 10..12, no gaps), the muster yard (z -14..10), the
//         Hall of Fixed Points, "the Register" (x -14..14, z -15..-40), the Proving Floor (the arena, x -22..22,
//         z -46..-76), the chasm (z -76..-82) and the Cradle dais (z -82..-96) where the Chronolith hangs.
//   2049  HELIX HEADQUARTERS at night in the rain: the plaza and its security fence (z 12.6, one gap at the loading dock,
//         x 12..16, with a camera), the forecourt, the lobby (the Register's footprint), the Grand Atrium (the arena's)
//         with its four seismic dampers, the sunken lower lobby, the closed skybridge and the HALO sculpture hung on the
//         same anchors as the Cradle, ballast trays west and east.
//   2026  THE SITE: Helix HQ under construction (only the atrium is reachable): steel frame, formwork, the open
//         excavation, the tower crane with transfer beam TB-7 on its hook, the set-out paint and the site board.
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, chronolith } from './kit.js';
import { Batch } from './env_m6.js';
import { kit, signTex, paperTex, shardMesh, stormWall } from './env_m18.js';
import { streetKit, lampPost } from './props.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';

const PI = Math.PI;

// ---------------------------------------------------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------------------------------------------------
export const P = {
  start: [0, 0, 45, PI],
  sera: [-3.2, 0, 39.4], sapper: [4.6, 0, 38.6], post: [0, 0, 38],
  gate: [0, 0, 11], gap: [14, 0, 12.8], camera: [11.6, 3.6, 13.6], booth: [18, 0, 15.5],
  yardIn: [0, 0, 6, PI], door: [0, 0, -14.5],
  regIn: [0, 0, -17.5, PI], clerk: [-10.4, 0, -35.2], regDoor: [0, 0, -40.5],
  panel49: [12.6, 0, -18.4], pods: [[-10.4, -21.0], [-10.4, -27.0], [10.4, -30.0]],
  arenaIn: [0, 0, -44, PI], arena: [0, -64],
  cols: { S1: [-16, -52], S2: [16, -52], N1: [-16, -72], N2: [16, -72] },
  plateN2: [14.4, 0, -70.6], ballastW: [-20.6, 0, -62], ballastE: [20.6, 0, -62], gauge: [0, 0, -74.8],
  seat: [0, 0, -75.4], plaque49: [-3.6, 0, -74.6], crane: [-9, 0, -73], board26: [-13.6, 0, -58], setout: [0, 0, -74.6],
  pit: [-76, -82], dais: [0, 0, -86, PI], lift: [0, 0, -93], ring: [0, 7.2, -90.5],
  squadL: [-10, 0, -94], squadR: [10, 0, -94],
};
// collectible temporal shards: [x, y, z, era]
export const SHARDS = [
  [-14.6, 0.5, 30.5, '2196'],    // beside the burnt tram at the forward post
  [18.6, 0.6, 18.4, '2049'],     // under the guard booth's step
  [-16.8, 0.5, -8.6, '2196'],    // behind the supply pods in the yard
  [12.4, 0.5, -37.6, '2196'],    // in the sealed alcove of the Register (the archivist's key)
  [-20.2, 0.9, -48.6, '2049'],   // on the atrium's south-west planter
  [19.0, 0.5, -49.0, '2026'],    // the site, under the scaffold tower in the south-east corner
];
export const COVER = [[-8, 6, 2.4, 1.4, 1.5], [8, 5, 2.0, 2.0, 1.5], [-4, -4, 1.6, 1.6, 1.3], [5, -6, 2.4, 1.2, 1.4], [-14, -6, 2.0, 2.0, 1.5], [14, -2, 1.6, 2.6, 1.4], [-15.6, -9.6, 1.4, 1.4, 1.5]];
export const ARENA_COVER = [[-8, -54, 2.2, 1.0, 1.25], [8, -56, 2.2, 1.0, 1.25], [-12, -64, 1.0, 2.4, 1.25], [12, -62, 1.0, 2.4, 1.25], [0, -60, 2.6, 1.0, 1.25], [-5, -70, 2.0, 1.0, 1.2], [5, -68, 2.0, 1.0, 1.2]];
export const SLABS = [[-22, -15], [15, 22], [-15, -7.5], [7.5, 15]];   // outer floor strips at the chasm edge, in fall order
export const BALLAST = { W: [10], E: [40, 20, 10] };                    // kg per block, as the 2049 trays hold them

// ---------------------------------------------------------------------------------------------------------------------
// Cast (COSTUMES.md: continuum_1 trooper, continuum_2 officer, surv_* survivors; Helix staff in 2049)
// ---------------------------------------------------------------------------------------------------------------------
export const WARDEN = { era: '2196', costume: 'continuum_2', sex: 0, age: 38, height: 1.9, build: 1.12, skin: 0xc49a7c, hair: 0x15100b, hairStyle: 'buzz',
  topType: 'armored', top: 0xe6e8ea, topKind: 'synthetic', armor: true, pantsType: 'trousers', pants: 0x202328, shoes: 'boots', boots: 0x202328, gloves: 0x202328, belt: 0xd9a441, lod: true };
export const WARDEN_F = { ...WARDEN, sex: 1, female: true, age: 34, height: 1.8, build: 1.04, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'bun' };
export const HELD = [
  { era: '2196', costume: 'surv_m2', sex: 0, age: 57, height: 1.74, build: 0.94, skin: 0xa16d4c, hair: 0x8a8278, hairStyle: 'short', stubble: true, topType: 'jacket', top: 0x5a5444, topKind: 'fabric', hood: true, vest: 0x4a4a38, pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 24, height: 1.68, build: 0.94, skin: 0xe8b996, hair: 0x5a3a22, hairStyle: 'tied-back', topType: 'jacket', top: 0x6a5a44, topKind: 'fabric', pantsType: 'cargo', pants: 0x3a3a30, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 66, height: 1.6, build: 0.98, skin: 0x6b4029, hair: 0xc8c4be, hairStyle: 'bun', topType: 'jacket', top: 0x4a3a28, topKind: 'fabric', hood: true, vest: 0x5a3e28, pantsType: 'trousers', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
];
export const ALLY_LOOKS = [
  { era: '2196', costume: 'surv_m1', sex: 0, age: 33, height: 1.8, build: 1.0, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'buzz', topType: 'armored', top: 0x4a3a28, topKind: 'fabric', vest: 0x7a3e22, armor: true, pantsType: 'cargo', pants: 0x3a3a30, shoes: 'boots', boots: 0x2a2018, gloves: 0x2a2420, lod: true },
  { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 29, height: 1.7, build: 0.96, skin: 0xd9a585, hair: 0x2a1c14, hairStyle: 'tied-back', topType: 'jacket', top: 0x5a5444, topKind: 'fabric', vest: 0x7a3e22, pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, gloves: 0x3a3028, lod: true },
];
export const GUARD49 = { era: '2049', costume: 'helix_security', faction: 'security', sex: 0, age: 44, height: 1.82, build: 1.08, skin: 0xe0b394, hair: 0x3a2418, hairStyle: 'buzz', topType: 'uniform', top: 0x1c2533, topKind: 'fabric', vest: 0x111820, pantsType: 'trousers', pants: 0x1c2533, shoes: 'boots', boots: 0x0f0f10, gloves: 0x101010, lod: true };

export function registerM21Cast() {
  registerCast('m21warden', {
    name: 'WARDEN OF THE FIXED POINT', role: 'The Continuum · elite · the Bastion',
    bio: 'The Continuum\'s elite. Their suits keep the last three seconds of the wearer: an injury, a cracked plate, a fall, and the suit puts them back the way they were.',
    look: { ...WARDEN, lod: false }, rimColor: 0xffd27a, vp: { sex: 'm', pitch: 0.74, rate: 0.92, langs: ['en-GB', 'en-US'] },
  });
  registerCast('m21clerk', {
    name: 'RECORDER ILSE MAREN', role: 'The Continuum · keeper of the Register',
    bio: 'Forty-four. Has written down every world the Continuum corrected, by hand, in gold ink, for nineteen years. Has never fired a weapon.',
    look: { era: '2196', costume: 'continuum_2', sex: 1, female: true, age: 44, height: 1.68, build: 0.96, skin: 0xe8c0a0, hair: 0x6a5a4a, hairStyle: 'bun', eyes: 0x4a5a6a, glasses: true, wrinkles: 0.3,
      face: { jaw: -0.2, cheek: 0.25, nose: 0.15, noseWidth: -0.1, lips: -0.1, brow: 0.0, eyeSize: 0.1, faceLength: 0.2, chin: 0.0 },
      topType: 'armored', top: 0xe6e8ea, topKind: 'synthetic', armor: true, pantsType: 'trousers', pants: 0x202328, shoes: 'boots', boots: 0x202328, gloves: 0x202328, belt: 0xd9a441 },
    rimColor: 0xffd27a, vp: { sex: 'f', pitch: 1.04, rate: 0.94, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('m21sapper', {
    name: 'MAEVE DUNN', role: 'The Unwritten · demolition',
    bio: 'Thirty-one. Lasker\'s best sapper. Has laid charges under nine Continuum anchors and lost count of the times she has lived the ninth.',
    look: { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 31, height: 1.71, build: 1.0, skin: 0xd9a585, hair: 0x7a3a1a, hairStyle: 'tied-back', eyes: 0x3a5a3a, freckles: 0.4,
      face: { jaw: 0.1, cheek: 0.3, nose: 0.0, noseWidth: 0.05, lips: 0.05, brow: 0.2, eyeSize: 0.0, faceLength: 0.0, chin: 0.1 },
      topType: 'jacket', top: 0x5a5444, topKind: 'fabric', vest: 0x7a3e22, pantsType: 'cargo', pants: 0x3a3a30, shoes: 'boots', boots: 0x2a2018, gloves: 0x2a2420 },
    rimColor: 0xff8f6a, vp: { sex: 'f', pitch: 1.0, rate: 1.06, langs: ['en-IE', 'en-GB', 'en-US'] },
  });
  registerCast('m21held', { name: 'HELD AS A FIXED POINT', role: 'The Register · stasis', look: { ...HELD[0], lod: false }, vp: { sex: 'm', pitch: 0.88, rate: 0.9, langs: ['en-GB', 'en-US'] } });
  registerCast('m21ally', { name: 'UNWRITTEN FIGHTER', role: 'The Bastion breach', look: { ...ALLY_LOOKS[0], lod: false }, vp: { sex: 'm', pitch: 0.92, rate: 1.04, langs: ['en-GB', 'en-US'] } });
  registerCast('m21adair', { name: 'PREFECT IMA ADAIR', role: 'The Continuum · every speaker in the Bastion', portraitOf: 'prefect', voice: true, vp: { sex: 'f', pitch: 0.96, rate: 0.93, langs: ['en-GB', 'en-US'] } });
  registerCast('m21band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist · binding', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m21lasker', { name: 'DOV LASKER', role: 'Radio · the Unwritten', portraitOf: 'lasker', voice: true, vp: { sex: 'm', pitch: 0.8, rate: 0.96, langs: ['en-GB', 'en-US'] } });
  registerCast('m21anja', { name: 'DR. ANJA VALE', role: 'Radio · Harrow Reach', portraitOf: 'anja', voice: true, vp: { sex: 'f', pitch: 1.0, rate: 0.95, langs: ['en-GB', 'en-US'] } });
  registerCast('m21hale', { name: 'OFFICER HALE', role: 'Helix security · 2049', portraitOf: 'hale', voice: true, vp: { sex: 'm', pitch: 0.78, rate: 0.94, langs: ['en-US'] } });
  registerCast('m21brandt', { name: 'OFFICER BRANDT', role: 'Helix security · 2049', portraitOf: 'brandt', voice: true, vp: { sex: 'm', pitch: 0.95, rate: 1.06, langs: ['en-GB', 'en-US'] } });
  registerCast('m21sera', { name: 'SERA VOSS', role: 'Radio · the forward post', portraitOf: 'sera', voice: true, vp: { sex: 'f', pitch: 0.92, rate: 1.04, langs: ['en-AU', 'en-US', 'en-GB'] } });
  registerCast('m21mira', { name: 'MIRA VAREN', role: 'A pattern · inside the ring', portraitOf: 'mira', voice: true, vp: { sex: 'f', pitch: 1.05, rate: 0.96, langs: ['en-GB', 'en-US'] } });
  registerCast('m21trooper', { name: 'CONTINUUM TROOPER', role: 'The Bastion · helmet sealed', voice: true, vp: { sex: 'm', pitch: 0.8, rate: 1.0, langs: ['en-GB', 'en-US'] } });
  registerCast('m21guard', { name: 'HELIX SECURITY', role: 'Night shift · 2049', voice: true, vp: { sex: 'm', pitch: 0.9, rate: 1.0, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music (bible: Nine-Minute War "layered percussion, short string ostinati", Kai "the need to fix it" 92 BPM with ticking
// that drifts, the Witness "Kai motif played slower and lower; bowed bass, metallic resonance, irregular pulse", 54 BPM).
// The three notes E-B-A are Kai and Mira's; the Witness plays them a fifth lower and late.
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { threat: 0, alert: 0, collapse: 0, list: 0, ally: 0, ring: 0 };
export function registerM21Themes() {
  registerTheme('m21-dusk', { bpm: 70, step(a, s, t, d) {             // the ridge at dusk: wide strings, the Bastion's hum
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 62], [40, 47, 52, 59]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016, 520); a.cello(ch[0] - 12, t, d * 16, 0.05); }
    if (b === 0 || b === 8) a.drum(t, 0.03, 50, 30);
    if (bar % 4 === 2 && (b === 0 || b === 4 || b === 8)) a.piano([64, 71, 69][b >> 2], t, 0.05, 4);
    if (b === 12 && bar % 2) a.glass(ch[3] + 24, t, 0.008);
  } });
  registerTheme('m21-stealth', { bpm: 92, step(a, s, t, d) {          // the wall and the yard: muted pulse, drifting tick
    const bar = Math.floor(s / 16), b = s % 16, al = Math.max(musicState.alert, musicState.threat), ch = [[45, 52, 55], [44, 51, 55], [41, 48, 52], [43, 50, 53]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.012 + al * 0.01, 380 + al * 700); a.cello(ch[0] - 12, t, d * 16, 0.04); }
    if (b % 4 === 0) a.drum(t, 0.03 + al * 0.05, 70, 40);
    a.tick(t + ((b * 5) % 7) * 0.003, 0.005 + al * 0.01, 3400);
    if ([3, 6, 11].includes(b) && bar % 2 === 0) a.piano(ch[b % 3] + 12, t, 0.03, 0.8);
    if (al > 0.6 && b % 2 === 1) a.tick(t, 0.012, 1800);
  } });
  registerTheme('m21-helix', { bpm: 66, step(a, s, t, d) {            // Helix at night in 2049: rain on glass, a lobby hum
    const bar = Math.floor(s / 16), b = s % 16, ch = [[52, 59, 64], [50, 57, 62], [48, 55, 60], [47, 54, 59]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.012, 1300); a.cello(ch[0] - 12, t, d * 16, 0.025); }
    if (b % 2 === 0) a.tick(t, 0.006, 5200);
    if (b === 6 || (b === 13 && bar % 2)) a.piano(ch[(b + bar) % 3] + 12, t, 0.035, 2.4);
  } });
  registerTheme('m21-register', { bpm: 58, step(a, s, t, d) {         // the Hall of Fixed Points: cold glass, held breath
    const bar = Math.floor(s / 16), b = s % 16, ch = [[40, 47, 52], [41, 48, 52], [38, 45, 50], [40, 47, 55]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.014, 300); a.cello(ch[0] - 12, t, d * 16, 0.04); }
    if (s % 5 === 0) a.glass([76, 79, 83, 81][Math.floor(s / 5) % 4], t, 0.008);
    if (b === 8 && bar % 2) a.piano(ch[2] + 12, t, 0.03, 5);
    if (musicState.threat > 0.3 && b % 4 === 0) a.drum(t, 0.04 + musicState.threat * 0.05, 60, 34);
  } });
  registerTheme('m21-battle', { bpm: 118, step(a, s, t, d) {          // the Proving Floor: percussion that slips a beat
    const bar = Math.floor(s / 16), b = s % 16, th = musicState.threat, ch = [[45, 52, 57], [43, 50, 55], [41, 48, 53], [44, 51, 56]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.012 + th * 0.008, 500 + th * 800); a.cello(ch[0] - 12, t, d * 16, 0.055); }
    const slip = bar % 4 === 3 ? [0, 3, 7, 10, 13] : [0, 3, 6, 8, 11, 14];
    if (slip.includes(b)) a.drum(t, 0.05 + th * 0.06, 90, 40);
    if (b % 2 === 1) a.tick(t, 0.006 + th * 0.008, 3800);
    if ([0, 2, 4, 6].includes(b % 8) && th > 0.25) a.pluck(ch[(b >> 1) % 3] + 12, t, 0.025 + th * 0.02);
    if (b === 12 && bar % 2) a.glass(ch[2] + 24, t, 0.008);
  } });
  registerTheme('m21-collapse', { bpm: 104, step(a, s, t, d) {        // the arena falls: a pulse that tightens with the meter
    const bar = Math.floor(s / 16), b = s % 16, c = Math.max(musicState.collapse, musicState.list), ch = [[40, 47, 52], [41, 48, 51], [38, 45, 50], [36, 43, 50]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.015 + c * 0.01, 320 + c * 700); a.cello(ch[0] - 12, t, d * 16, 0.06); }
    if (b % (c > 0.6 ? 2 : 4) === 0) a.drum(t, 0.05 + c * 0.06, 62, 32);
    a.tick(t, 0.005 + c * 0.012, 2600 + c * 1200);
    if (b === 4 || b === 12) a.glass(ch[2] + 24 - (bar % 2), t, 0.008 + c * 0.008);
    if (b === 9 && bar % 2 === 0) a.piano(ch[1] + 12, t, 0.04, 3);
  } });
  registerTheme('m21-site', { bpm: 82, step(a, s, t, d) {             // 2026, a building site in autumn daylight
    const bar = Math.floor(s / 16), b = s % 16, ch = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.012, 1100); a.cello(ch[0] - 12, t, d * 16, 0.03); }
    if ([0, 4, 7, 10, 12].includes(b)) a.pluck(ch[(b >> 1) % 4] + 12, t, 0.03);
    if (b % 8 === 0) a.drum(t, 0.02, 100, 55);
    if (b === 2 && bar % 4 === 1) a.flute(ch[2] + 12, t, d * 10, 0.013);
  } });
  registerTheme('m21-ally', { bpm: 100, step(a, s, t, d) {            // someone came: a warm rise over the fight
    const bar = Math.floor(s / 16), b = s % 16, th = musicState.threat, ch = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 62]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.017, 900); a.cello(ch[0] - 12, t, d * 16, 0.05); }
    if (b % 4 === 0) a.drum(t, 0.05 + th * 0.04, 80, 40);
    if ([0, 3, 6, 10, 13].includes(b)) a.pluck(ch[b % 4] + 12, t, 0.035);
    if (b === 8) a.flute(ch[3] + 12, t, d * 6, 0.015);
  } });
  registerTheme('m21-witness', { bpm: 54, step(a, s, t, d) {          // a familiar self made frightening by time
    const bar = Math.floor(s / 16), b = s % 16, ch = [[33, 40, 45], [32, 39, 44], [29, 36, 41], [31, 38, 43]][bar % 4];
    if (b === 0) { a.pad(ch.map(n => n + 12), t, d * 16, 0.016, 260); a.cello(ch[0], t, d * 16, 0.07); }
    if (bar % 2 === 0 && (b === 1 || b === 6 || b === 12)) a.piano([57, 64, 62][b === 1 ? 0 : b === 6 ? 1 : 2], t, 0.06, 5);   // E-B-A, a fifth lower, late
    if (b === 10 && bar % 3 === 1) a.glass(69, t, 0.01);
    if ((b === 0 && bar % 2) || (b === 7 && bar % 3 === 2)) a.drum(t, 0.04, 45, 28);
  } });
  registerTheme('m21-experiment', { bpm: 60, step(a, s, t, d) {       // the ring wakes: glass, a pad that keeps rising
    const bar = Math.floor(s / 16), b = s % 16, r = musicState.ring, ch = [[52, 59, 64], [53, 60, 65], [55, 62, 67], [57, 64, 69]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016 + r * 0.01, 500 + r * 1200); a.cello(ch[0] - 24, t, d * 16, 0.06); }
    if (b === 0 || b === 4 || b === 8) a.piano([64, 71, 69][b >> 2] + (bar % 2 ? 12 : 0), t, 0.06, 4);
    if (s % 3 === 0) a.glass(76 + ((s / 3) % 5) * 2, t, 0.006 + r * 0.008);
    if (r > 0.5 && b % 4 === 2) a.tick(t, 0.01, 4200);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Code-drawn screens, plates and papers
// ---------------------------------------------------------------------------------------------------------------------
const grain = (g, w, h, n, a, seed = 3) => { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } };
/** Continuum glass: graphite with gold rule lines. */
export function contTex(key, title, lines, o = {}) {
  const w = o.w || 512, h = o.h || 320;
  return canvasTex(w, h, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#24272c'); gr.addColorStop(1, '#16181c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,210,122,0.75)'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#ffd27a'; g.font = `700 ${o.ts || 26}px ${FONT}`; g.textAlign = 'left'; g.fillText(title, 28, 52);
    g.fillRect(28, 64, w - 56, 2);
    g.fillStyle = '#e8eaec'; g.font = `500 ${o.fs || 21}px ${FONT}`;
    lines.forEach((l, i) => { if (l.startsWith('!')) { g.fillStyle = '#ffd27a'; g.fillText(l.slice(1), 28, 100 + i * (o.lh || 30)); g.fillStyle = '#e8eaec'; } else g.fillText(l, 28, 100 + i * (o.lh || 30)); });
    if (o.seal) { g.strokeStyle = 'rgba(255,210,122,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(w - 64, h - 60, 30, 0, 7); g.stroke(); g.beginPath(); g.arc(w - 64, h - 60, 20, 0, 7); g.stroke(); }
  }, 'm21cont' + key);
}
export const TEX = {
  emblem: () => canvasTex(512, 512, (g, w) => {
    g.clearRect(0, 0, w, w); const c = w / 2;
    g.strokeStyle = '#ffd27a'; g.lineWidth = 16; g.beginPath(); g.arc(c, c, 200, 0, 7); g.stroke();
    g.lineWidth = 8; g.beginPath(); g.arc(c, c, 150, 0, 7); g.stroke();
    g.fillStyle = '#ffd27a'; g.beginPath(); g.moveTo(c, c - 140); g.lineTo(c + 22, c); g.lineTo(c, c + 140); g.lineTo(c - 22, c); g.closePath(); g.fill();
    g.fillRect(c - 140, c - 6, 280, 12);
  }, 'm21emblem'),
  banner: () => canvasTex(256, 768, (g, w, h) => {
    g.fillStyle = '#e6e8ea'; g.fillRect(0, 0, w, h); grain(g, w, h, 900, 0.04, 9);
    g.fillStyle = '#d9a441'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
    g.strokeStyle = '#d9a441'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, 260, 86, 0, 7); g.stroke(); g.lineWidth = 4; g.beginPath(); g.arc(w / 2, 260, 60, 0, 7); g.stroke();
    g.fillStyle = '#202328'; g.font = `700 30px ${FONT}`; g.textAlign = 'center'; g.fillText('ONE WORLD', w / 2, 470); g.fillText('ONE TIME', w / 2, 512);
    g.font = `600 20px ${FONT}`; g.fillStyle = '#8a9098'; g.fillText('THE CONTINUUM', w / 2, 600);
  }, 'm21banner'),
  helix: () => canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#0c1014'; g.fillRect(0, 0, w, h); g.fillStyle = '#5fe6ff'; g.font = `700 120px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('HELIX', w / 2, h / 2 - 14); g.font = `600 30px ${FONT}`; g.fillStyle = '#c8f6ff'; g.fillText('TEMPORAL RESEARCH · HEADQUARTERS', w / 2, h - 34);
  }, 'm21helix'),
  gauge: (deg) => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#16181c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffd27a'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#ffd27a'; g.font = `700 30px ${FONT}`; g.textAlign = 'center'; g.fillText('CRADLE · LIST', w / 2, 52);
    const ok = Math.abs(deg) < 2, c = ok ? '#b6ff8a' : Math.abs(deg) > 14 ? '#ff7a6a' : '#ffd27a';
    g.fillStyle = c; g.font = `700 88px ${FONT}`; g.fillText(ok ? 'LEVEL' : `${Math.abs(deg)}° ${deg > 0 ? 'EAST' : 'WEST'}`, w / 2, 150);
    g.strokeStyle = c; g.lineWidth = 6; g.beginPath(); const a = deg * PI / 180; g.moveTo(w / 2 - Math.cos(a) * 160, 210 - Math.sin(a) * 160 * -1 * 0.4); g.lineTo(w / 2 + Math.cos(a) * 160, 210 + Math.sin(a) * 160 * -1 * 0.4); g.stroke();
  }, 'm21gauge' + deg),
  ballast: (side, list) => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#e8eaec'; g.fillRect(0, 0, w, h); g.fillStyle = '#0a2a3a'; g.font = `700 32px ${FONT}`; g.textAlign = 'center';
    g.fillText(`HALO · ${side === 'W' ? 'WEST' : 'EAST'} BALLAST`, w / 2, 50);
    g.font = `600 26px ${FONT}`; g.fillStyle = '#2a4a5a'; g.fillText(list.length ? list.map(k => k + ' kg').join('  +  ') : '(empty)', w / 2, 120);
    g.fillStyle = '#0a2a3a'; g.font = `700 40px ${FONT}`; g.fillText(`= ${list.reduce((s, k) => s + k, 0)} kg`, w / 2, 190);
    g.font = `500 18px ${FONT}`; g.fillStyle = '#5a6a72'; g.fillText('Keep the trays equal or the Halo lists to the heavy side', w / 2, 232);
  }, 'm21ballast' + side + list.join('-')),
  slew: (pos) => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#2a2a24'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0c030'; g.fillRect(0, 0, w, 40); g.fillStyle = '#1a1a14'; g.font = `700 26px ${FONT}`; g.textAlign = 'center'; g.fillText('TC-2 · SLEW / HOIST', w / 2, 29);
    ['WEST', 'CENTRE', 'EAST'].forEach((n, i) => { g.fillStyle = i === pos ? '#f0c030' : '#6a6a5a'; g.beginPath(); g.arc(110 + i * 146, 130, 34, 0, 7); g.fill(); g.fillStyle = '#e8e4d0'; g.font = `600 22px ${FONT}`; g.fillText(n, 110 + i * 146, 205); });
    g.fillStyle = '#e8e4d0'; g.font = `500 18px ${FONT}`; g.fillText('LOAD ON HOOK: TB-7 · 4.2 t', w / 2, 240);
  }, 'm21slew' + pos),
};

// ---------------------------------------------------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------------------------------------------------
export function buildBastion(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low', R = rng(2101);
  const K = kit(game, scene, T, 'bastion'), { box, solid, pm, src, add, plane, ground, bat } = K;
  const W = { lightSrc: K.lightSrc, root: K.root, slabs: [], shards: [], ballast: { W: [...BALLAST.W], E: [...BALLAST.E] } };
  const M = {
    pearl: pm('paintedMetalPanel', { color: 0xe6e8ea, cols: 3, rows: 2, wear: 0.03, grime: 0.08, gloss: 0.85 }),
    pearlDark: pm('paintedMetalPanel', { color: 0xb8bcc2, cols: 2, rows: 3, wear: 0.05, grime: 0.2, gloss: 0.7 }),
    graphite: pm('paintedMetalPanel', { color: 0x2a2d32, cols: 2, rows: 2, wear: 0.04, grime: 0.1, gloss: 0.6 }),
    floor96: pm('concrete', { color: 0x5e5c58, slabs: 1, stains: 1 }), contFloor: pm('ceramicTile', { color: 0xd8dade, grout: 0x8a9098, count: 1, gloss: 0.8, variation: 0.05 }),
    moss: pm('moss', { color: 0x4a5a2a }), rust: pm('rust', { color: 0x5a3018, paint: 0x3d4a52, amount: 0.85 }), ruin: pm('concrete', { color: 0x7a766e, formwork: 1, stains: 1 }),
    paving: pm('ceramicTile', { color: 0x4a4e54, grout: 0x2a2c30, count: 1, gloss: 0.6, variation: 0.1 }), lobby: pm('ceramicTile', { color: 0xc8ccd0, grout: 0x8a8e94, count: 1, gloss: 0.85, variation: 0.06 }),
    helixWall: pm('paintedMetalPanel', { color: 0x3a4048, cols: 4, rows: 2, wear: 0.02, grime: 0.05, gloss: 0.5 }), lobbyWall: pm('paintedMetalPanel', { color: 0xb4bac2, cols: 3, rows: 2, wear: 0.01, grime: 0.04, gloss: 0.7 }), steel: pm('brushedMetal', { color: 0x9a9ea0, roughness: 0.35 }),
    concrete26: pm('concrete', { color: 0x9a968e, formwork: 1, stains: 0 }), dirt: pm('dirt', {}), wood: pm('wood', { color: 0x8a6a44 }),
    sand: pm('paintedMetalPanel', { color: 0x6a5a40, cols: 1, rows: 1, wear: 0.6, grime: 0.6, gloss: 0.1 }), tarp: pm('paintedMetalPanel', { color: 0x5a3a28, cols: 1, rows: 1, wear: 0.5, grime: 0.5, gloss: 0.1 }),
    yellow: pm('paintedMetalPanel', { color: 0xd8b020, cols: 1, rows: 2, wear: 0.3, grime: 0.3, gloss: 0.4 }), planter: pm('concrete', { color: 0x5a5c60, slabs: 0, stains: 0 }),
  };
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.06, metalness: 0.4, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide });
  const gold = glowMat(0xffd27a, 2.2), cyan = glowMat(0x5fe6ff, 2.0), white = glowMat(0xf2f6ff, 1.6), amber = glowMat(0xffa040, 1.8), red = glowMat(0xff4d5e, 2.0);
  W.mats = { gold, cyan, glass };
  const E3 = ['2196', '2049', '2026'];

  // ================= ground and the boundary =================
  box(-60, -1, -70, 60, 0, 62); box(-60, -1, -120, 60, 0, -82); box(-7.5, -1, -76, 7.5, 0, -70); box(-60, -1, -76, -22, 0, -70); box(22, -1, -76, 60, 0, -70); box(-60, -1, -82, -22, 0, -76); box(22, -1, -82, 60, 0, -76);
  for (const [x0, z0, x1, z1] of [[-21, 62, 21, 63], [-22, -97, 22, -96]]) box(x0, 0, z0, x1, 10, z1);
  box(-21, 0, 12, -20, 10, 62); box(20, 0, 12, 21, 10, 62);          // the avenue's edges (ruins / Helix plaza walls)
  for (const sx of [-1, 1]) {
    solid(M.pearl, sx * 20 - 0.5, 0, -15, sx * 20 + 0.5, 7, 10, '2196'); bat('2196').box(gold, sx * 20 - 0.52, 6.9, -15, sx * 20 + 0.52, 7.0, 10);    // the yard's side walls
    solid(M.helixWall, sx * 20 - 0.4, 0, -15, sx * 20 + 0.4, 3.2, 12.5, '2049');                                                        // Helix forecourt walls
    box(sx * 20 - 0.5, 0, -15, sx * 20 + 0.5, 10, 12.5, '2026');
    for (let z = 14; z < 62; z += 3.2) bat('2196').geo(M.ruin, new THREE.DodecahedronGeometry(0.7 + R() * 0.9, 0), [sx * (20.4 + R() * 0.8), 0.3, z + R() * 2], [R(), R(), R()]);
    bat('2049').box(M.steel, sx * 20.4 - 0.05, 0, 13, sx * 20.4 + 0.05, 1.1, 62); bat('2049').box(M.steel, sx * 20.4 - 0.08, 1.05, 13, sx * 20.4 + 0.08, 1.12, 62);
    for (let z = 14; z < 62; z += 2) bat('2049').box(M.steel, sx * 20.4 - 0.04, 0, z - 0.04, sx * 20.4 + 0.04, 1.1, z + 0.04);
  }
  ground(M.floor96, -60, -14, 60, 62, 0.01, '2196'); ground(M.paving, -60, -14, 60, 62, 0.01, '2049');
  ground(M.contFloor, -14, -15, 14, -40, 0.02, '2196'); ground(M.lobby, -14, -15, 14, -40, 0.02, '2049');
  ground(M.contFloor, -22, -46, 22, -70, 0.02, '2196'); ground(M.contFloor, -7.5, -70, 7.5, -76, 0.02, '2196'); ground(M.lobby, -22, -46, 22, -76, 0.02, '2049'); ground(M.concrete26, -22, -46, 22, -76, 0.02, '2026');
  ground(M.contFloor, -22, -82, 22, -96, 0.02, '2196'); ground(M.lobby, -22, -82, 22, -96, 0.02, '2049'); ground(M.concrete26, -22, -82, 22, -96, 0.02, '2026');
  ground(M.contFloor, -3, -40, 3, -46, 0.02, '2196'); ground(M.lobby, -3, -40, 3, -46, 0.02, '2049');

  // ================= 2196: the forward post, the Approach and the Bastion wall =================
  // sandbag barricade (gap at the centre), a burnt tram, tarps, a fire barrel, rust-orange cloth
  for (const [x0, x1] of [[-20, -2.4], [2.4, 20]]) solid(M.sand, x0, 0, 33.6, x1, 1.2, 34.6, '2196');
  for (let x = -19; x < 19; x += 1.6) if (Math.abs(x) > 2.6) bat('2196').geo(M.sand, new THREE.BoxGeometry(1.5, 0.4, 0.9), [x, 1.4, 34.1], [0, (R() - 0.5) * 0.2, 0]);
  solid(M.rust, -19.6, 0, 26, -15.4, 3.2, 36, '2196');               // the burnt tram (open at the side for the shard)
  bat('2196').geo(M.rust, new THREE.BoxGeometry(4.6, 0.3, 10.6), [-17.5, 3.3, 31], [0, 0, 0.04]);
  bat('2196').geo(M.tarp, new THREE.BoxGeometry(6, 0.06, 4), [-2, 2.8, 41], [0.18, 0, 0]); for (const [x, z] of [[-5, 39.2], [1, 39.2], [-5, 42.8], [1, 42.8]]) bat('2196').cyl(M.rust, x, 1.4, z, 0.06, 2.8, 6);
  bat('2196').cyl(M.rust, 2.6, 0.45, 40.6, 0.32, 0.9, 12); box(2.3, 0, 40.3, 2.9, 0.9, 40.9, '2196');
  const fire = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), amber); fire.position.set(2.6, 1.0, 40.6); fire.userData.noBatch = true; add(fire, '2196'); W.fire = fire;
  src(2.6, 1.4, 40.6, 0xffa050, 4, 9, '2196');
  for (const [x, z] of [[-8, 35.2], [9, 35.2]]) { bat('2196').cyl(M.rust, x, 2.2, z, 0.05, 4.4, 6); const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ color: 0xc8552a, roughness: 0.9, side: THREE.DoubleSide })); fl.position.set(x + 0.62, 4.0, z); add(fl, '2196'); }
  // the wall: no gaps; a sealed gate, two searchlight towers
  solid(M.pearl, -20, 0, 10, -3.2, 7, 12, '2196'); solid(M.pearl, 3.2, 0, 10, 20, 7, 12, '2196');
  W.gateMesh = new THREE.Mesh(new THREE.BoxGeometry(6.4, 6.4, 1.2), M.graphite); W.gateMesh.position.set(0, 3.2, 11); W.gateMesh.userData.noBatch = true; add(W.gateMesh, '2196'); box(-3.2, 0, 10.2, 3.2, 7, 11.8, '2196');
  for (let x = -19; x <= 19; x += 4.2) bat('2196').box(gold, x - 0.04, 0.6, 12.02, x + 0.04, 6.6, 12.05);
  bat('2196').box(gold, -20, 6.9, 12.02, 20, 7.0, 12.06);
  W.searchlights = [];
  for (const s of [-1, 1]) {
    solid(M.pearl, s * 12 - 0.8, 0, 9.2, s * 12 + 0.8, 10, 10.8, '2196'); bat('2196').box(M.graphite, s * 12 - 1.1, 10, 8.9, s * 12 + 1.1, 10.6, 11.1);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(3.2, 18, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    beam.geometry.translate(0, -9, 0); beam.position.set(s * 12, 10.6, 10); beam.userData.noBatch = true; add(beam, '2196'); W.searchlights.push(beam);
  }
  const emb = plane(TEX.emblem(), 4.2, 4.2, 0, 9.2, 12.08, 0, 0.6, '2196'); emb.material.alphaTest = 0.2;
  // the Bastion's mass rising behind the wall (exterior shell of the Register and the Proving Floor) and its spire
  solid(M.pearl, -16, 9, -14, 16, 26, -40.6, '2196'); solid(M.helixWall, -16, 9, -14, 16, 30, -40.6, '2049');
  for (let y = 10.2; y < 29; y += 1.6) bat('2049').box(white, -15.6, y, -13.97, 15.6, y + 0.5, -13.93);
  for (let y = 10.2; y < 29; y += 1.6) for (const s of [-1, 1]) bat('2049').box(white, s * 16 - 0.03 * s, y, -40, s * 16 + 0.03 * s, y + 0.5, -14.6);
  for (const [x0, z0, x1, z1] of [[-24, -44, -16, -98], [16, -44, 24, -98], [-16, -44, 16, -52], [-16, -90, 16, -98]]) bat('2196').box(M.pearl, x0, 22, z0, x1, 24, z1);   // the arena's roof ring, open to the storm
  bat('2196').box(M.pearl, -15, 26, -16, 15, 28, -38); bat('2196').cyl(M.pearl, 0, 48, -27, 4.0, 40, 24, [0, 0, 0], 7.5);
  for (let k = 0; k < 4; k++) bat('2196').geo(gold, new THREE.TorusGeometry(6.4 - k * 0.8, 0.16, 6, 40), [0, 34 + k * 8, -27], [PI / 2, 0, 0]);
  // the Bastion's skin: gold bands and dark slit windows on the south face, buttresses on the wall, the spire's crown
  for (const y of [12.2, 17.4, 22.6]) bat('2196').box(gold, -16, y, -13.96, 16, y + 0.12, -13.9);
  for (let x = -14.5; x <= 14.5; x += 2.9) for (const y of [13.2, 18.4, 23.4]) bat('2196').box(M.graphite, x - 0.35, y, -13.98, x + 0.35, y + 3.4, -13.92);
  for (let x = -18; x <= 18; x += 6) if (Math.abs(x) > 4) { bat('2196').box(M.pearlDark, x - 0.5, 0, 12, x + 0.5, 7.4, 12.5); bat('2196').box(M.pearlDark, x - 0.5, 0, 9.5, x + 0.5, 7.4, 10); }
  bat('2196').box(M.pearlDark, -20.3, 7, 9.7, 20.3, 7.5, 12.3);
  for (const s of [-1, 1]) for (let z = -48; z >= -94; z -= 7.6) bat('2196').box(M.pearlDark, s * 22.6 - 0.4, 0, z - 0.6, s * 22.6 + 0.4, 23, z + 0.6);
  for (const s of [-1, 1]) for (let z = -50; z >= -92; z -= 7.6) for (const y of [8, 14]) bat('2196').box(M.graphite, s * 22.62 - 0.03, y, z - 0.25 - 2.6, s * 22.62 + 0.03, y + 4, z + 0.25 - 2.6);
  bat('2196').geo(gold, new THREE.TorusGeometry(4.3, 0.22, 8, 40), [0, 68.4, -27], [PI / 2, 0, 0]); bat('2196').cyl(M.pearl, 0, 72, -27, 0.3, 8, 10, [0, 0, 0], 2.2);
  { const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), glowMat(0xffd27a, 3.0)); beacon.position.set(0, 76.6, -27); beacon.userData.noBatch = true; add(beacon, '2196'); }
  // the old Helix tower the Bastion grew on: a ruined concrete core rising behind the spire
  try { const core = RZ.cityBlock([{ width: 18, depth: 14, height: 46, position: [-30, 0, -78], seed: 2141, wall: 'concrete', ruin: 0.85, collapse: true, moss: 0.4, faces: ['windows', 'windows', 'windows', 'windows'], groundBlank: true }, { width: 16, depth: 16, height: 34, position: [32, 0, -66], seed: 2142, wall: 'concrete', ruin: 0.7, moss: 0.35, faces: ['windows', 'windows', 'windows', 'windows'], groundBlank: true }], { era: '2196', lit: 0.0, daylight: 0.45, detail: low ? 'low' : undefined }); core.mesh.castShadow = false; add(core.mesh, '2196'); } catch (err) { console.warn('m21 core', err); }
  // the facade of the Bastion (z -14) with its door
  for (const e of ['2196', '2049']) { solid(e === '2196' ? M.pearl : M.helixWall, -20, 0, -15, -2.2, 9, -14, e); solid(e === '2196' ? M.pearl : M.helixWall, 2.2, 0, -15, 20, 9, -14, e); bat(e).box(e === '2196' ? M.pearl : M.helixWall, -2.2, 6.2, -15, 2.2, 9, -14); }
  W.door = new THREE.Mesh(new THREE.BoxGeometry(4.4, 6.2, 0.4), M.graphite); W.door.position.set(0, 3.1, -14.5); W.door.userData.noBatch = true; add(W.door, '2196');
  W.doorBox = box(-2.2, 0, -15, 2.2, 6.2, -14, '2196');
  W.door49 = box(-2.2, 0, -15, 2.2, 6.2, -14, '2049');
  bat('2049').geo(glass, new THREE.BoxGeometry(4.4, 6.2, 0.1), [0, 3.1, -14.5]);
  W.doorReader = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.08), red.clone()); W.doorReader.position.set(2.7, 1.4, -13.92); W.doorReader.userData.noBatch = true; add(W.doorReader, '2196');
  for (const x of [-12, -6, 6, 12]) { const b = plane(TEX.banner(), 1.6, 4.8, x, 5.2, -13.94, 0, 0.12, '2196'); void b; }
  // the muster yard: supply pods (cover), a parked transport, light masts
  for (const [x, z, w, d, h] of COVER) { solid(M.pearlDark, x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, '2196'); bat('2196').box(gold, x - w / 2 - 0.01, h - 0.18, z - d / 2 - 0.01, x + w / 2 + 0.01, h - 0.12, z + d / 2 + 0.01); }
  solid(M.pearl, -18.6, 0, -2, -15.6, 2.6, 6, '2196'); bat('2196').box(M.graphite, -18.4, 1.4, 6, -15.8, 2.2, 6.06); bat('2196').box(gold, -18.6, 0.3, -2.02, -15.6, 0.4, 6.02);
  for (const [x, z] of [[-10, -12], [10, -12], [-10, 8], [10, 8]]) { bat('2196').cyl(M.graphite, x, 3, z, 0.12, 6, 8); bat('2196').box(white, x - 0.5, 5.9, z - 0.2, x + 0.5, 6.1, z + 0.2); src(x, 5.6, z, 0xfff2d8, 3.2, 12, '2196'); }

  // ================= 2049: Helix plaza, the fence and the dock gap, the forecourt =================
  for (const [x0, x1] of [[-20, 12], [16, 20]]) { solid(M.steel, x0, 0, 12.5, x1, 0.4, 12.9, '2049'); bat('2049').geo(glass, new THREE.BoxGeometry(x1 - x0, 2.2, 0.06), [(x0 + x1) / 2, 1.5, 12.7]); box(x0, 0.4, 12.5, x1, 2.6, 12.9, '2049'); for (let x = x0; x <= x1; x += 2) bat('2049').box(M.steel, x - 0.05, 0, 12.6, x + 0.05, 2.7, 12.8); }
  bat('2049').box(M.yellow, 12, 1.0, 12.6, 16, 1.12, 12.8);   // the dock barrier arm (raised clear above head height on the right post)
  bat('2049').box(M.steel, 11.85, 0, 12.55, 12.15, 1.2, 12.85);
  solid(M.helixWall, 16.8, 0, 14.4, 19.6, 2.8, 17.4, '2049'); bat('2049').geo(glass, new THREE.BoxGeometry(2.6, 1.2, 0.05), [18.2, 1.8, 14.38]); src(18.2, 2.4, 15.9, 0xc8e8ff, 2.2, 7, '2049');
  // the camera on its post: a sweeping cone over the gap
  bat('2049').cyl(M.steel, P.camera[0], P.camera[1] / 2, P.camera[2], 0.08, P.camera[1], 8);
  W.cam = new THREE.Group(); W.cam.position.set(...P.camera); add(W.cam, '2049');
  { const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.42), M.helixWall); head.position.z = 0.1; W.cam.add(head); const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), red); led.position.set(0, 0.05, 0.33); W.cam.add(led); }
  W.camCone = new THREE.Mesh(new THREE.ConeGeometry(2.1, 5.2, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xff6a6a, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  W.camCone.geometry.translate(0, -2.6, 0); W.camCone.position.set(...P.camera); W.camCone.userData.noBatch = true; add(W.camCone, '2049');
  // the HELIX monolith, planters, benches, lamps
  solid(M.helixWall, -1.6, 0, 24.6, 1.6, 4.2, 25.6, '2049'); plane(TEX.helix(), 3.0, 0.75, 0, 3.2, 25.62, 0, 0.9, '2049'); plane(TEX.helix(), 3.0, 0.75, 0, 3.2, 24.58, PI, 0.9, '2049');
  for (const [x, z] of [[-9, 28], [9, 28], [-9, 20], [9, 20], [-8, 2], [8, 0], [-3, -7], [4, -9]]) { solid(M.planter, x - 1.2, 0, z - 1.2, x + 1.2, 0.8, z + 1.2, '2049'); bat('2049').geo(M.moss, new THREE.SphereGeometry(1.0, 10, 6), [x, 0.85, z], [0, 0, 0], [1.1, 0.5, 1.1]); }
  for (const [x, z] of [[-14, 30], [14, 30], [-14, 18], [14, 22], [-14, 4], [14, 4], [-14, -8], [14, -8]]) { try { const lp = lampPost(0xcfe6ff, 6.2, { era: '2049' }); lp.position.set(x, 0, z); lp.rotation.y = x < 0 ? PI / 2 : -PI / 2; add(lp, '2049'); } catch (err) { void err; } src(x, 5.8, z, 0xcfe6ff, 2.4, 11, '2049'); }
  // the Helix HQ front: glass and panel, a lit lobby behind it; the sign above the doors
  for (let x = -19; x <= 19; x += 2.4) if (Math.abs(x) > 2.4) bat('2049').box(white, x - 0.9, 0.6, -13.95, x + 0.9, 0.66, -13.93);
  plane(TEX.helix(), 6.4, 1.6, 0, 7.4, -13.9, 0, 1.0, '2049');

  // ================= 2196 / 2049: the Register (the Hall of Fixed Points / the Helix lobby) =================
  for (const e of ['2196', '2049']) {
    const m = e === '2196' ? M.pearl : M.lobbyWall;
    solid(m, -14.6, 0, -40, -14, 9, -15, e); solid(m, 14, 0, -40, 14.6, 9, -15, e);
    solid(m, -14.6, 0, -41, -2.2, 9, -40, e); solid(m, 2.2, 0, -41, 14.6, 9, -40, e); bat(e).box(m, -2.2, 6, -41, 2.2, 9, -40);
    bat(e).box(m, -14.6, 9, -41, 14.6, 9.4, -14);
    solid(m, -3.6, 0, -46, -3, 6, -41, e); solid(m, 3, 0, -46, 3.6, 6, -41, e); bat(e).box(m, -3.6, 6, -46, 3.6, 6.4, -41);
  }
  W.regDoor = new THREE.Mesh(new THREE.BoxGeometry(4.4, 6, 0.4), M.graphite); W.regDoor.position.set(0, 3, -40.5); W.regDoor.userData.noBatch = true; add(W.regDoor, '2196');
  W.regDoorBox = box(-2.2, 0, -41, 2.2, 6, -40, '2196');
  bat('2049').box(M.steel, -2.2, 0, -40.6, 2.2, 6, -40.4); box(-2.2, 0, -41, 2.2, 6, -40, '2049');      // the atrium shutter: lockdown
  plane(signTex('m21shut', [['ATRIUM CLOSED', 34, '#ffd34a'], ['SECURITY LOCKDOWN · 2049', 22, '#e8eef0']], { bg: '#1a1e22', border: '#ffd34a', h: 160 }), 2.4, 0.8, 0, 2.2, -40.32, 0, 0.6, '2049');
  // 2196: rows of plinths with fixed-point screens, gold floor lines, the alcove
  W.plinths = [];
  for (const x of [-6, 6]) for (const z of [-20, -26, -32]) {
    solid(M.pearlDark, x - 1.2, 0, z - 0.5, x + 1.2, 1.1, z + 0.5, '2196');
    const scr = plane(contTex('fp' + x + z, 'FIXED POINT ' + (4100 + Math.abs(x * 13 + z * 7)), ['!Corrected: ' + ['Harrow Reach', 'Sable Yards', 'Meridian', 'Block D4', 'Lantern Hall', 'Corran Bldg'][(Math.abs(x + z * 3)) % 6], 'Variance: closed', 'Witnesses: 0']), 1.9, 1.2, x, 2.0, z, 0, 0.6, '2196');
    scr.material.side = THREE.DoubleSide; W.plinths.push(scr);
  }
  for (const x of [-10, -3.5, 3.5, 10]) bat('2196').box(gold, x - 0.04, 0.03, -39.5, x + 0.04, 0.05, -15.5);
  solid(M.pearl, 10.6, 0, -39, 14, 3.2, -38.8, '2196'); W.alcove = box(10.6, 0, -36, 14, 3.2, -35.8, '2196');   // the sealed alcove (a pearl shutter)
  W.alcoveMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 0.2), M.graphite); W.alcoveMesh.position.set(12.3, 1.6, -35.9); W.alcoveMesh.userData.noBatch = true; add(W.alcoveMesh, '2196');
  // the archivist's desk and the Register book
  solid(M.graphite, -12.6, 0, -36.4, -8.4, 0.95, -34.8, '2196'); plane(contTex('regbook', 'THE REGISTER · VOL. XIX', ['VAREN, K. — versions met: 17', 'Status: unresolved', '!Instruction: close at the Last Lock'], { h: 256 }), 1.2, 0.6, -10.4, 1.25, -35.4, 0, 0.4, '2196').rotation.x = -1.0;
  // stasis pods ("held as fixed points")
  W.pods = P.pods.map(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); add(g, '2196');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 8, 30), gold.clone()); ring.rotation.x = PI / 2; ring.position.y = 0.1; g.add(ring);
    const top = ring.clone(); top.position.y = 2.2; g.add(top);
    const field = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.1, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    field.position.y = 1.15; g.add(field);
    const lab = plane(contTex('pod' + i, 'HELD · FIXED POINT', [['0412-A', '0907-C', '1046-F'][i], 'Anchor socket: ' + ['L-3', 'L-5', 'L-1'][i], 'Release: never'], { h: 220, fs: 20 }), 0.9, 0.42, x + (x < 0 ? 1.0 : -1.0), 1.5, z, x < 0 ? PI / 2 : -PI / 2, 0.5, '2196');
    box(x - 0.9, 0, z - 0.9, x + 0.9, 2.3, z + 0.9, '2196');
    return { g, field, ring, top, lab, socket: ['L-3', 'L-5', 'L-1'][i], open: false };
  });
  // 2049: the lobby: reception desk, lift doors, the floor service panel with six sockets, Rook's memo
  solid(M.helixWall, -3.6, 0, -25.2, 3.6, 1.1, -23.8, '2049'); bat('2049').box(cyan, -3.6, 1.1, -23.82, 3.6, 1.14, -23.78);
  for (const x of [-9, -4, 4, 9]) { bat('2049').box(M.steel, x - 1.2, 0, -39.95, x + 1.2, 3.2, -39.85); bat('2049').box(white, x - 0.1, 3.4, -39.9, x + 0.1, 3.5, -39.84); }
  plane(TEX.helix(), 6.0, 1.5, 0, 5.4, -39.86, 0, 0.9, '2049');
  solid(M.helixWall, P.panel49[0], 0, P.panel49[2] - 1.4, P.panel49[0] + 1.2, 1.6, P.panel49[2] + 1.4, '2049');
  W.sockets = []; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.3), cyan.clone()); s.position.set(P.panel49[0] - 0.02, 1.2, P.panel49[2] - 1.0 + i * 0.4); s.userData.noBatch = true; add(s, '2049'); W.sockets.push(s); }
  plane(signTex('m21sockets', [['LOBBY FLOOR SERVICES', 26, '#0a2a3a'], ['L-1  L-2  L-3  L-4  L-5  L-6', 22, '#2a4a5a']], { bg: '#e8f4f8', h: 128, grain: false }), 1.0, 0.25, P.panel49[0] - 0.03, 1.48, P.panel49[2], -PI / 2, 0.4, '2049');
  for (const z of [-17, -21, -25, -29, -33, -37]) for (const x of [-9, 0, 9]) bat('2049').box(white, x - 1.6, 8.9, z - 0.2, x + 1.6, 8.96, z + 0.2);
  for (const z of [-19, -27, -35]) for (const x of [-9, 9]) src(x, 7.5, z, 0xeaf4ff, 4.0, 14, '2049');
  for (const z of [-20, -32]) for (const x of [-6, 6]) src(x, 4, z, 0xffd8a0, 2.4, 10, '2196');

  // ================= the Proving Floor / the Grand Atrium / the site =================
  for (const e of E3) {
    const m = e === '2196' ? M.pearl : e === '2049' ? M.lobbyWall : M.concrete26, h = e === '2026' ? 12 : 22;
    solid(m, -22.6, 0, -97, -22, h, -46, e); solid(m, 22, 0, -97, 22.6, h, -46, e);
    solid(m, -22.6, 0, -46.6, -3.6, h, -46, e); solid(m, 3.6, 0, -46.6, 22.6, h, -46, e); bat(e).box(m, -3.6, 6.4, -46.6, 3.6, h, -46);
    solid(m, -22.6, 0, -97, 22.6, h, -96, e);
  }
  // the four columns (Helix concrete in 2049, Continuum-clad in 2196, bare steel in 2026)
  for (const [nm, [x, z]] of Object.entries(P.cols)) {
    bat('2196').cyl(M.pearl, x, 11, z, 1.1, 22, 20); bat('2196').geo(gold, new THREE.TorusGeometry(1.14, 0.05, 6, 24), [x, 2.2, z], [PI / 2, 0, 0]);
    bat('2049').cyl(M.helixWall, x, 11, z, 1.0, 22, 20); bat('2049').cyl(M.steel, x, 0.6, z, 1.4, 1.2, 20);
    bat('2026').box(M.rust, x - 0.35, 0, z - 0.35, x + 0.35, 12, z + 0.35);
    box(x - 1.1, 0, z - 1.1, x + 1.1, 22, z + 1.1);
    plane(signTex('m21col' + nm, [[nm, 60, '#ffd27a']], { bg: '#202328', h: 128, w: 256 }), 0.7, 0.35, x + (x < 0 ? 1.16 : -1.16), 3.0, z, x < 0 ? PI / 2 : -PI / 2, 0.6, '2196');
    plane(signTex('m21dmp' + nm, [['SEISMIC DAMPER ' + nm, 22, '#0a2a3a'], [nm === 'N2' ? 'MODE: MAINTENANCE (OPEN)' : 'MODE: LOCKED', 20, nm === 'N2' ? '#b84a20' : '#2a6a3a']], { bg: '#e8f4f8', h: 128, grain: false }), 1.0, 0.25, x + (x < 0 ? 1.42 : -1.42), 0.8, z, x < 0 ? PI / 2 : -PI / 2, 0.4, '2049');
  }
  W.dmpN2 = null;
  plane(contTex('survey', 'SURVEY · COLUMN N2', ['Load: 140 % of rated', 'Base shear: progressing', '!Cause: damper failed open (2049)', 'Recommendation: none possible'], { h: 256 }), 0.95, 0.48, P.plateN2[0] + 0.4, 1.6, P.plateN2[2] - 0.45, -PI * 0.75, 0.5, '2196');
  // arena cover (2196) and atrium planters / benches (2049)
  for (const [x, z, w, d, h] of ARENA_COVER) { solid(M.pearlDark, x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, '2196'); bat('2196').box(gold, x - w / 2 - 0.01, h - 0.16, z - d / 2 - 0.01, x + w / 2 + 0.01, h - 0.1, z + d / 2 + 0.01); }
  for (const [x, z] of [[-8, -60], [8, -64], [-14, -56], [14, -58]]) { solid(M.planter, x - 1.3, 0, z - 0.6, x + 1.3, 0.55, z + 0.6, '2049'); bat('2049').geo(M.moss, new THREE.SphereGeometry(0.8, 10, 6), [x, 0.6, z], [0, 0, 0], [1.4, 0.5, 0.6]); }
  solid(M.planter, -21, 0, -50, -19.2, 0.6, -47, '2049');
  // the Proving Floor's inlay (2196): gold rings and spokes around the centre; the Helix medallion (2049)
  for (const r of [7, 13.5]) bat('2196').geo(gold, new THREE.RingGeometry(r - 0.07, r + 0.07, 64), [0, 0.035, -61], [-PI / 2, 0, 0]);
  for (let k = 0; k < 12; k++) { const a = k * PI / 6; bat('2196').geo(gold, new THREE.PlaneGeometry(0.1, 6.5), [Math.sin(a) * 10.25, 0.034, -61 + Math.cos(a) * 10.25], [-PI / 2, 0, a]); }
  bat('2049').geo(cyan, new THREE.RingGeometry(5.6, 5.8, 64), [0, 0.035, -61], [-PI / 2, 0, 0]); bat('2049').geo(M.steel, new THREE.CircleGeometry(5.6, 48), [0, 0.03, -61], [-PI / 2, 0, 0]);
  for (const [x, z] of [[-4, -50], [4, -50], [-17, -66], [17, -70]]) { solid(M.steel, x - 1.0, 0, z - 0.3, x + 1.0, 0.45, z + 0.3, '2049'); }
  // the chasm edge: a gold safety strip (2196), hazard barriers (2026, open at the set-out)
  bat('2196').box(gold, -22, 0.03, -76.1, 22, 0.05, -75.9); bat('2196').box(gold, -22, 0.03, -82.1, 22, 0.05, -81.9);
  for (const [x0, x1] of [[-22, -2.6], [2.6, 22]]) { bat('2026').box(M.yellow, x0, 0.9, -75.7, x1, 1.0, -75.6); for (let x = x0; x <= x1; x += 2.4) bat('2026').box(M.graphite, x - 0.04, 0, -75.7, x + 0.04, 1.0, -75.6); box(x0, 0, -75.75, x1, 1.0, -75.55, '2026'); }
  solid(M.yellow, 10.4, 0, -51.4, 13.6, 2.6, -48.6, '2026'); bat('2026').box(M.graphite, 11, 1.2, -48.58, 12.6, 2.0, -48.54);   // the site cabin
  for (let i = 0; i < 6; i++) bat('2026').cyl(M.rust, -16 + (i % 3) * 0.2, 0.12 + Math.floor(i / 3) * 0.2, -82.6 + (i % 3) * 0.0, 0.08, 5, 6, [PI / 2, 0, PI / 2]);
  // the 2196 gallery tiers on the side walls, gold lines, the open roof and the storm
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) bat('2196').box(M.pearlDark, s * 22 - s * (1.2 + k * 0.6), 6 + k * 4, -94, s * 22, 6.4 + k * 4, -48);
  for (let z = -50; z >= -92; z -= 6) for (const s of [-1, 1]) bat('2196').box(gold, s * 21.96 - 0.02, 1, z - 0.04, s * 21.96 + 0.02, 18, z + 0.04);
  for (const x of [-16, -8, 8, 16]) { plane(TEX.banner(), 2.0, 6.0, x, 12, -95.9, 0, 0.12, '2196'); }
  plane(TEX.emblem(), 6, 6, 0, 15, -95.9, 0, 0.7, '2196').material.alphaTest = 0.2;
  // 2049: the glass roof frame and the atrium lights; 2026: the steel frame, scaffolds, formwork
  for (let z = -50; z >= -94; z -= 4) bat('2049').box(M.steel, -22, 21.6, z - 0.1, 22, 21.8, z + 0.1);
  for (let x = -20; x <= 20; x += 8) for (let z = -52; z >= -92; z -= 10) bat('2049').box(white, x - 1.4, 21.2, z - 0.15, x + 1.4, 21.3, z + 0.15);
  for (let x = -18; x <= 18; x += 6) bat('2026').box(M.rust, x - 0.12, 11.6, -96, x + 0.12, 12, -46);
  for (const z of [-48, -94]) bat('2026').box(M.rust, -22, 11.6, z - 0.12, 22, 12, z + 0.12);
  for (let i = 0; i < 8; i++) { const x = -19 + i * 5.4; bat('2026').box(M.wood, x - 1.2, 0, -94.8, x + 1.2, 0.6 + (i % 3) * 0.3, -93.2); }
  solid(M.wood, 17.6, 0, -92, 21.4, 1.4, -88.6, '2026');   // stacked formwork (the shard behind it)
  for (const [x, z] of [[-20, -86], [20, -54]]) { for (let y = 0; y < 3; y++) bat('2026').box(M.yellow, x - 1.2, y * 2 + 1.9, z - 1.2, x + 1.2, y * 2 + 2.0, z + 1.2); for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) bat('2026').box(M.yellow, x + dx - 0.05, 0, z + dz - 0.05, x + dx + 0.05, 6, z + dz + 0.05); }
  src(-12, 10, -60, 0xfff2e0, 3.0, 26, '2026'); src(12, 10, -86, 0xfff2e0, 3.0, 26, '2026');
  for (const [x, z] of [[-12, -56], [12, -56], [-12, -88], [12, -88]]) { src(x, 12, z, 0xffe0b8, 3.4, 20, '2196'); src(x, 18, z, 0xeaf4ff, 3.0, 22, '2049'); }

  // ================= the chasm: a light-bridge (2196), the skybridge (2049, closed), the excavation (2026) =================
  for (const e of E3) {
    const m = e === '2196' ? M.ruin : e === '2049' ? M.helixWall : M.dirt, y = e === '2196' ? -12 : -6;
    bat(e).box(m, -22, y - 0.5, -82, 22, y, -76);
    bat(e).box(m, -22, y, -76.2, 22, 0, -76); bat(e).box(m, -22, y, -82, 22, 0, -81.8);
  }
  bat('2196').geo(glowMat(0xff6a28, 0.45), new THREE.PlaneGeometry(40, 3), [0, -11.7, -79], [-PI / 2, 0, 0]);   // the charges still burning far below
  for (let x = -18; x <= 18; x += 6) bat('2049').box(white, x - 1.6, -5.95, -79.2, x + 1.6, -5.9, -78.8);
  src(0, -6, -79, 0xffa050, 3.5, 16, '2196');
  for (let i = 0; i < 14; i++) bat('2196').geo(M.ruin, new THREE.DodecahedronGeometry(0.6 + R() * 1.2, 0), [(R() - 0.5) * 40, -11.4, -79 + (R() - 0.5) * 4], [R(), R(), R()]);
  for (const [x0, x1] of [[-22, -2.2], [2.2, 22]]) for (const z of [-76.1, -81.9]) { bat('2049').geo(glass, new THREE.BoxGeometry(x1 - x0, 1.1, 0.04), [(x0 + x1) / 2, 0.55, z]); bat('2049').box(M.steel, x0, 1.08, z - 0.04, x1, 1.14, z + 0.04); }
  for (const z of [-76.1, -81.9]) box(-22, 0, z - 0.06, 22, 1.1, z + 0.06, '2049');    // the balustrades (the skybridge doors are shut)
  bat('2049').geo(glass, new THREE.BoxGeometry(4.4, 0.12, 6), [0, -0.06, -79]); for (const s of [-1, 1]) bat('2049').geo(glass, new THREE.BoxGeometry(0.04, 1.1, 6), [s * 2.2, 0.55, -79]);
  plane(signTex('m21sky', [['SKYBRIDGE CLOSED', 30, '#ffd34a'], ['LOCKDOWN · 2049', 20, '#e8eef0']], { bg: '#1a1e22', border: '#ffd34a', h: 140 }), 2.0, 0.6, 0, 1.6, -75.96, 0, 0.6, '2049');
  W.plaque49 = plane(signTex('m21plaque', [['HELIX GRAND ATRIUM', 26, '#2a2a2a'], ['Skybridge carried on transfer beam TB-7,', 18, '#3a3a3a'], ['set by hand 21.10.2026', 18, '#3a3a3a'], ['Architects: Marrow & Quay', 16, '#5a5a5a']], { bg: '#c8b890', h: 200, grain: true }), 1.1, 0.42, P.plaque49[0], 1.25, P.plaque49[2] + 0.5, 0, 0.25, '2049');
  bat('2049').box(M.steel, P.plaque49[0] - 0.6, 0, P.plaque49[2] + 0.4, P.plaque49[0] + 0.6, 1.0, P.plaque49[2] + 0.5);
  // the Continuum light-bridge (falls in the collapse)
  W.lightBridge = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.25, 6.2), new THREE.MeshStandardMaterial({ color: 0x2a2416, emissive: 0xffd27a, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.85 }));
  W.lightBridge.position.set(0, -0.12, -79); W.lightBridge.userData.noBatch = true; add(W.lightBridge, '2196');
  W.lightBridgeBox = box(-2, -0.3, -82.1, 2, 0, -75.9, '2196');
  // the beam seats (both edges), stamped TB-7 (2196: empty, rusted brackets)
  for (const z of [-76.4, -81.6]) { bat('2196').box(M.rust, -0.9, -0.6, z - 0.4, 0.9, -0.05, z + 0.4); bat('2026').box(M.steel, -0.9, -0.6, z - 0.4, 0.9, -0.05, z + 0.4); }
  plane(signTex('m21seat', [['TB-7', 46, '#d8c8a8']], { bg: '#4a3020', h: 128, w: 256, wear: 0.6 }), 0.5, 0.25, 0, -0.3, -75.98, 0, 0.2, '2196');
  // the transfer beam: on the crane hook in 2026, a rusted span in 2196 once it has been set
  W.beam26 = new THREE.Group(); add(W.beam26, '2026');
  { const web = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 6.6), M.rust); web.position.y = 0.3; const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 6.6), M.rust); f1.position.y = 0.6; const f2 = f1.clone(); f2.position.y = 0.0; W.beam26.add(web, f1, f2);
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.4, 4), M.steel); c.position.set(0, 2.3, s * 2.4); c.rotation.x = s * 0.5; W.beam26.add(c); } }
  W.beam26.position.set(8, 4.0, -79);
  W.hook = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), M.steel); W.hook.userData.noBatch = true; add(W.hook, '2026');
  W.beam96 = new THREE.Group(); add(W.beam96); W.beam96.visible = false;   // shown by the mission once TB-7 is set (2196 only)
  { const web = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 6.6), M.rust); web.position.y = -0.36; const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.07, 6.6), M.rust); f1.position.y = -0.04; const f2 = f1.clone(); f2.position.y = -0.66; W.beam96.add(web, f1, f2); }
  W.beam96.position.set(0, 0.07, -79);
  W.beamBox = box(-0.42, -0.4, -82.2, 0.42, 0.03, -75.8, '2196'); W.beamBox.enabled = false;
  W.beam49Box = null;
  // set-out paint on the 2026 slab, the crane (mast in the south-west, jib over the chasm), its control panel, the site board
  plane(signTex('m21setout', [['◀  TB-7  ▶', 40, '#ff4a2a']], { bg: 'rgba(0,0,0,0)', h: 128, w: 512, grain: false }), 2.4, 0.6, P.setout[0], 0.03, P.setout[2], 0, 0.6, '2026').rotation.x = -PI / 2;
  bat('2026').box(M.yellow, -19.4, 0, -79.8, -18.2, 30, -78.6);
  for (let y = 2; y < 30; y += 2) bat('2026').box(M.yellow, -19.6, y, -80, -18, y + 0.1, -78.4);
  bat('2026').box(M.yellow, -20, 30, -79.6, 14, 31, -78.8); bat('2026').box(M.graphite, -24, 29.5, -80.2, -20, 31.5, -78.2);
  W.trolley = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.2), M.graphite); W.trolley.position.set(8, 29.8, -79.2); W.trolley.userData.noBatch = true; add(W.trolley, '2026');
  solid(M.yellow, P.crane[0] - 0.7, 0, P.crane[2] - 0.5, P.crane[0] + 0.7, 1.2, P.crane[2] + 0.5, '2026');
  W.slewScreen = plane(TEX.slew(2), 1.0, 0.5, P.crane[0], 1.5, P.crane[2] + 0.52, 0, 0.5, '2026');
  bat('2026').box(M.wood, P.board26[0] - 1.4, 0, P.board26[2] - 0.1, P.board26[0] + 1.4, 2.2, P.board26[2] + 0.1);
  plane(paperTex('m21board', 'SITE BOARD · 21.10.2026', ['Today: set TB-7 (atrium skybridge)', 'Crane TC-2, slew from the panel.', 'Set out marked on the slab.', '', '— and, pinned under it, in green ink:', '"Centre. Not east. You always', ' swing it east first. — K."'], { bg: '#f0ead8' }), 1.6, 1.9, P.board26[0], 1.25, P.board26[2] + 0.12, 0, 0.25, '2026');
  // the dais: the Cradle and its lift, the gauge, the side doors
  for (const e of ['2196', '2049']) bat(e).box(e === '2196' ? M.pearlDark : M.helixWall, -7, 0, -95, 7, 0.3, -86);
  box(-7, 0, -95, 7, 0.3, -86, ['2196', '2049']);
  W.lift = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 24), M.graphite); W.lift.position.set(P.lift[0], 0.45, P.lift[2]); W.lift.userData.noBatch = true; add(W.lift, '2196');
  W.liftBox = box(P.lift[0] - 1.4, 0, P.lift[2] - 1.4, P.lift[0] + 1.4, 0.6, P.lift[2] + 1.4, '2196');
  W.cradle = new THREE.Group(); W.cradle.position.set(...P.ring); add(W.cradle, '2196');
  W.ring = chronolith(1.25, { color: 0x9a7bff, power: 0.25 }); W.cradle.add(W.ring);
  { const yoke = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.14, 8, 48, PI), M.pearl); yoke.rotation.z = PI; yoke.position.y = 0; W.cradle.add(yoke);
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 15, 4), M.steel); c.position.set(s * 3.4, 7.5, 0); W.cradle.add(c); } }
  W.halo = new THREE.Group(); W.halo.position.set(...P.ring); add(W.halo, '2049');
  { const h1 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.18, 10, 64), M.steel); W.halo.add(h1); const h2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.06, 8, 48), cyan); h2.rotation.y = 0.5; W.halo.add(h2);
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 15, 4), M.steel); c.position.set(s * 3.2, 7.5, 0); W.halo.add(c); } }
  W.gaugeScreen = plane(TEX.gauge(0), 1.4, 0.7, 3.4, 2.2, -82.3, 0, 0.6, '2196'); bat('2196').box(M.graphite, 2.6, 0, -82.6, 4.2, 1.8, -82.2); box(2.6, 0, -82.6, 4.2, 1.8, -82.2, '2196');
  for (const s of [-1, 1]) { bat('2196').box(M.graphite, s * 10 - 1.4, 0, -96.05, s * 10 + 1.4, 4, -95.9); bat('2196').box(gold, s * 10 - 1.45, 4, -96.05, s * 10 + 1.45, 4.1, -95.88); }
  // the 2049 ballast trays at the Halo's floor anchors (west and east walls)
  W.trays = {};
  for (const side of ['W', 'E']) {
    const [x, , z] = side === 'W' ? P.ballastW : P.ballastE, sx = side === 'W' ? 1 : -1;
    solid(M.steel, x - 0.6, 0, z - 1.2, x + 0.6, 0.5, z + 1.2, '2049'); bat('2049').cyl(M.steel, x, 11, z, 0.03, 22, 4);
    const blocks = new THREE.Group(); blocks.position.set(x, 0.5, z); add(blocks, '2049');
    const sign = plane(TEX.ballast(side, W.ballast[side]), 1.1, 0.55, x + sx * 0.62, 1.4, z, side === 'W' ? PI / 2 : -PI / 2, 0.4, '2049');
    W.trays[side] = { blocks, sign, x, z, sx };
  }
  W.blockMat = M.graphite;
  W.drawBallast = () => {
    for (const side of ['W', 'E']) {
      const t = W.trays[side]; while (t.blocks.children.length) t.blocks.remove(t.blocks.children[0]);
      W.ballast[side].forEach((kg, i) => { const h = 0.12 + kg / 200; const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.5), W.blockMat); m.position.set(0, h / 2, -0.8 + i * 0.6); t.blocks.add(m); });
      t.sign.material.map = TEX.ballast(side, W.ballast[side]); t.sign.material.emissiveMap = t.sign.material.map; t.sign.material.needsUpdate = true;
    }
  };
  W.drawBallast();
  // floor slabs at the chasm edge (2196) that fall in the collapse: a visual strip plus its own collision
  for (const [x0, x1] of SLABS) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 0.04, 0.6, 6), M.contFloor); m.position.set((x0 + x1) / 2, -0.28, -73); m.userData.noBatch = true; add(m, '2196');
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 0.08), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, toneMapped: false })); crack.rotation.x = -PI / 2; crack.position.set((x0 + x1) / 2, 0.04, -70.02); crack.userData.noBatch = true; add(crack, '2196');
    W.slabs.push({ x0, x1, m, crack, fallen: false, box: null, vy: 0 });
  }
  for (const s of W.slabs) { s.box = box(s.x0, -1, -76, s.x1, 0, -70, '2196'); box(s.x0, -1, -76, s.x1, 0, -70, ['2049', '2026']); }

  // ================= the city around (both eras) and the sky =================
  try {
    const list = [], R2 = rng(2121);
    for (const s of [-1, 1]) for (let i = 0; i < (low ? 3 : 5); i++) {
      const z = 54 - i * 22, w = 14 + R2() * 6, d = 16 + R2() * 4;
      list.push({ width: w, depth: d, height: 22 + R2() * 34, position: [s * (30 + w / 2 + R2() * 4), 0, z], seed: 40 + i + (s > 0 ? 10 : 0), wall: R2() < 0.5 ? 'concrete' : 'brick', faces: ['windows', 'windows', 'windows', 'windows'], groundBlank: true });
    }
    const b96 = RZ.cityBlock(list.map(b => ({ ...b, ruin: 0.6 + R2() * 0.3, moss: 0.45, collapse: R2() < 0.4 })), { era: '2196', lit: 0.0, daylight: 0.4, detail: low ? 'low' : undefined }); b96.mesh.castShadow = false; add(b96.mesh, '2196');
    const b49 = RZ.cityBlock(list.map(b => ({ ...b, led: 0.4, cables: true })), { era: '2049', lit: 0.35, daylight: 0, detail: low ? 'low' : undefined }); b49.mesh.castShadow = false; add(b49.mesh, '2049');
    const sk96 = RZ.skyline({ center: [0, -20], radius: [160, 300], count: low ? 24 : 40, height: [20, 110], lit: 0.0, seed: 2131 }); add(sk96.mesh || sk96, '2196');
    const sk49 = RZ.skyline({ center: [0, -20], radius: [160, 300], count: low ? 30 : 50, height: [36, 170], lit: 0.14, seed: 2131 }); add(sk49.mesh || sk49, '2049');
    const sk26 = RZ.skyline({ center: [0, -20], radius: [160, 300], count: low ? 24 : 40, height: [30, 120], lit: 0.04, seed: 2132 }); add(sk26.mesh || sk26, '2026');
  } catch (err) { console.warn('m21 city', err); }
  try {
    const k96 = streetKit({ era: '2196', seed: 21 });
    k96.car([-10, 0, 22], 0.4).car([11, 0, 27], -0.3).add('rubble', [-6, 0, 16], 0).add('rubble', [7, 0, 30], 1).add('rubble', [15, 0, 19], 2);
    k96.overgrowth({ area: [-19, 13, 19, 46] }, { density: low ? 0.5 : 0.9, cracks: 0.8 });
    add(k96.build(), '2196');
    box(-11.4, 0, 19.8, -8.6, 1.3, 24.2, '2196'); box(9.6, 0, 24.8, 12.4, 1.3, 29.2, '2196');   // the wrecks
    const k49 = streetKit({ era: '2049', seed: 22 });
    k49.add('bench', [-6, 0, 32], 0).add('bench', [6, 0, 32], 0).add('bollard', [-3, 0, 14], 0).add('bollard', [3, 0, 14], 0).add('bin', [-12, 0, 24], 0).car([16, 0, 24], PI / 2).add('kiosk', [-16, 0, 16], PI / 2);
    k49.puddles([[-4, 20, 2.2], [6, 26, 1.6], [2, 6, 2.0], [-8, -4, 1.4]]);
    add(k49.build(), '2049');
    box(14.8, 0, 21.6, 17.2, 1.5, 26.4, '2049');   // the parked car
  } catch (err) { console.warn('m21 street', err); }
  W.storm = stormWall({ center: [0, -30], radius: 230, height: 220, y: -30, a: 0xffb070, b: 0x9a7bff, amp: 0.5 }); add(W.storm, '2196');

  // ================= shards =================
  for (const [x, y, z, e] of SHARDS) { const m = shardMesh(); m.position.set(x, y, z); add(m, e); W.shards.push({ m, x, y, z, e, got: false }); }

  // ================= ghosts of earlier places (the ending): translucent, built now, shown at the end =================
  W.ghosts = new THREE.Group(); W.ghosts.visible = false; add(W.ghosts);
  { const gm = new THREE.MeshBasicMaterial({ color: 0xc8b8ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); W.ghostMat = gm;
    const GB = new Batch();
    for (let i = 0; i < 8; i++) GB.box(gm, -18 + i * 5, -12, -78.6, -17.2 + i * 5, 6, -77.8);                      // Central Station's columns
    for (const [x, z] of [[-14, -60], [-9, -66], [12, -58]]) { GB.cyl(gm, x, 1.2, z, 2.0, 2.4, 10); GB.geo(gm, new THREE.ConeGeometry(2.4, 1.8, 10), [x, 3.3, z]); }   // the settlement's huts
    GB.geo(gm, new THREE.SphereGeometry(6, 16, 8, 0, PI * 2, 0, PI / 2), [14, 8, -88]);                            // the observatory dome
    GB.box(gm, -20, 0, -90, -14, 9, -86); for (let y = 1; y < 9; y += 1.5) GB.box(gm, -20.05, y, -89.6, -19.95, y + 0.8, -86.4);   // a Rain City facade
    GB.build(W.ghosts, { name: 'ghosts', cast: false });
    const clock = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (g, w) => { g.clearRect(0, 0, w, w); g.strokeStyle = '#e8e0ff'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 116, 0, 7); g.stroke(); for (let k = 0; k < 12; k++) { const a = k * PI / 6; g.beginPath(); g.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); g.stroke(); } }, 'm21clock'), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    clock.position.set(0, 13, -95.5); W.ghosts.add(clock); W.clock = clock; }

  K.finish();
  // ================= per-frame =================
  W.update = (dt, t) => {
    W.ring.userData.update?.(t); W.storm.material.uniforms.uTime.value = t;
    for (const s of W.shards) if (!s.got) s.m.rotation.y = t * 1.5;
    W.searchlights.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.35 + i * 2) * 0.55; b.rotation.x = 0.5 + Math.sin(t * 0.27 + i) * 0.25; });
    if (W.fire) W.fire.scale.setScalar(1 + Math.sin(t * 9) * 0.08 + Math.sin(t * 13.1) * 0.05);
    for (const p of W.pods) if (!p.open) { p.field.material.opacity = 0.1 + Math.sin(t * 2 + p.g.position.z) * 0.03; }
    W.halo.rotation.y = t * 0.05;
    if (W.hook && W.beam26) { W.hook.position.set(W.beam26.position.x, (29.6 + W.beam26.position.y + 2.6) / 2, -79.2); W.hook.scale.y = Math.max(0.1, 29.6 - W.beam26.position.y - 2.6); W.trolley.position.x = W.beam26.position.x; }
  };
  return W;
}
