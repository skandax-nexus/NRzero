// Mission 23 environment: AFTERZERO (finale). One scene (north = -z, ground y = 0 unless stated), plus three small
// epilogue sets and the post-credit clock.
//   THE HALL (z 48..74)      the torn floor of Test Hall Zero after 08:14:10, the cracked ring, a bridge of mixed paving.
//   THE AVENUE (z 8..48)     Rain City's opening street (M1) in three local states: 'a26' (2026, a building site),
//                            'a49' (2049, the Zero Second: Checkpoint C, rain, frozen commuters, the stalled tram),
//                            'a96' (2196, overgrown ruin, the fallen statue, a sinkhole). Checkpoint C stands at z 24.
//   THE CONFLUENCE (plaza, x -16..16, z -14..8)  where the places meet; the fracture wall (z -14) with three seals; the
//                            stopped clock with no hands.
//   THE SETTLEMENT (west, x -62..-16)  the keepers' valley: houses, three hearths, the mural, the stream (x -46..-40)
//                            and the shrine on the far bank.
//   THE FUTURE CITY (east, x 16..64)  2196 Rain City: a parking deck (y 6) reached by a ramp, the skybridge over the
//                            fissure (x 32..50) in two local states 'f96' / 'f49', Lantern Hall's beacon roof (x 50..64).
//   THE LABORATORY (x -8..8, z -14..-54)  Helix, folded into the fracture: the held door, the reversed lab hall, the
//                            seam of debris that falls upward (z -37..-46), the last door.
//   THE ORIGINAL CHRONOLITH (z -54..-94)  a stone terrace where every era collides; the ring, Mira, the threads table,
//                            the three ways.
// Static geometry is merged per material (env_m6 Batch). Objects that belong to one local state are listed in W.sv
// ({ o, z, s }); the mission shows them from the state that zone is in (each zone remembers its own).
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, chronolith } from './kit.js';
import { Batch } from './env_m6.js';
import { signTex, paperTex } from './env_m18.js';
import { shardMesh, pageMesh, veilMaterial, fragments } from './env_m19.js';
import { streetKit } from './props.js';
import { registerCast, CAST } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

const PI = Math.PI;
const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
export { shardMesh, pageMesh };

// ---------------------------------------------------------------------------------------------------------------------
// Places (the mission script and the test use these)
// ---------------------------------------------------------------------------------------------------------------------
export const P = {
  start: [0, 0, 64, PI], witness0: [1.9, 0, 61.6],
  avenueEntry: [0, 0, 44, PI], plazaEntry: [0, 0, 4, PI], witnessPlaza: [3.2, 0, -8.2],
  gateZ: 24, sinkZ: [12, 20], crawl: [6, 0.15, 24], tram: [4.6, 0, 14.5], tramDoor: [2.3, 0, 14.5],
  booth: [8.6, 0.15, 27], hale: [7.6, 0.15, 27.6], jun: [-8.4, 0.15, 37.6], statue: [-5.2, 0, 40.5], hoardShard: [-8.6, 0.15, 30.5],
  clock: [-9, 0, 1.5], seals: { avenue: [-6, 3.2, -13.4], settle: [0, 4.4, -13.4], future: [6, 3.2, -13.4] },
  // settlement
  setEntry: [-18, 0, -2, -PI / 2], ember: [-21.5, 0, 3.5], hearths: { sun: [-25.5, 0, -7], ring: [-32, 0, 3.5], river: [-36.5, 0, -6.5] },
  mural: [-30, 0, -15.6], stones: [[-41.2, -6.2], [-43.1, -6.6], [-45, -6.1]], shrine: [-53, 0, -3], niko: [-51.2, 0, -4.4], tala: [-51.6, 0, -0.6],
  setShard: [-58, 0, 9], helixCard: [-55.4, 0, -6.2],
  // future city
  futEntry: [18, 0, -2, PI / 2], ramp: [20, 25, -2, 12], deckY: 6, bridgeZ: [-8, -5], gap: [37, 43], shutterX: 44, b2: [50, 64, -18, 2],
  beacon: [58.5, 6, -9], sera: [55.6, 6, -6.4], futShard: [19.2, 6, -15], garden: [27.5, 6, -14.2],
  // laboratory
  labEntry: [0, 0, -15.5, PI], d1z: -20, lanes: [-24, -28, -32], console1: [5, 0, -34.6], plate: [-4, 0, -35.6], seam: [-37, -46],
  plats: [-38.7, -41.6, -44.4], d3z: -52.5, witnessHold: [-2.6, 0, -35.8], labShard: [-5.9, 0, -17.6],
  // the original Chronolith
  chronEntry: [0, 0, -56, PI], ring: [0, 4.3, -84], mira: [0, 0, -76.2], table: [0, 0, -67.5],
  ends: { A: [-7.5, 0, -79.5], B: [7.5, 0, -79.5], C: [0, 0, -80.6] }, chronShard: [10.5, 0, -64],
  pages: [[-7.8, 0.15, 17.5, 'avenue'], [-33.5, 0, 9.5, 'settle'], [61.5, 6, -15.5, 'future'], [7.2, 0, -50.5, 'lab']],
};

// ---------------------------------------------------------------------------------------------------------------------
// Cast (bible: Witness = Kai after years without sleep; Mira = more than a reconstructed pattern)
// ---------------------------------------------------------------------------------------------------------------------
export function registerM23Cast() {
  registerCast('m23band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist · after zero', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m23mira', { name: 'MIRA VAREN', role: 'Afterzero · a world with no Kai in it',
    look: { ...(CAST.mira?.look || {}), role: 'mira', era: '2049', costume: 'mira', sex: 1, female: true, age: 33, hairStyle: 'tied-back', wrinkles: 0.08 },
    rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 1.02, rate: 0.96, langs: ['en-GB', 'en-US'] } });
  registerCast('m23kaivo', { name: 'KAI VAREN', role: 'A voice in no second', portraitOf: 'kai', voice: true, vp: { sex: 'm', pitch: 0.9, rate: 0.92, langs: ['en-GB', 'en-US'] } });
  registerCast('m23whisper', { name: '', role: '', voice: true, vp: { sex: 'm', pitch: 0.85, rate: 0.8, langs: ['en-GB', 'en-US'] } });
  registerCast('m23settler', { name: 'KEEPER', role: 'The settlement · c. 1000 BCE',
    look: { role: 'm23settler', era: 'ancient', costume: 'anc_m2', sex: 0, age: 60, height: 1.68, skin: 0x7d4f33, hair: 0x9a9088, hairStyle: 'short', top: 0xcdb48a, topKind: 'fabric', topType: 'tunic', pantsType: 'wraps', shoes: 'sandals', sash: 0x9b3b24, pants: 0x7a6248, boots: 0x4a3220, wrinkles: 0.6 },
    vp: { sex: 'm', pitch: 0.82, rate: 0.9, langs: ['en-GB', 'en-IE'] } });
  registerCast('m23scav', { name: 'LANTERN HALL', role: 'Survivor · 2196',
    look: { role: 'm23scav', era: '2196', costume: 'surv_m2', sex: 0, age: 55, height: 1.74, skin: 0xa77a5d, hair: 0x6a6460, hairStyle: 'buzz', top: 0x5a5444, topKind: 'fabric', topType: 'jacket', pantsType: 'cargo', pants: 0x3a3a30, boots: 0x2a2018, stubble: 0.6, wrinkles: 0.5 },
    vp: { sex: 'm', pitch: 0.9, rate: 0.98, langs: ['en-GB', 'en-US'] } });
  registerCast('m23commuter', { name: 'COMMUTER', role: 'Rain City · 08:14 · 2049',
    look: { role: 'm23commuter', era: '2049', costume: 'c49_f2', sex: 1, female: true, age: 36, height: 1.66, skin: 0xd8b08e, hair: 0x2a1c14, hairStyle: 'bun', top: 0x2a2f36, topKind: 'fabric', topType: 'jacket', pants: 0x1d2430, pantsType: 'trousers', shoes: 'boots' },
    vp: { sex: 'f', pitch: 1.06, rate: 1.02, langs: ['en-GB', 'en-US'] } });
  registerCast('m23voice', { name: 'UNKNOWN VOICE', role: 'Every speaker · after the credits', portraitOf: 'voice', voice: true, vp: { sex: 'm', pitch: 0.45, rate: 0.78, langs: ['en-GB', 'en-US'] } });
}
// crowds (lod), era-correct: 2049 commuters frozen at 08:14, settlers, 2196 survivors, epilogue passers-by
export const COMMUTERS = [
  { era: '2049', costume: 'c49_m2', female: false, age: 41, height: 1.78, skin: 0xc49a7c, hair: 0x2a2018, hairStyle: 'short', top: 0x1b1e23, coat: 0x2a2f36, pants: 0x1d2430, umbrella: 0x2ae6ff },
  { era: '2049', costume: 'c49_f3', female: true, age: 29, height: 1.64, skin: 0xe0b394, hair: 0x15100c, hairStyle: 'long', top: 0x3a4048, pants: 0x1a1d22, umbrella: 0xff4fa0 },
  { era: '2049', costume: 'c49_m1', female: false, age: 24, height: 1.76, skin: 0xe8c0a0, hair: 0x0c0c0e, hairStyle: 'messy', top: 0x18191d, pants: 0x3a4048 },
  { era: '2049', costume: 'c49_f4', female: true, age: 19, height: 1.62, skin: 0x8a5b3c, hair: 0x15100c, hairStyle: 'bun', top: 0x2e3338, pants: 0x1d2a44 },
  { era: '2049', costume: 'c49_m5', female: false, age: 66, height: 1.72, skin: 0xd3a487, hair: 0xb8b4ae, hairStyle: 'grey-swept', top: 0x3b4441, coat: 0x2a2f36, pants: 0x23262b, umbrella: 0xffb347 },
  { era: '2049', costume: 'c49_kid_f', female: true, age: 8, height: 1.28, child: true, skin: 0xd9a585, hair: 0x2a1c14, hairStyle: 'bob', top: 0x4a1f24, pants: 0x1d2a44 },
];
export const SETTLERS = [
  { era: 'ancient', costume: 'anc_f1', female: true, age: 30, height: 1.62, skin: 0x7d4f33, hair: 0x15100b, hairStyle: 'bun', top: 0x3f6a6a, topKind: 'fabric', topType: 'tunic', pantsType: 'wraps', shoes: 'sandals', sash: 0xd0a24a },
  { era: 'ancient', costume: 'anc_m1', female: false, age: 34, height: 1.7, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'short', top: 0xcdb48a, topKind: 'fabric', topType: 'tunic', pantsType: 'wraps', shoes: 'sandals', sash: 0x9b3b24 },
  { era: 'ancient', costume: 'anc_f2', female: true, age: 45, height: 1.6, skin: 0x6b4029, hair: 0x2a1c14, hairStyle: 'long', top: 0x9b3b24, topKind: 'fabric', topType: 'tunic', pantsType: 'wraps', shoes: 'sandals' },
  { era: 'ancient', costume: 'anc_kid_m', female: false, age: 9, height: 1.3, child: true, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'curly', top: 0xd9c9a0, topKind: 'fabric', topType: 'tunic', pantsType: 'wraps', shoes: 'sandals' },
];
export const SURVIVORS = [
  { era: '2196', costume: 'surv_f1', female: true, age: 27, height: 1.68, skin: 0x8a5b3c, hair: 0x2a1c14, hairStyle: 'tied-back', top: 0x6a5a44, topType: 'jacket', pantsType: 'cargo', pants: 0x3a3a30, hood: true },
  { era: '2196', costume: 'surv_m1', female: false, age: 38, height: 1.78, skin: 0xc49a7c, hair: 0x2a2018, hairStyle: 'buzz', top: 0x4a3a28, topType: 'jacket', pantsType: 'cargo', pants: 0x4a4a32, stubble: true },
  { era: '2196', costume: 'surv_f2', female: true, age: 50, height: 1.64, skin: 0xa06a46, hair: 0x4a4038, hairStyle: 'short', top: 0x5a5444, topType: 'jacket', pantsType: 'cargo', pants: 0x2c2a26 },
];
export const PASSERS49 = [
  { era: '2049', costume: 'c49_f1', female: true, age: 31, height: 1.68, skin: 0xe0b394, hair: 0x6a3f22, hairStyle: 'long', top: 0x1c2026, pants: 0x2e3338 },
  { era: '2049', costume: 'c49_m4', female: false, age: 27, height: 1.8, skin: 0x8a5b3c, hair: 0x0e0a08, hairStyle: 'short', top: 0x3b4441, pants: 0x1a1d22 },
  { era: '2049', costume: 'c49_m3', female: false, age: 52, height: 1.74, skin: 0xd8b08e, hair: 0x4a4038, hairStyle: 'swept', top: 0x2a2f36, coat: 0x3a4048, pants: 0x23262b },
  { era: '2049', costume: 'c49_f5', female: true, age: 70, height: 1.6, skin: 0xd3a487, hair: 0xc8c4be, hairStyle: 'bun', top: 0x4a1f24, coat: 0x2e3338, pants: 0x1d2430 },
  { era: '2049', costume: 'c49_kid_m', female: false, age: 9, height: 1.32, child: true, skin: 0xb98463, hair: 0x15100c, hairStyle: 'short', top: 0x1d2a44, pants: 0x2a2c2f },
];

