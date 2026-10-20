// Mission 7 environment: the Broken Observatory ("the Sky House"), a monumental Bronze Age observatory on a
// mountain spur above the settlement, authored in three states: in use at dawn (c. 1000 BCE), a Helix
// archaeoastronomy site at night (2049), and a scavenged ruin at dusk (2196).
// Layout (north = -z, east = +x): the processional way and its seventeen steps -> the lower court (West Hall, keeper
// houses, the East Terrace with the Sun Gate) -> three stepped rooftops on the east side -> the ziggurat terrace ->
// the exterior ring around the drum (the Pole Sight) -> the star stair -> the summit orrery (the Armillary) -> the
// Hall of Dates under the drum. Static geometry is merged per material per state (few draw calls).
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, chronolith } from './kit.js';
import { Batch } from './env_m6.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

export const ERAS = ['past', '2049', '2196'];
export const Y = { C: 3.06, ET: 5.06, R1: 7.56, R2: 10.06, R3: 12.56, T1: 12.56, RING: 16.56, TOP: 21.06 };
export const DC = [0, -16];            // drum centre
export const RINGR = [7.0, 9.2];       // exterior ring radii
export const BREAKS = { '2049': [[55, 78]], '2196': [[28, 45]] };   // ring sections missing per state (bearing around DC)
export const RIM_BREAK = [195, 225];   // the 2196 summit rim is broken here
const { C, ET, R1, R2, R3, T1, RING, TOP } = Y;
const DEG = Math.PI / 180;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const polar = (th, r) => [DC[0] + Math.sin(th * DEG) * r, DC[1] - Math.cos(th * DEG) * r];

// Key positions for the script.
export const P = {
  start: [0, 0, 78], stepsTop: [0, C, 39], court: [0, C, 24],
  sunGate: [14.5, ET, 27], sunStone: [-3.5, C, 27.6], terraceStair: [7.2, C, 24.8],
  r1: [14.5, R1, 12], r2: [16, R2, 1], r3: [17, R3, -10], plankEnd: [9.4, T1, -10],
  ringStairTop: [8.2, RING, -12.4], poleSight: [2.7, RING, -23.6], starDoor: [-0.8, RING, -24.1],
  landing: [-7.9, TOP, -21.6], armillary: [0, TOP, -16], westHall: [-13.5, C, 24], mural: [-17.9, C, 24],
  cabin: [-15, 0, 63], hall: [0, C, -9], chronolith: [0, C, -24.2],
};
export const RING_STAIR_THETA = 117;

// ---------------------------------------------------------------------------------------------
// Cast (era-correct costumes; see docs/COSTUMES.md)
// ---------------------------------------------------------------------------------------------
export function registerM7Cast() {
  registerCast('sefa', {
    name: 'SEFA', role: 'Sky Keeper of the Observatory',
    bio: 'The oldest keeper of the Sky House. Has counted the sun\'s risings for fifty years and keeps a seat in the sky for a star that has not arrived.',
    // ancient elder keeper (COSTUMES.md anc_f4 elder): ankle-length indigo-teal linen tunic, undyed wool mantle pinned with bronze, leg wraps, sandals
    look: { era: 'ancient', costume: 'anc_f4', sex: 1, female: true, template: 'mirela', age: 67, height: 1.6, build: 0.9, skin: 0x6b4029, hair: 0xb8b0a4, hairStyle: 'bun', eyes: 0x24160c,
      face: { jaw: -0.15, cheek: 0.45, nose: 0.25, noseWidth: 0.35, lips: 0.1, brow: 0.2, eyeSize: -0.1, faceLength: 0.2, chin: 0 }, wrinkles: 0.8,
      topType: 'tunic', top: 0x2f5a5a, topKind: 'fabric', sash: 0xd0a24a, pantsType: 'wraps', pants: 0x5a4632, shoes: 'sandals', boots: 0x4a3220, bracelets: 0xc9a050 },
    rimColor: 0xffb05a, glow: 0x3a2410, bg: 0x140d08,
    vp: { sex: 'f', pitch: 0.82, rate: 0.86, langs: ['en-ZA', 'en-IN', 'en-GB'] },
  });
  registerCast('dace', {
    name: 'DACE', role: 'Scavenger crew boss · 2196',
    bio: 'Strips the observatory\'s bronze every week, and every week the house puts it back. Wears a rewind gauntlet he does not understand.',
    // 2196 survivor (COSTUMES.md surv_m1 scavenger): patched hooded dust-ochre poncho, scav_plate carrier, wrapped cargo trousers, resoled boots, respirator at the neck
    look: { era: '2196', costume: 'surv_m1', sex: 0, template: 'arin', age: 44, height: 1.79, build: 1.02, skin: 0xa77a5d, hair: 0x2a1c14, hairStyle: 'buzz', eyes: 0x3a2a18, beard: 0x2a1c14,
      face: { jaw: 0.4, cheek: 0.1, nose: 0.35, noseWidth: 0.2, lips: -0.2, brow: 0.45, eyeSize: -0.2, faceLength: 0.15, chin: 0.2 }, wrinkles: 0.35, scar: true,
      topType: 'armored', top: 0x8a7458, topKind: 'fabric', coat: 0x8a7458, coatKind: 'fabric', hood: true, vest: 0x4a4a3a, pantsType: 'cargo', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, gloves: 0x3a3028 },
    rimColor: 0xb6ff8a, glow: 0x1a2410, bg: 0x0e1008,
    vp: { sex: 'm', pitch: 0.78, rate: 0.95, langs: ['en-AU', 'en-GB', 'en-US'] },
  });
  registerCast('scav', { name: 'SCAVENGER', role: '2196', vp: { sex: 'f', pitch: 1.0, rate: 1.05, langs: ['en-AU', 'en-GB'] } });
  registerCast('mirarec', { name: 'RECORDING · M. VAREN', role: 'Found behind the seventeenth stone', voice: true, vp: { sex: 'f', pitch: 1.04, rate: 0.9, langs: ['en-GB', 'en-US'] } });
  registerCast('helixlog', { name: 'HELIX SITE LOG', role: 'Site 3 · automated', voice: true, vp: { sex: 'f', pitch: 1.1, rate: 1.08, langs: ['en-US', 'en-GB'] } });
}
// grunts: era 2196 survivor archetypes, built at LOD (they are seen mostly at range)
export const SCAV_LOOKS = [
  { era: '2196', costume: 'surv_f1', sex: 1, female: true, template: 'maren', age: 27, height: 1.7, build: 0.96, skin: 0x6b4029, hair: 0x15100b, hairStyle: 'tied-back', eyes: 0x24160c,
    topType: 'jacket', top: 0x6a5a44, topKind: 'fabric', vest: 0x7a6a3a, pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, gloves: 0x3a3028, lod: true },
  { era: '2196', costume: 'surv_m1', sex: 0, template: 'arin', age: 36, height: 1.76, build: 0.94, skin: 0xd8b08e, hair: 0x3a3430, hairStyle: 'short', eyes: 0x3a3028, stubble: true,
    topType: 'jacket', hood: true, top: 0x6a6a64, topKind: 'fabric', coat: 0x6a6a64, coatKind: 'fabric', pantsType: 'cargo', pants: 0x8a7458, shoes: 'boots', boots: 0x2a2018, lod: true },
];
// ancient acolytes at the Sun Gate (anc_m3 sentry-turned-acolyte, anc_f1 water carrier)
export const ACOLYTES = [
  { era: 'ancient', costume: 'anc_m3', sex: 0, age: 21, height: 1.76, build: 0.92, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'short', topType: 'tunic', top: 0xcdb48a, topKind: 'fabric', sash: 0x9b3b24, pantsType: 'wraps', pants: 0x7a6248, shoes: 'sandals', boots: 0x4a3220, lod: true },
  { era: 'ancient', costume: 'anc_f1', sex: 1, female: true, age: 24, height: 1.62, build: 0.9, skin: 0x7d4f33, hair: 0x15100b, hairStyle: 'long', topType: 'tunic', top: 0xd9c9a0, topKind: 'fabric', sash: 0x2f5a5a, pantsType: 'wraps', pants: 0x5a4632, shoes: 'sandals', boots: 0x4a3220, bracelets: 0xc9a050, lod: true },
];

