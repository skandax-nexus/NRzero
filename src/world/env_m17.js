// Mission 17 environment: the Witness's Archive at Site Zero, the sealed deep level under Helix where the ring was
// found and where the first run of 19.10.2026 took place. North = -z, floor y = 0.
//   2196 THE ARCHIVE: the Witness has filled the ruin with his recordings (brass reels on endless shelving). 2049 SITE
//   ZERO, SEALED: Rook's evidence store from the 2031 seal (cages, archive boxes, strip lights). 2026 THE ECHO: only
//   while a recorded echo plays, the rooms as they were before the open day (white Helix lab).
//   Lift landing (x -3..3, z 20..28) · the Reading Room (x -14..14, z -6..20: four reading booths on the west wall in
//   2196, three evidence cages on the east wall in 2049, the index drum) · the Witness's quarters (x 14..22, z 11..20)
//   · the Stacks (x -12..12, z -30..-6: a 4 x 4 grid of 6 m cells whose shelving walls change every 16 s, layouts A B C)
//   · the Sorting Room (x -6..12, z -42..-30: the Concordance) · the Mirror Hall (x -12..12, z -70..-42: the mimics)
//   · the Seal antechamber (x -6..6, z -82..-70: echo lens I) · 2026 only: the Control Room (x -8..8, z -94..-82), the
//   observation corridor (x -1.5..1.5, z -106..-94) · the Cable Vault (x -16..-8, z -92..-84, a pocket that survives in
//   2196: echo lens II) · Test Hall Zero (x -12..12, z -132..-106; in 2196 the Witness's Room 0001).
// Static geometry is merged per material and per state (env_m6 Batch).
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, chronolith } from './kit.js';
import { Batch } from './env_m6.js';
import { registerCast, CAST } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Cormorant Garamond", Georgia, serif';
const HAND = '"Caveat", "Segoe Print", "Bradley Hand", cursive';
const PI = Math.PI;

export const P = {
  start: [0, 0, 24.2, PI], hub: [0, 0, 16, PI], liftDoor: [0, 0, 20],
  booths: [[-12.2, 15], [-12.2, 9], [-12.2, 3], [-12.2, -3]],          // reading booths (2196), stage at x -8.4
  stage: [[-8.4, 15], [-8.4, 9], [-8.4, 3], [-8.4, -3]],
  cages: [[11.6, 10], [11.6, 4], [11.6, -2]],                           // evidence cages (2049): A run logs, B letters, C certificate
  drum: [0, 0, 6], wdesk: [7.4, 0, 16.2], stacksDoor: [-3, 0, -6],
  quarters: [18, 0, 15.5], qBooth: [20.6, 0, 12.6], qCoat: [21.4, 0, 18.6], qCot: [15.6, 0, 18.4],
  cell: (c, r) => [-9 + c * 6, 0, -9 - r * 6],
  lectern: [-3, 0, -15.4], sortDoor: [3, 0, -30], conc: [3, 0, -36.4], mirrorDoor: [3, 0, -42],
  mirrorGate: [0, 0, -70], lens1: [-3.8, 0, -76], seal: [0, 0, -82], runSheet: [-5.2, 0, -88.4], breaker: [-15.2, 0, -86.2],
  lens2: [-12.4, 0, -89.6], vaultDoor: [-8, 0, -88], keypad: [1.9, 0, -93.6], hallDoor: [0, 0, -106],
  ring: [0, 2.9, -123], cradle: [0, 0, -123], rope: -117, console: [-7.4, 0, -112.4], master: [0, 0, -120.2], wDesk0: [-8.6, 0, -127],
  collars: [[-2, 0.78, -121.74], [0, 0.78, -121.74], [2, 0.78, -121.74]],
};

// The four recordings of Kai's lives (main path) and the physical evidence that answers each.
export const RECS = [
  { num: '0001', title: 'The First Morning', who: 'Kai, 7 · Site Zero, 19.10.2026', obj: 'run01',
    plaque: ['REC 0001 · THE FIRST MORNING', 'The ring\'s own pickup. Site Zero, 19.10.2026, 08:13:50.', 'Played: 1,046 times.'] },
  { num: '0233', title: 'The Boy Who Went to Halden', who: 'Kai, 19 · Halden General, 2038', obj: 'pass38',
    plaque: ['REC 0233 · THE BOY WHO WENT TO HALDEN', 'Halden General, Ward 4. November 2038.', 'Kept for the stamp.'] },
  { num: '0640', title: 'The Engineer Who Said No', who: 'Kai, 32 · Rain City, 2049', obj: 'green',
    plaque: ['REC 0640 · THE ENGINEER WHO SAID NO', 'A flat in Rain City, March 2049.', 'He refused. It came anyway.'] },
  { num: '1046', title: 'The Last Try', who: 'Kai, 58 · this archive', obj: 'notched',
    plaque: ['REC 1046 · THE LAST TRY', 'Recorded here. Room 0001.', 'Do not play this one twice.'] },
];
// Physical evidence: [key, title, text, era, where]. rec = the recording it answers (null: a decoy).
export const OBJECTS = {
  run01: { title: 'Field run log · RUN 01', short: 'RUN 01 log (abort 08:14:11)', era: '2049', rec: 0,
    text: 'Helix field log, Site Zero. RUN 01 · 19.10.2026 · start 08:14:02 · field 4.1 kHz · collar phases II · IV · I · ABORT 08:14:11 (manual, E. Rook). Note: "Visitor inside rope."' },
  run00: { title: 'Field run log · RUN 00', short: 'RUN 00 log (dry run, no abort)', era: '2049', rec: null,
    text: 'Helix field log, Site Zero. RUN 00 (dry run) · 18.10.2026 · start 07:52:00 · field 4.1 kHz · completed, no abort. Signed E. Rook.' },
  green: { title: 'A letter in green ink', short: 'Unsent letter in green ink', era: '2049', rec: 2,
    text: '"Dear Dr. Rook, I resign, effective today. I will not build the machine. K. Varen." Green ink, March 2049. Never sent. Found in K. Varen\'s locker at Helix, filed here by Security in 2049.' },
  black: { title: 'A letter in black ink', short: 'Rook\'s letter in black ink', era: '2049', rec: null,
    text: '"To the Board. The incident at Site Zero is closed. There is no further record to keep. E. Rook, 2031." Black ink. The letter that sealed this level.' },
  pass38: { title: 'Halden visitor pass, 2038', short: 'Visitor pass, 2038, red stamp', era: '2196', rec: 1,
    text: 'HALDEN GENERAL · VISITOR · K. VAREN · WARD 4 · 03.11.2038. Stamped across the photo in red: NO ADMISSION. The boy in the photo is nineteen.' },
  pass26: { title: 'Halden visitor pass, 2026', short: 'Visitor pass, 2026, Elena\'s', era: '2196', rec: null,
    text: 'HALDEN GENERAL · VISITOR · E. VAREN · WARD 4 · 19.10.2026. Stamped ADMITTED, 09:40. Elena Varen\'s pass, the day of the open day.' },
  notched: { title: 'A cracked band, notched', short: 'Cracked band, 1,046 notches', era: '2196', rec: 3,
    text: 'A Chronolith band, cracked across the face. Someone has scratched notches into the strap with a blade, in rows of ten: one thousand and forty-six.' },
  newband: { title: 'A new band, Helix issue', short: 'New Helix band, unmarked', era: '2196', rec: null,
    text: 'A Chronolith band still in its Helix sleeve. Issued, never worn. No notches, no scratches.' },
};
export const CERT = { title: 'A death certificate, never issued', text: 'Rain City Registry form D-1. Name: VAREN, Mira. Age 10. Place: Helix Site Zero. Time: 08:14:09. Cause: (blank). Box 9, "Release to family": crossed out. Note: "Do not file. By order, E. Rook, 19.10.2026."' };
export const SEAL = { title: 'Seal order, 2031', text: 'HELIX · ORDER 31/07. Site Zero is sealed. Artefact A (the ring) is moved to the main laboratory. Artefact B is not to be catalogued. Records of RUN 01 are to be stored, not destroyed. E. Rook.' };

// The Stacks: 4 x 4 cells of 6 m. Edges: 'h:c:r' between (c,r) and (c,r+1); 'v:c:r' between (c,r) and (c+1,r).
// Each layout lists its OPEN edges; every other inner edge is a wall of shelving. Entrance (1,0), exit (2,3).
export const LAYOUTS = {
  A: ['h:1:0', 'v:0:1', 'h:0:1', 'h:0:2', 'v:2:0', 'h:2:2', 'h:3:2'],
  B: ['v:1:0', 'v:2:0', 'h:3:0', 'h:1:1', 'v:0:3', 'h:2:1', 'v:2:3'],
  C: ['h:1:0', 'v:0:0', 'v:1:1', 'v:2:1', 'v:1:2', 'v:0:2', 'v:1:3'],
};
export const LAYOUT_ORDER = ['A', 'B', 'C'];
export const EDGES = (() => { const out = []; for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) out.push('h:' + c + ':' + r); for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) out.push('v:' + c + ':' + r); return out; })();
export function edgeGeom(e) {   // centre x, z and orientation of an inner edge
  const [k, a, b] = e.split(':'); const c = +a, r = +b;
  if (k === 'h') return { x: -9 + c * 6, z: -12 - r * 6, along: 'x' };
  return { x: -6 + c * 6, z: -9 - r * 6, along: 'z' };
}
export function cellOf(x, z) { const c = Math.floor((x + 12) / 6), r = Math.floor((-6 - z) / 6); return (c >= 0 && c < 4 && r >= 0 && r < 4) ? [c, r] : null; }

export const SHARDS = [
  { p: [8.6, 0.9, -4.6], where: 'the Reading Room', era: '2196' },
  { p: [19.6, 0.9, 11.8], where: 'the quarters', era: null },
  { p: [-9, 0.9, -11], where: 'the Stacks, the sealed corner', era: '2196' },
  { p: [9, 0.9, -23], where: 'the Stacks, the far east cell', era: '2196' },
  { p: [-10.6, 0.9, -66.4], where: 'the Mirror Hall', era: '2196' },
  { p: [-14.8, 0.9, -91.2], where: 'the Cable Vault', era: null },
];
// The Witness's journal: pages of the price
export const JOURNAL = [
  { p: [7.2, 1.02, 15.6], where: 'his desk', era: '2196', text: '"Iteration 0002. I tried to stop the open day. Helix ran it a week later, without visitors. She came anyway, to see. World 0002 ended at 08:14 on the 26th."' },
  { p: [-3, 1.15, -15.4], where: 'the Stacks lectern', era: '2196', text: '"The stacks turn every sixteen seconds. I built them so the Continuum would get lost. I get lost too. Good."' },
  { p: [9.6, 1.0, -33.2], where: 'the Sorting Room', era: '2196', text: '"Every world I make costs the one I leave. I keep a list. It is longer than the list of people I have met."' },
  { p: [-8.4, 1.02, -126.4], where: 'Room 0001', era: '2196', text: '"She is not gone. She is unfinished. Sixty-one percent. I can hear the rest of her in every world that never happened."' },
];