// ---------------------------------------------------------------------------------------------------------------------
// Music. Mira's three notes are E-B-A (64, 71, 69). Bible: the final cue is piano and cello, 62 BPM, a slow string bloom,
// acceptance rather than triumph, ending on one breath of silence.
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { threads: 0, hold: 0, bloom: 0, end: 'C' };
export function registerM23Themes() {
  const motif = (a, b, t, vol, base = 64, inst = 'piano') => {
    const f = inst === 'cello' ? (n, tt, v) => a.cello(n - 12, tt, 1.6, v) : (n, tt, v) => a.piano(n, tt, v, 3.2);
    if (b === 0) f(base, t, vol); if (b === 6) f(base + 7, t, vol * 0.9); if (b === 12) f(base + 5, t, vol);
  };
  registerTheme('m23-confluence', { bpm: 62, step(a, s, t, d) {       // the merged landscape: the main theme, reduced
    const bar = Math.floor(s / 16), b = s % 16, ch = [[40, 47, 52, 55], [36, 43, 48, 52], [38, 45, 50, 54], [35, 42, 47, 50]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.014, 520); a.cello(ch[0], t, d * 15, 0.03); }
    if (bar % 2 === 1) motif(a, b, t, 0.032);
    if (b === 8 && bar % 4 === 2) a.glass(76, t, 0.006);
    if (musicState.threads >= 2 && b % 8 === 4) a.pluck(ch[2] + 12, t, 0.018);
  } });
  registerTheme('m23-rain', { bpm: 92, step(a, s, t, d) {             // the opening streets: muted pulse, drifting tick
    const bar = Math.floor(s / 16), b = s % 16, root = [40, 40, 36, 38][bar % 4];
    if (b === 0) { a.pad([root, root + 7, root + 12], t, d * 16, 0.011, 420); a.cello(root - 12, t, d * 14, 0.026); }
    if (b % 4 === 0) a.drum(t, 0.035, 90, 45);
    if (b % 2 === 1 && (bar + b) % 5) a.tick(t + (bar % 3) * 0.006, 0.012);
    if (b === 6 || b === 10) a.piano(root + 24 + (b === 10 ? 3 : 0), t, 0.028, 1.2);
    if (bar % 4 === 3) motif(a, b, t, 0.02);
  } });
  registerTheme('m23-past', { bpm: 82, step(a, s, t, d) {             // the settlement: frame drum, breathy flute, pluck
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57], [43, 50, 55], [41, 48, 53], [43, 50, 55]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.012, 600);
    if (b === 0 || b === 6 || b === 10) a.drum(t, b === 0 ? 0.07 : 0.04, 120, 50);
    if (b % 4 === 2) a.pluck(ch[(b >> 2) % 3] + 12, t, 0.03);
    if (b === 4 && bar % 2 === 0) a.flute(ch[2] + 12, t, d * 6, 0.016);
    if (bar % 4 === 3) motif(a, b, t, 0.018, 64);
  } });
  registerTheme('m23-future', { bpm: 70, step(a, s, t, d) {           // 2196: wide strings, wind, sparse piano, quiet hope
    const bar = Math.floor(s / 16), b = s % 16, ch = [[38, 45, 50, 57], [41, 48, 53, 57], [36, 43, 48, 55], [43, 50, 55, 59]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016, 700); a.cello(ch[0] - 12, t, d * 16, 0.028); }
    if (b === 8 && bar % 2) a.piano(ch[3] + 12, t, 0.026, 3);
    if (b === 12 && bar % 4 === 2) a.flute(ch[2] + 12, t, d * 4, 0.012);
  } });
  registerTheme('m23-witness', { bpm: 54, step(a, s, t, d) {          // the Witness: Kai's motif slower and lower
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([28, 35, 40], t, d * 16, 0.014, 300); a.cello(28, t, d * 15, 0.035); }
    if (bar % 2 === 0) motif(a, b, t, 0.03, 52, 'cello');
    if (b === 10 && bar % 3 === 1) a.glass(71, t, 0.006);
    if (b === 5 && bar % 2) a.drum(t, 0.03, 70, 40);
  } });
  registerTheme('m23-hold', { bpm: 104, step(a, s, t, d) {            // holding the route open: a tightening pulse
    const bar = Math.floor(s / 16), b = s % 16, H = musicState.hold, root = [40, 41, 40, 38][bar % 4];
    if (b === 0) { a.pad([root, root + 7, root + 10], t, d * 16, 0.012, 500); a.cello(root - 12, t, d * 8, 0.03); }
    if (b % 4 === 0) a.drum(t, 0.05 + H * 0.03, 110, 45);
    if (b % 2 === 1 || (H > 0.5 && b % 4 === 2)) a.tick(t, 0.014);
    if (b === 6 || b === 14) a.pluck(root + 19, t, 0.02);
  } });
  registerTheme('m23-mira', { bpm: 64, step(a, s, t, d) {             // Mira: felt piano, breathy woodwind, warm cello
    const bar = Math.floor(s / 16), b = s % 16, ch = [[40, 47, 52, 56], [37, 44, 49, 52], [33, 40, 45, 49], [35, 42, 47, 51]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.012, 480); a.cello(ch[0], t, d * 15, 0.028); }
    motif(a, b, t, 0.03);
    if (b === 10 && bar % 2) a.flute(ch[3] + 12, t, d * 5, 0.012);
  } });
  registerTheme('m23-final', { bpm: 62, step(a, s, t, d) {            // Afterzero: piano and cello, then the strings bloom
    const bar = Math.floor(s / 16), b = s % 16, B = musicState.bloom, ch = [[40, 47, 52, 55], [36, 43, 48, 52], [33, 40, 45, 48], [35, 42, 47, 50]][bar % 4];
    if (b === 0) a.cello(ch[0], t, d * 15, 0.034);
    if (b === 0 || b === 8) a.piano(ch[2] + 12, t, 0.024, 3);
    motif(a, b, t, 0.034);
    if (B > 0 && b === 0) a.pad(ch.map(n => n + 12), t, d * 16, 0.008 + B * 0.012, 600 + B * 600);
    if (B > 1 && b === 4) a.flute(ch[3] + 12, t, d * 6, 0.01);
  } });
  registerTheme('m23-war', { bpm: 70, step(a, s, t, d) {              // ending B: the motif with no agreement
    const bar = Math.floor(s / 16), b = s % 16, root = [38, 39, 38, 36][bar % 4];
    if (b === 0) { a.pad([root, root + 6, root + 12], t, d * 16, 0.014, 420); a.cello(root - 12, t, d * 16, 0.03); }
    if (b === 7 && bar % 2) a.drum(t, 0.05, 70, 35);
    motif(a, b, t, 0.026, bar % 2 ? 64 : 63);
  } });
  registerTheme('m23-clock', { bpm: 60, step(a, s, t) {               // after the credits: only the clock
    const b = s % 16; if (b % 4 === 0) a.tick(t, 0.04, 5200);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Textures drawn by code
// ---------------------------------------------------------------------------------------------------------------------
function grain(g, w, h, n, a, seed) { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } }
export function clockTex(key, opts = {}) {   // the stopped clock with no hands (opts.hands: [h, m, s] to draw them)
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = opts.bg || '#ece4d0'; g.beginPath(); g.arc(w / 2, w / 2, 124, 0, PI * 2); g.fill();
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 7; g.stroke();
    for (let k = 0; k < 60; k++) { const a = k / 60 * PI * 2, l = k % 5 ? 7 : 18; g.lineWidth = k % 5 ? 2 : 6; g.beginPath(); g.moveTo(128 + Math.sin(a) * (110 - l), 128 - Math.cos(a) * (110 - l)); g.lineTo(128 + Math.sin(a) * 110, 128 - Math.cos(a) * 110); g.stroke(); }
    g.fillStyle = '#1a1a1a'; g.font = `600 15px ${SERIF}`; g.textAlign = 'center'; g.fillText(opts.label ?? 'HELIX · 2026', 128, 88);
    if (opts.hands) { const [h, m] = opts.hands; const hand = (a, l, wd) => { g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); g.stroke(); };
      hand((h + m / 60) / 12 * PI * 2, 56, 9); hand(m / 60 * PI * 2, 86, 5); }
    g.beginPath(); g.arc(128, 128, 6, 0, PI * 2); g.fill();
  }, 'm23clock' + key);
}
export const TEX = {
  checkpoint: () => signTex('m23cp', [['CHECKPOINT C', 46, '#f2f6ff'], ['HELIX SECURITY ZONE · ID REQUIRED', 20, '#ff9aa4']], { bg: '#1b1e23', border: '#ff4d5e', h: 180 }),
  hoarding: () => canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#d8d2c2'; g.fillRect(0, 0, w, h); grain(g, w, h, 3000, 0.08, 31);
    g.fillStyle = '#1d4a52'; g.fillRect(0, 0, w, 54); g.fillStyle = '#e8f0f0'; g.font = `700 34px ${FONT}`; g.textAlign = 'left'; g.fillText('HELIX TEMPORAL RESEARCH', 30, 38);
    g.fillStyle = '#2a2a2a'; g.font = `700 52px ${FONT}`; g.fillText('THE FUTURE STARTS HERE', 30, 130);
    g.font = `500 26px ${FONT}`; g.fillText('Test Hall C · completion 2031 · Open day 19 October, 08:00', 30, 182);
    g.fillStyle = '#c8a020'; for (let x = 0; x < w; x += 60) g.fillRect(x, 224, 30, 32);
  }, 'm23hoard'),
  station: () => signTex('m23station', [['CENTRAL STATION', 44, '#f2f6ff'], ['RAIN CITY TRANSIT · PLATFORMS 1-6', 18, '#ffd34a']], { bg: '#1d2a44', border: '#ffd34a', h: 170 }),
  plaque: () => signTex('m23plaque', [['KAI VAREN', 40, '#e8dcc0'], ['ARCHITECT OF THE FRACTURE', 22, '#c8b890'], ['"He did not mean it. He did it anyway."', 18, '#a89870', 500]], { bg: '#3a3426', border: '#8a7a50', h: 200, wear: 0.5 }),
  board: () => signTex('m23board', [['08:14', 64, '#ffd34a'], ['ALL SERVICES · HELD', 24, '#ff9aa4'], ['NEXT: —', 22, '#9fd8ff']], { bg: '#0c1016', border: '#2a3440', h: 220 }),
  tramSign: () => signTex('m23tram', [['L4 · CALDER ROW', 34, '#ffd34a'], ['08:14 · STOPPED', 20, '#ff9aa4']], { bg: '#10141a', h: 120 }),
  mural: (residue) => canvasTex(1024, 384, (g, w, h) => {
    g.fillStyle = residue ? 'rgba(0,0,0,0)' : '#b08a62'; g.fillRect(0, 0, w, h); if (!residue) grain(g, w, h, 5000, 0.12, 41);
    const panel = (i, draw, smear) => {
      const x = 30 + i * 330, y = 30, pw = 300, ph = 324;
      if (!residue) { g.strokeStyle = '#5a3a22'; g.lineWidth = 6; g.strokeRect(x, y, pw, ph); }
      if (smear && !residue) { g.fillStyle = 'rgba(90,60,40,0.75)'; for (let k = 0; k < 40; k++) { g.beginPath(); g.ellipse(x + 40 + (k * 53) % 220, y + 60 + (k * 37) % 220, 30, 12, k, 0, PI * 2); g.fill(); } return; }
      if (!draw) return;
      g.save(); g.translate(x + pw / 2, y + 220); g.strokeStyle = residue ? '#9fe8ff' : '#2a1a10'; g.fillStyle = residue ? '#9fe8ff' : '#7a2a18'; g.lineWidth = 8;
      // fire (all panels)
      g.beginPath(); g.moveTo(-40, 60); g.quadraticCurveTo(-30, 0, 0, -20); g.quadraticCurveTo(30, 0, 40, 60); g.closePath(); g.fill();
      g.translate(0, -130); draw(g); g.restore();
      if (!residue) { g.fillStyle = '#2a1a10'; g.font = `700 30px ${SERIF}`; g.textAlign = 'center'; g.fillText(['I', 'II', 'III'][i], x + pw / 2, y + ph - 12); }
    };
    const sun = (c) => { c.beginPath(); c.arc(0, 0, 34, 0, PI * 2); c.stroke(); for (let k = 0; k < 10; k++) { const a = k / 10 * PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 44, Math.sin(a) * 44); c.lineTo(Math.cos(a) * 62, Math.sin(a) * 62); c.stroke(); } };
    const ring = (c) => { c.beginPath(); c.arc(0, 0, 52, 0, PI * 2); c.stroke(); c.beginPath(); c.arc(0, 0, 36, 0.4, PI * 1.6); c.stroke(); };
    const river = (c) => { for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-70, -20 + k * 22); c.bezierCurveTo(-30, -40 + k * 22, 20, 0 + k * 22, 70, -20 + k * 22); c.stroke(); } };
    if (residue) { panel(1, ring); return; }
    panel(0, sun); panel(1, null, true); panel(2, river);
  }, residue ? 'm23muralR' : 'm23mural', { transparent: !!residue }),
  hearthSign: (kind) => canvasTex(128, 128, (g) => {
    g.fillStyle = '#6a645a'; g.fillRect(0, 0, 128, 128); grain(g, 128, 128, 600, 0.2, kind.length);
    g.strokeStyle = '#2a2018'; g.lineWidth = 7; g.translate(64, 64);
    if (kind === 'sun') { g.beginPath(); g.arc(0, 0, 18, 0, PI * 2); g.stroke(); for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 26, Math.sin(a) * 26); g.lineTo(Math.cos(a) * 40, Math.sin(a) * 40); g.stroke(); } }
    if (kind === 'ring') { g.beginPath(); g.arc(0, 0, 36, 0, PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 22, 0.4, PI * 1.6); g.stroke(); }
    if (kind === 'river') for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-44, -18 + k * 18); g.bezierCurveTo(-14, -34 + k * 18, 14, -2 + k * 18, 44, -18 + k * 18); g.stroke(); }
  }, 'm23hearth' + kind),
  tally: () => canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#8a7a62'; g.fillRect(0, 0, w, h); grain(g, w, h, 900, 0.2, 77); g.strokeStyle = '#2a2018'; g.lineWidth = 5;
    for (let i = 0; i < 17; i++) { const x = 18 + i * 13; g.beginPath(); g.moveTo(x, 26); g.lineTo(x + (i % 5 === 4 ? -40 : 0), 100); g.stroke(); }
  }, 'm23tally'),
  lab: () => signTex('m23lab', [['HELIX · TEST HALL ZERO', 36, '#e8eef0'], ['ACCESS CORRIDOR · AUTHORISED STAFF', 18, '#38c8c0']], { bg: '#1a1e24', border: '#38c8c0', h: 150 }),
  anchor: () => signTex('m23anchor', [['ANCHOR CONSOLE', 34, '#e8eef0'], ['ROUTE LOCK · HOLD', 18, '#ffd27a']], { bg: '#20242a', border: '#ffd27a', h: 120 }),
  garden: () => paperTex('m23garden', 'LANTERN HALL ROOF GARDEN', ['Beans, kale, two tomatoes that', 'refuse to die.', '', 'Planted for a tomorrow', 'nobody here will see.', 'Water at dusk. — W.'], { hand: true, bg: '#d8ccb0' }),
  lantern: () => signTex('m23lantern', [['LANTERN HALL', 40, '#ffe0a0'], ['THE LIGHT STAYS ON', 18, '#b6ff8a']], { bg: '#2a2418', border: '#b6ff8a', h: 140, wear: 0.4 }),
  calder: () => signTex('m23calder', [['CALDER ROW', 40, '#e8eef0'], ['W3 · HISTORIC TERRACE', 18, '#9fd8ff']], { bg: '#18202a', border: '#5fe6ff', h: 140 }),
  stationClock: (m) => clockTex('st' + m, { hands: [8, m], label: 'RAIN CITY' }),
};