// ---------------------------------------------------------------------------------------------
// Music: one motif (E-B-A, Kai & Mira) carried through dawn bronze, night glass and dusk wind
// ---------------------------------------------------------------------------------------------
export const musicState = { aligned: 0, fight: 0 };
export function registerM7Themes() {
  registerTheme('m7-dawn', { bpm: 70, step(a, s, t, d) { // c. 1000 BCE: a frame drum, plucked lyre, a reed flute, a drone
    const bar = Math.floor(s / 16), b = s % 16, root = [45, 43, 41, 43][bar % 4];
    if (b === 0) { a.pad([root + 12, root + 19], t, d * 16, 0.016, 600); a.cello(root - 12, t, d * 16, 0.035); }
    if (b === 0 || b === 10) a.drum(t, 0.1, 90, 46); if (b === 6 || b === 14) a.drum(t, 0.05, 140, 52);
    if (b % 4 === 2) a.pluck([57, 60, 64, 62][(b >> 2) % 4] + (bar % 2 ? 2 : 0), t, 0.05);
    if (bar % 4 >= 2) { const mel = [76, 74, 72, 69, 71, 69], at = [0, 3, 6, 8, 11, 14], i = at.indexOf(b); if (i >= 0) a.flute(mel[i], t, d * 2.5, 0.045); }
    if (musicState.aligned >= 1 && b === 8 && bar % 2 === 0) a.glass(81, t, 0.02);
  } });
  registerTheme('m7-night', { bpm: 60, step(a, s, t, d) { // 2049: the site at night: piano, glass, a radio-telescope hum
    const bar = Math.floor(s / 16), b = s % 16, CH = [[40, 52, 59, 64], [36, 52, 55, 60], [43, 50, 55, 59], [38, 50, 57, 62]], ch = CH[bar % 4];
    if (b === 0) { a.pad(ch.slice(1), t, d * 16, 0.015, 480); a.cello(ch[0], t, d * 16, 0.04); }
    if (b % 4 === 0) a.piano(ch[1 + (b >> 2) % 3] + 12, t, 0.11, 3.2);
    if ([0, 7, 13].includes(b) && bar % 2 === 1) a.glass([88, 83, 81][[0, 7, 13].indexOf(b)], t, 0.018);
    if (musicState.aligned >= 2 && b === 4) a.glass(76 + (bar % 3) * 2, t, 0.02);
  } });
  registerTheme('m7-dusk', { bpm: 54, step(a, s, t, d) { // 2196: wind, a bowed low string, a lone rusted bell
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0 && bar % 2 === 0) { a.cello(33, t, d * 32, 0.05); a.pad([57, 64, 67], t, d * 32, 0.018, 380); }
    if (b === 8 && bar % 3 === 1) a.glass([83, 79, 76][bar % 3], t, 0.022);
    if (b === 12 && bar % 4 === 3) a.piano(52, t, 0.12, 5);
    if (musicState.aligned >= 2 && b === 4 && bar % 2) a.flute(69, t, d * 6, 0.025);
  } });
  registerTheme('m7-fight', { bpm: 112, step(a, s, t, d) { // scavengers: tension, a rewind pulse in the hats
    const bar = Math.floor(s / 16), b = s % 16;
    if (b % 4 === 0) a.drum(t, b === 0 ? 0.16 : 0.09, b === 0 ? 70 : 110, 40);
    if (b % 2 === 1) a.tick(t, 0.016, 6400);
    if ([0, 3, 6, 10].includes(b)) a.pluck([40, 40, 43, 38][[0, 3, 6, 10].indexOf(b)] + (bar % 2 ? 0 : 3), t, 0.06);
    if (b === 0 && bar % 2 === 0) a.cello(bar % 4 ? 31 : 28, t, d * 28, 0.05);
    if (musicState.fight >= 2 && b === 8) a.glass(76 - (bar % 2) * 3, t, 0.02);
  } });
  registerTheme('m7-dates', { bpm: 48, step(a, s, t, d) { // the Hall of Dates: deep, slow, the motif in the bass
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([52, 59, 64, 71], t, d * 16, 0.02, 520); a.cello(28, t, d * 16, 0.05); }
    if (bar % 2 === 0 && [0, 6, 12].includes(b)) a.piano([40, 47, 45][[0, 6, 12].indexOf(b)], t, 0.2, 5);
    if (b === 10 && bar % 3 === 2) a.glass(88, t, 0.014);
  } });
  registerTheme('m7-mira', { bpm: 56, step(a, s, t, d) { // Mira's recording: the E-B-A motif, close and warm
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([64, 67, 71, 74].map(n => n - (bar % 2 ? 2 : 0)), t, d * 16, 0.016, 900); }
    if ([0, 5, 10].includes(b)) a.piano([76, 83, 81][[0, 5, 10].indexOf(b)] - (bar % 4 === 3 ? 2 : 0), t, 0.13, 3.5);
    if (b === 0 && bar % 2 === 0) a.cello(40, t, d * 32, 0.035);
  } });
}

// ---------------------------------------------------------------------------------------------
// Code-drawn textures
// ---------------------------------------------------------------------------------------------
function glyphs(g, r, x0, y0, w, h, ink, n = 12) {
  g.strokeStyle = ink; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + (i % 4) * (w / 4) + w / 8, y = y0 + Math.floor(i / 4) * (h / 3) + h / 6;
    const k = Math.floor(r() * 5);
    g.beginPath();
    if (k === 0) { g.arc(x, y, 9, 0, Math.PI * 2); g.moveTo(x, y - 14); g.lineTo(x, y + 14); }
    else if (k === 1) { for (let j = 0; j < 5; j++) { g.moveTo(x - 12 + j * 6, y - 10); g.lineTo(x - 12 + j * 6, y + 10); } }
    else if (k === 2) { g.moveTo(x - 12, y + 10); g.lineTo(x, y - 12); g.lineTo(x + 12, y + 10); }
    else if (k === 3) { g.arc(x, y, 11, Math.PI, 0); g.moveTo(x - 14, y + 6); g.lineTo(x + 14, y + 6); }
    else { for (let j = 0; j < 3; j++) { g.moveTo(x - 10, y - 8 + j * 8); g.lineTo(x + 10, y - 8 + j * 8); } }
    g.stroke();
  }
}
export function wristGlyph(g, x, y, s, col) {
  g.strokeStyle = col; g.lineWidth = s * 0.12; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.stroke();
  g.beginPath(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * (Math.PI * 2 / 3); g.moveTo(x + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.35); g.lineTo(x + Math.cos(a) * s * 1.4, y + Math.sin(a) * s * 1.4); } g.stroke();
}
function steleTex(i, era) {
  return canvasTex(256, 512, (g, w, h) => {
    const r = rng(100 + i * 13);
    const base = era === 'past' ? '#c7b291' : era === '2049' ? '#9d9483' : '#7d7a68';
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,30,20' : '255,240,210'},${r() * 0.07})`; g.fillRect(r() * w, r() * h, 3 + r() * 8, 3 + r() * 8); }
    const ink = era === 'past' ? '#5a2a14' : 'rgba(40,30,22,0.85)';
    // count of risings: tally rows at the top, then the event glyph block, then the keeper's mark
    g.strokeStyle = ink; g.lineWidth = 4;
    for (let k = 0; k < 4 + (i % 5); k++) { g.beginPath(); g.moveTo(30 + k * 22, 40); g.lineTo(30 + k * 22, 80); g.stroke(); }
    glyphs(g, r, 18, 110, w - 36, 250, ink, 12);
    if (i === 16) wristGlyph(g, w / 2, 430, 34, era === 'past' ? '#7a2a10' : '#2a1a10');
    else { g.beginPath(); g.arc(w / 2, 430, 22 + (i % 3) * 6, 0, Math.PI * 2); g.stroke(); }
    if (era === '2196') { g.fillStyle = 'rgba(60,80,40,0.45)'; for (let k = 0; k < 40; k++) g.fillRect(r() * w, h * 0.6 + r() * h * 0.4, 6 + r() * 20, 4 + r() * 10); }
    if (era === 'past') { g.fillStyle = 'rgba(200,120,40,0.25)'; g.fillRect(0, 0, w, 10); }
  }, `m7stele${i}${era}`);
}
function muralTex(era) {
  return canvasTex(1024, 384, (g, w, h) => {
    const r = rng(77);
    g.fillStyle = era === 'past' ? '#d8c39a' : era === '2049' ? '#a8987c' : '#7a7462'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(80,50,30,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 4, 4); }
    // the sky band: sun, stars, a ring of seventeen
    g.fillStyle = era === 'past' ? '#2f5a5a' : '#5a6a66'; g.fillRect(0, 0, w, 70);
    g.fillStyle = '#e8c070'; for (let k = 0; k < 17; k++) { g.beginPath(); g.arc(40 + k * 57, 36, 6, 0, Math.PI * 2); g.fill(); }
    // seventeen figures walking toward a ring
    for (let k = 0; k < 17; k++) {
      const x = 46 + k * 52, y = 260;
      g.fillStyle = era === 'past' ? '#7a2a14' : '#5a3a2a';
      g.beginPath(); g.arc(x, y - 70, 10, 0, Math.PI * 2); g.fill();
      g.fillRect(x - 7, y - 58, 14, 46); g.fillRect(x - 8, y - 12, 6, 34); g.fillRect(x + 2, y - 12, 6, 34);
      if (k === 16) { g.fillStyle = era === '2196' ? '#4a6a5a' : '#3fb8c8'; g.fillRect(x - 13, y - 34, 6, 6); wristGlyph(g, x + 40, y - 40, 14, era === 'past' ? '#7a2a10' : '#3a2a1a'); }
    }
    g.strokeStyle = era === 'past' ? '#7a4a14' : '#4a3a2a'; g.lineWidth = 8; g.beginPath(); g.arc(w - 50, 230, 34, 0, Math.PI * 2); g.stroke();
    if (era !== 'past') { // loss
      g.fillStyle = era === '2049' ? 'rgba(160,150,130,0.9)' : 'rgba(110,104,90,0.95)';
      for (let k = 0; k < (era === '2049' ? 9 : 22); k++) { g.beginPath(); g.ellipse(r() * w, 90 + r() * 280, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, Math.PI * 2); g.fill(); }
    }
  }, 'm7mural' + era);
}
function signTex(lines, o = {}) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = o.bg || '#e8eaec'; g.fillRect(0, 0, w, h);
    g.fillStyle = o.band || '#1a2a3a'; g.fillRect(0, 0, w, 54);
    g.fillStyle = '#fff'; g.font = '700 30px "Inter", Arial, sans-serif'; g.textAlign = 'left'; g.fillText(o.head || 'HELIX TEMPORAL RESEARCH', 22, 38);
    g.fillStyle = o.ink || '#1a2026'; g.font = '600 30px "Inter", Arial, sans-serif';
    lines.forEach((l, i) => g.fillText(l, 22, 104 + i * 44));
    if (o.stripe) { for (let x = -40; x < w; x += 40) { g.fillStyle = '#f0b020'; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 20, h); g.lineTo(x + 40, h - 22); g.lineTo(x + 20, h - 22); g.fill(); } }
  }, 'm7sign' + lines.join('|'));
}
function fenceTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(200,205,210,0.9)'; g.lineWidth = 2;
    for (let k = -w; k < w * 2; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
  }, 'm7fence', { repeat: [1, 1] });
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------
/** Solid arc of an annulus between bearings th0..th1 (deg, around DC), from y0 to y1. */
export function arcGeo(r0, r1, y0, y1, th0, th1, seg) {
  const s = new THREE.Shape(), a0 = (90 - th1) * DEG, a1 = (90 - th0) * DEG;
  s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: seg || Math.max(4, Math.ceil((th1 - th0) / 4)) });
  g.rotateX(-Math.PI / 2); g.translate(DC[0], y0, DC[1]);
  return g;
}
function spans(breaks, from = 0, to = 360) {
  const out = []; let a = from;
  for (const [b0, b1] of [...breaks].sort((x, y) => x[0] - y[0])) { if (b0 > a) out.push([a, b0]); a = Math.max(a, b1); }
  if (a < to) out.push([a, to]);
  return out;
}

