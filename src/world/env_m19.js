// MISSION 19 · THE PLACE OUTSIDE TIME — maps, cast, music and code-drawn symbols.
// Everything is generated here: the recurring symbols (Hensel's clockmaker's mark, the observatory pattern, the Helix
// badge) with their decoys, Meridian Avenue as a road that returns, the Clock Square, the House of Rooms, the mirror
// gorge with a bridge that exists only in its reflection, the Concourse of Doors and Test Hall Zero at 08:14:09 and a half.
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, box, Motes, chronolith } from './kit.js';
import { streetKit } from './props.js';
import { registerCast, CAST } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Cinzel", Georgia, serif';
const HAND = '"Caveat", "Segoe Print", "Bradley Hand", cursive';
const PI = Math.PI;

// ---------------------------------------------------------------------------------------------------------------------
// Places (world coordinates)
// ---------------------------------------------------------------------------------------------------------------------
export const AV = {        // I · Meridian Avenue (a road that returns)
  start: [0, 0, 40, PI], endZ: 47, len: 92,
  // alleys: side (-1 left / +1 right), centre z; their mouths open at |x| = 10, their seams at |x| = 21.5
  alleys: { A: [-1, 24], B: [1, 8], C: [-1, -10], D: [1, -28] },
  marks: { A: [-10.0, 2.5, 29.3], B: [10.0, 2.5, 13.3], C: [-10.0, 2.5, -4.7], D: [10.0, 2.5, -22.7] },
  shelter: [8.6, 0.15, 30], orren: [8.4, 0.15, 30.6], timetable: [9.6, 1.5, 31.6], kiosk: [-8.2, 0.15, 4], paper: [-7.5, 1.1, 4.0],
  clocks: [[8.0, 0.15, 38], [-8.0, 0.15, 0], [8.0, 0.15, -36]], tram: [0, 0, -24],
  shard: [21.0, 0.75, -30.6],
};
// per lap: the correct alley and what hangs at each alley mouth ('true' | 'mirror' | 'nine' | 'late' | null); lap 2's true
// mark at A is a Residue mark (only in Residue Vision)
export const LAPS = [
  { ok: 'B', marks: { A: null, B: 'true', C: null, D: null }, second: 7 },
  { ok: 'C', marks: { A: 'mirror', B: null, C: 'true', D: 'nine' }, second: 8 },
  { ok: 'A', marks: { A: null, B: 'nine', C: 'mirror', D: 'late' }, residue: 'A', second: 9 },
];
export const SQ = { x: 220, z: 0, start: [220, 0, 13, PI], door: [220, 0, -13.6], fountain: [220, 0, 0], orren: [223.4, 0, 2.6], shard: [214.2, 0.95, -1.2], clock: [220, 6.6, -13.2], plaque: [226.8, 1.2, -13.5] };

// II · the House of Rooms: each room is a closed 10 x 10 m room at its own place; doors are its only connections
export const ROOM_X = (i) => 400 + i * 40;
export const ROOMS = [
  { id: 'workshop', name: 'HENSEL\'S WORKSHOP · 2049', h: 4.2 },
  { id: 'observatory', name: 'THE OBSERVATORY CHAMBER', h: 5.2 },
  { id: 'lab', name: 'HELIX · TEST LAB 4', h: 4.0 },
  { id: 'gallery', name: 'THE GALLERY OF THREE', h: 7.0 },
  { id: 'kitchen', name: 'THE VAREN KITCHEN · 2026', h: 3.0 },
  { id: 'hall', name: 'CENTRAL STATION · TICKET HALL', h: 5.0 },
];
// doors: room -> side -> { sym: [kind, variant] | null, to: [room, side] | 'loop' | 'seal' | 'great' }
export const DOORS = {
  0: { S: { sym: null, to: 'seal' }, W: { sym: ['clock', 'mirror'], to: 'loop' }, N: { sym: ['clock', 'true'], to: [1, 'S'] }, E: { sym: ['clock', 'nine'], to: 'loop' } },
  1: { S: { sym: null, to: [0, 'N'] }, W: { sym: ['star', 'mirror'], to: [4, 'E'] }, N: { sym: ['star', 'six'], to: 'loop' }, E: { sym: ['star', 'true'], to: [2, 'W'] } },
  2: { W: { sym: null, to: [1, 'E'] }, N: { sym: ['helix', 'true'], to: [3, 'S'] }, E: { sym: ['helix', 'gold'], to: 'loop' }, S: { sym: ['helix', 'three'], to: [5, 'N'] } },
  3: { S: { sym: null, to: [2, 'N'] }, N: { sym: null, to: 'great' } },
  4: { E: { sym: null, to: [1, 'W'] } },
  5: { N: { sym: null, to: [2, 'S'] } },
};
export const SIDE = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
export const DIAL = { clock: ['nine', 'mirror', 'true', 'late'], star: ['six', 'true', 'mirror', 'shift'], helix: ['gold', 'three', 'true'] };

// III / IV · the mirror gorge and the Concourse of Doors (one scene); the final hall far to the east
export const LAKE = -8;
export const BR = {
  start: [0, 0, 26, PI], arch: [0, 0, 16.2],
  // invisible deck: [x0, x1, z0, z1]
  deck: [[-1.2, 1.2, -4, 16.4], [-1.2, 8.2, -4, -1.6], [5.8, 8.2, -16, -1.6], [-5.2, 8.2, -16, -13.6], [-5.2, -2.8, -24.4, -13.6],
    [-5.2, -2.8, -38, -33.6], [1.8, 4.2, -44, -42], [-5.2, -2.8, -50, -48], [-5.2, -2.8, -56.4, -50]],
  island: [-10, 2, -33.8, -24.2], orren: [-7.4, 0, -29.6], bench: [-1.4, 0, -28.6], page: [-0.9, 0.62, -28.5], shard: [-9.0, 0.5, -26.0],
  sliders: [{ z0: -42, z1: -38, a: -4, b: 3, w: 2.6, phase: 0 }, { z0: -48, z1: -44, a: 3, b: -4, w: 2.6, phase: 0 }],
};
export const PLZ = {
  z0: -56, cx: 0, cz: -90,
  strip: [[-4, -57], [-4, -66], [-14, -74], [-12, -86], [2, -92], [12, -100], [10, -110], [2, -116]],
  inlays: [[-14, -74, 'clock'], [2, -92, 'star'], [10, -110, 'helix']],
  spots: [[-26, -66, PI / 2], [22, -68, -PI / 2], [-28, -104, PI / 2], [26, -108, -PI / 2], [16, -84, -PI / 2]],
  final: [2, -117.6, 0], tower: [0, -126], hensel: [-36, -92], dome: [36, -92], page: [3.4, 0.9, -122.6], shard: [33.0, 0.6, -84.0],
};
export const HALL = { x: 300, z: 0, start: [300, 0, 9, PI], ring: [300, 3.6, -11], mira: [301.8, 0, -4.2], kid: [299.6, 0, -6.2], kidKai: [298.9, 0, -4.9] };

// ---------------------------------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites)
// ---------------------------------------------------------------------------------------------------------------------
export const VISITORS26 = [
  { era: '2026', costume: 'c26_m2', sex: 0, age: 41, height: 1.8, skin: 0xc89a7a, hair: 0x2a2018, hairStyle: 'short', topType: 'jacket', top: 0x2e3a4c, pantsType: 'trousers', pants: 0x6a7a94, shoes: 'shoes', boots: 0xe6e2da, lod: true },
  { era: '2026', costume: 'c26_f2', sex: 1, female: true, age: 36, height: 1.68, skin: 0xe0b8a0, hair: 0x5a3a22, hairStyle: 'bob', topType: 'jacket', top: 0xb08a5a, pantsType: 'trousers', pants: 0x1d2430, shoes: 'boots', boots: 0x2a1d14, lod: true },
  { era: '2026', costume: 'c26_m3', sex: 0, age: 66, height: 1.74, skin: 0xd8b08e, hair: 0xa8a49e, hairStyle: 'short', topType: 'sweater', top: 0x4a4a32, pantsType: 'trousers', pants: 0x3a3a38, shoes: 'shoes', boots: 0x2a1d14, lod: true },
  { era: '2026', costume: 'c26_f1', sex: 1, female: true, age: 22, height: 1.65, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'curly', topType: 'jacket', top: 0x6a2a3a, pantsType: 'trousers', pants: 0x2e3a4c, shoes: 'shoes', boots: 0xe6e2da, lod: true },
  { era: '2026', costume: 'helix_sci_f', faction: 'helix', sex: 1, female: true, age: 44, height: 1.7, skin: 0xd9a585, hair: 0x2a1c14, hairStyle: 'tied-back', topType: 'tshirt', top: 0x8a8d92, coat: 0xe8e4dc, coatType: 'lab', pantsType: 'trousers', pants: 0x1d2430, shoes: 'shoes', boots: 0x1a1612, lod: true },
  { era: '2026', costume: 'c26_f3', sex: 1, female: true, age: 61, height: 1.62, skin: 0xcf9f82, hair: 0xb8b0a4, hairStyle: 'bun', topType: 'jacket', top: 0x2f4a3a, pantsType: 'trousers', pants: 0x3a3a38, shoes: 'shoes', boots: 0x2a1d14, lod: true },
];
const KID_MIRA10 = { era: '2026', costume: 'kid_mira', sex: 1, female: true, age: 10, height: 1.36, build: 0.84, skin: 0xd9a585, hair: 0x120d0b, hairStyle: 'bob', eyes: 0x2f4a3a, topType: 'sweater', top: 0x6a2a3a, topKind: 'fabric', pantsType: 'trousers', pants: 0x1f2227, shoes: 'shoes', boots: 0x3a2a1a };
const KID_KAI7 = { era: '2026', costume: 'kid_kai', sex: 0, age: 7, height: 1.22, build: 0.82, skin: 0xb98463, hair: 0x15100c, hairStyle: 'messy', eyes: 0x3d2a18, topType: 'jacket', hood: true, top: 0x2a4a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2f3a4e, shoes: 'shoes', boots: 0x3a2a1a };
export const CHILD_LOOK = { era: '2049', costume: 'c49_kid_f', sex: 1, female: true, age: 7, height: 1.12, build: 0.85, skin: 0xe0b394, hair: 0x3a2418, hairStyle: 'short', topType: 'jacket', top: 0xd8a020, topKind: 'fabric', pantsType: 'trousers', pants: 0x2a3a5a, shoes: 'boots', boots: 0xc02020 };

