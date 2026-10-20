// Mission 8 environment: Helix Temporal Research in an ALTERED present (2049, "version 17").
// Same institution as mission 2, but rebuilt by the changes Kai made in the past: a glass podium under a tower, a
// rain-soaked forecourt with a memorial for Dr. Kai Varen, a loading yard, the lobby atrium, the research corridor
// (security, records, Lab B, Dr. Lind's office, Kai's own office, maintenance), the containment antechamber and the
// round temporal containment chamber. North = -z. Static geometry is merged per material (env_m6 Batch).
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng } from './kit.js';
import { Batch } from './env_m6.js';
import { lampPost } from './props.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

export const CH = { x: 0, z: -70, r: 8.5 };          // containment chamber centre and wall radius
export const CLAMPS = [270, 0, 90];                    // clamp alcoves (degrees: 0 = north, 90 = east)
export const polarC = (deg, r) => [CH.x + Math.sin(deg * Math.PI / 180) * r, CH.z - Math.cos(deg * Math.PI / 180) * r];

// Key positions (x, y, z) used by the mission script and the playthrough test
export const P = {
  start: [3.2, 0, 9.5], memorial: [5.6, 0, 3.0], kiosk: [-7.5, 0, 13.5], entrance: [0, 0, 1.2],
  directory: [-7.2, 0, -9.5], plaque: [-11.6, 0, -6.0], logo: [7, 0, -15.6], turnstile: [0, 0, -13.6],
  yaraDesk: [9.2, 0, -21.5], kaiDoor: [2.3, 0, -29.0], kaiDesk: [9.2, 0, -29.5], drawing: [11.8, 1.6, -29.0],
  server: [-11.0, 0, -18.4], board: [-7.0, 0, -27.6], records: [-10.6, 0, -38.5], breakers: [11.9, 0, -42.5],
  readerSec: [-2.3, 1.3, -20.2], readerMaint: [2.3, 1.3, -37.2], readerAnte: [2.3, 1.3, -49.6],
  labDoor: [-2.2, 0, -46], labValve: [-4.0, 0, -41.55], serviceDoor: [16.5, 0, -10], anteConsole: [0, 0, -57.6],
  window: [-4.2, 0, -59.3], chamberDoor: [0, 0, -60.6],
};
// Six security cameras of the corrupted 08:04-08:14 log (where their segments re-sync in Residue Vision)
export const CAMS = [
  { id: 'C1', name: 'LOBBY · TURNSTILES', pos: [3.6, 3.6, -13.2], at: [1.4, 0, -11.8] },
  { id: 'C2', name: 'SECURITY OFFICE', pos: [-2.6, 3.0, -16.6], at: [-7.6, 0, -21.8] },
  { id: 'C3', name: 'MAINTENANCE', pos: [2.6, 3.0, -33.6], at: [8.2, 0, -40.5] },
  { id: 'C4', name: 'CORRIDOR NORTH', pos: [1.7, 3.0, -48.6], at: [0, 0, -42.0] },
  { id: 'C5', name: 'CONTAINMENT ANTECHAMBER', pos: [7.5, 3.6, -50.6], at: [0.5, 0, -57.8] },
  { id: 'C6', name: 'CONTAINMENT CHAMBER', pos: [-7.5, 3.6, -50.6], at: [-4.2, 0, -59.0] },
];
export const SHARDS = [[-14.5, 0.9, 20.5], [11.0, 0.9, -12.2], [-11.2, 0.9, -44.0], [26.4, 0.9, -14.6], [14.6, 0.9, -44.4]];