// ---------------------------------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites). Every look carries era, sex/age and a COSTUMES.md archetype.
// ---------------------------------------------------------------------------------------------------------------------
const KID_KAI = { era: '2026', costume: 'kid_kai', sex: 0, height: 1.22, build: 0.82, age: 7, skin: 0xb98463, hair: 0x15100c, hairStyle: 'messy', eyes: 0x3d2a18, topType: 'jacket', hood: true, top: 0x2a4a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2f3a4e, shoes: 'shoes', boots: 0x3a2a1a };
const KID_MIRA = { era: '2026', costume: 'kid_mira', sex: 1, female: true, height: 1.36, build: 0.84, age: 10, skin: 0xd9a585, hair: 0x120d0b, hairStyle: 'bob', eyes: 0x2f4a3a, topType: 'sweater', top: 0x6a2a3a, topKind: 'fabric', pantsType: 'trousers', pants: 0x1f2227, shoes: 'shoes', boots: 0x3a2a1a };
const MOTHER = { era: '2026', costume: 'c26_f2', sex: 1, female: true, age: 38, height: 1.68, build: 0.98, skin: 0xc8916c, hair: 0x1e1612, hairStyle: 'bob', eyes: 0x3d2a18,
  face: { jaw: -0.2, cheek: 0.35, nose: 0.05, noseWidth: 0.0, lips: 0.2, brow: 0.0, eyeSize: 0.15, faceLength: 0.1, chin: -0.1 },
  topType: 'jacket', top: 0x4a5a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes', boots: 0x2a1d14 };
export function registerM17Cast() {
  registerCast('m17kai7', { name: 'KAI, 7', role: 'Recording · 19.10.2026', look: { ...KID_KAI }, rimColor: 0xffd8a0, vp: { sex: 'm', pitch: 1.5, rate: 1.1, langs: ['en-GB', 'en-US'] } });
  registerCast('m17mira10', { name: 'MIRA, 10', role: 'Recording · 19.10.2026', look: { ...KID_MIRA }, rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 1.42, rate: 1.04, langs: ['en-GB', 'en-US'] } });
  registerCast('m17mother', { name: 'ELENA VAREN', role: 'Recording · 19.10.2026', look: { ...MOTHER }, vp: { sex: 'f', pitch: 1.0, rate: 0.9, langs: ['en-GB', 'en-US'] } });
  registerCast('m17rook26', { name: 'DR. ELIAS ROOK', role: 'Recording · Site Zero, 2026',
    look: { ...(CAST.rook?.look || {}), role: 'rook', era: '2026', costume: 'rook', sex: 0, age: 39, hair: 0x3a2a20, hairStyle: 'swept', wrinkles: 0.25, recede: 0.3, glasses: true,
      topType: 'jacket', top: 0x2f3542, coat: 0xe8eaec, coatKind: 'fabric', pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes' },
    vp: { sex: 'm', pitch: 0.96, rate: 1.02, langs: ['en-GB', 'en-US'] } });
  registerCast('m17kai19', { name: 'KAI, 19', role: 'Recording 0233 · Halden, 2038',
    look: { era: '2049', costume: 'c49_m4', sex: 0, age: 19, height: 1.8, build: 0.88, skin: 0xb98463, hair: 0x15100c, hairStyle: 'messy', eyes: 0x3d2a18,
      face: { jaw: 0.3, cheek: 0.3, nose: 0.15, noseWidth: -0.05, lips: -0.05, brow: 0.25, eyeSize: 0.1, faceLength: 0.05, chin: 0.2 },
      topType: 'jacket', hood: true, top: 0x2a3440, topKind: 'fabric', pantsType: 'cargo', pants: 0x23262b, shoes: 'boots', boots: 0x1b1611 },
    rimColor: 0xffd8a0, vp: { sex: 'm', pitch: 1.12, rate: 1.08, langs: ['en-GB', 'en-US'] } });
  registerCast('m17nurse', { name: 'WARD NURSE', role: 'Recording 0233 · Halden, 2038',
    look: { era: '2049', costume: 'c49_f2', sex: 1, female: true, age: 46, height: 1.65, build: 1.02, skin: 0x8c5a3a, hair: 0x15100b, hairStyle: 'bun', eyes: 0x3d2a18,
      topType: 'uniform', top: 0x3a6a7a, topKind: 'fabric', pantsType: 'trousers', pants: 0x3a6a7a, shoes: 'shoes', boots: 0xe8e8e8 },
    vp: { sex: 'f', pitch: 0.98, rate: 0.98, langs: ['en-GB', 'en-US'] } });
  registerCast('m17kai32', { name: 'KAI VAREN', role: 'Recording 0640 · World 0640, 2049',
    look: { ...(CAST.kai?.look || {}), role: 'kai', era: '2049', costume: 'kai', sex: 0, age: 32 }, rimColor: 0xffd8a0, vp: { sex: 'm', pitch: 1.0, rate: 1.0, langs: ['en-GB', 'en-US'] } });
  registerCast('m17witrec', { name: 'THE WITNESS', role: 'Recording 1046 · Room 0001',
    look: { ...(CAST.witness?.look || {}), role: 'witness', era: '2196', costume: 'witness', sex: 0, age: 58 }, rimColor: 0xff6a4a, glow: 0x3a1610, vp: { sex: 'm', pitch: 0.82, rate: 0.88, langs: ['en-GB', 'en-US'] } });
  registerCast('m17band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m17warden', { name: 'ARCHIVE WARDEN', role: 'The archive\'s security · built from K. Varen', voice: true, vp: { sex: 'm', pitch: 0.7, rate: 0.92, langs: ['en-GB', 'en-US'] } });
  registerCast('m17mimic', { name: 'MIMIC', role: 'A construct that fights like Kai', voice: true, vp: { sex: 'm', pitch: 0.9, rate: 1.0, langs: ['en-GB', 'en-US'] } });
  registerCast('m17label', { name: 'THE WITNESS', role: 'Spoken label · the archive', portraitOf: 'witness', voice: true, vp: { sex: 'm', pitch: 0.8, rate: 0.88, langs: ['en-GB', 'en-US'] } });
  registerCast('m17sera', { name: 'SERA VOSS', role: 'Radio · the Helix ruin, 2196', portraitOf: 'sera', voice: true, vp: { sex: 'f', pitch: 0.94, rate: 1.0, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music: the archive (reels and low strings), the sealed vault (2049 fluorescent), the stacks (a clock that turns), the
// recordings (a warm piano that remembers), the mimics (Kai's own rhythm turned against him), the echo (a ticking
// past), Test Hall Zero, the run (08:14 holds its breath), the Witness (Mira's three notes in the cello).
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { tension: 0 };
export function registerM17Themes() {
  registerTheme('m17-archive', { bpm: 58, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[40, 47, 52, 55], [36, 43, 48, 55], [38, 45, 50, 53], [35, 42, 47, 54]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.015, 420); a.cello(ch[0] - 12, t, d * 16, 0.03); }
    if (b % 4 === 2) a.tick(t, 0.004, 5200);
    if (b === 6 && bar % 2 === 0) a.piano(ch[2] + 24, t, 0.04, 3.6);
    if (b === 12 && bar % 4 === 1) a.glass(ch[3] + 24, t, 0.007);
  } });
  registerTheme('m17-vault', { bpm: 54, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0 && bar % 2 === 0) a.pad([45, 52, 57, 59], t, d * 32, 0.01, 1400);
    if (b === 0) a.glass([84, 83, 81, 79][bar % 4], t, 0.008);
    if (b % 8 === 4) a.tick(t, 0.005, 7600);
  } });
  registerTheme('m17-stacks', { bpm: 90, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([38, 45, 50, 57], t, d * 16, 0.013, 340); a.cello(26, t, d * 16, 0.035); }
    if (b % 2 === 0) a.tick(t, b % 4 ? 0.006 : 0.011, 3400);
    if (b === 8) a.drum(t, 0.04, 80, 36);
    if (b === 14 && bar % 2) a.pluck([62, 65, 69, 67][bar % 4], t, 0.028);
  } });
  registerTheme('m17-record', { bpm: 70, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.012, 820);
    if (b % 4 === 0) a.piano(ch[(b >> 2) % 4] + 12, t, 0.035, 2.2);
    if (b === 10 && bar % 2) a.flute(ch[3] + 12, t, d * 5, 0.01);
    if (b === 15) a.tick(t, 0.003, 2200);
  } });
  registerTheme('m17-mimic', { bpm: 112, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, root = [38, 38, 41, 36][bar % 4];
    if (b === 0) { a.pad([root, root + 7, root + 12], t, d * 16, 0.012, 600); a.cello(root - 12, t, d * 8, 0.04); }
    if (b === 0 || b === 6 || b === 10) a.drum(t, 0.06 + musicState.tension * 0.03, 110, 40);
    if (b % 2 === 1) a.tick(t, 0.006 + musicState.tension * 0.004, 5200);
    if (b === 12) a.pluck(root + 24 + (bar % 2 ? 3 : 0), t, 0.03);
  } });
  registerTheme('m17-echo', { bpm: 80, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[52, 59, 64], [50, 57, 62], [48, 55, 60], [47, 54, 59]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.012, 1100);
    if (b % 4 === 0) a.tick(t, 0.012, 2600);
    if (b === 2 || b === 9) a.piano(ch[1] + 12, t, 0.03, 1.8);
  } });
  registerTheme('m17-zero', { bpm: 60, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 60], [41, 48, 53, 57], [38, 45, 50, 53], [40, 47, 52, 56]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.015, 460); a.cello(ch[0] - 12, t, d * 16, 0.045); }
    if (b === 0 || b === 6 || b === 10) a.piano(ch[(b / 2 | 0) % 4] + 12, t, 0.06, 3);
    if (b === 14 && bar % 2) a.glass(ch[2] + 24, t, 0.008);
  } });
  registerTheme('m17-814', { bpm: 50, step(a, s, t, d) {
    const b = s % 16;
    if (b === 0) { a.pad([40, 47, 52, 59], t, d * 16, 0.018, 360); a.cello(28, t, d * 16, 0.05); }
    if (b === 8) a.glass(76, t, 0.012);
    if (b % 4 === 0) a.tick(t, 0.004, 1800);
  } });
  registerTheme('m17-witness', { bpm: 56, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 64], [41, 48, 57, 60], [43, 50, 55, 59], [40, 47, 52, 59]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016, 520); a.cello(ch[0] - 12, t, d * 16, 0.045); }
    if (bar % 2 === 0) { if (b === 0) a.cello(64, t, d * 4, 0.04); if (b === 4) a.cello(59, t, d * 4, 0.036); if (b === 8) a.cello(57, t, d * 7, 0.04); }
    if (b === 12 && bar % 2) a.piano(76, t, 0.04, 4);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Code-drawn textures: reels on shelving, plaques, signs, documents, the layout map
// ---------------------------------------------------------------------------------------------------------------------
const grain = (g, w, h, n, a, seed = 3) => { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } };
const wrap = (g, text, x, y, maxW, lh) => { const words = String(text).split(' '); let line = '', yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; } if (line) g.fillText(line, x, yy); return yy; };