export function registerM19Cast() {
  registerCast('orren', {
    name: 'ORREN', role: 'The Unwritten Second · a guide, or a habit',
    bio: 'Keeps the roads company. Calm, patient, faintly amused. May be a person, a memory or a pattern that learned to stand up; he will not say which, and perhaps does not know.',
    // eraless by design (COSTUMES.md `orren`): the build is his own; 'unwritten' maps to the 2049 pool in character.js
    look: { era: '2049', costume: 'orren', sex: 0, age: 50, height: 1.78, build: 1.0, skin: 0xb88560, hair: 0x2a2420, hairStyle: 'short', eyes: 0x4a3a2a,
      topType: 'tunic', top: 0xb8b4ac, topKind: 'fabric', coat: 0x8a8a86, coatType: 'long', hood: true, pantsType: 'trousers', pants: 0x8a8a86, shoes: 'boots', boots: 0x5a5a56,
      face: { jaw: 0.1, cheek: 0.15, nose: 0.05, noseWidth: 0, lips: -0.1, brow: 0.05, eyeSize: -0.05, faceLength: 0.1, chin: 0 } },
    rimColor: 0xe8eef8, glow: 0x1a1c22, vp: { sex: 'm', pitch: 0.88, rate: 0.9, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('m19mira', {
    name: 'MIRA VAREN', role: 'The Unwritten Second · more of her than anywhere',
    bio: 'Sixty-one percent in the Chronolith. Here, in the second nobody wrote, there is more of her, and she has had a long time to think.',
    look: { ...(CAST.mira?.look || {}), role: 'mira', era: '2049', costume: 'mira', sex: 1, female: true, age: 29 },
    rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 1.05, rate: 0.96, langs: ['en-GB', 'en-US'] },  // Mira's voice (core/voice.js)
  });
  registerCast('m19kidmira', { name: 'MIRA, 10', role: 'Test Hall Zero · 19.10.2026 · 08:14:09', look: { ...KID_MIRA10 }, rimColor: 0x9a7bff, vp: { sex: 'f', pitch: 1.45, rate: 1.06, langs: ['en-GB', 'en-US'] } });
  registerCast('m19kidkai', { name: 'KAI, 7', role: 'The Varen kitchen · 2026', look: { ...KID_KAI7 }, rimColor: 0xffd8a0, vp: { sex: 'm', pitch: 1.55, rate: 1.12, langs: ['en-GB', 'en-US'] } });
  registerCast('m19child', { name: 'CHILD', role: 'Central Station · the ticket hall that is not there', look: { ...CHILD_LOOK }, vp: { sex: 'f', pitch: 1.55, rate: 1.06, langs: ['en-US', 'en-GB'] } });  // the M1 child's voice (core/voice.js 'child')
  registerCast('m19band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist · no state', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m19lake', { name: 'MIRA', role: 'In the reflection', portraitOf: 'mira', voice: true, vp: { sex: 'f', pitch: 1.05, rate: 0.96, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music (bible: "The Unwritten Second: sparse glass tones, prepared piano, low drones, silence as rhythm, motif fragments;
// 48 BPM or free time, no conventional beat"). Mira's three notes are E-B-A (64, 71, 69: up a fifth, down a step, as the core 'motif' stinger); here they
// arrive incomplete until the end.
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { lap: 0, progress: 0, rooms: 0 };
const hsh = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function registerM19Themes() {
  registerTheme('m19-outside', { bpm: 48, step(a, s, t, d) {          // the road: glass, a sub drone, whole bars of silence
    const bar = Math.floor(s / 16), b = s % 16;
    if (bar % 5 === 4) return;                                          // silence as rhythm
    if (b === 0) { a.cello(26 + (bar % 3 === 2 ? -2 : 0), t, d * 15, 0.05); a.pad([50, 57, 64 + musicState.lap], t, d * 16, 0.008, 260); }
    if ([0, 5, 11].includes(b) && hsh(s) > 0.45) a.glass([86, 93, 91, 88, 95][(s + bar) % 5], t, 0.011);
    if (b === 8 && bar % 2 === 0) a.piano(62 + [0, 3, -2, 5][bar % 4], t, 0.05, 0.35);  // prepared: short, muted
    if (bar % 6 === 3 && b === 4) a.piano(64, t, 0.04, 2.2);            // E ...
    if (bar % 6 === 3 && b === 10) a.piano(71, t, 0.035, 2.2);          // ... B (and no A)
  } });
  registerTheme('m19-square', { bpm: 48, step(a, s, t, d) {           // the stopped second: a held tick that never lands
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([45, 52, 59, 64], t, d * 16, 0.01, 420); a.cello(33, t, d * 16, 0.04); }
    if (b === 0 || b === 8) a.tick(t, 0.012, 2600);
    if (b === 15 && bar % 2) a.tick(t, 0.005, 5200);
    if (b === 6 && bar % 3 === 1) a.glass(88, t, 0.012);
  } });
  registerTheme('m19-rooms', { bpm: 60, step(a, s, t, d) {            // the House of Rooms: clockwork that loses its place
    const bar = Math.floor(s / 16), b = s % 16, ch = [[48, 55, 62], [46, 53, 60], [44, 51, 58], [43, 50, 57]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.01, 520); a.cello(ch[0] - 12, t, d * 16, 0.035); }
    if (b % 4 === 0) a.tick(t + (musicState.rooms * 0.003 * (b % 8 ? 1 : 0)), 0.011, 3000);
    if ([2, 7, 13].includes(b) && hsh(s) > 0.35) a.piano(ch[(b + bar) % 3] + 12, t, 0.04, 0.5);
    if (b === 10 && bar % 4 === 3) a.glass(ch[2] + 24, t, 0.01);
  } });
  registerTheme('m19-mirror', { bpm: 52, step(a, s, t, d) {           // the gorge: glass over still water
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([40, 47, 54, 59], t, d * 16, 0.011, 360); a.cello(28, t, d * 16, 0.04); }
    if (b % 3 === 0 && hsh(s * 3) > 0.5) a.glass([83, 90, 88, 86][(s >> 2) % 4], t, 0.01);
    if (b === 12 && bar % 2) a.piano(64, t, 0.035, 2.4);
    if (bar % 4 === 2 && b === 4) a.flute(71, t, d * 8, 0.01);
  } });
  registerTheme('m19-door', { bpm: 56, step(a, s, t, d) {             // the concourse: the motif tries to finish itself
    const bar = Math.floor(s / 16), b = s % 16, p = musicState.progress;
    if (b === 0) { a.pad([45, 52, 57, 64], t, d * 16, 0.01 + p * 0.006, 380 + p * 600); a.cello(33, t, d * 16, 0.04); }
    if (b % 8 === 0) a.tick(t, 0.008, 2400);
    if (bar % 2 === 0 && b === 2) a.piano(64, t, 0.045, 2.6);
    if (bar % 2 === 0 && b === 6) a.piano(71, t, 0.04, 2.6);
    if (bar % 2 === 0 && b === 10 && p > 0.66) a.piano(69, t, 0.04, 3.2);
    if (b === 13 && hsh(s) > 0.6) a.glass(88, t, 0.009);
  } });
  registerTheme('m19-orren', { bpm: 50, step(a, s, t, d) {            // Orren: an old road song, warm and unhurried
    const bar = Math.floor(s / 16), b = s % 16, ch = [[43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 62]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.011, 700); a.cello(ch[0] - 12, t, d * 16, 0.03); }
    if (b === 4 || b === 12) a.pluck(ch[(b >> 2) % 4] + 12, t, 0.03);
    if (b === 8 && bar % 2) a.flute(ch[3] + 12, t, d * 6, 0.012);
  } });
  registerTheme('m19-mira', { bpm: 64, step(a, s, t, d) {             // Mira: felt piano and warm cello, E-B-A at last
    const bar = Math.floor(s / 16), b = s % 16, ch = [[52, 59, 64, 67], [48, 55, 60, 64], [45, 52, 57, 60], [47, 54, 59, 62]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.012, 640); a.cello(ch[0] - 12, t, d * 16, 0.045); }
    if (b === 0 && bar % 2 === 0) a.piano(64, t, 0.05, 3);
    if (b === 4 && bar % 2 === 0) a.piano(71, t, 0.045, 3);
    if (b === 8 && bar % 2 === 0) a.piano(69, t, 0.045, 4);
    if ([2, 6, 10, 14].includes(b) && bar % 2) a.piano(ch[(b >> 2) % 4] + 12, t, 0.028, 1.4);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Symbols: the clockmaker's mark, the observatory pattern, the Helix badge, each with decoys
// ---------------------------------------------------------------------------------------------------------------------
const STARS = [[0, -0.78], [0.56, -0.36], [0.44, 0.42], [-0.08, 0.72], [-0.62, 0.28], [-0.5, -0.46], [0, 0]];
export const SYMBOL_TEXT = {
  clock: { true: 'Hensel\'s mark: a clock face at 8:14, MCMLXI above, HENSEL below.', mirror: 'Hensel\'s mark reversed: the hands at 3:46, the letters backwards.', nine: 'A clock face at 9:00 sharp, the hour the war began.', late: 'A clock face at 8:41: the digits of the right time, in the wrong order.' },
  star: { true: 'Seven stars: six round the pole, the pole star bright, the eastern notch cut beside it.', six: 'Six stars: one of the ring is missing.', mirror: 'The pattern mirrored: the notch on the west.', shift: 'Seven stars, but the pole star has drifted off the centre.' },
  helix: { true: 'The Helix badge: four white orbits round a dot.', gold: 'Four orbits in Continuum gold, boxed in a hexagon.', three: 'Three orbits round a dot: one is missing.' },
};
function drawClock(g, cx, cy, R, v, ink) {
  g.save(); g.translate(cx, cy); if (v === 'mirror') g.scale(-1, 1);
  g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = R * 0.07; g.beginPath(); g.arc(0, 0, R, 0, PI * 2); g.stroke();
  g.lineWidth = R * 0.025; g.beginPath(); g.arc(0, 0, R * 0.86, 0, PI * 2); g.stroke();
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; g.lineWidth = k % 3 ? R * 0.03 : R * 0.06; g.beginPath(); g.moveTo(Math.sin(a) * R * 0.7, -Math.cos(a) * R * 0.7); g.lineTo(Math.sin(a) * R * 0.82, -Math.cos(a) * R * 0.82); g.stroke(); }
  const [h, m] = v === 'nine' ? [9, 0] : v === 'late' ? [8, 41] : [8, 14];
  const ma = m / 60 * PI * 2, ha = (h + m / 60) / 12 * PI * 2;
  g.lineCap = 'round'; g.lineWidth = R * 0.085; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(ha) * R * 0.45, -Math.cos(ha) * R * 0.45); g.stroke();
  g.lineWidth = R * 0.05; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(ma) * R * 0.68, -Math.cos(ma) * R * 0.68); g.stroke();
  g.beginPath(); g.arc(0, 0, R * 0.07, 0, PI * 2); g.fill();
  g.textAlign = 'center'; g.font = `700 ${Math.round(R * 0.2)}px ${SERIF}`; g.fillText('HENSEL', 0, R * 0.42); g.font = `600 ${Math.round(R * 0.12)}px ${SERIF}`; g.fillText('MCMLXI', 0, -R * 0.3);
  g.restore();
}
function drawStars(g, cx, cy, R, v, ink) {
  g.save(); g.translate(cx, cy); if (v === 'mirror') g.scale(-1, 1);
  const pts = STARS.map(([x, y], i) => (v === 'shift' && i === 6 ? [0.22, 0.12] : [x, y]));
  g.strokeStyle = ink; g.globalAlpha = 0.55; g.lineWidth = R * 0.02; g.beginPath(); g.arc(0, 0, R * 0.98, 0, PI * 2); g.stroke();
  g.globalAlpha = 0.7; g.beginPath();
  for (let i = 0; i < 6; i++) { if (v === 'six' && i === 3) continue; const [x, y] = pts[i]; if (i === 0 || (v === 'six' && i === 4)) g.moveTo(x * R, y * R); else g.lineTo(x * R, y * R); }
  if (v !== 'six') g.lineTo(pts[0][0] * R, pts[0][1] * R); g.stroke();
  g.globalAlpha = 1; g.fillStyle = ink; g.shadowColor = ink; g.shadowBlur = R * 0.08;
  pts.forEach(([x, y], i) => { if (v === 'six' && i === 3) return; const r = i === 6 ? R * 0.1 : R * 0.055; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2, rr = k % 2 ? r * 0.42 : r; g.lineTo(x * R + Math.cos(a) * rr, y * R + Math.sin(a) * rr); } g.fill(); });
  g.shadowBlur = 0; g.lineWidth = R * 0.05; g.beginPath(); g.moveTo(R * 0.86, -R * 0.08); g.lineTo(R * 1.0, 0); g.lineTo(R * 0.86, R * 0.08); g.stroke();  // the eastern notch
  g.restore();
}
function drawHelix(g, cx, cy, R, v, ink) {
  g.save(); g.translate(cx, cy);
  const col = v === 'gold' ? '#d9a441' : ink; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = R * 0.05; g.shadowColor = col; g.shadowBlur = R * 0.06;
  if (v === 'gold') { g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * PI * 2 + PI / 6; g.lineTo(Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05); } g.stroke(); }
  const n = v === 'three' ? 3 : 4;
  for (let k = 0; k < n; k++) { g.beginPath(); g.ellipse(0, -R * 0.12, R * 0.82, R * (0.14 + k * 0.17), 0, 0, PI * 2); g.stroke(); }
  g.beginPath(); g.arc(0, -R * 0.12, R * 0.12, 0, PI * 2); g.fill();
  g.shadowBlur = 0; g.textAlign = 'center'; g.font = `600 ${Math.round(R * 0.24)}px ${FONT}`; g.fillText(v === 'gold' ? 'CONTINUUM' : 'HELIX', 0, R * 0.78);
  g.restore();
}
export function drawSymbol(g, kind, v, cx, cy, R, ink) { if (kind === 'clock') drawClock(g, cx, cy, R, v, ink); else if (kind === 'star') drawStars(g, cx, cy, R, v, ink); else drawHelix(g, cx, cy, R, v, ink); }
/** Plate texture for a symbol: style 'enamel' (street), 'brass' (rooms), 'chalk' (residue), 'inlay' (pavement), 'sky' (ceiling). */
export function symbolTex(kind, v, style = 'enamel') {
  const S = { enamel: ['#1e2a24', '#e8d8a8', '#c8a050'], brass: ['#3a2a18', '#f0d080', '#8a6a30'], chalk: [null, '#ffd8a0', null], inlay: ['#5a5650', '#e8e2d4', '#8a8478'], sky: ['#060a14', '#e8f0ff', null], dark: ['#10161c', '#e8f2ff', '#5a6a7a'] }[style];
  return canvasTex(256, 256, (g, w, h) => {
    if (S[0]) { g.fillStyle = S[0]; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
    if (S[2]) { g.strokeStyle = S[2]; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16); }
    drawSymbol(g, kind, v, w / 2, h / 2, w * 0.36, S[1]);
  }, `m19sym-${kind}-${v}-${style}`);
}
export function symbolPlate(kind, v, style = 'enamel', size = 1.1) {
  const tex = symbolTex(kind, v, style);
  const mat = style === 'chalk' ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc890 })
    : new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: style === 'sky' ? 1.1 : 0.32, roughness: style === 'brass' ? 0.35 : 0.5, metalness: style === 'brass' ? 0.6 : 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat); m.userData.noBatch = true; return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------------------------------