// ---------------------------------------------------------------------------------------------
// The observatory
// ---------------------------------------------------------------------------------------------
export function buildObservatory(game, T, scene) {
  const Q = RZ.getQuality();
  const groups = { all: new THREE.Group(), past: new THREE.Group(), '2049': new THREE.Group(), '2196': new THREE.Group(), hall: new THREE.Group() };
  for (const k in groups) { groups[k].name = 'm7-' + k; scene.add(groups[k]); }
  for (const e of ERAS) T.only(groups[e], e);
  const col = (min, max, states) => game.collision.add(min, max, states ? { states } : {});
  const cbox = (x0, y0, z0, x1, y1, z1, states) => col([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], states);

  // ---------- materials ----------
  const pbr = (k, o) => RZ.pbrMaterial(k, { mapping: 'world', ...o });
  const M = {
    pave: pbr('cutStone', { params: { color: 0xc4b392, joint: 0x8a7c66, rows: 4, weathering: 0.35 }, scale: 1.6 }),
    ground: pbr('gravel', { params: { color: 0x8a7e6a } }),
    past: { stone: pbr('cutStone', { params: { color: 0xd2bf9a, joint: 0x9a8a70, weathering: 0.2, rows: 5 } }), plaster: pbr('plaster', { params: { color: 0xe0cfa8, under: 0xc8b088, damage: 0.0, dirt: 0.12 } }) },
    '2049': { stone: pbr('cutStone', { params: { color: 0xa89c86, joint: 0x6e665a, weathering: 0.75, rows: 5 } }), plaster: pbr('plaster', { params: { color: 0xa69a84, under: 0x7a7060, damage: 0.65, dirt: 0.6 } }) },
    '2196': { stone: pbr('cutStone', { params: { color: 0x8e8a78, joint: 0x5a564a, weathering: 0.9, rows: 5 }, overlay: { kind: 'moss', amount: 0.55, ground: 0.6 } }), plaster: pbr('plaster', { params: { color: 0x8a8474, under: 0x5e5a50, damage: 0.85, dirt: 0.8 }, overlay: { kind: 'moss', amount: 0.5, ground: 0.6 } }) },
    wood: pbr('wood', { params: { color: 0x6a4a2c, planks: 6, weathered: 0.4 } }),
    woodOld: pbr('wood', { params: { color: 0x5a4a3a, planks: 4, weathered: 1 } }),
    rust: pbr('rust', { params: { color: 0x5a2a12, paint: 0x4a5a52, amount: 0.7 } }),
    panel: pbr('paintedMetalPanel', { params: { color: 0xdfe2e4, cols: 2, rows: 1, wear: 0.25, grime: 0.35 } }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.9, roughness: 0.42 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xe0701a, roughness: 0.6 }),
    tarp: new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.85, side: THREE.DoubleSide }),
    scavTarp: new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 0.95, side: THREE.DoubleSide }),
    clothR: new THREE.MeshStandardMaterial({ color: 0x9b3b24, roughness: 0.9, side: THREE.DoubleSide }),
    clothT: new THREE.MeshStandardMaterial({ color: 0x2f5a5a, roughness: 0.9, side: THREE.DoubleSide }),
    clothS: new THREE.MeshStandardMaterial({ color: 0xd0a24a, roughness: 0.9, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 1 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0xc9a050, metalness: 1, roughness: 0.34 }),
    bronzeOld: new THREE.MeshStandardMaterial({ color: 0x6a8a6a, metalness: 0.55, roughness: 0.62 }),
    rope: new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }),
    fire: glowMat(0xff8a30, 4), coals: glowMat(0xff5a10, 2.5), lamp: glowMat(0xfff4e0, 6), led: glowMat(0x5fd0ff, 3), scav: glowMat(0xb6ff8a, 2.5),
    fence: new THREE.MeshStandardMaterial({ map: fenceTex(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 }),
  };
  // the dynamic bronze (instruments, doors) is re-tinted per state
  const dynBronze = new THREE.MeshStandardMaterial({ color: 0xc9a050, metalness: 1, roughness: 0.32 });
  const dynDark = new THREE.MeshStandardMaterial({ color: 0x3a2a18, metalness: 0.6, roughness: 0.5 });
  const B = {}; for (const k of ['all', ...ERAS, 'hall']) B[k] = new Batch();
  const world = { groups, M, dynBronze, updaters: [], steles: [], lights: {} };

  // ---------- terrain: the spur, the valley, the mountains ----------
  const plateau = (x, z) => { const dx = Math.max(0, Math.abs(x) - 27), dz = Math.max(0, -38 - z, z - 88); return Math.hypot(dx, dz); };
  const nz = RZ.makeNoise(707);
  const hfun = (x, z) => { const d = plateau(x, z); const n = nz.fbm2(x * 0.012, z * 0.012, 4) * 9; return d <= 0 ? -0.05 : -Math.min(46, Math.pow(d, 1.2) * 1.1) + n * Math.min(1, d / 20) * 1.6; };
  const ter = RZ.terrain({ size: 520, center: [0, 10], segments: Q === 'low' ? 96 : 140, heightFn: hfun, waterLevel: -200, rockSlope: 0.45,
    layers: [['grass', { color: 0x5a6a30, dry: 0x8f8448, dryness: 0.45, bare: 0.6 }], ['dirt', { color: 0x6a5238 }], ['rock', { color: 0x8a7c66, color2: 0x675a49 }], ['sand', { color: 0x9c8a6a }]] });
  ter.mesh.receiveShadow = true; groups.all.add(ter.mesh);
  groups.all.add(RZ.mountains({ center: [0, 0], radius: [300, 760], height: 210, seed: 17, rock: 0x6a6258, grass: 0x4a5434, snowLine: 185 }));
  const slopeTrees = [], R = rng(71);
  for (let i = 0; i < 70; i++) { const a = R() * Math.PI * 2, d = 50 + R() * 90; const x = Math.cos(a) * d, z = 20 + Math.sin(a) * d * 1.2; if (plateau(x, z) > 8) slopeTrees.push({ x, z, scale: 0.7 + R() * 0.5 }); }
  try { groups.all.add(RZ.forest({ species: 'conifer', placements: slopeTrees, heightAt: hfun, focus: [0, 20], lodDistance: 60, seed: 3, budgetScale: 0.35 })); } catch (err) { console.warn('m7 forest', err); }
  // trees on the spur outside the walls (every state), and the ruin's court trees (2196, with trunk collision)
  try {
    const pt = [[-14, 50], [-20, 72], [14, 56], [19, 78], [12, 84], [-12, 84], [23, 48], [-24, 46], [-24, 30], [25, 8], [-25, -20], [24, -30]];
    groups.all.add(RZ.forest({ species: 'broadleaf', placements: pt.map(([x, z]) => ({ x, z, scale: 0.75 + R() * 0.35 })), heightAt: hfun, impostors: false, variants: 2, seed: 21, focus: [0, 20] }));
    const rt = [[-6, 34], [12.5, 38], [-13, -1], [-20.5, -31], [3, -33.5], [-20, 12]];
    groups['2196'].add(RZ.forest({ species: 'broadleaf', placements: rt.map(([x, z]) => ({ x, z, scale: 0.6 + R() * 0.25 })), heightAt: () => C, impostors: false, variants: 2, seed: 23 }));
    for (const [x, z] of rt) cbox(x - 0.3, C, z - 0.3, x + 0.3, C + 3, z + 0.3, ['2196']);
    groups['2196'].add(RZ.forest({ species: 'dead', placements: [[16, 30], [-16, 38]].map(([x, z]) => ({ x, z, scale: 0.7 })), heightAt: (x) => (x > 9 ? ET : C), impostors: false, variants: 1, seed: 24 }));
  } catch (err) { console.warn('m7 trees', err); }
  // plateau ground collision + the walls that keep Kai on the spur
  cbox(-27, -1, -38, 27, 0, 88);
  cbox(-28, 0, -40, 28, 2.2, -38); cbox(-28, 0, 88, 28, 2.2, 90); cbox(-29, 0, -40, -27, 2.2, 90); cbox(27, 0, -40, 29, 2.2, 90);

  // ---------- per-state builder ----------
  const R7 = rng(7);
  for (const e of ERAS) {
    const A = B[e], st = M[e].stone, pl = M[e].plaster, past = e === 'past', ruin = e === '2196', site = e === '2049';
    const bz = past ? M.bronze : M.bronzeOld;
    // approach: walls, paving, standing stones
    A.box(M.pave, -5, -0.3, 46, 5, 0.02, 88);
    for (const s of [-1, 1]) {
      const x0 = s * 5.5, x1 = s * 6.3;
      if (e === 'past') A.box(st, x0, 0, 46, x1, 1.6, 88);
      else { A.box(st, x0, 0, 46, x1, s < 0 ? 1.6 : 1.4, 57.6); A.box(st, x0, 0, 61.4, x1, ruin ? 1.1 : 1.5, 88); if (s < 0) A.box(st, x0, 0, 57.6, x1, 0.35, 61.4); }
      for (let z = 50; z <= 82; z += 6) {
        const h = ruin && R7() < 0.4 ? 1.2 : 2.6, lean = ruin ? (R7() - 0.5) * 0.2 : 0;
        A.boxc(st, s * 4.6, h / 2, z, 0.55, h, 0.42, 0, lean, lean * 0.5);
        if (past) A.boxc(M.bronze, s * 4.6, h - 0.15, z, 0.6, 0.06, 0.47);
      }
    }
    // the seventeen steps
    for (let i = 0; i < 17; i++) { const z0 = 46 - 0.32 * (i + 1); A.box(i % 2 && !past ? st : M.pave, -5, 0.18 * i - 0.2, z0, 5, 0.18 * (i + 1), z0 + 0.32); }
    for (const s of [-1, 1]) A.box(st, s * 5.1, 0, 40.56, s * 5.8, C + 1.0, 46);
    // the court platform and its parapets
    A.box(M.pave, -22, C - 0.6, -36, 22, C, 40.56);
    A.box(st, -22, 0, 40.2, 22, C - 0.6, 40.56);
    for (const [x0, x1] of [[-22, -5.8], [5.8, 22]]) A.box(st, x0, C, 40.1, x1, C + (ruin ? 0.6 : 1.1), 40.56);
    A.box(st, -22.4, C, -36, -21.9, C + 1.3, 40.56); A.box(st, 21.9, C, -36, 22.4, C + 1.3, 40.56); A.box(st, -22.4, C, -36.4, 22.4, C + 1.3, -35.9);
    // West Hall: walls with a portico, roof
    const wh = { x0: -19, x1: -9, z0: 14, z1: 34, h: C + 6.2 };
    A.box(pl, wh.x0, C, wh.z0, wh.x1, past ? wh.h : ruin ? C + 4.2 : wh.h - 0.6, wh.z0 + 0.6);
    A.box(pl, wh.x0, C, wh.z1 - 0.6, wh.x1, past ? wh.h : ruin ? C + 3.6 : wh.h, wh.z1);
    A.box(pl, wh.x0, C, wh.z0, wh.x0 + 0.6, past ? wh.h : ruin ? C + 4.6 : wh.h, wh.z1);
    A.box(pl, wh.x1 - 0.6, C, wh.z0, wh.x1, wh.h - (ruin ? 1.6 : 0), 22.5); A.box(pl, wh.x1 - 0.6, C, 25.5, wh.x1, wh.h - (ruin ? 2.2 : 0), wh.z1);
    A.box(pl, wh.x1 - 0.6, C + 3.2, 22.5, wh.x1, wh.h - (ruin ? 1.6 : 0), 25.5);
    if (past) { A.box(M.wood, wh.x0, wh.h - 0.1, wh.z0, wh.x1, wh.h + 0.35, wh.z1); A.box(M.clothR, wh.x1 + 0.01, C + 5.0, wh.z0, wh.x1 + 0.05, C + 5.5, wh.z1); }
    else if (site) { A.box(M.woodOld, wh.x0, wh.h - 0.1, wh.z0, wh.x0 + 5, wh.h + 0.3, wh.z1); }
    for (const z of [16, 20, 28, 32]) { const h = ruin && z > 24 ? 2.6 : 5.6; A.cyl(st, -8.0, C + h / 2, z, 0.36, h, 14); }
    if (!ruin) A.box(st, -8.5, C + 5.6, 15.4, -7.5, C + 6.2, 32.6);
    A.box(M.pave, wh.x0, C, wh.z0, wh.x1, C + 0.02, wh.z1);
    const mu = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshStandardMaterial({ map: muralTex(e), roughness: 0.9 }));
    mu.position.set(-18.37, C + 2.6, 24); mu.rotation.y = Math.PI / 2; mu.receiveShadow = true; groups[e].add(mu);
    // keeper houses
    for (const [x, z, w, d, h] of [[-17, 4, 8, 7, 4.6], [-17.5, -9, 7, 9, 5.6], [-17, -23, 8, 8, 4.2], [-3, -32, 12, 5, 3.8]]) {
      const hh = ruin ? h * 0.72 : site ? h * 0.9 : h;
      A.box(pl, x - w / 2, C, z - d / 2, x + w / 2, C + hh, z + d / 2);
      A.box(M.dark, x + w / 2 - 0.02, C, z - 0.7, x + w / 2 + 0.03, C + 2.1, z + 0.7);
      if (past) { A.box(st, x - w / 2 - 0.15, C + hh, z - d / 2 - 0.15, x + w / 2 + 0.15, C + hh + 0.35, z + d / 2 + 0.15); for (let k = -1; k <= 1; k++) A.cyl(M.wood, x + w / 2 + 0.3, C + hh - 0.4, z + k * 1.8, 0.12, 0.9, 6, [0, 0, Math.PI / 2]); }
    }
    // East Terrace + its stair + parapets
    A.box(st, 9, C, 20, 19, ET, 34); A.box(M.pave, 9, ET - 0.02, 20, 19, ET + 0.02, 34);
    for (let i = 0; i < 11; i++) A.box(i % 2 ? st : M.pave, 5.5 + 0.318 * i, C, 23, 9, C + 0.1818 * (i + 1), 26.5);
    A.box(st, 18.6, ET, 20, 19, ET + (ruin ? 0.5 : 1.1), 34); A.box(st, 9, ET, 33.6, 19, ET + 1.1, 34);
    A.box(st, 9, ET, 20, 13.4, ET + 1.1, 20.4); A.box(st, 15.6, ET, 20, 19, ET + 1.1, 20.4);
    A.box(st, 9, ET, 26.5, 9.4, ET + 1.1, 34); A.box(st, 9, ET, 20, 9.4, ET + 1.1, 23);
    // the sun stone in the court
    A.cyl(past ? M.pave : st, P.sunStone[0], C + 0.03, P.sunStone[2], 1.4, 0.08, 32);
    A.cyl(bz, P.sunStone[0], C + 0.08, P.sunStone[2], 0.25, 0.04, 16);
    // East rooftops (three stepped houses climbing to the ziggurat)
    const house = (x0, z0, x1, z1, top, gapSouth, gapNorth) => {
      A.box(pl, x0, C, z0, x1, top, z1);
      A.box(M.pave, x0, top - 0.02, z0, x1, top + 0.02, z1);
      for (let z = z0 + 1.5; z < z1 - 1; z += 3) A.box(M.dark, x1 - 0.02, C + 1.0, z, x1 + 0.03, C + 2.4, z + 0.9);
      const ph = ruin ? 0.35 : 0.55;
      A.box(st, x1 - 0.35, top, z0, x1, top + ph, z1);
      if (gapSouth) { A.box(st, x0, top, z1 - 0.35, gapSouth[0], top + ph, z1); A.box(st, gapSouth[1], top, z1 - 0.35, x1, top + ph, z1); } else A.box(st, x0, top, z1 - 0.35, x1, top + ph, z1);
      if (gapNorth) { A.box(st, x0, top, z0, gapNorth[0], top + ph, z0 + 0.35); A.box(st, gapNorth[1], top, z0, x1, top + ph, z0 + 0.35); } else A.box(st, x0, top, z0, x1, top + ph, z0 + 0.35);
      if (past) A.box(M.clothT, x1 + 0.01, top - 1.2, z0 + 0.4, x1 + 0.04, top - 0.8, z1 - 0.4);
    };
    house(10, 8, 19, 16, R1, [13.4, 15.6], [14, 16.5]);
    house(13, -3, 19, 5, R2, [14, 16.5], [16.6, 18.4]);
    house(15, -14, 19, -6, R3, [16.6, 18.4], null);
    // R1 -> R2: the keepers' stair-bridge (only stands in the past)
    if (past) {
      for (let k = 0; k < 8; k++) { const z1 = 8 - 0.375 * k, z0 = z1 - 0.375, top = R1 + 0.3125 * (k + 1); A.box(st, 14, top - 0.55, z0, 16.5, top, z1); }
      A.box(st, 13.8, R1, 5, 14, R2 + 0.8, 8); A.box(st, 16.5, R1, 5, 16.7, R2 + 0.8, 8);
    } else { A.box(st, 14, R1 + 0.2, 7.2, 16.5, R1 + 0.6, 8); A.box(st, 14, R2 - 0.5, 5, 16.5, R2, 5.8); }
    // the ziggurat: base walls with pilasters and bands, the terrace on top
    A.box(st, -10, C, -28, 10, T1, -4);
    for (let x = -9; x <= 9; x += 3) A.box(st, x - 0.4, C, -3.6, x + 0.4, T1 - 0.4, -4);
    A.box(past ? M.clothS : st, -10.05, T1 - 2.2, -28.05, 10.05, T1 - 1.8, -3.95);
    A.box(M.pave, -10, T1 - 0.02, -28, 10, T1 + 0.02, -4);
    for (const [x0, z0, x1, z1] of [[-10, -4.35, 10, -4], [-10, -28, 10, -27.65], [-10, -28, -9.65, -4]]) A.box(st, x0, T1, z0, x1, T1 + 0.9, z1);
    A.box(st, 9.65, T1, -28, 10, T1 + 0.9, -11.2); A.box(st, 9.65, T1, -8.8, 10, T1 + 0.9, -4);
    // great door (sealed in every state)
    A.box(past ? M.bronze : M.bronzeOld, -1.6, C, -3.7, 1.6, C + 4.6, -3.55); A.box(st, -2.1, C + 4.6, -3.9, 2.1, C + 5.4, -3.4);
    // the terrace stair up to the ring
    for (let k = 0; k < 13; k++) { const z1 = -4.6 - 0.569 * k, z0 = z1 - 0.569, top = T1 + 0.3077 * (k + 1); A.box(st, 7.6, T1, z0, 8.8, top, z1); }
    // the drum
    const drumSpans = ruin ? spans([RIM_BREAK]) : [[0, 360]];
    for (const [a, b] of drumSpans) A.push(st, arcGeo(5.6, 7.0, T1, TOP, a, b));
    if (ruin) A.push(st, arcGeo(5.6, 7.0, T1, TOP - 3.5, RIM_BREAK[0], RIM_BREAK[1]));
    for (let th = 0; th < 360; th += 15) { if (ruin && th > RIM_BREAK[0] - 4 && th < RIM_BREAK[1] + 4) continue; const [x, z] = polar(th, 7.1); A.boxc(st, x, (RING + TOP) / 2 + 1, z, 0.5, TOP - RING - 1, 0.5, -th * DEG); }
    if (!ruin) { // the sky floor (past) / the Helix deck (2049)
      A.push(past ? M.pave : st, arcGeo(0.01, 5.6, TOP - 0.6, TOP, 0, 360, 48));
      for (let th = 0; th < 360; th += 30) { const [x, z] = polar(th, 2.8); A.boxc(past ? M.bronze : M.bronzeOld, x, TOP + 0.01, z, 0.08, 0.02, 5.4, -th * DEG); }
      for (let th = 0; th < 360; th += 10) { const [x, z] = polar(th, 6.75); A.boxc(st, x, TOP + 0.35, z, 0.7, 0.7, 0.4, -th * DEG); }
    } else {
      A.push(M[e].stone, arcGeo(0.01, 5.6, T1 - 0.2, T1 + 0.05, 0, 360, 32));   // the pit floor, far below
    }
    // the exterior ring (annulus at RING) with posts; breaks per state
    for (const [a, b] of spans(BREAKS[e] || [])) { A.push(st, arcGeo(RINGR[0], RINGR[1], RING - 0.55, RING, a, b)); for (let th = a + 2; th < b - 1; th += 6) { const [x, z] = polar(th, 9.0); A.cyl(bz, x, RING + 0.5, z, 0.05, 1.0, 6); } A.push(bz, arcGeo(8.95, 9.1, RING + 0.95, RING + 1.05, a, b)); }
    for (let th = 0; th < 360; th += 24) { if ((BREAKS[e] || []).some(([b0, b1]) => th > b0 - 6 && th < b1 + 6)) continue; const [x, z] = polar(th, 8.4); A.cyl(st, x, (T1 + RING) / 2, z, 0.28, RING - T1 - 0.55, 10); }
    // the star stair and its landing
    for (let k = 0; k < 15; k++) { const x1 = -0.6 - 0.45 * k, x0 = x1 - 0.45, top = RING + 0.3 * (k + 1); A.box(st, x0, T1, -24.7, x1, top, -23.5); }
    A.box(st, -8.8, T1, -24.9, -6.9, TOP, -18.6); A.box(st, -8.8, TOP - 0.5, -22.2, -4.4, TOP, -18.6);
    A.box(st, -8.8, TOP, -24.9, -8.5, TOP + 1.0, -18.6);
    // per-state dressing
    if (past) dressPast(A, B.all, M, world);
    if (site) dressSite(A, M, world, game);
    if (ruin) dressRuin(A, M, world);
  }

  // ---------- collision (shared + per state) ----------
  const ALL = null;
  // approach walls (the west one has a gap in 2049/2196)
  cbox(5.5, 0, 46, 6.3, 1.6, 88);
  cbox(-6.3, 0, 46, -5.5, 1.6, 57.6); cbox(-6.3, 0, 61.4, -5.5, 1.6, 88); cbox(-6.3, 0, 57.6, -5.5, 1.6, 61.4, ['past']);
  for (const s of [-1, 1]) for (let z = 50; z <= 82; z += 6) cbox(s * 4.6 - 0.3, 0, z - 0.22, s * 4.6 + 0.3, 2.4, z + 0.22);
  for (let i = 0; i < 17; i++) cbox(-5, 0, 40.56, 5, 0.18 * (i + 1), 46 - 0.32 * i);
  for (const s of [-1, 1]) cbox(s * 5.1, 0, 40.56, s * 5.8, C + 1.0, 46);
  cbox(-22, 0, -36, 22, C, 40.56);
  for (const [x0, x1] of [[-22, -5.8], [5.8, 22]]) cbox(x0, C, 40.1, x1, C + 1.3, 40.56);
  cbox(-22.4, C, -36, -21.9, C + 1.4, 40.56); cbox(21.9, C, -36, 22.4, C + 1.4, 40.56); cbox(-22.4, C, -36.4, 22.4, C + 1.4, -35.9);
  // West Hall
  cbox(-19, C, 14, -9, C + 4, 14.6); cbox(-19, C, 33.4, -9, C + 4, 34); cbox(-19, C, 14, -18.4, C + 4, 34);
  cbox(-9.6, C, 14, -9, C + 4, 22.5); cbox(-9.6, C, 25.5, -9, C + 4, 34);
  for (const z of [16, 20, 28, 32]) cbox(-8.36, C, z - 0.36, -7.64, C + 3, z + 0.36);
  for (const [x, z, w, d] of [[-17, 4, 8, 7], [-17.5, -9, 7, 9], [-17, -23, 8, 8], [-3, -32, 12, 5]]) cbox(x - w / 2, C, z - d / 2, x + w / 2, C + 3, z + d / 2);
  // East Terrace + stair + parapets
  cbox(9, C, 20, 19, ET, 34);
  for (let i = 0; i < 11; i++) cbox(5.5 + 0.318 * i, C, 23, 9, C + 0.1818 * (i + 1), 26.5);
  cbox(18.6, ET, 20, 19, ET + 1.2, 34); cbox(9, ET, 33.6, 19, ET + 1.2, 34);
  cbox(9, ET, 20, 13.4, ET + 1.2, 20.4); cbox(15.6, ET, 20, 19, ET + 1.2, 20.4);
  cbox(9, ET, 26.5, 9.4, ET + 1.2, 34); cbox(9, ET, 20, 9.4, ET + 1.2, 23);
  // houses
  cbox(10, C, 8, 19, R1, 16); cbox(13, C, -3, 19, R2, 5); cbox(15, C, -14, 19, R3, -6);
  const ph = 0.6;
  cbox(18.65, R1, 8, 19, R1 + ph, 16); cbox(10, R1, 15.65, 13.4, R1 + ph, 16); cbox(15.6, R1, 15.65, 19, R1 + ph, 16); cbox(10, R1, 8, 14, R1 + ph, 8.35); cbox(16.5, R1, 8, 19, R1 + ph, 8.35);
  cbox(18.65, R2, -3, 19, R2 + ph, 5); cbox(13, R2, 4.65, 14, R2 + ph, 5); cbox(16.5, R2, 4.65, 19, R2 + ph, 5); cbox(13, R2, -3, 16.6, R2 + ph, -2.65); cbox(18.4, R2, -3, 19, R2 + ph, -2.65);
  cbox(18.65, R3, -14, 19, R3 + ph, -6); cbox(15, R3, -6.35, 16.6, R3 + ph, -6); cbox(18.4, R3, -6.35, 19, R3 + ph, -6); cbox(15, R3, -14, 19, R3 + ph, -13.65);
  // the crossings: beam (pinned Sun Gate), stair-bridge (past), scaffold (2049), planks (2196)
  world.beamCols = [];
  for (let k = 0; k < 10; k++) { const z1 = 20.4 - 0.44 * k, z0 = z1 - 0.44, top = ET + 0.25 * (k + 1); const b = cbox(13.7, top - 0.35, z0, 15.3, top, z1); b.enabled = false; world.beamCols.push(b); }
  for (let k = 0; k < 8; k++) { const z1 = 8 - 0.375 * k; cbox(14, R1 + 0.3125 * (k + 1) - 0.55, z1 - 0.375, 16.5, R1 + 0.3125 * (k + 1), z1, ['past']); }
  for (let k = 0; k < 8; k++) { const z1 = -3 - 0.375 * k; cbox(16.6, R2 + 0.3125 * (k + 1) - 0.3, z1 - 0.375, 18.4, R2 + 0.3125 * (k + 1), z1, ['2049']); }
  cbox(9.6, R3 - 0.3, -11, 15.2, R3, -9, ['2196']);
  // ziggurat base (walls + roof slab around the Hall of Dates), terrace parapets, terrace stair
  cbox(-10, C, -5, 10, T1, -4); cbox(-10, C, -28, 10, T1, -27); cbox(-10, C, -27, -9, T1, -5); cbox(9, C, -27, 10, T1, -5); cbox(-9, T1 - 0.8, -27, 9, T1, -5);
  cbox(-10, T1, -4.35, 10, T1 + 0.9, -4); cbox(-10, T1, -28, 10, T1 + 0.9, -27.65); cbox(-10, T1, -28, -9.65, T1 + 0.9, -4); cbox(9.65, T1, -28, 10, T1 + 0.9, -11.2); cbox(9.65, T1, -8.8, 10, T1 + 0.9, -4);
  for (let k = 0; k < 13; k++) { const z1 = -4.6 - 0.569 * k; cbox(7.6, T1, z1 - 0.569, 8.8, T1 + 0.3077 * (k + 1), z1); }
  // drum wall (polar boxes), sky floor / deck (past, 2049), pillar (2196)
  for (let th = 0; th < 360; th += 6) {
    const [x, z] = polar(th, 6.3), inBreak = th >= RIM_BREAK[0] && th <= RIM_BREAK[1];
    if (inBreak) { cbox(x - 0.7, T1, z - 0.7, x + 0.7, TOP, z + 0.7, ['past', '2049']); cbox(x - 0.7, T1, z - 0.7, x + 0.7, TOP - 3.5, z + 0.7, ['2196']); }
    else cbox(x - 0.7, T1, z - 0.7, x + 0.7, TOP, z + 0.7);
  }
  cbox(-5.4, T1, -21.4, 5.4, TOP, -10.6, ['past', '2049']);
  for (let th = 0; th < 360; th += 20) { const [x, z] = polar(th, 4.3); cbox(x - 1.2, T1, z - 1.2, x + 1.2, TOP, z + 1.2, ['past', '2049']); }
  world.pillarCols = [cbox(-2.3, T1, -18.3, 2.3, TOP, -13.7, ['2196'])];
  for (let th = 0; th < 360; th += 10) { const [x, z] = polar(th, 2.55); world.pillarCols.push(cbox(x - 0.65, T1, z - 0.65, x + 0.65, TOP, z + 0.65, ['2196'])); }
  // exterior ring (polar walk boxes), with per-state breaks
  for (let th = 0; th < 360; th += 4) {
    const states = ERAS.filter(e => !(BREAKS[e] || []).some(([b0, b1]) => th >= b0 && th <= b1));
    const [x, z] = polar(th, 8.1);
    if (states.length) cbox(x - 0.85, RING - 0.55, z - 0.85, x + 0.85, RING, z + 0.85, states.length === 3 ? ALL : states);
  }
  // star stair, landing, the star door, the 2049 canopy
  for (let k = 0; k < 15; k++) { const x1 = -0.6 - 0.45 * k; cbox(x1 - 0.45, T1, -24.7, x1, RING + 0.3 * (k + 1), -23.5); }
  cbox(-8.8, T1, -24.9, -6.9, TOP, -18.6); cbox(-8.8, TOP - 0.5, -22.2, -4.4, TOP, -18.6); cbox(-8.8, TOP, -24.9, -8.5, TOP + 1.0, -18.6);
  world.starDoorCol = { past: cbox(-1.0, RING, -24.9, -0.45, RING + 3.2, -23.3, ['past']), later: cbox(-1.0, RING, -24.9, -0.45, RING + 3.2, -23.3, ['2049', '2196']) };
  cbox(-6.4, TOP, -22.4, -4.2, TOP + 3, -18.4, ['2049']);
  // instrument pedestals, the sky table (past), the site cabin
  cbox(-14.5, C, 23, -12.5, C + 0.95, 25, ['past']);
  cbox(P.sunGate[0] - 1.1, ET, P.sunGate[2] - 1.1, P.sunGate[0] + 1.1, ET + 1.0, P.sunGate[2] + 1.1);
  cbox(P.poleSight[0] - 0.6, RING, P.poleSight[2] - 0.6, P.poleSight[0] + 0.6, RING + 1.0, P.poleSight[2] + 0.6);
  cbox(P.armillary[0] - 0.6, TOP, P.armillary[2] - 0.6, P.armillary[0] + 0.6, TOP + 1.1, P.armillary[2] + 0.6);
  cbox(-19, 0, 59.5, -11, 2.9, 66.5, ['2049']);
  // the Hall of Dates floor (inside the base)
  B.hall.box(M.pave, -9, C - 0.2, -27, 9, C + 0.02, -5);

  // ---------- dynamic pieces ----------
  // Sun Gate: yaw = yoke, pitch = ring (local -z = sight line)
  const sg = new THREE.Group(); sg.position.set(...P.sunGate); groups.all.add(sg);
  const sgPed = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.9, 20), M.past.stone); sgPed.position.y = 0.45; sg.add(sgPed);
  const sgYaw = new THREE.Group(); sgYaw.position.y = 0.9; sg.add(sgYaw);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.9, 0.3), dynBronze); arm.position.set(s * 2.75, 1.45, 0); sgYaw.add(arm); }
  const sgBase = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.2, 0.4), dynBronze); sgBase.position.y = 0.1; sgYaw.add(sgBase);
  const sgPitch = new THREE.Group(); sgPitch.position.y = 2.7; sgYaw.add(sgPitch);
  const sgRing = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.12, 10, 64), dynBronze); sgPitch.add(sgRing);
  const sgRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.05, 6, 64), dynBronze); sgPitch.add(sgRing2);
  for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.06), dynBronze); sp.rotation.z = k * Math.PI / 4; sp.position.y = 0; sp.scale.y = 1; sgPitch.add(sp); }
  const sgDisc = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.6, 32), dynBronze); sgDisc.material.side = THREE.DoubleSide; sgPitch.add(sgDisc);
  for (const s of [-1, 1]) { const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), dynDark); ax.rotation.z = Math.PI / 2; ax.position.x = s * 2.55; sgPitch.add(ax); }
  sg.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // the counterweight beam (raised beside the gate until pinned; then the bridge to the first roof)
  const beam = new THREE.Group(); groups.all.add(beam);
  const beamM = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.32, 4.9), dynBronze); beamM.castShadow = true; beam.add(beamM);
  for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 4.9), dynBronze); rail.position.set(s * 0.66, 0.3, 0); beam.add(rail); }
  world.setBeam = (pinned) => {
    if (pinned) { beam.position.set(14.5, (ET + R1) / 2 + 0.05, 18.2); beam.rotation.set(Math.atan2(R1 - ET, 4.2), 0, 0); }
    else { beam.position.set(17.6, ET + 2.5, 22.6); beam.rotation.set(Math.PI / 2, 0, 0.0); }
    for (const b of world.beamCols) b.enabled = pinned;
  };
  world.setBeam(false);
  world.sunGate = { group: sg, yaw: sgYaw, pitch: sgPitch };
  // the sun's beam through the gate (shown when aligned in the past)
  const sunBeam = RZ.lightShaft({ from: [14.5, ET + 3.6, 27], to: [P.sunStone[0], C + 0.05, P.sunStone[2]], radius: [0.45, 0.6], color: 0xffd090, intensity: 0.9 });
  sunBeam.visible = false; groups.past.add(sunBeam); world.sunBeam = sunBeam;
  const sunSpot = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
  sunSpot.rotation.x = -Math.PI / 2; sunSpot.position.set(P.sunStone[0], C + 0.1, P.sunStone[2]); groups.past.add(sunSpot); world.sunSpot = sunSpot;

  // Pole Sight: a long bronze tube on a latitude yoke
  const ps = new THREE.Group(); ps.position.set(...P.poleSight); groups.all.add(ps);
  const psPed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), M.past.stone); psPed.position.y = 0.5; ps.add(psPed);
  const psYaw = new THREE.Group(); psYaw.position.y = 1.0; ps.add(psYaw);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.4), dynBronze); arm.position.set(s * 0.42, 0.55, 0); psYaw.add(arm); }
  const psPitch = new THREE.Group(); psPitch.position.y = 1.0; psYaw.add(psPitch);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 4.6, 18, 1, true), dynBronze); tube.material.side = THREE.DoubleSide; tube.rotation.x = Math.PI / 2; tube.position.z = -0.9; psPitch.add(tube);
  for (const z of [-3.1, -0.9, 1.3]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.04, 6, 20), dynDark); band.position.z = z; psPitch.add(band); }
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.035, 6, 32, Math.PI / 2), dynBronze); arc.rotation.y = Math.PI / 2; arc.position.set(0.5, -0.1, 0); psYaw.add(arc);
  ps.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  world.poleSight = { group: ps, yaw: psYaw, pitch: psPitch, eye: tube };
  // a bronze pin through the yoke (the keepers' lock, past only)
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), M.bronze); pin.rotation.z = Math.PI / 2; pin.position.set(0, 2.0, 0); ps.add(pin); T.only(pin, 'past');

  // Star door (bronze leaves at the foot of the star stair)
  const door = new THREE.Group(); door.position.set(-0.72, RING, -24.1); groups.all.add(door);
  const leaves = [];
  for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.z = s * 0.7; const lf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.0, 0.7), dynBronze); lf.position.set(0, 1.5, -s * 0.35); lf.castShadow = true; piv.add(lf); const star = new THREE.Mesh(new THREE.CircleGeometry(0.16, 5), dynDark); star.position.set(0.06, 2.2, -s * 0.35); star.rotation.y = Math.PI / 2; piv.add(star); door.add(piv); leaves.push({ piv, s }); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.8), M.past.stone); lintel.position.y = 3.2; door.add(lintel);
  world.setDoor = (open) => { for (const l of leaves) l.piv.rotation.y = open ? -l.s * 1.35 : 0; };
  world.doorOpenFor = (era, aligned) => era !== 'past' && aligned;

  // Summit: pillar (2196), orrery ring mesh (2196), armillary (all states, on the pillar / sky floor)
  const pillar = new THREE.Group(); groups['2196'].add(pillar);
  const pil = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, TOP - T1, 32), M['2196'].stone); pil.position.set(DC[0], (T1 + TOP) / 2, DC[1]); pil.castShadow = true; pil.receiveShadow = true; pillar.add(pil);
  const pilTop = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 0.12, 32), M.bronzeOld); pilTop.position.set(DC[0], TOP - 0.04, DC[1]); pillar.add(pilTop);
  world.pillar = pillar;
  const orrery = new THREE.Group(); orrery.position.set(DC[0], 0, DC[1]); groups['2196'].add(orrery);
  const arcs = [[0, 62], [180, 62]];
  for (const [a, len] of arcs) {
    const g = arcGeo(3.4, 5.4, TOP - 0.45, TOP, a, a + len); g.translate(-DC[0], 0, -DC[1]);
    const m = new THREE.Mesh(g, M.bronzeOld); m.castShadow = true; m.receiveShadow = true; orrery.add(m);
    const g2 = arcGeo(4.3, 4.5, TOP - 1.8, TOP - 0.45, a + 4, a + len - 4); g2.translate(-DC[0], 0, -DC[1]); orrery.add(new THREE.Mesh(g2, M.rust));
    for (let k = 0; k < 3; k++) { const th = (a + 10 + k * 20) * DEG; const glyph = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), M.scav); glyph.rotation.x = -Math.PI / 2; glyph.position.set(Math.sin(th) * 4.4, TOP + 0.02, -Math.cos(th) * 4.4); orrery.add(glyph); }
  }
  world.orrery = orrery; world.orreryArcs = arcs;
  // ghost of the ring where it was (shown briefly after a displacement)
  const ghost = new THREE.Group(); ghost.position.copy(orrery.position); groups['2196'].add(ghost);
  for (const [a, len] of arcs) { const g = arcGeo(3.4, 5.4, TOP - 0.45, TOP, a, a + len); g.translate(-DC[0], 0, -DC[1]); ghost.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xb6ff8a, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }))); }
  ghost.visible = false; world.orreryGhost = ghost;
  // Armillary: an equatorial sphere of bronze rings with a sighting tube
  const ar = new THREE.Group(); ar.position.set(...P.armillary); groups.all.add(ar);
  const arPed = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 1.1, 16), M.past.stone); arPed.position.y = 0.55; ar.add(arPed);
  const arYaw = new THREE.Group(); arYaw.position.y = 2.4; ar.add(arYaw);
  const mer = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.06, 8, 48), dynBronze); arYaw.add(mer);
  const hor = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.05, 8, 48), dynBronze); hor.rotation.x = Math.PI / 2; hor.position.y = 0; ar.add(hor); hor.position.y = 2.4;
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 8), dynBronze); leg.position.set(s * 1.0, 1.65, 0); leg.rotation.z = s * 0.5; ar.add(leg); }
  const arPitch = new THREE.Group(); arYaw.add(arPitch);
  const eq = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.05, 8, 48), dynBronze); eq.rotation.y = Math.PI / 2; arPitch.add(eq);
  const arTube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.5, 10), dynBronze); arTube.rotation.x = Math.PI / 2; arPitch.add(arTube);
  const arCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), dynDark); arPitch.add(arCore);
  ar.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  world.armillary = { group: ar, yaw: arYaw, pitch: arPitch, core: arCore };

  // ---------- Hall of Dates (inside the base; shown only while Kai is there) ----------
  buildHall(B.hall, M, world, groups.hall);

  // ---------- era-tinted bronze ----------
  world.tint = (e) => {
    const t = e === 'past' ? [0xc9a050, 1, 0.3] : e === '2049' ? [0x8a7a52, 0.85, 0.5] : [0x6a8466, 0.5, 0.66];
    dynBronze.color.set(t[0]); dynBronze.metalness = t[1]; dynBronze.roughness = t[2];
  };

  // ---------- build batches ----------
  for (const k of ['all', ...ERAS, 'hall']) B[k].build(groups[k], { blockers: true, game, name: 'm7' + k });
  world.update = (dt, t) => { for (const f of world.updaters) f(dt, t); };
  return world;
}

