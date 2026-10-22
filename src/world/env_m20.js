// Mission 20 environment: Mira's Memory. Four places, each its own scene (north = -z, ground y = 0 unless stated).
//   THE THRESHOLD (hub)  a flagstone plaza in a still lake at the edge of the Unwritten Second, at a dusk that does not
//     end. Three doors stand on their own (Calder Row's red door 14, the Helix blast door of Test Hall Zero, an N4 bus
//     shelter from 2049) around the Loom: three concentric stone rings, four sockets each, three levers.
//   I · CALDER ROW, SUMMER 2025  a terraced street of Rain City in 2025 (2026-era build), the Varens' ground-floor flat
//     at No. 14 (hall, kitchen, children's room), the river at the end of the street, its footbridge and a gravel bar.
//     Holders: 'kai' (noon, the way Kai remembers it) and 'mira' (golden hour, the way she does).
//   II · TEST HALL ZERO, 19.10.2026  the open day: foyer, hall, the visitors, the rope, the ring, Rook's console.
//     Holders: 'kai' (the hall full of people) and 'mira' (only what she looked at; the ring sings).
//   III · WORLD 0907, RAIN CITY 2049  the evening of a world where Mira lived and Kai did not: a 2049 street in rain,
//     a tram stop, a noodle bar, the corner of Calder Row (2049) with a memorial bench, the Helix annex lab.
//     Holders: 'mira' (as she lived it) and 'gap' (the shape Kai left: no people, his absent things, the rain stopped).
// Static geometry is merged per material and per holder (env_m6 Batch through the env_m18 kit helper).
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, chronolith, Rain } from './kit.js';
import { kit, signTex, paperTex, shardMesh, TEX as TEX18 } from './env_m18.js';
import { streetKit, prop } from './props.js';
import { memoryEdge } from '../systems/memory.js';
import { registerCast, CAST } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const HAND = '"Caveat", "Segoe Print", "Bradley Hand", cursive';
const PI = Math.PI;
export { shardMesh };

// ---------------------------------------------------------------------------------------------------------------------
// Places (positions the mission script and the test use)
// ---------------------------------------------------------------------------------------------------------------------
export const P0 = {          // the Threshold
  start: [0, 0, 12.6, PI], mira: [-1.6, 0, 9.4], loom: [0, 0, 0], radius: 14.6,
  doors: [[-10.6, 0, -5.6], [0, 0, -12.2], [10.6, 0, -5.6]],
  levers: [[-4.6, 0, 7.9], [0, 0, 9.3], [4.6, 0, 7.9]], rings: [2.9, 4.5, 6.1], clock: [0, 0, 0],
  seal: [0, 0, 1.6], shard: [[-12.2, 0.9, 6.4], [11.6, 0.9, 7.8]],
};
export const P1 = {          // Calder Row, summer 2025
  start: [0, 0, 28, PI], lamp: [-5.2, 0.14, 8], bins: [-6.2, 0.14, 17.2], door14: [7, 0, 0], cupboard: [14.15, 0, 0],
  kitchen: [12.4, 0, 4.4], table: [11.4, 0, 4.0], kids: [12.4, 0, -4.2], desk: [13.9, 0, -5.6], frame: [10.6, 0, 1.2],
  bridge: [0, 0, -36], bank: [-6, -2.6, -48.6], throw: [-6, -2.6, -49.4], bar: [1.2, -2.9, -57.6], stones: [[-2.6, -2.95, -51.8], [-1.4, -2.95, -53.6], [-0.2, -2.95, -55.4]],
  pebbles: [[-9.4, -2.6, -47.4], [-4.0, -2.6, -46.8], [-11.6, -2.6, -48.8]], carving: [1.62, 0.9, -46],
  exit: [0, 0, 31.5], shards: [[-2.6, 0.5, 21.2], [10.6, -2.4, -46.4]],
};
export const P2 = {          // Test Hall Zero, 19.10.2026
  start: [0, 0, 13.2, PI], badge: [-11.2, 0.96, 10.2], list: [-11.2, 0.96, 12.8], console: [-9.2, 0, -13.6], rook: [-9.2, 0, -15.0],
  ring: [0, 3.2, -25], rope: -16.2, hook: [-2.4, 0, -16.2], listen: [0, 0, -16.9], stand: [0.55, 0, -15.5], kidKai: [0.55, 0, -15.5], kidMira: [-0.15, 0, -15.6],
  mother: [1.6, 0, -14.4], mira: [-4.4, 0, -10.4], exit: [0, 0, 15.2], shards: [[0.4, 0.5, -6.2], [12.4, 0.5, -26.4]],
};
export const P3 = {          // World 0907, Rain City 2049
  start: [3.2, 0.15, 38, PI], stop: [7.4, 0.15, 32], m907: [6.2, 0.15, 30.6], bike: [8.6, 0.15, 29.2],
  bar: [-7.0, 0.15, 12], chair: [-6.7, 0.15, 11.2], barSeat: [-6.7, 0.15, 13.2], bench: [7.3, 0.15, -9.6], benchSeat: [7.2, 0.15, -10.4],
  door: [0, 0.15, -40], reader: [2.9, 1.3, -39.6], console: [-4.6, 0.15, -53], ring: [0, 2.9, -61], ringPad: [0, 0.15, -59.6],
  pages: [[5.4, 1.02, -48.6], [6.8, 1.02, -55.4], [-7.6, 1.02, -47.4]], window: [-8.6, 7.4, -22],
  path: [
    [[4.8, 0.15, 24], [-4.6, 0.15, 19], [-6.7, 0.15, 13.2]],                     // to the noodle bar
    [[-5.2, 0.15, 6], [4.6, 0.15, -3], [7.2, 0.15, -10.4]],                       // to the bench
    [[5.0, 0.15, -22], [1.2, 0.15, -37], [0, 0.15, -42], [-3.2, 0.15, -51.8], [-4.6, 0.15, -52.0]],   // to the lab
  ],
  shards: [[-9.0, 0.6, 22.6], [8.2, 0.6, -55.2]],
};