// ---------------------------------------------------------------------------------------------------------------------
// The build kit (one per zone)
// ---------------------------------------------------------------------------------------------------------------------
function mkKit(game, scene, W, zone) {
  const col = game.collision, root = new THREE.Group(); root.name = 'm23-' + zone; scene.add(root);
  const BS = new Map();
  const key = (e) => (e ? [].concat(e).join('|') : 'all');
  const bat = (e) => { const k = key(e); let b = BS.get(k); if (!b) BS.set(k, b = { b: new Batch(), s: e ? [].concat(e) : null }); return b.b; };
  const box = (x0, y0, z0, x1, y1, z1, e, o = {}) => col.add([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], e ? { states: [].concat(e), ...o } : o);
  const solid = (mat, x0, y0, z0, x1, y1, z1, e) => { bat(e).box(mat, x0, y0, z0, x1, y1, z1); return box(x0, y0, z0, x1, y1, z1, e); };
  const add = (obj, e) => { root.add(obj); if (e) W.sv.push({ o: obj, z: zone, s: [].concat(e) }); return obj; };
  const plane = (tex, w, h, x, y, z, ry, emiss = 0.25, e, o = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emiss, side: THREE.DoubleSide, transparent: !!o.transparent }));
    m.position.set(x, y, z); m.rotation.set(o.rx || 0, ry, 0, 'YXZ'); m.userData.noBatch = true; return add(m, e);
  };
  const ramp = (min, max, dir, e) => col.addRamp(min, max, dir, e ? { states: [].concat(e) } : {});
  const src = (x, y, z, c, i, d, e) => W.lightSrc.push({ p: [x, y, z], c, i, d, zone, states: e ? [].concat(e) : null });
  const finish = () => { for (const { b, s } of BS.values()) { const g = new THREE.Group(); b.build(g, { name: 'm23-' + zone + '-' + (s ? s[0] : 'all') }); add(g, s); } BS.clear(); };
  W.zones[zone] = root;
  return { root, bat, box, solid, add, plane, ramp, src, finish, zone };
}
function materials() {
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  return {
    floor: pm('concrete', { color: 0x9a9a96, formwork: 0, stains: 0.35, pores: 0.02 }), wall: pm('concrete', { color: 0xb4b6b4, formwork: 1, stains: 0.25 }),
    dark: pm('concrete', { color: 0x3a3c40, formwork: 0, stains: 0.45 }), rock: pm('rock', { color: 0x6a645c, color2: 0x4a443c, lichen: 0.2 }),
    panel: pm('paintedMetalPanel', { color: 0xdfe3e6, cols: 4, rows: 2, wear: 0.08, grime: 0.15, gloss: 0.5 }), steel: pm('brushedMetal', { color: 0x8a8e92, roughness: 0.35 }),
    yellow: pm('paintedMetalPanel', { color: 0xd8b020, cols: 1, rows: 1, wear: 0.25, grime: 0.25, gloss: 0.5 }), red: pm('paintedMetalPanel', { color: 0x8a2a2a, cols: 2, rows: 1, wear: 0.2, grime: 0.2 }),
    stone: pm('cutStone', { color: 0xb3a58c, joint: 0x857c6e, weathering: 0.6 }), stoneDark: pm('cutStone', { color: 0x7a7060, joint: 0x5a5248, weathering: 0.8 }),
    plaster: pm('plaster', { color: 0xc9bca4, damage: 0.3, dirt: 0.4 }), dirt: pm('dirt', { color: 0x5a4532, damp: 0.4 }), grass: pm('grass', { color: 0x4f6a2a, dryness: 0.35 }),
    wood: pm('wood', { color: 0x6a4a2e, planks: 6, weathered: 0.6 }), ply: pm('wood', { color: 0xb89a6a, planks: 1 }), moss: pm('moss', { color: 0x3d5a1c }), rust: pm('rust', { color: 0x5a2a12, amount: 0.5 }),
    asphalt: pm('wetAsphalt', { color: 0x2e3032, puddles: 0.45 }), dryAsphalt: pm('wetAsphalt', { color: 0x4a4a48, puddles: 0.0 }), pave: pm('concrete', { color: 0x7a7a76, formwork: 0, stains: 0.3 }),
    cobble: pm('cutStone', { color: 0x6a645a, joint: 0x3a3630, rows: 12, weathering: 0.4 }), gravel: pm('gravel', { color: 0x6e6a64 }), tile: pm('ceramicTile', { color: 0xd8dcd8 }),
    brick: pm('brick', { color: 0x7d3a26, soot: 0.3 }), bronze: pm('brushedMetal', { color: 0x6a5230, roughness: 0.45 }), mud: pm('plaster', { color: 0x8a6a48, damage: 0.5, dirt: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9ab4c0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.4 }), hole: new THREE.MeshBasicMaterial({ color: 0x050505 }),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------------------------------------------------
export function buildWorld(game, scene) {
  const low = RZ.getQuality() === 'low';
  const W = { sv: [], zones: {}, lightSrc: [], updaters: [], seals: {}, hearths: {}, stones: [], plats: [], lanes: [], doors: {}, shards: {}, pages: [] };
  const M = materials();
  buildSky(scene, W, low);
  buildHall(game, mkKit(game, scene, W, 'hall'), M, W);
  buildAvenue(game, mkKit(game, scene, W, 'avenue'), M, W, low, scene);
  buildPlaza(game, mkKit(game, scene, W, 'plaza'), M, W);
  buildSettlement(game, mkKit(game, scene, W, 'settle'), M, W, low);
  buildFuture(game, mkKit(game, scene, W, 'future'), M, W, low);
  buildLab(game, mkKit(game, scene, W, 'lab'), M, W);
  buildChron(game, mkKit(game, scene, W, 'chron'), M, W, low);
  W.update = (dt, t) => { for (const f of W.updaters) f(dt, t); };
  return W;
}

function buildSky(scene, W, low) {
  const fr = fragments([[-40, 18, 30, 4], [44, 22, 20, 5], [-30, 26, -40, 3.5], [40, 16, -60, 4], [0, 34, -110, 6], [-70, 20, -20, 4], [76, 24, -30, 4.5], [24, -12, 66, 4], [-26, -14, 70, 5], [60, -10, 50, 3], [-60, 30, -80, 5]], 2301);
  scene.add(fr); W.updaters.push((dt, t) => fr.userData.update(t));
  // a sea of gold haze far below the floating places (fog does the rest)
  { const sea = new THREE.Mesh(new THREE.CircleGeometry(420, 48), new THREE.MeshBasicMaterial({ color: 0xc8a27a })); sea.rotation.x = -PI / 2; sea.position.set(0, -26, -20); sea.userData.noBatch = true; scene.add(sea); W.sea = sea; }
  try { const sk = RZ.skyline({ center: [0, -20], radius: [170, 320], count: low ? 26 : 44, height: [40, 170], lit: 0.25, seed: 2302 }); const m = sk.mesh || sk; m.userData.noBatch = true; scene.add(m); } catch (e) { void e; }
  try { const mt = RZ.mountains({ center: [0, -40], radius: [260, 520], height: 140, seed: 2303, arc: [-PI * 0.75, -PI * 0.25] }); const m = mt.mesh || mt; scene.add(m); } catch (e) { void e; }
  // stopped rain: motes that hang, and some that fall upward (the inversion leaking in)
  const n = low ? 300 : 700, pos = new Float32Array(n * 3), r = rng(2304);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 120; pos[i * 3 + 1] = r() * 20; pos[i * 3 + 2] = 70 - r() * 165; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8e8ff, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.userData.noBatch = true; pts.frustumCulled = false; scene.add(pts);
  W.updaters.push((dt) => { const a = geo.attributes.position.array; for (let i = 0; i < n; i += 3) { a[i * 3 + 1] += dt * 0.6; if (a[i * 3 + 1] > 20) a[i * 3 + 1] = 0; } geo.attributes.position.needsUpdate = true; });
}

// ---------------------------------------------------------------------------------------------------------------------
// THE HALL: the torn floor of Test Hall Zero after 08:14:10, the ring cracked across
// ---------------------------------------------------------------------------------------------------------------------
function buildHall(game, K, M, W) {
  const { bat, solid, box, add, src, plane } = K, R = rng(2310);
  bat().box(M.rock, -11, -9, 52, 11, -0.6, 75); bat().box(M.rock, -7, -15, 56, 6, -9, 70);
  solid(M.floor, -11, -0.6, 54, 11, 0, 74);
  for (const [x0, z0, x1, z1] of [[-6.4, 60.8, 6.4, 61.1], [-6.4, 60.8, -6.1, 71], [6.1, 60.8, 6.4, 71]]) bat().box(M.yellow, x0, 0, z0, x1, 0.012, z1);
  // broken walls on three sides (the south end is open to the void)
  let x = -11; while (x < 11) { const l = 1.5 + R() * 2.5, h = 1 + R() * 6; solid(M.wall, x, 0, 73.6, Math.min(11, x + l), h, 74.1); x += l; }
  for (const sx of [-1, 1]) { let z = 56; while (z < 74) { const l = 1.4 + R() * 2.6, h = 0.8 + R() * 5.5; solid(M.wall, sx * 11 - 0.25, 0, z, sx * 11 + 0.25, h, Math.min(74, z + l)); z += l; } }
  box(-11.5, 0, 53.8, -3, 3, 54.2); box(3, 0, 53.8, 11.5, 3, 54.2);
  bat().box(M.yellow, -11, 0, 53.9, -3, 0.9, 54.1); bat().box(M.yellow, 3, 0, 53.9, 11, 0.9, 54.1);
  // the ring, cracked and lying on its cradle (it has done its work)
  const ring = chronolith(1.0, { color: 0xffd27a, power: 0.08 }); ring.position.set(-0.4, 2.2, 67.5); ring.rotation.set(0.5, 0.3, 0.12); add(ring); W.hallRing = ring;
  W.updaters.push((dt, t) => ring.userData.update(t));
  bat().box(M.steel, -3.6, 0, 66, 3.2, 0.7, 69); box(-3.6, 0, 66, 3.2, 1.2, 69);
  // Rook's console, toppled; the visitors' benches pushed by the blast
  solid(M.panel, 6.2, 0, 64.8, 8.4, 1.0, 66.2); bat().boxc(M.black, 7.3, 1.25, 65.5, 1.8, 0.7, 0.06, 0, -0.5);
  for (let i = 0; i < 4; i++) { const bx = -8 + i * 1.6, bz = 70.5 + (i % 2) * 0.6; bat().boxc(M.wood, bx, 0.45, bz, 1.4, 0.08, 0.4, 0.2 * (i - 1.5)); }
  // the bridge of other places' paving: setts, asphalt, ward tile, stone
  const mats = [M.cobble, M.asphalt, M.tile, M.stone];
  for (let i = 0; i < 6; i++) solid(mats[i % 4], -3, -0.5, 48 + i, 3, 0, 49 + i);
  for (const sx of [-1, 1]) { solid(M.steel, sx * 3 - 0.06, 0, 48, sx * 3 + 0.06, 1.05, 54); }
  plane(signTex('m23hz', [['TEST HALL ZERO', 36, '#e8eef0'], ['19.10.2026 · 08:14:10', 22, '#ffd27a']], { bg: '#1a1e24', h: 130 }), 2.2, 0.66, 9, 3.4, 73.5, PI, 0.4);
  src(-0.4, 3, 66, 0xffd27a, 3, 12); src(7, 2, 64, 0x9fd8ff, 1.5, 6);
  K.finish();
}

// ---------------------------------------------------------------------------------------------------------------------
// THE AVENUE: the opening streets in 2026, 2049 (the Zero Second) and 2196
// ---------------------------------------------------------------------------------------------------------------------
function buildAvenue(game, K, M, W, low, scene) {
  const { bat, solid, box, add, plane, src } = K, R = rng(2320);
  const A26 = 'a26', A49 = 'a49', A96 = 'a96', N96 = ['a26', 'a49'];
  // ground: road and pavements; the sinkhole (z 12..20) has no road in 2196
  for (const [z0, z1, e] of [[20, 48, null], [8, 12, null], [12, 20, N96]]) {
    solid(e ? M.asphalt : M.asphalt, -7, -0.6, z0, 7, 0, z1, e); solid(M.pave, -10, -0.6, z0, -7, 0.15, z1, e); solid(M.pave, 7, -0.6, z0, 10, 0.15, z1, e);
  }
  // the 2026 road is dry and new; paint the a26 look as a thin overlay
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 40), M.dryAsphalt); m.rotation.x = -PI / 2; m.position.set(0, 0.006, 28); m.userData.noBatch = true; m.receiveShadow = true; add(m, A26); }
  // the sinkhole in 2196: a black pit with broken edges and hanging roots
  { const pit = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), M.hole); pit.rotation.x = -PI / 2; pit.position.set(0, -5, 16); pit.userData.noBatch = true; add(pit, A96);
    for (let i = 0; i < 12; i++) bat(A96).boxc(M.dryAsphalt, -9 + i * 1.6, -0.3 - R() * 0.4, 12 + (i % 2) * 7.7 + R() * 0.3, 1.5, 0.6, 0.7, R() * 0.4, (R() - 0.5) * 0.5, (R() - 0.5) * 0.3);
    for (const sx of [-1, 1]) bat(A96).box(M.rock, sx * 10, -6, 12, sx * 10.6, 0, 20); bat(A96).box(M.rock, -10, -6, 11.6, 10, -0.6, 12); bat(A96).box(M.rock, -10, -6, 20, 10, -0.6, 20.4); }
  // the walls of the street (buildings stand behind these)
  box(-10.6, 0, 8, -10, 12, 48); box(10, 0, 8, 10.6, 12, 48);
  // buildings: one block per era (the same lots), plus the station frontage on the west side
  const lots = [];
  const lot = (x0, x1, z0, z1, face, o) => { const yaw = face === '+x' ? PI / 2 : -PI / 2; lots.push({ width: z1 - z0, depth: x1 - x0, position: [(x0 + x1) / 2, 0, (z0 + z1) / 2], yaw, groundFloor: 4.2, ...o }); };
  [[8, 18], [18, 30], [42, 50]].forEach(([a, b], i) => lot(-26, -10.2, a, b, '+x', { height: 20 + R() * 18, seed: 400 + i, wall: ['brick', 'panel', 'concrete'][i], faces: ['shop', 'windows', 'blank', 'windows'] }));
  [[8, 20], [20, 33], [33, 50]].forEach(([a, b], i) => lot(10.2, 26, a, b, '-x', { height: 18 + R() * 20, seed: 410 + i, wall: ['darkBrick', 'plaster', 'panel'][i], faces: ['shop', 'windows', 'blank', 'windows'] }));
  try {
    const b49 = RZ.cityBlock(lots.map(b => ({ ...b, led: 0.55, holo: 1, cables: true })), { era: '2049', lit: 0.5, daylight: 0, detail: low ? 'low' : undefined }); b49.mesh.castShadow = false; add(b49.mesh, A49);
    const b96 = RZ.cityBlock(lots.map((b, i) => ({ ...b, ruin: 0.7, moss: 0.5, collapse: i % 2 === 0 })), { era: '2196', lit: 0, daylight: 0.5, detail: low ? 'low' : undefined }); b96.mesh.castShadow = false; add(b96.mesh, A96);
    const b26 = RZ.cityBlock(lots.map(b => ({ ...b, height: b.height * 0.8 })), { era: '2026', lit: 0.1, daylight: 1, detail: low ? 'low' : undefined }); b26.mesh.castShadow = false; add(b26.mesh, A26);
  } catch (e) { console.warn('m23 avenue blocks', e); }
  // Central Station's frontage (west, z 30..42): columns, glass, the sign; in 2196 the sign hangs by one bolt
  for (let z = 30.5; z <= 41.5; z += 2.2) solid(M.stone, -10.2, 0, z - 0.3, -9.6, 7, z + 0.3);
  bat().box(M.stone, -10.4, 7, 30, -9.4, 8.2, 42); box(-10.2, 0, 30, -9.6, 7, 42);
  bat(N96).box(M.glass, -10.1, 0.15, 30, -10.0, 6.8, 42);
  plane(TEX.station(), 5.2, 1.7, -9.3, 7.6, 36, PI / 2, 0.8, A49);
  plane(TEX.station(), 5.2, 1.7, -9.3, 7.6, 36, PI / 2, 0.2, A26);
  { const s = plane(TEX.station(), 5.2, 1.7, -9.3, 6.6, 36, PI / 2, 0.05, A96); s.rotation.z = 0.25; }
  plane(TEX.board(), 1.8, 1.0, -9.35, 3.4, 33.2, PI / 2, 1.0, A49);
  // the clock over the station door (08:14 in 2049 and 2026's open-day morning, stopped in 2196)
  plane(TEX.stationClock(14), 1.4, 1.4, -9.3, 5.4, 39.8, PI / 2, 0.6, A49); plane(clockTex('a26', { hands: [7, 52], label: 'RAIN CITY' }), 1.4, 1.4, -9.3, 5.4, 39.8, PI / 2, 0.3, A26);
  // CHECKPOINT C (2049): the gate across the street, the booth, barrier arms, signs
  solid(M.steel, -10, 0, 23.6, 10, 3.1, 24.4, A49);
  for (let xx = -9.5; xx <= 9.5; xx += 1.9) bat(A49).box(M.red, xx - 0.05, 0.3, 23.55, xx + 0.05, 2.9, 23.6);
  plane(TEX.checkpoint(), 4.6, 1.8, 0, 4.1, 24.5, 0, 0.9, A49);
  solid(M.panel, 8.2, 0.15, 25.4, 10, 2.8, 28.6, A49); bat(A49).box(M.glass, 8.1, 1.2, 25.6, 8.2, 2.4, 28.4); bat(A49).box(M.dark, 8.0, 2.8, 25.2, 10.2, 3.0, 28.8);
  bat(A49).box(glowMat(0xff4d5e, 1.6), -10, 3.1, 23.9, 10, 3.18, 24.1);
  src(0, 4, 25.5, 0xff4d5e, 3, 12, A49); src(-8.6, 4, 36, 0xffd34a, 2.4, 9, A49);
  // the hoarding (2026): plywood and printed panels; a site cabin; the shard in the corner
  solid(M.ply, -10, 0, 23.7, 10, 2.5, 24.3, A26);
  for (let i = 0; i < 4; i++) plane(TEX.hoarding(), 4.6, 1.15, -7.4 + i * 4.9, 1.4, 24.35, 0, 0.12, A26);
  solid(M.panel, -9.8, 0.15, 26.6, -7.4, 2.7, 29, A26); bat(A26).box(M.yellow, -9.8, 2.7, 26.6, -7.4, 2.8, 29);
  // the rubble (2196): a fallen overpass across the street; one gap to crawl under (x 4.6..7.4)
  solid(M.dryAsphalt, -10, 0, 22, 4.6, 2.9, 26, A96); solid(M.dryAsphalt, 7.4, 0, 22, 10, 2.9, 26, A96);
  solid(M.dark, 4.4, 1.62, 21.6, 7.6, 2.9, 26.4, A96);
  for (let i = 0; i < 16; i++) bat(A96).boxc(i % 3 ? M.dryAsphalt : M.dark, -10 + R() * 20, 2.6 + R() * 0.9, 21.5 + R() * 5, 1 + R() * 2.4, 0.5 + R() * 0.6, 1 + R() * 2, R() * PI, (R() - 0.5) * 0.6, (R() - 0.5) * 0.5);
  for (let i = 0; i < 8; i++) bat(A96).cyl(M.rust, 4.6 + R() * 2.8, 1.7, 22 + R() * 4, 0.02, 0.4, 5, [R(), 0, R()]);
  // the stalled tram (2049) on the far side of the gate; the frozen passengers sit inside
  box(3.4, 0, 9.2, 6.2, 3.3, 19.8, A49);   // the tram: collision as one block, drawn as a shell you can see into
  { const tb = bat(A49); tb.box(M.dark, 3.4, 0.2, 9.2, 6.2, 0.45, 19.8); tb.box(M.panel, 3.4, 3.0, 9.2, 6.2, 3.3, 19.8);
    for (const x of [3.4, 6.1]) { tb.box(M.panel, x, 0.45, 9.2, x + 0.1, 1.2, 19.8); tb.box(M.panel, x, 2.6, 9.2, x + 0.1, 3.0, 19.8); for (let z = 9.2; z <= 19.8; z += 2.65) tb.box(M.panel, x, 1.2, z - 0.08, x + 0.1, 2.6, z + 0.08); }
    tb.box(M.panel, 3.4, 0.45, 9.2, 6.2, 3.0, 9.3); tb.box(M.panel, 3.4, 0.45, 19.7, 6.2, 3.0, 19.8); tb.box(M.glass, 3.42, 1.2, 9.3, 3.46, 2.6, 19.7);
    for (let z = 10.2; z < 19.4; z += 1.4) { tb.box(M.wood, 5.4, 0.45, z - 0.3, 6.05, 0.9, z + 0.3); tb.box(M.wood, 3.55, 0.45, z - 0.3, 4.2, 0.9, z + 0.3); }
    tb.box(glowMat(0xffe8c0, 1.2), 4.6, 2.95, 9.6, 5.0, 3.0, 19.4); }
  bat(A49).box(glowMat(0xffd34a, 1.1), 3.3, 3.0, 9.4, 3.36, 3.12, 19.6); plane(TEX.tramSign(), 1.6, 0.5, 3.3, 2.9, 18.9, -PI / 2, 0.8, A49);
  bat(A49).box(M.steel, 4.6, 3.3, 9.4, 4.7, 5.6, 9.6); src(4, 3.4, 14.5, 0xffe0b0, 2, 7, A49);
  // in 2026 a delivery van stands there; in 2196 the tram's shell is in the sinkhole
  solid(M.panel, 3.6, 0, 13, 6.0, 2.5, 18, A26);
  bat(A96).boxc(M.rust, 4.8, -3.4, 15.5, 2.6, 3, 10, 0.1, 0.35, 0.2);
  // the bronze statue of Kai (2196), fallen; plaque
  bat(A96).boxc(M.stone, -5.2, 0.6, 41.5, 2.2, 1.2, 2.2, 0.2); box(-6.3, 0, 40.4, -4.1, 1.2, 42.6, A96);
  const fig = new THREE.Group(); fig.position.set(-3.9, 0.35, 39.3); fig.rotation.set(0, 0.6, PI / 2 - 0.1);
  for (const [px, py, pz, sx, sy, sz] of [[0, 0.9, 0, 0.5, 0.75, 0.3], [0, 1.45, 0, 0.22, 0.26, 0.24], [-0.12, 0.3, 0, 0.18, 0.62, 0.2], [0.12, 0.3, 0, 0.18, 0.62, 0.2], [-0.34, 0.95, 0.15, 0.13, 0.62, 0.13], [0.36, 1.25, 0.05, 0.13, 0.58, 0.13]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M.bronze); m.position.set(px, py, pz); fig.add(m); }
  fig.traverse(o => { o.userData.noBatch = true; o.castShadow = true; }); add(fig, A96); box(-5.2, 0, 38.4, -2.6, 0.7, 40.2, A96);
  plane(TEX.plaque(), 1.2, 0.6, -5.2, 0.7, 42.62, 0, 0.15, A96);
  // streets: furniture per era
  try {
    const k49 = streetKit({ era: '2049', seed: 2321 });
    k49.kerb([[-7, 48], [-7, 8]]).kerb([[7, 8], [7, 48]]).markings({ lanes: [{ from: [0, 48], to: [0, 8] }], crossings: [{ at: [0, 30], yaw: PI / 2, width: 13 }] })
      .scatter('lamp', [[8.6, 46], [8.6, 10]], { spacing: 12, turn: -PI / 2, y: 0.15 }).scatter('lamp', [[-8.6, 44], [-8.6, 12]], { spacing: 16, turn: PI / 2, y: 0.15, offset: 4 })
      .car([-4.2, 0, 40, 0], 0).car([-4.0, 0, 30.6, 0.1], 0.1).add('bollard', [-1.5, 0, 25.6]).add('bollard', [1.5, 0, 25.6]).add('kiosk', [8.6, 0.15, 42], -PI / 2)
      .puddles([[-2, 44, 1.6], [3, 34, 1.4], [-3, 28, 1.8], [1, 10, 1.6]]).rails([[2.4, 48], [2.4, 8]], { embedded: true })
      .cables([[[-10, 9, 40], [10, 8.6, 38]], [[-10, 9, 18], [10, 9, 16]]]);
    add(k49.build(), A49); for (const c of k49.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2], A49);
    const k26 = streetKit({ era: '2026', seed: 2322 });
    k26.kerb([[-7, 48], [-7, 8]]).kerb([[7, 8], [7, 48]]).markings({ lanes: [{ from: [0, 48], to: [0, 8] }] })
      .scatter('lamp', [[8.6, 46], [8.6, 10]], { spacing: 14, turn: -PI / 2, y: 0.15 }).add('cone', [-2, 0, 25.2]).add('cone', [0, 0, 25.4]).add('cone', [2, 0, 25.2]).add('barrier', [5, 0, 26], 0)
      .car([4.2, 0, 38, PI], PI).add('bench', [-8.6, 0.15, 45], PI / 2);
    add(k26.build(), A26); for (const c of k26.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2], A26);
    const k96 = streetKit({ era: '2196', seed: 2323 });
    k96.kerb([[-7, 48], [-7, 8]], { weeds: 0.8 }).kerb([[7, 8], [7, 48]], { weeds: 0.8 }).car([4.2, 0, 34, PI + 0.3], PI + 0.3).add('rubble', [-6, 0, 31], 1).add('rubble', [6.5, 0, 45], 2)
      .scatter('lamp', [[8.6, 46], [8.6, 26]], { spacing: 12, turn: -PI / 2, y: 0.15 });
    k96.overgrowth({ area: [-10, 26, 10, 48] }, { density: low ? 0.5 : 0.9, cracks: 0.8 });
    add(k96.build(), A96); for (const c of k96.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2], A96);
  } catch (e) { console.warn('m23 street', e); }
  // rain over the Zero Second street (2049): camera-following streaks
  try { const rain = RZ.particles({ kind: 'rain', count: low ? 1800 : 4500, area: [24, 16, 24] }); rain.userData.noBatch = true; scene.add(rain); rain.visible = false; W.rain = rain; } catch (e) { void e; }
  src(8, 5, 44, 0xffb070, 2, 10, A26); src(-4, 4, 40, 0xb6ff8a, 1, 8, A96);
  K.finish();
}