function reelShelf(seed, glow) {   // a bay of shelving: four shelves of brass reels in tins with paper tags
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = glow ? '#000' : '#1a120c'; g.fillRect(0, 0, w, h);
    if (!glow) { grain(g, w, h, 1400, 0.08, seed); g.fillStyle = '#3a2618'; for (let k = 0; k < 5; k++) g.fillRect(0, k * 124 + 6, w, 14); g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h); }
    for (let row = 0; row < 4; row++) {
      let x = 22; const y = row * 124 + 76;
      while (x < w - 40) {
        const rad = 18 + r() * 14; if (r() < 0.07) { x += 30; continue; }
        if (glow) {
          if (r() < 0.5) { g.fillStyle = `rgba(255,${140 + r() * 60},${60 + r() * 40},${0.25 + r() * 0.5})`; g.beginPath(); g.arc(x + rad, y, rad * 0.22, 0, 7); g.fill(); }
        } else {
          g.fillStyle = ['#6a5030', '#8a6a3a', '#4a3a28', '#2a2a2a', '#7a5a2a'][(r() * 5) | 0]; g.beginPath(); g.arc(x + rad, y, rad, 0, 7); g.fill();
          g.strokeStyle = 'rgba(230,190,120,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(x + rad, y, rad - 3, 0, 7); g.stroke();
          g.fillStyle = '#1a140e'; g.beginPath(); g.arc(x + rad, y, rad * 0.3, 0, 7); g.fill();
          if (r() < 0.6) { g.fillStyle = '#d8ccb0'; g.fillRect(x + rad - 8, y + rad - 4, 16, 10); }
        }
        x += rad * 2 + 4;
      }
    }
  }, 'm17reels' + seed + (glow ? 'g' : ''));
}
function boxShelf(seed) {        // 2049: grey archive boxes on steel shelving
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(seed); g.fillStyle = '#2a2e32'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) {
      let x = 10; const y0 = row * 124 + 20;
      g.fillStyle = '#8a9096'; g.fillRect(0, y0 + 96, w, 8);
      while (x < w - 30) { const bw = 52 + r() * 30; g.fillStyle = ['#9a9a90', '#8a8a80', '#a8a49a', '#6a7078'][(r() * 4) | 0]; g.fillRect(x, y0 + 18, bw - 6, 78); g.fillStyle = '#f2f2ee'; g.fillRect(x + 8, y0 + 34, bw - 22, 18); g.fillStyle = '#1b1e23'; g.font = `700 10px ${FONT}`; g.fillText('SZ-' + (100 + ((r() * 900) | 0)), x + 10, y0 + 47); x += bw; }
    }
    grain(g, w, h, 900, 0.06, seed + 1);
  }, 'm17boxes' + seed);
}
export const TEX = {
  plaque: (lines, o = {}) => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = o.bg || '#2a1e14'; g.fillRect(0, 0, w, h); grain(g, w, h, 600, 0.1, lines[0].length);
    g.strokeStyle = 'rgba(220,180,110,.6)'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = o.fg || '#e8d4a8'; g.font = `700 26px ${FONT}`; wrap(g, lines[0], 28, 54, w - 56, 30);
    g.font = `500 30px ${HAND}`; let y = 114; for (const l of lines.slice(1)) y = wrap(g, l, 28, y, w - 56, 32) + 40;
  }, 'm17plq' + lines.join('|')),
  sign: (t, sub, o = {}) => canvasTex(1024, 192, (g, w, h) => {
    g.fillStyle = o.bg || '#20180f'; g.fillRect(0, 0, w, h); grain(g, w, h, 1500, 0.1, t.length + 5);
    g.strokeStyle = o.rule || 'rgba(230,200,150,.4)'; g.lineWidth = 5; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = o.fg || '#ecd8b0'; g.textAlign = 'center'; g.font = `600 ${o.size || 64}px ${o.font || SERIF}`; g.fillText(t, w / 2, sub ? 92 : 116);
    if (sub) { g.font = `500 30px ${o.subFont || FONT}`; g.globalAlpha = 0.8; g.fillText(sub, w / 2, 150); }
  }, 'm17sign' + t + sub + (o.key || '')),
  stencil: (t, sub) => canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#c8ccd0'; g.fillRect(0, 0, w, h); grain(g, w, h, 500, 0.05, 9);
    g.fillStyle = '#e8c020'; g.fillRect(0, 0, w, 24); g.fillStyle = '#1a1c20'; for (let x = 0; x < w; x += 40) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x + 20, 0); g.lineTo(x + 34, 0); g.lineTo(x + 14, 24); g.fill(); }
    g.fillStyle = '#1b1e23'; g.font = `700 42px ${FONT}`; g.fillText(t, 22, 82); if (sub) { g.font = `600 20px ${FONT}`; g.fillStyle = '#3a4048'; wrap(g, sub, 22, 120, w - 40, 22); }
  }, 'm17sten' + t + sub),
  lab: (t, sub) => canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d4a7a'; g.fillRect(0, 0, 26, h);
    const fit = (txt, px, weight) => { let f = px; g.font = `${weight} ${f}px ${FONT}`; while (g.measureText(txt).width > w - 110 && f > 12) { f -= 2; g.font = `${weight} ${f}px ${FONT}`; } };
    g.fillStyle = '#1b2430'; fit(t, 76, 700); g.fillText(t, 70, 120); fit(sub, 36, 500); g.fillStyle = '#4a5a6a'; g.fillText(sub, 72, 190);
  }, 'm17lab' + t + sub),
  doc: (title, body, o = {}) => canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = o.paper || '#ece4d2'; g.fillRect(0, 0, w, h); grain(g, w, h, 1200, 0.06, title.length + 3);
    if (o.head) { g.fillStyle = o.headCol || '#1d2a44'; g.fillRect(0, 0, w, 56); g.fillStyle = '#fff'; g.font = `700 20px ${FONT}`; g.fillText(o.head, 20, 36); }
    g.fillStyle = o.ink || '#1a1612'; g.font = `700 28px ${o.hand ? HAND : FONT}`; wrap(g, title, 28, o.head ? 110 : 64, w - 56, 32);
    g.font = o.hand ? `500 30px ${HAND}` : `500 21px ${FONT}`; g.fillStyle = o.ink || '#2a241c'; wrap(g, body, 28, o.head ? 170 : 124, w - 56, o.hand ? 34 : 28);
    if (o.stamp) { g.save(); g.translate(w * 0.62, h * 0.8); g.rotate(-0.22); g.strokeStyle = '#c8202a'; g.fillStyle = '#c8202a'; g.lineWidth = 5; g.strokeRect(-130, -36, 260, 72); g.font = `700 34px ${FONT}`; g.textAlign = 'center'; g.fillText(o.stamp, 0, 12); g.restore(); }
  }, 'm17doc' + title + (o.key || '')),
  map: () => canvasTex(512, 512, (g, w, h) => {      // the Witness's map of the Stacks: three layouts
    g.fillStyle = '#e6dcc2'; g.fillRect(0, 0, w, h); grain(g, w, h, 900, 0.07, 17);
    g.fillStyle = '#2a2018'; g.font = `700 22px ${FONT}`; g.fillText('THE STACKS · turns every 16 s · A → B → C', 20, 36);
    LAYOUT_ORDER.forEach((k, i) => {
      const ox = 22 + (i % 2) * 246, oy = 60 + Math.floor(i / 2) * 226, s = 46;
      g.font = `700 26px ${HAND}`; g.fillStyle = '#2a2018'; g.fillText(k, ox, oy + 18);
      g.strokeStyle = '#2a2018'; g.lineWidth = 3; g.strokeRect(ox + 22, oy + 26, s * 4, s * 4);
      g.lineWidth = 4;
      for (const e of EDGES) {
        if (LAYOUTS[k].includes(e)) continue;
        const [t, a, b] = e.split(':'); const c = +a, r = +b; g.beginPath();
        if (t === 'h') { g.moveTo(ox + 22 + c * s, oy + 26 + (r + 1) * s); g.lineTo(ox + 22 + (c + 1) * s, oy + 26 + (r + 1) * s); }
        else { g.moveTo(ox + 22 + (c + 1) * s, oy + 26 + r * s); g.lineTo(ox + 22 + (c + 1) * s, oy + 26 + (r + 1) * s); }
        g.stroke();
      }
      g.fillStyle = '#e6dcc2'; g.fillRect(ox + 22 + s + 12, oy + 22, s - 24, 8); g.fillRect(ox + 22 + 2 * s + 12, oy + 22 + 4 * s - 4, s - 24, 8);
      g.fillStyle = '#a02a1a'; g.font = `600 16px ${FONT}`; g.fillText('in', ox + 22 + s + 14, oy + 20); g.fillText('out', ox + 22 + 2 * s + 10, oy + 26 + 4 * s + 20);
    });
    g.fillStyle = '#2a2018'; g.font = `500 26px ${HAND}`; wrap(g, 'Wait in a cell. The walls move. You do not have to.', 270, 330, 220, 30);
  }, 'm17map'),
};