// ---------------------------------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites). Every look carries era, sex/age and a COSTUMES.md archetype.
// ---------------------------------------------------------------------------------------------------------------------
const KID_KAI6 = { era: '2026', costume: 'kid_kai', sex: 0, height: 1.16, build: 0.8, age: 6, skin: 0xb98463, hair: 0x15100c, hairStyle: 'messy', eyes: 0x3d2a18, topType: 'tshirt', top: 0x3a5a7a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2f3a4e, shoes: 'shoes', boots: 0x3a2a1a };
const KID_MIRA9 = { era: '2026', costume: 'kid_mira', sex: 1, female: true, height: 1.3, build: 0.84, age: 9, skin: 0xd9a585, hair: 0x120d0b, hairStyle: 'bob', eyes: 0x2f4a3a, topType: 'tshirt', top: 0xb8a24a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2a3a5a, shoes: 'shoes', boots: 0x3a2a1a };
const KID_KAI7 = { era: '2026', costume: 'kid_kai', sex: 0, height: 1.22, build: 0.82, age: 7, skin: 0xb98463, hair: 0x15100c, hairStyle: 'messy', eyes: 0x3d2a18, topType: 'jacket', hood: true, top: 0x2a4a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2f3a4e, shoes: 'shoes', boots: 0x3a2a1a };
const KID_MIRA10 = { era: '2026', costume: 'kid_mira', sex: 1, female: true, height: 1.36, build: 0.84, age: 10, skin: 0xd9a585, hair: 0x120d0b, hairStyle: 'bob', eyes: 0x2f4a3a, topType: 'sweater', top: 0x6a2a3a, topKind: 'fabric', pantsType: 'trousers', pants: 0x1f2227, shoes: 'shoes', boots: 0x3a2a1a };
const MOTHER = { era: '2026', costume: 'c26_f2', sex: 1, female: true, age: 38, height: 1.68, build: 0.98, skin: 0xc8916c, hair: 0x1e1612, hairStyle: 'bob', eyes: 0x3d2a18,
  face: { jaw: -0.2, cheek: 0.35, nose: 0.05, noseWidth: 0.0, lips: 0.2, brow: 0.0, eyeSize: 0.15, faceLength: 0.1, chin: -0.1 },
  topType: 'sweater', top: 0x4a5a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes', boots: 0x2a1d14 };
export function registerM20Cast() {
  registerCast('m20kai6', { name: 'KAI, 6', role: 'Memory · Calder Row, 2025', look: { ...KID_KAI6 }, rimColor: 0xffd8a0, vp: { sex: 'm', pitch: 1.55, rate: 1.12, langs: ['en-GB', 'en-US'] } });
  registerCast('m20mira9', { name: 'MIRA, 9', role: 'Memory · Calder Row, 2025', look: { ...KID_MIRA9 }, rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 1.45, rate: 1.06, langs: ['en-GB', 'en-US'] } });
  registerCast('m20kai7', { name: 'KAI, 7', role: 'Memory · Test Hall Zero, 19.10.2026', look: { ...KID_KAI7 }, rimColor: 0xffd8a0, vp: { sex: 'm', pitch: 1.5, rate: 1.1, langs: ['en-GB', 'en-US'] } });
  registerCast('m20mira10', { name: 'MIRA, 10', role: 'Memory · Test Hall Zero, 19.10.2026', look: { ...KID_MIRA10 }, rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 1.42, rate: 1.04, langs: ['en-GB', 'en-US'] } });
  registerCast('m20mother', { name: 'ELENA VAREN', role: 'Memory · their mother', look: { ...MOTHER }, vp: { sex: 'f', pitch: 1.0, rate: 0.92, langs: ['en-GB', 'en-US'] } });
  registerCast('m20rook26', { name: 'DR. ELIAS ROOK', role: 'Memory · Test Hall Zero, 2026',
    look: { ...(CAST.rook?.look || {}), role: 'rook', era: '2026', costume: 'rook', sex: 0, age: 39, hair: 0x3a2a20, hairStyle: 'swept', wrinkles: 0.25, recede: 0.3, glasses: true,
      topType: 'jacket', top: 0x2f3542, coat: 0xe8eaec, coatKind: 'fabric', pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes' },
    vp: { sex: 'm', pitch: 0.96, rate: 1.02, langs: ['en-GB', 'en-US'] } });
  registerCast('m20mira33', { name: 'DR. MIRA VAREN', role: 'World 0907 · Helix, 2049',
    look: { ...(CAST.mira?.look || {}), role: 'mira', era: '2049', costume: 'mira', sex: 1, female: true, age: 33, hairStyle: 'tied-back', wrinkles: 0.08 },
    rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 1.02, rate: 0.98, langs: ['en-GB', 'en-US'] } });
  registerCast('m20pa', { name: 'HELIX PA · 2026', role: 'Test Hall Zero', voice: true, vp: { sex: 'f', pitch: 1.08, rate: 1.0, langs: ['en-GB', 'en-US'] } });
  registerCast('m20tram', { name: 'TRAM STOP', role: 'Rain City transit · 2049', voice: true, vp: { sex: 'f', pitch: 1.12, rate: 1.04, langs: ['en-US', 'en-GB'] } });
  registerCast('m20band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music: Mira's theme (64 BPM, felt piano and warm cello, the three notes E-B-A) and its variations per memory
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { loom: 0, urgency: 0 };
export function registerM20Themes() {
  const motif = (a, b, t, d, base, vol) => { if (b === 0) a.piano(base, t, vol, 3); if (b === 4) a.piano(base - 5, t, vol * 0.9, 3); if (b === 8) a.piano(base - 7, t, vol, 4.4); };
  registerTheme('m20-threshold', { bpm: 64, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[40, 47, 52, 56], [45, 52, 57, 60], [36, 43, 48, 52], [38, 45, 50, 54]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.014, 600); a.cello(ch[0] - 12, t, d * 16, 0.035); }
    if (bar % 2 === 0) motif(a, b, t, d, 64, 0.045);
    if (b === 12 && bar % 2) a.flute(ch[3] + 12, t, d * 4, 0.008);
    if (b === 14 && bar % 4 === 3) a.glass(76, t, 0.006);
  } });
  registerTheme('m20-childhood', { bpm: 76, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.011, 1100);
    if (b % 4 === 0) a.pluck(ch[(b >> 2) % 4] + 12, t, 0.024);
    if (b === 6 || b === 14) a.piano(ch[2] + 12, t, 0.028, 1.6);
    if (bar % 4 === 2) motif(a, b, t, d, 76, 0.03);
    if (b === 10 && bar % 2) a.flute(ch[3] + 12, t, d * 5, 0.009);
  } });
  registerTheme('m20-hide', { bpm: 96, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, root = [48, 45, 41, 43][bar % 4];
    if (b === 0) a.pad([root, root + 7, root + 12, root + 16], t, d * 16, 0.009, 1400);
    if (b % 2 === 0) a.pluck(root + 24 + [0, 4, 7, 12, 7, 4, 0, 4][(b >> 1) % 8], t, 0.018);
    if (b % 4 === 2) a.tick(t, 0.005, 4200);
    if (musicState.urgency > 0.5 && b === 8) a.glass(root + 36, t, 0.007);
  } });
  registerTheme('m20-kitchen', { bpm: 60, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.012, 700); a.cello(ch[0] - 12, t, d * 16, 0.03); }
    if (b === 4 || b === 10) a.piano(ch[(bar + b) % 4] + 12, t, 0.03, 2.4);
    if (b === 15) a.tick(t, 0.004, 1900);
  } });
  registerTheme('m20-experiment', { bpm: 84, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[40, 47, 52, 55], [40, 47, 52, 56], [38, 45, 50, 53], [36, 43, 48, 52]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.012, 420); a.cello(ch[0] - 12, t, d * 8, 0.04); }
    if (b % 4 === 0) a.tick(t, 0.01 + musicState.urgency * 0.01, 2800);
    if (b % 2 === 1 && musicState.urgency > 0.6) a.tick(t, 0.006, 5200);
    if (b === 6 && bar % 2) a.piano(ch[2] + 12, t, 0.03, 1.8);
    if (b === 12) a.glass(ch[3] + 24, t, 0.004 + musicState.urgency * 0.004);
  } });
  registerTheme('m20-singing', { bpm: 54, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) a.pad([52, 59, 64, 71], t, d * 16, 0.016, 900);
    motif(a, b, t, d, 76, 0.03);
    if (b === 12) a.glass([83, 79, 76, 71][bar % 4], t, 0.007);
  } });
  registerTheme('m20-0907', { bpm: 58, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[38, 45, 50, 57], [41, 48, 53, 60], [36, 43, 48, 55], [43, 50, 55, 62]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.013, 520); a.cello(ch[0] - 12, t, d * 16, 0.032); }
    if (b === 2 || b === 9) a.piano(ch[3] + 12, t, 0.028, 3);
    if (bar % 4 === 3) motif(a, b, t, d, 64, 0.03);
    if (b % 8 === 6) a.tick(t, 0.003, 1600);
  } });
  registerTheme('m20-gap', { bpm: 48, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) a.pad([50, 57, 62, 69], t, d * 16, 0.012, 1600);
    if (b === 8 && bar % 2) a.glass(81, t, 0.006);
    if (b === 0 && bar % 2 === 0) a.cello(38, t, d * 16, 0.025);
  } });
  registerTheme('m20-loom', { bpm: 64, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, L = musicState.loom, ch = [[40, 47, 52, 56], [45, 52, 57, 60], [36, 43, 48, 55], [38, 45, 50, 57]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.012 + L * 0.004, 500 + L * 300);
    if (L >= 1 && b === 0) a.cello(ch[0] - 12, t, d * 16, 0.03);
    if (L >= 2) motif(a, b, t, d, 64, 0.035);
    if (L >= 3 && b === 12) a.flute(ch[3] + 12, t, d * 4, 0.01);
    if (b % 4 === 2) a.tick(t, 0.004, 3000);
  } });
  registerTheme('m20-reveal', { bpm: 60, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[40, 47, 52, 59], [45, 52, 57, 64], [41, 48, 53, 60], [43, 50, 55, 62]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.017, 700); a.cello(ch[0] - 12, t, d * 16, 0.045); }
    motif(a, b, t, d, 64, 0.05);
    if (b === 12) a.cello([64, 59, 57, 59][bar % 4], t, d * 4, 0.03);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Code-drawn textures