// ---------------------------------------------------------------------------------------------------------------------
// THE CONFLUENCE: where every place meets; the fracture wall and its three seals
// ---------------------------------------------------------------------------------------------------------------------
function buildPlaza(game, K, M, W) {
  const { bat, solid, box, add, plane, src } = K, R = rng(2330);
  // paving: four kinds meeting in seams (setts, asphalt, ward tile, stone)
  solid(M.cobble, -16, -0.6, -14, 0, 0, -3); solid(M.asphalt, 0, -0.6, -14, 16, 0, -3); solid(M.stone, -16, -0.6, -3, 0, 0, 8); solid(M.tile, 0, -0.6, -3, 16, 0, 8);
  bat().box(glowMat(0xffd27a, 0.8), -16, 0.002, -3.04, 16, 0.012, -2.96); bat().box(glowMat(0xffd27a, 0.8), -0.04, 0.002, -14, 0.04, 0.012, 8);
  // edges: broken walls of four eras with gaps west and east (z -6..2) and south (x -10..10)
  const run = (axis, c, a0, a1, mat, hmax) => { let a = a0; while (a < a1 - 0.01) { const l = Math.min(a1 - a, 1.4 + R() * 2.4), h = 1.2 + R() * hmax; if (axis === 'x') solid(mat, a, 0, c - 0.3, a + l, h, c + 0.3); else solid(mat, c - 0.3, 0, a, c + 0.3, h, a + l); a += l; } };
  run('z', -16.3, -14, -6, M.stone, 4); run('z', -16.3, 2, 8, M.brick, 3); run('z', 16.3, -14, -6, M.dark, 5); run('z', 16.3, 2, 8, M.wall, 3);
  run('x', 8.3, -16, -10, M.brick, 3); run('x', 8.3, 10, 16, M.wall, 3);
  // the fracture wall: a curtain of light hung between broken arches, three seals; its centre opens when they are lit
  for (const xx of [-16, -10, -3.2, 3.2, 10, 16]) solid(M.stoneDark, xx - 0.5, 0, -14.5, xx + 0.5, 9 + R() * 3, -13.5);
  bat().box(M.stoneDark, -16.5, 9, -14.5, -3, 10.2, -13.5); bat().box(M.stoneDark, 3, 9.5, -14.5, 16.5, 10.6, -13.5);
  W.wallSide = [box(-16, 0, -14.3, -2.7, 12, -13.7), box(2.7, 0, -14.3, 16, 12, -13.7)];
  W.wallMid = box(-2.7, 0, -14.3, 2.7, 12, -13.7);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(32, 12), veilMaterial(0xffc8a0)); veil.position.set(0, 6, -14); veil.userData.noBatch = true; add(veil); W.veil = veil;
  W.updaters.push((dt, t) => { veil.material.uniforms.uTime.value = t; });
  for (const [k, p] of Object.entries(P.seals)) {
    const g = new THREE.Group(); g.position.set(...p);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 8, 40), glowMat(0x7a7a80, 0.4)); g.add(ring);
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), new THREE.MeshBasicMaterial({ color: 0x202024, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); g.add(core);
    g.traverse(o => { o.userData.noBatch = true; }); add(g); W.seals[k] = { g, ring, core };
  }
  // the stopped clock with no hands, on a cast-iron post
  bat().cyl(M.black, P.clock[0], 1.8, P.clock[2], 0.09, 3.6, 10); bat().cyl(M.black, P.clock[0], 0.15, P.clock[2], 0.25, 0.3, 12); box(P.clock[0] - 0.2, 0, P.clock[2] - 0.2, P.clock[0] + 0.2, 3.6, P.clock[2] + 0.2);
  bat().cyl(M.black, P.clock[0], 4.05, P.clock[2], 0.62, 0.22, 24, [PI / 2, 0, 0]);
  for (const s of [1, -1]) plane(clockTex('nohands'), 1.1, 1.1, P.clock[0], 4.05, P.clock[2] + s * 0.115, s > 0 ? 0 : PI, 0.35);
  // things that drifted here: a tram stop from 2049, a settlement well, a 2196 barricade, a hospital gurney
  solid(M.stone, -13, 0, -11, -11.2, 0.8, -9.2); bat().cyl(M.wood, -12.1, 1.5, -10.1, 0.05, 1.4, 6);
  solid(M.rust, 11, 0, -11.5, 14.5, 1.3, -10.8); for (let i = 0; i < 5; i++) bat().boxc(M.wood, 12.6 + R() * 1.4, 1.4, -11.2, 0.15, 1.6, 0.15, 0, 0, (R() - 0.5) * 0.6);
  solid(M.steel, 11.5, 0, 4, 13.5, 0.9, 4.8); bat().box(M.tile, 11.5, 0.9, 4, 13.5, 0.95, 4.8);
  try { const k = streetKit({ era: '2049', seed: 2331 }); k.shelter([-13.6, 0, 5.5], PI / 2).add('bench', [6, 0, 5.8], PI).add('lamp', [-6, 0, -12.5]).add('lamp', [6, 0, -12.5]); add(k.build()); for (const c of k.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2]); } catch (e) { void e; }
  plane(signTex('m23west', [['◄ THE SETTLEMENT', 26, '#ffd8a0']], { bg: '#2a2018', h: 70 }), 2.2, 0.36, -15.9, 2.6, 3, PI / 2, 0.5);
  plane(signTex('m23east', [['THE FUTURE CITY ►', 26, '#b6ff8a']], { bg: '#1a2018', h: 70 }), 2.2, 0.36, 15.9, 2.6, 3, -PI / 2, 0.5);
  src(0, 6, -12, 0xffc8a0, 3, 16); src(P.clock[0], 4, P.clock[2], 0xffe8c0, 1.2, 6);
  K.finish();
}