export function textTex(key, w, h, draw, bg = '#efe8d8') { return canvasTex(w, h, (g, W, H) => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); } draw(g, W, H); }, 'm19' + key); }
const lines = (g, list, x, y, size, col, font = FONT, lh = 1.3) => { list.forEach((l, i) => { const [t, c, s, f] = Array.isArray(l) ? l : [l]; g.font = `600 ${s || size}px ${f || font}`; g.fillStyle = c || col; g.fillText(t, x, y + i * size * lh); }); };
const plane = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
const lit = (tex, k = 0.4, o = {}) => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: k, roughness: 0.6, ...o });
export function disposeGroup(g) { g?.traverse(o => { if (o.geometry && !o.userData.keepGeo) o.geometry.dispose?.(); }); g?.parent?.remove(g); }
export function shardMesh() { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glowMat(0xd8f6ff, 2.6)); m.scale.set(0.8, 1.5, 0.8); m.userData.noBatch = true; return m; }
export function pageMesh() {
  const tex = textTex('page', 128, 160, (g) => { g.fillStyle = '#3a3226'; for (let k = 0; k < 9; k++) g.fillRect(14, 22 + k * 14, 70 + (k * 37) % 30, 3); g.strokeStyle = '#8a7a5a'; g.strokeRect(4, 4, 120, 152); g.font = `700 14px ${SERIF}`; g.fillText('UNWRITTEN', 18, 150); }, '#e8e0cc');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.32), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xfff4dc, emissiveIntensity: 0.55, side: THREE.DoubleSide, roughness: 0.9 }));
  m.rotation.x = -PI / 2 + 0.25; m.userData.noBatch = true; return m;
}
/** A shimmering seam: where the road or a room folds back on itself. */
export function veilMaterial(color = 0xd8e4ff) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uC: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uTime; uniform vec3 uC; varying vec2 vUv; void main(){ float e = smoothstep(0.0,0.25,vUv.x)*smoothstep(1.0,0.75,vUv.x)*smoothstep(0.0,0.2,vUv.y)*smoothstep(1.0,0.55,vUv.y);' +
      ' float b = 0.5+0.5*sin(vUv.y*22.0 - uTime*0.9 + sin(vUv.x*7.0+uTime*0.4)*2.0); float a = e*(0.10+0.16*b); gl_FragColor = vec4(uC*(0.7+0.5*b), a); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}
/** The unbuilt city: a skyline hung upside down in the sky (plans approved and never built). */
export function skyCity(low, seed = 1901, y = 235) {
  try {
    const m = RZ.skyline({ center: [0, -30], radius: [150, 330], count: low ? 26 : 44, height: [70, 190], lit: 0.75, seed });
    m.rotation.x = PI; m.position.y = y;
    m.material.transparent = true; m.material.opacity = 0.62; m.material.depthWrite = false; m.material.fog = false;
    m.userData.noBatch = true; m.renderOrder = -1;
    return m;
  } catch (e) { console.warn('m19 skyCity', e); return new THREE.Group(); }
}
/** Pieces of other eras drifting in the air (stone, brick, a 2196 slab with rebar). */
export function fragments(list, seed = 3) {
  const g = new THREE.Group(), r = RZ.rng(seed), items = [];
  const mats = [RZ.pbrMaterial('brick', { mapping: 'object', params: { color: 0x8a4a33 } }), RZ.pbrMaterial('concrete', { mapping: 'object' }), RZ.pbrMaterial('cutStone', { mapping: 'object' })];
  for (const [x, y, z, s] of list) {
    const f = new THREE.Group(); f.position.set(x, y, z);
    const m = mats[Math.floor(r() * 3)];
    const a = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.35, s * 0.7), m); f.add(a);
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 0.32, 0), mats[2]); b.position.set(s * 0.3, -s * 0.25, 0); f.add(b);
    if (r() < 0.5) { const c = new THREE.Mesh(new THREE.BoxGeometry(s * 0.4, s * 0.9, s * 0.4), m); c.position.set(-s * 0.25, s * 0.5, 0); f.add(c); }
    f.rotation.set(r() * 0.6, r() * PI * 2, r() * 0.5); g.add(f); items.push({ f, y, ph: r() * 6, sp: 0.05 + r() * 0.08 });
  }
  g.userData.update = (t) => { for (const it of items) { it.f.position.y = it.y + Math.sin(t * 0.25 + it.ph) * 0.8; it.f.rotation.y += it.sp * 0.01; } };
  return g;
}
function clockFaceTex(sec, key) {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#f2ecdc'; g.beginPath(); g.arc(w / 2, w / 2, 122, 0, PI * 2); g.fill(); g.strokeStyle = '#1a1a1a'; g.lineWidth = 8; g.stroke();
    for (let k = 0; k < 60; k++) { const a = k / 60 * PI * 2, l = k % 5 ? 8 : 18; g.lineWidth = k % 5 ? 2 : 6; g.beginPath(); g.moveTo(128 + Math.sin(a) * (108 - l), 128 - Math.cos(a) * (108 - l)); g.lineTo(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108); g.stroke(); }
    const hand = (a, l, wd, c) => { g.strokeStyle = c; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); g.stroke(); };
    hand((8 + 14 / 60) / 12 * PI * 2, 56, 10, '#1a1a1a'); hand(14 / 60 * PI * 2, 86, 6, '#1a1a1a'); hand(sec / 60 * PI * 2, 96, 3, '#b8261a');
    g.fillStyle = '#1a1a1a'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.fillText(sec >= 9.5 ? '08:14:09.—' : `08:14:0${Math.floor(sec)}`, 128, 184);
    g.font = `600 14px ${SERIF}`; g.fillText('MERIDIAN', 128, 84);
  }, key);
}
export function streetClock(secs) {
  const g = new THREE.Group(), metal = new THREE.MeshStandardMaterial({ color: 0x23282c, roughness: 0.45, metalness: 0.8 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 10), metal); pole.position.y = 1.7; g.add(pole);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 24), metal); head.rotation.x = PI / 2; head.position.y = 3.75; g.add(head);
  const texs = secs.map(s => clockFaceTex(s, 'm19clock' + s));
  const mat = lit(texs[0], 0.35, { roughness: 0.3 });
  for (const sgn of [1, -1]) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.38, 28), mat); f.position.set(0, 3.75, sgn * 0.115); if (sgn < 0) f.rotation.y = PI; f.userData.noBatch = true; g.add(f); }
  g.userData.setLap = (i) => { mat.map = mat.emissiveMap = texs[Math.min(i, texs.length - 1)]; mat.needsUpdate = true; };
  return g;
}