// ---------------------------------------------------------------------------------------------------------------------
const grain = (g, w, h, n, a, seed = 3) => { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } };
const wrap = (g, text, x, y, maxW, lh) => { const words = String(text).split(' '); let line = '', yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; } if (line) g.fillText(line, x, yy); return yy; };
export const ANCHORS = { tune: { label: 'THE TUNE', glyph: '♪', color: '#e8c070' }, hand: { label: 'THE HAND', glyph: '✋', color: '#f0d8c8' }, machine: { label: 'THE MACHINE', glyph: '◯', color: '#9fe8ff' }, ending: { label: 'THE ENDING', glyph: '✕', color: '#d6a8ff' } };
export const TEX = {
  drawing: (who) => canvasTex(512, 384, (g, w, h) => {      // the crayon drawing: 'kai' -> ME · MIRA · THE MACHINE, 'mira' -> ME · KAI · THE MACHINE
    g.fillStyle = '#f4efe2'; g.fillRect(0, 0, w, h); grain(g, w, h, 900, 0.04, who.length);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const fig = (x, y, s, c) => { g.strokeStyle = c; g.lineWidth = 6; g.beginPath(); g.arc(x, y, 16 * s, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x, y + 16 * s); g.lineTo(x, y + 70 * s); g.moveTo(x - 26 * s, y + 36 * s); g.lineTo(x + 26 * s, y + 36 * s); g.moveTo(x, y + 70 * s); g.lineTo(x - 18 * s, y + 104 * s); g.moveTo(x, y + 70 * s); g.lineTo(x + 18 * s, y + 104 * s); g.stroke(); };
    fig(90, 150, who === 'kai' ? 0.9 : 1.05, who === 'kai' ? '#2a5aa0' : '#7a2a5a'); fig(170, 140, who === 'kai' ? 1.05 : 0.9, who === 'kai' ? '#7a2a5a' : '#2a5aa0');
    g.strokeStyle = '#151515'; g.lineWidth = 22; g.beginPath(); g.arc(360, 180, 90, 0, 7); g.stroke();
    g.strokeStyle = who === 'kai' ? '#3ac8e8' : '#9a7bff'; g.lineWidth = 6; g.beginPath(); g.arc(360, 180, 66, 0, 7); g.stroke();
    if (who === 'mira') { g.strokeStyle = '#9a7bff'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(360, 180, 110 + i * 14, -0.6, 0.6); g.stroke(); } }
    g.fillStyle = '#1a1a1a'; g.font = `700 30px ${HAND}`; g.textAlign = 'center';
    g.fillText('ME', 90, 300); g.fillText(who === 'kai' ? 'MIRA' : 'KAI', 170, 300); g.fillText('THE MACHINE', 360, 330);
    if (who === 'mira') { g.font = `600 24px ${HAND}`; g.fillText('it sings', 360, 60); }
  }, 'm20draw' + who),
  letter: () => paperTex('m20halden', 'HALDEN GENERAL · NEUROLOGY', ['Outpatient appointment', 'Patient: VAREN, Mira (9)', 'Referred for: recurrent auditory', 'episodes ("singing"), headaches.', 'Thursday 14 August 2025, 10:20', 'Ward 4, room 4-07 (EEG)', '', 'Please bring the child\'s diary', 'of episodes.']),
  list: () => paperTex('m20shop', 'shopping', ['milk, bread, eggs', 'plasters (Kai\'s knees)', 'crayons - the good ones', 'ask Dr about the singing', 'stamps · birthday card', '', '  - E.'], { hand: true, ink: '#1a6a3a' }),
  heights: (mira) => canvasTex(128, 512, (g, w, h) => {      // pencil marks on the kitchen door frame
    g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, w, h); grain(g, w, h, 400, 0.05, mira ? 9 : 7);
    g.strokeStyle = 'rgba(40,40,40,.85)'; g.fillStyle = '#2a2a2a'; g.lineWidth = 2; g.font = `600 15px ${HAND}`;
    const mark = (y, t) => { g.beginPath(); g.moveTo(8, y); g.lineTo(52, y); g.stroke(); g.fillText(t, 56, y + 5); };
    const ys = (m) => h - (m - 0.8) * 480;
    [[1.02, 'K 4'], [1.09, 'K 5'], [1.16, 'K 6'], [1.15, 'M 7'], [1.23, 'M 8'], [1.30, 'M 9']].forEach(([m, t]) => mark(ys(m), t));
    if (mira) { g.strokeStyle = 'rgba(120,80,200,.9)'; g.fillStyle = '#5a3aa0'; [[1.36, 'M 10'], [1.52, 'M 14'], [1.66, 'M 20'], [1.69, 'M 33'], [1.67, 'M 58']].forEach(([m, t]) => mark(ys(m), t)); }
  }, 'm20heights' + (mira ? 'm' : 'k')),
  clock: (hands) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f2ece0'; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fill(); g.strokeStyle = '#2a2622'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#2a2622'; for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; g.fillRect(128 + Math.sin(a) * 100 - 3, 128 - Math.cos(a) * 100 - 9, 6, 18); }
    if (hands) { g.strokeStyle = '#1a1612'; g.lineCap = 'round'; const hand = (a, l, wd) => { g.lineWidth = wd; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); g.stroke(); }; hand((8 + 14 / 60) / 12 * PI * 2, 60, 8); hand(14 / 60 * PI * 2, 92, 5); }
    g.fillStyle = '#1a1612'; g.beginPath(); g.arc(128, 128, 7, 0, 7); g.fill();
  }, 'm20clock' + (hands ? 'h' : 'n')),
  badge: () => canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d4a7a'; g.fillRect(0, 0, w, 34);
    g.fillStyle = '#fff'; g.font = `700 18px ${FONT}`; g.fillText('HELIX · OPEN DAY 2026', 12, 23);
    g.fillStyle = '#1b2430'; g.font = `700 28px ${FONT}`; g.fillText('K. VAREN', 14, 78); g.font = `600 17px ${FONT}`; g.fillStyle = '#4a5a6a'; g.fillText('VISITOR · AGE 7', 14, 104);
    g.fillStyle = '#c8202a'; g.font = `700 18px ${FONT}`; g.fillText('ACCOMPANIED', 14, 138);
  }, 'm20badge'),
  visitors: () => paperTex('m20visitors', 'VISITOR LIST · TEST HALL ZERO', ['08:02  E. Varen + 1 (K. Varen, 7)', '08:04  P. Lindqvist', '08:05  H. & A. Osei', '08:07  T. Brannigan (press)', '08:09  Mira Varen  age 10  ◯', '08:10  R. Achterberg', '', 'Children under 12 must be', 'accompanied at all times.']),
  console: (mira) => canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#0a1418'; g.fillRect(0, 0, w, h); g.fillStyle = '#8fe8ff'; g.font = `700 26px ${FONT}`; g.fillText('HELIX FIELD CONTROL · SITE ZERO', 20, 40);
    g.font = `600 22px ${FONT}`; g.fillStyle = '#cfefff';
    ['RUN 01 · 19.10.2026', 'START 08:14:02 · FIELD 4.1 kHz', 'COLLARS  II · IV · I', 'VISITORS BEHIND ROPE: YES', mira ? 'AUDIO PICKUP: ♪ ♪ ♪ (unexplained)' : 'OPERATOR: E. ROOK'].forEach((l, i) => g.fillText(l, 22, 92 + i * 40));
    g.strokeStyle = '#3ac8e8'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < w - 40; x += 4) g.lineTo(20 + x, 290 - Math.abs(Math.sin(x * 0.05)) * 24); g.stroke();
  }, 'm20console' + (mira ? 'm' : 'k')),
  banner: () => signTex('m20banner', [['HELIX OPEN DAY', 64, '#1b2430'], ['THE SHAPE OF TIME · 19 OCTOBER 2026', 30, '#1d4a7a']], { bg: '#f4f6f8', border: '#1d4a7a', w: 1024, h: 256 }),
  rope: () => signTex('m20rope', [['PLEASE STAY BEHIND THE ROPE', 34, '#1a1a1a'], ['DO NOT TOUCH THE ARTEFACT', 26, '#b01010']], { bg: '#e8d020', border: '#1a1a1a', h: 160 }),
  plaque: () => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#6a5030'; g.fillRect(0, 0, w, h); grain(g, w, h, 900, 0.12, 21);
    g.strokeStyle = '#c8a060'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#f0d8a0'; g.textAlign = 'center'; g.font = `700 40px ${FONT}`; g.fillText('KAI VAREN', w / 2, 76);
    g.font = `600 26px ${FONT}`; g.fillText('2019 – 2026', w / 2, 116); g.font = `600 30px ${HAND}`; g.fillText('Count the splashes,', w / 2, 168); g.fillText('not the sinking.', w / 2, 204);
  }, 'm20plaque'),
  console907: () => canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#100a18'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8b4ff'; g.font = `700 26px ${FONT}`; g.fillText('HELIX · RECOVERY PROTOCOL', 20, 40);
    g.font = `600 22px ${FONT}`; g.fillStyle = '#e8deff';
    ['OPERATOR: M. VAREN', 'RUN 0907 · 14.11.2049 · 23:40', 'TARGET: VAREN, KAI (7)', 'LAST SIGNATURE 19.10.2026 08:14:09', 'STATUS: ARMED'].forEach((l, i) => g.fillText(l, 22, 92 + i * 40));
  }, 'm20c907'),
  page: (i) => paperTex('m20page' + i, ['Day 1', 'Day 4,018', 'Tonight'][i], [
    ['Mum says it took him at nine', 'seconds past. I was holding', 'his hand. Then I wasn\'t.', 'The rope burn is still there.'],
    ['I remember a brother who taught', 'me to skip stones. Mum says', 'I taught him. I remember both.', 'Is that what grief does?'],
    ['If I bring him back, which', 'one comes? The one I remember,', 'or the one who was?', 'Doesn\'t matter. Run at 23:40.'],
  ][i], { hand: true, ink: '#2a2058' }),
  poster: () => signTex('m20poster', [['HELIX PUBLIC LECTURE', 36, '#e8deff'], ['DR. MIRA VAREN', 54, '#ffffff'], ['"What we owe the people we lost"', 26, '#c8b4ff'], ['Thursday · 19:00 · Rain City Hall', 22, '#a898d8']], { bg: '#1a1426', border: '#9a7bff', h: 384 }),
  noodle: () => signTex('m20noodle', [['麺  HANA NOODLE  麺', 48, '#ffd8a0'], ['open till 2 · two bowls 18', 24, '#ffb070']], { bg: '#2a0e0e', border: '#ff8a4a', w: 1024, h: 192 }),
  tramBoard: () => signTex('m20tramb', [['LINE 3 · CALDER ROW', 34, '#ffd34a'], ['SUSPENDED · FLOODING', 30, '#ff6a4a'], ['N4 night bus · 23:52', 26, '#e8eef0']], { bg: '#0a0c10', border: '#ffd34a', h: 220 }),
  door: (k) => ({
    calder: signTex('m20d1', [['14', 120, '#f0e0c0']], { bg: '#8a1a1a', h: 256, w: 256, grain: true }),
    hall: signTex('m20d2', [['TEST HALL ZERO', 40, '#1a1a1a'], ['19 · 10 · 2026', 30, '#1a1a1a']], { bg: '#e8c020', border: '#1a1a1a', h: 192 }),
    rain: signTex('m20d3', [['N4 · HALDEN · NIGHT', 36, '#ffb040'], ['WORLD 0907 · 2049', 26, '#c8b4ff']], { bg: '#080808', h: 160 }),
  })[k],
  lever: (t) => signTex('m20lev' + t, [[t, 54, '#f0e0c0']], { bg: '#2a2016', border: '#c8a060', h: 160, w: 320 }),
  tablet: (anchor, title, strand) => canvasTex(256, 320, (g, w, h) => {
    const A = ANCHORS[anchor];
    g.fillStyle = '#16121e'; g.fillRect(0, 0, w, h); grain(g, w, h, 500, 0.08, title.length);
    g.strokeStyle = A.color; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = A.color; g.textAlign = 'center'; g.font = `700 64px ${FONT}`; g.fillText(A.glyph, w / 2, 92);
    g.font = `700 24px ${FONT}`; g.fillText(A.label, w / 2, 140); g.font = `600 26px ${HAND}`; g.fillStyle = '#efe6ff';
    wrap(g, title, w / 2, 190, w - 40, 30); g.font = `700 20px ${FONT}`; g.fillStyle = 'rgba(240,230,255,.6)'; g.fillText(strand, w / 2, h - 26);
  }, 'm20tab' + anchor + title),
};

// ---------------------------------------------------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------------------------------------------------
const edgeList = [];
function edge(K, w, h, x, y, z, ry, e, color) { const m = memoryEdge(w, h, { color }); m.position.set(x, y, z); m.rotation.y = ry; K.add(m, e); edgeList.push(m); return m; }
export function tickEdges(t) { for (let i = edgeList.length - 1; i >= 0; i--) { const m = edgeList[i]; if (!m.parent) { edgeList.splice(i, 1); continue; } m.userData.tick(t); } }
function pictureMat(tex, emiss = 0.25) { return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emiss, side: THREE.DoubleSide }); }
function flat(K, tex, w, h, x, y, z, rx, ry, emiss, e) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pictureMat(tex, emiss)); m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); return K.add(m, e); }