// ---------------------------------------------------------------------------------------------------------------------
// THE SETTLEMENT: the keepers' valley; three hearths, the mural, the stream, the shrine
// ---------------------------------------------------------------------------------------------------------------------
function buildSettlement(game, K, M, W, low) {
  const { bat, solid, box, add, plane, src } = K, R = rng(2340);
  // ground: the near bank (x -40..-16), the far bank (x -62..-46); the stream between has no floor
  solid(M.dirt, -40, -0.6, -24, -16, 0, 14); solid(M.dirt, -62, -0.6, -24, -46, 0, 14);
  { const gm = new THREE.Mesh(new THREE.PlaneGeometry(24, 38), M.grass); gm.rotation.x = -PI / 2; gm.position.set(-28, 0.01, -5); gm.userData.noBatch = true; gm.receiveShadow = true; add(gm);
    const g2 = gm.clone(); g2.scale.set(16 / 24, 1, 1); g2.position.set(-54, 0.01, -5); add(g2); }
  try { const gr = RZ.instancedGrass({ heightAt: () => 0, mask: (x, z) => (x > -40 && x < -17 && Math.abs(z + 5) < 18 && Math.hypot(x + 30, z + 2) > 8) || (x < -47 && x > -61) ? 1 : 0, rect: [-62, -24, 46, 38], radius: low ? 14 : 22, height: 0.4, color: 0x4f6a2a, tipColor: 0xa0a050 }); add(gr.mesh); } catch (e) { void e; }
  // stream banks and the water
  bat().box(M.stone, -40.6, -2, -24, -40, 0.05, 14); bat().box(M.stone, -46, -2, -24, -45.4, 0.05, 14);
  try { const w = RZ.water({ rect: [-46, -24, 6, 38], level: -0.45, heightAt: () => -2, deep: 0x123a3a, shallow: 0x2f5a4c, flow: [0, 0.6] }); add(w.mesh || w); } catch (e) { void e; const wm = new THREE.Mesh(new THREE.PlaneGeometry(6, 38), new THREE.MeshStandardMaterial({ color: 0x1a4a4a, roughness: 0.1, metalness: 0.3 })); wm.rotation.x = -PI / 2; wm.position.set(-43, -0.45, -5); add(wm); }
  bat().box(M.dirt, -46, -2.4, -24, -40, -2, 14);
  // the stepping stones (raised when the hearths burn in the right order)
  for (const [x, z] of P.stones) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.9, 9), M.stone); m.position.set(x, -1.4, z); m.userData.noBatch = true; m.castShadow = true; add(m);
    const b = box(x - 0.7, -0.8, z - 0.7, x + 0.7, 0.05, z + 0.7); b.enabled = false; W.stones.push({ m, b, x, z });
  }
  // valley walls: hills of rock north, south and west; the stream runs out under them
  for (const [x0, z0, x1, z1] of [[-62, 14, -16, 15.5], [-62, -25.5, -16, -24], [-63.5, -24, -62, 14]]) solid(M.rock, x0, 0, z0, x1, 3.5 + R() * 2, z1);
  solid(M.rock, -16.6, 0, 8, -15.8, 3.2, 14); solid(M.rock, -16.6, 0, -24, -15.8, 3.2, -14);
  try { add(RZ.rocks({ placements: Array.from({ length: low ? 10 : 18 }, (_, i) => ({ x: -60 + i * 2.6, z: (i % 2 ? 15.8 : -25.6), scale: 1.4 + R() * 1.4, yaw: R() * 6 })), heightAt: () => 0, variants: 3, moss: 0.5 })); } catch (e) { void e; }
  try { add(RZ.forest({ species: 'broadleaf', placements: [{ x: -58, z: 12, scale: 0.9 }, { x: -20, z: -21, scale: 0.8 }, { x: -38, z: 12.5, scale: 0.7 }, { x: -60, z: -20, scale: 1 }, { x: -48, z: -22, scale: 0.8 }], heightAt: () => 0, impostors: false, variants: 2, seed: 2341 })); } catch (e) { void e; }
  // houses (merged: five draws)
  try {
    const H = [
      { position: [-22.5, 0, 10], round: true, radius: 2.6, wall: 'mud', seed: 1 }, { position: [-29.5, 0, 10.5], yaw: 0.1, width: 5, depth: 4, height: 2.6, wall: 'stone', roof: 'thatch', door: true, seed: 2 },
      { position: [-21.5, 0, -18], yaw: PI, width: 5.5, depth: 4.2, height: 2.6, wall: 'timber', roof: 'thatch', door: true, seed: 3 }, { position: [-37, 0, -19], round: true, radius: 2.4, wall: 'mud', seed: 4 },
      { position: [-55, 0, 9.5], yaw: 0.2, width: 5, depth: 4, height: 2.5, wall: 'stone', roof: 'thatch', door: true, seed: 5 }, { position: [-57, 0, -16], round: true, radius: 2.8, wall: 'mud', seed: 6 },
    ];
    const v = RZ.settlement(H, { colors: { thatch: 0x9a7a45 } }); add(v.group);
    box(-25.1, 0, 7.4, -19.9, 3, 12.6); box(-32.1, 0, 8.4, -26.9, 3, 12.6); box(-24.3, 0, -20.1, -18.7, 3, -15.9); box(-39.4, 0, -21.4, -34.6, 3, -16.6); box(-57.6, 0, 7.4, -52.4, 3, 11.6); box(-59.8, 0, -18.8, -54.2, 3, -13.2);
  } catch (e) { console.warn('m23 houses', e); }
  // the ember bowl, the three hearths with their carved stones
  const fireMat = glowMat(0xff8a30, 2.6);
  { const [x, , z] = P.ember; bat().cyl(M.stoneDark, x, 0.35, z, 0.5, 0.7, 12, [0, 0, 0], 0.35); box(x - 0.5, 0, z - 0.5, x + 0.5, 0.7, z + 0.5);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), fireMat); e.position.set(x, 0.78, z); e.userData.noBatch = true; add(e); W.emberGlow = e; src(x, 1.2, z, 0xff8a30, 1.2, 5); }
  for (const [k, [x, , z]] of Object.entries(P.hearths)) {
    for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; bat().boxc(M.stoneDark, x + Math.cos(a) * 0.85, 0.15, z + Math.sin(a) * 0.85, 0.36, 0.3, 0.28, -a); }
    for (let i = 0; i < 4; i++) bat().boxc(M.wood, x, 0.12, z, 1.1, 0.1, 0.1, i * 0.8);
    box(x - 0.9, 0, z - 0.9, x + 0.9, 0.3, z + 0.9);
    bat().boxc(M.stone, x + 1.25, 0.45, z, 0.25, 0.9, 0.5); plane(TEX.hearthSign(k), 0.44, 0.44, x + 1.38, 0.6, z, PI / 2, 0.1);
    const fire = new THREE.Group(); fire.position.set(x, 0.15, z);
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.06, 0.8 + i * 0.25, 7), fireMat); f.position.set((i - 1) * 0.12, 0.4 + i * 0.12, (i % 2) * 0.1); fire.add(f); }
    fire.traverse(o => { o.userData.noBatch = true; }); fire.visible = false; add(fire);
    W.hearths[k] = { fire, x, z, lit: false };
  }
  W.updaters.push((dt, t) => { for (const h of Object.values(W.hearths)) if (h.fire.visible) h.fire.children.forEach((f, i) => { f.scale.y = 0.85 + Math.sin(t * 7 + i * 2) * 0.15; }); });
  // the mural wall: three panels, the middle one smeared; Residue Vision shows the echo of its paint
  { const [x, , z] = P.mural; solid(M.mud, x - 4, 0, z - 0.4, x + 4, 3.4, z + 0.4); bat().box(M.wood, x - 4.3, 3.4, z - 0.7, x + 4.3, 3.6, z + 0.7);
    plane(TEX.mural(false), 7.4, 2.8, x, 1.8, z + 0.42, 0, 0.12);
    const r = plane(TEX.mural(true), 7.4, 2.8, x, 1.8, z + 0.45, 0, 1.2, null, { transparent: true }); r.material.depthWrite = false; game.residue(r); W.muralResidue = r; }
  // the shrine on the far bank: standing stones in a ring; the tally stone with seventeen marks
  { const [x, , z] = P.shrine; for (let i = 1; i < 7; i++) { const a = i / 7 * PI * 2, sx = x + Math.cos(a) * 3.4, sz = z + Math.sin(a) * 3.4; bat().boxc(M.stone, sx, 1.1, sz, 0.7, 2.2 + (i % 3) * 0.4, 0.45, -a + PI / 2); box(sx - 0.4, 0, sz - 0.4, sx + 0.4, 2.2, sz + 0.4); }
    solid(M.stoneDark, x - 0.6, 0, z - 0.6, x + 0.6, 0.8, z + 0.6); plane(TEX.tally(), 0.9, 0.45, x, 0.45, z + 0.62, 0, 0.1);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), glowMat(0x9fe8ff, 2.2)); glow.position.set(x, 1.05, z); glow.userData.noBatch = true; add(glow); W.settleThread = glow; src(x, 1.6, z, 0x9fe8ff, 1.0, 5); }
  // the Helix card in the threshold stone (M4) and baskets, pots, a loom
  plane(signTex('m23card', [['HELIX', 22, '#38c8c0'], ['K. VAREN', 16, '#e8eef0']], { bg: '#20262c', h: 120, w: 200 }), 0.2, 0.12, P.helixCard[0], 0.06, P.helixCard[2], 0, 0.2, null, { rx: -PI / 2 });
  try { const k = streetKit({ era: 'ancient', seed: 2342 }); k.add('well', [-27, 0, -12]).add('pot', [-23.4, 0, 6.6]).add('pot', [-23.9, 0, 6.2]).add('cart', [-34, 0, 7.5], 0.4).add('stall', [-19.6, 0, -8.5], PI / 2).add('fence', [-50, 0, 12], 0).add('barrel', [-52.5, 0, 6.5]).add('crate', [-30.5, 0, -18.4]); add(k.build()); for (const c of k.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2]); } catch (e) { void e; }
  try { add(RZ.particles({ kind: 'embers', count: low ? 40 : 90, center: [-30, 1.5, -3], area: [14, 3, 14], color: 0xffa050 })); } catch (e) { void e; }
  src(-28, 3, -2, 0xffc890, 1.4, 14);
  K.finish();
}

