// Mission 11 environment: Halden General Hospital, Rain City, 2049 (a fictional public hospital) and its East Wing,
// caught in localized inversion since the Zero Second. North = -z. Floor at y = 0. Static geometry is merged per
// material (env_m6 Batch); the street facades are one interior-mapped cityBlock mesh.
//   Street + forecourt (cordon, ambulance bay)  x -42..80, z 14..60
//   Lobby (glass podium, atrium)                x -14..14, z -2..14     (forward)
//   Chapel (optional)                           x -26..-14, z 0..12     (candles burn backward)
//   East corridor (hazards that return)         x 14..46,  z 1..7       (reversed)
//   Ward 4 (eight bays, the inverted tone)      x 46..72,  z -14..14    (reversed)
//   Records (census, pharmacy, archive, board)  x 46..72,  z -32..-14   (forward; the burn bin reversed)
//   Helix liaison office                        x 64..72,  z -32..-25
//   Restricted Records vault (reversing lock)   x 38..46,  z -28..-17
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng } from './kit.js';
import { streetKit } from './props.js';
import { Batch } from './env_m6.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const BAYS = [   // id, centre x, centre z (south row 4-01..4-04 west→east, north row 4-05..4-08 east→west)
  ['4-01', 48.5, 11.2], ['4-02', 53.5, 11.2], ['4-03', 58.5, 11.2], ['4-04', 63.5, 11.2],
  ['4-05', 63.5, -11.2], ['4-06', 58.5, -11.2], ['4-07', 53.5, -11.2], ['4-08', 48.5, -11.2],
];
export const P = {
  start: [-3.5, 0, 46, Math.PI],
  cordon: [0, 0, 22.4],
  guard: [2.2, 0, 21.2], raman: [-1.4, 0, 21.4],
  entrance: [0, 0, 14], bayDoor: [11.2, 0, 14],
  lobby: [0, 0, 9, Math.PI],
  eastDoor: [14, 0, 4], chapelDoor: [-14, 0, 6.5],
  corrStart: [15.6, 0, 4, Math.PI / 2], corrMid: [29.2, 0, 6.2, Math.PI / 2], corrEnd: [44.4, 0, 4, Math.PI / 2],
  wardIn: [47.6, 0, 4, Math.PI / 2],
  station: [59, 0, 0],
  bed407: [53.5, 0, -12.4], monitor407: [52.2, 1.5, -13.6],
  bellBed: [58.5, 0, 12.4], bellClock: [60.6, 2.2, 13.85],
  recDoor: [69, 0, -14],
  census: [63.6, 0, -15.0], pharmacy: [58.4, 0, -15.0], bin: [50.6, 0, -16.6], board: [57, 0, -31.7],
  office: [66.4, 0, -25], memo: [69.6, 0, -29.6], visitors: [71.4, 0, -27.4],
  lock: [46.2, 1.35, -22], vaultDoor: [46, 0, -22], vaultIn: [44.2, 0, -22, -Math.PI / 2],
  drawer: [38.6, 1.2, -20.4], terminal: [40.6, 0, -24.6],
  chapelAltar: [-25, 0, 6], candles: [-24.4, 0, 9.6], prayer: [-23.2, 0, 3.0],
};
export const SHARDS = [
  [-25.2, 1.25, 2.2, 'chapel: behind the altar rail'],
  [27.8, 0.35, 8.4, 'corridor: the alcove under the fallen panel'],
  [59.8, 0.9, 13.3, 'bay 4-03: Mr. Bell\'s bedside table'],
  [52.2, 1.15, -16.1, 'records: the burn bin'],
  [39.2, 0.5, -27.2, 'the vault: under the drawer wall'],
];

// ---------------------------------------------------------------------------------------------
// Cast (COSTUMES.md archetypes; 2049 techwear, 2026 everyday clothes for the chapel residue)
// ---------------------------------------------------------------------------------------------
export const PARAMEDIC = { era: '2049', costume: 'c49_f6', sex: 1, female: true, age: 39, height: 1.7, build: 1.05, skin: 0xb98463, hair: 0x1a120e, hairStyle: 'tied-back',
  topType: 'jacket', top: 0x8a2a2a, topKind: 'synthetic', vest: 0x2a2f36, pantsType: 'cargo', pants: 0x2a2f36, shoes: 'boots', boots: 0x141210, lod: true };
export const PARAMEDIC_M = { ...PARAMEDIC, sex: 0, female: false, age: 31, height: 1.81, build: 1.08, skin: 0xe8c0a0, hair: 0x3a2a1c, hairStyle: 'short', stubble: true };
export const EVACUEE = { era: '2049', costume: 'c49_m5', sex: 0, age: 68, height: 1.7, build: 0.96, skin: 0xd9a585, hair: 0xb8b4ae, hairStyle: 'grey-swept', glasses: true,
  topType: 'jacket', top: 0x202833, topKind: 'fabric', pantsType: 'trousers', pants: 0x23262b, shoes: 'shoes', boots: 0x141210, lod: true };
export const NURSE = { era: '2049', costume: 'c49_f2', sex: 1, female: true, age: 34, height: 1.74, build: 1.0, skin: 0x6b4029, hair: 0x0e0a08, hairStyle: 'tied-back',
  topType: 'jacket', top: 0x4a1f24, topKind: 'synthetic', pantsType: 'trousers', pants: 0x1a1d22, shoes: 'boots', boots: 0x141210, lod: true };
export const TECH_GHOST = { era: '2049', costume: 'technician', sex: 1, female: true, age: 38, height: 1.7, build: 1.02, skin: 0xf1c6a8, hair: 0x8a3a20, hairStyle: 'tied-back',
  topType: 'jacket', top: 0x2c333b, topKind: 'synthetic', vest: 0xd9781e, pantsType: 'cargo', pants: 0x2c333b, shoes: 'boots', boots: 0x2a2018, gloves: 0x1c1d1f };