// ----- the past: banners, braziers, offerings, acolyte gear -----
function dressPast(A, Ball, M, world) {
  const R = rng(31);
  for (const [x, z] of [[-4.2, 39], [4.2, 39], [-12, 6], [12, 4], [-6, -3], [6, -3]]) {
    A.cyl(M.wood, x, C + 2.6, z, 0.07, 5.2, 8);
    A.box(R() < 0.5 ? M.clothR : M.clothT, x + 0.05, C + 2.4, z - 0.02, x + 0.85, C + 5.0, z + 0.02);
  }
  world.braziers = [[-3, 35], [3, 35], [10.4, 30], [10.4, 22], [-7, -2.5], [7, -2.5]];
  for (const [x, z] of world.braziers) {
    const y = x > 9 ? ET : C;
    A.cyl(M.bronze, x, y + 0.45, z, 0.18, 0.9, 10); A.cyl(M.bronze, x, y + 0.95, z, 0.45, 0.18, 16, [0, 0, 0], 0.3); A.cyl(M.coals, x, y + 1.05, z, 0.36, 0.05, 14);
  }
  for (let i = 0; i < 9; i++) { const x = -20 + R() * 4, z = 8 + R() * 30; A.cyl(M.woodOld, x, C + 0.3, z, 0.22, 0.6, 10, [0, 0, 0], 0.3); }
  for (let i = 0; i < 5; i++) A.cyl(M.past.stone, 11 + i * 0.9, ET + 0.12, 32.5, 0.3, 0.24, 12);
  // the sky table in the West Hall (its star plates are scattered across the ages)
  A.cyl(M.past.stone, -13.5, C + 0.45, 24, 1.0, 0.9, 20); A.cyl(M.bronze, -13.5, C + 0.92, 24, 0.9, 0.05, 32);
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; A.cyl(M.dark, -13.5 + Math.cos(a) * 0.5, C + 0.95, 24 + Math.sin(a) * 0.5, 0.17, 0.02, 16); }
  void Ball;
}
// ----- 2049: Helix archaeoastronomy site -----
function dressSite(A, M, world, game) {
  const R = rng(49);
  // site compound west of the approach: cabin, tents, generator, floodlights
  A.box(M.panel, -19, 0, 59.5, -11, 2.9, 66.5); A.box(M.dark, -11.02, 0.2, 61.5, -10.96, 2.3, 62.6); A.box(M.led, -11.0, 2.5, 60.5, -10.95, 2.6, 65.5);
  for (const [x, z] of [[-16, 52], [-10, 74], [3.5, 34.5]]) { const y = z < 40 ? C : 0; A.geo(M.tarp, new THREE.ConeGeometry(2.4, 2.6, 4, 1, true), [x, y + 1.3, z], [0, Math.PI / 4, 0]); }
  A.box(M.orange, -22, 0, 54, -20, 1.4, 56);
  A.box(M.panel, 2.5, C + 0.74, 30.8, 4.5, C + 0.8, 31.6); for (const [x, z] of [[2.6, 30.9], [4.4, 30.9], [2.6, 31.5], [4.4, 31.5]]) A.cyl(M.steel, x, C + 0.37, z, 0.025, 0.74, 6);
  world.floods = [[-21, 2, 68], [-20, C, 38], [20, C, 38], [-20, C, -34], [20, C, -34]];
  for (const [x, y, z] of world.floods) { A.cyl(M.steel, x, y + 3.5, z, 0.08, 7, 8); A.box(M.steel, x - 0.6, y + 7, z - 0.15, x + 0.6, y + 7.4, z + 0.15); A.box(M.lamp, x - 0.5, y + 6.92, z - 0.12, x + 0.5, y + 6.98, z + 0.12); }
  // barrier fencing along the base and on the court
  for (const [x0, z0, x1, z1] of [[-12, -1.5, 12, -1.5], [-12, -1.5, -12, 8], [12, -1.5, 12, 8]]) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3.4));
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, ax = x0 + (x1 - x0) * t0, az = z0 + (z1 - z0) * t0, bx = x0 + (x1 - x0) * t1, bz = z0 + (z1 - z0) * t1;
      A.geo(M.fence, new THREE.PlaneGeometry(Math.hypot(bx - ax, bz - az) - 0.1, 1.9), [(ax + bx) / 2, C + 1.05, (az + bz) / 2], [0, Math.atan2(-(bz - az), bx - ax), 0]);
      A.box(M.orange, ax - 0.25, C, az - 0.25, ax + 0.25, C + 0.12, az + 0.25); A.cyl(M.steel, ax, C + 1.05, az, 0.03, 2.0, 6); }
  }
  // survey strings and pegs across the court
  for (let x = -16; x <= 16; x += 4) A.box(M.orange, x - 0.01, C + 0.03, 4, x + 0.01, C + 0.05, 30);
  for (let z = 4; z <= 30; z += 4) A.box(M.orange, -16, C + 0.03, z - 0.01, 16, C + 0.05, z + 0.01);
  // scaffold stair R2 -> R3
  for (let k = 0; k < 8; k++) { const z1 = -3 - 0.375 * k, top = R2 + 0.3125 * (k + 1); A.box(M.woodOld, 16.6, top - 0.06, z1 - 0.375, 18.4, top, z1); }
  for (const x of [16.55, 18.45]) for (const z of [-3, -4.5, -6]) A.cyl(M.steel, x, (C + R3 + 1.1) / 2, z, 0.04, R3 + 1.1 - C, 6);
  for (const x of [16.55, 18.45]) A.geo(M.steel, new THREE.CylinderGeometry(0.03, 0.03, 4.0, 6), [x, (R2 + R3) / 2 + 1, -4.5], [Math.atan2(3, 2.5) - Math.PI / 2 + Math.PI, 0, 0]);
  A.cyl(M.steel, 18.7, R2 + 1.6, -3.3, 0.03, 3.2, 6); A.box(M.lamp, 18.3, R2 + 3.1, -3.65, 18.75, R2 + 3.24, -3.3);
  // canopy over the drum top
  const dome = new THREE.SphereGeometry(7.4, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.55, 1); dome.translate(DC[0], TOP, DC[1]);
  A.push(M.tarp, dome);
  for (let th = 0; th < 360; th += 30) { const [x, z] = polar(th, 7.3); A.cyl(M.steel, x, TOP + 1.2, z, 0.05, 2.4, 6); }
  // broken ring rubble below the 2049 break, rubble around
  for (let th = 56; th < 78; th += 5) { const [x, z] = polar(th, 8.1 + (R() - 0.5)); A.boxc(M['2049'].stone, x, T1 + 0.3, z, 1.0 + R(), 0.6, 0.8 + R() * 0.6, R() * 3, R() * 0.4, R() * 0.4); }
  // signage
  const sm = (lines, o) => new THREE.MeshStandardMaterial({ map: signTex(lines, o), roughness: 0.6 });
  const s1 = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), sm(['SITE 3 · ARCHAEOASTRONOMY', 'NO ENTRY AFTER DARK'], { stripe: true }));
  s1.position.set(-5.3, 1.5, 59.5); s1.rotation.y = Math.PI / 2; world.groups['2049'].add(s1);
  const s2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), sm(['LAT 38.2° N', 'POLE SIGHT · DO NOT TOUCH'], { head: 'SURVEY BOARD' }));
  s2.position.set(6.2, RING + 1.2, -23.0); s2.rotation.y = -0.3; world.groups['2049'].add(s2);
  const s3 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), sm(['STRUCTURAL HAZARD', 'SUMMIT CLOSED'], { stripe: true }));
  s3.position.set(-5.0, TOP + 1.5, -20.6); s3.rotation.y = Math.PI / 2; world.groups['2049'].add(s3);
  void game;
}
// ----- 2196: scavenger camp, planks, overgrowth -----
function dressRuin(A, M, world) {
  const R = rng(96);
  // planks R3 -> terrace
  for (let k = 0; k < 4; k++) A.boxc(k % 2 ? M.rust : M.woodOld, 12.4, R3 - 0.12, -9.4 - k * 0.45, 5.6, 0.12, 0.42, 0, 0, (R() - 0.5) * 0.03);
  A.geo(M.rope, new THREE.CylinderGeometry(0.02, 0.02, 5.6, 4), [12.4, R3 + 0.9, -9.05], [0, 0, Math.PI / 2]);
  A.geo(M.rope, new THREE.CylinderGeometry(0.02, 0.02, 5.6, 4), [12.4, R3 + 0.9, -10.95], [0, 0, Math.PI / 2]);
  // camp in the court: tarps, barrel, salvage
  for (const [x, z, w, d, h] of [[4, 14, 4, 3, 2.2], [-2, 10, 3.4, 3, 1.9], [7.5, 9, 3, 2.6, 2.0]]) {
    A.geo(M.scavTarp, new THREE.PlaneGeometry(w, d), [x, C + h, z], [-Math.PI / 2 + 0.18, 0, R() * 0.2]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.cyl(M.rust, x + sx * w * 0.45, C + h / 2, z + sz * d * 0.45, 0.04, h, 6);
  }
  world.barrel = [2.2, C, 16.2];
  A.cyl(M.rust, 2.2, C + 0.45, 16.2, 0.35, 0.9, 12); A.cyl(M.fire, 2.2, C + 0.92, 16.2, 0.28, 0.04, 12);
  for (let i = 0; i < 14; i++) { const x = 5 + R() * 4, z = 11 + R() * 3; A.boxc(R() < 0.5 ? M.bronzeOld : M.rust, x, C + 0.15 + R() * 0.3, z, 0.3 + R() * 0.8, 0.12 + R() * 0.2, 0.3 + R() * 0.6, R() * 3, R() * 0.6, R() * 0.6); }
  for (let i = 0; i < 4; i++) A.box(M.woodOld, -5 + i * 1.1, C, 17, -4.2 + i * 1.1, C + 0.7, 17.8);
  // rubble below the 2196 ring break and the rim break
  for (let th = 28; th < 46; th += 4) { const [x, z] = polar(th, 8.1 + (R() - 0.5)); A.boxc(M['2196'].stone, x, T1 + 0.3, z, 1.0 + R(), 0.6, 0.9, R() * 3, R() * 0.4, R() * 0.4); }
  // vines down the ziggurat (cards)
  for (let i = 0; i < 18; i++) { const x = -9 + R() * 18; A.box(M.clothT, x, C + 1 + R() * 3, -3.98, x + 0.4 + R() * 0.6, T1 - R() * 2, -3.95); }
}

// ----- the Hall of Dates -----
function buildHall(A, M, world, group) {
  // walls (inner faces), ceiling, 17 steles, the Chronolith alcove
  const st = M.past.stone;
  A.box(st, -9.2, C, -27.2, 9.2, T1 - 0.8, -26.8); A.box(st, -9.2, C, -5.2, 9.2, T1 - 0.8, -4.8);
  A.box(st, -9.2, C, -27.2, -8.8, T1 - 0.8, -4.8); A.box(st, 8.8, C, -27.2, 9.2, T1 - 0.8, -4.8);
  A.box(M.dark, -9, T1 - 1.2, -27, 9, T1 - 0.8, -5);
  for (let x = -6; x <= 6; x += 4) A.box(st, x - 0.3, T1 - 2.0, -27, x + 0.3, T1 - 1.2, -5);
  // stele positions: around the walls, ending at the Chronolith (17th beside it)
  const order = [];
  for (let k = 0; k < 6; k++) order.push([-8.3, -7.5 - k * 3.1, Math.PI / 2]);        // west wall, south -> north
  for (const x of [-6.8, -4.6, 4.6, 6.8]) order.push([x, -26.3, 0]);                  // north wall, either side of the alcove
  for (let k = 0; k < 6; k++) order.push([8.3, -22 + k * 3.1, -Math.PI / 2]);        // east wall, north -> south
  order.push([2.95, -26.1, 0]);                                                       // the seventeenth, beside the black stone
  const steleMeshes = { past: [], '2049': [], '2196': [] };
  order.forEach(([x, z, ry], i) => {
    A.boxc(M.past.stone, x, C + 0.25, z, 1.3, 0.5, 0.6, ry);
    for (const e of ERAS) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.4, 0.3), [st, st, st, st, new THREE.MeshStandardMaterial({ map: steleTex(i, e), roughness: 0.85 }), st]);
      m.position.set(x, C + 1.7, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
      m.userData.states = [e]; steleMeshes[e].push(m); group.add(m);
    }
    const n = V3(Math.sin(ry), 0, Math.cos(ry));
    world.steles.push({ i, pos: [x + n.x * 1.1, C, z + n.z * 1.1], face: [x, C + 1.7, z], n });
  });
  world.steleMeshes = steleMeshes;
  // the Chronolith rises from the floor in its alcove (the observatory's root)
  A.box(st, -2.2, C, -27, 2.2, C + 0.3, -24.6);
  const ch = chronolith(0.9, { power: 0.25 }); ch.position.set(0, C + 2.6, -25.4); group.add(ch); world.hallChronolith = ch;
  world.updaters.push((dt, t) => ch.userData.update(t));
  // Mira's recorder (2049): a small slate with a violet light, hidden behind the 17th stone
  const rec = new THREE.Group(); rec.position.set(2.95, C + 0.55, -26.62);
  rec.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: 0x15141a, metalness: 0.4, roughness: 0.4 })));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.012), glowMat(0x9a7bff, 5)); led.position.set(0, 0.035, 0.08); rec.add(led);
  rec.userData.states = ['2049']; group.add(rec); world.recorder = rec; world.recLed = led;
  // roots (2196) and torches (past) as simple pieces
  const roots = new THREE.Group(); roots.userData.states = ['2196'];
  const R = rng(5);
  for (let i = 0; i < 9; i++) { const pts = [[-6 + R() * 12, T1 - 0.8, -8 - R() * 16]]; for (let k = 1; k < 5; k++) pts.push([pts[k - 1][0] + (R() - 0.5) * 2, pts[k - 1][1] - 1.6 - R(), pts[k - 1][2] + (R() - 0.5) * 2]); const cv = new THREE.CatmullRomCurve3(pts.map(p => V3(...p))); roots.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 16, 0.06 + R() * 0.06, 5), M.woodOld)); }
  group.add(roots);
  const torches = new THREE.Group(); torches.userData.states = ['past'];
  for (const [x, z] of [[-8.6, -12], [-8.6, -20], [8.6, -12], [8.6, -20]]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 8), M.fire); t.position.set(x, C + 2.8, z); torches.add(t); }
  group.add(torches);
  world.hallStateObjs = [rec, roots, torches, ...Object.values(steleMeshes).flat()];
  world.hallLights = [[-7.5, C + 3, -12], [7.5, C + 3, -20], [0, C + 4, -22]];
}

/** Show the hall's state-specific pieces for an era. */
export function hallState(world, e) { for (const o of world.hallStateObjs) o.visible = o.userData.states.includes(e); }