// ---------------------------------------------------------------------------------------------------------------------
// THE FUTURE CITY: 2196 Rain City; the parking deck, the skybridge over the fissure, Lantern Hall's roof
// ---------------------------------------------------------------------------------------------------------------------
function buildFuture(game, K, M, W, low) {
  const { bat, solid, box, add, plane, src, ramp } = K, R = rng(2350);
  const F49 = 'f49', F96 = 'f96', Y = P.deckY;
  // the street (x 16..32): cracked asphalt; the fissure beyond has no floor
  solid(M.dryAsphalt, 16, -0.6, -20, 32, 0, 14);
  solid(M.rock, 16, 0, 14, 32, 4, 15.5); solid(M.rock, 16, 0, -21.5, 32, 4, -20);
  solid(M.rock, 15.8, 0, 8, 16.6, 3.2, 14); solid(M.rock, 15.8, 0, -20, 16.6, 3.2, -14);
  for (let i = 0; i < 6; i++) solid(M.steel, 31.9, 0, -20 + i * 5.7, 32.05, 1.1, -20 + i * 5.7 + 5.4);
  bat().box(M.rust, 31.85, 0.95, -20, 32.1, 1.05, 14);
  // the fissure: torn rock walls going down, a glow from very far below
  bat().box(M.rock, 32, -30, 14, 50, -0.4, 16); bat().box(M.rock, 32, -30, -22, 50, -0.4, -20);
  for (let i = 0; i < 10; i++) bat().boxc(M.rock, 32.6 + R() * 1.2, -4 - R() * 10, -20 + i * 3.4, 2, 6, 3, R(), R() * 0.4, R() * 0.4);
  { const g = new THREE.Mesh(new THREE.PlaneGeometry(18, 36), new THREE.MeshBasicMaterial({ color: 0xff9a50, transparent: true, opacity: 0.25, toneMapped: false })); g.rotation.x = -PI / 2; g.position.set(41, -18, -3); g.userData.noBatch = true; add(g); }
  // the parking deck: a ramp up (x 20..25, z 12 -> -2), the deck (x 18..32, z -16..-2) on columns, parapets
  ramp([20, -0.4, -2], [25, Y, 12], '-z');
  { const len = Math.hypot(14, Y), m = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, len), M.dark); m.position.set(22.5, Y / 2 - 0.2, 5); m.rotation.x = Math.atan2(Y, 14); m.userData.noBatch = true; m.castShadow = true; m.receiveShadow = true; add(m); }
  for (const sx of [19.8, 25.2]) { bat().box(M.dark, sx - 0.15, 0, -2, sx + 0.15, Y + 1, 12); }
  box(19.6, 0, -2, 20, Y + 1.1, 12); box(25, 0, -2, 25.4, Y + 1.1, 12);
  solid(M.dark, 18, Y - 0.4, -16, 32, Y, -2);
  for (const [x, z] of [[18.5, -15.5], [24, -15.5], [31.5, -15.5], [18.5, -2.5], [31.5, -2.5], [24, -9]]) solid(M.dark, x - 0.3, 0, z - 0.3, x + 0.3, Y - 0.4, z + 0.3);
  solid(M.wall, 18, Y, -16.3, 32, Y + 1.0, -16); solid(M.wall, 17.7, Y, -16, 18, Y + 1.0, -2); solid(M.wall, 25.4, Y, -2, 32, Y + 1.0, -1.7); solid(M.wall, 18, Y, -2, 19.6, Y + 1.0, -1.7);
  solid(M.wall, 31.8, Y, -16, 32.1, Y + 1.0, -8.2); solid(M.wall, 31.8, Y, -4.8, 32.1, Y + 1.0, -2);
  // survivors' roof garden on the deck (optional): beds, a water drum
  for (let i = 0; i < 3; i++) { solid(M.wood, 26 + i * 1.8, Y, -15.4, 27.4 + i * 1.8, Y + 0.45, -12.6); bat().box(M.dirt, 26.1 + i * 1.8, Y + 0.45, -15.3, 27.3 + i * 1.8, Y + 0.5, -12.7); }
  try { add(RZ.forest({ species: 'broadleaf', placements: [{ x: 21, z: -12.5, y: Y, scale: 0.35 }], heightAt: () => Y, impostors: false, variants: 1, seed: 2351 })); } catch (e) { void e; }
  plane(TEX.garden(), 0.5, 0.62, P.garden[0], Y + 0.7, P.garden[2] + 1.6, 0, 0.15);
  // the skybridge (z -8..-5) at deck height: 2196 has a 6 m gap (x 37..43); 2049 is whole but shuttered at x 44
  const [bz0, bz1] = P.bridgeZ;
  solid(M.dark, 32, Y - 0.5, bz0, 37, Y, bz1, F96); solid(M.dark, 43, Y - 0.5, bz0, 50, Y, bz1, F96);
  for (let i = 0; i < 6; i++) bat(F96).boxc(M.dark, 37 + R() * 0.3, Y - 0.6 - i * 0.4, bz0 + 0.5 + R() * 2, 0.8, 0.3, 0.6, R(), R() * 0.6, R());
  for (let i = 0; i < 5; i++) bat(F96).cyl(M.rust, 37.1, Y - 0.4, bz0 + 0.4 + i * 0.6, 0.02, 1.2, 5, [0, 0, 1.2 + R() * 0.3]);
  solid(M.panel, 32, Y - 0.5, bz0, 50, Y, bz1, F49);
  for (const z of [bz0 - 0.1, bz1 + 0.1]) { solid(M.steel, 32, Y, z - 0.08, 37, Y + 1.1, z + 0.08, F96); solid(M.steel, 43, Y, z - 0.08, 50, Y + 1.1, z + 0.08, F96); solid(M.glass, 32, Y, z - 0.06, 50, Y + 1.2, z + 0.06, F49); bat(F49).box(M.steel, 32, Y + 1.2, z - 0.08, 50, Y + 1.3, z + 0.08); }
  bat(F49).box(M.panel, 32, Y + 2.6, bz0 - 0.2, 50, Y + 2.8, bz1 + 0.2); bat(F49).box(glowMat(0x38c8c0, 1.4), 32, Y + 2.58, bz0 + 1.4, 50, Y + 2.6, bz0 + 1.6);
  solid(M.red, P.shutterX, Y, bz0, P.shutterX + 0.5, Y + 2.6, bz1, F49);
  plane(signTex('m23shut', [['SECURITY SHUTTER', 30, '#ffd0d0'], ['HELIX TOWER LINK · CLOSED', 18, '#ff9aa4']], { bg: '#3a1a1a', h: 120 }), 2.2, 0.8, P.shutterX - 0.02, Y + 1.5, (bz0 + bz1) / 2, -PI / 2, 0.6, F49);
  src((32 + 50) / 2, Y + 2.2, -6.5, 0x38c8c0, 1.6, 10, F49);
  // Sera's plank (laid across the 2196 gap once she trusts you)
  W.plank = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 0.9), M.wood); W.plank.position.set(40, Y + 0.02, -6.5); W.plank.userData.noBatch = true; W.plank.visible = false; add(W.plank, F96);
  W.plankBox = box(36.6, Y - 0.2, -7, 43.4, Y + 0.05, -6, F96); W.plankBox.enabled = false;
  // Lantern Hall's building (x 50..64, z -18..2): a solid mass, the roof at deck height with parapets and the beacon
  solid(M.dark, P.b2[0], -14, P.b2[2], P.b2[1], Y, P.b2[3]);
  for (const [x0, z0, x1, z1] of [[50, -18.3, 64, -18], [63.7, -18, 64, 2], [50, 1.7, 64, 2], [49.7, -18, 50, -8.2], [49.7, -4.8, 50, 2]]) solid(M.wall, x0, Y, z0, x1, Y + 1.0, z1);
  try {
    const list96 = [{ width: 14, depth: 20, height: Y, position: [57, 0, -8], seed: 2352, wall: 'concrete', faces: ['windows', 'windows', 'windows', 'blank'], groundBlank: true, roof: { parapet: false } }];
    const b96 = RZ.cityBlock(list96.map(b => ({ ...b, ruin: 0.7, moss: 0.6 })), { era: '2196', lit: 0, daylight: 0.5, detail: 'low' }); add(b96.mesh, F96);
    const b49 = RZ.cityBlock(list96.map(b => ({ ...b, led: 0.5, cables: true })), { era: '2049', lit: 0.4, daylight: 0, detail: 'low' }); add(b49.mesh, F49);
    // the city around: ruined towers (2196) / Rain City towers (2049)
    const ring = [], R2 = rng(2353);
    for (let i = 0; i < (low ? 6 : 9); i++) { const a = -PI * 0.45 + i * 0.12 * PI, d = 46 + R2() * 10; ring.push({ width: 12 + R2() * 6, depth: 12 + R2() * 6, height: 24 + R2() * 40, position: [40 + Math.cos(a) * d, 0, -4 + Math.sin(a) * d], seed: 2360 + i, wall: R2() < 0.5 ? 'concrete' : 'brick', faces: ['windows', 'windows', 'windows', 'windows'], groundBlank: true }); }
    const r96 = RZ.cityBlock(ring.map(b => ({ ...b, ruin: 0.7, moss: 0.5, collapse: R2() < 0.5 })), { era: '2196', lit: 0, daylight: 0.4, detail: 'low' }); r96.mesh.castShadow = false; add(r96.mesh, F96);
    const r49 = RZ.cityBlock(ring.map(b => ({ ...b, led: 0.4 })), { era: '2049', lit: 0.4, daylight: 0, detail: 'low' }); r49.mesh.castShadow = false; add(r49.mesh, F49);
  } catch (e) { console.warn('m23 future blocks', e); }
  // Lantern Hall's beacon mast, the camp: tarps, crates, a lantern string
  { const [x, y, z] = P.beacon; bat().cyl(M.rust, x, y + 3.5, z, 0.14, 7, 8); bat().cyl(M.rust, x, y + 0.4, z, 0.6, 0.8, 10); box(x - 0.6, y, z - 0.6, x + 0.6, y + 7, z + 0.6);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), glowMat(0xffd27a, 0.3)); lamp.position.set(x, y + 7.3, z); lamp.userData.noBatch = true; add(lamp); W.beaconLamp = lamp;
    plane(TEX.lantern(), 2, 0.7, 49.62, Y + 1.6, -12, -PI / 2, 0.5); }
  for (let i = 0; i < 4; i++) solid(M.wood, 53 + i * 1.3, Y, -16.8, 54 + i * 1.3, Y + 0.8, -15.8);
  bat().boxc(new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.95, side: THREE.DoubleSide }), 60, Y + 2.2, -3, 5, 0.05, 4, 0, 0.15);
  for (let i = 0; i < 10; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), glowMat(0xffc070, 2)); l.position.set(51 + i * 1.2, Y + 2.4 - Math.sin(i / 9 * PI) * 0.4, -1.5); l.userData.noBatch = true; add(l, F96); }
  src(58, Y + 2.5, -6, 0xffc070, 2.2, 12, F96); src(25, Y + 2, -12, 0xffe0b0, 1.2, 9);
  try { const k = streetKit({ era: '2196', seed: 2354 }); k.car([27, 0, 8, 0.6], 0.6).add('rubble', [29, 0, -18], 1).add('rubble', [17.5, 0, 11], 0).add('barrier', [18, 0, -10], PI / 2); k.overgrowth({ area: [16, -20, 32, 14] }, { density: low ? 0.5 : 0.9, cracks: 0.9 }); add(k.build()); for (const c of k.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2]); } catch (e) { void e; }
  try { add(RZ.particles({ kind: 'dust', count: low ? 80 : 200, center: [40, 6, -6], area: [30, 10, 26], color: 0xffe0b0 })); } catch (e) { void e; }
  K.finish();
}