// =====================================================================================================================
// THE THRESHOLD
// =====================================================================================================================
export function buildThreshold(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low', R = rng(2000);
  const K = kit(game, scene, T, 'threshold'), { box, solid, pm, src, add, bat } = K;
  const W = { lightSrc: K.lightSrc, root: K.root, rings: [], sockets: [[], [], []], spokeLights: [], levers: [], doors: [], veils: [], float: [] };
  const M = {
    flag: pm('cutStone', { color: 0x8a8478 }), flagDark: pm('cutStone', { color: 0x4a4640 }), bronze: pm('brushedMetal', { color: 0x9a7a4a, roughness: 0.4 }),
    brick: pm('brick', { color: 0x7a4a3a }), steel: pm('paintedMetalPanel', { color: 0x6a7076, cols: 2, rows: 1, wear: 0.4, grime: 0.5, gloss: 0.4 }),
    red: pm('paintedMetalPanel', { color: 0x7a1414, cols: 1, rows: 3, wear: 0.2, grime: 0.3, gloss: 0.5 }), conc: pm('concrete', { color: 0x8a8680, formwork: 0, stains: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa8c0d0, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false }),
  };
  // the plaza: one round stone floor in the lake, a low rim
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(15.2, 15.8, 1.2, low ? 40 : 64), M.flag); floor.position.y = -0.6; floor.receiveShadow = true; add(floor);
  box(-15.2, -1.2, -15.2, 15.2, 0, 15.2);
  for (let i = 0; i < 48; i++) { const a = i / 48 * PI * 2; bat().boxc(M.flagDark, Math.sin(a) * 15.3, 0.12, Math.cos(a) * 15.3, 2.0, 0.24, 0.5, a); }
  try { const wat = RZ.water({ rect: [-110, -110, 220, 220], level: -0.45, flow: [0.02, 0.01], deep: 0x1a1428, shallow: 0x3a3048, heightAt: () => -4, chop: 0.25, waves: 0.2 }); add(wat.mesh); } catch (e) { console.warn('m20 lake', e); }
  // the Loom: three rings that turn, four sockets on each, four spokes inlaid in brass, the clock with no hands
  const ringCol = [0xffc070, 0xcfe4ff, 0x9a7bff];
  P0.rings.forEach((r, i) => {
    const g = new THREE.Group(); g.position.set(0, 0, 0); add(g);
    const ann = new THREE.Mesh(new THREE.RingGeometry(r - 0.55, r + 0.55, low ? 48 : 96), M.flagDark); ann.rotation.x = -PI / 2; ann.position.y = 0.04; ann.receiveShadow = true; g.add(ann);
    const line = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, low ? 64 : 128), glowMat(ringCol[i], 1.6)); line.rotation.x = PI / 2; line.position.y = 0.07; g.add(line);
    for (let s = 0; s < 4; s++) {
      const a = -s * PI / 2, sx = Math.sin(a) * r, sz = -Math.cos(a) * r;
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.28, 0.5), M.bronze); plinth.position.set(sx, 0.14, sz); plinth.rotation.y = a; g.add(plinth);
      const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.7), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, toneMapped: false }));
      tab.position.set(sx * 1.0, 0.62, sz * 1.0); tab.rotation.set(-0.5, a + PI, 0, 'YXZ'); tab.visible = false; tab.userData.noBatch = true; g.add(tab);
      W.sockets[i].push({ plinth, tab, a });
    }
    W.rings.push(g);
  });
  for (let s = 0; s < 4; s++) {
    const a = -s * PI / 2;
    bat().geo(M.bronze, new THREE.BoxGeometry(0.06, 0.03, 4.6), [Math.sin(a) * 4.6, 0.02, -Math.cos(a) * 4.6], [0, a, 0]);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.1, 10), glowMat(0x6a5a80, 0.6)); post.position.set(Math.sin(a) * 7.3, 0.55, -Math.cos(a) * 7.3); post.userData.noBatch = true; add(post); W.spokeLights.push(post);
  }
  bat().cyl(M.flagDark, 0, 0.45, 0, 0.75, 0.9, 24); bat().cyl(M.bronze, 0, 0.93, 0, 0.82, 0.06, 24);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.66, 40), new THREE.MeshStandardMaterial({ map: TEX.clock(false), roughness: 0.6, emissive: 0xffffff, emissiveMap: TEX.clock(false), emissiveIntensity: 0.18 }));
  face.rotation.x = -PI / 2; face.position.y = 0.97; add(face); W.clockFace = face;
  box(-0.8, 0, -0.8, 0.8, 0.95, 0.8);
  // levers: a stone post, a bronze handle that swings, a sign naming the rings it turns
  const LT = ['I · II', 'II · III', 'I · III'];
  P0.levers.forEach(([x, , z], i) => {
    solid(M.flagDark, x - 0.3, 0, z - 0.3, x + 0.3, 0.9, z + 0.3);
    const h = new THREE.Group(); h.position.set(x, 0.9, z); add(h);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.9, 10), M.bronze); arm.position.y = 0.42; h.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), glowMat(0xffc070, 1.0)); knob.position.y = 0.88; h.add(knob);
    flat(K, TEX.lever(LT[i]), 0.6, 0.3, x, 0.6, z + 0.31, 0, 0, 0.3);
    W.levers.push(h);
  });
  // three doors on their own: Calder Row 14 (brick and a red door), Test Hall Zero (blast door), the N4 shelter (2049)
  const veilCol = [0xffc890, 0xdfe8ff, 0xb8a4ff];
  P0.doors.forEach(([x, , z], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + PI; add(g);
    const B = new THREE.Group(); g.add(B);
    const part = (mat, w, h, d, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(px, py, pz); m.castShadow = true; B.add(m); return m; };
    if (i === 0) { part(M.brick, 0.9, 3.2, 0.5, -1.15, 1.6, 0); part(M.brick, 0.9, 3.2, 0.5, 1.15, 1.6, 0); part(M.brick, 3.2, 0.7, 0.5, 0, 3.55, 0); part(M.conc, 1.6, 0.16, 0.8, 0, 0.08, 0.3);
      const d = part(M.red, 0.7, 2.3, 0.06, -0.38, 1.25, -0.18); d.rotation.y = -1.1; d.position.set(-0.62, 1.25, -0.42);
      const sgn = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), pictureMat(TEX.door('calder'), 0.2)); sgn.position.set(0, 2.85, 0.26); B.add(sgn); }
    if (i === 1) { part(M.steel, 1.0, 3.6, 0.7, -1.3, 1.8, 0); part(M.steel, 1.0, 3.6, 0.7, 1.3, 1.8, 0); part(M.steel, 3.6, 0.9, 0.7, 0, 4.05, 0);
      const sgn = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), pictureMat(TEX.door('hall'), 0.25)); sgn.position.set(0, 3.98, 0.36); B.add(sgn); }
    if (i === 2) { part(M.steel, 0.1, 2.6, 0.1, -1.6, 1.3, -0.6); part(M.steel, 0.1, 2.6, 0.1, 1.6, 1.3, -0.6); part(M.steel, 3.4, 0.12, 1.4, 0, 2.64, 0);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 0.04), M.glass); gl.position.set(0, 1.3, -0.62); B.add(gl);
      const sgn = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.32), pictureMat(TEX.door('rain'), 1.1)); sgn.position.set(0, 2.9, 0.1); B.add(sgn); }
    const veil = memoryEdge(i === 1 ? 1.6 : 1.4, i === 1 ? 3.6 : 2.6, { color: veilCol[i], opacity: 0.0 }); veil.position.set(0, i === 1 ? 1.8 : 1.3, 0.02); g.add(veil); edgeList.push(veil); W.veils.push(veil);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ color: veilCol[i], transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false })); glow.rotation.x = -PI / 2; glow.position.set(0, 0.03, 0.9); g.add(glow); veil.userData.glow = glow;
    // collision: the frame's jambs (the opening itself is walkable: walking into a veil is the mission's business)
    const ca = Math.cos(g.rotation.y), sa = Math.sin(g.rotation.y);
    for (const sx of [-1.25, 1.25]) { const px = x + ca * sx, pz = z - sa * sx; box(px - 0.45, 0, pz - 0.45, px + 0.45, 3.4, pz + 0.45); }
    src(x * 0.92, 2.6, z * 0.92, veilCol[i], 2.2, 8);
    W.doors.push(g);
  });
  // floating pieces of remembered places: slabs of street, a window, a lamp post, a bench
  const floatMat = [M.flag, M.brick, M.conc, M.flagDark];
  for (let i = 0; i < (low ? 12 : 20); i++) {
    const a = R() * PI * 2, r = 24 + R() * 40, y = 4 + R() * 18, g = new THREE.Group();
    const s = 1.5 + R() * 4; const m = new THREE.Mesh(new THREE.BoxGeometry(s, 0.4 + R() * 0.8, s * (0.6 + R() * 0.8)), floatMat[i % 4]); g.add(m);
    if (i % 4 === 1) { const wdw = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), glowMat(0xffd8a0, 0.9)); wdw.position.set(0, 0.6, s * 0.3 + 0.01); g.add(wdw); }
    if (i % 5 === 2) { try { const lp = prop('lamp', { era: '2026' }); lp.scale.setScalar(0.8); lp.position.y = 0.2; g.add(lp); } catch (e) { void e; } }
    g.position.set(Math.sin(a) * r, y, Math.cos(a) * r); g.rotation.set(R() * 0.3, R() * 6, R() * 0.3); g.userData = { y, ph: R() * 6, noBatch: true };
    g.traverse(o => { o.userData.noBatch = true; }); add(g); W.float.push(g);
  }
  try { const sk = RZ.skyline({ center: [0, 0], radius: [180, 300], count: low ? 26 : 44, height: [30, 160], lit: 0.25, seed: 2019 }); const m = sk.mesh || sk; m.position.y = -2; add(m); } catch (e) { void e; }
  src(0, 3.5, 0, 0xffe0c0, 3, 14); src(0, 2.5, 9, 0xffd0a0, 2, 9);
  // shards
  W.shards = P0.shard.map(p => { const m = shardMesh(); m.position.set(...p); add(m); return m; });
  K.finish();
  W.update = (dt, t) => {
    tickEdges(t);
    for (const f of W.float) { f.position.y = f.userData.y + Math.sin(t * 0.3 + f.userData.ph) * 0.6; f.rotation.y += dt * 0.02; }
    for (const s of W.shards) s.rotation.y = t * 1.4;
  };
  return W;
}