// ---------------------------------------------------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------------------------------------------------
export function buildArchive(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low';
  const W = { lightSrc: [], doors: {}, items: {}, lenses: [], booths: [], cages: [], glows: [], spin: [], stacks: null };
  const col = game.collision, R = rng(1717);
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const M = {
    conc96: pm('concrete', { color: 0x5e5a54, formwork: 1, stains: 0.6, cracks: 0.7, pores: 0.05 }),
    floor96: pm('concrete', { color: 0x4a4640, slabs: 1, stains: 0.4, cracks: 0.6, pores: 0.05 }),
    conc49: pm('concrete', { color: 0x8a8c8e, formwork: 1, stains: 0.25 }),
    floor49: pm('concrete', { color: 0x6a6e72, slabs: 1, stains: 0.2, formwork: 0 }),
    tile26: pm('ceramicTile', { color: 0xe4e6e8, grout: 0xa8aaac, count: 2, gloss: 0.8, variation: 0.05 }),
    wall26: pm('paintedMetalPanel', { color: 0xdfe2e4, cols: 2, rows: 1, wear: 0.05, grime: 0.05, gloss: 0.5 }),
    wood: pm('wood', { color: 0x4a3020, planks: 6, weathered: 0.4 }),
    woodDark: pm('wood', { color: 0x2e1e14, planks: 4, weathered: 0.3 }),
    steel: pm('brushedMetal', { color: 0x7a7e82, roughness: 0.45 }),
    steelDark: pm('brushedMetal', { color: 0x34383e, roughness: 0.5 }),
    rust: pm('rust', { color: 0x3a2418, paint: 0x2e3236, amount: 0.45 }),
    panel49: pm('paintedMetalPanel', { color: 0x9aa0a6, cols: 2, rows: 2, wear: 0.3, grime: 0.3 }),
  };
  const mat = (c, r = 0.8, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const brass = mat(0xb08a4a, 0.35, 0.85), dark = mat(0x121010, 0.95), paperMat = mat(0xd8ccb0, 0.9), leather = mat(0x4a2a1c, 0.7);
  const meshTex = canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#c8ccd0'; g.lineWidth = 3; for (let k = -w; k < w * 2; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke(); } g.lineWidth = 6; g.strokeRect(0, 0, w, h); }, 'm17chain', { alpha: true });
  meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping; meshTex.repeat.set(6, 5);
  const cage = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, map: meshTex, alphaTest: 0.4, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xb8c8d0, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const mirror = new THREE.MeshStandardMaterial({ color: 0x8a96a2, roughness: 0.06, metalness: 1.0, envMapIntensity: 1.4 });
  const amber = glowMat(0xffb060, 2.4), cool = glowMat(0xe8f4ff, 2.6), red = glowMat(0xff6a4a, 2.2), white26 = glowMat(0xf4f8ff, 2.2), violet = glowMat(0x9a7bff, 2.4);
  W.mats = { amber, cool, red, violet, mirror };
  const shelfMat = (seed) => { const m = new THREE.MeshStandardMaterial({ map: reelShelf(seed), emissiveMap: reelShelf(seed, true), emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.75 }); return m; };
  const reelsA = shelfMat(3), reelsB = shelfMat(8), boxes = new THREE.MeshStandardMaterial({ map: boxShelf(5), roughness: 0.8 });
  const S = { common: new Batch(), '2196': new Batch(), '2049': new Batch(), '2026': new Batch() };
  const g96 = new THREE.Group(), g49 = new THREE.Group(), g26 = new THREE.Group(); scene.add(g96, g49, g26);
  T.only(g96, '2196'); T.only(g49, '2049'); T.only(g26, '2026');
  const G = { '2196': g96, '2049': g49, '2026': g26 }; W.groups = G;
  const cbox = (x0, y0, z0, x1, y1, z1, states) => col.add([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], states ? { states } : {});
  const src = (x, y, z, c, i, d, era = 'all') => W.lightSrc.push({ p: [x, y, z], c, i, d, era });
  const plane = (tex, w, h, x, y, z, ry, parent = scene, emiss = 0.25, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emiss, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.order = 'YXZ'; m.rotation.set(rx, ry, 0); parent.add(m); return m;
  };
  // camera blockers: one invisible merged proxy of the permanent walls
  const proxy = [];
  const camWall = (x0, y0, z0, x1, y1, z1) => { const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); proxy.push(g); };
  // a wall run along x at z (or along z at x) with door gaps [a, b, top]; per-era materials, one collision
  const ERA_WALL = { '2196': M.conc96, '2049': M.conc49, '2026': M.wall26 };
  const wallX = (z, x0, x1, y1, t, gaps = [], eras = ['2196', '2049'], states = null, cam = true) => {
    const segs = []; let x = x0;
    for (const [a, b, top] of [...gaps].sort((p, q) => p[0] - q[0])) { if (a > x) segs.push([x, 0, a, y1]); if (top < y1) segs.push([a, top, b, y1]); x = b; }
    if (x < x1) segs.push([x, 0, x1, y1]);
    for (const [a, y0, b, yy] of segs) { for (const e of eras) S[e].box(ERA_WALL[e], a, y0, z - t / 2, b, yy, z + t / 2); cbox(a, y0, z - t / 2, b, yy, z + t / 2, states); if (cam) camWall(a, y0, z - t / 2, b, yy, z + t / 2); }
  };
  const wallZ = (x, z0, z1, y1, t, gaps = [], eras = ['2196', '2049'], states = null, cam = true) => {
    const segs = []; let z = z0;
    for (const [a, b, top] of [...gaps].sort((p, q) => p[0] - q[0])) { if (a > z) segs.push([z, 0, a, y1]); if (top < y1) segs.push([a, top, b, y1]); z = b; }
    if (z < z1) segs.push([z, 0, z1, y1]);
    for (const [a, y0, b, yy] of segs) { for (const e of eras) S[e].box(ERA_WALL[e], x - t / 2, y0, a, x + t / 2, yy, b); cbox(x - t / 2, y0, a, x + t / 2, yy, b, states); if (cam) camWall(x - t / 2, y0, a, x + t / 2, yy, b); }
  };
  const floor = (x0, z0, x1, z1, eras, mats) => { eras.forEach((e, i) => S[e].box(mats[i], x0, -0.3, z0, x1, 0, z1)); };
  const ceil = (x0, z0, x1, z1, y, eras, mats) => { eras.forEach((e, i) => S[e].box(mats[i], x0, y, z0, x1, y + 0.4, z1)); };
  const B96 = S['2196'], B49 = S['2049'], B26 = S['2026'], C = S.common;
  cbox(-40, -1, -140, 40, 0, 32);        // one walkable floor for everything
  const E2 = ['2196', '2049'];

  // ================= the lift and the Reading Room =================
  floor(-3, 20, 3, 28.5, E2, [M.floor96, M.floor49]); floor(-14, -6, 14, 20, E2, [M.floor96, M.floor49]); floor(14, 11, 22, 20, E2, [M.floor96, M.floor49]);
  ceil(-3, 20, 3, 28.5, 4.2, E2, [M.conc96, M.conc49]); ceil(-14, -6, 14, 20, 9.4, E2, [M.conc96, M.conc49]); ceil(14, 11, 22, 20, 3.8, E2, [M.conc96, M.conc49]);
  wallZ(-3, 20, 28.5, 4.2, 0.4); wallZ(3, 20, 28.5, 4.2, 0.4); wallX(28.5, -3, 3, 4.2, 0.4);
  wallX(20, -14, 14, 9.4, 0.6, [[-2, 2, 3.6]]); wallX(-6, -14, 14, 9.4, 0.6, [[-4.2, -1.8, 3.6]]);
  wallZ(-14, -6, 20, 9.4, 0.6); wallZ(14, -6, 20, 9.4, 0.6, [[15, 17, 3.0]]);
  wallX(11, 14, 22, 3.8, 0.4); wallX(20, 14, 22, 3.8, 0.4); wallZ(22, 11, 20, 3.8, 0.4);
  // the lift: an old freight cage (2196 rusted, 2049 sealed and clean)
  {
    for (const [x, z] of [[-2.6, 21], [2.6, 21], [-2.6, 28], [2.6, 28]]) { B96.box(M.rust, x - 0.12, 0, z - 0.12, x + 0.12, 4.2, z + 0.12); B49.box(M.steel, x - 0.12, 0, z - 0.12, x + 0.12, 4.2, z + 0.12); }
    B96.box(M.rust, -2.6, -0.02, 21, 2.6, 0.06, 28); B49.box(M.steelDark, -2.6, -0.02, 21, 2.6, 0.06, 28);
    W.doors.lift = new THREE.Mesh(new THREE.BoxGeometry(4, 3.4, 0.08), cage); W.doors.lift.position.set(0, 1.7, 20.9); scene.add(W.doors.lift);
    W.doors.liftBox = cbox(-2, 0, 20.6, 2, 3.4, 21.2);
    plane(TEX.stencil('SITE ZERO · SUB-LEVEL 6', 'Sealed by order 31/07. No entry without the Director.'), 2.6, 0.8, 0, 4.4, 19.66, PI, g49, 0.3);
    plane(TEX.sign('THE ARCHIVE', 'Everything you were. Please do not stay.', { size: 70 }), 5.2, 0.98, 0, 5.2, 19.66, PI, g96, 0.3);
    src(0, 3.6, 24.5, 0xffb070, 4, 9, '2196'); src(0, 3.6, 24.5, 0xe8f4ff, 5, 10, '2049');
    B96.box(amber, -0.3, 4.12, 24.2, 0.3, 4.18, 24.8); B49.box(cool, -1, 4.12, 24.4, 1, 4.18, 24.6);
  }
  // 2196: walls of reels, floor to vault; the index drum; the Witness's desk; four booths
  {
    for (const z of [-2.5, 4, 10.2]) { B96.geo(reelsA, new THREE.BoxGeometry(0.5, 8.2, 6.6), [13.45, 4.1, z]); }
    cbox(13.2, 0, -5.8, 14, 8.2, 13.5, ['2196']);
    B96.geo(reelsA, new THREE.BoxGeometry(0.5, 5.4, 4.2), [13.45, 6.5, 16]);
    for (const x of [-9.8, 9.8]) B96.geo(reelsB, new THREE.BoxGeometry(6.4, 8.2, 0.5), [x, 4.1, 19.45]);
    for (const x of [-10.6, 9.6]) { B96.geo(reelsB, new THREE.BoxGeometry(6.4, 8.2, 0.5), [x, 4.1, -5.45]); cbox(x - 3.2, 0, -5.7, x + 3.2, 8.2, -5.2, ['2196']); }
    for (const x of [-9.8, 9.8]) cbox(x - 3.2, 0, 19.2, x + 3.2, 8.2, 19.7, ['2196']);
    B96.geo(reelsA, new THREE.BoxGeometry(0.5, 4.6, 26), [-13.45, 6.8, 7]);
    // catwalk on the west wall with a ladder (dressing)
    B96.box(M.rust, -13.2, 4.4, -5.6, -11.6, 4.5, 19.6); for (let z = -5; z <= 19; z += 3) B96.box(M.rust, -11.64, 4.5, z - 0.03, -11.58, 5.5, z + 0.03); B96.box(M.rust, -11.64, 5.45, -5.6, -11.58, 5.52, 19.6);
    // the index drum: a rotating column of reels (2196) / a crate stack (2049)
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 5.6, 28, 1, true), reelsA); drum.position.set(0, 3.4, 6); g96.add(drum); W.spin.push(drum);
    B96.cyl(brass, 0, 0.3, 6, 2.3, 0.6, 28); B96.cyl(brass, 0, 6.3, 6, 2.3, 0.2, 28); B96.cyl(M.woodDark, 0, 0.62, 6, 2.6, 0.04, 28);
    cbox(-2.1, 0, 3.9, 2.1, 6, 8.1);
    for (const [x, z] of [[-1.4, 5.2], [1.4, 5.2], [0, 7.8], [-1.6, 7.4], [1.6, 7.2]]) B49.box(M.panel49, x - 0.8, 0, z - 0.6, x + 0.8, 1.4 + R() * 1.6, z + 0.6);
    plane(TEX.stencil('ARTEFACT A · CRADLE SPARES', 'Do not open · E.R.'), 1.6, 0.5, 0, 1.0, 4.32, PI, g49, 0.3);
    // the Witness's desk
    const [dx, , dz] = P.wdesk;
    B96.box(M.woodDark, dx - 1.3, 0.92, dz - 0.7, dx + 1.3, 0.98, dz + 0.7); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B96.box(M.woodDark, dx + sx * 1.18 - 0.05, 0, dz + sz * 0.6 - 0.05, dx + sx * 1.18 + 0.05, 0.92, dz + sz * 0.6 + 0.05);
    cbox(dx - 1.3, 0, dz - 0.7, dx + 1.3, 0.98, dz + 0.7, ['2196']);
    B96.cyl(brass, dx + 0.8, 1.2, dz + 0.3, 0.22, 0.05, 18, [PI / 2, 0, 0]); B96.cyl(brass, dx + 0.3, 1.2, dz + 0.3, 0.22, 0.05, 18, [PI / 2, 0, 0]);
    B96.box(paperMat, dx - 0.9, 0.98, dz - 0.4, dx - 0.3, 1.0, dz + 0.1); B96.box(red, dx - 1.1, 1.3, dz + 0.5, dx - 1.0, 1.36, dz + 0.56);
    B96.box(leather, dx - 0.4, 0, dz + 0.9, dx + 0.4, 0.5, dz + 1.6); B96.box(leather, dx - 0.4, 0.5, dz + 1.5, dx + 0.4, 1.2, dz + 1.62);
    src(dx - 1.05, 1.6, dz + 0.5, 0xff8a5a, 2.2, 6, '2196');
    // the four booths: a chair, a brass reel deck, a projection ring on the floor, a plaque
    RECS.forEach((rec, i) => {
      const [bx, bz] = P.booths[i], [sx, sz] = P.stage[i];
      B96.box(M.woodDark, bx - 1.0, 0, bz - 1.7, bx - 0.9, 3.2, bz + 1.7); B96.box(M.woodDark, bx - 1.0, 3.1, bz - 1.7, bx + 1.4, 3.2, bz + 1.7);
      B96.box(M.woodDark, bx - 1.0, 0, bz - 1.75, bx + 1.4, 3.2, bz - 1.65); B96.box(M.woodDark, bx - 1.0, 0, bz + 1.65, bx + 1.4, 3.2, bz + 1.75);
      B96.box(M.steelDark, bx - 0.6, 0, bz - 0.5, bx + 0.2, 1.0, bz + 0.5); cbox(bx - 0.9, 0, bz - 0.55, bx + 0.25, 1.0, bz + 0.55, ['2196']);
      for (const oz of [-0.24, 0.24]) B96.cyl(brass, bx - 0.2, 1.1, bz + oz, 0.2, 0.04, 18);
      B96.box(amber, bx - 0.05, 1.02, bz - 0.06, bx + 0.05, 1.06, bz + 0.06);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.03, 6, 48), amber); ring.rotation.x = -PI / 2; ring.position.set(sx, 0.03, sz); g96.add(ring); W.glows.push(ring);
      plane(TEX.plaque(rec.plaque), 1.2, 0.6, bx + 1.36, 1.9, bz + 1.4, PI / 2, g96, 0.3);
      src(bx + 0.4, 2.8, bz, 0xffb070, 2.4, 6, '2196');
      W.booths.push({ x: bx, z: bz, sx, sz, ring });
    });
    plane(TEX.map(), 1.3, 1.3, -5.6, 2.0, -5.66, 0, g96, 0.35);   // the Witness's map by the Stacks door
    src(-6, 7.8, 6, 0xffa860, 6, 18, '2196'); src(6, 7.8, 6, 0xffa860, 6, 18, '2196'); src(0, 7.8, -2, 0xffa860, 4, 14, '2196');
    for (const [x, z] of [[-6, 6], [6, 6], [0, -2], [0, 14]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.4, 12), amber); l.position.set(x, 8.2, z); g96.add(l); B96.cyl(M.rust, x, 8.8, z, 0.02, 1.2, 4); }
  }
  // 2049: Site Zero evidence store
  {
    for (const x of [-13.3]) for (const z of [-2, 4, 10, 16]) B49.geo(boxes, new THREE.BoxGeometry(1.2, 4.4, 5.6), [x, 2.2, z]);
    cbox(-14, 0, -5, -12.7, 4.4, 19, ['2049']);
    W.cageItems = [];
    P.cages.forEach(([cx, cz], i) => {
      B49.box(M.steelDark, cx + 1.8, 0, cz - 2.4, cx + 2.4, 3.6, cz + 2.4);
      for (const z of [cz - 2.4, cz + 2.4]) { B49.geo(cage, new THREE.BoxGeometry(4, 3.2, 0.04), [cx, 1.6, z]); cbox(cx - 2, 0, z - 0.05, cx + 2.4, 3.2, z + 0.05, ['2049']); }
      B49.geo(cage, new THREE.BoxGeometry(0.04, 3.2, 1.6), [cx - 2, 1.6, cz - 1.6]); B49.geo(cage, new THREE.BoxGeometry(0.04, 3.2, 1.6), [cx - 2, 1.6, cz + 1.6]);
      cbox(cx - 2.05, 0, cz - 2.4, cx - 1.95, 3.2, cz - 0.8, ['2049']); cbox(cx - 2.05, 0, cz + 0.8, cx - 1.95, 3.2, cz + 2.4, ['2049']);
      B49.box(M.steel, cx + 0.3, 0, cz - 1.6, cx + 1.8, 1.0, cz + 1.6); cbox(cx + 0.3, 0, cz - 1.6, cx + 1.8, 1.0, cz + 1.6, ['2049']);
      for (let k = 0; k < 3; k++) B49.box(M.panel49, cx + 0.5, 1.0, cz - 1.3 + k * 0.9, cx + 1.5, 1.4, cz - 0.7 + k * 0.9);
      plane(TEX.stencil('CAGE ' + 'ABC'[i], ['RUN 01 · FIELD LOGS', 'PERSONNEL · LETTERS', 'REGISTRY · NOT FILED'][i]), 1.3, 0.4, cx - 2.03, 2.8, cz, -PI / 2, g49, 0.35);
      src(cx - 0.4, 3.2, cz, 0xe8f4ff, 4, 8, '2049'); B49.box(cool, cx - 0.6, 3.5, cz - 1.0, cx - 0.4, 3.56, cz + 1.0);
    });
    for (const x of [-3.6, 3.6]) B49.box(mat(0xd8b020, 0.6), x - 0.06, 0, -6, x + 0.06, 0.012, 20);
    for (let z = -2; z <= 16; z += 6) { B49.box(cool, -0.12, 9.3, z - 1.2, 0.12, 9.36, z + 1.2); src(0, 8.6, z, 0xe8f4ff, 5, 14, '2049'); }
    // the shutter that seals the Stacks door in 2049
    W.doors.shutter49 = cbox(-4.2, 0, -6.3, -1.8, 3.6, -5.7, ['2049']);
    B49.box(M.panel49, -4.2, 0, -6.2, -1.8, 3.6, -5.8); for (let y = 0.3; y < 3.6; y += 0.3) B49.box(M.steelDark, -4.2, y, -5.82, -1.8, y + 0.04, -5.78);
    plane(TEX.stencil('STORE 2 · SEALED', 'Order 31/07'), 1.6, 0.5, -3, 2.4, -5.74, 0, g49, 0.3);
    plane(TEX.stencil('SITE ZERO · EVIDENCE STORE 1', 'RUN 01 inquiry, 19.10.2026. Sealed 2031. Do not remove items.'), 3.0, 0.94, 6, 3.4, 19.68, PI, g49, 0.3);
  }
  // the quarters (2196: cot, coat, kettle, a booth; 2049: Rook's records annex)
  {
    const [bx, , bz] = P.qBooth;
    B96.box(M.rust, 14.6, 0, 17.6, 16.6, 0.45, 19.6); B96.box(mat(0x5a4a3a, 0.95), 14.7, 0.45, 17.7, 16.5, 0.6, 19.5); cbox(14.6, 0, 17.6, 16.6, 0.6, 19.6, ['2196']);
    B96.box(M.woodDark, 20.4, 0, 18.2, 21.8, 1.9, 19.8); cbox(20.4, 0, 18.2, 21.8, 1.9, 19.8, ['2196']);
    W.coat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 1.5, 10), mat(0x2a2724, 0.85)); W.coat.position.set(21.6, 1.35, 17.2); g96.add(W.coat);
    B96.box(M.steelDark, bx - 0.5, 0, bz - 0.5, bx + 0.5, 1.0, bz + 0.5); cbox(bx - 0.5, 0, bz - 0.5, bx + 0.5, 1.0, bz + 0.5, ['2196']);
    for (const oz of [-0.2, 0.2]) B96.cyl(brass, bx, 1.08, bz + oz, 0.17, 0.04, 16);
    plane(TEX.plaque(['REC 0112 · THE FATHER', 'A flat on Calder Row, 2047.', 'Kept. Not for study.']), 0.9, 0.45, bx, 1.6, bz - 0.52, PI, g96, 0.3);
    B96.box(M.steelDark, 16.0, 0, 11.4, 18.4, 0.9, 12.2); B96.cyl(M.steel, 16.6, 1.05, 11.8, 0.12, 0.28, 12); cbox(16, 0, 11.4, 18.4, 0.9, 12.2, ['2196']);
    src(18, 3.2, 15.5, 0xffa060, 3, 9, '2196');
    // 2049: filing cabinets and the seal order on the wall
    for (let k = 0; k < 5; k++) B49.box(M.panel49, 15 + k * 1.3, 0, 19.0, 16.1 + k * 1.3, 1.4, 19.8);
    cbox(15, 0, 19.0, 21.6, 1.4, 19.8, ['2049']);
    W.sealDoc = plane(TEX.doc('HELIX · ORDER 31/07', SEAL.text, { head: 'HELIX TEMPORAL RESEARCH · DIRECTOR', key: 'seal' }), 0.7, 0.88, 21.75, 1.7, 14.6, -PI / 2, g49, 0.25);
    src(18, 3.4, 15.5, 0xe8f4ff, 3, 9, '2049');
  }

  // ================= the Stacks =================
  floor(-12, -30, 12, -6, ['2196'], [M.floor96]); ceil(-12, -30, 12, -6, 4.7, ['2196'], [M.conc96]);
  // in 2049 the Stacks are never entered (the shutter): only the outer walls are shared
  wallZ(-12, -30, -6, 4.7, 0.5, [], ['2196']); wallZ(12, -30, -6, 4.7, 0.5, [], ['2196']);
  wallX(-30, -12, 12, 4.7, 0.5, [[1.8, 4.2, 3.4]], ['2196']);
  for (let c = 0; c <= 4; c++) for (let r = 0; r <= 4; r++) { const x = -12 + c * 6, z = -6 - r * 6; B96.box(M.rust, x - 0.3, 0, z - 0.3, x + 0.3, 4.7, z + 0.3); if (c > 0 && c < 4 && r > 0 && r < 4) cbox(x - 0.3, 0, z - 0.3, x + 0.3, 4.7, z + 0.3, ['2196']); }
  {
    // the moving walls: one instanced mesh of shelving, one of floor-slot strips that warn before a change
    const n = EDGES.length;
    const panelGeo = new THREE.BoxGeometry(5.4, 4.2, 0.5);
    const panels = new THREE.InstancedMesh(panelGeo, reelsB, n); panels.castShadow = false; panels.receiveShadow = true; panels.userData.noBatch = true;
    const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(5.4, 0.03, 0.62), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n); strips.userData.noBatch = true;
    const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(5.4, 0.08, 0.6), M.rust, n); caps.userData.noBatch = true;
    g96.add(panels, strips, caps); game.blocker(panels);
    const st = { edges: EDGES.map(e => ({ e, ...edgeGeom(e), cur: 1, target: 1, box: null, warn: 0 })), layout: null, next: null, t: 0, period: 16, warnT: 3.5, running: false, idx: 0, onShift: null };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), scl = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3(), colr = new THREE.Color();
    st.edges.forEach((d, i) => {
      d.box = d.along === 'x' ? cbox(d.x - 2.7, 0, d.z - 0.25, d.x + 2.7, 4.2, d.z + 0.25, ['2196']) : cbox(d.x - 0.25, 0, d.z - 2.7, d.x + 0.25, 4.2, d.z + 2.7, ['2196']);
      d.rot = d.along === 'x' ? 0 : PI / 2; d.i = i;
      q.setFromAxisAngle(up, d.rot); m4.compose(pos.set(d.x, 0.0, d.z), q, scl); strips.setMatrixAt(i, m4); strips.setColorAt(i, colr.set(0x1a1410));
    });
    const place = () => {
      for (const d of st.edges) {
        q.setFromAxisAngle(up, d.rot);
        m4.compose(pos.set(d.x, -2.15 + 4.25 * d.cur, d.z), q, scl); panels.setMatrixAt(d.i, m4);
        m4.compose(pos.set(d.x, 4.25 * d.cur - 0.02, d.z), q, scl); caps.setMatrixAt(d.i, m4);
      }
      panels.instanceMatrix.needsUpdate = true; caps.instanceMatrix.needsUpdate = true;
    };
    st.setLayout = (k, immediate) => {
      st.layout = k; const open = LAYOUTS[k];
      for (const d of st.edges) { d.target = open.includes(d.e) ? 0 : 1; if (immediate) d.cur = d.target; }
      if (immediate) { for (const d of st.edges) d.box.enabled = d.cur > 0.3; place(); }
    };
    st.setLayout('A', true);
    st.update = (dt, t) => {
      if (st.running) {
        st.t += dt;
        const nextK = LAYOUT_ORDER[(st.idx + 1) % 3]; st.next = nextK;
        const warn = st.t > st.period - st.warnT;
        for (const d of st.edges) {
          const willChange = (LAYOUTS[nextK].includes(d.e) ? 0 : 1) !== d.target;
          const k = warn && willChange ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
          strips.setColorAt(d.i, colr.setRGB(0.1 + k * 1.6, 0.08 + k * 0.9, 0.05 + k * 0.2));
        }
        strips.instanceColor.needsUpdate = true;
        if (st.t >= st.period) { st.t = 0; st.idx = (st.idx + 1) % 3; st.setLayout(LAYOUT_ORDER[st.idx]); st.onShift?.(st.layout); }
      }
      let moved = false;
      const pl = game.player.pos;
      for (const d of st.edges) {
        if (d.cur === d.target) continue;
        moved = true;
        d.cur += Math.sign(d.target - d.cur) * Math.min(Math.abs(d.target - d.cur), dt / 0.9);
        const on = d.cur > 0.3;
        if (on && !d.box.enabled && T.current === '2196') {
          // a wall rising under Kai pushes him gently to the side he stands on
          if (d.along === 'x') { if (Math.abs(pl.z - d.z) < 0.65 && Math.abs(pl.x - d.x) < 2.95) pl.z = d.z + (pl.z >= d.z ? 0.7 : -0.7); }
          else if (Math.abs(pl.x - d.x) < 0.65 && Math.abs(pl.z - d.z) < 2.95) pl.x = d.x + (pl.x >= d.x ? 0.7 : -0.7);
        }
        d.box.enabled = on;
      }
      if (moved) place();
    };
    W.stacks = st;
    // the lectern with the layouts (journal page 2 lies on it)
    const [lx, , lz] = P.lectern;
    B96.box(M.woodDark, lx - 0.35, 0, lz - 0.3, lx + 0.35, 1.1, lz + 0.3); B96.geo(M.woodDark, new THREE.BoxGeometry(0.9, 0.06, 0.7), [lx, 1.14, lz], [-0.4, 0, 0]);
    cbox(lx - 0.35, 0, lz - 0.3, lx + 0.35, 1.1, lz + 0.3, ['2196']);
    plane(TEX.map(), 0.7, 0.7, lx, 1.19, lz + 0.02, 0, g96, 0.3, -PI / 2 + 0.4);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { const [x, , z] = P.cell(c, r); if ((c + r) % 2 === 0) src(x, 4.0, z, 0xffa860, 2.4, 7, '2196'); B96.box(amber, x - 0.2, 4.62, z - 0.2, x + 0.2, 4.68, z + 0.2); }
    // cell labels painted on the floor
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { const [x, , z] = P.cell(c, r); plane(TEX.plaque(['ABCD'[c] + (r + 1)], { bg: '#3a2a1a' }), 0.8, 0.4, x + 2.1, 0.02, z + 2.4, 0, g96, 0.15, -PI / 2); }
  }

  // ================= the Sorting Room =================
  floor(-6, -42, 12, -30, ['2196'], [M.floor96]); ceil(-6, -42, 12, -30, 4.6, ['2196'], [M.conc96]);
  wallZ(-6, -42, -30, 4.6, 0.5, [], ['2196']); wallZ(12, -42, -30, 4.6, 0.5, [], ['2196']);
  wallX(-42, -12, 12, 7, 0.5, [[1.8, 4.2, 3.4]], ['2196']);
  {
    const [cx, , cz] = P.conc;
    B96.box(M.woodDark, cx - 2.6, 0.9, cz - 0.9, cx + 2.6, 0.98, cz + 0.9); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B96.box(M.woodDark, cx + sx * 2.45 - 0.06, 0, cz + sz * 0.8 - 0.06, cx + sx * 2.45 + 0.06, 0.9, cz + sz * 0.8 + 0.06);
    cbox(cx - 2.6, 0, cz - 0.9, cx + 2.6, 0.98, cz + 0.9, ['2196']);
    W.trays = RECS.map((rec, i) => {
      const x = cx - 1.95 + i * 1.3;
      B96.box(brass, x - 0.5, 0.98, cz - 0.4, x + 0.5, 1.02, cz + 0.4);
      plane(TEX.plaque(['REC ' + rec.num, rec.title]), 0.9, 0.45, x, 1.28, cz - 0.86, 0, g96, 0.3, -0.25);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), dark); lamp.position.set(x, 1.08, cz - 0.55); g96.add(lamp);
      return { x, z: cz, lamp };
    });
    for (const z of [-33, -39]) B96.geo(reelsA, new THREE.BoxGeometry(0.5, 4.4, 5.6), [11.45, 2.2, z]);
    B96.geo(reelsB, new THREE.BoxGeometry(0.5, 4.4, 11), [-5.45, 2.2, -36]);
    B96.box(M.woodDark, 8.8, 0, -33.8, 10.6, 0.9, -32.6); cbox(8.8, 0, -33.8, 10.6, 0.9, -32.6, ['2196']);
    src(cx, 3.8, cz, 0xffa860, 4.5, 10, '2196'); src(-2, 3.8, -36, 0xffa860, 2.6, 8, '2196');
    const lampSh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.35, 14, 1, true), amber); lampSh.position.set(cx, 3.6, cz); g96.add(lampSh);
    // the locked door to the Mirror Hall
    W.doors.mirror = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 0.2), M.rust); W.doors.mirror.position.set(3, 1.7, -42); g96.add(W.doors.mirror);
    W.doors.mirrorBox = cbox(1.8, 0, -42.25, 4.2, 3.4, -41.75, ['2196']);
    W.doors.mirrorLamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), red); W.doors.mirrorLamp.position.set(3, 3.7, -41.7); g96.add(W.doors.mirrorLamp);
  }

  // ================= the Mirror Hall =================
  floor(-12, -70, 12, -42, ['2196'], [M.floor96]); ceil(-12, -70, 12, -42, 7, ['2196'], [M.conc96]);
  wallZ(-12, -70, -42, 7, 0.5, [], ['2196']); wallZ(12, -70, -42, 7, 0.5, [], ['2196']);
  wallX(-70, -12, 12, 7, 0.5, [[-1.2, 1.2, 3.4]], ['2196']);
  W.cover = [];
  {
    // tall mirror panels (full cover) and low reel cases (crouch cover)
    for (const [x, z, ry] of [[-6.5, -49, 0], [6.8, -52, 0], [-2.4, -57.5, PI / 2], [4.2, -62.5, 0], [-7.6, -63, PI / 2], [8.6, -66.6, PI / 2]]) {
      B96.geo(mirror, new THREE.BoxGeometry(2.4, 3.4, 0.12), [x, 1.9, z], [0, ry, 0]); B96.geo(M.steelDark, new THREE.BoxGeometry(2.6, 0.2, 0.4), [x, 0.1, z], [0, ry, 0]);
      const hx = ry ? 0.1 : 1.2, hz = ry ? 1.2 : 0.1; cbox(x - hx, 0, z - hz, x + hx, 3.6, z + hz, ['2196']); camWall(x - hx, 0, z - hz, x + hx, 3.6, z + hz);
    }
    for (const [x, z] of [[-3.6, -46.6], [2.6, -50.4], [-8.6, -55.4], [7.6, -57.6], [0.4, -61], [-4.4, -66.2], [4.6, -67.4], [9.4, -46]]) {
      B96.box(M.woodDark, x - 1.0, 0, z - 0.45, x + 1.0, 1.05, z + 0.45); B96.box(glass, x - 0.95, 1.05, z - 0.4, x + 0.95, 1.08, z + 0.4);
      cbox(x - 1.0, 0, z - 0.45, x + 1.0, 1.05, z + 0.45, ['2196']); W.cover.push([x, z]);
    }
    for (const z of [-47, -55, -63]) { B96.geo(reelsA, new THREE.BoxGeometry(0.5, 6.4, 7.2), [-11.45, 3.2, z]); B96.geo(reelsB, new THREE.BoxGeometry(0.5, 6.4, 7.2), [11.45, 3.2, z]); }
    for (const [x, z] of [[-6, -48], [6, -48], [-6, -60], [6, -60], [0, -54], [0, -66]]) { src(x, 6.2, z, 0xffd0a0, 4.6, 14, '2196'); B96.box(cool, x - 0.8, 6.9, z - 0.08, x + 0.8, 6.96, z + 0.08); }
    plane(TEX.sign('THE MIRROR HALL', 'It learns you. It is meant to.', { size: 60 }), 4.4, 0.83, 3, 4.6, -42.32, PI, g96, 0.3);
    W.doors.gate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 0.24), M.rust); W.doors.gate.position.set(0, 1.7, -70); g96.add(W.doors.gate);
    W.doors.gateBox = cbox(-1.2, 0, -70.3, 1.2, 3.4, -69.7, ['2196']);
    W.doors.gateLamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), red); W.doors.gateLamp.position.set(0, 3.7, -69.8); g96.add(W.doors.gateLamp);
  }

  // ================= the Seal antechamber (2196 + 2026) =================
  const E3 = ['2196', '2026'];
  floor(-6, -82, 6, -70, E3, [M.floor96, M.tile26]); ceil(-6, -82, 6, -70, 4.4, E3, [M.conc96, M.wall26]);
  wallZ(-6, -82, -70, 4.4, 0.5, [], E3); wallZ(6, -82, -70, 4.4, 0.5, [], E3);
  cbox(-1.2, 0, -70.3, 1.2, 3.4, -69.7, ['2026']);           // in 2026 the Mirror Hall door is a wall
  B26.box(M.wall26, -6, 0, -70.25, 6, 4.4, -69.75);
  wallX(-82, -6, 6, 4.4, 0.5, [[-1.2, 1.2, 3.0]], E3);
  cbox(-1.2, 0, -82.4, 1.2, 3.0, -81.6, ['2196']);           // the seal: rubble in 2196, an open door in 2026
  {
    // rubble heap at the seal (2196)
    const rock = mat(0x4a4640, 0.95);
    for (let k = 0; k < 14; k++) B96.geo(rock, new THREE.DodecahedronGeometry(0.4 + R() * 0.5, 0), [(R() - 0.5) * 3.4, 0.2 + R() * 1.8, -81.6 + R() * 0.8], [R() * 3, R() * 3, 0]);
    B96.box(M.conc96, -1.4, 2.4, -82.2, 1.4, 3.2, -81.4);
    // echo lens I: a brass tripod with a glass eye
    const [lx, , lz] = P.lens1;
    const lens = lensMesh(brass, amber); lens.position.set(lx, 0, lz); g96.add(lens); W.lenses.push(lens);
    cbox(lx - 0.4, 0, lz - 0.4, lx + 0.4, 1.4, lz + 0.4, ['2196']);
    plane(TEX.plaque(['ECHO LENS I', 'Plays a room as it was.', 'Load a reel. Stand close. Be quick.']), 0.9, 0.45, lx - 1.4, 1.4, lz, PI / 2, g96, 0.3);
    src(0, 3.8, -76, 0xffa060, 3, 9, '2196'); src(0, 3.8, -76, 0xf4f8ff, 4.5, 11, '2026');
    B26.box(white26, -2, 4.36, -76.1, 2, 4.4, -75.9);
    plane(TEX.lab('SITE ZERO', 'Test Hall Zero · authorised staff · open day 19.10'), 3.0, 0.75, 0, 3.6, -81.7, 0, g26, 0.3);
    plane(TEX.sign('SEALED', 'Beyond this point: Room 0001', { size: 70 }), 2.6, 0.49, 0, 3.6, -81.55, 0, g96, 0.3);
  }

  // ================= 2026 only: the Control Room and the corridor (solid rock in 2196) =================
  cbox(-8, 0, -94, 8, 4, -82.5, ['2196']); cbox(-1.6, 0, -106.2, 1.6, 4, -94, ['2196']);
  floor(-8, -94, 8, -82, ['2026'], [M.tile26]); ceil(-8, -94, 8, -82, 3.6, ['2026'], [M.wall26]);
  wallZ(-8, -94, -82, 3.6, 0.4, [[-89, -87, 2.6]], ['2026'], ['2026'], false); wallZ(8, -94, -82, 3.6, 0.4, [], ['2026'], ['2026'], false);
  wallX(-94, -8, 8, 3.6, 0.4, [[-1.2, 1.2, 2.8]], ['2026'], ['2026'], false);
  floor(-1.5, -106, 1.5, -94, ['2026'], [M.tile26]); ceil(-1.5, -106, 1.5, -94, 3.0, ['2026'], [M.wall26]);
  wallZ(-1.6, -106, -94, 3.0, 0.2, [], ['2026'], ['2026'], false); wallZ(1.6, -106, -94, 3.0, 0.2, [], ['2026'], ['2026'], false);
  {
    // consoles, chairs, the run board, the run sheet on the desk
    for (const [x, z] of [[-5.2, -88.4], [-1.6, -90.6], [2.2, -90.6], [5.6, -88.4]]) {
      B26.box(mat(0xcfd4d8, 0.5, 0.2), x - 1.1, 0, z - 0.5, x + 1.1, 0.9, z + 0.5); cbox(x - 1.1, 0, z - 0.5, x + 1.1, 0.9, z + 0.5, ['2026']);
      B26.geo(mat(0x101418, 0.3, 0.2), new THREE.BoxGeometry(0.9, 0.55, 0.05), [x, 1.25, z - 0.35], [-0.2, 0, 0]);
      B26.geo(glowMat(0x7ac8ff, 1.2), new THREE.BoxGeometry(0.8, 0.45, 0.01), [x, 1.25, z - 0.32], [-0.2, 0, 0]);
    }
    plane(TEX.lab('RUN 01 · 19.10.2026 · 08:14', 'Field 4.1 kHz · Collars II · IV · I · Visitors behind the rope'), 4.4, 1.1, 0, 2.4, -93.7, 0, g26, 0.35);
    W.runSheet = plane(TEX.doc('RUN SHEET · RUN 01', 'Start 08:14:02. Field 4.1 kHz. Collar phases II · IV · I. Corridor door code: run number and the hour, 0108. Power: breaker in the cable vault (CV-3).', { head: 'HELIX · SITE ZERO · CONTROL', key: 'sheet' }), 0.42, 0.52, P.runSheet[0] + 0.2, 0.92, P.runSheet[2], 0, g26, 0.3, -PI / 2);
    for (const [x, z] of [[-6, -84], [6, -84], [0, -88]]) { src(x, 3.3, z, 0xf4f8ff, 4.2, 9, '2026'); B26.box(white26, x - 0.9, 3.56, z - 0.15, x + 0.9, 3.6, z + 0.15); }
    // the keypad door at the corridor (2026)
    W.doors.keypad = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.1), mat(0xd8dce0, 0.4, 0.4)); W.doors.keypad.position.set(0, 1.4, -94); g26.add(W.doors.keypad);
    W.doors.keypadBox = cbox(-1.2, 0, -94.2, 1.2, 2.8, -93.8, ['2026']);
    W.keypadLamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.05), red); W.keypadLamp.position.set(P.keypad[0], 1.4, P.keypad[2] + 0.36); g26.add(W.keypadLamp);
    B26.box(M.steelDark, P.keypad[0] - 0.14, 1.1, -93.82, P.keypad[0] + 0.14, 1.7, -93.74);
    for (let z = -104; z <= -96; z += 4) { src(0, 2.8, z, 0xf4f8ff, 2.4, 6, '2026'); B26.box(white26, -0.3, 2.96, z - 0.6, 0.3, 3.0, z + 0.6); }
    plane(TEX.lab('TEST HALL ZERO', 'Open day demonstration · keep behind the rope'), 2.4, 0.6, 0, 3.7, -106.34, PI, g26, 0.3);
  }

  // ================= the Cable Vault (2196 pocket + 2026) =================
  floor(-16, -92, -8, -84, E3, [M.floor96, M.tile26]); ceil(-16, -92, -8, -84, 3.4, E3, [M.conc96, M.wall26]);
  wallX(-84, -16, -8, 3.4, 0.4, [], E3); wallX(-92, -16, -8, 3.4, 0.4, [], E3); wallZ(-16, -92, -84, 3.4, 0.4, [], E3);
  wallZ(-8, -92, -84, 3.4, 0.3, [], ['2196'], ['2196']);   // in 2196 the vault's east side is the rock
  {
    for (let k = 0; k < 6; k++) { C.cyl(dark, -15.6, 0.6 + k * 0.42, -88, 0.12, 8, 8, [PI / 2, 0, 0]); }
    B26.box(mat(0x9aa6b0, 0.5, 0.4), -15.9, 0.8, -86.9, -15.6, 2.2, -85.5);
    W.breakerLever = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), red); W.breakerLever.position.set(-15.5, 1.5, -86.2); g26.add(W.breakerLever);
    plane(TEX.stencil('CV-3 · CORRIDOR POWER', 'Test Hall Zero approach'), 0.9, 0.28, -15.55, 2.45, -86.2, PI / 2, g26, 0.3);
    const [lx, , lz] = P.lens2;
    const lens = lensMesh(brass, amber); lens.position.set(lx, 0, lz); g96.add(lens); W.lenses.push(lens);
    cbox(lx - 0.4, 0, lz - 0.4, lx + 0.4, 1.4, lz + 0.4, ['2196']);
    plane(TEX.plaque(['ECHO LENS II', 'The corridor, 07:40.', 'Its reel lives here. So did I, for a while.']), 0.9, 0.45, lx, 1.4, lz - 0.6, 0, g96, 0.3);
    B96.box(mat(0x5a4a3a, 0.95), -15.6, 0, -84.6, -13.6, 0.4, -84.3);
    src(-12, 3.0, -88, 0xffa060, 2.6, 7, '2196'); src(-12, 3.0, -88, 0xf4f8ff, 3, 7, '2026');
  }

  // ================= Test Hall Zero (2026) / Room 0001 (2196) =================
  floor(-12, -132, 12, -106, E3, [M.floor96, M.tile26]); ceil(-12, -132, 12, -106, 9, E3, [M.conc96, M.wall26]);
  wallZ(-12, -132, -106, 9, 0.6, [], E3); wallZ(12, -132, -106, 9, 0.6, [], E3); wallX(-132, -12, 12, 9, 0.6, [], E3);
  wallX(-106, -12, 12, 9, 0.6, [[-1.5, 1.5, 3.0]], E3);
  cbox(-1.5, 0, -106.4, 1.5, 3.0, -105.6, ['2196']);
  {
    const [rx, ry, rz] = P.ring;
    // the cradle (both): concrete plinth and two steel arms
    C.box(M.steelDark, -3.6, 0, rz - 1.2, 3.6, 0.5, rz + 1.2); cbox(-3.6, 0, rz - 1.2, 3.6, 0.5, rz + 1.2);
    for (const sx of [-1, 1]) { B26.box(M.steel, sx * 3.2 - 0.25, 0.5, rz - 0.4, sx * 3.2 + 0.25, 3.2, rz + 0.4); B96.box(M.rust, sx * 3.2 - 0.25, 0.5, rz - 0.4, sx * 3.2 + 0.25, 2.6, rz + 0.4); }
    cbox(-3.6, 0, rz - 0.6, 3.6, 4, rz + 0.6, null);
    // 2026: the ring itself, upright in its cradle
    const ring = chronolith(1.0, { color: 0x5fe6ff, power: 0.35 }); ring.position.set(rx, ry, rz); g26.add(ring); W.ring = ring;
    // the collar dials: three brass phase dials on the cradle front (I..IV), each turning one collar of the ring
    W.collars = P.collars.map(([x, y, z]) => {
      const g = new THREE.Group(); g.position.set(x, y, z);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 20), brass); face.rotation.x = PI / 2; g.add(face);
      const ptr = new THREE.Group(); const mark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.03), glowMat(0xffd27a, 2)); mark.position.set(0, 0.11, 0.04); ptr.add(mark); g.add(ptr);
      for (let k = 0; k < 4; k++) { const tick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.02), dark); const a = -k * PI / 2; tick.position.set(Math.sin(-a) * 0.21, Math.cos(a) * 0.21, 0.035); g.add(tick); }
      g26.add(g); return { g, ptr, v: 0 };
    });
    for (const sx of [-1, 0, 1]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 24), brass); band.position.set(rx + sx * 2.62, ry + (sx ? 0 : 2.62), rz + 0.1); band.rotation.set(0, PI / 2, sx ? 0 : PI / 2); g26.add(band); }
    // rope and stanchions at z = P.rope
    for (const x of [-6, -3, 0, 3, 6]) { B26.cyl(brass, x, 0.5, P.rope, 0.05, 1.0, 10); B26.cyl(brass, x, 0.03, P.rope, 0.22, 0.06, 14); }
    const ropeMat = mat(0x8a1a22, 0.8);
    for (const [a, b] of [[-6, -3], [-3, 0], [3, 6]]) { const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a, 0.95, P.rope), new THREE.Vector3((a + b) / 2, 0.7, P.rope), new THREE.Vector3(b, 0.95, P.rope)); B26.push(ropeMat, new THREE.TubeGeometry(curve, 10, 0.03, 6)); }
    W.ropeLoose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.95, P.rope), new THREE.Vector3(0.9, 0.2, P.rope + 0.3), new THREE.Vector3(1.5, 0.03, P.rope + 0.6)), 10, 0.03, 6), ropeMat); g26.add(W.ropeLoose);
    W.ropeHung = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.95, P.rope), new THREE.Vector3(1.5, 0.7, P.rope), new THREE.Vector3(3, 0.95, P.rope)), 10, 0.03, 6), ropeMat); W.ropeHung.visible = false; g26.add(W.ropeHung);
    // the control console and the visitors' desk (2026)
    const [kx, , kz] = P.console;
    B26.box(mat(0xcfd4d8, 0.5, 0.2), kx - 1.6, 0, kz - 0.6, kx + 1.6, 0.95, kz + 0.6); cbox(kx - 1.6, 0, kz - 0.6, kx + 1.6, 0.95, kz + 0.6, ['2026']);
    B26.geo(mat(0x101418, 0.3), new THREE.BoxGeometry(2.6, 0.7, 0.06), [kx, 1.4, kz - 0.4], [-0.25, 0, 0]);
    W.consoleScreen = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.62, 0.01), glowMat(0x7ac8ff, 1.2)); W.consoleScreen.position.set(kx, 1.4, kz - 0.36); W.consoleScreen.rotation.x = -0.25; g26.add(W.consoleScreen);
    B26.box(mat(0x2a3a5a, 0.6), 4.4, 0, -113.6, 7.6, 1.0, -112.6); cbox(4.4, 0, -113.6, 7.6, 1.0, -112.6, ['2026']);
    plane(TEX.lab('HELIX OPEN DAY', 'Sunday 19.10.2026 · Meet the ring that remembers'), 6.0, 1.5, 0, 6.4, -131.6, 0, g26, 0.3);
    // open-day dressing (2026): visitor benches, a safety line round the cradle, cable trays, a press camera
    for (const x of [-6.2, -2.6, 2.6, 6.2]) { B26.box(mat(0x2a3a5a, 0.6), x - 1.2, 0.42, -109.6, x + 1.2, 0.5, -108.9); for (const sx of [-1, 1]) B26.box(M.steel, x + sx * 1.05 - 0.04, 0, -109.5, x + sx * 1.05 + 0.04, 0.42, -109.0); cbox(x - 1.2, 0, -109.6, x + 1.2, 0.5, -108.9, ['2026']); }
    const yellow = mat(0xe0b820, 0.6);
    B26.box(yellow, -4.4, 0, P.ring[2] + 1.9, 4.4, 0.012, P.ring[2] + 2.02); B26.box(yellow, -4.4, 0, P.ring[2] - 1.9, -4.28, 0.012, P.ring[2] + 2.02); B26.box(yellow, 4.28, 0, P.ring[2] - 1.9, 4.4, 0.012, P.ring[2] + 2.02);
    for (const x of [-8, 8]) { B26.box(M.steelDark, x - 0.3, 7.6, -131, x + 0.3, 7.7, -107); for (let z = -130; z <= -108; z += 4) B26.box(M.steelDark, x - 0.02, 7.7, z - 0.02, x + 0.02, 9, z + 0.02); }
    B26.cyl(dark, -4.2, 0.85, -114.8, 0.02, 1.7, 5, [0.25, 0, 0]); B26.cyl(dark, -4.2, 0.85, -114.8, 0.02, 1.7, 5, [-0.25, 0, 0.22]); B26.box(dark, -4.42, 1.64, -114.95, -3.98, 1.92, -114.6); B26.cyl(mat(0x202830, 0.2, 0.6), -4.2, 1.78, -115.02, 0.08, 0.18, 12, [PI / 2, 0, 0]);
    // observation window (2026) high on the east wall
    B26.box(glass, 11.6, 3.4, -124, 11.7, 5.6, -110); B26.box(M.steel, 11.5, 3.3, -124, 11.7, 3.4, -110); B26.box(M.steel, 11.5, 5.6, -124, 11.7, 5.7, -110);
    for (const [x, z] of [[-7, -112], [7, -112], [-7, -126], [7, -126], [0, -116]]) { src(x, 8.4, z, 0xf4f8ff, 6, 16, '2026'); B26.box(white26, x - 1.2, 8.96, z - 0.2, x + 1.2, 9.0, z + 0.2); }
    // 2196: Room 0001. The empty cradle, the master lens in it, his first desk, notes on the walls, a cot
    const master = lensMesh(brass, red, 1.25); master.position.set(P.master[0], 0, P.master[2]); g96.add(master); W.lenses.push(master); W.master = master;
    cbox(P.master[0] - 0.45, 0, P.master[2] - 0.45, P.master[0] + 0.45, 1.6, P.master[2] + 0.45, ['2196']);
    const [wx, , wz] = P.wDesk0;
    B96.box(M.woodDark, wx - 1.2, 0.9, wz - 0.6, wx + 1.2, 0.96, wz + 0.6); for (const sx of [-1, 1]) B96.box(M.woodDark, wx + sx * 1.1 - 0.05, 0, wz - 0.05, wx + sx * 1.1 + 0.05, 0.9, wz + 0.05);
    cbox(wx - 1.2, 0, wz - 0.6, wx + 1.2, 0.96, wz + 0.6, ['2196']);
    B96.box(paperMat, wx - 0.6, 0.96, wz - 0.3, wx - 0.1, 0.98, wz + 0.2); B96.cyl(brass, wx + 0.6, 1.1, wz, 0.2, 0.04, 16);
    W.chair0 = [wx + 0.2, 0, wz + 1.1];
    B96.box(leather, wx - 0.2, 0, wz + 0.85, wx + 0.6, 0.46, wz + 1.55); B96.box(leather, wx - 0.2, 0.46, wz + 1.45, wx + 0.6, 1.15, wz + 1.6); cbox(wx - 0.2, 0, wz + 0.85, wx + 0.6, 0.46, wz + 1.6, ['2196']);
    for (let k = 0; k < 30; k++) { const z = -129 + (k % 10) * 2.1, y = 1.4 + Math.floor(k / 10) * 0.9; B96.geo(paperMat, new THREE.PlaneGeometry(0.4, 0.55), [-11.66, y + R() * 0.2, z + R() * 0.4], [0, PI / 2, (R() - 0.5) * 0.3]); }
    B96.box(mat(0x5a4a3a, 0.95), 8.6, 0, -130.6, 10.8, 0.45, -128.8); cbox(8.6, 0, -130.6, 10.8, 0.45, -128.8, ['2196']);
    const rock = mat(0x4a4640, 0.95); for (let k = 0; k < 10; k++) B96.geo(rock, new THREE.DodecahedronGeometry(0.5 + R() * 0.7, 0), [-0.6 + (R() - 0.5) * 3, 0.3 + R() * 1.6, -106.6 + R() * 0.6], [R() * 3, R() * 3, 0]);
    src(0, 6.4, -120, 0xffa060, 3.6, 14, '2196'); src(wx, 2.2, wz, 0xff8a5a, 2.4, 7, '2196'); src(0, 1.6, -120.2, 0xff6a4a, 1.6, 6, '2196');
    // residue: where everyone stood at 08:14:00 (Residue Vision)
    W.prints = {};
    const printTex = canvasTex(128, 128, (g) => { g.fillStyle = 'rgba(255,190,120,0.9)'; for (const [x, y, rr] of [[44, 70, 18], [84, 58, 18]]) { g.beginPath(); g.ellipse(x, y, rr * 0.6, rr, 0.2, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + 2, y - rr * 1.5, rr * 0.45, rr * 0.55, 0, 0, 7); g.fill(); } }, 'm17print');
    const printMat = new THREE.MeshBasicMaterial({ map: printTex, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    for (const [k, x, z, ry] of [['mira', 0.9, -119.0, PI], ['kai', 0.3, -117.8, PI], ['rook', -7.4, -111.2, PI], ['elena', 5.8, -112.0, PI]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), printMat); m.rotation.set(-PI / 2, 0, ry); m.position.set(x, 0.03, z); m.userData.states = ['2026']; game.residue(m); scene.add(m); W.prints[k] = m;
    }
  }

  // ================= evidence objects (meshes; taken objects hide) =================
  const itemMesh = (key, kind, x, y, z, era, ry = 0) => {
    let m;
    if (kind === 'doc') { m = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.42), paperMat); }
    else if (kind === 'pass') { m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.008, 0.15), mat(0xf4f4f0, 0.6)); }
    else if (kind === 'band') { m = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 16), mat(0x2a2a2c, 0.5, 0.5)); m.rotation.x = PI / 2; }
    else if (kind === 'reel') { m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), brass); }
    else { m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), brass); }
    m.position.set(x, y, z); m.rotation.y = ry; G[era].add(m); W.items[key] = m; return m;
  };
  const [ax, az] = P.cages[0], [bx2, bz2] = P.cages[1], [cx3, cz3] = P.cages[2];
  itemMesh('run01', 'doc', ax + 0.8, 1.42, az - 0.5, '2049'); itemMesh('run00', 'doc', ax + 0.8, 1.42, az + 0.5, '2049', 0.3);
  itemMesh('green', 'doc', bx2 + 0.8, 1.42, bz2 - 0.5, '2049', -0.2); itemMesh('black', 'doc', bx2 + 0.8, 1.42, bz2 + 0.5, '2049');
  itemMesh('cert', 'doc', cx3 + 0.8, 1.42, cz3, '2049');
  // the Stacks: the passes in cell A4 (0,3), the bands in cell D2 (3,1), the reel of Mira's voice in D4 (3,3)
  const [p1x, , p1z] = P.cell(0, 3), [b1x, , b1z] = P.cell(3, 1), [r1x, , r1z] = P.cell(3, 3);
  for (const [x, z] of [[p1x, p1z], [b1x, b1z], [r1x, r1z]]) { B96.box(M.woodDark, x - 0.6, 0, z - 0.4, x + 0.6, 0.95, z + 0.4); cbox(x - 0.6, 0, z - 0.4, x + 0.6, 0.95, z + 0.4, ['2196']); src(x, 2.6, z, 0xffc080, 1.6, 5, '2196'); }
  itemMesh('pass38', 'pass', p1x - 0.25, 0.96, p1z, '2196', 0.2); itemMesh('pass26', 'pass', p1x + 0.25, 0.96, p1z, '2196', -0.3);
  itemMesh('notched', 'band', b1x - 0.25, 0.97, b1z, '2196'); itemMesh('newband', 'band', b1x + 0.25, 0.97, b1z, '2196');
  itemMesh('reel0000', 'reel', r1x, 0.98, r1z, '2196');
  itemMesh('reelCorr', 'reel', P.conc[0] + 2.2, 1.0, P.conc[2] + 0.4, '2196');
  itemMesh('reelVault', 'reel', -14.6, 0.43, -84.45, '2196');

  // ================= build =================
  for (const k of Object.keys(S)) S[k].build(k === 'common' ? scene : G[k], { cast: false });
  if (proxy.length) {
    const mg = mergeAll(proxy); const pm2 = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ visible: false })); pm2.userData.noBatch = true; scene.add(pm2); game.blocker(pm2);
  }
  // dust in the lamp light (2196)
  const dustN = low ? 220 : 600, dg = new THREE.BufferGeometry(), dp = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dp[i * 3] = (R() - 0.5) * 26; dp[i * 3 + 1] = R() * 8; dp[i * 3 + 2] = 20 - R() * 150; }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dotTex = canvasTex(32, 32, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 'm17dot', { alpha: true });
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffd0a0, map: dotTex, size: 0.016, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); g96.add(dust); W.dust = dust;

  W.update = (dt, t) => {
    for (const d of W.spin) d.rotation.y += dt * 0.05;
    W.stacks?.update(dt, t);
    if (W.ring) W.ring.userData.update(t);
    for (const l of W.lenses) { const e = l.userData.eye; if (e) e.material.emissiveIntensity = (l.userData.on ? 3.2 : 1.0) + Math.sin(t * 3) * 0.3; }
    amber.emissiveIntensity = 2.0 + Math.sin(t * 1.6) * 0.4;
    if (W.dust) { const p = W.dust.geometry.attributes.position; for (let i = 0; i < dustN; i += 7) { p.array[i * 3 + 1] += dt * 0.05; if (p.array[i * 3 + 1] > 8) p.array[i * 3 + 1] = 0; } p.needsUpdate = true; }
  };
  return W;
}

function lensMesh(brass, eyeMat, s = 1) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.2, 6), brass); const a = k / 3 * PI * 2; leg.position.set(Math.cos(a) * 0.25, 0.58, Math.sin(a) * 0.25); leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(leg); }
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.4, 16), brass); body.rotation.x = PI / 2; body.position.y = 1.2; g.add(body);
  const eye = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), eyeMat.clone()); eye.position.set(0, 1.2, 0.21); g.add(eye);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 14), brass); reel.position.set(0, 1.48, -0.05); g.add(reel);
  g.scale.setScalar(s); g.userData.eye = eye; g.userData.on = false;
  return g;
}

function mergeAll(list) {
  let n = 0, ni = 0; for (const g of list) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(n * 3), idx = new Uint32Array(ni); let o = 0, oi = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + o; oi += g.index.count; }
    else { for (let i = 0; i < g.attributes.position.count; i++) idx[oi + i] = o + i; oi += g.attributes.position.count; }
    o += g.attributes.position.count; g.dispose();
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}