// =====================================================================================================================
// I · MERIDIAN AVENUE (the road that returns) and the Clock Square
// =====================================================================================================================
export function buildAvenue(game, scene, low) {
  const col = game.collision, root = new THREE.Group(); scene.add(root);
  const W = { root, lightSrc: [], marks: {}, clocks: [], veils: [], updaters: [] };
  const add = (o) => { root.add(o); return o; };
  const solid = (x0, y0, z0, x1, y1, z1) => col.add([x0, y0, z0], [x1, y1, z1]);
  // ---------- ground ----------
  const asphalt = RZ.pbrMaterial('wetAsphalt', { mapping: 'world', params: { wet: 0.35 } });
  const pave = RZ.pbrMaterial('concrete', { mapping: 'world', params: { color: 0x8a8884 } });
  const road = add(plane(12, 106, asphalt)); road.rotation.x = -PI / 2; road.receiveShadow = true;
  for (const s of [-1, 1]) { const p = add(box(4, 0.15, 106, pave, s * 8, 0, 0, { detail: false })); p.castShadow = false; }
  solid(-6, -1, -53, 6, 0, 53); solid(-10, -1, -53, -6, 0.15, 53); solid(6, -1, -53, 10, 0.15, 53);
  // ---------- buildings: a 2049 side and a 2026 side, cut by four alleys ----------
  const bld = (x0, x1, z0, z1, face, o) => {
    const yaw = face === '+x' ? PI / 2 : face === '-x' ? -PI / 2 : face === '-z' ? PI : 0;
    const w = (face === '+z' || face === '-z') ? x1 - x0 : z1 - z0, d = (face === '+z' || face === '-z') ? z1 - z0 : x1 - x0;
    return { width: Math.abs(w), depth: Math.abs(d), position: [(x0 + x1) / 2, 0, (z0 + z1) / 2], yaw, ...o };
  };
  const L = [[-26, -10, 28, 50, 34, 'brick', true], [-26, -10, -6, 20, 26, 'concrete', true], [-26, -10, -50, -14, 40, 'darkBrick', false]];
  const Rr = [[10, 26, 12, 50, 30, 'plaster', true], [10, 26, -24, 4, 38, 'concrete', true], [10, 26, -50, -32, 24, 'brick', false]];
  for (const [x0, x1, z0, z1, h] of [...L, ...Rr]) solid(x0, 0, z0, x1, h, z1);
  try {
    const b1 = RZ.cityBlock(L.map(([x0, x1, z0, z1, h, wall, blank], i) => bld(x0, x1, z0, z1, '+x', { height: h, seed: 1900 + i, wall, era: '2049', groundFloor: 4.4, faces: ['shop', 'windows', 'blank', 'windows'], groundBlank: blank ? [true, false, false, false] : undefined, led: 0.4, holo: 1 })), { era: '2049', lit: 0.45, daylight: 0.5, detail: low ? 'low' : undefined });
    add(b1.mesh); game.blocker(b1.mesh);
    const b2 = RZ.cityBlock(Rr.map(([x0, x1, z0, z1, h, wall, blank], i) => bld(x0, x1, z0, z1, '-x', { height: h, seed: 1910 + i, wall, era: '2026', groundFloor: 4.2, faces: ['shop', 'windows', 'blank', 'windows'], groundBlank: blank ? [true, false, false, false] : undefined })), { era: '2026', lit: 0.3, daylight: 0.6, detail: low ? 'low' : undefined });
    add(b2.mesh); game.blocker(b2.mesh);
  } catch (e) { console.warn('m19 avenue blocks', e); }
  // ---------- alleys: floors, back walls, seams ----------
  const alleyMat = RZ.pbrMaterial('concrete', { mapping: 'world', params: { color: 0x6a6866 } });
  const veilM = veilMaterial(); W.veilMat = veilM;
  for (const [side, zc] of Object.values(AV.alleys)) {
    const xa = side * 10, xb = side * 24;
    const fl = add(plane(14, 8, alleyMat)); fl.rotation.x = -PI / 2; fl.position.set((xa + xb) / 2, 0.151, zc); fl.receiveShadow = true;
    solid(Math.min(xa, xb), -1, zc - 4, Math.max(xa, xb), 0.15, zc + 4);
    solid(side > 0 ? 23.6 : -26, 0, zc - 4, side > 0 ? 26 : -23.6, 30, zc + 4);         // the alley's far wall (behind the seam)
    const back = add(box(0.4, 8, 8, RZ.pbrMaterial('brick', { mapping: 'world', params: { color: 0x5a4a40 } }), side * 24.2, 0, zc, { detail: false })); back.castShadow = false;
    const v = add(plane(7.6, 5.4, veilM)); v.position.set(side * 21.6, 2.85, zc); v.rotation.y = PI / 2; v.userData.noBatch = true; W.veils.push(v);
    W.lightSrc.push({ p: [side * 17, 3.2, zc], c: 0xffd8a8, i: 9, d: 9 });
  }
  // the avenue's two ends: the road runs on into a seam
  for (const s of [-1, 1]) { const v = add(plane(20, 8, veilM)); v.position.set(0, 4, s * (AV.endZ + 0.6)); v.userData.noBatch = true; W.veils.push(v); solid(-10.6, 0, s > 0 ? 50 : -53, -10, 6, s > 0 ? 53 : -50); solid(10, 0, s > 0 ? 50 : -53, 10.6, 6, s > 0 ? 53 : -50); }
  // ---------- mark plates at the alley mouths (on brackets) ----------
  const bracketMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, metalness: 0.8, roughness: 0.4 });
  for (const [id, [x, y, z]] of Object.entries(AV.marks)) {
    const side = Math.sign(x), g = add(new THREE.Group()); g.position.set(x - side * 0.2, y, z); g.rotation.y = side > 0 ? -PI / 2 : PI / 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), bracketMat); arm.position.set(0, 0.62, -0.1); g.add(arm);
    const plates = {};
    for (const v of ['true', 'mirror', 'nine', 'late']) { const p = symbolPlate('clock', v, 'enamel', 1.1); p.position.z = 0.02; p.visible = false; g.add(p); plates[v] = p; }
    const chalk = symbolPlate('clock', 'true', 'chalk', 1.3); chalk.position.z = 0.04; chalk.position.y = -0.4; g.add(chalk); game.residue(chalk);
    chalk.visible = false; chalk.userData.lapOnly = true;
    W.marks[id] = { g, plates, chalk };
  }
  W.setLap = (lap) => {
    const cfg = LAPS[Math.min(lap, LAPS.length - 1)];
    for (const [id, m] of Object.entries(W.marks)) {
      for (const [v, p] of Object.entries(m.plates)) p.visible = cfg.marks[id] === v;
      m.chalkOn = cfg.residue === id;
      m.chalk.visible = m.chalkOn && game.residueOn;
    }
    for (const c of W.clocks) c.userData.setLap(lap);
  };
  // residue marks belong to one lap only (game.residue() would show every one)
  W.updaters.push(() => { for (const m of Object.values(W.marks)) if (m.chalk.visible && !m.chalkOn) m.chalk.visible = false; });
  // ---------- street furniture ----------
  try {
    const k = streetKit({ era: '2049', seed: 1919 });
    k.kerb([[-6, 52], [-6, -52]]).kerb([[6, -52], [6, 52]]);
    k.markings({ lanes: [{ from: [0, 50], to: [0, -50] }], crossings: [{ at: [0, 18], yaw: PI / 2, width: 11 }], arrows: [{ at: [2.7, 34], yaw: PI }, { at: [-2.7, -6], yaw: 0 }] });
    k.rails([[-0.75, 52], [-0.75, -52]], { embedded: true }).rails([[0.75, 52], [0.75, -52]], { embedded: true });
    k.scatter('lamp', [[-9.2, 46], [-9.2, -46]], { spacing: 16, turn: -PI / 2, y: 0.15 }).scatter('lamp', [[9.2, 44], [9.2, -46]], { spacing: 16, turn: PI / 2, y: 0.15 });
    k.add('bench', [-8.6, 0.15, 38], PI / 2).add('bench', [8.8, 0.15, -12], -PI / 2).bins([[-8.8, 0.15, 30], [8.9, 0.15, 20], [-8.8, 0.15, -20]]);
    k.add('bin', [-19, 0.15, 21.4]).add('bin', [17, 0.15, 5.0]).add('bin', [-15, 0.15, -12.8]).add('bin', [19.5, 0.15, -31]);
    k.car([-4.4, 0, 12], PI).car([4.4, 0, -6], 0).add('scooter', [-8.6, 0.15, -30], 0.4);
    k.puddles([[-2.2, 26, 1.6], [3.0, 2, 1.2], [-3.4, -34, 1.8], [16, 8, 1.0], [-17, -10, 1.0]]);
    k.add('kiosk', AV.kiosk, PI / 2);
    k.cables([[[-10, 9, 22], [10, 8.5, 24]], [[-10, 10, -8], [10, 9.6, -12]], [[-10, 8, 26], [-24, 7.6, 22]], [[10, 8, 10], [24, 7.7, 6]], [[-10, 8, -8], [-24, 7.5, -12]], [[10, 8, -26], [24, 7.8, -30]]]);
    k.add('shelter', AV.shelter, -PI / 2);
    add(k.build());
    for (const c of k.colliders) if (c.kind !== 'shelter') col.add(c.min, c.max);
    solid(9.3, 0.15, 27.6, 9.7, 2.7, 32.4);                                  // the shelter's back wall
  } catch (e) { console.warn('m19 street', e); }
  // timetable and newspaper (code-drawn)
  const tt = textTex('timetable', 256, 384, (g, w) => {
    g.fillStyle = '#1d2a44'; g.fillRect(0, 0, w, 54); lines(g, [['MERIDIAN LINE 4', '#fff', 24]], 16, 36, 24);
    lines(g, ['DEPARTURES · WEEKDAYS', '', '08:14   CENTRAL', '08:14   HELIX RESEARCH', '08:14   OLD QUARTER', '08:14   EASTWAY', '08:14   HARROW NORTH', '08:14   (UNNAMED)', '', 'All services depart', 'at 08:14.', 'No service arrives.'], 18, 84, 19, '#1a1a1a');
  }, '#f2efe6');
  const ttp = add(plane(0.9, 1.35, lit(tt, 0.35))); ttp.position.set(...AV.timetable); ttp.rotation.y = -PI / 2; ttp.userData.noBatch = true;
  const paperTex = textTex('paper', 256, 320, (g) => {
    lines(g, [['THE RAIN CITY COURIER', '#111', 22, SERIF]], 14, 30, 22); g.fillRect(12, 40, 232, 2);
    lines(g, [['VAREN LIBRARY OPENS', '#111', 20], ['ON MERIDIAN', '#111', 20]], 14, 70, 20);
    lines(g, ['Monday 19 October 2026 ·', 'Thursday 14 May 2193 ·', 'Friday 31 July 2049 ·', '', 'The second spire, the', 'river park and the library', 'were approved in 2041.', 'None was ever built.'], 14, 130, 15, '#333');
  }, '#e8e2d2');
  const pp = add(plane(0.5, 0.62, lit(paperTex, 0.3, { side: THREE.DoubleSide }))); pp.position.set(...AV.paper); pp.rotation.set(-0.5, PI / 2, 0); pp.userData.noBatch = true;
  // street clocks: they move one second on every lap
  for (const [x, y, z] of AV.clocks) { const c = add(streetClock([7, 8, 9])); c.position.set(x, y, z); c.rotation.y = PI / 2; W.clocks.push(c); solid(x - 0.15, y, z - 0.15, x + 0.15, y + 3.4, z + 0.15); }
  // ---------- the tram, stopped with its doors open ----------
  {
    const tr = add(new THREE.Group()); tr.position.set(...AV.tram);
    const body = RZ.pbrMaterial('paintedMetalPanel', { mapping: 'object', params: { color: 0xd8dce0 } });
    const win = textTex('tramwin', 512, 64, (g, w, h) => { g.fillStyle = '#20262c'; g.fillRect(0, 0, w, h); for (let k = 0; k < 8; k++) { g.fillStyle = '#7a9aaa'; g.fillRect(8 + k * 63, 8, 52, 46); } }, null);
    tr.add(box(2.6, 2.7, 16, body, 0, 0.35, 0, { detail: false }));
    for (const s of [-1, 1]) { const wp = plane(15.4, 1.0, lit(win, 0.25)); wp.position.set(s * 1.31, 2.15, 0); wp.rotation.y = s * PI / 2; tr.add(wp); }
    tr.add(box(2.6, 0.18, 16, new THREE.MeshStandardMaterial({ color: 0xffd34a, roughness: 0.5 }), 0, 1.3, 0, { detail: false }));
    const pan = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 1.6), bracketMat); pan.position.set(0, 3.5, 0); pan.rotation.x = 0.6; tr.add(pan);
    const sign = textTex('tramsign', 256, 48, (g) => lines(g, [['4 · 08:14 · —', '#ffd34a', 26]], 12, 34, 26), '#0a0c10');
    const sp = plane(1.6, 0.3, lit(sign, 1.2)); sp.position.set(0, 2.85, -8.02); sp.rotation.y = PI; tr.add(sp);
    solid(AV.tram[0] - 1.3, 0, AV.tram[2] - 8, AV.tram[0] + 1.3, 3.2, AV.tram[2] + 8);
    W.lightSrc.push({ p: [0, 2.4, AV.tram[2]], c: 0xe8f0ff, i: 6, d: 8 });
  }
  // ---------- the sky, frozen rain, fragments ----------
  add(skyCity(low));
  const rain = new Motes(low ? 500 : 1100, [-10, 0.4, -46, 10, 9, 46], 0xbcd8ff, 0.05, 0); rain.frozen = true; rain.mesh.material.opacity = 0.55; add(rain.mesh);
  const fr = add(fragments([[-30, 34, -40, 7], [26, 46, 10, 9], [-6, 52, -70, 12], [40, 30, 40, 6], [-44, 40, 20, 8]], 1923));
  W.updaters.push((dt, t) => { fr.userData.update(t); veilM.uniforms.uTime.value = t; });
  W.lightSrc.push({ p: [8.6, 2.4, 30], c: 0xe8f2ff, i: 6, d: 8 }, { p: [-8, 2.8, 4], c: 0xffd0a0, i: 6, d: 8 });
  W.update = (dt, t) => { for (const u of W.updaters) u(dt, t); };
  W.setLap(0);
  return W;
}