// =====================================================================================================================
// I · CALDER ROW, SUMMER 2025
// =====================================================================================================================
export function buildCalder(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low', R = rng(2025);
  const K = kit(game, scene, T, 'calder'), { box, solid, pm, src, add, bat, plane, ground } = K;
  const W = { lightSrc: K.lightSrc, root: K.root, kai: {}, mira: {} };
  const M = {
    asphalt: pm('wetAsphalt', { color: 0x3a3c40, puddles: 0.0 }), pave: pm('ceramicTile', { color: 0x9a948a }), kerb: pm('cutStone', { color: 0xa09a90 }),
    brick: pm('brick', { color: 0x8a5a44 }), brickIn: pm('plaster', { color: 0xe8dcc8 }), floorWood: pm('wood', { color: 0x9a7048, planks: 6 }), tile: pm('ceramicTile', { color: 0xd8d0c0 }),
    wood: pm('wood', { color: 0x6a4a2a, planks: 2 }), paint: pm('paintedMetalPanel', { color: 0xe8e4da, cols: 1, rows: 1, wear: 0.1, grime: 0.1, gloss: 0.3 }),
    red: pm('paintedMetalPanel', { color: 0x8a1a1a, cols: 1, rows: 3, wear: 0.15, grime: 0.2, gloss: 0.5 }), conc: pm('concrete', { color: 0x8a8680, formwork: 0, stains: 0.6 }),
    grass: pm('grass', { color: 0x5a7a34 }), gravel: pm('gravel', { color: 0x8a8070 }), stone: pm('rock', { color: 0x7a7468 }), steel: pm('brushedMetal', { color: 0x6a6e70, roughness: 0.5 }),
    fabric: pm('wood', { color: 0x3a5a7a, planks: 1 }),
  };
  const glass = new THREE.MeshStandardMaterial({ color: 0xa8c0d0, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false });
  // ---------- the street: road, pavements, kerbs (both holders) ----------
  solid(M.asphalt, -4, -0.6, -36, 4, 0, 34); solid(M.pave, -7, -0.6, -36, -4, 0.14, 34); solid(M.pave, 4, -0.6, -36, 7, 0.14, 34);
  try {
    const k = streetKit({ era: '2026', seed: 2025 });
    k.kerb([[-4, 34], [-4, -36]]).kerb([[4, -36], [4, 34]])
      .markings({ lanes: [{ from: [0, 33], to: [0, -35] }], crossings: [{ at: [0, 4.2], yaw: PI / 2, width: 8 }] })
      .scatter('lamp', [[6.4, 30], [6.4, -32]], { spacing: 16, turn: -PI / 2, y: 0.14 }).add('lamp', [-5.2, 0.14, 8], PI / 2)
      .car([-2.6, 0, 24, 0], 0).car([2.7, 0, -14, PI], PI).car([-2.6, 0, -22, 0], 0).van([2.8, 0, 22, PI], PI)
      .bins([[-6.4, 0.14, 16.4], [-6.4, 0.14, 17.4], [-6.4, 0.14, 18.4]]).benches([[6.4, 0.14, 12, -PI / 2]]).bollards([[-3.6, 0.14, -35.6], [3.6, 0.14, -35.6]]);
    add(k.build()); for (const c of k.colliders) if (c.kind !== 'lamp' || Math.abs(c.min[0] + 5.2) > 1) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2]);
    box(-5.4, 0.14, 7.8, -5.0, 6, 8.2);
  } catch (e) { console.warn('m20 street', e); }
  // ---------- the terraces (2026-era brick, painted doors) ----------
  const bld = (x0, x1, z0, z1, face, o) => {
    const yaw = face === '+x' ? PI / 2 : -PI / 2, w = z1 - z0, d = x1 - x0;
    box(x0, 0, z0, x1, o.height, z1);
    return { width: Math.abs(w), depth: Math.abs(d), position: [(x0 + x1) / 2, 0, (z0 + z1) / 2], yaw, era: '2026', groundFloor: 3.2, floorHeight: 3.0, ...o };
  };
  const L = [], walls = ['brick', 'darkBrick', 'brick', 'plaster', 'brick', 'stone'];
  let z = -36; for (let i = 0; z < 34; i++) { const w = 6.5 + R() * 2.5, z1 = Math.min(34, z + w); L.push(bld(-19, -7, z, z1, '+x', { height: 10 + R() * 3.5, seed: 200 + i, wall: walls[i % 6], faces: [i === 3 ? 'shop' : 'windows', 'blank', 'windows', 'blank'], roof: { tank: false, solar: i % 3 === 0 } })); z = z1; }
  for (const [z0, z1] of [[-36, -29], [-29, -21.5], [-21.5, -14], [-14, -7], [7, 14.5], [14.5, 22], [22, 34]]) L.push(bld(7, 19, z0, z1, '-x', { height: 10 + R() * 3, seed: 230 + z0, wall: walls[(Math.abs(z0) | 0) % 6], faces: ['windows', 'blank', 'windows', 'blank'], roof: { tank: false } }));
  try { const blk = RZ.cityBlock(L, { era: '2026', lit: 0.1, daylight: 1 }); add(blk.mesh); } catch (e) { console.warn('m20 terraces', e); }
  // ---------- No. 14: the Varens' ground-floor flat (custom house: brick front, door, two windows, three rooms) ----------
  const X0 = 7, X1 = 15, Y1 = 3.0;
  solid(M.floorWood, X0, -0.6, -7, X1, 0.02, 7);
  // front wall with door (z -0.6..0.6) and windows (kitchen z 2.6..5.4, children's room z -5.4..-2.6)
  const wallSeg = (mat, x0, x1, z0, z1, y0 = 0, y1 = Y1) => solid(mat, x0, y0, z0, x1, y1, z1);
  wallSeg(M.brick, X0, X0 + 0.3, -7, -5.4); wallSeg(M.brick, X0, X0 + 0.3, -2.6, -0.6); wallSeg(M.brick, X0, X0 + 0.3, 0.6, 2.6); wallSeg(M.brick, X0, X0 + 0.3, 5.4, 7);
  for (const [a, b] of [[-5.4, -2.6], [2.6, 5.4]]) { wallSeg(M.brick, X0, X0 + 0.3, a, b, 0, 0.9); wallSeg(M.brick, X0, X0 + 0.3, a, b, 2.3, Y1); bat().box(glass, X0 + 0.12, 0.9, a, X0 + 0.16, 2.3, b); box(X0, 0.9, a, X0 + 0.3, 2.3, b); bat().box(M.paint, X0 - 0.04, 0.86, a - 0.05, X0 + 0.34, 0.92, b + 0.05); }
  wallSeg(M.brick, X0, X0 + 0.3, -0.6, 0.6, 2.25, Y1);
  wallSeg(M.brickIn, X1 - 0.3, X1, -7, 7); wallSeg(M.brickIn, X0, X1, -7.3, -7); wallSeg(M.brickIn, X0, X1, 7, 7.3);
  // inner walls: hall z -1.2..1.2; doors to the kitchen (south) and the children's room (north) at x 10..11.2
  for (const zz of [1.2, -1.2]) { const z0 = zz > 0 ? 1.2 : -1.32, z1 = z0 + 0.12; wallSeg(M.brickIn, X0 + 0.3, 10, z0, z1); wallSeg(M.brickIn, 11.2, X1 - 0.3, z0, z1); wallSeg(M.brickIn, 10, 11.2, z0, z1, 2.2, Y1); }
  // the under-stair cupboard at the hall's end (x 13.6..14.7): in Kai's memory a closed door hung with coats
  W.kai.cupboardDoor = solid(M.wood, 13.5, 0, -1.2, 13.6, 2.2, 1.2, 'kai');
  bat('kai').box(M.fabric, 13.3, 1.2, -0.9, 13.5, 1.9, -0.3); bat('kai').box(M.red, 13.3, 1.1, 0.2, 13.5, 1.8, 0.7);
  bat('mira').box(M.wood, 13.6, 0, 1.0, 14.6, 2.2, 1.08);                                            // the cupboard door stands open
  bat().geo(M.wood, new THREE.BoxGeometry(3.4, 0.12, 2.4), [12.8, 2.3, 0], [0, 0, -0.55]);           // the underside of the stair
  // ceiling and the floor above (exterior mass), roof
  bat().box(M.brickIn, X0, Y1, -7.3, X1, Y1 + 0.2, 7.3);
  solid(M.brick, X0, Y1 + 0.2, -7.3, X1, 6.4, 7.3);
  for (const zz of [-4, 4]) { bat().box(glass, X0 - 0.02, 4.0, zz - 1.2, X0, 5.4, zz + 1.2); bat().box(M.paint, X0 - 0.06, 3.96, zz - 1.25, X0, 4.02, zz + 1.25); }
  bat().geo(M.conc, new THREE.BoxGeometry(8.6, 0.4, 15.2), [11, 6.6, 0]);
  solid(M.conc, X0 - 0.8, 0, -0.9, X0, 0.14, 0.9);                                                    // the step
  // the front door (open into the hall) and the number
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 1.1), M.red); door.position.set(X0 + 0.9, 1.1, 0.5); door.rotation.y = 1.2; add(door);
  flat(K, TEX.door('calder'), 0.26, 0.26, X0 - 0.02, 2.55, 0, 0, -PI / 2, 0.15);
  // kitchen: counter, sink, cooker, fridge, table and chairs, the clock, Mum's list on the fridge, the height marks
  solid(M.paint, 14.0, 0, 1.4, X1 - 0.3, 0.92, 6.8); bat().box(M.tile, 13.98, 0.92, 1.4, X1 - 0.3, 0.96, 6.8); bat().box(M.tile, 14.6, 0.96, 1.4, 14.7, 1.6, 6.8);
  solid(M.paint, 7.4, 0, 6.2, 8.4, 1.9, 6.95);
  solid(M.wood, 10.6, 0.72, 3.2, 12.2, 0.78, 4.8); for (const [x, zz] of [[10.7, 3.3], [12.1, 3.3], [10.7, 4.7], [12.1, 4.7]]) bat().box(M.wood, x - 0.04, 0, zz - 0.04, x + 0.04, 0.72, zz + 0.04);
  box(10.6, 0, 3.2, 12.2, 0.72, 4.8);
  for (const [x, zz] of [[10.1, 4.0], [12.7, 4.0], [11.4, 5.4]]) { bat().box(M.wood, x - 0.22, 0.44, zz - 0.22, x + 0.22, 0.48, zz + 0.22); bat().box(M.wood, x - 0.22, 0.48, zz + 0.18, x + 0.22, 0.95, zz + 0.22); }
  W.clockK = flat(K, TEX.clock(false), 0.36, 0.36, 11.4, 2.3, 6.98, 0, PI, 0.2, 'kai');
  W.clockM = flat(K, TEX.clock(true), 0.36, 0.36, 11.4, 2.3, 6.98, 0, PI, 0.25, 'mira');
  W.list = flat(K, TEX.list(), 0.2, 0.25, 7.36, 1.5, 6.5, 0, PI / 2, 0.2);
  flat(K, TEX.heights(false), 0.07, 0.5, 10.02, 1.15, 1.34, 0, 0, 0.15, 'kai'); flat(K, TEX.heights(true), 0.07, 0.5, 10.02, 1.15, 1.34, 0, 0, 0.2, 'mira');
  W.letter = flat(K, TEX.letter(), 0.21, 0.26, 11.2, 0.785, 4.1, -PI / 2, 0.3, 0.2, 'mira');
  const radio = bat('kai'); radio.box(M.steel, 14.1, 0.96, 5.6, 14.5, 1.18, 6.0);
  // the children's room: bunk bed, desk, the drawing, her drawings pinned up (her memory only), toys
  solid(M.wood, 7.5, 0, -6.9, 9.6, 0.5, -5.9); bat().box(M.fabric, 7.55, 0.5, -6.85, 9.55, 0.7, -5.95); bat().box(M.wood, 7.5, 1.6, -6.9, 9.6, 1.7, -5.9); bat().box(M.fabric, 7.55, 1.7, -6.85, 9.55, 1.85, -5.95);
  for (const [x, zz] of [[7.52, -6.88], [9.58, -6.88], [7.52, -5.92], [9.58, -5.92]]) bat().box(M.wood, x - 0.04, 0, zz - 0.04, x + 0.04, 2.0, zz + 0.04);
  solid(M.wood, 13.0, 0.72, -6.8, 14.6, 0.78, -5.6); bat().box(M.wood, 13.05, 0, -6.75, 13.12, 0.72, -5.65); bat().box(M.wood, 14.5, 0, -6.75, 14.57, 0.72, -5.65); box(13.0, 0, -6.8, 14.6, 0.72, -5.6);
  W.drawK = flat(K, TEX.drawing('kai'), 0.42, 0.32, 13.8, 0.79, -6.2, -PI / 2, 0.2, 0.2, 'kai');
  W.drawM = flat(K, TEX.drawing('mira'), 0.42, 0.32, 13.8, 0.79, -6.2, -PI / 2, -0.15, 0.25, 'mira');
  for (let i = 0; i < 5; i++) flat(K, TEX.drawing(i % 2 ? 'mira' : 'kai'), 0.42, 0.32, 9.2 + i * 0.95, 1.9 + (i % 2) * 0.35, -7.0, 0, 0, 0.2, 'mira');
  bat('kai').geo(M.red, new THREE.SphereGeometry(0.11, 12, 8), [8.6, 0.13, -3.6]);
  // practical lights inside, daylight outside
  src(11, 2.6, 4, 0xffe8c8, 2.2, 7); src(11, 2.6, -4, 0xffe8c8, 2.0, 7); src(9, 2.6, 0, 0xffe0c0, 1.2, 5);
  // ---------- the north end: the bridge over the river at street level, steps down to the bank ----------
  solid(M.conc, -1.6, -0.5, -80, 1.6, 0, -36); for (const sx of [-1.6, 1.6]) { bat().box(M.steel, sx - 0.04, 0, -80, sx + 0.04, 1.05, -36); box(sx - 0.06, 0, -80, sx + 0.06, 1.05, -36.4); }
  for (let zz = -36; zz > -80; zz -= 2) for (const sx of [-1.6, 1.6]) bat().box(M.steel, sx - 0.03, 0, zz - 0.03, sx + 0.03, 1.0, zz + 0.03);
  for (const zz of [-52, -66]) bat().box(M.conc, -1.2, -4.2, zz - 0.8, 1.2, -0.5, zz + 0.8);
  // the end of the street: low wall with a gap to the bridge; steps down to the bank on the west
  solid(M.conc, -7, 0, -36.6, -1.6, 0.9, -36); solid(M.conc, 1.6, 0, -36.6, 7, 0.9, -36);
  for (let i = 0; i < 9; i++) { const y = -0.29 * (i + 1); solid(M.conc, -9.2, y - 0.4, -36 - i * 0.9 - 0.9, -7.2, y, -36 - i * 0.9); }
  solid(M.conc, -9.6, -3, -36.6, -9.2, 0.9, -44.2); solid(M.conc, -7.2, -3, -36.6, -7.0, 0.9, -44.2);
  // the bank: a gravel path (y -2.6) between the river wall and the water, a grass strip, trees
  solid(M.gravel, -26, -3.2, -50, 26, -2.6, -44.2); solid(M.conc, -26, -3.2, -44.2, 26, 0.9, -36.6);
  solid(M.stone, -26, -4.2, -50.6, 26, -2.75, -50);
  // the riverbed (slopes away), the gravel bar under the bridge (Mira's memory: the water is lower), stepping stones
  solid(M.gravel, -40, -5.0, -82, 40, -4.4, -50.6);
  W.bar = solid(M.gravel, -0.6, -4.4, -61, 3.6, -2.95, -55.6);
  W.stones = P1.stones.map(([x, y, zz]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.55, 0.5, 9), M.stone); m.position.set(x, y - 0.2, zz); add(m, 'mira'); box(x - 0.42, -4.4, zz - 0.42, x + 0.42, y + 0.05, zz + 0.42, 'mira'); return m; });
  try {
    const wat = RZ.water({ rect: [-60, -84, 120, 34], level: -2.75, flow: [0.25, 0.02], deep: 0x14302c, shallow: 0x4a7a64, heightAt: (x, zz) => zz > -55 ? -3.6 : -4.6, chop: 0.6, waves: 0.5 });
    add(wat.mesh); W.water = wat.mesh; W.waterBase = -2.75;
  } catch (e) { console.warn('m20 river', e); }
  W.setWater = (level) => { if (W.water) W.water.position.y = level - W.waterBase; };
  // the K + M carving on the bridge's west parapet post at the bank
  const carv = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({ map: TEX18.carving(), transparent: true, roughness: 0.9, color: 0x6a5a48 }));
  carv.position.set(-1.25, -1.6, -46.8); carv.rotation.y = -PI / 2; add(carv); bat().box(M.conc, -1.2, -2.6, -47.4, 1.2, -0.5, -46.2);
  // pebbles to skip (flat stones glinting on the bank)
  W.pebbles = P1.pebbles.map(([x, y, zz]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.025, 10), new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.4, emissive: 0xfff0d0, emissiveIntensity: 0.25 })); m.position.set(x, y + 0.02, zz); m.userData.noBatch = true; add(m); return m; });
  // trees along the pavements and the bank, a grass verge
  const trees = [];
  for (const zz of [26, 12, -2, -18, -30]) trees.push({ x: zz % 2 ? -6.2 : 6.3, z: zz, scale: 0.75 + R() * 0.2 });
  for (const x of [-20, -13, 9, 17, 23]) trees.push({ x, z: -45.6 + R() * 1.2, y: -2.6, scale: 0.9 + R() * 0.3 });
  try { add(RZ.forest({ species: 'broadleaf', placements: trees, heightAt: (x, zz) => (zz < -44 ? -2.6 : 0.14), impostors: false, variants: 2, seed: 2025 })); } catch (e) { console.warn('m20 trees', e); }
  for (const t of trees) box(t.x - 0.25, t.z < -44 ? -2.6 : 0.14, t.z - 0.25, t.x + 0.25, 4, t.z + 0.25);
  ground(M.grass, -26, -44.4, 26, -44.2, -2.58);
  try { add(RZ.rocks({ placements: [[-14, -2.7, -50.2, 0.9], [8, -2.7, -50.4, 1.1], [18, -2.7, -50.1, 0.8], [-22, -2.7, -50.3, 1.2]].map(([x, y, zz, s]) => ({ x, y, z: zz, scale: s })), seed: 2026 })); } catch (e) { void e; }
  // far bank and the skyline of 2025
  solid(M.grass, -60, -3.2, -96, 60, -1.6, -80); bat().box(M.grass, -60, -1.6, -96, 60, -1.4, -80);
  try { const sk = RZ.skyline({ center: [0, -10], radius: [140, 260], count: low ? 22 : 40, height: [20, 90], lit: 0.0, seed: 2027 }); add(sk.mesh || sk); } catch (e) { void e; }
  // ---------- the edges of the memory: haze where nobody remembers ----------
  edge(K, 16, 9, 0, 4.2, 34.2, 0, null, 0xffe8d0);
  edge(K, 56, 10, 0, 2, -82, 0, null, 0xffe8d0);
  edge(K, 12, 8, -26.2, 1.2, -47, PI / 2, null, 0xffe8d0); edge(K, 12, 8, 26.2, 1.2, -47, PI / 2, null, 0xffe8d0);
  // pavement chalk (her memory): a hopscotch and a drawn ring
  const chalk = canvasTex(512, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,240,255,.85)'; g.lineWidth = 6; for (let i = 0; i < 6; i++) g.strokeRect(20 + i * 74, 70, 70, 110); g.fillStyle = 'rgba(255,240,255,.85)'; g.font = `700 40px ${HAND}`; for (let i = 0; i < 6; i++) g.fillText(String(i + 1), 46 + i * 74, 140); g.strokeStyle = 'rgba(190,160,255,.9)'; g.beginPath(); g.arc(470, 125, 36, 0, 7); g.stroke(); }, 'm20chalk');
  const ch = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), new THREE.MeshStandardMaterial({ map: chalk, transparent: true, roughness: 0.9, depthWrite: false })); ch.rotation.x = -PI / 2; ch.rotation.z = PI / 2; ch.position.set(-5.5, 0.155, 2); add(ch, 'mira');
  plane(signTex('m20calder', [['CALDER ROW', 40, '#1a1a1a'], ['RAIN CITY · W3', 20, '#3a3a3a']], { bg: '#f0ece0', border: '#1a1a1a', h: 160 }), 1.4, 0.45, -7.05, 3.2, 30, PI / 2, 0.1);
  W.shards = P1.shards.map(p => { const m = shardMesh(); m.position.set(...p); add(m); return m; });
  K.finish();
  W.update = (dt, t) => { tickEdges(t); for (const s of W.shards) s.rotation.y = t * 1.4; for (const p of W.pebbles) if (p.visible) p.material.emissiveIntensity = 0.2 + 0.15 * Math.sin(t * 3 + p.position.x); };
  return W;
}