export const MOTHER_2026 = { era: '2026', costume: 'c26_f2', sex: 1, female: true, age: 38, height: 1.68, build: 0.98, skin: 0xc8916c, hair: 0x1e1612, hairStyle: 'bob', eyes: 0x3d2a18,
  face: { jaw: -0.2, cheek: 0.35, nose: 0.05, noseWidth: 0.0, lips: 0.2, brow: 0.0, eyeSize: 0.15, faceLength: 0.1, chin: -0.1 },
  topType: 'jacket', top: 0x4a5a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes', boots: 0x2a1d14 };

export function registerM11Cast() {
  registerCast('raman', {
    name: 'DR. PRIYA RAMAN', role: 'Halden General · temporal medicine',
    bio: 'Forty-nine. Halden\'s consultant for "temporal trauma" since Helix put the hospital on contract. She has been outside the East Wing for three days, listening to it run backward.',
    // COSTUMES.md `helix_sci_f` variant: white technical longshell lab coat (mandarin collar) over a navy mock-neck, slim grey trousers, white tech sneakers
    look: { era: '2049', costume: 'helix_sci_f', sex: 1, female: true, age: 49, height: 1.64, build: 0.96, skin: 0x9a6a4a, hair: 0x14100e, hairStyle: 'bun', eyes: 0x2a1c14,
      face: { jaw: -0.15, cheek: 0.4, nose: 0.25, noseWidth: 0.15, lips: 0.05, brow: 0.2, eyeSize: 0.05, faceLength: 0.15, chin: 0.0 }, wrinkles: 0.35, glasses: true,
      topType: 'sweater', top: 0x1d2430, topKind: 'fabric', coat: 0xe8eaec, coatKind: 'lab', pantsType: 'trousers', pants: 0x4a4e54, shoes: 'shoes', boots: 0xe6e2da },
    rimColor: 0xbfe0ff, glow: 0x10202a, bg: 0x0a1014,
    vp: { sex: 'f', pitch: 1.0, rate: 0.98, langs: ['en-GB', 'en-IN', 'en-US'] },
  });
  registerCast('bell', {
    name: 'ARTURO BELL', role: 'Ward 4 · bay 4-03 · long-term patient',
    bio: 'Seventy-six. An orderly on Ward 4 in 2026, a patient on it now. Since 08:14 his bay has run backward: he says goodbye before he says hello.',
    // COSTUMES.md `c49_m5` (retired engineer) in ward clothes: a graphite thermal knit, charcoal trousers, soft shoes
    look: { era: '2049', costume: 'c49_m5', sex: 0, age: 76, height: 1.71, build: 0.92, skin: 0xc89a7a, hair: 0xd8d4cc, hairStyle: 'short', eyes: 0x4a3a2a, stubble: true,
      face: { jaw: 0.1, cheek: -0.1, nose: 0.4, noseWidth: 0.3, lips: -0.1, brow: 0.35, eyeSize: -0.2, faceLength: 0.25, chin: 0.15 }, wrinkles: 0.9,
      topType: 'sweater', top: 0x3b4441, topKind: 'fabric', pantsType: 'trousers', pants: 0x23262b, shoes: 'shoes', boots: 0x2a2420 },
    rimColor: 0xffd8a0, glow: 0x1a140c, bg: 0x0c0a08,
    vp: { sex: 'm', pitch: 0.78, rate: 0.86, langs: ['en-GB', 'en-US'] },
  });
  registerCast('hguard', { name: 'HALDEN SECURITY', role: 'Cordon · East Wing', look: { era: '2049', costume: 'helix_sec_2', sex: 0, age: 44, height: 1.82, build: 1.1, skin: 0xd9a585, hair: 0x2a2420, hairStyle: 'buzz',
    topType: 'uniform', top: 0x1d2a44, topKind: 'synthetic', vest: 0x1b1e23, pantsType: 'cargo', pants: 0x1b1e23, shoes: 'boots', boots: 0x141210 }, vp: { sex: 'm', pitch: 0.86, rate: 1.0, langs: ['en-GB', 'en-US'] } });
  registerCast('records', { name: 'HALDEN RECORDS', role: 'Restricted archive · automated', voice: true, vp: { sex: 'f', pitch: 1.06, rate: 0.92, langs: ['en-GB', 'en-US'] } });
  registerCast('intercom', { name: 'WARD 4 INTERCOM', role: 'Night handover · 19.10.2049', voice: true, vp: { sex: 'f', pitch: 1.12, rate: 0.94, langs: ['en-GB', 'en-US'] } });
  registerCast('mother', { name: 'ELENA VAREN', role: 'Residue · Halden chapel · 2026', look: { ...MOTHER_2026 }, vp: { sex: 'f', pitch: 1.0, rate: 0.9, langs: ['en-GB', 'en-US'] } });
  registerCast('techghost', { name: 'RESIDUE · HELIX TECHNICIAN', role: 'Restricted Records · 19.10.2049', voice: true, vp: { sex: 'f', pitch: 1.0, rate: 0.95, langs: ['en-GB', 'en-US'] } });
  registerCast('paramedic', { name: 'PARAMEDIC', role: 'Rain City EMS', look: { ...PARAMEDIC, lod: false }, vp: { sex: 'f', pitch: 1.04, rate: 1.04, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------
// Music. A minor world; the Kai & Mira motif is E-B-A (76-71-69).
//   m11-rain      the street: rain, a low pad, a dry piano cell
//   m11-lobby     clinical glass and a slow monitor tick
//   m11-inverted  reversed swells: phrases that crescendo into a cut, notes played back to front
//   m11-ward      a held pulse that thins out as Kai nears the silent bed (musicState.quiet 0..1)
//   m11-records   Kai's investigation cell: 92 BPM, dry piano, ticking that drifts
//   m11-lock      mechanism ticks, one layer per part removed (musicState.lock 0..5)
//   m11-mira      Mira: felt piano, breathy flute, warm cello, 64 BPM, the three-note motif left unresolved
// ---------------------------------------------------------------------------------------------
export const musicState = { quiet: 0, lock: 0 };
export function registerM11Themes() {
  registerTheme('m11-rain', { bpm: 62, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 60], [41, 53, 60], [43, 50, 59], [40, 52, 59]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016, 420); a.cello(ch[0] - 12, t, d * 16, 0.035); }
    if (b === 4 || b === 10) a.piano(ch[(b >> 2) % 3] + 12, t, 0.1, 3);
    if (bar % 2 === 1 && b === 13) a.piano(76, t, 0.07, 4);
    if (b % 8 === 6) a.tick(t, 0.008, 3200);
  } });
  registerTheme('m11-lobby', { bpm: 60, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([57, 64, 71], t, d * 16, 0.012, 1200); if (bar % 2 === 0) a.cello(33, t, d * 32, 0.03); }
    if (b === 0 || b === 8) a.glass(88, t, 0.008);
    if (b === 4 && bar % 2) a.piano(69, t, 0.08, 3.4);
    if (b === 12 && bar % 4 === 3) a.piano(71, t, 0.07, 3.4);
  } });
  registerTheme('m11-inverted', { bpm: 70, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    // a phrase played back to front: soft to loud, then cut to nothing on the bar line
    const mel = [69, 71, 76, 74, 72, 71, 69, 64], at = [0, 2, 4, 6, 8, 10, 12, 14], i = at.indexOf(b);
    if (i >= 0) a.glass(mel[7 - i] + 12, t, 0.004 + i * 0.0035);
    if (b === 0) { a.pad([45, 52, 57], t, d * 15, 0.006, 300); }
    if (b === 8) a.pad([45, 52, 60, 64], t, d * 7.5, 0.018, 700);
    if (b === 15 && bar % 2) a.tick(t, 0.03, 1800);
    if (b === 0 && bar % 4 === 0) a.cello(33, t, d * 14, 0.04);
  } });
  registerTheme('m11-ward', { bpm: 66, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, q = 1 - musicState.quiet;
    if (q < 0.08) return;   // at the silent bed the score is gone too
    if (b === 0 || b === 3) a.drum(t, (b ? 0.05 : 0.09) * q, 70, 38);
    if (b === 0) { a.pad([45, 48, 52], t, d * 16, 0.013 * q, 360); if (bar % 2 === 0) a.cello(33, t, d * 32, 0.04 * q); }
    if (b === 10 && bar % 2) a.glass(81, t, 0.012 * q);
    if (q > 0.5 && b === 8 && bar % 4 === 2) a.piano(64, t, 0.08 * q, 3);
  } });
  registerTheme('m11-records', { bpm: 92, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62], [40, 55, 59, 64]][bar % 4];
    a.tick(t, b % 4 === 0 ? 0.018 : 0.006, (b + bar) % 7 === 0 ? 5200 : 6400);
    if (b === 0) { a.pad(ch.slice(1), t, d * 16, 0.012, 600); a.cello(ch[0] - 12, t, d * 16, 0.035); }
    if ([0, 3, 6, 11].includes(b)) a.piano(ch[1 + ([0, 3, 6, 11].indexOf(b)) % 3] + 12, t, 0.09, 1.2);
    if (b === 14 && bar % 2) a.pluck(ch[0] + 24, t, 0.04);
  } });
  registerTheme('m11-lock', { bpm: 84, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, n = musicState.lock;
    if (b % 2 === 0) a.tick(t, b % 4 === 0 ? 0.03 : 0.012, b % 8 === 0 ? 3800 : 6000);
    if (b === 0) { a.pad([50, 53, 57], t, d * 16, 0.012, 420); a.cello(bar % 2 ? 38 : 41, t, d * 16, 0.04); }
    if (n >= 1 && (b === 4 || b === 12)) a.pluck(62 + (bar % 2) * 3, t, 0.05);
    if (n >= 2 && b === 8) a.drum(t, 0.07, 90, 40);
    if (n >= 3 && b % 4 === 2) a.glass([74, 77, 81, 77][(b >> 2)], t, 0.012);
    if (n >= 4 && b === 0 && bar % 2 === 0) a.pad([62, 65, 69, 72], t, d * 32, 0.012, 900);
  } });
  registerTheme('m11-mira', { bpm: 64, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 60], [41, 53, 60], [48, 55, 64], [43, 55, 62]][bar % 4];
    if (b === 0) { a.cello(ch[0] - 12, t, d * 16, 0.04); a.pad(ch, t, d * 16, 0.011, 520); }
    if (b === 0 || b === 6 || b === 10) a.piano(ch[[0, 6, 10].indexOf(b)] + 12, t, 0.07, 4);
    if (bar % 2 === 0) { const i = [4, 8, 12].indexOf(b); if (i >= 0) a.piano([76, 71, 69][i], t, 0.11, 5); }     // E-B-A
    if (bar % 4 === 3 && b === 8) a.flute(74, t, d * 7, 0.018);   // unresolved
    if (bar % 4 === 1 && b === 14) a.glass(88, t, 0.006);
  } });
}