export function buildSquare(game, scene, low) {
  const col = game.collision, root = new THREE.Group(); scene.add(root);
  const { x: X, z: Z } = SQ, W = { root, lightSrc: [] };
  const add = (o) => { root.add(o); return o; };
  const solid = (x0, y0, z0, x1, y1, z1) => col.add([X + x0, y0, Z + z0], [X + x1, y1, Z + z1]);
  const stone = RZ.pbrMaterial('cutStone', { mapping: 'world', params: { color: 0x9a948a } });
  const fl = add(plane(44, 40, stone)); fl.rotation.x = -PI / 2; fl.position.set(X, 0, Z); fl.receiveShadow = true;
  solid(-22, -1, -20, 22, 0, 20);
  // balustrade on the open south edge, the void beyond
  const bal = RZ.pbrMaterial('cutStone', { mapping: 'object', params: { color: 0xb0a898 } });
  add(box(44, 0.2, 0.5, bal, X, 1.0, Z + 19.6, { detail: false }));
  for (let k = -21; k <= 21; k += 1.4) add(box(0.18, 1.0, 0.18, bal, X + k, 0, Z + 19.6, { detail: false }));
  solid(-22, 0, 19.3, 22, 1.2, 20);
  // Hensel's building (north), a 2026 house (west), a 2196 ruin (east)
  try {
    const b = RZ.cityBlock([
      { width: 18, depth: 12, height: 18, position: [X, 0, Z - 20], yaw: 0, seed: 1931, wall: 'brick', era: '2049', groundFloor: 4.6, faces: ['shop', 'windows', 'blank', 'windows'], groundBlank: [true, false, false, false] },
    ], { era: '2049', lit: 0.4, daylight: 0.5, detail: low ? 'low' : undefined });
    add(b.mesh); game.blocker(b.mesh);
    const b2 = RZ.cityBlock([{ width: 14, depth: 12, height: 22, position: [X - 22, 0, Z - 2], yaw: PI / 2, seed: 1932, wall: 'plaster', era: '2026', faces: ['windows', 'windows', 'blank', 'windows'] }], { era: '2026', lit: 0.2, daylight: 0.6, detail: low ? 'low' : undefined });
    add(b2.mesh);
    const b3 = RZ.cityBlock([{ width: 14, depth: 12, height: 26, position: [X + 22, 0, Z - 2], yaw: -PI / 2, seed: 1933, wall: 'concrete', era: '2196', ruin: 0.6, moss: 0.5, collapse: true, faces: ['windows', 'windows', 'blank', 'windows'] }], { era: '2196', lit: 0, daylight: 0.6, detail: low ? 'low' : undefined });
    add(b3.mesh);
  } catch (e) { console.warn('m19 square blocks', e); }
  solid(-9, 0, -26, 9, 18, -14); solid(-28, 0, -9, -16, 22, 5); solid(16, 0, -9, 28, 26, 5);
  // shopfront: dark green frame, display windows full of clocks, the sign, the door
  const green = new THREE.MeshStandardMaterial({ color: 0x1e2a24, roughness: 0.45, metalness: 0.2 });
  add(box(9.2, 0.5, 0.3, green, X, 3.6, Z - 13.9, { detail: false }));
  for (const sx of [-4.45, -1.0, 1.0, 4.45]) add(box(0.3, 3.6, 0.3, green, X + sx, 0, Z - 13.9, { detail: false }));
  const signTex = textTex('henselsign', 512, 96, (g, w) => { g.textAlign = 'center'; lines(g, [['HENSEL', '#d8b468', 56, SERIF]], w / 2, 62, 56); lines(g, [['UHREN · CLOCKS · REPAIRS · SINCE 1961', '#d8b468', 15]], w / 2, 86, 15); }, '#1e2a24');
  const sg = add(plane(7.6, 1.4, lit(signTex, 0.5))); sg.position.set(X, 4.4, Z - 13.7);
  const dispTex = textTex('display', 256, 192, (g) => { g.fillStyle = '#2a2016'; g.fillRect(0, 0, 256, 192); for (let k = 0; k < 9; k++) drawClock(g, 40 + (k % 3) * 88, 36 + Math.floor(k / 3) * 62, 24, 'true', '#f0e0b0'); }, null);
  for (const sx of [-2.7, 2.7]) { const d = add(plane(3.1, 2.8, lit(dispTex, 0.6))); d.position.set(X + sx, 1.9, Z - 13.82); }
  const door = add(box(1.7, 3.0, 0.12, new THREE.MeshStandardMaterial({ color: 0x24332a, roughness: 0.5 }), X, 0, Z - 13.86, { detail: false }));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.3 })); knob.position.set(0.6, -0.1, 0.08); door.add(knob);
  const dm = add(symbolPlate('clock', 'true', 'brass', 0.6)); dm.position.set(X, 2.3, Z - 13.78);
  W.door = door; W.lightSrc.push({ p: [X, 2.6, Z - 12.2], c: 0xffc890, i: 12, d: 10 });
  // the great bracket clock: 08:14:09 and its second hand stuck between 9 and 10
  const ck = add(streetClock([9.6])); ck.position.set(X + 4.6, 3.0, Z - 13.1); ck.rotation.y = 0; ck.scale.setScalar(1.25);
  // plaque for the square (optional)
  const plTex = textTex('sqplaque', 256, 160, (g) => lines(g, [['CLOCK SQUARE', '#d8c890', 22, SERIF], '', ['Approved 2041 for the', '#d8d0b8', 16], ['Old Quarter. Never built.', '#d8d0b8', 16], ['Here anyway.', '#d8d0b8', 16]], 16, 34, 18), '#3a3428');
  const plq = add(plane(0.9, 0.56, lit(plTex, 0.3, { metalness: 0.5 }))); plq.position.set(...SQ.plaque);
  // fountain: water stopped mid-fall
  const basin = add(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.7, 40), bal)); basin.position.set(X, 0.35, Z); basin.castShadow = true;
  const waterM = new THREE.MeshPhysicalMaterial({ color: 0x9ac8d8, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.55, clearcoat: 1 });
  const wtop = add(new THREE.Mesh(new THREE.CircleGeometry(3.1, 40), waterM)); wtop.rotation.x = -PI / 2; wtop.position.set(X, 0.62, Z);
  const col2 = add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 16), bal)); col2.position.set(X, 1.6, Z);
  const jet = add(new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.6, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide }))); jet.position.set(X, 2.9, Z); jet.rotation.x = PI;
  const drops = new Motes(low ? 160 : 320, [X - 2.6, 0.8, Z - 2.6, X + 2.6, 3.6, Z + 2.6], 0xd8f0ff, 0.06, 0); drops.frozen = true; add(drops.mesh);
  solid(-3.6, 0, -3.6, 3.6, 0.7, 3.6); solid(-0.5, 0, -0.5, 0.5, 3, 0.5);
  // lamps, benches, trees
  try {
    const k = streetKit({ era: '2049', seed: 1939 });
    k.add('lamp', [X - 12, 0, Z + 8], 0).add('lamp', [X + 12, 0, Z + 8], 0).add('lamp', [X - 12, 0, Z - 9], 0).add('lamp', [X + 12, 0, Z - 9], 0);
    k.add('bench', [X - 7, 0, Z + 6], 0.3).add('bench', [X + 7, 0, Z + 6], -0.3).add('bin', [X + 9, 0, Z - 11]);
    add(k.build()); for (const c of k.colliders) col.add(c.min, c.max);
  } catch (e) { console.warn('m19 square street', e); }
  { const leaf = new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.9, flatShading: true });
    for (const [x, z] of [[-14, 12], [14, 13]]) { add(box(2.4, 0.6, 2.4, bal, X + x, 0, Z + z, { detail: false })); for (let k = 0; k < 4; k++) { const b = add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + (k % 2) * 0.25, 1), leaf)); b.position.set(X + x + (k % 2 - 0.5) * 0.9, 1.0 + (k > 1 ? 0.5 : 0), Z + z + (k > 1 ? 0.4 : -0.4)); b.castShadow = true; } solid(x - 1.2, 0, z - 1.2, x + 1.2, 0.6, z + 1.2); } }
  add(skyCity(low, 1937));
  const fr = add(fragments([[X - 30, 26, Z - 30, 8], [X + 34, 34, Z + 6, 7], [X + 6, 44, Z - 50, 12]], 1938));
  W.lightSrc.push({ p: [X, 3.2, Z], c: 0xd8ecff, i: 7, d: 10 });
  W.update = (dt, t) => { fr.userData.update(t); };
  return W;
}