// =====================================================================================================================
// II · TEST HALL ZERO, 19.10.2026
// =====================================================================================================================
export function buildTestHall(game, scene, T) {
  const R = rng(2026);
  const K = kit(game, scene, T, 'testhall'), { box, solid, pm, src, add, bat, plane } = K;
  const W = { lightSrc: K.lightSrc, root: K.root };
  const M = {
    floor: pm('concrete', { color: 0x9a9a96, formwork: 0, stains: 0.3, pores: 0.02 }), wall: pm('concrete', { color: 0xb8bab8, formwork: 1, stains: 0.2 }), dark: pm('concrete', { color: 0x3a3c40, formwork: 0, stains: 0.4 }),
    panel: pm('paintedMetalPanel', { color: 0xdfe3e6, cols: 4, rows: 2, wear: 0.05, grime: 0.1, gloss: 0.5 }), steel: pm('brushedMetal', { color: 0x8a8e92, roughness: 0.35 }),
    yellow: pm('paintedMetalPanel', { color: 0xd8b020, cols: 1, rows: 1, wear: 0.2, grime: 0.2, gloss: 0.5 }), desk: pm('wood', { color: 0xc8b49a, planks: 1 }), rubber: pm('rubber', { color: 0x1a1a1a }),
    red: pm('paintedMetalPanel', { color: 0x8a1a1a, cols: 1, rows: 1, wear: 0.1, grime: 0.1, gloss: 0.5 }),
  };
  const glass = new THREE.MeshStandardMaterial({ color: 0xb8c8d4, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.25, depthWrite: false });
  // shell: floor, walls, roof trusses, the foyer partition with three openings
  solid(M.floor, -16, -0.6, -36, 16, 0, 16);
  solid(M.wall, -16.4, 0, -36, -16, 11, 16); solid(M.wall, 16, 0, -36, 16.4, 11, 16); solid(M.wall, -16.4, 0, -36.4, 16.4, 11, -36); solid(M.wall, -16.4, 0, 16, 16.4, 11, 16.4);
  bat().box(M.dark, -16.4, 11, -36.4, 16.4, 11.4, 16.4);
  for (let zz = -32; zz < 14; zz += 6) { bat().box(M.steel, -16, 9.8, zz - 0.15, 16, 10.4, zz + 0.15); for (const x of [-12, -4, 4, 12]) bat().box(glowMat(0xf4f8ff, 1.6), x - 1.6, 9.7, zz - 0.12, x + 1.6, 9.78, zz + 0.12); }
  for (const [a, b] of [[-16, -12], [-8, -2], [2, 8], [12, 16]]) solid(M.panel, a, 0, 6, b, 4.2, 6.3);
  solid(M.panel, -16, 4.2, 6, 16, 6.0, 6.3);
  // foyer: the cloakroom table with badges and the visitor list, a banner, a reception desk
  solid(M.desk, -12.2, 0.9, 9.4, -10.4, 0.96, 13.6); bat().box(M.steel, -12.1, 0, 9.5, -10.5, 0.9, 13.5); box(-12.2, 0, 9.4, -10.4, 0.9, 13.6);
  W.badge = flat(K, TEX.badge(), 0.16, 0.1, P2.badge[0], 0.965, P2.badge[2], -PI / 2, 0.2, 0.25, 'kai');
  W.list = flat(K, TEX.visitors(), 0.24, 0.3, P2.list[0], 0.965, P2.list[2], -PI / 2, 0.4, 0.2, 'kai');
  plane(TEX.banner(), 7, 1.75, 0, 7.6, 6.32, 0, 0.35); plane(TEX.banner(), 7, 1.75, 0, 8.4, -35.9, 0, 0.3);
  solid(M.panel, 6, 0, 10.4, 11, 1.1, 11.4);
  // the hall: the cradle and the ring, the rope line, the console desk, a visitors' rail
  const ring = chronolith(1.2, { color: 0x5fe6ff, power: 0.35 }); ring.position.set(...P2.ring); add(ring); W.ring = ring;
  solid(M.steel, -2.4, 0, -26, 2.4, 0.6, -24); bat().box(M.dark, -0.6, 0.6, -25.4, 0.6, 1.0, -24.6);
  for (let x = -7; x <= 7; x += 1.4) { bat().cyl(M.steel, x, 0.48, P2.rope, 0.035, 0.96, 8); bat().cyl(M.steel, x, 0.02, P2.rope, 0.16, 0.04, 12); }
  W.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 14, 6), new THREE.MeshStandardMaterial({ color: 0x8a1a2a, roughness: 0.7 })); W.rope.rotation.z = PI / 2; W.rope.position.set(0, 0.86, P2.rope); add(W.rope, 'kai');
  W.ribbon = new THREE.Mesh(new THREE.BoxGeometry(14, 0.06, 0.02), glowMat(0xff6a9a, 0.9)); W.ribbon.position.set(0, 0.9, P2.rope); add(W.ribbon, 'mira');
  W.hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12), M.steel); W.hook.position.set(P2.hook[0], 0.9, P2.rope); add(W.hook);
  box(-7.2, 0, P2.rope - 0.08, -0.9, 1.0, P2.rope + 0.08); box(0.9, 0, P2.rope - 0.08, 7.2, 1.0, P2.rope + 0.08);   // the rope (a gap where the children stand)
  box(-0.9, 0, P2.rope - 0.08, 0.9, 1.0, P2.rope + 0.08, 'kai');                                               // ... which Kai remembers closed
  plane(TEX.rope(), 1.2, 0.36, -4.5, 1.25, P2.rope + 0.05, 0, 0.2);
  solid(M.desk, -10.4, 0.92, -14.4, -8.0, 0.98, -12.8); bat().box(M.steel, -10.3, 0, -14.3, -8.1, 0.92, -12.9); box(-10.4, 0, -14.4, -8.0, 0.92, -12.8);
  W.screenK = flat(K, TEX.console(false), 0.9, 0.56, -9.2, 1.36, -14.36, -0.2, 0, 0.9, 'kai'); W.screenM = flat(K, TEX.console(true), 0.9, 0.56, -9.2, 1.36, -14.36, -0.2, 0, 0.9, 'mira');
  // the crowd's place in Kai's memory (a pen of bodies between the gallery and the rope), press tripods
  box(-5, 0, -13, 5, 2, -1.2, 'kai');
  for (const [x, zz] of [[9.4, -10], [10.2, -6]]) { bat('kai').cyl(M.dark, x, 1.3, zz, 0.03, 1.4, 6); bat('kai').box(M.dark, x - 0.15, 1.95, zz - 0.25, x + 0.15, 2.2, zz + 0.1); }
  // what Mira did not look at: haze walls over the side aisles (her memory is a corridor: gallery, rope, ring)
  box(-16, 0, -36, -6.4, 4, 6, 'mira'); box(6.4, 0, -36, 16, 4, 6, 'mira');
  for (const s of [-1, 1]) { edge(K, 42, 9, s * 6.45, 4.5, -15, PI / 2, 'mira', 0xd8ccff); }
  edge(K, 12.8, 9, 0, 4.5, -33, 0, 'mira', 0xd8ccff);
  // lights: strip lights (Kai), the ring's violet (Mira)
  src(0, 8, -22, 0xf4f8ff, 4, 20, 'kai'); src(-9, 6, -12, 0xf4f8ff, 3, 14, 'kai'); src(0, 6, 9, 0xf4f8ff, 3, 14, 'kai'); src(8, 6, -6, 0xf4f8ff, 2.5, 14, 'kai');
  src(0, 3.4, -22, 0xb09aff, 5, 16, 'mira'); src(0, 4, -8, 0xd8ccff, 2.2, 14, 'mira'); src(0, 4, 9, 0xd8ccff, 1.8, 12, 'mira');
  W.shards = P2.shards.map((p, i) => { const m = shardMesh(); m.position.set(...p); add(m, i === 0 ? 'mira' : 'kai'); return m; });
  void R; K.finish();
  W.update = (dt, t) => { tickEdges(t); ring.userData.update(t); for (const s of W.shards) s.rotation.y = t * 1.4; };
  return W;
}