// ---------------------------------------------------------------------------------------------
// Code-drawn signs and screens
// ---------------------------------------------------------------------------------------------
const lines = (g, list, x, y, size, col, lh = 1.35, weight = 600) => { g.font = `${weight} ${size}px ${FONT}`; list.forEach((l, i) => { g.fillStyle = Array.isArray(l) ? l[1] : col; g.fillText(Array.isArray(l) ? l[0] : l, x, y + i * size * lh); }); };
function screen(key, w, h, draw, tint = '#0e1a22') {   // Halden clinical UI: deep teal glass, pale rules
  return canvasTex(w, h, (g, W, H) => {
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, tint); grd.addColorStop(1, '#081014'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(160,220,230,0.35)'; g.lineWidth = 2; g.strokeRect(6, 6, W - 12, H - 12);
    g.fillStyle = 'rgba(160,220,230,0.06)'; for (let y = 0; y < H; y += 5) g.fillRect(0, y, W, 1);
    draw(g, W, H);
  }, 'm11' + key);
}
function paper(key, w, h, draw, col = '#ece6d8') {
  return canvasTex(w, h, (g, W, H) => {
    g.fillStyle = col; g.fillRect(0, 0, W, H); const r = rng(key.length * 7 + 3);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(120,100,70,${r() * 0.05})`; g.fillRect(r() * W, r() * H, 2 + r() * 30, 1 + r() * 3); }
    draw(g, W, H);
  }, 'm11' + key);
}
function plate(key, w, h, draw, bg = '#eef2f2', band = '#1f5a62') {
  return canvasTex(w, h, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = band; g.fillRect(0, 0, W, Math.max(10, H * 0.14)); draw(g, W, H); }, 'm11' + key);
}
export const TEX = {
  clockFace: () => canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#f2f4f2'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill(); g.fillStyle = '#1a2024';
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r0 = i % 5 ? 112 : 100; g.save(); g.translate(128, 128); g.rotate(a); g.fillRect(-(i % 5 ? 1 : 3), -122, i % 5 ? 2 : 6, 122 - r0); g.restore(); }
    g.font = `700 18px ${FONT}`; g.textAlign = 'center'; g.fillText('HALDEN', 128, 92);
  }, 'm11clock'),
  reception: () => plate('recep', 640, 128, (g) => { lines(g, ['RECEPTION · ADMISSIONS'], 22, 92, 50, '#163a40', 1, 700); }),
  status: () => screen('status', 640, 160, (g) => { lines(g, ['EAST WING · WARDS 4-6'], 22, 50, 26, '#9fe0e8', 1, 700); lines(g, [['STATUS: SYSTEM FAILURE · DO NOT ENTER', '#ffb0a0']], 22, 110, 26, '#fff', 1, 700); }),
  hospitalSign: () => canvasTex(1024, 192, (g, W, H) => { g.clearRect(0, 0, W, H); g.textAlign = 'center'; lines(g, ['HALDEN GENERAL'], W / 2, 118, 104, '#eaf6f8', 1, 700); lines(g, ['RAIN CITY PUBLIC HOSPITALS · EMERGENCY 24H'], W / 2, 172, 30, '#9fd8e0', 1, 600); }, 'm11hsign'),
  eastWing: () => canvasTex(512, 128, (g, W, H) => { g.clearRect(0, 0, W, H); lines(g, ['EAST WING'], 10, 82, 72, '#d8eef2', 1, 700); }, 'm11ewing'),
  wayfind: () => plate('wayfind', 768, 256, (g) => {
    lines(g, ['HALDEN GENERAL · LEVEL 0'], 20, 26, 22, '#e8f6f8', 1, 700);
    lines(g, [['→  EAST WING · WARD 4', '#163a40'], ['→  MEDICAL RECORDS', '#163a40'], ['←  CHAPEL · QUIET ROOM', '#163a40'], ['↑  RECEPTION · EMERGENCY', '#163a40']], 24, 92, 34, '#163a40', 1.32, 700);
  }),
  closed: () => plate('closed', 512, 256, (g) => {
    lines(g, ['HALDEN SECURITY'], 18, 26, 20, '#fff', 1, 700); g.fillStyle = '#b03a2e'; g.fillRect(0, 48, 512, 92);
    lines(g, ['EAST WING CLOSED'], 22, 110, 44, '#fff', 1, 700);
    lines(g, ['System failure · 19.10.2049 · 08:14', 'By order of the Helix medical liaison'], 22, 182, 24, '#1a2a2e', 1.35);
  }, '#eef0ee', '#1a2a2e'),
  chapel: () => plate('chapel', 512, 160, (g) => { lines(g, ['CHAPEL · QUIET ROOM'], 20, 96, 44, '#163a40', 1, 700); lines(g, ['All faiths and none'], 22, 136, 20, '#3a5a60'); }),
  ward: () => plate('ward', 512, 160, (g) => { lines(g, ['WARD 4'], 20, 100, 64, '#163a40', 1, 700); lines(g, ['General medicine · 8 bays'], 230, 98, 22, '#3a5a60'); }),
  records: () => plate('records', 512, 160, (g) => { lines(g, ['MEDICAL RECORDS'], 20, 96, 46, '#163a40', 1, 700); lines(g, ['Staff only · Restricted archive beyond'], 22, 136, 20, '#3a5a60'); }),
  bay: (id) => plate('bay' + id, 256, 128, (g) => { lines(g, [id], 22, 96, 64, '#163a40', 1, 700); }),
  helixOffice: () => plate('hxoff', 512, 140, (g) => { lines(g, ['HELIX MEDICAL LIAISON'], 18, 92, 36, '#1d2a36', 1, 700); }, '#e4e8ec', '#1d2a36'),
  vault: () => plate('vault', 512, 160, (g) => { lines(g, ['RESTRICTED RECORDS'], 18, 92, 44, '#1d2a36', 1, 700); lines(g, ['Helix custody · no hospital access'], 20, 136, 20, '#5a2a2a'); }, '#e4e8ec', '#1d2a36'),
  lockPlate: () => canvasTex(256, 128, (g, W, H) => {   // mirror-written: in the lock's zone the plate reads backward
    g.fillStyle = '#c8ccd0'; g.fillRect(0, 0, W, H); g.save(); g.translate(W, 0); g.scale(-1, 1);
    lines(g, ['LAST IN', 'FIRST OUT'], 20, 52, 34, '#1a1d22', 1.15, 700); g.restore();
  }, 'm11lockplate'),
  census: () => screen('census', 512, 384, (g) => {
    lines(g, ['WARD 4 · CENSUS · 22.10.2049 23:40'], 22, 40, 20, '#9fe0e8', 1.3, 700);
    lines(g, ['4-01  OSEI, R.          F 61   obs', '4-02  —', '4-03  BELL, A.          M 76   long stay', '4-04  —', '4-05  KOVAC, D.         M 44   obs', '4-06  —',
      ['4-07  UNOCCUPIED  since 19.10.2026', '#ffd8a0'], '4-08  —', '', 'Patients on ward: 3 · Beds in use: 3'], 22, 82, 18, '#dfeef0', 1.42);
  }),
  pharmacy: () => screen('pharm', 512, 384, (g) => {
    lines(g, ['DISPENSING LOG · WARD 4 · BED 4-07'], 22, 40, 19, '#9fe0e8', 1.3, 700);
    lines(g, ['Every night since 19.10.2026 · 22:00', 'Neural stabiliser, 2 mg  ·  saline  ·  sedative', 'Doses dispensed ......... 8,404', 'Doses returned unused ... 0', 'Ordered by ..... HELIX MED LIAISON', 'Countersigned .. (automatic)', '', ['Bed 4-07 is listed UNOCCUPIED.', '#ffd8a0']], 22, 84, 18, '#dfeef0', 1.45);
  }),
  sensor: () => screen('sensor', 256, 192, (g, W, H) => {
    lines(g, ['BED 4-07 · LOAD'], 14, 28, 15, '#9fe0e8', 1.3, 700);
    g.strokeStyle = 'rgba(255,216,160,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 112); g.lineTo(W - 14, 112); g.stroke();
    lines(g, ['54 kg · continuous', 'since 19.10.2026 08:14'], 14, 150, 14, '#dfeef0', 1.35);
  }),
  monitor: (silent) => screen('mon' + (silent ? 1 : 0), 256, 160, (g, W, H) => {
    lines(g, ['4-07'], 12, 26, 16, '#9fe0e8', 1, 700);
    g.strokeStyle = silent ? 'rgba(255,216,160,0.8)' : 'rgba(140,255,200,0.9)'; g.lineWidth = 2; g.beginPath();
    for (let x = 12; x < W - 12; x += 3) { const p = (x % 64) / 64; g.lineTo(x, H / 2 + (silent ? 0 : (p > 0.42 && p < 0.47 ? -40 : p > 0.47 && p < 0.52 ? 22 : 0))); }
    g.stroke(); lines(g, [silent ? '— — —' : 'HR 61'], W - 90, H - 18, 18, silent ? '#ffd8a0' : '#9fffd0', 1, 700);
  }),
  nightBook: (whole) => paper('nb' + (whole ? 1 : 0), 512, 384, (g, W, H) => {
    if (!whole) { g.fillStyle = '#1a1612'; g.fillRect(0, 0, W, H); return; }
    lines(g, ['WARD 4 · NIGHT BOOK · 19 OCT 2026'], 24, 40, 20, '#2a2a3a', 1.3, 700);
    lines(g, ['08:14  Lights failed, all bays. Back 08:15.', '08:15  Bay 7 occupied. No admission. No porter.', '            Adult woman, ~30. Calm. Asked what year it was.', '08:40  Helix liaison on the ward. Name withheld', '            at their request. File to Helix custody,', '            RESTRICTED RECORDS, drawer 4-07.', '09:05  Told to record bay 7 as empty. — S.N. Okoye'], 24, 86, 17, '#2a2a3a', 1.5, 500);
  }, '#e9e2cf'),
  memo: () => paper('memo', 512, 384, (g) => {
    g.fillStyle = '#1d2a36'; g.fillRect(0, 0, 512, 46); lines(g, ['HELIX TEMPORAL RESEARCH · INTERNAL'], 18, 30, 18, '#e8f2ff', 1, 700);
    lines(g, ['To: Halden General, Facilities', 'Re: East Wing, 19.10.2049', '', 'Classify the East Wing event as a SYSTEM FAILURE.', 'Do not open Restricted Records. Do not move', 'the occupant of 4-07. Helix will attend.', '', '— E. Rook, Programme Director · 09:02'], 22, 84, 18, '#1d2a36', 1.45);
  }, '#f0f2f4'),
  visitors: () => paper('visit', 512, 384, (g) => {
    lines(g, ['WARD 4 · VISITORS · BAY 4-07'], 22, 40, 20, '#2a2a3a', 1.3, 700);
    lines(g, ['19.10.2027  K. VAREN   brother', '19.10.2031  K. VAREN   brother', '19.10.2036  K. VAREN   brother', '19.10.2042  K. VAREN   brother', '19.10.2048  K. VAREN   brother', '', 'Desk note: "Older than the photo on his ID.', 'Same scar every year. Never signs out."'], 22, 86, 18, '#2a2a3a', 1.45, 500);
  }, '#ebe6da'),
  workOrder: () => paper('wo', 384, 384, (g) => {
    g.fillStyle = '#d9781e'; g.fillRect(0, 0, 384, 40); lines(g, ['HELIX FACILITIES · WORK ORDER'], 14, 27, 16, '#fff', 1, 700);
    lines(g, ['Restricted Records, door 1', 'Reversing lock, fitted 19.10.2049', '', 'Fit order:', ' 1  core pin', ' 2  cam plate', ' 3  lower bolt', ' 4  upper bolt', ' 5  seal ring', '', '"Inside the zone it only comes', ' apart the way it went together."'], 16, 72, 16, '#1d2a36', 1.42);
  }, '#f2efe6'),
  prayer: () => paper('prayer', 384, 288, (g) => {
    lines(g, ['Book of intentions · Oct 2026'], 18, 34, 17, '#3a2a1a', 1.3, 700);
    g.font = `italic 500 18px ${FONT}`; g.fillStyle = '#2a2018';
    ['For M., ten years old, taken in the', 'morning. They will not let us see her.', 'Kai keeps asking what time it is.', '— E.V., 19th October'].forEach((l, i) => g.fillText(l, 18, 86 + i * 34));
  }, '#efe7d4'),
  file: () => screen('file', 768, 512, (g, W) => {
    lines(g, ['HALDEN GENERAL · RESTRICTED RECORD 4-07'], 28, 50, 26, '#9fe0e8', 1.3, 700);
    g.strokeStyle = 'rgba(160,220,230,0.4)'; g.beginPath(); g.moveTo(28, 70); g.lineTo(W - 28, 70); g.stroke();
    lines(g, ['Name ............... VAREN, MIRA', 'Sex .................. F', ['Age .................. 32', '#ffd8a0'], 'Admitted ........... 19.10.2026 · 08:14', 'Ward / bay .......... 4 / 4-07', ['Record created ...... 19.10.2026', '#ffd8a0'], 'Next of kin ......... VAREN, K. (brother)', ['Date of death .......', '#ffd8a0']], 28, 122, 26, '#e8f2f4', 1.5);
    g.strokeStyle = 'rgba(255,216,160,0.7)'; g.strokeRect(330, 430, 360, 34);
    lines(g, ['INTEGRITY: TEMPORAL DISCONTINUITY'], 28, 495, 18, '#ff9a8a', 1, 700);
  }, '#0c1820'),
  board: (n) => canvasTex(768, 448, (g, W, H) => {
    g.fillStyle = '#2a3a3c'; g.fillRect(0, 0, W, H); g.fillStyle = '#d8d4c4'; g.fillRect(14, 14, W - 28, H - 28);
    lines(g, ['WARD 4 · INCIDENT BOARD'], 34, 54, 24, '#1f3a40', 1.3, 700);
    const cards = [['CENSUS', '4-07 empty since 2026'], ['BED SENSOR', '54 kg · since 08:14'], ['PHARMACY', '8,404 doses to 4-07'], ['NIGHT BOOK', 'bay 7 · name withheld']];
    cards.forEach((c, i) => { const x = 34 + (i % 2) * 360, y = 90 + Math.floor(i / 2) * 160; g.fillStyle = i < n ? '#f6f1e2' : 'rgba(0,0,0,0.08)'; g.fillRect(x, y, 330, 130); if (i < n) { lines(g, [c[0]], x + 16, y + 38, 22, '#1f3a40', 1, 700); lines(g, [c[1]], x + 16, y + 82, 20, '#3a3a3a'); } });
    g.strokeStyle = '#b03a2e'; g.lineWidth = 3; if (n >= 3) { g.beginPath(); g.moveTo(200, 160); g.lineTo(560, 330); g.moveTo(560, 160); g.lineTo(200, 330); g.stroke(); }
  }, 'm11board' + n),
  stained: () => canvasTex(256, 512, (g, W, H) => {
    const r = rng(77); g.fillStyle = '#10141a'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) { const c = ['#2a6a8a', '#8a5a2a', '#3a7a5a', '#6a3a6a', '#b08a3a'][Math.floor(r() * 5)]; g.fillStyle = c; g.fillRect(x + 2, y + 2, 28, 28); }
    g.strokeStyle = '#10141a'; g.lineWidth = 6; g.beginPath(); g.arc(W / 2, 140, 90, 0, 7); g.stroke(); g.beginPath(); g.moveTo(W / 2, 50); g.lineTo(W / 2, 480); g.stroke();
  }, 'm11stained'),
};

// ---------------------------------------------------------------------------------------------
// Rain that falls upward in front of the East Wing (the inversion is readable from the street)
// ---------------------------------------------------------------------------------------------
class RisingRain {
  constructor(count, box, color = 0xbfd8ff) {
    this.box = box; const [x0, y0, z0, x1, y1, z1] = box, r = rng(91);
    const pos = new Float32Array(count * 6); this.vel = new Float32Array(count);
    for (let i = 0; i < count; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), z = z0 + r() * (z1 - z0); pos.set([x, y, z, x + 0.02, y + 0.5, z], i * 6); this.vel[i] = 10 + r() * 7; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false }));
    this.mesh.frustumCulled = false; this.mesh.userData.noCapture = true; this.mesh.userData.noBatch = true;
  }
  update(dt) {
    if (!this.mesh.visible) return;
    const p = this.mesh.geometry.attributes.position.array, [, y0, , , y1] = this.box;
    for (let i = 0; i < this.vel.length; i++) { const o = i * 6; let y = p[o + 1] + this.vel[i] * dt; if (y > y1) y = y0; p[o + 1] = y; p[o + 4] = y + 0.5; }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------------------------
export function buildHospital(game, scene) {
  const low = RZ.getQuality() === 'low';
  const col = game.collision;
  const W = { lightSrc: [], updaters: [], hazards: [], curtains: [], bays: {}, screens: {}, movers: {} };
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const M = {
    floor: pm('ceramicTile', { color: 0xb4beba, grout: 0x9aa4a0, count: 1, gloss: 0.8, variation: 0.12, lippage: 0 }),
    floorWard: pm('ceramicTile', { color: 0x9fb2ae, grout: 0x8a9c98, count: 1, gloss: 0.75, variation: 0.1, lippage: 0 }),
    lobbyFloor: pm('ceramicTile', { color: 0xd2d0ca, grout: 0x9a9892, count: 2, gloss: 0.9, marble: 0.35, variation: 0.2 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xd4d9d4, roughness: 0.82, metalness: 0 }),
    wallWard: new THREE.MeshStandardMaterial({ color: 0xc4d2ce, roughness: 0.85, metalness: 0 }),
    wainscot: pm('paintedMetalPanel', { color: 0x4f7a7c, cols: 2, rows: 1, wear: 0.25, grime: 0.15, gloss: 0.5 }),
    ceiling: pm('paintedMetalPanel', { color: 0xd6d8d4, cols: 5, rows: 5, wear: 0.08, grime: 0.18, gloss: 0.2 }),
    steel: pm('brushedMetal', { color: 0xb8bcc0, roughness: 0.3 }),
    darkSteel: pm('brushedMetal', { color: 0x40464c, roughness: 0.42 }),
    concrete: pm('concrete', { color: 0x8c8b86, formwork: 1, stains: 0.5 }),
    pave: pm('concrete', { color: 0x6e6d6a, slabs: 1, stains: 0.6, formwork: 0, wet: 1 }),
    asphalt: pm('wetAsphalt', { color: 0x2e2f31, puddles: 0.6 }),
    wood: pm('wood', { color: 0x6a4a30, planks: 8, variation: 0.4 }),
    rubber: pm('rubber', { color: 0x1c1d1f }),
  };
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ecea, roughness: 0.45, metalness: 0.05 });
  const mattress = new THREE.MeshStandardMaterial({ color: 0x9ab8c0, roughness: 0.85 });
  const sheet = new THREE.MeshStandardMaterial({ color: 0xe6ece8, roughness: 0.9 });
  const curtain = new THREE.MeshStandardMaterial({ color: 0x7aa4a8, roughness: 0.92, side: THREE.DoubleSide });
  const seat = new THREE.MeshStandardMaterial({ color: 0x2f5a62, roughness: 0.6 });
  const deskTop = new THREE.MeshStandardMaterial({ color: 0xe4e2dc, roughness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xc8dce0, roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const ceilLight = glowMat(0xf2f8ff, 2.2), ceilWarm = glowMat(0xffe8c8, 2.0), dimLight = glowMat(0xa8c8d8, 0.7);
  const green = glowMat(0x6aff9a, 1.6), red = glowMat(0xff6a5a, 1.4), candleGlow = glowMat(0xffb060, 3.2), teal = glowMat(0x38c8c0, 1.4);
  W.M = M; W.mats = { white, glass, ceilLight, dimLight, sheet };
  const B = new Batch();
  const blk = (x0, y0, z0, x1, y1, z1, o) => col.add([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], o || {});
  const solid = (mat, x0, y0, z0, x1, y1, z1, collide = true) => { B.box(mat, x0, y0, z0, x1, y1, z1); return collide ? blk(x0, y0, z0, x1, y1, z1) : null; };
  const wallX = (z, x0, x1, h, gaps = [], mat = M.wall, t = 0.24, wain = M.wainscot) => {   // wall along x at z
    const cuts = [x0]; for (const [a, b] of gaps) cuts.push(a, b); cuts.push(x1);
    for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > 0.02) { solid(mat, cuts[i], 0, z - t / 2, cuts[i + 1], h, z + t / 2); if (wain) for (const s of [-1, 1]) B.box(wain, cuts[i], 0.1, z + s * (t / 2) - 0.015, cuts[i + 1], 1.1, z + s * (t / 2) + 0.015); }
    for (const [a, b] of gaps) B.box(mat, a, 2.5, z - t / 2, b, h, z + t / 2);
  };
  const wallZ = (x, z0, z1, h, gaps = [], mat = M.wall, t = 0.24, wain = M.wainscot) => {
    const cuts = [z0]; for (const [a, b] of gaps) cuts.push(a, b); cuts.push(z1);
    for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > 0.02) { solid(mat, x - t / 2, 0, cuts[i], x + t / 2, h, cuts[i + 1]); if (wain) for (const s of [-1, 1]) B.box(wain, x + s * (t / 2) - 0.015, 0.1, cuts[i], x + s * (t / 2) + 0.015, 1.1, cuts[i + 1]); }
    for (const [a, b] of gaps) B.box(mat, x - t / 2, 2.5, a, x + t / 2, h, b);
  };
  const room = (x0, z0, x1, z1, h, floorMat = M.floor) => {
    solid(M.concrete, x0, -0.3, z0, x1, 0, z1); B.box(floorMat, x0, 0, z0, x1, 0.01, z1);
    B.box(M.ceiling, x0, h, z0, x1, h + 0.2, z1);
  };
  const src = (x, y, z, c, i, d, zone) => W.lightSrc.push({ p: [x, y, z], c, i, d, zone });
  const plane = (tex, w, h, pos, ry = 0, emissive = 1.0, o = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: !!o.transparent, color: new THREE.Color(emissive, emissive, emissive) }));
    m.position.set(...pos); m.rotation.y = ry; if (o.rx) m.rotation.x = o.rx; scene.add(m); return m;
  };
  const lightPanel = (x, z, y, w = 1.2, d = 0.6, mat = ceilLight) => B.box(mat, x - w / 2, y - 0.03, z - d / 2, x + w / 2, y, z + d / 2);

  // ======================= THE STREET =======================
  solid(M.asphalt, -60, -0.3, 26, 100, -0.02, 42, false); blk(-60, -0.3, 26, 100, 0, 42);
  solid(M.pave, -60, -0.3, 14, 100, 0.12, 26, false); blk(-60, -0.3, 14, 100, 0.12, 26);
  solid(M.pave, -60, -0.3, 42, 100, 0.12, 48, false); blk(-60, -0.3, 42, 100, 0.12, 48);
  const kit = streetKit({ era: '2049', seed: 11 });
  kit.kerb([[-60, 26], [100, 26]]).kerb([[100, 42], [-60, 42]])
    .markings({ lanes: [{ from: [-60, 34], to: [100, 34] }], crossings: [{ at: [0, 34], yaw: 0, width: 11 }] })
    .scatter('lamp', [[-50, 25.4], [90, 25.4]], { spacing: 16, turn: Math.PI, y: 0.12 })
    .scatter('lamp', [[-46, 42.6], [90, 42.6]], { spacing: 16, turn: 0, y: 0.12, offset: 8 })
    .shelter([-18, 0.12, 43.4], 0).bins([[-9, 0.12, 24.6], [18, 0.12, 24.6], [30, 0.12, 43]])
    .bollards([[-6, 0.12, 25.2], [-3, 0.12, 25.2], [3, 0.12, 25.2], [6, 0.12, 25.2]])
    .car([-24, 0, 30, Math.PI / 2], 0).car([22, 0, 38.4, -Math.PI / 2]).van([12.4, 0.12, 19.4, 0.04])
    .puddles([[-4, 30, 1.6], [6, 37, 1.3], [16, 31, 2.0], [-20, 36, 1.4], [3, 18, 1.2]])
    .cables([[[-30, 10, 26], [30, 9.5, 42]], [[30, 10, 26], [70, 9.5, 42]]]);
  for (const x of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5]) kit.add('barrier', [x, 0.12, 22.6], 0);
  for (const x of [9.5, 13.5]) kit.add('cone', [x, 0.12, 22.4], 0);
  scene.add(kit.build()); kit.collide(game);
  // the cordon (a gap at x 0 that the guard holds) and the ambulance bay canopy
  blk(-8.8, 0, 22.3, -0.9, 1.1, 22.9); blk(0.9, 0, 22.3, 8.8, 1.1, 22.9);
  W.cordonGate = blk(-0.9, 0, 22.3, 0.9, 1.1, 22.9);
  B.box(M.concrete, 8, 4.2, 14, 17, 4.5, 21.5); for (const x of [8.4, 16.6]) solid(M.darkSteel, x - 0.15, 0, 21.1, x + 0.15, 4.2, 21.4);
  lightPanel(12.5, 17.5, 4.18, 6, 0.3, ceilWarm); src(12.5, 3.9, 17.5, 0xffd8b0, 18, 12, 'out');
  // the entrance canopy over the lobby doors
  B.box(M.concrete, -8, 4.6, 14, 8, 4.9, 19.6); for (const x of [-7.6, 7.6]) solid(M.steel, x - 0.12, 0, 19.2, x + 0.12, 4.6, 19.44);
  lightPanel(0, 18.8, 4.58, 14, 0.2, ceilLight); src(0, 4.3, 17.4, 0xe8f2ff, 22, 14, 'out');
  const sign = plane(TEX.hospitalSign(), 10.6, 2.0, [0, 5.95, 19.64], 0, 1.4, { transparent: true }); sign.material.depthWrite = false;
  B.box(M.darkSteel, -5.6, 4.9, 19.5, 5.6, 7.0, 19.58);
  plane(TEX.eastWing(), 5.2, 1.3, [30, 7.4, 14.08], 0, 1.2, { transparent: true });
  plane(TEX.closed(), 1.4, 0.7, [-3.2, 0.95, 22.95], 0, 0.9);
  // ======================= HOSPITAL BUILDINGS (facades only; the interiors are ours) =======================
  const L = [];
  const bld = (x0, x1, z0, z1, o) => ({ width: x1 - x0, depth: z1 - z0, position: [(x0 + x1) / 2, o.y ?? 0, (z0 + z1) / 2], yaw: 0, era: '2049', ...o });
  // the wings stand on our own ground floor (y 0..3.8) so their shells never cut across the interiors
  L.push(bld(-44, -14, -36, 14, { y: 3.8, height: 20, seed: 311, wall: 'concrete', floorHeight: 3.6, groundFloor: 3.6, faces: ['windows', 'windows', 'blank', 'windows'], led: 0.15, roof: { hvac: 2, antenna: 1, tank: false } }));
  L.push(bld(-14, 14, -36, 10, { y: 7.2, height: 18, seed: 312, wall: 'panel', floorHeight: 3.6, groundFloor: 3.6, faces: ['windows', 'windows', 'blank', 'windows'], led: 0.2, roof: { hvac: 1, antenna: 2, dish: 1, bulkhead: true } }));
  L.push(bld(14, 80, -36, 14, { y: 3.8, height: 28, seed: 313, wall: 'concrete', floorHeight: 3.6, groundFloor: 3.6, faces: ['windows', 'windows', 'blank', 'windows'], led: 0.1, roof: { hvac: 2, antenna: 1, tank: true } }));
  // across the street (facing north, -z)
  const across = [[-52, -30, 20, 'brick'], [-30, -10, 26, 'plaster'], [-10, 8, 18, 'darkBrick'], [8, 30, 32, 'panel'], [30, 54, 22, 'brick'], [54, 82, 28, 'concrete']];
  across.forEach(([x0, x1, h, wall], i) => L.push({ width: x1 - x0 - 0.4, depth: 14, position: [(x0 + x1) / 2, 0.12, 55.2], yaw: Math.PI, era: '2049', height: h, seed: 330 + i, wall, groundFloor: 4.2, faces: ['shop', 'windows', 'blank', 'windows'], led: 0.5, holo: i % 2, cables: true }));
  for (const [x0, x1] of across) blk(x0, 0, 48.2, x1, 30, 62);
  blk(-60, 0, 14, -44, 20, 26); blk(80, 0, 14, 100, 20, 26);   // street ends
  blk(-60, 0, 26, -58, 20, 48); blk(98, 0, 26, 100, 20, 48);
  try {
    const block = RZ.cityBlock(L, { era: '2049', lit: 0.3, daylight: 0 });
    scene.add(block.mesh); W.block = block.mesh;
    const sky = RZ.skyline({ center: [10, -10], radius: [150, 280], count: low ? 30 : 56, height: [40, 160], lit: 0.12, seed: 23 }); scene.add(sky.mesh || sky); W.skyline = sky.mesh || sky;
  } catch (e) { console.warn('m11 city', e); }
  // the frontage at ground level: lobby glazing, wing plinths, the ambulance bay door
  blk(-44, 0, 13.8, -14, 6, 14.2); blk(14, 0, 13.8, 80, 6, 14.2);
  const winBand = glowMat(0x9ab8c8, 0.35);
  for (const [x0, x1] of [[-44, -14], [14, 80]]) {
    B.box(M.concrete, x0, 0, 13.8, x1, 3.8, 14.2); B.box(M.darkSteel, x0, 3.6, 14.2, x1, 3.9, 14.5);
    for (let x = x0 + 1.4; x < x1 - 1.6; x += 3.2) { if (x > 7 && x < 18) continue; B.box(winBand, x, 1.0, 14.2, x + 2.2, 2.9, 14.24); B.box(M.darkSteel, x - 0.08, 0.92, 14.2, x + 2.28, 1.0, 14.3); }
  }
  B.box(M.concrete, -14, 6.4, 13.7, 14, 7.2, 14.4);
  for (let x = -14; x <= 14.01; x += 2.8) B.box(M.darkSteel, x - 0.06, 0, 13.86, x + 0.06, 6.4, 14.06);
  B.box(M.darkSteel, -14, 3.1, 13.88, 14, 3.24, 14.04);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(28, 6.4), glass); front.position.set(0, 3.2, 13.96); scene.add(front);
  blk(-14, 0, 13.8, -2.4, 6.4, 14.1); blk(2.4, 0, 13.8, 9.8, 6.4, 14.1); blk(12.6, 0, 13.8, 14, 6.4, 14.1);
  W.bayDoorBox = blk(9.8, 0, 13.8, 12.6, 6.4, 14.1);   // the ambulance-bay door (opens on the Brandt route)
  B.box(M.darkSteel, 9.7, 0, 14.1, 12.7, 3.0, 14.25); W.bayDoor = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.9, 0.08), M.darkSteel); W.bayDoor.position.set(11.2, 1.45, 14.3); scene.add(W.bayDoor);
  W.rain = { rise: new RisingRain(low ? 500 : 900, [16, 0, 14.6, 78, 30, 19]) }; scene.add(W.rain.rise.mesh);

  // ======================= LOBBY (x -14..14, z -2..14, atrium 6.4) =======================
  const LH = 6.4;
  room(-14, -2, 14, 14, LH, M.lobbyFloor);
  wallX(-2, -14, 14, LH);
  wallZ(-14, -2, 14, LH, [[5.4, 7.6]]);
  wallZ(14, -2, 14, LH, [[2, 6]]);
  // mezzanine along the north wall with a glass balustrade
  B.box(M.concrete, -14, 3.4, -2, 14, 3.7, 1.4); B.box(M.steel, -14, 3.7, 1.36, 14, 3.76, 1.44);
  const bal = new THREE.Mesh(new THREE.PlaneGeometry(28, 1.0), glass); bal.position.set(0, 4.2, 1.4); scene.add(bal);
  for (let x = -12; x <= 12; x += 4) lightPanel(x, 0, 3.38, 1.4, 0.4, ceilLight);
  for (const z of [5, 10]) for (let x = -10; x <= 10; x += 5) lightPanel(x, z, LH - 0.02, 1.6, 1.6, ceilLight);
  src(0, 5.8, 7.5, 0xf2f6ff, 12, 16, 'lobby'); src(-8, 3.2, 3, 0xfff0dc, 10, 10, 'lobby'); src(9, 3.2, 3, 0xe8f2ff, 10, 10, 'lobby');
  // reception desk (curved by segments)
  for (let k = 0; k < 7; k++) { const a = -0.6 + k * 0.2, cx = -6 + Math.sin(a) * 3.2, cz = 2.6 + Math.cos(a) * 1.2; B.boxc(white, cx, 0.55, cz, 1.0, 1.1, 0.5, a); B.boxc(deskTop, cx, 1.12, cz, 1.05, 0.05, 0.62, a); }
  blk(-9.6, 0, 2.6, -2.4, 1.1, 4.2);
  plane(TEX.wayfind(), 3.0, 1.0, [4.0, 4.4, 5.6], 0, 1.0); B.box(M.darkSteel, 2.6, 4.9, 5.58, 2.64, 6.4, 5.62); B.box(M.darkSteel, 5.36, 4.9, 5.58, 5.4, 6.4, 5.62);
  plane(TEX.reception(), 2.6, 0.5, [-6, 3.0, -1.86], 0, 1.0);
  B.box(M.darkSteel, -8.6, 0, -1.88, -3.4, 2.4, -1.84); for (const x of [-7.6, -4.4]) plane(TEX.status(), 1.4, 0.36, [x, 2.0, -1.8], 0, 0.8);
  // atrium columns, a dropped wheelchair, a trolley of abandoned charts
  for (const [x, z] of [[-10.8, 8.6], [11.6, 7.2], [-10.8, 0.6], [11.6, 0.4]]) { B.cyl(M.concrete, x, LH / 2, z, 0.38, LH, 20); blk(x - 0.38, 0, z - 0.38, x + 0.38, LH, z + 0.38); B.cyl(M.steel, x, 0.06, z, 0.42, 0.12, 20); }
  { const wc = new THREE.Group(); const fr = M.darkSteel; for (const sx of [-0.28, 0.28]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20), fr); w.position.set(sx, 0.32, 0); w.rotation.y = Math.PI / 2; wc.add(w); }
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.45), seat); st.position.set(0, 0.5, 0.02); wc.add(st); const bk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.05), seat); bk.position.set(0, 0.75, -0.2); wc.add(bk);
    wc.position.set(3.4, 0, 3.2); wc.rotation.set(0, 0.7, 1.35); wc.position.y = 0.3; scene.add(wc); blk(2.8, 0, 2.6, 4.0, 0.7, 3.8); }
  plane(TEX.chapel(), 1.6, 0.5, [-13.85, 2.9, 6.5], Math.PI / 2, 0.95);
  // waiting seats (three rows of linked seats)
  for (const z of [7.6, 9.4, 11.2]) for (let x = 2.4; x <= 10.4; x += 0.62) { B.boxc(seat, x, 0.45, z, 0.54, 0.08, 0.5); B.boxc(seat, x, 0.75, z + 0.24, 0.54, 0.55, 0.06, 0, -0.12); }
  for (const z of [7.6, 9.4, 11.2]) { B.box(M.darkSteel, 2.1, 0, z - 0.04, 10.7, 0.42, z + 0.04); blk(2.1, 0, z - 0.3, 10.7, 0.9, z + 0.3); }
  // vending and a water dispenser on the east wall, planters
  solid(M.darkSteel, 12.8, 0, 9.2, 13.86, 2.0, 10.6); B.box(teal, 12.78, 0.9, 9.4, 12.8, 1.8, 10.4);
  for (const [x, z] of [[-12.6, 12.6], [12.6, 12.6], [-12.6, -0.6]]) { solid(M.concrete, x - 0.5, 0, z - 0.5, x + 0.5, 0.7, z + 0.5); B.geo(new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: 0.9 }), new THREE.IcosahedronGeometry(0.62, 1), [x, 1.2, z], [0, 0, 0], [1, 1.3, 1]); }
  // the café table by the east door: a coffee that un-spills (ambient inversion leaking out)
  solid(white, 7.6, 0, 0.8, 8.6, 0.74, 1.8); B.box(deskTop, 7.5, 0.74, 0.7, 8.7, 0.78, 1.9);
  W.movers.cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 12), white); W.movers.cup.position.set(8.1, 0.84, 1.3); scene.add(W.movers.cup);
  W.movers.spill = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.1 })); W.movers.spill.rotation.x = -Math.PI / 2; W.movers.spill.position.set(8.0, 0.012, 1.9); scene.add(W.movers.spill);
  // the fallen ceiling panel blocking the east door (the inversion tutorial)
  W.movers.panel = new THREE.Group();
  const pn = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 4.4), M.ceiling); W.movers.panel.add(pn);
  const pf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 3.6), ceilLight); pf.position.set(0.1, 0.6, 0); W.movers.panel.add(pf);
  scene.add(W.movers.panel);
  W.movers.panelFrom = [12.6, 3.3, 4]; W.movers.panelTo = [13.6, 1.0, 4];
  W.panelBox = blk(13.2, 0, 1.8, 14.8, 2.4, 6.2);
  // a wall clock over the East Wing door, running backward (the first thing in the lobby that is wrong)
  const lc = new THREE.Group(); lc.position.set(13.84, 3.7, 4); lc.rotation.y = -Math.PI / 2; scene.add(lc);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ map: TEX.clockFace(), toneMapped: false, color: new THREE.Color(0.95, 0.95, 0.95) })); face.position.z = 0.02; lc.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.03, 8, 40), M.darkSteel); lc.add(rim);
  const lh = (len, w, mat) => { const h = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.012), mat); h.geometry.translate(0, len / 2 - 0.03, 0); h.position.z = 0.04; lc.add(h); return h; };
  W.movers.lobbyClock = { hr: lh(0.22, 0.03, M.darkSteel), mn: lh(0.34, 0.02, M.darkSteel), sc: lh(0.36, 0.008, red) };
  plane(TEX.status(), 2.4, 0.6, [13.84, 2.95, 9.6], -Math.PI / 2, 1.0);
  // the door frame and the reversed threshold
  B.box(M.darkSteel, 13.8, 2.5, 1.9, 14.2, 2.7, 6.1);

  // ======================= CHAPEL (x -26..-14, z 0..12) =======================
  room(-26, 0, -14, 12, 3.6, M.floor);
  wallX(0, -26, -14, 3.6, [], M.wall, 0.24, null); wallX(12, -26, -14, 3.6, [], M.wall, 0.24, null); wallZ(-26, 0, 12, 3.6, [], M.wall, 0.24, null);
  B.box(M.wood, -25.9, 0, 0.1, -14.1, 0.9, 0.16); B.box(M.wood, -25.9, 0, 11.84, -14.1, 0.9, 11.9);
  // pews face the altar (west): long along z, backrest on the east side, an aisle from the door (z 5..7.6)
  for (const x of [-21.4, -18.6, -15.8]) for (const [z0, z1] of [[1.0, 4.6], [7.8, 11.2]]) { B.box(M.wood, x - 0.25, 0.42, z0, x + 0.25, 0.48, z1); B.box(M.wood, x + 0.22, 0.48, z0, x + 0.28, 0.95, z1); B.box(M.wood, x - 0.25, 0, z0, x + 0.28, 0.42, z0 + 0.06); B.box(M.wood, x - 0.25, 0, z1 - 0.06, x + 0.28, 0.42, z1); blk(x - 0.3, 0, z0, x + 0.3, 0.95, z1); }
  solid(M.wood, -25.4, 0, 4.6, -24.4, 1.0, 7.4); B.box(sheet, -25.42, 1.0, 4.5, -24.38, 1.03, 7.5);
  solid(M.wood, -23.5, 0, 2.7, -22.9, 1.1, 3.3);
  plane(TEX.stained(), 1.6, 3.0, [-25.86, 2.3, 6], Math.PI / 2, 1.3);
  B.box(M.darkSteel, -24.9, 0, 9.1, -23.9, 0.9, 10.1);
  W.candles = [];
  const wax = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.7 });
  for (let k = 0; k < 9; k++) {
    const x = -24.75 + (k % 3) * 0.35, z = 9.25 + Math.floor(k / 3) * 0.33;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), wax); c.position.set(x, 0.9, z); c.scale.y = 0.05 + (k * 0.37 % 1) * 0.1; scene.add(c);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), candleGlow); f.scale.y = 1.8; scene.add(f);
    W.candles.push({ c, f, h: 0.05 + (k * 0.37 % 1) * 0.12, s: 0.004 + (k % 4) * 0.0015 });
  }
  src(-24.4, 1.4, 9.6, 0xffb060, 6, 7, 'chapel'); src(-20, 3.2, 6, 0xffe0c0, 9, 12, 'chapel');
  lightPanel(-20, 6, 3.58, 1.2, 1.2, ceilWarm);

  // ======================= EAST CORRIDOR (x 14..46, z 1..7, h 3.2) =======================
  const CH = 3.2;
  room(14, 1, 46, 7, CH, M.floor);
  wallX(1, 14, 46, CH, [[30.6, 33.4]]);
  wallX(7, 14, 46, CH, [[26, 30]]);
  // alcove south (shard under a fallen panel)
  room(26, 7, 30, 9.2, 2.8); wallX(9.2, 26, 30, 2.8); wallZ(26, 7, 9.2, 2.8); wallZ(30, 7, 9.2, 2.8);
  // the lab window in the north wall (the shattered glass returns into it) and the lab behind it
  room(29, -2.4, 35, 1, 3.0); wallX(-2.4, 29, 35, 3.0); wallZ(29, -2.4, 1, 3.0); wallZ(35, -2.4, 1, 3.0);
  B.box(M.darkSteel, 30.5, 0, 0.84, 33.5, 0.9, 1.16); blk(30.5, 0, 0.84, 33.5, 3.0, 1.16);
  B.box(M.darkSteel, 30.5, 2.3, 0.86, 33.5, 2.42, 1.14);
  solid(white, 30, 0, -2.2, 34, 0.9, -1.4); lightPanel(32, -0.8, 2.98, 1.2, 0.6, dimLight);
  // handrails, doors to closed rooms, signs
  for (const z of [1.16, 6.84]) B.box(M.steel, 14.2, 0.9, z - 0.03, 45.8, 0.95, z + 0.03);
  for (const [x, z] of [[19, 1.13], [24, 1.13], [38, 1.13], [43, 1.13], [19, 6.87], [36, 6.87], [41, 6.87]]) { B.box(M.darkSteel, x - 0.65, 0, z - 0.04, x + 0.65, 2.3, z + 0.04); B.box(green, x - 0.2, 2.35, z - 0.05, x + 0.2, 2.42, z + 0.05); }
  for (let x = 17; x < 46; x += 4) lightPanel(x, 4, CH - 0.02, 1.4, 0.45, x % 8 === 1 ? dimLight : ceilLight);
  src(20, 2.8, 4, 0xc8d8f0, 6, 9, 'corr'); src(30, 2.8, 4, 0xa8c0e8, 5, 9, 'corr'); src(40, 2.8, 4, 0xc8d8f0, 6, 9, 'corr');
  plane(TEX.ward(), 1.6, 0.5, [45.85, 2.75, 1.8], -Math.PI / 2, 0.95);
  // hazards: u = 0 where they were at 08:14, u = 1 where they ended up
  const gurney = () => {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.7), mattress); top.position.y = 0.82; g.add(top);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.06, 0.75), M.steel); fr.position.y = 0.74; g.add(fr);
    for (const [x, z] of [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.66, 6), M.steel); l.position.set(x, 0.4, z); g.add(l); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), M.rubber); w.rotation.x = Math.PI / 2; w.position.set(x, 0.07, z); g.add(w); }
    const sh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.72), sheet); sh.position.set(0.2, 0.9, 0); g.add(sh);
    return g;
  };
  const cylinder = () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 12), new THREE.MeshStandardMaterial({ color: 0xe8ece8, roughness: 0.35, metalness: 0.4 })); c.rotation.z = Math.PI / 2; g.add(c); const v = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), M.steel); v.rotation.z = Math.PI / 2; v.position.x = 0.62; g.add(v); const r = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 0.4 })); r.position.x = 0.5; g.add(r); return g; };
  const cart = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0xc8443a, roughness: 0.5 })); b.position.y = 0.6; g.add(b); for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.02, 0.62), M.darkSteel); d.position.y = 0.35 + k * 0.2; g.add(d); } for (const [x, z] of [[-0.38, -0.25], [0.38, -0.25], [-0.38, 0.25], [0.38, 0.25]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), M.rubber); w.rotation.x = Math.PI / 2; w.position.set(x, 0.07, z); g.add(w); } return g; };
  const debris = () => { const g = new THREE.Group(); const r = rng(5); for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.6), M.ceiling); p.position.set((r() - 0.5) * 1.2, k * 0.08, (r() - 0.5) * 1.6); p.rotation.set((r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5); g.add(p); } const lf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.45), ceilLight); lf.position.y = 0.3; lf.rotation.y = 0.4; g.add(lf); return g; };
  const shards = () => { const g = new THREE.Group(); const r = rng(9), mat = new THREE.MeshPhysicalMaterial({ color: 0xd8eef2, roughness: 0.05, transparent: true, opacity: 0.55, side: THREE.DoubleSide }); g.userData.pieces = []; for (let k = 0; k < 18; k++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.35 + r() * 0.3, 0.3 + r() * 0.4), mat); const home = V3(-1.3 + (k % 6) * 0.52, -0.6 + Math.floor(k / 6) * 0.55, 0); const land = V3((r() - 0.5) * 3.4, -1.66 + r() * 0.06, 1.2 + r() * 4.2); s.userData.home = home; s.userData.land = land; s.userData.spin = [r() * 6, r() * 6, r() * 6]; g.add(s); g.userData.pieces.push(s); } return g; };
  const addHaz = (mesh, o) => { scene.add(mesh); mesh.userData.noBatch = true; W.hazards.push({ mesh, ...o }); return mesh; };
  addHaz(gurney(), { label: 'the gurney', from: [19.6, 0, 1.75], to: [19.6, 0, 6.2], spin: [0, 0.25, 0], schedule: [2.2, 1.5, 1.3, 0.55], radius: 1.15, msg: 'THE GURNEY WENT BACK WHERE IT CAME FROM', collide: [2.0, 1.0, 0.75] });
  addHaz(cylinder(), { label: 'the oxygen cylinder', from: [25.5, 1.4, 6.7], to: [23.0, 0.14, 1.7], arc: 0.6, spin: [0, 1.2, 6.2], schedule: [1.6, 0.9, 1.8, 0.45], phase: 1.4, radius: 0.75, msg: 'THE CYLINDER FLEW BACK TO ITS BRACKET' });
  addHaz(shards(), { label: 'the lab window', glass: true, origin: [32, 1.66, 1.0], schedule: [2.4, 0.8, 2.1, 0.35], phase: 2.0, radius: 2.9, hazardAt: [32, 1.0, 4.0], msg: 'THE GLASS WENT BACK INTO THE WINDOW · THROUGH YOU' });
  addHaz(cart(), { label: 'the crash cart', from: [42.2, 0, 2.3], to: [36.0, 0, 2.3], spin: [0, 0.6, 0], schedule: [1.6, 1.3, 1.4, 0.7], phase: 0.6, radius: 0.85, msg: 'THE CART ROLLED BACK TO ITS BAY', collide: [0.9, 1.1, 0.6] });
  addHaz(cart(), { label: 'the linen trolley', from: [36.6, 0, 5.6], to: [42.6, 0, 5.6], spin: [0, -0.5, 0], schedule: [1.4, 1.2, 1.6, 0.7], phase: 2.6, radius: 0.85, msg: 'THE TROLLEY ROLLED BACK TO WHERE IT STOOD', collide: [0.9, 1.1, 0.6] });
  addHaz(debris(), { label: 'the fallen ceiling', from: [44.0, 3.0, 4.0], to: [44.0, 0.05, 4.0], spin: [0.2, 0, 0.15], schedule: [2.6, 0.9, 1.8, 0.5], phase: 0.4, radius: 1.5, slab: true, msg: 'THE CEILING WENT BACK UP · AND CAME DOWN', collide: [2.6, 0.7, 5.4] });
  // the alcove panel (optional shard): fallen over the shard; an inversion lifts it back for a few seconds
  W.movers.alcove = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.9), M.ceiling); scene.add(W.movers.alcove);
  W.movers.alcoveFrom = [28, 2.78, 8.1]; W.movers.alcoveTo = [28, 0.45, 8.1];

  // ======================= WARD 4 (x 46..72, z -14..14, h 3.4) =======================
  const WH = 3.4;
  room(46, -14, 72, 14, WH, M.floorWard);
  wallZ(46, -14, 14, WH, [[2, 6]], M.wallWard);
  wallZ(72, -14, 14, WH, [], M.wallWard);
  wallX(14, 46, 72, WH, [], M.wallWard);
  wallX(-14, 46, 72, WH, [[67.5, 70.5]], M.wallWard);
  // bay partitions (curtain walls with a solid head rail), curtains half drawn at the bay fronts
  for (const zr of [[8.6, 14], [-14, -8.6]]) for (const x of [51, 56, 61, 66]) { B.box(curtain, x - 0.02, 0.15, zr[0], x + 0.02, 2.4, zr[1]); blk(x - 0.12, 0, zr[0], x + 0.12, 2.4, zr[1]); B.box(M.steel, x - 0.03, 2.4, zr[0], x + 0.03, 2.46, zr[1]); }
  for (const z of [8.6, -8.6]) B.box(M.steel, 46, 2.42, z - 0.03, 66, 2.48, z + 0.03);
  BAYS.forEach(([id, x, z], i) => {
    const s = z > 0 ? 1 : -1, wallZp = s * 13.86;
    // bed against the outer wall
    const bz = s * 12.25;
    // a real ward bed: deck, side skirts (the load-sensor box), legs on casters, base frame, rails, head/foot boards
    blk(x - 0.48, 0, bz - 1.05, x + 0.48, 0.62, bz + 1.05);
    B.box(M.steel, x - 0.45, 0.54, bz - 1.0, x + 0.45, 0.62, bz + 1.0);
    B.box(white, x - 0.47, 0.34, bz - 0.9, x - 0.45, 0.58, bz + 0.9); B.box(white, x + 0.45, 0.34, bz - 0.9, x + 0.47, 0.58, bz + 0.9);
    B.box(M.darkSteel, x - 0.36, 0.16, bz - 0.95, x + 0.36, 0.22, bz + 0.95);
    for (const lx of [-0.4, 0.4]) for (const lz of [-0.92, 0.92]) { B.box(M.steel, x + lx - 0.03, 0.1, bz + lz - 0.03, x + lx + 0.03, 0.54, bz + lz + 0.03); B.box(M.rubber, x + lx - 0.04, 0, bz + lz - 0.05, x + lx + 0.04, 0.1, bz + lz + 0.05); }
    B.box(mattress, x - 0.46, 0.62, bz - 1.0, x + 0.46, 0.74, bz + 1.0);
    B.box(sheet, x - 0.3, 0.74, bz + s * 0.62, x + 0.3, 0.85, bz + s * 0.94);
    if (id !== '4-07') B.box(sheet, x - 0.47, 0.74, bz - 0.4 * s - 0.6, x + 0.47, 0.78, bz - 0.4 * s + 0.6);
    else { B.box(sheet, x - 0.475, 0.74, bz - s * 0.98, x + 0.475, 0.755, bz + s * 0.5); B.box(curtain, x - 0.476, 0.7, bz - s * 0.98, x + 0.476, 0.76, bz - s * 0.6); }
    for (const sx of [-1, 1]) { B.box(M.steel, x + sx * 0.5 - 0.012, 0.8, bz + s * 0.05, x + sx * 0.5 + 0.012, 0.84, bz + s * 0.85); for (const pz of [0.15, 0.75]) B.box(M.steel, x + sx * 0.5 - 0.01, 0.62, bz + s * pz - 0.012, x + sx * 0.5 + 0.01, 0.8, bz + s * pz + 0.012); }
    B.box(M.steel, x - 0.5, 0.6, bz + s * 1.0, x + 0.5, 1.15, bz + s * 1.06);
    B.box(white, x - 0.47, 0.6, bz - s * 1.06, x + 0.47, 0.92, bz - s * 1.0);
    // headwall: medical gas outlets, a light, a monitor arm
    B.box(white, x - 1.6, 1.3, wallZp - s * 0.06, x + 1.6, 1.62, wallZp); B.box(i % 2 ? green : dimLight, x - 1.2, 1.56, wallZp - s * 0.065, x + 1.2, 1.6, wallZp - s * 0.06);
    // bedside cabinet + chair
    solid(white, x + 0.85, 0, wallZp - s * 0.75, x + 1.45, 0.8, wallZp - s * 0.15);
    B.boxc(seat, x - 1.4, 0.45, bz - s * 0.6, 0.5, 0.08, 0.5); B.boxc(seat, x - 1.4, 0.72, bz - s * 0.37, 0.5, 0.5, 0.06);
    // the bay number over the curtain rail
    W.bays[id] = { x, z, s, plate: plane(TEX.bay(id), 0.7, 0.35, [x, 2.75, s * 8.58], s > 0 ? Math.PI : 0, 0.95) };
    // curtains (one mesh each, slightly open; 4-07 drawn back)
    const cw = id === '4-07' ? 0.9 : 2.2 + (i % 3) * 0.4;
    const cu = new THREE.Mesh(new THREE.PlaneGeometry(cw, 2.25, 8, 1), curtain);
    const pa = cu.geometry.attributes.position; for (let k = 0; k < pa.count; k++) pa.setZ(k, Math.sin(pa.getX(k) * 7) * 0.06); cu.geometry.computeVertexNormals();
    cu.position.set(x - 2.5 + cw / 2 + 0.05, 1.3, s * 8.6); scene.add(cu); W.curtains.push(cu);
    blk(x - 2.5, 0, s * 8.6 - 0.08, x - 2.5 + cw, 2.3, s * 8.6 + 0.08);
    src(x, 2.9, z - s * 0.5, 0xdcecff, 4, 6, 'ward');
  });
  // nurses' station: a U desk with screens and the night handover intercom
  solid(white, 56.6, 0, -1.4, 61.4, 1.05, -0.9); solid(white, 56.6, 0, 0.9, 61.4, 1.05, 1.4); solid(white, 61.0, 0, -1.4, 61.4, 1.05, 1.4);
  for (const [z0, z1] of [[-1.5, -0.8], [0.8, 1.5]]) B.box(deskTop, 56.5, 1.05, z0, 61.5, 1.1, z1);
  B.box(deskTop, 60.9, 1.05, -1.5, 61.5, 1.1, 1.5);
  W.screens.station = [plane(TEX.census(), 0.6, 0.45, [58.2, 1.4, -1.05], 0, 0.8), plane(TEX.monitor(false), 0.5, 0.32, [60.2, 1.36, 1.06], Math.PI, 0.9)];
  for (const x of [50, 56, 62, 68]) for (const z of [-4, 4]) lightPanel(x, z, WH - 0.02, 1.2, 0.6, dimLight);
  src(59, 3.0, 0, 0xc8dcff, 10, 12, 'ward'); src(50, 3.0, 2, 0xa8c8ff, 6, 10, 'ward'); src(68, 3.0, -2, 0xa8c8ff, 6, 10, 'ward');
  // east strip: a supply room (closed) and the way north to Records
  plane(TEX.records(), 1.6, 0.5, [69, 2.85, -13.85], 0, 0.95);
  for (const [x, z] of [[70.6, 6], [70.6, 2]]) { B.box(M.darkSteel, 71.86, 0, z - 0.7, 71.9, 2.3, z + 0.7); B.box(red, 71.84, 2.35, z - 0.2, 71.86, 2.42, z + 0.2); void x; }
  // 4-07: the monitor (screen swaps when the tone stops), the sensor readout, the wristband
  W.screens.monitor = plane(TEX.monitor(false), 0.6, 0.38, [P.monitor407[0], P.monitor407[1], -13.78], 0, 1.1);
  W.screens.sensor = plane(TEX.sensor(), 0.36, 0.27, [54.0, 0.45, -11.6], Math.PI / 2, 0.9);
  B.box(M.steel, 52.1, 0.5, -13.85, 52.3, 1.45, -13.7);
  W.dent = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), new THREE.MeshStandardMaterial({ color: 0x86a2aa, roughness: 0.9, transparent: true, opacity: 0.6 })); W.dent.rotation.x = -Math.PI / 2; W.dent.position.set(53.5, 0.745, -12.1); scene.add(W.dent);
  // ambient reversed objects in the ward: an IV pole drifting back to the bed it left, chart pages rising to the desk
  const iv = new THREE.Group(); { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 6), M.steel); pole.position.y = 1.0; iv.add(pole); const bag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.05), new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.6, roughness: 0.1 })); bag.position.y = 1.85; iv.add(bag); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 5), M.steel); base.position.y = 0.06; iv.add(base); }
  scene.add(iv); W.movers.iv = iv;
  W.movers.pages = [];
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xece8dc, roughness: 0.9, side: THREE.DoubleSide });
  for (let k = 0; k < 6; k++) { const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), pageMat); scene.add(pg); W.movers.pages.push(pg); }
  // Bell's bay clock: runs backward with his bay
  const clk = new THREE.Group(); clk.position.set(...P.bellClock); clk.rotation.y = Math.PI;
  clk.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), white)); clk.children[0].rotation.x = Math.PI / 2;
  const hand = (len, w) => { const h = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.01), M.darkSteel); h.geometry.translate(0, len / 2, 0); h.position.z = 0.03; clk.add(h); return h; };
  W.movers.clock = { g: clk, hr: hand(0.1, 0.02), mn: hand(0.16, 0.012), sc: hand(0.17, 0.005) }; W.movers.clock.sc.material = red;
  scene.add(clk);

  // ======================= RECORDS (x 46..72, z -32..-14, h 3.2) =======================
  const RH = 3.2;
  room(46, -32, 72, -14, RH);
  wallZ(46, -32, -14, RH, [[-23.5, -20.5]]); wallZ(72, -32, -14, RH); wallX(-32, 46, 72, RH);
  // archive shelving (2026 boxes)
  const box2026 = new THREE.MeshStandardMaterial({ color: 0xb8a47a, roughness: 0.85 });
  for (const z of [-20.2, -23.4, -26.6]) {
    solid(M.darkSteel, 48.6, 0, z - 0.3, 60.4, 2.3, z + 0.3);
    for (let y = 0.3; y < 2.2; y += 0.48) for (let x = 48.8; x < 60.2; x += 0.62) B.box(box2026, x, y, z - 0.31, x + 0.54, y + 0.34, z - 0.29);
  }
  for (let x = 50; x <= 70; x += 5) for (const z of [-17, -22, -28]) lightPanel(x, z, RH - 0.02, 1.2, 0.6, ceilLight);
  src(54, 2.8, -18, 0xf0f4ff, 10, 10, 'rec'); src(64, 2.8, -20, 0xf0f4ff, 10, 10, 'rec'); src(56, 2.8, -29, 0xe8eeff, 8, 10, 'rec');
  // census and pharmacy desks against the south wall
  for (const [x] of [[P.census[0]], [P.pharmacy[0]]]) { solid(white, x - 1.0, 0, -14.9, x + 1.0, 0.76, -14.15); B.box(deskTop, x - 1.05, 0.76, -14.95, x + 1.05, 0.8, -14.12); B.box(M.darkSteel, x - 0.36, 0.8, -14.4, x + 0.36, 1.3, -14.34); }
  W.screens.census = plane(TEX.census(), 0.7, 0.52, [P.census[0], 1.1, -14.44], Math.PI, 0.95);
  W.screens.pharmacy = plane(TEX.pharmacy(), 0.7, 0.52, [P.pharmacy[0], 1.1, -14.44], Math.PI, 0.95);
  // the burn bin (night book pages burned at 08:40 on 19.10.2026, still smouldering in its reversed corner)
  B.cyl(M.darkSteel, P.bin[0], 0.36, P.bin[2], 0.3, 0.72, 14); blk(P.bin[0] - 0.32, 0, P.bin[2] - 0.32, P.bin[0] + 0.32, 0.72, P.bin[2] + 0.32);
  W.movers.page = plane(TEX.nightBook(true), 0.42, 0.32, [P.bin[0], 0.74, P.bin[2]], 0, 1.0); W.movers.page.rotation.x = -Math.PI / 2; W.movers.page.material.toneMapped = true;
  W.movers.ash = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1, emissive: 0xff5a20, emissiveIntensity: 0.4 })); W.movers.ash.rotation.x = -Math.PI / 2; W.movers.ash.position.set(P.bin[0], 0.7, P.bin[2]); scene.add(W.movers.ash);
  // the incident board on the north wall
  W.screens.board = plane(TEX.board(0), 2.4, 1.4, [P.board[0], 1.6, -31.86], 0, 0.85);
  // Helix liaison office: glass walls
  const gw = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(x1 - x0, z1 - z0), 2.6), glass); m.position.set((x0 + x1) / 2, 1.3, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); scene.add(m); blk(Math.min(x0, x1) - 0.05, 0, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, 2.6, Math.max(z0, z1) + 0.05); B.box(M.darkSteel, Math.min(x0, x1) - 0.04, 2.6, Math.min(z0, z1) - 0.04, Math.max(x0, x1) + 0.04, 2.7, Math.max(z0, z1) + 0.04); };
  gw(64, -25, 65.6, -25); gw(67.2, -25, 72, -25); gw(64, -32, 64, -25);
  plane(TEX.helixOffice(), 1.6, 0.44, [68.4, 2.35, -24.94], 0, 0.95);
  solid(M.darkSteel, 68.2, 0, -30.6, 71.0, 0.76, -29.0); B.box(white, 68.15, 0.76, -30.65, 71.05, 0.8, -28.95);
  W.screens.memo = plane(TEX.memo(), 0.3, 0.23, [P.memo[0], 0.81, P.memo[2] + 0.2], 0, 1.0); W.screens.memo.rotation.x = -Math.PI / 2; W.screens.memo.material.toneMapped = true;
  W.screens.visitors = plane(TEX.visitors(), 0.6, 0.45, [71.85, 1.5, P.visitors[2]], -Math.PI / 2, 0.85);
  src(68, 2.6, -28.5, 0xe8f0ff, 6, 8, 'rec');
  // the vault door (west wall) with the reversing lock
  plane(TEX.vault(), 1.8, 0.56, [46.15, 2.85, -22], Math.PI / 2, 0.95);
  W.vaultDoor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.5, 3.0), M.darkSteel); W.vaultDoor.position.set(46, 1.25, -22); scene.add(W.vaultDoor);
  W.vaultBox = blk(45.8, 0, -23.5, 46.2, 2.5, -20.5);
  W.workOrder = plane(TEX.workOrder(), 0.34, 0.34, [46.2, 1.3, -24.4], Math.PI / 2, 0.9); W.workOrder.material.toneMapped = true;
  // the lock: five parts around a drum on the door face (+x side)
  const LK = W.lock = { parts: [], g: new THREE.Group() }; LK.g.position.set(46.16, 1.35, -22); LK.g.rotation.y = Math.PI / 2; scene.add(LK.g);
  const lockSteel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.9 });
  const lockDark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.4, metalness: 0.7 });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 32), lockDark); drum.rotation.x = Math.PI / 2; LK.g.add(drum);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: TEX.lockPlate(), toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) })); pl.position.set(0, -0.62, 0.05); LK.g.add(pl);
  const mk = (id, name, geo, mat, pos, rot, out) => { const m = new THREE.Mesh(geo, mat.clone()); m.position.set(...pos); if (rot) m.rotation.set(...rot); LK.g.add(m); const p = { id, name, mesh: m, home: m.position.clone(), out: V3(...out), removed: false, glow: null }; LK.parts.push(p); return p; };
  // fit order (Helix work order): core pin, cam plate, lower bolt, upper bolt, seal ring → dismantle in reverse
  mk('core', 'core pin', new THREE.CylinderGeometry(0.05, 0.05, 0.34, 12), lockSteel, [0, 0, 0.17], [Math.PI / 2, 0, 0], [0, 0, 0.7]);
  mk('cam', 'cam plate', new THREE.BoxGeometry(0.46, 0.12, 0.04), lockSteel, [0, 0, 0.08], null, [0.5, 0.3, 0.5]);
  mk('lower', 'lower bolt', new THREE.BoxGeometry(0.1, 0.44, 0.08), lockSteel, [0, -0.33, 0.06], null, [-0.3, -0.7, 0.55]);
  mk('upper', 'upper bolt', new THREE.BoxGeometry(0.1, 0.44, 0.08), lockSteel, [0, 0.33, 0.06], null, [0.3, 0.7, 0.55]);
  mk('seal', 'seal ring', new THREE.TorusGeometry(0.36, 0.035, 8, 32), new THREE.MeshStandardMaterial({ color: 0xc8a040, roughness: 0.3, metalness: 0.9 }), [0, 0, 0.11], null, [0, 0, 0.9]);
  LK.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), red.clone()); LK.lamp.position.set(0.32, 0.5, 0.04); LK.g.add(LK.lamp);
  src(47.2, 2.4, -22, 0xe8f0ff, 8, 8, 'rec');

  // ======================= VAULT (x 38..46, z -28..-17, h 3.0) =======================
  room(38, -28, 46, -17, 3.0);
  wallX(-28, 38, 46, 3.0, [], M.wall, 0.24, null); wallX(-17, 38, 46, 3.0, [], M.wall, 0.24, null); wallZ(38, -28, -17, 3.0, [], M.wall, 0.24, null);
  const drawerMat = new THREE.MeshStandardMaterial({ color: 0x7a8288, roughness: 0.35, metalness: 0.75 });
  for (let z = -27.4; z < -17.4; z += 0.62) for (let y = 0.3; y < 2.6; y += 0.42) { B.box(drawerMat, 38.12, y, z, 38.5, y + 0.38, z + 0.58); B.box(M.darkSteel, 38.5, y + 0.16, z + 0.22, 38.54, y + 0.22, z + 0.36); }
  blk(38, 0, -28, 38.6, 3.0, -17);
  W.drawer = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.58), drawerMat); W.drawer.position.set(38.32, 1.33 - 0.12, -20.42 + 0.29); scene.add(W.drawer);
  const tag = plane(TEX.bay('4-07'), 0.22, 0.11, [38.56, 1.46, -20.12], Math.PI / 2, 1.2); tag.userData.noBatch = true;
  solid(M.darkSteel, 40.0, 0, -25.2, 41.2, 0.9, -24.0); B.box(M.darkSteel, 40.3, 0.9, -24.9, 40.9, 1.5, -24.86);
  W.screens.file = plane(TEX.file(), 0.75, 0.5, [40.6, 1.42, -24.84], 0, 0.15);
  for (const z of [-25, -20]) lightPanel(42, z, 2.98, 1.6, 0.4, dimLight);
  src(42, 2.6, -22.5, 0xc8dcff, 8, 10, 'vault'); src(40.6, 1.8, -23.6, 0x9fd8ff, 3, 4, 'vault');

  // ---------- finish ----------
  const meshes = B.build(scene, { cast: !low });
  for (const m of meshes) m.receiveShadow = true;
  W.update = (dt, t) => {
    W.rain.rise.update(dt);
    for (const f of W.updaters) f(dt, t);
    for (const k of W.candles) { k.h = Math.min(0.22, k.h + k.s * dt * 0.4); k.c.scale.y = k.h; k.c.position.y = 0.9 + k.h / 2; k.f.position.set(k.c.position.x, 0.9 + k.h + 0.025, k.c.position.z); k.f.scale.x = 1 + Math.sin(t * 9 + k.s * 900) * 0.15; }
    for (const c of W.curtains) c.rotation.y = Math.sin(t * 0.7 + c.position.x) * 0.01;
  };
  return W;
}