// =====================================================================================================================
// II · THE HOUSE OF ROOMS
// =====================================================================================================================
export function buildRooms(game, scene, low) {
  const col = game.collision, W = { rooms: [], doors: [], lightSrc: [], dials: null, updaters: [] };
  const mats = {
    plasterW: RZ.pbrMaterial('plaster', { mapping: 'world', params: { color: 0xd8ccb4 } }), wood: RZ.pbrMaterial('wood', { mapping: 'world' }),
    stone: RZ.pbrMaterial('cutStone', { mapping: 'world', params: { color: 0x8a8680 } }), panel: RZ.pbrMaterial('paintedMetalPanel', { mapping: 'world', params: { color: 0xe4e6e8 } }),
    tile: RZ.pbrMaterial('ceramicTile', { mapping: 'world', params: { color: 0xc8ccd0 } }), tileW: RZ.pbrMaterial('ceramicTile', { mapping: 'world', params: { color: 0xe8e2d0 } }),
    plasterG: RZ.pbrMaterial('plaster', { mapping: 'world', params: { color: 0x6a6460 } }), plasterK: RZ.pbrMaterial('plaster', { mapping: 'world', params: { color: 0xece4d0 } }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.32 }), dark: new THREE.MeshStandardMaterial({ color: 0x2a221a, roughness: 0.7 }),
    doorWood: new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 0.55 }), doorWhite: new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.4 }),
    doorGreen: new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.5 }), frame: new THREE.MeshStandardMaterial({ color: 0x1e1a16, roughness: 0.5 }),
  };
  const style = [
    { wall: mats.plasterW, floor: mats.wood, ceil: mats.plasterW, door: mats.doorWood, light: 0xffc890 },
    { wall: mats.stone, floor: mats.stone, ceil: mats.stone, door: mats.doorWood, light: 0xb8c8ff },
    { wall: mats.panel, floor: mats.tile, ceil: mats.panel, door: mats.doorWhite, light: 0xe8f2ff },
    { wall: mats.plasterG, floor: mats.stone, ceil: mats.plasterG, door: mats.frame, light: 0xd8d0ff },
    { wall: mats.plasterK, floor: mats.wood, ceil: mats.plasterK, door: mats.doorGreen, light: 0xffe0b0 },
    { wall: mats.tileW, floor: mats.tile, ceil: mats.panel, door: mats.doorWhite, light: 0xe8f0ff },
  ];
  const HW = 5, T = 0.3;
  ROOMS.forEach((R, i) => {
    const g = new THREE.Group(), cx = ROOM_X(i), H = R.h, st = style[i]; scene.add(g); g.visible = false;
    const room = { i, id: R.id, g, cx, H, doors: {}, updaters: [] }; W.rooms.push(room);
    const add = (o) => { g.add(o); return o; };
    const fl = add(plane(10, 10, st.floor)); fl.rotation.x = -PI / 2; fl.position.set(cx, 0, 0); fl.receiveShadow = true;
    const ce = add(plane(10, 10, st.ceil)); ce.rotation.x = PI / 2; ce.position.set(cx, H, 0);
    col.add([cx - 6, -1, -6], [cx + 6, 0, 6]);
    for (const [side, [dx, dz]] of Object.entries(SIDE)) {
      const hasDoor = !!DOORS[i]?.[side];
      const wx = cx + dx * HW, wz = dz * HW, alongX = dz !== 0;
      if (!hasDoor) {
        const w = add(box(alongX ? 10 + T : T, H, alongX ? T : 10 + T, st.wall, wx, 0, wz, { detail: false })); w.castShadow = false;
      } else {
        // wall in two halves and a lintel band around a 1.3 x 2.4 door
        for (const s of [-1, 1]) { const len = (10 - 1.3) / 2, off = s * (1.3 / 2 + len / 2); const w = add(box(alongX ? len : T, H, alongX ? T : len, st.wall, wx + (alongX ? off : 0), 0, wz + (alongX ? 0 : off), { detail: false })); w.castShadow = false; }
        add(box(alongX ? 1.3 : T, H - 2.4, alongX ? T : 1.3, st.wall, wx, 2.4, wz, { detail: false })).castShadow = false;
        // frame + leaf (closed); the leaf faces into the room
        const fr = new THREE.Group(); fr.position.set(wx - dx * 0.16, 0, wz - dz * 0.16); fr.rotation.y = Math.atan2(-dx, -dz); add(fr);
        fr.add(box(0.12, 2.5, 0.2, mats.frame, -0.71, 0, 0, { detail: false })); fr.add(box(0.12, 2.5, 0.2, mats.frame, 0.71, 0, 0, { detail: false })); fr.add(box(1.54, 0.12, 0.2, mats.frame, 0, 2.44, 0, { detail: false }));
        const leaf = box(1.28, 2.38, 0.06, R.id === 'kitchen' || (i === 1 && side === 'W') ? mats.doorGreen : st.door, 0, 0.02, -0.02, { detail: false }); fr.add(leaf);
        const kn = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mats.brass); kn.position.set(0.5, 1.05, 0.06); fr.add(kn);
        const d = DOORS[i][side];
        if (d.sym) { const p = symbolPlate(d.sym[0], d.sym[1], i === 2 ? 'dark' : 'brass', 0.62); p.position.set(0, 2.92, 0.04); fr.add(p); }
        room.doors[side] = { fr, leaf, pos: [wx - dx * 0.9, 0, wz - dz * 0.9], face: Math.atan2(-dx, -dz), ...d };
      }
      // collision: the wall with a door gap (doors are closed: a thin box across the gap too)
      if (alongX) col.add([cx - 5.2, 0, wz - 0.15], [cx + 5.2, H, wz + 0.15]); else col.add([wx - 0.15, 0, -5.2], [wx + 0.15, H, 5.2]);
    }
    W.lightSrc.push({ p: [cx, H - 0.6, 0], c: st.light, i: 14, d: 13, room: i }, { p: [cx + 2.5, 2.0, 2.5], c: st.light, i: 4, d: 7, room: i });
    // ceiling fitting
    const fit = add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.18, 16), glowMat(st.light, 1.6))); fit.position.set(cx, H - 0.1, 0);
    // room-specific dressing
    if (R.id === 'workshop') dressWorkshop(g, cx, mats, col, room);
    if (R.id === 'observatory') dressObservatory(g, cx, mats, col, room);
    if (R.id === 'lab') dressLab(g, cx, mats, col, room);
    if (R.id === 'gallery') dressGallery(g, cx, mats, col, room, W);
    if (R.id === 'kitchen') dressKitchen(g, cx, mats, col, room);
    if (R.id === 'hall') dressHall(g, cx, mats, col, room);
  });
  W.show = (i) => { for (const r of W.rooms) r.g.visible = r.i === i; W.cur = i; };
  W.update = (dt, t) => { const r = W.rooms[W.cur]; if (r) for (const u of r.updaters) u(dt, t); };
  return W;
}
function clockBody(r, faceTex, mats) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.08, 24), mats.dark); rim.rotation.x = PI / 2; g.add(rim);
  const f = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.4 })); f.position.z = 0.045; g.add(f);
  return g;
}
function dressWorkshop(g, cx, m, col, room) {
  const add = (o) => { g.add(o); return o; };
  const faces = ['true', 'late', 'true', 'nine'].map(v => canvasTex(128, 128, (c) => { c.fillStyle = '#efe4c8'; c.fillRect(0, 0, 128, 128); drawClock(c, 64, 64, 54, v, '#2a1a0a'); }, 'm19wface' + v));
  // a wall of clocks (west half of the north wall and the east wall), lower wood panelling
  for (let k = 0; k < 14; k++) { const c = add(clockBody(0.16 + (k % 3) * 0.06, faces[k % 4], m)); const onN = k < 7; c.position.set(onN ? cx - 4 + (k % 7) * 0.52 - (k % 7 > 3 ? -1.8 : 0) : cx + 4.82, 1.8 + (k % 3) * 0.55, onN ? -4.82 : -3.6 + (k - 7) * 0.6); if (!onN) c.rotation.y = -PI / 2; }
  for (const [x, z, w, d] of [[cx - 4.8, 0, 0.1, 9.6], [cx + 4.8, 0, 0.1, 9.6]]) add(box(w, 1.0, d, m.wood, x, 0, z, { detail: false }));
  // benches with parts, a lamp, a grandfather clock
  add(box(3.2, 0.9, 0.9, m.wood, cx - 2.6, 0, 3.6, { detail: false })); add(box(0.9, 0.9, 2.6, m.wood, cx + 3.9, 0, 1.6, { detail: false }));
  col.add([cx - 4.2, 0, 3.15], [cx - 1.0, 0.9, 4.05]); col.add([cx + 3.45, 0, 0.3], [cx + 4.35, 0.9, 2.9]);
  for (let k = 0; k < 7; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + (k % 3) * 0.03, 0.05 + (k % 3) * 0.03, 0.02, 16), m.brass); p.position.set(cx - 3.8 + k * 0.42, 0.92, 3.5 + (k % 2) * 0.2); add(p); }
  const gf = add(box(0.7, 2.3, 0.45, m.dark, cx + 3.9, 0, -4.4, { detail: false })); col.add([cx + 3.5, 0, -4.7], [cx + 4.3, 2.3, -4.1]);
  const gff = add(clockBody(0.26, faces[0], m)); gff.position.set(cx + 3.9, 1.95, -4.15); void gf;
  const pend = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), m.brass)); pend.rotation.x = PI / 2; pend.position.set(cx + 3.9, 1.05, -4.15);
  room.updaters.push((dt, t) => { pend.position.x = cx + 3.9 + Math.sin(t * 2.2) * 0.14; });
  const lampL = add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.22, 16, 1, true), m.brass)); lampL.position.set(cx - 2.6, 1.55, 3.6);
}
function dressObservatory(g, cx, m, col, room) {
  const add = (o) => { g.add(o); return o; };
  const ring = add(new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.05, 6, 64), m.brass)); ring.rotation.x = PI / 2; ring.position.set(cx, 0.02, 0);
  const arm = new THREE.Group(); arm.position.set(cx, 2.0, 0); add(arm);
  for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.9 + k * 0.25, 0.035, 8, 48), m.brass); r.rotation.set(k * 0.7, k * 0.4, 0); arm.add(r); }
  const ped = add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.0, 16), m.stone)); ped.position.set(cx, 0.5, 0); col.add([cx - 0.4, 0, -0.4], [cx + 0.4, 1.4, 0.4]);
  room.updaters.push((dt) => { arm.children.forEach((r, i) => { r.rotation.y += dt * 0.15 * (i + 1); }); });
  // the oculus: the true pattern in the night sky through the ceiling
  const sky = symbolPlate('star', 'true', 'sky', 3.4); sky.rotation.x = PI / 2; sky.position.set(cx, 5.18, 0); add(sky);
  const rim = add(new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.12, 8, 48), m.brass)); rim.rotation.x = PI / 2; rim.position.set(cx, 5.1, 0);
  // the seventeen date stones along the walls (M7's Hall of Dates)
  for (let k = 0; k < 8; k++) { const s = add(box(0.5, 0.8, 0.25, m.stone, cx - 4.2 + (k % 4) * 0.7 + (k > 3 ? 5.6 : 0) - (k > 3 ? 0.4 : 0), 0, 4.7, { detail: false })); s.castShadow = false; }
  room.sky = sky;
}
function dressLab(g, cx, m, col, room) {
  const add = (o) => { g.add(o); return o; };
  const scr = textTex('labscreen', 512, 288, (c, w, h) => { c.fillStyle = '#06121a'; c.fillRect(0, 0, w, h); drawHelix(c, 120, 140, 80, 'true', '#e8f2ff'); lines(c, [['HELIX TEMPORAL RESEARCH', '#e8f2ff', 22], ['TEST LAB 4 · CHRONOLITH ACCESS', '#9fb4c8', 16], ['', '#9fb4c8', 14], ['OPERATOR: K. VAREN', '#5fe6ff', 18], ['STATE: —', '#9fb4c8', 16]], 230, 110, 20); }, null);
  for (const [x, z, ry] of [[cx - 4.84, -2, PI / 2], [cx + 4.84, 2.4, -PI / 2]]) { const s = add(plane(2.2, 1.24, lit(scr, 0.9))); s.position.set(x, 1.9, z); s.rotation.y = ry; }
  // benches, a glass partition, the Chronolith schematic
  add(box(3.0, 0.92, 0.8, m.panel, cx - 2.6, 0, -3.9, { detail: false })); col.add([cx - 4.1, 0, -4.3], [cx - 1.1, 0.92, -3.5]);
  add(box(0.8, 0.92, 3.0, m.panel, cx + 4.1, 0, -1.8, { detail: false })); col.add([cx + 3.7, 0, -3.3], [cx + 4.5, 0.92, -0.3]);
  const glass = add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.4, 3.6), new THREE.MeshPhysicalMaterial({ color: 0xcfe6f0, transparent: true, opacity: 0.18, roughness: 0.05 }))); glass.position.set(cx + 1.6, 1.2, 2.6); col.add([cx + 1.55, 0, 0.8], [cx + 1.65, 2.4, 4.4]);
  const sch = textTex('schem', 512, 256, (c, w, h) => { c.fillStyle = '#e8eaec'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1d2a44'; c.lineWidth = 4; c.beginPath(); c.arc(140, 128, 90, 0, PI * 2); c.stroke(); c.lineWidth = 2; c.beginPath(); c.arc(140, 128, 70, 0, PI * 2); c.stroke(); lines(c, [['CHRONOLITH · ARTEFACT A', '#1d2a44', 20], ['Ring diameter 4.8 m', '#333', 15], ['Resonance 4.1 kHz', '#333', 15], ['Do not stand inside', '#8a1a1a', 15], ['the ring during a run.', '#8a1a1a', 15]], 260, 80, 22); }, null);
  const sp = add(plane(2.4, 1.2, lit(sch, 0.3))); sp.position.set(cx - 1.0, 2.0, -4.83);
  // Kai's ID card on the bench
  const id = textTex('kaiid', 256, 160, (c) => { c.fillStyle = '#e8eaec'; c.fillRect(0, 0, 256, 160); drawHelix(c, 50, 60, 30, 'true', '#1d2a44'); lines(c, [['K. VAREN', '#111', 22], ['TEMPORAL SYSTEMS', '#333', 13], ['ACCESS: ALL LEVELS', '#333', 13], ['VALID: —', '#8a1a1a', 13]], 100, 50, 22); c.fillStyle = '#3a3026'; c.fillRect(18, 100, 60, 46); }, null);
  const idm = add(plane(0.3, 0.19, lit(id, 0.35))); idm.rotation.x = -PI / 2; idm.position.set(cx - 2.2, 0.93, -3.8); room.idCard = idm;
}
function dressGallery(g, cx, m, col, room, W) {
  const add = (o) => { g.add(o); return o; };
  for (const [x, z] of [[-3.6, -3], [3.6, -3], [-3.6, 2], [3.6, 2]]) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 7, 16), m.stone)).position.set(cx + x, 3.5, z); col.add([cx + x - 0.38, 0, z - 0.38], [cx + x + 0.38, 7, z + 0.38]); }
  // the great door: twice the height, three dials in its frame
  const fr = new THREE.Group(); fr.position.set(cx, 0, -4.78); add(fr);
  fr.add(box(3.4, 0.4, 0.4, m.frame, 0, 4.4, 0, { detail: false })); fr.add(box(0.3, 4.4, 0.4, m.frame, -1.55, 0, 0, { detail: false })); fr.add(box(0.3, 4.4, 0.4, m.frame, 1.55, 0, 0, { detail: false }));
  const leaf = box(2.8, 4.36, 0.12, new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.45, metalness: 0.3 }), 0, 0.02, 0.02, { detail: false }); fr.add(leaf);
  const dials = [];
  ['clock', 'star', 'helix'].forEach((kind, k) => {
    const d = new THREE.Group(); d.position.set(-0.9 + k * 0.9, 3.1, 0.12); fr.add(d);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 8, 32), m.brass); d.add(ring);
    const plates = {}; for (const v of DIAL[kind]) { const p = symbolPlate(kind, v, kind === 'helix' ? 'dark' : 'brass', 0.62); p.visible = false; p.position.z = 0.01; d.add(p); plates[v] = p; }
    dials.push({ kind, d, plates, idx: 0, pos: [cx - 0.9 + k * 0.9, 1.0, -4.1] });
  });
  W.dials = { list: dials, leaf, set(k, idx) { const D = dials[k]; D.idx = idx % DIAL[D.kind].length; for (const [v, p] of Object.entries(D.plates)) p.visible = v === DIAL[D.kind][D.idx]; } };
  dials.forEach((_, k) => W.dials.set(k, 0));
  // three reference alcoves: one symbol of each, true, where the player can study them (optional reading)
  room.alcoves = [];
  ['clock', 'star', 'helix'].forEach((kind, k) => { const x = cx - 4.84, z = -2.6 + k * 2.4; const p = add(symbolPlate(kind, 'true', kind === 'helix' ? 'dark' : 'brass', 0.8)); p.position.set(x, 1.7, z); p.rotation.y = PI / 2; room.alcoves.push([x + 0.8, 0, z, kind]); });
  const motes = new Motes(120, [cx - 4, 0.3, -4, cx + 4, 6.5, 4], 0xffe8c0, 0.04, 0.12); add(motes.mesh); room.updaters.push(dt => motes.update(dt));
}
function dressKitchen(g, cx, m, col, room) {
  const add = (o) => { g.add(o); return o; };
  const table = add(box(1.6, 0.76, 1.0, m.wood, cx, 0, 0.4, { detail: false })); col.add([cx - 0.8, 0, -0.1], [cx + 0.8, 0.76, 0.9]); void table;
  for (const [x, z] of [[-1.1, 0.4], [1.1, 0.4], [0, 1.3]]) { add(box(0.44, 0.46, 0.44, m.wood, cx + x, 0, z, { detail: false })); }
  add(box(4.2, 0.9, 0.62, m.panel, cx - 1.6, 0, -4.6, { detail: false })); col.add([cx - 3.7, 0, -4.9], [cx + 0.5, 0.9, -4.3]);
  const fridge = add(box(0.75, 1.8, 0.7, m.doorWhite, cx + 1.4, 0, -4.5, { detail: false })); col.add([cx + 1.0, 0, -4.9], [cx + 1.8, 1.8, -4.1]); void fridge;
  const draw = textTex('drawing', 256, 192, (c) => { c.fillStyle = '#fbf8f0'; c.fillRect(0, 0, 256, 192); c.lineWidth = 4; c.strokeStyle = '#2a4aa0'; c.beginPath(); c.arc(60, 70, 14, 0, 7); c.moveTo(60, 84); c.lineTo(60, 130); c.stroke(); c.strokeStyle = '#a02a6a'; c.beginPath(); c.arc(120, 66, 16, 0, 7); c.moveTo(120, 82); c.lineTo(120, 132); c.stroke(); c.strokeStyle = '#111'; c.lineWidth = 9; c.beginPath(); c.arc(200, 92, 38, 0, 7); c.stroke(); lines(c, [['ME · MIRA · THE MACHINE', '#2a2a2a', 18, HAND]], 20, 176, 18, '#2a2a2a', HAND); }, null);
  const dp = add(plane(0.42, 0.32, lit(draw, 0.25))); dp.position.set(cx + 1.4, 1.35, -4.14);
  const win = textTex('kwin', 256, 192, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9ac0e8'); gr.addColorStop(1, '#f8e0b0'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#6a7a8a'; for (let k = 0; k < 7; k++) c.fillRect(k * 38, 120 - (k * 23) % 60, 30, 100); c.fillStyle = 'rgba(255,255,255,0.75)'; for (let y = 0; y < h; y += 14) c.fillRect(0, y, w, 3); }, null);
  const wp = add(plane(2.2, 1.4, lit(win, 1.1))); wp.position.set(cx - 4.84, 1.7, 0); wp.rotation.y = PI / 2;
  const kc = add(clockBody(0.2, canvasTex(128, 128, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 128); drawClock(c, 64, 64, 54, 'true', '#222'); }, 'm19kclock'), m)); kc.position.set(cx - 1.6, 2.2, -4.82);
  room.drawing = dp;
}
function dressHall(g, cx, m, col, room) {
  const add = (o) => { g.add(o); return o; };
  const board = textTex('board', 512, 256, (c, w) => { c.fillStyle = '#0a0c10'; c.fillRect(0, 0, w, 256); lines(c, [['DEPARTURES', '#ffd34a', 26], '', ['08:14  LINE 1   CENTRAL', '#ffd34a', 22], ['08:14  LINE 4   MERIDIAN', '#ffd34a', 22], ['08:14  LINE 6   EASTWAY', '#ffd34a', 22], ['08:14  —        HOME', '#ffd34a', 22]], 24, 36, 24); }, null);
  const b = add(plane(3.6, 1.8, lit(board, 1.1))); b.position.set(cx, 3.1, -4.84);
  for (let k = 0; k < 3; k++) { add(box(0.7, 1.7, 0.5, m.panel, cx + 4.4, 0, -2.4 + k * 1.4, { detail: false })); col.add([cx + 4.05, 0, -2.65 + k * 1.4], [cx + 4.75, 1.7, -2.15 + k * 1.4]); const sc = add(plane(0.4, 0.3, glowMat(0x7ad8ff, 0.8))); sc.position.set(cx + 4.14, 1.3, -2.4 + k * 1.4); sc.rotation.y = -PI / 2; }
  for (let k = 0; k < 4; k++) { add(box(0.12, 1.0, 1.0, m.panel, cx - 2.2 + k * 1.4, 0, 1.6, { detail: false })); col.add([cx - 2.26 + k * 1.4, 0, 1.1], [cx - 2.14 + k * 1.4, 1.0, 2.1]); }
  add(box(2.4, 0.45, 0.5, m.wood, cx - 3.4, 0, -3.8, { detail: false }));
  const piano = add(box(1.5, 1.1, 0.6, m.dark, cx + 2.6, 0, 4.4, { detail: false })); col.add([cx + 1.85, 0, 4.1], [cx + 3.35, 1.1, 4.7]); void piano;
  const keys = add(plane(1.3, 0.18, new THREE.MeshStandardMaterial({ map: canvasTex(256, 32, (c) => { c.fillStyle = '#f4f0e6'; c.fillRect(0, 0, 256, 32); c.fillStyle = '#111'; for (let k = 0; k < 18; k++) { c.fillRect(k * 14.2, 0, 1, 32); if ([0, 1, 3, 4, 5].includes(k % 7)) c.fillRect(k * 14.2 + 9, 0, 8, 19); } }, 'm19keys') }))); keys.rotation.x = -PI / 2 + 0.2; keys.position.set(cx + 2.6, 1.0, 4.02);
}