// ---------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites an existing id)
// ---------------------------------------------------------------------------------------------
export function registerM8Cast() {
  // Dr. Yara Lind: Helix containment physicist, Kai's project partner in this version (COSTUMES.md helix_sci_f:
  // the hip-length Helix lab jacket with a mandarin collar and tech panel over a navy mock-neck, slim grey trousers)
  registerCast('yara', {
    name: 'DR. YARA LIND', role: 'Containment physicist · Helix · missing since 08:14',
    bio: 'Kai Varen\'s project partner in a version of Helix he never worked at. Her badge last opened the containment antechamber at 08:12. Nobody has seen her since the Zero Second.',
    look: { era: '2049', costume: 'helix_sci_f', sex: 'f', female: true, age: 35, height: 1.68, build: 0.94, skin: 0xc68e6a, hair: 0x2a1c14, hairStyle: 'tied-back', eyes: 0x3a5a4a,
      face: { jaw: -0.1, cheek: 0.35, nose: -0.05, noseWidth: 0.1, lips: 0.2, brow: 0.15, eyeSize: 0.15, faceLength: 0.15, chin: -0.05 },
      topType: 'jacket', top: 0x1d2430, topKind: 'synthetic', coat: 0xe8eaec, coatKind: 'fabric', pantsType: 'trousers', pants: 0x4a4e54, shoes: 'shoes', boots: 0xe6e2da, freckles: 0.15 },
    rimColor: 0xffc890, glow: 0x2a2010, bg: 0x101014,
    vp: { sex: 'f', pitch: 1.02, rate: 0.98, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('kai17', { name: 'KAI VAREN · ECHO 08:0x', role: 'Security log · version 17', portraitOf: 'kai', voice: true, vp: { sex: 'm', pitch: 0.92, rate: 1.0, langs: ['en-GB', 'en-US'] } });
  registerCast('kaimemo', { name: 'VOICE MEMO · DR. K. VAREN', role: 'Recorded Monday 18.10.2049', portraitOf: 'kai', voice: true, vp: { sex: 'm', pitch: 0.9, rate: 0.95, langs: ['en-GB', 'en-US'] } });
  registerCast('helixai', { name: 'HELIX SYSTEMS', role: 'Facility intelligence · automated', voice: true, vp: { sex: 'f', pitch: 1.12, rate: 1.04, langs: ['en-US', 'en-GB'] } });
  registerCast('radio', { name: 'SECURITY RADIO', role: 'Helix channel 2', voice: true, vp: { sex: 'm', pitch: 0.85, rate: 1.05, langs: ['en-US', 'en-GB'] } });
  registerCast('yaraecho', { name: 'DR. YARA LIND · ECHO 08:0x', role: 'Security log · version 17', portraitOf: 'yara', vp: { sex: 'f', pitch: 1.04, rate: 1.0, langs: ['en-GB', 'en-IE', 'en-US'] } });
  registerCast('haleecho', { name: 'OFF. R. HALE · ECHO 08:06', role: 'Security log · version 17', portraitOf: 'hale', vp: { sex: 'm', pitch: 0.86, rate: 1.0, langs: ['en-US', 'en-GB'] } });
  registerCast('brandtecho', { name: 'M. BRANDT · ECHO 08:06', role: 'Security log · version 17', portraitOf: 'brandt', vp: { sex: 'm', pitch: 0.8, rate: 1.02, langs: ['en-GB', 'en-US'] } });
  registerCast('m8guard', { name: 'HELIX SECURITY', role: 'Night desk · Level 1', look: { ...GUARD, lod: false }, vp: { sex: 'm', pitch: 0.84, rate: 1.0, langs: ['en-US', 'en-GB'] } });
  registerCast('m8staff', { name: 'HELIX SCIENTIST', role: 'Late shift', look: { ...STAFF[1], lod: false }, vp: { sex: 'f', pitch: 1.06, rate: 1.02, langs: ['en-GB', 'en-US'] } });
  registerCast('m8tech', { name: 'LAB B TECHNICIAN', role: 'Iven Marr\'s team', look: { ...TECHS[0], lod: false }, vp: { sex: 'f', pitch: 1.0, rate: 1.05, langs: ['en-US', 'en-GB'] } });
  registerCast('figure', { name: '— — —', role: 'Unidentified · camera C4', voice: true, vp: { sex: 'm', pitch: 0.72, rate: 0.9, langs: ['en-GB'] } });
}
// 2049 Helix crowd (COSTUMES.md helix_sci_m / helix_sci_f / helix_sec_1 / technician), built at LOD
export const STAFF = [
  { era: '2049', costume: 'helix_sci_m', sex: 'm', age: 41, height: 1.78, build: 1.0, skin: 0xd9a585, hair: 0x2a1c14, hairStyle: 'short', topType: 'sweater', top: 0x6a6e74, topKind: 'fabric', coat: 0xe8eaec, coatKind: 'fabric', pantsType: 'trousers', pants: 0x23262b, shoes: 'shoes', boots: 0xd8dce0, glasses: true, lod: true },
  { era: '2049', costume: 'helix_sci_f', sex: 'f', female: true, age: 29, height: 1.64, build: 0.92, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'bun', topType: 'jacket', top: 0x1d2430, topKind: 'synthetic', coat: 0xe8eaec, coatKind: 'fabric', pantsType: 'trousers', pants: 0x4a4e54, shoes: 'shoes', boots: 0xe6e2da, lod: true },
  { era: '2049', costume: 'helix_sci_m', sex: 'm', age: 56, height: 1.74, build: 1.08, skin: 0xf1c6a8, hair: 0xb8b4ae, hairStyle: 'swept', topType: 'sweater', top: 0x2f3542, topKind: 'fabric', coat: 0xe8eaec, coatKind: 'fabric', pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes', boots: 0x14151a, lod: true },
];
export const GUARD = { era: '2049', costume: 'helix_sec_1', sex: 'm', age: 33, height: 1.82, build: 1.08, skin: 0xb98463, hair: 0x111111, hairStyle: 'buzz', topType: 'uniform', top: 0x1c2533, topKind: 'fabric', vest: 0x111820, pantsType: 'cargo', pants: 0x1c2533, shoes: 'boots', boots: 0x0f0f10, gloves: 0x101010, cap: 0x111820, lod: true };
export const GUARD_F = { era: '2049', costume: 'helix_sec_2', sex: 'f', female: true, age: 30, height: 1.7, build: 1.0, skin: 0xe8b996, hair: 0x5a3a22, hairStyle: 'tied-back', topType: 'uniform', top: 0x1c2533, topKind: 'fabric', vest: 0x111820, pantsType: 'cargo', pants: 0x1c2533, shoes: 'boots', boots: 0x0f0f10, gloves: 0x101010, lod: true };
export const TECHS = [
  { era: '2049', costume: 'technician', sex: 'f', female: true, age: 38, height: 1.66, build: 1.0, skin: 0xa16d4c, hair: 0x15100b, hairStyle: 'tied-back', topType: 'jacket', top: 0x37404a, topKind: 'synthetic', vest: 0xd9781e, pantsType: 'cargo', pants: 0x2c333b, shoes: 'boots', boots: 0x2a2018, gloves: 0x3a3028, lod: true },
  { era: '2049', costume: 'technician', sex: 'm', age: 27, height: 1.8, build: 0.96, skin: 0xe0b394, hair: 0x8a6a4a, hairStyle: 'messy', topType: 'jacket', top: 0x2e3338, topKind: 'synthetic', vest: 0xd9781e, pantsType: 'cargo', pants: 0x23262b, shoes: 'boots', boots: 0x1b1d20, cap: 0x2a3440, lod: true },
];

// ---------------------------------------------------------------------------------------------
// Music: the altered present is the city theme with one wrong note; echoes run on a clock; containment races.
// ---------------------------------------------------------------------------------------------
export const musicState = { segs: 0, escape: 0 };
export function registerM8Themes() {
  registerTheme('m8-altered', { bpm: 66, step(a, s, t, d) { // a familiar Helix pad, a piano that lands a semitone off
    const bar = Math.floor(s / 16), b = s % 16, CHS = [[45, 57, 60, 64], [41, 57, 60, 65], [48, 55, 60, 63], [44, 56, 60, 63]], ch = CHS[bar % 4];
    if (b === 0) { a.pad(ch.slice(1), t, d * 16, 0.016, 520); a.cello(ch[0] - 12, t, d * 16, 0.035); }
    if (b === 0 || b === 6 || b === 10) a.piano(ch[1 + (b % 3)] + 12, t, 0.12, 3.4);
    if (bar % 4 === 3 && b === 12) a.piano(70, t, 0.1, 4); // the wrong note: B-flat where the motif wants B
    if (b === 8 && bar % 2) a.glass(88, t, 0.012);
  } });
  registerTheme('m8-echo', { bpm: 60, step(a, s, t, d) { // residue: a slow tick per second, the E-B-A motif under glass
    const bar = Math.floor(s / 16), b = s % 16;
    if (b % 4 === 0) a.tick(t, 0.03, 3200);
    if (b === 0) { a.pad([52, 59, 64], t, d * 16, 0.014, 420); if (bar % 2 === 0) a.cello(40, t, d * 32, 0.04); }
    const mel = [76, 83, 81], at = [2, 7, 12], i = at.indexOf(b); if (i >= 0 && bar % 2 === 1) a.glass(mel[i], t, 0.02);
    if (musicState.segs >= 3 && b === 10) a.piano(64 + (bar % 3) * 3, t, 0.08, 2.4);
  } });
  registerTheme('m8-hunt', { bpm: 96, step(a, s, t, d) { // drones in the corridor: muted pulse and a high warning
    const bar = Math.floor(s / 16), b = s % 16;
    if (b % 4 === 0) a.drum(t, 0.12, 80, 42);
    if (b % 2 === 1) a.tick(t, 0.02, 5200);
    if (b === 0) { a.pad([50, 53, 57], t, d * 16, 0.014, 360); a.cello(bar % 2 ? 38 : 41, t, d * 16, 0.05); }
    if (b === 14 && bar % 2) a.glass(86, t, 0.016);
  } });
  registerTheme('m8-containment', { bpm: 128, step(a, s, t, d) { // the field collapsing: a cello ostinato that climbs with each clamp
    const bar = Math.floor(s / 16), b = s % 16, up = musicState.escape;
    if (b % 2 === 0) a.cello([38, 41, 45, 41][(b >> 1) % 4] + up * 2, t, d * 1.6, 0.05);
    if (b % 4 === 0) a.drum(t, 0.16, 120, 44);
    a.tick(t, b % 4 === 2 ? 0.035 : 0.014, 7000);
    if (b === 0) a.pad([62 + up * 2, 65 + up * 2, 69 + up * 2], t, d * 16, 0.016, 700);
    if (bar % 2 === 1 && b === 8) a.glass(84 + up * 2, t, 0.02);
  } });
  registerTheme('m8-version', { bpm: 52, step(a, s, t, d) { // the ending: the motif, slowly, and space around it
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([57, 64, 69], t, d * 16, 0.02, 480); a.cello(33, t, d * 16, 0.05); }
    if (bar % 2 === 0 && [0, 6, 12].includes(b)) a.piano([76, 83, 81][b / 6], t, 0.2, 5);
    if (bar % 4 === 3 && b === 4) a.glass(93, t, 0.014);
  } });
}

// ---------------------------------------------------------------------------------------------
// Code-drawn textures
// ---------------------------------------------------------------------------------------------
const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
export function screenTex(key, w, h, draw, bg = '#06121a') {
  return canvasTex(w, h, (g, W, H) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(95,230,255,0.06)'; g.lineWidth = 1; for (let y = 0; y < H; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    draw(g, W, H);
  }, 'm8' + key);
}
const lines = (g, list, x, y, size, col, lh = 1.35) => { g.font = `600 ${size}px ${FONT}`; list.forEach((l, i) => { g.fillStyle = Array.isArray(l) ? l[1] : col; g.fillText(Array.isArray(l) ? l[0] : l, x, y + i * size * lh); }); };
export function helixLogo(g, cx, cy, s, col, old) {
  g.save(); g.strokeStyle = col; g.lineWidth = 6 * s; g.shadowColor = col; g.shadowBlur = 12 * s;
  if (old) { for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx, cy, (50 + k * 20) * s, k, k + 4.8); g.stroke(); } }
  else { for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx, cy, 70 * s, (18 + k * 16) * s, 0, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.arc(cx, cy, 10 * s, 0, 7); g.fillStyle = col; g.fill(); }
  g.restore();
}
function textPlate(key, w, h, draw, bg) { return canvasTex(w, h, (g, W, H) => { g.fillStyle = bg || '#e8eaec'; g.fillRect(0, 0, W, H); draw(g, W, H); }, 'm8' + key); }
export const TEX = {
  logoNew: () => canvasTex(1024, 384, (g, w, h) => { g.clearRect(0, 0, w, h); helixLogo(g, 190, 192, 1.6, '#e8f2ff'); g.fillStyle = '#f2f6ff'; g.font = `600 120px ${FONT}`; g.fillText('HELIX', 380, 230); g.font = `500 34px ${FONT}`; g.fillStyle = '#9fb4c8'; g.fillText('TEMPORAL RESEARCH · RAIN CITY', 384, 290); }, 'm8logoNew'),
  logoOld: () => canvasTex(1024, 384, (g, w, h) => { g.clearRect(0, 0, w, h); helixLogo(g, 190, 192, 1.6, '#5fe6ff', true); g.fillStyle = '#5fe6ff'; g.font = '600 120px Cinzel, serif'; g.fillText('HELIX', 380, 230); }, 'm8logoOld'),
  plaqueNew: (aligned) => textPlate('plaqueNew' + aligned, 512, 640, (g) => {
    g.strokeStyle = '#8a7a5a'; g.lineWidth = 6; g.strokeRect(14, 14, 484, 612); g.fillStyle = '#2a2418'; g.textAlign = 'center';
    lines(g, ['HELIX TEMPORAL', 'RESEARCH', ''], 256, 90, 40, '#2a2418');
    lines(g, ['Founded 2029 by', 'Dr. Elias Rook', 'Programme lead', 'Dr. Kai Varen', '', aligned ? 'Raised on the count kept by' : 'Raised on the work of', aligned ? 'the keepers of Site 3,' : 'the Site Zero survey', aligned ? 'who taught us to listen' : 'and those who came', aligned ? 'to the sky.' : 'before it.'], 256, 230, 30, '#3a3020');
  }, '#d8cfb4'),
  plaqueOld: () => textPlate('plaqueOld', 512, 640, (g) => { g.textAlign = 'center'; lines(g, ['HELIX TEMPORAL', 'RESEARCH', '', 'Founded 2029', 'Director', 'Dr. Elias Rook'], 256, 120, 40, '#5fe6ff'); }, 'rgba(0,0,0,0)'),
  memorial: () => textPlate('memorial', 512, 256, (g) => { g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, 512, 256); g.textAlign = 'center'; lines(g, ['DR. KAI VAREN', '2018 – 2049'], 256, 70, 46, '#efe8d8'); lines(g, ['The first life lost to the Zero Second.', 'He held the anchor so the city could keep its second.'], 256, 190, 22, '#b8b0a0'); }),
  doorPlate: (txt, sub, ribbon) => textPlate('door' + txt, 256, 96, (g) => { g.fillStyle = '#20252b'; g.fillRect(0, 0, 256, 96); lines(g, [txt], 14, 40, 26, '#e8eaec'); lines(g, [sub], 14, 74, 16, '#9fb4c8'); if (ribbon) { g.fillStyle = '#050505'; g.beginPath(); g.moveTo(206, 0); g.lineTo(256, 0); g.lineTo(256, 50); g.closePath(); g.fill(); } }),
  doorPlateOld: () => textPlate('doorOld', 256, 96, (g) => { lines(g, ['STORAGE 2B'], 14, 40, 26, '#5fe6ff'); lines(g, ['Facilities'], 14, 74, 16, '#5fe6ff'); }, 'rgba(0,0,0,0)'),
  directory: (trusted) => screenTex('dir' + trusted, 512, 384, (g) => {
    lines(g, ['HELIX STAFF DIRECTORY · LEVEL 1'], 20, 36, 20, '#5fe6ff');
    lines(g, [['ROOK, E.        Director', '#d8e6f0'], ['VAREN, K.       Project Lead  · DECEASED 08:14', '#ff8a7a'], ['LIND, Y.        Containment  · MISSING  08:14', '#ffc070'],
      ['BRANDT, M.      Head of Security', '#d8e6f0'], [trusted ? 'HALE, R.        Security · night shift' : 'HALE, R.        Transferred · Checkpoint C', '#d8e6f0'], ['MARR, I.        Maintenance lead', '#d8e6f0']], 20, 84, 19, '#d8e6f0', 1.7);
  }),
  directoryOld: () => screenTex('dirOld', 512, 384, (g) => { lines(g, ['STAFF · LEVEL 1 (your version)'], 20, 36, 20, '#5fe6ff'); lines(g, ['ROOK, E.        Director', 'VAREN, K.       Systems engineer', 'BRANDT, M.      Security', 'HALE, R.        Security', 'MARR, I.        Technician', '— no "LIND, Y." —'], 20, 84, 19, '#5fe6ff', 1.7); }, 'rgba(0,10,16,0.0)'),
  badgeLog: () => screenTex('badge', 512, 320, (g) => { lines(g, ['BADGE 4471 · LIND, Y. · LAST READS'], 20, 36, 20, '#ffc070'); lines(g, ['08:02  E1  Office · Lind', '08:06  W1  Security office', '08:09  E3  Maintenance', '08:12  N0  Containment antechamber', '08:14  —  no further reads'], 20, 90, 22, '#e8dccb', 1.6); }),
  server: (state) => screenTex('srv' + state, 384, 256, (g) => {
    if (state === 'dark') { lines(g, ['SEC-LOG 1 · NO POWER'], 20, 40, 22, '#ff6a5a'); return; }
    lines(g, ['SEC-LOG 1 · 19.10.2049'], 20, 40, 22, '#5fe6ff');
    lines(g, state === 'ok' ? ['08:04–08:14  RESTORED', '6/6 segments re-synced'] : ['08:04–08:14  CORRUPTED', '6 segments · timestamps lost', 'Re-sync at source cameras'], 20, 100, 20, state === 'ok' ? '#9fffc8' : '#ffb070', 1.5);
  }),
  version: () => screenTex('version', 1024, 512, (g, W) => {
    g.textAlign = 'center'; lines(g, ['HELIX · TIMELINE AUDIT'], W / 2, 70, 34, '#5fe6ff');
    lines(g, ['CURRENT TIMELINE'], W / 2, 170, 30, '#9fb4c8'); lines(g, ['VERSION 17'], W / 2, 270, 96, '#e8f6ff');
    lines(g, ['PREVIOUS VERSIONS: 16', 'SURVIVING RECORDS: NONE'], W / 2, 360, 30, '#ff9a8a', 1.5);
  }),
  memo: () => screenTex('memo', 384, 256, (g) => { lines(g, ['VOICE MEMO · K. VAREN', 'Mon 18.10.2049 · 23:41', '', '▶  0:38'], 20, 44, 22, '#5fe6ff', 1.4); }),
  ante: (state) => screenTex('ante' + state, 512, 256, (g) => {
    lines(g, ['CONTAINMENT · CHAMBER 1'], 20, 40, 22, '#5fe6ff');
    const m = { idle: ['FIELD HELD SINCE 08:14:00', 'OCCUPANT: 1 · UNRESOLVED'], sealed: ['CONTAINMENT ENGAGED', 'FIELD COLLAPSE IMMINENT'], open: ['FIELD RELEASED', 'OCCUPANT: — '] }[state];
    lines(g, m, 20, 100, 22, state === 'sealed' ? '#ff6a5a' : '#e8dccb', 1.5);
  }),
  drawing: () => canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#f2ead6'; g.fillRect(0, 0, w, h);
    const crayon = (c, pts, lw = 6) => { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
    g.fillStyle = '#111'; g.beginPath(); g.arc(330, 170, 110, 0, 7); g.fill(); g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(330, 170, 70, 0, 7); g.fill();
    const kid = (x, c, hair) => { g.fillStyle = '#f0c0a0'; g.beginPath(); g.arc(x, 210, 22, 0, 7); g.fill(); crayon(hair, [[x - 20, 196], [x, 186], [x + 20, 196]], 8); crayon(c, [[x, 232], [x, 300]], 10); crayon(c, [[x - 25, 255], [x + 25, 255]], 6); crayon('#333', [[x, 300], [x - 15, 345]]); crayon('#333', [[x, 300], [x + 15, 345]]); };
    kid(90, '#d03a2a', '#222'); kid(160, '#7a4ad0', '#222'); crayon('#d03a2a', [[115, 255], [135, 255]], 6);
    g.fillStyle = '#222'; g.font = '28px "Comic Sans MS", cursive'; g.fillText('ME', 70, 370); g.fillText('MIRA', 128, 370); g.fillText('THE MACHINE', 260, 330);
  }, 'm8drawing'),
  card: (text, sig) => textPlate('card' + sig, 256, 180, (g) => { g.fillStyle = '#2a2620'; g.font = `italic 500 17px Georgia, serif`; const words = text.split(' '); let line = '', y = 34; for (const wd of words) { if (g.measureText(line + wd).width > 220) { g.fillText(line, 16, y); y += 22; line = ''; } line += wd + ' '; } g.fillText(line, 16, y); g.font = `600 16px ${FONT}`; g.fillText('— ' + sig, 16, 166); }, '#f4efe2'),
  sign: (txt, col = '#e8eaec', bg = '#1a1e24') => textPlate('sign' + txt, 512, 96, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 512, 96); lines(g, [txt], 20, 62, 40, col); }),
};