// =====================================================================================================================
// III · WORLD 0907, RAIN CITY 2049
// =====================================================================================================================
export function buildRainCity(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low', R = rng(907);
  const K = kit(game, scene, T, 'w0907'), { box, solid, pm, src, add, bat, plane } = K;
  const W = { lightSrc: K.lightSrc, root: K.root };
  const M = {
    asphalt: pm('wetAsphalt', { color: 0x26282c, puddles: 0.9 }), pave: pm('ceramicTile', { color: 0x5a5a5c }), steel: pm('brushedMetal', { color: 0x7a7e80, roughness: 0.4 }),
    panel: pm('paintedMetalPanel', { color: 0x2a3038, cols: 3, rows: 1, wear: 0.3, grime: 0.5, gloss: 0.4 }), wood: pm('wood', { color: 0x5a3a22, planks: 3 }), conc: pm('concrete', { color: 0x6a6c6a, formwork: 1, stains: 0.6 }),
    white: pm('paintedMetalPanel', { color: 0xdfe3e6, cols: 4, rows: 2, wear: 0.05, grime: 0.1, gloss: 0.5 }), floor: pm('ceramicTile', { color: 0xc8ccd0 }),
  };
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false });
  const cyan = glowMat(0x5fe6ff, 1.6), amber = glowMat(0xffb060, 2.2), violet = glowMat(0x9a7bff, 2.0);
  // street
  solid(M.asphalt, -5, -0.6, -40, 5, 0, 44); solid(M.pave, -8.5, -0.6, -40, -5, 0.15, 44); solid(M.pave, 5, -0.6, -40, 8.5, 0.15, 44);
  solid(M.pave, 8.5, -0.6, -14, 30, 0.15, -6);                                                                      // Calder Row (2049) to the east
  try {
    const k = streetKit({ era: '2049', seed: 907 });
    k.kerb([[-5, 44], [-5, -40]]).kerb([[5, -40], [5, -14]]).kerb([[5, -6], [5, 44]])
      .markings({ lanes: [{ from: [0, 43], to: [0, -39] }], crossings: [{ at: [0, 18], yaw: PI / 2, width: 10 }, { at: [0, -2], yaw: PI / 2, width: 10 }] })
      .scatter('lamp', [[8.0, 40], [8.0, -36]], { spacing: 15, turn: -PI / 2, y: 0.15 }).scatter('lamp', [[-8.0, 36], [-8.0, -36]], { spacing: 15, turn: PI / 2, y: 0.15, offset: 7 })
      .car([-3.2, 0, 30, 0.02], 0).car([3.4, 0, 6, PI], PI).car([-3.3, 0, -18, 0], 0).van([3.3, 0, -28, PI], PI).scooter([-7.6, 0.15, 26, 0.4])
      .puddles([[-1, 28, 1.6], [2, 10, 1.4], [-2, -6, 1.8], [1.5, -24, 1.3]]).rails([[-1.6, 44], [-1.6, -40]], { embedded: true })
      .cables([[[-9, 9, 30], [9, 8.5, 28]], [[-9, 9, 0], [9, 9, -2]], [[-9, 9, -30], [9, 8.6, -31]]]).catenary([[-1.6, 44], [-1.6, -40]], { height: 6.0, spacing: 18 });
    add(k.build(), 'mira'); for (const c of k.colliders) box(c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2]);
  } catch (e) { console.warn('m20 street49', e); }
  // tram stop shelter (manual, facing -x) and the board
  const S = P3.stop;
  bat().box(M.steel, S[0] + 0.5, 0.15, S[2] - 2.2, S[0] + 0.6, 2.7, S[2] - 2.1); bat().box(M.steel, S[0] + 0.5, 0.15, S[2] + 2.1, S[0] + 0.6, 2.7, S[2] + 2.2);
  bat().box(glass, S[0] + 0.52, 0.4, S[2] - 2.1, S[0] + 0.56, 2.5, S[2] + 2.1); bat().box(M.panel, S[0] - 0.9, 2.7, S[2] - 2.3, S[0] + 0.7, 2.82, S[2] + 2.3);
  bat().box(cyan, S[0] - 0.92, 2.7, S[2] - 2.3, S[0] - 0.88, 2.74, S[2] + 2.3); box(S[0] + 0.48, 0.15, S[2] - 2.2, S[0] + 0.62, 2.7, S[2] + 2.2);
  solid(M.steel, S[0] + 0.1, 0.15, S[2] - 1.4, S[0] + 0.45, 0.6, S[2] + 1.4);
  plane(TEX.tramBoard(), 1.4, 0.6, S[0] - 0.4, 2.3, S[2] - 2.25, 0, 0.9);
  // the noodle bar (west), counter, stools, the empty chair
  const B = P3.bar;
  solid(M.wood, -8.5, 0.15, B[2] - 4.5, -8.0, 1.15, B[2] + 4.5); bat().box(M.wood, -8.1, 1.15, B[2] - 4.5, -7.6, 1.2, B[2] + 4.5);
  plane(TEX.noodle(), 5.6, 1.05, -8.4, 3.3, B[2], PI / 2, 1.2);
  bat().box(M.panel, -8.5, 2.7, B[2] - 5, -5.8, 2.82, B[2] + 5); bat().box(amber, -5.82, 2.7, B[2] - 5, -5.78, 2.74, B[2] + 5);
  for (let zz = B[2] - 3.6; zz <= B[2] + 3.6; zz += 1.2) { bat().cyl(M.steel, -7.2, 0.5, zz, 0.04, 0.7, 8); bat().cyl(M.wood, -7.2, 0.88, zz, 0.2, 0.06, 14); }
  W.bowl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.12, 14), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.3 })); W.bowl1.position.set(-7.85, 1.27, P3.barSeat[2]); add(W.bowl1, 'mira');
  W.bowl2 = W.bowl1.clone(); W.bowl2.position.set(-7.85, 1.27, P3.chair[2]); W.bowl2.visible = false; add(W.bowl2); W.bowl2.userData.states = ['mira'];
  W.chairGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16), cyan); W.chairGlow.position.set(-7.2, 0.95, P3.chair[2]); add(W.chairGlow, 'gap');
  src(-7, 2.5, B[2], 0xffb070, 3, 9, 'mira');
  // Calder Row (2049): the corner, the street sign, the memorial bench under a tree, the plaque
  const C = P3.bench;
  solid(M.wood, C[0] - 0.25, 0.15, C[2] - 1.0, C[0] + 0.25, 0.6, C[2] + 1.0); bat().box(M.wood, C[0] + 0.2, 0.6, C[2] - 1.0, C[0] + 0.28, 1.05, C[2] + 1.0);
  W.plaque = flat(K, TEX.plaque(), 0.42, 0.21, C[0] + 0.3, 0.86, C[2], 0, -PI / 2, 0.3);
  W.stone = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.025, 10), new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.4, emissive: 0x5fe6ff, emissiveIntensity: 0.0 })); W.stone.position.set(C[0], 0.62, C[2] - 0.6); W.stone.visible = false; add(W.stone);
  plane(signTex('m20calder49', [['CALDER ROW', 40, '#e8eef0'], ['W3 · HISTORIC TERRACE', 20, '#9fd8ff']], { bg: '#18202a', border: '#5fe6ff', h: 160 }), 1.4, 0.45, 8.6, 3.2, -6.2, 0, 0.6);
  try { add(RZ.forest({ species: 'broadleaf', placements: [{ x: 8.0, z: -12.6, scale: 0.8 }, { x: -7.4, z: -26, scale: 0.7 }, { x: 18, z: -13.4, scale: 0.75 }], heightAt: () => 0.15, impostors: false, variants: 2, seed: 908 })); } catch (e) { void e; }
  box(7.75, 0.15, -12.85, 8.25, 4, -12.35);
  // buildings: Rain City 2049 retrofits; the Helix annex at the north end
  const bld = (x0, x1, z0, z1, face, o) => {
    const yaw = face === '+x' ? PI / 2 : face === '-x' ? -PI / 2 : face === '+z' ? 0 : PI, w = (face === '+z' || face === '-z') ? x1 - x0 : z1 - z0, d = (face === '+z' || face === '-z') ? z1 - z0 : x1 - x0;
    if (!o.noCol) box(x0, 0, z0, x1, o.height, z1);
    return { width: Math.abs(w), depth: Math.abs(d), position: [(x0 + x1) / 2, 0, (z0 + z1) / 2], yaw, era: '2049', groundFloor: 4.2, ...o };
  };
  const L = [], walls = ['brick', 'panel', 'concrete', 'darkBrick', 'plaster', 'panel'];
  const rows = [[-40, -28], [-28, -16], [-16, 7], [7, 17], [17, 30], [30, 44]];
  rows.forEach(([a, b], i) => L.push(bld(-22, -8.5, a, b, '+x', { height: 18 + R() * 16, seed: 300 + i, wall: walls[i % 6], faces: [i === 3 ? 'blank' : 'shop', 'windows', 'blank', 'windows'], groundBlank: i === 3 ? [true, false, false, false] : undefined, led: 0.5, holo: i % 2, cables: true })));
  [[-40, -26], [-26, -14], [-6, 10], [10, 26], [26, 44]].forEach(([a, b], i) => L.push(bld(8.5, 22, a, b, '-x', { height: 16 + R() * 18, seed: 320 + i, wall: walls[(i + 2) % 6], faces: ['shop', 'windows', 'blank', 'windows'], led: 0.5, holo: 1, cables: true })));
  L.push(bld(8.5, 30, -26, -14, '+z', { noCol: true, height: 14, seed: 340, wall: 'brick', faces: ['windows', 'blank', 'blank', 'blank'], led: 0.2 })); box(8.5, 0, -26, 30, 14, -14.2);
  L.push(bld(8.5, 30, -6, 6, '-z', { noCol: true, height: 13, seed: 341, wall: 'brick', faces: ['windows', 'blank', 'blank', 'blank'], led: 0.2 })); box(8.5, 0, -5.8, 30, 13, 6);
  L.push(bld(-22, 22, -76, -66, '+z', { height: 30, seed: 342, wall: 'panel', faces: ['blank', 'windows', 'windows', 'windows'], led: 0.4 }));
  try { const blk = RZ.cityBlock(L, { era: '2049', lit: 0.45, daylight: 0 }); add(blk.mesh); } catch (e) { console.warn('m20 rain city', e); }
  edge(K, 22, 10, 30.2, 3, -10, PI / 2, null, 0xc8d8ff); edge(K, 18, 10, 0, 4, 44.2, 0, null, 0xc8d8ff);
  try { const sk = RZ.skyline({ center: [0, 0], radius: [150, 280], count: low ? 30 : 52, height: [40, 180], lit: 0.7, seed: 909 }); add(sk.mesh || sk, 'mira'); } catch (e) { void e; }
  // the Helix annex: glass front at z -40 with the doors, the badge reader, the lab
  solid(M.conc, -8.5, 0, -40.4, -2.0, 7, -40); solid(M.conc, 2.0, 0, -40.4, 8.5, 7, -40); solid(M.conc, -2.0, 3.2, -40.4, 2.0, 7, -40);
  for (const sx of [-1, 1]) bat().box(glass, sx > 0 ? 2.0 : -8.5, 0.15, -40.42, sx > 0 ? 8.5 : -2.0, 3.0, -40.38);
  W.doorL = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.0, 0.08), glass); W.doorL.position.set(-1.0, 1.65, -40.2); add(W.doorL, 'mira');
  W.doorR = W.doorL.clone(); W.doorR.position.x = 1.0; add(W.doorR, 'mira');
  W.doorBox = box(-2.0, 0, -40.4, 2.0, 3.2, -40.0, 'mira');
  plane(signTex('m20helix49', [['HELIX', 64, '#e8f6ff'], ['TEMPORAL RESEARCH · ANNEX 3', 22, '#8fe8ff']], { bg: '#0a141a', border: '#5fe6ff', h: 192 }), 4.2, 1.0, 0, 4.4, -39.95, 0, 1.2);
  W.reader = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.05), cyan.clone()); W.reader.position.set(...P3.reader); add(W.reader);
  W.poster = plane(TEX.poster(), 1.0, 1.5, -6.6, 1.7, -39.95, 0, 0.8, 'mira');
  solid(M.floor, -10, -0.6, -68, 10, 0.15, -40.4);
  solid(M.white, -10.4, 0, -68, -10, 7, -40.4); solid(M.white, 10, 0, -68, 10.4, 7, -40.4); solid(M.white, -10.4, 0, -68.4, 10.4, 7, -68); bat().box(M.white, -10.4, 7, -68.4, 10.4, 7.3, -40);
  for (let zz = -64; zz < -42; zz += 5) bat().box(glowMat(0xeef4ff, 1.4), -6, 6.9, zz - 0.1, 6, 6.95, zz + 0.1);
  const ringL = chronolith(1.05, { color: 0x9a7bff, power: 0.5 }); ringL.position.set(...P3.ring); add(ringL); W.ringL = ringL;
  solid(M.steel, -2.4, 0.15, -62, 2.4, 0.6, -60.2);
  solid(M.white, -6.2, 0.15, -54, -3.4, 1.05, -52.6); W.screen907 = flat(K, TEX.console907(), 0.9, 0.56, -4.8, 1.5, -53.95, -0.2, 0, 1.0);
  for (const [x, zz] of [[5.4, -48.6], [6.8, -55.4], [-7.6, -47.4]]) solid(M.white, x - 0.8, 0.15, zz - 0.5, x + 0.8, 1.0, zz + 0.5);
  W.pages = P3.pages.map((p, i) => flat(K, TEX.page(i), 0.24, 0.3, p[0], p[1] + 0.01, p[2], -PI / 2, 0.2 * (i - 1), 0.25, 'mira'));
  // Kai's absent things (the gap): his bike at the stop, his flat's window, his badge on the reader
  const bikeG = new THREE.Group(); bikeG.position.set(...P3.bike); add(bikeG, 'gap');
  for (const zz of [-0.5, 0.5]) { const wh = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 24), cyan); wh.position.set(0, 0.35, zz); wh.rotation.y = PI / 2; bikeG.add(wh); }
  const fr = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1.0), cyan); fr.position.y = 0.62; bikeG.add(fr);
  W.bike = bikeG;
  W.window = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.7), glowMat(0x5fe6ff, 1.2)); W.window.position.set(...P3.window); W.window.rotation.y = PI / 2; add(W.window, 'gap');
  // lights: neon and lamps (2049), the lab, the ring
  for (let zz = 36; zz > -36; zz -= 15) { src(-6.8, 5.6, zz, 0xffd8a8, 3, 14, 'mira'); src(6.8, 5.6, zz - 7, 0xffd8a8, 3, 14, 'mira'); }
  src(0, 5, -50, 0xeef4ff, 3, 14); src(0, 3, -60, 0xb09aff, 4, 12); src(7, 2.4, 31, 0x9fd8ff, 2, 8, 'mira');
  for (let zz = 36; zz > -36; zz -= 18) src(0, 4, zz, 0x5fe6ff, 1.6, 16, 'gap');
  // the rain (2049); in the gap it hangs where it is
  W.rain = new Rain(low ? 2200 : 4200, 40); add(W.rain.mesh);
  W.shards = P3.shards.map((p, i) => { const m = shardMesh(); m.position.set(...p); add(m, i === 0 ? 'gap' : 'mira'); return m; });
  K.finish();
  W.update = (dt, t) => { tickEdges(t); ringL.userData.update(t); for (const s of W.shards) s.rotation.y = t * 1.4; try { W.rain.frozen = T.current === 'gap'; W.rain.update(dt, game.engine.camera); } catch (e) { void e; } };
  return W;
}