// ---------------------------------------------------------------------------------------------------------------------
// THE LABORATORY: Helix folded into the fracture; held doors, reversed lab hall, the seam, the last door
// ---------------------------------------------------------------------------------------------------------------------
function buildLab(game, K, M, W) {
  const { bat, solid, box, add, plane, src } = K, R = rng(2370);
  // floor: z -14..-37 and -46..-54; the seam between has none
  solid(M.tile, -8, -0.6, -37, 8, 0, -13.6); solid(M.tile, -8, -0.6, -54, 8, 0, -46);
  // walls (white panels, torn open in places to the sky), a broken ceiling
  for (const sx of [-1, 1]) { solid(M.panel, sx * 8, 0, -54, sx * 8 + sx * 0.4, 6, -14.5); for (let z = -50; z < -16; z += 6.5) bat().box(M.dark, sx * 7.95, 0, z, sx * 7.9, 6, z + 0.25); }
  for (let z = -52; z < -16; z += 4) if (R() < 0.6) bat().box(M.panel, -8, 6, z, 8, 6.3, z + 2 + R() * 2);
  bat().box(glowMat(0xe8f4ff, 1.2), -0.2, 5.9, -54, 0.2, 5.95, -14.5);
  plane(TEX.lab(), 3, 0.9, -7.85, 3.2, -16.5, PI / 2, 0.6);
  // door D1 (held by the Witness) and its frame
  solid(M.dark, -8, 0, -20.4, -3, 6, -19.6); solid(M.dark, 3, 0, -20.4, 8, 6, -19.6); bat().box(M.dark, -3, 3.4, -20.4, 3, 6, -19.6); box(-3, 3.4, -20.4, 3, 6, -19.6);
  W.doors.d1 = { m: new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 0.3), M.steel), b: box(-3, 0, -20.2, 3, 3.4, -19.8) };
  W.doors.d1.m.position.set(0, 1.7, -20); W.doors.d1.m.userData.noBatch = true; add(W.doors.d1.m);
  bat().box(glowMat(0xffd27a, 1.4), -3.1, 3.3, -20.45, 3.1, 3.4, -20.35);
  // the lab hall: benches pushed to the walls, a broken ring rig; three lanes where equipment slides backwards
  for (const z of [-22.5, -26, -30]) { solid(M.panel, -7.8, 0, z, -6.4, 0.95, z + 1.6); solid(M.panel, 6.4, 0, z, 7.8, 0.95, z + 1.6); }
  for (const z of P.lanes) {
    bat().box(glowMat(0xff6a4a, 0.6), -7.8, 0.005, z - 0.65, 7.8, 0.012, z - 0.6); bat().box(glowMat(0xff6a4a, 0.6), -7.8, 0.005, z + 0.6, 7.8, 0.012, z + 0.65);
    const items = [];
    for (let i = 0; i < 2; i++) { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.9), M.panel); c.position.y = 0.6; g.add(c);
      const sc = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), glowMat(0x38c8c0, 1.2)); sc.position.set(0, 1.2, 0.46); g.add(sc);
      for (const wx of [-0.45, 0.45]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8), M.black); wh.rotation.x = PI / 2; wh.position.set(wx, 0.1, 0); g.add(wh); }
      g.traverse(o => { o.userData.noBatch = true; o.castShadow = true; }); g.position.set(0, 0, z); add(g); items.push(g); }
    W.lanes.push({ z, items, ph: R() * 6 });
  }
  // console C1 and the plate
  solid(M.panel, 4.2, 0, -35.4, 6.2, 1.1, -34.2); bat().boxc(M.black, 5.2, 1.3, -34.6, 1.6, 0.6, 0.05, 0, -0.4);
  plane(TEX.anchor(), 1.4, 0.4, 5.2, 1.9, -34.15, 0, 0.6);
  W.consoleGlow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.5), glowMat(0xffd27a, 0.4)); W.consoleGlow.position.set(5.2, 1.13, -34.8); W.consoleGlow.userData.noBatch = true; add(W.consoleGlow);
  W.plate = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 28), glowMat(0x7a7a80, 0.4)); W.plate.position.set(P.plate[0], 0.03, P.plate[2]); W.plate.userData.noBatch = true; add(W.plate);
  // the seam: pieces of every era rising out of the dark and falling back up
  const seamMats = [M.cobble, M.asphalt, M.tile, M.stone];
  { const g = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ color: 0x9a7bff, transparent: true, opacity: 0.18, toneMapped: false })); g.rotation.x = -PI / 2; g.position.set(0, -10, -41.5); g.userData.noBatch = true; add(g); }
  for (const sx of [-1, 1]) bat().box(M.rock, sx * 8, -12, -46, sx * 8.4, 6, -37);
  for (let i = 0; i < P.plats.length; i++) {
    const z = P.plats[i], m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.7), seamMats[i % 4]); m.userData.noBatch = true; m.castShadow = true; m.receiveShadow = true;
    m.position.set((i - 1) * 1.2, -6, z); add(m);
    const b = box(m.position.x - 1.1, -6.6, z - 0.85, m.position.x + 1.1, -6, z + 0.85, null, { carry: true }); b.carry = true;
    W.plats.push({ m, b, z, x: m.position.x, ph: i * 1.6, y: -6 });
  }
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.4 + R() * 0.8, 0.3, 0.4 + R() * 0.6), seamMats[i % 4]); m.position.set(-7 + R() * 14, -3 - R() * 8, -37.5 - R() * 8); m.userData.noBatch = true; add(m); W.plats.push({ deco: true, m, ph: R() * 6, y0: m.position.y }); }
  // door D3: heavy, at the end of the far ledge
  solid(M.dark, -8, 0, P.d3z - 0.4, -2.5, 6, P.d3z + 0.4); solid(M.dark, 2.5, 0, P.d3z - 0.4, 8, 6, P.d3z + 0.4); solid(M.dark, -2.5, 3.6, P.d3z - 0.4, 2.5, 6, P.d3z + 0.4);
  W.doors.d3 = { m: new THREE.Mesh(new THREE.BoxGeometry(5, 3.6, 0.35), M.steel), b: box(-2.5, 0, P.d3z - 0.2, 2.5, 3.6, P.d3z + 0.2) };
  W.doors.d3.m.position.set(0, 1.8, P.d3z); W.doors.d3.m.userData.noBatch = true; add(W.doors.d3.m);
  bat().box(glowMat(0x9a7bff, 1.2), -2.6, 3.5, P.d3z + 0.42, 2.6, 3.6, P.d3z + 0.5);
  // a side alcove with a locker (shard) near the entrance
  solid(M.panel, -7.8, 0, -18.8, -6.6, 2, -16.4);
  src(0, 4, -18, 0xe8f4ff, 2, 10); src(0, 4, -30, 0xe8f4ff, 2, 12); src(0, 2, -41.5, 0x9a7bff, 2.4, 12); src(0, 4, -50, 0xe8f4ff, 1.6, 10);
  K.finish();
}