// =====================================================================================================================
// III / IV · THE MIRROR GORGE, THE CONCOURSE OF DOORS, TEST HALL ZERO
// =====================================================================================================================
export function buildMirror(game, scene, low) {
  const col = game.collision, root = new THREE.Group(); scene.add(root);
  const W = { root, lightSrc: [], sliders: [], updaters: [], stripDist: (x, z) => stripInfo(x, z).d };
  const add = (o, parent = root) => { parent.add(o); return o; };
  const solid = (x0, y0, z0, x1, y1, z1, o) => col.add([x0, y0, z0], [x1, y1, z1], o);
  // the reflection world: everything added to `refl` is drawn mirrored under the lake
  const refl = new THREE.Group(); refl.scale.y = -1; refl.position.y = 2 * LAKE; root.add(refl); W.refl = refl;
  const both = (mesh) => { add(mesh); const c = mesh.clone(); refl.add(c); return mesh; };
  const stone = RZ.pbrMaterial('cutStone', { mapping: 'world', params: { color: 0xb8b0a2 } });
  const rock = RZ.pbrMaterial('rock', { mapping: 'triplanar', params: { color: 0x6a6660 } });
  const stoneO = RZ.pbrMaterial('cutStone', { mapping: 'object', params: { color: 0xc8c0b0 } });
  // balustrade and rail posts: collected, then drawn as instanced meshes (a few draws instead of ~250)
  const balPosts = [], railPosts = [];
  const postRun = (list, w, mat, parent, cast) => { if (!list.length) return; const g = new THREE.BoxGeometry(w, 1.0, w); g.translate(0, 0.5, 0); const im = new THREE.InstancedMesh(g, mat, list.length); const M = new THREE.Matrix4(); list.forEach(([x, z], i) => { M.makeTranslation(x, 0, z); im.setMatrixAt(i, M); }); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = cast; im.receiveShadow = true; parent.add(im); };
  // ---------- the lake (a still mirror) ----------
  const lakeM = new THREE.MeshPhysicalMaterial({ color: 0x0c141c, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.6, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, depthWrite: false });
  const lake = add(plane(260, 200, lakeM)); lake.rotation.x = -PI / 2; lake.position.set(0, LAKE, -30); lake.renderOrder = 2; lake.userData.noBatch = true; W.lake = lake;
  // ---------- the start terrace and its cliff ----------
  both(box(30, 7.7, 20, rock, 0, LAKE, 26.4, { detail: false }));   // top just under the paving (no coplanar faces)
  const ter = add(box(30, 0.3, 20, stone, 0, -0.3, 26.4, { detail: false })); ter.castShadow = false; refl.add(ter.clone());
  solid(-15, -8, 16.4, 15, 0, 36.4); solid(-15, 0, 36.4, 15, 6, 37); solid(-15.6, 0, 16.4, -15, 6, 36.4); solid(15, 0, 16.4, 15.6, 6, 36.4);
  // balustrade with the gap where the bridge would start, and the arch over the gap
  for (const s of [-1, 1]) {
    both(box(13.4, 0.2, 0.4, stoneO, s * 8.2, 1.0, 16.6, { detail: false }));
    for (let k = 1.6; k <= 14.6; k += 1.0) balPosts.push([s * k, 16.6]);
    solid(s > 0 ? 1.5 : -15, 0, 16.4, s > 0 ? 15 : -1.5, 1.2, 16.8);
    both(box(0.9, 5.2, 0.9, stoneO, s * 2.0, 0, 16.6, { detail: false }));
    solid(s * 2.0 - 0.45, 0, 16.15, s * 2.0 + 0.45, 5.2, 17.05);
  }
  both(box(4.9, 0.8, 0.9, stoneO, 0, 5.2, 16.6, { detail: false }));
  const keyst = both(symbolPlate('clock', 'true', 'inlay', 0.7)); keyst.position.set(0, 5.6, 16.14); keyst.rotation.y = PI;
  // the door Kai came through, standing alone at the back of the terrace
  const backDoor = new THREE.Group(); backDoor.position.set(0, 0, 34.6); add(backDoor);
  backDoor.add(box(1.6, 2.6, 0.3, new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.5 }), 0, 0, 0, { detail: false }));
  // lamps along the terrace (reflected)
  const lampMat = glowMat(0xffe0b0, 2.2), postMat = new THREE.MeshStandardMaterial({ color: 0x23282c, roughness: 0.45, metalness: 0.8 });
  const lamp = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 8), postMat); p.position.y = 1.6; g.add(p); const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), lampMat); h.position.y = 3.3; g.add(h); parent.add(g); return g; };
  for (const x of [-12, -6, 6, 12]) { lamp(x, 0, 18, root); lamp(x, 0, 18, refl); W.lightSrc.push({ p: [x, 3.3, 18], c: 0xffe0b0, i: 5, d: 9 }); }
  // ---------- the bridge: collision only; its deck, posts and lamps exist only in the reflection ----------
  const deckM = RZ.pbrMaterial('cutStone', { mapping: 'object', params: { color: 0xd8d0c0 } });
  const railM = new THREE.MeshStandardMaterial({ color: 0x8a8476, roughness: 0.4, metalness: 0.6 });
  W.deckBoxes = [];
  const deck = (x0, x1, z0, z1, parent = refl) => {
    const w = x1 - x0, d = z1 - z0, m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, d), deckM); m.position.set((x0 + x1) / 2, -0.16, (z0 + z1) / 2); m.receiveShadow = true; parent.add(m);
    return m;
  };
  BR.deck.forEach(([x0, x1, z0, z1], i) => {
    deck(x0, x1, z0, z1); W.deckBoxes.push(solid(x0, -1, z0, x1, 0, z1));
    if (i < 5 || i === 8) { const long = (z1 - z0) > (x1 - x0); const n = Math.floor((long ? z1 - z0 : x1 - x0) / 3);
      for (let k = 0; k <= n; k++) { const t = n ? k / n : 0.5; for (const s of [0, 1]) { const px = long ? (s ? x1 - 0.08 : x0 + 0.08) : x0 + t * (x1 - x0), pz = long ? z0 + t * (z1 - z0) : (s ? z1 - 0.08 : z0 + 0.08); railPosts.push([px, pz]); } }
      if (i % 2 === 0) lamp(x0 + 0.1, 0, (z0 + z1) / 2, refl);
    }
  });
  // the island: a broken piece of a station platform, real and visible (a place to stand and breathe)
  const [ix0, ix1, iz0, iz1] = BR.island;
  const isl = both(box(ix1 - ix0, 2.9, iz1 - iz0, rock, (ix0 + ix1) / 2, -3.2, (iz0 + iz1) / 2, { detail: false })); void isl;
  both(box(ix1 - ix0, 0.3, iz1 - iz0, RZ.pbrMaterial('concrete', { mapping: 'world', params: { color: 0x9a9a96 } }), (ix0 + ix1) / 2, -0.3, (iz0 + iz1) / 2, { detail: false }));
  solid(ix0, -3.2, iz0, ix1, 0, iz1);
  const edge = both(box(ix1 - ix0, 0.02, 0.4, new THREE.MeshStandardMaterial({ color: 0xffd34a, roughness: 0.5 }), (ix0 + ix1) / 2, 0.0, iz1 - 0.3, { detail: false })); void edge;
  both(box(1.8, 0.45, 0.5, RZ.pbrMaterial('wood', { mapping: 'object' }), BR.bench[0], 0, BR.bench[2] + 0.4, { detail: false }));
  solid(BR.bench[0] - 0.9, 0, BR.bench[2] + 0.15, BR.bench[0] + 0.9, 0.45, BR.bench[2] + 0.65);
  const sign = textTex('islsign', 256, 64, (g) => lines(g, [['PLATFORM 2 · HARROW NORTH', '#fff', 20]], 12, 40, 20), '#1d2a44');
  const sgp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), lit(sign, 0.5)); sgp.position.set(-7.8, 2.4, -25.0); add(sgp);
  const sgPole = both(box(0.1, 2.2, 0.1, postMat, -7.8, 0, -25.1, { detail: false })); void sgPole;
  lamp(1.4, 0, -25.0, root); lamp(1.4, 0, -25.0, refl); W.lightSrc.push({ p: [1.4, 3.3, -25], c: 0xffe0b0, i: 6, d: 10 });
  // sliders: decks that drift sideways between two lanes (carry boxes, reflected)
  for (const s of BR.sliders) {
    const m = deck(-s.w / 2, s.w / 2, s.z0, s.z1); const b = solid(s.a - s.w / 2, -1, s.z0, s.a + s.w / 2, 0, s.z1, { carry: true });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.04, 0.06), glowMat(0xd8e4ff, 1.4)); glow.position.set(0, 0.02, s.z1); m.add(glow);
    W.sliders.push({ s, m, b, x: s.a });
  }
  W.sliderX = (s, t) => { const P = 9, u = ((t + s.phase) % P) / P; const k = u < 0.22 ? 0 : u < 0.5 ? (u - 0.22) / 0.28 : u < 0.72 ? 1 : 1 - (u - 0.72) / 0.28; const e = k * k * (3 - 2 * k); return s.a + (s.b - s.a) * e; };
  W.updaters.push((dt, t) => { for (const S of W.sliders) { const x = W.sliderX(S.s, t); S.x = x; S.m.position.x = x; S.b.min.x = x - S.s.w / 2; S.b.max.x = x + S.s.w / 2; } });
  // ---------- the far cliff and the Concourse of Doors ----------
  both(box(80, 7.9, 70, rock, 0, LAKE, -91.4, { detail: false }));
  const pl = add(new THREE.Mesh(new THREE.PlaneGeometry(80, 70), RZ.pbrMaterial('cutStone', { mapping: 'world', params: { color: 0xa8a296 } }))); pl.rotation.x = -PI / 2; pl.position.set(0, 0, -91.4); pl.receiveShadow = true;
  solid(-40, -8, -126.4, 40, 0, -56.4);
  solid(-40, 0, -127, 40, 8, -126.4); solid(-40.6, 0, -126.4, -40, 8, -56.4); solid(40, 0, -126.4, 40.6, 8, -56.4);
  for (const s of [-1, 1]) { both(box(36.4, 0.2, 0.4, stoneO, s * 21.8, 1.0, -56.6, { detail: false })); solid(s > 0 ? 3.6 : -40, 0, -56.8, s > 0 ? 40 : -3.6, 1.2, -56.4); for (let k = 4; k <= 39; k += 1.0) balPosts.push([s * k, -56.6]); }
  // landmarks: the station clock tower (north), Hensel's front (west), the observatory dome (east), Helix pylons
  try {
    const b = RZ.cityBlock([
      { width: 12, depth: 10, height: 30, position: [PLZ.tower[0], 0, PLZ.tower[1] - 2], yaw: 0, seed: 1951, wall: 'stone', era: '2049', faces: ['windows', 'windows', 'blank', 'windows'] },
      { width: 18, depth: 10, height: 16, position: [PLZ.hensel[0] - 2, 0, PLZ.hensel[1]], yaw: PI / 2, seed: 1952, wall: 'brick', era: '2049', groundBlank: [true, false, false, false], faces: ['windows', 'windows', 'blank', 'windows'] },
    ], { era: '2049', lit: 0.35, daylight: 0.6, detail: low ? 'low' : undefined });
    add(b.mesh);
  } catch (e) { console.warn('m19 plaza blocks', e); }
  solid(-6, 0, -133, 6, 30, -121); solid(-43, 0, -101, -33, 16, -83);
  const tc = add(streetClock([9.6])); tc.position.set(PLZ.tower[0], 14, PLZ.tower[1] + 3.6); tc.scale.setScalar(3.2);
  const dome = add(new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16, 0, PI * 2, 0, PI / 2), RZ.pbrMaterial('brushedMetal', { mapping: 'object', params: { color: 0x8a8070 } }))); dome.position.set(PLZ.dome[0] + 2, 6, PLZ.dome[1]);
  const drum = add(new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 6, 32), stoneO)); drum.position.set(PLZ.dome[0] + 2, 3, PLZ.dome[1]); solid(PLZ.dome[0] - 5, 0, PLZ.dome[1] - 7, PLZ.dome[0] + 9, 12, PLZ.dome[1] + 7);
  for (const z of [-62, -70]) { const p = both(box(1.2, 7, 1.2, RZ.pbrMaterial('paintedMetalPanel', { mapping: 'object', params: { color: 0xe4e6e8 } }), 30, 0, z, { detail: false })); void p; solid(29.4, 0, z - 0.6, 30.6, 7, z + 0.6); }
  const hb = add(symbolPlate('helix', 'true', 'dark', 2.2)); hb.position.set(30, 5.0, -66); hb.rotation.y = -PI / 2;
  const hsym = add(symbolPlate('clock', 'true', 'brass', 2.0)); hsym.position.set(PLZ.hensel[0] + 3.04, 4.6, PLZ.hensel[1]); hsym.rotation.y = PI / 2;
  const osym = add(symbolPlate('star', 'true', 'brass', 2.0)); osym.position.set(PLZ.dome[0] - 5.06, 4.2, PLZ.dome[1]); osym.rotation.y = -PI / 2;
  // the three inlays along the path nobody walked (visible to anyone who reads symbols)
  for (const [x, z, kind] of PLZ.inlays) { const p = add(symbolPlate(kind, 'true', 'inlay', 1.6)); p.rotation.x = -PI / 2; p.position.set(x, 0.015, z); }
  // footprints of every Kai who came before: Residue only, everywhere except the path they refused
  {
    const N = low ? 1100 : 2000, ft = canvasTex(64, 128, (c) => { c.clearRect(0, 0, 64, 128); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(32, 40, 18, 30, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(32, 98, 14, 20, 0, 0, 7); c.fill(); }, 'm19foot');
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.46), new THREE.MeshBasicMaterial({ map: ft, color: 0xffc890, transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false, blending: THREE.AdditiveBlending }), N);
    const r = RZ.rng(1961), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S1 = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
    let n = 0;
    const put = (x, z, yaw, side) => { if (n >= N) return; if (W.stripDist(x, z) < 1.7) return; E.set(-PI / 2, 0, -yaw); Q.setFromEuler(E); P.set(x + Math.cos(yaw) * side * 0.13, 0.02, z - Math.sin(yaw) * side * 0.13); M.compose(P, Q, S1); im.setMatrixAt(n++, M); };
    // trails toward each door spot and wandering trails that give up
    for (let t = 0; t < 46; t++) {
      const sp = PLZ.spots[t % PLZ.spots.length];
      let x = -3 + r() * 6, z = -57.5, tx = sp[0] + (r() - 0.5) * 3, tz = sp[1] + (r() - 0.5) * 3, side = 1;
      if (t % 4 === 3) { tx = -30 + r() * 60; tz = -120 + r() * 50; }
      for (let s = 0; s < 120 && n < N; s++) { const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz); if (d < 0.6) break; const yaw = Math.atan2(dx, -dz) + (r() - 0.5) * 0.5; x += Math.sin(yaw) * 0.72; z -= Math.cos(yaw) * 0.72; put(x, z, yaw, side); side = -side; }
    }
    while (n < N) { const x = -36 + r() * 72, z = -124 + r() * 66; put(x, z, r() * PI * 2, r() < 0.5 ? 1 : -1); if (r() < 0.02) break; }
    im.count = n; im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.userData.noBatch = true; add(im); game.residue(im); W.prints = im;
  }
  // the door: one door, several places
  {
    const d = new THREE.Group(); add(d); W.door = d;
    const fm = new THREE.MeshStandardMaterial({ color: 0xe4e2dc, roughness: 0.4 });
    d.add(box(0.14, 2.6, 0.24, fm, -0.78, 0, 0, { detail: false })); d.add(box(0.14, 2.6, 0.24, fm, 0.78, 0, 0, { detail: false })); d.add(box(1.7, 0.16, 0.24, fm, 0, 2.6, 0, { detail: false }));
    const leaf = box(1.42, 2.56, 0.06, new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35 }), 0, 0.02, 0, { detail: false }); d.add(leaf); W.doorLeaf = leaf;
    const port = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), glowMat(0xfff4e0, 1.6)); port.position.set(0, 1.75, 0.04); d.add(port);
    const lbl = textTex('doorlbl', 256, 96, (g) => { lines(g, [['TEST HALL 0', '#1d2a44', 26], ['OPEN DAY · 19.10.2026', '#1d2a44', 16]], 14, 40, 26); }, '#f2f2ee');
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), lit(lbl, 0.3)); lp.position.set(0, 1.3, 0.04); d.add(lp);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshBasicMaterial({ color: 0xfff0d8, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.set(0, 1.4, -0.08); d.add(halo); W.doorHalo = halo;
    d.traverse(o => { o.userData.noBatch = true; });
  }
  // fragments, sky city, motes
  add(skyCity(low, 1971, 250));
  const fr = add(fragments([[-40, 24, -10, 9], [44, 30, -30, 8], [-20, 40, -80, 12], [30, 18, 10, 6], [-50, 20, -120, 10], [50, 36, -110, 9]], 1972));
  const motes = new Motes(low ? 200 : 420, [-30, 0.4, -120, 30, 10, 30], 0xfff0d8, 0.05, 0.08); add(motes.mesh);
  W.updaters.push((dt, t) => { fr.userData.update(t); motes.update(dt); });
  W.lightSrc.push({ p: [0, 3, -60], c: 0xffe8c8, i: 6, d: 12 }, { p: [-14, 2.5, -74], c: 0xffe0b0, i: 5, d: 9 }, { p: [10, 2.5, -110], c: 0xe0e8ff, i: 5, d: 9 }, { p: [2, 3, -116], c: 0xfff0d8, i: 8, d: 10 });
  postRun(balPosts, 0.16, stoneO, root, true); postRun(balPosts, 0.16, stoneO, refl, false); postRun(railPosts, 0.08, railM, refl, false);
  // the reflection lies under the lake: it never casts a shadow
  refl.traverse(o => { o.castShadow = false; });
  W.update = (dt, t) => { for (const u of W.updaters) u(dt, t); };
  return W;
}
/** Distance from (x, z) to the untrodden strip, and the arc length of the nearest point. */
export function stripInfo(x, z) {
  let best = 1e9, s = 0, acc = 0;
  const P = PLZ.strip;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (L * L)));
    const d = Math.hypot(ax + dx * u - x, az + dz * u - z);
    if (d < best) { best = d; s = acc + u * L; }
    acc += L;
  }
  return { d: best, s, len: acc };
}