// ---------------------------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------------------------
export function buildHelix(game, scene, opts = {}) {
  const Q = RZ.getQuality(), low = Q === 'low';
  const W = { doors: {}, ghosts: {}, screens: {}, lightSrc: [], cams: [], beams: [], clampMeshes: [], updaters: [] };
  const col = game.collision;
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const M = {
    asphalt: pm('wetAsphalt', { color: 0x2e3032, puddles: 0.6 }),
    paving: pm('concrete', { color: 0x6c6d6c, slabs: 1, stains: 0.5, formwork: 0, wet: 0.8 }),
    curb: pm('cutStone', { color: 0x8a8884 }),
    podium: pm('concrete', { color: 0x8c8c88, formwork: 1, stains: 0.35 }),
    lobbyFloor: pm('ceramicTile', { color: 0xd4d6d6, grout: 0x9a9c9e, count: 1, gloss: 0.92, marble: 0.55, variation: 0.15 }),
    floor: pm('ceramicTile', { color: 0x8a8f94, grout: 0x5a5e62, count: 2, gloss: 0.75, variation: 0.2 }),
    wall: pm('paintedMetalPanel', { color: 0xd6dade, cols: 1, rows: 3, wear: 0.12, grime: 0.12, gloss: 0.5 }),
    wallDark: pm('paintedMetalPanel', { color: 0x3a4048, cols: 2, rows: 2, wear: 0.2, grime: 0.25, gloss: 0.4 }),
    ceiling: pm('paintedMetalPanel', { color: 0xbfc4c8, cols: 4, rows: 4, wear: 0.05, grime: 0.1, gloss: 0.3 }),
    steel: pm('brushedMetal', { color: 0x9aa0a6, roughness: 0.32 }),
    darkSteel: pm('brushedMetal', { color: 0x3a3f46, roughness: 0.4 }),
    rubber: pm('rubber', { color: 0x1a1b1d }),
    wood: pm('wood', { color: 0x6a4a30, planks: 8 }),
    chamber: pm('paintedMetalPanel', { color: 0x2a3036, cols: 2, rows: 6, wear: 0.35, grime: 0.3, gloss: 0.55 }),
    rust: pm('rust', { color: 0x4a2a14, paint: 0x3d4a52, amount: 0.25 }),
  };
  const white = new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.35, metalness: 0.05 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.3, metalness: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 });
  const panelGlow = glowMat(0xf2f6ff, 2.6), amberGlow = glowMat(0xffb347, 2.2), cyanGlow = glowMat(0x5fe6ff, 2.4), redGlow = glowMat(0xff4d5e, 2.0);
  const fabric = new THREE.MeshStandardMaterial({ color: 0x2e3a44, roughness: 0.9 });
  const B = new Batch();
  const H = 3.4, LH = 7.2;
  const blockBox = (x0, y0, z0, x1, y1, z1, o) => col.add([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], o);
  // wall from (x0,z0) to (x1,z1) on an axis, thickness 0.24, with door gaps [[a,b]...] along its length
  const wall = (x0, z0, x1, z1, h = H, mat = M.wall, gaps = [], y = 0) => {
    const alongX = Math.abs(z1 - z0) < 0.01, a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
    const cuts = [a0]; for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) cuts.push(g0, g1); cuts.push(a1);
    for (let i = 0; i < cuts.length; i += 2) {
      const s0 = cuts[i], s1 = cuts[i + 1]; if (s1 - s0 < 0.02) continue;
      if (alongX) { B.box(mat, s0, y, z0 - 0.12, s1, y + h, z0 + 0.12); blockBox(s0, y, z0 - 0.15, s1, y + h, z0 + 0.15); B.box(M.rubber, s0, y, z0 - 0.14, s1, y + 0.1, z0 + 0.14); }
      else { B.box(mat, x0 - 0.12, y, s0, x0 + 0.12, y + h, s1); blockBox(x0 - 0.15, y, s0, x0 + 0.15, y + h, s1); B.box(M.rubber, x0 - 0.14, y, s0, x0 + 0.14, y + 0.1, s1); }
    }
    // lintels over door gaps
    for (const [g0, g1] of gaps) { if (alongX) B.box(mat, g0, y + 2.4, z0 - 0.12, g1, y + h, z0 + 0.12); else B.box(mat, x0 - 0.12, y + 2.4, g0, x0 + 0.12, y + h, g1); }
  };
  const slab = (x0, z0, x1, z1, y, mat, t = 0.2, collide = true) => { B.box(mat, x0, y - t, Math.min(z0, z1), x1, y, Math.max(z0, z1)); if (collide) blockBox(x0, y - t, z0, x1, y, z1); };
  const lightPanel = (x, y, z, w = 1.2, d = 0.3, mat = panelGlow) => B.box(mat, x - w / 2, y - 0.03, z - d / 2, x + w / 2, y, z + d / 2);
  const src = (x, y, z, c = 0xeaf2ff, i = 18, d = 12, zone = 'in') => W.lightSrc.push({ p: [x, y, z], c, i, d, zone });

  // ======================= EXTERIOR: forecourt, street, loading yard =======================
  slab(-60, 60, 60, 26, 0, M.asphalt, 0.3);                       // street
  slab(-60, 26, 60, 0, 0.12, M.paving, 0.42);                     // forecourt (raised 12 cm)
  slab(16.5, 0, 30, -18, 0.0, M.asphalt, 0.3);                    // loading yard
  slab(-60, 0, -16.5, -90, 0.12, M.paving, 0.42, false); slab(30, 0, 60, -90, 0.12, M.paving, 0.42, false);
  B.box(M.curb, -60, 0, 25.8, 60, 0.14, 26.2);                    // curb
  for (let x = -54; x <= 54; x += 6) B.box(M.curb, x - 1.2, 0.001, 33.9, x + 1.2, 0.012, 34.1); // lane dashes (stone-coloured paint)
  // bollards along the curb + planters with trees
  for (let x = -14; x <= 14; x += 2.4) { if (Math.abs(x) < 3) continue; B.cyl(M.darkSteel, x, 0.55, 24.6, 0.12, 0.9, 10); blockBox(x - 0.14, 0, 24.46, x + 0.14, 1, 24.74); }
  const planters = [[-12, 18], [12, 18], [-12, 8], [-20, 14]];
  for (const [x, z] of planters) { B.box(M.podium, x - 1.2, 0.12, z - 1.2, x + 1.2, 0.72, z + 1.2); blockBox(x - 1.2, 0, z - 1.2, x + 1.2, 0.72, z + 1.2); B.box(M.rubber, x - 1.05, 0.72, z - 1.05, x + 1.05, 0.74, z + 1.05); }
  if (!low) {
    try {
      const trees = planters.map(([x, z], i) => { const t = RZ.tree({ kind: 'broadleaf', height: 5.5, seed: 30 + i }); const m = t.mesh || t.group || t; m.position.set(x, 0.72, z); scene.add(m); return m; });
      W.trees = trees;
    } catch (e) { console.warn('m8 trees', e); }
  }
  // street lamps
  for (const [x, z, ry] of [[-18, 25.2, Math.PI], [0, 25.2, Math.PI], [18, 25.2, Math.PI], [-24, 3, 0.4], [24, -6, -Math.PI / 2]]) {
    const l = lampPost(0xffe0b0, 6.5); l.position.set(x, 0.12, z); l.rotation.y = ry; scene.add(l); blockBox(x - 0.12, 0, z - 0.12, x + 0.12, 6, z + 0.12);
    src(x + Math.sin(ry) * 1.3, 6.2, z + Math.cos(ry) * 1.3, 0xffd8a8, 60, 22, 'out');
  }
  // gate kiosk + vehicle barrier
  const K = P.kiosk; B.box(M.podium, K[0] - 1.4, 0.12, K[2] - 1.1, K[0] + 1.4, 0.3, K[2] + 1.1); B.box(glass, K[0] - 1.3, 0.3, K[2] - 1.0, K[0] + 1.3, 2.6, K[2] + 1.0);
  B.box(M.wallDark, K[0] - 1.35, 2.6, K[2] - 1.05, K[0] + 1.35, 2.9, K[2] + 1.05); B.box(M.wallDark, K[0] - 1.3, 0.3, K[2] - 1.0, K[0] + 1.3, 1.05, K[2] + 1.0);
  blockBox(K[0] - 1.4, 0, K[2] - 1.1, K[0] + 1.4, 2.9, K[2] + 1.1); lightPanel(K[0], 2.58, K[2], 1.6, 0.4); src(K[0], 2.4, K[2], 0xeaf2ff, 12, 8, 'out');
  B.box(M.darkSteel, -10.2, 0.12, 12.8, -9.6, 1.1, 13.4); B.boxc(redGlow, -14.5, 1.0, 13.1, 8.6, 0.09, 0.09); B.boxc(white, -14.5, 1.0, 13.1, 8.6, 0.11, 0.06);
  // HELIX monolith sign at the forecourt
  const signTex = TEX.logoNew();
  const mono = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.35), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) }));
  B.box(black, -21.2, 0.12, 19.6, -15.8, 2.4, 20.2); blockBox(-21.2, 0, 19.6, -15.8, 2.4, 20.2); mono.position.set(-18.5, 1.5, 20.22); scene.add(mono);
  // the memorial at the entrance: easel, portrait, candles, flowers, cards
  const Mm = P.memorial;
  B.box(M.rubber, Mm[0] - 1.6, 0.12, Mm[2] - 0.6, Mm[0] + 1.6, 0.16, Mm[2] + 0.9);
  for (const dx of [-0.42, 0.42]) B.boxc(M.wood, Mm[0] + dx, 0.95, Mm[2] - 0.2, 0.05, 1.7, 0.05, 0, -0.12);
  B.boxc(black, Mm[0], 1.55, Mm[2] - 0.12, 0.96, 1.2, 0.05, 0, -0.12);
  W.portraitPos = [Mm[0], 1.68, Mm[2] - 0.08];
  const memo = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.42), new THREE.MeshStandardMaterial({ map: TEX.memorial(), roughness: 0.6 }));
  memo.position.set(Mm[0], 1.07, Mm[2] - 0.035); memo.rotation.x = -0.12; scene.add(memo);
  const r = rng(808);
  const flowerMats = [0xf2efe6, 0xe8d8a0, 0xc83a4a, 0xf0c8d0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: 0.8 });
  // bouquets laid on the ground: a paper cone, leaves and a tight head of blooms, each at its own angle
  const paperMats = [0xf4f0e6, 0xc8b08a, 0x1c1c1e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, side: THREE.DoubleSide }));
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: 0.75 });
  const bloomGeo = new THREE.IcosahedronGeometry(0.028, 1), cone = new THREE.ConeGeometry(0.075, 0.42, 9, 1, true), leafGeo = new THREE.SphereGeometry(0.03, 6, 4);
  for (let k = 0; k < 9; k++) {
    const x = Mm[0] - 1.35 + k * 0.33 + (r() - 0.5) * 0.12, z = Mm[2] + 0.35 + r() * 0.35, yaw = (r() - 0.5) * 1.2, tilt = Math.PI / 2 - 0.08;
    const dir = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));            // bouquets point away from the visitor
    const base = new THREE.Vector3(x, 0.17, z);
    B.geo(paperMats[k % 3], cone, base.toArray(), [-(tilt), yaw, 0]);
    const head = base.clone().addScaledVector(dir, -0.22).setY(0.2);   // the open end of the cone
    for (let j = 0; j < 7; j++) {
      const o = [(r() - 0.5) * 0.09, (r() - 0.2) * 0.05, (r() - 0.5) * 0.09];
      B.geo(flowerMats[(k + j) % 4], bloomGeo, [head.x + o[0], head.y + o[1], head.z + o[2]]);
      if (j < 3) B.geo(leafMat, leafGeo, [head.x + o[2] * 1.3, head.y - 0.02, head.z + o[0] * 1.3], [0, r() * 3, 0], [1.6, 0.3, 0.7]);
    }
  }
  void stemMat;
  const candles = [];
  for (let k = 0; k < 9; k++) { const x = Mm[0] + (k - 4) * 0.3 + (r() - 0.5) * 0.1, z = Mm[2] + 0.75 + (r() - 0.5) * 0.12; B.cyl(white, x, 0.21, z, 0.035, 0.1, 8); B.cyl(new THREE.MeshPhysicalMaterial({ color: 0xc83a2a, transparent: true, opacity: 0.55, roughness: 0.1 }), x, 0.2, z, 0.05, 0.13, 10); candles.push([x, 0.3, z]); }
  const flame = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 6, 4), glowMat(0xffb060, 6), candles.length);
  candles.forEach((p, i) => { flame.setMatrixAt(i, new THREE.Matrix4().makeScale(1, 1.8, 1).setPosition(...p)); }); scene.add(flame);
  W.flame = flame; W.candles = candles; src(Mm[0], 0.6, Mm[2] + 0.8, 0xffa860, 4, 4, 'out');
  W.cards = [[Mm[0] - 1.2, 0.17, Mm[2] + 0.5], [Mm[0] + 0.1, 0.17, Mm[2] + 0.9], [Mm[0] + 1.2, 0.17, Mm[2] + 0.4]];
  W.cardMeshes = W.cards.map((p, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14), white); m.rotation.x = -Math.PI / 2; m.rotation.z = (r() - 0.5) * 0.6; m.position.set(p[0], p[1] + 0.005 + i * 0.001, p[2]); scene.add(m); return m; });
  // loading yard: truck, dumpsters, crates, fence
  B.box(M.wallDark, 25.4, 0, 2, 28.6, 3.4, 9.5); B.box(white, 25.3, 0.6, -6.8, 28.7, 3.6, 2.0); blockBox(25.3, 0, -6.8, 28.7, 3.6, 9.5);
  for (const [x, z] of [[26.4, 7.2], [26.4, 3.0], [26.4, -3.0]]) { B.cyl(M.rubber, x - 1.65, 0.45, z, 0.45, 0.35, 14, [0, 0, Math.PI / 2]); B.cyl(M.rubber, x + 1.65, 0.45, z, 0.45, 0.35, 14, [0, 0, Math.PI / 2]); }
  for (const [x, z, s] of [[19.4, -3.2, 1], [22.6, -13.4, 1.2], [19.2, -15.6, 0.9], [23.0, -8.0, 1]]) { B.box(M.wood, x - 0.6 * s, 0, z - 0.6 * s, x + 0.6 * s, 1.2 * s, z + 0.6 * s); blockBox(x - 0.6 * s, 0, z - 0.6 * s, x + 0.6 * s, 1.2 * s, z + 0.6 * s); }
  B.box(M.rust, 17.0, 0, -17.6, 19.8, 1.5, -15.9); blockBox(17.0, 0, -17.6, 19.8, 1.5, -15.9);
  B.box(M.darkSteel, 29.9, 0, -18, 30.1, 2.6, 0); blockBox(29.8, 0, -18, 30.2, 2.6, 0); B.box(M.darkSteel, 16.5, 0, -18.1, 30, 2.6, -17.9); blockBox(16.5, 0, -18.3, 30, 2.6, -17.7);
  lightPanel(16.7, 3.3, -10, 0.2, 1.2, amberGlow); src(17.2, 3.2, -10, 0xffc080, 16, 10, 'out');
  // the building: a glass podium (lobby) under a tower; side and rear walls of the podium
  B.box(M.podium, -16.5, 0, -0.3, -12, LH + 0.6, 0.3); B.box(M.podium, 12, 0, -0.3, 16.5, LH + 0.6, 0.3); blockBox(-16.6, 0, -0.35, -12, LH, 0.35); blockBox(12, 0, -0.35, 16.6, LH, 0.35);
  B.box(M.podium, -12, LH, -0.3, 12, LH + 0.6, 0.3);
  wall(16.5, 0, 16.5, -84, LH + 0.6, M.podium, [[-11, -9]]); wall(-16.5, 0, -16.5, -84, LH + 0.6, M.podium); wall(-16.5, -84, 16.5, -84, LH + 0.6, M.podium);
  B.box(M.podium, -17, LH + 0.6, -84.5, 17, LH + 1.0, 0.5); // podium roof slab
  // lobby curtain wall: glass with mullions and the entrance doors
  B.box(glass, -12, 0.12, -0.05, -2.2, LH, 0.05); B.box(glass, 2.2, 0.12, -0.05, 12, LH, 0.05); B.box(glass, -2.2, 2.7, -0.05, 2.2, LH, 0.05);
  blockBox(-12, 0, -0.2, -2.2, LH, 0.2); blockBox(2.2, 0, -0.2, 12, LH, 0.2);
  for (let x = -12; x <= 12.01; x += 2.4) B.box(M.darkSteel, x - 0.05, 0.12, -0.08, x + 0.05, LH, 0.08);
  for (const y of [2.7, 5.0]) B.box(M.darkSteel, -12, y - 0.05, -0.08, 12, y + 0.05, 0.08);
  B.box(M.darkSteel, -3.2, 3.0, 0.1, 3.2, 3.2, 3.6); lightPanel(0, 2.98, 1.8, 4.6, 2.4, panelGlow); src(0, 2.8, 2.0, 0xeaf2ff, 22, 10, 'out'); // entrance canopy
  const entrance = { L: new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.55, 0.06), glass), R: null };
  entrance.R = entrance.L.clone(); entrance.L.position.set(-1.05, 1.42, 0); entrance.R.position.set(1.05, 1.42, 0); scene.add(entrance.L, entrance.R);
  W.doors.entrance = { box: blockBox(-2.2, 0, -0.2, 2.2, 2.7, 0.2), open: 0, target: 0, upd: (u) => { entrance.L.position.x = -1.05 - u * 2.0; entrance.R.position.x = 1.05 + u * 2.0; } };
  // the tower over the podium and the neighbours (one interior-mapped mesh) + skyline
  try {
    const block = RZ.cityBlock([
      { width: 33, depth: 60, height: 46, position: [0, LH + 1.0, -48], seed: 81, wall: 'panel', mullion: 3, faces: ['windows', 'windows', 'windows', 'windows'], ledges: 0, balconies: 0, roof: { bulkhead: true, hvac: 3, antenna: 2 }, groundFloor: 3.4, floorHeight: 3.6 },
      { width: 22, depth: 18, height: 34, position: [-44, 0, -12], seed: 82, wall: 'concrete', yaw: Math.PI / 2 },
      { width: 18, depth: 16, height: 26, position: [44, 0, -26], seed: 83, wall: 'darkBrick', yaw: -Math.PI / 2 },
      { width: 26, depth: 16, height: 40, position: [-22, 0, 56], seed: 84, wall: 'panel', yaw: Math.PI },
      { width: 20, depth: 16, height: 30, position: [6, 0, 56], seed: 85, wall: 'brick', yaw: Math.PI },
      { width: 24, depth: 16, height: 52, position: [32, 0, 56], seed: 86, wall: 'concrete', yaw: Math.PI },
    ], { lit: 0.42, daylight: 0 });
    scene.add(block.mesh); W.block = block.mesh;
    const sky = RZ.skyline({ center: [0, -10], radius: [150, 290], count: low ? 40 : 70, height: [40, 170], lit: 0.3, seed: 18 }); scene.add(sky.mesh || sky); W.skyline = sky.mesh || sky;
  } catch (e) { console.warn('m8 city', e); }

  // ======================= LOBBY (x -12..12, z 0..-16, 7.2 m atrium) =======================
  slab(-12, 0, 12, -16, 0.12, M.lobbyFloor, 0.3);
  B.box(M.ceiling, -12, LH, -16, 12, LH + 0.2, 0); // ceiling
  wall(-12, 0, -12, -16, LH, M.wall); wall(12, 0, 12, -16, LH, M.wall);
  wall(-12, -16, 12, -16, LH, M.wall, [[-2, 2]]);
  // mezzanine walkway (visual) with glass balustrade on three sides
  B.box(white, -12, 3.6, -16, 12, 3.9, -13.2); B.box(glass, -12, 3.9, -13.25, 12, 4.95, -13.15); B.box(M.darkSteel, -12, 4.92, -13.3, 12, 5.0, -13.1);
  B.box(white, -12, 3.6, -13.2, -9.6, 3.9, -1); B.box(white, 9.6, 3.6, -13.2, 12, 3.9, -1);
  for (const [x, z] of [[-6, -4], [6, -4], [-6, -11], [6, -11]]) { B.cyl(white, x, LH / 2, z, 0.32, LH, 20); blockBox(x - 0.34, 0, z - 0.34, x + 0.34, LH, z + 0.34); }
  // atrium light ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.07, 8, 64), glowMat(0xf2f6ff, 3.2)); ring.rotation.x = Math.PI / 2; ring.position.set(0, 6.2, -7.5); scene.add(ring);
  const ring2 = ring.clone(); ring2.scale.setScalar(0.72); ring2.position.y = 5.7; scene.add(ring2); W.ring = [ring, ring2];
  src(0, 5.6, -7.5, 0xf2f6ff, 46, 18); src(-8, 3.2, -4, 0xeaf2ff, 18, 10); src(8, 3.2, -12, 0xeaf2ff, 18, 10);
  for (let x = -10; x <= 10; x += 5) for (const z of [-2.5, -14.5]) lightPanel(x, 3.58, z, 1.4, 0.3);
  // reception desk (curved, from segments)
  for (let k = 0; k < 9; k++) { const a = -0.9 + k * 0.225, x = Math.sin(a) * 3.2, z = -7.2 + Math.cos(a) * 1.6; B.boxc(white, x, 0.6, z, 0.78, 1.1, 0.5, a); B.boxc(M.wood, x, 1.17, z + 0.04, 0.8, 0.05, 0.62, a); }
  blockBox(-3.2, 0, -8.0, 3.2, 1.2, -5.5);
  B.boxc(black, -0.8, 1.42, -7.4, 0.55, 0.36, 0.03, 0.2, -0.2); B.boxc(black, 0.9, 1.42, -7.4, 0.55, 0.36, 0.03, -0.2, -0.2);
  // logo wall (north, right of the turnstiles) — the NEW logo; the old one is a residue ghost
  B.box(M.wallDark, 3.0, 0.12, -15.95, 11.5, 3.4, -15.75);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), new THREE.MeshBasicMaterial({ map: TEX.logoNew(), transparent: true, toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.5) }));
  logo.position.set(7.25, 1.9, -15.72); scene.add(logo);
  const logoOld = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), new THREE.MeshBasicMaterial({ map: TEX.logoOld(), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  logoOld.position.set(7.25, 1.9, -15.6); scene.add(logoOld); W.ghosts.logo = logoOld;
  // founding plaque (west wall) + its old self
  B.box(M.wood, -11.9, 0.9, -7.2, -11.84, 2.9, -4.8);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.0), new THREE.MeshStandardMaterial({ map: TEX.plaqueNew(!!opts.aligned), roughness: 0.4, metalness: 0.3 }));
  plaque.rotation.y = Math.PI / 2; plaque.position.set(-11.82, 1.9, -6.0); scene.add(plaque);
  const plaqueOld = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.0), new THREE.MeshBasicMaterial({ map: TEX.plaqueOld(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  plaqueOld.rotation.y = Math.PI / 2; plaqueOld.position.set(-11.7, 1.9, -6.0); scene.add(plaqueOld); W.ghosts.plaque = plaqueOld;
  // staff directory kiosk + its old listing
  const D = P.directory; B.box(M.darkSteel, D[0] - 0.4, 0.12, D[2] - 0.3, D[0] + 0.4, 1.0, D[2] + 0.3); blockBox(D[0] - 0.45, 0, D[2] - 0.35, D[0] + 0.45, 1.6, D[2] + 0.35);
  B.boxc(black, D[0], 1.45, D[2], 0.95, 0.72, 0.06, 0, -0.2);
  const dir = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.66), new THREE.MeshBasicMaterial({ map: TEX.directory(!!opts.trusted), toneMapped: false }));
  dir.position.set(D[0], 1.45, D[2] + 0.035); dir.rotation.x = -0.2; scene.add(dir); W.screens.dir = dir;
  const dirOld = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.66), new THREE.MeshBasicMaterial({ map: TEX.directoryOld(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  dirOld.position.set(D[0], 1.45 + 0.75, D[2] + 0.1); dirOld.rotation.x = -0.1; scene.add(dirOld); W.ghosts.directory = dirOld;
  // benches and planters in the lobby
  for (const [x, z] of [[-8.5, -2.4], [8.5, -2.4]]) { B.box(M.wood, x - 1.3, 0.42, z - 0.3, x + 1.3, 0.5, z + 0.3); B.box(M.darkSteel, x - 1.2, 0.12, z - 0.2, x + 1.2, 0.42, z + 0.2); blockBox(x - 1.3, 0, z - 0.3, x + 1.3, 0.5, z + 0.3); }
  // turnstiles
  for (const x of [-1.5, 0, 1.5]) { B.box(M.steel, x - 0.12, 0.12, -14.9, x + 0.12, 1.05, -13.9); B.box(cyanGlow, x - 0.13, 1.0, -14.85, x + 0.13, 1.03, -13.95); blockBox(x - 0.14, 0, -14.9, x + 0.14, 1.05, -13.9); }
  const gate = new THREE.Group(); for (const x of [-0.75, 0.75]) { const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.04), glass); leaf.position.set(x, 0.62, -14.4); gate.add(leaf); } scene.add(gate);
  W.doors.turnstile = { box: blockBox(-1.5, 0, -14.6, 1.5, 1.05, -14.2), open: 0, target: 0, upd: (u) => { gate.children[0].rotation.y = u * 1.4; gate.children[1].rotation.y = -u * 1.4; } };
  W.gateLights = []; for (const x of [-1.5, 0, 1.5]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff4d5e, emissiveIntensity: 2 })); m.position.set(x, 1.1, -14.4); scene.add(m); W.gateLights.push(m); }

  // ======================= CORRIDOR AND ROOMS =======================
  slab(-12.5, -16, 16.5, -60, 0.12, M.floor, 0.3); B.box(M.ceiling, -12.5, H + 0.12, -60, 16.5, H + 0.32, -16);
  const Y0 = 0.12;
  // corridor walls (x = -2 / x = 2) with doors
  wall(-2, -16, -2, -50, H, M.wall, [[-23, -21], [-36, -34], [-47, -45]], Y0);
  wall(2, -16, 2, -50, H, M.wall, [[-21, -19], [-30, -28], [-40, -38]], Y0);
  for (let z = -18; z > -50; z -= 4) { lightPanel(0, H + 0.1, z, 0.3, 1.6); }
  for (const z of [-20, -30, -40, -48]) src(0, H - 0.2, z, 0xeaf2ff, 16, 10);
  // SECURITY (x -12..-2, z -16..-28)
  wall(-12, -16, -2, -16, H, M.wall, [], Y0); wall(-12, -16, -12, -50, H, M.wall, [], Y0); wall(-12, -28, -2, -28, H, M.wall, [], Y0);
  src(-7, H - 0.3, -22, 0xd8e6ff, 14, 10); lightPanel(-7, H + 0.1, -19.5, 2.4, 0.4); lightPanel(-7, H + 0.1, -25, 2.4, 0.4);
  // monitor wall + desk
  B.box(M.wallDark, -11.9, Y0 + 0.8, -26.5, -11.75, Y0 + 2.9, -18.5);
  const monTex = screenTex('mons', 512, 256, (g) => { for (let i = 0; i < 6; i++) { const x = (i % 3) * 170 + 6, y = Math.floor(i / 3) * 126 + 6; g.fillStyle = '#0c1a22'; g.fillRect(x, y, 160, 116); g.fillStyle = '#5fe6ff'; g.font = `600 14px ${FONT}`; g.fillText('C' + (i + 1) + ' · NO SIGNAL', x + 8, y + 20); g.strokeStyle = 'rgba(95,230,255,0.2)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x, y + 30 + k * 14); g.lineTo(x + 160, y + 36 + k * 14); g.stroke(); } } });
  const mons = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.9), new THREE.MeshBasicMaterial({ map: monTex, toneMapped: false })); mons.rotation.y = Math.PI / 2; mons.position.set(-11.73, Y0 + 1.85, -22.5); scene.add(mons); W.mons = mons;
  B.box(white, -10.2, Y0 + 0.72, -25.6, -6.0, Y0 + 0.78, -23.6); B.box(M.darkSteel, -10.1, Y0, -25.5, -6.1, Y0 + 0.72, -25.3); blockBox(-10.2, 0, -25.6, -6.0, 0.8, -23.6);
  for (const x of [-9.2, -7.0]) B.boxc(black, x, Y0 + 1.05, -25.3, 0.7, 0.45, 0.03, 0, 0.1);
  // the corrupted-log server rack (north-west corner) and the reconstruction board (south wall)
  const S = P.server; B.box(black, S[0] - 0.6, Y0, S[2] - 0.5, S[0] + 0.6, Y0 + 2.2, S[2] + 0.5); blockBox(S[0] - 0.6, 0, S[2] - 0.5, S[0] + 0.6, 2.2, S[2] + 0.5);
  W.serverLeds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 40);
  for (let i = 0; i < 40; i++) { W.serverLeds.setMatrixAt(i, new THREE.Matrix4().setPosition(S[0] - 0.45 + (i % 8) * 0.12, Y0 + 0.3 + Math.floor(i / 8) * 0.38, S[2] + 0.51)); W.serverLeds.setColorAt(i, new THREE.Color(0x200808)); }
  scene.add(W.serverLeds);
  W.screens.server = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.5), new THREE.MeshBasicMaterial({ map: TEX.server('dark'), toneMapped: false }));
  W.screens.server.position.set(S[0] + 1.1, Y0 + 1.35, S[2] + 0.2); W.screens.server.rotation.y = -0.5; scene.add(W.screens.server);
  B.box(M.darkSteel, S[0] + 0.85, Y0, S[2], S[0] + 1.35, Y0 + 1.05, S[2] + 0.4);
  const Bd = P.board; B.box(M.wallDark, Bd[0] - 2.6, Y0 + 0.9, -27.86, Bd[0] + 2.6, Y0 + 2.8, -27.76);
  W.boardCards = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshBasicMaterial({ color: 0x223038, toneMapped: false })); m.position.set(Bd[0] - 2.0 + i * 0.8, Y0 + 1.85 + (i % 2 ? -0.18 : 0.18), -27.72); m.rotation.y = Math.PI; scene.add(m); W.boardCards.push(m); }
  // RECORDS (x -12..-2, z -28..-42)
  wall(-12, -42, -2, -42, H, M.wall, [], Y0);
  for (let k = 0; k < 4; k++) { const z = -30.2 - k * 2.4; B.box(M.steel, -11.6, Y0, z - 0.3, -6.4, Y0 + 2.4, z + 0.3); blockBox(-11.6, 0, z - 0.3, -6.4, 2.4, z + 0.3); for (let j = 0; j < 12; j++) B.box(j % 3 ? white : M.wallDark, -11.4 + j * 0.42, Y0 + 0.2 + (j % 3) * 0.75, z - 0.24, -11.1 + j * 0.42, Y0 + 0.62 + (j % 3) * 0.75, z + 0.24); }
  const R = P.records; B.box(M.darkSteel, R[0] - 0.4, Y0, R[2] - 0.5, R[0] + 0.4, Y0 + 1.0, R[2] + 0.5); blockBox(R[0] - 0.45, 0, R[2] - 0.5, R[0] + 0.45, 1.0, R[2] + 0.5);
  const recScr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ map: screenTex('rec', 384, 256, (g) => { lines(g, ['PERSONNEL RECORDS'], 16, 36, 22, '#5fe6ff'); lines(g, ['VAREN, K. · CLOSED 19.10', 'LIND, Y. · OPEN · MISSING', 'HALE, R. · ACTIVE', 'Version: —'], 16, 90, 20, '#d8e6f0', 1.5); }), toneMapped: false }));
  recScr.position.set(R[0] + 0.1, Y0 + 1.4, R[2]); recScr.rotation.y = Math.PI / 2; scene.add(recScr);
  src(-7, H - 0.3, -36, 0xeaf2ff, 12, 9); lightPanel(-7, H + 0.1, -31, 2.4, 0.4); lightPanel(-7, H + 0.1, -39, 2.4, 0.4);
  // LAB B (x -12..-2, z -42..-50): Iven's team behind a jammed blast door
  wall(-12, -50, -2, -50, H, M.wall, [], Y0);
  const lab = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 2.0), new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.7, roughness: 0.35 }));
  lab.position.set(-2.0, Y0 + 1.2, -46); scene.add(lab); game.blocker(lab);
  W.doors.lab = { box: blockBox(-2.15, 0, -47, -1.85, 2.4, -45), open: 0, target: 0, upd: (u) => { lab.position.y = Y0 + 1.2 + u * 2.3; } };
  W.labLight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.3), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff4d5e, emissiveIntensity: 2.4 })); W.labLight.position.set(-1.85, Y0 + 2.55, -46); scene.add(W.labLight);
  const V = P.labValve; B.cyl(M.rust, V[0], Y0 + 1.6, V[2], 0.09, 3.2, 10); const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 20), new THREE.MeshStandardMaterial({ color: 0xc83a2a, roughness: 0.5 })); wheel.position.set(V[0], Y0 + 1.2, V[2] + 0.16); scene.add(wheel); W.wheel = wheel;
  for (let k = 0; k < 3; k++) { const z = -43.5 - k * 1.8; B.box(white, -9.6, Y0 + 0.82, z - 0.4, -5.0, Y0 + 0.9, z + 0.4); blockBox(-9.6, 0, z - 0.4, -5.0, 0.9, z + 0.4); }
  src(-7, H - 0.3, -46, 0xffb070, 8, 8);
  // YARA'S OFFICE (x 2..12, z -16..-25)
  wall(2, -16, 12, -16, H, M.wall, [], Y0); wall(12, -16, 12, -33, H, M.wall, [], Y0); wall(2, -25, 12, -25, H, M.wall, [], Y0);
  const Y = P.yaraDesk; B.box(white, Y[0] - 1.2, Y0 + 0.72, Y[2] - 0.5, Y[0] + 1.2, Y0 + 0.78, Y[2] + 0.5); B.box(M.darkSteel, Y[0] - 1.1, Y0, Y[2] - 0.45, Y[0] - 1.0, Y0 + 0.72, Y[2] + 0.45); B.box(M.darkSteel, Y[0] + 1.0, Y0, Y[2] - 0.45, Y[0] + 1.1, Y0 + 0.72, Y[2] + 0.45);
  blockBox(Y[0] - 1.2, 0, Y[2] - 0.5, Y[0] + 1.2, 0.8, Y[2] + 0.5);
  const yScr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshBasicMaterial({ map: TEX.badgeLog(), toneMapped: false })); yScr.position.set(Y[0] + 0.28, Y0 + 1.12, Y[2]); yScr.rotation.y = -Math.PI / 2; scene.add(yScr);
  B.boxc(white, Y[0] - 0.2, Y0 + 0.8, Y[2] + 0.2, 0.28, 0.02, 0.2); // her slate
  B.box(new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.8 }), 11.7, Y0 + 1.0, -17.4, 11.85, Y0 + 2.1, -16.6); // lab coat on the hook
  B.box(M.wood, 6.0, Y0, -24.8, 9.0, Y0 + 2.0, -24.4); blockBox(6.0, 0, -24.9, 9.0, 2.0, -24.3);
  src(7, H - 0.3, -20.5, 0xfff0d8, 12, 9); lightPanel(7, H + 0.1, -20.5, 2.4, 0.4);
  const yPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshBasicMaterial({ map: TEX.doorPlate('DR. Y. LIND', 'Containment physics'), toneMapped: false })); yPlate.position.set(1.86, 1.75, -18.4); yPlate.rotation.y = Math.PI / 2; scene.add(yPlate);
  // KAI'S OFFICE (x 2..12, z -25..-33)
  wall(2, -33, 12, -33, H, M.wall, [], Y0);
  const kPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshBasicMaterial({ map: TEX.doorPlate('DR. K. VAREN', 'Project lead', true), toneMapped: false })); kPlate.position.set(1.86, 1.75, -27.4); kPlate.rotation.y = Math.PI / 2; scene.add(kPlate);
  const kPlateOld = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshBasicMaterial({ map: TEX.doorPlateOld(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); kPlateOld.position.set(1.75, 2.0, -27.4); kPlateOld.rotation.y = Math.PI / 2; scene.add(kPlateOld); W.ghosts.office = kPlateOld;
  const Kd = P.kaiDesk; B.box(M.wood, Kd[0] - 1.2, Y0 + 0.72, Kd[2] - 0.5, Kd[0] + 1.2, Y0 + 0.78, Kd[2] + 0.5); B.box(M.darkSteel, Kd[0] - 1.1, Y0, Kd[2] - 0.45, Kd[0] + 1.1, Y0 + 0.72, Kd[2] - 0.35); blockBox(Kd[0] - 1.2, 0, Kd[2] - 0.5, Kd[0] + 1.2, 0.8, Kd[2] + 0.5);
  const memoScr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), new THREE.MeshBasicMaterial({ map: TEX.memo(), toneMapped: false })); memoScr.position.set(Kd[0] + 0.3, Y0 + 1.0, Kd[2]); memoScr.rotation.y = -Math.PI / 2; scene.add(memoScr);
  B.boxc(white, Kd[0] - 0.5, Y0 + 0.86, Kd[2] + 0.25, 0.09, 0.12, 0.09); // a mug
  const drw = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.47), new THREE.MeshStandardMaterial({ map: TEX.drawing(), roughness: 0.85 })); drw.position.set(11.84, 1.7, -29.0); drw.rotation.y = -Math.PI / 2; scene.add(drw);
  B.box(black, 11.86, 1.42, -29.36, 11.9, 1.98, -28.64);
  const drwOld = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.47), new THREE.MeshBasicMaterial({ map: TEX.drawing(), transparent: true, opacity: 0.6, color: 0x5fe6ff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  drwOld.rotation.x = -Math.PI / 2; drwOld.rotation.z = 0.3; drwOld.position.set(9.6, Y0 + 0.03, -27.2); scene.add(drwOld); W.ghosts.drawing = drwOld;
  B.box(fabric, 3.0, Y0, -32.6, 5.4, Y0 + 0.45, -31.8); B.box(fabric, 3.0, Y0 + 0.45, -32.8, 5.4, Y0 + 0.9, -32.55); blockBox(3.0, 0, -32.8, 5.4, 0.9, -31.8);
  src(7, H - 0.3, -29, 0xfff0d8, 10, 9); lightPanel(7, H + 0.1, -29, 2.4, 0.4);
  // MAINTENANCE (x 2..12.5, z -33..-46)
  wall(2, -46, 12.5, -46, H, M.wall, [], Y0); wall(12.5, -33, 12.5, -46, H, M.wallDark, [[-38, -36]], Y0);
  for (let k = 0; k < 5; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10.4, 10), M.steel); p.rotation.z = Math.PI / 2; p.position.set(7.2, Y0 + 3.0 - k * 0.24, -45.6 + k * 0.05); scene.add(p); }
  const Bk = P.breakers; B.box(M.wallDark, 12.2, Y0 + 0.6, Bk[2] - 1.4, 12.38, Y0 + 2.4, Bk[2] + 1.4);
  W.breakerLeds = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.14), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff4d5e, emissiveIntensity: 2 })); m.position.set(12.16, Y0 + 2.0, Bk[2] - 0.9 + i * 0.6); scene.add(m); W.breakerLeds.push(m); B.box(M.steel, 12.1, Y0 + 1.2, Bk[2] - 1.0 + i * 0.6, 12.2, Y0 + 1.6, Bk[2] - 0.8 + i * 0.6); }
  B.box(M.darkSteel, 3.0, Y0, -45.6, 6.0, Y0 + 2.6, -44.4); blockBox(3.0, 0, -45.6, 6.0, 2.6, -44.4); // cooling unit
  B.box(M.wood, 8.6, Y0 + 0.8, -35.0, 11.0, Y0 + 0.86, -33.8); blockBox(8.6, 0, -35.0, 11.0, 0.9, -33.8); // workbench
  src(7, H - 0.3, -40, 0xffd8a0, 12, 10); lightPanel(5, H + 0.1, -38, 0.3, 2.0, amberGlow); lightPanel(9.5, H + 0.1, -41, 0.3, 2.0, amberGlow);
  // SERVICE PASSAGE (x 12.5..16.5, z -0.3..-46)
  wall(12.5, -0.3, 12.5, -33, H, M.wallDark, [], Y0); wall(12.5, -46, 16.5, -46, H, M.wallDark, [], Y0);
  for (let z = -4; z > -44; z -= 8) { lightPanel(14.5, H + 0.1, z, 0.25, 1.2, amberGlow); }
  src(14.5, H - 0.3, -10, 0xffc080, 8, 9); src(14.5, H - 0.3, -30, 0xffc080, 8, 9);
  const sDoor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 2.0), new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.6, roughness: 0.45 })); sDoor.position.set(16.5, Y0 + 1.2, -10); scene.add(sDoor);
  W.doors.service = { box: blockBox(16.35, 0, -11, 16.65, 2.4, -9), open: 0, target: 0, upd: (u) => { sDoor.position.z = -10 - u * 1.9; } };
  // service keypad (yard side) and its residue: four worn keys pressed in order by the last hand that used it
  B.box(M.darkSteel, 16.62, Y0 + 1.05, -8.75, 16.72, Y0 + 1.55, -8.45);
  const kp = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.42), new THREE.MeshBasicMaterial({ map: screenTex('keypad', 128, 208, (g) => { g.font = `600 22px ${FONT}`; g.textAlign = 'center'; for (let i = 0; i < 12; i++) { const k = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'][i]; g.fillStyle = '#16242c'; g.fillRect(8 + (i % 3) * 40, 40 + Math.floor(i / 3) * 40, 32, 32); g.fillStyle = '#9fb4c8'; g.fillText(k, 24 + (i % 3) * 40, 64 + Math.floor(i / 3) * 40); } g.fillStyle = '#ffb070'; g.fillText('SERVICE', 64, 26); }), toneMapped: false }));
  kp.position.set(16.73, Y0 + 1.3, -8.6); kp.rotation.y = Math.PI / 2; scene.add(kp);
  const kpOld = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), new THREE.MeshBasicMaterial({ map: canvasTex(128, 208, (g) => {
    g.clearRect(0, 0, 128, 208); g.font = `700 22px ${FONT}`; g.textAlign = 'center';
    [['0', 10, 1], ['8', 7, 2], ['1', 0, 3], ['4', 3, 4]].forEach(([k, i, n]) => { const x = 24 + (i % 3) * 40, y = 56 + Math.floor(i / 3) * 40; g.fillStyle = 'rgba(95,230,255,0.85)'; g.beginPath(); g.arc(x, y, 17, 0, 7); g.fill(); g.fillStyle = '#021016'; g.fillText(k, x, y + 8); g.fillStyle = '#9ff4ff'; g.font = `700 14px ${FONT}`; g.fillText(String(n), x + 16, y - 12); g.font = `700 22px ${FONT}`; });
  }, 'm8kpOld'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  kpOld.position.set(16.8, Y0 + 1.3, -8.6); kpOld.rotation.y = Math.PI / 2; scene.add(kpOld); W.ghosts.keypad = kpOld;
  // ANTECHAMBER (x -8..8, z -50..-60), the containment control room
  slab(-8, -50, 8, -60.6, 0.12, M.floor, 0.3);
  wall(2, -46, 2, -50, H, M.wall, [], Y0); wall(2, -50, 8, -50, 4.2, M.wall, [], Y0); wall(-8, -50, -2, -50, 4.2, M.wall, [], Y0);
  wall(-8, -50, -8, -60, 4.2, M.wallDark, [], Y0); wall(8, -50, 8, -60, 4.2, M.wallDark, [], Y0);
  B.box(M.ceiling, -8, 4.3, -60.4, 8, 4.5, -50);
  // north wall with two observation windows and the blast door
  for (const [a, b2] of [[-8, -1.5], [1.5, 8]]) { B.box(M.wallDark, a, Y0, -60.12, b2, Y0 + 1.0, -59.88); B.box(M.wallDark, a, Y0 + 2.6, -60.12, b2, 4.3, -59.88); blockBox(a, 0, -60.15, b2, 4.3, -59.85); }
  for (const [a, b2] of [[-7.6, -1.9], [1.9, 7.6]]) B.box(glass, a, Y0 + 1.0, -60.03, b2, Y0 + 2.6, -59.97);
  for (const x of [-8, -1.5, 1.5, 8]) B.box(M.darkSteel, x - 0.08, Y0 + 0.95, -60.15, x + 0.08, Y0 + 2.65, -59.85);
  B.box(M.wallDark, -1.5, 3.1, -60.15, 1.5, 4.3, -59.85);
  const bd = new THREE.Group(); const bdM = new THREE.MeshPhysicalMaterial({ color: 0x15181c, metalness: 0.85, roughness: 0.25, clearcoat: 0.8 });
  const bdl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.0, 0.3), bdM), bdr = bdl.clone(); bdl.position.set(-0.75, Y0 + 1.5, -60); bdr.position.set(0.75, Y0 + 1.5, -60); bd.add(bdl, bdr); scene.add(bd); game.blocker(bdl); game.blocker(bdr);
  const bdRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 6, 48), cyanGlow.clone()); bdRing.position.set(0, Y0 + 1.6, -59.8); scene.add(bdRing); W.bdRing = bdRing;
  W.doors.chamber = { box: blockBox(-1.5, 0, -60.3, 1.5, 3.1, -59.7), open: 0, target: 0, upd: (u) => { bdl.position.x = -0.75 - u * 1.45; bdr.position.x = 0.75 + u * 1.45; } };
  // the antechamber door at the end of the research corridor (frosted glass, badge reader N0)
  B.box(M.wall, -2, Y0 + 2.6, -50.12, 2, 4.3, -49.88);
  const adM = new THREE.MeshPhysicalMaterial({ color: 0xb8c8d4, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.6, depthWrite: false });
  const adl = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.5, 0.06), adM), adr = adl.clone(); adl.position.set(-1.0, Y0 + 1.25, -50.2); adr.position.set(1.0, Y0 + 1.25, -50.2); scene.add(adl, adr);
  const adSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: TEX.sign('CONTAINMENT · N0', '#5fe6ff', '#0c1418'), toneMapped: false })); adSign.position.set(0, Y0 + 2.8, -49.74); scene.add(adSign);
  W.doors.ante = { box: blockBox(-2, 0, -50.35, 2, 2.6, -50.0), open: 0, target: 0, upd: (u) => { adl.position.x = -1.0 - u * 1.9; adr.position.x = 1.0 + u * 1.9; } };
  const AC = P.anteConsole; B.box(M.darkSteel, AC[0] - 2.2, Y0, AC[2] - 0.45, AC[0] + 2.2, Y0 + 0.95, AC[2] + 0.45); blockBox(AC[0] - 2.2, 0, AC[2] - 0.45, AC[0] + 2.2, 1.0, AC[2] + 0.45);
  W.screens.ante = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: TEX.ante('idle'), toneMapped: false })); W.screens.ante.position.set(AC[0], Y0 + 1.35, AC[2] + 0.3); W.screens.ante.rotation.x = -0.35; scene.add(W.screens.ante);
  W.screens.version = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: TEX.version(), toneMapped: false, transparent: true, opacity: 0 })); W.screens.version.position.set(0, 3.25, -50.3); W.screens.version.rotation.y = Math.PI; scene.add(W.screens.version);
  B.box(black, -1.7, 2.4, -50.24, 1.7, 4.1, -50.16);
  src(0, 3.9, -55, 0xd0e4ff, 16, 12); lightPanel(-4, 4.28, -55, 2.4, 0.4); lightPanel(4, 4.28, -55, 2.4, 0.4);
  // badge readers (Yara's trail)
  for (const k of ['readerSec', 'readerMaint', 'readerAnte']) { const p = P[k]; const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1), new THREE.MeshStandardMaterial({ color: 0x0c0d10, emissive: 0x38c8c0, emissiveIntensity: 1.2 })); m.position.set(p[0] + (p[0] < 0 ? -0.1 : 0.1), p[1] + 0.12, p[2]); scene.add(m); W[k] = m; }

  // ======================= CONTAINMENT CHAMBER =======================
  const CHY = Y0, CHH = 7.5;
  slab(-10, -60.6, 10, -80.5, CHY, M.chamber, 0.3);
  const segN = 36;
  const alcoveGap = (deg) => CLAMPS.some(c => Math.abs(((deg - c + 540) % 360) - 180) < 6.5) || Math.abs(((deg - 180 + 540) % 360) - 180) < 9.5;
  for (let i = 0; i < segN; i++) {
    const a0 = i / segN * 360, a1 = (i + 1) / segN * 360, am = (a0 + a1) / 2;
    if (alcoveGap(am)) continue;
    const [x, z] = polarC(am, CH.r + 0.2), len = 2 * Math.PI * (CH.r + 0.2) / segN + 0.05;
    B.boxc(M.chamber, x, CHY + CHH / 2, z, len, CHH, 0.4, -am * Math.PI / 180);
    blockBox(x - 0.55, 0, z - 0.55, x + 0.55, CHH, z + 0.55);
    if (i % 3 === 0) { const [lx, lz] = polarC(am, CH.r - 0.02); B.boxc(cyanGlow, lx, CHY + 0.25, lz, 0.9, 0.04, 0.04, -am * Math.PI / 180); }
  }
  // the door passage (south) and clamp alcoves (recessed beyond the wall)
  wall(-1.5, -60, -1.5, -61.6, 3.1, M.chamber, [], Y0); wall(1.5, -60, 1.5, -61.6, 3.1, M.chamber, [], Y0);
  for (const deg of CLAMPS) {
    const [x, z] = polarC(deg, CH.r + 1.0), rot = -deg * Math.PI / 180;
    B.boxc(M.chamber, ...polarC(deg, CH.r + 1.9), CHY + 2, 2.6, 4, 0.3, rot);
    const sideA = polarC(deg - 8, CH.r + 1.0), sideB = polarC(deg + 8, CH.r + 1.0);
    B.boxc(M.chamber, sideA[0], CHY + 2, sideA[1], 0.3, 4, 1.8, rot); B.boxc(M.chamber, sideB[0], CHY + 2, sideB[1], 0.3, 4, 1.8, rot);
    const [bx, bz] = polarC(deg, CH.r + 2.0); blockBox(bx - 0.6, 0, bz - 0.6, bx + 0.6, 4, bz + 0.6);
    for (const s of [sideA, sideB]) blockBox(s[0] - 0.35, 0, s[1] - 0.35, s[0] + 0.35, 4, s[1] + 0.35);
    const clamp = new THREE.Group(); clamp.position.set(x, CHY, z); clamp.rotation.y = rot; scene.add(clamp);
    clamp.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.5), M.darkSteel)); clamp.children[0].position.set(0, 1.1, -0.4);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 12), glowMat(0x5fe6ff, 3)); core.position.set(0, 1.2, -0.1); clamp.add(core);
    W.clampMeshes.push({ deg, group: clamp, core, pos: [x, CHY, z] });
  }
  B.box(M.chamber, -10, CHY + CHH, -80.5, 10, CHY + CHH + 0.3, -59.5);
  // the containment vessel: a black core under rings (a contained Chronolith fragment)
  B.cyl(black, CH.x, CHY + 0.25, CH.z, 1.3, 0.5, 32); blockBox(CH.x - 1.1, 0, CH.z - 1.1, CH.x + 1.1, 3.5, CH.z + 1.1);
  const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 3.2, 24), new THREE.MeshPhysicalMaterial({ color: 0x050607, metalness: 0.4, roughness: 0.15, clearcoat: 1 })); vessel.position.set(CH.x, CHY + 2.1, CH.z); scene.add(vessel);
  W.vRings = [0, 1, 2].map(k => { const m = new THREE.Mesh(new THREE.TorusGeometry(1.2 + k * 0.35, 0.03, 6, 64), cyanGlow.clone()); m.position.set(CH.x, CHY + 1.3 + k * 0.9, CH.z); m.rotation.x = Math.PI / 2 + k * 0.2; scene.add(m); return m; });
  W.field = new THREE.Mesh(new THREE.SphereGeometry(CH.r - 0.3, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, opacity: 0.05, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  W.field.position.set(CH.x, CHY, CH.z); scene.add(W.field);
  // sweep beams (visible only during the escape)
  for (let k = 0; k < 2; k++) {
    const len = CH.r - 1.3, geo = new THREE.PlaneGeometry(len, 2.1); geo.translate(1.3 + len / 2, 1.05, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: k ? 0x9a7bff : 0x5fe6ff, transparent: true, opacity: 0.38, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.set(CH.x, CHY, CH.z); m.visible = false; scene.add(m); W.beams.push(m);
  }
  src(CH.x, CHY + 5.5, CH.z, 0x9fe8ff, 40, 20, 'chamber'); src(CH.x, CHY + 2.0, CH.z + 5, 0x7fd8ff, 16, 10, 'chamber');
  // security cameras (C1..C6)
  for (const c of CAMS) {
    const g = new THREE.Group(); g.position.set(...c.pos); scene.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.34), white); g.add(body);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff4d5e, toneMapped: false })); led.position.set(0.05, 0.05, 0.17); g.add(led);
    g.lookAt(c.at[0], c.at[1] + 1, c.at[2]); W.cams.push({ ...c, group: g, led });
  }
  // shards
  W.shardMeshes = SHARDS.map(p => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: 0x5fe6ff, emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.6 })); m.position.set(...p); scene.add(m); return m; });

  // build the batches
  const meshes = B.build(scene, { cast: !low, name: 'm8static' });
  for (const m of meshes) if (m.material !== glass) game.blocker(m);
  W.static = meshes;
  // door + ambient animation
  W.update = (dt, t) => {
    for (const d of Object.values(W.doors)) { d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * 1.4); d.upd(d.open); d.box.enabled = d.open < 0.6; }
    W.ring[0].rotation.z = t * 0.05; W.ring[1].rotation.z = -t * 0.07;
    W.vRings.forEach((m, k) => { m.rotation.z = t * (0.3 + k * 0.17) * (k % 2 ? -1 : 1); });
    for (const s of W.shardMeshes) { s.rotation.y = t * 1.2; s.position.y += Math.sin(t * 2 + s.position.x) * 0.0015; }
    W.flame.scale?.set(1, 1, 1);
  };
  return W;
}