// ---------------------------------------------------------------------------------------------------------------------
// THE ORIGINAL CHRONOLITH: the stone terrace where every era collides
// ---------------------------------------------------------------------------------------------------------------------
function buildChron(game, K, M, W, low) {
  const { bat, solid, box, add, src } = K, R = rng(2380);
  solid(M.stone, -8, -0.6, -60, 8, 0, -54);
  { const g = new THREE.CylinderGeometry(16, 16, 0.6, 48); g.translate(0, -0.3, -76); const m = new THREE.Mesh(g, M.stone); m.receiveShadow = true; m.userData.noBatch = true; add(m); }
  for (let a = 0; a < 48; a++) { const t0 = a / 48 * PI * 2, x = Math.sin(t0) * 16, z = -76 + Math.cos(t0) * 16; if (z > -61 && Math.abs(x) < 5) continue; box(x - 1, -0.6, z - 1, x + 1, 1.2, z + 1); if (a % 2) bat().boxc(M.stoneDark, x, 0.4, z, 1.6, 0.8 + R() * 0.6, 0.5, t0); }
  box(-16, -0.6, -92, 16, 0, -60); // walkable disc (approximated by its bounding square inside the low wall ring)
  // concentric rings in the floor; the three ways marked by colour
  for (const r of [4, 8, 12]) { const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.06, r + 0.06, 96), glowMat(0xffd27a, 0.5)); m.rotation.x = -PI / 2; m.position.set(0, 0.01, -76); m.userData.noBatch = true; add(m); }
  // the ring itself, upright on its stone cradle, ancient and repaired
  const ring = chronolith(1.55, { color: 0x9a7bff, power: 0.5, stone: 0x2a2620 }); ring.position.set(...P.ring); add(ring); W.ring = ring;
  W.updaters.push((dt, t) => ring.userData.update(t));
  solid(M.stoneDark, -4.4, 0, -85.2, 4.4, 0.7, -82.8); bat().boxc(M.stoneDark, -3.4, 1.4, -84, 0.9, 1.6, 1.2); bat().boxc(M.stoneDark, 3.4, 1.4, -84, 0.9, 1.6, 1.2);
  box(-4.4, 0, -85.2, 4.4, 4, -82.8);
  // the threads table: four lights the player carried here
  { const [x, , z] = P.table; solid(M.stone, x - 1.8, 0, z - 0.6, x + 1.8, 0.95, z + 0.6); W.threadLights = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), glowMat([0xffd34a, 0xffa050, 0xb6ff8a, 0xff6a4a][i], 0.0)); m.position.set(x - 1.2 + i * 0.8, 1.15, z); m.userData.noBatch = true; m.visible = false; add(m); W.threadLights.push(m); } }
  // the three ways: plinths
  W.endMarks = {};
  for (const [k, [x, , z]] of Object.entries(P.ends)) {
    if (k !== 'C') solid(M.stoneDark, x - 0.6, 0, z - 0.6, x + 0.6, 1.0, z + 0.6);
    const c = { A: 0xffffff, B: 0xff6a4a, C: 0x9a7bff }[k];
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 32), glowMat(c, 0.8)); m.rotation.x = -PI / 2; m.position.set(x, k === 'C' ? 0.03 : 1.03, z); m.userData.noBatch = true; m.visible = false; add(m); W.endMarks[k] = m;
  }
  // the collision of eras around the terrace: settlement houses west, 2196 ruins east, a 2049 tower north, ward tiles
  try { const v = RZ.settlement([{ position: [-24, 0, -70], round: true, radius: 2.6, wall: 'mud', seed: 9 }, { position: [-22, 0, -82], yaw: 0.6, width: 5, depth: 4, height: 2.5, wall: 'stone', roof: 'thatch', seed: 10 }], { colors: { thatch: 0x9a7a45 } }); add(v.group); } catch (e) { void e; }
  try {
    const b96 = RZ.cityBlock([{ width: 12, depth: 12, height: 26, position: [28, 0, -74], seed: 2381, wall: 'concrete', ruin: 0.8, moss: 0.6, collapse: true, faces: ['windows', 'windows', 'windows', 'windows'], groundBlank: true }], { era: '2196', lit: 0, daylight: 0.5, detail: 'low' }); add(b96.mesh);
    const b49 = RZ.cityBlock([{ width: 14, depth: 14, height: 54, position: [10, 0, -112], seed: 2382, wall: 'panel', led: 0.6, faces: ['windows', 'windows', 'windows', 'windows'], groundBlank: true }], { era: '2049', lit: 0.5, daylight: 0, detail: 'low' }); add(b49.mesh);
    const b26 = RZ.cityBlock([{ width: 16, depth: 10, height: 18, position: [-20, 0, -108], seed: 2383, wall: 'brick', faces: ['windows', 'windows', 'windows', 'windows'], groundBlank: true }], { era: '2026', lit: 0.1, daylight: 1, detail: 'low' }); add(b26.mesh);
  } catch (e) { void e; }
  try { add(RZ.forest({ species: 'broadleaf', placements: [{ x: -26, z: -62, scale: 1 }, { x: -28, z: -90, scale: 1.1 }, { x: 22, z: -94, scale: 0.8 }], heightAt: () => 0, impostors: false, variants: 2, seed: 2384 })); } catch (e) { void e; }
  bat().box(M.rock, -40, -8, -100, 40, -0.6, -52);
  // rain that falls upward around the ring (the inversion)
  try { add(RZ.particles({ kind: 'dust', count: low ? 60 : 140, center: [0, 3, -80], area: [12, 6, 8], color: 0xc8b8ff })); } catch (e) { void e; }
  src(0, 4.3, -82, 0x9a7bff, 3, 16); src(0, 2.5, -67, 0xffe0b0, 1.6, 9); src(-8, 2, -79, 0xffffff, 1.0, 6); src(8, 2, -79, 0xff6a4a, 1.0, 6);
  K.finish();
}

// ---------------------------------------------------------------------------------------------------------------------
// Epilogue sets. 'A' The Fixed World (Rain City, a clear morning, the clocks running), 'B' The Infinite War (the same
// street cut in two by a seam of light: 2049 one side, 2196 the other), 'C' Afterzero (Calder Row at dawn, 2049).
// ---------------------------------------------------------------------------------------------------------------------
export function buildEpilogue(game, scene, variant) {
  const low = RZ.getQuality() === 'low', W = { lightSrc: [], updaters: [], sv: [], zones: {} };
  const K = mkKit(game, scene, W, 'epi'), M = materials(), R = rng(2390);
  const { bat, solid, box, add, plane } = K;
  solid(variant === 'A' ? M.dryAsphalt : M.asphalt, -6, -0.6, -40, 6, 0, 30); solid(M.pave, -10, -0.6, -40, -6, 0.15, 30); solid(M.pave, 6, -0.6, -40, 10, 0.15, 30);
  box(-10.6, 0, -40, -10, 10, 30); box(10, 0, -40, 10.6, 10, 30); box(-10, 0, -40.6, 10, 10, -40); box(-10, 0, 30, 10, 10, 30.6);
  const lots = [];
  for (const [side, face] of [[-1, '+x'], [1, '-x']]) for (let i = 0; i < 4; i++) {
    const z0 = -40 + i * 17.5, z1 = z0 + 17.5;
    lots.push({ width: 17.5, depth: 14, position: [side * 17, 0, (z0 + z1) / 2], yaw: face === '+x' ? PI / 2 : -PI / 2, groundFloor: 4.2, height: variant === 'C' ? 12 + R() * 4 : 20 + R() * 20, seed: 2391 + i + (side > 0 ? 10 : 0), wall: variant === 'C' ? 'brick' : ['brick', 'panel', 'concrete', 'plaster'][i], faces: ['shop', 'windows', 'blank', 'windows'] });
  }
  // the street does not end in the void: blocks close the vista north and south (frontages face the street)
  for (let i = 0; i < 3; i++) {
    lots.push({ width: 16, depth: 12, position: [-16 + i * 16, 0, -48], yaw: 0, groundFloor: 4.2, height: variant === 'C' ? 13 + R() * 4 : 24 + R() * 18, seed: 2380 + i, wall: variant === 'C' ? 'brick' : ['panel', 'concrete', 'brick'][i], faces: ['shop', 'windows', 'windows', 'blank'] });
    lots.push({ width: 16, depth: 12, position: [-16 + i * 16, 0, 38], yaw: PI, groundFloor: 4.2, height: variant === 'C' ? 12 + R() * 4 : 20 + R() * 16, seed: 2385 + i, wall: variant === 'C' ? 'brick' : ['concrete', 'plaster', 'panel'][i], faces: ['shop', 'windows', 'windows', 'blank'] });
  }
  try {
    if (variant === 'B') {
      const west = lots.filter(l => l.position[0] < 0), east = lots.filter(l => l.position[0] > 0);
      add(RZ.cityBlock(west.map(b => ({ ...b, led: 0.6, holo: 1, cables: true })), { era: '2049', lit: 0.5, daylight: 0 }).mesh);
      add(RZ.cityBlock(east.map(b => ({ ...b, ruin: 0.8, moss: 0.5, collapse: true })), { era: '2196', lit: 0, daylight: 0.5 }).mesh);
    } else add(RZ.cityBlock(lots.map(b => ({ ...b, led: variant === 'A' ? 0.3 : 0.15 })), { era: '2049', lit: variant === 'A' ? 0.2 : 0.35, daylight: variant === 'A' ? 1 : 0.4 }).mesh);
  } catch (e) { console.warn('m23 epi blocks', e); }
  try {
    const k = streetKit({ era: '2049', seed: 2392 + variant.charCodeAt(0) });
    k.kerb([[-6, 30], [-6, -40]]).kerb([[6, -40], [6, 30]]).markings({ lanes: [{ from: [0, 30], to: [0, -40] }], crossings: [{ at: [0, 4], yaw: PI / 2, width: 11 }] })
      .shelter([-7.8, 0.15, -2], PI / 2);
    // lamps on the east pavement (in C they leave Mira's doorway and crossing clear)
    for (const seg of variant === 'C' ? [[[7.6, 28], [7.6, 10]], [[7.6, -18], [7.6, -38]]] : [[[7.6, 28], [7.6, -38]]]) k.scatter('lamp', seg, { spacing: 14, turn: -PI / 2, y: 0.15 });
    if (variant !== 'B') k.car([-3.6, 0, 18, 0], 0).car([3.4, 0, -20, PI], PI).add('bin', [-7.6, 0.15, 10]);
    if (variant === 'B') k.add('barrier', [0, 0, 12], 0).add('barrier', [0, 0, -14], 0);
    add(k.build()); for (const c of k.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2]);
    if (variant === 'B') { const k96 = streetKit({ era: '2196', seed: 2399 }); k96.car([3.4, 0, -22, PI + 0.4], PI + 0.4).add('rubble', [5, 0, 16], 1); k96.overgrowth({ area: [0.5, -40, 10, 30] }, { density: low ? 0.5 : 0.9, cracks: 0.9 }); add(k96.build()); }
  } catch (e) { void e; }
  // a bench on the east pavement (visual only: Kai sits on it in A)
  bat().box(M.wood, 7.5, 0.55, 7.1, 8.0, 0.62, 8.9); bat().box(M.wood, 8.0, 0.62, 7.1, 8.08, 1.05, 8.9); for (const z of [7.2, 8.8]) bat().box(M.black, 7.55, 0.15, z - 0.04, 8.05, 0.55, z + 0.04);
  // the station clock on a post: running in A and C (08:15, then on), torn in B
  W.clockFace = plane(TEX.stationClock(15), 1.1, 1.1, -7.8, 3.6, 3.2, PI / 2, 0.5);
  bat().cyl(M.black, -7.8, 1.8, 3.2, 0.08, 3.6, 10);
  if (variant === 'B') {
    // the seam down the middle of the street, and far-off light where the boundaries are fought over
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 70), new THREE.MeshBasicMaterial({ color: 0xff6a4a, transparent: true, opacity: 0.8, toneMapped: false, side: THREE.DoubleSide })); seam.rotation.x = -PI / 2; seam.position.set(0, 0.02, -5); seam.userData.noBatch = true; add(seam);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(70, 30), veilMaterial(0xff8a6a)); wall.rotation.y = PI / 2; wall.position.set(0, 12, -5); wall.userData.noBatch = true; add(wall);
    W.updaters.push((dt, t) => { wall.material.uniforms.uTime.value = t; });
    W.flashes = []; for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd27a : 0xb6ff8a, transparent: true, opacity: 0, toneMapped: false })); f.position.set((i % 2 ? 1 : -1) * (40 + i * 12), 18 + i * 4, -60 - i * 20); f.userData.noBatch = true; add(f); W.flashes.push(f); }
    W.updaters.push((dt, t) => W.flashes.forEach((f, i) => { const p = (t * 0.25 + i * 0.37) % 1; f.material.opacity = p < 0.15 ? Math.sin(p / 0.15 * PI) * 0.5 : 0; }));
    try { add(RZ.particles({ kind: 'embers', count: low ? 60 : 140, center: [6, 4, -6], area: [10, 8, 40], color: 0xffa050 })); } catch (e) { void e; }
  }
  if (variant === 'A') { try { add(RZ.forest({ species: 'broadleaf', placements: [{ x: 8, z: -12, y: 0.15, scale: 0.7 }, { x: -8, z: 20, y: 0.15, scale: 0.75 }], heightAt: () => 0.15, impostors: false, variants: 2, seed: 2393 })); } catch (e) { void e; } }
  if (variant === 'C') {
    plane(TEX.calder(), 1.4, 0.5, 9.9, 3.4, -4.2, -PI / 2, 0.6);
    // the door Mira comes out of: stoop, lit fanlight
    solid(M.stone, 9.2, 0.15, -9.2, 10, 0.5, -6.8); bat().box(glowMat(0xffd8a0, 1.6), 9.98, 2.8, -8.6, 10.02, 3.2, -7.4);
    try { add(RZ.forest({ species: 'broadleaf', placements: [{ x: 7.8, z: -14, y: 0.15, scale: 0.8 }, { x: 7.8, z: 4, y: 0.15, scale: 0.7 }], heightAt: () => 0.15, impostors: false, variants: 2, seed: 2394 })); } catch (e) { void e; }
  }
  K.finish();
  W.update = (dt, t) => { for (const f of W.updaters) f(dt, t); };
  return W;
}

// the post-credit clock: a face in the dark whose hands begin to move
export function buildClockScene(scene) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.2, 64), new THREE.MeshStandardMaterial({ map: clockTex('pc', { label: '', bg: '#d8d0bc' }), roughness: 0.7, emissive: 0xffffff, emissiveMap: clockTex('pc', { label: '', bg: '#d8d0bc' }), emissiveIntensity: 0.25 }));
  g.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.07, 12, 64), new THREE.MeshStandardMaterial({ color: 0x3a3226, metalness: 0.7, roughness: 0.35 })); g.add(rim);
  const hand = (len, w, color, z) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.02), new THREE.MeshStandardMaterial({ color, roughness: 0.4 })); m.position.y = len / 2 - 0.08; p.add(m); p.position.z = z; p.visible = false; g.add(p); return p; };
  const hH = hand(0.6, 0.07, 0x141414, 0.02), hM = hand(0.95, 0.045, 0x141414, 0.03), hS = hand(1.05, 0.018, 0xa8261a, 0.04);
  scene.add(g);
  return { g, hH, hM, hS };
}