export function buildHall(game, scene, low) {
  const col = game.collision, root = new THREE.Group(); scene.add(root); root.visible = false;
  const { x: X, z: Z } = HALL, W = { root, lightSrc: [] };
  const add = (o) => { root.add(o); return o; };
  const fl = add(plane(26, 26, RZ.pbrMaterial('ceramicTile', { mapping: 'world', params: { color: 0xd8dadc } }))); fl.rotation.x = -PI / 2; fl.position.set(X, 0, Z); fl.receiveShadow = true;
  col.add([X - 13, -1, Z - 13], [X + 13, 0, Z + 13]);
  const wall = RZ.pbrMaterial('paintedMetalPanel', { mapping: 'world', params: { color: 0xe8eaec } });
  for (const [x, z, w, d] of [[0, -13, 26, 0.4], [0, 13, 26, 0.4], [-13, 0, 0.4, 26], [13, 0, 0.4, 26]]) { add(box(w, 9, d, wall, X + x, 0, Z + z, { detail: false })).castShadow = false; col.add([X + x - w / 2, 0, Z + z - d / 2], [X + x + w / 2, 9, Z + z + d / 2]); }
  const ce = add(plane(26, 26, wall)); ce.rotation.x = PI / 2; ce.position.set(X, 9, Z);
  const ring = add(chronolith(1.2, { color: 0x9a7bff, power: 0.35 })); ring.position.set(...HALL.ring); W.ring = ring;
  col.add([X - 3.4, 0, Z - 11.8], [X + 3.4, 6.4, Z - 10.2]);
  const plinth = add(box(8, 0.6, 3, RZ.pbrMaterial('concrete', { mapping: 'object' }), X, 0, Z - 11, { detail: false })); void plinth;
  // the rope barrier, unhooked at the post nearest the ring
  const post = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.3 }), rope = new THREE.MeshStandardMaterial({ color: 0x8a1a24, roughness: 0.8 });
  for (let k = -4; k <= 4; k++) { const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.0, 10), post)); p.position.set(X + k * 1.4, 0.5, Z - 6.4); }
  for (let k = -4; k < 4; k++) { if (k === -1) continue; const c = new THREE.CatmullRomCurve3([new THREE.Vector3(X + k * 1.4, 0.92, Z - 6.4), new THREE.Vector3(X + k * 1.4 + 0.7, 0.72, Z - 6.4), new THREE.Vector3(X + k * 1.4 + 1.4, 0.92, Z - 6.4)]); add(new THREE.Mesh(new THREE.TubeGeometry(c, 8, 0.025, 6), rope)); }
  const hang = new THREE.CatmullRomCurve3([new THREE.Vector3(X - 1.4, 0.92, Z - 6.4), new THREE.Vector3(X - 1.3, 0.4, Z - 6.2), new THREE.Vector3(X - 1.1, 0.06, Z - 5.9)]); add(new THREE.Mesh(new THREE.TubeGeometry(hang, 8, 0.025, 6), rope));
  const ban = textTex('openday', 512, 128, (g, w) => { g.textAlign = 'center'; drawHelix(g, 60, 64, 40, 'true', '#1d2a44'); lines(g, [['HELIX TEMPORAL RESEARCH · OPEN DAY', '#1d2a44', 28], ['MONDAY 19 OCTOBER 2026 · FAMILIES WELCOME', '#3a4a5a', 18]], w / 2 + 30, 56, 30); }, '#f4f4f0');
  const bp = add(plane(9, 2.2, lit(ban, 0.3))); bp.position.set(X, 7.2, Z - 12.75);
  const clk = add(streetClock([9.6])); clk.position.set(X + 9, 2.6, Z - 12.4); clk.scale.setScalar(1.2);
  const motes = new Motes(low ? 160 : 320, [X - 10, 0.4, Z - 12, X + 10, 8, Z + 10], 0xfff0d8, 0.04, 0.0); motes.frozen = true; add(motes.mesh);
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(4, 12), new THREE.MeshBasicMaterial({ color: 0xfff0d8, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); shaft.position.set(X + 3, 4.5, Z - 3); shaft.rotation.set(0, 0.4, 0.35); add(shaft);
  W.lightSrc.push({ p: [X, 6, Z - 8], c: 0xc8b0ff, i: 18, d: 18 }, { p: [X + 4, 6, Z + 4], c: 0xfff0d8, i: 12, d: 18 });
  W.update = (dt, t) => { ring.userData.update(t * 0.15); };
  return W;
}
